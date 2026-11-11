"""
アプリのアイコンと起動画面の元画像を作る（appicon/ に出力）

  python3 tools/render_icon.py
  npx @capacitor/assets generate --android --assetPath appicon

柴犬の顔（render_dog.py の 3D モデル）を、奥へ続く鏡の枠の中に置く。
"""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

import render_dog as rd

OUT = os.path.join(os.path.dirname(__file__), '..', 'appicon')


_FACE = {}


def render_face(size):
    """正面から見た顔のアップ（透過 PNG）。重いので 1 回だけ描いて縮小して使い回す"""
    if 'img' not in _FACE:
        cache = os.path.join(OUT, '.face-cache.png')
        if os.path.exists(cache):
            _FACE['img'] = Image.open(cache).convert('RGBA')
        else:
            rd.W, rd.H, rd.SS = 900, 900, 2
            rd.X0, rd.X1 = -0.27, 0.27
            rd.Y0, rd.Y1 = 0.43, 0.97
            _FACE['img'] = Image.fromarray(rd.render(0.0, None), 'RGBA')
            _FACE['img'].save(cache)
    return _FACE['img'].resize((size, size), Image.LANCZOS)


def background(size, mirror=True):
    """深い紫の空間に、奥へ続く鏡の枠"""
    img = Image.new('RGB', (size, size))
    yy, xx = np.mgrid[0:size, 0:size] / size
    r = np.sqrt((xx - 0.5) ** 2 + (yy - 0.45) ** 2)
    c0, c1 = np.array([70, 80, 150]), np.array([12, 10, 26])
    t = np.clip(r / 0.75, 0, 1)[..., None]
    img = Image.fromarray((c0 * (1 - t) + c1 * t).astype(np.uint8), 'RGB').convert('RGBA')
    if mirror:
        layer = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        d = ImageDraw.Draw(layer)
        cx, cy = size * 0.5, size * 0.45
        cx, cy = size * 0.5, size * 0.4
        for i in range(10):
            s = 1.0 * (0.8 ** i)
            w = size * s / 2
            a = int(235 * (0.86 ** i))
            # 鏡のうっすらした青み と 銀の枠
            d.rounded_rectangle([cx - w, cy - w, cx + w, cy + w], radius=max(2, int(w * 0.06)),
                                fill=(110, 150, 235, 22))
            d.rounded_rectangle([cx - w, cy - w, cx + w, cy + w], radius=max(2, int(w * 0.06)),
                                outline=(205, 210, 245, a), width=max(2, int(size * 0.016 * (0.85 ** i))))
        img = Image.alpha_composite(img, layer)
    return img


def compose(size, face_scale=0.78, mirror=True, bg=True):
    base = background(size, mirror) if bg else Image.new('RGBA', (size, size), (0, 0, 0, 0))
    face = render_face(int(size * face_scale))
    # 足もとの影
    glow = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    fx = (size - face.width) // 2
    fy = size - face.height
    gd.ellipse([fx + face.width * 0.2, fy + face.height * 0.25, fx + face.width * 0.8, fy + face.height * 1.05], fill=(5, 4, 12, 150))
    base = Image.alpha_composite(base, glow.filter(ImageFilter.GaussianBlur(size * 0.06)))
    base.alpha_composite(face, (fx, fy))
    return base


def main():
    os.makedirs(OUT, exist_ok=True)
    icon = compose(1024)
    icon.convert('RGB').save(os.path.join(OUT, 'icon-only.png'))
    # アダプティブアイコン：前景（犬）は中央 66% に収める、背景は鏡の空間
    fg = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
    face = render_face(800)
    fg.alpha_composite(face, ((1024 - 800) // 2, 1024 - 800))
    fg.save(os.path.join(OUT, 'icon-foreground.png'))
    background(1024).convert('RGB').save(os.path.join(OUT, 'icon-background.png'))
    # 起動画面：中央にアイコン
    splash = Image.new('RGB', (2732, 2732), (11, 9, 20))
    small = compose(900).resize((900, 900))
    mask = Image.new('L', (900, 900), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, 899, 899], radius=180, fill=255)
    splash.paste(small, ((2732 - 900) // 2, (2732 - 900) // 2), mask)
    splash.save(os.path.join(OUT, 'splash.png'))
    splash.save(os.path.join(OUT, 'splash-dark.png'))
    print('saved', os.path.abspath(OUT))


if __name__ == '__main__':
    main()
