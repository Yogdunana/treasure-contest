export interface QueueEntry {
  id: string;
  roomCode: string;
  playerName: string;
  position: number;
  socketId?: string;
  browserFingerprint?: string;
  cookieToken?: string;
  joinedAt: string;
}

export interface QueueStatusUpdate {
  position: number;
  totalInQueue: number;
  estimatedWait: string;
}
