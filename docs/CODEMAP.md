# コードの目次（自動で作る：`node tools/codemap.cjs`）

ファイルごとに、区切りのコメント（■）と、関数・大事な定数の名前と行番号。本体を読む前にここを grep して、必要な行だけ開く。

## index.html（3505行）

■ 乗車体験（試作） …369・START …664・MAIN …677・ALL …678・treeKm() …682・SEGS …688・POP …690・TYPES …692・CLS …698・ROUTES …699・DEPOTNAME …704・CARKM …705・PURP …707・OFFICE …708・EVENT_DATA …715・■ 追加イベント（20件）。季節の行事は、季節設定に含まれる通常の観光客とは別の「その日だけの上乗せ」です …739・■ 追加イベント（12件） …805・EVMAP …851・ACTIVE_EV …852・evScale() …853・addEventDemand() …854・evDwell() …858・evWindow() …859・registerEvent() …860・ENS …867・ECO …868・NEWD …869・mb32() …870・ENS_PH …872・ensReset() …873・econSeries() …875・shockSchedule() …886・ensDayFactors() …899・ecoApply() …911・ensRefresh() …912・■ 季節のできごと（計算は js/season-core.js、設定は data/seasonal.json と data/seasonal-extra.json） …913・SEAS …916・seasDayI() …917・seasRefresh() …918・seasApply() …927・seasKioskGenre() …929・newFlowsBase() …931・newFlowsAfter() …935・■ 1日の記録（あとで便りの判定に使う。集計値だけを残す） …939・ensRecord() …940・■ 便りの判定：続いている傾向だけを候補にする …965・ensDetect() …966・■ 景気のうわさ（自動のときだけ）：段階が変わってから数日遅れで、場所ごとの変化として届く …993・ensEconNews() …994・■ 地域の小さな波の便り：予兆（予告の日）と振り返り（終わってから） …998・ensShockNews() …999・■ 1日の終わりにまとめて呼ぶ：記録→判定→便りを選ぶ。state は保存される（運行日・記録・便り・再送禁止） …1006・ensFill() …1007・ensMakeLetter() …1008・ensEndDay() …1014・COND_DEF …1035・CONDS …1036・COND …1042・setCond() …1043・rateParts() …1051・ELAS …1084・computeService() …1085・demandTotals() …1103・rate() …1106・SPEND …1108・PROP …1109・runT() …1111・scheduleTrip() …1113・onSiding() …1161・buildAll() …1163・finishTrips() …1186・■ カスタムモード：1本ずつ筋を引いてダイヤを組む …1202・CUS_ST …1205・cusSeq() …1206・cusTrip() …1212・cusPlace() …1214・buildCustom() …1215・cusTry() …1219・cusBlocker() …1223・simulate() …1227・adv() …1237・makeEvents() …1281・eventImpacts() …1302・summarize() …1313・bsearch() …1336・■ state …1338・PRESETS …1340・PAT …1376・CUS …1379・cusSave() …1382・save() …1388・rebuild() …1389・■ theme …1398・readTheme() …1400・■ geometry …1407・unit() …1409・LANE_C …1417・stOff() …1418・bl() …1421・segPos() …1422・ease() …1429・tripState() …1430・DEPOT …1437・alongPath() …1438・setState() …1440・darkness() …1453・band() …1454・■ map drawing …1456・QFULL …1461・CDPR …1462・wantDpr() …1463・rng() …1464・BLOCKS …1465・TREES …1469・MAPBG …1471・drawTerrain() …1472・strokePts() …1497・RAIL …1498・PLATS …1500・drawTracks() …1503・drawTrainShape() …1534・VIS …1552・SMAP …1554・staticMap() …1555・drawMap() …1559・waitingAt() …1608・selSet() …1609・■ diagram …1611・diaGeom() …1613・drawDia() …1616・DIAW …1658・drawDiaLoad() …1660・setDiaW() …1674・markDiaW() …1675・diaHit() …1676・■ panels …1680・curTrip() …1682・trainStatus() …1683・setWhere() …1690・strip() …1699・renderTrain() …1713・■ station timetable …1732・ttStation() …1736・renderTT() …1738・departures() …1761・renderStation() …1763・PANE …1774・setPane() …1775・refreshPanels() …1780・■ purposes …1806・binsFor() …1809・upto() …1814・niceMax() …1815・barChart() …1816・renderPurpose() …1837・mixBar() …1862・psStation() …1866・■ conditions …1869・saveCond() …1870・renderEventChips() …1872・renderCondUI() …1874・renderImpact() …1884・■ OD & sections …1892・flHour() …1894・renderFlow() …1895・odSide() …1922・odBars() …1924・trainOD() …1926・■ 共通の交通スナップショット（地図・ヒートマップ・イベント詳細・将来の運行日誌/車窓モードで共用） …1932・SNAP …1933・trafficSnapshot() …1934・■ 地図レイヤー …1941・LAYERS …1942・EVHIT …1944・segLine() …1945・pillText() …1947・drawHeat() …1948・drawStationLayer() …1955・evPos() …1959・■ 地図の上の薄い雲：ふわっとした雲の絵を数種類作っておき、ゆっくり流す。地面に薄い影も落とす …1960・CLOUDSPR …1961・cloudDim() …1967・drawClouds() …1969・drawEventIcons() …1976・renderLegend() …1988・renderMapNote() …1997・■ イベントの詳細 …2003・EVST …2005・renderEvStrip() …2007・selectEvent() …2010・renderEvent() …2012・■ 環境音エンジン（独立。音を鳴らせない環境でもゲーム本体には影響しない） …2034・SND …2036・noiseBuffer() …2043・voice() …2049・build() …2059・clink() …2074・chirp() …2077・shots() …2080・applyConfig() …2090・loadConfig() …2092・prep() …2100・decode() …2106・srcOf() …2107・load() …2108・startLoop() …2112・passBy() …2116・onboard() …2123・trainRec() …2132・occasional() …2140・listenerPos() …2152・targets() …2159・apply() …2192・setMaster() …2196・tick() …2198・start() …2206・quiet() …2211・stop() …2214・wake() …2215・onPlay() …2217・setVol() …2218・setPart() …2219・updateUI() …2220・effect() …2233・preload() …2238・■ 拡張用の入口（開発者ツールのコンソールから使えます） …2250・公開 minatoDia …2251・■ score …2254・renderScore() …2255・■ editor …2279・carsFor() …2280・renderEditor() …2281・renderEditorCounts() …2294・■ カスタムモードの画面 …2305・renderMode() …2306・renderCustom() …2311・cusPreview() …2324・■ controls …2345・setPlay() …2347・markSeg() …2350・setSpeed() …2351・markSpeed() …2352・liveTf() …2355・leaveLive() …2357・■ sizing …2385・resize() …2386・■ 乗車体験（試作）：客席から見た車内 …2392・RIDE …2395・kmOf() …2402・■ 素材の読み込み …2404・loadImg() …2405・load() …2406・buildStrips() …2416・■ 走り方（ダイヤから計算。地図の列車と同じ加減速の式 ease を使う） …2429・stopKin() …2430・kin() …2438・nextStop() …2447・■ 乗客（仮のシルエット）の席と立ち位置 …2450・seeded() …2451・makeSlots() …2452・targets() …2457・■ 描画：車内 …2460・fit() …2461・sceneryMix() …2463・duskW() …2470・variantsFor() …2471・drawScenery() …2476・drawStrip() …2478・drawSign() …2484・drawPlatform() …2491・drawWindow() …2499・windowContent() …2503・■ 窓から見える駅（通過・停車）：横から見たホームを、近くのものほど速く・大きく描く …2510・stationPeople() …2514・drawEkimeihyo() …2520・drawHanging() …2529・platNeighbors() …2535・personSprite() …2538・drawSprite() …2539・drawWaiter() …2541・personStyleS() …2582・stationLayer() …2587・■ 窓から見える駅を、車内の絵と同じ遠近法で描く（通路の奥＝消失点に向かって線が集まる） …2634・stationLayerP() …2637・drawCatenaryP() …2669・sceneryGL() …2685・drawSceneryP() …2729・drawStationViewP() …2744・drawStationView() …2746・weatherOnGlass() …2756・shade() …2763・rr() …2764・head() …2765・torso() …2767・drawStand() …2769・drawSeatLong() …2780・drawSeatCross() …2792・drawStandSprite() …2797・drawHeadSprite() …2800・drawPeople() …2803・levelSrc() …2814・drawLevels() …2815・drawDoorway() …2831・riderEvent() …2841・pickRider() …2843・drawPax() …2853・■ ドア上の案内表示（LED）：種別と、次の駅・お出口・乗り換え・接続などの案内を流す …2863・transferDirs() …2866・fasterConn() …2869・passWait() …2875・passAhead() …2877・ledSegs() …2879・drawLed() …2893・drawScene() …2904・■ 描画：ドア（開くと後ろにホームが見える） …2915・drawDoor() …2916・drawDoorGlass() …2929・■ 描画：車内の案内表示（枠は絵、画面の中は文字で描く） …2941・conn() …2942・monitorInfo() …2943・drawMonitor() …2948・■ 画面のまわり（混み具合・ボタン・状況） …2979・side() …2980・■ 確認表示：いまの区間・景色の混ざり具合・ホームを文字にする（描画と同じ関数から計算） …2998・debugInfo() …3000・laneOf() …3018・trainSize() …3021・trainScale() …3022・trainAt() …3025・platTrains() …3038・drawDoors() …3051・drawTrain() …3055・■ ホームで待つ人（仮の手描き。人数は waitingAt から） …3066・evOutfit() …3067・makePlatSlots() …3068・personStyle() …3074・drawPerson() …3080・crowdTarget() …3108・■ ホームの看板・時計・発車標 …3110・deps() …3111・tcol() …3114・drawClock() …3115・drawHangingBoard() …3120・neighbors() …3128・drawStationSign() …3130・■ ホームの描画とまわりの表示 …3139・platDraw() …3140・platInfo() …3161・trackLabel() …3168・drawLED() …3170・xferHTML() …3178・platSide() …3186・platSkip() …3197・setDir() …3199・toPlat() …3200・■ 入る・出る …3208・markSpd() …3209・enter() …3210・startRide() …3220・exit() …3225・doorSound() …3233・tick() …3236・alight() …3248・■ 沿線暦の画面：運行日・沿線だより・4つの見方・開発用の表示 …3264・ENSEN_UI …3266・load() …3270・persist() …3274・init() …3275・dayEnd() …3284・seasLetters() …3289・unread() …3294・renderBadge() …3295・srcLine() …3297・renderList() …3298・renderFilter() …3303・setOpen() …3305・renderDev() …3308・resetAll() …3325・renderCondExtra() …3328・renderEval() …3341・renderAll() …3351・mount() …3353・■ loop …3368・PERF …3370・PHONE …3380・drawGap() …3381・needDraw() …3383・frameDt() …3391・frame() …3392・■ 場面（コレクション）：data/scenes.json の場面を地図のピンにし、押すと小窓で開く …3401・SCENES …3402・scenePos() …3404・drawScenePins() …3406・openScene() …3412・■ いまの時刻と天気（日本時間・東京都立川市）につなぐ …3421・jstParts() …3423・liveT() …3424・WXK …3428・wxLog() …3430・holLog() …3431・fetchCal() …3432・liveCond() …3440・start() …3450

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

