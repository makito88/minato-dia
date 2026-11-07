# コードの目次（自動で作る：`node tools/codemap.cjs`）

ファイルごとに、区切りのコメント（■）と、関数・大事な定数の名前と行番号。本体を読む前にここを grep して、必要な行だけ開く。

## index.html（3363行）

■ 乗車体験（試作） …345・START …617・MAIN …630・ALL …631・treeKm() …635・SEGS …641・POP …643・TYPES …645・CLS …651・ROUTES …652・DEPOTNAME …657・CARKM …658・PURP …660・OFFICE …661・EVENT_DATA …668・■ 追加イベント（20件）。季節の行事は、季節設定に含まれる通常の観光客とは別の「その日だけの上乗せ」です …692・■ 追加イベント（12件） …758・EVMAP …804・ACTIVE_EV …805・evScale() …806・addEventDemand() …807・evDwell() …811・evWindow() …812・registerEvent() …813・ENS …820・ECO …821・NEWD …822・mb32() …823・ENS_PH …825・ensReset() …826・econSeries() …828・shockSchedule() …839・ensDayFactors() …852・ecoApply() …864・ensRefresh() …865・newFlowsBase() …867・newFlowsAfter() …871・■ 1日の記録（あとで便りの判定に使う。集計値だけを残す） …875・ensRecord() …876・■ 便りの判定：続いている傾向だけを候補にする …901・ensDetect() …902・■ 景気のうわさ（自動のときだけ）：段階が変わってから数日遅れで、場所ごとの変化として届く …929・ensEconNews() …930・■ 地域の小さな波の便り：予兆（予告の日）と振り返り（終わってから） …934・ensShockNews() …935・■ 1日の終わりにまとめて呼ぶ：記録→判定→便りを選ぶ。state は保存される（運行日・記録・便り・再送禁止） …942・ensFill() …943・ensMakeLetter() …944・ensEndDay() …950・COND_DEF …971・CONDS …972・COND …978・setCond() …979・rateParts() …987・ELAS …1019・computeService() …1020・demandTotals() …1038・rate() …1041・SPEND …1043・PROP …1044・runT() …1046・scheduleTrip() …1048・onSiding() …1096・buildAll() …1098・finishTrips() …1121・■ カスタムモード：1本ずつ筋を引いてダイヤを組む …1137・CUS_ST …1140・cusSeq() …1141・cusTrip() …1147・cusPlace() …1149・buildCustom() …1150・cusTry() …1154・cusBlocker() …1158・simulate() …1162・adv() …1172・makeEvents() …1216・eventImpacts() …1237・summarize() …1248・bsearch() …1270・■ state …1272・PRESETS …1274・PAT …1310・CUS …1313・cusSave() …1316・save() …1320・rebuild() …1321・■ theme …1330・readTheme() …1332・■ geometry …1339・unit() …1341・LANE_C …1349・stOff() …1350・bl() …1353・segPos() …1354・ease() …1361・tripState() …1362・DEPOT …1369・alongPath() …1370・setState() …1372・darkness() …1385・band() …1386・■ map drawing …1388・QFULL …1393・CDPR …1394・wantDpr() …1395・rng() …1396・BLOCKS …1397・TREES …1401・MAPBG …1403・drawTerrain() …1404・strokePts() …1429・RAIL …1430・PLATS …1432・drawTracks() …1435・drawTrainShape() …1466・VIS …1484・SMAP …1486・staticMap() …1487・drawMap() …1491・waitingAt() …1540・selSet() …1541・■ diagram …1543・diaGeom() …1545・drawDia() …1548・diaHit() …1587・■ panels …1591・curTrip() …1593・trainStatus() …1594・setWhere() …1601・strip() …1610・renderTrain() …1624・■ station timetable …1643・ttStation() …1647・renderTT() …1649・departures() …1672・renderStation() …1674・refreshPanels() …1684・■ purposes …1710・binsFor() …1713・upto() …1718・niceMax() …1719・barChart() …1720・renderPurpose() …1741・mixBar() …1766・psStation() …1770・■ conditions …1773・saveCond() …1774・renderEventChips() …1776・renderCondUI() …1778・renderImpact() …1788・■ OD & sections …1796・flHour() …1798・renderFlow() …1799・odSide() …1826・odBars() …1828・trainOD() …1830・■ 共通の交通スナップショット（地図・ヒートマップ・イベント詳細・将来の運行日誌/車窓モードで共用） …1836・SNAP …1837・trafficSnapshot() …1838・■ 地図レイヤー …1845・LAYERS …1846・EVHIT …1848・segLine() …1849・pillText() …1851・drawHeat() …1852・drawStationLayer() …1859・evPos() …1863・■ 地図の上の薄い雲：ふわっとした雲の絵を数種類作っておき、ゆっくり流す。地面に薄い影も落とす …1864・CLOUDSPR …1865・cloudDim() …1871・drawClouds() …1873・drawEventIcons() …1880・renderLegend() …1892・renderMapNote() …1901・■ イベントの詳細 …1907・EVST …1909・renderEvStrip() …1911・selectEvent() …1914・renderEvent() …1916・■ 環境音エンジン（独立。音を鳴らせない環境でもゲーム本体には影響しない） …1938・SND …1940・noiseBuffer() …1947・voice() …1953・build() …1963・clink() …1978・chirp() …1981・shots() …1984・applyConfig() …1994・loadConfig() …1996・prep() …2004・decode() …2010・srcOf() …2011・load() …2012・startLoop() …2016・passBy() …2020・onboard() …2027・trainRec() …2036・occasional() …2044・listenerPos() …2056・targets() …2063・apply() …2096・setMaster() …2100・tick() …2102・start() …2110・quiet() …2115・stop() …2118・wake() …2119・onPlay() …2121・setVol() …2122・setPart() …2123・updateUI() …2124・effect() …2137・preload() …2142・■ 拡張用の入口（開発者ツールのコンソールから使えます） …2154・公開 minatoDia …2155・■ score …2158・renderScore() …2159・■ editor …2183・carsFor() …2184・renderEditor() …2185・renderEditorCounts() …2198・■ カスタムモードの画面 …2209・renderMode() …2210・renderCustom() …2215・cusPreview() …2228・■ controls …2249・setPlay() …2251・markSeg() …2254・setSpeed() …2255・■ sizing …2278・resize() …2279・■ 乗車体験（試作）：客席から見た車内 …2285・RIDE …2288・kmOf() …2295・■ 素材の読み込み …2297・loadImg() …2298・load() …2299・buildStrips() …2309・■ 走り方（ダイヤから計算。地図の列車と同じ加減速の式 ease を使う） …2322・stopKin() …2323・kin() …2331・nextStop() …2340・■ 乗客（仮のシルエット）の席と立ち位置 …2343・seeded() …2344・makeSlots() …2345・targets() …2350・■ 描画：車内 …2353・fit() …2354・sceneryMix() …2356・duskW() …2363・variantsFor() …2364・drawScenery() …2369・drawStrip() …2371・drawSign() …2377・drawPlatform() …2384・drawWindow() …2392・windowContent() …2396・■ 窓から見える駅（通過・停車）：横から見たホームを、近くのものほど速く・大きく描く …2403・stationPeople() …2407・drawEkimeihyo() …2413・drawHanging() …2422・platNeighbors() …2428・personSprite() …2431・drawSprite() …2432・drawWaiter() …2434・personStyleS() …2475・stationLayer() …2480・■ 窓から見える駅を、車内の絵と同じ遠近法で描く（通路の奥＝消失点に向かって線が集まる） …2527・stationLayerP() …2530・drawCatenaryP() …2562・sceneryGL() …2578・drawSceneryP() …2622・drawStationViewP() …2637・drawStationView() …2639・weatherOnGlass() …2649・shade() …2656・rr() …2657・head() …2658・torso() …2660・drawStand() …2662・drawSeatLong() …2673・drawSeatCross() …2685・drawStandSprite() …2690・drawHeadSprite() …2693・drawPeople() …2696・levelSrc() …2707・drawLevels() …2708・drawDoorway() …2724・riderEvent() …2734・pickRider() …2736・drawPax() …2746・■ ドア上の案内表示（LED）：種別と、次の駅・お出口・乗り換え・接続などの案内を流す …2756・transferDirs() …2759・fasterConn() …2762・passWait() …2768・passAhead() …2770・ledSegs() …2772・drawLed() …2786・drawScene() …2797・■ 描画：ドア（開くと後ろにホームが見える） …2808・drawDoor() …2809・drawDoorGlass() …2822・■ 描画：車内の案内表示（枠は絵、画面の中は文字で描く） …2834・conn() …2835・monitorInfo() …2836・drawMonitor() …2841・■ 画面のまわり（混み具合・ボタン・状況） …2872・side() …2873・■ 確認表示：いまの区間・景色の混ざり具合・ホームを文字にする（描画と同じ関数から計算） …2891・debugInfo() …2893・laneOf() …2911・trainSize() …2914・trainScale() …2915・trainAt() …2918・platTrains() …2931・drawDoors() …2944・drawTrain() …2948・■ ホームで待つ人（仮の手描き。人数は waitingAt から） …2959・evOutfit() …2960・makePlatSlots() …2961・personStyle() …2967・drawPerson() …2973・crowdTarget() …3001・■ ホームの看板・時計・発車標 …3003・deps() …3004・tcol() …3007・drawClock() …3008・drawHangingBoard() …3013・neighbors() …3021・drawStationSign() …3023・■ ホームの描画とまわりの表示 …3032・platDraw() …3033・platInfo() …3054・trackLabel() …3061・drawLED() …3063・xferHTML() …3071・platSide() …3079・platSkip() …3090・setDir() …3092・toPlat() …3093・■ 入る・出る …3101・markSpd() …3102・enter() …3103・startRide() …3113・exit() …3118・doorSound() …3126・tick() …3129・alight() …3141・■ 沿線暦の画面：運行日・沿線だより・4つの見方・開発用の表示 …3157・ENSEN_UI …3159・load() …3163・persist() …3167・init() …3168・dayEnd() …3174・unread() …3178・renderBadge() …3179・srcLine() …3181・renderList() …3182・renderFilter() …3187・setOpen() …3189・renderDev() …3192・resetAll() …3208・renderCondExtra() …3211・renderEval() …3224・renderAll() …3234・mount() …3236・■ loop …3251・PERF …3253・PHONE …3263・drawGap() …3264・needDraw() …3266・frameDt() …3274・frame() …3275・■ 場面（コレクション）：data/scenes.json の場面を地図のピンにし、押すと小窓で開く …3284・SCENES …3285・scenePos() …3287・drawScenePins() …3289・openScene() …3295・■ いまの時刻と天気（日本時間・東京都立川市）につなぐ …3304・jstParts() …3306・liveT() …3307・WXK …3311・wxLog() …3313・holLog() …3314・fetchCal() …3315・liveCond() …3323・start() …3333

