import * as Phaser from 'phaser';
import { PhysicsBody } from '../physics/PhysicsBody.js';

/**
 * Базовый класс игровой сущности.
 *
 * Внутри — `Phaser.GameObjects.Container`, чтобы рендериться в сцене и иметь общий depth/scale.
 * Графика (Phaser.Graphics) живёт как ребёнок контейнера — переопределить `redraw()`
 * в наследнике, чтобы нарисовать свой неоновый силуэт.
 *
 * Физика — наш `PhysicsBody`. На каждом кадре:
 *   1. AI/ввод меняет body.vx / body.vy
 *   2. body.step(dt, platforms) разрешает коллизии
 *   3. контейнер синхронизируется с центром body
 *
 * Контейнер позиционируется в ЦЕНТРЕ AABB-тела — так удобнее flip-анимировать
 * и применять FX.
 */
export class Entity extends Phaser.GameObjects.Container {
  /**
   * @param {Phaser.Scene} scene
   * @param {object} cfg
   * @param {number} cfg.x  левая верхняя координата AABB
   * @param {number} cfg.y
   * @param {number} cfg.w
   * @param {number} cfg.h
   * @param {number} [cfg.gravity]
   */
  constructor(scene, cfg) {
    super(scene, cfg.x + cfg.w / 2, cfg.y + cfg.h / 2);
    this.phys = new PhysicsBody(cfg);
    this.gfx = scene.add.graphics();
    this.add(this.gfx);
    /** Жив ли — не удалён ли с поля. */
    this.alive = true;
    /** Флаг, что нужно перерисовать графику в этом кадре. */
    this.dirty = true;

    scene.add.existing(this);
  }

  /** Синхронизирует Container.x/y с центром PhysicsBody. */
  syncFromBody() {
    this.x = this.phys.x + this.phys.w / 2;
    this.y = this.phys.y + this.phys.h / 2;
  }

  /** Переопределяется в наследниках. Графика рисуется в this.gfx, центр — (0,0). */
  redraw() {
    /* override */
  }

  /**
   * Один тик логики. Базовая реализация — только физика и синхронизация.
   * Наследник переопределяет (и обычно вызывает super.update в конце).
   *
   * @param {number} dt секунды
   * @param {import('../physics/CollisionSystem.js').Platform[]} platforms
   */
  update(dt, platforms) {
    this.phys.step(dt, platforms);
    this.syncFromBody();
    if (this.dirty) {
      this.gfx.clear();
      this.redraw();
      this.dirty = false;
    }
  }

  destroy(fromScene) {
    this.alive = false;
    super.destroy(fromScene);
  }
}
