/**
 * Concordia Shrine - Audio Analyzer
 * 
 * 音声入力の分析とイベント検出
 * - VAD (Voice Activity Detection)
 * - シーン判定（静寂、調和、一方的、沈黙）
 * - 音声エネルギーの計算
 */

import type { SceneType } from './waveEngine';

// イベントタイプ
export type EventType = 'SilenceLong' | 'MonologueLong' | 'OverlapBurst' | 'StableCalm';

// イベント
export interface ConcordiaEvent {
  type: EventType;
  timestamp: number;
  metadata: Record<string, unknown>;
}

// 設定
export interface AudioAnalyzerConfig {
  silenceLongSec: number;      // 長い沈黙の閾値（秒）
  monologueLongSec: number;    // 長い独演の閾値（秒）
  overlapWindowSec: number;    // 切り替え検出のウィンドウ（秒）
  overlapSwitchThreshold: number; // 切り替え回数の閾値
  stableMinDurationSec: number;   // 安定状態の最小持続時間（秒）
  cooldownSec: number;         // イベント間のクールダウン（秒）
  vadThreshold: number;        // VAD閾値
}

const DEFAULT_CONFIG: AudioAnalyzerConfig = {
  silenceLongSec: 12.0,
  monologueLongSec: 30.0,
  overlapWindowSec: 5.0,
  overlapSwitchThreshold: 8,
  stableMinDurationSec: 15.0,
  cooldownSec: 10.0,
  vadThreshold: 0.015
};

/**
 * イベント検出器
 */
export class EventDetector {
  private config: AudioAnalyzerConfig;
  private speechRunLength: number = 0;
  private silenceRunLength: number = 0;
  private windowBuffer: Array<{ timestamp: number; isSpeech: boolean }> = [];
  private lastLabel: boolean | null = null;
  private lastEventTime: number = 0;
  private frameDuration: number = 0.02; // 20ms
  
  constructor(config: Partial<AudioAnalyzerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  /**
   * フレームを処理してイベントを検出
   */
  process(isSpeech: boolean, now: number): ConcordiaEvent[] {
    const events: ConcordiaEvent[] = [];
    
    // 連続時間の更新
    if (isSpeech) {
      this.speechRunLength += this.frameDuration;
      this.silenceRunLength = 0;
    } else {
      this.silenceRunLength += this.frameDuration;
      this.speechRunLength = 0;
    }
    
    // ウィンドウバッファの更新
    this.windowBuffer.push({ timestamp: now, isSpeech });
    
    // 古いエントリを削除
    while (
      this.windowBuffer.length > 0 &&
      now - this.windowBuffer[0].timestamp > this.config.overlapWindowSec
    ) {
      this.windowBuffer.shift();
    }
    
    // 切り替え回数を計算
    let switchCount = 0;
    for (let i = 1; i < this.windowBuffer.length; i++) {
      if (this.windowBuffer[i].isSpeech !== this.windowBuffer[i - 1].isSpeech) {
        switchCount++;
      }
    }
    
    this.lastLabel = isSpeech;
    
    // クールダウンチェック
    const canTrigger = now - this.lastEventTime >= this.config.cooldownSec;
    
    // イベント検出
    if (canTrigger) {
      if (this.silenceRunLength >= this.config.silenceLongSec) {
        events.push({
          type: 'SilenceLong',
          timestamp: now,
          metadata: { duration: this.silenceRunLength }
        });
        this.lastEventTime = now;
      } else if (this.speechRunLength >= this.config.monologueLongSec) {
        events.push({
          type: 'MonologueLong',
          timestamp: now,
          metadata: { duration: this.speechRunLength }
        });
        this.lastEventTime = now;
      } else if (switchCount >= this.config.overlapSwitchThreshold) {
        events.push({
          type: 'OverlapBurst',
          timestamp: now,
          metadata: { switches: switchCount }
        });
        this.lastEventTime = now;
      } else if (
        now >= this.config.stableMinDurationSec &&
        switchCount >= 1 &&
        switchCount <= Math.floor(this.config.overlapSwitchThreshold / 2) &&
        this.speechRunLength < this.config.monologueLongSec &&
        this.silenceRunLength < this.config.silenceLongSec
      ) {
        events.push({
          type: 'StableCalm',
          timestamp: now,
          metadata: {}
        });
        this.lastEventTime = now;
      }
    }
    
    return events;
  }
  
  /**
   * 現在の状態からシーンを判定
   */
  getScene(): SceneType {
    const switchCount = this.calculateSwitchCount();
    
    if (this.silenceRunLength > 8) {
      return '沈黙';
    } else if (this.speechRunLength > 8) {
      return '一方的';
    } else if (switchCount >= 6) {
      return '調和';
    }
    return '静寂';
  }
  
  private calculateSwitchCount(): number {
    let count = 0;
    for (let i = 1; i < this.windowBuffer.length; i++) {
      if (this.windowBuffer[i].isSpeech !== this.windowBuffer[i - 1].isSpeech) {
        count++;
      }
    }
    return count;
  }
  
  /**
   * 状態をリセット
   */
  reset(): void {
    this.speechRunLength = 0;
    this.silenceRunLength = 0;
    this.windowBuffer = [];
    this.lastLabel = null;
    this.lastEventTime = 0;
  }
}

/**
 * 音声分析器
 */
export class AudioAnalyzer {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private mediaStream: MediaStream | null = null;
  private dataArray: Float32Array | null = null;
  private eventDetector: EventDetector;
  private config: AudioAnalyzerConfig;
  
