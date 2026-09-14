/**
 * PlayerStatusGrid — grid showing all players' full status.
 *
 * Each player card shows:
 * - Name + seat number (via PlayerAvatar)
 * - Connection status (connected / disconnected)
 * - Current round submission (if revealed)
 * - Available numbers (count remaining)
 * - Used numbers (list)
 * - Gems collected (count + total value, with GemIcon previews)
 * - Current base score (sum of gem values)
 * - Missions (difficulty badges only — content is secret)
 *
 * The current picker is highlighted during GEM_SELECTION.
 */

import { memo } from 'react';
import clsx from 'clsx';
import { motion } from 'framer-motion';
import { useGameStore } from '../../store/game-store';
import { PlayerAvatar } from '../shared/PlayerAvatar';
import { GemIcon } from '../shared/GemIcon';
import { INITIAL_NUMBERS } from '@treasure-contest/shared';
import type { Player, PlayerMission, MissionDifficulty } from '@treasure-contest/shared';

/** Difficulty badge colors. */
const DIFFICULTY_STYLE: Record<MissionDifficulty, string> = {
  easy: 'bg-emerald-600/30 text-emerald-400 ring-1 ring-emerald-600/40',
  medium: 'bg-amber-600/30 text-amber-400 ring-1 ring-amber-600/40',
  hard: 'bg-rose-600/30 text-rose-400 ring-1 ring-rose-600/40',
};

const DIFFICULTY_LABEL: Record<MissionDifficulty, string> = {
  easy: '易',
  medium: '中',
  hard: '难',
};

/** Computes base score = sum of all collected gem values. */
function computeBaseScore(player: Player): number {
  return player.gems.reduce((sum, g) => sum + g.value, 0);
}

