# コードの目次（自動で作る：`node tools/codemap.cjs`）

ファイルごとに、区切りのコメント（■）と、関数・大事な定数の名前と行番号。本体を読む前にここを grep して、必要な行だけ開く。

## index.html（3355行）

■ 乗車体験（試作） …345・START …617・MAIN …630・ALL …631・treeKm() …635・SEGS …641・POP …643・TYPES …645・CLS …651・ROUTES …652・DEPOTNAME …657・CARKM …658・PURP …660・OFFICE …661・EVENT_DATA …668・■ 追加イベント（20件）。季節の行事は、季節設定に含まれる通常の観光客とは別の「その日だけの上乗せ」です …692・■ 追加イベント（12件） …758・EVMAP …804・ACTIVE_EV …805・evScale() …806・addEventDemand() …807・evDwell() …811・evWindow() …812・registerEvent() …813・ENS …820・ECO …821・NEWD …822・mb32() …823・ENS_PH …825・ensReset() …826・econSeries() …828・shockSchedule() …839・ensDayFactors() …852・ecoApply() …864・ensRefresh() …865・newFlowsBase() …867・newFlowsAfter() …871・■ 1日の記録（あとで便りの判定に使う。集計値だけを残す） …875・ensRecord() …876・■ 便りの判定：続いている傾向だけを候補にする …901・ensDetect() …902・■ 景気のうわさ（自動のときだけ）：段階が変わってから数日遅れで、場所ごとの変化として届く …929・ensEconNews() …930・■ 地域の小さな波の便り：予兆（予告の日）と振り返り（終わってから） …934・ensShockNews() …935・■ 1日の終わりにまとめて呼ぶ：記録→判定→便りを選ぶ。state は保存される（運行日・記録・便り・再送禁止） …942・ensFill() …943・ensMakeLetter() …944・ensEndDay() …950・COND_DEF …971・CONDS …972・COND …978・setCond() …979・rateParts() …987・ELAS …1019・computeService() …1020・demandTotals() …1038・rate() …1041・SPEND …1043・PROP …1044・runT() …1046・scheduleTrip() …1048・onSiding() …1096・buildAll() …1098・finishTrips() …1121・■ カスタムモード：1本ずつ筋を引いてダイヤを組む …1137・CUS_ST …1140・cusSeq() …1141・cusTrip() …1147・cusPlace() …1149・buildCustom() …1150・cusTry() …1154・cusBlocker() …1158・simulate() …1162・adv() …1172・makeEvents() …1216・eventImpacts() …1237・summarize() …1248・bsearch() …1270・■ state …1272・PRESETS …1274・PAT …1310・CUS …1313・cusSave() …1316・save() …1320・rebuild() …1321・■ theme …1330・readTheme() …1332・■ geometry …1339・unit() …1341・LANE_C …1349・stOff() …1350・bl() …1353・segPos() …1354・ease() …1361・tripState() …1362・DEPOT …1369・alongPath() …1370・setState() …1372・darkness() …1385・band() …1386・■ map drawing …1388・QFULL …1393・CDPR …1394・wantDpr() …1395・rng() …1396・BLOCKS …1397・TREES …1401・MAPBG …1403・drawTerrain() …1404・strokePts() …1429・RAIL …1430・PLATS …1432・drawTracks() …1435・drawTrainShape() …1466・VIS …1484・SMAP …1486・staticMap() …1487・drawMap() …1491・waitingAt() …1540・selSet() …1541・■ diagram …1543・diaGeom() …1545・drawDia() …1548・diaHit() …1587・■ panels …1591・curTrip() …1593・trainStatus() …1594・setWhere() …1601・strip() …1610・renderTrain() …1624・■ station timetable …1643・ttStation() …1647・renderTT() …1649・departures() …1672・renderStation() …1674・refreshPanels() …1684・■ purposes …1710・binsFor() …1713・upto() …1718・niceMax() …1719・barChart() …1720・renderPurpose() …1741・mixBar() …1766・psStation() …1770・■ conditions …1773・saveCond() …1774・renderEventChips() …1776・renderCondUI() …1778・renderImpact() …1788・■ OD & sections …1796・flHour() …1798・renderFlow() …1799・odSide() …1826・odBars() …1828・trainOD() …1830・■ 共通の交通スナップショット（地図・ヒートマップ・イベント詳細・将来の運行日誌/車窓モードで共用） …1836・SNAP …1837・trafficSnapshot() …1838・■ 地図レイヤー …1845・LAYERS …1846・EVHIT …1848・segLine() …1849・pillText() …1851・drawHeat() …1852・drawStationLayer() …1859・evPos() …1863・■ 地図の上の薄い雲：ふわっとした雲の絵を数種類作っておき、ゆっくり流す。地面に薄い影も落とす …1864・CLOUDSPR …1865・cloudDim() …1871・drawClouds() …1873・drawEventIcons() …1880・renderLegend() …1892・renderMapNote() …1901・■ イベントの詳細 …1907・EVST …1909・renderEvStrip() …1911・selectEvent() …1914・renderEvent() …1916・■ 環境音エンジン（独立。音を鳴らせない環境でもゲーム本体には影響しない） …1938・SND …1940・noiseBuffer() …1947・voice() …1953・build() …1963・clink() …1978・chirp() …1981・shots() …1984・applyConfig() …1994・loadConfig() …1996・prep() …2004・decode() …2010・srcOf() …2011・load() …2012・startLoop() …2016・passBy() …2020・onboard() …2027・trainRec() …2036・occasional() …2044・listenerPos() …2056・targets() …2063・apply() …2096・setMaster() …2100・tick() …2102・start() …2110・quiet() …2115・stop() …2118・wake() …2119・onPlay() …2121・setVol() …2122・setPart() …2123・updateUI() …2124・effect() …2137・preload() …2142・■ 拡張用の入口（開発者ツールのコンソールから使えます） …2154・公開 minatoDia …2155・■ score …2158・renderScore() …2159・■ editor …2183・carsFor() …2184・renderEditor() …2185・renderEditorCounts() …2198・■ カスタムモードの画面 …2209・renderMode() …2210・renderCustom() …2215・cusPreview() …2228・■ controls …2249・setPlay() …2251・markSeg() …2254・setSpeed() …2255・■ sizing …2278・resize() …2279・■ 乗車体験（試作）：客席から見た車内 …2285・RIDE …2288・kmOf() …2295・■ 素材の読み込み …2297・loadImg() …2298・load() …2299・buildStrips() …2309・■ 走り方（ダイヤから計算。地図の列車と同じ加減速の式 ease を使う） …2322・stopKin() …2323・kin() …2331・nextStop() …2340・■ 乗客（仮のシルエット）の席と立ち位置 …2343・seeded() …2344・makeSlots() …2345・targets() …2350・■ 描画：車内 …2353・fit() …2354・sceneryMix() …2356・duskW() …2363・variantsFor() …2364・drawScenery() …2369・drawStrip() …2371・drawSign() …2377・drawPlatform() …2384・drawWindow() …2392・windowContent() …2396・■ 窓から見える駅（通過・停車）：横から見たホームを、近くのものほど速く・大きく描く …2403・stationPeople() …2407・drawEkimeihyo() …2413・drawHanging() …2422・platNeighbors() …2428・personSprite() …2431・drawSprite() …2432・drawWaiter() …2434・personStyleS() …2475・stationLayer() …2480・■ 窓から見える駅を、車内の絵と同じ遠近法で描く（通路の奥＝消失点に向かって線が集まる） …2527・stationLayerP() …2530・drawCatenaryP() …2562・sceneryGL() …2578・drawSceneryP() …2622・drawStationViewP() …2637・drawStationView() …2639・weatherOnGlass() …2649・shade() …2656・rr() …2657・head() …2658・torso() …2660・drawStand() …2662・drawSeatLong() …2673・drawSeatCross() …2685・drawStandSprite() …2690・drawHeadSprite() …2693・drawPeople() …2696・levelSrc() …2707・drawLevels() …2708・drawDoorway() …2724・riderEvent() …2734・pickRider() …2736・drawPax() …2746・■ ドア上の案内表示（LED）：種別と、次の駅・お出口・乗り換え・接続などの案内を流す …2756・transferDirs() …2759・fasterConn() …2762・passWait() …2768・passAhead() …2770・ledSegs() …2772・drawLed() …2786・drawScene() …2797・■ 描画：ドア（開くと後ろにホームが見える） …2808・drawDoor() …2809・drawDoorGlass() …2822・■ 描画：車内の案内表示（枠は絵、画面の中は文字で描く） …2834・conn() …2835・monitorInfo() …2836・drawMonitor() …2841・■ 画面のまわり（混み具合・ボタン・状況） …2872・side() …2873・■ 確認表示：いまの区間・景色の混ざり具合・ホームを文字にする（描画と同じ関数から計算） …2891・debugInfo() …2893・laneOf() …2911・trainSize() …2914・trainScale() …2915・trainAt() …2918・platTrains() …2931・drawDoors() …2944・drawTrain() …2948・■ ホームで待つ人（仮の手描き。人数は waitingAt から） …2959・evOutfit() …2960・makePlatSlots() …2961・personStyle() …2967・drawPerson() …2973・crowdTarget() …3001・■ ホームの看板・時計・発車標 …3003・deps() …3004・tcol() …3007・drawClock() …3008・drawHangingBoard() …3013・neighbors() …3021・drawStationSign() …3023・■ ホームの描画とまわりの表示 …3032・platDraw() …3033・platInfo() …3054・trackLabel() …3061・drawLED() …3063・xferHTML() …3071・platSide() …3079・platSkip() …3090・setDir() …3092・toPlat() …3093・■ 入る・出る …3101・markSpd() …3102・enter() …3103・startRide() …3113・exit() …3118・doorSound() …3126・tick() …3129・alight() …3141・■ 沿線暦の画面：運行日・沿線だより・4つの見方・開発用の表示 …3157・ENSEN_UI …3159・load() …3163・persist() …3167・init() …3168・dayEnd() …3174・unread() …3178・renderBadge() …3179・srcLine() …3181・renderList() …3182・renderFilter() …3187・setOpen() …3189・renderDev() …3192・resetAll() …3208・renderCondExtra() …3211・renderEval() …3224・renderAll() …3234・mount() …3236・■ loop …3251・PERF …3253・PHONE …3263・drawGap() …3264・needDraw() …3266・frameDt() …3274・frame() …3275・■ 場面（コレクション）：data/scenes.json の場面を地図のピンにし、押すと小窓で開く …3284・SCENES …3285・scenePos() …3287・drawScenePins() …3289・openScene() …3295・■ いまの時刻と天気（日本時間・東京都立川市）につなぐ …3304・jstParts() …3306・liveT() …3307・WXK …3311・wxLog() …3313・holLog() …3314・fetchCal() …3315・liveCond() …3323・start() …3333

