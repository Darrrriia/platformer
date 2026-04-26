import * as Phaser from 'phaser';

import { COLOR, VIEW_WIDTH, VIEW_HEIGHT } from './constants.js';
import { BootScene } from './scenes/BootScene.js';
import { MenuScene } from './scenes/MenuScene.js';
import { GameScene } from './scenes/GameScene.js';
import { HUDScene } from './scenes/HUDScene.js';
import { GameOverScene } from './scenes/GameOverScene.js';

/** @type {Phaser.Types.Core.GameConfig} */
export const config = {
  type: Phaser.WEBGL,
  parent: 'game',
  width: VIEW_WIDTH,
  height: VIEW_HEIGHT,
  backgroundColor: COLOR.bgDeep,
  pixelArt: false,
  roundPixels: false,
  antialias: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  fps: {
    target: 60,
    forceSetTimeOut: false,
  },
  render: {
    powerPreference: 'high-performance',
  },
  scene: [BootScene, MenuScene, GameScene, HUDScene, GameOverScene],
};