/** Renders mission difficulty badges. */
function MissionBadges({ missions }: { missions: PlayerMission[] }) {
  if (missions.length === 0) {
    return <span className="text-[10px] text-slate-600">无任务</span>;
  }
  return (
    <div className="flex gap-1">
      {missions.map((m, i) => (
        <span
          key={`${m.missionId}-${i}`}
          className={clsx(
            'flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] font-bold',
            DIFFICULTY_STYLE[m.difficulty],
            m.completed && 'ring-2 ring-emerald-400',
          )}
          title={`${DIFFICULTY_LABEL[m.difficulty]}级任务 · 奖励 ${m.reward} 分${m.completed ? ' · 已完成' : ''}`}
        >
          {DIFFICULTY_LABEL[m.difficulty]}
          {m.completed && (
            <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </span>
      ))}
    </div>
  );
}

/** Renders a single player's status card. */
function PlayerCard({ player }: { player: Player }) {
  const phase = useGameStore((s) => s.phase);
  const revealedNumbers = useGameStore((s) => s.revealedNumbers);
  const currentPickerId = useGameStore((s) => s.currentPickerId);

  const isCurrentPicker = phase === 'GEM_SELECTION' && currentPickerId === player.id;
  const revealedNumber = revealedNumbers[player.id] ?? null;
  const baseScore = computeBaseScore(player);
  const gemValue = player.gems.reduce((sum, g) => sum + g.value, 0);

  return (
    <motion.div
      layout
      className={clsx(
        'rounded-xl border p-3 transition-colors',
        isCurrentPicker
          ? 'border-orange-500/60 bg-orange-950/30 ring-1 ring-orange-500/30'
          : 'border-slate-700 bg-slate-800/40',
        !player.isConnected && 'opacity-60',
      )}
    >
      {/* Header: avatar + connection */}
      <div className="mb-2 flex items-center justify-between">
        <PlayerAvatar
          name={player.name}
          seatNumber={player.seatNumber}
          isConnected={player.isConnected}
          isCurrent={isCurrentPicker}
          size="sm"
        />
        <div className="flex items-center gap-1">
          {player.isConnected ? (
            <span className="flex items-center gap-0.5 text-[10px] text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              在线
            </span>
          ) : (
            <span className="flex items-center gap-0.5 text-[10px] text-rose-400">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
              离线
            </span>
          )}
        </div>
      </div>

      {/* Current round submission */}
      {revealedNumber !== null && revealedNumber !== undefined && (
        <div className="mb-2 flex items-center justify-center">
          <span className="rounded-lg bg-violet-600/20 px-3 py-1 text-sm font-bold text-violet-300">
            出牌: {revealedNumber}
          </span>
        </div>
      )}
      {player.roundSubmission !== null && revealedNumber === null && (
        <div className="mb-2 flex items-center justify-center">
          <span className="rounded-lg bg-slate-700 px-3 py-1 text-[11px] text-slate-400">
            已提交数字
          </span>
        </div>
      )}

      {/* Numbers */}
      <div className="mb-2 space-y-1">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-slate-500">可用 ({player.availableNumbers.length}/{INITIAL_NUMBERS.length})</span>
          <span className="text-slate-500">已用 ({player.usedNumbers.length})</span>
        </div>
        <div className="flex items-center justify-between gap-1">
          {/* Available numbers */}
          <div className="flex flex-wrap gap-0.5">
            {player.availableNumbers.length === 0 ? (
              <span className="text-[10px] text-slate-600">--</span>
            ) : (
              player.availableNumbers.map((n) => (
                <span
                  key={n}
                  className="flex h-4 w-4 items-center justify-center rounded bg-emerald-900/40 text-[9px] font-bold text-emerald-400"
                >
                  {n}
                </span>
              ))
            )}
          </div>
          {/* Used numbers */}
          <div className="flex flex-wrap gap-0.5">
            {player.usedNumbers.length === 0 ? (
              <span className="text-[10px] text-slate-600">--</span>
            ) : (
              player.usedNumbers.map((n) => (
                <span
                  key={n}
                  className="flex h-4 w-4 items-center justify-center rounded bg-slate-700 text-[9px] font-bold text-slate-500 line-through"
                >
                  {n}
                </span>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Gems + score */}
      <div className="mb-2 flex items-center justify-between border-t border-slate-700/50 pt-2">
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-slate-500">宝石</span>
          <span className="text-xs font-bold text-slate-300">{player.gems.length}</span>
          {player.gems.length > 0 && (
            <div className="flex">
              {player.gems.slice(0, 5).map((gem, i) => (
                <GemIcon
                  key={gem.id}
                  color={gem.color}
                  variant="emoji"
                  size={12}
                />
              ))}
              {player.gems.length > 5 && (
                <span className="text-[9px] text-slate-500">
                  +{player.gems.length - 5}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="text-right">
          <span className="text-[10px] text-slate-500">基础分</span>
          <span className="ml-1 text-sm font-bold text-amber-400">
            {baseScore}
          </span>
          {gemValue !== baseScore && (
            <span className="ml-0.5 text-[10px] text-slate-600">
              ({gemValue})
            </span>
          )}
        </div>
      </div>

      {/* Missions */}
      <div className="flex items-center justify-between border-t border-slate-700/50 pt-2">
        <span className="text-[10px] text-slate-500">任务</span>
        <MissionBadges missions={player.missions} />
      </div>
    </motion.div>
  );
}

function PlayerStatusGridComponent() {
  const allPlayers = useGameStore((s) => s.allPlayers);

  if (allPlayers.length === 0) {
    return (
      <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-300">玩家状态</h3>
        <div className="flex h-32 items-center justify-center text-sm text-slate-600">
          等待玩家加入...
        </div>
      </div>
    );
  }

  // Sort by seat number
  const sorted = [...allPlayers].sort((a, b) => a.seatNumber - b.seatNumber);

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-300">
          玩家状态
        </h3>
        <span className="rounded-full bg-slate-700 px-2 py-0.5 text-[10px] text-slate-400">
          {allPlayers.length} 人
        </span>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-2">
        {sorted.map((player) => (
          <PlayerCard key={player.id} player={player} />
        ))}
      </div>
    </div>
  );
}

export const PlayerStatusGrid = memo(PlayerStatusGridComponent);
export default PlayerStatusGrid;
