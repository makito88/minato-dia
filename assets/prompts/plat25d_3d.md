# 峠駅 2.5D の場面：気動車を3Dにする（素材 toge_3d）

## 使い方
1. 灰色の枠の文章をそのままコピーして、ChatGPT か Gemini に貼り付け、車両の絵を1枚作ります
2. その絵を TRELLIS（https://huggingface.co/spaces/microsoft/TRELLIS）にのせて「Generate」→「Extract GLB」→ GLB をダウンロード
3. 絵（png）と GLB の両方を **ピクチャ > `minato-dia素材` > `toge_3d`** に保存します（新しく `toge_3d` フォルダを作ってください）
4. 「toge_3d 置いた」と伝えてください

- 1両だけを作ります。2両編成は、同じ3Dを2つつなげて作ります（長い物を一度に作ると、形がくずれやすいため）
- 背景は白です（3Dにするサイトは、白い背景のほうが形をきれいに取り出せるため）
- 色は今の場面の Gemini 版の絵（クリーム色に赤い帯、少し古びた感じ）に合わせています

---

## 60 古い気動車1両（斜め前から）
```
A single old Japanese rural diesel railcar, one car only, seen from the front-left at a three-quarter angle, slightly from above, the whole car fully visible from the front end to the rear end including the bogies and wheels. Classic 1970s design: cream body with a red stripe below the windows and a red band along the bottom, flat front end with two round headlights, a center front door with a window and two front windows, small destination sign above, a row of side windows, two sliding passenger doors on the side, grey roof with small ventilators and an exhaust pipe, black undercarriage with the engine and fuel tank. Slightly faded paint with light weathering, but clean shapes. Soft even studio lighting, no strong shadows. Plain pure white background, no rails, no platform, no ground, no people, no text. Wide 16:9 image.
```
