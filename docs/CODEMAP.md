# コードの目次（自動で作る：`node tools/codemap.cjs`）

ファイルごとに、区切りのコメント（■）と、関数・大事な定数の名前と行番号。本体を読む前にここを grep して、必要な行だけ開く。

## index.html（3815行）

■ 乗車体験（試作） …398・START …723・MAIN …736・RAILBASE …740・RAILSHAPE …742・ALL …745・treeKm() …749・SEGS …755・POP …757・TYPES …759・CLS …765・ROUTES …766・DEPOTNAME …771・CARKM …772・PURP …774・OFFICE …775・EVENT_DATA …782・■ 追加イベント（20件）。季節の行事は、季節設定に含まれる通常の観光客とは別の「その日だけの上乗せ」です …806・■ 追加イベント（12件） …872・EVMAP …918・ACTIVE_EV …919・evScale() …920・addEventDemand() …921・evDwell() …925・evWindow() …926・registerEvent() …927・ENS …934・ECO …935・NEWD …936・mb32() …937・ENS_PH …939・ensReset() …940・econSeries() …942・shockSchedule() …953・ensDayFactors() …966・ecoApply() …978・KFX …979・ensRefresh() …980・■ 季節のできごと（計算は js/season-core.js、設定は data/seasonal.json と data/seasonal-extra.json） …981・SEAS …984・BUSN …985・seasDayI() …986・seasRefresh() …987・seasApply() …998・seasKioskGenre() …1000・newFlowsBase() …1002・newFlowsAfter() …1006・■ 1日の記録（あとで便りの判定に使う。集計値だけを残す） …1010・ensRecord() …1011・■ 便りの判定：続いている傾向だけを候補にする …1036・ensDetect() …1037・■ 景気のうわさ（自動のときだけ）：段階が変わってから数日遅れで、場所ごとの変化として届く …1064・ensEconNews() …1065・■ 地域の小さな波の便り：予兆（予告の日）と振り返り（終わってから） …1069・ensShockNews() …1070・■ 1日の終わりにまとめて呼ぶ：記録→判定→便りを選ぶ。state は保存される（運行日・記録・便り・再送禁止） …1077・ensFill() …1078・ensMakeLetter() …1079・ensEndDay() …1085・COND_DEF …1106・CONDS …1107・COND …1113・setCond() …1114・rateParts() …1122・ELAS …1157・computeService() …1158・demandTotals() …1176・rate() …1179・SPEND …1181・PROP …1182・runT() …1184・scheduleTrip() …1186・onSiding() …1234・buildAll() …1236・finishTrips() …1259・■ カスタムモード：1本ずつ筋を引いてダイヤを組む …1275・CUS_ST …1278・cusSeq() …1279・cusTrip() …1285・cusPlace() …1287・buildCustom() …1288・cusTry() …1292・cusBlocker() …1296・simulate() …1300・adv() …1310・makeEvents() …1355・eventImpacts() …1376・summarize() …1387・bsearch() …1410・■ state …1412・PRESETS …1414・PAT …1451・CUS …1458・cusSave() …1461・MODE …1471・saveMode() …1476・save() …1479・rebuild() …1480・■ theme …1489・readTheme() …1491・■ geometry …1498・unit() …1500・LANE_C …1512・stOff() …1513・bl() …1516・segPos() …1517・ease() …1525・tripState() …1526・DEPOT …1533・alongPath() …1535・setState() …1537・pathOf() …1551・pathAt() …1552・TPATH …1556・tripPath() …1557・carPoses() …1561・■ 運行の記録で地図の列車を動かす（docs/run-record-plan.md の手順3・2026-11-25） …1566・MAPREC …1570・mapRec() …1572・recFrac() …1590・drawSynMap() …1592・darkness() …1603・band() …1605・■ map drawing …1607・QFULL …1612・CDPR …1613・wantDpr() …1614・rng() …1615・BLOCKS …1616・TREES …1620・MAPBG …1622・drawTerrain() …1623・strokePts() …1650・RAIL …1651・PLATS …1653・drawTracks() …1656・drawTrainShape() …1692・VIS …1710・SMAP …1712・staticMap() …1713・drawMap() …1717・waitingAt() …1776・selSet() …1777・■ diagram …1779・diaGeom() …1781・drawDia() …1784・DIAW …1826・drawDiaLoad() …1828・setDiaW() …1842・markDiaW() …1843・diaHit() …1844・■ panels …1848・curTrip() …1850・trainStatus() …1851・setWhere() …1858・strip() …1867・renderTrain() …1881・■ station timetable …1900・ttStation() …1904・renderTT() …1906・departures() …1929・renderStation() …1931・PANE …1942・setPane() …1943・FB_ORDER …1951・fbStage() …1952・renderFormbar() …1961・refreshPanels() …1984・■ purposes …2011・binsFor() …2014・upto() …2019・niceMax() …2020・barChart() …2021・renderPurpose() …2042・mixBar() …2067・psStation() …2071・■ conditions …2074・saveCond() …2075・renderEventChips() …2077・renderCondUI() …2079・renderImpact() …2089・■ OD & sections …2097・flHour() …2099・renderFlow() …2100・odSide() …2127・odBars() …2129・trainOD() …2131・■ 共通の交通スナップショット（地図・ヒートマップ・イベント詳細・将来の運行日誌/車窓モードで共用） …2137・SNAP …2138・trafficSnapshot() …2139・■ 地図レイヤー …2146・LAYERS …2147・EVHIT …2149・segLine() …2150・pillText() …2152・drawHeat() …2153・drawStationLayer() …2161・evPos() …2165・■ 地図の上の薄い雲：ふわっとした雲の絵を数種類作っておき、ゆっくり流す。地面に薄い影も落とす …2166・CLOUDSPR …2167・cloudDim() …2173・drawClouds() …2175・drawEventIcons() …2182・renderLegend() …2194・renderMapNote() …2204・■ イベントの詳細 …2210・EVST …2212・renderEvStrip() …2214・selectEvent() …2217・■ 運行の記録 段4〜6（docs/run-record-plan.md の手順5・2026-11-25） …2242・RRCFG …2246・railActual() …2248・公開 minatoRail …2276・renderEvent() …2283・■ 環境音エンジン（独立。音を鳴らせない環境でもゲーム本体には影響しない） …2305・SND …2307・noiseBuffer() …2314・voice() …2320・build() …2330・clink() …2345・chirp() …2348・shots() …2351・applyConfig() …2361・loadConfig() …2363・prep() …2371・decode() …2377・srcOf() …2378・load() …2379・startLoop() …2383・passBy() …2387・onboard() …2394・trainRec() …2403・occasional() …2411・listenerPos() …2423・targets() …2430・apply() …2463・setMaster() …2467・tick() …2469・start() …2477・quiet() …2482・stop() …2485・wake() …2486・onPlay() …2488・setVol() …2489・setPart() …2490・updateUI() …2491・effect() …2504・preload() …2509・■ 拡張用の入口（開発者ツールのコンソールから使えます） …2521・公開 minatoDia …2522・■ score …2525・renderScore() …2526・■ editor …2550・carsFor() …2551・renderEditor() …2552・renderEditorCounts() …2565・■ カスタムモードの画面 …2576・renderMode() …2577・renderCustom() …2582・cusPreview() …2595・■ controls …2616・setPlay() …2618・markSeg() …2621・setSpeed() …2622・markSpeed() …2623・liveTf() …2626・leaveLive() …2628・■ 2つのモード（手順4）：いまの沿線 ⇄ 試運転 …2631・setMode() …2632・markMode() …2638・modeToast() …2641・TESTSEL …2646・■ sizing …2679・resize() …2680・■ 乗車体験（試作）：客席から見た車内 …2686・RIDE …2689・kmOf() …2696・■ 素材の読み込み …2698・loadImg() …2699・load() …2700・buildStrips() …2710・■ 走り方（ダイヤから計算。地図の列車と同じ加減速の式 ease を使う） …2723・stopKin() …2724・kin() …2732・nextStop() …2741・■ 乗客（仮のシルエット）の席と立ち位置 …2744・seeded() …2745・makeSlots() …2746・targets() …2751・■ 描画：車内 …2754・fit() …2755・sceneryMix() …2757・duskW() …2764・variantsFor() …2765・drawScenery() …2770・drawStrip() …2772・drawSign() …2778・drawPlatform() …2785・drawWindow() …2793・windowContent() …2797・■ 窓から見える駅（通過・停車）：横から見たホームを、近くのものほど速く・大きく描く …2804・stationPeople() …2808・drawEkimeihyo() …2814・drawHanging() …2823・platNeighbors() …2829・personSprite() …2832・drawSprite() …2833・drawWaiter() …2835・personStyleS() …2876・stationLayer() …2881・■ 窓から見える駅を、車内の絵と同じ遠近法で描く（通路の奥＝消失点に向かって線が集まる） …2928・stationLayerP() …2931・drawCatenaryP() …2963・sceneryGL() …2979・drawSceneryP() …3023・drawStationViewP() …3038・drawStationView() …3040・weatherOnGlass() …3050・shade() …3057・rr() …3058・head() …3059・torso() …3061・drawStand() …3063・drawSeatLong() …3074・drawSeatCross() …3086・drawStandSprite() …3091・drawHeadSprite() …3094・drawPeople() …3097・levelSrc() …3108・drawLevels() …3109・drawDoorway() …3125・riderEvent() …3135・pickRider() …3137・drawPax() …3147・■ ドア上の案内表示（LED）：種別と、次の駅・お出口・乗り換え・接続などの案内を流す …3157・transferDirs() …3160・fasterConn() …3163・passWait() …3169・passAhead() …3171・ledSegs() …3173・drawLed() …3187・drawScene() …3198・■ 描画：ドア（開くと後ろにホームが見える） …3209・drawDoor() …3210・drawDoorGlass() …3223・■ 描画：車内の案内表示（枠は絵、画面の中は文字で描く） …3235・conn() …3236・monitorInfo() …3237・drawMonitor() …3242・■ 画面のまわり（混み具合・ボタン・状況） …3273・side() …3274・■ 確認表示：いまの区間・景色の混ざり具合・ホームを文字にする（描画と同じ関数から計算） …3292・debugInfo() …3294・laneOf() …3312・trainSize() …3315・trainScale() …3316・trainAt() …3319・platTrains() …3332・drawDoors() …3345・drawTrain() …3349・■ ホームで待つ人（仮の手描き。人数は waitingAt から） …3360・evOutfit() …3361・makePlatSlots() …3362・personStyle() …3368・drawPerson() …3374・crowdTarget() …3402・■ ホームの看板・時計・発車標 …3404・deps() …3405・tcol() …3408・drawClock() …3409・drawHangingBoard() …3414・neighbors() …3422・drawStationSign() …3424・■ ホームの描画とまわりの表示 …3433・platDraw() …3434・platInfo() …3455・trackLabel() …3462・drawLED() …3464・xferHTML() …3472・platSide() …3480・platSkip() …3491・setDir() …3493・toPlat() …3494・■ 入る・出る …3502・markSpd() …3503・enter() …3504・startRide() …3514・exit() …3519・doorSound() …3527・tick() …3530・alight() …3542・■ 沿線暦の画面：運行日・沿線だより・4つの見方・開発用の表示 …3558・ENSEN_UI …3560・load() …3564・persist() …3568・init() …3569・dayEnd() …3580・seasLetters() …3588・unread() …3593・renderBadge() …3594・srcLine() …3596・renderList() …3597・renderFilter() …3602・setOpen() …3604・renderDev() …3607・resetAll() …3624・renderCondExtra() …3627・renderEval() …3640・renderAll() …3650・mount() …3652・■ loop …3667・PERF …3669・PHONE …3679・drawGap() …3680・needDraw() …3682・frameDt() …3690・frame() …3691・■ 場面（コレクション）：data/scenes.json の場面を地図のピンにし、押すと小窓で開く …3701・SCENES …3702・scenePos() …3704・drawScenePins() …3706・openScene() …3712・■ いまの時刻と天気（日本時間・東京都立川市）につなぐ …3721・jstParts() …3723・liveT() …3724・WXK …3728・wxLog() …3730・holLog() …3731・fetchCal() …3732・liveCond() …3740・start() …3751

