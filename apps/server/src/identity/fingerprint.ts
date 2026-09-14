/**
 * Server-side browser fingerprint comparison.
 *
 * Fingerprints are opaque strings generated client-side (e.g. from
 * canvas, WebGL, screen resolution, timezone, etc.) and sent to the
 * server.  The exact format is not important here — the server only
 * needs to compare two fingerprints and decide whether they refer to
 * the same browser.
 *
 * Strategy:
 *   1. If the strings are exactly equal → match (trivial case).
 *   2. Otherwise compute a similarity score using a normalised
 *      Levenshtein distance.  If the similarity is >= the threshold → match.
 *
 * The similarity threshold is intentionally generous (0.85) because
 * fingerprints can drift slightly between sessions (e.g. a font is
 * installed/uninstalled) yet still uniquely identify the browser.
 */

/** Minimum similarity ratio (0–1) for two fingerprints to be considered a match. */
export const FINGERPRINT_MATCH_THRESHOLD = 0.85;

/**
 * Compute the Levenshtein edit distance between two strings.
 *
 * Uses the standard two-row dynamic-programming approach to keep memory
 * usage O(min(m, n)).
 */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // Ensure `a` is the shorter string to minimise memory.
  if (a.length > b.length) {
    [a, b] = [b, a];
  }

  let prevRow = new Array<number>(a.length + 1);
  let currRow = new Array<number>(a.length + 1);

  for (let i = 0; i <= a.length; i++) {
    prevRow[i] = i;
  }

  for (let j = 1; j <= b.length; j++) {
    currRow[0] = j;
    for (let i = 1; i <= a.length; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      currRow[i] = Math.min(
        prevRow[i] + 1,          // deletion
        currRow[i - 1] + 1,      // insertion
        prevRow[i - 1] + cost,   // substitution
      );
    }
    [prevRow, currRow] = [currRow, prevRow];
  }

  return prevRow[a.length];
}

/**
 * Compute a similarity ratio between two fingerprints.
 *
 * @returns A float in [0, 1] where 1 means identical.
 */
export function fingerprintSimilarity(stored: string, provided: string): number {
  if (!stored || !provided) return 0;
  if (stored === provided) return 1;

  const maxLen = Math.max(stored.length, provided.length);
  if (maxLen === 0) return 1;

  const distance = levenshtein(stored, provided);
  return 1 - distance / maxLen;
}

/**
 * Compare a stored fingerprint with a newly provided one.
 *
 * @returns `true` if the fingerprints are considered a match.
 */
export function compareFingerprints(stored: string | null, provided: string | null): boolean {
  if (!stored || !provided) return false;
  if (stored === provided) return true;
  return fingerprintSimilarity(stored, provided) >= FINGERPRINT_MATCH_THRESHOLD;
}
