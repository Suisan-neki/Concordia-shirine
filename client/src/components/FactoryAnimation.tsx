/**
 * Concordia Shrine - Factory Animation Component (L-Shape Layout)
 * 
 * ヒューマンセキュリティとサイバーセキュリティの相互依存関係を
 * 食品工場のL字型レーンのメタファーで表現するアニメーション
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
 * お饅頭工場のL字型レーンを使って、ヒューマンセキュリティとサイバーセキュリティの
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
      <div className="relative w-full bg-gradient-to-b from-muted/30 to-muted/10 rounded-xl border border-border overflow-hidden" style={{ minHeight: '500px', height: '500px' }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={animationKey}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full h-full p-8 relative"
          >
            {/* 左側: ヒューマンセキュリティエリア（作業員） */}
            <div className="absolute top-8 left-8 flex flex-col items-center">
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
                  <div className="flex gap-4">
                    <WorkerWithHand mood="angry" animationKey={animationKey} />
                  </div>
                ) : (
                  <div className="flex gap-4">
                    <WorkerWithHand mood="happy" animationKey={animationKey} />
                  </div>
                )}
              </motion.div>

              {/* 説明テキスト */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="mt-4 text-xs text-center text-muted-foreground max-w-[120px]"
              >
                {isHumanFailure ? '対立的な雰囲気' : '協力的な雰囲気'}
              </motion.div>
            </div>

            {/* 横レーン（上部） */}
            <div className="absolute top-32 left-40" style={{ width: 'calc(100% - 280px)' }}>
              <ConveyorBelt direction="horizontal" />
            </div>

            {/* 縦レーン（右側） */}
            <div className="absolute right-8 top-32" style={{ height: 'calc(100% - 160px)', width: '80px' }}>
              <ConveyorBelt direction="vertical" />
            </div>

            {/* 角の装飾 */}
            <div className="absolute right-8 top-32 w-20 h-20 border-2 border-slate-600 rounded-br-lg" style={{ borderTop: 'none', borderLeft: 'none' }} />

            {/* サイバーセキュリティボックス */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="absolute right-0 flex flex-col items-center"
              style={{ top: '50%', transform: 'translateY(-50%)' }}
            >
              <div className="text-xs font-medium mb-2 text-center" style={{ color: isCyberFailure ? 'var(--shrine-vermilion)' : 'var(--shrine-barrier)' }}>
                サイバーセキュリティ
              </div>
              <CyberSecurityBox working={!isCyberFailure} />
              <div className="mt-2 text-xs text-center text-muted-foreground max-w-[100px]">
                {isCyberFailure ? '機能せず' : '包装中'}
              </div>
            </motion.div>

            {/* お饅頭のアニメーション */}
            <ManjuAnimation
              key={animationKey}
              quality={isHumanFailure ? 'poor' : 'good'}
              shouldWrap={!isCyberFailure}
            />
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
              協力的な雰囲気の中で高品質な情報（お饅頭）が生成され、サイバーセキュリティボックスを通過することで
              技術的な保護（包装）によってしっかりと守られます。両方が揃って初めて、価値ある情報が完成します。
            </>
          )}
          {isHumanFailure && (
            <>
              <span className="font-medium text-shrine-vermilion">⚠️ ヒューマンセキュリティの欠如:</span> 
              対立的な雰囲気では、低品質な情報（ぐしゃぐしゃのお饅頭）しか生成されません。
              サイバーセキュリティボックスで包装しても、中身が粗悪では意味がありません。
            </>
          )}
          {isCyberFailure && (
            <>
              <span className="font-medium text-shrine-vermilion">⚠️ サイバーセキュリティの欠如:</span> 
              協力的な雰囲気で高品質な情報が生成されても、サイバーセキュリティボックスが機能しなければ
              包装されずに外部に漏れたり改ざんされたりして、価値が損なわれてしまいます。
            </>
          )}
        </p>
      </motion.div>
    </div>
  );
}

/**
 * 手を動かす作業員のSVGコンポーネント
 */
function WorkerWithHand({ mood, animationKey }: { mood: 'happy' | 'angry'; animationKey: number }) {
  const isHappy = mood === 'happy';
  
  return (
    <div className="relative">
      <svg width="80" height="100" viewBox="0 0 80 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* 体 */}
        <rect x="25" y="40" width="30" height="45" rx="2" fill="white" stroke="currentColor" strokeWidth="1.5" />
        
        {/* エプロン */}
        <path d="M 30 40 L 30 85 L 50 85 L 50 40" fill="none" stroke="currentColor" strokeWidth="1.5" />
        
        {/* 頭 */}
        <circle cx="40" cy="25" r="12" fill="white" stroke="currentColor" strokeWidth="1.5" />
        
        {/* キャップ */}
        <ellipse cx="40" cy="17" rx="14" ry="6" fill="white" stroke="currentColor" strokeWidth="1.5" />
        
        {/* 顔 */}
        {isHappy ? (
          <>
            {/* 笑顔 */}
            <circle cx="36" cy="23" r="1.5" fill="currentColor" />
            <circle cx="44" cy="23" r="1.5" fill="currentColor" />
            <path d="M 34 29 Q 40 32 46 29" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          </>
        ) : (
          <>
            {/* 怒り顔 */}
            <line x1="34" y1="21" x2="38" y2="23" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="42" y1="23" x2="46" y2="21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M 34 31 Q 40 28 46 31" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          </>
        )}
        
        {/* 左手（固定） */}
        <circle cx="20" cy="55" r="4" fill="lightblue" opacity="0.7" />
        
        {/* 右手（動く） */}
        <motion.g
          key={`hand-${animationKey}`}
          initial={{ y: 0 }}
          animate={{ y: [0, 15, 15, 0] }}
          transition={{ 
            duration: 2,
            times: [0, 0.3, 0.7, 1],
            ease: 'easeInOut'
          }}
        >
          <circle cx="60" cy="55" r="4" fill="lightblue" opacity="0.7" />
          <line x1="55" y1="50" x2="60" y2="55" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </motion.g>
      </svg>
    </div>
  );
}

