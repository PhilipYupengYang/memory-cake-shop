// 回忆蛋糕 — order flow: who → photos → letter → password → preview + redeem code → encrypt + upload.
// Everything heavy (resizing, encryption) happens on the buyer's phone; the server only stores opaque blobs.
import { getDraft, saveDraft, getMedia, putMedia, delMedia, chaptersOf, buildInput, fillText } from './draft.js';

const SHOP = window.SHOP || {};
const API = (SHOP.apiBase || '').replace(/\/$/, '');
const $ = (id) => document.getElementById(id);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const MAX_PHOTOS = 120, MAX_VIDEOS = 3, MAX_VIDEO_BYTES = 45 * 1024 * 1024, LONG_SIDE = 1600;
const ITER = 250000;

let d = (await getDraft().catch(() => null)) || {};
d = { step: 0, lang: 'zh', items: [], ...d };
let step = Math.min(d.step || 0, d.done ? 5 : 4);
if (location.hash === '#pay' && (d.items || []).length >= 3 && d.pw) step = 4; // from the preview's 生成 button

// ------------------------------------------------------------------ helpers
function toast(msg, ms = 2200) {
  const t = $('toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('on'), ms);
}
let saveT;
function save() {
  clearTimeout(saveT);
  saveT = setTimeout(() => saveDraft(d).then(() => { $('saved').textContent = '草稿已保存 ✓'; }).catch(() => {
    $('saved').textContent = '这个浏览器不能保存草稿，请一次做完';
  }), 300);
}
const hex = (n) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => b.toString(16).padStart(2, '0')).join('');
const isParent = (r) => /爸|妈|父|母|爷|奶|公|婆|姥|爹|娘/.test(r || '');
const isPartner = (r) => /老公|老婆|宝贝|亲爱|媳妇|男朋友|女朋友/.test(r || '');
const ymd = (s) => (s || '').replace(/-/g, '');

// ------------------------------------------------------------------ step 1: who
function bindChips(group, key, onChange) {
  const box = document.querySelector(`[data-chips="${group}"]`);
  const custom = box.querySelector('[data-custom]');
  const sync = () => {
    let hit = false;
    $$('.chip', box).forEach((c) => {
      const on = (c.dataset.v || c.textContent) === d[key];
      c.classList.toggle('on', on); hit ||= on;
    });
    if (custom && !hit && d[key]) custom.value = d[key];
  };
  box.addEventListener('click', (e) => {
    const c = e.target.closest('.chip'); if (!c) return;
    d[key] = c.dataset.v || c.textContent;
    if (custom) custom.value = '';
    sync(); onChange?.(); save();
  });
  custom?.addEventListener('input', () => { d[key] = custom.value.trim(); sync(); onChange?.(); save(); });
  sync();
}
bindChips('recipient', 'recipient', () => applyDefaults());
bindChips('from', 'from', () => applyDefaults());
bindChips('lang', 'lang', () => applyDefaults(true));

function ageFrom(birthday) {
  const b = new Date(birthday + 'T00:00:00'); if (isNaN(b)) return '';
  const now = new Date();
  // the birthday this gift is for = the next one (or today / within the past month)
  let age = now.getFullYear() - b.getFullYear();
  const thisYear = new Date(now.getFullYear(), b.getMonth(), b.getDate());
  if (now - thisYear > 31 * 86400000) age += 1;
  return age > 0 && age < 121 ? age : '';
}
$('birthday').value = d.birthday || '';
$('age').value = d.age || '';
$('birthday').addEventListener('change', () => {
  d.birthday = $('birthday').value;
  const a = ageFrom(d.birthday);
  if (a) { d.age = a; $('age').value = a; }
  if (!d.pwTouched && d.birthday) { d.pw = ymd(d.birthday); $('pw').value = d.pw; }
  applyDefaults(); save();
});
$('age').addEventListener('input', () => { d.age = $('age').value; save(); });

// Text defaults follow the choices until the buyer edits a field themselves.
function applyDefaults(force = false) {
  const en = d.lang === 'en';
  const set = (id, key, val) => { if (force || !d[key + 'Touched']) { d[key] = val; $(id).value = fillText(val, d); } };
  set('title', 'title', en ? 'Happy Birthday, {name}' : '{name}，生日快乐');
  set('subtitle', 'subtitle', en ? 'A little universe of our memories' : '一份准备了很久的礼物');
  set('heart', 'heart', en ? 'Love you, {name} ❤' : '{name}，我爱你 ❤');
  set('hint', 'hint', en ? 'Hint: your birthday, 8 digits' : '提示：' + (d.recipient || '你') + '的生日，8 位数字');
  renderLetterTemplates();
}
for (const [id, key] of [['title', 'title'], ['subtitle', 'subtitle'], ['heart', 'heart'], ['hint', 'hint']]) {
  $(id).addEventListener('input', () => { d[key] = $(id).value; d[key + 'Touched'] = true; save(); });
}

