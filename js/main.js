/**
 * main.js - 游戏入口
 */

import { StreetScene } from './scenes/StreetScene.js';

const config = {
  type: Phaser.AUTO,
  width: 900,
  height: 500,
  parent: document.body,
  backgroundColor: '#f0ece4',
  scene: [StreetScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: {
    antialias: true,
    pixelArt: false,
  },
};

const game = new Phaser.Game(config);
