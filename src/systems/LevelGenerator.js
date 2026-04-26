import { TILE, ENEMY, LEVEL } from '../constants.js';

/**
 * @typedef {object} EnemySpawn
 * @property {'drone'|'slasher'|'sentinel'} type
 * @property {number} x  левый-верх AABB
 * @property {number} y
 *
 * @typedef {object} PickupSpawn
 * @property {number} x  центр
 * @property {number} y
 *
 * @typedef {object} RoomData
 * @property {number} width   ширина в пикселях
 * @property {number} height
 * @property {import('../physics/CollisionSystem.js').Platform[]} platforms
 * @property {EnemySpawn[]} enemies
 * @property {PickupSpawn[]} pickups
 * @property {{ x: number, y: number }} entrance  стартовая позиция игрока (центр AABB)
 * @property {{ x: number, y: number }} exit       позиция двери (центр)
 * @property {string} templateName
 */

/**
 * Генератор комнат. Шаблоны — функции, превращающие {depth, rng} в `RoomData`.
 *
 * Прогрессия сложности зашита в `pickEnemyTypes` и количестве врагов.
 * RNG-функция передаётся снаружи, чтобы при желании задать seed (детерминизм).
 */
export class LevelGenerator {
  constructor() {
    this.templates = [
      this._tplFlat,
      this._tplStairway,
      this._tplTwoFloors,
      this._tplPillars,
      this._tplZigzag,
    ];
  }

  /**
   * Сгенерировать комнату по глубине.
   * @param {object} args
   * @param {number} args.depth
   * @param {() => number} [args.rng]  по умолчанию Math.random
   * @returns {RoomData}
   */
  generate({ depth, rng = Math.random }) {
    const template = this.templates[depth % this.templates.length];
    const room = template.call(this, depth, rng);
    room.templateName = template.name.replace(/^_tpl/, '');
    return room;
  }

  // ───────────────────────────────────────────── helpers

  /** @param {number} depth @returns {('drone'|'slasher'|'sentinel')[]} */
  _pickEnemyTypes(depth, rng) {
    const pool = [];
    if (depth >= ENEMY.drone.minDepth) pool.push('drone');
    if (depth >= ENEMY.slasher.minDepth) pool.push('slasher');
    if (depth >= ENEMY.sentinel.minDepth) pool.push('sentinel');

    const count = Math.min(LEVEL.enemyCountMax, Math.max(LEVEL.enemyCountMin, 1 + Math.floor(depth / 2)));
    /** @type {('drone'|'slasher'|'sentinel')[]} */
    const types = [];
    for (let i = 0; i < count; i++) {
      types.push(pool[Math.floor(rng() * pool.length)]);
    }
    return types;
  }

  _wallsAndFloor(wTiles, hTiles) {
    const W = wTiles * TILE;
    const H = hTiles * TILE;
    /** @type {import('../physics/CollisionSystem.js').Platform[]} */
    const plats = [
      { x: 0, y: H - TILE, w: W, h: TILE }, // пол
      { x: 0, y: 0, w: TILE, h: H }, // левая стена
      { x: W - TILE, y: 0, w: TILE, h: H }, // правая стена
    ];
    return { W, H, plats };
  }

  /**
   * Есть ли над платформой p другая платформа в зоне `clearance` пикселей по Y
   * с горизонтальным перекрытием? Если да — на p нельзя ставить высокие объекты
   * (враг 36px, pickup 28px), они зажмутся.
   */
  _hasCeiling(platforms, p, clearance) {
    for (const o of platforms) {
      if (o === p) continue;
      // нет горизонтального перекрытия — пропускаем
      if (o.x + o.w <= p.x || o.x >= p.x + p.w) continue;
      // o должна быть СТРОГО выше верха p, и её низ не дальше clearance от верха p
      const oBottom = o.y + o.h;
      if (oBottom > p.y) continue; // o ниже верха p (возможно сама платформа = пол)
      if (p.y - oBottom < clearance) return true;
    }
    return false;
  }

  /**
   * Подобрать платформу для спавна врага. Возвращает позицию (x,y — левый-верх AABB)
   * на верхней грани одной из платформ (исключая пол, стены и зажатые места).
   */
  _spawnOnPlatform(platforms, w, h, rng, range) {
    const usable = platforms.filter(
      (p) =>
        p.h <= TILE &&
        p.w >= w + 12 &&
        p.y < range.maxY &&
        !this._hasCeiling(platforms, p, h + 8),
    );
    if (usable.length === 0) return null;
    const p = usable[Math.floor(rng() * usable.length)];
    const x = p.x + 6 + rng() * (p.w - w - 12);
    const y = p.y - h - 1;
    return { x, y };
  }

  _spawnFloating(rng, room) {
    const margin = TILE * 2;
    const x = margin + rng() * (room.width - margin * 2);
    const y = margin + rng() * (room.height - margin * 4);
    return { x, y };
  }

