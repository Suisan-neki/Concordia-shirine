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
 * テキストの感情分析
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
 * 会話ログマネージャー
 */
export class ConversationLogManager {
  private db: IndexedDBHelper;
  private currentSession: Session | null = null;
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
   * 新しいセッションを開始
   */
  startSession(): string {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.currentSession = {
      id: sessionId,
      startTime: Date.now(),
      entries: []
    };
    
    // セキュリティログを追加
    this.addEntry({
      type: 'security',
      data: {
        securityLevel: this.securityMetrics.overallScore,
        message: '聖域が起動しました。結界が展開されています。'
      }
    });
    
    return sessionId;
  }
  
  /**
   * セッションを終了
   */
  async endSession(): Promise<SessionSummary | null> {
    if (!this.currentSession) return null;
    
    this.currentSession.endTime = Date.now();
    this.currentSession.summary = this.generateSummary();
    
    // セキュリティログを追加
    this.addEntry({
      type: 'security',
      data: {
        securityLevel: this.securityMetrics.overallScore,
        message: 'セッションが終了しました。ログは安全に保存されます。'
      }
    });
    
    // IndexedDBに保存
    await this.db.saveSession(this.currentSession);
    
    const summary = this.currentSession.summary;
    this.currentSession = null;
    
    return summary;
  }
  
  /**
   * ログエントリを追加
   */
  addEntry(entry: Omit<LogEntry, 'id' | 'timestamp'>): void {
    if (!this.currentSession) return;
    
    const fullEntry: LogEntry = {
      id: `entry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      ...entry
    };
    
    this.currentSession.entries.push(fullEntry);
    this.onLogUpdate?.(this.currentSession.entries);
    
    // セキュリティメトリクスを更新
    this.updateSecurityMetrics(fullEntry);
  }
  
  /**
   * 発話を記録
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
   * 沈黙を記録
   */
  logSilence(duration: number): void {
    this.addEntry({
      type: 'silence',
      data: { duration }
    });
  }
  
  /**
   * イベントを記録
   */
  logEvent(event: ConcordiaEvent): void {
    this.addEntry({
      type: 'event',
      data: { event }
    });
    
    // イベントに応じてセキュリティメトリクスを更新
    if (event.type === 'MonologueLong' || event.type === 'OverlapBurst') {
      this.securityMetrics.threatLevel = Math.min(1, this.securityMetrics.threatLevel + 0.1);
      this.securityMetrics.barrierStrength = Math.max(0, this.securityMetrics.barrierStrength - 0.05);
      
      // 同意保護インジケーターを警告に
      const consentIndicator = this.securityMetrics.indicators.find(i => i.type === 'consent');
      if (consentIndicator) {
        consentIndicator.status = 'warning';
        consentIndicator.description = '同調圧力が検出されています';
      }
    } else if (event.type === 'StableCalm') {
      this.securityMetrics.threatLevel = Math.max(0, this.securityMetrics.threatLevel - 0.15);
      this.securityMetrics.barrierStrength = Math.min(1, this.securityMetrics.barrierStrength + 0.1);
      
      // 同意保護インジケーターを正常に
      const consentIndicator = this.securityMetrics.indicators.find(i => i.type === 'consent');
      if (consentIndicator) {
        consentIndicator.status = 'active';
        consentIndicator.description = '判断の自由を守っています';
      }
    }
    
    this.updateOverallScore();
    this.onSecurityUpdate?.(this.securityMetrics);
  }
  
  /**
   * シーン変更を記録
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
    // エントリタイプに応じてメトリクスを調整
    if (entry.type === 'scene_change' && entry.data.scene) {
      const scene = entry.data.scene;
      
      if (scene === '調和') {
        this.securityMetrics.threatLevel = Math.max(0, this.securityMetrics.threatLevel - 0.05);
        this.securityMetrics.barrierStrength = Math.min(1, this.securityMetrics.barrierStrength + 0.02);
      } else if (scene === '一方的' || scene === '沈黙') {
        this.securityMetrics.threatLevel = Math.min(1, this.securityMetrics.threatLevel + 0.03);
        this.securityMetrics.barrierStrength = Math.max(0, this.securityMetrics.barrierStrength - 0.01);
      }
      
      this.updateOverallScore();
      this.onSecurityUpdate?.(this.securityMetrics);
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
  
  /**
   * セッションサマリーを生成
   */
  private generateSummary(): SessionSummary {
    if (!this.currentSession) {
      return {
        totalDuration: 0,
        speechDuration: 0,
        silenceDuration: 0,
        sceneDistribution: { '静寂': 0, '調和': 0, '一方的': 0, '沈黙': 0 },
        eventCounts: {},
        securityScore: 0,
        insights: []
      };
    }
    
    const entries = this.currentSession.entries;
    const totalDuration = (this.currentSession.endTime || Date.now()) - this.currentSession.startTime;
    
    let speechDuration = 0;
    let silenceDuration = 0;
    const sceneDistribution: Record<SceneType, number> = { '静寂': 0, '調和': 0, '一方的': 0, '沈黙': 0 };
    const eventCounts: Record<string, number> = {};
    
    for (const entry of entries) {
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
    
    // インサイトを生成
    const insights: string[] = [];
    
    if (sceneDistribution['調和'] > sceneDistribution['一方的'] + sceneDistribution['沈黙']) {
      insights.push('この対話は全体的に調和が取れていました。');
    }
    
    if (eventCounts['MonologueLong'] > 2) {
      insights.push('一方的な発言が多く見られました。対話のバランスを意識してみてください。');
    }
    
    if (eventCounts['SilenceLong'] > 2) {
      insights.push('長い沈黙が複数回ありました。発言しやすい雰囲気作りを心がけてみてください。');
    }
    
    if (eventCounts['StableCalm'] > 3) {
      insights.push('安定した対話が続きました。良いコミュニケーションが取れています。');
    }
    
    return {
      totalDuration,
      speechDuration,
      silenceDuration,
      sceneDistribution,
      eventCounts,
      securityScore: this.securityMetrics.overallScore,
      insights
    };
  }
  
  /**
   * 現在のセキュリティメトリクスを取得
   */
  getSecurityMetrics(): SecurityMetrics {
    return { ...this.securityMetrics };
  }
  
  /**
   * 現在のセッションのログを取得
   */
  getCurrentLogs(): LogEntry[] {
    return this.currentSession?.entries || [];
  }
  
  /**
   * 過去のセッションを取得
   */
  async getPastSessions(): Promise<Session[]> {
    return this.db.getAllSessions();
  }
  
  /**
   * セッションを削除
   */
  async deleteSession(id: string): Promise<void> {
    return this.db.deleteSession(id);
  }
}

export default ConversationLogManager;
