/**
 * NewsUI — HTML overlay 成稿面板 + 存档面板 + 设置面板
 *
 * 挂载到 #news-ui-root（pointer-events:none），面板显示时内部元素 pointer-events:auto。
 */

const PANEL_STYLE = `
  position:absolute; top:50%; left:50%; transform:translate(-50%,-50%);
  background:rgba(14,14,26,0.96); color:#e0ddd8; border:1px solid #444;
  border-radius:6px; padding:0; min-width:480px; max-width:640px; width:90%;
  font-family:'Noto Sans SC',sans-serif; font-size:14px;
  pointer-events:auto; box-shadow:0 8px 32px rgba(0,0,0,0.7);
`;

const BTN = `
  display:inline-block; padding:6px 16px; border-radius:4px; cursor:pointer;
  border:none; font-family:inherit; font-size:14px; color:#fff;
`;

function el(tag, style, html = '') {
  const e = document.createElement(tag);
  if (style) e.style.cssText = style;
  if (html)  e.innerHTML = html;
  return e;
}

function header(title, closeFn) {
  const h = el('div', 'display:flex;justify-content:space-between;align-items:center;padding:10px 16px;border-bottom:1px solid #333;');
  const t = el('span', 'font-weight:bold;font-size:15px;', title);
  const x = el('button', `${BTN} background:transparent; font-size:18px; padding:2px 8px;`, '✕');
  x.addEventListener('click', closeFn);
  h.appendChild(t); h.appendChild(x);
  return h;
}

export class NewsUI {
  constructor(root, archive, providers) {
    this._root     = root;
    this._archive  = archive;
    this._providers = providers;
    this._panel    = null;
  }

  // ── 成稿面板 ──────────────────────────────────────────────────────────────────
  openComposer({ photoRef, entitySnapshot, visionPromise }) {
    this.close();
    const panel = el('div', PANEL_STYLE);

    // ── header ──
    const isMockRef = { val: false };
    const mockBadge = el('span', 'color:#f0a000;margin-right:8px;display:none;', '[MOCK]');
    const titleSpan = el('span', 'font-weight:bold;font-size:15px;', '新闻成稿');
    const closeBtn  = el('button', `${BTN} background:transparent; font-size:18px; padding:2px 8px;`, '✕');
    closeBtn.addEventListener('click', () => this.close());
    const hdr = el('div', 'display:flex;justify-content:space-between;align-items:center;padding:10px 16px;border-bottom:1px solid #333;');
    const htLeft = el('div', 'display:flex;align-items:center;');
    htLeft.appendChild(mockBadge); htLeft.appendChild(titleSpan);
    hdr.appendChild(htLeft); hdr.appendChild(closeBtn);
    panel.appendChild(hdr);

    // ── photo + vision ──
    const midRow = el('div', 'display:flex;gap:12px;padding:12px 16px;');
    const img = el('img', 'width:80px;height:60px;object-fit:cover;border:1px solid #555;flex-shrink:0;');
    img.src = photoRef;
    const visionBox = el('div', 'flex:1;background:#1a1a2e;padding:8px;border-radius:4px;font-size:13px;line-height:1.6;min-height:60px;white-space:pre-wrap;color:#bbb;', '⏳ 分析中…');
    midRow.appendChild(img); midRow.appendChild(visionBox);
    panel.appendChild(midRow);

    // ── stance + draft ──
    const stanceRow = el('div', 'padding:8px 16px;display:flex;align-items:center;gap:12px;border-top:1px solid #222;');
    stanceRow.innerHTML = '<span style="color:#888;">立场：</span>';
    const stanceInput = {};
    for (const [val, lbl] of [['neutral','中立'],['incite','煽动'],['sympathy','同情']]) {
      const id = `stance_${val}_${Date.now()}`;
      const wrap = el('label', 'cursor:pointer;display:flex;align-items:center;gap:4px;');
      const rb = document.createElement('input');
      rb.type = 'radio'; rb.name = `stance_${Date.now()}`; rb.value = val; rb.id = id;
      if (val === 'neutral') rb.checked = true;
      wrap.appendChild(rb); wrap.appendChild(document.createTextNode(lbl));
      stanceRow.appendChild(wrap);
      stanceInput[val] = rb;
    }
    panel.appendChild(stanceRow);

    const draftRow = el('div', 'padding:4px 16px 8px;');
    const textarea = el('textarea', 'width:100%;height:56px;background:#111;color:#ddd;border:1px solid #444;padding:6px;font-size:13px;font-family:inherit;resize:vertical;box-sizing:border-box;border-radius:3px;');
    textarea.placeholder = '记者草稿（可选）…';
    draftRow.appendChild(textarea);
    panel.appendChild(draftRow);

    const genRow = el('div', 'padding:0 16px 10px;text-align:right;');
    const genBtn = el('button', `${BTN} background:#2a5ab8; opacity:0.5; pointer-events:none;`, '生成文章 →');
    genRow.appendChild(genBtn);
    panel.appendChild(genRow);

    // ── article area (hidden until generated) ──
    const artDiv = el('div', 'display:none;');
    const artSep = el('div', 'padding:8px 16px 4px;border-top:1px solid #333;color:#888;font-size:12px;', '── 文章 ──');
    const artText = el('div', 'padding:4px 16px 10px;line-height:1.7;white-space:pre-wrap;font-size:14px;');
    const pubRow  = el('div', 'padding:0 16px 12px;text-align:right;');
    const pubBtn  = el('button', `${BTN} background:#1a6e3a;`, '发布存档');
    pubRow.appendChild(pubBtn);
    artDiv.appendChild(artSep); artDiv.appendChild(artText); artDiv.appendChild(pubRow);
    panel.appendChild(artDiv);

    // ── logic ──
    let visionReport = '';
    let resolvedMock = false;

    visionPromise.then(result => {
      visionReport = result.text;
      resolvedMock = result.mock;
      visionBox.textContent = visionReport;
      if (resolvedMock) mockBadge.style.display = '';
      genBtn.style.opacity = '1';
      genBtn.style.pointerEvents = 'auto';
    }).catch(err => {
      visionBox.textContent = '（描述获取失败）';
      console.error('[NewsUI] vision error', err);
    });

    genBtn.addEventListener('click', async () => {
      genBtn.textContent = '生成中…';
      genBtn.style.pointerEvents = 'none';
      const stance = Object.values(stanceInput).find(r => r.checked)?.value ?? 'neutral';
      const draft  = textarea.value.trim();
      try {
        const result = await this._providers.text.compose({
          visionReport, playerStance: stance, playerDraft: draft, testimony: [],
        });
        if (result.mock) mockBadge.style.display = '';
        artText.textContent = result.text;
        artDiv.style.display = '';
        panel._composeResult = { visionReport, stance, draft, articleText: result.text, mock: result.mock || resolvedMock };
        genBtn.textContent = '生成文章 →';
      } catch (err) {
        genBtn.textContent = '生成失败，重试';
        genBtn.style.pointerEvents = 'auto';
        console.error('[NewsUI] compose error', err);
      }
    });

    pubBtn.addEventListener('click', () => {
      const r = panel._composeResult;
      if (!r) return;
      const article = {
        id:             this._archive.makeId(),
        photoRef,
        visionReport:   r.visionReport,
        entitySnapshot,
        playerStance:   r.stance,
        playerDraft:    r.draft,
        articleText:    r.articleText,
        provider:       r.mock ? 'mock' : 'live',
        timestamp:      Date.now(),
      };
      this._archive.publishArticle(article);
      this.close();
    });

    this._root.appendChild(panel);
    this._panel = panel;
  }

