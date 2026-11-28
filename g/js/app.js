// Interactive birthday memory cake: intro -> explore memories (each lights a candle)
// -> last candle -> wish -> blow out -> fireworks -> letter.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildCake, buildStarfield, buildOrbitRings, buildParticleText, Particles, DEFAULT_PALETTE, THEMES } from './cake.js';
import { buildCards } from './cards.js';
import { Hands } from './hands.js';
import { Sound } from './audio.js';
import { loadContent } from './content.js';
import { T, countdownGate, showWishes, buildGiftBox, showSurprise, makePoster } from './extras.js';

const { STORY, media } = await loadContent();
const params = new URLSearchParams(location.search);
const AUTO = params.has('auto');
const AUTO_RECORDING = false;
const MOBILE = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 600;
const UA = navigator.userAgent;
const IN_WECHAT = /MicroMessenger/i.test(UA);
const IOS = /iPhone|iPad|iPod/i.test(UA) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
let fakeOffset = 0;
const nowMs = () => performance.now() + fakeOffset;
const smooth = (t) => t * t * (3 - 2 * t);
const fill = (s) => String(s)
  .replaceAll('{name}', STORY.recipient).replaceAll('{age}', STORY.age)
  .replaceAll('{from}', STORY.from).replaceAll('{memories}', String(window.__N ?? ''))
  .replaceAll('{candles}', String(STORY.age - 1));

// ---------------------------------------------------------------- scene
const canvas = $('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
// Sharp by default: the screen's real pixel ratio, capped at 2.5 (3x phones look the same at 2.5x).
// If frames are slow, adaptQuality() steps down gently (2.5 → 2 → 1.75 → 1.5 …), never straight to 1.
// ?dpr=1.5 forces a ratio (testing / before-after comparisons).
const DPR_FORCE = Number(new URLSearchParams(location.search).get('dpr')) || 0;
const DPR_STEPS = [2.5, 2, 1.75, 1.5, 1.25, 1];
let pixelRatio = DPR_FORCE || Math.min(devicePixelRatio || 1, 2.5);
renderer.setPixelRatio(pixelRatio);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
const palette = { ...DEFAULT_PALETTE, ...(THEMES[STORY.theme] || {}), ...(STORY.palette || {}) };
const mediaById = Object.fromEntries(media.map((m) => [m.id, m]));
const SC = palette.scene;
const scene = new THREE.Scene();
scene.background = new THREE.Color(SC.bgBottom);
scene.fog = new THREE.FogExp2(SC.fog, 0.016);
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.05, 400);
// soft vertical gradient sky (warm candle-lit room by default)
scene.add(new THREE.Mesh(new THREE.SphereGeometry(150, 32, 16), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { top: { value: new THREE.Color(SC.bgTop) }, bottom: { value: new THREE.Color(SC.bgBottom) } },
  vertexShader: 'varying float vY; void main(){ vY = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
  fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying float vY; void main(){ gl_FragColor = vec4(mix(bottom, top, smoothstep(-0.2, 0.6, vY)), 1.); }',
})));

scene.add(new THREE.HemisphereLight(SC.hemi[0], SC.hemi[1], 0.9));
const key = new THREE.DirectionalLight(SC.key, 1.5); key.position.set(4, 9, 6); scene.add(key);
const rim = new THREE.DirectionalLight(SC.rim, 0.7); rim.position.set(-6, 3, -6); scene.add(rim);
const cake = buildCake({ age: STORY.age, palette });
scene.add(cake.group);
const gift = STORY.surprise ? buildGiftBox() : null;
if (gift) scene.add(gift.group);
scene.add(buildStarfield(MOBILE ? 1200 : 1800, SC.stars));
const rings = buildOrbitRings(palette); scene.add(rings);
const numberText = buildParticleText(String(STORY.age));
numberText.object.position.set(0, cake.topY + 2.3, 0);
scene.add(numberText.object);
const fx = new Particles(9000, { size: 0.12 });
const smoke = new Particles(1500, { size: 0.22 });
scene.add(fx.points, smoke.points);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.6, 0.6, 0.9);
composer.addPass(bloom);
composer.addPass(new OutputPass());
let useBloom = true, slowFor = 0;

function resize() {
  const w = innerWidth, h = innerHeight;
  camera.aspect = w / h;
  camera.fov = w < h ? 62 : 45;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h);
  cake.setScale(h * renderer.getPixelRatio() / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))));
}
addEventListener('resize', resize);
resize();

// ---------------------------------------------------------------- cards
// handwriting font must be ready before polaroid captions are painted onto canvases
try {
  const ff = new FontFace('WenKai', `url(${new URL('../vendor/fonts/wenkai.woff2', import.meta.url).href})`);
  document.fonts.add(await ff.load());
} catch (e) { console.warn('handwriting font unavailable, using system font', e); }
const spiral = buildCards(STORY, media);
scene.add(spiral.group);
const N = spiral.N;
window.__N = N;

