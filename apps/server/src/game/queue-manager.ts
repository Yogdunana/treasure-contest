import type { QueueEntry } from '@treasure-contest/shared';
import { QUEUE_CONFIG } from '@treasure-contest/shared';
import type { Room } from './room.js';
import * as queueRepo from '../db/repositories/queue-repo.js';
import { generateQueueEntryId } from '../utils/id-generator.js';
import { logger } from '../utils/logger.js';

// ============================================================================
// QueueManager
// ============================================================================

/**
 * Manages the waiting queue for a room.
 *
 * When a room is full (all seats taken), additional players are placed
 * in a waiting queue. When a player disconnects during LOBBY phase,
 * the first queued player is promoted to take their seat.
 *
 * The queue is maintained both in-memory (on the Room object) and in
 * the SQLite `waiting_queue` table for persistence.
 */
export class QueueManager {
  /**
   * Add a player to the waiting queue.
   *
   * @param room          The room to add the player to.
   * @param playerName    The player's display name.
   * @param socketId      The player's socket connection ID.
   * @param fingerprint   Optional browser fingerprint for reconnect.
   * @param cookieToken   Optional cookie token for reconnect.
   * @returns The created QueueEntry, or null if the queue is full.
   */
  addToQueue(
    room: Room,
    playerName: string,
    socketId: string,
    fingerprint?: string,
    cookieToken?: string,
  ): QueueEntry | null {
    const existing = room.queue.find((e) => e.playerName === playerName);
    if (existing) {
      existing.socketId = socketId;
      if (fingerprint) existing.browserFingerprint = fingerprint;
      if (cookieToken) existing.cookieToken = cookieToken;

      try {
        queueRepo.addToQueue(
          existing.id,
          room.code,
          playerName,
          fingerprint ?? null,
          cookieToken ?? null,
          socketId,
        );
      } catch (err) {
        logger.error('Failed to update existing queue entry in DB', {
          error: err instanceof Error ? err.message : err,
        });
      }

      logger.info('Player queue entry updated (same name)', {
        room: room.code,
        playerName,
        position: existing.position,
      });

      return existing;
    }

    if (room.queue.length >= QUEUE_CONFIG.MAX_QUEUE_SIZE) {
      logger.warn('Queue is full', {
        room: room.code,
        maxSize: QUEUE_CONFIG.MAX_QUEUE_SIZE,
      });
      return null;
    }

    const id = generateQueueEntryId();
    const position = room.queue.length + 1;
    const joinedAt = new Date().toISOString();

    const entry: QueueEntry = {
      id,
      roomCode: room.code,
      playerName,
      position,
      socketId,
      ...(fingerprint ? { browserFingerprint: fingerprint } : {}),
      ...(cookieToken ? { cookieToken } : {}),
      joinedAt,
    };

    // Persist first so a UNIQUE conflict can recover the existing row
    // instead of crashing the join path.
    try {
      const persisted = queueRepo.addToQueue(
        id,
        room.code,
        playerName,
        fingerprint ?? null,
        cookieToken ?? null,
        socketId,
      );
      if (persisted.id !== id) {
        const recovered: QueueEntry = {
          ...persisted,
          socketId,
          ...(fingerprint ? { browserFingerprint: fingerprint } : {}),
          ...(cookieToken ? { cookieToken } : {}),
        };
        room.queue.push(recovered);
        this.reindexQueue(room);
        logger.info('Player queue entry recovered from DB (same name)', {
          room: room.code,
          playerName,
          position: recovered.position,
        });
        return recovered;
      }
    } catch (err) {
      logger.error('Failed to persist queue entry to DB', {
        error: err instanceof Error ? err.message : err,
      });
    }

    // Add to in-memory queue
    room.queue.push(entry);

    logger.info('Player added to queue', {
      room: room.code,
      playerName,
      position,
    });

    return entry;
  }

  /**
   * Remove a player from the queue by entry ID.
   */
  removeFromQueue(room: Room, queueEntryId: string): void {
    const index = room.queue.findIndex((e) => e.id === queueEntryId);
    if (index === -1) return;

    room.queue.splice(index, 1);
    this.reindexQueue(room);

    try {
      queueRepo.removeFromQueue(queueEntryId);
    } catch (err) {
      logger.error('Failed to remove queue entry from DB', { error: err });
    }
  }

  /**
   * Promote the first player in the queue to a full player.
   *
   * @returns The promoted QueueEntry, or null if the queue is empty.
   */
  promoteNext(room: Room): QueueEntry | null {
    if (room.queue.length === 0) return null;

    const entry = room.queue[0];
    room.queue.shift();
    this.reindexQueue(room);

    try {
      queueRepo.removeFromQueue(entry.id);
    } catch (err) {
      logger.error('Failed to remove promoted entry from DB', { error: err });
    }

    logger.info('Player promoted from queue', {
      room: room.code,
      playerName: entry.playerName,
    });

    return entry;
  }

  /**
   * Promote a specific player from the queue (host override).
   *
   * @returns The promoted QueueEntry, or null if not found.
   */
  promotePlayer(room: Room, queueEntryId: string): QueueEntry | null {
    const index = room.queue.findIndex((e) => e.id === queueEntryId);
    if (index === -1) return null;

    const entry = room.queue[index];
    room.queue.splice(index, 1);
    this.reindexQueue(room);

    try {
      queueRepo.removeFromQueue(entry.id);
    } catch (err) {
      logger.error('Failed to remove promoted entry from DB', { error: err });
    }

    logger.info('Player promoted from queue (manual)', {
      room: room.code,
      playerName: entry.playerName,
    });

    return entry;
  }

  /**
   * Get the queue status (count and entries).
   */
  getQueueStatus(room: Room): { count: number; entries: QueueEntry[] } {
    return {
      count: room.queue.length,
      entries: [...room.queue],
    };
  }

  /**
   * Find a queue entry by socket ID.
   */
  findBySocketId(room: Room, socketId: string): QueueEntry | undefined {
    return room.queue.find((e) => e.socketId === socketId);
  }

  /**
   * Find a queue entry by browser fingerprint.
   */
  findByFingerprint(room: Room, fingerprint: string): QueueEntry | undefined {
    return room.queue.find((e) => e.browserFingerprint === fingerprint);
  }

  /**
   * Re-index the queue positions after a removal so they stay
   * contiguous (1, 2, 3, ...).
   */
  private reindexQueue(room: Room): void {
    for (let i = 0; i < room.queue.length; i++) {
      room.queue[i].position = i + 1;
    }
  }
}
