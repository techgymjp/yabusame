import * as THREE from 'three';
import { buildWorld, COURSE, updateFlags, updateCrowd, exciteCrowd } from './world.js';
import { Horse, Rider } from './horse.js';
import {
  ViewModel, FlyingArrow, integrateArrow, segmentHitsBoard, shatterBoard, updatePieces, ARROW_PHYS, BOW,
} from './archery.js';
import { Sound } from './audio.js';
import { puffTexture } from './textures.js';

const DIFF = {
  easy: {
    arrows: 5, speed: 12, sway: 0.55, nock: 0.9, reticle: 'impact', wind: 1.0, spread: 0.0015,
    note: '矢5本・馬速 約43km/h・着弾予測を表示',
  },
  normal: {
    arrows: 4, speed: 14, sway: 1.0, nock: 1.1, reticle: 'dot', wind: 2.2, spread: 0.003,
    note: '矢4本・馬速 約50km/h・照準点のみ表示（馬の速度ぶん矢は前へ流れる）',
  },
  hard: {
    arrows: 3, speed: 15.5, sway: 1.3, nock: 1.25, reticle: 'none', wind: 3.5, spread: 0.0045,
    note: '一的一矢の本式・馬速 約56km/h・照準表示なし',
  },
};

const $ = id => document.getElementById(id);
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 保存不可でも続行 */ } },
};

// ---------- レンダラ ----------
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.62;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.03, 5000);
scene.add(camera);

const world = buildWorld(scene, renderer);
const horse = new Horse();
scene.add(horse.root);
horse.root.traverse(o => { if (o.isMesh) { o.castShadow = true; } });
const rider = new Rider(horse);
rider.attachProps(scene);
const vm = new ViewModel(camera);
const sound = new Sound();

// 砂埃
const dustTex = puffTexture();
const dust = [];
for (let i = 0; i < 160; i++) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: dustTex, color: 0xc2a77c, transparent: true, depthWrite: false, opacity: 0,
  }));
  s.visible = false;
  scene.add(s);
  dust.push({ s, life: 0, max: 1, vel: new THREE.Vector3(), size: 1 });
}
let dustIdx = 0;
function spawnDust(pos, vel, size, life, color = 0xc2a77c, opacity = 0.5) {
  const d = dust[dustIdx++ % dust.length];
  d.s.position.copy(pos);
  d.vel.copy(vel);
  d.size = size;
  d.life = d.max = life;
  d.s.material.color.setHex(color);
  d.s.material.userData.op = opacity;
  d.s.visible = true;
}
function updateDust(dt) {
  for (const d of dust) {
    if (d.life <= 0) continue;
    d.life -= dt;
    if (d.life <= 0) { d.s.visible = false; continue; }
    const k = 1 - d.life / d.max;
    d.vel.multiplyScalar(1 - dt * 1.8);
    d.vel.y -= dt * 0.3;
    d.s.position.addScaledVector(d.vel, dt);
    const sc = d.size * (0.5 + k * 1.6);
    d.s.scale.set(sc, sc, sc);
    d.s.material.opacity = d.s.material.userData.op * Math.sin(Math.min(1, k * 4) * Math.PI / 2) * (1 - k);
  }
}

// ---------- 状態 ----------
const G = {
  state: 'loading', // title / ready / run / finish / result / paused
  prevState: null,
  diffKey: store.get('yabusame.diff') || 'normal',
  sens: store.get('yabusame.sens') || 1,
  fp: true,
  x: COURSE.runup, z: 0, speed: 0,
  yaw: 0.55, pitch: -0.08,
  wantDraw: false, release: false,
  draw: 0, raise: 0, nocked: 1, nockTimer: 0, holdFull: 0, creaked: 0,
  arrowsLeft: 3,
  arrows: [], pieces: [],
  results: [],
  wind: new THREE.Vector3(),
  t0: null, finalTime: null, runTime: 0,
  timeScale: 1, slowmo: 0,
  finishTimer: 0,
  keys: {},
  clock: 0,
  msgTimer: 0,
};
const diff = () => DIFF[G.diffKey];

