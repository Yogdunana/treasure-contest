/**
 * RoundEnd - ROUND_END phase display for the big screen.
 *
 * Shows a live scoreboard with all players' current scores, updating
 * in real-time as gems are added.  "第 X 轮结束" title at top, and
 * shows round results: who got what gem this round.
 *
 * The scoreboard is sorted by current score (descending), with each
 * player showing their name, seat number, total gems collected, and
 * current base score (sum of gem values).
 */

import { motion } from 'framer-motion';
import clsx from 'clsx';
import { useGameStore } from '../../store/game-store';
import { GemIcon } from '../shared/GemIcon';
import {
  TOTAL_ROUNDS,
  GEM_COLOR_LABELS,
  type Gem,
  type PlayerSeat,
} from '@treasure-contest/shared';
import {
  fadeIn,
  scaleIn,
  staggerContainer,
  slideIn,
} from '../../animations/variants';

/** Seat badge background colors. */
const SEAT_BG = [
  'bg-rose-600',
  'bg-sky-600',
  'bg-emerald-600',
  'bg-amber-600',
  'bg-violet-600',
  'bg-cyan-600',
  'bg-orange-600',
  'bg-pink-600',
];

interface PlayerScore {
  seat: PlayerSeat;
  gems: Gem[];
  baseScore: number;
  roundGems: Gem[];
}

export function RoundEnd() {
  const currentRound = useGameStore((s) => s.currentRound);
  const gems = useGameStore((s) => s.gems);
  const playerSeats = useGameStore((s) => s.playerSeats);

  // Full collections come from public seats; this-round picks still come
  // from the board so "本轮" stays obvious.
  const playerScores: PlayerScore[] = playerSeats.map((seat) => {
    const roundGems = gems.filter((g) => g.pickedBy === seat.playerId);
    const allGems = seat.gems;
    const baseScore = allGems.reduce((sum, g) => sum + g.value, 0);

    return {
      seat,
      gems: allGems,
      baseScore,
      roundGems,
    };
  });

  // Sort by score descending
  const sorted = [...playerScores].sort(
    (a, b) => b.baseScore - a.baseScore,
  );

  // Unpicked gems
  const unpickedGems = gems.filter((g) => g.pickedBy === undefined);
  const dense = playerSeats.length >= 7;

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className={clsx(
        'flex h-full w-full flex-col items-center justify-center',
        dense ? 'gap-3' : 'gap-6',
      )}
    >
      {/* Title */}
      <motion.div variants={fadeIn} className="text-center">
        <h2
          className={clsx('font-bold text-violet-300', dense ? 'text-4xl' : 'text-5xl')}
          style={{ textShadow: '0 0 30px rgba(139,92,246,0.6)' }}
        >
          第 {currentRound} 轮结束
        </h2>
        <p className="mt-2 text-2xl text-slate-400">
          共 {TOTAL_ROUNDS} 轮 · 还剩 {TOTAL_ROUNDS - currentRound} 轮
        </p>
      </motion.div>

      {/* Scoreboard */}
      <motion.div
        variants={staggerContainer}
        className={clsx(
          'flex w-full max-w-4xl flex-col',
          dense ? 'gap-1.5' : 'gap-3',
        )}
      >
        {sorted.map((player, index) => (
          <motion.div
            key={player.seat.playerId}
            variants={slideIn}
            layout
            className={clsx(
              'flex items-center rounded-2xl border-2',
              dense ? 'gap-3 p-2.5' : 'gap-4 p-4',
              index === 0
                ? 'border-amber-400/60 bg-amber-950/20'
                : 'border-slate-700 bg-slate-800/50',
            )}
          >
            {/* Rank */}
            <div className="flex w-12 items-center justify-center text-3xl font-bold">
              {index === 0 ? (
                <span className="text-amber-400">🥇</span>
              ) : index === 1 ? (
                <span className="text-slate-300">🥈</span>
              ) : index === 2 ? (
                <span className="text-orange-600">🥉</span>
              ) : (
                <span className="text-xl text-slate-500">#{index + 1}</span>
              )}
            </div>

            {/* Seat number badge */}
            <div
              className={clsx(
                'flex h-12 w-12 items-center justify-center rounded-full text-xl font-bold text-white',
                SEAT_BG[(player.seat.seatNumber - 1) % SEAT_BG.length],
                !player.seat.isConnected && 'opacity-50',
              )}
            >
              {player.seat.seatNumber}
            </div>

            {/* Player name + all gems */}
            <div className="min-w-0 flex-1">
              <p className="text-xl font-bold text-slate-100">
                {player.seat.name}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {player.gems.length > 0 ? (
                  player.gems.map((gem) => (
                    <div
                      key={gem.id}
                      className={clsx(
                        'flex items-center gap-1 rounded-lg px-2 py-1',
                        player.roundGems.some((g) => g.id === gem.id)
                          ? 'bg-amber-900/40 ring-1 ring-amber-500/40'
                          : 'bg-slate-700/50',
                      )}
                    >
                      <GemIcon color={gem.color} size={24} variant="emoji" />
                      <span className="text-sm text-slate-200">
                        {GEM_COLOR_LABELS[gem.color]} {gem.value}
                      </span>
                    </div>
                  ))
                ) : (
                  <span className="text-sm text-slate-600">尚未获得宝石</span>
                )}
              </div>
              {player.roundGems.length === 0 && (
                <p className="mt-1 text-xs text-slate-600">本轮未获得宝石</p>
              )}
            </div>

            {/* Score */}
            <div className="text-right">
              <motion.p
                key={player.baseScore}
                className={clsx(
                  'font-bold text-amber-400',
                  dense ? 'text-3xl' : 'text-4xl',
                )}
                initial={{ scale: 1.3 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 14 }}
              >
                {player.baseScore}
              </motion.p>
              <p className="text-sm text-slate-500">
                {player.gems.length} 颗 · 累计
              </p>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Unpicked gems */}
      {unpickedGems.length > 0 && (
        <motion.div
          variants={scaleIn}
          className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-800/40 px-6 py-3"
        >
          <span className="text-lg text-slate-400">未选宝石</span>
          <div className="flex items-center gap-2">
            {unpickedGems.map((gem) => (
              <div key={gem.id} className="opacity-50">
                <GemIcon color={gem.color} size={32} variant="emoji" />
              </div>
            ))}
          </div>
          <span className="text-lg text-slate-500">
            ({unpickedGems.length} 颗)
          </span>
        </motion.div>
      )}

      {/* Next round message */}
      <motion.p
        variants={fadeIn}
        className="text-xl text-slate-500"
        animate={{ opacity: [0.4, 0.8, 0.4] }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      >
        准备进入下一轮...
      </motion.p>
    </motion.div>
  );
}

export default RoundEnd;
