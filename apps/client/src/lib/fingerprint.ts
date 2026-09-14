/**
 * Browser fingerprint generation.
 *
 * Combines multiple client-side signals — canvas rendering, screen dimensions,
 * timezone, language, navigator properties — into a stable, non-reversible
 * hash string.  Used for Layer-3 reconnection when both the localStorage
 * token and the HTTP-only cookie are unavailable.
 */

/**
 * Renders a unique pattern onto a canvas and returns the resulting data URL.
 * Different devices / browsers produce slightly different pixel output due
 * to differences in GPU, font rendering, and anti-aliasing, which makes this
 * a reasonably stable signal.
 */
function getCanvasFingerprint(): string {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 50;
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'no-canvas';

    // Draw a gradient background
    const gradient = ctx.createLinearGradient(0, 0, 200, 50);
    gradient.addColorStop(0, '#ff0000');
    gradient.addColorStop(0.5, '#00ff00');
    gradient.addColorStop(1, '#0000ff');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 200, 50);

    // Draw some text with a specific font
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillStyle = '#000000';
    ctx.fillText('TreasureContest-FP-2024', 2, 2);

    // Draw geometric shapes
    ctx.beginPath();
    ctx.arc(100, 25, 15, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.strokeStyle = '#ff00ff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw an image pattern
    ctx.beginPath();
    ctx.moveTo(0, 50);
    ctx.lineTo(200, 0);
    ctx.strokeStyle = 'rgba(0,255,255,0.5)';
    ctx.stroke();

    return canvas.toDataURL();
  } catch {
    return 'canvas-error';
  }
}

/**
 * Collects navigator / screen / environment signals that contribute to the
 * fingerprint.
 */
function getEnvironmentSignals(): string {
  const nav = navigator;

  const signals: string[] = [
    // Screen properties
    String(screen.width),
    String(screen.height),
    String(screen.availWidth),
    String(screen.availHeight),
    String(screen.colorDepth),
    String((window as any).devicePixelRatio ?? 1),

    // Timezone & language
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown',
    nav.language || 'unknown',
    nav.languages?.join(',') || '',

    // Platform & UA
    nav.userAgent || '',
    nav.platform || '',

    // Hardware concurrency & memory (not always available)
    String(nav.hardwareConcurrency || 0),
    String((nav as any).deviceMemory || 0),

    // Touch support
    String('ontouchstart' in window),
    String(nav.maxTouchPoints || 0),

    // Connection info (experimental)
    String((nav as any).connection?.effectiveType || ''),

    // Color scheme preference
    String(window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? ''),
  ];

  return signals.join('|');
}

/**
 * A simple non-cryptographic hash (FNV-1a 32-bit) that converts a string
 * into a hex hash.  This is sufficient for fingerprint deduplication — it
 * does not need to be cryptographically secure.
 */
function fnv1aHash(input: string): string {
  let hash = 0x811c9dc5; // FNV offset basis

  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    // Multiply by FNV prime (0x01000193) using 32-bit overflow
    hash = Math.imul(hash, 0x01000193);
  }

  // Convert to unsigned 32-bit hex string
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Generates a stable browser fingerprint string.
 *
 * The fingerprint is a concatenation of:
 * - Canvas rendering fingerprint hash
 * - Environment signals hash
 *
 * Combined into a single hash for compactness.
 *
 * @returns A hex string fingerprint (e.g. `"a1b2c3d4e5f6a7b8"`)
 */
export function generateFingerprint(): string {
  const canvasFp = getCanvasFingerprint();
  const envSignals = getEnvironmentSignals();

  const canvasHash = fnv1aHash(canvasFp);
  const envHash = fnv1aHash(envSignals);

  // Combine both hashes for a stronger fingerprint
  return `${canvasHash}${envHash}`;
}

export default generateFingerprint;
