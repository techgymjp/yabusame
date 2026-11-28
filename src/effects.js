// 的中時の演出：板の飛散・木片・閃光・衝撃波・紅葉吹雪
import * as THREE from 'three';

function leafTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.translate(32, 34);
  g.fillStyle = '#fff';
  g.beginPath();
  for (let i = 0; i <= 14; i++) {
    const a = (i / 14) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 ? 11 : 28;
    g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.25)';
  g.lineWidth = 1.5;
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 - Math.PI / 2;
    g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * 24, Math.sin(a) * 24); g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.15, 'rgba(255,240,200,0.9)');
  grd.addColorStop(0.45, 'rgba(255,190,90,0.35)');
  grd.addColorStop(1, 'rgba(255,150,50,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  // 光条
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 12; i++) {
    g.save(); g.translate(64, 64); g.rotate((i / 12) * Math.PI * 2 + Math.random() * 0.2);
    const l = g.createLinearGradient(0, 0, 64, 0);
    l.addColorStop(0, 'rgba(255,250,230,0.8)'); l.addColorStop(1, 'rgba(255,250,230,0)');
    g.fillStyle = l;
    g.fillRect(0, -1.5, 64, 3);
    g.restore();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const MAX_LEAVES = 600, MAX_CHIPS = 400;

export class HitFX {
  constructor(scene, { light = true } = {}) {
    this.scene = scene;
    // 紅葉吹雪
    const lg = new THREE.PlaneGeometry(0.11, 0.11);
    this.leaves = new THREE.InstancedMesh(lg, new THREE.MeshStandardMaterial({
      map: leafTexture(), alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.7,
    }), MAX_LEAVES);
    this.leaves.setColorAt(0, new THREE.Color(1, 1, 1));
    this.leaves.count = 0;
    this.leaves.frustumCulled = false;
    this.leaves.castShadow = true;
    scene.add(this.leaves);
    this.leafData = [];
    // 木片
    this.chips = new THREE.InstancedMesh(new THREE.BoxGeometry(0.012, 0.06, 0.006),
      new THREE.MeshStandardMaterial({ color: 0xe8d1a2, roughness: 0.8 }), MAX_CHIPS);
    this.chips.count = 0;
    this.chips.frustumCulled = false;
    this.chips.castShadow = true;
    scene.add(this.chips);
    this.chipData = [];
    // 閃光と衝撃波
    this.glowTex = glowTexture();
    this.flashes = [];
    // 閃光の点光源（低画質では全体の描画が重くなるので使わない）
    this.light = new THREE.PointLight(0xffe2b0, 0, 14, 1.5);
    if (light) scene.add(this.light);
    this.m4 = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.e = new THREE.Euler();
    this.col = new THREE.Color();
    this.s = new THREE.Vector3();
  }

  burst(point, arrowVel, { center = false, grand = false } = {}) {
    const power = grand ? 2.2 : center ? 1.5 : 1;
    // 閃光（光条つき）
    for (const [size, life, color] of [[1.6 * power, 0.35, 0xffffff], [3.2 * power, 0.6, center || grand ? 0xffd36a : 0xffb070]]) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: this.glowTex, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      }));
      sp.position.copy(point);
      this.scene.add(sp);
      this.flashes.push({ obj: sp, t: 0, life, size, kind: 'glow' });
    }
    // 衝撃波の輪（板の面に沿って広がる）
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48), new THREE.MeshBasicMaterial({
      color: center || grand ? 0xffe08a : 0xffffff, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, fog: false,
    }));
    ring.position.copy(point);
    this.scene.add(ring);
    this.flashes.push({ obj: ring, t: 0, life: 0.5, size: 2.2 * power, kind: 'ring' });
    this.light.position.copy(point).add(new THREE.Vector3(0, 0.3, 0.8));
    this.light.intensity = 60 * power;

    // 木片
    const nChips = Math.floor(70 * power);
    for (let i = 0; i < nChips && this.chipData.length < MAX_CHIPS; i++) {
      const dir = new THREE.Vector3().randomDirection();
      this.chipData.push({
        p: point.clone(),
        v: dir.multiplyScalar(2 + Math.random() * 5 * power).addScaledVector(arrowVel, 0.08 + Math.random() * 0.08),
        r: new THREE.Vector3(Math.random() * 6, Math.random() * 6, Math.random() * 6),
        w: new THREE.Vector3((Math.random() - 0.5) * 40, (Math.random() - 0.5) * 40, (Math.random() - 0.5) * 40),
        s: 0.5 + Math.random() * 1.2, life: 3 + Math.random() * 2,
      });
    }
    // 紅葉吹雪：舞い上がってひらひらと落ちる
    const nLeaves = Math.floor(90 * power);
    const hues = center || grand ? [0.0, 0.03, 0.07, 0.12, 0.13] : [0.0, 0.02, 0.05, 0.08];
    for (let i = 0; i < nLeaves && this.leafData.length < MAX_LEAVES; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 1.5 + Math.random() * 4 * power;
      this.leafData.push({
        p: point.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4)),
        v: new THREE.Vector3(Math.cos(a) * sp, 2 + Math.random() * 4 * power, Math.sin(a) * sp * 0.7 + 1.0),
        r: new THREE.Vector3(Math.random() * 6, Math.random() * 6, Math.random() * 6),
        w: new THREE.Vector3((Math.random() - 0.5) * 9, (Math.random() - 0.5) * 9, (Math.random() - 0.5) * 9),
        ph: Math.random() * 10, s: 0.7 + Math.random() * 0.8,
        hue: hues[(Math.random() * hues.length) | 0], life: 4 + Math.random() * 3,
      });
    }
  }

  update(dt, time) {
    // 閃光
    this.flashes = this.flashes.filter(f => {
      f.t += dt;
      const k = f.t / f.life;
      if (k >= 1) { this.scene.remove(f.obj); f.obj.material.dispose(); if (f.obj.geometry) f.obj.geometry.dispose(); return false; }
      if (f.kind === 'glow') {
        const sc = f.size * (0.4 + Math.pow(k, 0.4) * 0.8);
        f.obj.scale.set(sc, sc, 1);
        f.obj.material.opacity = 1 - k * k;
        f.obj.material.rotation = k * 0.6;
      } else {
        const sc = f.size * Math.pow(k, 0.5);
        f.obj.scale.set(sc, sc, sc);
        f.obj.material.opacity = (1 - k) * 0.8;
      }
      return true;
    });
    this.light.intensity *= Math.exp(-dt * 9);

    // 木片
    const { m4, q, e, s, col } = this;
    this.chipData = this.chipData.filter(c => (c.life -= dt) > 0);
    this.chipData.forEach((c, i) => {
      if (c.p.y > 0.01) {
        c.v.y -= 9.8 * dt;
        c.v.multiplyScalar(1 - dt * 0.6);
        c.p.addScaledVector(c.v, dt);
        c.r.addScaledVector(c.w, dt);
      } else { c.p.y = 0.01; c.v.set(0, 0, 0); c.r.x = Math.PI / 2; }
      e.set(c.r.x, c.r.y, c.r.z);
      q.setFromEuler(e);
      const fade = Math.min(1, c.life);
      m4.compose(c.p, q, s.set(c.s * fade, c.s * fade, c.s * fade));
      this.chips.setMatrixAt(i, m4);
    });
    this.chips.count = this.chipData.length;
    this.chips.instanceMatrix.needsUpdate = true;

    // 紅葉：空気抵抗が大きく、揺れながら落ちる
    this.leafData = this.leafData.filter(l => (l.life -= dt) > 0);
    this.leafData.forEach((l, i) => {
      if (l.p.y > 0.01) {
        l.v.y -= 9.8 * dt;
        l.v.multiplyScalar(1 - Math.min(0.9, dt * 3.2));
        l.v.y = Math.max(l.v.y, -0.9);
        l.p.addScaledVector(l.v, dt);
        l.p.x += Math.sin(time * 3 + l.ph) * dt * 0.6;
        l.p.z += Math.cos(time * 2.3 + l.ph) * dt * 0.6;
        l.r.addScaledVector(l.w, dt);
      } else { l.p.y = 0.01; l.r.set(-Math.PI / 2, l.r.y, 0); }
      e.set(l.r.x, l.r.y, l.r.z);
      q.setFromEuler(e);
      const fade = Math.min(1, l.life * 0.7);
      m4.compose(l.p, q, s.set(l.s * fade, l.s * fade, l.s * fade));
      this.leaves.setMatrixAt(i, m4);
      this.leaves.setColorAt(i, col.setHSL(l.hue, 0.85, 0.45));
    });
    this.leaves.count = this.leafData.length;
    this.leaves.instanceMatrix.needsUpdate = true;
    if (this.leaves.instanceColor) this.leaves.instanceColor.needsUpdate = true;
  }

  clear() {
    this.leafData = []; this.chipData = [];
    this.leaves.count = 0; this.chips.count = 0;
    for (const f of this.flashes) this.scene.remove(f.obj);
    this.flashes = [];
  }
}
