/* 運行の記録（共通の計算）。docs/run-record-plan.md の手順1（2026-11-25）。DOM なし・node で読める。
   地図・指令パネル・乗車体験・収支・売店が同じ「本当」を読むための表を作る。本当にするのは絵ではなく、線路のキロ程と時刻。
   - 中身は指令パネル（js/ctc-view.js の ensureHl）と同じ順：臨時・貨物（synth）→ 見どころ（highlights）→ 大きな事故（bigIncident）→
     乱れ（disrupt）→ 番線の割りふり（yard）。計算は js/ctc-core.js をそのまま呼ぶ（中身は変えない）。
   - 運行日・ダイヤ・条件が同じなら、同じ結果（決まった乱数）。重いので、キーが変わったときだけ作り直す（js/run-record.js）。
   - 効き目（遅れ・運休）は保存しない。毎回この計算からもとめる（docs/START.md の橋の約束3）。
   - 段1〜3（予定 → 予定の乗客 → 乱れ）まで。段4〜7（対応・実際の乗客・お金・まわり）はまだ。
   入力 build(inp)：
     inp.D        { trips, sets }（index.html の D。予定の乗客 loadAfter・bAt が入っている）
     inp.ST, inp.TYPES, inp.DEPOTNAME
     inp.X        data/ctc-extra.json（なければ臨時・貨物・外との接続なし）
     inp.hs       data/ctc-haisen.json（なければ番線の割りふりなし。番線は前の決め方）
     inp.onSiding(tr,i)・inp.nomDwell(tr,i)（定期列車の分。臨時・貨物はこの中で）・inp.evDwell・inp.dw・inp.sp
     inp.day, inp.incidentK, inp.events:[id], inp.cond:{day,wx}, inp.policy（C.POLICY のキー）, inp.forceBig（大きな事故の訓練）, inp.fmt
   返すもの rec：
     rec.v=1・rec.key・rec.rows（列車ごと）・rec.byKey・rec.big・rec.decisions・rec.cancelled（数）・rec.fee
     rec.raw：{ hs, SX, TY2, SYN, EXT, hl, BOATS, NAT, BIG, D2, PX, SETS2, yard }（指令パネルが手順2で読みかえるため）
   rows の1行：{ key, num, type, synth, offMap, down, seq, stop, plan:{arr,dep}, arr, dep, cancel, late（終点での遅れ・分）, track:[番線], why, tr（もとの列車）, run（実際の列車） } */