## js/away.js（98行）

KEY …15・load() …20・save() …21・hash() …25・ymdOf() …27・condFor() …30・catchUp() …38・■ 画面 …60・overlay() …61・show() …62・CSS …73・■ 起動 …82・公開 minatoAway …94

## js/bread-core.js（213行）

BS_LABEL …19・rng() …21・gauss() …22・hm() …23・fermRate() …27・waterFor() …31・centerPart() …33・orders() …35・split() …39・flow() …42・simulate() …45・add() …62・rankOf() …172・judge() …173・公開 BreadCore …211

## js/bread-view.js（358行）

KEY …13・SPEEDS …15・liveNote() …18・ST_COLOR …19・load() …21・save() …22・css() …23・tempColor() …26・rgb() …28・pColor() …30・■ 切り替え …33・buildTabs() …34・■ 夕方に決める …50・buildPlan() …51・■ 回す・再生 …94・run() …95・buildPlay() …103・markSpeed() …110・markPlay() …111・tick() …112・drawAll() …116・■ 4つの時計 …121・drawClocks() …122・■ 工程の絵 …133・TITLES …134・layout() …135・rr() …140・txt() …141・hit() …142・selRing() …143・frame() …144・person() …145・tub() …149・drawStage() …157・drawMix() …168・drawFerm() …175・drawBench() …180・drawShape() …190・drawProof() …201・drawOven() …217・drawCool() …233・drawPack() …240・■ 生地ごとの帯 …247・drawGantt() …248・■ 生地を一つ追いかける …262・drawBatch() …263・■ 記録 …300・drawEvents() …301・■ 朝の答え合わせ …305・showResult() …306・changes() …327・onClick() …331・legends() …333・buildHeroes() …338・init() …343

