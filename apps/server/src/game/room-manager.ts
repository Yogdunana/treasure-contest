import type { Player, GamePhase } from '@treasure-contest/shared';
import {
  MIN_PLAYERS,
  MAX_PLAYERS,
  DEFAULT_TARGET_PLAYERS,
  INITIAL_NUMBERS,
} from '@treasure-contest/shared';
import { Room } from './room.js';
import { GameEngine } from './game-engine.js';
import { TimerManager } from './timer-manager.js';
import * as roomRepo from '../db/repositories/room-repo.js';
import * as playerRepo from '../db/repositories/player-repo.js';
import * as gemRepo from '../db/repositories/gem-repo.js';
import * as queueRepo from '../db/repositories/queue-repo.js';
import { generateHostToken } from '../identity/auth-token.js';
import {
  generateRoomCode,
  generatePlayerId,
} from '../utils/id-generator.js';
import { generateAuthToken } from '../identity/auth-token.js';
import { logger } from '../utils/logger.js';
import { normalizePlayerName, normalizeRoomCode } from './lobby-join.js';

// ============================================================================
// BroadcastFn type
// ============================================================================

/**
 * Callback type for broadcasting room state to connected clients.
 * The socket.io layer provides this implementation.
 */
export type BroadcastFn = (room: Room) => void;

// ============================================================================
// RoomManager
// ============================================================================

/**
 * Manages all active game rooms in memory.
 *
 * Each room has:
 * - A Room object (in-memory authoritative state)
 * - A TimerManager instance
 * - A GameEngine instance (created lazily when a broadcastFn is provided)
 *
 * On server startup, `restoreFromDB()` loads active rooms from SQLite
 * and reconstructs the in-memory state.
 */
export class RoomManager {
  private rooms: Map<string, Room> = new Map();
  private engines: Map<string, GameEngine> = new Map();
  private timerManagers: Map<string, TimerManager> = new Map();

  // Cache of the broadcast function; used when creating engines lazily
  private broadcastFn: BroadcastFn | null = null;

  /**
   * Create a new room.
   *
   * @param hostName       The host's display name.
   * @param targetPlayers  The target number of players (default 6).
   * @returns The room code and host token.
   */
  createRoom(
    hostName: string,
    targetPlayers: number = DEFAULT_TARGET_PLAYERS,
  ): { roomCode: string; hostToken: string } {
    // Generate a unique room code
    let code: string;
    do {
      code = generateRoomCode();
    } while (this.rooms.has(code));

    const hostToken = generateHostToken();

    // Create the in-memory Room
    const room = new Room(code, hostName, hostToken, targetPlayers);

    // Create the TimerManager
    const timerManager = new TimerManager();

    // Persist to DB
    try {
      roomRepo.createRoom(code, hostName, hostToken, targetPlayers);
    } catch (err) {
      logger.error('Failed to persist room to DB', { error: err, code });
    }

    // Store in memory
    this.rooms.set(code, room);
    this.timerManagers.set(code, timerManager);

    // Create engine if broadcastFn is set
    if (this.broadcastFn) {
      const engine = new GameEngine(room, timerManager, this.broadcastFn);
      this.engines.set(code, engine);
    }

    logger.info('Room created', { code, hostName, targetPlayers });

    return { roomCode: code, hostToken };
  }

  /**
   * Get a room by code.
   */
  getRoom(code: string): Room | undefined {
    return this.rooms.get(normalizeRoomCode(code));
  }

  /**
   * Get the game engine for a room.
   */
  getEngine(code: string): GameEngine | undefined {
    const roomCode = normalizeRoomCode(code);
    // Lazily create engine if broadcastFn is set but engine doesn't exist
    if (!this.engines.has(roomCode) && this.broadcastFn) {
      const room = this.rooms.get(roomCode);
      const timerManager = this.timerManagers.get(roomCode);
      if (room && timerManager) {
        const engine = new GameEngine(room, timerManager, this.broadcastFn);
        this.engines.set(roomCode, engine);
        return engine;
      }
    }
    return this.engines.get(roomCode);
  }

  /**
   * Get the timer manager for a room.
   */
  getTimerManager(code: string): TimerManager | undefined {
    return this.timerManagers.get(normalizeRoomCode(code));
  }

  /**
   * Remove a room from memory and clean up timers.
   */
  removeRoom(code: string): void {
    const timerManager = this.timerManagers.get(code);
    if (timerManager) {
      timerManager.clearAll();
    }
    this.rooms.delete(code);
    this.engines.delete(code);
    this.timerManagers.delete(code);

    logger.info('Room removed', { code });
  }

  /**
   * Get all active rooms.
   */
  getAllRooms(): Room[] {
    return Array.from(this.rooms.values());
  }

  /**
   * Set the broadcast function (called once during server startup).
   */
  setBroadcastFn(fn: BroadcastFn): void {
    this.broadcastFn = fn;

    // Create engines for existing rooms that don't have one yet
    for (const [code, room] of this.rooms) {
      if (!this.engines.has(code)) {
        const timerManager = this.timerManagers.get(code);
        if (timerManager) {
          const engine = new GameEngine(room, timerManager, fn);
          this.engines.set(code, engine);
        }
      }
    }
  }

