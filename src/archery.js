// 弓（和弓）・鏑矢・一人称ビューモデル・矢の物理
import * as THREE from 'three';

export const BOW = {
  upper: 1.42,     // 握りから上の長さ（和弓は握りが下寄りの非対称）
  lower: 0.79,
  brace: 0.16,     // 弦の張り（握りから弦までの距離）
  drawLen: 0.70,   // 最大引き尺
  arrowLen: 0.98,
};

export const ARROW_PHYS = {
  g: 9.81,
  drag: 0.0042,    // 鏑（かぶら）付きの矢は空気抵抗が大きい
  minSpeed: 20,
  maxSpeed: 50,
};

const lacquer = new THREE.MeshStandardMaterial({ color: 0x24150e, roughness: 0.35, metalness: 0.05 });
const rattan = new THREE.MeshStandardMaterial({ color: 0x0e0b0a, roughness: 0.5 });
const gripMat = new THREE.MeshStandardMaterial({ color: 0x7a2418, roughness: 0.8 });
const stringMeshMat = new THREE.MeshStandardMaterial({ color: 0xf1e9d2, roughness: 0.6 });
const _sd = new THREE.Vector3();
const _yUp = new THREE.Vector3(0, 1, 0);
const shaftMat = new THREE.MeshStandardMaterial({ color: 0xc8b07a, roughness: 0.5 });
const kaburaMat = new THREE.MeshStandardMaterial({ color: 0x8c5a32, roughness: 0.55 });
const gloveMat = new THREE.MeshStandardMaterial({ color: 0x8a6a45, roughness: 0.8 });

function featherTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 16;
  const g = c.getContext('2d');
  g.fillStyle = '#efeae0';
  g.fillRect(0, 0, 64, 16);
  g.fillStyle = '#2a2520';
  for (let i = 0; i < 4; i++) g.fillRect(4 + i * 16, 0, 7, 16);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const featherMat = new THREE.MeshStandardMaterial({ map: featherTexture(), side: THREE.DoubleSide, roughness: 0.9, transparent: true, alphaTest: 0.1 });

// 弓の形状：y軸に沿い、握りが原点、射手側が +Z
function bowCurve(draw) {
  const pts = [];
  const bend = 0.12 + 0.28 * draw;
  const shrink = 1 - 0.05 * draw;
  const N = 28;
  for (let i = 0; i <= N; i++) {
    const s = -BOW.lower + (i / N) * (BOW.upper + BOW.lower);
    const L = s >= 0 ? BOW.upper : BOW.lower;
    const u = Math.abs(s) / L;
    let z = bend * Math.pow(u, 1.8);
    // 末弭・本弭付近の反り
    const rc = THREE.MathUtils.smoothstep(u, 0.82, 1.0);
    z -= rc * rc * 0.07;
    pts.push(new THREE.Vector3(0, s * shrink, z));
  }
  return new THREE.CatmullRomCurve3(pts);
}

export class Bow {
  constructor() {
    this.group = new THREE.Group();
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), lacquer);
    this.mesh.castShadow = true;
    this.group.add(this.mesh);
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.16, 10), gripMat);
    grip.position.y = 0.02;
    this.group.add(grip);
    // 籐巻き
    this.wraps = [];
    for (const s of [-0.5, -0.32, 0.3, 0.6, 0.95, 1.2]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.0145, 0.0145, 0.03, 8), rattan);
      w.userData.s = s;
      this.group.add(w);
      this.wraps.push(w);
    }
    // 弦（細い円柱2本：末弭→筈→本弭）
    this.strings = [0, 1].map(() => {
      const g = new THREE.CylinderGeometry(1, 1, 1, 5);
      g.translate(0, 0.5, 0);
      const m = new THREE.Mesh(g, stringMeshMat);
      m.castShadow = true;
      this.group.add(m);
      return m;
    });
    this.stringRadius = 0.0018;
    this.lastDraw = -1;
    this.top = new THREE.Vector3();
    this.bottom = new THREE.Vector3();
    this.nock = new THREE.Vector3();
    this.setDraw(0);
  }

  setDraw(draw) {
    if (Math.abs(draw - this.lastDraw) > 0.015) {
      this.lastDraw = draw;
      const curve = bowCurve(draw);
      this.mesh.geometry.dispose();
      this.mesh.geometry = new THREE.TubeGeometry(curve, 48, 0.012, 6, false);
      this.top.copy(curve.getPoint(1));
      this.bottom.copy(curve.getPoint(0));
      for (const w of this.wraps) {
        const s = w.userData.s;
        const t = (s + BOW.lower) / (BOW.upper + BOW.lower);
        w.position.copy(curve.getPoint(t));
      }
    }
    this.nock.set(0, 0.06, BOW.brace + 0.02 + BOW.drawLen * draw);
    this.setString(this.nock);
  }

  setString(n) {
    const r = this.stringRadius;
    for (const [m, a] of [[this.strings[0], this.top], [this.strings[1], this.bottom]]) {
      _sd.subVectors(n, a);
      const len = _sd.length();
      m.position.copy(a);
      m.quaternion.setFromUnitVectors(_yUp, _sd.normalize());
      m.scale.set(r, len, r);
    }
  }
}

