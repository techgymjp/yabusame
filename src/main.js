import * as THREE from 'three';
import { buildWorld, COURSE, updateFlags, updateCrowd, exciteCrowd } from './world.js';
import { Horse, Rider } from './horse.js';
import {
  ViewModel, FlyingArrow, integrateArrow, segmentHitsBoard, shatterBoard, updatePieces, ARROW_PHYS, BOW,
} from './archery.js';
import { Sound } from './audio.js';
import { puffTexture, hoofPrintTexture } from './textures.js';
import { createPost, QUALITY } from './post.js';
import { windUniforms } from './vegetation.js';
import { HitFX } from './effects.js';
import { Music } from './music.js';
import { t as tr, setLang, applyI18n, getLang } from './i18n.js';

const DIFF = {
  easy: {
    arrows: 5, speed: 12, sway: 0.55, nock: 0.9, reticle: 'impact', wind: 1.0, spread: 0.0015,
    note: 'noteEasy',
  },
  normal: {
    arrows: 4, speed: 14, sway: 1.0, nock: 1.1, reticle: 'dot', wind: 2.2, spread: 0.003,
    note: 'noteNormal',
  },
  hard: {
    arrows: 3, speed: 15.5, sway: 1.3, nock: 1.25, reticle: 'none', wind: 3.5, spread: 0.0045,
    note: 'noteHard',
  },
};

const $ = id => document.getElementById(id);
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 保存不可でも続行 */ } },
};

const isTouch = matchMedia('(pointer: coarse)').matches;
const quality = (() => { const q = store.get('yabusame.quality'); return QUALITY[q] ? q : (isTouch ? 'low' : 'high'); })();

// ---------- レンダラ ----------
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.6;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.05, 5000);
scene.add(camera);

const world = buildWorld(scene, renderer, quality);
world.sun.shadow.mapSize.set(QUALITY[quality].shadow, QUALITY[quality].shadow);
const post = createPost(renderer, scene, camera, quality);
post.setSize(window.innerWidth, window.innerHeight);

// 蹄跡（砂に残る）
const PRINTS = 700;
const prints = new THREE.InstancedMesh(
  new THREE.PlaneGeometry(0.2, 0.18).rotateX(-Math.PI / 2),
  new THREE.MeshStandardMaterial({ map: hoofPrintTexture(), transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -12 }),
  PRINTS);
prints.count = 0;
prints.receiveShadow = true;
prints.frustumCulled = false;
scene.add(prints);
let printIdx = 0;
const printM = new THREE.Matrix4(), printQ = new THREE.Quaternion();
function addPrint(x, z) {
  printQ.setFromAxisAngle(new THREE.Vector3(0, 1, 0), (Math.random() - 0.5) * 0.4);
  printM.compose(new THREE.Vector3(x, 0.016, z), printQ, new THREE.Vector3(1, 1, 1));
  prints.setMatrixAt(printIdx % PRINTS, printM);
  printIdx++;
  prints.count = Math.min(PRINTS, printIdx);
  prints.instanceMatrix.needsUpdate = true;
}
const horse = new Horse(quality);
scene.add(horse.root);
horse.root.traverse(o => { if (o.isMesh) { o.castShadow = true; } });
const rider = new Rider(horse);
rider.attachProps(scene);
const vm = new ViewModel(camera);
const sound = new Sound();
const fx = new HitFX(scene);
const music = new Music(sound);

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
  fp: false,
  camMode: CAM_MODES_DEFAULT(),
  x: COURSE.runup, z: 0, speed: 0,
  yaw: 0.55, pitch: -0.08,
  wantDraw: false, release: false,
  draw: 0, raise: 0, nocked: 1, nockTimer: 0, holdFull: 0, creaked: 0, releaseT: 9, releaseSlow: 0,
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
function CAM_MODES_DEFAULT() { const c = store.get('yabusame.cam'); return ['shoulder', 'fp', 'chase'].includes(c) ? c : 'shoulder'; }

