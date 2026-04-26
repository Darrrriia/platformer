import { Entity } from './Entity.js';
import { COLOR, PLAYER, Z, EVT } from '../constants.js';
import { rectsOverlap } from '../physics/CollisionSystem.js';

/**
 * Игрок. FSM с состояниями idle/run/jump/fall/wallSlide/dash/attack/hurt/dead.
 *
 * Реализованы стандарты «соковых» прыжков:
 *   - Coyote time — короткое окно после ухода с земли, когда прыжок ещё засчитывается
 *   - Jump buffer — нажатие до приземления засчитывается
 *   - Variable jump height — отпустил кнопку → vy режется (cutJumpFactor)
 *   - Double jump — один доп. прыжок в воздухе (фишка Dead Cells)
 *   - Wall slide + wall jump — касаешься стены, медленно сползаешь, прыгаешь от неё
 *   - Dash — рывок с i-frames (короткая неуязвимость)
 *
 * Атака — короткий хитбокс перед игроком. Хит-чек запускается из GameScene
 * через `tryHitEnemies(enemies)` — отдельный метод, чтобы Player не знал про коллекцию.
 */
export class Player extends Entity {
  /**
   * @param {Phaser.Scene} scene
   * @param {{ x: number, y: number }} pos  левый-верх AABB
   */
  constructor(scene, pos) {
    super(scene, { x: pos.x, y: pos.y, w: PLAYER.width, h: PLAYER.height });
    this.setDepth(Z.player);

    this.facing = 1; // -1 / +1
    this.hp = PLAYER.hpMax;
    this.airJumpsLeft = 1;
    /** @type {'idle'|'run'|'jump'|'fall'|'wallSlide'|'dash'|'attack'|'hurt'|'dead'} */
    this.state = 'idle';

    // тайминги (все в мс, отсчёт от scene.time.now)
    this.coyoteUntil = 0;
    this.jumpBufferedUntil = 0;
    this.dashUntil = 0;
    this.dashCDUntil = 0;
    this.dashIframesUntil = 0;
    this.attackUntil = 0;
    this.attackCDUntil = 0;
    this.invulnUntil = 0;
    /** Сторона стены, к которой прилип (используется для wall jump). */
    this.lastWallSide = 0;

    /** Рисуется отдельным графом — лезвие атаки. */
    this.attackGfx = scene.add.graphics();
    this.add(this.attackGfx);

    this.redraw();
  }

  // ─────────────────────────────────────────────── public API

  /** @param {number} now scene.time.now */
  isDashing(now) {
    return now < this.dashUntil;
  }
  /** @param {number} now */
  isAttacking(now) {
    return now < this.attackUntil;
  }
  /** @param {number} now */
  isInvuln(now) {
    return now < this.invulnUntil || this.isDashing(now);
  }

  /**
   * Получить урон. Возвращает true, если урон засчитан.
   * @param {number} amount
   * @param {number} fromX  координата центра источника по X (для направления knockback)
   * @param {number} now
   */
  hurt(amount, fromX, now) {
    if (!this.alive || this.state === 'dead') return false;
    if (this.isInvuln(now)) return false;

    this.hp = Math.max(0, this.hp - amount);
    this.invulnUntil = now + PLAYER.invulnMs;
    this.phys.vx = (this.phys.cx < fromX ? -1 : 1) * PLAYER.knockbackVx;
    this.phys.vy = PLAYER.knockbackVy;
    this.scene.cameras.main.shake(160, 0.006);
    this.scene.game.events.emit(EVT.hpChanged, this.hp);

    if (this.hp <= 0) {
      this.state = 'dead';
      this.scene.events.emit(EVT.playerDied);
    } else {
      this.state = 'hurt';
    }
    this.dirty = true;
    return true;
  }

