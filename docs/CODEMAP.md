# コードの目次（自動で作る：`node tools/codemap.cjs`）

ファイルごとに、区切りのコメント（■）と、関数・大事な定数の名前と行番号。本体を読む前にここを grep して、必要な行だけ開く。

## index.html（3635行）

■ 乗車体験（試作） …392・START …697・MAIN …710・RAILBASE …714・RAILSHAPE …716・ALL …719・treeKm() …723・SEGS …729・POP …731・TYPES …733・CLS …739・ROUTES …740・DEPOTNAME …745・CARKM …746・PURP …748・OFFICE …749・EVENT_DATA …756・■ 追加イベント（20件）。季節の行事は、季節設定に含まれる通常の観光客とは別の「その日だけの上乗せ」です …780・■ 追加イベント（12件） …846・EVMAP …892・ACTIVE_EV …893・evScale() …894・addEventDemand() …895・evDwell() …899・evWindow() …900・registerEvent() …901・ENS …908・ECO …909・NEWD …910・mb32() …911・ENS_PH …913・ensReset() …914・econSeries() …916・shockSchedule() …927・ensDayFactors() …940・ecoApply() …952・ensRefresh() …953・■ 季節のできごと（計算は js/season-core.js、設定は data/seasonal.json と data/seasonal-extra.json） …954・SEAS …957・seasDayI() …958・seasRefresh() …959・seasApply() …968・seasKioskGenre() …970・newFlowsBase() …972・newFlowsAfter() …976・■ 1日の記録（あとで便りの判定に使う。集計値だけを残す） …980・ensRecord() …981・■ 便りの判定：続いている傾向だけを候補にする …1006・ensDetect() …1007・■ 景気のうわさ（自動のときだけ）：段階が変わってから数日遅れで、場所ごとの変化として届く …1034・ensEconNews() …1035・■ 地域の小さな波の便り：予兆（予告の日）と振り返り（終わってから） …1039・ensShockNews() …1040・■ 1日の終わりにまとめて呼ぶ：記録→判定→便りを選ぶ。state は保存される（運行日・記録・便り・再送禁止） …1047・ensFill() …1048・ensMakeLetter() …1049・ensEndDay() …1055・COND_DEF …1076・CONDS …1077・COND …1083・setCond() …1084・rateParts() …1092・ELAS …1125・computeService() …1126・demandTotals() …1144・rate() …1147・SPEND …1149・PROP …1150・runT() …1152・scheduleTrip() …1154・onSiding() …1202・buildAll() …1204・finishTrips() …1227・■ カスタムモード：1本ずつ筋を引いてダイヤを組む …1243・CUS_ST …1246・cusSeq() …1247・cusTrip() …1253・cusPlace() …1255・buildCustom() …1256・cusTry() …1260・cusBlocker() …1264・simulate() …1268・adv() …1278・makeEvents() …1322・eventImpacts() …1343・summarize() …1354・bsearch() …1377・■ state …1379・PRESETS …1381・PAT …1417・CUS …1420・cusSave() …1423・save() …1429・rebuild() …1430・■ theme …1439・readTheme() …1441・■ geometry …1448・unit() …1450・LANE_C …1462・stOff() …1463・bl() …1466・segPos() …1467・ease() …1475・tripState() …1476・DEPOT …1483・alongPath() …1485・setState() …1487・pathOf() …1501・pathAt() …1502・TPATH …1506・tripPath() …1507・carPoses() …1511・darkness() …1517・band() …1518・■ map drawing …1520・QFULL …1525・CDPR …1526・wantDpr() …1527・rng() …1528・BLOCKS …1529・TREES …1533・MAPBG …1535・drawTerrain() …1536・strokePts() …1561・RAIL …1562・PLATS …1564・drawTracks() …1567・drawTrainShape() …1603・VIS …1621・SMAP …1623・staticMap() …1624・drawMap() …1628・waitingAt() …1683・selSet() …1684・■ diagram …1686・diaGeom() …1688・drawDia() …1691・DIAW …1733・drawDiaLoad() …1735・setDiaW() …1749・markDiaW() …1750・diaHit() …1751・■ panels …1755・curTrip() …1757・trainStatus() …1758・setWhere() …1765・strip() …1774・renderTrain() …1788・■ station timetable …1807・ttStation() …1811・renderTT() …1813・departures() …1836・renderStation() …1838・PANE …1849・setPane() …1850・FB_ORDER …1858・fbStage() …1859・renderFormbar() …1868・refreshPanels() …1891・■ purposes …1918・binsFor() …1921・upto() …1926・niceMax() …1927・barChart() …1928・renderPurpose() …1949・mixBar() …1974・psStation() …1978・■ conditions …1981・saveCond() …1982・renderEventChips() …1984・renderCondUI() …1986・renderImpact() …1996・■ OD & sections …2004・flHour() …2006・renderFlow() …2007・odSide() …2034・odBars() …2036・trainOD() …2038・■ 共通の交通スナップショット（地図・ヒートマップ・イベント詳細・将来の運行日誌/車窓モードで共用） …2044・SNAP …2045・trafficSnapshot() …2046・■ 地図レイヤー …2053・LAYERS …2054・EVHIT …2056・segLine() …2057・pillText() …2059・drawHeat() …2060・drawStationLayer() …2068・evPos() …2072・■ 地図の上の薄い雲：ふわっとした雲の絵を数種類作っておき、ゆっくり流す。地面に薄い影も落とす …2073・CLOUDSPR …2074・cloudDim() …2080・drawClouds() …2082・drawEventIcons() …2089・renderLegend() …2101・renderMapNote() …2111・■ イベントの詳細 …2117・EVST …2119・renderEvStrip() …2121・selectEvent() …2124・renderEvent() …2132・■ 環境音エンジン（独立。音を鳴らせない環境でもゲーム本体には影響しない） …2154・SND …2156・noiseBuffer() …2163・voice() …2169・build() …2179・clink() …2194・chirp() …2197・shots() …2200・applyConfig() …2210・loadConfig() …2212・prep() …2220・decode() …2226・srcOf() …2227・load() …2228・startLoop() …2232・passBy() …2236・onboard() …2243・trainRec() …2252・occasional() …2260・listenerPos() …2272・targets() …2279・apply() …2312・setMaster() …2316・tick() …2318・start() …2326・quiet() …2331・stop() …2334・wake() …2335・onPlay() …2337・setVol() …2338・setPart() …2339・updateUI() …2340・effect() …2353・preload() …2358・■ 拡張用の入口（開発者ツールのコンソールから使えます） …2370・公開 minatoDia …2371・■ score …2374・renderScore() …2375・■ editor …2399・carsFor() …2400・renderEditor() …2401・renderEditorCounts() …2414・■ カスタムモードの画面 …2425・renderMode() …2426・renderCustom() …2431・cusPreview() …2444・■ controls …2465・setPlay() …2467・markSeg() …2470・setSpeed() …2471・markSpeed() …2472・liveTf() …2475・leaveLive() …2477・■ sizing …2506・resize() …2507・■ 乗車体験（試作）：客席から見た車内 …2513・RIDE …2516・kmOf() …2523・■ 素材の読み込み …2525・loadImg() …2526・load() …2527・buildStrips() …2537・■ 走り方（ダイヤから計算。地図の列車と同じ加減速の式 ease を使う） …2550・stopKin() …2551・kin() …2559・nextStop() …2568・■ 乗客（仮のシルエット）の席と立ち位置 …2571・seeded() …2572・makeSlots() …2573・targets() …2578・■ 描画：車内 …2581・fit() …2582・sceneryMix() …2584・duskW() …2591・variantsFor() …2592・drawScenery() …2597・drawStrip() …2599・drawSign() …2605・drawPlatform() …2612・drawWindow() …2620・windowContent() …2624・■ 窓から見える駅（通過・停車）：横から見たホームを、近くのものほど速く・大きく描く …2631・stationPeople() …2635・drawEkimeihyo() …2641・drawHanging() …2650・platNeighbors() …2656・personSprite() …2659・drawSprite() …2660・drawWaiter() …2662・personStyleS() …2703・stationLayer() …2708・■ 窓から見える駅を、車内の絵と同じ遠近法で描く（通路の奥＝消失点に向かって線が集まる） …2755・stationLayerP() …2758・drawCatenaryP() …2790・sceneryGL() …2806・drawSceneryP() …2850・drawStationViewP() …2865・drawStationView() …2867・weatherOnGlass() …2877・shade() …2884・rr() …2885・head() …2886・torso() …2888・drawStand() …2890・drawSeatLong() …2901・drawSeatCross() …2913・drawStandSprite() …2918・drawHeadSprite() …2921・drawPeople() …2924・levelSrc() …2935・drawLevels() …2936・drawDoorway() …2952・riderEvent() …2962・pickRider() …2964・drawPax() …2974・■ ドア上の案内表示（LED）：種別と、次の駅・お出口・乗り換え・接続などの案内を流す …2984・transferDirs() …2987・fasterConn() …2990・passWait() …2996・passAhead() …2998・ledSegs() …3000・drawLed() …3014・drawScene() …3025・■ 描画：ドア（開くと後ろにホームが見える） …3036・drawDoor() …3037・drawDoorGlass() …3050・■ 描画：車内の案内表示（枠は絵、画面の中は文字で描く） …3062・conn() …3063・monitorInfo() …3064・drawMonitor() …3069・■ 画面のまわり（混み具合・ボタン・状況） …3100・side() …3101・■ 確認表示：いまの区間・景色の混ざり具合・ホームを文字にする（描画と同じ関数から計算） …3119・debugInfo() …3121・laneOf() …3139・trainSize() …3142・trainScale() …3143・trainAt() …3146・platTrains() …3159・drawDoors() …3172・drawTrain() …3176・■ ホームで待つ人（仮の手描き。人数は waitingAt から） …3187・evOutfit() …3188・makePlatSlots() …3189・personStyle() …3195・drawPerson() …3201・crowdTarget() …3229・■ ホームの看板・時計・発車標 …3231・deps() …3232・tcol() …3235・drawClock() …3236・drawHangingBoard() …3241・neighbors() …3249・drawStationSign() …3251・■ ホームの描画とまわりの表示 …3260・platDraw() …3261・platInfo() …3282・trackLabel() …3289・drawLED() …3291・xferHTML() …3299・platSide() …3307・platSkip() …3318・setDir() …3320・toPlat() …3321・■ 入る・出る …3329・markSpd() …3330・enter() …3331・startRide() …3341・exit() …3346・doorSound() …3354・tick() …3357・alight() …3369・■ 沿線暦の画面：運行日・沿線だより・4つの見方・開発用の表示 …3385・ENSEN_UI …3387・load() …3391・persist() …3395・init() …3396・dayEnd() …3405・seasLetters() …3410・unread() …3415・renderBadge() …3416・srcLine() …3418・renderList() …3419・renderFilter() …3424・setOpen() …3426・renderDev() …3429・resetAll() …3446・renderCondExtra() …3449・renderEval() …3462・renderAll() …3472・mount() …3474・■ loop …3489・PERF …3491・PHONE …3501・drawGap() …3502・needDraw() …3504・frameDt() …3512・frame() …3513・■ 場面（コレクション）：data/scenes.json の場面を地図のピンにし、押すと小窓で開く …3522・SCENES …3523・scenePos() …3525・drawScenePins() …3527・openScene() …3533・■ いまの時刻と天気（日本時間・東京都立川市）につなぐ …3542・jstParts() …3544・liveT() …3545・WXK …3549・wxLog() …3551・holLog() …3552・fetchCal() …3553・liveCond() …3561・start() …3571

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