// ---------- UI ----------
const hudTargets = $('hud-targets');
COURSE.targets.forEach((t, i) => {
  const d = document.createElement('div');
  d.className = 't';
  d.textContent = '一二三'[i];
  hudTargets.appendChild(d);
});
const track = $('progress-track');
const span = COURSE.stop - COURSE.runup;
const prog = x => ((x - COURSE.runup) / span) * 100;
for (const x of [COURSE.start, COURSE.end]) {
  const s = document.createElement('span');
  s.style.left = prog(x) + '%';
  track.appendChild(s);
}
for (const t of COURSE.targets) {
  const s = document.createElement('span');
  s.className = 'tg';
  s.style.left = prog(t.x) + '%';
  track.appendChild(s);
}

function setDiff(k) {
  G.diffKey = k;
  store.set('yabusame.diff', k);
  document.querySelectorAll('#difficulty button').forEach(b => b.classList.toggle('on', b.dataset.v === k));
  $('diffnote').textContent = DIFF[k].note;
  const best = store.get('yabusame.best.' + k);
  $('best').textContent = best ? `最高記録（${{ easy: '初級', normal: '中級', hard: '本式' }[k]}）: ${best} 点` : '';
}
document.querySelectorAll('#difficulty button').forEach(b => b.addEventListener('click', () => setDiff(b.dataset.v)));
$('sens').value = G.sens;
$('sens').addEventListener('input', e => { G.sens = +e.target.value; store.set('yabusame.sens', G.sens); });

function show(id, on) { $(id).classList.toggle('hidden', !on); }

let msgTimeout = null;
function message(html, ms = 1600, cls = '') {
  const m = $('message');
  m.innerHTML = html;
  m.className = 'show ' + cls;
  clearTimeout(msgTimeout);
  msgTimeout = setTimeout(() => (m.className = cls), ms);
}
function hint(text) { $('hint').textContent = text || ''; }

const isTouch = matchMedia('(pointer: coarse)').matches;

// ---------- 入力 ----------
function lockPointer() {
  if (isTouch) return;
  try {
    const p = canvas.requestPointerLock && canvas.requestPointerLock();
    if (p && p.catch) p.catch(() => {});
  } catch { /* 非対応環境 */ }
}
const locked = () => document.pointerLockElement === canvas;

document.addEventListener('mousemove', e => {
  if (!['ready', 'run', 'finish'].includes(G.state)) return;
  if (!locked() && !G.dragAim) return;
  aim(e.movementX, e.movementY);
});
function aim(dx, dy) {
  const k = 0.0022 * G.sens * (G.raise > 0.8 ? 0.8 : 1);
  G.yaw = THREE.MathUtils.clamp(G.yaw - dx * k, -0.7, 2.7);
  G.pitch = THREE.MathUtils.clamp(G.pitch - dy * k, -0.75, 0.6);
}
canvas.addEventListener('mousedown', e => {
  if (e.button !== 0) return;
  sound.resume();
  if (!locked()) {
    lockPointer();
    G.dragAim = true; // ポインタロックが使えない環境ではドラッグで狙う
  }
  if (G.state === 'ready') { startRun(); return; }
  if (G.state === 'run' || G.state === 'finish') G.wantDraw = true;
});
window.addEventListener('mouseup', e => {
  if (e.button !== 0) return;
  G.dragAim = false;
  if (G.wantDraw) { G.wantDraw = false; G.release = true; }
});
document.addEventListener('pointerlockchange', () => {
  if (!locked() && (G.state === 'run' || G.state === 'ready' || G.state === 'finish') && !isTouch && G.hadLock) pause();
  if (locked()) G.hadLock = true;
});
window.addEventListener('keydown', e => {
  G.keys[e.code] = true;
  if (e.code === 'Space') {
    e.preventDefault();
    if (G.state === 'ready') startRun();
  }
  if (e.code === 'KeyC') toggleCam();
  if (e.code === 'Escape' && G.state === 'paused') resume();
  if (e.code === 'KeyP' && ['run', 'ready', 'finish'].includes(G.state)) pause();
});
window.addEventListener('keyup', e => { G.keys[e.code] = false; });
window.addEventListener('blur', () => { G.keys = {}; });

