/**
 * ScreenPage — big-screen display for spectators.
 *
 * Route: /screen/:roomCode
 *
 * On every mount / refresh this page MUST emit `room:join` with
 * role='screen' and apply the join-ack snapshot. A bare socket
 * connection is not "joined" — that was the CNEZFP bug (「已加入0人」
 * with zero `Screen joined room` logs).
 *
 * Does not call disconnect() on unmount, so a projector refresh in
 * this tab cannot wipe host/player sockets in other tabs.
 */

import { useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { socket } from '../lib/socket-client';
import { useSocketStore } from '../store/socket-store';
import { useGameStore } from '../store/game-store';
import { ScreenDisplay } from '../components/screen';

function isScreenSnapshotForRoom(roomCode: string): boolean {
  const store = useGameStore.getState();
  return (
    store.snapshotRole === 'screen' &&
    store.snapshotRoomCode?.toUpperCase() === roomCode.toUpperCase()
  );
}

export default function ScreenPage() {
  const { roomCode } = useParams<{ roomCode: string }>();

  const isConnected = useSocketStore((s) => s.isConnected);
  const isConnecting = useSocketStore((s) => s.isConnecting);
  const error = useSocketStore((s) => s.error);
  const joinAsScreen = useSocketStore((s) => s.joinAsScreen);
  const clearError = useSocketStore((s) => s.clearError);

  const snapshotRole = useGameStore((s) => s.snapshotRole);
  const snapshotRoomCode = useGameStore((s) => s.snapshotRoomCode);

  const joined =
    snapshotRole === 'screen' &&
    Boolean(roomCode) &&
    snapshotRoomCode?.toUpperCase() === roomCode?.toUpperCase();

  const retryRef = useRef<number | null>(null);

  // ── Mount / refresh / transport reconnect: always join as screen ──
  useEffect(() => {
    if (!roomCode) return;
    clearError();
    joinAsScreen(roomCode);

    const onConnect = () => {
      useSocketStore.getState().joinAsScreen(roomCode);
    };
    socket.on('connect', onConnect);

    return () => {
      socket.off('connect', onConnect);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode]);

  // ── Keep joining until a ScreenSnapshot for this room arrives ────
  useEffect(() => {
    if (!roomCode || joined) return;

    if (isConnected) {
      joinAsScreen(roomCode);
    }

    retryRef.current = window.setInterval(() => {
      if (isScreenSnapshotForRoom(roomCode)) return;
      useSocketStore.getState().joinAsScreen(roomCode);
    }, 1500);

    return () => {
      if (retryRef.current !== null) {
        window.clearInterval(retryRef.current);
        retryRef.current = null;
      }
    };
  }, [roomCode, isConnected, joined, joinAsScreen]);

  // ── Loading until the server accepts us as screen ────────────────
  if (!joined && !error) {
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
          {isConnecting || !isConnected ? '正在连接大屏幕...' : '正在加入房间...'}
        </p>
        {roomCode && (
          <p className="text-sm text-slate-600">房间: {roomCode}</p>
        )}
      </div>
    );
  }

  if (error && !joined) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-950 p-6 text-slate-400">
        <div className="rounded-2xl border border-rose-800/50 bg-rose-950/20 px-8 py-6 text-center">
          <p className="mb-2 text-xl font-bold text-rose-400">连接失败</p>
          <p className="text-sm text-slate-500">{error}</p>
        </div>
        <button
          onClick={() => {
            clearError();
            if (roomCode) joinAsScreen(roomCode);
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

  return <ScreenDisplay />;
}
