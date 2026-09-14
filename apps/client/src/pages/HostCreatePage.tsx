/**
 * HostCreatePage — host creates a new room.
 *
 * Route: /host/create
 *
 * The host enters their name and the target number of players (4-8),
 * then creates the room.  On success, they are redirected to the host
 * control panel at /host/:roomCode.
 *
 * Flow:
 * 1. Host fills in the form and submits
 * 2. If socket not connected: connect with role='host', then emit
 *    `host:create_room` once connected
 * 3. Server creates the room and sends back a `state:sync` (HostSnapshot)
 *    containing the room code
 * 4. Client navigates to /host/:roomCode
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { motion } from 'framer-motion';
import { socket } from '../lib/socket-client';
import { useSocketStore } from '../store/socket-store';
import { useHostControls } from '../hooks/useHostControls';
import { fadeIn, scaleIn } from '../animations/variants';
import {
  DEFAULT_TARGET_PLAYERS,
  MIN_PLAYERS,
  MAX_PLAYERS,
  TOTAL_ROUNDS,
  type StateSnapshot,
} from '@treasure-contest/shared';

/** Pending room creation request stored while waiting for socket connection. */
interface PendingCreate {
  hostName: string;
  targetPlayers: number;
  hostPassword: string;
}

/** Brief game instructions shown on the create page. */
const GAME_INSTRUCTIONS: { icon: string; title: string; desc: string }[] = [
  {
    icon: '1',
    title: '创建房间',
    desc: '主持人创建房间后，玩家通过扫描二维码或输入房间号加入',
  },
  {
    icon: '2',
    title: '数字选择',
    desc: `共 ${TOTAL_ROUNDS} 回合，每回合玩家从 1-7 中选一个数字提交`,
  },
  {
    icon: '3',
    title: '宝石争夺',
    desc: '按数字大小排序依次选择宝石，相同数字碰撞时按座位顺序解决',
  },
  {
    icon: '4',
    title: '最终结算',
    desc: '基础分 + 颜色奖励 + 秘密任务奖励 = 最终得分，最高者获胜',
  },
];

