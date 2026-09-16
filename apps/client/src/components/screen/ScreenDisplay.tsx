/**
 * ScreenDisplay - Main container component for the big screen.
 *
 * 1920×1080 stage layout (TV/projector). ScreenStage scales and centers
 * this canvas to the real window so smaller or odd-ratio screens still fit.
 * Contains:
 * - Game title at top with animated glow
 * - Round indicator
 * - Phase-based content area (large center area)
 * - Queue indicator in corner
 * - Paused overlay when game is paused
 * - Join QR rails on both sides during gameplay and GAME_OVER
 *
 * The phase-based content area renders different components based on the
 * current game phase, with smooth AnimatePresence transitions.
 *
 * Note: During LOBBY, the LobbyScreen component renders a large QR as
 * part of its main content.  During the match (and GAME_OVER) matching
 * QR rails sit on the left and right so people on either side of the
 * hall can scan and queue without covering the board.
 */

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { useGameStore } from '../../store/game-store';
import { useSocketStore } from '../../store/socket-store';
import { TOTAL_ROUNDS, type GamePhase } from '@treasure-contest/shared';
import { fadeIn } from '../../animations/variants';
import { LobbyScreen } from './LobbyScreen';
import { RulesScreen } from './RulesScreen';
import { PlayerCollections } from './PlayerCollections';
import { GemReveal } from './GemReveal';
import { NumberSelection } from './NumberSelection';
import { NumberReveal } from './NumberReveal';
import { SelectionOrder } from './SelectionOrder';
import { GemSelection } from './GemSelection';
import { RoundEnd } from './RoundEnd';
import { FinalRanking } from './FinalRanking';
import { GameOverScreen } from './GameOverScreen';
import { QueueIndicator } from './QueueIndicator';
import { PausedOverlay } from './PausedOverlay';

/** Chinese label for each game phase. */
const PHASE_LABEL: Record<GamePhase, string> = {
  LOBBY: '等待中',
  GAME_INIT: '规则说明',
  RULES_BRIEFING: '规则说明',
  MISSION_BRIEFING: '阅读任务',
  ROUND_START: '回合开始',
  GEM_REVEAL: '宝石展示',
  NUMBER_SELECTION: '数字选择',
  NUMBER_REVEAL: '数字揭晓',
  ORDER_CALCULATION: '顺序计算',
  GEM_SELECTION: '宝石选择',
  ROUND_END: '回合结束',
  FINAL_CALCULATION: '最终结算',
  RESULTS_REVEAL: '结果展示',
  GAME_OVER: '游戏结束',
  PAUSED: '已暂停',
};

/** Renders a brief loading/transition state for transient phases. */
function PhaseTransition({ label }: { label: string }) {
  return (
    <motion.div
      variants={fadeIn}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="flex h-full flex-col items-center justify-center gap-4"
    >
      <motion.div
        className="h-12 w-12 rounded-full border-4 border-violet-500 border-t-transparent"
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      />
      <p className="text-2xl text-slate-400">{label}</p>
    </motion.div>
  );
}

/** Phase the big screen should render; while paused keep the frozen scene. */
function useEffectivePhase(): GamePhase {
  const phase = useGameStore((s) => s.phase);
  const pausedPhase = useGameStore((s) => s.pausedPhase);
  return phase === 'PAUSED' && pausedPhase ? pausedPhase : phase;
}

/** Renders the phase-specific content. */
function PhaseContent() {
  const phase = useEffectivePhase();

  switch (phase) {
    case 'LOBBY':
      return <LobbyScreen />;

    case 'GAME_INIT':
    case 'RULES_BRIEFING':
    case 'MISSION_BRIEFING':
      return <RulesScreen />;

    case 'GEM_REVEAL':
      return <GemReveal />;

    case 'NUMBER_SELECTION':
      return <NumberSelection />;

    case 'NUMBER_REVEAL':
      return <NumberReveal />;

    case 'ORDER_CALCULATION':
      return <SelectionOrder />;

    case 'GEM_SELECTION':
      return <GemSelection />;

    case 'ROUND_END':
      return <RoundEnd />;

    case 'RESULTS_REVEAL':
      return <FinalRanking />;

    case 'GAME_OVER':
      return <GameOverScreen />;

    case 'ROUND_START':
      return <PhaseTransition label="准备开始..." />;

    case 'FINAL_CALCULATION':
      return <PhaseTransition label="正在结算最终成绩..." />;

    case 'PAUSED':
      // PausedOverlay handles this; render nothing in the content area
      return null;

    default:
      return <PhaseTransition label="加载中..." />;
  }
}

