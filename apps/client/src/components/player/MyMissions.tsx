/**
 * MyMissions - Shows the player's 3 secret missions.
 *
 * Each mission card displays the mission title, description, difficulty
 * badge, and reward points.  During the game, missions show their
 * description but not their completion status (to preserve secrecy).
 * After the game is over (GAME_OVER phase), the completed/failed status
 * is revealed.
 *
 * Mission definitions (title, description) are looked up from the
 * ALL_MISSIONS pool using the missionId.
 */

import { motion } from 'framer-motion';
import clsx from 'clsx';
import { useGameStore } from '../../store/game-store';
import {
  ALL_MISSIONS,
  type PlayerMission,
  type MissionDifficulty,
} from '@treasure-contest/shared';
import { scaleIn, staggerContainer } from '../../animations/variants';

/** Human-readable Chinese labels for each difficulty tier. */
const DIFFICULTY_LABELS: Record<MissionDifficulty, string> = {
  easy: '简单',
  medium: '中等',
  hard: '困难',
};

/** Tailwind color classes for each difficulty badge. */
const DIFFICULTY_STYLES: Record<MissionDifficulty, string> = {
  easy: 'bg-emerald-900/50 text-emerald-300 border-emerald-700/50',
  medium: 'bg-amber-900/50 text-amber-300 border-amber-700/50',
  hard: 'bg-red-900/50 text-red-300 border-red-700/50',
};

/** Looks up a mission definition from the ALL_MISSIONS pool by ID. */
function getMissionDef(missionId: string) {
  return ALL_MISSIONS.find((m) => m.id === missionId);
}

export function MyMissions() {
  const myMissions = useGameStore((s) => s.myMissions);
  const phase = useGameStore((s) => s.phase);

  const isGameOver = phase === 'GAME_OVER' || phase === 'RESULTS_REVEAL';

  if (myMissions.length === 0) return null;

  return (
    <div className="w-full">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200">秘密任务</h3>
        <span className="text-xs text-slate-500">
          {myMissions.length} 个任务
        </span>
      </div>

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="flex flex-col gap-2"
      >
        {myMissions.map((mission: PlayerMission) => {
          const def = getMissionDef(mission.missionId);
          const title = def?.title ?? '未知任务';
          const description = def?.description ?? '';

          return (
            <motion.div
              key={mission.missionId}
              variants={scaleIn}
              className={clsx(
                'relative rounded-lg border p-2.5 transition-all',
                isGameOver && mission.completed
                  ? 'border-emerald-600/50 bg-emerald-900/20'
                  : isGameOver && !mission.completed
                    ? 'border-slate-700 bg-slate-800/30 opacity-60'
                    : 'border-slate-700 bg-slate-800/50',
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-200">
                    {title}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {description}
                  </p>
                </div>
                <span
                  className={clsx(
                    'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium',
                    DIFFICULTY_STYLES[mission.difficulty],
                  )}
                >
                  {DIFFICULTY_LABELS[mission.difficulty]}
                </span>
              </div>

              <div className="mt-1.5 flex items-center justify-between">
                <span className="text-xs text-amber-400">
                  奖励 +{mission.reward} 分
                </span>

                {isGameOver && (
                  <span
                    className={clsx(
                      'text-xs font-bold',
                      mission.completed ? 'text-emerald-400' : 'text-red-400',
                    )}
                  >
                    {mission.completed ? '✓ 已完成' : '✗ 未完成'}
                  </span>
                )}

                {!isGameOver && (
                  <span className="text-xs text-slate-500">
                    待结算
                  </span>
                )}
              </div>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}

export default MyMissions;
