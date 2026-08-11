import { setState }         from '../Motor.js';
import { dlog }             from '../DebugLog.js';
import { Activity }         from './Activity.js';
import { ClipPlayer }       from '../ClipPlayer.js';
import { registerActivity } from '../ActivityRegistry.js';
import { getSubEventPoses } from './ContactActivity.js';

const rand   = (a, b) => a + Math.random() * (b - a);
const chance = (p) => Math.random() < p;

// 起始间距超过 designGap 换算世界像素的这个倍数就放弃这轮子事件——DuetStager
// 的 reach 阶段默认 0.4s（clip 未声明 reach 时）插值走到目标站位，起点太远会
// 在 0.4s 内位移过大，看起来像瞬移。真正的"先 goto 到声明间距再触发"独立相遇层
// （见 docs/design-plans/duet-interaction-design-v1.md「M-1 后附记」）本次不做，
// 先用这个写死的倍数当简化版：超范围直接放弃，效果等同 _selectSubEvent 没抽中；
// 以后要覆盖更大起始距离，再展开成真正的相遇层。
const REACH_SLACK = 2.5;

// P-2：接触掷骰周期（秒）。原来只在 duration 到期那一刻掷一次，是证词管线唯一
// 的进料口却只有一次机会。duration 是 rand(8,18)，取几秒量级的周期能让一场
// 对话摇上若干轮（约 duration/SUB_EVENT_ROLL_INTERVAL 次，8s 对话 2 轮起，
// 18s 对话可达 6 轮）；具体每轮命中率见 NpcProfile.js#socialWeights 的新口径
// 注释（P-2 一并重标定）。
const SUB_EVENT_ROLL_INTERVAL = 3;

// talk_* 说话手势池（PoseCacheBuilder 的 talk_gestures 分类，id 前缀已剥离）
let TALK_GESTURES = {};

export function initTalkGestures(gestures) {
  TALK_GESTURES = gestures || {};
}

export class TalkActivity extends Activity {
  constructor(id, a, b) {
    super(id, 'talk');
    this.requiredRoster = 2;
    this.a = a;
    this.b = b;
    this.duration = rand(8, 18);
    this.subState = 'talking';
    this._rollTimer = 0; // P-2：接触掷骰周期计时，见 SUB_EVENT_ROLL_INTERVAL
    this.admit(a, 'speaker');
    this.admit(b, 'speaker');
    a.bond = this;
    b.bond = this;
    this._faceEachOther();

    // 说话手势轮播：每个说话者独立一个 ClipPlayer，从 talk_gestures 随机抽一条、
    // 每 rand(4,8) 秒换一条（照抄 StallActivity 卖家 _pickSellerClip 的模式）。
    this._aGesture = { player: new ClipPlayer(a, '_talk_gesture'), timer: 0, next: rand(4, 8) };
    this._bGesture = { player: new ClipPlayer(b, '_talk_gesture'), timer: 0, next: rand(4, 8) };
    this._pickTalkClip(this._aGesture.player);
    this._pickTalkClip(this._bGesture.player);
  }

  admit(npc, role) {
    super.admit(npc, role);
    setState(npc, 'talk', 'talk-enter');
    npc.modifiers = npc.modifiers.filter(m => m.kind === 'trait');
  }

  _faceEachOther() {
    const { a, b } = this;
    if (Math.abs(b.x - a.x) > 2) {
      a.direction = (b.x >= a.x) ? 1 : -1;
      b.direction = (a.x >= b.x) ? 1 : -1;
    }
  }

  _pickTalkClip(player) {
    const keys = Object.keys(TALK_GESTURES);
    if (!keys.length) return;
    const key = keys[Math.floor(Math.random() * keys.length)];
    player.play(TALK_GESTURES[key]);
  }

  _tickGesture(npc, g, dt) {
    g.player.update(dt);
    g.timer += dt;
    if (g.timer >= g.next) {
      g.timer = 0;
      g.next  = rand(4, 8);
      this._pickTalkClip(g.player);
    }
  }