## js/away.js（98行）

KEY …15・load() …20・save() …21・hash() …25・ymdOf() …27・condFor() …30・catchUp() …38・■ 画面 …60・overlay() …61・show() …62・CSS …73・■ 起動 …82・公開 minatoAway …94

## js/bread-core.js（209行）

BS_LABEL …19・rng() …21・gauss() …22・hm() …23・fermRate() …27・waterFor() …31・orders() …33・split() …37・flow() …40・simulate() …43・add() …59・rankOf() …168・judge() …169・公開 BreadCore …207

## js/bread-view.js（351行）

KEY …13・SPEEDS …15・ST_COLOR …16・load() …18・save() …19・css() …20・tempColor() …23・rgb() …25・pColor() …27・■ 切り替え …30・buildTabs() …31・■ 夕方に決める …47・buildPlan() …48・■ 回す・再生 …91・run() …92・buildPlay() …100・markSpeed() …107・markPlay() …108・tick() …109・drawAll() …112・■ 4つの時計 …117・drawClocks() …118・■ 工程の絵 …129・TITLES …130・layout() …131・rr() …136・txt() …137・hit() …138・selRing() …139・frame() …140・person() …141・tub() …145・drawStage() …153・drawMix() …164・drawFerm() …171・drawBench() …176・drawShape() …186・drawProof() …196・drawOven() …211・drawCool() …226・drawPack() …233・■ 生地ごとの帯 …240・drawGantt() …241・■ 生地を一つ追いかける …255・drawBatch() …256・■ 記録 …293・drawEvents() …294・■ 朝の答え合わせ …298・showResult() …299・changes() …320・onClick() …324・legends() …326・buildHeroes() …331・init() …336

