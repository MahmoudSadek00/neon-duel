# NEON DUEL: Project Status

_Last updated: 16 Nov 2026. All six phases are complete._

## Phase 1: Visual interface ✅

- **Built:**
  - Neon/glass design system in custom CSS, with no framework.
  - Animated 2.5D background: a perspective grid floor, glow orbs, rising particles and drifting digits, all pure CSS.
  - Logo, menu, profile, how-to-play, settings, create/join/quick-match, lobby, secret, game and result screens.
- **Responsive:**
  - Desktop uses a three-column game layout.
  - Tablet uses a stacked layout.
  - Mobile has Play/History tabs and a compact "your secret" strip that is always visible.
- **Files:** `client/index.html`, `client/src/styles.css`, `client/src/App.tsx`, `client/src/main.tsx`, `client/src/components/*`, `client/src/screens/*`.

## Phase 2: Core game logic ✅

- **Evaluation:** `shared/rules.ts` counts digits that match in the exact same position. Repeats and leading zeros are handled.
- **Validation:** inputs must be exactly 3 digits. Names and avatars are sanitised.
- **History:** each player's guess history is recorded on the server. A timed-out turn is shown as a skipped turn and is not counted as an attempt.
- **Files:** `shared/rules.ts`, `shared/types.ts`, `server/game.ts`.

## Phase 3: Real multiplayer ✅

- **Authoritative server:** Express + Socket.IO (`server/index.ts`).
- **Identity:** each browser keeps a random 256-bit token, and the public player id is a hash of it.
- **Rooms:**
  - Private rooms use 5-character codes, an invite link and the share sheet.
  - A room holds exactly two players.
  - The match starts once both players have marked themselves ready.
- **Quick Match:** players are paired from a queue and skip the lobby.
- **Turns:**
  - The first player is chosen at random.
  - The server checks turn ownership and the turn id, so duplicate or late submissions are rejected.
  - The turn timer is configurable (30/45/60/90 s, default 45) and enforced on the server.
- **Privacy:** each player receives their own state, which contains only their own secret. Both secrets are revealed only after the match ends.
- **Disconnects:**
  - A disconnected player keeps their seat and can reconnect (reload or new tab) within 60 s.
  - After that, the opponent wins by forfeit.
  - Leaving mid-match also counts as a forfeit.
- **Win, rematch and stats:**
  - The match ends on 3/3: timers stop, further guesses are blocked, both secrets and attempt counts are shown.
  - Players can vote for a rematch.
  - Stats are persisted to `data/profiles.json` (`server/store.ts`): played, wins, losses, total guesses and the last 12 matches.
- **Rate limit:** 15 actions per 3 s per socket.

## Phase 4: Animation and sound ✅

- **Animation:** Framer Motion page transitions, 3D digit flips, a scan sweep on submit, animated feedback (0–3/3), turn banner transitions, timer ring, history entries sliding in, and a victory screen with light rays and confetti.
- **Sound:** all audio is synthesised with Web Audio (no audio files):
  - Effects for clicks, digits, submit, lock, feedback, turn change, last-5-second countdown ticks, join, victory and defeat.
  - A low-CPU ambient pad that pauses while the tab is hidden.
- **Settings:** master, effects and music volume, mute all, and motion (Auto / Full / Reduced, following the `prefers-reduced-motion` setting).

## Phase 5: Testing ✅

- `npm run build`: TypeScript strict type-check plus production build. Passes.
- `npm test`: 10 tests pass.
  - Rule examples, repeated digits, leading zeros.
  - Turn timeout using mock timers.
  - A full match between two real Socket.IO clients against a live server:
    - Secrets never reach the opponent before the match ends.
    - Out-of-turn, invalid, duplicate and post-win guesses are rejected.
    - Third player rejected, stats recorded, rematch works.
  - Quick match, reconnect, forfeit on a long disconnect, and invalid tokens refused.
- `npm run e2e`: two real Chromium browsers, one desktop and one iPhone-sized, play a whole match through the UI:
  - profile → create room → join → ready → secrets → turns → victory/defeat → rematch.
  - The run finishes with no console errors. Screenshots are saved in `screenshots/`.

## Phase 6: Deployment prep ✅

- **Single process:** `npm run build && npm start` serves the client and the realtime server on one port (`PORT`).
- **Hosting files:** a `Dockerfile` (multi-stage, data volume) and `render.yaml` (Render with a persistent disk).
- **Health check:** `GET /health`.
- **Assets:** fonts are self-hosted (`@fontsource`), with no third-party requests. The JS bundle is about 109 KB gzipped.

## Known issues / notes

- **Spec example corrected:** the brief listed secret 263 / guess 469 as 0 correct. Under the exact-position rule the 6 matches, so the game returns 1. The How to Play example now uses 491 → 0 instead.
- **Profiles are per browser:** they are tied to a browser token and there is no password login. Clearing site data creates a new profile.
- **Persistence:** stats are stored in a JSON file, which is fine for a single server. For multiple server instances, move `server/store.ts` to Supabase/Postgres and add the Socket.IO Redis adapter.
- **Server restarts:** active rooms live in memory, so a server restart ends matches in progress. Profiles and stats are kept.

## Next steps

1. Deploy, for example to Render using `render.yaml`, and share the URL.
2. Optional: Supabase accounts so profiles work across devices, plus a global leaderboard.
3. Optional: a deduction helper that lets players mark which digits they've ruled out, a spectator link, and PWA install.
