# コードの目次（自動で作る：`node tools/codemap.cjs`）

ファイルごとに、区切りのコメント（■）と、関数・大事な定数の名前と行番号。本体を読む前にここを grep して、必要な行だけ開く。

## index.html（3491行）

■ 乗車体験（試作） …369・START …662・MAIN …675・ALL …676・treeKm() …680・SEGS …686・POP …688・TYPES …690・CLS …696・ROUTES …697・DEPOTNAME …702・CARKM …703・PURP …705・OFFICE …706・EVENT_DATA …713・■ 追加イベント（20件）。季節の行事は、季節設定に含まれる通常の観光客とは別の「その日だけの上乗せ」です …737・■ 追加イベント（12件） …803・EVMAP …849・ACTIVE_EV …850・evScale() …851・addEventDemand() …852・evDwell() …856・evWindow() …857・registerEvent() …858・ENS …865・ECO …866・NEWD …867・mb32() …868・ENS_PH …870・ensReset() …871・econSeries() …873・shockSchedule() …884・ensDayFactors() …897・ecoApply() …909・ensRefresh() …910・■ 季節のできごと（計算は js/season-core.js、設定は data/seasonal.json と data/seasonal-extra.json） …911・SEAS …914・seasDayI() …915・seasRefresh() …916・seasApply() …923・seasKioskGenre() …925・newFlowsBase() …927・newFlowsAfter() …931・■ 1日の記録（あとで便りの判定に使う。集計値だけを残す） …935・ensRecord() …936・■ 便りの判定：続いている傾向だけを候補にする …961・ensDetect() …962・■ 景気のうわさ（自動のときだけ）：段階が変わってから数日遅れで、場所ごとの変化として届く …989・ensEconNews() …990・■ 地域の小さな波の便り：予兆（予告の日）と振り返り（終わってから） …994・ensShockNews() …995・■ 1日の終わりにまとめて呼ぶ：記録→判定→便りを選ぶ。state は保存される（運行日・記録・便り・再送禁止） …1002・ensFill() …1003・ensMakeLetter() …1004・ensEndDay() …1010・COND_DEF …1031・CONDS …1032・COND …1038・setCond() …1039・rateParts() …1047・ELAS …1080・computeService() …1081・demandTotals() …1099・rate() …1102・SPEND …1104・PROP …1105・runT() …1107・scheduleTrip() …1109・onSiding() …1157・buildAll() …1159・finishTrips() …1182・■ カスタムモード：1本ずつ筋を引いてダイヤを組む …1198・CUS_ST …1201・cusSeq() …1202・cusTrip() …1208・cusPlace() …1210・buildCustom() …1211・cusTry() …1215・cusBlocker() …1219・simulate() …1223・adv() …1233・makeEvents() …1277・eventImpacts() …1298・summarize() …1309・bsearch() …1332・■ state …1334・PRESETS …1336・PAT …1372・CUS …1375・cusSave() …1378・save() …1384・rebuild() …1385・■ theme …1394・readTheme() …1396・■ geometry …1403・unit() …1405・LANE_C …1413・stOff() …1414・bl() …1417・segPos() …1418・ease() …1425・tripState() …1426・DEPOT …1433・alongPath() …1434・setState() …1436・darkness() …1449・band() …1450・■ map drawing …1452・QFULL …1457・CDPR …1458・wantDpr() …1459・rng() …1460・BLOCKS …1461・TREES …1465・MAPBG …1467・drawTerrain() …1468・strokePts() …1493・RAIL …1494・PLATS …1496・drawTracks() …1499・drawTrainShape() …1530・VIS …1548・SMAP …1550・staticMap() …1551・drawMap() …1555・waitingAt() …1604・selSet() …1605・■ diagram …1607・diaGeom() …1609・drawDia() …1612・DIAW …1654・drawDiaLoad() …1656・setDiaW() …1670・markDiaW() …1671・diaHit() …1672・■ panels …1676・curTrip() …1678・trainStatus() …1679・setWhere() …1686・strip() …1695・renderTrain() …1709・■ station timetable …1728・ttStation() …1732・renderTT() …1734・departures() …1757・renderStation() …1759・PANE …1770・setPane() …1771・refreshPanels() …1776・■ purposes …1802・binsFor() …1805・upto() …1810・niceMax() …1811・barChart() …1812・renderPurpose() …1833・mixBar() …1858・psStation() …1862・■ conditions …1865・saveCond() …1866・renderEventChips() …1868・renderCondUI() …1870・renderImpact() …1880・■ OD & sections …1888・flHour() …1890・renderFlow() …1891・odSide() …1918・odBars() …1920・trainOD() …1922・■ 共通の交通スナップショット（地図・ヒートマップ・イベント詳細・将来の運行日誌/車窓モードで共用） …1928・SNAP …1929・trafficSnapshot() …1930・■ 地図レイヤー …1937・LAYERS …1938・EVHIT …1940・segLine() …1941・pillText() …1943・drawHeat() …1944・drawStationLayer() …1951・evPos() …1955・■ 地図の上の薄い雲：ふわっとした雲の絵を数種類作っておき、ゆっくり流す。地面に薄い影も落とす …1956・CLOUDSPR …1957・cloudDim() …1963・drawClouds() …1965・drawEventIcons() …1972・renderLegend() …1984・renderMapNote() …1993・■ イベントの詳細 …1999・EVST …2001・renderEvStrip() …2003・selectEvent() …2006・renderEvent() …2008・■ 環境音エンジン（独立。音を鳴らせない環境でもゲーム本体には影響しない） …2030・SND …2032・noiseBuffer() …2039・voice() …2045・build() …2055・clink() …2070・chirp() …2073・shots() …2076・applyConfig() …2086・loadConfig() …2088・prep() …2096・decode() …2102・srcOf() …2103・load() …2104・startLoop() …2108・passBy() …2112・onboard() …2119・trainRec() …2128・occasional() …2136・listenerPos() …2148・targets() …2155・apply() …2188・setMaster() …2192・tick() …2194・start() …2202・quiet() …2207・stop() …2210・wake() …2211・onPlay() …2213・setVol() …2214・setPart() …2215・updateUI() …2216・effect() …2229・preload() …2234・■ 拡張用の入口（開発者ツールのコンソールから使えます） …2246・公開 minatoDia …2247・■ score …2250・renderScore() …2251・■ editor …2275・carsFor() …2276・renderEditor() …2277・renderEditorCounts() …2290・■ カスタムモードの画面 …2301・renderMode() …2302・renderCustom() …2307・cusPreview() …2320・■ controls …2341・setPlay() …2343・markSeg() …2346・setSpeed() …2347・markSpeed() …2348・liveTf() …2351・leaveLive() …2353・■ sizing …2381・resize() …2382・■ 乗車体験（試作）：客席から見た車内 …2388・RIDE …2391・kmOf() …2398・■ 素材の読み込み …2400・loadImg() …2401・load() …2402・buildStrips() …2412・■ 走り方（ダイヤから計算。地図の列車と同じ加減速の式 ease を使う） …2425・stopKin() …2426・kin() …2434・nextStop() …2443・■ 乗客（仮のシルエット）の席と立ち位置 …2446・seeded() …2447・makeSlots() …2448・targets() …2453・■ 描画：車内 …2456・fit() …2457・sceneryMix() …2459・duskW() …2466・variantsFor() …2467・drawScenery() …2472・drawStrip() …2474・drawSign() …2480・drawPlatform() …2487・drawWindow() …2495・windowContent() …2499・■ 窓から見える駅（通過・停車）：横から見たホームを、近くのものほど速く・大きく描く …2506・stationPeople() …2510・drawEkimeihyo() …2516・drawHanging() …2525・platNeighbors() …2531・personSprite() …2534・drawSprite() …2535・drawWaiter() …2537・personStyleS() …2578・stationLayer() …2583・■ 窓から見える駅を、車内の絵と同じ遠近法で描く（通路の奥＝消失点に向かって線が集まる） …2630・stationLayerP() …2633・drawCatenaryP() …2665・sceneryGL() …2681・drawSceneryP() …2725・drawStationViewP() …2740・drawStationView() …2742・weatherOnGlass() …2752・shade() …2759・rr() …2760・head() …2761・torso() …2763・drawStand() …2765・drawSeatLong() …2776・drawSeatCross() …2788・drawStandSprite() …2793・drawHeadSprite() …2796・drawPeople() …2799・levelSrc() …2810・drawLevels() …2811・drawDoorway() …2827・riderEvent() …2837・pickRider() …2839・drawPax() …2849・■ ドア上の案内表示（LED）：種別と、次の駅・お出口・乗り換え・接続などの案内を流す …2859・transferDirs() …2862・fasterConn() …2865・passWait() …2871・passAhead() …2873・ledSegs() …2875・drawLed() …2889・drawScene() …2900・■ 描画：ドア（開くと後ろにホームが見える） …2911・drawDoor() …2912・drawDoorGlass() …2925・■ 描画：車内の案内表示（枠は絵、画面の中は文字で描く） …2937・conn() …2938・monitorInfo() …2939・drawMonitor() …2944・■ 画面のまわり（混み具合・ボタン・状況） …2975・side() …2976・■ 確認表示：いまの区間・景色の混ざり具合・ホームを文字にする（描画と同じ関数から計算） …2994・debugInfo() …2996・laneOf() …3014・trainSize() …3017・trainScale() …3018・trainAt() …3021・platTrains() …3034・drawDoors() …3047・drawTrain() …3051・■ ホームで待つ人（仮の手描き。人数は waitingAt から） …3062・evOutfit() …3063・makePlatSlots() …3064・personStyle() …3070・drawPerson() …3076・crowdTarget() …3104・■ ホームの看板・時計・発車標 …3106・deps() …3107・tcol() …3110・drawClock() …3111・drawHangingBoard() …3116・neighbors() …3124・drawStationSign() …3126・■ ホームの描画とまわりの表示 …3135・platDraw() …3136・platInfo() …3157・trackLabel() …3164・drawLED() …3166・xferHTML() …3174・platSide() …3182・platSkip() …3193・setDir() …3195・toPlat() …3196・■ 入る・出る …3204・markSpd() …3205・enter() …3206・startRide() …3216・exit() …3221・doorSound() …3229・tick() …3232・alight() …3244・■ 沿線暦の画面：運行日・沿線だより・4つの見方・開発用の表示 …3260・ENSEN_UI …3262・load() …3266・persist() …3270・init() …3271・dayEnd() …3279・seasLetters() …3284・unread() …3289・renderBadge() …3290・srcLine() …3292・renderList() …3293・renderFilter() …3298・setOpen() …3300・renderDev() …3303・resetAll() …3320・renderCondExtra() …3323・renderEval() …3336・renderAll() …3346・mount() …3348・■ loop …3363・PERF …3365・PHONE …3375・drawGap() …3376・needDraw() …3378・frameDt() …3386・frame() …3387・■ 場面（コレクション）：data/scenes.json の場面を地図のピンにし、押すと小窓で開く …3396・SCENES …3397・scenePos() …3399・drawScenePins() …3401・openScene() …3407・■ いまの時刻と天気（日本時間・東京都立川市）につなぐ …3416・jstParts() …3418・liveT() …3419・WXK …3423・wxLog() …3425・holLog() …3426・fetchCal() …3427・liveCond() …3435・start() …3445