/**
 * ベルトコンベアのコンポーネント
 */
function ConveyorBelt({ direction }: { direction: 'horizontal' | 'vertical' }) {
  const isHorizontal = direction === 'horizontal';
  
  return (
    <div 
      className={`relative bg-gradient-to-b from-slate-400 to-slate-500 rounded-lg border-2 border-slate-600 overflow-hidden ${
        isHorizontal ? 'w-full h-16' : 'w-full h-full'
      }`}
    >
      {/* ベルトの動き */}
      {isHorizontal ? (
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
          {[...Array(30)].map((_, i) => (
            <div
              key={i}
              className="w-5 h-1 bg-slate-600/50 mx-2"
              style={{ minWidth: '20px' }}
            />
          ))}
        </motion.div>
      ) : (
        <motion.div
          className="absolute inset-0 flex flex-col items-center"
          initial={{ y: 0 }}
          animate={{ y: -20 }}
          transition={{
            duration: 1,
            repeat: Infinity,
            ease: 'linear'
          }}
        >
          {[...Array(30)].map((_, i) => (
            <div
              key={i}
              className="h-5 w-1 bg-slate-600/50 my-2"
              style={{ minHeight: '20px' }}
            />
          ))}
        </motion.div>
      )}
      
      {/* ライト */}
      <motion.div
        className={`absolute ${isHorizontal ? 'bottom-1 left-0 right-0 flex justify-around' : 'right-1 top-0 bottom-0 flex flex-col justify-around'}`}
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        {[...Array(isHorizontal ? 8 : 6)].map((_, i) => (
          <div key={i} className="w-2 h-2 rounded-full bg-cyan-400" />
        ))}
      </motion.div>
    </div>
  );
}

/**
 * お饅頭のアニメーションコンポーネント
 */
function ManjuAnimation({ quality, shouldWrap }: { quality: 'good' | 'poor'; shouldWrap: boolean }) {
  return (
    <motion.div
      className="absolute"
      style={{ top: '124px', left: '200px' }}
      initial={{ opacity: 0 }}
      animate={{
        opacity: [0, 1, 1, 1, 1, 1, 1, 0],
        x: [0, 0, 'calc(100vw - 480px)', 'calc(100vw - 480px)', 'calc(100vw - 480px)', 'calc(100vw - 480px)', 'calc(100vw - 480px)', 'calc(100vw - 480px)'],
        y: [0, 0, 0, 0, 100, 200, 300, 350],
      }}
      transition={{
        duration: 8,
        times: [0, 0.1, 0.4, 0.45, 0.6, 0.75, 0.9, 1],
        ease: 'linear'
      }}
    >
      <ManjuWithWrapper 
        quality={quality} 
        shouldWrap={shouldWrap}
        wrapDelay={4.5}
      />
    </motion.div>
  );
}

/**
 * お饅頭と包装のコンポーネント
 */
function ManjuWithWrapper({ quality, shouldWrap, wrapDelay }: { quality: 'good' | 'poor'; shouldWrap: boolean; wrapDelay: number }) {
  const [isWrapped, setIsWrapped] = useState(false);
  
  useEffect(() => {
    if (shouldWrap) {
      const timer = setTimeout(() => {
        setIsWrapped(true);
      }, wrapDelay * 1000);
      return () => clearTimeout(timer);
    } else {
      setIsWrapped(false);
    }
  }, [shouldWrap, wrapDelay]);
  
  const isGood = quality === 'good';
  
  return (
    <div className="relative">
      <AnimatePresence>
        {isWrapped && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1.2, opacity: 0.7 }}
            exit={{ scale: 0, opacity: 0 }}
            className="absolute inset-0 bg-transparent border-2 border-dashed border-shrine-barrier rounded-lg"
            style={{ width: '60px', height: '60px', transform: 'translate(-10px, -10px)' }}
          />
        )}
      </AnimatePresence>
      
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
 * サイバーセキュリティボックスのコンポーネント
 */
function CyberSecurityBox({ working }: { working: boolean }) {
  return (
    <div className="relative">
      <svg width="100" height="120" viewBox="0 0 100 120" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* ボックス本体 */}
        <rect x="10" y="10" width="80" height="100" rx="4" fill="white" stroke="currentColor" strokeWidth="2" />
        <rect x="15" y="15" width="70" height="30" rx="2" fill={working ? '#3b82f6' : '#9ca3af'} opacity="0.3" />
        
        {/* 入口 */}
        <rect x="35" y="0" width="30" height="15" fill="currentColor" opacity="0.2" />
        
        {/* 出口 */}
        <rect x="35" y="105" width="30" height="15" fill="currentColor" opacity="0.2" />
        
        {/* 包装機構 */}
        <motion.g
          animate={working ? { rotate: [0, 360] } : {}}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          style={{ transformOrigin: '50px 60px' }}
        >
          <circle cx="50" cy="60" r="15" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" />
        </motion.g>
        
        {/* インジケーター */}
        <motion.circle
          cx="25"
          cy="25"
          r="4"
          fill={working ? '#10b981' : '#ef4444'}
          animate={working ? { opacity: [0.5, 1, 0.5] } : {}}
          transition={{ duration: 1, repeat: Infinity }}
        />
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
