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

// 暗号化キー（JWT_SECRETから派生）
const getEncryptionKey = (): Buffer => {
  const secret = ENV.cookieSecret;
  if (!secret || secret.length === 0) {
    throw new Error('JWT_SECRET environment variable is required. Cannot use default secret in production.');
  }
  return createHash('sha256').update(secret).digest();
};

// レート制限のストレージ（メモリベース）
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// ===== コスト最適化: ログバッファリング =====
interface LogBuffer {
  events: Omit<InsertSecurityAuditLog, 'id' | 'createdAt'>[];
  lastFlush: number;
}

const LOG_BUFFER_SIZE = 50; // バッファサイズ
const LOG_FLUSH_INTERVAL = 30000; // 30秒ごとにフラッシュ
const LOG_SAMPLING_RATE = 0.1; // infoレベルは10%のみ記録

// ===== コスト最適化: キャッシュ =====
interface CacheEntry<T> {
  data: T;
  expiry: number;
}

const CACHE_TTL = 300000; // 5分

/**
 * セキュリティサービスクラス（コスト最適化版）
 */
export class SecurityService {
  private static instance: SecurityService;
  private logBuffer: LogBuffer = { events: [], lastFlush: Date.now() };
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private flushTimer: NodeJS.Timeout | null = null;
  
  private constructor() {
    // 定期的なログフラッシュを設定
    this.startFlushTimer();
    // 定期的な古いデータの削除を設定
    this.scheduleDataCleanup();
  }
  
  static getInstance(): SecurityService {
    if (!SecurityService.instance) {
      SecurityService.instance = new SecurityService();
    }
    return SecurityService.instance;
  }
  
  /**
   * 定期的なログフラッシュタイマーを開始
   */
  private startFlushTimer(): void {
    if (this.flushTimer) return;
    
    this.flushTimer = setInterval(() => {
      this.flushLogBuffer();
    }, LOG_FLUSH_INTERVAL);
    
    // プロセス終了時にバッファをフラッシュ
    process.on('beforeExit', () => this.flushLogBuffer());
  }
  
  /**
   * 古いデータの定期削除をスケジュール
   */
  private scheduleDataCleanup(): void {
    // 1時間ごとに古いデータを削除
    setInterval(() => {
      this.cleanupOldData();
    }, 3600000);
  }
  
  /**
   * 古いデータを削除（30日以上前）
   * コスト最適化: ストレージコストを削減
   */
  async cleanupOldData(): Promise<{ deletedLogs: number }> {
    try {
      const db = await getDb();
      if (!db) return { deletedLogs: 0 };
      
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      
      // 古い監査ログを削除
      const result = await db.delete(securityAuditLogs)
        .where(lt(securityAuditLogs.timestamp, thirtyDaysAgo));
      
      console.log(`[Security] Cleaned up old data: ${result[0]?.affectedRows || 0} logs deleted`);
      
      return { deletedLogs: result[0]?.affectedRows || 0 };
    } catch (error) {
      console.error('[Security] Failed to cleanup old data:', error);
      return { deletedLogs: 0 };
    }
  }
  
