/**
 * GameOverScreen - GAME_OVER phase display for the big screen.
 *
 * Compact ranking (so 4–8 rows stay on a 1080p TV) plus a next-game prompt.
 * Enter animations are skipped: nested Framer `hidden` variants were leaving
 * the ranking at opacity 0 while the QR overlay still painted.
 */

import { useMemo } from 'react';
import clsx from 'clsx';
import { useGameStore } from '../../store/game-store';
import { FinalRanking } from './FinalRanking';

export function GameOverScreen() {
  const finalResults = useGameStore((s) => s.finalResults);

  const champions = useMemo(
    () => finalResults.filter((r) => r.finalRank === 1),
    [finalResults],
  );

  const dense = finalResults.length >= 7;

  const championLabel =
    champions.length > 1
      ? `并列冠军: ${champions.map((c) => c.name).join('、')}`
      : champions[0]
        ? `冠军: ${champions[0].name}`
        : '';

  return (
    <div className="flex h-full min-h-0 w-full items-center justify-center overflow-hidden px-2">
      <div className={clsx(
        'flex max-h-full w-full max-w-4xl flex-col items-center justify-center',
        dense ? 'gap-3' : 'gap-5',
      )}>
        {championLabel && (
          <div className="flex shrink-0 justify-center">
            <div className={clsx(
              'flex items-center rounded-2xl border-2 border-amber-400/60 bg-amber-950/30',
              dense ? 'gap-2 px-4 py-2' : 'gap-3 px-6 py-3',
            )}>
              <span className={dense ? 'text-3xl' : 'text-4xl'}>🏆</span>
              <div>
                <p className="text-sm text-amber-300">游戏结束</p>
                <p className={clsx('font-bold text-amber-200', dense ? 'text-xl' : 'text-2xl')}>{championLabel}</p>
              </div>
            </div>
          </div>
        )}

        <div className="min-h-0 w-full overflow-y-auto">
          <FinalRanking compact />
        </div>

        <div className="flex shrink-0 justify-center">
          <div className="flex items-center gap-3 rounded-full border border-violet-500/40 bg-violet-950/30 px-8 py-2.5">
            <span className="block h-3 w-3 rounded-full bg-violet-400" />
            <p className="text-lg font-medium text-violet-300">
              等待主持人开始新一局...
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default GameOverScreen;
