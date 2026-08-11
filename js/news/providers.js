/**
 * providers.js — vision / text / interrogate provider 层
 *
 * 接口：
 *   vision.describe(pngBase64: string): Promise<string>
 *   text.compose({ visionReport, playerStance, playerDraft, testimony:[] }): Promise<string>
 *   interrogate.ask({ question, knownClaims:[] }): Promise<{slot, value, mock}>
 *
 * interrogate 复用 TEXT_KEY/TEXT_BASE（同一个文本 LLM 能力，只是任务不同：
 * 一个是"写文章"，一个是"把提问归类到 claim 槽位"），不额外开一套 key/base
 * 设置项——三个 provider 里 vision 单独一套 key（多模态），text/interrogate
 * 共享一套（都是纯文本任务），这是刻意的范围控制，不是遗漏。
 *
 * interrogate 的唯一职责（W-7e）：把中文问句归类到五个槽位之一，并抽取
 * **问句措辞里出现过的**候选值——不推断、不编造、不用常识或已知线索补全。
 * 抽不到就是 value:null，这是合法结果，调用方不会拿 null 去写 belief。
 *
 * key / base URL 仅读写 localStorage，永不落盘，永不进 repo。
 * key 缺失或请求失败 → 自动降级 mock，返回 provider 标记。
 */

// ── localStorage 键名 ──────────────────────────────────────────────────────────
const K = {
  VISION_KEY:  'news_vision_key',
  VISION_BASE: 'news_vision_base',
  TEXT_KEY:    'news_text_key',
  TEXT_BASE:   'news_text_base',
};

const DEFAULT = {
  VISION_BASE: 'https://api.openai.com/v1',
  TEXT_BASE:   'https://api.deepseek.com/v1',
};

function lsGet(key, def = '') { return localStorage.getItem(key) || def; }

// ── live：vision.describe ──────────────────────────────────────────────────────
async function _liveVision(pngBase64) {
  const key  = lsGet(K.VISION_KEY);
  const base = lsGet(K.VISION_BASE, DEFAULT.VISION_BASE);
  const resp = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: '请用中文分点描述图中所见，包括：人数、各自动作、可见物体、空间关系。不确定的内容直接说不确定，不要猜测。不限长度，完整描述。' },
          { type: 'image_url', image_url: { url: pngBase64 } },
        ],
      }],
    }),
  });
  if (!resp.ok) throw new Error(`vision HTTP ${resp.status}`);
  const data = await resp.json();
  return data.choices[0].message.content;
}

// ── live：text.compose ─────────────────────────────────────────────────────────
async function _liveText({ visionReport, playerStance, playerDraft, testimony = [] }) {
  const key  = lsGet(K.TEXT_KEY);
  const base = lsGet(K.TEXT_BASE, DEFAULT.TEXT_BASE);
  const testimonyLine = testimony.length > 0 ? `目击者证词：${testimony.join('；')}` : '目击者证词：（无）';
  const resp = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: '你是一个新闻记者，根据现场描述、立场、记者草稿和目击者证词撰写 100~150 字的新闻报道。立场枚举：neutral=客观中性 / incite=激进煽动 / sympathy=同情立场。证词标注"（未经证实）"的部分只能作为记者听闻转述，不能当作确证事实直接下结论。',
        },
        {
          role: 'user',
          content: `现场描述：${visionReport}\n立场：${playerStance}\n记者草稿：${playerDraft || '（无）'}\n${testimonyLine}`,
        },
      ],
    }),
  });
  if (!resp.ok) throw new Error(`text HTTP ${resp.status}`);
  const data = await resp.json();
  return data.choices[0].message.content;
}

// ── mock：vision ───────────────────────────────────────────────────────────────
function _mockVision(entitySnapshot) {
  const entities = entitySnapshot?.entities ?? [];
  const people   = entities.filter(e => e.tags.some(t => ['npc', 'pedestrian', 'athlete', 'chess-player', 'dog-walker'].includes(t)));
  const objects  = entities.filter(e => !people.includes(e));

  let lines = [`画面中 ${people.length} 个人物。`];
  for (const p of people) {
    const detail = p.tags.filter(t => !['npc', 'pedestrian'].includes(t)).join('、') || '行走';
    lines.push(`- 1 人 ${detail}`);
  }
  if (objects.length > 0) {
    const objNames = objects.map(o => o.tags[0] ?? 'unknown').join('、');
    lines.push(`背景可见：${objNames}。`);
  }
  return lines.join('\n');
}

// ── mock：text ─────────────────────────────────────────────────────────────────
const STANCE_WORD = { neutral: '据悉', incite: '惊爆！', sympathy: '令人动容：' };

function _mockText({ visionReport, playerStance, playerDraft, testimony = [], entitySnapshot }) {
  const stance  = STANCE_WORD[playerStance] ?? '据悉';
  const main    = entitySnapshot?.entities?.[0]?.tags?.[0] ?? '现场目标';
  const draft   = playerDraft ? `记者观察：${playerDraft}` : '';
  const witness = testimony.length > 0 ? `\n\n目击者说：${testimony.join('；')}` : '';
  return `【快讯】${stance}${main}现场情况引发关注。\n\n${visionReport}\n\n${draft}${witness}`.trim();
}