// 鏑矢：筈（はず）が原点、-Z 方向に向く
export function makeArrow() {
  const g = new THREE.Group();
  const L = BOW.arrowLen;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, L, 6), shaftMat);
  shaft.rotation.x = Math.PI / 2;
  shaft.position.z = -L / 2;
  g.add(shaft);
  const kabura = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 10), kaburaMat);
  kabura.scale.set(0.02, 0.02, 0.038);
  kabura.position.z = -L + 0.03;
  g.add(kabura);
  // 鏑の穴
  const holeMat = new THREE.MeshBasicMaterial({ color: 0x120a05 });
  for (let i = 0; i < 4; i++) {
    const h = new THREE.Mesh(new THREE.CircleGeometry(0.005, 8), holeMat);
    const a = (i / 4) * Math.PI * 2;
    h.position.set(Math.cos(a) * 0.0202, Math.sin(a) * 0.0202, -L + 0.03);
    h.lookAt(h.position.x * 2, h.position.y * 2, -L + 0.03);
    g.add(h);
  }
  const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.009, 0.03, 8), kaburaMat);
  tip.rotation.x = Math.PI / 2;
  tip.position.z = -L - 0.005;
  g.add(tip);
  for (let i = 0; i < 3; i++) {
    const f = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.024), featherMat);
    const holder = new THREE.Group();
    holder.rotation.z = (i / 3) * Math.PI * 2;
    f.rotation.y = Math.PI / 2;
    f.position.set(0, 0.014, -0.09);
    holder.add(f);
    g.add(holder);
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

const _d = new THREE.Vector3();
const _negZ = new THREE.Vector3(0, 0, -1);
const _up = new THREE.Vector3(0, 1, 0);

// 一人称視点で見える弓・矢・両腕
// 射法：構え(u=0) → 打起し(u=1) → 引分け → 会(u=2) → 離れ・弓返り → 残心 → 構えへ戻る
const KEYS = [
  // u, 握り位置(カメラ空間), 弓の回転(x,y,z), 筈の引き量(0..1)
  { u: 0, g: [-0.2, -0.3, -0.52], r: [-0.4, 0.3, 0.55], d: 0.02 },
  { u: 1, g: [-0.08, 0.1, -0.72], r: [0.28, 0.05, -0.04], d: 0.06 },
  { u: 1.5, g: [-0.078, -0.03, -0.71], r: [0.1, 0.0, -0.08], d: 0.55 },
  { u: 2, g: [-0.075, -0.12, -0.7], r: [0.0, 0.0, -0.1], d: 1.0 },
];
const ELBOW_L = [[-0.36, -0.62, -0.18], [-0.42, -0.1, -0.36], [-0.42, -0.22, -0.3], [-0.42, -0.26, -0.22]];
const ELBOW_R = [[0.3, -0.5, 0.0], [0.34, 0.12, -0.08], [0.42, 0.0, 0.02], [0.44, -0.06, 0.2]];
const ease = t => t * t * (3 - 2 * t);
function poseAt(u, out) {
  u = THREE.MathUtils.clamp(u, 0, 2);
  let i = 0;
  while (i < KEYS.length - 2 && u > KEYS[i + 1].u) i++;
  const A = KEYS[i], B = KEYS[i + 1];
  const t = ease((u - A.u) / (B.u - A.u));
  for (let k = 0; k < 3; k++) {
    out.g[k] = A.g[k] + (B.g[k] - A.g[k]) * t;
    out.r[k] = A.r[k] + (B.r[k] - A.r[k]) * t;
    out.el[k] = ELBOW_L[i][k] + (ELBOW_L[i + 1][k] - ELBOW_L[i][k]) * t;
    out.er[k] = ELBOW_R[i][k] + (ELBOW_R[i + 1][k] - ELBOW_R[i][k]) * t;
  }
  out.d = A.d + (B.d - A.d) * t;
  return out;
}
const skinMat = new THREE.MeshStandardMaterial({ color: 0xd9a77c, roughness: 0.65 });
const yugakeMat = new THREE.MeshStandardMaterial({ color: 0x9a7048, roughness: 0.85 });

