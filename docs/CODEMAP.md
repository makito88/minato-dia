# コードの目次（自動で作る：`node tools/codemap.cjs`）

ファイルごとに、区切りのコメント（■）と、関数・大事な定数の名前と行番号。本体を読む前にここを grep して、必要な行だけ開く。

## index.html（3626行）

■ 乗車体験（試作） …392・START …694・MAIN …707・RAILBASE …711・RAILSHAPE …713・ALL …716・treeKm() …720・SEGS …726・POP …728・TYPES …730・CLS …736・ROUTES …737・DEPOTNAME …742・CARKM …743・PURP …745・OFFICE …746・EVENT_DATA …753・■ 追加イベント（20件）。季節の行事は、季節設定に含まれる通常の観光客とは別の「その日だけの上乗せ」です …777・■ 追加イベント（12件） …843・EVMAP …889・ACTIVE_EV …890・evScale() …891・addEventDemand() …892・evDwell() …896・evWindow() …897・registerEvent() …898・ENS …905・ECO …906・NEWD …907・mb32() …908・ENS_PH …910・ensReset() …911・econSeries() …913・shockSchedule() …924・ensDayFactors() …937・ecoApply() …949・ensRefresh() …950・■ 季節のできごと（計算は js/season-core.js、設定は data/seasonal.json と data/seasonal-extra.json） …951・SEAS …954・seasDayI() …955・seasRefresh() …956・seasApply() …965・seasKioskGenre() …967・newFlowsBase() …969・newFlowsAfter() …973・■ 1日の記録（あとで便りの判定に使う。集計値だけを残す） …977・ensRecord() …978・■ 便りの判定：続いている傾向だけを候補にする …1003・ensDetect() …1004・■ 景気のうわさ（自動のときだけ）：段階が変わってから数日遅れで、場所ごとの変化として届く …1031・ensEconNews() …1032・■ 地域の小さな波の便り：予兆（予告の日）と振り返り（終わってから） …1036・ensShockNews() …1037・■ 1日の終わりにまとめて呼ぶ：記録→判定→便りを選ぶ。state は保存される（運行日・記録・便り・再送禁止） …1044・ensFill() …1045・ensMakeLetter() …1046・ensEndDay() …1052・COND_DEF …1073・CONDS …1074・COND …1080・setCond() …1081・rateParts() …1089・ELAS …1122・computeService() …1123・demandTotals() …1141・rate() …1144・SPEND …1146・PROP …1147・runT() …1149・scheduleTrip() …1151・onSiding() …1199・buildAll() …1201・finishTrips() …1224・■ カスタムモード：1本ずつ筋を引いてダイヤを組む …1240・CUS_ST …1243・cusSeq() …1244・cusTrip() …1250・cusPlace() …1252・buildCustom() …1253・cusTry() …1257・cusBlocker() …1261・simulate() …1265・adv() …1275・makeEvents() …1319・eventImpacts() …1340・summarize() …1351・bsearch() …1374・■ state …1376・PRESETS …1378・PAT …1414・CUS …1417・cusSave() …1420・save() …1426・rebuild() …1427・■ theme …1436・readTheme() …1438・■ geometry …1445・unit() …1447・LANE_C …1459・stOff() …1460・bl() …1463・segPos() …1464・ease() …1472・tripState() …1473・DEPOT …1480・alongPath() …1482・setState() …1484・pathOf() …1498・pathAt() …1499・TPATH …1503・tripPath() …1504・carPoses() …1508・darkness() …1514・band() …1515・■ map drawing …1517・QFULL …1522・CDPR …1523・wantDpr() …1524・rng() …1525・BLOCKS …1526・TREES …1530・MAPBG …1532・drawTerrain() …1533・strokePts() …1558・RAIL …1559・PLATS …1561・drawTracks() …1564・drawTrainShape() …1600・VIS …1618・SMAP …1620・staticMap() …1621・drawMap() …1625・waitingAt() …1680・selSet() …1681・■ diagram …1683・diaGeom() …1685・drawDia() …1688・DIAW …1730・drawDiaLoad() …1732・setDiaW() …1746・markDiaW() …1747・diaHit() …1748・■ panels …1752・curTrip() …1754・trainStatus() …1755・setWhere() …1762・strip() …1771・renderTrain() …1785・■ station timetable …1804・ttStation() …1808・renderTT() …1810・departures() …1833・renderStation() …1835・PANE …1846・setPane() …1847・FB_ORDER …1855・fbStage() …1856・renderFormbar() …1865・refreshPanels() …1888・■ purposes …1915・binsFor() …1918・upto() …1923・niceMax() …1924・barChart() …1925・renderPurpose() …1946・mixBar() …1971・psStation() …1975・■ conditions …1978・saveCond() …1979・renderEventChips() …1981・renderCondUI() …1983・renderImpact() …1993・■ OD & sections …2001・flHour() …2003・renderFlow() …2004・odSide() …2031・odBars() …2033・trainOD() …2035・■ 共通の交通スナップショット（地図・ヒートマップ・イベント詳細・将来の運行日誌/車窓モードで共用） …2041・SNAP …2042・trafficSnapshot() …2043・■ 地図レイヤー …2050・LAYERS …2051・EVHIT …2053・segLine() …2054・pillText() …2056・drawHeat() …2057・drawStationLayer() …2065・evPos() …2069・■ 地図の上の薄い雲：ふわっとした雲の絵を数種類作っておき、ゆっくり流す。地面に薄い影も落とす …2070・CLOUDSPR …2071・cloudDim() …2077・drawClouds() …2079・drawEventIcons() …2086・renderLegend() …2098・renderMapNote() …2108・■ イベントの詳細 …2114・EVST …2116・renderEvStrip() …2118・selectEvent() …2121・renderEvent() …2123・■ 環境音エンジン（独立。音を鳴らせない環境でもゲーム本体には影響しない） …2145・SND …2147・noiseBuffer() …2154・voice() …2160・build() …2170・clink() …2185・chirp() …2188・shots() …2191・applyConfig() …2201・loadConfig() …2203・prep() …2211・decode() …2217・srcOf() …2218・load() …2219・startLoop() …2223・passBy() …2227・onboard() …2234・trainRec() …2243・occasional() …2251・listenerPos() …2263・targets() …2270・apply() …2303・setMaster() …2307・tick() …2309・start() …2317・quiet() …2322・stop() …2325・wake() …2326・onPlay() …2328・setVol() …2329・setPart() …2330・updateUI() …2331・effect() …2344・preload() …2349・■ 拡張用の入口（開発者ツールのコンソールから使えます） …2361・公開 minatoDia …2362・■ score …2365・renderScore() …2366・■ editor …2390・carsFor() …2391・renderEditor() …2392・renderEditorCounts() …2405・■ カスタムモードの画面 …2416・renderMode() …2417・renderCustom() …2422・cusPreview() …2435・■ controls …2456・setPlay() …2458・markSeg() …2461・setSpeed() …2462・markSpeed() …2463・liveTf() …2466・leaveLive() …2468・■ sizing …2497・resize() …2498・■ 乗車体験（試作）：客席から見た車内 …2504・RIDE …2507・kmOf() …2514・■ 素材の読み込み …2516・loadImg() …2517・load() …2518・buildStrips() …2528・■ 走り方（ダイヤから計算。地図の列車と同じ加減速の式 ease を使う） …2541・stopKin() …2542・kin() …2550・nextStop() …2559・■ 乗客（仮のシルエット）の席と立ち位置 …2562・seeded() …2563・makeSlots() …2564・targets() …2569・■ 描画：車内 …2572・fit() …2573・sceneryMix() …2575・duskW() …2582・variantsFor() …2583・drawScenery() …2588・drawStrip() …2590・drawSign() …2596・drawPlatform() …2603・drawWindow() …2611・windowContent() …2615・■ 窓から見える駅（通過・停車）：横から見たホームを、近くのものほど速く・大きく描く …2622・stationPeople() …2626・drawEkimeihyo() …2632・drawHanging() …2641・platNeighbors() …2647・personSprite() …2650・drawSprite() …2651・drawWaiter() …2653・personStyleS() …2694・stationLayer() …2699・■ 窓から見える駅を、車内の絵と同じ遠近法で描く（通路の奥＝消失点に向かって線が集まる） …2746・stationLayerP() …2749・drawCatenaryP() …2781・sceneryGL() …2797・drawSceneryP() …2841・drawStationViewP() …2856・drawStationView() …2858・weatherOnGlass() …2868・shade() …2875・rr() …2876・head() …2877・torso() …2879・drawStand() …2881・drawSeatLong() …2892・drawSeatCross() …2904・drawStandSprite() …2909・drawHeadSprite() …2912・drawPeople() …2915・levelSrc() …2926・drawLevels() …2927・drawDoorway() …2943・riderEvent() …2953・pickRider() …2955・drawPax() …2965・■ ドア上の案内表示（LED）：種別と、次の駅・お出口・乗り換え・接続などの案内を流す …2975・transferDirs() …2978・fasterConn() …2981・passWait() …2987・passAhead() …2989・ledSegs() …2991・drawLed() …3005・drawScene() …3016・■ 描画：ドア（開くと後ろにホームが見える） …3027・drawDoor() …3028・drawDoorGlass() …3041・■ 描画：車内の案内表示（枠は絵、画面の中は文字で描く） …3053・conn() …3054・monitorInfo() …3055・drawMonitor() …3060・■ 画面のまわり（混み具合・ボタン・状況） …3091・side() …3092・■ 確認表示：いまの区間・景色の混ざり具合・ホームを文字にする（描画と同じ関数から計算） …3110・debugInfo() …3112・laneOf() …3130・trainSize() …3133・trainScale() …3134・trainAt() …3137・platTrains() …3150・drawDoors() …3163・drawTrain() …3167・■ ホームで待つ人（仮の手描き。人数は waitingAt から） …3178・evOutfit() …3179・makePlatSlots() …3180・personStyle() …3186・drawPerson() …3192・crowdTarget() …3220・■ ホームの看板・時計・発車標 …3222・deps() …3223・tcol() …3226・drawClock() …3227・drawHangingBoard() …3232・neighbors() …3240・drawStationSign() …3242・■ ホームの描画とまわりの表示 …3251・platDraw() …3252・platInfo() …3273・trackLabel() …3280・drawLED() …3282・xferHTML() …3290・platSide() …3298・platSkip() …3309・setDir() …3311・toPlat() …3312・■ 入る・出る …3320・markSpd() …3321・enter() …3322・startRide() …3332・exit() …3337・doorSound() …3345・tick() …3348・alight() …3360・■ 沿線暦の画面：運行日・沿線だより・4つの見方・開発用の表示 …3376・ENSEN_UI …3378・load() …3382・persist() …3386・init() …3387・dayEnd() …3396・seasLetters() …3401・unread() …3406・renderBadge() …3407・srcLine() …3409・renderList() …3410・renderFilter() …3415・setOpen() …3417・renderDev() …3420・resetAll() …3437・renderCondExtra() …3440・renderEval() …3453・renderAll() …3463・mount() …3465・■ loop …3480・PERF …3482・PHONE …3492・drawGap() …3493・needDraw() …3495・frameDt() …3503・frame() …3504・■ 場面（コレクション）：data/scenes.json の場面を地図のピンにし、押すと小窓で開く …3513・SCENES …3514・scenePos() …3516・drawScenePins() …3518・openScene() …3524・■ いまの時刻と天気（日本時間・東京都立川市）につなぐ …3533・jstParts() …3535・liveT() …3536・WXK …3540・wxLog() …3542・holLog() …3543・fetchCal() …3544・liveCond() …3552・start() …3562

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

