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
  update(aimYaw, aimPitch, aimDir, draw, raise, nocked, releaseT = 9) {
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
    // 打起し：弓を頭上へ掲げ、引分けで目の高さへ下ろしながら引く
    const lift = raise * (1 - draw);
    const rel = releaseT < 1.1;
    const zan = rel ? 1 - THREE.MathUtils.smoothstep(releaseT, 0.55, 1.05) : 0; // 残心
    const lowered = rel ? 1 - zan : 1 - raise;
    const hl = shoulderL.clone().addScaledVector(aimDir, 0.66 - lowered * 0.25);
    hl.y += -0.12 - lowered * 0.3 + lift * 0.42;
    const drawLen = rel ? 0 : BOW.brace + 0.06 + BOW.drawLen * draw + lift * 0.05;
    const hr = hl.clone().addScaledVector(aimDir, -(drawLen || BOW.brace + 0.06));
    hr.y += 0.06 + lift * 0.04;
    if (rel) {
      // 離れ：右手は後方へ大きく開いて残心
      const k = Math.min(1, releaseT / 0.12) * zan;
      const rightDir = new THREE.Vector3().crossVectors(aimDir, up).normalize();
      hr.copy(hl).addScaledVector(aimDir, -(BOW.brace + 0.06 + BOW.drawLen)).addScaledVector(rightDir, 0.25 * k).addScaledVector(aimDir, -0.15 * k);
      hr.y += 0.04;
      hr.lerp(new THREE.Vector3(-0.1, 0.05, 0.3).applyMatrix4(this.torso.matrixWorld), 1 - zan);
    } else if (nocked < 1) hr.lerp(new THREE.Vector3(-0.2, 0.15, 0.3).applyMatrix4(this.torso.matrixWorld), 1 - nocked);

    // 弓
    const bg = this.bow.group;
    bg.position.copy(hl);
    const zAxis = _a.copy(aimDir).negate();
    const yAxis = _b.copy(up).addScaledVector(zAxis, -up.dot(zAxis)).normalize();
    yAxis.applyAxisAngle(zAxis, -0.12 - lowered * 0.4);
    const xAxis = _c.crossVectors(yAxis, zAxis);
    _m.makeBasis(xAxis, yAxis, zAxis);
    bg.quaternion.setFromRotationMatrix(_m);
    if (rel) bg.rotateY(-2.75 * Math.min(1, releaseT / 0.16) * zan);
    this.bow.setDraw(rel ? 0 : draw);
    const nockW = this.bow.nock.clone().applyMatrix4(bg.updateMatrixWorld() || bg.matrixWorld);
    this.arrow.visible = !!this.arrowVisibleAllowed && nocked > 0.5 && !rel;
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