## js/center-core.js（98行）

storeKey() …20・orderNo() …21・genreOf() …22・genreCfg() …23・routeOf() …24・salesRecord() …28・condW() …37・segShare() …42・plan() …53・emptyLog() …82・dayOf() …83・putRecord() …84・putOrder() …86・trim() …92・recsOf() …93・公開 CenterCore …95

## js/donut-core.js（60行）

rng() …5・normalize() …6・simulate() …10・stage() …57・公開 DonutCore …58

## js/donut-view.js（104行）

save() …7・run() …8・plan() …9・COLS …18・colOf() …19・crewText() …21・recipes() …22・stations() …31・result() …37・draw() …44・drawStage() …52・init() …97・tick() …100

## js/factory-core.js（371行）

ST_LABEL …22・LN_LABEL …25・ROLES …27・rng() …29・gauss() …30・tau() …34・soakNeed() …36・mu() …38・lineCap() …42・washMin() …44・fillOrder() …46・fillOrders() …51・riceKind() …54・riceSeq() …56・actualOrder() …65・hm() …68・simulate() …70・addBatch() …83・fixDrift() …139・findLabel() …142・judge() …321・公開 FactoryCore …369

## js/factory-pl.js（99行）

KEY …11・load() …12・save() …13・defaults() …14・settings() …15・extraUnits() …16・apply() …18・suggestBatches() …24・compute() …28・■ 画面 …58・build() …63・changed() …80・show() …81・init() …93・公開 FactoryPL …96

