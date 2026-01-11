/**
 * Concordia Shrine - セキュリティサービス（コスト最適化版）
 * 
 * 「気づかないうちに守られている」を実現するためのセキュリティ機能
 * 
 * コスト最適化:
 * - ログのバッチ書き込み（メモリバッファリング）
 * - 重要度に基づくサンプリング
 * - キャッシュの活用
 * - 古いデータの自動削除
 */

import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';
import { getDb } from './db';
import { securityAuditLogs, securitySummaries, InsertSecurityAuditLog, users, sessions } from '../drizzle/schema';
import { eq, and, lt, sql } from 'drizzle-orm';
import { ENV } from './_core/env';

/**
 * 暗号化キーを生成する
 * 
 * JWT_SECRET環境変数からSHA-256ハッシュを生成して、AES-256-GCM暗号化に使用するキーを作成します。
 * 本番環境ではデフォルトキーの使用を防ぐため、環境変数が未設定の場合はエラーを投げます。
 * 
 * @returns AES-256-GCM暗号化に使用する32バイトのキー（Buffer形式）
 * @throws {Error} JWT_SECRET環境変数が設定されていない場合
 * 
 * @example
 * const key = getEncryptionKey(); // 32バイトの暗号化キーを取得
 */
const getEncryptionKey = (): Buffer => {
  const secret = ENV.cookieSecret;
  // セキュリティ: 環境変数が未設定または空の場合はエラーを投げる
  // デフォルトキーの使用を防ぎ、設定ミスを早期に検出する
  if (!secret || secret.length === 0) {
    throw new Error('JWT_SECRET environment variable is required. Cannot use default secret in production.');
  }
  // SHA-256ハッシュを生成して32バイトのキーを作成
  // これにより、任意の長さのシークレットから固定長のキーを生成できる
  return createHash('sha256').update(secret).digest();
};

/**
 * レート制限のストレージ（メモリベース）
 * 
 * 識別子（IPアドレスやユーザーIDなど）をキーとして、リクエスト回数とリセット時刻を保存します。
 * 
 * 制限事項:
 * - 単一インスタンスでのみ有効（複数インスタンス間で共有されない）
 * - サーバー再起動で状態が失われる
 * - メモリに保存されるため、大量の識別子がある場合はメモリ使用量が増加する
 * 
 * TODO: 本番環境ではRedis等の共有ストレージに移行して、複数インスタンス間でレート制限を共有する
 */
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

/**
 * レート制限レコードの自動クリーンアップ
 * 
 * メモリリークを防ぐため、期限切れのレート制限レコードを定期的に削除します。
 * リセット時刻から1分以上経過したレコードを削除対象とします。
 * 
 * 実行間隔: 5分ごと
 * 削除条件: リセット時刻から1分以上経過したレコード
 */
setInterval(() => {
  const now = Date.now();
  const keysToDelete: string[] = [];
  
  // すべてのレコードを確認して、期限切れのものを特定
  for (const [key, record] of rateLimitStore.entries()) {
    // リセット時刻から1分以上経過したレコードを削除対象とする
    // 1分のバッファを設けることで、直近のリクエストのレコードは保持される
    if (now > record.resetTime + 60000) {
      keysToDelete.push(key);
    }
  }
  
  // 期限切れレコードを一括削除
  keysToDelete.forEach(key => rateLimitStore.delete(key));
  
  // 削除したレコード数をログに記録（デバッグ用）
  if (keysToDelete.length > 0) {
    console.log(`[Security] Cleaned up ${keysToDelete.length} expired rate limit records`);
  }
}, 5 * 60 * 1000); // 5分ごとにクリーンアップを実行

// ===== コスト最適化: ログバッファリング =====

/**
 * ログバッファのインターフェース
 * 
 * セキュリティイベントをメモリにバッファリングして、一定量または一定時間ごとに
 * データベースに一括書き込みすることで、データベースへの負荷を軽減します。
 */
interface LogBuffer {
  /** バッファに蓄積されたセキュリティイベントの配列 */
  events: Omit<InsertSecurityAuditLog, 'id' | 'createdAt'>[];
  /** 最後にフラッシュ（データベースに書き込み）した時刻（Unix timestamp in ms） */
  lastFlush: number;
}

/** ログバッファの最大サイズ（この数を超えると自動的にフラッシュ） */
const LOG_BUFFER_SIZE = 50;

/** ログバッファの自動フラッシュ間隔（ミリ秒） */
const LOG_FLUSH_INTERVAL = 30000; // 30秒

/** 
 * ログサンプリング率（infoレベルのイベントのみ適用）
 * 
 * 0.1 = 10%のイベントのみ記録し、残り90%はスキップします。
 * warning/criticalレベルのイベントは常に100%記録されます。
 */
const LOG_SAMPLING_RATE = 0.1;

// ===== コスト最適化: キャッシュ =====

/**
 * キャッシュエントリのインターフェース
 * 
 * データと有効期限を保持します。有効期限を過ぎたエントリは自動的に無効になります。
 */
interface CacheEntry<T> {
  /** キャッシュされたデータ */
  data: T;
  /** キャッシュの有効期限（Unix timestamp in ms） */
  expiry: number;
}

/** キャッシュのデフォルト有効期限（ミリ秒） */
const CACHE_TTL = 300000; // 5分

