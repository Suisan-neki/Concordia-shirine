/**
 * Concordia Shrine - Intervention System Component
 * 
 * 「一方的」や「沈黙」状態が続いた場合に、
 * 穏やかな通知音や画面上のヒントを表示して参加者に気づきを促す
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { SceneType } from '@/lib/waveEngine';
import type { InterventionSettings } from '@/hooks/useInterventionSettings';

interface InterventionSystemProps {
  scene: SceneType;
  isActive: boolean;
  settings: InterventionSettings;
  onIntervention?: (type: string) => void;
}

// 介入メッセージの定義
const INTERVENTION_MESSAGES: Record<string, { title: string; message: string; icon: string }> = {
  monologue: {
    title: '発言のバランス',
    message: '一方的な発言が続いています。他の方にも発言の機会を設けてみませんか？',
    icon: '🌊',
  },
  silence: {
    title: '沈黙の気づき',
    message: '沈黙が続いています。発言しやすい雰囲気を作るきっかけを探してみましょう。',
    icon: '✨',
  },
  prolonged_tension: {
    title: '空気の変化',
    message: '緊張した空気が続いています。一度深呼吸して、場の空気を整えてみましょう。',
    icon: '🍃',
  },
};

// 通知音を生成するユーティリティ
function createNotificationSound(type: 'gentle' | 'chime' | 'bell'): void {
  try {
    const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // 穏やかな音を生成
    switch (type) {
      case 'gentle':
        oscillator.frequency.setValueAtTime(440, audioContext.currentTime); // A4
        oscillator.frequency.exponentialRampToValueAtTime(523.25, audioContext.currentTime + 0.3); // C5
        oscillator.type = 'sine';
        break;
      case 'chime':
        oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime); // E5
        oscillator.frequency.exponentialRampToValueAtTime(783.99, audioContext.currentTime + 0.2); // G5
        oscillator.type = 'triangle';
        break;
      case 'bell':
        oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
        oscillator.type = 'sine';
        break;
    }
    
    // フェードイン・フェードアウト
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.15, audioContext.currentTime + 0.1);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.8);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.8);
  } catch (error) {
    console.warn('Failed to play notification sound:', error);
  }
}

export function InterventionSystem({ 
  scene, 
  isActive, 
  settings, 
  onIntervention 
}: InterventionSystemProps) {
  const [currentIntervention, setCurrentIntervention] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const sceneStartTimeRef = useRef<number>(Date.now());
  const lastInterventionRef = useRef<number>(0);
  const previousSceneRef = useRef<SceneType>(scene);

  // シーン変更を検出
  useEffect(() => {
    if (scene !== previousSceneRef.current) {
      sceneStartTimeRef.current = Date.now();
      previousSceneRef.current = scene;
    }
  }, [scene]);

  // 介入チェック
  useEffect(() => {
    if (!isActive || !settings.enabled) return;

    const checkInterval = setInterval(() => {
      const now = Date.now();
      const sceneDuration = (now - sceneStartTimeRef.current) / 1000;
      const timeSinceLastIntervention = (now - lastInterventionRef.current) / 1000;

      // 最後の介入から30秒以上経過していない場合はスキップ
      if (timeSinceLastIntervention < 30) return;

      let interventionType: string | null = null;

      // 一方的状態のチェック
      if (scene === '一方的' && sceneDuration >= settings.monologueThreshold) {
        interventionType = 'monologue';
      }
      // 沈黙状態のチェック
      else if (scene === '沈黙' && sceneDuration >= settings.silenceThreshold) {
        interventionType = 'silence';
      }

      if (interventionType) {
        triggerIntervention(interventionType);
      }
    }, 1000);

    return () => clearInterval(checkInterval);
  }, [isActive, scene, settings]);

  const triggerIntervention = useCallback((type: string) => {
    lastInterventionRef.current = Date.now();
    setCurrentIntervention(type);
    
    // 通知音を再生
    if (settings.soundEnabled) {
      createNotificationSound('gentle');
    }
    
    // 視覚的ヒントを表示
    if (settings.visualHintEnabled) {
      setIsVisible(true);
      
      // 10秒後に自動的に非表示
      setTimeout(() => {
        setIsVisible(false);
        setTimeout(() => setCurrentIntervention(null), 500);
      }, 10000);
    }
    
    // コールバックを呼び出し
    onIntervention?.(type);
  }, [settings, onIntervention]);

  const dismissIntervention = useCallback(() => {
    setIsVisible(false);
    setTimeout(() => setCurrentIntervention(null), 500);
  }, []);

  const intervention = currentIntervention ? INTERVENTION_MESSAGES[currentIntervention] : null;

  return (
    <AnimatePresence>
      {isVisible && intervention && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ type: 'spring', damping: 25 }}
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 max-w-md w-full mx-4"
        >
          <div className="bg-card/95 backdrop-blur-md border border-shrine-jade/30 rounded-xl shadow-lg overflow-hidden">
            {/* 上部のグラデーションバー */}
            <div className="h-1 bg-gradient-to-r from-shrine-jade via-shrine-gold to-shrine-jade" />
            
            <div className="p-4">
              <div className="flex items-start gap-3">
                {/* アイコン */}
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-shrine-jade/20 flex items-center justify-center">
                  <span className="text-xl">{intervention.icon}</span>
                </div>
                
                {/* コンテンツ */}
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-foreground mb-1">
                    {intervention.title}
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {intervention.message}
                  </p>
                </div>
                
                {/* 閉じるボタン */}
                <button
                  onClick={dismissIntervention}
                  className="flex-shrink-0 p-1 hover:bg-muted rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {/* アクションヒント */}
              <div className="mt-3 pt-3 border-t border-border/50">
                <p className="text-[10px] text-muted-foreground/70 text-center">
                  このヒントは、場の空気を改善するきっかけとしてお使いください
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default InterventionSystem;
