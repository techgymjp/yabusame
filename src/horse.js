// 馬（襲歩の脚運び）と射手（狩装束・立透かし）
import * as THREE from 'three';
import { Bow, makeArrow, BOW } from './archery.js';
import { robeTexture, furTexture, hairCardTexture } from './textures.js';
import { loft } from './loft.js';

const TAU = Math.PI * 2;
const ease = t => t * t * (3 - 2 * t);
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

export { Horse } from './horseModel.js';

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
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.245, 0.03, 28), straw);
    brim.castShadow = true;
    hat.add(brim);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.1, 18), straw);
    crown.position.y = 0.06;
    hat.add(crown);
    const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.12, 12), dark);
    knob.position.y = 0.14;
    hat.add(knob);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.01, 6, 28), dark);
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
    this.bow = new Bow(0.017);
    this.bow.stringRadius = 0.003;
    this.arrow = makeArrow();
    this.arrow.scale.set(1.6, 1.6, 1);
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
  update(aimYaw, aimPitch, aimDir, draw, raise, nocked, releaseT = 9) {
    // 立透かし：鐙に立ち、馬の上下動を膝で吸収する
    this.root.position.y = 0.36 - this.horse.bob * 0.75;
    this.root.rotation.z = -this.horse.body.rotation.z * 0.8;
    this.root.rotation.x = -this.horse.body.rotation.x;
    const rel = releaseT < 1.1;
    const zan = rel ? 1 - THREE.MathUtils.smoothstep(releaseT, 0.55, 1.05) : 0; // 残心
    // 構え具合 0..1（打起し以降は弓を的へ向け、体を横向きにする）
    const engage = rel ? zan : Math.min(1, raise * 1.2);
    // 胴造り：左肩を的へ向けた横向きの姿勢（胴の向き = 狙い - 90°）
    const sideOn = THREE.MathUtils.clamp(aimYaw - Math.PI / 2, -1.1, 0.9);
    const torsoYaw = THREE.MathUtils.lerp(THREE.MathUtils.clamp(aimYaw * 0.4, -0.3, 0.6), sideOn, engage);
    this.torso.rotation.y = torsoYaw;
    this.torso.rotation.z = 0.04;
    this.headGroup.rotation.order = 'YZX';
    this.headGroup.rotation.y = THREE.MathUtils.clamp(aimYaw - torsoYaw, -1.65, 1.65);
    this.headGroup.rotation.z = aimPitch * 0.6;

    // 脚
    for (const L of this.legs) {
      const hip = _a.set(0, -0.05, L.s * 0.13);
      const knee = _b.set(0.17, -0.35 - this.horse.bob * 0.2, L.s * 0.33);
      const foot = new THREE.Vector3(0.12, -0.9 - (this.root.position.y - 0.36), L.s * 0.42);
      stretch(L.thigh, hip, knee);
      stretch(L.shin, knee, foot);
      L.foot.position.copy(foot).add(new THREE.Vector3(0.05, -0.02, 0));
    }

    this.root.updateWorldMatrix(true, true);
    this.headGroup.getWorldPosition(this.eye);
    this.eye.addScaledVector(aimDir, 0.06);
    const T = this.torso.matrixWorld;
    const shL = new THREE.Vector3(0, 0.56, -0.2).applyMatrix4(T);
    const shR = new THREE.Vector3(0, 0.56, 0.2).applyMatrix4(T);
    const U = up;
    const R = new THREE.Vector3().crossVectors(aimDir, U).normalize(); // 的を向いた時の右（右頬側）
    const strLen = (d) => BOW.brace + 0.02 + BOW.drawLen * d;

    // 各段階の弓手（左手 hl）と筈（右手 hr）
    // 会：筈は右頬、弓手は矢の延長上で腕を伸ばす
    const nockF = this.eye.clone().addScaledVector(U, -0.085).addScaledVector(R, 0.035);
    const hlF = nockF.clone().addScaledVector(aimDir, strLen(1));
    // 打起し：弓を頭上へ掲げ、矢はほぼ水平
    const hlR = this.eye.clone().addScaledVector(U, 0.3).addScaledVector(aimDir, 0.42).addScaledVector(R, 0.04);
    // 構え：弓は左腰の前に立て、右手は筈に
    const hl0 = new THREE.Vector3(0.3, 0.12, -0.24).applyMatrix4(T);
    const hl = new THREE.Vector3(), hr = new THREE.Vector3();
    let dirA; // 弓手から筈への向き（射手側）
    if (rel) {
      // 離れ → 残心：弓手は残し、右手は右後方へ開く
      hl.copy(hlF).lerp(hl0, 1 - zan);
      const k = Math.min(1, releaseT / 0.1) * zan;
      hr.copy(nockF).addScaledVector(R, 0.2 * k).addScaledVector(aimDir, -0.22 * k).addScaledVector(U, -0.03 * k);
      hr.lerp(new THREE.Vector3(0.15, 0.1, 0.25).applyMatrix4(T), 1 - zan);
      dirA = aimDir.clone().negate();
    } else {
      const u = raise + draw;
      if (u <= 1) {
        hl.copy(hl0).lerp(hlR, ease(u));
      } else {
        hl.copy(hlR).lerp(hlF, ease(u - 1));
      }
      // 筈は弓手から射手側へ「弦の位置 + 引き尺」だけ離れる
      const target = u <= 1 ? hl.clone().addScaledVector(aimDir, -1).lerp(hl.clone().addScaledVector(U, -1), 1 - u)
        : this.eye.clone().addScaledVector(U, THREE.MathUtils.lerp(0.25, -0.085, ease(u - 1))).addScaledVector(R, 0.035);
      dirA = target.sub(hl).normalize();
      hr.copy(hl).addScaledVector(dirA, strLen(draw));
      if (nocked < 1) hr.lerp(new THREE.Vector3(-0.15, 0.1, 0.28).applyMatrix4(T), 1 - nocked); // 箙から矢を取る
    }

    // 弓：握り = 弓手。射手側(+Z) = dirA
    const bg = this.bow.group;
    bg.position.copy(hl);
    const zAxis = _a.copy(dirA);
    const yAxis = _b.copy(U).addScaledVector(zAxis, -U.dot(zAxis)).normalize();
    yAxis.applyAxisAngle(zAxis, -0.1);
    const xAxis = _c.crossVectors(yAxis, zAxis);
    _m.makeBasis(xAxis, yAxis, zAxis);
    bg.quaternion.setFromRotationMatrix(_m);
    if (rel) bg.rotateY(-2.75 * (1 - Math.pow(1 - Math.min(1, releaseT / 0.16), 3)) * zan); // 弓返り
    this.bow.setDraw(rel ? 0 : draw);
    this.arrow.visible = !!this.arrowVisibleAllowed && nocked > 0.5 && !rel;
    this.arrow.position.copy(hr);
    this.arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), dirA.clone().negate());

    // 腕：二関節の逆運動学（右肘は後ろへ張り、左肘はやや下外へ）
    const inv = new THREE.Matrix4().copy(T).invert();
    const poleR = shR.clone().addScaledVector(aimDir, -1).addScaledVector(U, 0.1 + 0.08 * engage).addScaledVector(R, -0.05);
    const poleL = shL.clone().addScaledVector(U, -1).addScaledVector(R, -0.4);
    this.solveArm(this.armL, shL, hl, poleL, inv, this.sleeves[0]);
    this.solveArm(this.armR, shR, hr.clone().addScaledVector(R, 0.02), poleR, inv, this.sleeves[1]);
  }

  solveArm(arm, S, Hd, pole, inv, sleeve) {
    const L1 = 0.31, L2 = 0.31;
    const d0 = S.distanceTo(Hd);
    const d = Math.min(d0, L1 + L2 - 1e-3);
    const dir = Hd.clone().sub(S).normalize();
    const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
    const pd = pole.clone().sub(S);
    pd.addScaledVector(dir, -pd.dot(dir)).normalize();
    const E = S.clone().addScaledVector(dir, a).addScaledVector(pd, h);
    const hand = S.clone().addScaledVector(dir, d);
    const sL = S.clone().applyMatrix4(inv), eL = E.applyMatrix4(inv), hL = hand.applyMatrix4(inv);
    stretch(arm.up, sL, eL);
    stretch(arm.fo, eL, hL);
    arm.hand.position.copy(hL);
    // 袖は上腕から下へ垂れる
    const ax = eL.clone().sub(sL).normalize();
    const dn = new THREE.Vector3(0, -1, 0).addScaledVector(ax, ax.y).normalize();
    const zz = new THREE.Vector3().crossVectors(ax, dn.clone().negate()).normalize();
    sleeve.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(ax, dn.clone().negate(), zz));
    sleeve.position.copy(sL).lerp(eL, 0.6).addScaledVector(dn, 0.15);
    sleeve.scale.set(0.34, 0.32, 1);
  }
}
