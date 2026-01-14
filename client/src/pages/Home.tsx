/**
 * Concordia Shrine - Home Page
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
import { motion, AnimatePresence } from 'framer-motion';
import { WaveCanvas } from '@/components/WaveCanvas';
import { WaveHintOverlay } from '@/components/WaveHintOverlay';
import { SecurityBarrier } from '@/components/SecurityBarrier';
import { SceneIndicator, sceneConfigs } from '@/components/SceneIndicator';
import { ControlPanel } from '@/components/ControlPanel';
import { ConversationLogPanel } from '@/components/ConversationLogPanel';
import { TranscriptDisplay } from '@/components/TranscriptDisplay';
import { SecurityDashboard } from '@/components/SecurityDashboard';
import { SecurityDetailPanel } from '@/components/SecurityDetailPanel';
import { SessionHistory } from '@/components/SessionHistory';
import { InterventionSystem } from '@/components/InterventionSystem';
import { InterventionSettingsPanel } from '@/components/InterventionSettingsPanel';
import { ReportDownloadPanel } from '@/components/ReportDownloadPanel';
import { AudioAnalyzer, type ConcordiaEvent } from '@/lib/audioAnalyzer';
import { ConversationLogManager, type SecurityMetrics, type LogEntry, type SessionSummary, type Session, analyzeSentiment } from '@/lib/conversationLog';
import { SpeechRecognitionManager, type SpeechRecognitionResult } from '@/lib/speechRecognition';
import { useSessionManager } from '@/hooks/useSessionManager';
import { useInterventionSettings } from '@/hooks/useInterventionSettings';
import { useIsMobile } from '@/hooks/useMobile';
import type { SceneType } from '@/lib/waveEngine';
import type { SessionData } from '@/lib/reportGenerator';
import { Button } from '@/components/ui/button';
import { getLoginUrl } from '@/const';
import { Link, useLocation } from 'wouter';
import { toast } from 'sonner';

const MAX_RECORDING_MS = 15 * 60 * 1000;

interface TranscriptItem {
  id: string;
  text: string;
  isFinal: boolean;
  timestamp: number;
}

export default function Home() {
  const [, navigate] = useLocation();
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
  const lastSceneRef = useRef<SceneType>('静寂');
  const sessionStartTimeRef = useRef<number>(0);
  const recordingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // 初期化
  useEffect(() => {
    // AudioAnalyzerの初期化
    audioAnalyzerRef.current = new AudioAnalyzer();
    audioAnalyzerRef.current.setCallbacks({
      onEnergyUpdate: (e) => setEnergy(e),
      onSceneChange: (s) => {
        if (!isDemoMode && s !== lastSceneRef.current) {
          lastSceneRef.current = s;
          setScene(s);
          logManagerRef.current?.logSceneChange(s);
          sessionManager.logSceneChange(s);
        }
      },
      onEvent: (event) => {
        logManagerRef.current?.logEvent(event);
        sessionManager.logEvent(event.type, event.metadata);
        handleEvent(event);
      },
      onSpeechChange: () => {
        // 発話状態の変化
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
  }, [isDemoMode, sessionManager]);

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
      sessionManager.logSpeech(result.text);

      // 感情分析によるシーン更新
      const sentiment = analyzeSentiment(result.text);
      if (sentiment && !isDemoMode) {
        setScene(sentiment);
        lastSceneRef.current = sentiment;
      }
    } else {
      // 暫定テキスト
      setInterimText(result.text);
    }
  }, [isDemoMode, sessionManager]);

  // イベントハンドラ
  const handleEvent = useCallback((event: ConcordiaEvent) => {
    console.log('Event detected:', event.type, event.metadata);
  }, []);

  // 介入イベントのハンドラ
  const handleIntervention = useCallback((type: string) => {
    sessionManager.logIntervention(type, { scene, timestamp: Date.now() });
  }, [sessionManager, scene]);

  // 録音停止
  const handleStopRecording = useCallback(async () => {
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
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
        return;
      }

      const summary: SessionSummary = localSummary
        ? {
            ...localSummary,
            securityScore: backendSummary.securityScore,
          }
        : {
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

      // バックエンドセッションを開始
      await sessionManager.startSession();
      sessionStartTimeRef.current = Date.now();

      logManagerRef.current?.startSession();
      await audioAnalyzerRef.current?.start();

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

  // セッション履歴の読み込み（バックエンドから取得）
  const handleLoadSessions = useCallback(async (): Promise<Session[]> => {
    // バックエンドからのセッションをローカル形式に変換
    const backendSessions = sessionManager.sessions;
    return backendSessions.map(s => ({
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
  }, [sessionManager.sessions]);

  // セッションの削除
  const handleDeleteSession = useCallback(async (id: string): Promise<void> => {
    await sessionManager.deleteSession(id);
  }, [sessionManager]);

  // レポートパネルを開く
  const handleOpenReport = useCallback((session?: SessionData) => {
    if (session) {
      setReportSession(session);
    }
    setIsReportPanelOpen(true);
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

      {/* シーンインジケーター（PCのみ表示） */}
      {!isMobile && (
        <SceneIndicator scene={scene} isRecording={isRecording} />
      )}

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
                  onClick={() => setIsMobileInfoOpen(!isMobileInfoOpen)}
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
        onIntervention={handleIntervention}
      />

      {/* ナビゲーションボタン */}
      <div className={`fixed ${isMobile ? 'top-10' : 'top-4'} left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 sm:gap-2 flex-wrap justify-center max-w-[calc(100vw-1rem)] sm:max-w-none px-1 sm:px-0`}>
        {isAuthenticated && user?.role === 'admin' && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/admin')}
            className="bg-card/60 backdrop-blur-sm text-xs border-primary/30 hover:border-primary/50 px-2 sm:px-3"
          >
            <svg className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
            <span className="hidden sm:inline">管理者</span>
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsSecurityDashboardOpen(true)}
          className="bg-card/60 backdrop-blur-sm text-xs px-2 sm:px-3"
        >
          <svg className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <span className="hidden sm:inline">セキュリティ</span>
        </Button>
        {isAuthenticated && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsSecurityDetailOpen(true)}
            className="bg-card/60 backdrop-blur-sm text-xs border-primary/30 hover:border-primary/50 px-2 sm:px-3"
          >
            <svg className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
            <span className="hidden sm:inline">詳細</span>
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsSessionHistoryOpen(true)}
          className="bg-card/60 backdrop-blur-sm text-xs px-2 sm:px-3"
        >
          <svg className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span className="hidden sm:inline">履歴</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsInterventionSettingsOpen(true)}
          className="bg-card/60 backdrop-blur-sm text-xs px-2 sm:px-3"
        >
          <svg className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          <span className="hidden sm:inline">介入設定</span>
        </Button>
        {reportSession && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleOpenReport()}
            className="bg-card/60 backdrop-blur-sm text-xs px-2 sm:px-3"
          >
            <svg className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            <span className="hidden sm:inline">レポート</span>
          </Button>
        )}
      </div>

      {/* ログイン/ログアウトボタン */}
      <div className={`fixed ${isMobile ? 'top-2' : 'top-4'} right-2 sm:right-4 z-30`}>
        {isAuthenticated ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground bg-card/60 backdrop-blur-sm px-1.5 sm:px-2 py-1 rounded">
              <span className="hidden sm:inline">{user?.name || 'ユーザー'}</span>
              <span className="sm:hidden">{user?.name?.charAt(0) || 'U'}</span>
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => logout()}
              className="bg-card/60 backdrop-blur-sm text-xs px-2 sm:px-3"
            >
              <svg className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span className="hidden sm:inline">ログアウト</span>
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.href = getLoginUrl()}
            className="bg-card/60 backdrop-blur-sm text-xs px-2 sm:px-3"
          >
            <svg className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
              <polyline points="10 17 15 12 10 7" />
              <line x1="15" y1="12" x2="3" y2="12" />
            </svg>
            <span className="hidden sm:inline">ログイン</span>
          </Button>
        )}
      </div>

      {/* タイトル */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className={`absolute ${isMobile ? 'top-32' : 'top-1/4'} left-1/2 -translate-x-1/2 text-center z-10 px-4 w-full max-w-2xl`}
      >
        <h1 className={`${isMobile ? 'text-2xl' : 'text-3xl md:text-4xl'} font-serif-jp text-foreground/90 mb-2 tracking-wider`}>
          Concordia Shrine
        </h1>
        <p className={`${isMobile ? 'text-xs' : 'text-sm'} text-muted-foreground font-light`}>
          空気だけを聴き、判断の自由をそっと守る祠
        </p>
      </motion.div>

      {/* コンセプトメッセージ */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className={`absolute ${isMobile ? 'top-44' : 'top-1/3'} left-1/2 -translate-x-1/2 ${isMobile ? 'mt-4' : 'mt-8'} text-center z-10 max-w-lg px-4`}
      >
        <p className={`${isMobile ? 'text-[10px]' : 'text-xs'} text-muted-foreground/70 leading-relaxed`}>
          「ヒューマンセキュリティなくして
          <br />
          サイバーセキュリティは実現しない」
        </p>
        <p className={`${isMobile ? 'text-[10px]' : 'text-xs'} text-muted-foreground/50 mt-2`}>
          この聖域では技術が人の心を守ります。
          <br />
          結界が展開され、あなたの判断の自由が守られています。
        </p>
      </motion.div>

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
        onStartRecording={handleStartRecording}
        onStopRecording={handleStopRecording}
        onToggleDemoMode={handleToggleDemoMode}
        onDemoSceneChange={handleDemoSceneChange}
      />

      {/* 会話ログパネル */}
      <ConversationLogPanel
        logs={logs}
        summary={sessionSummary}
        isExpanded={isLogExpanded}
        onToggle={handleToggleLog}
      />

      {/* セキュリティダッシュボード */}
      <SecurityDashboard
        metrics={securityMetrics}
        scene={scene}
        isOpen={isSecurityDashboardOpen}
        onClose={() => setIsSecurityDashboardOpen(false)}
      />

      {/* セキュリティ詳細パネル（「実は裏で動いていました」） */}
      <SecurityDetailPanel
        isOpen={isSecurityDetailOpen}
        onClose={() => setIsSecurityDetailOpen(false)}
      />

      {/* セッション履歴 */}
      <SessionHistory
        isOpen={isSessionHistoryOpen}
        onClose={() => setIsSessionHistoryOpen(false)}
        onLoadSessions={handleLoadSessions}
        onDeleteSession={handleDeleteSession}
      />

      {/* 介入設定パネル */}
      <InterventionSettingsPanel
        isOpen={isInterventionSettingsOpen}
        onClose={() => setIsInterventionSettingsOpen(false)}
        settings={interventionSettings}
        onUpdateSettings={updateInterventionSettings}
        isAuthenticated={isAuthenticated}
      />

      {/* レポートダウンロードパネル */}
      <ReportDownloadPanel
        isOpen={isReportPanelOpen}
        onClose={() => setIsReportPanelOpen(false)}
        session={reportSession}
      />

      {/* フッター */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="absolute bottom-4 left-1/2 -translate-x-1/2 text-center z-10"
      >
        <Link href="/about">
          <span className="text-[10px] text-muted-foreground/50 hover:text-muted-foreground cursor-pointer transition-colors">
            Concordia Shrine — Human Decision Security
          </span>
        </Link>
      </motion.div>
    </div>
  );
}
