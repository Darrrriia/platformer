import { COLOR, Z } from '../constants.js';

/**
 * Параллакс-фон из 3 процедурно нарисованных слоёв.
 *
 * Каждый слой — Phaser.GameObjects.Graphics, привязанный к камере с разным
 * `scrollFactor`. Чем дальше слой, тем меньше scrollFactor → визуальная глубина.
 *
 * Слои:
 *   1. Дальний (scrollFactor 0.1) — горизонтальные линии-«терминалы», слабый ореол
 *   2. Средний (scrollFactor 0.3) — силуэты «зданий» (вертикальные блоки с окнами)
 *   3. Ближний (scrollFactor 0.6) — частая мелкая сетка
 *
 * Рисование — один раз в create. Размер графики — viewport, заточен под scrollFactor 0,
 * но поскольку у нас scrollFactor != 0, мы рисуем «полотно» шире, чем экран —
 * чтобы при движении камеры не было пустых краёв.
 */
export class ParallaxBackground {
  /**
   * @param {Phaser.Scene} scene
   * @param {{ width: number, height: number }} room
   */
  constructor(scene, room) {
    this.scene = scene;
    this.room = room;
    this._build();
  }

  _build() {
    const { width: rw, height: rh } = this.room;
    // Полотно перекрывает комнату с запасом во все стороны.
    // Запас = размер canvas, чтобы при scrollFactor < 1 края всегда были покрыты
    // на любом разрешении viewport (RESIZE-mode).
    const vw = this.scene.scale.width;
    const vh = this.scene.scale.height;
    const cw = rw + vw * 2;
    const ch = rh + vh * 2;

    // ── слой 1 — дальний (scrollFactor 0.15)
    {
      const g = this.scene.add.graphics().setDepth(Z.bgFar).setScrollFactor(0.15, 0.1);
      g.x = -vw;
      g.y = -vh;

      // градиент-ореол (используем серию полупрозрачных прямоугольников)
      for (let i = 0; i < 8; i++) {
        g.fillStyle(COLOR.accent, 0.04);
        g.fillRect(0, ch * 0.1 + i * (ch / 14), cw, ch / 18);
      }

      // длинные горизонтальные линии
      g.lineStyle(1, COLOR.accent, 0.18);
      const linesFar = 20;
      for (let i = 0; i < linesFar; i++) {
        const y = (i / linesFar) * ch + ((i * 137) % 60);
        g.lineBetween(0, y, cw, y);
      }
      // мерцающие точки-«звёзды»
      for (let i = 0; i < 80; i++) {
        const x = (i * 173) % cw;
        const y = (i * 251) % ch;
        g.fillStyle(0xffffff, 0.12 + (i % 5) * 0.04);
        g.fillCircle(x, y, 0.8);
      }
    }

    // ── слой 2 — средний (scrollFactor 0.35) — силуэты зданий
    {
      const g = this.scene.add.graphics().setDepth(Z.bgMid).setScrollFactor(0.35, 0.15);
      g.x = -vw;
      g.y = -vh;

      let x = 0;
      let salt = 0.31415;
      while (x < cw) {
        const w = 50 + ((salt * 1000) % 90);
        const h = 80 + ((salt * 13000) % 220);
        const y = ch - 60 - h;
        const color = (salt * 100) % 1 > 0.5 ? COLOR.accent : COLOR.platformEdge;

        g.fillStyle(color, 0.06);
        g.fillRect(x, y, w, h);
        g.lineStyle(1, color, 0.35);
        g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

        // окошки
        g.fillStyle(color, 0.5);
        for (let wy = y + 8; wy < y + h - 8; wy += 12) {
          for (let wx = x + 6; wx < x + w - 6; wx += 10) {
            if ((wx * wy * salt * 17) % 5 < 1.5) {
              g.fillRect(wx, wy, 3, 3);
            }
          }
        }

        x += w + 6 + ((salt * 400) % 24);
        salt += 0.157;
      }

      // линия горизонта
      g.lineStyle(1.5, COLOR.player, 0.35);
      g.lineBetween(0, ch - 60, cw, ch - 60);
    }

    // ── слой 3 — ближний (scrollFactor 0.7) — мелкая сетка / scanlines
    {
      const g = this.scene.add.graphics().setDepth(Z.bgNear).setScrollFactor(0.7, 0.3);
      g.x = -vw;
      g.y = -vh;
      g.lineStyle(1, COLOR.player, 0.04);
      for (let y = 0; y < ch; y += 4) {
        g.lineBetween(0, y, cw, y);
      }
    }
  }
}
