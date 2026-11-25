/* 運行の記録の段4〜6（手順5・2026-11-25）の確かめ：node tools/rail-actual-check.cjs <port> plain|big。予定の D が変わらないか・実際の乗客と運賃・代行バス・払い戻し・かかった時間を出す。Playwright が要る */
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require('/opt/npm-tools/node_modules/playwright'); } })();
const { spawn } = require('child_process');
(async () => { const port = process.argv[2] || 8831, sc = process.argv[3] || 'plain', srv = spawn('python3', ['-m', 'http.server', String(port)], { cwd: require('path').join(__dirname, '..'), stdio: 'ignore' }); await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch(), p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); await p.route(/open-meteo|holidays-jp/, r => r.abort());
  await p.addInitScript(() => { let a = 1; Math.random = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; });
  await p.goto(`http://localhost:${port}/index.html`); await p.waitForTimeout(4000);
  const r = await p.evaluate(sc => { if (sc !== 'plain') { setMode('test', 'btn'); RunRecord.set({ forceBig: true }); if (sc === 'branch') { /* 支線の事故の日をさがす */ } }
    const S0 = JSON.stringify([D.summary.rev, D.summary.riders, D.trips[5].loadAfter.join()]);
    const t0 = performance.now(), A = minatoRail.actual(), ms = performance.now() - t0; const t1 = performance.now(); minatoRail.actual(); const ms2 = performance.now() - t1;
    const S1 = JSON.stringify([D.summary.rev, D.summary.riders, D.trips[5].loadAfter.join()]);
    const s = A.summary, P = D.summary, R = x => Math.round(x);
    return { sc, same: S0 === S1, ms: R(ms), simMs: R(A.ms), ms2, big: A.rec.big && [A.rec.big.name, A.rec.big.a, A.rec.big.b, R(A.rec.big.dur)], cancelled: A.cancelled,
      plan: { riders: R(P.riders), rev: R(P.rev), aband: R(P.aband), left: R(P.left), run: R(P.run), profit: R(P.profit) },
      act: { riders: R(s.riders), rev: R(s.rev), aband: R(s.aband), left: R(s.left), run: R(s.run), profit: R(s.profit) },
      bus: A.busInfo && { ...A.busInfo, riders: R(A.busInfo.riders), run: R(A.busInfo.run), hours: +A.busInfo.hours.toFixed(2) }, refund: { yen: R(A.refund.yen), pax: R(A.refund.pax), trains: A.refund.trains }, lateRiders: R(A.lateRiders), DAok: A.DA.sets === D.sets && A.DA.sim !== D.sim };
  }, sc);
  r.errs = errs.slice(0, 3); console.log(JSON.stringify(r, null, 0)); await b.close(); srv.kill(); })();
