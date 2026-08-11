/**
 * main.js - 游戏入口（PixiJS）
 */

import { StreetScene } from './scenes/StreetScene.js';

const VIEW_W = 900;
const VIEW_H = 720; // O-2：倾角投影后世界竖直方向变长，500 只能看到一小截，见 tasks.md O-1 预期副作用

const app = new PIXI.Application({
  width: VIEW_W,
  height: VIEW_H,
  backgroundColor: 0xf4f4f4,   // GRAY_SKY
  antialias: true,
  autoDensity: true,
  resolution: window.devicePixelRatio || 1,
});
document.body.appendChild(app.view);

// 画布等比缩放铺满窗口（居中由 body flex 处理；坐标换算用 getBoundingClientRect）
function fitCanvas() {
  const s = Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H);
  app.view.style.width  = Math.round(VIEW_W * s) + 'px';
  app.view.style.height = Math.round(VIEW_H * s) + 'px';
}
fitCanvas();
window.addEventListener('resize', fitCanvas);

const scene = new StreetScene(app);
await scene.preload();
scene.create();
