/* 長い指令パネルの計算（DOM なし・node で読める）。docs/ctc-plan.md の段1。
   - 線路の形：キロどおりの縮尺（pxk＝1kmあたりの px）。本線は下の段に横一直線、温泉支線は川辺の東で分かれて上の段へ。
   - 列車の位置：ゲームの trips（seq・arr・dep・stop・op・down・set）と時刻 T から、キロと番線を出す。計算は変えない（読むだけ）。
   - 停車が長い理由：今のダイヤの中の「通過待ち・接続・行き違い・間かく・イベント」を、列車ごとに見分ける（index.html の makeEvents と同じ決まり）。
   - 数字・名前はすべて架空。線路の数は docs/map-tiles/haisen.json（配線図の案）にそろえる。 */
(function (root) {
  'use strict';
  const Y = { main: 300, br: 118, lane: 14, side: 42, l5: 70, brLoop: 14, pyd: 96, dep: 112, kenou: 372, freight: 420 };   /* 2026-11-18：川辺の指令室と同じ部品が入るように、番線のあいだを広げた（lane 9→14・side 27→42）。l5＝中央5番線、pyd＝港留置線のいちばん上（本線から上へ） */
  const MAIN = ['C', 'S', 'U', 'M', 'K', 'N', 'P'], BR = ['K', 'F', 'T', 'O'];
  /* 川辺の分かれ道（川辺から支線の道のり km）：駅の東で本線から分かれ、少し上がって平らな所で上下がまとまり、上の段へのぼる
     下り：下りの本線から JUNC0 で分かれる／上り：上りの本線から UP0 で、下りの本線を平面交差して UP1 で合流 */
  const JUNC0 = 0.4, LV0 = 0.5, LV1 = 0.9, JUNC1 = 1.3, UP0 = 0.5, UP1 = 0.75, LVY = -50;
  const OS = 0.36;   /* 温泉：駅の手前で2線に分かれる長さ（ホーム 0.22km の外で分かれる） */
  const LANES = { C: [-Y.side, -Y.lane, Y.lane, Y.side, Y.l5], P: [-Y.side, -Y.lane, Y.lane, Y.side] };
  const SIGBOX = 2.0;   /* 森下〜峠の交換信号所（森下から km）。2026-11-18 から使う：ここで上りと下りが行き違える */   /* 温泉の手前で2線に分かれる長さ */
  const STA = 0.35;                  /* 駅のポイントの範囲（駅の中心から km） */
  const ML = 2.8;                    /* 中央より西に取る幅（km）：中央車庫と県央本線 */
  const TYPE_COL = { L: '#e8792b', R: '#2f7fc0', E: '#c23a4c', X: '#3f8a63' };
  const TYPE_BODY = { L: '#f3f1ea', R: '#efe5c8', E: '#8e1f2e', X: '#2f5a48' };
  const REASON = {
    taihi: { name: '通過待ち', col: '#f0b44c' },
    conn: { name: '接続', col: '#5fc6e8' },
    kokan: { name: '行き違い待ち', col: '#c59cf0' },
    follow: { name: '前の列車との間かく', col: '#9fb3c4' },
    route: { name: '進路の待ち（運転停車）', col: '#9fb3c4' },
    incident: { name: 'できごと', col: '#ff6b6b' },
    crowd: { name: '混雑（乗り降り）', col: '#ff9b5c' },
    late: { name: '遅れ（前の列車・単線・接続）', col: '#e8c95c' },
    connCut: { name: '接続の打ち切り', col: '#7fb0ff' },
    swap: { name: '順番の入れかえ', col: '#7fe0b0' },
    recover: { name: '回復運転', col: '#8fd18f' },
  };
  const SHORT = { crowd: '混雑', late: '前の遅れ', connCut: '接続打切', swap: '入れかえ', recover: '回復', incident: 'できごと', taihi: '通過待ち', conn: '接続', kokan: '行き違い', follow: '間かく', route: '運転停車' };

  function layout(ST, pxk) {
    pxk = pxk || 200;
    const xm = km => (ML + km) * pxk;
    const xK = xm(ST.K.km);
    const xb = bkm => xK + bkm * pxk;
    const W = Math.ceil(Math.max(xm(ST.P.km + 1.4), xb(ST.O.bkm + 1.2)));
    return { pxk, xm, xb, xK, W, H: 520, Y, ML, JUNC0, LV0, LV1, JUNC1, UP0, UP1, LVY, OS, STA };
  }
  const smooth = u => { u = Math.max(0, Math.min(1, u)); return u * u * (3 - 2 * u); };

  /* 駅 i で、その列車が使う番線のずれ（y）。本線は Y.main から、支線は Y.br から */
  function laneOff(tr, i, env) {
    if (tr.lanes && tr.lanes[i] != null) return tr.lanes[i];   /* 配線の層（yard）が決めた番線 */
    const fx = env.laneFix && env.laneFix.get(tr);
    if (fx && fx.i === i) return fx.o;   /* 頭端の駅で、ほかの列車と同じ番線にならないように画面で決めた番線 */
    if (env.hs && env.hs.stations && env.hs.stations[tr.seq[i]]) return prefLanes(tr, i, env)[0];
    return laneOld(tr, i, env);
  }
  function laneOld(tr, i, env) {
    const s = tr.seq[i], p = tr.set ? tr.set.plat : 0, toBr = tr.seq.includes('O');
    if (s === 'C') return LANES.C[tr.synth ? 0 : p % 5];   /* 中央5線・港4線（docs/track-dia-study.md のユーザーの決め） */
    if (s === 'P') return LANES.P[p % 4];
    if (s === 'O') return [-Y.lane, Y.lane][tr.num % 2];
    if (s === 'F' || s === 'T') return tr.down ? -Y.brLoop : Y.brLoop;
    if (s === 'K' && toBr) return tr.down ? -Y.side : (env.onSiding && env.onSiding(tr, i) ? Y.side : Y.lane);   /* 川辺：温泉へは1番線、温泉からは3番線（通過待ちのときは4番線。指令盤の試作と同じ） */
    const base = tr.down ? -Y.lane : Y.lane;
    return (env.ST[s].taihi && env.onSiding(tr, i)) ? base * 3 : base;
  }
  /* ---- 駅の形（data/ctc-haisen.json・2026-11-17） ---- */
  const LCODE = { '-k': -(Y.side + 28), c: 0, '-s': -Y.side, '-l': -Y.lane, l: Y.lane, s: Y.side, s5: Y.l5, '-b': -Y.brLoop, b: Y.brLoop, b3: Y.brLoop * 2.6 };
  const lc = c => LCODE[c];
  /* その列車が駅 i で使える番線（はじめのものから）。今までの決め方（待避は外側など）を先に */
  function prefLanes(tr, i, env) {
    const s = tr.seq[i], st = env.hs.stations[s], old = laneOld(tr, i, env), A = st.alt || {};
    let list;
    if (A.any) list = (tr.synth && A.synOut && tr.seq[i + 1] === 'W' ? A.synOut : tr.synth && A.syn ? A.syn : A.any);   /* 中央：県央本線の西へ出る乗り入れは南側（出の線） */
    else {
      const d = tr.down ? 'down' : 'up', pass = !tr.stop[i] && i > 0 && i < tr.seq.length - 1, toBr = tr.seq.includes('O') && s === 'K';
      list = (toBr && tr.down && A.toBr) || (toBr && !tr.down && A.fromBr) || (pass && A[d + 'Pass']) || A[d] || st.lanes;
    }
    const L = list.map(lc);
    if (st.rule === 'outerStop') return L;   /* 緑ヶ丘：止まる列車はいつもホームの線（外側）、通過は まん中の通過線 */
    const k = L.indexOf(old); if (k > 0) { L.splice(k, 1); L.unshift(old); }
    return L;
  }
  /* 駅 i の番線の番号（1から）。発車標に出す */
  function trackNo(tr, i, env) {
    const s = tr.seq[i];
    if (env.hs && env.hs.stations && env.hs.stations[s]) { const st = env.hs.stations[s], k = st.lanes.map(lc).indexOf(laneOff(tr, i, env)); if (k >= 0) return st.num[k] || '通過線'; }
    if (s === 'W' || s === 'Q') return tr.down ? 1 : 2;
    const o = laneOff(tr, i, env);
    if (s === 'C' || s === 'P') return LANES[s].indexOf(o) + 1;
    if (s === 'O') return o < 0 ? 1 : 2;
    if (s === 'F' || s === 'T') return o < 0 ? 1 : 2;
    if (env.ST[s].taihi) return o === -Y.side ? 1 : o === -Y.lane ? 2 : o === Y.lane ? 3 : 4;
    return tr.down ? 1 : 2;
  }
  const onBranch = s => s === 'F' || s === 'T' || s === 'O';
  function kmOf(s, env, br) { return br ? (s === 'K' ? 0 : env.ST[s].bkm) : env.ST[s].km; }

  /* 列車の位置 {x,y,dir,moving,i,dwell} */
  const YK5 = Y.main - Y.side - 20, YK6 = YK5 - 16;   /* 県央本線の高さ：K5＝西行き（南側）、K6＝東行き（北側） */
  /* 中央の西の連絡線と港の臨港線の形（km, y）。ctc-view.js の drawTrack もこれを描く（2026-11-18・ユーザーの図）。
     入り：県央本線（東行き K6）から K5 を平面交差して1番線へ（2番線へは渡り線）。出：4・5番線から西へ出て、南西を回って K5（西行き）へ。
     臨港線：下りは下りの本線から上りの本線をまたいで南へ、上りは上りの本線へ合流。県央北：1番線の東のはしから北東の県央本線へ（乗り入れだけ） */
  const LINK = {
    inW: [[-9, YK6], [-1.05, YK6], [-0.55, Y.main - Y.side]],
    in2: [[-0.5, Y.main - Y.side], [-0.35, Y.main - Y.lane]],
    outW: [[-0.7, Y.main + Y.l5], [-1.0, Y.main + Y.l5], [-1.5, YK5], [-9, YK5]],
    out4: [[-0.33, Y.main + Y.side], [-0.43, Y.main + Y.l5]],   /* 4番線から出の線へは、西のはしご（1番線→5番線のななめ）を通る */
    north: [[0.34, Y.main - Y.side], [0.66, YK5 - 40 * (0.36 / 0.45)]],
    frt: [-1.5, -1.4, -1.07, -0.8, -0.7],   /* 港からの km：下りの本線をはなれる・上りの本線・南へ下りきる・ターミナルの手前・ターミナルの線 */
  };
  const poly = (P, k) => { if (k <= P[0][0]) return P[0][1]; for (let j = 1; j < P.length; j++) if (k <= P[j][0]) { const a = P[j - 1], b = P[j]; return a[1] + (b[1] - a[1]) * (k - a[0]) / ((b[0] - a[0]) || 1); } return P[P.length - 1][1]; };
  /* 連絡線・臨港線の線路の形：区間 i の km での高さ（2026-11-18：列車の動きと車体の両方がこれを使う） */
  function extY(tr, i, km, env) {
    const n = tr.seq.length, a = tr.seq[i], b = tr.seq[Math.min(n - 1, i + 1)], M = Y.main, run = tr.down ? -Y.lane : Y.lane;
    const qk = (tr.num >> 1) % 4, qy = Y.freight - 14 + qk * 9;
    if (a === 'W' || b === 'W') {
      const yc = M + laneOff(tr, a === 'C' ? i : i + 1, env);
      if (tr.down) { if (km > -0.35) return yc; return km < -0.55 ? poly(LINK.inW, km) : yc === M - Y.lane ? poly(LINK.in2, km) : M - Y.side; }   /* 入り（北） */
      const asc = P => P.slice().sort((p, q) => p[0] - q[0]);   /* 出（南） */
      return km < -0.7 ? poly(asc(LINK.outW), km) : yc === M + Y.side ? (km < -0.45 ? poly(asc(LINK.out4), km) : yc) : M + Y.l5;
    }
    /* 臨港線 */
    const P = env.ST.P.km, F = LINK.frt.map(d => P + d), N = env.ST.N.km, oN = laneOff(tr, a === 'N' ? i : i + 1, env);
    const y0 = Y.freight - 14, jx = P + LINK.frt[3] + qk * 9 * PER;
    const tq = [[F[0], tr.down ? M - Y.lane : M + Y.lane], [F[1], M + Y.lane], [F[2], y0], [F[3], y0], [jx, qy], [P + 1, qy]];
    if (km < F[0]) return M + (Math.abs(km - N) < 0.8 ? laneGeo('N', Math.abs(km - N), oN, run) : run);
    return poly(tq, km);
  }
  const isExt = (tr, i) => { const n = tr.seq.length, a = tr.seq[i], b = tr.seq[Math.min(n - 1, i + 1)]; return tr.synth && (a === 'W' || a === 'Q' || b === 'W' || b === 'Q'); };
  /* 区間 i（seq[i]→seq[i+1]）の線路の上の、km の所の点。br の区間は支線のキロ（川辺から） */
  function segPt(tr, i, km, L, env) {
    const n = tr.seq.length; i = Math.max(0, Math.min(n - 2, i));
    if (isExt(tr, i)) return { x: L.xm(km), y: extY(tr, i, km, env) };
    const a = tr.seq[i], b = tr.seq[i + 1], br = onBranch(a) || onBranch(b), oa = laneOff(tr, i, env), ob = laneOff(tr, i + 1, env);
    if (!br) {
      const run = tr.down ? -Y.lane : Y.lane, ca = env.ST[a].km, cb = env.ST[b].km, da = Math.abs(km - ca), db = Math.abs(km - cb);
      return { x: L.xm(km), y: Y.main + (da <= db ? laneGeo(a, da, oa, run) : laneGeo(b, db, ob, run)) };
    }
    if (km < GEO.K.J1) return { x: L.xb(km), y: poly(kPath(tr.down, a === 'K' ? oa : ob), km) };
    let y = Y.br;
    for (const s of ['F', 'T', 'O']) { const d = Math.abs(km - env.ST[s].bkm); if (d < GEO[s].d0 + STEP) { const o = s === a ? oa : s === b ? ob : 0; y = Y.br + laneGeo(s, d, o, 0, true); } }
    if (env.ST.X && GEO.X) { const d = Math.abs(km - env.ST.X.bkm); if (d < GEO.X.d0 + STEP) y = Y.br + laneGeo('X', d, tr.down ? -Y.brLoop : Y.brLoop, 0, true); }   /* 交換信号所：下りは上の線、上りは下の線を通る */
    return { x: L.xb(km), y };
  }
  const segIsBr = (tr, i) => { const n = tr.seq.length; i = Math.max(0, Math.min(n - 2, i)); return !isExt(tr, i) && (onBranch(tr.seq[i]) || onBranch(tr.seq[i + 1])); };
  /* 車体：先頭（区間 j・km）から、通ってきた線路をさかのぼって len px ぶんの点（先頭から最後尾へ）。駅をまたぐと、ひとつ前の区間の線路へ */
  function bodyPts(tr, j, km, lenPx, L, env) {
    const dir = tr.down ? 1 : -1, n = tr.seq.length, out = [], dk = 1.5 / L.pxk; let got = 0, prev = segPt(tr, j, km, L, env);
    out.push([prev.x, prev.y]);
    for (let k = 0; k < 600 && got < lenPx; k++) {
      km -= dir * dk;
      const s0 = tr.seq[j], k0 = kmOf(s0, env, segIsBr(tr, j));
      if (j > 0 && (km - k0) * dir < 0) { const k1 = kmOf(s0, env, segIsBr(tr, j - 1)); km = k1 + (km - k0); j--; }
      const q = segPt(tr, j, km, L, env), d = Math.hypot(q.x - prev.x, q.y - prev.y);
      if (got + d >= lenPx) { const u = (lenPx - got) / (d || 1); out.push([prev.x + (q.x - prev.x) * u, prev.y + (q.y - prev.y) * u]); got = lenPx; break; }
      got += d; out.push([q.x, q.y]); prev = q;
    }
    void n; return out;
  }
  function extPos(tr, i, T, L, env) {
    const n = tr.seq.length, a = tr.seq[i], b = tr.seq[Math.min(n - 1, i + 1)];
    if (T < tr.dep[i] || i === n - 1) { const km = env.ST[a].km + (a === 'C' ? frontOff(tr, i, env) : 0), j = i === n - 1 ? i - 1 : i, p = segPt(tr, j, km, L, env); return { x: p.x, y: p.y, dir: tr.down ? 1 : -1, moving: false, i, seg: j, km }; }
    const raw = Math.max(0, Math.min(1, (T - tr.dep[i]) / (tr.arr[i + 1] - tr.dep[i]))), f = raw * 0.35 + 0.65 * smooth(raw);
    const ka = env.ST[a].km + (a === 'C' ? frontOff(tr, i, env) : 0), kb = env.ST[b].km + (b === 'C' ? frontOff(tr, i + 1, env) : 0), km = ka + (kb - ka) * f;
    const p = segPt(tr, i, km, L, env);
    return { x: p.x, y: p.y, dir: tr.down ? 1 : -1, moving: true, i, f: raw, seg: i, km };
  }
  /* 止まる位置のずれ（km・列車の先頭）。env.hs があるときだけ。中ほどの駅はホームの真ん中に、頭端の駅は車止め側に、千鳥の駅はずらす */
  function frontOff(tr, i, env) {
    const st = env.hs && env.hs.stations && env.hs.stations[tr.seq[i]]; if (!st) return 0;
    const n = tr.seq.length, len = (tr.cars || 6) * 0.02, s = tr.seq[i];
    if (st.stop === 'head') { const west = s === 'C'; if (west) return tr.down && (i === 0 || tr.seq[i - 1] === 'W') ? len : 0;   /* 中央：下りは東のはしまで出て止まる（連絡線から来る臨時・貨物も） */ return !tr.down && i === 0 ? -len : 0; }
    void n;
    if (st.stop === 'stagger') return tr.down ? -0.025 : 0.025;   /* 千鳥：まん中の踏切をふさがない位置に止まる */
    /* ホームの真ん中に止まる。止まる予定のない列車（運転停車・乱れで待つ貨物など）も同じ所に。ホームより長い編成でも、先頭は出発信号をこえない */
    const f = Math.min(len / 2, (GEO[s] ? GEO[s].sig : 0.2) - 0.015);
    return tr.down ? f : -f;
  }
  /* 駅のまわりの線路の形（2026-11-18・ユーザーの頼み）：
     - ホームの長さ＝その駅に止まるいちばん長い編成（setPL でゲームの列車から入れる）。列車がホームからはみ出ない
     - 出発信号は、止まった列車の先頭のすぐ先（sig）。分かれる線はその先（d0）から
     - 線は均等に：番線のあいだ（28px）を変えるのに STEP km。どの駅でも同じ傾き
     - 駅の中心からの km。ctc-view.js の drawTrack・ctc-signal.js もこの数字を使う */
  const STEP = 0.1, HEAD = { C: 1, P: -1, O: -1 };
  let PL = {};
  const GEO = {};
  function setPL(m) {
    PL = m || {};
    for (const s of ['C', 'S', 'U', 'M', 'K', 'N', 'P', 'F', 'T', 'O']) {
      const L = PL[s] || (['F', 'T', 'O'].includes(s) ? 0.08 : 0.16), g = { L, step: STEP };
      /* ホームは列車の両はしから 0.01km。出発信号は先頭から 0.04km（信号の丸がホームにかからない）。分かれ道はその先 0.04km */
      if (HEAD[s]) { const h = HEAD[s]; g.head = h; g.plat = h > 0 ? [-0.01, L + 0.01] : [-(L + 0.01), 0.01]; g.sig = L + 0.04; g.d0 = L + 0.08; }
      else if (s === 'N') { g.plat = { down: [-(L + 0.035), -0.015], up: [0.015, L + 0.035] }; g.sig = 0.005; g.d0 = L + 0.075; }
      else { g.plat = [-(L / 2 + 0.01), L / 2 + 0.01]; g.sig = L / 2 + 0.04; g.d0 = L / 2 + 0.08; }
      const outer = s === 'C' ? 2 : 1;   /* 中央の5番線は2つ分 */
      g.cross = s === 'S' || s === 'N' ? [g.d0 + 0.03, g.d0 + STEP + 0.03] : ['C', 'P', 'U'].includes(s) ? [g.d0 + outer * STEP + 0.03, g.d0 + (outer + 1) * STEP + 0.03] : null;
      GEO[s] = g;
    }
    /* 川辺：もとの指令盤（proto/kawabe）と同じ形。1番線の東で 1E（本線へ）と 1B（温泉支線へ）に分かれ、
       支線から来る上りは ⑥ で分かれて下りの本線を平面交差し、⑦ で上りの本線に合流 */
    { const L = PL.X || Math.max(GEO.F.L, GEO.T.L, 0.12); GEO.X = { L, step: STEP, sig: L / 2 + 0.04, d0: L / 2 + 0.08, plat: null, cross: null }; }   /* 交換信号所：いちばん長い編成が待てる長さの行き違い線 */
    { const c = GEO.C.d0; LINK.north = [[c, Y.main - Y.side], [c + 0.32, YK5 - 40 * ((c + 0.32 - 0.3) / 0.45)]]; }
    const k = GEO.K; k.X7 = k.d0 + STEP + 0.05; k.X6 = k.X7 + 3 * STEP; k.J1 = k.X6 + 0.05 + 4 * STEP; k.LV = -(Y.side + 28);
  }
  setPL({});
  /* 車庫・留置線・貨物ターミナルの形（2026-11-18・ユーザーの図）：はしご（ななめの線）から、どの線も止まるいちばん奥までつながる。
     y は画面の px、x は km（中央からのキロ。港・温泉は駅からのずれ dx）。ctc-view.js の線路・回送の通り道、ctc-signal.js の入換信号が使う */
  const PER = STEP / (2 * Y.lane);   /* 1px 下がるのに進む km（どの線も同じ傾き） */
  /* 車庫・留置線の大きさ（2026-11-27）：組んだダイヤで同時に泊まる編成の数から決める。中央車庫は14本のまま、1本に置ける編成（奥行き）を2〜4に。
     温泉留置線は1〜4本（1本に2編成）。yard() が、渡された編成から数えて決める */
  const YCAP = { C: 2, O: 1 };
  function yardCap() { return { C: { nt: 14, depth: YCAP.C, cap: 14 * YCAP.C }, P: { nt: 4, depth: 2, cap: 8 }, O: { nt: YCAP.O, depth: 2, cap: 2 * YCAP.O } }; }
  /* 置き場所の番号 j → 線（t）と奥行き（k：0 がいちばん奥＝行き止まりの側） */
  function slotTrk(h, j) { return h === 'C' ? j % 14 : h === 'P' ? j % 4 : (j / 2) | 0; }
  function slotDep(h, j) { return h === 'C' ? (j / 14) | 0 : h === 'P' ? (j / 4) | 0 : j % 2; }
  function setYardNeed(need) {
    YCAP.C = Math.max(2, Math.min(4, Math.ceil((need.C || 0) / 14)));
    YCAP.O = Math.max(2, Math.min(4, Math.ceil(((need.O || 0) - 1) / 2)));   /* 2本から（運転整理で温泉に残る編成が出るため） */
  }
  function yardGeo() {
    const M = Y.main, cy = k => M + Y.dep + 6 + k * 6;
    /* 中央車庫：14本。はしご2本（上の7本・下の7本）。はしご1は3番線から、はしご2は5番線から。はしご1と2のあいだに渡り線 */
    const XA = -0.85, XB = XA - 7 * 6 * PER + 0.08;
    const CD = YCAP.C, C = { n: 14, tracks: [], park: CD <= 2 ? [-2.15, -1.5] : Array.from({ length: CD }, (_, k) => -2.15 + k * (0.81 / (CD - 1))), x0: -2.2 };   /* 奥行き3・4：西のはしから -1.34km まで等間かく（いちばん長い10両でも分かれ目にかからない） */
    for (let k = 0; k < 14; k++) C.tracks.push({ y: cy(k), jx: k < 7 ? XA - k * 6 * PER : XB - (k - 7) * 6 * PER, lad: k < 7 ? 0 : 1 });
    C.lead = [[[XA, cy(0)], [XA + (cy(0) - (M + Y.lane)) * PER, M + Y.lane]], [[XB, cy(7)], [XB + (cy(7) - (M + Y.l5)) * PER, M + Y.l5]]];
    C.ladder = [[[XA, cy(0)], [XA - 6 * 6 * PER, cy(6)]], [[XB, cy(7)], [XB - 6 * 6 * PER, cy(13)]]];
    { const y1 = cy(0) - 34, y2 = y1 + 12, at = (L, y) => L[0][0] + (L[0][1] - y) * PER; C.xover = [[at(C.lead[0], y1), y1], [at(C.lead[1], y2), y2]]; }
    /* 西のはしご：1番線から5番線まで、ななめに1本（ホームの西のはし） */
    C.west = [[-0.03, M - Y.side], [-0.03 - (Y.l5 + Y.side) * PER, M + Y.l5]];
    /* 港留置線：4本。下りの本線からななめに上がり、いちばん上の線が はしごの終わり */
    const PY = k => M - Y.pyd + k * 9, Pj = k => -0.8 - (M - Y.lane - PY(k)) * PER;
    const P = { n: 4, tracks: [0, 1, 2, 3].map(k => ({ y: PY(k), jx: Pj(k) })), park: [-1.65, -1.4], x0: -1.7, lead: [[-0.8, M - Y.lane], [Pj(0), PY(0)]] };
    /* 港貨物ターミナル：4本。臨港線が いちばん上の線になり、ななめに下りながら右へ分かれる */
    const QY = k => Y.freight - 14 + k * 9, Q = { n: 4, tracks: [0, 1, 2, 3].map(k => ({ y: QY(k), jx: LINK.frt[3] + k * 9 * PER })), x1: 0.3 };
    Q.lead = [[LINK.frt[3], QY(0)], [LINK.frt[3] + 27 * PER, QY(3)]];
    /* 温泉留置線：1〜4本（1本に2編成）。単線から ななめに下りて西へ。2本目からは、ななめの線をのばして 9px ずつ下に */
    const g = GEO.O, oj = g.d0 + STEP / 2 + 0.12, ON = YCAP.O, oy = m => Y.br + 32 + m * 9;
    const O = { n: ON, tracks: Array.from({ length: ON }, (_, m) => ({ y: oy(m), jx: -(oj + (oy(m) - Y.br) * PER) })), park: [-1.5, -1.1], x0: -1.6, lead: [[-oj, Y.br], [-(oj + (oy(ON - 1) - Y.br) * PER), oy(ON - 1)]] };
    return { C, P, Q, O };
  }
  const lin = u => Math.max(0, Math.min(1, u));
  /* 駅の中心から d km の所での、番線 o の高さ（run＝本線の高さ、base 0 は単線から分かれる駅） */
  function laneGeo(s, d, o, run, single) {
    const G = GEO[s], base = single ? 0 : o < 0 ? -Y.lane : Y.lane;
    let y = run;
    if (!single && Math.sign(base) !== Math.sign(run) && G.cross) y = run + (base - run) * lin((G.cross[1] - d) / (G.cross[1] - G.cross[0]));
    else if (single) y = 0;
    if (o !== base) { const fl = Math.abs(o - base) / (2 * Y.lane) * STEP; y += (o - base) * lin((G.d0 + fl - d) / fl); }
    return y;
  }
  /* 川辺〜支線の道すじ（km, y）：下り＝1番線→1B→支線、上り＝支線→⑥→平面交差→⑦→3番線（4番線へは分かれる） */
  function kPath(down, oK) {
    const k = GEO.K, M = Y.main, LV = M + k.LV;
    return down ? [[0, M + oK], [k.d0, M - Y.side], [k.d0 + STEP, LV], [k.X6 + 0.05, LV], [k.J1, Y.br]]
      : [[0, M + oK], [k.d0, M + oK], [k.d0 + STEP, M + Y.lane], [k.X7, M + Y.lane], [k.X6, LV], [k.X6 + 0.05, LV], [k.J1, Y.br]];
  }
  function trainPos(tr, T, L, env) {
    const n = tr.seq.length;
    let i = 0; while (i < n - 1 && tr.arr[i + 1] <= T) i++;
    if (tr.synth) { const a = tr.seq[i], b = tr.seq[Math.min(n - 1, i + 1)], stopped = T < tr.dep[i] || i === n - 1; if (a === 'W' || a === 'Q' || (!stopped && (b === 'W' || b === 'Q'))) return extPos(tr, i, T, L, env); }
    const st = k => tr.seq[k];
    if (T < tr.dep[i] || i === n - 1) {   /* 駅に止まっている：先頭の位置（ひとつ前の区間の線路の上。始発は次の区間） */
      const j = i > 0 ? i - 1 : 0, km = kmOf(st(i), env, segIsBr(tr, j)) + frontOff(tr, i, env), p = segPt(tr, j, km, L, env);
      return { x: p.x, y: p.y, dir: tr.down ? 1 : -1, moving: false, i, seg: j, km };
    }
    const a = st(i), b = st(i + 1), br = onBranch(a) || onBranch(b);
    let raw = Math.max(0, Math.min(1, (T - tr.dep[i]) / (tr.arr[i + 1] - tr.dep[i])));
    if (tr.hold && tr.hold.i === i) {   /* 段5：事故にあった列車は、その場所で再開まで止まる */
      const h = tr.hold, a0 = tr.dep[i] + h.f * h.run, a1 = a0 + h.dur;
      raw = T < a0 ? h.f * (T - tr.dep[i]) / Math.max(0.01, a0 - tr.dep[i]) : T < a1 ? h.f : h.f + (1 - h.f) * Math.min(1, (T - a1) / Math.max(0.01, tr.arr[i + 1] - a1));
    }
    /* 止まる駅でだけ、ゆっくり出て・ゆっくり止まる（通過する駅では速いまま。追いこしの前後で列車が重ならないように） */
    const sa = i === 0 || tr.stop[i], sb = i + 1 === n - 1 || tr.stop[i + 1];
    const f = sa && sb ? raw * 0.35 + 0.65 * smooth(raw) : sa ? raw * 0.35 + 0.65 * raw * raw : sb ? raw * 0.35 + 0.65 * (1 - (1 - raw) * (1 - raw)) : raw;
    const ka = kmOf(a, env, br) + frontOff(tr, i, env), kb = kmOf(b, env, br) + frontOff(tr, i + 1, env);
    let km = ka + (kb - ka) * f, xwait = false;
    const xw = tr.xw && tr.xw[i];
    if (xw && env.ST.X && !tr.hold) {   /* 交換信号所で行き違いを待つ：行き違い線の真ん中に止まる */
      const dir = tr.down ? 1 : -1, ks = env.ST.X.bkm + dir * Math.min((tr.cars || 6) * 0.01, GEO.X.sig - 0.015);
      if (T < xw[0]) { const u = Math.max(0, Math.min(1, (T - tr.dep[i]) / Math.max(0.05, xw[0] - tr.dep[i]))); km = ka + (ks - ka) * (u * 0.35 + 0.65 * (1 - (1 - u) * (1 - u))); }
      else if (T <= xw[1]) { km = ks; xwait = true; }
      else { const u = Math.max(0, Math.min(1, (T - xw[1]) / Math.max(0.05, tr.arr[i + 1] - xw[1]))); km = ks + (kb - ks) * (u * 0.35 + 0.65 * u * u); }
    }
    const p = segPt(tr, i, km, L, env);
    return { x: p.x, y: p.y, dir: tr.down ? 1 : -1, moving: true, i, f: raw, seg: i, km, xwait };
  }

  /* 停車が長い理由（いくつでも）。[{code, min, txt, by}] */
  function reasons(tr, i, env) {
    const out = [], s = tr.seq[i], n = tr.seq.length;
    const name = t => env.TYPES[t.type].name + ' ' + t.num;
    const stName = env.ST[s].name;
    if (i === n - 1) return out;
    const ev = tr.stop[i] ? env.evDwell(s, tr.arr[i]) : 0;
    if (ev > 0.05) {
      const nm = env.evName ? env.evName(s, tr.arr[i]) : '';
      out.push({ code: 'incident', min: ev, txt: `${stName}で${nm || 'できごと'}のため停車を長く（+${fmtMin(ev)}）` });
    }
    const nom = env.nomDwell(tr, i);
    let extra = (i === 0 ? (tr.want != null ? tr.dep[0] - tr.want : 0) : tr.dep[i] - tr.arr[i] - nom);
    if (extra < 0.3) return out;
    if (i === 0) { out.push({ code: 'follow', min: extra, txt: `${stName}で、前の列車との間かくをあけるため発車を遅らせる（+${fmtMin(extra)}）` }); return out; }
    if (env.onSiding(tr, i)) {
      for (const o of env.trips) {
        if (o === tr || o.down !== tr.down || env.TYPES[o.type].prio <= env.TYPES[tr.type].prio) continue;
        const j = o.seq.indexOf(s); if (j < 0) continue;
        if (o.arr[j] >= tr.arr[i] - 0.1 && o.arr[j] <= tr.dep[i] + 0.1) {
          if (o.stop[j] && o.dep[j] > o.arr[j]) out.push({ code: 'conn', min: extra, by: o, txt: `${stName}で${name(o)}と接続（乗りかえ）を待つ（+${fmtMin(extra)}）` });
          else out.push({ code: 'taihi', min: extra, by: o, txt: `${stName}で${name(o)}の通過待ち（+${fmtMin(extra)}）` });
        }
      }
      if (out.some(r => r.code === 'conn' || r.code === 'taihi')) return out;
    }
    if (s === 'F' || s === 'T') {
      for (const o of env.trips) {
        if (o === tr || o.down === tr.down) continue;
        const j = o.seq.indexOf(s); if (j < 0) continue;
        if (o.arr[j] >= tr.arr[i] - 0.2 && o.arr[j] <= tr.dep[i] + 0.2) { out.push({ code: 'kokan', min: extra, by: o, txt: `${stName}で${name(o)}との行き違い待ち（+${fmtMin(extra)}）` }); return out; }
      }
    }
    if (tr.op && tr.op[i]) out.push({ code: 'route', min: extra, txt: `${stName}で、前の列車が先の区間を出るまで運転停車（+${fmtMin(extra)}）` });
    else out.push({ code: 'follow', min: extra, txt: `${stName}で、前の列車との間かくをあけるため待つ（+${fmtMin(extra)}）` });
    return out;
  }
  function fmtMin(m) { return m >= 1 ? Math.round(m) + '分' : Math.round(m * 60) + '秒'; }

  /* 見どころ（待避・接続・行き違い・出入庫）を、列車への参照つきで。index.html の makeEvents と同じ決まり */
  function highlights(trips, sets, env) {
    const ev = [], name = t => env.TYPES[t.type].name + ' ' + t.num;
    for (const tr of trips) tr.seq.forEach((s, i) => {
      if (!env.onSiding(tr, i)) return;
      for (const o of trips) {
        if (o === tr || o.down !== tr.down || env.TYPES[o.type].prio <= env.TYPES[tr.type].prio) continue;
        const j = o.seq.indexOf(s); if (j < 0) continue;
        if (o.arr[j] >= tr.arr[i] - 0.1 && o.arr[j] <= tr.dep[i] + 0.1) {
          const conn = o.stop[j] && o.dep[j] > o.arr[j];
          ev.push({ t: o.arr[j], k: conn ? 'conn' : 'taihi', st: s, a: tr, b: o,
            txt: conn ? `${env.ST[s].name}で ${name(tr)} と ${name(o)} が接続` : `${env.ST[s].name}で ${name(o)} が ${name(tr)} を追いこす`,
            radio: conn ? `指令から${tr.num}列車、${env.ST[s].name}で${o.num}列車の到着を待って、乗りかえを受けてください。`
              : `指令から${tr.num}列車、${env.ST[s].name}で待避。${o.num}列車を先に通します。` });
        }
      }
    });
    const brT = trips.filter(t => t.seq.includes('O'));
    for (const X of ['F', 'T']) for (let a = 0; a < brT.length; a++) for (let b = a + 1; b < brT.length; b++) {
      const A = brT[a], B = brT[b]; if (A.down === B.down) continue;
      const i = A.seq.indexOf(X), j = B.seq.indexOf(X);
      const s0 = Math.max(A.arr[i], B.arr[j]), s1 = Math.min(A.dep[i], B.dep[j]);
      if (s1 > s0 - 0.2) ev.push({ t: s0, k: 'kokan', st: X, a: A, b: B, txt: `${env.ST[X].name}で ${name(A)} と ${name(B)} が行き違い`,
        radio: `指令から${A.num}列車・${B.num}列車、${env.ST[X].name}で行き違い。単線区間の進路を順に開きます。` });
    }
    for (const s of sets) {
      ev.push({ t: s.first - (s.trips[0] && s.trips[0].lead0 != null ? s.trips[0].lead0 : 1) - 7, k: 'depot', st: s.home, set: s, txt: `${env.DEPOTNAME[s.home]}から ${s.label}（${s.cars}両）が出庫`, radio: `${env.DEPOTNAME[s.home]}、${s.label}の出庫を許可します。` });
      ev.push({ t: s.last + 3, k: 'depot', st: s.home, set: s, txt: `${s.label} が${env.DEPOTNAME[s.home]}に入庫`, radio: `${s.label}、本日の仕業おわり。${env.DEPOTNAME[s.home]}へ入庫してください。` });
    }
    ev.sort((a, b) => a.t - b.t);
    return ev;
  }


  /* ===== 段2：きょうの乱れ（見せ方の層。ゲームの乗客・運賃の計算には返さない） =====
     予定（ゲームのダイヤ）に、混雑とできごとの小さな遅れを足し、プロの手順（前の列車との間かく・単線の順番・
     接続は上限まで待つ・待避の順番の入れかえ・回復運転）で、実際の発着を出す。数字はすべて仮。 */
  const RULE = { hw: 2.0, hws: 0.5, connMax: 5, swapMin: 2, recover: 0.03, turn: 4, iter: 10, cancelMin: 20 };
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const SMALL = [['ドアに荷物がはさまり、開け直し', 0.5, 1.5], ['駆けこみ乗車', 0.3, 1.0], ['ホームの安全確認', 1.0, 2.0]];
  const MEDIUM = [['急病の人の手当て', 4, 8, 'stop'], ['線路に動物', 3, 6, 'run'], ['信号の確認', 2, 4, 'run']];
  function disturb(trips, env) {
    const R = rng((env.day || 1) * 7919 + trips.length * 13), dist = new Map();
    const put = (tr, i, o) => { let m = dist.get(tr); if (!m) dist.set(tr, m = {}); const c = m[i] || (m[i] = { dwell: 0, run: 0, txt: [] }); c.dwell += o.dwell || 0; c.run += o.run || 0; if (o.txt) c.txt.push(o); };
    for (const tr of trips) for (let i = 1; i < tr.seq.length - 1; i++) {
      if (!tr.stop[i] || !tr.cap) continue;
      const r = (tr.loadAfter && tr.loadAfter[i] || 0) / tr.cap, b = tr.bAt ? tr.bAt[i] || 0 : 0;
      const x = Math.min(1.5, Math.max(0, (r - 1.1) * 1.5) + Math.max(0, (b - 150) / 500));
      if (x >= 0.1) put(tr, i, { dwell: x, code: 'crowd', txt: `${env.ST[tr.seq[i]].name}で乗り降りに時間がかかった（${r >= 1.1 ? '車内' + Math.round(r * 100) + '%の混雑' : Math.round(b) + '人が乗った'}）` });
    }
    const rush = trips.filter(t => (t.dep[0] > 400 && t.dep[0] < 560) || (t.dep[0] > 1000 && t.dep[0] < 1140));
    const pickStop = tr => { const k = []; tr.seq.forEach((s, i) => { if (i > 0 && i < tr.seq.length - 1 && tr.stop[i]) k.push(i); }); return k.length ? k[Math.floor(R() * k.length)] : -1; };
    const ik = env.incidentK == null ? 1 : env.incidentK, nS = Math.round((3 + Math.floor(R() * 4)) * ik);   /* ik：保守の予算（経営のタブ） */
    for (let n = 0; n < nS && rush.length; n++) {
      const tr = rush[Math.floor(R() * rush.length)], i = pickStop(tr); if (i < 0) continue;
      const k = SMALL[Math.floor(R() * SMALL.length)], m = k[1] + R() * (k[2] - k[1]);
      put(tr, i, { dwell: m, code: 'incident', txt: `${env.ST[tr.seq[i]].name}で${k[0]}` });
    }
    if (R() < Math.min(0.95, 0.6 * ik)) {
      const k = MEDIUM[Math.floor(R() * MEDIUM.length)], pool = k[0] === '線路に動物' ? trips.filter(t => t.seq.includes('O')) : trips.filter(t => t.dep[0] > 330 && t.dep[0] < 1380);
      if (pool.length) {
        const tr = pool[Math.floor(R() * pool.length)], m = k[1] + R() * (k[2] - k[1]);
        if (k[3] === 'stop') { const i = pickStop(tr); if (i > 0) put(tr, i, { dwell: m, code: 'incident', big: true, txt: `${env.ST[tr.seq[i]].name}で${k[0]}` }); }
        else {
          const segs = []; for (let i = 0; i < tr.seq.length - 1; i++) { const br = onBranch(tr.seq[i]) || onBranch(tr.seq[i + 1]); if (k[0] !== '線路に動物' || br) segs.push(i); }
          const i = segs[Math.floor(R() * segs.length)];
          if (i != null) put(tr, i + 1, { run: m, code: 'incident', big: true, txt: `${env.ST[tr.seq[i]].name}〜${env.ST[tr.seq[i + 1]].name}で${k[0]}` });
        }
      }
    }
    if (env.big) put(env.big.tr, env.big.i + 1, { run: env.big.dur, code: 'stop', big: true, bigI: true, txt: `${env.ST[env.big.a].name}〜${env.ST[env.big.b].name}で${env.big.name}（この列車）` });   /* 段5：事故にあった列車は、その場で再開まで止まる */
    /* 自社の要望（段4）：受けた要望の分だけ、止まる時間をのばす */
    for (const q of env.requests || []) if (q.ok) for (const h of q.hits) put(h.tr, h.i, { dwell: h.min, code: 'request', txt: h.txt });
    if (env.pre) env.pre.forEach((o, tr) => put(tr, 0, { dwell: o.min, code: 'other', txt: o.txt }));
    return dist;
  }

  function disrupt(trips, hl, env) {
    /* 段4：方針（POLICY）で決まりの数字を変える。env.rule がなければ今までと同じ */
    const RL = Object.assign({}, RULE, env.rule || {}); env = Object.assign({}, env, { RL });
    const paid = t => t && (t.type === 'E' || t.type === 'X');
    /* 接続を待つ上限（分）。売上重視：料金のいる列車（特急・観光特急）は待たせず、特急からの乗りかえは長く待つ */
    const cmax = (tr, srcPaid) => RL.paid ? (paid(tr) ? RL.paidHold : srcPaid ? RL.paidWait : RL.connMax) : RL.connMax;
    const dist = disturb(trips, env), name = t => env.TYPES[t.type].name + ' ' + t.num;
    const A = new Map();
    trips.forEach(tr => A.set(tr, { arr: tr.arr.slice(), dep: tr.dep.slice(), why: tr.seq.map(() => []) }));
    /* 同じ駅から同じ向きに出る列車の順番（予定） */
    const order = {};
    trips.forEach(tr => tr.seq.forEach((s, i) => { if (i === tr.seq.length - 1) return; const k = s + (tr.down ? 'd' : 'u') + (onBranch(tr.seq[i + 1]) || onBranch(s) && tr.seq[i + 1] !== 'K' ? 'b' : 'm'); (order[k] || (order[k] = [])).push({ tr, i }); }));
    Object.values(order).forEach(L => L.sort((a, b) => a.tr.dep[a.i] - b.tr.dep[b.i]));
    const conns = hl.filter(h => h.k === 'conn'), passes = hl.filter(h => h.k === 'taihi' || h.k === 'conn' || h.k === 'passExtra'), ext = env.ext || [];
    const brSec = {};
    trips.filter(t => t.seq.includes('O')).forEach(tr => tr.seq.forEach((s, i) => { if (i === tr.seq.length - 1) return; const b = tr.seq[i + 1]; if (!(onBranch(s) || onBranch(b))) return; const key = [s, b].sort().join(''); (brSec[key] || (brSec[key] = [])).push({ tr, i }); }));
    /* 段5：大きな事故（env.big＝{name,a,b,t0,t1,dur,tr,i}）。その区間へは再開まで出さない（運転見合わせ）。
       先の駅に止められた列車がいるあいだは、手前の駅で待つ（駅の間に列車を止めない）。大きく遅れた編成は、1往復を運休して次から定時に戻す。env.big がなければ前と同じ */
    const BIG = env.big || null, cancelled = new Set(), cancels = [], NIT = RL.iter + (BIG ? 8 : 0);
    const blocked = (x, y) => BIG && ((x === BIG.a && y === BIG.b) || (x === BIG.b && y === BIG.a));
    const capOf = x => (x === 'C' || x === 'P' || x === 'O' || x === 'W' || x === 'Q') ? 9 : env.ST[x].taihi ? 2 : 1;
    const setsOf = BIG ? [...new Set(trips.filter(t => t.set && !t.synth).map(t => t.set))] : [];
    /* まだ始発駅（車庫のある駅）を出ていない列車で、再開の前に事故の区間へ入るはずのものは、1往復を運休（出すと手前の駅でつまる） */
    const pre = [];
    if (BIG) for (const st of setsOf) { const L = st.trips;
      for (let k = 0; k + 1 < L.length; k += 2) { const o = L[k], r = L[k + 1]; if (o.dep[0] < BIG.t0 - 0.01 || o.seq[0] !== r.seq[r.seq.length - 1]) continue;
        let hit = false; for (let j = 0; j < o.seq.length - 1; j++) if (blocked(o.seq[j], o.seq[j + 1]) && o.dep[j] < BIG.t1 - 3) hit = true;
        if (hit) { cancelled.add(o); cancelled.add(r); pre.push(o, r); } } }
    let swaps = new Set(), decisions = [];
    for (let it = 0; it < NIT; it++) {
      const nextSwaps = new Set();
      /* 待避の順番の入れかえ：追いこす予定の列車が大きく遅れていたら、待っている列車を先に出す */
      for (const h of passes) {
        const L = h.a, X = h.b, i = L.seq.indexOf(h.st), j = X.seq.indexOf(h.st);
        const xa = A.get(X).arr[j], lReady = A.get(L).arr[i] + env.nomDwell(L, i);
        if ((h.k === 'taihi' || h.k === 'passExtra') && !L.freight && xa - Math.max(lReady, L.dep[i]) > RL.swapMin) nextSwaps.add(h);   /* 貨物は遅いので先に出さない */
      }
      swaps = nextSwaps;
      const swapEarly = new Set([...swaps].map(h => h.a.num + '@' + h.a.seq.indexOf(h.st)));
      const ord = {};
      for (const k in order) {
        const L = BIG ? order[k].filter(o => !cancelled.has(o.tr)) : order[k].slice();
        for (const h of swaps) { const a = L.findIndex(o => o.tr === h.b && o.tr.seq[o.i] === h.st), b = L.findIndex(o => o.tr === h.a && o.tr.seq[o.i] === h.st); if (a >= 0 && b >= 0 && a < b) { const [x] = L.splice(b, 1); L.splice(a, 0, x); } }
        L.forEach((o, n) => { ord[o.tr.num + '@' + o.i] = n ? L[n - 1] : null; });
      }
      decisions = [];
      for (const tr of trips) {
        const a = A.get(tr), d = dist.get(tr) || {}, n = tr.seq.length;
        a.why = tr.seq.map(() => []);
        if (cancelled.has(tr)) { a.arr = tr.arr.slice(); a.dep = tr.dep.slice(); a.cancel = true; continue; }
        for (let i = 0; i < n; i++) {
          const s = tr.seq[i];
          if (i > 0) {
            const plannedRun = tr.arr[i] - tr.dep[i - 1], late = a.dep[i - 1] - tr.dep[i - 1];
            let run = plannedRun + ((d[i] && d[i].run) || 0);
            const rec = late > 0.3 ? Math.min(late, plannedRun * RL.recover) : 0;
            run -= rec;
            let arr = Math.max(tr.arr[i], a.dep[i - 1] + run);
            if (d[i] && d[i].run) a.why[i].push(...d[i].txt.map(o => ({ code: o.code, min: d[i].run, txt: o.txt, big: o.big })));
            if (rec > 0.05) a.why[i].push({ code: 'recover', min: -rec, txt: `${env.ST[tr.seq[i - 1]].name}〜${env.ST[s].name}で回復運転（−${fmtMin(rec)}）` });
            a.arr[i] = arr;
          }
          if (i === n - 1) { a.dep[i] = a.arr[i]; break; }
          const nom = env.nomDwell(tr, i), extra = (d[i] && d[i].dwell) || 0;
          const early = swapEarly.has(tr.num + '@' + i);   /* 入れかえで先に出る列車は、予定より早く出てよい */
          const minDep = early ? tr.arr[i] + nom : tr.dep[i];
          let dep = Math.max(minDep, (i === 0 ? tr.dep[0] : a.arr[i] + nom) + extra), cause = null;
          /* 折り返し：同じ編成の前の列車が遅れて着いたら */
          if (i === 0 && tr.set) {
            let k = tr.set.trips.indexOf(tr) - 1; while (k >= 0 && cancelled.has(tr.set.trips[k])) k--;   /* 運休した列車はとばす */
            const pv = k >= 0 ? tr.set.trips[k] : null;
            if (pv) { const pa = A.get(pv), ready = pa.arr[pa.arr.length - 1] + RL.turn; if (ready > dep + 0.01) { dep = ready; cause = { code: 'late', by: pv, txt: `${env.ST[s].name}で、折り返す前の${name(pv)}が遅れて着いたため` }; } }
          }
          if (d[i] && d[i].dwell) a.why[i].push(...d[i].txt.map(o => ({ code: o.code, min: o.dwell != null ? o.dwell : extra, txt: o.txt, big: o.big })));
          /* 前の列車との間かく（同じ向き・同じ駅から） */
          const pred = ord[tr.num + '@' + i];
          if (pred) { const pd = A.get(pred.tr).dep[pred.i] + (onBranch(s) ? RL.hws : RL.hw); if (pd > dep + 0.01) { dep = pd; cause = { code: 'late', by: pred.tr, txt: `${env.ST[s].name}で、前を走る${name(pred.tr)}が遅れているため発車を待つ` }; } }
          /* 単線：反対から来る列車が先に区間を出るまで */
          const b = tr.seq[i + 1];
          if (onBranch(s) || onBranch(b)) {
            const key = [s, b].sort().join(''), list = brSec[key] || [];
            for (const o of list) {
              if (o.tr.down === tr.down || cancelled.has(o.tr)) continue;
              const oa = A.get(o.tr), oEnter = o.tr.dep[o.i], tEnter = tr.dep[i];
              if (oEnter < tEnter - 0.01) { const free = oa.arr[o.i + 1] + RL.hws; if (free > dep + 0.01) { dep = free; cause = { code: 'late', by: o.tr, txt: `${env.ST[s].name}で、単線の反対から来る${name(o.tr)}の遅れを待つ（行き違いの順番はそのまま）` }; } }
            }
          }
          if (BIG) {
            /* 運転見合わせ：事故の区間へは、再開まで出さない */
            if (blocked(s, b) && tr !== BIG.tr && dep < BIG.t1 && (dep >= BIG.t0 - 0.01 || (tr.down === BIG.tr.down && dep > BIG.tr.dep[BIG.i]))) { dep = BIG.t1; cause = { code: 'stop', txt: `${env.ST[s].name}で運転見合わせ（${env.ST[BIG.a].name}〜${env.ST[BIG.b].name}の${BIG.name}）` }; }
            /* 先の駅がふさがっている：先の駅に、同じ向きの列車が入れる数（待避線のある駅は2本・川辺は温泉方面と本線で1本ずつ）だけ
               止められているあいだは、手前の駅で待つ。前を行く列車を6本までさかのぼって数える */
            const cap = capOf(b);
            if (cap < 9) {
              const grp = b === 'K' ? tr.seq.includes('O') : null, ds = []; let held = false, q = pred, over = 0;
              for (let c2 = 0; q && c2 < 6; c2++, q = ord[q.tr.num + '@' + q.i]) {
                const j = q.tr.seq.indexOf(b); if (j <= 0 || j >= q.tr.seq.length - 1) continue;
                if (grp != null && q.tr.seq.includes('O') !== grp) continue;
                if (q.tr.dep[j] > tr.dep[i + 1] - 0.01) { over++; continue; }   /* この列車が先の駅で追いこす相手（待避線で待っている）は数えない */
                const qd = A.get(q.tr).dep[j]; ds.push({ d: qd, tr: q.tr }); if (qd - q.tr.dep[j] > 1.5) held = true;
              }
              const lim = Math.max(1, (b === 'K' && grp ? 1 : cap) - over);
              if (held && ds.length >= lim) { ds.sort((x, y) => y.d - x.d); const h = ds[lim - 1], need = h.d + 0.3 - (tr.arr[i + 1] - tr.dep[i]); if (need > dep + 0.01) { dep = need; cause = { code: 'jam', by: h.tr, txt: `${env.ST[s].name}で待つ（先の${env.ST[b].name}に${name(h.tr)}が止まっているため）` }; } }
            }
          }
          /* 接続：相手が遅れても上限まで待つ */
          for (const h of conns) {
            if (h.a !== tr || h.st !== s) continue;
            const o = h.b; if (cancelled.has(o)) continue;
            const j = o.seq.indexOf(s), oa = A.get(o).arr[j], need = oa + 0.5, mx = cmax(tr, paid(o));
            if (need <= dep + 0.01) continue;
            if (need - tr.dep[i] <= mx) { dep = need; cause = { code: 'conn', by: o, txt: `${env.ST[s].name}で、遅れている${name(o)}からの乗りかえを待つ（上限${mx}分以内）` }; decisions.push({ t: tr.dep[i], k: 'conn', st: s, a: tr, b: o, hold: need - tr.dep[i], max: mx }); }
            else { decisions.push({ t: tr.dep[i], k: 'connCut', st: s, a: tr, b: o, late: oa - o.arr[j], max: mx }); a.why[i].push({ code: 'connCut', min: 0, by: o, txt: `${env.ST[s].name}：${name(o)}の遅れが上限${mx}分をこえたので、接続を打ち切って発車` }); }
          }
          /* 外との接続（他社線・バス・フェリー・臨時列車）：相手が遅れても上限まで待つ */
          for (const h of ext) {
            if (h.a !== tr || h.st !== s) continue;
            const oa = h.from ? A.get(h.from).arr[h.from.seq.indexOf(s)] : h.arr + h.late, need = oa + h.xfer, mx = cmax(tr, /特急/.test(h.label));
            if (need <= dep + 0.01) continue;
            if (need - tr.dep[i] <= mx) { dep = need; cause = { code: h.k, txt: `${env.ST[s].name}で、${h.from ? '遅れている' : fmtMin(oa - h.arr) + '遅れている'}${h.label}からの乗りかえを待つ（上限${mx}分以内）` }; decisions.push({ t: tr.dep[i], k: h.k, st: s, a: tr, ext: h, hold: need - tr.dep[i], late: oa - h.arr, max: mx }); }
            else { decisions.push({ t: tr.dep[i], k: 'connCut', st: s, a: tr, ext: h, late: oa - h.arr, max: mx }); a.why[i].push({ code: 'connCut', min: 0, txt: `${env.ST[s].name}：${h.label}の遅れ（${fmtMin(oa - h.arr)}）が上限${mx}分をこえたので、接続を打ち切って発車` }); }
          }
          if (cause) { cause.min = dep - Math.max(minDep, (i === 0 ? tr.dep[0] : a.arr[i] + nom) + extra); if (cause.min > 0.05) a.why[i].push(cause); }
          a.dep[i] = dep;
        }
      }
      /* 運休（間引き）：車庫のある駅に大きく遅れて戻った編成は、次の1往復を休んで、その次から定時に戻す */
      if (BIG && it < NIT - 4) for (const st of setsOf) {
        const L = st.trips;
        for (let k = 2; k + 1 < L.length; k += 2) {
          const o = L[k], r = L[k + 1]; if (cancelled.has(o) || o.dep[0] < BIG.t0 || o.seq[0] !== r.seq[r.seq.length - 1]) continue;
          let m = k - 1; while (m >= 0 && cancelled.has(L[m])) m--; if (m < 0) continue;
          const pa = A.get(L[m]), late = pa.arr[pa.arr.length - 1] + RL.turn - o.dep[0];
          if (late > RL.cancelMin) { cancelled.add(o); cancelled.add(r); cancels.push({ o, r, set: st, late }); break; }
        }
      }
    }
    for (const h of swaps) decisions.push({ t: h.a.dep[h.a.seq.indexOf(h.st)], k: 'swap', st: h.st, a: h.a, b: h.b });
    dist.forEach((m, tr) => { for (const i in m) for (const o of m[i].txt) if ((o.big || o.code === 'incident') && !o.bigI) decisions.push({ t: tr.arr[+i] || tr.dep[0], k: 'incident', st: tr.seq[+i], a: tr, txt: o.txt, min: (m[i].dwell || m[i].run) }); });
    /* 段5：大きな事故のカード（運転見合わせ → 振替輸送 → 運転再開 → 運休） */
    if (BIG) {
      const sec = `${env.ST[BIG.a].name}〜${env.ST[BIG.b].name}`, hm = t => `${Math.floor(t / 60) % 24}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
      let held = 0, mx = 0; trips.forEach(t => { const a = A.get(t); if (a.cancel) return; if (a.why.some(w => w.some(x => x.code === 'stop' || x.code === 'jam'))) held++; mx = Math.max(mx, a.arr[a.arr.length - 1] - t.arr[t.arr.length - 1]); });
      const B = (t, k, o) => decisions.push(Object.assign({ t, k, st: BIG.a, a: BIG.tr, big: true }, o));
      B(BIG.t0, 'stop', { what: `${hm(BIG.t0)}ごろ、${sec}で${BIG.name}（${name(BIG.tr)}）`, dec: `${sec}の運転を見合わせる。ほかの列車は手前の駅で止める`, why: '安全の確認が先。駅と駅の間には止めない（お客さんがおりられる駅で待つ）',
        res: `再開の見こみは${hm(BIG.t1)}ごろ（約${fmtMin(BIG.dur)}）。${held}本の列車が駅で待つ`, radio: `指令から全列車、${sec}で${BIG.name}。この区間の運転を見合わせます。各列車は次の駅で止まって、指示を待ってください。` });
      if (BIG.dur >= 30) B(BIG.t0 + 5, 'furikae', { what: `再開まで30分をこえる見こみ`, dec: onBranch(BIG.a) || onBranch(BIG.b) ? '路線バスに振替輸送を頼む（温泉方面）' : '県央本線と路線バスに振替輸送を頼む', why: '急ぐお客さんに、ほかの道を案内する（きっぷはそのまま使える）',
        res: '駅の放送と発車標で案内。振替の人数はまだ数えていない', radio: `指令から各駅、振替輸送を始めます。お客さまにご案内ください。` });
      B(BIG.t1, 'resume', { what: `${sec}の安全を確かめおわった`, dec: '運転再開。止まっていた列車を、前から順に間かくをあけて出す', why: '一度に出すと、先の駅でまたつまる',
        res: `いちばん大きい遅れは約${fmtMin(mx)}。運休は${cancelled.size}本`, radio: `指令から全列車、${sec}の運転を再開します。前の列車に続いて、順に発車してください。` });
      if (pre.length) B(BIG.t0 + 2, 'cancel', { what: `再開まで約${fmtMin(BIG.dur)}。${sec}を通る列車が、これから${pre.length}本ある`, dec: `まだ始発駅を出ていない${pre.length}本（${pre.length / 2}往復）を運休`, why: '出しても事故の区間の手前の駅でつまり、動ける列車までおくれる',
        res: 'お客さんは、再開のあとの列車か振替輸送へ。編成は車庫のある駅で待ち、次の列車から定時で出る', radio: `指令から中央駅・港駅、${sec}を通る列車は、再開まで発車を見合わせます（${pre.length}本を運休）。` });
      for (const c of cancels) decisions.push({ t: c.o.dep[0] - 3, k: 'cancel', st: c.o.seq[0], a: c.o, big: true, what: `${c.set.label}が約${fmtMin(c.late)}遅れで${env.ST[c.o.seq[0]].name}に戻る`, dec: `${name(c.o)}と、折り返しの${name(c.r)}を運休`, why: `遅れが${RL.cancelMin}分をこえた。この編成を次の列車から定時に戻す（遅れを後ろへ送らない）`,
        res: `お客さんは前後の列車へ。運休しなければ、この編成は終電近くまで遅れを引きずる`, radio: `指令から${env.ST[c.o.seq[0]].name}駅、${c.o.num}列車と${c.r.num}列車は運休とします。お客さまのご案内をお願いします。` });
    }
    /* 自社の要望（段4）：受けた・ことわったをカードに */
    for (const q of env.requests || []) decisions.push({ t: q.t, k: 'request', st: q.st, a: q.first || null, req: q });
    /* フェリーの最終便（段3の残り）：列車が遅れたら、出港を少し待ってもらう */
    for (const f of env.boats || []) { const at = A.get(f.tr).arr[f.i], late = at - f.tr.arr[f.i], need = at + f.xfer - f.t; if (late >= 0.5 && need > 0) decisions.push({ t: f.t, k: 'connFerry', st: f.st, a: f.tr, boat: f, late, need }); }
    decisions.sort((x, y) => x.t - y.t);
    decisions.forEach(c => card(c, A, trips, env));
    return { A, decisions, swaps, rule: RL, big: BIG, cancelled };
  }
  /* 判断のカード：起きたこと → 判断 → 理由 → 結果（もしも） */
  const RULE0 = RULE;
  function card(c, A, trips, env) {
    if (c.what) return c;   /* 大きな事故のカードは、もう文ができている */
    const RULE = env.RL || RULE0, name = t => env.TYPES[t.type].name + ' ' + t.num, sn = env.ST[c.st].name, ml = (t, i) => A.get(t).dep[i] - t.dep[i];
    const nextSame = (tr, i) => { let best = null; for (const o of trips) { if (o === tr || o.down !== tr.down) continue; const j = o.seq.indexOf(tr.seq[i]); if (j < 0 || j === o.seq.length - 1 || !o.stop[j]) continue; if (o.seq[o.seq.length - 1] !== tr.seq[tr.seq.length - 1]) continue; if (o.dep[j] > tr.dep[i] && (!best || o.dep[j] < best.t)) best = { o, t: o.dep[j] }; } return best; };
    if (c.req) { const q = c.req; c.what = `${q.from}から要望：${q.ask}`; c.dec = q.ok ? `受ける（${q.act}）` : 'ことわる'; c.why = q.why; c.res = q.ok ? (q.n ? `${q.n}本の列車が合わせて約${fmtMin(q.min)}長く止まる` : 'きょうは当てはまる列車なし') : 'ダイヤはそのまま'; c.radio = q.ok ? `指令から${sn}駅、${q.act}。${q.from}からの要望です。` : `指令から${q.from}、きょうは${q.why}のため、お受けできません。`; return c; }
    if (c.boat) { const f = c.boat, ok = c.need <= f.max; c.what = `${f.label}に乗りつぐ${name(c.a)}が${fmtMin(c.late)}遅れ（${sn}）`; c.dec = ok ? `${f.label}に、出港を${fmtMin(c.need)}待ってもらう` : `${f.label}は定時に出港（待てない）`; c.why = ok ? `島へ帰る最後の便。待つのは${f.max}分まで` : `待つ上限${f.max}分をこえる（船のダイヤの都合）`; c.res = ok ? '乗りかえの人は島へ帰れる' : '乗りかえの人は、あしたの始発便へ。港駅で宿の案内'; c.radio = ok ? `指令から${sn}駅、${f.label}に連絡。${c.a.num}列車の到着を待って出港します。` : `指令から${sn}駅、${f.label}は待てません。お客さまのご案内をお願いします。`; return c; }
    if (c.k === 'incident') { c.what = c.txt; c.dec = '安全を確かめてから運転を続ける'; c.why = '安全が先'; c.res = `${name(c.a)}が約${fmtMin(c.min)}遅れ、後ろの列車にもうつる`; c.radio = `${c.a.num}列車から指令、${c.txt}。確認して報告します。`; }
    if (c.k === 'conn') { const i = c.a.seq.indexOf(c.st), nx = nextSame(c.a, i);
      c.what = `${name(c.b)}が遅れて${sn}に着く`; c.dec = `${name(c.a)}は接続を待つ（+${fmtMin(c.hold)}）`; c.why = `遅れが上限${c.max != null ? c.max : RULE.connMax}分以内`;
      c.res = `${name(c.a)}が${fmtMin(c.hold)}遅れて発車。待たなかったら、乗りかえの人は次の列車まで${nx ? Math.round(nx.t - c.a.dep[i]) + '分' : '長く'}待つ`; c.radio = `指令から${c.a.num}列車、${sn}で${c.b.num}列車の到着を待って発車してください。`; }
    if (c.ext) { const i = c.a.seq.indexOf(c.st), nx = nextSame(c.a, i), lb = c.ext.label;
      if (c.k === 'connCut') { c.what = `${lb}が${fmtMin(c.late)}遅れ`; c.dec = `${name(c.a)}は接続を打ち切って定時に発車`; c.why = `待つ上限${c.max != null ? c.max : RULE.connMax}分をこえる（待つと後ろのダイヤ全体が遅れる）`;
        c.res = `乗りかえの人は次の${nx ? name(nx.o) + '（' + Math.round(nx.t - c.a.dep[i]) + '分後）' : '列車'}へ案内`; c.radio = `指令から${sn}駅、${lb}からの乗りかえのお客さまを、次の列車へご案内ください。`; }
      else { c.what = `${lb}が${c.late >= 0.1 ? fmtMin(c.late) + '遅れて' : '遅れて'}${sn}に着く`; c.dec = `${name(c.a)}は接続を待つ（+${fmtMin(c.hold)}）`; c.why = `遅れが上限${c.max != null ? c.max : RULE.connMax}分以内。${c.k === 'connFerry' ? '島へ帰る人・島から来る人は、次の列車まで長く待つことになる' : c.k === 'connBus' ? 'バスの人は駅まで走ってくる' : '乗りかえの人が多い'}`;
        c.res = `${name(c.a)}が${fmtMin(c.hold)}遅れて発車。待たなかったら、乗りかえの人は次の列車まで${nx ? Math.round(nx.t - c.a.dep[i]) + '分' : '長く'}待つ`; c.radio = `指令から${c.a.num}列車、${sn}で${lb}からの乗りかえを待って発車してください。`; }
      return c; }
    if (c.k === 'connCut') { const i = c.a.seq.indexOf(c.st), nx = nextSame(c.a, i);
      c.what = `${name(c.b)}が${fmtMin(c.late)}遅れ`; c.dec = `${name(c.a)}は接続を打ち切って定時に発車`; c.why = `待つ上限${c.max != null ? c.max : RULE.connMax}分をこえる（待つと後ろのダイヤ全体が遅れる）`;
      c.res = `乗りかえの人は次の${nx ? name(nx.o) + '（' + Math.round(nx.t - c.a.dep[i]) + '分後）' : '列車'}へ案内`; c.radio = `指令から${sn}駅、${c.b.num}列車からの乗りかえのお客さまを、次の列車へご案内ください。`; }
    if (c.k === 'swap') { const i = c.a.seq.indexOf(c.st), j = c.b.seq.indexOf(c.st), xl = A.get(c.b).arr[j] - c.b.arr[j];
      c.what = `${sn}で通過待ちの予定の${name(c.b)}が${fmtMin(xl)}遅れ`; c.dec = `${name(c.a)}を先に出す（順番の入れかえ）`; c.why = `待つと${name(c.a)}まで${fmtMin(xl)}近く遅れる`;
      const la = Math.max(0, ml(c.a, i)); c.res = `${name(c.a)}の遅れ ${la < 0.1 ? 'なし' : fmtMin(la)}。入れかえなければ約${fmtMin(xl)}`; c.radio = `指令から${c.a.num}列車、${sn}は待避取りやめ。先に発車してください。${c.b.num}列車はあとに続けます。`; }
    return c;
  }
  /* ===== 段3：他社線・バス・フェリーとの接続、貨物と臨時列車のスジ、線路使用料（data/ctc-extra.json・すべて仮） =====
     ゲームのダイヤ（定期列車）は変えない。貨物と臨時列車は、ゲームと同じ決まり（index.html の scheduleTrip：待てる駅で発車をずらす・
     同じ向きは2分・単線は0.5分あける）で、定期列車のすき間に入れる。乗客・運賃の計算には返さない。 */
  const SYN_TYPES = {
    G: { name: '貨物', short: '貨', prio: 0, vmax: 75, dwell: 0, stops: [] },
    Z: { name: '臨時', short: '臨', prio: 2.5, vmax: 100, dwell: 1, stops: ['C', 'U', 'K', 'P', 'T', 'O'] },
  };
  TYPE_COL.G = '#b08a4a'; TYPE_BODY.G = '#4a3b26'; TYPE_COL.Z = '#d04fb0'; TYPE_BODY.Z = '#f6dcef';
  Object.assign(REASON, {
    connOther: { name: '他社線（県央本線）との接続', col: '#a99be0' },
    connBus: { name: 'バスとの接続', col: '#6fd3a8' },
    connFerry: { name: 'フェリーとの接続', col: '#4fb8c8' },
    connExtra: { name: '臨時列車との接続', col: '#e98fd0' },
    passExtra: { name: '臨時列車の通過待ち', col: '#d97cc0' },
    other: { name: '他社線の中での遅れ', col: '#b9a9ff' },
    crew: { name: '乗務員の交代', col: '#c9b27a' },
    freight: { name: '貨物列車', col: '#b08a4a' },
    extra: { name: '臨時列車', col: '#d04fb0' },
  });
  Object.assign(SHORT, { connOther: '他社線接続', connBus: 'バス接続', connFerry: 'フェリー接続', connExtra: '臨時接続', passExtra: '臨時の通過待ち', other: '他社線の遅れ', crew: '乗務員交代' });
  /* 駅をふやす：W＝連絡線の西のはし（県央本線から）、Q＝港貨物ターミナル（港の手前で南へ分かれる臨港線の先） */
  function extST(ST) {
    return Object.assign({}, ST, { W: { name: '県央本線（連絡線）', km: -2.2, wait: true, ext: true }, Q: { name: '港貨物ターミナル', km: ST.P.km, wait: true, term: true }, X: { name: '交換信号所', bkm: ST.F.bkm + SIGBOX, sigbox: true } });
  }
  const isB = s => s === 'K' || onBranch(s);
  const segBr = (a, b) => isB(a) && isB(b) && !(a === 'K' && b === 'K');
  function segKm(a, b, ST) { return segBr(a, b) ? Math.abs((a === 'K' ? 0 : ST[a].bkm) - (b === 'K' ? 0 : ST[b].bkm)) : Math.abs(ST[a].km - ST[b].km); }
  function runT(a, b, ty, sa, sb, env) { const v = segBr(a, b) ? Math.min(ty.vmax, 65) : ty.vmax; return segKm(a, b, env.ST) / (v * (env.sp || 1)) * 60 + (sa ? 0.55 : 0) + (sb ? 0.55 : 0); }
  /* 止まる時間（臨時・貨物）。中央は乗務員の交代で crew 分 */
  function synDwell(tr, i, env) {
    if (!tr.stop[i] || i === 0 || i === tr.seq.length - 1) return 0;
    const s = tr.seq[i], ty = SYN_TYPES[tr.type];
    return (s === 'C' ? Math.max(ty.dwell, env.crew || 2) : ty.dwell) + (env.dw || 0) + (env.evDwell ? env.evDwell(s, tr.arr[i]) : 0);
  }
  /* すでにあるダイヤを、ゲームと同じ区間の帳面（reg）に書く */
  function buildReg(trips, ST) {
    const reg = {};
    for (const tr of trips) {
      const seq = tr.seq, n = seq.length, w = [0];
      for (let i = 1; i < n - 1; i++) if (ST[seq[i]].wait) w.push(i);
      w.push(n - 1);
      regPut(reg, tr, w);
    }
    return reg;
  }
  function regPut(reg, tr, w) {
    const seq = tr.seq;
    for (let b = 0; b < w.length - 1; b++) {
      const bi = w[b], bj = w[b + 1];
      if (segBr(seq[bi], seq[bi + 1])) { const key = 'B' + [seq[bi], seq[bj]].sort().join(''); (reg[key] || (reg[key] = [])).push({ e: tr.dep[bi], x: tr.arr[bj] }); }
      else for (let k = bi; k < bj; k++) { const key = seq[k] + '>' + seq[k + 1]; (reg[key] || (reg[key] = [])).push({ e: tr.dep[k], x: (k + 1 === bj) ? tr.arr[bj] : tr.dep[k + 1] }); }
    }
  }
  /* 1本をすき間に入れる（index.html の scheduleTrip を写したもの。止まる時間だけ synDwell） */
  function fitTrip(tr, reg, env) {
    const ST = env.ST, seq = tr.seq, n = seq.length, ty = SYN_TYPES[tr.type], HW = env.HW || 2, HWS = env.HWS || 0.5;
    tr.stop = seq.map((s, i) => i === 0 || i === n - 1 || s === 'C' || ty.stops.includes(s));
    const arr = new Array(n), dep = new Array(n), w = [0];
    for (let i = 1; i < n - 1; i++) if (ST[seq[i]].wait) w.push(i);
    w.push(n - 1);
    tr.op = new Array(n).fill(false); tr.arr = arr; tr.dep = dep;
    const dw = (k, t) => { arr[k] = t; return synDwell(tr, k, env); };
    let nominal = 0;
    for (let k = 0; k < n - 1; k++) { nominal += runT(seq[k], seq[k + 1], ty, tr.stop[k], tr.stop[k + 1], env); if (k + 1 < n - 1 && tr.stop[k + 1]) nominal += (seq[k + 1] === 'C' ? Math.max(ty.dwell, env.crew || 2) : ty.dwell) + (env.dw || 0); }
    tr.nominal = nominal; arr[0] = tr.want; dep[0] = tr.want;
    for (let b = 0; b < w.length - 1; b++) {
      const bi = w[b], bj = w[b + 1];
      const base = bi === 0 ? tr.want : arr[bi] + dw(bi, arr[bi]);
      let start = base, ta = [], td = [];
      const branch = segBr(seq[bi], seq[bi + 1]);
      for (let it = 0; it < 90; it++) {
        ta = []; td = []; td[bi] = start; let cur = start;
        for (let k = bi; k < bj; k++) {
          ta[k + 1] = cur + runT(seq[k], seq[k + 1], ty, tr.stop[k] || (k === bi && start > base + 0.01), tr.stop[k + 1], env);
          td[k + 1] = ta[k + 1] + dw(k + 1, ta[k + 1]); cur = td[k + 1];
        }
        let shift = 0;
        if (branch) {
          const key = 'B' + [seq[bi], seq[bj]].sort().join(''), e0 = start, x0 = ta[bj];
          for (const iv of reg[key] || []) if (!(iv.x + HWS <= e0 || x0 + HWS <= iv.e)) shift = Math.max(shift, iv.x + HWS - e0);
        } else {
          for (let k = bi; k < bj; k++) {
            const key = seq[k] + '>' + seq[k + 1], e0 = td[k], x0 = (k + 1 === bj) ? ta[bj] : td[k + 1];
            for (const iv of reg[key] || []) {
              const ahead = iv.e <= e0 - HW && iv.x <= x0 - HW, behind = iv.e >= e0 + HW && iv.x >= x0 + HW;
              if (!ahead && !behind) shift = Math.max(shift, iv.e + HW - e0, iv.x + HW - x0);
            }
          }
        }
        if (shift <= 1e-6) break; start += shift + 0.05;
      }
      dep[bi] = start; if (start > base + 0.05 && !tr.stop[bi]) tr.op[bi] = true;
      for (let k = bi + 1; k <= bj; k++) { arr[k] = ta[k]; dep[k] = td[k]; }
    }
    dep[n - 1] = arr[n - 1]; arr[0] = dep[0];
    tr.down = ['P', 'O', 'Q'].includes(seq[n - 1]);
    tr.delay = arr[n - 1] - dep[0] - nominal;
    regPut(reg, tr, w);
    return tr;
  }
  const FRT_DOWN = ['W', 'C', 'S', 'U', 'M', 'K', 'N', 'Q'], TO_P = ['W', 'C', 'S', 'U', 'M', 'K', 'N', 'P'], TO_O = ['W', 'C', 'S', 'U', 'M', 'K', 'F', 'T', 'O'];
  /* その日の貨物と臨時列車を作る。env：{ST（extST したもの）, trips（定期）, X（ctc-extra.json）, events:[id], holiday, sp, dw, evDwell, day} */
  function synth(env) {
    const X = env.X, out = [], sets = [], reg = buildReg(env.trips, env.ST), fenv = Object.assign({}, env, { crew: X.freight.crew });
    let nz = 0, ng = 0;
    const num = (tr, k) => { tr.num = (tr.type === 'G' ? 8000 : 9000) + k * 2 + (tr.down ? 1 : 2); };
    /* 臨時列車を先に（貨物は臨時にも道をゆずる） */
    for (const id of env.events || []) {
      const z = X.extra.byEvent[id]; if (!z) continue;
      const seq = z.to === 'O' ? TO_O : TO_P;
      const a = fitTrip({ type: 'Z', synth: true, extra: true, name: z.name, ev: id, seq: seq.slice(), want: z.out, cars: z.cars }, reg, fenv);
      const b = fitTrip({ type: 'Z', synth: true, extra: true, name: z.name, ev: id, seq: seq.slice().reverse(), want: Math.max(z.back, a.arr[a.arr.length - 1] + 12), cars: z.cars }, reg, fenv);
      num(a, nz); num(b, nz); nz++;
      const set = { synth: true, kind: 'Z', label: '臨時「' + z.name + '」', cars: z.cars, plat: z.to === 'P' ? 3 : 1, rest: z.to, trips: [a, b] };
      a.set = set; b.set = set; a.pair = null; b.pair = a; sets.push(set); out.push(a, b);
    }
    for (const r of X.freight.runs) {
      if (env.holiday && !r.holiday) continue;
      const tr = fitTrip({ type: 'G', synth: true, freight: true, name: X.freight.name, load: r.load, seq: r.dir === 'in' ? FRT_DOWN.slice() : FRT_DOWN.slice().reverse(), want: r.want, cars: 12 }, reg, fenv);
      if (tr.arr[tr.arr.length - 1] > 1590) continue;   /* 夜おそくなりすぎるスジは、その日は走らせない */
      num(tr, ng++);
      const set = { synth: true, kind: 'G', label: '貨物 ' + r.load, cars: 12, plat: 0, rest: r.dir === 'in' ? 'Q' : null, trips: [tr] };
      tr.set = set; sets.push(set); out.push(tr);
    }
    out.forEach(t => { t.cap = 0; t.loadAfter = []; });
    return { trips: out, sets };
  }
  /* 臨時・貨物が自社の線路を走ったキロ（連絡線から先）と線路使用料 */
  function fee(trips, X, ST) {
    let km = { G: 0, Z: 0 }, yen = 0;
    for (const t of trips) { if (!t.synth) continue; let k = 0; for (let i = 0; i < t.seq.length - 1; i++) { const a = t.seq[i], b = t.seq[i + 1]; if (a === 'W' || b === 'W') continue; k += segKm(a, b, ST); } km[t.type] += k; yen += k * (X.fee[t.type] || 0); }
    return { km, yen: Math.round(yen) };
  }
  /* 県央本線から来る臨時・貨物の、中央に着くまでの遅れ（運行日ごとに同じ） */
  function synLate(syn, env) {
    const R = rng((env.day || 1) * 7727 + 5), m = new Map(), Z = env.X.extra.late;
    for (const t of syn) {
      if (!t.down) continue;
      const p = t.extra ? Z.p : 0.3, mx = t.extra ? Z.max : 10, r = R(), v = R();
      if (r < p) { const min = 1 + v * (mx - 1); m.set(t, { min, txt: `県央本線の中で遅れて連絡線に入った（${fmtMin(min)}）` }); }
    }
    return m;
  }
  /* 臨時・貨物が待避線で待つ（定期列車に道をゆずる）か */
  function synOnSiding(tr, i, env) { const n = tr.seq.length; if (i <= 0 || i >= n - 1 || !env.ST[tr.seq[i]].taihi) return false; return tr.dep[i] - tr.arr[i] > synDwell(tr, i, env) + 0.4; }

  /* 外との接続（他社線・バス・フェリー・臨時列車）。その日の遅れ（乱数・運行日ごとに同じ）もここで決める。
     返すのは見どころの形 {t, k, st, a（待つ自社の列車）, from（臨時列車のとき）, arr（相手の予定の着）, late, xfer, label, txt, radio} */
  function extConns(trips, syn, env) {
    const X = env.X, R = rng((env.day || 1) * 104729 + 17), out = [], name = t => env.TYPES[t.type].name + ' ' + t.num, sn = s => env.ST[s].name;
    const lateOf = (o, rushK) => { const r = R(), b = R(), m = R(); if (o.bigP && b < o.bigP * 0.25) return o.bigMin + m * (o.bigMax - o.bigMin); return r < Math.min(0.95, o.lateP * (rushK || 1)) ? 1 + m * ((o.lateMax || 6) - 1) : 0; };
    /* その駅を、向きが合い、着いてから xfer〜win 分のあいだに出る自社の列車（いちばん早いもの） */
    const pick = (s, t0, t1, ok) => { let best = null; for (const tr of trips) { if (tr.synth) continue; const i = tr.seq.indexOf(s); if (i < 0 || i === tr.seq.length - 1 || !tr.stop[i]) continue; const d = tr.dep[i]; if (d < t0 || d > t1 || !ok(tr, i)) continue; if (!best || d < best.tr.dep[best.i]) best = { tr, i }; } return best; };
    const add = (k, s, at, late, xfer, label, p, extra) => {
      const t = p.tr.dep[p.i];
      out.push(Object.assign({ t: at + xfer, k, st: s, a: p.tr, arr: at, late, xfer, label, ext: true,
        txt: `${sn(s)}で ${label}${late >= 0.5 ? '（遅れ' + fmtMin(late) + '）' : ''} → ${name(p.tr)}（${Math.floor(t / 60) % 24}:${String(Math.round(t % 60)).padStart(2, '0')}発）に乗りかえ`,
        radio: late >= 0.5 ? `指令から${sn(s)}駅、${label}が${fmtMin(late)}遅れ。${p.tr.num}列車は接続をとります（上限${RULE.connMax}分）。` : `${sn(s)}駅、${label}からの乗りかえ、${p.tr.num}列車で受けます。` }, extra || {}));
    };
    const K = X.kenou;
    for (const ln of K.trains) for (let at = ln.first; at <= ln.last; at += ln.int) {
      const late = lateOf(K);
      let p = null;
      for (const ty of ln.want) { p = pick(K.st, at + K.xfer, at + K.win, (tr, i) => tr.down && i === 0 && tr.type === ty); if (p) break; }
      if (p) add('connOther', K.st, at, late, K.xfer, K.name + ' ' + ln.name, p);
    }
    const B = X.bus;
    for (const ln of B.lines) for (let at = ln.first; at <= ln.last; at += ln.int) {
      const rush = (at >= 420 && at <= 540) || (at >= 1020 && at <= 1140), late = lateOf(B, rush ? B.rushP / B.lateP : 1);
      const p = pick(ln.st, at + B.xfer, at + B.win, tr => tr.down === (ln.dir === 'down'));
      if (p) add('connBus', ln.st, at, late, B.xfer, 'バス「' + ln.name + '」', p);
    }
    const F = X.ferry, wxK = env.wx === 'rain' || env.wx === 'snow' ? F.wxP / F.lateP : 1;
    for (const at of F.arr) {
      const late = lateOf(F, wxK), p = pick(F.st, at + F.xfer, at + F.win, tr => !tr.down);
      if (p) add('connFerry', F.st, at, late, F.xfer, F.name, p);
    }
    /* 臨時列車から、川辺で支線（または本線）へ乗りかえ */
    for (const z of syn) {
      if (!z.extra) continue;
      const i = z.seq.indexOf('K'); if (i < 0 || !z.stop[i]) continue;
      const toBr = z.seq.includes('O'), at = z.arr[i];
      const p = pick('K', at + X.extra.xfer, at + X.extra.win, tr => tr.down === z.down && tr.seq.includes('O') !== toBr);
      if (p) add('connExtra', 'K', at, 0, X.extra.xfer, '臨時「' + z.name + '」' + z.num, p, { from: z });
    }
    out.sort((a, b) => a.t - b.t);
    return out;
  }
  /* 臨時・貨物の見どころ（乗務員の交代・臨時の通過待ち）。hl はふつうの見どころ（全部の列車で作ったもの）を直す */
  function synHighlights(hl, syn, env) {
    const name = t => env.TYPES[t.type].name + ' ' + t.num, out = [];
    for (const h of hl) {
      if (h.k !== 'taihi' && h.k !== 'conn') { out.push(h); continue; }
      if (h.a.type === 'G') { h.k = 'taihi'; h.txt = `${env.ST[h.st].name}で ${name(h.b)} が 貨物${h.a.num} を追いこす`; h.radio = `指令から${h.a.num}列車、${env.ST[h.st].name}の待避線へ。${h.b.num}列車を先に通します。`; }
      if (h.b.extra && h.k === 'taihi') { h.k = 'passExtra'; h.txt = `${env.ST[h.st].name}で 臨時「${h.b.name}」${h.b.num} が ${name(h.a)} を追いこす`; }
      out.push(h);
    }
    for (const t of syn) {
      const i = t.seq.indexOf('C'); if (i <= 0 || i === t.seq.length - 1) continue;
      const kind = t.type === 'G' ? '貨物' : '臨時「' + t.name + '」';
      out.push({ t: t.arr[i], k: 'crew', st: 'C', a: t, txt: `中央で ${kind}${t.num} の乗務員交代（${t.down ? '県央本線→みなと川電鉄' : 'みなと川電鉄→県央本線'}）`,
        radio: `指令から${t.num}列車、中央で乗務員交代。${t.down ? '連絡線から1番線へ入ります。' : '交代のあと、連絡線へ進路を開きます。'}` });
      const j = t.down ? 0 : t.seq.length - 1, at = t.down ? t.dep[0] : t.arr[j];
      out.push({ t: at, k: t.type === 'G' ? 'freight' : 'extra', st: t.down ? 'C' : 'C', a: t,
        txt: t.down ? `${kind}${t.num} が県央本線から連絡線に入る（${t.freight ? t.load : env.ST[t.seq[t.seq.length - 1]].name + 'ゆき'}）` : `${kind}${t.num} が連絡線から県央本線へ`,
        radio: t.down ? `県央本線の指令から、${t.num}列車を連絡線へ渡します。` : `${t.num}列車、県央本線へ渡ります。` });
      if (t.freight) { const q = t.seq.indexOf('Q'); if (q >= 0) out.push({ t: q === 0 ? t.dep[0] : t.arr[q], k: 'freight', st: 'Q', a: t, txt: q === 0 ? `貨物${t.num} が港貨物ターミナルを出発（${t.load}）` : `貨物${t.num} が臨港線から港貨物ターミナルに着く（${t.load}）`, radio: q === 0 ? `港貨物ターミナル、${t.num}列車の出発を許可します。` : `${t.num}列車、臨港線へ進路を開きます。` }); }
    }
    out.sort((a, b) => a.t - b.t);
    return out;
  }

  /* ===== 段4：方針と、自社（グループ会社）の要望（数字は仮） =====
     方針は、指令員の決まりの数字を変えるだけ（接続を待つ上限・入れかえを決める遅れ・回復運転の強さ）。プレイヤーが決めるのは方針だけ。 */
  const POLICY = {
    balance: { name: 'バランス', say: '接続は5分まで待つ。ふつうの指令', connMax: 5, swapMin: 2, recover: 0.03 },
    ontime: { name: '定時重視', say: '遅れを広げない。接続は2分まで・入れかえは早めに・回復運転を強める・要望はことわる', connMax: 2, swapMin: 1.5, recover: 0.05 },
    conn: { name: '接続重視', say: '乗りかえの人を置いていかない。接続は8分まで待つ', connMax: 8, swapMin: 3, recover: 0.03 },
    sales: { name: '売上重視', say: '料金のいる特急・観光特急は待たせず（1.5分まで）、特急からの乗りかえは8分まで待つ。グループ会社の要望を受ける', connMax: 5, swapMin: 2, recover: 0.03, paid: true, paidHold: 1.5, paidWait: 8 },
  };
  REASON.request = { name: '自社の要望', col: '#f29fb5' }; SHORT.request = '要望';
  Object.assign(REASON, { stop: { name: '運転見合わせ', col: '#ff4d4d' }, jam: { name: '先の駅がふさがっている', col: '#ff8f6b' }, furikae: { name: '振替輸送', col: '#ffb14d' }, resume: { name: '運転再開', col: '#6fe08a' }, cancel: { name: '運休', col: '#c0c7d0' } });
  Object.assign(SHORT, { stop: '運転見合わせ', jam: '先がつまる' });
  POLICY.ontime.cancelMin = 12; POLICY.conn.cancelMin = 30;
  /* ===== 段5：大きな事故（数字は仮）。運行日ごとに同じ。env：{day, incidentK, force（訓練：かならず起こす）, ST} =====
     返すもの {name, a, b, t0, t1, dur, tr（事故にあった列車）, i（区間の番号）, f（区間のどのあたり 0〜1）}、起きない日は null */
  const BIGP = 0.1;
  const BIGS = [['人身事故', 35, 55, 'main'], ['架線にビニールがからまった', 20, 35, 'main'], ['車両の故障', 25, 40, 'any'], ['踏切で車が立ち往生', 20, 30, 'main'], ['倒木', 40, 70, 'branch']];
  function bigIncident(trips, env) {
    const R = rng((env.day || 1) * 15485863 + 11), ik = env.incidentK == null ? 1 : env.incidentK, roll = R();
    if (!env.force && roll >= Math.min(0.5, BIGP * ik)) return null;
    const K = BIGS[Math.floor(R() * BIGS.length)];
    const pool = trips.filter(t => !t.synth && t.dep[0] > 400 && t.dep[0] < 1260 && (K[3] !== 'branch' || t.seq.includes('O')));
    if (!pool.length) return null;
    const tr = pool[Math.floor(R() * pool.length)], segs = [];
    for (let i = 0; i < tr.seq.length - 1; i++) { const br = onBranch(tr.seq[i]) || onBranch(tr.seq[i + 1]); if (K[3] === 'any' || (K[3] === 'branch') === br) segs.push(i); }
    if (!segs.length) return null;
    const i = segs[Math.floor(R() * segs.length)], f = 0.3 + 0.4 * R(), t0 = tr.dep[i] + (tr.arr[i + 1] - tr.dep[i]) * f, dur = K[1] + R() * (K[2] - K[1]);
    return { name: K[0], a: tr.seq[i], b: tr.seq[i + 1], t0, t1: t0 + dur, dur, tr, i, f };
  }
  /* その日の要望。env：{ST, TYPES, X, events:[id], holiday, policy}。返すもの [{id, from, ask, act, st, t, ok, why, n, min, hits:[{tr,i,min,txt}], first}] */
  function requests(trips, env) {
    const out = [], pol = env.policy || 'balance';
    for (const r of (env.X.requests || [])) {
      const w = r.when || {};
      if (w.events && !w.events.some(id => (env.events || []).includes(id))) continue;
      if (w.weekday && env.holiday) continue;
      const e = r.effect, hits = [];
      for (const tr of trips) {
        if (tr.synth || (e.types && !e.types.includes(tr.type)) || (e.dir && (e.dir === 'down') !== tr.down)) continue;
        const i = tr.seq.indexOf(e.st); if (i < 0 || i === tr.seq.length - 1) continue;
        const t = i === 0 ? tr.dep[0] : tr.arr[i]; if (t < e.from || t > e.to) continue;
        if (e.kind === 'stop' ? tr.stop[i] : !tr.stop[i]) continue;   /* stop＝通過する列車を臨時に止める／dwell＝止まる列車の停車をのばす */
        hits.push({ tr, i, min: e.min, txt: `${env.ST[e.st].name}で${r.from}の要望（${r.act}）` });
      }
      if (e.first) hits.splice(1);
      const ok = (r.accept || []).includes(pol);
      out.push({ id: r.id, from: r.from, ask: r.ask, act: r.act, st: e.st, t: Math.max(280, e.from - 20), ok, why: `方針「${POLICY[pol].name}」：${ok ? r.whyOk : r.whyNo}`, n: hits.length, min: hits.reduce((a, h) => a + h.min, 0), hits, first: hits[0] ? hits[0].tr : null });
    }
    return out;
  }
  /* フェリーの最終便：その便に乗りつげる、いちばんおそい下りの列車 */
  function boats(trips, env) {
    const F = env.X.ferry, out = [];
    for (const d of F.dep || []) {
      let best = null;
      for (const tr of trips) { if (tr.synth || !tr.down) continue; const i = tr.seq.length - 1; if (tr.seq[i] !== F.st) continue; const at = tr.arr[i]; if (at + F.xfer <= d.t && (!best || at > best.tr.arr[best.i])) best = { tr, i }; }
      if (best) out.push({ t: d.t, tr: best.tr, i: best.i, st: F.st, xfer: F.xfer, max: d.max, label: F.name + ' ' + d.name });
    }
    return out;
  }
  /* 方針をくらべる数字：定時の割合（着・遅れ1分未満）、遅れの合計、接続を待った・打ち切った回数、受けた要望 */
  function policyStats(trips, D2) {
    let n = 0, on = 0, late = 0;
    let can = 0;
    for (const t of trips) { if (t.synth) continue; const a = D2.A.get(t); if (!a) continue; if (a.cancel) { can++; n++; continue; } const l = a.arr[a.arr.length - 1] - t.arr[t.arr.length - 1]; n++; if (l < 1) on++; late += Math.max(0, l); }
    const cnt = k => D2.decisions.filter(k).length;
    return { n, cancel: can, ontime: n ? on / n : 1, late, held: cnt(c => !c.req && !c.boat && c.hold != null), cut: cnt(c => c.k === 'connCut'), swap: cnt(c => c.k === 'swap'), req: cnt(c => c.req && c.req.ok), reqNo: cnt(c => c.req && !c.req.ok) };
  }


  /* ---- 配線の層（2026-11-17）：同じ番線に2本が入らないように、番線を割りふり、入れないときは手前で待たせる ----
     sets：[{trips:[…時刻の順]}]（車庫の編成と、臨時・貨物の編成）。env：{ ST, hs（data/ctc-haisen.json）, onSiding }
     返すもの：Map（元の列車 → 見せる列車〈arr・dep・lanes を持つ〉）と、編成ごとの休み（頭端の駅で次の発車まで長いときは、ホームをあけて車庫・留置線へ）。
     見せ方の層だけ（ゲームの計算・乱れの計算は変えない）。ずらすのは、ふさがっていた分だけ。 */
  const BRSEG = new Set(['K|F', 'F|K', 'F|T', 'T|F', 'T|O', 'O|T']);
  function yard(sets, env) {
    /* 同時に泊まる編成の数（もとのダイヤ）から、車庫・留置線の大きさを決める */
    { const need = {}; for (const at of ['C', 'O']) { const ev = []; for (const st of sets) { const tr = st.trips; if (!tr || !tr.length) continue;
        if (st.home === at && tr[0].seq[0] === at) ev.push([-1e9, 1], [tr[0].dep[0], -1]);
        for (let k = 0; k < tr.length; k++) { const t = tr[k], n = t.seq.length; if (t.seq[n - 1] !== at) continue; const nt = tr[k + 1]; ev.push([t.arr[n - 1], 1], [nt && nt.seq[0] === at ? nt.dep[0] : 1e9, -1]); } }
        ev.sort((x, y) => x[0] - y[0] || x[1] - y[1]); let c = 0, mx = 0; for (const e of ev) { c += e[1]; mx = Math.max(mx, c); } need[at] = mx; }
      setYardNeed(need); }
    const YC = yardCap(), YD = Object.assign({}, env.hs.yards || {}); for (const h of ['C', 'P', 'O']) YD[h] = Object.assign({}, YD[h] || {}, { cap: YC[h].cap });
    const hs = env.hs, REST = YD.rest || 16, EPS = 0.3, EIN = 0.6, TURN = 2, HW = 2.0;   /* EIN：番線に入る前から、その番線をおさえる分・HW：同じ線路へ続けて出るときの間かく */
    const occ = new Map(), segs = new Map(), single = new Map(), yuse = {}, out = new Map(), rests = new Map(), TH = new Map();
    const key = (s, o) => s + '|' + o, inHs = s => !!(hs.stations && hs.stations[s]);
    const busy = (k, t0, t1, me) => (occ.get(k) || []).find(r => r !== me && r[0] < t1 && t0 < r[1]);
    const put = (k, t0, t1) => { if (!occ.has(k)) occ.set(k, []); const r = [t0, t1]; occ.get(k).push(r); return r; };
    const nextFree = (k, t0, t1) => { let t = t0; const d = t1 - t0; for (let g = 0; g < 60; g++) { const c = busy(k, t, t + d); if (!c) return t; t = c[1] + 0.05; } return t; };
    function pick(tr, i, t0, t1) {
      const s = tr.seq[i], L = prefLanes(tr, i, env);
      for (const o of L) if (!busy(key(s, o), t0, t1)) return { o, wait: 0 };
      let best = null; for (const o of L) { const t = nextFree(key(s, o), t0, t1); if (!best || t < best.t) best = { o, t }; }
      return { o: best.o, wait: best.t - t0 };
    }
    /* その番線のおさえを t1 までのばす。うしろに別の列車のおさえがあれば、その手前まで */
    function extend(k, r, t1) { if (!r) return t1; let lim = Infinity; for (const x of occ.get(k) || []) if (x !== r && x[0] >= r[0] && x[0] < lim) lim = x[0]; r[1] = Math.max(r[1], Math.min(t1, lim - 0.02)); return r[1]; }
    /* 番線のおさえを、ほかのあいている番線へうつす（先にいる列車が出られずに残るとき、あとから着く列車のほうを別の番線へ。2026-11-18 点検） */
    function relocate(s, r) {
      if (!r || !r.own || !r.own.length) return false; const o0 = r.own[0], cur = o0.L[o0.j];
      for (const o2 of prefLanes(o0.tr, o0.j, env)) { if (o2 === cur || busy(key(s, o2), r[0], r[1], r)) continue;
        const A = occ.get(key(s, cur)); A.splice(A.indexOf(r), 1); if (!occ.has(key(s, o2))) occ.set(key(s, o2), []); occ.get(key(s, o2)).push(r);
        r.own.forEach(w => { w.L[w.j] = o2; }); return true; }
      return false;
    }
    const yardFree = (at, t0, t1) => { const c = (YD[at] && YD[at].cap) || 0; return (yuse[at] || []).filter(r => r[0] < t1 && t0 < r[1]).length < c; };
    /* 頭端の駅（中央・港）ののど：ほかの本線を横切る出発と到着は、同時に動かない */
    const crossMove = (s, o, kind) => s === 'C' ? (kind === 'dep' ? o > 0 : o < 0) : s === 'P' ? (kind === 'arr' ? o > 0 : o < 0) : false;
    const winOf = (t, kind) => kind === 'dep' ? [t - 0.05, t + 1.0] : [t - 1.0, t + 0.05];   /* のどを通りぬけるまで（2026-11-18 点検で 0.7→1.0） */
    function throat(s, t, o, kind) {
      if ((s !== 'C' && s !== 'P') || o == null) return t; const cx = crossMove(s, o, kind);
      for (let g = 0; g < 20; g++) { const [a, b] = winOf(t, kind), hit = (TH.get(s) || []).find(r => r.kind !== kind && (cx || r.cx) && r.a < b && a < r.b); if (!hit) return t; t = kind === 'dep' ? hit.b + 0.05 : hit.b + 0.85; }
      return t;
    }
    const noteThroat = (s, t, o, kind) => { if ((s !== 'C' && s !== 'P') || o == null) return; const [a, b] = winOf(t, kind); if (!TH.has(s)) TH.set(s, []); TH.get(s).push({ a, b, kind, cx: crossMove(s, o, kind) }); };
    /* 交換信号所（森下〜峠のまん中）での行き違い（2026-11-18）：単線を半分ずつに分けて考える。
       こちらが前の半分を走るあいだ、反対の列車はまだ交換信号所の向こう。反対の列車が交換信号所に着くまで、こちらは交換信号所で待つ。
       行き違えないときは、反対の列車が区間を出るまで、いまの駅で待つ。もどり値：d（出る時刻）・a（着く時刻）・tX0〜tX1（交換信号所で止まるあいだ） */
    const XF = env.ST && env.ST.X ? (env.ST.X.bkm - env.ST.F.bkm) / (env.ST.T.bkm - env.ST.F.bkm) : 0.5;
    /* 先に区間へ入った反対の列車（r）を、交換信号所で待たせて行き違えるか。r の次の駅に、待つぶんのゆとり（停車時間）があるときだけ。もどり値：r が待ち終える時刻 */
    const stretchTo = (r, t1, d) => { if (!r.ss || r.to < d + 0.1 || r.ti > t1 + 0.05) return null; const to = Math.max(r.to, t1 + 0.1), dl = to - r.to; if (dl > 4) return null;
      const ss = r.ss, j = r.i + 1, last = j === ss.tr.seq.length - 1; if (last && ss.D[j] - ss.A[j] < dl && ss.k > r.k) return null;
      if (!last && ss.D[j] - ss.A[j] < dl + (ss.tr.stop[j] ? 0.3 : 0)) {   /* 停車時間が足りないときは、2分までなら次の駅を遅れて出る（その番線を次に使う列車がいなければ） */
        const nd = ss.A[j] + dl + (ss.tr.stop[j] ? 0.3 : 0), R = ss.R[j]; if (nd - ss.D[j] > 2 || !R || ss.L[j] == null) return null;
        if ((occ.get(key(ss.tr.seq[j], ss.L[j])) || []).some(x => x !== R && x[0] >= R[0] && x[0] < nd + EPS + 0.3)) return null; }
      return to; };
    function xcross(d, run, down, apply) {
      const fa = down ? XF : 1 - XF;
      for (let g = 0; g < 30; g++) {
        const t1 = d + run * fa; let tx = t1, bad = null; const st = [];
        for (const r of single.get('F|T') || []) { if (r[2] === down || r[1] + 0.2 <= d) continue;
          if (t1 <= r.to - 0.1) { tx = Math.max(tx, r.ti + 0.1); continue; }   /* 交換信号所で行き違う（反対の列車が交換信号所を出る前に、こちらが着く） */
          if (d + run + 0.1 <= r[0] && t1 <= r.ti) continue;   /* 反対の列車が入る前に、区間を出てしまう */
          const to = stretchTo(r, t1, d); if (to != null) { st.push([r, to]); tx = Math.max(tx, r.ti + 0.1); continue; }   /* 反対の列車に交換信号所で待ってもらう */
          bad = r; break; }
        if (bad) { d = bad[1] + 0.2; continue; }
        if (apply) for (const [r, to] of st) { const dl = to - r.to; if (dl <= 0) continue; const ss = r.ss, j = r.i + 1;
          r.to = to; r[1] += dl; if (r.seg) r.seg[1] += dl; ss.A[j] += dl; if (j === ss.tr.seq.length - 1) ss.D[j] = Math.max(ss.D[j], ss.A[j]);
          else { const nd = ss.A[j] + (ss.tr.stop[j] ? 0.3 : 0); if (nd > ss.D[j]) { ss.D[j] = nd; if (ss.R[j]) ss.R[j][1] = Math.max(ss.R[j][1], nd + EPS); const q = Q.find(x => x.ss === ss); if (q) q.t = Math.max(q.t, nd); } }
          ss.XW[r.i] = [r.ti, to]; }
        return { d, a: tx + run * (1 - fa), t0: t1, t1: tx };
      }
      return { d, a: d + run, t0: d + run * fa, t1: d + run * fa };
    }
    const Q = [];   /* 出発のできごと（時刻の早いものから処理する） */
    /* 運転整理（2026-11-27・ユーザーの頼み）：温泉の支線は単線で、川辺から入れるのは1番線だけ。組んだダイヤによっては足りず、遅れがどこまでも積もる。
       支線に入る列車の遅れが LIM 分を超えているあいだは、これから出る支線の列車を、温泉からの折り返しと組で運休にする（編成は出た駅で待つ）。
       決めるのは、その編成が前の列車で着いたとき（休むかどうかを決める前）。いちど決めたら変えない */
    const CXL = new Map(), BRL = [], LIM = 20;
    const isBr = t => t.seq.includes('O');
    const pairOk = (L, j) => { const A = L[j], B = L[j + 1]; if (!A || !B) return false; const a0 = A.seq[0], a1 = A.seq[A.seq.length - 1];
      return B.seq[0] === a1 && B.seq[B.seq.length - 1] === a0 && (!L[j + 2] || L[j + 2].seq[0] === a0); };
    const congested = now => BRL.some(r => r[0] >= now - 60 && r[1] > LIM);   /* いまから60分のうちに支線に入った列車が LIM 分より遅れていた */
    function nextK(ss, now) {
      if (ss.nkAt === ss.k) return ss.nk;
      const L = ss.st.trips; let j = ss.k + 1;
      for (let g = 0; g < 20 && L[j] && isBr(L[j]) && pairOk(L, j) && congested(now); g++) {
        const why = `温泉の支線が詰まっているため（支線に入る列車が${LIM}分より遅れている）`; CXL.set(L[j], why); CXL.set(L[j + 1], why); j += 2; }
      ss.nkAt = ss.k; ss.nk = j; return j;
    }
    function begin(ss, c) {
      const tr = ss.st.trips[ss.k]; if (!tr) return; const n = tr.seq.length, s = tr.seq[0];
      ss.tr = tr; ss.A = tr.arr.slice(); ss.D = tr.dep.slice(); ss.L = new Array(n).fill(null); ss.R = new Array(n).fill(null); ss.i = 0; ss.XW = {}; ss.lead0 = null;
      if (c && c.lane != null && c.s === s) { ss.L[0] = c.lane; ss.R[0] = c.rec; ss.D[0] = Math.max(tr.dep[0], c.floor); if (c.rec && c.rec.own) c.rec.own.push({ L: ss.L, j: 0, tr, ss }); }   /* 折り返し：着いた番線のまま */
      else if (inHs(s)) {
        /* 始発（車庫・留置線から出てくる列車）は、発車の5分前にはホームに入って待つ（2026-11-19）。番線があかないときは4・3・2・1分前 */
        let from = c && c.s === s ? c.from : tr.dep[0] - 2.5, p = null; const floor = c && c.s === s ? c.floor : -1e9, LW = c && c.rest && (s === 'C' || s === 'P' || s === 'O') ? 3 : 0;   /* 休みから出てくる回送も、入出庫線を通る3分ぶん早めから */
        /* 車庫から出てくる回送は、入出庫線を数分かけて通る。前にその番線にいた列車（入庫の回送になることが多い）が入出庫線を抜けるまで、番線を3分早めから押さえる（2026-11-21：中央で出庫と入庫が入出庫線ですれちがっていた） */
        if (!(c && c.s === s)) { const LEADW = s === 'C' || s === 'P' || s === 'O' ? 3 : 0; for (const ld of [6.5, 5.5, 4.5, 3.5, 2.5]) { from = tr.dep[0] - ld; p = pick(tr, 0, from - LEADW, Math.max(tr.dep[0], from) + EPS); if (!p.wait) break; } ss.lead0 = tr.dep[0] - from - 1.5; }
        else p = pick(tr, 0, from - LW, Math.max(tr.dep[0], from) + EPS); ss.L[0] = p.o; ss.D[0] = Math.max(tr.dep[0] + p.wait, floor);
        ss.R[0] = put(key(s, p.o), from - LW + p.wait, ss.D[0] + EPS); if (p.wait > 0 && c && c.rest) c.rest.t1 += p.wait;   /* ホームがあくまで、車庫・留置線で長く休む */
      } else ss.D[0] = Math.max(tr.dep[0], c && c.floor != null ? c.floor : -1e9);
      Q.push({ t: ss.D[0], ss });
    }
    function finish(ss, plan) {
      const tr = ss.tr, n = tr.seq.length; ss.D[n - 1] = Math.max(ss.D[n - 1], ss.A[n - 1]);
      const cp = Object.create(tr); cp.arr = ss.A; cp.dep = ss.D; cp.lanes = ss.L; cp.yardOf = tr; cp.xw = ss.XW; if (ss.lead0 != null) cp.lead0 = ss.lead0; out.set(tr, cp);
      ss.k = nextK(ss, ss.A[ss.tr.seq.length - 1]); begin(ss, plan);
    }
    sets.forEach(st => { if (st.trips.length) begin({ st, k: 0 }, null); });
    for (let guard = 0; Q.length && guard < 200000; guard++) {
      let m = 0; for (let q = 1; q < Q.length; q++) if (Q[q].t < Q[m].t) m = q;
      const ss = Q.splice(m, 1)[0].ss, tr = ss.tr, n = tr.seq.length, i = ss.i, s = tr.seq[i], nx = tr.seq[i + 1];
      const run = tr.arr[i + 1] - tr.dep[i], sk = s + '|' + nx, sd = sk + '|' + (tr.down ? 'd' : 'u'), last = i + 1 === n - 1;
      const stopN = last || tr.stop[i + 1], nt = ss.st.trips[nextK(ss, ss.D[i])], same = last && nt && nt.seq[0] === nx, at = nx === 'C' || nx === 'P' || nx === 'O' ? nx : null;
      let d = ss.D[i], a = 0, p = null, plan = null, win = null;
      for (let g = 0; g < 12; g++) {
        const d0 = d;
        for (const r of (segs.get(sd) || [])) if (r[0] <= d && d < r[0] + HW) d = r[0] + HW;   /* 前の列車が出てから HW 分は、同じ線路へ出ない */
        if (i === 0) d = throat(s, d, ss.L[0], 'dep');                                     /* 頭端の駅の出口で、入ってくる列車と交差しない */
        const isFT = sk === 'F|T' || sk === 'T|F'; let xres = null;
        if (isFT) { xres = xcross(d, run, tr.down); d = xres.d; }
        else if (BRSEG.has(sk)) { const u = [s, nx].sort().join('|'); for (let h = 0; h < 20; h++) { const r = (single.get(u) || []).find(x => x[2] !== tr.down && x[0] < d + run && d < x[1]); if (!r) break; d = r[1] + 0.2; } }   /* 単線：反対の列車が使っているあいだは出ない */
        a = d + run; if (xres) a = Math.max(a, xres.a); for (const r of (segs.get(sd) || [])) if (r[0] <= d && a < r[1] + HW) a = r[1] + HW;   /* 前の列車を追いこさない */
        { let back = false; const lim = ss.R[i] ? (occ.get(key(s, ss.L[i])) || []).filter(x => x !== ss.R[i] && x[0] >= ss.R[i][0]).reduce((m, x) => Math.min(m, x[0]), Infinity) : Infinity;   /* いまの番線を、次の列車が使い始める時刻 */
          for (const r of (segs.get(sd) || [])) if (r[0] > d && (r[0] < d + HW || r[1] < a + HW) && r[0] + HW + EPS < lim) { d = Math.max(d, r[0] + HW); back = true; }   /* あとから出る列車に追いこされる・すぐうしろにつかれるなら、その列車を先に通す（待避。2026-11-18 点検） */
          if (back) continue; }
        if (inHs(nx)) {
          if (last) {
            a = throat(nx, a, prefLanes(tr, i + 1, env)[0], 'arr');
            const nd = same ? Math.max(nt.dep[0], a + TURN) : a + 3, restOk = same && at && nd - a >= REST && yardFree(at, a + 3, nd - 5);
            win = !same || restOk ? [a - EIN, a + 3] : [a - EIN, nd + EPS]; plan = { nd, rest: !!restOk };
            p = pick(tr, i + 1, win[0], win[1]);
            if (p.wait > 0 && same && !restOk && at && nd - a >= 9 && yardFree(at, a + 3, nd - 5)) { win = [a - EIN, a + 3]; plan.rest = true; p = pick(tr, i + 1, win[0], win[1]); }   /* ホームがあかないときは、短くても休ませる */
          } else { const dn = Math.max(tr.dep[i + 1], a + (stopN ? 0.3 : 0)); win = [a - EIN, dn + EPS]; p = pick(tr, i + 1, win[0], win[1]); }
          if (p.wait > 0) { d += p.wait; continue; }   /* 次の駅の番線があかないときは、いまの駅で待つ */
          /* 単線の行き違い（2026-11-18 点検）：次の駅で、この区間へ反対向きに出ようとしている列車は、こちらが着くまで出られない。
             その列車の番線はこちらが着くまでふさがったまま。ほかにあく番線がなければ、こちらがいまの駅で待って、その列車を先に通す */
          if (BRSEG.has(sk) && !isFT) {
            const opp = []; for (const o of new Set(hs.stations[nx] ? hs.stations[nx].lanes.map(c => LCODE[c]) : [])) for (const r of occ.get(key(nx, o)) || []) {
              const w = r.own && r.own[0]; if (!w || w.tr === tr) continue; const ws = w.tr.seq; if (ws[w.j + 1] !== s) continue; if (r[0] < a && r[1] > d) opp.push({ o, r }); }
            if (opp.length) { const blocked = new Set(opp.map(x => x.o)), alt = prefLanes(tr, i + 1, env).find(o => !blocked.has(o) && !busy(key(nx, o), win[0], win[1]));
              if (alt == null) { d = Math.max(...opp.map(x => x.r[1] - EPS)) + run + 0.4; continue; }
              if (blocked.has(p.o)) p = { o: alt, wait: 0 }; }
          }
        }
        if (d === d0) break;
      }
      /* いまの駅の番線のおさえをのばす（うしろの列車のおさえの手前まで） */
      if (ss.R[i]) { const k0 = key(s, ss.L[i]);
        for (let h = 0; h < 3; h++) { const R0 = ss.R[i], nxt = (occ.get(k0) || []).filter(x => x !== R0 && x[0] >= R0[0]).sort((x, y) => x[0] - y[0])[0]; if (!nxt || nxt[0] - 0.02 >= d + EPS || !relocate(s, nxt)) break; }
        const lim = extend(k0, ss.R[i], d + EPS) - EPS;
        if (lim < d) {   /* うしろの列車のために、いまの番線はあける（次の駅へはゆっくり進み、着く時刻はそのまま）。
                            ただし、先に出た列車を追いこす・すぐうしろにつく出かたはしない（2026-11-18 点検：川辺で快速が普通のすぐうしろを走っていた） */
          let e = lim; for (let h = 0; h < 10; h++) { let moved = false; for (const r of (segs.get(sd) || [])) if (e < r[0] + HW && !(e + HW <= r[0] && a + HW <= r[1])) { e = r[0] + HW; moved = true; }
            if (BRSEG.has(sk)) { if (sk === 'F|T' || sk === 'T|F') { if (e < d) { e = d; moved = true; } } else { const u = [s, nx].sort().join('|'), r = (single.get(u) || []).find(x => x[2] !== tr.down && x[0] < a && e < x[1]); if (r) { e = r[1] + 0.2; moved = true; } } }   /* 単線：反対の列車がいるうちは出ない（早く出すときも） */
            if (!moved) break; }
          if (e < d) d = Math.max(ss.D[i], e);
          /* それでも出られない（事故の運転見合わせなど）：うしろの列車を、この番線があくまで駅の手前で待たせる（2026-11-21 点検：事故の日に川辺4番線で2本が重なっていた） */
          if (d > lim + 1e-6) { const R0 = ss.R[i], nxt = (occ.get(k0) || []).filter(x => x !== R0 && x[0] >= R0[0]).sort((x, y) => x[0] - y[0])[0];
            if (nxt && nxt.own && nxt.own.length === 1 && nxt.own[0].ss) { const o = nxt.own[0], s2 = o.ss, j2 = o.j, dl = d + EPS + 0.02 - nxt[0];
              if (dl > 0 && j2 > 0 && s2.A[j2] != null && !(s2.D[j2] != null && j2 < s2.tr.seq.length - 1 && Q.every(x => x.ss !== s2))) {
                nxt[0] += dl; s2.A[j2] += dl; const dn2 = Math.max(s2.D[j2], s2.A[j2] + (s2.tr.stop[j2] ? 0.3 : 0));
                if (dn2 > s2.D[j2]) { s2.D[j2] = dn2; nxt[1] = Math.max(nxt[1], dn2 + EPS); const q = Q.find(x => x.ss === s2); if (q) q.t = Math.max(q.t, dn2); }
                const sg = segs.get(s2.tr.seq[j2 - 1] + '|' + s2.tr.seq[j2] + '|' + (s2.tr.down ? 'd' : 'u')); if (sg) { const r2 = sg.find(r => Math.abs(r[1] - (s2.A[j2] - dl)) < 1e-6); if (r2) r2[1] = s2.A[j2]; }
                { const u2 = [s2.tr.seq[j2 - 1], s2.tr.seq[j2]].sort().join('|'), sl = single.get(u2); if (sl) { const r3 = sl.find(r => r[2] === s2.tr.down && Math.abs(r[1] - (s2.A[j2] - dl)) < 1e-6); if (r3) { r3[1] = s2.A[j2]; if (r3.to != null) r3.to += dl; } } }   /* 単線：その列車がまだ区間にいるあいだ、反対の列車を入れない */
                extend(k0, R0, d + EPS); } } }
        } }
      ss.D[i] = d; ss.A[i + 1] = a;
      if (env.log) env.log({ num: tr.num, at: nx, d, a, lane: p && p.o, win, busyNow: p ? (occ.get(key(nx, p.o)) || []).map(r => r.slice()) : null });   /* 確かめ用 */
      if (!segs.has(sd)) segs.set(sd, []); segs.get(sd).push([d, a]);
      if (sk === 'K|F' || sk === 'O|T') BRL.push([d, d - tr.dep[i]]);   /* 支線に入る列車の遅れ（運転整理を決めるため） */
      if (BRSEG.has(sk)) { const u = [s, nx].sort().join('|'); if (!single.has(u)) single.set(u, []); const rec = [d, a, tr.down];
        if (u === 'F|T') { xcross(d, run, tr.down, true); const fa = tr.down ? XF : 1 - XF, t0 = d + run * fa, t1 = Math.max(t0, a - run * (1 - fa)); rec.ti = t0; rec.to = t1; rec.ss = ss; rec.i = i; rec.k = ss.k; rec.seg = segs.get(sd)[segs.get(sd).length - 1]; if (t1 - t0 > 0.05) ss.XW[i] = [t0, t1]; }
        single.get(u).push(rec); }
      if (i === 0) noteThroat(s, d, ss.L[0], 'dep');
      ss.i = i + 1;
      if (!inHs(nx)) { ss.D[i + 1] = Math.max(tr.dep[i + 1], a + (stopN && !last ? 0.3 : 0)); if (last) { finish(ss, null); continue; } Q.push({ t: ss.D[i + 1], ss }); continue; }
      const o = p.o; ss.L[i + 1] = o;
      if (!last) { const dn = Math.max(tr.dep[i + 1], a + (stopN ? 0.3 : 0)); ss.D[i + 1] = dn; ss.R[i + 1] = put(key(nx, o), a - EIN, dn + EPS); ss.R[i + 1].own = [{ L: ss.L, j: i + 1, tr, ss }]; Q.push({ t: dn, ss }); continue; }
      /* 終点 */
      noteThroat(nx, a, o, 'arr');
      const nd = same ? Math.max(nt.dep[0], a + TURN) : a + 3;
      if (!same) { put(key(nx, o), a - EIN, a + 3 + (at ? 2.5 : 0)).own = [{ L: ss.L, j: i + 1, tr }];   /* 車庫のある駅：入庫の回送が入出庫線をぬけるまで（a+3 から出て2〜3分）番線を押さえる */ finish(ss, nt ? { s: nt.seq[0], lane: null, from: nt.dep[0] - 2.5, floor: a + TURN } : null); continue; }
      if (plan.rest) {
        put(key(nx, o), a - EIN, a + 3 + 2.5).own = [{ L: ss.L, j: i + 1, tr }]; (yuse[at] = yuse[at] || []).push([a + 3, nd - 5]);   /* 休みに入る回送が入出庫線をぬけるまで押さえる */
        const rr = { at, t0: a + 3, t1: nd - 5, after: tr }; if (!rests.has(ss.st)) rests.set(ss.st, []); rests.get(ss.st).push(rr);
        finish(ss, { s: nx, lane: null, from: nd - 5, floor: nd, rest: rr }); continue;
      }
      { const rec = put(key(nx, o), a - EIN, nd + EPS); rec.own = [{ L: ss.L, j: i + 1, tr }]; finish(ss, { s: nx, lane: o, floor: nd, rec }); }
    }
    CXL.forEach((why, t) => { const cp = Object.create(t); cp.cancel = true; cp.cxl = why; cp.yardOf = t; out.set(t, cp); });
    return { map: out, rests, cancels: [...CXL.keys()] };
  }

  /* 実際の発着をもった列車（元の列車をうけつぐ。パネルの位置・札に使う） */
  function actual(tr, D2) { const a = D2.A.get(tr); if (!a) return tr; const p = Object.create(tr); p.arr = a.arr; p.dep = a.dep; p.base = tr; p.why = a.why; p.cancel = !!a.cancel; return p; }

  /* 編成がいま車庫にいるか */
  const lead0 = s => { const t = s.trips && s.trips[0]; return t && t.lead0 != null ? t.lead0 : 1; };   /* 始発が発車の何分前にホームに入るか */
  const inDepot = (s, T) => T < s.first - lead0(s) - 7 || T > s.last + 9;

  const api = { lead0, bodyPts, segPt, yardGeo, yardCap, slotTrk, slotDep, setYardNeed, PER, LINK, GEO, STEP, setPL, kPath, laneGeo, YK5, YK6, yard, prefLanes, frontOff, LCODE, bigIncident, POLICY, requests, boats, policyStats, SYN_TYPES, extST, buildReg, fitTrip, synth, fee, synOnSiding, synDwell, synLate, extConns, synHighlights, LANES, SIGBOX, SHORT, Y, MAIN, BR, TYPE_COL, TYPE_BODY, REASON, RULE, disrupt, actual, layout, laneOff, trackNo, trainPos, reasons, highlights, inDepot, fmtMin, smooth };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CtcCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
