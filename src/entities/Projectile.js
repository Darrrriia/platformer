import * as Phaser from 'phaser';
import { COLOR, Z } from '../constants.js';
import { rectsOverlap } from '../physics/CollisionSystem.js';

/**
 * Лазер-снаряд. Простой Container, без PhysicsBody (двигается прямой линией,
 * самоуничтожается при контакте с платформой/игроком/таймауте).
 */
export class Projectile extends Phaser.GameObjects.Container {
  /**
   * @param {Phaser.Scene} scene
   * @param {object} cfg
   * @param {number} cfg.x  начальная X (центр)
   * @param {number} cfg.y
   * @param {number} cfg.vx
   * @param {number} cfg.vy
   * @param {number} cfg.damage
   * @param {number} [cfg.lifeMs]
   * @param {number} [cfg.color]
   */
  constructor(scene, cfg) {
    super(scene, cfg.x, cfg.y);
    scene.add.existing(this);
    this.setDepth(Z.projectile);
    this.vx = cfg.vx;
    this.vy = cfg.vy;
    this.damage = cfg.damage;
    this.lifeMs = cfg.lifeMs ?? 2200;
    this.color = cfg.color ?? COLOR.laser;
    this.alive = true;
    this.w = 14;
    this.h = 4;

    this.gfx = scene.add.graphics();
    this.add(this.gfx);
    this._draw();
  }

  _draw() {
    const ang = Math.atan2(this.vy, this.vx);
    this.rotation = ang;
    this.gfx.clear();
    this.gfx.fillStyle(this.color, 0.4);
    this.gfx.fillRect(-this.w / 2, -this.h / 2, this.w, this.h);
    this.gfx.lineStyle(1.4, this.color, 1);
    this.gfx.strokeRect(-this.w / 2, -this.h / 2, this.w, this.h);
    this.gfx.fillStyle(0xffffff, 1);
    this.gfx.fillCircle(this.w / 2, 0, 1.6);
  }

  rect() {
    return { x: this.x - 5, y: this.y - 3, w: 10, h: 6 };
  }

  /**
   * @param {number} dt
   * @param {import('../physics/CollisionSystem.js').Platform[]} platforms
   * @param {import('./Player.js').Player} player
   * @param {number} now
   */
  tick(dt, platforms, player, now) {
    if (!this.alive) return;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.lifeMs -= dt * 1000;

    const r = this.rect();

    // платформа?
    for (const p of platforms) {
      if (rectsOverlap(r, p)) {
        this.kill();
        return;
      }
    }
    // игрок?
    if (player.alive && rectsOverlap(r, player.phys.rect())) {
      player.hurt(this.damage, this.x, now);
      this.kill();
      return;
    }

    if (this.lifeMs <= 0) this.kill();
  }

  kill() {
    if (!this.alive) return;
    this.alive = false;
    this.destroy();
  }
}
