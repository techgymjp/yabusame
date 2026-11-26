// 馬場・的・観客・森などの環境
import * as THREE from 'three';
import { Sky } from '../vendor/three/addons/Sky.js';
import * as TX from './textures.js';

export const COURSE = {
  runup: -50,      // 助走開始位置
  start: 0,        // 馬場本元（計時開始）
  end: 218,        // 馬場末（二町 ≒ 218m）
  stop: 310,       // 馬を止める位置
  fenceZ: 1.7,     // 埒（らち）の位置
  targets: [
    { x: 58, name: '一の的' },
    { x: 128, name: '二の的' },
    { x: 196, name: '三の的' },
  ],
  targetZ: -5.4,   // 的は弓手（左）側
  targetY: 1.85,
  boardSize: 0.545, // 一尺八寸
};

const rnd = (a, b) => a + Math.random() * (b - a);

export function buildWorld(scene, renderer) {
  const world = { flags: [], judges: [], targets: [], crowd: null, sun: null };

  // ---------- 空と光 ----------
  const sky = new Sky();
  sky.scale.setScalar(20000);
  const su = sky.material.uniforms;
  su.turbidity.value = 5.5;
  su.rayleigh.value = 1.4;
  su.mieCoefficient.value = 0.004;
  su.mieDirectionalG.value = 0.82;
  const sunDir = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(58), THREE.MathUtils.degToRad(215));
  su.sunPosition.value.copy(sunDir);
  scene.add(sky);

  // 空から環境マップを生成
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  const sky2 = new Sky();
  sky2.scale.setScalar(1000);
  sky2.material.uniforms.turbidity.value = 5.5;
  sky2.material.uniforms.rayleigh.value = 1.4;
  sky2.material.uniforms.mieCoefficient.value = 0.004;
  sky2.material.uniforms.sunPosition.value.copy(sunDir);
  envScene.add(sky2);
  scene.environment = pmrem.fromScene(envScene, 0.02).texture;
  scene.environmentIntensity = 0.55;

  scene.fog = new THREE.Fog(0xb9c6cf, 120, 1300);

  const hemi = new THREE.HemisphereLight(0xcfe0ff, 0x6b5a3c, 0.9);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffeccc, 3.2);
  sun.position.copy(sunDir).multiplyScalar(80);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -40; sc.right = 40; sc.top = 40; sc.bottom = -40;
  sc.near = 1; sc.far = 220;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun);
  scene.add(sun.target);
  world.sun = sun;
  world.sunDir = sunDir;

  // ---------- 地面 ----------
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(3000, 3000),
    new THREE.MeshStandardMaterial({ map: TX.grassTexture([500, 500]), roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const trackLen = COURSE.stop - COURSE.runup + 40;
  const track = new THREE.Mesh(
    new THREE.PlaneGeometry(trackLen, 3.6),
    new THREE.MeshStandardMaterial({ map: TX.sandTexture([trackLen / 6, 1]), roughness: 1 })
  );
  track.rotation.x = -Math.PI / 2;
  track.position.set((COURSE.runup + COURSE.stop) / 2, 0.012, 0);
  track.receiveShadow = true;
  scene.add(track);

  // 観客側の踏み固められた地面
  const pathMat = new THREE.MeshStandardMaterial({ map: TX.sandTexture([trackLen / 8, 2]), color: 0xcbbd9f, roughness: 1 });
  for (const z of [-11, 7.5]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(trackLen, z < 0 ? 5 : 6), pathMat);
    p.rotation.x = -Math.PI / 2;
    p.position.set((COURSE.runup + COURSE.stop) / 2, 0.008, z);
    p.receiveShadow = true;
    scene.add(p);
  }

  // ---------- 埒（らち） ----------
  const woodTex = TX.woodTexture([1, 1]);
  const woodMat = new THREE.MeshStandardMaterial({ map: woodTex, color: 0xb59a7a, roughness: 0.85 });
  const postGeo = new THREE.BoxGeometry(0.11, 1.3, 0.11);
  const postSpacing = 2.4;
  const nPosts = Math.floor((COURSE.stop - COURSE.runup + 20) / postSpacing);
  const posts = new THREE.InstancedMesh(postGeo, woodMat, nPosts * 2);
  const m4 = new THREE.Matrix4();
  let k = 0;
  for (let i = 0; i < nPosts; i++) {
    for (const side of [-1, 1]) {
      m4.makeTranslation(COURSE.runup - 10 + i * postSpacing, 0.65, side * COURSE.fenceZ);
      posts.setMatrixAt(k++, m4);
    }
  }
  posts.castShadow = true;
  posts.receiveShadow = true;
  scene.add(posts);
  const railLen = nPosts * postSpacing;
  const railGeo = new THREE.BoxGeometry(railLen, 0.07, 0.05);
  const bambooMat = new THREE.MeshStandardMaterial({ color: 0x9c8a55, roughness: 0.6 });
  for (const side of [-1, 1]) {
    for (const y of [0.6, 1.22]) {
      const r = new THREE.Mesh(railGeo, y > 1 ? bambooMat : woodMat);
      r.position.set(COURSE.runup - 10 + railLen / 2, y, side * (COURSE.fenceZ + 0.06));
      r.castShadow = true;
      scene.add(r);
    }
  }

  // ---------- 的 ----------
  const targetTex = TX.targetTexture();
  const boardEdge = new THREE.MeshStandardMaterial({ color: 0xcfb284, roughness: 0.8 });
  const boardFace = new THREE.MeshStandardMaterial({ map: targetTex, roughness: 0.75 });
  const boardMats = [boardEdge, boardEdge, boardEdge, boardEdge, boardFace, boardEdge];
  const poleMat = new THREE.MeshStandardMaterial({ map: woodTex, color: 0x8a6a48, roughness: 0.9 });
  const bamboo = new THREE.MeshStandardMaterial({ color: 0x8f9a52, roughness: 0.55 });
  for (const t of COURSE.targets) {
    const g = new THREE.Group();
    g.position.set(t.x, 0, COURSE.targetZ);
    // 支柱（竹串で板を挟む）
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 2.6, 10), poleMat);
    pole.position.set(0, 1.3, -0.08);
    pole.castShadow = true;
    g.add(pole);
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.9, 6), bamboo);
    stick.position.set(0, COURSE.targetY, -0.02);
    g.add(stick);
    const board = new THREE.Mesh(new THREE.BoxGeometry(COURSE.boardSize, COURSE.boardSize, 0.018), boardMats);
    board.position.set(0, COURSE.targetY, 0);
    board.castShadow = true;
    g.add(board);
    // 立札
    const sign = new THREE.Group();
    const sp = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.1, 0.06), poleMat);
    sp.position.y = 0.55;
    sign.add(sp);
    const sb = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.3, 0.03), [boardEdge, boardEdge, boardEdge, boardEdge,
      new THREE.MeshStandardMaterial({ map: TX.signTexture(t.name), roughness: 0.9 }), boardEdge]);
    sb.position.y = 1.15;
    sign.add(sb);
    sign.position.set(-1.6, 0, 0.4);
    g.add(sign);
    scene.add(g);

    const judge = makeJudge();
    judge.root.position.set(t.x + 2.6, 0, COURSE.targetZ - 1.2);
    judge.root.rotation.y = -0.4;
    scene.add(judge.root);
    world.judges.push(judge);

    world.targets.push({
      ...t,
      group: g,
      board,
      boardMats,
      pos: new THREE.Vector3(t.x, COURSE.targetY, COURSE.targetZ),
      judge,
    });
  }

  // ---------- 鳥居 ----------
  scene.add(makeTorii(COURSE.runup + 12));

  // ---------- 観客 ----------
  world.crowd = makeCrowd(scene);

  // ---------- 紅白幕・桟敷 ----------
  const curtainTex = TX.curtainTexture();
  curtainTex.repeat.set(14, 1);
  const curtainMat = new THREE.MeshStandardMaterial({ map: curtainTex, roughness: 0.9, side: THREE.DoubleSide });
  const curtainGeo = new THREE.PlaneGeometry(70, 1.6, 140, 1);
  // 布のたるみ
  const cp = curtainGeo.attributes.position;
  for (let i = 0; i < cp.count; i++) cp.setZ(i, Math.sin(cp.getX(i) * 1.6) * 0.06);
  curtainGeo.computeVertexNormals();
  const curtain = new THREE.Mesh(curtainGeo, curtainMat);
  curtain.position.set(-5, 1.2, 14.5);
  curtain.receiveShadow = true;
  scene.add(curtain);
  const tentMat = new THREE.MeshStandardMaterial({ color: 0xf0ece2, roughness: 0.9, side: THREE.DoubleSide });
  const tent = new THREE.Mesh(new THREE.PlaneGeometry(30, 5), tentMat);
  tent.rotation.x = -Math.PI / 2 + 0.12;
  tent.position.set(-5, 3.3, 12);
  tent.castShadow = true;
  scene.add(tent);
  for (const x of [-20, -5, 10]) for (const z of [9.6, 14.4]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.3, 8), poleMat);
    p.position.set(x, 1.65, z);
    scene.add(p);
  }

  // ---------- 幟 ----------
  const texts = ['奉納流鏑馬', '天下泰平', '五穀豊穣', '奉納流鏑馬', '八幡宮'];
  let fi = 0;
  for (let x = -30; x < 290; x += 26) {
    for (const z of [5.0, -9.0]) {
      const flag = makeFlag(texts[fi++ % texts.length], fi % 3 === 0 ? '#1f3f78' : '#f4f0e6');
      flag.root.position.set(x + (z < 0 ? 13 : 0), 0, z);
      scene.add(flag.root);
      world.flags.push(flag);
    }
  }

  // ---------- 森（杉と紅葉） ----------
  makeForest(scene);

  // ---------- 遠景の山 ----------
  const mtnMat = new THREE.MeshStandardMaterial({ color: 0x4d6157, roughness: 1, flatShading: true });
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + rnd(-0.1, 0.1);
    const r = rnd(900, 1150);
    const h = rnd(120, 260);
    const m = new THREE.Mesh(new THREE.ConeGeometry(rnd(220, 380), h, 7), mtnMat);
    m.position.set(100 + Math.cos(a) * r, h / 2 - 10, Math.sin(a) * r);
    m.rotation.y = rnd(0, 3);
    scene.add(m);
  }

  return world;
}

