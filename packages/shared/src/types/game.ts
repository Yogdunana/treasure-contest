import type { GamePhase } from './phases';
import type { MissionDifficulty } from './missions';
import type { QueueEntry } from './queue';

// ============================================================================
// Gem Types
// ============================================================================

/**
 * The five gem colors available in the game.
 * Each round generates 4 gems with unique colors drawn from this set.
 */
export type GemColor = 'red' | 'blue' | 'green' | 'yellow' | 'purple';

// NOTE: GEM_COLORS is defined in ../constants.ts as the canonical source.

/**
 * A single gem on the board.
 *
 * - `id`: Format `gem_r{round}_{index}` (e.g. `gem_r1_0`)
 * - `color`: One of the five GemColor values; unique within a round
 * - `value`: Integer 1-10, equal probability random per gem
 * - `pickedBy`: PlayerId of the player who picked this gem (undefined if still on board)
 * - `pickOrder`: The order index in which this gem was picked during GEM_SELECTION
 */
export interface Gem {
  id: string;
  color: GemColor;
  value: number;
  pickedBy?: string;
  pickOrder?: number;
}

/**
 * A record mapping each gem color to a count.
 * Used for display of a player's color collection and for mission checks.
 */
export type GemColorInfo = Record<GemColor, number>;

// ============================================================================
// Player Types
// ============================================================================

/**
 * A mission assigned to a player at game start.
 * Each player gets 1 easy + 1 medium + 1 hard mission (3 total).
 * Missions are only evaluated after the final (6th) round.
 */
export interface PlayerMission {
  missionId: string;
  difficulty: MissionDifficulty;
  reward: number;
  completed: boolean;
}

/**
 * Full player state (server-authoritative).
 *
 * - `availableNumbers`: Numbers 1-7 not yet used (starts as [1,2,3,4,5,6,7])
 * - `usedNumbers`: Numbers already submitted (consumed permanently)
 * - `roundSubmission`: The number submitted in the current round (null if not yet submitted)
 * - `gems`: All gems collected across all rounds
 * - `missions`: 3 secret missions assigned at game start
 * - `finalScore`/`finalRank`: Computed after FINAL_CALCULATION
 */
export interface Player {
  id: string;
  name: string;
  seatNumber: number;
  isConnected: boolean;
  isReady: boolean;
  availableNumbers: number[];
  usedNumbers: number[];
  roundSubmission: number | null;
  gems: Gem[];
  missions: PlayerMission[];
  finalScore: number;
  finalRank: number | null;
}

/**
 * Lightweight public seat info for display on the big screen and lobby.
 * Contains no secret information.
 */
export interface PlayerSeat {
  playerId: string;
  name: string;
  seatNumber: number;
  isConnected: boolean;
  isReady: boolean;
}

// ============================================================================
// Collision & Order Types
// ============================================================================

/**
 * A group of players who submitted the same number in a round.
 *
 * - 2-3 players: resolved by clockwise seat order (isVoided = false)
 * - 4+ players: the number is voided, all players in the group lose
 *   their selection eligibility for this round (isVoided = true)
 */
export interface CollisionGroup {
  number: number;
  playerIds: string[];
  isVoided: boolean;
}

// ============================================================================
// Score Types
// ============================================================================

/**
 * The color bonus calculation result for a single color.
 *
 * Color bonus tiers (per color, highest tier only):
 * - 2 gems: +3
 * - 3 gems: +8
 * - 4 gems: +15
 * - 5 gems: +25
 * - 6 gems: +40
 *
 * Multiple colors' bonuses stack additively.
 */
export interface ColorBonus {
  color: GemColor;
  count: number;
  bonus: number;
}

/**
 * Final result for a player after all 6 rounds.
 *
 * finalScore = baseScore + colorBonus + missionBonus
 */
export interface FinalResult {
  playerId: string;
  name: string;
  finalScore: number;
  finalRank: number;
  baseScore: number;
  colorBonus: number;
  missionBonus: number;
  totalGems: number;
  missions: PlayerMission[];
}

// ============================================================================
// Timer Types
// ============================================================================

/**
 * Timer information broadcast to clients.
 *
 * - `remaining`: Milliseconds remaining in the current timer
 * - `deadline`: Server timestamp (epoch ms) when the timer expires, null if no active timer
 * - `currentPlayerId`: During GEM_SELECTION, the player who is currently picking
 */
export interface TimerInfo {
  remaining: number;
  deadline: number | null;
  currentPlayerId?: string;
}

// ============================================================================
// Room (Full Server State)
// ============================================================================

/**
 * The complete authoritative room state maintained by the server.
 * This is the source of truth; clients never modify it directly.
 *
 * Key fields:
 * - `phase`: Current game phase from the state machine
 * - `currentRound`: 1-6 (0 before game starts)
 * - `players`: All players keyed by playerId
 * - `gems`: The 4 gems generated for the current round
 * - `selectionOrder`: PlayerIds in the order they pick gems
 * - `collisionGroups`: Groups of players who collided on the same number
 * - `voidedNumbers`: Numbers voided due to 4+ player collisions
 * - `round3Ranking`: PlayerIds ranked by base score after round 3 (for H09 mission)
 * - `finalResults`: Computed after FINAL_CALCULATION
 * - `gameSession`: Increments on restart to invalidate old tokens (cross-game isolation)
 * - `currentPickerIndex`: Index into selectionOrder for the current picker
 */