## js/away.js（104行）

KEY …15・load() …20・save() …21・hash() …25・ymdOf() …27・condFor() …30・catchUp() …40・■ 画面 …66・overlay() …67・show() …68・CSS …79・■ 起動 …88・公開 minatoAway …100

## js/bento-core.js（69行）

rng() …9・normalize() …10・simulate() …15・stage() …65・公開 BentoCore …66

## js/bento-view.js（92行）

liveNote() …9・save() …10・run() …11・plan() …15・recipes() …22・COLS …29・colOf() …30・stations() …32・result() …38・draw() …44・drawStage() …51・init() …84・tick() …88

## js/bread-core.js（213行）

BS_LABEL …19・rng() …21・gauss() …22・hm() …23・fermRate() …27・waterFor() …31・centerPart() …33・orders() …35・split() …39・flow() …42・simulate() …45・add() …62・rankOf() …172・judge() …173・公開 BreadCore …211

## js/bread-view.js（358行）

KEY …13・SPEEDS …15・liveNote() …18・ST_COLOR …19・load() …21・save() …22・css() …23・tempColor() …26・rgb() …28・pColor() …30・■ 切り替え …33・buildTabs() …34・■ 夕方に決める …50・buildPlan() …51・■ 回す・再生 …94・run() …95・buildPlay() …103・markSpeed() …110・markPlay() …111・tick() …112・drawAll() …116・■ 4つの時計 …121・drawClocks() …122・■ 工程の絵 …133・TITLES …134・layout() …135・rr() …140・txt() …141・hit() …142・selRing() …143・frame() …144・person() …145・tub() …149・drawStage() …157・drawMix() …168・drawFerm() …175・drawBench() …180・drawShape() …190・drawProof() …201・drawOven() …217・drawCool() …233・drawPack() …240・■ 生地ごとの帯 …247・drawGantt() …248・■ 生地を一つ追いかける …262・drawBatch() …263・■ 記録 …300・drawEvents() …301・■ 朝の答え合わせ …305・showResult() …306・changes() …327・onClick() …331・legends() …333・buildHeroes() …338・init() …343

