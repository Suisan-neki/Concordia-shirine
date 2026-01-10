/**
 * Concordia Shrine - Report Download Panel
 * 
 * セッションレポートをダウンロードするためのUI
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { 
  generateReportData, 
  downloadReport, 
  generateMarkdownReport,
  type SessionData 
} from '@/lib/reportGenerator';

interface ReportDownloadPanelProps {
  isOpen: boolean;
  onClose: () => void;
  session: SessionData | null;
}

export function ReportDownloadPanel({ isOpen, onClose, session }: ReportDownloadPanelProps) {
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGeneratePreview = useCallback(() => {
    if (!session) return;
    
    setIsGenerating(true);
    
    // 少し遅延を入れてローディング感を出す
    setTimeout(() => {
      const reportData = generateReportData(session);
      const markdown = generateMarkdownReport(reportData);
      setPreviewContent(markdown);
      setIsGenerating(false);
    }, 500);
  }, [session]);

  const handleDownload = useCallback((format: 'markdown' | 'html') => {
    if (!session) return;
    
    const reportData = generateReportData(session);
    downloadReport(reportData, format);
  }, [session]);

  if (!session) return null;

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
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          />
          
          {/* パネル */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25 }}
            className="fixed inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-2xl md:max-h-[80vh] bg-card border border-border rounded-xl z-50 overflow-hidden flex flex-col"
          >
            {/* ヘッダー */}
            <div className="flex-shrink-0 border-b border-border p-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-medium text-foreground">レポート出力</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  セッション分析レポートをダウンロード
                </p>
              </div>
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
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* セッション情報 */}
              <div className="bg-muted/50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-foreground mb-2">セッション情報</h3>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">開始時刻:</span>
                    <span className="ml-2 text-foreground">
                      {new Date(session.startTime).toLocaleString('ja-JP')}
                    </span>
                  </div>
                  {session.duration && (
                    <div>
                      <span className="text-muted-foreground">時間:</span>
                      <span className="ml-2 text-foreground">
                        {Math.floor(session.duration / 60000)}分
                      </span>
                    </div>
                  )}
                  {session.securityScore !== null && (
                    <div>
                      <span className="text-muted-foreground">スコア:</span>
                      <span className="ml-2 text-foreground">
                        {session.securityScore}/100
                      </span>
                    </div>
                  )}
                </div>
              </div>
              
              {/* プレビュー */}
              {previewContent ? (
                <div className="border border-border rounded-lg overflow-hidden">
                  <div className="bg-muted/50 px-3 py-2 border-b border-border flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">プレビュー (Markdown)</span>
                    <button
                      onClick={() => setPreviewContent(null)}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      閉じる
                    </button>
                  </div>
                  <pre className="p-4 text-xs text-muted-foreground overflow-x-auto max-h-64 overflow-y-auto">
                    {previewContent}
                  </pre>
                </div>
              ) : (
                <Button
                  variant="outline"
                  onClick={handleGeneratePreview}
                  disabled={isGenerating}
                  className="w-full"
                >
                  {isGenerating ? (
                    <>
                      <svg className="w-4 h-4 mr-2 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12" />
                      </svg>
                      生成中...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                      レポートをプレビュー
                    </>
                  )}
                </Button>
              )}
              
              {/* ダウンロードオプション */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-foreground">ダウンロード形式</h3>
                
                <div className="grid grid-cols-2 gap-3">
                  {/* Markdown */}
                  <button
                    onClick={() => handleDownload('markdown')}
                    className="flex flex-col items-center gap-2 p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <svg className="w-8 h-8 text-shrine-jade" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                      <polyline points="10 9 9 9 8 9" />
                    </svg>
                    <span className="text-sm font-medium text-foreground">Markdown</span>
                    <span className="text-xs text-muted-foreground">.md形式</span>
                  </button>
                  
                  {/* HTML */}
                  <button
                    onClick={() => handleDownload('html')}
                    className="flex flex-col items-center gap-2 p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <svg className="w-8 h-8 text-shrine-gold" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <path d="M8 13h2l2 3 2-3h2" />
                    </svg>
                    <span className="text-sm font-medium text-foreground">HTML</span>
                    <span className="text-xs text-muted-foreground">.html形式（印刷対応）</span>
                  </button>
                </div>
              </div>
              
              {/* 説明 */}
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  レポートには、セッションの概要、シーン分析、ヒューマンセキュリティスコア、
                  および改善のための推奨事項が含まれます。HTML形式はブラウザで開いて印刷することができます。
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default ReportDownloadPanel;