## js/center-core.js（272行）

storeKey() …23・orderNo() …24・genreOf() …25・genreCfg() …26・routeOf() …27・salesRecord() …32・cutOf() …44・preRecord() …45・shareBefore() …55・condW() …59・segShare() …64・plan() …75・factoryQty() …111・emptyLog() …120・dayOf() …121・putRecord() …122・putOrder() …124・trim() …131・recsOf() …132・supplyFor() …135・cart() …146・runOrder() …168・allocate() …178・supplyOrdFor() …186・truckFor() …188・csNew() …197・centerPids() …198・csDemand() …200・nextOrderDay() …208・onOrder() …209・wsQty() …211・csOpen() …215・centerOut() …227・csClose() …230・csOutlook() …236・hashS() …251・truckRuns() …252・flowOf() …256・arrival() …260・putArrival() …267・公開 CenterCore …269

## js/center-flow.js（133行）

CSS …20・COL …45・html() …47・moneyHtml() …105・bind() …124・OPEN …129・公開 CenterFlow …131

## js/center-view.js（98行）

ST_NAME …14・CSS …16・dayLabel() …51・render() …52・open() …91・close() …92・公開 minatoCenter …96

## js/donut-core.js（93行）

rng() …16・normalize() …17・offsets() …22・simulate() …26・■ ①〜④：仕込みの回と、1個ずつの押し出しの時刻 …33・■ ⑤〜⑨：1個ずつ。検査で、油の温度のずれと金属検出ではじく …49・■ ⑩ 箱詰め・⑪ 出荷 …53・■ 品ごとのまとめ …62・■ 記録 …68・■ 費用 …76・upTo() …85・countsAt() …86・公開 DonutCore …90

