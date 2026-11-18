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
    /* 本線：駅の場内・出発 */
    for (const s of MAINS) {
      const st = HS.stations[s]; if (!st) continue; const k = SX[s].km, lanes = st.lanes.map(lc);
      const dl = lanes.filter(o => o < 0), ul = lanes.filter(o => o > 0);
      if (s === 'C') {
        lanes.forEach((o, j) => add({ kind: '出発', line: 'd', dir: 1, st: s, lane: o, km: k + 0.29, y: row.d, sub: j }));   /* 出発信号は番線ごとに縦一列（2026-11-18） */
        add({ kind: '場内', line: 'u', dir: -1, st: s, km: k + 0.66, y: row.u });
      } else if (s === 'P') {
        add({ kind: '場内', line: 'd', dir: 1, st: s, km: k - 0.66, y: row.d });
        lanes.forEach((o, j) => add({ kind: '出発', line: 'u', dir: -1, st: s, lane: o, km: k - 0.29, y: row.u, sub: j }));
      } else {
        add({ kind: '場内', line: 'd', dir: 1, st: s, km: k - 0.45, y: row.d });
        const so = st.stop === 'stagger' ? 0.04 : 0.17;   /* 千鳥の駅は、止まる位置のすぐ先に */
        dl.forEach((o, j) => add({ kind: '出発', line: 'd', dir: 1, st: s, lane: o, km: k + so, y: row.d, sub: j }));
        add({ kind: '場内', line: 'u', dir: -1, st: s, km: k + 0.45, y: row.u });
        ul.forEach((o, j) => add({ kind: '出発', line: 'u', dir: -1, st: s, lane: o, km: k - so, y: row.u, sub: j }));
      }
    }
    /* 本線：閉塞信号（駅と駅のあいだ、約 block.km ごと） */
    const step = (HS.block && HS.block.km) || 1.0;
    for (let j = 0; j < MAINS.length - 1; j++) {
      const a = SX[MAINS[j]].km, b = SX[MAINS[j + 1]].km;
      const a0 = a + (MAINS[j] === 'C' ? 0.75 : 0.45), b0 = b - (MAINS[j + 1] === 'P' ? 0.75 : 0.45), len = b0 - a0, n = Math.max(0, Math.floor(len / step));
      for (let q = 1; q <= n; q++) { const k = a0 + (len * q) / (n + 1); add({ kind: '閉塞', line: 'd', dir: 1, km: k, y: row.d }); add({ kind: '閉塞', line: 'u', dir: -1, km: a0 + len - (len * q) / (n + 1), y: row.u }); }
    }
    /* 支線（単線）：川辺の出口・森下・峠・温泉。駅と駅のあいだは1つの区間 */
    add({ kind: '場内', line: 'b', dir: -1, st: 'K', km: 1.55, br: true, y: row.bu });
    for (const s of BRS) {
      const st = HS.stations[s]; if (!st) continue; const k = SX[s].bkm, lanes = st.lanes.map(lc);
      if (s === 'O') { add({ kind: '場内', line: 'b', dir: 1, st: s, km: k - 0.5, br: true, y: row.bd }); lanes.forEach((o, j) => add({ kind: '出発', line: 'b', dir: -1, st: s, lane: o, km: k - 0.25, br: true, y: row.bu, sub: j })); continue; }
      add({ kind: '場内', line: 'b', dir: 1, st: s, km: k - 0.45, br: true, y: row.bd });
      add({ kind: '場内', line: 'b', dir: -1, st: s, km: k + 0.45, br: true, y: row.bu });
      lanes.forEach((o, j) => { add({ kind: '出発', line: 'b', dir: 1, st: s, lane: o, km: k + 0.16, br: true, y: row.bd, sub: j }); add({ kind: '出発', line: 'b', dir: -1, st: s, lane: o, km: k - 0.16, br: true, y: row.bu, sub: j }); });
    }
    /* 交換信号所（計画）：信号は消灯 */
    const sb = SX.F.bkm + C.SIGBOX;
    add({ kind: '場内', line: 'b', dir: 1, km: sb - 0.4, br: true, y: row.bd, plan: true }); add({ kind: '場内', line: 'b', dir: -1, km: sb + 0.4, br: true, y: row.bu, plan: true });
    /* 中央の連絡線（乗り入れだけ・2026-11-18）：入り（北・県央本線の東行きから）の場内、4・5番線から西へ出る出発、県央北からの場内 */
    if (C.LINK) {
      add({ kind: '場内', line: 'w', dir: 1, st: 'C', km: C.LINK.inW[1][0] - 0.12, fixY: C.YK6 - 7 });
      ['s', 's5'].forEach((c, j) => add({ kind: '出発', line: 'w', dir: -1, st: 'C', lane: lc(c), km: -0.06, sub: j }));
      add({ kind: '場内', line: 'n', dir: -1, st: 'C', km: C.LINK.north[1][0] + 0.06, fixY: C.LINK.north[1][1] - 9 });
    }
    sig.forEach(o => { o.x = o.br ? xb(o.km) : xm(o.km); if (o.fixY != null) { o.atLane = true; o.y = o.fixY; } if (o.kind === '出発') { o.atLane = true; o.y = (o.br ? B : M) + o.lane + (o.dir > 0 ? -7 : 7); } });
    /* 入換信号（車庫・留置線・臨港線の出入り口）：車両が出入りするときだけ進行 */
    const P = SX.P.km, shunt = [
      { at: 'C', name: '中央車庫の出入り口', x: xm(-0.74), y: M + 92 - 8 },
      { at: 'P', name: '港留置線の出入り口', x: xm(P - 0.96), y: M - 51 - 9 },
      { at: 'O', name: '温泉留置線の出入り口', x: xb(SX.O.bkm - 0.7), y: B + 32 - 8 },
      { at: 'Q', name: '港貨物ターミナルの出入り口', x: xm(P + (C.LINK ? C.LINK.frt[3] : -0.75)), y: Y.freight - 18 } ];   /* 出発信号は、その番線のすぐ横に */
    /* ホーム・番線・ポイント */
    for (const s in HS.stations) {
      const st = HS.stations[s], br = BRS.includes(s), x = br ? xb(SX[s].bkm) : xm(SX[s].km), y0 = br ? B : M;
      (st.plats || []).forEach(p => {
        const o = p.y.map(lc), a = Math.min(...o), b = Math.max(...o);
        const yy = o.length > 1 ? [y0 + a + 4, y0 + b - 4] : p.side < 0 ? [y0 + a - 12, y0 + a - 4] : [y0 + a + 4, y0 + a + 12];
        plats.push({ st: s, type: p.type, kind: st.kind, x0: x + p.x[0] * pxk, x1: x + p.x[1] * pxk, y0: yy[0], y1: yy[1] });
      });
      const px0 = Math.min(...(st.plats || [{ x: [0, 0] }]).map(p => p.x[0]));
      st.lanes.forEach((c, j) => { if (st.num[j]) nums.push({ st: s, n: st.num[j], x: x + px0 * pxk - 9, y: y0 + lc(c) }); });
      (st.points || []).forEach(p => pts.push({ st: s, no: p.no, what: p.what, a: p.a != null ? lc(p.a) : null, b: p.b != null ? lc(p.b) : null, trunk: p.trunk != null ? lc(p.trunk) : p.a != null ? lc(p.a) : null, len: (p.len || 0.15) * pxk, ly: p.ly != null ? lc(p.ly) : null, side: p.side || (p.at < 0 ? 'W' : 'E'), cross: !!p.cross, x: x + p.at * pxk, y0, br }));
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
          asp.set(o, !t || ahead || single ? R : nxA === R ? Yw : G); if (t && !ahead && !single) routes.push({ t, kind: 'dep', st: o.st, o, nx });
          continue;
        }
        if (o.kind === '場内') {
          const t = trains.find(t => t.line === line && t.dir === dir && t.moving && t.tr.seq[t.i + 1] === o.st && (o.km - t.km) * dir > -0.05 && (o.km - t.km) * dir < 2.6);
          if (!t) { asp.set(o, R); continue; }
          const j2 = t.i + 1, lane = laneAt(t, j2), stops = j2 === t.tr.seq.length - 1 || t.tr.stop[j2];
          const busy = trains.some(x => x !== t && atSt(x) === o.st && laneAt(x, x.i) === lane);
          if (busy) { asp.set(o, R); continue; }
          const dep = lay.sig.find(x => x.kind === '出発' && x.st === o.st && x.lane === lane && x.dir === dir);
          asp.set(o, stops ? Yw : dep && asp.get(dep) === G ? G : Yw); routes.push({ t, kind: 'arr', st: o.st });
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
        if (p.a != null && lane !== p.a && lane !== p.b) continue;
        const sideOk = p.side === 'W' ? (entry ? t.dir > 0 : t.dir < 0) : (entry ? t.dir < 0 : t.dir > 0);
        if (!sideOk) continue;
        if (!best || when < best.when) best = { t, lane, when, entry };
      }
      if (!best) { pst.set(p, { rev: false, lock: false }); continue; }
      const lock = best.when - T < (best.entry ? 1.2 : 0.45);
      pst.set(p, { rev: p.b != null && best.lane === p.b, lock, lane: best.lane, t: best.t });
    }
    /* 踏切：列車が近づくと鳴る */
    const xst = new Map();
    for (const x of lay.xings) {
      const on = trains.some(t => t.br === x.br && ((t.lo - 0.03 < x.km && t.hi + 0.03 > x.km) || (t.moving && (x.km - t.km) * t.dir > 0 && (x.km - t.km) * t.dir < 0.7)));
      xst.set(x, on);
    }
    /* 入換信号：その車庫・留置線へ出入りする回送がいるとき、臨港線は貨物列車がターミナルの近くを走るとき */
    const sst = new Map(), P = SX.P.km;
    for (const sh of lay.shunt || []) sst.set(sh, sh.at === 'Q' ? trains.some(t => t.moving && (t.tr.seq[t.i] === 'Q' || t.tr.seq[t.i + 1] === 'Q') && t.km > P - 1.6)
      : Q.some(q => q.dead && q.n && ((q.n.yard || (q.s && q.s.home)) === sh.at)));
    return { trains, asp, routes, pst, xst, sst };
  }

  /* ---- 絵 ---- */
  function draw(ctx, lay, st, g) {
    const { L, C, T, pxk, hits, env, view } = g, Y = C.Y, big = pxk >= 400, mid = pxk >= 200;
    const x0v = view[0], x1v = view[1], vis = x => x > x0v - 60 && x < x1v + 60;
    /* 列車がいる区間（赤）とできた進路（白）：列車の下に */
    ctx.lineCap = 'round';
    for (const r of st.routes) {
      /* 進路：列車の先頭から、着く列車はホームの止まる位置まで、出る列車は次の信号まで（2026-11-18：途中で切れないように） */
      const tr = r.t.tr, j = r.kind === 'arr' ? r.t.i + 1 : r.t.i, ta = r.kind === 'arr' ? T : Math.max(T, tr.dep[j]), t1 = r.kind === 'arr' ? tr.arr[j] : (tr.arr[j + 1] || T + 1);
      const p0 = r.t.q.p, pts = [[p0.x, p0.y]], dir = p0.dir, stopX = r.kind === 'dep' && r.nx ? r.nx.x : null;
      for (let k = 1; k <= 40; k++) { const t = ta + (Math.max(ta, t1) - ta) * k / 40, p = C.trainPos(tr, t, L, env);
        if (stopX != null && (p.x - stopX) * dir >= 0) { const q = pts[pts.length - 1], u = (stopX - q[0]) / ((p.x - q[0]) || 1); pts.push([stopX, q[1] + (p.y - q[1]) * Math.max(0, Math.min(1, u))]); break; }
        pts.push([p.x, p.y]); }
      if (!vis(pts[0][0]) && !vis(pts[pts.length - 1][0])) continue;
      ctx.strokeStyle = 'rgba(240,246,252,.85)'; ctx.lineWidth = 3.4; ctx.beginPath(); pts.forEach((p, k) => k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke();
    }
    for (const t of st.trains) {
      const p = t.q.p; if (!vis(p.x)) continue;
      const len = Math.max(10, (t.tr.cars || 6) * 0.02 * pxk), xa = p.dir > 0 ? p.x - len : p.x, pad = Math.min(8, (t.moving ? 0.04 : 0.015) * pxk), ang = p.ang || 0;   /* 列車のいる線路だけを赤く（列車より太くしない。2両目に見えないように） */
      if (p.body) { const B = p.body, c = Math.cos(ang), s2 = Math.sin(ang); ctx.strokeStyle = 'rgba(255,72,96,.75)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(p.x + c * pad, p.y + s2 * pad); B.forEach(q => ctx.lineTo(q[0], q[1])); const z = B[B.length - 1]; ctx.lineTo(z[0] - p.dir * pad, z[1]); ctx.stroke(); continue; }
      if (ang) { const c = Math.cos(ang), s2 = Math.sin(ang); ctx.strokeStyle = 'rgba(255,72,96,.75)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(p.x + c * pad, p.y + s2 * pad); ctx.lineTo(p.x - c * (len + pad), p.y - s2 * (len + pad)); ctx.stroke(); continue; }
      ctx.strokeStyle = 'rgba(255,72,96,.75)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(xa - pad, p.y); ctx.lineTo(xa + len + pad, p.y); ctx.stroke();
    }
    ctx.lineCap = 'butt';
    /* 踏切 */
    for (const x of lay.xings) {
      if (!vis(x.x)) continue; const on = st.xst.get(x), blink = on && Math.floor(performance.now() / 400) % 2;
      ctx.strokeStyle = on ? (blink ? '#ffcc33' : '#a07a16') : '#55626f'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(x.x - 3, x.y0); ctx.lineTo(x.x - 3, x.y1); ctx.moveTo(x.x + 3, x.y0); ctx.lineTo(x.x + 3, x.y1); ctx.stroke();
      if (mid) { ctx.font = '9.5px "Zen Kaku Gothic New",sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = on ? '#ffcc33' : '#6c7a88'; ctx.fillText(on ? '踏切 鳴動' : '踏切', x.x, x.y1 + 10); }
    }
    /* ポイント：番号と、つながっている向き（水色）。鎖錠は鍵の印（2026-11-18：分かれる線の上に描き、番号は重ならないようにずらす） */
    const boxes = [];
    for (const p of lay.pts) {
      if (!vis(p.x)) continue; const s = st.pst.get(p) || {};
      const yt = p.y0 + (p.trunk != null ? p.trunk : p.ly != null ? p.ly : 0);
      if (p.a != null && p.b != null) {
        const dx = p.side === 'W' ? 1 : -1, to = p.y0 + (s.rev ? p.b : p.a), u = Math.min(1, 16 / Math.hypot(p.len, to - yt));
        ctx.strokeStyle = '#4fd1ff'; ctx.lineWidth = 3.2; ctx.beginPath(); ctx.moveTo(p.x, yt); ctx.lineTo(p.x + dx * p.len * u, yt + (to - yt) * u); ctx.stroke();
      }
      if (mid) {
        const out = p.ly != null ? p.ly : p.trunk != null ? (p.a != null && p.b != null && p.a + p.b !== 0 ? (p.a + p.b) / 2 : p.trunk) : 0, up = out < 0 || (out === 0 && p.side === 'W');
        ctx.font = '700 11px "Zen Kaku Gothic New",sans-serif'; const w = ctx.measureText(p.no).width + (s.lock ? 11 : 0);
        let ly = yt + (up ? -12 : 18), lx = p.x + (p.cross ? 0 : p.side === 'W' ? -9 : 9);   /* 番号は駅の外側へ少しずらす（出発信号と重ならないように） */
        for (let k = 0; k < 6 && boxes.some(b => Math.abs(b.x - lx) < (b.w + w) / 2 + 2 && Math.abs(b.y - ly) < 13); k++) ly += up ? -13 : 13;
        boxes.push({ x: lx, y: ly, w });
        ctx.textAlign = 'center'; ctx.fillStyle = '#4fd1ff'; ctx.fillText(p.no, lx - (s.lock ? 5.5 : 0), ly);
        if (s.lock) { const kx = lx + w / 2 - 9, ky = ly - 9; ctx.strokeStyle = '#ffd36b'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(kx + 4, ky + 3.5, 2.6, Math.PI, 0); ctx.stroke(); ctx.fillStyle = '#ffd36b'; ctx.fillRect(kx + 0.5, ky + 3.5, 7, 6); }
        hits.push({ x0: lx - w / 2 - 3, x1: lx + w / 2 + 3, y0: ly - 12, y1: ly + 4, point: p, ps: s });
      }
    }
    /* 番線の番号 */
    if (mid) { ctx.font = '700 10px "IBM Plex Mono",monospace'; ctx.textAlign = 'right'; ctx.fillStyle = '#7fb6d8'; for (const n of lay.nums) if (vis(n.x)) ctx.fillText(String(n.n), n.x, n.y + 3.5); }
    /* 入換信号：黒い板に白い灯2つ（よこ＝止まれ・ななめ＝進んでよい） */
    for (const sh of lay.shunt || []) {
      if (!vis(sh.x)) continue; const on = st.sst && st.sst.get(sh), w = 12;
      ctx.fillStyle = '#05090d'; ctx.strokeStyle = '#6c7a88'; ctx.lineWidth = 1; ctx.fillRect(sh.x - w / 2, sh.y - w / 2, w, w); ctx.strokeRect(sh.x - w / 2 + 0.5, sh.y - w / 2 + 0.5, w - 1, w - 1);
      ctx.fillStyle = on ? '#ffffff' : '#c9d3dc'; const d = [[-3, on ? 3 : 0], [3, on ? -3 : 0]];
      d.forEach(([dx, dy]) => { ctx.beginPath(); ctx.arc(sh.x + dx, sh.y + dy, 1.7, 0, Math.PI * 2); ctx.fill(); });
      if (big) { ctx.font = '10px "Zen Kaku Gothic New",sans-serif'; ctx.textAlign = 'left'; ctx.fillStyle = '#c9d3dc'; ctx.fillText('入換', sh.x + 9, sh.y + 4); }
      hits.push({ x0: sh.x - 8, x1: sh.x + 8, y0: sh.y - 8, y1: sh.y + 8, shunt: sh, on });
    }
    /* 信号 */
    for (const o of lay.sig) {
      if (!vis(o.x)) continue; const a = o.plan ? null : st.asp.get(o) ?? R, r = big ? 6.5 : mid ? 4.8 : 3.4;
      const ty = (o.line === 'd' || (o.line === 'b' && o.dir === 1)) ? -1 : 1, base = o.br ? Y.br : Y.main, trackY = base + ty * (o.br ? 12 : Y.side + 4);
      const sy = o.y + (o.sub || 0) * 0 ;
      const rr = o.atLane ? Math.max(2.8, r * 0.72) : r;
      if (!o.atLane) { ctx.strokeStyle = '#6c7a88'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(o.x, trackY); ctx.lineTo(o.x, sy); ctx.stroke(); }
      ctx.fillStyle = '#0d1620'; ctx.beginPath(); ctx.arc(o.x, sy, rr + 1.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = a == null ? OFF : COL[a]; ctx.beginPath(); ctx.arc(o.x, sy, rr, 0, Math.PI * 2); ctx.fill();
      if (big && !(o.atLane && o.sub)) { ctx.font = '10.5px "Zen Kaku Gothic New",sans-serif'; ctx.textAlign = o.dir > 0 ? 'left' : 'right'; ctx.fillStyle = o.kind === '閉塞' ? '#c9a8ff' : o.kind === '場内' ? '#ffd36b' : '#9fd3ff'; ctx.fillText(o.kind, o.x + o.dir * (rr + 4), sy + 4); }
      hits.push({ x0: o.x - r - 3, x1: o.x + r + 3, y0: sy - r - 3, y1: sy + r + 3, sig: o, asp: a });
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
  const api = { build, state, draw, explain, R, Y: Yw, G };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.CtcSignal = api;
})(typeof window !== 'undefined' ? window : globalThis);
