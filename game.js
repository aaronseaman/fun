/*
 * NAVOS NINJA
 * A top-down, five-minute survival roguelite drawn entirely with Canvas 2D.
 * Vanilla JavaScript, no assets, no dependencies, no build step.
 *
 * Sections
 *  1. CONFIG                      10. Projectiles & collision
 *  2. Canvas                      11. XP gems & pickups
 *  3. Input                       12. Upgrades & evolution
 *  4. Game state                  13. Particles & effects
 *  5. Camera                      14. HUD & interface
 *  6. Player                      15. Audio
 *  7. Enemies                     16. Main loop
 *  8. Spawner & difficulty        17. Rendering
 *  9. Weapons                     18. Initialisation & restart
 */
(() => {
'use strict';

// =====================================================================
// 1. CONFIG — every tunable number lives here
// =====================================================================
const CONFIG = {
  RUN_DURATION: 300,          // seconds of active gameplay
  MINIBOSS_TIME: 150,         // 2:30
  BOSS_TIME: 270,             // 4:30
  BOSS_WARNING: 4,            // seconds of warning before a boss arrives
  STEP: 1 / 60,               // fixed simulation step
  MAX_FRAME_DT: 0.1,          // delta-time clamp (tab switches, hitches)
  MAX_STEPS_PER_FRAME: 6,
  MAX_DPR: 2,
  MAX_CANVAS_PIXELS: 2560 * 1440,
  VIEW_SHORT_SIDE: 770,       // world units visible across the shorter screen side
  ZOOM_MIN: 0.55,
  ZOOM_MAX: 1.4,
  TITLE_ZOOM: 1.25,
  ARENA_RADIUS: 1500,
  PLAZA_RADIUS: 290,
  CHUNK_SIZE: 512,
  CHUNK_CACHE_MAX: 42,
  CHUNK_BUILDS_PER_FRAME: 3,
  CAMERA_LERP: 10,
  SHAKE_MAX: 15,
  SHAKE_DECAY: 2.2,
  DIFFICULTY_SCALE: 3,        // difficulty = 1 + f^2 * scale, f = elapsed fraction
  LEVELUP_INPUT_DELAY: 350,   // ms before level-up cards accept input

  player: {
    maxHp: 100, speed: 215, accel: 20, radius: 15,
    iframes: 0.6, critChance: 0.05, critMultiplier: 2,
    crowdSlow: 0.05, crowdSlowMin: 0.62, recoil: 260,
  },
  dash: { cooldown: 2.2, duration: 0.17, speed: 760, iframes: 0.32 },
  xp: {
    base: 5, linear: 5, quad: 0.3,    // XP needed for level L: base + linear*(L-1) + quad*(L-1)^2
    timeBonus: 0.6,                   // late enemies drop up to +60% XP
    magnetRadius: 95, collectPad: 10,
    tier2: 5, tier3: 20,
    magnetAccel: 1600, magnetMaxSpeed: 1000,
  },
  spawn: {
    baseRate: 1.4, linearRate: 8,     // enemies per second = baseRate*difficulty + linearRate*f
    baseMax: 45, extraMax: 255,       // alive cap = baseMax + extraMax*f^1.2
    margin: 90,                       // spawn distance beyond the visible corner
    swarmTimes: [55, 110, 195, 235, 285],
    swarmBase: 22, swarmExtra: 26,
    bossSpawnFactor: 0.55,
    bruteFrom: 0.1, bruteWeight: [0.12, 0.5],
    dasherFrom: 0.2, dasherWeight: [0.15, 0.4],
  },
  scaling: { hpLinear: 1.0, speed: 0.3, damage: 0.7 },
  enemies: {
    runner: { radius: 13, hp: 9, speed: 98, damage: 6, xp: 1, mass: 1 },
    brute:  { radius: 22, hp: 46, speed: 62, damage: 13, xp: 4, mass: 3 },
    dasher: { radius: 16, hp: 20, speed: 82, damage: 9, xp: 2, mass: 1.5,
      dashSpeed: 430, windup: 0.6, dashTime: 0.42, recover: 0.5, cooldown: [2.2, 3.4],
      triggerRange: 400, dashDamageMul: 1.5 },
    miniboss: { radius: 50, hp: 2400, speed: 86, damage: 20, xp: 80, mass: 30,
      attacks: ['charge', 'slam'],
      chargeSpeed: 540, chargeTime: 0.8, chargeWindup: 0.95, chargeDamageMul: 1.4,
      slamRadius: 175, slamWindup: 1.05, slamDamage: 22,
      recover: 1.1, chaseTime: 2.4 },
    boss: { radius: 76, hp: 7500, speed: 92, damage: 26, xp: 150, mass: 80,
      attacks: ['charge', 'spit', 'slam'],
      chargeSpeed: 620, chargeTime: 0.9, chargeWindup: 0.9, chargeDamageMul: 1.4,
      slamRadius: 235, slamWindup: 1.15, slamDamage: 30,
      spitWindup: 0.8, spitCount: 18, spitSpeed: 230, spitDamage: 14,
      recover: 1.0, chaseTime: 2.0 },
  },
  weapons: {
    strike: { dmg: 14, dmgPerLv: 4, cd: 0.62, cdPerLv: -0.045, range: 112, rangePerLv: 7,
      arc: 2.0, arcPerLv: 0.14, kb: 150, life: 0.18,
      evo: { dmg: 38, cd: 0.28, range: 150, arc: 3.5, kb: 280 } },
    syringe: { dmg: 16, dmgPerLv: 6, cd: 1.25, cdPerLv: -0.07, speed: 650, range: 560,
      spread: 0.16, radius: 7, kb: 90,
      evo: { dmg: 42, cd: 0.75, count: 6, speed: 780, range: 640, pierce: 2, spread: 0.12 } },
    pulse: { dmg: 14, dmgPerLv: 6, cd: 2.6, cdPerLv: -0.15, radius: 140, radiusPerLv: 16,
      kb: 260, dur: 0.42,
      evo: { dmg: 55, cd: 1.5, radius: 260, kb: 340, stun: 0.5, echoDelay: 0.22 } },
    medallion: { dmg: 10, dmgPerLv: 4, orbit: 82, orbitPerLv: 6, spin: 2.8, spinPerLv: 0.15,
      size: 11, hitCd: 0.4, kb: 120,
      evo: { dmg: 34, count: 5, orbit: 130, spin: 4.2, size: 15, hitCd: 0.3 } },
  },
  caps: { enemies: 300, projectiles: 160, gems: 380, particles: 700, texts: 60, pickups: 12 },
  drops: { medkitChance: 0.006, magnetChance: 0.0025, medkitHeal: 30 },
};

const TAU = Math.PI * 2;
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const TEST_MODE = /[?&]test\b/.test(location.search);
const DEBUG_MODE = /[?&]debug\b/.test(location.search);

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (lo, hi) => lo + Math.random() * (hi - lo);
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeOutBack = (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const $ = (id) => document.getElementById(id);

function angleDiff(a, b) {
  let d = (a - b) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashInt(x, y) {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}
function fmtTime(s) {
  s = Math.max(0, Math.ceil(s - 1e-6));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
function hexToRgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
function roundRectPath(c, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

// =====================================================================
// 2. CANVAS
// =====================================================================
const canvas = $('game');
const ctx = canvas.getContext('2d');
const view = { w: 1, h: 1, dpr: 1, zoom: 1, chunkScale: 0, halfDiag: 600 };

function resize() {
  const w = Math.max(1, window.innerWidth);
  const h = Math.max(1, window.innerHeight);
  let dpr = Math.min(window.devicePixelRatio || 1, CONFIG.MAX_DPR);
  if (w * h * dpr * dpr > CONFIG.MAX_CANVAS_PIXELS) dpr = Math.sqrt(CONFIG.MAX_CANVAS_PIXELS / (w * h));
  view.w = w; view.h = h; view.dpr = dpr;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  view.zoom = clamp(Math.min(w, h) / CONFIG.VIEW_SHORT_SIDE, CONFIG.ZOOM_MIN, CONFIG.ZOOM_MAX);
  view.halfDiag = Math.hypot(w, h) / 2 / view.zoom;
  const cs = clamp(Math.round(view.zoom * dpr * CONFIG.TITLE_ZOOM * 2) / 2, 1, 1.5);
  if (cs !== view.chunkScale) { view.chunkScale = cs; clearChunkCache(); }
  UI.measure();
}

// =====================================================================
// 3. INPUT
// =====================================================================
const keys = Object.create(null);
const MOVE_KEYS = { KeyW: 1, KeyA: 1, KeyS: 1, KeyD: 1, ArrowUp: 1, ArrowDown: 1, ArrowLeft: 1, ArrowRight: 1 };
const moveVec = { x: 0, y: 0 };
const touch = { stickId: null, ox: 0, oy: 0, x: 0, y: 0, used: false };
const hudButtons = { pause: { x: 0, y: 0, w: 0, h: 0 }, dash: { x: 0, y: 0, r: 0 } };
let dashQueued = false;
let testInput = null;   // test-only input override (?test)
let autopilot = false;  // test-only bot driving the real game loop (?test)

window.addEventListener('keydown', (e) => {
  if (MOVE_KEYS[e.code]) { keys[e.code] = true; e.preventDefault(); }
  if (e.code === 'Space') e.preventDefault();
  if (e.repeat) return;
  switch (e.code) {
    case 'Escape': case 'KeyP': togglePause(); e.preventDefault(); break;
    case 'Space': if (state === STATE.PLAYING) dashQueued = true; break;
    case 'KeyM': toggleSound(); break;
    case 'Digit1': case 'Numpad1': chooseCard(0); break;
    case 'Digit2': case 'Numpad2': chooseCard(1); break;
    case 'Digit3': case 'Numpad3': chooseCard(2); break;
    case 'Enter':
      if (document.activeElement && document.activeElement.tagName === 'BUTTON') break;
      if (state === STATE.TITLE || state === STATE.VICTORY || state === STATE.DEFEAT) startRun();
      break;
    default: break;
  }
});
window.addEventListener('keyup', (e) => { if (MOVE_KEYS[e.code]) keys[e.code] = false; });

function clearInput() {
  for (const k in keys) keys[k] = false;
  dashQueued = false;
  touch.stickId = null;
}
window.addEventListener('blur', () => { clearInput(); if (state === STATE.PLAYING) pauseGame(); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { clearInput(); if (state === STATE.PLAYING) pauseGame(); }
});

function readMove() {
  if (testInput) { moveVec.x = testInput.x; moveVec.y = testInput.y; }
  else {
    let x = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
    let y = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0);
    if (touch.stickId !== null) {
      const dx = touch.x - touch.ox, dy = touch.y - touch.oy, m = Math.hypot(dx, dy);
      if (m > 6) { const k = Math.min(1, m / 56) / m; x += dx * k; y += dy * k; }
    }
    moveVec.x = x; moveVec.y = y;
  }
  // Normalised so diagonals are never faster than a single axis.
  const len = Math.hypot(moveVec.x, moveVec.y);
  if (len > 1) { moveVec.x /= len; moveVec.y /= len; }
  return moveVec;
}

canvas.addEventListener('pointerdown', (e) => {
  if (state !== STATE.PLAYING) return;
  const x = e.clientX, y = e.clientY, pb = hudButtons.pause;
  if (x >= pb.x && x <= pb.x + pb.w && y >= pb.y && y <= pb.y + pb.h) { pauseGame(); return; }
  if (e.pointerType === 'mouse') return;
  touch.used = true;
  const db = hudButtons.dash;
  if (Math.hypot(x - db.x, y - db.y) < db.r * 1.25) { dashQueued = true; e.preventDefault(); return; }
  if (touch.stickId === null) {
    touch.stickId = e.pointerId;
    touch.ox = touch.x = x; touch.oy = touch.y = y;
    if (canvas.setPointerCapture) { try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } }
  }
  e.preventDefault();
}, { passive: false });
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerId !== touch.stickId) return;
  touch.x = e.clientX; touch.y = e.clientY;
  const dx = touch.x - touch.ox, dy = touch.y - touch.oy, m = Math.hypot(dx, dy), R = 90;
  if (m > R) { touch.ox = touch.x - dx / m * R; touch.oy = touch.y - dy / m * R; }
});
const endTouch = (e) => { if (e.pointerId === touch.stickId) touch.stickId = null; };
canvas.addEventListener('pointerup', endTouch);
canvas.addEventListener('pointercancel', endTouch);

// =====================================================================
// 4. GAME STATE
// =====================================================================
const STATE = Object.freeze({
  TITLE: 'TITLE', PLAYING: 'PLAYING', LEVEL_UP: 'LEVEL_UP',
  PAUSED: 'PAUSED', VICTORY: 'VICTORY', DEFEAT: 'DEFEAT',
});
let state = STATE.TITLE;
let G = null;          // the current run; recreated from scratch by startRun()
let realTime = 0;      // wall-clock seconds, used only for menus and the title scene

function createPlayer() {
  const P = CONFIG.player;
  return {
    x: 0, y: 0, vx: 0, vy: 0, kx: 0, ky: 0, r: P.radius,
    hp: P.maxHp, maxHp: P.maxHp, hpGhost: P.maxHp,
    iframes: 0, blinkT: 0, hurt: 0, crowd: 0,
    facing: 1, back: false, phase: 0, move: 0,
    dashCd: 0, dashT: 0, dashX: 1, dashY: 0,
    dead: false, deathT: 0,
    // stats modified by upgrades
    damageMul: 1, cooldownMul: 1, areaMul: 1, speedMul: 1,
    critChance: P.critChance, knockbackMul: 1, armor: 0, regen: 0,
    magnetMul: 1, xpMul: 1, syringeExtra: 0, pulseMul: 1, orbExtra: 0,
  };
}

function createRun() {
  return {
    time: 0, animT: 0, kills: 0, level: 1, xp: 0, xpNext: xpForLevel(1), pendingLevels: 0,
    player: createPlayer(),
    enemies: [], bosses: [], gems: [], pickups: [], pulses: [], strikes: [],
    weapons: [], passives: {}, upgradesTaken: 0, evolved: [], options: null,
    spawnAcc: 0, swarmIndex: 0,
    minibossWarned: false, bossWarned: false,
    minibossSpawned: false, bossSpawned: false, minibossDefeated: false, bossDefeated: false,
    ending: null, hitStop: 0, shake: 0, hurtFlash: 0,
    cam: { x: 0, y: 0 },
    nextId: 1, pulseSeq: 0,
    combo: 0, comboT: 0, killPulse: 0, xpFlash: 0,
    damageDealt: 0, banners: [], magnetAll: 0, xpStreak: 0, xpStreakT: 0,
  };
}

// =====================================================================
// 5. CAMERA
// =====================================================================
function updateCamera(dt) {
  const p = G.player, k = 1 - Math.exp(-dt * CONFIG.CAMERA_LERP);
  G.cam.x += (p.x - G.cam.x) * k;
  G.cam.y += (p.y - G.cam.y) * k;
  G.shake = Math.max(0, G.shake - dt * CONFIG.SHAKE_DECAY);
}
function addShake(a) { G.shake = Math.min(1, G.shake + a); }

// =====================================================================
// 6. PLAYER
// =====================================================================
function updatePlayer(dt) {
  const p = G.player, PC = CONFIG.player;
  if (p.iframes > 0) p.iframes -= dt;
  if (p.blinkT > 0) p.blinkT -= dt;
  if (p.hurt > 0) p.hurt -= dt;
  if (p.dashCd > 0) p.dashCd -= dt;
  p.hpGhost += (p.hp - p.hpGhost) * Math.min(1, dt * 2.5);
  if (p.dead) {
    p.deathT += dt; p.vx *= 0.9; p.vy *= 0.9; dashQueued = false;
    return;
  }
  const mv = readMove();
  if (dashQueued) { dashQueued = false; tryDash(mv); }

  const speed = PC.speed * p.speedMul;
  let tx = mv.x * speed, ty = mv.y * speed, a;
  if (p.dashT > 0) {
    p.dashT -= dt;
    tx = p.dashX * CONFIG.dash.speed; ty = p.dashY * CONFIG.dash.speed;
    a = 1;
    const g = emit(PK.GHOST, p.x, p.y, 0, 0, 0.22, 1, '#8ff5d8', 0, 0, 0, true);
    if (g) { g.rot = p.facing; g.z = p.phase; }
  } else {
    // Overlapping enemies slow the hero slightly, but never stop them.
    const slow = Math.max(PC.crowdSlowMin, 1 - p.crowd * PC.crowdSlow);
    tx *= slow; ty *= slow;
    a = 1 - Math.exp(-dt * PC.accel);
  }
  p.vx += (tx - p.vx) * a;
  p.vy += (ty - p.vy) * a;
  p.x += (p.vx + p.kx) * dt;
  p.y += (p.vy + p.ky) * dt;
  const kd = Math.exp(-dt * 10);
  p.kx *= kd; p.ky *= kd;

  const R = CONFIG.ARENA_RADIUS - p.r, d = Math.hypot(p.x, p.y);
  if (d > R) { p.x *= R / d; p.y *= R / d; }

  if (p.regen > 0 && p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + p.regen * dt);

  const sp = Math.hypot(p.vx, p.vy);
  p.move += (clamp(sp / PC.speed, 0, 1) - p.move) * Math.min(1, dt * 12);
  p.phase += dt * sp * 0.055;
  if (mv.x > 0.2) p.facing = 1; else if (mv.x < -0.2) p.facing = -1;
  const moving = Math.abs(mv.x) + Math.abs(mv.y) > 0.1;
  p.back = moving && mv.y < -0.35 && Math.abs(mv.y) > Math.abs(mv.x) * 0.9;
  if (sp > 80 && p.dashT <= 0 && Math.random() < dt * 7) {
    emit(PK.SMOKE, p.x + rand(-6, 6), p.y, -p.vx * 0.1, -p.vy * 0.1 - 10, 0.45, 4, '#cdb68f', 2, 0, 9, true);
  }
}

function tryDash(mv) {
  const p = G.player;
  if (p.dashCd > 0 || G.ending) return;
  let dx = mv.x, dy = mv.y;
  const m = Math.hypot(dx, dy);
  if (m < 0.1) { dx = p.facing; dy = 0; } else { dx /= m; dy /= m; }
  p.dashX = dx; p.dashY = dy;
  p.dashT = CONFIG.dash.duration;
  p.dashCd = CONFIG.dash.cooldown;
  p.iframes = Math.max(p.iframes, CONFIG.dash.iframes);
  emit(PK.RING, p.x, p.y, 0, 0, 0.3, 10, '#8ff5d8', 0, 0, 160);
  sfx('dash');
}

/** The single authoritative place where the hero takes damage. */
function damagePlayer(amount, sx, sy) {
  if (!G) return false;
  const p = G.player;
  if (p.dead || p.iframes > 0 || G.ending) return false;
  const dmg = Math.max(1, Math.round(amount * (1 - p.armor)));
  p.hp -= dmg;
  p.iframes = CONFIG.player.iframes;
  p.blinkT = CONFIG.player.iframes;
  p.hurt = 0.22;
  const dx = p.x - sx, dy = p.y - sy, d = Math.hypot(dx, dy) || 1;
  p.kx += dx / d * CONFIG.player.recoil;
  p.ky += dy / d * CONFIG.player.recoil;
  G.hurtFlash = 1;
  G.hitStop = Math.max(G.hitStop, 0.035);
  addShake(0.3);
  spawnText(p.x, p.y - 72, '-' + dmg, '#ff5d6c', 20, 0.8);
  hitSparks(p.x, p.y - 30, '#ff7b7b', 8);
  sfx('hurt');
  if (p.hp <= 0) {
    p.hp = 0;
    p.dead = true;
    p.deathT = 0;
    for (let i = 0; i < 26; i++) {
      const a = rand(0, TAU), s = rand(60, 260);
      emit(PK.DOT, p.x, p.y - 30, Math.cos(a) * s, Math.sin(a) * s, rand(0.4, 0.9), rand(2, 4), i % 2 ? '#c9b48b' : '#ffffff', 4);
    }
    addShake(0.7);
    startEnding('defeat');
  }
  return true;
}

function healPlayer(n) {
  const p = G.player;
  const before = p.hp;
  p.hp = Math.min(p.maxHp, p.hp + n);
  const got = Math.round(p.hp - before);
  if (got > 0) spawnText(p.x, p.y - 74, '+' + got, '#7cf0b0', 20, 0.9);
}

// =====================================================================
// 7. ENEMIES
// =====================================================================
const ENEMY_ART = {
  runner: { name: 'Runner', extra: 'antenna', pal: {
    body: '#8fd14f', light: '#c9f28d', dark: '#4f8f2a', belly: '#e1f8b5', leg: '#3e6e22', legDark: '#2e5419',
    outline: '#1f3517', mouth: '#4a1320', tongue: '#ff7a8a', accent: '#f6ff9a' } },
  brute: { name: 'Brute', extra: 'horns', pal: {
    body: '#8e5bd1', light: '#be96f2', dark: '#5a3596', belly: '#dcc7f7', leg: '#4a2a7a', legDark: '#391f61',
    outline: '#22113d', mouth: '#3a0d1e', tongue: '#ff6f91', accent: '#f3ead2' } },
  dasher: { name: 'Dasher', extra: 'crest', pal: {
    body: '#ff8b3d', light: '#ffc27c', dark: '#c4541c', belly: '#ffe2c0', leg: '#9c3f14', legDark: '#7a300f',
    outline: '#461b07', mouth: '#4a0f14', tongue: '#ff8fa0', accent: '#ffe27a' } },
  miniboss: { name: 'Chompzilla', extra: 'crown', pal: {
    body: '#4f7cf0', light: '#93b3ff', dark: '#2a4cb2', belly: '#cbdaff', leg: '#253f8f', legDark: '#1a2e6c',
    outline: '#0f1b44', mouth: '#2a0b20', tongue: '#ff6f91', accent: '#ffd166' } },
  boss: { name: 'The Grand Gobbler', extra: 'boss', pal: {
    body: '#d8324a', light: '#ff7486', dark: '#8c1428', belly: '#ffb8c1', leg: '#5c0f1f', legDark: '#430a16',
    outline: '#28040c', mouth: '#1c0308', tongue: '#ff9db0', accent: '#ffcf4d' } },
};
const FLASH_PAL = {
  body: '#ffffff', light: '#ffffff', dark: '#ffecec', belly: '#ffffff', leg: '#fff0f0', legDark: '#ffe6e6',
  outline: '#ffd2d2', mouth: '#ffd2d2', tongue: '#ffffff', accent: '#ffffff',
};

function enemyScaling(f) {
  const S = CONFIG.scaling;
  return { hp: difficulty(f) + f * S.hpLinear, speed: 1 + f * S.speed, dmg: 1 + f * S.damage };
}

function spawnEnemy(type, x, y) {
  const cfg = CONFIG.enemies[type];
  const boss = type === 'miniboss' || type === 'boss';
  const sc = boss ? { hp: 1, speed: 1, dmg: 1 } : enemyScaling(G.time / CONFIG.RUN_DURATION);
  const hp = Math.round(cfg.hp * sc.hp);
  const e = {
    id: G.nextId++, type, cfg, boss, x, y, vx: 0, vy: 0, kx: 0, ky: 0, r: cfg.radius,
    hp, maxHp: hp, speed: cfg.speed * sc.speed * (boss ? 1 : rand(0.9, 1.1)), dmg: cfg.damage * sc.dmg,
    mass: cfg.mass, flash: 0, flashCd: 0, stun: 0, orbCd: 0, pulseId: -1, cell: -1,
    phase: rand(0, TAU), seed: rand(0, 1000), face: 1, dead: false,
    state: 'chase', stateT: type === 'dasher' ? rand(1, 2.5) : 1.6, dirX: 1, dirY: 0,
    atk: '', atkIndex: 0, windup: 1, spitRot: 0, mile: 0,
  };
  G.enemies.push(e);
  return e;
}

function steer(e, nx, ny, speed, dt) {
  const k = Math.min(1, dt * 5);
  e.vx += (nx * speed - e.vx) * k;
  e.vy += (ny * speed - e.vy) * k;
}

// ---------- Spatial grid (enemy neighbourhood queries) ----------
const GRID = { size: 64, cols: 72, rows: 72, ox: 0, oy: 0, head: new Int32Array(72 * 72), next: new Int32Array(512) };
const queryOut = [];

function buildGrid(list, cx, cy) {
  const g = GRID;
  g.head.fill(-1);
  g.ox = cx - g.size * g.cols / 2;
  g.oy = cy - g.size * g.rows / 2;
  if (g.next.length < list.length) g.next = new Int32Array(list.length * 2);
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    e.cell = -1;
    if (e.dead || e.boss) continue;
    const gx = Math.floor((e.x - g.ox) / g.size), gy = Math.floor((e.y - g.oy) / g.size);
    if (gx < 0 || gy < 0 || gx >= g.cols || gy >= g.rows) continue;
    const c = gy * g.cols + gx;
    g.next[i] = g.head[c];
    g.head[c] = i;
    e.cell = c;
  }
}

function queryGrid(x, y, r, out) {
  out.length = 0;
  const g = GRID, list = G.enemies;
  const x0 = Math.max(0, Math.floor((x - r - g.ox) / g.size));
  const x1 = Math.min(g.cols - 1, Math.floor((x + r - g.ox) / g.size));
  const y0 = Math.max(0, Math.floor((y - r - g.oy) / g.size));
  const y1 = Math.min(g.rows - 1, Math.floor((y + r - g.oy) / g.size));
  for (let gy = y0; gy <= y1; gy++) {
    for (let gx = x0; gx <= x1; gx++) {
      let j = g.head[gy * g.cols + gx];
      while (j !== -1) { if (list[j]) out.push(list[j]); j = g.next[j]; }
    }
  }
  return out;
}

