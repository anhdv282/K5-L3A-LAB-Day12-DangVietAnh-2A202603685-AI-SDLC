// Local server (no extra deps): serves the game and stores the leaderboard on disk.
//   node server.js                                  -> http://localhost:5173
//   node server.js --export-leaderboard out.json    -> writes {"entries":[...]} and exits
// Leaderboard file: data/leaderboard.json (override with env DDL_LEADERBOARD).
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { readFileSync, writeFileSync, mkdirSync, renameSync, existsSync } from 'node:fs';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { addEntry, sortEntries, isoLocal } from './src/core/leaderboard.js';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const LB_FILE = process.env.DDL_LEADERBOARD || join(ROOT, 'data', 'leaderboard.json');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png' };

function loadBoard() {
  try { const j = JSON.parse(readFileSync(LB_FILE, 'utf8')); return sortEntries(Array.isArray(j.entries) ? j.entries : []); }
  catch { return []; }
}
function saveBoard(entries) {   // atomic write: temp file + rename
  mkdirSync(dirname(LB_FILE), { recursive: true });
  const tmp = `${LB_FILE}.tmp`;
  writeFileSync(tmp, JSON.stringify({ entries }, null, 2) + '\n');
  renameSync(tmp, LB_FILE);
}

const ei = process.argv.indexOf('--export-leaderboard');
if (ei > 0) {
  const out = process.argv[ei + 1];
  if (!out) { console.error('usage: node server.js --export-leaderboard out.json'); process.exit(2); }
  writeFileSync(out, JSON.stringify({ entries: loadBoard() }, null, 2) + '\n');
  console.log(`exported ${loadBoard().length} entries to ${out}`);
  process.exit(0);
}

const PORT = Number(process.env.PORT) || 5173;
const json = (res, code, body) => res.writeHead(code, { 'Content-Type': 'application/json' }).end(JSON.stringify(body));
createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/leaderboard') {
    if (req.method === 'GET') return json(res, 200, { entries: loadBoard() });
    if (req.method === 'POST') {
      let body = ''; for await (const c of req) { body += c; if (body.length > 10_000) return json(res, 413, { error: 'too large' }); }
      try {
        const b = JSON.parse(body);
        const entries = addEntry(loadBoard(), { name: b.name, score: b.score, nights_won: b.nights_won, seed: b.seed, achieved_at: isoLocal(new Date()) });
        saveBoard(entries);
        return json(res, 200, { entries });
      } catch (e) { return json(res, 400, { error: String(e.message || e) }); }
    }
    return json(res, 405, { error: 'method not allowed' });
  }
  let p = decodeURIComponent(url.pathname);
  if (p === '/') p = '/src/web/index.html';
  const f = normalize(join(ROOT, p));
  if (!f.startsWith(ROOT) || f.startsWith(join(ROOT, 'data'))) { res.writeHead(403).end(); return; }
  try { const b = await readFile(f); res.writeHead(200, { 'Content-Type': TYPES[extname(f)] || 'application/octet-stream' }).end(b); }
  catch { res.writeHead(404).end('not found'); }
}).listen(PORT, () => console.log(`Đảo Đèn Lồng: http://localhost:${PORT}${existsSync(LB_FILE) ? '' : '  (leaderboard: new file will be created)'}`));