// タッチ操作
let touchAim = null;
canvas.addEventListener('touchstart', e => {
  sound.resume();
  const t = e.changedTouches[0];
  touchAim = { id: t.identifier, x: t.clientX, y: t.clientY };
  if (G.state === 'ready') startRun();
}, { passive: true });
canvas.addEventListener('touchmove', e => {
  for (const t of e.changedTouches) {
    if (touchAim && t.identifier === touchAim.id) {
      aim((t.clientX - touchAim.x) * 1.6, (t.clientY - touchAim.y) * 1.6);
      touchAim.x = t.clientX; touchAim.y = t.clientY;
    }
  }
}, { passive: true });
canvas.addEventListener('touchend', () => { touchAim = null; }, { passive: true });
$('touch-draw').addEventListener('touchstart', e => { e.preventDefault(); sound.resume(); if (G.state === 'ready') startRun(); else G.wantDraw = true; });
$('touch-draw').addEventListener('touchend', e => { e.preventDefault(); if (G.wantDraw) { G.wantDraw = false; G.release = true; } });
$('touch-cam').addEventListener('touchstart', e => { e.preventDefault(); toggleCam(); });

function toggleCam() {
  G.fp = !G.fp;
  rider.setFirstPerson(G.fp);
  vm.visible = G.fp;
}

// ---------- 画面遷移 ----------
$('start').addEventListener('click', () => { sound.init(); sound.resume(); lockPointer(); newRun(); });
$('again').addEventListener('click', () => { sound.resume(); lockPointer(); newRun(); });
$('toTitle').addEventListener('click', toTitle);
$('quit').addEventListener('click', toTitle);
$('resume').addEventListener('click', resume);

function toTitle() {
  G.state = 'title';
  show('title', true); show('result', false); show('pause', false); show('hud', false); show('touch', false);
  setDiff(G.diffKey);
  resetCourse();
  rider.setFirstPerson(false);
  vm.visible = false;
}
function pause() {
  if (G.state === 'paused') return;
  G.prevState = G.state;
  G.state = 'paused';
  G.wantDraw = false;
  show('pause', true);
}
function resume() {
  if (G.state !== 'paused') return;
  show('pause', false);
  G.state = G.prevState;
  lockPointer();
}

function resetCourse() {
  for (const a of G.arrows) { scene.remove(a.mesh); a.whistle && a.whistle.stop(); }
  for (const p of G.pieces) scene.remove(p.mesh);
  G.arrows = []; G.pieces = [];
  for (const t of world.targets) {
    t.board.visible = true;
    t.done = false;
    t.judge.raise = 0;
  }
  G.x = COURSE.runup; G.z = 0; G.speed = 0;
  G.t0 = null; G.finalTime = null; G.runTime = 0;
}

function newRun() {
  resetCourse();
  const d = diff();
  G.arrowsLeft = d.arrows;
  G.draw = 0; G.raise = 0; G.nocked = 1; G.nockTimer = 0;
  G.yaw = 0.55; G.pitch = -0.08;
  G.results = COURSE.targets.map(t => ({ name: t.name, hit: false, points: 0, r: null }));
  const ang = Math.random() * Math.PI * 2;
  G.wind.set(Math.cos(ang), 0, Math.sin(ang)).multiplyScalar(Math.random() * d.wind);
  G.finishTimer = 0;
  G.state = 'ready';
  G.fp = true;
  rider.setFirstPerson(true);
  vm.visible = true;
  show('title', false); show('result', false); show('pause', false); show('hud', true);
  show('touch', isTouch);
  $('reticle').style.display = d.reticle === 'none' ? 'none' : 'block';
  document.querySelectorAll('#hud-targets .t').forEach(e => (e.className = 't'));
  hint(isTouch ? '「引く」をタップで発進' : 'クリック または スペースで発進');
  const w = G.wind;
  $('hud-wind').innerHTML = `<span style="display:inline-block;transform:rotate(${Math.atan2(w.z, w.x) * 180 / Math.PI}deg)">↑</span> ${w.length().toFixed(1)}<small>m/s</small>`;
  message('馬場入り', 1400);
}