## js/donut-view.js（192行）

liveNote() …15・save() …16・run() …17・plan() …21・recipes() …30・stations() …39・result() …45・■ 11コマ …52・PANELS …53・buildPanels() …57・ring() …61・belt() …63・steam() …65・person() …66・inSeg() …70・batchState() …74・DRAW …78・drawPanels() …143・■ タイムライン …147・buildGantt() …149・drawGantt() …159・■ 描く …169・draw() …170・init() …177・tick() …187・公開 minatoDonut …189

## js/factory-core.js（375行）

ST_LABEL …22・LN_LABEL …25・ROLES …27・rng() …29・gauss() …30・tau() …34・soakNeed() …36・mu() …38・lineCap() …42・washMin() …44・fillOrder() …46・centerPart() …51・fillOrders() …53・riceKind() …56・riceSeq() …58・actualOrder() …67・hm() …70・simulate() …72・addBatch() …86・fixDrift() …142・findLabel() …145・judge() …325・公開 FactoryCore …373

## js/factory-live.js（32行）

nowT() …12・sec() …14・SPEEDS …15・liveAt() …17・note() …19・puffs() …26・bubbles() …28・公開 FactoryLive …30

## js/factory-night.js（90行）

LINES …13・kioskMap() …21・seasonOf() …23・seedOf() …25・latest() …27・splitItems() …29・cfgsFrom() …31・madeOf() …34・runNight() …36・centerShip() …50・share() …52・truckOf() …56・lateRule() …63・slip() …70・readLog() …82・withCenter() …83・centerNote() …84・公開 FactoryNight …87

