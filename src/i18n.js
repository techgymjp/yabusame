// 日本語 / English
const DICT = {
  ja: {
    pageTitle: '流鏑馬 — YABUSAME',
    tagline: '疾走する馬上から、三つの的を射抜け。',
    rotate: '横画面にしてお楽しみください',
    howto: 'あそびかた・設定', howtoTitle: 'あそびかた',
    privacy: 'プライバシーポリシー', privacyUrl: 'https://techgym.jp/privacy-policy/', adSettings: '広告の設定',
    tAim: '画面をなぞって狙う', tDraw: '「引く」を長押しで打起し→引分け→会、離して放つ', tCam: '「視点」で視点を切り替え',
    retryQ: '広告を見て、この的を射直しますか？（残り {n} 回）', retryYes: '射直す', retryNo: '先へ進む',
    retryDone: '射直し', rowRetry: '射直し', rowRetryVal: '{n} 回', shareRetry: '（射直し{n}回）',
    sub: 'YABUSAME — 騎射の神事',
    intro: '疾走する馬の上で鐙に立ち、弓手（左）に並ぶ三つの的を鏑矢で射抜く。馬場二町（約218m）を駆け抜ける十数秒の勝負。',
    difficulty: '難易度', quality: '画質', sensitivity: '感度', language: '言語',
    easy: '初級', normal: '中級', hard: '本式',
    qHigh: '高', qMed: '中', qLow: '低',
    start: '馬場入り',
    ctlAim: '<kbd>マウス</kbd> 狙う',
    ctlDraw: '<kbd>左ボタン 長押し</kbd> 弓を引く ／ 離して放つ',
    ctlHorse: '<kbd>W</kbd><kbd>S</kbd> 馬を追う・抑える',
    ctlCam: '<kbd>C</kbd> 視点切替（肩越し・一人称・後方） &nbsp; <kbd>Esc</kbd> 一時停止',
    paused: '一時停止', resume: '再開', toTitle: 'タイトルへ', again: 'もう一度',
    touchDraw: '引く', touchCam: '視点', loading: '支度中…',
    hudArrows: '矢', hudSpeed: '速', hudTime: '時', hudWind: '風', sec: '秒',
    targetGlyphs: ['一', '二', '三'],
    targetNames: ['一の的', '二の的', '三の的'],
    noteEasy: '矢5本・馬速 約43km/h・着弾予測を表示',
    noteNormal: '矢4本・馬速 約50km/h・照準点のみ表示（馬の速度ぶん矢は前へ流れる）',
    noteHard: '一的一矢の本式・馬速 約56km/h・照準表示なし',
    best: '最高記録（{d}）: {s} 点',
    hintStartTouch: '「引く」をタップで発進', hintStart: 'クリック または スペースで発進',
    hintRunTouch: '「引く」長押しで打起し→引分け→会、離して離れ',
    hintRun: '左ボタン長押しで打起し→引分け→会、離して離れ ／ W・Sで馬速',
    enter: '馬場入り', go: 'いんよう、いー',
    miss: '{name}　外れ',
    camShoulder: '肩越し視点', camFp: '一人称視点', camChase: '後方視点',
    hitName: '{name}　的中', bullseye: '正鵠を射る', sealChar: '中',
    allHit: '皆中', allHitSub: '三的すべて的中',
    titles: ['無念', '一中', '二中', '皆中'],
    rowCenter: '正鵠 {p}点', rowHit: '的中 {p}点', rowMiss: '外れ',
    rowRun: '駆け抜け', rowRunVal: '{t}秒 ＋{b}点', rowAll: '皆中', rowAllVal: '＋{b}点',
    points: '点',
    newRecord: '新記録！（これまで {b} 点）', firstRecord: '初記録', bestRecord: '最高記録 {b} 点',
    share: 'シェア', shareX: 'X でポスト', copyLink: 'リンクをコピー', copied: 'コピーしました',
    shareText: '流鏑馬で{title}！ {score}点（{diff}）{marks}{retry} #流鏑馬 #yabusame',
  },
  en: {
    pageTitle: 'YABUSAME — Horseback Archery',
    tagline: 'Loose arrows at three targets from a galloping horse.',
    rotate: 'Please rotate your phone to landscape',
    howto: 'How to Play & Settings', howtoTitle: 'How to Play',
    privacy: 'Privacy Policy', privacyUrl: 'https://techgym.jp/privacy-policy-en/', adSettings: 'Ad settings',
    tAim: 'Drag on the screen to aim', tDraw: 'Hold “Draw” to raise, draw and aim — release to loose', tCam: '“View” switches the camera',
    retryQ: 'Watch an ad to shoot this target again? ({n} left)', retryYes: 'Retry', retryNo: 'Ride on',
    retryDone: 'Retry', rowRetry: 'Retries', rowRetryVal: '{n}', shareRetry: ' (retries: {n})',
    sub: 'YABUSAME — Sacred Horseback Archery',
    intro: 'Stand in the stirrups of a galloping horse and loose whistling arrows at three targets on your left — a few seconds of glory along a 218 m course.',
    difficulty: 'Difficulty', quality: 'Graphics', sensitivity: 'Sensitivity', language: 'Language',
    easy: 'Easy', normal: 'Normal', hard: 'Master',
    qHigh: 'High', qMed: 'Med', qLow: 'Low',
    start: 'Ride In',
    ctlAim: '<kbd>Mouse</kbd> Aim',
    ctlDraw: '<kbd>Hold Left Button</kbd> Draw ／ Release to loose',
    ctlHorse: '<kbd>W</kbd><kbd>S</kbd> Urge / rein in the horse',
    ctlCam: '<kbd>C</kbd> Camera (shoulder / first-person / chase) &nbsp; <kbd>Esc</kbd> Pause',
    paused: 'Paused', resume: 'Resume', toTitle: 'Title', again: 'Ride Again',
    touchDraw: 'Draw', touchCam: 'View', loading: 'Preparing…',
    hudArrows: 'Arrows', hudSpeed: 'Speed', hudTime: 'Time', hudWind: 'Wind', sec: 's',
    targetGlyphs: ['1', '2', '3'],
    targetNames: ['Target 1', 'Target 2', 'Target 3'],
    noteEasy: '5 arrows · ~43 km/h · impact marker shown',
    noteNormal: '4 arrows · ~50 km/h · aim dot only (arrows drift forward with the horse)',
    noteHard: 'One arrow per target · ~56 km/h · no aiming aid',
    best: 'Best ({d}): {s} pts',
    hintStartTouch: 'Tap “Draw” to start', hintStart: 'Click or press Space to start',
    hintRunTouch: 'Hold “Draw” to raise, draw and aim — release to loose',
    hintRun: 'Hold left button to raise, draw and aim — release to loose ／ W・S: horse speed',
    enter: 'Enter the course', go: 'In-yō, iii!',
    miss: '{name} — Miss',
    camShoulder: 'Shoulder view', camFp: 'First-person view', camChase: 'Chase view',
    hitName: '{name} — HIT!', bullseye: 'Bullseye!', sealChar: '中',
    allHit: 'KAICHŪ', allHitSub: 'All three targets hit!',
    titles: ['No Hits', 'One Hit', 'Two Hits', 'Kaichū — Perfect!'],
    rowCenter: 'Bullseye {p} pts', rowHit: 'Hit {p} pts', rowMiss: 'Miss',
    rowRun: 'Run time', rowRunVal: '{t} s  +{b} pts', rowAll: 'All hit', rowAllVal: '+{b} pts',
    points: 'pts',
    newRecord: 'New record! (previous {b} pts)', firstRecord: 'First record', bestRecord: 'Best {b} pts',
    share: 'Share', shareX: 'Post on X', copyLink: 'Copy link', copied: 'Copied!',
    shareText: 'Yabusame: {title} {score} pts ({diff}) {marks}{retry} #yabusame',
  },
};

