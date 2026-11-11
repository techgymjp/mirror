/* 犬も歩けば鏡に当たる — ゲーム本体 */
(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  // Android アプリ（Capacitor）で動いているか。Web 版では Capacitor がないので何もしない
  const NATIVE = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  const plugin = name => (NATIVE && window.Capacitor.Plugins ? window.Capacitor.Plugins[name] : null);
  if (NATIVE) document.body.classList.add('native');
  const DIRS = Maze.DIRS;
  const t = I18N.t;
  const CAM_BACK = 0.42, CAM_Z_BEHIND = 0.56;
  const TURN_DUR = 0.11, BUMP_DUR = 0.42, STUN = 0.35, WARP_DUR = 0.9;
  const SAVE_KEY = 'inu-kagami-v2';

  // ---------- コース ----------
  // 手作りコース：# 鏡の壁 / . 床 / S スタート / E 本物の出口 / W ワープ扉 / B ほね
  const COURSES = {
    spiral: [
      '##E##########',
      '##.##########',
      '##.#.......##',
      '##.#.#####.##',
      '##.#.#...#.##',
      '#B.#.#.#.#.##',
      '##.#.#S#.#.B#',
      '##.#.###.#.##',
      '##.#.....#.##',
      '##.#######.##',
      '##.........##',
      '######.######',
      '#############',
    ],
    zigzag: [
      '#############',
      '#S..........W',
      '###########.#',
      'W...........#',
      '#.#####.#####',
      '#.....B.....W',
      '###########.#',
      'W..B........#',
      '#.###.#######',
      '#...........E',
      '#############',
    ],
  };

  // 10 ステージ。それぞれ形と仕掛けが違い、後半ほど難しい
  //   maze: 自動生成なら { w, h, loops, straight, twist, rooms, seed }、手作りなら { course }
  //   tint/tintColor: 鏡の色味  fog: 見える距離  speed: 走る速さ（マス/秒）
  //   speedUp: 時間とともに加速  lightning: 暗闇＋稲妻  mirrorWorld: 画面が左右反転
  //   compass: 方角表示  warpHint: ワープ扉の紫がかり（0 で本物と同じ見た目）
  const STAGES = [
    { maze: { w: 4, h: 4, loops: 1, seed: 509 }, bones: 2,
      tint: 0.26, tintColor: 'rgb(70,110,190)', fog: 11, speed: 2.4, compass: true, warpHint: 0.35 },
    { maze: { w: 6, h: 4, straight: 0.9, loops: 1, seed: 3624 }, bones: 2,
      tint: 0.22, tintColor: 'rgb(50,160,170)', sky: '#0f2228', floor: '#3f5a5c', fog: 12, speed: 2.7, compass: true, warpHint: 0.3 },
    { maze: { course: 'spiral' },
      tint: 0.2, tintColor: 'rgb(140,90,210)', sky: '#1d1238', floor: '#4f3a66', fog: 12, speed: 3.0, compass: true, warpHint: 0.25 },
    { maze: { course: 'zigzag' },
      tint: 0.18, tintColor: 'rgb(70,170,110)', sky: '#0f2418', floor: '#3c5a44', fog: 12, speed: 3.4, compass: true, warpHint: 0.2 },
    { maze: { w: 6, h: 6, loops: 3, rooms: 2, seed: 2384 }, bones: 3,
      tint: 0.15, tintColor: 'rgb(200,160,80)', sky: '#261d0e', floor: '#5e4c30', fog: 13, speed: 3.1, compass: true, warpHint: 0.1 },
    { maze: { w: 6, h: 6, loops: 4, seed: 5012 }, bones: 3,
      tint: 0.12, tintColor: 'rgb(60,70,170)', sky: '#05050c', floor: '#1a1826', fog: 3.2, lightning: true, speed: 2.8, compass: false, warpHint: 0 },
    { maze: { w: 11, h: 4, twist: 0.7, loops: 4, seed: 1610 }, bones: 3,
      tint: 0.11, tintColor: 'rgb(200,90,100)', sky: '#250e14', floor: '#5c3640', fog: 13, speed: 3.5, compass: false, warpHint: 0 },
    { maze: { w: 6, h: 6, loops: 5, seed: 409 }, bones: 3,
      tint: 0.1, tintColor: 'rgb(210,120,190)', sky: '#24102a', floor: '#5a3a5e', fog: 13, mirrorWorld: true, speed: 3.1, compass: false, warpHint: 0 },
    { maze: { w: 7, h: 7, loops: 6, seed: 7124 }, bones: 4,
      tint: 0.08, tintColor: 'rgb(220,130,60)', sky: '#26140a', floor: '#5e4030', fog: 14, speed: 3.0, speedUp: { per: 25, max: 1.8 }, compass: false, warpHint: 0 },
    { maze: { w: 9, h: 9, loops: 10, rooms: 1, seed: 4667 }, bones: 5,
      tint: 0.05, tintColor: 'rgb(150,160,210)', fog: 15, speed: 3.6, speedUp: { per: 60, max: 1.35 }, compass: false, warpHint: 0 },
  ];
  function randomCfg() {
    const seed = (Math.random() * 1e9) | 0;
    const r = Maze.mulberry32(seed);
    const n = 6 + Math.floor(r() * 3);
    return { maze: { w: n, h: n, loops: 5 + Math.floor(r() * 5), rooms: Math.floor(r() * 2), seed }, bones: 4,
      tint: 0.08, fog: 14, speed: 3.8, compass: false, warpHint: 0, random: true };
  }
  // ステージの名前と説明は表示言語に合わせて辞書から
  const stageName = c => t(c.random ? 'stage.random.name' : 'stage.' + (STAGES.indexOf(c) + 1) + '.name');
  const stageDesc = c => t(c.random ? 'stage.random.desc' : 'stage.' + (STAGES.indexOf(c) + 1) + '.desc');
  function buildLevel(c) {
    if (c.maze.course) return Maze.fromAscii(COURSES[c.maze.course], 7);
    return Maze.generate(Object.assign({ bones: c.bones }, c.maze));
  }
  // 見える距離（「どこまでも続く」感じを出すため、全体に遠くまで描く）
  const FOG_SCALE = 1.7, MAX_BOUNCE = 24;

  // ---------- 状態 ----------
  const canvas = $('screen');
  const view = $('view');
  const renderer = new Renderer(canvas);
  let state = 'title';   // title | ready | play | paused | clear
  let stageIdx = 0, cfg = null, level = null, p = null, stats = null;
  let bones = [], visited = null, enteredWarps = null;
  let showMap = true, readyTimer = 0, flashTimer = 0, flashColor = '#fff';
  let demo = null, clock = 0;
  let rcfg = null, lightning = null, speedLevel = 1;
  let camBehind = true;
  try { camBehind = localStorage.getItem('inu-kagami-cam') !== 'eye'; } catch (e) { /* noop */ }
  let save = loadSave();

  function loadSave() {
    try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || { stages: {} }; } catch (e) { return { stages: {} }; }
  }
  function writeSave() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* 保存できなくても遊べる */ } }

  // ---------- 画面サイズ ----------
  function resize() {
    const w = view.clientWidth || window.innerWidth, h = view.clientHeight || window.innerHeight;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const H = Math.max(240, Math.min(400, Math.round(h * dpr / 2)));
    const W = Math.max(180, Math.min(720, Math.round(H * w / h)));
    renderer.resize(W, H);
  }
  window.addEventListener('resize', resize);

  // ---------- ステージ開始 ----------
  let clearTimer = null;
  function startStage(i) {
    Sound.unlock();
    clearTimeout(clearTimer);
    clearTimeout(overTimer);
    closeRedo(false);
    stageIdx = i;
    cfg = i < STAGES.length ? STAGES[i] : randomCfg();
    level = buildLevel(cfg);
    rcfg = Object.assign({}, cfg, { fog: cfg.fog * (cfg.lightning ? 1 : FOG_SCALE), maxBounce: MAX_BOUNCE });
    renderer.setLevel(level, rcfg);
    lightning = { next: 2.5, t: 0 };
    speedLevel = 1;
    canvas.style.setProperty('--flip', cfg.mirrorWorld ? -1 : 1);
    const s = level.start;
    p = {
      cx: s.x, cy: s.y, dir: s.dir, x: s.x + 0.5, y: s.y + 0.5, ang: s.dir * Math.PI / 2,
      mode: 'wait', t: 0, running: false, queued: null, walk: 0, from: null, to: null,
    };
    bones = level.bones.map(b => ({ x: b.x + 0.5, y: b.y + 0.5, cx: b.x, cy: b.y, taken: false }));
    stats = { time: 0, warps: 0, bumps: 0, bones: 0, got: 0, redo: 0 }; // bones = 手持ち（お守り）, got = 拾った数
    visited = new Set([s.x + ',' + s.y]);
    enteredWarps = new Set();
    showOverlay(null);
    $('hud').hidden = false;
    $('stageName').textContent = cfg.random ? stageName(cfg) : t('hud.stage', { n: i + 1, name: stageName(cfg) });
    $('compass').hidden = !cfg.compass;
    state = 'ready';
    Sound.music('play');
    readyTimer = 1.2;
    popup(t('pop.ready'), 'ready');
    hint(stageDesc(cfg) + (i === 0 ? ' — ' + t(isTouch ? 'hint.firstTouch' : 'hint.firstKeys') : ''), 4);
    updateHud(true);
  }

  // ---------- 入力 ----------
  // 操作は左右だけ。曲がり角に着くまでに同じ向きへ2回フリックすると、向きが2回変わって後ろを向く
  function turn(d) {
    if (!p || p.dead) return;
    if (state !== 'play' && state !== 'ready') return;
    let q = (p.queued || 0) + d;
    if (q > 2) q = 2;
    if (q < -2) q = 2;
    if (q === -2) q = 2;
    p.queued = q === 0 ? null : q;
    Sound.flick(q === 2 ? 0 : d);
  }
  function toggleMap() { showMap = !showMap; $('minimap').hidden = !showMap; }

  const KEYMAP = {
    ArrowLeft: () => turn(-1), a: () => turn(-1), A: () => turn(-1),
    ArrowRight: () => turn(1), d: () => turn(1), D: () => turn(1),
    m: toggleMap, M: toggleMap,
  };
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') { togglePause(); e.preventDefault(); return; }
    if (state === 'title' && (e.key === 'Enter')) { playStage(firstUncleared()); return; }
    if (state === 'over' && !$('over').hidden && (e.key === 'Enter' || e.key === ' ')) { playStage(sameStage()); e.preventDefault(); return; }
    const f = KEYMAP[e.key];
    if (f && (state === 'play' || state === 'ready')) { if (!e.repeat) f(); e.preventDefault(); }
  });

  // フリック（スワイプ）検出
  const isTouch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  let ptr = null;
  view.addEventListener('pointerdown', e => {
    if (e.target.closest('button')) return;
    Sound.unlock();
    ptr = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), fired: false };
  });
  view.addEventListener('pointermove', e => {
    if (!ptr || ptr.id !== e.pointerId || ptr.fired) return;
    const dx = e.clientX - ptr.x, dy = e.clientY - ptr.y;
    const th = Math.max(28, Math.min(view.clientWidth, view.clientHeight) * 0.06);
    if (Math.hypot(dx, dy) < th) return;
    ptr.fired = true;
    // 横方向のフリックだけ受け付ける
    if (Math.abs(dx) > Math.abs(dy) * 0.8) turn(dx > 0 ? 1 : -1);
    else ptr.fired = false;
  });
  function endPtr(e) {
    if (!ptr || ptr.id !== e.pointerId) return;
    ptr = null;
  }
  view.addEventListener('pointerup', endPtr);
  view.addEventListener('pointercancel', endPtr);
  // iOS のスクロール・ズームを防ぐ
  // プレイ中だけ画面のスクロールを止める（タイトルなどのメニューはスクロールできるように）
  view.addEventListener('touchmove', e => { if (!e.target.closest('.overlay')) e.preventDefault(); }, { passive: false });

  $('btnMap').addEventListener('click', toggleMap);
  $('btnPause').addEventListener('click', togglePause);
  function syncCam() {
    const b = $('btnCam');
    b.textContent = camBehind ? '🐕' : '👁';
    b.setAttribute('aria-label', t(camBehind ? 'cam.toEye' : 'cam.toBehind'));
    b.title = t(camBehind ? 'cam.titleBehind' : 'cam.titleEye');
  }
  $('btnCam').addEventListener('click', () => {
    camBehind = !camBehind;
    try { localStorage.setItem('inu-kagami-cam', camBehind ? 'behind' : 'eye'); } catch (e) { /* noop */ }
    syncCam();
  });
  syncCam();

  // ---------- 動き ----------
  function cellAt(x, y) {
    if (x < 0 || y < 0 || x >= level.W || y >= level.H) return 1;
    return level.map[y][x];
  }

  function decide() {
    if (p.queued !== null) {
      const d = p.queued;
      // 予約した曲がりは、その向きに曲がれるマスに着くまで持ち越す（早めのフリックでも壁に突っこまない）
      // ゴンのあとに止まっているときだけは、その場で向きを変える
      if (!p.halted) {
        const nd = (p.dir + (d === 2 ? 2 : d) + 4) % 4;
        const tc = cellAt(p.cx + DIRS[nd][0], p.cy + DIRS[nd][1]);
        if (tc === 1) { if (p.running) return goStraight(); p.mode = 'wait'; return; }
      }
      p.queued = null;
      p.mode = 'turn'; p.t = 0;
      p.fromAng = p.ang; p.toAng = p.ang + (d === 2 ? Math.PI : d * Math.PI / 2);
      p.dir = (p.dir + (d === 2 ? 2 : d) + 4) % 4;
      return;
    }
    if (!p.running) { p.mode = 'wait'; return; }
    goStraight();
  }

  function goStraight() {
    const [dx, dy] = DIRS[p.dir];
    const nx = p.cx + dx, ny = p.cy + dy;
    const c = cellAt(nx, ny);
    // ゴンのあとは、道が開いている方を向くまでその場で待つ
    if (p.halted) {
      if (c === 1) { p.mode = 'wait'; return; }
      p.halted = false;
    }
    p.t = 0;
    p.from = { x: p.cx + 0.5, y: p.cy + 0.5 };
    if (c === 0) { p.mode = 'move'; p.to = { x: nx + 0.5, y: ny + 0.5, cx: nx, cy: ny }; }
    else if (c === 1) { p.mode = 'bump'; p.dx = dx; p.dy = dy; }
    else if (c === 2) { p.mode = 'exit'; p.to = { x: p.cx + 0.5 + dx * 0.75, y: p.cy + 0.5 + dy * 0.75 }; }
    else if (c === 3) { p.mode = 'warpIn'; p.warpCell = nx + ',' + ny; p.to = { x: p.cx + 0.5 + dx * 0.6, y: p.cy + 0.5 + dy * 0.6 }; }
  }

  function arrive() {
    p.cx = p.to.cx; p.cy = p.to.cy;
    p.x = p.cx + 0.5; p.y = p.cy + 0.5;
    visited.add(p.cx + ',' + p.cy);
    Sound.step();
    for (const b of bones) {
      if (!b.taken && b.cx === p.cx && b.cy === p.cy) {
        b.taken = true; stats.bones++; stats.got++; Sound.bone(); popup(t('pop.bone'), 'small'); bumpHudBone(); updateHud(true);
      }
    }
  }

  function doBump() {
    stats.bumps++;
    Sound.bump();
    popup(t('pop.bonk'), 'bump');
    view.classList.remove('shake'); void view.offsetWidth; view.classList.add('shake');
    if (navigator.vibrate) { try { navigator.vibrate(80); } catch (e) { /* noop */ } }
    flash('rgba(200,220,255,0.5)', 0.18);
    p.queued = null;
    if (stats.bones > 0) {
      // ほねがお守りになって 1 回だけ助かる（ほねは 1 本なくなる）
      stats.bones--;
      bumpHudBone();
      updateHud(true);
      setTimeout(() => {
        if (state !== 'play') return;
        Sound.saved();
        popup(t('pop.saved'), 'save');
        flash('rgba(255,236,190,0.6)', 0.35);
      }, 380);
      return;
    }
    Sound.whine();
    p.dead = true;
  }

  function bumpHudBone() {
    const el = $('hudBoneWrap');
    el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse');
  }

  // 1回でも鏡に当たったらゲームオーバー
  let overTimer = null;
  function gameOver() {
    state = 'over';
    Sound.music('calm');
    Sound.gameover();
    popup(t('pop.gameover'), 'ready');
    // アプリでは、ぶつかった様子を見届けてから「広告を見てつづきから」を提案する
    if (Ads.canReward && stats.redo < REDO_MAX) overTimer = setTimeout(showRedo, REDO_DELAY * 1000);
    else overTimer = setTimeout(showOverResult, 1400);
  }
  function overProgress() {
    const reached = level.pathLen - Math.max(0, level.exitDist[p.cy][p.cx]);
    return Math.max(0, Math.min(99, Math.round(reached / level.pathLen * 100)));
  }
  function showOverResult() {
    if (state !== 'over') return;
    lastResult = { clear: false, pct: overProgress() };
    $('overKicker').textContent = t('over.kicker', { where: cfg.random ? stageName(cfg) : 'STAGE ' + (stageIdx + 1) });
    $('overStats').innerHTML = row(t('row.time'), fmtTime(stats.time)) + row(t('row.progress'), overProgress() + '%') + row(t('row.warps'), times(stats.warps)) +
      row(t('row.saves'), times(Math.max(0, stats.bumps - 1 - stats.redo))) + (stats.redo ? row(t('row.redo'), times(stats.redo)) : '') + row(t('row.bones'), stats.got + ' / ' + bones.length);
    $('hud').hidden = true;
    showOverlay('over');
  }

  // ---------- リワード広告のチート：鏡にぶつかったところから、つづきをやり直す（アプリのみ・1 ステージ 3 回まで） ----------
  const REDO_DELAY = 2.2;   // ぶつかった様子を見届けてから出す
  const REDO_WAIT = 6;      // 何もしなければ自動でゲームオーバー画面へ
  const REDO_MAX = 3;
  const redo = { active: false, busy: false, t: 0 };
  function showRedo() {
    if (state !== 'over') return;
    Object.assign(redo, { active: true, busy: false, t: REDO_WAIT });
    $('redoWatch').disabled = false;
    $('redoWatch').textContent = t('redo.watch');
    $('redoNote').textContent = t('redo.note', { n: REDO_MAX - stats.redo });
    $('redo').hidden = false;
  }
  function closeRedo(showResult) {
    if (!redo.active) return;
    redo.active = false;
    $('redo').hidden = true;
    if (showResult) showOverResult();
  }
  function updateRedo(dt) {
    if (!redo.active || redo.busy) return;
    redo.t -= dt;
    $('redoSkip').textContent = t('redo.skip', { s: Math.max(0, Math.ceil(redo.t)) });
    if (redo.t <= 0) closeRedo(true);
  }
  $('redoSkip').addEventListener('click', () => closeRedo(true));
  $('redoWatch').addEventListener('click', async () => {
    if (!redo.active || redo.busy) return;
    redo.busy = true;
    $('redoWatch').disabled = true;
    $('redoWatch').textContent = t('redo.loading');
    const result = await Ads.showRewarded();
    if (!redo.active) return;
    if (result === 'unavailable') {
      $('redoNote').textContent = t('redo.fail');
      setTimeout(() => closeRedo(true), 1800);
      return;
    }
    if (result !== 'rewarded') { closeRedo(true); return; }
    closeRedo(false);
    revive();
  });
  // ぶつかった場所で止まった状態から再開（フリックで向きを変えると走り出す）
  function revive() {
    stats.redo++;
    p.dead = false;
    p.queued = null;
    p.halted = true;
    p.mode = 'wait';
    state = 'play';
    Sound.music('play');
    popup(t('pop.continue'), 'small');
    hint(t(isTouch ? 'hint.turnTouch' : 'hint.turnKeys'), 2.6);
    updateHud(true);
  }

  function warpTo() {
    stats.warps++;
    enteredWarps.add(p.warpCell);
    // 出口から遠すぎず近すぎない、知らない場所へ
    const cand = [];
    for (let y = 1; y < level.H; y += 2) for (let x = 1; x < level.W; x += 2) {
      const d = level.exitDist[y][x];
      if (d < 0) continue;
      if (Math.abs(x - p.cx) + Math.abs(y - p.cy) < 4) continue;
      if (d < level.pathLen * 0.35) continue;
      cand.push({ x, y });
    }
    const c = cand.length ? cand[Math.floor(Math.random() * cand.length)] : level.start;
    const opens = [0, 1, 2, 3].filter(d => cellAt(c.x + DIRS[d][0], c.y + DIRS[d][1]) === 0);
    p.cx = c.x; p.cy = c.y; p.x = c.x + 0.5; p.y = c.y + 0.5;
    p.dir = opens.length ? opens[Math.floor(Math.random() * opens.length)] : p.dir;
    p.ang = p.dir * Math.PI / 2;
    visited.add(c.x + ',' + c.y);
    updateHud(true);
  }

  function dogSprite(x, y, ang, frame) {
    const D = Sprites.DOG;
    return { kind: 'dog', x, y, z: D.z, w: D.w, h: D.h, fx: Math.cos(ang), fy: Math.sin(ang), frame };
  }

  function curSpeed() {
    if (!cfg.speedUp) return cfg.speed;
    return cfg.speed * Math.min(cfg.speedUp.max, 1 + stats.time / cfg.speedUp.per);
  }

  // 稲妻：ときどき一瞬だけ遠くまで見える
  function updateLightning(dt) {
    if (!cfg.lightning) return;
    lightning.next -= dt;
    if (lightning.next <= 0) {
      lightning.t = 0.9;
      lightning.next = 1.6 + Math.random() * 1.6;
      flash('rgba(200,210,255,0.55)', 0.25);
      Sound.thunder();
    }
    if (lightning.t > 0) lightning.t -= dt;
    const k = Math.max(0, lightning.t / 0.9);
    rcfg.fog = cfg.fog + (16 - cfg.fog) * Math.pow(k, 0.6);
  }

  function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  function updatePlayer(dt) {
    const speed = curSpeed();
    let guard = 0;
    while (guard++ < 4) {
      if (p.mode === 'wait') { decide(); if (p.mode === 'wait') return; continue; }
      if (p.mode === 'move') {
        p.t += dt * speed;
        p.walk += dt * speed;
        const k = Math.min(1, p.t);
        p.x = p.from.x + (p.to.x - p.from.x) * k;
        p.y = p.from.y + (p.to.y - p.from.y) * k;
        if (p.t < 1) return;
        dt = (p.t - 1) / speed;
        arrive();
        p.mode = 'wait';
        if (state !== 'play') return;
        continue;
      }
      if (p.mode === 'turn') {
        p.t += dt / TURN_DUR;
        const k = Math.min(1, p.t);
        p.ang = p.fromAng + (p.toAng - p.fromAng) * ease(k);
        if (p.t < 1) return;
        p.ang = p.dir * Math.PI / 2;
        p.mode = 'wait';
        dt = 0;
        continue;
      }
      if (p.mode === 'bump') {
        const before = p.t;
        p.t += dt / BUMP_DUR;
        const k = Math.min(1, p.t);
        // 鏡にぶつかる → はね返る
        const hitAt = 0.35;
        const o = k < hitAt ? (k / hitAt) * 0.42 : 0.42 * (1 - ease((k - hitAt) / (1 - hitAt)));
        p.x = p.from.x + p.dx * o; p.y = p.from.y + p.dy * o;
        p.walk += dt * speed;
        if (before < hitAt && p.t >= hitAt) doBump();
        if (p.t < 1) return;
        p.x = p.from.x; p.y = p.from.y;
        p.mode = 'stun'; p.t = 0; p.halted = true;
        if (p.dead) gameOver();
        return;
      }
      if (p.mode === 'stun') {
        p.t += dt;
        if (p.t < STUN) return;
        p.mode = 'wait';
        if (p.queued === null) hint(t(isTouch ? 'hint.turnTouch' : 'hint.turnKeys'), 2.4);
        continue;
      }
      if (p.mode === 'exit' || p.mode === 'warpIn') {
        p.t += dt * speed * 1.4;
        p.walk += dt * speed;
        const k = Math.min(1, p.t);
        p.x = p.from.x + (p.to.x - p.from.x) * k;
        p.y = p.from.y + (p.to.y - p.from.y) * k;
        if (p.t < 1) return;
        if (p.mode === 'exit') { clearStage(); return; }
        p.mode = 'warp'; p.t = 0;
        Sound.warp();
        popup(t('pop.warp'), 'warp');
        flash('rgba(170,80,255,1)', WARP_DUR);
        return;
      }
      if (p.mode === 'warp') {
        const before = p.t;
        p.t += dt;
        if (before < WARP_DUR * 0.45 && p.t >= WARP_DUR * 0.45) warpTo();
        if (p.t < WARP_DUR) return;
        p.mode = 'wait';
        popup(t('pop.where'), 'small');
        return;
      }
      return;
    }
  }

  // ---------- クリア ----------
  function clearStage() {
    state = 'clear';
    Sound.music('calm');
    Sound.clear();
    popup(t('pop.bark'), 'bark');
    flash('rgba(255,240,200,1)', 0.8);
    // ワープとゴン（ほねで助かった回数）が少ないほど ★ が多い
    const miss = stats.warps + stats.bumps;
    const stars = miss === 0 ? 3 : miss <= 2 ? 2 : 1;
    let best = false;
    if (!cfg.random) {
      const prev = save.stages[stageIdx];
      if (!prev || stars > prev.stars || (stars === prev.stars && stats.time < prev.time)) {
        save.stages[stageIdx] = { stars, time: Math.round(stats.time * 10) / 10, warps: stats.warps, bumps: stats.bumps };
        best = !!prev;
      }
      writeSave();
    }
    clearTimer = setTimeout(() => {
      if (state !== 'clear') return;
      $('clearStars').textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
      $('clearTitle').textContent = cfg.random ? t('clear.title') : t('clear.titleStage', { n: stageIdx + 1 });
      $('clearStats').innerHTML =
        row(t('row.time'), fmtTime(stats.time)) + row(t('row.warps'), times(stats.warps)) +
        row(t('row.saves'), times(stats.bumps - stats.redo)) + (stats.redo ? row(t('row.redo'), times(stats.redo)) : '') +
        row(t('row.bones'), stats.got + ' / ' + bones.length) + (best ? '<p class="best">' + t('clear.best') + '</p>' : '');
      lastResult = { clear: true, stars };
      $('btnNext').hidden = !(cfg.random || stageIdx + 1 < STAGES.length);
      $('btnNext').textContent = t(cfg.random ? 'btn.another' : 'btn.next');
      $('hud').hidden = true;
      showOverlay('clear');
    }, 1300);
  }
  const times = n => t('unit.times', { n });
  function row(k, v) { return '<div class="row"><span>' + k + '</span><b>' + v + '</b></div>'; }
  function fmtTime(t) { const m = Math.floor(t / 60), s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1); }

  // ---------- 演出 ----------
  let popupTimer = null;
  function popup(text, kind) {
    const el = $('popup');
    el.textContent = text;
    el.className = 'popup show ' + (kind || '');
    clearTimeout(popupTimer);
    popupTimer = setTimeout(() => { el.className = 'popup'; }, kind === 'ready' ? 1500 : 900);
  }
  let hintTimer = null;
  function hint(text, sec) {
    const el = $('hint');
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => el.classList.remove('show'), (sec || 3.5) * 1000);
  }
  function flash(color, sec) { flashColor = color; flashTimer = sec; flashDur = sec; }
  let flashDur = 1;
  // 予約中の曲がりを、実行されるまで表示しておく
  let turnIndShown = null;
  function syncTurnIndicator() {
    const q = state === 'play' || state === 'ready' ? p.queued : null;
    if (q === turnIndShown) return;
    turnIndShown = q;
    const el = $('turnInd');
    if (q === null) { el.className = 'turn-ind'; return; }
    el.textContent = q === -1 ? '↰' : q === 1 ? '↱' : '↶↶';
    el.className = 'turn-ind show';
  }

  // ---------- HUD ----------
  let lastTimeStr = '';
  function updateHud(force) {
    if (!stats) return;
    const ts = fmtTime(stats.time);
    if (ts !== lastTimeStr || force) { $('hudTime').textContent = ts; lastTimeStr = ts; }
    if (force) {
      $('hudWarp').textContent = stats.warps;
      $('hudBone').textContent = stats.bones;
    }
    if (cfg && cfg.compass) {
      $('compassNeedle').style.transform = 'rotate(' + (-(p.ang * 180 / Math.PI) - 90) + 'deg)';
      $('compassLabel').textContent = t('compass.to', { d: t('dir.' + (((Math.round(p.ang / (Math.PI / 2)) % 4) + 4) % 4)) });
    }
  }

  function drawMinimap() {
    if (!showMap) return;
    const mm = $('minimap'), g = mm.getContext('2d');
    const size = mm.width, cs = size / level.W;
    g.clearRect(0, 0, size, size);
    g.fillStyle = 'rgba(10,8,20,0.65)'; g.fillRect(0, 0, size, size);
    const known = new Set();
    visited.forEach(k => {
      const [x, y] = k.split(',').map(Number);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) known.add((x + dx) + ',' + (y + dy));
    });
    known.forEach(k => {
      const [x, y] = k.split(',').map(Number);
      const c = cellAt(x, y);
      if (c === 0) g.fillStyle = visited.has(k) ? 'rgba(255,214,150,0.55)' : 'rgba(255,214,150,0.18)';
      else if (c === 1) g.fillStyle = 'rgba(170,190,240,0.75)';
      else if (c === 3 && enteredWarps.has(k)) g.fillStyle = '#b061ff';
      else g.fillStyle = '#ffc54d';
      g.fillRect(x * cs, y * cs, cs + 0.5, cs + 0.5);
      if (c === 3 && enteredWarps.has(k)) {
        g.strokeStyle = '#fff'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(x * cs + 2, y * cs + 2); g.lineTo(x * cs + cs - 2, y * cs + cs - 2);
        g.moveTo(x * cs + cs - 2, y * cs + 2); g.lineTo(x * cs + 2, y * cs + cs - 2); g.stroke();
      }
    });
    // 自分
    g.save();
    g.translate(p.x * cs, p.y * cs); g.rotate(p.ang);
    g.fillStyle = '#ff6b3d';
    g.beginPath(); g.moveTo(cs * 0.55, 0); g.lineTo(-cs * 0.35, cs * 0.35); g.lineTo(-cs * 0.35, -cs * 0.35); g.closePath(); g.fill();
    g.restore();
  }

  // ---------- 画面切替 ----------
  function showOverlay(id) {
    for (const o of ['title', 'howto', 'pause', 'clear', 'over']) $(o).hidden = o !== id;
  }
  function togglePause() {
    if (state === 'play' || state === 'ready') { state = 'paused'; showOverlay('pause'); Sound.music('calm'); }
    else if (state === 'paused') { state = readyTimer > 0 ? 'ready' : 'play'; showOverlay(null); Sound.music('play'); }
  }
  function firstUncleared() {
    for (let i = 0; i < STAGES.length; i++) if (!save.stages[i]) return i;
    return 0;
  }
  function toTitle() {
    clearTimeout(clearTimer);
    clearTimeout(overTimer);
    closeRedo(false);
    state = 'title';
    Sound.music('title');
    $('hud').hidden = true;
    buildStageList();
    showOverlay('title');
    startDemo();
  }
  function buildStageList() {
    const list = $('stageList');
    list.innerHTML = '';
    STAGES.forEach((s, i) => {
      const rec = save.stages[i];
      const unlocked = i === 0 || !!save.stages[i - 1];
      const b = document.createElement('button');
      b.className = 'stage-btn';
      b.disabled = !unlocked;
      b.innerHTML = '<span class="no">' + (i + 1) + '</span><span class="nm">' + (unlocked ? stageName(s) : t('stage.locked')) +
        (unlocked ? '<small>' + stageDesc(s) + '</small>' : '') + '</span>' +
        '<span class="st">' + (rec ? '★'.repeat(rec.stars) + '☆'.repeat(3 - rec.stars) : unlocked ? t('stage.new') : '🔒') + '</span>';
      b.addEventListener('click', () => playStage(i));
      list.appendChild(b);
    });
    const allClear = STAGES.every((_, i) => save.stages[i]);
    const r = document.createElement('button');
    r.className = 'stage-btn random';
    r.disabled = !allClear;
    r.innerHTML = '<span class="no">?</span><span class="nm">' + (allClear ? t('stage.random.name') : t('stage.unlockRandom')) + '</span><span class="st">∞</span>';
    r.addEventListener('click', () => playStage(STAGES.length));
    list.appendChild(r);
  }

  // ---------- 全画面広告（アプリのみ） ----------
  // プレイを始める・タイトルに戻る・ポーズから再開・結果画面からもう一度 / 次へ、のたびに毎回出す
  let adBusy = false;
  async function withInterstitial(next) {
    if (adBusy) return;
    if (Ads.available) {
      adBusy = true;
      updateBanner();
      await Ads.showInterstitial(3000);
      adBusy = false;
    }
    next();
  }
  const playStage = i => withInterstitial(() => startStage(i));
  const backToTitle = () => withInterstitial(toTitle);
  const sameStage = () => (cfg.random ? STAGES.length : stageIdx);

  $('btnHowto').addEventListener('click', () => showOverlay('howto'));
  $('btnHowtoBack').addEventListener('click', () => withInterstitial(() => showOverlay('title')));
  $('btnResume').addEventListener('click', () => withInterstitial(togglePause));
  $('btnRetry').addEventListener('click', () => playStage(stageIdx));
  $('btnQuit').addEventListener('click', backToTitle);
  $('btnNext').addEventListener('click', () => playStage(cfg.random ? STAGES.length : stageIdx + 1));
  $('btnAgain').addEventListener('click', () => playStage(stageIdx));
  $('btnTitle').addEventListener('click', backToTitle);
  $('btnOverRetry').addEventListener('click', () => playStage(sameStage()));
  $('btnOverTitle').addEventListener('click', backToTitle);

  // ---------- バナー広告：タイトル・あそびかた・ポーズ・結果画面だけ（プレイ中は出さない） ----------
  function updateBanner() {
    const menu = ['title', 'howto', 'pause', 'clear', 'over'].some(id => !$(id).hidden);
    Ads.setBanner(menu && !redo.active && !adBusy);
  }

  // ---------- シェア ----------
  let lastResult = null;
  async function shareResult() {
    if (!lastResult) return;
    const where = cfg.random ? stageName(cfg) : t('share.where', { n: stageIdx + 1, name: stageName(cfg) });
    const parts = [stats.warps ? t('share.warps', { n: stats.warps }) : '', stats.redo ? t('share.redo', { n: stats.redo }) : ''].filter(Boolean);
    const extra = parts.length ? t('share.extra', { x: parts.join(t('share.sep')) }) : '';
    const text = lastResult.clear
      ? t('share.clear', { where, stars: '★'.repeat(lastResult.stars) + '☆'.repeat(3 - lastResult.stars), time: fmtTime(stats.time), extra })
      : t('share.over', { where, pct: 100 - lastResult.pct, extra });
    const title = t('share.title');
    const nativeShare = plugin('Share');
    if (nativeShare) {
      try { await nativeShare.share({ title, text, dialogTitle: t('share.dialog') }); } catch (e) { /* キャンセル */ }
    } else if (navigator.share) {
      try { await navigator.share({ title, text, url: location.href }); } catch (e) { /* キャンセル */ }
    } else {
      window.open('https://twitter.com/intent/tweet?text=' + encodeURIComponent(text) + '&url=' + encodeURIComponent(location.href), '_blank');
    }
  }
  $('btnShareClear').addEventListener('click', shareResult);
  $('btnShareOver').addEventListener('click', shareResult);

  // ---------- アプリの動き ----------
  // 裏に回ったら一時停止して音を止める（広告の表示中は広告側が音を止めている）
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (state === 'play' || state === 'ready') togglePause();
      Sound.suspend();
    } else if (!Ads.showing) {
      Sound.resume();
    }
  });
  // Android の戻るボタン：プレイ中はポーズ（ポーズ中なら再開）、タイトル・結果画面ではアプリを終了
  if (plugin('App')) {
    plugin('App').addListener('backButton', () => {
      if (adBusy || Ads.showing) return;
      if (redo.active) { closeRedo(true); return; }
      if (state === 'title') {
        if (!$('howto').hidden) withInterstitial(() => showOverlay('title'));
        else plugin('App').exitApp();
      } else if (state === 'paused') withInterstitial(togglePause);
      else if (state === 'play' || state === 'ready') togglePause();
      else if ((state === 'clear' && !$('clear').hidden) || (state === 'over' && !$('over').hidden)) plugin('App').exitApp();
    });
  }
  // タイトル画面の下に、バージョン（アプリ版）・プライバシーポリシー・広告の設定（EU など）
  if (window.APP_VERSION && window.APP_VERSION !== 'dev') $('buildInfo').textContent = window.APP_VERSION;
  Ads.initDone.then(() => { if (Ads.privacyOptionsRequired) $('adPrivacy').hidden = false; });
  $('adPrivacyLink').addEventListener('click', e => { e.preventDefault(); Ads.showPrivacyOptions(); });
  function syncSound() {
    const m = Sound.isMuted();
    document.querySelectorAll('.btn-sound').forEach(b => { b.textContent = m ? '🔇' : '🔊'; b.setAttribute('aria-label', t(m ? 'snd.on' : 'snd.off')); });
    const on = Sound.isMusicOn();
    document.querySelectorAll('.btn-music').forEach(b => { b.classList.toggle('off', !on); b.setAttribute('aria-label', t(on ? 'bgm.off' : 'bgm.on')); });
  }
  document.querySelectorAll('.btn-music').forEach(b => b.addEventListener('click', () => {
    Sound.setMusicOn(!Sound.isMusicOn());
    try { localStorage.setItem(SAVE_KEY + '-bgm', Sound.isMusicOn() ? '1' : '0'); } catch (e) { /* noop */ }
    syncSound();
  }));
  try { if (localStorage.getItem(SAVE_KEY + '-bgm') === '0') Sound.setMusicOn(false); } catch (e) { /* noop */ }
  // ブラウザの自動再生制限：最初の操作で音を有効にする
  const unlockOnce = () => { Sound.unlock(); window.removeEventListener('pointerdown', unlockOnce); window.removeEventListener('keydown', unlockOnce); };
  window.addEventListener('pointerdown', unlockOnce);
  window.addEventListener('keydown', unlockOnce);
  document.querySelectorAll('.btn-sound').forEach(b => b.addEventListener('click', () => {
    Sound.setMuted(!Sound.isMuted());
    try { localStorage.setItem(SAVE_KEY + '-mute', Sound.isMuted() ? '1' : '0'); } catch (e) { /* noop */ }
    syncSound();
  }));
  try { Sound.setMuted(localStorage.getItem(SAVE_KEY + '-mute') === '1'); } catch (e) { /* noop */ }
  syncSound();

  // ---------- タイトル背景デモ ----------
  function startDemo() {
    canvas.style.setProperty('--flip', 1);
    const lv = Maze.generate(6, 8, 0, 777);
    const dcfg = { tint: 0.14, fog: 13 * FOG_SCALE, warpHint: 0, maxBounce: MAX_BOUNCE };
    let best = { x: 1, y: 1 };
    // 見通しのよい交差点を探す
    let bestOpen = 0;
    for (let y = 1; y < lv.H; y += 2) for (let x = 1; x < lv.W; x += 2) {
      let o = 0; for (const [dx, dy] of DIRS) if (lv.map[y + dy][x + dx] === 0) o++;
      if (o > bestOpen) { bestOpen = o; best = { x, y }; }
    }
    demo = { lv, cfg: dcfg, x: best.x + 0.5, y: best.y + 0.5, ang: 0 };
    renderer.setLevel(lv, dcfg);
  }

  // ---------- ループ ----------
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    clock += dt;

    if (state === 'title' && demo) {
      demo.ang += dt * 0.22;
      renderer.render({
        px: demo.x, py: demo.y, ang: demo.ang, bob: 0,
        sprites: [dogSprite(demo.x, demo.y, demo.ang, 0)],
      });
    } else if (level && p && $('clear').hidden && $('over').hidden) {
      // 結果画面の表示中は 3D の再描画を止めて、音の処理に余裕をもたせる
      if (state === 'ready') {
        readyTimer -= dt;
        if (readyTimer <= 0) { state = 'play'; p.running = true; popup(t('pop.go'), 'go'); Sound.bark(); }
      }
      if (state === 'play') {
        stats.time += dt;
        updateLightning(dt);
        if (cfg.speedUp) {
          const lv = Math.floor(curSpeed() / cfg.speed * 4);
          if (lv > speedLevel * 4 && lv > 4) { speedLevel = lv / 4; popup(t('pop.speedUp'), 'small'); }
        }
        updatePlayer(dt);
      } else if (state === 'clear' || state === 'over') {
        updatePlayer(0);
      }
      const moving = p.mode === 'move' || p.mode === 'bump' || p.mode === 'exit' || p.mode === 'warpIn';
      const fr = moving ? 1 + (((p.walk * 6.5) | 0) % 4) : 0;
      const bob = moving ? Math.sin(p.walk * Math.PI * 4) * 2.2 : 0;
      const sprites = [Object.assign(dogSprite(p.x, p.y, p.ang, fr), { self: true })];
      const B = Sprites.BONE;
      for (const b of bones) {
        if (b.taken) continue;
        const f = ((clock * B.fps + b.x * 3) | 0) % B.frames;
        sprites.push({ img: B.sheet, sx: f * B.fw, sy: 0, fw: B.fw, fh: B.fh, x: b.x, y: b.y, z: 0.05 + 0.035 * Math.sin(clock * 2.6 + b.x), w: B.w, h: B.h });
      }
      // 背後カメラ：犬の少し後ろ・少し上から（自分の背中と、合わせ鏡にずらりと並ぶ自分が見える）
      const back = camBehind ? CAM_BACK : 0;
      renderer.render({ px: p.x - Math.cos(p.ang) * back, py: p.y - Math.sin(p.ang) * back, ang: p.ang, bob, sprites, camZ: camBehind ? CAM_Z_BEHIND : undefined });
      if (state !== 'paused') { updateHud(false); drawMinimap(); syncTurnIndicator(); }
    }

    if (state === 'over') updateRedo(dt);
    updateBanner();

    // フラッシュ
    const fl = $('flash');
    if (flashTimer > 0) {
      flashTimer -= dt;
      fl.style.background = flashColor;
      const k = Math.max(0, flashTimer / flashDur);
      fl.style.opacity = flashColor.indexOf('170,80,255') >= 0 ? Math.sin(k * Math.PI) : k;
    } else fl.style.opacity = 0;

    requestAnimationFrame(frame);
  }

  // 表示言語：タイトル画面のボタンで切り替え
  document.querySelectorAll('[data-lang]').forEach(b => b.addEventListener('click', () => I18N.setLang(b.dataset.lang)));
  I18N.onChange(() => { buildStageList(); syncSound(); syncCam(); });
  I18N.apply();

  resize();
  toTitle();
  requestAnimationFrame(frame);

  // web-only:start
  // テスト・撮影用（アプリ用のビルドでは取り除く）
  window.__game = {
    get state() { return state; }, get player() { return p; }, get level() { return level; }, get stats() { return stats; },
    startStage, turn, STAGES,
  };
  // web-only:end
})();
