// 馬（襲歩の脚運び）と射手（狩装束・立透かし）
import * as THREE from 'three';
import { Bow, makeArrow, BOW } from './archery.js';
import { robeTexture, furTexture, hairCardTexture } from './textures.js';
import { loft } from './loft.js';

const TAU = Math.PI * 2;
const up = new THREE.Vector3(0, 1, 0);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();
const _m = new THREE.Matrix4();

// 単位円柱 (y方向 0..1) を点aから点bへ張る
function unitLimb(radiusTop, radiusBottom, mat, seg = 10) {
  const geo = new THREE.CylinderGeometry(radiusTop, radiusBottom, 1, seg);
  geo.translate(0, 0.5, 0);
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  return m;
}
function stretch(mesh, a, b) {
  _c.subVectors(b, a);
  const len = _c.length();
  mesh.position.copy(a);
  mesh.quaternion.setFromUnitVectors(up, _c.normalize());
  mesh.scale.set(1, Math.max(len, 0.001), 1);
}

const BAY = 0x6a3a1e, BAY_DARK = 0x4a2814, POINTS = 0x1b1411, MUZZLE = 0x2a1d18, HOOF = 0x2b2624;

export class Horse {
  constructor() {
    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.root.add(this.body);
    this.baseY = 1.3;
    this.body.position.y = this.baseY;
    // 鹿毛：艶のある短毛（シーン）
    const coat = new THREE.MeshPhysicalMaterial({
      vertexColors: true, roughness: 0.42, metalness: 0,
      sheen: 0.7, sheenRoughness: 0.45, sheenColor: new THREE.Color(0x9a6a48),
      clearcoat: 0.12, clearcoatRoughness: 0.6,
    });
    const hairTex = hairCardTexture();
    const hairMat = new THREE.MeshStandardMaterial({ map: hairTex, alphaTest: 0.3, side: THREE.DoubleSide, roughness: 0.8, color: 0x5a4a40 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x0c0907, roughness: 0.4 });
    const red = new THREE.MeshStandardMaterial({ color: 0xa8161b, roughness: 0.7 });
    const lacq = new THREE.MeshPhysicalMaterial({ color: 0x120c0a, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.1 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xc9a043, roughness: 0.3, metalness: 0.9 });
    const fur = new THREE.MeshStandardMaterial({ map: furTexture(), roughness: 0.95 });
    this.mats = { coat };
    const add = (geo, mat, parent = this.body) => {
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = true;
      m.receiveShadow = true;
      parent.add(m);
      return m;
    };

    // 胴（尻〜胸）
    add(loft([
      { s: -1.08, c: 0.15, a: 0.05, b: 0.05, color: BAY },
      { s: -1.0, c: 0.11, a: 0.24, b: 0.19, color: BAY },
      { s: -0.86, c: 0.06, a: 0.35, b: 0.27, color: BAY },
      { s: -0.66, c: 0.04, a: 0.39, b: 0.3, color: BAY },
      { s: -0.4, c: 0.02, a: 0.37, b: 0.29, color: BAY },
      { s: -0.1, c: -0.01, a: 0.38, b: 0.31, color: BAY },
      { s: 0.2, c: 0.02, a: 0.4, b: 0.31, color: BAY },
      { s: 0.45, c: 0.05, a: 0.41, b: 0.28, color: BAY },
      { s: 0.68, c: 0.05, a: 0.39, b: 0.25, color: BAY },
      { s: 0.86, c: 0.01, a: 0.33, b: 0.21, color: BAY },
      { s: 0.98, c: -0.03, a: 0.21, b: 0.15, color: BAY },
      { s: 1.04, c: -0.05, a: 0.05, b: 0.05, color: BAY },
    ], { axis: 'x', radial: 36, per: 6, nTop: 2.5, nBottom: 2.1 }).scale(0.82, 1, 1), coat);

    // 首
    this.neck = new THREE.Group();
    this.neck.position.set(0.66, 0.2, 0);
    this.neck.rotation.z = -0.72;
    this.body.add(this.neck);
    add(loft([
      { s: -0.2, c: 0.02, a: 0.2, b: 0.25, color: BAY },
      { s: 0.05, c: 0.0, a: 0.18, b: 0.22, color: BAY },
      { s: 0.35, c: -0.01, a: 0.14, b: 0.17, color: BAY },
      { s: 0.62, c: -0.02, a: 0.105, b: 0.125, color: BAY },
      { s: 0.84, c: -0.02, a: 0.095, b: 0.115, color: BAY },
      { s: 0.98, c: -0.01, a: 0.085, b: 0.1, color: BAY },
    ], { axis: 'y', radial: 24, per: 5, nTop: 2.2, nBottom: 2.2 }), coat, this.neck);
    // たてがみ（鬣の付け根から右側へ垂れる毛の板）
    const hang = new THREE.Vector3(0.35, 0, 1).normalize();
    const mx = new THREE.Vector3(0, 1, 0), my = hang.clone().negate(), mz = new THREE.Vector3().crossVectors(mx, my);
    const maneQ = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(mx, my, mz));
    for (let i = 0; i < 18; i++) {
      const t = i / 17;
      const sy = -0.08 + t * 1.02;
      const crest = 0.155 - t * 0.065;
      const card = new THREE.Mesh(new THREE.PlaneGeometry(0.13, 0.22 + Math.random() * 0.08), hairMat);
      card.geometry.translate(0, -card.geometry.parameters.height / 2, 0);
      card.position.set(-crest + 0.01, sy, 0.01);
      card.quaternion.copy(maneQ);
      card.rotateX((Math.random() - 0.5) * 0.2);
      this.neck.add(card);
    }

