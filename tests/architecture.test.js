// Layering rule (AGENTS.md): game logic must run without the graphics library / window, so the headless contract works.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const LOGIC = [...readdirSync('src/core').map(f => `src/core/${f}`), 'src/headless.js'];
const FORBIDDEN = [/from\s+['"]three['"]/, /from\s+['"][^'"]*web\//, /\bwindow\./, /\bdocument\./, /requestAnimationFrame/, /localStorage/,
  /Math\.random\s*\(/, /Date\.now\s*\(/, /performance\.now\s*\(/, /setTimeout\s*\(/, /setInterval\s*\(/];

test('logic layer (src/core, src/headless.js) never touches graphics, DOM, wall clock or unseeded randomness', () => {
  for (const f of LOGIC) {
    const code = readFileSync(f, 'utf8').split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
    for (const re of FORBIDDEN) assert.ok(!re.test(code), `${f} violates layering: ${re}`);
  }
});

test('render layer drives logic only through createSim/createCampaign + step() and owns no scoring rule', () => {
  const web = readFileSync('src/web/main.js', 'utf8');
  assert.ok(/sim\.step\(/.test(web));
  assert.ok(!/wonScores\s*(\[|=[^=])/.test(web), 'UI must not own the won-scores table: campaign/total-score rule lives in src/core (createCampaign)');
  assert.ok(/campaign\.finishNight\(/.test(web) && /campaign\.total\(/.test(web));
});

test('no copyrighted/external audio is referenced by the game', () => {
  for (const f of ['src/web/audio.js', 'src/web/main.js', 'server.js']) assert.ok(!/\.mp3/i.test(readFileSync(f, 'utf8')), `${f} references an mp3`);
});