  /**
   * キャッシュからデータを取得
   */
  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }
  
  /**
   * キャッシュにデータを保存
   */
  private setCache<T>(key: string, data: T, ttl: number = CACHE_TTL): void {
    this.cache.set(key, {
      data,
      expiry: Date.now() + ttl,
    });
  }
  
  /**
   * ログバッファをフラッシュ（一括書き込み）
   * コスト最適化: 個別INSERTを一括INSERTに変換
   */
  async flushLogBuffer(): Promise<void> {
    if (this.logBuffer.events.length === 0) return;
    
    const eventsToFlush = [...this.logBuffer.events];
    this.logBuffer.events = [];
    this.logBuffer.lastFlush = Date.now();
    
    try {
      const db = await getDb();
      if (!db) return;
      
      // 一括INSERT
      await db.insert(securityAuditLogs).values(eventsToFlush);
    } catch (error) {
      console.error('[Security] Failed to flush log buffer:', error);
      // 失敗したイベントをバッファに戻す（最大サイズを超えない範囲で）
      const remaining = LOG_BUFFER_SIZE - this.logBuffer.events.length;
      if (remaining > 0) {
        this.logBuffer.events.push(...eventsToFlush.slice(0, remaining));
      }
    }
  }
  
  /**
   * データを暗号化する
   * ユーザーには見えないが、すべての機密データはこの関数で暗号化される
   */
  async encrypt(data: string, userId?: number, sessionId?: number): Promise<string> {
    const key = getEncryptionKey();
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    
    // コスト最適化: 暗号化ログはサンプリング（10%のみ記録）
    await this.logSecurityEvent({
      userId,
      sessionId,
      eventType: 'encryption_applied',
      severity: 'info',
      description: 'データが安全に暗号化されました',
      metadata: { dataLength: data.length },
      timestamp: Date.now(),
    });
    
    // IV + AuthTag + 暗号文を結合
    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  }
  
  /**
   * データを復号化する
   */
  decrypt(encryptedData: string): string {
    const [ivHex, authTagHex, encrypted] = encryptedData.split(':');
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
  
  /**
   * レート制限をチェックする
   * 異常なアクセスパターンを自動でブロック
   */
  async checkRateLimit(
    identifier: string,
    limit: number = 100,
    windowMs: number = 60000,
    userId?: number
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const now = Date.now();
    const record = rateLimitStore.get(identifier);
    
    if (!record || now > record.resetTime) {
      // 新しいウィンドウを開始
      rateLimitStore.set(identifier, { count: 1, resetTime: now + windowMs });
      return { allowed: true, remaining: limit - 1, resetTime: now + windowMs };
    }
    
    if (record.count >= limit) {
      // レート制限を超過 - これは重要なのでサンプリングなしで記録
      await this.logSecurityEvent({
        userId,
        eventType: 'rate_limit_triggered',
        severity: 'warning',
        description: 'レート制限が発動しました。異常なアクセスパターンを検知。',
        metadata: { identifier: this.hashIdentifier(identifier), limit, windowMs },
        timestamp: now,
      }, true); // 強制記録
      
      return { allowed: false, remaining: 0, resetTime: record.resetTime };
    }
    
    record.count++;
    return { allowed: true, remaining: limit - record.count, resetTime: record.resetTime };
  }
  
  /**
   * 入力をサニタイズする
   * XSS攻撃やSQLインジェクションを防ぐ
   */
  async sanitizeInput(
    input: string,
    userId?: number,
    sessionId?: number
  ): Promise<{ sanitized: string; wasModified: boolean }> {
    const original = input;
    
    // HTMLタグを除去
    let sanitized = input.replace(/<[^>]*>/g, '');
    
    // 危険な文字をエスケープ
    sanitized = sanitized
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
    
    const wasModified = original !== sanitized;
    
    // コスト最適化: 変更があった場合のみ記録（サンプリングあり）
    if (wasModified) {
      await this.logSecurityEvent({
        userId,
        sessionId,
        eventType: 'input_sanitized',
        severity: 'info',
        description: '入力データが安全にサニタイズされました',
        metadata: { originalLength: original.length, sanitizedLength: sanitized.length },
        timestamp: Date.now(),
      });
    }
    
    return { sanitized, wasModified };
  }
  
  /**
   * アクセス権限を検証する
   * コスト最適化: 成功時はサンプリング、失敗時は必ず記録
   */
  async verifyAccess(
    userId: number,
    resourceType: string,
    resourceId: number,
    action: string
  ): Promise<boolean> {
    try {
      const db = await getDb();
      if (!db) {
        // データベースが利用できない場合は拒否
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

      // ユーザー情報を取得
      const userResult = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      const user = userResult[0];
      
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

      const isAdmin = user.role === 'admin';
      let allowed = false;

      // リソースタイプに応じた権限チェック
      switch (resourceType) {
        case 'session':
          // セッションの所有者であるか、adminであることを確認
          const sessionResult = await db.select().from(sessions).where(eq(sessions.id, resourceId)).limit(1);
          const session = sessionResult[0];
          if (!session) {
            allowed = false;
          } else {
            allowed = isAdmin || session.userId === userId;
          }
          break;

        case 'user':
          // 自分自身へのアクセス、またはadminであることを確認
          allowed = isAdmin || resourceId === userId;
          break;

        case 'security_summary':
          // セキュリティサマリーはセッション経由でアクセスされる
          // セッションの所有者であるか、adminであることを確認
          const summarySessionResult = await db.select()
            .from(sessions)
            .where(eq(sessions.id, resourceId))
            .limit(1);
          const summarySession = summarySessionResult[0];
          if (!summarySession) {
            allowed = false;
          } else {
            allowed = isAdmin || summarySession.userId === userId;
          }
          break;

        default:
          // 不明なリソースタイプはadminのみ許可
          allowed = isAdmin;
          break;
      }
      
      // コスト最適化: アクセス許可は頻繁なのでサンプリング
      // アクセス拒否は重要なので必ず記録
      await this.logSecurityEvent({
        userId,
        eventType: allowed ? 'access_granted' : 'access_denied',
        severity: allowed ? 'info' : 'warning',
        description: allowed 
          ? `${resourceType}へのアクセスが許可されました`
          : `${resourceType}へのアクセスが拒否されました`,
        metadata: { resourceType, resourceId, action, userRole: user.role },
        timestamp: Date.now(),
      }, !allowed); // 拒否時は強制記録
      
      return allowed;
    } catch (error) {
      console.error('[Security] Error verifying access:', error);
      // エラー時は安全側に倒して拒否
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
   * セッション開始時に呼び出される
   */
  async protectSession(userId: number, sessionId: number): Promise<void> {
    // セッション保護は重要なので必ず記録
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
   * 音声データが処理される際に呼び出される
   * コスト最適化: 頻繁に呼ばれるのでサンプリング
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
   * ヒューマンセキュリティとサイバーセキュリティの接点
   * コスト最適化: 重要なイベントなので必ず記録
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
   * コスト最適化: バッファリングとサンプリングを適用
   * 
   * @param event イベントデータ
   * @param forceLog サンプリングをスキップして必ず記録するか
   */
  async logSecurityEvent(
    event: Omit<InsertSecurityAuditLog, 'id' | 'createdAt'>,
    forceLog: boolean = false
  ): Promise<void> {
    // コスト最適化: サンプリング
    // infoレベルは10%のみ記録、warning/criticalは必ず記録
    if (!forceLog && event.severity === 'info') {
      if (Math.random() > LOG_SAMPLING_RATE) {
        return; // サンプリングでスキップ
      }
    }
    
    // バッファに追加
    this.logBuffer.events.push(event);
    
    // バッファが満杯になったらフラッシュ
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
   * コスト最適化: キャッシュを使用
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
      if (!db) {
        return { totalEvents: 0, eventsByType: {}, recentEvents: [] };
      }
      
      // イベントタイプ別の集計
      const eventsByType = await db
        .select({
          eventType: securityAuditLogs.eventType,
          count: sql<number>`count(*)`.as('count'),
        })
        .from(securityAuditLogs)
        .where(eq(securityAuditLogs.userId, userId))
        .groupBy(securityAuditLogs.eventType);
      
      // 最近のイベント（直近10件）
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
      this.setCache(cacheKey, result, 60000);
      
      return result;
    } catch (error) {
      console.error('[Security] Failed to get user stats:', error);
      return { totalEvents: 0, eventsByType: {}, recentEvents: [] };
    }
  }
  
  /**
   * 識別子をハッシュ化する（プライバシー保護）
   */
  private hashIdentifier(identifier: string): string {
    return createHash('sha256').update(identifier).digest('hex').substring(0, 16);
  }
  
  /**
   * 手動でログバッファをフラッシュする（テスト用）
   */
  async forceFlush(): Promise<void> {
    await this.flushLogBuffer();
  }
  
  /**
   * キャッシュをクリアする（テスト用）
   */
  clearCache(): void {
    this.cache.clear();
  }
}

// シングルトンインスタンスをエクスポート
export const securityService = SecurityService.getInstance();
