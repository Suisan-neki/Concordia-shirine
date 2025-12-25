import { CognitoUserPool, CognitoUser, AuthenticationDetails } from 'amazon-cognito-identity-js';

// API Endpoint (Deployed)
const API_ENDPOINT = "https://vs23lo9ehj.execute-api.ap-northeast-1.amazonaws.com/transcribe";

const scene = document.getElementById("scene");
const ctx = scene.getContext("2d");
const startBtn = document.getElementById("start-btn");
const statusEl = document.getElementById("status");
const sceneLabelEl = document.getElementById("scene-label");
const sceneDescEl = document.getElementById("scene-desc");
const debugInfoEl = document.getElementById("debug-info");

// デバッグ情報の初期化
if (debugInfoEl) {
  debugInfoEl.textContent = "デバッグ: 初期化中...";
}

// 設定値（config.yaml相当）
const config = {
  audio: {
    sample_rate: 16000,
    frame_duration_sec: 0.02,
    device_index: null
  },
  vad: {
    aggressiveness: 2
  },
  events: {
    silence_long_sec: 12.0,
    monologue_long_sec: 30.0,
    overlap_window_sec: 5.0,
    overlap_switch_threshold: 8,
    stable_min_duration_sec: 15.0
  },
  effects: {
    cooldown_sec: 10.0
  },
  visuals: {
    base_color_calm: "#66ccff",
    base_color_tense: "#ffcc66"
  },
  sound: {
    enabled: true,
    base_dir: "sounds"
  }
};

// ConcordiaEvent データクラス
class ConcordiaEvent {
  constructor(type, timestamp, metadata = {}) {
    this.type = type; // "SilenceLong" | "MonologueLong" | "OverlapBurst" | "StableCalm"
    this.timestamp = timestamp;
    this.metadata = metadata;
  }
}

// EventDetector クラス（Python版と同等）
class EventDetector {
  constructor(params) {
    this.params = params;
    this.speech_run_length = 0.0;
    this.silence_run_length = 0.0;
    this.switch_count_recent = 0;
    this.window_buffer = [];
    this.last_label = null;
  }

  process(is_speech, now) {
    const events = [];
    const frame_duration = this.params.frame_duration_sec || 0.02;

    // Update run lengths
    if (is_speech) {
      this.speech_run_length += frame_duration;
      this.silence_run_length = 0.0;
    } else {
      this.silence_run_length += frame_duration;
      this.speech_run_length = 0.0;
    }

    // Track switches in the recent window
    if (this.last_label !== null && this.last_label !== is_speech) {
      this.switch_count_recent += 1;
    }
    this.last_label = is_speech;
    this.window_buffer.push({ timestamp: now, is_speech: is_speech });

    // Drop old entries
    const window_sec = this.params.overlap_window_sec;
    while (this.window_buffer.length > 0 && now - this.window_buffer[0].timestamp > window_sec) {
      this.window_buffer.shift();
    }

    // Recompute switch_count_recent from window_buffer for accuracy
    this.switch_count_recent = 0;
    for (let i = 1; i < this.window_buffer.length; i++) {
      if (this.window_buffer[i].is_speech !== this.window_buffer[i - 1].is_speech) {
        this.switch_count_recent += 1;
      }
    }

    // Detect events
    if (this.silence_run_length >= this.params.silence_long_sec) {
      events.push(new ConcordiaEvent("SilenceLong", now, { duration: this.silence_run_length }));
    }
    if (this.speech_run_length >= this.params.monologue_long_sec) {
      events.push(new ConcordiaEvent("MonologueLong", now, { duration: this.speech_run_length }));
    }
    if (this.switch_count_recent >= this.params.overlap_switch_threshold) {
      events.push(new ConcordiaEvent("OverlapBurst", now, { switches: this.switch_count_recent }));
    }

    // StableCalm: sustained balanced interaction without the other triggers
    if (events.length === 0 && now >= this.params.stable_min_duration_sec) {
      const threshold_half = Math.floor(this.params.overlap_switch_threshold / 2);
      if (this.switch_count_recent >= 1 && this.switch_count_recent <= threshold_half) {
        if (this.speech_run_length < this.params.monologue_long_sec &&
          this.silence_run_length < this.params.silence_long_sec) {
          events.push(new ConcordiaEvent("StableCalm", now, {}));
        }
      }
    }

    return events;
  }
}

// StateManager クラス（Python版と同等）
class StateManager {
  constructor(cooldown_sec) {
    this.cooldown_sec = cooldown_sec;
    this.last_event_at = null;
  }

  allow(now) {
    if (this.last_event_at === null) {
      return true;
    }
    return (now - this.last_event_at) >= this.cooldown_sec;
  }

  mark(now) {
    this.last_event_at = now;
  }
}

// SoundPlayer クラス（Web Audio API使用）
class SoundPlayer {
  constructor(baseDir) {
    this.baseDir = baseDir || "sounds";
    this.audioContext = null;
    this.soundBuffers = {};
    this.soundQueue = [];
  }

  async init() {
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

      // 音声ファイルのプリロード
      const soundFiles = {
        "SilenceLong": { file: "wind_soft.ogg", volume: 0.7 },
        "MonologueLong": { file: "drip_double.ogg", volume: 0.8 },
        "OverlapBurst": { file: "wood_creak.ogg", volume: 0.65 },
        "StableCalm": null // 音なし
      };

      for (const [eventType, soundConfig] of Object.entries(soundFiles)) {
        if (soundConfig) {
          try {
            const buffer = await this.loadSound(`${this.baseDir}/${soundConfig.file}`);
            this.soundBuffers[eventType] = {
              buffer: buffer,
              volume: soundConfig.volume
            };
          } catch (err) {
            console.warn(`音声ファイルの読み込みに失敗: ${soundConfig.file}`, err);
          }
        }
      }
    } catch (err) {
      console.warn("SoundPlayer初期化エラー（音声は無効になります）:", err);
    }
  }

  async loadSound(url) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      return await this.audioContext.decodeAudioData(arrayBuffer);
    } catch (err) {
      // 音声ファイルが存在しない場合は静かに失敗
      console.warn(`音声ファイルの読み込みに失敗: ${url}`, err);
      return null;
    }
  }

  playEvent(event) {
    if (!this.audioContext || !this.soundBuffers[event.type]) {
      return;
    }

    const soundConfig = this.soundBuffers[event.type];
    if (!soundConfig || !soundConfig.buffer) {
      return;
    }

    try {
      const source = this.audioContext.createBufferSource();
      const gainNode = this.audioContext.createGain();

      source.buffer = soundConfig.buffer;
      gainNode.gain.value = soundConfig.volume;

      source.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      source.start(0);

      // 音声再生完了後にクリーンアップ
      source.onended = () => {
        source.disconnect();
        gainNode.disconnect();
      };
    } catch (err) {
      console.warn("音声再生エラー:", err);
    }
  }
}

