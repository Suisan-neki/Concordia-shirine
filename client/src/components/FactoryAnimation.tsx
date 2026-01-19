/**
 * Concordia Shrine - Factory Animation Component (L-Shape Layout v2)
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
            {/* 左側: ヒューマンセキュリティエリア（作業員2人） */}
            <div className="absolute top-8 left-8 flex flex-col items-center">
              <div className="text-xs font-medium mb-4 text-center" style={{ color: isHumanFailure ? 'var(--shrine-vermilion)' : 'var(--shrine-jade)' }}>
                ヒューマンセキュリティ
              </div>
              
              {/* 作業員2人 */}
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5 }}
                className="relative flex gap-4"
              >
                <TwoWorkers mood={isHumanFailure ? 'angry' : 'happy'} animationKey={animationKey} />
              </motion.div>

              {/* 説明テキスト */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="mt-4 text-xs text-center text-muted-foreground max-w-[140px]"
              >
                {isHumanFailure ? '対立的な雰囲気' : '協力的な雰囲気'}
              </motion.div>
            </div>

            {/* 横レーン（上部・短縮版） */}
            <div className="absolute top-32 left-52" style={{ width: '280px' }}>
              <ConveyorBelt direction="horizontal" />
            </div>

            {/* 縦レーン（右側） */}
            <div className="absolute right-8 top-32" style={{ height: 'calc(100% - 160px)', width: '80px' }}>
              <ConveyorBelt direction="vertical" />
            </div>

            {/* サイバーセキュリティボックス（L字の角に配置・透明化） */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="absolute"
              style={{ top: '90px', right: '-10px' }}
            >
              <div className="text-xs font-medium mb-2 text-center" style={{ color: isCyberFailure ? 'var(--shrine-vermilion)' : 'var(--shrine-barrier)' }}>
                サイバーセキュリティ
              </div>
              <TransparentCyberSecurityBox working={!isCyberFailure} animationKey={animationKey} />
              <div className="mt-2 text-xs text-center text-muted-foreground max-w-[120px]">
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
              包装されずに腐敗してしまい、価値が損なわれてしまいます。
            </>
          )}
        </p>
      </motion.div>
    </div>
  );
}

/**
 * 2人の作業員のSVGコンポーネント
 */
function TwoWorkers({ mood, animationKey }: { mood: 'happy' | 'angry'; animationKey: number }) {
  const isHappy = mood === 'happy';
  
  return (
    <div className="relative flex gap-6">
      {/* 感情エフェクト */}
      <AnimatePresence>
        {isHappy ? (
          <motion.div
            key={`heart-${animationKey}`}
            initial={{ opacity: 0, y: 0, scale: 0 }}
            animate={{ 
              opacity: [0, 1, 1, 0],
              y: [0, -30, -60, -90],
              scale: [0, 1, 1.2, 0.8]
            }}
            transition={{ 
              duration: 2,
              repeat: Infinity,
              repeatDelay: 1
            }}
            className="absolute top-0 left-1/2 transform -translate-x-1/2 text-2xl"
          >
            ❤️
          </motion.div>
        ) : (
          <>
            <motion.div
              key={`anger-left-${animationKey}`}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ 
                opacity: [0, 1, 1, 0],
                scale: [0, 1, 1.2, 0],
                x: [-10, -20, -30, -40]
              }}
              transition={{ 
                duration: 1.5,
                repeat: Infinity,
                repeatDelay: 0.5
              }}
              className="absolute top-0 left-0 text-xl"
            >
              💢
            </motion.div>
            <motion.div
              key={`anger-right-${animationKey}`}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ 
                opacity: [0, 1, 1, 0],
                scale: [0, 1, 1.2, 0],
                x: [10, 20, 30, 40]
              }}
              transition={{ 
                duration: 1.5,
                repeat: Infinity,
                repeatDelay: 0.5,
                delay: 0.3
              }}
              className="absolute top-0 right-0 text-xl"
            >
              💢
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* 作業員1 */}
      <Worker mood={mood} animationKey={animationKey} withHand={true} />
      
      {/* 作業員2 */}
      <Worker mood={mood} animationKey={animationKey} withHand={false} />
    </div>
  );
}

/**
 * 作業員のSVGコンポーネント
 */
