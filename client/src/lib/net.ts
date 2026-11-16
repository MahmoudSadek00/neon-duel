import { io, type Socket } from 'socket.io-client';

const TOKEN_KEY = 'neonduel.token';

function safeGet(k: string) { try { return localStorage.getItem(k); } catch { return null; } }
function safeSet(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* private mode */ } }

function makeToken() {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

/** Per-browser identity token. `?p=<name>` lets you open a second identity in the same browser for testing. */
function token() {
  const alt = new URLSearchParams(location.search).get('p');
  const key = alt ? `${TOKEN_KEY}.${alt}` : TOKEN_KEY;
  let t = safeGet(key);
  if (!t || !/^[a-f0-9]{64}$/.test(t)) { t = makeToken(); safeSet(key, t); }
  return t;
}

export const socket: Socket = io({
  auth: { token: token() },
  transports: ['websocket', 'polling'],
  reconnectionDelay: 500,
  reconnectionDelayMax: 3000,
});

export async function call<T = unknown>(event: string, payload: Record<string, unknown> = {}): Promise<T> {
  return new Promise((resolve, reject) => {
    if (!socket.connected) return reject(new Error('Not connected to the server. Reconnecting…'));
    socket.timeout(8000).emit(event, payload, (err: Error | null, res: { ok: boolean; data?: T; error?: string }) => {
      if (err) return reject(new Error('The server did not respond. Please try again.'));
      if (res?.ok) resolve(res.data as T);
      else reject(new Error(res?.error || 'Something went wrong.'));
    });
  });
}
