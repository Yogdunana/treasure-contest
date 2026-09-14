/**
 * LandingPage — entry point for the "秘宝争夺战" game.
 *
 * Route: /
 *
 * Provides three role-selection entry points:
 * - 创建房间 (Create Room)  → /host/create
 * - 加入游戏 (Join Game)    → /play/:roomCode  (room code input)
 * - 大屏观战 (Big Screen)   → /screen/:roomCode (room code input)
 *
 * Also links to the admin dashboard at /admin.
 *
 * Design: dark theme with gem-colored accents, animated gradient title,
 * floating background orbs, and Framer Motion entrance animations.
 */

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { fadeIn, scaleIn, staggerContainer, slideUp } from '../animations/variants';
import {
  TOTAL_ROUNDS,
  MIN_PLAYERS,
  MAX_PLAYERS,
} from '@treasure-contest/shared';

// ---------------------------------------------------------------------------
// Role card configuration
// ---------------------------------------------------------------------------

type CardAccent = 'purple' | 'blue' | 'green';

interface RoleCardConfig {
  id: string;
  title: string;
  description: string;
  accent: CardAccent;
  icon: React.ReactNode;
  hasInput: boolean;
  inputPlaceholder: string;
  buttonText: string;
  link: string; // static link (no room code)
}

/** Inline SVG icon for the "Create Room" card — a crown / host emblem. */
function CrownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 18h20M3 8l4 4 5-7 5 7 4-4v8H3V8z" />
      <circle cx="3" cy="8" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="21" cy="8" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="12" cy="5" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Inline SVG icon for the "Join Game" card — a person entering. */
function PersonIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="7" r="4" />
      <path d="M5.5 21a6.5 6.5 0 0 1 13 0" />
      <path d="M19 12l2 2-2 2M21 14H15" />
    </svg>
  );
}

/** Inline SVG icon for the "Big Screen" card — a monitor / display. */
function MonitorIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
      <circle cx="8" cy="10" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="16" cy="10" r="1.5" fill="currentColor" stroke="none" />
      <path d="M10.5 10h3" />
    </svg>
  );
}

/** Inline SVG icon for the admin link — a gear / settings. */
function GearIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

/** Inline SVG icon for the arrow button — a right-pointing arrow. */
function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

const ROLE_CARDS: RoleCardConfig[] = [
  {
    id: 'create',
    title: '创建房间',
    description: '主持人创建新房间，管理游戏流程',
    accent: 'purple',
    icon: <CrownIcon className="h-8 w-8" />,
    hasInput: false,
    inputPlaceholder: '',
    buttonText: '开始主持',
    link: '/host/create',
  },
  {
    id: 'join',
    title: '加入游戏',
    description: '输入房间号，作为玩家加入对战',
    accent: 'blue',
    icon: <PersonIcon className="h-8 w-8" />,
    hasInput: true,
    inputPlaceholder: '输入房间号',
    buttonText: '加入房间',
    link: '/play/',
  },
  {
    id: 'screen',
    title: '大屏观战',
    description: '输入房间号，在投影大屏上观战',
    accent: 'green',
    icon: <MonitorIcon className="h-8 w-8" />,
    hasInput: true,
    inputPlaceholder: '输入房间号',
    buttonText: '进入观战',
    link: '/screen/',
  },
];

// ---------------------------------------------------------------------------
// Accent helpers
// ---------------------------------------------------------------------------

const ACCENT_TEXT: Record<CardAccent, string> = {
  purple: 'text-gem-purple',
  blue: 'text-gem-blue',
  green: 'text-gem-green',
};

const ACCENT_BORDER: Record<CardAccent, string> = {
  purple: 'border-gem-purple/30 hover:border-gem-purple/60',
  blue: 'border-gem-blue/30 hover:border-gem-blue/60',
  green: 'border-gem-green/30 hover:border-gem-green/60',
};

const ACCENT_GLOW: Record<CardAccent, string> = {
  purple: 'hover:shadow-[0_0_30px_rgba(168,85,247,0.15)]',
  blue: 'hover:shadow-[0_0_30px_rgba(59,130,246,0.15)]',
  green: 'hover:shadow-[0_0_30px_rgba(34,197,94,0.15)]',
};

const ACCENT_ICON_BG: Record<CardAccent, string> = {
  purple: 'bg-gem-purple/10',
  blue: 'bg-gem-blue/10',
  green: 'bg-gem-green/10',
};

const ACCENT_BUTTON: Record<CardAccent, string> = {
  purple: 'bg-gem-purple/20 text-gem-purple hover:bg-gem-purple/30',
  blue: 'bg-gem-blue/20 text-gem-blue hover:bg-gem-blue/30',
  green: 'bg-gem-green/20 text-gem-green hover:bg-gem-green/30',
};

// ---------------------------------------------------------------------------
// Floating background orb configuration
// ---------------------------------------------------------------------------

interface OrbConfig {
  className: string;
  size: string;
  position: string;
  delay: number;
}