// ---- chapter timeline ----
const chapterStart = STORY.chapters.map((_, ci) => spiral.cards.findIndex((c) => c.ci === ci));
$('tl-chapters').innerHTML = STORY.chapters.map((ch, ci) =>
  `<button data-ci="${ci}" style="flex:${Math.max(1, spiral.cards.filter((c) => c.ci === ci).length)}">${ch.title}</button>`).join('');
$('tl-chapters').addEventListener('click', (e) => {
  const ci = e.target.closest('button')?.dataset.ci;
  if (ci == null || chapterStart[ci] < 0) return;
  if (S.mode !== 'explore' && S.mode !== 'free') return;
  S.zoomTarget = 0; S.autoTarget = null; step(chapterStart[ci] - Math.round(S.s));
});
function updateTimeline() {
  const ci = spiral.cards[currentIndex()].ci;
  [...$('tl-chapters').children].forEach((b, i) => b.classList.toggle('on', i === ci));
  $('tl-marker').style.left = `${(S.s / Math.max(1, N - 1)) * 100}%`;
}

// ---------------------------------------------------------------- UI helpers
const ui = {
  narr: $('narration'), chapter: $('chapter'), caption: $('caption'), hint: $('hint'),
  cursor: $('cursor'), legend: $('legend'),
};

// ---- always-visible legend (context-aware) ----
const LEGEND = {
  cam: [['👉', '张开手往<b>右</b>放 = 往后翻，越右越快'], ['👈', '张开手往<b>左</b>放 = 往回翻，越左越快'], ['✋', '手放<b>中间</b> = 停下'],
    ['✊', '<b>握拳</b> = 走近看这张'], ['🖐', '再<b>张开</b> = 退回来'], ['🫶', '两只手<b>比心</b> = 惊喜']],
  touch: [['👆', '<b>左右滑</b> = 翻回忆'], ['👇', '<b>点照片</b> = 走近看'], ['👆', '<b>点空白</b> = 退回来'], ['🎂', '看完点<b>许愿</b>']],
  finaleCam: [['🌬', '对着屏幕<b>吹一口气</b>'], ['✊', '或者<b>握拳</b>两秒'], ['🫶', '两只手<b>比心</b> = 惊喜']],
  finaleTouch: [['🌬', '对着屏幕<b>吹一口气</b>'], ['🎂', '或者点<b>许愿</b>']],
  gift: [['👆', '<b>点一下礼物盒</b>'], ['🫶', '或者两只手<b>比心</b>']],
};
function setLegend(kind) {
  $('legend-list').innerHTML = LEGEND[kind].map(([i, t]) => `<li><em>${i}</em>${t}</li>`).join('');
}
ui.legend.addEventListener('click', () => {
  ui.legend.classList.toggle('folded');
  ui.legend.querySelector('.fold').textContent = ui.legend.classList.contains('folded') ? '展开' : '收起';
});
let narrToken = 0;
async function say(lines, { hold = 2600, big = false } = {}) {
  const my = ++narrToken;
  for (const line of lines) {
    if (my !== narrToken) return;
    ui.narr.classList.toggle('big', big);
    ui.narr.textContent = fill(line);
    ui.narr.classList.add('show');
    await sleep(hold + line.length * 90);
    if (my !== narrToken) return;
    ui.narr.classList.remove('show');
    await sleep(900);
  }
}
function hint(html, ms = 0) {
  ui.hint.innerHTML = html;
  ui.hint.classList.add('show');
  clearTimeout(hint._t);
  if (ms) hint._t = setTimeout(() => ui.hint.classList.remove('show'), ms);
}
let shownChapter = -1;
function showChapter(ci) {
  if (ci === shownChapter) return;
  shownChapter = ci;
  const ch = STORY.chapters[ci];
  ui.chapter.querySelector('.kicker').textContent = ch.kicker || `第 ${ci + 1} 章`;
  ui.chapter.querySelector('h2').textContent = fill(ch.title);
  ui.chapter.querySelector('p').textContent = fill(ch.line || '');
  ui.chapter.classList.remove('show'); void ui.chapter.offsetWidth; ui.chapter.classList.add('show');
  sound.chime();
}

