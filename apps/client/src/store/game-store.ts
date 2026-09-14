/**
 * Game store — the central client-side state derived from server snapshots.
 *
 * The server sends `StateSnapshot` objects via the `state:sync` socket event.
 * Each snapshot variant (player, screen, host, queued) contains a different
 * subset of the full room state.  This store flattens whichever variant
 * arrives into a single flat object tree that React components can subscribe
 * to via `useGameStore`.
 *
 * The store is intentionally "dumb" — it never performs logic, it only
 * stores the latest values.  All game logic lives on the server.
 */

import { create } from 'zustand';
import type {
  ClientRole,
  GamePhase,
  Gem,
  CollisionGroup,
  PlayerSeat,
  TimerInfo,
  FinalResult,
  Player,
  PlayerMission,
  ColorBonus,
  QueueEntry,
  GameEvent,
  StateSnapshot,
  PublicGameState,
} from '@treasure-contest/shared';

// ---------------------------------------------------------------------------
// Store interface
// ---------------------------------------------------------------------------

export interface GameStore {
  // ── Public state (visible to all roles) ──────────────────────────────
  phase: GamePhase;
  currentRound: number;
  gems: Gem[];
  /** Map of playerId → revealed number (null if not yet revealed). */
  revealedNumbers: Record<string, number | null>;
  selectionOrder: string[];
  collisionGroups: CollisionGroup[];
  voidedNumbers: number[];
  playerSeats: PlayerSeat[];
  currentPickerId: string | null;
  timer: TimerInfo | null;
  queueCount: number;
  finalResults: FinalResult[];

  // ── Private state (player only) ───────────────────────────────────────
  playerId: string | null;
  playerName: string | null;
  availableNumbers: number[];
  usedNumbers: number[];
  roundSubmission: number | null;
  myGems: Gem[];
  myMissions: PlayerMission[];
  myBaseScore: number;
  myColorBonuses: ColorBonus[];
  myFinalScore: number | null;
  myFinalRank: number | null;

  // ── Host state (host only) ────────────────────────────────────────────
  allPlayers: Player[];
  queueList: QueueEntry[];
  eventLog: GameEvent[];

  // ── Queue state (queued players) ──────────────────────────────────────
  queuePosition: number | null;
  totalInQueue: number | null;

  // ── Last snapshot identity (used by screen/host to know we actually joined)
  snapshotRole: ClientRole | 'queued' | null;
  snapshotRoomCode: string | null;

  // ── Actions ────────────────────────────────────────────────────────────
  setSnapshot: (snapshot: StateSnapshot) => void;
  setTimer: (timer: TimerInfo) => void;
  reset: () => void;
}

// ---------------------------------------------------------------------------
// Initial / default state
// ---------------------------------------------------------------------------

const initialState = {
  // Public
  phase: 'LOBBY' as GamePhase,
  currentRound: 0,
  gems: [] as Gem[],
  revealedNumbers: {} as Record<string, number | null>,
  selectionOrder: [] as string[],
  collisionGroups: [] as CollisionGroup[],
  voidedNumbers: [] as number[],
  playerSeats: [] as PlayerSeat[],
  currentPickerId: null as string | null,
  timer: null as TimerInfo | null,
  queueCount: 0,
  finalResults: [] as FinalResult[],

  // Private
  playerId: null as string | null,
  playerName: null as string | null,
  availableNumbers: [] as number[],
  usedNumbers: [] as number[],
  roundSubmission: null as number | null,
  myGems: [] as Gem[],
  myMissions: [] as PlayerMission[],
  myBaseScore: 0,
  myColorBonuses: [] as ColorBonus[],
  myFinalScore: null as number | null,
  myFinalRank: null as number | null,

  // Host
  allPlayers: [] as Player[],
  queueList: [] as QueueEntry[],
  eventLog: [] as GameEvent[],

  // Queue
  queuePosition: null as number | null,
  totalInQueue: null as number | null,

  snapshotRole: null as ClientRole | 'queued' | null,
  snapshotRoomCode: null as string | null,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Converts the `revealedNumbers` array from `PublicGameState` into a
 * `Record<playerId, number | null>` lookup for convenient access in
 * components.
 */
function revealedNumbersToRecord(
  arr: { playerId: string; number: number }[] | undefined,
): Record<string, number | null> {
  if (!arr || arr.length === 0) return {};
  const result: Record<string, number | null> = {};
  for (const entry of arr) {
    result[entry.playerId] = entry.number;
  }
  return result;
}

/**
 * Extracts public game state fields from a `PublicGameState` into the
 * shape expected by the store.
 */
function extractPublicState(pgs: PublicGameState) {
  return {
    phase: pgs.phase,
    currentRound: pgs.currentRound,
    gems: pgs.gems,
    revealedNumbers: revealedNumbersToRecord(pgs.revealedNumbers),
    selectionOrder: pgs.selectionOrder,
    collisionGroups: pgs.collisionGroups,
    voidedNumbers: pgs.voidedNumbers,
    playerSeats: pgs.playerSeats,
    currentPickerId: pgs.currentPickerId,
    timer: pgs.timer,
    queueCount: pgs.queueCount,
    finalResults: pgs.finalResults ?? [],
  };
}

// ---------------------------------------------------------------------------
// Store implementation
// ---------------------------------------------------------------------------

export const useGameStore = create<GameStore>((set) => ({
  ...initialState,

  setSnapshot: (snapshot) => {
    const identity = {
      snapshotRole: snapshot.role,
      snapshotRoomCode: snapshot.roomCode,
    };

    switch (snapshot.role) {
      // ── Player snapshot ──────────────────────────────────────────────
      case 'player': {
        const pub = extractPublicState(snapshot.publicGameState);
        const priv = snapshot.privateState;
        set({
          ...identity,
          ...pub,
          playerId: priv.playerId,
          availableNumbers: priv.availableNumbers,
          usedNumbers: priv.usedNumbers,
          roundSubmission: priv.roundSubmission,
          myGems: priv.gems,
          myMissions: priv.missions,
          myBaseScore: priv.baseScore,
          myColorBonuses: priv.colorBonuses,
          myFinalScore: priv.finalScore,
          myFinalRank: priv.finalRank,
        });
        break;
      }

      // ── Screen snapshot ─────────────────────────────────────────────
      case 'screen': {
        const pub = extractPublicState(snapshot.publicGameState);
        set({ ...identity, ...pub });
        break;
      }

      // ── Host snapshot ───────────────────────────────────────────────
      case 'host': {
        const pub = extractPublicState(snapshot.publicGameState);
        const host = snapshot.hostState;
        set({
          ...identity,
          ...pub,
          allPlayers: host.allPlayers,
          queueList: host.queueList,
          eventLog: host.eventLog,
        });
        break;
      }

      // ── Queued snapshot ─────────────────────────────────────────────
      case 'queued': {
        const qs = snapshot.queueState;
        set({
          ...identity,
          phase: qs.currentPhase,
          queuePosition: qs.position,
          totalInQueue: qs.totalInQueue,
          queueCount: qs.playerCount,
          currentRound: 0,
        });
        break;
      }
    }
  },

  setTimer: (timer) => {
    set({ timer });
  },

  reset: () => {
    set({ ...initialState });
  },
}));

export default useGameStore;
