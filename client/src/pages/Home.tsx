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
import { motion } from 'framer-motion';
import { WaveCanvas } from '@/components/WaveCanvas';
import { SecurityBarrier } from '@/components/SecurityBarrier';
import { SceneIndicator } from '@/components/SceneIndicator';
import { ControlPanel } from '@/components/ControlPanel';
import { ConversationLogPanel } from '@/components/ConversationLogPanel';
import { TranscriptDisplay } from '@/components/TranscriptDisplay';
import { SecurityDashboard } from '@/components/SecurityDashboard';
import { SessionHistory } from '@/components/SessionHistory';
import { AudioAnalyzer, type ConcordiaEvent } from '@/lib/audioAnalyzer';
import { ConversationLogManager, type SecurityMetrics, type LogEntry, type SessionSummary, type Session, analyzeSentiment } from '@/lib/conversationLog';
import { SpeechRecognitionManager, type SpeechRecognitionResult } from '@/lib/speechRecognition';
import type { SceneType } from '@/lib/waveEngine';
import { Button } from '@/components/ui/button';

interface TranscriptItem {
  id: string;
  text: string;
  isFinal: boolean;
  timestamp: number;
}

export default function Home() {
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
  const [isSessionHistoryOpen, setIsSessionHistoryOpen] = useState(false);
  const [securityMetrics, setSecurityMetrics] = useState<SecurityMetrics>({
    overallScore: 85,
    barrierStrength: 0.8,
    threatLevel: 0.1,
    protectionStatus: 'active',
    indicators: [
      { type: 'auth', status: 'active', label: '認証', description: 'ローカルモードで動作中' },
      { type: 'encryption', status: 'active', label: '暗号化', description: 'データはローカルに保存' },
      { type: 'privacy', status: 'active', label: 'プライバシー', description: '音声は外部送信されません' },
      { type: 'consent', status: 'active', label: '同意保護', description: '判断の自由を守っています' }
    ]
  });
  
  // Refs
  const audioAnalyzerRef = useRef<AudioAnalyzer | null>(null);
  const logManagerRef = useRef<ConversationLogManager | null>(null);
  const speechRecognitionRef = useRef<SpeechRecognitionManager | null>(null);
  const lastSceneRef = useRef<SceneType>('静寂');
  
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
        }
      },
      onEvent: (event) => {
        logManagerRef.current?.logEvent(event);
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
      onSecurityUpdate: (metrics) => setSecurityMetrics({ ...metrics })
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
  }, [isDemoMode]);
  
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
  }, [isDemoMode]);
  
  // イベントハンドラ
  const handleEvent = useCallback((event: ConcordiaEvent) => {
    console.log('Event detected:', event.type, event.metadata);
  }, []);
  
  // 録音開始
  const handleStartRecording = useCallback(async () => {
    try {
      setSessionSummary(null);
      setTranscripts([]);
      setInterimText('');
      
      logManagerRef.current?.startSession();
      await audioAnalyzerRef.current?.start();
      
      // 音声認識も開始
      if (speechRecognitionRef.current?.isSupported()) {
        speechRecognitionRef.current.start();
      }
      
      setIsRecording(true);
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  }, []);
  
  // 録音停止
  const handleStopRecording = useCallback(async () => {
    audioAnalyzerRef.current?.stop();
    speechRecognitionRef.current?.stop();
    setIsRecording(false);
    setInterimText('');
    
    const summary = await logManagerRef.current?.endSession();
    if (summary) {
      setSessionSummary(summary);
      setIsLogExpanded(true);
    }
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
      '沈黙': { barrierStrength: 0.6, threatLevel: 0.4, protectionStatus: 'warning' }
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
            status: newScene === '一方的' || newScene === '沈黙' ? 'warning' : 'active',
            description: newScene === '一方的' 
              ? '同調圧力が検出されています' 
              : newScene === '沈黙'
              ? '発言しにくい空気を検出'
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
    return logManagerRef.current?.getPastSessions() || [];
  }, []);
  
  // セッションの削除
  const handleDeleteSession = useCallback(async (id: string): Promise<void> => {
    await logManagerRef.current?.deleteSession(id);
  }, []);
  
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* 波のキャンバス（背景） */}
      <div className="absolute inset-0">
        <WaveCanvas scene={scene} energy={energy} />
      </div>
      
      {/* セキュリティバリア（結界） */}
      <SecurityBarrier metrics={securityMetrics} />
      
      {/* シーンインジケーター */}
      <SceneIndicator scene={scene} isRecording={isRecording} />
      
      {/* ナビゲーションボタン */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsSecurityDashboardOpen(true)}
          className="bg-card/60 backdrop-blur-sm text-xs"
        >
          <svg className="w-4 h-4 mr-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          セキュリティ詳細
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsSessionHistoryOpen(true)}
          className="bg-card/60 backdrop-blur-sm text-xs"
        >
          <svg className="w-4 h-4 mr-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          履歴
        </Button>
      </div>
      
      {/* タイトル */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="absolute top-1/4 left-1/2 -translate-x-1/2 text-center z-10"
      >
        <h1 className="text-3xl md:text-4xl font-serif-jp text-foreground/90 mb-2 tracking-wider">
          Concordia Shrine
        </h1>
        <p className="text-sm text-muted-foreground font-light">
          空気だけを聴き、判断の自由をそっと守る祠
        </p>
      </motion.div>
      
      {/* コンセプトメッセージ */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="absolute top-1/3 left-1/2 -translate-x-1/2 mt-8 text-center z-10 max-w-lg px-4"
      >
        <p className="text-xs text-muted-foreground/70 leading-relaxed">
          「ヒューマンセキュリティなくしてサイバーセキュリティは実現しない」
        </p>
        <p className="text-xs text-muted-foreground/50 mt-2">
          この聖域では、技術が人の心を守ります。
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
      
      {/* セッション履歴 */}
      <SessionHistory
        isOpen={isSessionHistoryOpen}
        onClose={() => setIsSessionHistoryOpen(false)}
        onLoadSessions={handleLoadSessions}
        onDeleteSession={handleDeleteSession}
      />
      
      {/* フッター */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="absolute bottom-4 left-1/2 -translate-x-1/2 text-center z-10"
      >
        <p className="text-[10px] text-muted-foreground/50">
          Concordia Shrine v2 — Human Decision Security
        </p>
      </motion.div>
    </div>
  );
}