// ---------------------------------------------------------------- state
const sound = new Sound();
// Background: the sender's own song (STORY.music) if given, otherwise the synthesised ambient pad.
const bgmMedia = STORY.music && mediaById[STORY.music];
const bgm = bgmMedia ? Object.assign(new Audio(bgmMedia.src), { loop: true, preload: 'auto' }) : null;
let bgmVol = 0.55;
const bg = {
  start() { if (bgm) { bgm.muted = sound.muted; bgm.volume = bgmVol; bgm.play().catch(() => {}); } else sound.startAmbient(); },
  stop() { if (bgm) bgm.pause(); else sound.stopAmbient(); },
  duck(on) { sound.duck(on); if (bgm) bgm.volume = on ? 0.1 : bgmVol; },
};
const letterVoice = STORY.letterVoice && mediaById[STORY.letterVoice] ? new Audio(mediaById[STORY.letterVoice].src) : null;
let hands = null;
const S = {
  mode: 'splash',          // splash | intro | explore | finale | letter | free
  s: 0, vel: 0,            // position along the memory spiral (card index, float)
  zoom: 0, zoomTarget: 0,
  visited: new Set(),
  lastInput: 0,
  rig: 1,                  // 1 = scripted camera, 0 = navigation camera
  rigPos: new THREE.Vector3(0, 14, 34), rigLook: new THREE.Vector3(0, 2, 0),
  heartCooldown: 0, fistHeld: 0, wishReady: false, finaleStarted: false,
};
window.__S = S; window.__fx = () => fx; window.__cake = cake; window.__fakeHand = (st) => { hands = { state: st }; };
const cakeMid = new THREE.Vector3(0, 1.6, 0);

function navPose(s, zoom) {
  const th = spiral.thetaAt(s), y = spiral.yAt(s);
  // Camera sits straight out from the current photo, a little above it: the photo you see in the
  // middle of the screen is always the one a fist / tap zooms into; the cake glows behind it.
  const Rc = innerWidth < innerHeight ? 15 : 12.5;
  const ov = new THREE.Vector3(Math.sin(th) * Rc, y + 1.9, Math.cos(th) * Rc);
  const ovLook = new THREE.Vector3(0, THREE.MathUtils.lerp(cakeMid.y + 0.6, y + 0.5, 0.5), 0);
  const n = new THREE.Vector3(Math.sin(th), 0, Math.cos(th));
  const cardPos = n.clone().multiplyScalar(spiral.radius).setY(y);
  const dist = innerWidth < innerHeight ? 3.6 : 2.55;
  const fo = cardPos.clone().addScaledVector(n, dist).add(new THREE.Vector3(0, 0.12, 0));
  const e = smooth(clamp(zoom, 0, 1));
  return { pos: ov.lerp(fo, e), look: ovLook.lerp(cardPos, e) };
}

// Candles are independent of how many photos there are: they light one by one during the intro.
function lightCandlesGradually(ms = 6000) {
  const n = STORY.age, stepMs = ms / n;
  for (let i = 1; i <= n; i++) setTimeout(() => cake.setLit(i), i * stepMs);
}

function currentIndex() { return clamp(Math.round(S.s), 0, N - 1); }

// ---------------------------------------------------------------- input: mouse / touch / keys
let drag = null;
canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, s: S.s, moved: 0, t: nowMs() }; });
addEventListener('pointermove', (e) => {
  if (!drag || S.mode !== 'explore' && S.mode !== 'free') return;
  const dx = e.clientX - drag.x;
  drag.moved = Math.max(drag.moved, Math.abs(dx));
  if (drag.moved > 6) { S.s = clamp(drag.s - dx / 110, 0, N - 1); S.vel = 0; S.lastInput = nowMs(); if (S.zoomTarget > 0.5) S.zoomTarget = 0; }
});
addEventListener('pointerup', (e) => {
  if (!drag) return;
  const wasClick = drag.moved < 6;
  drag = null;
  if (!wasClick || (S.mode !== 'explore' && S.mode !== 'free' && S.mode !== 'gift')) return;
  const ray = new THREE.Raycaster();
  ray.setFromCamera(new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1), camera);
  if (S.mode === 'gift' && gift && ray.intersectObject(gift.group, true).length) { openGift(); return; }
  const hit = ray.intersectObjects(spiral.group.children, true).find((h) => h.object.userData.cardIndex !== undefined);
  if (hit) { focusCard(hit.object.userData.cardIndex); }
  else S.zoomTarget = 0;
});
addEventListener('wheel', (e) => {
  if (S.mode !== 'explore' && S.mode !== 'free') return;
  S.zoomTarget = clamp(S.zoomTarget - e.deltaY * 0.004, 0, 1);
  S.lastInput = nowMs();
}, { passive: true });
addEventListener('keydown', (e) => {
  const k = e.key;
  if (k === 'h' || k === 'H') document.body.classList.toggle('clean');
  if (k === 'm' || k === 'M') toggleMute();
  if (k === 'l' || k === 'L') ui.legend.classList.toggle('folded');
  if (S.mode === 'finale' && (k === ' ' || k === 'Enter')) blowOut();
  if (S.mode !== 'explore' && S.mode !== 'free') return;
  if (k === 'ArrowRight') step(1);
  if (k === 'ArrowLeft') step(-1);
  if (k === ' ' || k === 'Enter') { S.zoomTarget = S.zoomTarget > 0.5 ? 0 : 1; S.s = currentIndex(); }
  if (k === 'f' || k === 'F') startFinale();
});
function step(d) { S.s = clamp(Math.round(S.s) + d, 0, N - 1); S.vel = 0; S.lastInput = nowMs(); }
function focusCard(i) { S.s = i; S.vel = 0; S.zoomTarget = 1; S.lastInput = nowMs(); }

