// Gift viewer entry for the shop (/g/). Runs before the skill template's app.js and tells its
// content.js where the gift is:  ?id=xxxx → encrypted files from the API · ?preview → the buyer's
// unpaid draft from this browser · ?demo → the bundled example.  Classic script: must set globals
// synchronously, before app.js (a module) evaluates.
(function () {
  const q = new URLSearchParams(location.search);
  const API = (window.SHOP_API || '').replace(/\/$/, '');
  const id = (q.get('id') || '').toLowerCase();
  const PREVIEW = q.has('preview');
  const plain = async (input, media) => {
    const { buildStory } = await import('./js/story-builder.js');
    return { STORY: buildStory(input), media };
  };
  // Preview = fully interactive, but not a finished gift: watermark + only the start of the letter.
  // A screen recording of it is worth little; the interactive link is what people pay for.
  const previewInput = (input) => {
    const lines = String(input.letter || '').split(/\r?\n/);
    const shown = lines.filter((l) => l.trim()).slice(0, 2);
    return { ...input, letter: [...shown, '', '……', '（完整的信，生成正式礼物后才能看到）'].join('\n') };
  };
  if (/^[a-z0-9]{10}$/.test(id)) {
    window.GIFT_ID = id;
    window.GIFT_VAULT = `${API}/api/gift/${id}/`;
  } else if (PREVIEW) {
    window.GIFT_PREVIEW = (async () => {
      const { getDraft, getMedia, buildInput } = await import('../js/draft.js');
      const d = await getDraft();
      if (!d || !d.items?.length) { alert('这台手机上没有找到草稿，请回到制作页面'); location.href = '../make.html'; throw new Error('no draft'); }
      const media = [];
      for (const it of d.items) {
        const m = await getMedia(it.id); if (!m) continue;
        media.push({ id: it.id, type: it.type, w: it.w, h: it.h, date: it.date || '',
          src: URL.createObjectURL(m.blob), poster: m.poster ? URL.createObjectURL(m.poster) : undefined });
      }
      return plain(previewInput(buildInput(d)), media);
    })();
  } else {
    if (!q.has('demo')) window.GIFT_BROKEN = true; // broken link → show the example with a note
    window.GIFT_PREVIEW = fetch('demo/demo.json').then((r) => r.json()).then((j) => plain(j.input, j.media));
  }
  if (!window.GIFT_PREVIEW) return; // a real gift: no shop UI at all

  const css = `
  .shopbar{position:fixed;z-index:999;top:max(10px,env(safe-area-inset-top));right:10px;display:flex;gap:6px;
    font:14px/1 -apple-system,"PingFang SC",sans-serif}
  .shopbar a{display:inline-flex;align-items:center;gap:4px;padding:9px 13px;border-radius:999px;text-decoration:none;
    background:rgba(251,244,232,.94);color:#3a2a1f;box-shadow:0 4px 16px rgba(0,0,0,.3);white-space:nowrap}
  .shopbar a.go{background:linear-gradient(180deg,#f6c15b,#e8962e);color:#3a1d08}
  .wm{position:fixed;inset:0;z-index:998;pointer-events:none;overflow:hidden;opacity:.16}
  .wm div{position:absolute;left:-50%;top:-50%;width:200%;height:200%;transform:rotate(-24deg);
    display:flex;flex-wrap:wrap;align-content:flex-start;gap:90px 70px;
    font:600 24px/1 -apple-system,"PingFang SC",sans-serif;color:#fff;letter-spacing:.2em}
  .gnote{position:fixed;left:50%;bottom:calc(84px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:999;
    background:rgba(251,244,232,.94);color:#3a2a1f;padding:7px 14px;border-radius:999px;font:13px/1.3 -apple-system,"PingFang SC",sans-serif;
    white-space:nowrap;max-width:92vw;overflow:hidden;text-overflow:ellipsis;transition:opacity 1s}`;
  addEventListener('DOMContentLoaded', () => {
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    const bar = document.createElement('div'); bar.className = 'shopbar';
    bar.innerHTML = PREVIEW
      ? '<a href="../make.html">‹ 回去修改</a><a class="go" href="../make.html#pay">生成正式礼物</a>'
      : '<a href="../">‹ 首页</a><a class="go" href="../make.html">我也做一个</a>';
    document.body.appendChild(bar);
    const note = document.createElement('div'); note.className = 'gnote';
    note.textContent = PREVIEW ? '预览版 · 有水印，信只显示开头' : window.GIFT_BROKEN ? '链接好像不完整，这是一个示例礼物' : '示例礼物 · 照片是画的';
    document.body.appendChild(note);
    setTimeout(() => { note.style.opacity = '0'; setTimeout(() => note.remove(), 1200); }, 7000);
    if (PREVIEW) {
      const wm = document.createElement('div'); wm.className = 'wm';
      wm.innerHTML = '<div>' + '预览 · 未付款　'.repeat(120) + '</div>';
      document.body.appendChild(wm);
    }
  });
})();
