/**
 * BehaviorManager — 普通行人的中央行为状态机调度器
 *
 * 职责（本轮范围：仅"普通行人"，第一批状态）：
 *   - 持有被托管的 NPC（普通行人），每帧推进各自状态机、处理状态转换
 *   - 扫描距离近且都在 stand 的两人，随机配成 talk（SocialBond 同步双方）
 *   - 不处理：chess/cycle/dance/squat/dogwalk 等专用行为（仍由各 spawner 自理）
 *   - 暂不实现镜头反应（依赖社会稳定度系统）
 *
 * 状态：walk / run / stand / sit_bench / fall / lie_ground / talk
 * 叠加：phone_look（仅置标志，视觉 overlay 由后续肢体代码实现）
 *
 * 注意：BehaviorManager 只设置 npc.state / animation / speed / direction 等，
 *       实际的位移与帧推进仍由 NPC.update()（经 EntityManager.update）执行。
 *       因此每帧顺序应为：behaviorManager.update() → entityManager.update()。
 */

const rand  = (a, b) => a + Math.random() * (b - a);
const chance = (p) => Math.random() < p;

// 状态 → 动画 / 速度系数 / 是否单次播放 / 时长区间(秒, null=由动画结束驱动)
const STATE_DEFS = {
  walk:       { anim: 'walk',       speedK: 1.0, once: false, dur: [4, 10] },
  run:        { anim: 'run',        speedK: 2.4, once: false, dur: [2, 4]  },
  stand:      { anim: 'single',     speedK: 0,   once: false, dur: [3, 8]  },
  sit_bench:  { anim: 'sit_bench',  speedK: 0,   once: true,  dur: [8, 15] },
  fall:       { anim: 'fall',       speedK: 0,   once: true,  dur: null    },
  lie_ground: { anim: 'lie_ground', speedK: 0,   once: true,  dur: [4, 8]  },
  talk:       { anim: 'single',     speedK: 0,   once: false, dur: null    },
};

class SocialBond {
  constructor(a, b) {
    this.a = a;
    this.b = b;
    this.timer = 0;
    this.duration = rand(8, 18);
    a.bond = this;
    b.bond = this;
  }
  // 让两人面对面
  faceEachOther() {
    const { a, b } = this;
    a.direction = (b.x >= a.x) ? 1 : -1;
    b.direction = (a.x >= b.x) ? 1 : -1;
  }
  update(dt) {
    this.timer += dt;
    this.faceEachOther();
    return this.timer < this.duration; // false = 结束
  }
  break_() {
    this.a.bond = null;
    this.b.bond = null;
  }
}

export class BehaviorManager {
  /** @param {EntityManager} entityManager */
  constructor(entityManager) {
    this.em    = entityManager;
    this.npcs  = [];   // 被托管的普通行人
    this.bonds = [];   // 活跃社交关系
    this.talkScanTimer = 0;
  }

  register(npc) {
    npc.walkSpeed = npc.speed > 0 ? npc.speed : rand(20, 34);
    this.npcs.push(npc);
    this._setState(npc, 'walk');
  }

  // ─── 进入某状态：设置动画/速度/计时/朝向，重置帧 ──────────────────────────
  _setState(npc, state) {
    const def = STATE_DEFS[state];
    npc.state       = state;
    npc.stateTimer  = 0;
    npc.stateDur    = def.dur ? rand(def.dur[0], def.dur[1]) : Infinity;
    npc.animation   = def.anim;
    npc.speed       = def.speedK * (npc.walkSpeed || 26);
    npc.vy          = 0;            // 纵深速度由漫游转向逐帧设定；非移动态归零防漂移
    npc.playOnce    = def.once;
    npc.animDone    = false;
    npc.frameIndex  = 0;
    npc.frameTimer  = 0;
    // 漫游 NPC 每次进入 walk 重新挑选目标点 → 路径更自然多变
    if (npc.roam && (state === 'walk' || state === 'run')) npc.roamTarget = null;
  }

