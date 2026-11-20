// Pure game logic for Đảo Đèn Lồng (Ticket-02 standard numbers, Test Contract v1.1).
// No DOM / three.js / Math.random. 60 ticks per second; all timers are integer ticks.
// One step() == one tick, processed in the mandatory order from Ticket-02.
import { MAPS, groundHeight, STEP_UP, level } from './maps.js';

export const TPS = 60, DT = 1 / TPS;
export const JUMP_V = 7, GRAVITY = 20, FALL_Y = -10;
export const CHARM_SPEED = 7.2, CHARM_TICKS = 600, CHARM_RESPAWN_TICKS = 2700;
export const MOTE_START = 20, MOTE_CAP = 30, MOTE_EVERY = 240, DROP_TTL = 480;
export const SHADE_FIRST_TICK = 300, SHADE_SPAWNING_TICKS = 60, SHADE_WANDER_SPEED = 2, SHADE_WANDER_TURN = 120;
export const SHADE_DETECT = 12, SHADE_GIVEUP = 18, SHADE_RECOIL_M = 2, SHADE_RECOIL_TICKS = 60;
export const SHADE_SPAWN_MIN_DIST = 15, STUN_TICKS = 120, PUSH_TICKS = 15, EVICT_TICKS = 30;
export const HIT_DY = 1.5, PICK_DY = 1.5, RESPAWN_WAIT = 60;
export const DRIFTER_EVERY = 1200, DRIFTER_MAX = 2, DRIFTER_SPEED = 7, DRIFTER_IDLE_SPEED = 2;
export const DRIFTER_CHASE_CARRY = 5, DRIFTER_CHASE_DIST = 15, DRIFTER_TOUCH = 1.2, DRIFTER_STEAL = 3;
export const DRIFTER_FLEE_TICKS = 240, DRIFTER_DROPPED_FLEE_TICKS = 120;
export const WIND_EVERY = 1800, WIND_TICKS = 300, WIND_WARN = 120, WIND_SPEED = 2;
export const PULSE_CENTER_Y = 0.8;

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
const hyp = Math.hypot;
const xz = (a, b) => hyp(a[0] - b[0], a[2] - b[2]);
const r3 = (v) => Math.round(v * 1000) / 1000;
const s3 = (ticks) => r3(ticks / TPS);

