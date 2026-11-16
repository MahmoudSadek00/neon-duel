/**
 * GameHub Durable Object: the single authoritative game server.
 * All players connect here over WebSockets; the room/match engine (server/game.ts) runs in memory,
 * profiles and stats are persisted in Durable Object storage.
 *
 * Wire protocol (JSON):
 *   client → server  { t: 'call', id, ev, p }           request with acknowledgement
 *                    { t: 'ping' }
 *   server → client  { t: 'ack', id, ok, data | error }
 *                    { t: 'ev', ev, p }                   pushed event (room:state, guess:result, …)
 *                    { t: 'pong' }
 */
import { DurableObject } from 'cloudflare:workers';
import { GameError, GameManager, type Identity } from '../server/game';
import { ProfileStore } from '../server/profiles';
import { cleanAvatar, cleanName } from '../shared/rules';
import type { Profile } from '../shared/types';

export interface Env {
  GAME_HUB: DurableObjectNamespace<GameHub>;
  ASSETS: Fetcher;
  RECONNECT_MS?: string;
}

interface Conn { ws: WebSocket; pid: string; bucket: number[] }

export class GameHub extends DurableObject<Env> {
  private conns = new Set<Conn>();
  private store!: ProfileStore;
  private game!: GameManager;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      const saved = await ctx.storage.list<Profile>({ prefix: 'p:' });
      const profiles: Record<string, Profile> = {};
      for (const p of saved.values()) profiles[p.id] = p;
      this.store = new ProfileStore(profiles, (p) => { void ctx.storage.put(`p:${p.id}`, p); });
      this.game = new GameManager(
        {
          state: (pid, state) => this.send(pid, { t: 'ev', ev: 'room:state', p: state }),
          event: (pid, ev, p) => this.send(pid, { t: 'ev', ev, p }),
        },
        {
          reconnectMs: Number(env.RECONNECT_MS || 60_000),
          recordMatch: (id, won, attempts, entry) => this.store.recordMatch(id, won, attempts, entry),
        },
      );
    });
  }

  private send(pid: string, msg: unknown) {
    const data = JSON.stringify(msg);
    for (const c of this.conns) {
      if (c.pid !== pid) continue;
      try { c.ws.send(data); } catch { /* socket already closing */ }
    }
  }

  private identity(pid: string): Identity {
    const p = this.store.get(pid);
    return { id: p.id, name: p.name, avatar: p.avatar };
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected WebSocket', { status: 426 });
    const token = new URL(request.url).searchParams.get('token') || '';
    if (!/^[a-f0-9]{64}$/.test(token)) return new Response('bad-token', { status: 401 });
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
    const pid = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('').slice(0, 24);

    const { 0: client, 1: server } = new WebSocketPair();
    server.accept();
    const conn: Conn = { ws: server, pid, bucket: [] };
    this.conns.add(conn);

    server.addEventListener('message', (e) => this.onMessage(conn, e.data));
    const closed = () => {
      if (!this.conns.delete(conn)) return;
      const stillHere = [...this.conns].some((c) => c.pid === pid);
      if (!stillHere) this.game.disconnect(pid);
    };
    server.addEventListener('close', closed);
    server.addEventListener('error', closed);

    // greet: the client treats this as "connected", then restore any room the player is in
    server.send(JSON.stringify({ t: 'ev', ev: 'hello', p: { id: pid } }));
    this.game.reconnect(this.identity(pid));
    this.game.sync(pid);
    return new Response(null, { status: 101, webSocket: client });
  }

  private onMessage(conn: Conn, raw: unknown) {
    let msg: { t?: string; id?: number; ev?: string; p?: any };
    try { msg = JSON.parse(String(raw)); } catch { return; }
    if (msg.t === 'ping') { conn.ws.send('{"t":"pong"}'); return; }
    if (msg.t !== 'call' || typeof msg.ev !== 'string') return;
    const reply = (body: object) => { try { conn.ws.send(JSON.stringify({ t: 'ack', id: msg.id, ...body })); } catch { /* closed */ } };

    const now = Date.now();
    conn.bucket = conn.bucket.filter((t) => now - t < 3000);
    if (conn.bucket.length >= 15) return reply({ ok: false, error: 'Slow down a little.' });
    conn.bucket.push(now);

    try {
      reply({ ok: true, data: this.handle(conn.pid, msg.ev, msg.p ?? {}) });
    } catch (e) {
      if (e instanceof GameError) reply({ ok: false, error: e.message });
      else { console.error(msg.ev, e); reply({ ok: false, error: 'Unexpected server error.' }); }
    }
  }

  private handle(pid: string, ev: string, p: any): unknown {
    const g = this.game;
    switch (ev) {
      case 'profile:get': return this.store.get(pid);
      case 'profile:update': {
        const prof = this.store.update(pid, cleanName(p.name), cleanAvatar(p.avatar));
        g.updateIdentity({ id: pid, name: prof.name, avatar: prof.avatar });
        return prof;
      }
      case 'room:create': return g.createRoom(this.identity(pid), Number(p.turnSeconds));
      case 'room:join': return g.joinRoom(this.identity(pid), p.code);
      case 'room:quick': return g.quickMatch(this.identity(pid));
      case 'room:quickCancel': return g.cancelQuick(pid);
      case 'room:leave': return g.leave(pid);
      case 'room:ready': return g.setReady(pid, !!p.ready);
      case 'room:sync': return g.sync(pid);
      case 'secret:set': g.setSecret(pid, p.secret); return true;
      case 'guess:submit': return g.submitGuess(pid, p.guess, p.turnId);
      case 'rematch:vote': return g.voteRematch(pid);
      default: throw new GameError('Unknown action.');
    }
  }
}