function makeJudge() {
  // 的役：白い装束で扇を掲げる
  const root = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: 0.9 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xd9a77c, roughness: 0.7 });
  const black = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.5 });
  const hakama = new THREE.MeshStandardMaterial({ color: 0x5c6b85, roughness: 0.9 });
  const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.32, 0.85, 10), hakama);
  legs.position.y = 0.43;
  root.add(legs);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.65, 10), white);
  body.position.y = 1.18;
  root.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 10), skin);
  head.position.y = 1.62;
  root.add(head);
  const eboshi = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 0.26, 10), black);
  eboshi.position.y = 1.8;
  eboshi.rotation.z = 0.15;
  root.add(eboshi);
  const armPivot = new THREE.Group();
  armPivot.position.set(0, 1.42, 0.22);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.55, 8), white);
  arm.position.y = -0.27;
  armPivot.add(arm);
  // 日の丸の扇
  const fanTexC = document.createElement('canvas');
  fanTexC.width = fanTexC.height = 64;
  const fg = fanTexC.getContext('2d');
  fg.fillStyle = '#d9b13b'; fg.fillRect(0, 0, 64, 64);
  fg.fillStyle = '#c4161c'; fg.beginPath(); fg.arc(32, 20, 13, 0, Math.PI * 2); fg.fill();
  const fanTex = new THREE.CanvasTexture(fanTexC);
  fanTex.colorSpace = THREE.SRGBColorSpace;
  const fan = new THREE.Mesh(new THREE.CircleGeometry(0.28, 16, Math.PI * 0.2, Math.PI * 0.6),
    new THREE.MeshStandardMaterial({ map: fanTex, side: THREE.DoubleSide, roughness: 0.7 }));
  fan.position.y = -0.6;
  fan.rotation.z = Math.PI;
  armPivot.add(fan);
  root.add(armPivot);
  root.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return { root, armPivot, raise: 0, timer: 0 };
}

