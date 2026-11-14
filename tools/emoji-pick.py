#!/usr/bin/env python3
"""地図の吹き出しで使う絵文字の絵（Twemoji の SVG）を、必要な分だけ assets/images/emoji/ に入れる。

使い方：python3 tools/emoji-pick.py <Twemoji の SVG のフォルダ>
  例：npm pack @twemoji/svg → tar xzf twemoji-svg-*.tgz → python3 tools/emoji-pick.py package
  data/event-map.json の catalog・game・weather・season に書いた絵文字を集め、ファイル名（コードポイントを - でつないだもの）でコピーする。
  フォルダを省くと、足りない絵がないかだけを確かめる。
絵のライセンス：Twemoji（jdecked/twemoji）CC-BY 4.0。README に書いてある。
"""
import json, os, shutil, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
cfg = json.load(open(os.path.join(ROOT, 'data', 'event-map.json'), encoding='utf-8'))
out = os.path.join(ROOT, cfg['emojiDir'])


def name_of(e):
    cps = [f'{ord(ch):x}' for ch in e]
    if '200d' not in cps:
        cps = [c for c in cps if c != 'fe0f']   # Twemoji は ZWJ のない絵文字の FE0F を名前に入れない
    return '-'.join(cps) + '.svg'


emo = set()
for cat in cfg['catalog']:
    for e, _ in cat['items']:
        emo.add(e)
for v in cfg['game'].values():
    emo.add(v['e'])
for v in cfg['weather'].values():
    emo.add(v['e'])
for k in ('spr', 'sum', 'aut', 'win'):
    emo.add(cfg['season'][k])

src = sys.argv[1] if len(sys.argv) > 1 else None
os.makedirs(out, exist_ok=True)
miss = []
for e in sorted(emo):
    n = name_of(e)
    if src:
        p = os.path.join(src, n)
        if os.path.exists(p):
            shutil.copyfile(p, os.path.join(out, n))
        else:
            miss.append((e, n))
    elif not os.path.exists(os.path.join(out, n)):
        miss.append((e, n))
print(f'絵文字 {len(emo)} 個', '・足りない:' if miss else '・すべてある', ' '.join(f'{e}({n})' for e, n in miss))
sys.exit(1 if miss else 0)
