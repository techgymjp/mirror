"""
柴犬スプライトを SDF レイマーチングで事前レンダリングして assets/dog.png に書き出す。

  python3 tools/render_dog.py

シート構成: 横 = 向き（0°=正面 … 180°=背面、22.5°刻みの 9 枚。左向きはゲーム側で左右反転）
            縦 = ポーズ（0: 立ち, 1-4: 速歩きのコマ）
"""
import math
import os
import numpy as np
from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'dog.png')
W, H = 144, 120          # 1 コマのサイズ
SS = 2                   # スーパーサンプリング
X0, X1 = -0.62, 0.62     # モデル座標でのコマの範囲
Y0, Y1 = -0.02, 1.01
ANGLES = [i * 22.5 for i in range(9)]
POSES = [None, 0.0, 0.25, 0.5, 0.75]

# ---------- SDF ユーティリティ ----------

def length(v):
    return np.sqrt(np.sum(v * v, axis=-1))


def sd_ellipsoid(p, c, r):
    q = (p - c) / r
    k0 = length(q)
    k1 = length(q / r)
    return k0 * (k0 - 1.0) / np.maximum(k1, 1e-6)


def sd_cone(p, a, b, ra, rb):
    a = np.asarray(a, float); b = np.asarray(b, float)
    pa = p - a
    ba = b - a
    t = np.clip(np.sum(pa * ba, -1) / np.dot(ba, ba), 0, 1)
    d = length(pa - t[:, None] * ba)
    return d - (ra + (rb - ra) * t)


def sd_torus_z(p, c, R, r):
    q = p - c
    rad = np.sqrt(q[:, 0] ** 2 + q[:, 1] ** 2)
    return np.sqrt((rad - R) ** 2 + q[:, 2] ** 2) - r


def sd_torus_axis(p, c, axis, R, r):
    v = p - c
    h = v @ axis
    rad = length(v - h[:, None] * axis)
    return np.sqrt((rad - R) ** 2 + h ** 2) - r


def smin(a, b, k):
    h = np.clip(0.5 + 0.5 * (b - a) / k, 0, 1)
    return b + (a - b) * h - k * h * (1 - h)


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


# ---------- 柴犬モデル ----------