## js/away.js（102行）

KEY …15・load() …20・save() …21・hash() …25・ymdOf() …27・condFor() …30・catchUp() …40・■ 画面 …64・overlay() …65・show() …66・CSS …77・■ 起動 …86・公開 minatoAway …98

## js/bento-core.js（69行）

rng() …9・normalize() …10・simulate() …15・stage() …65・公開 BentoCore …66

## js/bento-view.js（92行）

liveNote() …9・save() …10・run() …11・plan() …15・recipes() …22・COLS …29・colOf() …30・stations() …32・result() …38・draw() …44・drawStage() …51・init() …84・tick() …88

## js/bread-core.js（213行）

BS_LABEL …19・rng() …21・gauss() …22・hm() …23・fermRate() …27・waterFor() …31・centerPart() …33・orders() …35・split() …39・flow() …42・simulate() …45・add() …62・rankOf() …172・judge() …173・公開 BreadCore …211

## js/bread-view.js（358行）

KEY …13・SPEEDS …15・liveNote() …18・ST_COLOR …19・load() …21・save() …22・css() …23・tempColor() …26・rgb() …28・pColor() …30・■ 切り替え …33・buildTabs() …34・■ 夕方に決める …50・buildPlan() …51・■ 回す・再生 …94・run() …95・buildPlay() …103・markSpeed() …110・markPlay() …111・tick() …112・drawAll() …116・■ 4つの時計 …121・drawClocks() …122・■ 工程の絵 …133・TITLES …134・layout() …135・rr() …140・txt() …141・hit() …142・selRing() …143・frame() …144・person() …145・tub() …149・drawStage() …157・drawMix() …168・drawFerm() …175・drawBench() …180・drawShape() …190・drawProof() …201・drawOven() …217・drawCool() …233・drawPack() …240・■ 生地ごとの帯 …247・drawGantt() …248・■ 生地を一つ追いかける …262・drawBatch() …263・■ 記録 …300・drawEvents() …301・■ 朝の答え合わせ …305・showResult() …306・changes() …327・onClick() …331・legends() …333・buildHeroes() …338・init() …343