## js/busnet-core.js（48行）

place() …13・expand() …17・eventFlows() …21・feeder() …31・compete() …35・table() …40・公開 BusNet …46

## js/center-core.js（272行）

storeKey() …23・orderNo() …24・genreOf() …25・genreCfg() …26・routeOf() …27・salesRecord() …32・cutOf() …44・preRecord() …45・shareBefore() …55・condW() …59・segShare() …64・plan() …75・factoryQty() …111・emptyLog() …120・dayOf() …121・putRecord() …122・putOrder() …124・trim() …131・recsOf() …132・supplyFor() …135・cart() …146・runOrder() …168・allocate() …178・supplyOrdFor() …186・truckFor() …188・csNew() …197・centerPids() …198・csDemand() …200・nextOrderDay() …208・onOrder() …209・wsQty() …211・csOpen() …215・centerOut() …227・csClose() …230・csOutlook() …236・hashS() …251・truckRuns() …252・flowOf() …256・arrival() …260・putArrival() …267・公開 CenterCore …269

## js/center-flow.js（133行）

CSS …20・COL …45・html() …47・moneyHtml() …105・bind() …124・OPEN …129・公開 CenterFlow …131

## js/center-view.js（105行）

ST_NAME …14・CSS …16・dayLabel() …52・tabs() …54・bindTabs() …55・render() …56・open() …98・close() …99・公開 minatoCenter …103