const ORBS: OrbConfig[] = [
  { className: 'bg-gem-purple', size: 'w-72 h-72', position: 'top-[10%] left-[5%]', delay: 0 },
  { className: 'bg-gem-blue', size: 'w-64 h-64', position: 'top-[20%] right-[8%]', delay: 1.5 },
  { className: 'bg-gem-green', size: 'w-56 h-56', position: 'bottom-[15%] left-[15%]', delay: 3 },
  { className: 'bg-gem-yellow', size: 'w-48 h-48', position: 'bottom-[20%] right-[20%]', delay: 2 },
  { className: 'bg-gem-red', size: 'w-40 h-40', position: 'top-[45%] left-[45%]', delay: 4 },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function LandingPage() {
  const navigate = useNavigate();

  // Separate room-code inputs for "加入游戏" and "大屏观战" cards
  const [joinCode, setJoinCode] = useState('');
  const [screenCode, setScreenCode] = useState('');

  const handleNavigate = useCallback(
    (path: string, code?: string) => {
      if (code !== undefined) {
        const trimmed = code.trim().toUpperCase();
        if (!trimmed) return;
        navigate(`${path}${trimmed}`);
      } else {
        navigate(path);
      }
    },
    [navigate],
  );

  return (
    <>
      {/* Inject keyframe animations for gradient title and floating orbs */}
      <style>{`
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .title-gradient {
          background: linear-gradient(
            90deg,
            #a855f7 0%,
            #3b82f6 20%,
            #22c55e 40%,
            #eab308 60%,
            #ef4444 80%,
            #a855f7 100%
          );
          background-size: 200% auto;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: gradientShift 5s ease-in-out infinite;
        }
        @keyframes floatOrb {
          0%, 100% { transform: translateY(0) translateX(0); }
          50% { transform: translateY(-30px) translateX(20px); }
        }
        .orb-float {
          animation: floatOrb 8s ease-in-out infinite;
        }
      `}</style>

      <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
        {/* ── Floating background orbs ────────────────────────────────── */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {ORBS.map((orb, i) => (
            <div
              key={i}
              className={clsx(
                'orb-float absolute rounded-full opacity-[0.07] blur-3xl',
                orb.className,
                orb.size,
                orb.position,
              )}
              style={{ animationDelay: `${orb.delay}s` }}
            />
          ))}
        </div>

        {/* ── Main content ─────────────────────────────────────────────── */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="relative z-10 mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-4 py-12"
        >
          {/* ── Hero section ──────────────────────────────────────────── */}
          <motion.div variants={fadeIn} className="mb-10 text-center sm:mb-14">
            {/* Title with animated gradient */}
            <h1 className="title-gradient text-5xl font-black tracking-tight drop-shadow-2xl sm:text-6xl md:text-7xl">
              秘宝争夺战
            </h1>

            {/* Subtitle */}
            <p className="mt-3 text-base font-medium text-slate-400 sm:text-lg">
              社团招新现场多人网页桌游
            </p>

            {/* Description */}
            <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-slate-500 sm:text-base">
              {MIN_PLAYERS}-{MAX_PLAYERS}人同场竞技，{TOTAL_ROUNDS}回合数字博弈与宝石争夺。
              每回合从1-7中选一个数字，按数字大小排序依次选宝石，
              收集颜色奖励与秘密任务，最终得分最高者获胜！
            </p>
          </motion.div>

          {/* ── Role selection cards ──────────────────────────────────── */}
          <motion.div
            variants={staggerContainer}
            className="grid w-full max-w-4xl grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3"
          >
            {ROLE_CARDS.map((card) => {
              const isJoin = card.id === 'join';
              const isScreen = card.id === 'screen';
              const currentCode = isJoin ? joinCode : isScreen ? screenCode : '';
              const setCurrentCode = isJoin
                ? setJoinCode
                : isScreen
                  ? setScreenCode
                  : () => {};

              return (
                <motion.div
                  key={card.id}
                  variants={scaleIn}
                  className={clsx(
                    'group relative flex flex-col rounded-2xl border bg-slate-900/60 p-6 backdrop-blur-sm transition-all duration-300',
                    ACCENT_BORDER[card.accent],
                    ACCENT_GLOW[card.accent],
                  )}
                >
                  {/* Icon */}
                  <div
                    className={clsx(
                      'mb-4 flex h-14 w-14 items-center justify-center rounded-xl',
                      ACCENT_ICON_BG[card.accent],
                      ACCENT_TEXT[card.accent],
                    )}
                  >
                    {card.icon}
                  </div>

                  {/* Title */}
                  <h3 className="mb-1 text-lg font-bold text-slate-100">
                    {card.title}
                  </h3>

                  {/* Description */}
                  <p className="mb-4 text-sm text-slate-500">
                    {card.description}
                  </p>

                  {/* Room code input (if applicable) */}
                  {card.hasInput && (
                    <input
                      type="text"
                      value={currentCode}
                      onChange={(e) => setCurrentCode(e.target.value.toUpperCase())}
                      placeholder={card.inputPlaceholder}
                      maxLength={6}
                      className="mb-3 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-center font-mono text-lg font-bold tracking-widest text-slate-100 placeholder:text-slate-600 placeholder:font-normal placeholder:tracking-normal focus:border-slate-600 focus:outline-none"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleNavigate(card.link, currentCode);
                        }
                      }}
                    />
                  )}

                  {/* Action button */}
                  <button
                    onClick={() =>
                      card.hasInput
                        ? handleNavigate(card.link, currentCode)
                        : handleNavigate(card.link)
                    }
                    disabled={card.hasInput && !currentCode.trim()}
                    className={clsx(
                      'flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold transition-all active:scale-95',
                      ACCENT_BUTTON[card.accent],
                      card.hasInput && !currentCode.trim() && 'cursor-not-allowed opacity-40',
                    )}
                  >
                    {card.buttonText}
                    <ArrowIcon className="h-4 w-4" />
                  </button>
                </motion.div>
              );
            })}
          </motion.div>

          {/* ── Admin dashboard link ──────────────────────────────────── */}
          <motion.button
            variants={slideUp}
            onClick={() => navigate('/admin')}
            className="mt-10 flex items-center gap-2 text-xs text-slate-600 transition-colors hover:text-slate-400"
          >
            <GearIcon className="h-3.5 w-3.5" />
            管理后台
          </motion.button>
        </motion.div>
      </div>
    </>
  );
}
