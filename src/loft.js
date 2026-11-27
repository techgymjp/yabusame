// 断面を補間してなめらかな曲面を作る（馬体・人体用）
import * as THREE from 'three';

function catmull(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}
function sampleStations(st, per) {
  const keys = Object.keys(st[0]).filter(k => typeof st[0][k] === 'number');
  const out = [];
  for (let i = 0; i < st.length - 1; i++) {
    const a = st[Math.max(0, i - 1)], b = st[i], c = st[i + 1], d = st[Math.min(st.length - 1, i + 2)];
    for (let j = 0; j < per; j++) {
      const t = j / per;
      const o = {};
      for (const k of keys) o[k] = catmull(a[k], b[k], c[k], d[k], t);
      o.color = (b.color || 0) && new THREE.Color(b.color).lerp(new THREE.Color(c.color ?? b.color), t);
      out.push(o);
    }
  }
  const last = st[st.length - 1];
  out.push({ ...last, color: last.color !== undefined ? new THREE.Color(last.color) : 0 });
  return out;
}
const se = (v, n) => Math.sign(v) * Math.pow(Math.abs(v), 2 / n);

// axis 'x'：断面は YZ 平面（s=x, c=中心y, a=半高さ(y), b=半幅(z)）
// axis 'y'：断面は XZ 平面（s=y, c=中心x, a=半奥行き(x), b=半幅(z)）
export function loft(stations, { axis = 'x', radial = 28, per = 5, nTop = 2.4, nBottom = 2.0, capStart = true, capEnd = true } = {}) {
  const S = sampleStations(stations, per);
  const pos = [], col = [], uv = [], idx = [];
  const hasColor = stations[0].color !== undefined;
  S.forEach((st, i) => {
    for (let j = 0; j < radial; j++) {
      const th = (j / radial) * Math.PI * 2;
      const sn = Math.sin(th), cs = Math.cos(th);
      const u = se(sn, sn >= 0 ? nTop : nBottom) * st.a;
      const w = se(cs, 2.2) * st.b;
      if (axis === 'x') pos.push(st.s, st.c + u, w);
      else pos.push(st.c - u, st.s, w);
      if (hasColor) col.push(st.color.r, st.color.g, st.color.b);
      uv.push(j / radial, i / (S.length - 1));
    }
  });
  const asc = S[S.length - 1].s > S[0].s;
  for (let i = 0; i < S.length - 1; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * radial + j, b = i * radial + ((j + 1) % radial);
      const c = a + radial, d = b + radial;
      if (asc) idx.push(a, c, b, b, c, d);
      else idx.push(a, b, c, b, d, c);
    }
  }
  const cap = (ring, flip) => {
    const st = S[ring];
    const ci = pos.length / 3;
    const off = (flip ? 1 : -1) * (asc ? 1 : -1) * 0.01;
    if (axis === 'x') pos.push(st.s + off, st.c, 0);
    else pos.push(st.c, st.s + off, 0);
    if (hasColor) col.push(st.color.r, st.color.g, st.color.b);
    uv.push(0.5, ring ? 1 : 0);
    for (let j = 0; j < radial; j++) {
      const a = ring * radial + j, b = ring * radial + ((j + 1) % radial);
      if ((!flip) === asc) idx.push(ci, a, b); else idx.push(ci, b, a);
    }
  };
  if (capStart) cap(0, false);
  if (capEnd) cap(S.length - 1, true);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (hasColor) geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}
