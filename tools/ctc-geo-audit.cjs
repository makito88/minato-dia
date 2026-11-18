/* 指令パネルの線路の点検（2026-11-18）：
   1) 線の端が、つながる相手の線からずれていないか（端から 0.8〜14px に別の線があるのに、のっていない＝ずれ）
   2) 列車・回送の車体が、描いた線路の上（2.5px 以内）を走っているか（1日を動かして）
   使い方：node tools/ctc-geo-audit.cjs [plan|ran|big|event] [刻み分=0.25] [1km の px=200] */
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require('/opt/npm-tools/node_modules/playwright'); } })();
const { spawn } = require('child_process');
(async () => {
  const sc = process.argv[2] || 'plan', step = +(process.argv[3] || 0.25), zoom = process.argv[4] || '200', port = 8790 + Math.floor(Math.random() * 100);
  const srv = spawn('python3', ['-m', 'http.server', String(port)], { cwd: require('path').join(__dirname, '..'), stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1300, height: 1100 } });
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto(`http://localhost:${port}/index.html`); await p.waitForTimeout(2500);
  await p.evaluate(() => document.querySelectorAll('.rsv,.ksv,.topv').forEach(e => e.hidden = true));
  await p.evaluate(`setPlay(false); setPane('ctc');`); await p.waitForTimeout(800);
  await p.evaluate(z => document.querySelector(`#ctcZoom button[data-v="${z}"]`).click(), zoom); await p.waitForTimeout(1200);
  await p.evaluate(sc => { const ran = document.querySelector('#ctcRan'), big = document.querySelector('#ctcBig');
    ran.checked = sc !== 'plan'; big.checked = sc === 'big'; if (sc === 'event') COND.evs = ['hanabi', 'onsen'];
    ran.dispatchEvent(new Event('change')); big.dispatchEvent(new Event('change')); }, sc);
  await p.waitForTimeout(1500);
  const r = await p.evaluate(([step]) => {
    CtcView.probe(300); const TK = CtcView.tracks(), pxk = CtcView.probe(300).pxk, km = x => (x / pxk - 2.8).toFixed(3);
    const segs = []; TK.forEach((t, i) => { for (let k = 1; k < t.pts.length; k++) segs.push({ a: t.pts[k - 1], b: t.pts[k], i }); });
    const segd = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy || 1, u = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L)); return Math.hypot(a[0] + u * dx - p[0], a[1] + u * dy - p[1]); };
    const dmin = (p, skip) => { let m = 1e9; for (const s of segs) { if (s.i === skip) continue; if (Math.abs(s.a[0] - p[0]) > 60 && Math.abs(s.b[0] - p[0]) > 60 && (s.a[0] - p[0]) * (s.b[0] - p[0]) > 0) continue; const d = segd(p, s.a, s.b); if (d < m) m = d; } return m; };
    /* 1) 線の端 */
    const gaps = [];
    TK.forEach((t, i) => [t.pts[0], t.pts[t.pts.length - 1]].forEach(e => { const d = dmin(e, i); if (d > 0.8 && d < 14) gaps.push(`${km(e[0])}km y=${e[1].toFixed(1)} ${t.col}${t.dash ? '点線' : ''} とのずれ ${d.toFixed(1)}px`); }));
    /* 2) 車体が線の上か */
    const off = {}, offEx = []; let n = 0, pts = 0;
    for (let T = 270; T <= 1560; T += step) { const P = CtcView.probe(T); n++;
      for (const t of P.trains) for (const q of t.body) { pts++; const d = dmin(q, -1); if (d > 2.5) { const k = t.num + (t.dead ? '回' : '') + ' ' + t.st + '→' + t.nx; off[k] = (off[k] || 0) + 1; if (offEx.length < 30) offEx.push(`${T.toFixed(2)} ${k} ${km(q[0])}km y=${q[1].toFixed(0)} 線から${d.toFixed(1)}px`); } } }
    return { lines: TK.length, gaps, n, pts, offN: Object.values(off).reduce((a, b) => a + b, 0), off: Object.entries(off).sort((a, b) => b[1] - a[1]).slice(0, 20), offEx };
  }, [step]);
  console.log(sc, JSON.stringify(r, null, 1));
  await b.close(); srv.kill();
})();
