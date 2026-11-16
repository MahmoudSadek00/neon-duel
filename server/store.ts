/**
 * Tiny persistent profile store (JSON file). Swap for Supabase later by
 * re-implementing these four functions — the rest of the server only uses this API.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { Profile, RecentMatch } from '../shared/types';
import type { AvatarId } from '../shared/rules';

const DATA_DIR = process.env.DATA_DIR || path.resolve(process.cwd(), 'data');
const FILE = path.join(DATA_DIR, 'profiles.json');
let profiles: Record<string, Profile> = {};
let timer: NodeJS.Timeout | null = null;

try {
  profiles = JSON.parse(fs.readFileSync(FILE, 'utf8'));
} catch {
  profiles = {};
}

function persist() {
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(profiles));
    fs.renameSync(tmp, FILE);
  }, 500);
}

export function getProfile(id: string): Profile {
  if (!profiles[id]) {
    profiles[id] = { id, name: 'Player', avatar: 'prism', stats: { played: 0, wins: 0, losses: 0, guesses: 0 }, recent: [] };
    persist();
  }
  return profiles[id];
}

export function updateProfile(id: string, name: string, avatar: AvatarId): Profile {
  const p = getProfile(id);
  p.name = name;
  p.avatar = avatar;
  persist();
  return p;
}

export function recordMatch(id: string, won: boolean, attempts: number, entry: RecentMatch) {
  const p = getProfile(id);
  p.stats.played++;
  if (won) p.stats.wins++;
  else p.stats.losses++;
  p.stats.guesses += attempts;
  p.recent = [entry, ...p.recent].slice(0, 12);
  persist();
}
