// 草・芒・杉・紅葉（インスタンス描画 + シェーダで風に揺らす）
import * as THREE from 'three';
import * as TX from './textures.js';

const rnd = (a, b) => a + Math.random() * (b - a);
export const windUniforms = {
  uTime: { value: 0 },
  uWind: { value: new THREE.Vector2(1, 0.3) },
};

// 草の葉：高さ0..1の細い短冊（aH = 根元0〜先端1）
function bladeGeometry(segments = 4, width = 0.04) {
  const pos = [], aH = [], nrm = [], idx = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const w = width * (1 - t * 0.85) * 0.5;
    const z = t * t * 0.18;
    if (i < segments) {
      pos.push(-w, t, z, w, t, z);
      aH.push(t, t);
      nrm.push(0, 1, 0.3, 0, 1, 0.3);
    } else {
      pos.push(0, t, z);
      aH.push(t);
      nrm.push(0, 1, 0.3);
    }
  }
  for (let i = 0; i < segments - 1; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const a = (segments - 1) * 2;
  idx.push(a, a + 1, a + 2);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('aH', new THREE.Float32BufferAttribute(aH, 1));
  g.setIndex(idx);
  return g;
}

// 風で揺れる頂点シェーダを標準マテリアルに注入
function swayMaterial(mat, { amount = 0.25, shade = true } = {}) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = windUniforms.uTime;
    sh.uniforms.uWind = windUniforms.uWind;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uTime; uniform vec2 uWind; attribute float aH; varying float vH;`)
      .replace('#include <project_vertex>', `
        vec4 mvPosition = vec4( transformed, 1.0 );
        #ifdef USE_INSTANCING
          mvPosition = instanceMatrix * mvPosition;
        #endif
        vec3 ip = vec3(0.0);
        #ifdef USE_INSTANCING
          ip = instanceMatrix[3].xyz;
        #endif
        float gust = sin(uTime * 0.9 + ip.x * 0.08) * 0.5 + 0.5;
        float w1 = sin(uTime * 2.1 + ip.x * 0.45 + ip.z * 0.3);
        float w2 = sin(uTime * 3.7 + ip.x * 1.3 - ip.z * 0.9) * 0.4;
        vec2 bend = uWind * (0.35 + gust * 0.65) + vec2(w1 + w2, (w1 - w2) * 0.6) * 0.25;
        float k = aH * aH * ${amount.toFixed(3)};
        mvPosition.xz += bend * k;
        mvPosition.y -= dot(bend, bend) * k * 0.15;
        vH = aH;
        mvPosition = modelViewMatrix * mvPosition;
        gl_Position = projectionMatrix * mvPosition;`);
    if (shade) {
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vH;')
        .replace('#include <color_fragment>', `#include <color_fragment>
          diffuseColor.rgb *= mix(0.38, 1.12, vH);`);
    } else {
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vH;');
    }
  };
  return mat;
}

function chunked(scene, geo, mat, items, chunk, build, opts = {}) {
  // x方向にチャンク分けして視錐台カリングを効かせる
  const buckets = new Map();
  for (const it of items) {
    const k = Math.floor(it.x / chunk);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(it);
  }
  const m4 = new THREE.Matrix4();
  const col = new THREE.Color();
  const meshes = [];
  for (const list of buckets.values()) {
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((it, i) => {
      build(it, m4, col);
      im.setMatrixAt(i, m4);
      im.setColorAt(i, col);
    });
    im.computeBoundingSphere();
    im.receiveShadow = opts.receive ?? true;
    im.castShadow = !!opts.cast;
    scene.add(im);
    meshes.push(im);
  }
  return meshes;
}

export function buildGrass(scene, quality) {
  const density = { high: 1, medium: 0.45, low: 0.12 }[quality];
  const bands = [
    // [zMin, zMax, 本/m², xMin, xMax]
    [-8.2, -1.95, 42, -75, 335],
    [-19, -13.9, 18, -75, 335],
    [1.95, 3.25, 40, -75, 335],
    [10.7, 18, 16, 12, 335],
    [14.8, 18, 16, -75, 12],
  ];
  const items = [];
  const q = new THREE.Quaternion();
  for (const [z0, z1, d, x0, x1] of bands) {
    const n = Math.floor((z1 - z0) * (x1 - x0) * d * density);
    for (let i = 0; i < n; i++) {
      const x = rnd(x0, x1), z = rnd(z0, z1);
      // 的の足元・立札まわりは踏まれて短い
      items.push({ x, z });
    }
  }
  const geo = bladeGeometry(4, 0.045);
  const mat = swayMaterial(new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.85 }), { amount: 0.3 });
  const up = new THREE.Vector3(0, 1, 0);
  const e = new THREE.Euler();
  chunked(scene, geo, mat, items, 24, (it, m4, col) => {
    e.set(rnd(-0.25, 0.25), rnd(0, Math.PI * 2), rnd(-0.25, 0.25));
    q.setFromEuler(e);
    const h = rnd(0.18, 0.55) * (Math.random() < 0.08 ? 1.6 : 1);
    m4.compose(new THREE.Vector3(it.x, 0, it.z), q, new THREE.Vector3(rnd(0.8, 1.3), h, 1));
    // 晩秋：緑・黄緑・枯れ色の混じり
    const r = Math.random();
    if (r < 0.45) col.setHSL(rnd(0.2, 0.26), rnd(0.35, 0.55), rnd(0.28, 0.4));
    else if (r < 0.8) col.setHSL(rnd(0.13, 0.19), rnd(0.4, 0.6), rnd(0.38, 0.5));
    else col.setHSL(rnd(0.08, 0.12), rnd(0.3, 0.45), rnd(0.42, 0.55));
  });

  // 芒（すすき）の株
  const clumps = [];
  for (let i = 0; i < 220 * Math.max(0.3, density); i++) {
    const side = Math.random() < 0.5;
    clumps.push({ x: rnd(-70, 330), z: side ? rnd(-19, -14.5) : rnd(11, 18) });
  }
  const stems = [], plumes = [];
  for (const c of clumps) {
    if (c.z > 0 && c.x < 12 && c.z < 15) continue;
    const n = 10 + Math.floor(Math.random() * 10);
    for (let i = 0; i < n; i++) {
      const it = { x: c.x + rnd(-0.35, 0.35), z: c.z + rnd(-0.35, 0.35), h: rnd(1.1, 1.8), tilt: rnd(-0.3, 0.3), yaw: rnd(0, 6.28) };
      stems.push(it);
      if (Math.random() < 0.55) plumes.push(it);
    }
  }
  const stemMat = swayMaterial(new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.8 }), { amount: 0.35 });
  chunked(scene, bladeGeometry(5, 0.025), stemMat, stems, 40, (it, m4, col) => {
    e.set(it.tilt, it.yaw, it.tilt * 0.5);
    q.setFromEuler(e);
    m4.compose(new THREE.Vector3(it.x, 0, it.z), q, new THREE.Vector3(1, it.h, 1));
    col.setHSL(rnd(0.1, 0.15), 0.35, rnd(0.45, 0.55));
  });
  // 穂：上端に羽毛状の房（aH を 1 付近にして先端と一緒に揺らす）
  const plumeGeo = new THREE.PlaneGeometry(0.12, 0.38, 1, 2);
  plumeGeo.translate(0, 0.19, 0);
  const ph = new Float32Array(plumeGeo.attributes.position.count).fill(1);
  plumeGeo.setAttribute('aH', new THREE.BufferAttribute(ph, 1));
  const plumeTex = (() => {
    const c = document.createElement('canvas');
    c.width = 32; c.height = 96;
    const g = c.getContext('2d');
    for (let i = 0; i < 160; i++) {
      const y = Math.random() * 90 + 3;
      const x = 16 + (Math.random() - 0.5) * 22 * (1 - y / 120);
      g.strokeStyle = `rgba(${230 + Math.random() * 25},${215 + Math.random() * 25},${200 + Math.random() * 30},0.8)`;
      g.beginPath(); g.moveTo(16, y); g.lineTo(x, y + 8 + Math.random() * 6); g.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const plumeMat = swayMaterial(new THREE.MeshStandardMaterial({ map: plumeTex, alphaTest: 0.35, side: THREE.DoubleSide, roughness: 0.9 }), { amount: 0.35, shade: false });
  const top = new THREE.Vector3();
  chunked(scene, plumeGeo, plumeMat, plumes, 40, (it, m4, col) => {
    e.set(it.tilt, it.yaw, it.tilt * 0.5);
    q.setFromEuler(e);
    top.set(0, it.h, 0.18 * it.h).applyQuaternion(q).add(new THREE.Vector3(it.x, 0, it.z));
    e.set(it.tilt + 0.5, it.yaw, 0);
    q.setFromEuler(e);
    m4.compose(top, q, new THREE.Vector3(1, 1, 1));
    col.setHSL(0.08, 0.25, rnd(0.8, 0.92));
  });
}

// 3枚の板を交差させた葉の房。法線は房の中心から外向き（ふんわりした陰影）
function clusterGeometry() {
  const geos = [];
  for (let i = 0; i < 3; i++) {
    const p = new THREE.PlaneGeometry(1, 1);
    p.rotateY((i / 3) * Math.PI);
    if (i === 2) p.rotateX(Math.PI / 2 - 0.3);
    geos.push(p);
  }
  const pos = [], uv = [], idx = [];
  let base = 0;
  for (const g of geos) {
    const a = g.attributes.position.array, u = g.attributes.uv.array;
    for (let i = 0; i < a.length; i++) pos.push(a[i]);
    for (let i = 0; i < u.length; i++) uv.push(u[i]);
    for (const i of g.index.array) idx.push(i + base);
    base += a.length / 3;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  const nrm = [];
  for (let i = 0; i < pos.length; i += 3) {
    const v = new THREE.Vector3(pos[i], pos[i + 1] + 0.25, pos[i + 2]).normalize();
    nrm.push(v.x, v.y, v.z);
  }
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  geo.setAttribute('aH', new THREE.Float32BufferAttribute(new Float32Array(pos.length / 3).fill(0.35), 1));
  geo.setIndex(idx);
  return geo;
}

export function buildForest(scene, quality) {
  const bark = TX.barkSet();
  const trunkMat = new THREE.MeshStandardMaterial({ map: bark.map, normalMap: bark.normalMap, roughness: 0.95 });
  const needleTex = TX.needleCardTexture();
  const leafTex = TX.leafCardTexture();
  const foliageMat = swayMaterial(new THREE.MeshStandardMaterial({
    map: needleTex, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.9,
  }), { amount: 0.6, shade: false });
  const leafMat = swayMaterial(new THREE.MeshStandardMaterial({
    map: leafTex, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.8,
  }), { amount: 0.8, shade: false });
  const cluster = clusterGeometry();

  // 杉並木
  const cedars = [];
  const place = (zMin, zMax, xMin, xMax, count) => {
    for (let i = 0; i < count; i++) cedars.push({ x: rnd(xMin, xMax), z: rnd(zMin, zMax), s: rnd(0.8, 1.25) });
  };
  const mult = quality === 'low' ? 0.5 : 1;
  place(-80, -21, -170, 430, 560 * mult);
  place(21, 80, -170, 430, 560 * mult);
  place(-21, 21, -180, -78, 90 * mult);
  place(-21, 21, 345, 430, 80 * mult);
  const trees = cedars.filter(({ x, z }) => !(Math.abs(z) < 19 && x > -72 && x < 338));

  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.45, 1, 9, 1, true);
  trunkGeo.translate(0, 0.5, 0);
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, trees.length);
  const items = [];
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  trees.forEach((t, i) => {
    const H = 28 * t.s;
    m4.compose(new THREE.Vector3(t.x, 0, t.z), q, new THREE.Vector3(t.s, H * 0.97, t.s));
    trunks.setMatrixAt(i, m4);
    const n = quality === 'low' ? 12 : 22;
    const hue = rnd(0.25, 0.33);
    for (let k = 0; k < n; k++) {
      const f = k / n;
      const y = H * (0.42 + 0.58 * Math.pow(f, 0.85));
      const R = (1 - (y / H - 0.42) / 0.6) * 3.4 * t.s + 0.6;
      const a = rnd(0, Math.PI * 2);
      const r = R * rnd(0.25, 0.85);
      items.push({ x: t.x + Math.cos(a) * r, y, z: t.z + Math.sin(a) * r, size: R * 1.1 + 1.6, hue, a });
    }
    items.push({ x: t.x, y: H * 0.99, z: t.z, size: 2.2, hue, a: 0 });
  });
  trunks.castShadow = true;
  trunks.receiveShadow = true;
  trunks.computeBoundingSphere();
  scene.add(trunks);
  chunked(scene, cluster, foliageMat, items, 60, (it, m4, col) => {
    e.set(rnd(-0.3, 0.3), it.a + rnd(-0.5, 0.5), rnd(-0.3, 0.3));
    q.setFromEuler(e);
    m4.compose(new THREE.Vector3(it.x, it.y, it.z), q, new THREE.Vector3(it.size, it.size * 0.8, it.size));
    col.setHSL(it.hue + rnd(-0.02, 0.02), rnd(0.35, 0.5), rnd(0.17, 0.27));
  }, { cast: true });

  // 紅葉・銀杏
  const maples = [];
  for (let i = 0; i < 110; i++) {
    const side = Math.random() < 0.5 ? -1 : 1;
    const x = rnd(-62, 332);
    const z = side * rnd(17, 23);
    maples.push({ x, z, s: rnd(0.8, 1.3), kind: Math.random() < 0.28 ? 'ginkgo' : 'maple' });
  }
  const mTrunk = new THREE.InstancedMesh(trunkGeo, trunkMat, maples.length);
  const leaves = [];
  maples.forEach((t, i) => {
    m4.compose(new THREE.Vector3(t.x, 0, t.z), q, new THREE.Vector3(t.s * 0.55, 5.5 * t.s, t.s * 0.55));
    mTrunk.setMatrixAt(i, m4);
    const cy = 5.2 * t.s, R = 3.0 * t.s;
    const hue = t.kind === 'ginkgo' ? rnd(0.115, 0.135) : rnd(0.0, 0.055);
    for (let k = 0; k < 26; k++) {
      const v = new THREE.Vector3().randomDirection().multiply(new THREE.Vector3(R, R * 0.7, R)).multiplyScalar(Math.cbrt(Math.random()));
      leaves.push({ x: t.x + v.x, y: cy + v.y, z: t.z + v.z, size: rnd(1.6, 2.4) * t.s, hue, kind: t.kind, outer: v.length() / R });
    }
  });
  mTrunk.castShadow = true;
  mTrunk.computeBoundingSphere();
  scene.add(mTrunk);
  chunked(scene, cluster, leafMat, leaves, 60, (it, m4, col) => {
    e.set(rnd(-0.6, 0.6), rnd(0, 6.28), rnd(-0.6, 0.6));
    q.setFromEuler(e);
    m4.compose(new THREE.Vector3(it.x, it.y, it.z), q, new THREE.Vector3(it.size, it.size, it.size));
    const l = it.kind === 'ginkgo' ? rnd(0.45, 0.58) : rnd(0.3, 0.45);
    // 内側ほど暗く、紅葉は一部まだ橙〜緑が残る
    let h = it.hue;
    if (it.kind === 'maple' && Math.random() < 0.15) h = rnd(0.07, 0.11);
    col.setHSL(h, it.kind === 'ginkgo' ? 0.85 : rnd(0.7, 0.9), l * (0.6 + it.outer * 0.5));
  }, { cast: true });

  // 林縁の低木
  const shrubs = [];
  for (let i = 0; i < (quality === 'low' ? 250 : 600); i++) {
    const side = Math.random() < 0.5 ? -1 : 1;
    shrubs.push({ x: rnd(-75, 340), z: side * rnd(19, 26), size: rnd(1.2, 2.4) });
  }
  chunked(scene, cluster, leafMat, shrubs, 60, (it, m4, col) => {
    e.set(rnd(-0.3, 0.3), rnd(0, 6.28), 0);
    q.setFromEuler(e);
    m4.compose(new THREE.Vector3(it.x, it.size * 0.4, it.z), q, new THREE.Vector3(it.size, it.size * 0.8, it.size));
    col.setHSL(rnd(0.15, 0.28), rnd(0.3, 0.5), rnd(0.18, 0.3));
  }, { cast: false });

  // 林床（落ち葉で暗い地面）
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x4a3b2a, roughness: 1, transparent: true, opacity: 0.75, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 });
  for (const s of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(620, 62), floorMat);
    p.rotation.x = -Math.PI / 2;
    p.position.set(130, 0.006, s * 52);
    p.receiveShadow = true;
    scene.add(p);
  }
}