  // ─── 二维漫游转向：把"朝目标点"的速度分解到水平 speed + 纵深 vy ────────────
  //   NPC.update 会按 direction*speed 推进 X、按 vy 推进 Y，并夹在 roam 矩形内。
  //   到达目标后另挑一个矩形内随机点，从而在公园/广场内自由游走（Y 变化触发缩放/排序）。
  _steerRoam(npc) {
    if (!npc.roamTarget) this._pickRoamTarget(npc);
    const t = npc.roamTarget;
    const dx = t.x - npc.x;
    const dy = t.y - npc.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 6) { this._pickRoamTarget(npc); return; }
    const total = (npc.walkSpeed || 26) * (npc.state === 'run' ? 2.4 : 1);
    npc.direction = dx >= 0 ? 1 : -1;
    npc.speed     = Math.abs(dx) / dist * total;
    npc.vy        = dy / dist * total;
  }

  _pickRoamTarget(npc) {
    const r = npc.roam;
    npc.roamTarget = { x: rand(r.x0, r.x1), y: rand(r.y0, r.y1) };
  }

  update(delta) {
    const dt = delta / 1000;

    // 1) 维护社交关系
    for (let i = this.bonds.length - 1; i >= 0; i--) {
      const bond = this.bonds[i];
      const alive = bond.a.alive && bond.b.alive && bond.update(dt);
      if (!alive) {
        bond.break_();
        this.bonds.splice(i, 1);
        if (bond.a.alive) this._setState(bond.a, 'walk');
        if (bond.b.alive) this._setState(bond.b, 'walk');
      }
    }

    // 2) 各 NPC 状态机（被 bond 接管的跳过）
    for (const npc of this.npcs) {
      if (!npc.alive || npc.bond) continue;
      npc.stateTimer += dt;
      this._tick(npc);
      // 漫游 NPC 在 walk/run 态逐帧转向目标点
      if (npc.roam && (npc.state === 'walk' || npc.state === 'run')) this._steerRoam(npc);
      this._tickOverlay(npc, dt);
    }

    // 3) 周期性尝试配对 talk
    this.talkScanTimer += dt;
    if (this.talkScanTimer >= 0.8) {
      this.talkScanTimer = 0;
      this._tryPairTalk();
    }
  }

  _tick(npc) {
    switch (npc.state) {
      case 'walk':
        if (chance(0.0008)) { this._setState(npc, 'run'); break; }
        if (npc.stateTimer >= npc.stateDur) {
          // 多数停下，少量继续走，偶尔（靠近长椅）坐下
          if (chance(0.18) && this._nearBench(npc)) this._setState(npc, 'sit_bench');
          else                                       this._setState(npc, 'stand');
        }
        break;

      case 'run':
        if (chance(0.00012)) { this._setState(npc, 'fall'); break; }
        if (npc.stateTimer >= npc.stateDur) this._setState(npc, 'walk');
        break;

      case 'stand':
        if (npc.stateTimer >= npc.stateDur) this._setState(npc, 'walk');
        break;

      case 'sit_bench':
        if (npc.stateTimer >= npc.stateDur) this._setState(npc, 'stand');
        break;

      case 'fall':
        if (npc.animDone) this._setState(npc, 'lie_ground');
        break;

      case 'lie_ground':
        if (npc.stateTimer >= npc.stateDur) this._setState(npc, 'stand'); // 慢慢爬起
        break;
    }
  }

  // 叠加动作（phone_look）：仅置/清标志，视觉 overlay 后续实现
  _tickOverlay(npc, dt) {
    // 只在 walk / stand 时考虑看手机
    const canPhone = (npc.state === 'walk' || npc.state === 'stand');
    if (!canPhone) { npc.overlay = null; return; }
    if (npc.overlay === 'phone_look') {
      npc._overlayTimer -= dt;
      if (npc._overlayTimer <= 0) npc.overlay = null;
    } else if (chance(0.004)) {
      npc.overlay = 'phone_look';
      npc._overlayTimer = rand(5, 25);
    }
  }

  // 附近是否有长椅（用 EntityManager 查询，半径内）
  _nearBench(npc) {
    for (const e of this.em.entities) {
      if (e.propType === 'bench' && Math.abs(e.x - npc.x) < 60 &&
          Math.abs(e.y - npc.y) < 80) return true;
    }
    return false;
  }

  // 扫描可配对的两名 stand 行人 → 随机生成 talk
  _tryPairTalk() {
    const standers = this.npcs.filter(n => n.alive && !n.bond && n.state === 'stand');
    for (let i = 0; i < standers.length; i++) {
      for (let j = i + 1; j < standers.length; j++) {
        const a = standers[i], b = standers[j];
        if (a.bond || b.bond) continue;
        const dx = Math.abs(a.x - b.x);
        const dy = Math.abs(a.y - b.y);
        if (dx < 70 && dx > 14 && dy < 24 && chance(0.5)) {
          const bond = new SocialBond(a, b);
          this._enterTalk(a);
          this._enterTalk(b);
          bond.faceEachOther();
          this.bonds.push(bond);
        }
      }
    }
  }

  _enterTalk(npc) {
    const def = STATE_DEFS.talk;
    npc.state      = 'talk';
    npc.stateTimer = 0;
    npc.animation  = def.anim;
    npc.speed      = 0;
    npc.playOnce   = false;
    npc.animDone   = false;
    npc.frameIndex = 0;
    npc.frameTimer = 0;
    npc.overlay    = null;
  }
}