(function (root) {
  'use strict';
  const C = root.CtcCore || (typeof require === 'function' ? require('./ctc-core.js') : null);
  const V = 1;
  const OFF = s => s === 'W' || s === 'Q';   /* 地図の外（県央本線の西・東） */
  const BRS = s => s === 'F' || s === 'T' || s === 'O';
  const baseOf = t => (t && t.base) || t;

  /* キー：これが同じなら同じ結果（指令パネルの ensureHl のキーと同じ材料＋駅の形の有無） */
  function keyOf(inp) {
    const c = inp.cond || {};
    return [V, inp.D.trips.length, inp.day || 1, inp.incidentK == null ? 1 : inp.incidentK, inp.X ? 1 : 0, inp.hs ? 1 : 0, (inp.events || []).join(','), (c.day || '') + (c.wx || ''), inp.forceBig ? 'B' : 'b', inp.policy || 'balance', inp.sp || 1, inp.dw || 0].join('|');
  }

  function build(inp) {
    const D = inp.D, X = inp.X || null, hs = inp.hs || null;
    const day = inp.day || 1, ik = inp.incidentK == null ? 1 : inp.incidentK, evs = inp.events || [], cond = inp.cond || {};
    const pol = C.POLICY[inp.policy] ? inp.policy : 'balance';
    const SX = C.extST(inp.ST), TY2 = Object.assign({}, inp.TYPES, C.SYN_TYPES);
    const senv = () => ({ ST: SX, dw: inp.dw || 0, evDwell: inp.evDwell, crew: X ? X.freight.crew : 2 });
    const onSid = (t, i) => { const b = baseOf(t); return b.synth ? C.synOnSiding(b, i, senv()) : inp.onSiding(b, i); };
    const nomD = (t, i) => { const b = baseOf(t); return b.synth ? C.synDwell(b, i, senv()) : inp.nomDwell(b, i); };
    const holiday = !!(cond.day && cond.day !== 'wd');
    const fmt = inp.fmt || (t => `${Math.floor(t / 60) % 24}:${String(Math.floor(t % 60)).padStart(2, '0')}`);

    /* 1 予定：定期＋臨時・貨物 */
    const SYN = X ? C.synth(Object.assign(senv(), { trips: D.trips, X, events: evs, holiday, sp: inp.sp || 1, day })) : { trips: [], sets: [] };
    const ALLT = D.trips.concat(SYN.trips);
    /* 見どころ（予定の待避・接続・行き違い）と外との接続 */
    const henv = { ST: SX, TYPES: TY2, onSiding: onSid, DEPOTNAME: inp.DEPOTNAME || {} };
    const EXT = X ? C.extConns(D.trips, SYN.trips, { ST: SX, TYPES: TY2, X, day, wx: cond.wx }) : [];
    const hl = C.synHighlights(C.highlights(ALLT, D.sets, henv), SYN.trips, henv).concat(EXT).sort((a, b) => a.t - b.t);
    const BOATS = X ? C.boats(D.trips, { X }) : [];
    BOATS.forEach(f => hl.push({ t: f.t - 6, k: 'connFerry', st: f.st, a: f.tr, txt: `港で ${TY2[f.tr.type].name} ${f.tr.num} → ${f.label}（${fmt(f.t)}発）に乗りつぎ`, radio: `港駅、${f.tr.num}列車から${f.label}への乗りつぎがあります。` }));
    hl.sort((a, b) => a.t - b.t);

    /* 3 乱れ：大きな事故（運行日ごとの運・訓練ならかならず）→ disrupt */
    const NAT = C.bigIncident(D.trips, { day, incidentK: ik });
    const BIG = inp.forceBig ? C.bigIncident(D.trips, { day, incidentK: ik, force: true }) : NAT;
    const D2 = C.disrupt(ALLT, hl, { big: BIG, ST: SX, TYPES: TY2, onSiding: onSid, nomDwell: nomD, day, incidentK: ik, ext: EXT, pre: X ? C.synLate(SYN.trips, { X, day }) : null, rule: C.POLICY[pol],
      requests: X ? C.requests(D.trips, { ST: SX, TYPES: TY2, X, events: evs, holiday, policy: pol }) : [], boats: BOATS });
    D2.decisions.forEach(c => { c.txt = c.what + ' → ' + c.dec; });
    const PX = new Map(); ALLT.forEach(t => PX.set(t, C.actual(t, D2)));

    /* ホームの長さ（駅の形・信号の位置はここから。指令パネルと同じ値になる） */
    { const PL = {}; ALLT.forEach(t => t.seq.forEach((st, i) => { if (!C.GEO[st]) return; if (i === 0 || i === t.seq.length - 1 || t.stop[i]) PL[st] = Math.max(PL[st] || 0, (t.cars || 6) * 0.02); }));
      ALLT.forEach(t => { for (let i = 0; i < t.seq.length - 1; i++) { const u = t.seq[i] + t.seq[i + 1]; if (u === 'FT' || u === 'TF') PL.X = Math.max(PL.X || 0, (t.cars || 6) * 0.02); } });
      C.setPL(PL); }
    if (BIG) { const px = PX.get(BIG.tr); if (px) px.hold = { i: BIG.i, f: BIG.f, dur: BIG.dur, run: BIG.tr.arr[BIG.i + 1] - BIG.tr.dep[BIG.i] }; }
    const SETS2 = D.sets.map(s => Object.assign(Object.create(s), { trips: s.trips.map(t => PX.get(t)).filter(t => !t.cancel) }));   /* 運休の列車は走らせない */
    const synSets = SYN.sets.map(s => Object.assign(Object.create(s), { trips: s.trips.map(t => PX.get(t) || t) }));

    /* 番線の割りふり（同じ番線に2本が入らないように。少しだけ時刻をずらすことがある） */
    let yard = null;
    if (hs) yard = C.yard(SETS2.concat(synSets), { ST: SX, hs, onSiding: onSid });

    /* 列車ごとの表 */
    const tenv = { ST: SX, hs, onSiding: onSid };
    const rows = [], byKey = new Map(), byTrip = new Map();
    let nCancel = 0;
    ALLT.forEach(tr => {
      const px = PX.get(tr), yd = yard ? yard.map.get(px) : null, run = yd || px, cancel = !!px.cancel, n = tr.seq.length;
      if (cancel) nCancel++;
      const key = (tr.synth ? 'S' : 'R') + tr.type + tr.num + '@' + Math.round(tr.dep[0] * 10);
      const row = { key, num: tr.num, type: tr.type, synth: !!tr.synth, offMap: tr.seq.some(OFF), down: !!tr.down, seq: tr.seq, stop: tr.stop,
        plan: { arr: tr.arr, dep: tr.dep }, arr: run.arr, dep: run.dep, cancel,
        late: cancel ? null : run.arr[n - 1] - tr.arr[n - 1],
        track: tr.seq.map((s, i) => OFF(s) ? null : C.trackNo(run, i, tenv)),
        why: px.why || tr.seq.map(() => []), tr, run };
      rows.push(row); byKey.set(key, row); byTrip.set(tr, row);
    });

    return { v: V, key: keyOf(inp), day, policy: pol, forced: !!inp.forceBig, rows, byKey, byTrip, big: BIG, decisions: D2.decisions, cancelled: nCancel,
      fee: X ? C.fee(SYN.trips, X, SX) : null,
      raw: { X, hs, SX, TY2, SYN, EXT, hl, BOATS, NAT, BIG, D2, PX, SETS2, synSets, yard, onSid, nomD } };
  }

  /* その時刻に、列車がどこにいるか（線路のキロ程）。地図・乗車体験が読む。
     返すもの { st:'before'|'stop'|'run'|'after'|'cancel'|'off', i, a, b, km, frac（a→b のキロの割合 0〜1）, branch（温泉支線のキロか）, track（止まっているときの番線） }
     km は本線なら中央からの km、温泉支線なら川辺からの km（ST の km・bkm と同じ）。先頭の位置。 */
  let LAYK = null, LAY = null;
  function where(rec, row, T) {
    const n = row.seq.length;
    if (row.cancel) return { st: 'cancel', i: 0, a: row.seq[0], b: row.seq[0], km: null, frac: 0 };
    const l0 = row.run.lead0 != null ? row.run.lead0 : 1;   /* 始発は発車の lead0 分前からホームにいる（指令パネルと同じ） */
    if (T < Math.min(row.arr[0], row.dep[0] - l0) - 1e-9) return Object.assign(at(rec, row, 0, T), { st: 'before' });
    if (T > row.arr[n - 1] + 1e-9) return Object.assign(at(rec, row, n - 1, T), { st: 'after' });
    return at(rec, row, null, T);
  }
  function at(rec, row, fix, T) {
    const R = rec.raw, SX = R.SX, n = row.seq.length;
    if (LAYK !== SX) { LAY = C.layout(SX, 100); LAYK = SX; }
    const env = { ST: SX, hs: R.hs, onSiding: R.onSid };
    const tr = row.run, Tq = fix == null ? T : fix === 0 ? Math.min(T, tr.dep[0]) : tr.arr[n - 1];
    let i = 0; while (i < n - 1 && tr.arr[i + 1] <= Tq) i++;
    const a = row.seq[i], b = row.seq[Math.min(n - 1, i + 1)];
    const stopped = Tq < tr.dep[i] || i === n - 1;
    if (OFF(a) || (!stopped && OFF(b))) return { st: 'off', i, a, b, km: null, frac: stopped ? 0 : Math.max(0, Math.min(1, (Tq - tr.dep[i]) / (tr.arr[i + 1] - tr.dep[i]))), branch: false, track: null };
    const p = C.trainPos(tr, Tq, LAY, env);
    const br = BRS(a) || BRS(b), kmOf = s => br ? (s === 'K' ? 0 : SX[s].bkm) : SX[s].km;
    const ka = kmOf(a), kb = kmOf(b);
    const frac = stopped ? 0 : kb === ka ? 0 : Math.max(0, Math.min(1, (p.km - ka) / (kb - ka)));
    return { st: stopped ? 'stop' : 'run', i, a, b: stopped ? a : b, km: p.km, frac, branch: br, track: stopped ? row.track[i] : null, xwait: !!p.xwait };
  }
  /* その時刻に線路の上にいる列車（運休・車庫の中はのぞく） */
  function liveAt(rec, T) {
    const out = [];
    for (const row of rec.rows) { if (row.cancel) continue; const n = row.seq.length; if (T < row.dep[0] - 3 || T > row.arr[n - 1] + 0.5) continue; out.push({ row, w: where(rec, row, T) }); }
    return out;
  }
  /* 駅ごとの発着（発車標・売店の到着の人の流れ用）。{st, t, kind:'arr'|'dep', row, i, track} を時刻の順に */
  function boardAt(rec, st) {
    const out = [];
    for (const row of rec.rows) { if (row.cancel) continue; const i = row.seq.indexOf(st); if (i < 0) continue;
      if (i > 0) out.push({ st, t: row.arr[i], kind: 'arr', row, i, track: row.track[i] });
      if (i < row.seq.length - 1) out.push({ st, t: row.dep[i], kind: 'dep', row, i, track: row.track[i] }); }
    return out.sort((x, y) => x.t - y.t);
  }

  const api = { V, keyOf, build, where, liveAt, boardAt, OFF };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RunRecordCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
