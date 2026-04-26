import * as Phaser from 'phaser';
import { COLOR, STORAGE } from '../constants.js';

/**
 * Экран после смерти. Финальный счёт, рекорд, рестарт, в меню.
 * UI динамически адаптируется под размер canvas (RESIZE-mode).
 */
export class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOverScene');
  }

  /** @param {{ score: number, depth: number, newScore?: boolean, newDepth?: boolean }} data */
  init(data) {
    this.finalScore = data?.score ?? 0;
    this.finalDepth = data?.depth ?? 0;
    this.isNewRecord = !!(data?.newScore || data?.newDepth);
    this.bestScore = Number(localStorage.getItem(STORAGE.bestScore) ?? 0) || 0;
    this.bestDepth = Number(localStorage.getItem(STORAGE.bestDepth) ?? 0) || 0;
    this.registry.set('bestScore', this.bestScore);
    this.registry.set('bestDepth', this.bestDepth);
    this.registry.remove('scoreSystem');
  }

  create() {
    this.cameras.main.setBackgroundColor(COLOR.bgDeep);
    this.cameras.main.fadeIn(280, 7, 6, 15);

    const cam = this.cameras.main;
    if (cam.filters?.internal) {
      cam.filters.internal.addGlow({
        color: 0xffffff,
        outerStrength: 1.2,
        innerStrength: 0,
        distance: 8,
        quality: 0.1,
      });
    }

    /** @type {Phaser.GameObjects.GameObject[]} */
    this._layoutObjects = [];
    this._layout();

    this.scale.on('resize', this._onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this._onResize, this);
    });

    this.input.keyboard.once('keydown-SPACE', () => this._restart());
    this.input.keyboard.once('keydown-ENTER', () => this._restart());
    this.input.keyboard.once('keydown-ESC', () => this.scene.start('MenuScene'));
  }

  _onResize() {
    for (const o of this._layoutObjects) o.destroy();
    this._layoutObjects.length = 0;
    this._layout();
  }

  _layout() {
    const W = this.scale.width;
    const H = this.scale.height;
    const cx = W / 2;
    const cy = H / 2;
    const reg = (...objs) => this._layoutObjects.push(...objs);

    // декор-линии (тоньше, «битый» интерфейс)
    const decor = this.add.graphics();
    decor.lineStyle(1, COLOR.enemy, 0.2);
    for (let i = 0; i < 24; i++) {
      const y = (i / 24) * H;
      decor.lineBetween(0, y, W, y);
    }
    reg(decor);

    reg(
      this.add
        .text(cx, cy - 140, 'СИСТЕМА ОТКЛЮЧЕНА', {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '56px',
          fontStyle: 'bold',
          color: '#ff3d6e',
        })
        .setOrigin(0.5),
    );
    reg(
      this.add
        .text(cx, cy - 60, `счёт: ${this.finalScore}`, {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '32px',
          color: '#4dffd1',
        })
        .setOrigin(0.5),
    );
    reg(
      this.add
        .text(cx, cy - 20, `глубина: ${this.finalDepth}`, {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '24px',
          color: '#c15bff',
        })
        .setOrigin(0.5),
    );

    if (this.isNewRecord) {
      const star = this.add
        .text(cx, cy + 20, '★ НОВЫЙ РЕКОРД ★', {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '22px',
          fontStyle: 'bold',
          color: '#fff15a',
        })
        .setOrigin(0.5);
      this.tweens.add({
        targets: star,
        alpha: { from: 1, to: 0.45 },
        duration: 600,
        yoyo: true,
        repeat: -1,
      });
      reg(star);
    } else {
      reg(
        this.add
          .text(cx, cy + 20, `рекорд: ${this.bestScore} · ${this.bestDepth}`, {
            fontFamily: 'system-ui, sans-serif',
            fontSize: '18px',
            color: '#8a85b8',
          })
          .setOrigin(0.5),
      );
    }

    const restart = this.add
      .text(cx, cy + 90, '▸ ЕЩЁ РАЗ', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '28px',
        color: '#9eff5a',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    restart.on('pointerover', () => restart.setColor('#fff15a'));
    restart.on('pointerout', () => restart.setColor('#9eff5a'));
    restart.on('pointerdown', () => this._restart());
    reg(restart);

    const menu = this.add
      .text(cx, cy + 140, 'в меню', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '20px',
        color: '#8a85b8',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    menu.on('pointerover', () => menu.setColor('#eaeaff'));
    menu.on('pointerout', () => menu.setColor('#8a85b8'));
    menu.on('pointerdown', () => this.scene.start('MenuScene'));
    reg(menu);
  }

  _restart() {
    this.scene.start('GameScene', { depth: 1, score: 0 });
    this.scene.launch('HUDScene');
  }
}