## js/factory-view.js（536行）

KEY …12・SPEEDS …14・ST_COLOR …15・load() …17・save() …18・css() …19・tempColor() …20・rgb() …22・■ 夕方に決める …25・buildPlan() …26・clampInt() …74・■ 回す …76・run() …77・■ 再生 …87・buildPlay() …88・markSpeed() …96・markPlay() …97・tick() …98・BELT_MAX …107・madeAt() …109・resetBelt() …110・drawAll() …111・■ 4つの時計 …119・drawClocks() …120・■ 工程の絵 …134・layout() …135・TITLES …143・drawStage() …144・arrowHead() …169・boxFrame() …170・rr() …172・hit() …173・selRing() …174・txt() …175・germDot() …176・drawWash() …178・drawTanks() …188・drawPots() …206・drawCooler() …227・drawHold() …243・FILL_COLOR …256・STATIONS …257・ST_OF …258・nittaTag() …259・ROLE_COLOR …261・ROLE_HOME …262・person() …263・bubble() …267・inBreak() …270・visitsAt() …271・expiryText() …272・linePath() …274・drawForm() …279・drawLinePeople() …349・drawShip() …362・■ 釜ごとの帯 …381・drawGantt() …382・■ 釜を一つ追いかける …406・drawBatch() …407・■ 工場の記録 …452・drawEvents() …454・■ 朝の答え合わせ …459・showResult() …460・changes() …501・■ クリック …505・onStageClick() …506・legends() …511・init() …516・公開 FactoryRice …524

## js/kiosk-core.js（349行）