function limb(r1, r2, mat) {
  const g = new THREE.CylinderGeometry(r2, r1, 1, 12);
  g.translate(0, 0.5, 0);
  return new THREE.Mesh(g, mat);
}
function setLimb(m, a, b) {
  _d.subVectors(b, a);
  const len = _d.length();
  m.position.copy(a);
  m.quaternion.setFromUnitVectors(_up, _d.normalize());
  m.scale.set(1, len, 1);
}

export class ViewModel {
  constructor(camera) {
    this.root = new THREE.Group();
    camera.add(this.root);
    this.bow = new Bow();
    this.bow.stringRadius = 0.0016;
    this.bow.mesh.castShadow = false;
    this.root.add(this.bow.group);
    // 矢は弓の右側（握りの上）に添う。弓の座標系に置く
    this.arrow = makeArrow();
    this.bow.group.add(this.arrow);
    // 弓手（左手）：握りを包む
    const lh = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), skinMat);
    lh.scale.set(0.035, 0.055, 0.04);
    lh.position.set(-0.01, 0.01, 0.005);
    this.bow.group.add(lh);
    const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.011, 0.035, 4, 8), skinMat);
    thumb.position.set(0.018, 0.05, -0.012);
    thumb.rotation.z = -0.5;
    this.bow.group.add(thumb);
    // 射籠手（左腕）・右腕
    const koteMat = new THREE.MeshStandardMaterial({ map: koteTexture(), roughness: 0.75 });
    this.armL = limb(0.026, 0.021, koteMat);
    this.armR = limb(0.028, 0.022, new THREE.MeshStandardMaterial({ color: 0xd8d2c4, roughness: 0.9 }));
    this.lastHand = new THREE.Vector3(0.05, -0.08, 0.1);
    this.root.add(this.armL, this.armR);
    // 弽（ゆがけ）：右手の鹿革の手袋
    this.rightHand = new THREE.Group();
    const palm = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), yugakeMat);
    palm.scale.set(0.04, 0.05, 0.055);
    this.rightHand.add(palm);
    const yThumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.013, 0.05, 4, 8), yugakeMat);
    yThumb.rotation.x = Math.PI / 2;
    yThumb.position.set(-0.03, 0.01, -0.03);
    this.rightHand.add(yThumb);
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.042, 0.06, 12), new THREE.MeshStandardMaterial({ color: 0x5a3a26, roughness: 0.8 }));
    cuff.rotation.x = Math.PI / 2;
    cuff.position.z = 0.05;
    this.rightHand.add(cuff);
    this.root.add(this.rightHand);
    this.pose = { g: [0, 0, 0], r: [0, 0, 0], el: [0, 0, 0], er: [0, 0, 0], d: 0 };
    this.relPose = { g: [0, 0, 0], r: [0, 0, 0], el: [0, 0, 0], er: [0, 0, 0], d: 0 };
    this.restPose = poseAt(0, { g: [0, 0, 0], r: [0, 0, 0], el: [0, 0, 0], er: [0, 0, 0], d: 0 });
    this.releaseU = 2;
    this.nockLocal = new THREE.Vector3();
    this.tmp = new THREE.Vector3();
    this.root.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; } });
  }

  // u: 0..2 射法の進行, nocked: 0..1 矢をつがえる進行, releaseT: 離れからの経過秒
  update(u, nocked, tremble, releaseT, arrowsLeft) {
    const P = this.pose;
    let yugaeri = 0, handFly = 0;
    if (releaseT < 1.1) {
      // 離れ：弦が戻り、弓が手の内で回り（弓返り）、右手は後ろへ抜ける。残心ののち構えへ戻る
      poseAt(this.releaseU, this.relPose);
      const back = ease(THREE.MathUtils.clamp((releaseT - 0.55) / 0.5, 0, 1));
      const k = 1 - back;
      for (let i = 0; i < 3; i++) {
        P.g[i] = this.relPose.g[i] + (this.restPose.g[i] - this.relPose.g[i]) * back;
        P.r[i] = this.relPose.r[i] + (this.restPose.r[i] - this.relPose.r[i]) * back;
        P.el[i] = this.relPose.el[i] + (this.restPose.el[i] - this.relPose.el[i]) * back;
        P.er[i] = this.relPose.er[i] + (this.restPose.er[i] - this.relPose.er[i]) * back;
      }
      const snap = Math.min(1, releaseT / 0.09);
      P.d = 0;
      // 反動で弓が前へ押し出され、わずかに沈む
      P.g[0] -= 0.02 * k * snap; P.g[1] -= 0.025 * k * snap; P.g[2] -= 0.03 * k * snap;
      yugaeri = -2.75 * (1 - Math.pow(1 - Math.min(1, releaseT / 0.16), 3)) * k;
      handFly = (1 - Math.pow(1 - Math.min(1, releaseT / 0.12), 2)) * k;
    } else {
      poseAt(u, P);
      this.releaseU = Math.max(1, u);
    }
    const bg = this.bow.group;
    bg.position.set(P.g[0] + tremble.x, P.g[1] + tremble.y, P.g[2]);
    bg.rotation.set(P.r[0], P.r[1], P.r[2]);
    bg.rotateY(yugaeri);
    const drawAmt = THREE.MathUtils.clamp(P.d, 0, 1);
    this.bow.setDraw(drawAmt);
    // 筈の位置（弓の座標系）。つがえ中は手前下から差し込む
    const n = this.nockLocal.copy(this.bow.nock);
    const showArrow = nocked > 0.01 && releaseT >= 1.1 && arrowsLeft > 0;
    this.arrow.visible = showArrow;
    const inn = 1 - nocked;
    this.arrow.position.set(0.014 + inn * 0.12, n.y + 0.005 - inn * 0.25, n.z + inn * 0.25);
    this.arrow.rotation.set(-inn * 0.6, inn * 0.3, 0);
    if (releaseT < 0.09) this.bow.setString(n.set(0, 0.06, BOW.brace + 0.02 + BOW.drawLen * (1 - releaseT / 0.09) * 0.3));
    bg.updateMatrix();
    // 右手：筈を持つ（離れの瞬間は後方右へ抜ける）
    const hand = this.tmp;
    if (releaseT < 1.1) {
      // 離れ：筈を放した位置から右後方へ抜け、残心ののち構えの位置へ戻る
      const back = ease(THREE.MathUtils.clamp((releaseT - 0.55) / 0.5, 0, 1));
      const restHand = this.arrow.position.clone().applyMatrix4(bg.matrix);
      hand.copy(this.lastHand);
      hand.x += handFly * 0.22; hand.y += handFly * 0.05; hand.z += handFly * 0.25;
      hand.lerp(restHand, back);
    } else {
      hand.copy(this.arrow.position).applyMatrix4(bg.matrix);
      hand.x += 0.035; hand.y -= 0.01; hand.z += 0.02;
      this.lastHand.copy(hand);
    }
    this.rightHand.position.copy(hand);
    this.rightHand.quaternion.copy(bg.quaternion);
    const grip = new THREE.Vector3(-0.01, 0.0, 0.01).applyMatrix4(bg.matrix);
    setLimb(this.armL, new THREE.Vector3(...P.el), grip);
    setLimb(this.armR, new THREE.Vector3(...P.er).add(new THREE.Vector3(handFly * 0.2, 0, handFly * 0.2)), hand.clone().add(new THREE.Vector3(0, 0, 0.06)));
  }

  set visible(v) {
    this.root.visible = v;
  }
}

