/*
 * 鏡の迷路レイキャスター
 * すべての壁が鏡なので、レイは壁に当たると反射して進み続ける。
 * 反射は「折り返した空間をまっすぐ進む」として扱う（x, y それぞれに ±1 倍＋平行移動の変換を持つ）。
 */
(function () {
  'use strict';

  const CAMZ_EYE = 0.34;    // 犬の目の高さ（壁の高さ = 1）
  const FR = 0.035;          // 鏡のフチ（枠）の幅
  const FOG_LEVELS = 48;
  const MAX_SEG = 64;
  const FOG = [5, 4, 10];
  const FRAME = [[168, 164, 196], [122, 118, 152]];

  function lerp(a, b, t) { return a + (b - a) * t; }
  function rgb(c) { return 'rgb(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ')'; }

  const framePal = [[], []];
  for (let s = 0; s < 2; s++) {
    for (let i = 0; i <= FOG_LEVELS; i++) {
      const f = Math.pow(i / FOG_LEVELS, 0.8);
      framePal[s][i] = rgb([lerp(FRAME[s][0], FOG[0], f), lerp(FRAME[s][1], FOG[1], f), lerp(FRAME[s][2], FOG[2], f)]);
    }
  }
  const FOG_CSS = rgb(FOG);

  function Renderer(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.level = null;
    this.cfg = null;
    this.sAX = new Int8Array(MAX_SEG); this.sAY = new Int8Array(MAX_SEG);
    this.sBX = new Int32Array(MAX_SEG); this.sBY = new Int32Array(MAX_SEG);
    this.sD0 = new Float64Array(MAX_SEG); this.sD1 = new Float64Array(MAX_SEG);
    this.mF = new Float64Array(MAX_SEG); this.mS = new Int8Array(MAX_SEG);
    this.hits = [];
    this.resize(canvas.width || 320, canvas.height || 240);
  }

  Renderer.prototype.resize = function (w, h) {
    this.canvas.width = w; this.canvas.height = h;
    this.W = w; this.H = h;
    this.PLANE = Math.max(0.58, Math.min(1.0, (w / 2) / (h * 0.85)));
    this.S = (w / 2) / this.PLANE;
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'high';
  };

  Renderer.prototype.setLevel = function (level, cfg) {
    this.level = level;
    this.cfg = cfg;
    this.doorReal = Sprites.door(false, 0);
    this.doorFake = Sprites.door(true, cfg.warpHint || 0);
  };

  /**
   * v: { px, py, ang, bob, sprites: [{x,y,z,w,h,img | kind:'dog', fx, fy, frame}] }
   */
  Renderer.prototype.render = function (v) {
    const ctx = this.ctx, W = this.W, H = this.H, S = this.S, PLANE = this.PLANE;
    const lv = this.level, map = lv.map, MW = lv.W, MH = lv.H;
    const cfg = this.cfg;
    const fogD = cfg.fog, maxB = cfg.maxBounce || 14, tint = cfg.tint;
    const hz = H / 2 + (v.bob || 0);
    const CAMZ = v.camZ || CAMZ_EYE;
    const sAX = this.sAX, sAY = this.sAY, sBX = this.sBX, sBY = this.sBY, sD0 = this.sD0, sD1 = this.sD1, mF = this.mF, mS = this.mS;
    const sprites = v.sprites || [];
    const hits = this.hits;

    ctx.globalAlpha = 1;
    let g = ctx.createLinearGradient(0, 0, 0, hz);
    g.addColorStop(0, cfg.sky || '#1d1736'); g.addColorStop(1, FOG_CSS);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, Math.ceil(hz));
    g = ctx.createLinearGradient(0, hz, 0, H);
    g.addColorStop(0, FOG_CSS); g.addColorStop(0.35, '#16121e'); g.addColorStop(1, cfg.floor || '#5a4560');
    ctx.fillStyle = g; ctx.fillRect(0, Math.floor(hz), W, H - Math.floor(hz));

    const px = v.px, py = v.py;
    const dirX = Math.cos(v.ang), dirY = Math.sin(v.ang);
    const plX = -dirY * PLANE, plY = dirX * PLANE;
    const P2 = PLANE * PLANE;
    const tintCss = cfg.tintColor || 'rgb(70,110,190)';

    for (let x = 0; x < W; x++) {
      const cam = 2 * (x + 0.5) / W - 1;
      const rdx = (dirX + plX * cam) || 1e-9, rdy = (dirY + plY * cam) || 1e-9;
      let mapX = Math.floor(px), mapY = Math.floor(py);
      const ddx = Math.abs(1 / rdx), ddy = Math.abs(1 / rdy);
      let stepX, stepY, sideX, sideY;
      if (rdx < 0) { stepX = -1; sideX = (px - mapX) * ddx; } else { stepX = 1; sideX = (mapX + 1 - px) * ddx; }
      if (rdy < 0) { stepY = -1; sideY = (py - mapY) * ddy; } else { stepY = 1; sideY = (mapY + 1 - py) * ddy; }

      let ax = 1, bx = 0, ay = 1, by = 0, nm = 0, segStart = 0;
      let termType = 0, termD = fogD, termFrac = 0, termSide = 0;

      for (let it = 0; it < 400; it++) {
        let side, d;
        if (sideX < sideY) { d = sideX; sideX += ddx; mapX += stepX; side = 0; }
        else { d = sideY; sideY += ddy; mapY += stepY; side = 1; }
        if (d > fogD) break;
        const rx = ax === 1 ? mapX + bx : bx - mapX - 1;
        const ry = ay === 1 ? mapY + by : by - mapY - 1;
        const cell = (rx < 0 || ry < 0 || rx >= MW || ry >= MH) ? 1 : map[ry][rx];
        if (cell === 0) continue;
        const real = side === 0 ? ay * (py + d * rdy) + by : ax * (px + d * rdx) + bx;
        let frac = real - Math.floor(real);
        if (cell >= 2) {
          // テクスチャの向きを実空間の視線方向で合わせる（鏡越しなら自然に左右反転して見える）
          if ((side === 0 && ax * rdx < 0) || (side === 1 && ay * rdy > 0)) frac = 1 - frac;
          termType = cell; termD = d; termFrac = frac; termSide = side; break;
        }
        if (frac < FR || frac > 1 - FR) { termType = 1; termD = d; termSide = side; break; }
        if (nm >= maxB || nm >= MAX_SEG - 2) { termType = 9; termD = d; break; }
        // 反射：ここまでを1区間として記録
        sAX[nm] = ax; sBX[nm] = bx; sAY[nm] = ay; sBY[nm] = by; sD0[nm] = segStart; sD1[nm] = d;
        mF[nm] = frac; mS[nm] = side;
        nm++; segStart = d;
        if (side === 0) { const B = stepX === 1 ? mapX : mapX + 1; bx = bx + 2 * B * ax; ax = -ax; }
        else { const B = stepY === 1 ? mapY : mapY + 1; by = by + 2 * B * ay; ay = -ay; }
      }
      sAX[nm] = ax; sBX[nm] = bx; sAY[nm] = ay; sBY[nm] = by; sD0[nm] = segStart; sD1[nm] = termD;

      // 終端（枠・扉・闇）
      if (termType) {
        const top = hz + (CAMZ - 1) * S / termD, bot = hz + CAMZ * S / termD;
        const ff = Math.min(1, termD / fogD);
        if (termType === 1) {
          ctx.fillStyle = framePal[termSide][(ff * FOG_LEVELS) | 0];
          ctx.fillRect(x, top, 1, bot - top);
        } else if (termType === 2 || termType === 3) {
          const tex = termType === 2 ? this.doorReal : this.doorFake;
          ctx.drawImage(tex, Math.min(tex.width - 1, (termFrac * tex.width) | 0), 0, 1, tex.height, x, top, 1, bot - top);
          ctx.globalAlpha = ff * 0.75; ctx.fillStyle = FOG_CSS; ctx.fillRect(x, top, 1, bot - top); ctx.globalAlpha = 1;
        } else {
          ctx.fillStyle = FOG_CSS; ctx.fillRect(x, top, 1, bot - top);
        }
      }

      // 奥の区間から順に：スプライト → その手前の鏡の色味
      for (let k = nm; k >= 0; k--) {
        if (sprites.length) {
          hits.length = 0;
          const kax = sAX[k], kbx = sBX[k], kay = sAY[k], kby = sBY[k], d0 = sD0[k], d1 = sD1[k];
          for (let i = 0; i < sprites.length; i++) {
            const s = sprites[i];
            const ux = kax * (s.x - kbx), uy = kay * (s.y - kby);
            const rx = ux - px, ry = uy - py;
            const ty = rx * dirX + ry * dirY;
            if (ty < 0.2 || ty <= d0 || ty > d1) continue;
            const tx = (rx * plX + ry * plY) / P2;
            const sw = s.w * S / ty;
            const left = W / 2 * (1 + tx / ty) - sw / 2;
            const cx = x + 0.5;
            if (cx < left || cx >= left + sw) continue;
            let u = (cx - left) / sw;
            let img = s.img, sx = 0, sy = 0, fw = 0, fh = 0;
            if (s.kind === 'dog') {
              const D = Sprites.DOG;
              img = D.sheet;
              if (!img.complete || !img.naturalWidth) continue;
              // 鏡像空間での犬の向き → カメラから見た角度 ψ（0=正面, +90=鼻が画面右）
              const fx = kax * s.fx, fy = kay * s.fy;
              const len = Math.hypot(rx, ry) || 1;
              const vx = rx / len, vy = ry / len;
              const psi = Math.atan2(fx * -vy + fy * vx, -(fx * vx + fy * vy)) * 180 / Math.PI;
              const col = Math.min(D.cols - 1, Math.round(Math.abs(psi) / D.step));
              if (psi < 0) u = 1 - u;
              sx = col * D.fw; sy = s.frame * D.fh; fw = D.fw; fh = D.fh;
              if (k === 0 && s.self && Math.abs(psi) > 160 && D.back.complete && D.back.naturalWidth) {
                // 手前の自分の背中は高解像度版で
                img = D.back; sx = s.frame * D.bfw; sy = 0; fw = D.bfw; fh = D.bfh;
              }
            } else if (s.fw) {
              if (!img.complete || !img.naturalWidth) continue;
              sx = s.sx; sy = s.sy; fw = s.fw; fh = s.fh;
            } else { fw = img.width; fh = img.height; }
            hits.push({ ty, u, img, s, sx, sy, fw, fh });
          }
          if (hits.length > 1) hits.sort((a, b) => b.ty - a.ty);
          for (let i = 0; i < hits.length; i++) {
            const h = hits[i], s = h.s, img = h.img;
            const top = hz + (CAMZ - (s.z + s.h)) * S / h.ty, bot = hz + (CAMZ - s.z) * S / h.ty;
            ctx.globalAlpha = Math.max(0, 1 - Math.pow(h.ty / fogD, 1.3));
            ctx.drawImage(img, h.sx + Math.min(h.fw - 1, (h.u * h.fw) | 0), h.sy, 1, h.fh, x, top, 1, bot - top);
          }
          ctx.globalAlpha = 1;
        }
        if (k > 0) {
          const m = k - 1, d = sD1[m];
          const top = hz + (CAMZ - 1) * S / d, bot = hz + CAMZ * S / d;
          const ff = Math.min(1, d / fogD);
          ctx.globalAlpha = tint * (1 - ff * 0.6);
          ctx.fillStyle = tintCss;
          ctx.fillRect(x, top, 1, bot - top);
          const fr = mF[m];
          if ((fr > 0.12 && fr < 0.2) || (fr > 0.25 && fr < 0.28)) {
            ctx.globalAlpha = 0.09 * (1 - ff);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(x, top, 1, bot - top);
          }
          ctx.globalAlpha = 1;
          ctx.fillStyle = framePal[mS[m]][(ff * FOG_LEVELS) | 0];
          const mh = Math.max(1, 0.04 * S / d);
          ctx.fillRect(x, top, 1, mh);
          ctx.fillRect(x, bot - mh, 1, mh);
        }
      }
    }
  };

  window.Renderer = Renderer;
})();
