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
const stringMat = new THREE.LineBasicMaterial({ color: 0xe9e2cf });
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
    this.stringGeo = new THREE.BufferGeometry();
    this.stringGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3));
    this.string = new THREE.Line(this.stringGeo, stringMat);
    this.string.frustumCulled = false;
    this.group.add(this.string);
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
    const a = this.stringGeo.attributes.position;
    a.setXYZ(0, this.top.x, this.top.y, this.top.z);
    a.setXYZ(1, this.nock.x, this.nock.y, this.nock.z);
    a.setXYZ(2, this.bottom.x, this.bottom.y, this.bottom.z);
    a.needsUpdate = true;
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

// 一人称視点で見える弓・矢・手
export class ViewModel {
  constructor(camera) {
    this.root = new THREE.Group();
    camera.add(this.root);
    this.bow = new Bow();
    this.bow.mesh.castShadow = false;
    this.root.add(this.bow.group);
    this.arrow = makeArrow();
    this.root.add(this.arrow);
    const lh = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.09, 0.05), gloveMat);
    lh.position.set(-0.012, 0.0, 0.01);
    this.bow.group.add(lh);
    // 弓手の腕（射籠手）：握りから肩の方へ伸びる
    const koteMat = new THREE.MeshStandardMaterial({ color: 0x6e2a22, roughness: 0.7 });
    const armGeo = new THREE.CylinderGeometry(0.03, 0.045, 0.7, 10);
    armGeo.translate(0, 0.35, 0);
    this.forearm = new THREE.Mesh(armGeo, koteMat);
    this.root.add(this.forearm);
    this.rightHand = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.07, 0.08), gloveMat);
    this.root.add(this.rightHand);
    this.raise = 0;
    this.root.traverse(o => { if (o.isMesh) { o.castShadow = false; o.renderOrder = 1; } });
  }

  // draw: 0..1 引き具合, raise: 0..1 弓を構える度合い, nocked: 矢をつがえているか(0..1)
  update(draw, raise, nocked, tremble) {
    const lowered = 1 - raise;
    // 握りの位置（カメラ空間）
    const gx = -0.07 - lowered * 0.2 + tremble.x;
    const gy = -0.14 - lowered * 0.2 + tremble.y;
    const gz = -0.72 + lowered * 0.2;
    const bg = this.bow.group;
    bg.position.set(gx, gy, gz);
    bg.rotation.set(-lowered * 0.2, lowered * 0.3, -0.1 + lowered * 0.25);
    this.bow.setDraw(draw);
    // 筈（矢の後端）
    const nock = this.bow.nock.clone();
    bg.updateMatrix();
    nock.applyMatrix4(bg.matrix);
    this.arrow.visible = nocked > 0.01;
    this.arrow.position.copy(nock);
    this.arrow.position.x += 0.012; // 和弓は矢を弓の右側につがえる
    const tipTarget = new THREE.Vector3(gx + 0.02, gy + 0.075, gz - 0.2);
    _d.copy(tipTarget).sub(this.arrow.position).normalize();
    this.arrow.quaternion.setFromUnitVectors(_negZ, _d);
    // つがえ動作中は手前から差し込む
    this.arrow.position.z += (1 - nocked) * 0.35;
    this.arrow.position.y -= (1 - nocked) * 0.15;
    // 腕は握りから左肩（カメラ空間の左下手前）へ
    _d.set(-0.22, -0.3, 0.1).sub(bg.position).normalize();
    this.forearm.position.copy(bg.position).addScaledVector(_d, 0.03);
    this.forearm.quaternion.setFromUnitVectors(_up, _d);
    this.rightHand.position.copy(nock).add(new THREE.Vector3(0.03, -0.01, 0.03));
    this.rightHand.position.z += (1 - nocked) * 0.3;
    this.rightHand.visible = nocked > 0.95 && this.rightHand.position.z < 0.05;
  }

  set visible(v) {
    this.root.visible = v;
  }
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