// ---------- UI ----------
const hudTargets = $('hud-targets');
COURSE.targets.forEach((t, i) => {
  const d = document.createElement('div');
  d.className = 't';
  d.dataset.idx = i;
  d.textContent = tr('targetGlyphs')[i];
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
  $('diffnote').textContent = tr(DIFF[k].note);
  const best = store.get('yabusame.best.' + k);
  $('best').textContent = best ? tr('best', { d: tr(k), s: best }) : '';
}
document.querySelectorAll('#difficulty button').forEach(b => b.addEventListener('click', () => setDiff(b.dataset.v)));
document.querySelectorAll('#quality button').forEach(b => {
  b.classList.toggle('on', b.dataset.v === quality);
  b.addEventListener('click', () => {
    if (b.dataset.v === quality) return;
    store.set('yabusame.quality', b.dataset.v);
    location.reload();
  });
});
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

// 視点：肩越し（標準）→ 一人称 → 後方
const CAM_MODES = ['shoulder', 'fp', 'chase'];
const CAM_NAMES = { shoulder: 'camShoulder', fp: 'camFp', chase: 'camChase' };
function applyCam() {
  G.fp = G.camMode === 'fp';
  rider.setFirstPerson(G.fp);
  vm.visible = G.fp;
}
function toggleCam() {
  G.camMode = CAM_MODES[(CAM_MODES.indexOf(G.camMode) + 1) % CAM_MODES.length];
  store.set('yabusame.cam', G.camMode);
  applyCam();
  if (['ready', 'run', 'finish'].includes(G.state)) message(`<small>${tr(CAM_NAMES[G.camMode])}</small>`, 900);
}

// ---------- 画面遷移（広告の出し方は docs の基本ルールどおり） ----------
const Ads = window.Ads || { available: false, showInterstitial: () => Promise.resolve(), showRewarded: () => Promise.resolve('unavailable'), setBanner() {}, initDone: Promise.resolve(), privacyOptionsRequired: false, showPrivacyOptions: () => Promise.resolve() };
const cap = window.Capacitor;
const isApp = !!(cap && cap.isNativePlatform && cap.isNativePlatform());
window.gameAudio = { suspend: () => sound.suspend(), resume: () => sound.release() };
if (isTouch) document.body.classList.add('touch');
let busy = false; // 全画面広告の表示中に二度押しされないように
async function withInterstitial(fn) {
  if (busy) return;
  busy = true;
  try { await Ads.showInterstitial(); } finally { busy = false; }
  fn();
}
// バナーはタイトル・あそびかた・ポーズ・結果画面だけ
function updateBanner() {
  Ads.setBanner(['title', 'help', 'paused', 'result'].includes(G.state));
}
function startFromMenu() {
  sound.init(); sound.resume(); lockPointer();
  music.play('ready');
  withInterstitial(newRun);
}
$('start').addEventListener('click', startFromMenu);
$('help-start').addEventListener('click', startFromMenu);
$('again').addEventListener('click', () => { sound.resume(); lockPointer(); withInterstitial(newRun); });
$('toTitle').addEventListener('click', () => withInterstitial(toTitle));
$('quit').addEventListener('click', () => withInterstitial(toTitle));
$('resume').addEventListener('click', () => withInterstitial(resume));
$('howto').addEventListener('click', () => { sound.init(); music.play('title'); G.state = 'help'; show('title', false); show('help', true); updateBanner(); });
$('help-back').addEventListener('click', () => withInterstitial(toTitle));
$('adPrivacy').addEventListener('click', () => Ads.showPrivacyOptions());
$('version').textContent = window.APP_VERSION || '';
// ブラウザは操作があるまで音を出せないので、最初のタップでタイトルの曲を始める
window.addEventListener('pointerdown', () => {
  sound.init(); sound.resume();
  if (G.state === 'title' || G.state === 'help') music.play('title');
}, { once: true });
Ads.initDone.then(() => { if (Ads.privacyOptionsRequired) $('adPrivacy').classList.remove('hidden'); });

function toTitle() {
  G.state = 'title';
  show('title', true); show('help', false); show('result', false); show('pause', false); show('hud', false); show('touch', false); show('retry', false);
  setDiff(G.diffKey);
  resetCourse();
  rider.setFirstPerson(false);
  vm.visible = false;
  updateBanner();
  music.play('title');
}
function pause() {
  if (G.state === 'paused' || !['ready', 'run', 'finish', 'retry'].includes(G.state)) return;
  if (G.state === 'retry') hideRetry(false);
  G.prevState = G.state;
  G.state = 'paused';
  G.wantDraw = false;
  show('pause', true);
  updateBanner();
}
function resume() {
  if (G.state !== 'paused') return;
  show('pause', false);
  G.state = G.prevState;
  lockPointer();
  updateBanner();
}

// 戻るボタン（Android）：プレイ中はポーズ、ポーズ中は再開、メニューではアプリを終了
if (isApp && cap.Plugins && cap.Plugins.App) {
  cap.Plugins.App.addListener('backButton', () => {
    if (['ready', 'run', 'finish', 'retry'].includes(G.state)) pause();
    else if (G.state === 'paused') withInterstitial(resume);
    else if (G.state === 'help') withInterstitial(toTitle);
    else cap.Plugins.App.exitApp();
  });
}
// 別のアプリに切り替えたら自動でポーズし、音も止める
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { pause(); sound.suspend(); }
  else sound.release();
});

