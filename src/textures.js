// 手続き的に生成するテクスチャ群（外部画像ファイルを使わない）
import * as THREE from 'three';

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function rand(a, b) {
  return a + Math.random() * (b - a);
}

function finish(canvas, { repeat = [1, 1], srgb = true, aniso = 8 } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat[0], repeat[1]);
  tex.anisotropy = aniso;
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

// 秋の芝生
export function grassTexture(repeat) {
  const s = 512;
  const c = makeCanvas(s, s);
  const g = c.getContext('2d');
  g.fillStyle = '#5f6b34';
  g.fillRect(0, 0, s, s);
  // 大きなむら
  for (let i = 0; i < 60; i++) {
    const r = rand(30, 90);
    const x = rand(0, s), y = rand(0, s);
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    const hue = rand(55, 85);
    grd.addColorStop(0, `hsla(${hue},35%,${rand(22, 38)}%,0.35)`);
    grd.addColorStop(1, `hsla(${hue},35%,30%,0)`);
    g.fillStyle = grd;
    for (const dx of [-s, 0, s]) for (const dy of [-s, 0, s]) {
      g.save(); g.translate(dx, dy); g.fillRect(x - r, y - r, r * 2, r * 2); g.restore();
    }
  }
  // 草の葉
  for (let i = 0; i < 26000; i++) {
    const x = rand(0, s), y = rand(0, s);
    const hue = rand(48, 95);
    g.strokeStyle = `hsla(${hue},${rand(25, 50)}%,${rand(18, 48)}%,${rand(0.4, 0.9)})`;
    g.lineWidth = rand(0.6, 1.6);
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + rand(-2, 2), y - rand(2, 6));
    g.stroke();
  }
  return finish(c, { repeat });
}

// 馬場の砂
export function sandTexture(repeat) {
  const w = 512, h = 256;
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  g.fillStyle = '#a98b5f';
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 40; i++) {
    const x = rand(0, w), y = rand(0, h), r = rand(20, 70);
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, `rgba(${rand(110, 170)},${rand(85, 130)},${rand(55, 90)},0.35)`);
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // 蹄で掘り返された筋（進行方向 = テクスチャのu方向）
  for (let i = 0; i < 260; i++) {
    const y = rand(0, h);
    const x = rand(0, w);
    g.strokeStyle = `rgba(${rand(80, 120)},${rand(60, 90)},${rand(35, 60)},${rand(0.08, 0.22)})`;
    g.lineWidth = rand(1, 4);
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + rand(30, 140), y + rand(-3, 3));
    g.stroke();
  }
  for (let i = 0; i < 9000; i++) {
    const v = rand(120, 230);
    g.fillStyle = `rgba(${v},${v * 0.85},${v * 0.65},${rand(0.2, 0.7)})`;
    g.fillRect(rand(0, w), rand(0, h), rand(0.5, 2), rand(0.5, 2));
  }
  // 蹄跡
  for (let i = 0; i < 30; i++) {
    const x = rand(0, w), y = h / 2 + rand(-40, 40);
    g.fillStyle = 'rgba(70,50,30,0.25)';
    g.beginPath();
    g.ellipse(x, y, 6, 5, 0, 0, Math.PI * 2);
    g.fill();
  }
  return finish(c, { repeat });
}

export function woodTexture(repeat = [1, 1], base = '#6e4c2c') {
  const w = 128, h = 512;
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 70; i++) {
    const x = rand(0, w);
    g.strokeStyle = `rgba(${rand(20, 60)},${rand(10, 40)},${rand(0, 20)},${rand(0.15, 0.4)})`;
    g.lineWidth = rand(0.5, 2.5);
    g.beginPath();
    g.moveTo(x, 0);
    for (let y = 0; y <= h; y += 32) g.lineTo(x + Math.sin(y * 0.02 + i) * rand(1, 4), y);
    g.stroke();
  }
  return finish(c, { repeat });
}

// 的（檜板に同心円）
export function targetTexture() {
  const s = 512;
  const c = makeCanvas(s, s);
  const g = c.getContext('2d');
  g.fillStyle = '#e2c99a';
  g.fillRect(0, 0, s, s);
  for (let i = 0; i < 60; i++) {
    const y = rand(0, s);
    g.strokeStyle = `rgba(150,105,60,${rand(0.1, 0.3)})`;
    g.lineWidth = rand(0.5, 2);
    g.beginPath();
    g.moveTo(0, y);
    for (let x = 0; x <= s; x += 32) g.lineTo(x, y + Math.sin(x * 0.015 + i) * 3);
    g.stroke();
  }
  const rings = [
    [236, '#1b1b1b'],
    [200, '#f3efe4'],
    [148, '#1b1b1b'],
    [108, '#f3efe4'],
    [58, '#b8231d'],
  ];
  for (const [r, col] of rings) {
    g.fillStyle = col;
    g.beginPath();
    g.arc(s / 2, s / 2, r, 0, Math.PI * 2);
    g.fill();
  }
  // 墨のかすれ
  for (let i = 0; i < 1600; i++) {
    g.fillStyle = `rgba(255,250,240,${rand(0.02, 0.08)})`;
    g.fillRect(rand(0, s), rand(0, s), rand(1, 3), rand(1, 3));
  }
  return finish(c, { repeat: [1, 1] });
}

