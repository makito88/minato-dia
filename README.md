# みなと川ダイアリー

運行パターン（種別・区間・時間帯・間隔・両数）を決めると、待避や単線の交換を考えたダイヤが自動で組まれ、
地図とダイヤグラムの上を列車が走る鉄道ダイヤ設定ゲームです。

## 遊び方
開くと、まずトップページが出ます。**世界・澪洲国（日本にあたる架空の島国。名前は仮）・沿線・店舗・従業員・工場**の6つのレイヤーから、路線図とダイヤ、沿線だより、駅ナカ リサーチ、売店（商品・客層・収支）、店員とシフト、街のカルテ（別のタブ）へ進めます。世界と日本はまだ読み物だけで、準備中のものはそう書いてあります。上の帯の「トップ」でいつでも戻れ、「次から、開いたときにこのページを出さない」で出さないようにもできます（`js/top.js`）。

`index.html` をブラウザで開くだけで動きます（インストール不要・1ファイル完結）。

## はじめて読む人・続きを作る人へ
- **はじめに**：[docs/START.md](docs/START.md)（毎回これだけ読む・守ること）／**めざす方向**：[docs/VISION.md](docs/VISION.md)（島と橋・数字の出どころ・橋の約束）
- **いまの計画**：[docs/PLAN.md](docs/PLAN.md)（柱は3本・進めるのは1本ずつ）
- **いまの現在地**：[docs/HANDOFF.md](docs/HANDOFF.md)（宿題・つながりの表・予定の回の記録）。古い日ごとの記録は [docs/archive/HANDOFF-2026-10-11.md](docs/archive/HANDOFF-2026-10-11.md)
- **コードの目次**：[docs/CODEMAP.md](docs/CODEMAP.md)／**アイデア帳**：[docs/ideas.md](docs/ideas.md)
- **島どうしのつながり（橋）**：[data/links.json](data/links.json)。トップの「きょうの沿線」→「島をつなぐ橋」でも見られます。

## 機能ごとの説明（docs/features/）
- [鉄道（路線図とダイヤ・乗客・イベント・音・乗車体験）](docs/features/rail.md)
- [沿線くらしアンケート](docs/features/survey.md)
- [路線のお絵かき帖（描いた路線を地図の「バス・配送」で走らせる）](docs/features/route-editor.md)
- [沿線暦と沿線だより](docs/features/ensen.md)（季節のできごとの仕組みもここ）
- [駅ナカ リサーチ](docs/features/research.md)
- [売店の運営](docs/features/kiosk.md)
- [店内画で一人の買い物を試す](kiosk-scene.html)（飲料1本の買い物。品切れの反応を試す例と、売店で計算された品・待ち時間・会計時刻の再生。対応する記録から順に接続中。売上は変更しません）
- [配送会社とセンターの倉庫](docs/features/haiso.md)
- [おにぎり工場（米・パン・サンドイッチ・ドーナッツ・お弁当・原材料・収支）](docs/features/factory.md)
- [保存と引き継ぎ・留守のあいだ](docs/features/save.md)
- [設定資料（引き継ぎメモ・アイデア帳・街のカルテ）](docs/features/karte.md)
- [更新履歴](docs/features/history.md)

## GitHub Pages で公開する
リポジトリの Settings → Pages → Branch を `main` / `(root)` にして保存すると、
`https://<ユーザー名>.github.io/<リポジトリ名>/` で遊べます。