$('btn-prev').onclick = () => step(-1);
$('btn-next').onclick = () => step(1);
$('btn-zoom').onclick = () => { S.zoomTarget = S.zoomTarget > 0.5 ? 0 : 1; S.s = currentIndex(); };
$('btn-cake').onclick = () => (S.mode === 'finale' ? blowOut() : startFinale());
$('btn-music').onclick = toggleMute;
$('btn-photo').onclick = async () => {
  const r = await makePoster(STORY, fill, spiral.cards).catch((e) => console.warn(e));
  if (r === 'saved') hint(T(STORY).posterSaved, 3500);
};
$('btn-letter').onclick = () => openLetter();
function toggleMute() {
  sound.init();
  sound.setMuted(!sound.muted);
  if (bgm) bgm.muted = sound.muted;
  $('btn-music').classList.toggle('off', sound.muted);
  $('btn-music').querySelector('b').textContent = sound.muted ? '音乐关' : '音乐开';
}
// Fullscreen (not available on iPhone Safari - hide the button there)
const root = document.documentElement;
const canFull = !!(root.requestFullscreen || root.webkitRequestFullscreen);
if (!canFull) $('btn-full').style.display = 'none';
$('btn-full').onclick = () => {
  const isFull = document.fullscreenElement || document.webkitFullscreenElement;
  if (isFull) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
  else (root.requestFullscreen || root.webkitRequestFullscreen).call(root);
};
const onFull = () => { $('btn-full').querySelector('b').textContent = (document.fullscreenElement || document.webkitFullscreenElement) ? '退出' : '全屏'; };
document.addEventListener('fullscreenchange', onFull);
document.addEventListener('webkitfullscreenchange', onFull);

// Stop all sound when the page is hidden / closed (the music must never keep playing in the background).
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    sound.ctx?.suspend();
    for (const c of spiral.cards) { if (c.video) c.video.pause(); if (c.voice) c.voice.pause(); }
    bgm?.pause(); letterVoice?.pause();
    hands?.video?.srcObject && (S.camPaused = true);
  } else if (sound.ctx && !AUTO_RECORDING) { sound.ctx.resume(); if (bgm && S.mode !== 'splash' && !S.blown) bgm.play().catch(() => {}); }
});
addEventListener('pagehide', () => { sound.ctx?.close(); hands?.stop?.(); });

// ---------------------------------------------------------------- hand gestures -> controls
function handleHands(dt, now) {
  const h = hands?.state;
  if (!h || !h.present) { ui.cursor.className = ''; return; }
  ui.cursor.className = 'on ' + h.pose;
  ui.cursor.style.transform = `translate(${h.x * innerWidth}px, ${h.y * innerHeight}px)`;
  if (h.heart && now > S.heartCooldown) {
    S.heartCooldown = now + 3500;
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
    const fwd = new THREE.Vector3(); camera.getWorldDirection(fwd);
    fx.heart(camera.position.clone().addScaledVector(fwd, 4), right, up, '#ff8fa3');
    setTimeout(() => fx.heart(camera.position.clone().addScaledVector(fwd, 4.5), right, up, '#ffd9a0'), 250);
    if (S.mode === 'gift') openGift(); else say([STORY.heartText || '❤'], { hold: 1800, big: true });
  }
  if (S.mode === 'finale') {
    if (S.wishReady && (h.pose === 'fist' || h.pose === 'pinch')) {
      S.fistHeld += dt;
      ui.cursor.style.setProperty('--p', clamp(S.fistHeld / 1.6, 0, 1));
      if (S.fistHeld > 1.6) blowOut();
    } else { S.fistHeld = 0; ui.cursor.style.setProperty('--p', 0); }
    return;
  }
  if (S.mode !== 'explore' && S.mode !== 'free') return;
  S.lastInput = now;
  if (h.pose === 'fist' || h.pose === 'pinch') {
    if (S.zoomTarget < 1) S.s = currentIndex();
    S.zoomTarget = 1; S.vel = 0;
    $('gauge').classList.remove('on');
    $('edge-l').classList.remove('on'); $('edge-r').classList.remove('on');
    return;
  }
  // open / relaxed hand: horizontal offset spins through time (dead zone in the middle)
  const dx = h.x - 0.5, dead = 0.11;
  const v = Math.abs(dx) < dead ? 0 : Math.sign(dx) * (Math.abs(dx) - dead) * 7.5;
  if (h.pose === 'open') S.zoomTarget = Math.abs(v) > 0 ? 0 : Math.min(S.zoomTarget, 0.0);
  S.vel += (v - S.vel) * Math.min(1, dt * 5);
  $('edge-l').classList.toggle('on', v < 0);
  $('edge-r').classList.toggle('on', v > 0);
  showGauge(h.x, v);
}
// Speed gauge: shows where the hand is — middle = stop, further left/right = faster.
function showGauge(x, v) {
  const g = $('gauge');
  g.classList.add('on');
  ui.hint.classList.remove('show'); // the gauge explains itself; don't stack two panels
  $('gauge-dot').style.left = `${clamp(x, 0, 1) * 100}%`;
  $('gauge-label').textContent = v === 0 ? '停 · 手往左右移动开始翻' : v > 0 ? `往后翻 ${'›'.repeat(1 + Math.min(3, Math.floor(Math.abs(v))))}` : `${'‹'.repeat(1 + Math.min(3, Math.floor(Math.abs(v))))} 往回翻`;
  clearTimeout(showGauge._t);
  showGauge._t = setTimeout(() => g.classList.remove('on'), 900);
}

