/**
 * Wave Hint Overlay Component
 * 
 * 初回訪問時に「祠の機嫌を伺う」というコンセプトを説明するオーバーレイ
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';

const STORAGE_KEY = 'concordia-shine-wave-hint-dismissed';

interface WaveHintOverlayProps {
  onDismiss?: () => void;
}

export function WaveHintOverlay({ onDismiss }: WaveHintOverlayProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // 初回訪問かどうかをチェック
    const hasSeenHint = localStorage.getItem(STORAGE_KEY) === 'true';
    if (!hasSeenHint) {
      setIsVisible(true);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setIsVisible(false);
    onDismiss?.();
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <>
          {/* オーバーレイ背景 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleDismiss}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
          />
          
          {/* ヒントカード */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25 }}
            className="fixed inset-4 md:inset-16 lg:inset-32 z-50 pointer-events-none"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-card border border-border rounded-xl shadow-lg p-6 md:p-8 max-w-2xl mx-auto pointer-events-auto">
              {/* ヘッダー */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-xl font-serif-jp text-foreground mb-2">
                    会話の状態を視覚化
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    波の動きで対話のバランスを確認できます
                  </p>
                </div>
                <button
                  onClick={handleDismiss}
                  className="p-1 hover:bg-muted rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* コンテンツ */}
              <div className="space-y-4 mb-6">
                <p className="text-sm text-foreground leading-relaxed">
                  この画面の波は、会話の状態を視覚化しています。対話のバランス（調和、一方的、沈黙、静寂）が波の色や動きとして表示されます。
                </p>

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="p-3 bg-shrine-jade/10 rounded-lg border border-shrine-jade/20">
                    <div className="text-xs font-medium text-shrine-jade mb-1">調和</div>
                    <p className="text-xs text-muted-foreground mb-2">バランスの良い対話が続いています</p>
                    <p className="text-[10px] text-foreground font-medium">この状態を保ちましょう</p>
                  </div>
                  <div className="p-3 bg-shrine-vermilion/10 rounded-lg border border-shrine-vermilion/20">
                    <div className="text-xs font-medium text-shrine-vermilion mb-1">一方的</div>
                    <p className="text-xs text-muted-foreground mb-2">発言の偏りが検出されています</p>
                    <p className="text-[10px] text-foreground font-medium">他の参加者にも発言の機会を設けましょう</p>
                  </div>
                  <div className="p-3 bg-shrine-wave-light/10 rounded-lg border border-shrine-wave-light/20">
                    <div className="text-xs font-medium text-shrine-wave-light mb-1">沈黙</div>
                    <p className="text-xs text-muted-foreground mb-2">静かな余白が続いています</p>
                    <p className="text-[10px] text-foreground font-medium">沈黙は自然な余白です。急がなくて大丈夫。場の空気をあたためていきましょう</p>
                  </div>
                  <div className="p-3 bg-shrine-wave/10 rounded-lg border border-shrine-wave/20">
                    <div className="text-xs font-medium text-foreground mb-1">静寂</div>
                    <p className="text-xs text-muted-foreground mb-2">声と静けさが行き来しています</p>
                    <p className="text-[10px] text-foreground font-medium">会話が始まる準備ができています</p>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground italic mt-4">
                  左上のインジケーターで、現在の状態と改善のヒントを確認できます。
                </p>
              </div>

              {/* アクション */}
              <div className="flex justify-end">
                <Button onClick={handleDismiss} size="sm">
                  理解しました
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default WaveHintOverlay;
