#!/usr/bin/env bash
# Regenerate proof from the current code. Output is never hand-edited.  Usage: ./scripts/proof.sh [phase]  (default 2)
set -euo pipefail
cd "$(dirname "$0")/.."
PH=${1:-2}; OUT=docs/proof/phase$PH; mkdir -p "$OUT"
npm test 2>&1 | grep -E '^(✔|✖|ℹ (tests|pass|fail))' > "$OUT/test-report.txt" || true
for f in scenarios/*.json; do n=$(basename "$f" .json); node src/headless.js --scenario "$f" > "$OUT/$n.json"; done
# determinism: same input twice must be byte-identical
for n in 1 2 3; do
  a=$(node src/headless.js --night $n --seed 7 --bot --ticks 6000 | shasum -a 256 | cut -c1-16)
  b=$(node src/headless.js --night $n --seed 7 --bot --ticks 6000 | shasum -a 256 | cut -c1-16)
  [ "$a" = "$b" ] && echo "night $n: IDENTICAL $a" || echo "night $n: DIFFERENT $a $b"
done > "$OUT/determinism.txt"
# performance: full night 3 (21,600 ticks) with snapshots every 60 ticks
{ uname -sm; sysctl -n machdep.cpu.brand_string 2>/dev/null || true; node -v
  s=$(date +%s%N 2>/dev/null || python3 -c 'import time;print(int(time.time()*1e9))')
  echo '{"night":3,"seed":1,"ticks":21600,"snapshot_every":60,"player":{"flames":1000000000}}' | node src/headless.js --scenario - > /dev/null
  e=$(date +%s%N 2>/dev/null || python3 -c 'import time;print(int(time.time()*1e9))')
  echo "night 3, 21600 ticks: $(( (e - s) / 1000000 )) ms (limit 30000 ms)"; } > "$OUT/perf.txt"
# autopilot outcome per night (honest: not a requirement, shows the nights are playable end to end)
for n in 1 2 3; do for s in 1 2 3 4 5 6; do node src/headless.js --night $n --seed $s --bot --snapshot-every 0 | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const j=JSON.parse(d);console.log(`night ${j.night} seed ${j.seed}: ${j.result} ${j.reason||""} ticks=${j.ticks} lit=${j.lanterns_lit}/${j.lantern_count} score=${j.score}`)})'; done; done > "$OUT/bot-nights.txt"
echo "proof written to $OUT"; grep -E 'pass|fail' "$OUT/test-report.txt"; cat "$OUT/determinism.txt" "$OUT/perf.txt"