// 簡易感情/文脈分析用のキーワード定義
const CONTENT_ANALYSIS_CONFIG = {
  // 調和: ポジティブ、共感、相槌
  "調和": [
    "そうですね", "なるほど", "わかります", "いいですね", "賛成", "楽しい", "嬉しい", "ありがとう",
    "確かに", "その通り", "すごい", "面白い", "大丈夫", "協力", "一緒", "うんうん"
  ],
  // 一方的: ネガティブ、強い言葉、拒絶、命令
  "一方的": [
    "でも", "いや", "違う", "駄目", "無理", "絶対", "しなさい", "やめて", "嫌だ", "最悪",
    "関係ない", "うるさい", "勝手", "当然", "義務", "命令"
  ],
  // 沈黙: 不安、迷い、停止 (テキストには出にくいが、「...」や言い淀みなど)
  "沈黙": [
    "えーと", "あの", "その", "うーん", "...", "えっと", "自信ない", "わからない", "微妙"
  ]
};

const state = {
  audioCtx: null,
  analyser: null,
  micSource: null,
  data: new Float32Array(2048),
  running: false,
  rmsSmooth: 0,
  speechEnergy: 0, // fast responsiveness for status
  windowEnergy: 0, // 15s averaged energy for visuals
  energyHistory: [], // [{t, val}]
  isSpeech: false,
  lastSpeechChange: 0,
  driftPhase: 0, // slow horizontal drift for waves
  lastNowSec: null,
  scene: "静寂",
  speechRun: 0,
  silenceRun: 0,
  switchTimestamps: [],
  demoMode: false, // デモモードフラグ
  demoScene: "静寂", // デモモード時のシーン
  // 新しいイベント検出関連
  eventDetector: null,
  stateManager: null,
  currentEvent: null, // 現在発生中のイベント
  eventStartTime: 0, // アプリケーション開始時刻
  activeEffects: {
    silenceLong: { strength: 0, decay: 1.5 },
    monologueLong: { strength: 0, decay: 1.0, pulseCount: 0 },
    overlapBurst: { strength: 0, decay: 0.8 },
    stableCalm: { strength: 0, decay: 2.0 }
  },
  soundPlayer: null,
  transcriber: null,
  // テキスト分析用
  lastTranscriptText: "",
  lastTranscriptTime: 0,
  lastAnalysisResult: null // { label: "調和", score: 0.8 }
};

// Transcriber Class for Real-time API
class Transcriber {
  constructor(apiUrl) {
    this.apiUrl = apiUrl;
    this.mediaRecorder = null;
    this.chunks = [];
    this.isRecording = false;
    this.sessionTranscript = []; // Accumulate transcript lines
  }

