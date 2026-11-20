// Browser renderer + UI flow. All rules live in src/core/sim.js; this file only draws state and maps keys -> input.
// Decorative extras (props, Thỏ Ngọc, Chú Cuội, leaves, music) are render-only and never touch the sim.
import * as THREE from 'three';
import { botInput, DT, TPS } from '../core/sim.js';
import { MAPS } from '../core/maps.js';
import { createCampaign } from '../core/campaign.js';
import { createBenchSim, cameraAt, frameStats, BENCH } from '../core/bench.js';
import { validateName, addEntry, sortEntries, isoLocal } from '../core/leaderboard.js';
import { initAudio, sfx, toggleMusic, setVolume } from './audio.js';

const contract = await (await fetch('./game.contract.json')).json();
const T = contract.tuning;
const params = new URLSearchParams(location.search);
const BENCH_MODE = params.has('bench');   // Ticket-04 benchmark scene: standard scene only, creative extras off
const $ = (id) => document.getElementById(id);
const C = {   // standard palette (Ticket-02)
  sky: '#0E1430', fog: '#1B2350', grass: '#2F5D50', sand: '#C9B48A', wood: '#6B4A2F', sea: '#12384A',
  lampOn: '#FFB347', lampCore: '#FFE9B0', lampOff: '#5B5F6E', moteCore: '#FFF6C2', moteHalo: '#FFE58A',
  shade: '#120A1A', shadeRim: '#7A3CFF', shadeStun: '#3A3450', shirt: '#E8E2D0', scarf: '#C8102E', gold: '#F2C14E', drifter: '#8FA3B8',
};

// ---------- settings (persisted) ----------
const ACTIONS = [   // rebindable actions (Ticket-04 §4)
  ['up', 'Đi tới'], ['down', 'Đi lùi'], ['left', 'Sang trái'], ['right', 'Sang phải'],
  ['jump', 'Nhảy'], ['dash', 'Lướt'], ['interact', 'Nạp / châm dầu'], ['pulse', 'Tỏa sáng'], ['pause', 'Tạm dừng'],
];
const DEFAULT_KEYS = { up: 'w', down: 's', left: 'a', right: 'd', jump: ' ', dash: 'shift', interact: 'e', pulse: 'f', pause: 'escape' };
const RESERVED = { m: 'bật/tắt nhạc', enter: 'xác nhận menu' };
const settings = { volume: 0.8, sens: 1, colorblind: false, reducedMotion: false, bigText: false, keys: { ...DEFAULT_KEYS } };
try { const saved = JSON.parse(localStorage.getItem('ddl-settings') || '{}'); Object.assign(settings, saved, { keys: { ...DEFAULT_KEYS, ...(saved.keys || {}) } }); } catch {}
if (params.has('cb')) settings.colorblind = true;   // screenshot helper
const saveSettings = () => { try { localStorage.setItem('ddl-settings', JSON.stringify(settings)); } catch {} };
setVolume(settings.volume);
const applyA11y = () => { document.body.classList.toggle('rm', !!settings.reducedMotion); document.body.classList.toggle('big', !!settings.bigText); };
const applyPalette = () => {   // Ticket-03 colour-blind palette
  document.body.classList.toggle('cb', !!settings.colorblind);
  rimMat.color.set(settings.colorblind ? '#00B3FF' : C.shadeRim); eyeMat.color.set(settings.colorblind ? '#00B3FF' : '#e9dcff'); eyeMat.emissive.set(settings.colorblind ? '#00B3FF' : '#e9dcff');
};

// ---------- renderer / scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: params.has('shot') });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(C.sky);
scene.fog = new THREE.Fog(C.fog, 45, 130);
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 400);
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

const ambient = new THREE.AmbientLight('#ffd9a8', 0.15); scene.add(ambient);       // 0.15 + 0.55 * progress
const sky = new THREE.HemisphereLight('#8fa0e0', '#2a2440', 0.55); scene.add(sky);    // constant moonlit fill so the night stays readable
const moon = new THREE.DirectionalLight('#dfe4ff', 0.9); moon.position.set(-30, 50, 20); moon.castShadow = true;
Object.assign(moon.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, far: 160 }); moon.shadow.mapSize.set(1024, 1024);
scene.add(moon, moon.target);

const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...o });
const glow = (color, i = 1.5) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: i });
function mesh(geo, m, x = 0, y = 0, z = 0, parent = scene) { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; parent.add(o); return o; }
function radialTex(color) {
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
}

// static sky
mesh(new THREE.SphereGeometry(5, 24, 16), glow('#fff6d8', 1.2), -80, 70, -110).castShadow = false;
{ const g = new THREE.BufferGeometry(), pts = [];
  for (let i = 0; i < 700; i++) { const a = Math.random() * 6.283, e = 0.12 + Math.random() * 1.3, r = 200; pts.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r); }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: '#fff3c4', size: 0.8, fog: false }))); }