/**
 * セキュリティサービスクラス（コスト最適化版）
 * 
 * 「気づかないうちに守られている」を実現するためのセキュリティ機能を提供します。
 * シングルトンパターンで実装されており、アプリケーション全体で1つのインスタンスを共有します。
 * 
 * 主な機能:
 * - データの暗号化・復号化（AES-256-GCM）
 * - レート制限による異常アクセスのブロック
 * - 入力サニタイズ（XSS、SQLインジェクション等の対策）
 * - アクセス権限の検証
 * - セキュリティイベントのログ記録と分析
 * 
 * コスト最適化:
 * - ログのバッチ書き込み（メモリバッファリング）
 * - 重要度に基づくサンプリング
 * - キャッシュの活用
 * - 古いデータの自動削除
 */
export class SecurityService {
  /** シングルトンインスタンス */
  private static instance: SecurityService;
  
  /** ログバッファ（セキュリティイベントを一時的に保存） */
  private logBuffer: LogBuffer = { events: [], lastFlush: Date.now() };
  
  /** キャッシュ（セキュリティサマリー等を一時的に保存） */
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  
  /** ログフラッシュ用のタイマー */
  private flushTimer: NodeJS.Timeout | null = null;
  
  /**
   * プライベートコンストラクタ（シングルトンパターン）
   * 
   * インスタンス作成時に、定期的なログフラッシュとデータクリーンアップを設定します。
   */
  private constructor() {
    // 定期的なログフラッシュを設定（30秒ごと）
    this.startFlushTimer();
    // 定期的な古いデータの削除を設定（1時間ごと）
    this.scheduleDataCleanup();
  }
  
  /**
   * シングルトンインスタンスを取得する
   * 
   * 初回呼び出し時にインスタンスを作成し、以降は同じインスタンスを返します。
   * 
   * @returns SecurityServiceのシングルトンインスタンス
   */
  static getInstance(): SecurityService {
    if (!SecurityService.instance) {
      SecurityService.instance = new SecurityService();
    }
    return SecurityService.instance;
  }
  
  /**
   * 定期的なログフラッシュタイマーを開始
   * 
   * 30秒ごとにログバッファをデータベースに書き込みます。
   * また、プロセス終了時にもバッファをフラッシュして、ログの損失を防ぎます。
   */
  private startFlushTimer(): void {
    // 既にタイマーが設定されている場合は何もしない（重複防止）
    if (this.flushTimer) return;
    
    // 30秒ごとにログバッファをフラッシュ
    this.flushTimer = setInterval(() => {
      this.flushLogBuffer();
    }, LOG_FLUSH_INTERVAL);
    
    // プロセス終了時にバッファをフラッシュ
    // これにより、アプリケーション終了時にもログが失われないようにする
    process.on('beforeExit', () => this.flushLogBuffer());
  }
  
  /**
   * 古いデータの定期削除をスケジュール
   * 
   * 1時間ごとに30日以上前のセキュリティ監査ログを削除します。
   * これにより、データベースのストレージコストを削減します。
   */
  private scheduleDataCleanup(): void {
    // 1時間ごとに古いデータを削除
    setInterval(() => {
      this.cleanupOldData();
    }, 3600000); // 1時間 = 3600000ミリ秒
  }
  
  /**
   * 古いデータを削除（30日以上前）
   * 
   * 30日以上前のセキュリティ監査ログをデータベースから削除します。
   * これにより、データベースのストレージコストを削減し、パフォーマンスを維持します。
   * 
   * コスト最適化: ストレージコストを削減
   * 
   * @returns 削除されたログの数
   */
  async cleanupOldData(): Promise<{ deletedLogs: number }> {
    try {
      const db = await getDb();
      // データベースが利用できない場合は何もしない
      if (!db) return { deletedLogs: 0 };
      
      // 30日前の時刻を計算（Unix timestamp in ms）
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      
      // 30日以上前の監査ログを削除
      // lt()は「less than」の意味で、指定した時刻より前のレコードを削除
      const result = await db.delete(securityAuditLogs)
        .where(lt(securityAuditLogs.timestamp, thirtyDaysAgo));
      
      // 削除したログ数をログに記録
      console.log(`[Security] Cleaned up old data: ${result[0]?.affectedRows || 0} logs deleted`);
      
      return { deletedLogs: result[0]?.affectedRows || 0 };
    } catch (error) {
      // エラーが発生した場合はログに記録して、0を返す
      // エラーでアプリケーションが停止しないようにする
      console.error('[Security] Failed to cleanup old data:', error);
      return { deletedLogs: 0 };
    }
  }
  
  /**
   * キャッシュからデータを取得する
   * 
   * 指定されたキーに対応するキャッシュエントリを取得します。
   * キャッシュが存在しない、または有効期限が切れている場合はnullを返します。
   * 
   * @param key - キャッシュのキー
   * @returns キャッシュされたデータ、またはnull（キャッシュが存在しない、または期限切れの場合）
   */
  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    // キャッシュエントリが存在しない場合はnullを返す
    if (!entry) return null;
    
    // 有効期限をチェック
    if (Date.now() > entry.expiry) {
      // 期限切れのエントリは削除してnullを返す
      this.cache.delete(key);
      return null;
    }
    