// ---------- 射直し（リワード広告） ----------
const RETRY_MAX = 3;
function offerRetry(idx) {
  if (!Ads.available || G.retries >= RETRY_MAX) return;
  // 外れたことを見届けてから聞く
  G.retryPending = { idx, at: G.clock + 1.6 };
}
function showRetry(idx) {
  G.retryPending = null;
  G.retryPrev = G.state;
  G.state = 'retry';
  G.retryIdx = idx;
  G.retryTimer = 6;
  G.wantDraw = false;
  $('retry').querySelector('[data-i18n="retryQ"]').textContent = tr('retryQ', { n: RETRY_MAX - G.retries });
  show('retry', true);
}
function hideRetry(cont = true) {
  show('retry', false);
  if (cont && G.state === 'retry') G.state = G.retryPrev;
}
$('retry-no').addEventListener('click', () => hideRetry());
$('retry-yes').addEventListener('click', async () => {
  if (busy) return;
  busy = true;
  const idx = G.retryIdx;
  show('retry', false);
  const r = await Ads.showRewarded();
  busy = false;
  if (G.state !== 'retry') return;
  G.state = G.retryPrev;
  // 広告を最後まで見たときだけ射直せる
  if (r === 'rewarded') doRetry(idx);
});
function doRetry(idx) {
  const snap = G.snaps[idx];
  const tg = world.targets[idx];
  if (!snap) return;
  for (const a of G.arrows) { scene.remove(a.mesh); a.whistle && a.whistle.stop(); if (a.trail) scene.remove(a.trail.mesh); }
  G.arrows = [];
  // 的の手前に戻り、矢の数と時間もその時点に戻す（風などの条件は同じ）
  G.x = snap.x;
  G.arrowsLeft = snap.arrowsLeft;
  G.nocked = 1; G.nockTimer = 0; G.releaseT = 9; G.draw = 0; G.raise = 0;
  if (G.t0 !== null) G.t0 = G.clock - snap.runTime;
  G.finalTime = null;
  tg.done = false;
  tg.board.visible = true;
  G.results[idx] = { name: tg.name, hit: false, points: 0, r: null };
  document.querySelectorAll('#hud-targets .t')[idx].className = 't';
  G.retries++;
  if (G.state === 'finish') G.state = 'run';
  G.finishTimer = 0;
  message(tr('retryDone'), 1000);
}

