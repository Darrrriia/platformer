import * as Phaser from 'phaser';
import { COLOR, PICKUP, Z } from '../constants.js';
import { rectsOverlap } from '../physics/CollisionSystem.js';

/**
 * Дата-фрагмент — собираемый ромб. Покачивается на месте, при касании игрока
 * исчезает с эффектом, начисляет очки.
 */
export class Pickup extends Phaser.GameObjects.Container {
  /** @param {Phaser.Scene} scene @param {{x:number,y:number}} pos */
  constructor(scene, pos) {
    super(scene, pos.x, pos.y);
    scene.add.existing(this);
    this.setDepth(Z.pickup);
    this.alive = true;
    this.startY = pos.y;
    this.t = Math.random() * Math.PI * 2;
    this.gfx = scene.add.graphics();
    this.add(this.gfx);
    this._draw();
  }

  /** AABB-rect для пересечений с игроком. */
  rect() {
    const s = PICKUP.size;
    return { x: this.x - s, y: this.y - s, w: s * 2, h: s * 2 };
  }

  _draw() {
    const s = PICKUP.size;
    this.gfx.clear();
    // тонкий ореол
    this.gfx.fillStyle(COLOR.pickup, 0.18);
    this.gfx.fillCircle(0, 0, s + 4);

    // сам ромб
    this.gfx.fillStyle(COLOR.pickup, 0.4);
    this.gfx.beginPath();
    this.gfx.moveTo(0, -s);
    this.gfx.lineTo(s, 0);
    this.gfx.lineTo(0, s);
    this.gfx.lineTo(-s, 0);
    this.gfx.closePath();
    this.gfx.fillPath();
    this.gfx.lineStyle(1.6, COLOR.pickup, 1);
    this.gfx.beginPath();
    this.gfx.moveTo(0, -s);
    this.gfx.lineTo(s, 0);
    this.gfx.lineTo(0, s);
    this.gfx.lineTo(-s, 0);
    this.gfx.closePath();
    this.gfx.strokePath();

    // ядро
    this.gfx.fillStyle(COLOR.pickupCore, 1);
    this.gfx.fillCircle(0, 0, 2.5);
  }

  /**
   * @param {number} dt
   * @param {import('./Player.js').Player} player
   */
  tick(dt, player) {
    if (!this.alive) return;
    this.t += dt * PICKUP.bobFreqHz * Math.PI * 2;
    this.y = this.startY + Math.sin(this.t) * PICKUP.bobAmpl;
    this.rotation = Math.sin(this.t * 0.5) * 0.15;

    if (rectsOverlap(this.rect(), player.phys.rect())) {
      this.collect();
    }
  }

  collect() {
    if (!this.alive) return;
    this.alive = false;
    this.scene.events.emit('pickup:collected', {
      x: this.x,
      y: this.y,
      value: PICKUP.scoreValue,
    });
    this.destroy();
  }
}
