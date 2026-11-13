/*
 * Google Play 用の画像を撮る（docs/store/ に出力）
 *
 *   node tools/store-shots.js
 *
 * - スクリーンショット：縦 1080×1920（日本語・英語 各 6 枚）
 * - フィーチャーグラフィック：1024×500（日本語・英語）
 * - アイコン：512×512（appicon/icon-only.png から）
 * Web 版（index.html）を Playwright で開き、撮影用の window.__game で場面を作る。
 */
'use strict';
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'docs', 'store');
const URL = 'file://' + path.join(ROOT, 'index.html');

// 全ステージ解放・★をそろえた記録（タイトル画面用）
const SAVE = { stages: {} };
[3, 3, 2, 3, 2, 3, 1, 2, 3].forEach((s, i) => { SAVE.stages[i] = { stars: s, time: 20 + i * 3 }; });

async function open(browser, lang, viewport) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: lang === 'ja' ? 'ja-JP' : 'en-US' });
  await ctx.addInitScript(([save, lang]) => {
    localStorage.setItem('inu-kagami-v2', save);
    localStorage.setItem('inu-kagami-lang', lang);
    localStorage.setItem('inu-kagami-cam', 'behind');
  }, [JSON.stringify(SAVE), lang]);
  const pg = await ctx.newPage();
  await pg.goto(URL);
  await pg.waitForFunction(() => window.__game && document.fonts.status === 'loaded');
  // アプリの画面として撮るので、Web 版だけの Google Play へのリンクは消す
  await pg.evaluate(() => document.querySelectorAll('.store-link').forEach(e => e.remove()));
  await pg.waitForTimeout(900);
  return { ctx, pg };
}

// ステージを始めて、カウントダウンが終わったら犬を止めて置き直す
async function stage(pg, i, place) {
  await pg.evaluate(i => __game.startStage(i), i);
  await pg.waitForTimeout(1350);
  await pg.evaluate(place);
  await pg.evaluate(() => {
    document.getElementById('hint').classList.remove('show');
    document.getElementById('popup').className = 'popup';
  });
  await pg.waitForTimeout(450);
}

// 置き方
const PLACE = {
  // 両側が鏡のまっすぐな通路で、横の鏡を斜めに見る（自分がずらりと並ぶ）
  mirrorRow: `(() => {
    const g = __game, p = g.player, lv = g.level, m = lv.map;
    for (let y = 1; y < lv.H - 1; y++) for (let x = 2; x < lv.W - 2; x++) {
      if (m[y][x] === 0 && m[y-1][x] === 1 && m[y+1][x] === 1 && m[y][x-1] === 0 && m[y][x+1] === 0 && m[y-1][x-1] === 1 && m[y+1][x-1] === 1 && m[y-1][x+1] === 1 && m[y+1][x+1] === 1) {
        Object.assign(p, { cx: x, cy: y, x: x + .5, y: y + .5, dir: 1, ang: Math.PI / 2 - 0.45, mode: 'wait', queued: null, running: false }); return;
      }
    }
  })()`,
  // ほねの 2 マス手前から、行き止まりのワープ扉を見る
  boneWarp: `(() => {
    const g = __game, p = g.player, lv = g.level, D = [[1,0],[0,1],[-1,0],[0,-1]];
    for (const bn of lv.bones) {
      const od = [0,1,2,3].filter(d => lv.map[bn.y+D[d][1]][bn.x+D[d][0]] === 0);
      if (od.length !== 1) continue;
      const sx = bn.x + D[od[0]][0]*2, sy = bn.y + D[od[0]][1]*2;
      if (!lv.map[sy] || lv.map[sy][sx] !== 0) continue;
      const fd = (od[0]+2)%4;
      Object.assign(p, { cx: sx, cy: sy, x: sx+.5, y: sy+.5, dir: fd, ang: fd*Math.PI/2, mode: 'wait', queued: null, running: false }); return;
    }
  })()`,
  // 遠くまで見通せる長い直線
  longView: `(() => {
    const g = __game, p = g.player, lv = g.level, D = [[1,0],[0,1],[-1,0],[0,-1]];
    let best = null;
    for (let y = 1; y < lv.H - 1; y++) for (let x = 1; x < lv.W - 1; x++) for (let d = 0; d < 4; d++) {
      if (lv.map[y][x] !== 0) continue;
      let n = 0, cx = x, cy = y;
      while (lv.map[cy + D[d][1]][cx + D[d][0]] === 0) { cx += D[d][0]; cy += D[d][1]; n++; }
      if (!best || n > best.n) best = { x, y, d, n };
    }
    Object.assign(p, { cx: best.x, cy: best.y, x: best.x+.5, y: best.y+.5, dir: best.d, ang: best.d*Math.PI/2 + 0.12, mode: 'wait', queued: null, running: false });
  })()`,
  // 出口の手前で、出口に向かって走らせる（クリア画面用）
  nearExit: `(() => {
    const g = __game, p = g.player, lv = g.level, D = [[1,0],[0,1],[-1,0],[0,-1]];
    const e = lv.exit, d = D.findIndex(([dx,dy]) => e.cx + dx === e.x && e.cy + dy === e.y);
    Object.assign(p, { cx: e.cx, cy: e.cy, x: e.cx+.5, y: e.cy+.5, dir: d, ang: d*Math.PI/2, mode: 'wait', queued: null, running: false });
    Object.assign(g.stats, { time: 21.4, warps: 0, bumps: 0, bones: lv.bones.length, got: lv.bones.length });
  })()`,
};

