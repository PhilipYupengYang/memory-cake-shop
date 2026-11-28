// Webcam hand tracking with MediaPipe HandLandmarker (vendored, works offline).
// Gesture maths follow the viral "gesture Christmas tree" projects: every distance
// is divided by hand size (wrist -> middle-finger knuckle) so it works at any range.

const TIPS = [8, 12, 16, 20];
const BONES = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],
  [9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];
const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export class Hands {
  constructor(video, overlay) {
    this.video = video;
    this.overlay = overlay;
    this.ctx = overlay.getContext('2d');
    this.state = { present: false, x: 0.5, y: 0.5, pose: 'none', heart: false, hands: 0 };
    this._raw = 'none';
    this._count = 0;
    this._lastT = -1;
    this.ready = false;
  }

  async start() {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }, audio: false,
    });
    this.video.srcObject = stream;
    await this.video.play();
    const { FilesetResolver, HandLandmarker } = await import('../vendor/vision_bundle.mjs');
    const fileset = await FilesetResolver.forVisionTasks(new URL('../vendor/wasm', import.meta.url).href);
    const opts = (delegate) => ({
      baseOptions: { modelAssetPath: new URL('../vendor/hand_landmarker.task', import.meta.url).href, delegate },
      runningMode: 'VIDEO', numHands: 2,
      minHandDetectionConfidence: 0.5, minHandPresenceConfidence: 0.5, minTrackingConfidence: 0.5,
    });
    try { this.lm = await HandLandmarker.createFromOptions(fileset, opts('GPU')); }
    catch { this.lm = await HandLandmarker.createFromOptions(fileset, opts('CPU')); }
    this.ready = true;
    this.overlay.width = this.video.videoWidth || 640;
    this.overlay.height = this.video.videoHeight || 480;
    const loop = () => {
      requestAnimationFrame(loop); // schedule first so one bad frame never kills the loop
      try { this._tick(); } catch (e) { console.warn(e); }
    };
    loop();
  }

  stop() {
    this.video.srcObject?.getTracks().forEach((t) => t.stop());
  }

  _tick() {
    const v = this.video;
    if (!this.lm || v.readyState < 2 || v.currentTime === this._lastT) return;
    this._lastT = v.currentTime;
    const res = this.lm.detectForVideo(v, performance.now());
    const hands = (res.landmarks || []).filter((lm) => d(lm[0], lm[9]) > 0.04);
    this._draw(hands);
    const s = this.state;
    s.hands = hands.length;
    if (!hands.length) { s.present = false; this._settle('none'); return; }

    const feats = hands.map((lm) => {
      const size = d(lm[0], lm[9]);
      const ext = TIPS.reduce((a, t) => a + d(lm[0], lm[t]), 0) / 4 / size;
      return { lm, size, ext, pinch: d(lm[4], lm[8]) / size, x: 1 - lm[9].x, y: lm[9].y };
    });
    // Heart (比心 with two hands): thumb tips touch and index tips touch.
    if (feats.length === 2) {
      const [a, b] = feats, sz = (a.size + b.size) / 2;
      s.heart = d(a.lm[4], b.lm[4]) / sz < 0.7 && d(a.lm[8], b.lm[8]) / sz < 0.7;
    } else s.heart = false;

    const f = feats.reduce((p, c) => (c.size > p.size ? c : p)); // closest hand drives
    s.present = true;
    s.x += (f.x - s.x) * 0.35;
    s.y += (f.y - s.y) * 0.35;
    let pose = 'mid';
    if (f.ext < 1.45) pose = 'fist';          // check fist first
    else if (f.pinch < 0.33) pose = 'pinch';
    else if (f.ext > 1.7) pose = 'open';
    this._settle(pose);
  }

  _settle(pose) {
    // Debounce: a pose must hold for a few frames before it counts.
    if (pose === this._raw) this._count++; else { this._raw = pose; this._count = 0; }
    if (this._count >= 4 || pose === 'none') this.state.pose = pose;
  }

  _draw(hands) {
    const { ctx, overlay: c } = this;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,240,220,0.9)'; ctx.fillStyle = '#ffd479';
    for (const lm of hands) {
      ctx.beginPath();
      for (const [a, b] of BONES) {
        ctx.moveTo(lm[a].x * c.width, lm[a].y * c.height);
        ctx.lineTo(lm[b].x * c.width, lm[b].y * c.height);
      }
      ctx.stroke();
      for (const p of lm) { ctx.beginPath(); ctx.arc(p.x * c.width, p.y * c.height, 4, 0, 7); ctx.fill(); }
    }
  }
}