  async start(stream) {
    if (this.isRecording) return;
    this.sessionTranscript = []; // Reset on start

    // Create MediaRecorder with standard mimeType
    let mimeType = 'audio/webm;codecs=opus';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'audio/mp4';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = ''; // Let browser choose default
      }
    }

    try {
      this.mediaRecorder = new MediaRecorder(stream, { mimeType });
      this.isRecording = true;
      console.log(`Transcriber started with mimeType: ${this.mediaRecorder.mimeType}`);

      this.mediaRecorder.ondataavailable = async (e) => {
        if (e.data.size > 0) {
          await this.sendAudio(e.data);
        }
      };

      // Send chunk every 3-5 seconds (randomized slightly to avoid sync issues if multiple clients)
      // For single user, 3000ms is fine.
      this.mediaRecorder.start(3000);

    } catch (e) {
      console.error("Transcriber init failed:", e);
    }
  }

  stop() {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
      this.isRecording = false;
    }
  }

  async sendAudio(blob) {
    const reader = new FileReader();
    reader.readAsDataURL(blob);

    reader.onloadend = async () => {
      const base64Audio = reader.result.split(',')[1];

      try {
        console.log("Transmitting audio chunk...");
        const response = await fetch(this.apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${authToken}` // Attach Auth Token
          },
          body: JSON.stringify({ audio_data: base64Audio })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.segments && data.segments.length > 0) {
            const text = data.segments.map(s => s.text).join(" ");
            console.log("【Transcription】:", text);
            this.sessionTranscript.push({
              timestamp: new Date().toISOString(),
              text: text
            });

            // Update State with Analysis
            state.lastTranscriptText = text;
            state.lastTranscriptTime = performance.now() / 1000; // Use app time
            const analysis = analyzeSentiment(text);
            if (analysis) {
              state.lastAnalysisResult = analysis;
              console.log(`【Analysis】: Detected '${analysis}' from text.`);
            }
          } else {
            console.log("【Transcription】: (silence/no speech)");
          }
        } else {
          console.warn("API Error:", response.status, response.statusText);
        }
      } catch (e) {
        console.error("API Fetch Error:", e);
      }
    };
  }
}

function setStatus(text) {
  statusEl.textContent = text;
}

function softNoise(x, t, k1 = 0.018, k2 = 0.009) {
  // Cheap 2-layer sine noise for organic wobble (no deps).
  return (
    Math.sin(x * k1 + t * 0.9) * 0.6 +
    Math.sin(x * k2 + t * 0.3 + Math.sin(t * 0.15) * 2.0) * 0.4
  );
}


function rms(buffer) {
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) {
    const v = buffer[i];
    sum += v * v;
  }
  return Math.sqrt(sum / buffer.length);
}

function detectSpeech(rmsValue) {
  // Simple energy-based VAD with hysteresis.
  const rise = 1.2;
  const threshold = 0.015;
  const target = rmsValue / threshold;
  state.rmsSmooth = state.rmsSmooth * (1 - rise * 0.05) + Math.min(target, 3) * (rise * 0.05);

  const isCurrentSpeech = state.rmsSmooth > 1.0;
  if (isCurrentSpeech !== state.isSpeech) {
    state.isSpeech = isCurrentSpeech;
    state.lastSpeechChange = performance.now() / 1000;
  }
}

function updateWindowEnergy(rawRms, nowSec) {
  const threshold = 0.015;
  const normalized = Math.min(3, rawRms / threshold);
  state.energyHistory.push({ t: nowSec, v: normalized });
  // Drop older than 15s
  while (state.energyHistory.length && nowSec - state.energyHistory[0].t > 15) {
    state.energyHistory.shift();
  }
  if (state.energyHistory.length === 0) {
    state.windowEnergy = 0;
    return;
  }
  const sum = state.energyHistory.reduce((acc, cur) => acc + cur.v, 0);
  state.windowEnergy = sum / state.energyHistory.length; // average over ~15s
}

function draw(nowSec) {
  const w = scene.width;
  const h = scene.height;
  ctx.clearRect(0, 0, w, h);

  // Background: static sky; waves carry the state.
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "rgba(18, 44, 90, 1)");
  sky.addColorStop(1, "rgba(10, 20, 52, 1)");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  const glow = ctx.createRadialGradient(
    w * 0.5,
    h * 0.35,
    30,
    w * 0.5,
    h * 0.4,
    Math.max(w, h) * 0.7
  );
  glow.addColorStop(0, "rgba(200, 230, 255, 0.12)");
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  // Distant moon/halo for mood.
  const moonY = h * 0.22;
  const moonX = w * 0.2;
  const moonR = 26;
  ctx.beginPath();
  ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(230, 240, 250, 0.6)";
  ctx.fill();
  const moonGlow = ctx.createRadialGradient(moonX, moonY, 0, moonX, moonY, moonR * 3);
  moonGlow.addColorStop(0, "rgba(220, 240, 255, 0.12)");
  moonGlow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = moonGlow;
  ctx.fillRect(0, 0, w, h);

  // Speech energy wave state.
  state.speechEnergy = state.isSpeech
    ? Math.min(1, state.speechEnergy + 0.05)
    : state.speechEnergy * 0.92;

  // Slow global rhythm.
  const timeSlow = nowSec * 0.2;
  const breath = (Math.sin(timeSlow * 0.6) + 1) / 2;

  // waveLevel = 波の大きさの指標（0.0-1.0）
  // デモモード時は各シーンの波の大きさを直接指定
  let waveLevel;
  if (state.demoMode) {
    // デモモード時は各シーンに応じた波の大きさを直接指定
    // 定義：
    // - 静寂: 中間的な波の大きさ
    // - 調和: 小さな波（穏やか）
    // - 一方的: 大きな波（激しく荒れる）
    // - 沈黙: 大きな波（重く暗く荒れる）
    const demoWaveLevels = {
      "静寂": 0.4,   // 中間的な波の大きさ
      "調和": 0.3,   // 小さな波（穏やか）
      "一方的": 0.9,  // 大きな波（激しく荒れる）
      "沈黙": 0.85,  // 大きな波（重く暗く荒れる）
    };
    waveLevel = demoWaveLevels[state.scene] || 0.4;
  } else {
    // 実際の音声入力時は、音声エネルギーレベルから波の大きさを計算
    // ただし、波の大きさはシーンによって調整される（rippleBoost/negativeBoost）
    const audioEnergy = Math.min(1, state.windowEnergy * 0.8);
    waveLevel = audioEnergy; // 音声エネルギーレベルを波の大きさの基準として使用
  }

  const drift = state.driftPhase || 0; // slow horizontal drift
  const baseLine = h * 0.66 + 10 * (breath - 0.5);

  // 調和シーンは「波の機嫌を伺っている」良い状態なので、波は穏やかになる
  const isRippled = state.scene === "調和";
  const isOneSided = state.scene === "一方的"; // 一方的（悪い状態：直接的な同調圧）
  const isHushed = state.scene === "沈黙"; // 沈黙（悪い状態：間接的な圧力）

  // デモモード時は各シーンの特徴を強調
  const demoMultiplier = state.demoMode ? 1.3 : 1.0; // デモモード時は1.3倍に強調

  // rippled時は波が落ち着いていく（良い状態：みんなが波の機嫌を伺っている）
  const rippleBoost = isRippled ? (0.7 * (state.demoMode ? 0.6 : 1.0)) : 1.0; // デモモード時はさらに小さく（0.8→0.6）
  const rippleSpeed = isRippled ? (0.5 * (state.demoMode ? 0.7 : 1.0)) : 1.0; // デモモード時はさらに遅く
  const rippleNoise = isRippled ? (0.6 * (state.demoMode ? 0.7 : 1.0)) : 1.0; // デモモード時はさらに滑らかに

  // 一方的はより激しく荒れる（直接的な同調圧 - より悪い）
  const oneSidedBoost = isOneSided ? (1.8 * demoMultiplier) : 1.0; // より大きく
  const oneSidedSpeed = isOneSided ? (2.2 * demoMultiplier) : 1.0; // より速く
  const oneSidedNoise = isOneSided ? (2.5 * demoMultiplier) : 1.0; // より不規則に

  // 沈黙は重く暗く荒れる（間接的な圧力）
  const hushedBoost = isHushed ? (1.5 * demoMultiplier) : 1.0; // 大きく（1.3→1.5に増加）
  const hushedSpeed = isHushed ? (1.2 * demoMultiplier) : 1.0; // 遅く（重い感じ）
  const hushedNoise = isHushed ? (2.2 * demoMultiplier) : 1.0; // 不規則に

  // 統合
  const negativeBoost = isOneSided ? oneSidedBoost : (isHushed ? hushedBoost : 1.0);
  const negativeSpeed = isOneSided ? oneSidedSpeed : (isHushed ? hushedSpeed : 1.0);
  const negativeNoise = isOneSided ? oneSidedNoise : (isHushed ? hushedNoise : 1.0);

  // デモモード時は波の振幅を強調
  const baseAmpMain = 10 + 24 * waveLevel;
  const baseAmpSub = 6 + 16 * waveLevel;
  const ampMain = baseAmpMain * rippleBoost * negativeBoost * (state.demoMode ? 1.2 : 1.0);
  const ampSub = baseAmpSub * rippleBoost * negativeBoost * (state.demoMode ? 1.2 : 1.0);
  const swell = 10 * Math.sin(timeSlow * 0.6);
  const t = timeSlow * (0.8 * rippleSpeed * negativeSpeed);

  // Water body.
  ctx.save();
  ctx.beginPath();
  // rippled時はより細かくサンプリングして滑らかに
  const stepSize = isRippled ? 8 : 12;
  for (let x = 0; x <= w; x += stepSize) {
    // rippled時は周波数を上げてより細かい波に
    const freqMain = isRippled ? 0.012 : 0.008;
    const freqSub = isRippled ? 0.020 : 0.014;
    const freqTertiary = isRippled ? 0.005 : 0.003;

    const y =
      baseLine + swell +
      Math.sin(x * freqMain + t + drift * 0.6) * ampMain +
      Math.sin(x * freqSub + t * 0.9 + drift * 0.4) * ampSub +
      Math.sin(x * freqTertiary + drift * 0.3) * (4 * rippleBoost) +
      softNoise(x, t * 6 * rippleSpeed * negativeSpeed) * (1 + 4 * waveLevel) * rippleNoise * negativeNoise +
      // rippled時は追加の動きを減らして穏やかに（良い状態：波の機嫌を伺っている）
      (isRippled ? Math.sin(x * 0.012 + t * 0.6) * (ampMain * 0.1) : 0) +
      // 一方的時は激しく荒れた不規則な動き（直接的な同調圧 - より悪い）
      (isOneSided ? Math.sin(x * 0.025 + t * 2.5) * (ampMain * 0.6) + Math.sin(x * 0.040 + t * 2.0) * (ampMain * 0.4) + Math.sin(x * 0.055 + t * 1.8) * (ampMain * 0.3) : 0) +
      // 沈黙時は重く暗い不規則な動き（間接的な圧力）
      (isHushed ? Math.sin(x * 0.020 + t * 0.8) * (ampMain * 0.5) + Math.sin(x * 0.035 + t * 0.5) * (ampMain * 0.4) : 0);
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();

  // Tone and color shift by scene (still driven by 15s energy).
  // 調和は良い状態（波の機嫌を伺っている）なので穏やかで明るく
  // 一方的/沈黙は悪い状態（波の機嫌を伺わない）なので荒れて暗く
  const toneBoostMap = { "静寂": 0, "調和": 0.1, "一方的": -0.15, "沈黙": -0.25 };
  // デモモード時は色の変化を強調
  // 一方的はより直接的な同調圧（赤みを強めた暗い色）、沈黙は間接的な圧力（青みを強めた暗い色）
  const colorShiftBase = {
    "静寂": { r: 0, g: 0, b: 0 },
    "調和": { r: 5, g: 12, b: 4 }, // 穏やかで明るい色（良い状態：波が落ち着いている）
    "一方的": { r: -5, g: -20, b: -18 }, // 暗く、赤みを強めた色（直接的な同調圧 - より悪い）
    "沈黙": { r: -15, g: -18, b: -8 }, // 暗く、青みを強めた色（間接的な圧力）
  };
  const colorShiftMap = {};
  for (const [key, value] of Object.entries(colorShiftBase)) {
    const multiplier = state.demoMode ? 1.5 : 1.0; // デモモード時は1.5倍に強調
    colorShiftMap[key] = {
      r: value.r * multiplier,
      g: value.g * multiplier,
      b: value.b * multiplier,
    };
  }
  const currentShift = colorShiftMap[state.scene] || { r: 0, g: 0, b: 0 };

  // デモモード時は色の変化を強調
  let waterTone;
  if (state.demoMode) {
    // デモモード時は各シーンに応じた固定のトーン値
    // 一方的はより直接的な同調圧（より悪い）、沈黙は間接的な圧力
    const demoTones = {
      "静寂": 0.5,  // 中間的な明るさ
      "調和": 0.85, // 明るく（良い状態）
      "一方的": 0.25, // より暗く（直接的な同調圧 - より悪い）
      "沈黙": 0.15,  // さらに暗く（間接的な圧力）
    };
    waterTone = demoTones[state.scene] || 0.5;
  } else {
    waterTone = Math.min(1, state.windowEnergy * 0.7 + (toneBoostMap[state.scene] || 0));
    waterTone = Math.max(0, Math.min(1, waterTone));

    // rippled時は穏やかで明るく、one-sided/hushed時は荒れて暗く
    if (isRippled) {
      waterTone = Math.min(1, waterTone * 1.05); // 穏やかに明るく
    } else if (isOneSided || isHushed) {
      waterTone = Math.max(0, waterTone * 0.8); // 荒れて暗く
    }
  }
  // Darker base, add gentle teal/green variation with energy.
  const topR = Math.round(40 + 80 * waterTone + currentShift.r);
  const topG = Math.round(110 + 90 * waterTone + currentShift.g);
  const topB = Math.round(150 + 40 * waterTone + currentShift.b);
  const botR = Math.round(10 + 40 * waterTone + currentShift.r);
  const botG = Math.round(50 + 90 * waterTone + currentShift.g);
  const botB = Math.round(90 + 90 * waterTone + currentShift.b);
  const water = ctx.createLinearGradient(0, baseLine - 40, 0, h);
  water.addColorStop(0, `rgba(${topR}, ${topG}, ${topB}, ${0.6 + 0.18 * waveLevel})`);
  water.addColorStop(1, `rgba(${botR}, ${botG}, ${botB}, 1)`);
  ctx.fillStyle = water;
  ctx.fill();

  // Crests.
  ctx.lineWidth = isRippled ? 2.0 : 1.5; // rippled時は線を太く
  const crestAlpha = isRippled ? 0.15 + 0.12 * waveLevel : 0.06 + 0.08 * waveLevel;
  const crestColor = `rgba(240, 250, 255, ${crestAlpha})`;
  ctx.strokeStyle = crestColor;
  ctx.beginPath();
  const crestStep = isRippled ? 12 : 18; // rippled時はより細かく
  for (let x = 0; x <= w; x += crestStep) {
    const freqMainCrest = isRippled ? 0.015 : 0.010;
    const freqSubCrest = isRippled ? 0.025 : 0.020;
    const freqTertiaryCrest = isRippled ? 0.006 : 0.004;

    const y =
      baseLine +
      Math.sin(x * freqMainCrest + t * 0.8 + drift * 0.6) * (ampMain * 0.55) +
      Math.sin(x * freqSubCrest + t * 1.1 + drift * 0.4) * (ampSub * 0.5) +
      Math.sin(x * freqTertiaryCrest + drift * 0.4) * (3 * rippleBoost) +
      softNoise(x * 0.7, t * 5 * rippleSpeed * negativeSpeed) * (1 + 4 * waveLevel) * rippleNoise * negativeNoise +
      // rippled時は追加の動きを減らして穏やかに（良い状態）
      (isRippled ? Math.sin(x * 0.015 + t * 0.7) * (ampMain * 0.08) : 0) +
      // 一方的時は激しく荒れた動き（直接的な同調圧 - より悪い）
      (isOneSided ? Math.sin(x * 0.030 + t * 2.8) * (ampMain * 0.5) + Math.sin(x * 0.048 + t * 2.2) * (ampMain * 0.35) + Math.sin(x * 0.060 + t * 1.9) * (ampMain * 0.25) : 0) +
      // 沈黙時は重く暗い動き（間接的な圧力）
      (isHushed ? Math.sin(x * 0.022 + t * 0.9) * (ampMain * 0.45) + Math.sin(x * 0.038 + t * 0.6) * (ampMain * 0.35) : 0);
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();

  // Distant shimmer.
  ctx.fillStyle = `rgba(${180 + 30 * waterTone}, ${220 + 20 * waterTone}, ${230 + 10 * waterTone}, ${0.008 + 0.02 * waveLevel})`;
  for (let i = 0; i < 12; i++) {
    const px = (w / 12) * i + 4 * Math.sin(t * 0.4 + i);
    const py = baseLine + 4 * Math.sin(t * 0.6 + i * 0.4);
    ctx.fillRect(px, py, 12, 1);
  }


  // イベントに基づく視覚効果のオーバーレイ
  // SilenceLong: 白〜淡青の呼吸フェード
  if (state.activeEffects.silenceLong.strength > 0.01) {
    const alpha = 0.3 * state.activeEffects.silenceLong.strength;
    const pulseRadius = h * 0.8 + Math.sin(nowSec * 2) * 20;
    const pulseGradient = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, pulseRadius);
    pulseGradient.addColorStop(0, `rgba(220, 240, 255, ${alpha})`);
    pulseGradient.addColorStop(1, `rgba(220, 240, 255, 0)`);
    ctx.fillStyle = pulseGradient;
    ctx.fillRect(0, 0, w, h);
  }

  // MonologueLong: 紫の二連脈動
  if (state.activeEffects.monologueLong.strength > 0.01) {
    const pulsePhase = Math.sin(nowSec * 4) * 0.5 + 0.5;
    const alpha = 0.4 * state.activeEffects.monologueLong.strength * pulsePhase;
    const pulseSurface = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, h * 0.6);
    pulseSurface.addColorStop(0, `rgba(180, 120, 220, ${alpha})`);
    pulseSurface.addColorStop(1, `rgba(180, 120, 220, 0)`);
    ctx.fillStyle = pulseSurface;
    ctx.fillRect(0, 0, w, h);

    // 二連脈動の2回目
    const pulsePhase2 = Math.sin(nowSec * 4 + Math.PI) * 0.5 + 0.5;
    const alpha2 = 0.3 * state.activeEffects.monologueLong.strength * pulsePhase2;
    const pulseSurface2 = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, h * 0.5);
    pulseSurface2.addColorStop(0, `rgba(180, 120, 220, ${alpha2})`);
    pulseSurface2.addColorStop(1, `rgba(180, 120, 220, 0)`);
    ctx.fillStyle = pulseSurface2;
    ctx.fillRect(0, 0, w, h);
  }

  // OverlapBurst: 琥珀のフラッシュ/ライン
  if (state.activeEffects.overlapBurst.strength > 0.01) {
    const flashAlpha = 0.5 * state.activeEffects.overlapBurst.strength;
    ctx.fillStyle = `rgba(255, 200, 120, ${flashAlpha})`;
    ctx.fillRect(0, 0, w, h);

    // ライン効果
    ctx.strokeStyle = `rgba(255, 180, 100, ${flashAlpha * 0.8})`;
    ctx.lineWidth = 3;
    for (let i = 0; i < 5; i++) {
      const y = (h / 6) * (i + 1);
      const xOffset = Math.sin(nowSec * 5 + i) * 20;
      ctx.beginPath();
      ctx.moveTo(0, y + xOffset);
      ctx.lineTo(w, y + xOffset);
      ctx.stroke();
    }
  }

  // StableCalm: 青〜緑グラデーションの静かな波（特別な処理は不要、通常の波が適切に表示される）

  // Overlay text.
  ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
  ctx.font = "14px 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`scene — ${state.scene}`, w / 2, h - 24);

  // イベント表示
  if (state.currentEvent && state.activeEffects[state.currentEvent.type.toLowerCase()].strength > 0.1) {
    const eventTypeNames = {
      "SilenceLong": "長い沈黙",
      "MonologueLong": "一方的な発話",
      "OverlapBurst": "かぶせ合い",
      "StableCalm": "調和"
    };
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.font = "12px 'Segoe UI', sans-serif";
    ctx.fillText(`イベント: ${eventTypeNames[state.currentEvent.type] || state.currentEvent.type}`, w / 2, h - 8);
  }
}

function loop() {
  const now = performance.now() / 1000;
  const dt = state.lastNowSec ? now - state.lastNowSec : 0;
  state.lastNowSec = now;
  state.driftPhase += dt * 0.08; // very slow drift

  // デバッグ情報を常に更新（要素を再取得して確実に更新）
  const debugEl = document.getElementById("debug-info");
  if (debugEl) {
    let waveLevel;
    if (state.demoMode) {
      // デモモード時は固定値を使用（draw関数と同じ値）
      const demoWaveLevels = {
        "静寂": 0.4,   // 中間的な波の大きさ
        "調和": 0.3,   // 小さな波（穏やか）
        "一方的": 0.9,  // 大きな波（激しく荒れる）
        "沈黙": 0.85,  // 大きな波（重く暗く荒れる）
      };
      waveLevel = demoWaveLevels[state.scene] || 0.4;
    } else {
      // 実際の音声入力時は、draw関数と同じ計算ロジックを使用
      waveLevel = Math.min(1, (state.windowEnergy || 0) * 0.8);
    }
    debugEl.textContent = `デバッグ: scene=${state.scene}, 波の大きさ=${waveLevel.toFixed(2)}, running=${state.running}, demoMode=${state.demoMode}`;
  } else {
    // 要素が見つからない場合のフォールバック
    console.warn("debug-info element not found");
  }

  if (state.running && state.analyser) {
    state.analyser.getFloatTimeDomainData(state.data);
    const energy = rms(state.data);
    const prevSpeech = state.isSpeech;
    detectSpeech(energy);
    const curSpeech = state.isSpeech;

    // update run lengths (既存のロジック)
    if (dt > 0) {
      if (curSpeech) {
        state.speechRun = (state.speechRun || 0) + dt;
        state.silenceRun = 0;
      } else {
        state.silenceRun = (state.silenceRun || 0) + dt;
        state.speechRun = 0;
      }
    }
    if (curSpeech !== prevSpeech) {
      state.switchTimestamps.push(now);
    }
    while (state.switchTimestamps.length && now - state.switchTimestamps[0] > 15) {
      state.switchTimestamps.shift();
    }
    updateWindowEnergy(energy, now);

    // イベント検出（新しいロジック）
    if (state.eventDetector) {
      const relativeTime = now - state.eventStartTime;
      const events = state.eventDetector.process(curSpeech, relativeTime);

      // イベントが検出された場合
      for (const event of events) {
        if (state.stateManager && state.stateManager.allow(relativeTime)) {
          handleEvent(event, relativeTime);
          state.stateManager.mark(relativeTime);
        }
      }
    }
  }

  // アクティブなエフェクトの減衰処理
  updateActiveEffects(dt);

  classifyScene(now);
  draw(now);
  requestAnimationFrame(loop);
}

// イベント検出器とステートマネージャーの初期化
async function initEventSystem() {
  const eventParams = {
    ...config.events,
    frame_duration_sec: config.audio.frame_duration_sec
  };
  state.eventDetector = new EventDetector(eventParams);
  state.stateManager = new StateManager(config.effects.cooldown_sec);
  state.eventStartTime = performance.now() / 1000;

  // 音声再生システムの初期化
  if (config.sound.enabled) {
    state.soundPlayer = new SoundPlayer(config.sound.base_dir);
    try {
      await state.soundPlayer.init();
    } catch (err) {
      console.warn("音声システムの初期化に失敗しました（音声は無効になります）:", err);
      config.sound.enabled = false;
    }
  }
}

async function startAudio() {
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setStatus("このブラウザはマイク取得に対応していません");
      return;
    }

    // イベント検出システムの初期化
    await initEventSystem();

    // API Endpoint (Deployed)
    // Only init transcriber if Logged In
    if (!isGuest && authToken) {
      const CONFIG_URL = "config.json";

      state.transcriber = new Transcriber(API_ENDPOINT);
    } else {
      console.log("Guest Mode: Transcription disabled");
      state.transcriber = null;
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    // Start Transcription (if enabled)
    if (state.transcriber) {
      state.transcriber.start(stream);
    }
    const audioCtx = new AudioContext();
    if (audioCtx.state === "suspended") {
      try {
        await audioCtx.resume();
        console.log("AudioContext resumed successfully.");
      } catch (resumeErr) {
        console.error("Failed to resume AudioContext:", resumeErr);
        setStatus("マイク初期化エラー: AudioContext resume failed");
        return;
      }
    }
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;

    const source = audioCtx.createMediaStreamSource(stream);
    source.connect(analyser);

    state.audioCtx = audioCtx;
    state.analyser = analyser;
    state.micSource = source;
    state.running = true;

    // Check if transcriber is active for status message
    if (state.transcriber) {
      setStatus("マイク取得中 → 録音・分析中 (ログアウトで停止)");
    } else {
      setStatus("ゲストモード: マイク取得中 (文字起こし・AIコーチング無効)");
    }

    startBtn.disabled = true;
  } catch (err) {
    console.error(err);
    // 詳細なエラー情報を表示
    let errorMsg = "マイク許可が必要です / もしくはブラウザが拒否しました";
    if (err.name) errorMsg += ` (${err.name}: ${err.message})`;
    else if (err.message) errorMsg += ` (${err.message})`;

    setStatus(errorMsg);
  }
}

if (startBtn) {
  startBtn.addEventListener("click", () => {
    setStatus("マイク許可をリクエスト中...");
    startAudio();
    startBtn.style.display = "none";
    const stopBtn = document.getElementById("stop-btn");
    if (stopBtn) stopBtn.style.display = "block";
  });
}

const stopBtn = document.getElementById("stop-btn");
if (stopBtn) {
  stopBtn.addEventListener("click", () => {
    // Reset UI
    if (state.running && state.micSource) {
      state.transcriber?.stop(); // Ensure transcriber stops if it exists

      // Download transcript only if transcriber exists and has content
      if (state.transcriber && state.transcriber.sessionTranscript.length > 0) {
        const lines = state.transcriber.sessionTranscript.map(i => `[${i.timestamp}] ${i.text}`);
        const blob = new Blob([lines.join("\n")], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `transcript_${new Date().getTime()}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        setStatus("終了しました。文字起こしをダウンロードしました。");
      } else if (state.transcriber) {
        setStatus("終了しました。（文字起こしデータなし）");
      } else {
        setStatus("終了しました。（ゲストモード/文字起こし無効）");
      }

      state.micSource.mediaStream.getTracks().forEach(track => track.stop());
      state.running = false;
    } else {
      // Loop wasn't running or check failed
      setStatus("停止中");
    }

    stopBtn.style.display = "none";
    if (startBtn) startBtn.style.display = "block";
    startBtn.disabled = false;
  });
}

