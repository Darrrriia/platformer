import * as Phaser from 'phaser';
import { COLOR, EVT, TILE, Z } from '../constants.js';
import { Player } from '../entities/Player.js';
import { Drone } from '../entities/Drone.js';
import { Slasher } from '../entities/Slasher.js';
import { Sentinel } from '../entities/Sentinel.js';
import { Pickup } from '../entities/Pickup.js';
import { InputHandler } from '../systems/InputHandler.js';
import { LevelGenerator } from '../systems/LevelGenerator.js';
import { ScoreSystem } from '../systems/ScoreSystem.js';
import { EffectSystem } from '../systems/EffectSystem.js';
import { ParallaxBackground } from '../graphics/ParallaxBackground.js';
import { rectsOverlap } from '../physics/CollisionSystem.js';

/** Маппинг тип-врага → конструктор. */
const ENEMY_CTORS = { drone: Drone, slasher: Slasher, sentinel: Sentinel };

/**
 * Основная игровая сцена. Координирует одну комнату:
 *  1. при init получает depth и score (или 1/0 для первого старта)
 *  2. генерирует комнату через LevelGenerator
 *  3. спавнит игрока, врагов, pickups
 *  4. в update обходит сущностей и физику
 *  5. при гибели всех врагов — активирует дверь, при касании двери — restart на depth+1
 *  6. при смерти игрока — переход в GameOverScene
 *
 * ScoreSystem живёт в registry — выживает переходы restart, обнуляется при новом раунде.
 */