function nearestEnemy(x, y, maxR) {
  let best = null, bd = maxR * maxR;
  for (const e of G.enemies) {
    if (e.dead) continue;
    const dx = e.x - x, dy = e.y - y, d = dx * dx + dy * dy - e.r * e.r;
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

const nearBuf = [], nearDist = [];
function nearestEnemies(x, y, maxR, k) {
  nearBuf.length = 0; nearDist.length = 0;
  const max2 = maxR * maxR;
  for (const e of G.enemies) {
    if (e.dead) continue;
    const dx = e.x - x, dy = e.y - y, d = dx * dx + dy * dy;
    if (d > max2) continue;
    if (nearBuf.length < k || d < nearDist[nearBuf.length - 1]) {
      let i = Math.min(nearBuf.length, k - 1);
      if (nearBuf.length < k) { nearBuf.push(e); nearDist.push(d); }
      while (i > 0 && nearDist[i - 1] > d) { nearBuf[i] = nearBuf[i - 1]; nearDist[i] = nearDist[i - 1]; i--; }
      nearBuf[i] = e; nearDist[i] = d;
    }
  }
  return nearBuf;
}

function updateEnemies(dt) {
  const p = G.player, list = G.enemies;
  buildGrid(list, p.x, p.y);
  const freeze = !!G.ending;
  const recycleD = view.halfDiag * 1.7 + 260;
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    if (e.dead) continue;
    if (e.flash > 0) e.flash -= dt;
    if (e.flashCd > 0) e.flashCd -= dt;
    if (e.orbCd > 0) e.orbCd -= dt;
    const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 0.001;
    if (freeze) { e.vx *= 0.9; e.vy *= 0.9; }
    else if (e.stun > 0) { e.stun -= dt; e.vx *= 0.85; e.vy *= 0.85; }
    else if (e.boss) updateBossAI(e, dt, dx, dy, d);
    else if (e.type === 'dasher') updateDasherAI(e, dt, dx, dy, d);
    else steer(e, dx / d, dy / d, e.speed, dt);
    e.x += (e.vx + e.kx) * dt;
    e.y += (e.vy + e.ky) * dt;
    const kd = Math.exp(-dt * 7);
    e.kx *= kd; e.ky *= kd;
    e.phase += dt * (3 + Math.hypot(e.vx, e.vy) * 0.07);
    if (Math.abs(dx) > 4) e.face = dx > 0 ? 1 : -1;
    if (!e.boss && d > recycleD) relocateEnemy(e);
  }
  separateEnemies(list);
  playerContacts(p, freeze);
}

function updateDasherAI(e, dt, dx, dy, d) {
  const c = e.cfg;
  e.stateT -= dt;
  switch (e.state) {
    case 'chase':
      steer(e, dx / d, dy / d, e.speed, dt);
      if (e.stateT <= 0 && d < c.triggerRange) {
        e.state = 'windup'; e.stateT = c.windup; e.dirX = dx / d; e.dirY = dy / d;
      }
      break;
    case 'windup':
      e.vx *= 0.82; e.vy *= 0.82;
      if (e.stateT > c.windup * 0.4) { e.dirX = dx / d; e.dirY = dy / d; } // aim, then lock
      if (e.stateT <= 0) { e.state = 'dash'; e.stateT = c.dashTime; }
      break;
    case 'dash':
      e.vx = e.dirX * c.dashSpeed; e.vy = e.dirY * c.dashSpeed;
      if (Math.random() < 0.4) emit(PK.SMOKE, e.x, e.y, 0, -8, 0.4, 5, '#e8c9a0', 2, 0, 10, true);
      if (e.stateT <= 0) { e.state = 'recover'; e.stateT = c.recover; }
      break;
    default: // recover
      e.vx *= 0.9; e.vy *= 0.9;
      if (e.stateT <= 0) { e.state = 'chase'; e.stateT = rand(c.cooldown[0], c.cooldown[1]); }
  }
}

function updateBossAI(e, dt, dx, dy, d) {
  const c = e.cfg, rage = e.hp < e.maxHp * 0.5 ? 0.8 : 1;
  e.stateT -= dt;
  switch (e.state) {
    case 'chase':
      steer(e, dx / d, dy / d, e.speed, dt);
      if (e.stateT <= 0) beginBossAttack(e, d);
      break;
    case 'windup':
      e.vx *= 0.85; e.vy *= 0.85;
      if (e.atk === 'charge' && e.stateT > e.windup * 0.45) { e.dirX = dx / d; e.dirY = dy / d; }
      if (e.stateT <= 0) executeBossAttack(e);
      break;
    case 'charge':
      e.vx = e.dirX * c.chargeSpeed; e.vy = e.dirY * c.chargeSpeed;
      if (Math.random() < 0.7) emit(PK.SMOKE, e.x + rand(-e.r, e.r) * 0.6, e.y, -e.vx * 0.1, -20, 0.6, 10, '#d9bd92', 1.5, 0, 22, true);
      if (e.stateT <= 0) { e.state = 'recover'; e.stateT = c.recover * rage; addShake(0.2); }
      break;
    default: // recover (dizzy, vulnerable)
      e.vx *= 0.88; e.vy *= 0.88;
      if (e.stateT <= 0) { e.state = 'chase'; e.stateT = c.chaseTime * rage; }
  }
}

function beginBossAttack(e, d) {
  const c = e.cfg;
  let atk = c.attacks[e.atkIndex % c.attacks.length];
  e.atkIndex++;
  if (atk === 'charge' && d < 120) atk = 'slam'; // too close to charge: stomp instead
  e.atk = atk;
  e.state = 'windup';
  const base = atk === 'charge' ? c.chargeWindup : atk === 'slam' ? c.slamWindup : c.spitWindup;
  e.windup = base * (e.hp < e.maxHp * 0.5 ? 0.85 : 1);
  e.stateT = e.windup;
  sfx('telegraph');
}

function executeBossAttack(e) {
  const c = e.cfg, p = G.player;
  if (e.atk === 'charge') {
    e.state = 'charge'; e.stateT = c.chargeTime;
    sfx('charge');
    return;
  }
  if (e.atk === 'slam') {
    emit(PK.RING, e.x, e.y, 0, 0, 0.45, c.slamRadius * 0.3, '#ffb36b', 0, 0, c.slamRadius * 1.6);
    emit(PK.RING, e.x, e.y, 0, 0, 0.6, c.slamRadius * 0.2, '#ffffff', 0, 0, c.slamRadius * 1.3);
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * TAU, s = rand(160, 320);
      emit(PK.SMOKE, e.x + Math.cos(a) * e.r, e.y + Math.sin(a) * e.r * 0.6, Math.cos(a) * s, Math.sin(a) * s, 0.7, 12, '#d6b98c', 3, 0, 24, true);
    }
    addShake(0.75);
    G.hitStop = Math.max(G.hitStop, 0.05);
    sfx('slam');
    if (Math.hypot(p.x - e.x, p.y - e.y) < c.slamRadius + p.r) damagePlayer(c.slamDamage, e.x, e.y);
  } else if (e.atk === 'spit') {
    const n = c.spitCount;
    for (let i = 0; i < n; i++) fireHostile(e.x, e.y, e.spitRot + (i / n) * TAU, c.spitSpeed, c.spitDamage);
    const aim = Math.atan2(p.y - e.y, p.x - e.x);
    for (let i = -1; i <= 1; i++) fireHostile(e.x, e.y, aim + i * 0.16, c.spitSpeed * 1.25, c.spitDamage);
    e.spitRot += 0.17;
    addShake(0.3);
    sfx('spit');
  }
  e.state = 'recover';
  e.stateT = c.recover;
}

function separateEnemies(list) {
  const g = GRID;
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (a.dead || a.cell < 0) continue;
    const gx = a.cell % g.cols, gy = (a.cell / g.cols) | 0;
    for (let oy = -1; oy <= 1; oy++) {
      const y = gy + oy;
      if (y < 0 || y >= g.rows) continue;
      for (let ox = -1; ox <= 1; ox++) {
        const x = gx + ox;
        if (x < 0 || x >= g.cols) continue;
        let j = g.head[y * g.cols + x];
        while (j !== -1) {
          if (j > i) {
            const b = list[j];
            if (!b.dead) {
              const dx = b.x - a.x, dy = b.y - a.y, min = (a.r + b.r) * 0.92, d2 = dx * dx + dy * dy;
              if (d2 < min * min) {
                if (d2 < 0.0001) { a.x += rand(-1, 1); a.y += rand(-1, 1); }
                else {
                  const d = Math.sqrt(d2), corr = (min - d) * 0.6 / d, tot = a.mass + b.mass;
                  const wa = b.mass / tot, wb = a.mass / tot;
                  a.x -= dx * corr * wa; a.y -= dy * corr * wa;
                  b.x += dx * corr * wb; b.y += dy * corr * wb;
                }
              }
            }
          }
          j = g.next[j];
        }
      }
    }
  }
  // Bosses shove regular enemies out of the way.
  for (const bo of G.bosses) {
    if (bo.dead) continue;
    queryGrid(bo.x, bo.y, bo.r + 26, queryOut);
    for (const e of queryOut) {
      if (e.dead) continue;
      const dx = e.x - bo.x, dy = e.y - bo.y, min = bo.r + e.r * 0.8, d2 = dx * dx + dy * dy;
      if (d2 < min * min && d2 > 0.0001) {
        const d = Math.sqrt(d2), corr = (min - d) / d;
        e.x += dx * corr; e.y += dy * corr;
      }
    }
  }
}

function contactDamage(e) {
  if (e.state === 'dash') return e.dmg * (e.cfg.dashDamageMul || 1);
  if (e.state === 'charge') return e.dmg * (e.cfg.chargeDamageMul || 1);
  return e.dmg;
}

function playerContacts(p, freeze) {
  if (p.dead) { p.crowd = 0; return; }
  queryGrid(p.x, p.y, p.r + 26, queryOut);
  let crowd = 0;
  for (const e of queryOut) {
    if (e.dead) continue;
    const dx = e.x - p.x, dy = e.y - p.y, min = e.r + p.r, d2 = dx * dx + dy * dy;
    if (d2 >= min * min) continue;
    const d = Math.sqrt(d2) || 0.01;
    crowd++;
    // Push the enemy (not the hero) so the hero can never be sealed in.
    const corr = (min - d) * 0.5 / d;
    e.x += dx * corr; e.y += dy * corr;
    if (!freeze) damagePlayer(contactDamage(e), e.x, e.y);
  }
  for (const b of G.bosses) {
    if (b.dead) continue;
    const dx = p.x - b.x, dy = p.y - b.y, min = b.r * 0.85 + p.r, d2 = dx * dx + dy * dy;
    if (d2 >= min * min) continue;
    const d = Math.sqrt(d2) || 0.01;
    p.x += dx / d * (min - d); p.y += dy / d * (min - d);
    if (!freeze) damagePlayer(contactDamage(b), b.x, b.y);
  }
  p.crowd = crowd;
}

function relocateEnemy(e) {
  const p = G.player, sp = Math.hypot(p.vx, p.vy);
  const a = sp > 20 ? Math.atan2(p.vy, p.vx) + rand(-0.9, 0.9) : rand(0, TAU);
  const d = view.halfDiag + CONFIG.spawn.margin;
  e.x = p.x + Math.cos(a) * d;
  e.y = p.y + Math.sin(a) * d;
  e.kx = e.ky = 0;
}

/** The single authoritative place where enemies (including bosses) take damage. */
function damageEnemy(e, base, kx, ky, kb, stun) {
  if (e.dead) return 0;
  const p = G.player;
  let dmg = base * p.damageMul;
  const crit = Math.random() < p.critChance;
  if (crit) dmg *= CONFIG.player.critMultiplier;
  dmg = Math.max(1, Math.round(dmg * rand(0.9, 1.1)));
  e.hp -= dmg;
  // Bosses flash less often so their colours stay readable under constant fire.
  if (e.flashCd <= 0) { e.flash = 0.09; if (e.boss) e.flashCd = 0.3; }
  G.damageDealt += dmg;
  if (kb) {
    const k = kb * p.knockbackMul / e.mass;
    e.kx += kx * k; e.ky += ky * k;
  }
  if (stun && !e.boss) e.stun = Math.max(e.stun, stun);
  const ty = e.y - e.r * 2.2;
  if (crit) spawnText(e.x, ty, dmg + '!', '#ffd84a', 22, 0.75);
  else spawnText(e.x, ty, dmg, e.boss ? '#ffc2b8' : '#ffffff', 15, 0.55);
  sfx('hit');
  if (e.boss) checkBossMilestone(e);
  if (e.hp <= 0) killEnemy(e);
  return dmg;
}

function checkBossMilestone(e) {
  const marks = [0.75, 0.5, 0.25];
  while (e.mile < marks.length && e.hp > 0 && e.hp <= e.maxHp * marks[e.mile]) {
    spawnText(e.x, e.y - e.r * 2.7, `${Math.round(marks[e.mile] * 100)}% HP!`, '#ffb347', 30, 1.4);
    emit(PK.RING, e.x, e.y - e.r, 0, 0, 0.5, e.r, '#ffb347', 0, 0, e.r * 4);
    addShake(0.25);
    e.mile++;
  }
}

function killEnemy(e) {
  if (e.dead) return;
  e.dead = true;
  G.kills++;
  G.combo++;
  G.comboT = 2.2;
  G.killPulse = 1;
  if (G.kills % 100 === 0) spawnText(G.player.x, G.player.y - 95, `${G.kills} KILLS!`, '#ffd166', 24, 1.3);
  const pal = ENEMY_ART[e.type].pal, f = G.time / CONFIG.RUN_DURATION;
  deathBurst(e.x, e.y - e.r, e.r, pal, e.boss);
  sfx(e.boss ? 'bossdie' : 'kill');
  if (!e.boss) {
    dropGem(e.x, e.y, Math.max(1, Math.round(e.cfg.xp * (1 + f * CONFIG.xp.timeBonus))));
    if (Math.random() < CONFIG.drops.medkitChance) dropPickup(e.x, e.y, 'medkit');
    else if (Math.random() < CONFIG.drops.magnetChance) dropPickup(e.x, e.y, 'magnet');
    return;
  }
  addShake(1);
  G.hitStop = Math.max(G.hitStop, 0.14);
  const n = e.type === 'boss' ? 14 : 9;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const g = dropGem(e.x + Math.cos(a) * 30, e.y + Math.sin(a) * 30, Math.ceil(e.cfg.xp / n));
    g.vx = Math.cos(a) * 260; g.vy = Math.sin(a) * 260;
  }
  if (e.type === 'miniboss') {
    G.minibossDefeated = true;
    dropPickup(e.x - 24, e.y, 'medkit');
    dropPickup(e.x + 24, e.y, 'magnet');
    banner('MINIBOSS DEFEATED', 'Bonus XP and supplies dropped!', '#ffd166');
  } else {
    G.bossDefeated = true;
    banner('FINAL BOSS DEFEATED!', 'The Grand Gobbler is down!', '#ffd166');
    startEnding('victory', true);
  }
}

function compactEnemies() {
  const a = G.enemies;
  let j = 0;
  for (let i = 0; i < a.length; i++) if (!a[i].dead) a[j++] = a[i];
  a.length = j;
  if (G.bosses.length) {
    let k = 0;
    for (let i = 0; i < G.bosses.length; i++) if (!G.bosses[i].dead) G.bosses[k++] = G.bosses[i];
    G.bosses.length = k;
  }
}

// =====================================================================
// 8. SPAWNER & DIFFICULTY
// =====================================================================
/** Smooth, accelerating difficulty curve: 1 at the start, 1 + scale at 5:00. */
function difficulty(f) { return 1 + f * f * CONFIG.DIFFICULTY_SCALE; }

function chooseEnemyType(f) {
  const S = CONFIG.spawn;
  const wb = f < S.bruteFrom ? 0 : lerp(S.bruteWeight[0], S.bruteWeight[1], f);
  const wd = f < S.dasherFrom ? 0 : lerp(S.dasherWeight[0], S.dasherWeight[1], f);
  const r = Math.random() * (1 + wb + wd);
  return r < 1 ? 'runner' : r < 1 + wb ? 'brute' : 'dasher';
}

function spawnAtEdge(type) {
  const p = G.player, a = rand(0, TAU), d = view.halfDiag + CONFIG.spawn.margin;
  return spawnEnemy(type, p.x + Math.cos(a) * d, p.y + Math.sin(a) * d);
}

function spawnSwarmRing(f) {
  const p = G.player, S = CONFIG.spawn;
  const n = Math.round(S.swarmBase + S.swarmExtra * f);
  const d = view.halfDiag + 40, off = rand(0, TAU);
  for (let i = 0; i < n && G.enemies.length < CONFIG.caps.enemies; i++) {
    const a = off + (i / n) * TAU;
    spawnEnemy(f > 0.6 && i % 4 === 0 ? 'dasher' : 'runner', p.x + Math.cos(a) * d, p.y + Math.sin(a) * d);
  }
  banner('SWARM INCOMING!', 'They are closing in from every side', '#ff9f43');
}

function spawnBoss(type) {
  if (type === 'miniboss') G.minibossSpawned = true; else G.bossSpawned = true;
  const p = G.player, a = rand(0, TAU), d = view.halfDiag * 0.85 + 60;
  const e = spawnEnemy(type, p.x + Math.cos(a) * d, p.y + Math.sin(a) * d);
  e.stateT = 1.8;
  G.bosses.push(e);
  banner(type === 'boss' ? 'FINAL BOSS' : 'MINIBOSS', ENEMY_ART[type].name, '#ff5d6c');
  addShake(0.6);
  sfx('boss');
  return e;
}

function updateSpawner(dt) {
  const f = G.time / CONFIG.RUN_DURATION, S = CONFIG.spawn;
  // Each boss spawns exactly once, guarded by a flag rather than float equality.
  if (!G.minibossWarned && G.time >= CONFIG.MINIBOSS_TIME - CONFIG.BOSS_WARNING) {
    G.minibossWarned = true; banner('WARNING', 'Something big is coming…', '#ff5d6c');
  }
  if (!G.bossWarned && G.time >= CONFIG.BOSS_TIME - CONFIG.BOSS_WARNING) {
    G.bossWarned = true; banner('WARNING', 'The ground is shaking…', '#ff5d6c');
  }
  if (!G.minibossSpawned && G.time >= CONFIG.MINIBOSS_TIME) spawnBoss('miniboss');
  if (!G.bossSpawned && G.time >= CONFIG.BOSS_TIME) spawnBoss('boss');
  if (G.swarmIndex < S.swarmTimes.length && G.time >= S.swarmTimes[G.swarmIndex]) {
    G.swarmIndex++;
    spawnSwarmRing(f);
  }
  let rate = S.baseRate * difficulty(f) + S.linearRate * f;
  if (G.bosses.length) rate *= S.bossSpawnFactor;
  const maxAlive = Math.min(CONFIG.caps.enemies, S.baseMax + S.extraMax * Math.pow(f, 1.2));
  G.spawnAcc += rate * dt;
  while (G.spawnAcc >= 1) {
    G.spawnAcc -= 1;
    if (G.enemies.length < maxAlive) spawnAtEdge(chooseEnemyType(f));
  }
}

// =====================================================================
// 9. WEAPONS
// =====================================================================
const WEAPON_ORDER = ['strike', 'syringe', 'pulse', 'medallion'];
const WEAPONS = {
  strike: {
    name: 'Sword Strike', evoName: 'Rapid Response',
    desc: 'Auto-slashes the nearest enemy with his katana.',
    evoDesc: 'Blazing-fast, extra-wide katana sweeps that hit much harder.',
    update: updateStrike,
  },
  syringe: {
    name: 'Syringe Projectile', evoName: 'Syringe Barrage',
    desc: 'Fires syringes at the nearest enemy.',
    evoDesc: 'A volley of piercing syringes that seeks out many targets.',
    update: updateSyringe,
  },
  pulse: {
    name: 'Pulse Ring', evoName: 'Defib Shockwave',
    desc: 'Emits a damaging ring that pushes enemies back.',
    evoDesc: 'A huge double shockwave that stuns everything it touches.',
    update: updatePulse,
  },
  medallion: {
    name: 'Rotating Medallion', evoName: 'Caduceus Halo',
    desc: 'Golden medallions orbit you and bash enemies.',
    evoDesc: 'A wide, fast halo of large medallions.',
    update: updateMedallion,
  },
};

/** Base stats for a weapon at a level (before the hero's passive multipliers). */
function weaponBaseStats(id, L, evo) {
  const c = CONFIG.weapons[id], n = L - 1;
  switch (id) {
    case 'strike':
      return evo ? { dmg: c.evo.dmg, cd: c.evo.cd, range: c.evo.range, arc: c.evo.arc, kb: c.evo.kb }
        : { dmg: c.dmg + c.dmgPerLv * n, cd: c.cd + c.cdPerLv * n, range: c.range + c.rangePerLv * n, arc: c.arc + c.arcPerLv * n, kb: c.kb };
    case 'syringe':
      return evo ? { dmg: c.evo.dmg, cd: c.evo.cd, count: c.evo.count, speed: c.evo.speed, range: c.evo.range, pierce: c.evo.pierce, spread: c.evo.spread }
        : { dmg: c.dmg + c.dmgPerLv * n, cd: c.cd + c.cdPerLv * n, count: 1 + Math.floor(n / 2), speed: c.speed, range: c.range, pierce: 0, spread: c.spread };
    case 'pulse':
      return evo ? { dmg: c.evo.dmg, cd: c.evo.cd, radius: c.evo.radius, kb: c.evo.kb, stun: c.evo.stun }
        : { dmg: c.dmg + c.dmgPerLv * n, cd: c.cd + c.cdPerLv * n, radius: c.radius + c.radiusPerLv * n, kb: c.kb, stun: 0 };
    default: // medallion
      return evo ? { dmg: c.evo.dmg, count: c.evo.count, orbit: c.evo.orbit, spin: c.evo.spin, size: c.evo.size, hitCd: c.evo.hitCd }
        : { dmg: c.dmg + c.dmgPerLv * n, count: 1 + Math.floor(L / 2), orbit: c.orbit + c.orbitPerLv * L, spin: c.spin + c.spinPerLv * L, size: c.size, hitCd: c.hitCd };
  }
}

/** Recompute final weapon stats. Called whenever a level, evolution or passive changes. */
function refreshStats() {
  const p = G.player;
  for (const w of G.weapons) {
    const s = weaponBaseStats(w.id, w.level, w.evolved);
    if (s.cd) s.cd *= p.cooldownMul;
    if (s.hitCd) s.hitCd *= p.cooldownMul;
    if (s.range) s.range *= p.areaMul;
    if (s.radius) s.radius *= p.areaMul * p.pulseMul;
    if (s.orbit) s.orbit *= p.areaMul;
    if (w.id === 'syringe') s.count += p.syringeExtra;
    if (w.id === 'medallion') s.count += p.orbExtra;
    w.s = s;
  }
}

function hasWeapon(id) { return G.weapons.some((w) => w.id === id); }
function getWeapon(id) { return G.weapons.find((w) => w.id === id); }
function addWeapon(id) {
  if (hasWeapon(id)) return getWeapon(id);
  const w = { id, level: 1, evolved: false, timer: 0.25, angle: 0, flip: false, echo: 0, s: null };
  G.weapons.push(w);
  refreshStats();
  return w;
}

function updateWeapons(dt) {
  for (const w of G.weapons) WEAPONS[w.id].update(w, dt);
}

function updateStrike(w, dt) {
  w.timer -= dt;
  if (w.timer > 0) return;
  const s = w.s, p = G.player;
  const t = nearestEnemy(p.x, p.y, s.range + 20);
  if (!t) { w.timer = 0.05; return; }
  w.timer = s.cd;
  w.flip = !w.flip;
  const ang = Math.atan2(t.y - p.y, t.x - p.x);
  G.strikes.push({ ang, arc: s.arc, range: s.range, t: 0, life: CONFIG.weapons.strike.life * (w.evolved ? 1.25 : 1), evo: w.evolved, flip: w.flip });
  const half = s.arc / 2;
  for (const e of G.enemies) {
    if (e.dead) continue;
    const dx = e.x - p.x, dy = e.y - p.y, reach = s.range + e.r, d2 = dx * dx + dy * dy;
    if (d2 > reach * reach) continue;
    const d = Math.sqrt(d2) || 0.01;
    if (d > e.r + p.r && Math.abs(angleDiff(Math.atan2(dy, dx), ang)) > half + Math.asin(Math.min(1, e.r / d))) continue;
    damageEnemy(e, s.dmg, dx / d, dy / d, s.kb);
    hitSparks(e.x, e.y - e.r, w.evolved ? '#fff6b0' : '#cdeeff', w.evolved ? 6 : 4);
    if (w.evolved) emit(PK.GLOW, e.x, e.y - e.r, 0, 0, 0.16, e.r * 1.6, '#fff1a8', 0);
  }
  sfx('strike');
}

function updateSyringe(w, dt) {
  w.timer -= dt;
  if (w.timer > 0) return;
  const s = w.s, p = G.player;
  const t = nearestEnemy(p.x, p.y, s.range);
  if (!t) { w.timer = 0.1; return; }
  w.timer = s.cd;
  const base = Math.atan2(t.y - p.y, t.x - p.x);
  if (w.evolved) {
    // Barrage: one syringe per distinct nearby target, the rest fan out.
    const targets = nearestEnemies(p.x, p.y, s.range, s.count);
    for (let i = 0; i < s.count; i++) {
      const tg = targets[i];
      fireSyringe(tg ? Math.atan2(tg.y - p.y, tg.x - p.x) : base + (i - (s.count - 1) / 2) * s.spread, s, true);
    }
  } else {
    for (let i = 0; i < s.count; i++) fireSyringe(base + (i - (s.count - 1) / 2) * s.spread, s, false);
  }
  sfx('syringe');
}

function updatePulse(w, dt) {
  w.timer -= dt;
  if (w.echo > 0) { w.echo -= dt; if (w.echo <= 0) emitPulse(w, 0.8); }
  if (w.timer > 0) return;
  const p = G.player;
  if (!nearestEnemy(p.x, p.y, w.s.radius + 30)) { w.timer = 0.1; return; }
  w.timer = w.s.cd;
  emitPulse(w, 1);
  if (w.evolved) w.echo = CONFIG.weapons.pulse.evo.echoDelay;
  sfx('pulse');
}

function emitPulse(w, scale) {
  const p = G.player;
  G.pulses.push({ id: ++G.pulseSeq, x: p.x, y: p.y, r: 0, maxR: w.s.radius * scale, t: 0, dur: CONFIG.weapons.pulse.dur,
    dmg: w.s.dmg * scale, kb: w.s.kb, stun: w.s.stun, evo: w.evolved });
}

function updatePulses(dt) {
  const p = G.player;
  for (let i = G.pulses.length - 1; i >= 0; i--) {
    const u = G.pulses[i];
    u.t += dt; u.x = p.x; u.y = p.y;
    const k = Math.min(1, u.t / u.dur);
    u.r = u.maxR * easeOutCubic(k);
    if (k < 1 && !G.ending) {
      for (const e of G.enemies) {
        if (e.dead || e.pulseId === u.id) continue;
        const dx = e.x - u.x, dy = e.y - u.y, rr = u.r + e.r, d2 = dx * dx + dy * dy;
        if (d2 > rr * rr) continue;
        e.pulseId = u.id; // each pulse hits each enemy at most once
        const d = Math.sqrt(d2) || 1;
        damageEnemy(e, u.dmg, dx / d, dy / d, u.kb, u.stun);
      }
    }
    if (u.t > u.dur + 0.2) G.pulses.splice(i, 1);
  }
}

function updateMedallion(w, dt) {
  const s = w.s, p = G.player, n = s.count;
  w.angle = (w.angle + s.spin * dt) % TAU;
  for (let i = 0; i < n; i++) {
    const a = w.angle + (i / n) * TAU;
    const ox = p.x + Math.cos(a) * s.orbit, oy = p.y + Math.sin(a) * s.orbit;
    queryGrid(ox, oy, s.size + 26, queryOut);
    for (let j = 0; j <= queryOut.length + G.bosses.length - 1; j++) {
      const e = j < queryOut.length ? queryOut[j] : G.bosses[j - queryOut.length];
      if (e.dead || e.orbCd > 0) continue;
      const dx = e.x - ox, dy = e.y - oy, rr = e.r + s.size;
      if (dx * dx + dy * dy > rr * rr) continue;
      e.orbCd = s.hitCd; // per-enemy cooldown: no per-frame damage
      const px = e.x - p.x, py = e.y - p.y, pd = Math.hypot(px, py) || 1;
      damageEnemy(e, s.dmg, px / pd, py / pd, CONFIG.weapons.medallion.kb);
      hitSparks(ox, oy - 16, '#ffe08a', 4);
    }
  }
}

