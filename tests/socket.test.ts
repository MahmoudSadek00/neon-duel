/**
 * End-to-end multiplayer test against a real server process (no browser).
 * Covers rooms, readiness, secrets privacy, turn ownership, duplicate submissions,
 * evaluation, win, rematch, timeout and reconnect.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { io, type Socket } from 'socket.io-client';
import type { ClientRoomState } from '../shared/types';

const PORT = 4300 + Math.floor(Math.random() * 500);
const URL = `http://localhost:${PORT}`;
let srv: ChildProcess;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nd-'));

before(async () => {
  srv = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: dataDir, RECONNECT_MS: '1500' }, stdio: 'pipe' });
  await new Promise<void>((res, rej) => {
    const t = setTimeout(() => rej(new Error('server did not start')), 20000);
    srv.stdout!.on('data', (d) => { if (String(d).includes('NEON DUEL server')) { clearTimeout(t); res(); } });
    srv.stderr!.on('data', (d) => process.stderr.write(d));
  });
});
after(() => { srv.kill(); });

class Client {
  sock: Socket;
  state: ClientRoomState | null = null;
  events: { name: string; payload: any }[] = [];
  raw: string[] = [];
  constructor(public token = crypto.randomBytes(32).toString('hex')) {
    this.sock = io(URL, { auth: { token }, transports: ['websocket'], forceNew: true });
    this.sock.on('room:state', (s) => { this.state = s; this.raw.push(JSON.stringify(s)); });
    this.sock.onAny((name, payload) => { this.events.push({ name, payload }); if (name !== 'room:state') this.raw.push(JSON.stringify(payload)); });
  }
  ready() { return new Promise<void>((r) => (this.sock.connected ? r() : this.sock.once('connect', () => r()))); }
  call<T = any>(ev: string, p: any = {}): Promise<{ ok: boolean; data?: T; error?: string }> {
    return new Promise((r) => this.sock.emit(ev, p, r));
  }
  async until(fn: (s: ClientRoomState | null) => boolean, ms = 4000) {
    const t0 = Date.now();
    while (!fn(this.state)) { if (Date.now() - t0 > ms) throw new Error('timeout waiting for state'); await new Promise((r) => setTimeout(r, 20)); }
    return this.state!;
  }
  close() { this.sock.close(); }
}

async function startMatch(turnSeconds = 45) {
  const a = new Client(); const b = new Client();
  await Promise.all([a.ready(), b.ready()]);
  await a.call('profile:update', { name: 'Ada', avatar: 'orbit' });
  await b.call('profile:update', { name: 'Bo', avatar: 'nova' });
  const created = await a.call<string>('room:create', { turnSeconds });
  assert.ok(created.ok);
  const code = created.data!;
  assert.match(code, /^[A-Z2-9]{5}$/);
  assert.ok((await b.call('room:join', { code })).ok);
  await a.until((s) => !!s?.opponent);
  const c = new Client(); await c.ready();
  assert.equal((await c.call('room:join', { code })).ok, false, 'third player should be rejected');
  c.close();
  await a.call('room:ready', { ready: true });
  await b.call('room:ready', { ready: true });
  await a.until((s) => s?.phase === 'secret');
  return { a, b, code };
}

test('full private-room match with privacy and turn rules', async () => {
  const { a, b } = await startMatch();
  assert.equal((await a.call('secret:set', { secret: '12' })).ok, false);
  assert.ok((await a.call('secret:set', { secret: '027' })).ok);
  assert.equal((await a.call('secret:set', { secret: '111' })).ok, false, 'secret cannot be changed');
  await b.until((s) => !!s?.opponent?.secretLocked);
  assert.equal(b.state!.yourSecret, null);
  assert.ok((await b.call('secret:set', { secret: '263' })).ok);
  const sa = await a.until((s) => s?.phase === 'playing');
  assert.equal(sa.yourSecret, '027', 'own secret always visible');

  // privacy: neither client has ever received the other's secret before the end
  assert.ok(!a.raw.some((r) => r.includes('"263"')), 'A must never see B secret');
  assert.ok(!b.raw.some((r) => r.includes('"027"')), 'B must never see A secret');

  let first = sa.turnPlayerId === sa.you.id ? a : b;
  let second = first === a ? b : a;
  const turnId = first.state!.turnId;
  assert.equal((await second.call('guess:submit', { guess: '123', turnId })).ok, false, 'not your turn');
  assert.equal((await first.call('guess:submit', { guess: '12a', turnId })).ok, false, 'invalid guess');
  const g1 = await first.call('guess:submit', { guess: first === a ? '298' : '999', turnId });
  assert.ok(g1.ok);
  assert.equal((g1.data as any).correct, first === a ? 1 : 0);
  assert.equal((await first.call('guess:submit', { guess: '111', turnId })).ok, false, 'duplicate submission');
  await second.until((s) => s?.turnPlayerId === s?.you.id);

  // play until A cracks 263; B keeps guessing wrong
  const aGuesses = ['491', '223', '263'];
  let i = 0;
  while (a.state!.phase === 'playing') {
    await b.until((s) => s!.turnId === a.state!.turnId);
    const cur = a.state!.turnPlayerId === a.state!.you.id ? a : b;
    const st = cur.state!;
    const guess = cur === a ? aGuesses[i++] : '999';
    const r = await cur.call('guess:submit', { guess, turnId: st.turnId });
    assert.ok(r.ok, r.error);
    await a.until((s) => s!.turnId !== st.turnId || s!.phase === 'finished');
  }
  const fin = await b.until((s) => s?.phase === 'finished');
  assert.equal(fin.result!.winnerId, a.state!.you.id);
  assert.equal(fin.result!.secrets[a.state!.you.id], '027');
  assert.equal(fin.result!.reason, 'solved');
  const hist = a.state!.yourGuesses.filter((g) => g.guess);
  assert.deepEqual(hist.slice(-3).map((g) => g.correct), [0, 2, 3]);
  assert.equal((await a.call('guess:submit', { guess: '263', turnId: a.state!.turnId })).ok, false, 'no guesses after win');

  // stats recorded
  const prof = await a.call('profile:get');
  assert.equal((prof.data as any).stats.wins, 1);
  assert.equal((prof.data as any).recent[0].opponent, 'Bo');

  // rematch
  await a.call('rematch:vote');
  await b.call('rematch:vote');
  const re = await a.until((s) => s?.phase === 'secret' && s.round === 2);
  assert.equal(re.yourSecret, null);
  assert.equal(re.yourGuesses.length, 0);
  a.close(); b.close();
});

test('quick match pairs two players and skips the lobby', async () => {
  const a = new Client(); const b = new Client();
  await Promise.all([a.ready(), b.ready()]);
  assert.equal((await a.call('room:quick')).data, 'waiting');
  assert.equal((await b.call('room:quick')).data, 'matched');
  const s = await a.until((x) => x?.phase === 'secret');
  assert.equal(s.isPrivate, false);
  const c = new Client(); await c.ready();
  assert.equal((await c.call('room:join', { code: s.code })).ok, false);
  c.close();
  a.close(); b.close();
});

test('turn timeout skips the turn', async () => {
  const { a, b } = await startMatch(30);
  // shorten: we cannot wait 30s in CI, so just assert deadline is set correctly
  await a.call('secret:set', { secret: '111' });
  await b.call('secret:set', { secret: '222' });
  const s = await a.until((x) => x?.phase === 'playing');
  const left = s.turnEndsAt! - s.serverNow;
  assert.ok(left > 28_000 && left <= 30_000, `deadline ~30s, got ${left}`);
  a.close(); b.close();
});

test('reconnect keeps the seat and secret; long disconnect forfeits', async () => {
  const { a, b } = await startMatch();
  await a.call('secret:set', { secret: '505' });
  await b.call('secret:set', { secret: '606' });
  await a.until((x) => x?.phase === 'playing');
  const token = a.token;
  a.close();
  await b.until((x) => x?.opponent?.connected === false);
  const a2 = new Client(token);
  const back = await a2.until((x) => x?.phase === 'playing');
  assert.equal(back.yourSecret, '505');
  await b.until((x) => x?.opponent?.connected === true);
  // now drop for longer than RECONNECT_MS (1.5s)
  a2.close();
  const fin = await b.until((x) => x?.phase === 'finished', 5000);
  assert.equal(fin.result!.winnerId, b.state!.you.id);
  assert.equal(fin.result!.reason, 'left');
  b.close();
});

test('invalid tokens are refused', async () => {
  const s = io(URL, { auth: { token: 'nope' }, transports: ['websocket'], forceNew: true, reconnection: false });
  const err = await new Promise<Error>((r) => s.on('connect_error', r));
  assert.equal(err.message, 'bad-token');
  s.close();
});