    // 頭
    this.head = new THREE.Group();
    this.head.position.y = 0.92;
    this.head.rotation.z = -1.75;
    this.neck.add(this.head);
    add(loft([
      { s: -0.06, c: 0.02, a: 0.1, b: 0.09, color: BAY },
      { s: 0.04, c: 0.035, a: 0.15, b: 0.115, color: BAY },
      { s: 0.2, c: 0.015, a: 0.14, b: 0.11, color: BAY },
      { s: 0.4, c: 0.0, a: 0.1, b: 0.095, color: BAY_DARK },
      { s: 0.6, c: 0.0, a: 0.08, b: 0.08, color: BAY_DARK },
      { s: 0.76, c: 0.004, a: 0.072, b: 0.074, color: MUZZLE },
      { s: 0.88, c: 0.008, a: 0.078, b: 0.08, color: MUZZLE },
      { s: 0.96, c: 0.004, a: 0.06, b: 0.066, color: MUZZLE },
      { s: 0.99, c: 0.0, a: 0.03, b: 0.03, color: MUZZLE },
    ], { axis: 'y', radial: 24, per: 5, nTop: 2.3, nBottom: 2.0 }).scale(1.05, 0.6, 1.05), coat, this.head);
    for (const sd of [-1, 1]) {
      const ear = add(new THREE.ConeGeometry(0.035, 0.14, 8), coat, this.head);
      ear.geometry = ear.geometry.clone();
      const ec = ear.geometry.attributes.position.count;
      ear.geometry.setAttribute('color', new THREE.Float32BufferAttribute(new Array(ec).fill(0).flatMap(() => [0.2, 0.12, 0.08]), 3));
      ear.position.set(-0.06, -0.06, sd * 0.055);
      ear.rotation.z = 2.47;
      ear.rotation.x = sd * -0.25;
      const eye = add(new THREE.SphereGeometry(0.02, 10, 8), dark, this.head);
      eye.position.set(-0.05, 0.11, sd * 0.105);
      const nostril = add(new THREE.SphereGeometry(0.018, 8, 6), dark, this.head);
      nostril.position.set(-0.035, 0.565, sd * 0.05);
      nostril.scale.set(1, 1.6, 0.6);
      // 面繋（赤い紐）
      const strap = add(new THREE.TorusGeometry(0.1, 0.01, 6, 20), red, this.head);
      strap.position.y = 0.38;
      strap.rotation.x = Math.PI / 2;
      strap.scale.set(0.85, 0.85, 1);
    }
    const brow = add(new THREE.TorusGeometry(0.125, 0.012, 6, 20), red, this.head);
    brow.position.y = 0.02;
    brow.rotation.x = Math.PI / 2;
    brow.scale.set(1.15, 0.9, 1);
    // 前髪
    const forelock = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.18), hairMat);
    forelock.geometry.translate(0, 0.09, 0);
    forelock.position.set(-0.11, 0.0, 0);
    forelock.rotation.set(Math.PI / 2, 0, 0);
    this.head.add(forelock);

    // 尾（毛の板の束）
    this.tail = new THREE.Group();
    this.tail.position.set(-0.87, 0.16, 0);
    this.body.add(this.tail);
    const dock = add(new THREE.CylinderGeometry(0.045, 0.06, 0.28, 8), dark, this.tail);
    dock.position.y = -0.12;
    for (let i = 0; i < 9; i++) {
      const card = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.95), hairMat);
      card.geometry.translate(0, -0.47, 0);
      card.rotation.y = (i / 9) * Math.PI;
      card.rotation.z = (Math.random() - 0.5) * 0.25;
      card.scale.x = 0.8 + Math.random() * 0.6;
      card.position.y = -0.05;
      this.tail.add(card);
    }

    // 脚：左後・右後・左前・右前（交叉襲歩の着地順）
    const legDefs = [
      { x: -0.54, z: -0.17, off: 0.0, front: false },
      { x: -0.54, z: 0.17, off: 0.11, front: false },
      { x: 0.56, z: -0.16, off: 0.42, front: true },
      { x: 0.56, z: 0.16, off: 0.53, front: true },
    ];
    const upperFront = loft([
      { s: 0.1, c: 0.0, a: 0.12, b: 0.1, color: BAY },
      { s: -0.12, c: 0.0, a: 0.1, b: 0.085, color: BAY },
      { s: -0.32, c: 0.005, a: 0.07, b: 0.066, color: BAY },
      { s: -0.46, c: 0.0, a: 0.058, b: 0.06, color: BAY_DARK },
      { s: -0.52, c: 0.0, a: 0.06, b: 0.06, color: POINTS },
    ], { axis: 'y', radial: 16, per: 4 });
    const upperHind = loft([
      { s: 0.15, c: 0.0, a: 0.2, b: 0.13, color: BAY },
      { s: -0.1, c: 0.02, a: 0.15, b: 0.1, color: BAY },
      { s: -0.32, c: 0.03, a: 0.09, b: 0.07, color: BAY },
      { s: -0.47, c: 0.04, a: 0.07, b: 0.055, color: BAY_DARK },
      { s: -0.52, c: 0.05, a: 0.07, b: 0.055, color: POINTS },
    ], { axis: 'y', radial: 16, per: 4 });
    const lower = loft([
      { s: 0.03, c: 0.0, a: 0.055, b: 0.055, color: POINTS },
      { s: -0.08, c: 0.0, a: 0.04, b: 0.04, color: POINTS },
      { s: -0.38, c: 0.0, a: 0.037, b: 0.032, color: POINTS },
      { s: -0.47, c: 0.008, a: 0.052, b: 0.045, color: POINTS },
      { s: -0.54, c: -0.01, a: 0.04, b: 0.038, color: POINTS },
      { s: -0.6, c: -0.02, a: 0.048, b: 0.046, color: HOOF },
      { s: -0.68, c: -0.03, a: 0.065, b: 0.058, color: HOOF },
    ], { axis: 'y', radial: 14, per: 4, capEnd: true });
    this.legs = legDefs.map(d => {
      const upper = new THREE.Group();
      upper.position.set(d.x, -0.1, d.z);
      this.body.add(upper);
      add(d.front ? upperFront : upperHind, coat, upper);
      const lowerG = new THREE.Group();
      lowerG.position.y = -0.52;
      upper.add(lowerG);
      add(lower, coat, lowerG);
      return { ...d, upper, lower: lowerG, lastQ: 0 };
    });

    // 和鞍・障泥（あおり）・鐙
    const saddle = add(loft([
      { s: -0.22, c: 0.0, a: 0.05, b: 0.2 },
      { s: 0.0, c: -0.02, a: 0.05, b: 0.26 },
      { s: 0.25, c: 0.0, a: 0.05, b: 0.24 },
    ], { axis: 'x', radial: 18, per: 3 }), lacq);
    saddle.position.set(0.06, 0.4, 0);
    for (const [x, h] of [[0.29, 0.17], [-0.14, 0.2]]) {
      const arch = add(new THREE.TorusGeometry(0.2, 0.035, 8, 20, Math.PI), lacq);
      arch.position.set(x, 0.38, 0);
      arch.rotation.y = Math.PI / 2;
      arch.scale.set(1.25, h / 0.2, 1);
      const rim = add(new THREE.TorusGeometry(0.2, 0.01, 6, 20, Math.PI), gold);
      rim.position.set(x + (x > 0 ? 0.035 : -0.035), 0.38, 0);
      rim.rotation.y = Math.PI / 2;
      rim.scale.set(1.25, h / 0.2, 1);
    }
    for (const sd of [-1, 1]) {
      const aori = add(new THREE.BoxGeometry(0.66, 0.56, 0.02), fur);
      aori.position.set(0.06, 0.06, sd * 0.34);
      aori.rotation.x = sd * -0.2;
      const abumi = add(loft([
        { s: -0.05, c: 0, a: 0.05, b: 0.06 }, { s: 0.15, c: 0.01, a: 0.04, b: 0.07 }, { s: 0.26, c: 0.03, a: 0.03, b: 0.06 },
      ], { axis: 'x', radial: 12, per: 3 }), lacq);
      abumi.position.set(0.12, -0.5, sd * 0.4);
      const strap = add(new THREE.BoxGeometry(0.03, 0.8, 0.012), dark);
      strap.position.set(0.12, -0.1, sd * 0.37);
      strap.rotation.x = sd * -0.1;
    }
    // 胸繋・鞦（赤い紐と厚総）
    const chest = add(new THREE.TorusGeometry(1, 0.022 / 0.3, 6, 32, Math.PI), red);
    chest.position.set(0.74, 0.0, 0);
    chest.rotation.y = Math.PI / 2;
    chest.rotation.z = Math.PI;
    chest.scale.set(0.24, 0.3, 0.3);
    const rump = add(new THREE.TorusGeometry(1, 0.022 / 0.4, 6, 32, Math.PI), red);
    rump.position.set(-0.64, 0.04, 0);
    rump.rotation.y = Math.PI / 2;
    rump.scale.set(0.33, 0.41, 0.4);
    this.tassels = [];
    for (let i = 0; i < 9; i++) {
      const a = 0.25 + (i / 8) * (Math.PI - 0.5);
      const t = add(new THREE.CylinderGeometry(0.03, 0.065, 0.34, 10), red);
      t.geometry.translate(0, -0.17, 0);
      t.position.set(-0.66, 0.04 + Math.sin(a) * 0.4 - 0.05, Math.cos(a) * 0.35);
      this.tassels.push(t);
    }
    for (let i = 0; i < 5; i++) {
      const a = 0.3 + (i / 4) * (Math.PI - 0.6);
      const t = add(new THREE.CylinderGeometry(0.025, 0.05, 0.26, 10), red);
      t.geometry.translate(0, -0.13, 0);
      t.position.set(0.77, -Math.sin(a) * 0.28 + 0.02, Math.cos(a) * 0.24);
      this.tassels.push(t);
    }

    this.phase = 0;
    this.amp = 0;
    this.bob = 0;
    this.saddleAnchor = new THREE.Group();
    this.saddleAnchor.position.set(0.06, 0.46, 0);
    this.body.add(this.saddleAnchor);
  }

  // 速度に応じた歩様。着地イベント（蹄音用）を返す
  update(dt, speed, t) {
    const events = [];
    const strideLen = 2.2 + 0.32 * speed;
    const freq = speed > 0.3 ? speed / strideLen : 0;
    this.phase = (this.phase + freq * dt) % 1;
    const targetAmp = THREE.MathUtils.clamp(speed / 7, 0, 1);
    this.amp += (targetAmp - this.amp) * Math.min(1, dt * 3);
    const a = this.amp;
    const p = this.phase;
    const D = 0.36; // 接地時間の割合
    for (const L of this.legs) {
      const q = (p - L.off + 1) % 1;
      if (freq > 0 && q < L.lastQ) events.push(L);
      L.lastQ = q;
      let ua, la;
      const A = L.front ? 0.55 : 0.5;
      if (q < D) {
        const s = q / D;
        ua = THREE.MathUtils.lerp(A, -A, s);
        la = L.front ? 0.15 * Math.sin(s * Math.PI) : -0.2 * Math.sin(s * Math.PI);
      } else {
        const s = (q - D) / (1 - D);
        const e = 0.5 - 0.5 * Math.cos(s * Math.PI);
        ua = THREE.MathUtils.lerp(-A, A * 1.05, e);
        la = -(L.front ? 1.7 : 1.15) * Math.sin(s * Math.PI);
      }
      // 静止時は軽く体重移動
      const idle = Math.sin(t * 0.8 + L.off * 9) * 0.02;
      L.upper.rotation.z = ua * a + idle * (1 - a);
      L.lower.rotation.z = la * a;
    }
    const w = TAU * p;
    this.bob = (Math.sin(w - 1.2) * 0.075 - 0.06) * a;
    this.body.position.y = this.baseY + this.bob + Math.sin(t * 1.3) * 0.004 * (1 - a);
    this.body.rotation.z = Math.sin(w + 0.6) * 0.07 * a;
    this.body.rotation.x = Math.sin(w * 0.5) * 0.015 * a;
    this.neck.rotation.z = -0.78 - 0.1 * a + Math.sin(w + 2.2) * 0.13 * a + Math.sin(t * 0.5) * 0.03 * (1 - a);
    this.head.rotation.z = -1.75 + 0.2 * a + Math.sin(w + 2.6) * 0.08 * a;
    this.tail.rotation.z = -0.3 - 0.45 * a + Math.sin(w * 2) * 0.12 * a;
    this.tail.rotation.x = Math.sin(t * 2.1) * 0.15;
    for (let i = 0; i < this.tassels.length; i++) {
      this.tassels[i].rotation.z = 0.3 * a + Math.sin(w + i) * 0.25 * a;
    }
    return events;
  }
}

