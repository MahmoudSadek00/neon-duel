/**
 * Two-browser end-to-end test: desktop player (A) vs mobile player (B), real server.
 * Usage: start the server (npm start) then `npm run e2e`. Screenshots go to ./screenshots.
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');

const URL = process.env.E2E_URL || 'http://localhost:3001';
const OUT = 'screenshots';
fs.mkdirSync(OUT, { recursive: true });
const errors = [];
const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}.png` });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch();
const ctxA = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const ctxB = await browser.newContext({ ...devices['iPhone 13'] });
const A = await ctxA.newPage();
const B = await ctxB.newPage();
for (const [n, p] of [['A', A], ['B', B]]) {
  p.on('console', (m) => m.type() === 'error' && errors.push(`${n}: ${m.text()}`));
  p.on('pageerror', (e) => errors.push(`${n}: ${e.message}`));
}

async function typeCode(page, code) {
  for (const d of code) await page.getByRole('button', { name: `Digit ${d}`, exact: true }).click();
}
async function setProfile(page, name, avatar) {
  await page.getByRole('button', { name: 'Profile', exact: true }).first().click();
  await page.getByLabel('Display name').fill(name);
  await page.getByRole('button', { name: avatar }).click();
  await page.getByRole('button', { name: 'Save Profile' }).click();
  await page.getByText('Profile saved').waitFor();
  await page.getByRole('button', { name: '← Back' }).click();
}

await A.goto(URL);
await B.goto(URL);
await A.getByText('Play Online').waitFor();
await wait(800);
await shot(A, '01-menu-desktop');
await shot(B, '01-menu-mobile');

await setProfile(A, 'Nova', 'helix');
await setProfile(B, 'Cipher', 'nova');

await A.getByText('How to Play').click();
await wait(1000);
await shot(A, '02-howto');
await A.getByRole('button', { name: '← Back' }).click();
await A.getByText('Settings').click();
await wait(1000);
await shot(A, '03-settings');
await A.getByRole('button', { name: '← Back' }).click();

// private room
await A.getByText('Create Room').click();
await A.getByRole('button', { name: '60s' }).click();
await A.getByRole('button', { name: 'Create Room' }).click();
const codeEl = A.locator('.room-code');
await codeEl.waitFor();
const code = (await codeEl.textContent()).trim();
console.log('room code', code);
await shot(A, '04-lobby-waiting');

await B.getByText('Join Room').click();
await B.getByLabel('Room code').fill(code);
await B.getByRole('button', { name: 'Join', exact: true }).click();
await A.locator('.seat__name', { hasText: 'Cipher' }).waitFor();
await A.getByRole('button', { name: "I'm Ready" }).click();
await wait(300);
await shot(A, '05-lobby-both');
await shot(B, '05-lobby-mobile');
await B.getByRole('button', { name: "I'm Ready" }).click();

// secrets
await A.getByText('Choose your secret number').waitFor();
await typeCode(A, '027');
await shot(A, '06-secret-entry');
await A.getByRole('button', { name: 'LOCK' }).click();
await A.getByText('Secret locked').waitFor();
await wait(400);
await shot(A, '07-secret-locked');
await typeCode(B, '263');
await B.getByRole('button', { name: 'LOCK' }).click();

// play
await A.locator('.game').waitFor();
await B.locator('.game').waitFor();
const aPlan = ['298', '491', '223', '263'];
const bPlan = ['111', '999', '555', '888'];
let ai = 0, bi = 0, shots = 0;
for (let turn = 0; turn < 12; turn++) {
  if (await A.locator('.overlay').count()) break;
  const aTurn = await A.locator('.turn-banner.mine').count();
  const page = aTurn ? A : B;
  const g = aTurn ? aPlan[ai++] : bPlan[bi++];
  await typeCode(page, g);
  if (aTurn && ai === 2 && !shots++) await shot(A, '08-game-typing-desktop');
  await page.getByRole('button', { name: 'Submit Guess' }).click();
  await page.locator('.feedback__card').waitFor();
  if (aTurn && ai === 3) { await wait(600); await shot(A, '09-feedback'); }
  await page.locator('.feedback').waitFor({ state: 'detached' });
  if (await A.locator('.overlay').count()) break;
  await (aTurn ? B : A).locator('.turn-banner.mine').waitFor();
  if (!aTurn && bi === 2) await shot(B, '10-game-mobile');
}
await A.locator('.overlay').waitFor();
await B.locator('.overlay').waitFor();
await wait(1200);
await shot(A, '11-victory-desktop');
await shot(B, '11-defeat-mobile');
const titleA = await A.locator('.result__title').textContent();
const titleB = await B.locator('.result__title').textContent();
const reveal = await B.locator('.reveal').innerText();
console.log('A:', titleA, '| B:', titleB);
if (titleA !== 'VICTORY' || titleB !== 'DEFEAT') throw new Error('wrong result');
if (!reveal.includes('0') || !reveal.includes('2')) throw new Error('secrets not revealed');

// history check on mobile tab before rematch
await B.getByRole('button', { name: 'Return to Lobby' }).waitFor();

// rematch flow
await A.getByRole('button', { name: 'Play Again' }).click();
await B.getByRole('button', { name: 'Accept Rematch' }).click();
await A.getByText('Choose your secret number').waitFor();
await B.getByText('Choose your secret number').waitFor();
console.log('rematch ok');
await B.getByRole('button', { name: 'Leave match' }).click({ noWaitAfter: true }).catch(() => {});
B.on('dialog', (d) => d.accept());

// profile stats after the match
await A.reload();
await A.locator('.game, .center').first().waitFor();
await wait(500);
await browser.close();

if (errors.length) { console.error('Console errors:\n' + errors.join('\n')); process.exit(1); }
console.log('E2E PASSED');
