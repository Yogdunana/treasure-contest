import { Router, type Request, type Response } from 'express';
import * as playerRepo from '../db/repositories/player-repo.js';
import { setPlayerCookies } from '../identity/cookie-helper.js';
import { logger } from '../utils/logger.js';

/**
 * HTTP session helpers so Layer-2 reconnect cookies can actually be set.
 * Players join over Socket.io, which cannot emit Set-Cookie, so the client
 * calls this endpoint after a successful join/reconnect ack.
 */
export function createSessionRouter(): Router {
  const router = Router();

  router.post('/player', (req: Request, res: Response) => {
    const playerId = typeof req.body?.playerId === 'string' ? req.body.playerId : '';
    const roomCode = typeof req.body?.roomCode === 'string' ? req.body.roomCode.trim().toUpperCase() : '';
    const authToken = typeof req.body?.authToken === 'string' ? req.body.authToken : '';

    if (!playerId || !roomCode || !authToken) {
      res.status(400).json({ success: false, error: 'Missing playerId, roomCode, or authToken' });
      return;
    }

    let player: playerRepo.PlayerRecord | null = null;
    try {
      player = playerRepo.getPlayer(playerId);
    } catch (err) {
      logger.error('Failed to look up player for session cookie', { error: err });
      res.status(500).json({ success: false, error: 'Internal error' });
      return;
    }

    if (!player || player.roomCode !== roomCode || player.authToken !== authToken) {
      res.status(401).json({ success: false, error: 'Invalid session' });
      return;
    }

    setPlayerCookies(res, playerId, roomCode);
    res.json({ success: true });
  });

  return router;
}
