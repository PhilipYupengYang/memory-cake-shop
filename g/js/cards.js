// Polaroid-style memory cards on a time spiral around the cake.
import * as THREE from 'three';

export const HAND_FONT = '"WenKai","LXGW WenKai","Kaiti SC","STKaiti","KaiTi",serif';
const PX = 260; // logical canvas pixels per world unit
let TEX_SCALE = 1.6; // real canvas density (lowered for very large galleries to save GPU memory)
const TAPES = ['rgba(240,180,170,0.82)', 'rgba(250,214,140,0.82)', 'rgba(176,214,196,0.82)', 'rgba(198,190,232,0.8)'];

function frameTexture(w, h, caption, dateLabel, isVideo, hasVoice) {
  // layout is in 260-px-per-unit "logical" pixels; the canvas itself is TEX_SCALE× denser so
  // captions and paper stay crisp when a card is zoomed to fill a 3x phone screen.
  const c = document.createElement('canvas');
  const L = { width: Math.round(w * PX), height: Math.round(h * PX) };
  c.width = Math.round(L.width * TEX_SCALE); c.height = Math.round(L.height * TEX_SCALE);
  const g = c.getContext('2d');
  g.scale(TEX_SCALE, TEX_SCALE);
  const grd = g.createLinearGradient(0, 0, L.width, L.height);
  grd.addColorStop(0, '#f7efe2'); grd.addColorStop(1, '#ecdcc4');
  g.fillStyle = grd; g.fillRect(0, 0, L.width, L.height);
  for (let i = 0; i < 1400; i++) { // paper fibres
    g.fillStyle = `rgba(140,100,60,${Math.random() * 0.045})`;
    g.fillRect(Math.random() * L.width, Math.random() * L.height, 1 + Math.random() * 2, 1);
  }
  const stripTop = L.height - 0.36 * PX;
  g.textBaseline = 'middle';
  if (caption) {
    g.fillStyle = '#4b3426';
    let size = 36;
    g.font = `${size}px ${HAND_FONT}`;
    while (g.measureText(caption).width > L.width - 130 && size > 18) g.font = `${--size}px ${HAND_FONT}`;
    g.save(); g.translate(24, stripTop + 0.18 * PX); g.rotate(-0.012); g.fillText(caption, 0, 0); g.restore();
  }
  g.fillStyle = '#a48466';
  g.font = `22px ${HAND_FONT}`;
  g.textAlign = 'right';
  g.fillText(dateLabel, L.width - 20, stripTop + 0.21 * PX);
  if (isVideo || hasVoice) {
    g.textAlign = 'right';
    g.fillStyle = 'rgba(160,70,50,.85)';
    g.font = `20px ${HAND_FONT}`;
    g.fillText(hasVoice ? '🔊 有一段语音' : '▶ 有声音的回忆', L.width - 20, stripTop + 0.06 * PX);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function tapeTexture(color) {
  const c = document.createElement('canvas');
  c.width = 320; c.height = 96; // 2x canvas, drawn in 160×48 units
  const g = c.getContext('2d');
  g.scale(2, 2);
  g.fillStyle = color;
  g.beginPath(); // torn ends
  g.moveTo(0, 2);
  for (let x = 0; x <= 160; x += 8) g.lineTo(x, Math.random() * 3);
  for (let y = 0; y <= 48; y += 6) g.lineTo(160 - Math.random() * 4, y);
  for (let x = 160; x >= 0; x -= 8) g.lineTo(x, 48 - Math.random() * 3);
  for (let y = 48; y >= 0; y -= 6) g.lineTo(Math.random() * 4, y);
  g.fill();
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = 'rgba(255,255,255,.18)';
  for (let x = -40; x < 200; x += 18) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 8, 0); g.lineTo(x - 16, 48); g.lineTo(x - 24, 48); g.fill(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const tapeTextures = TAPES.map(tapeTexture);

function dateLabel(iso) {
  if (!iso) return '';
  const [y, m] = iso.split('-');
  return `${y}.${m}`;
}

export function buildCards(story, media, { radius = 6.2, step = 0.29, chapterGap = 0.55, pitch = 0.1, y0 = -0.7 } = {}) {
  TEX_SCALE = media.length > 80 ? 1.15 : media.length > 45 ? 1.35 : 1.6;
  const byId = Object.fromEntries(media.map((m) => [m.id, m]));
  const group = new THREE.Group();
  const loader = new THREE.TextureLoader();
  const cards = [];
  let theta = 0, y = y0;
  story.chapters.forEach((ch, ci) => {
    if (ci > 0) { theta += chapterGap; y += pitch * (chapterGap / step); }
    for (const it of ch.items) {
      const m = byId[it.id];
      if (!m || m.type === 'audio') { console.warn('[cards] missing or non-visual media id:', it.id); continue; }
      const vm = it.voice && byId[it.voice];
      const aspect = m.w / m.h, MAX = 1.45;
      const pw = aspect >= 1 ? MAX : MAX * aspect, ph = aspect >= 1 ? MAX / aspect : MAX;
      const border = 0.08, strip = 0.36;
      const fw = pw + border * 2, fh = ph + border + strip;
      const card = new THREE.Group();
      const frame = new THREE.Mesh(new THREE.PlaneGeometry(fw, fh),
        new THREE.MeshBasicMaterial({ map: frameTexture(fw, fh, it.cap || '', it.date ?? dateLabel(m.date), m.type === 'video', !!vm), toneMapped: false, transparent: true }));
      const back = new THREE.Mesh(new THREE.PlaneGeometry(fw, fh),
        new THREE.MeshBasicMaterial({ color: '#3b2619', transparent: true, opacity: 0.55, toneMapped: false }));
      back.rotation.y = Math.PI;
      const shadow = new THREE.Mesh(new THREE.PlaneGeometry(fw + 0.1, fh + 0.1),
        new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.35, toneMapped: false, depthWrite: false }));
      shadow.position.set(0.05, -0.06, -0.012);
      const tape = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.19),
        new THREE.MeshBasicMaterial({ map: tapeTextures[cards.length % TAPES.length], transparent: true, toneMapped: false, depthWrite: false }));
      tape.position.set((Math.random() - 0.5) * 0.3, fh / 2 - 0.01, 0.01);
      tape.rotation.z = (Math.random() - 0.5) * 0.35;
      const photoMat = new THREE.MeshBasicMaterial({ color: '#222', toneMapped: false, transparent: true });
      const photo = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), photoMat);
      photo.position.set(0, fh / 2 - border - ph / 2, 0.004);
      card.add(shadow, back, frame, photo, tape);
      const imgSrc = m.type === 'video' ? m.poster : m.src;
      loader.load(imgSrc, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
        photoMat.map = tex; photoMat.color.set('#f2ece4'); photoMat.needsUpdate = true;
      });
      let video = null;
      if (m.type === 'video') {
        video = document.createElement('video');
        Object.assign(video, { src: m.src, loop: true, muted: true, playsInline: true, preload: 'auto' });
        video.setAttribute('playsinline', '');
        const vtex = new THREE.VideoTexture(video);
        vtex.colorSpace = THREE.SRGBColorSpace;
        video.addEventListener('playing', () => { photoMat.map = vtex; photoMat.needsUpdate = true; });
      }
      let voice = null; // optional voice note that plays when this photo is zoomed
      if (vm) { voice = new Audio(vm.src); voice.preload = 'auto'; }
      card.position.set(Math.sin(theta) * radius, y, Math.cos(theta) * radius);
      card.lookAt(Math.sin(theta) * radius * 2, y, Math.cos(theta) * radius * 2);
      card.rotateZ((Math.random() - 0.5) * 0.09);
      frame.userData.cardIndex = photo.userData.cardIndex = cards.length;
      group.add(card);
      cards.push({ card, frame, photo, back, shadow, tape, theta, y, ci, m, cap: it.cap || '', video, voice, scale: 1 });
      theta += step; y += pitch;
    }
  });

  const N = cards.length;
  const lerpAt = (s, key) => {
    const c = Math.max(0, Math.min(N - 1, s)), i = Math.floor(c), f = c - i;
    const a = cards[i][key], b = cards[Math.min(N - 1, i + 1)][key];
    return a + (b - a) * f;
  };
  return {
    group, cards, N, radius,
    thetaAt: (s) => lerpAt(s, 'theta'),
    yAt: (s) => lerpAt(s, 'y'),
    topY: y,
    // `s` = continuous position in time; memories far from it fade so the cake stays visible.
    update(dt, current, zoom, s = current, window = 5) {
      for (let i = 0; i < N; i++) {
        const c = cards[i];
        const dist = current < 0 ? 0 : Math.abs(i - s);
        const op = current < 0 ? (this.dimmed ?? 0.9) : Math.max(0.07, Math.min(1, 1 - (dist - window) / 5));
        c.frame.material.opacity = c.photo.material.opacity = op;
        c.back.material.opacity = 0.55 * op;
        c.shadow.material.opacity = 0.35 * op;
        c.tape.material.opacity = op;
        c.card.visible = op > 0.02;
        const near = i === current;
        const target = near ? 1 + 0.12 * (1 - zoom) : 1;
        c.scale += (target - c.scale) * Math.min(1, dt * 6);
        c.card.scale.setScalar(c.scale);
        if (c.video) {
          const shouldPlay = Math.abs(i - current) <= 1;
          if (shouldPlay && c.video.paused) c.video.play().catch(() => {});
          if (!shouldPlay && !c.video.paused) c.video.pause();
        }
      }
    },
  };
}
