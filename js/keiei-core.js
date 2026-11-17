/* 鉄道の経営の計算（DOM なし・node で読める）。設定は data/keiei.json、画面は js/keiei-view.js。
   - 毎日：利益（本体の summarize の profit）・乗客・満足度を記録し、利益のうち「投資に回す割合」を積み立てる。
   - 投資：保守の予算（指令パネルの「できごと」の起こりやすさ）・駅の改良・駅ビルとモール・駅前の住宅・バスの乗りつぎ・観光の宣伝。
     効き目は工事の日数のあと、少しずつ（ramp 日）0→1 になり、乗客の計算（index.html の rateParts）に倍率として入る（橋 keiei-to-rail）。
   - 数字はすべて仮（src: assume）。 */
(function (root) {
  'use strict';
  const P_WORK = 0, P_BIZ = 1, P_TOUR = 2, P_SHOP = 3;

  function create(cfg, day) {
    return { v: 1, share: cfg.share.def, bal: cfg.start.bal, maint: cfg.maint.def, log: [], owned: [], seq: 1, firstDay: day || 1 };
  }
  function normalize(st, cfg, day) {
    if (!st || st.v !== 1) return create(cfg, day);
    st.log = Array.isArray(st.log) ? st.log : []; st.owned = Array.isArray(st.owned) ? st.owned : [];
    if (!(st.share >= cfg.share.min && st.share <= cfg.share.max)) st.share = cfg.share.def;
    if (!cfg.maint.levels[st.maint]) st.maint = cfg.maint.def;
    if (typeof st.bal !== 'number' || !isFinite(st.bal)) st.bal = cfg.start.bal;
    return st;
  }
  const item = (cfg, id) => cfg.invest.find(x => x.id === id);
  /* 投資の進み具合：工事中は0、そのあと ramp 日で 1 へ */
  function progress(cfg, o, day) {
    const it = item(cfg, o.id); if (!it) return 0;
    const t = day - o.day - it.build; if (t < 0) return 0;
    return it.ramp ? Math.min(1, (t + 1) / it.ramp) : 1;
  }
  function status(cfg, o, day) {
    const it = item(cfg, o.id), t = day - o.day;
    if (t < it.build) return { kind: 'build', left: it.build - t, e: 0 };
    const e = progress(cfg, o, day); return { kind: e < 1 ? 'ramp' : 'done', e };
  }

  /* 乗客の計算に掛ける倍率（駅×目的）。origin＝その駅から乗る、dest＝その駅で降りる */
  function fx(cfg, st, day, strength) {
    const k = strength == null ? 1 : strength;
    const O = {}, Dd = {}, out = { O, D: Dd, any: false };
    const add = (T, s, p, v) => { if (!v) return; const a = T[s] || (T[s] = [0, 0, 0, 0]); a[p] += v; out.any = true; };
    for (const o of st.owned) {
      const it = item(cfg, o.id); if (!it) continue;
      const e = progress(cfg, o, day) * k; if (!e) continue;
      const f = it.fx || {}, s = o.st, dm = f.demand || {};
      if (dm.all) for (let p = 0; p < 4; p++) { add(O, s, p, dm.all * e); add(Dd, s, p, dm.all * e); }
      if (dm.toShop) { add(Dd, s, P_SHOP, dm.toShop * e); add(O, s, P_SHOP, dm.toShop * e * 0.8); }
      if (dm.toTour) { add(Dd, s, P_TOUR, dm.toTour * e); add(O, s, P_TOUR, dm.toTour * e * 0.8); }
      if (f.pop) { for (const p of [P_WORK, P_SHOP]) { add(O, s, p, f.pop * e); add(Dd, s, p, f.pop * e * 0.9); } add(O, s, P_BIZ, f.pop * e * 0.5); }
    }
    return out;
  }
  /* rateParts の o（目的ごとの人数）に掛ける */
  function apply(F, o, s, d) {
    if (!F || !F.any) return o;
    const a = F.O[s], b = F.D[d];
    if (a) for (let p = 0; p < 4; p++) o[p] *= 1 + a[p];
    if (b) for (let p = 0; p < 4; p++) o[p] *= 1 + b[p];
    return o;
  }
  /* 保守の予算で変わる、指令パネルの「できごと」の起こりやすさ */
  const incidentK = (cfg, st) => (cfg.maint.levels[st.maint] || cfg.maint.levels[cfg.maint.def]).incident;

  /* 満足度（0〜100）。m は1日の数字：{riders, aband, left, crowdShare, lateShare, conv, boardBy:{駅:乗車}} */
  function satisfaction(cfg, st, m, day) {
    const W = cfg.sat, parts = [];
    const tot = (m.riders || 0) + (m.aband || 0);
    const add = (key, name, v) => { parts.push({ key, name, v: +v.toFixed(2) }); };
    add('crowd', '混雑（150%をこえる列車）', -W.crowd * (m.crowdShare || 0));
    add('aband', '待ちきれず帰った人', -W.aband * (tot ? (m.aband || 0) / tot : 0));
    add('left', '積み残し', -W.left * (m.riders ? (m.left || 0) / m.riders : 0));
    if (m.lateShare != null) add('late', '遅れ', -W.late * m.lateShare);
    add('conv', '便利さ', W.conv * ((m.conv || 1) - 1));
    const mt = cfg.maint.levels[st.maint]; if (mt && mt.sat) add('maint', '保守（' + mt.name + '）', mt.sat);
    const by = m.boardBy || {}, sum = Object.values(by).reduce((a, b) => a + b, 0) || 1;
    let inv = 0;
    for (const o of st.owned) { const it = item(cfg, o.id); if (!it || !it.fx || !it.fx.satByRiders) continue; inv += it.fx.satByRiders * progress(cfg, o, day) * Math.min(1, 3 * (by[o.st] || 0) / sum); }
    if (inv) add('invest', '駅の改良・乗りつぎ', inv);
    const score = Math.max(0, Math.min(100, W.base + parts.reduce((a, p) => a + p.v, 0)));
    return { score: +score.toFixed(1), parts };
  }

  /* 1日を締める：記録して、積み立てをふやし、保守の予算と事業の収入を出し入れする */
  function closeDay(cfg, st, m, day) {
    const mt = cfg.maint.levels[st.maint] || cfg.maint.levels[cfg.maint.def];
    let income = 0;
    for (const o of st.owned) { const it = item(cfg, o.id); if (it && it.income) income += it.income * progress(cfg, o, day); }
    const div = Math.max(0, m.div || 0); income += div;   /* 子会社からの配当（橋 group-to-keiei） */
    const fee = Math.max(0, m.fee || 0); income += fee;   /* 線路使用料（指令パネルの臨時・貨物。橋 ctc-fee-to-keiei） */
    const toInvest = Math.max(0, m.profit) * st.share;
    const sat = satisfaction(cfg, st, m, day);
    const spent = st.owned.filter(o => o.day === day).reduce((a, o) => a + o.cost, 0);
    st.bal += toInvest + income - mt.cost;
    if (st.bal < 0 && st.maint !== 'low') st.maint = 'low';   /* 積み立てが足りなくなったら、保守はけずる（画面で知らせる） */
    const rec = { day, riders: Math.round(m.riders), boardAlight: Math.round(m.riders * 2), rev: Math.round(m.rev), cost: Math.round(m.cost), profit: Math.round(m.profit),
      income: Math.round(income), fee: Math.round(fee), div: Math.round(div), maint: mt.cost, toInvest: Math.round(toInvest), spent, bal: Math.round(st.bal), sat: sat.score, satParts: sat.parts, lateShare: m.lateShare, maintLv: st.maint };
    st.log = st.log.filter(r => r.day !== day).concat(rec).slice(-cfg.keepDays);
    return rec;
  }

  function canBuy(cfg, st, id, s, day) {
    const it = item(cfg, id); if (!it) return { ok: false, why: 'ない投資' };
    if (!it.stations.includes(s)) return { ok: false, why: 'この駅には建てられません' };
    if (st.owned.some(o => o.id === id && o.st === s)) return { ok: false, why: 'もう建てています' };
    if (st.bal < it.cost) return { ok: false, why: '積み立てが足りません' };
    return { ok: true };
  }
  function buy(cfg, st, id, s, day) {
    const c = canBuy(cfg, st, id, s, day); if (!c.ok) return c;
    const it = item(cfg, id);
    st.bal -= it.cost; st.owned.push({ n: st.seq++, id, st: s, day, cost: it.cost });
    return { ok: true };
  }

  /* その日の数字を本体の結果から作る（index.html の D から。DOM なし） */
  function metrics(D, ST_KEYS, lateShare) {
    const S = D.summary; let ld = 0, lo = 0;
    for (const t of D.trips) for (let i = 0; i < t.seq.length - 1; i++) { const L = t.loadAfter[i] || 0; ld += L; if (t.cap && L / t.cap > 1.5) lo += L; }
    const boardBy = {}; for (const s of ST_KEYS) { const x = D.sim.stat[s]; boardBy[s] = x ? x.cb || 0 : 0; }
    return { riders: S.riders, aband: S.aband, left: S.left, rev: S.rev, cost: S.run + S.fixed, profit: S.profit, crowdShare: ld ? lo / ld : 0, conv: S.dm.act.reduce((a, b) => a + b, 0) / S.dm.pot.reduce((a, b) => a + b, 0), boardBy, lateShare };
  }

  /* 子会社からの配当：グループの記録（dia-group の days：{day, co}）のうち、まだ受け取っていない日（after より後・upto まで）の、
     子会社のもうけの合計（鉄道をのぞく）が黒字の分×割合。返すもの {yen, last, days:[{day, sub, yen}]} */
  function dividend(cfg, days, after, upto) {
    const rate = (cfg.dividend && cfg.dividend.rate) || 0, out = { yen: 0, last: after, days: [] };
    for (const d of days || []) {
      if (!d || !d.co || !(d.day > after) || d.day > upto) continue;
      let sub = 0; for (const k in d.co) if (k !== 'rail') sub += d.co[k].net || 0;
      const yen = Math.round(Math.max(0, sub) * rate);
      out.days.push({ day: d.day, sub: Math.round(sub), yen }); out.yen += yen; if (d.day > out.last) out.last = d.day;
    }
    return out;
  }
  const api = { create, dividend, normalize, progress, status, fx, apply, incidentK, satisfaction, closeDay, canBuy, buy, metrics, item };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.KeieiCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
