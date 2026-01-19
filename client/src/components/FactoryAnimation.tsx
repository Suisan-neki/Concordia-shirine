/**
 * Concordia Shrine - Factory Animation Component
 * 
 * ヒューマンセキュリティとサイバーセキュリティの相互依存関係を
 * 食品工場のレーンのメタファーで表現するアニメーション
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type Scenario = 'ideal' | 'human-failure' | 'cyber-failure';

interface FactoryAnimationProps {
  /** 初期シナリオ */
  initialScenario?: Scenario;
}

/**
 * FactoryAnimationコンポーネント
 * 
 * お饅頭工場のレーンを使って、ヒューマンセキュリティとサイバーセキュリティの
 * 相互依存関係を視覚的に表現する。
 */
export function FactoryAnimation({ initialScenario = 'ideal' }: FactoryAnimationProps) {
  const [scenario, setScenario] = useState<Scenario>(initialScenario);
  const [animationKey, setAnimationKey] = useState(0);

  // シナリオが変更されたらアニメーションをリセット
  useEffect(() => {
    setAnimationKey(prev => prev + 1);
  }, [scenario]);

  const isIdeal = scenario === 'ideal';
  const isHumanFailure = scenario === 'human-failure';
  const isCyberFailure = scenario === 'cyber-failure';

  return (
    <div className="w-full">
      {/* シナリオ切り替えボタン */}
      <div className="flex flex-wrap gap-2 mb-6 justify-center">
        <button
          onClick={() => setScenario('ideal')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            isIdeal
              ? 'bg-shrine-gold text-white shadow-lg'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          理想状態（両方◎）
        </button>
        <button
          onClick={() => setScenario('human-failure')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            isHumanFailure
              ? 'bg-shrine-vermilion text-white shadow-lg'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          ヒューマン欠如
        </button>
        <button
          onClick={() => setScenario('cyber-failure')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            isCyberFailure
              ? 'bg-shrine-vermilion text-white shadow-lg'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          サイバー欠如
        </button>
      </div>

      {/* 工場アニメーション */}
      <div className="relative w-full bg-gradient-to-b from-muted/30 to-muted/10 rounded-xl border border-border overflow-hidden" style={{ minHeight: '400px' }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={animationKey}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full h-full p-8"
          >
            {/* 工場レイアウト */}
            <div className="relative w-full h-full flex items-center">
              {/* 左側: ヒューマンセキュリティエリア */}
              <div className="flex-shrink-0 w-1/4 flex flex-col items-center justify-center">
                <div className="text-xs font-medium mb-4 text-center" style={{ color: isHumanFailure ? 'var(--shrine-vermilion)' : 'var(--shrine-jade)' }}>
                  ヒューマンセキュリティ
                </div>
                
                {/* 作業員 */}
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.5 }}
                  className="relative"
                >
                  {isHumanFailure ? (
                    // 対立的な作業員
                    <div className="flex gap-4">
                      <WorkerSVG mood="angry" />
                      <WorkerSVG mood="angry" />
                    </div>
                  ) : (
                    // 協力的な作業員
                    <div className="flex gap-4">
                      <WorkerSVG mood="happy" />
                      <WorkerSVG mood="happy" />
                    </div>
                  )}
                </motion.div>

                {/* 説明テキスト */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="mt-4 text-xs text-center text-muted-foreground max-w-[150px]"
                >
                  {isHumanFailure ? '対立的な雰囲気' : '協力的な雰囲気'}
                </motion.div>
              </div>

              {/* 中央: ベルトコンベア */}
              <div className="flex-1 relative" style={{ height: '200px' }}>
                {/* レーン */}
                <div className="absolute top-1/2 left-0 right-0 transform -translate-y-1/2">
                  <ConveyorBelt />
                  
                  {/* お饅頭のアニメーション */}
                  <motion.div
                    initial={{ x: -50, opacity: 0 }}
                    animate={{ x: '100%', opacity: [0, 1, 1, 1, 0] }}
                    transition={{
                      duration: 4,
                      delay: 1,
                      ease: 'linear',
                      opacity: { times: [0, 0.1, 0.8, 0.9, 1] }
                    }}
                    className="absolute top-1/2 left-0 transform -translate-y-1/2"
                  >
                    <Manju quality={isHumanFailure ? 'poor' : 'good'} wrapped={false} />
                  </motion.div>
                </div>
              </div>

              {/* 右側: サイバーセキュリティエリア */}
              <div className="flex-shrink-0 w-1/4 flex flex-col items-center justify-center">
                <div className="text-xs font-medium mb-4 text-center" style={{ color: isCyberFailure ? 'var(--shrine-vermilion)' : 'var(--shrine-barrier)' }}>
                  サイバーセキュリティ
                </div>

                {/* 包装機 */}
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                >
                  <PackagingMachine working={!isCyberFailure} />
                </motion.div>

                {/* 説明テキスト */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8 }}
                  className="mt-4 text-xs text-center text-muted-foreground max-w-[150px]"
                >
                  {isCyberFailure ? '包装機能せず' : 'しっかり包装'}
                </motion.div>
              </div>
            </div>

            {/* 最終製品の表示 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 5, duration: 0.5 }}
              className="absolute bottom-8 right-8"
            >
              <FinalProduct
                quality={isHumanFailure ? 'poor' : 'good'}
                protected={!isCyberFailure}
              />
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* 説明文 */}
      <motion.div
        key={`explanation-${scenario}`}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-6 p-4 rounded-lg bg-muted/30 border border-border"
      >
        <p className="text-sm text-foreground leading-relaxed">
          {isIdeal && (
            <>
              <span className="font-medium text-shrine-gold">✨ 理想状態:</span> 
              協力的な雰囲気の中で高品質な情報（お饅頭）が生成され、技術的な保護（包装）によってしっかりと守られます。
              両方が揃って初めて、価値ある情報が完成します。
            </>
          )}
          {isHumanFailure && (
            <>
              <span className="font-medium text-shrine-vermilion">⚠️ ヒューマンセキュリティの欠如:</span> 
              対立的な雰囲気では、低品質な情報（ぐしゃぐしゃのお饅頭）しか生成されません。
              いくら技術的に保護しても、中身が粗悪では意味がありません。
            </>
          )}
          {isCyberFailure && (
            <>
              <span className="font-medium text-shrine-vermilion">⚠️ サイバーセキュリティの欠如:</span> 
              協力的な雰囲気で高品質な情報が生成されても、技術的な保護がなければ外部に漏れたり改ざんされたりして、
              価値が損なわれてしまいます。
            </>
          )}
        </p>
      </motion.div>
    </div>
  );
}

/**
 * 作業員のSVGコンポーネント
 */
function WorkerSVG({ mood }: { mood: 'happy' | 'angry' }) {
  const isHappy = mood === 'happy';
  
  return (
    <svg width="60" height="80" viewBox="0 0 60 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* 体 */}
      <rect x="15" y="35" width="30" height="40" rx="2" fill="white" stroke="currentColor" strokeWidth="1.5" />
      
      {/* エプロン */}
      <path d="M 20 35 L 20 75 L 40 75 L 40 35" fill="none" stroke="currentColor" strokeWidth="1.5" />
      
      {/* 頭 */}
      <circle cx="30" cy="20" r="12" fill="white" stroke="currentColor" strokeWidth="1.5" />
      
      {/* キャップ */}
      <ellipse cx="30" cy="12" rx="14" ry="6" fill="white" stroke="currentColor" strokeWidth="1.5" />
      
      {/* 顔 */}
      {isHappy ? (
        <>
          {/* 笑顔 */}
          <circle cx="26" cy="18" r="1.5" fill="currentColor" />
          <circle cx="34" cy="18" r="1.5" fill="currentColor" />
          <path d="M 24 24 Q 30 27 36 24" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          {/* 怒り顔 */}
          <line x1="24" y1="16" x2="28" y2="18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="32" y1="18" x2="36" y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M 24 26 Q 30 23 36 26" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </>
      )}
      
      {/* 手袋 */}
      <circle cx="12" cy="50" r="4" fill="lightblue" opacity="0.7" />
      <circle cx="48" cy="50" r="4" fill="lightblue" opacity="0.7" />
    </svg>
  );
}

/**
 * ベルトコンベアのコンポーネント
 */
function ConveyorBelt() {
  return (
    <div className="relative w-full h-16 bg-gradient-to-b from-slate-400 to-slate-500 rounded-lg border-2 border-slate-600 overflow-hidden">
      {/* ベルトの動き */}
      <motion.div
        className="absolute inset-0 flex items-center"
        initial={{ x: 0 }}
        animate={{ x: -20 }}
        transition={{
          duration: 1,
          repeat: Infinity,
          ease: 'linear'
        }}
      >
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="w-5 h-1 bg-slate-600/50 mx-2"
            style={{ minWidth: '20px' }}
          />
        ))}
      </motion.div>
      
      {/* ライト */}
      <motion.div
        className="absolute bottom-1 left-0 right-0 flex justify-around"
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        {[...Array(8)].map((_, i) => (
          <div key={i} className="w-2 h-2 rounded-full bg-cyan-400" />
        ))}
      </motion.div>
    </div>
  );
}