export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  /** @param {{ depth?: number }} data */
  init(data) {
    this.depthLevel = data?.depth ?? 1;
    /** @type {ScoreSystem} */
    let score = this.registry.get('scoreSystem');
    if (!score || this.depthLevel === 1) {
      score = new ScoreSystem(this.game.events);
      score.reset();
      this.registry.set('scoreSystem', score);
    }
    this.scoreSystem = score;
    this.scoreSystem.setDepth(this.depthLevel);

    /** @type {import('../physics/CollisionSystem.js').Platform[]} */
    this.platforms = [];
    /** @type {Drone[] | Slasher[] | Sentinel[]} */
    this.enemies = [];
    /** @type {import('../entities/Projectile.js').Projectile[]} */
    this.projectiles = [];
    /** @type {Pickup[]} */
    this.pickups = [];
    /** @type {Player | null} */
    this.player = null;
    /** @type {Phaser.GameObjects.Container | null} */
    this.exitDoor = null;
    this.exitActive = false;
    this.transitioning = false;
    this.paused = false;
  }

  create() {
    this.cameras.main.setBackgroundColor(COLOR.bgDeep);

    const generator = new LevelGenerator();
    const room = generator.generate({ depth: this.depthLevel });
    this.room = room;
    this.platforms = room.platforms;

    this._drawRoomDecor(room);
    new ParallaxBackground(this, room);
    this._drawPlatforms(room.platforms);
    this._spawnExit(room.exit);

    this.player = new Player(this, {
      x: room.entrance.x - 12,
      y: room.entrance.y - 36,
    });

    for (const e of room.enemies) {
      const Ctor = ENEMY_CTORS[e.type];
      if (!Ctor) continue;
      const enemy = new Ctor(this, { x: e.x, y: e.y });
      this.enemies.push(enemy);
    }
    for (const p of room.pickups) {
      this.pickups.push(new Pickup(this, p));
    }

    this.input_ = new InputHandler(this);
    this.effects = new EffectSystem(this);

    // камера + общий неоновый glow
    const cam = this.cameras.main;
    cam.setBounds(0, 0, room.width, room.height);
    cam.startFollow(this.player, true, 0.12, 0.12);
    cam.setDeadzone(160, 100);
    cam.fadeIn(300, 7, 6, 15);
    if (cam.filters?.internal) {
      cam.filters.internal.addGlow({
        color: 0xffffff,
        outerStrength: 1.4,
        innerStrength: 0,
        distance: 10,
        quality: 0.1,
      });
    }

    // события
    this.events.on('sentinel:fire', (data) => {
      this.projectiles.push(data.proj);
      this.effects.spawnAttackSparks(data.x, data.y, 4);
    });
    this.events.on(EVT.enemyKilled, (data) => {
      this.scoreSystem.addScore(data.reward);
      this._checkRoomCleared();
    });
    this.events.on('enemy:explode', (data) => {
      this.effects.spawnEnemyExplosion(data.x, data.y);
      this.cameras.main.shake(80, 0.004);
    });
    this.events.on('pickup:collected', (data) => {
      this.scoreSystem.addScore(data.value);
      this.effects.spawnPickupBurst(data.x, data.y);
    });
    this.events.on('player:land', (data) => {
      this.effects.spawnDust(data.x, data.y, 5);
    });
    this.events.on('player:jump', (data) => {
      this.effects.spawnJumpBurst(data.x, data.y);
    });
    this.events.on('player:dash', (data) => {
      this.effects.spawnDashTrail(data.x, data.y, 8);
    });
    this.events.on('player:attack', () => {
      const hb = this.player.attackHitbox();
      this.effects.spawnAttackSparks(hb.x + hb.w / 2, hb.y + hb.h / 2, 6);
    });
    this.events.on(EVT.playerDied, () => this._goGameOver());

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off('sentinel:fire');
      this.events.off(EVT.enemyKilled);
      this.events.off('enemy:explode');
      this.events.off('pickup:collected');
      this.events.off('player:land');
      this.events.off('player:jump');
      this.events.off('player:dash');
      this.events.off('player:attack');
      this.events.off(EVT.playerDied);
    });

    // если в комнате нет врагов — сразу активируем дверь
    if (this.enemies.length === 0) this._activateExit();

    // сообщить HUD-у текущие значения через game.events (HUD слушает их глобально)
    this.game.events.emit(EVT.hpChanged, this.player.hp);
    this.game.events.emit(EVT.scoreChanged, this.scoreSystem.score);
    this.game.events.emit(EVT.depthChanged, this.depthLevel);
  }

  // ─────────────────────────────────────────────── рисование

  _drawRoomDecor(room) {
    // фон комнаты — небо/градиент
    const bg = this.add.rectangle(room.width / 2, room.height / 2, room.width, room.height, COLOR.bgDeep);
    bg.setDepth(Z.bgFar);

    // лёгкая сетка декоративная
    const grid = this.add.graphics().setDepth(Z.bgMid).setAlpha(0.16);
    grid.lineStyle(1, COLOR.accent, 0.5);
    for (let x = 0; x < room.width; x += TILE) {
      grid.lineBetween(x, 0, x, room.height);
    }
    for (let y = 0; y < room.height; y += TILE) {
      grid.lineBetween(0, y, room.width, y);
    }
  }

  _drawPlatforms(platforms) {
    const g = this.add.graphics().setDepth(Z.platform);
    for (const p of platforms) {
      g.fillStyle(COLOR.platform, 0.7);
      g.fillRect(p.x, p.y, p.w, p.h);
      g.lineStyle(2, COLOR.platformEdge, 1);
      g.strokeRect(p.x + 1, p.y + 1, p.w - 2, p.h - 2);
      // верхняя «энергия»
      if (p.h <= TILE) {
        g.lineStyle(1.5, COLOR.player, 0.7);
        g.lineBetween(p.x + 4, p.y + 1, p.x + p.w - 4, p.y + 1);
      }
    }
  }

  _spawnExit(pos) {
    const c = this.add.container(pos.x, pos.y);
    c.setDepth(Z.doorIdle);
    const g = this.add.graphics();
    c.add(g);
    this._drawDoor(g, false);
    this.exitDoor = c;
    this.exitDoorGfx = g;
  }

  _drawDoor(g, active) {
    const w = 32;
    const h = 64;
    g.clear();
    const color = active ? COLOR.doorActive : COLOR.doorIdle;
    g.fillStyle(color, active ? 0.35 : 0.2);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 6);
    g.lineStyle(2, color, 1);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, 6);
    if (active) {
      g.lineStyle(1.5, 0xffffff, 0.6);
      g.lineBetween(-w / 4, -h / 2 + 8, w / 4, -h / 2 + 8);
      g.lineBetween(-w / 4, h / 2 - 8, w / 4, h / 2 - 8);
    } else {
      g.fillStyle(0x000000, 0.3);
      g.fillRect(-w / 4, -h / 4, w / 2, h / 2);
    }
  }

  _activateExit() {
    if (this.exitActive) return;
    this.exitActive = true;
    this._drawDoor(this.exitDoorGfx, true);
    this.tweens.add({
      targets: this.exitDoor,
      scale: { from: 1, to: 1.08 },
      duration: 600,
      yoyo: true,
      repeat: -1,
    });
    this.events.emit(EVT.roomCleared);
  }

  _checkRoomCleared() {
    const remaining = this.enemies.filter((e) => e.alive).length;
    if (remaining === 0) this._activateExit();
  }

  // ─────────────────────────────────────────────── переходы

  _enterDoor() {
    if (this.transitioning) return;
    this.transitioning = true;
    this.cameras.main.fadeOut(280, 7, 6, 15);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.restart({ depth: this.depthLevel + 1 });
    });
  }

  _goGameOver() {
    if (this.transitioning) return;
    this.transitioning = true;
    this.cameras.main.shake(220, 0.012);
    this.cameras.main.fadeOut(450, 30, 5, 5);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      const rec = this.scoreSystem.commitRecord();
      this.scene.stop('HUDScene');
      this.scene.start('GameOverScene', {
        score: this.scoreSystem.score,
        depth: this.depthLevel,
        newScore: rec.newScore,
        newDepth: rec.newDepth,
      });
    });
  }

  // ─────────────────────────────────────────────── главный цикл

  update(_time, deltaMs) {
    if (!this.player || !this.input_ || this.transitioning) return;

    const dt = Math.min(deltaMs, 33) / 1000;
    const now = this.time.now;

    if (this.input_.pauseJustDown && !this.paused) {
      this.paused = true;
      this.game.events.emit(EVT.paused);
      this.scene.pause();
      return;
    }

    // Игрок
    this.player.tick({ input: this.input_, dt, now, platforms: this.platforms });

    // след за dash — пока активен
    if (this.player.isDashing(now)) {
      this.effects.spawnDashTrail(this.player.phys.cx, this.player.phys.cy, 1);
    }

    // Враги
    for (const e of this.enemies) {
      if (!e.alive) continue;
      e.tick({ player: this.player, dt, now, platforms: this.platforms });
    }

    // Контактный урон от врагов
    for (const e of this.enemies) {
      if (!e.alive || e.contactDamage <= 0) continue;
      if (rectsOverlap(this.player.phys.rect(), e.phys.rect())) {
        this.player.hurt(e.contactDamage, e.phys.cx, now);
      }
    }

    // Атака игрока по врагам
    this.player.tryHitEnemies(this.enemies, now);

    // Снаряды
    for (const proj of this.projectiles) {
      if (!proj.alive) continue;
      proj.tick(dt, this.platforms, this.player, now);
    }
    // чистка убитых
    this.projectiles = this.projectiles.filter((p) => p.alive);
    this.enemies = this.enemies.filter((e) => e.alive);
    this.pickups = this.pickups.filter((p) => p.alive);

    // Pickups
    for (const p of this.pickups) p.tick(dt, this.player);

    // Пропасть → смерть (в стандартных комнатах не будет, но защита)
    if (this.player.phys.y > this.room.height + 200 && this.player.hp > 0) {
      this.player.hp = 0;
      this.events.emit(EVT.playerDied);
    }

    // Переход через дверь
    if (this.exitActive && this.exitDoor) {
      const door = { x: this.exitDoor.x - 18, y: this.exitDoor.y - 32, w: 36, h: 64 };
      if (rectsOverlap(this.player.phys.rect(), door)) this._enterDoor();
    }

    this.input_.endFrame();
  }
}
