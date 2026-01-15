/**
 * Audit Log Viewer Component
 * 
 * 管理者ダッシュボードで監査ログを表示するコンポーネント。
 * セキュリティイベントの閲覧、フィルタリング機能を提供する。
 */

import { useState } from 'react';
import { api } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { getEventTypeLabel, getEventTypeIcon } from '@/hooks/useSecurityStats';

export function AuditLogViewer() {
  const [page, setPage] = useState(1);
  const [eventType, setEventType] = useState<string>('');
  const [severity, setSeverity] = useState<'info' | 'warning' | 'critical' | ''>('');

  const limit = 50;

  // フィルター変更時にページをリセット
  const handleEventTypeChange = (value: string) => {
    setEventType(value);
    setPage(1);
  };

  const handleSeverityChange = (value: string) => {
    setSeverity(value as typeof severity);
    setPage(1);
  };

  // 監査ログ取得
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "auditLogs", page, limit, eventType, severity],
    queryFn: () =>
      api.admin.auditLogs({
        page,
        limit,
        eventType: eventType || undefined,
        severity: severity || undefined,
      }),
  });

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('ja-JP');
  };

  const severityColors = {
    info: 'default',
    warning: 'secondary',
    critical: 'destructive',
  } as const;

  const response = data as
    | {
        logs: Array<{
          id: string | number;
          eventType: string;
          severity: 'info' | 'warning' | 'critical';
          description: string;
          userId?: number;
          sessionId?: number;
          timestamp: number;
        }>;
        total: number;
        totalPages: number;
      }
    | undefined;

  return (
    <div className="space-y-4">
      {/* フィルター */}
      <div className="flex items-center gap-4">
        <Select value={eventType} onValueChange={handleEventTypeChange}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="イベントタイプ" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">すべて</SelectItem>
            <SelectItem value="encryption_applied">データ暗号化</SelectItem>
            <SelectItem value="access_granted">アクセス許可</SelectItem>
            <SelectItem value="access_denied">アクセス拒否</SelectItem>
            <SelectItem value="rate_limit_triggered">レート制限</SelectItem>
            <SelectItem value="input_sanitized">入力サニタイズ</SelectItem>
            <SelectItem value="session_protected">セッション保護</SelectItem>
            <SelectItem value="data_integrity_verified">データ整合性検証</SelectItem>
            <SelectItem value="privacy_preserved">プライバシー保護</SelectItem>
            <SelectItem value="threat_blocked">脅威ブロック</SelectItem>
            <SelectItem value="consent_protected">同意保護</SelectItem>
          </SelectContent>
        </Select>

        <Select value={severity} onValueChange={handleSeverityChange}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="重要度" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">すべて</SelectItem>
            <SelectItem value="info">情報</SelectItem>
            <SelectItem value="warning">警告</SelectItem>
            <SelectItem value="critical">重要</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 監査ログテーブル */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>タイムスタンプ</TableHead>
              <TableHead>イベントタイプ</TableHead>
              <TableHead>重要度</TableHead>
              <TableHead>説明</TableHead>
              <TableHead>ユーザーID</TableHead>
              <TableHead>セッションID</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                </TableRow>
              ))
            ) : response?.logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  監査ログが見つかりませんでした
                </TableCell>
              </TableRow>
            ) : (
              response?.logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(log.timestamp)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span>{getEventTypeIcon(log.eventType)}</span>
                      <span className="text-sm">{getEventTypeLabel(log.eventType)}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={severityColors[log.severity]}>
                      {log.severity}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-md">
                    <div className="text-sm truncate" title={log.description}>
                      {log.description}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {log.userId || '-'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {log.sessionId || '-'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* ページネーション */}
      {response && response.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground whitespace-nowrap">
            {response.total}件中 {(page - 1) * limit + 1}-{Math.min(page * limit, response.total)}件を表示
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              前へ
            </Button>
            <span className="text-sm">
              {page} / {response.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(response.totalPages, p + 1))}
              disabled={page === response.totalPages}
            >
              次へ
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

