import * as Phaser from 'phaser';
import { COLOR, EVT, PLAYER, Z, STORAGE } from '../constants.js';

/**
 * HUD-сцена. Запускается параллельно GameScene через `scene.launch('HUDScene')`.
 * Подписывается на game-level события (game.events) — они переживают
 * `scene.restart('GameScene')` без переподписки.
 *
 * Все позиции UI рассчитываются от `this.scale.width/height` и пересчитываются
 * при ресайзе окна.
 *
 * Состав:
 *  - HP-сегменты слева сверху
 *  - Счёт справа сверху
 *  - Глубина по центру сверху
 *  - Лучший рекорд справа снизу
 *  - Pause-оверлей с кнопкой «в меню»
 */
export class HUDScene extends Phaser.Scene {
  constructor() {
    super('HUDScene');
  }

  create() {
    this.hp = PLAYER.hpMax;
    this.score = 0;
    this.depthLevel = 1;
    this._pauseListenersOn = false;

    this.hpGfx = this.add.graphics().setDepth(Z.fxFront);

    this.hpLabel = this.add
      .text(28, 50, 'HP', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '11px',
        color: '#8a85b8',
        letterSpacing: 2,
      })
      .setDepth(Z.fxFront);

    this.scoreText = this.add
      .text(0, 22, '0', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '36px',
        fontStyle: 'bold',
        color: '#4dffd1',
        stroke: '#0d3a32',
        strokeThickness: 3,
      })
      .setOrigin(1, 0)
      .setDepth(Z.fxFront);

    this.scoreLabel = this.add
      .text(0, 64, 'счёт', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '12px',
        color: '#8a85b8',
        letterSpacing: 2,
      })
      .setOrigin(1, 0)
      .setDepth(Z.fxFront);

    this.depthText = this.add
      .text(0, 26, 'КОМНАТА 1', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '20px',
        fontStyle: 'bold',
        color: '#c15bff',
        stroke: '#2a0d44',
        strokeThickness: 2,
      })
      .setOrigin(0.5, 0)
      .setDepth(Z.fxFront);

    const bs = Number(localStorage.getItem(STORAGE.bestScore) ?? 0) || 0;
    const bd = Number(localStorage.getItem(STORAGE.bestDepth) ?? 0) || 0;
    this.bestText = this.add
      .text(0, 0, `рекорд: ${bs} · ${bd}`, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '12px',
        color: '#8a85b8',
      })
      .setOrigin(1, 1)
      .setDepth(Z.fxFront);

    this._buildPauseOverlay();
    this._layout();
    this._drawHp();

    // ── подписка на game.events
    const ge = this.game.events;
    const onScore = (s) => {
      this.score = s;
      this.scoreText.setText(String(s));
      this._pulseText(this.scoreText);
    };
    const onHp = (h) => {
      this.hp = h;
      this._drawHp();
    };
    const onDepth = (d) => {
      this.depthLevel = d;
      this.depthText.setText(`КОМНАТА ${d}`);
      this._pulseText(this.depthText);
    };
    const onPaused = () => {
      this.pauseOverlay.setVisible(true);
      this._pauseListenersOn = true;
    };
    const onResumed = () => {
      this.pauseOverlay.setVisible(false);
      this._pauseListenersOn = false;
    };

    ge.on(EVT.scoreChanged, onScore);
    ge.on(EVT.hpChanged, onHp);
    ge.on(EVT.depthChanged, onDepth);
    ge.on(EVT.paused, onPaused);
    ge.on(EVT.resumed, onResumed);

    // resume по P/Esc, выход в меню по M — только когда показан pause-оверлей
    this.input.keyboard.on('keydown-P', () => this._tryResume());
    this.input.keyboard.on('keydown-ESC', () => this._tryResume());
    this.input.keyboard.on('keydown-M', () => this._tryGoMenu());

    // resize → перепозиционировать
    this.scale.on('resize', this._onResize, this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      ge.off(EVT.scoreChanged, onScore);
      ge.off(EVT.hpChanged, onHp);
      ge.off(EVT.depthChanged, onDepth);
      ge.off(EVT.paused, onPaused);
      ge.off(EVT.resumed, onResumed);
      this.scale.off('resize', this._onResize, this);
    });
  }

  _buildPauseOverlay() {
    this.pauseOverlay = this.add.container(0, 0).setDepth(Z.fxFront).setVisible(false);
    this.pauseDim = this.add.rectangle(0, 0, 100, 100, 0x000000, 0.55).setOrigin(0);
    const pauseText = this.add
      .text(0, -40, 'ПАУЗА', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '64px',
        fontStyle: 'bold',
        color: '#fff15a',
      })
      .setOrigin(0.5);
    const resumeHint = this.add
      .text(0, 30, 'P / Esc — продолжить', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '18px',
        color: '#cfcae8',
      })
      .setOrigin(0.5);

    const menuHint = this.add
      .text(0, 64, 'M — выйти в главное меню', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '16px',
        color: '#8a85b8',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    menuHint.on('pointerover', () => menuHint.setColor('#9eff5a'));
    menuHint.on('pointerout', () => menuHint.setColor('#8a85b8'));
    menuHint.on('pointerdown', () => this._tryGoMenu());

    this._pauseTextNode = pauseText;
    this._pauseResumeNode = resumeHint;
    this._pauseMenuNode = menuHint;
    this.pauseOverlay.add([this.pauseDim, pauseText, resumeHint, menuHint]);
  }

  _onResize() {
    this._layout();
    this._drawHp();
  }

  _layout() {
    const W = this.scale.width;
    const H = this.scale.height;

    this.scoreText.setPosition(W - 24, 22);
    this.scoreLabel.setPosition(W - 24, 64);
    this.depthText.setPosition(W / 2, 26);
    this.bestText.setPosition(W - 18, H - 18);

    // pause-overlay центрируется
    this.pauseDim.setSize(W, H);
    this.pauseDim.setPosition(0, 0);
    this._pauseTextNode.setPosition(W / 2, H / 2 - 40);
    this._pauseResumeNode.setPosition(W / 2, H / 2 + 30);
    this._pauseMenuNode.setPosition(W / 2, H / 2 + 64);
  }

  _drawHp() {
    const g = this.hpGfx;
    g.clear();
    const baseX = 28;
    const baseY = 28;
    const step = 28;
    const r = 10;
    for (let i = 0; i < PLAYER.hpMax; i++) {
      const cx = baseX + i * step;
      const cy = baseY + 4;
      const filled = i < this.hp;
      const c = filled ? COLOR.hpFull : COLOR.hpEmpty;
      g.fillStyle(c, filled ? 0.4 : 0.18);
      g.beginPath();
      g.moveTo(cx, cy - r);
      g.lineTo(cx + r, cy);
      g.lineTo(cx, cy + r);
      g.lineTo(cx - r, cy);
      g.closePath();
      g.fillPath();
      g.lineStyle(1.6, c, filled ? 1 : 0.5);
      g.beginPath();
      g.moveTo(cx, cy - r);
      g.lineTo(cx + r, cy);
      g.lineTo(cx, cy + r);
      g.lineTo(cx - r, cy);
      g.closePath();
      g.strokePath();
      if (filled) {
        g.fillStyle(0xffffff, 0.9);
        g.fillCircle(cx, cy, 1.6);
      }
    }
  }

  _tryResume() {
    if (!this._pauseListenersOn) return;
    /** @type {import('./GameScene.js').GameScene | null} */
    // @ts-ignore — динамический lookup сцены
    const gs = this.scene.get('GameScene');
    if (gs) gs.paused = false;
    this.scene.resume('GameScene');
    this.game.events.emit(EVT.resumed);
  }

  _tryGoMenu() {
    if (!this._pauseListenersOn) return;
    // снять флаг и резюмить, чтобы не остаться в pause-state навсегда
    this.game.events.emit(EVT.resumed);
    this.scene.stop('GameScene');
    this.scene.start('MenuScene');
    this.scene.stop(); // self — последним, чтобы не оборвать start выше
  }

  /** @param {Phaser.GameObjects.Text} target */
  _pulseText(target) {
    target.setScale(1.2);
    this.tweens.add({
      targets: target,
      scale: 1,
      duration: 200,
      ease: 'Cubic.easeOut',
    });
  }
}
