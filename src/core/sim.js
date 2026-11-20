// Pure game logic for Đảo Đèn Lồng — Night 1 (Đảo Bến).
// No rendering, no DOM, no Math.random: deterministic for a given (tuning, seed, inputs).
// Shared by the browser game (src/web) and the headless runner (src/headless.js).

export const DT = 1 / 60;                 // fixed simulation step (s)
export const ISLAND_RADIUS = 30;          // m
export const LANTERN_RING = 18;           // m, lanterns sit on this ring
export const MOTE_MAX = 30;               // fireflies present at once
export const MOTE_RESPAWN_S = 2;          // one new firefly every N s when below max
export const SHADE_START = 2;             // shades at t=0
export const SHADE_MAX = 6;
export const SHADE_SPAWN_EVERY_S = 30;    // one more shade every N s (up to max)
export const SHADE_SPAWN_MIN_DIST = 12;   // never spawn closer than this to the player
export const JUMP_V = 7, GRAVITY = 20;    // m/s, m/s^2
export const SHADE_REACH_Y = 1.0;         // player above this height cannot be touched

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const dist2 = (ax, az, bx, bz) => (ax - bx) ** 2 + (az - bz) ** 2;

export function createSim(tuning, { seed = 1 } = {}) {
  const T = tuning;
  const rng = mulberry32(seed);
  const s = {
    seed, t: 0, tick: 0,
    timeLeft: T.night1_duration_s,
    status: 'playing', loseReason: null,
    player: { x: 0, y: 0, z: 0, vy: 0, carried: 0, flames: T.flames, invuln: 0, faceX: 0, faceZ: 1 },
    lanterns: [], motes: [], shades: [],
    pulseCd: 0, nextId: 1, moteTimer: 0, shadeTimer: 0,
    stats: { motesCollected: 0, stuns: 0, hits: 0, pulses: 0, deposited: 0, lanternsLit: 0 },
    events: [],
  };
  for (let i = 0; i < T.lantern_count_night1; i++) {
    const a = (i / T.lantern_count_night1) * Math.PI * 2 + Math.PI / 2;
    s.lanterns.push({ id: i, x: Math.cos(a) * LANTERN_RING, z: Math.sin(a) * LANTERN_RING, charge: 0, lit: false });
  }
  const randPointOnIsland = (rMin, rMax) => {
    const a = rng() * Math.PI * 2;
    const r = Math.sqrt(rMin * rMin + rng() * (rMax * rMax - rMin * rMin));
    return [Math.cos(a) * r, Math.sin(a) * r];
  };
  const spawnMote = (x, z) => {
    if (x === undefined) {
      for (let k = 0; k < 10; k++) {
        [x, z] = randPointOnIsland(3, ISLAND_RADIUS - 2);
        if (!s.lanterns.some(l => dist2(l.x, l.z, x, z) < 4)) break;
      }
    }
    s.motes.push({ id: s.nextId++, x, z });
  };
  const insideSafe = (x, z) => s.lanterns.some(l => l.lit && dist2(l.x, l.z, x, z) < T.safe_radius ** 2);
  const spawnShade = () => {
    let x = 0, z = 0;
    for (let k = 0; k < 20; k++) {
      const a = rng() * Math.PI * 2;
      x = Math.cos(a) * (ISLAND_RADIUS - 1); z = Math.sin(a) * (ISLAND_RADIUS - 1);
      if (!insideSafe(x, z) && dist2(x, z, s.player.x, s.player.z) >= SHADE_SPAWN_MIN_DIST ** 2) break;
    }
    s.shades.push({ id: s.nextId++, x, z, stun: 0 });
    s.events.push({ type: 'shade_spawn', t: s.t });
  };
  const clampIsland = (o, r = ISLAND_RADIUS - 0.5) => {
    const d = Math.hypot(o.x, o.z);
    if (d > r) { o.x *= r / d; o.z *= r / d; }
  };

  for (let i = 0; i < MOTE_MAX; i++) spawnMote();
  for (let i = 0; i < SHADE_START; i++) spawnShade();
  s.events.length = 0;

  function score() {
    const sc = T.score, st = s.stats;
    const base = st.motesCollected * sc.per_mote + st.lanternsLit * sc.per_lantern + st.stuns * sc.per_stun;
    const won = s.status === 'won';
    const timeBonus = won ? Math.floor(s.timeLeft) * sc.per_second_left : 0;
    const flameBonus = won ? s.player.flames * sc.per_flame_left : 0;
    return { total: base + timeBonus + flameBonus, base, timeBonus, flameBonus };
  }

  function nearestUnlitLantern(maxDist = Infinity) {
    let best = null, bd = maxDist * maxDist;
    for (const l of s.lanterns) {
      if (l.lit) continue;
      const d = dist2(l.x, l.z, s.player.x, s.player.z);
      if (d <= bd) { bd = d; best = l; }
    }
    return best;
  }

  // input: { mx, mz } world-space move direction (any length, clamped to 1), jump/pulse/interact booleans (edge-triggered by caller)
  function step(input = {}) {
    s.events.length = 0;
    if (s.status !== 'playing') return s;
    const dt = DT, p = s.player;
    s.t += dt; s.tick++;

    // --- movement & jump
    let mx = input.mx || 0, mz = input.mz || 0;
    const ml = Math.hypot(mx, mz);
    if (ml > 1) { mx /= ml; mz /= ml; }
    if (ml > 1e-6) { p.faceX = mx / Math.max(ml, 1e-6); p.faceZ = mz / Math.max(ml, 1e-6); }
    p.x += mx * T.player_speed * dt; p.z += mz * T.player_speed * dt;
    if (input.jump && p.y <= 0) { p.vy = JUMP_V; s.events.push({ type: 'jump' }); }
    if (p.y > 0 || p.vy > 0) { p.vy -= GRAVITY * dt; p.y = Math.max(0, p.y + p.vy * dt); if (p.y === 0) p.vy = 0; }
    if (Math.hypot(p.x, p.z) > ISLAND_RADIUS - 0.5) {
      if (T.fall_enabled) {
        p.x = 0; p.z = 0; p.y = 0; p.vy = 0;
        hurt('fall');
      } else clampIsland(p);
    }
    if (p.invuln > 0) p.invuln = Math.max(0, p.invuln - dt);
    if (s.pulseCd > 0) s.pulseCd = Math.max(0, s.pulseCd - dt);

    // --- pickup fireflies
    for (let i = s.motes.length - 1; i >= 0; i--) {
      if (p.carried >= T.carry_capacity) break;
      const m = s.motes[i];
      if (dist2(m.x, m.z, p.x, p.z) <= T.pickup_radius ** 2) {
        s.motes.splice(i, 1); p.carried++; s.stats.motesCollected++;
        s.events.push({ type: 'pickup', id: m.id });
      }
    }
    s.moteTimer += dt;
    if (s.moteTimer >= MOTE_RESPAWN_S) { s.moteTimer -= MOTE_RESPAWN_S; if (s.motes.length < MOTE_MAX) spawnMote(); }

    // --- interact: feed light into the nearest unlit lantern in range
    if (input.interact && p.carried > 0) {
      const l = nearestUnlitLantern(T.interact_radius);
      if (l) {
        const put = Math.min(p.carried, T.lantern_cost - l.charge);
        l.charge += put; p.carried -= put; s.stats.deposited += put;
        s.events.push({ type: 'deposit', lantern: l.id, amount: put });
        if (l.charge >= T.lantern_cost) {
          l.lit = true; s.stats.lanternsLit++;
          s.events.push({ type: 'lantern_lit', lantern: l.id });
        }
      }
    }

    // --- pulse (glow) to repel shades
    if (input.pulse) {
      if (s.pulseCd <= 0 && p.carried >= T.pulse_cost) {
        p.carried -= T.pulse_cost; s.pulseCd = T.pulse_cooldown_s; s.stats.pulses++;
        let n = 0;
        for (const sh of s.shades) {
          const dx = sh.x - p.x, dz = sh.z - p.z, d = Math.hypot(dx, dz);
          if (d <= T.pulse_radius) {
            sh.stun = T.pulse_stun_s; n++;
            const ux = d > 1e-6 ? dx / d : 1, uz = d > 1e-6 ? dz / d : 0;
            sh.x += ux * T.pulse_push_m; sh.z += uz * T.pulse_push_m; clampIsland(sh);
          }
        }
        s.stats.stuns += n;
        s.events.push({ type: 'pulse', stunned: n });
      } else s.events.push({ type: 'pulse_fail', reason: s.pulseCd > 0 ? 'cooldown' : 'no_light' });
    }

    // --- shades
    s.shadeTimer += dt;
    if (s.shadeTimer >= SHADE_SPAWN_EVERY_S) { s.shadeTimer -= SHADE_SPAWN_EVERY_S; if (s.shades.length < SHADE_MAX) spawnShade(); }
    for (const sh of s.shades) {
      if (sh.stun > 0) { sh.stun = Math.max(0, sh.stun - dt); }
      else {
        const dx = p.x - sh.x, dz = p.z - sh.z, d = Math.hypot(dx, dz);
        if (d > 1e-6) { const k = Math.min(d, T.shade_speed * dt) / d; sh.x += dx * k; sh.z += dz * k; }
      }
      // shades fear lit lanterns: cannot stay inside safe_radius
      for (const l of s.lanterns) {
        if (!l.lit) continue;
        const dx = sh.x - l.x, dz = sh.z - l.z, d = Math.hypot(dx, dz);
        if (d < T.safe_radius) {
          const ux = d > 1e-6 ? dx / d : 1, uz = d > 1e-6 ? dz / d : 0;
          sh.x = l.x + ux * T.safe_radius; sh.z = l.z + uz * T.safe_radius;
        }
      }
      clampIsland(sh);
      if (sh.stun <= 0 && p.invuln <= 0 && p.y < SHADE_REACH_Y && s.status === 'playing'
          && dist2(sh.x, sh.z, p.x, p.z) <= T.shade_hit_radius ** 2) hurt('shade');
    }

    // --- end conditions
    if (s.status === 'playing') {
      if (s.lanterns.every(l => l.lit)) { s.status = 'won'; s.events.push({ type: 'win' }); }
      else {
        s.timeLeft = Math.max(0, s.timeLeft - dt);
        if (s.timeLeft <= 0) lose('time');
      }
    }
    return s;
  }

  function hurt(reason) {
    const p = s.player;
    p.flames--; s.stats.hits++; p.invuln = T.invuln_s;
    const drop = Math.floor(p.carried * T.hit_drop_ratio);
    p.carried -= drop;
    for (let i = 0; i < drop; i++) {  // dropped light scatters as fireflies nearby (can be picked up again)
      const a = rng() * Math.PI * 2, r = 2 + rng() * 2;
      const m = { x: p.x + Math.cos(a) * r, z: p.z + Math.sin(a) * r };
      clampIsland(m, ISLAND_RADIUS - 1);
      spawnMote(m.x, m.z);
    }
    s.events.push({ type: 'hit', reason, dropped: drop });
    if (p.flames <= 0) lose('flames');
  }
  function lose(reason) { s.status = 'lost'; s.loseReason = reason; s.events.push({ type: 'lose', reason }); }

  return { state: s, step, score, nearestUnlitLantern };
}