function startRun() {
  if (G.state !== 'ready') return;
  G.state = 'run';
  sound.init();
  sound.drum();
  message('いんよう、いー', 1500);
  hint(isTouch ? '画面をなぞって狙い、「引く」を押して離すと放つ' : '左ボタン長押しで弓を引き、離して放つ ／ W・Sで馬速');
  setTimeout(() => { if (G.state === 'run') hint(''); }, 7000);
}

// ---------- 射撃 ----------
const tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3();
function launchParams(out) {
  // 発射位置と方向（照準点 = 視線上 7m）
  const fwd = camera.getWorldDirection(new THREE.Vector3());
  let from, aimPoint;
  if (G.fp) {
    from = new THREE.Vector3(-0.05, -0.07, -0.85).applyMatrix4(camera.matrixWorld);
    aimPoint = camera.position.clone().addScaledVector(fwd, 7);
  } else {
    from = rider.eye.clone().addScaledVector(G.aimDir, 0.8);
    from.y -= 0.1;
    aimPoint = rider.eye.clone().addScaledVector(G.aimDir, 7);
  }
  const dir = aimPoint.sub(from).normalize();
  out.from = from;
  out.dir = dir;
  return out;
}
function arrowSpeed(draw) {
  return ARROW_PHYS.minSpeed + (ARROW_PHYS.maxSpeed - ARROW_PHYS.minSpeed) * Math.pow(draw, 1.3);
}

function shoot() {
  const d = diff();
  camera.updateMatrixWorld();
  const lp = launchParams({});
  const spread = d.spread * (1 + G.holdTremble * 4);
  lp.dir.x += (Math.random() - 0.5) * 2 * spread;
  lp.dir.y += (Math.random() - 0.5) * 2 * spread;
  lp.dir.z += (Math.random() - 0.5) * 2 * spread;
  lp.dir.normalize();
  const v = lp.dir.multiplyScalar(arrowSpeed(G.draw));
  v.x += G.speed; // 馬の速度は矢に乗る
  const a = new FlyingArrow(scene, lp.from, v);
  a.whistle = sound.whistle();
  G.arrows.push(a);
  sound.twang(G.draw);
  G.arrowsLeft--;
  G.nocked = 0;
  G.nockTimer = 0;
  G.draw = 0;
  G.holdFull = 0;
  G.creaked = 0;
  rider.setQuiver(Math.max(0, G.arrowsLeft - 1));
}

function nearestTargetIndex(x) {
  let best = -1, bd = Infinity;
  world.targets.forEach((t, i) => {
    if (t.done) return;
    const d = Math.abs(t.pos.x - x);
    if (d < bd) { bd = d; best = i; }
  });
  return best;
}

function onHit(target, idx, hit, arrow) {
  target.done = true;
  target.board.visible = false;
  G.pieces.push(...shatterBoard(scene, target, hit, arrow.vel, COURSE.boardSize));
  for (let i = 0; i < 18; i++) {
    spawnDust(hit.point, new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 3, (Math.random() - 0.3) * 3),
      0.18, 0.6 + Math.random() * 0.4, 0xe2c99a, 0.9);
  }
  const center = hit.r < 0.062;
  const pts = 100 + Math.round(60 * Math.max(0, 1 - hit.r / (COURSE.boardSize / 2))) + (center ? 40 : 0);
  G.results[idx] = { name: target.name, hit: true, points: pts, r: hit.r, center };
  document.querySelectorAll('#hud-targets .t')[idx].className = 't hit';
  sound.hit(center);
  exciteCrowd(world.crowd, target.pos.x, center ? 1.3 : 1);
  target.judge.raise = 1;
  target.judge.timer = 2.5;
  G.slowmo = 0.7;
  message(`${target.name}　的中${center ? '<small>正鵠を射る</small>' : ''}`, 1500, 'red');
  // 矢は板を割って勢いを失う
  arrow.vel.multiplyScalar(0.12);
  arrow.vel.y += 1.5;
  arrow.falling = true;
}

