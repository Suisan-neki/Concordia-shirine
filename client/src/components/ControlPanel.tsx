/**
 * Concordia Shrine - Control Panel Component
 * 
 * 録音開始/停止、デモモードなどのコントロール
 */

import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { SceneType } from '@/lib/waveEngine';

interface ControlPanelProps {
  isRecording: boolean;
  isDemoMode: boolean;
  demoScene: SceneType;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onToggleDemoMode: () => void;
  onDemoSceneChange: (scene: SceneType) => void;
  audioInputDevices?: MediaDeviceInfo[];
  selectedAudioDeviceId?: string;
  onSelectAudioDevice?: (deviceId: string) => void;
  className?: string;
}

export function ControlPanel({
  isRecording,
  isDemoMode,
  demoScene,
  onStartRecording,
  onStopRecording,
  onToggleDemoMode,
  onDemoSceneChange,
  audioInputDevices = [],
  selectedAudioDeviceId,
  onSelectAudioDevice,
  className = ''
}: ControlPanelProps) {
  const scenes: SceneType[] = ['静寂', '調和', '一方的', '沈黙'];
  const audioOptions = audioInputDevices.map((device, index) => {
    const trimmedId = device.deviceId?.trim() ?? "";
    return {
      value: trimmedId !== "" ? trimmedId : `default-${index}`,
      deviceId: device.deviceId,
      label: device.label || `マイク ${index + 1}`,
    };
  });
  const selectedAudioValue = audioOptions.find(
    option => option.deviceId === selectedAudioDeviceId
  )?.value;

  return (
    <div className={`fixed bottom-20 left-1/2 -translate-x-1/2 z-20 ${className}`}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-4"
      >
        <div className="flex items-center gap-4 w-full">
          {/* メインコントロール */}
          <div className="flex items-center justify-center gap-2 flex-1">
            {!isRecording ? (
              <Button
                onClick={onStartRecording}
                disabled={isDemoMode}
                className="bg-shrine-jade hover:bg-shrine-jade/90 text-white px-6"
              >
                <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="12" r="6" />
                </svg>
                録音開始
              </Button>
            ) : (
              <Button
                onClick={onStopRecording}
                variant="destructive"
                className="px-6"
              >
                <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
                録音停止
              </Button>
            )}
          </div>
          
          {/* デモモード切り替え */}
          <div className="border-l border-border/50 pl-4 flex-1 flex justify-center">
            <Button
              onClick={onToggleDemoMode}
              variant={isDemoMode ? 'secondary' : 'outline'}
              size="sm"
              disabled={isRecording}
            >
              {isDemoMode ? 'デモ終了' : 'デモモード'}
            </Button>
          </div>
        </div>

        {/* マイク入力選択 */}
        {audioOptions.length > 0 && onSelectAudioDevice && (
          <div className="mt-4 pt-4 border-t border-border/50">
            <div className="text-xs text-muted-foreground mb-2 text-center">
              マイク入力
            </div>
            <Select
              value={selectedAudioValue}
              onValueChange={(value) => {
                const selected = audioOptions.find(option => option.value === value);
                if (!selected) return;
                onSelectAudioDevice(selected.deviceId);
              }}
              disabled={isRecording}
            >
              <SelectTrigger size="sm" className="w-full">
                <SelectValue placeholder="マイクを選択" />
              </SelectTrigger>
              <SelectContent>
                {audioOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* デモモード時のシーン選択 */}
        {isDemoMode && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 pt-4 border-t border-border/50"
          >
            <div className="text-xs text-muted-foreground mb-2 text-center">
              シーンを選択
            </div>
            <div className="flex items-center gap-2 justify-center">
              {scenes.map((scene) => (
                <Button
                  key={scene}
                  onClick={() => onDemoSceneChange(scene)}
                  variant={demoScene === scene ? 'default' : 'outline'}
                  size="sm"
                  className={`text-xs ${
                    demoScene === scene
                      ? scene === '調和'
                        ? 'bg-shrine-jade hover:bg-shrine-jade/90'
                        : scene === '一方的'
                        ? 'bg-shrine-vermilion hover:bg-shrine-vermilion/90'
                        : scene === '沈黙'
                        ? 'bg-shrine-wave-light hover:bg-shrine-wave-light/90'
                        : ''
                      : ''
                  }`}
                >
                  {scene}
                </Button>
              ))}
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}

export default ControlPanel;