// デモモードのボタン
const demoBtn = document.getElementById("demo-btn");
const demoControls = document.getElementById("demo-controls");
const demoSceneBtns = document.querySelectorAll(".demo-scene-btn");

if (demoBtn && demoControls) {
  demoBtn.addEventListener("click", () => {
    state.demoMode = !state.demoMode;

    if (state.demoMode) {
      demoBtn.textContent = "デモモード終了";
      demoBtn.style.background = "linear-gradient(135deg, #ff7b7b, #ff9b7b)";
      demoControls.style.display = "flex";
      setStatus("デモモード: シーンを選択してください");
      // デモモード時は音声入力を停止
      if (state.running && state.micSource) {
        state.micSource.mediaStream.getTracks().forEach(track => track.stop());
        if (state.transcriber) state.transcriber.stop();
        state.running = false;
      }
    } else {
      demoBtn.textContent = "デモモード";
      demoBtn.style.background = "linear-gradient(135deg, #7bd6ff, #b58cff)";
      demoControls.style.display = "none";
      setStatus("待機中");
    }
  });
}

// シーン選択ボタン
demoSceneBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    if (state.demoMode) {
      const scene = btn.getAttribute("data-scene");
      state.demoScene = scene;
      state.scene = scene;

      // ボタンのスタイルを更新
      demoSceneBtns.forEach(b => {
        b.style.opacity = "0.6";
        b.style.transform = "scale(1)";
      });
      btn.style.opacity = "1";
      btn.style.transform = "scale(1.05)";

      setStatus(`デモモード: ${scene}シーンを表示中`);
    }
  });
});

