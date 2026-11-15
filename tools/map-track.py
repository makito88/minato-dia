#!/usr/bin/env python3
"""絵に描かれた「線路予定地」（砂利と草の細い帯）をなぞって、線路の形を決める（新しい地図の段3の準備）。

使い方:  python3 tools/map-track.py   （先に tools/map-stitch.py で stitched.jpg を作っておく）
出力:    docs/map-tiles/track.json（線路の形と駅の位置・マス）・track-check.jpg（絵に重ねた確認用・半分の大きさ）

決まり:
- 本線の駅の横の位置は キロ×100 のまま（x は動かさない）。縦（y）だけ、絵の帯に合わせる。
- 支線の駅は、下絵の位置にいちばん近い、なぞった線の上の点に置く（支線の駅の位置はもともと仮）。
- 駅のホームのまわり（前後 ±ST_FLAT マス）はまっすぐにする。カーブは半径がゆるくなるようにならす。
- 帯が見つからない所（川・田んぼだけの所）は、下絵の線に引きもどす。
- キロ・ダイヤ・運賃は変えない（形だけ）。
- トンネルと橋は TUNNELS（支線の道のり s マスで区間を出す。ゲームはこの区間の線路を「トンネル」として描く）。
"""
import json, importlib.util
from pathlib import Path
import numpy as np
import cv2

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'docs' / 'map-tiles'
S = 2.0
STRIP = np.array([110, 180, 198], np.float32)   # 帯の色（BGR）。絵の中から測った
STEP = 4            # なぞる間かく（px）
M_MAIN, M_BR = 60, 70   # 下絵の線から離れてよい幅（px）
ST_FLAT = 18        # 駅の前後でまっすぐにする長さ（マス）
JUNC = 40           # 川辺で温泉支線が分かれる所（駅の中心から東へ、マス）
# トンネル（ユーザーの頼み 2026-11-15）：森下〜峠のあいだ。沢をわたる橋の所だけ外に出る。
# from/to は森下→峠の道のりの割合。沢の場所は絵の水の色から見つける（cross_range の中）
TUNNELS = {'between': ('F', 'T'), 'from': 0.27, 'to': 0.82, 'cross_range': (0.30, 0.60),
           'open': 6, 'bridge': 3, 'names': ('森下トンネル', '森下沢橋梁', '峠トンネル')}


def score_map(im):
    """帯らしさ（小さいほど帯）：帯の色に近い・まわりがなめらか"""
    f = im.astype(np.float32)
    dist = np.sqrt(((f - STRIP) ** 2).sum(2))
    g = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY).astype(np.float32)
    mu = cv2.blur(g, (7, 7))
    sd = np.sqrt(np.clip(cv2.blur(g * g, (7, 7)) - mu * mu, 0, None))
    c = np.clip(dist / 40, 0, 2.5) + np.clip(sd / 18, 0, 2)
    return cv2.GaussianBlur(c, (0, 0), 5.0)   # 帯の太さ（10〜12px）ほどぼかして、帯のまん中を通す


def score_path(im):
    """山の中の帯らしさ：まわりより少し明るい・緑が強すぎない・真っ白（山道）ではない・なめらか"""
    hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV).astype(np.float32)
    L = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY).astype(np.float32)
    rel = L - cv2.blur(L, (41, 41))
    sat = hsv[..., 1]
    white = np.clip((L - 195) / 20, 0, 1) * np.clip((90 - sat) / 40, 0, 1)
    mu = cv2.blur(L, (7, 7))
    sd = np.sqrt(np.clip(cv2.blur(L * L, (7, 7)) - mu * mu, 0, None))
    c = 1.6 - np.clip(rel / 22, 0, 1.6) + 1.5 * white + np.clip(sd / 25, 0, 1.2)
    return cv2.GaussianBlur(c, (0, 0), 2.0)


def resample(poly, step):
    p = np.array(poly, np.float32)
    seg = np.r_[0, np.cumsum(np.hypot(*np.diff(p, axis=0).T))]
    t = np.arange(0, seg[-1], step)
    x = np.interp(t, seg, p[:, 0])
    y = np.interp(t, seg, p[:, 1])
    return np.c_[x, y], t


