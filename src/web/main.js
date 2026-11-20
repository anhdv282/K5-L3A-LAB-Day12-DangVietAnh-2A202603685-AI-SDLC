// Browser renderer. All rules live in src/core/sim.js; this file only draws state and maps keys -> input.
// Decorative extras (props, Thỏ Ngọc companion, Chú Cuội) are render-only and never touch the sim.
import * as THREE from 'three';
import { createSim, botInput, DT, ISLAND_RADIUS } from '../core/sim.js';
import { initAudio, sfx, toggleMusic } from './audio.js';

const contract = await (await fetch('/game.contract.json')).json();
const T = contract.tuning;
const params = new URLSearchParams(location.search);

// ---------- renderer / scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
const NIGHT = new THREE.Color('#1d2556'), DAWN = new THREE.Color('#3b3a78');
scene.background = NIGHT.clone();
scene.fog = new THREE.Fog(NIGHT.clone(), 35, 95);
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 300);
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

const hemi = new THREE.HemisphereLight('#a9b8ff', '#3a2f5a', 1.1); scene.add(hemi);
const moon = new THREE.DirectionalLight('#dfe4ff', 0.9); moon.position.set(-20, 40, 15); moon.castShadow = true;
moon.shadow.camera.left = moon.shadow.camera.bottom = -35; moon.shadow.camera.right = moon.shadow.camera.top = 35;
moon.shadow.mapSize.set(1024, 1024); scene.add(moon);
const warm = new THREE.AmbientLight('#ffb36b', 0.0); scene.add(warm);   // grows as lanterns light up

const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...o });
const glow = (color, i = 1.5) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: i });
function mesh(geo, m, x = 0, y = 0, z = 0, parent = scene) { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; parent.add(o); return o; }

// moon + stars
mesh(new THREE.SphereGeometry(4, 24, 16), glow('#fff6d8', 1.2), -60, 55, -80).castShadow = false;
{ const g = new THREE.BufferGeometry(), p = [];
  for (let i = 0; i < 600; i++) { const a = Math.random() * 6.283, e = 0.15 + Math.random() * 1.3, r = 150; p.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r); }
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: '#fff3c4', size: 0.7, fog: false }))); }

// island
mesh(new THREE.CylinderGeometry(ISLAND_RADIUS, ISLAND_RADIUS - 3, 4, 64), mat('#4d8a57'), 0, -2, 0);
mesh(new THREE.ConeGeometry(ISLAND_RADIUS - 3, 14, 48), mat('#6b4e3d'), 0, -11, 0).rotation.x = Math.PI;
mesh(new THREE.RingGeometry(16.5, 19.5, 64), mat('#c9b48a'), 0, 0.02, 0).rotation.x = -Math.PI / 2;   // sandy lantern path

// cloud sea
const clouds = new THREE.Group(); scene.add(clouds);
const cloudMat = mat('#9aa3d8', { roughness: 1 });
for (let i = 0; i < 90; i++) {
  const a = (i / 90) * 6.283 + Math.random() * 0.2, r = 34 + Math.random() * 40;
  const c = mesh(new THREE.SphereGeometry(3 + Math.random() * 4, 12, 8), cloudMat, Math.cos(a) * r, -4 - Math.random() * 3, Math.sin(a) * r, clouds);
  c.scale.y = 0.45; c.castShadow = false;
}

