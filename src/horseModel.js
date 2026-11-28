// 解剖学的な馬モデル
// 筋肉・骨格の形を距離関数(SDF)の滑らかな合成で表し、Surface Nets で一体の曲面メッシュを生成、
// 骨格にスキニングして襲歩を動かす。
import * as THREE from 'three';
import { furTexture, hairCardTexture } from './textures.js';
import { loft } from './loft.js';

// ---------- 距離関数 ----------
function roundCone(a, b, r1, r2) {
  const bax = b[0] - a[0], bay = b[1] - a[1], baz = b[2] - a[2];
  const l2 = bax * bax + bay * bay + baz * baz;
  const rr = r1 - r2, a2 = l2 - rr * rr, il2 = 1 / l2;
  const box = {
    min: [Math.min(a[0] - r1, b[0] - r2), Math.min(a[1] - r1, b[1] - r2), Math.min(a[2] - r1, b[2] - r2)],
    max: [Math.max(a[0] + r1, b[0] + r2), Math.max(a[1] + r1, b[1] + r2), Math.max(a[2] + r1, b[2] + r2)],
  };
  const f = (x, y, z) => {
    const pax = x - a[0], pay = y - a[1], paz = z - a[2];
    const yy = pax * bax + pay * bay + paz * baz;
    const zz = yy - l2;
    const xvx = pax * l2 - bax * yy, xvy = pay * l2 - bay * yy, xvz = paz * l2 - baz * yy;
    const x2 = xvx * xvx + xvy * xvy + xvz * xvz;
    const y2 = yy * yy * l2, z2 = zz * zz * l2;
    const k = Math.sign(rr) * rr * rr * x2;
    if (Math.sign(zz) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - r2;
    if (Math.sign(yy) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - r1;
    return (Math.sqrt(x2 * a2 * il2) + yy * rr) * il2 - r1;
  };
  f.box = box;
  return f;
}
function ellipsoid(c, r, rotZ = 0) {
  const cs = Math.cos(-rotZ), sn = Math.sin(-rotZ);
  const m = Math.max(r[0], r[1], r[2]);
  const f = (x, y, z) => {
    let px = x - c[0], py = y - c[1];
    const pz = z - c[2];
    const qx = px * cs - py * sn, qy = px * sn + py * cs;
    const ax = qx / r[0], ay = qy / r[1], az = pz / r[2];
    const k0 = Math.sqrt(ax * ax + ay * ay + az * az);
    const bx = qx / (r[0] * r[0]), by = qy / (r[1] * r[1]), bz = pz / (r[2] * r[2]);
    const k1 = Math.sqrt(bx * bx + by * by + bz * bz);
    return k1 < 1e-9 ? -Math.min(r[0], r[1], r[2]) : (k0 * (k0 - 1)) / k1;
  };
  f.box = { min: [c[0] - m, c[1] - m, c[2] - m], max: [c[0] + m, c[1] + m, c[2] + m] };
  return f;
}
const smin = (a, b, k) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
};
const smax = (a, b, k) => -smin(-a, -b, k);

// ---------- 骨格（休止姿勢のワールド座標、x 前方 / y 上 / z 右） ----------
const BONES = [
  ['root', null, [0, 0, 0]],
  ['body', 'root', [0, 1.25, 0]],
  ['neck1', 'body', [0.6, 1.45, 0]],
  ['neck2', 'neck1', [0.78, 1.72, 0]],
  ['head', 'neck2', [0.95, 1.95, 0]],
  ['tail', 'body', [-0.84, 1.5, 0]],
];
const LEGS = [
  // name, front, side(z), 着地順オフセット
  ['LH', false, -1, 0.0],
  ['RH', false, 1, 0.11],
  ['LF', true, -1, 0.42],
  ['RF', true, 1, 0.53],
];
for (const [n, front, s] of LEGS) {
  const z = s * (front ? 0.155 : 0.165);
  if (front) {
    BONES.push([n + '0', 'body', [0.6, 1.2, z]], [n + '1', n + '0', [0.56, 0.62, z]], [n + '2', n + '1', [0.557, 0.2, z]]);
  } else {
    BONES.push([n + '0', 'body', [-0.56, 1.32, z]], [n + '1', n + '0', [-0.62, 0.6, z]], [n + '2', n + '1', [-0.586, 0.2, z]]);
  }
}
const BONE_INDEX = Object.fromEntries(BONES.map((b, i) => [b[0], i]));

// ---------- 形状（筋肉と骨の塊） ----------
function buildPrimitives() {
  const P = [];
  const add = (bone, f, k = 0.06, sub = false) => P.push({ bone: BONE_INDEX[bone], f, k, sub });
  // 胴
  add('body', ellipsoid([0.0, 1.25, 0], [0.6, 0.32, 0.29]), 0.1);
  add('body', ellipsoid([0.35, 1.27, 0], [0.38, 0.33, 0.27]), 0.12);
  add('body', ellipsoid([0.64, 1.22, 0], [0.2, 0.25, 0.2]), 0.1);
  add('body', ellipsoid([0.0, 1.06, 0], [0.45, 0.15, 0.24]), 0.12);
  add('body', roundCone([0.22, 1.5, 0], [0.5, 1.56, 0], 0.09, 0.08), 0.1);
  add('body', roundCone([-0.45, 1.47, 0], [0.25, 1.46, 0], 0.12, 0.12), 0.1);
  add('body', ellipsoid([-0.5, 1.43, 0], [0.3, 0.16, 0.2]), 0.1);
  for (const s of [-1, 1]) {
    add('body', ellipsoid([0.7, 1.12, s * 0.09], [0.12, 0.15, 0.09]), 0.06);   // 胸筋
    add('body', ellipsoid([-0.55, 1.36, s * 0.11], [0.32, 0.26, 0.19]), 0.08); // 臀部
    add('body', ellipsoid([-0.76, 1.18, s * 0.1], [0.14, 0.27, 0.11]), 0.06);  // 半腱様筋
    add('body', ellipsoid([0.5, 1.36, s * 0.19], [0.12, 0.26, 0.07], -0.45), 0.08); // 肩甲
  }
  // 首
  add('neck1', roundCone([0.5, 1.38, 0], [0.78, 1.72, 0], 0.25, 0.17), 0.12);
  add('neck1', roundCone([0.42, 1.6, 0], [0.74, 1.86, 0], 0.07, 0.075), 0.08);
  add('neck2', roundCone([0.78, 1.72, 0], [0.93, 1.92, 0], 0.17, 0.12), 0.1);
  add('neck2', roundCone([0.74, 1.86, 0], [0.9, 2.0, 0], 0.075, 0.06), 0.08);
  add('neck2', ellipsoid([0.92, 1.82, 0], [0.08, 0.09, 0.08]), 0.08);
  // 頭
  add('head', ellipsoid([0.98, 1.95, 0], [0.11, 0.1, 0.095]), 0.08);
  add('head', roundCone([1.0, 1.9, 0], [1.21, 1.58, 0], 0.085, 0.058), 0.05);
  add('head', ellipsoid([1.23, 1.55, 0], [0.075, 0.07, 0.066], -0.6), 0.05);
  add('head', ellipsoid([1.17, 1.5, 0], [0.05, 0.035, 0.04]), 0.04);
  for (const s of [-1, 1]) {
    add('head', ellipsoid([0.98, 1.8, s * 0.065], [0.1, 0.11, 0.05], -0.6), 0.05); // 頬
    add('head', ellipsoid([1.03, 1.87, s * 0.083], [0.03, 0.025, 0.025]), 0.03);   // 眼窩
    add('head', roundCone([0.95, 2.02, s * 0.05], [0.92, 2.17, s * 0.066], 0.03, 0.007), 0.02); // 耳
    add('head', ellipsoid([1.285, 1.56, s * 0.036], [0.016, 0.022, 0.014], -0.6), 0.012, true); // 鼻孔
  }
  add('head', ellipsoid([1.235, 1.505, 0], [0.055, 0.005, 0.07], -0.3), 0.006, true); // 口
  // 尾根
  add('tail', roundCone([-0.82, 1.5, 0], [-0.93, 1.3, 0], 0.06, 0.04), 0.06);
  // 脚
  for (const [n, front, s] of LEGS) {
    const z = s * (front ? 0.155 : 0.165);
    if (front) {
      add(n + '0', ellipsoid([0.57, 1.1, z], [0.15, 0.15, 0.09]), 0.07);
      add(n + '0', roundCone([0.55, 1.02, z], [0.56, 0.67, z], 0.08, 0.045), 0.05);
      add(n + '1', ellipsoid([0.56, 0.62, z], [0.05, 0.065, 0.048]), 0.03);
      add(n + '1', roundCone([0.56, 0.6, z], [0.562, 0.24, z], 0.036, 0.033), 0.02);
      add(n + '1', roundCone([0.533, 0.56, z], [0.538, 0.26, z], 0.02, 0.02), 0.015);
      add(n + '1', ellipsoid([0.555, 0.2, z], [0.055, 0.048, 0.045]), 0.025);
      add(n + '2', roundCone([0.565, 0.19, z], [0.59, 0.1, z], 0.034, 0.036), 0.02);
      add(n + '2', roundCone([0.59, 0.1, z], [0.603, 0.056, z], 0.042, 0.056), 0.012);
    } else {
      add(n + '0', ellipsoid([-0.5, 1.12, z * 0.92], [0.22, 0.24, 0.12]), 0.07);
      add(n + '0', ellipsoid([-0.38, 1.0, z], [0.08, 0.1, 0.07]), 0.05);
      add(n + '0', roundCone([-0.45, 0.98, z], [-0.6, 0.64, z], 0.09, 0.05), 0.05);
      add(n + '1', ellipsoid([-0.62, 0.6, z], [0.07, 0.06, 0.048]), 0.03);
      add(n + '1', ellipsoid([-0.69, 0.63, z], [0.035, 0.035, 0.03]), 0.03);
      add(n + '1', roundCone([-0.6, 0.56, z], [-0.586, 0.24, z], 0.04, 0.035), 0.02);
      add(n + '1', roundCone([-0.63, 0.55, z], [-0.612, 0.26, z], 0.02, 0.02), 0.015);
      add(n + '1', ellipsoid([-0.588, 0.2, z], [0.056, 0.048, 0.046]), 0.025);
      add(n + '2', roundCone([-0.58, 0.19, z], [-0.56, 0.1, z], 0.035, 0.037), 0.02);
      add(n + '2', roundCone([-0.56, 0.1, z], [-0.55, 0.056, z], 0.043, 0.056), 0.012);
    }
  }
  return P;
}

function makeSDF(P) {
  const sdf = (x, y, z) => {
    let d = 1e9;
    for (let i = 0; i < P.length; i++) {
      const p = P[i];
      if (p.sub) continue;
      const b = p.f.box;
      // 境界箱から十分遠い要素は概算で済ませる
      const ox = Math.max(b.min[0] - x, 0, x - b.max[0]);
      const oy = Math.max(b.min[1] - y, 0, y - b.max[1]);
      const oz = Math.max(b.min[2] - z, 0, z - b.max[2]);
      const lb = Math.sqrt(ox * ox + oy * oy + oz * oz);
      if (lb - p.k > d) continue;
      d = smin(d, p.f(x, y, z), p.k);
    }
    for (let i = 0; i < P.length; i++) {
      const p = P[i];
      if (p.sub) d = smax(d, -p.f(x, y, z), p.k);
    }
    return d;
  };
  return sdf;
}

// ---------- Surface Nets ----------
function surfaceNets(sdf, min, max, h) {
  const nx = Math.ceil((max[0] - min[0]) / h) + 1;
  const ny = Math.ceil((max[1] - min[1]) / h) + 1;
  const nz = Math.ceil((max[2] - min[2]) / h) + 1;
  const C = 4;
  // 粗いグリッドで表面近傍だけを精密評価
  const cx = Math.ceil(nx / C) + 1, cy = Math.ceil(ny / C) + 1, cz = Math.ceil(nz / C) + 1;
  const coarse = new Float32Array(cx * cy * cz);
  for (let k = 0; k < cz; k++) for (let j = 0; j < cy; j++) for (let i = 0; i < cx; i++) {
    coarse[i + cx * (j + cy * k)] = sdf(min[0] + i * C * h, min[1] + j * C * h, min[2] + k * C * h);
  }
  const band = C * h * 1.6;
  const val = new Float32Array(nx * ny * nz);
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const ci = Math.round(i / C), cj = Math.round(j / C), ck = Math.round(k / C);
    const dc = coarse[ci + cx * (cj + cy * ck)];
    val[i + nx * (j + ny * k)] = Math.abs(dc) > band ? dc : sdf(min[0] + i * h, min[1] + j * h, min[2] + k * h);
  }
  const idx = (i, j, k) => i + nx * (j + ny * k);
  const cellVert = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1);
  const cIdx = (i, j, k) => i + (nx - 1) * (j + (ny - 1) * k);
  const pos = [];
  const corners = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const edges = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const cv = new Float32Array(8);
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    let mask = 0;
    for (let c = 0; c < 8; c++) {
      const v = val[idx(i + corners[c][0], j + corners[c][1], k + corners[c][2])];
      cv[c] = v;
      if (v < 0) mask |= 1 << c;
    }
    if (mask === 0 || mask === 255) continue;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const [a, b] of edges) {
      const va = cv[a], vb = cv[b];
      if ((va < 0) === (vb < 0)) continue;
      const t = va / (va - vb);
      sx += corners[a][0] + (corners[b][0] - corners[a][0]) * t;
      sy += corners[a][1] + (corners[b][1] - corners[a][1]) * t;
      sz += corners[a][2] + (corners[b][2] - corners[a][2]) * t;
      n++;
    }
    cellVert[cIdx(i, j, k)] = pos.length / 3;
    pos.push(min[0] + (i + sx / n) * h, min[1] + (j + sy / n) * h, min[2] + (k + sz / n) * h);
  }
  const quads = [];
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const inside = val[idx(i, j, k)] < 0;
    // x 方向の辺
    if ((val[idx(i + 1, j, k)] < 0) !== inside) {
      quads.push([cIdx(i, j - 1, k - 1), cIdx(i, j, k - 1), cIdx(i, j, k), cIdx(i, j - 1, k)]);
    }
    if ((val[idx(i, j + 1, k)] < 0) !== inside) {
      quads.push([cIdx(i - 1, j, k - 1), cIdx(i, j, k - 1), cIdx(i, j, k), cIdx(i - 1, j, k)]);
    }
    if ((val[idx(i, j, k + 1)] < 0) !== inside) {
      quads.push([cIdx(i - 1, j - 1, k), cIdx(i, j - 1, k), cIdx(i, j, k), cIdx(i - 1, j, k)]);
    }
  }
  return { pos, quads: quads.map(q => q.map(c => cellVert[c])).filter(q => q.every(v => v >= 0)) };
}

