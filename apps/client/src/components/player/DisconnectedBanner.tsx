/**
 * DisconnectedBanner - Banner shown when the socket connection is lost.
 *
 * Displays a "连接已断开" message with a manual reconnect button and an
 * auto-reconnect attempt indicator.  The banner is controlled by the UI
 * store's `showDisconnectedBanner` flag and the socket store's connection
 * state.
 */

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { useSocketStore } from '../../store/socket-store';
import { useUIStore } from '../../store/ui-store';
import { slideUp } from '../../animations/variants';

export function DisconnectedBanner() {
  const show = useUIStore((s) => s.showDisconnectedBanner);
  const isConnected = useSocketStore((s) => s.isConnected);
  const isConnecting = useSocketStore((s) => s.isConnecting);
  const roomCode = useSocketStore((s) => s.roomCode);
  const role = useSocketStore((s) => s.role);
  const connect = useSocketStore((s) => s.connect);
  const setShowBanner = useUIStore((s) => s.setShowDisconnectedBanner);

  const [autoRetrying, setAutoRetrying] = useState(false);

  // Attempt auto-reconnect periodically when disconnected
  useEffect(() => {
    if (isConnected || !show) {
      setAutoRetrying(false);
      return;
    }

    setAutoRetrying(true);
    const interval = setInterval(() => {
      if (!useSocketStore.getState().isConnected && roomCode && role) {
        connect(roomCode, role);
      }
    }, 3000);

    return () => {
      clearInterval(interval);
      setAutoRetrying(false);
    };
  }, [show, isConnected, roomCode, role, connect]);

  const handleManualReconnect = useCallback(() => {
    if (roomCode && role) {
      connect(roomCode, role);
    }
  }, [roomCode, role, connect]);

  return (
    <AnimatePresence>
      {show && !isConnected && (
        <motion.div
          variants={slideUp}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="fixed inset-x-0 top-0 z-50 flex items-center justify-between gap-3 bg-red-900/95 px-4 py-3 backdrop-blur-sm"
        >
          <div className="flex items-center gap-2">
            <span className="text-lg">⚠️</span>
            <div>
              <p className="text-sm font-semibold text-white">连接已断开</p>
              {autoRetrying && (
                <p className="text-xs text-red-200">
                  正在尝试重新连接...
                </p>
              )}
            </div>
          </div>

          <button
            onClick={handleManualReconnect}
            disabled={isConnecting}
            className={clsx(
              'rounded-lg bg-white px-4 py-1.5 text-sm font-semibold text-red-900 transition-colors',
              'hover:bg-red-50 active:scale-95',
              isConnecting && 'cursor-not-allowed opacity-60',
            )}
          >
            {isConnecting ? '连接中...' : '重新连接'}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default DisconnectedBanner;
