import { describe, expect, it } from 'vitest';
import { decideLobbyJoin, findPlayerByName, normalizePlayerName } from './lobby-join.js';

const p = (id: string, name: string, isConnected: boolean) => ({ id, name, isConnected });

describe('decideLobbyJoin', () => {
  it('reclaims a disconnected seat with the same name even when the room is at capacity', () => {
    const decision = decideLobbyJoin({
      players: [
        p('a', 'Alice', true),
        p('b', 'Bob', false),
        p('c', 'Cara', true),
        p('d', 'Dan', true),
      ],
      playerName: 'Bob',
      targetPlayers: 4,
      queueLength: 0,
    });

    expect(decision).toEqual({ action: 'reconnect', playerId: 'b' });
  });

  it('rejects a name that is already connected', () => {
    const decision = decideLobbyJoin({
      players: [p('a', 'Alice', true)],
      playerName: 'Alice',
      targetPlayers: 4,
      queueLength: 0,
    });

    expect(decision).toEqual({ action: 'name_taken' });
  });

  it('treats trimmed names as the same seat-holder', () => {
    const decision = decideLobbyJoin({
      players: [p('a', '  Alice  ', false)],
      playerName: 'Alice',
      targetPlayers: 4,
      queueLength: 0,
    });

    expect(decision).toEqual({ action: 'reconnect', playerId: 'a' });
  });

  it('adds a new player when there is an empty seat and the name is free', () => {
    const decision = decideLobbyJoin({
      players: [p('a', 'Alice', true)],
      playerName: 'Bob',
      targetPlayers: 4,
      queueLength: 0,
    });

    expect(decision).toEqual({ action: 'join_new' });
  });

  it('evicts a disconnected seat for a new name when connected count is below target', () => {
    const fullRoom = [
      p('a', 'Alice', true),
      p('b', 'Bob', false),
      p('c', 'Cara', true),
      p('d', 'Dan', true),
    ];

    expect(
      decideLobbyJoin({
        players: fullRoom,
        playerName: 'Eve',
        targetPlayers: 4,
        queueLength: 0,
      }),
    ).toEqual({ action: 'join_new', evictPlayerId: 'b' });

    expect(
      decideLobbyJoin({
        players: fullRoom,
        playerName: 'Bob',
        targetPlayers: 4,
        queueLength: 0,
      }),
    ).toEqual({ action: 'reconnect', playerId: 'b' });
  });

  it('lets a new name sit after a post-restart mass-disconnect (CNEZFP)', () => {
    const allOffline = [
      p('a', 'Alice', false),
      p('b', 'Bob', false),
      p('c', 'Cara', false),
      p('d', 'Dan', false),
    ];

    expect(
      decideLobbyJoin({
        players: allOffline,
        playerName: 'Eve',
        targetPlayers: 4,
        queueLength: 0,
      }),
    ).toEqual({ action: 'join_new', evictPlayerId: 'a' });

    expect(
      decideLobbyJoin({
        players: allOffline,
        playerName: 'Alice',
        targetPlayers: 4,
        queueLength: 0,
      }),
    ).toEqual({ action: 'reconnect', playerId: 'a' });
  });

  it('queues a new name only when enough players are already connected', () => {
    expect(
      decideLobbyJoin({
        players: [
          p('a', 'Alice', true),
          p('b', 'Bob', true),
          p('c', 'Cara', true),
          p('d', 'Dan', true),
        ],
        playerName: 'Eve',
        targetPlayers: 4,
        queueLength: 0,
      }),
    ).toEqual({ action: 'queue' });
  });

  it('does not treat a one-shot iterator as an empty room', () => {
    function* players() {
      yield p('a', 'Alice', true);
      yield p('b', 'Bob', true);
      yield p('c', 'Cara', true);
      yield p('d', 'Dan', true);
    }

    expect(
      decideLobbyJoin({
        players: players(),
        playerName: 'Eve',
        targetPlayers: 4,
        queueLength: 0,
      }),
    ).toEqual({ action: 'queue' });
  });

  it('returns queue_full when the waiting list is at capacity', () => {
    const decision = decideLobbyJoin({
      players: [p('a', 'Alice', true), p('b', 'Bob', true), p('c', 'Cara', true), p('d', 'Dan', true)],
      playerName: 'Eve',
      targetPlayers: 4,
      queueLength: 10,
      maxQueueSize: 10,
    });

    expect(decision).toEqual({ action: 'queue_full' });
  });
});

describe('name helpers', () => {
  it('normalizes and finds players by name', () => {
    expect(normalizePlayerName('  小明  ')).toBe('小明');
    expect(findPlayerByName([p('1', '小明', false)], ' 小明 ' )?.id).toBe('1');
  });
});