class Dog:
    def __init__(self, phase):
        self.phase = phase
        if phase is None:
            s = [0.0] * 4; lift = [0.0] * 4; bob = 0.0; wag = 0.0; nod = 0.0
        else:
            w = 2 * math.pi * phase
            # 速歩き：対角の脚（左前＋右後 / 右前＋左後）が一緒に動く
            offs = [0.0, math.pi, math.pi, 0.0]   # FL, FR, HL, HR
            s = [math.sin(w + o) for o in offs]
            lift = [max(0.0, math.cos(w + o)) for o in offs]
            bob = 0.012 * math.cos(2 * w)
            wag = 0.03 * math.sin(w)
            nod = 0.008 * math.cos(2 * w + 0.6)
        # 胴体全体を少し低く（柴犬らしいコンパクトな脚の長さに）
        self.s, self.lift, self.bob, self.wag, self.nod = s, lift, bob - 0.045, wag, nod

    def parts(self, p):
        """(fur 距離, fur 部位 id 配列, 他の材質の距離 dict) を返す"""
        b = self.bob
        n = self.nod
        d = {}
        d['torso'] = smin(
            smin(sd_ellipsoid(p, np.array([-0.01, 0.45 + b, 0]), np.array([0.33, 0.155, 0.14])),
                 sd_ellipsoid(p, np.array([0.19, 0.42 + b, 0]), np.array([0.14, 0.172, 0.135])), 0.06),
            sd_ellipsoid(p, np.array([-0.24, 0.46 + b, 0]), np.array([0.14, 0.14, 0.135])), 0.06)
        d['neck'] = sd_cone(p, [0.23, 0.50 + b, 0], [0.37, 0.67 + b + n, 0], 0.10, 0.082)
        hc = np.array([0.40, 0.74 + b + n, 0])
        d['head'] = sd_ellipsoid(p, hc, np.array([0.13, 0.122, 0.122]))
        d['cheek'] = sd_ellipsoid(p, hc + [0.035, -0.045, 0], np.array([0.09, 0.075, 0.122]))
        d['muzzle'] = sd_cone(p, [0.46, 0.712 + b + n, 0], [0.585, 0.688 + b + n, 0], 0.062, 0.036)
        # 耳：前後方向につぶした三角っぽい円錐
        ear = None
        for z in (0.066, -0.066):
            q = p.copy()
            q[:, 0] = 0.375 + (q[:, 0] - 0.375) * 1.9
            e = sd_cone(q, [0.375, 0.83 + b + n, z], [0.39, 0.965 + b + n, z * 1.35], 0.056, 0.007) / 1.9
            ear = e if ear is None else np.minimum(ear, e)
        d['ear'] = ear
        # 脚
        legs = None
        for i, (fx, z, front) in enumerate([(0.0, 0.075, True), (0.0, -0.075, True), (0.0, 0.085, False), (0.0, -0.085, False)]):
            sw = self.s[i] * 0.085
            lf = self.lift[i] * 0.055
            if front:
                l = smin(sd_cone(p, [0.20, 0.42 + b, z], [0.225 + sw * 0.8, 0.11 + lf, z], 0.06, 0.04),
                         sd_cone(p, [0.225 + sw * 0.8, 0.11 + lf, z], [0.245 + sw, 0.03 + lf, z], 0.04, 0.036), 0.02)
                l = smin(l, sd_ellipsoid(p, np.array([0.262 + sw, 0.026 + lf, z]), np.array([0.05, 0.028, 0.04])), 0.02)
            else:
                knee = [-0.17 + sw * 0.5, 0.27 + lf * 0.5 + b * 0.5, z]
                hock = [-0.30 + sw, 0.12 + lf, z]
                l = smin(sd_cone(p, [-0.24, 0.45 + b, z], knee, 0.095, 0.058),
                         sd_cone(p, knee, hock, 0.056, 0.04), 0.03)
                l = smin(l, sd_cone(p, hock, [-0.275 + sw, 0.03 + lf, z], 0.04, 0.036), 0.02)
                l = smin(l, sd_ellipsoid(p, np.array([-0.258 + sw, 0.026 + lf, z]), np.array([0.05, 0.028, 0.04])), 0.02)
            legs = l if legs is None else np.minimum(legs, l)
        d['leg'] = legs
        # くるんと巻いたしっぽ
        tc = np.array([-0.29, 0.635 + b, self.wag])
        d['tail'] = smin(sd_torus_z(p, tc, 0.072, 0.045),
                         sd_cone(p, [-0.33, 0.50 + b, 0], [-0.355, 0.61 + b, self.wag * 0.5], 0.05, 0.045), 0.03)

        names = ['torso', 'neck', 'head', 'cheek', 'muzzle', 'ear', 'leg', 'tail']
        stack = np.stack([d[k] for k in names])
        part = np.argmin(stack, axis=0)
        fur = d['torso']
        for k, kk in [('neck', 0.05), ('head', 0.05), ('cheek', 0.04), ('muzzle', 0.035), ('ear', 0.02), ('leg', 0.04), ('tail', 0.035)]:
            fur = smin(fur, d[k], kk)

        other = {}
        eyes = None
        for z in (0.063, -0.063):
            e = sd_ellipsoid(p, np.array([0.507, 0.768 + b + n, z]), np.array([0.019, 0.016, 0.019]))
            eyes = e if eyes is None else np.minimum(eyes, e)
        other['eye'] = eyes
        other['nose'] = sd_ellipsoid(p, np.array([0.607, 0.692 + b + n, 0]), np.array([0.023, 0.021, 0.028]))
        axis = np.array([0.14, 0.17, 0.0]); axis /= np.linalg.norm(axis)
        other['collar'] = sd_torus_axis(p, np.array([0.30, 0.585 + b + n * 0.5, 0]), axis, 0.093, 0.017)
        other['tag'] = sd_ellipsoid(p, np.array([0.375, 0.52 + b, 0]), np.array([0.012, 0.018, 0.018]))
        return fur, part, other, d

    def sdf(self, p):
        fur, part, other, _ = self.parts(p)
        dist = fur
        mat = np.zeros(len(p), int)
        for i, k in enumerate(['eye', 'nose', 'collar', 'tag']):
            m = other[k] < dist
            dist = np.where(m, other[k], dist)
            mat = np.where(m, i + 1, mat)
        return dist, mat, part


# ---------- ノイズ（毛並み） ----------

def hash3(i):
    h = (i[..., 0] * 73856093) ^ (i[..., 1] * 19349663) ^ (i[..., 2] * 83492791)
    h = (h ^ (h >> 13)) * 1274126177
    return ((h ^ (h >> 16)) & 0xFFFF) / 65535.0


def vnoise(p):
    i = np.floor(p).astype(np.int64)
    f = p - i
    u = f * f * (3 - 2 * f)
    res = 0
    for dx in (0, 1):
        for dy in (0, 1):
            for dz in (0, 1):
                w = (u[:, 0] if dx else 1 - u[:, 0]) * (u[:, 1] if dy else 1 - u[:, 1]) * (u[:, 2] if dz else 1 - u[:, 2])
                res = res + w * hash3(i + np.array([dx, dy, dz]))
    return res


