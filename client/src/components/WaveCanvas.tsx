/**
 * Concordia Shrine - Wave Canvas Component
 * 
 * 「祠の機嫌を伺う」ための波の可視化
 * 
 * コンセプト:
 * 波の動きは「祠の機嫌」を表現している。参加者は波を見て「空気」を感じ取る。
 * - 調和: 穏やかな翡翠色の波 = 祠が満足している状態
 * - 一方的: 激しい暗い朱色の波 = 祠が不安定な状態
 * - 沈黙: 柔らかな藍緑色の波 = 祠が余白を受け止めている状態
 * - 静寂: 穏やかな藍色の波 = 祠が落ち着いている状態
 * 
 * 技術的実装:
 * - Perlin Noiseベースの有機的な波
 * - シーンに応じた動的な色と動き
 * - 呼吸のリズムに同期したアニメーション
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { WaveEngine, type SceneType } from '@/lib/waveEngine';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

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
 * 「祠の機嫌を伺う」ための波の可視化コンポーネント。
 * 会話の状態（シーン）を「祠の機嫌」として波の動きで表現し、
 * 参加者が「空気」を感じ取れるようにする。
 * 
 * 波が表現するもの:
 * - 波の色: 祠の機嫌の状態（調和=翡翠色、一方的=暗い朱色、沈黙=柔らかな藍緑色、静寂=藍色）
 * - 波の動き: 祠の反応（激しい=不安定、穏やか=安定）
 * - 音声エネルギー: 参加者の声が波に反映される（波が音声に反応）
 * 
 * 機能:
 * - シーン（祠の機嫌）に応じた色と動きの変化
 * - 音声エネルギーにリアルタイムで反応
 * - リサイズ対応（デバイスピクセル比を考慮）
 * - 高解像度対応（Retinaディスプレイ）
 * 
 * @param props - コンポーネントのプロパティ
 * @param props.scene - 現在のシーン（祠の機嫌の状態: 静寂、調和、一方的、沈黙）
 * @param props.energy - 音声エネルギー（0-1の範囲、波が音声に反応する）
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
   * シーン変更を処理する（祠の機嫌の変化を反映する）
   * 
   * シーンプロパティ（祠の機嫌）が変更された場合、WaveEngineに新しいシーンを設定する。
   * これにより、波の色や動きがスムーズに変化し、参加者が「空気」の変化を感じ取れる。
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
  
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div 
          ref={containerRef} 
          className={`relative w-full h-full ${className}`}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full"
          />
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs bg-card border border-border">
        <p className="text-sm font-medium mb-1 text-foreground">会話の状態を視覚化</p>
        <p className="text-xs text-muted-foreground">
          波の色や動きで対話のバランスを確認できます。左上のインジケーターで詳細を確認してください。
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

export default WaveCanvas;