function makeTorii(x) {
  const g = new THREE.Group();
  const verm = new THREE.MeshStandardMaterial({ color: 0xc8361e, roughness: 0.55 });
  const blk = new THREE.MeshStandardMaterial({ color: 0x161210, roughness: 0.5 });
  const span = 7.4;
  for (const s of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 7.2, 16), verm);
    p.position.set(0, 3.6, (s * span) / 2);
    p.castShadow = true;
    g.add(p);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.36, 0.5, 16), blk);
    base.position.set(0, 0.25, (s * span) / 2);
    g.add(base);
  }
  const nuki = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.38, span + 1.4), verm);
  nuki.position.y = 5.6;
  g.add(nuki);
  const kasagi = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.42, span + 3.2), blk);
  kasagi.position.y = 7.25;
  g.add(kasagi);
  const shimaki = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.34, span + 2.8), verm);
  shimaki.position.y = 6.9;
  g.add(shimaki);
  const gakuzuka = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.2, 0.6), verm);
  gakuzuka.position.y = 6.2;
  g.add(gakuzuka);
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.position.x = x;
  return g;
}

function makeFlag(text, bg) {
  const root = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 6.2, 8),
    new THREE.MeshStandardMaterial({ color: 0x8b9450, roughness: 0.6 }));
  pole.position.y = 3.1;
  pole.castShadow = true;
  root.add(pole);
  const geo = new THREE.PlaneGeometry(0.75, 3.8, 6, 14);
  geo.translate(0.375 + 0.05, 0, 0);
  const banner = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    map: TX.bannerTexture(text, bg, bg === '#f4f0e6' ? '#b01c22' : '#f4f0e6'),
    side: THREE.DoubleSide, roughness: 0.9,
  }));
  banner.position.y = 3.9;
  banner.castShadow = true;
  root.add(banner);
  const base = Float32Array.from(geo.attributes.position.array);
  return { root, banner, base, phase: Math.random() * 10 };
}