## js/factory-pl.js（104行）

KEY …11・load() …12・save() …13・defaults() …14・settings() …15・extraUnits() …16・apply() …18・suggestBatches() …24・compute() …28・■ 画面 …63・build() …68・changed() …85・show() …86・init() …98・公開 FactoryPL …101

## js/factory-view.js（545行）

KEY …12・SPEEDS …14・liveNote() …17・ST_COLOR …18・load() …20・save() …21・css() …22・tempColor() …23・rgb() …25・■ 夕方に決める …28・buildPlan() …29・clampInt() …78・■ 回す …80・run() …81・■ 再生 …91・buildPlay() …92・markSpeed() …100・markPlay() …101・tick() …102・BELT_MAX …114・madeAt() …116・resetBelt() …117・drawAll() …118・■ 4つの時計 …126・drawClocks() …127・■ 工程の絵 …141・layout() …142・TITLES …150・drawStage() …151・arrowHead() …176・boxFrame() …177・rr() …179・hit() …180・selRing() …181・txt() …182・germDot() …183・drawWash() …185・drawTanks() …195・drawPots() …213・drawCooler() …234・drawHold() …250・FILL_COLOR …263・STATIONS …264・ST_OF …265・nittaTag() …266・ROLE_COLOR …268・ROLE_HOME …269・person() …270・bubble() …274・inBreak() …277・visitsAt() …278・expiryText() …279・linePath() …281・drawForm() …286・drawLinePeople() …358・drawShip() …371・■ 釜ごとの帯 …390・drawGantt() …391・■ 釜を一つ追いかける …415・drawBatch() …416・■ 工場の記録 …461・drawEvents() …463・■ 朝の答え合わせ …468・showResult() …469・changes() …510・■ クリック …514・onStageClick() …515・legends() …520・init() …525・公開 FactoryRice …533

