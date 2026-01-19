import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const MOVE_DURATION_MS = 10000;
const PAUSE_DURATION_MS = 500;
const ARM_ACTION_MS = 1000;
const ARM_DELAY_MS = 500;

const ARM_1_POSITION = { top: 50, left: 505 };
const ARM_2_POSITION = { top: 200, left: 655 };
const ARM_CENTER_OFFSET_X = 50;
const ARM_CENTER_OFFSET_Y = 80;

const MANJU_PATH = {
  startX: 190,
  startY: 195,
  cornerX: 618,
  cornerY: 195,
  turnEndX: 638,
  turnEndY: 200,
  endY: 420
};

type ManjuTimeline = {
  pArm1: number;
  pArm2: number;
  move1Ms: number;
  move2Ms: number;
  turnMs: number;
  move3Ms: number;
  move4Ms: number;
  totalMs: number;
  arm1PauseStartMs: number;
  arm2PauseStartMs: number;
};

type ManjuSegment =
  | { type: 'move'; durationMs: number; from: number; to: number; onEnter?: () => void }
  | { type: 'pause'; durationMs: number; hold: number; onEnter?: () => void };

function getManjuTimeline(): ManjuTimeline {
  const arm1StopX = ARM_1_POSITION.left + ARM_CENTER_OFFSET_X;
  const arm2StopY = ARM_2_POSITION.top + ARM_CENTER_OFFSET_Y;
  const clampedArm1StopX = Math.min(MANJU_PATH.cornerX, Math.max(MANJU_PATH.startX, arm1StopX));
  const clampedArm2StopY = Math.min(MANJU_PATH.endY, Math.max(MANJU_PATH.turnEndY, arm2StopY));

  const horizontalTotal = MANJU_PATH.cornerX - MANJU_PATH.startX;
  const verticalTotal = MANJU_PATH.endY - MANJU_PATH.turnEndY;

  const pArm1 = Math.min(0.4, Math.max(0, ((clampedArm1StopX - MANJU_PATH.startX) / horizontalTotal) * 0.4));
  const pArm2 = Math.min(
    1,
    Math.max(0.5, 0.5 + ((clampedArm2StopY - MANJU_PATH.turnEndY) / verticalTotal) * 0.5)
  );

  const dist1 = Math.max(clampedArm1StopX - MANJU_PATH.startX, 0);
  const dist2 = Math.max(MANJU_PATH.cornerX - clampedArm1StopX, 0);
  const distTurn = Math.hypot(MANJU_PATH.turnEndX - MANJU_PATH.cornerX, MANJU_PATH.turnEndY - MANJU_PATH.cornerY);
  const dist3 = Math.max(clampedArm2StopY - MANJU_PATH.turnEndY, 0);
  const dist4 = Math.max(MANJU_PATH.endY - clampedArm2StopY, 0);

  const totalDist = dist1 + dist2 + distTurn + dist3 + dist4;
  const speed = totalDist > 0 ? totalDist / MOVE_DURATION_MS : 0.1;

  const move1Ms = dist1 / speed;
  const move2Ms = dist2 / speed;
  const turnMs = distTurn / speed;
  const move3Ms = dist3 / speed;
  const move4Ms = dist4 / speed;

  const arm1PauseStartMs = move1Ms + ARM_DELAY_MS;
  const arm2PauseStartMs = move1Ms + ARM_DELAY_MS + ARM_ACTION_MS + move2Ms + turnMs + move3Ms + ARM_DELAY_MS;
  const totalMs =
    move1Ms +
    ARM_DELAY_MS +
    ARM_ACTION_MS +
    move2Ms +
    turnMs +
    move3Ms +
    ARM_DELAY_MS +
    ARM_ACTION_MS +
    move4Ms +
    PAUSE_DURATION_MS;

  return { pArm1, pArm2, move1Ms, move2Ms, turnMs, move3Ms, move4Ms, totalMs, arm1PauseStartMs, arm2PauseStartMs };
}

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
  const [currentState, setCurrentState] = useState<'initial' | 'wrapped' | 'ribboned' | 'rotted'>('initial');

  useEffect(() => {
    let frameId = 0;
    let startTime = performance.now();
    let activeSegmentIndex = -1;
    let lastProgress = 0;
    const timeline = getManjuTimeline();

    setProgress(0);
    setCurrentState('initial');

    const segments: ManjuSegment[] = [
      { type: 'move', durationMs: timeline.move1Ms, from: 0, to: timeline.pArm1 },
      { type: 'pause', durationMs: ARM_DELAY_MS, hold: timeline.pArm1 },
      { type: 'pause', durationMs: ARM_ACTION_MS, hold: timeline.pArm1 },
      { 
        type: 'move', 
        durationMs: timeline.move2Ms, 
        from: timeline.pArm1, 
        to: 0.4,
        onEnter: () => {
          if (cyberWorking) setCurrentState('wrapped');
        }
      },
      { type: 'move', durationMs: timeline.turnMs, from: 0.4, to: 0.5 },
      { type: 'move', durationMs: timeline.move3Ms, from: 0.5, to: timeline.pArm2 },
      { type: 'pause', durationMs: ARM_DELAY_MS, hold: timeline.pArm2 },
      { type: 'pause', durationMs: ARM_ACTION_MS, hold: timeline.pArm2 },
      { 
        type: 'move', 
        durationMs: timeline.move4Ms, 
        from: timeline.pArm2, 
        to: 1,
        onEnter: () => {
          if (!cyberWorking) {
            setCurrentState('rotted');
          } else {
            setCurrentState('ribboned');
          }
        }
      },
      { type: 'pause', durationMs: PAUSE_DURATION_MS, hold: 1 }
    ];

    const tick = (now: number) => {
      let elapsed = now - startTime;
      if (elapsed >= timeline.totalMs) {
        startTime = now;
        activeSegmentIndex = -1;
        setProgress(0);
        setCurrentState('initial');
        elapsed = 0;
        lastProgress = 0;
      }

      let remaining = elapsed;
      let index = 0;
      while (index < segments.length && remaining > segments[index].durationMs) {
        remaining -= segments[index].durationMs;
        index += 1;
      }
      if (index >= segments.length) index = segments.length - 1;

      if (index !== activeSegmentIndex) {
        activeSegmentIndex = index;
        segments[index].onEnter?.();
      }

      const segment = segments[index];
      const nextProgress =
        segment.type === 'move'
          ? segment.from + (segment.to - segment.from) * (segment.durationMs > 0 ? remaining / segment.durationMs : 1)
          : segment.hold;

      if (nextProgress >= lastProgress) {
        setProgress(nextProgress);
        lastProgress = nextProgress;
      }

      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frameId);
  }, [animationKey, cyberWorking]);

  // 座標計算 - 停止ポイントに合わせた動き
  const getPosition = (p: number) => {
    if (p < 0.4) {
      // 横レーン（左から右へ）
      const x = MANJU_PATH.startX + (p / 0.4) * (MANJU_PATH.cornerX - MANJU_PATH.startX);
      const y = MANJU_PATH.startY;
      return { x, y };
    } else if (p < 0.5) {
      // L字の角 - 直角の曲がりをなめらかに
      const turnProgress = (p - 0.4) / 0.1;
      const x = MANJU_PATH.cornerX + turnProgress * (MANJU_PATH.turnEndX - MANJU_PATH.cornerX);
      const y = MANJU_PATH.cornerY + turnProgress * (MANJU_PATH.turnEndY - MANJU_PATH.cornerY);
      return { x, y };
    } else {
      // 縦レーン（上から下へ）
      const verticalProgress = (p - 0.5) / 0.5;
      const x = MANJU_PATH.turnEndX;
      const y = MANJU_PATH.turnEndY + verticalProgress * (MANJU_PATH.endY - MANJU_PATH.turnEndY);
      return { x, y };
    }
  };

  const { x, y } = getPosition(progress);
  const opacity = progress > 0.9 ? 1 - (progress - 0.9) / 0.1 : 1;

  return (
    <div 
      className="absolute transition-opacity duration-100"
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
        
        {(currentState === 'wrapped' || currentState === 'ribboned') && (
          <>
            {/* 包装されたお饅頭 */}
            <rect x="5" y="5" width="30" height="30" rx="3" fill="#8B4513" stroke="#654321" strokeWidth="2" />
            <rect x="8" y="8" width="24" height="24" rx="2" fill="#A0522D" opacity="0.5" />
            
            {currentState === 'ribboned' && (
              <>
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
      <div className="text-cyan-400 text-sm mb-2 font-medium" style={{ marginLeft: '60px', marginTop: '-20px' }}>
        ヒューマンセキュリティ
      </div>
      
      {/* 作業員1と2を少し右側に配置 */}
      <div className="relative" style={{ marginLeft: '70px', marginTop: '25px' }}>
        {mood === 'happy' ? (
          <div className="absolute left-1/2 -top-2 -translate-x-1/2 text-2xl">
            ❤️
          </div>
        ) : (
          <div className="absolute left-1/2 -top-2 -translate-x-1/2 text-2xl">
            💢
          </div>
        )}
        <div className="flex gap-8">
          {/* 作業員1 */}
          <Worker mood={mood} animationKey={animationKey} animatedHand="right" />
          
          {/* 作業員2 */}
          <Worker mood={mood} animationKey={animationKey} animatedHand="left" />
        </div>
      </div>
    </div>
  );
}

/**
 * 作業員のSVGコンポーネント
 */
function Worker({ mood, animationKey, animatedHand }: { mood: 'happy' | 'angry'; animationKey: number; animatedHand: 'left' | 'right' | 'none' }) {
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
        
        {/* 左手 */}
        {animatedHand === 'left' ? (
          <motion.g
            key={`hand-left-${animationKey}`}
            initial={{ y: 0 }}
            animate={{ y: [0, 15, 0] }}
            transition={{ 
              duration: 10,
              times: [0, 0.05, 0.1],
              ease: 'easeInOut',
              repeat: Infinity
            }}
          >
            <circle cx="15" cy="55" r="3" fill="lightblue" opacity="0.7" />
          </motion.g>
        ) : (
          <circle cx="15" cy="55" r="3" fill="lightblue" opacity="0.7" />
        )}
        
        {/* 右手 */}
        {animatedHand === 'right' ? (
          <motion.g
            key={`hand-right-${animationKey}`}
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
        ) : (
          <circle cx="45" cy="55" r="3" fill="lightblue" opacity="0.7" />
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
        className="absolute bg-gradient-to-r from-slate-500 to-slate-400 rounded-lg border-2 border-slate-600 overflow-hidden"
        style={{ top: '0px', left: '500px', width: '80px', height: '320px' }}
      >
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

      {/* 境界の段差を消すための継ぎ目 */}
      <div
        className="absolute bg-slate-500"
        style={{ top: '0px', left: '498px', width: '4px', height: '80px' }}
      />

      {/* 点線をL字でつなぐ */}
      <motion.svg
        className="absolute pointer-events-none"
        width="580"
        height="320"
        viewBox="0 0 580 320"
        style={{ top: '0px', left: '0px' }}
      >
        <motion.path
          d="M 0 40 H 540 V 320"
          fill="none"
          stroke="rgba(100, 116, 139, 0.5)"
          strokeWidth="4"
          strokeDasharray="20 16"
          animate={{ strokeDashoffset: -36 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
      </motion.svg>
    </div>
  );
}

/**
 * ロボットアームのコンポーネント（改善版：多関節構造と現実的な動作）
 */
function RobotArms({ working, animationKey }: { working: boolean; animationKey: number }) {
  const timeline = getManjuTimeline();
  const cycleDurationMs = timeline.totalMs;
  const arm1ActionStart = timeline.arm1PauseStartMs / cycleDurationMs;
  const arm2ActionStart = timeline.arm2PauseStartMs / cycleDurationMs;

  return (
    <>
      {/* 1台目のアーム（包装紙を引く）- 横レーンの左上、垂直下向き */}
      <div className="absolute" style={{ top: `${ARM_1_POSITION.top}px`, left: `${ARM_1_POSITION.left}px`, transform: 'rotate(180deg)' }}>
        <ArticulatedRobotArm 
          working={working} 
          animationKey={animationKey}
          taskType="wrapping"
          actionStart={arm1ActionStart}
          cycleDurationMs={cycleDurationMs}
          actionDurationMs={ARM_ACTION_MS}
        />
      </div>

      {/* 2台目のアーム（リボンを付ける）- 縦レーンの右側、水平左向き */}
      <div className="absolute" style={{ top: `${ARM_2_POSITION.top}px`, left: `${ARM_2_POSITION.left}px`, transform: 'rotate(-90deg)' }}>
        <ArticulatedRobotArm 
          working={working} 
          animationKey={animationKey}
          taskType="ribbon"
          actionStart={arm2ActionStart}
          cycleDurationMs={cycleDurationMs}
          actionDurationMs={ARM_ACTION_MS}
        />
      </div>

      {/* 2台目アームのラベル */}
      <div
        className="absolute text-red-400 text-sm font-medium"
        style={{ top: '270px', left: '875px', transform: 'translateX(-50%)' }}
      >
        サイバーセキュリティ
      </div>
      
      {/* ラベル */}
      <div
        className="absolute text-red-400 text-sm font-medium"
        style={{ top: '20px', left: `${ARM_1_POSITION.left + ARM_CENTER_OFFSET_X}px`, transform: 'translateX(-50%)' }}
      >
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
  actionStart,
  cycleDurationMs,
  actionDurationMs
}: { 
  working: boolean; 
  animationKey: number; 
  taskType: 'wrapping' | 'ribbon';
  actionStart: number;
  cycleDurationMs: number;
  actionDurationMs: number;
}) {
  // 動作シーケンスのキーフレーム
  // 待機 → 下降 → 掴む → 持ち上げる → 作業 → 戻る
  const duration = cycleDurationMs / 1000;
  const actionDurationFraction = actionDurationMs / cycleDurationMs;
  const lead = Math.min(0.05, actionDurationFraction * 0.5);
  const actionEnd = Math.min(actionStart + actionDurationFraction, 1);
  
  // 各関節の回転角度のキーフレーム
  const elbowRotation = working ? [0, 0, -45, -45, -30, 0] : [0];
  const wristRotation = working ? [0, 0, -20, -20, 10, 0] : [0];
  const gripperScale = working ? [1, 1, 0.5, 0.5, 0.5, 1] : [1];
  
  // タイミング配列
  const times = [
    0,
    Math.max(actionStart - lead, 0),
    actionStart,
    Math.min(actionStart + actionDurationFraction * 0.3, actionEnd),
    actionEnd,
    1
  ];
  
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
          <g>
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
              key={`arm-${animationKey}-${taskType}`}
              animate={{ rotate: elbowRotation }}
              transition={{ 
                duration,
                times,
                ease: 'easeInOut',
                repeat: Infinity
              }}
              style={{ transformOrigin: '50px 85px', transformBox: 'view-box' }}
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
                style={{ transformOrigin: '50px 40px', transformBox: 'view-box' }}
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
          </g>
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
          ヒューマンセキュリティが欠如した状態
        </button>
        <button
          onClick={() => setScenario('cyber-failure')}
          className={`px-4 py-2 rounded-lg transition-colors ${
            scenario === 'cyber-failure'
              ? 'bg-orange-600 text-white'
              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }`}
        >
          サイバーセキュリティが欠如した状態
        </button>
      </div>

      {/* アニメーション */}
      <FactoryAnimationCore scenario={scenario} />

      {/* 説明文 */}
      <div className="text-sm text-slate-300 leading-relaxed">
        {scenario === 'ideal' && (
          <p>
            <span className="font-semibold text-green-400">理想状態</span>：ヒューマンセキュリティが質の高い情報（綺麗なお饅頭）を作り、サイバーセキュリティがそれを保護（包装とリボン）します。両者が支え合って真価を発揮します。
          </p>
        )}
        {scenario === 'human-failure' && (
          <p>
            <span className="font-semibold text-orange-400">ヒューマンセキュリティが欠如した状態</span>：対話の質が低く情報が生まれても、サイバーセキュリティが機能しても意味がありません。質の悪い情報（ぐしゃぐしゃのお饅頭）を保護しても価値は生まれません。
          </p>
        )}
        {scenario === 'cyber-failure' && (
          <p>
            <span className="font-semibold text-orange-400">サイバーセキュリティが欠如した状態</span>：質の高い情報が生まれても、サイバーセキュリティが機能しない（ロボットアームが眠っている）と、情報は保護されず腐敗してしまいます。技術的な防御が不可欠です。
          </p>
        )}
      </div>
    </div>
  );
}