## js/center-view.js（105行）

ST_NAME …14・CSS …16・dayLabel() …52・tabs() …54・bindTabs() …55・render() …56・open() …98・close() …99・公開 minatoCenter …103

## js/deals-core.js（233行）

hashS() …13・rngOf() …14・catalog() …22・offersOn() …25・buildSell() …31・buildHaul() …37・newState() …42・valid() …43・inbox() …45・decide() …52・snap() …58・stateOf() …63・contracts() …64・prune() …66・committed() …73・sellOutlook() …77・sellMoney() …86・haulOutlook() …93・■ 第2回（2026-11-12）：販売の契約を工場とお金へ（橋 deals-to-factory・deals-to-money。つなぐのは js/links/deals-to-*.js） …115・dayOrders() …118・dealMoney() …125・record() …130・■ 第3回（2026-11-12）：配送の契約を配送会社とお金へ（橋 deals-to-haiso。つなぐのは js/links/deals-to-haiso.js） …134・dayHauls() …138・binFor() …145・haulStops() …149・haulResults() …153・recordHaul() …159・ownDeliverFare() …163・■ 第4回（2026-11-12）：自分から動く営業・信用（評判）・更新と解約・値段の交渉・工場の収支の4つの取引先の移しかえ …165・REP0 …169・repOf() …173・repAll() …176・repAdd() …177・quitCheck() …179・salesDo() …182・salesToday() …184・salesCost() …186・salesOffers() …188・legacyOffer() …198・legacyOffers() …203・migrate() …205・negoChance() …210・modOf() …212・negotiate() …216・cancel() …221・renewInfo() …224・renew() …226・公開 DealsCore …231