  // ── 存档面板 ──────────────────────────────────────────────────────────────────
  openArchive() {
    this.close();
    const panel = el('div', PANEL_STYLE + 'max-height:70vh;display:flex;flex-direction:column;');
    panel.appendChild(header('新闻存档', () => this.close()));

    const list = el('div', 'overflow-y:auto;flex:1;padding:8px 16px;');

    if (this._archive.articles.length === 0) {
      list.appendChild(el('div', 'color:#666;padding:20px 0;text-align:center;', '暂无存档'));
    } else {
      for (const art of [...this._archive.articles].reverse()) {
        const row = el('div', 'display:flex;gap:10px;padding:10px 0;border-bottom:1px solid #222;align-items:flex-start;');
        const thumb = el('img', 'width:60px;height:44px;object-fit:cover;border:1px solid #444;flex-shrink:0;');
        thumb.src = art.photoRef;
        const info = el('div', 'flex:1;');
        const ts   = new Date(art.timestamp).toLocaleString('zh-CN', { hour12: false });
        const badge = art.provider === 'mock' ? '<span style="color:#f0a000;">[MOCK]</span> ' : '<span style="color:#3a9;">[LIVE]</span> ';
        info.innerHTML = `<div style="font-size:12px;color:#777;margin-bottom:4px;">${badge}${ts}</div><div style="line-height:1.5;">${art.articleText.slice(0, 80)}…</div>`;
        row.appendChild(thumb); row.appendChild(info);
        list.appendChild(row);
      }
    }
    panel.appendChild(list);
    this._root.appendChild(panel);
    this._panel = panel;
  }

  // ── 设置面板 ──────────────────────────────────────────────────────────────────
  openSettings() {
    this.close();
    const panel = el('div', PANEL_STYLE);
    panel.appendChild(header('API 设置', () => this.close()));

    const form = el('div', 'padding:14px 16px;display:flex;flex-direction:column;gap:10px;');
    const fields = [
      ['Vision key',  'news_vision_key',  'password', ''],
      ['Vision base', 'news_vision_base', 'text',     'https://api.openai.com/v1'],
      ['Text key',    'news_text_key',    'password', ''],
      ['Text base',   'news_text_base',   'text',     'https://api.deepseek.com/v1'],
    ];
    const inputs = {};
    for (const [lbl, key, type, def] of fields) {
      const row = el('div', 'display:flex;align-items:center;gap:10px;');
      const label = el('label', 'width:90px;color:#aaa;flex-shrink:0;', lbl + ':');
      const inp = document.createElement('input');
      inp.type = type;
      inp.value = localStorage.getItem(key) || def;
      inp.style.cssText = 'flex:1;background:#111;color:#ddd;border:1px solid #444;padding:5px 8px;border-radius:3px;font-family:inherit;font-size:13px;';
      row.appendChild(label); row.appendChild(inp);
      form.appendChild(row);
      inputs[key] = inp;
    }
    const saveRow = el('div', 'text-align:center;padding-top:4px;');
    const saveBtn = el('button', `${BTN} background:#2a5ab8;`, '保存到 localStorage');
    saveBtn.addEventListener('click', () => {
      for (const [key, inp] of Object.entries(inputs)) {
        if (inp.value.trim()) localStorage.setItem(key, inp.value.trim());
        else localStorage.removeItem(key);
      }
      this.close();
    });
    saveRow.appendChild(saveBtn);
    form.appendChild(saveRow);
    panel.appendChild(form);
    this._root.appendChild(panel);
    this._panel = panel;
  }

  close() {
    if (this._panel) { this._panel.remove(); this._panel = null; }
  }

  isOpen() { return !!this._panel; }
}
