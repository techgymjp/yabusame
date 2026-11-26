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
