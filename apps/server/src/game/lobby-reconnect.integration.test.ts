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

    // After Bob reclaims, four players are connected — a new name waits.
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

    // While Bob is still disconnected, a new name takes that seat instead.
    rooms.disconnectPlayer(roomCode, bob.id);
    const frank = decideLobbyJoin({
      players: room.players.values(),
      playerName: 'Frank',
      targetPlayers: room.targetPlayers,
      queueLength: room.queue.length,
    });
    expect(frank).toEqual({ action: 'join_new', evictPlayerId: bob.id });
    rooms.removePlayerFromRoom(roomCode, bob.id);
    const seatedFrank = rooms.addPlayerToRoom(roomCode, 'Frank', 'sock-frank');
    expect(seatedFrank).not.toBeNull();
    expect(room.players.has(bob.id)).toBe(false);
    expect([...room.players.values()].some((p) => p.name === 'Frank')).toBe(true);
  });

  it('dropDisconnectedPlayers frees offline seats for the next lobby', () => {
    const rooms = new RoomManager();
    const { roomCode } = rooms.createRoom('Host', 4);
    rooms.addPlayerToRoom(roomCode, 'Alice', 's-a');
    rooms.addPlayerToRoom(roomCode, 'Bob', 's-b');
    const bob = [...rooms.getRoom(roomCode)!.players.values()].find((p) => p.name === 'Bob')!;
    rooms.disconnectPlayer(roomCode, bob.id);

    expect(rooms.dropDisconnectedPlayers(roomCode)).toBe(1);
    const room = rooms.getRoom(roomCode)!;
    expect(room.players.size).toBe(1);
    expect([...room.players.values()][0].name).toBe('Alice');
  });

  it('removePlayerFromRoom frees a specific seat for addPlayerToRoom', () => {
    const rooms = new RoomManager();
    const { roomCode } = rooms.createRoom('Host', 4);
    rooms.addPlayerToRoom(roomCode, 'Alice', 's-a');
    rooms.addPlayerToRoom(roomCode, 'Bob', 's-b');
    const bob = [...rooms.getRoom(roomCode)!.players.values()].find((p) => p.name === 'Bob')!;

    expect(rooms.removePlayerFromRoom(roomCode, bob.id)).toBe(true);
    expect(rooms.getRoom(roomCode)!.players.has(bob.id)).toBe(false);

    const eve = rooms.addPlayerToRoom(roomCode, 'Eve', 's-e');
    expect(eve?.player.name).toBe('Eve');
    expect(rooms.getRoom(roomCode)!.players.size).toBe(2);
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

describe('screen lifecycle and post-game restart', () => {
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

  function connectClient(): Promise<ClientSocket> {
    const socket = ioc(`http://127.0.0.1:${port}`, {
      transports: ['websocket'],
      forceNew: true,
    });
    return new Promise((resolve, reject) => {
      socket.on('connect', () => resolve(socket));
      socket.on('connect_error', reject);
    });
  }

  async function createHostRoom(): Promise<{
    host: ClientSocket;
    roomCode: string;
    hostToken: string;
  }> {
    const host = await connectClient();
    const created = await new Promise<CreateRoomAck>((resolve) => {
      host.emit(
        'host:create_room',
        { hostName: '主持人', targetPlayers: 4, hostPassword: 'host123' },
        resolve,
      );
    });
    expect(created.success).toBe(true);
    return { host, roomCode: created.roomCode!, hostToken: created.hostToken! };
  }

  function nextScreenSync(
    screen: ClientSocket,
  ): Promise<{
    role: string;
    phase: string;
    publicGameState: {
      playerSeats: { name: string }[];
      phase: string;
      currentRound: number;
      gems: unknown[];
    };
  }> {
    return new Promise((resolve) => {
      screen.once('state:sync', (snapshot) => resolve(snapshot));
    });
  }

  it('joins as screen and keeps receiving snapshots after end_game and restart', async () => {
    const { host, roomCode } = await createHostRoom();

    const player = await connectClient();
    await new Promise<RoomJoinAck>((resolve) => {
      player.emit('room:join', { roomCode, playerName: 'Alice', role: 'player' }, resolve);
    });

    const screen = await connectClient();
    const firstPromise = nextScreenSync(screen);
    const joined = await new Promise<RoomJoinAck>((resolve) => {
      screen.emit('room:join', { roomCode, playerName: 'screen', role: 'screen' }, resolve);
    });
    expect(joined.success).toBe(true);

    const first = await firstPromise;
    expect(first.role).toBe('screen');
    expect(first.publicGameState.playerSeats.some((p) => p.name === 'Alice')).toBe(true);

    const afterEnd = nextScreenSync(screen);
    host.emit('host:end_game');
    const ended = await afterEnd;
    expect(ended.role).toBe('screen');
    expect(ended.publicGameState.phase).toBe('GAME_OVER');

    const afterRestart = nextScreenSync(screen);
    host.emit('host:restart');
    const restarted = await afterRestart;
    expect(restarted.role).toBe('screen');
    expect(restarted.publicGameState.phase).toBe('LOBBY');

    // Refresh-style rejoin after session bump still attaches as screen
    const rejoined = await new Promise<RoomJoinAck>((resolve) => {
      screen.emit('room:join', { roomCode, playerName: 'screen', role: 'screen' }, resolve);
    });
    expect(rejoined.success).toBe(true);

    host.disconnect();
    player.disconnect();
    screen.disconnect();
  });

  it('drops disconnected seats on restart so new lobby joiners sit instead of queueing', async () => {
    const { host, roomCode } = await createHostRoom();

    const sockets: ClientSocket[] = [];
    for (const name of ['Alice', 'Bob', 'Cara', 'Dan']) {
      const s = await connectClient();
      sockets.push(s);
      const ack = await new Promise<RoomJoinAck>((resolve) => {
        s.emit('room:join', { roomCode, playerName: name, role: 'player' }, resolve);
      });
      expect(ack.success).toBe(true);
      expect(ack.queued).not.toBe(true);
    }

    for (const s of sockets) s.disconnect();

    await new Promise((r) => setTimeout(r, 50));
    host.emit('host:end_game');
    await new Promise((r) => setTimeout(r, 50));
    host.emit('host:restart');
    await new Promise((r) => setTimeout(r, 80));

    const eve = await connectClient();
    const eveJoin = await new Promise<RoomJoinAck>((resolve) => {
      eve.emit('room:join', { roomCode, playerName: 'Eve', role: 'player' }, resolve);
    });
    expect(eveJoin.success).toBe(true);
    expect(eveJoin.queued).not.toBe(true);
    expect(eveJoin.seatNumber).toBe(1);

    host.disconnect();
    eve.disconnect();
  });

  it('CNEZFP: restart while seated, then disconnect, new names sit and startGame proceeds', async () => {
    const { host, roomCode } = await createHostRoom();

    const originals: ClientSocket[] = [];
    for (const name of ['Alice', 'Bob', 'Cara', 'Dan']) {
      const s = await connectClient();
      originals.push(s);
      const ack = await new Promise<RoomJoinAck>((resolve) => {
        s.emit('room:join', { roomCode, playerName: name, role: 'player' }, resolve);
      });
      expect(ack.success).toBe(true);
      expect(ack.queued).not.toBe(true);
    }

    host.emit('host:restart');
    await new Promise((r) => setTimeout(r, 80));

    for (const s of originals) s.disconnect();
    await new Promise((r) => setTimeout(r, 100));

    const alice = await connectClient();
    const aliceJoin = await new Promise<RoomJoinAck>((resolve) => {
      alice.emit('room:join', { roomCode, playerName: 'Alice', role: 'player' }, resolve);
    });
    expect(aliceJoin.success).toBe(true);
    expect(aliceJoin.queued).not.toBe(true);

    const seated: ClientSocket[] = [alice];
    for (const name of ['Eve', 'Fay', 'Gus']) {
      const s = await connectClient();
      seated.push(s);
      const ack = await new Promise<RoomJoinAck>((resolve) => {
        s.emit('room:join', { roomCode, playerName: name, role: 'player' }, resolve);
      });
      expect(ack.success).toBe(true);
      expect(ack.queued).not.toBe(true);
      expect(ack.seatNumber).toBeGreaterThan(0);
    }

    const started = new Promise<{ phase: string }>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('start_game stayed in LOBBY')), 2000);
      const onSync = (snap: { phase: string }) => {
        if (snap.phase !== 'LOBBY') {
          clearTimeout(timer);
          host.off('state:sync', onSync);
          resolve(snap);
        }
      };
      host.on('state:sync', onSync);
    });
    host.emit('host:start_game');
    const snap = await started;
    expect(snap.phase).not.toBe('LOBBY');

    host.disconnect();
    for (const s of seated) s.disconnect();
  });

  it('screen refresh mid-game receives the live snapshot without wiping the room', async () => {
    const { host, roomCode, hostToken } = await createHostRoom();

    const players: ClientSocket[] = [];
    for (const name of ['Alice', 'Bob', 'Cara', 'Dan']) {
      const s = await connectClient();
      players.push(s);
      await new Promise<RoomJoinAck>((resolve) => {
        s.emit('room:join', { roomCode, playerName: name, role: 'player' }, resolve);
      });
    }

    host.emit('host:start_game');
    await new Promise((r) => setTimeout(r, 80));

    const screen = await connectClient();
    const firstSync = nextScreenSync(screen);
    const joined = await new Promise<RoomJoinAck>((resolve) => {
      screen.emit('room:join', { roomCode, playerName: 'screen', role: 'screen' }, resolve);
    });
    expect(joined.success).toBe(true);

    const live = await firstSync;
    expect(live.role).toBe('screen');
    expect(live.phase).not.toBe('LOBBY');
    expect(live.publicGameState.playerSeats).toHaveLength(4);
    expect(live.publicGameState.currentRound).toBeGreaterThanOrEqual(1);
    expect(live.publicGameState.gems.length).toBeGreaterThan(0);

    screen.disconnect();
    const refreshed = await connectClient();
    const refreshSync = nextScreenSync(refreshed);
    const rejoined = await new Promise<RoomJoinAck>((resolve) => {
      refreshed.emit('room:join', { roomCode, playerName: 'screen', role: 'screen' }, resolve);
    });
    expect(rejoined.success).toBe(true);
    const again = await refreshSync;
    expect(again.role).toBe('screen');
    expect(again.phase).not.toBe('LOBBY');
    expect(again.publicGameState.playerSeats).toHaveLength(4);

    const hostStill = await new Promise<{ role: string; hostState?: { allPlayers: { name: string }[] } }>(
      (resolve) => {
        host.once('state:sync', resolve);
        host.emit('room:join', { roomCode, playerName: '主持人', role: 'host', hostToken });
      },
    );
    expect(hostStill.role).toBe('host');
    expect(hostStill.hostState?.allPlayers).toHaveLength(4);

    host.disconnect();
    refreshed.disconnect();
    for (const s of players) s.disconnect();
  });
});
