/* 指令パネルの信号・ポイント・ホーム・踏切（2026-11-17・川辺の指令室と同じ見せ方）。
   - 置き場所（build）：data/ctc-haisen.json の駅の形から、場内・出発・閉塞の信号、ポイントの番号、ホーム、踏切の位置を作る（キロどおり）。
   - いまの様子（state）：列車の位置（CtcView の posAll）だけを読んで、信号の色（赤・黄・緑）、ポイントの向きと鎖錠、列車がいる区間（赤）、
     できた進路（白）、鳴っている踏切を決める。ゲームの計算には返さない（見せ方の層）。
   - 絵（draw）：canvas に描く。DOM はさわらない（node でも build と state は動く）。数字はすべて仮。 */
(function (root) {
  'use strict';
  const R = 0, Yw = 1, G = 2;   /* 信号の色：止まれ・注意・進め */
  const COL = ['#ff4040', '#ffcc33', '#3fd36b'], OFF = '#3a4654';

  /* ---- 置き場所 ---- */
  function build(HS, SX, L, C) {
    const Y = C.Y, M = Y.main, B = Y.br, pxk = L.pxk, lc = c => C.LCODE[c];
    const xm = k => L.xm(k), xb = k => L.xb(k);
    const sig = [], pts = [], plats = [], nums = [], xings = [];
    const MAINS = ['C', 'S', 'U', 'M', 'K', 'N', 'P'], BRS = ['F', 'T', 'O'];
    const row = { d: M - 46, u: M + 46, bd: B - 30, bu: B + 30 };
    const add = (o) => { o.id = sig.length; sig.push(o); return o; };
    /* 本線：駅の場内・出発（2026-11-18：GEO から。出発は止まった列車の先頭のすぐ先、場内は分かれ道の外） */
    const G = C.GEO, ST = C.STEP, homeD = s => s === 'K' ? G.K.d0 + ST + 0.06 : (G[s].cross ? G[s].cross[1] : G[s].d0 + (s === 'C' ? 2 : 1) * ST) + 0.06;
    for (const s of MAINS) {
      const st = HS.stations[s]; if (!st) continue; const k = SX[s].km, lanes = st.lanes.map(lc), g = G[s];
      const dl = lanes.filter(o => o < 0), ul = lanes.filter(o => o > 0);
      if (s === 'C') {
        lanes.forEach((o, j) => add({ kind: '出発', line: 'd', dir: 1, st: s, lane: o, km: k + g.sig, sub: j }));   /* 出発信号は番線ごとに縦一列 */
        add({ kind: '場内', line: 'u', dir: -1, st: s, km: k + homeD(s) });
      } else if (s === 'P') {
        add({ kind: '場内', line: 'd', dir: 1, st: s, km: k - homeD(s) });
        lanes.forEach((o, j) => add({ kind: '出発', line: 'u', dir: -1, st: s, lane: o, km: k - g.sig, sub: j }));
      } else {
        add({ kind: '場内', line: 'd', dir: 1, st: s, km: k - homeD(s) });
        dl.forEach((o, j) => add({ kind: '出発', line: 'd', dir: 1, st: s, lane: o, km: k + g.sig, sub: j }));
        add({ kind: '場内', line: 'u', dir: -1, st: s, km: k + (s === 'K' ? G.K.X7 + 0.08 : homeD(s)) });
        ul.forEach((o, j) => add({ kind: '出発', line: 'u', dir: -1, st: s, lane: o, km: k - g.sig, sub: j }));
      }
    }
    /* 本線：閉塞信号（駅と駅のあいだ、約 block.km ごと） */
    const step = (HS.block && HS.block.km) || 1.0;
    for (let j = 0; j < MAINS.length - 1; j++) {
      const a = SX[MAINS[j]].km, b = SX[MAINS[j + 1]].km;
      const a0 = a + homeD(MAINS[j]) + (MAINS[j] === 'K' ? G.K.X7 : 0.1), b0 = b - homeD(MAINS[j + 1]) - 0.1, len = b0 - a0, n = Math.max(0, Math.floor(len / step));
      for (let q = 1; q <= n; q++) { const k = a0 + (len * q) / (n + 1); add({ kind: '閉塞', line: 'd', dir: 1, km: k }); add({ kind: '閉塞', line: 'u', dir: -1, km: a0 + len - (len * q) / (n + 1) }); }
    }
    /* 支線（単線）：川辺の支線の場内（⑥の先・もとの指令盤の BH）・森下・峠・温泉。駅と駅のあいだは1つの区間 */
    add({ kind: '場内', line: 'b', dir: -1, st: 'K', km: G.K.X6 + 0.1, br: true, trk: M + G.K.LV, up: false });
    for (const s of BRS) {
      const st = HS.stations[s]; if (!st) continue; const k = SX[s].bkm, lanes = st.lanes.map(lc), g = G[s], hd = g.d0 + ST / 2 + 0.06;
      if (s === 'O') { add({ kind: '場内', line: 'b', dir: 1, st: s, km: k - hd, br: true }); lanes.forEach((o, j) => add({ kind: '出発', line: 'b', dir: -1, st: s, lane: o, km: k - g.sig, br: true, sub: j })); continue; }
      add({ kind: '場内', line: 'b', dir: 1, st: s, km: k - hd, br: true });
      add({ kind: '場内', line: 'b', dir: -1, st: s, km: k + hd, br: true });
      lanes.forEach((o, j) => { add({ kind: '出発', line: 'b', dir: 1, st: s, lane: o, km: k + g.sig, br: true, sub: j }); add({ kind: '出発', line: 'b', dir: -1, st: s, lane: o, km: k - g.sig, br: true, sub: j }); });
    }
    /* 交換信号所（計画）：信号は消灯 */
    const sb = SX.F.bkm + C.SIGBOX;
    add({ kind: '場内', line: 'b', dir: 1, km: sb - 0.4, br: true, plan: true }); add({ kind: '場内', line: 'b', dir: -1, km: sb + 0.4, br: true, plan: true });
    /* 中央の連絡線（乗り入れだけ・2026-11-18）：入り（北・県央本線の東行きから）の場内、4・5番線から西へ出る出発、県央北からの場内 */
    if (C.LINK) {
      add({ kind: '場内', line: 'w', dir: 1, st: 'C', km: C.LINK.inW[1][0] - 0.12, trk: C.YK6, up: true });
      ['s', 's5'].forEach((c, j) => add({ kind: '出発', line: 'w', dir: -1, st: 'C', lane: lc(c), km: -0.03, sub: j }));   /* 西へ出る乗り入れ：止まった列車（先頭は0km）のすぐ先 */
      add({ kind: '場内', line: 'n', dir: -1, st: 'C', km: C.LINK.north[1][0] + 0.1, trk: C.YK5 - 40 * ((C.LINK.north[1][0] + 0.1 - 0.3) / 0.45), up: true });
    }
    /* 置き場所（川辺の指令室と同じ形）：線路から柱をのばした先に信号。下り（左→右）は線路の上、上りは下。出発は番線のすぐ横（柱が短い） */
    sig.forEach(o => { o.x = o.br ? xb(o.km) : xm(o.km);
      if (o.kind === '出発') { o.atLane = true; o.trk = (o.br ? B : M) + o.lane; o.up = o.br && o.st !== 'O' ? o.lane < 0 : o.dir > 0; }   /* 森下・峠は島式・相対式のホームをよけて外側に */
      else if (o.trk == null) { o.trk = o.br ? B : M + (o.dir > 0 ? -Y.lane : Y.lane); o.up = o.dir > 0; } else if (o.up == null) o.up = o.dir > 0;
      o.y = o.trk + (o.up ? -1 : 1) * (o.atLane ? 15 : 25); });
    /* 入換信号（2026-11-18）：入出庫線が本線・番線につながる所に1つずつ（main）、車庫・留置線・ターミナルの線ごとに1つずつ（はしごの手前・small）。
       その線を使う回送・貨物が動いているときだけ進行 */
    const P = SX.P.km, YG = C.yardGeo(), shunt = [];
    YG.C.lead.forEach((Ld, j) => shunt.push({ at: 'C', main: true, lad: j, name: `中央車庫の入出庫線（${j ? '5' : '3'}番線から）`, x: xm(Ld[1][0]) - 12, y: Ld[1][1] + 13 }));
    YG.C.tracks.forEach((t, k) => shunt.push({ at: 'C', t: k, small: true, name: `中央車庫 ${k + 1}番の線`, x: xm(t.jx) - 7, y: t.y }));
    shunt.push({ at: 'P', main: true, name: '港留置線の入出庫線（下りの本線から）', x: xm(P + YG.P.lead[0][0]) - 12, y: M - Y.lane - 14 });
    YG.P.tracks.forEach((t, k) => shunt.push({ at: 'P', t: k, small: true, name: `港留置線 ${k + 1}番の線`, x: xm(P + t.jx) - 7, y: t.y }));
    shunt.push({ at: 'Q', main: true, name: '港貨物ターミナルの入口', x: xm(P + YG.Q.lead[0][0]) - 14, y: YG.Q.tracks[0].y - 12 });
    YG.Q.tracks.forEach((t, k) => shunt.push({ at: 'Q', t: k, small: true, name: `港貨物ターミナル ${k + 1}番の線`, x: xm(P + t.jx) + 8, y: t.y }));
    shunt.push({ at: 'O', main: true, name: '温泉留置線の入出庫線', x: xb(SX.O.bkm + YG.O.lead[0][0]) - 10, y: B + 14 });
    /* ホーム・番線・ポイント */
    for (const s in HS.stations) {
      const st = HS.stations[s], br = BRS.includes(s), x = br ? xb(SX[s].bkm) : xm(SX[s].km), y0 = br ? B : M;
      const g = G[s];
      (st.plats || []).forEach(p => {
        const o = p.y.map(lc), a = Math.min(...o), b = Math.max(...o);
        const yy = o.length > 1 ? [y0 + a + 4, y0 + b - 4] : p.side < 0 ? [y0 + a - 18, y0 + a - 4] : [y0 + a + 4, y0 + a + 18];
        /* ホームの長さ＝止まるいちばん長い編成（GEO）。千鳥の駅は向きごと */
        const px = Array.isArray(g.plat) ? g.plat : p.side < 0 ? g.plat.down : g.plat.up;
        /* ホームの文字（川辺の指令室と同じ）：↑ 上の番線・↓ 下の番線、右に「ホーム（下り・温泉行）」 */
        const nm = c => st.num[st.lanes.indexOf(c)], sorted = p.y.slice().sort((u, v) => lc(u) - lc(v));
        const lines = o.length > 1 ? [`↑ ${nm(sorted[0])}番線`, `↓ ${nm(sorted[1])}番線`] : [`${p.side < 0 ? '↓' : '↑'} ${nm(p.y[0])}番線`];
        const dn = o.every(v => v < 0), upL = o.every(v => v > 0), head = st.stop === 'head';
        const what = head ? (s === 'C' ? 'ホーム（港・温泉方面）' : 'ホーム（中央方面）') : dn ? (br ? 'ホーム（下り・温泉行）' : 'ホーム（下り・港方面）') : upL ? 'ホーム（上り・中央行）' : 'ホーム';
        plats.push({ st: s, type: p.type, kind: st.kind, x0: x + px[0] * pxk, x1: x + px[1] * pxk, y0: yy[0], y1: yy[1], lines: lines.filter(t => !/undefined|0番線/.test(t)), what });
      });
      const px0 = Array.isArray(g.plat) ? g.plat[0] : Math.min(g.plat.down[0], g.plat.up[0]);
      st.lanes.forEach((c, j) => { if (st.num[j]) nums.push({ st: s, n: st.num[j], x: x + px0 * pxk - 9, y: y0 + lc(c) }); });
      (st.points || []).forEach(p => {
        const sg = Math.sign(p.at) || 1, tc = p.trunk != null ? lc(p.trunk) : p.a != null ? lc(p.a) : null, al = p.a != null ? lc(p.a) : null, bl = p.b != null ? lc(p.b) : null;
        const fl = al != null && bl != null && p.len == null ? (tc === 0 ? ST / 2 : Math.abs(bl - al) / (2 * Y.lane) * ST) : (p.len || ST);
        const at = p.cross ? sg * (g.cross[0] + g.cross[1]) / 2 : p.pos === 'fan' ? sg * (g.d0 + fl) : p.pos === 'fanC' ? sg * (g.d0 + ST) : p.pos === 'd0' ? sg * g.d0 : p.pos === 'X6' ? G.K.X6 : p.pos === 'X7' ? G.K.X7 : p.at;
        pts.push({ st: s, no: p.no, what: p.what, a: al, b: bl, trunk: tc, len: fl * pxk, ly: p.ly != null ? lc(p.ly) : null, side: p.side || (at < 0 ? 'W' : 'E'), out: p.legs === 'out', rule: p.rule || null, cross: !!p.cross, x: x + at * pxk, y0, br });
      });
    }
    /* 踏切 */
    const X = HS.crossings || {};
    (X.main || []).forEach(k => xings.push({ km: k, br: false, x: xm(k), y0: M - Y.lane - 7, y1: M + Y.lane + 7 }));
    (X.br || []).forEach(k => xings.push({ km: k, br: true, x: xb(k), y0: B - 7, y1: B + 7 }));
    /* 方向ごとの信号の並び（進む向きの順） */
    const chain = {};
    for (const ln of ['d', 'u', 'b+', 'b-', 'w+', 'w-', 'n-']) {
      const f = ln.length > 1 ? o => o.line === ln[0] && o.dir === (ln[1] === '+' ? 1 : -1) : o => o.line === ln;
      const dir = ln === 'u' || ln[1] === '-' ? -1 : 1; chain[ln] = sig.filter(o => f(o) && !o.plan).sort((p, q) => (p.km - q.km) * dir);
    }
    return { sig, pts, plats, nums, xings, chain, row, pxk, shunt };
  }

  /* ---- いまの様子 ---- */
  /* Q：[{tr, p:{x,y,dir,moving,i}, dead}]（CtcView の posAll）。T：いまの時刻（分） */
  function state(lay, Q, T, L, C, SX) {
    const Y = C.Y, pxk = L.pxk;
    const trains = Q.filter(q => !q.dead).map(q => {
      const tr = q.tr, i = q.p.i, wl = tr.seq[i] === 'W' || tr.seq[i + 1] === 'W', ql = tr.seq[i] === 'Q' || tr.seq[i + 1] === 'Q';   /* 連絡線・臨港線の列車は本線の段（高さで支線と見まちがえない） */
      const br = !wl && !ql && q.p.y < Y.main - 40, len = (tr.cars || 6) * 0.02;
      const km = br ? (q.p.x - L.xK) / pxk : q.p.x / pxk - L.ML;
      const lo = q.p.dir > 0 ? km - len : km, hi = q.p.dir > 0 ? km : km + len;
      const line = br ? 'b' : wl ? 'w' : q.p.dir > 0 ? 'd' : 'u';
      return { q, tr, br, km, lo, hi, line, dir: q.p.dir, i: q.p.i, moving: q.p.moving };
    });
    const occ = (line, a, b, not) => trains.some(t => t !== not && t.line === line && t.hi > Math.min(a, b) && t.lo < Math.max(a, b));
    const asp = new Map();
    /* 列車がいま止まっている駅と番線 */
    const atSt = t => !t.moving ? t.tr.seq[t.i] : null;
    const laneAt = (t, j) => t.tr.lanes ? t.tr.lanes[j] : null;
    /* 出発：その番線の列車が、まもなく出る（または通過する）なら進路をつくる */
    const routes = [];
    for (const ln of Object.keys(lay.chain)) {
      const ch = lay.chain[ln], line = ln[0];
      for (let j = ch.length - 1; j >= 0; j--) {
        const o = ch[j], nx = ch[j + 1], dir = o.dir, kn = nx ? nx.km : o.km + dir * 3;
        const ahead = occ(line, o.km + dir * 0.01, kn);
        const nxA = nx ? (asp.get(nx) ?? R) : G;
        if (o.kind === '閉塞') { asp.set(o, ahead ? R : nxA === R ? Yw : G); continue; }
        if (o.kind === '出発') {
          const t = trains.find(t => t.line === line && t.dir === dir && ((atSt(t) === o.st && laneAt(t, t.i) === o.lane && t.tr.dep[t.i] - T < 0.45 && T >= t.tr.arr[t.i] - 0.01) ||
            (t.moving && t.tr.seq[t.i + 1] === o.st && !t.tr.stop[t.i + 1] && laneAt(t, t.i + 1) === o.lane && t.tr.arr[t.i + 1] - T < 0.9)));
          const single = line === 'b' && nx && occ('b', o.km, kn) || (line === 'b' && trains.some(x => x.line === 'b' && x.dir !== dir && x.moving && (x.km - o.km) * dir > 0 && (x.km - kn) * dir < 0.5));
          const prep = t && atSt(t) === o.st && t.tr.dep[t.i] - T > 0.3;   /* 進路を作っているところ（点線）：まだ信号は開かない */
          asp.set(o, !t || ahead || single || prep ? R : nxA === R ? Yw : G); if (t && !ahead && !single) routes.push({ t, kind: 'dep', st: o.st, o, nx, prep });
          continue;
        }
        if (o.kind === '場内') {
          const t = trains.find(t => t.line === line && t.dir === dir && t.moving && t.tr.seq[t.i + 1] === o.st && (o.km - t.km) * dir > -0.05 && (o.km - t.km) * dir < 2.6);
          if (!t) { asp.set(o, R); continue; }
          const j2 = t.i + 1, lane = laneAt(t, j2), stops = j2 === t.tr.seq.length - 1 || t.tr.stop[j2];
          const busy = trains.some(x => x !== t && atSt(x) === o.st && laneAt(x, x.i) === lane);
          if (busy) { asp.set(o, R); continue; }
          const dep = lay.sig.find(x => x.kind === '出発' && x.st === o.st && x.lane === lane && x.dir === dir);
          const prep = (o.km - t.km) * dir > 1.6;
          asp.set(o, prep ? R : stops ? Yw : dep && asp.get(dep) === G ? G : Yw); routes.push({ t, kind: 'arr', st: o.st, prep });
        }
      }
    }
    /* ポイント：その番線へ、次に通る列車の向きにそろえる。進路ができていれば鎖錠 */
    const pst = new Map();
    for (const p of lay.pts) {
      if (p.cross) { pst.set(p, { rev: false, lock: false }); continue; }
      let best = null;
      for (const t of trains) {
        const s = p.st, seq = t.tr.seq; let j = -1, when = 0;
        if (t.moving && seq[t.i + 1] === s) { j = t.i + 1; when = t.tr.arr[j]; } else if (!t.moving && seq[t.i] === s) { j = t.i; when = t.tr.dep[j]; } else continue;
        const entry = !t.moving ? false : true, lane = laneAt(t, j); if (lane == null) continue;
        const toBr = t.tr.seq.includes('O') && t.tr.down, fromBr = t.tr.seq.includes('O') && !t.tr.down;
        if (p.rule) { if (p.rule === 'toBr' ? lane !== p.trunk : !(fromBr || (toBr && p.no === '⑥'))) continue; }   /* 川辺の③⑥⑦：温泉支線へ行く・来る列車 */
        else if (p.a != null && lane !== p.a && lane !== p.b) continue;
        const sideOk = p.side === 'W' ? (entry ? t.dir > 0 : t.dir < 0) : (entry ? t.dir < 0 : t.dir > 0);
        if (!sideOk) continue;
        if (!best || when < best.when) best = { t, lane, when, entry };
      }
      if (!best) { pst.set(p, { rev: false, lock: false }); continue; }
      /* 進路ができるまで（川辺の指令室と同じ）：ポイントの転換（点滅）→ 密着の確認 → 鎖錠 */
      const bt = best.t.tr, toB = bt.seq.includes('O') && bt.down, fromB = bt.seq.includes('O') && !bt.down;
      const lead = best.when - T, win = best.entry ? 1.2 : 0.45, lock = lead < win, rev = p.rule === 'toBr' ? toB : p.rule === 'fromBr' ? fromB : p.b != null && best.lane === p.b;
      const phase = lock ? 'lock' : lead < win + 0.05 ? 'check' : lead < win + 0.15 && rev ? 'move' : '';
      pst.set(p, { rev: rev && lead < win + 0.15, lock, phase, lane: best.lane, t: best.t });
    }
    /* 踏切：列車が近づくと鳴る */
    const xst = new Map();
    for (const x of lay.xings) {
      const on = trains.some(t => t.br === x.br && ((t.lo - 0.03 < x.km && t.hi + 0.03 > x.km) || (t.moving && (x.km - t.km) * t.dir > 0 && (x.km - t.km) * t.dir < 0.7)));
      xst.set(x, on);
    }
    /* 入換信号：その車庫・留置線へ出入りする回送がいるとき、臨港線は貨物列車がターミナルの近くを走るとき */
    const sst = new Map(), P = SX.P.km;
    const frt = trains.filter(t => t.moving && (t.tr.seq[t.i] === 'Q' || t.tr.seq[t.i + 1] === 'Q') && t.km > P - 1.6);
    const dead = Q.filter(q => q.dead && q.n && q.n.track);
    for (const sh of lay.shunt || []) sst.set(sh, sh.at === 'Q' ? frt.some(t => sh.t == null || (t.tr.num >> 1) % 4 === sh.t)
      : dead.some(q => q.n.track.at === sh.at && (sh.t != null ? q.n.track.t === sh.t : sh.lad == null || (C.yardGeo().C.tracks[q.n.track.t] || {}).lad === sh.lad)));
    /* 単線区間（川辺〜森下・森下〜峠・峠〜温泉）：使っている列車と向き */
    const one = [['K', 'F'], ['F', 'T'], ['T', 'O']].map(([a, b]) => { const ka = a === 'K' ? 0 : SX[a].bkm, kb = SX[b].bkm;
      const t = trains.find(t => t.line === 'b' && t.moving && t.hi > ka + (a === 'K' ? C.GEO.K.X6 : 0.25) && t.lo < kb - 0.25);
      return { a, b, ka, kb, t }; });
    return { trains, asp, routes, pst, xst, sst, one };
  }

  /* ---- 絵（川辺の指令室 proto/kawabe と同じ部品・2026-11-18） ---- */
  const K = { R: '#ff3b3b', Y: '#ffcc33', G: '#3ddc84', route: '#f4f7fb', sw: '#4fd8ff', bg: '#0c1826', head: '#05090e', headEdge: '#3a5470', post: '#8ea3b8' };
  const KCOL = [K.R, K.Y, K.G];
  const sizeOf = pxk => pxk >= 400 ? 1 : pxk >= 200 ? 0.8 : 0.6;
  const toward = (a, b, d) => { const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [a[0] + (b[0] - a[0]) / L * d, a[1] + (b[1] - a[1]) / L * d]; };
  const seg = (ctx, a, b) => { ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); };
  /* 列車の下：進路（白・作っているところは点線）、列車がいる区間（赤くにじむ）、踏切、ポイント */
  function draw(ctx, lay, st, g) {
    const { L, C, T, pxk, hits, env, view } = g, Y = C.Y, sc = sizeOf(pxk), mid = pxk >= 200;
    const x0v = view[0], x1v = view[1], vis = x => x > x0v - 60 && x < x1v + 60;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const r of st.routes) {
      /* 進路：列車の先頭から、着く列車はホームの止まる位置まで、出る列車は次の信号まで */
      const tr = r.t.tr, j = r.kind === 'arr' ? r.t.i + 1 : r.t.i, ta = r.kind === 'arr' ? T : Math.max(T, tr.dep[j]), t1 = r.kind === 'arr' ? tr.arr[j] : (tr.arr[j + 1] || T + 1);
      const p0 = r.t.q.p, pts = [[p0.x, p0.y]], dir = p0.dir, stopX = r.kind === 'dep' && r.nx ? r.nx.x : null;
      for (let k = 1; k <= 40; k++) { const t = ta + (Math.max(ta, t1) - ta) * k / 40, p = C.trainPos(tr, t, L, env);
        if (stopX != null && (p.x - stopX) * dir >= 0) { const q = pts[pts.length - 1], u = (stopX - q[0]) / ((p.x - q[0]) || 1); pts.push([stopX, q[1] + (p.y - q[1]) * Math.max(0, Math.min(1, u))]); break; }
        pts.push([p.x, p.y]); }
      if (!vis(pts[0][0]) && !vis(pts[pts.length - 1][0])) continue;
      ctx.strokeStyle = K.route; ctx.globalAlpha = r.prep ? 0.55 : 0.85; ctx.lineWidth = r.prep ? 3 : 4; ctx.setLineDash(r.prep ? [7, 6] : []);
      ctx.beginPath(); pts.forEach((p, k) => k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
    }
    /* 踏切 */
    ctx.lineCap = 'butt';
    for (const x of lay.xings) {
      if (!vis(x.x)) continue; const on = st.xst.get(x), blink = on && Math.floor(performance.now() / 400) % 2;
      ctx.strokeStyle = on ? (blink ? '#ffcc33' : '#a07a16') : '#55626f'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(x.x - 3, x.y0); ctx.lineTo(x.x - 3, x.y1); ctx.moveTo(x.x + 3, x.y0); ctx.lineTo(x.x + 3, x.y1); ctx.stroke();
      if (mid) { ctx.font = '9.5px "Zen Kaku Gothic New",sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = on ? '#ffcc33' : '#6c7a88'; ctx.fillText(on ? '踏切 鳴動' : '踏切', x.x, x.y1 + 10); }
    }
    /* ポイント：つながっている向きを水色の線、つながっていない側はすき間（線路を背景の色で切る）。転換中は点滅、鎖錠は🔒 */
    const boxes = [], blink = Math.floor(performance.now() / 220) % 2 === 0;
    for (const p of lay.pts) {
      if (!vis(p.x)) continue; const s = st.pst.get(p) || {};
      const yt = p.y0 + (p.trunk != null ? p.trunk : p.ly != null ? p.ly : 0), pt = [p.x, yt];
      if (p.a != null && p.b != null) {
        const dx = (p.side === 'W' ? 1 : -1) * (p.out ? -1 : 1), leg = { N: [p.x + dx * p.len, p.y0 + p.a], R: [p.x + dx * p.len, p.y0 + p.b] };
        const pos = s.rev ? 'R' : 'N', off = pos === 'N' ? 'R' : 'N', moving = s.phase === 'move';
        ctx.lineCap = 'butt'; ctx.strokeStyle = K.bg; ctx.lineWidth = 7;
        seg(ctx, toward(pt, leg[off], 3), toward(pt, leg[off], 13)); if (moving) seg(ctx, toward(pt, leg[pos], 3), toward(pt, leg[pos], 13));
        if (!moving || blink) { ctx.lineCap = 'round'; ctx.strokeStyle = K.sw; ctx.lineWidth = 5 * sc; ctx.setLineDash(moving ? [3, 3] : []); seg(ctx, pt, toward(pt, leg[pos], 28 * sc)); ctx.setLineDash([]); }
      }
      if (mid) {
        const out = p.ly != null ? p.ly : p.trunk != null ? (p.a != null && p.b != null && p.a + p.b !== 0 ? (p.a + p.b) / 2 : p.trunk) : 0, up = out < 0 || (out === 0 && p.side === 'W');
        const fs = Math.round(13 * sc), txt = p.no + (s.lock ? '🔒' : ''); ctx.font = `700 ${fs}px "Zen Kaku Gothic New",sans-serif`; const w = ctx.measureText(txt).width;
        let ly = yt + (up ? -10 - 4 * sc : 12 + 8 * sc), lx = p.x + (p.cross ? 0 : p.side === 'W' ? -10 : 10);
        for (let k = 0; k < 6 && boxes.some(b => Math.abs(b.x - lx) < (b.w + w) / 2 + 2 && Math.abs(b.y - ly) < fs + 2); k++) ly += up ? -(fs + 2) : fs + 2;
        boxes.push({ x: lx, y: ly, w });
        ctx.textAlign = 'center'; ctx.fillStyle = K.sw; ctx.fillText(txt, lx, ly);
        const sub = s.phase === 'move' ? '転換中' : s.phase === 'check' ? '密着確認' : '';
        if (sub) { ctx.font = `${Math.round(9.5 * sc + 1)}px "Zen Kaku Gothic New",sans-serif`; ctx.fillStyle = '#ffe08a'; ctx.fillText(sub, lx, ly + (up ? -fs : fs)); }
        hits.push({ x0: lx - w / 2 - 3, x1: lx + w / 2 + 3, y0: ly - fs, y1: ly + 4, point: p, ps: s });
      }
    }
    /* 番線の番号 */
    if (mid) { ctx.font = '700 10px "IBM Plex Mono",monospace'; ctx.textAlign = 'right'; ctx.fillStyle = '#7fb6d8'; for (const n of lay.nums) if (vis(n.x)) ctx.fillText(String(n.n), n.x, n.y + 3.5); }
    ctx.lineCap = 'butt'; ctx.lineJoin = 'miter';
  }
  /* 列車がいる区間（赤くにじむ帯）：列車の車体と同じ道すじに、太く・うすく。列車の下に描く */
  function drawOcc(ctx, st, g) {
    const { pxk, view } = g, vis = x => x > view[0] - 80 && x < view[1] + 80;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = K.R; ctx.globalAlpha = 0.38; ctx.lineWidth = 15;
    for (const t of st.trains) {
      const p = t.q.p; if (!vis(p.x)) continue; const B = bodyOf(p, t.tr, pxk);
      ctx.beginPath(); B.forEach((q, k) => k ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); ctx.stroke();
    }
    ctx.globalAlpha = 1; ctx.lineCap = 'butt'; ctx.lineJoin = 'miter';
  }
  /* 列車の車体の道すじ（先頭から最後尾へ） */
  function bodyOf(p, tr, pxk) {
    if (p.body) return p.body;
    const len = Math.max(10, (tr.cars || 6) * 0.02 * pxk), ang = p.ang != null ? p.ang : (p.dir > 0 ? 0 : Math.PI);
    return [[p.x, p.y], [p.x - Math.cos(ang) * len, p.y - Math.sin(ang) * len]];
  }
  /* 列車の上：信号機・入換信号・単線区間 */
  function drawTop(ctx, lay, st, g) {
    const { L, C, pxk, hits, view, sel } = g, Y = C.Y, sc = sizeOf(pxk), mid = pxk >= 200;
    const vis = x => x > view[0] - 60 && x < view[1] + 60;
    for (const o of lay.sig) {
      if (!vis(o.x)) continue; const a = o.plan ? null : st.asp.get(o) ?? R, x = o.x, hy = o.trk + (o.y - o.trk) * (o.atLane ? 1 : sc), up = o.up;
      const half = 9 * sc, isSel = sel && sel === o;
      ctx.strokeStyle = K.post; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, o.trk + (up ? -5 : 5)); ctx.lineTo(x, hy + (up ? half - 2 : -half + 2)); ctx.stroke();
      ctx.fillStyle = K.head; ctx.strokeStyle = isSel ? '#fff' : K.headEdge; ctx.lineWidth = isSel ? 2.5 : 1;
      ctx.beginPath(); ctx.arc(x, hy, half, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = a == null ? OFF : KCOL[a]; ctx.beginPath(); ctx.arc(x, hy, 6.5 * sc, 0, Math.PI * 2); ctx.fill();
      if (mid && !(o.atLane && o.sub)) {
        const fs = Math.round(11 * sc + 1); ctx.font = `${fs}px "Zen Kaku Gothic New",sans-serif`;
        const right = o.kind === '出発' ? o.dir > 0 : o.dir < 0, tx = right ? x + half + 4 : x - half - 4;   /* 出発は駅の外側へ（ホームの字と重ならないように） */ ctx.textAlign = right ? 'left' : 'right';
        ctx.fillStyle = o.kind === '場内' ? '#ffd77a' : o.kind === '出発' ? '#9cd6ff' : '#c9b6ff'; ctx.fillText(o.kind, tx, hy + fs * 0.35);
        if (isSel) { const w = ctx.measureText(o.kind).width, ux = right ? tx : tx - w; ctx.fillRect(ux, hy + fs * 0.35 + 2, w, 1.2); }
      }
      /* 川辺1番線の下りの出発には進路表示機（もとの指令盤と同じ）：開いているとき「港」か「温」（温泉支線） */
      if (o.st === 'K' && o.kind === '出発' && o.dir > 0 && o.lane === -Y.side && a != null && a !== R) { const r = st.routes.find(r => r.kind === 'dep' && r.o === o);
        if (r) { ctx.font = `700 ${Math.round(11 * sc + 1)}px "Zen Kaku Gothic New",sans-serif`; ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.fillText(r.t.tr.seq.includes('O') ? '温' : '港', x + half + 4, hy - 9 * sc); } }
      hits.push({ x0: x - half - 4, x1: x + half + 4, y0: hy - half - 4, y1: hy + half + 4, sig: o, asp: a });
    }
    /* 入換信号：黒い板に白い灯2つ（よこ＝止まれ・ななめ＝進んでよい） */
    for (const sh of lay.shunt || []) {
      if (!vis(sh.x) || (sh.small && pxk < 200)) continue; const on = st.sst && st.sst.get(sh), w = sh.small ? 5 + 2 * sc : 14 * sc + 2;
      ctx.fillStyle = K.head; ctx.strokeStyle = K.headEdge; ctx.lineWidth = 1; ctx.fillRect(sh.x - w / 2, sh.y - w / 2, w, w); ctx.strokeRect(sh.x - w / 2 + 0.5, sh.y - w / 2 + 0.5, w - 1, w - 1);
      ctx.fillStyle = on ? '#ffffff' : '#c9d3dc'; const d = sh.small ? 1.6 : 3.2 * sc + 0.5, r = sh.small ? 0.9 : 1.8 * sc + 0.4;
      [[-d, on ? d : 0], [d, on ? -d : 0]].forEach(([dx, dy]) => { ctx.beginPath(); ctx.arc(sh.x + dx, sh.y + dy, r, 0, Math.PI * 2); ctx.fill(); });
      if (mid && !sh.small) { ctx.font = `${Math.round(10 * sc + 1)}px "Zen Kaku Gothic New",sans-serif`; ctx.textAlign = 'left'; ctx.fillStyle = '#c9b6ff'; ctx.fillText('入換', sh.x + w / 2 + 3, sh.y + 4); }
      hits.push({ x0: sh.x - w / 2 - 2, x1: sh.x + w / 2 + 2, y0: sh.y - w / 2 - 2, y1: sh.y + w / 2 + 2, shunt: sh, on });
    }
    /* 単線区間：色はつけず、白いふちどりの矢印で「使っている列車の向き」と、文字で あき／使用中 */
    for (const u of st.one || []) {
      const xa = L.xb(u.ka), xb2 = L.xb(u.kb), xm = (xa + xb2) / 2; if (!vis(xm)) continue;
      const nm = { K: '川辺', F: '森下', T: '峠', O: '温泉' }, t = u.t, y = Y.br - 34;
      ctx.font = `${Math.round(11.5 * sc + 1)}px "Zen Kaku Gothic New",sans-serif`; ctx.textAlign = 'center'; ctx.fillStyle = '#9fb6cc';
      ctx.fillText(t ? `単線区間（${nm[u.a]}〜${nm[u.b]}） 使用中 ${t.dir > 0 ? '▶ ' + nm[u.b] + 'へ' : '◀ ' + nm[u.a] + 'へ'}：${g.name ? g.name(t.tr) : t.tr.num}` : `単線区間（${nm[u.a]}〜${nm[u.b]}）：あき`, xm, y);
      if (t) { const step = Math.floor(performance.now() / 300) % 3, k = t.dir > 0 ? 1 : -1; ctx.strokeStyle = K.route; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        for (let i = 0; i < 3; i++) { const x = xm - 12 + i * 12; ctx.globalAlpha = (k > 0 ? i : 2 - i) === step ? 1 : 0.35; ctx.beginPath(); ctx.moveTo(x - 4 * k, y + 6); ctx.lineTo(x + 4 * k, y + 13); ctx.lineTo(x - 4 * k, y + 20); ctx.stroke(); }
        ctx.globalAlpha = 1; ctx.lineCap = 'butt'; ctx.lineJoin = 'miter'; }
    }
  }
  /* 押したときの説明 */
  function explain(h, st, fmt, TY) {
    if (h.sig) {
      const o = h.sig, a = h.asp, nm = a == null ? '消灯（計画）' : ['止まれ（赤）', '注意（黄）', '進め（緑）'][a];
      const why = o.kind === '閉塞' ? (a === R ? 'この先の区間に列車がいるため' : a === Yw ? '次の信号が止まれのため' : '先の2区間があいている')
        : o.kind === '場内' ? (a === R ? '駅へ入る列車がいない／入る番線がふさがっているため' : a === Yw ? '駅に止まる列車の進路ができた' : '通過する列車の進路ができた')
          : (a === R ? 'この番線から出る列車がまだない／先の区間がふさがっているため' : '出発の進路ができた');
      return `<b>${o.kind}信号</b>${o.st ? '（' + o.st + '）' : ''}：${nm}<br><span class="muted">${why}</span>`;
    }
    if (h.shunt) return `<b>入換信号</b>（${h.shunt.name}）：${h.on ? '進んでよい（白い灯がななめ）' : '止まれ（白い灯がよこ）'}<br><span class="muted">${h.on ? '回送が車庫・留置線へ出入りしているため' : 'いま出入りする車両がないため'}</span>`;
    if (h.point) { const p = h.point, s = h.ps || {}; return `<b>ポイント${p.no}</b>（${p.what}）：${p.cross ? 'ふだんは使わない（非常用・臨時）' : s.rev ? 'となりの線へ（反位）' : 'まっすぐ（定位）'}${s.lock ? '・鎖錠中（進路ができている）' : ''}${s.t ? `<br><span class="muted">次に通る列車：${TY[s.t.tr.type].name} ${s.t.tr.num}</span>` : ''}`; }
    return '';
  }
  const api = { build, state, draw, drawOcc, drawTop, bodyOf, explain, R, Y: Yw, G };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.CtcSignal = api;
})(typeof window !== 'undefined' ? window : globalThis);