function updateArrows(dt) {
  const n = Math.max(1, Math.ceil(dt / 0.003));
  const h = dt / n;
  for (const a of G.arrows) {
    if (!a.alive) continue;
    a.age += dt;
    for (let s = 0; s < n && a.alive; s++) {
      tmpV.copy(a.tip);
      integrateArrow(a.tip, a.vel, G.wind, h);
      if (!a.falling) {
        world.targets.forEach((t, i) => {
          if (t.done || !a.alive || a.falling) return;
          const hit = segmentHitsBoard(tmpV, a.tip, t, COURSE.boardSize);
          if (hit) onHit(t, i, hit, a);
        });
        // 埒（柵）に当たる
        const fz = -COURSE.fenceZ;
        if ((tmpV.z - fz) * (a.tip.z - fz) < 0 && a.tip.y < 1.28 && a.age > 0.02) {
          a.vel.multiplyScalar(-0.08);
          a.falling = true;
          sound.thud();
        }
      }
      if (a.tip.y <= 0.03) {
        a.tip.y = 0.03;
        a.alive = false;
        // 鏑矢は刺さらず地面に転がる
        a.dir.set(a.vel.x, 0, a.vel.z);
        if (a.dir.lengthSq() < 1e-6) a.dir.set(1, 0, 0);
        a.dir.normalize();
        a.mesh.position.copy(a.tip);
        a.place();
        a.mesh.position.y = 0.03;
        if (!a.falling) {
          sound.thud();
          for (let i = 0; i < 4; i++) spawnDust(a.tip, new THREE.Vector3((Math.random() - 0.5), Math.random(), (Math.random() - 0.5)), 0.4, 0.8);
        }
      }
    }
    if (a.alive) {
      if (a.falling) {
        a.spin += dt * 12;
        a.dir.lerp(tmpV2.copy(a.vel).normalize(), Math.min(1, dt * 4)).normalize();
      } else {
        a.dir.copy(a.vel).normalize();
        a.spin += dt * 30;
      }
      a.place();
      if (a.whistle) a.whistle.update(a.vel.length());
    }
    if ((!a.alive || a.falling || a.age > 5) && a.whistle) { a.whistle.stop(); a.whistle = null; }
    if (a.age > 8) a.alive = false;
  }
}

// ---------- 着弾予測（初級） ----------
const projV = new THREE.Vector3();
function predictImpact() {
  const lp = launchParams({});
  const pos = lp.from.clone();
  const vel = lp.dir.multiplyScalar(arrowSpeed(G.draw > 0.3 ? G.draw : 1));
  vel.x += G.speed;
  const prev = new THREE.Vector3();
  for (let i = 0; i < 300; i++) {
    prev.copy(pos);
    integrateArrow(pos, vel, G.wind, 0.005);
    for (const t of world.targets) {
      if (t.done) continue;
      const hit = segmentHitsBoard(prev, pos, t, 1.6);
      if (hit) return hit.point;
    }
    if (pos.y < 0) return pos;
  }
  return null;
}

// ---------- メインループ ----------
let last = performance.now();
const up = new THREE.Vector3(0, 1, 0);
G.aimDir = new THREE.Vector3(1, 0, 0);
G.holdTremble = 0;

