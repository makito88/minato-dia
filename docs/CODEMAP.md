# コードの目次（自動で作る：`node tools/codemap.cjs`）

ファイルごとに、区切りのコメント（■）と、関数・大事な定数の名前と行番号。本体を読む前にここを grep して、必要な行だけ開く。

## index.html（3406行）

■ 乗車体験（試作） …350・START …626・MAIN …639・ALL …640・treeKm() …644・SEGS …650・POP …652・TYPES …654・CLS …660・ROUTES …661・DEPOTNAME …666・CARKM …667・PURP …669・OFFICE …670・EVENT_DATA …677・■ 追加イベント（20件）。季節の行事は、季節設定に含まれる通常の観光客とは別の「その日だけの上乗せ」です …701・■ 追加イベント（12件） …767・EVMAP …813・ACTIVE_EV …814・evScale() …815・addEventDemand() …816・evDwell() …820・evWindow() …821・registerEvent() …822・ENS …829・ECO …830・NEWD …831・mb32() …832・ENS_PH …834・ensReset() …835・econSeries() …837・shockSchedule() …848・ensDayFactors() …861・ecoApply() …873・ensRefresh() …874・newFlowsBase() …876・newFlowsAfter() …880・■ 1日の記録（あとで便りの判定に使う。集計値だけを残す） …884・ensRecord() …885・■ 便りの判定：続いている傾向だけを候補にする …910・ensDetect() …911・■ 景気のうわさ（自動のときだけ）：段階が変わってから数日遅れで、場所ごとの変化として届く …938・ensEconNews() …939・■ 地域の小さな波の便り：予兆（予告の日）と振り返り（終わってから） …943・ensShockNews() …944・■ 1日の終わりにまとめて呼ぶ：記録→判定→便りを選ぶ。state は保存される（運行日・記録・便り・再送禁止） …951・ensFill() …952・ensMakeLetter() …953・ensEndDay() …959・COND_DEF …980・CONDS …981・COND …987・setCond() …988・rateParts() …996・ELAS …1028・computeService() …1029・demandTotals() …1047・rate() …1050・SPEND …1052・PROP …1053・runT() …1055・scheduleTrip() …1057・onSiding() …1105・buildAll() …1107・finishTrips() …1130・■ カスタムモード：1本ずつ筋を引いてダイヤを組む …1146・CUS_ST …1149・cusSeq() …1150・cusTrip() …1156・cusPlace() …1158・buildCustom() …1159・cusTry() …1163・cusBlocker() …1167・simulate() …1171・adv() …1181・makeEvents() …1225・eventImpacts() …1246・summarize() …1257・bsearch() …1279・■ state …1281・PRESETS …1283・PAT …1319・CUS …1322・cusSave() …1325・save() …1331・rebuild() …1332・■ theme …1341・readTheme() …1343・■ geometry …1350・unit() …1352・LANE_C …1360・stOff() …1361・bl() …1364・segPos() …1365・ease() …1372・tripState() …1373・DEPOT …1380・alongPath() …1381・setState() …1383・darkness() …1396・band() …1397・■ map drawing …1399・QFULL …1404・CDPR …1405・wantDpr() …1406・rng() …1407・BLOCKS …1408・TREES …1412・MAPBG …1414・drawTerrain() …1415・strokePts() …1440・RAIL …1441・PLATS …1443・drawTracks() …1446・drawTrainShape() …1477・VIS …1495・SMAP …1497・staticMap() …1498・drawMap() …1502・waitingAt() …1551・selSet() …1552・■ diagram …1554・diaGeom() …1556・drawDia() …1559・DIAW …1601・drawDiaLoad() …1603・setDiaW() …1617・markDiaW() …1618・diaHit() …1619・■ panels …1623・curTrip() …1625・trainStatus() …1626・setWhere() …1633・strip() …1642・renderTrain() …1656・■ station timetable …1675・ttStation() …1679・renderTT() …1681・departures() …1704・renderStation() …1706・refreshPanels() …1716・■ purposes …1742・binsFor() …1745・upto() …1750・niceMax() …1751・barChart() …1752・renderPurpose() …1773・mixBar() …1798・psStation() …1802・■ conditions …1805・saveCond() …1806・renderEventChips() …1808・renderCondUI() …1810・renderImpact() …1820・■ OD & sections …1828・flHour() …1830・renderFlow() …1831・odSide() …1858・odBars() …1860・trainOD() …1862・■ 共通の交通スナップショット（地図・ヒートマップ・イベント詳細・将来の運行日誌/車窓モードで共用） …1868・SNAP …1869・trafficSnapshot() …1870・■ 地図レイヤー …1877・LAYERS …1878・EVHIT …1880・segLine() …1881・pillText() …1883・drawHeat() …1884・drawStationLayer() …1891・evPos() …1895・■ 地図の上の薄い雲：ふわっとした雲の絵を数種類作っておき、ゆっくり流す。地面に薄い影も落とす …1896・CLOUDSPR …1897・cloudDim() …1903・drawClouds() …1905・drawEventIcons() …1912・renderLegend() …1924・renderMapNote() …1933・■ イベントの詳細 …1939・EVST …1941・renderEvStrip() …1943・selectEvent() …1946・renderEvent() …1948・■ 環境音エンジン（独立。音を鳴らせない環境でもゲーム本体には影響しない） …1970・SND …1972・noiseBuffer() …1979・voice() …1985・build() …1995・clink() …2010・chirp() …2013・shots() …2016・applyConfig() …2026・loadConfig() …2028・prep() …2036・decode() …2042・srcOf() …2043・load() …2044・startLoop() …2048・passBy() …2052・onboard() …2059・trainRec() …2068・occasional() …2076・listenerPos() …2088・targets() …2095・apply() …2128・setMaster() …2132・tick() …2134・start() …2142・quiet() …2147・stop() …2150・wake() …2151・onPlay() …2153・setVol() …2154・setPart() …2155・updateUI() …2156・effect() …2169・preload() …2174・■ 拡張用の入口（開発者ツールのコンソールから使えます） …2186・公開 minatoDia …2187・■ score …2190・renderScore() …2191・■ editor …2215・carsFor() …2216・renderEditor() …2217・renderEditorCounts() …2230・■ カスタムモードの画面 …2241・renderMode() …2242・renderCustom() …2247・cusPreview() …2260・■ controls …2281・setPlay() …2283・markSeg() …2286・setSpeed() …2287・markSpeed() …2288・liveTf() …2291・leaveLive() …2293・■ sizing …2317・resize() …2318・■ 乗車体験（試作）：客席から見た車内 …2324・RIDE …2327・kmOf() …2334・■ 素材の読み込み …2336・loadImg() …2337・load() …2338・buildStrips() …2348・■ 走り方（ダイヤから計算。地図の列車と同じ加減速の式 ease を使う） …2361・stopKin() …2362・kin() …2370・nextStop() …2379・■ 乗客（仮のシルエット）の席と立ち位置 …2382・seeded() …2383・makeSlots() …2384・targets() …2389・■ 描画：車内 …2392・fit() …2393・sceneryMix() …2395・duskW() …2402・variantsFor() …2403・drawScenery() …2408・drawStrip() …2410・drawSign() …2416・drawPlatform() …2423・drawWindow() …2431・windowContent() …2435・■ 窓から見える駅（通過・停車）：横から見たホームを、近くのものほど速く・大きく描く …2442・stationPeople() …2446・drawEkimeihyo() …2452・drawHanging() …2461・platNeighbors() …2467・personSprite() …2470・drawSprite() …2471・drawWaiter() …2473・personStyleS() …2514・stationLayer() …2519・■ 窓から見える駅を、車内の絵と同じ遠近法で描く（通路の奥＝消失点に向かって線が集まる） …2566・stationLayerP() …2569・drawCatenaryP() …2601・sceneryGL() …2617・drawSceneryP() …2661・drawStationViewP() …2676・drawStationView() …2678・weatherOnGlass() …2688・shade() …2695・rr() …2696・head() …2697・torso() …2699・drawStand() …2701・drawSeatLong() …2712・drawSeatCross() …2724・drawStandSprite() …2729・drawHeadSprite() …2732・drawPeople() …2735・levelSrc() …2746・drawLevels() …2747・drawDoorway() …2763・riderEvent() …2773・pickRider() …2775・drawPax() …2785・■ ドア上の案内表示（LED）：種別と、次の駅・お出口・乗り換え・接続などの案内を流す …2795・transferDirs() …2798・fasterConn() …2801・passWait() …2807・passAhead() …2809・ledSegs() …2811・drawLed() …2825・drawScene() …2836・■ 描画：ドア（開くと後ろにホームが見える） …2847・drawDoor() …2848・drawDoorGlass() …2861・■ 描画：車内の案内表示（枠は絵、画面の中は文字で描く） …2873・conn() …2874・monitorInfo() …2875・drawMonitor() …2880・■ 画面のまわり（混み具合・ボタン・状況） …2911・side() …2912・■ 確認表示：いまの区間・景色の混ざり具合・ホームを文字にする（描画と同じ関数から計算） …2930・debugInfo() …2932・laneOf() …2950・trainSize() …2953・trainScale() …2954・trainAt() …2957・platTrains() …2970・drawDoors() …2983・drawTrain() …2987・■ ホームで待つ人（仮の手描き。人数は waitingAt から） …2998・evOutfit() …2999・makePlatSlots() …3000・personStyle() …3006・drawPerson() …3012・crowdTarget() …3040・■ ホームの看板・時計・発車標 …3042・deps() …3043・tcol() …3046・drawClock() …3047・drawHangingBoard() …3052・neighbors() …3060・drawStationSign() …3062・■ ホームの描画とまわりの表示 …3071・platDraw() …3072・platInfo() …3093・trackLabel() …3100・drawLED() …3102・xferHTML() …3110・platSide() …3118・platSkip() …3129・setDir() …3131・toPlat() …3132・■ 入る・出る …3140・markSpd() …3141・enter() …3142・startRide() …3152・exit() …3157・doorSound() …3165・tick() …3168・alight() …3180・■ 沿線暦の画面：運行日・沿線だより・4つの見方・開発用の表示 …3196・ENSEN_UI …3198・load() …3202・persist() …3206・init() …3207・dayEnd() …3213・unread() …3217・renderBadge() …3218・srcLine() …3220・renderList() …3221・renderFilter() …3226・setOpen() …3228・renderDev() …3231・resetAll() …3247・renderCondExtra() …3250・renderEval() …3263・renderAll() …3273・mount() …3275・■ loop …3290・PERF …3292・PHONE …3302・drawGap() …3303・needDraw() …3305・frameDt() …3313・frame() …3314・■ 場面（コレクション）：data/scenes.json の場面を地図のピンにし、押すと小窓で開く …3323・SCENES …3324・scenePos() …3326・drawScenePins() …3328・openScene() …3334・■ いまの時刻と天気（日本時間・東京都立川市）につなぐ …3343・jstParts() …3345・liveT() …3346・WXK …3350・wxLog() …3352・holLog() …3353・fetchCal() …3354・liveCond() …3362・start() …3372

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

