/**
 * useQueue — React hook for joining and leaving the waiting queue.
 *
 * When a room is full, players can join a waiting queue.  This hook wraps
 * the `queue:join` and `queue:leave` socket events and exposes the current
 * queue status (position, total count) from the game store.
 */

import { useCallback } from 'react';
import { socket } from '../lib/socket-client';
import { useSocketStore } from '../store/socket-store';
import { useGameStore } from '../store/game-store';
import { generateFingerprint } from '../lib/fingerprint';

export interface UseQueueReturn {
  /** The player's position in the queue (1-based), null if not queued. */
  queuePosition: number | null;
  /** The total number of players currently in the queue. */
  totalInQueue: number | null;
  /**
   * Join the waiting queue for the given room.
   * @param roomCode   The room to queue for.
   * @param playerName The display name to use.
   * @returns `true` if the event was emitted.
   */
  joinQueue: (roomCode: string, playerName: string) => boolean;
  /** Leave the waiting queue. Returns `true` if the event was emitted. */
  leaveQueue: () => boolean;
}

export function useQueue(): UseQueueReturn {
  const isConnected = useSocketStore((s) => s.isConnected);
  const queuePosition = useGameStore((s) => s.queuePosition);
  const totalInQueue = useGameStore((s) => s.totalInQueue);

  const joinQueue = useCallback(
    (roomCode: string, playerName: string): boolean => {
      if (!isConnected) return false;

      const fingerprint = generateFingerprint();
      socket.emit('queue:join', { roomCode, playerName, fingerprint });
      return true;
    },
    [isConnected],
  );

  const leaveQueue = useCallback((): boolean => {
    if (!isConnected) return false;
    socket.emit('queue:leave');
    // Clear local queue state optimistically
    useGameStore.setState({
      queuePosition: null,
      totalInQueue: null,
    });
    return true;
  }, [isConnected]);

  return {
    queuePosition,
    totalInQueue,
    joinQueue,
    leaveQueue,
  };
}

export default useQueue;
