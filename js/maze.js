/* 迷路生成（シード付き） */
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

  /**
   * map: 0 = 床, 1 = 鏡の壁, 2 = 本物の出口, 3 = ダミー出口（ワープゾーン。行き止まりにはすべて置く）
   */
  function generate(cells, loops, bonesCount, seed) {
    const rnd = mulberry32(seed);
    const W = cells * 2 + 1, H = W;
    const map = Array.from({ length: H }, () => new Array(W).fill(1));
    const seen = Array.from({ length: cells }, () => new Array(cells).fill(false));

    // 穴掘り法（再帰バックトラック）
    const stack = [[0, 0]];
    seen[0][0] = true;
    map[1][1] = 0;
    while (stack.length) {
      const [cx, cy] = stack[stack.length - 1];
      const nb = [];
      for (const [dx, dy] of DIRS) {
        const nx = cx + dx, ny = cy + dy;
        if (nx >= 0 && ny >= 0 && nx < cells && ny < cells && !seen[ny][nx]) nb.push([dx, dy]);
      }
      if (!nb.length) { stack.pop(); continue; }
      const [dx, dy] = nb[Math.floor(rnd() * nb.length)];
      const nx = cx + dx, ny = cy + dy;
      map[cy * 2 + 1 + dy][cx * 2 + 1 + dx] = 0;
      map[ny * 2 + 1][nx * 2 + 1] = 0;
      seen[ny][nx] = true;
      stack.push([nx, ny]);
    }

    // ループを作って迷いやすくする
    let removed = 0;
    for (let tries = 0; removed < loops && tries < 4000; tries++) {
      const x = 1 + Math.floor(rnd() * (W - 2));
      const y = 1 + Math.floor(rnd() * (H - 2));
      if (map[y][x] !== 1) continue;
      const horiz = x % 2 === 0 && y % 2 === 1 && map[y][x - 1] === 0 && map[y][x + 1] === 0;
      const vert = x % 2 === 1 && y % 2 === 0 && map[y - 1][x] === 0 && map[y + 1][x] === 0;
      if (horiz || vert) { map[y][x] = 0; removed++; }
    }

    const start = { x: 1, y: 1, dir: 0 };
    const dist = bfs(map, W, H, start.x, start.y);

    // 出口：外周に面したマスのうち、スタートから一番遠いところ
    let best = null;
    for (let y = 1; y < H - 1; y += 2) {
      for (let x = 1; x < W - 1; x += 2) {
        const opts = [];
        if (x === W - 2) opts.push([W - 1, y]);
        if (y === H - 2) opts.push([x, H - 1]);
        if (x === 1 && !(y === 1)) opts.push([0, y]);
        if (y === 1 && !(x === 1)) opts.push([x, 0]);
        for (const o of opts) {
          if (!best || dist[y][x] > best.d) best = { d: dist[y][x], cx: x, cy: y, ex: o[0], ey: o[1] };
        }
      }
    }
    map[best.ey][best.ex] = 2;

    // スタートの向き：開いている方向
    for (let d = 0; d < 4; d++) {
      const [dx, dy] = DIRS[d];
      if (map[start.y + dy][start.x + dx] === 0) { start.dir = d; break; }
    }

    // 骨：行き止まりに置く
    const deadEnds = [];
    for (let y = 1; y < H - 1; y += 2) {
      for (let x = 1; x < W - 1; x += 2) {
        if ((x === start.x && y === start.y) || (x === best.cx && y === best.cy)) continue;
        let walls = 0;
        for (const [dx, dy] of DIRS) if (map[y + dy][x + dx] !== 0) walls++;
        if (walls >= 3) deadEnds.push({ x, y });
      }
    }
    for (let i = deadEnds.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [deadEnds[i], deadEnds[j]] = [deadEnds[j], deadEnds[i]];
    }
    const bones = deadEnds.slice(0, bonesCount);
    // 行き止まりが足りなければ通路にも置く
    for (let tries = 0; bones.length < bonesCount && tries < 500; tries++) {
      const x = 1 + 2 * Math.floor(rnd() * cells), y = 1 + 2 * Math.floor(rnd() * cells);
      if ((x === start.x && y === start.y) || bones.some(b => b.x === x && b.y === y)) continue;
      bones.push({ x, y });
    }

    // ダミー出口（ワープ）：すべての行き止まりの突き当たりを扉にする
    // （本物の出口のある行き止まりだけは除く）
    const warps = [];
    for (let y = 1; y < H - 1; y += 2) {
      for (let x = 1; x < W - 1; x += 2) {
        if (x === best.cx && y === best.cy) continue;
        const open = DIRS.filter(([dx, dy]) => map[y + dy][x + dx] === 0);
        if (open.length !== 1) continue;
        const [ox, oy] = open[0];
        const wx = x - ox, wy = y - oy;
        if (map[wy][wx] === 1) { map[wy][wx] = 3; warps.push({ x: wx, y: wy, cx: x, cy: y }); }
      }
    }

    const exitDist = bfs(map, W, H, best.cx, best.cy);
    return { map, W, H, start, exit: { x: best.ex, y: best.ey, cx: best.cx, cy: best.cy }, bones, warps, exitDist, pathLen: best.d + 1 };
  }

  window.Maze = { generate, DIRS, mulberry32 };
})();