## js/deals-view.js（337行）

KEY …13・load() …24・save() …25・state() …26・ensure() …28・CSS …34・inputs() …145・what() …152・handName() …155・card() …156・facBar() …166・slots() …171・haulSec() …174・detail() …184・cxDialog() …228・contractsHtml() …240・gotLine() …255・haulGot() …259・trackHtml() …263・html() …282・bind() …309・count() …333・公開 DealsView …335

## js/donut-core.js（93行）

rng() …16・normalize() …17・offsets() …22・simulate() …26・■ ①〜④：仕込みの回と、1個ずつの押し出しの時刻 …33・■ ⑤〜⑨：1個ずつ。検査で、油の温度のずれと金属検出ではじく …49・■ ⑩ 箱詰め・⑪ 出荷 …53・■ 品ごとのまとめ …62・■ 記録 …68・■ 費用 …76・upTo() …85・countsAt() …86・公開 DonutCore …90

## js/donut-view.js（192行）

liveNote() …15・save() …16・run() …17・plan() …21・recipes() …30・stations() …39・result() …45・■ 11コマ …52・PANELS …53・buildPanels() …57・ring() …61・belt() …63・steam() …65・person() …66・inSeg() …70・batchState() …74・DRAW …78・drawPanels() …143・■ タイムライン …147・buildGantt() …149・drawGantt() …159・■ 描く …169・draw() …170・init() …177・tick() …187・公開 minatoDonut …189

