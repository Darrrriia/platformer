import { Enemy } from './Enemy.js';
import { COLOR, ENEMY } from '../constants.js';
import { rectsOverlap } from '../physics/CollisionSystem.js';

/**
 * Наземный враг. Патрулирует платформу. При виде игрока (по X на расстоянии) —
 * переключается в chase, добежав до короткой дистанции — atttack-state с выпадом
 * (короткий хитбокс с уроном).
 *
 * Состояния AI: 'patrol' | 'chase' | 'windup' | 'strike' | 'recover'.
 *
 * Графика — высокий ромб с зубцом-«клинком» в направлении движения.
 */
export class Slasher extends Enemy {
  /** @param {Phaser.Scene} scene @param {{x:number,y:number}} pos */
  constructor(scene, pos) {
    const cfg = ENEMY.slasher;
    super(scene, {
      x: pos.x,
      y: pos.y,
      w: cfg.width,
      h: cfg.height,
      hp: cfg.hp,
      contactDamage: cfg.contactDamage,
      scoreReward: 10,
    });
    /** @type {'patrol'|'chase'|'windup'|'strike'|'recover'} */
    this.aiState = 'patrol';
    this.aiTimer = 0;
    this.facing = Math.random() < 0.5 ? -1 : 1;
    this.patrolEdgeCooldown = 0;
  }

  /** Хитбокс выпада в мировых координатах. */
  strikeHitbox() {
    const w = 38;
    const h = this.phys.h - 6;
    const x = this.facing > 0 ? this.phys.x + this.phys.w : this.phys.x - w;
    const y = this.phys.y + 3;
    return { x, y, w, h };
  }

  thinkAi({ player, dt, now, platforms }) {
    const cfg = ENEMY.slasher;

    // сменился at end of platform / уперся в стену
    if (this.aiState === 'patrol') {
      // если есть стена в направлении движения или нет пола впереди — разворот
      if (this.phys.onWall === this.facing) {
        this.facing = -this.facing;
      } else if (this.phys.onGround && this.patrolEdgeCooldown <= 0) {
        // raycast «есть ли платформа на расстоянии шага вперёд?»
        const probe = {
          x: this.phys.x + (this.facing > 0 ? this.phys.w + 2 : -6),
          y: this.phys.y + this.phys.h + 2,
          w: 4,
          h: 6,
        };
        let supported = false;
        for (const p of platforms) {
          if (rectsOverlap(probe, p)) {
            supported = true;
            break;
          }
        }
        if (!supported) {
          this.facing = -this.facing;
          this.patrolEdgeCooldown = 0.25;
        }
      }
      this.patrolEdgeCooldown = Math.max(0, this.patrolEdgeCooldown - dt);

      this.phys.vx = this.facing * cfg.patrolSpeed;

      // увидел игрока?
      const dx = player.phys.cx - this.phys.cx;
      const dy = Math.abs(player.phys.cy - this.phys.cy);
      if (Math.abs(dx) < cfg.sightRange && dy < 80) {
        this.aiState = 'chase';
        this.facing = Math.sign(dx) || this.facing;
      }
      return;
    }

    if (this.aiState === 'chase') {
      const dx = player.phys.cx - this.phys.cx;
      const dist = Math.abs(dx);
      this.facing = Math.sign(dx) || this.facing;
      this.phys.vx = this.facing * cfg.chaseSpeed;

      if (dist > cfg.sightRange * 1.4) {
        this.aiState = 'patrol';
        return;
      }
      if (dist < cfg.attackRange && Math.abs(player.phys.cy - this.phys.cy) < 60) {
        this.aiState = 'windup';
        this.aiTimer = cfg.attackWindupMs / 1000;
        this.phys.vx = 0;
      }
      return;
    }

    if (this.aiState === 'windup') {
      this.phys.vx = 0;
      this.aiTimer -= dt;
      if (this.aiTimer <= 0) {
        this.aiState = 'strike';
        // короткий выпад вперёд
        this.phys.vx = this.facing * cfg.chaseSpeed * 0.7;
        this.aiTimer = 0.18;
        // нанесём урон в момент удара
        if (rectsOverlap(this.strikeHitbox(), player.phys.rect())) {
          player.hurt(cfg.contactDamage, this.phys.cx, now);
        }
      }
      return;
    }

    if (this.aiState === 'strike') {
      this.aiTimer -= dt;
      if (this.aiTimer <= 0) {
        this.phys.vx = 0;
        this.aiState = 'recover';
        this.aiTimer = cfg.attackRecoverMs / 1000;
      }
      return;
    }

    if (this.aiState === 'recover') {
      this.phys.vx = 0;
      this.aiTimer -= dt;
      if (this.aiTimer <= 0) this.aiState = 'chase';
      return;
    }
  }

  redraw() {
    this.gfx.clear();
    const w = this.phys.w;
    const h = this.phys.h;
    const flash = this.scene.time.now < this.hurtFlashUntil;
    const tint = flash ? 0xffffff : COLOR.enemy;

    // тело — ромб
    this.gfx.fillStyle(tint, 0.16);
    this.gfx.beginPath();
    this.gfx.moveTo(0, -h / 2);
    this.gfx.lineTo(w / 2, 0);
    this.gfx.lineTo(0, h / 2);
    this.gfx.lineTo(-w / 2, 0);
    this.gfx.closePath();
    this.gfx.fillPath();
    this.gfx.lineStyle(2, tint, 1);
    this.gfx.beginPath();
    this.gfx.moveTo(0, -h / 2);
    this.gfx.lineTo(w / 2, 0);
    this.gfx.lineTo(0, h / 2);
    this.gfx.lineTo(-w / 2, 0);
    this.gfx.closePath();
    this.gfx.strokePath();

    // клинок (направление взгляда)
    const tip = this.facing * (w / 2 + 12);
    this.gfx.lineStyle(2, COLOR.attack, this.aiState === 'windup' ? 1 : 0.5);
    this.gfx.lineBetween(0, 0, tip, 0);

    // глаз
    this.gfx.fillStyle(0xffffff, 1);
    this.gfx.fillCircle(this.facing * 5, -3, 2);
  }
}