## js/kiosk-core.js（356行）

hash() …13・rng() …14・■ 下ごしらえ …21・index() …22・life() …24・shelfInfo() …26・defaultOrder() …31・■ 状態 …32・create() …33・■ 1日を動かす …39・simulate() …42・review() …262・■ 運行日を締める：評判・SNSの話題・常連・ブーム・在庫の持ちこし・知らせ …272・closeDay() …273・■ 移転：別の駅・場所へ移す（次の運行日から） …323・relocate() …328・migratePrices() …341・backAt() …346・stockAt() …347・idxAt() …348・soFar() …350・公開 KioskCore …354

## js/kiosk-staff.js（140行）

hash() …12・rng() …13・hoursOf() …19・dayPlan() …23・TYPES …28・traits() …36・moodWord() …38・person() …41・create() …50・assign() …59・autoShift() …72・migrate() …75・insuredOf() …81・weekHours() …83・today() …85・payOf() …97・adsOpen() …100・close() …103・公開 KioskStaff …137

## js/kiosk-view.js（934行）

STORDER …12・DAYN …22・■ 読み込み・保存 …29・persist() …39・■ その日の計算 …43・ctxNow() …44・linkNow() …50・supplyOf() …53・checkDay() …54・ensureRes() …57・tick() …61・closeToday() …62・orderFor() …74・nextOrderDay() …75・■ 川辺の配送センター（計算は js/center-core.js、設定は data/center.json） …76・center() …79・isAuto() …80・managed() …81・aimName() …82・loadOrders() …84・saveOrders() …85・arrivalToCenter() …87・salesToCenter() …88・planFor() …89・dailyOrder() …91・factoryReady() …101・slipTodo() …102・slipNow() …104・queueSlips() …105・makeSlip() …107・nextCond() …119・editOrder() …120・expressLeft() …124・expressOpen() …125・todayExpress() …129・openExpress() …131・pendingExpress() …132・addToExpress() …135・orderExpress() …138・addOnOk() …142・addOnNext() …143・addOnToday() …144・orderAddOn() …145・expressConfirm() …150・onDuty() …155・curSet() …156・edit() …157・■ 商品ごとの「いま」 …161・counts() …163・nextDelivery() …166・pinfo() …167・motText() …171・withText() …173・ST_LABEL …175・orderDiff() …178・orderText() …179・■ 骨組み …181・CSS …182・mount() …268・setMult() …283・badge() …284・readNews() …287・openFromBadge() …289・setOpen() …290・■ 開店前：場所を選ぶ …293・renderSetup() …294・■ 要注意：売り切れ・品出し待ち・残りわずか（押すと商品カード） …307・renderAlert() …308・openSheet() …319・closeSheet() …320・renderSheet() …321・updateSheet() …356・■ 画面全体 …360・render() …361・lifeLine() …371・renderKpi() …375・renderBody() …380・evText() …392・LF0 …405・KIND …408・lfMatch() …411・lfBar() …419・lfSummary() …438・lfCsv() …450・PAGE …459・renderLog() …460・flushLog() …478・centerBox() …486・slipLine() …497・flowLine() …502・■ 荷物の行方（アイデア帳 6.・2026-11-08）：注文番号ごとに、売上の記録 → 注文 → 製造 → 納品書 → 到着を時刻の順に。計算は js/track-core.js、時刻は data/center.json の flow・track …509・trkNow() …512・trkSplit() …513・trkEst() …515・trkRuns() …517・trkList() …524・renderTrack() …526・renderItems() …581・updateItems() …642・renderLayout() …647・basketStats() …661・renderPeople() …670・crewSave() …699・renderCrew() …700・renderMoney() …781・moveCard() …795・shrinkCard() …815・renderNews() …824・■ 売店の正面の絵 …827・BOX …828・zoneSlots() …829・rr() …830・drawItem() …831・drawKiosk() …841・personColor() …870・spawnFromEvent() …871・bubble() …876・stepPeople() …877・drawPerson() …886・draw() …891・onCanvasClick() …911・loop() …914・■ 起動 …919・公開 minatoKiosk …921

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

## js/top.js（201行）

KEY …10・KARTE …11・COUNTRY …12・■ イメージの絵（架空・説明用） …15・SVG_WORLD …16・SVG_JAPAN …23・SVG_CREW …31・■ きょうの沿線（2026-11-09）：島を並べて、それぞれの「きのうまでに確定した数字」を1枚に …54・SRC …63・loadToday() …66・svChange() …71・todayHtml() …75・paintToday() …108・go() …111・CSS …120・render() …169・open() …188・close() …189・公開 minatoTop …199

## js/track-core.js（81行）

fmt() …17・truck() …18・timeline() …26・phases() …43・where() …58・shelfTimes() …72・公開 TrackCore …78

## js/links/survey-to-kiosk.js（43行）

linkOf() …16・rateOf() …18・lineAges() …19・read() …21・yearFor() …38・公開 SurveyToKiosk …41
