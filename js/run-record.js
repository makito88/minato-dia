/* 運行の記録のつなぎ（ブラウザ）。計算は js/run-record-core.js。docs/run-record-plan.md の手順1（2026-11-25）。
   RunRecord.init(env)：index.html から。env は指令パネル（CtcView.init）と同じ材料。
   RunRecord.get(opts)：その日の記録（opts なしのときは、データを読みおわるまで null）。呼ばれたときだけ計算し、運行日・ダイヤ・条件（キー）が同じあいだは前の結果を返す（軽さの決まり）。
     opts（なくてよい）：{ policy, forceBig, X, hs }。指令パネルは自分の方針・訓練・読みこんだデータを渡す（手順2・2026-11-25）。キーごとに3つまでとっておく。
   RunRecord.where(row, T)・liveAt(T)・boardAt(st)：記録を読むだけ。
   読んでいるもの：指令パネル（js/ctc-view.js の ensureHl・手順2）・地図（index.html の mapRec・手順3）。大きな事故の訓練は「試運転」のもの（手順4）なので、opts なしでは起こさない。 */
(function () {
  'use strict';
  const RC = window.RunRecordCore; if (!RC) return;
  let E = null, X = null, HS = null, recD = null, cache = [];
  const opt = { forceBig: false };
  const stats = { builds: 0, ms: 0 };
  let pend = 0, polV = null, polT = -1e9;   /* pend：読みこみ中のファイルの数。読みおわるまで、opts なしの get() は null（地図は前の描き方で待つ。作り直しを何回もしない） */
  function init(env) {
    E = env;
    /* 指令パネルと同じファイル（同じ ?v なのでブラウザのキャッシュを使う）。読めたら次の get() で作り直す */
    pend = 2;
    fetch('data/ctc-extra.json').then(r => r.json()).then(j => { X = j; }).catch(() => { }).finally(() => { pend--; });
    fetch('data/ctc-haisen.json?v=20261121c').then(r => r.json()).then(j => { HS = j; }).catch(() => { }).finally(() => { pend--; });
  }
  function input(o) {
    if (!E) return null; o = o || {};
    const D = E.D(); if (!D || !D.trips || !D.sets) return null;
    const now = Date.now(); if (now - polT > 1000) { polT = now; polV = null; try { polV = localStorage.getItem('dia-ctc-policy'); } catch (e) { } }   /* 指令の方針は指令パネルで選んだもの（地図は毎コマ呼ぶので、読むのは1秒に1回） */
    let pol = polV || 'balance';
    if (o.policy) pol = o.policy;
    return { D, ST: E.ST, TYPES: E.TYPES, DEPOTNAME: E.DEPOTNAME, X: o.X !== undefined ? o.X : X, hs: o.hs !== undefined ? o.hs : HS, onSiding: E.onSiding, nomDwell: E.nomDwell, evDwell: E.evDwell,
      dw: E.dw ? E.dw() : 0, sp: E.sp ? E.sp() : 1, day: E.day ? E.day() : 1, incidentK: E.incidentK ? E.incidentK() : 1,
      events: E.events ? E.events() : [], cond: E.cond ? E.cond() : {}, policy: pol, forceBig: o.forceBig != null ? !!o.forceBig : opt.forceBig, fmt: E.fmt };
  }
  function get(o) {
    if (!o && pend > 0) return null;
    const inp = input(o); if (!inp) return null;
    if (recD !== inp.D) { cache = []; recD = inp.D; }   /* ダイヤが作り直されたら、とっておいた記録はすてる */
    const k = RC.keyOf(inp), hit = cache.find(r => r.key === k);   /* 指令パネルが読んだデータもここで読んだデータも同じファイルなので、キー（あるかないか）だけで見分ける */
    if (hit) return hit;
    const t0 = performance.now();
    const rec = RC.build(inp);
    stats.builds++; stats.ms = performance.now() - t0; rec.ms = stats.ms;
    cache.unshift(rec); if (cache.length > 3) cache.length = 3;
    return rec;
  }
  window.RunRecord = {
    init, get, stats,
    set: o => { Object.assign(opt, o || {}); },
    where: (row, T) => { const r = get(); return r ? RC.where(r, row, T) : null; },
    liveAt: T => { const r = get(); return r ? RC.liveAt(r, T) : []; },
    boardAt: st => { const r = get(); return r ? RC.boardAt(r, st) : []; },
  };
})();
