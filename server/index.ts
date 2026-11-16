import crypto from 'node:crypto';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import { Server, type Socket } from 'socket.io';
import { GameError, GameManager, type Identity } from './game';
import { getProfile, updateProfile } from './store';
import { cleanAvatar, cleanName } from '../shared/rules';
import type { Ack } from '../shared/types';

const PORT = Number(process.env.PORT || 3001);
const app = express();
app.disable('x-powered-by');
app.get('/health', (_req, res) => res.json({ ok: true }));

const dist = path.resolve(process.cwd(), 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist, { maxAge: '1y', index: false }));
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

const server = http.createServer(app);
const io = new Server(server, {
  cors: process.env.CORS_ORIGIN ? { origin: process.env.CORS_ORIGIN.split(',') } : undefined,
  pingInterval: 10_000,
  pingTimeout: 8_000,
});

const room = (playerId: string) => `p:${playerId}`;
export const game = new GameManager({
  state: (pid, state) => io.to(room(pid)).emit('room:state', state),
  event: (pid, name, payload) => io.to(room(pid)).emit(name, payload),
}, { reconnectMs: Number(process.env.RECONNECT_MS || 60_000) });

/** Identity: the client keeps a random 256-bit token; the public player id is derived from it. */
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return next(new Error('bad-token'));
  socket.data.playerId = crypto.createHash('sha256').update(token).digest('hex').slice(0, 24);
  next();
});

function identity(socket: Socket): Identity {
  const p = getProfile(socket.data.playerId);
  return { id: p.id, name: p.name, avatar: p.avatar };
}

io.on('connection', (socket) => {
  const pid: string = socket.data.playerId;
  socket.join(room(pid));

  // simple per-socket rate limit: 15 actions / 3 s
  let bucket: number[] = [];
  const handle = <T>(name: string, fn: (payload: any) => T) => {
    socket.on(name, (payload: any, ack?: Ack<T>) => {
      const now = Date.now();
      bucket = bucket.filter((t) => now - t < 3000);
      const reply = typeof ack === 'function' ? ack : () => {};
      if (bucket.length >= 15) return reply({ ok: false, error: 'Slow down a little.' });
      bucket.push(now);
      try {
        reply({ ok: true, data: fn(payload ?? {}) });
      } catch (e) {
        if (e instanceof GameError) reply({ ok: false, error: e.message });
        else { console.error(name, e); reply({ ok: false, error: 'Unexpected server error.' }); }
      }
    });
  };

  handle('profile:get', () => getProfile(pid));
  handle('profile:update', (p) => {
    const prof = updateProfile(pid, cleanName(p.name), cleanAvatar(p.avatar));
    game.updateIdentity({ id: pid, name: prof.name, avatar: prof.avatar });
    return prof;
  });
  handle('room:create', (p) => game.createRoom(identity(socket), Number(p.turnSeconds)));
  handle('room:join', (p) => game.joinRoom(identity(socket), p.code));
  handle('room:quick', () => game.quickMatch(identity(socket)));
  handle('room:quickCancel', () => game.cancelQuick(pid));
  handle('room:leave', () => game.leave(pid));
  handle('room:ready', (p) => game.setReady(pid, !!p.ready));
  handle('room:sync', () => game.sync(pid));
  handle('secret:set', (p) => { game.setSecret(pid, p.secret); return true; });
  handle('guess:submit', (p) => game.submitGuess(pid, p.guess, p.turnId));
  handle('rematch:vote', () => game.voteRematch(pid));

  game.reconnect(identity(socket));
  game.sync(pid);

  socket.on('disconnect', async () => {
    // only treat as a disconnect when no other tab of this player is still connected
    const left = await io.in(room(pid)).fetchSockets();
    if (left.length === 0) game.disconnect(pid);
  });
});

server.listen(PORT, () => console.log(`NEON DUEL server on http://localhost:${PORT}`));
