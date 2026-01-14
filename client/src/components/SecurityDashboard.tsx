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
      { name: '同意保護', description: '同調圧力から判断の自由を守る', icon: '💚' },
      { name: '空気の可視化', description: '見えない圧力を可視化し気づきを促す', icon: '🌊' },
      { name: '介入支援', description: '適切なタイミングで場の改善を促す', icon: '✨' },
      { name: '記録と振り返り', description: '対話を記録し後から振り返る機会を提供', icon: '📝' }
    ]
  },
  {
    id: 'ai',
    name: 'AI時代のセキュリティ',
    description: 'AI特有の脅威に対する防御層',
    items: [
      { name: 'プロンプトインジェクション対策', description: 'LLMへの悪意ある指示を検出・ブロック', icon: '🛡️' },
      { name: 'モデルポイズニング対策', description: '外部APIの信頼性とレスポンスの整合性を検証', icon: '🔍' },
      { name: 'データポイズニング対策', description: '外部データの信頼性を検証', icon: '✅' },
      { name: 'メンバーシップ推論攻撃対策', description: '学習データの漏洩を防止', icon: '🔒' },
      { name: 'モデル反転攻撃対策', description: '機密情報の漏洩を防止', icon: '🛡️' },
      { name: 'シャドウモデル対策', description: 'モデル出力の異常を検知', icon: '👁️' },
      { name: 'AIサプライチェーン攻撃対策', description: '外部依存関係の信頼性を検証', icon: '🔗' },
      { name: 'アライメント破壊対策', description: '安全制約の検証と違反検出', icon: '⚖️' },
      { name: 'ソーシャルエンジニアリング対策', description: 'AI生成コンテンツの検証', icon: '🎭' },
      { name: 'AIガバナンス / AIセーフティ', description: '監査と運用フレームワーク', icon: '📊' }
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
    cyber: ['結界に負荷がかかっています。', '同調圧力という内部脅威を検知しました。'],
    human: ['一方的な発言が続いています', '他の参加者の発言機会が奪われている可能性があります'],
    relationship: '技術は脅威を検知していますが最終的に状況を改善するのは人間の行動です。波の変化に気づいてください'
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
                <h3 className="text-sm font-medium text-foreground mb-2">
                  「ヒューマンセキュリティなくしてサイバーセキュリティは実現しない」
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  従来のセキュリティはデータやネットワークを守ることに焦点を当ててきました。
                  <br />
                  しかしConcordia Shrineは「人の判断の自由」を守ることを目指します。
                  <br />
                  技術的な防御（サイバーセキュリティ）が心理的な安全（ヒューマンセキュリティ）を支え、その逆もまた真なのです。
                </p>
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
                      <span className="text-xs text-muted-foreground">{layer.description}</span>
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
              
              {/* 相互作用の図解 */}
              <div className="mt-8 p-6 bg-muted/20 rounded-lg border border-border/50">
                <h3 className="text-sm font-medium text-foreground mb-4 text-center">
                  セキュリティの循環
                </h3>
                <div className="flex items-center justify-center gap-4 flex-wrap">
                  <div className="text-center">
                    <div className="w-20 h-20 rounded-full bg-shrine-barrier/20 border-2 border-shrine-barrier/40 flex items-center justify-center mb-2">
                      <span className="text-2xl">🔐</span>
                    </div>
                    <span className="text-xs text-muted-foreground">技術的防御</span>
                  </div>
                  
                  <svg className="w-8 h-8 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                  
                  <div className="text-center">
                    <div className="w-20 h-20 rounded-full bg-shrine-jade/20 border-2 border-shrine-jade/40 flex items-center justify-center mb-2">
                      <span className="text-2xl">🛡️</span>
                    </div>
                    <span className="text-xs text-muted-foreground">安心感</span>
                  </div>
                  
                  <svg className="w-8 h-8 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                  
                  <div className="text-center">
                    <div className="w-20 h-20 rounded-full bg-shrine-gold/20 border-2 border-shrine-gold/40 flex items-center justify-center mb-2">
                      <span className="text-2xl">💬</span>
                    </div>
                    <span className="text-xs text-muted-foreground">自由な対話</span>
                  </div>
                  
                  <svg className="w-8 h-8 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                  
                  <div className="text-center">
                    <div className="w-20 h-20 rounded-full bg-primary/20 border-2 border-primary/40 flex items-center justify-center mb-2">
                      <span className="text-2xl">✨</span>
                    </div>
                    <span className="text-xs text-muted-foreground">より良い判断</span>
                  </div>
                </div>
                
                <p className="text-xs text-muted-foreground text-center mt-4">
                  技術が安心を生み安心が自由な対話を促し自由な対話がより良い判断につながります
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default SecurityDashboard;