## js/center-core.js（119行）

storeKey() …22・orderNo() …23・genreOf() …24・genreCfg() …25・routeOf() …26・salesRecord() …30・condW() …39・segShare() …44・plan() …55・emptyLog() …84・dayOf() …85・putRecord() …86・putOrder() …88・trim() …94・recsOf() …95・supplyFor() …98・truckFor() …101・flowOf() …103・arrival() …107・putArrival() …114・公開 CenterCore …116

## js/donut-core.js（64行）

rng() …5・normalize() …6・simulate() …10・stage() …61・公開 DonutCore …62

## js/donut-view.js（107行）

liveNote() …7・save() …9・run() …10・plan() …11・COLS …20・colOf() …21・crewText() …23・recipes() …24・stations() …33・result() …39・draw() …46・drawStage() …54・init() …99・tick() …102

## js/factory-core.js（375行）

ST_LABEL …22・LN_LABEL …25・ROLES …27・rng() …29・gauss() …30・tau() …34・soakNeed() …36・mu() …38・lineCap() …42・washMin() …44・fillOrder() …46・centerPart() …51・fillOrders() …53・riceKind() …56・riceSeq() …58・actualOrder() …67・hm() …70・simulate() …72・addBatch() …86・fixDrift() …142・findLabel() …145・judge() …325・公開 FactoryCore …373

