/**
 * RoundIndicator - Shows the current round number with a progress bar.
 *
 * Displays "第 X 轮 / 共 6 轮" and a horizontal progress bar that fills
 * as the game advances through its 6 rounds.
 */

import { useGameStore } from '../../store/game-store';
import { TOTAL_ROUNDS, isBriefingPhase } from '@treasure-contest/shared';

export function RoundIndicator() {
  const currentRound = useGameStore((s) => s.currentRound);
  const phase = useGameStore((s) => s.phase);
  const notStarted =
    currentRound <= 0 ||
    phase === 'LOBBY' ||
    isBriefingPhase(phase);
  const displayRound = currentRound > 0 ? currentRound : 0;
  const progress = notStarted ? 0 : (currentRound / TOTAL_ROUNDS) * 100;

  return (
    <div className="w-full">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-200">
          {notStarted ? '等待开始' : `第 ${displayRound} 轮`}
        </span>
        <span className="text-xs text-slate-500">
          共 {TOTAL_ROUNDS} 轮
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-gradient-to-r from-violet-600 to-violet-400 transition-all duration-700 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

export default RoundIndicator;