// ---------------------------------------------------------------- reaction video (opt-in, stays on this device)
// The recipient ticks a box on the start screen; we film them from the finale until the letter is
// closed, then offer the clip as a download so THEY can choose to send it back. Nothing is uploaded.
let recStream = null, recorder = null, recChunks = [];
async function startReaction() {
  try {
    recStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 720 } }, audio: true });
  } catch (e) { console.warn('reaction camera unavailable', e); recStream = null; }
}
function beginReactionRecording() {
  if (!recStream || recorder || typeof MediaRecorder === 'undefined') return;
  const type = ['video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm'].find((t) => MediaRecorder.isTypeSupported?.(t)) || '';
  recorder = new MediaRecorder(recStream, type ? { mimeType: type } : undefined);
  recChunks = [];
  recorder.ondataavailable = (e) => e.data.size && recChunks.push(e.data);
  recorder.onstop = () => {
    recStream.getTracks().forEach((t) => t.stop());
    const blob = new Blob(recChunks, { type: recorder.mimeType || 'video/webm' });
    const btn = $('reaction-save');
    btn.onclick = () => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `my-reaction.${(recorder.mimeType || '').includes('mp4') ? 'mp4' : 'webm'}`;
      a.click();
    };
    btn.classList.add('show');
    setTimeout(() => btn.classList.remove('show'), 60000);
  };
  recorder.start(1000);
  $('rec-dot').classList.add('show');
}
function stopReaction() {
  if (recorder && recorder.state !== 'inactive') recorder.stop();
  $('rec-dot').classList.remove('show');
}
addEventListener('pagehide', () => recStream?.getTracks().forEach((t) => t.stop()));

// ---------------------------------------------------------------- story flow
async function startExperience(useCam, useMic) {
  $('splash').classList.add('gone');
  sound.init();
  sound.ctx.resume();
  bg.start();
  // iOS: unlock every memory video inside this tap so they can later play with sound
  for (const c of spiral.cards) if (c.video) { c.video.muted = true; c.video.play().then(() => c.video.pause()).catch(() => {}); }
  for (const a of [...spiral.cards.map((c) => c.voice), letterVoice]) if (a) a.play().then(() => a.pause()).catch(() => {});
  if ($('use-reaction')?.checked) startReaction();
  if (useCam) {
    $('cam').classList.add('show');
    hands = new Hands($('video'), $('camdraw'));
    hands.start().catch((err) => {
      console.warn('camera unavailable', err);
      $('cam').classList.remove('show');
      hint('摄像头没打开也没关系：<b>拖动</b>转动蛋糕，<b>点击照片</b>放大。', 7000);
      hands = null;
    });
  }
  if (useMic) sound.startMic().catch((e) => console.warn('mic unavailable', e));
  S.mode = 'intro';
  numberText.formIn();
  setTimeout(() => lightCandlesGradually(), 2500);
  await say(STORY.intro, { hold: 2300 });
  if (S.mode !== 'intro') return; // user already jumped ahead (e.g. pressed 🎂)
  S.mode = 'explore';
  S.lastInput = nowMs();
  enterExploreUI();
  const g = hands ? STORY.gestureHelp : STORY.mouseHelp;
  hint(g.join('<br>'), 9000);
  showChapter(0);
}
function enterExploreUI() {
  setLegend(hands ? 'cam' : 'touch');
  for (const id of ['legend', 'timeline', 'controls']) $(id).classList.remove('hidden');
}

$('btn-start-cam').onclick = () => startExperience(true, $('use-mic').checked);
$('btn-start-plain').onclick = () => startExperience(false, $('use-mic').checked);

async function startFinale() {
  if (S.finaleStarted) return;
  S.finaleStarted = true;
  S.mode = 'finale';
  S.zoomTarget = 0;
  ui.chapter.classList.remove('show');
  ui.caption.classList.remove('show');
  $('edge-l').classList.remove('on'); $('edge-r').classList.remove('on');
  cake.setLit(STORY.age);
  S.rigTarget = 'cake';
  S.rig = 0.0001; // start blending toward the scripted cake shot
  beginReactionRecording();
  enterExploreUI();
  setLegend(hands ? 'finaleCam' : 'finaleTouch');
  $('timeline').classList.add('hidden');
  if (STORY.finale.beforeLast?.length) await say(STORY.finale.beforeLast, { hold: 2200 }); // optional, legacy
  sound.chime();
  numberText.formIn();
  await sleep(1400);
  await say(STORY.finale.wish, { hold: 2200 });
  S.wishReady = true;
  hint(hands ? STORY.finale.blowHintCam : STORY.finale.blowHint);
}

