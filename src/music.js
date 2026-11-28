// BGM：都節音階（ミヤコブシ）の箏・篠笛・太鼓を WebAudio で合成する
const BASE = 293.66; // D4
const SCALE = [0, 1, 5, 7, 8, 12, 13, 17, 19, 20, 24]; // 都節：D E♭ G A B♭
const note = (deg, oct = 0) => BASE * Math.pow(2, (SCALE[((deg % 5) + 5) % 5] + 12 * (Math.floor(deg / 5) + oct)) / 12);

// 曲ごとの設定
const SONGS = {
  title: { bpm: 66, koto: [0, 2, 3, 4, 3, 2, 1, 0], kotoEvery: 2, flute: true, taiko: null, shime: null, vol: 0.55 },
  ready: { bpm: 80, koto: [0, null, 0, null, 3, null, 2, null], kotoEvery: 1, flute: false, taiko: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0], shime: null, vol: 0.5 },
  run: { bpm: 152, koto: [0, 0, 3, 0, 4, 3, 2, 1], kotoEvery: 1, flute: true, taiko: [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 0, 0], shime: [1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1], vol: 0.6 },
  result: { bpm: 72, koto: [4, 3, 2, 0, 2, 3, 5, 4], kotoEvery: 1, flute: true, taiko: null, shime: null, vol: 0.5 },
  grand: { bpm: 120, koto: [5, 4, 3, 4, 5, 7, 6, 5], kotoEvery: 1, flute: true, taiko: [1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 1], shime: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], vol: 0.6 },
};
// 篠笛の旋律（音階の度数、null は休み、長さは 8 分音符単位）
const MELODIES = {
  title: [[4, 4], [3, 2], [2, 2], [3, 6], [null, 2], [2, 2], [1, 2], [0, 4], [null, 4], [5, 4], [4, 2], [3, 2], [2, 8]],
  run: [[5, 2], [4, 1], [3, 1], [4, 2], [5, 2], [7, 3], [6, 1], [5, 4], [3, 2], [4, 2], [5, 1], [4, 1], [3, 2], [2, 4], [null, 2]],
  result: [[2, 4], [3, 2], [4, 2], [5, 6], [4, 2], [3, 4], [2, 4], [null, 4]],
  grand: [[5, 2], [7, 2], [8, 2], [7, 2], [5, 4], [6, 2], [7, 2], [10, 6], [null, 2]],
};

export class Music {
  constructor(sound) {
    this.sound = sound;
    this.mode = null;
    this.step = 0;
    this.next = 0;
    this.melIdx = 0;
    this.melLeft = 0;
    this.timer = null;
  }

  setup() {
    const c = this.sound.ctx;
    if (!c || this.out) return !!this.out;
    this.out = c.createGain();
    this.out.gain.value = 0;
    // 広間の残響（短いフィードバック遅延）
    const d = c.createDelay(1);
    d.delayTime.value = 0.23;
    const fb = c.createGain();
    fb.gain.value = 0.28;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 2200;
    this.out.connect(this.sound.master);
    this.out.connect(d); d.connect(lp); lp.connect(fb); fb.connect(d); lp.connect(this.sound.master);
    return true;
  }

  play(mode) {
    if (mode === this.mode) return;
    this.mode = mode;
    this.step = 0; this.melIdx = 0; this.melLeft = 0;
    if (!this.timer) this.timer = setInterval(() => this.tick(), 50);
    if (this.out) {
      const c = this.sound.ctx;
      this.out.gain.cancelScheduledValues(c.currentTime);
      this.out.gain.setTargetAtTime(SONGS[mode] ? SONGS[mode].vol * 0.5 : 0, c.currentTime, 0.4);
      this.next = c.currentTime + 0.1;
    }
  }