function update(dt, rdt) {
  const d = diff();
  const t = G.clock;

  // 馬の速度
  let target = 0;
  if (G.state === 'run') {
    target = d.speed;
    if (G.keys.KeyW || G.keys.ArrowUp) target *= 1.18;
    if (G.keys.KeyS || G.keys.ArrowDown) target *= 0.8;
    if (G.x > COURSE.end + 14) G.state = 'finish';
  }
  const acc = target > G.speed ? 3.4 : 4.5;
  G.speed += THREE.MathUtils.clamp(target - G.speed, -acc * dt, acc * dt);
  G.x += G.speed * dt;
  G.z = Math.sin(G.x * 0.05) * 0.12 + Math.sin(G.x * 0.13) * 0.05;
  horse.root.position.set(G.x, 0, G.z);
  horse.root.rotation.y = -Math.cos(G.x * 0.05) * 0.05 * 0.12 * 2;

  // 計時
  if (G.t0 === null && G.x >= COURSE.start) G.t0 = G.clock;
  if (G.t0 !== null && G.finalTime === null) {
    G.runTime = G.clock - G.t0;
    if (G.x >= COURSE.end) G.finalTime = G.runTime;
  }

  // 歩様と蹄音・砂埃
  const events = horse.update(dt, G.speed, t);
  for (const L of events) {
    const vol = Math.min(1, G.speed / 12) * (L.front ? 1 : 0.8);
    sound.hoof(vol, L.z > 0 ? 0.3 : -0.3);
    const p = new THREE.Vector3(G.x + L.x - 0.2, 0.08, G.z + L.z);
    for (let i = 0; i < 2; i++) {
      spawnDust(p, new THREE.Vector3(-G.speed * 0.15 + (Math.random() - 0.5), 0.6 + Math.random() * 0.8, (Math.random() - 0.5) * 1.2),
        0.5 + Math.random() * 0.4, 1.2 + Math.random() * 0.8);
    }
  }
  sound.setRush(G.speed);

  // 弓の操作
  const canDraw = (G.state === 'run' || G.state === 'finish') && G.nocked >= 1 && G.arrowsLeft > 0;
  if (G.release) {
    G.release = false;
    if (canDraw && G.draw >= 0.25) shoot();
  }
  if (G.wantDraw && canDraw) {
    G.raise = Math.min(1, G.raise + rdt * 5);
    if (G.raise > 0.6) G.draw = Math.min(1, G.draw + (dt / 0.75) * (1.15 - G.draw * 0.5));
    if (G.draw >= 1) G.holdFull += dt;
    if (G.draw > 0.3 && G.creaked === 0) { sound.creak(0.3); G.creaked = 1; }
    if (G.draw > 0.85 && G.creaked === 1) { sound.creak(0.9); G.creaked = 2; }
  } else {
    G.draw = Math.max(0, G.draw - dt * 3);
    G.raise = Math.max(0, G.raise - dt * 1.6);
    G.holdFull = 0;
    if (G.draw < 0.2) G.creaked = 0;
  }
  if (G.nocked < 1 && G.arrowsLeft > 0) {
    G.nockTimer += dt;
    G.nocked = THREE.MathUtils.clamp((G.nockTimer - d.nock * 0.35) / (d.nock * 0.65), 0, 1);
  }
  // 満を持し過ぎると手が震える
  G.holdTremble = Math.max(0, G.holdFull - 1.8) * 0.5;

  // 視点と揺れ（騎乗の上下動は狙いに直結する）
  const w = Math.PI * 2 * horse.phase;
  const S = d.sway * Math.min(1.4, G.speed / 14) * horse.amp;
  const tr = G.holdTremble;
  const sp = S * 0.011 * Math.sin(w + 0.4) + tr * 0.006 * Math.sin(t * 37) + Math.sin(t * 1.1) * 0.002;
  const sy = S * 0.007 * Math.sin(w * 0.5 + 1.2) + tr * 0.006 * Math.sin(t * 29 + 1);
  const roll = S * 0.014 * Math.sin(w + 1.7);
  const yaw = G.yaw + sy, pitch = G.pitch + sp;
  G.aimDir.set(Math.cos(pitch) * Math.cos(yaw), Math.sin(pitch), -Math.cos(pitch) * Math.sin(yaw));

  rider.update(G.yaw, G.pitch, G.aimDir, G.draw, G.raise, G.nocked);
  rider.setQuiver(Math.max(0, G.arrowsLeft - (G.nocked >= 1 ? 1 : 0)));

  if (G.fp) {
    camera.position.copy(rider.eye);
    camera.rotation.set(pitch, -Math.PI / 2 + yaw, roll, 'YXZ');
    camera.fov = THREE.MathUtils.lerp(72, 62, G.raise * G.draw);
  } else {
    const right = tmpV.crossVectors(G.aimDir, up).normalize();
    camera.position.copy(rider.eye).addScaledVector(G.aimDir, -2.6).addScaledVector(up, 0.55).addScaledVector(right, 0.5);
    if (camera.position.y < 0.5) camera.position.y = 0.5;
    camera.lookAt(tmpV2.copy(rider.eye).addScaledVector(G.aimDir, 7));
    camera.fov = 65;
  }
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  const trem = { x: tr * 0.004 * Math.sin(t * 41), y: tr * 0.004 * Math.sin(t * 33) };
  vm.update(G.draw, G.raise, G.nocked >= 1 ? 1 : Math.max(0, G.nocked) * (G.arrowsLeft > 0 ? 1 : 0), trem);

  updateArrows(dt);
  updatePieces(G.pieces, dt);

  // 外れ判定（的を通過して飛翔中の矢がない）
  world.targets.forEach((tg, i) => {
    if (tg.done) return;
    const flying = G.arrows.some(a => a.alive && !a.falling);
    if (G.x > tg.pos.x + 22 && !flying) {
      tg.done = true;
      G.results[i] = { name: tg.name, hit: false, points: 0 };
      document.querySelectorAll('#hud-targets .t')[i].className = 't miss';
      message(`${tg.name}　外れ`, 1100);
    }
  });

  // 的役の扇
  for (const j of world.judges) {
    if (j.timer > 0) j.timer -= dt; else j.raise = 0;
    const target = j.raise ? Math.PI * 0.95 + Math.sin(t * 6) * 0.15 : 0;
    j.armPivot.rotation.x += (target - j.armPivot.rotation.x) * Math.min(1, dt * 8);
  }

  // 終了
  if (G.state === 'finish') {
    G.finishTimer += dt;
    const flying = G.arrows.some(a => a.alive && !a.falling);
    if ((G.speed < 0.5 && !flying) || G.finishTimer > 7) showResult();
  }

  // HUD
  $('hud-speed').textContent = Math.round(G.speed * 3.6);
  $('hud-time').textContent = (G.finalTime ?? G.runTime).toFixed(2);
  $('hud-arrows').textContent = '｜'.repeat(Math.max(0, G.arrowsLeft)) || '—';
  $('progress-horse').style.left = prog(G.x) + '%';
  $('draw-fill').style.width = (G.draw * 100).toFixed(0) + '%';
  $('draw-gauge').style.opacity = G.raise > 0.05 ? 1 : 0.25;

  const imp = $('impact');
  if (d.reticle === 'impact' && G.raise > 0.5 && G.nocked >= 1) {
    const p = predictImpact();
    if (p) {
      projV.copy(p).project(camera);
      if (projV.z < 1) {
        imp.style.display = 'block';
        imp.style.left = ((projV.x + 1) / 2) * window.innerWidth + 'px';
        imp.style.top = ((1 - projV.y) / 2) * window.innerHeight + 'px';
      } else imp.style.display = 'none';
    } else imp.style.display = 'none';
  } else imp.style.display = 'none';
  if (!G.fp && d.reticle !== 'none') {
    // 三人称では照準点を投影
    projV.copy(rider.eye).addScaledVector(G.aimDir, 7).project(camera);
    $('reticle').style.left = ((projV.x + 1) / 2) * 100 + '%';
    $('reticle').style.top = ((1 - projV.y) / 2) * 100 + '%';
  } else {
    $('reticle').style.left = '50%';
    $('reticle').style.top = '50%';
  }
}