## js/haiso-core.js（62行）

dayPlan() …15・公開 HaisoCore …60

## js/haiso-view.js（78行）

CSS …17・render() …44・bindDays() …68・open() …69・close() …70・summary() …72・公開 minatoHaiso …76

## js/kiosk-core.js（397行）

hash() …13・rng() …14・■ 下ごしらえ …21・index() …22・life() …24・shelfInfo() …26・defaultOrder() …31・■ 状態 …32・create() …33・■ 1日を動かす …39・simulate() …42・review() …303・■ 運行日を締める：評判・SNSの話題・常連・ブーム・在庫の持ちこし・知らせ …313・closeDay() …314・■ 移転：別の駅・場所へ移す（次の運行日から） …364・relocate() …369・migratePrices() …382・backAt() …387・stockAt() …388・idxAt() …389・soFar() …391・公開 KioskCore …395

## js/kiosk-staff.js（226行）

hash() …12・rng() …13・hoursOf() …19・dayPlan() …23・brkOf() …35・minorOf() …37・canB() …42・realSpans() …43・TYPES …47・traits() …55・moodWord() …57・person() …60・create() …69・assign() …78・autoShift() …118・migrate() …121・wageFloor() …123・insuredOf() …129・weekHours() …131・today() …133・helpFill() …139・dayWorkers() …144・payOf() …162・adsOpen() …165・close() …168・gapsOf() …204・autoHire() …207・公開 KioskStaff …223

## js/kiosk-view.js（1082行）

STORDER …12・DAYN …22・MSV …29・■ 読み込み・保存 …31・persist() …41・■ その日の計算 …45・ctxNow() …46・linkNow() …54・supplyOf() …57・slipWait() …59・truckOf() …60・cartOf() …62・supplyOrdOf() …67・checkDay() …68・ensureRes() …71・tick() …75・closeToday() …76・orderFor() …88・nextOrderDay() …89・■ 川辺の配送センター（計算は js/center-core.js、設定は data/center.json） …90・center() …93・isAuto() …94・managed() …95・aimName() …96・loadOrders() …98・CSKEY …100・loadMoney() …103・moneyOf() …104・GKEY …112・loadGroup() …113・groupOf() …114・groupClose() …124・moneyClose() …126・loadCS() …127・saveCS() …128・csCtx() …129・■ 港駅の店をグループの流れにのせる（橋 minato-to-group・js/links/minato-to-group.js・2026-11-12） …133・MSV2 …135・portOn() …136・portIn() …137・portPut() …139・gcfg() …142・allocAll() …145・csOpenToday() …148・cstockOf() …151・saveOrders() …152・arrivalToCenter() …154・salesToCenter() …155・planFor() …156・dailyOrder() …158・factoryReady() …177・slipTodo() …178・slipNow() …180・queueSlips() …181・matSync() …185・makeSlip() …187・nextCond() …202・editOrder() …203・expressLeft() …207・expressOpen() …208・todayExpress() …212・openExpress() …214・pendingExpress() …215・addToExpress() …218・orderExpress() …221・addOnOk() …225・addOnNext() …226・addOnToday() …227・orderAddOn() …228・expressConfirm() …233・onDuty() …238・curSet() …239・edit() …240・■ 商品ごとの「いま」 …244・counts() …246・nextDelivery() …249・pinfo() …250・motText() …254・withText() …256・ST_LABEL …258・orderDiff() …261・orderText() …262・■ 骨組み …264・CSS …265・mount() …354・setMult() …369・badge() …370・readNews() …373・openFromBadge() …375・setOpen() …376・■ 開店前：場所を選ぶ …379・renderSetup() …380・■ 要注意：売り切れ・品出し待ち・残りわずか（押すと商品カード） …393・renderAlert() …394・openSheet() …405・closeSheet() …406・renderSheet() …407・updateSheet() …442・■ 画面全体 …446・render() …447・renderWhich() …460・lifeLine() …465・renderKpi() …469・renderBody() …474・evText() …486・LF0 …499・KIND …502・lfMatch() …505・lfBar() …513・lfSummary() …532・lfCsv() …544・PAGE …553・renderLog() …554・flushLog() …572・centerBox() …580・slipLine() …591・flowLine() …596・■ 荷物の行方（アイデア帳 6.・2026-11-08）：注文番号ごとに、売上の記録 → 注文 → 製造 → 納品書 → 到着を時刻の順に。計算は js/track-core.js、時刻は data/center.json の flow・track …603・trkNow() …606・trkSplit() …607・trkEst() …609・trkRuns() …611・trkRuns0() …612・trkList() …619・renderTrack() …621・renderItems() …676・updateItems() …737・renderLayout() …742・basketStats() …756・renderPeople() …765・crewSave() …794・renderCrew() …795・renderMoney() …877・moveCard() …891・shrinkCard() …911・renderNews() …920・■ 売店の正面の絵 …923・BOX …924・zoneSlots() …925・rr() …926・drawItem() …927・drawKiosk() …937・personColor() …966・spawnFromEvent() …967・bubble() …972・stepPeople() …973・drawPerson() …982・draw() …987・onCanvasClick() …1008・loop() …1011・■ 起動 …1016・公開 minatoKiosk …1018