hash() …13・rng() …14・■ 下ごしらえ …21・index() …22・life() …24・shelfInfo() …26・defaultOrder() …31・■ 状態 …32・create() …33・■ 1日を動かす …39・simulate() …42・review() …255・■ 運行日を締める：評判・SNSの話題・常連・ブーム・在庫の持ちこし・知らせ …265・closeDay() …266・■ 移転：別の駅・場所へ移す（次の運行日から） …316・relocate() …321・migratePrices() …334・backAt() …339・stockAt() …340・idxAt() …341・soFar() …343・公開 KioskCore …347

## js/kiosk-staff.js（140行）

hash() …12・rng() …13・hoursOf() …19・dayPlan() …23・TYPES …28・traits() …36・moodWord() …38・person() …41・create() …50・assign() …59・autoShift() …72・migrate() …75・insuredOf() …81・weekHours() …83・today() …85・payOf() …97・adsOpen() …100・close() …103・公開 KioskStaff …137

## js/kiosk-view.js（796行）

STORDER …12・DAYN …22・■ 読み込み・保存 …29・persist() …35・■ その日の計算 …39・ctxNow() …40・checkDay() …44・ensureRes() …47・tick() …51・closeToday() …52・orderFor() …64・nextOrderDay() …65・■ 川辺の配送センター（計算は js/center-core.js、設定は data/center.json） …66・center() …69・isAuto() …70・managed() …71・aimName() …72・loadOrders() …74・saveOrders() …75・salesToCenter() …76・planFor() …77・dailyOrder() …79・nextCond() …87・editOrder() …88・expressLeft() …92・expressOpen() …93・todayExpress() …97・openExpress() …99・pendingExpress() …100・addToExpress() …103・orderExpress() …106・addOnOk() …110・addOnNext() …111・addOnToday() …112・orderAddOn() …113・expressConfirm() …118・onDuty() …123・curSet() …124・edit() …125・■ 商品ごとの「いま」 …129・counts() …131・nextDelivery() …134・pinfo() …135・motText() …139・withText() …141・ST_LABEL …143・orderDiff() …146・orderText() …147・■ 骨組み …149・CSS …150・mount() …226・setMult() …241・badge() …242・readNews() …245・openFromBadge() …247・setOpen() …248・■ 開店前：場所を選ぶ …251・renderSetup() …252・■ 要注意：売り切れ・品出し待ち・残りわずか（押すと商品カード） …265・renderAlert() …266・openSheet() …277・closeSheet() …278・renderSheet() …279・updateSheet() …314・■ 画面全体 …318・render() …319・renderKpi() …328・renderBody() …333・evText() …345・LF0 …358・KIND …361・lfMatch() …364・lfBar() …372・lfSummary() …391・lfCsv() …403・PAGE …412・renderLog() …413・flushLog() …431・centerBox() …439・renderItems() …449・updateItems() …510・renderLayout() …515・basketStats() …529・renderPeople() …538・crewSave() …567・renderCrew() …568・renderMoney() …649・moveCard() …663・shrinkCard() …683・renderNews() …692・■ 売店の正面の絵 …695・BOX …696・zoneSlots() …697・rr() …698・drawItem() …699・drawKiosk() …709・personColor() …738・spawnFromEvent() …739・bubble() …744・stepPeople() …745・drawPerson() …754・draw() …759・onCanvasClick() …779・loop() …782・■ 起動 …787・公開 minatoKiosk …789

## js/research-core.js（166行）

hash() …12・rng() …13・■ 場所を通る人（目的×時間） …20・footfall() …21・dwellOf() …28・ageMix() …31・emoneyP() …32・■ 調査1日分 …34・dayRecord() …36・soFar() …69・■ 集計：レポート …71・DAYK …72・aggregate() …73・■ 試算：業態ごとの売上と費用 …100・estimate() …102・erf() …162・公開 ResearchCore …164

## js/research-view.js（388行）

