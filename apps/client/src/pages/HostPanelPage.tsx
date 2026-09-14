/**
 * HostPanelPage — main host control panel.
 *
 * Route: /host/:roomCode
 *
 * Connects to the socket with role='host' and displays a three-column
 * dashboard layout:
 *
 *   ┌──────────────┬────────────────────┬──────────────────┐
 *   │ PhaseTracker │ PlayerStatusGrid   │ MissionOverview  │
 *   │ QRDisplay    │ QueuePanel         │ EventLog         │
 *   │ GameControls │                    │                  │
 *   └──────────────┴────────────────────┴──────────────────┘
 *
 * On desktop the layout uses three columns. On tablet and mobile the
 * columns stack vertically. The panel uses a dark theme with high
 * information density, designed for a control-room experience.
 */

import { useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { useSocketStore } from '../store/socket-store';
import { useGameStore } from '../store/game-store';
import { getHostAuth } from '../lib/auth-storage';
import { useGamePhase } from '../hooks/useGamePhase';
import { fadeIn } from '../animations/variants';
import {
  QRDisplay,
  PhaseTracker,
  GameControls,
  PlayerStatusGrid,
  QueuePanel,
  MissionOverview,
  EventLog,
} from '../components/host';

/** Chinese label for each game phase (compact form for the header). */
const PHASE_SHORT: Record<string, string> = {
  LOBBY: '等待中',
  GAME_INIT: '初始化',
  ROUND_START: '回合开始',
  GEM_REVEAL: '宝石展示',
  NUMBER_SELECTION: '数字选择',
  NUMBER_REVEAL: '数字揭示',
  ORDER_CALCULATION: '顺序计算',
  GEM_SELECTION: '宝石选择',
  ROUND_END: '回合结束',
  FINAL_CALCULATION: '最终结算',
  RESULTS_REVEAL: '结果展示',
  GAME_OVER: '游戏结束',
  PAUSED: '已暂停',
};

export default function HostPanelPage() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();

  const isConnected = useSocketStore((s) => s.isConnected);
  const isConnecting = useSocketStore((s) => s.isConnecting);
  const error = useSocketStore((s) => s.error);
  const socketRoomCode = useSocketStore((s) => s.roomCode);
  const connect = useSocketStore((s) => s.connect);

  const phase = useGameStore((s) => s.phase);
  const currentRound = useGameStore((s) => s.currentRound);
  const allPlayers = useGameStore((s) => s.allPlayers);
  const playerSeats = useGameStore((s) => s.playerSeats);
  const { isPaused } = useGamePhase();

  const reconnectAttemptedRef = useRef(false);

  // ── Ensure socket connection ──────────────────────────────────────────
  useEffect(() => {
    if (!roomCode) return;
    if (reconnectAttemptedRef.current) return;
    reconnectAttemptedRef.current = true;

    // Already connected (e.g., navigated from HostCreatePage)
    if (isConnected) {
      // Update roomCode in the store to match the URL if needed
      if (socketRoomCode !== roomCode) {
        useSocketStore.setState({ roomCode });
      }
      return;
    }

    // Need to connect — hostToken must already be in localStorage
    if (!getHostAuth(roomCode)) {
      useSocketStore.setState({
        error: '主持人凭证丢失，请重新创建房间或使用本机创建时的浏览器打开控制台',
      });
      return;
    }
    if (!isConnecting) {
      connect(roomCode, 'host');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Keep socket store roomCode in sync with URL ────────────────────────
  useEffect(() => {
    if (isConnected && roomCode && socketRoomCode !== roomCode) {
      useSocketStore.setState({ roomCode });
    }
  }, [isConnected, roomCode, socketRoomCode]);

  const connectedPlayers = playerSeats.filter((p) => p.isConnected).length;

  // ── Loading state ──────────────────────────────────────────────────────
  if (!isConnected && !error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-950 text-slate-400">
        <svg
          className="h-8 w-8 animate-spin text-violet-400"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
        <p className="text-sm">
          {isConnecting ? '正在连接...' : '正在连接控制台...'}
        </p>
        {roomCode && (
          <p className="text-xs text-slate-600">房间: {roomCode}</p>
        )}
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────
  if (error && !isConnected) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 p-6 text-slate-400">
        <div className="rounded-xl border border-rose-800/50 bg-rose-950/20 px-6 py-4 text-center">
          <p className="mb-1 text-sm font-bold text-rose-400">连接失败</p>
          <p className="text-xs text-slate-500">{error}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              useSocketStore.getState().clearError();
              reconnectAttemptedRef.current = false;
              if (roomCode) connect(roomCode, 'host');
            }}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-500"
          >
            重试
          </button>
          <button
            onClick={() => navigate('/host/create')}
            className="rounded-lg bg-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-600"
          >
            返回创建页
          </button>
        </div>
      </div>
    );
  }

  // ── Main dashboard ─────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Top header bar */}
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-4 py-2.5">
          {/* Left: title + room code */}
          <div className="flex items-center gap-4">
            <h1 className="text-sm font-bold text-violet-400">
              秘宝争夺战 · 控制台
            </h1>
            <div className="hidden items-center gap-1.5 sm:flex">
              <span className="text-[10px] text-slate-600">房间</span>
              <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-xs font-bold text-slate-300">
                {roomCode ?? socketRoomCode ?? '------'}
              </span>
            </div>
          </div>

          {/* Center: phase + round */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-600">阶段</span>
              <span
                className={clsx(
                  'rounded-full px-2 py-0.5 text-[10px] font-bold',
                  isPaused
                    ? 'bg-amber-600/30 text-amber-400'
                    : phase === 'GAME_OVER'
                      ? 'bg-slate-700 text-slate-400'
                      : phase === 'LOBBY'
                        ? 'bg-emerald-600/20 text-emerald-400'
                        : 'bg-violet-600/20 text-violet-400',
                )}
              >
                {isPaused ? '已暂停' : PHASE_SHORT[phase] ?? phase}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-600">回合</span>
              <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-300">
                {currentRound > 0 ? `${currentRound}/6` : '--'}
              </span>
            </div>
          </div>

          {/* Right: connection status + player count */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-slate-600">玩家</span>
              <span className="text-xs font-bold text-slate-300">
                {connectedPlayers}
              </span>
              <span className="text-[10px] text-slate-600">
                /{allPlayers.length}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span
                className={clsx(
                  'h-2 w-2 rounded-full',
                  isConnected ? 'bg-emerald-500' : 'bg-rose-500',
                )}
              />
              <span
                className={clsx(
                  'text-[10px]',
                  isConnected ? 'text-emerald-400' : 'text-rose-400',
                )}
              >
                {isConnected ? '已连接' : '断开'}
              </span>
            </div>
            <button
              onClick={() => navigate('/host/create')}
              className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400 hover:bg-slate-700"
              title="返回创建页"
            >
              退出
            </button>
          </div>
        </div>
      </header>

      {/* Disconnected banner (non-blocking) */}
      <AnimatePresence>
        {!isConnected && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden bg-rose-950/40"
          >
            <div className="flex items-center justify-center gap-2 py-1.5 text-xs text-rose-400">
              <svg className="h-3.5 w-3.5 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z" />
              </svg>
              连接已断开，正在尝试重连...
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Three-column dashboard layout */}
      <motion.main
        variants={fadeIn}
        initial="hidden"
        animate="visible"
        className="mx-auto max-w-[1600px] px-3 py-3"
      >
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[260px_minmax(0,1fr)_320px] xl:grid-cols-[280px_minmax(0,1fr)_340px]">
          {/* Left column: Phase + QR + Controls */}
          <div className="flex flex-col gap-3">
            <PhaseTracker />
            <QRDisplay />
            <GameControls />
          </div>

          {/* Center column: Players + Queue */}
          <div className="flex flex-col gap-3">
            <PlayerStatusGrid />
            <QueuePanel />
          </div>

          {/* Right column: Missions + Events */}
          <div className="flex flex-col gap-3">
            <MissionOverview />
            <EventLog />
          </div>
        </div>
      </motion.main>
    </div>
  );
}