async function blowOut() {
  if (!S.wishReady || S.blown) return;
  S.blown = true; S.wishReady = false;
  ui.hint.classList.remove('show');
  for (let i = 0; i < STORY.age; i++) {
    const p = new THREE.Vector3().fromArray(cake.flamePos, i * 3);
    for (let k = 0; k < 4; k++) smoke.smoke(p);
  }
  cake.blowOut();
  bg.stop();
  await sleep(900);
  S.rigTarget = 'celebrate';
  numberText.scatter();
  const dur = sound.playBirthday({ loops: 1, bpm: 112 });
  S.fireworksUntil = nowMs() + Math.max(14000, dur * 1000);
  say([STORY.finale.celebrate], { hold: 6000, big: true });
  await sleep(9000);
  numberText.formIn();
  await sleep(Math.max(3000, dur * 1000 - 9000));
  await showWishes(STORY, fill, mediaById, {
    say,
    onEach: () => fx.firework(new THREE.Vector3((Math.random() - 0.5) * 6, cake.topY + 3 + Math.random() * 2, (Math.random() - 0.5) * 6), ['#ffd9a0', '#ffb89a', '#fff3e2']),
  });
  openLetter();
}

function openLetter() {
  S.mode = 'letter';
  const el = $('letter'), paper = el.querySelector('.paper');
  paper.innerHTML = '';
  STORY.letter.forEach((line, i) => {
    const p = document.createElement(line.trim() ? 'p' : 'br');
    if (line.trim()) { p.textContent = fill(line); p.style.animationDelay = `${0.6 + i * 0.9}s`; }
    paper.appendChild(p);
  });
  el.classList.add('show');
  if (letterVoice) { bg.duck(true); letterVoice.currentTime = 0; letterVoice.play().catch(() => {}); letterVoice.onended = () => bg.duck(false); }
}
$('letter').addEventListener('click', async (e) => {
  if (e.target.id !== 'letter-close') return;
  $('letter').classList.remove('show');
  if (letterVoice) { letterVoice.pause(); bg.duck(false); }
  stopReaction();
  if (gift && !gift.opened && !S.giftShown) { offerGift(); return; }
  backToFree();
});
// ---- the hidden gift (彩蛋): a wrapped box appears after the letter ----
function offerGift() {
  S.giftShown = true; S.mode = 'gift';
  const th = spiral.thetaAt(S.s) + 0.42;
  gift.group.position.set(Math.sin(th) * 2.45, 0.12, Math.cos(th) * 2.45);
  gift.group.lookAt(Math.sin(th) * 10, 0.12, Math.cos(th) * 10);
  gift.show();
  S.rigTarget = 'gift'; S.rig = Math.max(S.rig, 0.0001);
  hint(T(STORY).giftHint);
  setLegend('gift');
  $('btn-gift').textContent = T(STORY).giftButton;
  $('btn-gift').classList.add('show');
  sound.chime();
}
async function openGift() {
  if (!gift || gift.opened || S.mode !== 'gift') return;
  gift.open();
  $('btn-gift').classList.remove('show');
  ui.hint.classList.remove('show');
  sound.chime();
  const p = gift.group.position.clone().add(new THREE.Vector3(0, 0.8, 0));
  fx.firework(p, ['#ffd9a0', '#ff8fa3', '#fff3e2']);
  setTimeout(() => fx.firework(p.clone().add(new THREE.Vector3(0, 0.6, 0)), ['#ffcf7a', '#f6a6a0']), 300);
  await sleep(1300);
  await showSurprise(STORY, fill, mediaById);
  backToFree();
}
$('btn-gift').onclick = openGift;
function backToFree() {
  S.mode = 'free'; S.rig = 1; S.rigTarget = null; S.lastInput = nowMs();
  // relight the candles so the cake stays warm for free exploring
  cake.setLit(STORY.age);
  bg.start();
  hint('随时继续转动、放大回忆。按 🎂 可以再吹一次蜡烛。', 6000);
  setLegend(hands ? 'cam' : 'touch');
  $('timeline').classList.remove('hidden');
  S.blown = false; S.finaleStarted = false;
}

// ---------------------------------------------------------------- auto (hands-free) mode
async function autoPilot() {
  await sleep(500);
  $('btn-start-plain').click();
  while (S.mode !== 'explore') await sleep(200);
  for (let i = 0; i < N; i++) {
    S.autoTarget = i;
    await sleep(1300);
    const c = spiral.cards[i];
    if (c.video || i % 4 === 0) { S.zoomTarget = 1; await sleep(c.video ? 6500 : 3200); S.zoomTarget = 0; await sleep(900); }
    else await sleep(900);
  }
  S.autoTarget = null;
  await startFinale();
  await sleep(2500);
  blowOut();
}
if (AUTO) autoPilot();

