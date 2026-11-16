import type { AvatarId } from './rules';

export type Phase = 'lobby' | 'secret' | 'playing' | 'finished';

export interface PublicPlayer {
  id: string;
  name: string;
  avatar: AvatarId;
  connected: boolean;
  ready: boolean;
  secretLocked: boolean;
  attempts: number;
  bestResult: number; // best correct-positions so far (0-3)
  lastResult: number | null;
  wantsRematch: boolean;
}

export interface GuessEntry {
  attempt: number;
  guess: string | null; // null = turn timed out
  correct: number;
  at: number;
}

/** State sent to ONE player. It never contains the opponent's secret unless the match is finished. */
export interface ClientRoomState {
  code: string;
  isPrivate: boolean;
  phase: Phase;
  turnSeconds: number;
  hostId: string;
  you: PublicPlayer;
  opponent: PublicPlayer | null;
  yourSecret: string | null;
  yourGuesses: GuessEntry[];
  turnPlayerId: string | null;
  turnId: number;
  turnEndsAt: number | null;
  serverNow: number;
  round: number;
  result: null | {
    winnerId: string | null;
    reason: 'solved' | 'forfeit' | 'left';
    secrets: Record<string, string>; // revealed only after the match ends
    attempts: Record<string, number>;
  };
}

export interface ProfileStats {
  played: number;
  wins: number;
  losses: number;
  guesses: number;
}
export interface RecentMatch {
  at: number;
  opponent: string;
  opponentAvatar: AvatarId;
  won: boolean;
  attempts: number;
  reason: 'solved' | 'forfeit' | 'left';
}
export interface Profile {
  id: string;
  name: string;
  avatar: AvatarId;
  stats: ProfileStats;
  recent: RecentMatch[];
}

export type Ack<T = unknown> = (res: { ok: true; data?: T } | { ok: false; error: string }) => void;