export function createSim(tuning, opts = {}) {
  const T = tuning, night = opts.night ?? 1, map = MAPS[night], scn = opts.scenario ?? {};
  const rng = mulberry32(opts.seed ?? scn.seed ?? 1);
  const ground = (x, z) => groundHeight(night, x, z);
  const DASH_TICKS = Math.round(T.dash_duration_s * TPS), DASH_CD = Math.round(T.dash_cooldown_s * TPS);
  const PULSE_CD = Math.round(T.pulse_cooldown_s * TPS), INVULN_TICKS = Math.round(T.invuln_s * TPS);
  if (night === 1 && map.lanterns.length !== T.lantern_count_night1)
    throw new Error(`contract lantern_count_night1=${T.lantern_count_night1} but Night 1 map has ${map.lanterns.length} lanterns`);
  const durationTicks = Math.round(T[`night${night}_duration_s`] * TPS);
  const shadeSpeed = T.shade_speed * map.shadeSpeedMul;

  const s = {
    night, tick: 0, simTick: 0, paused: false, status: 'playing', reason: null,
    timeLeft: durationTicks,
    player: {
      pos: [...map.start], vel: [0, 0, 0], facing: map.startFacingDeg * Math.PI / 180,
      grounded: true, carried: 0, flames: T.flames,
      invuln: 0, dashCd: 0, dashLeft: 0, dashDir: [0, 0], pulseCd: 0, charm: 0,
      launch: null, fallen: false, respawnWait: 0,
    },
    lanterns: map.lanterns.map(l => ({ id: l.id, pos: [...l.pos], charge: 0, lit: false })),
    motes: [], shades: [], drifters: [], charms: [],
    wind: { active: false, dirDeg: 0, left: 0, warn: false, nextDir: 0 },
    flags: { randomDrifters: scn.random_drifters ?? true, windEnabled: scn.wind_enabled ?? map.wind, spawnShades: scn.spawn_shades ?? true, spawnMotes: scn.spawn_motes ?? true },
    ids: { mote: 1, shade: 1, drifter: 1 },
    prevBtn: { jump: false, interact: false, pulse: false, dash: false, pause: false },
    score: { motes: 0, lanterns: 0, pulseHits: 0 },
    stats: { picked: 0, deposited: 0, lanternsLit: 0, pulseHits: 0, hits: 0, falls: 0, stolen: 0, dashes: 0 },
    events: [], started: false,
  };
  const p = s.player;
  const ev = (type, data = {}) => s.events.push({ tick: s.tick, type, ...data });

  // ---------- setup ----------
  const freeSpawnPoints = () => map.moteSpawns.map((_, i) => i).filter(i => !s.motes.some(m => m.spawnIdx === i));
  const addRandomMote = () => {
    const free = freeSpawnPoints(); if (!free.length) return false;
    const i = free[Math.floor(rng() * free.length)], pt = map.moteSpawns[i];
    s.motes.push({ id: `M${s.ids.mote++}`, pos: [...pt], kind: 'random', ttl: null, spawnIdx: i, readyTick: s.tick + 1 });
    return true;
  };
  const addDropped = (cx, cz, n, baseY) => {
    for (let k = 0; k < n; k++) {
      const a = rng() * Math.PI * 2, r = 1.5 + rng() * 1.0;
      const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r, g = ground(x, z);
      s.motes.push({ id: `M${s.ids.mote++}`, pos: [x, g ?? baseY, z], kind: 'dropped', ttl: DROP_TTL, spawnIdx: -1, readyTick: s.tick + 1 });
    }
  };
  if (scn.motes) for (const m of scn.motes) s.motes.push({ id: m.id ?? `M${s.ids.mote++}`, pos: [...m.pos], kind: m.kind ?? 'random', ttl: m.ttl_ticks ?? (m.ttl_s != null ? Math.round(m.ttl_s * TPS) : null), spawnIdx: -1, readyTick: 0 });
  else for (let i = 0; i < MOTE_START; i++) addRandomMote();
  for (const m of s.motes) m.readyTick = 0;

  const charmList = scn.charms ?? map.charms.map((pos, i) => ({ id: `C${i + 1}`, pos }));
  s.charms = charmList.map((c, i) => ({ id: c.id ?? `C${i + 1}`, pos: [...c.pos], available: c.available ?? true, respawn: c.respawn_ticks ?? 0 }));
  if (scn.drifters) s.drifters = scn.drifters.map((d, i) => ({ id: d.id ?? `D${i + 1}`, pos: [...d.pos], state: d.state ?? 'idle', stolen: d.stolen ?? 0, left: d.state_ticks_left ?? 0, dir: 0, hasStolen: (d.stolen ?? 0) > 0 }));
  s.ids.drifter = s.drifters.length + 1;
  if (scn.shades) s.shades = scn.shades.map((sh, i) => mkShade(sh.id ?? `S${i + 1}`, sh.pos, sh.state ?? 'wander', sh.state_ticks_left ?? 0));
  s.ids.shade = s.shades.length + 1;
  if (scn.player) {
    const sp = scn.player;
    if (sp.pos) p.pos = [...sp.pos];
    if (sp.carried != null) p.carried = sp.carried;
    if (sp.flames != null) p.flames = sp.flames;
    if (sp.facing_deg != null) p.facing = sp.facing_deg * Math.PI / 180;
    p.invuln = sp.invuln_ticks ?? 0; p.dashCd = sp.dash_cd_ticks ?? 0; p.pulseCd = sp.pulse_cd_ticks ?? 0; p.charm = sp.charm_ticks ?? 0;
    const g = ground(p.pos[0], p.pos[2]); p.grounded = g !== null && Math.abs(p.pos[1] - g) < 1e-6;
  }
  if (scn.lanterns) for (const l of scn.lanterns) { const L = s.lanterns.find(x => x.id === l.id); if (L) { L.charge = l.charge ?? L.charge; L.lit = l.lit ?? L.charge >= T.lantern_cost; } }
  if (scn.time_left_s != null) s.timeLeft = Math.round(scn.time_left_s * TPS);

  function mkShade(id, pos, state = 'spawning', left = SHADE_SPAWNING_TICKS) {
    return { id, pos: [...pos], state, left, dir: 0, push: 0, pushDir: [1, 0], evict: 0, recoilDir: [1, 0] };
  }

  // ---------- movement helpers ----------
  // Try to move an entity on terrain; walls (higher than STEP_UP) block per axis. Returns true if moved at all.
  function walk(pos, dx, dz, { allowVoid = true } = {}) {
    const tryMove = (nx, nz) => {
      const g = ground(nx, nz);
      if (g === null) return allowVoid;
      return g <= pos[1] + STEP_UP;
    };
    let moved = false;
    if (tryMove(pos[0] + dx, pos[2] + dz)) { pos[0] += dx; pos[2] += dz; moved = true; }
    else {
      if (dx && tryMove(pos[0] + dx, pos[2])) { pos[0] += dx; moved = true; }
      if (dz && tryMove(pos[0], pos[2] + dz)) { pos[2] += dz; moved = true; }
    }
    return moved;
  }
  // Ground-bound walker (shades): no void, snaps to ground height.
  function walkGround(pos, dx, dz) {
    const ok = walk(pos, dx, dz, { allowVoid: false });
    const g = ground(pos[0], pos[2]); if (g !== null) pos[1] = g;
    return ok;
  }
  const insideSafeOf = (pos) => s.lanterns.filter(l => l.lit && xz(l.pos, pos) < T.safe_radius);

  // ---------- one tick ----------
  function step(input = {}) {
    s.events.length = 0;
    if (s.status !== 'playing') return s;
    s.tick++;
    if (!s.started) { s.started = true; ev('night_start', { night }); }
    // 1. read input (edge-triggered buttons), pause first
    const btn = {};
    for (const k of ['jump', 'interact', 'pulse', 'dash', 'pause']) { const v = !!input[k]; btn[k] = v && !s.prevBtn[k]; s.prevBtn[k] = v; }
    if (btn.pause) {
      s.paused = !s.paused; ev(s.paused ? 'paused' : 'resumed');
      if (s.paused) return s;
    }
    if (s.paused) return s;
    s.simTick++;

    // 2. timers
    s.timeLeft = Math.max(0, s.timeLeft - 1);
    if (p.dashCd > 0) p.dashCd--;
    if (p.pulseCd > 0) p.pulseCd--;
    if (p.invuln > 0) p.invuln--;
    if (p.charm > 0) p.charm--;
    for (const sh of s.shades) { if (sh.left > 0) sh.left--; if (sh.evict > 0) {/* handled in safe-zone step */} }
    for (const m of s.motes) if (m.ttl != null) m.ttl--;
    s.motes = s.motes.filter(m => m.ttl == null || m.ttl > 0);
    for (const c of s.charms) if (!c.available && c.respawn > 0 && --c.respawn === 0) c.available = true;
    for (const d of s.drifters) if (d.left > 0) d.left--;
    if (s.flags.windEnabled) windTimers();

    // 3. move Mây (jump, dash, launch pads, wind) then fall check
    if (p.respawnWait > 0) {
      if (--p.respawnWait === 0) {
        p.pos = [...map.start]; p.vel = [0, 0, 0]; p.grounded = true; p.launch = null; p.dashLeft = 0;
        p.facing = map.startFacingDeg * Math.PI / 180; p.invuln = INVULN_TICKS; p.fallen = false;
        ev('respawn', { pos: p.pos.map(r3) });
      }
    } else movePlayer(input, btn);

    const active = p.respawnWait === 0;
    // 4. pick up motes and charms
    if (active) {
      for (const m of [...s.motes].sort(byId)) {
        if (p.carried >= T.carry_capacity) break;
        if (m.readyTick > s.tick) continue;
        if (xz(m.pos, p.pos) <= T.pickup_radius && Math.abs(p.pos[1] - m.pos[1]) <= PICK_DY) {
          s.motes.splice(s.motes.indexOf(m), 1); p.carried++;
          s.stats.picked++;
          ev('pickup', { id: m.id, mote_id: m.id, kind: m.kind, carried: p.carried });
        }
      }
      for (const c of s.charms) {
        if (c.available && xz(c.pos, p.pos) <= T.pickup_radius && Math.abs(p.pos[1] - c.pos[1]) <= PICK_DY) {
          c.available = false; c.respawn = CHARM_RESPAWN_TICKS; p.charm = CHARM_TICKS;
          ev('charm_picked', { charm_id: c.id, charm_ticks: CHARM_TICKS });
        }
      }
    }
    // 5. interact with lanterns
    const justLit = [];
    if (active && btn.interact && p.carried > 0) {
      let best = null, bd = Infinity;
      for (const l of s.lanterns) {
        if (l.lit) continue;
        const d = hyp(l.pos[0] - p.pos[0], l.pos[1] - p.pos[1], l.pos[2] - p.pos[2]);
        if (d <= T.interact_radius && (d < bd - 1e-9 || (Math.abs(d - bd) <= 1e-9 && idNum(l.id) < idNum(best.id)))) { best = l; bd = d; }
      }
      if (best) {
        const put = Math.min(p.carried, T.lantern_cost - best.charge);
        best.charge += put; p.carried -= put; s.score.motes += put; s.stats.deposited += put;
        ev('deposit', { lantern: s.lanterns.indexOf(best), lantern_id: best.id, amount: put, charge: best.charge });
        if (best.charge >= T.lantern_cost) {
          best.lit = true; s.score.lanterns++; s.stats.lanternsLit++; justLit.push(best);
          ev('lantern_lit', { lantern: s.lanterns.indexOf(best), lantern_id: best.id });
        }
      }
    }
    // 6. safe zones: shades inside a newly lit lantern get evicted over <= 30 ticks; others are clamped at the edge
    for (const l of justLit) for (const sh of s.shades) if (xz(sh.pos, l.pos) < T.safe_radius) { sh.evict = EVICT_TICKS; sh.evictFrom = l.id; }
    for (const sh of s.shades) {
      if (sh.evict > 0) {
        const l = s.lanterns.find(x => x.id === sh.evictFrom);
        const dx = sh.pos[0] - l.pos[0], dz = sh.pos[2] - l.pos[2], d = hyp(dx, dz);
        const ux = d > 1e-9 ? dx / d : 1, uz = d > 1e-9 ? dz / d : 0;
        const nd = d + (T.safe_radius - d) / sh.evict;
        sh.pos[0] = l.pos[0] + ux * nd; sh.pos[2] = l.pos[2] + uz * nd;
        const g = ground(sh.pos[0], sh.pos[2]); if (g !== null) sh.pos[1] = g;
        sh.evict--;
      }
    }
    // 7. pulse
    if (active && btn.pulse) {
      if (p.pulseCd <= 0 && p.carried >= T.pulse_cost) doPulse();
      else ev('pulse_fail', { reason: p.pulseCd > 0 ? 'cooldown' : 'no_light' });   // not activated (Phase 1 event kept)
    }
    // 8. move shades and drifters
    for (const sh of s.shades) moveShade(sh);
    for (const d of s.drifters) moveDrifter(d);
    // 9. touches: drifters steal first, then shades hit (ascending id)
    if (active) {
      for (const d of [...s.drifters].sort(byId)) {
        if ((d.state === 'idle' || d.state === 'chase') && !d.hasStolen && p.carried > 0 && xz(d.pos, p.pos) <= DRIFTER_TOUCH) {
          const amt = Math.min(DRIFTER_STEAL, p.carried);
          p.carried -= amt; d.stolen = amt; d.hasStolen = true; d.state = 'flee'; d.left = DRIFTER_FLEE_TICKS; s.stats.stolen += amt;
          ev('drifter_steal', { drifter_id: d.id, amount: amt, carried: p.carried });
        }
      }
      let hitThisTick = false;
      for (const sh of [...s.shades].sort(byId)) {
        if (hitThisTick) break;
        if (sh.state === 'spawning' || sh.state === 'stunned' || sh.state === 'recoil' || sh.evict > 0) continue;
        if (xz(sh.pos, p.pos) <= T.shade_hit_radius && Math.abs(sh.pos[1] - p.pos[1]) <= HIT_DY) {
          if (p.invuln > 0) continue;   // touching while invulnerable does nothing
          hitThisTick = true;
          p.flames--; s.stats.hits++;
          const drop = Math.floor(p.carried * T.hit_drop_ratio);
          p.carried -= drop; addDropped(p.pos[0], p.pos[2], drop, p.pos[1]);
          p.invuln = INVULN_TICKS;
          sh.state = 'recoil'; sh.left = SHADE_RECOIL_TICKS;
          const dx = sh.pos[0] - p.pos[0], dz = sh.pos[2] - p.pos[2], d = hyp(dx, dz);
          sh.recoilDir = d > 1e-9 ? [dx / d, dz / d] : [1, 0];
          ev('player_hit', { cause: 'shade', shade_id: sh.id, flames: p.flames, dropped: drop });
        }
      }
    }
    // 10. scheduled spawns (new entities interact from next tick)
    if (s.flags.spawnMotes && s.simTick % MOTE_EVERY === 0 && s.motes.length < MOTE_CAP) addRandomMote();
    if (s.flags.spawnShades && s.simTick >= SHADE_FIRST_TICK && (s.simTick - SHADE_FIRST_TICK) % map.shadeEveryTicks === 0) {
      const n = s.simTick === SHADE_FIRST_TICK ? 2 : 1;
      for (let i = 0; i < n; i++) spawnShade();
    }
    if (map.drifters && s.flags.randomDrifters && s.simTick % DRIFTER_EVERY === 0) spawnDrifter();
    // 11. win / lose
    if (p.flames <= 0) end('lost', 'no_flames');
    else if (s.lanterns.every(l => l.lit)) end('won', null);
    else if (s.timeLeft <= 0) end('lost', 'dawn');
    return s;
  }

  function end(status, reason) { s.status = status; s.reason = reason; ev(status === 'won' ? 'win' : 'lose', reason ? { reason } : {}); }
  const idNum = (id) => Number(String(id).replace(/\D/g, '')) || 0;
  function byId(a, b) { return idNum(a.id) - idNum(b.id); }

  function movePlayer(input, btn) {
    let mx = input.move ? input.move[0] : (input.mx || 0), mz = input.move ? input.move[1] : (input.mz || 0);
    const ml = hyp(mx, mz); if (ml > 1) { mx /= ml; mz /= ml; }
    const speed = p.charm > 0 ? CHARM_SPEED : T.player_speed;
    if (ml > 1e-6) p.facing = Math.atan2(mz, mx);
    // dash start (press ignored while dashing)
    if (btn.dash && p.dashLeft === 0 && (p.dashCd === 0 || p.charm > 0)) {
      const dir = ml > 1e-6 ? [mx, mz] : [Math.cos(p.facing), Math.sin(p.facing)];
      const dl = hyp(dir[0], dir[1]); p.dashDir = [dir[0] / dl, dir[1] / dl];
      p.dashLeft = DASH_TICKS; p.dashCd = p.charm > 0 ? 0 : DASH_CD; s.stats.dashes++;
      ev('dash', {});
    }
    // jump (grounded only)
    if (btn.jump && p.grounded && p.dashLeft === 0) { p.vel[1] = JUMP_V; p.grounded = false; ev('jump', {}); }
    // horizontal velocity
    let justDashed = false;
    if (p.dashLeft > 0) {
      justDashed = true;
      p.vel[0] = p.dashDir[0] * T.dash_speed; p.vel[2] = p.dashDir[1] * T.dash_speed; p.vel[1] = 0;
      p.dashLeft--;
    } else if (p.launch) { p.vel[0] = p.launch[0]; p.vel[2] = p.launch[1]; }
    else {
      const maxDv = speed / 6;   // reach full speed / stop within 0.1 s (6 ticks)
      const tx = mx * speed, tz = mz * speed;
      const dvx = tx - p.vel[0], dvz = tz - p.vel[2], dv = hyp(dvx, dvz);
      if (dv <= maxDv) { p.vel[0] = tx; p.vel[2] = tz; } else { p.vel[0] += dvx / dv * maxDv; p.vel[2] += dvz / dv * maxDv; }
    }
    let dx = p.vel[0] * DT, dz = p.vel[2] * DT;
    if (s.wind.active) { const a = s.wind.dirDeg * Math.PI / 180; dx += Math.cos(a) * WIND_SPEED * DT; dz += Math.sin(a) * WIND_SPEED * DT; }
    walk(p.pos, dx, dz, { allowVoid: !!T.fall_enabled });
    if (justDashed && p.dashLeft === 0) {   // dash just ended: resume launch velocity or normal run speed
      if (p.launch) { p.vel[0] = p.launch[0]; p.vel[2] = p.launch[1]; } else { p.vel[0] = mx * speed; p.vel[2] = mz * speed; }
    }
    // vertical
    const g = ground(p.pos[0], p.pos[2]);
    if (p.grounded && p.vel[1] <= 0) {
      if (g !== null && p.pos[1] - g <= STEP_UP && g - p.pos[1] <= STEP_UP) p.pos[1] = g;
      else p.grounded = false;
    }
    if (!p.grounded) {
      if (p.dashLeft === 0 && !justDashed) p.vel[1] -= GRAVITY * DT;   // dash in the air keeps height
      p.pos[1] += p.vel[1] * DT;
      const g2 = ground(p.pos[0], p.pos[2]);
      if (g2 !== null && p.vel[1] <= 0 && p.pos[1] <= g2 && p.pos[1] >= g2 - 1.0) {
        p.pos[1] = g2; p.vel[1] = 0; p.grounded = true; p.launch = null;
      }
    }
    // launch pads
    if (p.grounded) for (const pad of map.pads) {
      if (xz(pad.pos, p.pos) <= 1.0 && Math.abs(p.pos[1] - pad.pos[1]) < 0.05) {
        let hx, hz;
        if (pad.toward) { const vx = pad.toward[0] - pad.pos[0], vz = pad.toward[1] - pad.pos[2], l = hyp(vx, vz); hx = vx / l * pad.h; hz = vz / l * pad.h; }
        else { hx = pad.dir[0] * pad.h; hz = pad.dir[1] * pad.h; }
        p.launch = [hx, hz]; p.vel = [hx, pad.vy, hz]; p.grounded = false; p.dashLeft = 0;
        ev('launch', { pad: pad.pos.map(r3) });
        break;
      }
    }
    // fall off the island
    if (p.pos[1] < FALL_Y && !p.fallen) {
      p.fallen = true; s.stats.falls++;
      const lost = p.carried; p.carried = 0; p.flames--;
      ev('player_hit', { cause: 'fall', lost, flames: p.flames });
      p.vel = [0, 0, 0]; p.launch = null; p.dashLeft = 0;
      if (p.flames > 0) p.respawnWait = RESPAWN_WAIT;
    }
  }

  function doPulse() {
    p.carried -= T.pulse_cost; p.pulseCd = PULSE_CD;
    const c = [p.pos[0], p.pos[1] + PULSE_CENTER_Y, p.pos[2]];
    const hit = [];
    for (const sh of s.shades) {
      if (hyp(sh.pos[0] - c[0], sh.pos[1] + PULSE_CENTER_Y - c[1], sh.pos[2] - c[2]) <= T.pulse_radius) {
        const dx = sh.pos[0] - p.pos[0], dz = sh.pos[2] - p.pos[2], d = hyp(dx, dz);
        sh.pushDir = d > 1e-9 ? [dx / d, dz / d] : [1, 0];
        sh.state = 'stunned'; sh.left = Math.round(T.pulse_stun_s * TPS); sh.push = PUSH_TICKS;
        hit.push(sh.id);
      }
    }
    const dHits = [];
    for (const d of s.drifters) {
      if (hyp(d.pos[0] - c[0], d.pos[1] - c[1], d.pos[2] - c[2]) > T.pulse_radius) continue;
      if (d.state === 'chase') { d.state = 'flee'; d.left = DRIFTER_FLEE_TICKS; d.hasStolen = true; dHits.push(d.id); }
      else if (d.state === 'flee' && d.stolen > 0) {
        const amt = d.stolen; addDropped(d.pos[0], d.pos[2], amt, ground(d.pos[0], d.pos[2]) ?? p.pos[1]);
        d.stolen = 0; d.left = DRIFTER_DROPPED_FLEE_TICKS; dHits.push(d.id);
        ev('drifter_drop', { drifter_id: d.id, amount: amt });
      }
    }
    s.score.pulseHits += hit.length; s.stats.pulseHits += hit.length;
    ev('pulse', { stunned: hit.length, shades_hit: hit, drifters_hit: dHits });
  }

  function moveShade(sh) {
    if (sh.evict > 0) return;
    const sp = shadeSpeed * DT;
    if (sh.state === 'spawning') { if (sh.left === 0) { sh.state = 'wander'; sh.dir = rng() * Math.PI * 2; sh.turn = SHADE_WANDER_TURN; } return; }
    if (sh.state === 'stunned') {
      if (sh.push > 0) { walkGround(sh.pos, sh.pushDir[0] * T.pulse_push_m / PUSH_TICKS, sh.pushDir[1] * T.pulse_push_m / PUSH_TICKS) || (sh.push = 1); sh.push--; }
      if (sh.left === 0) { sh.state = 'wander'; sh.turn = 0; }
      clampSafe(sh); return;
    }
    if (sh.state === 'recoil') {
      walkGround(sh.pos, sh.recoilDir[0] * SHADE_RECOIL_M / SHADE_RECOIL_TICKS, sh.recoilDir[1] * SHADE_RECOIL_M / SHADE_RECOIL_TICKS);
      if (sh.left === 0) { sh.state = 'wander'; sh.turn = 0; }
      clampSafe(sh); return;
    }
    const d = xz(sh.pos, p.pos), canSee = p.respawnWait === 0;
    if (sh.state === 'wander' && canSee && d <= SHADE_DETECT) sh.state = 'chase';
    else if (sh.state === 'chase' && (!canSee || d > SHADE_GIVEUP)) { sh.state = 'wander'; sh.turn = 0; }
    if (sh.state === 'chase') {
      if (d > 1e-9) { const k = Math.min(d, sp) / d; walkGround(sh.pos, (p.pos[0] - sh.pos[0]) * k, (p.pos[2] - sh.pos[2]) * k); }
    } else {
      if (!(sh.turn > 0)) { sh.dir = rng() * Math.PI * 2; sh.turn = SHADE_WANDER_TURN; }
      sh.turn--;
      const w = SHADE_WANDER_SPEED * DT;
      if (!walkGround(sh.pos, Math.cos(sh.dir) * w, Math.sin(sh.dir) * w)) sh.turn = 0;
    }
    clampSafe(sh);
  }
  function clampSafe(sh) {
    for (const l of s.lanterns) {
      if (!l.lit) continue;
      const dx = sh.pos[0] - l.pos[0], dz = sh.pos[2] - l.pos[2], d = hyp(dx, dz);
      if (d < T.safe_radius) {
        const ux = d > 1e-9 ? dx / d : 1, uz = d > 1e-9 ? dz / d : 0;
        const nx = l.pos[0] + ux * T.safe_radius, nz = l.pos[2] + uz * T.safe_radius, g = ground(nx, nz);
        if (g !== null) { sh.pos[0] = nx; sh.pos[2] = nz; sh.pos[1] = g; }
      }
    }
  }
  function spawnShade() {
    if (s.shades.length >= map.shadeMax) return;
    const valid = map.shadeSpawns.filter(pt => xz(pt, p.pos) >= SHADE_SPAWN_MIN_DIST && insideSafeOf(pt).length === 0);
    if (!valid.length) return;
    const pt = valid[Math.floor(rng() * valid.length)];
    const sh = mkShade(`S${s.ids.shade++}`, [pt[0], ground(pt[0], pt[2]) ?? 0, pt[2]]);
    s.shades.push(sh); ev('shade_spawn', { shade_id: sh.id });
  }

  function moveDrifter(d) {
    if (d.state === 'removed') return;
    const dist = xz(d.pos, p.pos), canSee = p.respawnWait === 0;
    if (d.state === 'flee') {
      const dx = d.pos[0] - p.pos[0], dz = d.pos[2] - p.pos[2], l = hyp(dx, dz) || 1;
      d.pos[0] += dx / l * DRIFTER_SPEED * DT; d.pos[2] += dz / l * DRIFTER_SPEED * DT;
      if (d.left === 0) { d.state = 'removed'; }
    } else {
      const wants = canSee && p.carried >= DRIFTER_CHASE_CARRY && dist <= DRIFTER_CHASE_DIST && !d.hasStolen;
      d.state = wants ? 'chase' : 'idle';
      if (d.state === 'chase') {
        const k = Math.min(dist, DRIFTER_SPEED * DT) / (dist || 1);
        d.pos[0] += (p.pos[0] - d.pos[0]) * k; d.pos[2] += (p.pos[2] - d.pos[2]) * k;
      } else {
        if (!(d.turn > 0)) { d.dir = rng() * Math.PI * 2; d.turn = SHADE_WANDER_TURN; }
        d.turn--;
        d.pos[0] += Math.cos(d.dir) * DRIFTER_IDLE_SPEED * DT; d.pos[2] += Math.sin(d.dir) * DRIFTER_IDLE_SPEED * DT;
      }
    }
    const r = hyp(d.pos[0] - (night === 2 && d.pos[0] > 35 ? 70 : 0), d.pos[2]);
    if (d.state !== 'flee' && r > map.bounds) d.turn = 0;
    const g = ground(d.pos[0], d.pos[2]); d.pos[1] = (g ?? 0) + 1.0;
  }
  function spawnDrifter() {
    if (s.drifters.filter(d => d.state !== 'removed').length >= DRIFTER_MAX) return;
    const pt = map.shadeSpawns[Math.floor(rng() * map.shadeSpawns.length)];
    const d = { id: `D${s.ids.drifter++}`, pos: [pt[0], (ground(pt[0], pt[2]) ?? 0) + 1, pt[2]], state: 'idle', stolen: 0, left: 0, dir: rng() * Math.PI * 2, turn: SHADE_WANDER_TURN, hasStolen: false };
    s.drifters.push(d); ev('drifter_spawn', { drifter_id: d.id });
  }

  function windTimers() {
    const w = s.wind;
    if (w.active) { if (--w.left <= 0) { w.active = false; ev('wind_end', {}); } return; }
    const phase = s.simTick % WIND_EVERY;
    if (s.simTick >= WIND_EVERY - WIND_WARN && phase === WIND_EVERY - WIND_WARN) { w.nextDir = Math.floor(rng() * 360); w.warn = true; ev('wind_warning', { dir_deg: w.nextDir }); }
    if (s.simTick >= WIND_EVERY && phase === 0) { w.active = true; w.warn = false; w.dirDeg = w.nextDir; w.left = WIND_TICKS; ev('wind_start', { dir_deg: w.dirDeg }); }
  }

  function score() {
    const sc = T.score, won = s.status === 'won';
    const base = s.score.motes * sc.per_mote + s.score.lanterns * sc.per_lantern + s.score.pulseHits * sc.per_stun;
    const timeBonus = won ? Math.floor(s.timeLeft / TPS) * sc.per_second_left : 0;
    const flameBonus = won ? p.flames * sc.per_flame_left : 0;
    return { total: base + timeBonus + flameBonus, base, time_bonus: timeBonus, flame_bonus: flameBonus };
  }

  function snapshot() {
    return {
      tick: s.tick, sim_tick: s.simTick, night,
      state: s.paused ? 'paused' : s.status,
      time_left_s: s3(s.timeLeft), score: score().total,
      wind: { active: s.wind.active, dir_deg: s.wind.dirDeg },
      player: {
        pos: p.pos.map(r3), vel: p.vel.map(r3), facing_deg: r3(((p.facing * 180 / Math.PI) % 360 + 360) % 360),
        grounded: p.grounded, carried: p.carried, flames: p.flames,
        invuln: p.invuln > 0, invuln_s: s3(p.invuln), dash_cd_s: s3(p.dashCd), pulse_cd_s: s3(p.pulseCd), charm_s: s3(p.charm),
        respawning: p.respawnWait > 0,
      },
      lanterns: s.lanterns.map(l => ({ id: l.id, pos: l.pos, charge: l.charge, lit: l.lit })),
      shades: s.shades.map(sh => ({ id: sh.id, pos: sh.pos.map(r3), state: sh.state, state_ticks_left: sh.left })),
      motes: [...s.motes].sort(byId).map(m => ({ id: m.id, pos: m.pos.map(r3), kind: m.kind, ttl_s: m.ttl == null ? null : s3(m.ttl) })),
      drifters: s.drifters.map(d => ({ id: d.id, pos: d.pos.map(r3), state: d.state, stolen: d.stolen })),
      charms: s.charms.map(c => ({ id: c.id, available: c.available, respawn_s: s3(c.respawn) })),
    };
  }

  return { state: s, step, score, snapshot, map, ground, level: (x, z) => level(night, x, z) };
}