  // ───────────────────────────────────────────── шаблоны (имена начинаются с _tpl)

  /**
   * Простой пол с двумя островами на 2 тайла. Используется как «лёгкая» комната.
   * Дверь — на полу справа, не нужно лезть наверх.
   */
  _tplFlat(depth, rng) {
    const wTiles = 24;
    const hTiles = 12;
    const { W, H, plats } = this._wallsAndFloor(wTiles, hTiles);
    plats.push({ x: 6 * TILE, y: H - 3 * TILE, w: 4 * TILE, h: TILE / 2 });
    plats.push({ x: 14 * TILE, y: H - 3 * TILE, w: 4 * TILE, h: TILE / 2 });

    const types = this._pickEnemyTypes(depth, rng);
    const enemies = this._placeEnemies(types, plats, { W, H }, rng);
    const pickups = this._placePickups(plats, { W, H }, rng);

    return {
      width: W,
      height: H,
      platforms: plats,
      enemies,
      pickups,
      entrance: { x: 2 * TILE, y: H - TILE - 36 },
      exit: { x: W - 2 * TILE, y: H - TILE - 32 },
      templateName: 'Flat',
    };
  }

  /**
   * Лесенка из 5 ступенек шагом 1.5 тайла + финальная площадка с дверью.
   * Зазор между ступенькой и площадкой по Y ≥ 1 тайл — игрок проходит между ними.
   */
  _tplStairway(depth, rng) {
    const wTiles = 24;
    const hTiles = 13;
    const { W, H, plats } = this._wallsAndFloor(wTiles, hTiles);
    for (let i = 0; i < 5; i++) {
      const x = (2 + i * 4) * TILE;
      const y = H - (2 + i * 1.5) * TILE;
      plats.push({ x, y, w: 3 * TILE, h: TILE / 2 });
    }
    // финальная площадка — на 1.5 тайла выше последней ступени и сдвинута на 2 тайла,
    // чтобы между ними оставался зазор по Y и игрок мог пройти/прыгнуть
    plats.push({ x: 17 * TILE, y: H - 9.5 * TILE, w: 5 * TILE, h: TILE / 2 });

    const types = this._pickEnemyTypes(depth, rng);
    const enemies = this._placeEnemies(types, plats, { W, H }, rng);
    const pickups = this._placePickups(plats, { W, H }, rng);

    return {
      width: W,
      height: H,
      platforms: plats,
      enemies,
      pickups,
      entrance: { x: 2 * TILE, y: H - TILE - 36 },
      exit: { x: 20 * TILE, y: H - 9.5 * TILE - 32 },
      templateName: 'Stairway',
    };
  }

  /**
   * Два этажа с разрывом по центру + короткие верхние платформы.
   * Все шаги ≤ 2 тайла (доступны двойным прыжком).
   */
  _tplTwoFloors(depth, rng) {
    const wTiles = 26;
    const hTiles = 13;
    const { W, H, plats } = this._wallsAndFloor(wTiles, hTiles);
    plats.push({ x: TILE, y: H - 3 * TILE, w: 10 * TILE, h: TILE / 2 });
    plats.push({ x: 15 * TILE, y: H - 3 * TILE, w: 10 * TILE, h: TILE / 2 });
    plats.push({ x: 5 * TILE, y: H - 5 * TILE, w: 4 * TILE, h: TILE / 2 });
    plats.push({ x: 17 * TILE, y: H - 5 * TILE, w: 4 * TILE, h: TILE / 2 });

    const types = this._pickEnemyTypes(depth, rng);
    const enemies = this._placeEnemies(types, plats, { W, H }, rng);
    const pickups = this._placePickups(plats, { W, H }, rng);

    return {
      width: W,
      height: H,
      platforms: plats,
      enemies,
      pickups,
      entrance: { x: 2 * TILE, y: H - TILE - 36 },
      exit: { x: W - 2 * TILE, y: H - TILE - 32 },
      templateName: 'TwoFloors',
    };
  }