## js/center-core.js（268行）

storeKey() …23・orderNo() …24・genreOf() …25・genreCfg() …26・routeOf() …27・salesRecord() …32・cutOf() …44・preRecord() …45・shareBefore() …55・condW() …59・segShare() …64・plan() …75・factoryQty() …111・emptyLog() …120・dayOf() …121・putRecord() …122・putOrder() …124・trim() …131・recsOf() …132・supplyFor() …135・cart() …145・runOrder() …164・allocate() …174・supplyOrdFor() …182・truckFor() …184・csNew() …193・centerPids() …194・csDemand() …196・nextOrderDay() …204・onOrder() …205・wsQty() …207・csOpen() …211・centerOut() …223・csClose() …226・csOutlook() …232・hashS() …247・truckRuns() …248・flowOf() …252・arrival() …256・putArrival() …263・公開 CenterCore …265

## js/center-view.js（96行）

ST_NAME …14・CSS …16・dayLabel() …51・render() …52・open() …89・close() …90・公開 minatoCenter …94

## js/donut-core.js（64行）

rng() …5・normalize() …6・simulate() …10・stage() …61・公開 DonutCore …62

## js/donut-view.js（107行）

liveNote() …7・save() …9・run() …10・plan() …11・COLS …20・colOf() …21・crewText() …23・recipes() …24・stations() …33・result() …39・draw() …46・drawStage() …54・init() …99・tick() …102

