/**
 * FinalResults - Shown during RESULTS_REVEAL and GAME_OVER phases.
 *
 * Displays the final ranking of all players, showing their final scores
 * broken down into base score, color bonus, mission bonus, and total.
 * The player's own row is highlighted.  The winner gets a champion glow
 * effect.
 */

import { motion } from 'framer-motion';
import clsx from 'clsx';
import { useGameStore } from '../../store/game-store';
import {
  GEM_COLOR_LABELS,
  type FinalResult,
} from '@treasure-contest/shared';
import {
  slideIn,
  staggerContainer,
  championEffect,
  fadeIn,
} from '../../animations/variants';

/** Medal emoji for the top 3 ranks. */
const RANK_MEDALS: Record<number, string> = {
  1: '🥇',
  2: '🥈',
  3: '🥉',
};

export function FinalResults() {
  const finalResults = useGameStore((s) => s.finalResults);
  const myPlayerId = useGameStore((s) => s.playerId);
  const myFinalRank = useGameStore((s) => s.myFinalRank);

  const sorted = [...finalResults].sort(
    (a, b) => (a.finalRank ?? 0) - (b.finalRank ?? 0),
  );

  const isGameOver = useGameStore((s) => s.phase) === 'GAME_OVER';

  const tiedForFirst = sorted.filter((r) => r.finalRank === 1).length > 1;

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="flex w-full flex-col gap-2"
    >
      <motion.div variants={fadeIn} className="mb-1 text-center">
        <p className="text-lg font-bold text-violet-300">
          {isGameOver ? '游戏结束' : '最终结果'}
        </p>
      </motion.div>

      {sorted.map((result: FinalResult) => {
        const isMe = result.playerId === myPlayerId;
        const isWinner = result.finalRank === 1;
        const medal = RANK_MEDALS[result.finalRank] ?? '';

        return (
          <motion.div
            key={result.playerId}
            variants={isWinner ? championEffect : slideIn}
            className={clsx(
              'flex items-center gap-2 rounded-xl border p-2.5',
              isMe
                ? 'border-violet-500/50 bg-violet-900/20'
                : 'border-slate-700 bg-slate-800/50',
              isWinner && 'champion-glow',
            )}
          >
            {/* Rank */}
            <div className="flex w-8 items-center justify-center text-lg">
              {medal || (
                <span className="text-sm font-bold text-slate-400">
                  #{result.finalRank}
                </span>
              )}
            </div>

            {/* Name */}
            <div className="min-w-0 flex-1">
              <p
                className={clsx(
                  'truncate text-sm font-medium',
                  isMe ? 'text-violet-300' : 'text-slate-200',
                )}
              >
                {result.name}
                {isMe && ' (我)'}
                {isWinner && (
                  <span className="ml-1 text-[10px] text-amber-400">
                    {tiedForFirst ? '并列冠军' : '冠军'}
                  </span>
                )}
              </p>
              <div className="flex gap-2 text-[10px] text-slate-500">
                <span>基础 {result.baseScore}</span>
                <span>颜色 +{result.colorBonus}</span>
                <span>任务 +{result.missionBonus}</span>
              </div>
            </div>

            {/* Total score */}
            <div className="text-right">
              <p className="text-lg font-bold text-slate-100">
                {result.finalScore}
              </p>
              <p className="text-[10px] text-slate-500">
                {result.totalGems} 颗宝石
              </p>
            </div>
          </motion.div>
        );
      })}

      {/* My missions summary */}
      {isGameOver && myFinalRank !== null && (
        <motion.p
          variants={fadeIn}
          className="mt-2 text-center text-sm text-slate-400"
        >
          你的最终排名: 第 {myFinalRank} 名
        </motion.p>
      )}
    </motion.div>
  );
}

export default FinalResults;
