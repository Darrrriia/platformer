import { COLOR, Z } from '../constants.js';

/**
 * Эффекты-частицы. Один инстанс на сцену. Создаёт несколько `ParticleEmitter`-ов
 * (по одному на тип события), переиспользует их через `emitParticleAt(x, y, count)`.
 * Фоновая текстура `px` создаётся в BootScene.
 *
 * Все эффекты используют `blendMode: 'ADD'` — суммирующее смешивание даёт
 * характерный неоновый «свет» поверх фона.
 */
export class EffectSystem {
  /** @param {Phaser.Scene} scene */
  constructor(scene) {
    this.scene = scene;

    /** Универсальные параметры эмиттеров. */
    const base = {
      blendMode: 'ADD',
      emitting: false,
    };

    /** Пыль при приземлении / шагах. */
    this.dust = scene.add.particles(0, 0, 'px', {
      ...base,
      lifespan: { min: 240, max: 380 },
      speedX: { min: -50, max: 50 },
      speedY: { min: -80, max: -20 },
      gravityY: 200,
      scale: { start: 1.4, end: 0.2 },
      alpha: { start: 0.6, end: 0 },
      tint: [0x9eaaff, 0xc15bff],
    });
    this.dust.setDepth(Z.particle);

    /** Искры при ударе атаки. */
    this.attackSparks = scene.add.particles(0, 0, 'px', {
      ...base,
      lifespan: { min: 220, max: 380 },
      speed: { min: 90, max: 220 },
      scale: { start: 1.6, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: [COLOR.attack, 0xffffff],
    });
    this.attackSparks.setDepth(Z.particle);

    /** Взрыв при сборе pickup. */
    this.pickupBurst = scene.add.particles(0, 0, 'px', {
      ...base,
      lifespan: { min: 260, max: 480 },
      speed: { min: 120, max: 240 },
      scale: { start: 2.0, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: [COLOR.pickup, COLOR.pickupCore],
    });
    this.pickupBurst.setDepth(Z.particle);

    /** Взрыв врага. */
    this.enemyBurst = scene.add.particles(0, 0, 'px', {
      ...base,
      lifespan: { min: 320, max: 600 },
      speed: { min: 140, max: 320 },
      gravityY: 120,
      scale: { start: 2.4, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: [COLOR.enemy, COLOR.attack, 0xffffff],
    });
    this.enemyBurst.setDepth(Z.particle);

    /** След за dash-ем. */
    this.dashTrail = scene.add.particles(0, 0, 'px', {
      ...base,
      lifespan: { min: 220, max: 360 },
      speedX: { min: -10, max: 10 },
      speedY: { min: -10, max: 10 },
      scale: { start: 2.0, end: 0 },
      alpha: { start: 0.7, end: 0 },
      tint: [COLOR.player, COLOR.playerTrail, COLOR.accent],
    });
    this.dashTrail.setDepth(Z.particle);

    /** Прыжок — короткий буст. */
    this.jumpBurst = scene.add.particles(0, 0, 'px', {
      ...base,
      lifespan: { min: 180, max: 280 },
      speedX: { min: -60, max: 60 },
      speedY: { min: -10, max: 80 },
      scale: { start: 1.4, end: 0 },
      alpha: { start: 0.7, end: 0 },
      tint: [COLOR.player, 0xffffff],
    });
    this.jumpBurst.setDepth(Z.particle);
  }

  spawnDust(x, y, count = 6) {
    this.dust.emitParticleAt(x, y, count);
  }
  spawnAttackSparks(x, y, count = 8) {
    this.attackSparks.emitParticleAt(x, y, count);
  }
  spawnPickupBurst(x, y, count = 14) {
    this.pickupBurst.emitParticleAt(x, y, count);
  }
  spawnEnemyExplosion(x, y, count = 18) {
    this.enemyBurst.emitParticleAt(x, y, count);
  }
  spawnDashTrail(x, y, count = 4) {
    this.dashTrail.emitParticleAt(x, y, count);
  }
  spawnJumpBurst(x, y, count = 6) {
    this.jumpBurst.emitParticleAt(x, y, count);
  }
}
