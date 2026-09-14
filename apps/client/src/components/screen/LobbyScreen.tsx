/**
 * LobbyScreen - LOBBY phase display for the big screen.
 *
 * Shows:
 * - Large room code display
 * - QR code prominently shown (for players to scan)
 * - Player count / target (e.g., "4/6 人已加入")
 * - List of joined players with seat numbers
 * - Queue count indicator
 * - "等待主持人开始游戏..." message
 *
 * The QR code and room code are rendered in the ScreenDisplay overlay
 * during LOBBY and GAME_OVER, so this component focuses on the player
 * list and waiting message.
 */

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { useGameStore } from '../../store/game-store';
import { useSocketStore } from '../../store/socket-store';
import {
  MIN_PLAYERS,
  DEFAULT_TARGET_PLAYERS,
  MAX_PLAYERS,
} from '@treasure-contest/shared';
import {
  fadeIn,
  scaleIn,
  staggerContainer,
  slideIn,
} from '../../animations/variants';

/** Seat badge background colors for visual differentiation. */
const SEAT_BG = [
  'bg-rose-600',
  'bg-sky-600',
  'bg-emerald-600',
  'bg-amber-600',
  'bg-violet-600',
  'bg-cyan-600',
  'bg-orange-600',
  'bg-pink-600',
];

export function LobbyScreen() {
  const roomCode = useSocketStore((s) => s.roomCode);
  const playerSeats = useGameStore((s) => s.playerSeats);
  const queueCount = useGameStore((s) => s.queueCount);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  const playerCount = playerSeats.length;
  const targetPlayers = DEFAULT_TARGET_PLAYERS;
  const hasEnough = playerCount >= MIN_PLAYERS;

  // Generate QR code from the player join URL
  useEffect(() => {
    if (!roomCode) return;

    const playUrl = `${window.location.origin}/play/${roomCode}`;

    QRCode.toDataURL(playUrl, {
      width: 400,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#f8fafc',
      },
      errorCorrectionLevel: 'M',
    })
      .then((url) => setQrDataUrl(url))
      .catch(() => setQrDataUrl(''));
  }, [roomCode]);

  // Sort players by seat number
  const sorted = [...playerSeats].sort((a, b) => a.seatNumber - b.seatNumber);

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="flex h-full w-full items-center justify-center gap-12"
    >
      {/* Left: QR code + room code */}
      <motion.div
        variants={scaleIn}
        className="flex flex-col items-center gap-6"
      >
        {/* QR Code */}
        <div className="rounded-3xl bg-slate-50 p-4 shadow-2xl">
          {qrDataUrl ? (
            <motion.img
              src={qrDataUrl}
              alt="扫码加入房间"
              className="h-64 w-64 rounded-2xl"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
            />
          ) : (
            <div className="flex h-64 w-64 items-center justify-center rounded-2xl bg-slate-200 text-base text-slate-400">
              生成二维码中...
            </div>
          )}
        </div>

        {/* Room code */}
        <div className="text-center">
          <p className="mb-1 text-base text-slate-400">房间号</p>
          <motion.p
            key={roomCode}
            className="font-mono text-6xl font-bold tracking-[0.3em] text-violet-300"
            style={{ textShadow: '0 0 20px rgba(139,92,246,0.5)' }}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {roomCode ?? '------'}
          </motion.p>
        </div>

        <p className="text-lg text-slate-400">扫码或输入房间号加入游戏</p>
      </motion.div>

      {/* Right: Player list + status */}
      <motion.div
        variants={fadeIn}
        className="flex max-w-2xl flex-col gap-6"
      >
        {/* Player count */}
        <motion.div
          variants={scaleIn}
          className="flex items-center gap-4 rounded-2xl border border-slate-700 bg-slate-800/60 px-8 py-4"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl text-slate-300">已加入</span>
            <motion.span
              key={playerCount}
              className={clsx(
                'text-5xl font-bold tabular-nums',
                hasEnough ? 'text-emerald-400' : 'text-amber-400',
              )}
              initial={{ scale: 1.3 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 14 }}
            >
              {playerCount}
            </motion.span>
            <span className="text-3xl text-slate-500">/</span>
            <span className="text-4xl font-bold text-slate-300">
              {targetPlayers}
            </span>
            <span className="text-2xl text-slate-400">人</span>
          </div>

          {hasEnough ? (
            <span className="rounded-full bg-emerald-900/50 px-4 py-1.5 text-base font-semibold text-emerald-400">
              人数达标
            </span>
          ) : (
            <span className="rounded-full bg-amber-900/50 px-4 py-1.5 text-base font-semibold text-amber-400">
              还差 {MIN_PLAYERS - playerCount} 人
            </span>
          )}
        </motion.div>

        {/* Queue indicator */}
        {queueCount > 0 && (
          <motion.div
            variants={fadeIn}
            className="flex items-center gap-2 text-lg text-sky-400"
          >
            <span className="flex h-3 w-3 items-center justify-center">
              <span className="h-2 w-2 animate-ping rounded-full bg-sky-400" />
              <span className="absolute h-2 w-2 rounded-full bg-sky-400" />
            </span>
            另有 {queueCount} 人在排队等待
          </motion.div>
        )}

        {/* Player list */}
        {sorted.length > 0 && (
          <motion.div
            variants={staggerContainer}
            className="grid grid-cols-2 gap-3"
          >
            {sorted.map((seat) => (
              <motion.div
                key={seat.playerId}
                variants={slideIn}
                className={clsx(
                  'flex items-center gap-3 rounded-xl border-2 p-3',
                  seat.isConnected
                    ? 'border-slate-600 bg-slate-800/60'
                    : 'border-slate-700 bg-slate-900/40 opacity-60',
                )}
              >
                {/* Seat number badge */}
                <div
                  className={clsx(
                    'flex h-10 w-10 items-center justify-center rounded-full text-lg font-bold text-white',
                    SEAT_BG[(seat.seatNumber - 1) % SEAT_BG.length],
                  )}
                >
                  {seat.seatNumber}
                </div>

                {/* Player name */}
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-lg font-semibold text-slate-100">
                    {seat.name}
                  </span>
                  <span
                    className={clsx(
                      'text-xs',
                      seat.isConnected
                        ? 'text-emerald-400'
                        : 'text-rose-400',
                    )}
                  >
                    {seat.isConnected ? '在线' : '离线'}
                  </span>
                </div>
              </motion.div>
            ))}

            {/* Empty slots */}
            {Array.from({ length: Math.max(0, MAX_PLAYERS - sorted.length) }).map(
              (_, i) => (
                <div
                  key={`empty-${i}`}
                  className="flex items-center gap-3 rounded-xl border-2 border-dashed border-slate-800 bg-slate-900/20 p-3"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-dashed border-slate-700 text-lg font-bold text-slate-700">
                    ?
                  </div>
                  <span className="text-base text-slate-700">等待加入...</span>
                </div>
              ),
            )}
          </motion.div>
        )}

        {/* Waiting message */}
        <motion.div
          variants={fadeIn}
          className="flex items-center justify-center gap-3"
        >
          <motion.span
            className="flex h-4 w-4 items-center justify-center"
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          >
            <span className="h-3 w-3 rounded-full bg-violet-400" />
          </motion.span>
          <p className="text-2xl font-medium text-slate-300">
            等待主持人开始游戏...
          </p>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

export default LobbyScreen;
