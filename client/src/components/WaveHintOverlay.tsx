/**
 * Wave Hint Overlay Component
 * 
 * 初回訪問時に主要機能を段階的に案内するオンボーディングフロー
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';

const STORAGE_KEY = 'concordia-shine-wave-hint-dismissed';

interface WaveHintOverlayProps {
  onDismiss?: () => void;
}

type OnboardingStep = 'wave' | 'recording' | 'security' | 'features' | 'complete';

interface StepContent {
  title: string;
  description: string;
  content: React.ReactNode;
  highlight?: {
    position: 'top-left' | 'top-center' | 'top-right' | 'bottom-center' | 'right';
    element: string;
  };
}

export function WaveHintOverlay({ onDismiss }: WaveHintOverlayProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('wave');

  useEffect(() => {
    // 初回訪問かどうかをチェック
    const hasSeenHint = localStorage.getItem(STORAGE_KEY) === 'true';
    if (!hasSeenHint) {
      setIsVisible(true);
    }
  }, []);

  const handleNext = () => {
    const steps: OnboardingStep[] = ['wave', 'recording', 'security', 'features', 'complete'];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1]);
    } else {
      handleDismiss();
    }
  };

  const handleSkip = () => {
    handleDismiss();
  };

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setIsVisible(false);
    onDismiss?.();
  };

  const stepContents: Record<OnboardingStep, StepContent> = {
    wave: {
      title: '会話の状態を視覚化',
      description: '波の動きで対話のバランスを確認できます',
      content: (
        <div className="space-y-4">
          <p className="text-sm text-foreground leading-relaxed">
            この画面の波は、会話の状態を視覚化しています。
            <br />
            対話のバランス（調和、一方的、沈黙、静寂）が波の色や動きとして表示されます。
          </p>

          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="p-3 bg-shrine-jade/10 rounded-lg border border-shrine-jade/20">
              <div className="text-xs font-medium text-shrine-jade mb-1">調和</div>
              <p className="text-xs text-muted-foreground mb-2">バランスの良い対話が続いています</p>
              <p className="text-[10px] text-foreground font-medium">この状態を保ちましょう。</p>
            </div>
            <div className="p-3 bg-shrine-vermilion/10 rounded-lg border border-shrine-vermilion/20">
              <div className="text-xs font-medium text-shrine-vermilion mb-1">一方的</div>
              <p className="text-xs text-muted-foreground mb-2">発言の偏りが検出されています</p>
              <p className="text-[10px] text-foreground font-medium">他の参加者にも発言の機会を設けましょう。</p>
            </div>
            <div className="p-3 bg-shrine-wave-light/10 rounded-lg border border-shrine-wave-light/20">
              <div className="text-xs font-medium text-shrine-wave-light mb-1">沈黙</div>
              <p className="text-xs text-muted-foreground mb-2">静かな余白が続いています</p>
              <p className="text-[10px] text-foreground font-medium">
                沈黙は自然な余白です。急がなくて大丈夫。
                <br />
                場の空気をあたためていきましょう。
              </p>
            </div>
            <div className="p-3 bg-shrine-wave/10 rounded-lg border border-shrine-wave/20">
              <div className="text-xs font-medium text-foreground mb-1">静寂</div>
              <p className="text-xs text-muted-foreground mb-2">声と静けさが行き来しています</p>
              <p className="text-[10px] text-foreground font-medium">会話が始まる準備ができています。</p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground italic mt-4">
            左上のインジケーターで、現在の状態と改善のヒントを確認できます。
          </p>
        </div>
      ),
      highlight: {
        position: 'top-left',
        element: 'シーンインジケーター'
      }
    },
    recording: {
      title: '録音を開始する',
      description: '会話を記録して分析できます',
      content: (
        <div className="space-y-4">
          <p className="text-sm text-foreground leading-relaxed">
            画面下部のコントロールパネルから録音を開始できます。録音中は会話の状態がリアルタイムで分析され、波の動きとして表示されます。
          </p>

          <div className="p-4 bg-muted/30 rounded-lg border border-border/50 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-shrine-jade/20 flex items-center justify-center shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-shrine-jade" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="12" r="6" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-foreground mb-1">録音開始ボタン</div>
                <p className="text-xs text-muted-foreground">
                  録音を開始すると、音声認識と会話分析が自動的に始まります。最大15分まで録音できます。
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 pt-3 border-t border-border/30">
              <div className="w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-foreground mb-1">デモモード</div>
                <p className="text-xs text-muted-foreground">
                  実際に録音せずに、各シーンの見た目を確認できます。デモモード中は録音できません。
                </p>
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground italic">
            録音中は、リアルタイムで文字起こしも表示されます。
          </p>
        </div>
      ),
      highlight: {
        position: 'bottom-center',
        element: 'コントロールパネル'
      }
    },
    security: {
      title: '聖域の守護',
      description: 'あなたの判断の自由を守る結界',
      content: (
        <div className="space-y-4">
          <p className="text-sm text-foreground leading-relaxed">
            画面右上の「聖域の守護」パネルでは、セキュリティの状態を確認できます。このアプリケーションは、あなたの判断の自由を守るために、様々なセキュリティ機能をバックグラウンドで動作させています。
          </p>

          <div className="p-4 bg-shrine-jade/10 rounded-lg border border-shrine-jade/20 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-shrine-jade/20 flex items-center justify-center shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-shrine-jade" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-foreground mb-1">認証</div>
                <p className="text-xs text-muted-foreground">
                  ログインすると、データはサーバーに安全に保存されます。
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-shrine-jade/20 flex items-center justify-center shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-shrine-jade" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-foreground mb-1">暗号化</div>
                <p className="text-xs text-muted-foreground">
                  すべてのデータはAES-256-GCMで暗号化されています。
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-shrine-jade/20 flex items-center justify-center shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-shrine-jade" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-foreground mb-1">プライバシー</div>
                <p className="text-xs text-muted-foreground">
                  音声データは外部に送信されません。すべてローカルで処理されます。
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-shrine-jade/20 flex items-center justify-center shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-shrine-jade" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-foreground mb-1">同意保護</div>
                <p className="text-xs text-muted-foreground">
                  同調圧力や一方的な発言を検知し、判断の自由を守ります。
                </p>
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground italic">
            ログインユーザーは「詳細」ボタンから、より詳しいセキュリティ情報を確認できます。
          </p>
        </div>
      ),
      highlight: {
        position: 'top-right',
        element: '聖域の守護パネル'
      }
    },
    features: {
      title: 'その他の機能',
      description: '便利な機能を活用しましょう',
      content: (
        <div className="space-y-4">
          <p className="text-sm text-foreground leading-relaxed">
            画面上部のナビゲーションボタンから、様々な機能にアクセスできます。
          </p>

          <div className="grid grid-cols-1 gap-3">
            <div className="p-3 bg-card border border-border/50 rounded-lg">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground mb-1">セキュリティ</div>
                  <p className="text-xs text-muted-foreground">
                    セキュリティダッシュボードで、AI時代の脅威対策やWebアプリケーションのセキュリティ対策の詳細を確認できます。
                  </p>
                </div>
              </div>
            </div>

            <div className="p-3 bg-card border border-border/50 rounded-lg">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground mb-1">履歴</div>
                  <p className="text-xs text-muted-foreground">
                    過去のセッション履歴を確認し、対話の傾向を振り返ることができます。
                  </p>
                </div>
              </div>
            </div>

            <div className="p-3 bg-card border border-border/50 rounded-lg">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground mb-1">介入設定</div>
                  <p className="text-xs text-muted-foreground">
                    介入のタイミングや方法をカスタマイズできます。ログインが必要です。
                  </p>
                </div>
              </div>
            </div>

            <div className="p-3 bg-card border border-border/50 rounded-lg">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground mb-1">レポート</div>
                  <p className="text-xs text-muted-foreground">
                    セッション終了後、Markdown/HTML形式でレポートをダウンロードできます。
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ),
      highlight: {
        position: 'top-center',
        element: 'ナビゲーションボタン'
      }
    },
    complete: {
      title: '準備完了です',
      description: 'それでは、対話の空気を可視化してみましょう',
      content: (
        <div className="space-y-4">
          <p className="text-sm text-foreground leading-relaxed">
            Concordia Shrineの主要機能をご紹介しました。これで準備完了です。
          </p>

          <div className="p-4 bg-shrine-jade/10 rounded-lg border border-shrine-jade/20">
            <p className="text-sm text-foreground font-medium mb-2">
              「ヒューマンセキュリティなくしてサイバーセキュリティは実現しない」
            </p>
            <p className="text-xs text-muted-foreground">
              この祠はあなたの判断の自由を守るために、
              <br />
              静かに、しかし確実に動き続けています。
            </p>
          </div>

          <div className="space-y-2 text-xs text-muted-foreground">
            <p>💡 ヒント:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>録音を開始して、会話の状態をリアルタイムで確認できます</li>
              <li>「一方的」や「沈黙」が続くと、自動的に介入が行われます</li>
              <li>セッション終了後は、レポートをダウンロードして振り返りに活用できます</li>
            </ul>
          </div>
        </div>
      )
    }
  };

  const currentContent = stepContents[currentStep];
  const stepIndex = ['wave', 'recording', 'security', 'features', 'complete'].indexOf(currentStep);
  const totalSteps = 5;

  return (
    <AnimatePresence>
      {isVisible && (
        <>
          {/* オーバーレイ背景 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleSkip}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
          />
          
          {/* ヒントカード */}
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25 }}
            className="fixed inset-4 md:inset-16 lg:inset-32 z-50 pointer-events-none"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-card border border-border rounded-xl shadow-lg p-6 md:p-8 max-w-2xl mx-auto pointer-events-auto max-h-[90vh] overflow-y-auto">
              {/* ヘッダー */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h2 className="text-xl font-serif-jp text-foreground">
                      {currentContent.title}
                    </h2>
                    {currentStep !== 'complete' && (
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                        {stepIndex + 1} / {totalSteps}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {currentContent.description}
                  </p>
                </div>
                <button
                  onClick={handleSkip}
                  className="p-1 hover:bg-muted rounded-lg transition-colors shrink-0 ml-2"
                  aria-label="スキップ"
                >
                  <svg className="w-5 h-5 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* コンテンツ */}
              <div className="mb-6">
                {currentContent.content}
              </div>

              {/* プログレスバー */}
              {currentStep !== 'complete' && (
                <div className="mb-6">
                  <div className="h-1 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-primary rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${((stepIndex + 1) / totalSteps) * 100}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                </div>
              )}

              {/* アクション */}
              <div className="flex items-center justify-between gap-3">
                {currentStep !== 'wave' ? (
                  <Button
                    onClick={() => {
                      const steps: OnboardingStep[] = ['wave', 'recording', 'security', 'features', 'complete'];
                      const currentIndex = steps.indexOf(currentStep);
                      if (currentIndex > 0) {
                        setCurrentStep(steps[currentIndex - 1]);
                      }
                    }}
                    variant="outline"
                    size="sm"
                  >
                    戻る
                  </Button>
                ) : (
                  <div />
                )}
                <div className="flex items-center gap-2">
                  {currentStep !== 'complete' && (
                    <Button
                      onClick={handleSkip}
                      variant="ghost"
                      size="sm"
                    >
                      スキップ
                    </Button>
                  )}
                  <Button
                    onClick={currentStep === 'complete' ? handleDismiss : handleNext}
                    size="sm"
                  >
                    {currentStep === 'complete' ? '始める' : '次へ'}
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default WaveHintOverlay;
