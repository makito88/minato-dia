#!/usr/bin/env python3
"""横に長い新しい地図の「下絵」とタイルの切り抜き・ChatGPT への指示文を作る（docs/line-plan.md の段1）。

使い方:  python3 tools/map-sketch.py
出力:    docs/map-tiles/ の sketch.svg・overview*.png・tiles/*.png・tiles.json・prompts.md・style-ref.png

座標（マス）: 1km = 100マス。x = 中央駅からのキロ × 100（西がマイナス）。y = 北の端が 0、本線は y=700。
全体: x -700〜2400（31km）× y 0〜1000（10km）。絵は 1マス=2px（6200×2000px）。
ここで決めた位置はすべて架空・仮（assume）。キロ・運賃・乗る人の数・ダイヤは読むだけで変えない。
"""
import json, re, os, sys, math
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'docs' / 'map-tiles'
X0, X1, Y0, Y1 = -700, 2400, 0, 1000
MAINY = 700
PX = 2  # 1マスあたりの px

# ---- 駅（index.html の ST の km・bkm から。横の位置は km×100、支線は今の地図の向きを保って広げた） ----
KM = {'C': 0, 'S': 3.2, 'U': 6.4, 'M': 9.6, 'K': 13.2, 'N': 17.3, 'P': 21.5}
NAME = {'C': '中央', 'S': '桜町', 'U': '大学前', 'M': '緑ヶ丘', 'K': '川辺', 'N': '新田', 'P': '港',
        'F': '森下', 'T': '峠', 'O': '温泉'}
ST = {k: (round(v * 100), MAINY) for k, v in KM.items()}
# 支線：今の地図（36.8マス/km）での K からのずれを 100マス/km に直した（F +1.25,-2.17km／T +2.72,-4.02／O +5.87,-5.87）
ST['F'] = (1320 + 125, MAINY - 217)
ST['T'] = (1320 + 272, MAINY - 402)
ST['O'] = (1320 + 587, MAINY - 587)


def pts(p):
    return ' '.join(f'{x},{y}' for x, y in p)


def smooth(p, closed=False):
    """点の列を、なめらかな曲線（Catmull-Rom→ベジェ）の path にする"""
    n = len(p)
    if n < 3:
        return 'M' + ' L'.join(f'{x},{y}' for x, y in p)
    d = f'M{p[0][0]},{p[0][1]}'
    for i in range(n if closed else n - 1):
        if closed:
            a, b, c, e = p[i - 1], p[i], p[(i + 1) % n], p[(i + 2) % n]
        else:
            a, b, c, e = p[max(i - 1, 0)], p[i], p[i + 1], p[min(i + 2, n - 1)]
        c1 = (b[0] + (c[0] - a[0]) / 6, b[1] + (c[1] - a[1]) / 6)
        c2 = (c[0] - (e[0] - b[0]) / 6, c[1] - (e[1] - b[1]) / 6)
        d += f' C{c1[0]:.1f},{c1[1]:.1f} {c2[0]:.1f},{c2[1]:.1f} {c[0]},{c[1]}'
    return d + (' Z' if closed else '')


# ---- 色（下絵の凡例） ----
COL = {
    'land': '#eef0d6', 'paddy': '#d6e79c', 'terrace': '#c4dc8a', 'forest': '#79a464', 'mount': '#5f8f52',
    'hill': '#b4cf8c', 'park': '#9fd28a', 'sea': '#5d9fd8', 'river': '#79b8e6', 'bank': '#cfe5b4',
    'res': '#f1e1c4', 'resd': '#e8cba0', 'danchi': '#e3b98c', 'biz': '#c9b6dc', 'shop': '#f0a9a0',
    'ind': '#c3c3c3', 'ware': '#aeb4bf', 'school': '#f6c89c', 'univ': '#f4b47c', 'civic': '#b9d3ef',
    'air': '#dedede', 'runway': '#7d7d7d', 'park2': '#bfe3a8', 'onsen': '#e7b6c8', 'port': '#b8c6cf',
    'road': '#ffffff', 'roadedge': '#9a9184', 'rail': '#5a5048', 'other': '#6d6d8a', 'yard': '#8f8478',
}

layers = []          # (layer名, svg文字列)
labels = []          # 文字（ラベル版だけ）


def add(layer, s):
    layers.append((layer, s))


