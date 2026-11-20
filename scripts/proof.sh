#!/usr/bin/env bash
# Regenerate Phase-1 proof from the current code. Output is never hand-edited.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=docs/proof/phase1; mkdir -p "$OUT"
npm test 2>&1 | tail -9 > "$OUT/test-report.txt"
for f in scenarios/*.json; do n=$(basename "$f" .json); node src/headless.js --scenario "$f" > "$OUT/$n.json"; done
# determinism: two runs of the same input must be byte-identical
node src/headless.js --scenario scenarios/win_bot.json > /tmp/ddl_a.json
node src/headless.js --scenario scenarios/win_bot.json > /tmp/ddl_b.json
cmp /tmp/ddl_a.json /tmp/ddl_b.json && echo "IDENTICAL $(shasum -a 256 /tmp/ddl_a.json | cut -c1-16)" > "$OUT/determinism.txt"
for s in 1 2 3 4 5 6 7 8; do node src/headless.js --bot --seed $s | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const j=JSON.parse(d);console.log(`seed ${j.seed}: ${j.result} t=${j.time_s}s score=${j.score} lit=${j.lanterns_lit}/5 hits=${j.hits}`)})'; done > "$OUT/bot-seeds.txt"
echo "proof written to $OUT"; cat "$OUT/test-report.txt" | grep -E 'pass|fail'