## js/event-bubble.js（59行）

CFG …10・init() …12・rimOf() …13・sprite() …15・bad() …19・shape() …22・draw() …25・label() …53

## js/event-edit.js（151行）

DOW …17・init() …19・evs() …24・■ 描く（道具が「イベント」のとき） …28・draw() …29・■ 指・マウス（route-editor.js から呼ぶ） …36・hit() …37・down() …38・move() …39・up() …40・tapEmpty() …41・del() …45・cancel() …46・fixSel() …47・■ 下の棚：暦の帯 …49・dock() …50・■ シート（右・スマホは下） …67・panel() …68・hide() …69・sheet() …70・tab() …86・pick() …88・grid() …89・prev() …124・listView() …126・公開 EventEdit …149

## js/event-map-core.js（70行）

DAY …9・ymdOf() …11・indexOf() …12・toMin() …18・normItem() …24・normalize() …31・occurs() …36・forDay() …38・strip() …41・state() …43・nearest() …45・cluster() …47・RANK …49・order() …50・fileOf() …52・fxText() …54・search() …59・kindOfEmoji() …61・pushRecent() …63・uid() …64・公開 EventMapCore …68

## js/event-map-view.js（143行）

KEY …11・CFG …12・■ 読み込み …15・check() …18・init() …22・■ その時刻に地図に出すものを集める …24・seasonKey() …26・collect() …27・■ 描く …48・draw() …49・■ 押す …62・click() …63・■ カード …66・CSS …67・BOX …103・box() …104・close() …107・ST_NAME …109・iconHtml() …110・kindName() …112・mapCrop() …114・openCard() …118・openList() …136

## js/factory-core.js（375行）

ST_LABEL …22・LN_LABEL …25・ROLES …27・rng() …29・gauss() …30・tau() …34・soakNeed() …36・mu() …38・lineCap() …42・washMin() …44・fillOrder() …46・centerPart() …51・fillOrders() …53・riceKind() …56・riceSeq() …58・actualOrder() …67・hm() …70・simulate() …72・addBatch() …86・fixDrift() …142・findLabel() …145・judge() …325・公開 FactoryCore …373

## js/factory-live.js（32行）

nowT() …12・sec() …14・SPEEDS …15・liveAt() …17・note() …19・puffs() …26・bubbles() …28・公開 FactoryLive …30

## js/factory-night.js（103行）

LINES …13・kioskMap() …21・seasonOf() …23・seedOf() …25・latest() …27・splitItems() …29・cfgsFrom() …31・madeOf() …34・runNight() …36・centerShip() …51・share() …53・truckOf() …57・lateRule() …64・slip() …71・dealShip() …85・readLog() …94・withCenter() …95・centerNote() …97・公開 FactoryNight …100

