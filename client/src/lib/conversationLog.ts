/**
 * Concordia Shrine - Conversation Log
 * 
 * 会話ログの保存、分析、セキュリティ可視化
 * - IndexedDBによる永続化
 * - セッション管理
 * - 会話パターン分析
 * - セキュリティメトリクス
 */

import type { SceneType } from './waveEngine';
import type { ConcordiaEvent } from './audioAnalyzer';

// ログエントリ
export interface LogEntry {
  id: string;
  timestamp: number;
  type: 'speech' | 'silence' | 'event' | 'scene_change' | 'security';
  data: {
    text?: string;
    duration?: number;
    scene?: SceneType;
    event?: ConcordiaEvent;
    securityLevel?: number;
    message?: string;
  };
}

// セッション
export interface Session {
  id: string;
  startTime: number;
  endTime?: number;
  entries: LogEntry[];
  summary?: SessionSummary;
}

// セッションサマリー
export interface SessionSummary {
  totalDuration: number;
  speechDuration: number;
  silenceDuration: number;
  sceneDistribution: Record<SceneType, number>;
  eventCounts: Record<string, number>;
  securityScore: number;
  insights: string[];
}

// セキュリティメトリクス
export interface SecurityMetrics {
  overallScore: number;        // 0-100
  barrierStrength: number;     // 結界の強さ 0-1
  threatLevel: number;         // 脅威レベル 0-1
  protectionStatus: 'active' | 'warning' | 'breach';
  indicators: SecurityIndicator[];
}

export interface SecurityIndicator {
  type: 'auth' | 'encryption' | 'privacy' | 'consent';
  status: 'active' | 'inactive' | 'warning';
  label: string;
  description: string;
}

// 感情/文脈分析用のキーワード
const CONTENT_ANALYSIS_CONFIG = {
  '調和': [
    'そうですね', 'なるほど', 'わかります', 'いいですね', '賛成', '楽しい', '嬉しい', 'ありがとう',
    '確かに', 'その通り', 'すごい', '面白い', '大丈夫', '協力', '一緒', 'うんうん'
  ],
  '一方的': [
    'でも', 'いや', '違う', '駄目', '無理', '絶対', 'しなさい', 'やめて', '嫌だ', '最悪',
    '関係ない', 'うるさい', '勝手', '当然', '義務', '命令'
  ],
  '沈黙': [
    'えーと', 'あの', 'その', 'うーん', '...', 'えっと', '自信ない', 'わからない', '微妙'
  ]
};

/**
 * テキストの感情分析を行う
 * 
 * テキストに含まれるキーワードを分析し、会話のシーン（調和、一方的、沈黙）を判定する。
 * CONTENT_ANALYSIS_CONFIGに定義されたキーワードを使用して、テキストの感情的な傾向を判断する。
 * 
 * 処理の流れ:
 * 1. テキストが空の場合はnullを返す
 * 2. 各シーン（調和、一方的、沈黙）のキーワードをチェック
 * 3. キーワードが見つかった場合は、該当するシーンのスコアをインクリメント
 * 4. 最もスコアが高いシーンを返す（スコアが0の場合はnull）
 * 
 * @param text - 分析するテキスト
 * @returns 判定されたシーン（'調和'、'一方的'、'沈黙'）、またはnull（判定できない場合）
 */
export function analyzeSentiment(text: string): SceneType | null {
  if (!text) return null;

  const scores: Record<string, number> = { '調和': 0, '一方的': 0, '沈黙': 0 };
  let found = false;

  for (const [label, keywords] of Object.entries(CONTENT_ANALYSIS_CONFIG)) {
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        scores[label] += 1;
        found = true;
      }
    }
  }

  if (!found) return null;

  let maxLabel: string | null = null;
  let maxScore = -1;
  for (const [label, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      maxLabel = label;
    }
  }

  return maxScore > 0 ? (maxLabel as SceneType) : null;
}

/**
 * IndexedDB ヘルパー
 */
class IndexedDBHelper {
  private dbName = 'ConcordiaShrine';
  private dbVersion = 1;
  private db: IDBDatabase | null = null;