// ---------- メッシュ生成 ----------
function buildHorseGeometry(h) {
  const P = buildPrimitives();
  const sdf = makeSDF(P);
  const { pos, quads } = surfaceNets(sdf, [-1.02, -0.02, -0.38], [1.36, 2.24, 0.38], h);
  const n = pos.length / 3;
  const e = h * 0.25;
  const normals = new Float32Array(n * 3);
  // 表面へ投影し、勾配から法線
  for (let v = 0; v < n; v++) {
    let x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
    let gx = 0, gy = 0, gz = 1;
    for (let it = 0; it < 3; it++) {
      const d = sdf(x, y, z);
      gx = sdf(x + e, y, z) - sdf(x - e, y, z);
      gy = sdf(x, y + e, z) - sdf(x, y - e, z);
      gz = sdf(x, y, z + e) - sdf(x, y, z - e);
      const gl = Math.hypot(gx, gy, gz) || 1;
      gx /= gl; gy /= gl; gz /= gl;
      if (it < 2) {
        const step = THREE.MathUtils.clamp(d, -h, h);
        x -= gx * step; y -= gy * step; z -= gz * step;
      }
    }
    pos[v * 3] = x; pos[v * 3 + 1] = y; pos[v * 3 + 2] = z;
    normals[v * 3] = gx; normals[v * 3 + 1] = gy; normals[v * 3 + 2] = gz;
  }
  // 面の向きを法線に合わせる
  const index = [];
  const A = new THREE.Vector3(), B = new THREE.Vector3(), Cc = new THREE.Vector3(), N = new THREE.Vector3();
  for (const q of quads) {
    A.fromArray(pos, q[0] * 3); B.fromArray(pos, q[1] * 3); Cc.fromArray(pos, q[2] * 3);
    N.subVectors(B, A).cross(Cc.clone().sub(A));
    const nx = normals[q[0] * 3] + normals[q[2] * 3], ny = normals[q[0] * 3 + 1] + normals[q[2] * 3 + 1], nz = normals[q[0] * 3 + 2] + normals[q[2] * 3 + 2];
    const flip = N.x * nx + N.y * ny + N.z * nz < 0;
    // 短い対角線で分割
    const d02 = A.distanceToSquared(Cc);
    const D = new THREE.Vector3().fromArray(pos, q[3] * 3);
    const d13 = B.distanceToSquared(D);
    let tris = d02 < d13 ? [[q[0], q[1], q[2]], [q[0], q[2], q[3]]] : [[q[0], q[1], q[3]], [q[1], q[2], q[3]]];
    for (const t of tris) index.push(...(flip ? [t[0], t[2], t[1]] : t));
  }

  // スキンウェイト：骨ごとの最短距離から柔らかく配分
  const nb = BONES.length;
  const skinIndex = new Uint16Array(n * 4), skinWeight = new Float32Array(n * 4);
  const colors = new Float32Array(n * 3);
  const dist = new Float32Array(nb);
  const bay = new THREE.Color(0x6e3b1c), bayDark = new THREE.Color(0x4a2512), black = new THREE.Color(0x15100d);
  const hoof = new THREE.Color(0x2e2925), muzzle = new THREE.Color(0x2c211c), white = new THREE.Color(0xf2ede4);
  const col = new THREE.Color();
  const noise = (x, y, z) => Math.sin(x * 23.1 + Math.sin(z * 17.3)) * Math.sin(y * 19.7 + x * 7.1) * 0.5 + 0.5;
  for (let v = 0; v < n; v++) {
    const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
    dist.fill(1e9);
    for (const p of P) {
      if (p.sub) continue;
      const d = p.f(x, y, z);
      if (d < dist[p.bone]) dist[p.bone] = d;
    }
    const order = [...dist.keys()].sort((a, b) => dist[a] - dist[b]).slice(0, 4);
    const dmin = dist[order[0]];
    let sum = 0;
    const w = order.map(b => {
      const ww = Math.exp(-(dist[b] - dmin) / 0.022);
      sum += ww;
      return ww;
    });
    order.forEach((b, i) => {
      skinIndex[v * 4 + i] = b;
      skinWeight[v * 4 + i] = w[i] / sum;
    });
    // 毛色：鹿毛。脚先・たてがみ際は黒、口元は黒鹿、額に流星
    const main = BONES[order[0]][0];
    const isLeg = /[LR][FH][012]/.test(main);
    col.copy(bay).lerp(bayDark, THREE.MathUtils.smoothstep(y, 1.35, 1.62) * (1 - Math.min(1, Math.abs(z) / 0.25)) * 0.8);
    col.multiplyScalar(0.9 + noise(x, y, z) * 0.18);
    if (isLeg) {
      col.lerp(black, THREE.MathUtils.smoothstep(y, 0.82, 0.6));
      if (y < 0.105) col.copy(hoof);
    }
    if (main === 'head' || main === 'neck2') {
      const dm = Math.hypot(x - 1.23, y - 1.55, z);
      col.lerp(muzzle, THREE.MathUtils.smoothstep(dm, 0.13, 0.07));
      // 流星（額から鼻筋の白斑）
      const t = ((x - 1.0) * 0.21 + (y - 1.9) * -0.32) / (0.21 * 0.21 + 0.32 * 0.32);
      const nx = normals[v * 3], ny = normals[v * 3 + 1];
      if (t > 0.08 && t < 0.72 && nx * 0.83 + ny * 0.55 > 0.8 && Math.abs(normals[v * 3 + 2]) < 0.35) {
        const wdt = 0.024 - t * 0.016;
        col.lerp(white, THREE.MathUtils.smoothstep(Math.abs(z), wdt + 0.008, wdt));
      }
      if (y > 2.03) col.lerp(black, 0.5); // 耳先
    }
    if (main === 'tail') col.copy(black);
    colors[v * 3] = col.r; colors[v * 3 + 1] = col.g; colors[v * 3 + 2] = col.b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4));
  geo.setAttribute('skinWeight', new THREE.BufferAttribute(skinWeight, 4));
  geo.setIndex(index);
  return geo;
}

