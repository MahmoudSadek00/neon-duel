/**
 * Authoritative room + match engine. Pure Node (no socket.io import) so it can be unit-tested.
 * Secrets live only inside Room.secrets and are never copied into per-player state
 * except a player's OWN secret, or both secrets after the match has finished.
 */
import { DEFAULT_TURN_SECONDS, TURN_SECONDS_OPTIONS, evaluateGuess, normalizeCode, type AvatarId } from '../shared/rules';
import type { ClientRoomState, GuessEntry, Phase, PublicPlayer } from '../shared/types';
import type { RecentMatch } from '../shared/types';

export interface Identity { id: string; name: string; avatar: AvatarId }

interface Slot extends Identity { connected: boolean; ready: boolean; wantsRematch: boolean }

interface Room {
  code: string;
  isPrivate: boolean;
  hostId: string;
  turnSeconds: number;
  phase: Phase;
  round: number;
  players: Slot[];
  secrets: Map<string, string>;
  guesses: Map<string, GuessEntry[]>;
  turnPlayerId: string | null;
  turnId: number;
  turnEndsAt: number | null;
  turnTimer: ReturnType<typeof setTimeout> | null;
  dropTimers: Map<string, ReturnType<typeof setTimeout>>;
  result: ClientRoomState['result'];
}

export interface Emitter {
  state(playerId: string, state: ClientRoomState | null): void;
  event(playerId: string, name: string, payload: unknown): void;
}

export class GameError extends Error {}
const fail = (msg: string): never => { throw new GameError(msg); };

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const GRACE_MS = 1200; // network grace after the visible deadline

export class GameManager {
  rooms = new Map<string, Room>();
  playerRoom = new Map<string, string>();
  queue: Identity[] = [];

  constructor(
    private emit: Emitter,
    private opts: { reconnectMs: number; recordMatch?: (id: string, won: boolean, attempts: number, entry: RecentMatch) => void } = { reconnectMs: 60_000 },
  ) {}

