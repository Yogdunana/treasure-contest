/**
 * RoundSummary - Shown during the ROUND_END phase.
 *
 * Displays a brief summary of the round: which gems were picked by whom,
 * and the player's current standing.  Provides a brief pause before the
 * next round begins.
 */

import { motion } from 'framer-motion';
import clsx from 'clsx';
import { useGameStore } from '../../store/game-store';
import { GemIcon } from '../shared/GemIcon';
import {
  GEM_COLOR_LABELS,
  type Gem,
} from '@treasure-contest/shared';
import { fadeIn, staggerContainer, scaleIn } from '../../animations/variants';

export function RoundSummary() {
  const currentRound = useGameStore((s) => s.currentRound);
  const gems = useGameStore((s) => s.gems);
  const playerSeats = useGameStore((s) => s.playerSeats);
  const myPlayerId = useGameStore((s) => s.playerId);

  // Map player IDs to names
  const seatMap = new Map(playerSeats.map((s) => [s.playerId, s]));

  // Show gems and who picked them
  const pickedGems = gems.filter((g) => g.pickedBy !== undefined);
  const unpickedGems = gems.filter((g) => g.pickedBy === undefined);

  // Check if the current player got a gem this round
  const myGem = pickedGems.find((g) => g.pickedBy === myPlayerId);

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="flex w-full flex-col gap-3"
    >
      <motion.div variants={fadeIn} className="text-center">
        <p className="text-base font-semibold text-violet-300">
          第 {currentRound} 轮结束
        </p>
      </motion.div>

      {/* Result for the player */}
      <motion.div
        variants={scaleIn}
        className={clsx(
          'rounded-xl border p-3 text-center',
          myGem
            ? 'border-emerald-600/50 bg-emerald-900/20'
            : 'border-slate-700 bg-slate-800/50',
        )}
      >
        {myGem ? (
          <div className="flex flex-col items-center gap-1">
            <GemIcon color={myGem.color} size={40} value={myGem.value} />
            <p className="text-sm text-emerald-300">
              你获得了 {GEM_COLOR_LABELS[myGem.color]} 宝石 +{myGem.value} 分
            </p>
          </div>
        ) : (
          <p className="text-sm text-slate-400">
            本轮未获得宝石
          </p>
        )}
      </motion.div>

      {/* Gem distribution */}
      {pickedGems.length > 0 && (
        <motion.div variants={fadeIn} className="rounded-lg border border-slate-700 bg-slate-800/50 p-2.5">
          <p className="mb-1.5 text-xs text-slate-400">宝石归属</p>
          <div className="flex flex-col gap-1">
            {pickedGems.map((gem: Gem) => {
              const picker = seatMap.get(gem.pickedBy!);
              return (
                <div
                  key={gem.id}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-1.5">
                    <GemIcon color={gem.color} size={20} variant="emoji" />
                    <span className="text-xs text-slate-300">
                      {GEM_COLOR_LABELS[gem.color]} {gem.value}分
                    </span>
                  </div>
                  <span className="text-xs text-slate-500">
                    {picker?.name ?? '未知'}
                  </span>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {unpickedGems.length > 0 && (
        <motion.p variants={fadeIn} className="text-center text-xs text-slate-500">
          {unpickedGems.length} 颗宝石无人选择
        </motion.p>
      )}

      <motion.p
        variants={fadeIn}
        className="text-center text-xs text-slate-500"
      >
        准备进入下一轮...
      </motion.p>
    </motion.div>
  );
}

export default RoundSummary;
