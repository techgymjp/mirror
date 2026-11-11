"""
ほねのスプライトを SDF レイマーチングで事前レンダリングして assets/bone.png に書き出す。

  python3 tools/render_bone.py

横に 12 コマ：その場でくるくる回る（ほねは 180° 回すと同じ形なので 0〜180° を 15° 刻み）。
"""
import math
import os
import numpy as np
from PIL import Image

from render_dog import length, smin, sd_cone, vnoise, smoothstep

OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'bone.png')
W, H = 128, 64
SS = 3
X0, X1 = -0.66, 0.66
Y0, Y1 = -0.33, 0.33
FRAMES = 12
TILT = 18.0   # 少し上から見下ろすように傾ける


def rot_x(deg):
    a = math.radians(deg); c, s = math.cos(a), math.sin(a)
    return np.array([[1, 0, 0], [0, c, -s], [0, s, c]])


def rot_y(deg):
    a = math.radians(deg); c, s = math.cos(a), math.sin(a)
    return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])


def bone_sdf(p):
    # 軸（中央が少し細い）
    d = smin(sd_cone(p, [-0.33, 0, 0], [0, 0, 0], 0.075, 0.06), sd_cone(p, [0, 0, 0], [0.33, 0, 0], 0.06, 0.075), 0.04)
    # 両端のこぶ（2つずつ）
    for sx in (-1, 1):
        for sz in (-1, 1):
            c = np.array([0.40 * sx, 0, 0.075 * sz])
            k = length(p - c) - 0.105
            d = smin(d, k, 0.06)
    return d


def render(yaw):
    w, h = W * SS, H * SS
    xs = X0 + (np.arange(w) + 0.5) / w * (X1 - X0)
    ys = Y1 - (np.arange(h) + 0.5) / h * (Y1 - Y0)
    gx, gy = np.meshgrid(xs, ys)
    N = gx.size
    R = rot_x(TILT) @ rot_y(yaw)        # モデル→ワールド
    Rinv = R.T
    ro = np.stack([gx.ravel(), gy.ravel(), np.full(N, 2.0)], -1) @ Rinv.T
    rd = np.array([0, 0, -1.0]) @ Rinv.T
    t = np.zeros(N); hit = np.zeros(N, bool); alive = np.ones(N, bool)
    for _ in range(90):
        idx = np.nonzero(alive)[0]
        if not len(idx):
            break
        d = bone_sdf(ro[idx] + t[idx, None] * rd)
        t[idx] += d * 0.9
        done = d < 0.0006
        hit[idx[done]] = True; alive[idx[done]] = False
        alive[idx[t[idx] > 4]] = False

    img = np.zeros((N, 4))
    idx = np.nonzero(hit)[0]
    p = ro[idx] + t[idx, None] * rd
    e = 0.001
    n = np.zeros_like(p)
    for k in range(3):
        o = np.zeros(3); o[k] = e
        n[:, k] = bone_sdf(p + o) - bone_sdf(p - o)
    n /= length(n)[:, None]
    nw = n @ R.T
    L = np.array([-0.4, 0.8, 0.5]); L /= np.linalg.norm(L)
    V = np.array([0, 0, 1.0])
    Hv = (L + V) / np.linalg.norm(L + V)
    # 象牙色＋ほんのりムラ
    fn = vnoise(p * 18) * 0.6 + vnoise(p * 55) * 0.4
    alb = np.array([0.97, 0.92, 0.80])[None] * (0.93 + 0.1 * fn)[:, None]
    diff = np.clip(nw @ L * 0.65 + 0.35, 0, 1) ** 1.3
    ao = np.zeros(len(p))
    for i in range(1, 5):
        hh = 0.02 * i
        ao += (hh - bone_sdf(p + n * hh)) / (2 ** i)
    ao = np.clip(1 - 5 * ao, 0.35, 1)
    amb = (0.38 + 0.2 * nw[:, 1])[:, None] * np.array([0.9, 0.9, 1.0])
    col = alb * diff[:, None] * np.array([1.0, 0.96, 0.88]) + alb * amb * ao[:, None]
    col += (np.clip(nw @ Hv, 0, 1) ** 40 * 0.45)[:, None]                       # ツヤ
    col += ((1 - np.clip(nw @ V, 0, 1)) ** 3 * 0.3)[:, None] * np.array([1.0, 0.85, 0.55])  # 暖色のふち
    col = np.clip(col, 0, 1) ** (1 / 1.1)
    img[idx, :3] = col; img[idx, 3] = 1
    img = img.reshape(h, w, 4)
    pm = img.copy(); pm[..., :3] *= pm[..., 3:4]
    pm = pm.reshape(H, SS, W, SS, 4).mean(axis=(1, 3))

    # 拾えるアイテムだとわかるように、ふんわり光る輪をうしろに
    yy, xx = np.mgrid[0:H, 0:W]
    r = np.sqrt(((xx + 0.5) / W - 0.5) ** 2 * 4 + ((yy + 0.5) / H - 0.5) ** 2 * 4 * (H / W) ** -2 * 0.25)
    glow_a = (np.clip(1 - r / 0.95, 0, 1) ** 2.2 * 0.45)[..., None]
    glow = np.concatenate([np.array([1.0, 0.78, 0.38]) * glow_a, glow_a], -1)
    a_fg = pm[..., 3:4]
    out_pm = pm + glow * (1 - a_fg)
    a = out_pm[..., 3:4]
    rgb = np.where(a > 0, out_pm[..., :3] / np.maximum(a, 1e-6), 0)
    out = np.concatenate([rgb, a], -1)
    return (np.clip(out, 0, 1) * 255 + 0.5).astype(np.uint8)


def main():
    sheet = np.concatenate([render(i * 180.0 / FRAMES) for i in range(FRAMES)], 1)
    Image.fromarray(sheet, 'RGBA').save(OUT, optimize=True)
    print('saved', os.path.abspath(OUT), sheet.shape)


if __name__ == '__main__':
    main()