function updateStrikes(dt) {
  for (let i = G.strikes.length - 1; i >= 0; i--) {
    const s = G.strikes[i];
    s.t += dt;
    if (s.t >= s.life) G.strikes.splice(i, 1);
  }
}

// =====================================================================
// 10. PROJECTILES & COLLISION
// =====================================================================
const projectiles = [];
function initProjectiles() {
  projectiles.length = 0;
  for (let i = 0; i < CONFIG.caps.projectiles; i++) {
    projectiles.push({ on: false, hostile: false, evo: false, x: 0, y: 0, vx: 0, vy: 0, ang: 0, life: 0, dmg: 0, pierce: 0, r: 6, h0: 0, h1: 0, h2: 0 });
  }
}
function allocProjectile() {
  for (const pr of projectiles) if (!pr.on) return pr;
  return null;
}

function fireSyringe(a, s, evo) {
  const pr = allocProjectile();
  if (!pr) return;
  const p = G.player;
  pr.on = true; pr.hostile = false; pr.evo = evo;
  pr.x = p.x + Math.cos(a) * 12; pr.y = p.y + Math.sin(a) * 12;
  pr.vx = Math.cos(a) * s.speed; pr.vy = Math.sin(a) * s.speed; pr.ang = a;
  pr.life = s.range / s.speed;
  pr.dmg = s.dmg; pr.pierce = s.pierce; pr.r = CONFIG.weapons.syringe.radius;
  pr.h0 = pr.h1 = pr.h2 = 0;
}

function fireHostile(x, y, a, speed, dmg) {
  const pr = allocProjectile();
  if (!pr) return;
  pr.on = true; pr.hostile = true; pr.evo = false;
  pr.x = x; pr.y = y; pr.vx = Math.cos(a) * speed; pr.vy = Math.sin(a) * speed; pr.ang = a;
  pr.life = 4; pr.dmg = dmg; pr.pierce = 0; pr.r = 9;
}

function projectileHit(pr) {
  queryGrid(pr.x, pr.y, pr.r + 24, queryOut);
  for (let j = 0; j < queryOut.length + G.bosses.length; j++) {
    const e = j < queryOut.length ? queryOut[j] : G.bosses[j - queryOut.length];
    if (e.dead || e.id === pr.h0 || e.id === pr.h1 || e.id === pr.h2) continue;
    const dx = e.x - pr.x, dy = e.y - pr.y, rr = e.r + pr.r;
    if (dx * dx + dy * dy < rr * rr) return e;
  }
  return null;
}

function updateProjectiles(dt) {
  const p = G.player;
  for (const pr of projectiles) {
    if (!pr.on) continue;
    pr.life -= dt;
    if (pr.life <= 0) { pr.on = false; continue; }
    pr.x += pr.vx * dt; pr.y += pr.vy * dt;
    if (pr.hostile) {
      if (G.ending) { pr.on = false; continue; }
      const dx = p.x - pr.x, dy = p.y - pr.y, rr = p.r + pr.r;
      if (dx * dx + dy * dy < rr * rr) {
        damagePlayer(pr.dmg, pr.x, pr.y);
        hitSparks(pr.x, pr.y - 20, '#c38bff', 6);
        pr.on = false;
      }
      continue;
    }
    const hit = projectileHit(pr);
    if (!hit) continue;
    const sp = Math.hypot(pr.vx, pr.vy) || 1;
    damageEnemy(hit, pr.dmg, pr.vx / sp, pr.vy / sp, CONFIG.weapons.syringe.kb);
    hitSparks(pr.x, pr.y - 18, '#ff8cc6', 5);
    if (!pr.h0) pr.h0 = hit.id; else if (!pr.h1) pr.h1 = hit.id; else pr.h2 = hit.id;
    pr.pierce--;
    if (pr.pierce < 0) pr.on = false; // consumed after its last allowed hit
  }
}

// =====================================================================
// 11. XP GEMS & PICKUPS
// =====================================================================
function xpForLevel(L) {
  const X = CONFIG.xp, n = L - 1;
  return Math.round(X.base + X.linear * n + X.quad * n * n);
}
function gemTier(v) { return v >= CONFIG.xp.tier3 ? 2 : v >= CONFIG.xp.tier2 ? 1 : 0; }

function dropGem(x, y, value) {
  const gems = G.gems;
  if (gems.length >= CONFIG.caps.gems) {
    // At the cap, fold the farthest gem into the new one so XP is never lost.
    const p = G.player;
    let far = 0, fd = -1;
    for (let i = 0; i < gems.length; i++) {
      const dx = gems[i].x - p.x, dy = gems[i].y - p.y, d = dx * dx + dy * dy;
      if (d > fd) { fd = d; far = i; }
    }
    value += gems[far].value;
    gems[far] = gems[gems.length - 1];
    gems.pop();
  }
  const g = { x, y, value, tier: gemTier(value), vx: rand(-50, 50), vy: rand(-50, 50), pull: false, sp: 0, t: rand(0, 10) };
  gems.push(g);
  return g;
}

function gainXP(v) {
  G.xp += v * G.player.xpMul;
  G.xpFlash = 1;
  while (G.xp >= G.xpNext) {
    G.xp -= G.xpNext;
    G.level++;
    G.xpNext = xpForLevel(G.level);
    G.pendingLevels++;
  }
  G.xpStreak = Math.min(24, G.xpStreak + 1);
  G.xpStreakT = 0.6;
  sfx('xp', G.xpStreak);
}

function updateGems(dt) {
  const p = G.player, gems = G.gems;
  const mr = CONFIG.xp.magnetRadius * p.magnetMul, mr2 = mr * mr;
  const cr = p.r + CONFIG.xp.collectPad, cr2 = cr * cr;
  const pullAll = G.magnetAll > 0;
  if (pullAll) G.magnetAll -= dt;
  if (G.xpStreakT > 0) { G.xpStreakT -= dt; if (G.xpStreakT <= 0) G.xpStreak = 0; }
  const ps = Math.hypot(p.vx, p.vy);
  for (let i = gems.length - 1; i >= 0; i--) {
    const g = gems[i];
    g.t += dt;
    if (g.vx || g.vy) {
      const d = Math.exp(-dt * 6);
      g.x += g.vx * dt; g.y += g.vy * dt; g.vx *= d; g.vy *= d;
      if (Math.abs(g.vx) + Math.abs(g.vy) < 2) g.vx = g.vy = 0;
    }
    if (p.dead) continue;
    const dx = p.x - g.x, dy = p.y - g.y, d2 = dx * dx + dy * dy;
    if (pullAll || d2 < mr2) g.pull = true;
    if (g.pull) {
      const d = Math.sqrt(d2) || 1;
      g.sp = Math.min(CONFIG.xp.magnetMaxSpeed, g.sp + CONFIG.xp.magnetAccel * dt);
      const move = Math.min(d, (g.sp + ps) * dt);
      g.x += dx / d * move; g.y += dy / d * move;
    }
    const ex = p.x - g.x, ey = p.y - g.y;
    if (ex * ex + ey * ey < cr2) {
      // Remove first, then award: a gem can only ever be collected once.
      gems[i] = gems[gems.length - 1];
      gems.pop();
      gainXP(g.value);
    }
  }
}

function dropPickup(x, y, kind) {
  if (G.pickups.length >= CONFIG.caps.pickups) return;
  G.pickups.push({ x, y, kind, t: 0 });
}

function updatePickups(dt) {
  const p = G.player;
  for (let i = G.pickups.length - 1; i >= 0; i--) {
    const k = G.pickups[i];
    k.t += dt;
    if (p.dead) continue;
    const dx = p.x - k.x, dy = p.y - k.y, rr = p.r + 20;
    if (dx * dx + dy * dy > rr * rr) continue;
    G.pickups.splice(i, 1);
    if (k.kind === 'medkit') healPlayer(CONFIG.drops.medkitHeal);
    else { G.magnetAll = 0.5; spawnText(p.x, p.y - 80, 'MAGNET!', '#8fd0ff', 20, 1); }
    emit(PK.RING, k.x, k.y - 10, 0, 0, 0.35, 10, k.kind === 'medkit' ? '#7cf0b0' : '#8fd0ff', 0, 0, 140);
    sfx('pickup');
  }
}

// =====================================================================
// 12. UPGRADES & EVOLUTION
// =====================================================================
const PASSIVES = {
  might:    { name: 'Stronger Strikes', desc: 'All weapons deal more damage.', max: 5, label: 'Damage',
    fmt: (n) => `+${n * 15}%`, apply: (p) => { p.damageMul += 0.15; } },
  haste:    { name: 'Rapid Reflexes', desc: 'All weapons recharge faster.', max: 5, label: 'Cooldown',
    fmt: (n) => `-${Math.round((1 - Math.pow(0.92, n)) * 100)}%`, apply: (p) => { p.cooldownMul *= 0.92; } },
  reach:    { name: 'Extended Reach', desc: 'Larger attack range, radius and orbit.', max: 5, label: 'Range',
    fmt: (n) => `+${n * 10}%`, apply: (p) => { p.areaMul += 0.1; } },
  vitality: { name: 'Vitality', desc: 'Raises maximum health and heals a little.', max: 5, label: 'Max HP',
    fmt: (n) => `${CONFIG.player.maxHp + n * 20}`, apply: (p) => { p.maxHp += 20; p.hp = Math.min(p.maxHp, p.hp + 20); } },
  regen:    { name: 'Regeneration', desc: 'Slowly restores health over time.', max: 4, label: 'Regen',
    fmt: (n) => `${(n * 0.6).toFixed(1)} HP/s`, apply: (p) => { p.regen += 0.6; } },
  magnet:   { name: 'XP Magnet', desc: 'Pull XP gems in from farther away.', max: 4, label: 'Pickup range',
    fmt: (n) => `+${n * 40}%`, apply: (p) => { p.magnetMul += 0.4; } },
  shoes:    { name: 'Running Shoes', desc: 'Move faster.', max: 4, label: 'Speed',
    fmt: (n) => `+${n * 8}%`, apply: (p) => { p.speedMul += 0.08; } },
  crit:     { name: 'Critical Response', desc: 'Higher chance to land double-damage hits.', max: 4, label: 'Crit chance',
    fmt: (n) => `${Math.round((CONFIG.player.critChance + n * 0.07) * 100)}%`, apply: (p) => { p.critChance += 0.07; } },
  impact:   { name: 'Heavy Impact', desc: 'Every hit knocks enemies back harder.', max: 3, label: 'Knockback',
    fmt: (n) => `+${n * 35}%`, apply: (p) => { p.knockbackMul += 0.35; } },
  syringes: { name: 'Additional Syringes', desc: 'Fire one more syringe per volley.', max: 3, req: 'syringe', label: 'Extra syringes',
    fmt: (n) => `+${n}`, apply: (p) => { p.syringeExtra += 1; } },
  pulsePlus:{ name: 'Expanded Pulse', desc: 'Pulse Ring reaches much farther.', max: 3, req: 'pulse', label: 'Pulse radius',
    fmt: (n) => `+${n * 15}%`, apply: (p) => { p.pulseMul += 0.15; } },
  orbit:    { name: 'Extra Orbit', desc: 'Add another rotating medallion.', max: 3, req: 'medallion', label: 'Extra medallions',
    fmt: (n) => `+${n}`, apply: (p) => { p.orbExtra += 1; } },
  armor:    { name: 'Protective Scrubs', desc: 'Take less damage from every hit.', max: 4, label: 'Damage taken',
    fmt: (n) => `-${n * 7}%`, apply: (p) => { p.armor += 0.07; } },
  lucky:    { name: 'Lucky Find', desc: 'Gain more XP from every gem.', max: 4, label: 'XP gain',
    fmt: (n) => `+${n * 12}%`, apply: (p) => { p.xpMul += 0.12; } },
};

function rollOptions() {
  const opts = [], pool = [];
  for (const w of G.weapons) {
    if (w.level >= 5 && !w.evolved) opts.push({ kind: 'evolve', id: w.id }); // evolutions are always offered
    else if (w.level < 5) pool.push({ kind: 'weapon-level', id: w.id, weight: 3 });
  }
  for (const id of WEAPON_ORDER) if (!hasWeapon(id)) pool.push({ kind: 'weapon-new', id, weight: 2.4 });
  for (const id in PASSIVES) {
    const d = PASSIVES[id];
    if ((G.passives[id] || 0) >= d.max) continue;
    if (d.req && !hasWeapon(d.req)) continue;
    pool.push({ kind: 'passive', id, weight: 1.15 });
  }
  while (opts.length < 3 && pool.length) {
    let total = 0;
    for (const o of pool) total += o.weight;
    let r = Math.random() * total, i = 0;
    for (; i < pool.length - 1; i++) { r -= pool[i].weight; if (r <= 0) break; }
    opts.push(pool.splice(i, 1)[0]);
  }
  if (opts.length < 3) opts.push({ kind: 'fallback', id: 'adrenaline' });
  return opts.slice(0, 3);
}

const STAT_FMT = {
  dmg: ['Damage', (v) => Math.round(v)],
  count: ['Count', (v) => v],
  cd: ['Cooldown', (v) => v.toFixed(2) + 's'],
  arc: ['Arc', (v) => Math.round(v * 180 / Math.PI) + '°'],
  radius: ['Radius', (v) => Math.round(v)],
  range: ['Range', (v) => Math.round(v)],
  orbit: ['Orbit', (v) => Math.round(v)],
  pierce: ['Pierce', (v) => v],
  stun: ['Stun', (v) => v.toFixed(1) + 's'],
};
function statDiff(a, b, maxLines) {
  const out = [];
  for (const k in STAT_FMT) {
    if (!(k in b) || a[k] === b[k] || out.length >= maxLines) continue;
    const [label, f] = STAT_FMT[k];
    out.push(`${label} ${f(a[k] || 0)} → ${f(b[k])}`);
  }
  return out;
}

function describeOption(opt) {
  if (opt.kind === 'passive') {
    const d = PASSIVES[opt.id], n = G.passives[opt.id] || 0;
    return { name: d.name, desc: d.desc, tag: n ? `Lv ${n} → ${n + 1}` : 'New skill', value: `${d.label} ${d.fmt(n)} → ${d.fmt(n + 1)}`, icon: opt.id, rarity: 'passive', evo: false };
  }
  if (opt.kind === 'fallback') {
    return { name: 'Adrenaline Shot', desc: 'Heal 30 HP and gain a little extra damage.', tag: 'Bonus', value: 'Heal 30 · Damage +5%', icon: 'adrenaline', rarity: 'bonus', evo: false };
  }
  const W = WEAPONS[opt.id];
  if (opt.kind === 'weapon-new') {
    const s = weaponBaseStats(opt.id, 1, false);
    const extra = s.cd ? `every ${s.cd.toFixed(2)}s` : `${s.count} orbiting`;
    return { name: W.name, desc: W.desc, tag: 'New weapon', value: `Damage ${s.dmg} · ${extra}`, icon: opt.id, rarity: 'new', evo: false };
  }
  const w = getWeapon(opt.id);
  if (opt.kind === 'evolve') {
    const lines = statDiff(weaponBaseStats(opt.id, 5, false), weaponBaseStats(opt.id, 5, true), 3);
    return { name: W.evoName, desc: W.evoDesc, tag: 'Evolution', value: lines.join('<br>'), icon: opt.id, rarity: 'evolve', evo: true };
  }
  const lines = statDiff(weaponBaseStats(opt.id, w.level, false), weaponBaseStats(opt.id, w.level + 1, false), 2);
  return { name: W.name, desc: W.desc, tag: `Lv ${w.level} → ${w.level + 1}`, value: lines.join('<br>'), icon: opt.id, rarity: 'weapon', evo: false };
}

function evolveWeapon(id) {
  const w = getWeapon(id), p = G.player;
  w.evolved = true;
  G.evolved.push(WEAPONS[id].evoName);
  banner('EVOLUTION!', WEAPONS[id].evoName, '#ffd166');
  for (let i = 0; i < 40; i++) {
    const a = rand(0, TAU), s = rand(80, 340);
    emit(PK.SPARK, p.x, p.y - 30, Math.cos(a) * s, Math.sin(a) * s, rand(0.4, 0.8), 2.5, i % 2 ? '#ffd166' : '#fff6d0', 3);
  }
  emit(PK.RING, p.x, p.y, 0, 0, 0.6, 20, '#ffd166', 0, 0, 420);
  addShake(0.4);
  sfx('evolve');
}

function applyOption(opt) {
  const p = G.player;
  switch (opt.kind) {
    case 'weapon-new': addWeapon(opt.id); break;
    case 'weapon-level': getWeapon(opt.id).level++; break;
    case 'evolve': evolveWeapon(opt.id); break;
    case 'passive': G.passives[opt.id] = (G.passives[opt.id] || 0) + 1; PASSIVES[opt.id].apply(p); break;
    default: healPlayer(30); p.damageMul += 0.05;
  }
  G.upgradesTaken++;
  refreshStats();
  emit(PK.RING, p.x, p.y, 0, 0, 0.45, 12, '#ffd166', 0, 0, 240);
  spawnText(p.x, p.y - 88, 'LEVEL UP!', '#ffd166', 22, 1.0);
}

function openLevelUp() {
  state = STATE.LEVEL_UP;
  touch.stickId = null;
  G.options = rollOptions();
  UI.showLevelUp(G.options);
  sfx('levelup');
}

function chooseCard(i, force) {
  if (state !== STATE.LEVEL_UP || !G || !G.options) return false;
  if (!force && performance.now() < UI.levelUpReadyAt) return false;
  const opt = G.options[i];
  if (!opt) return false;
  applyOption(opt);
  G.pendingLevels = Math.max(0, G.pendingLevels - 1);
  if (G.pendingLevels > 0) {
    G.options = rollOptions();
    UI.showLevelUp(G.options);
    sfx('levelup');
  } else {
    G.options = null;
    state = STATE.PLAYING;
    UI.show(null);
  }
  return true;
}

// =====================================================================
// 13. PARTICLES & EFFECTS (pooled)
// =====================================================================
const PK = { DOT: 0, SPARK: 1, RING: 2, SMOKE: 3, STAR: 4, GHOST: 5, GLOW: 6 };
const particles = [];
const pFree = [];
let fxLevel = 1; // drops when frames get expensive; decorative particles go first

function initParticles() {
  particles.length = 0; pFree.length = 0;
  for (let i = 0; i < CONFIG.caps.particles; i++) {
    particles.push({ on: false, idx: i, kind: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, life: 0, max: 1, size: 1, grow: 0, color: '#fff', drag: 0, grav: 0, rot: 0 });
    pFree.push(i);
  }
}

function emit(kind, x, y, vx, vy, life, size, color, drag = 4, grav = 0, grow = 0, low = false) {
  if (!pFree.length) return null;
  if (low && (pFree.length < particles.length * 0.3 || Math.random() > fxLevel)) return null;
  const q = particles[pFree.pop()];
  q.on = true; q.kind = kind; q.x = x; q.y = y; q.z = 0; q.vx = vx; q.vy = vy;
  q.life = q.max = life; q.size = size; q.grow = grow; q.color = color; q.drag = drag; q.grav = grav; q.rot = rand(0, TAU);
  return q;
}

function updateParticles(dt) {
  for (const q of particles) {
    if (!q.on) continue;
    q.life -= dt;
    if (q.life <= 0) { q.on = false; pFree.push(q.idx); continue; }
    const d = Math.exp(-q.drag * dt);
    q.vx *= d; q.vy = q.vy * d + q.grav * dt;
    q.x += q.vx * dt; q.y += q.vy * dt;
    q.size = Math.max(0.1, q.size + q.grow * dt);
  }
}

function hitSparks(x, y, color, n) {
  n = Math.max(1, Math.round(n * fxLevel));
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU), s = rand(120, 300);
    emit(PK.SPARK, x, y, Math.cos(a) * s, Math.sin(a) * s, rand(0.12, 0.25), 2, color, 6, 0, 0, i > 1);
  }
}

function deathBurst(x, y, r, pal, big) {
  const n = Math.round((big ? 50 : 5 + r * 0.25) * (big ? 1 : fxLevel));
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU), s = rand(60, big ? 420 : 200);
    emit(PK.DOT, x, y, Math.cos(a) * s, Math.sin(a) * s - 40, rand(0.3, big ? 1 : 0.55), rand(r * 0.12, r * 0.24), i % 3 ? pal.body : pal.light, 4.5, 260, 0, !big && i > 2);
  }
  emit(PK.RING, x, y, 0, 0, big ? 0.6 : 0.25, r * 0.5, pal.light, 0, 0, r * (big ? 8 : 6));
  if (big) {
    emit(PK.GLOW, x, y, 0, 0, 0.5, r * 2.5, '#fff1c0', 0, 0, r * 3);
    for (let i = 0; i < 30; i++) {
      const a = rand(0, TAU), s = rand(200, 600);
      emit(PK.SPARK, x, y, Math.cos(a) * s, Math.sin(a) * s, rand(0.3, 0.7), 3, '#fff1c0', 3);
    }
  }
}

// ---------- Floating text (ring buffer) ----------
const texts = [];
let textCursor = 0;
function initTexts() {
  texts.length = 0; textCursor = 0;
  for (let i = 0; i < CONFIG.caps.texts; i++) texts.push({ on: false, x: 0, y: 0, vy: 0, life: 0, max: 1, str: '', color: '#fff', size: 14 });
}
function spawnText(x, y, str, color, size, life) {
  const t = texts[textCursor];
  textCursor = (textCursor + 1) % texts.length;
  t.on = true; t.x = x + rand(-6, 6); t.y = y; t.vy = -70; t.life = t.max = life;
  t.str = String(str); t.color = color; t.size = size;
}
function updateTexts(dt) {
  for (const t of texts) {
    if (!t.on) continue;
    t.life -= dt;
    if (t.life <= 0) { t.on = false; continue; }
    t.y += t.vy * dt; t.vy *= Math.exp(-dt * 4);
  }
}

// ---------- Banners ----------
function banner(title, sub, color) {
  if (!G) return;
  if (G.banners.length > 3) G.banners.shift();
  G.banners.push({ title, sub, color, t: 0, dur: 2.4 });
}
function updateBanners(dt) {
  const b = G.banners[0];
  if (!b) return;
  b.t += dt;
  if (b.t >= b.dur) G.banners.shift();
}

// =====================================================================
// 14. HUD & INTERFACE
// =====================================================================
const UI = {
  screens: {},
  levelUpReadyAt: 0,
  titleAnchorY: 0,
  readyTimer: 0,

  init() {
    for (const id of ['title', 'levelup', 'pause', 'results']) this.screens[id] = $('screen-' + id);
    $('btn-start').addEventListener('click', () => startRun());
    $('btn-resume').addEventListener('click', () => resumeGame());
    $('btn-restart').addEventListener('click', () => startRun());
    $('btn-title').addEventListener('click', () => goTitle());
    $('btn-again').addEventListener('click', () => startRun());
    $('btn-results-title').addEventListener('click', () => goTitle());
    document.querySelectorAll('[data-sound]').forEach((b) => b.addEventListener('click', () => toggleSound()));
    $('cards').addEventListener('click', (e) => {
      const card = e.target.closest('.card');
      if (card) chooseCard(Number(card.dataset.index));
    });
    this.updateSound();
  },

  show(name) {
    for (const k in this.screens) this.screens[k].classList.toggle('hidden', k !== name);
    if (name === 'title') this.measure();
  },

  measure() {
    const sp = document.querySelector('.title-spacer');
    if (!sp || !this.screens.title || this.screens.title.classList.contains('hidden')) return;
    const r = sp.getBoundingClientRect();
    this.titleAnchorY = r.height > 60 ? r.top + r.height * 0.74 : view.h * 0.55;
  },

  updateSound() {
    document.querySelectorAll('[data-sound]').forEach((b) => { b.textContent = `Sound: ${AudioFX.enabled ? 'On' : 'Off'}`; });
  },

  showLevelUp(options) {
    const box = $('cards');
    box.innerHTML = '';
    box.classList.remove('ready');
    options.forEach((opt, i) => {
      const info = describeOption(opt);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'card rarity-' + info.rarity;
      btn.dataset.index = String(i);
      btn.style.animationDelay = (i * 0.07) + 's';
      btn.innerHTML = `<span class="key">${i + 1}</span><span class="tag">${info.tag}</span><canvas width="160" height="160"></canvas><h3>${info.name}</h3><p>${info.desc}</p><div class="value">${info.value}</div>`;
      box.appendChild(btn);
      drawIcon(btn.querySelector('canvas').getContext('2d'), info.icon, 160, info.evo);
    });
    const lvl = G.level - G.pendingLevels + 1;
    $('levelup-sub').textContent = `Level ${lvl} reached · Choose one upgrade`;
    this.levelUpReadyAt = performance.now() + CONFIG.LEVELUP_INPUT_DELAY;
    clearTimeout(this.readyTimer);
    this.readyTimer = setTimeout(() => box.classList.add('ready'), CONFIG.LEVELUP_INPUT_DELAY);
    this.show('levelup');
  },

  buildChips(el) {
    el.innerHTML = '';
    for (const w of G.weapons) {
      const s = document.createElement('span');
      s.className = 'chip ' + (w.evolved ? 'evo' : 'weapon');
      s.textContent = w.evolved ? `★ ${WEAPONS[w.id].evoName}` : `${WEAPONS[w.id].name} Lv ${w.level}`;
      el.appendChild(s);
    }
    for (const id in G.passives) {
      const s = document.createElement('span');
      s.className = 'chip';
      s.textContent = `${PASSIVES[id].name} ×${G.passives[id]}`;
      el.appendChild(s);
    }
  },

  showPause() {
    this.buildChips($('pause-build'));
    this.show('pause');
  },

  showResults(victory, bossDefeated) {
    const panel = this.screens.results.querySelector('.panel');
    panel.classList.toggle('win', victory);
    panel.classList.toggle('lose', !victory);
    $('results-title').textContent = victory ? 'Victory' : 'Defeat';
    $('results-sub').textContent = victory
      ? (bossDefeated ? 'You defeated The Grand Gobbler!' : 'You survived all five minutes — but the final boss was not defeated.')
      : 'The swarm overwhelmed you. Sharpen up and try again.';
    const bossStatus = bossDefeated ? ['Defeated', 'good'] : G.bossSpawned ? ['Survived it', 'bad'] : ['Not reached', ''];
    const miniStatus = G.minibossDefeated ? ['Defeated', 'good'] : G.minibossSpawned ? ['Not defeated', 'bad'] : ['Not reached', ''];
    const rows = [
      ['Time survived', fmtTime(Math.min(G.time, CONFIG.RUN_DURATION)), ''],
      ['Enemies defeated', G.kills.toLocaleString(), ''],
      ['Highest level', String(G.level), ''],
      ['Final boss', bossStatus[0], bossStatus[1]],
      ['Miniboss', miniStatus[0], miniStatus[1]],
      ['Weapons evolved', G.evolved.length ? `${G.evolved.length} (${G.evolved.join(', ')})` : '0', G.evolved.length ? 'good' : ''],
      ['Upgrades acquired', String(G.upgradesTaken), ''],
      ['Damage dealt', Math.round(G.damageDealt).toLocaleString(), ''],
    ];
    const dl = $('results-stats');
    dl.innerHTML = '';
    for (const [k, v, cls] of rows) {
      const dt = document.createElement('dt'); dt.textContent = k;
      const dd = document.createElement('dd'); dd.textContent = v; if (cls) dd.className = cls;
      dl.append(dt, dd);
    }
    this.buildChips($('results-build'));
    $('btn-again').textContent = victory ? 'Play Again' : 'Retry';
    this.show('results');
  },
};