STORDER …12・DAYN …22・PCOL …23・■ 保存 …28・blank() …29・load() …30・persist() …34・■ その日の材料（終わった日の分を記録するため、日が進む前に覚えておく） …38・ctxFor() …39・tick() …43・addRecord() …49・startStudy() …52・stopStudy() …55・■ 骨組み …57・CSS …58・mount() …110・markM() …130・badge() …131・setOpen() …132・setMult() …133・■ 調査の計画 …135・renderPlan() …136・■ レポート …159・bars() …160・toKiosk() …162・renderReport() …166・renderEst() …203・render() …233・■ 映像 …237・scenePlace() …238・provisional() …239・platEvents() …241・loop() …254・COATS …257・rr() …259・sky() …260・person() …262・draw() …270・■ ホーム：このホームに着く列車（のりばが複数ある駅は、交互にこのホームへ着くものとする） …292・■ 起動 …382・公開 minatoResearch …384

## js/route-core.js（172行）

uid() …17・emptyDoc() …19・normalize() …22・■ 形（制御点の並び → 細かい折れ線） …37・ctrlOf() …38・bez() …40・bezPt() …42・flatten() …44・edgeFlat() …50・polyLen() …51・edgeLen() …52・■ 近いものをさがす …54・segNear() …55・nearestNode() …57・nearestEdge() …58・■ 点と道をいじる …63・addNode() …64・addEdge() …65・splitEdge() …67・anchor() …75・segX() …79・makeCrossings() …84・addPath() …99・edgesOf() …109・stopsOn() …110・dropOrphan() …111・deleteStop() …112・deleteNode() …113・deleteEdge() …115・mergeNodes() …117・detachNode() …123・insertBend() …127・■ いちばん近い道（ダイクストラ） …129・adjacency() …130・shortest() …132・linePath() …139・lineType() …143・lineStyle() …144・lineLanes() …146・■ 運行（第2段で使う） …151・tripsPerDay() …153・exportDoc() …156・simplify() …161・API …168

## js/route-editor.js（457行）

KEY …9・FONTS …10・FONTN …11・SHAPES …12・DASHN …13・DEF …15・MAP …19・■ 保存・元に戻す …22・save() …23・commit() …24・revert() …25・undo() …26・redo() …27・fixSel() …28・■ 見る位置 …34・fit() …36・zoomAt() …38・resize() …39・■ 線の描き方 …41・dashOf() …42・strokeStyled() …45・shapePath() …57・drawMarker() …65・LPV …73・autoLP() …74・labelBox() …78・drawLabel() …79・■ 路線の形（同じ道は並べてずらす） …87・offsetPoly() …88・linesGeom() …90・■ 背景：机・地図の絵・線路と駅 …104・drawTable() …105・drawSheet() …109・drawRail() …113・■ 全体を描く（画面とPNGで共通） …122・drawScene() …123・frame() …157・■ 当たり判定 …159・hitStop() …161・hitHandle() …164・■ 指・マウス …166・pos() …168・endPointer() …196・dbl() …211・hoverCursor() …219・tapPen() …221・tapPoly() …222・endPoly() …226・tapStop() …227・newLine() …230・tapLine() …232・■ キー …238・delSel() …251・■ 見本の小さな絵 …253・swatch() …254・■ 画面の部品 …261・chip() …264・setTool() …265・focusName() …267・ui() …269・dots() …272・typeRow() …274・dock() …279・■ 路線の帳面 …305・showLines() …306・lineList() …309・lineEditor() …316・■ 見た目の小窓 …348・closePops() …349・openStyle() …350・renderStyle() …351・■ メニュー …392・download() …402・exportJSON() …404・bounds() …407・savePNG() …408・■ 例（メニューの「例を描いてみる」。元に戻すで消せる） …413・example() …414・■ はじめ …445・init() …446・公開 __routeEditor …454

## js/sand-core.js（283行）

