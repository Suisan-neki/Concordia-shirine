/**
 * Concordia Shrine - Session History Component
 * 
 * 過去のセッションを閲覧・分析
 * - セッション一覧
 * - 詳細な分析結果
 * - 傾向の可視化
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Session, SessionSummary } from '@/lib/conversationLog';
import type { SceneType } from '@/lib/waveEngine';

interface SessionHistoryProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadSessions: () => Promise<Session[]>;
  onDeleteSession: (id: string) => Promise<void>;
}

// シーンの色設定
const sceneColors: Record<SceneType, string> = {
  '静寂': 'bg-muted',
  '調和': 'bg-shrine-jade',
  '一方的': 'bg-shrine-vermilion',
  '沈黙': 'bg-shrine-wave-light'
};

export function SessionHistory({ isOpen, onClose, onLoadSessions, onDeleteSession }: SessionHistoryProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // セッションを読み込み
  useEffect(() => {
    if (isOpen) {
      loadSessions();
    }
  }, [isOpen]);
  
  const loadSessions = async () => {
    setIsLoading(true);
    try {
      const loadedSessions = await onLoadSessions();
      setSessions(loadedSessions.sort((a, b) => b.startTime - a.startTime));
    } catch (error) {
      console.error('Failed to load sessions:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleDeleteSession = async (id: string) => {
    if (!confirm('このセッションを削除しますか？')) return;
    
    try {
      await onDeleteSession(id);
      setSessions(prev => prev.filter(s => s.id !== id));
      if (selectedSession?.id === id) {
        setSelectedSession(null);
      }
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  };
  
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}分${remainingSeconds}秒`;
  };
  
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
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
          />
          
          {/* パネル */}
          <motion.div
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            transition={{ type: 'spring', damping: 25 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-card border-l border-border z-50 flex flex-col"
          >
            {/* ヘッダー */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="text-lg font-serif-jp text-foreground">セッション履歴</h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-muted rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* コンテンツ */}
            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
                </div>
              ) : sessions.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <p className="text-sm">セッション履歴がありません</p>
                  <p className="text-xs mt-2">録音を開始すると、ここに履歴が表示されます</p>
                </div>
              ) : selectedSession ? (
                // 詳細ビュー
                <div className="p-4">
                  <button
                    onClick={() => setSelectedSession(null)}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                    一覧に戻る
                  </button>
                  
                  <SessionDetail session={selectedSession} />
                </div>
              ) : (
                // 一覧ビュー
                <div className="p-4 space-y-3">
                  {sessions.map((session) => (
                    <motion.div
                      key={session.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3 bg-muted/20 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => setSelectedSession(session)}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-sm text-foreground">
                            {formatDate(session.startTime)}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {session.summary ? formatDuration(session.summary.totalDuration) : '---'}
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSession(session.id);
                          }}
                          className="p-1 hover:bg-destructive/20 rounded transition-colors"
                        >
                          <svg className="w-4 h-4 text-muted-foreground hover:text-destructive" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                          </svg>
                        </button>
                      </div>
                      
                      {/* シーン分布バー */}
                      {session.summary && (
                        <div className="mt-3">
                          <div className="flex h-2 rounded-full overflow-hidden">
                            {Object.entries(session.summary.sceneDistribution).map(([scene, count]) => {
                              const total = Object.values(session.summary!.sceneDistribution).reduce((a, b) => a + b, 0);
                              const width = total > 0 ? (count / total) * 100 : 0;
                              return width > 0 ? (
                                <div
                                  key={scene}
                                  className={`${sceneColors[scene as SceneType]}`}
                                  style={{ width: `${width}%` }}
                                />
                              ) : null;
                            })}
                          </div>
                        </div>
                      )}
                      
                      {/* セキュリティスコア */}
                      {session.summary && (
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">セキュリティ:</span>
                          <span className={`text-xs font-mono ${
                            session.summary.securityScore >= 70 ? 'text-shrine-jade' :
                            session.summary.securityScore >= 40 ? 'text-shrine-gold' :
                            'text-shrine-vermilion'
                          }`}>
                            {session.summary.securityScore}
                          </span>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// セッション詳細コンポーネント
function SessionDetail({ session }: { session: Session }) {
  const summary = session.summary;
  
  if (!summary) {
    return (
      <div className="text-center text-muted-foreground py-8">
        <p className="text-sm">このセッションの詳細データがありません</p>
      </div>
    );
  }
  
  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}分${remainingSeconds}秒`;
  };
  
  return (
    <div className="space-y-6">
      {/* 基本情報 */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-3 bg-muted/20 rounded-lg">
          <div className="text-xs text-muted-foreground">総時間</div>
          <div className="text-lg font-mono text-foreground">{formatDuration(summary.totalDuration)}</div>
        </div>
        <div className="p-3 bg-muted/20 rounded-lg">
          <div className="text-xs text-muted-foreground">セキュリティスコア</div>
          <div className={`text-lg font-mono ${
            summary.securityScore >= 70 ? 'text-shrine-jade' :
            summary.securityScore >= 40 ? 'text-shrine-gold' :
            'text-shrine-vermilion'
          }`}>
            {summary.securityScore}
          </div>
        </div>
      </div>
      
      {/* シーン分布 */}
      <div>
        <h4 className="text-sm font-medium text-foreground mb-3">シーン分布</h4>
        <div className="space-y-2">
          {Object.entries(summary.sceneDistribution).map(([scene, count]) => {
            const total = Object.values(summary.sceneDistribution).reduce((a, b) => a + b, 0);
            const percentage = total > 0 ? (count / total) * 100 : 0;
            
            return (
              <div key={scene} className="flex items-center gap-3">
                <span className="text-xs w-16 text-muted-foreground">{scene}</span>
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={sceneColors[scene as SceneType]}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground w-12 text-right">
                  {percentage.toFixed(0)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* イベント統計 */}
      {Object.keys(summary.eventCounts).length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-foreground mb-3">検出されたイベント</h4>
          <div className="space-y-2">
            {Object.entries(summary.eventCounts).map(([event, count]) => {
              const eventLabels: Record<string, string> = {
                'SilenceLong': '長い沈黙',
                'MonologueLong': '長い独演',
                'OverlapBurst': '頻繁な切り替え',
                'StableCalm': '安定した対話'
              };
              
              return (
                <div key={event} className="flex items-center justify-between p-2 bg-muted/20 rounded-lg">
                  <span className="text-sm text-foreground">{eventLabels[event] || event}</span>
                  <span className="text-sm font-mono text-muted-foreground">{count}回</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      {/* インサイト */}
      {summary.insights.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-foreground mb-3">インサイト</h4>
          <div className="space-y-2">
            {summary.insights.map((insight, index) => (
              <div
                key={index}
                className="p-3 bg-shrine-jade/10 rounded-lg border-l-2 border-shrine-jade"
              >
                <p className="text-sm text-foreground">{insight}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default SessionHistory;