// DOM読み込み完了後にデバッグ情報を初期化
function initDebug() {
  const debugEl = document.getElementById("debug-info");
  if (debugEl) {
    debugEl.textContent = "デバッグ: スクリプト読み込み完了";
  } else {
    console.error("debug-info element not found on init");
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDebug);
} else {
  initDebug();
}

// デバッグ情報を定期的に更新（setIntervalで確実に実行）
setInterval(() => {
  const debugEl = document.getElementById("debug-info");
  if (debugEl) {
    let waveLevel;
    if (state.demoMode) {
      // デモモード時は固定値を使用（draw関数と同じ値）
      const demoWaveLevels = {
        "静寂": 0.4,   // 中間的な波の大きさ
        "調和": 0.3,   // 小さな波（穏やか）
        "一方的": 0.9,  // 大きな波（激しく荒れる）
        "沈黙": 0.85,  // 大きな波（重く暗く荒れる）
      };
      waveLevel = demoWaveLevels[state.scene] || 0.4;
    } else {
      // 実際の音声入力時は、draw関数と同じ計算ロジックを使用
      waveLevel = Math.min(1, (state.windowEnergy || 0) * 0.8);
    }
    debugEl.textContent = `デバッグ: scene=${state.scene}, 波の大きさ=${waveLevel.toFixed(2)}, running=${state.running}, demoMode=${state.demoMode}`;
  }
}, 100); // 100msごとに更新

