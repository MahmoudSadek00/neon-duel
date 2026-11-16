/**
 * In-memory profile store with a persistence hook.
 * The Cloudflare Durable Object loads all profiles at start-up and writes each change to its storage.
 */
import type { Profile, RecentMatch } from '../shared/types';
import type { AvatarId } from '../shared/rules';

export class ProfileStore {
  constructor(private profiles: Record<string, Profile> = {}, private persist: (p: Profile) => void = () => {}) {}

  get(id: string): Profile {
    if (!this.profiles[id]) {
      this.profiles[id] = { id, name: 'Player', avatar: 'prism', stats: { played: 0, wins: 0, losses: 0, guesses: 0 }, recent: [] };
      this.persist(this.profiles[id]);
    }
    return this.profiles[id];
  }

  update(id: string, name: string, avatar: AvatarId): Profile {
    const p = this.get(id);
    p.name = name;
    p.avatar = avatar;
    this.persist(p);
    return p;
  }

  recordMatch(id: string, won: boolean, attempts: number, entry: RecentMatch) {
    const p = this.get(id);
    p.stats.played++;
    if (won) p.stats.wins++;
    else p.stats.losses++;
    p.stats.guesses += attempts;
    p.recent = [entry, ...p.recent].slice(0, 12);
    this.persist(p);
  }
}