// ---------- childhood props (decorative, render-only) ----------
function tree(x, z, s = 1) {
  mesh(new THREE.CylinderGeometry(0.25 * s, 0.35 * s, 2 * s), mat('#6b4a32'), x, s, z);
  mesh(new THREE.SphereGeometry(1.4 * s, 12, 10), mat('#3f7d4a'), x, 2.6 * s, z);
}
[[-8, -6], [9, -4], [-24, 10], [24, 8], [-6, 25], [12, -24], [-20, -18], [26, -6], [4, 9]].forEach(([x, z]) => tree(x, z, 0.9 + Math.random() * 0.4));
// Cây đa + Chú Cuội (Vietnamese folklore)
{ const g = new THREE.Group(); g.position.set(-11, 0, 4); scene.add(g);
  mesh(new THREE.CylinderGeometry(0.8, 1.3, 4), mat('#5c4030'), 0, 2, 0, g);
  for (const [x, y, z, r] of [[0, 5, 0, 3], [2, 4.3, 1, 2.2], [-2, 4.4, -1, 2.3], [0.5, 4, -2, 2]]) mesh(new THREE.SphereGeometry(r, 14, 10), mat('#2f6b3c'), x, y, z, g);
  for (let i = 0; i < 6; i++) mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.5), mat('#6b5040'), Math.cos(i) * 2.2, 2.5, Math.sin(i) * 2.2, g);  // aerial roots
  const cuoi = new THREE.Group(); cuoi.position.set(1.6, 0, 1.6); g.add(cuoi);
  mesh(new THREE.CylinderGeometry(0.3, 0.4, 0.8), mat('#7a5b9c'), 0, 0.4, 0, cuoi);           // seated body
  mesh(new THREE.SphereGeometry(0.3, 12, 10), mat('#f1c9a0'), 0, 1.05, 0, cuoi);              // head
  mesh(new THREE.ConeGeometry(0.45, 0.25, 16), mat('#d9c48a'), 0, 1.35, 0, cuoi);             // straw hat
  mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.4), mat('#c9a06a'), 0.4, 0.7, 0.2, cuoi).rotation.z = 0.5;  // walking stick
}
// Bãi đất trống with 3 concrete pipes, where kids used to play
{ const g = new THREE.Group(); g.position.set(8, 0, 12); g.rotation.y = 0.6; scene.add(g);
  const pipe = new THREE.CylinderGeometry(1, 1, 2.6, 20, 1, true), pm = mat('#9a9aa2', { side: THREE.DoubleSide });
  mesh(pipe, pm, -1.05, 1, 0, g).rotation.x = Math.PI / 2; mesh(pipe, pm, 1.05, 1, 0, g).rotation.x = Math.PI / 2;
  mesh(pipe, pm, 0, 2.75, 0, g).rotation.x = Math.PI / 2; }
// Kite (diều) on a string from a post
{ mesh(new THREE.CylinderGeometry(0.08, 0.08, 2), mat('#8a6a4a'), -16, 1, -8);
  const kite = mesh(new THREE.OctahedronGeometry(1, 0), glow('#ff7b54', 0.4), -13, 12, -14); kite.scale.set(1, 1.4, 0.15);
  const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-16, 2, -8), new THREE.Vector3(-13, 11, -14)]);
  scene.add(new THREE.Line(g, new THREE.LineBasicMaterial({ color: '#eee' }))); window._kite = kite; }
// Little stilt houses with red-tile roofs
for (const [x, z, r] of [[-3, -14, 0.3], [15, 3, -1.2], [-22, -2, 1.4]]) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = r; scene.add(g);
  mesh(new THREE.BoxGeometry(3, 2, 2.5), mat('#e9d9b8'), 0, 1, 0, g);
  const roof = mesh(new THREE.ConeGeometry(2.6, 1.4, 4), mat('#b5523b'), 0, 2.7, 0, g); roof.rotation.y = Math.PI / 4;
  mesh(new THREE.BoxGeometry(0.7, 1.2, 0.05), mat('#6b4a32'), 0, 0.6, 1.26, g);
  mesh(new THREE.BoxGeometry(0.6, 0.5, 0.05), glow('#ffc46b', 0.6), 0.9, 1.3, 1.26, g);
}

