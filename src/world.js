// 馬場・的・観客・森などの環境
import * as THREE from 'three';
import { Sky } from '../vendor/three/addons/Sky.js';
import * as TX from './textures.js';
import { buildGrass, buildForest } from './vegetation.js';

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

export function buildWorld(scene, renderer, quality = 'high') {
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

  scene.fog = new THREE.Fog(0xc4ced4, 70, 1700);

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
    (() => { const t = TX.groundSet('grass', [600, 600], quality === 'low' ? 256 : 512); return new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap, normalScale: new THREE.Vector2(0.8, 0.8), roughness: 1 }); })()
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const trackLen = COURSE.stop - COURSE.runup + 40;
  const track = new THREE.Mesh(
    new THREE.PlaneGeometry(trackLen, 3.6),
    (() => { const t = TX.groundSet('sand', [trackLen / 4, 1], quality === 'low' ? 256 : 512); return new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap, normalScale: new THREE.Vector2(1.2, 1.2), roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -8 }); })()
  );
  track.rotation.x = -Math.PI / 2;
  track.position.set((COURSE.runup + COURSE.stop) / 2, 0.012, 0);
  track.receiveShadow = true;
  scene.add(track);

  // 観客側の踏み固められた地面
  const pt = TX.groundSet('path', [trackLen / 6, 1], quality === 'low' ? 256 : 512);
  const pathMat = new THREE.MeshStandardMaterial({ map: pt.map, normalMap: pt.normalMap, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 });
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
  world.crowd = makeCrowd(scene, quality === 'low' ? 0.5 : 1);

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

  buildGrass(scene, quality);
  buildForest(scene, quality);

  // ---------- 遠景の山並み ----------
  scene.add(makeMountains());

  // ---------- 雲 ----------
  world.clouds = makeClouds(sunDir, quality === 'low' ? 3 : 6);
  scene.add(world.clouds);

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

export function updateFlags(flags, t, wind, light = false) {
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
    if (!light) f.banner.geometry.computeVertexNormals();
  }
}

