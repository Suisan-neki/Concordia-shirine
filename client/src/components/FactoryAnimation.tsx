/**
 * Concordia Shrine - Factory Animation Component (L-Shape Layout v7)
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
      <div className="relative w-full bg-gradient-to-b from-muted/30 to-muted/10 rounded-xl border border-border overflow-hidden" style={{ minHeight: '600px', height: '600px' }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={animationKey}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full h-full p-8 relative"
          >
            {/* 作業員エリア（上部左側） */}
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

            {/* L字型コンベア（連結） */}
            <div className="absolute top-[220px] left-8">
              <LShapeConveyor />
            </div>

            {/* ロボットアーム（L字の角に配置） */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="absolute"
              style={{ top: '140px', left: '420px' }}
            >
              <div className="text-xs font-medium mb-2 text-center" style={{ color: isCyberFailure ? 'var(--shrine-vermilion)' : 'var(--shrine-barrier)' }}>
                サイバーセキュリティ
              </div>
              <RobotArms working={!isCyberFailure} animationKey={animationKey} />
              <div className="mt-2 text-xs text-center text-muted-foreground max-w-[160px]">
                {isCyberFailure ? '機能せず' : '包装中'}
              </div>
            </motion.div>

            {/* お饅頭のアニメーション（1個ずつ） */}
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
              協力的な雰囲気の中で高品質な情報（お饅頭）が生成され、ロボットアームによって
              包装紙に包まれ、リボンが付けられます。両方が揃って初めて、価値ある情報が完成します。
            </>
          )}
          {isHumanFailure && (
            <>
              <span className="font-medium text-shrine-vermilion">⚠️ ヒューマンセキュリティの欠如:</span> 
              対立的な雰囲気では、低品質な情報（ぐしゃぐしゃのお饅頭）しか生成されません。
              ロボットアームで包装しても、中身が粗悪では意味がありません。
            </>
          )}
          {isCyberFailure && (
            <>
              <span className="font-medium text-shrine-vermilion">⚠️ サイバーセキュリティの欠如:</span> 
              協力的な雰囲気で高品質な情報が生成されても、ロボットアームが機能しなければ
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
              duration: 10,
              times: [0, 0.05, 0.15, 0.2],
              ease: 'easeInOut',
              repeat: Infinity
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
 * L字型コンベアのコンポーネント（連結）
 */
function LShapeConveyor() {
  return (
    <div className="relative">
      {/* 横レーン */}
      <div 
        className="absolute top-0 left-0 bg-gradient-to-b from-slate-400 to-slate-500 rounded-lg border-2 border-slate-600 overflow-hidden"
        style={{ width: '500px', height: '80px' }}
      >
        {/* ベルトの動き（左から右へ） */}
        <motion.div
          className="absolute inset-0 flex items-center"
          initial={{ x: -20 }}
          animate={{ x: 0 }}
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
        
        {/* ライト */}
        <motion.div
          className="absolute bottom-1 left-0 right-0 flex justify-around"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          {[...Array(10)].map((_, i) => (
            <div key={i} className="w-2 h-2 rounded-full bg-cyan-400" />
          ))}
        </motion.div>
      </div>

      {/* 縦レーン */}
      <div 
        className="absolute bg-gradient-to-r from-slate-400 to-slate-500 rounded-lg border-2 border-slate-600 overflow-hidden"
        style={{ top: '0px', left: '500px', width: '80px', height: '320px' }}
      >
        {/* ベルトの動き（上から下へ） */}
        <motion.div
          className="absolute inset-0 flex flex-col items-center"
          initial={{ y: -20 }}
          animate={{ y: 0 }}
          transition={{
            duration: 1,
            repeat: Infinity,
            ease: 'linear'
          }}
        >
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="h-5 w-1 bg-slate-600/50 my-2"
              style={{ minHeight: '20px' }}
            />
          ))}
        </motion.div>
        
        {/* ライト */}
        <motion.div
          className="absolute right-1 top-0 bottom-0 flex flex-col justify-around"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          {[...Array(8)].map((_, i) => (
            <div key={i} className="w-2 h-2 rounded-full bg-cyan-400" />
          ))}
        </motion.div>
      </div>
    </div>
  );
}

/**
 * ロボットアームのコンポーネント
 */
