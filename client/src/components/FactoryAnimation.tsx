import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface FactoryAnimationProps {
  scenario: 'ideal' | 'human-failure' | 'cyber-failure';
}

function FactoryAnimationCore({ scenario }: FactoryAnimationProps) {
  const [animationKey, setAnimationKey] = useState(0);

  // シナリオが変わったらアニメーションをリセット
  useEffect(() => {
    setAnimationKey(prev => prev + 1);
  }, [scenario]);

  const isHumanGood = scenario !== 'human-failure';
  const isCyberGood = scenario !== 'cyber-failure';
  const mood = isHumanGood ? 'happy' : 'angry';

  return (
    <div className="relative w-full h-[500px] bg-gradient-to-b from-slate-900 to-slate-800 rounded-lg p-8">
      {/* 作業員エリア */}
      <WorkerArea mood={mood} animationKey={animationKey} />
      
      {/* レーンとロボットアーム */}
      <ConveyorBelt />
      
      {/* ロボットアーム - 左は横レーンの途中、右はL字の角 */}
      <RobotArms working={isCyberGood} animationKey={animationKey} />
      
      {/* お饅頭 */}
      <Manju 
        isGood={isHumanGood} 
        cyberWorking={isCyberGood}
        animationKey={animationKey}
      />
    </div>
  );
}

/**
 * お饅頭のコンポーネント
 */