## js/factory-core.js（375行）

ST_LABEL …22・LN_LABEL …25・ROLES …27・rng() …29・gauss() …30・tau() …34・soakNeed() …36・mu() …38・lineCap() …42・washMin() …44・fillOrder() …46・centerPart() …51・fillOrders() …53・riceKind() …56・riceSeq() …58・actualOrder() …67・hm() …70・simulate() …72・addBatch() …86・fixDrift() …142・findLabel() …145・judge() …325・公開 FactoryCore …373

## js/factory-live.js（32行）

nowT() …12・sec() …14・SPEEDS …15・liveAt() …17・note() …19・puffs() …26・bubbles() …28・公開 FactoryLive …30

## js/factory-night.js（86行）

LINES …13・kioskMap() …21・seasonOf() …23・seedOf() …25・latest() …27・splitItems() …29・cfgsFrom() …31・runNight() …34・centerShip() …46・share() …48・truckOf() …52・lateRule() …59・slip() …66・readLog() …78・withCenter() …79・centerNote() …80・公開 FactoryNight …83

## js/factory-pl.js（104行）

KEY …11・load() …12・save() …13・defaults() …14・settings() …15・extraUnits() …16・apply() …18・suggestBatches() …24・compute() …28・■ 画面 …63・build() …68・changed() …85・show() …86・init() …98・公開 FactoryPL …101

## js/factory-view.js（544行）

KEY …12・SPEEDS …14・liveNote() …17・ST_COLOR …18・load() …20・save() …21・css() …22・tempColor() …23・rgb() …25・■ 夕方に決める …28・buildPlan() …29・clampInt() …77・■ 回す …79・run() …80・■ 再生 …90・buildPlay() …91・markSpeed() …99・markPlay() …100・tick() …101・BELT_MAX …113・madeAt() …115・resetBelt() …116・drawAll() …117・■ 4つの時計 …125・drawClocks() …126・■ 工程の絵 …140・layout() …141・TITLES …149・drawStage() …150・arrowHead() …175・boxFrame() …176・rr() …178・hit() …179・selRing() …180・txt() …181・germDot() …182・drawWash() …184・drawTanks() …194・drawPots() …212・drawCooler() …233・drawHold() …249・FILL_COLOR …262・STATIONS …263・ST_OF …264・nittaTag() …265・ROLE_COLOR …267・ROLE_HOME …268・person() …269・bubble() …273・inBreak() …276・visitsAt() …277・expiryText() …278・linePath() …280・drawForm() …285・drawLinePeople() …357・drawShip() …370・■ 釜ごとの帯 …389・drawGantt() …390・■ 釜を一つ追いかける …414・drawBatch() …415・■ 工場の記録 …460・drawEvents() …462・■ 朝の答え合わせ …467・showResult() …468・changes() …509・■ クリック …513・onStageClick() …514・legends() …519・init() …524・公開 FactoryRice …532

## js/haiso-core.js（62行）

dayPlan() …15・公開 HaisoCore …60