  async open(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // セッションストア
        if (!db.objectStoreNames.contains('sessions')) {
          const sessionStore = db.createObjectStore('sessions', { keyPath: 'id' });
          sessionStore.createIndex('startTime', 'startTime', { unique: false });
        }

        // ログエントリストア
        if (!db.objectStoreNames.contains('entries')) {
          const entryStore = db.createObjectStore('entries', { keyPath: 'id' });
          entryStore.createIndex('sessionId', 'sessionId', { unique: false });
          entryStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  /**
   * セッションを保存する
   * 
   * セッションをIndexedDBに保存する。既に存在する場合は更新される。
   * 
   * @param session - 保存するセッション
   * @throws {Error} データベース操作に失敗した場合
   */
  async saveSession(session: Session): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['sessions'], 'readwrite');
      const store = transaction.objectStore('sessions');
      const request = store.put(session);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  /**
   * セッションを取得する
   * 
   * 指定されたIDのセッションをIndexedDBから取得する。
   * 
   * @param id - 取得するセッションのID
   * @returns セッション、またはnull（存在しない場合）
   * @throws {Error} データベース操作に失敗した場合
   */
  async getSession(id: string): Promise<Session | null> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['sessions'], 'readonly');
      const store = transaction.objectStore('sessions');
      const request = store.get(id);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
  }

  /**
   * すべてのセッションを取得する
   * 
   * IndexedDBに保存されているすべてのセッションを取得する。
   * 
   * @returns セッションの配列
   * @throws {Error} データベース操作に失敗した場合
   */
  async getAllSessions(): Promise<Session[]> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['sessions'], 'readonly');
      const store = transaction.objectStore('sessions');
      const request = store.getAll();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || []);
    });
  }

  async deleteSession(id: string): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['sessions'], 'readwrite');
      const store = transaction.objectStore('sessions');
      const request = store.delete(id);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }
}

/**
 * セッションエンティティ（Rich Domain Model）
 * 
 * セッションのビジネスロジックをカプセル化するドメインモデル。
 * ログエントリの管理、サマリー生成などの機能を提供する。
 */
export class SessionEntity {
  public readonly id: string;
  public readonly startTime: number;
  public endTime?: number;
  private _entries: LogEntry[];
  public summary?: SessionSummary;

  constructor(id?: string) {
    // IDと開始時間の生成をコンストラクタ内で完結させ、不正な状態を防ぐ
    this.id = id || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.startTime = Date.now();
    this._entries = [];
  }

  // ログエントリの追加と不変性の保護
  addEntry(entry: LogEntry): void {
    this._entries.push(entry);
  }

  get entries(): ReadonlyArray<LogEntry> {
    return this._entries;
  }

  /**
   * セッションを終了する
   * 
   * セッションを終了し、サマリーを生成する。
   * 終了時刻を記録し、ログエントリから統計情報を集計してサマリーを作成する。
   * 
   * @param securityScore - セキュリティスコア（0-100）
   * @returns セッションサマリー（継続時間、シーン分布、イベント数、インサイトなど）
   */
  end(securityScore: number): SessionSummary {
    this.endTime = Date.now();
    this.summary = this.generateSummary(securityScore);
    return this.summary;
  }

  // サマリー生成ロジックのカプセル化
  private generateSummary(securityScore: number): SessionSummary {
    const totalDuration = (this.endTime || Date.now()) - this.startTime;

    let speechDuration = 0;
    let silenceDuration = 0;
    const sceneDistribution: Record<SceneType, number> = { '静寂': 0, '調和': 0, '一方的': 0, '沈黙': 0 };
    const eventCounts: Record<string, number> = {};

    for (const entry of this._entries) {
      if (entry.type === 'speech' && entry.data.duration) {
        speechDuration += entry.data.duration;
      } else if (entry.type === 'silence' && entry.data.duration) {
        silenceDuration += entry.data.duration;
      } else if (entry.type === 'scene_change' && entry.data.scene) {
        sceneDistribution[entry.data.scene]++;
      } else if (entry.type === 'event' && entry.data.event) {
        const eventType = entry.data.event.type;
        eventCounts[eventType] = (eventCounts[eventType] || 0) + 1;
      }
    }

    // インサイト生成
    const insights: string[] = [];
    if (sceneDistribution['調和'] > sceneDistribution['一方的'] + sceneDistribution['沈黙']) {
      insights.push('この対話は全体的に調和が取れていました。');
    }
    if ((eventCounts['MonologueLong'] || 0) > 2) {
      insights.push('一方的な発言が多く見られました。対話のバランスを意識してみてください。');
    }
    if ((eventCounts['SilenceLong'] || 0) > 2) {
      insights.push('長い沈黙が複数回ありました。発言しやすい雰囲気作りを心がけてみてください。');
    }
    if ((eventCounts['StableCalm'] || 0) > 3) {
      insights.push('安定した対話が続きました。良いコミュニケーションが取れています。');
    }

    return {
      totalDuration,
      speechDuration,
      silenceDuration,
      sceneDistribution,
      eventCounts,
      securityScore,
      insights
    };
  }

