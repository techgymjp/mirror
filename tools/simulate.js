/*
 * 腕前ごとのばらつきチェック（シミュレーション）
 *
 *   node tools/simulate.js [回数=1000]
 *
 * 実際のステージ（js/game.js の STAGES / COURSES と js/maze.js）を使い、
 * 「上級・中級・初級」の仮想プレイヤーを何度も走らせて、クリア率やタイムを集計する。
 * プレイヤーの能力は下の SKILLS で仮定している（実測ではない）。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

// ---- ゲームのコードを読み込む ----
global.window = {};
eval(fs.readFileSync(path.join(ROOT, 'js/maze.js'), 'utf8'));
const Maze = window.Maze, D = Maze.DIRS;
const gsrc = fs.readFileSync(path.join(ROOT, 'js/game.js'), 'utf8');
const pick = (start, end) => gsrc.slice(gsrc.indexOf(start), gsrc.indexOf(end, gsrc.indexOf(start)));
const defs = pick('  const COURSES = {', '  function randomCfg()');
const { COURSES, STAGES } = new Function('Maze', defs + '; return { COURSES, STAGES };')(Maze);
const I18N_SRC = fs.readFileSync(path.join(ROOT, 'js/i18n.js'), 'utf8'); // ステージ名（日本語）を表示に使う
const num = name => Number(new RegExp(name + ' = ([0-9.]+)').exec(gsrc)[1]);
const TURN_DUR = num('TURN_DUR'), BUMP_DUR = num('BUMP_DUR'), STUN = num('STUN'), WARP_DUR = num('WARP_DUR');

function buildLevel(c) {
  if (c.maze.course) return Maze.fromAscii(COURSES[c.maze.course], 7);
  return Maze.generate(Object.assign({ bones: c.bones }, c.maze));
}

// ---- 仮想プレイヤー（仮定） ----
//  rt: 反応時間（秒） / timing: フリックのタイミングのぶれ（秒） / see: 曲がり角に気づける距離（マス）
//  sense: 出口へ向かう道を選ぶ勘（重み） / memory: 通った道を避ける度合い
//  fooled: 映りこみを道と見まちがえる率 / flip: 左右反転で逆にフリックする率
const SKILLS = {
  上級: { rt: 0.35, timing: 0.08, see: 2.4, sense: 3.0, memory: 0.9, fooled: 0.02, flip: 0.05 },
  中級: { rt: 0.55, timing: 0.13, see: 2.0, sense: 2.0, memory: 0.6, fooled: 0.05, flip: 0.15 },
  初級: { rt: 0.80, timing: 0.20, see: 1.6, sense: 1.3, memory: 0.3, fooled: 0.10, flip: 0.30 },
};
const TIME_LIMIT = 300; // これ以上かかったら「迷ってあきらめた」扱い

function gauss(r) { let u = 0, v = 0; while (u === 0) u = r(); while (v === 0) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

function run(cfg, lv, sk, rnd, rule) {
  const map = lv.map, cell = (x, y) => (x < 0 || y < 0 || x >= lv.W || y >= lv.H) ? 1 : map[y][x];
  let x = lv.start.x, y = lv.start.y, dir = lv.start.dir;
  let t = 0, bumps = 0, warps = 0, held = OPT.startBones, got = 0;
  const bonesLeft = new Set(lv.bones.map(b => b.x + ',' + b.y));
  const visits = new Map();
  const seen = k => visits.get(k) || 0;
  visits.set(x + ',' + y, 1);
  // 見通し：鏡の色味が濃いほど本物の道が見分けやすい。暗闇は近くしか見えない（稲妻のときだけ遠く）
  const clarity = 0.7 + cfg.tint * 2;
  const speedAt = tt => OPT.speed * (cfg.speedUp ? cfg.speed * Math.min(cfg.speedUp.max, 1 + tt / cfg.speedUp.per) : cfg.speed);
  let cause = '';
  let stopped = true; // スタート直後とゴン直後は止まっていて、落ち着いて向きを決められる

  for (let steps = 0; steps < 5000; steps++) {
    if (t > TIME_LIMIT) return { result: 'lost', t, bumps, warps, got };
    // このマスで進みたい向きを決める（来た道へ戻るのは行き止まりのときだけ）
    const opts = [];
    for (let d = 0; d < 4; d++) {
      const c = cell(x + D[d][0], y + D[d][1]);
      if (c === 2) { opts.length = 0; opts.push({ d, w: 1 }); break; }  // 出口が見えたら迷わず
      if (c !== 0 && c !== 3) continue;
      if (d === (dir + 2) % 4 && !stopped) continue;
      const nx = x + D[d][0], ny = y + D[d][1];
      let w = 1;
      if (c === 0) {
        const toward = lv.exitDist[ny][nx] >= 0 && lv.exitDist[ny][nx] < lv.exitDist[y][x];
        if (toward) w *= sk.sense;
        w *= Math.pow(1 - sk.memory * 0.85, Math.min(3, seen(nx + ',' + ny)));
      } else {
        w *= 0.15 * (1 - sk.memory * 0.5); // ワープ扉は出口に見えるので、ときどき入ってしまう
      }
      opts.push({ d, w });
    }
    if (!opts.length) {
      // 行き止まり：前はワープ扉のはず。戻る（2回フリック）か、扉に入る
      opts.push({ d: (dir + 2) % 4, w: 1 });
    }
    // 映りこみにだまされて、壁の方を道だと思いこむ
    let want;
    const fooledRate = sk.fooled * (cfg.lightning ? 2.5 : 1) * (1.4 - clarity * 0.5);
    const decision = cell(x + D[dir][0], y + D[dir][1]) !== 0 || [1, 3].some(o => cell(x + D[(dir + o) % 4][0], y + D[(dir + o) % 4][1]) !== 1);
    if (decision && rnd() < fooledRate) {
      const walls = [0, 1, 2, 3].filter(d => cell(x + D[d][0], y + D[d][1]) === 1 && d !== (dir + 2) % 4);
      want = walls.length ? walls[Math.floor(rnd() * walls.length)] : opts[0].d;
      cause = '映りこみにだまされた';
    } else {
      let sum = opts.reduce((a, o) => a + o.w, 0), r = rnd() * sum;
      want = opts[opts.length - 1].d;
      for (const o of opts) { r -= o.w; if (r <= 0) { want = o.d; break; } }
    }

    // フリックが間に合うか
    let actual = want;
    const need = (want - dir + 4) % 4;
    if (need !== 0 && !stopped) {
      const v = speedAt(t);
      const seeDist = cfg.lightning ? (rnd() < OPT.flash ? sk.see : Math.min(sk.see, 1.0)) : sk.see * clarity;
      const extra = need === 2 ? 0.25 : 0;
      // 角に着く何秒前にフリックするか：1マス手前の区間（1/v 秒）の真ん中をねらうが、ぶれる。
      // 気づくのが遅い（見通しが悪い・速い）と、そもそも間に合わない
      const latest = seeDist / v - sk.rt - extra;
      const tau = Math.min(latest, 0.5 / v + gauss(rnd) * sk.timing);
      if (tau <= 0) { actual = dir; cause = 'フリックが遅れた'; } // 遅すぎ：直進
      else if (tau >= 1 / v && rule === 'now') {                         // 早すぎ：1マス手前で曲がって横の壁へ
        t += BUMP_DUR + STUN; bumps++;
        if (held > 0) { held--; stopped = true; t += sk.rt; continue; }
        return { result: 'over', t, bumps, warps, got, cause: 'フリックが早すぎた' };
      }
      if (actual !== dir && cfg.mirrorWorld && need !== 2 && rnd() < sk.flip) actual = (dir + (need === 1 ? 3 : 1)) % 4, cause = '左右反転で逆にフリック'; // 逆にフリック
    }
    if (actual !== dir) t += TURN_DUR * (actual === (dir + 2) % 4 ? 2 : 1);
    dir = actual;
    stopped = false;

    const nx = x + D[dir][0], ny = y + D[dir][1], c = cell(nx, ny);
    if (c !== 1) cause = '';
    if (c === 2) { t += 0.75 / speedAt(t); return { result: 'clear', t, bumps, warps, got }; }
    if (c === 1) {
      t += BUMP_DUR + STUN;
      bumps++;
      if (held > 0) { held--; stopped = true; t += sk.rt; continue; }
      return { result: 'over', t, bumps, warps, got, cause };
    }
    if (c === 3) {
      t += 0.6 / (speedAt(t) * 1.4) + WARP_DUR;
      warps++;
      const cand = [];
      for (let yy = 1; yy < lv.H; yy += 2) for (let xx = 1; xx < lv.W; xx += 2) {
        const d = lv.exitDist[yy][xx];
        if (d < 0 || Math.abs(xx - x) + Math.abs(yy - y) < 4 || d < lv.pathLen * 0.35) continue;
        cand.push([xx, yy]);
      }
      const p = cand.length ? cand[Math.floor(rnd() * cand.length)] : [lv.start.x, lv.start.y];
      x = p[0]; y = p[1];
      const op = [0, 1, 2, 3].filter(d => cell(x + D[d][0], y + D[d][1]) === 0);
      dir = op.length ? op[Math.floor(rnd() * op.length)] : dir;
      visits.set(x + ',' + y, seen(x + ',' + y) + 1);
      continue;
    }
    t += 1 / speedAt(t);
    x = nx; y = ny;
    visits.set(x + ',' + y, seen(x + ',' + y) + 1);
    if (bonesLeft.delete(x + ',' + y)) { held++; got++; }
  }
  return { result: 'lost', t, bumps, warps, got };
}

function stars(r) { const m = r.warps + r.bumps; return m === 0 ? 3 : m <= 2 ? 2 : 1; }
function pct(a, b) { return b ? Math.round(a / b * 100) : 0; }
function median(a) { if (!a.length) return NaN; const s = a.slice().sort((p, q) => p - q); return s[s.length >> 1]; }

const N = Number(process.argv.find(a => /^\d+$/.test(a))) || 1000;
const rnd = Maze.mulberry32(20261111);
// rule: 'hold' = 予約を、その向きに曲がれるマスまで持ち越す（いまのゲーム）
//       'now'  = 以前の仕様（予約した曲がりは次のマスで実行。早すぎると手前で曲がる）
const RULE = process.argv.includes('--now') ? 'now' : 'hold'; // いまのゲームは 'hold'。--now で以前の仕様
// 調整案を試すオプション：--speed=0.85（走る速さの倍率） --bones=1（最初から持っているほね）
const argOf = (k, d) => { const a = process.argv.find(v => v.startsWith('--' + k + '=')); return a ? Number(a.split('=')[1]) : d; };
var OPT = { speed: argOf('speed', 1), startBones: argOf('bones', 0), flash: 0.4 }; // flash: 闇ステージで稲妻に助けられる割合
// --tuned：調整案（速さの上がり方をなだらかに、加速を控えめに、稲妻を多めに）
const TUNED = { speeds: [1.6, 1.8, 1.9, 2.0, 2.1, 1.9, 2.3, 2.1, 2.0, 2.4], speedUpMax: 1.5, flash: 0.4 };
if (process.argv.includes('--tuned')) {
  OPT.flash = TUNED.flash;
  STAGES.forEach((c, i) => { c.speed = TUNED.speeds[i]; if (c.speedUp) c.speedUp = Object.assign({}, c.speedUp, { max: Math.min(c.speedUp.max, TUNED.speedUpMax) }); });
}
const out = [];
STAGES.forEach((cfg, i) => {
  const lv = buildLevel(cfg);
  const row = { stage: i + 1, name: (new RegExp("'stage\\." + (i + 1) + "\\.name': '([^']*)'").exec(I18N_SRC) || [])[1] || 'STAGE ' + (i + 1) };
  for (const [name, sk] of Object.entries(SKILLS)) {
    const rs = Array.from({ length: N }, () => run(cfg, lv, sk, rnd, RULE));
    const clears = rs.filter(r => r.result === 'clear');
    row[name] = {
      clear: pct(clears.length, N),
      over: pct(rs.filter(r => r.result === 'over').length, N),
      lost: pct(rs.filter(r => r.result === 'lost').length, N),
      time: Math.round(median(clears.map(r => r.t))),
      star3: pct(clears.filter(r => stars(r) === 3).length, N),
      warps: +(clears.reduce((a, r) => a + r.warps, 0) / Math.max(1, clears.length)).toFixed(1),
      causes: rs.filter(r => r.result === 'over').reduce((m, r) => (m[r.cause || '?'] = (m[r.cause || '?'] || 0) + 1, m), {}),
      decisions: 0,
      saves: +(rs.reduce((a, r) => a + Math.max(0, r.bumps - (r.result === 'over' ? 1 : 0)), 0) / N).toFixed(2),
    };
  }
  out.push(row);
});

if (process.argv.includes('--causes')) {
  for (const r of out) console.log(r.stage, r.name, Object.keys(SKILLS).map(k => k + ' ' + JSON.stringify(r[k].causes)).join('  '));
  process.exit(0);
}
if (process.argv.includes('--json')) { console.log(JSON.stringify(out, null, 1)); process.exit(0); }
console.log(`[${RULE === 'now' ? '以前の仕様' : 'いまの仕様（予約を持ち越す）'} 速さ×${OPT.speed} 最初のほね${OPT.startBones}${process.argv.includes('--tuned') ? ' 調整案' : ''}] 各ステージ ${N} 回ずつ（クリア率% / ゲームオーバー% / 迷って時間切れ% / クリア時の中央タイム秒 / ★3の割合%）\n`);
const h = ['#', 'ステージ', ...Object.keys(SKILLS).map(k => k.padEnd(4))];
console.log(h.join('\t'));
for (const r of out) {
  console.log([r.stage, r.name.padEnd(7, '　'), ...Object.keys(SKILLS).map(k => {
    const s = r[k];
    return `${String(s.clear).padStart(3)}% (×${s.over}% 迷${s.lost}%) ${isNaN(s.time) ? '-' : s.time + 's'} ★3:${s.star3}%`;
  })].join('\t'));
}
