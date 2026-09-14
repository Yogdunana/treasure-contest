/**
 * useHostControls — React hook for host control panel actions.
 *
 * Wraps the typed socket client to emit all host-facing events:
 * - `host:create_room`       — create a new room with a target player count
 * - `host:start_game`        — start the game (LOBBY → GAME_INIT)
 * - `host:pause` / `host:resume` — pause / resume the game
 * - `host:advance_phase`     — manually advance to the next phase
 * - `host:skip_player`       — skip the current picker
 * - `host:promote_player`    — promote a queued player to a full seat
 * - `host:remove_from_queue` — remove a player from the waiting queue
 * - `host:end_game`          — end the game early
 * - `host:restart`           — restart the game (new session, same room)
 *
 * All functions are no-ops if the socket is not connected.
 */

import { useCallback } from 'react';
import { socket } from '../lib/socket-client';
import { useSocketStore } from '../store/socket-store';

export interface UseHostControlsReturn {
  /** Create a new room. Returns the emitted status. */
  createRoom: (hostName: string, targetPlayers: number) => boolean;
  /** Start the game in the current room. */
  startGame: () => boolean;
  /** Pause the game. */
  pause: () => boolean;
  /** Resume the game from a paused state. */
  resume: () => boolean;
  /** Manually advance to the next game phase. */
  advancePhase: () => boolean;
  /** Skip the current gem picker (host override). */
  skipPlayer: (playerId: string) => boolean;
  /** Promote a queued player to a full seat. */
  promotePlayer: (queueEntryId: string) => boolean;
  /** Remove a player from the waiting queue. */
  removeFromQueue: (queueEntryId: string) => boolean;
  /** End the game early (goes to GAME_OVER). */
  endGame: () => boolean;
  /** Restart the game (new gameSession, same room). */
  restart: () => boolean;
}

export function useHostControls(): UseHostControlsReturn {
  const isConnected = useSocketStore((s) => s.isConnected);

  const createRoom = useCallback(
    (hostName: string, targetPlayers: number): boolean => {
      if (!isConnected) return false;
      socket.emit('host:create_room', { hostName, targetPlayers });
      return true;
    },
    [isConnected],
  );

  const startGame = useCallback((): boolean => {
    if (!isConnected) return false;
    socket.emit('host:start_game');
    return true;
  }, [isConnected]);

  const pause = useCallback((): boolean => {
    if (!isConnected) return false;
    socket.emit('host:pause');
    return true;
  }, [isConnected]);

  const resume = useCallback((): boolean => {
    if (!isConnected) return false;
    socket.emit('host:resume');
    return true;
  }, [isConnected]);

  const advancePhase = useCallback((): boolean => {
    if (!isConnected) return false;
    socket.emit('host:advance_phase');
    return true;
  }, [isConnected]);

  const skipPlayer = useCallback(
    (playerId: string): boolean => {
      if (!isConnected) return false;
      socket.emit('host:skip_player', { playerId });
      return true;
    },
    [isConnected],
  );

  const promotePlayer = useCallback(
    (queueEntryId: string): boolean => {
      if (!isConnected) return false;
      socket.emit('host:promote_player', { queueEntryId });
      return true;
    },
    [isConnected],
  );

  const removeFromQueue = useCallback(
    (queueEntryId: string): boolean => {
      if (!isConnected) return false;
      socket.emit('host:remove_from_queue', { queueEntryId });
      return true;
    },
    [isConnected],
  );

  const endGame = useCallback((): boolean => {
    if (!isConnected) return false;
    socket.emit('host:end_game');
    return true;
  }, [isConnected]);

  const restart = useCallback((): boolean => {
    if (!isConnected) return false;
    socket.emit('host:restart');
    return true;
  }, [isConnected]);

  return {
    createRoom,
    startGame,
    pause,
    resume,
    advancePhase,
    skipPlayer,
    promotePlayer,
    removeFromQueue,
    endGame,
    restart,
  };
}

export default useHostControls;