function showResult() {
  G.state = 'result';
  G.wantDraw = false;
  if (document.exitPointerLock && locked()) { G.hadLock = false; document.exitPointerLock(); }
  const d = diff();
  const hits = G.results.filter(r => r.hit).length;
  const time = G.finalTime ?? G.runTime;
  const par = (COURSE.end / d.speed) * 1.12;
  const timeBonus = Math.max(0, Math.round((par - time) * 25));
  const allBonus = hits === 3 ? 150 : 0;
  const total = G.results.reduce((s, r) => s + r.points, 0) + timeBonus + allBonus;
  const titles = ['無念', '一中', '二中', '皆中'];
  $('result-title').textContent = titles[hits];
  $('result-rows').innerHTML = G.results.map(r => `<div class="r"><b>${r.name}</b><span>${r.hit ? (r.center ? '正鵠 ' : '的中 ') + r.points + '点' : '外れ'}</span></div>`).join('')
    + `<div class="r"><b>駆け抜け</b><span>${time.toFixed(2)}秒 ＋${timeBonus}点</span></div>`
    + (allBonus ? `<div class="r"><b>皆中</b><span>＋${allBonus}点</span></div>` : '');
  $('result-score').innerHTML = `${total}<small> 点</small>`;
  const key = 'yabusame.best.' + G.diffKey;
  const best = store.get(key) || 0;
  if (total > best) {
    store.set(key, total);
    $('result-best').textContent = best ? `新記録！（これまで ${best} 点）` : '初記録';
  } else $('result-best').textContent = `最高記録 ${best} 点`;
  show('result', true);
  show('touch', false);
  if (hits === 3) sound.cheer(1.6);
}

