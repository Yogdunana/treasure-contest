/**
 * PlayerJoinPage - Name entry and room join for players.
 *
 * Route: /play/:roomCode
 *
 * Flow:
 * 1. On mount: attempt auto-reconnect via stored auth (Layer 1)
 *    - If auth found in localStorage: connect socket, emit room:reconnect
 *    - If reconnect succeeds (state:sync): navigate to game page
 *    - If SESSION_EXPIRED: show "新一局已开始，请重新加入" message
 * 2. If no stored auth or reconnect fails: show join form
 *    - Player enters name, emit room:join with role='player'
 *    - On success: navigate to game page
 *    - If ROOM_FULL: join queue and show QueuePage
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
  saveAuthToLocal,
  clearAuthLocal,
  generateFingerprint,
} from '../../lib/auth-storage';
import { persistPlayerSession } from '../../lib/session';
import type { RoomJoinAck } from '@treasure-contest/shared';
import { QueuePage } from '../../components/player/QueuePage';
import {
  ErrorCodes,
  type ErrorPayload,
  type StateSnapshot,
  type GamePhase,
} from '@treasure-contest/shared';
import { fadeIn, scaleIn, slideUp } from '../../animations/variants';

type JoinMode = 'idle' | 'connecting' | 'reconnecting' | 'queue';

export default function PlayerJoinPage() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();

  const [mode, setMode] = useState<JoinMode>('idle');
  const [playerName, setPlayerName] = useState('');
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  const isConnected = useSocketStore((s) => s.isConnected);
  const isConnecting = useSocketStore((s) => s.isConnecting);
  const socketError = useSocketStore((s) => s.error);
  const connect = useSocketStore((s) => s.connect);
  const playerSeats = useGameStore((s) => s.playerSeats);
  const queueCount = useGameStore((s) => s.queueCount);

  // Refs for use inside socket listeners (avoid stale closures)
  const modeRef = useRef<JoinMode>('idle');
  const pendingEmitRef = useRef<(() => void) | null>(null);
  const roomCodeRef = useRef(roomCode);
  const nameRef = useRef('');

  modeRef.current = mode;
  roomCodeRef.current = roomCode;
  nameRef.current = playerName;

  // ── Emit pending action when connection is established ──────────────────
  useEffect(() => {
    if (isConnected && pendingEmitRef.current) {
      const emit = pendingEmitRef.current;
      pendingEmitRef.current = null;
      emit();
    }
  }, [isConnected]);

  // ── Register state:sync and error listeners ───────────────────────────
  useEffect(() => {
    if (!roomCode) return;

    const stateSyncHandler = (snapshot: StateSnapshot) => {
      if (snapshot.role === 'player' && modeRef.current !== 'idle') {
        // Join or reconnect succeeded
        navigate(`/play/${roomCode}/game`);
      }
    };

    const errorHandler = (payload: ErrorPayload) => {
      setErrorCode(payload.code);
      setErrorMessage(payload.message);

      if (payload.code === ErrorCodes.SESSION_EXPIRED) {
        clearAuthLocal(roomCode);
        setSessionExpired(true);
        setMode('idle');
      } else if (
        payload.code === ErrorCodes.PLAYER_NOT_FOUND ||
        payload.code === ErrorCodes.ROOM_NOT_FOUND
      ) {
        if (modeRef.current === 'reconnecting') {
          // Layer 1/2/3 failures are handled by the reconnect ack chain.
          return;
        }
        clearAuthLocal(roomCode);
        setMode('idle');
      } else if (payload.code === ErrorCodes.ROOM_FULL) {
        // Room is full — join the queue automatically
        const name = nameRef.current.trim();
        if (name) {
          useGameStore.setState({
            playerId: null,
            snapshotRole: 'queued',
            snapshotRoomCode: roomCode,
          });
          socket.emit('queue:join', {
            roomCode,
            playerName: name,
            fingerprint: generateFingerprint(),
          });
          setMode('queue');
        } else {
          setMode('idle');
        }
      } else {
        setMode('idle');
      }
    };

    socket.on('state:sync', stateSyncHandler);
    socket.on('error', errorHandler);

    return () => {
      socket.off('state:sync', stateSyncHandler);
      socket.off('error', errorHandler);
    };
  }, [roomCode, navigate]);

  // ── Auto-reconnect on mount ────────────────────────────────────────────
  useEffect(() => {
    if (!roomCode) return;

    const applyJoinAck = (ack: RoomJoinAck): boolean => {
      if (ack.success && ack.playerId && ack.authToken && roomCode) {
        saveAuthToLocal(roomCode, ack.playerId, ack.authToken);
        void persistPlayerSession(ack.playerId, roomCode, ack.authToken);
        return true;
      }
      return false;
    };

    const tryFingerprint = () => {
      socket.emit(
        'room:reconnect_by_fingerprint',
        { roomCode, fingerprint: generateFingerprint() },
        (ack: RoomJoinAck) => {
          if (applyJoinAck(ack)) return;
          setMode('idle');
        },
      );
    };

    const tryCookieThenFingerprint = () => {
      socket.emit('room:reconnect_by_cookie', { roomCode }, (ack: RoomJoinAck) => {
        if (applyJoinAck(ack)) return;
        tryFingerprint();
      });
    };

    const auth = getAuthFromLocal(roomCode);
    setMode('reconnecting');
    modeRef.current = 'reconnecting';

    const emitReconnect = () => {
      if (auth) {
        socket.emit(
          'room:reconnect',
          {
            roomCode,
            playerId: auth.playerId,
            authToken: auth.authToken,
          },
          (ack: RoomJoinAck) => {
            if (applyJoinAck(ack)) return;
            if (ack.error?.code === 'SESSION_EXPIRED') {
              clearAuthLocal(roomCode);
              setSessionExpired(true);
              setMode('idle');
              return;
            }
            clearAuthLocal(roomCode);
            tryCookieThenFingerprint();
          },
        );
      } else {
        tryCookieThenFingerprint();
      }
    };

    if (socket.connected) {
      emitReconnect();
    } else {
      connect(roomCode, 'player');
      pendingEmitRef.current = emitReconnect;
    }

    const timeout = window.setTimeout(() => {
      if (modeRef.current === 'reconnecting') {
        setMode('idle');
      }
    }, 8000);

    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Join handler ───────────────────────────────────────────────────────
  const handleJoin = useCallback(() => {
    if (!roomCode) return;
    const name = playerName.trim();
    if (!name) return;

    setSessionExpired(false);
    setErrorCode(null);
    setErrorMessage(null);
    setMode('connecting');
    modeRef.current = 'connecting';

    const emitJoin = () => {
      socket.emit(
        'room:join',
        {
          roomCode,
          playerName: name,
          role: 'player' as const,
          fingerprint: generateFingerprint(),
        },
        (ack: RoomJoinAck) => {
          if (ack.success && ack.queued) {
            useGameStore.setState({
              playerId: null,
              snapshotRole: 'queued',
              snapshotRoomCode: roomCode,
            });
            setMode('queue');
            return;
          }
          if (ack.success && ack.playerId && ack.authToken && roomCode) {
            saveAuthToLocal(roomCode, ack.playerId, ack.authToken);
            void persistPlayerSession(ack.playerId, roomCode, ack.authToken);
            navigate(`/play/${roomCode}/game`);
            return;
          }
          if (ack.error) {
            setErrorCode(ack.error.code);
            setErrorMessage(ack.error.message);
            setMode('idle');
          }
        },
      );
    };

    if (socket.connected) {
      emitJoin();
    } else {
      connect(roomCode, 'player');
      pendingEmitRef.current = emitJoin;
    }
  }, [roomCode, playerName, connect, navigate]);

  // ── Render ─────────────────────────────────────────────────────────────

  // Show queue page when in queue mode
  if (mode === 'queue' && roomCode) {
    return <QueuePage roomCode={roomCode} playerName={playerName.trim()} />;
  }

  const playerCount = playerSeats.length;
  const isReconnecting = mode === 'reconnecting';
  const isConnectingState = mode === 'connecting' || isConnecting;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-6 py-8">
      <motion.div
        variants={fadeIn}
        initial="hidden"
        animate="visible"
        className="flex w-full max-w-sm flex-col items-center gap-5"
      >
        {/* Title */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-violet-400">
            秘宝争夺战
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            加入房间，争夺宝藏
          </p>
        </div>

        {/* Room code card */}
        <motion.div
          variants={scaleIn}
          className="w-full rounded-2xl border border-slate-700 bg-slate-800/50 p-4 text-center"
        >
          <p className="text-xs text-slate-500">房间号</p>
          <p className="mt-1 font-mono text-2xl font-bold tracking-widest text-slate-100">
            {roomCode ?? '??????'}
          </p>
          {playerCount > 0 && (
            <p className="mt-2 text-xs text-slate-400">
              当前 {playerCount} 人在线
              {queueCount > 0 && ` · ${queueCount} 人排队`}
            </p>
          )}
        </motion.div>

        {/* Session expired message */}
        <AnimatePresence>
          {sessionExpired && (
            <motion.div
              variants={slideUp}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="w-full rounded-lg border border-amber-700/50 bg-amber-900/20 p-3 text-center"
            >
              <p className="text-sm text-amber-300">
                新一局已开始，请重新加入
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error message */}
        <AnimatePresence>
          {errorMessage && !sessionExpired && (
            <motion.div
              variants={slideUp}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="w-full rounded-lg border border-red-700/50 bg-red-900/20 p-3 text-center"
            >
              <p className="text-sm text-red-300">{errorMessage}</p>
              {errorCode && (
                <p className="mt-0.5 text-[10px] text-red-500">
                  错误码: {errorCode}
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Reconnecting state */}
        {isReconnecting && (
          <motion.div
            variants={fadeIn}
            initial="hidden"
            animate="visible"
            className="flex flex-col items-center gap-3 py-6"
          >
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
              正在尝试重新连接...
            </p>
          </motion.div>
        )}

        {/* Connection error */}
        {socketError && !isConnected && !isReconnecting && (
          <motion.div
            variants={fadeIn}
            initial="hidden"
            animate="visible"
            className="w-full rounded-lg border border-red-700/50 bg-red-900/20 p-3 text-center"
          >
            <p className="text-sm text-red-300">
              连接失败: {socketError}
            </p>
          </motion.div>
        )}

        {/* Join form */}
        {(mode === 'idle' || mode === 'connecting') && (
          <motion.div
            variants={scaleIn}
            initial="hidden"
            animate="visible"
            className="flex w-full flex-col gap-3"
          >
            <div>
              <label className="mb-1.5 block text-xs text-slate-400">
                输入你的名字
              </label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="你的名字"
                maxLength={12}
                className="w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-2.5 text-base text-slate-100 placeholder:text-slate-600 focus:border-violet-500 focus:outline-none"
                onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                disabled={isConnectingState}
                autoFocus
              />
            </div>

            <button
              onClick={handleJoin}
              disabled={!playerName.trim() || isConnectingState}
              className={clsx(
                'w-full rounded-lg py-2.5 text-base font-semibold text-white transition-all',
                'active:scale-95',
                playerName.trim() && !isConnectingState
                  ? 'bg-violet-600 hover:bg-violet-500'
                  : 'cursor-not-allowed bg-slate-700',
              )}
            >
              {isConnectingState ? '连接中...' : '加入游戏'}
            </button>
          </motion.div>
        )}

        {/* Back link */}
        <button
          onClick={() => navigate('/')}
          className="text-xs text-slate-600 transition-colors hover:text-slate-400"
        >
          ← 返回首页
        </button>
      </motion.div>
    </div>
  );
}
