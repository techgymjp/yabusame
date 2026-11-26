// 馬（襲歩の脚運び）と射手（狩装束・立透かし）
import * as THREE from 'three';
import { Bow, makeArrow, BOW } from './archery.js';
import { robeTexture, furTexture } from './textures.js';

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

export class Horse {
  constructor() {
    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.root.add(this.body);
    this.baseY = 1.38;
    this.body.position.y = this.baseY;
    const coat = new THREE.MeshStandardMaterial({ color: 0x5a3520, roughness: 0.5, metalness: 0.0 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x15100c, roughness: 0.8 });
    const hoof = new THREE.MeshStandardMaterial({ color: 0x2a2420, roughness: 0.6 });
    const red = new THREE.MeshStandardMaterial({ color: 0xa8161b, roughness: 0.75 });
    const lacq = new THREE.MeshStandardMaterial({ color: 0x120c0a, roughness: 0.25, metalness: 0.1 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xc9a043, roughness: 0.35, metalness: 0.8 });
    const fur = new THREE.MeshStandardMaterial({ map: furTexture(), roughness: 0.95 });
    this.mats = { coat };

    const sph = (r, mat, x, y, z, sx = 1, sy = 1, sz = 1) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), mat);
      m.position.set(x, y, z);
      m.scale.set(sx, sy, sz);
      m.castShadow = true;
      m.receiveShadow = true;
      this.body.add(m);
      return m;
    };
    sph(1, coat, 0, 0, 0, 1.0, 0.42, 0.36);
    sph(0.42, coat, 0.72, 0.06, 0, 1, 1, 0.86);
    sph(0.45, coat, -0.72, 0.1, 0, 1, 1, 0.9);

    // 首と頭
    this.neck = new THREE.Group();
    this.neck.position.set(0.92, 0.2, 0);
    this.neck.rotation.z = -0.72;
    this.body.add(this.neck);
    const neckMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.27, 0.95, 16), coat);
    neckMesh.position.y = 0.42;
    neckMesh.scale.z = 0.75;
    neckMesh.castShadow = true;
    this.neck.add(neckMesh);
    const mane = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.9, 0.05), dark);
    mane.position.set(-0.2, 0.45, 0);
    mane.rotation.z = -0.1;
    this.neck.add(mane);
    this.head = new THREE.Group();
    this.head.position.y = 0.88;
    this.head.rotation.z = -1.75;
    this.neck.add(this.head);
    const headMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.13, 0.6, 14), coat);
    headMesh.position.y = 0.28;
    headMesh.scale.z = 0.72;
    headMesh.castShadow = true;
    this.head.add(headMesh);
    const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), coat);
    jaw.position.set(0, 0.04, 0);
    jaw.scale.set(1.1, 1, 0.75);
    this.head.add(jaw);
    for (const s of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.13, 8), coat);
      ear.position.set(-0.08, -0.02, s * 0.06);
      ear.rotation.z = 1.9;
      this.head.add(ear);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), dark);
      eye.position.set(0.04, 0.1, s * 0.085);
      this.head.add(eye);
      // 面繋（おもがい）
      const strap = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.012, 6, 16), red);
      strap.position.y = 0.42;
      strap.rotation.x = Math.PI / 2;
      strap.scale.set(0.9, 0.7, 1);
      this.head.add(strap);
    }
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), coat);
    nose.position.y = 0.56;
    nose.scale.set(1, 0.8, 0.85);
    this.head.add(nose);

    // 尾
    this.tail = new THREE.Group();
    this.tail.position.set(-1.1, 0.25, 0);
    this.body.add(this.tail);
    const tailMesh = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.95, 10), dark);
    tailMesh.position.y = -0.45;
    tailMesh.rotation.z = Math.PI;
    tailMesh.castShadow = true;
    this.tail.add(tailMesh);

    // 脚：左後・右後・左前・右前（交叉襲歩の着地順）
    const legDefs = [
      { x: -0.72, z: -0.2, off: 0.0, front: false },
      { x: -0.72, z: 0.2, off: 0.11, front: false },
      { x: 0.7, z: -0.19, off: 0.42, front: true },
      { x: 0.7, z: 0.19, off: 0.53, front: true },
    ];
    this.legs = legDefs.map(d => {
      const upper = new THREE.Group();
      upper.position.set(d.x, -0.12, d.z);
      this.body.add(upper);
      const um = new THREE.Mesh(new THREE.CylinderGeometry(d.front ? 0.085 : 0.11, 0.06, 0.6, 10), coat);
      um.position.y = -0.3;
      um.castShadow = true;
      upper.add(um);
      const lower = new THREE.Group();
      lower.position.y = -0.6;
      upper.add(lower);
      const lm = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.6, 8), coat);
      lm.position.y = -0.3;
      lm.castShadow = true;
      lower.add(lm);
      const fetlock = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), coat);
      fetlock.position.y = -0.58;
      lower.add(fetlock);
      const h = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 0.08, 10), hoof);
      h.position.y = -0.64;
      h.castShadow = true;
      lower.add(h);
      return { ...d, upper, lower, lastQ: 0 };
    });

    // 鞍・障泥（あおり）・鐙
    const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.12, 0.5), lacq);
    saddle.position.set(0.08, 0.42, 0);
    saddle.castShadow = true;
    this.body.add(saddle);
    for (const x of [0.38, -0.22]) {
      const pommel = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.035, 8, 16, Math.PI), lacq);
      pommel.position.set(x, 0.42, 0);
      pommel.rotation.y = Math.PI / 2;
      this.body.add(pommel);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.012, 6, 16, Math.PI), gold);
      rim.position.set(x + (x > 0 ? 0.03 : -0.03), 0.42, 0);
      rim.rotation.y = Math.PI / 2;
      this.body.add(rim);
    }
    for (const s of [-1, 1]) {
      const aori = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.55, 0.025), fur);
      aori.position.set(0.05, 0.08, s * 0.39);
      aori.rotation.x = s * -0.18;
      aori.castShadow = true;
      this.body.add(aori);
      const abumi = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 0.12), lacq);
      abumi.position.set(0.18, -0.48, s * 0.42);
      this.body.add(abumi);
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.85, 0.02), dark);
      strap.position.set(0.12, -0.05, s * 0.41);
      this.body.add(strap);
    }
    // 胸繋・鞦（赤い紐と房）
    const chest = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.02, 6, 24, Math.PI), red);
    chest.position.set(0.82, 0.05, 0);
    chest.rotation.set(Math.PI / 2, 0, Math.PI / 2);
    chest.rotation.order = 'YXZ';
    chest.rotation.set(0, Math.PI / 2, 0);
    chest.scale.set(0.9, 1.0, 1);
    this.body.add(chest);
    const rump = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.022, 6, 28, Math.PI), red);
    rump.position.set(-0.75, 0.0, 0);
    rump.rotation.y = Math.PI / 2;
    rump.rotation.z = -0.3;
    this.body.add(rump);
    this.tassels = [];
    for (let i = 0; i < 7; i++) {
      const a = (i / 6) * Math.PI;
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.06, 0.32, 8), red);
      const px = -0.75 - Math.sin(-0.3) * 0;
      t.position.set(px - 0.18, Math.sin(a) * 0.4 - 0.12, Math.cos(a) * 0.48);
      t.castShadow = true;
      this.body.add(t);
      this.tassels.push(t);
    }
    for (let i = 0; i < 4; i++) {
      const a = (i / 3) * Math.PI;
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.25, 8), red);
      t.position.set(0.92, Math.sin(a) * 0.3 - 0.2, Math.cos(a) * 0.36);
      this.body.add(t);
      this.tassels.push(t);
    }

    this.phase = 0;
    this.amp = 0;
    this.bob = 0;
    this.saddleAnchor = new THREE.Group();
    this.saddleAnchor.position.set(0.06, 0.48, 0);
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
    this.neck.rotation.z = -0.72 - 0.12 * a + Math.sin(w + 2.2) * 0.13 * a + Math.sin(t * 0.5) * 0.03 * (1 - a);
    this.head.rotation.z = -1.75 + 0.2 * a + Math.sin(w + 2.6) * 0.08 * a;
    this.tail.rotation.z = -0.35 - 0.8 * a + Math.sin(w * 2) * 0.12 * a;
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
    const hipMesh = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), robe2);
    hipMesh.scale.set(1, 0.8, 1.15);
    hipMesh.castShadow = true;
    this.hips.add(hipMesh);

    this.torso = new THREE.Group();
    this.torso.position.y = 0.06;
    this.hips.add(this.torso);
    const chest = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.2, 0.55, 14), robe);
    chest.position.y = 0.3;
    chest.scale.z = 1.15;
    chest.castShadow = true;
    this.torso.add(chest);
    const shoulders = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 8, 0, TAU, 0, Math.PI / 2), robe);
    shoulders.position.y = 0.56;
    shoulders.scale.set(1, 0.4, 1.2);
    this.torso.add(shoulders);
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
    this.armParts = [this.armL.up, this.armL.fo, this.armL.hand, this.armR.up, this.armR.fo, this.armR.hand];

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
    const setArm = (arm, shoulderLocal, handWorld, out) => {
      const hand = handWorld.clone().applyMatrix4(inv);
      const sh = shoulderLocal;
      const mid = sh.clone().lerp(hand, 0.5);
      mid.z += out * 0.12;
      mid.y -= 0.08;
      stretch(arm.up, sh, mid);
      stretch(arm.fo, mid, hand);
      arm.hand.position.copy(hand);
    };
    setArm(this.armL, new THREE.Vector3(0, 0.56, -0.22), hl, -1);
    setArm(this.armR, new THREE.Vector3(0, 0.56, 0.22), hr, 1);
  }
}