/**
 * お饅頭のコンポーネント
 */
function Manju({ quality, wrapped }: { quality: 'good' | 'poor'; wrapped: boolean }) {
  const isGood = quality === 'good';
  
  return (
    <div className="relative">
      {wrapped && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute inset-0 bg-transparent border-2 border-dashed border-shrine-barrier rounded-lg"
          style={{ width: '60px', height: '60px', transform: 'translate(-10px, -10px)' }}
        />
      )}
      
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        {isGood ? (
          // 綺麗なお饅頭
          <>
            <ellipse cx="20" cy="25" rx="15" ry="10" fill="#F5E6D3" stroke="#D4A574" strokeWidth="1.5" />
            <ellipse cx="20" cy="18" rx="12" ry="10" fill="#F5E6D3" stroke="#D4A574" strokeWidth="1.5" />
            <path d="M 15 18 Q 20 20 25 18" stroke="#D4A574" strokeWidth="1" fill="none" />
          </>
        ) : (
          // ぐしゃぐしゃのお饅頭
          <>
            <path
              d="M 10 25 Q 15 30 20 28 Q 25 26 30 30 Q 28 20 25 18 Q 20 15 15 20 Q 12 22 10 25"
              fill="#B8A080"
              stroke="#8B7355"
              strokeWidth="1.5"
            />
            <circle cx="18" cy="22" r="2" fill="#8B7355" opacity="0.5" />
            <circle cx="24" cy="25" r="1.5" fill="#8B7355" opacity="0.5" />
          </>
        )}
      </svg>
    </div>
  );
}

