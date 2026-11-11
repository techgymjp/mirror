/* 犬も歩けば鏡に当たる — ゲーム本体 */
(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const DIRS = Maze.DIRS;
  const DIR_NAMES = ['東', '南', '西', '北'];
  const TURN_DUR = 0.14, BUMP_DUR = 0.42, STUN = 0.35, WARP_DUR = 0.9;
  const SAVE_KEY = 'inu-kagami-v1';

  const STAGES = [
    { name: 'はじめての鏡', cells: 4, loops: 0, bones: 2, tint: 0.26, fog: 11, speed: 1.8, compass: true, warpHint: 0.35, seed: 1203 },
    { name: '映りこむ廊下', cells: 5, loops: 2, bones: 3, tint: 0.18, fog: 12, speed: 2.1, compass: true, warpHint: 0.22, seed: 2207 },
    { name: 'あわせ鏡の間', cells: 6, loops: 4, bones: 3, tint: 0.13, fog: 13, speed: 2.4, compass: true, warpHint: 0.1, seed: 3301 },
    { name: 'ゆがむ方角', cells: 7, loops: 6, bones: 4, tint: 0.09, fog: 14, speed: 2.7, compass: false, warpHint: 0, seed: 4409 },
    { name: '鏡の大迷宮', cells: 8, loops: 9, bones: 5, tint: 0.06, fog: 15, speed: 3.0, compass: false, warpHint: 0, seed: 5501 },
  ];
  function randomCfg() {
    const seed = (Math.random() * 1e9) | 0;
    const r = Maze.mulberry32(seed);
    return { name: 'きまぐれ迷宮', cells: 6 + Math.floor(r() * 3), loops: 5 + Math.floor(r() * 5), bones: 4, tint: 0.08, fog: 14, speed: 2.8, compass: false, warpHint: 0, seed, random: true };
  }

  // ---------- 状態 ----------
  const canvas = $('screen');
  const view = $('view');
  const renderer = new Renderer(canvas);
  let state = 'title';   // title | ready | play | paused | clear
  let stageIdx = 0, cfg = null, level = null, p = null, stats = null;
  let bones = [], visited = null, enteredWarps = null;
  let showMap = true, readyTimer = 0, flashTimer = 0, flashColor = '#fff';
  let demo = null, clock = 0;
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
    stageIdx = i;
    cfg = i < STAGES.length ? STAGES[i] : randomCfg();
    level = Maze.generate(cfg.cells, cfg.loops, cfg.bones, cfg.seed);
    renderer.setLevel(level, cfg);
    const s = level.start;
    p = {
      cx: s.x, cy: s.y, dir: s.dir, x: s.x + 0.5, y: s.y + 0.5, ang: s.dir * Math.PI / 2,
      mode: 'wait', t: 0, running: false, queued: null, walk: 0, from: null, to: null,
    };
    bones = level.bones.map(b => ({ x: b.x + 0.5, y: b.y + 0.5, cx: b.x, cy: b.y, taken: false }));
    stats = { time: 0, warps: 0, bumps: 0, bones: 0, got: 0 }; // bones = 手持ち（お守り）, got = 拾った数
    visited = new Set([s.x + ',' + s.y]);
    enteredWarps = new Set();
    showOverlay(null);
    $('hud').hidden = false;
    $('stageName').textContent = (cfg.random ? '' : 'STAGE ' + (i + 1) + '　') + cfg.name;
    $('compass').hidden = !cfg.compass;
    state = 'ready';
    Sound.music('play');
    readyTimer = 1.6;
    popup('よーい…', 'ready');
    hint(isTouch ? '← → フリックで次の角を曲がる' : '← → キーで次の角を曲がる');
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
    Sound.turn();
    if (p.queued !== null) showTurnIndicator(p.queued);
  }
  function toggleMap() { showMap = !showMap; $('minimap').hidden = !showMap; }

  const KEYMAP = {
    ArrowLeft: () => turn(-1), a: () => turn(-1), A: () => turn(-1),
    ArrowRight: () => turn(1), d: () => turn(1), D: () => turn(1),
    m: toggleMap, M: toggleMap,
  };
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') { togglePause(); e.preventDefault(); return; }
    if (state === 'title' && (e.key === 'Enter')) { startStage(firstUncleared()); return; }
    if (state === 'over' && !$('over').hidden && (e.key === 'Enter' || e.key === ' ')) { startStage(cfg.random ? STAGES.length : stageIdx); e.preventDefault(); return; }
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
  view.addEventListener('touchmove', e => e.preventDefault(), { passive: false });

  $('btnMap').addEventListener('click', toggleMap);
  $('btnPause').addEventListener('click', togglePause);

  // ---------- 動き ----------
  function cellAt(x, y) {
    if (x < 0 || y < 0 || x >= level.W || y >= level.H) return 1;
    return level.map[y][x];
  }

  function decide() {
    if (p.queued !== null) {
      const d = p.queued; p.queued = null;
      p.mode = 'turn'; p.t = 0;
      p.fromAng = p.ang; p.toAng = p.ang + (d === 2 ? Math.PI : d * Math.PI / 2);
      p.dir = (p.dir + (d === 2 ? 2 : d) + 4) % 4;
      return;
    }
    if (!p.running) { p.mode = 'wait'; return; }
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
        b.taken = true; stats.bones++; stats.got++; Sound.bone(); popup('ほねゲット！ ゴン1回セーフ', 'small'); bumpHudBone(); updateHud(true);
      }
    }
  }

  function doBump() {
    stats.bumps++;
    Sound.bump();
    popup('ゴン！', 'bump');
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
        popup('ほねでセーフ！', 'save');
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
    popup('ゲームオーバー', 'ready');
    overTimer = setTimeout(() => {
      if (state !== 'over') return;
      const reached = level.pathLen - Math.max(0, level.exitDist[p.cy][p.cx]);
      const pct = Math.max(0, Math.min(99, Math.round(reached / level.pathLen * 100)));
      $('overKicker').textContent = '💥 ゴン！ ' + (cfg.random ? cfg.name : 'STAGE ' + (stageIdx + 1));
      $('overStats').innerHTML = row('タイム', fmtTime(stats.time)) + row('出口までの道のり', pct + '%') + row('ワープ', stats.warps + ' 回') + row('ほねでセーフ', stats.bumps - 1 + ' 回') + row('拾ったほね', stats.got + ' / ' + bones.length);
      $('hud').hidden = true;
      showOverlay('over');
    }, 1400);
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

  function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  function updatePlayer(dt) {
    const speed = cfg.speed;
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
        if (p.queued === null) hint(isTouch ? '← → フリックで向きを変えよう' : '← → で向きを変えよう', 2.4);
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
        popup('ワープ！？', 'warp');
        flash('rgba(170,80,255,1)', WARP_DUR);
        return;
      }
      if (p.mode === 'warp') {
        const before = p.t;
        p.t += dt;
        if (before < WARP_DUR * 0.45 && p.t >= WARP_DUR * 0.45) warpTo();
        if (p.t < WARP_DUR) return;
        p.mode = 'wait';
        popup('ここはどこ…？', 'small');
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
    popup('ワン！', 'bark');
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
      $('clearTitle').textContent = cfg.random ? '脱出成功！' : 'STAGE ' + (stageIdx + 1) + ' 脱出成功！';
      $('clearStats').innerHTML =
        row('タイム', fmtTime(stats.time)) + row('ワープ', stats.warps + ' 回') +
        row('ほねでセーフ', stats.bumps + ' 回') + row('拾ったほね', stats.got + ' / ' + bones.length) + (best ? '<p class="best">自己ベスト更新！</p>' : '');
      $('btnNext').hidden = !(cfg.random || stageIdx + 1 < STAGES.length);
      $('btnNext').textContent = cfg.random ? 'もう一つ' : '次のステージへ';
      $('hud').hidden = true;
      showOverlay('clear');
    }, 1300);
  }
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
  let turnIndTimer = null;
  function showTurnIndicator(d) {
    const el = $('turnInd');
    el.textContent = d === -1 ? '↰' : d === 1 ? '↱' : '↶↶';
    el.className = 'turn-ind show';
    clearTimeout(turnIndTimer);
    turnIndTimer = setTimeout(() => { el.className = 'turn-ind'; }, 450);
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
      $('compassLabel').textContent = DIR_NAMES[((Math.round(p.ang / (Math.PI / 2)) % 4) + 4) % 4] + 'へ';
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
      b.innerHTML = '<span class="no">' + (i + 1) + '</span><span class="nm">' + (unlocked ? s.name : '？？？') + '</span>' +
        '<span class="st">' + (rec ? '★'.repeat(rec.stars) + '☆'.repeat(3 - rec.stars) : unlocked ? 'NEW' : '🔒') + '</span>';
      b.addEventListener('click', () => startStage(i));
      list.appendChild(b);
    });
    const allClear = STAGES.every((_, i) => save.stages[i]);
    const r = document.createElement('button');
    r.className = 'stage-btn random';
    r.disabled = !allClear;
    r.innerHTML = '<span class="no">?</span><span class="nm">' + (allClear ? 'きまぐれ迷宮' : '全ステージクリアで解放') + '</span><span class="st">∞</span>';
    r.addEventListener('click', () => startStage(STAGES.length));
    list.appendChild(r);
  }

  $('btnHowto').addEventListener('click', () => showOverlay('howto'));
  $('btnHowtoBack').addEventListener('click', () => showOverlay('title'));
  $('btnResume').addEventListener('click', togglePause);
  $('btnRetry').addEventListener('click', () => startStage(stageIdx));
  $('btnQuit').addEventListener('click', toTitle);
  $('btnNext').addEventListener('click', () => startStage(cfg.random ? STAGES.length : stageIdx + 1));
  $('btnAgain').addEventListener('click', () => startStage(stageIdx));
  $('btnTitle').addEventListener('click', toTitle);
  $('btnOverRetry').addEventListener('click', () => startStage(cfg.random ? STAGES.length : stageIdx));
  $('btnOverTitle').addEventListener('click', toTitle);
  function syncSound() {
    const m = Sound.isMuted();
    document.querySelectorAll('.btn-sound').forEach(b => { b.textContent = m ? '🔇' : '🔊'; b.setAttribute('aria-label', m ? '音を出す' : '音を消す'); });
    const on = Sound.isMusicOn();
    document.querySelectorAll('.btn-music').forEach(b => { b.classList.toggle('off', !on); b.setAttribute('aria-label', on ? 'BGMを止める' : 'BGMを流す'); });
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
    const lv = Maze.generate(6, 8, 0, 777);
    const dcfg = { tint: 0.14, fog: 13, warpHint: 0 };
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
        if (readyTimer <= 0) { state = 'play'; p.running = true; popup('ワン！', 'go'); Sound.bark(); }
      }
      if (state === 'play') {
        stats.time += dt;
        updatePlayer(dt);
      } else if (state === 'clear' || state === 'over') {
        updatePlayer(0);
      }
      const moving = p.mode === 'move' || p.mode === 'bump' || p.mode === 'exit' || p.mode === 'warpIn';
      const fr = moving ? 1 + (((p.walk * 6.5) | 0) % 4) : 0;
      const bob = moving ? Math.sin(p.walk * Math.PI * 4) * 2.2 : 0;
      const sprites = [dogSprite(p.x, p.y, p.ang, fr)];
      const B = Sprites.BONE;
      for (const b of bones) {
        if (b.taken) continue;
        const f = ((clock * B.fps + b.x * 3) | 0) % B.frames;
        sprites.push({ img: B.sheet, sx: f * B.fw, sy: 0, fw: B.fw, fh: B.fh, x: b.x, y: b.y, z: 0.05 + 0.035 * Math.sin(clock * 2.6 + b.x), w: B.w, h: B.h });
      }
      renderer.render({ px: p.x, py: p.y, ang: p.ang, bob, sprites });
      if (state !== 'paused') { updateHud(false); drawMinimap(); }
    }

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

  resize();
  toTitle();
  requestAnimationFrame(frame);

  // テスト・デバッグ用
  window.__game = {
    get state() { return state; }, get player() { return p; }, get level() { return level; }, get stats() { return stats; },
    startStage, turn, STAGES,
  };
})();
