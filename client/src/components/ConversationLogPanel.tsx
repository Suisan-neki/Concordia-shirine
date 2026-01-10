/**
 * Concordia Shrine - Conversation Log Panel
 * 
 * 会話ログの表示と分析結果の可視化
 * - リアルタイムログの流れ
 * - セッションサマリー
 * - インサイト表示
 */

import { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { LogEntry, SessionSummary } from '@/lib/conversationLog';
import type { SceneType } from '@/lib/waveEngine';

interface ConversationLogPanelProps {
  logs: LogEntry[];
  summary?: SessionSummary | null;
  isExpanded: boolean;
  onToggle: () => void;
  className?: string;
}

// シーンの日本語表示とアイコン
const sceneConfig: Record<SceneType, { label: string; color: string }> = {
  '静寂': { label: '静寂', color: 'text-muted-foreground' },
  '調和': { label: '調和', color: 'text-shrine-jade' },
  '一方的': { label: '一方的', color: 'text-shrine-vermilion' },
  '沈黙': { label: '沈黙', color: 'text-shrine-wave-deep' }
};

// ログエントリの表示
function LogEntryItem({ entry }: { entry: LogEntry }) {
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('ja-JP', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  };
  
  const getEntryContent = () => {
    switch (entry.type) {
      case 'speech':
        return (
          <div className="flex items-start gap-2">
            <span className="text-shrine-jade text-xs">●</span>
            <div>
              <span className="text-foreground">{entry.data.text || '(発話)'}</span>
              {entry.data.duration && (
                <span className="text-muted-foreground text-xs ml-2">
                  {entry.data.duration.toFixed(1)}秒
                </span>
              )}
            </div>
          </div>
        );
      
      case 'silence':
        return (
          <div className="flex items-start gap-2">
            <span className="text-muted-foreground text-xs">○</span>
            <span className="text-muted-foreground italic">
              沈黙 {entry.data.duration?.toFixed(1)}秒
            </span>
          </div>
        );
      
      case 'event':
        const eventType = entry.data.event?.type;
        const eventLabels: Record<string, string> = {
          'SilenceLong': '長い沈黙を検出',
          'MonologueLong': '長い独演を検出',
          'OverlapBurst': '頻繁な切り替えを検出',
          'StableCalm': '安定した対話'
        };
        return (
          <div className="flex items-start gap-2">
            <span className="text-shrine-gold text-xs">◆</span>
            <span className="text-shrine-gold">
              {eventLabels[eventType || ''] || eventType}
            </span>
          </div>
        );
      
      case 'scene_change':
        const scene = entry.data.scene as SceneType;
        const config = sceneConfig[scene];
        return (
          <div className="flex items-start gap-2">
            <span className={`text-xs ${config?.color || ''}`}>▸</span>
            <span className={config?.color || ''}>
              シーン: {config?.label || scene}
            </span>
          </div>
        );
      
      case 'security':
        return (
          <div className="flex items-start gap-2">
            <span className="text-shrine-barrier text-xs">◈</span>
            <span className="text-shrine-barrier">
              {entry.data.message}
            </span>
          </div>
        );
      
      default:
        return null;
    }
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="py-1.5 border-b border-border/30 last:border-0"
    >
      <div className="flex items-start gap-3">
        <span className="text-[10px] text-muted-foreground font-mono whitespace-nowrap">
          {formatTime(entry.timestamp)}
        </span>
        <div className="flex-1 text-sm">
          {getEntryContent()}
        </div>
      </div>
    </motion.div>
  );
}

// サマリー表示
function SummaryView({ summary }: { summary: SessionSummary }) {
  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}分${remainingSeconds}秒`;
  };
  
  return (
    <div className="space-y-4">
      {/* 時間統計 */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-muted/30 rounded-lg p-2 text-center">
          <div className="text-lg font-mono text-foreground">
            {formatDuration(summary.totalDuration)}
          </div>
          <div className="text-[10px] text-muted-foreground">総時間</div>
        </div>
        <div className="bg-muted/30 rounded-lg p-2 text-center">
          <div className="text-lg font-mono text-shrine-jade">
            {formatDuration(summary.speechDuration * 1000)}
          </div>
          <div className="text-[10px] text-muted-foreground">発話時間</div>
        </div>
        <div className="bg-muted/30 rounded-lg p-2 text-center">
          <div className="text-lg font-mono text-muted-foreground">
            {formatDuration(summary.silenceDuration * 1000)}
          </div>
          <div className="text-[10px] text-muted-foreground">沈黙時間</div>
        </div>
      </div>
      
      {/* シーン分布 */}
      <div>
        <h4 className="text-xs font-medium text-muted-foreground mb-2">シーン分布</h4>
        <div className="space-y-1">
          {Object.entries(summary.sceneDistribution).map(([scene, count]) => {
            const config = sceneConfig[scene as SceneType];
            const total = Object.values(summary.sceneDistribution).reduce((a, b) => a + b, 0);
            const percentage = total > 0 ? (count / total) * 100 : 0;
            
            return (
              <div key={scene} className="flex items-center gap-2">
                <span className={`text-xs w-12 ${config?.color || ''}`}>
                  {config?.label || scene}
                </span>
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      scene === '調和' ? 'bg-shrine-jade' :
                      scene === '一方的' ? 'bg-shrine-vermilion' :
                      scene === '沈黙' ? 'bg-shrine-wave-deep' :
                      'bg-muted-foreground'
                    }`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground w-8 text-right">
                  {count}回
                </span>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* セキュリティスコア */}
      <div className="bg-muted/30 rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground">セキュリティスコア</span>
          <span className="text-xl font-mono text-shrine-barrier">
            {summary.securityScore}
          </span>
        </div>
      </div>
      
      {/* インサイト */}
      {summary.insights.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-muted-foreground mb-2">インサイト</h4>
          <div className="space-y-2">
            {summary.insights.map((insight, index) => (
              <div
                key={index}
                className="text-sm text-foreground bg-muted/20 rounded-lg p-2 border-l-2 border-shrine-jade"
              >
                {insight}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function ConversationLogPanel({
  logs,
  summary,
  isExpanded,
  onToggle,
  className = ''
}: ConversationLogPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // 新しいログが追加されたら自動スクロール
  useEffect(() => {
    if (scrollRef.current && isExpanded) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, isExpanded]);
  
  return (
    <div className={`fixed bottom-0 left-0 right-0 z-20 ${className}`}>
      {/* トグルボタン */}
      <button
        onClick={onToggle}
        className="absolute -top-10 left-1/2 -translate-x-1/2 bg-card/80 backdrop-blur-sm border border-border/50 rounded-t-lg px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <span className="font-serif-jp">
          {isExpanded ? '▼ ログを閉じる' : '▲ ログを開く'}
        </span>
        {!isExpanded && logs.length > 0 && (
          <span className="ml-2 text-xs bg-shrine-jade/20 text-shrine-jade px-1.5 py-0.5 rounded">
            {logs.length}
          </span>
        )}
      </button>
      
      {/* パネル本体 */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="bg-card/90 backdrop-blur-md border-t border-border/50"
          >
            <div className="max-w-4xl mx-auto p-4">
              {summary ? (
                <SummaryView summary={summary} />
              ) : (
                <div
                  ref={scrollRef}
                  className="max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent"
                >
                  {logs.length === 0 ? (
                    <div className="text-center text-muted-foreground text-sm py-4">
                      ログはまだありません
                    </div>
                  ) : (
                    logs.slice(-20).map((entry) => (
                      <LogEntryItem key={entry.id} entry={entry} />
                    ))
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default ConversationLogPanel;