ING …22・rng() …23・gauss() …24・hm() …25・YEN_SEASON …27・■ 規格：原材料からアレルゲンを集める …29・kindOf() …31・kindAllergen() …32・productKinds() …33・productParts() …34・productAllergen() …35・spec() …38・washLeft() …41・washMin() …42・expiryAt() …44・orders() …46・safeMin() …49・waterLeft() …50・beltRate() …52・ownBread() …55・sandFor() …56・simulate() …58・■ くじ（条件を変えても、同じ時刻に同じくじ） …76・■ 品質確認の人：仕事の列（初品確認 → 冷却・配合・洗浄 → 保留の評価） …82・■ 具材の在庫と仕込み …86・■ 組み立て …100・■ 品質確認の人 …141・■ 仕込み …145・■ 組み立て …167・■ 締め → カット（1組を2切れ）。保留の分は評価を待つ …212・■ 三角パックに詰める（人）：いちばん前から待っている切れの品から …217・■ 記録 …235・■ 朝の答え合わせ …246・公開 SandCore …281

## js/sand-loaf.js（124行）

LS_LABEL …17・hm() …18・fermRate() …21・slicesPer() …23・loavesFor() …25・flow() …27・coolOf() …29・coolMin() …30・create() …32・judge() …51・step() …60・confirm() …98・take() …105・snap() …108・summary() …112・公開 SandLoaf …122

## js/sand-view.js（393行）

KEY …14・SPEEDS …16・load() …17・save() …18・css() …19・tempColor() …24・rgb() …26・■ 夕方に決める …28・buildPlan() …29・■ 回す・再生 …102・run() …103・buildPlay() …107・markSpeed() …111・markPlay() …112・tick() …113・drawAll() …115・■ 4つの時計 …120・QC_TEXT …121・JAM_TEXT …122・codeText() …123・codeText0() …125・drawClocks() …126・loafClock() …136・■ 工程の絵 …140・TITLES …141・layout() …142・rr() …146・txt() …147・frame() …148・person() …149・bar() …150・drawStage() …152・loafPan() …162・drawLoaf() …163・slot() …199・drawEgg() …202・drawLettuce() …220・drawKatsu() …229・drawFruit() …237・drawFridge() …246・lastProd() …251・drawLine() …252・drawShime() …277・drawPack() …280・■ トレーの温度のグラフ …289・drawTray() …290・■ 持ち場ごとの帯 …306・drawGantt() …307・■ 記録 …326・drawEvents() …327・■ 朝の答え合わせ …330・showResult() …331・loafResult() …359・■ 商品規格（原材料・アレルゲン） …363・buildSpec() …364・changes() …371・setActive() …375・init() …376

## js/save.js（120行）

SLOTS …11・collect() …17・restore() …18・summary() …20・encode() …29・decode() …32・■ 画面 …46・CSS …47・mount() …64・msg() …95・copy() …96・open() …98・renderSlots() …99・alertIn() …104・make() …105・check() …108・showConfirm() …109・apply() …110・fromHash() …115・公開 minatoSave …118

## js/survey-core.js（62行）

seedOf() …8・rng() …9・curve() …12・score() …20・trueShares() …30・years() …35・wave() …41・total() …55・公開 SurveyCore …60

## js/survey-view.js（120行）

COLS …6・W() …11・TOT() …12・■ 吹き出し …19・showTip() …21・hideTip() …22・bindTips() …23・■ 年と質問 …25・setYear() …26・buildTop() …27・stop() …34・■ 駅ごとにくらべる …36・refAt() …37・renderRows() …38・■ うつりかわり（小さなグラフを駅の数だけ） …62・renderMini() …63・■ 年代でくらべる …87・renderAges() …88・■ 読みとりメモ（その年の結果から、目立つところを文にする） …94・renderHint() …95・render() …108・■ 読み込み …110

## js/top.js（112行）

KEY …10・KARTE …11・COUNTRY …12・■ イメージの絵（架空・説明用） …15・SVG_WORLD …16・SVG_JAPAN …23・SVG_CREW …31・go() …53・CSS …62・render() …85・open() …99・close() …100・公開 minatoTop …110
