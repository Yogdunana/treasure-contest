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
import { useGamePhase } from '../../hooks/useGamePhase';
import {
  getAuthFromLocal,
  clearAuthLocal,
} from '../../lib/auth-storage';
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
  const role = useSocketStore((s) => s.role);
  const connect = useSocketStore((s) => s.connect);

  const playerId = useGameStore((s) => s.playerId);
  const phase = useGameStore((s) => s.phase);
  const { currentRound } = useGamePhase();

  const [activeTab, setActiveTab] = useState<BottomTab>('score');
  const [showReconnectForm, setShowReconnectForm] = useState(false);
  const [autoReconnectFailed, setAutoReconnectFailed] = useState(false);

  // Refs for socket listeners
  const pendingEmitRef = useRef<(() => void) | null>(null);
  const reconnectAttemptedRef = useRef(false);

  // ── Emit pending action when connection is established ──────────────────
  useEffect(() => {
    if (isConnected && pendingEmitRef.current) {
      const emit = pendingEmitRef.current;
      pendingEmitRef.current = null;
      emit();
    }
  }, [isConnected]);

  // ── Register error listener for SESSION_EXPIRED ────────────────────────
  useEffect(() => {
    if (!roomCode) return;

    const errorHandler = (payload: ErrorPayload) => {
      if (payload.code === ErrorCodes.SESSION_EXPIRED) {
        clearAuthLocal(roomCode);
        // Redirect back to join page
        navigate(`/play/${roomCode}`);
      }
    };

    socket.on('error', errorHandler);
    return () => {
      socket.off('error', errorHandler);
    };
  }, [roomCode, navigate]);

  // ── On mount: ensure socket connection ──────────────────────────────────
  useEffect(() => {
    if (!roomCode) return;
    if (reconnectAttemptedRef.current) return;
    reconnectAttemptedRef.current = true;

    // If already connected as player, we're good
    if (isConnected && role === 'player') return;

    // If already connected but not as player, disconnect first
    // (edge case: user was on screen/host page and navigated here)

    // Try auto-reconnect via stored auth
    const auth = getAuthFromLocal(roomCode);
    if (auth) {
      const emitReconnect = () => {
        socket.emit('room:reconnect', {
          roomCode,
          playerId: auth.playerId,
          authToken: auth.authToken,
        });
      };

      if (socket.connected) {
        emitReconnect();
      } else {
        connect(roomCode, 'player');
        pendingEmitRef.current = emitReconnect;
      }
    } else {
      // No stored auth — redirect to join page
      navigate(`/play/${roomCode}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Show reconnect form if auto-reconnect seems to have failed ──────────
  useEffect(() => {
    if (!isConnected && !isConnecting && reconnectAttemptedRef.current) {
      // Give some time for auto-reconnect to work before showing the form
      const timer = setTimeout(() => {
        if (!useSocketStore.getState().isConnected) {
          setAutoReconnectFailed(true);
          setShowReconnectForm(true);
        }
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [isConnected, isConnecting]);

  // ── Handle successful reconnect from ReconnectForm ─────────────────────
  const handleReconnectSuccess = useCallback(() => {
    setShowReconnectForm(false);
    setAutoReconnectFailed(false);
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────

  // Show reconnect form if auto-reconnect failed
  if (showReconnectForm && roomCode && !isConnected) {
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

  // Loading state while connecting
  if (!isConnected && !autoReconnectFailed) {
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

        {/* Bottom panel: score / gems / missions */}
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
      </div>
    </div>
  );
}