  /* ----------------------------------------------------------------- helpers */
  private newCode() {
    let code = '';
    do {
      code = Array.from(crypto.getRandomValues(new Uint8Array(5)), (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
    } while (this.rooms.has(code));
    return code;
  }
  private roomOf(playerId: string) {
    const code = this.playerRoom.get(playerId);
    return code ? this.rooms.get(code) ?? null : null;
  }
  private requireRoom(playerId: string) {
    return this.roomOf(playerId) ?? fail('You are not in a room.');
  }
  private slot(room: Room, id: string) { return room.players.find((p) => p.id === id); }
  private other(room: Room, id: string) { return room.players.find((p) => p.id !== id) ?? null; }

  private publicPlayer(room: Room, s: Slot): PublicPlayer {
    const g = room.guesses.get(s.id) ?? [];
    const real = g.filter((e) => e.guess !== null);
    return {
      id: s.id, name: s.name, avatar: s.avatar, connected: s.connected, ready: s.ready,
      secretLocked: room.secrets.has(s.id),
      attempts: real.length,
      bestResult: real.reduce((m, e) => Math.max(m, e.correct), 0),
      lastResult: real.length ? real[real.length - 1].correct : null,
      wantsRematch: s.wantsRematch,
    };
  }

  stateFor(room: Room, viewerId: string): ClientRoomState {
    const me = this.slot(room, viewerId)!;
    const opp = this.other(room, viewerId);
    return {
      code: room.code, isPrivate: room.isPrivate, phase: room.phase, turnSeconds: room.turnSeconds,
      hostId: room.hostId, round: room.round,
      you: this.publicPlayer(room, me),
      opponent: opp ? this.publicPlayer(room, opp) : null,
      yourSecret: room.secrets.get(viewerId) ?? null,
      yourGuesses: [...(room.guesses.get(viewerId) ?? [])],
      turnPlayerId: room.turnPlayerId, turnId: room.turnId, turnEndsAt: room.turnEndsAt,
      serverNow: Date.now(),
      result: room.result,
    };
  }

  private broadcast(room: Room) {
    for (const p of room.players) this.emit.state(p.id, this.stateFor(room, p.id));
  }

  /* --------------------------------------------------------- room lifecycle */
  createRoom(who: Identity, turnSeconds?: number) {
    this.leave(who.id);
    const ts = (TURN_SECONDS_OPTIONS as readonly number[]).includes(turnSeconds as number) ? turnSeconds! : DEFAULT_TURN_SECONDS;
    const room = this.makeRoom(true, who.id, ts);
    this.addPlayer(room, who);
    this.broadcast(room);
    return room.code;
  }

  private makeRoom(isPrivate: boolean, hostId: string, turnSeconds: number): Room {
    const room: Room = {
      code: this.newCode(), isPrivate, hostId, turnSeconds, phase: 'lobby', round: 1, players: [],
      secrets: new Map(), guesses: new Map(), turnPlayerId: null, turnId: 0, turnEndsAt: null,
      turnTimer: null, dropTimers: new Map(), result: null,
    };
    this.rooms.set(room.code, room);
    return room;
  }

  private addPlayer(room: Room, who: Identity) {
    room.players.push({ ...who, connected: true, ready: false, wantsRematch: false });
    room.guesses.set(who.id, []);
    this.playerRoom.set(who.id, room.code);
  }

  joinRoom(who: Identity, rawCode: unknown) {
    const code = String(rawCode ?? '').trim().toUpperCase();
    const room = this.rooms.get(code) ?? fail('Room not found. Check the code and try again.');
    if (this.slot(room, who.id)) { this.reconnect(who); return code; }
    if (!room.isPrivate) fail('That room is not open for joining.');
    if (room.players.length >= 2) fail('This room already has two players.');
    if (room.phase !== 'lobby') fail('This match has already started.');
    this.leave(who.id);
    this.addPlayer(room, who);
    this.broadcast(room);
    return code;
  }

  quickMatch(who: Identity): 'waiting' | 'matched' {
    this.leave(who.id);
    this.queue = this.queue.filter((q) => q.id !== who.id);
    const partner = this.queue.shift();
    if (!partner) {
      this.queue.push(who);
      return 'waiting';
    }
    const room = this.makeRoom(false, partner.id, DEFAULT_TURN_SECONDS);
    this.addPlayer(room, partner);
    this.addPlayer(room, who);
    room.players.forEach((p) => (p.ready = true));
    room.phase = 'secret';
    this.broadcast(room);
    return 'matched';
  }

  cancelQuick(playerId: string) {
    this.queue = this.queue.filter((q) => q.id !== playerId);
  }

  setReady(playerId: string, ready: boolean) {
    const room = this.requireRoom(playerId);
    if (room.phase !== 'lobby') fail('The match has already started.');
    this.slot(room, playerId)!.ready = !!ready;
    if (room.players.length === 2 && room.players.every((p) => p.ready)) room.phase = 'secret';
    this.broadcast(room);
  }

  updateIdentity(who: Identity) {
    const room = this.roomOf(who.id);
    const s = room && this.slot(room, who.id);
    if (room && s) { s.name = who.name; s.avatar = who.avatar; this.broadcast(room); }
    const q = this.queue.find((x) => x.id === who.id);
    if (q) Object.assign(q, who);
  }

  /* ------------------------------------------------------------- the match */
  setSecret(playerId: string, raw: unknown) {
    const room = this.requireRoom(playerId);
    if (room.phase !== 'secret') fail('You cannot choose a secret number right now.');
    if (room.secrets.has(playerId)) fail('Your secret number is already locked.');
    const secret = normalizeCode(raw) ?? fail('Your secret must be exactly 3 digits (0-9).');
    room.secrets.set(playerId, secret);
    if (room.players.length === 2 && room.players.every((p) => room.secrets.has(p.id))) {
      room.phase = 'playing';
      const first = room.players[crypto.getRandomValues(new Uint32Array(1))[0] % 2].id;
      this.startTurn(room, first);
      for (const p of room.players) this.emit.event(p.id, 'match:start', { firstPlayerId: first });
    }
    this.broadcast(room);
  }

  private startTurn(room: Room, playerId: string) {
    if (room.turnTimer) clearTimeout(room.turnTimer);
    room.turnPlayerId = playerId;
    room.turnId++;
    room.turnEndsAt = Date.now() + room.turnSeconds * 1000;
    const turnId = room.turnId;
    room.turnTimer = setTimeout(() => this.timeout(room.code, turnId), room.turnSeconds * 1000 + GRACE_MS);
  }

  private timeout(code: string, turnId: number) {
    const room = this.rooms.get(code);
    if (!room || room.phase !== 'playing' || room.turnId !== turnId || !room.turnPlayerId) return;
    const pid = room.turnPlayerId;
    const list = room.guesses.get(pid)!;
    list.push({ attempt: list.length + 1, guess: null, correct: 0, at: Date.now() });
    this.emit.event(pid, 'turn:timeout', {});
    this.startTurn(room, this.other(room, pid)!.id);
    this.broadcast(room);
  }

  submitGuess(playerId: string, raw: unknown, turnId: unknown) {
    const room = this.requireRoom(playerId);
    if (room.phase !== 'playing') fail('The match is not in progress.');
    if (room.turnPlayerId !== playerId) fail('It is not your turn.');
    if (turnId !== room.turnId) fail('That turn has already ended.');
    if (room.turnEndsAt && Date.now() > room.turnEndsAt + GRACE_MS) fail('Time is up for this turn.');
    const guess = normalizeCode(raw) ?? fail('A guess must be exactly 3 digits (0-9).');
    const opp = this.other(room, playerId)!;
    const correct = evaluateGuess(room.secrets.get(opp.id)!, guess);
    const list = room.guesses.get(playerId)!;
    const entry: GuessEntry = { attempt: list.length + 1, guess, correct, at: Date.now() };
    list.push(entry);
    this.emit.event(playerId, 'guess:result', entry);
    this.emit.event(opp.id, 'opponent:guessed', { correct });
    if (correct === 3) this.finish(room, playerId, 'solved');
    else { this.startTurn(room, opp.id); this.broadcast(room); }
    return entry;
  }

  private finish(room: Room, winnerId: string | null, reason: 'solved' | 'forfeit' | 'left') {
    const wasPlaying = room.phase === 'playing';
    if (room.turnTimer) clearTimeout(room.turnTimer);
    room.turnTimer = null;
    room.turnEndsAt = null;
    room.turnPlayerId = null;
    room.phase = 'finished';
    const attempts: Record<string, number> = {};
    for (const p of room.players) attempts[p.id] = (room.guesses.get(p.id) ?? []).filter((g) => g.guess !== null).length;
    room.result = { winnerId, reason, secrets: Object.fromEntries(room.secrets), attempts };
    room.players.forEach((p) => (p.wantsRematch = false));
    if (wasPlaying && room.players.length === 2) {
      const [a, b] = room.players;
      for (const [me, them] of [[a, b], [b, a]] as const) {
        this.opts.recordMatch?.(me.id, winnerId === me.id, attempts[me.id], {
          at: Date.now(), opponent: them.name, opponentAvatar: them.avatar, won: winnerId === me.id, attempts: attempts[me.id], reason,
        });
      }
    }
    for (const p of room.players) this.emit.event(p.id, 'match:end', room.result);
    this.broadcast(room);
  }

  voteRematch(playerId: string) {
    const room = this.requireRoom(playerId);
    if (room.phase !== 'finished') fail('The match has not finished yet.');
    if (room.players.length < 2) fail('Your opponent has left the room.');
    this.slot(room, playerId)!.wantsRematch = true;
    if (room.players.every((p) => p.wantsRematch)) {
      room.round++;
      room.phase = 'secret';
      room.secrets.clear();
      room.players.forEach((p) => { room.guesses.set(p.id, []); p.wantsRematch = false; });
      room.result = null;
      room.turnId++;
    }
    this.broadcast(room);
  }

  /* ------------------------------------------------ leaving / connectivity */
  leave(playerId: string) {
    this.cancelQuick(playerId);
    const room = this.roomOf(playerId);
    if (!room) return;
    const opp = this.other(room, playerId);
    if ((room.phase === 'playing' || room.phase === 'secret') && opp) this.finish(room, opp.id, 'left');
    room.players = room.players.filter((p) => p.id !== playerId);
    const t = room.dropTimers.get(playerId);
    if (t) clearTimeout(t);
    room.dropTimers.delete(playerId);
    this.playerRoom.delete(playerId);
    this.emit.state(playerId, null);
    if (room.players.length === 0) return this.destroy(room);
    if (room.phase === 'lobby') room.players.forEach((p) => (p.ready = false));
    if (room.hostId === playerId) room.hostId = room.players[0].id;
    this.broadcast(room);
  }

  private destroy(room: Room) {
    if (room.turnTimer) clearTimeout(room.turnTimer);
    room.dropTimers.forEach(clearTimeout);
    for (const p of room.players) this.playerRoom.delete(p.id);
    this.rooms.delete(room.code);
  }

  disconnect(playerId: string) {
    this.cancelQuick(playerId);
    const room = this.roomOf(playerId);
    const s = room && this.slot(room, playerId);
    if (!room || !s) return;
    s.connected = false;
    this.broadcast(room);
    room.dropTimers.set(playerId, setTimeout(() => {
      room.dropTimers.delete(playerId);
      if (!s.connected) this.leave(playerId);
    }, this.opts.reconnectMs));
  }

  /** Re-attach a returning player to their room; returns true if they were in one. */
  reconnect(who: Identity) {
    const room = this.roomOf(who.id);
    const s = room && this.slot(room, who.id);
    if (!room || !s) return false;
    s.connected = true;
    const t = room.dropTimers.get(who.id);
    if (t) clearTimeout(t);
    room.dropTimers.delete(who.id);
    this.broadcast(room);
    return true;
  }

  sync(playerId: string) {
    const room = this.roomOf(playerId);
    this.emit.state(playerId, room ? this.stateFor(room, playerId) : null);
  }
}