function resetCourse() {
  for (const a of G.arrows) { scene.remove(a.mesh); a.whistle && a.whistle.stop(); if (a.trail) scene.remove(a.trail.mesh); }
  for (const p of G.pieces) scene.remove(p.mesh);
  G.arrows = []; G.pieces = [];
  fx.clear();
  G.hitCam = null;
  for (const p of pops) p.el.remove();
  pops.length = 0;
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
  G.draw = 0; G.raise = 0; G.nocked = 1; G.nockTimer = 0; G.releaseT = 9;
  G.yaw = 0.55; G.pitch = -0.08;
  G.results = COURSE.targets.map(t => ({ name: t.name, hit: false, points: 0, r: null }));
  const ang = Math.random() * Math.PI * 2;
  G.wind.set(Math.cos(ang), 0, Math.sin(ang)).multiplyScalar(Math.random() * d.wind);
  G.finishTimer = 0;
  G.retries = 0; G.snaps = []; G.retryPending = null;
  G.state = 'ready';
  applyCam();
  show('title', false); show('help', false); show('result', false); show('pause', false); show('hud', true); show('retry', false);
  updateBanner();
  music.play('ready');
  show('touch', isTouch);
  $('reticle').style.display = 'none';
  document.querySelectorAll('#hud-targets .t').forEach(e => (e.className = 't'));
  hint(tr(isTouch ? 'hintStartTouch' : 'hintStart'));
  const w = G.wind;
  $('hud-wind').innerHTML = `<span style="display:inline-block;transform:rotate(${Math.atan2(w.z, w.x) * 180 / Math.PI}deg)">↑</span> ${w.length().toFixed(1)}<small>m/s</small>`;
  message(tr('enter'), 1400);
}

function startRun() {
  if (G.state !== 'ready') return;
  G.state = 'run';
  sound.init();
  sound.drum();
  music.play('run');
  message(tr('go'), 1500);
  hint(tr(isTouch ? 'hintRunTouch' : 'hintRun'));
  setTimeout(() => { if (G.state === 'run') hint(''); }, 7000);
}

// ---------- 矢の軌跡（見やすさのための光の尾） ----------
const TRAIL_N = 48;
const trailMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false });
function makeTrail() {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL_N * 2 * 3), 3));
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(TRAIL_N * 2 * 4), 4));
  const idx = [];
  for (let i = 0; i < TRAIL_N - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  geo.setIndex(idx);
  geo.setDrawRange(0, 0);
  const mesh = new THREE.Mesh(geo, trailMat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;
  scene.add(mesh);
  return { mesh, pts: [], fade: 1 };
}
const _tA = new THREE.Vector3(), _tB = new THREE.Vector3();
function updateTrail(trail, tip, alive, dt) {
  if (alive) { trail.pts.unshift(tip.clone()); if (trail.pts.length > TRAIL_N) trail.pts.pop(); }
  else trail.fade -= dt * 1.6;
  const n = trail.pts.length;
  const pos = trail.mesh.geometry.attributes.position, col = trail.mesh.geometry.attributes.color;
  for (let i = 0; i < n; i++) {
    const p = trail.pts[i];
    const q = trail.pts[Math.min(n - 1, i + 1)], o = trail.pts[Math.max(0, i - 1)];
    _tA.subVectors(o, q);
    _tB.subVectors(camera.position, p);
    _tA.cross(_tB).normalize();
    const f = 1 - i / TRAIL_N;
    const w = 0.006 + 0.012 * f;
    const near = THREE.MathUtils.smoothstep(p.distanceTo(camera.position), 0.8, 3.5); // 目の前では消す
    pos.setXYZ(i * 2, p.x + _tA.x * w, p.y + _tA.y * w, p.z + _tA.z * w);
    pos.setXYZ(i * 2 + 1, p.x - _tA.x * w, p.y - _tA.y * w, p.z - _tA.z * w);
    const a = f * f * 0.75 * near * Math.max(0, trail.fade);
    col.setXYZW(i * 2, 1, 0.97, 0.88, a);
    col.setXYZW(i * 2 + 1, 1, 0.97, 0.88, a);
  }
  pos.needsUpdate = true;
  col.needsUpdate = true;
  trail.mesh.geometry.setDrawRange(0, Math.max(0, n - 1) * 6);
  if (trail.fade <= 0) { scene.remove(trail.mesh); trail.mesh.geometry.dispose(); return false; }
  return true;
}

// ---------- 射撃 ----------
const AIM_DIST = 7.5; // 照準点までの距離（的までのおおよその距離）
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
    aimPoint = rider.eye.clone().addScaledVector(G.aimDir, AIM_DIST);
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
  a.trail = makeTrail();
  G.arrows.push(a);
  sound.twang(G.draw);
  G.arrowsLeft--;
  G.nocked = 0;
  G.nockTimer = 0;
  G.releaseT = 0;
  G.releaseSlow = 0.45; // 放った矢が見えるよう一瞬スローに
  G.raise = 0;
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
  const center = hit.r < 0.062;
  const grand = G.results.filter((r, i) => i !== idx && r.hit).length === COURSE.targets.length - 1;
  const power = grand ? 1.8 : center ? 1.4 : 1;
  G.pieces.push(...shatterBoard(scene, target, hit, arrow.vel, COURSE.boardSize, power));
  fx.burst(hit.point, arrow.vel, { center, grand });
  for (let i = 0; i < 26; i++) {
    spawnDust(hit.point, new THREE.Vector3((Math.random() - 0.5) * 5, Math.random() * 3.5, (Math.random() - 0.3) * 3.5),
      0.22, 0.7 + Math.random() * 0.5, 0xe2c99a, 0.9);
  }
  const pts = 100 + Math.round(60 * Math.max(0, 1 - hit.r / (COURSE.boardSize / 2))) + (center ? 40 : 0);
  G.results[idx] = { name: target.name, hit: true, points: pts, r: hit.r, center };
  document.querySelectorAll('#hud-targets .t')[idx].className = 't hit';
  sound.hit(center);
  if (grand) setTimeout(() => sound.grand(), 450);
  exciteCrowd(world.crowd, target.pos.x, grand ? 2 : center ? 1.5 : 1.2);
  target.judge.raise = 1;
  target.judge.timer = 3;
  // 的中カメラ：板が割れる瞬間をスローで見せる
  G.hitCam = { t: 0, dur: grand ? 2.0 : center ? 1.6 : 1.3, pos: target.pos.clone(), side: Math.random() < 0.5 ? -1 : 1 };
  G.slowmo = G.hitCam.dur;
  G.shake = 0;
  post.pulse(grand ? 1.6 : center ? 1.2 : 0.9);
  flashScreen(center || grand);
  popScore(target.pos, pts, center);
  stamp(tr('hitName', { n: idx }), center ? tr('bullseye') : '', grand);
  // 矢は板を割って勢いを失う
  arrow.vel.multiplyScalar(0.12);
  arrow.vel.y += 1.5;
  arrow.falling = true;
}

