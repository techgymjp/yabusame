// WebAudio による効果音の合成（音声ファイル不要）
export class Sound {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.8;
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate * 2;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      // ピンクノイズ近似
      b0 = 0.99765 * b0 + w * 0.099046;
      b1 = 0.963 * b1 + w * 0.2965164;
      b2 = 0.57 * b2 + w * 1.0526913;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2;
    }
    this.startAmbience();
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  noiseSrc(loop = false) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    s.loop = loop;
    return s;
  }

  startAmbience() {
    const c = this.ctx;
    // 風
    const n = this.noiseSrc(true);
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 400;
    const g = c.createGain();
    g.gain.value = 0.05;
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.13;
    const lg = c.createGain();
    lg.gain.value = 180;
    lfo.connect(lg).connect(f.frequency);
    n.connect(f).connect(g).connect(this.master);
    n.start();
    lfo.start();
    // 観客のざわめき
    const n2 = this.noiseSrc(true);
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 900;
    bp.Q.value = 0.7;
    this.crowdGain = c.createGain();
    this.crowdGain.gain.value = 0.025;
    n2.connect(bp).connect(this.crowdGain).connect(this.master);
    n2.start(0, 0.7);
    // 疾走時の風切り音
    const n3 = this.noiseSrc(true);
    const hp = c.createBiquadFilter();
    hp.type = 'bandpass';
    hp.frequency.value = 700;
    hp.Q.value = 0.4;
    this.rushGain = c.createGain();
    this.rushGain.gain.value = 0;
    n3.connect(hp).connect(this.rushGain).connect(this.master);
    n3.start(0, 1.3);
  }

  setRush(speed) {
    if (!this.ctx) return;
    this.rushGain.gain.setTargetAtTime(Math.min(0.12, speed * 0.008), this.ctx.currentTime, 0.2);
  }

  hoof(vol = 1, pan = 0) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(95 + Math.random() * 20, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.55 * vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    const n = this.noiseSrc();
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 900;
    const ng = c.createGain();
    ng.gain.setValueAtTime(0.5 * vol, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    const p = c.createStereoPanner ? c.createStereoPanner() : c.createGain();
    if (p.pan) p.pan.value = pan;
    o.connect(g).connect(p);
    n.connect(f).connect(ng).connect(p);
    p.connect(this.master);
    o.start(t); o.stop(t + 0.2);
    n.start(t, Math.random()); n.stop(t + 0.12);
  }

  creak(amount) {
    // 弓を引くきしみ
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    const n = this.noiseSrc();
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 300 + amount * 500;
    f.Q.value = 8;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.08, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    n.connect(f).connect(g).connect(this.master);
    n.start(t, Math.random()); n.stop(t + 0.4);
  }

  twang(power) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    // 弦音（つるね）
    for (const [freq, vol] of [[180, 0.35], [362, 0.15], [545, 0.08]]) {
      const o = c.createOscillator();
      o.type = 'triangle';
      o.frequency.setValueAtTime(freq * (1 + power * 0.1), t);
      o.frequency.exponentialRampToValueAtTime(freq * 0.92, t + 0.4);
      const g = c.createGain();
      g.gain.setValueAtTime(vol * (0.5 + power * 0.5), t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      o.connect(g).connect(this.master);
      o.start(t); o.stop(t + 0.55);
    }
    const n = this.noiseSrc();
    const f = c.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 1500;
    const g = c.createGain();
    g.gain.setValueAtTime(0.3, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    n.connect(f).connect(g).connect(this.master);
    n.start(t); n.stop(t + 0.08);
  }

  // 鏑矢の風切り（ヒョーという音）
  whistle() {
    if (!this.ctx) return null;
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(1500, t);
    const vib = c.createOscillator();
    vib.frequency.value = 23;
    const vg = c.createGain();
    vg.gain.value = 40;
    vib.connect(vg).connect(o.frequency);
    const n = this.noiseSrc(true);
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1550;
    bp.Q.value = 12;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.09, t + 0.03);
    const ng = c.createGain();
    ng.gain.value = 0.9;
    o.connect(g);
    n.connect(bp).connect(ng).connect(g);
    g.connect(this.master);
    o.start(t); vib.start(t); n.start(t, Math.random());
    return {
      update: (speed) => {
        const tt = c.currentTime;
        o.frequency.setTargetAtTime(700 + speed * 22, tt, 0.05);
        bp.frequency.setTargetAtTime(740 + speed * 22, tt, 0.05);
      },
      stop: () => {
        const tt = c.currentTime;
        g.gain.cancelScheduledValues(tt);
        g.gain.setTargetAtTime(0.0001, tt, 0.04);
        o.stop(tt + 0.3); vib.stop(tt + 0.3); n.stop(tt + 0.3);
      },
    };
  }

  hit(center) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    // 板が割れる「パーン」
    const n = this.noiseSrc();
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1800;
    f.Q.value = 0.8;
    const g = c.createGain();
    g.gain.setValueAtTime(1.2, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    n.connect(f).connect(g).connect(this.master);
    n.start(t, Math.random()); n.stop(t + 0.3);
    const o = c.createOscillator();
    o.type = 'square';
    o.frequency.setValueAtTime(320, t);
    o.frequency.exponentialRampToValueAtTime(120, t + 0.1);
    const og = c.createGain();
    og.gain.setValueAtTime(0.25, t);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    o.connect(og).connect(this.master);
    o.start(t); o.stop(t + 0.15);
    // 木片がからから落ちる音
    for (let i = 0; i < 5; i++) {
      const tt = t + 0.35 + Math.random() * 0.5;
      const k = c.createOscillator();
      k.type = 'triangle';
      k.frequency.value = 600 + Math.random() * 900;
      const kg = c.createGain();
      kg.gain.setValueAtTime(0.0001, tt);
      kg.gain.exponentialRampToValueAtTime(0.06, tt + 0.003);
      kg.gain.exponentialRampToValueAtTime(0.0001, tt + 0.06);
      k.connect(kg).connect(this.master);
      k.start(tt); k.stop(tt + 0.08);
    }
    this.cheer(center ? 1.4 : 1);
  }

  thud() {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    const n = this.noiseSrc();
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 500;
    const g = c.createGain();
    g.gain.setValueAtTime(0.25, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    n.connect(f).connect(g).connect(this.master);
    n.start(t, Math.random()); n.stop(t + 0.15);
  }

  cheer(level = 1) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    // 歓声と拍手
    const n = this.noiseSrc();
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1100;
    bp.Q.value = 0.5;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.35 * level, t + 0.25);
    g.gain.setTargetAtTime(0.0001, t + 0.9, 0.6);
    n.connect(bp).connect(g).connect(this.master);
    n.start(t, Math.random()); n.stop(t + 3.5);
    for (let i = 0; i < 70 * level; i++) {
      const tt = t + 0.2 + Math.random() * 2.2;
      const s = this.noiseSrc();
      const hp = c.createBiquadFilter();
      hp.type = 'bandpass';
      hp.frequency.value = 1500 + Math.random() * 1500;
      const cg = c.createGain();
      const v = 0.05 * Math.exp(-(tt - t) * 0.8);
      cg.gain.setValueAtTime(0.0001, tt);
      cg.gain.exponentialRampToValueAtTime(v + 0.0002, tt + 0.002);
      cg.gain.exponentialRampToValueAtTime(0.0001, tt + 0.03);
      s.connect(hp).connect(cg).connect(this.master);
      s.start(tt, Math.random() * 1.5); s.stop(tt + 0.04);
    }
  }

  drum() {
    // 開始の太鼓
    if (!this.ctx) return;
    const c = this.ctx;
    [0, 0.45, 0.9].forEach((dt, i) => {
      const t = c.currentTime + dt;
      const o = c.createOscillator();
      o.frequency.setValueAtTime(90, t);
      o.frequency.exponentialRampToValueAtTime(48, t + 0.4);
      const g = c.createGain();
      g.gain.setValueAtTime(i === 2 ? 0.9 : 0.6, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
      o.connect(g).connect(this.master);
      o.start(t); o.stop(t + 0.75);
    });
  }
}
