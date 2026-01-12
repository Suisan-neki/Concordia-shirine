/**
 * Admin Dashboard Page
 * 
 * 管理者専用のダッシュボードページ。
 * ユーザー管理と監査ログ閲覧の機能を提供する。
 */

import { useState } from 'react';
import { useAuth } from '@/_core/hooks/useAuth';
import { useLocation } from 'wouter';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserManagement } from '@/components/UserManagement';
import { AuditLogViewer } from '@/components/AuditLogViewer';

export default function AdminDashboard() {
  const { user, isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<'users' | 'audit'>('users');

  // ローディング中は何も表示しない（認証状態の確認中）
  if (loading) {
    return null;
  }

  // 管理者チェック
  if (!isAuthenticated || user?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-serif-jp text-foreground mb-4">
            アクセスが拒否されました
          </h1>
          <p className="text-muted-foreground mb-4">
            このページは管理者専用です。
          </p>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
          >
            ホームに戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* ヘッダー */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border/50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-serif-jp text-foreground">管理者ダッシュボード</h1>
            <p className="text-sm text-muted-foreground">
              {user?.name || user?.email || '管理者'}としてログイン中
            </p>
          </div>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted"
          >
            ホームに戻る
          </button>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="container mx-auto px-4 py-8 max-w-7xl">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'users' | 'audit')}>
          <TabsList className="mb-6">
            <TabsTrigger value="users">ユーザー管理</TabsTrigger>
            <TabsTrigger value="audit">監査ログ</TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <UserManagement />
          </TabsContent>

          <TabsContent value="audit">
            <AuditLogViewer />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