  /**
   * Restore active rooms from SQLite on server startup.
   *
   * Loads all rooms whose phase is not GAME_OVER, reconstructs player
   * state, and reloads gems from the DB. Rooms in active game phases
   * are set to PAUSED so the host can manually resume.
   */
  restoreFromDB(): void {
    let activeRooms: roomRepo.RoomRecord[] = [];
    try {
      activeRooms = roomRepo.getActiveRooms();
    } catch (err) {
      logger.error('Failed to load active rooms from DB', { error: err });
      return;
    }

    logger.info('Restoring rooms from DB', { count: activeRooms.length });

    for (const record of activeRooms) {
      // Create the in-memory Room
      const room = new Room(
        record.code,
        record.hostName,
        record.hostToken,
        record.targetPlayers,
      );

      room.phase = record.phase;
      room.currentRound = record.currentRound;
      // Historical rows were inserted with game_session=0 while in-memory
      // rooms start at 1. Tokens issued before restart used 1 — keep that.
      room.gameSession = record.gameSession || 1;
      if (record.gameSession === 0) {
        try {
          roomRepo.updateRoom(record.code, { gameSession: room.gameSession });
        } catch (err) {
          logger.error('Failed to normalize game_session on restore', {
            error: err instanceof Error ? err.message : err,
            room: record.code,
          });
        }
      }
      room.isPaused = record.isPaused;
      room.pausedPhase = record.pausedPhase;
      room.timerRemaining = record.timerRemaining ?? 0;
      room.timerDeadline = record.timerDeadline;
      // Old socket IDs are invalid after a process restart.
      room.hostSocketId = null;
      room.screenSocketId = null;

      // Restore players
      let players: playerRepo.PlayerRecord[] = [];
      try {
        players = playerRepo.getPlayersByRoom(record.code);
      } catch (err) {
        logger.error('Failed to load players for room', {
          error: err instanceof Error ? err.message : err,
          room: record.code,
        });
      }

      for (const pr of players) {
        try {
          const player: Player = {
            id: pr.id,
            name: pr.name,
            seatNumber: pr.seatNumber,
            isConnected: false, // Will be set to true on reconnect
            isReady: pr.isReady,
            availableNumbers: pr.availableNumbers,
            usedNumbers: pr.usedNumbers,
            roundSubmission: pr.roundSubmission,
            gems: pr.gems,
            missions: pr.missions,
            finalScore: pr.finalScore,
            finalRank: pr.finalRank,
          };
          room.players.set(player.id, player);
        } catch (err) {
          logger.error('Failed to restore player into memory', {
            error: err instanceof Error ? err.message : err,
            room: record.code,
            playerId: pr.id,
          });
        }
      }

      if (players.length > 0 && room.players.size === 0) {
        logger.warn('Room restore loaded DB players but none entered memory', {
          room: record.code,
          dbPlayers: players.length,
        });
      } else if (players.length === 0) {
        logger.warn('Room restored with no persisted players — seats will be empty until rejoin', {
          room: record.code,
          phase: room.phase,
        });
      }

      // Restore current round gems if in an active game
      if (room.currentRound > 0 && room.phase !== 'LOBBY') {
        try {
          room.currentGems = gemRepo.getGemsByRoomAndRound(
            record.code,
            room.currentRound,
          );
        } catch (err) {
          logger.error('Failed to load gems for room', {
            error: err,
            room: record.code,
          });
        }
      }

      // Restore queue
      try {
        const queueEntries = queueRepo.getQueueByRoom(record.code);
        room.queue = queueEntries;
      } catch (err) {
        logger.error('Failed to load queue for room', {
          error: err,
          room: record.code,
        });
      }

      // Create TimerManager
      const timerManager = new TimerManager();
      this.timerManagers.set(record.code, timerManager);

      // If the room was in an active game phase, set it to PAUSED
      // so the host can resume manually after reconnection
      const activeGamePhases: GamePhase[] = [
        'ROUND_START',
        'GEM_REVEAL',
        'NUMBER_SELECTION',
        'NUMBER_REVEAL',
        'ORDER_CALCULATION',
        'GEM_SELECTION',
        'ROUND_END',
        'FINAL_CALCULATION',
        'RESULTS_REVEAL',
      ];

      if (activeGamePhases.includes(room.phase) && !room.isPaused) {
        room.pausedPhase = room.phase;
        room.isPaused = true;
        room.phase = 'PAUSED';

        // Update DB to reflect the paused state
        try {
          roomRepo.updateRoom(record.code, {
            phase: 'PAUSED',
            isPaused: true,
            pausedPhase: room.pausedPhase,
          });
        } catch (err) {
          logger.error('Failed to update paused state in DB', {
            error: err,
            room: record.code,
          });
        }
      }

      this.rooms.set(record.code, room);

      logger.info('Room restored', {
        code: record.code,
        phase: room.phase,
        players: room.players.size,
      });
    }
  }

