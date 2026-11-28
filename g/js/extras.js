// Optional "selling point" features. Every one is driven by an OPTIONAL STORY field, so gifts that
// don't set them behave exactly as before:
//   STORY.openAt      '2026-11-20T00:00+08:00'  -> countdown screen until then (定时开启)
//   STORY.wishes      [{ from, text, photo? }]   -> everyone's wishes float up after the candles (祝福墙)
//   STORY.surprise    { title?, text, image? }   -> a gift box appears at the very end (彩蛋 / 藏好的礼物)
//   STORY.music       media id (audio)           -> the sender's own background song
//   item.voice        media id (audio)           -> a voice note that plays when that photo is zoomed
//   STORY.letterVoice media id (audio)           -> the sender reading the letter
//   STORY.posterLine  text                       -> line printed on the shareable poster
import * as THREE from 'three';

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pad = (n) => String(n).padStart(2, '0');

const TEXT = {
  zh: {
    countdownTitle: '{name}的生日礼物，还没到打开的时候', countdownSub: '到时间会自动打开 · 先别偷看哦', units: ['天', '时', '分', '秒'], timeUp: '时间到了 🎂',
    wishesIntro: '还有好多人，想对你说生日快乐……', skip: '跳过 ›',
    giftHint: '还有一个礼物 🎁<br><b>点一下礼物盒</b>，或者两只手<b>比心</b>打开', giftButton: '🎁 打开礼物', giftClose: '收下啦 ❤',
    posterDefault: '{age} 岁 · 生日快乐', posterSaved: '海报已保存，可以发朋友圈啦',
    reactionLabel: '录下我吹蜡烛的样子（只存在这台设备上，可以发给{from}）', reactionSave: '💾 保存我的反应视频',
  },
  en: {
    countdownTitle: "{name}'s birthday gift isn't ready to open yet", countdownSub: 'It opens by itself when the time comes — no peeking', units: ['d', 'h', 'm', 's'], timeUp: "It's time 🎂",
    wishesIntro: 'A few more people want to say happy birthday…', skip: 'Skip ›',
    giftHint: 'One more gift 🎁<br><b>Tap the box</b>, or make a <b>heart</b> with both hands', giftButton: '🎁 Open the gift', giftClose: 'Thank you ❤',
    posterDefault: 'Happy {age}th birthday', posterSaved: 'Poster saved — share it!',
    reactionLabel: 'Record my reaction (stays on this device — you can send it to {from})', reactionSave: '💾 Save my reaction video',
  },
};
export const T = (STORY) => TEXT[STORY.lang === 'en' ? 'en' : 'zh'];

// ---------------------------------------------------------------- countdown (定时开启)
export function countdownGate(STORY, fill) {
  if (!STORY.openAt) return Promise.resolve();
  const target = new Date(STORY.openAt).getTime();
  if (Number.isNaN(target) || Date.now() >= target || new URLSearchParams(location.search).has('preview')) return Promise.resolve();
  const L = T(STORY), el = $('countdown');
  el.querySelector('.cd-title').textContent = fill(STORY.countdownTitle || L.countdownTitle);
  el.querySelector('.cd-sub').textContent = L.countdownSub;
  el.classList.add('show');
  return new Promise((resolve) => {
    const tick = () => {
      const left = target - Date.now();
      if (left <= 0) {
        el.querySelector('.cd-time').textContent = L.timeUp;
        setTimeout(() => { el.classList.remove('show'); resolve(); }, 1800);
        return;
      }
      const d = Math.floor(left / 864e5), h = Math.floor(left / 36e5) % 24, m = Math.floor(left / 6e4) % 60, s = Math.floor(left / 1e3) % 60;
      const u = L.units;
      el.querySelector('.cd-time').innerHTML = (d ? `<b>${d}</b><small>${u[0]}</small>` : '') +
        `<b>${pad(h)}</b><small>${u[1]}</small><b>${pad(m)}</b><small>${u[2]}</small><b>${pad(s)}</b><small>${u[3]}</small>`;
      setTimeout(tick, 250);
    };
    tick();
  });
}