/** Renders the round indicator at the top. */
function RoundDisplay() {
  const currentRound = useGameStore((s) => s.currentRound);
  const phase = useGameStore((s) => s.phase);

  // Don't show round during lobby or game over
  if (
    phase === 'LOBBY' ||
    phase === 'GAME_OVER' ||
    phase === 'GAME_INIT' ||
    phase === 'RULES_BRIEFING' ||
    phase === 'MISSION_BRIEFING'
  ) {
    return null;
  }

  const displayRound = currentRound > 0 ? currentRound : 0;
  const progress = currentRound > 0 ? (currentRound / TOTAL_ROUNDS) * 100 : 0;

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-500">回合</span>
        <motion.span
          key={currentRound}
          className="text-xl font-bold text-violet-300"
          initial={{ scale: 1.3 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 14 }}
        >
          {displayRound}
        </motion.span>
        <span className="text-sm text-slate-500">/ {TOTAL_ROUNDS}</span>
      </div>
      {/* Progress bar */}
      <div className="h-2 w-32 overflow-hidden rounded-full bg-slate-800">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-violet-600 to-violet-400"
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}

/** Renders the phase indicator badge. */
function PhaseBadge() {
  const phase = useGameStore((s) => s.phase);
  const isPaused = phase === 'PAUSED';

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-slate-500">阶段</span>
      <span
        className={clsx(
          'rounded-full px-3 py-1 text-sm font-bold',
          isPaused
            ? 'bg-amber-600/30 text-amber-400'
            : phase === 'LOBBY'
              ? 'bg-emerald-600/20 text-emerald-400'
              : phase === 'GAME_OVER'
                ? 'bg-slate-700 text-slate-400'
                : 'bg-violet-600/20 text-violet-400',
        )}
      >
        {PHASE_LABEL[phase] ?? phase}
      </span>
    </div>
  );
}

function useJoinQrDataUrl(roomCode: string | null): string {
  const [qrDataUrl, setQrDataUrl] = useState('');

  useEffect(() => {
    if (!roomCode) {
      setQrDataUrl('');
      return;
    }

    const playUrl = `${window.location.origin}/play/${roomCode}`;

    QRCode.toDataURL(playUrl, {
      width: 160,
      margin: 1,
      color: {
        dark: '#0f172a',
        light: '#f8fafc',
      },
      errorCorrectionLevel: 'M',
    })
      .then((url) => setQrDataUrl(url))
      .catch(() => setQrDataUrl(''));
  }, [roomCode]);

  return qrDataUrl;
}

/** Side QR rail so spectators on either aisle can scan and queue. */
function JoinQRRail({
  side,
  forNextGame,
  roomCode,
  qrDataUrl,
}: {
  side: 'left' | 'right';
  forNextGame: boolean;
  roomCode: string | null;
  qrDataUrl: string;
}) {
  return (
    <motion.aside
      initial={{ opacity: 0, x: side === 'left' ? -24 : 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: side === 'left' ? -24 : 24 }}
      transition={{ type: 'spring', stiffness: 120, damping: 16 }}
      className={clsx(
        'join-qr-rail relative z-20 flex w-44 shrink-0 items-center justify-center px-3',
        side === 'left' ? 'pl-4' : 'pr-4',
      )}
      data-side={side}
    >
      <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-3 backdrop-blur-sm">
        <p className="mb-2 text-center text-sm text-slate-400">
          {forNextGame ? '扫码加入下一局' : '扫码排队'}
        </p>
        <div className="flex items-center justify-center">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt="扫码加入房间"
              className="h-28 w-28 rounded-lg bg-slate-50 p-1"
            />
          ) : (
            <div className="flex h-28 w-28 items-center justify-center rounded-lg bg-slate-800 text-xs text-slate-500">
              生成中...
            </div>
          )}
        </div>
        <p className="mt-2 text-center font-mono text-base font-bold text-violet-300">
          {roomCode ?? '------'}
        </p>
      </div>
    </motion.aside>
  );
}