function koteTexture() {
  // 射籠手の錦（金茶の地に紺の文様）
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#6b3a2a';
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = '#d2a64a';
  g.lineWidth = 3;
  for (let y = 0; y < 128; y += 32) for (let x = 0; x < 128; x += 32) {
    g.beginPath(); g.arc(x + 16 + ((y / 32) % 2) * 16, y + 16, 9, 0, Math.PI * 2); g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 3);
  return t;
}

// 飛翔中の矢
export class FlyingArrow {
  constructor(scene, tip, vel) {
    this.mesh = makeArrow();
    scene.add(this.mesh);
    this.tip = tip.clone();
    this.vel = vel.clone();
    this.dir = vel.clone().normalize();
    this.alive = true;     // 飛翔中
    this.stuck = false;
    this.age = 0;
    this.spin = 0;
    this.hitTarget = null;
    this.angVel = new THREE.Vector3();
    this.place();
  }

  place() {
    this.mesh.position.copy(this.tip).addScaledVector(this.dir, -BOW.arrowLen);
    // 筈から先端へ -Z が向くように
    this.mesh.lookAt(this.mesh.position.clone().sub(this.dir));
    this.mesh.rotateZ(this.spin);
  }
}

const _rel = new THREE.Vector3();
// 1ステップ積分（重力・空気抵抗・風）
export function integrateArrow(pos, vel, wind, dt) {
  _rel.copy(vel).sub(wind);
  const sp = _rel.length();
  vel.addScaledVector(_rel, -ARROW_PHYS.drag * sp * dt);
  vel.y -= ARROW_PHYS.g * dt;
  pos.addScaledVector(vel, dt);
}