  /**
   * Применить ввод и обновить таймеры/скорости. Вызывается из GameScene до super.update.
   * @param {import('../systems/InputHandler.js').InputHandler} input
   * @param {number} dt
   * @param {number} now
   */
  applyInput(input, dt, now) {
    if (this.state === 'dead') return;

    // ── Dash имеет приоритет: пока активен, ввод по горизонтали игнорируется
    if (this.isDashing(now)) {
      this.phys.vy = 0;
      this.state = 'dash';
      return;
    }

    // ── Старт dash
    if (input.dashJustDown && now >= this.dashCDUntil) {
      const dir = input.left ? -1 : input.right ? 1 : this.facing;
      this.phys.vx = dir * PLAYER.dashSpeed;
      this.phys.vy = 0;
      this.dashUntil = now + PLAYER.dashDurationMs;
      this.dashCDUntil = now + PLAYER.dashCooldownMs;
      this.dashIframesUntil = now + PLAYER.dashIframesMs;
      this.facing = dir;
      this.state = 'dash';
      this.scene.events.emit('player:dash', { x: this.phys.cx, y: this.phys.cy, dir });
      this.dirty = true;
      return;
    }

    // ── Атака
    if (input.attackJustDown && now >= this.attackCDUntil && !this.isAttacking(now)) {
      this.attackUntil = now + PLAYER.attackDurationMs;
      this.attackCDUntil = now + PLAYER.attackCooldownMs;
      this.dirty = true;
      this.scene.events.emit('player:attack', { facing: this.facing });
    }

    // ── Горизонтальное движение
    let want = 0;
    if (input.left) want -= 1;
    if (input.right) want += 1;
    if (want !== 0) this.facing = want;

    const targetVx = want * PLAYER.moveSpeed;
    const accel = this.phys.onGround ? PLAYER.groundAccel : PLAYER.airAccel;
    if (want === 0) {
      // friction только на земле
      if (this.phys.onGround) {
        const friction = PLAYER.groundFriction * dt;
        if (Math.abs(this.phys.vx) <= friction) this.phys.vx = 0;
        else this.phys.vx -= Math.sign(this.phys.vx) * friction;
      }
    } else {
      const dv = targetVx - this.phys.vx;
      const step = accel * dt;
      this.phys.vx += Math.sign(dv) * Math.min(Math.abs(dv), step);
    }

    // ── Wall slide: касаемся стены, в воздухе, движемся в сторону стены
    const pressingIntoWall =
      (this.phys.onWall === -1 && want < 0) || (this.phys.onWall === 1 && want > 0);
    const isWallSliding = !this.phys.onGround && pressingIntoWall && this.phys.vy >= 0;
    if (isWallSliding) {
      this.phys.vy = Math.min(this.phys.vy, PLAYER.wallSlideSpeedMax);
      this.lastWallSide = this.phys.onWall;
    }

    // ── Прыжок (с буфером и coyote)
    if (input.jumpJustDown) {
      this.jumpBufferedUntil = now + PLAYER.jumpBufferMs;
    }
    const canCoyoteJump = now <= this.coyoteUntil;
    const wantsJump = now <= this.jumpBufferedUntil;

    if (wantsJump) {
      if (this.phys.onGround || canCoyoteJump) {
        this.phys.vy = PLAYER.jumpVel;
        this.airJumpsLeft = 1;
        this.jumpBufferedUntil = 0;
        this.coyoteUntil = 0;
        this.scene.events.emit('player:jump', { x: this.phys.cx, y: this.phys.cy + this.phys.h / 2 });
      } else if (isWallSliding || (this.phys.onWall !== 0 && !this.phys.onGround)) {
        // wall jump
        const off = -this.phys.onWall;
        this.phys.vx = off * PLAYER.wallJumpVx;
        this.phys.vy = PLAYER.wallJumpVy;
        this.facing = off;
        this.airJumpsLeft = 1;
        this.jumpBufferedUntil = 0;
        this.scene.events.emit('player:jump', { x: this.phys.cx, y: this.phys.cy });
      } else if (this.airJumpsLeft > 0) {
        // double jump
        this.phys.vy = PLAYER.doubleJumpVel;
        this.airJumpsLeft -= 1;
        this.jumpBufferedUntil = 0;
        this.scene.events.emit('player:jump', { x: this.phys.cx, y: this.phys.cy, double: true });
      }
    }

    // ── Cut jump: отпустили Space на подъёме
    if (!input.jumpIsDown && this.phys.vy < 0) {
      this.phys.vy *= PLAYER.cutJumpFactor;
    }
  }

  /**
   * Обновить таймеры состояния и переопределить state. Вызывается ДО body.step.
   * @param {number} now
   */
  preStep(now) {
    if (this.state === 'dead') return;

    // приземление (был в воздухе → стал на земле)
    if (this.phys.onGround && !this.phys.wasOnGround) {
      this.scene.events.emit('player:land', {
        x: this.phys.cx,
        y: this.phys.y + this.phys.h,
      });
    }

    // wasOnGround → coyote refresh при сходе с края
    if (this.phys.onGround) {
      this.coyoteUntil = now + PLAYER.coyoteMs;
      this.airJumpsLeft = 1;
    }

    // hurt-state — короткий, ~ длительность invuln/3
    if (this.state === 'hurt' && now > this.invulnUntil - (PLAYER.invulnMs * 2) / 3) {
      this.state = this.phys.onGround ? 'idle' : 'fall';
    }
  }