  // 純粋なデータオブジェクトとしてエクスポート（保存用）
  toJSON(): Session {
    return {
      id: this.id,
      startTime: this.startTime,
      endTime: this.endTime,
      entries: [...this._entries], // コピーを返す
      summary: this.summary
    };
  }

  // 保存されたデータからの復元
  static fromJSON(data: Session): SessionEntity {
    // コンストラクタを使わず、既存データから復元するためのファクトリ
    const entity = Object.create(SessionEntity.prototype);
    Object.assign(entity, {
      id: data.id,
      startTime: data.startTime,
      endTime: data.endTime,
      _entries: [...data.entries],
      summary: data.summary
    });
    return entity;
  }
}

/**
 * 会話ログマネージャー
 * 
 * 会話ログの保存、分析、セキュリティ可視化を統合管理するクラス。
 * IndexedDBを使用した永続化、セキュリティメトリクスの計算、コールバック機能を提供する。
 */
export class ConversationLogManager {
  private db: IndexedDBHelper;
  private currentSession: SessionEntity | null = null;
  private securityMetrics: SecurityMetrics;

  // コールバック
  private onLogUpdate?: (entries: LogEntry[]) => void;
  private onSecurityUpdate?: (metrics: SecurityMetrics) => void;

  constructor() {
    this.db = new IndexedDBHelper();
    this.securityMetrics = this.initializeSecurityMetrics();
  }

  /**
   * セキュリティメトリクスを初期化
   */
  private initializeSecurityMetrics(): SecurityMetrics {
    return {
      overallScore: 85,
      barrierStrength: 0.8,
      threatLevel: 0.1,
      protectionStatus: 'active',
      indicators: [
        {
          type: 'auth',
          status: 'active',
          label: '認証',
          description: 'ユーザー認証が有効です'
        },
        {
          type: 'encryption',
          status: 'active',
          label: '暗号化',
          description: '通信は暗号化されています'
        },
        {
          type: 'privacy',
          status: 'active',
          label: 'プライバシー',
          description: 'データはローカルに保存されます'
        },
        {
          type: 'consent',
          status: 'active',
          label: '同意保護',
          description: '判断の自由を守っています'
        }
      ]
    };
  }

  /**
   * ログエントリに応じたメトリクス変化量を計算（純粋関数）
   */
  private calculateMetricUpdates(entry: LogEntry): Partial<SecurityMetrics> {
    const updates: Partial<SecurityMetrics> = {};
    const currentBarrier = this.securityMetrics.barrierStrength;
    const currentThreat = this.securityMetrics.threatLevel;

    // シーン変化による影響
    if (entry.type === 'scene_change' && entry.data.scene) {
      const scene = entry.data.scene;
      if (scene === '調和') {
        updates.threatLevel = Math.max(0, currentThreat - 0.05);
        updates.barrierStrength = Math.min(1, currentBarrier + 0.02);
      } else if (scene === '一方的' || scene === '沈黙') {
        updates.threatLevel = Math.min(1, currentThreat + 0.03);
        updates.barrierStrength = Math.max(0, currentBarrier - 0.01);
      }
    }

    // イベントによる影響
    if (entry.type === 'event' && entry.data.event) {
      const eventType = entry.data.event.type;

      if (eventType === 'MonologueLong' || eventType === 'OverlapBurst') {
        updates.threatLevel = Math.min(1, currentThreat + 0.1);
        updates.barrierStrength = Math.max(0, currentBarrier - 0.05);
      } else if (eventType === 'StableCalm') {
        updates.threatLevel = Math.max(0, currentThreat - 0.15);
        updates.barrierStrength = Math.min(1, currentBarrier + 0.1);
      }
    }

    return updates;
  }

