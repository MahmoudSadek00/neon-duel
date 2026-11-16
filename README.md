# NEON DUEL

A lightweight, premium-looking two-player secret number duel. Each player locks in a 3-digit code. Players take turns guessing, and the server says how many digits are in the exact right position. First to 3/3 wins.

**Stack:** React 18 · Vite · TypeScript · Framer Motion · custom CSS (no Tailwind, no 3D libraries) · Node · Express · Socket.IO.

## Run locally

```bash
npm install
npm run dev          # server on :3001 + Vite on :5173 (open http://localhost:5173)
```

To play against yourself, open a second browser (or a private window). In the same browser you can also open `http://localhost:5173/?p=2` to get a second identity.

## Production

```bash
npm run build        # type-check + build client into ./dist
npm start            # one process serves the game and the realtime server on $PORT (default 3001)
```

Or with Docker: `docker build -t neon-duel . && docker run -p 3001:3001 -v neon-data:/app/data neon-duel`.
`render.yaml` deploys the same container to Render, with a persistent disk for profiles.

The host must support WebSockets and a long-running Node process. That rules out static or serverless-only hosts; Render, Railway, Fly.io or any VPS work.

| Env var | Default | Purpose |
|---|---|---|
| `PORT` | 3001 | HTTP + WebSocket port |
| `DATA_DIR` | `./data` | where `profiles.json` (names, avatars, stats) is stored |
| `RECONNECT_MS` | 60000 | how long a disconnected player keeps their seat before forfeiting |
| `CORS_ORIGIN` | – | comma-separated origins, only needed if the client is hosted on a different domain |

## Tests

```bash
npm test             # rules, turn timeout, and a real multi-client Socket.IO match against a live server
npm start & npm run e2e   # two real browsers (desktop + iPhone) play a full match; screenshots → ./screenshots
```

## Architecture

- `shared/rules.ts`: validation and `evaluateGuess` (exact-position matches; repeated digits and leading zeros handled).
- `server/game.ts`: authoritative room and match engine. Secrets live only in server memory. Each player's state is built separately: it includes their own secret and never the opponent's until the match ends.
- `server/index.ts`: Express + Socket.IO, identity tokens, rate limiting, reconnects.
- `server/store.ts`: profile and statistics persistence (JSON file; replace these four functions to move to Supabase).
- `client/src`: React screens, components, Web Audio sound (synthesised, no audio files).