// ---------- Procedural icons (level-up cards and HUD) ----------
const iconCache = new Map();
function getIcon(key, evo) {
  const k = key + (evo ? '*' : '');
  let cv = iconCache.get(k);
  if (!cv) {
    cv = document.createElement('canvas');
    cv.width = cv.height = 96;
    drawIcon(cv.getContext('2d'), key, 96, evo);
    iconCache.set(k, cv);
  }
  return cv;
}

function heartPath(c, x, y, s) {
  c.beginPath();
  c.moveTo(x, y + s * 0.9);
  c.bezierCurveTo(x - s * 1.25, y + s * 0.05, x - s * 0.95, y - s * 0.95, x, y - s * 0.38);
  c.bezierCurveTo(x + s * 0.95, y - s * 0.95, x + s * 1.25, y + s * 0.05, x, y + s * 0.9);
  c.closePath();
}

function drawIcon(c, key, size, evo) {
  c.save();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, size, size);
  c.translate(size / 2, size / 2);
  c.scale(size / 64, size / 64);
  c.lineCap = 'round';
  c.lineJoin = 'round';
  const bg = c.createRadialGradient(-8, -10, 2, 0, 0, 30);
  bg.addColorStop(0, evo ? '#5a4a1f' : '#36493f');
  bg.addColorStop(1, evo ? '#221a08' : '#141d19');
  c.beginPath(); c.arc(0, 0, 29, 0, TAU); c.fillStyle = bg; c.fill();
  c.strokeStyle = evo ? '#ffd166' : 'rgba(255,255,255,0.16)'; c.lineWidth = evo ? 2.5 : 1.5; c.stroke();
  switch (key) {
    case 'strike': {
      c.beginPath(); c.arc(-2, 4, 23, -2.3, 0.15);
      c.strokeStyle = evo ? 'rgba(255,209,102,0.75)' : 'rgba(143,212,255,0.75)'; c.lineWidth = 5; c.stroke();
      c.save(); c.translate(-13, 14); c.rotate(-0.85);
      drawKatana(c, HERO_PAL, 0, 0, 0, 34, evo, 0.3, false);
      c.restore();
      star4(c, 13, -15, 5, '#ffffff');
      break;
    }
    case 'syringe':
      c.save(); c.rotate(-0.75); drawSyringeShape(c, 1.55, evo ? '#c38bff' : '#ff5fa2'); c.restore();
      break;
    case 'syringes':
      for (const a of [-1.15, -0.75, -0.35]) { c.save(); c.rotate(a); c.translate(-2, 0); drawSyringeShape(c, 1.05, '#ff5fa2'); c.restore(); }
      break;
    case 'pulse':
      for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(0, 0, 8 + i * 7, 0, TAU); c.strokeStyle = evo ? `rgba(160,240,255,${1 - i * 0.25})` : `rgba(111,255,210,${1 - i * 0.28})`; c.lineWidth = 3.5 - i * 0.7; c.stroke(); }
      c.beginPath(); c.arc(0, 0, 4, 0, TAU); c.fillStyle = '#ffffff'; c.fill();
      break;
    case 'pulsePlus':
      c.beginPath(); c.arc(0, 0, 12, 0, TAU); c.strokeStyle = '#6fffd2'; c.lineWidth = 3.5; c.stroke();
      for (let i = 0; i < 4; i++) { c.save(); c.rotate(i * Math.PI / 2 + Math.PI / 4); arrowShape(c, 16, '#c9fff0'); c.restore(); }
      break;
    case 'medallion':
      c.beginPath(); c.arc(0, 0, 19, 0, TAU); c.setLineDash([3, 4]); c.strokeStyle = 'rgba(255,209,102,0.55)'; c.lineWidth = 1.5; c.stroke(); c.setLineDash([]);
      drawMedallionShape(c, evo ? 13 : 11.5, evo);
      break;
    case 'orbit':
      c.beginPath(); c.arc(0, 0, 17, 0, TAU); c.strokeStyle = 'rgba(255,209,102,0.5)'; c.lineWidth = 1.5; c.stroke();
      c.beginPath(); c.arc(0, 0, 6, 0, TAU); c.fillStyle = '#c9b48b'; c.fill();
      for (let i = 0; i < 3; i++) { const a = i * TAU / 3 - 0.5; c.save(); c.translate(Math.cos(a) * 17, Math.sin(a) * 17); drawMedallionShape(c, 5.5, false); c.restore(); }
      break;
    case 'might':
      burstShape(c, 20, 10, 9, '#ff9f43'); burstShape(c, 12, 6, 9, '#ffe08a');
      break;
    case 'haste':
      c.beginPath(); c.arc(0, 3, 16, 0, TAU); c.fillStyle = '#e8f6ff'; c.fill(); c.strokeStyle = '#4fa8ff'; c.lineWidth = 3; c.stroke();
      c.fillStyle = '#4fa8ff'; c.fillRect(-3, -19, 6, 5);
      c.beginPath(); c.moveTo(0, 3); c.lineTo(0, -8); c.moveTo(0, 3); c.lineTo(8, 6); c.strokeStyle = '#1d3550'; c.lineWidth = 2.5; c.stroke();
      break;
    case 'reach':
      for (let i = 0; i < 4; i++) { c.save(); c.rotate(i * Math.PI / 2); arrowShape(c, 20, '#8fd0ff'); c.restore(); }
      c.beginPath(); c.arc(0, 0, 5, 0, TAU); c.fillStyle = '#ffffff'; c.fill();
      break;
    case 'vitality':
      heartPath(c, 0, 0, 18); c.fillStyle = '#ff5d6c'; c.fill(); c.strokeStyle = '#7a1622'; c.lineWidth = 2; c.stroke();
      c.beginPath(); c.ellipse(-7, -6, 4, 2.5, -0.6, 0, TAU); c.fillStyle = 'rgba(255,255,255,0.6)'; c.fill();
      break;
    case 'regen':
      heartPath(c, 0, 0, 18); c.fillStyle = '#4fd68a'; c.fill(); c.strokeStyle = '#1a5a35'; c.lineWidth = 2; c.stroke();
      c.fillStyle = '#ffffff'; c.fillRect(-2.5, -8, 5, 15); c.fillRect(-7.5, -3, 15, 5);
      break;
    case 'magnet':
      c.beginPath(); c.arc(0, -2, 13, Math.PI, 0, true); c.strokeStyle = '#ff5d6c'; c.lineWidth = 9; c.lineCap = 'butt'; c.stroke();
      c.fillStyle = '#dfe7ec'; c.fillRect(-17.5, -10, 9, 7); c.fillRect(8.5, -10, 9, 7);
      c.lineCap = 'round';
      c.fillStyle = '#59b4ff'; c.beginPath(); c.moveTo(0, -24); c.lineTo(5, -17); c.lineTo(0, -10); c.lineTo(-5, -17); c.closePath(); c.fill();
      break;
    case 'shoes':
      c.beginPath(); c.moveTo(-18, 6); c.quadraticCurveTo(-18, -8, -8, -10); c.lineTo(-2, -4); c.quadraticCurveTo(10, -2, 18, 4); c.quadraticCurveTo(20, 10, 14, 11); c.lineTo(-16, 11); c.closePath();
      c.fillStyle = '#4fa8ff'; c.fill(); c.strokeStyle = '#173a5e'; c.lineWidth = 2; c.stroke();
      c.fillStyle = '#ffffff'; c.fillRect(-18, 8, 34, 4);
      c.beginPath(); c.moveTo(-22, -2); c.lineTo(-28, -2); c.moveTo(-21, 4); c.lineTo(-29, 4); c.strokeStyle = '#8fd0ff'; c.lineWidth = 2; c.stroke();
      break;
    case 'crit':
      c.beginPath(); c.arc(0, 0, 15, 0, TAU); c.strokeStyle = '#ff5d6c'; c.lineWidth = 3; c.stroke();
      c.beginPath(); c.arc(0, 0, 7, 0, TAU); c.stroke();
      c.beginPath(); c.moveTo(0, -22); c.lineTo(0, -10); c.moveTo(0, 22); c.lineTo(0, 10); c.moveTo(-22, 0); c.lineTo(-10, 0); c.moveTo(22, 0); c.lineTo(10, 0); c.lineWidth = 2.5; c.stroke();
      c.beginPath(); c.arc(0, 0, 2.5, 0, TAU); c.fillStyle = '#ffd84a'; c.fill();
      break;
    case 'impact':
      c.save(); c.rotate(-0.6);
      c.fillStyle = '#8a5a2b'; c.fillRect(-2.5, -2, 5, 24);
      roundRectPath(c, -12, -14, 24, 13, 3); c.fillStyle = '#b8c3cc'; c.fill(); c.strokeStyle = '#46525c'; c.lineWidth = 2; c.stroke();
      c.restore();
      c.beginPath(); c.moveTo(12, -18); c.lineTo(18, -22); c.moveTo(15, -10); c.lineTo(23, -11); c.moveTo(8, -22); c.lineTo(10, -28); c.strokeStyle = '#ffd166'; c.lineWidth = 2.5; c.stroke();
      break;
    case 'armor':
      c.beginPath(); c.moveTo(0, -20); c.lineTo(16, -13); c.quadraticCurveTo(16, 10, 0, 20); c.quadraticCurveTo(-16, 10, -16, -13); c.closePath();
      c.fillStyle = '#c9b48b'; c.fill(); c.strokeStyle = '#5c4a2c'; c.lineWidth = 2.5; c.stroke();
      c.fillStyle = '#1f9aa3'; c.fillRect(-3, -10, 6, 18); c.fillRect(-9, -4, 18, 6);
      break;
    case 'lucky':
      for (let i = 0; i < 4; i++) { c.save(); c.rotate(i * Math.PI / 2 + Math.PI / 4); heartPath(c, 0, -9, 8.5); c.fillStyle = i % 2 ? '#4fd68a' : '#3fbf74'; c.fill(); c.restore(); }
      c.beginPath(); c.moveTo(0, 2); c.quadraticCurveTo(4, 14, 10, 20); c.strokeStyle = '#2e8a52'; c.lineWidth = 2.5; c.stroke();
      break;
    default: // adrenaline
      c.beginPath(); c.moveTo(4, -22); c.lineTo(-10, 3); c.lineTo(-1, 3); c.lineTo(-5, 22); c.lineTo(11, -4); c.lineTo(2, -4); c.closePath();
      c.fillStyle = '#ffd84a'; c.fill(); c.strokeStyle = '#7a5a10'; c.lineWidth = 2; c.stroke();
  }
  if (evo) {
    star4(c, 18, -18, 6, '#fff6d0');
    star4(c, -19, 15, 4, '#ffd166');
  }
  c.restore();
}

function shurikenPath(c, x, y, ro, ri) {
  c.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU - Math.PI / 2, r = i % 2 ? ri : ro;
    if (i) c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); else c.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  c.closePath();
}

function star4(c, x, y, r, color) {
  c.beginPath();
  c.moveTo(x, y - r); c.quadraticCurveTo(x, y, x + r, y); c.quadraticCurveTo(x, y, x, y + r);
  c.quadraticCurveTo(x, y, x - r, y); c.quadraticCurveTo(x, y, x, y - r);
  c.fillStyle = color; c.fill();
}
function burstShape(c, ro, ri, n, color) {
  c.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? ri : ro, a = (i / (n * 2)) * TAU - Math.PI / 2;
    if (i) c.lineTo(Math.cos(a) * r, Math.sin(a) * r); else c.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  c.closePath(); c.fillStyle = color; c.fill();
}
function arrowShape(c, len, color) {
  c.beginPath();
  c.moveTo(len, 0); c.lineTo(len - 8, -6); c.lineTo(len - 8, -2.2); c.lineTo(5, -2.2); c.lineTo(5, 2.2); c.lineTo(len - 8, 2.2); c.lineTo(len - 8, 6);
  c.closePath(); c.fillStyle = color; c.fill();
}

// ---------- Canvas HUD ----------
function hudText(c, str, x, y, size, color, align, weight) {
  c.font = `${weight || 800} ${size}px ${FONT}`;
  c.textAlign = align || 'left';
  c.textBaseline = 'middle';
  c.lineWidth = Math.max(2, size * 0.16);
  c.strokeStyle = 'rgba(10,12,10,0.85)';
  c.strokeText(str, x, y);
  c.fillStyle = color;
  c.fillText(str, x, y);
}

function renderHUD() {
  const c = ctx, w = view.w, h = view.h, p = G.player;
  const narrow = w < 560;

  // XP bar across the very top.
  const xpH = 9, frac = clamp(G.xp / G.xpNext, 0, 1);
  c.fillStyle = 'rgba(6,12,14,0.8)';
  c.fillRect(0, 0, w, xpH + 3);
  const xg = c.createLinearGradient(0, 0, w, 0);
  xg.addColorStop(0, '#2fa8ff'); xg.addColorStop(1, '#7af0ff');
  c.fillStyle = xg;
  c.fillRect(0, 0, w * frac, xpH);
  c.fillStyle = 'rgba(255,255,255,0.35)';
  c.fillRect(0, 0, w * frac, 2.5);
  if (G.xpFlash > 0) { c.fillStyle = `rgba(200,250,255,${G.xpFlash * 0.4})`; c.fillRect(0, 0, w * frac, xpH); }

  // Level badge.
  const bx = 34, by = 44;
  c.beginPath(); c.arc(bx, by, 21, 0, TAU);
  const lg = c.createRadialGradient(bx - 6, by - 8, 2, bx, by, 22);
  lg.addColorStop(0, '#5fe0ff'); lg.addColorStop(1, '#1a5f9e');
  c.fillStyle = lg; c.fill();
  c.lineWidth = 3; c.strokeStyle = '#0b1c2c'; c.stroke();
  hudText(c, 'LV', bx, by - 8, 10, '#d8f6ff', 'center', 900);
  hudText(c, String(G.level), bx, by + 5, 17, '#ffffff', 'center', 900);

  // Health bar (on narrow screens it shrinks to the space left of the timer).
  const tw = narrow ? 92 : 124;
  const hx = 62, hy = 33, hw = narrow ? Math.max(64, w / 2 - tw / 2 - hx - 10) : 240, hh = 20;
  roundRectPath(c, hx, hy, hw, hh, 7);
  c.fillStyle = 'rgba(10,8,8,0.8)'; c.fill();
  const hf = clamp(p.hp / p.maxHp, 0, 1), gf = clamp(p.hpGhost / p.maxHp, 0, 1);
  if (gf > hf) { roundRectPath(c, hx + 2, hy + 2, (hw - 4) * gf, hh - 4, 5); c.fillStyle = 'rgba(255,240,220,0.75)'; c.fill(); }
  if (hf > 0) {
    roundRectPath(c, hx + 2, hy + 2, Math.max(6, (hw - 4) * hf), hh - 4, 5);
    const hg = c.createLinearGradient(0, hy, 0, hy + hh);
    hg.addColorStop(0, '#ff8a8a'); hg.addColorStop(0.5, '#e8384f'); hg.addColorStop(1, '#a51d33');
    c.fillStyle = hg; c.fill();
  }
  c.lineWidth = 2; c.strokeStyle = 'rgba(255,255,255,0.18)'; roundRectPath(c, hx, hy, hw, hh, 7); c.stroke();
  heartPath(c, hx + 2, hy + hh / 2, 8); c.fillStyle = '#ff5d6c'; c.fill(); c.strokeStyle = '#3a0a12'; c.lineWidth = 2; c.stroke();
  hudText(c, hw < 120 ? String(Math.ceil(p.hp)) : `${Math.ceil(p.hp)} / ${p.maxHp}`, hx + hw / 2 + 6, hy + hh / 2 + 1, 13, '#ffffff', 'center', 800);

  // Timer pill.
  const remain = CONFIG.RUN_DURATION - G.time;
  const th = 42, tx = w / 2 - tw / 2, ty = 16;
  roundRectPath(c, tx, ty, tw, th, 14);
  c.fillStyle = 'rgba(8,12,10,0.78)'; c.fill();
  c.lineWidth = 2; c.strokeStyle = remain <= 30 ? 'rgba(255,93,108,0.8)' : 'rgba(255,255,255,0.16)'; c.stroke();
  const pulse = remain <= 30 ? 1 + Math.sin(G.animT * 8) * 0.04 : 1;
  hudText(c, fmtTime(remain), w / 2, ty + th / 2 + 1, Math.round((narrow ? 24 : 28) * pulse), remain <= 30 ? '#ffd166' : '#ffffff', 'center', 900);
  hudText(c, 'SURVIVE', w / 2, ty + th + 9, 10, 'rgba(220,230,220,0.7)', 'center', 800);

  // Pause button and kill counter (top right).
  const pb = hudButtons.pause;
  pb.w = 36; pb.h = 36; pb.x = w - 50; pb.y = 26;
  roundRectPath(c, pb.x, pb.y, pb.w, pb.h, 10);
  c.fillStyle = 'rgba(8,12,10,0.7)'; c.fill(); c.strokeStyle = 'rgba(255,255,255,0.18)'; c.lineWidth = 2; c.stroke();
  c.fillStyle = '#ffffff'; c.fillRect(pb.x + 12, pb.y + 10, 4, 16); c.fillRect(pb.x + 20, pb.y + 10, 4, 16);
  const kx = pb.x - 14, ky = 44, ks = 1 + G.killPulse * 0.15;
  hudText(c, G.kills.toLocaleString(), kx, ky, Math.round(20 * ks), '#ffffff', 'right', 900);
  c.font = `900 ${Math.round(20 * ks)}px ${FONT}`;
  drawSkull(c, kx - c.measureText(G.kills.toLocaleString()).width - 16, ky, 9);
  if (G.combo >= 10) hudText(c, `x${G.combo} combo`, kx, ky + 22, 12, '#ffb347', 'right', 800);

  // Boss health bars (final boss first; both can be alive after 4:30).
  const liveBosses = G.bosses.filter((b) => !b.dead).sort((a, b) => (a.type === 'boss' ? -1 : 1) - (b.type === 'boss' ? -1 : 1));
  liveBosses.forEach((boss, i) => {
    const bw = Math.min(i ? 360 : 520, w - 40), bxx = w / 2 - bw / 2, byy = 88 + i * 34;
    hudText(c, ENEMY_ART[boss.type].name.toUpperCase(), w / 2, byy - 9, i ? 11 : 13, boss.type === 'boss' ? '#ff8a8a' : '#a8c4ff', 'center', 900);
    roundRectPath(c, bxx, byy, bw, 14, 6);
    c.fillStyle = 'rgba(10,6,8,0.85)'; c.fill();
    const bf = clamp(boss.hp / boss.maxHp, 0, 1);
    if (bf > 0) {
      roundRectPath(c, bxx + 2, byy + 2, Math.max(4, (bw - 4) * bf), 10, 4);
      const bg = c.createLinearGradient(0, byy, 0, byy + 14);
      if (boss.type === 'boss') { bg.addColorStop(0, '#ff7a6a'); bg.addColorStop(1, '#b0122c'); }
      else { bg.addColorStop(0, '#8fb0ff'); bg.addColorStop(1, '#2a4cb2'); }
      c.fillStyle = bg; c.fill();
    }
    c.strokeStyle = 'rgba(255,220,200,0.35)'; c.lineWidth = 2; roundRectPath(c, bxx, byy, bw, 14, 6); c.stroke();
    for (const m of [0.25, 0.5, 0.75]) { c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(bxx + bw * m - 1, byy + 2, 2, 10); }
    drawBossPointer(c, boss);
  });

  // Weapon tiles (bottom left).
  const tile = narrow ? 40 : 48, gap = 8, wy = h - tile - 16;
  G.weapons.forEach((wp, i) => {
    const x = 16 + i * (tile + gap);
    roundRectPath(c, x, wy, tile, tile, 10);
    c.fillStyle = 'rgba(8,12,10,0.75)'; c.fill();
    c.lineWidth = 2; c.strokeStyle = wp.evolved ? '#ffd166' : 'rgba(255,255,255,0.18)'; c.stroke();
    c.drawImage(getIcon(wp.id, wp.evolved), x + 3, wy + 3, tile - 6, tile - 6);
    if (wp.evolved) hudText(c, '★', x + tile - 9, wy + 9, 12, '#ffd166', 'center', 900);
    else for (let k = 0; k < 5; k++) {
      c.fillStyle = k < wp.level ? '#8ff5d8' : 'rgba(255,255,255,0.2)';
      c.fillRect(x + 6 + k * ((tile - 12) / 5), wy + tile + 3, (tile - 12) / 5 - 2, 3);
    }
  });

  // Dash: keyboard indicator, or a big button in touch mode.
  const dashReady = clamp(1 - p.dashCd / CONFIG.dash.cooldown, 0, 1);
  if (touch.used) {
    const db = hudButtons.dash;
    db.r = 38; db.x = w - 64; db.y = h - 74;
    c.beginPath(); c.arc(db.x, db.y, db.r, 0, TAU); c.fillStyle = dashReady >= 1 ? 'rgba(143,245,216,0.32)' : 'rgba(20,30,26,0.55)'; c.fill();
    c.beginPath(); c.arc(db.x, db.y, db.r, -Math.PI / 2, -Math.PI / 2 + TAU * dashReady); c.strokeStyle = '#8ff5d8'; c.lineWidth = 4; c.stroke();
    hudText(c, 'DASH', db.x, db.y, 14, '#ffffff', 'center', 900);
    if (touch.stickId !== null) {
      c.beginPath(); c.arc(touch.ox, touch.oy, 56, 0, TAU); c.fillStyle = 'rgba(255,255,255,0.08)'; c.fill(); c.strokeStyle = 'rgba(255,255,255,0.3)'; c.lineWidth = 2; c.stroke();
      const dx = touch.x - touch.ox, dy = touch.y - touch.oy, m = Math.hypot(dx, dy), k = m > 56 ? 56 / m : 1;
      c.beginPath(); c.arc(touch.ox + dx * k, touch.oy + dy * k, 24, 0, TAU); c.fillStyle = 'rgba(143,245,216,0.55)'; c.fill();
    }
  } else {
    const dx = 16 + Math.max(1, G.weapons.length) * (tile + gap) + 20, dy = wy + tile / 2;
    c.beginPath(); c.arc(dx, dy, tile * 0.42, 0, TAU); c.fillStyle = 'rgba(8,12,10,0.75)'; c.fill();
    c.beginPath(); c.arc(dx, dy, tile * 0.42, -Math.PI / 2, -Math.PI / 2 + TAU * dashReady); c.strokeStyle = dashReady >= 1 ? '#8ff5d8' : 'rgba(143,245,216,0.5)'; c.lineWidth = 3; c.stroke();
    hudText(c, 'DASH', dx, dy - 4, 10, dashReady >= 1 ? '#ffffff' : '#9aa59f', 'center', 900);
    hudText(c, 'SPACE', dx, dy + 8, 8, 'rgba(220,230,220,0.6)', 'center', 800);
  }

  // Banner announcements.
  const b = G.banners[0];
  if (b) {
    const t = b.t, inK = clamp(t / 0.25, 0, 1), outK = clamp((b.dur - t) / 0.35, 0, 1);
    const a = Math.min(inK, outK), s = 0.7 + 0.3 * easeOutBack(inK);
    c.save();
    c.globalAlpha = a;
    c.translate(w / 2, h * 0.27);
    c.scale(s, s);
    const bw = Math.min(w - 30, 560);
    const grd = c.createLinearGradient(-bw / 2, 0, bw / 2, 0);
    grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(0.2, 'rgba(8,10,8,0.7)'); grd.addColorStop(0.8, 'rgba(8,10,8,0.7)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = grd; c.fillRect(-bw / 2, -34, bw, 70);
    hudText(c, b.title, 0, -8, narrow ? 28 : 38, b.color, 'center', 900);
    if (b.sub) hudText(c, b.sub, 0, 22, narrow ? 13 : 16, '#f4efe2', 'center', 700);
    c.restore();
  }

  if (DEBUG_MODE) {
    hudText(c, `work ${workMs.toFixed(1)}ms fx ${fxLevel} e ${G.enemies.length} g ${G.gems.length} p ${CONFIG.caps.particles - pFree.length}`, 12, h - 90, 12, '#ffffff', 'left', 700);
  }
}

function drawSkull(c, x, y, s) {
  c.beginPath(); c.arc(x, y - s * 0.15, s, 0, TAU); c.fillStyle = '#f4efe2'; c.fill();
  c.fillRect(x - s * 0.55, y + s * 0.4, s * 1.1, s * 0.7);
  c.fillStyle = '#1a1a1a';
  c.beginPath(); c.arc(x - s * 0.38, y - s * 0.1, s * 0.27, 0, TAU); c.arc(x + s * 0.38, y - s * 0.1, s * 0.27, 0, TAU); c.fill();
  c.fillRect(x - s * 0.1, y + s * 0.55, s * 0.2, s * 0.5);
}

function drawBossPointer(c, boss) {
  const z = view.zoom;
  const sx = (boss.x - G.cam.x) * z + view.w / 2, sy = (boss.y - boss.r - G.cam.y) * z + view.h / 2;
  const m = 40;
  if (sx > m && sx < view.w - m && sy > 110 && sy < view.h - m) return;
  const cx = view.w / 2, cy = view.h / 2, a = Math.atan2(sy - cy, sx - cx);
  const ex = clamp(cx + Math.cos(a) * view.w, m, view.w - m), ey = clamp(cy + Math.sin(a) * view.h, 120, view.h - m);
  c.save();
  c.translate(ex, ey); c.rotate(a);
  c.globalAlpha = 0.75 + Math.sin(realTime * 8) * 0.25;
  c.beginPath(); c.moveTo(18, 0); c.lineTo(-8, -12); c.lineTo(-3, 0); c.lineTo(-8, 12); c.closePath();
  c.fillStyle = boss.type === 'boss' ? '#ff5d6c' : '#8fb0ff'; c.fill();
  c.strokeStyle = '#1a0508'; c.lineWidth = 2; c.stroke();
  c.restore();
}

/** Dynamic full-screen overlays (the static vignette is a CSS layer, #vignette). */
function drawScreenOverlays(c) {
  const w = view.w, h = view.h;
  if (!G) return;
  const p = G.player, low = p.hp / p.maxHp;
  if (low < 0.35 && !p.dead) {
    const a = (0.35 - low) / 0.35 * (0.35 + Math.sin(G.animT * 6) * 0.12);
    const rg = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.hypot(w, h) * 0.6);
    rg.addColorStop(0, 'rgba(200,0,20,0)'); rg.addColorStop(1, `rgba(200,0,20,${a})`);
    c.fillStyle = rg; c.fillRect(0, 0, w, h);
  }
  if (G.hurtFlash > 0) { c.fillStyle = `rgba(255,60,60,${G.hurtFlash * 0.18})`; c.fillRect(0, 0, w, h); }
}