export class Rider {
  constructor(horse) {
    this.horse = horse;
    this.root = new THREE.Group();
    horse.saddleAnchor.add(this.root);
    const robe = new THREE.MeshStandardMaterial({ map: robeTexture('#2f4a3a', '#c9b37a'), roughness: 0.85 });
    const robe2 = new THREE.MeshStandardMaterial({ map: robeTexture('#e8e2d2', '#9a8a60'), roughness: 0.9 });
    const fur = new THREE.MeshStandardMaterial({ map: furTexture(), roughness: 0.95 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xd9a77c, roughness: 0.7 });
    const straw = new THREE.MeshStandardMaterial({ color: 0xb89256, roughness: 0.85 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x1a1412, roughness: 0.7 });
    const kote = new THREE.MeshStandardMaterial({ color: 0x8c2a2a, roughness: 0.6 });
    const glove = new THREE.MeshStandardMaterial({ color: 0x8a6a45, roughness: 0.8 });

    // 脚（行縢）
    this.legs = [];
    for (const s of [-1, 1]) {
      const thigh = unitLimb(0.09, 0.1, fur);
      const shin = unitLimb(0.07, 0.09, fur);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.07, 0.09), dark);
      this.root.add(thigh, shin, foot);
      this.legs.push({ s, thigh, shin, foot });
    }
    this.hips = new THREE.Group();
    this.root.add(this.hips);
    // 袴（腰回り）
    const hipMesh = new THREE.Mesh(loft([
      { s: -0.2, c: 0.0, a: 0.17, b: 0.24 },
      { s: -0.05, c: 0.0, a: 0.15, b: 0.22 },
      { s: 0.08, c: 0.0, a: 0.12, b: 0.18 },
    ], { axis: 'y', radial: 20, per: 3 }), robe2);
    hipMesh.castShadow = true;
    this.hips.add(hipMesh);

    this.torso = new THREE.Group();
    this.torso.position.y = 0.06;
    this.hips.add(this.torso);
    // 直垂の胴（胸板が厚く、肩が張った断面）
    const chest = new THREE.Mesh(loft([
      { s: 0.0, c: 0.0, a: 0.13, b: 0.19 },
      { s: 0.2, c: 0.01, a: 0.14, b: 0.2 },
      { s: 0.42, c: 0.02, a: 0.15, b: 0.23 },
      { s: 0.56, c: 0.0, a: 0.13, b: 0.26 },
      { s: 0.63, c: -0.01, a: 0.08, b: 0.16 },
      { s: 0.66, c: 0.0, a: 0.04, b: 0.06 },
    ], { axis: 'y', radial: 22, per: 4, nTop: 2.6, nBottom: 2.6 }), robe);
    chest.castShadow = true;
    this.torso.add(chest);
    const shoulders = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.025, 6, 18), robe2);
    shoulders.rotation.x = Math.PI / 2;
    shoulders.position.y = 0.62;
    this.torso.add(shoulders);
    // 大きな袖
    const sleeveMat = new THREE.MeshStandardMaterial({ map: robe.map, roughness: 0.85, side: THREE.DoubleSide });
    this.sleeves = [0, 1].map(() => {
      const g = new THREE.PlaneGeometry(1, 1, 4, 4);
      const pa = g.attributes.position;
      for (let i = 0; i < pa.count; i++) pa.setZ(i, Math.sin((pa.getX(i) + 0.5) * Math.PI) * 0.06 * (0.5 - pa.getY(i)));
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, sleeveMat);
      m.castShadow = true;
      this.torso.add(m);
      return m;
    });
    // 箙（えびら）と矢
    this.quiver = new THREE.Group();
    this.quiver.position.set(-0.22, 0.05, 0.2);
    this.quiver.rotation.z = 0.35;
    this.torso.add(this.quiver);
    const qBox = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.36, 0.14), dark);
    this.quiver.add(qBox);
    this.quiverArrows = [];
    for (let i = 0; i < 5; i++) {
      const a = makeArrow();
      a.rotation.x = -Math.PI / 2;
      a.position.set(0, -0.15, -0.04 + i * 0.022);
      a.rotation.z = (i - 2) * 0.04;
      a.scale.setScalar(0.9);
      this.quiver.add(a);
      this.quiverArrows.push(a);
    }

    this.headGroup = new THREE.Group();
    this.headGroup.position.y = 0.72;
    this.torso.add(this.headGroup);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.12, 8), skin);
    neck.position.y = -0.08;
    this.headGroup.add(neck);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), skin);
    head.scale.set(1, 1.12, 0.95);
    head.castShadow = true;
    this.headGroup.add(head);
    // 綾藺笠（あやいがさ）
    const hat = new THREE.Group();
    hat.position.y = 0.09;
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.33, 0.035, 28), straw);
    brim.castShadow = true;
    hat.add(brim);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.1, 18), straw);
    crown.position.y = 0.06;
    hat.add(crown);
    const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.12, 12), dark);
    knob.position.y = 0.14;
    hat.add(knob);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.012, 6, 28), dark);
    band.rotation.x = Math.PI / 2;
    hat.add(band);
    this.headGroup.add(hat);
    this.headVisible = [head, hat, neck, chest, shoulders];

    // 腕（両腕を毎フレーム張り直す）
    this.armL = { up: unitLimb(0.075, 0.085, robe), fo: unitLimb(0.045, 0.06, kote), hand: new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.06), glove) };
    this.armR = { up: unitLimb(0.075, 0.085, robe), fo: unitLimb(0.045, 0.06, robe2), hand: new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.08), glove) };
    for (const a of [this.armL, this.armR]) {
      this.torso.add(a.up, a.fo, a.hand);
      a.hand.castShadow = true;
    }
    this.armParts = [this.armL.up, this.armL.fo, this.armL.hand, this.armR.up, this.armR.fo, this.armR.hand, ...this.sleeves];

    // 三人称用の弓と矢（ワールド直下に配置）
    this.bow = new Bow();
    this.arrow = makeArrow();
    this.eye = new THREE.Vector3();
  }

  attachProps(scene) {
    scene.add(this.bow.group, this.arrow);
  }

  setFirstPerson(fp) {
    for (const m of this.headVisible) m.visible = !fp;
    for (const m of this.armParts) m.visible = !fp;
    this.bow.group.visible = !fp;
    this.arrowVisibleAllowed = !fp;
  }

  setQuiver(n) {
    this.quiverArrows.forEach((a, i) => (a.visible = i < n));
  }

  // aimDir: ワールド方向, draw/raise/nocked: 0..1
  update(aimYaw, aimPitch, aimDir, draw, raise, nocked) {
    // 立透かし：鐙に立ち、馬の上下動を膝で吸収する
    this.root.position.y = 0.36 - this.horse.bob * 0.75;
    this.root.rotation.z = -this.horse.body.rotation.z * 0.8;
    this.root.rotation.x = -this.horse.body.rotation.x;
    const torsoYaw = THREE.MathUtils.clamp(aimYaw * 0.7, -0.5, 1.25);
    this.torso.rotation.y = torsoYaw;
    this.torso.rotation.z = THREE.MathUtils.clamp(aimPitch * 0.3, -0.15, 0.15) + 0.05;
    this.headGroup.rotation.order = 'YZX';
    this.headGroup.rotation.y = THREE.MathUtils.clamp(aimYaw - torsoYaw, -1.2, 1.2);
    this.headGroup.rotation.z = aimPitch * 0.6;

    // 脚
    for (const L of this.legs) {
      const hip = _a.set(0, -0.05, L.s * 0.13);
      const knee = _b.set(0.17, -0.35 - this.horse.bob * 0.2, L.s * 0.33);
      const foot = new THREE.Vector3(0.12, -0.9 + 0.36 - 0.36, L.s * 0.42);
      foot.y = -0.9 - (this.root.position.y - 0.36);
      stretch(L.thigh, hip, knee);
      stretch(L.shin, knee, foot);
      L.foot.position.copy(foot).add(new THREE.Vector3(0.05, -0.02, 0));
    }

    // ワールドでの手の位置を求めてから胴体ローカルへ
    this.root.updateWorldMatrix(true, true);
    this.headGroup.getWorldPosition(this.eye);
    this.eye.addScaledVector(aimDir, 0.06);
    const shoulderL = new THREE.Vector3(0, 0.56, -0.22).applyMatrix4(this.torso.matrixWorld);
    const lowered = 1 - raise;
    const hl = shoulderL.clone().addScaledVector(aimDir, 0.66 - lowered * 0.25);
    hl.y -= 0.12 + lowered * 0.3;
    const hr = hl.clone().addScaledVector(aimDir, -(BOW.brace + 0.06 + BOW.drawLen * draw));
    hr.y += 0.06;
    if (nocked < 1) hr.lerp(new THREE.Vector3(-0.2, 0.15, 0.3).applyMatrix4(this.torso.matrixWorld), 1 - nocked);

    // 弓
    const bg = this.bow.group;
    bg.position.copy(hl);
    const zAxis = _a.copy(aimDir).negate();
    const yAxis = _b.copy(up).addScaledVector(zAxis, -up.dot(zAxis)).normalize();
    yAxis.applyAxisAngle(zAxis, -0.12 - lowered * 0.4);
    const xAxis = _c.crossVectors(yAxis, zAxis);
    _m.makeBasis(xAxis, yAxis, zAxis);
    bg.quaternion.setFromRotationMatrix(_m);
    this.bow.setDraw(draw);
    const nockW = this.bow.nock.clone().applyMatrix4(bg.updateMatrixWorld() || bg.matrixWorld);
    this.arrow.visible = !!this.arrowVisibleAllowed && nocked > 0.5;
    this.arrow.position.copy(nocked > 0.99 ? nockW : hr);
    this.arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), aimDir);

    const inv = new THREE.Matrix4().copy(this.torso.matrixWorld).invert();
    const setArm = (arm, shoulderLocal, handWorld, out, sleeve) => {
      const hand = handWorld.clone().applyMatrix4(inv);
      const sh = shoulderLocal;
      const mid = sh.clone().lerp(hand, 0.5);
      mid.z += out * 0.12;
      mid.y -= 0.08;
      stretch(arm.up, sh, mid);
      stretch(arm.fo, mid, hand);
      arm.hand.position.copy(hand);
      // 袖は上腕から下へ垂れる
      const ax = mid.clone().sub(sh).normalize();
      const dn = new THREE.Vector3(0, -1, 0).addScaledVector(ax, ax.y).normalize();
      const zz = new THREE.Vector3().crossVectors(ax, dn.clone().negate()).normalize();
      sleeve.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(ax, dn.clone().negate(), zz));
      sleeve.position.copy(sh).lerp(mid, 0.6).addScaledVector(dn, 0.15);
      sleeve.scale.set(0.34, 0.32, 1);
    };
    setArm(this.armL, new THREE.Vector3(0, 0.56, -0.22), hl, -1, this.sleeves[0]);
    setArm(this.armR, new THREE.Vector3(0, 0.56, 0.22), hr, 1, this.sleeves[1]);
  }
}