// ------------------------------------------------------------------ step 2: photos
async function exifDate(file) {
  // Minimal JPEG EXIF reader: DateTimeOriginal (0x9003) or DateTime (0x0132).
  try {
    const buf = await file.slice(0, 256 * 1024).arrayBuffer();
    const v = new DataView(buf);
    if (v.getUint16(0) !== 0xFFD8) return null;
    let o = 2;
    while (o + 4 < v.byteLength) {
      const marker = v.getUint16(o), len = v.getUint16(o + 2);
      if (marker === 0xFFE1 && v.getUint32(o + 4) === 0x45786966) {
        const t = o + 10, le = v.getUint16(t) === 0x4949;
        const u16 = (p) => v.getUint16(t + p, le), u32 = (p) => v.getUint32(t + p, le);
        const str = (p, n) => { let s = ''; for (let i = 0; i < n - 1; i++) s += String.fromCharCode(v.getUint8(t + p + i)); return s; };
        const readIfd = (p, tags) => {
          const out = {}; const n = u16(p);
          for (let i = 0; i < n; i++) {
            const e = p + 2 + i * 12, tag = u16(e);
            if (tags.includes(tag)) out[tag] = tag === 0x8769 ? u32(e + 8) : str(u32(e + 8), u32(e + 4));
          }
          return out;
        };
        const ifd0 = readIfd(u32(4), [0x8769, 0x0132]);
        const ex = ifd0[0x8769] ? readIfd(ifd0[0x8769], [0x9003]) : {};
        const s = ex[0x9003] || ifd0[0x0132];
        const m = s && s.match(/^(\d{4}):(\d\d):(\d\d) (\d\d):(\d\d)/);
        if (m && m[1] > '1900') return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00`;
        return null;
      }
      if ((marker & 0xFF00) !== 0xFF00) break;
      o += 2 + len;
    }
  } catch {}
  return null;
}
function fileDate(file) {
  const t = file.lastModified;
  if (!t || Date.now() - t < 10 * 60 * 1000) return null; // "now" = the picker's copy time, not the photo's
  const z = new Date(t - new Date(t).getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 19);
}
function canvasBlob(source, w, h, q = 0.86) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  c.getContext('2d').drawImage(source, 0, 0, w, h);
  return new Promise((r) => c.toBlob(r, 'image/jpeg', q));
}
async function decode(file) {
  try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch {}
  const url = URL.createObjectURL(file);
  try {
    const img = new Image(); img.src = url; await img.decode();
    return img;
  } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
}
async function processImage(file) {
  const date = (await exifDate(file)) || fileDate(file);
  const bmp = await decode(file);
  const W = bmp.width, H = bmp.height, k = Math.min(1, LONG_SIDE / Math.max(W, H));
  const w = Math.round(W * k), h = Math.round(H * k);
  const blob = await canvasBlob(bmp, w, h);
  bmp.close?.();
  return { type: 'image', blob, w, h, date };
}
async function processVideo(file) {
  if (file.size > MAX_VIDEO_BYTES) throw new Error('视频太大了（请小于 45MB，可以先在相册里剪短）');
  const url = URL.createObjectURL(file);
  try {
    const v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url;
    await new Promise((res, rej) => { v.onloadeddata = res; v.onerror = () => rej(new Error('这段视频格式打不开')); setTimeout(() => rej(new Error('视频读取超时')), 15000); });
    v.currentTime = Math.min(0.6, (v.duration || 1) / 3);
    await new Promise((res) => { v.onseeked = res; setTimeout(res, 3000); });
    const W = v.videoWidth || 720, H = v.videoHeight || 1280, k = Math.min(1, 960 / Math.max(W, H));
    const poster = await canvasBlob(v, Math.round(W * k), Math.round(H * k), 0.8);
    return { type: 'video', blob: file.slice(0, file.size, file.type || 'video/mp4'), poster, w: Math.round(W * k), h: Math.round(H * k), date: fileDate(file) };
  } finally { URL.revokeObjectURL(url); }
}

const thumbs = new Map(); // id -> object URL
async function thumbUrl(it) {
  if (thumbs.has(it.id)) return thumbs.get(it.id);
  const m = await getMedia(it.id); if (!m) return '';
  const u = URL.createObjectURL(m.poster || m.blob); thumbs.set(it.id, u); return u;
}

function autoChapters() {
  const items = d.items; if (!items.length) return;
  const k = Math.max(1, Math.min(6, Math.round(items.length / 10)));
  const size = Math.ceil(items.length / k);
  items.forEach((it, i) => { it.chapterStart = i > 0 && i % size === 0; if (i % size === 0) it.chapterTitle = it.chapterTitle || ''; });
  // default title: the years the chapter covers (true by construction, never a guess)
  chaptersOf(d).forEach((ch) => {
    const ys = ch.items.map((it) => it.date?.slice(0, 4)).filter(Boolean).sort();
    const first = ch.items[0];
    if (first.titleTouched) return;
    first.chapterTitle = ys.length ? (ys[0] === ys[ys.length - 1] ? ys[0] : `${ys[0]}–${ys[ys.length - 1]}`) : '';
  });
}
function sortItems() {
  if (d.manualOrder) return;
  d.items.sort((a, b) => (a.date ? 0 : 1) - (b.date ? 0 : 1) || (a.date || '').localeCompare(b.date || '') || a.seq - b.seq);
}

async function addFiles(files) {
  files = [...files];
  const videos = d.items.filter((i) => i.type === 'video').length;
  let vleft = MAX_VIDEOS - videos, room = MAX_PHOTOS - d.items.length, skipped = [];
  const jobs = [];
  for (const f of files) {
    if (room <= 0) { skipped.push('最多 120 张，后面的没有加进来'); break; }
    const isVideo = /^video\//.test(f.type) || /\.(mov|mp4|m4v)$/i.test(f.name);
    if (isVideo && vleft <= 0) { skipped.push('视频最多 3 段'); continue; }
    const it = { id: 'm' + hex(5), seq: Date.now() + Math.random(), type: isVideo ? 'video' : 'image', cap: '', busy: true };
    d.items.push(it); room--; if (isVideo) vleft--;
    jobs.push([f, it]);
  }
  render();
  let next = 0;
  const work = async () => { // 3 at a time: fast on phones without running out of memory
    while (next < jobs.length) {
      const [f, it] = jobs[next++];
      try {
        const r = it.type === 'video' ? await processVideo(f) : await processImage(f);
        await putMedia(it.id, { blob: r.blob, poster: r.poster || null });
        Object.assign(it, { w: r.w, h: r.h, date: r.date, size: r.blob.size + (r.poster?.size || 0) });
        delete it.busy;
      } catch (e) {
        d.items.splice(d.items.indexOf(it), 1);
        skipped.push(`${f.name}：${e.message && /[一-龥]/.test(e.message) ? e.message : '这张打不开（如果是 HEIC，请在相册里选“最兼容”格式）'}`);
      }
      if (next % 6 === 0) render();
    }
  };
  await Promise.all([work(), work(), work()]);
  sortItems();
  if (!d.manualChapters) autoChapters();
  render(); save();
  if (skipped.length) toast(skipped[0] + (skipped.length > 1 ? ` 等 ${skipped.length} 个问题` : ''), 4200);
}
$('files').addEventListener('change', (e) => { addFiles(e.target.files); e.target.value = ''; });
const drop = $('drop');
drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
drop.addEventListener('dragleave', () => drop.classList.remove('over'));
drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); addFiles(e.dataTransfer.files); });

async function render() {
  const n = d.items.length, age = Number(d.age) || 0;
  $('candles').textContent = n ? `${n} 段回忆` + (age ? ` · 蛋糕上 ${age} 根蜡烛` : '') : '还没有照片';
  $('candleBar').style.width = `${Math.min(100, (n / Math.max(20, Math.min(70, age || 40))) * 100)}%`;
  const mb = d.items.reduce((s, i) => s + (i.size || 0), 0) / 1e6;
  $('sizeInfo').textContent = n ? `约 ${mb.toFixed(1)} MB` : '';
  $('photoTip').textContent = n && n < 3 ? '至少需要 3 张照片' : n && n < 15 ? '再多选几张会更好看（建议 20 张以上）' : '';
  const box = $('chapters');
  const chs = chaptersOf(d);
  box.innerHTML = '';
  let idx = 0;
  for (const [ci, ch] of chs.entries()) {
    const head = document.createElement('div');
    head.className = 'chapter-head';
    head.innerHTML = `<span class="num">第 ${ci + 1} 章</span><input class="input" maxlength="14" placeholder="小标题，比如「小时候」">` +
      (ci > 0 ? '<button class="del" title="和上一章合并">合并到上一章</button>' : '');
    const first = ch.items[0];
    const inp = head.querySelector('input');
    inp.value = first.chapterTitle || '';
    inp.addEventListener('input', () => { first.chapterTitle = inp.value; first.titleTouched = true; d.manualChapters = true; save(); });
    head.querySelector('.del')?.addEventListener('click', () => { first.chapterStart = false; d.manualChapters = true; render(); save(); });
    box.appendChild(head);
    const grid = document.createElement('div'); grid.className = 'grid';
    for (const it of ch.items) {
      const i = idx++;
      const el = document.createElement('div');
      el.className = 'ph' + (it.busy ? ' busy' : '');
      el.innerHTML = `<div class="img">${it.type === 'video' ? '<span class="vid">▶ 视频</span>' : ''}${it.date ? `<span class="date">${it.date.slice(0, 7).replace('-', '.')}</span>` : ''}</div>
        <input maxlength="16" placeholder="写一句话（可不写）">
        <div class="tools"><button data-a="l" title="往前">◀</button><button data-a="c">${i > 0 && !it.chapterStart ? '新一章' : ''}</button><button data-a="r" title="往后">▶</button><button data-a="x" title="删除">✕</button></div>`;
      const cap = el.querySelector('input'); cap.value = it.cap || '';
      cap.addEventListener('input', () => { it.cap = cap.value; save(); });
      el.querySelector('.tools').addEventListener('click', async (e) => {
        const a = e.target.closest('button')?.dataset.a; if (!a) return;
        const at = d.items.indexOf(it);
        if (a === 'x') { d.items.splice(at, 1); await delMedia(it.id); if (at === 0 && d.items[0]) d.items[0].chapterStart = false; }
        if (a === 'l' && at > 0) { [d.items[at - 1], d.items[at]] = [d.items[at], d.items[at - 1]]; d.manualOrder = true; }
        if (a === 'r' && at < d.items.length - 1) { [d.items[at + 1], d.items[at]] = [d.items[at], d.items[at + 1]]; d.manualOrder = true; }
        if (a === 'c' && at > 0 && !it.chapterStart) { it.chapterStart = true; it.chapterTitle = ''; d.manualChapters = true; }
        render(); save();
      });
      grid.appendChild(el);
      if (!it.busy) thumbUrl(it).then((u) => { if (u) el.querySelector('.img').style.backgroundImage = `url(${u})`; });
    }
    box.appendChild(grid);
  }
}

// ------------------------------------------------------------------ step 3: letter
function letterTemplates() {
  const r = d.recipient || 'TA', f = d.from || '';
  if (d.lang === 'en') return {
    Warm: `Dear ${r},\n\nHappy birthday.\nI went through all these photos for you,\nand in almost every one, you are taking care of someone.\nThis year, let us take care of you.\nThank you for every ordinary day you made special.\n\nI love you.\n— ${f}`,
    Short: `${r},\n\nHappy birthday.\nEvery candle is a memory of us.\nHere's to many more.\n\n— ${f}`,
  };
  if (isPartner(r)) return {
    温柔: `${r}：\n\n生日快乐。\n翻这些照片的时候，我一直在笑。\n原来我们已经一起走了这么远。\n谢谢你，把普通的日子过得这么好。\n以后的每一个生日，我都想陪你过。\n\n—— ${f}`,
    俏皮: `${r}：\n\n又长大一岁啦！\n照片里的你，每一张都可爱（我说的是真的）。\n今天你最大，想吃什么都行。\n愿望要偷偷告诉我。\n\n—— ${f}`,
    简短: `${r}：\n\n生日快乐。\n每一根蜡烛，都是我们的一段回忆。\n往后余生，一起慢慢变老。\n\n—— ${f}`,
  };
  if (isParent(r)) return {
    温暖: `${r}：\n\n生日快乐。\n挑这些照片的时候，我才发现，\n几乎每一张里，你都在照顾别人。\n小时候是你陪我长大，\n现在换我们，陪你慢慢变老。\n谢谢你，把这个家撑了这么多年。\n今天只想对你说：辛苦了，我爱你。\n\n—— ${f}`,
    感恩: `${r}：\n\n${d.age ? d.age + ' 根蜡烛，是你走过的 ' + d.age + ' 年。' : '又是一年。'}\n这些年你总说自己不累，\n可我都看在眼里。\n不在身边的日子，也一直惦记着你。\n愿你身体健康，天天开心，\n想去的地方，我们陪你去。\n\n—— ${f}`,
    简短: `${r}：\n\n生日快乐，身体健康。\n这些回忆，是我最珍贵的东西。\n我爱你。\n\n—— ${f}`,
  };
  return {
    温暖: `${r}：\n\n生日快乐。\n翻到这些照片，好多事情一下子都想起来了。\n谢谢你出现在我的生活里。\n新的一岁，愿你被温柔对待，\n想要的都实现。\n\n—— ${f}`,
    简短: `${r}：\n\n生日快乐！\n每一根蜡烛，都是一段一起的回忆。\n明年还要一起过。\n\n—— ${f}`,
  };
}
function renderLetterTemplates() {
  const box = $('letterTpl'); const t = letterTemplates();
  box.innerHTML = '';
  for (const name of Object.keys(t)) {
    const b = document.createElement('button'); b.className = 'chip'; b.textContent = name;
    b.onclick = () => {
      if (d.letter && d.letterTouched && !confirm('会替换你已经写的内容，确定吗？')) return;
      d.letter = t[name]; d.letterTouched = false; $('letter').value = d.letter; save();
    };
    box.appendChild(b);
  }
  if (!d.letterTouched) { d.letter = Object.values(t)[0]; $('letter').value = d.letter; }
}
$('letter').addEventListener('input', () => { d.letter = $('letter').value; d.letterTouched = true; save(); });

// ------------------------------------------------------------------ step 4: password
$('pw').addEventListener('input', () => { d.pw = $('pw').value.trim(); d.pwTouched = true; save(); });

// ------------------------------------------------------------------ step 5: preview + pay
function renderSummary() {
  const nV = d.items.filter((i) => i.type === 'video').length;
  const rows = [['送给', d.recipient], ['几岁', d.age ? `${d.age} 岁` : ''], ['生日', d.birthday], ['落款', d.from],
    ['回忆', `${d.items.length - nV} 张照片` + (nV ? ` · ${nV} 段视频` : '') + ` · ${chaptersOf(d).length} 章`], ['密码', d.pw]];
  $('summary').innerHTML = '';
  for (const [k, v] of rows) {
    const dt = document.createElement('dt'); dt.textContent = k;
    const dd = document.createElement('dd'); dd.textContent = v || '—';
    $('summary').append(dt, dd);
  }
}
$('previewBtn').addEventListener('click', async () => {
  await saveDraft(d);
  window.open('g/?preview', '_blank') || (location.href = 'g/?preview');
});

async function encryptor(password) {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256' }, base,
    { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
  const seal = async (data) => { // same layout encrypt_site.mjs writes: iv | ciphertext+tag
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data));
    const out = new Uint8Array(12 + ct.length); out.set(iv); out.set(ct, 12); return out;
  };
  return { seal, salt: btoa(String.fromCharCode(...salt)) };
}
async function call(path, opts = {}, ticket) {
  const headers = { ...(opts.headers || {}) };
  if (ticket) headers.authorization = 'Ticket ' + ticket;
  let r;
  try { r = await fetch(API + path, { ...opts, headers }); } catch { throw new Error('网络不太好，请检查网络后再试一次'); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.ok === false) { const e = new Error(j.error || `出错了（${r.status}），请再试一次`); e.code = j.code; throw e; }
  return j;
}
async function upload(gift, file, bytes, ticket) {
  for (let i = 0; ; i++) {
    try { return await call(`/api/upload/${gift}/${file}`, { method: 'PUT', body: bytes, headers: { 'content-type': 'application/octet-stream' } }, ticket); }
    catch (e) { if (i >= 3 || e.code === 'ticket' || e.code === 'size') throw e; await new Promise((r) => setTimeout(r, 1200 * (i + 1))); }
  }
}
function overlay(on, title, text) {
  $('overlay').classList.toggle('on', on);
  if (title) $('ovTitle').textContent = title;
  if (text) $('ovText').textContent = text;
}
function progress(f) { $('ovBar').style.width = `${Math.round(f * 100)}%`; $('ovPct').textContent = `${Math.round(f * 100)}%`; }

$('makeBtn').addEventListener('click', () => {
  const code = $('code').value.trim();
  if (code.replace(/[^0-9a-z]/gi, '').length < 16) { $('codeErr').textContent = '请输入完整的兑换码（16 位）'; return; }
  makeGift(code);
});
async function makeGift(code) {
  const err = $('codeErr'); err.textContent = '';
  const problem = validate(4); if (problem) { err.textContent = problem; return; }
  $('makeBtn').disabled = true; $('payBtn').disabled = true;
  try {
    overlay(true, '正在核对兑换码…', '请稍等');
    progress(0);
    const { ticket, gift } = await call('/api/redeem', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code }) });
    overlay(true, '正在给礼物上锁…', '照片正在你的手机上加密，然后上传。请不要关闭这个页面，也不要锁屏。');
    const { seal, salt } = await encryptor(d.pw);
    const items = d.items.filter((i) => !i.busy);
    const total = items.reduce((s, i) => s + (i.size || 1), 0) + 1;
    let done = 0;
    const media = [], files = [];
    let next = 0;
    const worker = async () => {
      while (next < items.length) {
        const it = items[next++];
        const m = await getMedia(it.id); if (!m) continue;
        const entry = { id: it.id, type: it.type, w: it.w, h: it.h, date: it.date || '' };
        const put = async (blob) => {
          const name = hex(9) + '.bin';
          await upload(gift, name, await seal(await blob.arrayBuffer()), ticket);
          files.push(name);
          return { file: name, type: blob.type || (it.type === 'video' ? 'video/mp4' : 'image/jpeg') };
        };
        entry.src = await put(m.blob);
        if (m.poster) entry.poster = await put(m.poster);
        media.push(entry);
        done += it.size || 1; progress(done / total * 0.96);
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    const order = new Map(items.map((it, i) => [it.id, i]));
    media.sort((a, b) => order.get(a.id) - order.get(b.id));
    const manifest = { input: buildInput(d), media };
    await upload(gift, 'manifest.bin', await seal(new TextEncoder().encode(JSON.stringify(manifest))), ticket);
    const meta = { v: 2, salt, iter: ITER, hint: fillText(d.hint, d), bytes: total };
    await upload(gift, 'meta.json', new TextEncoder().encode(JSON.stringify(meta)), ticket);
    overlay(true, '最后一步…', '');
    const fin = await call('/api/finalize', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ files: [...files, 'manifest.bin', 'meta.json'] }) }, ticket);
    progress(1);
    d.done = { gift, code, url: new URL('g/?id=' + gift, location.href).href, pw: d.pw, editUntil: fin.editUntil };
    delete d.paidCode;
    await saveDraft(d);
    overlay(false);
    go(5);
  } catch (e) {
    overlay(false);
    err.textContent = (e.message || '出错了，请再试一次') + (d.paidCode ? '（已付款，不会重复收费，点上面按钮重试）' : '');
  } finally { $('makeBtn').disabled = false; $('payBtn').disabled = false; payLabel(); }
}

