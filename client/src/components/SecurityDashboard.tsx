/**
 * Concordia Shrine - Security Dashboard Component
 * 
 * サイバーセキュリティとヒューマンセキュリティの関係を可視化
 * - 技術的なセキュリティ指標
 * - 心理的安全性の指標
 * - 両者の相互作用の可視化
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { SecurityMetrics } from '@/lib/conversationLog';
import type { SceneType } from '@/lib/waveEngine';
import { Button } from '@/components/ui/button';
import FactoryAnimation from './FactoryAnimation';

/**
 * SecurityDashboardコンポーネントのプロパティ
 */
interface SecurityDashboardProps {
  /** セキュリティメトリクス（総合スコア、結界の強さ、脅威レベルなど） */
  metrics: SecurityMetrics;
  /** 現在のシーン（静寂、調和、一方的、沈黙） */
  scene: SceneType;
  /** ダッシュボードが開いているかどうか */
  isOpen: boolean;
  /** ダッシュボードを閉じるコールバック */
  onClose: () => void;
}

// セキュリティレイヤーの説明
const securityLayers = [
  {
    id: 'cyber',
    name: 'サイバーセキュリティ',
    description: '技術的な防御層',
    items: [
      { name: '認証', description: 'ユーザーの身元を確認し不正アクセスを防止', icon: '🔐' },
      { name: '暗号化', description: '通信とデータを暗号化し盗聴を防止', icon: '🔒' },
      { name: 'アクセス制御', description: '権限に基づいたリソースへのアクセス管理', icon: '🛡️' },
      { name: '監査ログ', description: '操作履歴を記録し異常を検知', icon: '📋' }
    ]
  },
  {
    id: 'human',
    name: 'ヒューマンセキュリティ',
    description: '心理的な防御層',
    items: [
      { name: '同意の保護', description: '同調圧力から判断の自由を守る', icon: '💚' },
      { name: '空気の可視化', description: '見えない圧力を可視化し気づきを促す', icon: '🌊' },
      { name: '介入支援', description: '適切なタイミングで場の改善を促す', icon: '✨' },
      { name: '記録と振り返り', description: '対話を記録し後から振り返る機会を提供', icon: '📝' }
    ]
  }
];

// シーンごとの解説
const sceneExplanations: Record<SceneType, { cyber: string[]; human: string[]; relationship: string }> = {
  '静寂': {
    cyber: ['結界は安定しています。', '外部からの脅威は検知されていません。'],
    human: ['対話は穏やかに進行しています。', '特別な介入は必要ありません。'],
    relationship: 'サイバーセキュリティが安定した環境を提供し参加者は安心して対話できています'
  },
  '調和': {
    cyber: ['結界は最も強固な状態です。', '聖域は完全に保護されています。'],
    human: ['参加者間で良好なコミュニケーションが取れています', '心理的安全性が高い状態です'],
    relationship: '技術的な安全が心理的な安心を生みそれがさらに良い対話を促進しています。理想的な状態です'
  },
  '一方的': {
    cyber: ['結界は稼働を維持しています。', '外部からの脅威は検知されていません。'],
    human: ['一方的な発言が続いています', '他の参加者の発言機会が奪われている可能性があります'],
    relationship: '技術は環境を支えていますが、空気の変化に気づき整えるのは人の働きです。波の変化を気にかけてください'
  },
  '沈黙': {
    cyber: ['結界は安定しています。', '静かな余白を守っています。'],
    human: ['静かな余白が流れています', '沈黙は自然な時間です。祠が場をあたため、安心感を支えます'],
    relationship: '余白の可視化が安心感を生み、次の言葉が生まれる準備につながります'
  }
};

