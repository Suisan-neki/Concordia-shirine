import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { InterventionSystem } from '@/components/InterventionSystem';
import { SceneIndicator, sceneConfigs } from '@/components/SceneIndicator';
import type { SecurityMetrics } from '@/lib/conversationLog';
import type { SceneType } from '@/lib/waveEngine';
import type { InterventionSettings } from '@/hooks/useInterventionSettings';

interface HomeSceneUIProps {
  isMobile: boolean;
  scene: SceneType;
  isRecording: boolean;
  isDemoMode: boolean;
  securityMetrics: SecurityMetrics;
  isMobileInfoOpen: boolean;
  onToggleMobileInfo: () => void;
  interventionSettings: InterventionSettings;
  onIntervention?: (type: string) => void;
}

export function HomeSceneUI({
  isMobile,
  scene,
  isRecording,
  isDemoMode,
  securityMetrics,
  isMobileInfoOpen,
  onToggleMobileInfo,
  interventionSettings,
  onIntervention,
}: HomeSceneUIProps) {
  const detailsId = 'mobile-info-details';

  return (
    <>
      {/* シーンインジケーター（PCのみ表示） */}
      {!isMobile && <SceneIndicator scene={scene} isRecording={isRecording} />}

      {/* スマホ用情報パネル */}
      {isMobile && (
        <div className="fixed top-12 left-2 right-2 z-20">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card/90 backdrop-blur-sm border border-border/50 rounded-lg p-3"
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <span className={`text-base sm:text-lg ${sceneConfigs[scene].color} shrink-0`}>
                  {sceneConfigs[scene].icon}
                </span>
                <span className={`text-sm sm:text-base font-serif-jp ${sceneConfigs[scene].color} truncate`}>
                  {scene}
                </span>
                {isRecording && (
                  <motion.div
                    animate={{ opacity: [1, 0.5, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="flex items-center gap-1 shrink-0"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-shrine-vermilion" />
                    <span className="text-[9px] sm:text-[10px] text-shrine-vermilion hidden sm:inline">録音中</span>
                  </motion.div>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[10px] sm:text-xs text-muted-foreground whitespace-nowrap">
                  スコア: {securityMetrics.overallScore}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onToggleMobileInfo}
                  aria-label="シーン詳細を切り替え"
                  aria-expanded={isMobileInfoOpen}
                  aria-controls={detailsId}
                  className="h-6 w-6 p-0 shrink-0"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    {isMobileInfoOpen ? (
                      <path d="M18 6L6 18M6 6l12 12" />
                    ) : (
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    )}
                  </svg>
                </Button>
              </div>
            </div>
            {/* シーンの説明文（常に表示） */}
            <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
              {sceneConfigs[scene].description}
            </p>
            <AnimatePresence>
              {isMobileInfoOpen && (
                <motion.div
                  key="mobile-info-details"
                  id={detailsId}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-3 pt-3 border-t border-border/30 space-y-2"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">結界強度</span>
                    <span>{Math.round(securityMetrics.barrierStrength * 100)}%</span>
                  </div>
                  <div className="h-1 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-shrine-jade rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${securityMetrics.barrierStrength * 100}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      )}

      {/* 介入システム */}
      <InterventionSystem
        scene={scene}
        isActive={isRecording || isDemoMode}
        settings={interventionSettings}
        onIntervention={onIntervention}
      />
    </>
  );
}
