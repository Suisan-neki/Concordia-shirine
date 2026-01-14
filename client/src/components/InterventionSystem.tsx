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

/**
 * InterventionSystemコンポーネントのプロパティ
 */
interface InterventionSystemProps {
  /** 現在のシーン（静寂、調和、一方的、沈黙） */
  scene: SceneType;
  /** セッションがアクティブかどうか */
  isActive: boolean;
  /** 介入設定（有効/無効、閾値、サウンド/ビジュアルヒントなど） */
  settings: InterventionSettings;
  /** 介入が発生したときに呼ばれるコールバック（オプション） */
  onIntervention?: (type: string) => void;
}

// 介入のクールダウン時間（秒）
const INTERVENTION_COOLDOWN_SEC = 30;
// シーン判定は発話/沈黙が一定時間続いてから切り替わるため補正を入れる
const SCENE_ENTRY_DELAY_SEC = 8;

// 介入メッセージの定義
const INTERVENTION_MESSAGES: Record<string, { title: string; message: string; icon: string }> = {
  monologue: {
    title: '発言のバランス',
    message: '一方的な発言が続いています。他の方にも発言の機会を設けてみませんか',
    icon: '🌊',
  },
  silence: {
    title: '静かな余白',
    message: '少し静かな間が続いています。沈黙は自然な余白で、祠はその余白をあたためています。急がなくて大丈夫。必要なら、ひと呼吸おいて場の空気を整えてみてください',
    icon: '✨',
  },
  prolonged_tension: {
    title: '空気の変化',
    message: '緊張した空気が続いています。一度深呼吸して場の空気を整えてみましょう',
    icon: '🍃',
  },
};

/**
 * 通知音を生成するユーティリティ
 * 
 * Web Audio APIを使用して、穏やかな通知音を生成する。
 * 介入時に使用され、ユーザーの注意を引くために使用される。
 * 
 * @param type - 通知音のタイプ（'gentle'、'chime'、'bell'）
 */
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

/**
 * InterventionSystemコンポーネント
 * 
 * 「一方的」や「沈黙」状態が続いた場合に、穏やかな通知音や画面上のヒントを
 * 表示して参加者に気づきを促すコンポーネント。
 * 
 * 機能:
 * - シーンの継続時間を監視
 * - 閾値を超えた場合に介入をトリガー
 * - クールダウン時間（30秒）で連続介入を防ぐ
 * - サウンド通知とビジュアルヒントの両方をサポート
 * 
 * @param props - コンポーネントのプロパティ
 * @param props.scene - 現在のシーン（静寂、調和、一方的、沈黙）
 * @param props.isActive - セッションがアクティブかどうか
 * @param props.settings - 介入設定（有効/無効、閾値、サウンド/ビジュアルヒントなど）
 * @param props.onIntervention - 介入が発生したときに呼ばれるコールバック（オプション）
 * @returns InterventionSystemコンポーネント
 */
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

  /**
   * シーン変更を検出する
   * 
   * シーンプロパティが変更された場合、シーンの開始時刻を更新する。
   * これにより、シーンの継続時間を正確に計測できる。
   */
  useEffect(() => {
    if (scene !== previousSceneRef.current) {
      sceneStartTimeRef.current = Date.now();
      previousSceneRef.current = scene;
    }
  }, [scene]);

  /**
   * 介入チェックを実行する
   * 
   * 1秒ごとにシーンの継続時間をチェックし、閾値を超えた場合に介入をトリガーする。
   * クールダウン時間（30秒）を考慮し、連続介入を防ぐ。
   */
  useEffect(() => {
    if (!isActive || !settings.enabled) return;

    const checkInterval = setInterval(() => {
      const now = Date.now();
      const sceneDuration = (now - sceneStartTimeRef.current) / 1000;
      const timeSinceLastIntervention = (now - lastInterventionRef.current) / 1000;

      // 最後の介入からクールダウン時間が経過していない場合はスキップ
      if (timeSinceLastIntervention < INTERVENTION_COOLDOWN_SEC) return;

      let interventionType: string | null = null;

      const adjustedDuration = sceneDuration + SCENE_ENTRY_DELAY_SEC;

      // 一方的状態のチェック
      if (scene === '一方的' && adjustedDuration >= settings.monologueThreshold) {
        interventionType = 'monologue';
      }
      // 沈黙状態のチェック
      else if (scene === '沈黙' && adjustedDuration >= settings.silenceThreshold) {
        interventionType = 'silence';
      }

      if (interventionType) {
        triggerIntervention(interventionType);
      }
    }, 1000);

    return () => clearInterval(checkInterval);
  }, [isActive, scene, settings]);

  /**
   * 介入をトリガーする
   * 
   * 指定されたタイプの介入を実行し、通知音を再生し、ビジュアルヒントを表示する。
   * 最後の介入時刻を記録し、コールバックを呼び出す。
   * 
   * @param type - 介入のタイプ（'monologue'、'silence'、'prolonged_tension'）
   */
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

  /**
   * 介入ヒントを閉じる
   * 
   * ユーザーが手動で介入ヒントを閉じた場合に呼ばれる。
   * アニメーションを考慮して、遅延を設けて状態をクリアする。
   */
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
                  このヒントは場の空気を改善するきっかけとしてお使いください
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