// ---------------------------------------------------------------- frame loop
const clock = new THREE.Clock();
function frame() {
  requestAnimationFrame(frame);
  tick(Math.min(0.05, clock.getDelta()), nowMs());
}
// Debug/testing: advance the simulation without a visible tab (rAF pauses when hidden).
window.__advance = (sec) => {
  for (let t = 0; t < sec; t += 1 / 30) { fakeOffset += 1000 / 30; tick(1 / 30, nowMs()); }
};
function tick(dt, now) {
  const time = now / 1000;
  handleHands(dt, now);

  if (S.mode === 'explore' || S.mode === 'free') {
    if (S.autoTarget != null) S.s += (S.autoTarget - S.s) * Math.min(1, dt * 2.2);
    S.s = clamp(S.s + S.vel * dt, 0, N - 1);
    if (!hands?.state.present) S.vel *= Math.pow(0.05, dt);
    // snap to the nearest card when idle
    if (Math.abs(S.vel) < 0.15 && !drag && S.autoTarget == null && now - S.lastInput > 350)
      S.s += (Math.round(S.s) - S.s) * Math.min(1, dt * 4);
    S.zoom += (S.zoomTarget - S.zoom) * Math.min(1, dt * 3);
    const ci = currentIndex();
    const card = spiral.cards[ci];
    if (!S.visited.has(ci) && Math.abs(S.s - ci) < 0.2) S.visited.add(ci);
    if (S.mode === 'explore') showChapter(card.ci);
    const showCap = false; // caption is handwritten on the polaroid itself
    if (showCap && ui.caption.dataset.i !== String(ci)) { ui.caption.textContent = card.cap; ui.caption.dataset.i = ci; }
    ui.caption.classList.toggle('show', !!showCap);
    // a playing memory video gets sound when zoomed in
    for (const c of spiral.cards) if (c.video) c.video.muted = !(c === card && S.zoom > 0.7);
    for (const c of spiral.cards) if (c.voice) {
      const on = c === card && S.zoom > 0.7;
      if (on && c.voice.paused && !c.voiceDone) { c.voice.play().catch(() => {}); c.voice.onended = () => { c.voiceDone = true; }; }
      if (!on && (!c.voice.paused || c.voiceDone)) { c.voice.pause(); c.voice.currentTime = 0; c.voiceDone = false; }
    }
    bg.duck(!!((card.video || (card.voice && !card.voice.paused)) && S.zoom > 0.7));
    if (S.mode === 'explore' && S.visited.size === N && ci === N - 1 && S.zoom < 0.3 && !S.endHinted) {
      S.endHinted = true;
      hint(STORY.finale.readyHint, 0);
      setTimeout(() => { if (S.mode === 'explore') startFinale(); }, AUTO ? 500 : 6000);
    }
    spiral.update(dt, ci, S.zoom, S.s);
    updateTimeline();
  } else {
    spiral.dimmed = THREE.MathUtils.lerp(spiral.dimmed ?? 0.9, S.mode === 'finale' || S.mode === 'letter' ? 0.12 : 0.9, Math.min(1, dt * 1.5));
    spiral.update(dt, -1, 0);
    ui.caption.classList.remove('show');
    if (!(letterVoice && !letterVoice.paused)) bg.duck(false);
    for (const c of spiral.cards) if (c.voice && !c.voice.paused) c.voice.pause();
    for (const c of spiral.cards) if (c.video && !c.video.paused) c.video.pause();
  }

  // camera: blend between navigation pose and scripted shots
  const nav = navPose(S.s, S.zoom);
  let rigPos = S.rigPos, rigLook = S.rigLook;
  if (S.mode === 'intro' || S.mode === 'splash') {
    const t = S.mode === 'splash' ? 0 : clamp((now - (S.introT ??= now)) / 16000, 0, 1);
    const a = time * 0.05 + 0.5;
    rigPos = new THREE.Vector3(Math.sin(a) * (34 - 20 * smooth(t)), 14 - 9 * smooth(t), Math.cos(a) * (34 - 20 * smooth(t)));
    rigLook = new THREE.Vector3(0, 2.4, 0);
    S.rig = 1 - smooth(clamp((t - 0.82) / 0.18, 0, 1));
  } else if (S.rigTarget === 'cake' || S.rigTarget === 'celebrate') {
    const th = spiral.thetaAt(S.s) + 0.42;
    const cel = S.rigTarget === 'celebrate';
    const R = (cel ? 5.4 : 5.2) * (innerWidth < innerHeight ? 1.35 : 1);
    rigPos = new THREE.Vector3(Math.sin(th + time * (cel ? 0.06 : 0.02)) * R, cake.topY + (cel ? 2.6 : 1.7), Math.cos(th + time * (cel ? 0.06 : 0.02)) * R);
    rigLook = new THREE.Vector3(0, cake.topY + (cel ? 1.6 : 0.95), 0);
    S.rig = Math.min(1, S.rig + dt * 0.45);
  } else if (S.rigTarget === 'gift' && gift) {
    const gp = gift.group.position, dir = new THREE.Vector3(gp.x, 0, gp.z).normalize();
    rigPos = gp.clone().addScaledVector(dir, 3.2).add(new THREE.Vector3(0, 1.6, 0));
    rigLook = gp.clone().add(new THREE.Vector3(0, 0.5, 0));
    S.rig = Math.min(1, S.rig + dt * 0.6);
  } else S.rig = Math.max(0, S.rig - dt * 0.6);
  S.rigPos.lerp(rigPos, Math.min(1, dt * 2.5));
  S.rigLook.lerp(rigLook, Math.min(1, dt * 2.5));
  const e = smooth(S.rig);
  camera.position.copy(nav.pos).lerp(S.rigPos, e);
  const look = nav.look.clone().lerp(S.rigLook, e);
  camera.lookAt(look);

  // fireworks during celebration
  if (S.fireworksUntil && now < S.fireworksUntil && Math.random() < dt * 3.2) {
    const a = Math.random() * Math.PI * 2;
    fx.firework(new THREE.Vector3(Math.sin(a) * 4, cake.topY + 3 + Math.random() * 3, Math.cos(a) * 4), STORY.fireworkColors || ['#ffd479', '#ff7ac8', '#8fd3ff', '#ffffff', '#ff6b6b', '#b69cff']);
  }
  if (S.mode === 'finale' && S.wishReady && sound.isBlowing(now)) blowOut();
  if (S.mode === 'finale' && Math.random() < dt * 8 && cake.litCount() > 0) {
    // a few embers rising from the candles
    const i = (Math.random() * STORY.age) | 0;
    fx.emit(new THREE.Vector3().fromArray(cake.flamePos, i * 3), new THREE.Vector3((Math.random() - 0.5) * 0.2, 0.6, (Math.random() - 0.5) * 0.2), new THREE.Color('#ffb35c'), 1.6, 0.05);
  }

  cake.update(time, dt);
  gift?.update(dt, time);
  rings.userData.update(dt);
  numberText.update(time, dt, camera);
  fx.update(dt); smoke.update(dt);
  if (useBloom) composer.render(); else renderer.render(scene, camera);
  adaptQuality(dt);
  if (S.snap) { S.snap = false; savePoster(); }
}
frame();