// ---------- per-night world (rebuilt on each night) ----------
let world = new THREE.Group(); scene.add(world);
const M = { grass: mat(C.grass), sand: mat(C.sand), wood: mat(C.wood), cliff: mat('#4a3b33'), sea: mat(C.sea, { roughness: 1 }), stone: mat('#8a8790') };
function island(cx, cz, r, parent) {
  mesh(new THREE.CylinderGeometry(r, r - 2, 3, 72), M.grass, cx, -1.5, cz, parent);
  mesh(new THREE.ConeGeometry(r - 2, r * 0.45, 48), M.cliff, cx, -3 - r * 0.225, cz, parent).rotation.x = Math.PI;
}
function tree(x, z, s, parent, y = 0) {
  mesh(new THREE.CylinderGeometry(0.25 * s, 0.35 * s, 2 * s), M.wood, x, y + s, z, parent);
  mesh(new THREE.SphereGeometry(1.4 * s, 12, 10), mat('#2f6b3c'), x, y + 2.6 * s, z, parent);
}
function house(x, z, r, parent) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = r; parent.add(g);
  mesh(new THREE.BoxGeometry(3, 2, 2.5), mat('#e9d9b8'), 0, 1, 0, g);
  mesh(new THREE.ConeGeometry(2.6, 1.4, 4), mat('#b5523b'), 0, 2.7, 0, g).rotation.y = Math.PI / 4;
  mesh(new THREE.BoxGeometry(0.6, 0.5, 0.05), glow('#ffc46b', 0.6), 0.9, 1.3, 1.26, g);
}
function starLantern(color = C.gold) {   // đèn ông sao
  const sh = new THREE.Shape();
  for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.18 : 0.42, a = i / 10 * 6.283 + Math.PI / 2; i ? sh.lineTo(Math.cos(a) * r, Math.sin(a) * r) : sh.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  return new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.12, bevelEnabled: false }), glow(color, 1.2));
}
let kite = null;
function buildWorld(night) {
  scene.remove(world); world = new THREE.Group(); scene.add(world); kite = null;
  const cloudMat = mat('#3d5f7a', { roughness: 1 });
  mesh(new THREE.CircleGeometry(260, 48), M.sea, 0, -14, 0, world).rotation.x = -Math.PI / 2;
  for (let i = 0; i < 70; i++) {
    const a = Math.random() * 6.283, r = 55 + Math.random() * 90;
    const c = mesh(new THREE.SphereGeometry(4 + Math.random() * 5, 10, 8), cloudMat, (night === 2 ? 35 : 0) + Math.cos(a) * r, -9 - Math.random() * 4, Math.sin(a) * r, world);
    c.scale.y = 0.4; c.castShadow = false;
  }
  if (night === 1) {
    island(0, 0, 40, world);
    mesh(new THREE.RingGeometry(23.5, 26.5, 72), M.sand, 0, 0.02, 0, world).rotation.x = -Math.PI / 2;
    [[-8, -6], [9, -4], [-30, 14], [30, 15], [-6, 34], [16, -32], [-28, -24], [35, -5], [6, 8]].forEach(([x, z]) => tree(x, z, 1.1, world));
    if (!BENCH_MODE) {   // creative props (Phase 1 'Sáng tạo của tôi') are off in the benchmark scene
    for (const [x, z, r] of [[-3, -16, 0.3], [17, 3, -1.2], [-30, -3, 1.4]]) house(x, z, r, world);
    // Cây đa + Chú Cuội (Vietnamese folklore, public domain; original low-poly design)
    const g = new THREE.Group(); g.position.set(-6, 0, 17); world.add(g);
    mesh(new THREE.CylinderGeometry(0.8, 1.3, 4), M.wood, 0, 2, 0, g);
    for (const [x, y, z, r] of [[0, 5, 0, 3], [2, 4.3, 1, 2.2], [-2, 4.4, -1, 2.3]]) mesh(new THREE.SphereGeometry(r, 14, 10), mat('#2f6b3c'), x, y, z, g);
    const cuoi = new THREE.Group(); cuoi.position.set(1.6, 0, 1.6); g.add(cuoi);
    mesh(new THREE.CylinderGeometry(0.3, 0.4, 0.8), mat('#6b5a8c'), 0, 0.4, 0, cuoi);
    mesh(new THREE.SphereGeometry(0.3, 12, 10), mat('#f1c9a0'), 0, 1.05, 0, cuoi);
    mesh(new THREE.ConeGeometry(0.45, 0.25, 16), mat(C.sand), 0, 1.35, 0, cuoi);
    // vacant lot with 3 concrete pipes
    const pg = new THREE.Group(); pg.position.set(-5, 0, -7); pg.rotation.y = 0.6; world.add(pg);
    const pipe = new THREE.CylinderGeometry(1, 1, 2.6, 20, 1, true), pm = mat('#9a9aa2', { side: THREE.DoubleSide });
    for (const [x, y] of [[-1.05, 1], [1.05, 1], [0, 2.75]]) mesh(pipe, pm, x, y, 0, pg).rotation.x = Math.PI / 2;
    mesh(new THREE.CylinderGeometry(0.08, 0.08, 2), M.wood, -16, 1, -8, world);
    kite = mesh(new THREE.OctahedronGeometry(1, 0), glow('#ff7b54', 0.4), -13, 12, -14, world); kite.scale.set(1, 1.4, 0.15);
    world.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-16, 2, -8), new THREE.Vector3(-13, 11, -14)]), new THREE.LineBasicMaterial({ color: '#eee' })));
    }
  } else if (night === 2) {
    island(0, 0, 28, world); island(70, 0, 28, world);
    mesh(new THREE.BoxGeometry(18, 0.3, 4), M.wood, 35, -0.15, 0, world);
    for (let x = 26.5; x < 44; x += 1.2) mesh(new THREE.BoxGeometry(0.15, 0.32, 4.1), mat('#8a6a3f'), x, -0.1, 0, world);
    [[-10, 8], [8, -18], [-18, -15], [80, 15], [62, 18], [90, -15], [10, 22]].forEach(([x, z]) => {   // areca palms (cau)
      mesh(new THREE.CylinderGeometry(0.18, 0.25, 6), mat('#8a7a5a'), x, 3, z, world);
      for (let i = 0; i < 6; i++) { const l = mesh(new THREE.ConeGeometry(0.4, 3, 4), mat('#3f8a4a'), x, 6, z, world); l.rotation.z = 1.1; l.rotation.y = i; }
    });
    house(-8, -2, 0.4, world); house(76, -2, -0.6, world);
  } else {
    island(0, 0, 45, world);
    const sh = new THREE.Shape(); sh.absarc(0, 0, 24, Math.PI, 2 * Math.PI, false); sh.absarc(0, 0, 12, 2 * Math.PI, Math.PI, true);
    const t1 = mesh(new THREE.ExtrudeGeometry(sh, { depth: 3, bevelEnabled: false, curveSegments: 40 }), M.grass, 0, 0, 0, world); t1.rotation.x = -Math.PI / 2;
    mesh(new THREE.CylinderGeometry(8, 8, 6, 48), M.grass, 0, 3, 0, world);                   // tier 2
    mesh(new THREE.CylinderGeometry(2, 2, 8, 24), M.stone, 0, 10, 0, world);                  // bell tower
    mesh(new THREE.ConeGeometry(2.6, 2, 24), mat('#b5523b'), 0, 15, 0, world);
    mesh(new THREE.SphereGeometry(0.9, 16, 10, 0, 6.283, 0, 1.6), mat(C.gold, { metalness: 0.6, roughness: 0.3 }), 0, 13.2, 0, world);
    for (const deg of [30, 150]) {
      const tri = new THREE.Shape([new THREE.Vector2(24, 0), new THREE.Vector2(30, 0), new THREE.Vector2(24, 3)]);
      const geo = new THREE.ExtrudeGeometry(tri, { depth: 3, bevelEnabled: false }); geo.translate(0, 0, -1.5);
      const g = new THREE.Group(); g.rotation.y = -deg * Math.PI / 180; world.add(g); mesh(geo, M.sand, 0, 0, 0, g);
    }
    [[-30, -25], [30, -25], [0, -40], [-40, 5], [40, 5]].forEach(([x, z]) => tree(x, z, 1.2, world));
  }
  for (const pad of MAPS[night].pads) mesh(new THREE.CylinderGeometry(1, 1, 0.15, 24), glow(C.gold, 0.8), pad.pos[0], pad.pos[1] + 0.08, pad.pos[2], world);
}

// ---------- characters (original designs) ----------
const may = new THREE.Group(); scene.add(may);
mesh(new THREE.CylinderGeometry(0.35, 0.5, 1.0, 16), mat(C.shirt), 0, 0.75, 0, may);
mesh(new THREE.TorusGeometry(0.33, 0.08, 8, 20), mat(C.scarf), 0, 1.2, 0, may).rotation.x = Math.PI / 2;   // red scarf
mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.3, 12), mat('#2d3f6e'), 0, 0.15, 0, may);
mesh(new THREE.SphereGeometry(0.33, 16, 12), mat('#f6d2b0'), 0, 1.5, 0, may);
for (const sx of [-0.12, 0.12]) mesh(new THREE.SphereGeometry(0.05, 8, 6), mat('#222'), sx, 1.55, 0.3, may);
mesh(new THREE.ConeGeometry(0.85, 0.55, 24), mat(C.sand), 0, 1.95, 0, may);   // nón lá
mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.35), mat('#555'), 0, 1.55, 0.78, may);
const mayLamp = mesh(new THREE.SphereGeometry(0.14, 12, 10), glow(C.lampOn, 2), 0, 1.32, 0.78, may); mayLamp.scale.y = 1.3;
const mayLight = new THREE.PointLight(C.lampOn, 6, 10, 1.6); mayLight.position.set(0, 1.4, 0.8); may.add(mayLight);
const halo = new THREE.Group(); may.add(halo);
const moteMat = glow(C.moteCore, 3);
for (let i = 0; i < T.carry_capacity; i++) mesh(new THREE.SphereGeometry(0.07, 8, 6), moteMat, 0, 0, 0, halo).castShadow = false;
const rabbit = new THREE.Group(); scene.add(rabbit);
mesh(new THREE.SphereGeometry(0.3, 14, 10), mat('#f7f3ff'), 0, 0.3, 0, rabbit).scale.set(1, 0.9, 1.2);
mesh(new THREE.SphereGeometry(0.2, 12, 10), mat('#f7f3ff'), 0, 0.6, 0.25, rabbit);
for (const s of [-1, 1]) mesh(new THREE.CapsuleGeometry(0.05, 0.3, 4, 8), mat('#ffd6e6'), s * 0.08, 0.9, 0.2, rabbit).rotation.z = s * 0.2;
const rabbitStar = starLantern(); rabbitStar.scale.setScalar(0.5); rabbitStar.position.set(0.3, 0.9, 0.2); rabbit.add(rabbitStar);