function Worker({ mood, animationKey, withHand }: { mood: 'happy' | 'angry'; animationKey: number; withHand: boolean }) {
  const isHappy = mood === 'happy';
  
  return (
    <div className="relative">
      <svg width="60" height="100" viewBox="0 0 60 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* 体 */}
        <rect x="20" y="40" width="20" height="35" rx="2" fill="white" stroke="currentColor" strokeWidth="1.5" />
        
        {/* エプロン */}
        <path d="M 23 40 L 23 75 L 37 75 L 37 40" fill="none" stroke="currentColor" strokeWidth="1.5" />
        
        {/* 頭 */}
        <circle cx="30" cy="25" r="10" fill="white" stroke="currentColor" strokeWidth="1.5" />
        
        {/* キャップ */}
        <ellipse cx="30" cy="18" rx="12" ry="5" fill="white" stroke="currentColor" strokeWidth="1.5" />
        
        {/* 顔 */}
        {isHappy ? (
          <>
            {/* 笑顔 */}
            <circle cx="26" cy="23" r="1.5" fill="currentColor" />
            <circle cx="34" cy="23" r="1.5" fill="currentColor" />
            <path d="M 24 29 Q 30 32 36 29" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          </>
        ) : (
          <>
            {/* 怒り顔 */}
            <line x1="24" y1="21" x2="28" y2="23" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="32" y1="23" x2="36" y2="21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M 24 31 Q 30 28 36 31" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          </>
        )}
        
        {/* 左手（固定） */}
        <circle cx="15" cy="55" r="3" fill="lightblue" opacity="0.7" />
        
        {/* 右手（動く・片方だけ） */}
        {withHand && (
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
            <circle cx="45" cy="55" r="3" fill="lightblue" opacity="0.7" />
            <line x1="40" y1="50" x2="45" y2="55" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </motion.g>
        )}
        {!withHand && (
          <circle cx="45" cy="55" r="3" fill="lightblue" opacity="0.7" />
        )}
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
          {[...Array(20)].map((_, i) => (
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
        {[...Array(isHorizontal ? 6 : 6)].map((_, i) => (
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
      style={{ top: '124px', left: '260px' }}
      initial={{ opacity: 0 }}
      animate={{
        opacity: [0, 1, 1, 1, 1, 1, 1, 0],
        x: [0, 0, 280, 280, 280, 280, 280, 280],
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
        wrapDelay={3.2}
      />
    </motion.div>
  );
}

/**
 * お饅頭と包装のコンポーネント
 */
function ManjuWithWrapper({ quality, shouldWrap, wrapDelay }: { quality: 'good' | 'poor'; shouldWrap: boolean; wrapDelay: number }) {
  const [isWrapped, setIsWrapped] = useState(false);
  const [isRotted, setIsRotted] = useState(false);
  
  useEffect(() => {
    if (shouldWrap) {
      const timer = setTimeout(() => {
        setIsWrapped(true);
      }, wrapDelay * 1000);
      return () => clearTimeout(timer);
    } else {
      setIsWrapped(false);
      // サイバーセキュリティが機能しない場合、お饅頭が腐る
      const rottedTimer = setTimeout(() => {
        setIsRotted(true);
      }, wrapDelay * 1000);
      return () => clearTimeout(rottedTimer);
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
        {isGood && !isRotted ? (
          // 綺麗なお饅頭
          <>
            <ellipse cx="20" cy="25" rx="15" ry="10" fill="#F5E6D3" stroke="#D4A574" strokeWidth="1.5" />
            <ellipse cx="20" cy="18" rx="12" ry="10" fill="#F5E6D3" stroke="#D4A574" strokeWidth="1.5" />
            <path d="M 15 18 Q 20 20 25 18" stroke="#D4A574" strokeWidth="1" fill="none" />
          </>
        ) : isGood && isRotted ? (
          // 腐ったお饅頭（元は綺麗だったが腐った）
          <>
            <ellipse cx="20" cy="25" rx="15" ry="10" fill="#6B5D4F" stroke="#4A3F35" strokeWidth="1.5" />
            <ellipse cx="20" cy="18" rx="12" ry="10" fill="#6B5D4F" stroke="#4A3F35" strokeWidth="1.5" />
            <circle cx="16" cy="20" r="2" fill="#3D5A40" opacity="0.7" />
            <circle cx="24" cy="22" r="1.5" fill="#3D5A40" opacity="0.7" />
            <circle cx="20" cy="24" r="1" fill="#3D5A40" opacity="0.7" />
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
 * 透明なサイバーセキュリティボックスのコンポーネント
 */
function TransparentCyberSecurityBox({ working, animationKey }: { working: boolean; animationKey: number }) {
  return (
    <div className="relative">
      <svg width="140" height="140" viewBox="0 0 140 140" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* 透明なボックス */}
        <rect x="10" y="10" width="120" height="120" rx="4" fill="white" fillOpacity="0.1" stroke="currentColor" strokeWidth="2" strokeDasharray="5 5" />
        
        {/* 入口（上） */}
        <rect x="50" y="0" width="40" height="15" fill="currentColor" opacity="0.1" />
        
        {/* 出口（下） */}
        <rect x="50" y="125" width="40" height="15" fill="currentColor" opacity="0.1" />
        
        {working ? (
          <>
            {/* 包装機構（動作中） */}
            <motion.g
              key={`wrapping-${animationKey}`}
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              style={{ transformOrigin: '70px 70px' }}
            >
              <circle cx="70" cy="70" r="20" fill="none" stroke="#10b981" strokeWidth="2" strokeDasharray="4 4" />
            </motion.g>
            
            {/* 包装紙のアニメーション */}
            <motion.rect
              key={`paper-${animationKey}`}
              x="50"
              y="60"
              width="40"
              height="20"
              rx="2"
              fill="#D4A574"
              opacity="0.5"
              animate={{
                scaleX: [0, 1, 1, 0],
                opacity: [0, 0.5, 0.5, 0]
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                repeatDelay: 1
              }}
            />
            
            {/* インジケーター（緑） */}
            <motion.circle
              cx="25"
              cy="25"
              r="4"
              fill="#10b981"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
          </>
        ) : (
          <>
            {/* 故障中 */}
            <motion.circle
              cx="25"
              cy="25"
              r="4"
              fill="#ef4444"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
            
            {/* 💤エフェクト */}
            <motion.g
              key={`sleep-${animationKey}`}
              initial={{ opacity: 0, y: 0 }}
              animate={{ 
                opacity: [0, 1, 1, 0],
                y: [0, -20, -40, -60],
                x: [0, 5, 10, 15]
              }}
              transition={{ 
                duration: 2,
                repeat: Infinity,
                repeatDelay: 0.5
              }}
            >
              <text x="70" y="70" fontSize="24" fill="currentColor">💤</text>
            </motion.g>
          </>
        )}
      </svg>
    </div>
  );
}