function RobotArms({ working, animationKey }: { working: boolean; animationKey: number }) {
  return (
    <div className="relative flex gap-8">
      {/* 1台目のアーム（包装紙を引く） */}
      <div className="relative">
        <svg width="80" height="120" viewBox="0 0 80 120" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* ベース */}
          <rect x="25" y="100" width="30" height="20" fill="#8B4513" stroke="currentColor" strokeWidth="2" />
          <rect x="20" y="95" width="40" height="5" fill="#FFD700" stroke="currentColor" strokeWidth="1" />
          
          {/* アーム */}
          {working ? (
            <motion.g
              key={`arm1-${animationKey}`}
              animate={{ 
                rotate: [0, -15, -15, 0],
                y: [0, -10, -10, 0]
              }}
              transition={{ 
                duration: 10,
                times: [0, 0.35, 0.45, 0.5],
                ease: 'easeInOut',
                repeat: Infinity
              }}
              style={{ transformOrigin: '40px 100px' }}
            >
              <rect x="35" y="40" width="10" height="60" fill="#D2691E" stroke="currentColor" strokeWidth="2" />
              <circle cx="40" cy="40" r="8" fill="#A0522D" stroke="currentColor" strokeWidth="2" />
              <rect x="32" y="32" width="16" height="8" fill="#696969" stroke="currentColor" strokeWidth="1" />
            </motion.g>
          ) : (
            <g>
              <rect x="35" y="40" width="10" height="60" fill="#D2691E" stroke="currentColor" strokeWidth="2" />
              <circle cx="40" cy="40" r="8" fill="#A0522D" stroke="currentColor" strokeWidth="2" />
              <rect x="32" y="32" width="16" height="8" fill="#696969" stroke="currentColor" strokeWidth="1" />
              {/* 💤エフェクト */}
              <motion.text
                x="45"
                y="25"
                fontSize="20"
                fill="currentColor"
                animate={{ 
                  opacity: [0, 1, 1, 0],
                  y: [25, 15, 5, -5]
                }}
                transition={{ 
                  duration: 2,
                  repeat: Infinity,
                  repeatDelay: 0.5
                }}
              >
                💤
              </motion.text>
            </g>
          )}
        </svg>
      </div>

      {/* 2台目のアーム（リボンを付ける） */}
      <div className="relative">
        <svg width="80" height="120" viewBox="0 0 80 120" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* ベース */}
          <rect x="25" y="100" width="30" height="20" fill="#8B4513" stroke="currentColor" strokeWidth="2" />
          <rect x="20" y="95" width="40" height="5" fill="#FFD700" stroke="currentColor" strokeWidth="1" />
          
          {/* アーム */}
          {working ? (
            <motion.g
              key={`arm2-${animationKey}`}
              animate={{ 
                rotate: [0, 15, 15, 0],
                y: [0, -10, -10, 0]
              }}
              transition={{ 
                duration: 10,
                times: [0, 0.4, 0.5, 0.55],
                ease: 'easeInOut',
                repeat: Infinity
              }}
              style={{ transformOrigin: '40px 100px' }}
            >
              <rect x="35" y="40" width="10" height="60" fill="#D2691E" stroke="currentColor" strokeWidth="2" />
              <circle cx="40" cy="40" r="8" fill="#A0522D" stroke="currentColor" strokeWidth="2" />
              <rect x="32" y="32" width="16" height="8" fill="#696969" stroke="currentColor" strokeWidth="1" />
            </motion.g>
          ) : (
            <g>
              <rect x="35" y="40" width="10" height="60" fill="#D2691E" stroke="currentColor" strokeWidth="2" />
              <circle cx="40" cy="40" r="8" fill="#A0522D" stroke="currentColor" strokeWidth="2" />
              <rect x="32" y="32" width="16" height="8" fill="#696969" stroke="currentColor" strokeWidth="1" />
            </g>
          )}
        </svg>
      </div>
    </div>
  );
}

/**
 * お饅頭のアニメーションコンポーネント（1個ずつループ）
 */