// Instanced rendering: one draw call per part for all Bóng Mực / đom đóm (keeps 200 shades + 100 motes fast).
const MAX_SHADES = 256, MAX_MOTES = 512;
const moteMatI = glow(C.moteCore, 3);
const motesI = new THREE.InstancedMesh(new THREE.SphereGeometry(0.13, 8, 6), moteMatI, MAX_MOTES); motesI.count = 0; motesI.frustumCulled = false; scene.add(motesI);
const haloPos = new Float32Array(MAX_MOTES * 3), haloGeo = new THREE.BufferGeometry();
haloGeo.setAttribute('position', new THREE.BufferAttribute(haloPos, 3).setUsage(THREE.DynamicDrawUsage));
const halos = new THREE.Points(haloGeo, new THREE.PointsMaterial({ map: radialTex(C.moteHalo), size: 1.1, sizeAttenuation: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
halos.frustumCulled = false; scene.add(halos);
const rimMat = new THREE.MeshBasicMaterial({ color: C.shadeRim, side: THREE.BackSide });
const eyeMat = glow('#e9dcff', 0.8);
const bodyMatI = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.4 });   // per-instance colour: normal / stunned
const COL_SHADE = new THREE.Color(C.shade), COL_STUN = new THREE.Color(C.shadeStun);
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
const local = (x, y, z, sx = 1, sy = 1, sz = 1, rx = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, 0, 0)), new THREE.Vector3(sx, sy, sz));
const SHADE_PARTS = [
  { geo: new THREE.SphereGeometry(0.7, 16, 12), mat: bodyMatI, m: local(0, 0.8, 0, 1, 1.15, 1), body: true, wobble: true },
  { geo: new THREE.SphereGeometry(0.76, 16, 12), mat: rimMat, m: local(0, 0.8, 0, 1, 1.15, 1), wobble: true },   // outline
  ...[0, 1, 2, 3, 4].map(i => ({ geo: new THREE.ConeGeometry(0.18, 0.5, 8), mat: bodyMatI, m: local(Math.cos(i / 5 * 6.283) * 0.5, 0.2, Math.sin(i / 5 * 6.283) * 0.5, 1, 1, 1, Math.PI), body: true })),
  ...[-1, 1].map(sx => ({ geo: new THREE.SphereGeometry(0.14, 10, 8), mat: eyeMat, m: local(sx * 0.24, 1.0, 0.58) })),
  ...[-1, 1].map(sx => ({ geo: new THREE.SphereGeometry(0.06, 8, 6), mat: mat('#140a20'), m: local(sx * 0.24, 1.0, 0.7) })),
].map(part => { const im = new THREE.InstancedMesh(part.geo, part.mat, MAX_SHADES); im.count = 0; im.castShadow = true; im.frustumCulled = false; scene.add(im); return { ...part, im }; });
const shadeSpin = new Map();
function makeDrifter() {   // grey-blue silk ribbon
  const g = new THREE.Group(); scene.add(g);
  const m = new THREE.MeshStandardMaterial({ color: C.drifter, emissive: C.drifter, emissiveIntensity: 0.25, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
  const segs = []; for (let i = 0; i < 7; i++) { const s = mesh(new THREE.PlaneGeometry(0.5, 0.35), m, -i * 0.38, 0, 0, g); s.castShadow = false; segs.push(s); }
  return { g, segs };
}
function makeCharm() {   // red talisman with gold border
  const g = new THREE.Group(); scene.add(g);
  mesh(new THREE.BoxGeometry(0.7, 1.0, 0.05), mat(C.gold, { metalness: 0.4 }), 0, 0, 0, g);
  mesh(new THREE.BoxGeometry(0.58, 0.88, 0.07), glow(C.scarf, 0.5), 0, 0, 0, g);
  g.add(new THREE.PointLight('#ff6060', 3, 5));
  return g;
}
const lanternViews = [];
function buildLanterns(list) {
  for (const v of lanternViews) scene.remove(v.g); lanternViews.length = 0;
  for (const l of list) {
    const g = new THREE.Group(); g.position.set(...l.pos); scene.add(g);
    mesh(new THREE.CylinderGeometry(0.15, 0.2, 3.2), M.wood, 0, 1.6, 0, g);
    mesh(new THREE.BoxGeometry(1.6, 0.12, 0.12), M.wood, 0.6, 3.2, 0, g);
    const body = mesh(new THREE.SphereGeometry(0.75, 20, 14), mat(C.lampOff), 1.3, 2.3, 0, g); body.scale.y = 1.25;
    const core = mesh(new THREE.SphereGeometry(0.35, 12, 10), glow(C.lampCore, 2), 1.3, 2.3, 0, g); core.visible = false;
    for (const y of [3.2, 1.35]) mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.15, 16), mat(C.gold), 1.3, y, 0, g);
    const light = new THREE.PointLight(C.lampOn, 0, 24, 1.4); light.position.set(1.3, 2.3, 0); g.add(light);
    const ring = new THREE.Mesh(new THREE.RingGeometry(T.safe_radius - 0.25, T.safe_radius, 64), new THREE.MeshBasicMaterial({ color: C.lampOn, transparent: true, opacity: 0, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; g.add(ring);
    const bar = mesh(new THREE.BoxGeometry(1.4, 0.12, 0.12), glow(C.moteHalo, 1.5), 1.3, 0.6, 0, g); bar.scale.x = 0.001;
    // fuel bar above the lantern + a torn patch shown when the lantern is out (shape cue, not colour)
    const fuelBar = mesh(new THREE.BoxGeometry(1.4, 0.14, 0.14), glow(C.lampOn, 1.2), 1.3, 3.55, 0, g); fuelBar.visible = false;
    const tear = mesh(new THREE.PlaneGeometry(0.45, 0.6), new THREE.MeshBasicMaterial({ color: '#05060a', side: THREE.DoubleSide }), 1.3, 2.3, 0.76, g);
    tear.rotation.z = 0.5; tear.castShadow = false;
    lanternViews.push({ g, body, core, light, ring, bar, fuelBar, tear, wasLit: false, offMat: body.material, onMat: glow(C.lampOn, 1.4) });
  }
}
const pulseRing = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 48), new THREE.MeshBasicMaterial({ color: C.lampCore, transparent: true, opacity: 0, side: THREE.DoubleSide }));
pulseRing.rotation.x = -Math.PI / 2; scene.add(pulseRing);
const leaves = new THREE.Group(); scene.add(leaves);
for (let i = 0; i < 60; i++) { const l = mesh(new THREE.PlaneGeometry(0.25, 0.12), mat('#8fbf5a', { side: THREE.DoubleSide }), 0, 0, 0, leaves); l.castShadow = false; }
leaves.visible = false;

// ---------- game flow ----------
const INTRO = {
  1: '"Đảo Bến là nơi ông thắp ngọn đèn đầu tiên. Gom đom đóm, nạp đủ mười đốm cho mỗi đèn nhé. Gặp Bóng Mực thì tỏa sáng, hoặc chạy vào vùng đèn đã thắp." — Ông Đăng',
  2: '"Đảo Cau có hai nửa, nối bằng cây cầu tre không lan can. Đứng lên bục vàng để bay sang đảo kia. Coi chừng Gió Lạc, chúng thích giật đom đóm của người mang nhiều." — Ông Đăng',
  3: '"Đảo Chuông cao nhất quần đảo. Leo dốc lên tầng giữa, nhảy bục để lên tháp. Khi lá bay rì rào là gió lớn sắp tới, đứng vững nhé cháu." — Ông Đăng',
};
const seedOf = () => params.has('seed') ? Number(params.get('seed')) : (Date.now() & 0xffff);
let campaignSeed = seedOf();
let sim = null, campaign = createCampaign(T, { seed: campaignSeed }), night = 1, mode = 'menu', acc = 0, ended = false;
const overlays = ['ovMenu', 'ovIntro', 'ovResult', 'ovDawn', 'ovPause', 'ovSettings', 'ovBoard'];
const show = (id) => { overlays.forEach(o => $(o).classList.toggle('show', o === id)); document.body.classList.toggle('inmenu', id === 'ovMenu' || id === 'ovBoard'); };
let settingsReturn = 'ovMenu';
const drifterViews = new Map(), charmViews = new Map();
let camYaw = Math.PI, camPitch = 0.42, dragging = false, toastT = 0, lastCountdown = -1;

function loadNight(n) {
  night = n; sim = campaign.newSim();   // campaign decides the night; each night is a fresh sim (flames refill)
  buildWorld(n); buildLanterns(sim.state.lanterns);
  shadeSpin.clear(); captionState.clear(); lastCountdown = -1;
  for (const v of drifterViews.values()) scene.remove(v.g); drifterViews.clear();
  for (const v of charmViews.values()) scene.remove(v); charmViews.clear();
  camYaw = Math.PI; ended = false; acc = 0; lastCountdown = -1;   // camera behind Mây, looking toward +Z
  const p = sim.state.player; camera.position.set(p.pos[0], p.pos[1] + 8, p.pos[2] - 11);
}
function toIntro(n) { loadNight(n); $('introTitle').textContent = `Đêm ${n} – ${MAPS[n].name}`;
  $('introText').textContent = INTRO[n] + ` Đèn giờ cạn dầu dần: châm dầu hoặc thắp lại, giữ ít nhất ${Math.ceil(T.win_ratio * sim.state.lanterns.length - 1e-9)}/${sim.state.lanterns.length} đèn sáng tới bình minh.`; show('ovIntro'); mode = 'intro'; }
function play() { initAudio(); show(null); mode = 'play'; $('help').style.display = 'block'; }
function pause() { if (mode !== 'play') return; mode = 'pause'; show('ovPause'); sim.step({ pause: true }); sim.step({ pause: false }); }
function resume() { if (mode !== 'pause') return; sim.step({ pause: true }); sim.step({ pause: false }); mode = 'play'; show(null); }
const totalWon = () => campaign.total();
function endNight() {
  const s = sim.state, sc = sim.score(), won = s.status === 'won';
  const next = campaign.finishNight({ status: s.status, score: sc.total });   // rule lives in src/core/campaign.js
  if (next.next === 'dawn') {
    const ws = campaign.wonScores();
    const rows = [1, 2, 3].map(n => `<tr><td>Đêm ${n} – ${MAPS[n].name}</td><td>${ws[n] ?? 0}</td></tr>`).join('');
    $('dawnTable').innerHTML = rows + `<tr><td><b>Tổng điểm</b></td><td><b>${totalWon()}</b></td></tr>`;
    prepareSave('dawn'); show('ovDawn'); mode = 'dawn'; return;
  }
  $('resTitle').textContent = won ? `🏮 ${MAPS[night].name} đã sáng!` : '🌫️ Sương đen vẫn còn…';
  const need = Math.ceil(T.win_ratio * s.lanterns.length - 1e-9);
  $('resMsg').textContent = won ? `Mây giữ ${s.lanterns.filter(l => l.lit).length} đèn sáng tới bình minh. Bóng Mực lui vào biển mây.` : s.reason === 'dawn' ? `Bình minh tới nhưng chưa đủ ${need} đèn sáng.` : 'Mây đã hết Ngọn Lửa.';
  const k = T.score;
  const st = s.score, pulsePts = (st.pulseHits - st.pulseDrainHits) * k.per_stun + st.pulseDrainHits * 15;
  $('resTable').innerHTML = `<tr><td>Đom đóm nạp × ${k.per_mote}</td><td>${st.motes * k.per_mote}</td></tr>
    <tr><td>Thắp lần đầu × ${k.per_lantern}</td><td>${st.lanterns * k.per_lantern}</td></tr>
    <tr><td>Thắp lại × 40</td><td>${st.relights * 40}</td></tr>
    <tr><td>Tỏa Sáng trúng Bóng Mực</td><td>${pulsePts}</td></tr>
    <tr><td>Bình minh: đèn sáng (50 + dầu)</td><td>${sc.dawn_bonus}</td></tr><tr><td>Bình minh: Ngọn Lửa</td><td>${sc.flame_bonus}</td></tr>
    <tr><td><b>Điểm Đêm ${night}</b></td><td><b>${sc.total}</b></td></tr>
    <tr><td>Tổng các Đêm đã thắng</td><td>${totalWon()}</td></tr>`;
  $('btnNext').style.display = won ? '' : 'none';
  if (!won) prepareSave('res'); else $('resSave').style.display = 'none';
  show('ovResult'); mode = 'result';
}
$('btnStart').onclick = () => { campaignSeed = seedOf(); campaign = createCampaign(T, { seed: campaignSeed }); initAudio(); toIntro(campaign.night); };
$('btnPlay').onclick = play;
$('btnNext').onclick = () => toIntro(campaign.night);
$('btnRetry').onclick = () => toIntro(night);
$('btnResMenu').onclick = $('btnDawnMenu').onclick = $('btnPauseMenu').onclick = () => { show('ovMenu'); mode = 'menu'; };
$('btnResume').onclick = resume;
// ---------- leaderboard (disk via server.js API; localStorage fallback when served statically) ----------
const nightsWon = () => Object.keys(campaign.wonScores()).length;
function prepareSave(prefix) {
  if (prefix === 'res') { $('resSave').style.display = ''; $('resSaveScore').textContent = totalWon(); }
  $(`${prefix}Err`).textContent = ''; $(`${prefix}Err`).className = 'err';
  $(`btn${prefix === 'res' ? 'Res' : 'Dawn'}Save`).disabled = false;
}
async function saveScore(prefix) {
  const input = $(`${prefix}Name`), err = $(`${prefix}Err`), btn = $(`btn${prefix === 'res' ? 'Res' : 'Dawn'}Save`);
  const v = validateName(input.value);
  if (!v.ok) { err.className = 'err'; err.textContent = v.error; return; }
  const entry = { name: v.name, score: totalWon(), nights_won: nightsWon(), seed: campaignSeed };
  try {
    const r = await fetch('./api/leaderboard', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(entry) });
    if (!r.ok) throw new Error((await r.json()).error || r.status);
  } catch (e) {
    try {   // fallback: browser storage
      const list = addEntry(JSON.parse(localStorage.getItem('ddl-board') || '[]'), { ...entry, achieved_at: isoLocal(new Date()) });
      localStorage.setItem('ddl-board', JSON.stringify(list));
    } catch (e2) { err.className = 'err'; err.textContent = 'Không lưu được: ' + (e2.message || e.message); return; }
  }
  err.className = 'ok'; err.textContent = `Đã lưu ${v.name}: ${entry.score} điểm`; btn.disabled = true;
}
$('btnResSave').onclick = () => saveScore('res');
$('btnDawnSave').onclick = () => saveScore('dawn');
async function openBoard() {
  let entries = [], note = 'Lưu trong data/leaderboard.json';
  try { entries = (await (await fetch('./api/leaderboard')).json()).entries; }
  catch { try { entries = sortEntries(JSON.parse(localStorage.getItem('ddl-board') || '[]')); note = 'Lưu trong trình duyệt (không có server)'; } catch {} }
  const esc = (t) => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  $('boardTable').innerHTML = '<tr><th>#</th><th>Tên</th><th>Điểm</th><th>Đêm thắng</th><th>Ngày</th></tr>' +
    (entries.length ? entries.map((e, i) => `<tr><td>${i + 1}</td><td>${esc(e.name)}</td><td>${e.score}</td><td>${e.nights_won}/3</td><td>${esc(e.achieved_at.slice(0, 10))}</td></tr>`).join('') : '<tr><td colspan="5">Chưa có ai. Hãy là người đầu tiên!</td></tr>');
  $('boardNote').textContent = note;
  show('ovBoard');
}
$('btnMenuBoard').onclick = openBoard;
$('btnBoardBack').onclick = () => show('ovMenu');
$('btnPauseRetry').onclick = () => toIntro(night);
const openSettings = (from) => { settingsReturn = from; show('ovSettings'); syncSettingsUI(); };
$('btnMenuSettings').onclick = () => openSettings('ovMenu');
$('btnPauseSettings').onclick = () => openSettings('ovPause');
$('btnSettingsBack').onclick = () => show(settingsReturn);
function syncSettingsUI() { $('setRm').checked = !!settings.reducedMotion; $('setBig').checked = !!settings.bigText; renderKeys(); $('setCb').checked = !!settings.colorblind; $('setVol').value = settings.volume; $('setSens').value = settings.sens; $('setVolV').textContent = Math.round(settings.volume * 100) + '%'; $('setSensV').textContent = settings.sens.toFixed(1) + '×'; }
$('setVol').oninput = (e) => { settings.volume = +e.target.value; setVolume(settings.volume); saveSettings(); syncSettingsUI(); };
$('setSens').oninput = (e) => { settings.sens = +e.target.value; saveSettings(); syncSettingsUI(); };
$('setCb').onchange = (e) => { settings.colorblind = e.target.checked; saveSettings(); applyPalette(); };
$('setRm').onchange = (e) => { settings.reducedMotion = e.target.checked; saveSettings(); applyA11y(); };
$('setBig').onchange = (e) => { settings.bigText = e.target.checked; saveSettings(); applyA11y(); };
const keyName = (k) => ({ ' ': 'Space', shift: 'Shift', escape: 'Esc', arrowup: '↑', arrowdown: '↓', arrowleft: '←', arrowright: '→', control: 'Ctrl', alt: 'Alt', tab: 'Tab' }[k] || (k.length === 1 ? k.toUpperCase() : k));
let listening = null;
function keyConflicts() {
  const byKey = {}; for (const [a] of ACTIONS) (byKey[settings.keys[a]] ||= []).push(a);
  return Object.entries(byKey).filter(([k, as]) => as.length > 1 || RESERVED[k]);
}
function renderKeys() {
  const conflicts = keyConflicts(), bad = new Set(conflicts.flatMap(([k, as]) => as));
  $('keys').innerHTML = ACTIONS.map(([a, label]) => `<span>${label}</span><button data-act="${a}" class="${listening === a ? 'listen' : bad.has(a) ? 'conflict' : ''}">${listening === a ? 'Nhấn phím…' : keyName(settings.keys[a])}</button>`).join('');
  $('keys').querySelectorAll('button').forEach(b => b.onclick = () => { listening = listening === b.dataset.act ? null : b.dataset.act; renderKeys(); });
  $('keyErr').textContent = conflicts.map(([k, as]) => RESERVED[k] ? `⚠ Phím ${keyName(k)} đang dùng để ${RESERVED[k]}` : `⚠ Trùng phím ${keyName(k)}: ${as.map(a => ACTIONS.find(x => x[0] === a)[1]).join(', ')}`).join(' · ');
  updateKeyHints();
}
$('btnKeysReset').onclick = () => { settings.keys = { ...DEFAULT_KEYS }; listening = null; saveSettings(); renderKeys(); };
function updateKeyHints() {
  const k = (a) => keyName(settings.keys[a]);
  const text = `${k('up')}${k('left')}${k('down')}${k('right')}: đi · ${k('jump')}: nhảy · ${k('dash')}: lướt · ${k('interact')}: nạp đèn · ${k('pulse')}: tỏa sáng · ${k('pause')}: tạm dừng · M: nhạc`;
  $('help').textContent = text; $('menuKeys').textContent = text; $('kDash').textContent = k('dash'); $('kPulse').textContent = k('pulse');
}
applyPalette(); applyA11y(); updateKeyHints(); show('ovMenu');