// =====================================================================
// 15. AUDIO (Web Audio synthesis, starts muted)
// =====================================================================
const SFX_GAP = { hit: 0.045, kill: 0.04, xp: 0.035, strike: 0.06, syringe: 0.08, pulse: 0.1, hurt: 0.1, telegraph: 0.2 };
const AudioFX = {
  ctx: null, master: null, noiseBuf: null, enabled: false, last: Object.create(null),

  init() {
    if (this.ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try { this.ctx = new AC(); } catch (err) { return false; }
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.3;
    const comp = this.ctx.createDynamicsCompressor();
    this.master.connect(comp);
    comp.connect(this.ctx.destination);
    const len = Math.floor(this.ctx.sampleRate * 0.6);
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return true;
  },

  setEnabled(on) {
    this.enabled = !!on && this.init();
    if (this.enabled && this.ctx.state === 'suspended') this.ctx.resume();
  },

  tone(f0, f1, dur, type, vol, delay) {
    const t = this.ctx.currentTime + (delay || 0);
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.03);
  },

  noise(dur, vol, freq, q, type, f1, delay) {
    const t = this.ctx.currentTime + (delay || 0);
    const s = this.ctx.createBufferSource(), fl = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    s.buffer = this.noiseBuf;
    fl.type = type; fl.Q.value = q;
    fl.frequency.setValueAtTime(freq, t);
    if (f1) fl.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(this.master);
    s.start(t); s.stop(t + dur + 0.03);
  },

  play(name, x) {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime, gap = SFX_GAP[name] || 0.03;
    if (this.last[name] !== undefined && now - this.last[name] < gap) return;
    this.last[name] = now;
    switch (name) {
      case 'strike': this.noise(0.09, 0.16, 2200, 0.9, 'bandpass', 5200); break;
      case 'hit': this.tone(340, 170, 0.05, 'square', 0.035); break;
      case 'kill': this.tone(560 + Math.random() * 160, 150, 0.1, 'triangle', 0.1); break;
      case 'xp': { const f = 760 + (x || 0) * 28; this.tone(f, f * 1.5, 0.06, 'sine', 0.06); break; }
      case 'syringe': this.tone(1300, 700, 0.07, 'triangle', 0.05); this.noise(0.06, 0.05, 4000, 1, 'highpass'); break;
      case 'pulse': this.tone(190, 60, 0.35, 'sine', 0.22); this.noise(0.25, 0.06, 700, 0.7, 'lowpass', 200); break;
      case 'dash': this.noise(0.18, 0.12, 900, 0.7, 'bandpass', 2800); break;
      case 'hurt': this.tone(170, 70, 0.22, 'square', 0.12); this.noise(0.15, 0.12, 500, 1, 'lowpass'); break;
      case 'pickup': this.tone(660, 990, 0.12, 'triangle', 0.14); this.tone(990, 1320, 0.12, 'triangle', 0.1, 0.08); break;
      case 'levelup': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, f, 0.16, 'triangle', 0.14, i * 0.07)); break;
      case 'evolve': [392, 523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, f * 1.01, 0.3, 'sawtooth', 0.05, i * 0.06)); this.noise(0.6, 0.08, 3000, 0.5, 'bandpass', 8000); break;
      case 'boss': this.tone(62, 48, 1.4, 'sawtooth', 0.2); this.tone(93, 70, 1.4, 'square', 0.08); this.noise(1.2, 0.12, 200, 0.6, 'lowpass'); break;
      case 'telegraph': this.tone(280, 560, 0.35, 'sawtooth', 0.045); break;
      case 'charge': this.noise(0.6, 0.14, 300, 0.8, 'bandpass', 900); break;
      case 'slam': this.tone(95, 32, 0.5, 'sine', 0.35); this.noise(0.45, 0.22, 320, 0.6, 'lowpass', 90); break;
      case 'spit': this.tone(420, 160, 0.25, 'square', 0.06); break;
      case 'bossdie': this.tone(220, 40, 1.2, 'sawtooth', 0.15); this.noise(1.0, 0.25, 600, 0.5, 'lowpass', 80); break;
      case 'victory': [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.tone(f, f, 0.28, 'triangle', 0.15, i * 0.12)); break;
      case 'defeat': [392, 330, 262, 196].forEach((f, i) => this.tone(f, f * 0.97, 0.38, 'triangle', 0.14, i * 0.2)); break;
      default: break;
    }
  },
};
function sfx(name, x) { AudioFX.play(name, x); }
function toggleSound() {
  AudioFX.setEnabled(!AudioFX.enabled);
  UI.updateSound();
  if (AudioFX.enabled) sfx('pickup');
}

// =====================================================================
// 16. MAIN LOOP
// =====================================================================
let lastNow = 0, accumulator = 0, workMs = 4;

function frame(now) {
  requestAnimationFrame(frame);
  if (!lastNow) lastNow = now;
  const dt = Math.min((now - lastNow) / 1000, CONFIG.MAX_FRAME_DT);
  lastNow = now;
  realTime += dt;
  const t0 = performance.now();
  if (state === STATE.PLAYING && G) {
    accumulator += dt;
    let n = 0;
    while (accumulator >= CONFIG.STEP && n < CONFIG.MAX_STEPS_PER_FRAME) {
      step(CONFIG.STEP);
      accumulator -= CONFIG.STEP;
      n++;
      if (state !== STATE.PLAYING) { accumulator = 0; break; }
    }
    if (n >= CONFIG.MAX_STEPS_PER_FRAME) accumulator = 0;
  } else {
    accumulator = 0;
    if (autopilot && state === STATE.LEVEL_UP && performance.now() >= UI.levelUpReadyAt) chooseCard(smartPick());
  }
  try { render(); } catch (err) { console.error(err); }
  workMs += (performance.now() - t0 - workMs) * 0.05;
  fxLevel = workMs > 13 ? 0.35 : workMs > 9 ? 0.7 : 1;
}

/** One fixed simulation step. Only ever called while state === PLAYING. */
function step(dt) {
  const g = G;
  if (g.hitStop > 0) { g.hitStop -= dt; return; }
  if (autopilot) botSteer();
  g.animT += dt;
  if (!g.ending) {
    g.time += dt;
    if (g.time >= CONFIG.RUN_DURATION) {
      g.time = CONFIG.RUN_DURATION;
      startEnding('victory', false);
    }
  }
  updatePlayer(dt);
  if (!g.ending) updateSpawner(dt);
  updateEnemies(dt);
  if (!g.ending && !g.player.dead) updateWeapons(dt);
  updateProjectiles(dt);
  updatePulses(dt);
  updateStrikes(dt);
  updateGems(dt);
  updatePickups(dt);
  updateParticles(dt);
  updateTexts(dt);
  updateBanners(dt);
  updateCamera(dt);
  compactEnemies();
  if (g.comboT > 0) { g.comboT -= dt; if (g.comboT <= 0) g.combo = 0; }
  g.killPulse = Math.max(0, g.killPulse - dt * 4);
  g.xpFlash = Math.max(0, g.xpFlash - dt * 3);
  g.hurtFlash = Math.max(0, g.hurtFlash - dt * 3);
  if (g.ending) {
    g.ending.t += dt;
    if (g.ending.t >= g.ending.dur) finishRun();
  } else if (g.pendingLevels > 0 && !g.player.dead) {
    openLevelUp();
  }
}

function startEnding(kind, bossDefeated) {
  if (G.ending) return; // victory/defeat can only be decided once
  G.ending = { kind, t: 0, dur: kind === 'defeat' ? 2.0 : 2.4, bossDefeated: !!bossDefeated };
  if (kind === 'victory') {
    // Clear the field with a celebratory poof (no kills or XP awarded).
    let n = 0;
    for (const e of G.enemies) {
      if (e.dead) continue;
      e.dead = true;
      if (n++ < 120) emit(PK.SMOKE, e.x, e.y - e.r, 0, -20, 0.8, e.r, '#f4efe2', 2, 0, e.r * 2);
    }
    for (const pr of projectiles) pr.on = false;
    G.magnetAll = 3;
    if (!bossDefeated) banner("TIME'S UP!", 'You survived all five minutes!', '#7cf0b0');
    sfx('victory');
  } else {
    banner('DOWN!', 'The swarm got you…', '#ff5d6c');
    sfx('defeat');
  }
}

function finishRun() {
  const victory = G.ending.kind === 'victory';
  state = victory ? STATE.VICTORY : STATE.DEFEAT;
  UI.showResults(victory, G.ending.bossDefeated);
}

function pauseGame() {
  if (state !== STATE.PLAYING) return;
  state = STATE.PAUSED;
  clearInput();
  UI.showPause();
}
function resumeGame() {
  if (state !== STATE.PAUSED) return;
  state = STATE.PLAYING;
  UI.show(null);
}
function togglePause() {
  if (state === STATE.PLAYING) pauseGame();
  else if (state === STATE.PAUSED) resumeGame();
}

// =====================================================================
// 17. RENDERING
// =====================================================================
const GROUND = {
  meadow: '#465f2e', meadowLight: '#527036', meadowDeep: '#2b3f1f',
  earth: '#7e6a4f', earthCenter: '#8a7658', earthEdge: '#6e5a41',
  stone: '#8f8674', stoneLight: '#b1a893', stoneDark: '#625a4c',
  grass: '#62803a', grassLight: '#83a24a', grassDark: '#47612a',
  tree: '#2f4a23', treeLight: '#4a6c33', treeDark: '#1e3117',
};

// ---------- Ground chunks: deterministic, cached, drawn once ----------
const chunkCache = new Map();
const featureCache = new Map();
const chunkSpare = [];
let chunkBuilds = 0, frameCounter = 0;

function clearChunkCache() {
  chunkCache.clear();
  chunkSpare.length = 0;
}

function chunkFeatures(cx, cy) {
  const key = cx * 100003 + cy;
  let list = featureCache.get(key);
  if (list) return list;
  if (featureCache.size > 600) featureCache.clear();
  const rng = mulberry32(hashInt(cx, cy) ^ 0x5bd1e995);
  const S = CONFIG.CHUNK_SIZE, x0 = cx * S, y0 = cy * S;
  list = [];
  const add = (k, n, rMin, rMax) => {
    for (let i = 0; i < n; i++) list.push({ k, x: x0 + 20 + rng() * (S - 40), y: y0 + 20 + rng() * (S - 40), r: rMin + rng() * (rMax - rMin), v: rng(), a: rng() * TAU });
  };
  add('blob', 6, 70, 170);
  add('crack', 3, 18, 42);
  add('pebble', 34, 0.8, 2.2);
  add('rock', 9, 2.5, 8);
  add('grass', 9, 12, 30);
  add('flower', 6, 6, 12);
  add('tree', 5, 34, 66);
  featureCache.set(key, list);
  return list;
}

function getChunk(cx, cy) {
  const key = cx * 100003 + cy;
  const ch = chunkCache.get(key);
  if (ch) { ch.used = frameCounter; return ch.cv; }
  if (chunkBuilds >= CONFIG.CHUNK_BUILDS_PER_FRAME && chunkCache.size > 0) return null;
  chunkBuilds++;
  if (chunkCache.size >= CONFIG.CHUNK_CACHE_MAX) {
    let oldK = null, oldU = Infinity;
    for (const [k, v] of chunkCache) if (v.used < oldU) { oldU = v.used; oldK = k; }
    if (oldK !== null) { chunkSpare.push(chunkCache.get(oldK).cv); chunkCache.delete(oldK); }
  }
  const cv = chunkSpare.pop() || document.createElement('canvas');
  buildChunk(cv, cx, cy);
  chunkCache.set(key, { cv, used: frameCounter });
  return cv;
}

const CHUNK_PAD = 2;
function buildChunk(cv, cx, cy) {
  const S = CONFIG.CHUNK_SIZE, sc = view.chunkScale, size = S + CHUNK_PAD * 2;
  const px = Math.ceil(size * sc);
  cv.width = px; cv.height = px;
  const c = cv.getContext('2d');
  const x0 = cx * S - CHUNK_PAD, y0 = cy * S - CHUNK_PAD;
  c.setTransform(sc, 0, 0, sc, -x0 * sc, -y0 * sc);
  paintGround(c, x0, y0, size, cx, cy);
}

function paintGround(c, x0, y0, size, cx, cy) {
  const R = CONFIG.ARENA_RADIUS, x1 = x0 + size, y1 = y0 + size;
  c.lineCap = 'round'; c.lineJoin = 'round';

  // Meadow beyond the arena, darkening toward the forest.
  const mg = c.createRadialGradient(0, 0, R, 0, 0, R + 750);
  mg.addColorStop(0, GROUND.meadowLight); mg.addColorStop(0.3, GROUND.meadow); mg.addColorStop(1, GROUND.meadowDeep);
  c.fillStyle = mg; c.fillRect(x0, y0, size, size);

  // Compacted-earth arena floor.
  const nearest = Math.hypot(clamp(0, x0, x1), clamp(0, y0, y1));
  if (nearest < R + 40) {
    const eg = c.createRadialGradient(0, 0, 0, 0, 0, R);
    eg.addColorStop(0, GROUND.earthCenter); eg.addColorStop(0.75, GROUND.earth); eg.addColorStop(1, GROUND.earthEdge);
    c.beginPath(); c.arc(0, 0, R, 0, TAU); c.fillStyle = eg; c.fill();
  }

  // Seamless world-anchored grain so the ground reads as earth and grass, not flat paint.
  c.save();
  c.globalCompositeOperation = 'overlay';
  for (const [alpha, rot, scale] of [[0.26, 0, 1], [0.22, 0.52, 2.3]]) {
    const pat = c.createPattern(SPRITES.grain, 'repeat');
    if (rot && pat.setTransform && typeof DOMMatrix !== 'undefined') pat.setTransform(new DOMMatrix().rotate(rot * 180 / Math.PI).scale(scale));
    else if (rot) continue;
    c.globalAlpha = alpha;
    c.fillStyle = pat;
    c.fillRect(x0, y0, size, size);
  }
  c.restore();

  const feats = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) feats.push(chunkFeatures(cx + dx, cy + dy));
  const each = (kind, fn) => {
    for (const list of feats) for (const f of list) {
      if (f.k !== kind) continue;
      const m = f.r + 80;
      if (f.x < x0 - m || f.x > x1 + m || f.y < y0 - m || f.y > y1 + m) continue;
      fn(f, Math.hypot(f.x, f.y));
    }
  };

  // Soft colour variation.
  each('blob', (f, d) => {
    let col;
    if (d < R - 60) col = f.v < 0.5 ? 'rgba(60,44,28,0.20)' : 'rgba(176,150,108,0.17)';
    else if (d > R + 60) col = f.v < 0.5 ? 'rgba(24,40,16,0.30)' : 'rgba(120,150,70,0.18)';
    else return;
    const g = c.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r);
    g.addColorStop(0, col); g.addColorStop(1, col.replace(/[\d.]+\)$/, '0)'));
    c.fillStyle = g; c.fillRect(f.x - f.r, f.y - f.r, f.r * 2, f.r * 2);
  });

  // Worn ring path just inside the boundary, and grass fringe outside it.
  if (nearest < R + 60) {
    c.beginPath(); c.arc(0, 0, R - 14, 0, TAU); c.strokeStyle = 'rgba(52,38,24,0.30)'; c.lineWidth = 30; c.stroke();
    c.beginPath(); c.arc(0, 0, R + 18, 0, TAU); c.strokeStyle = 'rgba(70,98,40,0.6)'; c.lineWidth = 26; c.stroke();
  }

  // Central stone plaza with a medical-cross mosaic.
  if (nearest < CONFIG.PLAZA_RADIUS + 20) drawPlaza(c);

  const onPlaza = (d) => d < CONFIG.PLAZA_RADIUS + 12;
  each('crack', (f, d) => {
    if (d > R - 50 || onPlaza(d)) return;
    c.beginPath();
    let x = f.x, y = f.y, a = f.a;
    c.moveTo(x, y);
    for (let i = 0; i < 4; i++) { a += (f.v - 0.5) * 1.4 + (i % 2 ? 0.5 : -0.5); x += Math.cos(a) * f.r * 0.3; y += Math.sin(a) * f.r * 0.3; c.lineTo(x, y); }
    c.strokeStyle = 'rgba(50,36,22,0.45)'; c.lineWidth = 1.4; c.stroke();
  });
  each('pebble', (f, d) => {
    if (d > R - 20 || onPlaza(d)) return;
    c.beginPath(); c.arc(f.x, f.y, f.r, 0, TAU);
    c.fillStyle = f.v < 0.5 ? 'rgba(160,145,118,0.7)' : 'rgba(70,56,40,0.5)'; c.fill();
  });
  each('rock', (f, d) => { if (!onPlaza(d) && Math.abs(d - R) > 30) drawStone(c, f.x, f.y, f.r, f.a); });
  each('grass', (f, d) => {
    if (onPlaza(d)) return;
    const inside = d < R - 30;
    if (inside && f.v > 0.5) return; // sparse inside the arena
    drawTuft(c, f.x, f.y, f.r * (inside ? 0.8 : 1.15), f.v, inside ? 7 : 12, !inside);
  });
  each('flower', (f, d) => {
    if (d < R + 30 && f.v > 0.3) return;
    if (onPlaza(d)) return;
    if (f.v > 0.72) { drawMushrooms(c, f.x, f.y, f.v); return; }
    const col = ['#f2d16b', '#f0a3b5', '#ffffff', '#b9a2ff'][(f.v * 4) | 0];
    for (let i = 0; i < 4; i++) {
      const a = f.a + i * 1.7, rr = f.r * 0.6;
      const x = f.x + Math.cos(a) * rr, y = f.y + Math.sin(a) * rr * 0.6;
      c.beginPath(); c.arc(x, y, 2.2, 0, TAU); c.fillStyle = col; c.fill();
      c.beginPath(); c.arc(x, y, 0.9, 0, TAU); c.fillStyle = '#e9a23b'; c.fill();
    }
  });

  for (const l of LANTERNS) {
    if (l.x > x0 - 40 && l.x < x1 + 40 && l.y > y0 - 60 && l.y < y1 + 20) drawLantern(c, l.x, l.y);
  }

  // Ring of boundary stones.
  if (nearest < R + 80) {
    const rr = R + 14, N = Math.floor(TAU * rr / 30);
    for (let i = 0; i < N; i++) {
      const a = (i / N) * TAU, h = hashInt(i, 7777);
      const jr = rr + (((h & 255) / 255) - 0.5) * 6;
      const sx = Math.cos(a) * jr, sy = Math.sin(a) * jr;
      if (sx < x0 - 30 || sx > x1 + 30 || sy < y0 - 30 || sy > y1 + 30) continue;
      drawStone(c, sx, sy, 9 + (((h >>> 8) & 255) / 255) * 7, a + ((h >>> 16) & 255) / 80);
    }
  }

  // Forest canopy: denser the farther out you look.
  each('tree', (f, d) => {
    if (d < R + 110) return;
    const density = clamp((d - R - 110) / 380, 0.15, 1);
    if (f.v > density) return;
    drawTree(c, f.x, f.y, f.r, f.v);
  });
  each('grass', (f, d) => {
    if (d < R + 40 || d > R + 160 || f.v > 0.6) return;
    drawTree(c, f.x, f.y, 12 + f.r * 0.6, f.v * 7.3);
  });
}

function drawPlaza(c) {
  const PR = CONFIG.PLAZA_RADIUS;
  c.beginPath(); c.arc(0, 0, PR + 6, 0, TAU); c.fillStyle = '#5f5546'; c.fill();
  const rings = [72, 140, 214, PR], segs = [10, 18, 26];
  for (let k = 0; k < 3; k++) {
    const r0 = rings[k] + 2, r1 = rings[k + 1] - 2, n = segs[k];
    for (let s = 0; s < n; s++) {
      const a0 = (s / n) * TAU + k * 0.2, a1 = ((s + 1) / n) * TAU + k * 0.2, gap = 2.2 / r1;
      const h = hashInt(k * 97 + s, 31) & 255;
      c.beginPath();
      c.arc(0, 0, r1, a0 + gap, a1 - gap);
      c.arc(0, 0, r0, a1 - gap * r1 / r0, a0 + gap * r1 / r0, true);
      c.closePath();
      c.fillStyle = h < 85 ? '#968b77' : h < 170 ? '#8b806c' : '#a0957f';
      c.fill();
      if (h > 200) { c.fillStyle = 'rgba(60,70,40,0.25)'; c.fill(); }
    }
  }
  c.strokeStyle = 'rgba(255,248,230,0.12)'; c.lineWidth = 2;
  for (const r of rings) { c.beginPath(); c.arc(-1, -1, r - 3, Math.PI * 1.05, Math.PI * 1.6); c.stroke(); }
  // Central emblem.
  const eg = c.createRadialGradient(-14, -14, 4, 0, 0, 72);
  eg.addColorStop(0, '#86a79d'); eg.addColorStop(1, '#5c7b72');
  c.beginPath(); c.arc(0, 0, 70, 0, TAU); c.fillStyle = eg; c.fill();
  c.lineWidth = 4; c.strokeStyle = '#4a5f58'; c.stroke();
  shurikenPath(c, 2, 3, 50, 14); c.fillStyle = 'rgba(40,52,46,0.45)'; c.fill();
  shurikenPath(c, 0, 0, 50, 14); c.fillStyle = '#e4dcc8'; c.fill();
  c.strokeStyle = 'rgba(80,70,50,0.45)'; c.lineWidth = 2; c.stroke();
  c.beginPath(); c.arc(0, 0, 9, 0, TAU); c.fillStyle = '#5c7b72'; c.fill(); c.stroke();
  c.beginPath(); c.arc(0, 0, 60, 0, TAU); c.strokeStyle = 'rgba(228,220,200,0.35)'; c.lineWidth = 2; c.stroke();
  // Weathering: hairline cracks across a few tiles.
  const rng = mulberry32(99);
  c.strokeStyle = 'rgba(50,40,28,0.35)'; c.lineWidth = 1.2;
  for (let i = 0; i < 14; i++) {
    const a = rng() * TAU, r0 = 80 + rng() * (PR - 100);
    let x = Math.cos(a) * r0, y = Math.sin(a) * r0, d = rng() * TAU;
    c.beginPath(); c.moveTo(x, y);
    for (let k = 0; k < 3; k++) { d += (rng() - 0.5) * 1.6; x += Math.cos(d) * 9; y += Math.sin(d) * 9; c.lineTo(x, y); }
    c.stroke();
  }
}

// Four stone lanterns around the plaza; their flames glow at runtime.
const LANTERNS = [0, 1, 2, 3].map((i) => {
  const a = Math.PI / 4 + i * Math.PI / 2, r = CONFIG.PLAZA_RADIUS + 42;
  return { x: Math.cos(a) * r, y: Math.sin(a) * r };
});

function drawLantern(c, x, y) {
  c.save();
  c.translate(x, y);
  c.beginPath(); c.ellipse(6, 3, 18, 7, 0, 0, TAU); c.fillStyle = 'rgba(24,14,4,0.35)'; c.fill();
  const g = c.createLinearGradient(-14, 0, 14, 0);
  g.addColorStop(0, '#b8ad97'); g.addColorStop(0.5, '#958a76'); g.addColorStop(1, '#6a604f');
  const box = (x0, y0, w, h, r) => { roundRectPath(c, x0, y0, w, h, r); c.fillStyle = g; c.fill(); c.lineWidth = 1.6; c.strokeStyle = '#3d362c'; c.stroke(); };
  box(-12, -7, 24, 7, 2);
  box(-4.5, -26, 9, 20, 1.5);
  box(-11, -30, 22, 5, 1.5);
  box(-7.5, -43, 15, 14, 1.5);
  roundRectPath(c, -4.2, -40, 8.4, 8, 1); c.fillStyle = '#ffcf6b'; c.fill();
  c.fillStyle = '#ffeeb0'; c.fillRect(-1.6, -38.5, 3.2, 5);
  c.beginPath(); c.moveTo(-16, -42); c.quadraticCurveTo(0, -48, 16, -42); c.lineTo(6, -51); c.lineTo(-6, -51); c.closePath();
  c.fillStyle = g; c.fill(); c.lineWidth = 1.6; c.strokeStyle = '#3d362c'; c.stroke();
  c.beginPath(); c.arc(0, -53.5, 3, 0, TAU); c.fillStyle = '#958a76'; c.fill(); c.stroke();
  c.fillStyle = 'rgba(70,100,45,0.55)';
  c.beginPath(); c.ellipse(-6, -45, 5, 2, 0.1, 0, TAU); c.ellipse(-8, -2, 4, 1.8, 0, 0, TAU); c.fill();
  c.restore();
}

function drawMushrooms(c, x, y, v) {
  const rng = mulberry32((v * 1e9) >>> 0);
  for (let i = 0; i < 3; i++) {
    const mx = x + (rng() - 0.5) * 16, my = y + (rng() - 0.5) * 8, s = 2.6 + rng() * 2.4;
    c.beginPath(); c.ellipse(mx + 1, my + 1, s, s * 0.4, 0, 0, TAU); c.fillStyle = 'rgba(20,12,4,0.3)'; c.fill();
    c.fillStyle = '#efe6d2'; c.fillRect(mx - s * 0.3, my - s * 1.4, s * 0.6, s * 1.4);
    c.beginPath(); c.ellipse(mx, my - s * 1.4, s, s * 0.7, 0, Math.PI, 0); c.closePath();
    c.fillStyle = v > 0.9 ? '#d9a441' : '#d8443c'; c.fill(); c.lineWidth = 0.8; c.strokeStyle = '#4a1a14'; c.stroke();
    c.fillStyle = '#fff6e8';
    c.beginPath(); c.arc(mx - s * 0.35, my - s * 1.75, s * 0.16, 0, TAU); c.arc(mx + s * 0.3, my - s * 1.6, s * 0.12, 0, TAU); c.fill();
  }
}

function drawStone(c, x, y, r, a) {
  c.save();
  c.translate(x, y); c.rotate(a);
  c.beginPath(); c.ellipse(r * 0.35, r * 0.4, r * 1.05, r * 0.75, 0, 0, TAU); c.fillStyle = 'rgba(30,22,12,0.35)'; c.fill();
  c.beginPath(); c.ellipse(0, 0, r, r * 0.72, 0, 0, TAU); c.fillStyle = GROUND.stoneDark; c.fill();
  c.beginPath(); c.ellipse(-r * 0.08, -r * 0.1, r * 0.88, r * 0.58, 0, 0, TAU); c.fillStyle = GROUND.stone; c.fill();
  c.beginPath(); c.ellipse(-r * 0.3, -r * 0.28, r * 0.42, r * 0.24, -0.3, 0, TAU); c.fillStyle = GROUND.stoneLight; c.fill();
  if (r > 6 && ((r * 97) | 0) % 3 === 0) {
    c.beginPath(); c.ellipse(r * 0.15, -r * 0.35, r * 0.5, r * 0.22, 0.2, 0, TAU); c.fillStyle = 'rgba(92,128,52,0.75)'; c.fill();
  }
  c.restore();
}

