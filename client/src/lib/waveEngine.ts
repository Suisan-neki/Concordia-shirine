/**
 * Concordia Shrine - Wave Engine
 * 
 * 神道的ミニマリズムに基づく波生成エンジン
 * - Perlin Noiseベースの有機的な動き
 * - シーン（静寂、調和、一方的、沈黙）に応じた動的変化
 * - 呼吸のリズム（8秒周期）に同期したアニメーション
 */

// シーンタイプの定義
export type SceneType = '静寂' | '調和' | '一方的' | '沈黙';

// 波のパラメータ
export interface WaveParams {
  amplitude: number;      // 波の振幅 (0-1)
  frequency: number;      // 波の周波数
  speed: number;          // 波の速度
  turbulence: number;     // 乱流度 (0-1)
  color: {
    top: string;
    bottom: string;
  };
}

// シーンごとの波パラメータ
export const SCENE_WAVE_PARAMS: Record<SceneType, WaveParams> = {
  '静寂': {
    amplitude: 0.4,
    frequency: 0.008,
    speed: 0.3,
    turbulence: 0.2,
    color: {
      top: 'rgba(30, 58, 95, 0.6)',      // 藍色
      bottom: 'rgba(10, 30, 60, 0.9)'
    }
  },
  '調和': {
    amplitude: 0.25,
    frequency: 0.012,
    speed: 0.2,
    turbulence: 0.1,
    color: {
      top: 'rgba(45, 90, 74, 0.6)',      // 翡翠色
      bottom: 'rgba(20, 50, 40, 0.9)'
    }
  },
  '一方的': {
    amplitude: 0.8,
    frequency: 0.015,
    speed: 0.8,
    turbulence: 0.7,
    color: {
      top: 'rgba(120, 50, 50, 0.6)',     // 暗い朱色
      bottom: 'rgba(40, 20, 30, 0.9)'
    }
  },
  '沈黙': {
    amplitude: 0.6,
    frequency: 0.006,
    speed: 0.15,
    turbulence: 0.4,
    color: {
      top: 'rgba(40, 50, 80, 0.6)',      // 暗い藍色
      bottom: 'rgba(15, 20, 35, 0.95)'
    }
  }
};

/**
 * Perlin Noise 実装
 * Ken Perlin のアルゴリズムに基づく
 */
class PerlinNoise {
  private permutation: number[];
  
  constructor(seed: number = 0) {
    this.permutation = this.generatePermutation(seed);
  }
  
  private generatePermutation(seed: number): number[] {
    const p: number[] = [];
    for (let i = 0; i < 256; i++) {
      p[i] = i;
    }
    
    // Fisher-Yates シャッフル with seed
    let random = seed;
    for (let i = 255; i > 0; i--) {
      random = (random * 16807) % 2147483647;
      const j = random % (i + 1);
      [p[i], p[j]] = [p[j], p[i]];
    }
    
    // 配列を2倍にして循環参照を容易に
    return [...p, ...p];
  }
  
  private fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }
  
  private lerp(a: number, b: number, t: number): number {
    return a + t * (b - a);
  }
  
  private grad(hash: number, x: number, y: number): number {
    const h = hash & 3;
    const u = h < 2 ? x : y;
    const v = h < 2 ? y : x;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }
  
  noise2D(x: number, y: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    
    x -= Math.floor(x);
    y -= Math.floor(y);
    
    const u = this.fade(x);
    const v = this.fade(y);
    
    const A = this.permutation[X] + Y;
    const B = this.permutation[X + 1] + Y;
    
    return this.lerp(
      this.lerp(
        this.grad(this.permutation[A], x, y),
        this.grad(this.permutation[B], x - 1, y),
        u
      ),
      this.lerp(
        this.grad(this.permutation[A + 1], x, y - 1),
        this.grad(this.permutation[B + 1], x - 1, y - 1),
        u
      ),
      v
    );
  }
  
  // オクターブノイズ（より自然な見た目のため）
  octaveNoise2D(x: number, y: number, octaves: number = 4, persistence: number = 0.5): number {
    let total = 0;
    let frequency = 1;
    let amplitude = 1;
    let maxValue = 0;
    
    for (let i = 0; i < octaves; i++) {
      total += this.noise2D(x * frequency, y * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= 2;
    }
    
    return total / maxValue;
  }
}