  /**
   * Add a player to a room (used when a player joins via socket).
   * Creates the player record in DB and adds to the in-memory room.
   *
   * @returns The created player and auth token, or null if room is full.
   */
  addPlayerToRoom(
    code: string,
    playerName: string,
    socketId: string,
    fingerprint?: string,
  ): { player: Player; authToken: string } | null {
    const room = this.rooms.get(normalizeRoomCode(code));
    if (!room) return null;

    if (room.players.size >= room.maxPlayers) return null;
    if (room.phase !== 'LOBBY') return null;

    const trimmedName = normalizePlayerName(playerName);
    if (!trimmedName) return null;

    // Check for duplicate name
    for (const p of room.players.values()) {
      if (normalizePlayerName(p.name) === trimmedName) return null;
    }

    const playerId = generatePlayerId();
    const seatNumber = room.getNextSeatNumber();
    const authToken = generateAuthToken(playerId, code, room.gameSession);

    const player: Player = {
      id: playerId,
      name: trimmedName,
      seatNumber,
      isConnected: true,
      isReady: false,
      availableNumbers: [...INITIAL_NUMBERS],
      usedNumbers: [],
      roundSubmission: null,
      gems: [],
      missions: [],
      finalScore: 0,
      finalRank: null,
    };

    room.players.set(playerId, player);
    room.playerAuthTokens.set(playerId, authToken);

    // Persist to DB
    try {
      playerRepo.createPlayer(
        playerId,
        room.code,
        trimmedName,
        seatNumber,
        authToken,
        fingerprint ?? null,
      );
      playerRepo.updatePlayerSocket(playerId, socketId);
    } catch (err) {
      logger.error('Failed to persist player to DB', {
        error: err instanceof Error ? err.message : err,
        room: room.code,
        playerId,
        name: trimmedName,
      });
    }

    return { player, authToken };
  }

  /**
   * Permanently remove a player from the room and SQLite (lobby leave).
   */
  removePlayer(code: string, playerId: string): boolean {
    const room = this.rooms.get(normalizeRoomCode(code));
    if (!room) return false;

    const existed = room.players.delete(playerId);
    room.playerAuthTokens.delete(playerId);
    if (!existed) return false;

    try {
      playerRepo.deletePlayer(playerId);
    } catch (err) {
      logger.error('Failed to delete player from DB', {
        error: err instanceof Error ? err.message : err,
        room: room.code,
        playerId,
      });
    }

    return true;
  }

  /**
   * Reconnect a player to a room (set socket and connected status).
   */
  reconnectPlayer(
    code: string,
    playerId: string,
    socketId: string,
  ): Player | null {
    const room = this.rooms.get(normalizeRoomCode(code));
    if (!room) return null;

    const player = room.players.get(playerId);
    if (!player) return null;

    player.isConnected = true;

    try {
      playerRepo.updatePlayerSocket(playerId, socketId);
      playerRepo.updatePlayerConnection(playerId, true);
    } catch (err) {
      logger.error('Failed to update player connection in DB', { error: err });
    }

    return player;
  }

  /**
   * Remove disconnected players from a room (and from SQLite).
   * Used after a game restart: old auth tokens are already invalid, and
   * leftover offline seats would block new joiners into the waiting queue.
   */
  dropDisconnectedPlayers(code: string): number {
    const room = this.rooms.get(normalizeRoomCode(code));
    if (!room) return 0;

    let removed = 0;
    for (const player of [...room.players.values()]) {
      if (player.isConnected) continue;
      room.players.delete(player.id);
      room.playerAuthTokens.delete(player.id);
      removed += 1;
      try {
        playerRepo.deletePlayer(player.id);
      } catch (err) {
        logger.error('Failed to delete disconnected player on restart', {
          error: err instanceof Error ? err.message : err,
          room: room.code,
          playerId: player.id,
        });
      }
    }

    if (removed > 0) {
      logger.info('Dropped disconnected players after restart', {
        room: room.code,
        removed,
        remaining: room.players.size,
      });
    }

    return removed;
  }

  /**
   * Mark a player as disconnected.
   */
  disconnectPlayer(code: string, playerId: string): void {
    const room = this.rooms.get(normalizeRoomCode(code));
    if (!room) return;

    const player = room.players.get(playerId);
    if (!player) return;

    player.isConnected = false;
    player.isReady = false;

    try {
      playerRepo.updatePlayerConnection(playerId, false);
      playerRepo.updatePlayerSocket(playerId, null);
    } catch (err) {
      logger.error('Failed to update player disconnection in DB', { error: err });
    }
  }

  /**
   * Get the minimum number of players required to start.
   */
  getMinPlayers(): number {
    return MIN_PLAYERS;
  }

  /**
   * Get the maximum number of players allowed.
   */
  getMaxPlayers(): number {
    return MAX_PLAYERS;
  }
}
