/* 迷路生成（シード付き）と、手作りコースの読み込み */
(function () {
  'use strict';

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];

  function bfs(map, W, H, sx, sy) {
    const dist = Array.from({ length: H }, () => new Array(W).fill(-1));
    const q = [[sx, sy]];
    dist[sy][sx] = 0;
    for (let i = 0; i < q.length; i++) {
      const [x, y] = q[i];
      for (const [dx, dy] of DIRS) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        if (map[ny][nx] !== 0 || dist[ny][nx] >= 0) continue;
        dist[ny][nx] = dist[y][x] + 1;
        q.push([nx, ny]);
      }
    }
    return dist;
  }

  function openDirs(map, x, y) {
    return [0, 1, 2, 3].filter(d => map[y + DIRS[d][1]][x + DIRS[d][0]] === 0);
  }

  function shuffle(a, rnd) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /**
   * 仕上げ：出口・スタートの向き・ほね・ワープ・距離を決める（自動生成・手作り共通）
   * map: 0 = 床, 1 = 鏡の壁, 2 = 本物の出口, 3 = ダミー出口（ワープゾーン。行き止まりにはすべて置く）
   */
  function finalize(map, start, exit, bonesCount, rnd, presetBones) {
    const H = map.length, W = map[0].length;
    const dist = bfs(map, W, H, start.x, start.y);

    // 出口：指定がなければ、外周に面した床のうちスタートから一番遠いところ
    if (!exit) {
      let best = null;
      for (let y = 1; y < H - 1; y++) {
        for (let x = 1; x < W - 1; x++) {
          if (map[y][x] !== 0 || dist[y][x] < 0) continue;
          if (x === start.x && y === start.y) continue;
          const opts = [];
          if (x === W - 2) opts.push([W - 1, y]);
          if (y === H - 2) opts.push([x, H - 1]);
          if (x === 1) opts.push([0, y]);
          if (y === 1) opts.push([x, 0]);
          for (const o of opts) {
            if (map[o[1]][o[0]] !== 1) continue;
            if (!best || dist[y][x] > best.d) best = { d: dist[y][x], cx: x, cy: y, x: o[0], y: o[1] };
          }
        }
      }
      exit = best;
    } else {
      // 扉の隣の床が出口マス
      for (const [dx, dy] of DIRS) {
        const nx = exit.x + dx, ny = exit.y + dy;
        if (nx >= 0 && ny >= 0 && nx < W && ny < H && map[ny][nx] === 0) { exit.cx = nx; exit.cy = ny; }
      }
    }
    map[exit.y][exit.x] = 2;

    // スタートの向き：開いている方向（指定があればそれ）
    if (start.dir === undefined) start.dir = openDirs(map, start.x, start.y)[0] || 0;

    // 行き止まり
    const deadEnds = [];
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        if (map[y][x] !== 0) continue;
        if ((x === start.x && y === start.y) || (x === exit.cx && y === exit.cy)) continue;
        if (openDirs(map, x, y).length === 1) deadEnds.push({ x, y });
      }
    }

    // ほね：行き止まり優先、足りなければ通路のどこか
    let bones = presetBones ? presetBones.slice() : [];
    if (!presetBones) {
      bones = shuffle(deadEnds.slice(), rnd).slice(0, bonesCount);
      const floors = [];
      for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) if (map[y][x] === 0 && dist[y][x] > 2) floors.push({ x, y });
      shuffle(floors, rnd);
      for (const f of floors) {
        if (bones.length >= bonesCount) break;
        if (!bones.some(b => b.x === f.x && b.y === f.y)) bones.push(f);
      }
    }

    // ダミー出口（ワープ）：すべての行き止まりの突き当たりを扉にする（スタートの背後も。手作りの W もそのまま）
    const warps = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (map[y][x] === 3) warps.push({ x, y });
    const warpSpots = deadEnds.slice();
    if (openDirs(map, start.x, start.y).length === 1) warpSpots.push({ x: start.x, y: start.y });
    for (const de of warpSpots) {
      const od = openDirs(map, de.x, de.y)[0];
      const wx = de.x - DIRS[od][0], wy = de.y - DIRS[od][1];
      if (map[wy][wx] === 1) { map[wy][wx] = 3; warps.push({ x: wx, y: wy, cx: de.x, cy: de.y }); }
    }

    const exitDist = bfs(map, W, H, exit.cx, exit.cy);
    return {
      map, W, H, start, bones, warps, exitDist,
      exit: { x: exit.x, y: exit.y, cx: exit.cx, cy: exit.cy },
      pathLen: dist[exit.cy][exit.cx] + 1,
    };
  }

  /**
   * 自動生成の迷路
   * o: { w, h（部屋の数）, loops, bones, seed,
   *      straight（0〜1：まっすぐ進みやすさ）, twist（0〜1：曲がりやすさ）, rooms（広間の数） }
   */
  function generate(o) {
    if (typeof o === 'number') o = { w: arguments[0], h: arguments[0], loops: arguments[1], bones: arguments[2], seed: arguments[3] };
    const rnd = mulberry32(o.seed);
    const cw = o.w, ch = o.h || o.w;
    const W = cw * 2 + 1, H = ch * 2 + 1;
    const map = Array.from({ length: H }, () => new Array(W).fill(1));
    const seen = Array.from({ length: ch }, () => new Array(cw).fill(false));

    // 穴掘り法（再帰バックトラック）。直前の向きを覚えて、まっすぐ／くねくねの癖をつける
    const stack = [[0, 0, -1]];
    seen[0][0] = true;
    map[1][1] = 0;
    while (stack.length) {
      const [cx, cy, last] = stack[stack.length - 1];
      const nb = [];
      for (let d = 0; d < 4; d++) {
        const nx = cx + DIRS[d][0], ny = cy + DIRS[d][1];
        if (nx >= 0 && ny >= 0 && nx < cw && ny < ch && !seen[ny][nx]) nb.push(d);
      }
      if (!nb.length) { stack.pop(); continue; }
      let d = nb[Math.floor(rnd() * nb.length)];
      if (o.straight && nb.includes(last) && rnd() < o.straight) d = last;
      if (o.twist && nb.length > 1 && d === last && rnd() < o.twist) {
        const others = nb.filter(v => v !== last);
        d = others[Math.floor(rnd() * others.length)];
      }
      const nx = cx + DIRS[d][0], ny = cy + DIRS[d][1];
      map[cy * 2 + 1 + DIRS[d][1]][cx * 2 + 1 + DIRS[d][0]] = 0;
      map[ny * 2 + 1][nx * 2 + 1] = 0;
      seen[ny][nx] = true;
      stack.push([nx, ny, d]);
    }

    // ループ（抜け道）
    let removed = 0;
    for (let tries = 0; removed < (o.loops || 0) && tries < 4000; tries++) {
      const x = 1 + Math.floor(rnd() * (W - 2));
      const y = 1 + Math.floor(rnd() * (H - 2));
      if (map[y][x] !== 1) continue;
      const horiz = x % 2 === 0 && y % 2 === 1 && map[y][x - 1] === 0 && map[y][x + 1] === 0;
      const vert = x % 2 === 1 && y % 2 === 0 && map[y - 1][x] === 0 && map[y + 1][x] === 0;
      if (horiz || vert) { map[y][x] = 0; removed++; }
    }

    // 広間：2×2 部屋ぶんの壁を取り払う（スタートのそばは避ける）
    for (let r = 0, tries = 0; r < (o.rooms || 0) && tries < 200; tries++) {
      const rw = 2, rh = 2;
      const rx = Math.floor(rnd() * (cw - rw + 1)), ry = Math.floor(rnd() * (ch - rh + 1));
      if (rx < 2 && ry < 2) continue;
      for (let y = ry * 2 + 1; y <= (ry + rh - 1) * 2 + 1; y++) for (let x = rx * 2 + 1; x <= (rx + rw - 1) * 2 + 1; x++) map[y][x] = 0;
      r++;
    }

    return finalize(map, { x: 1, y: 1 }, null, o.bones || 0, rnd);
  }

  /**
   * 手作りコース
   *   # 鏡の壁  . 床  S スタート  E 本物の出口（外周の壁）  W ワープ扉  B ほね
   */
  function fromAscii(rows, seed) {
    const rnd = mulberry32(seed || 1);
    const H = rows.length, W = rows[0].length;
    const map = [], bones = [];
    let start = null, exit = null;
    for (let y = 0; y < H; y++) {
      map.push([]);
      for (let x = 0; x < W; x++) {
        const ch = rows[y][x];
        let v = 1;
        if (ch === '.' || ch === 'S' || ch === 'B') v = 0;
        if (ch === 'W') v = 3;
        if (ch === 'S') start = { x, y };
        if (ch === 'E') exit = { x, y };
        if (ch === 'B') bones.push({ x, y });
        map[y].push(v);
      }
    }
    return finalize(map, start, exit, bones.length, rnd, bones);
  }

  window.Maze = { generate, fromAscii, DIRS, mulberry32 };
})();