## js/ctc-core.js（1042行）

layout() …35・laneOff() …46・laneOld() …53・■ 駅の形（data/ctc-haisen.json・2026-11-17） …63・prefLanes() …67・trackNo() …81・kmOf() …93・extY() …110・segPt() …128・bodyPts() …144・extPos() …157・frontOff() …166・setPL() …184・yardGeo() …206・laneGeo() …229・kPath() …238・trainPos() …243・reasons() …275・fmtMin() …311・highlights() …314・rng() …351・disturb() …354・disrupt() …390・card() …555・extST() …600・segKm() …605・runT() …606・synDwell() …608・buildReg() …614・regPut() …624・fitTrip() …633・synth() …681・fee() …707・synLate() …713・synOnSiding() …723・extConns() …727・synHighlights() …768・bigIncident() …807・requests() …820・boats() …841・policyStats() …851・■ 配線の層（2026-11-17）：同じ番線に2本が入らないように、番線を割りふり、入れないときは手前で待たせる …860・yard() …865・actual() …1032

## js/ctc-signal.js（508行）

■ 置き場所 …11・build() …12・■ いまの様子 …118・info() …121・nextBlocked() …130・state() …139・■ 絵（川辺の指令室 proto/kawabe と同じ部品・2026-11-18） …364・draw() …372・drawOcc() …433・bodyOf() …443・drawTop() …449・explain() …491

