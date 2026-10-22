/* 川辺駅 運転指令盤：しくみ（画面とは別）
   - 線路図の座標は 横1000×縦330（左＝中央方面、右＝港方面、右上＝温泉支線）
   - 時刻は「分」。0 = 7:00。CYCLE 分ごとに同じ並び（パターンダイヤ）をくり返す
   - 列車1本ごとに「入る進路（場内信号）」と「出る進路（出発信号）」を持つ
   - 信号の色は、そのときの列車の位置と進路から毎回計算する */
const KW = (() => {
  const CYCLE = 30, TA = 1.5, TB = 1.3, BASE = 7 * 60;
  const BRANCH_RUN = 4;          // 川辺→森下の走る時間（分）
  /* 進路ができるまで：ポイントの転換（T_MOVE）→ 密着の確認（T_CHECK）→ 鎖錠 → 信号が開く（T_OPEN） */
  const T_MOVE = 0.1, T_CHECK = 0.05, T_OPEN = 0.2, RD_LEAD = 0.5;
  const OUT_R = 1.2, OUT_Y = 2.6;  // 駅を出た列車が、外の閉塞区間（1つ先・2つ先）を通りぬけるまでの目安（分）

  const TYPES = {
    L: { name: '普通', color: '#a9b8c7', len: 150 },
    R: { name: '快速', color: '#ffa630', len: 150 },
    E: { name: '特急', color: '#ff5470', len: 120 },
    X: { name: '観光特急', color: '#b892ff', len: 80 },
  };

  /* 線路の通り道（左から右＝下り、右から左＝上り） */
  const PATHS = {
    W1: [[0, 150], [240, 150], [300, 100], [635, 100]],
    W2: [[0, 150], [635, 150]],
    '1E': [[635, 100], [700, 100], [760, 150], [1000, 150]],
    '1B': [[635, 100], [700, 100], [780, 55], [1000, 55]],
    '2E': [[635, 150], [1000, 150]],
    E3: [[1000, 230], [405, 230]],
    E4: [[1000, 230], [760, 230], [700, 280], [405, 280]],
    B3: [[1000, 55], [930, 55], [850, 230], [405, 230]],
    B4: [[1000, 55], [930, 55], [850, 230], [760, 230], [700, 280], [405, 280]],
    '3W': [[405, 230], [0, 230]],
    '4W': [[405, 280], [300, 280], [250, 230], [0, 230]],
  };
  /* 進路を返す（解く）位置：列車の最後尾が、最後の分かれ道を通りすぎた所 */
  const REL = {
    W1: [320, 100], W2: [260, 150], E3: [740, 230], E4: [680, 280], B3: [740, 230], B4: [680, 280],
    '1E': [900, 150], '1B': [950, 55], '2E': [900, 150], '3W': [230, 230], '4W': [230, 230],
  };

  /* 信号機。dir：E＝下り（右へ）向け、W＝上り（左へ）向け */
  const SIG = {
    DBi: { kind: 'block', short: '閉塞', name: '下りの閉塞信号機（緑ヶ丘側）', pt: [45, 150], dir: 'E', next: 'DH' },
    DH: { kind: 'home', short: '場内', name: '下りの場内信号機', pt: [125, 150], dir: 'E' },
    DS1: { kind: 'start', short: '出発', name: '1番線の出発信号機（下り）', pt: [652, 100], dir: 'E', track: 1 },
    DS2: { kind: 'start', short: '出発', name: '2番線の出発信号機（下り）', pt: [652, 150], dir: 'E', track: 2 },
    DBo: { kind: 'blockOut', short: '閉塞', name: '下りの閉塞信号機（新田側）', pt: [965, 150], dir: 'E' },
    UBi: { kind: 'block', short: '閉塞', name: '上りの閉塞信号機（新田側）', pt: [990, 230], dir: 'W', next: 'UH' },
    UH: { kind: 'home', short: '場内', name: '上りの場内信号機', pt: [950, 230], dir: 'W' },
    BH: { kind: 'home', short: '場内', name: '温泉支線の場内信号機', pt: [975, 55], dir: 'W' },
    US3: { kind: 'start', short: '出発', name: '3番線の出発信号機（上り）', pt: [388, 230], dir: 'W', track: 3 },
    US4: { kind: 'start', short: '出発', name: '4番線の出発信号機（上り）', pt: [388, 280], dir: 'W', track: 4 },
    UBo: { kind: 'blockOut', short: '閉塞', name: '上りの閉塞信号機（緑ヶ丘側）', pt: [40, 230], dir: 'W' },
  };
  const HOME_OF = { W: 'DH', E: 'UH', B: 'BH' };
  const START_OF = { '1E': 'DS1', '1B': 'DS1', '2E': 'DS2', '3W': 'US3', '4W': 'US4' };
  const OUTER_IN = { W: 'DBi', E: 'UBi' }, OUTER_OUT = { E: 'DBo', W: 'UBo' };

  /* 30分の並び。ent＝どこから来るか（W 中央方面 / E 港方面 / B 温泉支線）、ex＝どこへ出るか */
  const PAT = [
    { k: 'D1', type: 'L', dest: '港', ent: 'W', tr: 1, ex: 'E', arr: 1.0, dep: 6.5, wait: '特急の追い越し待ち', note: '1番線で特急に追い越してもらいます。同じホームの2番線に来る特急へ乗り換えできます。' },
    { k: 'D2', type: 'E', dest: '港', ent: 'W', tr: 2, ex: 'E', arr: 4.0, dep: 5.0, note: '1番線で待っている普通を追い越します。' },
    { k: 'D3', type: 'R', dest: '港', ent: 'W', tr: 2, ex: 'E', arr: 10.5, dep: 11.0 },
    { k: 'D4', type: 'X', dest: '温泉', ent: 'W', tr: 1, ex: 'B', arr: 18.5, dep: 20.5, wait: '港行 普通からの乗り換え待ち', note: '2番線に来る普通（港行）からの乗り換えを待ってから、単線の温泉支線へ入ります。' },
    { k: 'D5', type: 'L', dest: '港', ent: 'W', tr: 2, ex: 'E', arr: 19.8, dep: 20.3, note: '同じホームの1番線にいる観光特急（温泉行）へ乗り換えできます。' },
    { k: 'D6', type: 'R', dest: '港', ent: 'W', tr: 2, ex: 'E', arr: 25.0, dep: 25.5 },
    { k: 'U1', type: 'L', dest: '中央', ent: 'E', tr: 4, ex: 'W', arr: 3.0, dep: 8.0, wait: '特急の追い越し待ち', note: '4番線で特急に追い越してもらいます。同じホームの3番線に来る特急へ乗り換えできます。' },
    { k: 'U2', type: 'E', dest: '中央', ent: 'E', tr: 3, ex: 'W', arr: 5.5, dep: 6.5, note: '4番線で待っている普通を追い越します。' },
    { k: 'UB', type: 'X', dest: '中央', from: '温泉', ent: 'B', tr: 3, ex: 'W', arr: 14.0, dep: 16.0, wait: '港から来る快速からの乗り換え待ち', note: '温泉支線（森下）から来た列車です。下りの線路を平面交差で横切り、⑦の合流点で上りの線路に入って3番線に着きます。横切るあいだ、下りの出発信号は赤のままです。向かいの4番線に来る快速（港から）からの乗り換えを待って発車します。' },
    { k: 'U3', type: 'R', dest: '中央', ent: 'E', tr: 4, ex: 'W', arr: 14.0, dep: 17.3, wait: '観光特急の発車待ち', note: '港から来た快速です。森下から来た観光特急が先に⑦の合流点を通るので、上りの場内信号の手前で止まって待ちます。観光特急が⑦を通りすぎてから、4番線へ入ります。3番線の観光特急へ乗り換えでき、観光特急が先に出たあとに発車します。' },
    { k: 'U4', type: 'L', dest: '中央', ent: 'E', tr: 3, ex: 'W', arr: 24.0, dep: 24.5 },
  ];

  /* ---- 線の計算 ---- */
  const seglen = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
  const plen = p => { let s = 0; for (let i = 1; i < p.length; i++) s += seglen(p[i - 1], p[i]); return s; };
  function sAt(p, pt) {
    let s = 0;
    for (let i = 1; i < p.length; i++) {
      const a = p[i - 1], b = p[i], L = seglen(a, b);
      const f = ((pt[0] - a[0]) * (b[0] - a[0]) + (pt[1] - a[1]) * (b[1] - a[1])) / (L * L);
      if (f >= -1e-6 && f <= 1 + 1e-6 && Math.hypot(a[0] + f * (b[0] - a[0]) - pt[0], a[1] + f * (b[1] - a[1]) - pt[1]) < 1.5) return s + f * L;
      s += L;
    }
    return null;
  }
  function sub(p, s0, s1) {
    const out = []; if (s1 <= s0) return out; let s = 0;
    for (let i = 1; i < p.length; i++) {
      const a = p[i - 1], b = p[i], L = seglen(a, b), e = s + L;
      if (e >= s0 && s <= s1) {
        const f0 = Math.max(0, (s0 - s) / L), f1 = Math.min(1, (s1 - s) / L);
        if (!out.length) out.push([a[0] + (b[0] - a[0]) * f0, a[1] + (b[1] - a[1]) * f0]);
        out.push([a[0] + (b[0] - a[0]) * f1, a[1] + (b[1] - a[1]) * f1]);
      }
      s = e;
    }
    return out;
  }
  const ptAt = (p, s) => { const q = sub(p, Math.max(0, s - 0.01), s); return q.length ? q[q.length - 1] : p[0]; };

  /* ---- 列車を作る ---- */
  const NC = 40; // 7:00 から 20 時間ぶん
  const trains = [];
  for (let c = -1; c < NC; c++) {
    let nd = 0, nu = 0;
    PAT.forEach(p => {
      const off = c * CYCLE, ty = TYPES[p.type], down = p.ent === 'W';
      const ak = p.ent + p.tr, dk = p.tr + p.ex;
      const ap = PATHS[ak], dp = PATHS[dk], sStop = plen(ap), Ld = plen(dp), L = ty.len;
      const no = down ? 101 + c * 40 + 2 * nd++ : 102 + c * 40 + 2 * nu++;
      const t = { ...p, id: p.k + '_' + c, c, no, ty, down, ak, dk, ap, dp, sStop, Ld, L, arr: p.arr + off, dep: p.dep + off };
      t.t0 = t.arr - TA; t.t1 = t.dep + TB;
      t.wa = null; // 場内信号の手前で止まって待つとき { hs：止まる位置, tw0：止まった時刻, tw1：動き出す時刻 }
      t.posA = now => {
        if (now <= t.t0) return 0; if (now >= t.arr) return sStop;
        const w = t.wa;
        if (!w) { const u = (now - t.t0) / TA; return sStop * (2 * u - u * u); }
        if (now <= w.tw0) { const u = (now - t.t0) / (w.tw0 - t.t0); return w.hs * (2 * u - u * u); }
        if (now <= w.tw1) return w.hs;
        const u = (now - w.tw1) / (t.arr - w.tw1); return w.hs + (sStop - w.hs) * (3 * u * u - 2 * u * u * u);
      };
      t.headA = d => { if (d <= 0) return t.t0; let a = t.t0, b = t.arr; for (let i = 0; i < 40; i++) { const m = (a + b) / 2; if (t.posA(m) >= d - 1e-9) b = m; else a = m; } return b; };
      t.headD = d => t.dep + TB * Math.sqrt(Math.max(0, d) / (Ld + L));
      t.tailA = d => d + L <= sStop ? t.headA(d + L) : t.headD(d + L - sStop);
      t.tailD = d => t.headD(d + L);
      t.label = `${ty.name} ${no > 0 ? no : no + 2000}`;
      t.name = `${t.label} ${p.dest}行`;
      const hs = HOME_OF[p.ent], dh = sAt(ap, SIG[hs].pt), relA = sAt(ap, REL[ak]);
      t.ra = { sig: hs, s0: dh, s1: relA, key: ak, set: t.headA(dh) - 1.0, pass: t.headA(dh), rel: t.tailA(relA), tr: t, ph: 'a' };
      const ss = START_OF[dk], dd = sAt(dp, SIG[ss].pt), relD = sAt(dp, REL[dk]);
      t.rd = { sig: ss, s0: 0, s1: relD, key: dk, dd, set: t.dep - RD_LEAD, pass: t.headD(dd), rel: t.tailD(relD), tr: t, ph: 'd' };
      if (OUTER_IN[p.ent]) { const d = sAt(ap, SIG[OUTER_IN[p.ent]].pt); t.oin = { sig: OUTER_IN[p.ent], d, head: t.headA(d), tail: t.tailA(d) }; }
      if (OUTER_OUT[p.ex]) { const d = sAt(dp, SIG[OUTER_OUT[p.ex]].pt); t.oout = { sig: OUTER_OUT[p.ex], d, head: t.headD(d), tail: t.tailD(d) }; }
      if (p.ex === 'B') t.br = [t.dep, t.dep + BRANCH_RUN];
      if (p.ent === 'B') t.br = [t.arr - TA - BRANCH_RUN + 0.5, t.tailA(sAt(ap, SIG.BH.pt))];
      t.ra.plan = t.ra.set; t.rd.plan = t.rd.set;
      trains.push(t);
    });
  }
  trains.sort((a, b) => a.arr - b.arr);

  /* ---- ある時刻の列車の形 ---- */
  function body(t, now) {
    if (now < t.t0 || now > t.t1) return null;
    let parts = [], head, phase;
    if (now <= t.arr) {
      const s = t.posA(now);
      parts.push(sub(t.ap, Math.max(0, s - t.L), s)); head = ptAt(t.ap, s); phase = 'in';
    } else if (now <= t.dep) {
      parts.push(sub(t.ap, t.sStop - t.L, t.sStop)); head = ptAt(t.ap, t.sStop); phase = 'stop';
    } else {
      const u = (now - t.dep) / TB, s = (t.Ld + t.L) * u * u, h = Math.min(s, t.Ld), tl = s - t.L;
      if (h > Math.max(0, tl)) parts.push(sub(t.dp, Math.max(0, tl), h));
      if (tl < 0) parts.push(sub(t.ap, t.sStop + tl, t.sStop));
      head = ptAt(t.dp, h); phase = 'out';
    }
    return { parts: parts.filter(q => q.length > 1), head, phase };
  }
  /* いま白く光らせる進路（列車の前の部分だけ） */
  function routeLines(now) {
    const out = [];
    for (const t of trains) {
      if (t.ra.set <= now && now < t.arr) {
        const h = t.posA(now);
        out.push({ p: sub(t.ap, Math.max(t.ra.s0, h), t.sStop), prep: now < t.ra.open });
      }
      if (t.rd.set <= now && now < t.rd.rel) {
        const u = Math.max(0, (now - t.dep) / TB), h = now < t.dep ? 0 : (t.Ld + t.L) * u * u;
        out.push({ p: sub(t.dp, h, t.rd.s1 + 20), prep: now < t.rd.open });
      }
    }
    return out.filter(q => q.p.length > 1);
  }

  /* ---- 信号の色と、その理由 ---- */
  const nearT = (now, list) => list.find(Boolean);
  function aspect(id, now) {
    const s = SIG[id];
    if (s.kind === 'home' || s.kind === 'start') {
      const key = s.kind === 'home' ? 'ra' : 'rd';
      const t = trains.find(t => t[key].sig === id && t[key].open <= now && now < t[key].pass);
      if (!t) return { a: 'R', t: null };
      if (s.kind === 'home') return { a: 'Y', t };
      if (t.ex === 'B') return { a: 'G', t, ind: '温' };
      const nx = aspect(OUTER_OUT[t.ex], now).a;
      return { a: nx === 'R' ? 'Y' : 'G', t, ind: id === 'DS1' ? '港' : null };
    }
    if (s.kind === 'block') {
      const t = trains.find(t => t.oin && t.oin.sig === id && t.oin.head <= now && now < t.ra.pass + (t.tailA(t.ra.s0) - t.ra.pass));
      if (t) return { a: 'R', t };
      const nx = aspect(s.next, now).a;
      return { a: nx === 'R' ? 'Y' : 'G', t: null, nx };
    }
    // blockOut：駅の外へ出ていった列車がどこまで行ったか
    let last = null;
    for (const t of trains) if (t.oout && t.oout.sig === id && t.oout.head <= now) { if (!last || t.oout.head > last.oout.head) last = t; }
    if (!last) return { a: 'G', t: null };
    if (now < last.oout.tail) return { a: 'R', t: last, why: 'pass' };
    const dt = now - last.oout.tail;
    if (dt < OUT_R) return { a: 'R', t: last, why: 'r', left: OUT_R - dt };
    if (dt < OUT_Y) return { a: 'Y', t: last, why: 'y', left: OUT_Y - dt };
    return { a: 'G', t: last, why: 'g' };
  }
  function branchUse(now) { return trains.find(t => t.br && t.br[0] <= now && now < t.br[1]) || null; }

  /* ---- 確認（ぶつかる進路や、同じ番線に2本が重ならないか） ---- */
  function samples(p, s0, s1) { const o = []; for (let s = s0; s <= s1; s += 4) o.push(ptAt(p, s)); return o; }
  const conflictCache = {};
  function conflict(r1, t1, r2, t2) {
    const k = r1.key + '|' + r2.key;
    if (!(k in conflictCache)) {
      const A = samples(PATHS[r1.key], r1.s0, r1.s1), B = samples(PATHS[r2.key], r2.s0, r2.s1);
      conflictCache[k] = A.some(a => B.some(b => Math.hypot(a[0] - b[0], a[1] - b[1]) < 3));
    }
    return conflictCache[k];
  }
  /* 区分解錠：q の列車の最後尾が、r と交わる所のいちばん先を通りすぎた時刻 */
  const tailAt = (q, d) => q.ph === 'a' ? q.tr.tailA(d) : q.tr.tailD(d);
  const lastCache = {};
  function secRel(q, r) {
    const k = q.key + '>' + r.key;
    if (!(k in lastCache)) {
      const P = PATHS[q.key], B = samples(PATHS[r.key], r.s0, r.s1); let m = null;
      for (let d = q.s0; d <= q.s1; d += 2) { const a = ptAt(P, d); if (B.some(b => Math.hypot(a[0] - b[0], a[1] - b[1]) < 3)) m = d; }
      lastCache[k] = m;
    }
    return lastCache[k] === null ? -Infinity : tailAt(q, lastCache[k] + 8);
  }
  function check() {
    const probs = [];
    const R = []; trains.forEach(t => { R.push([t.ra, t]); R.push([t.rd, t]); });
    for (let i = 0; i < R.length; i++) for (let j = i + 1; j < R.length; j++) {
      const [a, ta] = R[i], [b, tb] = R[j]; if (ta === tb) continue;
      if (conflict(a, ta, b, tb) && a.set < secRel(b, a) && b.set < secRel(a, b)) probs.push(`進路が重なる ${ta.id}(${a.key}) ${tb.id}(${b.key}) ${a.set.toFixed(2)}-${a.rel.toFixed(2)} / ${b.set.toFixed(2)}-${b.rel.toFixed(2)}`);
    }
    for (let i = 0; i < trains.length; i++) for (let j = 0; j < trains.length; j++) {
      const a = trains[i], b = trains[j]; if (a === b || a.tr !== b.tr) continue;
      if (a.ra.set > b.arr - 0.01 && a.ra.set < b.rd.rel) probs.push(`番線に先客 ${a.id}→${a.tr}番線 ${a.ra.set.toFixed(2)} に ${b.id}`);
    }
    trains.forEach(t => [t.ra, t.rd].forEach(r => routeSw(r).forEach(({ id }) => { const st = swState(id, r.open - 1e-4); if (!st.lock || st.r !== r) probs.push(`鎖錠の前に信号 ${t.id} ${r.key} ${SW[id].no} ${st.phase}`); })));
    const oo = trains.filter(t => t.oout).sort((a, b) => a.oout.head - b.oout.head);
    for (let i = 1; i < oo.length; i++) { const t = oo[i], o = oo.slice(0, i).reverse().find(x => x.oout.sig === t.oout.sig); if (o && t.oout.head < o.oout.tail + OUT_R) probs.push(`赤の閉塞へ ${o.id}→${t.id}`); }
    const br = trains.filter(t => t.br);
    for (let i = 0; i < br.length; i++) for (let j = i + 1; j < br.length; j++) { const a = br[i], b = br[j]; if (a.br[0] < b.br[1] && b.br[0] < a.br[1]) probs.push(`単線で重なる ${a.id} ${b.id}`); }
    ['DH', 'UH', 'BH'].forEach(h => { trains.filter(t => t.ra.sig === h).forEach(t => { const pr = trains.find(o => o !== t && o.ra.sig === h && o.ra.pass < t.ra.pass && t.oin && t.oin.head < o.tailA(o.ra.s0)); if (pr) probs.push(`近すぎる ${pr.id}→${t.id}`); }); });
    return probs;
  }



  /* ---- 合流の順番 ----
     交わる進路は、先に進路を頼んだ列車から通す。後の列車は出発信号が赤のまま待つ。
     駅の外の区間も、前の列車が1つ先の区間を出るまで、出発信号を開けない */
  (function hold() {
    const pending = []; trains.forEach(t => { pending.push([t.ra, t]); pending.push([t.rd, t]); });
    const done = [];
    const blockers = (r, t, need) => { let by = null;
      for (const [q, o] of done) if (o !== t && conflict(r, t, q, o)) { const rl = secRel(q, r); if (rl > need + 1e-6) { need = rl; by = o; } }
      return [need, by]; };
    while (pending.length) {
      let bi = 0; for (let i = 1; i < pending.length; i++) if (pending[i][0].set < pending[bi][0].set) bi = i;
      const [r, t] = pending.splice(bi, 1)[0];
      if (r === t.ra) {
        let [need, by] = blockers(r, t, r.set);
        if (need > r.set + 0.01) {
          if (need <= r.pass - 0.25 - T_OPEN) r.set = need;          // 少しおそく開くだけ
          else {                                              // 場内信号の手前で止まって待つ
            const hs = r.s0 - 14, tw0 = t.t0 + TA * hs / t.sStop, tw1 = Math.max(need + T_OPEN + 0.15, tw0 + 0.2);
            const old = t.arr; t.wa = { hs, tw0, tw1 }; t.arr = tw1 + 0.5 + (t.sStop - hs) / 600;
            r.set = need; r.pass = t.headA(r.s0); r.rel = t.tailA(r.s1);
            if (t.oin) { t.oin.head = t.headA(t.oin.d); t.oin.tail = t.tailA(t.oin.d); }
            if (t.dep < t.arr + 0.5) { t.dep = t.arr + 0.5; t.rd.set = t.dep - RD_LEAD; }
            t.heldIn = { by, min: t.arr - old, at: tw0, go: tw1 };
          }
        }
      } else {
        const plan = r.set; let need = plan, by = null, why = null, moved = true;
        while (moved) {
          moved = false;
          const [n2, b2] = blockers(r, t, need); if (n2 > need + 1e-6) { need = n2; by = b2; why = 'route'; moved = true; }
          if (t.oout) for (const [q, o] of done) if (q === o.rd && o.oout && o.oout.sig === t.oout.sig && o.oout.head < need + 3) {
            const ok = o.oout.tail + OUT_R - (t.headD(t.oout.d) - t.dep) - RD_LEAD + 0.15;
            if (ok > need + 1e-6) { need = ok; if (!by) { by = o; why = 'block'; } moved = true; }
          }
        }
        const d = need - plan;
        if (d > 0.01) { t.dep += d; r.set = need; if (d > 0.15) t.held = { by, why, min: d, plan: t.dep - d }; }
        t.t1 = t.dep + TB; r.pass = t.headD(r.dd); r.rel = t.tailD(r.s1);
        if (t.oout) { t.oout.head = t.headD(t.oout.d); t.oout.tail = t.tailD(t.oout.d); }
        if (t.ex === 'B') t.br = [t.dep, t.dep + BRANCH_RUN];
      }
      done.push([r, t]);
    }
    trains.forEach(t => { t.ra.open = t.ra.set + T_OPEN; t.rd.open = t.rd.set + T_OPEN; });
  })();
  /* ---- ポイント（分かれ道）----
     legs：N＝定位（まっすぐ）、R＝反位（ななめ）。向きは分かれ道から見た先の点
     use：その進路がこのポイントをどちらで通るか */
  const SW = {
    P1: { no: '①', pt: [240, 150], legs: { N: [300, 150], R: [300, 100] }, use: { W1: 'R', W2: 'N' }, txt: { N: '2番線へまっすぐ', R: '1番線へ（ななめ）' } },
    P4: { no: '②', pt: [250, 230], legs: { N: [300, 230], R: [300, 280] }, use: { '4W': 'R', '3W': 'N' }, txt: { N: '3番線からまっすぐ', R: '4番線から（ななめ）' } },
    P5: { no: '③', pt: [700, 100], legs: { N: [760, 150], R: [780, 55] }, use: { '1E': 'N', '1B': 'R' }, txt: { N: '1番線から本線（港方面）へ', R: '1番線から温泉支線へ' } },
    P6: { no: '④', pt: [760, 150], legs: { N: [700, 150], R: [700, 100] }, use: { '2E': 'N', '1E': 'R' }, txt: { N: '2番線からまっすぐ', R: '1番線から（ななめ）' } },
    P7: { no: '⑤', pt: [760, 230], legs: { N: [700, 230], R: [700, 280] }, use: { E3: 'N', E4: 'R', B3: 'N', B4: 'R' }, txt: { N: '3番線へまっすぐ', R: '4番線へ（ななめ）' } },
    P8: { no: '⑥', pt: [930, 55], legs: { N: [870, 55], R: [850, 230] }, use: { '1B': 'N', B3: 'R', B4: 'R' }, txt: { N: '温泉支線と1番線をつなぐ', R: '温泉支線から上りの線路へ（ななめ）' } },
    P9: { no: '⑦', pt: [850, 230], legs: { N: [910, 230], R: [930, 55] }, use: { E3: 'N', E4: 'N', B3: 'R', B4: 'R' }, txt: { N: '港方面からまっすぐ', R: '温泉支線から合流（ななめ）' } },
  };

  /* いまの向き：進路が作られてから、列車の最後尾がこのポイントを通りすぎるまで鎖錠。
     鎖錠がとけたら定位（まっすぐ）にもどす */
  const swRelCache = new Map();
  function swRel(id, r) {
    const k = id + r.key + r.ph; let d = swRelCache.get(k);
    if (d === undefined) { d = sAt(PATHS[r.key], SW[id].pt); swRelCache.set(k, d); }
    return tailAt(r, d + 8);
  }
  function swState(id, now) {
    const sw = SW[id]; let cur = null, last = null;
    for (const t of trains) { if (t.t1 < now - 3 || t.t0 > now + 5) continue;
      for (const r of [t.ra, t.rd]) {
        const pos = sw.use[r.key]; if (!pos || r.set > now) continue;
        const rel = swRel(id, r);
        if (now < rel) { if (!cur || r.set > cur.r.set) cur = { r, t, pos, rel }; }
        else if (!last || rel > last.rel) last = { r, t, pos, rel };
      } }
    if (cur) {
      const dt = now - cur.r.set;
      const phase = cur.pos === 'R' && dt < T_MOVE ? 'move' : dt < T_MOVE + T_CHECK ? 'check' : 'lock';
      return { pos: cur.pos, phase, lock: phase === 'lock', t: cur.t, r: cur.r, rel: cur.rel };
    }
    const back = last && last.pos === 'R' ? last.rel : null;
    if (back !== null && now < back + T_MOVE) return { pos: 'N', phase: 'back', lock: false, t: last.t, back };
    return { pos: 'N', phase: 'free', lock: false, t: last ? last.t : null, back };
  }

  /* ---- 出来事の一覧 ---- */
  /* 交わる進路を使っていた列車が通りすぎた直後なら、そのことを書く */
  function after(r, t) {
    for (const o of trains) for (const q of [o.ra, o.rd]) if (o !== t && conflict(r, t, q, o) && secRel(q, r) <= r.set + 1e-6 && secRel(q, r) > r.set - 0.7) return `。${o.name} が分かれ道を通りすぎるのを待っていました`;
    return '';
  }
  const routeSw = r => Object.keys(SW).filter(id => SW[id].use[r.key] && sAt(PATHS[r.key], SW[id].pt) >= r.s0 - 1).map(id => ({ id, pos: SW[id].use[r.key] }));
  const swList = r => routeSw(r).filter(x => x.pos === 'R').map(x => SW[x.id].no).join('');
  const events = [];
  for (const t of trains) {
    if (swList(t.ra)) events.push({ t: t.ra.set, k: 'sw', tr: t, txt: `${t.name} の進路を作りはじめました。ポイント${swList(t.ra)}を切りかえ中${after(t.ra, t)}` });
    events.push({ t: t.ra.open, k: 'route', tr: t, txt: `${SIG[t.ra.sig].name}：${t.name} を ${t.tr}番線へ入れる進路ができ、黄になりました${swList(t.ra) ? '' : after(t.ra, t)}` });
    events.push({ t: t.arr, k: 'arr', tr: t, txt: `${t.name} が ${t.tr}番線に着きました${t.wait ? '（' + t.wait + '）' : ''}` });
    if (t.heldIn) { events.push({ t: t.ra.plan, k: 'hold', tr: t, txt: t.heldIn.by.down ? `${t.name} は、下りの ${t.heldIn.by.name} が平面交差を通りすぎるまで、${SIG[t.ra.sig].name}の手前で止まって待ちます` : `${t.name} は、${t.heldIn.by.name} が先に⑦の合流点を通るので、${SIG[t.ra.sig].name}の手前で止まって待ちます` }); }
    if (t.held) events.push({ t: t.held.plan - RD_LEAD, k: 'hold', tr: t, txt: t.held.why === 'route' ? `${t.name} は、${t.held.by.name} の進路と交わるので、${t.tr}番線で待ちます（出発信号は赤のまま。予定より約${Math.round(t.held.min * 60)}秒おくれ）` : `${t.name} は、前を走る ${t.held.by.name} がまだ1つ先の区間にいるので、${t.tr}番線で待ちます` });
    if (swList(t.rd)) events.push({ t: t.rd.set, k: 'sw', tr: t, txt: `${t.name} の出発の進路を作りはじめました。ポイント${swList(t.rd)}を切りかえ中${after(t.rd, t)}` });
    events.push({ t: t.rd.open, k: 'route', tr: t, txt: `${t.tr}番線の出発信号が開きました（${t.name}）${swList(t.rd) ? '' : after(t.rd, t)}` });
    events.push({ t: t.dep, k: 'dep', tr: t, txt: `${t.name} が ${t.tr}番線を出ました` });
    if (t.ex === 'B') events.push({ t: t.dep + 0.6, k: 'branch', tr: t, txt: `${t.name} が単線区間（川辺〜森下）に入りました。森下に着くまで、反対からの列車は入れません` });
  }
  events.sort((a, b) => a.t - b.t);

  const clock = m => { const x = ((BASE + m) % 1440 + 1440) % 1440, s = Math.round(x * 60); return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
  const hm = m => clock(m).slice(0, 5);

  return { CYCLE, TYPES, PATHS, SIG, SW, swState, routeSw, T_MOVE, T_CHECK, T_OPEN, RD_LEAD, PAT, trains, events, body, routeLines, aspect, branchUse, check, clock, hm, sub, BRANCH_RUN, OUT_R, OUT_Y };
})();
if (typeof module !== 'undefined') module.exports = KW;