## js/kiosk-scene.js（255行）

hash() …18・■ 通り道（点と線のつながりで、いちばん短い道） …21・shortest() …22・near() …31・route() …32・■ 1人の買い物を、見せるための段取りにする（計算の出来事は変えない） …39・plan() …42・pose() …105・choose() …117・API …121・loadImg() …131・load() …132・frameOf() …147・personFor() …151・■ 描く …153・sizeAt() …154・sprite() …155・drawPerson() …156・drawStaff() …183・draw() …188・PAYN …210・caption() …211・■ 次の人を選ぶ …219・next() …220・■ 外から呼ぶもの …228・mount() …229・unmount() …242・tick() …244・公開 KioskScene …253

## js/kiosk-staff.js（226行）

hash() …12・rng() …13・hoursOf() …19・dayPlan() …23・brkOf() …35・minorOf() …37・canB() …42・realSpans() …43・TYPES …47・traits() …55・moodWord() …57・person() …60・create() …69・assign() …78・autoShift() …118・migrate() …121・wageFloor() …123・insuredOf() …129・weekHours() …131・today() …133・helpFill() …139・dayWorkers() …144・payOf() …162・adsOpen() …165・close() …168・gapsOf() …204・autoHire() …207・公開 KioskStaff …223

## js/kiosk-view.js（1124行）

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