export interface Room {
  // Room identity
  code: string;
  hostId: string | null;
  hostName: string;
  screenId: string | null;

  // Game flow state
  phase: GamePhase;
  currentRound: number;
  gameSession: number;

  // Player state
  players: Record<string, Player>;

  // Round state
  gems: Gem[];
  selectionOrder: string[];
  collisionGroups: CollisionGroup[];
  voidedNumbers: number[];
  revealedNumbers: { playerId: string; number: number }[];
  roundSubmissions: { playerId: string; number: number | null }[];

  // Selection state
  currentPickerIndex: number;

  // Historical / final state
  round3Ranking: string[] | null;
  finalResults: FinalResult[];

  // Timer & pause state
  timerRemaining: number;
  timerDeadline: number | null;
  isPaused: boolean;
  pausedPhase: GamePhase | null;

  // Room configuration
  maxPlayers: number;
  targetPlayers: number;
}

// ============================================================================
// Client-Facing State Types (role-filtered snapshots)
// ============================================================================

/**
 * Public game state visible to all clients (screen, players, host).
 * Contains no secret information (no other players' numbers, missions, or scores).
 */
export interface PublicGameState {
  phase: GamePhase;
  currentRound: number;
  gameSession: number;
  isPaused: boolean;
  pausedPhase: GamePhase | null;

  // Current round gems (including picked status)
  gems: Gem[];

  // Number reveal (empty before NUMBER_REVEAL phase)
  revealedNumbers: { playerId: string; number: number }[];

  // Order & collision info (populated after ORDER_CALCULATION)
  selectionOrder: string[];
  collisionGroups: CollisionGroup[];
  voidedNumbers: number[];

  // Player seats (public info only)
  playerSeats: PlayerSeat[];

  // Current picker during GEM_SELECTION
  currentPickerId: string | null;

  // Timer
  timer: TimerInfo;

  // Queue count (number of players waiting in queue)
  queueCount: number;

  // Final results (null until RESULTS_REVEAL)
  finalResults: FinalResult[] | null;
}

/**
 * Private state for a specific player.
 * Sent only to that player's socket connection.
 */
export interface PlayerPrivateState {
  playerId: string;
  availableNumbers: number[];
  usedNumbers: number[];
  roundSubmission: number | null;
  gems: Gem[];
  missions: PlayerMission[];
  baseScore: number;
  colorBonuses: ColorBonus[];
  finalScore: number | null;
  finalRank: number | null;
  /** Present after join/restart so the client can persist a current-session token. */
  authToken?: string;
}

/**
 * A single game history event entry.
 * Used for the host event log and post-game analysis.
 */
export interface GameEvent {
  id: string;
  roomCode: string;
  round: number | null;
  phase: GamePhase;
  eventType: string;
  playerId: string | null;
  data: unknown;
  timestamp: string;
}

/**
 * Extra state sent only to the host.
 * Contains all players' full data, the queue list, event log, and mission overview.
 */
export interface HostGameState {
  // Full player data for all players (including secret info)
  allPlayers: Player[];

  // Waiting queue
  queueList: QueueEntry[];

  // Event log for debugging and post-game analysis
  eventLog: GameEvent[];

  // Overview of all players' missions (staff-only view)
  missionOverview: { playerId: string; playerName: string; missions: PlayerMission[] }[];
}

/**
 * State for queued players (those waiting to join when room is full).
 */
export interface QueueState {
  position: number;
  totalInQueue: number;
  roomCode: string;
  currentPhase: GamePhase;
  playerCount: number;
  targetPlayers: number;
  estimatedWait: string;
}

// ============================================================================
// State Snapshot (sent via `state:sync` event)
// ============================================================================

/**
 * Base fields common to all snapshot variants.
 */
export interface BaseSnapshot {
  roomCode: string;
  phase: GamePhase;
  currentRound: number;
  timestamp: number;
}

/**
 * Snapshot sent to a player client.
 * Contains public state + the player's own private state.
 */
export interface PlayerSnapshot extends BaseSnapshot {
  role: 'player';
  playerId: string;
  publicGameState: PublicGameState;
  privateState: PlayerPrivateState;
}

/**
 * Snapshot sent to the big screen client.
 * Contains only public state (no secrets).
 */
export interface ScreenSnapshot extends BaseSnapshot {
  role: 'screen';
  publicGameState: PublicGameState;
}

/**
 * Snapshot sent to the host client.
 * Contains public state + full host state (all players, queue, events, missions).
 */
export interface HostSnapshot extends BaseSnapshot {
  role: 'host';
  publicGameState: PublicGameState;
  hostState: HostGameState;
}

/**
 * Snapshot sent to a queued player.
 * Contains queue position + room overview.
 */
export interface QueuedSnapshot extends BaseSnapshot {
  role: 'queued';
  queueState: QueueState;
}

/**
 * The full state snapshot sent to each client via the `state:sync` event.
 * The server filters information based on the client's role:
 * - player: PublicGameState + PlayerPrivateState (own data only)
 * - screen: PublicGameState only
 * - host: PublicGameState + HostGameState (everything)
 * - queued: QueueState only
 */
export type StateSnapshot =
  | PlayerSnapshot
  | ScreenSnapshot
  | HostSnapshot
  | QueuedSnapshot;