/**
 * 波生成エンジン
 */
export class WaveEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private perlin: PerlinNoise;
  private animationId: number | null = null;
  private startTime: number;
  
  // 現在の状態
  private currentScene: SceneType = '静寂';
  private targetParams: WaveParams;
  private currentParams: WaveParams;
  private transitionProgress: number = 1;
  private transitionDuration: number = 2000; // 2秒でシーン遷移
  
  // 音声エネルギー（リアルタイム反応用）
  private instantEnergy: number = 0;
  private smoothedEnergy: number = 0;
  
  // 呼吸のリズム（8秒周期）
  private breathCycle: number = 8000;
  
  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get 2D context');
    this.ctx = ctx;
    
    this.perlin = new PerlinNoise(Date.now());
    this.startTime = Date.now();
    this.targetParams = { ...SCENE_WAVE_PARAMS['静寂'] };
    this.currentParams = { ...SCENE_WAVE_PARAMS['静寂'] };
  }
  
  /**
   * シーンを変更
   */
  setScene(scene: SceneType): void {
    if (scene === this.currentScene && this.transitionProgress >= 1) return;
    
    this.currentScene = scene;
    this.targetParams = { ...SCENE_WAVE_PARAMS[scene] };
    this.transitionProgress = 0;
  }
  
  /**
   * 音声エネルギーを更新（0-1の範囲）
   */
  setEnergy(energy: number): void {
    this.instantEnergy = Math.max(0, Math.min(1, energy));
  }
  
  /**
   * パラメータの補間
   */
  private lerpParams(from: WaveParams, to: WaveParams, t: number): WaveParams {
    const ease = t * t * (3 - 2 * t); // smoothstep
    
    return {
      amplitude: from.amplitude + (to.amplitude - from.amplitude) * ease,
      frequency: from.frequency + (to.frequency - from.frequency) * ease,
      speed: from.speed + (to.speed - from.speed) * ease,
      turbulence: from.turbulence + (to.turbulence - from.turbulence) * ease,
      color: {
        top: this.lerpColor(from.color.top, to.color.top, ease),
        bottom: this.lerpColor(from.color.bottom, to.color.bottom, ease)
      }
    };
  }
  
  /**
   * 色の補間
   */
  private lerpColor(from: string, to: string, t: number): string {
    const parseRgba = (color: string) => {
      const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
      if (!match) return { r: 0, g: 0, b: 0, a: 1 };
      return {
        r: parseInt(match[1]),
        g: parseInt(match[2]),
        b: parseInt(match[3]),
        a: match[4] ? parseFloat(match[4]) : 1
      };
    };
    
    const c1 = parseRgba(from);
    const c2 = parseRgba(to);
    
    return `rgba(${
      Math.round(c1.r + (c2.r - c1.r) * t)
    }, ${
      Math.round(c1.g + (c2.g - c1.g) * t)
    }, ${
      Math.round(c1.b + (c2.b - c1.b) * t)
    }, ${
      c1.a + (c2.a - c1.a) * t
    })`;
  }
  
  /**
   * 波の高さを計算
   */
  private calculateWaveHeight(x: number, time: number, params: WaveParams): number {
    const { amplitude, frequency, speed, turbulence } = params;
    
    // 呼吸のリズム
    const breathPhase = (time % this.breathCycle) / this.breathCycle;
    const breathFactor = 0.9 + 0.1 * Math.sin(breathPhase * Math.PI * 2);
    
    // 基本波（複数の正弦波の合成）
    const baseWave = 
      Math.sin(x * frequency + time * speed * 0.001) * 0.5 +
      Math.sin(x * frequency * 1.5 + time * speed * 0.0008) * 0.3 +
      Math.sin(x * frequency * 0.5 + time * speed * 0.0012) * 0.2;
    
    // Perlin Noiseによる乱流
    const noiseScale = 0.002;
    const noiseTime = time * 0.0001 * speed;
    const noise = this.perlin.octaveNoise2D(x * noiseScale, noiseTime, 3, 0.5);
    
    // 音声エネルギーによる瞬時の反応
    const energyFactor = 1 + this.smoothedEnergy * 0.5;
    
    // 最終的な波の高さ
    const height = (baseWave * (1 - turbulence) + noise * turbulence) * 
                   amplitude * breathFactor * energyFactor;
    
    return height;
  }
  
  /**
   * 描画
   */
  private draw(timestamp: number): void {
    const { width, height } = this.canvas;
    const time = timestamp - this.startTime;
    
    // エネルギーのスムージング
    this.smoothedEnergy += (this.instantEnergy - this.smoothedEnergy) * 0.1;
    
    // シーン遷移の更新
    if (this.transitionProgress < 1) {
      this.transitionProgress += 16 / this.transitionDuration; // 約60fps想定
      this.transitionProgress = Math.min(1, this.transitionProgress);
      this.currentParams = this.lerpParams(
        this.currentParams,
        this.targetParams,
        this.transitionProgress
      );
    }
    
    // 背景クリア（グラデーション）
    const bgGradient = this.ctx.createLinearGradient(0, 0, 0, height);
    bgGradient.addColorStop(0, 'rgba(8, 12, 20, 1)');
    bgGradient.addColorStop(0.5, 'rgba(12, 18, 30, 1)');
    bgGradient.addColorStop(1, 'rgba(15, 22, 35, 1)');
    this.ctx.fillStyle = bgGradient;
    this.ctx.fillRect(0, 0, width, height);
    
    // 波の描画
    const baseY = height * 0.65;
    const params = this.currentParams;
    
    // 波の本体
    this.ctx.beginPath();
    this.ctx.moveTo(0, height);
    
    const step = 4; // 描画精度
    for (let x = 0; x <= width; x += step) {
      const waveHeight = this.calculateWaveHeight(x, time, params);
      const y = baseY + waveHeight * height * 0.15;
      
      if (x === 0) {
        this.ctx.lineTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
    }
    
    this.ctx.lineTo(width, height);
    this.ctx.closePath();
    
    // 波のグラデーション
    const waveGradient = this.ctx.createLinearGradient(0, baseY - 50, 0, height);
    waveGradient.addColorStop(0, params.color.top);
    waveGradient.addColorStop(1, params.color.bottom);
    this.ctx.fillStyle = waveGradient;
    this.ctx.fill();
    
    // 波頭のハイライト
    this.ctx.beginPath();
    for (let x = 0; x <= width; x += step) {
      const waveHeight = this.calculateWaveHeight(x, time, params);
      const y = baseY + waveHeight * height * 0.15;
      
      if (x === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
    }
    
    this.ctx.strokeStyle = `rgba(200, 220, 240, ${0.1 + this.smoothedEnergy * 0.1})`;
    this.ctx.lineWidth = 1.5;
    this.ctx.stroke();
    
    // 遠景の微かな光（水面の反射）
    const shimmerCount = 8;
    for (let i = 0; i < shimmerCount; i++) {
      const shimmerX = (width / shimmerCount) * i + 
                       Math.sin(time * 0.001 + i) * 20;
      const shimmerY = baseY + Math.sin(time * 0.0015 + i * 0.5) * 10;
      const shimmerAlpha = 0.02 + Math.sin(time * 0.002 + i) * 0.01;
      
      this.ctx.fillStyle = `rgba(200, 220, 240, ${shimmerAlpha})`;
      this.ctx.fillRect(shimmerX, shimmerY, 15, 2);
    }
  }
  
  /**
   * アニメーションループ開始
   */
  start(): void {
    if (this.animationId !== null) return;
    
    const animate = (timestamp: number) => {
      this.draw(timestamp);
      this.animationId = requestAnimationFrame(animate);
    };
    
    this.animationId = requestAnimationFrame(animate);
  }
  
  /**
   * アニメーション停止
   */
  stop(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }
  
  /**
   * キャンバスサイズ更新
   */
  resize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
  }
  
  /**
   * 現在のシーンを取得
   */
  getCurrentScene(): SceneType {
    return this.currentScene;
  }
}

export default WaveEngine;