  // 状態
  private isRunning: boolean = false;
  private startTime: number = 0;
  private rmsSmooth: number = 0;
  private isSpeech: boolean = false;
  
  // コールバック
  private onEnergyUpdate?: (energy: number) => void;
  private onSceneChange?: (scene: SceneType) => void;
  private onEvent?: (event: ConcordiaEvent) => void;
  private onSpeechChange?: (isSpeech: boolean, text?: string) => void;
  
  constructor(config: Partial<AudioAnalyzerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.eventDetector = new EventDetector(this.config);
  }
  
  /**
   * コールバックを設定
   */
  setCallbacks(callbacks: {
    onEnergyUpdate?: (energy: number) => void;
    onSceneChange?: (scene: SceneType) => void;
    onEvent?: (event: ConcordiaEvent) => void;
    onSpeechChange?: (isSpeech: boolean, text?: string) => void;
  }): void {
    this.onEnergyUpdate = callbacks.onEnergyUpdate;
    this.onSceneChange = callbacks.onSceneChange;
    this.onEvent = callbacks.onEvent;
    this.onSpeechChange = callbacks.onSpeechChange;
  }
  
  /**
   * 音声入力を開始
   */
  async start(): Promise<void> {
    if (this.isRunning) return;
    
    try {
      // マイクアクセスを取得
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      // AudioContextを作成
      this.audioContext = new AudioContext();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.8;
      
      // マイク入力を接続
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      source.connect(this.analyser);
      
      this.dataArray = new Float32Array(this.analyser.fftSize);
      this.startTime = performance.now() / 1000;
      this.isRunning = true;
      
      // 分析ループを開始
      this.analyze();
      
    } catch (error) {
      console.error('Failed to start audio analyzer:', error);
      throw error;
    }
  }
  
  /**
   * 音声入力を停止
   */
  stop(): void {
    this.isRunning = false;
    
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this.analyser = null;
    this.dataArray = null;
    this.eventDetector.reset();
  }
  
  /**
   * 分析ループ
   */
  private analyze(): void {
    if (!this.isRunning || !this.analyser || !this.dataArray) return;
    
    // 時間データを取得
    this.analyser.getFloatTimeDomainData(this.dataArray);
    
    // RMSを計算
    const rms = this.calculateRMS(this.dataArray);
    const now = performance.now() / 1000 - this.startTime;
    
    // VAD（音声活動検出）
    const newIsSpeech = this.detectSpeech(rms);
    
    if (newIsSpeech !== this.isSpeech) {
      this.isSpeech = newIsSpeech;
      this.onSpeechChange?.(this.isSpeech);
    }
    
    // エネルギーを通知
    const normalizedEnergy = Math.min(1, rms / this.config.vadThreshold);
    this.onEnergyUpdate?.(normalizedEnergy);
    
    // イベント検出
    const events = this.eventDetector.process(this.isSpeech, now);
    events.forEach(event => this.onEvent?.(event));
    
    // シーン判定
    const scene = this.eventDetector.getScene();
    this.onSceneChange?.(scene);
    
    // 次のフレーム
    requestAnimationFrame(() => this.analyze());
  }
  
  /**
   * RMSを計算
   */
  private calculateRMS(buffer: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
      sum += buffer[i] * buffer[i];
    }
    return Math.sqrt(sum / buffer.length);
  }
  
  /**
   * 音声活動を検出
   */
  private detectSpeech(rms: number): boolean {
    const rise = 1.2;
    const target = rms / this.config.vadThreshold;
    this.rmsSmooth = this.rmsSmooth * (1 - rise * 0.05) + Math.min(target, 3) * (rise * 0.05);
    return this.rmsSmooth > 1.0;
  }
  
  /**
   * 現在の状態を取得
   */
  getState(): {
    isRunning: boolean;
    isSpeech: boolean;
    scene: SceneType;
  } {
    return {
      isRunning: this.isRunning,
      isSpeech: this.isSpeech,
      scene: this.eventDetector.getScene()
    };
  }
}

export default AudioAnalyzer;
