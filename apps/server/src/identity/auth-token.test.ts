import { describe, expect, it } from 'vitest';
import { generateAuthToken, verifyAuthToken } from './auth-token.js';

describe('verifyAuthToken', () => {
  it('accepts a token whose session matches', () => {
    const token = generateAuthToken('pid', 'ABCD', 3);
    const result = verifyAuthToken(token, 3);
    expect(result).toEqual({
      valid: true,
      playerId: 'pid',
      roomCode: 'ABCD',
      session: 3,
    });
  });

  it('returns the embedded session on mismatch so callers can send SESSION_EXPIRED', () => {
    const token = generateAuthToken('pid', 'ABCD', 1);
    const result = verifyAuthToken(token, 2);
    expect(result.valid).toBe(false);
    expect(result.session).toBe(1);
    expect(result.playerId).toBe('pid');
    expect(result.roomCode).toBe('ABCD');
  });

  it('returns no session for a malformed token', () => {
    expect(verifyAuthToken('not-a-token', 1)).toEqual({ valid: false });
  });
});
