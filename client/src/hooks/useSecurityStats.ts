/**
 * useSecurityStats - セキュリティ統計を取得するカスタムフック
 * 
 * 「実は裏でこれだけ動いていました」の情報を取得
 */

import { api } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/_core/hooks/useAuth';

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

/**
 * セキュリティ統計フック
 * 
 * ユーザーのセキュリティ統計を取得するReactカスタムフック。
 * 「実は裏でこれだけ動いていました」の情報を取得するために使用される。
 * 
 * 機能:
 * - ユーザーのセキュリティイベントの統計情報を取得
 * - 5分ごとに自動更新
 * - バックグラウンドでも更新
 * 
 * @returns セキュリティ統計の状態とアクション（stats、isLoading、error、refetch）
 */
export function useSecurityStats() {
  const { isAuthenticated } = useAuth();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["security", "stats", isAuthenticated],
    queryFn: () => api.security.stats(),
    // 5分ごとに自動更新
    refetchInterval: isAuthenticated ? 5 * 60 * 1000 : false,
    // バックグラウンドでも更新
    refetchIntervalInBackground: isAuthenticated,
    enabled: isAuthenticated,
  });

  return {
    stats: data
      ? {
          totalEvents: (data as { totalEvents?: number }).totalEvents ?? 0,
          eventsByType: (data as { eventCounts?: Record<string, number> }).eventCounts ?? {},
          recentEvents: (data as { recentEvents?: SecurityStats["recentEvents"] }).recentEvents ?? [],
        }
      : undefined,
    isLoading,
    error,
    refetch,
  };
}

/**
 * セッションセキュリティサマリーフック
 * 
 * 指定されたセッションのセキュリティサマリーを取得するReactカスタムフック。
 * セッション中に適用されたセキュリティ機能の集計を取得する。
 * 
 * @param sessionId - 取得するセッションのID（nullの場合はクエリが無効化される）
 * @returns セキュリティサマリーの状態（summary、isLoading、error）
 */
export function useSessionSecuritySummary(sessionId: string | null) {
  const { isAuthenticated } = useAuth();
  const { data, isLoading, error } = useQuery({
    queryKey: ["security", "summary", sessionId, isAuthenticated],
    queryFn: () => api.security.summary(sessionId || ""),
    enabled: !!sessionId && isAuthenticated,
  });

  return {
    summary: data
      ? {
          totalProtectionCount: (data as { totalEvents?: number }).totalEvents ?? 0,
          details: Object.entries(
            (data as { eventCounts?: Record<string, number> }).eventCounts ?? {}
          ).map(([type, count]) => ({
            type,
            count,
            description: type,
          })),
        }
      : null,
    isLoading,
    error,
  };
}

/**
 * イベントタイプの日本語ラベルを取得する
 * 
 * セキュリティイベントタイプを日本語のラベルに変換する。
 * UI表示で使用される。
 * 
 * @param eventType - イベントタイプ（例: 'encryption_applied'、'access_granted'）
 * @returns 日本語ラベル（例: 'データ暗号化'、'アクセス許可'）、見つからない場合は元の文字列を返す
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
 * イベントタイプのアイコンを取得する
 * 
 * セキュリティイベントタイプに対応する絵文字アイコンを返す。
 * UI表示で使用される。
 * 
 * @param eventType - イベントタイプ（例: 'encryption_applied'、'access_granted'）
 * @returns 絵文字アイコン（例: '🔐'、'✓'）、見つからない場合は'•'を返す
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
