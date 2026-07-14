/**
 * providers.js — vision / text provider 层
 *
 * 接口：
 *   vision.describe(pngBase64: string): Promise<string>
 *   text.compose({ visionReport, playerStance, playerDraft, testimony:[] }): Promise<string>
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
async function _liveText({ visionReport, playerStance, playerDraft }) {
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
          content: '你是一个新闻记者，根据现场描述、立场和记者草稿撰写 100~150 字的新闻报道。立场枚举：neutral=客观中性 / incite=激进煽动 / sympathy=同情立场。',
        },
        {
          role: 'user',
          content: `现场描述：${visionReport}\n立场：${playerStance}\n记者草稿：${playerDraft || '（无）'}`,
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

function _mockText({ visionReport, playerStance, playerDraft, entitySnapshot }) {
  const stance  = STANCE_WORD[playerStance] ?? '据悉';
  const main    = entitySnapshot?.entities?.[0]?.tags?.[0] ?? '现场目标';
  const draft   = playerDraft ? `记者观察：${playerDraft}` : '';
  return `【快讯】${stance}${main}现场情况引发关注。\n\n${visionReport}\n\n${draft}`.trim();
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
    return { text: _mockText({ visionReport, playerStance, playerDraft, entitySnapshot: _lastSnapshot }), mock: true };
  }
  try {
    const text = await _liveText({ visionReport, playerStance, playerDraft });
    return { text, mock: false };
  } catch (err) {
    console.warn('[providers] text 降级 mock:', err.message);
    return { text: _mockText({ visionReport, playerStance, playerDraft, entitySnapshot: _lastSnapshot }), mock: true };
  }
}

export const vision = { describe };
export const text   = { compose  };