/** Bottom credit line shown on the projector / TV screen. */
function CreditLine() {
  return (
    <p
      className="credit credit-slot relative z-[60] flex h-20 shrink-0 items-center justify-center gap-3 border-t border-white/10 bg-black/50 px-8 text-2xl tracking-wide"
      id="creditLine"
    >
      <span className="credit-org ui-copy font-medium text-slate-100" id="creditOrg">
        深圳北理莫斯科大学计算机协会 · StarByte
      </span>
      <span className="credit-role ui-copy text-xl text-slate-400" id="creditSupport">
        制作
      </span>
      <span className="credit-sep text-slate-500">|</span>
      <span className="credit-league ui-copy font-medium text-slate-100" id="creditLeague">
        共青团深圳北理莫斯科大学委员会
      </span>
      <span className="credit-role ui-copy text-xl text-slate-400" id="creditPresented">
        监制
      </span>
    </p>
  );
}

export function ScreenDisplay() {
  const phase = useGameStore((s) => s.phase);
  const isPaused = phase === 'PAUSED';
  const roomCode = useSocketStore((s) => s.roomCode);
  const qrDataUrl = useJoinQrDataUrl(roomCode);

  // Lobby already has a large QR. During the match (and GAME_OVER) keep
  // matching rails on both sides so people can scan and queue.
  const showJoinQR = phase !== 'LOBBY';
  const forNextGame = phase === 'GAME_OVER';

  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden text-slate-100"
      style={{
        background:
          'radial-gradient(ellipse at top, #1a1a2e 0%, #0f0f1e 50%, #050510 100%)',
      }}
    >
      {/* Ambient background glow */}
      <div className="pointer-events-none absolute inset-0">
        <motion.div
          className="absolute left-1/4 top-1/4 h-96 w-96 rounded-full bg-violet-600/10 blur-3xl"
          animate={{
            opacity: [0.3, 0.5, 0.3],
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        <motion.div
          className="absolute right-1/4 bottom-1/4 h-96 w-96 rounded-full bg-amber-600/10 blur-3xl"
          animate={{
            opacity: [0.2, 0.4, 0.2],
            scale: [1, 1.15, 1],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 2,
          }}
        />
      </div>

      {/* Top header bar */}
      <header className="relative z-20 flex shrink-0 items-center justify-between px-8 py-4">
        {/* Left: Game title */}
        <motion.h1
          className="text-3xl font-bold text-violet-400"
          animate={{
            textShadow: [
              '0 0 15px rgba(139,92,246,0.4)',
              '0 0 25px rgba(139,92,246,0.7)',
              '0 0 15px rgba(139,92,246,0.4)',
            ],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          秘宝争夺战
        </motion.h1>

        {/* Center: Phase badge */}
        <PhaseBadge />

        {/* Right: Round display */}
        <RoundDisplay />
      </header>

      {/* Main row: QR | board | QR so 4–8 player layouts never sit under the codes */}
      <div className="relative z-10 flex min-h-0 flex-1">
        {showJoinQR && (
          <JoinQRRail
            side="left"
            forNextGame={forNextGame}
            roomCode={roomCode}
            qrDataUrl={qrDataUrl}
          />
        )}

        <main className="relative min-h-0 min-w-0 flex-1 overflow-hidden px-4">
          <div className="h-full w-full">
            <PhaseContent />
          </div>
        </main>

        {showJoinQR && (
          <JoinQRRail
            side="right"
            forNextGame={forNextGame}
            roomCode={roomCode}
            qrDataUrl={qrDataUrl}
          />
        )}
      </div>

      <PlayerCollections />

      <CreditLine />

      {/* Queue indicator (top-right corner) */}
      <QueueIndicator />

      {/* Paused overlay */}
      <AnimatePresence>{isPaused && <PausedOverlay />}</AnimatePresence>
    </div>
  );
}

export default ScreenDisplay;
