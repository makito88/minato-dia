/* 地図の列車が運行の記録（手順3・2026-11-25）で動いているかの確かめ。node tools/map-record-check.cjs <port> <1|0（?rr=0＝前の描き方）> <plain|big|event>。
   1日を0.5分ごとに描き、地図の割合と記録の割合が同じか（fracBad=0）・運休が地図にいないか・重なりの数・臨時と貨物の数・1回の描画の時間を出す。絵は /tmp/rr3/ に。Playwright が要る */
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require('/opt/npm-tools/node_modules/playwright'); } })();
const { spawn } = require('child_process'); require('fs').mkdirSync('/tmp/rr3', { recursive: true });
(async () => {
  const [port, rr, sc] = process.argv.slice(2);
  const srv = spawn('python3', ['-m', 'http.server', port], { cwd: require('path').join(__dirname, '..'), stdio: 'ignore' }); await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1300, height: 900 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { let a = 1; Math.random = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; });
  await p.goto(`http://localhost:${port}/index.html${rr === '0' ? '?rr=0' : ''}`); await p.waitForTimeout(3500);
  await p.evaluate(() => document.querySelectorAll('.rsv,.ksv,.topv').forEach(e => e.hidden = true));
  await p.evaluate(`setPlay(false); setPane('run');`); await p.waitForTimeout(800);
  if (sc === 'big') await p.evaluate(() => { RunRecord.set({ forceBig: true }); MR = null; });
  if (sc === 'event') await p.evaluate(() => { COND.evs = ['hanabi', 'onsen']; });
  const r = await p.evaluate(() => {
    const out = { frames: 0, vis: 0, ov: 0, ovEx: [], fracBad: 0, fracN: 0, syn: 0, tags: 0, cancelOnMap: 0, mr: !!mapRec(), big: null, cancelled: 0, ms: [] };
    const rec = (typeof MR!=="undefined"&&MR) && MR.rec; if (rec) { out.big = rec.big && rec.big.name; out.cancelled = rec.cancelled; }
    const cancelled = new Set(rec ? rec.rows.filter(x => x.cancel).map(x => x.tr) : []);
    const origDraw = window.drawSynMap; let synN = 0;
    for (let t = 300; t <= 1500; t += 0.5) {
      T = t; const t0 = performance.now(); drawMap(); out.ms.push(performance.now() - t0); out.frames++;
      const live = VIS.filter(v => !v.st.dead && v.cars);
      out.vis += live.length;
      for (const v of live) if (cancelled.has(v.st.trip)) out.cancelOnMap++;
      /* 重なり：別の編成の車両が 1.2 より近い（回送はのぞく） */
      for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
        const A = live[i].cars, B = live[j].cars; let hit = false;
        for (const a of A) { for (const q of B) if (Math.hypot(a.x - q.x, a.y - q.y) < 1.2) { hit = true; break; } if (hit) break; }
        if (hit) { out.ov++; if (out.ovEx.length < 5) out.ovEx.push(`${fmt(t)} ${live[i].st.trip.num}×${live[j].st.trip.num}`); } }
      /* 地図の割合＝記録の割合 */
      if (rec) for (const v of live) { const st = v.st; if (!st.moving || !st.run) continue; const w = RunRecordCore.where(rec, st.run.rrow, t); if (w.st !== 'run') continue; out.fracN++; const i = Math.floor(st.u), f = st.u - i; if (Math.abs(f - w.frac) > 1e-6 || i !== w.i) out.fracBad++; }
      if (MR) for (const s of MR.syn) if (t >= Math.min(s.arr[0], s.dep[0] - 1) && t <= s.arr.at(-1) + 0.5) synN++;
    }
    out.syn = synN; out.ms.sort((a, b) => a - b); out.msMed = out.ms[out.ms.length >> 1].toFixed(2); out.ms95 = out.ms[Math.floor(out.ms.length * 0.95)].toFixed(2); delete out.ms;
    out.builds = RunRecord.stats.builds;
    return out;
  });
  r.errs = errs.slice(0, 3); console.log(rr, sc, JSON.stringify(r));
  /* 絵：臨時・貨物が地図の外にいる時刻と、走っている時刻 */
  if (rr === '1') { for (const t of (await p.evaluate(() => { const a = []; if (MR) { const g = MR.syn.find(s => s.type === 'G'); if (g) a.push(g.arr[0] - 2, (g.dep[0] + g.arr[1]) / 2); const z = MR.syn.find(s => s.type === 'Z'); if (z) a.push((z.dep[1] + z.arr[2]) / 2); if (MR.rec.big) a.push(MR.rec.big.t0 + 8); } return a; })))
      { await p.evaluate(t => { T = t; drawMap(); }, t); await p.locator('#map').screenshot({ path: `/tmp/rr3/${sc}-${Math.round(t)}.png` }).catch(async () => { await p.screenshot({ path: `/tmp/rr3/${sc}-${Math.round(t)}.png` }); }); } }
  await b.close(); srv.kill();
})();