// ---------------------------------------------------------------- wishes wall (祝福墙)
export async function showWishes(STORY, fill, mediaById, { say, onEach } = {}) {
  const list = (STORY.wishes || []).filter((w) => w && w.text);
  if (!list.length) return;
  const L = T(STORY), box = $('wishes'), skipBtn = $('wishes-skip');
  let skip = false;
  skipBtn.textContent = L.skip;
  skipBtn.onclick = () => { skip = true; };
  box.innerHTML = '';
  box.classList.add('show'); skipBtn.classList.add('show');
  if (say) await say([STORY.wishesIntro || L.wishesIntro], { hold: 1600 });
  for (const [i, w] of list.entries()) {
    if (skip) break;
    const card = document.createElement('div');
    card.className = 'wish';
    card.style.setProperty('--r', `${(i % 2 ? 1 : -1) * (1 + Math.random() * 2.5)}deg`);
    card.style.setProperty('--x', `${[0, -14, 14][i % 3]}vw`);
    const ph = w.photo && mediaById[w.photo];
    if (ph) { const img = document.createElement('img'); img.src = ph.type === 'video' ? ph.poster : ph.src; img.alt = ''; card.appendChild(img); }
    const p = document.createElement('p'); p.textContent = fill(w.text); card.appendChild(p);
    if (w.from) { const s = document.createElement('span'); s.textContent = '—— ' + fill(w.from); card.appendChild(s); }
    box.appendChild(card);
    requestAnimationFrame(() => requestAnimationFrame(() => card.classList.add('in')));
    onEach?.(i);
    const hold = 3200 + Math.min(7000, w.text.length * 110);
    for (let t = 0; t < hold && !skip; t += 100) await sleep(100);
    card.classList.add('out');
    setTimeout(() => card.remove(), 1400);
    await sleep(500);
  }
  box.classList.remove('show'); skipBtn.classList.remove('show');
}

// ---------------------------------------------------------------- gift box (彩蛋)
export function buildGiftBox({ color = '#e7776b', ribbon = '#ffd98a' } = {}) {
  const group = new THREE.Group();
  const boxMat = new THREE.MeshStandardMaterial({ color, roughness: 0.55 });
  const ribMat = new THREE.MeshStandardMaterial({ color: ribbon, roughness: 0.3, metalness: 0.4, emissive: '#3a2600' });
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.45, 0.6), boxMat);
  base.position.y = 0.225;
  const r1 = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.46, 0.09), ribMat); r1.position.y = 0.225;
  const r2 = r1.clone(); r2.rotation.y = Math.PI / 2;
  const lid = new THREE.Group();
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.14, 0.68), boxMat);
  const l1 = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.15, 0.09), ribMat);
  const l2 = l1.clone(); l2.rotation.y = Math.PI / 2;
  const bowGeo = new THREE.TorusGeometry(0.1, 0.03, 8, 20);
  const b1 = new THREE.Mesh(bowGeo, ribMat); b1.position.set(-0.08, 0.15, 0); b1.rotation.set(0, 0, 0.6);
  const b2 = new THREE.Mesh(bowGeo, ribMat); b2.position.set(0.08, 0.15, 0); b2.rotation.set(0, 0, -0.6);
  lid.add(top, l1, l2, b1, b2);
  lid.position.y = 0.52;
  group.add(base, r1, r2, lid);
  group.visible = false;
  let appear = 0, openT = -1;
  return {
    group,
    show() { group.visible = true; appear = 0; openT = -1; lid.position.set(0, 0.52, 0); lid.rotation.set(0, 0, 0); },
    hide() { group.visible = false; },
    open() { if (openT < 0) openT = 0; },
    get opened() { return openT >= 0; },
    update(dt, time) {
      if (!group.visible) return;
      appear = Math.min(1, appear + dt * 1.6);
      const pop = appear < 1 ? 1 + Math.sin(appear * Math.PI) * 0.25 : 1;
      group.scale.setScalar(Math.max(0.001, appear) * pop);
      if (openT < 0) group.rotation.y = Math.sin(time * 1.5) * 0.12; // gentle wiggle: "open me"
      else {
        openT += dt;
        lid.position.y = 0.52 + Math.min(1.4, openT * 2.2);
        lid.position.x = Math.min(0.6, openT * 0.8);
        lid.rotation.z = -Math.min(1.2, openT * 2);
      }
    },
  };
}