function drawTuft(c, x, y, r, v, n, lush) {
  c.beginPath(); c.ellipse(x, y, r, r * 0.5, 0, 0, TAU);
  c.fillStyle = lush ? 'rgba(52,80,30,0.45)' : 'rgba(84,108,50,0.32)'; c.fill();
  const rng = mulberry32((v * 4294967295) >>> 0);
  const cols = [GROUND.grass, GROUND.grassLight, GROUND.grassDark];
  c.lineWidth = 1.7;
  for (let i = 0; i < n; i++) {
    const bx = x + (rng() - 0.5) * r * 1.5, by = y + (rng() - 0.5) * r * 0.55;
    const h = 5 + rng() * 9, lean = (rng() - 0.5) * 7;
    c.beginPath(); c.moveTo(bx, by); c.quadraticCurveTo(bx + lean * 0.2, by - h * 0.6, bx + lean, by - h);
    c.strokeStyle = cols[(rng() * 3) | 0]; c.stroke();
  }
}

function drawTree(c, x, y, r, v) {
  const rng = mulberry32((v * 2654435761) >>> 0);
  c.beginPath(); c.ellipse(x + r * 0.28, y + r * 0.34, r * 1.08, r * 0.92, 0, 0, TAU); c.fillStyle = 'rgba(8,16,6,0.38)'; c.fill();
  const blobs = [];
  for (let i = 0; i < 6; i++) {
    const a = rng() * TAU, d = r * 0.42 * rng();
    blobs.push([x + Math.cos(a) * d, y + Math.sin(a) * d, r * (0.45 + rng() * 0.3)]);
  }
  const bloom = v % 1 < 0.12;
  const dark = bloom ? '#6b3a4f' : GROUND.treeDark, mid = bloom ? '#c76f8f' : GROUND.tree, light = bloom ? '#f2a9c2' : GROUND.treeLight;
  for (const [bx, by, br] of blobs) { c.beginPath(); c.arc(bx + 2, by + 3, br, 0, TAU); c.fillStyle = dark; c.fill(); }
  for (const [bx, by, br] of blobs) { c.beginPath(); c.arc(bx, by, br * 0.94, 0, TAU); c.fillStyle = mid; c.fill(); }
  for (const [bx, by, br] of blobs) { c.beginPath(); c.arc(bx - br * 0.25, by - br * 0.28, br * 0.5, 0, TAU); c.fillStyle = light; c.fill(); }
  c.fillStyle = bloom ? 'rgba(255,230,240,0.8)' : 'rgba(150,190,90,0.5)';
  for (let i = 0; i < 14; i++) {
    const a = rng() * TAU, d = r * 0.75 * Math.sqrt(rng());
    c.beginPath(); c.arc(x + Math.cos(a) * d - r * 0.1, y + Math.sin(a) * d - r * 0.15, 1.2 + rng() * 1.6, 0, TAU); c.fill();
  }
  c.beginPath(); c.arc(x - r * 0.05, y - r * 0.05, r * 0.92, Math.PI * 1.05, Math.PI * 1.55);
  c.strokeStyle = bloom ? 'rgba(255,220,235,0.5)' : 'rgba(190,220,120,0.35)'; c.lineWidth = 3; c.stroke();
}

function drawGround(c, L, T, R, B) {
  const S = CONFIG.CHUNK_SIZE;
  chunkBuilds = 0;
  frameCounter++;
  const cx0 = Math.floor(L / S), cx1 = Math.floor(R / S), cy0 = Math.floor(T / S), cy1 = Math.floor(B / S);
  for (let cy = cy0; cy <= cy1; cy++) {
    for (let cx = cx0; cx <= cx1; cx++) {
      const cv = getChunk(cx, cy);
      if (cv) c.drawImage(cv, cx * S - CHUNK_PAD, cy * S - CHUNK_PAD, S + CHUNK_PAD * 2, S + CHUNK_PAD * 2);
      else {
        const d = Math.hypot(cx * S + S / 2, cy * S + S / 2);
        c.fillStyle = d < CONFIG.ARENA_RADIUS ? GROUND.earth : GROUND.meadow;
        c.fillRect(cx * S, cy * S, S, S);
      }
    }
  }
}

// ---------- Sprites (pre-rendered once) ----------
const SPRITES = {};
function makeCanvas(size) { const cv = document.createElement('canvas'); cv.width = cv.height = size; return cv; }

function buildGrain(size) {
  const cv = makeCanvas(size), c = cv.getContext('2d'), img = c.createImageData(size, size);
  const rng = mulberry32(1234);
  const lattice = (n) => { const a = new Float32Array(n * n); for (let i = 0; i < a.length; i++) a[i] = rng(); return a; };
  const octaves = [[8, lattice(8), 0.5], [32, lattice(32), 0.3]];
  const smooth = (t) => t * t * (3 - 2 * t);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let v = 0;
      for (const [n, L, w] of octaves) {
        const fx = x / size * n, fy = y / size * n, ix = Math.floor(fx), iy = Math.floor(fy);
        const tx = smooth(fx - ix), ty = smooth(fy - iy), x1 = (ix + 1) % n, y1 = (iy + 1) % n;
        const a = L[iy * n + ix], b = L[iy * n + x1], cc = L[y1 * n + ix], d = L[y1 * n + x1];
        v += w * ((a + (b - a) * tx) + ((cc + (d - cc) * tx) - (a + (b - a) * tx)) * ty);
      }
      v += 0.2 * rng();
      const g = clamp(Math.round(128 + (v - 0.5) * 120), 0, 255), i = (y * size + x) * 4;
      img.data[i] = g; img.data[i + 1] = g; img.data[i + 2] = g; img.data[i + 3] = 255;
    }
  }
  c.putImageData(img, 0, 0);
  return cv;
}

function buildSprites() {
  SPRITES.grain = buildGrain(256);
  const gemDefs = [['#59b4ff', '#bfe4ff', '#2a5f9e', 6.5], ['#6dff9a', '#d4ffe0', '#1f8a48', 8], ['#c77dff', '#f0d9ff', '#6a2aa8', 10]];
  SPRITES.gems = gemDefs.map(([col, light, dark, sz]) => {
    const S = 3, cv = makeCanvas(40 * S), c = cv.getContext('2d');
    c.scale(S, S); c.translate(20, 20);
    const g = c.createRadialGradient(0, 0, 0, 0, 0, 19);
    g.addColorStop(0, hexToRgba(col, 0.55)); g.addColorStop(1, hexToRgba(col, 0));
    c.fillStyle = g; c.fillRect(-20, -20, 40, 40);
    const w = sz * 0.66, h = sz;
    c.beginPath(); c.moveTo(0, -h); c.lineTo(w, -h * 0.15); c.lineTo(0, h); c.lineTo(-w, -h * 0.15); c.closePath();
    c.fillStyle = col; c.fill(); c.strokeStyle = dark; c.lineWidth = 1.2; c.stroke();
    c.beginPath(); c.moveTo(0, -h); c.lineTo(-w, -h * 0.15); c.lineTo(0, h * 0.12); c.closePath(); c.fillStyle = light; c.globalAlpha = 0.85; c.fill();
    c.beginPath(); c.moveTo(0, h * 0.12); c.lineTo(w, -h * 0.15); c.lineTo(0, h); c.closePath(); c.fillStyle = dark; c.globalAlpha = 0.45; c.fill();
    c.globalAlpha = 1;
    c.beginPath(); c.ellipse(-w * 0.32, -h * 0.42, w * 0.18, h * 0.12, -0.6, 0, TAU); c.fillStyle = '#ffffff'; c.fill();
    return cv;
  });
  const glow = (col, size) => {
    const cv = makeCanvas(size), c = cv.getContext('2d'), r = size / 2;
    const g = c.createRadialGradient(r, r, 0, r, r, r);
    g.addColorStop(0, hexToRgba(col, 0.9)); g.addColorStop(0.35, hexToRgba(col, 0.35)); g.addColorStop(1, hexToRgba(col, 0));
    c.fillStyle = g; c.fillRect(0, 0, size, size);
    return cv;
  };
  SPRITES.glowGold = glow('#ffd166', 128);
  SPRITES.glowMint = glow('#8ff5d8', 128);
  SPRITES.glowSteel = glow('#8fd4ff', 128);
  SPRITES.glowWarm = glow('#ffb35c', 128);
  SPRITES.glowFirefly = glow('#e8ff9a', 32);
  SPRITES.glowPink = glow('#ff6fb1', 64);
  SPRITES.glowViolet = glow('#b06bff', 64);
  SPRITES.glowRed = glow('#ff3b3b', 128);
  SPRITES.glowWhite = glow('#fff6dc', 128);
  // Medkit pickup.
  {
    const S = 3, cv = makeCanvas(48 * S), c = cv.getContext('2d');
    c.scale(S, S); c.translate(24, 24);
    c.drawImage(SPRITES.glowMint, -24, -24, 48, 48);
    roundRectPath(c, -11, -8, 22, 17, 4); c.fillStyle = '#f6f3ea'; c.fill(); c.strokeStyle = '#3a3f3a'; c.lineWidth = 1.6; c.stroke();
    c.fillStyle = '#e8384f'; c.fillRect(-2.5, -5, 5, 11); c.fillRect(-6, -1.5, 12, 4);
    c.fillStyle = '#3a3f3a'; c.fillRect(-4, -11, 8, 3);
    SPRITES.medkit = cv;
  }
  // Magnet pickup.
  {
    const S = 3, cv = makeCanvas(48 * S), c = cv.getContext('2d');
    c.scale(S, S); c.translate(24, 24);
    c.drawImage(SPRITES.glowWhite, -22, -22, 44, 44);
    c.beginPath(); c.arc(0, -1, 8, Math.PI, 0, true); c.strokeStyle = '#e8384f'; c.lineWidth = 6; c.stroke();
    c.fillStyle = '#dfe7ec'; c.fillRect(-11, -6, 6, 5); c.fillRect(5, -6, 6, 5);
    SPRITES.magnet = cv;
  }
}

// ---------- Shared weapon shapes ----------
function drawSyringeShape(c, k, fluid) {
  c.save();
  c.scale(k, k);
  c.fillStyle = '#5b6670'; c.fillRect(-15, -1.1, 6, 2.2);
  c.fillStyle = '#3e4750'; c.fillRect(-16.5, -4, 2, 8);
  roundRectPath(c, -9.5, -3.2, 15, 6.4, 1.6);
  c.fillStyle = '#eaf4fb'; c.fill();
  c.fillStyle = fluid; c.fillRect(-4.5, -2.2, 9.5, 4.4);
  c.strokeStyle = '#2c3a44'; c.lineWidth = 1; roundRectPath(c, -9.5, -3.2, 15, 6.4, 1.6); c.stroke();
  c.fillStyle = '#3e4750'; c.fillRect(-10.6, -5, 1.8, 10);
  c.strokeStyle = 'rgba(40,60,70,0.55)'; c.lineWidth = 0.7;
  c.beginPath(); for (const x of [-6, -3, 0, 3]) { c.moveTo(x, -3.2); c.lineTo(x, -1.5); } c.stroke();
  c.fillStyle = '#9aa7b0'; c.fillRect(5.5, -1.6, 2.6, 3.2);
  c.strokeStyle = '#e6eef2'; c.lineWidth = 0.9; c.beginPath(); c.moveTo(8, 0); c.lineTo(16, 0); c.stroke();
  c.fillStyle = 'rgba(255,255,255,0.85)'; c.fillRect(-8.6, -2.6, 13, 0.9);
  c.restore();
}

function drawMedallionShape(c, r, evo) {
  const g = c.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
  g.addColorStop(0, '#fff6cf'); g.addColorStop(0.5, evo ? '#ffe28a' : '#ffcf5a'); g.addColorStop(1, '#a8721a');
  c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fillStyle = g; c.fill();
  c.lineWidth = Math.max(1, r * 0.12); c.strokeStyle = '#6b4610'; c.stroke();
  c.beginPath(); c.arc(0, 0, r * 0.68, 0, TAU); c.fillStyle = evo ? '#f4fffb' : '#1d7a82'; c.fill();
  c.lineWidth = Math.max(0.8, r * 0.07); c.strokeStyle = 'rgba(60,40,10,0.5)'; c.stroke();
  shurikenPath(c, 0, 0, r * 0.52, r * 0.16);
  c.fillStyle = evo ? '#e8384f' : '#ffffff'; c.fill();
  c.beginPath(); c.arc(-r * 0.32, -r * 0.4, r * 0.22, 0, TAU); c.fillStyle = 'rgba(255,255,255,0.55)'; c.fill();
}

// ---------- Hero: Navos Ninja (khaki scrubs, katana) ----------
const HERO_PAL = {
  skin: '#b8774a', skinLight: '#dea374', skinDark: '#8a522c',
  scrub: '#c9b48b', scrubLight: '#e6d7b0', scrubDark: '#9f8961', scrubDeep: '#776445',
  pants: '#bea980', pantsDark: '#927e57',
  hair: '#19130f', hairLight: '#54402f', shoe: '#221e1b', sole: '#d9d2c4',
  outline: '#261c15', band: '#17808a', bandLight: '#56d6dc',
  eye: '#1a120d', mouth: '#5a2a1c', rim: 'rgba(255,236,200,0.55)',
  steel: '#eef4f8', steelDark: '#8798a6', tsuka: '#1d1a1f', wrap: '#6a5a86', tsuba: '#d6a03c',
  saya: '#2b1b14', sayaLight: '#6b4632',
};
const HERO_FLASH = {};
for (const k in HERO_PAL) HERO_FLASH[k] = '#ffffff';
HERO_FLASH.outline = '#ffcfcf'; HERO_FLASH.eye = '#ffb0b0'; HERO_FLASH.mouth = '#ffb0b0'; HERO_FLASH.rim = 'rgba(255,255,255,0)';

const HERO_SCALE = 1.08;

function limb(c, x0, y0, x1, y1, w, color, outline) {
  c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1);
  c.strokeStyle = outline; c.lineWidth = w + 2.8; c.stroke();
  c.strokeStyle = color; c.lineWidth = w; c.stroke();
}

function heroArm(c, P, sx, sy, hx, hy, front) {
  limb(c, sx, sy, hx, hy, 4.6, front ? P.skin : P.skinDark, P.outline);
  const mx = sx + (hx - sx) * 0.45, my = sy + (hy - sy) * 0.45;
  limb(c, sx, sy, mx, my, 7, front ? P.scrub : P.scrubDark, P.outline);
  c.beginPath(); c.arc(hx, hy, 3.1, 0, TAU); c.fillStyle = front ? P.skin : P.skinDark; c.fill();
  c.lineWidth = 1.5; c.strokeStyle = P.outline; c.stroke();
}

function heroShoe(c, P, x, y) {
  c.beginPath(); c.ellipse(x + 1.6, y, 5.2, 3.2, 0, 0, TAU);
  c.fillStyle = P.shoe; c.fill(); c.lineWidth = 1.4; c.strokeStyle = P.outline; c.stroke();
  c.beginPath(); c.moveTo(x - 2.8, y + 2); c.lineTo(x + 6, y + 2); c.strokeStyle = P.sole; c.lineWidth = 1; c.stroke();
}

/** A katana held at (hx, hy) pointing along angle a (local space). */
function drawKatana(c, P, hx, hy, a, len, evo, t, flash) {
  c.save();
  c.translate(hx, hy);
  c.rotate(a);
  c.lineCap = 'round';
  if (evo && !flash) {
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha = 0.55 + Math.sin(t * 9) * 0.15;
    c.drawImage(SPRITES.glowGold, len * 0.15, -9, len * 0.95, 18);
    c.restore();
  }
  // Grip with cord wrap, then the guard.
  c.beginPath(); c.moveTo(-9.5, 0); c.lineTo(1, 0);
  c.strokeStyle = P.outline; c.lineWidth = 4.6; c.stroke();
  c.strokeStyle = P.tsuka; c.lineWidth = 3; c.stroke();
  c.fillStyle = P.wrap;
  for (let i = -8.2; i < -0.5; i += 2.3) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i + 0.9, -1.3); c.lineTo(i + 1.8, 0); c.lineTo(i + 0.9, 1.3); c.closePath(); c.fill(); }
  c.beginPath(); c.ellipse(1.7, 0, 1.4, 3.6, 0, 0, TAU);
  c.fillStyle = P.tsuba; c.fill(); c.lineWidth = 1; c.strokeStyle = P.outline; c.stroke();
  // Gently curved blade: spine on top, cutting edge underneath.
  c.beginPath();
  c.moveTo(2.8, -1.8);
  c.quadraticCurveTo(len * 0.5, -3.3, len - 3.6, -3.1);
  c.lineTo(len, -1.9);
  c.quadraticCurveTo(len * 0.55, 1.1, 2.8, 1.7);
  c.closePath();
  if (flash) c.fillStyle = P.steel;
  else {
    const bg = c.createLinearGradient(0, -3.1, 0, 1.7);
    bg.addColorStop(0, P.steelDark); bg.addColorStop(0.55, P.steel); bg.addColorStop(1, '#ffffff');
    c.fillStyle = bg;
  }
  c.fill(); c.lineWidth = 1; c.strokeStyle = P.outline; c.stroke();
  c.beginPath(); c.moveTo(4.5, 0.55); c.quadraticCurveTo(len * 0.55, 0.05, len - 2.4, -1.5);
  c.strokeStyle = evo ? '#ffe28a' : 'rgba(255,255,255,0.95)'; c.lineWidth = 0.8; c.stroke();
  // A glint that travels along the blade now and then.
  const u = (t * 0.55) % 1.8;
  if (u < 1 && !flash) star4(c, 5 + u * (len - 8), -0.6, 2.6 + Math.sin(u * Math.PI) * 1.6, '#ffffff');
  c.restore();
}

/**
 * Draws the hero with feet at (x, y). Pure function of `o`:
 * { t, move, phase, facing, back, flash, alpha, death, hurt, swing (world angle or null), evo }.
 */
function drawHero(c, x, y, o) {
  const P = o.flash ? HERO_FLASH : HERO_PAL;
  const mv = o.move, ph = o.phase, t = o.t;
  const sw = Math.sin(ph), cw = Math.cos(ph);
  const bob = Math.abs(cw) * 2.2 * mv;
  const breathe = Math.sin(t * 2.3) * 0.8 * (1 - mv);
  c.save();
  c.translate(x, y);
  c.scale(HERO_SCALE, HERO_SCALE);
  if (o.alpha < 1) c.globalAlpha *= o.alpha;
  if (o.death > 0) {
    const k = easeOutCubic(Math.min(1, o.death * 2.2));
    c.translate(0, -4 * k);
    c.rotate(-o.facing * k * 1.45);
  }
  c.scale(o.facing, 1);
  c.rotate(0.08 * mv - (o.hurt > 0 ? o.hurt * 1.1 : 0));
  c.lineCap = 'round'; c.lineJoin = 'round';

  const hipY = -24 - bob * 0.5;
  const shY = -45 - bob + breathe * 0.5;
  const headY = shY - 11 + breathe * 0.3;
  const lift = (v) => Math.max(0, v) * 4 * mv;
  const fAx = 3 + sw * 7 * mv, fAy = -2 - lift(cw);
  const fBx = -3 - sw * 7 * mv, fBy = -2 - lift(-cw);
  const swinging = o.swing !== null && o.swing !== undefined && !o.death;
  // World swing angle -> local angle (the x axis is mirrored when facing left).
  const swingA = swinging ? Math.atan2(Math.sin(o.swing), Math.cos(o.swing) * o.facing) : 0;

  // Scabbard slung across the back (drawn behind everything when facing the camera).
  const drawSaya = () => {
    c.beginPath(); c.moveTo(-12.5, hipY + 6); c.lineTo(10.5, shY - 9);
    c.strokeStyle = P.outline; c.lineWidth = 5.6; c.stroke();
    c.strokeStyle = P.saya; c.lineWidth = 3.4; c.stroke();
    c.beginPath(); c.moveTo(-9.5, hipY + 3.5); c.lineTo(8.5, shY - 7.2); c.strokeStyle = P.sayaLight; c.lineWidth = 0.9; c.stroke();
    c.beginPath(); c.arc(-12.5, hipY + 6, 2.2, 0, TAU); c.fillStyle = P.tsuba; c.fill();
  };
  if (!o.back) drawSaya();

  // Legs (khaki scrub trousers) and dark shoes.
  limb(c, -3, hipY, fBx, fBy, 7, P.pantsDark, P.outline);
  heroShoe(c, P, fBx, fBy);
  limb(c, 3, hipY, fAx, fAy, 7, P.pants, P.outline);
  heroShoe(c, P, fAx, fAy);
  c.beginPath(); c.moveTo(4.2, hipY + 2); c.lineTo(fAx + 1.2, fAy - 5); c.strokeStyle = 'rgba(255,245,220,0.35)'; c.lineWidth = 1.2; c.stroke();

  // Far arm, behind the torso.
  heroArm(c, P, -8.5, shY + 3, -10 + sw * 5 * mv, shY + 17, false);

  // Torso: plain khaki scrub top.
  c.beginPath();
  c.moveTo(-10, shY + 2);
  c.quadraticCurveTo(-11, shY - 1.5, -6, shY - 1.8);
  c.lineTo(6, shY - 1.8);
  c.quadraticCurveTo(11, shY - 1.5, 10.5, shY + 2);
  c.lineTo(11.6, hipY + 2.5);
  c.quadraticCurveTo(0, hipY + 5, -11.6, hipY + 2.5);
  c.closePath();
  if (o.flash) c.fillStyle = P.scrub;
  else {
    const tg = c.createLinearGradient(-9, shY, 9, hipY + 3);
    tg.addColorStop(0, P.scrubLight); tg.addColorStop(0.5, P.scrub); tg.addColorStop(1, P.scrubDark);
    c.fillStyle = tg;
  }
  c.fill();
  c.lineWidth = 2; c.strokeStyle = P.outline; c.stroke();
  // Form shadow down the far side, fold lines and hem.
  c.beginPath();
  c.moveTo(-10, shY + 2); c.quadraticCurveTo(-11.3, (shY + hipY) / 2, -11.4, hipY + 2.4);
  c.lineTo(-7.2, hipY + 3.6); c.quadraticCurveTo(-8, (shY + hipY) / 2, -6.5, shY + 0.5); c.closePath();
  c.fillStyle = 'rgba(80,60,38,0.26)'; c.fill();
  c.lineWidth = 1; c.strokeStyle = 'rgba(70,52,34,0.45)';
  c.beginPath();
  c.moveTo(-10.6, hipY - 1); c.quadraticCurveTo(0, hipY + 1.5, 10.6, hipY - 1);
  c.moveTo(-6, hipY - 7); c.quadraticCurveTo(-3, hipY - 4.5, -1, hipY - 6.2);
  c.moveTo(4, hipY - 9); c.quadraticCurveTo(6, hipY - 6, 8.2, hipY - 7);
  c.stroke();
  c.beginPath(); c.moveTo(6, shY - 1.2); c.quadraticCurveTo(10.2, shY - 0.6, 10.4, shY + 4);
  c.strokeStyle = P.rim; c.lineWidth = 1.4; c.stroke();

  if (!o.back) {
    // V-neck and chest pocket: just scrubs.
    c.beginPath(); c.moveTo(-3.8, shY - 1.2); c.lineTo(0.5, shY + 5.6); c.lineTo(4.8, shY - 1.2); c.closePath();
    c.fillStyle = P.skinDark; c.fill(); c.lineWidth = 1.2; c.strokeStyle = P.scrubDeep; c.stroke();
    c.lineWidth = 1.1; c.strokeStyle = P.scrubDeep; c.strokeRect(2.8, shY + 8.5, 5.4, 4.6);
  } else {
    c.beginPath(); c.moveTo(-6, shY - 0.6); c.quadraticCurveTo(0, shY + 1.6, 6, shY - 0.6);
    c.strokeStyle = P.scrubDeep; c.lineWidth = 1.2; c.stroke();
    drawSaya();
  }

  // Near arm with the katana: a ready stance, or extended through a swing.
  if (swinging) {
    const hx = 8.5 + Math.cos(swingA) * 13, hy = shY + 3 + Math.sin(swingA) * 13;
    heroArm(c, P, 8.5, shY + 3, hx, hy, true);
    drawKatana(c, P, hx, hy, swingA, 40, o.evo, t, o.flash);
  } else {
    const hx = 10 - sw * 5 * mv, hy = shY + 17;
    drawKatana(c, P, hx, hy, 0.78 + mv * 0.3 + breathe * 0.03, 32, o.evo, t, o.flash);
    heroArm(c, P, 8.5, shY + 3, hx, hy, true);
  }

  // Neck and headband tails (behind the head).
  c.fillStyle = P.skinDark; c.fillRect(-2.6, headY + 7, 5.2, 5);
  const wave = Math.sin(t * 10 + ph) * (1 + mv * 2);
  const tailX = o.back ? 0 : -9.5;
  for (let k = 0; k < 2; k++) {
    c.beginPath();
    c.moveTo(tailX, headY - 2.5);
    if (o.back) c.quadraticCurveTo(tailX - 2 + k * 4, headY + 4 + wave, tailX - 4 + k * 8, headY + 11 + wave * 0.6);
    else c.quadraticCurveTo(-15 - mv * 4, headY - 3 + wave * 0.5 + k * 3, -20 - mv * 7, headY + 1 + wave + k * 4);
    c.strokeStyle = P.outline; c.lineWidth = 4.6; c.stroke();
    c.strokeStyle = P.band; c.lineWidth = 2.8; c.stroke();
  }

  // Spiky crown of dark hair (behind the head outline).
  c.beginPath();
  c.moveTo(-8.5, headY - 6); c.lineTo(-13.2, headY - 11); c.lineTo(-6.2, headY - 11.2);
  c.lineTo(-6, headY - 16.6); c.lineTo(-0.6, headY - 13.2);
  c.lineTo(3.4, headY - 17.2); c.lineTo(5.6, headY - 12.4);
  c.lineTo(10.6, headY - 13.4); c.lineTo(9.4, headY - 7.5); c.closePath();
  c.fillStyle = P.hair; c.fill(); c.lineWidth = 1.6; c.strokeStyle = P.outline; c.stroke();

  // Head.
  c.beginPath(); c.ellipse(0.5, headY, 10, 10.5, 0, 0, TAU);
  if (o.flash) c.fillStyle = P.skin;
  else {
    const hg = c.createRadialGradient(-2.5, headY - 4, 1, 0.5, headY, 11);
    hg.addColorStop(0, P.skinLight); hg.addColorStop(0.6, P.skin); hg.addColorStop(1, P.skinDark);
    c.fillStyle = hg;
  }
  c.fill(); c.lineWidth = 2; c.strokeStyle = P.outline; c.stroke();

  if (!o.back) {
    // Ear.
    c.beginPath(); c.ellipse(-8.3, headY + 1.6, 2.3, 3.1, 0, 0, TAU); c.fillStyle = P.skinDark; c.fill(); c.lineWidth = 1.3; c.strokeStyle = P.outline; c.stroke();
    // Dark hair, swept toward the facing side.
    c.beginPath();
    c.moveTo(-9.8, headY + 3);
    c.bezierCurveTo(-12.2, headY - 9, -4, headY - 14.6, 3, headY - 12.6);
    c.bezierCurveTo(9.2, headY - 11.6, 12.2, headY - 6, 10.8, headY - 2);
    c.quadraticCurveTo(7, headY - 6.6, 2, headY - 6.3);
    c.quadraticCurveTo(-3, headY - 5.6, -5, headY - 2);
    c.quadraticCurveTo(-6.5, headY + 1.5, -9.8, headY + 3);
    c.closePath();
    c.fillStyle = P.hair; c.fill(); c.lineWidth = 1.6; c.strokeStyle = P.outline; c.stroke();
    c.beginPath(); c.moveTo(-5, headY - 9.6); c.quadraticCurveTo(0, headY - 12.4, 5, headY - 10.6);
    c.strokeStyle = P.hairLight; c.lineWidth = 1.6; c.stroke();
    // Headband.
    c.beginPath(); c.moveTo(-10.2, headY - 2.4); c.quadraticCurveTo(0, headY - 8.6, 10.7, headY - 3.9);
    c.strokeStyle = P.outline; c.lineWidth = 5; c.stroke();
    c.strokeStyle = P.band; c.lineWidth = 3.2; c.stroke();
    c.beginPath(); c.moveTo(-6, headY - 5.6); c.quadraticCurveTo(0, headY - 8.9, 6, headY - 6.4); c.strokeStyle = P.bandLight; c.lineWidth = 0.9; c.stroke();
    // Face: focused eyes, firm brows, small confident smile.
    const blink = (t % 4.3) < 0.12 ? 0.22 : 1;
    for (const ex of [2.7, 7.6]) {
      c.beginPath(); c.ellipse(ex, headY + 0.6, 1.45, 2.1 * blink, 0, 0, TAU); c.fillStyle = P.eye; c.fill();
      if (blink > 0.5) { c.beginPath(); c.arc(ex + 0.45, headY - 0.2, 0.6, 0, TAU); c.fillStyle = '#ffffff'; c.fill(); }
    }
    c.beginPath(); c.moveTo(0.6, headY - 2.9); c.lineTo(4.3, headY - 3.9); c.moveTo(6.2, headY - 4.0); c.lineTo(9.4, headY - 3.1);
    c.strokeStyle = P.hair; c.lineWidth = 1.7; c.stroke();
    c.beginPath(); c.moveTo(10, headY + 0.8); c.quadraticCurveTo(11.6, headY + 3.2, 9.6, headY + 3.6);
    c.strokeStyle = P.skinDark; c.lineWidth = 1.2; c.stroke();
    c.beginPath(); c.arc(5.6, headY + 4.4, 2.6, 0.3, Math.PI - 0.55); c.strokeStyle = P.mouth; c.lineWidth = 1.3; c.stroke();
    // Warm rim light on the lit side of the face.
    c.beginPath(); c.arc(0.5, headY, 9.1, -0.9, 0.35); c.strokeStyle = P.rim; c.lineWidth = 1.3; c.stroke();
  } else {
    // Back of the head: hair, band and knot.
    c.beginPath(); c.ellipse(0.5, headY - 0.6, 10.2, 10.1, 0, Math.PI * 0.92, Math.PI * 2.08);
    c.quadraticCurveTo(0.5, headY + 9, -9.6, headY + 2.5);
    c.closePath(); c.fillStyle = P.hair; c.fill(); c.lineWidth = 1.6; c.strokeStyle = P.outline; c.stroke();
    c.beginPath(); c.moveTo(-10, headY - 2.8); c.quadraticCurveTo(0.5, headY + 0.2, 11, headY - 2.8);
    c.strokeStyle = P.outline; c.lineWidth = 5; c.stroke(); c.strokeStyle = P.band; c.lineWidth = 3.2; c.stroke();
    c.beginPath(); c.arc(0.5, headY - 1.3, 2.3, 0, TAU); c.fillStyle = P.band; c.fill(); c.lineWidth = 1.2; c.strokeStyle = P.outline; c.stroke();
  }
  c.restore();
}