// イベントハンドラー
function handleEvent(event, now) {
  console.log(`Event detected: ${event.type} at ${now.toFixed(2)}s`, event.metadata);

  // アクティブエフェクトをトリガー
  switch (event.type) {
    case "SilenceLong":
      state.activeEffects.silenceLong.strength = 1.0;
      state.currentEvent = event;
      break;
    case "MonologueLong":
      state.activeEffects.monologueLong.strength = 1.0;
      state.activeEffects.monologueLong.pulseCount = 0;
      state.currentEvent = event;
      break;
    case "OverlapBurst":
      state.activeEffects.overlapBurst.strength = 1.0;
      state.currentEvent = event;
      break;
    case "StableCalm":
      state.activeEffects.stableCalm.strength = 1.0;
      state.currentEvent = event;
      break;
  }

  // 音声再生（実装後）
  if (config.sound.enabled && state.soundPlayer) {
    state.soundPlayer.playEvent(event);
  }
}

// アクティブエフェクトの更新（減衰処理）
function updateActiveEffects(dt) {
  // SilenceLong
  if (state.activeEffects.silenceLong.strength > 0.01) {
    state.activeEffects.silenceLong.strength *= Math.exp(-dt / state.activeEffects.silenceLong.decay);
  } else {
    state.activeEffects.silenceLong.strength = 0;
  }

  // MonologueLong
  if (state.activeEffects.monologueLong.strength > 0.01) {
    state.activeEffects.monologueLong.strength *= Math.exp(-dt / state.activeEffects.monologueLong.decay);
  } else {
    state.activeEffects.monologueLong.strength = 0;
  }

  // OverlapBurst
  if (state.activeEffects.overlapBurst.strength > 0.01) {
    state.activeEffects.overlapBurst.strength *= Math.exp(-dt / state.activeEffects.overlapBurst.decay);
  } else {
    state.activeEffects.overlapBurst.strength = 0;
  }

  // StableCalm
  if (state.activeEffects.stableCalm.strength > 0.01) {
    state.activeEffects.stableCalm.strength *= Math.exp(-dt / state.activeEffects.stableCalm.decay);
  } else {
    state.activeEffects.stableCalm.strength = 0;
  }
}