def trace(cost, guide_px, M, prior=0.35, jump=2, smooth=14, trust_at=2.2):
    """下絵の線にそって、法線方向のずれ o を動的計画法で選ぶ（となりとのずれの差は jump px まで）"""
    pts, _ = resample(guide_px, STEP)
    d = np.gradient(pts, axis=0)
    nrm = np.c_[-d[:, 1], d[:, 0]]
    nrm /= np.linalg.norm(nrm, axis=1, keepdims=True) + 1e-6
    offs = np.arange(-M, M + 1)
    n, k = len(pts), len(offs)
    X = pts[:, None, 0] + nrm[:, None, 0] * offs[None, :]
    Y = pts[:, None, 1] + nrm[:, None, 1] * offs[None, :]
    C = cv2.remap(cost, X.astype(np.float32), Y.astype(np.float32), cv2.INTER_LINEAR, borderValue=4.0)
    C = C + prior * np.abs(offs)[None, :] / M
    acc = C.copy()
    back = np.zeros((n, k), np.int32)
    for i in range(1, n):
        best = np.full(k, np.inf)
        arg = np.zeros(k, np.int32)
        for s in range(-jump, jump + 1):
            sh = np.roll(acc[i - 1], s)
            if s > 0:
                sh[:s] = np.inf
            elif s < 0:
                sh[s:] = np.inf
            v = sh + 0.04 * abs(s)
            m = v < best
            best[m] = v[m]
            arg[m] = (np.arange(k) - s)[m]
        acc[i] += best
        back[i] = arg
    j = int(acc[-1].argmin())
    o = np.zeros(n)
    for i in range(n - 1, -1, -1):
        o[i] = offs[j]
        j = back[i, j]
    # 帯が見つからない所（コストが高い）は下絵の線へ引きもどす
    cpath = C[np.arange(n), np.searchsorted(offs, o)]
    # 帯がはっきりしている＝まわり（同じ所の、ずれ全体）より目立ってコストが低い
    contrast = cv2.GaussianBlur((np.median(C, axis=1) - cpath).reshape(-1, 1).astype(np.float32), (1, 0), 6).ravel()
    trust = np.clip((contrast - 0.15) / 0.35, 0, 1)
    trust = cv2.GaussianBlur(trust.reshape(-1, 1), (1, 0), 10).ravel() if n > 3 else trust
    o = o * trust
    o = cv2.GaussianBlur(o.reshape(-1, 1).astype(np.float32), (1, 0), smooth).ravel()
    return pts, nrm, o, cpath, float((trust > 0.5).mean())


def make_tunnels(im, branch, stations, X0):
    """支線の道のり（マス）でトンネルと橋の区間を決める。沢は、線のまわり±30マスの水の色の側が入れかわる所"""
    b = np.array(branch, np.float32)
    seg = np.r_[0, np.cumsum(np.hypot(*np.diff(b, axis=0).T))]
    at = lambda s: [round(float(np.interp(s, seg, b[:, 0])), 1), round(float(np.interp(s, seg, b[:, 1])), 1)]
    def s_of(k):
        v = stations[k]
        return float(seg[int(np.argmin(((b - [v['x'], v['y']]) ** 2).sum(1)))])
    a, z = (s_of(k) for k in TUNNELS['between'])
    f = im.astype(np.int16)
    water = ((f[..., 0] - f[..., 2]) > 25) & (f[..., 0] > 140)
    side = []
    for s in np.arange(a + (z - a) * TUNNELS['cross_range'][0], a + (z - a) * TUNNELS['cross_range'][1], 2.0):
        i = min(int(np.searchsorted(seg, s)), len(b) - 1)
        d = b[i] - b[max(i - 1, 0)]
        d = d / (np.hypot(*d) + 1e-6)
        x, y = at(s)
        hits = [o for o in range(-30, 31) if water[int(y * S + d[0] * o * S) - 1:int(y * S + d[0] * o * S) + 2,
                                                   int((x - d[1] * o - X0) * S) - 1:int((x - d[1] * o - X0) * S) + 2].mean() > 0.5]
        if hits:
            side.append((s, min(hits, key=abs)))
    cross = a + (z - a) * 0.44
    for (s1, o1), (s2, o2) in zip(side, side[1:]):
        if o1 * o2 <= 0 and abs(o1) < 12:
            cross = s1 + (s2 - s1) * (abs(o1) / (abs(o1) + abs(o2) + 1e-6))
            break
    pts = lambda s0, s1: [at(s) for s in np.r_[np.arange(s0, s1, 4), s1]]
    t0, t1 = a + (z - a) * TUNNELS['from'], a + (z - a) * TUNNELS['to']
    op, br = TUNNELS['open'], TUNNELS['bridge']
    n1, n2, n3 = TUNNELS['names']
    tunnels = [{'name': n1, 'line': 'branch', 's': [round(t0, 1), round(cross - op, 1)], 'pts': pts(t0, cross - op)},
               {'name': n3, 'line': 'branch', 's': [round(cross + op, 1), round(t1, 1)], 'pts': pts(cross + op, t1)}]
    bridges = [{'name': n2, 'line': 'branch', 's': [round(cross - br, 1), round(cross + br, 1)], 'pts': pts(cross - br, cross + br)}]
    return tunnels, bridges


