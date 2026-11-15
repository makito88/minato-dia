#!/usr/bin/env python3
"""届いたタイルの絵（docs/map-tiles/art/*-art.png）を、tiles.json の位置に並べてつなぐ（確認用）。

使い方:  python3 tools/map-stitch.py
出力（docs/map-tiles/）:
  stitched.jpg          つないだ1枚（1マス＝2px、6200×2000）
  stitched-small.jpg    同じ絵の半分の大きさ
  stitched-check.jpg    半分の大きさに、下絵の線路・川・海岸・駅とタイルの枠を重ねたもの
  seams.json            つなぎ目の線と、ぼかした所・層の位置（確かめるページで使う）
  layers/<タイル>.jpg・-a.png  層（手で直す前の色と、なじませの透け具合）。ページで手直しを試すのに使う
読むもの: fixes.json（あれば）＝ページで手で直したピン [{tile,x,y,dx,dy,r}]（マス）。そのタイルの色だけをゆがめる
つなぎ方（ゲームの地図は変えない。確認用の絵だけ）:
  1. 置く順：本線の帯（西→東）→ 北の帯（西→東）。
  2. 少しずらして合わせる：重なりの所がいちばん似る位置へ、タイルを丸ごと最大±20px 動かす。
  3. 道を合わせる：つなぎ目に沿って小さな区切りごとに、どれだけずれているかを測り、
     新しいタイルをつなぎ目の近くだけ少しゆがめて（離れるほど0に）道や川の線を合わせる。
  4. つなぎ目の線：重なりの中で、2枚の絵の違いがいちばん小さい道すじ（最小コストの線）で切りかえ、
     線のまわり8pxだけなじませる（全体を透かすと道が二重に見えるため）。
  5. それでも違いが大きく残った所は、つなぎ目のまわりを軽くぼかす。
"""
import json, importlib.util
from pathlib import Path
import numpy as np
import cv2

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'docs' / 'map-tiles'
S = 2.0           # 1マスあたりの px
SHIFT = 20        # 丸ごと動かす範囲（px）
BLK, WARP = 96, 40   # 道を合わせる区切りの長さ・ずらす最大（px）
DECAY = 300       # ゆがみが0になるまでの距離（px）
FEATHER = 8       # つなぎ目のなじませ（px）
BAD = 50          # つなぎ目に沿ってならした違いがこれより大きい所だけ、まわりを軽くぼかす（0〜255の平均の差）


def load(t, w):
    f = OUT / 'art' / (Path(t['file']).stem + '-art.png')
    if not f.exists():
        return None
    tw, th = int(round((t['x1'] - t['x0']) * S)), int(round((t['y1'] - t['y0']) * S))
    im = cv2.imread(str(f), cv2.IMREAD_COLOR)
    return cv2.resize(im, (tw, th), interpolation=cv2.INTER_AREA)


def diff(a, b):
    return np.abs(a.astype(np.int16) - b.astype(np.int16)).sum(axis=2).astype(np.float32) / 3


def best_shift(can, have, im, x0, y0):
    """重なりがいちばん似る丸ごとのずれ（小さくして探す）"""
    h, w = im.shape[:2]
    sm = 4
    best, arg = None, (0, 0)
    for dy in range(-SHIFT, SHIFT + 1, 2):
        for dx in range(-SHIFT, SHIFT + 1, 2):
            X0, Y0 = x0 + dx, y0 + dy
            cx0, cy0, cx1, cy1 = max(X0, 0), max(Y0, 0), min(X0 + w, can.shape[1]), min(Y0 + h, can.shape[0])
            m = have[cy0:cy1, cx0:cx1]
            if m.sum() < 2000:
                return (0, 0)
            a = can[cy0:cy1:sm, cx0:cx1:sm]
            b = im[cy0 - Y0:cy1 - Y0:sm, cx0 - X0:cx1 - X0:sm]
            mm = m[::sm, ::sm] > 0
            d = diff(a, b)[mm].mean()
            d += 0.15 * (abs(dx) + abs(dy))      # 動かしすぎない
            if best is None or d < best:
                best, arg = d, (dx, dy)
    return arg


