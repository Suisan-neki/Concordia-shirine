import { ConversationLogPanel } from '@/components/ConversationLogPanel';
import { ControlPanel } from '@/components/ControlPanel';
import { InterventionSettingsPanel } from '@/components/InterventionSettingsPanel';
import { ReportDownloadPanel } from '@/components/ReportDownloadPanel';
import { SessionHistory } from '@/components/SessionHistory';
import { TranscriptDisplay } from '@/components/TranscriptDisplay';
import { SecurityDashboard, SecurityDetailPanel } from '@/features/security';
import type { SecurityMetrics, LogEntry, SessionSummary, Session } from '@/lib/conversationLog';
import type { SceneType } from '@/lib/waveEngine';
import type { SessionData } from '@/lib/reportGenerator';
import type { InterventionSettings } from '@/hooks/useInterventionSettings';
import type { TranscriptItem } from '@/types/transcript';

interface HomePanelsProps {
  isRecording: boolean;
  transcripts: TranscriptItem[];
  interimText: string;
  isDemoMode: boolean;
  demoScene: SceneType;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onToggleDemoMode: () => void;
  onDemoSceneChange: (scene: SceneType) => void;
  audioInputDevices: MediaDeviceInfo[];
  selectedAudioDeviceId?: string;
  onSelectAudioDevice: (deviceId: string) => void;
  logs: LogEntry[];
  sessionSummary: SessionSummary | null;
  isLogExpanded: boolean;
  onToggleLog: () => void;
  securityMetrics: SecurityMetrics;
  scene: SceneType;
  isSecurityDashboardOpen: boolean;
  onCloseSecurityDashboard: () => void;
  isSecurityDetailOpen: boolean;
  onCloseSecurityDetail: () => void;
  isSessionHistoryOpen: boolean;
  onCloseSessionHistory: () => void;
  onLoadSessions: () => Promise<Session[]>;
  onDeleteSession: (sessionId: string) => Promise<void>;
  isInterventionSettingsOpen: boolean;
  onCloseInterventionSettings: () => void;
  interventionSettings: InterventionSettings;
  onUpdateSettings: (settings: Partial<InterventionSettings>) => void;
  isAuthenticated: boolean;
  isReportPanelOpen: boolean;
  onCloseReportPanel: () => void;
  reportSession: SessionData | null;
}

export function HomePanels({
  isRecording,
  transcripts,
  interimText,
  isDemoMode,
  demoScene,
  onStartRecording,
  onStopRecording,
  onToggleDemoMode,
  onDemoSceneChange,
  audioInputDevices,
  selectedAudioDeviceId,
  onSelectAudioDevice,
  logs,
  sessionSummary,
  isLogExpanded,
  onToggleLog,
  securityMetrics,
  scene,
  isSecurityDashboardOpen,
  onCloseSecurityDashboard,
  isSecurityDetailOpen,
  onCloseSecurityDetail,
  isSessionHistoryOpen,
  onCloseSessionHistory,
  onLoadSessions,
  onDeleteSession,
  isInterventionSettingsOpen,
  onCloseInterventionSettings,
  interventionSettings,
  onUpdateSettings,
  isAuthenticated,
  isReportPanelOpen,
  onCloseReportPanel,
  reportSession,
}: HomePanelsProps) {
  return (
    <>
      {/* リアルタイム文字起こし表示 */}
      {isRecording && (
        <TranscriptDisplay
          transcripts={transcripts}
          interimText={interimText}
        />
      )}

      {/* コントロールパネル */}
      <ControlPanel
        isRecording={isRecording}
        isDemoMode={isDemoMode}
        demoScene={demoScene}
        onStartRecording={onStartRecording}
        onStopRecording={onStopRecording}
        onToggleDemoMode={onToggleDemoMode}
        onDemoSceneChange={onDemoSceneChange}
        audioInputDevices={audioInputDevices}
        selectedAudioDeviceId={selectedAudioDeviceId}
        onSelectAudioDevice={onSelectAudioDevice}
      />

      {/* 会話ログパネル */}
      <ConversationLogPanel
        logs={logs}
        summary={sessionSummary}
        isExpanded={isLogExpanded}
        onToggle={onToggleLog}
      />

      {/* セキュリティダッシュボード */}
      <SecurityDashboard
        metrics={securityMetrics}
        scene={scene}
        isOpen={isSecurityDashboardOpen}
        onClose={onCloseSecurityDashboard}
      />

      {/* セキュリティ詳細パネル */}
      <SecurityDetailPanel
        isOpen={isSecurityDetailOpen}
        onClose={onCloseSecurityDetail}
      />

      {/* セッション履歴 */}
      <SessionHistory
        isOpen={isSessionHistoryOpen}
        onClose={onCloseSessionHistory}
        onLoadSessions={onLoadSessions}
        onDeleteSession={onDeleteSession}
      />

      {/* 介入設定パネル */}
      <InterventionSettingsPanel
        isOpen={isInterventionSettingsOpen}
        onClose={onCloseInterventionSettings}
        settings={interventionSettings}
        onUpdateSettings={onUpdateSettings}
        isAuthenticated={isAuthenticated}
      />

      {/* レポートダウンロードパネル */}
      <ReportDownloadPanel
        isOpen={isReportPanelOpen}
        onClose={onCloseReportPanel}
        session={reportSession}
      />
    </>
  );
}
