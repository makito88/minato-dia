#!/usr/bin/env python3
"""みなと川電鉄の配線図（案）：駅ごとの番線・ポイント・車庫を、指令盤（proto/kawabe）と同じ見た目で描く。

使い方:  python3 tools/haisen.py
出力:    docs/map-tiles/haisen.svg・haisen.png・haisen.json

- 新しい地図（docs/line-plan.md）の段3で、ゲームが線路を地図の上に描くときの元にする案。
- 変えないもの：キロ・運賃・乗る人の数・ダイヤ・駅の並び。番線の数は index.html の ST
  （中央4線・港2線・温泉2線・大学前/緑ヶ丘/川辺は待避＝taihi・森下/峠は行き違い＝exch）に合わせた。
- 川辺は proto/kawabe/core.js の線路図（1・2番線＝下り、3・4番線＝上り、①〜⑦）と同じ形。
- 車庫の線の数は、いまのダイヤで夜に泊まる編成の数（中央車庫27編成・港留置線8編成＝内）から。
- 左＝中央（西）、右＝港（東）。支線は左＝川辺、右＝温泉。上の線＝下り（左から右）、下の線＝上り。
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'docs' / 'map-tiles'
CIRC = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳'
PW, PH = 800, 250   # 1枚のパネル

C_BG, C_PANEL, C_TR, C_SIDE, C_OLD, C_PF, C_SW, C_TX, C_DIM, C_OTHER, C_YARD = (
    '#0d1620', '#111e2b', '#5f7184', '#4c5b6b', '#3b4856', '#22374b', '#4fd1ff', '#dbe6f0', '#8aa0b4', '#8a7fb8', '#6d6250')


def P(name, sub, kind, src):
    return {'name': name, 'sub': sub, 'kind': kind, 'src': src, 'tracks': [], 'pf': [], 'sw': [], 'tx': [], 'boxes': []}


def tr(p, pts, role, num=None, style='main'):
    p['tracks'].append({'pts': pts, 'role': role, 'num': num, 'style': style})


def pf(p, x0, x1, y0, y1, txt):
    p['pf'].append({'r': [x0, y0, x1, y1], 'txt': txt})


def sw(p, x, y, txt, dy=-14):
    n = len(p['sw'])
    p['sw'].append({'no': CIRC[n], 'pt': [x, y], 'txt': txt, 'dy': dy})


def tx(p, x, y, t, color=C_DIM, size=11, anchor='start'):
    p['tx'].append({'pt': [x, y], 't': t, 'c': color, 's': size, 'a': anchor})


def box(p, x0, y0, x1, y1, txt, color=C_YARD):
    p['boxes'].append({'r': [x0, y0, x1, y1], 'txt': txt, 'c': color})


PANELS = []

# ---------- 中央（みなと川電鉄1〜5番線・西に引上線と車庫への線・県央本線は独自のホームの仮の1・2番線） ----------
c = P('中央', 'みなと川電鉄の1〜5番線。西に引上線、1〜4番線のどれからでも車庫へ。県央本線は独自のホーム（仮の1・2番線）で、1〜4番線へ乗りかえ', 'terminal', 'ST.C plats 4（内）')
tr(c, [(150, 40), (300, 40), (580, 40), (620, 80)], '下りの始発・到着（車庫へ直結）', 1)
tr(c, [(110, 80), (800, 80)], '下りの始発（本線）', 2)
tr(c, [(110, 130), (800, 130)], '上りの到着（本線）', 3)
tr(c, [(150, 170), (300, 170), (580, 170), (620, 130)], '上りの到着', 4)
tr(c, [(300, 40), (150, 40), (100, 14), (0, 14)], '入出庫線（中央車庫へ）', None, 'side')
for (a, b) in [((290, 170), (250, 130)), ((250, 130), (210, 80)), ((210, 80), (170, 40))]:
    tr(c, [a, b], 'はしご（西）', None, 'side')
tr(c, [(660, 80), (720, 130)], 'シーサスクロッシング', None, 'side')
tr(c, [(660, 130), (720, 80)], 'シーサスクロッシング', None, 'side')
tr(c, [(0, 195), (800, 195)], 'みなと川電鉄5番線', 5, 'main')
tr(c, [(0, 215), (800, 215)], '県央本線（他社線・仮の1番線）', '仮1', 'other')
tr(c, [(0, 235), (800, 235)], '県央本線（他社線・仮の2番線）', '仮2', 'other')
pf(c, 320, 560, 50, 70, '1・2番線')
pf(c, 320, 560, 140, 160, '3・4番線')
pf(c, 340, 540, 186, 202, '5番線')
pf(c, 340, 540, 208, 242, '仮の1・2番線（県央本線）')
sw(c, 600, 80, '1番線と2番線の合流')
sw(c, 600, 130, '4番線と3番線の合流', 22)
sw(c, 690, 105, 'シーサス：どの番線からも上下どちらへも', -16)
sw(c, 210, 80, 'はしご：4→3→2→1番線→車庫', -14)
tx(c, 110, 98, '引上線（折り返し）', C_DIM, 10)
tx(c, 4, 30, '← 中央車庫（西1〜2km・北側）', C_DIM, 10)
tx(c, 796, 72, '桜町方面 →', C_DIM, 10, 'end')
tx(c, 796, 197, '県央本線：西＝空港駅、東で本線をこえて北へ', C_OTHER, 10, 'end')
tx(c, 330, 248, '地下の通路で 1〜4番線 ⇄ 仮の1・2番線', C_OTHER, 10)
PANELS.append(c)

# ---------- 中央車庫 ----------
d = P('中央車庫', '留置線14本（2編成ずつ）・検査庫3線・洗車線・車輪を削る線。夜は27編成が泊まる', 'depot', '泊まる編成27＝内（いまのダイヤ）')
tr(d, [(800, 214), (640, 214)], '入出庫線（下り）', None, 'main')
tr(d, [(800, 232), (640, 232)], '入出庫線（上り）', None, 'main')
tr(d, [(640, 214), (600, 190)], 'はしご', None, 'side')
tr(d, [(640, 232), (600, 214)], 'はしご', None, 'side')
tr(d, [(600, 190), (560, 20)], 'はしご（留置線へ）', None, 'side')
for i in range(14):
    y = 20 + i * 9.2
    x = 560 - (190 - y) * 0 if False else 560 - (y - 20) * 40 / 170
    tr(d, [(70, y), (600 - (y - 20) * 40 / 170 - 0, y)], f'留置線{i+1}', None, 'yard')
tx(d, 74, 15, '留置線 1〜14（1本に8両×2編成）', C_TX, 10)
tr(d, [(600, 214), (180, 214)], '検査庫の線', None, 'side')
tr(d, [(610, 205), (560, 200), (180, 200)], '検査庫の線', None, 'side')
tr(d, [(620, 223), (560, 228), (180, 228)], '検査庫の線', None, 'side')
box(d, 200, 194, 360, 234, '検査庫（3線・屋根）')
tr(d, [(640, 232), (600, 244), (420, 244)], '洗車線', None, 'side')
box(d, 470, 238, 520, 250, '洗車機', '#3d6f8a')
tr(d, [(600, 190), (560, 185), (440, 185)], '車輪を削る線', None, 'side')
box(d, 440, 180, 500, 191, '車輪転削', '#5a4f7a')
sw(d, 640, 214, '入出庫の分かれ道', -12)
sw(d, 600, 190, 'はしご（14本へ）', -12)
tx(d, 796, 206, '中央駅 1番線へ →', C_DIM, 10, 'end')
PANELS.append(d)

# ---------- 桜町（相対式2面2線） ----------
s = P('桜町', '相対式2面2線（いちばん小さな形）。非常用の渡り線が1か所', 'simple', 'ST.S（内）')
tr(s, [(0, 90), (800, 90)], '下り', 1)
tr(s, [(0, 150), (800, 150)], '上り', 2)
tr(s, [(560, 150), (620, 90)], '渡り線（非常・工事のとき）', None, 'side')
pf(s, 300, 500, 62, 82, '1番線（下り）・城跡口')
pf(s, 300, 500, 158, 178, '2番線（上り）・商店街口')
sw(s, 560, 150, '渡り線（上り→下り）', 22)
sw(s, 620, 90, '渡り線', -14)
PANELS.append(s)

# ---------- 大学前（島式2面4線＋東に臨時のシーサス） ----------
u = P('大学前', '島式2面4線（外側が待避線）。東に臨時用のシーサス（入試・学園祭の日）', 'taihi', 'ST.U taihi（内）')
tr(u, [(0, 95), (180, 95), (230, 55), (560, 55), (610, 95)], '下り待避', 1)
tr(u, [(0, 95), (800, 95)], '下り本線', 2)
tr(u, [(0, 155), (800, 155)], '上り本線', 3)
tr(u, [(800, 155), (610, 155), (560, 195), (230, 195), (180, 155)], '上り待避', 4)
tr(u, [(660, 95), (720, 155)], 'シーサス', None, 'side')
tr(u, [(660, 155), (720, 95)], 'シーサス', None, 'side')
pf(u, 250, 540, 64, 86, '1・2番線（北門口）')
pf(u, 250, 540, 164, 186, '3・4番線（南口）')
sw(u, 180, 95, '1番線へ')
sw(u, 610, 95, '1番線から')
sw(u, 610, 155, '4番線へ', 22)
sw(u, 180, 155, '4番線から', 22)
sw(u, 690, 125, '臨時のシーサス', -16)
PANELS.append(u)

# ---------- 緑ヶ丘（島式2面4線・丘の切り通し・保線の側線） ----------
m = P('緑ヶ丘', '島式2面4線（外側が待避線）。丘の切り通しの中の駅。西に保線車両の側線', 'taihi', 'ST.M taihi（内）')
tr(m, [(0, 95), (230, 95), (280, 55), (560, 55), (610, 95)], '下り待避', 1)
tr(m, [(0, 95), (800, 95)], '下り本線', 2)
tr(m, [(0, 155), (800, 155)], '上り本線', 3)
tr(m, [(800, 155), (610, 155), (560, 195), (280, 195), (230, 155)], '上り待避', 4)
tr(m, [(170, 155), (120, 200), (20, 200)], '保線車両の側線', None, 'side')
pf(m, 300, 540, 64, 86, '1・2番線（団地口）')
pf(m, 300, 540, 164, 186, '3・4番線')
sw(m, 230, 95, '1番線へ')
sw(m, 610, 95, '1番線から')
sw(m, 610, 155, '4番線へ', 22)
sw(m, 230, 155, '4番線から', 22)
sw(m, 170, 155, '保線の側線へ', 22)
tx(m, 30, 220, '保線車両（夜だけ動く）', C_DIM, 10)
tx(m, 300, 30, '駅の北は丘の上の団地へのエスカレーター', C_DIM, 10)
PANELS.append(m)

# ---------- 川辺（proto/kawabe と同じ） ----------
k = P('川辺', '島式2面4線＋温泉支線（単線）。指令盤（proto/kawabe）と同じ形・同じ番号', 'junction', 'proto/kawabe/core.js（内）')
tr(k, [(0, 90), (195, 90), (241, 53), (563, 53), (602, 90)], '下り待避・温泉支線へ', 1)
tr(k, [(563, 53), (623, 20), (800, 20)], '温泉支線（単線）', None, 'main')
tr(k, [(0, 90), (800, 90)], '下り本線', 2)
tr(k, [(0, 149), (800, 149)], '上り本線', 3)
tr(k, [(800, 149), (602, 149), (559, 186), (237, 186), (195, 149)], '上り待避', 4)
tr(k, [(740, 20), (683, 149)], '支線から上りへ（平面交差）', None, 'side')
pf(k, 250, 540, 62, 82, '1・2番線（下り・温泉行）')
pf(k, 250, 540, 157, 177, '3・4番線（上り・中央行）')
sw(k, 195, 90, '1番線へ（ななめ）')
sw(k, 195, 149, '4番線から（ななめ）', 22)
sw(k, 563, 53, '1番線から本線か温泉支線へ', -10)
sw(k, 602, 90, '1番線から本線へ', 22)
sw(k, 602, 149, '3番線か4番線へ', 22)
sw(k, 740, 20, '温泉支線から上りの線路へ', 18)
sw(k, 683, 149, '合流点', 22)
tx(k, 700, 120, '平面交差', C_DIM, 10)
tx(k, 796, 14, '森下・温泉方面（単線）→', C_DIM, 10, 'end')
PANELS.append(k)

# ---------- 新田（相対式2面2線・JAの側線） ----------
n = P('新田', '相対式2面2線。上りホームは長め（朝の高校生）。北にJAの米の積み出し線の跡', 'simple', 'ST.N（内）')
tr(n, [(0, 95), (800, 95)], '下り', 1)
tr(n, [(0, 155), (800, 155)], '上り', 2)
tr(n, [(520, 95), (580, 50), (740, 50)], 'JAの側線（いまは保線車の置き場）', None, 'old')
tr(n, [(160, 155), (220, 95)], '渡り線（非常）', None, 'side')
pf(n, 320, 500, 66, 86, '1番線（下り）・高校口')
pf(n, 260, 560, 164, 184, '2番線（上り）・町役場口')
sw(n, 520, 95, 'JAの側線へ')
sw(n, 160, 155, '渡り線', 22)
sw(n, 220, 95, '渡り線')
tx(n, 600, 42, '米の積み出しホームの跡', C_DIM, 10)
PANELS.append(n)

# ---------- 港（頭端式1面2線・留置線4本・昔の貨物線） ----------
pz = P('港', '頭端式（行き止まり）1面2線。手前の北に港留置線4本。南に赤レンガ倉庫への昔の貨物線（遊歩道）', 'terminal', 'ST.P plats 2・港留置線8編成（内）')
tr(pz, [(0, 100), (760, 100)], '下りの到着', 1)
tr(pz, [(0, 160), (760, 160)], '上りの始発', 2)
tr(pz, [(560, 100), (620, 160)], 'シーサス', None, 'side')
tr(pz, [(560, 160), (620, 100)], 'シーサス', None, 'side')
tr(pz, [(110, 100), (160, 70)], '留置線へ', None, 'side')
for i, y in enumerate([70, 52, 34, 16]):
    tr(pz, [(160 + i * 12, 70 if i == 0 else y + 6), (180 + i * 12, y), (470, y)], f'留置線{i+1}', None, 'yard')
tr(pz, [(160, 70), (210, 16)], 'はしご', None, 'side')
tr(pz, [(50, 160), (100, 100)], '留置線への渡り線（2番線から出て、もどって入る）', None, 'side')
tr(pz, [(260, 160), (320, 210), (760, 222)], '昔の貨物線（いまは遊歩道）', None, 'old')
pf(pz, 640, 760, 112, 148, '1・2番線')
for xx, yy in [(760, 100), (760, 160)]:
    pz['boxes'].append({'r': [xx, yy - 7, xx + 6, yy + 7], 'txt': '', 'c': '#c96b4e'})
sw(pz, 590, 130, 'シーサス：1・2番線のどちらにも', -16)
sw(pz, 110, 100, '留置線へ', -12)
sw(pz, 160, 70, 'はしご（4本へ）', -10)
sw(pz, 50, 160, '2番線から留置線への渡り線', 22)
tx(pz, 480, 40, '港留置線（4本・8両×2編成ずつ）', C_TX, 10)
tx(pz, 470, 236, '赤レンガ倉庫・岸壁へ（遊歩道）', C_DIM, 10)
PANELS.append(pz)

# ---------- 森下（単線の行き違い・島式1面2線） ----------
f = P('森下', '単線の行き違い駅（島式1面2線）。製材所への専用線の跡', 'exch', 'ST.F exch（内）')
tr(f, [(0, 120), (180, 120), (240, 85), (560, 85), (620, 120), (800, 120)], '温泉行', 1)
tr(f, [(180, 120), (240, 155), (560, 155), (620, 120)], '川辺行', 2)
tr(f, [(660, 120), (720, 175), (800, 175)], '製材所への専用線の跡', None, 'old')
pf(f, 260, 540, 98, 142, '1・2番線')
sw(f, 180, 120, 'スプリングポイント（いつも左へ）')
sw(f, 620, 120, 'スプリングポイント')
sw(f, 660, 120, '専用線の跡（ふだんは使わない）', 22)
tx(f, 4, 112, '← 川辺', C_DIM, 10)
tx(f, 796, 112, '峠・温泉 →', C_DIM, 10, 'end')
PANELS.append(f)

# ---------- 峠（単線の行き違い・相対式2面2線・安全側線） ----------
t = P('峠', '単線の行き違い駅（相対式2面2線）。山の駅なので安全側線つき。西に峠の鉄橋', 'exch', 'ST.T exch（内）')
tr(t, [(0, 125), (220, 125), (270, 85), (560, 85), (610, 125), (800, 125)], '温泉行', 1)
tr(t, [(220, 125), (270, 165), (560, 165), (610, 125)], '川辺行', 2)
tr(t, [(560, 85), (650, 60), (720, 60)], '安全側線（止まりきれなかったとき）', None, 'side')
tr(t, [(270, 165), (180, 195), (120, 195)], '安全側線', None, 'side')
t['boxes'].append({'r': [30, 113, 150, 137], 'txt': '峠の鉄橋', 'c': '#8a3a2a'})
pf(t, 290, 540, 55, 75, '1番線（温泉行）・展望台口')
pf(t, 290, 540, 175, 195, '2番線（川辺行）・茶屋口')
sw(t, 220, 125, '1番線か2番線へ')
sw(t, 610, 125, '1番線か2番線から')
sw(t, 560, 85, '安全側線')
sw(t, 270, 165, '安全側線', 22)
PANELS.append(t)

# ---------- 温泉（頭端式1面2線・留置線・転車台） ----------
o = P('温泉', '頭端式1面2線。手前に臨時列車用の留置線。奥に蒸気機関車の時代の転車台（展示）', 'terminal', 'ST.O plats 2（内）')
tr(o, [(0, 120), (300, 120), (350, 90), (700, 90)], '1番線', 1)
tr(o, [(300, 120), (350, 150), (700, 150)], '2番線', 2)
tr(o, [(200, 120), (250, 200), (560, 200)], '留置線（臨時列車用）', None, 'yard')
tr(o, [(560, 200), (660, 210)], '転車台への線（展示）', None, 'old')
pf(o, 430, 700, 103, 137, '1・2番線（湯けむり口）')
for yy in (90, 150):
    o['boxes'].append({'r': [700, yy - 7, 706, yy + 7], 'txt': '', 'c': '#c96b4e'})
sw(o, 200, 120, '留置線へ')
sw(o, 300, 120, '1番線か2番線へ')
tx(o, 4, 112, '← 峠・川辺', C_DIM, 10)
o['boxes'].append({'r': [652, 194, 700, 226], 'txt': '', 'c': '#5a4f7a'})
tx(o, 676, 244, '転車台（展示）', C_DIM, 10, 'middle')
tx(o, 300, 194, '留置線（臨時列車用）', C_DIM, 10)
PANELS.append(o)

COLS = 2
GAP = 16
HEAD = 92


def esc(s):
    return s.replace('&', '&amp;').replace('<', '&lt;')


def panel_svg(p, ox, oy):
    g = [f'<g transform="translate({ox},{oy})">',
         f'<rect x="0" y="0" width="{PW+40}" height="{PH+70}" rx="10" fill="{C_PANEL}" stroke="#22364a"/>',
         f'<text x="18" y="30" font-size="20" font-weight="bold" fill="{C_TX}">{esc(p["name"])}</text>',
         f'<text x="{18+len(p["name"])*21+12}" y="29" font-size="11.5" fill="{C_DIM}">{esc(p["sub"])}</text>',
         f'<g transform="translate(20,52)">']
    for b in p['boxes']:
        x0, y0, x1, y1 = b['r']
        g.append(f'<rect x="{x0}" y="{y0}" width="{x1-x0}" height="{y1-y0}" fill="{b["c"]}" opacity=".55" rx="2"/>')
        if b['txt']:
            g.append(f'<text x="{(x0+x1)/2}" y="{(y0+y1)/2+4}" font-size="10" fill="{C_TX}" text-anchor="middle">{esc(b["txt"])}</text>')
    for q in p['pf']:
        x0, y0, x1, y1 = q['r']
        g.append(f'<rect x="{x0}" y="{y0}" width="{x1-x0}" height="{y1-y0}" fill="{C_PF}" stroke="#3a5874" rx="3"/>')
        g.append(f'<text x="{(x0+x1)/2}" y="{(y0+y1)/2+4}" font-size="10.5" fill="{C_TX}" text-anchor="middle">{esc(q["txt"])}</text>')
    for tt in p['tracks']:
        col, w, dash = {'main': (C_TR, 4, ''), 'side': (C_SIDE, 3, ''), 'yard': (C_YARD, 2.4, ''),
                        'old': (C_OLD, 2.4, 'stroke-dasharray="6 5"'), 'other': (C_OTHER, 3, 'stroke-dasharray="10 5"')}[tt['style']]
        d = 'M' + ' L'.join(f'{x},{y}' for x, y in tt['pts'])
        g.append(f'<path d="{d}" fill="none" stroke="{col}" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round" {dash}/>')
    for tt in p['tracks']:
        if tt['num']:
            x, y = tt['pts'][0] if tt['style'] != 'other' else (0, tt['pts'][0][1])
            lx = 6 if tt['style'] == 'other' else max(x, 0) + 4
            if p['kind'] in ('taihi', 'junction') and tt['num'] in (1, 4):
                lx, y = 300, tt['pts'][3][1] if tt['num'] == 1 else tt['pts'][2][1] + 19
            if p['kind'] == 'exch':
                lx, y = 300, tt['pts'][3][1] if tt['num'] == 1 else tt['pts'][1][1]
            if p['name'] == '温泉':
                lx, y = 360, tt['pts'][-1][1]
            g.append(f'<text x="{lx}" y="{y-5}" font-size="10" font-weight="bold" fill="#ffd36b">{tt["num"]}番線</text>')
    for q in p['sw']:
        x, y = q['pt']
        g.append(f'<circle cx="{x}" cy="{y}" r="3.2" fill="{C_SW}"/>')
        g.append(f'<text x="{x}" y="{y+q["dy"]}" font-size="14" fill="{C_SW}" text-anchor="middle" font-weight="bold">{q["no"]}</text>')
    for q in p['tx']:
        x, y = q['pt']
        g.append(f'<text x="{x}" y="{y}" font-size="{q["s"]}" fill="{q["c"]}" text-anchor="{q["a"]}">{esc(q["t"])}</text>')
    g.append('</g>')
    # ポイントの説明（下に小さく）
    lines = '　'.join(f'{q["no"]} {q["txt"]}' for q in p['sw'])
    g.append(f'<text x="18" y="{PH+60}" font-size="10.5" fill="{C_DIM}">{esc(lines)}</text>')
    g.append('</g>')
    return ''.join(g)


def build():
    rows = (len(PANELS) + COLS - 1) // COLS
    W = COLS * (PW + 40) + (COLS + 1) * GAP
    H = HEAD + rows * (PH + 70 + GAP) + 40
    s = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" font-family="Noto Sans CJK JP, sans-serif">',
         f'<rect width="{W}" height="{H}" fill="{C_BG}"/>',
         f'<text x="{GAP+4}" y="38" font-size="26" font-weight="bold" fill="{C_TX}">みなと川電鉄 配線図（案）</text>',
         f'<text x="{GAP+4}" y="64" font-size="12.5" fill="{C_DIM}">左＝中央（西）・右＝港（東）。支線は左＝川辺・右＝温泉。上の線＝下り（左→右）、下の線＝上り（右→左）。'
         f'形は見やすく直した図で、長さは縮尺どおりではありません。キロ・ダイヤ・番線の数はゲームのまま。位置と形は架空・仮。</text>',
         f'<g font-size="11.5" fill="{C_DIM}"><line x1="{GAP+6}" x2="{GAP+36}" y1="80" y2="80" stroke="{C_TR}" stroke-width="4"/><text x="{GAP+42}" y="84">本線・番線</text>'
         f'<line x1="{GAP+130}" x2="{GAP+160}" y1="80" y2="80" stroke="{C_SIDE}" stroke-width="3"/><text x="{GAP+166}" y="84">渡り線・側線</text>'
         f'<line x1="{GAP+270}" x2="{GAP+300}" y1="80" y2="80" stroke="{C_YARD}" stroke-width="2.4"/><text x="{GAP+306}" y="84">留置線</text>'
         f'<line x1="{GAP+380}" x2="{GAP+410}" y1="80" y2="80" stroke="{C_OLD}" stroke-width="2.4" stroke-dasharray="6 5"/><text x="{GAP+416}" y="84">昔の線の跡（使わない）</text>'
         f'<line x1="{GAP+560}" x2="{GAP+590}" y1="80" y2="80" stroke="{C_OTHER}" stroke-width="3" stroke-dasharray="10 5"/><text x="{GAP+596}" y="84">他社線（県央本線・架空）</text>'
         f'<circle cx="{GAP+766}" cy="80" r="3.2" fill="{C_SW}"/><text x="{GAP+776}" y="84" fill="{C_SW}">①＝ポイント（分かれ道）</text>'
         f'<rect x="{GAP+940}" y="73" width="30" height="14" fill="{C_PF}" stroke="#3a5874" rx="3"/><text x="{GAP+976}" y="84">ホーム</text></g>']
    for i, p in enumerate(PANELS):
        r, col = divmod(i, COLS)
        s.append(panel_svg(p, GAP + col * (PW + 40 + GAP), HEAD + r * (PH + 70 + GAP)))
    s.append('</svg>')
    return ''.join(s), W, H


def main():
    svg, W, H = build()
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / 'haisen.svg').write_text(svg, encoding='utf-8')
    data = {'note': 'みなと川電鉄の配線図（案・架空）。座標はパネルの中の見やすく直した図（縮尺なし）。tools/haisen.py が作る。'
                    'キロ・ダイヤ・番線の数はゲーム（index.html の ST）のまま。川辺は proto/kawabe と同じ形。',
            'stations': [{'name': p['name'], 'kind': p['kind'], 'about': p['sub'], 'src': p['src'],
                          'tracks': [{'num': t['num'], 'role': t['role'], 'style': t['style']} for t in p['tracks'] if t['num']],
                          'switches': [{'no': q['no'], 'what': q['txt']} for q in p['sw']]} for p in PANELS]}
    (OUT / 'haisen.json').write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding='utf-8')
    from playwright.sync_api import sync_playwright
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        pg = b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=2)
        pg.set_content('<html><body style="margin:0">' + svg + '</body></html>')
        pg.screenshot(path=str(OUT / 'haisen.png'), clip={'x': 0, 'y': 0, 'width': W, 'height': H})
        b.close()
    print('ok', len(PANELS), 'panels', W, H)


if __name__ == '__main__':
    main()
