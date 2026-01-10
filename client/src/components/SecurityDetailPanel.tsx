/**
 * SecurityDetailPanel - セキュリティ詳細パネル
 * 
 * 「実は裏でこれだけ動いていました」を表示する詳細モード
 * 普段は見えないが、興味がある人だけが見られる
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSecurityStats, getEventTypeLabel, getEventTypeIcon } from '@/hooks/useSecurityStats';
import { useAuth } from '@/_core/hooks/useAuth';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';

interface SecurityDetailPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SecurityDetailPanel({ isOpen, onClose }: SecurityDetailPanelProps) {
  const { isAuthenticated } = useAuth();
  const { stats, isLoading } = useSecurityStats();
  const [activeTab, setActiveTab] = useState('overview');

  // 未認証時のメッセージ
  if (!isAuthenticated) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="bg-card/95 backdrop-blur-md border-border/50 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-serif-jp">セキュリティ詳細</DialogTitle>
            <DialogDescription>
              ログインすると、あなたを守っているセキュリティの詳細を確認できます。
            </DialogDescription>
          </DialogHeader>
          <div className="py-8 text-center">
            <div className="text-4xl mb-4">🔒</div>
            <p className="text-muted-foreground text-sm">
              ログインして、あなたの聖域がどのように守られているか確認しましょう。
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-card/95 backdrop-blur-md border-border/50 max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="text-lg font-serif-jp flex items-center gap-2">
            <span className="text-xl">🛡️</span>
            セキュリティ詳細
          </DialogTitle>
          <DialogDescription>
            あなたが気づかないうちに、これだけのセキュリティが動いていました。
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">概要</TabsTrigger>
            <TabsTrigger value="events">イベント</TabsTrigger>
            <TabsTrigger value="technology">技術</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            <OverviewTab stats={stats} isLoading={isLoading} />
          </TabsContent>

          <TabsContent value="events" className="mt-4">
            <EventsTab stats={stats} isLoading={isLoading} />
          </TabsContent>

          <TabsContent value="technology" className="mt-4">
            <TechnologyTab />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// 概要タブ
function OverviewTab({ stats, isLoading }: { stats: any; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        <div className="animate-pulse">読み込み中...</div>
      </div>
    );
  }

  const totalEvents = stats?.totalEvents || 0;
  const eventsByType = stats?.eventsByType || {};

  return (
    <div className="space-y-6">
      {/* メインメッセージ */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-primary/10 rounded-lg p-6 text-center"
      >
        <div className="text-4xl font-bold text-primary mb-2">
          {totalEvents}
        </div>
        <p className="text-sm text-muted-foreground">
          回のセキュリティ保護が静かに実行されました
        </p>
      </motion.div>

      {/* イベント種別の内訳 */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-muted-foreground">保護の内訳</h4>
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(eventsByType).map(([type, count], index) => (
            <motion.div
              key={type}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-muted/30 rounded-lg p-3 flex items-center gap-3"
            >
              <span className="text-lg">{getEventTypeIcon(type)}</span>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-muted-foreground truncate">
                  {getEventTypeLabel(type)}
                </div>
                <div className="text-lg font-semibold">{count as number}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* 説明 */}
      <div className="text-xs text-muted-foreground/70 text-center">
        これらの保護は、あなたが対話に集中している間、
        <br />
        静かにバックグラウンドで実行されていました。
      </div>
    </div>
  );
}

// イベントタブ
function EventsTab({ stats, isLoading }: { stats: any; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        <div className="animate-pulse">読み込み中...</div>
      </div>
    );
  }

  const recentEvents = stats?.recentEvents || [];

  if (recentEvents.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        <div className="text-3xl mb-3">📋</div>
        <p className="text-sm">まだイベントが記録されていません。</p>
        <p className="text-xs mt-2">セッションを開始すると、保護イベントが記録されます。</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[300px]">
      <div className="space-y-2 pr-4">
        {recentEvents.map((event: any, index: number) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="bg-muted/20 rounded-lg p-3 flex items-start gap-3"
          >
            <span className="text-lg mt-0.5">{getEventTypeIcon(event.eventType)}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">
                  {getEventTypeLabel(event.eventType)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatTimestamp(event.timestamp)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {event.description}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </ScrollArea>
  );
}

// 技術タブ
function TechnologyTab() {
  const technologies = [
    {
      name: 'AES-256-GCM暗号化',
      description: 'あなたの会話データは、軍事レベルの暗号化で保護されています。',
      icon: '🔐',
      status: 'active',
    },
    {
      name: 'レート制限',
      description: '異常なアクセスパターンを自動的にブロックし、攻撃を防ぎます。',
      icon: '⚡',
      status: 'active',
    },
    {
      name: '入力サニタイズ',
      description: '悪意のあるコードの注入を防ぎ、データの安全性を保ちます。',
      icon: '🧹',
      status: 'active',
    },
    {
      name: 'セッション保護',
      description: 'あなたのセッションは、不正アクセスから守られています。',
      icon: '🛡️',
      status: 'active',
    },
    {
      name: 'プライバシー保護',
      description: '音声データは外部に送信されず、あなたのプライバシーが守られています。',
      icon: '👁️',
      status: 'active',
    },
    {
      name: '同意保護',
      description: '同調圧力を検知し、あなたの判断の自由を守ります。',
      icon: '💚',
      status: 'active',
    },
  ];

  return (
    <ScrollArea className="h-[300px]">
      <div className="space-y-3 pr-4">
        {technologies.map((tech, index) => (
          <motion.div
            key={tech.name}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-muted/20 rounded-lg p-4"
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xl">{tech.icon}</span>
              <span className="font-medium text-sm">{tech.name}</span>
              <span className="ml-auto flex items-center gap-1 text-xs text-green-500">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                稼働中
              </span>
            </div>
            <p className="text-xs text-muted-foreground pl-8">
              {tech.description}
            </p>
          </motion.div>
        ))}
      </div>
    </ScrollArea>
  );
}

// タイムスタンプのフォーマット
function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  if (diff < 60000) {
    return 'たった今';
  } else if (diff < 3600000) {
    return `${Math.floor(diff / 60000)}分前`;
  } else if (diff < 86400000) {
    return `${Math.floor(diff / 3600000)}時間前`;
  } else {
    return date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
  }
}