## js/factory-pl.js（103行）

KEY …11・load() …12・save() …13・defaults() …14・settings() …15・extraUnits() …16・apply() …18・suggestBatches() …24・compute() …28・■ 画面 …63・build() …68・changed() …84・show() …85・init() …97・公開 FactoryPL …100

## js/factory-view.js（545行）

KEY …12・SPEEDS …14・liveNote() …17・ST_COLOR …18・load() …20・save() …21・css() …22・tempColor() …23・rgb() …25・■ 夕方に決める …28・buildPlan() …29・clampInt() …78・■ 回す …80・run() …81・■ 再生 …91・buildPlay() …92・markSpeed() …100・markPlay() …101・tick() …102・BELT_MAX …114・madeAt() …116・resetBelt() …117・drawAll() …118・■ 4つの時計 …126・drawClocks() …127・■ 工程の絵 …141・layout() …142・TITLES …150・drawStage() …151・arrowHead() …176・boxFrame() …177・rr() …179・hit() …180・selRing() …181・txt() …182・germDot() …183・drawWash() …185・drawTanks() …195・drawPots() …213・drawCooler() …234・drawHold() …250・FILL_COLOR …263・STATIONS …264・ST_OF …265・nittaTag() …266・ROLE_COLOR …268・ROLE_HOME …269・person() …270・bubble() …274・inBreak() …277・visitsAt() …278・expiryText() …279・linePath() …281・drawForm() …286・drawLinePeople() …358・drawShip() …371・■ 釜ごとの帯 …390・drawGantt() …391・■ 釜を一つ追いかける …415・drawBatch() …416・■ 工場の記録 …461・drawEvents() …463・■ 朝の答え合わせ …468・showResult() …469・changes() …510・■ クリック …514・onStageClick() …515・legends() …520・init() …525・公開 FactoryRice …533

## js/haiso-core.js（68行）

dayPlan() …15・公開 HaisoCore …66

## js/haiso-view.js（78行）

CSS …17・render() …44・bindDays() …68・open() …69・close() …70・summary() …72・公開 minatoHaiso …76

## js/kiosk-core.js（397行）

hash() …13・rng() …14・■ 下ごしらえ …21・index() …22・life() …24・shelfInfo() …26・defaultOrder() …31・■ 状態 …32・create() …33・■ 1日を動かす …39・simulate() …42・review() …303・■ 運行日を締める：評判・SNSの話題・常連・ブーム・在庫の持ちこし・知らせ …313・closeDay() …314・■ 移転：別の駅・場所へ移す（次の運行日から） …364・relocate() …369・migratePrices() …382・backAt() …387・stockAt() …388・idxAt() …389・soFar() …391・公開 KioskCore …395

## js/kiosk-scene.js（320行）

hash() …18・■ 通り道（点と線のつながりで、いちばん短い道） …21・shortest() …22・personDef() …32・walkPxOf() …33・near() …34・route() …35・natural() …46・■ 1人の買い物を、見せるための段取りにする（計算の出来事は変えない） …59・plan() …62・pose() …148・choose() …163・API …167・loadImg() …177・load() …178・frameOf() …193・personFor() …197・■ 描く …199・sizeAt() …200・sprite() …201・drawPerson() …202・drawStaff() …242・draw() …247・PAYN …275・caption() …276・■ 次の人を選ぶ …284・next() …285・■ 外から呼ぶもの …293・mount() …294・unmount() …307・tick() …309・公開 KioskScene …318

## js/kiosk-staff.js（226行）

hash() …12・rng() …13・hoursOf() …19・dayPlan() …23・brkOf() …35・minorOf() …37・canB() …42・realSpans() …43・TYPES …47・traits() …55・moodWord() …57・person() …60・create() …69・assign() …78・autoShift() …118・migrate() …121・wageFloor() …123・insuredOf() …129・weekHours() …131・today() …133・helpFill() …139・dayWorkers() …144・payOf() …162・adsOpen() …165・close() …168・gapsOf() …204・autoHire() …207・公開 KioskStaff …223

## js/kiosk-view.js（1125行）