def block_match(a, b, mask, vertical):
    """つなぎ目に沿って、区切りごとのずれ（dx,dy）を測る。vertical＝縦のつなぎ目（左右のタイル）"""
    L = a.shape[0] if vertical else a.shape[1]
    pts = []
    for s in range(0, L - BLK + 1, BLK // 2):
        sl = (slice(s, s + BLK), slice(None)) if vertical else (slice(None), slice(s, s + BLK))
        A, B, M = a[sl], b[sl], mask[sl]
        if M.mean() < 0.6:
            continue
        ga = cv2.cvtColor(A, cv2.COLOR_BGR2GRAY).astype(np.float32)
        gb = cv2.cvtColor(B, cv2.COLOR_BGR2GRAY).astype(np.float32)
        if ga.std() < 6:      # 田んぼや海だけで手がかりがない
            continue
        my, mx = min(WARP, ga.shape[0] // 4), min(WARP, ga.shape[1] // 4)
        best, arg = None, (0, 0)
        for dy in range(-WARP, WARP + 1, 2):
            for dx in range(-WARP, WARP + 1, 2):
                Bs = np.roll(np.roll(gb, dy, 0), dx, 1)
                c = np.abs(ga - Bs)[my:ga.shape[0] - my, mx:ga.shape[1] - mx].mean() + 0.2 * (abs(dx) + abs(dy))
                if best is None or c < best:
                    best, arg = c, (dx, dy)
        pts.append((s + BLK / 2, arg[0], arg[1]))
    prof = np.zeros((L, 2), np.float32)
    if pts:
        xs = np.array([p[0] for p in pts])
        for k in (1, 2):
            v = np.array([p[k] for p in pts], np.float32)
            v = np.convolve(np.pad(v, 1, mode='edge'), [0.25, 0.5, 0.25], 'valid')
            prof[:, k - 1] = np.interp(np.arange(L), xs, v)
    return prof


def warp_tile(im, prof, vertical, side_len):
    """つなぎ目の近くだけゆがめる。vertical：左はしがつなぎ目（profは縦方向）。でなければ下はしがつなぎ目"""
    h, w = im.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    if vertical:
        dist = np.clip(xx - side_len, 0, None)
        wgt = np.clip(1 - dist / DECAY, 0, 1)
        dx = prof[:, 0][:, None] * wgt
        dy = prof[:, 1][:, None] * wgt
    else:
        dist = np.clip((h - side_len) - yy, 0, None)
        wgt = np.clip(1 - dist / DECAY, 0, 1)
        dx = prof[:, 0][None, :] * wgt
        dy = prof[:, 1][None, :] * wgt
    return cv2.remap(im, xx - dx, yy - dy, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)


def seam_path(cost):
    """上から下へ、コストのいちばん小さい道すじ（各行の x）"""
    h, w = cost.shape
    acc = cost.copy()
    back = np.zeros((h, w), np.int8)
    for y in range(1, h):
        prev = acc[y - 1]
        l = np.r_[np.inf, prev[:-1]]
        r = np.r_[prev[1:], np.inf]
        st = np.vstack([l, prev, r])
        k = st.argmin(0)
        acc[y] += st[k, np.arange(w)]
        back[y] = k - 1
    x = int(acc[-1].argmin())
    path = np.zeros(h, np.int32)
    for y in range(h - 1, -1, -1):
        path[y] = x
        x = int(np.clip(x + int(back[y, x]), 0, w - 1))
    return path


LAY = OUT / 'layers'


def apply_pins(im, pins, lx, ly, wx0):
    """ピン1本ずつ：始点 (x,y) を終点 (x+dx, y+dy) へ引っぱる。まわりはガウスの重みで少しずつ（半径 r＝σ×2）。
    単位はマス。ページ（viewer.html の warpPin）と同じ式"""
    if not pins:
        return im
    h, w = im.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    for q in pins:
        ex, ey = (q['x'] + q['dx'] - wx0) * S - lx, (q['y'] + q['dy']) * S - ly
        ddx, ddy, sg = q['dx'] * S, q['dy'] * S, max(1.0, q['r'] * S / 2)
        wgt = np.exp(-((xx - ex) ** 2 + (yy - ey) ** 2) / (2 * sg * sg))
        im = cv2.remap(im, xx - ddx * wgt, yy - ddy * wgt, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    return im


def mark_bad(badmap, samples):
    """つなぎ目に沿った違いを41pxでならし、BAD をこえる所だけ印を付ける（町の中は建物がちがって当たり前なので、ならしてから）"""
    if not samples:
        return
    v = np.array([q[2] for q in samples], np.float32)
    sm = np.convolve(np.pad(v, 20, mode='edge'), np.ones(41) / 41, 'valid')
    for (x, y, _), a in zip(samples, sm):
        if a > BAD and 0 <= y < badmap.shape[0] and 0 <= x < badmap.shape[1]:
            badmap[y, x] = 1


def main():
    meta = json.loads((OUT / 'tiles.json').read_text(encoding='utf-8'))
    wd = meta['world']
    W, H = int((wd['x1'] - wd['x0']) * S), int((wd['y1'] - wd['y0']) * S)
    can = np.full((H, W, 3), (214, 238, 236), np.uint8)
    fin = can.copy()   # 手で直した所を入れた仕上げ（can は直す前のまま、つなぎ目を決めるのに使う）
    have = np.zeros((H, W), np.uint8)
    badmap = np.zeros((H, W), np.float32)
    seams, info = [], []
    fx = OUT / 'fixes.json'
    pins = json.loads(fx.read_text(encoding='utf-8')).get('pins', []) if fx.exists() else []
    layers = []
    order = [t for t in meta['tiles'] if t['band'] == 'main'] + [t for t in meta['tiles'] if t['band'] == 'north']
    for t in order:
        im = load(t, wd)
        if im is None:
            continue
        x0, y0 = int(round((t['x0'] - wd['x0']) * S)), int(round((t['y0'] - wd['y0']) * S))
        dx, dy = best_shift(can, have, im, x0, y0)
        x0 += dx
        y0 += dy
        h, w = im.shape[:2]
        cx0, cy0, cx1, cy1 = max(x0, 0), max(y0, 0), min(x0 + w, W), min(y0 + h, H)
        im = im[cy0 - y0:cy1 - y0, cx0 - x0:cx1 - x0]
        x0, y0 = cx0, cy0
        h, w = im.shape[:2]
        old = can[y0:y0 + h, x0:x0 + w].copy()
        ov = have[y0:y0 + h, x0:x0 + w] > 0
        # 左のつなぎ目（縦）
        lw = int(ov[h // 2:, :].any(0).sum()) if t['band'] == 'main' else int(ov[: h // 2, :].any(0).sum())
        lw = lw if lw > 20 and ov[:, :lw].mean() > 0.5 else 0
        # 下のつなぎ目（北の帯の下＝本線の帯の上）
        bh = int(ov[:, w // 2].sum()) if t['band'] == 'north' else 0
        if lw:
            prof = block_match(old[:, :lw], im[:, :lw], ov[:, :lw].astype(np.float32), True)
            im = warp_tile(im, prof, True, lw)
        if bh:
            prof = block_match(old[h - bh:], im[h - bh:], ov[h - bh:].astype(np.float32), False)
            im = warp_tile(im, prof, False, bh)
        d = cv2.GaussianBlur(diff(old, im), (0, 0), 3)
        take = np.ones((h, w), np.float32)
        tb = np.ones((h, w), np.float32)
        cost = d + np.where(ov, 0, 1e4)
        if lw:
            band = cost[:, :lw].copy()
            band[:, :6] += 1e3
            band[:, -6:] += 1e3
            path = seam_path(band)
            cols = np.arange(w)[None, :]
            take = np.minimum(take, (cols >= path[:, None]).astype(np.float32))
            seams.append({'tile': t['id'], 'pts': [[(x0 + int(path[y])) / S + wd['x0'], (y0 + y) / S + wd['y0']] for y in range(0, h, 8)]})
            mark_bad(badmap, [(x0 + int(path[y]), y0 + y, d[y, int(path[y])] if ov[y, int(path[y])] else 0) for y in range(h)])
        if bh:
            band = cost[h - bh:].T.copy()
            band[:, :6] += 1e3
            band[:, -6:] += 1e3
            path = seam_path(band)      # 各列の y（帯の中）
            rows = np.arange(h)[:, None]
            tb = (rows <= (h - bh + path)[None, :]).astype(np.float32)
            seams.append({'tile': t['id'], 'pts': [[(x0 + x) / S + wd['x0'], (y0 + h - bh + int(path[x])) / S + wd['y0']] for x in range(0, w, 8)]})
            mark_bad(badmap, [(x0 + x, y0 + h - bh + int(path[x]), d[h - bh + int(path[x]), x] if ov[h - bh + int(path[x]), x] else 0) for x in range(w)])
        k = cv2.GaussianBlur(np.clip((d - 22) / 40, 0, 1), (0, 0), 8)   # 違いが大きい所は、なじませを広く

        def soft(m, a, b):
            m = np.where(ov, m, 1.0)
            return cv2.GaussianBlur(m, (0, 0), a) * (1 - k) + cv2.GaussianBlur(m, (0, 0), b) * k
        # 左右のつなぎ目は細く、上下（北の帯と本線の帯）は田畑や森が多いので広めになじませる
        take = np.minimum(soft(take, FEATHER / 2, FEATHER * 1.8), soft(tb, FEATHER * 1.4, FEATHER * 3))
        take = np.where(ov, take, 1.0)[..., None]
        # 確かめるページ用の層（手で直す前の色＋なじませの透け具合）
        LAY.mkdir(exist_ok=True)
        cv2.imwrite(str(LAY / f"{t['id']}.jpg"), im, [cv2.IMWRITE_JPEG_QUALITY, 88])
        cv2.imwrite(str(LAY / f"{t['id']}-a.png"), np.round(take[..., 0] * 255).astype(np.uint8), [cv2.IMWRITE_PNG_COMPRESSION, 9])
        layers.append({'id': t['id'], 'x': x0, 'y': y0, 'w': w, 'h': h})
        # 手で直した所（fixes.json のピン）：このタイルの色だけをゆがめる。つなぎ目（透け具合）は動かさない
        can[y0:y0 + h, x0:x0 + w] = (im * take + old * (1 - take)).astype(np.uint8)
        imp = apply_pins(im, [q for q in pins if q.get('tile') == t['id']], x0, y0, wd['x0'])
        fo = fin[y0:y0 + h, x0:x0 + w]
        fin[y0:y0 + h, x0:x0 + w] = (imp * take + fo * (1 - take)).astype(np.uint8)
        have[y0:y0 + h, x0:x0 + w] = 1
        info.append({'tile': t['id'], 'shift': [dx, dy], 'leftSeam': lw, 'bottomSeam': bh})
    # 違いの大きく残った所をぼかす
    bw = cv2.dilate(badmap, np.ones((7, 7), np.uint8))
    bw = cv2.GaussianBlur(bw, (0, 0), 7)
    bw = np.clip(bw * 2.5, 0, 1)[..., None]
    can = fin
    soft = cv2.GaussianBlur(can, (0, 0), 2.2)
    can = (can * (1 - bw) + soft * bw).astype(np.uint8)
    blurred = []
    n, lab, stats, cent = cv2.connectedComponentsWithStats((bw[..., 0] > 0.3).astype(np.uint8))
    for i in range(1, n):
        x, y, ww, hh, a = stats[i]
        if a > 150:
            blurred.append([x / S + wd['x0'], y / S + wd['y0'], ww / S, hh / S])
    cv2.imwrite(str(OUT / 'stitched.jpg'), can, [cv2.IMWRITE_JPEG_QUALITY, 85])
    small = cv2.resize(can, (W // 2, H // 2), interpolation=cv2.INTER_AREA)
    cv2.imwrite(str(OUT / 'stitched-small.jpg'), small, [cv2.IMWRITE_JPEG_QUALITY, 85])
    (OUT / 'seams.json').write_text(json.dumps({'note': 'つなぎ目の線と、ぼかした所（マス）。layers は確かめるページ用の層（px、1マス＝2px）。tools/map-stitch.py が作る',
                                                'tiles': info, 'seams': seams, 'blurred': blurred, 'layers': layers, 'pinsBaked': pins}, ensure_ascii=False), encoding='utf-8')
    # 確認用：下絵の線を重ねる（半分の大きさ）
    spec = importlib.util.spec_from_file_location('ms', ROOT / 'tools' / 'map-sketch.py')
    ms = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(ms)
    chk = small.copy()
    P = lambda x, y: (int((x - wd['x0'])), int((y - wd['y0'])))
    poly = lambda pts, col, th: cv2.polylines(chk, [np.array([P(*p) for p in pts], np.int32)], False, col, th, cv2.LINE_AA)
    poly([ms.ST['C'], ms.ST['P']], (30, 30, 200), 2)
    poly(ms.BRANCH, (30, 30, 200), 2)
    poly(ms.RIVER, (255, 90, 0), 1)
    poly(ms.SEA[:-1], (255, 200, 0), 1)
    for s in seams:
        poly(s['pts'], (0, 220, 255), 1)
    for s, (x, y) in ms.ST.items():
        cv2.circle(chk, P(x, y), 5, (255, 255, 255), -1)
        cv2.circle(chk, P(x, y), 5, (30, 30, 200), 2)
    cv2.imwrite(str(OUT / 'stitched-check.jpg'), chk, [cv2.IMWRITE_JPEG_QUALITY, 85])
    print('ok', len(info), 'tiles', W, H, 'blurred', len(blurred))
    for i in info:
        print(i)


if __name__ == '__main__':
    main()
