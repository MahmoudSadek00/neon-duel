import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'nd-g-'));
const { GameManager } = await import('../server/game');

test('a turn that runs out of time is skipped and recorded', () => {
  mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const states = new Map<string, any>();
  const gm = new GameManager({ state: (id, s) => states.set(id, s), event: () => {} });
  const A = { id: 'a', name: 'A', avatar: 'prism' as const };
  const B = { id: 'b', name: 'B', avatar: 'nova' as const };
  const code = gm.createRoom(A, 30);
  gm.joinRoom(B, code);
  gm.setReady('a', true);
  gm.setReady('b', true);
  gm.setSecret('a', '123');
  gm.setSecret('b', '456');
  const first = states.get('a').turnPlayerId as string;
  const second = first === 'a' ? 'b' : 'a';
  const turnId = states.get('a').turnId;

  mock.timers.tick(29_000);
  assert.equal(states.get('a').turnPlayerId, first, 'still the same turn before the deadline');
  mock.timers.tick(3_000);
  const s = states.get(first);
  assert.equal(s.turnPlayerId, second, 'turn passed to the other player');
  assert.equal(s.yourGuesses.length, 1);
  assert.equal(s.yourGuesses[0].guess, null, 'timeout recorded as a skipped turn');
  assert.equal(s.you.attempts, 0, 'timeouts do not count as attempts');
  assert.throws(() => gm.submitGuess(first, '111', turnId), /not your turn/);
  mock.timers.reset();
});