// 画面の白い閃光
function flashScreen(gold) {
  const f = $('flash');
  f.className = '';
  void f.offsetWidth;
  f.className = gold ? 'go gold' : 'go';
}
// 得点が的から浮かび上がる
const pops = [];
function popScore(pos, pts, center) {
  const el = document.createElement('div');
  el.className = 'pop' + (center ? ' gold' : '');
  el.textContent = '+' + pts;
  $('hud').appendChild(el);
  pops.push({ el, pos: pos.clone(), t: 0 });
}
function updatePops(rdt) {
  for (let i = pops.length - 1; i >= 0; i--) {
    const p = pops[i];
    p.t += rdt;
    if (p.t > 1.8) { p.el.remove(); pops.splice(i, 1); continue; }
    projV.copy(p.pos).add(new THREE.Vector3(0, 0.45 + p.t * 0.25, 0)).project(camera);
    p.el.style.left = ((projV.x + 1) / 2) * 100 + '%';
    p.el.style.top = ((1 - projV.y) / 2) * 100 + '%';
    p.el.style.opacity = projV.z < 1 ? Math.min(1, (1.8 - p.t) * 2) : 0;
  }
}
// 判子のように押される的中の文字
let stampTimer = null;
function stamp(title, sub, grand) {
  const m = $('message');
  m.innerHTML = `<span class="seal">${tr('sealChar')}</span><span class="word">${title}</span>${sub ? `<small>${sub}</small>` : ''}`;
  m.className = 'show stamp red';
  clearTimeout(stampTimer);
  stampTimer = setTimeout(() => {
    if (grand) {
      m.innerHTML = `<span class="word">${tr('allHit')}</span><small>${tr('allHitSub')}</small>`;
      m.className = '';
      void m.offsetWidth;
      m.className = 'show stamp grand';
      stampTimer = setTimeout(() => (m.className = 'grand'), 2200);
    } else m.className = 'red';
  }, 1500);
}

