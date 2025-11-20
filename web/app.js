const scene = document.getElementById("scene");
const ctx = scene.getContext("2d");
const startBtn = document.getElementById("start-btn");
const statusEl = document.getElementById("status");

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
  const fall = 0.5;
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
  sky.addColorStop(0, "rgba(40, 90, 170, 1)");
  sky.addColorStop(1, "rgba(12, 28, 70, 1)");
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
  glow.addColorStop(0, "rgba(200, 230, 255, 0.18)");
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  // Distant moon/halo for mood.
  const moonY = h * 0.22;
  const moonX = w * 0.2;
  const moonR = 26;
  ctx.beginPath();
  ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(250, 255, 255, 0.75)";
  ctx.fill();
  const moonGlow = ctx.createRadialGradient(moonX, moonY, 0, moonX, moonY, moonR * 3);
  moonGlow.addColorStop(0, "rgba(220, 240, 255, 0.16)");
  moonGlow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = moonGlow;
  ctx.fillRect(0, 0, w, h);

  // Speech energy wave state.
  state.speechEnergy = state.isSpeech
    ? Math.min(1, state.speechEnergy + 0.05)
    : state.speechEnergy * 0.92;

  const breath = (Math.sin(nowSec * 0.35) + 1) / 2;
  const waveLevel = Math.min(1, state.windowEnergy * 0.8); // 15s averaged tone, stronger range
  const drift = state.driftPhase || 0; // slow horizontal drift
  const baseLine = h * 0.66 + 10 * (breath - 0.5);
  const ampMain = 14 + 40 * waveLevel; // larger swell
  const ampSub = 8 + 28 * waveLevel;
  const swell = 16 * Math.sin(nowSec * 0.35);
  const t = nowSec * 0.9; // slower temporal speed

  // Water body.
  ctx.save();
  ctx.beginPath();
  for (let x = 0; x <= w; x += 8) {
    const y =
      baseLine + swell +
      Math.sin(x * 0.010 + t + drift * 0.8) * ampMain +
      Math.sin(x * 0.018 + t * 1.1 + drift * 0.6) * ampSub +
      Math.sin(x * 0.004 + drift * 0.4) * 6 +
      softNoise(x, t * 12) * (3 + 10 * waveLevel);
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();

  // Darker base, add gentle teal/green variation with energy.
  const waterTone = Math.min(1, state.windowEnergy * 0.7);
  const topR = Math.round(40 + 80 * waterTone);
  const topG = Math.round(110 + 90 * waterTone);
  const topB = Math.round(150 + 40 * waterTone);
  const botR = Math.round(10 + 40 * waterTone);
  const botG = Math.round(50 + 90 * waterTone);
  const botB = Math.round(90 + 90 * waterTone);
  const water = ctx.createLinearGradient(0, baseLine - 40, 0, h);
  water.addColorStop(0, `rgba(${topR}, ${topG}, ${topB}, ${0.6 + 0.18 * waveLevel})`);
  water.addColorStop(1, `rgba(${botR}, ${botG}, ${botB}, 1)`);
  ctx.fillStyle = water;
  ctx.fill();

  // Crests.
  ctx.lineWidth = 2;
  const crestColor = `rgba(240, 250, 255, ${0.08 + 0.1 * waveLevel})`;
  ctx.strokeStyle = crestColor;
  ctx.beginPath();
  for (let x = 0; x <= w; x += 16) {
    const y =
      baseLine +
      Math.sin(x * 0.014 + t * 1.05 + drift * 0.7) * (ampMain * 0.7) +
      Math.sin(x * 0.027 + t * 1.4 + drift * 0.5) * (ampSub * 0.6) +
      Math.sin(x * 0.006 + drift * 0.5) * 4 +
      softNoise(x * 0.8, t * 10) * (2 + 6 * waveLevel);
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();

  // Distant shimmer.
  ctx.fillStyle = `rgba(${180 + 30 * waterTone}, ${220 + 20 * waterTone}, ${230 + 10 * waterTone}, ${0.01 + 0.028 * waveLevel})`;
  for (let i = 0; i < 18; i++) {
    const px = (w / 18) * i + 6 * Math.sin(t * 0.6 + i);
    const py = baseLine + 6 * Math.sin(t * 0.9 + i * 0.5);
    ctx.fillRect(px, py, 10, 1);
  }

  // Overlay text.
  ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
  ctx.font = "14px 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(state.isSpeech ? "listening — speech" : "listening — calm", w / 2, h - 24);
}

function loop() {
  const now = performance.now() / 1000;
  const dt = state.lastNowSec ? now - state.lastNowSec : 0;
  state.lastNowSec = now;
  state.driftPhase += dt * 0.25; // slow drift

  if (state.running && state.analyser) {
    state.analyser.getFloatTimeDomainData(state.data);
    const energy = rms(state.data);
    detectSpeech(energy);
    updateWindowEnergy(energy, now);
  }
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

// Kick off render loop
loop();