  /**
   * コールバックを設定
   */
  setCallbacks(callbacks: {
    onLogUpdate?: (entries: LogEntry[]) => void;
    onSecurityUpdate?: (metrics: SecurityMetrics) => void;
  }): void {
    this.onLogUpdate = callbacks.onLogUpdate;
    this.onSecurityUpdate = callbacks.onSecurityUpdate;
  }

  /**
   * 新しいセッションを開始する
   * 
   * 新しいセッションエンティティを作成し、セキュリティログを追加する。
   * 「聖域が起動しました。結界が展開されています。」というメッセージを記録する。
   * 
   * @returns 作成されたセッションのID
   */
  startSession(): string {
    // SessionEntity のコンストラクタで安全に初期化
    this.currentSession = new SessionEntity();

    // セキュリティログを追加
    this.addEntry({
      type: 'security',
      data: {
        securityLevel: this.securityMetrics.overallScore,
        message: '聖域が起動しました。結界が展開されています。'
      }
    });

    return this.currentSession.id;
  }

  /**
   * セッションを終了する
   * 
   * 現在のセッションを終了し、サマリーを生成してIndexedDBに保存する。
   * セッション終了時にもセキュリティログを追加する。
   * 
   * @returns セッションサマリー、またはnull（セッションが存在しない場合）
   */
  async endSession(): Promise<SessionSummary | null> {
    if (!this.currentSession) return null;

    // ロジックはエンティティに委譲
    const summary = this.currentSession.end(this.securityMetrics.overallScore);

    // セキュリティログを追加
    this.addEntry({
      type: 'security',
      data: {
        securityLevel: this.securityMetrics.overallScore,
        message: 'セッションが終了しました。ログは安全に保存されます。'
      }
    });

    // IndexedDBに保存 (JSON形式に変換)
    await this.db.saveSession(this.currentSession.toJSON());

    this.currentSession = null;

    return summary;
  }

