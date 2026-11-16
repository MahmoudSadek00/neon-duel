/** Core NEON DUEL rules, shared by server (authoritative) and client (input validation only). */

export const DIGITS = 3;
export const SECRET_RE = /^\d{3}$/;
export const TURN_SECONDS_OPTIONS = [30, 45, 60, 90] as const;
export const DEFAULT_TURN_SECONDS = 45;

/** Normalise any user input into a 3-digit string, or null if invalid. Leading zeros are kept. */
export function normalizeCode(input: unknown): string | null {
  if (typeof input !== 'string' && typeof input !== 'number') return null;
  const s = String(input).trim();
  return SECRET_RE.test(s) ? s : null;
}

/**
 * Count digits that match in the exact same position.
 * Repeated digits are handled positionally: secret 112 vs guess 121 → 1 (only position 0 matches).
 */
export function evaluateGuess(secret: string, guess: string): number {
  let correct = 0;
  for (let i = 0; i < DIGITS; i++) if (secret[i] === guess[i]) correct++;
  return correct;
}

export const AVATARS = ['prism', 'orbit', 'pulse', 'cipher', 'nova', 'helix', 'echo', 'quark'] as const;
export type AvatarId = (typeof AVATARS)[number];

export function cleanName(input: unknown): string {
  const s = typeof input === 'string' ? input.replace(/[\u0000-\u001f<>]/g, '').trim() : '';
  return (s || 'Player').slice(0, 16);
}
export function cleanAvatar(input: unknown): AvatarId {
  return (AVATARS as readonly string[]).includes(input as string) ? (input as AvatarId) : 'prism';
}