// ---------- input ----------
const keys = new Set();
addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (listening) {   // capturing a new binding in Settings
    e.preventDefault(); settings.keys[listening] = k; listening = null; saveSettings(); renderKeys(); return;
  }
  if (document.activeElement && document.activeElement.tagName === 'INPUT' && document.activeElement.type === 'text') return;   // typing a name
  keys.add(k);
  if (k === ' ') e.preventDefault();
  if (e.repeat) return;
  if (k === settings.keys.pause) { if (mode === 'play') pause(); else if (mode === 'pause') resume(); }
  if (k === 'm') toast(toggleMusic() ? '🎵 Nhạc: bật' : '🔇 Nhạc: tắt');
  if (k === 'enter') { if (mode === 'intro') play(); else if (mode === 'menu') $('btnStart').click(); }
});
addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => keys.clear());
renderer.domElement.addEventListener('mousedown', () => dragging = true); addEventListener('mouseup', () => dragging = false);
addEventListener('mousemove', e => { if (dragging && mode === 'play') { camYaw -= e.movementX * 0.005 * settings.sens; camPitch = Math.min(1.2, Math.max(0.12, camPitch + e.movementY * 0.004 * settings.sens)); } });
function readInput() {
  let f = 0, r = 0;
  const K = settings.keys, on = (a) => keys.has(K[a]);
  if (on('up')) f++;
  if (on('down')) f--;
  if (on('right')) r++;
  if (on('left')) r--;
  const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw);   // camera-relative forward
  return { move: [fx * f - fz * r, fz * f + fx * r], jump: on('jump'), interact: on('interact'), pulse: on('pulse'), dash: on('dash') };
}