// ---------- 馬 ----------
export class Horse {
  constructor(quality = 'high') {
    this.root = new THREE.Group();
    const res = { high: 0.0125, medium: 0.015, low: 0.023 }[quality] || 0.014;
    const low = quality === 'low';
    const geo = buildHorseGeometry(res);

    // 骨
    this.bones = {};
    const restWorld = {};
    for (const [name, parent, p] of BONES) {
      const b = new THREE.Bone();
      b.name = name;
      restWorld[name] = new THREE.Vector3(...p);
      if (parent) {
        b.position.copy(restWorld[name]).sub(restWorld[parent]);
        this.bones[parent].add(b);
      } else b.position.set(...p);
      this.bones[name] = b;
    }
    const boneList = BONES.map(b => this.bones[b[0]]);
    const coat = low ? new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0 })
      : new THREE.MeshPhysicalMaterial({
        vertexColors: true, roughness: 0.48, metalness: 0,
        sheen: 0.8, sheenRoughness: 0.4, sheenColor: new THREE.Color(0xa0704c),
        clearcoat: 0.18, clearcoatRoughness: 0.55,
      });
    this.mesh = new THREE.SkinnedMesh(geo, coat);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    this.mesh.add(this.bones.root);
    this.mesh.updateMatrixWorld(true);
    this.mesh.bind(new THREE.Skeleton(boneList));
    this.root.add(this.mesh);

    // 既存コードとの互換名
    this.body = this.bones.body;
    this.neck = this.bones.neck1;
    this.head = this.bones.head;
    this.tail = this.bones.tail;
    this.baseY = 1.25;
    // ワールド休止座標 → 骨のローカル
    const at = (bone, obj, p) => {
      obj.position.set(p[0], p[1], p[2]).sub(restWorld[bone]);
      this.bones[bone].add(obj);
      obj.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      return obj;
    };

    const hairMat = new THREE.MeshStandardMaterial({ map: hairCardTexture(), alphaTest: 0.3, side: THREE.DoubleSide, roughness: 0.75, color: 0x6a5a50 });
    const dark = new THREE.MeshPhysicalMaterial({ color: 0x050403, roughness: 0.1, clearcoat: 1 });
    const red = new THREE.MeshStandardMaterial({ color: 0xa8161b, roughness: 0.7 });
    const lacq = new THREE.MeshPhysicalMaterial({ color: 0x120c0a, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.1 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xc9a043, roughness: 0.3, metalness: 0.9 });
    const fur = new THREE.MeshStandardMaterial({ map: furTexture(), roughness: 0.95 });
    const leather = new THREE.MeshStandardMaterial({ color: 0x1c1410, roughness: 0.6 });

    // 目
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.021, 14, 10), dark);
      eye.scale.set(1.2, 0.9, 0.8);
      at('head', eye, [1.043, 1.873, s * 0.094]);
    }

    // たてがみ：鬣の付け根から右側へ垂れる毛の板（2層）
    const crest = (t) => [0.42 + t * 0.5, 1.63 + t * 0.4, 0];
    const hang = new THREE.Vector3(0.12, -0.5, 0.86).normalize();
    for (let layer = 0; layer < 2; layer++) {
      for (let i = 0; i < 26; i++) {
        const t = i / 25;
        const c = crest(t);
        const dir = new THREE.Vector3(0.5, 0.4, 0).normalize();
        const my = hang.clone().negate();
        const mz = new THREE.Vector3().crossVectors(dir, my).normalize();
        const mx = new THREE.Vector3().crossVectors(my, mz);
        const len = 0.2 + Math.random() * 0.1 - layer * 0.05;
        const card = new THREE.Mesh(new THREE.PlaneGeometry(0.09, len), hairMat);
        card.geometry.translate(0, -len / 2, 0);
        card.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(mx, my, mz));
        card.rotateX((Math.random() - 0.5) * 0.3 + layer * 0.25);
        at(t < 0.55 ? 'neck1' : 'neck2', card, [c[0] - 0.02, c[1] + 0.035 - layer * 0.01, 0.015 + layer * 0.01]);
      }
    }
    // 前髪
    for (let i = 0; i < 3; i++) {
      const card = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.16), hairMat);
      card.geometry.translate(0, -0.08, 0);
      card.rotation.set(0, Math.PI / 2 + (i - 1) * 0.4, 0.6);
      at('head', card, [0.97, 2.05, (i - 1) * 0.02]);
    }
    // 尾：根元から垂れる毛の束
    const tailHair = new THREE.Group();
    at('tail', tailHair, [-0.92, 1.33, 0]);
    for (let i = 0; i < 12; i++) {
      const len = 0.75 + Math.random() * 0.25;
      const card = new THREE.Mesh(new THREE.PlaneGeometry(0.16 + Math.random() * 0.08, len), hairMat);
      card.geometry.translate(0, -len / 2, 0);
      card.rotation.set(0, (i / 12) * Math.PI, (Math.random() - 0.5) * 0.2);
      card.rotation.order = 'YXZ';
      card.rotation.z += -0.25;
      tailHair.add(card);
    }

    // 面繋（赤い紐）・轡
    const faceDir = new THREE.Vector3(0.21, -0.32, 0).normalize();
    const ringQ = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), faceDir);
    const ring = (p, ry, rz) => {
      const t = new THREE.Mesh(new THREE.TorusGeometry(1, 0.011 / Math.min(ry, rz), 6, 24), red);
      t.quaternion.copy(ringQ);
      t.scale.set(ry, rz, Math.min(ry, rz));
      return at('head', t, p);
    };
    ring([1.17, 1.63, 0], 0.075, 0.08);   // 鼻革
    ring([0.98, 1.95, 0], 0.115, 0.11);  // 項革
    for (const s of [-1, 1]) {
      const cheek = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.36, 5), red);
      cheek.rotation.z = 0.55;
      at('head', cheek, [1.07, 1.79, s * 0.085]);
      const bit = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.005, 6, 12), gold);
      at('head', bit, [1.2, 1.53, s * 0.072]);
    }

    // 和鞍・障泥・鐙
    const saddle = loft([
      { s: -0.22, c: 0.0, a: 0.05, b: 0.2 },
      { s: 0.0, c: -0.02, a: 0.05, b: 0.27 },
      { s: 0.25, c: 0.0, a: 0.05, b: 0.25 },
    ], { axis: 'x', radial: 18, per: 3 });
    at('body', new THREE.Mesh(saddle, lacq), [0.06, 1.62, 0]);
    for (const [x, hh] of [[0.29, 0.17], [-0.14, 0.2]]) {
      const arch = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.035, 8, 20, Math.PI), lacq);
      arch.rotation.y = Math.PI / 2;
      arch.scale.set(1.3, hh / 0.2, 1);
      at('body', arch, [x, 1.6, 0]);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.01, 6, 20, Math.PI), gold);
      rim.rotation.y = Math.PI / 2;
      rim.scale.set(1.3, hh / 0.2, 1);
      at('body', rim, [x + (x > 0 ? 0.035 : -0.035), 1.6, 0]);
    }
    for (const s of [-1, 1]) {
      const aori = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.5, 0.02), fur);
      aori.rotation.x = s * -0.22;
      at('body', aori, [0.06, 1.33, s * 0.335]);
      const abumi = new THREE.Mesh(loft([
        { s: -0.05, c: 0, a: 0.05, b: 0.06 }, { s: 0.15, c: 0.01, a: 0.04, b: 0.07 }, { s: 0.26, c: 0.03, a: 0.03, b: 0.06 },
      ], { axis: 'x', radial: 12, per: 3 }), lacq);
      at('body', abumi, [0.12, 1.08, s * 0.4]);
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.5, 0.012), leather);
      strap.rotation.x = s * -0.12;
      at('body', strap, [0.13, 1.36, s * 0.36]);
      // 腹帯
      const girth = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.01), leather);
      girth.rotation.x = s * 0.35;
      at('body', girth, [0.28, 1.1, s * 0.25]);
    }
    // 胸繋・鞦（赤い紐と厚総）
    const chest = new THREE.Mesh(new THREE.TorusGeometry(1, 0.022 / 0.25, 6, 32, Math.PI), red);
    chest.rotation.y = Math.PI / 2;
    chest.rotation.z = Math.PI;
    chest.scale.set(0.26, 0.24, 0.3);
    at('body', chest, [0.74, 1.28, 0]);
    const rump = new THREE.Mesh(new THREE.TorusGeometry(1, 0.022 / 0.33, 6, 32, Math.PI), red);
    rump.rotation.y = Math.PI / 2;
    rump.scale.set(0.34, 0.33, 0.33);
    at('body', rump, [-0.66, 1.33, 0]);
    this.tassels = [];
    for (let i = 0; i < 9; i++) {
      const a = 0.25 + (i / 8) * (Math.PI - 0.5);
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.065, 0.34, 10), red);
      t.geometry.translate(0, -0.17, 0);
      at('body', t, [-0.68, 1.33 + Math.sin(a) * 0.32 - 0.04, Math.cos(a) * 0.35]);
      this.tassels.push(t);
    }
    for (let i = 0; i < 5; i++) {
      const a = 0.3 + (i / 4) * (Math.PI - 0.6);
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.05, 0.26, 10), red);
      t.geometry.translate(0, -0.13, 0);
      at('body', t, [0.77, 1.28 - Math.sin(a) * 0.24 + 0.02, Math.cos(a) * 0.28]);
      this.tassels.push(t);
    }

    this.saddleAnchor = new THREE.Group();
    at('body', this.saddleAnchor, [0.06, 1.69, 0]);

    this.legs = LEGS.map(([n, front, s, off]) => ({
      name: n, front, off,
      x: front ? 0.6 : -0.56, z: s * 0.16,
      b0: this.bones[n + '0'], b1: this.bones[n + '1'], b2: this.bones[n + '2'],
      lastQ: 0,
    }));
    this.phase = 0;
    this.amp = 0;
    this.bob = 0;
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
      let ua, la, fa;
      const A = L.front ? 0.5 : 0.42;
      if (q < D) {
        // 接地：脚が後ろへ送られ、球節が沈み、蹄は地面に平ら
        const s = q / D;
        ua = THREE.MathUtils.lerp(A, -A, s);
        la = L.front ? 0.05 * Math.sin(s * Math.PI) : -0.12 * Math.sin(s * Math.PI);
        fa = -(ua + la) + (L.front ? -0.25 : -0.2) * Math.sin(s * Math.PI);
      } else {
        // 遊脚：膝・飛節を畳んで前へ振り出す
        const s = (q - D) / (1 - D);
        const e = 0.5 - 0.5 * Math.cos(s * Math.PI);
        ua = THREE.MathUtils.lerp(-A, A * 1.05, e);
        la = L.front ? -1.55 * Math.sin(s * Math.PI) : -0.95 * Math.sin(s * Math.PI);
        fa = (L.front ? 0.55 : 0.45) * Math.sin(s * Math.PI * 0.9) - 0.15 * (1 - s);
      }
      const idle = Math.sin(t * 0.8 + L.off * 9) * 0.015;
      L.b0.rotation.z = ua * a + idle * (1 - a);
      L.b1.rotation.z = la * a;
      L.b2.rotation.z = fa * a;
    }
    const w = Math.PI * 2 * p;
    this.bob = (Math.sin(w - 1.2) * 0.07 - 0.055) * a;
    this.body.position.y = this.baseY + this.bob + Math.sin(t * 1.3) * 0.004 * (1 - a);
    this.body.rotation.z = Math.sin(w + 0.6) * 0.065 * a;
    this.body.rotation.x = Math.sin(w * 0.5) * 0.012 * a;
    // 首は襲歩で前へ伸び、拍子に合わせて上下
    this.bones.neck1.rotation.z = -0.16 * a + Math.sin(w + 2.2) * 0.09 * a + Math.sin(t * 0.5) * 0.03 * (1 - a);
    this.bones.neck2.rotation.z = -0.06 * a + Math.sin(w + 2.5) * 0.05 * a;
    this.bones.head.rotation.z = 0.12 * a + Math.sin(w + 2.9) * 0.06 * a + Math.sin(t * 0.7) * 0.04 * (1 - a);
    this.bones.head.rotation.y = Math.sin(t * 0.37) * 0.08 * (1 - a);
    this.tail.rotation.z = -0.15 - 0.55 * a + Math.sin(w * 2) * 0.08 * a;
    this.tail.rotation.x = Math.sin(t * 2.1) * 0.12;
    for (let i = 0; i < this.tassels.length; i++) {
      this.tassels[i].rotation.z = 0.3 * a + Math.sin(w + i) * 0.25 * a;
    }
    return events;
  }
}
