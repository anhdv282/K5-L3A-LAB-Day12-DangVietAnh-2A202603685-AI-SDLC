// Standard maps (Ticket-02, Part 2). Pure data + terrain height. Angles from +X, CCW seen from above: x = r cos a, z = r sin a.
const D = Math.PI / 180;
const ring = (r, startDeg, stepDeg, n, y = 0, cx = 0, cz = 0) =>
  Array.from({ length: n }, (_, i) => { const a = (startDeg + i * stepDeg) * D; return [cx + r * Math.cos(a), y, cz + r * Math.sin(a)]; });
const lanterns = (list) => list.map((p, i) => ({ id: `L${i + 1}`, pos: p }));

export const MAPS = {
  1: {
    name: 'Đảo Bến', start: [0, 0, 0], startFacingDeg: 90,
    lanterns: lanterns([[0, 0, 25], [23.8, 0, 7.7], [14.7, 0, -20.2], [-14.7, 0, -20.2], [-23.8, 0, 7.7]]),
    moteSpawns: [...ring(12, 0, 45, 8), ...ring(33, 0, 22.5, 16)],
    shadeSpawns: ring(37, 15, 30, 12),
    shadeEveryTicks: 480, shadeMax: 6, shadeSpeedMul: 1,
    pads: [], charms: [], wind: false, drifters: false,
    bounds: 45,
  },
  2: {
    name: 'Đảo Cau', start: [0, 0, 0], startFacingDeg: 90,
    lanterns: lanterns([[0, 0, 20], [17, 0, -10], [-17, 0, -10], [70, 0, 20], [87, 0, -10], [53, 0, -10]]),
    moteSpawns: [...ring(10, 0, 90, 4), ...ring(22, 0, 45, 8), ...ring(10, 0, 90, 4, 0, 70), ...ring(22, 0, 45, 8, 0, 70)],
    shadeSpawns: [...ring(26, 22.5, 45, 8), ...ring(26, 22.5, 45, 8, 0, 70)],
    shadeEveryTicks: 420, shadeMax: 8, shadeSpeedMul: 1,
    pads: [{ pos: [20, 0, 18], vy: 14, h: 24, toward: [70, 0] }, { pos: [50, 0, -18], vy: 14, h: 24, toward: [0, 0] }],
    charms: [[35, 0, 0]], wind: false, drifters: true,
    bounds: 110,
  },
  3: {
    name: 'Đảo Chuông', start: [0, 0, -30], startFacingDeg: 90,   // assumption: (0,0,0) is inside the bell tower
    lanterns: lanterns([[0, 6, 6], [18, 3, 10], [-18, 3, 10], [35, 0, -10], [-35, 0, -10], [20, 0, -35], [-20, 0, -35]]),
    moteSpawns: [...ring(34, 0, 20, 18), ...ring(18, 20, 20, 8, 3), ...ring(5, 45, 90, 4, 6)],
    shadeSpawns: ring(43, 0, 22.5, 16),
    shadeEveryTicks: 360, shadeMax: 10, shadeSpeedMul: 4.5 / 4.0,
    pads: [{ pos: [0, 3, 13], vy: 12, h: 8, dir: [0, -1] }],
    charms: [[30, 0, 25], [-30, 0, 25]], wind: true, drifters: true,
    bounds: 50,
  },
};

export const STEP_UP = 0.35;   // max height an entity can walk up in one move (ramps ok, cliffs/walls block)

// Height of walkable ground at (x,z) for a night, or null for void (sea of clouds).
export function groundHeight(night, x, z) {
  if (night === 1) return x * x + z * z <= 40 * 40 ? 0 : null;
  if (night === 2) {
    if (x * x + z * z <= 28 * 28 || (x - 70) ** 2 + z * z <= 28 * 28) return 0;
    if (x >= 26 && x <= 44 && z >= -2 && z <= 2) return 0;   // bamboo bridge, no railing
    return null;
  }
  // night 3
  const r = Math.hypot(x, z);
  if (r > 45) return null;
  if (r < 2) return 14;                      // bell tower: 8 m tall on tier 2 (acts as a wall)
  if (r <= 8) return 6;                      // tier 2
  if (r >= 12 && r <= 24 && z > 0) return 3; // tier 1
  for (const a of [30 * D, 150 * D]) {       // ramps, 3 m wide, radial r 30 (Y0) -> 24 (Y3)
    const along = x * Math.cos(a) + z * Math.sin(a), across = -x * Math.sin(a) + z * Math.cos(a);
    if (Math.abs(across) <= 1.5 && along >= 24 && along <= 30) return 3 * (30 - along) / 6;
  }
  return 0;
}

// Coarse "level" for the autopilot's route planning (night 3 only).
export function level(night, x, z) {
  if (night !== 3) return 0;
  const g = groundHeight(night, x, z);
  return g >= 6 ? 2 : g >= 3 - 1e-6 && Math.hypot(x, z) <= 24 ? 1 : 0;
}