export function updateFlags(flags, t, wind) {
  const windAngle = Math.atan2(-wind.z, wind.x);
  const strength = Math.min(1, wind.length() / 4);
  for (const f of flags) {
    f.banner.rotation.y = windAngle + Math.sin(t * 0.7 + f.phase) * 0.25;
    const pos = f.banner.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = f.base[i * 3], y = f.base[i * 3 + 1];
      const w = Math.sin(t * (3 + strength * 3) + x * 5 - y * 0.6 + f.phase) * 0.08 * (x + 0.1) * (0.5 + strength);
      pos.setZ(i, w);
    }
    pos.needsUpdate = true;
    f.banner.geometry.computeVertexNormals();
  }
}

function makeCrowd(scene) {
  const people = [];
  const addRow = (zMin, zMax, density, xMin, xMax) => {
    for (let x = xMin; x < xMax; x += 0.55) {
      for (let z = zMin; z < zMax; z += 0.6) {
        if (Math.random() > density) continue;
        people.push({ x: x + rnd(-0.2, 0.2), z: z + rnd(-0.2, 0.2) });
      }
    }
  };
  // 弓手側（的の奥）は距離をとる / 馬手側は埒の外すぐ
  addRow(-14.5, -12.0, 0.55, -40, 270);
  addRow(3.6, 6.5, 0.6, 25, 270);
  addRow(3.6, 6.5, 0.4, -40, -22);
  addRow(9.8, 14.0, 0.7, -19, 9); // 桟敷

  const n = people.length;
  const bodyGeo = new THREE.CylinderGeometry(0.17, 0.24, 1.0, 8);
  bodyGeo.translate(0, 0.5, 0);
  const headGeo = new THREE.SphereGeometry(0.11, 10, 8);
  headGeo.translate(0, 1.2, 0);
  const bodyMat = new THREE.MeshStandardMaterial({ roughness: 0.85 });
  const headMat = new THREE.MeshStandardMaterial({ roughness: 0.7 });
  const bodies = new THREE.InstancedMesh(bodyGeo, bodyMat, n);
  const heads = new THREE.InstancedMesh(headGeo, headMat, n);
  const palette = [0x2b3a55, 0x4a2f2a, 0x6a6f74, 0x1e1e22, 0x8a3b2e, 0x3f5a46, 0xb7a58a, 0x7b4f8c, 0xd8d2c4, 0x355c7d, 0xa23b3b, 0xc9a227];
  const hair = [0x161210, 0x1d1714, 0x2b211b, 0x6b5b4b, 0xbdb8b0];
  const col = new THREE.Color();
  const m4 = new THREE.Matrix4();
  people.forEach((p, i) => {
    p.h = rnd(0.82, 1.12);
    p.ph = Math.random() * 10;
    p.excite = 0;
    p.facing = p.z < 0 ? 0 : Math.PI;
    m4.compose(new THREE.Vector3(p.x, 0, p.z), new THREE.Quaternion(), new THREE.Vector3(1, p.h * 1.25, 1));
    bodies.setMatrixAt(i, m4);
    heads.setMatrixAt(i, m4);
    bodies.setColorAt(i, col.setHex(palette[(Math.random() * palette.length) | 0]));
    heads.setColorAt(i, col.setHex(Math.random() < 0.7 ? hair[(Math.random() * hair.length) | 0] : 0xd6a582));
  });
  bodies.castShadow = true;
  bodies.receiveShadow = true;
  heads.castShadow = true;
  scene.add(bodies, heads);

  // ロープ
  const ropeMat = new THREE.MeshStandardMaterial({ color: 0xe6dcc3, roughness: 0.9 });
  for (const z of [-11.6, 3.2]) {
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 320, 4), ropeMat);
    rope.rotation.z = Math.PI / 2;
    rope.position.set(115, 0.9, z);
    scene.add(rope);
  }
  return { people, bodies, heads, active: false, m4, v: new THREE.Vector3(), q: new THREE.Quaternion(), s: new THREE.Vector3() };
}