## js/kiosk-walk.js（184行）

begin() …22・visitors() …31・plan() …98・commit() …126・after() …146・公開 KioskWalk …182

## js/material-core.js（132行）

KEY …15・LINES …17・LCFG …18・PRODS …19・FORE …20・estLines() …27・mkOf() …33・addTo() …34・usage() …36・lotInfo() …55・newLot() …57・newState() …59・deliveries() …64・consume() …70・step() …74・nightSrc() …83・catchUp() …89・trim() …97・■ 画面用（計算だけ） …101・nextIn() …103・runOut() …105・status() …108・receipts() …117・trace() …122・balance() …127・parse() …128・公開 MaterialCore …129

## js/material-view.js（82行）

q() …17・today() …20・sync() …21・segs() …30・meter() …31・meters() …37・receipts() …42・trace() …47・list() …56・render() …59・init() …72・公開 minatoMaterial …79

## js/minato-sales-core.js（38行）

ZONES …11・NAME …13・zoneMap() …15・soFar() …20・dayRec() …25・base() …27・upTo() …33・judge() …35・公開 MinatoSalesCore …36

## js/minato-sales-view.js（137行）

RAMP …13・DARK …15・■ 1日の記録 …22・load() …23・days() …25・record() …26・■ 見た目 …28・CSS …29・KINDN …58・■ 地図 …59・mapSvg() …60・■ 描く（時刻の「分」が変わったとき・タブを変えたときだけ書きかえる） …71・render() …72・公開 MinatoSalesView …135

## js/minato-store-anim.js（486行）

■ 見取り図（キャンバスの座標） …10・MAP …12・AN0 …32・STOP_ORDER …36・standOf() …38・placeIndex() …49・CORR …51・route() …52・legs() …58・mark() …71・TRASH …76・DOOR_IN …77・■ A6（2026-11-11）：持ち物の絵・どこから来てどこへ行くか …81・PR0 …87・PARK …89・propsOf() …90・inPath() …100・OUT_MID …106・outAt() …107・■ A2（2026-11-11）：店の中の台本 …109・DW0 …114・ST0 …116・LOOP_Z …117・stockAt() …119・pickStyle() …120・script() …126・build() …203・EASE …253・along() …254・qSlot() …260・PICK …262・doing() …263・SLOT …269・avoid() …270・at() …280・clerks() …303・YEN …314・buyText() …315・bubbles() …318・■ 地元のお店の人（A1・2026-11-11） …333・LOCAL_DROP …337・locals() …338・localAt() …350・■ A3（2026-11-11）：店員の台本 …352・CK0 …360・BEHIND …362・croute() …363・CPOS …367・NAMES …368・plan() …369・公開 MinatoAnim …484