function updateArrows(dt) {
  const n = Math.max(1, Math.ceil(dt / 0.003));
  const h = dt / n;
  for (const a of G.arrows) {
    if (!a.alive) { if (a.trail && !updateTrail(a.trail, a.tip, false, dt)) a.trail = null; continue; }
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
    if (a.trail && !updateTrail(a.trail, a.tip, a.alive && !a.falling, dt)) a.trail = null;
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
    if (G.speed > 1) addPrint(p.x + 0.25, p.z);
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
    // 打起し（弓を高く掲げる）→ 引分け（引きながら目の高さへ下ろす）→ 会
    G.raise = Math.min(1, G.raise + dt / 0.32);
    if (G.raise >= 1) G.draw = Math.min(1, G.draw + (dt / 0.9) * (1.2 - G.draw * 0.5));
    if (G.draw >= 1) G.holdFull += dt;
    if (G.draw > 0.3 && G.creaked === 0) { sound.creak(0.3); G.creaked = 1; }
    if (G.draw > 0.85 && G.creaked === 1) { sound.creak(0.9); G.creaked = 2; }
  } else {
    // 引くのをやめたら戻す（引き戻してから弓を下ろす）
    G.draw = Math.max(0, G.draw - dt * 2.2);
    if (G.draw <= 0) G.raise = Math.max(0, G.raise - dt * 2.2);
    G.holdFull = 0;
    if (G.draw < 0.2) G.creaked = 0;
  }
  G.releaseT += dt;
  // 残心ののち、箙から次の矢を取ってつがえる
  if (G.nocked < 1 && G.arrowsLeft > 0 && G.releaseT > 1.0) {
    G.nockTimer += dt;
    G.nocked = THREE.MathUtils.clamp(G.nockTimer / d.nock, 0, 1);
  }
  // 満を持し過ぎると手が震える
  G.holdTremble = Math.max(0, G.holdFull - 1.8) * 0.5;

  // 視点と揺れ（騎乗の上下動は狙いに直結する）
  const w = Math.PI * 2 * horse.phase;
  const S = d.sway * Math.min(1.4, G.speed / 14) * horse.amp;
  const trm = G.holdTremble; // 満を持し過ぎたときの手の震え（tr は翻訳関数なので別名にする）
  const sp = S * 0.011 * Math.sin(w + 0.4) + trm * 0.006 * Math.sin(t * 37) + Math.sin(t * 1.1) * 0.002;
  const sy = S * 0.007 * Math.sin(w * 0.5 + 1.2) + trm * 0.006 * Math.sin(t * 29 + 1);
  const roll = S * 0.014 * Math.sin(w + 1.7);
  const yaw = G.yaw + sy, pitch = G.pitch + sp;
  G.aimDir.set(Math.cos(pitch) * Math.cos(yaw), Math.sin(pitch), -Math.cos(pitch) * Math.sin(yaw));

  rider.update(G.yaw, G.pitch, G.aimDir, G.draw, G.raise, G.nocked, G.releaseT);
  rider.setQuiver(Math.max(0, G.arrowsLeft - (G.nocked >= 1 ? 1 : 0)));

  if (G.fp) {
    camera.position.copy(rider.eye);
    camera.rotation.set(pitch, -Math.PI / 2 + yaw, roll, 'YXZ');
    camera.fov = THREE.MathUtils.lerp(70 + G.speed * 0.25, 60, G.draw);
  } else if (G.camMode === 'shoulder') {
    // 射手の右肩の後ろから：引く右腕・しなる弓・その先の的が一度に見える
    const right = tmpV.crossVectors(G.aimDir, up).normalize();
    camera.position.copy(rider.eye).addScaledVector(G.aimDir, -1.35).addScaledVector(up, 0.1).addScaledVector(right, 2.7);
    if (camera.position.y < 0.6) camera.position.y = 0.6;
    camera.lookAt(tmpV2.copy(rider.eye).addScaledVector(G.aimDir, 2.3).addScaledVector(up, -0.3));
    camera.rotateZ(roll * 0.5);
    camera.fov = THREE.MathUtils.lerp(60, 54, G.draw);
  } else {
    const right = tmpV.crossVectors(G.aimDir, up).normalize();
    camera.position.copy(rider.eye).addScaledVector(G.aimDir, -2.6).addScaledVector(up, 0.55).addScaledVector(right, 0.5);
    if (camera.position.y < 0.5) camera.position.y = 0.5;
    camera.lookAt(tmpV2.copy(rider.eye).addScaledVector(G.aimDir, AIM_DIST));
    camera.fov = 65;
  }
  // 的中カメラ（実時間で進む）
  if (G.hitCam) {
    const hc = G.hitCam;
    hc.t += rdt;
    const k = hc.t / hc.dur;
    if (k >= 1) {
      G.hitCam = null;
      G.shake = 0.35;
      vm.visible = G.fp;
      rider.setFirstPerson(G.fp);
    } else {
      vm.visible = false;
      rider.setFirstPerson(false);
      const ang = hc.side * (0.9 - k * 0.9) + 0.25;
      const dist = 2.4 - k * 0.6;
      camera.position.set(hc.pos.x + Math.sin(ang) * dist, hc.pos.y + 0.25 + k * 0.35, hc.pos.z + Math.cos(ang) * dist);
      camera.lookAt(hc.pos.x, hc.pos.y + k * 0.25, hc.pos.z);
      camera.fov = 48 - k * 6;
    }
  }
  if (G.shake > 0) {
    G.shake -= rdt;
    const a = G.shake * 0.08;
    camera.position.x += (Math.random() - 0.5) * a;
    camera.position.y += (Math.random() - 0.5) * a;
  }
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  const trem = { x: trm * 0.004 * Math.sin(t * 41), y: trm * 0.004 * Math.sin(t * 33) };
  vm.update(G.raise + G.draw, G.nocked, trem, G.releaseT, G.arrowsLeft);

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
      message(tr('miss', { n: i }), 1100);
      offerRetry(i);
    }
    // 射直し用：的の手前を通るときの状態を覚えておく
    if (!G.snaps[i] && G.x >= tg.pos.x - 32) G.snaps[i] = { x: G.x, arrowsLeft: G.arrowsLeft, runTime: G.runTime };
  });
  if (G.retryPending && G.clock >= G.retryPending.at && !G.hitCam) showRetry(G.retryPending.idx);

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
    if (((G.speed < 0.5 && !flying) || G.finishTimer > 7) && !G.retryPending) showResult();
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
  // 照準点は弓を引いている間だけ表示
  $('reticle').style.display = d.reticle !== 'none' && G.wantDraw && G.raise > 0.3 && G.nocked >= 1 ? 'block' : 'none';
  if (!G.fp && d.reticle !== 'none') {
    // 三人称では照準点を投影
    projV.copy(rider.eye).addScaledVector(G.aimDir, AIM_DIST).project(camera);
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
  const title = tr('titles')[hits];
  $('result-title').textContent = title;
  $('result-rows').innerHTML = G.results.map((r, i) => `<div class="r"><b>${tr('targetNames')[i]}</b><span>${r.hit ? tr(r.center ? 'rowCenter' : 'rowHit', { p: r.points }) : tr('rowMiss')}</span></div>`).join('')
    + `<div class="r"><b>${tr('rowRun')}</b><span>${tr('rowRunVal', { t: time.toFixed(2), b: timeBonus })}</span></div>`
    + (allBonus ? `<div class="r"><b>${tr('rowAll')}</b><span>${tr('rowAllVal', { b: allBonus })}</span></div>` : '')
    + (G.retries ? `<div class="r"><b>${tr('rowRetry')}</b><span>${tr('rowRetryVal', { n: G.retries })}</span></div>` : '');
  $('result-score').innerHTML = `${total}<small> ${tr('points')}</small>`;
  // シェア用の文
  const marks = G.results.map(r => (r.hit ? (r.center ? '◎' : '○') : '×')).join('');
  G.shareText = tr('shareText', { title, score: total, diff: tr(G.diffKey), marks, retry: G.retries ? tr('shareRetry', { n: G.retries }) : '' });
  const key = 'yabusame.best.' + G.diffKey;
  const best = store.get(key) || 0;
  if (total > best) {
    store.set(key, total);
    $('result-best').textContent = best ? tr('newRecord', { b: best }) : tr('firstRecord');
  } else $('result-best').textContent = tr('bestRecord', { b: best });
  show('result', true);
  show('touch', false);
  updateBanner();
  music.play(hits === 3 ? 'grand' : 'result');
  if (hits === 3) sound.cheer(1.6);
}