  /**
   * Колонны разной высоты (2 / 3.5 / 5 / 3) и финальная верхняя площадка на 6.5.
   * Нет «закрытых» зазоров — везде между платформами по Y ≥ 1 тайл.
   */
  _tplPillars(depth, rng) {
    const wTiles = 24;
    const hTiles = 12;
    const { W, H, plats } = this._wallsAndFloor(wTiles, hTiles);
    // основания колонн (тонкие, видны как столбы)
    plats.push({ x: 5 * TILE, y: H - 2 * TILE, w: TILE, h: TILE });
    plats.push({ x: 9 * TILE, y: H - 3.5 * TILE, w: TILE, h: 2.5 * TILE });
    plats.push({ x: 13 * TILE, y: H - 5 * TILE, w: TILE, h: 4 * TILE });
    plats.push({ x: 17 * TILE, y: H - 3 * TILE, w: TILE, h: 2 * TILE });
    // верхушки колонн (на них можно стоять)
    plats.push({ x: 5 * TILE, y: H - 2 * TILE, w: TILE, h: TILE / 2 });
    plats.push({ x: 9 * TILE, y: H - 3.5 * TILE, w: TILE, h: TILE / 2 });
    plats.push({ x: 13 * TILE, y: H - 5 * TILE, w: TILE, h: TILE / 2 });
    plats.push({ x: 17 * TILE, y: H - 3 * TILE, w: TILE, h: TILE / 2 });
    // верхняя площадка (на 1.5 тайла выше центральной колонны)
    plats.push({ x: 9 * TILE, y: H - 6.5 * TILE, w: 7 * TILE, h: TILE / 2 });

    const types = this._pickEnemyTypes(depth, rng);
    const enemies = this._placeEnemies(types, plats, { W, H }, rng);
    const pickups = this._placePickups(plats, { W, H }, rng);

    return {
      width: W,
      height: H,
      platforms: plats,
      enemies,
      pickups,
      entrance: { x: 2 * TILE, y: H - TILE - 36 },
      exit: { x: W - 2 * TILE, y: H - TILE - 32 },
      templateName: 'Pillars',
    };
  }

  /**
   * Зигзаг с шагом 1.5 тайла.
   * Дверь на верхней правой платформе.
   */
  _tplZigzag(depth, rng) {
    const wTiles = 24;
    const hTiles = 12;
    const { W, H, plats } = this._wallsAndFloor(wTiles, hTiles);
    plats.push({ x: TILE, y: H - 2 * TILE, w: 7 * TILE, h: TILE / 2 });
    plats.push({ x: 11 * TILE, y: H - 3.5 * TILE, w: 7 * TILE, h: TILE / 2 });
    plats.push({ x: TILE, y: H - 5 * TILE, w: 7 * TILE, h: TILE / 2 });
    plats.push({ x: 11 * TILE, y: H - 6.5 * TILE, w: 7 * TILE, h: TILE / 2 });

    const types = this._pickEnemyTypes(depth, rng);
    const enemies = this._placeEnemies(types, plats, { W, H }, rng);
    const pickups = this._placePickups(plats, { W, H }, rng);

    return {
      width: W,
      height: H,
      platforms: plats,
      enemies,
      pickups,
      entrance: { x: 2 * TILE, y: H - TILE - 36 },
      exit: { x: 17 * TILE, y: H - 6.5 * TILE - 32 },
      templateName: 'Zigzag',
    };
  }

  // ───────────────────────────────────────────── размещение

  /**
   * @param {('drone'|'slasher'|'sentinel')[]} types
   * @param {import('../physics/CollisionSystem.js').Platform[]} platforms
   * @param {{W:number, H:number}} dim
   * @param {() => number} rng
   * @returns {EnemySpawn[]}
   */
  _placeEnemies(types, platforms, dim, rng) {
    /** @type {EnemySpawn[]} */
    const out = [];
    for (const t of types) {
      const cfg = ENEMY[t];
      if (t === 'drone') {
        out.push({
          type: t,
          x: dim.W / 2 - cfg.width / 2 + (rng() - 0.5) * dim.W * 0.5,
          y: dim.H * 0.3 + (rng() - 0.5) * dim.H * 0.2,
        });
      } else {
        const pos = this._spawnOnPlatform(platforms, cfg.width, cfg.height, rng, {
          maxY: dim.H - TILE - 8,
        });
        if (pos) out.push({ type: t, x: pos.x, y: pos.y });
        else
          out.push({
            type: t,
            x: dim.W / 2 - cfg.width / 2,
            y: dim.H - TILE - cfg.height - 1,
          });
      }
    }
    return out;
  }

  /**
   * @param {import('../physics/CollisionSystem.js').Platform[]} platforms
   * @param {{W:number, H:number}} dim
   * @param {() => number} rng
   * @returns {PickupSpawn[]}
   */
  _placePickups(platforms, dim, rng) {
    const count = LEVEL.pickupCountMin + Math.floor(rng() * (LEVEL.pickupCountMax - LEVEL.pickupCountMin + 1));
    /** @type {PickupSpawn[]} */
    const out = [];
    const usable = platforms.filter(
      (p) =>
        p.h <= TILE &&
        p.w >= 64 &&
        p.y < dim.H - TILE &&
        !this._hasCeiling(platforms, p, 40), // 18 (offset) + 14 (radius) + запас
    );
    for (let i = 0; i < count; i++) {
      if (usable.length > 0 && rng() < 0.7) {
        const p = usable[Math.floor(rng() * usable.length)];
        out.push({ x: p.x + 12 + rng() * (p.w - 24), y: p.y - 18 });
      } else {
        out.push({
          x: 2 * TILE + rng() * (dim.W - 4 * TILE),
          y: 2 * TILE + rng() * (dim.H - 4 * TILE),
        });
      }
    }
    return out;
  }
}
