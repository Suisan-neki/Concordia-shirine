/**
 * Concordia Shrine - Session Manager Hook
 * 
 * バックエンドAPIと連携してセッションデータを管理するカスタムフック
 */

import { useCallback, useRef, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import type { SceneType } from '@/lib/waveEngine';

export interface SessionSummary {
  totalDuration: number;
  securityScore: number;
  sceneDistribution: Record<string, number>;
  eventCounts: Record<string, number>;
  insights: string[];
}

export interface LogEntry {
  type: 'scene_change' | 'speech' | 'event' | 'intervention';
  timestamp: number;
  content?: string;
  metadata?: Record<string, unknown>;
}

/**
 * セッション管理フック
 * 
 * バックエンドAPIと連携してセッションデータを管理するReactカスタムフック。
 * セッションの開始、終了、ログエントリの追加、セッション一覧の取得などの機能を提供する。
 * 
 * 機能:
 * - セッションの開始・終了
 * - シーン変更、発話、イベント、介入のログ記録
 * - セッション一覧の取得・削除
 * - 認証状態に応じたローカル/サーバーモードの切り替え
 * 
 * @returns セッション管理の状態とアクション（currentSessionId、isActive、sessions、startSession、endSessionなど）
 */
export function useSessionManager() {
  const { isAuthenticated } = useAuth();
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);
  const startTimeRef = useRef<number>(0);
  const logsRef = useRef<LogEntry[]>([]);
  const sceneCountsRef = useRef<Record<string, number>>({
    '静寂': 0,
    '調和': 0,
    '一方的': 0,
    '沈黙': 0,
  });
  const eventCountsRef = useRef<Record<string, number>>({});

  // tRPC mutations
  const startMutation = trpc.session.start.useMutation();
  const endMutation = trpc.session.end.useMutation();
  const addLogMutation = trpc.session.addLog.useMutation();
  const sessionsQuery = trpc.session.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const deleteMutation = trpc.session.delete.useMutation();

  /**
   * セッションを開始
   */
  const startSession = useCallback(async () => {
    if (!isAuthenticated) {
      // 未認証の場合はローカルモードで動作
      const localSessionId = `local_${Date.now()}`;
      setCurrentSessionId(localSessionId);
      startTimeRef.current = Date.now();
      logsRef.current = [];
      sceneCountsRef.current = { '静寂': 0, '調和': 0, '一方的': 0, '沈黙': 0 };
      eventCountsRef.current = {};
      setIsActive(true);
      return localSessionId;
    }

    try {
      const result = await startMutation.mutateAsync();
      setCurrentSessionId(result.sessionId);
      startTimeRef.current = result.startTime;
      logsRef.current = [];
      sceneCountsRef.current = { '静寂': 0, '調和': 0, '一方的': 0, '沈黙': 0 };
      eventCountsRef.current = {};
      setIsActive(true);
      return result.sessionId;
    } catch (error) {
      console.error('Failed to start session:', error);
      // フォールバック: ローカルモード
      const localSessionId = `local_${Date.now()}`;
      setCurrentSessionId(localSessionId);
      startTimeRef.current = Date.now();
      setIsActive(true);
      return localSessionId;
    }
  }, [isAuthenticated, startMutation]);

  /**
   * セッションを終了
   */
  const endSession = useCallback(async (): Promise<SessionSummary | null> => {
    if (!currentSessionId || !isActive) return null;

    const endTime = Date.now();
    const duration = endTime - startTimeRef.current;
    
    const totalScenes = Object.values(sceneCountsRef.current).reduce((a, b) => a + b, 0);
    const harmonyRatio = totalScenes > 0 ? (sceneCountsRef.current['調和'] || 0) / totalScenes : 0;
    const silenceRatio = totalScenes > 0 ? (sceneCountsRef.current['静寂'] || 0) / totalScenes : 0;
    const oneSidedRatio = totalScenes > 0 ? (sceneCountsRef.current['一方的'] || 0) / totalScenes : 0;
    
    // インサイトを生成
    const insights: string[] = [];
    if (harmonyRatio > 0.5) {
      insights.push('対話は全体的に調和が取れていました。');
    }
    if (oneSidedRatio > 0.3) {
      insights.push('一方的な発言が多い傾向がありました。発言機会の均等化を意識してみてください。');
    }
    if (sceneCountsRef.current['沈黙'] > 5) {
      insights.push('沈黙が多く検出されました。沈黙は自然な余白です。急がず、場をあたためる時間として話しやすさを支えてみてください。');
    }

    const sceneDistribution = { ...sceneCountsRef.current };
    const eventCounts = { ...eventCountsRef.current };

    let summary: SessionSummary | null = null;

    // 認証済みの場合はサーバーに保存
    if (isAuthenticated && !currentSessionId.startsWith('local_')) {
      try {
        const result = await endMutation.mutateAsync({
          sessionId: currentSessionId,
          endTime,
          duration,
          sceneDistribution,
          eventCounts,
          insights,
        });
        if (typeof result.securityScore !== 'number') {
          throw new Error('Missing security score from server response');
        }
        summary = {
          totalDuration: duration,
          securityScore: result.securityScore,
          sceneDistribution,
          eventCounts,
          insights,
        };
        
        // セッション一覧を更新
        sessionsQuery.refetch();
      } catch (error) {
        console.error('Failed to save session:', error);
      }
    } else {
      const securityScore = Math.round(
        (harmonyRatio * 0.4 + silenceRatio * 0.3 + (1 - oneSidedRatio) * 0.3) * 100
      );
      summary = {
        totalDuration: duration,
        securityScore,
        sceneDistribution,
        eventCounts,
        insights,
      };
    }

    setCurrentSessionId(null);
    setIsActive(false);
    return summary;
  }, [currentSessionId, isActive, isAuthenticated, endMutation, sessionsQuery]);

  /**
   * シーン変更をログに記録
   */
  const logSceneChange = useCallback((scene: SceneType) => {
    if (!isActive) return;

    sceneCountsRef.current[scene] = (sceneCountsRef.current[scene] || 0) + 1;
    
    const entry: LogEntry = {
      type: 'scene_change',
      timestamp: Date.now(),
      content: scene,
    };
    logsRef.current.push(entry);

    // 認証済みの場合はサーバーに送信
    if (isAuthenticated && currentSessionId && !currentSessionId.startsWith('local_')) {
      addLogMutation.mutate({
        sessionId: currentSessionId,
        ...entry,
      });
    }
  }, [isActive, isAuthenticated, currentSessionId, addLogMutation]);

  /**
   * 発話をログに記録
   */
  const logSpeech = useCallback((text: string) => {
    if (!isActive) return;

    const entry: LogEntry = {
      type: 'speech',
      timestamp: Date.now(),
      content: text,
    };
    logsRef.current.push(entry);

    if (isAuthenticated && currentSessionId && !currentSessionId.startsWith('local_')) {
      addLogMutation.mutate({
        sessionId: currentSessionId,
        ...entry,
      });
    }
  }, [isActive, isAuthenticated, currentSessionId, addLogMutation]);

  /**
   * イベントをログに記録
   */
  const logEvent = useCallback((eventType: string, metadata?: Record<string, unknown>) => {
    if (!isActive) return;

    eventCountsRef.current[eventType] = (eventCountsRef.current[eventType] || 0) + 1;

    const entry: LogEntry = {
      type: 'event',
      timestamp: Date.now(),
      content: eventType,
      metadata,
    };
    logsRef.current.push(entry);

    if (isAuthenticated && currentSessionId && !currentSessionId.startsWith('local_')) {
      addLogMutation.mutate({
        sessionId: currentSessionId,
        ...entry,
      });
    }
  }, [isActive, isAuthenticated, currentSessionId, addLogMutation]);

  /**
   * 介入をログに記録
   */
  const logIntervention = useCallback((interventionType: string, metadata?: Record<string, unknown>) => {
    if (!isActive) return;

    const entry: LogEntry = {
      type: 'intervention',
      timestamp: Date.now(),
      content: interventionType,
      metadata,
    };
    logsRef.current.push(entry);

    if (isAuthenticated && currentSessionId && !currentSessionId.startsWith('local_')) {
      addLogMutation.mutate({
        sessionId: currentSessionId,
        ...entry,
      });
    }
  }, [isActive, isAuthenticated, currentSessionId, addLogMutation]);

  /**
   * セッションを削除
   */
  const deleteSession = useCallback(async (sessionId: string) => {
    if (!isAuthenticated) return;

    try {
      await deleteMutation.mutateAsync({ sessionId });
      sessionsQuery.refetch();
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  }, [isAuthenticated, deleteMutation, sessionsQuery]);

  return {
    // State
    currentSessionId,
    isActive,
    isAuthenticated,
    sessions: sessionsQuery.data ?? [],
    isLoadingSessions: sessionsQuery.isLoading,

    // Actions
    startSession,
    endSession,
    logSceneChange,
    logSpeech,
    logEvent,
    logIntervention,
    deleteSession,
    refetchSessions: sessionsQuery.refetch,
  };
}