  /**
   * ログエントリを追加する
   * 
   * 現在のセッションにログエントリを追加し、セキュリティメトリクスを更新する。
   * IDとタイムスタンプを自動的に生成してエントリを完成させる。
   * 
   * @param entry - 追加するログエントリ（IDとタイムスタンプは自動生成）
   */
  addEntry(entry: Omit<LogEntry, 'id' | 'timestamp'>): void {
    if (!this.currentSession) return;

    const fullEntry: LogEntry = {
      id: `entry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      ...entry
    };

    // エンティティのメソッドを使用
    this.currentSession.addEntry(fullEntry);

    // 読み取り専用プロパティへアクセス
    this.onLogUpdate?.([...this.currentSession.entries]);

    // セキュリティメトリクスを更新
    this.updateSecurityMetrics(fullEntry);
  }

  /**
   * 発話を記録する
   * 
   * 発話テキストと継続時間を記録し、感情分析を実行してシーン変更を検出する。
   * 感情分析の結果、シーンが判定された場合はシーン変更ログも追加される。
   * 
   * @param text - 発話テキスト
   * @param duration - 発話の継続時間（秒、オプション）
   */
  logSpeech(text: string, duration?: number): void {
    this.addEntry({
      type: 'speech',
      data: { text, duration }
    });

    // 感情分析
    const sentiment = analyzeSentiment(text);
    if (sentiment) {
      this.addEntry({
        type: 'scene_change',
        data: { scene: sentiment }
      });
    }
  }

  /**
   * 沈黙を記録する
   * 
   * 沈黙の継続時間を記録する。
   * 
   * @param duration - 沈黙の継続時間（秒）
   */
  logSilence(duration: number): void {
    this.addEntry({
      type: 'silence',
      data: { duration }
    });
  }

  /**
   * イベントを記録する
   * 
   * 音声分析で検出されたイベント（長い沈黙、長い独演、オーバーラップ、安定した状態など）を記録する。
   * 
   * @param event - 記録するイベント（タイプ、タイムスタンプ、メタデータを含む）
   */
  logEvent(event: ConcordiaEvent): void {
    this.addEntry({
      type: 'event',
      data: { event }
    });
  }

  /**
   * シーン変更を記録する
   * 
   * 会話のシーン（静寂、調和、一方的、沈黙）の変更を記録する。
   * 
   * @param scene - 変更後のシーン
   */
  logSceneChange(scene: SceneType): void {
    this.addEntry({
      type: 'scene_change',
      data: { scene }
    });
  }

  /**
   * セキュリティメトリクスを更新
   */
  private updateSecurityMetrics(entry: LogEntry): void {
    // 統合された計算ロジックを使用
    const updates = this.calculateMetricUpdates(entry);

    // 値の更新
    if (updates.threatLevel !== undefined) this.securityMetrics.threatLevel = updates.threatLevel;
    if (updates.barrierStrength !== undefined) this.securityMetrics.barrierStrength = updates.barrierStrength;

    // インジケーターの状態更新（副作用として実行）
    this.updateIndicators(entry);

    this.updateOverallScore();
    this.onSecurityUpdate?.(this.securityMetrics);
  }

  /**
   * インジケーターの状態更新
   */
  private updateIndicators(entry: LogEntry): void {
    if (entry.type === 'event' && entry.data.event) {
      const eventType = entry.data.event.type;
      const consentIndicator = this.securityMetrics.indicators.find(i => i.type === 'consent');

      if (consentIndicator) {
        if (eventType === 'MonologueLong' || eventType === 'OverlapBurst') {
          consentIndicator.status = 'warning';
          consentIndicator.description = '同調圧力が検出されています';
        } else if (eventType === 'StableCalm') {
          consentIndicator.status = 'active';
          consentIndicator.description = '判断の自由を守っています';
        }
      }
    }
  }

  /**
   * 総合スコアを更新
   */
  private updateOverallScore(): void {
    this.securityMetrics.overallScore = Math.round(
      (this.securityMetrics.barrierStrength * 50 + (1 - this.securityMetrics.threatLevel) * 50)
    );

    // 保護ステータスを更新
    if (this.securityMetrics.overallScore >= 70) {
      this.securityMetrics.protectionStatus = 'active';
    } else if (this.securityMetrics.overallScore >= 40) {
      this.securityMetrics.protectionStatus = 'warning';
    } else {
      this.securityMetrics.protectionStatus = 'breach';
    }
  }

  // SessionEntityに移動したため、generateSummary は削除

  /**
   * 現在のセキュリティメトリクスを取得する
   * 
   * セキュリティメトリクスのコピーを返す（不変性を保証）。
   * 
   * @returns セキュリティメトリクス（総合スコア、結界の強さ、脅威レベル、保護ステータス、インジケーター）
   */
  getSecurityMetrics(): SecurityMetrics {
    return { ...this.securityMetrics };
  }

  /**
   * 現在のセッションのログを取得する
   * 
   * 現在のセッションに記録されているすべてのログエントリを取得する。
   * 読み取り専用のコピーを返す（不変性を保証）。
   * 
   * @returns ログエントリの配列（セッションが存在しない場合は空配列）
   */
  getCurrentLogs(): LogEntry[] {
    // SessionEntity から取得（読み取り専用）
    return this.currentSession ? [...this.currentSession.entries] : [];
  }

  /**
   * 過去のセッションを取得する
   * 
   * IndexedDBに保存されているすべてのセッションを取得する。
   * 
   * @returns セッションの配列
   */
  async getPastSessions(): Promise<Session[]> {
    return this.db.getAllSessions();
  }

  /**
   * セッションを削除する
   * 
   * 指定されたIDのセッションをIndexedDBから削除する。
   * 
   * @param id - 削除するセッションのID
   */
  async deleteSession(id: string): Promise<void> {
    return this.db.deleteSession(id);
  }
}

export default ConversationLogManager;
