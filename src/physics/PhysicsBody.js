import { GRAVITY, MAX_FALL_SPEED } from '../constants.js';
import { sweepX, sweepY } from './CollisionSystem.js';

/**
 * Кастомное физическое тело (AABB). Не зависит от Phaser. Хранит позицию верхнего
 * левого угла, скорость, размеры, флаги контакта.
 *
 * Метод `step(dt, platforms)` — один шаг симуляции:
 *  1. применяет гравитацию (если useGravity)
 *  2. клампит vy до MAX_FALL_SPEED
 *  3. swept по X, swept по Y
 *  4. обновляет onGround / onWall / onCeiling
 *
 * Управляющий код (Player, Enemy) сначала меняет body.vx / body.vy, затем зовёт step().
 */
export class PhysicsBody {
  /**
   * @param {object} cfg
   * @param {number} cfg.x
   * @param {number} cfg.y
   * @param {number} cfg.w
   * @param {number} cfg.h
   * @param {number} [cfg.gravity]    по умолчанию GRAVITY; 0 — летающее тело
   * @param {number} [cfg.maxFall]
   */
  constructor({ x, y, w, h, gravity = GRAVITY, maxFall = MAX_FALL_SPEED }) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.vx = 0;
    this.vy = 0;
    this.gravity = gravity;
    this.maxFall = maxFall;

    this.onGround = false;
    this.wasOnGround = false;
    /** @type {-1 | 0 | 1} */
    this.onWall = 0;
    this.onCeiling = false;
  }

  /** Центральная точка тела. */
  get cx() {
    return this.x + this.w / 2;
  }
  get cy() {
    return this.y + this.h / 2;
  }

  /** Геометрия для коллизий и AI (raycast по X, дистанция между телами и т.п.). */
  rect() {
    return { x: this.x, y: this.y, w: this.w, h: this.h };
  }

  /**
   * Один шаг физики.
   * @param {number} dt секунды
   * @param {import('./CollisionSystem.js').Platform[]} platforms
   */
  step(dt, platforms) {
    this.wasOnGround = this.onGround;

    // Гравитация
    if (this.gravity > 0) {
      this.vy += this.gravity * dt;
      if (this.vy > this.maxFall) this.vy = this.maxFall;
    }

    // Сбрасываем флаги контакта перед swept'ами — они обновятся ниже.
    this.onWall = 0;

    // Сначала X — это даёт корректное определение onWall до того,
    // как Y-проход переопределит onGround.
    const dx = this.vx * dt;
    const xRes = sweepX(this, dx, platforms);
    if (xRes.hit) {
      this.vx = 0;
      this.onWall = xRes.side;
    }

    const dy = this.vy * dt;
    const yRes = sweepY(this, dy, platforms);
    this.onGround = yRes.grounded;
    this.onCeiling = yRes.ceiling;
    if (yRes.hit) {
      this.vy = 0;
    }
  }

  /**
   * Принудительно поставить тело в позицию (например, при спавне).
   * @param {number} x
   * @param {number} y
   */
  setPosition(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
  }
}
