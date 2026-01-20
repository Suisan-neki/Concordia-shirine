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
  stableSpeakerSwitchMin: number; // 安定状態で必要な話者切替数
  monologueGapToleranceSec: number; // 一人語りの短い間を許容する秒数
  cooldownSec: number;         // イベント間のクールダウン（秒）
  vadThreshold: number;        // VAD閾値
  speakerSwitchMinIntervalSec: number; // 話者切替の最小間隔（秒）
}

const DEFAULT_CONFIG: AudioAnalyzerConfig = {
  silenceLongSec: 12.0,
  monologueLongSec: 30.0,
  overlapWindowSec: 5.0,
  overlapSwitchThreshold: 8,
  stableMinDurationSec: 15.0,
  cooldownSec: 10.0,
  vadThreshold: 0.005,
  stableSpeakerSwitchMin: 2,
  monologueGapToleranceSec: 2.5,
  speakerSwitchMinIntervalSec: 1.2
};

/**
 * イベント検出器
 * 
 * 音声分析から得られる情報（発話/沈黙の状態、切り替え回数など）を分析し、
 * 会話パターンからイベント（長い沈黙、長い独演、オーバーラップ、安定した状態など）を検出する。
 */
export class EventDetector {
  private config: AudioAnalyzerConfig;
  private speechRunLength: number = 0;
  private silenceRunLength: number = 0;
  private windowBuffer: Array<{ timestamp: number; isSpeech: boolean }> = [];
  private speakerSwitchBuffer: number[] = [];
  private lastSpeakerSwitchTime: number = 0;
  private lastLabel: boolean | null = null;
  private lastEventTime: number = 0;
  private lastProcessTime: number = 0;
  private lastSpeechTime: number = 0;
  private frameDuration: number = 0.02; // 20ms
  