// 紅白幕
export function curtainTexture() {
  const w = 512, h = 128;
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  const n = 8;
  for (let i = 0; i < n; i++) {
    g.fillStyle = i % 2 ? '#f5f2ec' : '#c3202c';
    g.fillRect((i * w) / n, 0, w / n, h);
  }
  for (let i = 0; i < n * 2; i++) {
    g.fillStyle = 'rgba(0,0,0,0.07)';
    g.fillRect((i * w) / (n * 2) + 4, 0, 6, h);
  }
  return finish(c, { repeat: [1, 1] });
}

// 幟（のぼり）
export function bannerTexture(text, bg = '#f4f0e6', fg = '#b01c22') {
  const w = 128, h = 512;
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  g.fillStyle = fg;
  g.fillRect(0, 0, w, 30);
  g.fillRect(0, h - 18, w, 18);
  g.font = 'bold 72px "Yuji Syuku", "Shippori Mincho", serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#1a1a1a';
  const chars = [...text];
  const step = (h - 90) / chars.length;
  chars.forEach((ch, i) => g.fillText(ch, w / 2, 60 + step * (i + 0.5)));
  const t = finish(c, { repeat: [1, 1] });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

export function signTexture(text) {
  const w = 256, h = 128;
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  g.fillStyle = '#e9dcc0';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = '#5a3d22';
  g.lineWidth = 8;
  g.strokeRect(4, 4, w - 8, h - 8);
  g.font = 'bold 70px "Yuji Syuku", "Shippori Mincho", serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#1a1a1a';
  g.fillText(text, w / 2, h / 2 + 4);
  const t = finish(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// 砂埃・木片用の柔らかい丸
export function puffTexture() {
  const s = 64;
  const c = makeCanvas(s, s);
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grd.addColorStop(0, 'rgba(255,255,255,0.9)');
  grd.addColorStop(0.4, 'rgba(255,255,255,0.45)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// 直垂（ひたたれ）の文様
export function robeTexture(base = '#2f4a3a', pattern = '#c9b37a') {
  const s = 256;
  const c = makeCanvas(s, s);
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, s, s);
  g.strokeStyle = pattern;
  g.globalAlpha = 0.5;
  g.lineWidth = 3;
  for (let y = 0; y < s; y += 64) {
    for (let x = 0; x < s; x += 64) {
      const ox = (y / 64) % 2 ? 32 : 0;
      g.beginPath();
      g.arc(x + ox + 32, y + 32, 14, 0, Math.PI * 2);
      g.stroke();
      g.beginPath();
      g.arc(x + ox + 32, y + 32, 6, 0, Math.PI * 2);
      g.stroke();
    }
  }
  return finish(c, { repeat: [2, 2] });
}

// 行縢（むかばき）用の鹿の毛皮
export function furTexture() {
  const s = 256;
  const c = makeCanvas(s, s);
  const g = c.getContext('2d');
  g.fillStyle = '#9a7449';
  g.fillRect(0, 0, s, s);
  for (let i = 0; i < 5000; i++) {
    const x = rand(0, s), y = rand(0, s);
    const v = rand(0.6, 1.3);
    g.strokeStyle = `rgba(${150 * v},${112 * v},${70 * v},0.5)`;
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + rand(-1, 1), y + rand(3, 7));
    g.stroke();
  }
  // 鹿の子斑
  for (let i = 0; i < 40; i++) {
    g.fillStyle = 'rgba(240,230,210,0.75)';
    g.beginPath();
    g.ellipse(rand(0, s), rand(0, s), rand(3, 6), rand(4, 8), 0, 0, Math.PI * 2);
    g.fill();
  }
  return finish(c, { repeat: [1, 1] });
}

// ---------- 高品質化用：ノイズ・法線マップ・葉カード ----------

// 値ノイズ（タイル可能）
function makeNoise(size, seed = 1) {
  let s = seed * 9301 + 49297;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const g = new Float32Array(size * size);
  for (let i = 0; i < g.length; i++) g[i] = rnd();
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const a = g[((yi % size + size) % size) * size + ((xi % size + size) % size)];
    const b = g[((yi % size + size) % size) * size + (((xi + 1) % size + size) % size)];
    const c = g[(((yi + 1) % size + size) % size) * size + ((xi % size + size) % size)];
    const d = g[(((yi + 1) % size + size) % size) * size + (((xi + 1) % size + size) % size)];
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}
function fbm(noise, x, y, oct, baseFreq) {
  let v = 0, amp = 0.5, f = 1;
  for (let o = 0; o < oct; o++) {
    v += noise(x * f, y * f) * amp;
    amp *= 0.5; f *= 2;
  }
  return v;
}

// 高さ配列から法線マップ（タイル可能）
function heightToNormal(h, w, hh, strength) {
  const c = makeCanvas(w, hh);
  const g = c.getContext('2d');
  const img = g.createImageData(w, hh);
  for (let y = 0; y < hh; y++) {
    for (let x = 0; x < w; x++) {
      const l = h[y * w + ((x - 1 + w) % w)], r = h[y * w + ((x + 1) % w)];
      const u = h[((y - 1 + hh) % hh) * w + x], d = h[((y + 1) % hh) * w + x];
      let nx = (l - r) * strength, ny = (d - u) * strength, nz = 1;
      const len = Math.hypot(nx, ny, nz);
      const i = (y * w + x) * 4;
      img.data[i] = ((nx / len) * 0.5 + 0.5) * 255;
      img.data[i + 1] = ((ny / len) * 0.5 + 0.5) * 255;
      img.data[i + 2] = ((nz / len) * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

// 地表（草地の下地・砂・土）の PBR セット
export function groundSet(kind, repeat, S = 512) {
  const noise = makeNoise(64, kind === 'sand' ? 3 : kind === 'path' ? 7 : 5);
  const noise2 = makeNoise(128, 11);
  const h = new Float32Array(S * S);
  const c = makeCanvas(S, S);
  const g = c.getContext('2d');
  const img = g.createImageData(S, S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = x / S, v = y / S;
      const n1 = fbm(noise, u * 8, v * 8, 5);
      const n2 = noise2(u * 128, v * 128);
      let r, gg, b, height;
      if (kind === 'sand') {
        // 蹄で掘り返された砂：進行方向（u）に伸びた筋と粒
        const streak = fbm(noise, u * 3, v * 24, 4);
        const pebble = n2 > 0.86 ? (n2 - 0.86) * 6 : 0;
        height = streak * 0.6 + n2 * 0.35 + pebble;
        const k = 0.72 + streak * 0.35 + (n2 - 0.5) * 0.18 - pebble * 0.3;
        r = 178 * k; gg = 146 * k; b = 104 * k;
      } else if (kind === 'path') {
        height = n1 * 0.6 + n2 * 0.4;
        const k = 0.75 + n1 * 0.35 + (n2 - 0.5) * 0.15;
        r = 150 * k; gg = 128 * k; b = 96 * k;
      } else {
        // 草地の下地（枯れ草と土の混じり）
        const dirt = THREE.MathUtils.smoothstep(n1, 0.55, 0.75);
        height = n1 * 0.5 + n2 * 0.5;
        const k = 0.7 + (n2 - 0.5) * 0.5;
        const grR = 92 + n1 * 40, grG = 104 + n1 * 30, grB = 48;
        r = (grR * (1 - dirt) + 120 * dirt) * k;
        gg = (grG * (1 - dirt) + 98 * dirt) * k;
        b = (grB * (1 - dirt) + 66 * dirt) * k;
      }
      h[y * S + x] = height;
      const i = (y * S + x) * 4;
      img.data[i] = r; img.data[i + 1] = gg; img.data[i + 2] = b; img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const map = finish(c, { repeat });
  const normalMap = finish(heightToNormal(h, S, S, kind === 'sand' ? 5 : 3), { repeat, srgb: false });
  return { map, normalMap };
}

// 樹皮（杉の縦に裂けた皮）
export function barkSet() {
  const W = 256, H = 512;
  const noise = makeNoise(64, 21);
  const h = new Float32Array(W * H);
  const c = makeCanvas(W, H);
  const g = c.getContext('2d');
  const img = g.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const u = x / W, v = y / H;
      const fib = fbm(noise, u * 22, v * 3, 4);
      const crack = Math.pow(Math.abs(Math.sin((u * 14 + fbm(noise, u * 4, v * 6, 3) * 2) * Math.PI)), 0.35);
      const height = fib * 0.6 + crack * 0.5;
      h[y * W + x] = height;
      const k = 0.45 + height * 0.55;
      const i = (y * W + x) * 4;
      img.data[i] = 128 * k; img.data[i + 1] = 84 * k; img.data[i + 2] = 60 * k; img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return {
    map: finish(c, { repeat: [2, 6] }),
    normalMap: finish(heightToNormal(h, W, H, 6), { repeat: [2, 6], srgb: false }),
  };
}

// 杉の葉の房（アルファ付き、白基調でインスタンス色で着色）
export function needleCardTexture() {
  const S = 256;
  const c = makeCanvas(S, S);
  const g = c.getContext('2d');
  g.clearRect(0, 0, S, S);
  const branch = (x, y, ang, len, w, depth) => {
    const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
    g.strokeStyle = `rgb(${60 + depth * 20},${70 + depth * 25},${50 + depth * 10})`;
    g.lineWidth = w;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke();
    // 細かい葉
    const n = Math.floor(len / 3);
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const px = x + (x2 - x) * t, py = y + (y2 - y) * t;
      for (const s of [-1, 1]) {
        const a = ang + s * (0.6 + Math.random() * 0.3);
        const l = (1 - t * 0.6) * (7 + Math.random() * 5);
        const v = 150 + Math.random() * 105;
        g.strokeStyle = `rgba(${v},${v},${v},0.95)`;
        g.lineWidth = 1.6;
        g.beginPath(); g.moveTo(px, py); g.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); g.stroke();
      }
    }
    if (depth < 2) {
      for (let i = 1; i <= 3; i++) {
        const t = i / 4;
        branch(x + (x2 - x) * t, y + (y2 - y) * t, ang + (i % 2 ? 0.7 : -0.7), len * 0.45, w * 0.6, depth + 1);
      }
    }
  };
  for (let k = 0; k < 5; k++) branch(S / 2, S * 0.95, -Math.PI / 2 + (k - 2) * 0.35, S * 0.55, 3, 0);
  const t = finish(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// 広葉（もみじ）の葉カード：白基調
export function leafCardTexture() {
  const S = 256;
  const c = makeCanvas(S, S);
  const g = c.getContext('2d');
  const leaf = (x, y, r, rot) => {
    g.save();
    g.translate(x, y);
    g.rotate(rot);
    const v = 170 + Math.random() * 85;
    g.fillStyle = `rgb(${v},${v},${v})`;
    g.beginPath();
    for (let i = 0; i <= 14; i++) {
      // 七裂のもみじ形
      const a = (i / 14) * Math.PI * 2;
      const rr = i % 2 ? r * 0.45 : r;
      g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    g.closePath();
    g.fill();
    g.restore();
  };
  for (let i = 0; i < 160; i++) {
    const a = Math.random() * Math.PI * 2;
    const d = Math.sqrt(Math.random()) * S * 0.44;
    leaf(S / 2 + Math.cos(a) * d, S / 2 + Math.sin(a) * d, 7 + Math.random() * 7, Math.random() * 6);
  }
  const t = finish(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// 毛（たてがみ・尾）
export function hairCardTexture() {
  const W = 64, H = 256;
  const c = makeCanvas(W, H);
  const g = c.getContext('2d');
  for (let i = 0; i < 90; i++) {
    const x = Math.random() * W;
    const len = H * (0.6 + Math.random() * 0.4);
    const v = 10 + Math.random() * 30;
    g.strokeStyle = `rgba(${v + 8},${v},${v - 4},${0.5 + Math.random() * 0.5})`;
    g.lineWidth = 1 + Math.random() * 1.5;
    g.beginPath();
    g.moveTo(x, 0);
    g.bezierCurveTo(x + Math.random() * 8 - 4, len * 0.4, x + Math.random() * 12 - 6, len * 0.7, x + Math.random() * 16 - 8, len);
    g.stroke();
  }
  const t = finish(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// 蹄跡（デカール）
export function hoofPrintTexture() {
  const S = 64;
  const c = makeCanvas(S, S);
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(S / 2, S / 2, 4, S / 2, S / 2, S / 2);
  grd.addColorStop(0, 'rgba(60,42,26,0.75)');
  grd.addColorStop(0.55, 'rgba(70,50,30,0.55)');
  grd.addColorStop(0.7, 'rgba(200,170,120,0.35)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.beginPath();
  g.ellipse(S / 2, S / 2, S * 0.42, S * 0.36, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(40,28,16,0.5)';
  g.beginPath();
  g.ellipse(S * 0.58, S / 2, S * 0.12, S * 0.2, 0, 0, Math.PI * 2);
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