## js/haiso-view.js（78行）

CSS …17・render() …44・bindDays() …68・open() …69・close() …70・summary() …72・公開 minatoHaiso …76

## js/kiosk-core.js（377行）

hash() …13・rng() …14・■ 下ごしらえ …21・index() …22・life() …24・shelfInfo() …26・defaultOrder() …31・■ 状態 …32・create() …33・■ 1日を動かす …39・simulate() …42・review() …283・■ 運行日を締める：評判・SNSの話題・常連・ブーム・在庫の持ちこし・知らせ …293・closeDay() …294・■ 移転：別の駅・場所へ移す（次の運行日から） …344・relocate() …349・migratePrices() …362・backAt() …367・stockAt() …368・idxAt() …369・soFar() …371・公開 KioskCore …375

## js/kiosk-staff.js（140行）

hash() …12・rng() …13・hoursOf() …19・dayPlan() …23・TYPES …28・traits() …36・moodWord() …38・person() …41・create() …50・assign() …59・autoShift() …72・migrate() …75・insuredOf() …81・weekHours() …83・today() …85・payOf() …97・adsOpen() …100・close() …103・公開 KioskStaff …137

## js/kiosk-view.js（1003行）

STORDER …12・DAYN …22・MSV …29・■ 読み込み・保存 …31・persist() …41・■ その日の計算 …45・ctxNow() …46・linkNow() …54・supplyOf() …57・slipWait() …59・truckOf() …60・cartOf() …62・supplyOrdOf() …67・checkDay() …68・ensureRes() …71・tick() …75・closeToday() …76・orderFor() …88・nextOrderDay() …89・■ 川辺の配送センター（計算は js/center-core.js、設定は data/center.json） …90・center() …93・isAuto() …94・managed() …95・aimName() …96・loadOrders() …98・CSKEY …100・loadMoney() …103・moneyOf() …104・moneyClose() …110・loadCS() …111・saveCS() …112・csCtx() …113・csOpenToday() …115・cstockOf() …118・saveOrders() …119・arrivalToCenter() …121・salesToCenter() …122・planFor() …123・dailyOrder() …125・factoryReady() …140・slipTodo() …141・slipNow() …143・queueSlips() …144・makeSlip() …146・nextCond() …161・editOrder() …162・expressLeft() …166・expressOpen() …167・todayExpress() …171・openExpress() …173・pendingExpress() …174・addToExpress() …177・orderExpress() …180・addOnOk() …184・addOnNext() …185・addOnToday() …186・orderAddOn() …187・expressConfirm() …192・onDuty() …197・curSet() …198・edit() …199・■ 商品ごとの「いま」 …203・counts() …205・nextDelivery() …208・pinfo() …209・motText() …213・withText() …215・ST_LABEL …217・orderDiff() …220・orderText() …221・■ 骨組み …223・CSS …224・mount() …310・setMult() …325・badge() …326・readNews() …329・openFromBadge() …331・setOpen() …332・■ 開店前：場所を選ぶ …335・renderSetup() …336・■ 要注意：売り切れ・品出し待ち・残りわずか（押すと商品カード） …349・renderAlert() …350・openSheet() …361・closeSheet() …362・renderSheet() …363・updateSheet() …398・■ 画面全体 …402・render() …403・renderWhich() …415・lifeLine() …420・renderKpi() …424・renderBody() …429・evText() …441・LF0 …454・KIND …457・lfMatch() …460・lfBar() …468・lfSummary() …487・lfCsv() …499・PAGE …508・renderLog() …509・flushLog() …527・centerBox() …535・slipLine() …546・flowLine() …551・■ 荷物の行方（アイデア帳 6.・2026-11-08）：注文番号ごとに、売上の記録 → 注文 → 製造 → 納品書 → 到着を時刻の順に。計算は js/track-core.js、時刻は data/center.json の flow・track …558・trkNow() …561・trkSplit() …562・trkEst() …564・trkRuns() …566・trkRuns0() …567・trkList() …574・renderTrack() …576・renderItems() …631・updateItems() …692・renderLayout() …697・basketStats() …711・renderPeople() …720・crewSave() …749・renderCrew() …750・renderMoney() …831・moveCard() …845・shrinkCard() …865・renderNews() …874・■ 売店の正面の絵 …877・BOX …878・zoneSlots() …879・rr() …880・drawItem() …881・drawKiosk() …891・personColor() …920・spawnFromEvent() …921・bubble() …926・stepPeople() …927・drawPerson() …936・draw() …941・onCanvasClick() …962・loop() …965・■ 起動 …970・公開 minatoKiosk …972

