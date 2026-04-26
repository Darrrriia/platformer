/**
 * Глобальные константы игры.
 *
 * Разделы:
 *  - Размеры мира и комнат
 *  - Палитра (неоновая киберпанк)
 *  - Физика (гравитация, скорости)
 *  - Параметры игрока (FSM, тайминги, прыжки, dash, атака)
 *  - Параметры врагов
 *  - Pickup и счёт
 *  - Слои отображения (depth)
 */

// ───────────────────────────────────────────── мир и тайлы
export const TILE = 64;
export const VIEW_WIDTH = 1280;
export const VIEW_HEIGHT = 720;

// ───────────────────────────────────────────── палитра (HEX)
export const COLOR = Object.freeze({
  bgDeep: 0x07060f,
  bgMid: 0x1a0d2e,
  bgFar: 0x130820,
  player: 0x4dffd1,
  playerTrail: 0x1affc4,
  attack: 0xfff15a,
  enemy: 0xff3d6e,
  enemyDark: 0x7a1a39,
  laser: 0xff5fb1,
  pickup: 0x9eff5a,
  pickupCore: 0xeaffd0,
  accent: 0xc15bff,
  platform: 0x4a2d7a,
  platformEdge: 0x9a6bff,
  hpFull: 0x4dffd1,
  hpEmpty: 0x2a1b4a,
  uiText: 0xeaeaff,
  uiDim: 0x8a85b8,
  doorIdle: 0x55335a,
  doorActive: 0x9eff5a,
});

// ───────────────────────────────────────────── физика
export const GRAVITY = 1500;
export const MAX_FALL_SPEED = 820;

// ───────────────────────────────────────────── игрок
export const PLAYER = Object.freeze({
  width: 24,
  height: 36,
  hpMax: 4,
  moveSpeed: 230,
  airAccel: 1500,
  groundAccel: 2400,
  groundFriction: 1800,
  // высота прыжка: h = vy² / (2·g)
  // одиночный (-560 при g=1500): ≈ 105px = 1.6 тайла
  // двойной добавляет (-460): ≈ 70px → суммарно ≈ 175px = 2.7 тайла
  // правило для шаблонов: вертикальный шаг между платформами ≤ 1.5 тайла,
  // от пола до первой платформы — ≤ 2.5 тайла, зазор между платформами по Y ≥ 1 тайл
  jumpVel: -560,
  doubleJumpVel: -460,
  coyoteMs: 130,
  jumpBufferMs: 150,
  cutJumpFactor: 0.42, // если отпустил Space на подъёме — режем vy
  // dash
  dashSpeed: 600,
  dashDurationMs: 180,
  dashCooldownMs: 600,
  dashIframesMs: 200,
  // wall
  wallSlideSpeedMax: 110,
  wallStickMs: 120,
  wallJumpVx: 320,
  wallJumpVy: -440,
  // attack
  attackDurationMs: 160,
  attackCooldownMs: 280,
  attackHitboxW: 56,
  attackHitboxH: 32,
  attackDamage: 1,
  // hurt
  invulnMs: 800,
  knockbackVx: 220,
  knockbackVy: -260,
});

// ───────────────────────────────────────────── враги
export const ENEMY = Object.freeze({
  drone: {
    hp: 1,
    width: 28,
    height: 22,
    speed: 90,
    bobAmpl: 16,
    bobFreq: 1.4,
    contactDamage: 1,
    minDepth: 1,
  },
  slasher: {
    hp: 2,
    width: 30,
    height: 36,
    patrolSpeed: 70,
    chaseSpeed: 160,
    sightRange: 360,
    attackRange: 56,
    attackWindupMs: 280,
    attackRecoverMs: 500,
    contactDamage: 1,
    minDepth: 2,
  },
  sentinel: {
    hp: 2,
    width: 36,
    height: 36,
    sightRange: 520,
    fireIntervalMs: 1700,
    laserSpeed: 380,
    laserDamage: 1,
    minDepth: 4,
  },
});

// ───────────────────────────────────────────── pickup
export const PICKUP = Object.freeze({
  size: 14,
  scoreValue: 10,
  bobAmpl: 4,
  bobFreqHz: 1.2,
});

// ───────────────────────────────────────────── уровень
export const LEVEL = Object.freeze({
  exitDoorWidth: 32,
  exitDoorHeight: 64,
  pickupCountMin: 1,
  pickupCountMax: 3,
  enemyCountMin: 1,
  enemyCountMax: 6,
});

// ───────────────────────────────────────────── слои отображения (depth)
export const Z = Object.freeze({
  bgFar: -300,
  bgMid: -200,
  bgNear: -100,
  platform: 0,
  pickup: 5,
  doorIdle: 6,
  enemy: 10,
  player: 20,
  projectile: 25,
  particle: 30,
  fxFront: 100,
});

// ───────────────────────────────────────────── ключи localStorage
export const STORAGE = Object.freeze({
  bestScore: 'platformer:bestScore',
  bestDepth: 'platformer:bestDepth',
});

// ───────────────────────────────────────────── события (используются через scene.events)
export const EVT = Object.freeze({
  scoreChanged: 'score:changed',
  hpChanged: 'hp:changed',
  depthChanged: 'depth:changed',
  roomCleared: 'room:cleared',
  playerDied: 'player:died',
  enemyKilled: 'enemy:killed',
  paused: 'game:paused',
  resumed: 'game:resumed',
});