  constructor(config: Partial<AudioAnalyzerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  /**
   * フレームを処理してイベントを検出する
   * 
   * 音声分析の各フレーム（20msごと）を処理し、連続時間や切り替え回数を計算してイベントを検出する。
   * 
   * 検出されるイベント:
   * - SilenceLong: 長い沈黙が続いた場合
   * - MonologueLong: 長い独演が続いた場合
   * - OverlapBurst: 短時間で発話/沈黙の切り替えが多く発生した場合
   * - StableCalm: 安定した対話が続いている場合
   * 
   * @param isSpeech - 現在のフレームが発話かどうか
   * @param now - 現在時刻（秒、セッション開始からの経過時間）
   * @returns 検出されたイベントの配列（複数のイベントが同時に検出される場合もある）
   */
  process(isSpeech: boolean, now: number): ConcordiaEvent[] {
    const events: ConcordiaEvent[] = [];
    this.lastProcessTime = now;
    
    // 連続時間の更新
    if (isSpeech) {
      this.speechRunLength += this.frameDuration;
      this.silenceRunLength = 0;
      this.lastSpeechTime = now;
    } else {
      this.silenceRunLength += this.frameDuration;
      this.speechRunLength = 0;
    }
    
    // ウィンドウバッファの更新
    this.windowBuffer.push({ timestamp: now, isSpeech });
    this.pruneSpeakerSwitchBuffer(now);
    
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
    const speakerSwitchCount = this.calculateSpeakerSwitchCount();
    
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
        speakerSwitchCount >= this.config.stableSpeakerSwitchMin &&
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

  markSpeakerChange(now: number): void {
    if (now - this.lastSpeakerSwitchTime < this.config.speakerSwitchMinIntervalSec) {
      return;
    }
    this.speakerSwitchBuffer.push(now);
    this.lastSpeakerSwitchTime = now;
    this.pruneSpeakerSwitchBuffer(now);
  }
  
  /**
   * 現在の状態からシーンを判定する
   * 
   * 連続時間や切り替え回数から、会話のシーン（静寂、調和、一方的、沈黙）を判定する。
   * 
   * 判定ロジック:
   * - 沈黙: 沈黙が8秒以上続いている場合
   * - 一方的: 発話が8秒以上続く/発話比率が高く話者切替が少ない場合
   * - 調和: 話者の切り替えが複数回ある場合（活発な対話）
   * - 静寂: 上記以外の場合
   * 
   * @returns 判定されたシーン（'静寂'、'調和'、'一方的'、'沈黙'）
   */
  getScene(): SceneType {
    const speakerSwitchCount = this.calculateSpeakerSwitchCount();
    const speechRatio = this.calculateSpeechRatio();
    const timeSinceSpeech = this.lastProcessTime - this.lastSpeechTime;
    
    if (this.silenceRunLength > 8) {
      return '沈黙';
    } else if (
      this.speechRunLength > 8 ||
      ((speechRatio > 0.55 && speakerSwitchCount <= 1) &&
        timeSinceSpeech <= this.config.monologueGapToleranceSec)
    ) {
      return '一方的';
    } else if (speakerSwitchCount >= 2) {
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

  private calculateSpeakerSwitchCount(): number {
    this.pruneSpeakerSwitchBuffer(this.lastProcessTime);
    return this.speakerSwitchBuffer.length;
  }

  private calculateSpeechRatio(): number {
    if (this.windowBuffer.length === 0) return 0;
    const speechFrames = this.windowBuffer.filter(entry => entry.isSpeech).length;
    return speechFrames / this.windowBuffer.length;
  }

  private pruneSpeakerSwitchBuffer(now: number): void {
    while (
      this.speakerSwitchBuffer.length > 0 &&
      now - this.speakerSwitchBuffer[0] > this.config.overlapWindowSec
    ) {
      this.speakerSwitchBuffer.shift();
    }
  }
  
  /**
   * 状態をリセット
   */
  reset(): void {
    this.speechRunLength = 0;
    this.silenceRunLength = 0;
    this.windowBuffer = [];
    this.speakerSwitchBuffer = [];
    this.lastSpeakerSwitchTime = 0;
    this.lastLabel = null;
    this.lastEventTime = 0;
    this.lastProcessTime = 0;
    this.lastSpeechTime = 0;
  }
}

/**
 * 音声分析器
 * 
 * マイク入力から音声を分析し、音声活動検出（VAD）、シーン判定、イベント検出を行う。
 * Web Audio APIを使用してリアルタイムで音声を処理する。
 */
export class AudioAnalyzer {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private mediaStream: MediaStream | null = null;
  private dataArray: Float32Array<ArrayBuffer> | null = null;
  private eventDetector: EventDetector;
  private config: AudioAnalyzerConfig;
  
  // 状態
  private isRunning: boolean = false;
  private startTime: number = 0;
  private rmsSmooth: number = 0;
  private isSpeech: boolean = false;
  private noiseFloor: number = 0;
  private lastSpeechTime: number = 0;
  private speechHoldSec: number = 0.4;
  private frameCounter: number = 0;
  private pitchFrameSkip: number = 2;
  private lastSegmentPitchHz: number | null = null;
  private lastSegmentEndTime: number = 0;
  private segmentPitchSum: number = 0;
  private segmentPitchCount: number = 0;
  private segmentStartTime: number = 0;
  private segmentSpeakerChecked: boolean = false;
  private pitchChangeThreshold: number = 0.4;
  private segmentMinDurationSec: number = 0.35;
  
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
   * コールバックを設定する
   * 
   * 音声分析の結果を受け取るコールバック関数を設定する。
   * 
   * @param callbacks - コールバック関数のオブジェクト
   * @param callbacks.onEnergyUpdate - 音声エネルギーが更新されたときに呼ばれる（0-1の範囲）
   * @param callbacks.onSceneChange - シーンが変更されたときに呼ばれる
   * @param callbacks.onEvent - イベントが検出されたときに呼ばれる
   * @param callbacks.onSpeechChange - 発話状態が変更されたときに呼ばれる（発話開始/終了）
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
   * 音声入力を開始する
   * 
   * マイクアクセスを取得し、AudioContextを作成して音声分析を開始する。
   * 分析ループを起動し、リアルタイムで音声を処理する。
   * 
   * 処理の流れ:
   * 1. マイクアクセスを取得（エコーキャンセル、ノイズ抑制、自動ゲイン制御を有効化）
   * 2. AudioContextを作成
   * 3. AnalyserNodeを作成（FFTサイズ: 2048、スムージング: 0.8）
   * 4. マイク入力をAnalyserNodeに接続
   * 5. 分析ループを開始
   * 
   * @throws {Error} マイクアクセスの取得に失敗した場合、またはAudioContextの作成に失敗した場合
   */
  async start(deviceId?: string): Promise<void> {
    if (this.isRunning) return;
    
    try {
      // マイクアクセスを取得
      const baseAudioConstraints: MediaTrackConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      };
      const audioConstraints: MediaTrackConstraints = deviceId
        ? { ...baseAudioConstraints, deviceId: { exact: deviceId } }
        : baseAudioConstraints;

      try {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
      } catch (error) {
        if (deviceId) {
          console.warn('Failed to getUserMedia with selected device, falling back to default:', error);
          this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: baseAudioConstraints });
        } else {
          throw error;
        }
      }
      
      // AudioContextを作成
      this.audioContext = new AudioContext();
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.8;
      
      // マイク入力を接続
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      source.connect(this.analyser);
      
      this.dataArray = new Float32Array(new ArrayBuffer(this.analyser.fftSize * 4));
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
   * 音声入力を停止する
   * 
   * マイクアクセスを停止し、AudioContextを閉じて音声分析を終了する。
   * イベント検出器の状態もリセットする。
   */
  stop(): void {
    this.isRunning = false;
    this.isSpeech = false;
    this.rmsSmooth = 0;
    this.noiseFloor = 0;
    this.lastSpeechTime = 0;
    this.frameCounter = 0;
    this.lastSegmentPitchHz = null;
    this.lastSegmentEndTime = 0;
    this.segmentPitchSum = 0;
    this.segmentPitchCount = 0;
    this.segmentStartTime = 0;
    this.segmentSpeakerChecked = false;
    this.eventDetector.reset();
    
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
  }
  
  /**
   * 分析ループ
   */
  private analyze(): void {
    if (!this.isRunning || !this.analyser || !this.dataArray) return;
    
    // 時間データを取得
    const dataArray = this.dataArray;
    this.analyser.getFloatTimeDomainData(dataArray);
    
    // RMSを計算
    const rms = this.calculateRMS(this.dataArray);
    const now = performance.now() / 1000 - this.startTime;
    
    // VAD（音声活動検出）
    const threshold = this.getAdaptiveThreshold();
    const newIsSpeech = this.detectSpeech(rms, threshold, now);
    this.updateNoiseFloor(rms, newIsSpeech);
    
    const wasSpeech = this.isSpeech;
    if (newIsSpeech !== wasSpeech) {
      this.isSpeech = newIsSpeech;
      if (this.isSpeech) {
        this.segmentStartTime = now;
        this.segmentPitchSum = 0;
        this.segmentPitchCount = 0;
        this.segmentSpeakerChecked = false;
      } else if (wasSpeech && this.segmentPitchCount > 0) {
        const segmentDuration = now - this.segmentStartTime;
        if (segmentDuration >= this.segmentMinDurationSec) {
          this.lastSegmentPitchHz = this.segmentPitchSum / this.segmentPitchCount;
          this.lastSegmentEndTime = now;
        }
      }
      this.onSpeechChange?.(this.isSpeech);
    }
    
    // エネルギーを通知
    const normalizedEnergy = Math.min(1, rms / Math.max(threshold, 0.001));
    this.onEnergyUpdate?.(normalizedEnergy);
    
    // 話者の揺らぎを推定（発話セグメントの平均ピッチで比較）
    this.frameCounter += 1;
    if (newIsSpeech && this.frameCounter % this.pitchFrameSkip === 0 && this.audioContext) {
      const pitch = this.estimatePitchHz(this.dataArray, this.audioContext.sampleRate);
      if (pitch) {
        this.segmentPitchSum += pitch;
        this.segmentPitchCount += 1;

        if (
          !this.segmentSpeakerChecked &&
          this.segmentPitchCount >= 6 &&
          now - this.segmentStartTime >= this.segmentMinDurationSec &&
          this.lastSegmentPitchHz !== null
        ) {
          const avgPitch = this.segmentPitchSum / this.segmentPitchCount;
          const ratio = Math.abs(avgPitch - this.lastSegmentPitchHz) / this.lastSegmentPitchHz;
          const gap = this.segmentStartTime - this.lastSegmentEndTime;
          if (gap >= 0.2 && ratio > this.pitchChangeThreshold) {
            this.eventDetector.markSpeakerChange(now);
          }
          this.segmentSpeakerChecked = true;
        }
      }
    }

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
  private detectSpeech(rms: number, threshold: number, now: number): boolean {
    const rise = 1.2;
    const target = rms / Math.max(threshold, 0.001);
    this.rmsSmooth = this.rmsSmooth * (1 - rise * 0.05) + Math.min(target, 3) * (rise * 0.05);

    const startThreshold = 1.05;
    const endThreshold = 0.85;
    const isAbove = this.isSpeech
      ? this.rmsSmooth > endThreshold
      : this.rmsSmooth > startThreshold;

    if (isAbove) {
      this.lastSpeechTime = now;
      return true;
    }

    return now - this.lastSpeechTime <= this.speechHoldSec;
  }

  private estimatePitchHz(buffer: Float32Array, sampleRate: number): number | null {
    const size = buffer.length;
    let mean = 0;
    for (let i = 0; i < size; i++) {
      mean += buffer[i];
    }
    mean /= size;

    let energy = 0;
    for (let i = 0; i < size; i++) {
      const v = buffer[i] - mean;
      energy += v * v;
    }
    if (energy < 1e-6) return null;

    const minLag = Math.floor(sampleRate / 300);
    const maxLag = Math.floor(sampleRate / 80);
    let bestLag = -1;
    let bestCorr = 0;

    for (let lag = minLag; lag <= maxLag; lag += 2) {
      let corr = 0;
      for (let i = 0; i < size - lag; i += 2) {
        const a = buffer[i] - mean;
        const b = buffer[i + lag] - mean;
        corr += a * b;
      }
      if (corr > bestCorr) {
        bestCorr = corr;
        bestLag = lag;
      }
    }

    if (bestLag === -1) return null;
    const confidence = bestCorr / energy;
    if (confidence < 0.2) return null;
    return sampleRate / bestLag;
  }

  private getAdaptiveThreshold(): number {
    const minThreshold = Math.max(0.0015, this.config.vadThreshold * 0.3);
    return Math.max(minThreshold, this.noiseFloor * 2.2);
  }

  private updateNoiseFloor(rms: number, isSpeech: boolean): void {
    const alpha = isSpeech ? 0.005 : 0.02;
    if (this.noiseFloor === 0) {
      this.noiseFloor = rms;
      return;
    }
    this.noiseFloor = this.noiseFloor * (1 - alpha) + rms * alpha;
  }
  
  /**
   * 現在の状態を取得する
   * 
   * 音声分析器の現在の状態（実行中かどうか、発話中かどうか、現在のシーン）を返す。
   * 
   * @returns 状態オブジェクト（isRunning、isSpeech、scene）
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
