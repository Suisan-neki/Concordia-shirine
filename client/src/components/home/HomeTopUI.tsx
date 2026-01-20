import { Button } from '@/components/ui/button';
import type { AuthUser } from '@/types/auth';

interface HomeTopUIProps {
  isMobile: boolean;
  isAuthenticated: boolean;
  user: AuthUser | null;
  isGuestMode: boolean;
  hasReport: boolean;
  onLogin: () => void;
  onLogout: () => void;
  onEnableGuestMode: () => void;
  onNavigate: (path: string) => void;
  onOpenReport: () => void;
}

export function HomeTopUI({
  isMobile,
  isAuthenticated,
  user,
  isGuestMode,
  hasReport,
  onLogin,
  onLogout,
  onEnableGuestMode,
  onNavigate,
  onOpenReport,
}: HomeTopUIProps) {
  return (
    <>
      {/* ログイン/ログアウトボタン */}
      <div className={`fixed ${isMobile ? 'top-2' : 'top-4'} right-2 sm:right-4 z-30`}>
        {isAuthenticated ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground bg-card/60 backdrop-blur-sm px-1.5 sm:px-2 py-1 rounded">
              <span className="hidden sm:inline">{user?.name || 'ユーザー'}</span>
              <span className="sm:hidden">{user?.name?.charAt(0) || 'U'}</span>
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={onLogout}
              aria-label="ログアウト"
              className="bg-card/60 backdrop-blur-sm text-xs px-2 sm:px-3"
            >
              <svg className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span className="hidden sm:inline">ログアウト</span>
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {isGuestMode && (
              <span className="text-xs text-muted-foreground bg-card/60 backdrop-blur-sm px-1.5 sm:px-2 py-1 rounded">
                ゲスト利用中
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={onLogin}
              aria-label="ログイン"
              className="bg-card/60 backdrop-blur-sm text-xs px-2 sm:px-3"
            >
              <svg className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                <polyline points="10 17 15 12 10 7" />
                <line x1="15" y1="12" x2="3" y2="12" />
              </svg>
              <span className="hidden sm:inline">ログイン</span>
            </Button>
            {!isGuestMode && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onEnableGuestMode}
                aria-label="ログインせずに試す"
                className="bg-card/40 backdrop-blur-sm text-xs px-2 sm:px-3"
              >
                <span className="hidden sm:inline">ログインせずに試す</span>
                <span className="sm:hidden">ゲスト</span>
              </Button>
            )}
          </div>
        )}
      </div>

      {/* タイトル */}
      <div
        className={`absolute ${isMobile ? 'top-32' : 'top-1/4'} left-1/2 -translate-x-1/2 text-center z-10 px-4 w-full max-w-2xl`}
      >
        <h1 className={`${isMobile ? 'text-2xl' : 'text-3xl md:text-4xl'} font-serif-jp text-foreground/90 mb-2 tracking-wider`}>
          Concordia Shrine
        </h1>
        <p className={`${isMobile ? 'text-xs' : 'text-sm'} text-muted-foreground font-light`}>
          空気だけを聴き、判断の自由をそっと守る祠
        </p>
      </div>

      {/* コンセプトメッセージ */}
      <div
        className={`absolute ${isMobile ? 'top-44' : 'top-1/3'} left-1/2 -translate-x-1/2 ${isMobile ? 'mt-4' : 'mt-8'} text-center z-10 max-w-lg px-4`}
      >
        <p className={`${isMobile ? 'text-[10px]' : 'text-xs'} text-muted-foreground/70 leading-relaxed`}>
          「ヒューマンセキュリティなくして
          <br />
          サイバーセキュリティは実現しない」
        </p>
        <p className={`${isMobile ? 'text-[10px]' : 'text-xs'} text-muted-foreground/50 mt-2`}>
          この聖域では技術が人の心を守ります。
          <br />
          結界が展開され、あなたの判断の自由が守られています。
        </p>
      </div>

      {/* ナビゲーションボタン */}
      <div className={`fixed ${isMobile ? 'top-10' : 'top-4'} left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 sm:gap-2 flex-wrap justify-center max-w-[calc(100vw-1rem)] sm:max-w-none px-1 sm:px-0`}>
        {isAuthenticated && user?.role === 'admin' && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigate('/admin')}
            aria-label="管理者"
            className="bg-card/60 backdrop-blur-sm text-xs border-primary/30 hover:border-primary/50 px-2 sm:px-3"
          >
            <svg className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
            <span className="hidden sm:inline">管理者</span>
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onNavigate('/security')}
          aria-label="セキュリティ"
          className="bg-card/60 backdrop-blur-sm text-xs px-2 sm:px-3"
        >
          <svg className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <span className="hidden sm:inline">セキュリティ</span>
        </Button>
        {isAuthenticated && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigate('/security-detail')}
            aria-label="詳細"
            className="bg-card/60 backdrop-blur-sm text-xs border-primary/30 hover:border-primary/50 px-2 sm:px-3"
          >
            <svg className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
            <span className="hidden sm:inline">詳細</span>
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onNavigate('/history')}
          aria-label="履歴"
          className="bg-card/60 backdrop-blur-sm text-xs px-2 sm:px-3"
        >
          <svg className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span className="hidden sm:inline">履歴</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onNavigate('/intervention-settings')}
          aria-label="介入設定"
          className="bg-card/60 backdrop-blur-sm text-xs px-2 sm:px-3"
        >
          <svg className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82V9a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          <span className="hidden sm:inline">介入設定</span>
        </Button>
        {hasReport && (
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenReport}
            aria-label="レポート"
            className="bg-card/60 backdrop-blur-sm text-xs px-2 sm:px-3"
          >
            <svg className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            <span className="hidden sm:inline">レポート</span>
          </Button>
        )}
      </div>
    </>
  );
}
