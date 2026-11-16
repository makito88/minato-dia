/* 使い方：index.html を開いたページで、このファイルを読みこむ（Playwright の add_script_tag など）→ STUDY.score(パターン) / STUDY.enforce(パターン)。本体のファイルは変えない。docs/track-dia-study.md の「普通の間隔」の試算に使った */
/* 番線とダイヤの検討の続き：普通の間隔を変えた場合（ページの中で動かす。本体のファイルは変えない） */
window.STUDY = (() => {
  const LIM = { C: 5, P: 4, O: 2, S: [1, 1], U: [2, 2], M: [2, 2], K: [2, 2], N: [1, 1], F: 3, T: 3 };   /* 森下・峠は、交換信号所で1本分を受けもつとみなして3（信号所そのものは本体の計算にない） */
  const TAIHI = ['U', 'M', 'K'], EXCH = ['F', 'T'];
  function build(pats, off) {
    const reg = {}, trips = [], outs = [];
    pats.forEach((p, pi) => { let k = 0; for (let t = p.from; t < p.to - 0.01 && outs.length < 1200; t += p.int, k++) { const key = pi + ':' + k; outs.push({ type: p.type, route: p.route, cars: p.cars, want: t + (off[key] || 0), key, pid: pi, leg: 'out', seq: ROUTES[p.route].seq }); } });
    for (const pr of [4, 3, 2, 1]) {
      const pend = outs.filter(x => TYPES[x.type].prio === pr).sort((a, b) => a.want - b.want);
      while (pend.length) {
        const t = pend.shift(); scheduleTrip(t, reg); trips.push(t);
        if (t.leg === 'out') { const key = t.key + ':r'; const r = { type: t.type, route: t.route, cars: t.cars, want: t.arr[t.arr.length - 1] + TYPES[t.type].turn + (off[key] || 0), key, pid: t.pid, leg: 'ret', seq: [...t.seq].reverse(), pair: t }; t.ret = r;
          let lo = 0, hi = pend.length; while (lo < hi) { const m = (lo + hi) >> 1; if (pend[m].want <= r.want) lo = m + 1; else hi = m; } pend.splice(lo, 0, r); }
      }
    }
    /* 編成 */
    const sets = [], pools = {};
    trips.filter(t => t.leg === 'out').sort((a, b) => a.dep[0] - b.dep[0]).forEach(o => {
      const key = ROUTES[o.route].origin + '|' + TYPES[o.type].cls + '|' + o.cars, pool = pools[key] || (pools[key] = []);
      let best = -1; for (let i = 0; i < pool.length; i++) if (pool[i].free + 6 <= o.dep[0] && (best < 0 || pool[i].free < pool[best].free)) best = i;
      let s; if (best >= 0) s = pool[best]; else { s = { free: 0, trips: [] }; sets.push(s); pool.push(s); }
      s.trips.push(o, o.ret); o.set = s; o.ret.set = s; s.free = o.ret.arr[o.ret.arr.length - 1];
    });
    return { trips, sets };
  }
  /* 番線の使い方：駅にいるあいだ（通過も1分）＋前後1分。終点は15分以内の折り返しならホームで待つ */
  function occupancy(B) {
    const ev = {};
    const add = (s, d, a, b, tr) => { (ev[s + d] || (ev[s + d] = [])).push([a - 0.5, b + 0.5, tr]); };
    for (const tr of B.trips) {
      const n = tr.seq.length;
      tr.seq.forEach((s, i) => {
        if (i === 0 || i === n - 1) return;
        const a = tr.arr[i], b = Math.max(tr.dep[i], a + (tr.stop[i] ? 0 : 0.5));
        add(s, LIM[s] && Array.isArray(LIM[s]) ? (tr.down ? 'd' : 'u') : '', a, b, tr);
      });
      const end = tr.seq[n - 1], k = tr.set.trips.indexOf(tr), nx = tr.set.trips[k + 1];
      const lay = nx ? nx.dep[0] - tr.arr[n - 1] : 99;
      add(end, '', tr.arr[n - 1], lay <= 15 ? nx.dep[0] : tr.arr[n - 1] + 1.5, tr);
      const pv = k > 0 ? tr.set.trips[k - 1] : null;
      if (!pv || tr.dep[0] - pv.arr[pv.arr.length - 1] > 15) add(tr.seq[0], '', tr.dep[0] - 3, tr.dep[0], tr);
    }
    const over = [];
    for (const key in ev) {
      const s = key[0], d = key[1], lim = d ? LIM[s][d === 'd' ? 0 : 1] : (Array.isArray(LIM[s]) ? LIM[s][0] + LIM[s][1] : LIM[s]);
      const pts = []; ev[key].forEach(([a, b, tr]) => { pts.push([a, 1, tr], [b, -1, tr]); });
      pts.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
      let c = 0, mx = 0, at = 0; const live = new Set();
      for (const [t, v, tr] of pts) { c += v; if (v > 0) live.add(tr); else live.delete(tr); if (c > lim && c > mx) { mx = c; at = t; over.push({ s, d, t, n: c, lim, trs: [...live] }); } }
    }
    return over;
  }
  function dwells(B) {
    const bad = [];
    for (const tr of B.trips) tr.seq.forEach((s, i) => {
      if (i === 0 || i === tr.seq.length - 1) return;
      const w = tr.dep[i] - tr.arr[i], lim = TAIHI.includes(s) ? 8 : EXCH.includes(s) ? 20 : 99;
      if (w > lim + 0.01) bad.push({ tr, s, w, lim });
    });
    return bad;
  }
  function score(pats, off) {
    const B = build(pats, off || {}), d = dwells(B), o = occupancy(B);
    return { B, d, o, trips: B.trips.length, sets: B.sets.length };
  }
  /* 条件を守るまで、問題の列車の始発を遅らせる（途中で長く待つかわりに、始発で待つ） */
  function enforce(pats, maxIt = 40) {
    const off = {};
    let r = score(pats, off), it = 0;
    for (; it < maxIt && (r.d.length || r.o.length); it++) {
      const touched = new Set();
      for (const b of r.d) { if (touched.has(b.tr.key)) continue; touched.add(b.tr.key); off[b.tr.key] = (off[b.tr.key] || 0) + Math.max(1, b.w - b.lim + 0.3); }
      for (const o of r.o) { const t = o.trs.filter(t => TYPES[t.type].prio === 1).sort((a, b) => b.want - a.want)[0] || o.trs[o.trs.length - 1]; if (!t || touched.has(t.key)) continue; touched.add(t.key); off[t.key] = (off[t.key] || 0) + 2; }
      r = score(pats, off);
    }
    const base = score(pats, {}), shift = [];
    const bk = new Map(base.B.trips.map(t => [t.key, t]));
    r.B.trips.forEach(t => { const b = bk.get(t.key); if (b) shift.push(t.dep[0] - b.dep[0]); });
    const big = shift.filter(x => x >= 5);
    return { ok: !r.d.length && !r.o.length, it, trips: r.trips, sets: r.sets, d: r.d.length, o: r.o.length, big: big.length, mean: shift.reduce((a, b) => a + b, 0) / (shift.length || 1), max: Math.max(0, ...shift), off, r };
  }
  return { build, score, enforce, dwells, occupancy, LIM };
})();
