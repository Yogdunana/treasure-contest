/**
 * ScreenStage — scales the 1920×1080 big-screen layout to the real viewport.
 *
 * Projectors, TVs and laptops are rarely exactly 1080p, and browser chrome
 * eats extra pixels.  The game board is authored for a 16:9 1080p stage;
 * this wrapper letterboxes and uniformly scales that stage so it always
 * sits centered and fully visible (never clipped, never stretched).
 */

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

export const SCREEN_STAGE_WIDTH = 1920;
export const SCREEN_STAGE_HEIGHT = 1080;

function computeScale(width: number, height: number): number {
  if (width <= 0 || height <= 0) return 1;
  return Math.min(width / SCREEN_STAGE_WIDTH, height / SCREEN_STAGE_HEIGHT);
}

export function ScreenStage({ children }: { children: ReactNode }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(() =>
    typeof window === 'undefined'
      ? 1
      : computeScale(window.innerWidth, window.innerHeight),
  );

  useLayoutEffect(() => {
    const el = outerRef.current;
    if (!el) return;

    const update = () => {
      const { width, height } = el.getBoundingClientRect();
      setScale(computeScale(width, height));
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    window.addEventListener('resize', update);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
    };
  }, []);

  return (
    <div
      ref={outerRef}
      className="flex h-screen w-screen items-center justify-center overflow-hidden bg-black"
      id="screenStageOuter"
    >
      <div
        className="relative shrink-0 overflow-hidden"
        id="screenStageFrame"
        style={{
          width: SCREEN_STAGE_WIDTH * scale,
          height: SCREEN_STAGE_HEIGHT * scale,
        }}
      >
        <div
          className="origin-top-left"
          id="screenStageCanvas"
          style={{
            width: SCREEN_STAGE_WIDTH,
            height: SCREEN_STAGE_HEIGHT,
            transform: `scale(${scale})`,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export default ScreenStage;
