import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateGuess, normalizeCode, cleanName } from '../shared/rules';

test('spec examples (secret 263)', () => {
  assert.equal(evaluateGuess('263', '298'), 1);
  // NB: the brief listed 469 → 0, but its 6 sits in the same position as 263's 6, so the exact-position rule gives 1.
  assert.equal(evaluateGuess('263', '469'), 1);
  assert.equal(evaluateGuess('263', '491'), 0);
  assert.equal(evaluateGuess('263', '223'), 2);
  assert.equal(evaluateGuess('263', '263'), 3);
});

test('repeated digits are positional only', () => {
  assert.equal(evaluateGuess('112', '121'), 1);
  assert.equal(evaluateGuess('777', '707'), 2);
  assert.equal(evaluateGuess('777', '777'), 3);
  assert.equal(evaluateGuess('122', '222'), 2);
  assert.equal(evaluateGuess('005', '500'), 1);
});

test('leading zeros are preserved and validated', () => {
  assert.equal(normalizeCode('027'), '027');
  assert.equal(normalizeCode('005'), '005');
  assert.equal(evaluateGuess('027', '027'), 3);
  for (const bad of ['27', '0277', 'abc', '1 2', '', null, undefined, 12, '-12', '1.5']) assert.equal(normalizeCode(bad as any), null, String(bad));
  assert.equal(normalizeCode(123), '123');
});

test('names are cleaned', () => {
  assert.equal(cleanName('  <b>Neo</b> '), 'bNeo/b');
  assert.equal(cleanName(''), 'Player');
  assert.equal(cleanName('x'.repeat(40)).length, 16);
});