## js/factory-live.js（32行）

nowT() …12・sec() …14・SPEEDS …15・liveAt() …17・note() …19・puffs() …26・bubbles() …28・公開 FactoryLive …30

## js/factory-night.js（72行）

LINES …13・kioskMap() …19・seasonOf() …21・seedOf() …23・latest() …25・splitItems() …27・cfgsFrom() …29・runNight() …32・centerShip() …43・share() …45・truckOf() …49・slip() …53・readLog() …64・withCenter() …65・centerNote() …66・公開 FactoryNight …69

## js/factory-pl.js（99行）

KEY …11・load() …12・save() …13・defaults() …14・settings() …15・extraUnits() …16・apply() …18・suggestBatches() …24・compute() …28・■ 画面 …58・build() …63・changed() …80・show() …81・init() …93・公開 FactoryPL …96

## js/factory-view.js（544行）

KEY …12・SPEEDS …14・liveNote() …17・ST_COLOR …18・load() …20・save() …21・css() …22・tempColor() …23・rgb() …25・■ 夕方に決める …28・buildPlan() …29・clampInt() …77・■ 回す …79・run() …80・■ 再生 …90・buildPlay() …91・markSpeed() …99・markPlay() …100・tick() …101・BELT_MAX …113・madeAt() …115・resetBelt() …116・drawAll() …117・■ 4つの時計 …125・drawClocks() …126・■ 工程の絵 …140・layout() …141・TITLES …149・drawStage() …150・arrowHead() …175・boxFrame() …176・rr() …178・hit() …179・selRing() …180・txt() …181・germDot() …182・drawWash() …184・drawTanks() …194・drawPots() …212・drawCooler() …233・drawHold() …249・FILL_COLOR …262・STATIONS …263・ST_OF …264・nittaTag() …265・ROLE_COLOR …267・ROLE_HOME …268・person() …269・bubble() …273・inBreak() …276・visitsAt() …277・expiryText() …278・linePath() …280・drawForm() …285・drawLinePeople() …357・drawShip() …370・■ 釜ごとの帯 …389・drawGantt() …390・■ 釜を一つ追いかける …414・drawBatch() …415・■ 工場の記録 …460・drawEvents() …462・■ 朝の答え合わせ …467・showResult() …468・changes() …509・■ クリック …513・onStageClick() …514・legends() …519・init() …524・公開 FactoryRice …532

