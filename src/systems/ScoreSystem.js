import { STORAGE, EVT } from '../constants.js';

/**
 * Управление счётом и глубиной. Хранит текущие значения раунда и обновляет
 * рекорды в `localStorage`. Эмитит события через game-level emitter (Phaser.Game.events) —
 * это позволяет HUD-сцене подписаться один раз и переживать `scene.restart('GameScene')`
 * без переподписки.
 *
 * Один инстанс на партию — создаётся в GameScene при старте, переживает
 * переходы между комнатами через сохранение в registry.
 */
export class ScoreSystem {
  /** @param {Phaser.Events.EventEmitter} emitter обычно `game.events` */
  constructor(emitter) {
    this.emitter = emitter;
    this.score = 0;
    this.depth = 0;
    this.bestScore = Number(localStorage.getItem(STORAGE.bestScore) ?? 0) || 0;
    this.bestDepth = Number(localStorage.getItem(STORAGE.bestDepth) ?? 0) || 0;
  }

  /** Сбросить состояние раунда (вызывается при рестарте). */
  reset() {
    this.score = 0;
    this.depth = 0;
    this.emitter.emit(EVT.scoreChanged, this.score);
    this.emitter.emit(EVT.depthChanged, this.depth);
  }

  /** @param {number} amount */
  addScore(amount) {
    this.score += amount;
    this.emitter.emit(EVT.scoreChanged, this.score);
  }

  /** @param {number} d */
  setDepth(d) {
    this.depth = d;
    this.emitter.emit(EVT.depthChanged, this.depth);
  }

  /** Сохранить рекорды (если новые больше прежних). Возвращает {newScore, newDepth}. */
  commitRecord() {
    const newScore = this.score > this.bestScore;
    const newDepth = this.depth > this.bestDepth;
    if (newScore) {
      this.bestScore = this.score;
      localStorage.setItem(STORAGE.bestScore, String(this.bestScore));
    }
    if (newDepth) {
      this.bestDepth = this.depth;
      localStorage.setItem(STORAGE.bestDepth, String(this.bestDepth));
    }
    return { newScore, newDepth };
  }
}