  /**
   * Определить визуальное состояние после step. Только для отрисовки/HUD.
   * @param {number} now
   */
  postStep(now) {
    if (this.state === 'dead' || this.state === 'hurt') return;
    if (this.isDashing(now)) {
      this.state = 'dash';
      return;
    }
    if (this.isAttacking(now)) {
      this.state = 'attack';
      return;
    }
    if (this.phys.onGround) {
      this.state = Math.abs(this.phys.vx) > 8 ? 'run' : 'idle';
    } else if (
      this.phys.onWall !== 0 &&
      this.phys.vy >= 0 &&
      ((this.phys.onWall === -1 && this.phys.vx <= 0) || (this.phys.onWall === 1 && this.phys.vx >= 0))
    ) {
      this.state = 'wallSlide';
    } else {
      this.state = this.phys.vy < 0 ? 'jump' : 'fall';
    }
  }

  /**
   * Проверить, попадает ли активная атака по врагам, и нанести урон.
   * @param {Iterable<import('./Enemy.js').Enemy>} enemies
   * @param {number} now
   */
  tryHitEnemies(enemies, now) {
    if (!this.isAttacking(now)) return;
    const hb = this.attackHitbox();
    for (const e of enemies) {
      if (!e.alive) continue;
      if (rectsOverlap(hb, e.phys.rect())) {
        e.hurt(PLAYER.attackDamage, this.phys.cx, now);
      }
    }
  }

  /** Прямоугольник хитбокса атаки в мировых координатах. */
  attackHitbox() {
    const w = PLAYER.attackHitboxW;
    const h = PLAYER.attackHitboxH;
    const x = this.facing > 0 ? this.phys.x + this.phys.w : this.phys.x - w;
    const y = this.phys.y + this.phys.h / 2 - h / 2;
    return { x, y, w, h };
  }

  // ─────────────────────────────────────────────── рендер

  redraw() {
    this.gfx.clear();
    this.attackGfx.clear();

    const halfW = this.phys.w / 2;
    const halfH = this.phys.h / 2;
    const flicker = this.isInvuln(this.scene.time.now) ? 0.55 : 1.0;

    // ноги (две вертикальные полоски снизу)
    this.gfx.fillStyle(COLOR.player, 0.85 * flicker);
    this.gfx.fillRect(-6, halfH - 8, 4, 8);
    this.gfx.fillRect(2, halfH - 8, 4, 8);

    // тело — скруглённый rect с обводкой
    this.gfx.fillStyle(COLOR.player, 0.18 * flicker);
    this.gfx.fillRoundedRect(-halfW + 2, -halfH + 6, this.phys.w - 4, this.phys.h - 14, 4);
    this.gfx.lineStyle(2, COLOR.player, 1 * flicker);
    this.gfx.strokeRoundedRect(-halfW + 2, -halfH + 6, this.phys.w - 4, this.phys.h - 14, 4);

    // голова
    this.gfx.fillStyle(COLOR.player, 0.95 * flicker);
    this.gfx.fillCircle(0, -halfH + 4, 6);
    this.gfx.lineStyle(1.5, 0xffffff, 0.8 * flicker);
    this.gfx.strokeCircle(0, -halfH + 4, 6);

    // глаз — тонкая полоска по направлению взгляда
    this.gfx.fillStyle(0x07060f, 1);
    this.gfx.fillRect(this.facing > 0 ? 1 : -5, -halfH + 3, 4, 1.5);

    // лезвие атаки
    if (this.isAttacking(this.scene.time.now)) {
      const w = PLAYER.attackHitboxW;
      const h = PLAYER.attackHitboxH;
      const ax = this.facing > 0 ? halfW : -halfW - w;
      const ay = -h / 2;
      this.attackGfx.fillStyle(COLOR.attack, 0.35);
      this.attackGfx.fillRect(ax, ay, w, h);
      this.attackGfx.lineStyle(2, COLOR.attack, 1);
      this.attackGfx.strokeRect(ax, ay, w, h);
      // искра в конце
      const tipX = this.facing > 0 ? ax + w : ax;
      this.attackGfx.fillStyle(0xffffff, 1);
      this.attackGfx.fillCircle(tipX, 0, 3);
    }
  }

  /**
   * Кастомный update: ввод → preStep → physics → postStep → перерисовка.
   * Вызывается из GameScene с готовым input/now/platforms.
   *
   * @param {object} ctx
   * @param {import('../systems/InputHandler.js').InputHandler} ctx.input
   * @param {number} ctx.dt   секунды
   * @param {number} ctx.now  ms
   * @param {import('../physics/CollisionSystem.js').Platform[]} ctx.platforms
   */
  tick({ input, dt, now, platforms }) {
    this.preStep(now);
    if (this.state !== 'dead') {
      this.applyInput(input, dt, now);
    } else {
      // мёртвый продолжает падать, но input игнорируется
    }
    this.phys.step(dt, platforms);
    this.postStep(now);
    this.syncFromBody();
    // в hurt/dash/attack графика мерцает или меняется — перерисовка каждый кадр
    this.redraw();
  }
}