// ---------- シェア ----------
// アプリでは Google Play のページ、Web 版では遊んでいるページを共有する
const shareUrl = () => (isApp ? 'https://play.google.com/store/apps/details?id=jp.techgym.yabusame' : location.origin + location.pathname);
$('share').addEventListener('click', async () => {
  const data = { title: tr('pageTitle'), text: G.shareText, url: shareUrl() };
  if (isApp && cap.Plugins && cap.Plugins.Share) {
    try { await cap.Plugins.Share.share({ ...data, dialogTitle: tr('share') }); } catch { /* 閉じた */ }
    return;
  }
  if (navigator.share) {
    try { await navigator.share(data); return; } catch (e) { if (e && e.name === 'AbortError') return; }
  }
  openX();
});
function openX() {
  const u = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(G.shareText) + '&url=' + encodeURIComponent(shareUrl());
  window.open(u, '_blank', 'noopener,width=600,height=500');
}
$('share-x')?.addEventListener('click', openX);
$('share-copy')?.addEventListener('click', async () => {
  const text = G.shareText + ' ' + shareUrl();
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch { /* 無視 */ }
    ta.remove();
  }
  const b = $('share-copy');
  b.textContent = tr('copied');
  setTimeout(() => (b.textContent = tr('copyLink')), 1600);
});

