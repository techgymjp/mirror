/* キャンバスで描くドット絵スプライト */
(function () {
  'use strict';

  function mk(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    draw(g);
    return c;
  }
  function flip(src) {
    return mk(src.width, src.height, g => { g.translate(src.width, 0); g.scale(-1, 1); g.drawImage(src, 0, 0); });
  }
  function ell(g, x, y, rx, ry, c) { g.fillStyle = c; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill(); }
  function poly(g, pts, c) { g.fillStyle = c; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.closePath(); g.fill(); }

  const OR = '#e08a35', ORD = '#b5641f', WH = '#fff3e0', BK = '#24170f', PINK = '#f4a9a0', RED = '#e0384a';

  // 横向き（右向き）。frame で脚が入れ替わる
  function side(frame) {
    return mk(48, 40, g => {
      const a = frame ? 3 : -3;
      g.fillStyle = ORD; g.fillRect(14 - a, 27, 4, 11); g.fillRect(30 + a, 27, 4, 11);
      // しっぽ（くるん）
      ell(g, 9, 15, 5.5, 5.5, OR); ell(g, 9.5, 15.5, 2.4, 2.4, WH);
      ell(g, 23, 24, 13, 7.5, OR);
      ell(g, 25, 28.5, 9, 3, WH);
      g.fillStyle = OR; g.fillRect(11 + a, 28, 4, 10); g.fillRect(27 - a, 28, 4, 10);
      g.fillStyle = WH; g.fillRect(11 + a, 36, 4, 2); g.fillRect(27 - a, 36, 4, 2); g.fillRect(14 - a, 36, 4, 2); g.fillRect(30 + a, 36, 4, 2);
      // 頭
      ell(g, 35, 14, 8.5, 7.5, OR);
      poly(g, [[29, 10], [32, 0], [37, 8]], OR);
      poly(g, [[31, 9], [32.5, 3.5], [35, 8.5]], PINK);
      ell(g, 41.5, 18, 5.5, 3.8, WH);
      ell(g, 46, 16.5, 1.8, 1.5, BK);
      ell(g, 38, 12.5, 1.4, 1.7, BK);
      g.strokeStyle = RED; g.lineWidth = 2.5; g.beginPath(); g.moveTo(29, 18); g.lineTo(32, 22.5); g.stroke();
    });
  }

  function front(frame) {
    return mk(48, 40, g => {
      const a = frame ? 1 : 0;
      ell(g, 24, 28, 10, 9, OR);
      ell(g, 24, 29, 6, 7, WH);
      g.fillStyle = OR; g.fillRect(17, 31 - a, 5, 8 + a); g.fillRect(26, 31 + a, 5, 8 - a);
      g.fillStyle = WH; g.fillRect(17, 37, 5, 2); g.fillRect(26, 37, 5, 2);
      poly(g, [[13, 12], [14, 0], [21, 6]], OR);
      poly(g, [[35, 12], [34, 0], [27, 6]], OR);
      poly(g, [[15, 10], [15.5, 3], [19.5, 6.5]], PINK);
      poly(g, [[33, 10], [32.5, 3], [28.5, 6.5]], PINK);
      ell(g, 24, 13, 11, 9.5, OR);
      ell(g, 24, 17.5, 7.5, 5, WH);
      ell(g, 19.5, 11, 1.7, 2, BK); ell(g, 28.5, 11, 1.7, 2, BK);
      ell(g, 24, 15.5, 2.2, 1.6, BK);
      g.strokeStyle = BK; g.lineWidth = 1; g.beginPath(); g.moveTo(24, 17); g.lineTo(24, 19); g.moveTo(21.5, 19.5); g.quadraticCurveTo(24, 21, 26.5, 19.5); g.stroke();
      g.strokeStyle = RED; g.lineWidth = 2.5; g.beginPath(); g.moveTo(15, 22); g.quadraticCurveTo(24, 26, 33, 22); g.stroke();
    });
  }

  function back(frame) {
    return mk(48, 40, g => {
      const a = frame ? 1 : 0;
      ell(g, 24, 27, 11, 9, OR);
      g.fillStyle = ORD; g.fillRect(16, 30 + a, 5, 9 - a); g.fillRect(27, 30 - a, 5, 9 + a);
      g.fillStyle = WH; g.fillRect(16, 37, 5, 2); g.fillRect(27, 37, 5, 2);
      poly(g, [[14, 11], [15, 0], [21, 6]], ORD);
      poly(g, [[34, 11], [33, 0], [27, 6]], ORD);
      ell(g, 24, 12, 10, 8.5, ORD);
      g.strokeStyle = RED; g.lineWidth = 2.5; g.beginPath(); g.moveTo(15, 19); g.quadraticCurveTo(24, 23, 33, 19); g.stroke();
      // くるんとしたしっぽ
      ell(g, 24, 23, 5.5, 5, OR); ell(g, 24, 23, 2.3, 2.1, WH);
    });
  }

  const sideR = [side(0), side(1)];
  const dog = {
    front: [front(0), front(1)],
    back: [back(0), back(1)],
    right: sideR,
    left: sideR.map(flip),
  };

  const bone = mk(28, 12, g => {
    const c = '#fbf3e4';
    ell(g, 5, 3.5, 3.5, 3.2, c); ell(g, 5, 8.5, 3.5, 3.2, c);
    ell(g, 23, 3.5, 3.5, 3.2, c); ell(g, 23, 8.5, 3.5, 3.2, c);
    g.fillStyle = c; g.fillRect(5, 3.5, 18, 5);
    g.fillStyle = 'rgba(160,130,100,.5)'; g.fillRect(6, 7.5, 16, 1);
  });

  // 扉テクスチャ（壁1面ぶん）。fake=true はワープ扉（色味がわずかに違う）
  function door(fake, hintStrength) {
    return mk(64, 64, g => {
      g.fillStyle = '#2a2442'; g.fillRect(0, 0, 64, 64);
      g.fillStyle = '#8d8aa8'; g.fillRect(0, 0, 3, 64); g.fillRect(61, 0, 3, 64);
      const top = fake ? [255, 240, 200] : [255, 244, 200];
      const bot = fake ? [255, 170, 90] : [255, 176, 72];
      const grd = g.createLinearGradient(0, 14, 0, 64);
      grd.addColorStop(0, 'rgb(' + top + ')'); grd.addColorStop(1, 'rgb(' + bot + ')');
      g.fillStyle = '#c9a24a'; g.fillRect(14, 12, 36, 52);
      g.fillStyle = grd; g.fillRect(18, 16, 28, 48);
      if (fake && hintStrength > 0) {
        // ワープ扉はうっすら紫がかる（難しいステージでは見分けがつかない）
        g.fillStyle = 'rgba(170,80,255,' + hintStrength + ')'; g.fillRect(18, 16, 28, 48);
      }
      // 非常口サイン
      g.fillStyle = '#1f8f55'; g.fillRect(19, 3, 26, 7);
      g.fillStyle = '#eafff2'; g.font = 'bold 6px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('EXIT', 32, 6.8);
      // 肉球マーク
      const pc = 'rgba(150,90,30,.55)';
      ell(g, 32, 42, 4.5, 3.8, pc);
      ell(g, 26.5, 36, 1.8, 2.2, pc); ell(g, 30, 34, 1.8, 2.2, pc); ell(g, 34, 34, 1.8, 2.2, pc); ell(g, 37.5, 36, 1.8, 2.2, pc);
      // ドアノブ
      ell(g, 42, 44, 1.6, 1.6, '#8a5a1a');
    });
  }

  window.Sprites = { dog, bone, door };
})();
