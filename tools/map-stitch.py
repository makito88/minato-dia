#!/usr/bin/env python3
"""届いたタイルの絵（docs/map-tiles/art/*-art.png）を、tiles.json の位置に並べてつなぐ（確認用）。

使い方:  python3 tools/map-stitch.py
出力:    docs/map-tiles/stitched.jpg（つないだ1枚）・stitched-check.jpg（下絵の線路・川・海岸・駅とタイルの枠を重ねたもの）
- 重なりは、あとから置くタイルのはしをなめらかに透かしてなじませる（北の帯→本線の帯の順。どちらも西から東へ）。
- ゲームの地図は変えない（確認用の絵だけ）。
"""
import json, importlib.util
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'docs' / 'map-tiles'
S = 1.0   # 1マスあたりの px（確認用なので小さめ）


def ramp(w, h, left, top):
    """左はし left px・上はし top px を 0→255 にする透かし"""
    m = Image.new('L', (w, h), 255)
    px = m.load()
    for x in range(w):
        a = min(1.0, x / left) if left else 1.0
        for y in range(h):
            b = min(1.0, y / top) if top else 1.0
            px[x, y] = int(255 * a * b)
    return m


def main():
    meta = json.loads((OUT / 'tiles.json').read_text(encoding='utf-8'))
    w = meta['world']
    W, H = int((w['x1'] - w['x0']) * S), int((w['y1'] - w['y0']) * S)
    can = Image.new('RGB', (W, H), (236, 238, 214))
    order = [t for t in meta['tiles'] if t['band'] == 'north'] + [t for t in meta['tiles'] if t['band'] == 'main']
    have = []
    for t in order:
        f = OUT / 'art' / (Path(t['file']).stem + '-art.png')
        if not f.exists():
            continue
        x0, y0 = int((t['x0'] - w['x0']) * S), int((t['y0'] - w['y0']) * S)
        tw, th = int((t['x1'] - t['x0']) * S), int((t['y1'] - t['y0']) * S)
        im = Image.open(f).convert('RGB').resize((tw, th), Image.LANCZOS)
        left = int(50 * S) if any(o['band'] == t['band'] and o['x1'] > t['x0'] and o['x0'] < t['x0'] and o['id'] in have for o in order) else 0
        top = int(125 * S) if t['band'] == 'main' else 0
        can.paste(im, (x0, y0), ramp(tw, th, left, top))
        have.append(t['id'])
    can.save(OUT / 'stitched.jpg', quality=86)
    # 下絵の線を重ねる
    spec = importlib.util.spec_from_file_location('ms', ROOT / 'tools' / 'map-sketch.py')
    ms = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(ms)
    chk = can.copy()
    d = ImageDraw.Draw(chk)
    P = lambda x, y: ((x - w['x0']) * S, (y - w['y0']) * S)
    d.line([P(*ms.ST['C']), P(*ms.ST['P'])], fill=(200, 30, 30), width=3)
    d.line([P(*p) for p in ms.BRANCH], fill=(200, 30, 30), width=3)
    d.line([P(*p) for p in ms.OTHER], fill=(120, 60, 180), width=2)
    d.line([P(*p) for p in ms.RIVER], fill=(0, 90, 255), width=2)
    d.line([P(*p) for p in ms.SEA[:-1]], fill=(0, 200, 255), width=2)
    font = ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc', 18)
    for s, (x, y) in ms.ST.items():
        cx, cy = P(x, y)
        d.ellipse([cx - 6, cy - 6, cx + 6, cy + 6], fill=(255, 255, 255), outline=(200, 30, 30), width=3)
        d.text((cx + 8, cy - 26), ms.NAME[s], fill=(200, 30, 30), font=font, stroke_width=3, stroke_fill=(255, 255, 255))
    for t in meta['tiles']:
        c = (200, 40, 40) if t['band'] == 'main' else (30, 70, 200)
        d.rectangle([P(t['x0'], t['y0']), (P(t['x1'], t['y1'])[0] - 1, P(t['x1'], t['y1'])[1] - 1)], outline=c, width=1)
        d.text(P(t['x0'] + 4, t['y0'] + (4 if t['band'] == 'north' else 640)), t['id'], fill=c, font=font, stroke_width=2, stroke_fill=(255, 255, 255))
    chk.save(OUT / 'stitched-check.jpg', quality=86)
    print('ok', len(have), 'tiles', W, H)


if __name__ == '__main__':
    main()