// ---------- Monsters ----------
const bodyGradCache = new Map();
function bodyGradient(c, type, r, by) {
  let g = bodyGradCache.get(type);
  if (!g) {
    const pal = ENEMY_ART[type].pal;
    g = c.createRadialGradient(-r * 0.38, by - r * 0.4, r * 0.08, 0, by, r * 1.25);
    g.addColorStop(0, pal.light); g.addColorStop(0.45, pal.body); g.addColorStop(1, pal.dark);
    bodyGradCache.set(type, g);
  }
  return g;
}

function drawMonsterLegs(c, e, r, pal, back, lod) {
  const xs = back ? [-0.66, 0.66] : [-0.32, 0.32];
  const offs = back ? [0, Math.PI] : [Math.PI * 0.5, Math.PI * 1.5];
  const hipY = back ? -r * 0.62 : -r * 0.5;
  const col = back ? pal.legDark : pal.leg, lw = r * 0.27;
  for (let i = 0; i < 2; i++) {
    const a = e.phase * 1.6 + offs[i];
    const fx = xs[i] * r + Math.cos(a) * r * 0.16;
    const fy = -Math.max(0, Math.sin(a)) * r * 0.22 + (back ? -r * 0.08 : 0);
    const hx = xs[i] * r * 0.85;
    c.beginPath(); c.moveTo(hx, hipY); c.lineTo(fx, fy);
    if (!lod) { c.strokeStyle = pal.outline; c.lineWidth = lw + 2.4; c.stroke(); }
    c.strokeStyle = col; c.lineWidth = lw; c.stroke();
    c.beginPath(); c.ellipse(fx + (xs[i] > 0 ? 1 : -1) * r * 0.05, fy, r * 0.19, r * 0.11, 0, 0, TAU);
    c.fillStyle = col; c.fill();
    if (!lod) { c.lineWidth = 1.5; c.strokeStyle = pal.outline; c.stroke(); }
  }
}

function drawPupil(c, x, y, er, lx, ly, wob) {
  const px = x + lx * er * 0.42 + Math.sin(wob) * er * 0.1, py = y + ly * er * 0.42 + Math.cos(wob * 1.3) * er * 0.1;
  c.beginPath(); c.arc(px, py, er * 0.46, 0, TAU); c.fillStyle = '#1b1220'; c.fill();
  c.beginPath(); c.arc(px - er * 0.15, py - er * 0.18, er * 0.15, 0, TAU); c.fillStyle = '#ffffff'; c.fill();
}

function drawMonsterEye(c, x, y, er, lx, ly, wob, pal, angry, dizzy, t, noPupil) {
  c.beginPath(); c.arc(x, y, er, 0, TAU);
  c.fillStyle = '#ffffff'; c.fill();
  c.lineWidth = Math.max(1.4, er * 0.16); c.strokeStyle = pal.outline; c.stroke();
  if (noPupil) { /* pupils are drawn live on top of cached sprites */ }
  else if (dizzy) {
    c.beginPath();
    for (let i = 0; i < 14; i++) { const a = i * 0.7 + t * 10, rr = er * 0.06 * i; const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr; if (i) c.lineTo(px, py); else c.moveTo(px, py); }
    c.strokeStyle = '#2a1a2a'; c.lineWidth = Math.max(1, er * 0.12); c.stroke();
  } else {
    drawPupil(c, x, y, er, lx, ly, wob);
  }
  if (angry) {
    c.beginPath(); c.moveTo(x - er * 1.05, y - er * (angry > 0 ? 1.25 : 0.85)); c.lineTo(x + er * 1.05, y - er * (angry > 0 ? 0.85 : 1.25));
    c.strokeStyle = pal.outline; c.lineWidth = er * 0.38; c.stroke();
  }
}

// Regular monsters are pre-rendered into a few leg-cycle frames (normal + hit flash)
// and drawn with drawImage; only the pupils are drawn live so eyes track the hero.
// Bosses (at most two on screen) are always drawn as full vector art.
const MONSTER_FRAMES = 8, MONSTER_SPRITE_RES = 2;
const monsterSprites = new Map();

function getMonsterSprite(type, flash, k) {
  const key = type + (flash ? '!' : '') + k;
  let s = monsterSprites.get(key);
  if (s) return s;
  const r = CONFIG.enemies[type].radius, x0 = -1.7 * r, y0 = -3.0 * r, w = 3.4 * r, h = 3.45 * r;
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(w * MONSTER_SPRITE_RES); cv.height = Math.ceil(h * MONSTER_SPRITE_RES);
  const c = cv.getContext('2d');
  c.scale(MONSTER_SPRITE_RES, MONSTER_SPRITE_RES);
  c.translate(-x0, -y0);
  const pose = { type, r, x: 0, y: 0, phase: (k / MONSTER_FRAMES) * TAU / 1.6, flash: flash ? 1 : 0, state: 'chase', seed: 0, boss: false, dirX: 0 };
  drawMonsterVector(c, pose, k * 0.12, false, 0, 0, true);
  s = { cv, x0, y0, w, h };
  monsterSprites.set(key, s);
  return s;
}

/** Draws a silly four-legged monster with feet at (e.x, e.y). Reads state only. */
function drawMonster(c, e, t, lod, lx, ly) {
  if (e.boss) { drawMonsterVector(c, e, t, lod, lx, ly, false); return; }
  const ph = ((e.phase * 1.6) % TAU + TAU) % TAU;
  const s = getMonsterSprite(e.type, e.flash > 0, Math.floor(ph / TAU * MONSTER_FRAMES) % MONSTER_FRAMES);
  const r = e.r, by = -r * 1.15, wob = t * 7 + e.seed;
  c.save();
  c.translate(e.x, e.y);
  if (e.state === 'windup') c.translate(Math.sin(t * 70 + e.seed) * r * 0.07, 0);
  const sq = e.flash > 0 ? -0.1 : Math.sin(e.phase * 2) * 0.07;
  c.scale(1 + sq, 1 - sq);
  if (e.state === 'charge' || e.state === 'dash') c.rotate(e.dirX * 0.12);
  c.drawImage(s.cv, s.x0, s.y0, s.w, s.h);
  drawPupil(c, -r * 0.38, by - r * 0.4, r * 0.31, lx, ly, wob);
  drawPupil(c, r * 0.4, by - r * 0.36, r * 0.25, lx, ly, wob + 2.1);
  c.restore();
}

function drawMonsterVector(c, e, t, lod, lx, ly, sprite) {
  const art = ENEMY_ART[e.type], flash = e.flash > 0, pal = flash ? FLASH_PAL : art.pal, r = e.r;
  c.save();
  c.translate(e.x, e.y);
  if (e.state === 'windup') c.translate(Math.sin(t * 70 + e.seed) * r * 0.07, 0);
  let sq = Math.sin(e.phase * 2) * 0.07;
  if (flash) sq = -0.1;
  if (e.state === 'windup' && e.boss) sq = 0.08 + Math.sin(t * 30) * 0.03;
  if (sprite) sq = 0;
  c.scale(1 + sq, 1 - sq);
  if (e.state === 'charge' || e.state === 'dash') c.rotate(e.dirX * 0.12);
  c.lineCap = 'round'; c.lineJoin = 'round';
  const by = -r * 1.15, lw = Math.max(1.8, r * 0.1);
  const isBoss = art.extra === 'boss';

  drawMonsterLegs(c, e, r, pal, true, lod);

  // Back spikes / crest (behind the body).
  if (art.extra === 'crest' || isBoss) {
    const n = isBoss ? 5 : 3;
    for (let i = 0; i < n; i++) {
      const a = Math.PI * (1.15 + (i / (n - 1)) * 0.7);
      const bx = Math.cos(a) * r * 0.85, byy = by + Math.sin(a) * r * 0.75;
      const tx = Math.cos(a) * r * 1.35, ty = by + Math.sin(a) * r * 1.25;
      c.beginPath(); c.moveTo(bx - r * 0.16, byy); c.lineTo(tx, ty); c.lineTo(bx + r * 0.16, byy); c.closePath();
      c.fillStyle = isBoss ? pal.dark : pal.accent; c.fill(); c.lineWidth = lw * 0.8; c.strokeStyle = pal.outline; c.stroke();
    }
  }

  // Body.
  c.beginPath(); c.ellipse(0, by, r * 1.08, r * 0.88, 0, 0, TAU);
  c.fillStyle = flash ? pal.body : bodyGradient(c, e.type, r, by);
  c.fill();
  c.lineWidth = lw; c.strokeStyle = pal.outline; c.stroke();
  if (!lod) {
    c.beginPath(); c.ellipse(0, by, r * 0.86, r * 0.68, 0, Math.PI * 1.1, Math.PI * 1.5);
    c.strokeStyle = pal.light; c.globalAlpha = 0.75; c.lineWidth = r * 0.11; c.stroke(); c.globalAlpha = 1;
  }
  c.beginPath(); c.ellipse(0, by + r * 0.4, r * 0.62, r * 0.36, 0, 0, TAU);
  c.fillStyle = pal.belly; c.globalAlpha = 0.5; c.fill(); c.globalAlpha = 1;
  if ((art.extra === 'horns' || isBoss || art.extra === 'crown') && !lod) {
    c.fillStyle = pal.dark;
    c.globalAlpha = 0.45;
    c.beginPath(); c.arc(-r * 0.72, by + r * 0.05, r * 0.12, 0, TAU); c.arc(-r * 0.58, by + r * 0.35, r * 0.08, 0, TAU); c.arc(r * 0.75, by + r * 0.15, r * 0.1, 0, TAU); c.fill();
    c.globalAlpha = 1;
  }

  drawMonsterLegs(c, e, r, pal, false, lod);

  // Head accessories.
  if (art.extra === 'antenna') {
    const tx = r * 0.32 + Math.sin(t * 7 + e.seed) * r * 0.14, ty = by - r * 1.45;
    c.beginPath(); c.moveTo(r * 0.08, by - r * 0.82); c.quadraticCurveTo(r * 0.05, by - r * 1.2, tx, ty);
    c.strokeStyle = pal.outline; c.lineWidth = r * 0.12 + 2; c.stroke(); c.strokeStyle = pal.dark; c.lineWidth = r * 0.12; c.stroke();
    c.beginPath(); c.arc(tx, ty, r * 0.16, 0, TAU); c.fillStyle = pal.accent; c.fill(); c.lineWidth = 1.5; c.strokeStyle = pal.outline; c.stroke();
  } else if (art.extra === 'horns' || isBoss) {
    for (const s of [-1, 1]) {
      c.beginPath();
      c.moveTo(s * r * 0.62, by - r * 0.58);
      c.quadraticCurveTo(s * r * 1.05, by - r * 0.95, s * r * (isBoss ? 1.15 : 0.95), by - r * (isBoss ? 1.5 : 1.3));
      c.quadraticCurveTo(s * r * 0.62, by - r * 1.0, s * r * 0.3, by - r * 0.78);
      c.closePath();
      c.fillStyle = isBoss ? pal.accent : pal.accent; c.fill(); c.lineWidth = lw * 0.8; c.strokeStyle = pal.outline; c.stroke();
    }
  } else if (art.extra === 'crown') {
    const cw = r * 0.85, cy = by - r * 0.78;
    c.beginPath();
    c.moveTo(-cw / 2, cy); c.lineTo(-cw / 2, cy - r * 0.32); c.lineTo(-cw / 4, cy - r * 0.16); c.lineTo(0, cy - r * 0.42);
    c.lineTo(cw / 4, cy - r * 0.16); c.lineTo(cw / 2, cy - r * 0.32); c.lineTo(cw / 2, cy); c.closePath();
    c.fillStyle = pal.accent; c.fill(); c.lineWidth = lw * 0.7; c.strokeStyle = '#7a5410'; c.stroke();
    c.beginPath(); c.arc(0, cy - r * 0.12, r * 0.06, 0, TAU); c.fillStyle = '#e8384f'; c.fill();
  }

  // Wobbly eyes.
  const dizzy = e.boss && e.state === 'recover';
  const wob = t * 7 + e.seed;
  const angry = art.extra === 'horns' || isBoss ? 1 : 0;
  if (isBoss) {
    drawMonsterEye(c, -r * 0.42, by - r * 0.32, r * 0.2, lx, ly, wob, pal, 1, dizzy, t);
    drawMonsterEye(c, r * 0.42, by - r * 0.32, r * 0.2, lx, ly, wob + 2, pal, -1, dizzy, t);
    drawMonsterEye(c, 0, by - r * 0.55, r * 0.27, lx, ly, wob + 4, pal, 0, dizzy, t);
  } else {
    drawMonsterEye(c, -r * 0.38, by - r * 0.4, r * 0.31, lx, ly, wob, pal, angry, dizzy, t, sprite);
    drawMonsterEye(c, r * 0.4, by - r * 0.36, r * 0.25, lx, ly, wob + 2.1, pal, -angry, dizzy, t, sprite);
  }

  // Glossy highlight and rosy cheeks.
  if (!flash) {
    c.beginPath(); c.ellipse(-r * 0.8, by - r * 0.05, r * 0.09, r * 0.2, 0.35, 0, TAU);
    c.fillStyle = 'rgba(255,255,255,0.5)'; c.fill();
    c.beginPath(); c.ellipse(-r * 0.66, by + r * 0.2, r * 0.15, r * 0.08, 0, 0, TAU); c.ellipse(r * 0.66, by + r * 0.2, r * 0.15, r * 0.08, 0, 0, TAU);
    c.fillStyle = 'rgba(255,120,150,0.4)'; c.fill();
  }

  // Wide grin with teeth and tongue.
  const mw = r * (isBoss ? 0.7 : 0.6), my = by + r * 0.06, md = r * (isBoss ? 0.7 : 0.58);
  c.beginPath();
  c.moveTo(-mw, my); c.quadraticCurveTo(0, my + md * 1.25, mw, my); c.quadraticCurveTo(0, my + md * 0.3, -mw, my);
  c.closePath(); c.fillStyle = pal.mouth; c.fill(); c.lineWidth = lw * 0.8; c.strokeStyle = pal.outline; c.stroke();
  c.beginPath(); c.ellipse(0, my + md * 0.6, mw * 0.36, md * 0.16, 0, 0, TAU); c.fillStyle = pal.tongue; c.fill();
  if (!lod) {
    const n = isBoss ? 7 : 5;
    c.beginPath();
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n, x = -mw + u * mw * 2, y = my + md * 0.3 * (1 - Math.pow(2 * u - 1, 2)) * 0.95;
      const tw = mw * 2 / n * 0.42;
      c.moveTo(x - tw, y - 0.5); c.lineTo(x, y + r * (isBoss ? 0.2 : 0.15)); c.lineTo(x + tw, y - 0.5);
    }
    c.fillStyle = '#ffffff'; c.fill();
    if (art.extra === 'horns') {
      c.beginPath();
      for (const s of [-1, 1]) { const x = s * mw * 0.78; c.moveTo(x - r * 0.07, my + md * 0.6); c.lineTo(x, my + md * 0.1); c.lineTo(x + r * 0.07, my + md * 0.6); }
      c.fillStyle = pal.accent; c.fill();
    }
  }

  // Dizzy stars over recovering bosses.
  if (dizzy) {
    for (let i = 0; i < 3; i++) {
      const a = t * 4 + i * TAU / 3;
      star4(c, Math.cos(a) * r * 0.7, by - r * 1.25 + Math.sin(a) * r * 0.18, r * 0.14, '#ffe27a');
    }
  }
  c.restore();
}

// ---------- World passes ----------
const drawList = [];
const heroOpts = { t: 0, move: 0, phase: 0, facing: 1, back: false, flash: false, alpha: 1, death: 0, hurt: 0, swing: null, evo: false };
const ghostOpts = { t: 0, move: 1, phase: 0, facing: 1, back: false, flash: true, alpha: 1, death: 0, hurt: 0 };

function render() {
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  if (state === STATE.TITLE || !G) { renderTitle(); return; }
  renderWorld();
  renderHUD();
}

function renderWorld() {
  const c = ctx, g = G, p = g.player, z = view.zoom;
  let sx = 0, sy = 0;
  if (state === STATE.PLAYING && g.shake > 0) {
    const s = g.shake * g.shake * CONFIG.SHAKE_MAX;
    sx = (Math.sin(realTime * 53.1) + Math.sin(realTime * 31.7)) * 0.5 * s;
    sy = (Math.cos(realTime * 47.9) + Math.sin(realTime * 23.3)) * 0.5 * s;
  }
  const camX = g.cam.x + sx / z, camY = g.cam.y + sy / z;
  c.fillStyle = GROUND.meadowDeep;
  c.fillRect(0, 0, view.w, view.h);
  c.save();
  c.translate(view.w / 2, view.h / 2);
  c.scale(z, z);
  c.translate(-camX, -camY);
  const hw = view.w / 2 / z, hh = view.h / 2 / z;
  const L = camX - hw, T = camY - hh, R = camX + hw, B = camY + hh;

  drawGround(c, L, T, R, B);                    // 1-3. background, terrain, decoration
  drawLanternLight(c, g.animT, L, T, R, B);
  drawDecals(c);                                // telegraphs and hero light on the ground

  drawList.length = 0;
  const m = 120;
  for (const e of g.enemies) {
    if (e.dead) continue;
    if (e.x < L - m - e.r || e.x > R + m + e.r || e.y < T - m || e.y > B + m + e.r * 2.5) continue;
    drawList.push(e);
  }
  drawList.sort((a, b) => a.y - b.y);
  drawShadows(c, drawList);                     // 4. ground shadows
  drawGems(c, L, T, R, B);                      // 5. XP and pickups
  drawPickups(c);
  const lod = drawList.length > 170;
  const t = g.animT;
  for (const e of drawList) {                   // 6. enemies
    const dx = p.x - e.x, dy = p.y - (e.y - e.r), d = Math.hypot(dx, dy) || 1;
    drawMonster(c, e, t, lod && !e.boss, dx / d, dy / d);
    if (e.boss) drawBossWorldBar(c, e);
  }
  drawPlayer(c);                                // 7. hero
  drawPulsesFx(c);                              // 8. weapons and projectiles
  drawStrikesFx(c);
  drawMedallions(c);
  drawProjectiles(c, L, T, R, B);
  drawParticles(c, false);                      // 9. impacts and foreground effects
  c.globalCompositeOperation = 'lighter';
  drawParticles(c, true);
  c.globalCompositeOperation = 'source-over';
  drawFireflies(c, g.animT, L, T, R, B);
  drawTelegraphOutlines(c);
  drawTexts(c);
  c.restore();
  drawScreenOverlays(c);
}

function drawLanternLight(c, t, L, T, R, B) {
  c.save();
  c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < LANTERNS.length; i++) {
    const l = LANTERNS[i];
    if (l.x < L - 200 || l.x > R + 200 || l.y < T - 200 || l.y > B + 200) continue;
    const f = 0.85 + Math.sin(t * 11 + i * 2.1) * 0.08 + Math.sin(t * 23 + i) * 0.05;
    c.globalAlpha = 0.32 * f;
    c.drawImage(SPRITES.glowWarm, l.x - 110, l.y - 70, 220, 150);
    c.globalAlpha = 0.85 * f;
    c.drawImage(SPRITES.glowWarm, l.x - 22, l.y - 58, 44, 44);
  }
  c.restore();
}

/** Ambient fireflies, world-anchored and purely decorative (derived from time). */
function drawFireflies(c, t, L, T, R, B) {
  const PX = Math.max(1600, R - L + 120), PY = Math.max(1000, B - T + 120);
  const n = Math.min(64, Math.round(30 * (PX * PY) / 1.6e6));
  c.save();
  c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const h = hashInt(i, 4242), bx = (h & 0xffff) / 65536, by = (h >>> 16) / 65536;
    const X = bx * PX + Math.sin(t * 0.37 + i * 1.7) * 46 + t * 7, Y = by * PY + Math.cos(t * 0.29 + i) * 34 - t * 5;
    const x = L - 60 + ((((X - (L - 60)) % PX) + PX) % PX), y = T - 60 + ((((Y - (T - 60)) % PY) + PY) % PY);
    const tw = 0.5 + 0.5 * Math.sin(t * (1.6 + (i % 5) * 0.3) + i * 2.3);
    if (tw < 0.15) continue;
    const sz = 9 + (i % 4) * 2.5;
    c.globalAlpha = 0.65 * tw;
    c.drawImage(SPRITES.glowFirefly, x - sz / 2, y - sz / 2, sz, sz);
  }
  c.restore();
}

function drawDecals(c) {
  const p = G.player;
  const lg = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, 150);
  lg.addColorStop(0, 'rgba(255,236,200,0.16)'); lg.addColorStop(1, 'rgba(255,236,200,0)');
  c.fillStyle = lg; c.fillRect(p.x - 150, p.y - 150, 300, 300);
  if (!p.dead) {
    c.beginPath(); c.ellipse(p.x, p.y, 22, 9, 0, 0, TAU);
    c.strokeStyle = 'rgba(143,245,216,0.6)'; c.lineWidth = 2; c.stroke();
  }
  for (const e of G.enemies) if (!e.dead && e.state === 'windup') drawTelegraphFill(c, e);
  for (const u of G.pulses) {
    const a = 1 - Math.min(1, u.t / u.dur);
    c.beginPath(); c.arc(u.x, u.y, u.r, 0, TAU);
    c.fillStyle = u.evo ? `rgba(160,240,255,${0.1 * a})` : `rgba(111,255,210,${0.08 * a})`; c.fill();
  }
}

function telegraphProgress(e) {
  const total = e.boss ? e.windup : e.cfg.windup;
  return clamp(1 - e.stateT / total, 0, 1);
}

function drawTelegraphFill(c, e) {
  const prog = telegraphProgress(e);
  c.save();
  c.translate(e.x, e.y);
  if (e.type === 'dasher') {
    const len = e.cfg.dashSpeed * e.cfg.dashTime;
    c.rotate(Math.atan2(e.dirY, e.dirX));
    roundRectPath(c, 0, -e.r * 0.75, len, e.r * 1.5, e.r * 0.75);
    c.fillStyle = `rgba(255,140,60,${0.1 + 0.2 * prog})`; c.fill();
    c.beginPath(); c.moveTo(len + 12, 0); c.lineTo(len - 6, -12); c.lineTo(len - 6, 12); c.closePath();
    c.fillStyle = `rgba(255,170,90,${0.3 + 0.5 * prog})`; c.fill();
  } else if (e.atk === 'charge') {
    const len = e.cfg.chargeSpeed * e.cfg.chargeTime + e.r, w = e.r * 0.95;
    c.rotate(Math.atan2(e.dirY, e.dirX));
    c.fillStyle = 'rgba(255,40,60,0.14)'; c.fillRect(0, -w, len, w * 2);
    c.fillStyle = 'rgba(255,40,60,0.22)'; c.fillRect(0, -w, len * prog, w * 2);
  } else if (e.atk === 'slam') {
    const R = e.cfg.slamRadius;
    c.beginPath(); c.arc(0, 0, R, 0, TAU); c.fillStyle = 'rgba(255,40,60,0.13)'; c.fill();
    c.beginPath(); c.arc(0, 0, R * prog, 0, TAU); c.fillStyle = 'rgba(255,60,60,0.2)'; c.fill();
  } else if (e.atk === 'spit') {
    const n = e.cfg.spitCount;
    c.strokeStyle = `rgba(200,120,255,${0.25 + 0.5 * prog})`; c.lineWidth = 4;
    c.beginPath();
    for (let i = 0; i < n; i++) {
      const a = e.spitRot + (i / n) * TAU;
      c.moveTo(Math.cos(a) * e.r * 1.1, Math.sin(a) * e.r * 1.1);
      c.lineTo(Math.cos(a) * (e.r * 1.1 + 70 * prog), Math.sin(a) * (e.r * 1.1 + 70 * prog));
    }
    c.stroke();
  }
  c.restore();
}

