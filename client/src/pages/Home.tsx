/**
 * Concordia Wave - Home Page
 * 
 * 「ヒューマンセキュリティなくしてサイバーセキュリティは実現しない」を体現する
 * 対話の空気を可視化するメインページ
 * 
 * Design Philosophy: 神道的ミニマリズム
 * - 余白の神聖さ: 情報は最小限に、波のキャンバスを中心に
 * - 自然素材の質感: 水面の揺らぎ、和紙のような温かみ
 * - 見えない結界: セキュリティは画面端の光として表現
 * - 呼吸するリズム: すべてのアニメーションは呼吸に同期
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/_core/hooks/useAuth';
import { WaveCanvas } from '@/components/WaveCanvas';
import { WaveHintOverlay } from '@/components/WaveHintOverlay';
import { SecurityBarrier } from '@/features/security';
import { HomeFooter, HomeNavigation, HomePanels, HomeSceneUI, HomeTopUI } from '@/components/home';
import { AudioAnalyzer, type ConcordiaEvent } from '@/lib/audioAnalyzer';
import { ConversationLogManager, type SecurityMetrics, type LogEntry, type SessionSummary, type Session, analyzeSentiment } from '@/lib/conversationLog';
import { SpeechRecognitionManager, type SpeechRecognitionResult } from '@/lib/speechRecognition';
import { useSessionManager } from '@/hooks/useSessionManager';
import { useInterventionSettings } from '@/hooks/useInterventionSettings';
import { useIsMobile } from '@/hooks/useMobile';
import type { SceneType } from '@/lib/waveEngine';
import type { SessionData } from '@/lib/reportGenerator';
import type { TranscriptItem } from '@/types/transcript';
import { getLoginUrl } from '@/const';
import { useLocation } from 'wouter';
import { toast } from 'sonner';

const MAX_RECORDING_MS = 15 * 60 * 1000;
const GUEST_MODE_KEY = 'concordia-guest-mode';

export default function Home() {
  const [location, navigate] = useLocation();
  // 認証状態を取得
  const { user, isAuthenticated, logout } = useAuth();

  // モバイル判定
  const isMobile = useIsMobile();

  // セッション管理フック
  const sessionManager = useSessionManager();

  // 介入設定フック
  const { settings: interventionSettings, updateSettings: updateInterventionSettings } = useInterventionSettings();

  // 状態管理
  const [scene, setScene] = useState<SceneType>('静寂');
  const [energy, setEnergy] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [demoScene, setDemoScene] = useState<SceneType>('静寂');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [sessionSummary, setSessionSummary] = useState<SessionSummary | null>(null);
  const [isLogExpanded, setIsLogExpanded] = useState(false);
  const [transcripts, setTranscripts] = useState<TranscriptItem[]>([]);
  const [interimText, setInterimText] = useState('');
  const [isSecurityDashboardOpen, setIsSecurityDashboardOpen] = useState(false);
  const [isSecurityDetailOpen, setIsSecurityDetailOpen] = useState(false);
  const [isSessionHistoryOpen, setIsSessionHistoryOpen] = useState(false);
  const [isInterventionSettingsOpen, setIsInterventionSettingsOpen] = useState(false);
  const [isReportPanelOpen, setIsReportPanelOpen] = useState(false);
  const [reportSession, setReportSession] = useState<SessionData | null>(null);
  const [isGuestMode, setIsGuestMode] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(GUEST_MODE_KEY) === 'true';
  });
  const [audioInputDevices, setAudioInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioDeviceId, setSelectedAudioDeviceId] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('concordia-selected-mic') ?? '';
  });
  const [isMobileInfoOpen, setIsMobileInfoOpen] = useState(false);
  const [securityMetrics, setSecurityMetrics] = useState<SecurityMetrics>({
    overallScore: 85,
    barrierStrength: 0.8,
    threatLevel: 0.1,
    protectionStatus: 'active',
    indicators: [
      { type: 'auth', status: isAuthenticated ? 'active' : 'inactive', label: '認証', description: isAuthenticated ? `${user?.name || 'ユーザー'}としてログイン中` : 'ローカルモードで動作中' },
      { type: 'encryption', status: 'active', label: '暗号化', description: isAuthenticated ? 'データはサーバーに安全に保存' : 'データはローカルに保存' },
      { type: 'privacy', status: 'active', label: 'プライバシー', description: '音声は外部送信されません' },
      { type: 'consent', status: 'active', label: '同意保護', description: '判断の自由を守っています' }
    ]
  });

  // Refs
  const audioAnalyzerRef = useRef<AudioAnalyzer | null>(null);
  const logManagerRef = useRef<ConversationLogManager | null>(null);
  const speechRecognitionRef = useRef<SpeechRecognitionManager | null>(null);
  const lastSceneRef = useRef<SceneType | null>(null);
  const sessionStartTimeRef = useRef<number>(0);
  const recordingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speechStartRef = useRef<number | null>(null);
  const sessionManagerRef = useRef(sessionManager);
  const isDemoModeRef = useRef(isDemoMode);

  // ルートに応じてモーダルを切り替える
  useEffect(() => {
    const path = location.split('?')[0];
    setIsSecurityDashboardOpen(path === '/security');
    setIsSecurityDetailOpen(path === '/security-detail');
    setIsSessionHistoryOpen(path === '/history');
    setIsInterventionSettingsOpen(path === '/intervention-settings');
  }, [location]);

  // 認証状態が変わったらセキュリティメトリクスを更新
  useEffect(() => {
    setSecurityMetrics(prev => ({
      ...prev,
      indicators: prev.indicators.map(ind => {
        if (ind.type === 'auth') {
          return {
            ...ind,
            status: isAuthenticated ? 'active' : 'inactive',
            description: isAuthenticated ? `${user?.name || 'ユーザー'}としてログイン中` : 'ローカルモードで動作中'
          };
        }
        if (ind.type === 'encryption') {
          return {
            ...ind,
            description: isAuthenticated ? 'データはサーバーに安全に保存' : 'データはローカルに保存'
          };
        }
        return ind;
      })
    }));
  }, [isAuthenticated, user]);

  useEffect(() => {
    sessionManagerRef.current = sessionManager;
  }, [sessionManager]);

  useEffect(() => {
    isDemoModeRef.current = isDemoMode;
  }, [isDemoMode]);

  const loadAudioDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const inputs = devices.filter(device => device.kind === 'audioinput');
      setAudioInputDevices(inputs);

      if (inputs.length === 0) return;
      if (!selectedAudioDeviceId || !inputs.some(d => d.deviceId === selectedAudioDeviceId)) {
        const fallbackId = inputs[0].deviceId;
        setSelectedAudioDeviceId(fallbackId);
        localStorage.setItem('concordia-selected-mic', fallbackId);
      }
    } catch (error) {
      console.warn('Failed to enumerate audio devices:', error);
    }
  }, [selectedAudioDeviceId]);

  // 初期化
  useEffect(() => {
    // AudioAnalyzerの初期化
    audioAnalyzerRef.current = new AudioAnalyzer();
    audioAnalyzerRef.current.setCallbacks({
      onEnergyUpdate: (e) => setEnergy(e),
      onSceneChange: (s) => {
        if (!isDemoModeRef.current && (lastSceneRef.current === null || s !== lastSceneRef.current)) {
          lastSceneRef.current = s;
          setScene(s);
          logManagerRef.current?.logSceneChange(s);
          sessionManagerRef.current.logSceneChange(s);
        }
      },
      onEvent: (event) => {
        logManagerRef.current?.logEvent(event);
        sessionManagerRef.current.logEvent(event.type, event.metadata);
        handleEvent(event);
      },
      onSpeechChange: (isSpeech) => {
        const now = Date.now();
        if (isSpeech) {
          if (speechStartRef.current === null) {
            speechStartRef.current = now;
          }
          return;
        }

        if (speechStartRef.current !== null) {
          const duration = (now - speechStartRef.current) / 1000;
          speechStartRef.current = null;
          if (duration >= 0.2) {
            logManagerRef.current?.logSpeech('', duration);
          }
        }
      }
    });

    // LogManagerの初期化
    logManagerRef.current = new ConversationLogManager();
    logManagerRef.current.setCallbacks({
      onLogUpdate: (entries) => setLogs([...entries]),
      onSecurityUpdate: (metrics) => setSecurityMetrics(prev => ({
        ...prev,
        ...metrics,
        indicators: prev.indicators.map(ind => {
          const newInd = metrics.indicators.find(m => m.type === ind.type);
          return newInd ? { ...ind, ...newInd } : ind;
        })
      }))
    });

    // SpeechRecognitionの初期化
    speechRecognitionRef.current = new SpeechRecognitionManager();
    speechRecognitionRef.current.setCallbacks({
      onResult: handleSpeechResult,
      onError: (error) => console.warn('Speech recognition error:', error),
      onStart: () => console.log('Speech recognition started'),
      onEnd: () => console.log('Speech recognition ended')
    });

    return () => {
      audioAnalyzerRef.current?.stop();
      speechRecognitionRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    loadAudioDevices();
    if (!navigator.mediaDevices?.addEventListener) return;
    navigator.mediaDevices.addEventListener('devicechange', loadAudioDevices);
    return () => navigator.mediaDevices.removeEventListener('devicechange', loadAudioDevices);
  }, [loadAudioDevices]);

  // 音声認識結果のハンドラ
  const handleSpeechResult = useCallback((result: SpeechRecognitionResult) => {
    if (result.isFinal) {
      // 確定したテキスト
      const newTranscript: TranscriptItem = {
        id: `transcript_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        text: result.text,
        isFinal: true,
        timestamp: result.timestamp
      };

      setTranscripts(prev => [...prev, newTranscript]);
      setInterimText('');

      // ログに記録
      logManagerRef.current?.logSpeech(result.text);
      sessionManagerRef.current.logSpeech(result.text);

      // 感情分析によるシーン更新
      const sentiment = analyzeSentiment(result.text);
      if (sentiment && !isDemoModeRef.current) {
        setScene(sentiment);
        lastSceneRef.current = sentiment;
      }
    } else {
      // 暫定テキスト
      setInterimText(result.text);
    }
  }, []);

  // イベントハンドラ
  const handleEvent = useCallback((event: ConcordiaEvent) => {
    console.log('Event detected:', event.type, event.metadata);
  }, []);

  // 介入イベントのハンドラ
  const handleIntervention = useCallback((type: string) => {
    sessionManagerRef.current.logIntervention(type, { scene, timestamp: Date.now() });
  }, [scene]);

  // 録音停止
  const handleStopRecording = useCallback(async () => {
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
    }

    if (speechStartRef.current !== null) {
      const duration = (Date.now() - speechStartRef.current) / 1000;
      speechStartRef.current = null;
      if (duration >= 0.2) {
        logManagerRef.current?.logSpeech('', duration);
      }
    }

    audioAnalyzerRef.current?.stop();
    speechRecognitionRef.current?.stop();
    setIsRecording(false);
    setInterimText('');

    // ローカルのサマリーを取得
    const localSummary = await logManagerRef.current?.endSession();

    // バックエンドセッションを終了
    const backendSummary = await sessionManager.endSession();

    if (isAuthenticated) {
      if (!backendSummary) {
        toast.error('保存失敗しました');
      }

      if (localSummary) {
        const summary: SessionSummary = backendSummary
        ? {
            ...localSummary,
            securityScore: backendSummary.securityScore,
          }
          : localSummary;
        setSessionSummary(summary);
        setIsLogExpanded(true);
      } else if (backendSummary) {
        const summary: SessionSummary = {
            totalDuration: backendSummary.totalDuration,
            speechDuration: 0,
            silenceDuration: 0,
            securityScore: backendSummary.securityScore,
            sceneDistribution: (backendSummary.sceneDistribution || {}) as Record<SceneType, number>,
            eventCounts: backendSummary.eventCounts || {},
            insights: backendSummary.insights || [],
          };
      setSessionSummary(summary);
      setIsLogExpanded(true);
      }

      if (backendSummary) {
      setReportSession({
        sessionId: sessionManager.currentSessionId || `local_${Date.now()}`,
        startTime: sessionStartTimeRef.current,
        endTime: Date.now(),
        duration: backendSummary.totalDuration,
        securityScore: backendSummary.securityScore,
        sceneDistribution: backendSummary.sceneDistribution,
        eventCounts: backendSummary.eventCounts,
        insights: backendSummary.insights,
      });
      }
      return;
    }

    if (localSummary) {
      setSessionSummary(localSummary);
      setIsLogExpanded(true);
    }
  }, [isAuthenticated, sessionManager]);

  // 録音開始
  const handleStartRecording = useCallback(async () => {
    try {
      setSessionSummary(null);
      setTranscripts([]);
      setInterimText('');
      speechStartRef.current = null;
      lastSceneRef.current = null;

      // バックエンドセッションを開始
      await sessionManager.startSession();
      sessionStartTimeRef.current = Date.now();

      logManagerRef.current?.startSession();
      await audioAnalyzerRef.current?.start(selectedAudioDeviceId || undefined);
      await loadAudioDevices();

      // 音声認識も開始
      if (speechRecognitionRef.current?.isSupported()) {
        speechRecognitionRef.current.start();
      }

      setIsRecording(true);

      if (recordingTimeoutRef.current) {
        clearTimeout(recordingTimeoutRef.current);
      }
      recordingTimeoutRef.current = setTimeout(() => {
        toast.info('録音は15分までのため自動停止しました');
        void handleStopRecording();
      }, MAX_RECORDING_MS);
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  }, [handleStopRecording, isAuthenticated, sessionManager]);

  const handleSelectAudioDevice = useCallback((deviceId: string) => {
    setSelectedAudioDeviceId(deviceId);
    localStorage.setItem('concordia-selected-mic', deviceId);
  }, []);

  // デモモード切り替え
  const handleToggleDemoMode = useCallback(() => {
    setIsDemoMode(prev => !prev);
    if (!isDemoMode) {
      setDemoScene('静寂');
      setScene('静寂');
      lastSceneRef.current = '静寂';
    }
  }, [isDemoMode]);

  // デモシーン変更
  const handleDemoSceneChange = useCallback((newScene: SceneType) => {
    setDemoScene(newScene);
    setScene(newScene);
    lastSceneRef.current = newScene;

    // デモモード時のエネルギー設定
    const energyMap: Record<SceneType, number> = {
      '静寂': 0.3,
      '調和': 0.4,
      '一方的': 0.8,
      '沈黙': 0.2
    };
    setEnergy(energyMap[newScene]);

    // デモ用のセキュリティメトリクス更新
    const metricsMap: Record<SceneType, Partial<SecurityMetrics>> = {
      '静寂': { barrierStrength: 0.8, threatLevel: 0.1, protectionStatus: 'active' },
      '調和': { barrierStrength: 0.9, threatLevel: 0.05, protectionStatus: 'active' },
      '一方的': { barrierStrength: 0.5, threatLevel: 0.6, protectionStatus: 'warning' },
      '沈黙': { barrierStrength: 0.75, threatLevel: 0.2, protectionStatus: 'active' }
    };

    const newMetrics = metricsMap[newScene];
    setSecurityMetrics(prev => ({
      ...prev,
      ...newMetrics,
      overallScore: Math.round((newMetrics.barrierStrength! * 50 + (1 - newMetrics.threatLevel!) * 50)),
      indicators: prev.indicators.map(ind => {
        if (ind.type === 'consent') {
          return {
            ...ind,
            status: newScene === '一方的' ? 'warning' : 'active',
            description: newScene === '一方的'
              ? '同調圧力が検出されています'
              : newScene === '沈黙'
                ? '静かな余白を見守っています'
                : '判断の自由を守っています'
          };
        }
        return ind;
      })
    }));
  }, []);

  // ログパネルのトグル
  const handleToggleLog = useCallback(() => {
    setIsLogExpanded(prev => !prev);
  }, []);

  // セッション履歴の読み込み
  const handleLoadSessions = useCallback(async (): Promise<Session[]> => {
    const localSessions = await logManagerRef.current?.getPastSessions();
    const backendSessions = sessionManager.sessions.map(s => ({
      id: s.sessionId,
      startTime: s.startTime,
      endTime: s.endTime || undefined,
      entries: [], // バックエンドからはエントリは別途取得
      summary: s.duration ? {
        totalDuration: s.duration,
        speechDuration: 0,
        silenceDuration: 0,
        securityScore: s.securityScore || 0,
        sceneDistribution: (s.sceneDistribution || {}) as Record<SceneType, number>,
        eventCounts: s.eventCounts || {},
        insights: s.insights || [],
      } : undefined,
    }));

    const backendIds = new Set(backendSessions.map(session => session.id));
    const mergedLocal = (localSessions ?? []).filter(session => !backendIds.has(session.id));
    return [...backendSessions, ...mergedLocal];
  }, [sessionManager.sessions]);

  // セッションの削除
  const handleDeleteSession = useCallback(async (id: string): Promise<void> => {
    if (id.startsWith('session_') || id.startsWith('local_')) {
      await logManagerRef.current?.deleteSession(id);
      return;
    }
    await sessionManager.deleteSession(id);
  }, [sessionManager]);

  // レポートパネルを開く
  const handleOpenReport = useCallback((session?: SessionData) => {
    if (session) {
      setReportSession(session);
    }
    setIsReportPanelOpen(true);
  }, []);

  const handleEnableGuestMode = useCallback(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(GUEST_MODE_KEY, 'true');
    setIsGuestMode(true);
    toast.success('ゲストモードで利用できます');
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* 初回ヒントオーバーレイ */}
      <WaveHintOverlay />

      {/* 波のキャンバス（背景） */}
      <div className="absolute inset-0">
        <WaveCanvas scene={scene} energy={energy} />
      </div>

      {/* セキュリティバリア（結界） */}
      <SecurityBarrier metrics={securityMetrics} />

      <HomeSceneUI
        isMobile={isMobile}
        scene={scene}
        isRecording={isRecording}
        isDemoMode={isDemoMode}
        securityMetrics={securityMetrics}
        isMobileInfoOpen={isMobileInfoOpen}
        onToggleMobileInfo={() => setIsMobileInfoOpen(!isMobileInfoOpen)}
        interventionSettings={interventionSettings}
        onIntervention={handleIntervention}
      />

      <HomeNavigation
        isMobile={isMobile}
        isAuthenticated={isAuthenticated}
        isAdmin={Boolean(user?.role === 'admin')}
        hasReport={Boolean(reportSession)}
        onNavigate={navigate}
        onOpenReport={handleOpenReport}
      />

      <HomeTopUI
        isMobile={isMobile}
        isAuthenticated={isAuthenticated}
        user={user}
        isGuestMode={isGuestMode}
        hasReport={Boolean(reportSession)}
        onLogin={() => { window.location.href = getLoginUrl(); }}
        onLogout={() => logout()}
        onEnableGuestMode={handleEnableGuestMode}
        onNavigate={navigate}
        onOpenReport={handleOpenReport}
        />

      <HomePanels
        isRecording={isRecording}
        transcripts={transcripts}
        interimText={interimText}
        isDemoMode={isDemoMode}
        demoScene={demoScene}
        onStartRecording={handleStartRecording}
        onStopRecording={handleStopRecording}
        onToggleDemoMode={handleToggleDemoMode}
        onDemoSceneChange={handleDemoSceneChange}
        audioInputDevices={audioInputDevices}
        selectedAudioDeviceId={selectedAudioDeviceId}
        onSelectAudioDevice={handleSelectAudioDevice}
        logs={logs}
        sessionSummary={sessionSummary}
        isLogExpanded={isLogExpanded}
        onToggleLog={handleToggleLog}
        securityMetrics={securityMetrics}
        scene={scene}
        isSecurityDashboardOpen={isSecurityDashboardOpen}
        onCloseSecurityDashboard={() => {
          setIsSecurityDashboardOpen(false);
          navigate('/');
        }}
        isSecurityDetailOpen={isSecurityDetailOpen}
        onCloseSecurityDetail={() => {
          setIsSecurityDetailOpen(false);
          navigate('/');
        }}
        isSessionHistoryOpen={isSessionHistoryOpen}
        onCloseSessionHistory={() => {
          setIsSessionHistoryOpen(false);
          navigate('/');
        }}
        onLoadSessions={handleLoadSessions}
        onDeleteSession={handleDeleteSession}
        isInterventionSettingsOpen={isInterventionSettingsOpen}
        onCloseInterventionSettings={() => {
          setIsInterventionSettingsOpen(false);
          navigate('/');
        }}
        interventionSettings={interventionSettings}
        onUpdateSettings={updateInterventionSettings}
        isAuthenticated={isAuthenticated}
        isReportPanelOpen={isReportPanelOpen}
        onCloseReportPanel={() => setIsReportPanelOpen(false)}
        reportSession={reportSession}
      />

      <HomeFooter />
    </div>
  );
}
