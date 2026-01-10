/**
 * Concordia Shrine - Intervention Settings Panel
 * 
 * 介入機能の設定をカスタマイズするUI
 */

import { motion, AnimatePresence } from 'framer-motion';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import type { InterventionSettings } from '@/hooks/useInterventionSettings';

interface InterventionSettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  settings: InterventionSettings;
  onUpdateSettings: (settings: Partial<InterventionSettings>) => void;
  isAuthenticated: boolean;
}

export function InterventionSettingsPanel({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  isAuthenticated,
}: InterventionSettingsPanelProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* オーバーレイ */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          />
          
          {/* パネル */}
          <motion.div
            initial={{ opacity: 0, x: 300 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 300 }}
            transition={{ type: 'spring', damping: 25 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-card border-l border-border z-50 overflow-y-auto"
          >
            {/* ヘッダー */}
            <div className="sticky top-0 bg-card/95 backdrop-blur-sm border-b border-border p-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-medium text-foreground">介入設定</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  気づきを促すタイミングをカスタマイズ
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-muted rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-4 space-y-6">
              {/* 認証状態の警告 */}
              {!isAuthenticated && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                  <p className="text-xs text-amber-500">
                    ログインすると、設定がサーバーに保存され、複数デバイスで同期されます。
                  </p>
                </div>
              )}
              
              {/* 介入機能の有効/無効 */}
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">介入機能</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    場の空気に応じた気づきを表示
                  </p>
                </div>
                <Switch
                  checked={settings.enabled}
                  onCheckedChange={(checked) => onUpdateSettings({ enabled: checked })}
                />
              </div>
              
              <div className="h-px bg-border" />
              
              {/* 一方的状態の閾値 */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">一方的発言の検出</Label>
                  <span className="text-xs text-muted-foreground">
                    {settings.monologueThreshold}秒
                  </span>
                </div>
                <Slider
                  value={[settings.monologueThreshold]}
                  onValueChange={([value]) => onUpdateSettings({ monologueThreshold: value })}
                  min={10}
                  max={120}
                  step={5}
                  disabled={!settings.enabled}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  一方的な発言がこの時間続くと、バランスを促すヒントを表示します
                </p>
              </div>
              
              {/* 沈黙状態の閾値 */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">沈黙の検出</Label>
                  <span className="text-xs text-muted-foreground">
                    {settings.silenceThreshold}秒
                  </span>
                </div>
                <Slider
                  value={[settings.silenceThreshold]}
                  onValueChange={([value]) => onUpdateSettings({ silenceThreshold: value })}
                  min={5}
                  max={60}
                  step={5}
                  disabled={!settings.enabled}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  沈黙がこの時間続くと、発言しやすい雰囲気づくりのヒントを表示します
                </p>
              </div>
              
              <div className="h-px bg-border" />
              
              {/* 通知方法 */}
              <div className="space-y-4">
                <Label className="text-sm font-medium">通知方法</Label>
                
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-foreground">通知音</p>
                    <p className="text-xs text-muted-foreground">
                      穏やかな音で気づきを促す
                    </p>
                  </div>
                  <Switch
                    checked={settings.soundEnabled}
                    onCheckedChange={(checked) => onUpdateSettings({ soundEnabled: checked })}
                    disabled={!settings.enabled}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-foreground">視覚的ヒント</p>
                    <p className="text-xs text-muted-foreground">
                      画面上にメッセージを表示
                    </p>
                  </div>
                  <Switch
                    checked={settings.visualHintEnabled}
                    onCheckedChange={(checked) => onUpdateSettings({ visualHintEnabled: checked })}
                    disabled={!settings.enabled}
                  />
                </div>
              </div>
              
              <div className="h-px bg-border" />
              
              {/* 説明 */}
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-foreground mb-2">
                  介入機能について
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  この機能は、対話の「空気」を監視し、一方的な発言や沈黙が続いた場合に、
                  穏やかな方法で参加者に気づきを促します。
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed mt-2">
                  介入は強制ではなく、あくまで「気づき」のきっかけとして機能します。
                  最終的な判断は常に参加者自身に委ねられています。
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default InterventionSettingsPanel;