// ---------- characters ----------
function starLantern(color = '#ffcc4d') {   // đèn ông sao, 5-pointed star
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.18 : 0.42, a = i / 10 * 6.283 + Math.PI / 2; i ? shape.lineTo(Math.cos(a) * r, Math.sin(a) * r) : shape.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  return new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.12, bevelEnabled: false }), glow(color, 1.2));
}
// Mây: small lantern keeper, conical leaf hat (nón lá) with a small hanging lantern
const may = new THREE.Group(); scene.add(may);
mesh(new THREE.CylinderGeometry(0.35, 0.5, 1.0, 16), mat('#4a7fd1'), 0, 0.75, 0, may);       // áo
mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.3, 12), mat('#2d3f6e'), 0, 0.15, 0, may);       // legs
mesh(new THREE.SphereGeometry(0.33, 16, 12), mat('#f6d2b0'), 0, 1.5, 0, may);                  // head
mesh(new THREE.SphereGeometry(0.05, 8, 6), mat('#222'), 0.12, 1.55, 0.3, may);
mesh(new THREE.SphereGeometry(0.05, 8, 6), mat('#222'), -0.12, 1.55, 0.3, may);
mesh(new THREE.ConeGeometry(0.85, 0.55, 24), mat('#e8d39a'), 0, 1.95, 0, may);                // nón lá
mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.35), mat('#555'), 0, 1.55, 0.78, may);        // string from brim
const mayLamp = mesh(new THREE.SphereGeometry(0.14, 12, 10), glow('#ff9c3a', 2), 0, 1.32, 0.78, may);
mayLamp.scale.y = 1.3;
const mayLight = new THREE.PointLight('#ffae55', 6, 9, 1.6); mayLight.position.set(0, 1.4, 0.8); may.add(mayLight);
const carryHalo = new THREE.Group(); may.add(carryHalo);   // carried fireflies orbit Mây
for (let i = 0; i < T.carry_capacity; i++) mesh(new THREE.SphereGeometry(0.07, 8, 6), glow('#ffe27a', 3), 0, 0, 0, carryHalo).castShadow = false;

// Thỏ Ngọc companion (render-only, follows Mây)
const rabbit = new THREE.Group(); scene.add(rabbit);
mesh(new THREE.SphereGeometry(0.3, 14, 10), mat('#f7f3ff'), 0, 0.3, 0, rabbit).scale.set(1, 0.9, 1.2);
mesh(new THREE.SphereGeometry(0.2, 12, 10), mat('#f7f3ff'), 0, 0.6, 0.25, rabbit);
for (const s of [-1, 1]) mesh(new THREE.CapsuleGeometry(0.05, 0.3, 4, 8), mat('#ffd6e6'), s * 0.08, 0.9, 0.2, rabbit).rotation.z = s * 0.2;
const rabbitStar = starLantern(); rabbitStar.scale.setScalar(0.5); rabbitStar.position.set(0.3, 0.9, 0.2); rabbit.add(rabbitStar);