function titleCamera(t) {
  // タイトル画面：馬場入り前の人馬を回り込むカメラ
  horse.update(1 / 60, 0, t);
  G.yaw = 0.3 + Math.sin(t * 0.3) * 0.2;
  G.aimDir.set(Math.cos(G.yaw), -0.05, -Math.sin(G.yaw)).normalize();
  rider.update(G.yaw, -0.05, G.aimDir, 0, 0, 1);
  const a = t * 0.12;
  camera.position.set(G.x + Math.cos(a) * 6.5, 2.3 + Math.sin(t * 0.2) * 0.3, G.z + Math.sin(a) * 6.5);
  camera.lookAt(G.x + 0.2, 1.7, G.z);
  camera.fov = 50;
  camera.updateProjectionMatrix();
}

function frame(now) {
  requestAnimationFrame(frame);
  const rdt = Math.min(0.05, (now - last) / 1000);
  last = now;
  // スローモーション（的中時）
  if (G.slowmo > 0) G.slowmo -= rdt;
  const targetScale = G.slowmo > 0 ? 0.28 : 1;
  G.timeScale += (targetScale - G.timeScale) * Math.min(1, rdt * (targetScale < 1 ? 20 : 4));
  const dt = rdt * G.timeScale;

  if (G.frozen) {
    // テスト用の停止
  } else if (G.state === 'title') {
    G.clock += rdt;
    titleCamera(G.clock);
  } else if (['ready', 'run', 'finish', 'result'].includes(G.state)) {
    G.clock += dt;
    if (G.state === 'result') {
      // 結果表示中も馬は止まって息を整える
      horse.update(dt, G.speed = Math.max(0, G.speed - dt * 5), G.clock);
      updatePieces(G.pieces, dt);
    } else update(dt, rdt);
  }
  updateDust(dt);
  updateCrowd(world.crowd, dt, G.clock);
  updateFlags(world.flags, G.clock, G.wind.lengthSq() > 0 ? G.wind : new THREE.Vector3(1, 0, 0.5));

  const s = world.sun;
  s.position.set(G.x + 10, 0, G.z).addScaledVector(world.sunDir, 90);
  s.target.position.set(G.x + 10, 0, G.z);
  s.target.updateMatrixWorld();

  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// 起動
rider.setFirstPerson(false);
vm.visible = false;
setDiff(G.diffKey);
G.state = 'title';
$('loading').classList.add('hidden');
requestAnimationFrame(frame);
// 自動テスト用：描画せずに時間を進める
function step(n = 1, dt = 1 / 60) {
  for (let i = 0; i < n; i++) {
    if (!['run', 'finish', 'ready'].includes(G.state)) break;
    G.clock += dt;
    update(dt, dt);
    updateDust(dt);
  }
}
window.__yabusame = { G, world, camera, horse, startRun, newRun, shoot, step, predictImpact };