## js/kiosk-walk.js（85行）

begin() …15・visitors() …20・plan() …33・commit() …43・after() …57・公開 KioskWalk …83

## js/minato-store-anim.js（141行）

■ 見取り図（キャンバスの座標） …10・MAP …12・SPEED …30・STOP_ORDER …31・standOf() …33・placeIndex() …44・route() …46・legs() …50・PRE …59・build() …62・along() …99・qSlot() …103・at() …105・clerks() …122・bubbles() …130・公開 MinatoAnim …139

## js/minato-store-core.js（37行）

KEY …12・cfg() …15・create() …33・公開 MinatoStore …35

## js/minato-store-view.js（209行）

DAYN …21・■ 読み込み・保存 …25・persist() …29・■ その日の計算 …32・ctxNow() …33・localNow() …39・checkDay() …41・ensureRes() …44・closeToday() …48・tick() …51・■ 店を出す …54・openStore() …55・■ 売店の画面の上の欄 …60・PSN …61・render() …62・panel() …79・localLine() …89・■ 絵：小さな絵を作っておく …95・mk() …97・LOOK …98・fig() …102・sprite() …118・box() …121・label() …122・bg() …123・DISP …166・shelfLayer() …167・■ 絵：毎コマ …181・bubble() …182・view() …183・draw() …184・click() …203・公開 MinatoStoreView …205

## js/money-core.js（66行）

centerCost() …12・dayLedger() …18・project() …49・sumDays() …59・公開 MoneyCore …64

## js/money-view.js（106行）

CSS …17・flowSvg() …42・projHtml() …62・render() …75・bind() …96・open() …97・close() …98・yesterday() …100・公開 minatoMoney …104

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

## js/save.js（144行）

SLOTS …11・REMIND …16・bk() …21・putBk() …22・markExported() …23・usage() …25・usageLine() …27・progressed() …29・nagText() …30・showNag() …34・hideNag() …37・collect() …40・restore() …41・summary() …43・encode() …52・decode() …55・■ 画面 …69・CSS …70・mount() …88・msg() …119・copy() …120・open() …122・renderSlots() …123・alertIn() …128・make() …129・check() …132・showConfirm() …133・apply() …134・fromHash() …139・公開 minatoSave …142

## js/season-core.js（81行）

DAY …12・partsOf() …16・hash() …19・rng() …20・merge() …23・windowOf() …29・stationWeights() …32・pickW() …33・yearPlan() …39・today() …52・railRules() …62・railFactor() …66・kioskFx() …71・mergeFx() …75・公開 SeasonCore …79

## js/survey-core.js（62行）

seedOf() …8・rng() …9・curve() …12・score() …20・trueShares() …30・years() …35・wave() …41・total() …55・公開 SurveyCore …60

## js/survey-view.js（120行）

COLS …6・W() …11・TOT() …12・■ 吹き出し …19・showTip() …21・hideTip() …22・bindTips() …23・■ 年と質問 …25・setYear() …26・buildTop() …27・stop() …34・■ 駅ごとにくらべる …36・refAt() …37・renderRows() …38・■ うつりかわり（小さなグラフを駅の数だけ） …62・renderMini() …63・■ 年代でくらべる …87・renderAges() …88・■ 読みとりメモ（その年の結果から、目立つところを文にする） …94・renderHint() …95・render() …108・■ 読み込み …110

## js/top.js（221行）

KEY …10・KARTE …11・COUNTRY …12・■ イメージの絵（架空・説明用） …15・SVG_WORLD …16・SVG_JAPAN …23・SVG_CREW …31・■ きょうの沿線（2026-11-09）：島を並べて、それぞれの「きのうまでに確定した数字」を1枚に …54・SRC …63・loadToday() …67・svChange() …72・todayHtml() …76・paintToday() …123・go() …126・CSS …138・render() …189・open() …208・close() …209・公開 minatoTop …219

## js/track-core.js（81行）

fmt() …17・truck() …18・timeline() …26・phases() …43・where() …58・shelfTimes() …72・公開 TrackCore …78

## js/links/local-to-kiosk.js（49行）

hash() …13・linkOf() …15・closedOn() …17・plan() …19・公開 LocalToKiosk …47

## js/links/survey-to-kiosk.js（43行）

linkOf() …16・rateOf() …18・lineAges() …19・read() …21・yearFor() …38・公開 SurveyToKiosk …41