def main():
    spec = importlib.util.spec_from_file_location('ms', ROOT / 'tools' / 'map-sketch.py')
    ms = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(ms)
    meta = json.loads((OUT / 'tiles.json').read_text(encoding='utf-8'))
    X0 = meta['world']['x0']
    im = cv2.imread(str(OUT / 'stitched.jpg'))
    cost = score_map(im)
    P = lambda x, y: ((x - X0) * S, y * S)
    U = lambda px, py: (px / S + X0, py / S)

    # ---- 本線（中央〜港）：x はそのまま、y だけ ----
    C, Pp = ms.ST['C'], ms.ST['P']
    guide = [P(C[0] - 20, C[1]), P(Pp[0] + 15, Pp[1])]
    pts, nrm, o, cp, fm = trace(cost, guide, M_MAIN, smooth=18)
    xs = pts[:, 0] / S + X0
    ys = (pts[:, 1] + nrm[:, 1] * o) / S
    # 駅のまわりはまっすぐ（その駅での高さにそろえ、まわりへなめらかにつなぐ）
    main_st = ['C', 'S', 'U', 'M', 'K', 'N', 'P']
    st_y = {}
    for s in main_st:
        sx = ms.ST[s][0]
        st_y[s] = float(np.interp(sx, xs, ys))
    w = np.zeros_like(ys)
    yfix = np.zeros_like(ys)
    for s in main_st:
        sx = ms.ST[s][0]
        a = np.clip(1 - (np.abs(xs - sx) - ST_FLAT) / 25, 0, 1)
        m = a > w
        w[m] = a[m]
        yfix[m] = st_y[s]
    ys = ys * (1 - w) + yfix * w
    main = [[round(float(x), 1), round(float(y), 1)] for x, y in zip(xs[::5], ys[::5])]
    main.append([round(float(xs[-1]), 1), round(float(ys[-1]), 1)])
    stations = {s: {'name': ms.NAME[s], 'x': ms.ST[s][0], 'y': round(st_y[s], 1), 'from': 'main'} for s in main_st}

    # ---- 支線（川辺〜温泉）：本線の川辺の駅から出る ----
    # 分かれ目は川辺の駅の東（ホームのはしの先、JUNC マス）。そこまでは本線と同じ線路を通る
    jx = ms.ST['K'][0] + JUNC
    jy = float(np.interp(jx, xs, ys))
    br_guide = [P(jx, jy), P(jx + 22, jy - 12)] + [P(*p) for p in ms.BRANCH if p[1] < 650]
    bp, bn, bo, bcp, fb = trace(score_path(im), br_guide, M_BR, prior=0.5, smooth=10, trust_at=1.9)
    # 川辺の分かれ目と温泉の終点は下絵の点に固定
    n = len(bo)
    ramp = np.clip(np.arange(n) / 25, 0, 1) * np.clip((n - 1 - np.arange(n)) / 12, 0, 1)
    bo = bo * ramp
    bx = (bp[:, 0] + bn[:, 0] * bo) / S + X0
    by = (bp[:, 1] + bn[:, 1] * bo) / S
    branch = [[float(ms.ST['K'][0]), round(st_y['K'], 1)]] + [[round(float(x), 1), round(float(y), 1)] for x, y in zip(bx[::4], by[::4])]
    branch.append([round(float(bx[-1]), 1), round(float(by[-1]), 1)])
    for s in ['F', 'T', 'O']:
        sx, sy = ms.ST[s]
        i = int(np.argmin((bx - sx) ** 2 + (by - sy) ** 2))
        stations[s] = {'name': ms.NAME[s], 'x': round(float(bx[i]), 1), 'y': round(float(by[i]), 1), 'from': 'branch'}

    tunnels, bridges = make_tunnels(im, branch, stations, X0)
    found_main = float(fm)
    found_br = float(fb)
    (OUT / 'track.json').write_text(json.dumps({
        'note': '絵の線路予定地（砂利と草の帯）をなぞった線路の形（マス、1km=100）。tools/map-track.py が作る。'
                '本線の駅の x はキロ×100 のまま。キロ・ダイヤ・運賃は変えない。段3でゲームが線路をこの形で描く案',
        'src': 'assume', 'found': {'main': round(found_main, 2), 'branch': round(found_br, 2)},
        'main': main, 'branch': branch, 'tunnels': tunnels, 'bridges': bridges, 'stations': stations}, ensure_ascii=False, indent=0), encoding='utf-8')

    # ---- 確認用 ----
    small = cv2.resize(im, (im.shape[1] // 2, im.shape[0] // 2), interpolation=cv2.INTER_AREA)
    Q = lambda p: (int(p[0] - X0), int(p[1]))
    cv2.polylines(small, [np.array([Q(p) for p in [ms.ST['C'], ms.ST['P']]], np.int32)], False, (200, 200, 200), 1, cv2.LINE_AA)
    cv2.polylines(small, [np.array([Q(p) for p in ms.BRANCH], np.int32)], False, (200, 200, 200), 1, cv2.LINE_AA)
    for line in (main, branch):
        cv2.polylines(small, [np.array([Q(p) for p in line], np.int32)], False, (40, 40, 210), 2, cv2.LINE_AA)
    for s, v in stations.items():
        cv2.circle(small, Q((v['x'], v['y'])), 5, (255, 255, 255), -1)
        cv2.circle(small, Q((v['x'], v['y'])), 5, (40, 40, 210), 2)
    cv2.imwrite(str(OUT / 'track-check.jpg'), small, [cv2.IMWRITE_JPEG_QUALITY, 85])
    print('ok main found', round(found_main, 2), 'branch found', round(found_br, 2))
    for s, v in stations.items():
        print(s, v)


if __name__ == '__main__':
    main()
