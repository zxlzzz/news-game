/**
 * DebugOverlay — 行为系统可视调试层（按 D 键切换）
 *
 * 两部分：
 *   1) NPC 头顶浮标（世界坐标，scrollFactor 1，随镜头平移）：
 *      `[profile] state | overlay | activity`
 *      自由 NPC 白字，被 Activity 锁定的 NPC 黄字。
 *   2) 左上角全局面板（scrollFactor 0，固定屏幕）：
 *      活跃 Activity 列表 / 托管数统计 / 上次配对扫描结果。
 *
 * 用 PixiText 对象池绘制，默认隐藏。不参与 P 键长图导出
 * （导出只合成 sky+bg+entity 三个 Graphics，本层的 Text 不在其中）。
 */

const FLOAT_STYLE = {
  fontFamily: '"JetBrains Mono", monospace',
  fontSize: '9px',
  color: '#ffffff',
  backgroundColor: 'rgba(0,0,0,0.55)',
  padding: { x: 3, y: 1 },
};

const PANEL_STYLE = {
  fontFamily: '"JetBrains Mono", monospace',
  fontSize: '12px',
  color: '#9effa0',
  backgroundColor: 'rgba(8,8,16,0.86)',
  padding: { x: 8, y: 6 },
  lineSpacing: 2,
};

export class DebugOverlay {
  /**
   * @param {object}    scene
   * @param {BehaviorManager} behaviorManager
   * @param {EntityManager}   entityManager
   */
  constructor(scene, behaviorManager, entityManager) {
    this.scene   = scene;
    this.bm       = behaviorManager;
    this.em       = entityManager;
    this.enabled  = false;
    this.floatPool = [];

    // 左上角面板（固定屏幕，留出顶部既有 HUD 的空间，放在偏下位置）
    this.panel = scene.add.text(10, 150, '', PANEL_STYLE)
      .setScrollFactor(0).setDepth(260).setVisible(false);
  }

  toggle() {
    this.enabled = !this.enabled;
    if (!this.enabled) this._hideAll();
    this.panel.setVisible(this.enabled);
  }

  _hideAll() {
    for (const t of this.floatPool) t.setVisible(false);
  }

  _getFloat(i) {
    let t = this.floatPool[i];
    if (!t) {
      t = this.scene.add.text(0, 0, '', FLOAT_STYLE)
        .setOrigin(0.5, 1).setScrollFactor(1).setDepth(150);
      this.floatPool[i] = t;
    }
    return t;
  }

  // 组装单个 NPC 的浮标文本
  _floatText(npc) {
    const profile = npc._profile ? npc._profile.name : (npc.npcType || '--');
    const raw     = npc.state || npc.animation || '?';
    let state     = raw;
    if (raw === 'loiter' && npc._microPhaseName) {
      state = `loiter:${npc._microPhaseName}`;
    } else if (raw === 'routing' && npc._routeTarget) {
      const t = npc._routeTarget;
      state = `routing→(${Math.round(t.x)},${Math.round(t.y)})`;
    }
    const modStr = npc.modifiers && npc.modifiers.length
      ? npc.modifiers.map(m => `${m.id}(${m.kind[0]})`).join(',')
      : '-';
    let activity  = '-';
    const act = npc._activity;
    if (act) activity = `${act.label}(${act.roleOf(npc) || '?'})`;
    const dept = npc._departing ? ' [DEPT]' : '';
    return `[${profile}] ${state} | ${modStr} | ${activity}${dept}`;
  }

  update() {
    if (!this.enabled) return;

    // ── 1) NPC 头顶浮标（遍历所有 NPC 实体：有 renderer 即 NPC） ──
    const npcs = this.em.entities.filter(e => e.alive && e.visible && e.renderer);
    for (let i = 0; i < npcs.length; i++) {
      const npc = npcs[i];
      const t = this._getFloat(i);
      const b = npc.getBounds();
      t.setText(this._floatText(npc));
      t.setPosition(npc.x, b.y - 3);
      t.setColor(npc._activity ? '#ffe14d' : '#ffffff');
      t.setVisible(true);
    }
    for (let i = npcs.length; i < this.floatPool.length; i++) {
      this.floatPool[i].setVisible(false);
    }

    // ── 2) 左上角全局面板 ──
    this.panel.setText(this._panelText());
  }

  _panelText() {
    const sl = this.bm.socialLayer;
    const npcs = this.bm.npcs;
    const total    = npcs.length;
    const locked   = npcs.filter(n => n._activity).length;
    const departing = npcs.filter(n => n._departing).length;
    const free     = total - locked;

    const lines = [];
    lines.push('— NPC DEBUG (D 切换) —');
    lines.push(`托管 ${total}  |  自由 ${free}  |  锁定 ${locked}  |  离场 ${departing}`);
    const scan = sl.lastScanInfo || { standers: 0, paired: 0 };
    lines.push(`配对扫描: stand=${scan.standers}  新配对=${scan.paired}`);
    lines.push(`活跃 Activity: ${sl.activities.length}`);

    for (const act of sl.activities) {
      const parts = act.participants.map(p => `${p.role}=NPC${p.npc.id}`);
      const sub = act.subState && act.subState !== 'init' ? ` [${act.subState}]` : '';
      lines.push(`  ${act.label}${sub}: ${parts.join(', ')}`);
    }
    return lines.join('\n');
  }
}