// ------------------------------------------------------------------ automatic checkout
// pay → provider QR / app → poll until the server has seen the payment → code → makeGift()
const MOBILE = matchMedia('(pointer: coarse)').matches;
let pollT = null;
function payLabel() {
  if (d.paidCode) $('payBtn').textContent = '已付款 · 继续生成礼物';
}
function sheet(on) { $('paySheet').classList.toggle('on', on); if (!on) { clearTimeout(pollT); pollT = null; } }
async function poll(orderId, started = Date.now()) {
  try {
    const r = await call('/api/order/' + orderId);
    if (r.status === 'paid' && r.code) {
      $('payStatus').classList.add('ok'); $('payStatus').textContent = '付款成功 ✓ 正在生成礼物…';
      d.paidCode = r.code; delete d.pendingOrder; await saveDraft(d);
      setTimeout(() => { sheet(false); makeGift(r.code); }, 700);
      return;
    }
  } catch (e) { if (e.code === 'nf') { delete d.pendingOrder; save(); sheet(false); return; } }
  if (Date.now() - started > 15 * 60 * 1000) { $('payStatus').textContent = '还没收到付款。如果已经付了，请稍后回到这个页面'; return; }
  pollT = setTimeout(() => poll(orderId, started), document.hidden ? 4000 : 2000);
}
function showPay(o) {
  const ali = o.channel === 'alipay';
  const afd = o.via === 'afdian';
  $('claimBox').classList.toggle('hidden', !afd);
  if (afd) { // 爱发电: pay on afdian's page (WeChat or Alipay), come back, the page continues by itself
    if (!MOBILE) o = { ...o, qr: o.url };
    $('payStatus').classList.remove('ok');
    $('payStatus').innerHTML = '<span class="dot"></span>付完回到这个页面，会自动继续';
    $('payQr').innerHTML = '';
    if (o.qr) {
      const qr = window.qrcode(0, 'M'); qr.addData(o.qr); qr.make();
      $('payQr').innerHTML = `<img alt="付款二维码" src="${qr.createDataURL(5, 2)}">`;
      $('payQr').classList.remove('hidden'); $('payTip').classList.remove('hidden');
      $('payTip').textContent = '用手机扫码，在「爱发电」用微信或支付宝付款';
    } else { $('payQr').classList.add('hidden'); $('payTip').classList.add('hidden'); }
    $('payOpen').classList.remove('hidden'); $('payOpen').href = o.url;
    $('payOpen').textContent = MOBILE ? '去付款 ¥' + (SHOP.price || '9.99') + '（微信 / 支付宝）' : '在这台电脑上付款';
    sheet(true);
    return;
  }
  $('payStatus').classList.remove('ok');
  $('payStatus').innerHTML = '<span class="dot"></span>等待付款…付完会自动继续';
  $('payQr').innerHTML = '';
  if (o.qr) { // desktop: scan; phone: long-press in WeChat, or screenshot → 扫一扫 → 相册
    const qr = window.qrcode(0, 'M'); qr.addData(o.qr); qr.make();
    $('payQr').innerHTML = `<img alt="付款码" src="${qr.createDataURL(6, 2)}">`;
    $('payQr').classList.remove('hidden'); $('payTip').classList.remove('hidden');
    $('payTip').textContent = ali ? '请用支付宝扫一扫付款'
      : !MOBILE ? '请用微信扫一扫付款'
      : /MicroMessenger/i.test(navigator.userAgent) ? '长按上面的付款码 →「识别图中二维码」付款'
      : '截图保存，打开微信「扫一扫」→ 右上角相册选这张图付款';
  } else { $('payQr').classList.add('hidden'); $('payTip').classList.add('hidden'); }
  $('payOpen').classList.toggle('hidden', !o.url);
  $('payOpen').textContent = ali ? '打开支付宝付款' : '打开微信付款';
  if (o.url) $('payOpen').href = o.url;
  sheet(true);
}
async function startPay(channel) {
  const err = $('codeErr'); err.textContent = '';
  const problem = validate(4); if (problem) { err.textContent = problem; return; }
  if (d.paidCode) return makeGift(d.paidCode); // paid already, upload failed earlier
  $('payBtn').disabled = true;
  try {
    const o = await call('/api/order', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ channel, mobile: MOBILE }) });
    o.channel = channel;
    d.pendingOrder = { id: o.order, qr: o.qr, url: o.url, via: o.via, channel, at: Date.now() }; await saveDraft(d);
    showPay(o);
    if (MOBILE && o.url && !o.qr && o.via !== 'afdian') location.href = o.url; // straight into the payment app
    poll(o.order);
  } catch (e) { err.textContent = e.message; }
  finally { $('payBtn').disabled = false; }
}
$('payBtn').addEventListener('click', () => startPay('wxpay'));
$('payAliBtn').addEventListener('click', () => startPay('alipay'));
$('payCancel').addEventListener('click', () => sheet(false));
$('claimBtn').addEventListener('click', async () => {
  const trade = $('claimTrade').value.trim(); $('claimErr').textContent = '';
  if (!d.pendingOrder || !trade) { $('claimErr').textContent = '请粘贴订单号'; return; }
  $('claimBtn').disabled = true;
  try {
    const r = await call(`/api/order/${d.pendingOrder.id}/claim`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ trade }) });
    if (r.code) { clearTimeout(pollT); poll(d.pendingOrder.id, d.pendingOrder.at); }
  } catch (e) { $('claimErr').textContent = e.message; }
  finally { $('claimBtn').disabled = false; }
});
document.addEventListener('visibilitychange', () => { // back from the WeChat app → check right away
  if (!document.hidden && d.pendingOrder && pollT) { clearTimeout(pollT); poll(d.pendingOrder.id, d.pendingOrder.at); }
});