## js/ctc-view.js（840行）

genPoints() …15・init() …89・setZoom() …139・data() …148・ensureHl() …153・yardSets() …202・lateNow() …217・■ 編成の、いまの状態（車庫・回送・列車） …219・setNow() …220・restNow() …235・synNow() …241・depotPt() …254・yardPath() …261・buildSlots() …290・slotOf() …311・■ 線路 …318・line() …320・loop() …321・drawTrack() …322・drawBig() …413・ML_() …423・drawStations() …425・■ 列車 …441・loadOf() …446・drawTrain() …448・withBody() …498・pathBody() …504・deadAt() …511・bodyHit() …520・posAll() …527・draw() …663・■ 予告・無線・選んだもの …708・lists() …710・bars() …724・cmpBox() …734・synBox() …741・info() …752・onClick() …778・stX() …786・focusHl() …787・nextHighlight() …792・lateShare() …795・feeToday() …798・probe() …800・drawGantt() …814・tracks() …836・公開 CtcView …837

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

## js/keiei-core.js（136行）

create() …10・normalize() …13・progress() …23・status() …28・fx() …35・apply() …51・satisfaction() …62・closeDay() …81・canBuy() …98・buy() …105・metrics() …113・dividend() …122

## js/keiei-view.js（211行）

load() …52・save() …53・init() …55・today() …68・dayEnd() …75・groupDays() …83・groupBox() …85・■ 画面 …101・render() …102・invCard() …131・■ グラフ（SVG・3段：利益／乗降客数／満足度） …143・rows() …145・chart() …151・tipText() …181・bindChart() …185・onInput() …191・onClick() …194・公開 KeieiView …209

## js/kiosk-core.js（397行）

hash() …13・rng() …14・■ 下ごしらえ …21・index() …22・life() …24・shelfInfo() …26・defaultOrder() …31・■ 状態 …32・create() …33・■ 1日を動かす …39・simulate() …42・review() …303・■ 運行日を締める：評判・SNSの話題・常連・ブーム・在庫の持ちこし・知らせ …313・closeDay() …314・■ 移転：別の駅・場所へ移す（次の運行日から） …364・relocate() …369・migratePrices() …382・backAt() …387・stockAt() …388・idxAt() …389・soFar() …391・公開 KioskCore …395

## js/kiosk-scene.js（337行）

hash() …18・■ 通り道（点と線のつながりで、いちばん短い道） …21・shortest() …22・personDef() …32・walkPxOf() …33・near() …34・route() …35・natural() …46・■ 1人の買い物を、見せるための段取りにする（計算の出来事は変えない） …59・plan() …62・pose() …148・choose() …163・API …167・loadImg() …177・load() …178・frameOf() …193・personFor() …197・■ 描く …199・sizeAt() …200・sprite() …201・drawPerson() …202・drawStaff() …242・draw() …247・PAYN …275・caption() …276・■ 次の人を選ぶ …284・next() …285・■ 外から呼ぶもの …293・mount() …294・unmount() …309・■ カットイン（2026-11-14）：その場面だけ、手本の動画を小さな窓でフェードイン・アウトして見せる。見せているあいだ、店の絵は止める …310・clipFor() …311・clipStart() …317・clipEnd() …321・tick() …323・公開 KioskScene …335

## js/kiosk-staff.js（226行）

hash() …12・rng() …13・hoursOf() …19・dayPlan() …23・brkOf() …35・minorOf() …37・canB() …42・realSpans() …43・TYPES …47・traits() …55・moodWord() …57・person() …60・create() …69・assign() …78・autoShift() …118・migrate() …121・wageFloor() …123・insuredOf() …129・weekHours() …131・today() …133・helpFill() …139・dayWorkers() …144・payOf() …162・adsOpen() …165・close() …168・gapsOf() …204・autoHire() …207・公開 KioskStaff …223