  update(dt) {
    if (!this.a.alive || !this.b.alive) return false;
    this.timer += dt;
    this._rollTimer += dt;

    this._faceEachOther();
    this._tickGesture(this.a, this._aGesture, dt);
    this._tickGesture(this.b, this._bGesture, dt);

    // P-2：接触掷骰改周期性——duration 期间每隔 SUB_EVENT_ROLL_INTERVAL 掷一轮，
    // 命中就 handoff 并结束本场 talk；REACH_SLACK 距离否决（_handoffContact 内部
    // 判定，命中但站太远时不会真的 handoff）不算这场对话失败，只当这一轮没掷中，
    // 继续说话等下一轮——用 this._followUp 是否被设置来判断这一轮是不是真正成功
    // handoff 了（否决时 _handoffContact 直接 return，不会设置它）。
    if (this._rollTimer >= SUB_EVENT_ROLL_INTERVAL) {
      this._rollTimer = 0;
      const type = this._selectSubEvent();
      if (type) {
        this._handoffContact(type);
        if (this._followUp) return false;
      }
    }

    if (this.timer >= this.duration) return false;
    return true;
  }

  /**
   * 加权单次抽样（P-1 缺陷 2 修复）：不再是"遍历 keys、第一个掷中就 return"
   * （靠 Object.keys() 插入序决定优先级，不是真正的加权抽样）。总权重
   * `total = Σw[type]` 即本轮"发生接触"的概率（`chance()` 对 `total>=1`
   * 天然恒真，不需要额外 clamp）；一旦发生，具体类型按权重比例抽——
   * 权重缺失（profile 没声明某个类型）视为 0，不给隐性默认值。
   */
  _selectSubEvent() {
    const w = this.a.mem('agenda').profile?.socialWeights || {};
    const types   = Object.keys(getSubEventPoses());
    const weights = types.map(type => w[type] ?? 0);
    const total   = weights.reduce((s, x) => s + x, 0);
    if (total <= 0 || !chance(total)) return null;

    let r = Math.random() * total;
    for (let i = 0; i < types.length; i++) {
      r -= weights[i];
      if (r <= 0) return types[i];
    }
    return types[types.length - 1]; // 浮点误差兜底，权重比例已在上面的循环里体现
  }

  /**
   * 掷骰选中子事件类型后，把控制权移交给 ContactActivity（Patch G：接触互动
   * 从 TalkActivity 抽出，成独立、场合无关的 Activity）——本 activity 这一帧
   * 照常 update() 返回 false 收场，SocialLayer 在 destroy() 之后统一消费
   * handoff() 声明的后继。起始间距超出 REACH_SLACK 倍 designGap 时放弃这轮
   * （见上方常量注释），当作没抽中。
   */
  _handoffContact(type) {
    const cfg = getSubEventPoses()[type];
    if (!cfg || !cfg.frames || !cfg.frames.length) return;

    const roleA = cfg.roles?.[0] ?? 'a';
    const roleB = cfg.roles?.[1] ?? 'b';
    const avgScale  = (this.a.scale + this.b.scale) / 2;
    const targetGap = cfg.designGap * avgScale;
    const actualGap = Math.abs(this.b.x - this.a.x);
    if (actualGap > targetGap * REACH_SLACK) return;

    this.handoff('contact',
      [{ npc: this.a, role: roleA }, { npc: this.b, role: roleB }],
      { clip: type });
    dlog(`[Activity ${this.label}] handoff → contact:${type}`);
  }

  interrupt(reason) { super.interrupt(reason); }

  destroy() {
    if (this.a.alive) this._aGesture.player.clear();
    if (this.b.alive) this._bGesture.player.clear();

    // handoff 场景（即将进 ContactActivity）：state 保持不动，仍是 'talk'
    // （基座动画 'stand'，给接触 clip 没覆盖到的关节——比如腿——一个干净的
    // 中性姿势）。这里如果照常 setState('walk')，ContactActivity 接管前的
    // 这一帧会把 state 切成 walk，随即 sc.activity 又被新 activity 占住、
    // BSM 不再推进，walk 动画冻结在第 0 帧，没被接触 clip 覆盖的关节就会
    // 显示走路第 0 帧的姿势而不是站姿，看着不对。
    const handingOff = !!this._followUp;
    for (const { npc } of this.participants) {
      npc.bond = null;
      if (!handingOff && npc.alive) setState(npc, 'walk', 'activity-end');
    }
    super.destroy();
  }
}

registerActivity('talk', (id, participants) =>
  new TalkActivity(id, participants[0].npc, participants[1].npc));