STORDER …12・DAYN …22・MSV …29・■ 読み込み・保存 …31・persist() …41・■ その日の計算 …45・ctxNow() …46・linkNow() …54・supplyOf() …57・slipWait() …59・truckOf() …60・cartOf() …62・supplyOrdOf() …67・checkDay() …68・ensureRes() …71・tick() …75・closeToday() …76・orderFor() …88・nextOrderDay() …89・■ 川辺の配送センター（計算は js/center-core.js、設定は data/center.json） …90・center() …93・isAuto() …94・managed() …95・aimName() …96・loadOrders() …98・CSKEY …100・loadMoney() …103・moneyOf() …104・GKEY …112・loadGroup() …113・groupOf() …114・groupClose() …127・moneyClose() …129・loadCS() …130・saveCS() …131・csCtx() …132・■ 港駅の店をグループの流れにのせる（橋 minato-to-group・js/links/minato-to-group.js・2026-11-12） …136・MSV2 …138・portOn() …139・portIn() …140・portPut() …142・■ 取引の相談窓口 → 工場・お金（橋 deals-to-factory・deals-to-money・第2回・2026-11-12） …144・DKEY …146・dealsOn() …147・loadDeals() …148・dealPut() …149・dealSettle() …150・haulOn() …154・haulPut() …155・haulClose() …156・dealTrack() …160・gcfg() …175・allocAll() …178・csOpenToday() …181・cstockOf() …184・saveOrders() …185・arrivalToCenter() …187・salesToCenter() …188・planFor() …189・dailyOrder() …191・factoryReady() …212・slipTodo() …213・slipNow() …215・queueSlips() …216・matSync() …220・makeSlip() …222・nextCond() …237・editOrder() …238・expressLeft() …242・expressOpen() …243・todayExpress() …247・openExpress() …249・pendingExpress() …250・addToExpress() …253・orderExpress() …256・addOnOk() …260・addOnNext() …261・addOnToday() …262・orderAddOn() …263・expressConfirm() …268・onDuty() …273・curSet() …274・edit() …275・■ 商品ごとの「いま」 …279・counts() …281・nextDelivery() …284・pinfo() …285・motText() …289・withText() …291・ST_LABEL …293・orderDiff() …296・orderText() …297・■ 骨組み …299・CSS …300・mount() …390・setMult() …405・badge() …406・readNews() …409・openFromBadge() …411・setOpen() …412・■ 開店前：場所を選ぶ …415・renderSetup() …416・■ 要注意：売り切れ・品出し待ち・残りわずか（押すと商品カード） …429・renderAlert() …430・openSheet() …441・closeSheet() …442・renderSheet() …443・updateSheet() …478・■ 画面全体 …482・render() …483・renderWhich() …496・lifeLine() …501・renderKpi() …505・renderBody() …510・evText() …522・LF0 …535・KIND …538・lfMatch() …541・lfBar() …549・lfSummary() …568・lfCsv() …580・PAGE …589・renderLog() …590・flushLog() …608・centerBox() …616・slipLine() …627・flowLine() …632・■ 荷物の行方（アイデア帳 6.・2026-11-08）：注文番号ごとに、売上の記録 → 注文 → 製造 → 納品書 → 到着を時刻の順に。計算は js/track-core.js、時刻は data/center.json の flow・track …639・trkNow() …642・trkSplit() …643・trkEst() …645・trkRuns() …647・trkRuns0() …648・trkList() …655・renderTrack() …657・renderItems() …714・updateItems() …775・renderLayout() …780・basketStats() …794・renderPeople() …803・crewSave() …832・renderCrew() …833・renderMoney() …915・moveCard() …929・shrinkCard() …949・renderNews() …958・■ 売店の正面の絵 …961・BOX …962・zoneSlots() …963・rr() …964・drawItem() …965・drawKiosk() …975・personColor() …1004・spawnFromEvent() …1005・bubble() …1010・stepPeople() …1011・drawPerson() …1020・draw() …1025・onCanvasClick() …1046・loop() …1049・■ 起動 …1054・公開 minatoKiosk …1056

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

## js/minato-store-view.js（381行）