## js/kiosk-view.js（1136行）

STORDER …12・DAYN …22・MSV …29・■ 読み込み・保存 …31・persist() …41・■ その日の計算 …45・ctxNow() …46・linkNow() …54・supplyOf() …57・slipWait() …59・truckOf() …60・cartOf() …62・supplyOrdOf() …67・fixDay1() …71・checkDay() …78・ensureRes() …81・tick() …85・closeToday() …86・orderFor() …98・nextOrderDay() …99・■ 川辺の配送センター（計算は js/center-core.js、設定は data/center.json） …100・center() …103・isAuto() …104・managed() …105・aimName() …106・loadOrders() …108・CSKEY …110・loadMoney() …113・moneyOf() …114・GKEY …122・loadGroup() …123・groupOf() …124・groupClose() …138・moneyClose() …140・loadCS() …141・saveCS() …142・csCtx() …143・■ 港駅の店をグループの流れにのせる（橋 minato-to-group・js/links/minato-to-group.js・2026-11-12） …147・MSV2 …149・portOn() …150・portIn() …151・portPut() …153・■ 取引の相談窓口 → 工場・お金（橋 deals-to-factory・deals-to-money・第2回・2026-11-12） …155・DKEY …157・dealsOn() …158・loadDeals() …159・dealPut() …160・dealSettle() …161・haulOn() …165・haulPut() …166・haulClose() …167・dealTrack() …171・gcfg() …186・allocAll() …189・csOpenToday() …192・cstockOf() …195・saveOrders() …196・arrivalToCenter() …198・salesToCenter() …199・planFor() …200・dailyOrder() …202・factoryReady() …223・slipTodo() …224・slipNow() …226・queueSlips() …227・matSync() …231・makeSlip() …233・nextCond() …248・editOrder() …249・expressLeft() …253・expressOpen() …254・todayExpress() …258・openExpress() …260・pendingExpress() …261・addToExpress() …264・orderExpress() …267・addOnOk() …271・addOnNext() …272・addOnToday() …273・orderAddOn() …274・expressConfirm() …279・onDuty() …284・curSet() …285・edit() …286・■ 商品ごとの「いま」 …290・counts() …292・nextDelivery() …295・pinfo() …296・motText() …300・withText() …302・ST_LABEL …304・orderDiff() …307・orderText() …308・■ 骨組み …310・CSS …311・mount() …401・setMult() …416・badge() …417・readNews() …420・openFromBadge() …422・setOpen() …423・■ 開店前：場所を選ぶ …426・renderSetup() …427・■ 要注意：売り切れ・品出し待ち・残りわずか（押すと商品カード） …440・renderAlert() …441・openSheet() …452・closeSheet() …453・renderSheet() …454・updateSheet() …489・■ 画面全体 …493・render() …494・renderWhich() …507・lifeLine() …512・renderKpi() …516・renderBody() …521・evText() …533・LF0 …546・KIND …549・lfMatch() …552・lfBar() …560・lfSummary() …579・lfCsv() …591・PAGE …600・renderLog() …601・flushLog() …619・centerBox() …627・slipLine() …638・flowLine() …643・■ 荷物の行方（アイデア帳 6.・2026-11-08）：注文番号ごとに、売上の記録 → 注文 → 製造 → 納品書 → 到着を時刻の順に。計算は js/track-core.js、時刻は data/center.json の flow・track …650・trkNow() …653・trkSplit() …654・trkEst() …656・trkRuns() …658・trkRuns0() …659・trkList() …666・renderTrack() …668・renderItems() …725・updateItems() …786・renderLayout() …791・basketStats() …805・renderPeople() …814・crewSave() …843・renderCrew() …844・renderMoney() …926・moveCard() …940・shrinkCard() …960・renderNews() …969・■ 売店の正面の絵 …972・BOX …973・zoneSlots() …974・rr() …975・drawItem() …976・drawKiosk() …986・personColor() …1015・spawnFromEvent() …1016・bubble() …1021・stepPeople() …1022・drawPerson() …1031・draw() …1036・onCanvasClick() …1057・loop() …1060・■ 起動 …1065・公開 minatoKiosk …1067