// 単純なジオメトリ結合（position/normal/uv）
function merge(geos) {
  const out = { position: [], normal: [], uv: [] };
  for (let g of geos) {
    g = g.index ? g.toNonIndexed() : g;
    for (const k of Object.keys(out)) {
      const at = g.attributes[k];
      if (at) out[k].push(...at.array);
      else if (k === 'uv') out[k].push(...new Array((g.attributes.position.count) * 2).fill(0));
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(out.position, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(out.normal, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(out.uv, 2));
  return geo;
}

function personBodyGeometry() {
  // 着物・羽織・コートを思わせる裾広がりのシルエット + 腕
  const prof = [[0.0, 0], [0.19, 0], [0.2, 0.08], [0.17, 0.45], [0.16, 0.8], [0.19, 1.05], [0.21, 1.2], [0.18, 1.3], [0.07, 1.36], [0.05, 1.42], [0, 1.42]]
    .map(([r, y]) => new THREE.Vector2(r, y));
  const body = new THREE.LatheGeometry(prof, 12);
  body.scale(1, 1, 0.72);
  const arms = [];
  for (const s of [-1, 1]) {
    const arm = new THREE.CylinderGeometry(0.05, 0.065, 0.62, 7);
    arm.rotateZ(s * 0.12);
    arm.translate(s * 0.22, 0.95, 0.02);
    arms.push(arm);
  }
  return merge([body, ...arms]);
}

function makeCrowd(scene, keep = 1) {
  const people = [];
  const addRow = (zMin, zMax, density, xMin, xMax) => {
    for (let x = xMin; x < xMax; x += 0.55) {
      for (let z = zMin; z < zMax; z += 0.6) {
        if (Math.random() > density * keep) continue;
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
  const bodyGeo = personBodyGeometry();
  const headGeo = new THREE.SphereGeometry(0.105, 12, 10);
  headGeo.scale(0.95, 1.1, 1);
  headGeo.translate(0, 1.53, 0.01);
  const hairGeo = new THREE.SphereGeometry(0.112, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55);
  hairGeo.rotateX(-0.25);
  hairGeo.translate(0, 1.55, -0.005);
  const hatGeo = merge([
    new THREE.CylinderGeometry(0.17, 0.18, 0.02, 14).translate(0, 1.62, 0),
    new THREE.CylinderGeometry(0.09, 0.11, 0.1, 14).translate(0, 1.68, 0),
  ]);
  const umbGeo = merge([
    new THREE.ConeGeometry(0.55, 0.3, 16, 1, true).translate(0, 2.05, 0),
    new THREE.CylinderGeometry(0.01, 0.01, 0.9, 5).translate(0, 1.55, 0),
  ]);
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.85 });
  const skinMat = new THREE.MeshStandardMaterial({ roughness: 0.6, color: 0xffffff });
  const umbMat = new THREE.MeshStandardMaterial({ roughness: 0.7, side: THREE.DoubleSide, transparent: false });
  const bodies = new THREE.InstancedMesh(bodyGeo, mat, n);
  const heads = new THREE.InstancedMesh(headGeo, skinMat, n);
  const hair = new THREE.InstancedMesh(hairGeo, mat, n);
  const hatList = people.filter(() => Math.random() < 0.16);
  const umbList = people.filter(p => !hatList.includes(p) && Math.random() < 0.05);
  const hats = new THREE.InstancedMesh(hatGeo, mat, Math.max(1, hatList.length));
  const umbs = new THREE.InstancedMesh(umbGeo, umbMat, Math.max(1, umbList.length));
  hats.count = hatList.length;
  umbs.count = umbList.length;
  const palette = [0x2b3a55, 0x4a2f2a, 0x6a6f74, 0x1e1e22, 0x8a3b2e, 0x3f5a46, 0xb7a58a, 0x5b4a6e, 0xd8d2c4, 0x355c7d, 0x7a2e2e, 0x9c7a3c, 0x23272e, 0x56606b, 0xa89f91];
  const hairCols = [0x141010, 0x1d1714, 0x2b211b, 0x4a3a2c, 0x8f8a84, 0xc9c4bc];
  const skins = [0xd9a77c, 0xe0b48e, 0xc8946a, 0xe8c2a0];
  const col = new THREE.Color();
  const m4 = new THREE.Matrix4();
  people.forEach((p, i) => {
    const child = Math.random() < 0.08;
    p.h = child ? rnd(0.6, 0.75) : rnd(0.92, 1.1);
    p.w = child ? 0.8 : rnd(0.9, 1.15);
    p.ph = Math.random() * 10;
    p.excite = 0;
    p.q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (p.z < 0 ? 0 : Math.PI) + rnd(-0.5, 0.5));
    m4.compose(new THREE.Vector3(p.x, 0, p.z), p.q, new THREE.Vector3(p.w, p.h, p.w));
    bodies.setMatrixAt(i, m4);
    heads.setMatrixAt(i, m4);
    hair.setMatrixAt(i, m4);
    bodies.setColorAt(i, col.setHex(palette[(Math.random() * palette.length) | 0]).multiplyScalar(rnd(0.75, 1.1)));
    heads.setColorAt(i, col.setHex(skins[(Math.random() * skins.length) | 0]));
    hair.setColorAt(i, col.setHex(hairCols[(Math.random() * hairCols.length) | 0]));
  });
  hatList.forEach((p, i) => {
    p.hat = i;
    m4.compose(new THREE.Vector3(p.x, 0, p.z), p.q, new THREE.Vector3(p.w, p.h, p.w));
    hats.setMatrixAt(i, m4);
    hats.setColorAt(i, col.setHex([0xc8b48a, 0x2a2a2a, 0x6b4b33, 0xe9e2d0][i % 4]));
  });
  const umbCols = [0xa0262b, 0x5a2a6a, 0x1f3f78, 0xd28a2d];
  umbList.forEach((p, i) => {
    p.umb = i;
    m4.compose(new THREE.Vector3(p.x, 0, p.z), p.q, new THREE.Vector3(1, p.h, 1));
    umbs.setMatrixAt(i, m4);
    umbs.setColorAt(i, col.setHex(umbCols[i % umbCols.length]));
  });
  for (const im of [bodies, heads, hair, hats, umbs]) {
    im.castShadow = true;
    im.receiveShadow = true;
    im.computeBoundingSphere();
  }
  scene.add(bodies, heads, hair, hats, umbs);

  // ロープ
  const ropeMat = new THREE.MeshStandardMaterial({ color: 0xe6dcc3, roughness: 0.9 });
  for (const z of [-11.6, 3.2]) {
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 320, 4), ropeMat);
    rope.rotation.z = Math.PI / 2;
    rope.position.set(115, 0.9, z);
    scene.add(rope);
  }
  return { people, parts: [bodies, heads, hair], hats, umbs, active: false, m4, v: new THREE.Vector3(), s: new THREE.Vector3() };
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
  const { m4, v, s } = crowd;
  crowd.people.forEach((p, i) => {
    if (p.excite <= 0 && !p.dirty) return;
    p.excite = Math.max(0, p.excite - dt * 0.35);
    p.dirty = p.excite > 0;
    any = true;
    const jump = Math.max(0, Math.sin(t * 9 + p.ph)) * 0.12 * p.excite;
    v.set(p.x, jump, p.z);
    s.set(p.w, p.h, p.w);
    m4.compose(v, p.q, s);
    for (const im of crowd.parts) im.setMatrixAt(i, m4);
    if (p.hat !== undefined) crowd.hats.setMatrixAt(p.hat, m4);
    if (p.umb !== undefined) { s.set(1, p.h, 1); m4.compose(v, p.q, s); crowd.umbs.setMatrixAt(p.umb, m4); }
  });
  for (const im of [...crowd.parts, crowd.hats, crowd.umbs]) im.instanceMatrix.needsUpdate = true;
  if (!any) crowd.active = false;
}

// 簡易ハッシュノイズ
function hash(x, y) {
  const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return h - Math.floor(h);
}
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function ridged(x, y) {
  let v = 0, amp = 0.55, f = 1;
  for (let o = 0; o < 6; o++) {
    const n = 1 - Math.abs(vnoise(x * f, y * f) * 2 - 1);
    v += n * n * amp;
    amp *= 0.5; f *= 2.03;
  }
  return v;
}

function makeMountains() {
  const R0 = 380, R1 = 1600, NR = 70, NA = 300;
  const pos = [], col = [], idx = [];
  const c = new THREE.Color();
  for (let i = 0; i <= NR; i++) {
    const r = R0 + (R1 - R0) * Math.pow(i / NR, 1.4);
    for (let j = 0; j <= NA; j++) {
      const a = (j / NA) * Math.PI * 2;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const env = THREE.MathUtils.smoothstep(r, R0, R0 + 350);
      const big = 0.5 + 0.5 * Math.sin(a * 3 + 1.3) * Math.sin(a * 5 + 0.4);
      const h = env * (40 + ridged(x * 0.0022 + 7, z * 0.0022 + 3) * (180 + big * 260)) - (1 - env) * 2;
      pos.push(x + 120, h, z);
      const t = THREE.MathUtils.clamp(h / 380, 0, 1);
      c.setHSL(0.3 - t * 0.06, 0.3 - t * 0.12, 0.14 + t * 0.12);
      col.push(c.r, c.g, c.b);
    }
  }
  for (let i = 0; i < NR; i++) {
    for (let j = 0; j < NA; j++) {
      const a = i * (NA + 1) + j, b = a + NA + 1;
      idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: false }));
  m.receiveShadow = false;
  return m;
}

