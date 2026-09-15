/**
 * FinalRanking - RESULTS_REVEAL phase display for the big screen.
 *
 * Progressive reveal from last place to first place.  Each player is
 * revealed with a 2-second interval (handled by the server's
 * FINAL_REVEAL_INTERVAL_MS).  Shows: rank, name, base score, color
 * bonus, mission bonus, total score.
 *
 * Mission cards flip to reveal completed/failed status.
 *
 * The champion (1st place) gets special treatment:
 * - Golden glow pulse
 * - Enlarged card
 * - "🏆 冠军" title
 * - Celebration animation (confetti-like particles)
 */

import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { useMemo } from 'react';
import { useGameStore } from '../../store/game-store';
import {
  TIMING_CONFIG,
  type FinalResult,
  type MissionDifficulty,
  type PlayerMission,
} from '@treasure-contest/shared';
import {
  championEffect,
  slideIn,
  fadeIn,
  scaleIn,
  staggerContainer,
  numberFlip,
} from '../../animations/variants';

/** Medal emoji for the top 3 ranks. */
const RANK_MEDALS: Record<number, string> = {
  1: '🏆',
  2: '🥈',
  3: '🥉',
};

/** Difficulty label and style. */
const DIFFICULTY_STYLE: Record<MissionDifficulty, { label: string; color: string }> = {
  easy: { label: '易', color: 'text-emerald-400 bg-emerald-900/40' },
  medium: { label: '中', color: 'text-amber-400 bg-amber-900/40' },
  hard: { label: '难', color: 'text-rose-400 bg-rose-900/40' },
};

/** Renders a mission card with flip animation. */
function MissionCard({ mission, delay }: { mission: PlayerMission; delay: number }) {
  const style = DIFFICULTY_STYLE[mission.difficulty];
  return (
    <motion.div
      className="relative"
      style={{ perspective: 600 }}
      initial={{ rotateY: 180, opacity: 0 }}
      animate={{ rotateY: 0, opacity: 1 }}
      transition={{
        delay,
        type: 'spring',
        stiffness: 120,
        damping: 12,
      }}
    >
      <div
        className={clsx(
          'flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold',
          style.color,
        )}
      >
        <span>{style.label}</span>
        <span className="text-slate-400">+{mission.reward}</span>
        {mission.completed ? (
          <svg
            className="h-3 w-3 text-emerald-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={3}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg
            className="h-3 w-3 text-rose-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={3}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        )}
      </div>
    </motion.div>
  );
}

/** Renders confetti-like particles for the champion. */
function ConfettiParticles() {
  const particles = useMemo(() => {
    return Array.from({ length: 30 }).map((_, i) => ({
      id: i,
      x: (Math.random() - 0.5) * 800,
      y: (Math.random() - 0.5) * 600,
      rotate: Math.random() * 360,
      delay: Math.random() * 0.5,
      duration: 1.5 + Math.random(),
      color: ['#fbbf24', '#f59e0b', '#ef4444', '#3b82f6', '#22c55e', '#a855f7'][
        i % 6
      ],
    }));
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute left-1/2 top-1/2 h-3 w-3 rounded-sm"
          style={{ backgroundColor: p.color }}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
          animate={{
            x: p.x,
            y: p.y,
            opacity: [1, 1, 0],
            rotate: p.rotate,
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            ease: 'easeOut',
            repeat: Infinity,
            repeatDelay: 1,
          }}
        />
      ))}
    </div>
  );
}

