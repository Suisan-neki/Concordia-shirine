/**
 * Concordia Wave - AWS Transcribe Streaming Manager
 *
 * リアルタイム話者分離付き文字起こし。
 * FastAPI WebSocket エンドポイントを経由して AWS Transcribe Streaming に音声を送り、
 * スピーカーラベル付きの結果からシーンを判定する。
 *
 * シーン判定ロジック:
 * - 過去 30 秒の発話を追跡
 * - 合計発話 < 2 秒 → '静寂'
 * - 1 話者が 75% 以上 → '一方的'
 * - それ以外 → '調和'
 */

import type { SceneType } from '@/lib/waveEngine';

// ---- 型定義 --------------------------------------------------------

export interface SpeakerItem {
  speaker: string;
  content: string;
  type: string;
  start_time: number | string;
  end_time: number | string;
}

export interface TranscribeResult {
  type: 'transcript';
  text: string;
  is_partial: boolean;
  result_id: string;
  speaker_items: SpeakerItem[];
}

export interface AWSTranscribeCallbacks {
  /** 確定テキストが届いたとき */
  onFinalResult?: (text: string, speakerItems: SpeakerItem[]) => void;
  /** 暫定テキストが届いたとき */
  onPartialResult?: (text: string) => void;
  /** シーン（祠の機嫌）が変わったとき */
  onSceneChange?: (scene: SceneType) => void;
  /** 話者の占有率が更新されたとき */
  onSpeakerStats?: (stats: SpeakerStat[]) => void;
  /** 接続状態が変わったとき */
  onStatusChange?: (status: 'connecting' | 'connected' | 'disconnected' | 'error') => void;
  /** エラー */
  onError?: (message: string) => void;
}

// ---- 話者トラッキング -----------------------------------------------

interface SpeakerSegment {
  speaker: string;
  startTime: number;  // Date.now() ベースの ms
  endTime: number;
}

export interface SpeakerStat {
  speaker: string;
  ratio: number;
  durationMs: number;
}

const WINDOW_MS = 30_000;      // 30 秒のスライディングウィンドウ
const DOMINANCE_THRESHOLD = 0.75;  // 75% 以上で「一方的」

function computeSpeakerStats(segments: SpeakerSegment[]): {
  stats: SpeakerStat[];
  totalMs: number;
} {
  const now = Date.now();
  const windowStart = now - WINDOW_MS;

  // ウィンドウ内のセグメントのみ
  const active = segments.filter(s => s.endTime >= windowStart);

  // 各話者の発話時間を集計
  const speakerMs: Record<string, number> = {};
  let totalMs = 0;

  for (const seg of active) {
    const start = Math.max(seg.startTime, windowStart);
    const end = seg.endTime;
    const duration = Math.max(0, end - start);
    speakerMs[seg.speaker] = (speakerMs[seg.speaker] ?? 0) + duration;
    totalMs += duration;
  }

  const stats = Object.entries(speakerMs)
    .map(([speaker, durationMs]) => ({
      speaker,
      durationMs,
      ratio: totalMs > 0 ? durationMs / totalMs : 0,
    }))
    .sort((a, b) => b.ratio - a.ratio);

  return { stats, totalMs };
}

function computeScene(segments: SpeakerSegment[]): SceneType {
  const { stats, totalMs } = computeSpeakerStats(segments);
  if (stats.length === 0 || totalMs <= 0) return '静寂';

  const dominantMs = stats[0]?.durationMs ?? 0;
  const dominanceRatio = dominantMs / totalMs;

  return dominanceRatio >= DOMINANCE_THRESHOLD ? '一方的' : '調和';
}

// ---- メインクラス --------------------------------------------------

export class AWSTranscribeStreamingManager {
  private ws: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private stream: MediaStream | null = null;

  private callbacks: AWSTranscribeCallbacks = {};
  private speakerSegments: SpeakerSegment[] = [];
  private lastScene: SceneType = '静寂';

  // ScriptProcessorNode のバッファサイズ（512〜16384 のうち 4096 が無難）
  private readonly BUFFER_SIZE = 4096;
  private readonly SAMPLE_RATE = 16000;

  /** バックエンドの WebSocket URL を組み立てる */
  private buildWsUrl(): string {
    const apiUrl = import.meta.env.VITE_API_URL as string | undefined;
    if (!apiUrl) return 'ws://localhost:5173/api/v1/transcribe/ws';

    // http(s) → ws(s) に変換
    const wsBase = apiUrl
      .replace(/^https:/, 'wss:')
      .replace(/^http:/, 'ws:')
      .replace(/\/$/, '');
    return `${wsBase}/api/v1/transcribe/ws`;
  }

  /** コールバックを登録 */
  setCallbacks(callbacks: AWSTranscribeCallbacks): void {
    this.callbacks = callbacks;
  }

