/* 全ポイントの1日の動きを細かく（3秒ごと）確かめる（2026-11-19）。
   使い方：node tools/ctc-point-audit.cjs [plan|ran|event] [始め分=300] [おわり分=1500]
   見ること：①鎖錠中に向きが変わる ②列車（回送も）がまだ上にいるのに解錠 ③反位のまま、鎖錠も列車の予定もなく1分以上ほうっておかれる ④定位へ戻るときに転換中がない */
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const http = require('http'), path = require('path'), fs = require('fs');
(async () => {
  const [,, sc = 'plan', a = '300', z = '1500'] = process.argv, root = path.join(__dirname, '..');
  const srv = http.createServer((q, r) => { const f = path.join(root, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': f.endsWith('.js') ? 'text/javascript' : f.endsWith('.html') ? 'text/html' : f.endsWith('.json') ? 'application/json' : 'text/plain' }); r.end(d); }); }).listen(+process.env.PORT || 8767);
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1300, height: 1100 } });
  p.on('pageerror', e => console.log('ERR', e.message));
  /* CTC_DATE=2026-11-20 のように渡すと、その日の日付のつもりで動かす（日ごとの乱れの出方を、あとからでも同じに見るため。2026-11-21） */
  if (process.env.CTC_DATE) await p.addInitScript(d => { const D0 = Date, off = new D0(d + 'T05:00:00+09:00').getTime() - D0.now(); class FD extends D0 { constructor(...a) { if (a.length) super(...a); else super(D0.now() + off); } static now() { return D0.now() + off; } } window.Date = FD; }, process.env.CTC_DATE);
  await p.goto('http://localhost:' + (+process.env.PORT || 8767) + '/index.html'); await p.waitForTimeout(2500);
  await p.evaluate(`setPlay(false); setPane('ctc');`); await p.waitForTimeout(1000);
  await p.evaluate(() => document.querySelector('#ctcZoom button[data-v="200"]').click()); await p.waitForTimeout(800);
  await p.evaluate(sc => { const ran = document.querySelector('#ctcRan'); ran.checked = sc !== 'plan'; COND.evs = sc === 'event' ? ['hanabi', 'onsen'] : []; ran.dispatchEvent(new Event('change')); }, sc);
  await p.waitForTimeout(1200);
  const r = await p.evaluate(([a, z]) => {
    const out = { n: 0, pts: 0, flip: [], unlock: [], stuck: [], snap: [], leg: [] }, push = (k, v) => { out[k].n = (out[k].n || 0) + 1; if (out[k].length < 8) out[k].push(v); };
    const fmt = t => `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}:${String(Math.round((t % 1) * 60)).padStart(2, '0')}`;
    const segd = (q, A, B) => { const dx = B[0] - A[0], dy = B[1] - A[1], LL = dx * dx + dy * dy || 1, u = Math.max(0, Math.min(1, ((q[0] - A[0]) * dx + (q[1] - A[1]) * dy) / LL)); return Math.hypot(A[0] + u * dx - q[0], A[1] + u * dy - q[1]); };
    const near = (P, q, d) => P.length > 1 ? P.some((v, k) => k && segd(q, P[k - 1], v) < d) : Math.hypot(P[0][0] - q[0], P[0][1] - q[1]) < d;
    const prev = new Map();
    for (let T = a; T <= z; T += 0.05) {
      const P = CtcView.probe(T); if (!P) continue; out.n++; const Q = P.trains.map(x => ({ p: { body: x.body, x: x.x, y: x.y }, tr: { num: x.num }, dead: x.dead }));   /* ポイントの状態を決めたのと同じ位置 */
      P.pts.forEach((q, i) => { if (q.a == null || q.b == null || q.cross) return; out.pts = Math.max(out.pts, i + 1);
        const nm = q.st + (q.no || '分' + Math.round(q.J ? q.J[0] : q.x) + ',' + Math.round(q.J ? q.J[1] : q.y0));
        const J = q.gen ? q.J : [q.x, q.y0 + q.trunk], tl = q.gen ? Math.min(2, Math.max(3, Math.min(9, q.lenN * 0.6, q.lenR * 0.6)) * 0.35) : 2;
        const on = Q.filter(x => near(x.p.body || [[x.p.x, x.p.y]], J, tl)).map(x => x.tr.num + (x.dead ? '回' : ''));
        const pv = prev.get(i);
        if (pv) {
          if (pv.lock && q.lock && pv.rev !== q.rev && pv.on.length && on.length && pv.on[0] === on[0]) push('flip', `${fmt(T)} ${nm} ${on[0]}`);
          if (pv.rev && !q.rev && q.phase !== 'move') push('snap', `${fmt(T)} ${nm} 前=${pv.lock ? 'L' : '-'}${pv.on.join(',')} 今=${q.lock ? 'L' : '-'}${q.phase || ''}${on.join(',')}`);
          if (q.rev && !q.lock && !q.claim) { pv.free = (pv.free || 0) + 0.05; if (pv.free > 1 && !pv.told) { push('stuck', `${fmt(T)} ${nm}`); pv.told = true; } } else pv.free = 0;
        }
        if (on.length && !q.lock) push('unlock', `${fmt(T)} ${nm} ${on.join(',')}`);
        { let lN, lR; if (q.gen) { const m = Math.max(3, Math.min(9, q.lenN * 0.6, q.lenR * 0.6)); lN = [J[0] + q.uN[0] * m, J[1] + q.uN[1] * m]; lR = [J[0] + q.uR[0] * m, J[1] + q.uR[1] * m]; }
          else { const yt = q.y0 + q.trunk, dx = (q.side === 'W' ? 1 : -1) * (q.out ? -1 : 1); lN = [q.x + dx * q.len * 0.5, (yt + q.y0 + q.a) / 2]; lR = [q.x + dx * q.len * 0.5, (yt + q.y0 + q.b) / 2]; }
          for (const x of Q) { const B = x.p.body || [[x.p.x, x.p.y]]; if (!near(B, J, tl)) continue; const r = q.a !== q.b && near(B, lR, tl), n = near(B, lN, tl);
            if (r !== n && r !== q.rev) push('leg', `${fmt(T)} ${nm} ${x.tr.num}${x.dead ? '回' : ''} 列車=${r ? 'R' : 'N'} ポイント=${q.rev ? 'R' : 'N'}`); } }
        prev.set(i, { rev: q.rev, lock: q.lock, on, free: pv ? pv.free : 0, told: pv ? pv.told : false });
      });
    }
    out.redTrue = (CtcView.redLog ? CtcView.redLog() : []).map(e => `${e.T.toFixed(2)} ${e.num} が赤の${e.kind}（${e.st || ''} ${e.km.toFixed(2)}km）を越えた`); out.redTrue.n = out.redTrue.length; out.redTrue.splice(8);
    for (const k of ['flip', 'unlock', 'stuck', 'snap', 'leg', 'redTrue']) out[k] = { n: out[k].n || 0, ex: out[k].slice() };
    return out; }, [+a, +z]);
  console.log(JSON.stringify(r, null, 1)); await b.close(); srv.close();
})();