/**
 * SecurityDashboardコンポーネント
 * 
 * サイバーセキュリティとヒューマンセキュリティの関係を可視化するダッシュボード。
 * 技術的なセキュリティ指標と心理的安全性の指標の相互作用を示す。
 * 
 * 機能:
 * - 現在のシーンに応じたセキュリティ状態の説明
 * - サイバーセキュリティとヒューマンセキュリティの各レイヤーの詳細表示
 * - 両者の相互作用の可視化
 * - セキュリティの循環（技術的防御 → 安心感 → 自由な対話 → より良い判断）の図解
 * 
 * @param props - コンポーネントのプロパティ
 * @param props.metrics - セキュリティメトリクス（総合スコア、結界の強さ、脅威レベルなど）
 * @param props.scene - 現在のシーン（静寂、調和、一方的、沈黙）
 * @param props.isOpen - ダッシュボードが開いているかどうか
 * @param props.onClose - ダッシュボードを閉じるコールバック
 * @returns SecurityDashboardコンポーネント
 */
export function SecurityDashboard({ metrics, scene, isOpen, onClose }: SecurityDashboardProps) {
  const [activeLayer, setActiveLayer] = useState<'cyber' | 'human' | 'ai' | null>(null);
  const [isConceptOpen, setIsConceptOpen] = useState(false);
  const [isManjuOpen, setIsManjuOpen] = useState(false);
  const explanation = sceneExplanations[scene];
  
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
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
          />
          
          {/* ダッシュボード本体 */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-4 md:inset-8 lg:inset-16 bg-card border border-border rounded-xl z-50 overflow-hidden flex flex-col"
          >
            {/* ヘッダー */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div>
                <h2 className="text-lg font-serif-jp text-foreground">セキュリティダッシュボード</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  サイバーセキュリティとヒューマンセキュリティの相互作用
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
            <div className="flex-1 overflow-y-auto p-4 md:p-6">
              {/* コンセプト説明 */}
              <div className="mb-8 p-4 bg-muted/30 rounded-lg border border-border/50">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-foreground mb-2">
                      「ヒューマンセキュリティなくしてサイバーセキュリティは実現しない」
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      対話の場では、ヒューマンセキュリティとサイバーセキュリティの相乗効果が情報の重みを育てます。
                      どちらか一方だけでは成り立たず、支え合ってこそ真価を発揮します。
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="self-start text-xs"
                    onClick={() => setIsConceptOpen(prev => !prev)}
                  >
                    {isConceptOpen ? '閉じる' : 'もっとくわしく'}
                  </Button>
                </div>
                {isConceptOpen && (
                  <div className="mt-6 flex flex-col gap-6">
                    <div className="text-sm text-foreground leading-relaxed whitespace-pre-line">
                      {`サイバーセキュリティは"すでに情報がある"世界を前提に成り立つ。

ここで「対話」という場面にしぼって考えると、重要な情報はログや文書としてではなくまずは人と人の1on1で立ち上がる。
問題は対話が行われる環境だ。
立場の差や暗黙の了解、察しを求める空気の中では、人は発話を無意識に制限し、重要な情報ほど自己検閲で削ぎ落とされてしまう。
私はこれを、発話制約を内包した「心理的に非安全な環境」と捉えたい。
そこで生まれる情報は、サイバーセキュリティが守る以前にすでに意味的な「重み」を失っている。
情報が十分に生成されなければ、暗号化やアクセス制御の議論は本質に届かない。

だからこそヒューマンセキュリティは倫理の話にとどまらず、情報が正確かつ十分に生成されるための前提条件でもある。
これと同時に技術的に信頼できる基盤がなければ人は安心して語ることができず、ヒューマンセキュリティは空洞化してしまう。
対話という最小単位の場面では、両者は相互に支え合っている。`}
                    </div>
                    <div>
                      <p className="mb-3 text-xs text-muted-foreground leading-relaxed">
                        お饅頭工場をイメージしてみましょう。ここでは2人の作業員がお饅頭を作り、
                        2台のロボットアームが包装とリボン掛けを担当しています。
                      </p>
                      <FactoryAnimation />
                    </div>
                  </div>
                )}
                
                {/* 因果連鎖図：左右対比レイアウト（旧バージョン - 必要に応じて削除可能） */}
                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8" style={{ display: 'none' }}>
                  {/* 左側：うまくいくパターン */}
                  <div className="flex flex-col">
                    <h4 className="text-sm font-medium text-shrine-jade text-center mb-3">両方が担保されている場合</h4>
                    <div className="relative mx-auto w-[300px] h-[400px]">
                      <svg viewBox="0 0 300 400" className="absolute inset-0 w-full h-full">
                        <defs>
                          <linearGradient id="human-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="var(--shrine-jade)" stopOpacity="0.7" />
                            <stop offset="100%" stopColor="var(--shrine-jade)" stopOpacity="0.9" />
                          </linearGradient>
                          <linearGradient id="cyber-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="var(--shrine-barrier)" stopOpacity="0.7" />
                            <stop offset="100%" stopColor="var(--shrine-barrier)" stopOpacity="0.9" />
                          </linearGradient>
                          <linearGradient id="merge-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="var(--shrine-gold)" stopOpacity="0.8" />
                            <stop offset="100%" stopColor="var(--shrine-gold)" stopOpacity="1" />
                          </linearGradient>
                          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                            <feGaussianBlur stdDeviation="4" result="blur" />
                            <feMerge>
                              <feMergeNode in="blur" />
                              <feMergeNode in="SourceGraphic" />
                            </feMerge>
                          </filter>
                        </defs>

                        {/* ヒューマン → 話しやすい空気 */}
                        <line x1="75" y1="45" x2="75" y2="95" stroke="url(#human-gradient)" strokeWidth="4" strokeLinecap="round" filter="url(#glow)" />
                        {/* 話しやすい空気 → 合流 */}
                        <path d="M 75 140 Q 75 175 150 195" fill="none" stroke="url(#human-gradient)" strokeWidth="5" strokeLinecap="round" filter="url(#glow)" />

                        {/* サイバー → 信頼できる基盤 */}
                        <line x1="225" y1="45" x2="225" y2="95" stroke="url(#cyber-gradient)" strokeWidth="4" strokeLinecap="round" filter="url(#glow)" />
                        {/* 信頼できる基盤 → 合流 */}
                        <path d="M 225 140 Q 225 175 150 195" fill="none" stroke="url(#cyber-gradient)" strokeWidth="5" strokeLinecap="round" filter="url(#glow)" />

                        {/* しっかりアウトプット → 対話情報 */}
                        <line x1="150" y1="240" x2="150" y2="275" stroke="url(#merge-gradient)" strokeWidth="6" strokeLinecap="round" filter="url(#glow)" />
                        {/* 対話情報 → 情報の重み */}
                        <line x1="150" y1="320" x2="150" y2="355" stroke="url(#merge-gradient)" strokeWidth="7" strokeLinecap="round" filter="url(#glow)" />
                      </svg>

                      {/* ノード：ヒューマンセキュリティ */}
                      <motion.div
                        className="absolute flex flex-col items-center"
                        style={{ top: '0px', left: '75px', transform: 'translateX(-50%)' }}
                        animate={{ scale: [1, 1.03, 1] }}
                        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                      >
                        <div className="flex items-center justify-center w-11 h-11 rounded-full bg-card border-2 border-shrine-jade/70 shadow-lg ring-2 ring-shrine-jade/40">
                          <span className="text-base">💚</span>
                        </div>
                        <span className="mt-1 text-[9px] font-medium text-foreground text-center leading-tight">
                          ヒューマン<br />セキュリティ
                        </span>
                      </motion.div>

                      {/* ノード：サイバーセキュリティ */}
                      <motion.div
                        className="absolute flex flex-col items-center"
                        style={{ top: '0px', left: '225px', transform: 'translateX(-50%)' }}
                        animate={{ scale: [1, 1.03, 1] }}
                        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
                      >
                        <div className="flex items-center justify-center w-11 h-11 rounded-full bg-card border-2 border-shrine-barrier/70 shadow-lg ring-2 ring-shrine-barrier/40">
                          <span className="text-base">🛡️</span>
                        </div>
                        <span className="mt-1 text-[9px] font-medium text-foreground text-center leading-tight">
                          サイバー<br />セキュリティ
                        </span>
                      </motion.div>

                      {/* ノード：話しやすい空気 */}
                      <motion.div
                        className="absolute flex flex-col items-center"
                        style={{ top: '95px', left: '75px', transform: 'translateX(-50%)' }}
                        animate={{ opacity: [0.85, 1, 0.85] }}
                        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
                      >
                        <div className="flex items-center justify-center w-11 h-11 rounded-full bg-card/95 border-2 border-shrine-jade/60 shadow-md">
                          <span className="text-base">🍃</span>
                        </div>
                        <span className="mt-1 text-[9px] text-foreground/90 text-center">話しやすい空気</span>
                      </motion.div>

                      {/* ノード：信頼できる基盤 */}
                      <motion.div
                        className="absolute flex flex-col items-center"
                        style={{ top: '95px', left: '225px', transform: 'translateX(-50%)' }}
                        animate={{ opacity: [0.85, 1, 0.85] }}
                        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 0.8 }}
                      >
                        <div className="flex items-center justify-center w-11 h-11 rounded-full bg-card/95 border-2 border-shrine-barrier/60 shadow-md">
                          <span className="text-base">🔐</span>
                        </div>
                        <span className="mt-1 text-[9px] text-foreground/90 text-center">信頼できる基盤</span>
                      </motion.div>

                      {/* 合流ノード：しっかりアウトプット */}
                      <motion.div
                        className="absolute flex flex-col items-center"
                        style={{ top: '195px', left: '150px', transform: 'translate(-50%, -50%)' }}
                        animate={{ scale: [1, 1.04, 1] }}
                        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                      >
                        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-card border-2 border-shrine-gold/60 shadow-lg ring-2 ring-shrine-gold/30">
                          <span className="text-lg">🗣️</span>
                        </div>
                        <span className="mt-1 text-[10px] font-medium text-foreground/90 text-center">しっかりアウトプット</span>
                      </motion.div>

                      {/* ノード：対話情報 */}
                      <motion.div
                        className="absolute flex flex-col items-center"
                        style={{ top: '275px', left: '150px', transform: 'translate(-50%, -50%)' }}
                        animate={{ scale: [1, 1.05, 1] }}
                        transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
                      >
                        <div className="flex items-center justify-center w-13 h-13 rounded-full bg-card border-2 border-shrine-gold/70 shadow-lg ring-2 ring-shrine-gold/40" style={{ width: '52px', height: '52px' }}>
                          <span className="text-lg">📝</span>
                        </div>
                        <span className="mt-1 text-[10px] font-medium text-foreground/90 text-center">対話情報</span>
                      </motion.div>

                      {/* 最終ノード：情報の重み・価値 */}
                      <motion.div
                        className="absolute flex flex-col items-center"
                        style={{ top: '355px', left: '150px', transform: 'translate(-50%, -50%)' }}
                        animate={{ scale: [1, 1.06, 1], opacity: [0.9, 1, 0.9] }}
                        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                      >
                        <div className="flex items-center justify-center rounded-full bg-card shadow-xl ring-4 ring-shrine-gold/40" style={{ width: '56px', height: '56px', borderWidth: '3px', borderColor: 'var(--shrine-gold)', borderStyle: 'solid' }}>
                          <span className="text-xl">⚖️</span>
                        </div>
                        <span className="mt-1.5 text-[11px] font-bold text-foreground text-center">
                          情報の重み・価値
                        </span>
                      </motion.div>
                    </div>
                    <p className="mt-3 text-xs text-shrine-jade text-center font-medium">情報が「重く」なる</p>
                  </div>

                  {/* 右側：うまくいかないパターン */}
                  <div className="flex flex-col">
                    <h4 className="text-sm font-medium text-shrine-vermilion text-center mb-3">どちらかが欠けている場合</h4>
                    <div className="relative mx-auto w-[300px] h-[400px]">
                      <svg viewBox="0 0 300 400" className="absolute inset-0 w-full h-full">
                        <defs>
                          <linearGradient id="human-gradient-weak" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="var(--shrine-jade)" stopOpacity="0.4" />
                            <stop offset="100%" stopColor="var(--shrine-jade)" stopOpacity="0.6" />
                          </linearGradient>
                          <linearGradient id="cyber-gradient-weak" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="var(--shrine-barrier)" stopOpacity="0.4" />
                            <stop offset="100%" stopColor="var(--shrine-barrier)" stopOpacity="0.6" />
                          </linearGradient>
                          <linearGradient id="merge-gradient-weak" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="var(--muted-foreground)" stopOpacity="0.5" />
                            <stop offset="100%" stopColor="var(--muted-foreground)" stopOpacity="0.7" />
                          </linearGradient>
                        </defs>

                        {/* ヒューマン → 話しにくい空気 */}
                        <line x1="75" y1="45" x2="75" y2="95" stroke="url(#human-gradient-weak)" strokeWidth="3" strokeLinecap="round" strokeDasharray="6 6" />
                        {/* 話しにくい空気 → 合流 */}
                        <path d="M 75 140 Q 75 175 150 195" fill="none" stroke="url(#human-gradient-weak)" strokeWidth="3" strokeLinecap="round" strokeDasharray="6 6" />

                        {/* サイバー → 不安定な基盤 */}
                        <line x1="225" y1="45" x2="225" y2="95" stroke="url(#cyber-gradient-weak)" strokeWidth="3" strokeLinecap="round" strokeDasharray="6 6" />
                        {/* 不安定な基盤 → 合流 */}
                        <path d="M 225 140 Q 225 175 150 195" fill="none" stroke="url(#cyber-gradient-weak)" strokeWidth="3" strokeLinecap="round" strokeDasharray="6 6" />

                        {/* アウトプット不足 → 不十分な情報 */}
                        <line x1="150" y1="240" x2="150" y2="275" stroke="url(#merge-gradient-weak)" strokeWidth="3" strokeLinecap="round" strokeDasharray="6 6" />
                        {/* 不十分な情報 → 軽い情報 */}
                        <line x1="150" y1="320" x2="150" y2="355" stroke="url(#merge-gradient-weak)" strokeWidth="3" strokeLinecap="round" strokeDasharray="6 6" />
                      </svg>

                      {/* ノード：ヒューマンセキュリティ（薄い） */}
                      <div
                        className="absolute flex flex-col items-center opacity-70"
                        style={{ top: '0px', left: '75px', transform: 'translateX(-50%)' }}
                      >
                        <div className="flex items-center justify-center w-11 h-11 rounded-full bg-card/80 border border-shrine-jade/50 shadow-sm">
                          <span className="text-base opacity-80">💚</span>
                        </div>
                        <span className="mt-1 text-[9px] font-medium text-muted-foreground text-center leading-tight">
                          ヒューマン<br />セキュリティ
                        </span>
                      </div>

                      {/* ノード：サイバーセキュリティ（薄い） */}
                      <div
                        className="absolute flex flex-col items-center opacity-70"
                        style={{ top: '0px', left: '225px', transform: 'translateX(-50%)' }}
                      >
                        <div className="flex items-center justify-center w-11 h-11 rounded-full bg-card/80 border border-shrine-barrier/50 shadow-sm">
                          <span className="text-base opacity-80">🛡️</span>
                        </div>
                        <span className="mt-1 text-[9px] font-medium text-muted-foreground text-center leading-tight">
                          サイバー<br />セキュリティ
                        </span>
                      </div>

                      {/* ノード：話しにくい空気（薄い） */}
                      <div
                        className="absolute flex flex-col items-center opacity-70"
                        style={{ top: '95px', left: '75px', transform: 'translateX(-50%)' }}
                      >
                        <div className="flex items-center justify-center w-11 h-11 rounded-full bg-card/80 border border-shrine-jade/40 shadow-sm">
                          <span className="text-base opacity-80">🍃</span>
                        </div>
                        <span className="mt-1 text-[9px] text-muted-foreground text-center">話しにくい空気</span>
                      </div>

                      {/* ノード：不安定な基盤（薄い） */}
                      <div
                        className="absolute flex flex-col items-center opacity-70"
                        style={{ top: '95px', left: '225px', transform: 'translateX(-50%)' }}
                      >
                        <div className="flex items-center justify-center w-11 h-11 rounded-full bg-card/80 border border-shrine-barrier/40 shadow-sm">
                          <span className="text-base opacity-80">🔐</span>
                        </div>
                        <span className="mt-1 text-[9px] text-muted-foreground text-center">不安定な基盤</span>
                      </div>

                      {/* 合流ノード：アウトプット不足（小さく） */}
                      <div
                        className="absolute flex flex-col items-center opacity-70"
                        style={{ top: '195px', left: '150px', transform: 'translate(-50%, -50%)' }}
                      >
                        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-card/80 border border-muted-foreground/50 shadow-sm">
                          <span className="text-sm opacity-80">🗣️</span>
                        </div>
                        <span className="mt-1 text-[9px] text-muted-foreground text-center">アウトプット不足</span>
                      </div>

                      {/* ノード：不十分な対話情報（さらに小さく） */}
                      <div
                        className="absolute flex flex-col items-center opacity-70"
                        style={{ top: '275px', left: '150px', transform: 'translate(-50%, -50%)' }}
                      >
                        <div className="flex items-center justify-center w-9 h-9 rounded-full bg-card/80 border border-muted-foreground/50 shadow-sm">
                          <span className="text-sm opacity-80">📝</span>
                        </div>
                        <span className="mt-1 text-[9px] text-muted-foreground text-center">不十分な情報</span>
                      </div>

                      {/* 最終ノード：軽い情報（最小） */}
                      <div
                        className="absolute flex flex-col items-center opacity-70"
                        style={{ top: '355px', left: '150px', transform: 'translate(-50%, -50%)' }}
                      >
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-card/80 border border-muted-foreground/50 shadow-sm">
                          <span className="text-xs opacity-80">⚖️</span>
                        </div>
                        <span className="mt-1 text-[9px] text-muted-foreground text-center">
                          軽い情報
                        </span>
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-shrine-vermilion text-center font-medium">情報が「軽く」なる</p>
                  </div>
                </div>
              </div>

              
              {/* 現在の状態 */}
              <div className="mb-8">
                <h3 className="text-sm font-medium text-muted-foreground mb-4">現在の状態: {scene}</h3>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="p-4 bg-shrine-barrier/10 rounded-lg border border-shrine-barrier/20">
                    <div className="text-xs text-shrine-barrier mb-2">サイバーセキュリティ</div>
                    <p className="text-sm text-foreground">
                      {explanation.cyber.map((line, index) => (
                        <span key={index}>
                          {line}
                          {index < explanation.cyber.length - 1 && <br />}
                        </span>
                      ))}
                    </p>
                  </div>
                  <div className="p-4 bg-shrine-jade/10 rounded-lg border border-shrine-jade/20">
                    <div className="text-xs text-shrine-jade mb-2">ヒューマンセキュリティ</div>
                    <p className="text-sm text-foreground">
                      {explanation.human.map((line, index) => (
                        <span key={index}>
                          {line}
                          {index < explanation.human.length - 1 && <br />}
                        </span>
                      ))}
                    </p>
                  </div>
                  <div className="p-4 bg-shrine-gold/10 rounded-lg border border-shrine-gold/20">
                    <div className="text-xs text-shrine-gold mb-2">相互作用</div>
                    <p className="text-sm text-foreground">{explanation.relationship}</p>
                  </div>
                </div>
              </div>
              
              {/* セキュリティレイヤー */}
              <div className="grid md:grid-cols-2 gap-6">
                {securityLayers.map((layer) => (
                  <motion.div
                    key={layer.id}
                    className={`p-4 rounded-lg border transition-colors cursor-pointer ${
                      activeLayer === layer.id
                        ? 'bg-primary/10 border-primary/30'
                        : 'bg-muted/20 border-border/50 hover:bg-muted/30'
                    }`}
                    onClick={() => setActiveLayer(activeLayer === layer.id ? null : layer.id as 'cyber' | 'human' | 'ai')}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-medium text-foreground">{layer.name}</h4>
                    </div>
                    
                    <div className="space-y-2">
                      {layer.items.map((item, index) => (
                        <motion.div
                          key={item.name}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className="flex items-start gap-3 p-2 bg-background/50 rounded-lg"
                        >
                          <span className="text-lg">{item.icon}</span>
                          <div>
                            <div className="text-xs font-medium text-foreground">{item.name}</div>
                            <div className="text-[10px] text-muted-foreground">{item.description}</div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                ))}
              </div>
              
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default SecurityDashboard;