    // 有効なキャッシュデータを返す
    return entry.data;
  }
  
  /**
   * キャッシュにデータを保存する
   * 
   * 指定されたキーとデータをキャッシュに保存します。
   * TTL（Time To Live）を指定することで、キャッシュの有効期限を設定できます。
   * 
   * @param key - キャッシュのキー
   * @param data - キャッシュするデータ
   * @param ttl - キャッシュの有効期限（ミリ秒）。デフォルトは5分
   */
  private setCache<T>(key: string, data: T, ttl: number = CACHE_TTL): void {
    this.cache.set(key, {
      data,
      // 現在時刻 + TTL を有効期限として設定
      expiry: Date.now() + ttl,
    });
  }
  
  /**
   * ログバッファをフラッシュ（一括書き込み）
   * 
   * メモリに蓄積されたセキュリティイベントをデータベースに一括書き込みします。
   * これにより、個別のINSERT文を発行するよりも効率的にデータベースに書き込めます。
   * 
   * コスト最適化: 個別INSERTを一括INSERTに変換することで、データベースへの負荷を軽減
   * 
   * エラーハンドリング:
   * - 書き込みに失敗した場合は、バッファに戻して次回のフラッシュ時に再試行
   * - バッファサイズを超えない範囲で、失敗したイベントを保持
   */
  async flushLogBuffer(): Promise<void> {
    // バッファが空の場合は何もしない
    if (this.logBuffer.events.length === 0) return;
    
    // バッファの内容をコピーして、バッファをクリア
    // コピーを作ることで、書き込み中に新しいイベントが追加されても安全
    const eventsToFlush = [...this.logBuffer.events];
    this.logBuffer.events = [];
    this.logBuffer.lastFlush = Date.now();
    
    try {
      const db = await getDb();
      // データベースが利用できない場合は何もしない
      if (!db) return;
      
      // 一括INSERT: 複数のイベントを1回のSQL文で書き込む
      await db.insert(securityAuditLogs).values(eventsToFlush);
    } catch (error) {
      // エラーが発生した場合はログに記録
      console.error('[Security] Failed to flush log buffer:', error);
      
      // 失敗したイベントをバッファに戻す（最大サイズを超えない範囲で）
      // これにより、次回のフラッシュ時に再試行される
      const remaining = LOG_BUFFER_SIZE - this.logBuffer.events.length;
      if (remaining > 0) {
        // バッファに戻せる分だけ戻す（最大サイズを超えないようにする）
        this.logBuffer.events.push(...eventsToFlush.slice(0, remaining));
      }
    }
  }
  
  /**
   * データを暗号化する
   * 
   * ユーザーには見えないが、すべての機密データはこの関数で暗号化されます。
   * AES-256-GCMアルゴリズムを使用し、認証付き暗号化を実現します。
   * 
   * 暗号化の流れ:
   * 1. ランダムなIV（初期化ベクトル）を生成（16バイト）
   * 2. AES-256-GCMでデータを暗号化
   * 3. 認証タグ（AuthTag）を取得（改ざん検知用）
   * 4. IV、AuthTag、暗号文を結合して返す
   * 
   * @param data - 暗号化する文字列データ
   * @param userId - ユーザーID（ログ記録用、オプション）
   * @param sessionId - セッションID（ログ記録用、オプション）
   * @returns 暗号化されたデータ（形式: "IV:AuthTag:暗号文"、すべて16進数文字列）
   * 
   * @throws {Error} JWT_SECRETが設定されていない場合
   * 
   * @example
   * const encrypted = await securityService.encrypt("sensitive data", userId, sessionId);
   * // 戻り値例: "a1b2c3d4e5f6...:f9e8d7c6b5a4...:1a2b3c4d5e6f..."
   */
  async encrypt(data: string, userId?: number, sessionId?: number): Promise<string> {
    // 暗号化キーを取得（JWT_SECRETからSHA-256ハッシュを生成）
    const key = getEncryptionKey();
    
    // ランダムなIV（初期化ベクトル）を生成
    // 同じデータでも毎回異なる暗号文が生成されるようにするため
    const iv = randomBytes(16);
    
    // AES-256-GCM暗号化器を作成
    // GCMモードは認証付き暗号化を提供し、データの改ざんを検知できる
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    
    // データを暗号化（UTF-8文字列 → 16進数文字列）
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // 認証タグを取得（データの改ざん検知用）
    const authTag = cipher.getAuthTag();
    
    // コスト最適化: 暗号化ログはサンプリング（10%のみ記録）
    // 暗号化は頻繁に実行されるため、すべてを記録するとログが膨大になる
    await this.logSecurityEvent({
      userId,
      sessionId,
      eventType: 'encryption_applied',
      severity: 'info',
      description: 'データが安全に暗号化されました',
      metadata: { dataLength: data.length },
      timestamp: Date.now(),
    });
    
    // IV、AuthTag、暗号文を結合して返す
    // 復号化時にこれらを分離して使用する
    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  }
  
  /**
   * データを復号化する
   * 
   * encrypt()で暗号化されたデータを復号化します。
   * 認証タグを検証することで、データの改ざんを検知します。
   * 
   * 復号化の流れ:
   * 1. 暗号化データをIV、AuthTag、暗号文に分割
   * 2. 暗号化キーを取得
   * 3. 復号化器を作成して認証タグを設定
   * 4. データを復号化
   * 
   * @param encryptedData - 暗号化されたデータ（形式: "IV:AuthTag:暗号文"）
   * @returns 復号化された文字列データ
   * 
   * @throws {Error} 認証タグの検証に失敗した場合（データが改ざんされている可能性）
   * @throws {Error} JWT_SECRETが設定されていない場合
   * 
   * @example
   * const decrypted = securityService.decrypt(encryptedData);
   */
  decrypt(encryptedData: string): string {
    // 暗号化データをIV、AuthTag、暗号文に分割
    // 形式: "IV:AuthTag:暗号文"
    const [ivHex, authTagHex, encrypted] = encryptedData.split(':');
    
    // 暗号化キーを取得（encrypt()と同じキーを使用）
    const key = getEncryptionKey();
    
    // 16進数文字列をBufferに変換
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    // AES-256-GCM復号化器を作成
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    
    // 認証タグを設定（これにより、データの改ざんを検知できる）
    decipher.setAuthTag(authTag);
    
    // データを復号化（16進数文字列 → UTF-8文字列）
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    // 認証タグの検証はfinal()の呼び出し時に自動的に行われる
    // 検証に失敗した場合は例外が投げられる
    
    return decrypted;
  }
  
  /**
   * レート制限をチェックする
   * 
   * 指定された識別子（IPアドレスやユーザーIDなど）のリクエスト回数をチェックし、
   * 制限を超えている場合はアクセスをブロックします。
   * 異常なアクセスパターンを自動で検知してブロックすることで、DDoS攻撃や
   * ブルートフォース攻撃を防ぎます。
   * 
   * 動作:
   * 1. 識別子に対応するレコードを取得
   * 2. レコードが存在しない、またはリセット時刻が過ぎている場合は新しいウィンドウを開始
   * 3. リクエスト回数が制限を超えている場合はアクセスを拒否
   * 4. それ以外の場合はリクエスト回数をインクリメントして許可
   * 
   * @param identifier - レート制限の識別子（例: IPアドレス、ユーザーID）
   * @param limit - 時間窓内での最大リクエスト数（デフォルト: 100）
   * @param windowMs - 時間窓の長さ（ミリ秒、デフォルト: 60000 = 1分）
   * @param userId - ユーザーID（ログ記録用、オプション）
   * @returns アクセス許可状態、残りリクエスト数、リセット時刻
   * 
   * @example
   * const result = await securityService.checkRateLimit("192.168.1.1", 100, 60000);
   * if (!result.allowed) {
   *   // レート制限に達しているため、アクセスを拒否
   * }
   */
  async checkRateLimit(
    identifier: string,
    limit: number = 100,
    windowMs: number = 60000,
    userId?: number
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const now = Date.now();
    const record = rateLimitStore.get(identifier);
    
    // レコードが存在しない、またはリセット時刻が過ぎている場合
    // 新しい時間窓を開始する
    if (!record || now > record.resetTime) {
      // 新しいウィンドウを開始: リクエスト回数を1に設定し、リセット時刻を設定
      rateLimitStore.set(identifier, { count: 1, resetTime: now + windowMs });
      return { 
        allowed: true, 
        remaining: limit - 1, // 残りリクエスト数
        resetTime: now + windowMs 
      };
    }
    
    // リクエスト回数が制限を超えている場合
    if (record.count >= limit) {
      // レート制限を超過 - これは重要なのでサンプリングなしで記録
      // 異常なアクセスパターンを検知したことをログに記録
      await this.logSecurityEvent({
        userId,
        eventType: 'rate_limit_triggered',
        severity: 'warning',
        description: 'レート制限が発動しました。異常なアクセスパターンを検知。',
        // プライバシー保護のため、識別子をハッシュ化して記録
        metadata: { identifier: this.hashIdentifier(identifier), limit, windowMs },
        timestamp: now,
      }, true); // 強制記録（サンプリングをスキップ）
      
      // アクセスを拒否
      return { 
        allowed: false, 
        remaining: 0, 
        resetTime: record.resetTime 
      };
    }
    
    // リクエスト回数をインクリメントして許可
    record.count++;
    return { 
      allowed: true, 
      remaining: limit - record.count, // 残りリクエスト数
      resetTime: record.resetTime 
    };
  }
  
  /**
   * 入力をサニタイズする
   * 
   * ユーザー入力に対して、複数の攻撃ベクトルに対する防御を適用します。
   * XSS攻撃、SQLインジェクション、NoSQLインジェクション、JSONインジェクションを防ぎます。
   * 
   * サニタイズの処理順序:
   * 1. 制御文字の除去（改行とタブは許可）
   * 2. HTMLタグの除去
   * 3. HTMLエスケープ（XSS対策）
   * 4. NoSQLインジェクション対策（$と.のエスケープ）
   * 5. JSONインジェクション対策（バックスラッシュと改行のエスケープ）
   * 6. スクリプトインジェクション対策（javascript:、data:、vbscript:プロトコルの除去）
   * 
   * @param input - サニタイズする入力文字列
   * @param userId - ユーザーID（ログ記録用、オプション）
   * @param sessionId - セッションID（ログ記録用、オプション）
   * @returns サニタイズされた文字列と、変更があったかどうかのフラグ
   * 
   * @example
   * const { sanitized, wasModified } = await securityService.sanitizeInput(userInput);
   * if (wasModified) {
   *   // 危険な文字が検出されてサニタイズされた
   * }
   */
  async sanitizeInput(
    input: string,
    userId?: number,
    sessionId?: number
  ): Promise<{ sanitized: string; wasModified: boolean }> {
    const original = input;
    let sanitized = input;
    
    // 1. 制御文字を除去（改行とタブは許可）
    // 制御文字は予期しない動作を引き起こす可能性があるため除去
    // ただし、改行（\n、\r）とタブ（\t）は許可（ユーザー入力に必要な場合がある）
    sanitized = sanitized.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
    
    // 2. HTMLタグを除去
    // <script>タグなどのHTMLタグを完全に除去して、XSS攻撃を防ぐ
    sanitized = sanitized.replace(/<[^>]*>/g, '');
    
    // 3. HTMLエスケープ（XSS対策）
    // HTMLの特殊文字をエンティティに変換して、ブラウザで解釈されないようにする
    sanitized = sanitized
      .replace(/&/g, '&amp;')   // & → &amp;
      .replace(/</g, '&lt;')    // < → &lt;
      .replace(/>/g, '&gt;')    // > → &gt;
      .replace(/"/g, '&quot;')  // " → &quot;
      .replace(/'/g, '&#x27;')  // ' → &#x27;
      .replace(/\//g, '&#x2F;'); // / → &#x2F;（XSS対策: </script>のような終了タグを防ぐ）
    
    // 4. NoSQLインジェクション対策（MongoDB等のオペレーター文字をエスケープ）
    // $ と . はNoSQLクエリで特別な意味を持つため、エスケープ
    // 例: { $ne: null } のようなクエリインジェクションを防ぐ
    sanitized = sanitized
      .replace(/\$/g, '&#36;')  // $ → &#36;
      .replace(/\./g, '&#46;'); // . → &#46;
    
    // 5. JSONインジェクション対策（JSONメタデータに使用される場合に備えて）
    // バックスラッシュと改行をエスケープして、JSONの構造を改ざんできないようにする
    sanitized = sanitized
      .replace(/\\/g, '&#92;')  // \ → &#92;
      .replace(/\n/g, '&#10;')  // 改行 → &#10;
      .replace(/\r/g, '&#13;'); // キャリッジリターン → &#13;
    
    // 6. スクリプトインジェクション対策（javascript:やdata:プロトコルを無効化）
    // これらのプロトコルは、リンクや画像のURLにスクリプトを埋め込むために使用される可能性がある
    sanitized = sanitized.replace(/javascript:/gi, '');  // javascript:プロトコルを除去
    sanitized = sanitized.replace(/data:/gi, '');        // data:プロトコルを除去
    sanitized = sanitized.replace(/vbscript:/gi, '');   // vbscript:プロトコルを除去
    
    // サニタイズによって変更があったかどうかを確認
    const wasModified = original !== sanitized;
    
    // コスト最適化: 変更があった場合のみ記録（サンプリングあり）
    // サニタイズは頻繁に実行されるため、すべてを記録するとログが膨大になる
    if (wasModified) {
      await this.logSecurityEvent({
        userId,
        sessionId,
        eventType: 'input_sanitized',
        severity: 'info',
        description: '入力データが安全にサニタイズされました',
        metadata: { 
          originalLength: original.length, 
          sanitizedLength: sanitized.length,
          // どの種類のサニタイズが適用されたかを記録（デバッグ用）
          sanitizationTypes: [
            original.length !== sanitized.length ? 'length_changed' : null,
            original.includes('<') ? 'html_tags_removed' : null,
            original.includes('$') || original.includes('.') ? 'nosql_escaped' : null,
            original.includes('\\') ? 'json_escaped' : null,
          ].filter(Boolean) as string[],
        },
        timestamp: Date.now(),
      });
    }
    
    return { sanitized, wasModified };
  }
  
  /**
   * アクセス権限を検証する
   * 
   * ユーザーが指定されたリソースに対してアクションを実行する権限があるかを確認します。
   * リソースタイプに応じて適切な権限チェックを行い、所有者またはadminのみアクセスを許可します。
   * 
   * 権限チェックのルール:
   * - session: セッションの所有者、またはadmin
   * - user: 自分自身、またはadmin
   * - security_summary: 関連するセッションの所有者、またはadmin
   * - その他: adminのみ
   * 
   * コスト最適化: 成功時はサンプリング、失敗時は必ず記録
   * 
   * @param userId - アクセスを試みているユーザーID
   * @param resourceType - リソースのタイプ（'session'、'user'、'security_summary'など）
   * @param resourceId - リソースのID（データベースのID）
   * @param action - 実行しようとしているアクション（'read'、'write'など）
   * @returns アクセスが許可された場合はtrue、拒否された場合はfalse
   * 
   * @example
   * const allowed = await securityService.verifyAccess(userId, 'session', sessionId, 'read');
   * if (!allowed) {
   *   // アクセスが拒否された
   * }
   */
  async verifyAccess(
    userId: number,
    resourceType: string,
    resourceId: number,
    action: string
  ): Promise<boolean> {
    try {
      const db = await getDb();
      // データベースが利用できない場合は安全側に倒して拒否
      // これにより、データベース障害時にもセキュリティが維持される
      if (!db) {
        await this.logSecurityEvent({
          userId,
          eventType: 'access_denied',
          severity: 'warning',
          description: `${resourceType}へのアクセスが拒否されました（データベースエラー）`,
          metadata: { resourceType, resourceId, action },
          timestamp: Date.now(),
        }, true);
        return false;
      }

      // ユーザー情報を取得して、ロール（admin/user）を確認
      const userResult = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      const user = userResult[0];
      
      // ユーザーが存在しない場合は拒否
      if (!user) {
        await this.logSecurityEvent({
          userId,
          eventType: 'access_denied',
          severity: 'warning',
          description: `${resourceType}へのアクセスが拒否されました（ユーザーが見つかりません）`,
          metadata: { resourceType, resourceId, action },
          timestamp: Date.now(),
        }, true);
        return false;
      }

      // admin権限を確認
      const isAdmin = user.role === 'admin';
      let allowed = false;

      // リソースタイプに応じた権限チェック
      switch (resourceType) {
        case 'session':
          // セッションの所有者であるか、adminであることを確認
          // セッションデータを取得して、userIdを比較
          const sessionResult = await db.select().from(sessions).where(eq(sessions.id, resourceId)).limit(1);
          const session = sessionResult[0];
          if (!session) {
            // セッションが存在しない場合は拒否
            allowed = false;
          } else {
            // セッションの所有者、またはadminの場合のみ許可
            allowed = isAdmin || session.userId === userId;
          }
          break;

        case 'user':
          // 自分自身へのアクセス、またはadminであることを確認
          // ユーザーは自分の情報にアクセスできるが、他のユーザーの情報にはアクセスできない
          allowed = isAdmin || resourceId === userId;
          break;

        case 'security_summary':
          // セキュリティサマリーはセッション経由でアクセスされる
          // セッションの所有者であるか、adminであることを確認
          // resourceIdはセッションIDとして扱う
          const summarySessionResult = await db.select()
            .from(sessions)
            .where(eq(sessions.id, resourceId))
            .limit(1);
          const summarySession = summarySessionResult[0];
          if (!summarySession) {
            // セッションが存在しない場合は拒否
            allowed = false;
          } else {
            // セッションの所有者、またはadminの場合のみ許可
            allowed = isAdmin || summarySession.userId === userId;
          }
          break;

        default:
          // 不明なリソースタイプはadminのみ許可
          // これにより、新しいリソースタイプが追加された場合でも安全に動作する
          allowed = isAdmin;
          break;
      }
      
      // コスト最適化: アクセス許可は頻繁なのでサンプリング
      // アクセス拒否は重要なので必ず記録（セキュリティインシデントの調査に必要）
      await this.logSecurityEvent({
        userId,
        eventType: allowed ? 'access_granted' : 'access_denied',
        severity: allowed ? 'info' : 'warning',
        description: allowed 
          ? `${resourceType}へのアクセスが許可されました`
          : `${resourceType}へのアクセスが拒否されました`,
        metadata: { resourceType, resourceId, action, userRole: user.role },
        timestamp: Date.now(),
      }, !allowed); // 拒否時は強制記録（forceLog = true）
      
      return allowed;
    } catch (error) {
      // エラーが発生した場合はログに記録
      console.error('[Security] Error verifying access:', error);
      
      // エラー時は安全側に倒して拒否
      // これにより、予期しないエラーが発生してもセキュリティが維持される
      await this.logSecurityEvent({
        userId,
        eventType: 'access_denied',
        severity: 'warning',
        description: `${resourceType}へのアクセスが拒否されました（エラー発生）`,
        metadata: { resourceType, resourceId, action, error: String(error) },
        timestamp: Date.now(),
      }, true);
      return false;
    }
  }
  
  /**
   * セッションを保護する
   * 
   * 新しいセッションが開始された際に呼び出され、セッション保護が開始されたことを記録します。
   * 「結界が展開されています」というメッセージは、ユーザーには見えないが
   * バックグラウンドでセキュリティ機能が動作していることを表現しています。
   * 
   * @param userId - セッションを作成したユーザーID
   * @param sessionId - セッションID（データベースのID）
   */
  async protectSession(userId: number, sessionId: number): Promise<void> {
    // セッション保護は重要なので必ず記録（サンプリングをスキップ）
    // すべてのセッション開始を記録することで、セキュリティ監査が可能になる
    await this.logSecurityEvent({
      userId,
      sessionId,
      eventType: 'session_protected',
      severity: 'info',
      description: '新しいセッションが保護されました。結界が展開されています。',
      metadata: { protectionLevel: 'standard' },
      timestamp: Date.now(),
    }, true); // 強制記録
  }
  
  /**
   * プライバシーを保護する
   * 
   * 音声データなどの機密データが処理される際に呼び出され、
   * プライバシー保護が適用されたことを記録します。
   * 
   * コスト最適化: 頻繁に呼ばれるのでサンプリング（10%のみ記録）
   * 
   * @param userId - ユーザーID
   * @param sessionId - セッションID
   * @param dataType - 保護されたデータのタイプ（例: 'speech_data'）
   */
  async preservePrivacy(userId: number, sessionId: number, dataType: string): Promise<void> {
    await this.logSecurityEvent({
      userId,
      sessionId,
      eventType: 'privacy_preserved',
      severity: 'info',
      description: `${dataType}のプライバシーが保護されました`,
      metadata: { dataType, localProcessing: true },
      timestamp: Date.now(),
    });
  }
  
  /**
   * 同調圧力を検知した際に呼び出される
   * 
   * 会話中に「一方的」や「沈黙」などの状態が検知され、介入が行われた際に呼び出されます。
   * これはヒューマンセキュリティとサイバーセキュリティの接点を表す重要なイベントです。
   * 
   * コスト最適化: 重要なイベントなので必ず記録（サンプリングをスキップ）
   * 
   * @param userId - ユーザーID
   * @param sessionId - セッションID
   * @param scene - 検知されたシーン（例: '一方的'、'沈黙'）
   * @param duration - シーンが継続した時間（秒）
   */
  async protectConsent(
    userId: number,
    sessionId: number,
    scene: string,
    duration: number
  ): Promise<void> {
    await this.logSecurityEvent({
      userId,
      sessionId,
      eventType: 'consent_protected',
      severity: 'warning',
      description: '同調圧力が検知されました。判断の自由を守るための介入が行われました。',
      metadata: { scene, durationSeconds: duration },
      timestamp: Date.now(),
    }, true); // 強制記録
  }
  
  /**
   * セキュリティイベントをログに記録する
   * 
   * セキュリティ関連のイベント（暗号化、アクセス制御、レート制限など）を
   * ログバッファに追加します。バッファが満杯になった場合、または定期的に
   * データベースに一括書き込みされます。
   * 
   * コスト最適化: バッファリングとサンプリングを適用
   * - infoレベルのイベントは10%のみ記録（サンプリング）
   * - warning/criticalレベルのイベントは100%記録
   * - バッファリングにより、個別INSERTを一括INSERTに変換
   * 
   * @param event - 記録するセキュリティイベントのデータ
   * @param forceLog - trueの場合、サンプリングをスキップして必ず記録する（デフォルト: false）
   * 
   * @example
   * await securityService.logSecurityEvent({
   *   userId: 1,
   *   sessionId: 2,
   *   eventType: 'encryption_applied',
   *   severity: 'info',
   *   description: 'データが暗号化されました',
   *   timestamp: Date.now(),
   * });
   */
  async logSecurityEvent(
    event: Omit<InsertSecurityAuditLog, 'id' | 'createdAt'>,
    forceLog: boolean = false
  ): Promise<void> {
    // コスト最適化: サンプリング
    // infoレベルは10%のみ記録、warning/criticalは必ず記録
    // forceLogがtrueの場合は、サンプリングをスキップして必ず記録
    if (!forceLog && event.severity === 'info') {
      // ランダムな値がサンプリング率（0.1）を超えた場合はスキップ
      if (Math.random() > LOG_SAMPLING_RATE) {
        return; // サンプリングでスキップ
      }
    }
    
    // バッファに追加
    // これにより、個別のINSERT文を発行せずに、後で一括書き込みできる
    this.logBuffer.events.push(event);
    
    // バッファが満杯になったらフラッシュ
    // これにより、バッファサイズを超えないようにする
    if (this.logBuffer.events.length >= LOG_BUFFER_SIZE) {
      await this.flushLogBuffer();
    }
  }
  
  /**
   * セッションのセキュリティサマリーを生成する
   * コスト最適化: キャッシュを使用
   */
  async generateSecuritySummary(sessionId: number): Promise<{
    totalProtectionCount: number;
    details: Array<{ type: string; count: number; description: string }>;
  }> {
    // キャッシュをチェック
    const cacheKey = `security_summary_${sessionId}`;
    const cached = this.getFromCache<{
      totalProtectionCount: number;
      details: Array<{ type: string; count: number; description: string }>;
    }>(cacheKey);
    
    if (cached) {
      return cached;
    }
    
    try {
      // まずバッファをフラッシュして最新データを反映
      await this.flushLogBuffer();
      
      const db = await getDb();
      if (!db) {
        return { totalProtectionCount: 0, details: [] };
      }
      
      // セッションに関連するセキュリティイベントを集計
      const events = await db
        .select({
          eventType: securityAuditLogs.eventType,
          count: sql<number>`count(*)`.as('count'),
        })
        .from(securityAuditLogs)
        .where(eq(securityAuditLogs.sessionId, sessionId))
        .groupBy(securityAuditLogs.eventType);
      
      const eventDescriptions: Record<string, string> = {
        encryption_applied: 'データを暗号化して保護',
        access_granted: 'アクセス権限を検証',
        access_denied: '不正アクセスをブロック',
        rate_limit_triggered: '異常なアクセスを制限',
        input_sanitized: '入力データを安全化',
        session_protected: 'セッションを保護',
        data_integrity_verified: 'データ整合性を検証',
        privacy_preserved: 'プライバシーを保護',
        threat_blocked: '脅威をブロック',
        consent_protected: '判断の自由を守護',
      };
      
      // サンプリングを考慮して推定値を計算
      const details = events.map(e => {
        let count = Number(e.count);
        // infoレベルのイベントはサンプリングされているので推定値を計算
        if (['encryption_applied', 'access_granted', 'privacy_preserved', 'input_sanitized'].includes(e.eventType)) {
          count = Math.round(count / LOG_SAMPLING_RATE);
        }
        return {
          type: e.eventType,
          count,
          description: eventDescriptions[e.eventType] || e.eventType,
        };
      });
      
      const totalProtectionCount = details.reduce((sum, d) => sum + d.count, 0);
      
      // サマリーをデータベースに保存
      const counts = {
        encryptionCount: details.find(d => d.type === 'encryption_applied')?.count || 0,
        accessControlCount: (details.find(d => d.type === 'access_granted')?.count || 0) +
                           (details.find(d => d.type === 'access_denied')?.count || 0),
        sanitizationCount: details.find(d => d.type === 'input_sanitized')?.count || 0,
        privacyProtectionCount: details.find(d => d.type === 'privacy_preserved')?.count || 0,
        consentProtectionCount: details.find(d => d.type === 'consent_protected')?.count || 0,
        threatBlockedCount: details.find(d => d.type === 'threat_blocked')?.count || 0,
        totalProtectionCount,
      };
      
      await db.insert(securitySummaries).values({
        sessionId,
        ...counts,
        details: { events: details },
      }).onDuplicateKeyUpdate({
        set: {
          ...counts,
          details: { events: details },
        },
      });
      
      const result = { totalProtectionCount, details };
      
      // キャッシュに保存
      this.setCache(cacheKey, result);
      
      return result;
    } catch (error) {
      console.error('[Security] Failed to generate summary:', error);
      return { totalProtectionCount: 0, details: [] };
    }
  }
  
  /**
   * ユーザーのセキュリティ統計を取得する
   * 
   * 指定されたユーザーに関連するセキュリティイベントを集計し、
   * イベントタイプ別の発生回数と最近のイベントを返します。
   * 
   * コスト最適化: キャッシュを使用（TTL: 1分）
   * 短いTTLを設定することで、リアルタイム性を保ちつつ、頻繁な再計算を避ける
   * 
   * @param userId - ユーザーID
   * @returns セキュリティ統計（総イベント数、タイプ別の発生回数、最近のイベント）
   * 
   * @example
   * const stats = await securityService.getUserSecurityStats(userId);
   * console.log(`総イベント数: ${stats.totalEvents}`);
   */
  async getUserSecurityStats(userId: number): Promise<{
    totalEvents: number;
    eventsByType: Record<string, number>;
    recentEvents: Array<{
      eventType: string;
      description: string;
      timestamp: number;
    }>;
  }> {
    // キャッシュをチェック（短いTTL: 1分）
    // 1分以内の再リクエストの場合は、キャッシュから返す
    const cacheKey = `user_security_stats_${userId}`;
    const cached = this.getFromCache<{
      totalEvents: number;
      eventsByType: Record<string, number>;
      recentEvents: Array<{
        eventType: string;
        description: string;
        timestamp: number;
      }>;
    }>(cacheKey);
    
    if (cached) {
      return cached;
    }
    
    try {
      const db = await getDb();
      // データベースが利用できない場合は空の統計を返す
      if (!db) {
        return { totalEvents: 0, eventsByType: {}, recentEvents: [] };
      }
      
      // イベントタイプ別の集計
      // ユーザーに関連するすべてのセキュリティイベントを、タイプごとにグループ化してカウント
      const eventsByType = await db
        .select({
          eventType: securityAuditLogs.eventType,
          count: sql<number>`count(*)`.as('count'),
        })
        .from(securityAuditLogs)
        .where(eq(securityAuditLogs.userId, userId))
        .groupBy(securityAuditLogs.eventType);
      
      // 最近のイベント（直近10件）
      // タイムスタンプの降順でソートして、最新の10件を取得
      const recentEvents = await db
        .select({
          eventType: securityAuditLogs.eventType,
          description: securityAuditLogs.description,
          timestamp: securityAuditLogs.timestamp,
        })
        .from(securityAuditLogs)
        .where(eq(securityAuditLogs.userId, userId))
        .orderBy(sql`${securityAuditLogs.timestamp} DESC`)
        .limit(10);
      
      // サンプリングを考慮して推定値を計算
      // infoレベルのイベントは10%のみ記録されているため、実際の発生回数を推定する
      const eventsByTypeMap: Record<string, number> = {};
      let totalEvents = 0;
      
      for (const e of eventsByType) {
        let count = Number(e.count);
        // infoレベルのイベントはサンプリングされているので推定値を計算
        if (['encryption_applied', 'access_granted', 'privacy_preserved', 'input_sanitized'].includes(e.eventType)) {
          count = Math.round(count / LOG_SAMPLING_RATE);
        }
        eventsByTypeMap[e.eventType] = count;
        totalEvents += count;
      }
      
      const result = {
        totalEvents,
        eventsByType: eventsByTypeMap,
        recentEvents: recentEvents.map(e => ({
          eventType: e.eventType,
          description: e.description,
          timestamp: Number(e.timestamp),
        })),
      };
      
      // キャッシュに保存（1分）
      // 短いTTLを設定することで、リアルタイム性を保ちつつ、頻繁な再計算を避ける
      this.setCache(cacheKey, result, 60000);
      
      return result;
    } catch (error) {
      // エラーが発生した場合はログに記録して、空の統計を返す
      console.error('[Security] Failed to get user stats:', error);
      return { totalEvents: 0, eventsByType: {}, recentEvents: [] };
    }
  }
  
  /**
   * 識別子をハッシュ化する（プライバシー保護）
   * 
   * IPアドレスなどの識別子をSHA-256でハッシュ化して、プライバシーを保護します。
   * ログに記録する際に、元の識別子を直接記録せず、ハッシュ値を記録することで、
   * 個人情報の漏洩を防ぎます。
   * 
   * @param identifier - ハッシュ化する識別子（例: IPアドレス）
   * @returns ハッシュ化された識別子（16文字の16進数文字列）
   */
  private hashIdentifier(identifier: string): string {
    // SHA-256でハッシュ化して、最初の16文字を返す
    // これにより、元の識別子を推測することが困難になる
    return createHash('sha256').update(identifier).digest('hex').substring(0, 16);
  }
  
  /**
   * 手動でログバッファをフラッシュする（テスト用）
   * 
   * テスト時に、バッファに蓄積されたログを強制的にデータベースに書き込むために使用します。
   * 通常は自動的にフラッシュされるため、このメソッドを呼び出す必要はありません。
   */
  async forceFlush(): Promise<void> {
    await this.flushLogBuffer();
  }
  
  /**
   * キャッシュをクリアする（テスト用）
   * 
   * テスト時に、キャッシュをクリアして新しいデータを取得できるようにするために使用します。
   * 通常は自動的に期限切れになるため、このメソッドを呼び出す必要はありません。
   */
  clearCache(): void {
    this.cache.clear();
  }
}

// シングルトンインスタンスをエクスポート
export const securityService = SecurityService.getInstance();
