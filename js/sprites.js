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
  function ell(g, x, y, rx, ry, c) { g.fillStyle = c; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill(); }

  // 柴犬スプライトシート（tools/render_dog.py で事前レンダリング）
  // 横: 向き 0°(正面)〜180°(背面) を 22.5° 刻みで 9 列 / 縦: 0=立ち, 1〜4=速歩き
  const dogSheet = new Image();
  dogSheet.src = 'assets/dog.png';
  const DOG = { sheet: dogSheet, fw: 144, fh: 120, cols: 9, step: 22.5, w: 1.24 * 0.44, h: 1.03 * 0.44, z: -0.02 * 0.44 };

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

  window.Sprites = { DOG, bone, door };
})();
