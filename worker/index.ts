/**
 * Cloudflare Worker entry: `/ws` goes to the GameHub Durable Object, everything else is the built React app.
 */
import type { Env } from './hub';
export { GameHub } from './hub';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/ws') {
      const hub = env.GAME_HUB.get(env.GAME_HUB.idFromName('global'));
      return hub.fetch(request);
    }
    if (url.pathname === '/health') return Response.json({ ok: true });
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
