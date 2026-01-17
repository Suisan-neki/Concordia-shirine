/**
 * User Management Component
 * 
 * 管理者ダッシュボードでユーザー一覧と詳細を表示するコンポーネント。
 * ユーザーの検索、フィルタリング、削除機能を提供する。
 */

import { useState } from 'react';
import { api } from '@/lib/api';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

export function UserManagement() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [deleteUserId, setDeleteUserId] = useState<number | null>(null);

  const limit = 20;

  // ユーザー一覧取得
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin", "users", page, limit, search, includeDeleted],
    queryFn: () =>
      api.admin.listUsers({
        page,
        limit,
        search: search || undefined,
        includeDeleted: includeDeleted || undefined,
      }),
  });

  // ユーザー詳細取得
  const { data: userDetail } = useQuery({
    queryKey: ["admin", "user", selectedUserId],
    queryFn: () => api.admin.getUser(selectedUserId as number),
    enabled: selectedUserId !== null,
  });

  // ユーザー削除
  const deleteUserMutation = useMutation({
    mutationFn: (payload: { userId: number }) => api.admin.deleteUser(payload.userId),
    onSuccess: () => {
      toast.success('ユーザーを削除しました');
      setDeleteUserId(null);
      refetch();
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'ユーザーの削除に失敗しました';
      toast.error(message);
    },
  });

  const handleDelete = () => {
    if (deleteUserId) {
      deleteUserMutation.mutate({ userId: deleteUserId });
    }
  };

  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return '-';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleString('ja-JP');
  };

  const response = data as
    | {
        users: Array<{
          id: number;
          name?: string | null;
          role: string;
          lastSignedIn?: string | null;
          createdAt?: string | null;
          deletedAt?: string | null;
          loginMethod?: string | null;
        }>;
        total: number;
        totalPages: number;
      }
    | undefined;

  const selectedUser = userDetail as
    | {
        id: number;
        name?: string | null;
        role: string;
        loginMethod?: string | null;
        createdAt?: string | null;
        lastSignedIn?: string | null;
        deletedAt?: string | null;
      }
    | undefined;

  return (
    <div className="space-y-4">
      {/* 検索とフィルター */}
      <div className="flex items-center gap-4">
        <Input
          placeholder="名前で検索..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="max-w-sm"
        />
        <label htmlFor="include-deleted" className="flex items-center gap-2 text-sm">
          <input
            id="include-deleted"
            type="checkbox"
            checked={includeDeleted}
            onChange={(e) => {
              setIncludeDeleted(e.target.checked);
              setPage(1);
            }}
            aria-label="削除済みユーザーを含めて表示"
          />
          <span>削除済みを含む</span>
        </label>
      </div>

      {/* ユーザー一覧テーブル */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>名前</TableHead>
              <TableHead>ロール</TableHead>
              <TableHead>最終ログイン</TableHead>
              <TableHead>作成日</TableHead>
              <TableHead>ステータス</TableHead>
              <TableHead>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                </TableRow>
              ))
            ) : response?.users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  ユーザーが見つかりませんでした
                </TableCell>
              </TableRow>
            ) : (
              response?.users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.id}</TableCell>
                  <TableCell>{user.name || '-'}</TableCell>
                  <TableCell>
                    <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(user.lastSignedIn)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(user.createdAt)}
                  </TableCell>
                  <TableCell>
                    {user.deletedAt ? (
                      <Badge variant="destructive">削除済み</Badge>
                    ) : (
                      <Badge variant="outline">アクティブ</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedUserId(user.id)}
                      >
                        詳細
                      </Button>
                      {!user.deletedAt && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteUserId(user.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          削除
                        </Button>
                      )}
                    </div>
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

      {/* ユーザー詳細ダイアログ */}
      <Dialog open={selectedUserId !== null} onOpenChange={(open) => !open && setSelectedUserId(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>ユーザー詳細</DialogTitle>
            <DialogDescription>
              ID: {selectedUserId}
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium mb-2">基本情報</h3>
                <div className="space-y-2 text-sm">
                  <div><span className="text-muted-foreground">名前:</span> {selectedUser.name || '-'}</div>
                  <div><span className="text-muted-foreground">ロール:</span> <Badge>{selectedUser.role}</Badge></div>
                  <div><span className="text-muted-foreground">ログイン方法:</span> {selectedUser.loginMethod || '-'}</div>
                  <div><span className="text-muted-foreground">作成日:</span> {formatDate(selectedUser.createdAt)}</div>
                  <div><span className="text-muted-foreground">最終ログイン:</span> {formatDate(selectedUser.lastSignedIn)}</div>
                  {selectedUser.deletedAt && (
                    <div><span className="text-muted-foreground">削除日:</span> {formatDate(selectedUser.deletedAt)}</div>
                  )}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedUserId(null)}>
              閉じる
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 削除確認ダイアログ */}
      <AlertDialog open={deleteUserId !== null} onOpenChange={(open) => !open && setDeleteUserId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ユーザーを削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              この操作は論理削除です。ユーザーデータは保持されますが、ログインできなくなります。
              この操作は取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              削除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

