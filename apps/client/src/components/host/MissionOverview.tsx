/**
 * MissionOverview — staff-only mission overview panel.
 *
 * Shows all 30 missions organized by difficulty (easy/medium/hard).
 * For each player, displays their assigned missions as difficulty badges.
 * Mission content (title/description) is hidden by default to avoid
 * spoiling, but can be revealed via a toggle for staff reference.
 */

import { useState, memo } from 'react';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/game-store';
import {
  EASY_MISSIONS,
  MEDIUM_MISSIONS,
  HARD_MISSIONS,
  MISSION_REWARDS,
  type Mission,
  type MissionDifficulty,
} from '@treasure-contest/shared';

const DIFFICULTY_LABEL: Record<MissionDifficulty, string> = {
  easy: '简单',
  medium: '中等',
  hard: '困难',
};

const DIFFICULTY_COLOR: Record<MissionDifficulty, string> = {
  easy: 'text-emerald-400',
  medium: 'text-amber-400',
  hard: 'text-rose-400',
};

const DIFFICULTY_BG: Record<MissionDifficulty, string> = {
  easy: 'border-emerald-700/50 bg-emerald-950/20',
  medium: 'border-amber-700/50 bg-amber-950/20',
  hard: 'border-rose-700/50 bg-rose-950/20',
};

interface MissionPoolProps {
  title: string;
  missions: Mission[];
  difficulty: MissionDifficulty;
  reveal: boolean;
}

function MissionPool({ title, missions, difficulty, reveal }: MissionPoolProps) {
  return (
    <div className={clsx('rounded-lg border p-2', DIFFICULTY_BG[difficulty])}>
      <div className="mb-1.5 flex items-center justify-between">
        <span className={clsx('text-xs font-bold', DIFFICULTY_COLOR[difficulty])}>
          {title}
        </span>
        <span className="text-[10px] text-slate-500">
          {missions.length} 个 · +{MISSION_REWARDS[difficulty]}分/个
        </span>
      </div>
      <div className="space-y-0.5">
        {missions.map((m) => (
          <div
            key={m.id}
            className="flex items-center gap-1.5 text-[11px]"
          >
            <span className="font-mono text-slate-500">{m.id}</span>
            {reveal ? (
              <span className="text-slate-300">{m.title}</span>
            ) : (
              <span className="text-slate-600">******</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function MissionOverviewComponent() {
  const allPlayers = useGameStore((s) => s.allPlayers);
  const [reveal, setReveal] = useState(false);

  // Build a lookup: missionId -> playerId (who has it)
  const missionOwnerMap = new Map<string, { playerId: string; playerName: string; completed: boolean }>();
  for (const player of allPlayers) {
    for (const m of player.missions) {
      missionOwnerMap.set(m.missionId, {
        playerId: player.id,
        playerName: player.name,
        completed: m.completed,
      });
    }
  }

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-4">
      {/* Header with toggle */}
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-300">
          任务总览
        </h3>
        <button
          onClick={() => setReveal((v) => !v)}
          className={clsx(
            'flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium transition-colors',
            reveal
              ? 'bg-amber-600/30 text-amber-400'
              : 'bg-slate-700 text-slate-400 hover:bg-slate-600',
          )}
        >
          {reveal ? (
            <>
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29 3.29m7.532 3.106L9.88 9.88m5.44 3.106l-2.22 2.22" />
              </svg>
              已显示内容
            </>
          ) : (
            <>
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              显示内容
            </>
          )}
        </button>
      </div>

      {/* Mission pools */}
      <div className="mb-3 space-y-2">
        <MissionPool
          title={DIFFICULTY_LABEL.easy}
          missions={EASY_MISSIONS}
          difficulty="easy"
          reveal={reveal}
        />
        <MissionPool
          title={DIFFICULTY_LABEL.medium}
          missions={MEDIUM_MISSIONS}
          difficulty="medium"
          reveal={reveal}
        />
        <MissionPool
          title={DIFFICULTY_LABEL.hard}
          missions={HARD_MISSIONS}
          difficulty="hard"
          reveal={reveal}
        />
      </div>

      {/* Player mission assignments */}
      <div className="border-t border-slate-700/50 pt-2">
        <p className="mb-1.5 text-[10px] font-medium text-slate-500">
          玩家任务分配
        </p>
        {allPlayers.length === 0 ? (
          <p className="text-[11px] text-slate-600">无玩家</p>
        ) : (
          <div className="space-y-1">
            <AnimatePresence>
              {[...allPlayers]
                .sort((a, b) => a.seatNumber - b.seatNumber)
                .map((player) => (
                  <motion.div
                    key={player.id}
                    layout
                    className="flex items-center gap-2 text-[11px]"
                  >
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-slate-700 text-[9px] font-bold text-slate-300">
                      {player.seatNumber}
                    </span>
                    <span className="w-16 shrink-0 truncate text-slate-300">
                      {player.name}
                    </span>
                    <div className="flex flex-1 gap-1">
                      {player.missions.map((m, i) => {
                        const owner = missionOwnerMap.get(m.missionId);
                        return (
                          <span
                            key={`${m.missionId}-${i}`}
                            className={clsx(
                              'flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px] font-bold',
                              m.difficulty === 'easy' && 'bg-emerald-900/30 text-emerald-400',
                              m.difficulty === 'medium' && 'bg-amber-900/30 text-amber-400',
                              m.difficulty === 'hard' && 'bg-rose-900/30 text-rose-400',
                              m.completed && 'ring-1 ring-emerald-400/60',
                            )}
                            title={
                              reveal
                                ? `${m.missionId} · ${owner?.playerName ?? ''}${m.completed ? ' · 已完成' : ''}`
                                : `${DIFFICULTY_LABEL[m.difficulty]}级任务${m.completed ? ' · 已完成' : ''}`
                            }
                          >
                            {DIFFICULTY_LABEL[m.difficulty].charAt(0)}
                            {m.completed && '✓'}
                          </span>
                        );
                      })}
                    </div>
                  </motion.div>
                ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Warning when reveal is on */}
      {reveal && (
        <p className="mt-2 text-center text-[10px] text-amber-500/70">
          任务内容已显示 — 仅限工作人员查看
        </p>
      )}
    </div>
  );
}

export const MissionOverview = memo(MissionOverviewComponent);
export default MissionOverview;
