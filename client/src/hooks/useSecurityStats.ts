/**
 * useSecurityStats - セキュリティ統計を取得するカスタムフック
 * 
 * 「実は裏でこれだけ動いていました」の情報を取得
 */

import { trpc } from '@/lib/trpc';

export interface SecurityStats {
  totalEvents: number;
  eventsByType: Record<string, number>;
  recentEvents: Array<{
    eventType: string;
    description: string;
    timestamp: number;
  }>;
}

export interface SessionSecuritySummary {
  totalProtectionCount: number;
  details: Array<{
    type: string;
    count: number;
    description: string;
  }>;
}

export function useSecurityStats() {
  const { data, isLoading, error, refetch } = trpc.security.getStats.useQuery(undefined, {
    // 5分ごとに自動更新
    refetchInterval: 5 * 60 * 1000,
    // バックグラウンドでも更新
    refetchIntervalInBackground: true,
  });

  return {
    stats: data as SecurityStats | undefined,
    isLoading,
    error,
    refetch,
  };
}

export function useSessionSecuritySummary(sessionId: string | null) {
  const { data, isLoading, error } = trpc.security.getSessionSummary.useQuery(
    { sessionId: sessionId || '' },
    {
      enabled: !!sessionId,
    }
  );

  return {
    summary: data as SessionSecuritySummary | null | undefined,
    isLoading,
    error,
  };
}

/**
 * イベントタイプの日本語ラベルを取得
 */
export function getEventTypeLabel(eventType: string): string {
  const labels: Record<string, string> = {
    encryption_applied: 'データ暗号化',
    access_granted: 'アクセス許可',
    access_denied: 'アクセス拒否',
    rate_limit_triggered: 'レート制限',
    input_sanitized: '入力サニタイズ',
    session_protected: 'セッション保護',
    data_integrity_verified: 'データ整合性検証',
    privacy_preserved: 'プライバシー保護',
    threat_blocked: '脅威ブロック',
    consent_protected: '同意保護',
  };
  return labels[eventType] || eventType;
}

/**
 * イベントタイプのアイコンを取得
 */
export function getEventTypeIcon(eventType: string): string {
  const icons: Record<string, string> = {
    encryption_applied: '🔐',
    access_granted: '✓',
    access_denied: '⛔',
    rate_limit_triggered: '⚡',
    input_sanitized: '🧹',
    session_protected: '🛡️',
    data_integrity_verified: '✅',
    privacy_preserved: '👁️',
    threat_blocked: '🚫',
    consent_protected: '💚',
  };
  return icons[eventType] || '•';
}