// 線分と的板の交差判定。板は +Z 向き
export function segmentHitsBoard(p0, p1, target, size) {
  const zf = target.pos.z + 0.01;
  if (!((p0.z > zf && p1.z <= zf) || (p0.z < zf && p1.z >= zf))) return null;
  const t = (zf - p0.z) / (p1.z - p0.z);
  const x = p0.x + (p1.x - p0.x) * t;
  const y = p0.y + (p1.y - p0.y) * t;
  const dx = x - target.pos.x, dy = y - target.pos.y;
  if (Math.abs(dx) > size / 2 || Math.abs(dy) > size / 2) return null;
  return { t, point: new THREE.Vector3(x, y, zf), dx, dy, r: Math.hypot(dx, dy) };
}

// 板が割れて飛ぶ木片
export function shatterBoard(scene, target, hit, arrowVel, size) {
  const pieces = [];
  const n = 5;
  const w = size / n;
  const faceMat = target.boardMats[4];
  const edgeMat = target.boardMats[0];
  for (let i = 0; i < n; i++) {
    // 縦方向に割れる（板目に沿って）
    const geo = new THREE.BoxGeometry(w * 0.96, size * (0.75 + Math.random() * 0.25), 0.018);
    const uv = geo.attributes.uv;
    for (let j = 0; j < uv.count; j++) {
      uv.setX(j, (i + uv.getX(j)) / n);
    }
    const m = new THREE.Mesh(geo, [edgeMat, edgeMat, edgeMat, edgeMat, faceMat, edgeMat]);
    m.castShadow = true;
    m.position.set(target.pos.x - size / 2 + w * (i + 0.5), target.pos.y, target.pos.z);
    scene.add(m);
    const side = (m.position.x - hit.point.x) / (size / 2);
    const v = new THREE.Vector3(arrowVel.x * 0.12 + side * 2.5 + (Math.random() - 0.5) * 1.5,
      1.5 + Math.random() * 3,
      arrowVel.z * 0.18 - Math.random() * 1.5);
    pieces.push({
      mesh: m, vel: v,
      ang: new THREE.Vector3((Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20),
      rest: false,
    });
  }
  return pieces;
}

export function updatePieces(pieces, dt) {
  for (const p of pieces) {
    if (p.rest) continue;
    p.vel.y -= 9.81 * dt;
    p.mesh.position.addScaledVector(p.vel, dt);
    p.mesh.rotation.x += p.ang.x * dt;
    p.mesh.rotation.y += p.ang.y * dt;
    p.mesh.rotation.z += p.ang.z * dt;
    if (p.mesh.position.y < 0.03) {
      p.mesh.position.y = 0.03;
      if (Math.abs(p.vel.y) < 1.2) {
        p.rest = true;
        p.mesh.rotation.x = -Math.PI / 2;
        p.mesh.rotation.y = 0;
      } else {
        p.vel.y *= -0.3;
        p.vel.x *= 0.5;
        p.vel.z *= 0.5;
        p.ang.multiplyScalar(0.5);
      }
    }
  }
}
