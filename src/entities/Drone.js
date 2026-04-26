import { Enemy } from './Enemy.js';
import { COLOR, ENEMY } from '../constants.js';

/**
 * Летающий враг. Игнорирует гравитацию. Двигается к игроку по горизонтали
 * с медленной скоростью и колеблется по вертикали (sin от времени).
 *
 * Графика — треугольник остриём вниз с обводкой и глазом.
 */
export class Drone extends Enemy {
  /** @param {Phaser.Scene} scene @param {{x:number,y:number}} pos */
  constructor(scene, pos) {
    const cfg = ENEMY.drone;
    super(scene, {
      x: pos.x,
      y: pos.y,
      w: cfg.width,
      h: cfg.height,
      hp: cfg.hp,
      gravity: 0,
      contactDamage: cfg.contactDamage,
      scoreReward: 5,
    });
    this.bobPhase = Math.random() * Math.PI * 2;
    this.spawnY = pos.y;
  }

  thinkAi({ player, dt, now }) {
    const cfg = ENEMY.drone;
    // движение к игроку по X с лёгким сглаживанием
    const dx = player.phys.cx - this.phys.cx;
    const dir = Math.sign(dx) || this.facing;
    this.facing = dir;
    const target = dir * cfg.speed;
    this.phys.vx += (target - this.phys.vx) * Math.min(1, 4 * dt);

    // колебания по Y вокруг spawnY с +/- амплитудой,
    // плюс лёгкое подтягивание к высоте игрока
    this.bobPhase += cfg.bobFreq * dt * Math.PI * 2;
    const bob = Math.sin(this.bobPhase) * cfg.bobAmpl;
    const desiredY = (this.spawnY + player.phys.cy - player.phys.h / 2) / 2 + bob - this.phys.h / 2;
    const dy = desiredY - this.phys.y;
    this.phys.vy = dy * 3.5;
  }

  redraw() {
    this.gfx.clear();
    const w = this.phys.w;
    const h = this.phys.h;
    const flash = this.scene.time.now < this.hurtFlashUntil;
    const tint = flash ? 0xffffff : COLOR.enemy;

    // треугольник
    this.gfx.fillStyle(tint, 0.18);
    this.gfx.beginPath();
    this.gfx.moveTo(-w / 2, -h / 2);
    this.gfx.lineTo(w / 2, -h / 2);
    this.gfx.lineTo(0, h / 2);
    this.gfx.closePath();
    this.gfx.fillPath();
    this.gfx.lineStyle(2, tint, 1);
    this.gfx.beginPath();
    this.gfx.moveTo(-w / 2, -h / 2);
    this.gfx.lineTo(w / 2, -h / 2);
    this.gfx.lineTo(0, h / 2);
    this.gfx.closePath();
    this.gfx.strokePath();

    // глаз
    this.gfx.fillStyle(0xffffff, 1);
    this.gfx.fillCircle(this.facing * 4, -2, 2.5);
    this.gfx.fillStyle(0x07060f, 1);
    this.gfx.fillCircle(this.facing * 4, -2, 1.2);
  }
}