/** Renders a single player's result card. */
function ResultCard({
  result,
  compact,
  soleChampion,
}: {
  result: FinalResult;
  compact?: boolean;
  soleChampion: boolean;
}) {
  const isWinner = result.finalRank === 1;
  const medal = RANK_MEDALS[result.finalRank] ?? '';
  const baseDelay = (result.finalRank - 1) * (TIMING_CONFIG.FINAL_REVEAL_INTERVAL_MS / 1000);
  const emphasize = isWinner && soleChampion && !compact;

  return (
    <motion.div
      variants={emphasize ? championEffect : slideIn}
      className={clsx(
        'relative flex shrink-0 items-center rounded-2xl border-2',
        compact ? 'gap-3 p-3' : 'gap-4 p-4',
        isWinner
          ? 'border-amber-400 bg-amber-950/30'
          : 'border-slate-700 bg-slate-800/50',
        emphasize && 'champion-glow',
      )}
    >
      {/* Rank / medal */}
      <div className={clsx('flex items-center justify-center', compact ? 'w-12' : 'w-16')}>
        {isWinner && !compact ? (
          <motion.span
            className="text-5xl"
            animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          >
            {medal}
          </motion.span>
        ) : medal ? (
          <span className={compact ? 'text-3xl' : 'text-4xl'}>{medal}</span>
        ) : (
          <span className="text-2xl font-bold text-slate-500">
            #{result.finalRank}
          </span>
        )}
      </div>

      {/* Player info */}
      <div className="flex-1">
        <div className="flex items-center gap-3">
          <p className={clsx(compact ? 'text-xl' : 'text-2xl', 'font-bold', isWinner ? 'text-amber-200' : 'text-slate-200')}>
            {result.name}
          </p>
          {isWinner && (
            <motion.span
              className="rounded-full bg-amber-400 px-3 py-0.5 text-sm font-bold text-amber-950"
              animate={compact ? undefined : { scale: [1, 1.1, 1] }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            >
              {soleChampion ? '🏆 冠军' : '🏆 并列冠军'}
            </motion.span>
          )}
        </div>

        {/* Score breakdown */}
        <div className="mt-2 flex items-center gap-4 text-base">
          <div className="flex items-center gap-1">
            <span className="text-slate-500">基础</span>
            <span className="font-bold text-slate-300">{result.baseScore}</span>
          </div>
          <span className="text-slate-700">+</span>
          <div className="flex items-center gap-1">
            <span className="text-slate-500">颜色</span>
            <span className="font-bold text-violet-400">+{result.colorBonus}</span>
          </div>
          <span className="text-slate-700">+</span>
          <div className="flex items-center gap-1">
            <span className="text-slate-500">任务</span>
            <span className="font-bold text-emerald-400">+{result.missionBonus}</span>
          </div>
        </div>

        {/* Mission cards */}
        <div className="mt-2 flex gap-2">
          {result.missions.map((mission, i) => (
            <MissionCard
              key={`${mission.missionId}-${i}`}
              mission={mission}
              delay={baseDelay + 0.3 + i * 0.15}
            />
          ))}
        </div>
      </div>

      {/* Total score */}
      <div className="text-right">
        <motion.p
          className={clsx(
            'font-bold tabular-nums',
            isWinner
              ? compact
                ? 'text-4xl text-amber-300'
                : 'text-6xl text-amber-300'
              : compact
                ? 'text-3xl text-slate-100'
                : 'text-4xl text-slate-100',
          )}
          style={{
            textShadow: isWinner
              ? '0 0 20px rgba(251,191,36,0.6)'
              : undefined,
          }}
        >
          {result.finalScore}
        </motion.p>
        <p className="text-sm text-slate-500">
          {result.totalGems} 颗宝石
        </p>
      </div>

      {emphasize && <ConfettiParticles />}
    </motion.div>
  );
}

export function FinalRanking({ compact = false }: { compact?: boolean }) {
  const finalResults = useGameStore((s) => s.finalResults);

  const sorted = useMemo(() => {
    const copy = [...finalResults];
    return compact
      ? copy.sort((a, b) => (a.finalRank ?? 0) - (b.finalRank ?? 0))
      : copy.sort((a, b) => (b.finalRank ?? 0) - (a.finalRank ?? 0));
  }, [finalResults, compact]);

  const soleChampion = finalResults.filter((r) => r.finalRank === 1).length === 1;

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className={clsx(
        'flex h-full w-full flex-col items-center gap-4',
        compact ? 'justify-start overflow-y-auto py-2' : 'justify-center',
      )}
    >
      {!compact && (
        <motion.div variants={fadeIn} className="shrink-0 text-center">
          <h2
            className="text-5xl font-bold text-violet-300"
            style={{ textShadow: '0 0 30px rgba(139,92,246,0.6)' }}
          >
            最终排名
          </h2>
          <p className="mt-2 text-2xl text-slate-400">
            秘宝争夺战圆满结束
          </p>
        </motion.div>
      )}

      <motion.div
        variants={staggerContainer}
        className={clsx(
          'flex w-full max-w-4xl flex-col',
          compact ? 'gap-2' : 'gap-3',
        )}
      >
        <AnimatePresence>
          {sorted.map((result) => (
            <ResultCard
              key={result.playerId}
              result={result}
              compact={compact}
              soleChampion={soleChampion}
            />
          ))}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

export default FinalRanking;
