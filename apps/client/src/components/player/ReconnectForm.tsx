/**
 * ReconnectForm - Manual reconnection form (Layer 4).
 *
 * When automatic reconnection (Layers 1-3) fails, the player can manually
 * enter their name and seat number to reconnect via the
 * `room:reconnect_by_name` socket event.
 *
 * This is the last-resort reconnection mechanism for players who lost
 * their auth token, cookie, and fingerprint match.
 */

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { socket } from '../../lib/socket-client';
import { useSocketStore } from '../../store/socket-store';
import { fadeIn, scaleIn } from '../../animations/variants';

export interface ReconnectFormProps {
  /** The room code to reconnect to. */
  roomCode: string;
  /** Called after a successful reconnection (optional, for navigation). */
  onSuccess?: () => void;
}

export function ReconnectForm({ roomCode, onSuccess }: ReconnectFormProps) {
  const [playerName, setPlayerName] = useState('');
  const [seatNumber, setSeatNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isConnected = useSocketStore((s) => s.isConnected);
  const connect = useSocketStore((s) => s.connect);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();

      const name = playerName.trim();
      const seat = parseInt(seatNumber, 10);

      if (!name) {
        setError('请输入你的名字');
        return;
      }
      if (!seat || seat < 1 || seat > 8) {
        setError('请输入有效的座位号 (1-8)');
        return;
      }

      setError(null);
      setSubmitting(true);

      // Ensure socket is connected first
      if (!isConnected) {
        connect(roomCode, 'player');
        // Wait for connection, then emit
        const checkInterval = setInterval(() => {
          if (useSocketStore.getState().isConnected) {
            clearInterval(checkInterval);
            socket.emit('room:reconnect_by_name', {
              roomCode,
              playerName: name,
              seatNumber: seat,
            });
            setSubmitting(false);
          }
        }, 500);

        // Timeout after 10s
        setTimeout(() => {
          clearInterval(checkInterval);
          if (submitting) {
            setError('连接超时，请重试');
            setSubmitting(false);
          }
        }, 10000);
      } else {
        socket.emit('room:reconnect_by_name', {
          roomCode,
          playerName: name,
          seatNumber: seat,
        });
        setSubmitting(false);
      }

      // Listen for state:sync which indicates success
      const handler = () => {
        onSuccess?.();
        socket.off('state:sync', handler);
      };
      socket.on('state:sync', handler);

      // Clean up after 15s
      setTimeout(() => socket.off('state:sync', handler), 15000);
    },
    [playerName, seatNumber, isConnected, connect, roomCode, onSuccess, submitting],
  );

  return (
    <motion.div
      variants={scaleIn}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-800/80 p-5 backdrop-blur-sm"
    >
      <motion.div variants={fadeIn} className="mb-4 text-center">
        <h2 className="text-base font-semibold text-slate-200">
          手动重新连接
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          自动重连失败，请输入你的名字和座位号手动恢复
        </p>
      </motion.div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div>
          <label className="mb-1 block text-xs text-slate-400">
            玩家名字
          </label>
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="你的名字"
            maxLength={12}
            className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-violet-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs text-slate-400">
            座位号
          </label>
          <input
            type="number"
            value={seatNumber}
            onChange={(e) => setSeatNumber(e.target.value)}
            placeholder="1-8"
            min={1}
            max={8}
            className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-violet-500 focus:outline-none"
          />
        </div>

        {error && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-xs text-red-400"
          >
            {error}
          </motion.p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className={clsx(
            'w-full rounded-lg bg-violet-600 py-2.5 text-sm font-semibold text-white transition-colors',
            'hover:bg-violet-500 active:scale-95',
            submitting && 'cursor-not-allowed opacity-60',
          )}
        >
          {submitting ? '连接中...' : '重新连接'}
        </button>
      </form>
    </motion.div>
  );
}

export default ReconnectForm;
