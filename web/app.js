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
};

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


  // Overlay text.
  ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
  ctx.font = "14px 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`scene — ${state.scene}`, w / 2, h - 24);
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
    // update run lengths
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
  }
  
  classifyScene(now);
  draw(now);
  requestAnimationFrame(loop);
}

async function startAudio() {
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setStatus("このブラウザはマイク取得に対応していません");
      return;
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const audioCtx = new AudioContext();
    if (audioCtx.state === "suspended") {
      await audioCtx.resume();
    }
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;

    const source = audioCtx.createMediaStreamSource(stream);
    source.connect(analyser);

    state.audioCtx = audioCtx;
    state.analyser = analyser;
    state.micSource = source;
    state.running = true;
    setStatus("マイク取得中 → リアクティブ表示中");
    startBtn.disabled = true;
  } catch (err) {
    console.error(err);
    setStatus("マイク許可が必要です / もしくはブラウザが拒否しました");
  }
}

if (startBtn) {
  startBtn.addEventListener("click", () => {
    setStatus("マイク許可をリクエスト中...");
    startAudio();
  });
} else {
  console.warn("start button not found in DOM");
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

// Kick off render loop
loop();
function classifyScene(nowSec) {
  // デモモードの場合は手動で設定したシーンを使用
  if (state.demoMode) {
    state.scene = state.demoScene;
  } else {
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
