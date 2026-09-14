/**
 * QRDisplay — shows the QR code for players to scan and join the room.
 *
 * Displays the room code prominently, generates a QR code encoding the
 * player join URL (`/play/:roomCode`), and shows the current player count
 * versus the target player count.  The QR code and room code are always
 * visible so the host can project this panel on a shared screen.
 */

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import clsx from 'clsx';
import { motion } from 'framer-motion';
import { useGameStore } from '../../store/game-store';
import { useSocketStore } from '../../store/socket-store';
import { MIN_PLAYERS } from '@treasure-contest/shared';

export interface QRDisplayProps {
  /** Additional CSS class names. */
  className?: string;
}

export function QRDisplay({ className }: QRDisplayProps) {
  const roomCode = useSocketStore((s) => s.roomCode);
  const playerSeats = useGameStore((s) => s.playerSeats);
  const queueCount = useGameStore((s) => s.queueCount);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  const connectedPlayers = playerSeats.filter((p) => p.isConnected).length;
  const totalPlayers = playerSeats.length;

  // Generate QR code from the player join URL
  useEffect(() => {
    if (!roomCode) return;

    const playUrl = `${window.location.origin}/play/${roomCode}`;

    QRCode.toDataURL(playUrl, {
      width: 200,
      margin: 1,
      color: {
        dark: '#0f172a',
        light: '#f8fafc',
      },
      errorCorrectionLevel: 'M',
    })
      .then((url) => setQrDataUrl(url))
      .catch(() => setQrDataUrl(''));
  }, [roomCode]);

  return (
    <div
      className={clsx(
        'rounded-xl border border-slate-700 bg-slate-800/50 p-4',
        className,
      )}
    >
      <h3 className="mb-3 text-sm font-semibold text-slate-300">
        玩家加入
      </h3>

      {/* QR Code */}
      <div className="mb-3 flex justify-center">
        {qrDataUrl ? (
          <motion.img
            src={qrDataUrl}
            alt="扫码加入房间"
            className="h-44 w-44 rounded-lg bg-slate-50 p-1"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          />
        ) : (
          <div className="flex h-44 w-44 items-center justify-center rounded-lg bg-slate-700 text-xs text-slate-500">
            生成二维码中...
          </div>
        )}
      </div>

      {/* Room code */}
      <div className="mb-3 text-center">
        <p className="text-xs text-slate-500">房间号</p>
        <motion.p
          key={roomCode}
          className="font-mono text-2xl font-bold tracking-[0.3em] text-violet-300"
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {roomCode ?? '------'}
        </motion.p>
      </div>

      {/* Player count */}
      <div className="flex items-center justify-center gap-2 text-sm">
        <span className="text-slate-400">在线玩家</span>
        <motion.span
          key={totalPlayers}
          className={clsx(
            'font-bold',
            totalPlayers >= MIN_PLAYERS ? 'text-emerald-400' : 'text-amber-400',
          )}
          initial={{ scale: 1.2 }}
          animate={{ scale: 1 }}
        >
          {connectedPlayers}
        </motion.span>
        <span className="text-slate-500">/</span>
        <span className="font-bold text-slate-300">{totalPlayers}</span>
        {queueCount > 0 && (
          <span className="ml-1 text-xs text-sky-400">
            (排队 {queueCount})
          </span>
        )}
      </div>

      {totalPlayers < MIN_PLAYERS && (
        <p className="mt-2 text-center text-xs text-amber-500/80">
          至少需要 {MIN_PLAYERS} 名玩家才能开始
        </p>
      )}
    </div>
  );
}

export default QRDisplay;
