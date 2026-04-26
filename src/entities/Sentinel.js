import { Enemy } from './Enemy.js';
import { COLOR, ENEMY } from '../constants.js';
import { Projectile } from './Projectile.js';

/**
 * Стационарный страж. Стоит на платформе, поворачивается к игроку,
 * каждые `fireIntervalMs` стреляет лазером в направлении игрока.
 *
 * Графика — квадрат с обводкой и большим круглым «глазом», который двигается за игроком.
 */
export class Sentinel extends Enemy {
  /** @param {Phaser.Scene} scene @param {{x:number,y:number}} pos */
  constructor(scene, pos) {
    const cfg = ENEMY.sentinel;
    super(scene, {
      x: pos.x,
      y: pos.y,
      w: cfg.width,
      h: cfg.height,
      hp: cfg.hp,
      contactDamage: 0,
      scoreReward: 15,
    });
    this.fireCooldown = cfg.fireIntervalMs / 1000;
    this.eyeAngle = 0;
  }

  thinkAi({ player, dt, now }) {
    const cfg = ENEMY.sentinel;

    this.phys.vx = 0;

    const dx = player.phys.cx - this.phys.cx;
    const dy = player.phys.cy - this.phys.cy;
    const dist = Math.hypot(dx, dy);
    this.facing = Math.sign(dx) || this.facing;
    this.eyeAngle = Math.atan2(dy, dx);

    if (dist > cfg.sightRange) {
      this.fireCooldown = Math.min(this.fireCooldown, 0.6);
      return;
    }

    this.fireCooldown -= dt;
    if (this.fireCooldown <= 0) {
      this.fireCooldown = cfg.fireIntervalMs / 1000;
      // выстрел в направлении игрока
      const a = Math.atan2(dy, dx);
      const speed = cfg.laserSpeed;
      const px = this.phys.cx + Math.cos(a) * 22;
      const py = this.phys.cy + Math.sin(a) * 22;
      const proj = new Projectile(this.scene, {
        x: px,
        y: py,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        damage: cfg.laserDamage,
        color: COLOR.laser,
      });
      this.scene.events.emit('sentinel:fire', { proj, x: px, y: py });
    }
  }

  redraw() {
    this.gfx.clear();
    const w = this.phys.w;
    const h = this.phys.h;
    const flash = this.scene.time.now < this.hurtFlashUntil;
    const tint = flash ? 0xffffff : COLOR.enemy;

    // корпус — квадрат
    this.gfx.fillStyle(tint, 0.14);
    this.gfx.fillRoundedRect(-w / 2, -h / 2, w, h, 4);
    this.gfx.lineStyle(2, tint, 1);
    this.gfx.strokeRoundedRect(-w / 2, -h / 2, w, h, 4);

    // глаз: окружность + зрачок в направлении игрока
    this.gfx.fillStyle(0x000000, 0.5);
    this.gfx.fillCircle(0, 0, 9);
    this.gfx.lineStyle(1.5, tint, 1);
    this.gfx.strokeCircle(0, 0, 9);

    const px = Math.cos(this.eyeAngle) * 4;
    const py = Math.sin(this.eyeAngle) * 4;
    this.gfx.fillStyle(COLOR.laser, 1);
    this.gfx.fillCircle(px, py, 3.5);

    // готовность стрелять — лёгкое свечение в углах
    if (this.fireCooldown < 0.35) {
      this.gfx.fillStyle(COLOR.laser, 0.8);
      this.gfx.fillCircle(-w / 2 + 3, -h / 2 + 3, 1.5);
      this.gfx.fillCircle(w / 2 - 3, -h / 2 + 3, 1.5);
      this.gfx.fillCircle(-w / 2 + 3, h / 2 - 3, 1.5);
      this.gfx.fillCircle(w / 2 - 3, h / 2 - 3, 1.5);
    }
  }
}
