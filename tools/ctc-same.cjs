/* 指令パネルの出力が、2つの版で同じかを比べる（2026-11-25・運行の記録の手順2で使った）。
   使い方：git worktree add /tmp/old <前の版> のあと、node tools/ctc-same.cjs /tmp/old 8801 ran と node tools/ctc-same.cjs . 8802 ran を回し、pos・cards・late・fee が同じかを見る（/tmp/h-<port>-<場面>.txt を cmp してもよい）。場面は plan|ran|big|event。Playwright が要る */
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require('/opt/npm-tools/node_modules/playwright'); } })();
const { spawn } = require('child_process'), crypto = require('crypto');
(async () => {
  const [dir, port, sc] = process.argv.slice(2);
  const srv = spawn('python3', ['-m', 'http.server', port], { cwd: dir, stdio: 'ignore' }); await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1300, height: 1100 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { let a = 1; Math.random = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; });
  await p.goto(`http://localhost:${port}/index.html`); await p.waitForTimeout(2500);
  await p.evaluate(() => document.querySelectorAll('.rsv,.ksv,.topv').forEach(e => e.hidden = true));
  await p.evaluate(() => { window.__n = { yard: 0, disrupt: 0, synth: 0 }; for (const k in window.__n) { const f = CtcCore[k]; CtcCore[k] = function () { window.__n[k]++; return f.apply(this, arguments); }; } });
  await p.evaluate(`setPlay(false); setPane('ctc');`); await p.waitForTimeout(1200);
  await p.evaluate(() => document.querySelector('#ctcZoom button[data-v="200"]').click()); await p.waitForTimeout(800);
  await p.evaluate(sc => { const ran = document.querySelector('#ctcRan'), big = document.querySelector('#ctcBig'); ran.checked = sc !== 'plan'; big.checked = sc === 'big'; if (sc === 'event') COND.evs = ['hanabi', 'onsen']; ran.dispatchEvent(new Event('change')); big.dispatchEvent(new Event('change')); }, sc);
  await p.waitForTimeout(3000);
  const r = await p.evaluate(() => {
    const h = [], rd = x => typeof x === 'number' ? Math.round(x * 100) / 100 : x;
    for (let T = 280; T <= 1540; T += 0.5) { const P = CtcView.probe(T); if (!P) continue;
      h.push(T + ':' + P.trains.map(t => [t.num, t.dead ? 1 : 0, t.moving ? 1 : 0, rd(t.x), rd(t.y)].join(',')).sort().join(';') + '|' + P.sig.map(s => s.asp).join('') + '|' + P.pts.map(q => (q.lock ? 1 : 0) + '' + (q.rev ? 1 : 0)).join('')); }
    const S = CtcView.syn(); const cards = S.D2.decisions.map(c => c.t.toFixed(2) + c.k + (c.txt || '')).join('\n');
    return { h, cards, late: CtcView.lateShare && JSON.stringify(CtcView.lateShare(D)), fee: CtcView.feeToday(D), n: window.__n, builds: window.RunRecord ? RunRecord.stats.builds : null, board: document.querySelector('#ctcCards') ? document.querySelector('#ctcCards').textContent.length : 0 };
  });
  const H = s => crypto.createHash('md5').update(s).digest('hex').slice(0, 10);
  console.log(JSON.stringify({ sc, frames: r.h.length, pos: H(r.h.join('\n')), cards: H(r.cards), late: r.late, fee: r.fee, calls: r.n, builds: r.builds, errs: errs.slice(0, 3) }));
  require('fs').writeFileSync(`/tmp/h-${port}-${sc}.txt`, r.h.join('\n'));
  await b.close(); srv.kill();
})();