function renderDone() {
  const x = d.done; if (!x) return;
  $('giftUrl').value = x.url; $('giftPw').textContent = x.pw; $('openGift').href = x.url; $('giftCode').textContent = x.code;
  const who = d.recipient || '你';
  $('shareText').textContent = d.lang === 'en'
    ? `I made you a birthday gift 🎂\nOpen: ${x.url}\nPassword: ${x.pw}\n(Best with sound on, open in a browser.)`
    : `${who}，我给你准备了一份生日礼物 🎂\n打开这个链接：${x.url}\n密码：${x.pw}\n（记得打开声音；在微信里点右上角「在浏览器打开」效果更好）`;
  try {
    const qr = window.qrcode(0, 'M'); qr.addData(x.url); qr.make();
    $('qr').innerHTML = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
  } catch { $('qr').classList.add('hidden'); }
}
document.addEventListener('click', async (e) => {
  const id = e.target.closest('[data-copy]')?.dataset.copy; if (!id) return;
  const el = $(id); const text = el.value ?? el.textContent;
  try { await navigator.clipboard.writeText(text); toast('已复制'); }
  catch { if (el.select) { el.select(); document.execCommand('copy'); toast('已复制'); } else toast('请长按文字复制'); }
});

// Is the backend reachable? (A static-only deploy = preview works, ordering doesn't yet.)
async function checkOpen() {
  let h = null;
  try { const r = await fetch(API + '/api/health', { cache: 'no-store' }); if (r.ok) h = await r.json(); } catch {}
  $('makeBtn').disabled = !h; $('payBtn').disabled = !h || (!h.pay && !d.paidCode);
  if (!h) { $('codeErr').textContent = SHOP.closedNote || '小店还在准备开张，暂时不能生成正式链接。你的草稿已经保存在这台手机上，可以先免费预览。'; return; }
  if (!h.pay) { // codes-only shop (卡密): explain where the code comes from
    $('payBtn').classList.add('hidden'); $('haveCode').open = true;
    $('haveCode').querySelector('summary').textContent = '输入兑换码';
    $('makeBtn').textContent = '用兑换码生成礼物';
    $('payIntro').textContent = '先看看效果（预览版带水印，信只显示开头）。满意了输入兑换码，马上生成可以发给 TA 的正式礼物。';
    $('payAuto').textContent = '输入兑换码后马上生成。';
    $('buyCodeHow').textContent = SHOP.buy?.how || '';
    if (SHOP.buy?.url) { $('buyCodeLink').href = SHOP.buy.url; $('buyCodeLink').classList.remove('hidden'); }
    $('buyCode').classList.remove('hidden');
  }
  $('payAliBtn').classList.toggle('hidden', !h.pay || !h.alipay || !!d.paidCode);
  if (h.pay === 'afdian' && !d.paidCode) $('payBtn').textContent = `付款 ¥${SHOP.price || '9.99'}，生成礼物（微信 / 支付宝）`;
  payLabel();
  // came back after paying (e.g. the phone switched to WeChat and reloaded this page)
  if (d.pendingOrder && !d.paidCode && Date.now() - d.pendingOrder.at < 15 * 60 * 1000) { showPay(d.pendingOrder); poll(d.pendingOrder.id, d.pendingOrder.at); }
}