def poly(layer, p, fill, smooth_=True, extra=''):
    d = smooth(p, True) if smooth_ else 'M' + ' L'.join(f'{x},{y}' for x, y in p) + ' Z'
    add(layer, f'<path d="{d}" fill="{fill}" {extra}/>')


def rect(layer, x, y, w, h, fill, extra=''):
    add(layer, f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{fill}" {extra}/>')


def line(layer, p, color, w, extra='', smooth_=True):
    d = smooth(p) if smooth_ else 'M' + ' L'.join(f'{x},{y}' for x, y in p)
    add(layer, f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round" {extra}/>')


def label(x, y, t, size=9, color='#222', weight='normal'):
    labels.append(f'<text x="{x}" y="{y}" font-size="{size}" fill="{color}" font-weight="{weight}" text-anchor="middle" '
                  f'paint-order="stroke" stroke="#ffffffcc" stroke-width="{size/4:.1f}">{t}</text>')


# ======================= 地形 =======================
# 田んぼ
for p in [
    [(150, 330), (420, 300), (720, 300), (820, 420), (700, 520), (480, 545), (230, 545), (140, 450)],      # 桜町・大学前の北
    [(-700, 330), (-330, 300), (-130, 380), (-160, 560), (-340, 600), (-700, 520)],                       # 空港・中央の北西
    [(-700, 600), (-640, 640), (-700, 700)],
    [(-420, 880), (-250, 860), (-180, 930), (-240, 1000), (-420, 1000)],                                   # 空港の東の田んぼ
    [(430, 840), (800, 825), (1150, 830), (1250, 1000), (430, 1000)],                                     # 大学前・緑ヶ丘の南
    [(1570, 600), (1700, 585), (1880, 590), (1930, 660), (1800, 672), (1600, 675)],                       # 新田の北
    [(1500, 730), (1700, 728), (1960, 728), (1940, 800), (1800, 845), (1560, 870), (1470, 820)],          # 新田の南
]:
    poly('paddy', p, COL['paddy'], extra='class="paddy"')
# 棚田（新田の北の斜面）
poly('paddy', [(1600, 545), (1700, 520), (1800, 530), (1880, 560), (1820, 590), (1650, 590)], COL['terrace'], extra='class="terrace"')

# 北の低い丘と森（川の西）
poly('hill', [(560, 0), (1180, 0), (1200, 180), (1100, 270), (900, 300), (760, 250), (620, 150)], COL['hill'])
poly('forest', [(700, 0), (1150, 0), (1160, 120), (1050, 200), (880, 210), (760, 130)], COL['forest'])
poly('hill', [(-700, 0), (-300, 0), (-150, 120), (-350, 200), (-700, 230)], COL['hill'])
poly('forest', [(-700, 0), (-420, 0), (-380, 90), (-560, 140), (-700, 150)], COL['forest'])
# 緑ヶ丘の丘
poly('hill', [(860, 560), (940, 505), (1060, 500), (1130, 560), (1120, 660), (1000, 690), (880, 670)], COL['hill'])

# 山（川の東・北東。今の地図と同じ並び）
MOUNT = [(1285, 0), (2400, 0), (2400, 400), (2330, 470), (2290, 560), (2230, 620), (2120, 640), (2020, 610),
         (1930, 560), (1830, 520), (1720, 500), (1620, 520), (1560, 560), (1500, 590), (1420, 600), (1350, 560),
         (1310, 450), (1300, 300), (1290, 150)]
poly('mount', MOUNT, COL['mount'])
# 峰の線（立体感の目安）
for ridge in [[(1350, 120), (1450, 60), (1560, 20)], [(1420, 300), (1500, 200), (1640, 120), (1760, 60)],
              [(1680, 420), (1800, 330), (1950, 260), (2100, 200), (2250, 150)], [(2000, 480), (2150, 400), (2300, 330)],
              [(1990, 60), (2120, 30), (2260, 60), (2380, 40)]]:
    line('mount', ridge, '#3f6c3a', 3, 'stroke-dasharray="1 6" opacity=".8"')
# 温泉の谷（ひらけた所）
poly('mount', [(1830, 60), (1900, 40), (1990, 70), (2010, 150), (1950, 200), (1860, 190), (1810, 130)], COL['forest'])
# 森下のまわりの杉林
poly('mount', [(1380, 400), (1470, 380), (1560, 430), (1540, 560), (1440, 580), (1370, 520)], '#567f45')
# 森下の集落のひらけた所
poly('mount', [(1410, 450), (1480, 440), (1500, 500), (1450, 530), (1400, 510)], COL['land'])

# 海（南東の湾。川の河口から東へ、港で北へ）
SEA = [(1370, 1000), (1410, 940), (1500, 895), (1650, 882), (1800, 872), (1930, 845), (2010, 815), (2120, 805),
       (2230, 795), (2262, 745), (2272, 660), (2300, 565), (2350, 475), (2400, 430), (2400, 1000)]
poly('water', SEA, COL['sea'])
# 南西の入り江（空港の南の進入路を海の上に）
poly('water', [(-700, 950), (-600, 965), (-480, 985), (-380, 1000), (-700, 1000)], COL['sea'], smooth_=False)

# 川（みなと川）：北の端から南へ、本線を川辺の西で横切り、南東の海へ
RIVER = [(1185, 0), (1225, 140), (1205, 300), (1235, 450), (1255, 600), (1262, 700), (1285, 800), (1330, 900), (1395, 975)]
line('water', RIVER, COL['bank'], 46)           # 河川敷（川辺の公園・祭りの会場）
line('water', RIVER, COL['river'], 16)
# 森下の沢（峠の大滝から、鉄橋の下を通って川へ）
SAWA = [(1560, 200), (1555, 245), (1530, 320), (1505, 400), (1470, 470), (1400, 550), (1320, 600), (1258, 620)]
line('water', SAWA, COL['river'], 5)
# 新田の小川
line('water', [(1680, 560), (1700, 640), (1690, 760), (1720, 870)], COL['river'], 3)
# 温泉の川
line('water', [(2050, 0), (1980, 80), (1920, 160), (1850, 220), (1760, 300), (1700, 380), (1650, 470), (1640, 560), (1600, 700), (1580, 880)], COL['river'], 4)

# ======================= 町 =======================
# 中央：ビル街（高さは20階くらいまで）と、そのまわりの住宅
poly('town', [(-330, 470), (120, 430), (400, 520), (460, 760), (380, 900), (40, 960), (-300, 900), (-380, 700)], COL['resd'])
poly('town', [(-140, 600), (60, 575), (190, 620), (210, 760), (130, 840), (-80, 840), (-170, 760)], COL['biz'])
rect('town', -50, 618, 45, 32, COL['civic'])                           # 県庁・市役所
rect('town', 90, 610, 34, 26, COL['civic'])                            # 県立図書館・美術館
rect('town', 20, 722, 120, 9, COL['shop'])                             # 中央通りアーケード
rect('town', -35, 712, 55, 24, '#d9d1c4')                              # 駅前のバスターミナル（大きい）
rect('town', -80, 712, 38, 24, '#bdb3a6')                              # 立体駐車場（6,500台・何棟か）
rect('town', 45, 640, 30, 22, '#bdb3a6')
rect('town', -30, 680, 70, 13, COL['shop'])                            # 駅ビル（ステーションモール）
# 桜町：城下町・古い住宅
poly('town', [(170, 580), (330, 560), (470, 600), (500, 760), (420, 840), (220, 840), (150, 740)], COL['res'])
add('town', f'<rect x="248" y="598" width="74" height="62" fill="{COL["river"]}"/>')    # 城のお堀
rect('town', 256, 606, 58, 46, COL['park'])                            # 桜町城跡公園
rect('town', 350, 612, 50, 40, '#d7c7a4')                              # 寺町通り
rect('town', 310, 710, 70, 7, COL['shop'])                             # 桜町商店街
# 大学前：駅のすぐ北にキャンパス・病院、学生のアパート
poly('town', [(470, 600), (820, 560), (870, 780), (520, 800)], COL['resd'])
poly('town', [(585, 520), (735, 515), (745, 650), (595, 662)], COL['univ'])             # 国立みなと川大学
rect('town', 752, 560, 48, 48, COL['civic'])                           # 大学附属病院
rect('town', 640, 662, 10, 30, COL['shop'])                            # 学生街「北門通り」（駅→北門）
rect('town', 690, 720, 40, 30, COL['school'])                          # 市民体育館
# 緑ヶ丘：丘の上の団地と戸建て
poly('town', [(820, 640), (900, 560), (1150, 600), (1190, 780), (1050, 810), (840, 790)], COL['res'])
poly('town', [(900, 525), (1060, 515), (1100, 600), (1040, 655), (920, 650)], COL['danchi'])   # 緑ヶ丘団地（42棟）
rect('town', 960, 585, 34, 30, COL['park'])                            # 緑ヶ丘中央公園
add('town', f'<circle cx="1005" cy="520" r="6" fill="#8fa3b8"/>')      # 丘の上の給水塔
rect('town', 975, 660, 40, 20, COL['shop'])                            # ニュータウンセンター
# 川辺：川のそばのモール、市役所
poly('town', [(1300, 600), (1430, 610), (1520, 680), (1500, 790), (1310, 800)], COL['res'])
rect('town', 1312, 718, 58, 30, COL['shop'])                           # 川辺ショッピングパーク
rect('town', 1312, 750, 80, 34, '#d5d0c6')                             # 平らな駐車場（2,400台）
rect('town', 1360, 640, 30, 22, COL['civic'])                          # 緑野市役所
rect('town', 1420, 625, 40, 34, COL['school'])                         # 川辺高校
# 新田：小さな駅前と高校・農業大学校
poly('town', [(1690, 660), (1790, 662), (1800, 745), (1700, 750)], COL['res'])
rect('town', 1630, 610, 50, 44, COL['school'])                         # 県立新田高校（グラウンドつき）
rect('town', 1820, 610, 52, 40, COL['school'])                         # 農業大学校（畑つき）
rect('town', 1745, 712, 26, 16, COL['civic'])                          # 新田町役場・JA・直売所
add('town', f'<circle cx="1765" cy="630" r="7" fill="{COL["forest"]}"/>')  # 新田神社の森
# 港：港町と工場・倉庫は港の側
poly('town', [(2020, 620), (2180, 600), (2262, 650), (2262, 760), (2050, 770), (1990, 700)], COL['resd'])
poly('town', [(1930, 730), (2120, 735), (2230, 760), (2230, 795), (2120, 805), (2010, 815), (1940, 790)], COL['ind'])   # 臨海工業地帯
poly('town', [(1960, 815), (2120, 808), (2130, 860), (1980, 870)], COL['ind'])          # 埋め立ての工場
rect('town', 2140, 745, 50, 25, '#c8735c')                             # 赤レンガ倉庫
rect('town', 2198, 760, 30, 20, COL['ware'])                           # 魚市場
rect('town', 2140, 805, 26, 60, COL['port'])                           # 岸壁（コンテナ）
rect('town', 2178, 800, 20, 50, COL['port'])
rect('town', 2262, 690, 50, 22, COL['port'])                           # 客船ターミナルの岸壁
rect('town', 2210, 650, 36, 26, COL['civic'])                          # 海洋博物館・港浜ホール
line('town', [(2120, 900), (2200, 930), (2300, 920)], '#a7a7a7', 6, smooth_=True)       # 防波堤
# 森下・峠・温泉
rect('town', 1418, 462, 50, 36, COL['res'])                            # 森下の集落・村役場
rect('town', 1470, 505, 30, 18, COL['ware'])                           # 森林組合・製材所
rect('town', 1505, 448, 26, 18, COL['park2'])                          # 村営キャンプ場
rect('town', 1600, 270, 18, 12, COL['park2'])                          # 展望台
add('town', f'<circle cx="1556" cy="236" r="6" fill="#ffffff"/>')       # 峠の大滝
poly('town', [(1850, 80), (1930, 70), (1990, 110), (1970, 170), (1890, 175), (1845, 140)], COL['onsen'])   # 湯ノ谷温泉街
rect('town', 1930, 80, 26, 18, COL['park'])                            # 源泉公園
# 空港（中央駅から西5km・南1km。滑走路は南北2.5km）
poly('town', [(-640, 660), (-480, 660), (-480, 960), (-640, 960)], COL['air'], smooth_=False)
rect('town', -584, 690, 8, 250, COL['runway'])                         # 滑走路 2,500m（幅は見やすく少し太め）
rect('town', -560, 700, 4, 230, '#a5a5a5')                             # 誘導路
rect('town', -548, 760, 30, 90, '#c9c9c9')                             # エプロン
rect('town', -518, 780, 14, 50, COL['civic'])                          # ターミナル
rect('town', -480, 770, 60, 30, '#bdb3a6')                             # 駐車場
rect('town', -480, 805, 30, 26, COL['ware'])                           # 空港の倉庫
rect('town', -445, 805, 24, 22, COL['biz'])                            # ホテル
rect('town', -480, 836, 34, 18, '#d5d0c6')                             # レンタカー
poly('town', [(-420, 860), (-330, 850), (-300, 940), (-420, 950)], COL['res'])           # 空港のそとの住宅
poly('town', [(-700, 720), (-660, 700), (-650, 860), (-700, 880)], COL['res'])

# ======================= 道（大きな道だけ） =======================
ROADS = [
    ([(-700, 880), (-470, 860), (-300, 820), (-100, 805), (0, 800), (400, 792), (1000, 792), (1240, 772),
      (1600, 768), (1930, 768), (2140, 770)], 7),                                              # 国道（東西）
    ([(-470, 860), (-460, 900), (-600, 975)], 4),                                              # 空港の南の道
    ([(20, 800), (25, 600), (40, 400), (60, 200), (80, 0)], 6),                                 # 中央から北へ
    ([(-150, 0), (-120, 300), (-200, 520), (-420, 640), (-700, 640)], 4),                       # 北西の県道
    ([(-380, 470), (100, 450), (600, 470), (1000, 470), (1225, 470), (1330, 520), (1450, 600)], 5),  # 北の環状道路
    ([(400, 790), (380, 600), (330, 450), (300, 200), (240, 0)], 4),                           # 桜町から北へ
    ([(650, 792), (650, 660), (670, 540), (700, 300), (720, 0)], 4),                           # 大学前から北へ
    ([(1000, 792), (1000, 680), (1010, 520), (980, 470)], 4),                                  # 緑ヶ丘の坂
    ([(1340, 770), (1370, 620), (1420, 560), (1500, 480), (1560, 400), (1620, 310), (1720, 250),
      (1820, 190), (1890, 150), (1920, 110)], 4),                                              # 温泉への山道
    ([(1930, 768), (2000, 640), (2120, 600), (2240, 560), (2300, 520)], 3),                    # 港の北の海ぞい
    ([(1700, 768), (1660, 650), (1680, 560)], 3),                                              # 新田の高校への道
    ([(-130, 1000), (0, 900), (60, 800)], 4),
    ([(1240, 772), (1250, 1000)], 3),
]
for p, w in ROADS:
    line('road', p, COL['roadedge'], w + 2)
for p, w in ROADS:
    line('road', p, COL['road'], w)

# ======================= 線路（絵には描かない。下絵では細い帯で位置だけ） =======================
# 他社線「県央本線」（架空）：西の端→空港駅→中央（乗りかえ・南側）→本線を立体交差して北へ
OTHER = [(-700, 560), (-620, 600), (-530, 680), (-470, 745), (-380, 772), (-200, 768), (-60, 762), (60, 758),
         (140, 742), (172, 690), (190, 600), (210, 420), (240, 200), (262, 0)]
line('rail', OTHER, COL['other'], 4, 'stroke-dasharray="10 5"')
# みなと川電鉄の本線（横一直線）
line('rail', [(ST['C'][0] - 10, MAINY), (ST['P'][0] + 15, MAINY)], COL['rail'], 4, smooth_=False)
# 温泉支線（川辺から右上へ。山を曲がって登る）
BRANCH = [ST['K'], (1365, 688), (1395, 640), (1420, 560), ST['F'], (1470, 425), (1505, 400), (1545, 370),
          ST['T'], (1640, 262), (1700, 225), (1760, 200), (1830, 160), ST['O']]
line('rail', BRANCH, COL['rail'], 4)
# 中央車庫（中央の西1〜2km・線路の北側）と、そこへの線路
line('rail', [(0, MAINY), (-60, 694), (-100, 668), (-120, 652)], COL['rail'], 3)
rect('rail', -210, 615, 110, 45, COL['yard'], 'opacity=".55"')
for i in range(6):
    line('rail', [(-205, 622 + i * 7), (-105, 622 + i * 7)], COL['rail'], 1.4, smooth_=False)
# 港留置線（港の手前・新田側の北）
rect('rail', 1975, 672, 95, 18, COL['yard'], 'opacity=".55"')
for i in range(3):
    line('rail', [(1978, 677 + i * 5), (2065, 677 + i * 5)], COL['rail'], 1.4, smooth_=False)
# ホーム（中央4線・港2線・温泉2線。大学前・緑ヶ丘・川辺は追い越しの線つき。森下・峠は行き違い）
PLAT = {'C': (4, 30), 'S': (2, 16), 'U': (3, 20), 'M': (3, 20), 'K': (4, 24), 'N': (2, 14), 'P': (2, 22),
        'F': (2, 12), 'T': (2, 12), 'O': (2, 14)}
for s, (n, L) in PLAT.items():
    x, y = ST[s]
    gap = 3.2
    for i in range(n):
        yy = y + (i - (n - 1) / 2) * gap
        if s == 'C':
            line('rail', [(x - L, yy), (x + 6, yy)], COL['rail'], 1.6, smooth_=False)
        elif s in ('P', 'O'):
            line('rail', [(x - L, yy), (x + 4, yy)], COL['rail'], 1.6, smooth_=False)
        else:
            line('rail', [(x - L / 2, yy), (x + L / 2, yy)], COL['rail'], 1.6, smooth_=False)
    # 駅舎（白い四角）
    bw = {'C': 40, 'P': 20, 'K': 18, 'U': 14}.get(s, 10)
    rect('rail', x - bw / 2, y + n * gap / 2 + 2, bw, 6 if s != 'C' else 10, '#ffffff', 'stroke="#555" stroke-width=".8"')
# 他社線の駅（空港駅・中央の乗りかえ）
for (x, y) in [(-470, 745), (40, 759)]:
    rect('rail', x - 12, y - 4, 24, 8, '#ffffff', 'stroke="#555" stroke-width=".8"')

# ======================= ラベル（ラベル版だけ） =======================
for s, (x, y) in ST.items():
    dy = -14 if s in ('F', 'T', 'O') else 28
    label(x, y + dy, NAME[s] + '駅', 16, '#7a1f12', 'bold')
for x, y, t in [
    (-560, 655, '空港（滑走路 南北2.5km）'), (-470, 735, '空港駅'), (-160, 600, '中央車庫'),
    (-30, 612, '県庁'), (90, 600, '図書館・美術館'), (80, 745, 'アーケード'), (-55, 748, 'バスターミナル・立体駐車場'),
    (285, 592, '城跡公園'), (375, 606, '寺町'), (345, 728, '商店街'),
    (665, 510, '国立みなと川大学'), (780, 552, '大学病院'), (645, 704, '北門通り'),
    (980, 508, '団地と給水塔'), (995, 692, 'ニュータウンセンター'),
    (1340, 815, 'モールと平らな駐車場'), (1230, 660, '河川敷公園'), (1375, 632, '緑野市役所'), (1440, 618, '川辺高校'),
    (1655, 603, '県立新田高校'), (1846, 603, '農業大学校'), (1700, 545, '棚田'), (1760, 760, '町役場・JA'),
    (1620, 800, '田んぼ'), (1030, 940, '田んぼ'), (450, 420, '田んぼと丘'),
    (2020, 666, '港留置線'), (2050, 845, '臨海工業地帯'), (2165, 740, '赤レンガ倉庫'), (2215, 790, '魚市場'),
    (2290, 684, '客船ターミナル'), (2230, 645, '海洋博物館'),
    (1450, 455, '森下'), (1505, 395, '峠の鉄橋'), (1560, 228, '大滝'), (1610, 265, '展望台'),
    (1915, 65, '湯ノ谷温泉街'), (1180, 420, 'みなと川'), (1900, 950, 'みなと湾'), (-560, 990, '西の入り江'),
    (300, 240, '県央本線（他社線・架空）'), (1800, 420, '山'), (2200, 300, '山'),
]:
    label(x, y, t, 13)

LEGEND = [('paddy', '田んぼ'), ('terrace', '棚田'), ('hill', '丘・草地'), ('forest', '森'), ('mount', '山'),
          ('sea', '海'), ('river', '川'), ('bank', '河川敷'), ('res', '住宅（戸建て）'), ('resd', '住宅・店（こみあう）'),
          ('danchi', '団地'), ('biz', 'ビル街（20階まで）'), ('shop', '商店・モール'), ('civic', '役所・病院・博物館'),
          ('school', '学校'), ('univ', '大学'), ('ind', '工場'), ('ware', '倉庫'), ('air', '空港'), ('onsen', '温泉街'),
          ('park', '公園'), ('rail', '線路の敷地（絵には描かない）'), ('other', '他社線（絵には描かない）')]


def svg(with_labels=True, legend=False):
    body = ''.join(s for _, s in layers)
    pattern = ('<defs><pattern id="pg" width="10" height="7" patternUnits="userSpaceOnUse">'
               '<path d="M0,0 H10 M0,0 V7" stroke="#b6cc7a" stroke-width=".7"/></pattern>'
               '<pattern id="tg" width="14" height="4" patternUnits="userSpaceOnUse">'
               '<path d="M0,0 H14" stroke="#9fbe6c" stroke-width=".8"/></pattern></defs>')
    over = ('<g opacity=".7">' + ''.join(s.replace(f'fill="{COL["paddy"]}"', 'fill="url(#pg)"')
            .replace(f'fill="{COL["terrace"]}"', 'fill="url(#tg)"') for L, s in layers if L == 'paddy') + '</g>')
    lab = ''
    if with_labels:
        lab = '<g id="labels" font-family="Noto Sans CJK JP, sans-serif">' + ''.join(labels) + '</g>'
    leg = ''
    if legend:
        lx, ly = -690, 10
        leg = f'<g id="legend" font-family="Noto Sans CJK JP, sans-serif"><rect x="{lx}" y="{ly}" width="190" height="{len(LEGEND)*11+26}" fill="#fff" opacity=".88" rx="4"/>'
        leg += f'<text x="{lx+8}" y="{ly+14}" font-size="10" font-weight="bold">下絵の色（1km＝100マス）</text>'
        for i, (k, t) in enumerate(LEGEND):
            yy = ly + 22 + i * 11
            leg += f'<rect x="{lx+8}" y="{yy}" width="16" height="8" fill="{COL[k]}" stroke="#666" stroke-width=".3"/>'
            leg += f'<text x="{lx+30}" y="{yy+7.5}" font-size="8">{t}</text>'
        # 1kmのものさし
        leg += f'<path d="M{lx+8},{ly+len(LEGEND)*11+18} h100" stroke="#000" stroke-width="2"/><text x="{lx+112}" y="{ly+len(LEGEND)*11+21}" font-size="8">1km</text></g>'
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{X0} {Y0} {X1-X0} {Y1-Y0}" '
            f'width="{(X1-X0)*PX}" height="{(Y1-Y0)*PX}">'
            f'<!-- みなと川沿線 新しい地図の下絵（架空・仮）。1km=100マス。x=中央駅からのキロ×100、本線 y={MAINY}。tools/map-sketch.py で作る -->'
            + pattern + f'<rect x="{X0}" y="{Y0}" width="{X1-X0}" height="{Y1-Y0}" fill="{COL["land"]}"/>'
            + body + over + lab + leg + '</svg>')


# ======================= タイル =======================
# 本線の帯：横4.5km×縦6.75km（ChatGPT の縦長 1024×1536 と同じ 2:3）。y 325〜1000
# 北の帯：横4.5km×縦4.5km（正方形 1024×1024）。y 0〜450。本線の帯と1.25km重なる
TILES = [
    ('m1', '空港', 'main', -700, -250), ('m2', '中央', 'main', -300, 150), ('m3', '桜町', 'main', 100, 550),
    ('m4', '大学前', 'main', 420, 870), ('m5', '緑ヶ丘', 'main', 750, 1200), ('m6', '川辺', 'main', 1150, 1600),
    ('m7', '新田', 'main', 1550, 2000), ('m8', '港と海', 'main', 1950, 2400),
    ('n1', '空港の北', 'north', -700, -250), ('n2', '中央の北', 'north', -300, 150), ('n3', '北の田んぼ', 'north', 100, 550),
    ('n4', '丘と田んぼ', 'north', 500, 950), ('n5', '川上', 'north', 900, 1350), ('n6', '森下と峠', 'north', 1300, 1750),
    ('n7', '温泉', 'north', 1700, 2150), ('n8', '山', 'north', 1950, 2400),
]
BAND = {'main': (325, 1000, (1024, 1536)), 'north': (0, 450, (1024, 1024))}
SLUG = {'m1': 'kuko', 'm2': 'chuo', 'm3': 'sakuramachi', 'm4': 'daigakumae', 'm5': 'midorigaoka', 'm6': 'kawabe',
        'm7': 'nitta', 'm8': 'minato', 'n1': 'kuko-kita', 'n2': 'chuo-kita', 'n3': 'kita-tanbo', 'n4': 'oka',
        'n5': 'kawakami', 'n6': 'morishita-toge', 'n7': 'onsen', 'n8': 'yama'}


def main():
    from PIL import Image, ImageDraw, ImageFont
    from playwright.sync_api import sync_playwright
    (OUT / 'tiles').mkdir(parents=True, exist_ok=True)
    (OUT / 'sketch.svg').write_text(svg(True, True), encoding='utf-8')
    tmp = OUT / '_tmp'
    tmp.mkdir(exist_ok=True)
    W, H = (X1 - X0) * PX, (Y1 - Y0) * PX
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=1)
        for name, lab, leg in [('plain', False, False), ('label', True, True)]:
            pg.set_content('<html><body style="margin:0">' + svg(lab, leg) + '</body></html>')
            pg.screenshot(path=str(tmp / f'{name}.png'), clip={'x': 0, 'y': 0, 'width': W, 'height': H})
        b.close()
    plain = Image.open(tmp / 'plain.png').convert('RGB')
    lab = Image.open(tmp / 'label.png').convert('RGB')

    def crop(im, x0, x1, y0, y1):
        return im.crop(((x0 - X0) * PX, (y0 - Y0) * PX, (x1 - X0) * PX, (y1 - Y0) * PX))

    meta = []
    for tid, nm, band, x0, x1 in TILES:
        y0, y1, size = BAND[band]
        f = f'{tid}-{SLUG[tid]}'
        crop(plain, x0, x1, y0, y1).resize(size, Image.LANCZOS).quantize(64).save(OUT / 'tiles' / f'{f}.png', optimize=True)
        crop(lab, x0, x1, y0, y1).resize((size[0] // 2, size[1] // 2), Image.LANCZOS).quantize(128).save(OUT / 'tiles' / f'{f}-label.png', optimize=True)
        meta.append({'id': tid, 'name': nm, 'band': band, 'file': f'tiles/{f}.png', 'x0': x0, 'x1': x1, 'y0': y0, 'y1': y1,
                     'km': [x0 / 100, x1 / 100], 'px': list(size),
                     'stations': [s for s, (x, y) in ST.items() if x0 <= x < x1 and y0 <= y < y1]})
    # 全体図（ラベルつき・半分の大きさ）と、タイルの枠つき
    half = lab.resize((W // 2, H // 2), Image.LANCZOS)
    half.quantize(160).save(OUT / 'overview.png', optimize=True)
    fr = half.copy()
    d = ImageDraw.Draw(fr)
    try:
        font = ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc', 22)
    except Exception:
        font = None
    for m in meta:
        c = (200, 40, 40) if m['band'] == 'main' else (30, 70, 200)
        bx = ((m['x0'] - X0), (m['y0'] - Y0), (m['x1'] - X0) - 1, (m['y1'] - Y0) - 1)
        d.rectangle(bx, outline=c, width=3)
        ty = bx[1] + 6 if m['band'] == 'north' else bx[3] - 34
        d.text((bx[0] + 8, ty), f"{m['id']} {m['name']}", fill=c, font=font, stroke_width=3, stroke_fill=(255, 255, 255))
    fr.quantize(160).save(OUT / 'overview-tiles.png', optimize=True)
    # 今の地図の絵の一部（タッチと角度のお手本）
    bg = Image.open(ROOT / 'assets' / 'images' / 'map_bg.webp').convert('RGB')
    bg.crop((0, 420, 1024, 840)).save(OUT / 'style-ref.jpg', quality=85)
    for f in tmp.iterdir():
        f.unlink()
    tmp.rmdir()
    (OUT / 'tiles.json').write_text(json.dumps({
        'note': '新しい地図のタイル（架空・仮）。単位はマス（1km=100）。x=中央駅からのキロ×100、本線 y=700。tools/map-sketch.py が作る',
        'world': {'x0': X0, 'x1': X1, 'y0': Y0, 'y1': Y1, 'mainY': MAINY, 'pxPerUnit': PX},
        'stations': {s: {'name': NAME[s], 'x': x, 'y': y} for s, (x, y) in ST.items()},
        'tiles': meta}, ensure_ascii=False, indent=1), encoding='utf-8')
    print('ok', len(meta), 'tiles')


if __name__ == '__main__':
    main()
