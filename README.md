# NEONFALL

Бесконечный roguelike-платформер в киберпанк-стилистике. Падай вглубь по процедурно сгенерированным комнатам, режь врагов энергоклинком, собирай дата-фрагменты и установи новый рекорд.

> Третье практическое задание по веб-разработке. Дарья Пищелина, СПбГУПТД, гр. 4-МЗ-4.

![меню](docs/screenshots/01-menu.png)

## Использование нейросети

- **Модель:** Claude Opus 4.7 (1M context) — Anthropic.
- **Время разработки:** ≈ 1 час, всё в одной диалоговой сессии.
- **Что сделано с помощью AI:**
  - Архитектура проекта и решение по стеку (Phaser 4 + Vite 8 + чистый JS с JSDoc-типами)
  - Кастомная физика — `PhysicsBody` со swept-AABB коллизиями, без `Arcade Physics`
  - FSM игрока: 9 состояний, coyote time, jump buffer, double jump, wall slide / wall jump, dash с i-frames, атака с хитбоксом
  - Три типа врагов с собственными AI-машинами состояний (Drone, Slasher, Sentinel)
  - Процедурный генератор комнат (5 шаблонов + прогрессия сложности)
  - Параллакс-фон из 3 слоёв процедурной векторной графики
  - Постпроцессинг: камерный Glow-фильтр (Phaser 4 RC.6 `camera.filters.internal.addGlow`)
  - 6 типов частиц с `blendMode: ADD`
  - HUD на отдельной сцене, реактивный (game-level events)
  - Деплой через GitHub Actions
  - Этот README

Всю архитектурную работу, реализацию, тесты в Playwright и полировку выполняла модель — пользователь определял концепцию, выбирал из вариантов и принимал план.

## Демо

После пуша в репозиторий с именем `platformer`: <https://klimatformat.github.io/platformer/>

## Скриншоты

### Меню
![меню](docs/screenshots/01-menu.png)

### Геймплей: первая комната
![игра](docs/screenshots/02-gameplay.png)

### Геймплей: лесенка
![лесенка](docs/screenshots/03-stairway.png)

## Стек

- **[Phaser 4](https://phaser.io)** — рендер на WebGL, сцены, клавиатурный ввод, частицы, постпроцессинг-шейдер Glow, камера со следящим режимом и deadzone.
- **[Vite 8](https://vite.dev)** — dev-сервер (порт 8765), production-сборка с правильным `base` для GitHub Pages.
- **JavaScript** + JSDoc — без TypeScript-сборки, типы только в IDE.

> «Основная логика игры реализована на чистом JavaScript. Phaser использован как рендер / scene-граф / источник ввода / визуальные эффекты — но физика, коллизии, AI, FSM игрока, генерация уровней написаны вручную, без `Arcade Physics`.»

## Управление

| Клавиша            | Действие                          |
| ------------------ | --------------------------------- |
| `A` / `D` или стрелки | движение                       |
| `Space` / `W` / `↑`  | прыжок (нажми ещё раз — двойной) |
| `Shift`              | рывок (с короткой неуязвимостью)  |
| `J` / ЛКМ            | атака энергоклинком               |
| `P` / `Esc`          | пауза                            |

В воздухе у стены — wall-slide; нажав прыжок при wall-slide — wall-jump.

## Архитектура

```
src/
  main.js                 # точка входа: new Phaser.Game(config)
  game.js                 # Phaser config (renderer WEBGL, сцены)
  constants.js            # вся числовая конфигурация в одном месте
  scenes/
    BootScene.js          # init: чтение рекордов, генерация текстуры частиц
    MenuScene.js          # титульный экран
    GameScene.js          # игровой цикл: один тик-функция координирует физику и AI
    HUDScene.js           # HUD поверх Game; подписан на game.events
    GameOverScene.js      # экран смерти + запись рекорда
  physics/
    CollisionSystem.js    # swept AABB по осям + one-way платформы
    PhysicsBody.js        # тело с гравитацией, флагами onGround / onWall / onCeiling
  entities/
    Entity.js             # базовый Container с PhysicsBody и Graphics
    Player.js             # FSM-игрок: idle/run/jump/fall/wallSlide/dash/attack/hurt/dead
    Enemy.js              # базовый враг: hp, hurt, knockback, die
    Drone.js              # летающий, gravity 0, преследует игрока
    Slasher.js            # 5-state AI: patrol/chase/windup/strike/recover
    Sentinel.js           # стационарная турель, стреляет лазером
    Projectile.js         # лазер
    Pickup.js             # дата-фрагмент с bobbing
  systems/
    InputHandler.js       # семантические геттеры над Phaser keyboard
    LevelGenerator.js     # 5 шаблонов комнат, прогрессия сложности по depth
    ScoreSystem.js        # счёт, глубина, рекорды (localStorage)
    EffectSystem.js       # 6 типов частиц с blendMode ADD
  graphics/
    ParallaxBackground.js # 3 слоя процедурной графики с разным scrollFactor
```

### Принципы

- **ООП:** базовые классы (`Entity`, `Enemy`) и наследники для конкретных сущностей. `LevelGenerator` — стратегия (массив шаблонов). `ScoreSystem` — отдельный сервис, переживает `scene.restart`.
- **Игровой цикл:** `Phaser.Scene.update(time, delta)`, `delta` клампится до 33ms (защита от туннелирования). `GameScene.update` координатор: ввод → AI → физика → коллизии → эффекты.
- **Физика:** AABB, раздельное разрешение по осям (`sweepX` → `sweepY`) — стандарт для платформеров, корректно определяет `onGround` / `onWall` без false positives на стыках платформ.
- **Управление событиями:** глобальные (`hp:changed`, `score:changed`, `paused`) — на `game.events`, чтобы HUD пережил `scene.restart`. Локальные (`player:jump`, `enemy:explode`) — на `scene.events`, обнуляются с шатдауном сцены.
- **Графика:** ноль внешних ассетов. Всё рисуется кодом: `Phaser.Graphics` для платформ и сущностей, `Particles` для эффектов, постпроцессинг-Glow на главную камеру.

## Локальный запуск

```sh
npm install
npm run dev
```

Открыть <http://127.0.0.1:8765/platformer/>.

## Production-сборка

```sh
npm run build
npm run preview
```

## Деплой на GitHub Pages

Workflow `.github/workflows/deploy.yml` собирает и публикует автоматически при пуше в `main`.

1. Создать публичный репозиторий с именем `platformer`.
2. `git init && git add . && git commit -m "init"`
3. `git remote add origin git@github.com:<username>/platformer.git`
4. `git push -u origin main`
5. На GitHub: `Settings → Pages → Source = GitHub Actions`.
6. Зелёный workflow в `Actions` — игра доступна на `https://<username>.github.io/platformer/`.

> Если репозиторий назван иначе — поменять одну строку `REPO_BASE` в `vite.config.js` и переподписать `<base>` в `index.html` через сборку.