function drawTelegraphOutlines(c) {
  for (const e of G.bosses) {
    if (e.dead || e.state !== 'windup') continue;
    const blink = 0.55 + Math.sin(G.animT * 22) * 0.35;
    c.save();
    c.translate(e.x, e.y);
    c.strokeStyle = `rgba(255,80,90,${blink})`; c.lineWidth = 3;
    if (e.atk === 'charge') {
      const len = e.cfg.chargeSpeed * e.cfg.chargeTime + e.r, w = e.r * 0.95;
      c.rotate(Math.atan2(e.dirY, e.dirX));
      c.strokeRect(0, -w, len, w * 2);
      c.fillStyle = `rgba(255,120,120,${blink})`;
      for (let i = 1; i <= 3; i++) {
        const x = len * i / 4;
        c.beginPath(); c.moveTo(x + 14, 0); c.lineTo(x - 4, -14); c.lineTo(x - 4, 14); c.closePath(); c.fill();
      }
    } else if (e.atk === 'slam') {
      c.beginPath(); c.arc(0, 0, e.cfg.slamRadius, 0, TAU); c.stroke();
    } else if (e.atk === 'spit') {
      c.globalCompositeOperation = 'lighter';
      c.drawImage(SPRITES.glowViolet, -e.r * 1.6, -e.r * 2.6, e.r * 3.2, e.r * 3.2);
    }
    c.restore();
  }
}

function drawShadows(c, list) {
  const p = G.player, med = getWeapon('medallion');
  // Two batched passes: a wide soft penumbra, then a tighter contact core.
  for (let pass = 0; pass < 2; pass++) {
    const k = pass ? 0.82 : 1.3;
    c.fillStyle = pass ? 'rgba(24,14,4,0.24)' : 'rgba(24,14,4,0.13)';
    c.beginPath();
    for (const e of list) {
      const rx = e.r * 1.1 * k, ry = e.r * 0.42 * k;
      c.moveTo(e.x + rx, e.y); c.ellipse(e.x, e.y, rx, ry, 0, 0, TAU);
    }
    if (!p.dead || p.deathT < 1.6) { c.moveTo(p.x + 16 * k, p.y); c.ellipse(p.x, p.y, 16 * k, 6 * k, 0, 0, TAU); }
    if (med && med.s && !p.dead) {
      const n = med.s.count;
      for (let i = 0; i < n; i++) {
        const a = med.angle + (i / n) * TAU, x = p.x + Math.cos(a) * med.s.orbit, y = p.y + Math.sin(a) * med.s.orbit;
        c.moveTo(x + med.s.size * 0.8 * k, y); c.ellipse(x, y, med.s.size * 0.8 * k, med.s.size * 0.3 * k, 0, 0, TAU);
      }
    }
    c.fill();
  }
}

function drawGems(c, L, T, R, B) {
  const t = G.animT;
  for (const g of G.gems) {
    if (g.x < L - 20 || g.x > R + 20 || g.y < T - 30 || g.y > B + 20) continue;
    const bob = Math.sin(t * 4 + g.t) * 2.2;
    const s = g.tier === 2 ? 46 : g.tier === 1 ? 40 : 34;
    c.drawImage(SPRITES.gems[g.tier], g.x - s / 2, g.y - s / 2 - 8 - bob, s, s);
  }
}

function drawPickups(c) {
  const t = G.animT;
  for (const k of G.pickups) {
    const bob = Math.sin(t * 3 + k.x) * 3;
    c.beginPath(); c.ellipse(k.x, k.y, 12, 4.5, 0, 0, TAU); c.fillStyle = 'rgba(26,16,6,0.3)'; c.fill();
    c.drawImage(k.kind === 'medkit' ? SPRITES.medkit : SPRITES.magnet, k.x - 24, k.y - 38 - bob, 48, 48);
  }
}

function drawPlayer(c) {
  const p = G.player;
  let alpha = 1;
  if (p.dead) alpha = clamp((2.1 - p.deathT) / 0.8, 0, 1);
  else if (p.blinkT > 0 && Math.floor(G.animT * 18) % 2 === 0) alpha = 0.4;
  heroOpts.t = G.animT; heroOpts.move = p.dead ? 0 : p.move; heroOpts.phase = p.phase; heroOpts.facing = p.facing;
  heroOpts.back = p.back && !p.dead; heroOpts.flash = p.hurt > 0.12; heroOpts.alpha = alpha;
  heroOpts.death = p.dead ? p.deathT : 0; heroOpts.hurt = Math.max(0, p.hurt);
  const strikeW = G.weapons[0];
  heroOpts.evo = !!(strikeW && strikeW.id === 'strike' && strikeW.evolved);
  heroOpts.swing = null;
  const st = G.strikes.length ? G.strikes[G.strikes.length - 1] : null;
  if (st && !p.dead && st.t < st.life) {
    heroOpts.swing = slashHead(st.ang, st.arc, st.flip, st.t / st.life);
    heroOpts.facing = Math.cos(st.ang) >= 0 ? 1 : -1;
  }
  if (alpha > 0) drawHero(c, p.x, p.y, heroOpts);
  if (!p.dead) {
    const w = 36, x = p.x - w / 2, y = p.y + 9;
    c.fillStyle = 'rgba(10,6,6,0.75)'; c.fillRect(x - 1, y - 1, w + 2, 6);
    c.fillStyle = p.hp / p.maxHp < 0.35 ? '#ff5d6c' : '#7cf0b0';
    c.fillRect(x, y, w * clamp(p.hp / p.maxHp, 0, 1), 4);
  }
}

function drawBossWorldBar(c, e) {
  const w = e.r * 1.6, x = e.x - w / 2, y = e.y - e.r * 2.45;
  c.fillStyle = 'rgba(10,6,6,0.8)'; c.fillRect(x - 1.5, y - 1.5, w + 3, 8);
  c.fillStyle = e.type === 'boss' ? '#ff5d6c' : '#8fb0ff';
  c.fillRect(x, y, w * clamp(e.hp / e.maxHp, 0, 1), 5);
}

function slashHead(ang, arc, flip, prog) {
  const a0 = ang - arc / 2, a1 = ang + arc / 2, start = flip ? a1 : a0, end = flip ? a0 : a1;
  return start + (end - start) * easeOutCubic(Math.min(1, prog / 0.55));
}

/** A crescent sword trail: soft outer glow, bright body, white-hot core, sparkles at the tip. */
function drawSlash(c, cx, cy, ang, arc, R, flip, prog, evo) {
  const a0 = ang - arc / 2, a1 = ang + arc / 2, start = flip ? a1 : a0;
  const head = slashHead(ang, arc, flip, prog), span = head - start, N = 18;
  const fade = 1 - Math.max(0, (prog - 0.3) / 0.7);
  const layers = evo
    ? [[0.62, '#ff9f2e', 0.32], [0.36, '#ffd166', 0.62], [0.12, '#ffffff', 0.95]]
    : [[0.56, '#3f9dff', 0.3], [0.32, '#9fe4ff', 0.6], [0.1, '#ffffff', 0.95]];
  c.save();
  c.globalCompositeOperation = 'lighter';
  for (const [tk, col, al] of layers) {
    const thick = R * tk;
    c.beginPath();
    for (let k = 0; k <= N; k++) { const a = start + span * (k / N); const x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R; if (k) c.lineTo(x, y); else c.moveTo(x, y); }
    for (let k = N; k >= 0; k--) {
      const u = k / N, a = start + span * u, rr = R - thick * Math.pow(u, 1.5) - 1;
      c.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    c.closePath();
    c.globalAlpha = fade * al;
    c.fillStyle = col;
    c.fill();
  }
  if (prog < 0.55) {
    const k = 1 - prog / 0.55, hx = cx + Math.cos(head) * R, hy = cy + Math.sin(head) * R, gs = evo ? 80 : 60;
    c.globalAlpha = k * 0.9;
    c.drawImage(evo ? SPRITES.glowGold : SPRITES.glowSteel, hx - gs / 2, hy - gs / 2, gs, gs);
    for (let i = 0; i < 3; i++) {
      const a = head - span * (0.12 + i * 0.13), rr = R * (0.92 - i * 0.07);
      star4(c, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, (6 - i * 1.5) * k + 1, evo ? '#fff3c4' : '#e6f8ff');
    }
  }
  c.restore();
}

function drawStrikesFx(c) {
  const p = G.player;
  for (const s of G.strikes) drawSlash(c, p.x, p.y - 22, s.ang, s.arc, s.range, s.flip, s.t / s.life, s.evo);
}

function drawPulsesFx(c) {
  c.save();
  c.globalCompositeOperation = 'lighter';
  for (const u of G.pulses) {
    const k = Math.min(1, u.t / u.dur), a = k < 1 ? 1 - k * 0.6 : Math.max(0, 1 - (u.t - u.dur) / 0.2) * 0.4;
    c.globalAlpha = a;
    c.beginPath(); c.arc(u.x, u.y, Math.max(1, u.r), 0, TAU);
    c.strokeStyle = u.evo ? '#a8f0ff' : '#6fffd2'; c.lineWidth = 3 + 10 * (1 - k); c.stroke();
    c.beginPath(); c.arc(u.x, u.y, Math.max(1, u.r * 0.96), 0, TAU);
    c.strokeStyle = '#ffffff'; c.lineWidth = 1.5; c.stroke();
    if (u.evo && k < 1) {
      c.beginPath();
      for (let i = 0; i < 14; i++) {
        const ang = (i / 14) * TAU + u.id, r0 = u.r * 0.92, r1 = u.r * 1.08;
        c.moveTo(u.x + Math.cos(ang) * r0, u.y + Math.sin(ang) * r0);
        c.lineTo(u.x + Math.cos(ang + 0.05) * r1, u.y + Math.sin(ang + 0.05) * r1);
        c.lineTo(u.x + Math.cos(ang + 0.1) * r0, u.y + Math.sin(ang + 0.1) * r0);
      }
      c.strokeStyle = '#e8fbff'; c.lineWidth = 2; c.stroke();
    }
  }
  c.restore();
}

function drawMedallions(c) {
  const w = getWeapon('medallion'), p = G.player;
  if (!w || !w.s || p.dead) return;
  const s = w.s, n = s.count, t = G.animT;
  c.save();
  for (let i = 0; i < n; i++) {
    const a = w.angle + (i / n) * TAU;
    // Motion trail along the orbit.
    c.globalCompositeOperation = 'lighter';
    c.lineCap = 'round';
    for (let k = 0; k < 3; k++) {
      c.beginPath();
      c.arc(p.x, p.y - 16, s.orbit, a - 0.18 * (k + 1), a - 0.18 * k);
      c.strokeStyle = w.evolved ? 'rgba(255,240,180,1)' : 'rgba(255,209,102,1)';
      c.globalAlpha = 0.35 - k * 0.1; c.lineWidth = s.size * (1.1 - k * 0.25); c.stroke();
    }
    const x = p.x + Math.cos(a) * s.orbit, y = p.y + Math.sin(a) * s.orbit - 16;
    c.globalAlpha = 0.7;
    const gs = s.size * 4.2;
    c.drawImage(SPRITES.glowGold, x - gs / 2, y - gs / 2, gs, gs);
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1;
    c.save();
    c.translate(x, y);
    c.scale(0.35 + 0.65 * Math.abs(Math.cos(t * 5 + i)), 1); // coin spin
    drawMedallionShape(c, s.size, w.evolved);
    c.restore();
  }
  c.restore();
}

function drawProjectiles(c, L, T, R, B) {
  for (const pr of projectiles) {
    if (!pr.on) continue;
    if (pr.x < L - 40 || pr.x > R + 40 || pr.y < T - 40 || pr.y > B + 40) continue;
    if (pr.hostile) {
      const wob = Math.sin(G.animT * 12 + pr.ang * 5) * 1.5;
      c.save();
      c.globalCompositeOperation = 'lighter';
      c.drawImage(SPRITES.glowViolet, pr.x - 22, pr.y - 42, 44, 44);
      c.restore();
      c.beginPath(); c.arc(pr.x, pr.y - 20, pr.r + wob * 0.3, 0, TAU);
      const g = c.createRadialGradient(pr.x - 3, pr.y - 23, 1, pr.x, pr.y - 20, pr.r + 1);
      g.addColorStop(0, '#f3d4ff'); g.addColorStop(0.5, '#a84cff'); g.addColorStop(1, '#4a1580');
      c.fillStyle = g; c.fill(); c.lineWidth = 2; c.strokeStyle = '#2a0a48'; c.stroke();
      continue;
    }
    c.save();
    c.translate(pr.x, pr.y - 18);
    c.rotate(pr.ang);
    c.globalCompositeOperation = 'lighter';
    const tl = pr.evo ? 46 : 36;
    const tg = c.createLinearGradient(-tl, 0, 0, 0);
    tg.addColorStop(0, 'rgba(255,95,162,0)'); tg.addColorStop(1, pr.evo ? 'rgba(200,140,255,0.9)' : 'rgba(255,95,162,0.85)');
    c.fillStyle = tg;
    c.beginPath(); c.moveTo(-tl, 0); c.lineTo(-6, -3.2); c.lineTo(-6, 3.2); c.closePath(); c.fill();
    c.drawImage(pr.evo ? SPRITES.glowViolet : SPRITES.glowPink, -14, -14, 28, 28);
    c.globalCompositeOperation = 'source-over';
    drawSyringeShape(c, 0.95, pr.evo ? '#c38bff' : '#ff5fa2');
    c.restore();
  }
}

function drawParticles(c, additive) {
  for (const q of particles) {
    if (!q.on) continue;
    const add = q.kind === PK.SPARK || q.kind === PK.RING || q.kind === PK.GLOW;
    if (add !== additive) continue;
    const k = q.life / q.max;
    switch (q.kind) {
      case PK.DOT:
        c.globalAlpha = Math.min(1, k * 1.8);
        c.fillStyle = q.color;
        c.beginPath(); c.arc(q.x, q.y, q.size * (0.4 + 0.6 * k), 0, TAU); c.fill();
        break;
      case PK.SPARK:
        c.globalAlpha = k;
        c.strokeStyle = q.color; c.lineWidth = q.size;
        c.beginPath(); c.moveTo(q.x, q.y); c.lineTo(q.x - q.vx * 0.04, q.y - q.vy * 0.04); c.stroke();
        break;
      case PK.RING:
        c.globalAlpha = k * 0.9;
        c.strokeStyle = q.color; c.lineWidth = 1.5 + 5 * k;
        c.beginPath(); c.arc(q.x, q.y, q.size, 0, TAU); c.stroke();
        break;
      case PK.SMOKE:
        c.globalAlpha = k * 0.35;
        c.fillStyle = q.color;
        c.beginPath(); c.arc(q.x, q.y, q.size, 0, TAU); c.fill();
        break;
      case PK.GLOW:
        c.globalAlpha = k * 0.8;
        c.drawImage(SPRITES.glowWhite, q.x - q.size, q.y - q.size, q.size * 2, q.size * 2);
        break;
      case PK.GHOST:
        ghostOpts.t = G.animT; ghostOpts.phase = q.z; ghostOpts.facing = q.rot >= 0 ? 1 : -1; ghostOpts.alpha = k * 0.4;
        drawHero(c, q.x, q.y, ghostOpts);
        break;
      default:
        break;
    }
  }
  c.globalAlpha = 1;
}

function drawTexts(c) {
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.lineJoin = 'round';
  for (const t of texts) {
    if (!t.on) continue;
    const k = t.life / t.max, age = 1 - k;
    const pop = age < 0.15 ? 0.6 + (age / 0.15) * 0.6 : 1.2 - Math.min(0.2, (age - 0.15) * 0.8);
    c.globalAlpha = Math.min(1, k * 3);
    c.font = `900 ${Math.round(t.size * pop)}px ${FONT}`;
    c.lineWidth = 3.5; c.strokeStyle = 'rgba(20,10,10,0.85)';
    c.strokeText(t.str, t.x, t.y);
    c.fillStyle = t.color;
    c.fillText(t.str, t.x, t.y);
  }
  c.globalAlpha = 1;
}

// ---------- Title scene (purely decorative, driven by wall-clock time) ----------
const TITLE_CAST = [
  ['brute', -255, -25, 0.2], ['runner', -170, 90, 1.4], ['runner', -110, -120, 2.1],
  ['dasher', 205, -90, 0.9], ['runner', 160, 100, 2.8], ['brute', 290, 35, 1.9], ['runner', 60, -160, 3.3],
].map(([type, x, y, ph]) => ({
  type, bx: x, by: y, ph, x, y, r: CONFIG.enemies[type].radius, cfg: CONFIG.enemies[type],
  flash: 0, state: 'chase', seed: ph * 100, phase: 0, boss: false, dirX: 0,
}));
const TITLE_GEMS = [[-60, 60, 0], [80, 45, 1], [-200, 30, 0], [120, -60, 0], [230, 120, 2], [-140, -50, 1], [20, 120, 0]];
const titleHero = { t: 0, move: 0, phase: 0, facing: 1, back: false, flash: false, alpha: 1, death: 0, hurt: 0, swing: null, evo: false };

function renderTitle() {
  const c = ctx, t = realTime, z = view.zoom * CONFIG.TITLE_ZOOM;
  const anchorY = UI.titleAnchorY || view.h * 0.55;
  const camX = Math.sin(t * 0.13) * 40, camY = Math.cos(t * 0.11) * 20;
  c.fillStyle = GROUND.meadowDeep;
  c.fillRect(0, 0, view.w, view.h);
  c.save();
  c.translate(view.w / 2, anchorY);
  c.scale(z, z);
  c.translate(-camX, -camY);
  const L = camX - view.w / 2 / z, R = camX + view.w / 2 / z, T = camY - anchorY / z, B = camY + (view.h - anchorY) / z;
  drawGround(c, L, T, R, B);
  drawLanternLight(c, t, L, T, R, B);

  for (const m of TITLE_CAST) {
    m.phase = t * 9 + m.ph * 3;
    const k = Math.sin(t * 0.9 + m.ph);
    m.x = m.bx * (0.92 + k * 0.06); m.y = m.by * (0.92 + k * 0.06);
  }
  c.fillStyle = 'rgba(26,16,6,0.3)';
  c.beginPath();
  for (const m of TITLE_CAST) { c.moveTo(m.x + m.r * 1.1, m.y); c.ellipse(m.x, m.y, m.r * 1.1, m.r * 0.42, 0, 0, TAU); }
  c.moveTo(15, 0); c.ellipse(0, 0, 15, 5.5, 0, 0, TAU);
  c.fill();
  for (const [gx, gy, tier] of TITLE_GEMS) {
    const s = tier === 2 ? 46 : tier ? 40 : 34;
    c.drawImage(SPRITES.gems[tier], gx - s / 2, gy - s / 2 - 8 - Math.sin(t * 4 + gx) * 2, s, s);
  }
  const cast = TITLE_CAST.slice().sort((a, b) => a.y - b.y);
  for (const m of cast) {
    if (m.y > 0) continue;
    const d = Math.hypot(m.x, m.y - 30) || 1;
    drawMonster(c, m, t, false, -m.x / d, -(m.y - 30) / d);
  }
  // Hero, idling heroically with a medallion and periodic pulse.
  titleHero.t = t;
  titleHero.facing = Math.sin(t * 0.45) > 0 ? 1 : -1;
  const cycle = t % 3.2;
  if (cycle < 0.6) {
    c.save(); c.globalCompositeOperation = 'lighter';
    const k = cycle / 0.6;
    c.globalAlpha = 1 - k;
    c.beginPath(); c.arc(0, 0, 40 + k * 170, 0, TAU); c.strokeStyle = '#6fffd2'; c.lineWidth = 3 + 8 * (1 - k); c.stroke();
    c.restore();
  }
  const sc = (t + 1.1) % 2.6, sProg = sc / 0.24, sAng = titleHero.facing > 0 ? -0.25 : Math.PI + 0.25;
  titleHero.swing = sProg < 1 ? slashHead(sAng, 2.6, false, sProg) : null;
  drawHero(c, 0, 0, titleHero);
  if (sProg < 1) drawSlash(c, 0, -22, sAng, 2.6, 125, false, sProg, false);
  for (const m of cast) {
    if (m.y <= 0) continue;
    const d = Math.hypot(m.x, m.y - 30) || 1;
    drawMonster(c, m, t, false, -m.x / d, -(m.y - 30) / d);
  }
  for (let i = 0; i < 2; i++) {
    const a = t * 2.4 + i * Math.PI, x = Math.cos(a) * 70, y = Math.sin(a) * 70 - 16;
    c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.6;
    c.drawImage(SPRITES.glowGold, x - 24, y - 24, 48, 48); c.restore();
    c.save(); c.translate(x, y); c.scale(0.35 + 0.65 * Math.abs(Math.cos(t * 5 + i)), 1); drawMedallionShape(c, 11, false); c.restore();
  }
  drawFireflies(c, t, L, T, R, B);
  c.restore();
  drawScreenOverlays(c);
}

// =====================================================================
// 18. INITIALISATION & RESTART
// =====================================================================
function startRun() {
  G = createRun();
  initParticles();
  initTexts();
  initProjectiles();
  addWeapon('strike');
  clearInput();
  accumulator = 0;
  G.cam.x = G.player.x;
  G.cam.y = G.player.y;
  state = STATE.PLAYING;
  UI.show(null);
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  banner('SURVIVE 5:00', 'Weapons attack automatically — keep moving!', '#8ff5d8');
}

function goTitle() {
  G = null;
  state = STATE.TITLE;
  clearInput();
  UI.show('title');
}

function init() {
  UI.init();
  initParticles();
  initTexts();
  initProjectiles();
  buildSprites();
  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 150));
  UI.show('title');
  requestAnimationFrame(frame);
}

// Public, read-mostly handle for debugging; manipulation helpers only with ?test.
window.NavosNinja = {
  CONFIG, STATE,
  get state() { return state; },
  get run() { return G; },
  start: () => startRun(),
};
if (TEST_MODE) {
  window.NavosNinja.test = {
    setInput(x, y) { testInput = x === null ? null : { x, y }; },
    step(n) { for (let i = 0; i < (n || 1); i++) if (state === STATE.PLAYING) step(CONFIG.STEP); return state; },
    advance(seconds, opts) {
      const o = opts || {};
      let n = Math.round(seconds / CONFIG.STEP);
      while (n-- > 0) {
        if (state === STATE.LEVEL_UP && o.autoPick !== false) chooseCard(o.pick === 'random' ? Math.floor(Math.random() * G.options.length) : o.pick === 'smart' ? smartPick() : (o.pick || 0), true);
        if (state !== STATE.PLAYING) break;
        if (o.bot) botSteer();
        if (o.godMode) { G.player.hp = G.player.maxHp; }
        step(CONFIG.STEP);
      }
      if (o.bot) testInput = null;
      return state;
    },
    choose(i) { return chooseCard(i, true); },
    options() { return G && G.options ? G.options.map(describeOption).map((d) => d.name) : []; },
    optionKinds() { return G && G.options ? G.options.map((o) => o.kind + ':' + o.id) : []; },
    setTime(t) { G.time = t; },
    addXP(v) { gainXP(v); },
    hurt(n) { return damagePlayer(n, G.player.x + 10, G.player.y); },
    giveWeapon(id, level, evolved) { const w = addWeapon(id); w.level = level || 1; w.evolved = !!evolved; refreshStats(); return w; },
    applyPassive(id) { G.passives[id] = (G.passives[id] || 0) + 1; PASSIVES[id].apply(G.player); refreshStats(); },
    spawn(type, n, dist) {
      const out = [];
      for (let i = 0; i < (n || 1); i++) { const a = (i / (n || 1)) * TAU; out.push(spawnEnemy(type, G.player.x + Math.cos(a) * (dist || 60), G.player.y + Math.sin(a) * (dist || 60))); }
      return out.length;
    },
    killBosses() { for (const b of G.bosses.slice()) damageEnemy(b, 1e9, 0, 0, 0); },
    weapons() { return G.weapons.map((w) => ({ id: w.id, level: w.level, evolved: w.evolved, stats: { ...w.s } })); },
    counts() {
      return { enemies: G.enemies.length, bosses: G.bosses.length, gems: G.gems.length, projectiles: projectiles.filter((p) => p.on).length,
        particles: CONFIG.caps.particles - pFree.length, pickups: G.pickups.length, pulses: G.pulses.length };
    },
    difficulty,
    xpForLevel,
    renderOnce() { render(); },
    autopilot(on) { autopilot = !!on; if (!on) testInput = null; },
    perf() { return { workMs, fxLevel }; },
  };
}

// Simple test bot that kites like a player: circle-strafe the nearest enemy at
// strike range, push out of crowds, sweep up gems, stay off the wall and dash
// through boss telegraphs. Only used by the automated tests (?test).
let botSide = 1;
const BOT_PRIORITY = { might: 30, haste: 28, vitality: 26, armor: 24, syringes: 25, orbit: 25, pulsePlus: 22, regen: 20, reach: 20 };
function smartPick() {
  let best = 0, bs = -1;
  G.options.forEach((o, i) => {
    const sc = o.kind === 'evolve' ? 100 : o.kind === 'weapon-level' ? 50 + getWeapon(o.id).level : o.kind === 'weapon-new' ? 40 : (BOT_PRIORITY[o.id] || 10);
    if (sc > bs) { bs = sc; best = i; }
  });
  return best;
}
function botSteer() {
  const p = G.player;
  let near = null, nd = 1e12, cx = 0, cy = 0;
  for (const e of G.enemies) {
    if (e.dead) continue;
    const dx = e.x - p.x, dy = e.y - p.y, d2 = dx * dx + dy * dy;
    if (d2 < nd) { nd = d2; near = e; }
    const danger = e.boss ? (e.state === 'windup' || e.state === 'charge' ? 300 : 170) : 60;
    if (d2 < danger * danger) { const w = (e.boss ? 3 : 1) / Math.max(1, Math.sqrt(d2)); cx -= dx * w / 60; cy -= dy * w / 60; }
  }
  let fx = cx, fy = cy;
  if (near) {
    const d = Math.sqrt(nd) || 1, ux = (near.x - p.x) / d, uy = (near.y - p.y) / d;
    const want = near.boss ? near.r + 160 : 95;
    const radial = clamp((d - want) / want, -1, 1);
    fx += ux * radial + -uy * 0.8 * botSide;
    fy += uy * radial + ux * 0.8 * botSide;
  }
  let gx = 0, gy = 0, gd = 1e12;
  for (const g of G.gems) { const dx = g.x - p.x, dy = g.y - p.y, d = dx * dx + dy * dy; if (d < gd) { gd = d; gx = dx; gy = dy; } }
  if (gd < 260 * 260) { const d = Math.sqrt(gd) || 1; fx += gx / d * 0.6; fy += gy / d * 0.6; }
  const r = Math.hypot(p.x, p.y);
  if (r > CONFIG.ARENA_RADIUS * 0.7) { fx -= p.x / r * 1.5; fy -= p.y / r * 1.5; if (Math.random() < 0.01) botSide = -botSide; }
  const m = Math.hypot(fx, fy);
  testInput = m > 1e-6 ? { x: fx / m, y: fy / m } : { x: 0, y: 0 };
  if (p.dashCd <= 0 && (p.crowd > 2 || G.bosses.some((e) => !e.dead && e.state === 'windup' && e.stateT < 0.3))) dashQueued = true;
}

init();
})();