## js/kiosk-core.js（354行）

hash() …13・rng() …14・■ 下ごしらえ …21・index() …22・life() …24・shelfInfo() …26・defaultOrder() …31・■ 状態 …32・create() …33・■ 1日を動かす …39・simulate() …42・review() …260・■ 運行日を締める：評判・SNSの話題・常連・ブーム・在庫の持ちこし・知らせ …270・closeDay() …271・■ 移転：別の駅・場所へ移す（次の運行日から） …321・relocate() …326・migratePrices() …339・backAt() …344・stockAt() …345・idxAt() …346・soFar() …348・公開 KioskCore …352

## js/kiosk-staff.js（140行）

hash() …12・rng() …13・hoursOf() …19・dayPlan() …23・TYPES …28・traits() …36・moodWord() …38・person() …41・create() …50・assign() …59・autoShift() …72・migrate() …75・insuredOf() …81・weekHours() …83・today() …85・payOf() …97・adsOpen() …100・close() …103・公開 KioskStaff …137

## js/kiosk-view.js（836行）

STORDER …12・DAYN …22・■ 読み込み・保存 …29・persist() …37・■ その日の計算 …41・ctxNow() …42・supplyOf() …47・checkDay() …48・ensureRes() …51・tick() …55・closeToday() …56・orderFor() …68・nextOrderDay() …69・■ 川辺の配送センター（計算は js/center-core.js、設定は data/center.json） …70・center() …73・isAuto() …74・managed() …75・aimName() …76・loadOrders() …78・saveOrders() …79・arrivalToCenter() …81・salesToCenter() …82・planFor() …83・dailyOrder() …85・factoryReady() …95・slipTodo() …96・slipNow() …98・queueSlips() …99・makeSlip() …101・nextCond() …113・editOrder() …114・expressLeft() …118・expressOpen() …119・todayExpress() …123・openExpress() …125・pendingExpress() …126・addToExpress() …129・orderExpress() …132・addOnOk() …136・addOnNext() …137・addOnToday() …138・orderAddOn() …139・expressConfirm() …144・onDuty() …149・curSet() …150・edit() …151・■ 商品ごとの「いま」 …155・counts() …157・nextDelivery() …160・pinfo() …161・motText() …165・withText() …167・ST_LABEL …169・orderDiff() …172・orderText() …173・■ 骨組み …175・CSS …176・mount() …252・setMult() …267・badge() …268・readNews() …271・openFromBadge() …273・setOpen() …274・■ 開店前：場所を選ぶ …277・renderSetup() …278・■ 要注意：売り切れ・品出し待ち・残りわずか（押すと商品カード） …291・renderAlert() …292・openSheet() …303・closeSheet() …304・renderSheet() …305・updateSheet() …340・■ 画面全体 …344・render() …345・renderKpi() …354・renderBody() …359・evText() …371・LF0 …384・KIND …387・lfMatch() …390・lfBar() …398・lfSummary() …417・lfCsv() …429・PAGE …438・renderLog() …439・flushLog() …457・centerBox() …465・slipLine() …476・flowLine() …481・renderItems() …489・updateItems() …550・renderLayout() …555・basketStats() …569・renderPeople() …578・crewSave() …607・renderCrew() …608・renderMoney() …689・moveCard() …703・shrinkCard() …723・renderNews() …732・■ 売店の正面の絵 …735・BOX …736・zoneSlots() …737・rr() …738・drawItem() …739・drawKiosk() …749・personColor() …778・spawnFromEvent() …779・bubble() …784・stepPeople() …785・drawPerson() …794・draw() …799・onCanvasClick() …819・loop() …822・■ 起動 …827・公開 minatoKiosk …829

## js/research-core.js（166行）

hash() …12・rng() …13・■ 場所を通る人（目的×時間） …20・footfall() …21・dwellOf() …28・ageMix() …31・emoneyP() …32・■ 調査1日分 …34・dayRecord() …36・soFar() …69・■ 集計：レポート …71・DAYK …72・aggregate() …73・■ 試算：業態ごとの売上と費用 …100・estimate() …102・erf() …162・公開 ResearchCore …164