DAYN …22・■ 読み込み・保存 …26・omStart() …31・omToday() …34・crewAd() …37・persist() …39・■ その日の計算 …42・ctxNow() …43・grpOn() …50・grp() …51・sdFor() …54・samedayNow() …56・localNow() …59・checkDay() …61・ensureRes() …64・closeToday() …68・tick() …72・■ 店を出す …75・openStore() …76・■ 売店の画面の上の欄 …81・PSN …82・KSC …85・conceptUI() …86・render() …100・panel() …118・omCard() …129・localLine() …140・cruiseLine() …147・samedayLine() …151・■ 絵：小さな絵を作っておく …157・mk() …159・LOOK …160・fig() …166・sprite() …185・basket() …188・handOf() …191・BAGC …199・suitcase() …200・propsDraw() …201・clockDraw() …245・dripsDraw() …250・box() …252・label() …253・bg() …254・DISP …298・shelfLayer() …299・■ 絵：毎コマ …313・bubble() …315・clerkDo() …318・view() …331・draw() …332・fxCtx() …368・click() …369・公開 MinatoStoreView …371

## js/money-core.js（111行）

centerCost() …12・dayLedger() …18・groupLedger() …51・project() …94・sumDays() …104・公開 MoneyCore …109

## js/money-view.js（125行）

CSS …17・flowSvg() …43・projHtml() …61・pairOf() …75・groupView() …76・render() …83・render0() …84・bind() …113・open() …114・close() …116・yesterday() …118・公開 minatoMoney …123

## js/port-core.js（26行）

today() …13・shipOf() …17・公開 PortCore …24

## js/rail-edit.js（172行）

DEPN …14・persist() …18・commit() …19・revert() …20・fixSel() …21・■ はじめ …23・init() …24・■ 描く …30・SEGP …31・railStroke() …32・drawRail() …36・drawOverlay() …49・■ 当たり判定 …71・hit() …72・snapTo() …88・depotSh() …94・■ 指・マウス（route-editor.js から呼ぶ） …96・down() …97・move() …98・up() …112・tapEmpty() …125・tapDraw() …126・endDraw() …130・hover() …132・cancel() …133・del() …134・undo() …142・redo() …143・■ 下の棚 …145・dock() …146・exportJSON() …167・公開 RailEdit …169

## js/rail-shape.js（82行）

KEY …12・segKeys() …18・keyOf() …19・normalize() …22・load() …33・save() …34・flatten() …37・measure() …44・atLen() …46・stationsOf() …52・segCtrl() …53・depotOf() …54・build() …58・nearestOnPoly() …74・insertIndex() …77

## js/research-core.js（166行）

hash() …12・rng() …13・■ 場所を通る人（目的×時間） …20・footfall() …21・dwellOf() …28・ageMix() …31・emoneyP() …32・■ 調査1日分 …34・dayRecord() …36・soFar() …69・■ 集計：レポート …71・DAYK …72・aggregate() …73・■ 試算：業態ごとの売上と費用 …100・estimate() …102・erf() …162・公開 ResearchCore …164

## js/research-view.js（388行）

STORDER …12・DAYN …22・PCOL …23・■ 保存 …28・blank() …29・load() …30・persist() …34・■ その日の材料（終わった日の分を記録するため、日が進む前に覚えておく） …38・ctxFor() …39・tick() …43・addRecord() …49・startStudy() …52・stopStudy() …55・■ 骨組み …57・CSS …58・mount() …110・markM() …130・badge() …131・setOpen() …132・setMult() …133・■ 調査の計画 …135・renderPlan() …136・■ レポート …159・bars() …160・toKiosk() …162・renderReport() …166・renderEst() …203・render() …233・■ 映像 …237・scenePlace() …238・provisional() …239・platEvents() …241・loop() …254・COATS …257・rr() …259・sky() …260・person() …262・draw() …270・■ ホーム：このホームに着く列車（のりばが複数ある駅は、交互にこのホームへ着くものとする） …292・■ 起動 …382・公開 minatoResearch …384

## js/route-core.js（172行）

uid() …17・emptyDoc() …19・normalize() …22・■ 形（制御点の並び → 細かい折れ線） …37・ctrlOf() …38・bez() …40・bezPt() …42・flatten() …44・edgeFlat() …50・polyLen() …51・edgeLen() …52・■ 近いものをさがす …54・segNear() …55・nearestNode() …57・nearestEdge() …58・■ 点と道をいじる …63・addNode() …64・addEdge() …65・splitEdge() …67・anchor() …75・segX() …79・makeCrossings() …84・addPath() …99・edgesOf() …109・stopsOn() …110・dropOrphan() …111・deleteStop() …112・deleteNode() …113・deleteEdge() …115・mergeNodes() …117・detachNode() …123・insertBend() …127・■ いちばん近い道（ダイクストラ） …129・adjacency() …130・shortest() …132・linePath() …139・lineType() …143・lineStyle() …144・lineLanes() …146・■ 運行（第2段で使う） …151・tripsPerDay() …153・exportDoc() …156・simplify() …161・API …168

