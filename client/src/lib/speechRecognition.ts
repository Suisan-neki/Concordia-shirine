/**
 * Concordia Shrine - Speech Recognition
 * 
 * Web Speech APIを使用したリアルタイム文字起こし
 * - ブラウザネイティブの音声認識
 * - 日本語対応
 * - 連続認識モード
 */

export interface SpeechRecognitionResult {
  text: string;
  confidence: number;
  isFinal: boolean;
  timestamp: number;
}

export interface SpeechRecognitionCallbacks {
  onResult?: (result: SpeechRecognitionResult) => void;
  onError?: (error: string) => void;
  onStart?: () => void;
  onEnd?: () => void;
}

// Web Speech API の型定義
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: {
    isFinal: boolean;
    length: number;
    item(index: number): { transcript: string; confidence: number };
    [index: number]: { transcript: string; confidence: number };
  };
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onstart: (() => void) | null;
  onend: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition: new () => SpeechRecognitionInstance;
  }
}

/**
 * 音声認識マネージャー
 */
export class SpeechRecognitionManager {
  private recognition: SpeechRecognitionInstance | null = null;
  private isRunning: boolean = false;
  private callbacks: SpeechRecognitionCallbacks = {};
  private restartTimeout: ReturnType<typeof setTimeout> | null = null;
  
  constructor() {
    this.initRecognition();
  }
  
  /**
   * 音声認識を初期化
   */
  private initRecognition(): void {
    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognitionClass) {
      console.warn('Web Speech API is not supported in this browser');
      return;
    }
    
    this.recognition = new SpeechRecognitionClass();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'ja-JP';
    this.recognition.maxAlternatives = 1;
    
    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      const results = event.results;
      
      for (let i = event.resultIndex; i < results.length; i++) {
        const result = results[i];
        const transcript = result[0].transcript;
        const confidence = result[0].confidence;
        
        this.callbacks.onResult?.({
          text: transcript,
          confidence: confidence || 0.5,
          isFinal: result.isFinal,
          timestamp: Date.now()
        });
      }
    };
    
    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error);
      
      // 一時的なエラーの場合は再起動
      if (event.error === 'no-speech' || event.error === 'aborted') {
        if (this.isRunning) {
          this.scheduleRestart();
        }
      } else {
        this.callbacks.onError?.(event.error);
      }
    };
    
    this.recognition.onstart = () => {
      this.callbacks.onStart?.();
    };
    
    this.recognition.onend = () => {
      // 意図せず終了した場合は再起動
      if (this.isRunning) {
        this.scheduleRestart();
      } else {
        this.callbacks.onEnd?.();
      }
    };
  }
  
  /**
   * 再起動をスケジュール
   */
  private scheduleRestart(): void {
    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout);
    }
    
    this.restartTimeout = setTimeout(() => {
      if (this.isRunning && this.recognition) {
        try {
          this.recognition.start();
        } catch (e) {
          console.warn('Failed to restart speech recognition:', e);
        }
      }
    }, 100);
  }
  
  /**
   * コールバックを設定
   */
  setCallbacks(callbacks: SpeechRecognitionCallbacks): void {
    this.callbacks = callbacks;
  }
  
  /**
   * 音声認識を開始
   */
  start(): boolean {
    if (!this.recognition) {
      console.warn('Speech recognition not available');
      return false;
    }
    
    if (this.isRunning) {
      return true;
    }
    
    try {
      this.isRunning = true;
      this.recognition.start();
      return true;
    } catch (e) {
      console.error('Failed to start speech recognition:', e);
      this.isRunning = false;
      return false;
    }
  }
  
  /**
   * 音声認識を停止
   */
  stop(): void {
    this.isRunning = false;
    
    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout);
      this.restartTimeout = null;
    }
    
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {
        console.warn('Error stopping speech recognition:', e);
      }
    }
  }
  
  /**
   * サポート状況を確認
   */
  isSupported(): boolean {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }
  
  /**
   * 実行中かどうか
   */
  getIsRunning(): boolean {
    return this.isRunning;
  }
}

export default SpeechRecognitionManager;
