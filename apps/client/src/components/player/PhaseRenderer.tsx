/**
 * PhaseRenderer - Switches on the current game phase to render the
 * appropriate component.
 *
 * Phase → Component mapping:
 * - LOBBY              → WaitingRoom
 * - GEM_REVEAL         → GemDisplay
 * - NUMBER_SELECTION   → NumberHand + TimerBar
 * - NUMBER_REVEAL      → RevealedNumbers
 * - GEM_SELECTION      → GemPicker (my turn) / WaitingForTurn (other's turn)
 * - ROUND_END          → RoundSummary
 * - RESULTS_REVEAL     → FinalResults
 * - GAME_OVER          → FinalResults
 * - (other phases)     → Generic loading/transition state
 *
 * Uses AnimatePresence with a key based on the phase to animate transitions
 * between phases.
 */

import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/game-store';
import { useGamePhase } from '../../hooks/useGamePhase';
import { fadeIn } from '../../animations/variants';
import { GemDisplay } from './GemDisplay';
import { NumberHand } from './NumberHand';
import { TimerBar } from './TimerBar';
import { RevealedNumbers } from './RevealedNumbers';
import { GemPicker } from './GemPicker';
import { WaitingForTurn } from './WaitingForTurn';
import { RoundSummary } from './RoundSummary';
import { FinalResults } from './FinalResults';
import { WaitingRoom } from './WaitingRoom';

/** Brief loading state for transient phases. */
function PhaseTransition({ label }: { label: string }) {
  return (
    <motion.div
      variants={fadeIn}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="flex flex-col items-center justify-center gap-3 py-12"
    >
      <svg
        className="h-8 w-8 animate-spin text-violet-400"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>
      <p className="text-sm text-slate-400">{label}</p>
    </motion.div>
  );
}

export function PhaseRenderer() {
  const phase = useGameStore((s) => s.phase);
  const { isMyTurn } = useGamePhase();

  let content: React.ReactNode;

  switch (phase) {
    case 'LOBBY':
      content = <WaitingRoom />;
      break;

    case 'GEM_REVEAL':
      content = <GemDisplay />;
      break;

    case 'NUMBER_SELECTION':
      content = (
        <div className="flex w-full flex-col gap-4">
          <TimerBar />
          <NumberHand />
        </div>
      );
      break;

    case 'NUMBER_REVEAL':
      content = <RevealedNumbers />;
      break;

    case 'ORDER_CALCULATION':
      content = <PhaseTransition label="计算选宝石顺序..." />;
      break;

    case 'GEM_SELECTION':
      content = isMyTurn ? <GemPicker /> : <WaitingForTurn />;
      break;

    case 'ROUND_END':
      content = <RoundSummary />;
      break;

    case 'FINAL_CALCULATION':
      content = <PhaseTransition label="正在结算最终成绩..." />;
      break;

    case 'RESULTS_REVEAL':
      content = <FinalResults />;
      break;

    case 'GAME_OVER':
      content = <FinalResults />;
      break;

    case 'GAME_INIT':
    case 'ROUND_START':
      content = <PhaseTransition label="准备开始..." />;
      break;

    case 'PAUSED':
      content = <PhaseTransition label="游戏已暂停" />;
      break;

    default:
      content = <PhaseTransition label="加载中..." />;
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={phase}
        variants={fadeIn}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="w-full"
      >
        {content}
      </motion.div>
    </AnimatePresence>
  );
}

export default PhaseRenderer;
