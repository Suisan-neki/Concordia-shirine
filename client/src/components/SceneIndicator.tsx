/**
 * Concordia Shrine - Scene Indicator Component
 * 
 * 現在のシーン（空気）を表示
 * - 静寂、調和、一方的、沈黙の4つのシーン
 * - シーンの説明と視覚的フィードバック
 */

import { motion, AnimatePresence } from 'framer-motion';
import type { SceneType } from '@/lib/waveEngine';

interface SceneIndicatorProps {
  scene: SceneType;
  isRecording: boolean;
  className?: string;
}

// シーンの設定
export const sceneConfigs: Record<SceneType, {
  label: string;
  description: string;
  guidance: string;
  color: string;
  bgColor: string;
  icon: string;
}> = {
  '静寂': {
    label: '静寂',
    description: '声と静けさがゆっくり行き来しています',
    guidance: '会話が始まる準備ができています。',
    color: 'text-foreground',
    bgColor: 'bg-muted/30',
    icon: '○'
  },
  '調和': {
    label: '調和',
    description: '声の出入りが穏やかでバランスの良い対話が続いています',
    guidance: 'この状態を保ちましょう。\n全員が発言しやすい雰囲気です',
    color: 'text-shrine-jade',
    bgColor: 'bg-shrine-jade/10',
    icon: '◎'
  },
  '一方的': {
    label: '一方的',
    description: 'ひとつの方向からの声が長く続いています',
    guidance: '他の参加者にも\n発言の機会を設けてみましょう',
    color: 'text-shrine-vermilion',
    bgColor: 'bg-shrine-vermilion/10',
    icon: '▶'
  },
  '沈黙': {
    label: '沈黙',
    description: '静かな余白がゆっくり流れています',
    guidance: '沈黙は自然な余白です。\n急がなくて大丈夫。\n場の空気をゆるやかにあたためていきましょう。',
    color: 'text-shrine-wave-light',
    bgColor: 'bg-shrine-wave-light/10',
    icon: '◇'
  }
};

export function SceneIndicator({ scene, isRecording, className = '' }: SceneIndicatorProps) {
  const config = sceneConfigs[scene];
  
  return (
    <div className={`fixed top-4 left-4 z-20 ${className}`}>
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className={`${config.bgColor} backdrop-blur-sm border border-border/50 rounded-lg p-4 w-64 max-w-[80vw]`}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-muted-foreground font-serif-jp">
              会話の状態
            </span>
            <span className="text-[10px] text-muted-foreground/70">
              対話のバランス
            </span>
          </div>
          {isRecording && (
            <motion.div
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="flex items-center gap-1.5"
            >
              <span className="w-2 h-2 rounded-full bg-shrine-vermilion" />
              <span className="text-[10px] text-shrine-vermilion">録音中</span>
            </motion.div>
          )}
        </div>
        
        {/* シーン表示 */}
        <AnimatePresence mode="wait">
          <motion.div
            key={scene}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex items-center gap-3 mb-2">
              <span className={`text-2xl ${config.color}`}>
                {config.icon}
              </span>
              <span className={`text-xl font-serif-jp ${config.color}`}>
                {config.label}
              </span>
            </div>
            
            <p className="text-sm text-muted-foreground leading-relaxed">
              {config.description}
            </p>
            <p className="text-xs text-foreground mt-2 font-medium whitespace-pre-line">
              {config.guidance}
            </p>
          </motion.div>
        </AnimatePresence>
        
        {/* シーンインジケーター（4つのドット） */}
        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border/30">
          {(['静寂', '調和', '一方的', '沈黙'] as SceneType[]).map((s) => (
            <motion.div
              key={s}
              className={`w-2 h-2 rounded-full transition-colors duration-300 ${
                s === scene 
                  ? sceneConfigs[s].color.replace('text-', 'bg-')
                  : 'bg-muted'
              }`}
              animate={s === scene ? { scale: [1, 1.2, 1] } : {}}
              transition={{ duration: 0.5 }}
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
}

export default SceneIndicator;