// Kick off render loop
loop();

function analyzeSentiment(text) {
  if (!text) return null;

  let scores = { "調和": 0, "一方的": 0, "沈黙": 0 };
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

  // 最大スコアのラベルを返す
  let maxLabel = null;
  let maxScore = -1;
  for (const [label, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      maxLabel = label;
    }
  }

  return maxScore > 0 ? maxLabel : null;
}

function classifyScene(nowSec) {
  // デモモードの場合は手動で設定したシーンを使用
  if (state.demoMode) {
    state.scene = state.demoScene;
  } else {
    // 1. 基本はエネルギーベースの判定
    const energy = state.windowEnergy;
    const switchCount = state.switchTimestamps ? state.switchTimestamps.length : 0;
    const speechRun = state.speechRun || 0;
    const silenceRun = state.silenceRun || 0;

    let label = "静寂";
    if (silenceRun > 8 || (energy < 0.25 && switchCount <= 2)) {
      label = "沈黙";
    } else if (speechRun > 8 || (energy > 0.65 && switchCount < 3)) {
      label = "一方的";
    } else if (switchCount >= 6 || energy > 0.45) {
      label = "調和";
    }

    // 2. テキスト分析によるオーバーライド（直近5秒以内の発言のみ有効）
    if (state.lastAnalysisResult && (nowSec - state.lastTranscriptTime < 5.0)) {
      // 分析結果が「沈黙」以外なら、それを優先して適用する
      // （「沈黙」はVADベースの方が正確なことが多いため）
      if (state.lastAnalysisResult !== "沈黙") {
        label = state.lastAnalysisResult;
        // 分析でシーンが変わった場合、少しだけイベントっぽく強調してもいいかも
      }
    }

    state.scene = label;
  }

  const descMap = {
    "静寂": "声と静けさが、ゆっくり行き来しています。",
    "調和": "声の出入りが頻繁で、波が穏やかになっています。",
    "一方的": "ひとつの方向からの声が、長く続いています。波が荒れています。",
    "沈黙": "静かな時間が、長めに続いています。波が荒れています。",
  };
  if (sceneLabelEl) sceneLabelEl.textContent = `scene: ${state.scene}${state.demoMode ? " (デモ)" : ""}`;
  if (sceneDescEl) sceneDescEl.textContent = descMap[state.scene] || "";
}
// Auth Configuration (Custom UI)
const POOL_DATA = {
  UserPoolId: "ap-northeast-1_D4mSyU7BM",
  ClientId: "7kkgc14odhojor0o2c4qpc6l6d"
};
const userPool = new CognitoUserPool(POOL_DATA);

