import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Gem, Player } from '@treasure-contest/shared';
import { INITIAL_NUMBERS } from '@treasure-contest/shared';
import { Room } from './room.js';
import { GameEngine } from './game-engine.js';
import { TimerManager } from './timer-manager.js';
import { RoomManager } from './room-manager.js';
import * as playerRepo from '../db/repositories/player-repo.js';
import { closeDb, initDb } from '../db/connection.js';
import { initDatabase } from '../db/migrations.js';
import { config } from '../config.js';
import fs from 'node:fs';

function makePlayer(id: string, name: string, seat: number): Player {
  return {
    id,
    name,
    seatNumber: seat,
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
}

function makeGem(id: string): Gem {
  return { id, color: 'red', value: 5 };
}

describe('GameEngine pause/resume and skip', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resumes the number-selection timer after pause', () => {
    const room = new Room('PAUS', 'Host', 'token', 4);
    room.phase = 'NUMBER_SELECTION';
    const timers = new TimerManager();
    const engine = new GameEngine(room, timers, () => {});

    timers.startNumberSelection(room, () => {}, () => {});

    engine.pause();
    expect(room.phase).toBe('PAUSED');
    expect(room.pausedPhase).toBe('NUMBER_SELECTION');

    vi.advanceTimersByTime(20_000);
    expect(room.phase).toBe('PAUSED');

    engine.resume();
    expect(room.phase).toBe('NUMBER_SELECTION');

    vi.advanceTimersByTime(16_000);
    expect(room.phase).toBe('NUMBER_REVEAL');
  });

  it('resumes a gem-reveal delay and continues into number selection', () => {
    const room = new Room('DLY', 'Host', 'token', 4);
    room.phase = 'GEM_REVEAL';
    const timers = new TimerManager();
    const engine = new GameEngine(room, timers, () => {});

    timers.startPausableDelay(room, 'gem_reveal', 3000, () => {});

    engine.pause();
    vi.advanceTimersByTime(3000);
    expect(room.phase).toBe('PAUSED');

    engine.resume();
    vi.advanceTimersByTime(3000);
    expect(room.phase).toBe('NUMBER_SELECTION');
  });

  it('does not advance the picker when skipPlayer is not the current picker', () => {
    const room = new Room('SKIP', 'Host', 'token', 4);
    room.phase = 'GEM_SELECTION';
    room.selectionOrder = ['p1', 'p2', 'p3'];
    room.currentPickerIndex = 0;
    room.currentGems = [makeGem('g1'), makeGem('g2'), makeGem('g3'), makeGem('g4')];
    room.players.set('p1', makePlayer('p1', 'A', 1));
    room.players.set('p2', makePlayer('p2', 'B', 2));
    room.players.set('p3', makePlayer('p3', 'C', 3));

    const engine = new GameEngine(room, new TimerManager(), () => {});
    engine.skipPlayer('p2');
    expect(room.currentPickerIndex).toBe(0);

    engine.skipPlayer('p1');
    expect(room.currentPickerIndex).toBe(1);
  });
});

function resetDb(): void {
  closeDb();
  if (fs.existsSync(config.dbPath)) {
    fs.rmSync(config.dbPath, { force: true });
  }
  for (const suffix of ['-wal', '-shm']) {
    const extra = `${config.dbPath}${suffix}`;
    if (fs.existsSync(extra)) fs.rmSync(extra, { force: true });
  }
  initDb();
  initDatabase();
}

describe('restart persists reset player state', () => {
  beforeEach(() => {
    resetDb();
  });

  afterEach(() => {
    closeDb();
  });

  it('clears gems/missions in SQLite and rotates auth tokens', () => {
    const rooms = new RoomManager();
    rooms.setBroadcastFn(() => {});
    const { roomCode } = rooms.createRoom('Host', 4);
    const added = rooms.addPlayerToRoom(roomCode, 'Alice', 'sock-a');
    expect(added).not.toBeNull();

    const room = rooms.getRoom(roomCode)!;
    const player = [...room.players.values()][0];
    player.gems = [makeGem('old-gem')];
    player.missions = [
      { missionId: 'H09', difficulty: 'hard', reward: 35, completed: false },
    ];
    player.finalScore = 99;
    playerRepo.updatePlayerState(player.id, {
      gems: player.gems,
      missions: player.missions,
      finalScore: 99,
    });

    const oldToken = playerRepo.getPlayer(player.id)!.authToken;
    const engine = rooms.getEngine(roomCode)!;
    engine.restartGame();

    expect(room.phase).toBe('LOBBY');
    expect(player.gems).toHaveLength(0);
    expect(player.missions).toHaveLength(0);
    expect(player.finalScore).toBe(0);

    const persisted = playerRepo.getPlayer(player.id)!;
    expect(persisted.gems).toHaveLength(0);
    expect(persisted.missions).toHaveLength(0);
    expect(persisted.finalScore).toBe(0);
    expect(persisted.authToken).not.toBe(oldToken);
    expect(room.playerAuthTokens.get(player.id)).toBe(persisted.authToken);
  });
});
