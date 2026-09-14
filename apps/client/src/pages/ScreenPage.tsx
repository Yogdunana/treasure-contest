/**
 * ScreenPage — big-screen display for spectators.
 *
 * Route: /screen/:roomCode
 *
 * Connects to the socket with role='screen' and renders the ScreenDisplay
 * component, which shows the public game state: gems, revealed numbers,
 * selection order, collision groups, player seats, and timer.
 *
 * The screen receives only public state (no secret information like
 * players' numbers, missions, or scores).
 *
 * Full-screen layout optimized for 1920x1080+ displays (TV/projector).
 */

import { useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useSocketStore } from '../store/socket-store';
import { ScreenDisplay } from '../components/screen';

export default function ScreenPage() {
  const { roomCode } = useParams<{ roomCode: string }>();

  const isConnected = useSocketStore((s) => s.isConnected);
  const isConnecting = useSocketStore((s) => s.isConnecting);
  const error = useSocketStore((s) => s.error);
  const socketRoomCode = useSocketStore((s) => s.roomCode);
  const role = useSocketStore((s) => s.role);
  const connect = useSocketStore((s) => s.connect);
  const clearError = useSocketStore((s) => s.clearError);

  const reconnectAttemptedRef = useRef(false);

  // ── Ensure socket connection on mount ──────────────────────────────────
  useEffect(() => {
    if (!roomCode) return;
    if (reconnectAttemptedRef.current) return;
    reconnectAttemptedRef.current = true;

    // Already connected as screen — just update the roomCode if needed
    if (isConnected && role === 'screen') {
      if (socketRoomCode !== roomCode) {
        useSocketStore.setState({ roomCode });
      }
      return;
    }

    // Need to connect
    if (!isConnecting) {
      clearError();
      connect(roomCode, 'screen');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Keep socket store roomCode in sync with URL ────────────────────────
  useEffect(() => {
    if (isConnected && roomCode && socketRoomCode !== roomCode && role === 'screen') {
      useSocketStore.setState({ roomCode });
    }
  }, [isConnected, roomCode, socketRoomCode, role]);

  // ── Loading state ──────────────────────────────────────────────────────
  if (!isConnected && !error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 text-slate-400">
        <svg
          className="h-12 w-12 animate-spin text-violet-400"
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
        <p className="text-xl">
          {isConnecting ? '正在连接大屏幕...' : '正在连接...'}
        </p>
        {roomCode && (
          <p className="text-sm text-slate-600">房间: {roomCode}</p>
        )}
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────
  if (error && !isConnected) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-950 p-6 text-slate-400">
        <div className="rounded-2xl border border-rose-800/50 bg-rose-950/20 px-8 py-6 text-center">
          <p className="mb-2 text-xl font-bold text-rose-400">连接失败</p>
          <p className="text-sm text-slate-500">{error}</p>
        </div>
        <button
          onClick={() => {
            clearError();
            reconnectAttemptedRef.current = false;
            if (roomCode) connect(roomCode, 'screen');
          }}
          className="rounded-lg bg-violet-600 px-6 py-3 text-base font-bold text-white transition-colors hover:bg-violet-500"
        >
          重试连接
        </button>
        {roomCode && (
          <p className="text-sm text-slate-600">房间: {roomCode}</p>
        )}
      </div>
    );
  }

  // ── Main screen display ─────────────────────────────────────────────────
  return <ScreenDisplay />;
}
