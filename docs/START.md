# はじめに（毎回これだけ読む）

みなと川ダイアリー：架空の地方鉄道「みなと川線」の沿線で、ダイヤ・売店・工場・街を動かすブラウザゲーム（GitHub Pages、ビルドなし、素の HTML/JS）。ユーザーはやさしい日本語を好む。名前・会社・場所はすべて架空。

## 守ること
- 今の機能を壊さない。大きな書き換えはしない。計算（*-core.js）と画面（*-view.js）を分ける。設定は data/。proto/ に触らない。push の前に fetch と rebase。
- **めざす方向（`docs/VISION.md` を必ず読む）**：現実の社会を出発点に、少し先の未来が見えるシミュレーション。結果は先に決めず、島（鉄道・工場・売店・物流・住宅・住民など）がそれぞれの事情で動き、必要な数字だけを交換する。中心の島は作らない。数字は「現（現実）・仮（仮定）・内（ゲーム内の結果）」を区別する。新しい案は入れる前に「どの島の、どの数字を動かすか」と出どころを決める。決まらないものは docs/ideas.md で待つ。（以前の背骨「売店から、沿線の暮らしが見える」は、この方向に広げた）
- **因果と時刻の順を省かない**：列車の到着→駅の人の流れ→売店の販売→在庫→発注→配送→稼働と収支。描画や不要な計算は減らしてよいが、出来事はゲーム内の時刻の順に処理し、画面を開いていなくても・高速でも結果を変えない。日次の集計は記録と分析用で、日中の因果を失わせない。つなぎが「実装済み／仮の数値／未接続」のどれかをはっきりさせる。
- **描画を止めることと、ゲームの時間・経済活動を止めることは別**。画面の切りかえ・スリープ・復帰で、データの欠落や二重計算を出さない。
- **軽さ**：機能をつないでも、Claude の使用量とスマホの CPU・電池を大きく増やさない。毎コマ書くのは変わったものだけ。重い計算は運行日や設定が変わったときだけ。負荷は `index.html?perf=1` の負荷メーターと `tools/perfcmp.py` で、変える前と後を測って比べる（原因を決めつけない）。
- 確かめたのはヘッドレスだけなら、スマホ実機は未確認と書く。
- **長く育てるための4つの決まり**（詳しくは `docs/HANDOFF.md`・`docs/VISION.md` の「橋の約束」）
  1. 橋は `data/links.json` に1本ずつ（`id` は変えない・from・to・渡す数字の名前と単位と `src`・状態〔実装済み／仮の数値／未接続／廃止〕・強さ・いつ読むか・説明）。やめる橋は消さずに「廃止」。
  2. 島が読むのは、自分より前に確定した数字だけ（一方向・時刻の順）。同じ時刻に読み合う輪は作らない。渡す数字は `{day, t, value}` にできる形で。
  3. つなぎの効き目（倍率・補正）は保存しない。決まった乱数とその日の条件から毎回計算し直す。
  4. 新しく作る保存には最初から版の番号 `v` を付ける。既存のキーの形は変えない。

## 読み方（使用量を節約する）
- **毎回読むのはこのファイルだけ**。そのあと、作業に関係するものだけを開く。
- **何をするか**：`docs/PLAN.md`（いまの計画。柱は3本・進めるのは1本ずつ。柱に入らない案はアイデア帳の「あとで」）。
- コードを探すときは `docs/CODEMAP.md`（関数と区切りの行番号の目次。`node tools/codemap.cjs` で作り直す）を grep し、本体（index.html 約3,300行）は必要な行だけ読む。
- いまの宿題と最近の記録：`docs/HANDOFF.md`（「再開したら」「残っている宿題」と、いちばん下の節だけ。古い日ごとの記録は `docs/archive/`）。機能の説明：`docs/features/` の該当するファイル（README は入口だけ）。案：`docs/ideas.md`。

## ファイルの地図（おもなもの）
- `index.html`：路線図とダイヤ・乗客の計算・地図の描画・沿線暦（本体）。`js/top.js` トップページ。`js/away.js` 留守のあいだ（運行日は本当の暦の朝4:30で進む）。`js/save.js` 保存と引き継ぎコード（dia- で始まるものが入る）。`js/perf-meter.js` 負荷メーター。
- 売店：`js/kiosk-core.js`（1日の出来事の列を決まった乱数で作る）・`js/kiosk-staff.js`（店員・シフト・社会保険）・`js/kiosk-view.js`・`data/kiosk.json`。川辺の配送センター（おまかせ発注・売上の記録と発注を `dia-orders` に）：`js/center-core.js`・`data/center.json`。工場の夜とセンターの発注のつなぎ・納品書：`js/factory-night.js`（2026-11-07）。工場→センター→売店の流れの時刻は `data/center.json` の `flow`。工場の時間帯・人員の検討資料：`docs/factory-discussion.md`。港駅の売店（つくっている途中・`docs/minato-store-rounds.md`）：歩く店の計算 `js/kiosk-walk.js`・設定を合わせる `js/minato-store-core.js`・`data/minato-store.json`・店の中の絵 `js/minato-store-view.js`（人の動き `js/minato-store-anim.js`）。リサーチ：`js/research-*.js`。
- 工場：`factory.html`・`js/factory-*.js`（米）・`js/bread-*.js`・`js/sand-*.js`・`js/donut-*.js`・`js/factory-pl.js`（収支）・`data/factory.json`。
- 沿線くらしアンケート：`survey.html`・`js/survey-*.js`・`data/survey.json`。路線のお絵かき帖：`route-editor.html`・`js/route-*.js`・`data/routes.json`。街のカルテ：`docs/machi-karte.html`・`docs/town.json`。
- 会社（2026-11-09）：売店＝みなとスタンド、センター＝川辺ロジスティクス、工場＝港浜フーズ、配送会社＝みなと川運輸（グループの別々の会社）、他社の運送＝港浜急送、問屋＝みなと卸（`data/companies.json`）。センターの倉庫：`js/center-view.js`（計算は center-core の cs*）。配送会社：`js/haiso-core.js`・`js/haiso-view.js`・`data/haiso.json`。
- 橋（島どうしのつながり）：`data/links.json`・`js/links/*.js`（11/9 にアンケート→売店）。トップの「きょうの沿線」と「研究室」：`js/top.js`。
- テスト：`tests/*.cjs`（node で動かす）。検査：`node tools/lint.cjs`（文法・行の途中の // のうしろの処理・読み込むファイル）。GitHub に push すると、検査とテストが自動で動く（`.github/workflows/test.yml`。失敗すると GitHub に赤い ×）。