  tick() {
    if (!this.setup() || !this.mode) return;
    const c = this.sound.ctx;
    if (c.state !== 'running') { this.next = c.currentTime + 0.1; return; }
    if (this.out.gain.value === 0) this.out.gain.setTargetAtTime(SONGS[this.mode].vol * 0.5, c.currentTime, 0.5);
    const song = SONGS[this.mode];
    const dt = 60 / song.bpm / 2; // 8 分音符
    if (this.next < c.currentTime) this.next = c.currentTime + 0.05;
    while (this.next < c.currentTime + 0.25) {
      const st = this.step;
      const t = this.next;
      // 箏の分散和音
      if (st % song.kotoEvery === 0) {
        const deg = song.koto[(st / song.kotoEvery) % song.koto.length];
        if (deg !== null && deg !== undefined) this.koto(note(deg, -1), t, 0.22);
        if (st % 8 === 0) this.koto(note(0, -2), t, 0.18);
      }
      if (song.taiko && song.taiko[st % 16]) this.taiko(t, st % 8 === 0 ? 1 : 0.7);
      if (song.shime && song.shime[st % 16]) this.shime(t, st % 4 === 0 ? 1 : 0.55);
      // 篠笛
      const mel = MELODIES[this.mode];
      if (song.flute && mel) {
        if (this.melLeft <= 0) {
          const [deg, len] = mel[this.melIdx % mel.length];
          this.melIdx++;
          this.melLeft = len;
          if (deg !== null) this.flute(note(deg, 1), t, len * dt);
        }
        this.melLeft--;
      }
      this.step++;
      this.next += dt;
    }
  }

  koto(f, t, vol) {
    const c = this.sound.ctx;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(f * 8, t);
    lp.frequency.exponentialRampToValueAtTime(f * 2, t + 0.5);
    for (const [type, mul, v] of [['triangle', 1, 1], ['sawtooth', 1.002, 0.25], ['sine', 2, 0.3]]) {
      const o = c.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(f * mul * 1.012, t);
      o.frequency.exponentialRampToValueAtTime(f * mul, t + 0.06); // 弾いた直後のわずかな音程の揺れ
      const og = c.createGain();
      og.gain.value = v;
      o.connect(og).connect(lp);
      o.start(t); o.stop(t + 1.7);
    }
    lp.connect(g).connect(this.out);
  }

  flute(f, t, dur) {
    const c = this.sound.ctx;
    const g = c.createGain();
    const v = 0.09;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + Math.min(0.12, dur * 0.3));
    g.gain.setValueAtTime(v, t + dur * 0.75);
    g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.05);
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(f * 0.97, t);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.08); // 篠笛らしい音の入り
    const vib = c.createOscillator();
    vib.frequency.value = 5.2;
    const vg = c.createGain();
    vg.gain.setValueAtTime(0, t);
    vg.gain.linearRampToValueAtTime(f * 0.012, t + dur * 0.6);
    vib.connect(vg).connect(o.frequency);
    const o2 = c.createOscillator();
    o2.type = 'sine';
    o2.frequency.value = f * 2;
    const g2 = c.createGain();
    g2.gain.value = 0.12;
    o2.connect(g2).connect(g);
    // 息の音
    const n = this.sound.noiseSrc();
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = f * 2; bp.Q.value = 3;
    const ng = c.createGain();
    ng.gain.value = 0.25;
    n.connect(bp).connect(ng).connect(g);
    o.connect(g).connect(this.out);
    for (const x of [o, vib, o2]) { x.start(t); x.stop(t + dur + 0.1); }
    n.start(t, Math.random()); n.stop(t + dur + 0.1);
  }

  taiko(t, v) {
    const c = this.sound.ctx;
    const o = c.createOscillator();
    o.frequency.setValueAtTime(95, t);
    o.frequency.exponentialRampToValueAtTime(48, t + 0.3);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.55 * v, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    o.connect(g).connect(this.out);
    o.start(t); o.stop(t + 0.55);
  }

  // 締太鼓（高く乾いた音）
  shime(t, v) {
    const c = this.sound.ctx;
    const n = this.sound.noiseSrc();
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 2;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16 * v, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    const o = c.createOscillator();
    o.frequency.value = 420;
    const og = c.createGain();
    og.gain.setValueAtTime(0.08 * v, t);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    n.connect(bp).connect(g).connect(this.out);
    o.connect(og).connect(this.out);
    n.start(t, Math.random()); n.stop(t + 0.08);
    o.start(t); o.stop(t + 0.07);
  }
}
