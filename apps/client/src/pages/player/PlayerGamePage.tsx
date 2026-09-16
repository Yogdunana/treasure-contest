/**
 * PlayerGamePage - Main player game UI.
 *
 * Route: /play/:roomCode/game
 *
 * Connects to the socket on mount with role='player'.  Renders different
 * content based on the current game phase via the PhaseRenderer component.
 * Shows the player's collected gems, score, and missions in a bottom panel.
 *
 * Handles disconnection with a DisconnectedBanner and provides a ReconnectForm
 * for manual reconnection when automatic reconnection fails.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { socket } from '../../lib/socket-client';
import { useSocketStore } from '../../store/socket-store';
import { useGameStore } from '../../store/game-store';
import {
  getAuthFromLocal,
  clearAuthLocal,
} from '../../lib/auth-storage';
import { clearPlayerSession } from '../../lib/session';
import {
  DisconnectedBanner,
  PhaseRenderer,
  RoundIndicator,
  MyGems,
  MyScoreCard,
  MyMissions,
  ReconnectForm,
} from '../../components/player';
import {
  ErrorCodes,
  isBriefingPhase,
  type ErrorPayload,
} from '@treasure-contest/shared';
import { fadeIn } from '../../animations/variants';

/** Bottom panel tab labels. */
type BottomTab = 'score' | 'gems' | 'missions';

export default function PlayerGamePage() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();

  const isConnected = useSocketStore((s) => s.isConnected);
  const isConnecting = useSocketStore((s) => s.isConnecting);
  const socketRoomCode = useSocketStore((s) => s.roomCode);
  const connect = useSocketStore((s) => s.connect);
  const ensureJoined = useSocketStore((s) => s.ensureJoined);

  const phase = useGameStore((s) => s.phase);
  const snapshotRole = useGameStore((s) => s.snapshotRole);
  const snapshotRoomCode = useGameStore((s) => s.snapshotRoomCode);

  const joined =
    snapshotRole === 'player' &&
    Boolean(roomCode) &&
    snapshotRoomCode?.toUpperCase() === roomCode?.toUpperCase();

  const [activeTab, setActiveTab] = useState<BottomTab>('score');
  const [showReconnectForm, setShowReconnectForm] = useState(false);
  const [autoReconnectFailed, setAutoReconnectFailed] = useState(false);

  const retryRef = useRef<number | null>(null);

  // ── Register error listener for SESSION_EXPIRED ────────────────────────
  useEffect(() => {
    if (!roomCode) return;

    const errorHandler = (payload: ErrorPayload) => {
      if (
        payload.code === ErrorCodes.SESSION_EXPIRED ||
        payload.code === ErrorCodes.KICKED
      ) {
        clearAuthLocal(roomCode);
        void clearPlayerSession();
        useGameStore.getState().reset();
        navigate(`/play/${roomCode}`, {
          state: payload.code === ErrorCodes.KICKED
            ? { kicked: true, message: payload.message }
            : undefined,
        });
      } else if (
        payload.code === ErrorCodes.PLAYER_NOT_FOUND ||
        payload.code === ErrorCodes.ROOM_NOT_FOUND
      ) {
        clearAuthLocal(roomCode);
        setAutoReconnectFailed(true);
        setShowReconnectForm(true);
      }
    };

    socket.on('error', errorHandler);
    return () => {
      socket.off('error', errorHandler);
    };
  }, [roomCode, navigate]);

  // ── On mount: always join as player (including role-switch from screen/host)
  useEffect(() => {
    if (!roomCode) return;
    const auth = getAuthFromLocal(roomCode);
    if (!auth) {
      navigate(`/play/${roomCode}`);
      return;
    }
    connect(roomCode, 'player');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode]);

  useEffect(() => {
    if (!roomCode || !isConnected || joined) return;
    ensureJoined(roomCode, 'player');

    retryRef.current = window.setInterval(() => {
      const store = useGameStore.getState();
      if (
        store.snapshotRole === 'player' &&
        store.snapshotRoomCode?.toUpperCase() === roomCode.toUpperCase()
      ) {
        return;
      }
      useSocketStore.getState().ensureJoined(roomCode, 'player');
    }, 2500);

    return () => {
      if (retryRef.current !== null) {
        window.clearInterval(retryRef.current);
        retryRef.current = null;
      }
    };
  }, [roomCode, isConnected, joined, ensureJoined]);

  // ── Show reconnect form if auto-reconnect seems to have failed ──────────
  useEffect(() => {
    if (joined) return;
    if (!isConnected && !isConnecting) {
      const timer = setTimeout(() => {
        if (!useSocketStore.getState().isConnected) {
          setAutoReconnectFailed(true);
          setShowReconnectForm(true);
        }
      }, 5000);
      return () => clearTimeout(timer);
    }
    if (isConnected && !joined) {
      const timer = setTimeout(() => {
        const store = useGameStore.getState();
        if (store.snapshotRole !== 'player') {
          setAutoReconnectFailed(true);
          setShowReconnectForm(true);
        }
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [isConnected, isConnecting, joined]);

  // ── Handle successful reconnect from ReconnectForm ─────────────────────
  const handleReconnectSuccess = useCallback(() => {
    setShowReconnectForm(false);
    setAutoReconnectFailed(false);
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────

  // Show reconnect form if auto-reconnect failed
  if (showReconnectForm && roomCode && !joined) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 p-6">
        <ReconnectForm
          roomCode={roomCode}
          onSuccess={handleReconnectSuccess}
        />
        <button
          onClick={() => navigate(`/play/${roomCode}`)}
          className="text-xs text-slate-600 hover:text-slate-400"
        >
          ← 返回加入页面
        </button>
      </div>
    );
  }

  // Loading until the server accepts us as this room's player
  if (!joined && !autoReconnectFailed) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-950">
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
        <p className="text-sm text-slate-400">
          {isConnecting ? '连接中...' : '正在重新连接...'}
        </p>
      </div>
    );
  }

  const tabs: { id: BottomTab; label: string }[] = [
    { id: 'score', label: '积分' },
    { id: 'gems', label: '宝石' },
    { id: 'missions', label: '任务' },
  ];

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100">
      {/* Disconnected banner */}
      <DisconnectedBanner />

      {/* Main scrollable content */}
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pb-2 pt-4">
        {/* Header: room code + round indicator */}
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">房间</span>
            <span className="font-mono text-sm font-bold text-slate-300">
              {socketRoomCode ?? roomCode}
            </span>
          </div>
          <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-500">
            {phase}
          </span>
        </div>

        <div className="mb-4">
          <RoundIndicator />
        </div>

        {/* Phase-specific content */}
        <div className="flex-1">
          <PhaseRenderer />
        </div>

        {/* Bottom panel: score / gems / missions — hidden while reading briefing */}
        {!isBriefingPhase(phase) && (
        <div className="mt-4 border-t border-slate-800 pt-3">
          {/* Tab buttons */}
          <div className="mb-2 flex gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={clsx(
                  'flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors',
                  activeTab === tab.id
                    ? 'bg-violet-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              variants={fadeIn}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              {activeTab === 'score' && <MyScoreCard />}
              {activeTab === 'gems' && <MyGems />}
              {activeTab === 'missions' && <MyMissions />}
            </motion.div>
          </AnimatePresence>
        </div>
        )}
      </div>
    </div>
  );
}