## js/minato-store-core.js（65行）

KEY …12・cfg() …15・crewFix() …36・crewAdNow() …40・create() …44・■ おまかせ発注（港駅の売店アニメの S1・2026-11-11） …46・OM_KEEP …51・omInit() …52・omRecord() …54・omOrder() …60・公開 MinatoStore …63

## js/minato-store-fx.js（122行）

pill() …17・■ 荷物が届く：台車（センターの便）・できたての便（札つき）・地元のお店の人（手で） …20・deliveries() …21・DUR …22・cart() …23・localsOf() …28・LEAVE …29・boxes() …30・sayOf() …32・drawLocals() …33・drawDeli() …49・slotRect() …57・drawTag() …59・■ 天気：濡れた床・雪の入口・海風 …66・drawFloor() …67・drawWeather() …74・■ イートイン：カップ麺の3分・湯気 …83・eats() …84・drawEat() …85・■ 防犯：見える範囲（扇形）。ミラー2つ・カメラ2台・レジの店員 …91・fan() …92・drawFan() …93・■ 客船の日：旗と汽笛 …100・drawFlags() …101・drawHorn() …104・■ 1日の足あと（閉店のあと） …108・footprints() …109・closed() …113・公開 MinatoFx …117

## js/minato-store-view.js（377行）

DAYN …22・■ 読み込み・保存 …26・omStart() …31・omToday() …34・crewAd() …37・persist() …39・■ その日の計算 …42・ctxNow() …43・grpOn() …50・grp() …51・sdFor() …54・samedayNow() …56・localNow() …59・checkDay() …61・ensureRes() …64・closeToday() …68・tick() …72・■ 店を出す …75・openStore() …76・■ 売店の画面の上の欄 …81・PSN …82・CIMG …84・conceptUI() …85・render() …97・panel() …115・omCard() …126・localLine() …137・cruiseLine() …144・samedayLine() …148・■ 絵：小さな絵を作っておく …154・mk() …156・LOOK …157・fig() …163・sprite() …182・basket() …185・handOf() …188・BAGC …196・suitcase() …197・propsDraw() …198・clockDraw() …242・dripsDraw() …247・box() …249・label() …250・bg() …251・DISP …295・shelfLayer() …296・■ 絵：毎コマ …310・bubble() …312・clerkDo() …315・view() …328・draw() …329・fxCtx() …364・click() …365・公開 MinatoStoreView …367

## js/money-core.js（103行）

centerCost() …12・dayLedger() …18・groupLedger() …51・project() …86・sumDays() …96・公開 MoneyCore …101

## js/money-view.js（123行）

CSS …17・flowSvg() …43・projHtml() …61・pairOf() …75・groupView() …76・render() …83・render0() …84・bind() …112・open() …113・close() …114・yesterday() …116・公開 minatoMoney …121

## js/port-core.js（26行）

today() …13・shipOf() …17・公開 PortCore …24

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

## js/links/factory-to-kiosk-sameday.js（41行）

hash() …14・linkOf() …16・plan() …18・公開 FactoryToKioskSameday …39

## js/links/local-to-kiosk.js（49行）

hash() …13・linkOf() …15・closedOn() …17・plan() …19・公開 LocalToKiosk …47

## js/links/minato-to-group.js（34行）

linkOf() …14・on() …15・putOrder() …19・公開 MinatoToGroup …31

## js/links/port-to-all.js（35行）

linkOf() …12・plan() …15・公開 PortToAll …33

## js/links/survey-to-kiosk.js（43行）

linkOf() …16・rateOf() …18・lineAges() …19・read() …21・yearFor() …38・公開 SurveyToKiosk …41