  /** 録音を開始して WebSocket 接続を確立する */
  async start(deviceId?: string): Promise<void> {
    await this.stop(); // 念のため既存のセッションをクリーンアップ

    this.speakerSegments = [];
    this.lastScene = '静寂';

    // マイクストリームを取得
    const constraints: MediaStreamConstraints = {
      audio: deviceId
        ? { deviceId: { exact: deviceId }, channelCount: 1, sampleRate: this.SAMPLE_RATE }
        : { channelCount: 1, sampleRate: this.SAMPLE_RATE },
    };
    this.stream = await navigator.mediaDevices.getUserMedia(constraints);

    // AudioContext（16kHz に設定するか、ブラウザデフォルトでリサンプリング）
    this.audioContext = new AudioContext({ sampleRate: this.SAMPLE_RATE });
    this.sourceNode = this.audioContext.createMediaStreamSource(this.stream);
    this.processorNode = this.audioContext.createScriptProcessor(
      this.BUFFER_SIZE, 1, 1
    );

    // WebSocket に接続
    const wsUrl = this.buildWsUrl();
    this.callbacks.onStatusChange?.('connecting');

    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(wsUrl);
      ws.binaryType = 'arraybuffer';

      ws.onopen = () => {
        this.callbacks.onStatusChange?.('connected');
        resolve();
      };
      ws.onerror = (e) => {
        this.callbacks.onError?.(`WebSocket error: ${JSON.stringify(e)}`);
        this.callbacks.onStatusChange?.('error');
        reject(new Error('WebSocket connection failed'));
      };
      ws.onclose = () => {
        this.callbacks.onStatusChange?.('disconnected');
      };
      ws.onmessage = (event) => {
        this._handleMessage(event);
      };

      this.ws = ws;
    });

    // AudioWorklet の代わりに ScriptProcessor で PCM を送信
    this.processorNode.onaudioprocess = (event) => {
      if (this.ws?.readyState !== WebSocket.OPEN) return;

      const float32 = event.inputBuffer.getChannelData(0);
      const int16 = this._float32ToInt16(float32);
      this.ws.send(int16.buffer);
    };

    this.sourceNode.connect(this.processorNode);
    this.processorNode.connect(this.audioContext.destination);
  }

  /** 録音を停止し、WebSocket を閉じる */
  async stop(): Promise<void> {
    // ScriptProcessor を切断
    if (this.processorNode) {
      this.processorNode.onaudioprocess = null;
      try { this.processorNode.disconnect(); } catch { /* ignore */ }
      this.processorNode = null;
    }
    if (this.sourceNode) {
      try { this.sourceNode.disconnect(); } catch { /* ignore */ }
      this.sourceNode = null;
    }
    if (this.audioContext) {
      try { await this.audioContext.close(); } catch { /* ignore */ }
      this.audioContext = null;
    }

    // マイクストリームを停止
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    // WebSocket を閉じる（stop コマンドを送信してから閉じる）
    if (this.ws) {
      if (this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify({ type: 'stop' }));
        } catch { /* ignore */ }
        this.ws.close();
      }
      this.ws = null;
    }
  }

  /** Float32 PCM → Int16 PCM に変換 */
  private _float32ToInt16(float32: Float32Array): Int16Array {
    const int16 = new Int16Array(float32.length);
    for (let i = 0; i < float32.length; i++) {
      const clamped = Math.max(-1, Math.min(1, float32[i]));
      int16[i] = clamped < 0
        ? Math.round(clamped * 32768)
        : Math.round(clamped * 32767);
    }
    return int16;
  }

  /** WebSocket メッセージ処理 */
  private _handleMessage(event: MessageEvent): void {
    if (typeof event.data !== 'string') return;

    let payload: TranscribeResult;
    try {
      payload = JSON.parse(event.data) as TranscribeResult;
    } catch {
      return;
    }

    if (payload.type !== 'transcript') return;

    if (payload.is_partial) {
      this.callbacks.onPartialResult?.(payload.text);
      return;
    }

    // --- 確定結果の処理 ---
    this.callbacks.onFinalResult?.(payload.text, payload.speaker_items);

    // スピーカーセグメントを登録
    const now = Date.now();
    if (payload.speaker_items.length > 0) {
      // speaker_items の start_time/end_time は AWS Transcribe の秒単位のオフセット
      // セッション開始からの相対秒数なので、シーン判定には経過 ms として扱う
      // 簡易実装: 現在時刻に対して duration を計算
      const grouped = this._groupBySpeaker(payload.speaker_items);
      for (const [speaker, durationSec] of Object.entries(grouped)) {
        this.speakerSegments.push({
          speaker,
          startTime: now - durationSec * 1000,
          endTime: now,
        });
      }
    } else if (payload.text.trim().length > 0) {
      // スピーカーラベルがない場合は単一話者として扱う
      this.speakerSegments.push({
        speaker: 'spk_0',
        startTime: now - 2000,
        endTime: now,
      });
    }

    // 古いセグメントを削除
    const windowStart = now - WINDOW_MS;
    this.speakerSegments = this.speakerSegments.filter(s => s.endTime >= windowStart);

    // 話者占有率を更新
    const { stats } = computeSpeakerStats(this.speakerSegments);
    this.callbacks.onSpeakerStats?.(stats);

    // シーンを更新
    const newScene = computeScene(this.speakerSegments);
    if (newScene !== this.lastScene) {
      this.lastScene = newScene;
      this.callbacks.onSceneChange?.(newScene);
    }
  }

  /** スピーカーアイテムを話者ごとの合計発話秒数にまとめる */
  private _groupBySpeaker(items: SpeakerItem[]): Record<string, number> {
    const result: Record<string, number> = {};
    for (const item of items) {
      if (item.type !== 'pronunciation') continue;
      if (!item.speaker) continue;
      const start = typeof item.start_time === 'string' ? Number(item.start_time) : item.start_time;
      const end = typeof item.end_time === 'string' ? Number(item.end_time) : item.end_time;
      if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
      const duration = end - start;
      if (duration <= 0) continue;
      result[item.speaker] = (result[item.speaker] ?? 0) + duration;
    }
    return result;
  }

  /** 現在接続されているかどうか */
  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export default AWSTranscribeStreamingManager;
