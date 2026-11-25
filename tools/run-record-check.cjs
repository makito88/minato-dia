/* 運行の記録（js/run-record.js）が、指令パネル（js/ctc-view.js）と同じ実際の発着・番線になるかを、headless で本物の1日について比べる（2026-11-25・手順1）。
   使い方：node tools/run-record-check.cjs [plan|big|event]（big＝大きな事故の訓練、event＝花火大会＋温泉まつりの日）。Playwright が要る。CTC_SEED で種を変えられる */
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require('/opt/npm-tools/node_modules/playwright'); } })();
const { spawn } = require('child_process');
(async () => {
  const sc = process.argv[2] || 'plan', port = +process.env.APORT || 8767;
  const srv = spawn('python3', ['-m', 'http.server', String(port)], { cwd: require('path').join(__dirname, '..'), stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1300, height: 1100 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(sd => { let a = sd >>> 0; Math.random = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }, +(process.env.CTC_SEED || 1));
  await p.goto('http://localhost:' + port + '/index.html'); await p.waitForTimeout(2500);
  await p.evaluate(() => document.querySelectorAll('.rsv,.ksv,.topv').forEach(e => e.hidden = true));
  await p.evaluate(`setPlay(false); setPane('ctc');`); await p.waitForTimeout(1500);
  await p.evaluate(sc => { const big = document.querySelector('#ctcBig'); big.checked = sc === 'big'; if (sc === 'event') COND.evs = ['hanabi', 'onsen']; big.dispatchEvent(new Event('change')); RunRecord.set({ forceBig: sc === 'big' }); }, sc);
  await p.waitForTimeout(2500);
  const r = await p.evaluate(() => {
    CtcView.probe(600);
    const S = CtcView.syn(), D2 = S.D2, YS = S.YS;
    const t0 = performance.now(), rec = RunRecord.get(), ms1 = performance.now() - t0;
    const t1 = performance.now(); RunRecord.get(); const ms2 = performance.now() - t1;
    const key = t => (t.synth ? 'S' : 'R') + t.type + t.num + '@' + Math.round(t.dep[0] * 10);
    /* 指令パネルの実際（disrupt）と、番線の割りふりのあと（yard）の時刻 */
    const pa = new Map(); D2.A.forEach((a, t) => pa.set(key(t), { a, t }));
    const py = new Map(); (YS ? YS.reg.concat(YS.syn) : []).forEach(s => s.trips.forEach(t => { const bt = t.yardOf ? (t.yardOf.base || t.yardOf) : (t.base || t); py.set(key(bt), t); }));
    const out = { rows: rec.rows.length, panel: pa.size, yard: py.size, miss: [], dA: 0, dY: 0, ex: [], cancelR: rec.cancelled, cancelP: [...D2.cancelled].length, big: rec.big ? rec.big.name : null, bigP: S.D2.big ? S.D2.big.name : null, ms1, ms2, builds: RunRecord.stats.builds, decR: rec.decisions.length, decP: D2.decisions.length, trk: 0, trkN: 0 };
    const C = CtcCore, tenv = { ST: rec.raw.SX, hs: rec.raw.hs, onSiding: rec.raw.onSid };
    for (const row of rec.rows) {
      const q = pa.get(row.key); if (!q) { out.miss.push(row.key); continue; }
      const mine = rec.raw.D2.A.get(row.tr), n = row.seq.length;
      let da = 0; for (let i = 0; i < n; i++) da = Math.max(da, Math.abs(mine.arr[i] - q.a.arr[i]), Math.abs(mine.dep[i] - q.a.dep[i]));
      if (!!mine.cancel !== !!q.a.cancel) da = 999;
      out.dA = Math.max(out.dA, da); if (da > 1e-6 && out.ex.length < 6) out.ex.push(['disrupt', row.key, da]);
      const y = py.get(row.key);
      if (y && !row.cancel) { let dy = 0; for (let i = 0; i < n; i++) dy = Math.max(dy, Math.abs(y.arr[i] - row.arr[i]), Math.abs(y.dep[i] - row.dep[i])); out.dY = Math.max(out.dY, dy); if (dy > 1e-6 && out.ex.length < 6) out.ex.push(['yard', row.key, dy]);
        for (let i = 0; i < n; i++) { if (row.track[i] == null) continue; out.trkN++; if (String(C.trackNo(y, i, tenv)) !== String(row.track[i])) { out.trk++; if (out.ex.length < 6) out.ex.push(['track', row.key, row.seq[i], row.track[i], C.trackNo(y, i, tenv)]); } } }
      else if (!y && !row.cancel) out.miss.push('yard:' + row.key);
    }
    /* いる場所：記録の km と、指令パネルの列車の位置の km（同じ trainPos）をいくつかの時刻で */
    out.where = {}; for (const T of [330, 480, 720, 1080, 1320]) { const L = RunRecord.liveAt(T); out.where[T] = { live: L.length, run: L.filter(x => x.w.st === 'run').length, off: L.filter(x => x.w.st === 'off').length, badFrac: L.filter(x => x.w.frac < 0 || x.w.frac > 1).length }; }
    out.miss = out.miss.slice(0, 8);
    return out;
  }).catch(e => ({ err: String(e) }));
  r.pageErrors = errs.slice(0, 5); console.log(JSON.stringify(r));
  await b.close(); srv.kill();
})();