## js/research-view.js（388行）

STORDER …12・DAYN …22・PCOL …23・■ 保存 …28・blank() …29・load() …30・persist() …34・■ その日の材料（終わった日の分を記録するため、日が進む前に覚えておく） …38・ctxFor() …39・tick() …43・addRecord() …49・startStudy() …52・stopStudy() …55・■ 骨組み …57・CSS …58・mount() …110・markM() …130・badge() …131・setOpen() …132・setMult() …133・■ 調査の計画 …135・renderPlan() …136・■ レポート …159・bars() …160・toKiosk() …162・renderReport() …166・renderEst() …203・render() …233・■ 映像 …237・scenePlace() …238・provisional() …239・platEvents() …241・loop() …254・COATS …257・rr() …259・sky() …260・person() …262・draw() …270・■ ホーム：このホームに着く列車（のりばが複数ある駅は、交互にこのホームへ着くものとする） …292・■ 起動 …382・公開 minatoResearch …384

## js/route-core.js（172行）

uid() …17・emptyDoc() …19・normalize() …22・■ 形（制御点の並び → 細かい折れ線） …37・ctrlOf() …38・bez() …40・bezPt() …42・flatten() …44・edgeFlat() …50・polyLen() …51・edgeLen() …52・■ 近いものをさがす …54・segNear() …55・nearestNode() …57・nearestEdge() …58・■ 点と道をいじる …63・addNode() …64・addEdge() …65・splitEdge() …67・anchor() …75・segX() …79・makeCrossings() …84・addPath() …99・edgesOf() …109・stopsOn() …110・dropOrphan() …111・deleteStop() …112・deleteNode() …113・deleteEdge() …115・mergeNodes() …117・detachNode() …123・insertBend() …127・■ いちばん近い道（ダイクストラ） …129・adjacency() …130・shortest() …132・linePath() …139・lineType() …143・lineStyle() …144・lineLanes() …146・■ 運行（第2段で使う） …151・tripsPerDay() …153・exportDoc() …156・simplify() …161・API …168

## js/route-editor.js（457行）

KEY …9・FONTS …10・FONTN …11・SHAPES …12・DASHN …13・DEF …15・MAP …19・■ 保存・元に戻す …22・save() …23・commit() …24・revert() …25・undo() …26・redo() …27・fixSel() …28・■ 見る位置 …34・fit() …36・zoomAt() …38・resize() …39・■ 線の描き方 …41・dashOf() …42・strokeStyled() …45・shapePath() …57・drawMarker() …65・LPV …73・autoLP() …74・labelBox() …78・drawLabel() …79・■ 路線の形（同じ道は並べてずらす） …87・offsetPoly() …88・linesGeom() …90・■ 背景：机・地図の絵・線路と駅 …104・drawTable() …105・drawSheet() …109・drawRail() …113・■ 全体を描く（画面とPNGで共通） …122・drawScene() …123・frame() …157・■ 当たり判定 …159・hitStop() …161・hitHandle() …164・■ 指・マウス …166・pos() …168・endPointer() …196・dbl() …211・hoverCursor() …219・tapPen() …221・tapPoly() …222・endPoly() …226・tapStop() …227・newLine() …230・tapLine() …232・■ キー …238・delSel() …251・■ 見本の小さな絵 …253・swatch() …254・■ 画面の部品 …261・chip() …264・setTool() …265・focusName() …267・ui() …269・dots() …272・typeRow() …274・dock() …279・■ 路線の帳面 …305・showLines() …306・lineList() …309・lineEditor() …316・■ 見た目の小窓 …348・closePops() …349・openStyle() …350・renderStyle() …351・■ メニュー …392・download() …402・exportJSON() …404・bounds() …407・savePNG() …408・■ 例（メニューの「例を描いてみる」。元に戻すで消せる） …413・example() …414・■ はじめ …445・init() …446・公開 __routeEditor …454

## js/sand-core.js（287行）

