/**
 * Concordia Shrine - Security Barrier Component
 * 
 * サイバーセキュリティを「結界」として可視化
 * - 認証状態、暗号化、プライバシー保護を視覚的に表現
 * - 脅威レベルに応じた結界の強さの変化
 */

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { SecurityMetrics, SecurityIndicator } from '@/lib/conversationLog';

interface SecurityBarrierProps {
  metrics: SecurityMetrics;
  className?: string;
}

// インジケーターアイコン
function IndicatorIcon({ type, status }: { type: SecurityIndicator['type']; status: SecurityIndicator['status'] }) {
  const baseClass = "w-4 h-4";
  
  const icons = {
    auth: (
      <svg className={baseClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    encryption: (
      <svg className={baseClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
    privacy: (
      <svg className={baseClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
    consent: (
      <svg className={baseClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    )
  };
  
  const statusColors = {
    active: 'text-shrine-jade',
    inactive: 'text-muted-foreground',
    warning: 'text-shrine-vermilion'
  };
  
  return (
    <span className={statusColors[status]}>
      {icons[type]}
    </span>
  );
}

export function SecurityBarrier({ metrics, className = '' }: SecurityBarrierProps) {
  const [pulseIntensity, setPulseIntensity] = useState(0);
  
  // 結界の脈動
  useEffect(() => {
    const interval = setInterval(() => {
      setPulseIntensity(prev => {
        const target = metrics.barrierStrength;
        return prev + (target - prev) * 0.1;
      });
    }, 100);
    
    return () => clearInterval(interval);
  }, [metrics.barrierStrength]);
  
  // 結界の色を計算
  const getBarrierColor = () => {
    if (metrics.protectionStatus === 'active') {
      return `rgba(85, 150, 130, ${0.1 + pulseIntensity * 0.15})`;
    } else if (metrics.protectionStatus === 'warning') {
      return `rgba(200, 120, 80, ${0.1 + pulseIntensity * 0.15})`;
    }
    return `rgba(180, 60, 60, ${0.15 + pulseIntensity * 0.2})`;
  };
  
  // 結界のグロー強度
  const glowIntensity = 60 + pulseIntensity * 60;
  
  return (
    <>
      {/* 結界エフェクト（画面全体を覆う） */}
      <motion.div
        className={`fixed inset-0 pointer-events-none z-10 ${className}`}
        animate={{
          boxShadow: `inset 0 0 ${glowIntensity}px ${getBarrierColor()}`
        }}
        transition={{ duration: 1.5, ease: 'easeInOut' }}
      />
      
      {/* セキュリティステータスパネル */}
      <div className="fixed top-4 right-4 z-20">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-lg p-3 min-w-[200px]"
        >
          {/* ヘッダー */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-muted-foreground font-serif-jp">
              聖域の守護
            </span>
            <div className={`shrine-status-dot ${metrics.protectionStatus === 'warning' ? 'warning' : metrics.protectionStatus === 'active' ? 'active' : ''}`} />
          </div>
          
          {/* スコア表示 */}
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-2xl font-light font-mono text-foreground">
              {metrics.overallScore}
            </span>
            <span className="text-xs text-muted-foreground">/ 100</span>
          </div>
          
          {/* 結界強度バー */}
          <div className="mb-3">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>結界強度</span>
              <span>{Math.round(metrics.barrierStrength * 100)}%</span>
            </div>
            <div className="h-1 bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-shrine-jade rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${metrics.barrierStrength * 100}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>
          
          {/* 脅威レベルバー */}
          <div className="mb-4">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>脅威検知</span>
              <span>{Math.round(metrics.threatLevel * 100)}%</span>
            </div>
            <div className="h-1 bg-muted rounded-full overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${
                  metrics.threatLevel > 0.5 ? 'bg-shrine-vermilion' : 'bg-shrine-gold'
                }`}
                initial={{ width: 0 }}
                animate={{ width: `${metrics.threatLevel * 100}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>
          
          {/* インジケーター */}
          <div className="space-y-2">
            {metrics.indicators.map((indicator, index) => (
              <motion.div
                key={indicator.type}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex items-center gap-2"
              >
                <IndicatorIcon type={indicator.type} status={indicator.status} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-foreground">
                    {indicator.label}
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate">
                    {indicator.description}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
      
      {/* 警告メッセージ */}
      <AnimatePresence>
        {metrics.protectionStatus === 'warning' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-20"
          >
            <div className="bg-shrine-vermilion/20 border border-shrine-vermilion/30 rounded-lg px-4 py-2 backdrop-blur-sm">
              <p className="text-sm text-shrine-vermilion font-serif-jp">
                同調圧力が検出されています。判断の自由を守ってください。
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default SecurityBarrier;