// ---------- HUD ----------
const motebar = $('motebar'); for (let i = 0; i < T.capacity_max; i++) motebar.appendChild(document.createElement('i'));
const moteText = document.createElement('span'); moteText.className = 'motetext'; motebar.appendChild(moteText);
// Captions / visual cues (Ticket-04 §4): shade appeared (+ edge arrow), wind coming, last 10 s, lantern fuel < 30.
const captionState = new Set();
function caption(text, danger = false) {
  const d = document.createElement('div'); d.textContent = text; if (danger) d.className = 'danger';
  $('captions').prepend(d); while ($('captions').children.length > 4) $('captions').lastChild.remove();
  setTimeout(() => d.remove(), 4500);
}
const shadeArrows = new Map();   // shade id -> { el, until }
function pointArrow(el, pos) {
  const v = new THREE.Vector3(pos[0], pos[1] + 1, pos[2]).project(camera);
  const behind = v.z > 1, off = behind || Math.abs(v.x) > 1 || Math.abs(v.y) > 1;
  el.style.display = off ? 'block' : 'none';
  if (!off) return;
  let x = behind ? -v.x : v.x, y = behind ? -v.y : v.y; const m = Math.max(Math.abs(x), Math.abs(y)) || 1; x /= m; y /= m;
  el.style.left = `${(x * 0.9 + 1) / 2 * innerWidth - 14}px`; el.style.top = `${(1 - (y * 0.85 + 1) / 2) * innerHeight - 15}px`; el.style.transform = `rotate(${Math.atan2(x, y)}rad)`;
}
let shake = 0;
function flash(strength = 0.35) { if (settings.reducedMotion) return; const f = $('flash'); f.style.transition = 'none'; f.style.opacity = strength; requestAnimationFrame(() => { f.style.transition = 'opacity .35s'; f.style.opacity = 0; }); }
function toast(msg) { $('toast').textContent = msg; $('toast').style.opacity = 1; toastT = 2; }
function drawHud() {
  const s = sim.state, p = s.player, lit = s.lanterns.filter(l => l.lit).length;
  $('flames').innerHTML = Array.from({ length: T.flames }, (_, i) => `<span class="${i < p.flames ? '' : 'off'}">🔥</span>`).join('');
  const secs = Math.ceil(s.timeLeft / TPS);
  $('timer').textContent = `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
  $('timer').classList.toggle('danger', secs <= 30);
  if (secs <= 30 && settings.colorblind) $('timer').textContent = '⚠ ' + $('timer').textContent;
  const need = Math.ceil(T.win_ratio * s.lanterns.length - 1e-9), cap = sim.capacity();
  $('topright').innerHTML = `🏮 <b>${lit}/${s.lanterns.length}</b> <span class="goal ${lit >= need ? 'ok' : ''}">(cần ${need} lúc bình minh)</span> · Điểm <b>${sim.score().total}</b><div id="nightname">Đêm ${night} – ${MAPS[night].name}${totalWon() ? ` · Tổng ${totalWon()}` : ''}</div>`;
  [...motebar.querySelectorAll('i')].forEach((c, i) => { c.classList.toggle('on', i < p.carried); c.style.display = i < cap ? '' : 'none'; });
  moteText.textContent = `${p.carried}/${cap}`;
  const cd = (id, left, full, ok) => { const el = $(id); el.querySelector('.fill').style.height = `${full ? 100 * left / full : 0}%`; el.classList.toggle('dim', !ok); };
  cd('cdDash', p.charm > 0 ? 0 : p.dashCd, Math.round(T.dash_cooldown_s * TPS), true);
  cd('cdPulse', p.pulseCd, Math.round(T.pulse_cooldown_s * TPS), p.carried >= T.pulse_cost);
  $('charm').style.display = p.charm > 0 ? 'block' : 'none'; $('charm').textContent = `🧧 Bùa Gió ${Math.ceil(p.charm / TPS)}s`;
  let near = null, nd = Infinity, closest = null, cdist = Infinity;
  for (const l of s.lanterns) {
    const d = Math.hypot(l.pos[0] - p.pos[0], l.pos[1] - p.pos[1], l.pos[2] - p.pos[2]);
    const receivable = !l.lit || l.fuel < sim.fuelMax;
    if (receivable && d <= T.interact_radius && d < nd) { nd = d; near = l; }
    if (!l.lit && d < cdist) { cdist = d; closest = l; }
  }
  $('prompt').style.display = near ? 'block' : 'none';
  const ek = keyName(settings.keys.interact);
  if (near) $('prompt').innerHTML = near.lit ? `<b>${ek}</b> — Châm dầu (${(near.fuel / TPS).toFixed(0)}/${T.fuel_max})` : `<b>${ek}</b> — Nạp ánh sáng (${near.charge}/${near.everLit ? T.relight_cost : T.lantern_cost})`;
  const arrow = $('arrow');   // off-screen arrow to the nearest unlit lantern
  if (closest) {
    const v = new THREE.Vector3(closest.pos[0], closest.pos[1] + 2.3, closest.pos[2]).project(camera);
    const behind = v.z > 1, off = behind || Math.abs(v.x) > 1 || Math.abs(v.y) > 1;
    arrow.style.display = off ? 'block' : 'none';
    if (off) {
      let x = behind ? -v.x : v.x, y = behind ? -v.y : v.y; const m = Math.max(Math.abs(x), Math.abs(y)) || 1; x /= m; y /= m;
      const px = (x * 0.9 + 1) / 2 * innerWidth, py = (1 - (y * 0.85 + 1) / 2) * innerHeight;
      arrow.style.left = `${px - 14}px`; arrow.style.top = `${py - 15}px`; arrow.style.transform = `rotate(${Math.atan2(x, y)}rad)`;
    }
  } else arrow.style.display = 'none';
}

// ---------- entity views ----------
function syncEntities(time, dt) {
  const s = sim.state, p = s.player;
  let n = 0;
  for (const m of s.motes) {
    if (n >= MAX_MOTES) break;
    if (m.kind === 'dropped' && m.ttl <= 120 && Math.floor(time * 8) % 2) continue;   // blink before expiring
    const k = Number(m.id.slice(1));
    const x = m.pos[0] + Math.sin(time * 1.3 + k) * 0.12, y = m.pos[1] + 0.9 + Math.sin(time * 2 + k) * 0.25, z = m.pos[2] + Math.cos(time * 1.1 + k) * 0.12;
    motesI.setMatrixAt(n, _m.makeTranslation(x, y, z)); haloPos[n * 3] = x; haloPos[n * 3 + 1] = y; haloPos[n * 3 + 2] = z; n++;
  }
  motesI.count = n; motesI.instanceMatrix.needsUpdate = true; haloGeo.setDrawRange(0, n); haloGeo.attributes.position.needsUpdate = true;
  let c = 0;
  const alive = new Set();
  for (const sh of s.shades) {
    if (c >= MAX_SHADES) break;
    alive.add(sh.id);
    const stunned = sh.state === 'stunned';
    let rot = Math.atan2(p.pos[0] - sh.pos[0], p.pos[2] - sh.pos[2]);
    if (BENCH_MODE || sh.state === 'wander' || sh.state === 'drain') {   // face where it walks / its lantern
      const prev = shadeSpin.get(sh.id); rot = prev && prev.x !== undefined && Math.hypot(sh.pos[0] - prev.x, sh.pos[2] - prev.z) > 1e-4 ? Math.atan2(sh.pos[0] - prev.x, sh.pos[2] - prev.z) : (prev?.rot ?? rot);
    }
    if (stunned) rot = (shadeSpin.get(sh.id)?.rot ?? 0) + dt * 4;
    shadeSpin.set(sh.id, { rot, x: sh.pos[0], z: sh.pos[2] });
    const scale = sh.state === 'spawning' ? 1 - sh.left / 60 * 0.8 : 1;
    const base = _m.compose(_v.set(sh.pos[0], sh.pos[1] + 0.1 + Math.sin(time * 3 + c) * 0.08, sh.pos[2]), _q.setFromEuler(_e.set(0, rot, 0)), _s.set(scale, scale, scale)).clone();
    const wob = new THREE.Matrix4().makeScale(1 + Math.sin(time * 5 + c) * 0.06, 1 + Math.cos(time * 5 + c) * 0.05, 1);
    for (const part of SHADE_PARTS) {
      const mtx = part.wobble ? base.clone().multiply(part.m).multiply(wob) : base.clone().multiply(part.m);
      part.im.setMatrixAt(c, mtx);
      if (part.body) part.im.setColorAt(c, stunned ? COL_STUN : COL_SHADE);
    }
    c++;
  }
  for (const part of SHADE_PARTS) { part.im.count = c; part.im.instanceMatrix.needsUpdate = true; if (part.im.instanceColor) part.im.instanceColor.needsUpdate = true; }
  for (const id of shadeSpin.keys()) if (!alive.has(id)) shadeSpin.delete(id);
  for (const [id, a] of shadeArrows) {   // edge arrows toward newly spawned shades
    const sh = s.shades.find(x => x.id === id);
    if (!sh || time > a.until) { a.el.remove(); shadeArrows.delete(id); continue; }
    pointArrow(a.el, sh.pos);
  }
  for (const d of s.drifters) {
    let v = drifterViews.get(d.id); if (!v) { v = makeDrifter(); drifterViews.set(d.id, v); }
    v.g.visible = d.state !== 'removed';
    v.g.position.set(d.pos[0], d.pos[1] + 0.3, d.pos[2]);
    const sgn = d.state === 'flee' ? 1 : -1;
    v.g.rotation.y = -Math.atan2(sgn * (d.pos[2] - p.pos[2]), sgn * (d.pos[0] - p.pos[0]));
    v.segs.forEach((sg, i) => { sg.position.y = Math.sin(time * 6 - i * 0.8) * 0.25; sg.rotation.x = Math.sin(time * 4 - i) * 0.6; });
  }
  for (const c of s.charms) {
    let v = charmViews.get(c.id); if (!v) { v = makeCharm(); charmViews.set(c.id, v); }
    v.visible = c.available; v.position.set(c.pos[0], c.pos[1] + 1.1 + Math.sin(time * 2) * 0.15, c.pos[2]); v.rotation.y = time * 1.5;
  }
}

// ---------- main loop ----------
const clock = new THREE.Clock(); let time = 0, pulseAnim = 0, frames = 0, fpsT = 0; const fpsSamples = [];
function handleEvents(events) {
  for (const e of events) {
    if (e.type === 'pickup') sfx.pickup();
    else if (e.type === 'deposit' || e.type === 'refuel') sfx.deposit();
    else if (e.type === 'lantern_out') { sfx.out(); toast(`💨 Đèn ${e.lantern_id} đã tắt — thắp lại chỉ cần ${T.relight_cost} đom đóm`); }
    else if (e.type === 'lantern_lit') { sfx.lit(); flash(0.18); toast(e.relight ? `🏮 Thắp lại đèn ${e.lantern_id}!` : `🏮 Đã thắp đèn ${e.lantern_id}! Sức chứa +2`); }
    else if (e.type === 'jump' || e.type === 'launch') sfx.jump();
    else if (e.type === 'dash') sfx.dash();
    else if (e.type === 'pulse') { sfx.pulse(); pulseAnim = 1; }
    else if (e.type === 'player_hit') { sfx.hit(); flash(0.3); if (!settings.reducedMotion) shake = 0.35; toast(e.cause === 'fall' ? 'Mây rơi xuống biển mây!' : 'Ối! Bóng Mực chạm vào Mây'); }
    else if (e.type === 'shade_spawn') {
      sfx.shade(); caption('⚠ Bóng Mực xuất hiện', true);
      const el = document.createElement('div'); el.className = 'arrow shade'; $('shadeArrows').appendChild(el);
      shadeArrows.set(e.shade_id, { el, until: time + 4 });
    }
    else if (e.type === 'charm_picked') { sfx.charm(); toast('🧧 Bùa Gió: chạy nhanh, lướt liên tục!'); }
    else if (e.type === 'drifter_steal') { sfx.steal(); toast(`Gió Lạc cướp mất ${e.amount} đom đóm!`); }
    else if (e.type === 'wind_warning') { sfx.wind(); caption('🍃 Gió lớn sắp thổi (2 giây)'); }
    else if (e.type === 'win') sfx.win();
    else if (e.type === 'lose') sfx.lose();
  }
}
function frame() {
  const dt = Math.min(clock.getDelta(), 0.1); time += dt;
  if (!sim) { renderer.render(scene, camera); requestAnimationFrame(frame); return; }
  const s = sim.state, p = s.player;
  if (mode === 'play' && s.status === 'playing') {
    acc += dt; const inp = BENCH_MODE ? {} : params.has('bot') ? botInput(sim, T) : readInput();   // bench: no player input
    while (acc >= DT) { sim.step(inp); acc -= DT; handleEvents(s.events); if (s.status !== 'playing') break; }
    const secs = Math.ceil(s.timeLeft / TPS);
    if (secs <= 10 && secs > 0 && secs !== lastCountdown) { if (lastCountdown === -1 || lastCountdown > 10) caption('⏳ Còn 10 giây tới bình minh', true); lastCountdown = secs; sfx.tick(); }
    for (const l of s.lanterns) {   // caption once each time a lantern drops below the low-fuel threshold
      const low = l.lit && l.fuel / TPS < T.low_fuel_threshold, key = 'low:' + l.id;
      if (low && !captionState.has(key)) { captionState.add(key); caption(`🏮 Đèn ${l.id} sắp cạn dầu (< ${T.low_fuel_threshold})`, true); }
      if (!low) captionState.delete(key);
    }
  }
  if (mode === 'play' && s.status !== 'playing' && !ended) { ended = true; setTimeout(endNight, 700); }

  may.visible = p.respawnWait === 0 && (p.invuln <= 0 || Math.floor(time * 12) % 2 === 0);
  may.position.set(...p.pos); may.rotation.y = Math.PI / 2 - p.facing;
  mayLamp.rotation.z = Math.sin(time * 3) * 0.2;
  halo.children.forEach((c, i) => { c.visible = i < p.carried; const a = time * 2 + i / T.carry_capacity * 6.283; c.position.set(Math.cos(a) * 0.9, 1.2 + Math.sin(time * 3 + i) * 0.15, Math.sin(a) * 0.9); });
  mayLight.intensity = 4 + p.carried * 0.5;
  const fx = Math.cos(p.facing), fz = Math.sin(p.facing);
  const bx = p.pos[0] - fx * 1.6 + fz * 0.8, bz = p.pos[2] - fz * 1.6 - fx * 0.8, by = sim.ground(bx, bz) ?? p.pos[1];
  rabbit.position.x += (bx - rabbit.position.x) * Math.min(1, dt * 4); rabbit.position.z += (bz - rabbit.position.z) * Math.min(1, dt * 4);
  rabbit.position.y = by + Math.abs(Math.sin(time * 8)) * 0.25; rabbit.lookAt(p.pos[0], by, p.pos[2]); rabbitStar.rotation.z = time;
  rabbit.visible = !BENCH_MODE;   // creative companion off in the benchmark scene

  syncEntities(time, dt);
  s.lanterns.forEach((l, i) => {
    const v = lanternViews[i], cost = l.everLit ? T.relight_cost : T.lantern_cost, fuel = l.lit ? l.fuel / TPS : 0;
    v.bar.scale.x = Math.max(0.001, l.charge / cost); v.bar.visible = !l.lit;
    if (l.lit !== v.wasLit) { v.wasLit = l.lit; v.body.material = l.lit ? v.onMat : v.offMat; v.core.visible = l.lit; }
    const low = l.lit && fuel < T.low_fuel_threshold, blinkOff = low && Math.sin(time * Math.PI * 2) < 0;   // 1 Hz slow blink
    v.body.scale.set(1, l.lit ? 1.25 : 1.0, 1);   // out: squashed 20% (1.25 -> 1.0)
    v.tear.visible = !l.lit && l.everLit;
    v.fuelBar.visible = l.lit && !blinkOff; v.fuelBar.scale.x = Math.max(0.001, fuel / T.fuel_max); v.fuelBar.position.x = 1.3 - 0.7 * (1 - fuel / T.fuel_max);
    v.core.visible = l.lit && !blinkOff;
    v.light.intensity += ((l.lit ? (blinkOff ? 8 : 30) : 0) - v.light.intensity) * Math.min(1, dt * 6);
    v.ring.material.opacity = l.lit && !low ? 0.35 + Math.sin(time * 2) * 0.1 : 0;   // safe-zone ring only while fuel >= 30
  });
  ambient.intensity = 0.15 + 0.55 * (s.lanterns.filter(l => l.lit).length / s.lanterns.length);
  if (kite) kite.position.y = 12 + Math.sin(time) * 0.6;
  leaves.visible = s.wind.active || s.wind.warn;
  if (leaves.visible) {
    const a = (s.wind.active ? s.wind.dirDeg : s.wind.nextDir) * Math.PI / 180;
    leaves.children.forEach((l, i) => {
      const t = (time * (s.wind.active ? 0.5 : 0.25) + i / 60) % 1, off = (i * 7.3) % 20 - 10;
      l.position.set(p.pos[0] + Math.cos(a) * (t * 30 - 15) - Math.sin(a) * off, p.pos[1] + 0.5 + (i % 5) * 0.6, p.pos[2] + Math.sin(a) * (t * 30 - 15) + Math.cos(a) * off);
      l.rotation.set(time * 3 + i, time * 2, i);
    });
  }
  if (pulseAnim > 0) { pulseAnim = Math.max(0, pulseAnim - dt * 2.2); pulseRing.position.set(p.pos[0], p.pos[1] + 0.3, p.pos[2]); pulseRing.scale.setScalar(Math.max(0.01, (1 - pulseAnim) * T.pulse_radius)); pulseRing.material.opacity = pulseAnim; }

  if (BENCH_MODE) {   // Ticket-04: orbit r=30, Y=15, start (30,15,0), CCW from above, 15 s per lap, always looking at (0,0,0)
    camera.position.set(...cameraAt(bench.start === null ? 0 : (performance.now() - bench.start) / 1000)); camera.lookAt(0, 0, 0);
  } else {
    const dist = 11, ty = 1.5 + p.pos[1];
    const want = new THREE.Vector3(p.pos[0] + Math.sin(camYaw) * Math.cos(camPitch) * dist, ty + Math.sin(camPitch) * dist, p.pos[2] + Math.cos(camYaw) * Math.cos(camPitch) * dist);
    camera.position.lerp(want, Math.min(1, dt * 6)); camera.lookAt(p.pos[0], ty, p.pos[2]);
    if (shake > 0 && !settings.reducedMotion) { shake = Math.max(0, shake - dt); camera.position.x += (Math.random() - 0.5) * shake; camera.position.y += (Math.random() - 0.5) * shake; }   // hit shake
  }
  moon.position.set(p.pos[0] - 30, 50, p.pos[2] + 20); moon.target.position.set(p.pos[0], 0, p.pos[2]);

  if (toastT > 0) { toastT -= dt; if (toastT <= 0) $('toast').style.opacity = 0; }
  if (mode !== 'menu') drawHud();
  renderer.render(scene, camera);
  if (BENCH_MODE) benchTick();
  frames++; fpsT += dt;
  if (fpsT >= 1) {
    const f = frames / fpsT; fpsSamples.push(f); if (fpsSamples.length > 120) fpsSamples.shift(); frames = 0; fpsT = 0;
    const avg = fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length;
    $('fps').textContent = params.has('fps') ? `FPS ${f.toFixed(0)} · TB ${avg.toFixed(1)} (${innerWidth}×${innerHeight})` : '';
    window.__fps = { now: f, avg, samples: fpsSamples.length };
  }
  requestAnimationFrame(frame);
}
// ---------- benchmark measurement (frame times measured in the page, stats from src/core/bench.js) ----------
const bench = { start: null, last: null, measureStart: null, dts: [], done: false, duration: Number(params.get('duration') || 30) };
function benchTick() {
  const now = performance.now();
  if (bench.start === null) {   // first frame of the bench scene
    bench.start = now;
    window.__bench = { phase: 'warmup', first_frame_epoch: performance.timeOrigin + now };
  } else if (!bench.done) {
    const d = now - bench.last;
    if (bench.measureStart === null && now - bench.start >= BENCH.warmup_s * 1000) { bench.measureStart = now; window.__bench.phase = 'measure'; }
    else if (bench.measureStart !== null) {
      bench.dts.push(d);
      if (now - bench.measureStart >= bench.duration * 1000) {
        bench.done = true;
        const gl = renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info');
        window.__bench = { ...window.__bench, phase: 'done', ...frameStats(bench.dts), measured_ms: Math.round(now - bench.measureStart),
          gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), three: THREE.REVISION,
          viewport: `${innerWidth}x${innerHeight}`, shades: sim.state.shades.length, motes: sim.state.motes.length };
      }
    }
  }
  bench.last = now;
}
if (BENCH_MODE) {
  sim = createBenchSim(T, Number(params.get('seed') || 42));
  night = 1; buildWorld(1); buildLanterns(sim.state.lanterns);
  show(null); mode = 'play';
}
// Test hook for scripts/e2e.mjs only (?e2e): lets the browser test drive the sim and read UI state.
if (params.has('e2e')) window.__ddl = {
  get sim() { return sim; }, get mode() { return mode; }, settings,
  advance(n) { for (let i = 0; i < n && sim.state.status === 'playing'; i++) { sim.step({}); handleEvents(sim.state.events); } },
  handleEvents,
};
// URL helpers for demo/screenshots: ?night=N  ?autostart  ?bot  ?ff=S (fast-forward S s with autopilot)  ?seed=N  ?fps
if (params.has('night') || params.has('autostart')) {
  campaign = createCampaign(T, { seed: seedOf(), startNight: Number(params.get('night') || 1) });
  toIntro(campaign.night);
  if (params.has('autostart')) play();
  if (params.has('ff')) { const n = Math.round(Number(params.get('ff')) * TPS); for (let i = 0; i < n && sim.state.status === 'playing'; i++) sim.step(botInput(sim, T));
    const p = sim.state.player; camera.position.set(p.pos[0], p.pos[1] + 6, p.pos[2] - 10); }
}
frame();