// Simple deterministic autopilot, used for demos and as a "playable to the end" proof.
export function botInput(sim, tuning) {
  const s = sim.state, p = s.player, T = tuning;
  const inp = { mx: 0, mz: 0, jump: false, pulse: false, interact: false };
  const threat = s.shades.some(sh => sh.stun <= 0 && dist2(sh.x, sh.z, p.x, p.z) < 3.2 ** 2);
  if (threat && s.pulseCd <= 0 && p.carried >= T.pulse_cost) inp.pulse = true;
  const target = (() => {
    const unlit = s.lanterns.filter(l => !l.lit);
    const need = unlit.length ? Math.min(...unlit.map(l => T.lantern_cost - l.charge)) : 0;
    if (p.carried >= T.carry_capacity || (p.carried >= need + T.pulse_cost) || (p.carried >= need && s.motes.length === 0)) {
      let best = null, bd = Infinity;
      for (const l of unlit) { const d = dist2(l.x, l.z, p.x, p.z); if (d < bd) { bd = d; best = l; } }
      if (best) { if (bd <= (T.interact_radius * 0.8) ** 2) inp.interact = true; return best; }
    }
    let best = null, bd = Infinity;
    for (const m of s.motes) { const d = dist2(m.x, m.z, p.x, p.z); if (d < bd) { bd = d; best = m; } }
    return best;
  })();
  if (target) { inp.mx = target.x - p.x; inp.mz = target.z - p.z; }
  return inp;
}