## js/kiosk-walk.js（184行）

begin() …22・visitors() …31・plan() …98・commit() …126・after() …146・公開 KioskWalk …182

## js/mapseason-core.js（216行）

■ 暦：MM-DD → 年の何日目（うるう年でも同じ目盛り） …17・CUM …18・md() …19・doy() …20・rel() …22・ramp() …23・bump() …25・weights() …29・capLine() …41・leafAt() …46・■ 雪：前の日から順に天気を読む。wxOf(ymd) → {wx:'sun'|'cld'|'rain'|'snow', hi} …51・addDays() …52・snowCover() …53・■ 決まった乱数・なめらかな乱数 …60・hash() …61・vnoise() …62・fbm() …64・■ 形 …66・inPoly() …67・segDist() …68・altAt() …69・■ 塗り（お絵かき帖の「季節」。保存 dia-routes の season：{v:1, paint:"…"}） …71・dims() …72・rleEnc() …73・rleDec() …74・normalize() …76・paintAt() …77・■ 絵の1点ずつ：木・針葉樹・草・水・明るさ・場所の乱数（1回だけ） …81・attrs() …83・■ 場所ごと（2×2 の地図の単位のマス）：山の高さ・田んぼ・桜・梅・塗った紅葉 …95・cells() …98・blur() …127・■ その日の色に塗りかえる …132・recolor() …135・■ 花の点（桜・梅・散った花びら）：決まった乱数で、毎回同じ場所 …195・stamps() …197・■ 夜：雪明かりと桜のライトアップの強さ …210・lightupK() …211

## js/mapseason-edit.js（60行）

LOOK …14・init() …16・season() …19・grid() …20・store() …21・bg() …24・make() …27・■ 描く（塗ったところと筆の輪） …30・draw() …32・■ 指・マウス …38・down() …39・move() …40・up() …42・cancel() …43・■ 下の棚 …45・dock() …46・公開 SeasonEdit …58

## js/mapseason-render.js（68行）

prepare() …15・artPx() …19・build() …22・masks() …39・drawNight() …50・drawPetals() …60・公開 MapSeasonRender …66

## js/mapseason-view.js（57行）

KEY …15・CFG …16・ART …17・loadArt() …23・check() …24・init() …28・resW() …30・today() …31・stateKey() …32・rebuild() …35・later() …44・poke() …45・image() …47・key() …48・snowLift() …49・snowLo() …50・drawOver() …51

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

## js/money-core.js（118行）

centerCost() …12・dayLedger() …18・groupLedger() …51・project() …101・sumDays() …111・公開 MoneyCore …116

## js/money-view.js（126行）

CSS …17・flowSvg() …43・projHtml() …61・pairOf() …75・groupView() …76・render() …83・render0() …84・bind() …114・open() …115・close() …117・yesterday() …119・公開 minatoMoney …124

## js/night-core.js（148行）

■ 決まった乱数（マスの番号と何番目かから） …17・hash() …18・■ 日の入り・日の出（簡単な式。誤差は数分） …20・doy() …21・sunTimes() …22・darkness() …28・■ 時刻ごとの割合（[時, 割合] を直線でつなぐ。24時で0時に戻る） …34・frac() …35・■ マス目 …39・dims() …40・rleEnc() …42・rleDec() …43・inPoly() …45・codeOf() …46・zoneOf() …47・autoZones() …49・■ 地図の絵から「建物らしさ」を拾う …57・hsv() …59・pickScore() …60・■ 塗りと自動をあわせる …72・blankPaint() …73・normalize() …74・merge() …77・■ 明かり1つずつ …82・palette() …84・lights() …85・stars() …100・aviation() …105・■ 道 …111・roadStyle() …113・zidAt() …114・roads() …115・roadTypeOf() …127・■ まとめて作る（ゲームとお絵かき帖で同じ） …129・model() …131・paintAt() …139・■ イベントの光の種類 …142・eventFx() …143

## js/night-edit.js（78行）

TIMES …14・init() …17・pick() …19・night() …20・grids() …22・store() …23・mdl() …24・■ 描く …27・ymdNow() …28・draw() …30・■ 指・マウス …45・val() …46・down() …47・move() …48・up() …50・cancel() …51・■ 下の棚 …53・dock() …54・公開 NightEdit …76

