// All sound is synthesised with Web Audio: no music files, no copyright issues.
// "Happy Birthday to You" (melody public domain) as a music box, a soft ambient pad,
// and microphone "blow out the candles" detection.

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
const M = { G4: 67, A4: 69, B4: 71, C5: 72, D5: 74, E5: 76, F5: 77, G5: 79 };
// [note, beats] in 3/4
const HAPPY_BIRTHDAY = [
  ['G4', .75], ['G4', .25], ['A4', 1], ['G4', 1], ['C5', 1], ['B4', 2],
  ['G4', .75], ['G4', .25], ['A4', 1], ['G4', 1], ['D5', 1], ['C5', 2],
  ['G4', .75], ['G4', .25], ['G5', 1], ['E5', 1], ['C5', 1], ['B4', 1], ['A4', 2],
  ['F5', .75], ['F5', .25], ['E5', 1], ['C5', 1], ['D5', 1], ['C5', 3],
];

export class Sound {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  init() {
    if (this.ctx) return;
    const ctx = (this.ctx = new (window.AudioContext || window.webkitAudioContext)());
    this.master = ctx.createGain(); this.master.gain.value = 0.9;
    this.music = ctx.createGain(); this.music.gain.value = 1;
    // simple feedback-delay "room"
    const delay = ctx.createDelay(); delay.delayTime.value = 0.23;
    const fb = ctx.createGain(); fb.gain.value = 0.32;
    const wet = ctx.createGain(); wet.gain.value = 0.35;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
    this.music.connect(this.master);
    this.music.connect(delay); delay.connect(lp); lp.connect(fb); fb.connect(delay); lp.connect(wet); wet.connect(this.master);
    this.master.connect(ctx.destination);
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.1);
  }

  duck(on) {
    if (this.music) this.music.gain.setTargetAtTime(on ? 0.18 : 1, this.ctx.currentTime, 0.4);
  }

  pluck(freq, t, vel = 0.25, len = 1.6) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vel, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0008, t + len);
    for (const [mult, amp, type] of [[1, 1, 'sine'], [2, 0.35, 'sine'], [3.01, 0.12, 'triangle'], [5.4, 0.05, 'sine']]) {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq * mult;
      const og = ctx.createGain(); og.gain.value = amp;
      o.connect(og); og.connect(g); o.start(t); o.stop(t + len + 0.05);
    }
    g.connect(this.music);
  }

  playBirthday({ bpm = 92, octave = 12, loops = 1 } = {}) {
    if (!this.ctx) return 0;
    const beat = 60 / bpm;
    let t = this.ctx.currentTime + 0.2;
    for (let l = 0; l < loops; l++) {
      for (const [n, b] of HAPPY_BIRTHDAY) {
        const f = NOTE(M[n] + octave - 12);
        this.pluck(f, t, 0.22);
        if (b >= 1) this.pluck(f / 2, t, 0.08, 2.2); // soft bass note on long beats
        t += b * beat;
      }
      t += beat;
    }
    return t - this.ctx.currentTime;
  }

  startAmbient() {
    if (!this.ctx || this._amb) return;
    this._amb = true;
    const ctx = this.ctx;
    const pad = ctx.createGain(); pad.gain.value = 0.0; pad.connect(this.music);
    pad.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 4);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.connect(pad);
    const chords = [[48, 55, 64, 71], [45, 52, 60, 67], [41, 48, 57, 64], [43, 50, 59, 62]];
    const pent = [72, 74, 76, 79, 81, 84];
    let i = 0;
    const next = () => {
      if (!this._amb) return;
      const t = ctx.currentTime, dur = 4.5;
      for (const n of chords[i % chords.length]) {
        const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = NOTE(n);
        o.detune.value = (Math.random() - 0.5) * 10;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.25, t + 2); g.gain.linearRampToValueAtTime(0, t + dur + 1.5);
        o.connect(g); g.connect(lp); o.start(t); o.stop(t + dur + 2);
      }
      // a few wind-chime music-box notes
      for (let k = 0; k < 3; k++) if (Math.random() < 0.7)
        this.pluck(NOTE(pent[(Math.random() * pent.length) | 0]), t + Math.random() * dur, 0.06, 2.5);
      i++;
      this._ambTimer = setTimeout(next, dur * 1000);
    };
    next();
  }

  stopAmbient() { this._amb = false; clearTimeout(this._ambTimer); }

  chime() { if (this.ctx) { const t = this.ctx.currentTime; this.pluck(NOTE(84), t, 0.08, 1.2); this.pluck(NOTE(91), t + 0.08, 0.06, 1.4); } }

  // ---- microphone blow detection: low-frequency energy held > 0.2 for 500 ms ----
  async startMic() {
    this.init();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false } });
    const src = this.ctx.createMediaStreamSource(stream);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 256; this.analyser.smoothingTimeConstant = 0.3;
    src.connect(this.analyser);
    this._bins = new Uint8Array(this.analyser.frequencyBinCount);
    this._blowSince = 0;
  }

  blowLevel() {
    if (!this.analyser) return 0;
    this.analyser.getByteFrequencyData(this._bins);
    let s = 0; for (let i = 0; i < 10; i++) s += this._bins[i];
    return s / 10 / 255;
  }

  isBlowing(now) {
    const lv = this.blowLevel();
    if (lv > 0.2) { if (!this._blowSince) this._blowSince = now; return now - this._blowSince > 500; }
    this._blowSince = 0; return false;
  }
}
