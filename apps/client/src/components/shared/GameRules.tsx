/**
 * Shared rules copy for phones and the projector. Missions stay off this
 * list so the big screen never leaks secret tasks.
 */

import clsx from 'clsx';
import { GAME_RULE_SECTIONS } from '@treasure-contest/shared';

export function GameRules({ compact = false }: { compact?: boolean }) {
  return (
    <div className={clsx('flex flex-col', compact ? 'gap-3' : 'gap-5')}>
      {GAME_RULE_SECTIONS.map((section) => (
        <section key={section.title}>
          <h3
            className={clsx(
              'font-bold text-violet-300',
              compact ? 'mb-1 text-sm' : 'mb-2 text-2xl',
            )}
          >
            {section.title}
          </h3>
          <ul className={clsx('space-y-1', compact ? 'pl-4' : 'pl-6')}>
            {section.items.map((item) => (
              <li
                key={item}
                className={clsx(
                  'list-disc text-slate-200',
                  compact ? 'text-sm leading-snug' : 'text-xl leading-relaxed',
                )}
              >
                {item}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export default GameRules;
