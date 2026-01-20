import { Button } from '@/components/ui/button';

interface HomeNavigationProps {
  isMobile: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  hasReport: boolean;
  onNavigate: (path: string) => void;
  onOpenReport: () => void;
}

export function HomeNavigation({
  isMobile,
  isAuthenticated,
  isAdmin,
  hasReport,
  onNavigate,
  onOpenReport
}: HomeNavigationProps) {
  return (
    <div
      className={`fixed ${isMobile ? 'top-10' : 'top-4'} left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 sm:gap-2 flex-wrap justify-center max-w-[calc(100vw-1rem)] sm:max-w-none px-1 sm:px-0`}
    >
      {isAuthenticated && isAdmin && (
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
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
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
  );
}
