import { Entity } from './Entity.js';
import { Z, EVT } from '../constants.js';

/**
 * Базовый класс врага. Наследники (Drone, Slasher, Sentinel) переопределяют
 * `thinkAi(ctx)` и `redraw()`.
 *
 * Общее поведение:
 *   - hp, контактный урон, knockback при попадании
 *   - короткий «hurt»-флешь после удара
 *   - `die()` — эффект, событие `enemy:killed`, удаление сущности
 */
export class Enemy extends Entity {
  /**
   * @param {Phaser.Scene} scene
   * @param {object} cfg
   * @param {number} cfg.x
   * @param {number} cfg.y
   * @param {number} cfg.w
   * @param {number} cfg.h
   * @param {number} cfg.hp
   * @param {number} [cfg.gravity]
   * @param {number} [cfg.contactDamage]
   * @param {number} [cfg.scoreReward]
   */
  constructor(scene, cfg) {
    super(scene, cfg);
    this.setDepth(Z.enemy);
    this.hp = cfg.hp;
    this.contactDamage = cfg.contactDamage ?? 0;
    this.scoreReward = cfg.scoreReward ?? 5;
    this.facing = 1;
    this.hurtFlashUntil = 0;
  }

  /**
   * Получить урон. Возвращает true, если убит.
   * @param {number} amount
   * @param {number} fromX
   * @param {number} now
   */
  hurt(amount, fromX, now) {
    if (!this.alive) return false;
    this.hp -= amount;
    this.hurtFlashUntil = now + 110;
    // лёгкий knockback (если у врага есть гравитация — заметнее)
    const dir = this.phys.cx < fromX ? -1 : 1;
    this.phys.vx += dir * 140;
    if (this.phys.gravity > 0) this.phys.vy = Math.min(this.phys.vy, -120);
    this.dirty = true;
    if (this.hp <= 0) {
      this.die(now);
      return true;
    }
    return false;
  }

  /** @param {number} _now */
  die(_now) {
    this.alive = false;
    this.scene.events.emit(EVT.enemyKilled, {
      x: this.phys.cx,
      y: this.phys.cy,
      reward: this.scoreReward,
    });
    this.scene.events.emit('enemy:explode', { x: this.phys.cx, y: this.phys.cy });
    this.destroy();
  }

  /**
   * Шаг AI. Вызывается из GameScene до physics step.
   * @param {object} _ctx
   * @param {import('./Player.js').Player} _ctx.player
   * @param {number} _ctx.dt
   * @param {number} _ctx.now
   */
  thinkAi(_ctx) {
    /* override */
  }

  /**
   * Один тик: AI → physics → синхронизация → перерисовка.
   * @param {object} ctx
   * @param {import('./Player.js').Player} ctx.player
   * @param {number} ctx.dt
   * @param {number} ctx.now
   * @param {import('../physics/CollisionSystem.js').Platform[]} ctx.platforms
   */
  tick(ctx) {
    if (!this.alive) return;
    this.thinkAi(ctx);
    this.phys.step(ctx.dt, ctx.platforms);
    this.syncFromBody();
    this.redraw();
  }
}