// Auth Initialization Wrapper
document.addEventListener('DOMContentLoaded', () => {
  console.log("DOM loaded, initializing Custom Auth...");

  // UI Elements
  const loginBtn = document.getElementById("login-btn");
  const guestBtn = document.getElementById("guest-btn");
  const logoutBtn = document.getElementById("logout-btn");
  const appControls = document.getElementById("app-controls");
  const statusEl = document.getElementById("status");
  const startBtn = document.getElementById("start-btn");

  // Modal Elements
  const loginModal = document.getElementById("login-modal");
  const modalLoginBtn = document.getElementById("modal-login-btn");
  const modalCloseBtn = document.getElementById("modal-close-btn");
  const usernameInput = document.getElementById("username-input");
  const passwordInput = document.getElementById("password-input");
  const loginError = document.getElementById("login-error");

  // Auth State
  let authToken = localStorage.getItem("concordia_id_token");
  let isGuest = false;

  // --- Helper Functions ---

  // Sanctuary Logic
  function activateSanctuary() {
    document.body.classList.add("sanctuary-active");
    const guardianBadge = document.querySelector(".guardian-badge span");
    if (guardianBadge) guardianBadge.textContent = "Sanctuary Active";
  }

  function deactivateSanctuary() {
    document.body.classList.remove("sanctuary-active");
  }

  // Coaching Manager Class
  class CoachingManager {
    constructor(apiUrl) {
      this.apiUrl = apiUrl;
      this.intervalId = null;
      this.lastProcessedTime = 0;
    }

    start() {
      if (this.intervalId) return;
      console.log("CoachingManager started");
      // Check every 20 seconds
      this.intervalId = setInterval(() => this.poll(), 20000);
    }

    stop() {
      if (this.intervalId) {
        clearInterval(this.intervalId);
        this.intervalId = null;
      }
    }

    async poll() {
      if (!state.lastTranscriptText || state.lastTranscriptTime <= this.lastProcessedTime) {
        return; // No new content
      }

      this.lastProcessedTime = state.lastTranscriptTime;
      const payload = {
        transcript_recent: state.lastTranscriptText,
        conversation_state: state.scene
      };

      try {
        // Use the same auth token as transcription
        if (!authToken) return;

        const response = await fetch(this.apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${authToken}`
          },
          body: JSON.stringify(payload)
        });

        if (response.ok) {
          const data = await response.json();
          console.log("【Coach】:", data);
          if (data.advice) {
            this.showAdvice(data);
          }
        }
      } catch (e) {
        console.error("Coaching API Error:", e);
      }
    }

    showAdvice(data) {
      const container = document.getElementById("guardian-message");
      const textEl = container.querySelector(".message-text");
      const labelEl = container.querySelector(".message-label");

      if (container && textEl) {
        textEl.textContent = data.advice;
        labelEl.textContent = `${data.analysis_label || "Analysis"} • Guardian AI`;

        // Update icon color based on urgency
        const icon = container.querySelector(".guardian-icon-small");
        if (icon) {
          icon.style.background = data.urgency === "high" ? "#ff6b6b" : "#7bd6ff";
          icon.style.boxShadow = data.urgency === "high" ? "0 0 10px #ff6b6b" : "0 0 10px #7bd6ff";
        }

        container.style.display = "flex";
        // Force reflow for transition
        void container.offsetWidth;
        container.classList.add("fade-in");
        container.classList.remove("fade-out");

        // Auto hide after 10 seconds
        setTimeout(() => {
          container.classList.remove("fade-in");
          container.classList.add("fade-out");
          setTimeout(() => {
            container.style.display = "none";
          }, 500);
        }, 10000);
      }
    }
  }

  // Global instances
  let coachingManager = null;

  // Initialize when API URL is known (updated in init)
  // ...

  function updateAuthUI() {
    // Helper to set status text and color
    const setStatus = (message, color = "#4fd1c5") => {
      statusEl.textContent = message;
      statusEl.style.color = color;
    };

    // Get current user for display name if available
    const cognitoUser = userPool.getCurrentUser();
    let userProfile = null; // Placeholder for user profile data if fetched

    if (authToken) {
      // Logged In
      loginBtn.style.display = "none";
      guestBtn.style.display = "none";
      logoutBtn.style.display = "block";
      appControls.style.display = "block";

      // Determine User Display Name
      let displayName = "User";
      if (userProfile && userProfile.email) {
        displayName = userProfile.email.split("@")[0]; // Use part before @
      } else if (cognitoUser) {
        displayName = cognitoUser.getUsername();
      }

      setStatus(`ログイン中: ${displayName}`);
      activateSanctuary(); // Activate Security Halo

      // Start Coaching
      if (!coachingManager) {
        // Infer Coach URL from Transcribe URL 
        // (e.g. /transcribe -> /coach)
        const coachUrl = API_ENDPOINT.replace("/transcribe", "/coach");
        coachingManager = new CoachingManager(coachUrl);
      }
      coachingManager.start();

    } else if (isGuest) {
      // Guest Mode
      loginBtn.style.display = "none";
      guestBtn.style.display = "none";
      logoutBtn.style.display = "block";
      appControls.style.display = "block"; // Allow starting app (viz only)
      setStatus("ゲストモード (保存機能なし)", "#a0aec0");
      deactivateSanctuary(); // Guest is NOT secure

      if (coachingManager) coachingManager.stop();

    } else {
      // Logged Out
      loginBtn.style.display = "block";
      guestBtn.style.display = "block";
      logoutBtn.style.display = "none";
      appControls.style.display = "none";
      setStatus("未ログイン", "#a0aec0");
      deactivateSanctuary();

      if (coachingManager) coachingManager.stop();
    }

    // Enable Start Button if logged in or guest
    if (authToken || isGuest) {
      startBtn.disabled = false;
      startBtn.style.opacity = "1";
    } else {
      startBtn.disabled = true;
      startBtn.style.opacity = "0.5";
    }
  }

  function handleLogout() {
    const cognitoUser = userPool.getCurrentUser();
    if (cognitoUser) {
      cognitoUser.signOut();
    }
    localStorage.removeItem("concordia_id_token");
    authToken = null;
    isGuest = false;
    state.transcriber = null;

    if (coachingManager) {
      coachingManager.stop();
      coachingManager = null;
    }

    updateAuthUI();
  }

  function performLogin(username, password) {
    loginError.style.display = "none";
    loginError.textContent = "";
    modalLoginBtn.disabled = true;
    modalLoginBtn.textContent = "認証中...";

    const authData = {
      Username: username,
      Password: password,
    };
    const authDetails = new AuthenticationDetails(authData);
    const userData = {
      Username: username,
      Pool: userPool,
    };
    const cognitoUser = new CognitoUser(userData);

    cognitoUser.authenticateUser(authDetails, {
      onSuccess: (result) => {
        console.log("Login Successful!");
        const idToken = result.getIdToken().getJwtToken();
        localStorage.setItem("concordia_id_token", idToken);
        authToken = idToken;
        isGuest = false;

        loginModal.style.display = "none";
        updateAuthUI();

        // Reset Modal
        usernameInput.value = "";
        passwordInput.value = "";
        modalLoginBtn.disabled = false;
        modalLoginBtn.textContent = "サインイン";
      },
      onFailure: (err) => {
        console.error("Login Failed:", err);
        loginError.textContent = err.message || "ログインに失敗しました。";
        loginError.style.display = "block";
        modalLoginBtn.disabled = false;
        modalLoginBtn.textContent = "サインイン";
      },
    });
  }

  // --- Event Listeners ---

  // Show Modal
  if (loginBtn) {
    loginBtn.addEventListener("click", () => {
      loginModal.style.display = "flex";
    });
  }

  // Close Modal
  if (modalCloseBtn) {
    modalCloseBtn.addEventListener("click", () => {
      loginModal.style.display = "none";
      loginError.style.display = "none";
    });
  }

  // Modal Login Action
  if (modalLoginBtn) {
    modalLoginBtn.addEventListener("click", () => {
      const username = usernameInput.value;
      const password = passwordInput.value;
      if (!username || !password) {
        loginError.textContent = "ユーザー名とパスワードを入力してください。";
        loginError.style.display = "block";
        return;
      }
      performLogin(username, password);
    });
  }

  // Guest Handler
  if (guestBtn) {
    guestBtn.addEventListener("click", () => {
      isGuest = true;
      updateAuthUI();
    });
  }

  // Logout Handler
  if (logoutBtn) {
    logoutBtn.addEventListener("click", handleLogout);
  }

  // Initial Check (for persistent sessions)
  const currentUser = userPool.getCurrentUser();
  if (currentUser) {
    currentUser.getSession((err, session) => {
      if (err) {
        authToken = null;
      } else if (session.isValid()) {
        authToken = session.getIdToken().getJwtToken();
        localStorage.setItem("concordia_id_token", authToken);
      }
      updateAuthUI();
    });
  } else {
    // Check localStorage fallback (or clear it if no user)
    if (localStorage.getItem("concordia_id_token")) {
      // Ideally we verify validity, but simple presence check for now
    }
    updateAuthUI();
  }
});

// Create global variables for external access if needed (optional)
// window.isGuest = isGuest;