function makeClouds(sunDir, octaves = 6) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uSun: { value: sunDir.clone() } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform float uTime; uniform vec3 uSun; varying vec3 vDir;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
        return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      float fbm(vec2 p){ float v=0., a=.5; for(int i=0;i<${octaves};i++){ v+=a*n(p); p=p*2.03+vec2(1.7,9.2); a*=.5; } return v; }
      void main(){
        if (vDir.y < 0.01) discard;
        vec2 uv = vDir.xz / (vDir.y + 0.12) * 1.4 + vec2(uTime * 0.004, uTime * 0.0015);
        float d = fbm(uv);
        float d2 = fbm(uv * 2.3 + 4.0);
        float cov = smoothstep(0.5, 0.78, d * 0.75 + d2 * 0.35);
        // 太陽側の縁が明るく、底は灰色がかる
        float shade = fbm(uv + uSun.xz * 0.06);
        vec3 col = mix(vec3(0.62,0.66,0.72), vec3(1.0,0.97,0.92), clamp(1.2 - (shade - d) * 6.0, 0.0, 1.0));
        float horizon = smoothstep(0.01, 0.2, vDir.y);
        gl_FragColor = vec4(col * 1.6, cov * horizon * 0.92);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, side: THREE.BackSide, fog: false,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(4000, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), mat);
  m.renderOrder = -1;
  m.frustumCulled = false;
  return m;
}