# ---------- レンダリング ----------

def rot_y(deg):
    a = math.radians(deg)
    c, s = math.cos(a), math.sin(a)
    return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])


def render(angle, phase):
    dog = Dog(phase)
    w, h = W * SS, H * SS
    xs = X0 + (np.arange(w) + 0.5) / w * (X1 - X0)
    ys = Y1 - (np.arange(h) + 0.5) / h * (Y1 - Y0)
    gx, gy = np.meshgrid(xs, ys)
    N = gx.size
    # ψ: 0 = 正面（犬がカメラを向く）, 90 = 鼻が画面右
    theta = angle - 90.0
    R = rot_y(theta)          # モデル→ワールド
    Rinv = R.T
    ro_w = np.stack([gx.ravel(), gy.ravel(), np.full(N, 2.0)], -1)
    rd_w = np.array([0, 0, -1.0])
    ro = ro_w @ Rinv.T
    rd = rd_w @ Rinv.T
    t = np.zeros(N)
    hit = np.zeros(N, bool)
    alive = np.ones(N, bool)
    for _ in range(110):
        idx = np.nonzero(alive)[0]
        if not len(idx):
            break
        p = ro[idx] + t[idx, None] * rd
        dist, _, _ = dog.sdf(p)
        t[idx] += dist * 0.9
        done = dist < 0.0008
        hit[idx[done]] = True
        alive[idx[done]] = False
        alive[idx[t[idx] > 4.0]] = False

    img = np.zeros((N, 4))
    idx = np.nonzero(hit)[0]
    p = ro[idx] + t[idx, None] * rd
    dist, mat, part = dog.sdf(p)
    e = 0.0015
    nrm = np.zeros_like(p)
    for k in range(3):
        o = np.zeros(3); o[k] = e
        nrm[:, k] = dog.sdf(p + o)[0] - dog.sdf(p - o)[0]
    nrm /= length(nrm)[:, None]
    # 毛並みで法線を少し揺らす
    fq = p * np.array([60, 140, 60])
    nrm += 0.07 * (np.stack([vnoise(fq), vnoise(fq + 17.3), vnoise(fq + 41.1)], -1) - 0.5)
    nrm /= length(nrm)[:, None]

    # 材質の色
    x, y, z = p[:, 0] - 0.0, p[:, 1] - dog.bob, p[:, 2]
    red = np.array([0.80, 0.44, 0.17])
    cream = np.array([0.98, 0.93, 0.84])
    wmask = np.zeros(len(p))
    # 裏白（マズル・頬・胸・お腹・足先・しっぽの内側）
    wmask = np.maximum(wmask, smoothstep(0.45, 0.50, x) * smoothstep(0.735, 0.695, y - dog.nod) * (part == 4))
    wmask = np.maximum(wmask, smoothstep(0.45, 0.50, x) * smoothstep(0.035, 0.05, np.abs(z)) * (part == 4))
    wmask = np.maximum(wmask, smoothstep(0.725, 0.69, y - dog.nod) * smoothstep(0.035, 0.07, np.abs(z)) * ((part == 3) | (part == 2)) * smoothstep(0.33, 0.40, x))
    wmask = np.maximum(wmask, smoothstep(-0.01, 0.03, (x - 0.20) - 0.48 * (y - 0.40)) * smoothstep(0.71, 0.66, y) * (part <= 1))
    wmask = np.maximum(wmask, smoothstep(0.375, 0.33, y) * (part == 0) * smoothstep(-0.35, -0.2, x))
    wmask = np.maximum(wmask, smoothstep(0.13, 0.08, p[:, 1]) * (part == 6) * 0.85)
    # 脚の内側・後ろ側は白っぽい
    wmask = np.maximum(wmask, smoothstep(0.30, 0.2, p[:, 1]) * (part == 6) * smoothstep(0.075, 0.05, np.abs(z)) * 0.7)
    tc = np.array([-0.29, 0.635 + dog.bob])
    trad = np.sqrt((p[:, 0] - tc[0]) ** 2 + (p[:, 1] - tc[1]) ** 2)
    wmask = np.maximum(wmask, smoothstep(0.072, 0.045, trad) * (part == 7))
    for zz in (0.05, -0.05):  # 麻呂眉
        dd = np.sqrt((x - 0.488) ** 2 + (y - dog.nod - 0.808) ** 2 + (z - zz) ** 2)
        wmask = np.maximum(wmask, smoothstep(0.022, 0.012, dd))
    # 背中はやや濃い
    dark = smoothstep(0.52, 0.62, y) * (part == 0) * 0.25 + smoothstep(0.80, 0.86, y - dog.nod) * (part == 2) * 0.12
    furc = red[None] * (1 - dark[:, None])
    # 耳の内側
    inner = (part == 5) & (np.sign(nrm @ (R @ np.array([1, 0, 0]))) > 0)
    furc = np.where(inner[:, None], np.array([0.90, 0.64, 0.55]), furc)
    alb = furc * (1 - wmask[:, None]) + cream[None] * wmask[:, None]
    # 黒い口元
    lip = smoothstep(0.012, 0.004, np.abs(y - dog.nod - 0.668 + (x - 0.5) * 0.12)) * smoothstep(0.47, 0.50, x) * (part == 4)
    alb = alb * (1 - lip[:, None] * 0.85)
    # 毛のムラ
    fn = vnoise(p * np.array([70, 160, 70])) * 0.4 + vnoise(p * 22) * 0.6
    alb = alb * (0.92 + 0.16 * fn)[:, None]
    matcol = {1: [0.03, 0.02, 0.02], 2: [0.04, 0.035, 0.035], 3: [0.80, 0.10, 0.14], 4: [0.95, 0.75, 0.25]}
    for m, c in matcol.items():
        alb = np.where((mat == m)[:, None], np.array(c), alb)

    # ライティング（ワールド空間で固定）
    nw = nrm @ R.T
    L = np.array([-0.45, 0.75, 0.55]); L /= np.linalg.norm(L)
    V = np.array([0, 0, 1.0])
    ndl = nw @ L
    diff = np.clip(ndl * 0.6 + 0.4, 0, 1) ** 1.6
    # 柔らかい影
    sh = np.ones(len(p))
    Lm = Rinv @ L
    ts = np.full(len(p), 0.01)
    for _ in range(28):
        dd = dog.sdf(p + ts[:, None] * Lm)[0]
        sh = np.minimum(sh, np.clip(10 * dd / ts, 0, 1))
        ts += np.clip(dd, 0.01, 0.08)
    sh = 0.35 + 0.65 * sh
    # AO
    ao = np.zeros(len(p))
    for i in range(1, 6):
        hh = 0.015 * i
        ao += (hh - dog.sdf(p + nrm * hh)[0]) / (2 ** i)
    ao = np.clip(1 - 6 * ao, 0.25, 1)
    amb = (0.34 + 0.16 * nw[:, 1])[:, None] * np.array([0.85, 0.88, 1.0])[None]
    rim = (1 - np.clip(nw @ V, 0, 1)) ** 3 * 0.22
    col = alb * (diff * sh)[:, None] * np.array([1.0, 0.95, 0.88]) + alb * amb * ao[:, None]
    col += rim[:, None] * np.array([0.55, 0.7, 1.0]) * ao[:, None]
    # 目・鼻・タグのツヤ
    Hv = (L + V) / np.linalg.norm(L + V)
    spec = np.clip(nw @ Hv, 0, 1)
    gloss = np.where(mat == 1, 2.2, np.where(mat == 2, 0.8, np.where(mat == 4, 1.2, np.where(mat == 3, 0.25, 0.04))))
    pw = np.where(mat == 1, 120, np.where(mat >= 2, 40, 12))
    col += (gloss * spec ** pw * sh)[:, None]
    col = col * ao[:, None] ** 0.3
    col = np.clip(col, 0, 1) ** (1 / 1.15)

    img[idx, :3] = col
    img[idx, 3] = 1.0
    img = img.reshape(h, w, 4)
    # ダウンサンプル（プリマルチプライドで平均）
    pm = img.copy(); pm[..., :3] *= pm[..., 3:4]
    pm = pm.reshape(H, SS, W, SS, 4).mean(axis=(1, 3))
    a = pm[..., 3:4]
    rgb = np.where(a > 0, pm[..., :3] / np.maximum(a, 1e-6), 0)
    out = np.concatenate([rgb, a], -1)
    return (np.clip(out, 0, 1) * 255 + 0.5).astype(np.uint8)


def main():
    sheet = np.zeros((H * len(POSES), W * len(ANGLES), 4), np.uint8)
    for r, ph in enumerate(POSES):
        for c, ang in enumerate(ANGLES):
            sheet[r * H:(r + 1) * H, c * W:(c + 1) * W] = render(ang, ph)
            print('rendered pose', r, 'angle', ang, flush=True)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    Image.fromarray(sheet, 'RGBA').save(OUT, optimize=True)
    print('saved', os.path.abspath(OUT))


if __name__ == '__main__':
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == 'preview':
        ims = [render(a, None) for a in (0, 45, 90, 135, 180)]
        Image.fromarray(np.concatenate(ims, 1), 'RGBA').save(sys.argv[2])
    else:
        main()
