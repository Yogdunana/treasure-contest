import fs from 'node:fs';
import http from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { io as ioc, type Socket as ClientSocket } from 'socket.io-client';
import type { CreateRoomAck, RoomJoinAck } from '@treasure-contest/shared';
import { closeDb, initDb } from '../db/connection.js';
import { initDatabase } from '../db/migrations.js';
import { createApp } from '../app.js';
import { RoomManager } from './room-manager.js';
import { QueueManager } from './queue-manager.js';
import { decideLobbyJoin } from './lobby-join.js';
import { config } from '../config.js';

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

describe('lobby disconnect then same-name rejoin', () => {
  beforeEach(() => {
    resetDb();
  });

  afterEach(() => {
    closeDb();
  });

  it('reconnects a disconnected seat instead of enqueueing when the room is full', () => {
    const rooms = new RoomManager();
    const queues = new QueueManager();
    const { roomCode } = rooms.createRoom('Host', 4);
    const room = rooms.getRoom(roomCode)!;

    const names = ['Alice', 'Bob', 'Cara', 'Dan'];
    for (const name of names) {
      const added = rooms.addPlayerToRoom(roomCode, name, `sock-${name}`);
      expect(added).not.toBeNull();
    }
    expect(room.players.size).toBe(4);

    const bob = [...room.players.values()].find((p) => p.name === 'Bob')!;
    rooms.disconnectPlayer(roomCode, bob.id);
    expect(room.players.get(bob.id)?.isConnected).toBe(false);

    const decision = decideLobbyJoin({
      players: room.players.values(),
      playerName: 'Bob',
      targetPlayers: room.targetPlayers,
      queueLength: room.queue.length,
    });
    expect(decision.action).toBe('reconnect');
    if (decision.action !== 'reconnect') return;

    const reconnected = rooms.reconnectPlayer(roomCode, decision.playerId, 'sock-bob-2');
    expect(reconnected?.id).toBe(bob.id);
    expect(reconnected?.isConnected).toBe(true);
    expect(reconnected?.seatNumber).toBe(bob.seatNumber);
    expect(room.queue).toHaveLength(0);

    const eve = decideLobbyJoin({
      players: room.players.values(),
      playerName: 'Eve',
      targetPlayers: room.targetPlayers,
      queueLength: room.queue.length,
    });
    expect(eve.action).toBe('queue');
    queues.addToQueue(room, 'Eve', 'sock-eve');
    expect(room.queue).toHaveLength(1);
    expect(room.players.size).toBe(4);
  });

  it('restores seated players from SQLite after a simulated restart', () => {
    const first = new RoomManager();
    const { roomCode } = first.createRoom('Host', 4);
    first.addPlayerToRoom(roomCode, 'Alice', 's1');
    first.addPlayerToRoom(roomCode, 'Bob', 's2');

    const restored = new RoomManager();
    restored.restoreFromDB();
    const room = restored.getRoom(roomCode);
    expect(room).toBeDefined();
    expect(room!.players.size).toBe(2);
    expect([...room!.players.values()].map((p) => p.name).sort()).toEqual(['Alice', 'Bob']);
    expect(room!.hostSocketId).toBeNull();
    expect(room!.gameSession).toBe(1);
    expect([...room!.players.values()].every((p) => p.isConnected === false)).toBe(true);
  });

  it('updates an existing queue row instead of throwing on the unique name constraint', () => {
    const rooms = new RoomManager();
    const queues = new QueueManager();
    const { roomCode } = rooms.createRoom('Host', 4);
    const room = rooms.getRoom(roomCode)!;
    for (const name of ['A', 'B', 'C', 'D']) {
      rooms.addPlayerToRoom(roomCode, name, `s-${name}`);
    }

    const first = queues.addToQueue(room, 'Eve', 'sock-1');
    const second = queues.addToQueue(room, 'Eve', 'sock-2');
    expect(second?.id).toBe(first?.id);
    expect(second?.socketId).toBe('sock-2');
    expect(room.queue).toHaveLength(1);
  });
});

describe('host token join over socket', () => {
  let server: http.Server;
  let port: number;

  beforeEach(async () => {
    resetDb();
    server = http.createServer();
    const { app } = createApp(server, false);
    server.on('request', app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    port = (server.address() as { port: number }).port;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    closeDb();
  });

  function connectClient(auth?: Record<string, string>): Promise<ClientSocket> {
    const socket = ioc(`http://127.0.0.1:${port}`, {
      transports: ['websocket'],
      forceNew: true,
      auth,
    });
    return new Promise((resolve, reject) => {
      socket.on('connect', () => resolve(socket));
      socket.on('connect_error', reject);
    });
  }

  it('stores a hostToken on create and accepts it on a later room:join', async () => {
    const creator = await connectClient();
    const created = await new Promise<CreateRoomAck>((resolve) => {
      creator.emit(
        'host:create_room',
        { hostName: '主持人', targetPlayers: 4, hostPassword: 'host123' },
        resolve,
      );
    });
    expect(created.success).toBe(true);
    expect(created.roomCode).toBeTruthy();
    expect(created.hostToken).toMatch(/^host:/);
    const roomCode = created.roomCode!;
    const hostToken = created.hostToken!;
    creator.disconnect();

    const host = await connectClient({ hostToken });
    const joined = await new Promise<RoomJoinAck>((resolve) => {
      host.emit(
        'room:join',
        { roomCode, playerName: '主持人', role: 'host', hostToken },
        resolve,
      );
    });
    expect(joined.success).toBe(true);
    expect(joined.roomCode).toBe(roomCode);

    const player = await connectClient();
    const playerJoin = await new Promise<RoomJoinAck>((resolve) => {
      player.emit(
        'room:join',
        { roomCode, playerName: 'Alice', role: 'player' },
        resolve,
      );
    });
    expect(playerJoin.success).toBe(true);
    expect(playerJoin.playerId).toBeTruthy();
    expect(playerJoin.queued).not.toBe(true);

    const snapshot = await new Promise<{ role: string; hostState?: { allPlayers: { name: string }[] } }>(
      (resolve) => {
        host.on('state:sync', resolve);
        // Trigger a broadcast by joining is already done; wait briefly if already received
        setTimeout(() => {
          host.emit('room:join', { roomCode, playerName: '主持人', role: 'host', hostToken });
        }, 50);
      },
    );
    expect(snapshot.role).toBe('host');
    expect(snapshot.hostState?.allPlayers.some((p) => p.name === 'Alice')).toBe(true);

    host.disconnect();
    player.disconnect();
  });
});
