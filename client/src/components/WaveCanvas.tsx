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

/**
 * WaveCanvasコンポーネントのプロパティ
 */
interface WaveCanvasProps {
  /** 現在のシーン（静寂、調和、一方的、沈黙） */
  scene: SceneType;
  /** 音声エネルギー（0-1の範囲） */
  energy: number;
  /** 追加のCSSクラス名（オプション） */
  className?: string;
}

/**
 * WaveCanvasコンポーネント
 * 
 * 神道的ミニマリズムに基づく波の可視化コンポーネント。
 * Perlin Noiseベースの有機的な波を描画し、シーンに応じて動的に変化する。
 * 呼吸のリズム（8秒周期）に同期したアニメーションを実現する。
 * 
 * 機能:
 * - シーンに応じた色と動きの変化
 * - 音声エネルギーにリアルタイムで反応
 * - リサイズ対応（デバイスピクセル比を考慮）
 * - 高解像度対応（Retinaディスプレイ）
 * 
 * @param props - コンポーネントのプロパティ
 * @param props.scene - 現在のシーン（静寂、調和、一方的、沈黙）
 * @param props.energy - 音声エネルギー（0-1の範囲）
 * @param props.className - 追加のCSSクラス名（オプション）
 * @returns WaveCanvasコンポーネント
 */
export function WaveCanvas({ scene, energy, className = '' }: WaveCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<WaveEngine | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  /**
   * キャンバスのリサイズを処理する
   * 
   * コンテナのサイズに合わせてキャンバスをリサイズし、
   * デバイスピクセル比（Retinaディスプレイ）を考慮して高解像度描画を行う。
   */
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
  
  /**
   * WaveEngineを初期化する
   * 
   * コンポーネントマウント時にWaveEngineインスタンスを作成し、
   * アニメーションを開始する。また、ウィンドウリサイズイベントを登録する。
   * アンマウント時にはアニメーションを停止し、イベントリスナーを削除する。
   */
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
  
  /**
   * シーン変更を処理する
   * 
   * シーンプロパティが変更された場合、WaveEngineに新しいシーンを設定する。
   * これにより、波の色や動きがスムーズに変化する。
   */
  useEffect(() => {
    engineRef.current?.setScene(scene);
  }, [scene]);
  
  /**
   * 音声エネルギー更新を処理する
   * 
   * 音声エネルギープロパティが変更された場合、WaveEngineに新しいエネルギー値を設定する。
   * これにより、波が音声にリアルタイムで反応する。
   */
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