export default function HostCreatePage() {
  const navigate = useNavigate();

  const isConnected = useSocketStore((s) => s.isConnected);
  const isConnecting = useSocketStore((s) => s.isConnecting);
  const error = useSocketStore((s) => s.error);
  const connect = useSocketStore((s) => s.connect);
  const clearError = useSocketStore((s) => s.clearError);
  const { createRoom } = useHostControls();

  const [hostName, setHostName] = useState('');
  const [targetPlayers, setTargetPlayers] = useState(DEFAULT_TARGET_PLAYERS);
  const [hostPassword, setHostPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const pendingCreateRef = useRef<PendingCreate | null>(null);

  // ── Emit createRoom once socket is connected ──────────────────────────
  useEffect(() => {
    if (isConnected && pendingCreateRef.current && submitting) {
      const { hostName: name, targetPlayers: players, hostPassword: pwd } =
        pendingCreateRef.current;
      pendingCreateRef.current = null;
      createRoom(name, players, pwd);
    }
  }, [isConnected, submitting, createRoom]);

  // ── Listen for state:sync to get the room code and navigate ───────────
  useEffect(() => {
    if (!submitting) return;

    const handler = (snapshot: StateSnapshot) => {
      if (snapshot.role === 'host' && snapshot.roomCode) {
        navigate(`/host/${snapshot.roomCode}`);
      }
    };

    socket.on('state:sync', handler);
    return () => {
      socket.off('state:sync', handler);
    };
  }, [submitting, navigate]);

  // ── Handle errors ──────────────────────────────────────────────────────
  useEffect(() => {
    if (error && submitting) {
      setSubmitting(false);
    }
  }, [error, submitting]);

  // ── Form submit handler ─────────────────────────────────────────────────
  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const name = hostName.trim();
      const pwd = hostPassword.trim();
      if (!name || !pwd || submitting) return;

      clearError();
      setSubmitting(true);

      if (isConnected) {
        createRoom(name, targetPlayers, pwd);
      } else {
        // Store pending request and connect the socket
        pendingCreateRef.current = {
          hostName: name,
          targetPlayers,
          hostPassword: pwd,
        };
        connect('__pending__', 'host');
      }
    },
    [hostName, hostPassword, targetPlayers, submitting, isConnected, createRoom, connect, clearError],
  );

  const isLoading = submitting || isConnecting;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-4 py-8">
        {/* Header */}
        <motion.div
          variants={fadeIn}
          initial="hidden"
          animate="visible"
          className="mb-6 text-center"
        >
          <h1 className="mb-1 text-3xl font-bold text-violet-400">
            秘宝争夺战
          </h1>
          <p className="text-sm text-slate-500">主持人控制台</p>
        </motion.div>

        <div className="grid flex-1 gap-6 md:grid-cols-2">
          {/* Left: Create form */}
          <motion.div
            variants={scaleIn}
            initial="hidden"
            animate="visible"
            className="flex items-center"
          >
            <form
              onSubmit={handleSubmit}
              className="w-full rounded-2xl border border-slate-800 bg-slate-900/60 p-6"
            >
              <h2 className="mb-4 text-lg font-semibold text-slate-200">
                创建房间
              </h2>

              {/* Host name */}
              <div className="mb-4">
                <label
                  htmlFor="hostName"
                  className="mb-1.5 block text-xs font-medium text-slate-400"
                >
                  主持人名称
                </label>
                <input
                  id="hostName"
                  type="text"
                  value={hostName}
                  onChange={(e) => setHostName(e.target.value)}
                  placeholder="请输入您的名称"
                  maxLength={12}
                  disabled={isLoading}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 placeholder:text-slate-600 focus:border-violet-500 focus:outline-none disabled:opacity-50"
                />
              </div>

              {/* Target players */}
              <div className="mb-4">
                <label
                  htmlFor="targetPlayers"
                  className="mb-1.5 block text-xs font-medium text-slate-400"
                >
                  目标人数 ({MIN_PLAYERS}-{MAX_PLAYERS})
                </label>
                <div className="flex gap-1.5">
                  {Array.from(
                    { length: MAX_PLAYERS - MIN_PLAYERS + 1 },
                    (_, i) => MIN_PLAYERS + i,
                  ).map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setTargetPlayers(n)}
                      disabled={isLoading}
                      className={clsx(
                        'flex-1 rounded-lg py-2 text-sm font-bold transition-all',
                        targetPlayers === n
                          ? 'bg-violet-600 text-white'
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-700',
                        isLoading && 'opacity-50',
                      )}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-[10px] text-slate-600">
                  默认 {DEFAULT_TARGET_PLAYERS} 人，最少 {MIN_PLAYERS} 人，最多 {MAX_PLAYERS} 人
                </p>
              </div>

              {/* Host password */}
              <div className="mb-4">
                <label
                  htmlFor="hostPassword"
                  className="mb-1.5 block text-xs font-medium text-slate-400"
                >
                  主持人密码
                </label>
                <input
                  id="hostPassword"
                  type="password"
                  value={hostPassword}
                  onChange={(e) => setHostPassword(e.target.value)}
                  placeholder="请输入主持人密码"
                  autoComplete="current-password"
                  disabled={isLoading}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 placeholder:text-slate-600 focus:border-violet-500 focus:outline-none disabled:opacity-50"
                />
                <p className="mt-1 text-[10px] text-slate-600">
                  密码由服务器配置，防止他人随意创建房间
                </p>
              </div>

              {/* Error message */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mb-3 rounded-lg border border-rose-800/50 bg-rose-950/30 px-3 py-2 text-xs text-rose-400"
                >
                  {error}
                </motion.div>
              )}

              {/* Submit button */}
              <button
                type="submit"
                disabled={!hostName.trim() || !hostPassword.trim() || isLoading}
                className={clsx(
                  'flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold transition-all',
                  isLoading
                    ? 'cursor-wait bg-slate-700 text-slate-400'
                    : 'bg-violet-600 text-white hover:bg-violet-500',
                  (!hostName.trim() || !hostPassword.trim()) && !isLoading && 'opacity-50',
                )}
              >
                {isLoading ? (
                  <>
                    <svg
                      className="h-4 w-4 animate-spin"
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
                    正在创建房间...
                  </>
                ) : (
                  '创建房间并进入控制台'
                )}
              </button>
            </form>
          </motion.div>

          {/* Right: Game instructions */}
          <motion.div
            variants={fadeIn}
            initial="hidden"
            animate="visible"
            className="flex items-center"
          >
            <div className="w-full rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
              <h3 className="mb-3 text-sm font-semibold text-slate-300">
                游戏流程
              </h3>
              <div className="space-y-3">
                {GAME_INSTRUCTIONS.map((step, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 * (i + 1) }}
                    className="flex gap-3"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-600/30 text-xs font-bold text-violet-400">
                      {step.icon}
                    </span>
                    <div>
                      <p className="text-xs font-medium text-slate-300">
                        {step.title}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {step.desc}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>

        {/* Footer link */}
        <div className="mt-6 text-center">
          <button
            onClick={() => navigate('/')}
            className="text-xs text-slate-600 transition-colors hover:text-slate-400"
          >
            ← 返回首页
          </button>
        </div>
      </div>
    </div>
  );
}
