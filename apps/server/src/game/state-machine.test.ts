import { describe, expect, it } from 'vitest';
import type { Gem, Player, PlayerMission } from '@treasure-contest/shared';
import { MISSION_REWARDS } from '@treasure-contest/shared';
import { Room } from './room.js';
import { calculateFinalScores, revealNumbers } from './state-machine.js';
import { resolveTies } from '@treasure-contest/shared';

function gem(id: string, color: Gem['color'], value: number): Gem {
  return { id, color, value };
}

function h09(): PlayerMission {
  return {
    missionId: 'H09',
    difficulty: 'hard',
    reward: MISSION_REWARDS.hard,
    completed: false,
  };
}

function makePlayer(
  id: string,
  name: string,
  seat: number,
  gems: Gem[],
  missions: PlayerMission[] = [],
): Player {
  return {
    id,
    name,
    seatNumber: seat,
    isConnected: true,
    isReady: true,
    availableNumbers: [1, 2, 3, 4, 5, 6, 7],
    usedNumbers: [],
    roundSubmission: null,
    gems,
    missions,
    finalScore: 0,
    finalRank: null,
  };
}

describe('calculateFinalScores H09', () => {
  it('completes H09 on the second pass using preliminary final ranks', () => {
    const room = new Room('H09RM', 'Host', 'token', 5);

    const p1 = makePlayer('p1', 'Ava', 1, [gem('g1', 'red', 30)], [h09()]);
    const p2 = makePlayer('p2', 'Ben', 2, [gem('g2', 'blue', 40)]);
    const p3 = makePlayer('p3', 'Cara', 3, [gem('g3', 'green', 35)]);
    const p4 = makePlayer('p4', 'Dan', 4, [gem('g4', 'yellow', 10)]);
    const p5 = makePlayer('p5', 'Eve', 5, [gem('g5', 'purple', 5)]);

    for (const p of [p1, p2, p3, p4, p5]) {
      room.players.set(p.id, p);
    }

    // After round 3 Ava was last; by the end her 30 base is 3rd (without H09).
    room.round3Ranking = ['p2', 'p3', 'p4', 'p5', 'p1'];

    calculateFinalScores(room);

    const ava = room.players.get('p1')!;
    const h09Mission = ava.missions.find((m) => m.missionId === 'H09');
    expect(h09Mission?.completed).toBe(true);
    expect(ava.finalScore).toBe(30 + MISSION_REWARDS.hard);
    expect(ava.finalRank).toBe(1);
  });
});

describe('resolveTies', () => {
  it('ranks by total score, not base score', () => {
    const ranked = resolveTies([
      {
        playerId: 'low-base-high-total',
        name: 'Ava',
        finalScore: 65,
        finalRank: 0,
        baseScore: 30,
        colorBonus: 0,
        missionBonus: 35,
        totalGems: 1,
        missions: [h09()],
      },
      {
        playerId: 'high-base',
        name: 'Ben',
        finalScore: 40,
        finalRank: 0,
        baseScore: 40,
        colorBonus: 0,
        missionBonus: 0,
        totalGems: 1,
        missions: [],
      },
    ]);

    expect(ranked[0]?.playerId).toBe('low-base-high-total');
    expect(ranked[0]?.finalRank).toBe(1);
    expect(ranked[1]?.finalRank).toBe(2);
  });
});

describe('RESULTS_REVEAL order', () => {
  it('reveals lowest score first, not the rank-1 winner', () => {
    const room = new Room('REV', 'Host', 'token', 4);
    room.phase = 'RESULTS_REVEAL';
    room.revealedResultsCount = 1;
    room.finalResults = [
      {
        playerId: 'winner',
        name: 'Winner',
        finalScore: 80,
        finalRank: 1,
        baseScore: 80,
        colorBonus: 0,
        missionBonus: 0,
        totalGems: 4,
        missions: [],
      },
      {
        playerId: 'loser',
        name: 'Loser',
        finalScore: 10,
        finalRank: 2,
        baseScore: 10,
        colorBonus: 0,
        missionBonus: 0,
        totalGems: 1,
        missions: [],
      },
    ];

    const snapshot = room.toPublicState();
    expect(snapshot.targetPlayers).toBe(4);
    expect(snapshot.finalResults).toHaveLength(1);
    expect(snapshot.finalResults?.[0]?.playerId).toBe('loser');
  });
});

describe('revealNumbers timeout auto-submit', () => {
  it('consumes the lowest remaining number for anyone who did not pick', () => {
    const room = new Room('AUTO', 'Host', 'token', 4);
    room.phase = 'NUMBER_SELECTION';

    const connected = makePlayer('p1', 'Ava', 1, []);
    connected.availableNumbers = [2, 5, 7];
    connected.roundSubmission = null;

    const disconnected = makePlayer('p2', 'Ben', 2, []);
    disconnected.isConnected = false;
    disconnected.availableNumbers = [1, 3, 6];
    disconnected.roundSubmission = null;

    const alreadyIn = makePlayer('p3', 'Cara', 3, []);
    alreadyIn.availableNumbers = [1, 2, 3];
    alreadyIn.usedNumbers = [7];
    alreadyIn.roundSubmission = 7;

    for (const p of [connected, disconnected, alreadyIn]) {
      room.players.set(p.id, p);
    }

    revealNumbers(room);

    expect(room.phase).toBe('NUMBER_REVEAL');
    expect(connected.roundSubmission).toBe(2);
    expect(connected.availableNumbers).toEqual([5, 7]);
    expect(disconnected.roundSubmission).toBe(1);
    expect(disconnected.availableNumbers).toEqual([3, 6]);
    expect(alreadyIn.roundSubmission).toBe(7);
    expect(room.revealedNumbers.map((r) => r.number).sort()).toEqual([1, 2, 7]);
  });
});
