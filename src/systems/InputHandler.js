import * as Phaser from 'phaser';

const KC = Phaser.Input.Keyboard.KeyCodes;
const JustDown = Phaser.Input.Keyboard.JustDown;

/**
 * Тонкая обёртка над Phaser.Input.Keyboard.
 *
 * Идея: вся игровая логика читает «семантические» геттеры (`left`, `jumpJustDown`),
 * не зная конкретные клавиши. Это упрощает Player.update и легко расширяется
 * (например, ремаппингом в будущем).
 *
 * `JustDown` возвращает true ровно один раз на нажатие — идеально для прыжка/dash/атаки.
 * `isDown` — для непрерывных действий (движение).
 */
export class InputHandler {
  /** @param {Phaser.Scene} scene */
  constructor(scene) {
    const k = scene.input.keyboard;

    // Захват — чтобы стрелки/Space не скроллили страницу.
    k.addCapture('W,A,S,D,SPACE,SHIFT,J,P,ESC,UP,LEFT,RIGHT,DOWN,ENTER');

    this.keys = k.addKeys({
      W: KC.W,
      A: KC.A,
      S: KC.S,
      D: KC.D,
      UP: KC.UP,
      LEFT: KC.LEFT,
      RIGHT: KC.RIGHT,
      DOWN: KC.DOWN,
      SPACE: KC.SPACE,
      SHIFT: KC.SHIFT,
      J: KC.J,
      P: KC.P,
      ESC: KC.ESC,
    });

    this._scene = scene;
    this._mouseLeftJustDown = false;
    this._mouseLeftIsDown = false;

    scene.input.on(
      Phaser.Input.Events.POINTER_DOWN,
      /** @param {Phaser.Input.Pointer} p */
      (p) => {
        if (p.leftButtonDown()) {
          this._mouseLeftJustDown = true;
          this._mouseLeftIsDown = true;
        }
      },
    );
    scene.input.on(
      Phaser.Input.Events.POINTER_UP,
      /** @param {Phaser.Input.Pointer} p */
      (p) => {
        if (!p.leftButtonDown()) this._mouseLeftIsDown = false;
      },
    );
  }

  /** Должен вызываться один раз В КОНЦЕ кадра — сбрасывает «just down» по мыши. */
  endFrame() {
    this._mouseLeftJustDown = false;
  }

  // ─────────── движение ───────────
  get left() {
    return this.keys.A.isDown || this.keys.LEFT.isDown;
  }
  get right() {
    return this.keys.D.isDown || this.keys.RIGHT.isDown;
  }
  get down() {
    return this.keys.S.isDown || this.keys.DOWN.isDown;
  }

  // ─────────── действия ───────────
  get jumpJustDown() {
    return JustDown(this.keys.SPACE) || JustDown(this.keys.W) || JustDown(this.keys.UP);
  }
  get jumpIsDown() {
    return this.keys.SPACE.isDown || this.keys.W.isDown || this.keys.UP.isDown;
  }
  get dashJustDown() {
    return JustDown(this.keys.SHIFT);
  }
  get attackJustDown() {
    return JustDown(this.keys.J) || this._mouseLeftJustDown;
  }
  get pauseJustDown() {
    return JustDown(this.keys.P) || JustDown(this.keys.ESC);
  }
}