// lanterns
const lanternViews = [];
function buildLantern(l) {
  const g = new THREE.Group(); g.position.set(l.x, 0, l.z); scene.add(g);
  mesh(new THREE.CylinderGeometry(0.15, 0.2, 3.2), mat('#5a3a2a'), 0, 1.6, 0, g);
  mesh(new THREE.BoxGeometry(1.6, 0.12, 0.12), mat('#5a3a2a'), 0.6, 3.2, 0, g);
  const bodyOff = mat('#4a3a55', { emissive: '#000' });
  const body = mesh(new THREE.SphereGeometry(0.75, 20, 14), bodyOff, 1.3, 2.3, 0, g); body.scale.y = 1.25;
  mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.15, 16), mat('#d4a43a'), 1.3, 3.2, 0, g);
  mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.15, 16), mat('#d4a43a'), 1.3, 1.35, 0, g);
  const light = new THREE.PointLight('#ffa64d', 0, 22, 1.4); light.position.set(1.3, 2.3, 0); g.add(light);
  const ring = new THREE.Mesh(new THREE.RingGeometry(T.safe_radius - 0.25, T.safe_radius, 64),
    new THREE.MeshBasicMaterial({ color: '#ffbf66', transparent: true, opacity: 0, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; g.add(ring);
  const pips = [];   // charge indicator: one pip per light needed
  for (let i = 0; i < T.lantern_cost; i++) {
    const p = mesh(new THREE.SphereGeometry(0.12, 8, 6), mat('#5d5470'), 0, 0, 0, g);
    const a = i / T.lantern_cost * 6.283; p.position.set(Math.cos(a) * 1.1, 0.25, Math.sin(a) * 1.1); pips.push(p);
  }
  lanternViews.push({ g, body, light, ring, pips, wasLit: false });
}

// pools for motes & shades
const moteGeo = new THREE.SphereGeometry(0.13, 8, 6), moteMat = glow('#ffe46b', 3);
const moteHaloMat = new THREE.SpriteMaterial({ map: radialTex('#ffd36b'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
const moteViews = new Map();
const shadeViews = new Map();
const shadeMat = mat('#2a1838', { emissive: '#3b1a5c', emissiveIntensity: 0.6, roughness: 0.4 });
const shadeStunMat = mat('#8f7aa8', { emissive: '#5a4a7a', emissiveIntensity: 0.4, transparent: true, opacity: 0.7 });
function radialTex(color) {
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
}
function makeShade() {
  const g = new THREE.Group(); scene.add(g);
  const blob = mesh(new THREE.SphereGeometry(0.7, 16, 12), shadeMat, 0, 0.8, 0, g); blob.scale.set(1, 1.15, 1);
  for (let i = 0; i < 5; i++) { const a = i / 5 * 6.283; mesh(new THREE.ConeGeometry(0.18, 0.5, 8), shadeMat, Math.cos(a) * 0.5, 0.2, Math.sin(a) * 0.5, g).rotation.x = Math.PI; }
  for (const s of [-1, 1]) { mesh(new THREE.SphereGeometry(0.14, 10, 8), glow('#e9dcff', 0.8), s * 0.24, 1.0, 0.58, g); mesh(new THREE.SphereGeometry(0.06, 8, 6), mat('#140a20'), s * 0.24, 1.0, 0.7, g); }
  return { g, blob };
}

// pulse ring effect
const pulseRing = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 48), new THREE.MeshBasicMaterial({ color: '#ffd27a', transparent: true, opacity: 0, side: THREE.DoubleSide }));
pulseRing.rotation.x = -Math.PI / 2; scene.add(pulseRing);
let pulseAnim = 0;

// ---------- game state ----------
let sim, started = false, ended = false, acc = 0;
function newGame() {
  sim = createSim(T, { seed: params.has('seed') ? Number(params.get('seed')) : (Date.now() & 0xffff) });
  for (const v of lanternViews) scene.remove(v.g); lanternViews.length = 0;
  sim.state.lanterns.forEach(buildLantern);
  for (const v of moteViews.values()) scene.remove(v); moteViews.clear();
  for (const v of shadeViews.values()) scene.remove(v.g); shadeViews.clear();
  ended = false; acc = 0; document.getElementById('end').style.display = 'none';
}
newGame();

// ---------- input ----------
const keys = new Set(); const pressed = { jump: false, pulse: false, interact: false };
addEventListener('keydown', e => {
  const k = e.key.toLowerCase(); if (e.repeat) return; keys.add(k);
  if (k === ' ') { pressed.jump = true; e.preventDefault(); }
  if (k === 'f' || k === 'q') pressed.pulse = true;
  if (k === 'e') pressed.interact = true;
  if (k === 'm') toast(toggleMusic() ? '🎵 Nhạc: bật' : '🔇 Nhạc: tắt');
  if (k === 'r') { newGame(); startGame(); }
  if (k === 'enter' && !started) startGame();
});
addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
let camYaw = Math.PI, camPitch = 0.42, dragging = false;
addEventListener('mousedown', () => dragging = true); addEventListener('mouseup', () => dragging = false);
addEventListener('mousemove', e => { if (dragging) { camYaw -= e.movementX * 0.005; camPitch = Math.min(1.2, Math.max(0.15, camPitch + e.movementY * 0.004)); } });
function startGame() { initAudio(); started = true; document.getElementById('start').style.display = 'none'; }
document.getElementById('go').onclick = startGame;
document.getElementById('again').onclick = () => { newGame(); startGame(); };

function readInput() {
  let f = 0, r = 0;
  if (keys.has('w') || keys.has('arrowup')) f++;
  if (keys.has('s') || keys.has('arrowdown')) f--;
  if (keys.has('d') || keys.has('arrowright')) r++;
  if (keys.has('a') || keys.has('arrowleft')) r--;
  // camera-relative: forward is from camera toward Mây
  const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw);
  const inp = { mx: fx * f - fz * r, mz: fz * f + fx * r, ...pressed };
  pressed.jump = pressed.pulse = pressed.interact = false;
  return inp;
}

// ---------- HUD ----------
const hud = document.getElementById('hud'), scoreEl = document.getElementById('score'), toastEl = document.getElementById('toast');
let toastT = 0;
function toast(msg) { toastEl.textContent = msg; toastEl.style.opacity = 1; toastT = 2; }
function drawHud() {
  const s = sim.state, p = s.player;
  const lit = s.lanterns.filter(l => l.lit).length;
  const near = sim.nearestUnlitLantern(T.interact_radius);
  const m = Math.floor(s.timeLeft / 60), sec = Math.floor(s.timeLeft % 60).toString().padStart(2, '0');
  hud.innerHTML = `<b>Đêm 1 – Đảo Bến</b><br>
    🏮 Đèn Lồng: <b>${lit}/${s.lanterns.length}</b><br>
    ✨ Ánh sáng mang theo: <b>${p.carried}/${T.carry_capacity}</b><br>
    🔥 Ngọn lửa: ${'🔥'.repeat(p.flames)}${'<span style="opacity:.25">🔥</span>'.repeat(Math.max(0, T.flames - p.flames))}<br>
    ⏳ Thời gian: <b>${m}:${sec}</b><br>
    Tỏa sáng (F, tốn ${T.pulse_cost}): ${s.pulseCd > 0 ? 'đang hồi…' : p.carried >= T.pulse_cost ? '<b>sẵn sàng</b>' : 'thiếu ánh sáng'}
    <div class="bar"><i style="width:${100 * (1 - s.pulseCd / T.pulse_cooldown_s)}%"></i></div>
    ${near ? `<div style="margin-top:6px;color:#ffe3a3">Nhấn <b>E</b> để nạp đèn (${near.charge}/${T.lantern_cost})</div>` : ''}`;
  scoreEl.textContent = `Điểm: ${sim.score().total}`;
}
function showEnd() {
  const s = sim.state, sc = sim.score(), won = s.status === 'won';
  document.getElementById('endTitle').textContent = won ? '🏮 Đảo Bến đã sáng trở lại!' : '🌫️ Sương đen vẫn còn…';
  document.getElementById('endMsg').textContent = won ? 'Mây đã thắp đủ 5 Đèn Lồng Lớn. Bóng Mực lui vào biển mây.'
    : s.loseReason === 'time' ? 'Trời sắp sáng mà đèn chưa thắp đủ.' : 'Mây đã hết lửa. Thử lại nhé!';
  const st = s.stats, k = T.score;
  document.getElementById('endTable').innerHTML = `
    <tr><td>Đom đóm gom được × ${k.per_mote}</td><td>${st.motesCollected * k.per_mote}</td></tr>
    <tr><td>Đèn thắp × ${k.per_lantern}</td><td>${st.lanternsLit * k.per_lantern}</td></tr>
    <tr><td>Bóng Mực bị xua × ${k.per_stun}</td><td>${st.stuns * k.per_stun}</td></tr>
    <tr><td>Thưởng thời gian (khi thắng)</td><td>${sc.timeBonus}</td></tr>
    <tr><td>Thưởng lửa còn lại (khi thắng)</td><td>${sc.flameBonus}</td></tr>
    <tr><td><b>Tổng</b></td><td><b>${sc.total}</b></td></tr>`;
  document.getElementById('end').style.display = 'flex';
}

// ---------- main loop ----------
const clock = new THREE.Clock(); let time = 0, hitFlash = 0;
function frame() {
  const dt = Math.min(clock.getDelta(), 0.1); time += dt;
  const s = sim.state;
  if (started && s.status === 'playing') {
    acc += dt; const inp = params.has('bot') ? botInput(sim, T) : readInput(); let first = true;
    while (acc >= DT) {
      sim.step(first ? inp : { mx: inp.mx, mz: inp.mz }); first = false; acc -= DT;
      for (const e of s.events) {
        if (e.type === 'pickup') sfx.pickup();
        if (e.type === 'deposit') sfx.deposit();
        if (e.type === 'lantern_lit') { sfx.lit(); toast(`🏮 Đã thắp Đèn Lồng ${s.stats.lanternsLit}/5!`); }
        if (e.type === 'jump') sfx.jump();
        if (e.type === 'pulse') { sfx.pulse(); pulseAnim = 1; }
        if (e.type === 'pulse_fail') { sfx.fail(); toast(e.reason === 'cooldown' ? 'Đang hồi sức…' : `Cần ${T.pulse_cost} đốm sáng để tỏa sáng`); }
        if (e.type === 'hit') { sfx.hit(); hitFlash = 1; toast('Ối! Bóng Mực chạm vào Mây'); }
        if (e.type === 'win') sfx.win();
        if (e.type === 'lose') sfx.lose();
      }
      if (s.status !== 'playing') break;
    }
  }
  if (s.status !== 'playing' && !ended) { ended = true; setTimeout(showEnd, 600); }

  // Mây
  const p = s.player;
  may.position.set(p.x, p.y, p.z);
  may.rotation.y = Math.atan2(p.faceX, p.faceZ);
  may.visible = p.invuln <= 0 || Math.floor(time * 12) % 2 === 0;
  mayLamp.rotation.z = Math.sin(time * 3) * 0.2;
  carryHalo.children.forEach((c, i) => {
    c.visible = i < p.carried; const a = time * 2 + i / T.carry_capacity * 6.283;
    c.position.set(Math.cos(a) * 0.9, 1.2 + Math.sin(time * 3 + i) * 0.15, Math.sin(a) * 0.9);
  });
  mayLight.intensity = 4 + p.carried * 0.6;
  // Thỏ Ngọc trails behind
  const bx = p.x - p.faceX * 1.6 + p.faceZ * 0.8, bz = p.z - p.faceZ * 1.6 - p.faceX * 0.8;
  rabbit.position.x += (bx - rabbit.position.x) * Math.min(1, dt * 4);
  rabbit.position.z += (bz - rabbit.position.z) * Math.min(1, dt * 4);
  rabbit.position.y = Math.abs(Math.sin(time * 8)) * 0.25;
  rabbit.lookAt(p.x, 0, p.z); rabbitStar.rotation.z = time;

  // motes
  const alive = new Set();
  for (const m of s.motes) {
    alive.add(m.id); let v = moteViews.get(m.id);
    if (!v) { v = new THREE.Group(); v.add(new THREE.Mesh(moteGeo, moteMat)); const h = new THREE.Sprite(moteHaloMat); h.scale.setScalar(1.1); v.add(h); scene.add(v); moteViews.set(m.id, v); }
    v.position.set(m.x + Math.sin(time * 1.3 + m.id) * 0.15, 1 + Math.sin(time * 2 + m.id) * 0.3, m.z + Math.cos(time * 1.1 + m.id) * 0.15);
  }
  for (const [id, v] of moteViews) if (!alive.has(id)) { scene.remove(v); moteViews.delete(id); }

  // shades
  const aliveS = new Set();
  for (const sh of s.shades) {
    aliveS.add(sh.id); let v = shadeViews.get(sh.id);
    if (!v) { v = makeShade(); shadeViews.set(sh.id, v); }
    v.g.position.set(sh.x, 0.1 + Math.sin(time * 3 + sh.id) * 0.1, sh.z);
    if (sh.stun > 0) { v.g.rotation.y += dt * 4; } else v.g.lookAt(p.x, 0, p.z);
    const m = sh.stun > 0 ? shadeStunMat : shadeMat; v.g.traverse(o => { if (o.isMesh && (o.material === shadeMat || o.material === shadeStunMat)) o.material = m; });
    v.blob.scale.set(1 + Math.sin(time * 5 + sh.id) * 0.06, 1.15 + Math.cos(time * 5 + sh.id) * 0.06, 1);
  }
  for (const [id, v] of shadeViews) if (!aliveS.has(id)) { scene.remove(v.g); shadeViews.delete(id); }

  // lanterns & island brightening
  s.lanterns.forEach((l, i) => {
    const v = lanternViews[i];
    v.pips.forEach((pp, j) => { pp.material = j < l.charge ? moteMat : pp.material === moteMat ? mat('#5d5470') : pp.material; });
    if (l.lit && !v.wasLit) { v.wasLit = true; v.body.material = glow('#ff8a2a', 1.6); }
    v.light.intensity += ((l.lit ? 30 : 0) - v.light.intensity) * Math.min(1, dt * 2);
    v.ring.material.opacity = l.lit ? 0.35 + Math.sin(time * 2) * 0.1 : 0;
    if (l.lit) v.body.rotation.y = Math.sin(time + i) * 0.1;
  });
  const frac = s.stats.lanternsLit / s.lanterns.length;
  warm.intensity = frac * 0.9;
  hemi.intensity = 1.1 + frac * 0.6;
  scene.background.copy(NIGHT).lerp(DAWN, frac); scene.fog.color.copy(scene.background);
  clouds.rotation.y += dt * 0.01;
  if (window._kite) window._kite.position.y = 12 + Math.sin(time) * 0.6;

  // pulse effect
  if (pulseAnim > 0) {
    pulseAnim = Math.max(0, pulseAnim - dt * 2.2);
    const r = (1 - pulseAnim) * T.pulse_radius;
    pulseRing.position.set(p.x, 0.3, p.z); pulseRing.scale.setScalar(Math.max(0.01, r)); pulseRing.material.opacity = pulseAnim;
  }
  // hit flash: purple tint
  hitFlash = Math.max(0, hitFlash - dt * 2);
  renderer.domElement.style.filter = hitFlash > 0 ? `drop-shadow(0 0 0 #000) hue-rotate(${hitFlash * 40}deg) saturate(${1 + hitFlash})` : '';

  // camera: third-person orbit around Mây
  const dist = 11;
  const target = new THREE.Vector3(p.x, 1.5 + p.y * 0.5, p.z);
  const want = new THREE.Vector3(p.x + Math.sin(camYaw) * Math.cos(camPitch) * dist, target.y + Math.sin(camPitch) * dist, p.z + Math.cos(camYaw) * Math.cos(camPitch) * dist);
  camera.position.lerp(want, Math.min(1, dt * 6)); camera.lookAt(target);

  if (toastT > 0) { toastT -= dt; if (toastT <= 0) toastEl.style.opacity = 0; }
  drawHud();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
if (params.has('autostart')) startGame();
// ?ff=S : fast-forward S seconds with the autopilot (for screenshots / demo only)
if (params.has('ff')) { const n = Math.round(Number(params.get('ff')) / DT); for (let i = 0; i < n && sim.state.status === 'playing'; i++) sim.step(botInput(sim, T)); }
frame();
