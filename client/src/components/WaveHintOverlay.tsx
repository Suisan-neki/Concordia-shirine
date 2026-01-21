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

interface StepCopy {
  title: string;
  description: string;
}

interface WaveCardCopy {
  title: string;
  titleClassName: string;
  description: string;
  noteLines: string[];
  cardClassName: string;
}

interface IconCardCopy {
  title: string;
  description: string;
  icon: React.ReactNode;
}

const renderLines = (lines: string[], className: string) => (
  <p className={className}>
    {lines.map((line, index) => (
      <span key={`${line}-${index}`}>
        {line}
        {index < lines.length - 1 && <br />}
      </span>
    ))}
  </p>
);

const stepCopy = {
  wave: {
    title: '会話の状態を視覚化',
    description: '波の動きで対話のバランスを確認できます',
    introLines: [
      'この画面の波は、会話の状態を視覚化しています。',
      '対話のバランス（調和、一方的、沈黙、静寂）が波の色や動きとして表示されます。'
    ],
    cards: [
      {
        title: '調和',
        titleClassName: 'text-shrine-jade',
        description: 'バランスの良い対話が続いています',
        noteLines: ['この状態を保ちましょう。'],
        cardClassName: 'bg-shrine-jade/10 border-shrine-jade/20'
      },
      {
        title: '一方的',
        titleClassName: 'text-shrine-vermilion',
        description: '発言の偏りが検出されています',
        noteLines: ['他の参加者にも発言の機会を設けましょう。'],
        cardClassName: 'bg-shrine-vermilion/10 border-shrine-vermilion/20'
      },
      {
        title: '沈黙',
        titleClassName: 'text-shrine-wave-light',
        description: '静かな余白が続いています',
        noteLines: ['沈黙は自然な余白です。急がなくて大丈夫。', '場の空気をあたためていきましょう。'],
        cardClassName: 'bg-shrine-wave-light/10 border-shrine-wave-light/20'
      },
      {
        title: '静寂',
        titleClassName: 'text-foreground',
        description: '声と静けさが行き来しています',
        noteLines: ['会話が始まる準備ができています。'],
        cardClassName: 'bg-shrine-wave/10 border-shrine-wave/20'
      }
    ] satisfies WaveCardCopy[],
    hint: '左上のインジケーターで、現在の状態と改善のヒントを確認できます。'
  },
  recording: {
    title: '録音を開始する',
    description: '会話を記録して分析できます',
    introLines: [
      '画面下部のコントロールパネルから録音を開始できます。',
      '録音中は会話の状態がリアルタイムで分析され、波の動きとして表示されます。'
    ],
    cards: [
      {
        title: '録音開始ボタン',
        description: '録音を開始すると、音声認識と会話分析が自動的に始まります。最大15分まで録音できます。',
        icon: (
          <svg className="w-4 h-4 text-shrine-jade" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="12" r="6" />
          </svg>
        )
      },
      {
        title: 'デモモード',
        description: '実際に録音せずに、各シーンの見た目を確認できます。デモモード中は録音できません。',
        icon: (
          <svg className="w-4 h-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
        )
      }
    ] satisfies IconCardCopy[],
    hint: '録音中は、リアルタイムで文字起こしも表示されます。'
  },
  security: {
    title: '聖域の守護',
    description: 'あなたの判断の自由を守る結界',
    introLines: [
      '画面右上の「聖域の守護」パネルでは、セキュリティの状態を確認できます。',
      'このアプリケーションは、あなたの判断の自由を守るために、様々なセキュリティ機能をバックグラウンドで動作させています。'
    ],
    items: [
      {
        title: '認証',
        description: 'ログインすると、データはサーバーに安全に保存されます。',
        icon: (
          <svg className="w-4 h-4 text-shrine-jade" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        )
      },
      {
        title: '暗号化',
        description: 'データは用途に応じて強力に暗号化されます。',
        icon: (
          <svg className="w-4 h-4 text-shrine-jade" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        )
      },
      {
        title: 'プライバシー',
        description: '音声は可能な限りローカルで処理し、必要に応じて安全に扱います。',
        icon: (
          <svg className="w-4 h-4 text-shrine-jade" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )
      },
      {
        title: '同意保護',
        description: '同調圧力や一方的な発言を検知し、判断の自由を守ります。',
        icon: (
          <svg className="w-4 h-4 text-shrine-jade" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        )
      }
    ] satisfies IconCardCopy[],
    hint: 'ログインユーザーは「詳細」ボタンから、より詳しいセキュリティ情報を確認できます。'
  },
  features: {
    title: 'その他の機能',
    description: '便利な機能を活用しましょう',
    introLines: ['画面上部のナビゲーションボタンから、様々な機能にアクセスできます。'],
    cards: [
      {
        title: 'セキュリティ',
        description: 'セキュリティダッシュボードで、対話の状態とセキュリティの様子を確認できます。',
        icon: (
          <svg className="w-4 h-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        )
      },
      {
        title: '履歴',
        description: '過去のセッション履歴を確認し、対話の傾向を振り返ることができます。',
        icon: (
          <svg className="w-4 h-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        )
      },
      {
        title: '介入設定',
        description: '介入のタイミングや方法をカスタマイズできます。ログインが必要です。',
        icon: (
          <svg className="w-4 h-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        )
      },
      {
        title: 'レポート',
        description: 'セッション終了後、Markdown/HTML形式でレポートをダウンロードできます。',
        icon: (
          <svg className="w-4 h-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
        )
      }
    ] satisfies IconCardCopy[]
  },
  complete: {
    title: '準備完了です',
    description: 'それでは、対話の空気を可視化してみましょう',
    introLines: ['Concordia Waveの主要機能をご紹介しました。これで準備完了です。'],
    calloutTitle: '「ヒューマンセキュリティなくしてサイバーセキュリティは実現しない」',
    calloutLines: ['この祠はあなたの判断の自由を守るために、', '静かに、しかし確実に動き続けています。'],
    hints: [
      '録音を開始して、会話の状態をリアルタイムで確認できます',
      '「一方的」や「沈黙」が続くと、自動的に介入が行われます',
      'セッション終了後は、レポートをダウンロードして振り返りに活用できます'
    ]
  }
};

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
      title: stepCopy.wave.title,
      description: stepCopy.wave.description,
      content: (
        <div className="space-y-4">
          {renderLines(stepCopy.wave.introLines, 'text-sm text-foreground leading-relaxed')}
          <div className="grid grid-cols-2 gap-4 mt-4">
            {stepCopy.wave.cards.map((card) => (
              <div key={card.title} className={`p-3 rounded-lg border ${card.cardClassName}`}>
                <div className={`text-xs font-medium mb-1 ${card.titleClassName}`}>{card.title}</div>
                <p className="text-xs text-muted-foreground mb-2">{card.description}</p>
                {renderLines(card.noteLines, 'text-[10px] text-foreground font-medium')}
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground italic mt-4">{stepCopy.wave.hint}</p>
        </div>
      ),
      highlight: {
        position: 'top-left',
        element: 'シーンインジケーター'
      }
    },
    recording: {
      title: stepCopy.recording.title,
      description: stepCopy.recording.description,
      content: (
        <div className="space-y-4">
          {renderLines(stepCopy.recording.introLines, 'text-sm text-foreground leading-relaxed')}
          <div className="p-4 bg-muted/30 rounded-lg border border-border/50 space-y-3">
            {stepCopy.recording.cards.map((item, index) => (
              <div
                key={item.title}
                className={`flex items-start gap-3 ${index > 0 ? 'pt-3 border-t border-border/30' : ''}`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                    index === 0 ? 'bg-shrine-jade/20' : 'bg-muted/50'
                  }`}
                >
                  {item.icon}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-foreground mb-1">{item.title}</div>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground italic">{stepCopy.recording.hint}</p>
        </div>
      ),
      highlight: {
        position: 'bottom-center',
        element: 'コントロールパネル'
      }
    },
    security: {
      title: stepCopy.security.title,
      description: stepCopy.security.description,
      content: (
        <div className="space-y-4">
          {renderLines(stepCopy.security.introLines, 'text-sm text-foreground leading-relaxed')}
          <div className="p-4 bg-shrine-jade/10 rounded-lg border border-shrine-jade/20 space-y-3">
            {stepCopy.security.items.map((item) => (
              <div key={item.title} className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-shrine-jade/20 flex items-center justify-center shrink-0 mt-0.5">
                  {item.icon}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-foreground mb-1">{item.title}</div>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground italic">{stepCopy.security.hint}</p>
        </div>
      ),
      highlight: {
        position: 'top-right',
        element: '聖域の守護パネル'
      }
    },
    features: {
      title: stepCopy.features.title,
      description: stepCopy.features.description,
      content: (
        <div className="space-y-4">
          {renderLines(stepCopy.features.introLines, 'text-sm text-foreground leading-relaxed')}
          <div className="grid grid-cols-1 gap-3">
            {stepCopy.features.cards.map((card) => (
              <div key={card.title} className="p-3 bg-card border border-border/50 rounded-lg">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    {card.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground mb-1">{card.title}</div>
                    <p className="text-xs text-muted-foreground">{card.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ),
      highlight: {
        position: 'top-center',
        element: 'ナビゲーションボタン'
      }
    },
    complete: {
      title: stepCopy.complete.title,
      description: stepCopy.complete.description,
      content: (
        <div className="space-y-4">
          {renderLines(stepCopy.complete.introLines, 'text-sm text-foreground leading-relaxed')}
          <div className="p-4 bg-shrine-jade/10 rounded-lg border border-shrine-jade/20">
            <p className="text-sm text-foreground font-medium mb-2">{stepCopy.complete.calloutTitle}</p>
            {renderLines(stepCopy.complete.calloutLines, 'text-xs text-muted-foreground')}
          </div>
          <div className="space-y-2 text-xs text-muted-foreground">
            <p>💡 ヒント:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              {stepCopy.complete.hints.map((hint) => (
                <li key={hint}>{hint}</li>
              ))}
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