// ------------------------------------------------------------------ navigation
function validate(s) {
  if (s >= 0 && !d.recipient) return '先选一下怎么称呼 TA';
  if (s >= 0 && !(Number(d.age) > 0 && Number(d.age) <= 120)) return '填一下这次是几岁生日';
  if (s >= 1 && d.items.some((i) => i.busy)) return '照片还在处理，稍等几秒';
  if (s >= 1 && d.items.length < 3) return '至少选 3 张照片';
  if (s >= 2 && !(d.letter || '').trim()) return '写几句话吧，哪怕一句也好';
  if (s >= 3 && !(d.pw && d.pw.length >= 4)) return '密码至少 4 位';
  return '';
}
function go(s) {
  step = s; d.step = Math.min(s, 4); save();
  $$('.panel').forEach((p) => p.classList.toggle('on', Number(p.dataset.step) === s));
  $$('#progress span').forEach((b, i) => b.classList.toggle('on', i <= s));
  $('back').style.visibility = s > 0 && s < 5 ? 'visible' : 'hidden';
  $('next').classList.toggle('hidden', s >= 4);
  $('nav').classList.toggle('hidden', s === 5);
  $('navHint').textContent = '';
  if (s === 1) render();
  if (s === 2) { $('letter').value = d.letter || ''; }
  if (s === 3) { $('pw').value = d.pw || ''; $('hint').value = fillText(d.hint, d); }
  if (s === 4) { renderSummary(); if (d.done?.code) { $('code').value = d.done.code; $('haveCode').open = true; } checkOpen(); }
  if (s === 5) renderDone();
  scrollTo({ top: 0, behavior: 'smooth' });
}
$('next').addEventListener('click', () => {
  const p = validate(step); if (p) { $('navHint').textContent = p; return; }
  go(step + 1);
});
$('back').addEventListener('click', () => go(Math.max(0, step - 1)));

// first paint
if (!d.title) applyDefaults(); else { ['title', 'subtitle', 'heart'].forEach((k) => { $(k).value = fillText(d[k], d); }); renderLetterTemplates(); }
if (d.items.some((i) => i.busy)) d.items = d.items.filter((i) => !i.busy); // interrupted during processing
go(step);
