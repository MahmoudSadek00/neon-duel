# NEON DUEL

A lightweight, premium-looking two-player secret number duel. Each player locks in a 3-digit code. Players take turns guessing, and the server says how many digits are in the exact right position. First to 3/3 wins.

**Stack:** React 18 · Vite · TypeScript · Framer Motion · custom CSS · **Cloudflare Workers + Durable Objects** (native WebSockets, free plan).

## Run locally

```bash
npm install
npm run dev          # Worker on :8787 + Vite on :5173 → open http://localhost:5173
```

Open a second browser (or a private window) to play against yourself, or use `http://localhost:5173/?p=2` for a second identity in the same browser.

## Deploy to Cloudflare (free)

**Option A: from GitHub (automatic).** In the Cloudflare dashboard, go to **Workers & Pages → Create → Import a repository** and pick this repo. Use:

- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`

Every push to `main` redeploys.

**Option B: from your computer.** Run `npx wrangler login` once, then `npm run deploy`.

Either way you get `https://neon-duel.<your-subdomain>.workers.dev`.

## Tests

```bash
npm test                              # rules, turn timeout, and a real multi-client match against `wrangler dev`
npm run preview & E2E_URL=http://localhost:8787 npm run e2e   # two real browsers play a full match
```

## Architecture

- `shared/rules.ts`: validation and `evaluateGuess` (exact-position matches; repeated digits and leading zeros handled).
- `server/game.ts`: authoritative room and match engine. Secrets live only on the server, and each player's state includes their own secret only, never the opponent's, until the match ends.
- `server/profiles.ts`: profiles and statistics.
- `worker/hub.ts`: the `GameHub` Durable Object. It holds the engine, the WebSocket connections and the identity tokens, with rate limiting, and saves profiles in Durable Object storage.
- `worker/index.ts`: routes `/ws` to the hub and serves the built React app.
- `client/src`: React screens, a tiny WebSocket client with acknowledgements and auto-reconnect, and synthesised Web Audio.
