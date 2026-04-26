/**
 * AABB-коллизии. Все объекты — прямоугольники с координатой верхнего левого угла.
 *
 * Используем раздельное разрешение по осям (Separating Axis в простом виде):
 * сперва двигаем тело по X и резолвим, затем по Y. Это стандартная для платформеров
 * схема — избегает «зацепа» за угол на стыке двух платформ и даёт чистое
 * определение onGround / onWall.
 *
 * One-way платформы — игнорируем коллизию, если тело движется ВВЕРХ или его нижняя
 * грань на старте кадра выше верхней грани платформы.
 */

/**
 * @typedef {object} Rect
 * @property {number} x  верхний левый угол
 * @property {number} y
 * @property {number} w
 * @property {number} h
 */

/**
 * @typedef {object} Platform
 * @property {number} x
 * @property {number} y
 * @property {number} w
 * @property {number} h
 * @property {boolean} [oneWay]
 */

/**
 * Пересекаются ли два прямоугольника (без касания).
 * @param {Rect} a
 * @param {Rect} b
 * @returns {boolean}
 */
export function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/**
 * Двигает rect по X на dx, разрешая коллизии с платформами.
 * Возвращает фактическое смещение и флаг столкновения с какой-стороны.
 *
 * @param {Rect} rect — мутируется (изменяется x)
 * @param {number} dx
 * @param {Platform[]} platforms
 * @returns {{ hit: boolean, side: -1 | 0 | 1 }}  side: -1 слева, +1 справа
 */
export function sweepX(rect, dx, platforms) {
  if (dx === 0) return { hit: false, side: 0 };

  rect.x += dx;
  let hit = false;
  let side = 0;

  for (const p of platforms) {
    if (p.oneWay) continue; // one-way пропускают по горизонтали
    if (!rectsOverlap(rect, p)) continue;

    if (dx > 0) {
      // двигались вправо — упёрлись в левую грань платформы
      rect.x = p.x - rect.w;
      side = 1;
    } else {
      // двигались влево — упёрлись в правую грань
      rect.x = p.x + p.w;
      side = -1;
    }
    hit = true;
  }

  return { hit, side };
}

/**
 * Двигает rect по Y на dy, разрешая коллизии.
 * При движении вниз и контакте с верхом платформы — приземление.
 *
 * @param {Rect} rect — мутируется
 * @param {number} dy
 * @param {Platform[]} platforms
 * @returns {{ hit: boolean, grounded: boolean, ceiling: boolean }}
 */
export function sweepY(rect, dy, platforms) {
  if (dy === 0) return { hit: false, grounded: false, ceiling: false };

  const prevBottom = rect.y + rect.h - dy; // нижняя грань ДО смещения
  rect.y += dy;
  let hit = false;
  let grounded = false;
  let ceiling = false;

  for (const p of platforms) {
    if (!rectsOverlap(rect, p)) continue;

    if (p.oneWay) {
      // one-way: запрещаем приземление только если двигаемся вниз И раньше были выше платформы
      if (dy <= 0 || prevBottom > p.y + 0.5) continue;
      rect.y = p.y - rect.h;
      grounded = true;
      hit = true;
      continue;
    }

    if (dy > 0) {
      // двигались вниз — приземление
      rect.y = p.y - rect.h;
      grounded = true;
    } else {
      // двигались вверх — потолок
      rect.y = p.y + p.h;
      ceiling = true;
    }
    hit = true;
  }

  return { hit, grounded, ceiling };
}