// ── live：interrogate.ask ────────────────────────────────────────────────────
async function _liveInterrogate({ question, knownClaims }) {
  const key  = lsGet(K.TEXT_KEY);
  const base = lsGet(K.TEXT_BASE, DEFAULT.TEXT_BASE);
  const resp = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: '你是审问记录员。玩家会用中文向目击者提一个问题。把问题归类到五个槽位之一：'
            + 'actor(谁做的)/action(做了什么)/target(对谁做的)/place(在哪)/time(什么时候)。'
            + '候选答案只能从玩家问句本身的措辞里抽取——比如"是不是那个穿西装的推的？"里'
            + '"穿西装的"就是 actor 的候选值。"已知线索"只用来帮你判断这句问题问的是哪个'
            + '槽位，绝对不能当成候选答案的来源；不要推断、不要编造、不要用常识或已知线索'
            + '去补全一个问句里没有出现过的答案。如果问句本身没有暗示任何具体值，value 必须'
            + '是 null——这是合法结果，不是失败。只输出 JSON，形如'
            + '{"slot":"actor","value":"穿西装的"} 或 {"slot":"actor","value":null}，'
            + '不要输出任何其他文字。',
        },
        {
          role: 'user',
          content: `已知线索（仅供判断槽位，不得当作答案来源）：${JSON.stringify(knownClaims)}\n玩家提问：${question}`,
        },
      ],
    }),
  });
  if (!resp.ok) throw new Error(`interrogate HTTP ${resp.status}`);
  const data = await resp.json();
  const raw = data.choices[0].message.content.trim().replace(/^```json\s*|```$/g, '');
  const parsed = JSON.parse(raw);
  // value:null 是合法结果（问句没暗示具体答案），只有 slot 缺失才算真的解析失败
  if (!parsed.slot) throw new Error('interrogate: 返回值缺 slot');
  return { slot: parsed.slot, value: parsed.value ?? null };
}

// ── mock：interrogate ────────────────────────────────────────────────────────
const SLOT_KEYWORDS = [
  ['actor',  ['谁做', '是谁', '谁在', '哪个人', '什么人']],
  ['target', ['对谁', '跟谁', '打了谁', '针对谁']],
  ['place',  ['哪里', '哪儿', '在哪', '什么地方']],
  ['time',   ['什么时候', '几点', '何时']],
  // action 没有专属关键词——找不到其他槽位关键词时的默认落点（"发生了什么"最常问）
];

function _detectSlot(question) {
  for (const [slot, kws] of SLOT_KEYWORDS) {
    if (kws.some(k => question.includes(k))) return slot;
  }
  return 'action';
}

// mock 没有真实语言理解能力，抽不出"问句措辞里的候选值"——只能退而求其次，
// 从 knownClaims 里找这个槽已有的值当候选（这是 mock 唯一可行的近似，不是
// 违反"LLM 只抽取不发明"：live 版才真的做措辞抽取，mock 只是查表）。
// 找不到就是 value:null，不再用一句占位客套话兜底——那样的字符串会被当成
// 真实候选值直接注入进信念，而它根本不是任何人说过的话。
function _mockInterrogate({ question, knownClaims }) {
  const slot  = _detectSlot(question);
  const known = knownClaims.find(c => c[slot] != null);
  const value = known ? known[slot] : null;
  return { slot, value };
}

// ── 公共入口（带降级逻辑）─────────────────────────────────────────────────────

// entitySnapshot 存储在此，供 mock 使用（拍照时由外部写入）
let _lastSnapshot = null;
export function setLastSnapshot(snap) { _lastSnapshot = snap; }

async function describe(pngBase64) {
  const key = lsGet(K.VISION_KEY);
  if (!key) {
    return { text: _mockVision(_lastSnapshot), mock: true };
  }
  try {
    const text = await _liveVision(pngBase64);
    return { text, mock: false };
  } catch (err) {
    console.warn('[providers] vision 降级 mock:', err.message);
    return { text: _mockVision(_lastSnapshot), mock: true };
  }
}

async function compose({ visionReport, playerStance, playerDraft, testimony = [] }) {
  const key = lsGet(K.TEXT_KEY);
  if (!key) {
    return { text: _mockText({ visionReport, playerStance, playerDraft, testimony, entitySnapshot: _lastSnapshot }), mock: true };
  }
  try {
    const text = await _liveText({ visionReport, playerStance, playerDraft, testimony });
    return { text, mock: false };
  } catch (err) {
    console.warn('[providers] text 降级 mock:', err.message);
    return { text: _mockText({ visionReport, playerStance, playerDraft, testimony, entitySnapshot: _lastSnapshot }), mock: true };
  }
}

async function ask({ question, knownClaims = [] }) {
  const key = lsGet(K.TEXT_KEY);
  if (!key) {
    return { ..._mockInterrogate({ question, knownClaims }), mock: true };
  }
  try {
    const result = await _liveInterrogate({ question, knownClaims });
    return { ...result, mock: false };
  } catch (err) {
    console.warn('[providers] interrogate 降级 mock:', err.message);
    return { ..._mockInterrogate({ question, knownClaims }), mock: true };
  }
}

export const vision      = { describe };
export const text        = { compose  };
export const interrogate = { ask      };
