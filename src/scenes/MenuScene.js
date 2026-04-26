import * as Phaser from 'phaser';
import { COLOR } from '../constants.js';

/**
 * Главное меню. Заголовок, лучший рекорд, кнопка Start, помощь по управлению,
 * подсказки по механикам.
 *
 * Использует динамические размеры через `this.scale` — UI корректно ложится
 * на любой viewport (RESIZE-mode). При ресайзе окна — целиком пересобирается.
 */
export class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create() {
    // glow на всё
    const cam = this.cameras.main;
    if (cam.filters?.internal) {
      cam.filters.internal.addGlow({
        color: 0xffffff,
        outerStrength: 1.4,
        innerStrength: 0,
        distance: 10,
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

    this.input.keyboard.on('keydown-SPACE', () => this._start());
    this.input.keyboard.on('keydown-ENTER', () => this._start());
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

    // фон
    const bg = this.add.graphics();
    bg.fillStyle(COLOR.bgDeep, 1);
    bg.fillRect(0, 0, W, H);
    reg(bg);

    // декоративная сетка
    const decor = this.add.graphics();
    decor.lineStyle(1, COLOR.accent, 0.18);
    for (let i = 0; i < 14; i++) {
      const y = (i / 14) * H;
      decor.lineBetween(0, y, W, y);
    }
    decor.lineStyle(1, COLOR.player, 0.22);
    for (let i = 0; i < 16; i++) {
      const x = (i / 16) * W;
      decor.lineBetween(x, 0, x, H);
    }
    reg(decor);

    // рамка
    const frame = this.add.graphics();
    frame.lineStyle(2, COLOR.accent, 0.6);
    frame.strokeRect(24, 24, W - 48, H - 48);
    frame.lineStyle(1, COLOR.player, 0.4);
    frame.strokeRect(36, 36, W - 72, H - 72);
    reg(frame);

    // заголовок
    const title = this.add
      .text(cx, cy - 200, 'NEONFALL', {
        fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
        fontSize: '88px',
        fontStyle: 'bold',
        color: '#4dffd1',
        stroke: '#c15bff',
        strokeThickness: 2,
      })
      .setOrigin(0.5);
    reg(title);

    const subtitle = this.add
      .text(cx, cy - 130, 'neon roguelike platformer', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '20px',
        color: '#c15bff',
      })
      .setOrigin(0.5);
    reg(subtitle);

    const bestScore = this.registry.get('bestScore') ?? 0;
    const bestDepth = this.registry.get('bestDepth') ?? 0;
    const bestText = this.add
      .text(cx, cy - 80, `рекорд: ${bestScore} очков · глубина ${bestDepth}`, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '18px',
        color: '#8a85b8',
      })
      .setOrigin(0.5);
    reg(bestText);

    const startLabel = this.add
      .text(cx, cy - 20, '▸ НАЧАТЬ ИГРУ', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '32px',
        fontStyle: 'bold',
        color: '#9eff5a',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.tweens.add({
      targets: startLabel,
      alpha: { from: 1, to: 0.55 },
      duration: 700,
      yoyo: true,
      repeat: -1,
    });
    startLabel.on('pointerover', () => startLabel.setColor('#fff15a'));
    startLabel.on('pointerout', () => startLabel.setColor('#9eff5a'));
    startLabel.on('pointerdown', () => this._start());
    reg(startLabel);

    // блок управления
    const controls = this.add
      .text(
        cx,
        cy + 80,
        [
          'A / D или ← →   движение',
          'Space / W       прыжок · двойной',
          'Shift           рывок',
          'J / ЛКМ         атака',
          'P / Esc         пауза',
        ].join('\n'),
        {
          fontFamily: 'ui-monospace, "Cascadia Code", Consolas, monospace',
          fontSize: '15px',
          color: '#8a85b8',
          align: 'center',
          lineSpacing: 6,
        },
      )
      .setOrigin(0.5);
    reg(controls);

    // механики — в стиле «feature labels»
    const tips = this.add
      .text(
        cx,
        cy + 220,
        [
          'WALL JUMP     соскальзывание по стене и отскок',
          'DOUBLE JUMP   повторный прыжок в воздухе',
          'DASH          короткая фаза неуязвимости',
          'CLEAR         выход открывается, когда комната зачищена',
        ].join('\n'),
        {
          fontFamily: 'ui-monospace, "Cascadia Code", Consolas, monospace',
          fontSize: '13px',
          color: '#7e7aa6',
          align: 'left',
          lineSpacing: 6,
        },
      )
      .setOrigin(0.5);
    reg(tips);
  }

  _start() {
    this.scene.start('GameScene', { depth: 1, score: 0 });
    this.scene.launch('HUDScene');
  }
}
