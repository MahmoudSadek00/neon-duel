/**
 * Tiny realtime client over a native WebSocket (works on Cloudflare Workers / Durable Objects).
 * Exposes a socket.io-like surface: socket.connected, socket.on/off(event), call(event, payload) with acks.
 */
const TOKEN_KEY = 'neonduel.token';

function safeGet(k: string) { try { return localStorage.getItem(k); } catch { return null; } }
function safeSet(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* private mode */ } }

function makeToken() {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

/** Per-browser identity token. `?p=<name>` gives a second identity in the same browser for testing. */
function token() {
  const alt = new URLSearchParams(location.search).get('p');
  const key = alt ? `${TOKEN_KEY}.${alt}` : TOKEN_KEY;
  let t = safeGet(key);
  if (!t || !/^[a-f0-9]{64}$/.test(t)) { t = makeToken(); safeSet(key, t); }
  return t;
}

type Handler = (payload: any) => void;
type Pending = { resolve: (v: any) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> };

class RealtimeSocket {
  connected = false;
  private ws: WebSocket | null = null;
  private handlers = new Map<string, Set<Handler>>();
  private pending = new Map<number, Pending>();
  private seq = 0;
  private retry = 0;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private readonly url: string;

  constructor() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.url = `${proto}//${location.host}/ws?token=${token()}`;
    this.open();
    // reconnect quickly when the tab comes back or the network returns
    window.addEventListener('online', () => this.kick());
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.kick(); });
  }

  on(ev: string, fn: Handler) {
    if (!this.handlers.has(ev)) this.handlers.set(ev, new Set());
    this.handlers.get(ev)!.add(fn);
    return this;
  }
  off(ev: string, fn: Handler) { this.handlers.get(ev)?.delete(fn); return this; }
  private fire(ev: string, p?: unknown) { this.handlers.get(ev)?.forEach((fn) => fn(p)); }

  private kick() {
    if (!this.ws || this.ws.readyState === WebSocket.CLOSED) { this.retry = 0; this.open(); }
  }

  private open() {
    const ws = new WebSocket(this.url);
    this.ws = ws;
    ws.onmessage = (e) => {
      let m: any;
      try { m = JSON.parse(e.data); } catch { return; }
      if (m.t === 'ack') {
        const p = this.pending.get(m.id);
        if (!p) return;
        clearTimeout(p.timer);
        this.pending.delete(m.id);
        if (m.ok) p.resolve(m.data); else p.reject(new Error(m.error || 'Something went wrong.'));
      } else if (m.t === 'ev') {
        if (m.ev === 'hello') {
          this.connected = true;
          this.retry = 0;
          this.fire('connect');
        } else this.fire(m.ev, m.p);
      }
    };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      const was = this.connected;
      this.connected = false;
      if (this.pingTimer) clearInterval(this.pingTimer);
      this.pending.forEach((p) => { clearTimeout(p.timer); p.reject(new Error('Connection lost. Reconnecting…')); });
      this.pending.clear();
      if (was) this.fire('disconnect');
      const delay = Math.min(3000, 400 * 2 ** this.retry++);
      setTimeout(() => { if (this.ws === ws) this.open(); }, delay);
    };
    ws.onopen = () => {
      if (this.pingTimer) clearInterval(this.pingTimer);
      this.pingTimer = setInterval(() => { try { ws.send('{"t":"ping"}'); } catch { /* closed */ } }, 25_000);
    };
  }

  request<T>(ev: string, p: Record<string, unknown>): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.connected || !this.ws) return reject(new Error('Not connected to the server. Reconnecting…'));
      const id = ++this.seq;
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error('The server did not respond. Please try again.')); }, 8000);
      this.pending.set(id, { resolve, reject, timer });
      this.ws.send(JSON.stringify({ t: 'call', id, ev, p }));
    });
  }
}

export const socket = new RealtimeSocket();

export function call<T = unknown>(event: string, payload: Record<string, unknown> = {}): Promise<T> {
  return socket.request<T>(event, payload);
}
