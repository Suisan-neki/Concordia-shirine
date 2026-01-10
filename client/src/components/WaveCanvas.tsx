/**
 * Concordia Shrine - Wave Canvas Component
 * 
 * 神道的ミニマリズムに基づく波の可視化
 * - Perlin Noiseベースの有機的な波
 * - シーンに応じた動的な色と動き
 * - 呼吸のリズムに同期したアニメーション
 */

import { useEffect, useRef, useCallback } from 'react';
import { WaveEngine, type SceneType } from '@/lib/waveEngine';

interface WaveCanvasProps {
  scene: SceneType;
  energy: number;
  className?: string;
}

export function WaveCanvas({ scene, energy, className = '' }: WaveCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<WaveEngine | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // リサイズハンドラ
  const handleResize = useCallback(() => {
    if (!canvasRef.current || !containerRef.current || !engineRef.current) return;
    
    const { width, height } = containerRef.current.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    canvasRef.current.width = width * dpr;
    canvasRef.current.height = height * dpr;
    canvasRef.current.style.width = `${width}px`;
    canvasRef.current.style.height = `${height}px`;
    
    const ctx = canvasRef.current.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
    }
    
    engineRef.current.resize(width, height);
  }, []);
  
  // 初期化
  useEffect(() => {
    if (!canvasRef.current) return;
    
    engineRef.current = new WaveEngine(canvasRef.current);
    handleResize();
    engineRef.current.start();
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      engineRef.current?.stop();
    };
  }, [handleResize]);
  
  // シーン変更
  useEffect(() => {
    engineRef.current?.setScene(scene);
  }, [scene]);
  
  // エネルギー更新
  useEffect(() => {
    engineRef.current?.setEnergy(energy);
  }, [energy]);
  
  return (
    <div ref={containerRef} className={`relative w-full h-full ${className}`}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
      />
    </div>
  );
}

export default WaveCanvas;