## js/route-editor.js（478行）

KEY …9・FONTS …10・FONTN …11・SHAPES …12・DASHN …13・DEF …15・MAP …19・■ 保存・元に戻す …22・save() …23・commit() …24・revert() …25・undo() …26・redo() …27・fixSel() …28・■ 見る位置 …34・fit() …36・zoomAt() …38・resize() …39・■ 線の描き方 …41・dashOf() …42・strokeStyled() …45・shapePath() …57・drawMarker() …65・LPV …73・autoLP() …74・labelBox() …78・drawLabel() …79・■ 路線の形（同じ道は並べてずらす） …87・offsetPoly() …88・linesGeom() …90・■ 背景：机・地図の絵・線路と駅 …104・drawTable() …105・drawSheet() …109・drawRail() …113・■ 全体を描く（画面とPNGで共通） …123・drawScene() …124・frame() …159・■ 当たり判定 …161・hitStop() …163・hitHandle() …166・■ 指・マウス …168・pos() …170・endPointer() …202・dbl() …218・hoverCursor() …226・tapPen() …228・tapPoly() …229・endPoly() …233・tapStop() …234・newLine() …237・tapLine() …239・■ キー …245・delSel() …260・■ 見本の小さな絵 …262・swatch() …263・■ 画面の部品 …270・chip() …273・setTool() …274・focusName() …276・ui() …278・dots() …281・typeRow() …283・dock() …288・■ 路線の帳面 …321・showLines() …322・lineList() …325・lineEditor() …332・■ 見た目の小窓 …364・closePops() …365・openStyle() …366・renderStyle() …367・■ メニュー …408・download() …418・exportJSON() …420・bounds() …423・savePNG() …424・■ 例（メニューの「例を描いてみる」。元に戻すで消せる） …429・example() …430・■ はじめ …465・init() …466・公開 __routeEditor …475

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