ING …22・rng() …23・gauss() …24・hm() …25・YEN_SEASON …27・■ 規格：原材料からアレルゲンを集める …29・kindOf() …31・kindAllergen() …32・productKinds() …33・productParts() …34・productAllergen() …35・spec() …38・washLeft() …41・washMin() …42・expiryAt() …44・centerPart() …47・orders() …48・safeMin() …51・waterLeft() …52・beltRate() …54・ownBread() …57・sandFor() …58・simulate() …60・■ くじ（条件を変えても、同じ時刻に同じくじ） …79・■ 品質確認の人：仕事の列（初品確認 → 冷却・配合・洗浄 → 保留の評価） …85・■ 具材の在庫と仕込み …89・■ 組み立て …103・■ 品質確認の人 …145・■ 仕込み …149・■ 組み立て …171・■ 締め → カット（1組を2切れ）。保留の分は評価を待つ …216・■ 三角パックに詰める（人）：いちばん前から待っている切れの品から …221・■ 記録 …239・■ 朝の答え合わせ …250・公開 SandCore …285

## js/sand-loaf.js（124行）

LS_LABEL …17・hm() …18・fermRate() …21・slicesPer() …23・loavesFor() …25・flow() …27・coolOf() …29・coolMin() …30・create() …32・judge() …51・step() …60・confirm() …98・take() …105・snap() …108・summary() …112・公開 SandLoaf …122

## js/sand-view.js（399行）

KEY …14・SPEEDS …16・liveNote() …19・load() …20・save() …21・css() …22・tempColor() …27・rgb() …29・■ 夕方に決める …31・buildPlan() …32・■ 回す・再生 …105・run() …106・buildPlay() …110・markSpeed() …114・markPlay() …115・tick() …116・drawAll() …119・■ 4つの時計 …124・QC_TEXT …125・JAM_TEXT …126・codeText() …127・codeText0() …129・drawClocks() …130・loafClock() …140・■ 工程の絵 …144・TITLES …145・layout() …146・rr() …150・txt() …151・frame() …152・person() …153・bar() …154・drawStage() …156・loafPan() …166・drawLoaf() …167・slot() …204・drawEgg() …207・drawLettuce() …225・drawKatsu() …234・drawFruit() …242・drawFridge() …252・lastProd() …257・drawLine() …258・drawShime() …283・drawPack() …286・■ トレーの温度のグラフ …295・drawTray() …296・■ 持ち場ごとの帯 …312・drawGantt() …313・■ 記録 …332・drawEvents() …333・■ 朝の答え合わせ …336・showResult() …337・loafResult() …365・■ 商品規格（原材料・アレルゲン） …369・buildSpec() …370・changes() …377・setActive() …381・init() …382

## js/save.js（120行）

SLOTS …11・collect() …17・restore() …18・summary() …20・encode() …29・decode() …32・■ 画面 …46・CSS …47・mount() …64・msg() …95・copy() …96・open() …98・renderSlots() …99・alertIn() …104・make() …105・check() …108・showConfirm() …109・apply() …110・fromHash() …115・公開 minatoSave …118

## js/survey-core.js（62行）

seedOf() …8・rng() …9・curve() …12・score() …20・trueShares() …30・years() …35・wave() …41・total() …55・公開 SurveyCore …60

## js/survey-view.js（120行）

COLS …6・W() …11・TOT() …12・■ 吹き出し …19・showTip() …21・hideTip() …22・bindTips() …23・■ 年と質問 …25・setYear() …26・buildTop() …27・stop() …34・■ 駅ごとにくらべる …36・refAt() …37・renderRows() …38・■ うつりかわり（小さなグラフを駅の数だけ） …62・renderMini() …63・■ 年代でくらべる …87・renderAges() …88・■ 読みとりメモ（その年の結果から、目立つところを文にする） …94・renderHint() …95・render() …108・■ 読み込み …110

## js/top.js（112行）

KEY …10・KARTE …11・COUNTRY …12・■ イメージの絵（架空・説明用） …15・SVG_WORLD …16・SVG_JAPAN …23・SVG_CREW …31・go() …53・CSS …62・render() …85・open() …99・close() …100・公開 minatoTop …110