// ---------- 言語 ----------
document.querySelectorAll('#lang button').forEach(b => b.addEventListener('click', () => {
  setLang(b.dataset.v);
  setDiff(G.diffKey);
  document.querySelectorAll('#hud-targets .t').forEach((e, i) => (e.textContent = tr('targetGlyphs')[i]));
}));

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
  if (G.releaseSlow > 0) G.releaseSlow -= rdt;
  const targetScale = G.slowmo > 0 ? (G.hitCam ? 0.16 : 0.28) : G.releaseSlow > 0 ? 0.42 : 1;
  G.timeScale += (targetScale - G.timeScale) * Math.min(1, rdt * (targetScale < 1 ? 20 : 4));
  const dt = rdt * G.timeScale;

  if (document.body.dataset.state !== G.state) document.body.dataset.state = G.state; // 画面ごとの表示切替（CSS）
  if (G.state === 'retry') {
    // 射直しの案内は数秒で自動的に消して先へ進める
    G.retryTimer -= rdt;
    $('retry-fill').style.width = Math.max(0, G.retryTimer / 6 * 100) + '%';
    if (G.retryTimer <= 0 && !busy) hideRetry();
  }
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
  fx.update(dt, G.clock);
  updatePops(rdt);
  updateCrowd(world.crowd, dt, G.clock);
  updateFlags(world.flags, G.clock, G.wind.lengthSq() > 0 ? G.wind : new THREE.Vector3(1, 0, 0.5));

  const s = world.sun;
  s.position.set(G.x + 10, 0, G.z).addScaledVector(world.sunDir, 90);
  s.target.position.set(G.x + 10, 0, G.z);
  s.target.updateMatrixWorld();

  windUniforms.uTime.value += dt;
  windUniforms.uWind.value.set(0.5 + G.wind.x * 0.25, 0.2 + G.wind.z * 0.25);
  if (world.clouds) world.clouds.material.uniforms.uTime.value += dt;
  const blur = ['run', 'finish'].includes(G.state) && G.fp ? THREE.MathUtils.clamp((G.speed - 6) / 10, 0, 1) : 0;
  post.render(rdt, blur, G.clock);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  post.setSize(window.innerWidth, window.innerHeight);
});

// 起動
applyI18n();
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
    fx.update(dt, G.clock);
    updatePops(dt);
  }
}
window.__yabusame = { G, world, camera, horse, rider, startRun, newRun, shoot, step, predictImpact }; // @web-only