function Manju({ isGood, cyberWorking, animationKey }: { isGood: boolean; cyberWorking: boolean; animationKey: number }) {
  const [progress, setProgress] = useState(0);
  const [currentState, setCurrentState] = useState<'initial' | 'wrapped' | 'rotted'>('initial');

  useEffect(() => {
    setProgress(0);
    setCurrentState('initial');
    
    const interval = setInterval(() => {
      setProgress(prev => {
        const next = prev + 0.01;
        
        // 包装/腐敗のタイミング（40-45%）
        if (next >= 0.40 && next < 0.45 && currentState === 'initial') {
          if (cyberWorking) {
            setCurrentState('wrapped');
          } else {
            setCurrentState('rotted');
          }
        }
        
        if (next >= 1) {
          return 0;
        }
        return next;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [animationKey, cyberWorking]);

  // 座標計算 - 包装紙を引くタイミングでのズレを修正
  const getPosition = (p: number) => {
    if (p < 0.4) {
      // 横レーン（左から右へ）
      const x = 120 + (p / 0.4) * 380;
      const y = 180;
      return { x, y };
    } else if (p < 0.5) {
      // L字の角 - 包装エリア（座標を固定）
      const x = 500;
      const y = 180;
      return { x, y };
    } else {
      // 縦レーン（上から下へ）
      const verticalProgress = (p - 0.5) / 0.5;
      const x = 520;
      const y = 200 + verticalProgress * 220;
      return { x, y };
    }
  };

  const { x, y } = getPosition(progress);
  const opacity = progress > 0.9 ? 1 - (progress - 0.9) / 0.1 : 1;

  return (
    <div 
      className="absolute transition-all duration-100"
      style={{ 
        left: `${x}px`, 
        top: `${y}px`,
        opacity,
        transform: 'translate(-50%, -50%)'
      }}
    >
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        {currentState === 'initial' && (
          <>
            {/* 初期状態のお饅頭 */}
            <circle 
              cx="20" 
              cy="20" 
              r="15" 
              fill={isGood ? "#FFF5E1" : "#8B7355"}
              stroke={isGood ? "#D2691E" : "#654321"}
              strokeWidth="2"
            />
            {isGood ? (
              <>
                {/* 綺麗なお饅頭 */}
                <ellipse cx="20" cy="18" rx="8" ry="4" fill="#FFE4B5" opacity="0.6" />
                <circle cx="15" cy="20" r="1" fill="#D2691E" opacity="0.3" />
                <circle cx="25" cy="20" r="1" fill="#D2691E" opacity="0.3" />
              </>
            ) : (
              <>
                {/* ぐしゃぐしゃのお饅頭 */}
                <path d="M 10 20 Q 15 15 20 20 T 30 20" stroke="#654321" strokeWidth="1.5" fill="none" />
                <path d="M 12 25 Q 20 22 28 25" stroke="#654321" strokeWidth="1.5" fill="none" />
                <circle cx="14" cy="18" r="1.5" fill="#3E2723" />
                <circle cx="26" cy="18" r="1.5" fill="#3E2723" />
              </>
            )}
          </>
        )}
        
        {currentState === 'wrapped' && (
          <>
            {/* 包装されたお饅頭 */}
            <rect x="5" y="5" width="30" height="30" rx="3" fill="#8B4513" stroke="#654321" strokeWidth="2" />
            <rect x="8" y="8" width="24" height="24" rx="2" fill="#A0522D" opacity="0.5" />
            
            {/* リボン（蝶結び） */}
            <g transform="translate(20, 20)">
              {/* 中央の結び目 */}
              <ellipse cx="0" cy="0" rx="3" ry="2" fill="#DC143C" />
              
              {/* 左側のリボン */}
              <path 
                d="M -3 0 Q -8 -6 -12 -4 Q -10 0 -12 4 Q -8 6 -3 0" 
                fill="#DC143C" 
                stroke="#B22222" 
                strokeWidth="0.5"
              />
              {/* 左リボンのハイライト */}
              <path 
                d="M -6 -2 Q -8 -4 -10 -3" 
                stroke="#FF6B6B" 
                strokeWidth="1" 
                fill="none" 
                opacity="0.6"
              />
              
              {/* 右側のリボン */}
              <path 
                d="M 3 0 Q 8 -6 12 -4 Q 10 0 12 4 Q 8 6 3 0" 
                fill="#DC143C" 
                stroke="#B22222" 
                strokeWidth="0.5"
              />
              {/* 右リボンのハイライト */}
              <path 
                d="M 6 -2 Q 8 -4 10 -3" 
                stroke="#FF6B6B" 
                strokeWidth="1" 
                fill="none" 
                opacity="0.6"
              />
              
              {/* 下に垂れるリボンの端 */}
              <path 
                d="M -1 2 L -3 8 L -1 10" 
                fill="#DC143C" 
                stroke="#B22222" 
                strokeWidth="0.5"
              />
              <path 
                d="M 1 2 L 3 8 L 1 10" 
                fill="#DC143C" 
                stroke="#B22222" 
                strokeWidth="0.5"
              />
            </g>
          </>
        )}
        
        {currentState === 'rotted' && (
          <>
            {/* 腐敗したお饅頭 */}
            <circle cx="20" cy="20" r="15" fill="#4A5D4A" stroke="#2E3B2E" strokeWidth="2" />
            <circle cx="15" cy="15" r="3" fill="#6B8E6B" opacity="0.6" />
            <circle cx="25" cy="18" r="2" fill="#6B8E6B" opacity="0.6" />
            <circle cx="18" cy="25" r="2.5" fill="#6B8E6B" opacity="0.6" />
            <path d="M 10 20 Q 20 15 30 20" stroke="#2E3B2E" strokeWidth="1.5" fill="none" />
          </>
        )}
      </svg>
    </div>
  );
}

/**
 * 作業員エリアのコンポーネント
 */
function WorkerArea({ mood, animationKey }: { mood: 'happy' | 'angry'; animationKey: number }) {
  return (
    <div className="absolute top-8 left-8">
      <div className="text-cyan-400 text-sm mb-2 font-medium">ヒューマンセキュリティ</div>
      
      {/* ハートのアニメーション */}
      <div className="absolute -top-2 left-16">
        <AnimatePresence mode="wait">
          {mood === 'happy' && (
            <motion.div
              key={`heart-${animationKey}`}
              initial={{ opacity: 0, scale: 0.5, y: 0 }}
              animate={{ opacity: [0, 1, 1, 0], scale: [0.5, 1, 1, 1.2], y: [0, -10, -20, -30] }}
              exit={{ opacity: 0 }}
              transition={{ 
                duration: 2,
                repeat: Infinity,
                ease: 'easeOut'
              }}
              className="text-3xl"
            >
              ❤️
            </motion.div>
          )}
        </AnimatePresence>

        {/* 作業員1と2を少し右側に配置 */}
        <div className="flex gap-8" style={{ marginLeft: '20px' }}>
          {/* 作業員1 */}
          <Worker mood={mood} animationKey={animationKey} withHand={true} />
          
          {/* 作業員2 */}
          <Worker mood={mood} animationKey={animationKey} withHand={false} />
        </div>
      </div>
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
            animate={{ y: [0, 15, 0] }}
            transition={{ 
              duration: 10,
              times: [0, 0.05, 0.1],
              ease: 'easeInOut',
              repeat: Infinity
            }}
          >
            <circle cx="45" cy="55" r="3" fill="lightblue" opacity="0.7" />
          </motion.g>
        )}
        
        {/* 足 */}
        <rect x="22" y="75" width="6" height="15" rx="1" fill="white" stroke="currentColor" strokeWidth="1" />
        <rect x="32" y="75" width="6" height="15" rx="1" fill="white" stroke="currentColor" strokeWidth="1" />
      </svg>
    </div>
  );
}

/**
 * ベルトコンベアのコンポーネント
 */
function ConveyorBelt() {
  return (
    <div className="absolute" style={{ top: '160px', left: '100px' }}>
      {/* 横レーン */}
      <div 
        className="absolute bg-gradient-to-r from-slate-400 to-slate-500 rounded-lg border-2 border-slate-600 overflow-hidden"
        style={{ top: '0px', left: '0px', width: '500px', height: '80px' }}
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
          {[...Array(12)].map((_, i) => (
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
 * ロボットアームのコンポーネント（改善版：多関節構造と現実的な動作）
 */
function RobotArms({ working, animationKey }: { working: boolean; animationKey: number }) {
  return (
    <>
      {/* 1台目のアーム（包装紙を引く）- 横レーンの上側、180度回転 */}
      <div className="absolute" style={{ top: '240px', left: '320px', transform: 'rotate(180deg)' }}>
        <ArticulatedRobotArm 
          working={working} 
          animationKey={animationKey}
          taskType="wrapping"
          startTime={0.35}
        />
      </div>

      {/* 2台目のアーム（リボンを付ける）- L字の角、90度回転 */}
      <div className="absolute" style={{ top: '140px', left: '600px', transform: 'rotate(-90deg)' }}>
        <ArticulatedRobotArm 
          working={working} 
          animationKey={animationKey}
          taskType="ribbon"
          startTime={0.40}
        />
      </div>
      
      {/* ラベル */}
      <div className="absolute text-red-400 text-sm font-medium" style={{ top: '120px', left: '420px' }}>
        サイバーセキュリティ
      </div>
    </>
  );
}

/**
 * 多関節ロボットアームコンポーネント
 * 3セグメント構造（ベース、下部アーム、上部アーム、グリッパー）
 */
function ArticulatedRobotArm({ 
  working, 
  animationKey, 
  taskType,
  startTime 
}: { 
  working: boolean; 
  animationKey: number; 
  taskType: 'wrapping' | 'ribbon';
  startTime: number;
}) {
  // 動作シーケンスのキーフレーム
  // 待機 → 下降 → 掴む → 持ち上げる → 作業 → 戻る
  const duration = 10;
  const endTime = startTime + 0.10;
  
  // 各関節の回転角度のキーフレーム
  const shoulderRotation = working ? [0, 0, -35, -35, -15, 0] : [0];
  const elbowRotation = working ? [0, 0, -45, -45, -30, 0] : [0];
  const wristRotation = working ? [0, 0, -20, -20, 10, 0] : [0];
  const gripperScale = working ? [1, 1, 0.5, 0.5, 0.5, 1] : [1];
  
  // タイミング配列
  const times = [0, startTime - 0.05, startTime, startTime + 0.03, endTime, endTime + 0.05];
  
  return (
    <div className="relative">
      <svg width="100" height="160" viewBox="0 0 100 160" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* ベース台座 */}
        <g>
          <rect x="35" y="140" width="30" height="20" rx="2" fill="#2C3E50" stroke="#34495E" strokeWidth="2" />
          <rect x="30" y="135" width="40" height="5" rx="1" fill="#34495E" stroke="#2C3E50" strokeWidth="1" />
          <circle cx="50" cy="147" r="3" fill="#7F8C8D" />
        </g>
        
        {working ? (
          <motion.g
            key={`shoulder-${animationKey}-${taskType}`}
            animate={{ rotate: shoulderRotation }}
            transition={{ 
              duration,
              times,
              ease: 'easeInOut',
              repeat: Infinity
            }}
            style={{ transformOrigin: '50px 140px' }}
          >
            {/* 下部アーム（肩から肘） */}
            <g>
              {/* アーム本体 */}
              <rect x="44" y="85" width="12" height="55" rx="2" fill="#FFD700" stroke="#FFA500" strokeWidth="2" />
              {/* 油圧シリンダー風のディテール */}
              <line x1="47" y1="90" x2="47" y2="135" stroke="#FFA500" strokeWidth="1" opacity="0.5" />
              <line x1="53" y1="90" x2="53" y2="135" stroke="#FFA500" strokeWidth="1" opacity="0.5" />
              {/* 肩関節 */}
              <circle cx="50" cy="140" r="8" fill="#FFA500" stroke="#FF8C00" strokeWidth="2" />
              <circle cx="50" cy="140" r="4" fill="#FFD700" />
            </g>
            
            {/* 肘関節を中心に回転する上部アーム */}
            <motion.g
              animate={{ rotate: elbowRotation }}
              transition={{ 
                duration,
                times,
                ease: 'easeInOut',
                repeat: Infinity
              }}
              style={{ transformOrigin: '50px 85px' }}
            >
              {/* 上部アーム（肘から手首） */}
              <g>
                {/* アーム本体 */}
                <rect x="44" y="40" width="12" height="45" rx="2" fill="#FFD700" stroke="#FFA500" strokeWidth="2" />
                {/* 油圧シリンダー風のディテール */}
                <line x1="47" y1="45" x2="47" y2="80" stroke="#FFA500" strokeWidth="1" opacity="0.5" />
                <line x1="53" y1="45" x2="53" y2="80" stroke="#FFA500" strokeWidth="1" opacity="0.5" />
                {/* 肘関節 */}
                <circle cx="50" cy="85" r="7" fill="#FFA500" stroke="#FF8C00" strokeWidth="2" />
                <circle cx="50" cy="85" r="3" fill="#FFD700" />
              </g>
              
              {/* 手首関節を中心に回転するグリッパー */}
              <motion.g
                animate={{ rotate: wristRotation }}
                transition={{ 
                  duration,
                  times,
                  ease: 'easeInOut',
                  repeat: Infinity
                }}
                style={{ transformOrigin: '50px 40px' }}
              >
                {/* 手首関節 */}
                <circle cx="50" cy="40" r="6" fill="#FFA500" stroke="#FF8C00" strokeWidth="2" />
                <circle cx="50" cy="40" r="2" fill="#FFD700" />
                
                {/* グリッパー（開閉動作） */}
                <motion.g
                  animate={{ scaleX: gripperScale }}
                  transition={{ 
                    duration,
                    times,
                    ease: 'easeInOut',
                    repeat: Infinity
                  }}
                  style={{ transformOrigin: '50px 35px' }}
                >
                  {/* 左側のグリッパー */}
                  <g>
                    <rect x="38" y="28" width="8" height="14" rx="1" fill="#696969" stroke="#505050" strokeWidth="1.5" />
                    <rect x="40" y="30" width="4" height="2" fill="#505050" />
                    <rect x="40" y="34" width="4" height="2" fill="#505050" />
                    <rect x="40" y="38" width="4" height="2" fill="#505050" />
                  </g>
                  {/* 右側のグリッパー */}
                  <g>
                    <rect x="54" y="28" width="8" height="14" rx="1" fill="#696969" stroke="#505050" strokeWidth="1.5" />
                    <rect x="56" y="30" width="4" height="2" fill="#505050" />
                    <rect x="56" y="34" width="4" height="2" fill="#505050" />
                    <rect x="56" y="38" width="4" height="2" fill="#505050" />
                  </g>
                </motion.g>
                
                {/* 作業中のエフェクト */}
                {taskType === 'wrapping' && (
                  <motion.g
                    animate={{ 
                      opacity: [0, 0, 1, 1, 0, 0],
                      y: [0, 0, 5, 5, 0, 0]
                    }}
                    transition={{ 
                      duration,
                      times,
                      ease: 'easeInOut',
                      repeat: Infinity
                    }}
                  >
                    {/* 包装紙を引くエフェクト */}
                    <rect x="35" y="45" width="30" height="2" fill="#8B4513" opacity="0.7" />
                  </motion.g>
                )}
                
                {taskType === 'ribbon' && (
                  <motion.g
                    animate={{ 
                      opacity: [0, 0, 1, 1, 0, 0],
                      scale: [0.5, 0.5, 1, 1, 0.5, 0.5]
                    }}
                    transition={{ 
                      duration,
                      times,
                      ease: 'easeInOut',
                      repeat: Infinity
                    }}
                    style={{ transformOrigin: '50px 45px' }}
                  >
                    {/* リボンを付けるエフェクト（蝶結び） */}
                    <g>
                      {/* 中央の結び目 */}
                      <ellipse cx="50" cy="45" rx="3" ry="2" fill="#DC143C" />
                      
                      {/* 左側のリボン */}
                      <path 
                        d="M 47 45 Q 42 39 38 41 Q 40 45 38 49 Q 42 51 47 45" 
                        fill="#DC143C" 
                        stroke="#B22222" 
                        strokeWidth="0.5"
                      />
                      {/* 左リボンのハイライト */}
                      <path 
                        d="M 44 43 Q 42 41 40 42" 
                        stroke="#FF6B6B" 
                        strokeWidth="1" 
                        fill="none" 
                        opacity="0.6"
                      />
                      
                      {/* 右側のリボン */}
                      <path 
                        d="M 53 45 Q 58 39 62 41 Q 60 45 62 49 Q 58 51 53 45" 
                        fill="#DC143C" 
                        stroke="#B22222" 
                        strokeWidth="0.5"
                      />
                      {/* 右リボンのハイライト */}
                      <path 
                        d="M 56 43 Q 58 41 60 42" 
                        stroke="#FF6B6B" 
                        strokeWidth="1" 
                        fill="none" 
                        opacity="0.6"
                      />
                      
                      {/* 下に垂れるリボンの端 */}
                      <path 
                        d="M 49 47 L 47 53 L 49 55" 
                        fill="#DC143C" 
                        stroke="#B22222" 
                        strokeWidth="0.5"
                      />
                      <path 
                        d="M 51 47 L 53 53 L 51 55" 
                        fill="#DC143C" 
                        stroke="#B22222" 
                        strokeWidth="0.5"
                      />
                    </g>
                  </motion.g>
                )}
              </motion.g>
            </motion.g>
          </motion.g>
        ) : (
          // 停止状態（💤エフェクト付き）
          <g>
            {/* 下部アーム */}
            <rect x="44" y="85" width="12" height="55" rx="2" fill="#FFD700" stroke="#FFA500" strokeWidth="2" />
            <line x1="47" y1="90" x2="47" y2="135" stroke="#FFA500" strokeWidth="1" opacity="0.5" />
            <line x1="53" y1="90" x2="53" y2="135" stroke="#FFA500" strokeWidth="1" opacity="0.5" />
            <circle cx="50" cy="140" r="8" fill="#FFA500" stroke="#FF8C00" strokeWidth="2" />
            <circle cx="50" cy="140" r="4" fill="#FFD700" />
            
            {/* 上部アーム */}
            <rect x="44" y="40" width="12" height="45" rx="2" fill="#FFD700" stroke="#FFA500" strokeWidth="2" />
            <line x1="47" y1="45" x2="47" y2="80" stroke="#FFA500" strokeWidth="1" opacity="0.5" />
            <line x1="53" y1="45" x2="53" y2="80" stroke="#FFA500" strokeWidth="1" opacity="0.5" />
            <circle cx="50" cy="85" r="7" fill="#FFA500" stroke="#FF8C00" strokeWidth="2" />
            <circle cx="50" cy="85" r="3" fill="#FFD700" />
            
            {/* 手首とグリッパー */}
            <circle cx="50" cy="40" r="6" fill="#FFA500" stroke="#FF8C00" strokeWidth="2" />
            <circle cx="50" cy="40" r="2" fill="#FFD700" />
            <rect x="38" y="28" width="8" height="14" rx="1" fill="#696969" stroke="#505050" strokeWidth="1.5" />
            <rect x="54" y="28" width="8" height="14" rx="1" fill="#696969" stroke="#505050" strokeWidth="1.5" />
            
            {/* 💤エフェクト */}
            <motion.text
              x="60"
              y="20"
              fontSize="24"
              fill="currentColor"
              animate={{ 
                opacity: [0, 1, 1, 0],
                y: [20, 10, 0, -10]
              }}
              transition={{ 
                duration: 2,
                repeat: Infinity,
                ease: 'easeOut',
                delay: taskType === 'ribbon' ? 0.5 : 0
              }}
            >
              💤
            </motion.text>
          </g>
        )}
      </svg>
    </div>
  );
}

/**
 * メインのFactoryAnimationコンポーネント
 */
export default function FactoryAnimation() {
  const [scenario, setScenario] = useState<'ideal' | 'human-failure' | 'cyber-failure'>('ideal');

  return (
    <div className="space-y-4">
      {/* シナリオ選択ボタン */}
      <div className="flex gap-2 justify-center">
        <button
          onClick={() => setScenario('ideal')}
          className={`px-4 py-2 rounded-lg transition-colors ${
            scenario === 'ideal'
              ? 'bg-green-600 text-white'
              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }`}
        >
          理想状態（両方が機能）
        </button>
        <button
          onClick={() => setScenario('human-failure')}
          className={`px-4 py-2 rounded-lg transition-colors ${
            scenario === 'human-failure'
              ? 'bg-orange-600 text-white'
              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }`}
        >
          ヒューマン失敗（質が悪い）
        </button>
        <button
          onClick={() => setScenario('cyber-failure')}
          className={`px-4 py-2 rounded-lg transition-colors ${
            scenario === 'cyber-failure'
              ? 'bg-orange-600 text-white'
              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }`}
        >
          サイバー失敗（保護なし）
        </button>
      </div>

      {/* アニメーション */}
      <FactoryAnimationCore scenario={scenario} />

      {/* 説明文 */}
      <div className="text-sm text-slate-300 leading-relaxed">
        {scenario === 'ideal' && (
          <p>
            <span className="font-semibold text-green-400">理想状態</span>：ヒューマンセキュリティが質の高い情報（綺麗なお饅頭）を作り、サイバーセキュリティがそれを保護（包装とリボン）します。教養が深まることで、両者が支え合って真価を発揮します。
          </p>
        )}
        {scenario === 'human-failure' && (
          <p>
            <span className="font-semibold text-orange-400">ヒューマン失敗</span>：対話の質が低く情報が生まれても、サイバーセキュリティが機能しても意味がありません。質の悪い情報（ぐしゃぐしゃのお饅頭）を保護しても価値は生まれません。
          </p>
        )}
        {scenario === 'cyber-failure' && (
          <p>
            <span className="font-semibold text-orange-400">サイバー失敗</span>：質の高い情報が生まれても、サイバーセキュリティが機能しない（ロボットアームが眠っている）と、情報は保護されず腐敗してしまいます。技術的な防御が不可欠です。
          </p>
        )}
      </div>
    </div>
  );
}