// 鏡に鼻をぶつける瞬間（「ゴン！」）
async function bonk(pg) {
  await pg.evaluate(() => {
    const g = __game, p = g.player, lv = g.level, D = [[1,0],[0,1],[-1,0],[0,-1]];
    for (let y = 1; y < lv.H - 1; y++) for (let x = 1; x < lv.W - 1; x++) for (let d = 0; d < 4; d++) {
      const back = (d + 2) % 4;
      if (lv.map[y][x] !== 0 || lv.map[y + D[d][1]][x + D[d][0]] !== 1) continue;
      if (lv.map[y + D[back][1]][x + D[back][0]] !== 0 || lv.map[y + 2 * D[back][1]][x + 2 * D[back][0]] !== 0) continue;
      g.stats.bones = 1;   // ほねで助かるので、撮影中にゲームオーバー画面にならない
      Object.assign(p, { cx: x, cy: y, x: x + .5, y: y + .5, dir: d, ang: d * Math.PI / 2, mode: 'bump', t: 0.3, running: true, queued: null,
        from: { x: x + .5, y: y + .5 }, dx: D[d][0], dy: D[d][1] });
      return;
    }
  });
  await pg.evaluate(() => document.getElementById('hint').classList.remove('show'));
  await pg.waitForTimeout(140);
}

async function shots(browser, lang) {
  const { ctx, pg } = await open(browser, lang, { width: 360, height: 640 });
  const shot = async name => { await pg.screenshot({ path: path.join(OUT, `${lang}-${name}.png`) }); console.log('saved', `${lang}-${name}.png`); };

  await shot('1-title');

  await stage(pg, 2, PLACE.mirrorRow);              // らせん回廊：合わせ鏡に並ぶ自分
  await shot('2-mirrors');

  await stage(pg, 1, PLACE.boneWarp);               // まっすぐ廊下：ほねと、ワープの扉
  await shot('3-warp');

  await pg.evaluate(() => __game.startStage(4));    // 鏡の大広間：鏡にゴン！
  await pg.waitForTimeout(1350);
  await pg.evaluate(() => { const p = __game.player; p.running = false; p.mode = 'wait'; document.getElementById('hint').classList.remove('show'); });
  await pg.waitForTimeout(500);
  await bonk(pg);
  await shot('4-bonk');

  await stage(pg, 5, PLACE.longView);               // 闇の合わせ鏡：稲妻が光った瞬間
  await pg.waitForFunction(() => Number(getComputedStyle(document.getElementById('flash')).opacity) > 0.25, null, { timeout: 15000 });
  await pg.evaluate(() => { const p = __game.player; p.mode = 'wait'; p.running = false; document.getElementById('hint').classList.remove('show'); });
  await pg.waitForTimeout(200);
  await shot('5-dark');

  await stage(pg, 3, PLACE.nearExit);               // つづら折り：脱出成功！
  await pg.evaluate(() => { __game.player.running = true; });
  await pg.waitForSelector('#clear:not([hidden])', { timeout: 10000 });
  await pg.waitForTimeout(400);
  await shot('6-clear');
  await ctx.close();
}

// フィーチャーグラフィック 1024×500：合わせ鏡の場面にタイトルを重ねる
async function feature(browser, lang) {
  const { ctx, pg } = await open(browser, lang, { width: 1024, height: 500 });
  await stage(pg, 2, PLACE.mirrorRow);
  await pg.evaluate(lang => {
    document.getElementById('hud').hidden = true;
    const ja = lang === 'ja';
    const el = document.createElement('div');
    el.innerHTML = `<div class="fg-title">${ja ? '犬も歩けば<br>鏡に当たる' : 'Mirror<br>Maze Dog'}</div>
      <div class="fg-sub">${ja ? '壁がぜんぶ鏡の迷路から脱出せよ！' : 'Escape the maze of mirrors!'}</div>`;
    el.style.cssText = 'position:absolute;left:44px;top:50%;transform:translateY(-50%);z-index:50;max-width:600px';
    const css = document.createElement('style');
    css.textContent = `.fg-title{font-weight:800;font-size:${ja ? 78 : 84}px;line-height:1.08;letter-spacing:.02em;
        background:linear-gradient(180deg,#fff6d6 0%,#ffc456 55%,#ff9a2e 100%);-webkit-background-clip:text;background-clip:text;color:transparent;
        filter:drop-shadow(0 4px 0 rgba(60,20,0,.85)) drop-shadow(0 0 22px rgba(0,0,0,.7));}
      .fg-sub{margin-top:18px;font-weight:800;font-size:${ja ? 25 : 24}px;color:#fff;text-shadow:0 2px 0 #000,0 0 14px rgba(0,0,0,.9);}
      #screen{filter:saturate(1.15)}`;
    document.head.appendChild(css);
    document.getElementById('view').appendChild(el);
    const shade = document.createElement('div');
    shade.style.cssText = 'position:absolute;inset:0;z-index:40;background:linear-gradient(90deg,rgba(8,6,18,.75) 0%,rgba(8,6,18,.35) 45%,rgba(8,6,18,0) 70%)';
    document.getElementById('view').appendChild(shade);
  }, lang);
  await pg.waitForTimeout(300);
  const file = path.join(OUT, lang === 'ja' ? 'feature-graphic.png' : 'feature-graphic-en.png');
  await pg.screenshot({ path: file, scale: 'css' });
  console.log('saved', path.basename(file));
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch();
  for (const lang of ['ja', 'en']) { await shots(browser, lang); await feature(browser, lang); }
  await browser.close();
})();