## js/route-editor.js（488行）

KEY …9・FONTS …10・FONTN …11・SHAPES …12・DASHN …13・DEF …15・MAP …19・■ 保存・元に戻す …22・save() …23・commit() …24・revert() …25・undo() …26・redo() …27・fixSel() …28・■ 見る位置 …34・fit() …36・zoomAt() …38・resize() …39・■ 線の描き方 …41・dashOf() …42・strokeStyled() …45・shapePath() …57・drawMarker() …65・LPV …73・autoLP() …74・labelBox() …78・drawLabel() …79・■ 路線の形（同じ道は並べてずらす） …87・offsetPoly() …88・linesGeom() …90・■ 背景：机・地図の絵・線路と駅 …104・drawTable() …105・drawSheet() …109・drawRail() …113・railStations() …124・■ 全体を描く（画面とPNGで共通） …125・drawScene() …126・frame() …162・■ 当たり判定 …164・hitStop() …166・hitHandle() …169・■ 指・マウス …171・pos() …173・endPointer() …207・dbl() …224・hoverCursor() …232・tapPen() …234・tapPoly() …235・endPoly() …239・tapStop() …240・newLine() …243・tapLine() …245・■ キー …251・delSel() …267・■ 見本の小さな絵 …269・swatch() …270・■ 画面の部品 …277・chip() …280・setTool() …281・focusName() …283・ui() …285・dots() …289・typeRow() …291・dock() …296・■ 路線の帳面 …330・showLines() …331・lineList() …334・lineEditor() …341・■ 見た目の小窓 …373・closePops() …374・openStyle() …375・renderStyle() …376・■ メニュー …417・download() …427・exportJSON() …429・bounds() …432・savePNG() …433・■ 例（メニューの「例を描いてみる」。元に戻すで消せる） …438・example() …439・■ はじめ …474・init() …475・公開 __routeEditor …485

## js/route-run-core.js（156行）

DEF …15・MEDIUM …19・■ 道すじ（折れ線） …24・mkPath() …25・at() …26・pose() …33・arcPts() …35・linePathPts() …38・reversePath() …54・■ 便 …56・departures() …57・capOf() …61・dwellOf() …62・STOPMODE …65・■ 1日のぶんを計算する …67・simulate() …69・run() …90・■ いまの姿 …138・stateAt() …140・API …153

## js/route-run.js（201行）

KEY …10・DEF …11・MODE …12・OWNER …13・■ 読み込み・計算（保存が変わったときだけ） …15・check() …17・■ 道と路線（動かないので1枚に作り置く） …22・shapePath() …23・offsetPoly() …32・strokePolys() …33・buildLayer() …34・■ 乗り物の絵（前が +x。上から見た形） …65・shade() …66・bus() …68・truck() …78・ship() …85・plane() …99・sticker() …109・■ 夜の明かり …115・glowDot() …116・lights() …117・■ 毎回の描画（index.html の drawMap から） …130・draw() …131・■ 押したときの小さなカード …155・CARD …158・card() …159・showCard() …179・hideCard() …192・click() …194・legend() …196・公開 RouteRunView …199

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

## js/track-core.js（123行）

fmt() …17・truck() …18・timeline() …26・phases() …43・where() …58・shelfTimes() …72・■ 取引先の分（取引の相談窓口の契約・第5回・2026-11-12。docs/deals-plan.md） …78・dealTimeline() …86・dealWhere() …114・公開 TrackCore …120

## js/train-art.js（118行）

DEF …12・CFG …18・outline() …27・hull() …31・poly() …35・lighten() …36

## js/links/deals-to-factory.js（25行）

linkOf() …13・on() …14・put() …16・settle() …19・公開 DealsToFactory …22

## js/links/deals-to-haiso.js（32行）

linkOf() …12・on() …13・put() …16・sell() …19・stops() …25・close() …27・公開 DealsToHaiso …29

## js/links/deals-to-money.js（21行）

linkOf() …8・on() …9・rows() …11・hauls() …14・sales() …17・公開 DealsToMoney …18

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
