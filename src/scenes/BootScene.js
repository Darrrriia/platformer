import * as Phaser from 'phaser';
import { STORAGE } from '../constants.js';

/**
 * Стартовая сцена — читает рекорды из localStorage в registry,
 * генерирует общий пиксельный текстуру для частиц, переходит в меню.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create() {
    const bestScore = Number(localStorage.getItem(STORAGE.bestScore) ?? 0) || 0;
    const bestDepth = Number(localStorage.getItem(STORAGE.bestDepth) ?? 0) || 0;
    this.registry.set('bestScore', bestScore);
    this.registry.set('bestDepth', bestDepth);

    // Общая 4×4 белая текстура для частиц с blendMode: ADD.
    if (!this.textures.exists('px')) {
      const g = this.add.graphics({ x: 0, y: 0 });
      g.fillStyle(0xffffff, 1);
      g.fillRect(0, 0, 4, 4);
      g.generateTexture('px', 4, 4);
      g.destroy();
    }

    this.scene.start('MenuScene');
  }
}