// Adaptive quality for phones: drop resolution, then bloom, if frames are slow.
function adaptQuality(dt) {
  if (S.mode === 'splash' || fakeOffset) return;
  slowFor = dt > 1 / 28 ? slowFor + dt : Math.max(0, slowFor - dt * 0.5);
  if (slowFor < 2.5) return;
  slowFor = 0;
  if (DPR_FORCE) return;
  const next = DPR_STEPS.find((r) => r < pixelRatio - 0.01);
  // step down to 1.5x first; below that, drop bloom before giving up more sharpness
  if (next && (next >= 1.5 || !useBloom)) setRatio(next);
  else if (useBloom) useBloom = false;
}
function setRatio(r) {
  pixelRatio = r;
  renderer.setPixelRatio(r);
  composer.setPixelRatio(r); // EffectComposer keeps its own copy of the ratio
  resize();
}

function savePoster() {
  canvas.toBlob((b) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = `${STORY.recipient}-${STORY.age}-birthday.png`;
    a.click();
  }, 'image/png');
}

// ---------------------------------------------------------------- splash text
$('splash-title').textContent = fill(STORY.title);
// ready when card textures are in (or after 10 s, whichever first)
const markReady = () => $('splash').classList.add('ready');
countdownGate(STORY, fill);
if ($('reaction-label')) $('reaction-label').lastChild.textContent = ' ' + fill(T(STORY).reactionLabel);
$('reaction-save').textContent = T(STORY).reactionSave;
if (STORY.reaction === false) $('reaction-label')?.remove();
THREE.DefaultLoadingManager.onProgress = (_, done, total) => {
  $('load-bar').style.width = `${Math.round((done / total) * 100)}%`;
  $('load-text').textContent = `正在准备照片… ${done} / ${total}`;
};
THREE.DefaultLoadingManager.onLoad = markReady;
setTimeout(markReady, 10000);
const tips = [];
if (IN_WECHAT) tips.push('在微信里摄像头和麦克风可能打不开：点右上角 ··· 选「在浏览器打开」，或者直接用手指玩');
if (IOS) tips.push('iPhone 请把侧面的静音开关关掉，才能听到音乐');
if (!tips.length) tips.push('建议打开声音 · 全屏观看效果更好');
$('env-tip').innerHTML = tips.join('<br>');
$('splash-sub').textContent = fill(STORY.subtitle);
document.title = fill(STORY.title);
cake.setLit(0);