function ManjuAnimation({ quality, shouldWrap }: { quality: 'good' | 'poor'; shouldWrap: boolean }) {
  const [currentProgress, setCurrentProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentProgress(prev => {
        const next = prev + 0.01;
        return next >= 1 ? 0 : next;
      });
    }, 100); // 10秒で1周 (100ms * 100 = 10000ms)

    return () => clearInterval(interval);
  }, []);

  // 進行度に応じて位置を計算
  let x = 0;
  let y = 0;
  let opacity = 1;

  if (currentProgress < 0.4) {
    // 横レーン（0-40%）
    x = currentProgress * 1250; // 0 to 500
    y = 0;
  } else if (currentProgress < 0.45) {
    // 角（40-45%）
    x = 500;
    y = 0;
  } else if (currentProgress < 0.9) {
    // 縦レーン（45-90%）
    x = 500;
    y = (currentProgress - 0.45) * 711; // 0 to 320
  } else {
    // フェードアウト（90-100%）
    x = 500;
    y = 320;
    opacity = 1 - ((currentProgress - 0.9) / 0.1);
  }

  // 包装または腐敗のタイミング（横レーンの終わり、40-45%の間）
  const shouldTransform = currentProgress >= 0.4 && currentProgress < 0.9;
  const isWrapped = shouldTransform && shouldWrap;
  const isRotted = shouldTransform && !shouldWrap && quality === 'good';

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        top: '212px',
        left: '40px',
        transform: `translate(${x}px, ${y}px)`,
        opacity: opacity,
        transition: 'transform 0.1s linear, opacity 0.1s linear'
      }}
    >
      <Manju 
        quality={quality} 
        isWrapped={isWrapped}
        isRotted={isRotted}
      />
    </div>
  );
}

/**
 * お饅頭のコンポーネント（プロップスで状態を受け取る）
 */
function Manju({ quality, isWrapped, isRotted }: { quality: 'good' | 'poor'; isWrapped: boolean; isRotted: boolean }) {
  const isGood = quality === 'good';
  
  return (
    <div className="relative">
      <svg width="70" height="70" viewBox="0 0 70 70" fill="none" xmlns="http://www.w3.org/2000/svg">
        {isWrapped ? (
          // 包装されたお饅頭（茶色の包装紙+青いリボン）
          <>
            {/* 包装紙（茶色） */}
            <rect x="5" y="10" width="60" height="50" rx="4" fill="#D2691E" stroke="#8B4513" strokeWidth="2" />
            
            {/* お饅頭（包装紙の上に乗っている） */}
            <ellipse cx="35" cy="30" rx="22" ry="18" fill="#F5E6D3" stroke="#D4A574" strokeWidth="1.5" />
            <ellipse cx="35" cy="26" rx="18" ry="10" fill="#FFFFFF" opacity="0.3" />
            
            {/* リボン（青・右下の角） */}
            <g transform="translate(48, 48)">
              {/* リボンの結び目 */}
              <circle cx="0" cy="0" r="5" fill="#4169E1" stroke="#1E3A8A" strokeWidth="1.5" />
              {/* リボンの左側 */}
              <path d="M -5 0 Q -10 -3 -12 -6 Q -14 -8 -10 -10 Q -8 -11 -6 -9 Q -4 -7 -5 -4 Z" fill="#4169E1" stroke="#1E3A8A" strokeWidth="1" />
              {/* リボンの右側 */}
              <path d="M 5 0 Q 10 3 12 6 Q 14 8 10 10 Q 8 11 6 9 Q 4 7 5 4 Z" fill="#4169E1" stroke="#1E3A8A" strokeWidth="1" />
              {/* リボンの下側 */}
              <path d="M 0 5 Q -2 10 -3 13 L -1 14 L 0 11 L 1 14 L 3 13 Q 2 10 0 5 Z" fill="#4169E1" stroke="#1E3A8A" strokeWidth="1" />
            </g>
          </>
        ) : isGood && !isRotted ? (
          // 綺麗なお饅頭 - 一重の白い丸
          <>
            <circle cx="35" cy="38" r="20" fill="#F5E6D3" stroke="#D4A574" strokeWidth="2" />
            <ellipse cx="35" cy="34" rx="16" ry="8" fill="#FFFFFF" opacity="0.3" />
          </>
        ) : isRotted ? (
          // 腐ったお饅頭（元は綺麗だったが腐った）
          <>
            <circle cx="35" cy="38" r="20" fill="#6B5D4F" stroke="#4A3F35" strokeWidth="2" />
            <circle cx="30" cy="36" r="3" fill="#3D5A40" opacity="0.7" />
            <circle cx="38" cy="38" r="2" fill="#3D5A40" opacity="0.7" />
            <circle cx="34" cy="42" r="2" fill="#3D5A40" opacity="0.7" />
          </>
        ) : (
          // ぐしゃぐしゃのお饅頭
          <>
            <path
              d="M 22 38 Q 28 46 35 43 Q 42 40 48 46 Q 46 32 42 28 Q 35 24 28 30 Q 24 34 22 38"
              fill="#B8A080"
              stroke="#8B7355"
              strokeWidth="2"
            />
            <circle cx="32" cy="34" r="2.5" fill="#8B7355" opacity="0.5" />
            <circle cx="40" cy="38" r="2" fill="#8B7355" opacity="0.5" />
          </>
        )}
      </svg>
    </div>
  );
}