export function showSurprise(STORY, fill, mediaById) {
  const s = STORY.surprise; if (!s) return Promise.resolve();
  const L = T(STORY), el = $('surprise'), paper = el.querySelector('.paper');
  paper.innerHTML = '';
  if (s.title) { const h = document.createElement('h3'); h.textContent = fill(s.title); paper.appendChild(h); }
  const ph = s.image && mediaById[s.image];
  if (ph) { const img = document.createElement('img'); img.src = ph.type === 'video' ? ph.poster : ph.src; img.alt = ''; paper.appendChild(img); }
  for (const line of String(s.text || '').split('\n')) { const p = document.createElement('p'); p.textContent = fill(line); paper.appendChild(p); }
  const btn = $('surprise-close');
  btn.textContent = L.giftClose;
  el.classList.add('show');
  return new Promise((resolve) => { btn.onclick = () => { el.classList.remove('show'); resolve(); }; });
}

// ---------------------------------------------------------------- shareable poster (海报)
const loadImg = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });

export async function makePoster(STORY, fill, cards, font = 'WenKai, "Kaiti SC", serif') {
  const W = 1080, H = 1920, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#3a2116'); bg.addColorStop(1, '#0f0806');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  const glow = g.createRadialGradient(W / 2, 1500, 0, W / 2, 1500, 700);
  glow.addColorStop(0, 'rgba(255,170,90,.35)'); glow.addColorStop(1, 'rgba(255,170,90,0)');
  g.fillStyle = glow; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 260; i++) { // warm dust
    g.fillStyle = `rgba(255,${200 + Math.random() * 40 | 0},150,${Math.random() * 0.5})`;
    g.beginPath(); g.arc(Math.random() * W, Math.random() * H, Math.random() * 2.2, 0, 7); g.fill();
  }
  g.textAlign = 'center';
  g.fillStyle = '#ffd9a0'; g.font = `84px ${font}`;
  g.shadowColor = 'rgba(255,160,80,.6)'; g.shadowBlur = 30;
  g.fillText(fill(STORY.title), W / 2, 190);
  g.shadowBlur = 0;
  g.fillStyle = '#f6dcc0'; g.font = `40px ${font}`;
  g.fillText(fill(STORY.posterLine || T(STORY).posterDefault), W / 2, 265);

  // up to 9 polaroids, spread across the whole story
  const pool = cards.filter((x) => x.m.type === 'image' || x.m.type === 'video');
  const pick = [];
  const n = Math.min(9, pool.length);
  for (let i = 0; i < n; i++) pick.push(pool[Math.round((i * (pool.length - 1)) / Math.max(1, n - 1))]);
  const imgs = await Promise.all(pick.map((x) => loadImg(x.m.type === 'video' ? x.m.poster : x.m.src)));
  const cols = 3, pw = 300, ph = 360, gap = 30, x0 = (W - cols * pw - (cols - 1) * gap) / 2, y0 = 340;
  imgs.forEach((img, i) => {
    const cx = x0 + (i % cols) * (pw + gap) + pw / 2, cy = y0 + Math.floor(i / cols) * (ph + gap) + ph / 2;
    g.save(); g.translate(cx, cy); g.rotate(((i * 37) % 7 - 3) * 0.012);
    g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 24; g.shadowOffsetY = 8;
    g.fillStyle = '#f7efe2'; g.fillRect(-pw / 2, -ph / 2, pw, ph);
    g.shadowBlur = 0; g.shadowOffsetY = 0;
    if (img) { // cover-crop into the photo window
      const s = 270, r = Math.max(s / img.width, s / img.height), sw = s / r, sh = s / r;
      g.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, -s / 2, -ph / 2 + 15, s, s);
    }
    g.fillStyle = ['rgba(240,180,170,.85)', 'rgba(250,214,140,.85)', 'rgba(176,214,196,.85)'][i % 3];
    g.fillRect(-45, -ph / 2 - 12, 90, 26);
    const cap = pick[i].cap;
    if (cap) { g.fillStyle = '#4b3426'; g.font = `26px ${font}`; g.fillText(cap.slice(0, 10), 0, ph / 2 - 30); }
    g.restore();
  });
  g.fillStyle = '#ffd9a0'; g.font = `bold 230px ${font}`;
  g.shadowColor = 'rgba(255,170,90,.8)'; g.shadowBlur = 60;
  g.fillText(String(STORY.age), W / 2, 1680);
  g.shadowBlur = 0;
  g.fillStyle = 'rgba(255,243,226,.75)'; g.font = `34px ${font}`;
  const d = new Date();
  g.fillText(`—— ${fill(STORY.from)} · ${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`, W / 2, 1810);
  const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
  const file = new File([blob], `${STORY.recipient}-${STORY.age}-birthday.png`, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: fill(STORY.title) }); return 'shared'; } catch { /* fall back to download */ }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = file.name; a.click();
  return 'saved';
}
