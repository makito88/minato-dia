/* 運行の記録のつなぎ（ブラウザ）。計算は js/run-record-core.js。docs/run-record-plan.md の手順1（2026-11-25）。
   RunRecord.init(env)：index.html から。env は指令パネル（CtcView.init）と同じ材料。
   RunRecord.get()：その日の記録。呼ばれたときだけ計算し、運行日・ダイヤ・条件（キー）が同じあいだは前の結果を返す（軽さの決まり）。
   RunRecord.where(row, T)・liveAt(T)・boardAt(st)：記録を読むだけ。
   いまはまだ、どの画面もこれを読んでいない（手順2で指令パネル、手順3で地図が読む）。大きな事故の訓練は「試運転」のもの（手順4）なので、ここでは起こさない。 */
(function () {
  'use strict';
  const RC = window.RunRecordCore; if (!RC) return;
  let E = null, X = null, HS = null, rec = null, recD = null;
  const opt = { forceBig: false };
  const stats = { builds: 0, ms: 0 };
  function init(env) {
    E = env;
    /* 指令パネルと同じファイル（同じ ?v なのでブラウザのキャッシュを使う）。読めたら次の get() で作り直す */
    fetch('data/ctc-extra.json').then(r => r.json()).then(j => { X = j; }).catch(() => { });
    fetch('data/ctc-haisen.json?v=20261121c').then(r => r.json()).then(j => { HS = j; }).catch(() => { });
  }
  function input() {
    if (!E) return null;
    const D = E.D(); if (!D || !D.trips || !D.sets) return null;
    let pol = 'balance'; try { const v = localStorage.getItem('dia-ctc-policy'); if (v) pol = v; } catch (e) { }   /* 指令の方針は指令パネルで選んだもの */
    return { D, ST: E.ST, TYPES: E.TYPES, DEPOTNAME: E.DEPOTNAME, X, hs: HS, onSiding: E.onSiding, nomDwell: E.nomDwell, evDwell: E.evDwell,
      dw: E.dw ? E.dw() : 0, sp: E.sp ? E.sp() : 1, day: E.day ? E.day() : 1, incidentK: E.incidentK ? E.incidentK() : 1,
      events: E.events ? E.events() : [], cond: E.cond ? E.cond() : {}, policy: pol, forceBig: opt.forceBig, fmt: E.fmt };
  }
  function get() {
    const inp = input(); if (!inp) return null;
    const k = RC.keyOf(inp);
    if (rec && recD === inp.D && rec.key === k) return rec;
    const t0 = performance.now();
    rec = RC.build(inp); recD = inp.D;
    stats.builds++; stats.ms = performance.now() - t0; rec.ms = stats.ms;
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