## js/night-render.js（135行）

SPR …14・hexRgb() …15・sprite() …17・mk() …20・canvasOf() …21・■ 1枚の光の絵を作る …24・build() …27・■ 光 …32・■ 幕 …78・groups() …88・■ 毎コマの小さな光（地図の座標の変換がかかった c に描く） …90・dyn() …92・along() …118・evFx() …121・HSL …131・公開 NightRender …133

## js/night-view.js（55行）

KEY …14・CFG …15・pickImage() …20・check() …22・redraw() …24・model() …27・init() …31・dark() …32・draw() …35・roadAlpha() …51

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

## js/route-editor.js（527行）

KEY …9・FONTS …10・FONTN …11・SHAPES …12・DASHN …13・DEF …15・MAP …19・■ 保存・元に戻す …22・save() …23・commit() …24・revert() …25・undo() …26・redo() …27・fixSel() …28・■ 見る位置 …34・fit() …36・zoomAt() …38・resize() …39・■ 線の描き方 …41・dashOf() …42・strokeStyled() …45・shapePath() …57・drawMarker() …65・LPV …73・autoLP() …74・labelBox() …78・drawLabel() …79・■ 路線の形（同じ道は並べてずらす） …87・offsetPoly() …88・linesGeom() …90・■ 背景：机・地図の絵・線路と駅 …104・drawTable() …105・drawSheet() …109・drawRail() …113・railStations() …124・■ 全体を描く（画面とPNGで共通） …125・drawScene() …126・frame() …164・■ 当たり判定 …166・hitStop() …168・hitHandle() …171・■ 指・マウス …173・pos() …175・endPointer() …213・dbl() …232・hoverCursor() …240・tapPen() …242・tapPoly() …243・endPoly() …247・tapStop() …248・newLine() …251・tapLine() …253・■ キー …259・delSel() …275・■ 見本の小さな絵 …277・swatch() …278・■ 画面の部品 …285・chip() …288・setTool() …289・focusName() …291・ui() …293・dots() …297・typeRow() …299・dock() …304・■ 路線の帳面 …340・showLines() …341・lineList() …344・lineEditor() …351・■ 見た目の小窓 …383・closePops() …384・openStyle() …385・renderStyle() …386・■ メニュー …427・download() …437・exportJSON() …439・bounds() …442・savePNG() …443・■ 例（メニューの「例を描いてみる」。元に戻すで消せる） …448・example() …449・■ - …484・groupRoutes() …488・■ はじめ …511・init() …512・公開 __routeEditor …524

## js/route-run-core.js（156行）

DEF …15・MEDIUM …19・■ 道すじ（折れ線） …24・mkPath() …25・at() …26・pose() …33・arcPts() …35・linePathPts() …38・reversePath() …54・■ 便 …56・departures() …57・capOf() …61・dwellOf() …62・STOPMODE …65・■ 1日のぶんを計算する …67・simulate() …69・run() …90・■ いまの姿 …138・stateAt() …140・API …153

## js/route-run.js（201行）

KEY …10・DEF …11・MODE …12・OWNER …13・■ 読み込み・計算（保存が変わったときだけ） …15・check() …17・■ 道と路線（動かないので1枚に作り置く） …22・shapePath() …23・offsetPoly() …32・strokePolys() …33・buildLayer() …34・■ 乗り物の絵（前が +x。上から見た形） …65・shade() …66・bus() …68・truck() …78・ship() …85・plane() …99・sticker() …109・■ 夜の明かり …115・glowDot() …116・lights() …117・■ 毎回の描画（index.html の drawMap から） …130・draw() …131・■ 押したときの小さなカード …155・CARD …158・card() …159・showCard() …179・hideCard() …192・click() …194・legend() …196・公開 RouteRunView …199

## js/run-record-core.js（142行）

keyOf() …28・build() …33・where() …100・at() …108・liveAt() …124・boardAt() …130

## js/run-record.js（51行）

init() …14・input() …21・get() …31・公開 RunRecord …43

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

## js/train-art.js（135行）

DEF …13・CFG …19・outline() …31・hull() …35・poly() …39・lighten() …40・shade() …47・drawMono() …48

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