/**
 * 包装機のコンポーネント
 */
function PackagingMachine({ working }: { working: boolean }) {
  return (
    <div className="relative">
      <svg width="80" height="100" viewBox="0 0 80 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* 機械本体 */}
        <rect x="10" y="20" width="60" height="60" rx="4" fill="white" stroke="currentColor" strokeWidth="2" />
        <rect x="15" y="25" width="50" height="20" rx="2" fill={working ? '#3b82f6' : '#9ca3af'} opacity="0.3" />
        
        {/* アーム */}
        <motion.g
          animate={working ? { y: [0, 10, 0] } : {}}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <rect x="30" y="45" width="20" height="4" rx="2" fill="currentColor" />
          <rect x="38" y="49" width="4" height="15" rx="2" fill="currentColor" />
        </motion.g>
        
        {/* インジケーター */}
        <motion.circle
          cx="25"
          cy="35"
          r="3"
          fill={working ? '#10b981' : '#ef4444'}
          animate={working ? { opacity: [0.5, 1, 0.5] } : {}}
          transition={{ duration: 1, repeat: Infinity }}
        />
        
        {/* 台座 */}
        <rect x="5" y="80" width="70" height="15" rx="2" fill="currentColor" opacity="0.2" />
      </svg>
      
      {!working && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
        >
          <div className="text-3xl">⚠️</div>
        </motion.div>
      )}
    </div>
  );
}

/**
 * 最終製品のコンポーネント
 */
function FinalProduct({ quality, protected: isProtected }: { quality: 'good' | 'poor'; protected: boolean }) {
  const isSuccess = quality === 'good' && isProtected;
  
  return (
    <div className="flex flex-col items-center">
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        className={`relative p-4 rounded-lg border-2 ${
          isSuccess
            ? 'bg-shrine-gold/10 border-shrine-gold shadow-lg shadow-shrine-gold/20'
            : 'bg-muted/50 border-muted-foreground/30'
        }`}
      >
        <Manju quality={quality} wrapped={isProtected} />
        
        {isSuccess && (
          <motion.div
            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute -top-2 -right-2 text-2xl"
          >
            ✨
          </motion.div>
        )}
      </motion.div>
      
      <div className={`mt-2 text-xs font-medium ${isSuccess ? 'text-shrine-gold' : 'text-muted-foreground'}`}>
        {isSuccess ? '価値ある情報' : '価値のない情報'}
      </div>
    </div>
  );
}