let lang = (() => {
  try { const v = JSON.parse(localStorage.getItem('yabusame.lang')); if (DICT[v]) return v; } catch { /* 無視 */ }
  return (navigator.language || 'ja').toLowerCase().startsWith('ja') ? 'ja' : 'en';
})();

export const getLang = () => lang;
export function setLang(l) {
  if (!DICT[l]) return;
  lang = l;
  try { localStorage.setItem('yabusame.lang', JSON.stringify(l)); } catch { /* 無視 */ }
  applyI18n();
}
export function t(key, params = {}) {
  let v = DICT[lang][key] ?? DICT.ja[key] ?? key;
  if (typeof v === 'string') {
    v = v.replace(/\{(\w+)\}/g, (_, k) => (k === 'name' && typeof params.n === 'number' ? DICT[lang].targetNames[params.n] : params[k] ?? ''));
  }
  return v;
}
export function applyI18n() {
  document.documentElement.lang = lang;
  document.title = t('pageTitle');
  document.querySelectorAll('[data-i18n]').forEach(el => { el.innerHTML = t(el.dataset.i18n); });
  document.querySelectorAll('#lang button').forEach(b => b.classList.toggle('on', b.dataset.v === lang));
  const pv = document.getElementById('privacy');
  if (pv) pv.href = t('privacyUrl');
}