export function exciteCrowd(crowd, x, amount = 1) {
  for (const p of crowd.people) {
    const d = Math.abs(p.x - x);
    const e = amount * Math.max(0, 1 - d / 70);
    if (e > p.excite) p.excite = e;
  }
  crowd.active = true;
}

export function updateCrowd(crowd, dt, t) {
  if (!crowd.active) return;
  let any = false;
  const { m4, v, q, s } = crowd;
  crowd.people.forEach((p, i) => {
    if (p.excite <= 0 && !p.dirty) return;
    p.excite = Math.max(0, p.excite - dt * 0.35);
    p.dirty = p.excite > 0;
    any = true;
    const jump = Math.max(0, Math.sin(t * 9 + p.ph)) * 0.12 * p.excite;
    v.set(p.x, jump, p.z);
    s.set(1, p.h * 1.25, 1);
    m4.compose(v, q, s);
    crowd.bodies.setMatrixAt(i, m4);
    crowd.heads.setMatrixAt(i, m4);
  });
  crowd.bodies.instanceMatrix.needsUpdate = true;
  crowd.heads.instanceMatrix.needsUpdate = true;
  if (!any) crowd.active = false;
}

function makeForest(scene) {
  const cedars = [];
  const placeBand = (zMin, zMax, xMin, xMax, count) => {
    for (let i = 0; i < count; i++) cedars.push([rnd(xMin, xMax), rnd(zMin, zMax), rnd(0.8, 1.3)]);
  };
  placeBand(-75, -19, -160, 420, 520);
  placeBand(19, 75, -160, 420, 520);
  placeBand(-19, 19, -170, -75, 90);
  placeBand(-19, 19, 345, 420, 80);
  const filtered = cedars.filter(([x, z]) => !(Math.abs(z) < 16 && x > -70 && x < 335));

  const trunkGeo = new THREE.CylinderGeometry(0.18, 0.42, 1, 7);
  trunkGeo.translate(0, 0.5, 0);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6a4a36, roughness: 1 });
  const coneGeo = new THREE.ConeGeometry(1, 1, 9);
  coneGeo.translate(0, 0.5, 0);
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2c4a2e, roughness: 0.95, flatShading: true });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, filtered.length);
  const layers = 4;
  const cones = new THREE.InstancedMesh(coneGeo, leafMat, filtered.length * layers);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const col = new THREE.Color();
  let k = 0;
  filtered.forEach(([x, z, s], i) => {
    const h = 26 * s;
    m4.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(s, h * 0.75, s));
    trunks.setMatrixAt(i, m4);
    for (let l = 0; l < layers; l++) {
      const y = h * (0.3 + l * 0.17);
      const r = (3.0 - l * 0.6) * s;
      m4.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(r, h * 0.32, r));
      cones.setMatrixAt(k, m4);
      cones.setColorAt(k, col.setHSL(rnd(0.27, 0.36), rnd(0.25, 0.4), rnd(0.2, 0.3)));
      k++;
    }
  });
  trunks.castShadow = true;
  cones.castShadow = true;
  scene.add(trunks, cones);

  // 紅葉（もみじ・いちょう）
  const maples = [];
  for (let i = 0; i < 90; i++) {
    const side = Math.random() < 0.5 ? -1 : 1;
    maples.push([rnd(-60, 330), side * rnd(16.5, 22), rnd(0.8, 1.3)]);
  }
  const blobGeo = new THREE.IcosahedronGeometry(1, 1);
  const blobMat = new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true });
  const blobs = new THREE.InstancedMesh(blobGeo, blobMat, maples.length * 4);
  const mt = new THREE.InstancedMesh(trunkGeo, trunkMat, maples.length);
  k = 0;
  maples.forEach(([x, z, s], i) => {
    m4.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(s * 0.6, 4 * s, s * 0.6));
    mt.setMatrixAt(i, m4);
    const ginkgo = Math.random() < 0.3;
    for (let b = 0; b < 4; b++) {
      const r = rnd(1.6, 2.4) * s;
      m4.compose(new THREE.Vector3(x + rnd(-1.5, 1.5) * s, (4.5 + rnd(-0.5, 1.8)) * s, z + rnd(-1.5, 1.5) * s), q,
        new THREE.Vector3(r, r * 0.85, r));
      blobs.setMatrixAt(k, m4);
      if (ginkgo) blobs.setColorAt(k, col.setHSL(rnd(0.11, 0.14), 0.85, rnd(0.45, 0.55)));
      else blobs.setColorAt(k, col.setHSL(rnd(0.0, 0.05), rnd(0.7, 0.85), rnd(0.32, 0.45)));
      k++;
    }
  });
  blobs.castShadow = true;
  mt.castShadow = true;
  scene.add(blobs, mt);
}