// ---------- autopilot (demo + "completable" proof). Deterministic. ----------
export function botInput(sim, T) {
  const s = sim.state, p = s.player, night = s.night;
  const inp = { move: [0, 0], jump: false, pulse: false, interact: false, dash: false };
  const threat = s.shades.some(sh => sh.state === 'chase' && xz(sh.pos, p.pos) < 3.0 && Math.abs(sh.pos[1] - p.pos[1]) < 2)
    || s.drifters.some(d => d.state === 'chase' && xz(d.pos, p.pos) < 4);
  if (threat && p.pulseCd === 0 && p.carried >= T.pulse_cost) inp.pulse = true;
  const unlit = s.lanterns.filter(l => !l.lit);
  const need = unlit.length ? Math.min(...unlit.map(l => T.lantern_cost - l.charge)) : 0;
  const near = (list) => { let b = null, bd = Infinity; for (const o of list) { const d = routeCost(sim, p.pos, o.pos); if (d < bd) { bd = d; b = o; } } return b; };
  let target;
  if (p.carried >= T.carry_capacity || p.carried >= need || (p.carried > 0 && s.motes.length === 0)) {
    target = near(unlit);
    if (target && hyp(target.pos[0] - p.pos[0], target.pos[1] - p.pos[1], target.pos[2] - p.pos[2]) <= T.interact_radius * 0.9) inp.interact = true;
  }
  if (!target) target = near(s.motes.filter(m => m.readyTick <= s.tick));
  if (!target) { if (s.tick % 2 === 1) inp.pulse = false; return inp; }
  const wp = waypoint(sim, p.pos, target.pos);
  let dx = wp[0] - p.pos[0], dz = wp[1] - p.pos[2], d = hyp(dx, dz);
  if (d > 0.05) { dx /= d; dz /= d; } else { dx = 0; dz = 0; }
  // avoidance: steer away from active shades nearby (unless standing in a safe zone)
  const safe = s.lanterns.some(l => l.lit && xz(l.pos, p.pos) < T.safe_radius - 0.5);
  let ax = 0, az = 0, closest = Infinity;
  if (!safe && p.invuln === 0) for (const sh of s.shades) {
    if (sh.state !== 'chase') continue;
    const ex = p.pos[0] - sh.pos[0], ez = p.pos[2] - sh.pos[2], e = hyp(ex, ez);
    if (e < 5 && Math.abs(sh.pos[1] - p.pos[1]) < 2) { const w = (5 - e) / 5 * 2.5; ax += ex / (e || 1) * w; az += ez / (e || 1) * w; closest = Math.min(closest, e); }
  }
  if (closest < 2.2 && p.dashCd === 0 && !inp.pulse && sim.ground(p.pos[0] + dx * 3.5, p.pos[2] + dz * 3.5) !== null) inp.dash = true;
  if (closest < Infinity && !inp.interact) {
    dx += ax; dz += az;
    if (sim.ground(p.pos[0] + dx * 1.5, p.pos[2] + dz * 1.5) === null) { dx -= ax; dz -= az; }   // never steer off the edge
    const l = hyp(dx, dz) || 1; dx /= l; dz /= l;
  }
  inp.move = inp.interact ? [0, 0] : [dx, dz];
  if (inp.dash && hyp(...inp.move) < 0.1) inp.dash = false;
  if (s.tick % 2 === 1) inp.pulse = inp.interact = inp.dash = false;   // release buttons every other tick so presses register
  return inp;
}
function routeCost(sim, a, b) {
  const n = sim.state.night;
  let c = xz(a, b);
  if (n === 2 && (a[0] > 35) !== (b[0] > 35)) c += 20;
  if (n === 3) c += Math.abs(sim.level(b[0], b[2]) - sim.level(a[0], a[2])) * 25;
  return c;
}
// Route through the bridge (night 2) or ramps / launch pad (night 3).
function waypoint(sim, a, b) {
  const n = sim.state.night;
  if (n === 2) {
    const ia = a[0] > 35 ? 1 : 0, ib = b[0] > 35 ? 1 : 0;
    if (ia !== ib) {
      const onBridge = a[0] >= 25 && a[0] <= 45 && Math.abs(a[2]) < 1.5;
      if (onBridge) return [ib ? 46 : 24, 0];
      const entry = ia ? [44.5, 0] : [25.5, 0];
      return Math.abs(a[2]) > 0.5 || Math.abs(a[0] - entry[0]) > 1.5 ? entry : [ib ? 46 : 24, 0];
    }
    return [b[0], b[2]];
  }
  if (n === 3) {
    const la = sim.level(a[0], a[2]), lb = sim.level(b[0], b[2]);
    if (lb > la) {
      if (la === 0) {   // go to nearest ramp foot, then climb radially
        const A = [30, 150].map(x => x * Math.PI / 180);
        let best = A[0], bd = Infinity;
        for (const ang of A) { const d = hyp(Math.cos(ang) * 31 - a[0], Math.sin(ang) * 31 - a[2]); if (d < bd) { bd = d; best = ang; } }
        const along = a[0] * Math.cos(best) + a[2] * Math.sin(best), across = -a[0] * Math.sin(best) + a[2] * Math.cos(best);
        if (Math.abs(across) < 0.6 && along <= 31.5) return [Math.cos(best) * 22, Math.sin(best) * 22];
        return [Math.cos(best) * 31.5, Math.sin(best) * 31.5];
      }
      return [0, 13];   // tier 1 -> tier 2 via launch pad
    }
    if (lb < la && la === 2) return [0, 9.5];   // step off tier 2 toward +Z onto tier 1
    if (la === 1 && lb === 0) {                  // walk off the outer edge of tier 1 nearest the target
      const ang = Math.atan2(Math.max(b[2], 1), b[0]); return [Math.cos(ang) * 25.5, Math.sin(ang) * 25.5];
    }
    return [b[0], b[2]];
  }
  return [b[0], b[2]];
}
