/* 指令パネルの点検（2026-11-18）：headless で1日を動かし、重なり・ポイントの鎖錠と向き・赤の信号を越えたか・単線区間・車両数・車庫の置き場所・夜を数える。
   使い方：node tools/ctc-audit.cjs plan|ran|big|event [刻み分=0.1]（plan＝予定、ran＝きょうの乱れ、big＝大きな事故の訓練、event＝花火大会＋温泉まつりの日）。Playwright が要る */
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require('/opt/npm-tools/node_modules/playwright'); } })();
const { spawn } = require('child_process');
(async () => {
  const sc = process.argv[2] || 'plan', step = +(process.argv[3] || 0.1);
  const srv = spawn('python3', ['-m', 'http.server', '8766'], { cwd: require('path').join(__dirname, '..'), stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1300, height: 1100 } });
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('http://localhost:8766/index.html'); await p.waitForTimeout(2500);
  await p.evaluate(() => document.querySelectorAll('.rsv,.ksv,.topv').forEach(e => e.hidden = true));
  await p.evaluate(`setPlay(false); setPane('ctc');`); await p.waitForTimeout(800);
  await p.evaluate(() => document.querySelector('#ctcZoom button[data-v="200"]').click()); await p.waitForTimeout(1200);
  await p.evaluate(sc => { const ran = document.querySelector('#ctcRan'), big = document.querySelector('#ctcBig');
    ran.checked = sc !== 'plan'; big.checked = sc === 'big'; if (sc === 'event') { COND.evs = ['hanabi', 'onsen']; }
    ran.dispatchEvent(new Event('change')); big.dispatchEvent(new Event('change')); }, sc);
  await p.waitForTimeout(1500);
  const r = await p.evaluate(([step]) => {
    const M = 300, out = { redK: {}, n: 0, overlap: [], overlapDead: [], ptLock: [], ptLeg: [], ptFoul: [], red: [], oneMiss: [], oneHead: [], count: [], slot: [], longDead: [], night: [], snap: {} };
    const push = (a, v) => { a.n = (a.n || 0) + 1; if (a.length < 6) a.push(v); };
    const segd = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy || 1, u = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L)); return Math.hypot(a[0] + u * dx - p[0], a[1] + u * dy - p[1]); };
    const near = (B, pt, d) => B.some((q, k) => k && segd(pt, B[k - 1], q) < d) || (B.length === 1 && Math.hypot(B[0][0] - pt[0], B[0][1] - pt[1]) < d);
    const bb = B => { const xs = B.map(q => q[0]), ys = B.map(q => q[1]); return [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]; };
    const yAt = (B, x) => { for (let k = 1; k < B.length; k++) { const a = B[k - 1], b = B[k]; if ((a[0] - x) * (b[0] - x) <= 0 && a[0] !== b[0]) return a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]); } return null; };
    const fmt = T => { const m = Math.round(T) % 1440; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
    let prev = null; const total = null;
    for (let T = 270; T <= 1560; T += step) {
      const P = CtcView.probe(T); if (!P) continue; out.n++;
      const tr = P.trains, live = tr.filter(t => !t.dead);
      /* 1. 重なり（車体どうしが 4px より近い） */
      const box = tr.map(t => bb(t.body));
      for (let i = 0; i < tr.length; i++) for (let j = i + 1; j < tr.length; j++) {
        const A = box[i], B = box[j]; if (A[1] < B[0] - 4 || B[1] < A[0] - 4 || A[3] < B[2] - 4 || B[3] < A[2] - 4) continue;
        const hit = tr[i].body.some(q => near(tr[j].body, q, 3.5)) || tr[j].body.some(q => near(tr[i].body, q, 3.5));
        if (hit) { const dd = tr[i].dead || tr[j].dead; push(dd ? out.overlapDead : out.overlap, `${T.toFixed(2)} ${tr[i].num}${tr[i].dead ? '回' : ''}${tr[i].held ? '待' : ''}×${tr[j].num}${tr[j].dead ? '回' : ''}${tr[j].held ? '待' : ''} @${tr[i].st}→${tr[i].nx}`); }
      }
      /* 2. ポイント：列車が上にいるときは鎖錠、向きは列車のいる線 */
      for (const pt of P.pts) {
        if (pt.cross || pt.a == null || pt.b == null) continue;
        const yt = pt.y0 + pt.trunk, dx = (pt.side === 'W' ? 1 : -1) * (pt.out ? -1 : 1), on = [];
        const legN = [pt.x + dx * pt.len * 0.5, (yt + pt.y0 + pt.a) / 2], legR = [pt.x + dx * pt.len * 0.5, (yt + pt.y0 + pt.b) / 2];
        for (const t of tr) { if (!near(t.body, [pt.x, yt], 2.5)) continue; const r = near(t.body, legR, 2.5) && !(pt.a === pt.b), n = near(t.body, legN, 2.5); on.push({ t, leg: r && !n ? 'R' : n && !r ? 'N' : '?' }); }
        for (const o of on) { if (o.t.dead) continue;
          if (!pt.lock) push(out.ptLock, `${fmt(T)} ${pt.st}${pt.no} ${o.t.num}`);
          if (o.leg !== '?' && (o.leg === 'R') !== pt.rev) push(out.ptLeg, `${fmt(T)} ${pt.st}${pt.no} ${o.t.num} 列車=${o.leg} ポイント=${pt.rev ? 'R' : 'N'}`); }
        const legs = new Set(on.filter(o => o.leg !== '?').map(o => o.leg)); if (legs.size > 1) push(out.ptFoul, `${fmt(T)} ${pt.st}${pt.no} ${on.map(o => o.t.num + o.leg).join(',')}`);
      }
      /* 3. 赤の信号を越えない（前の時刻で赤だった信号を、同じ線の同じ向きの列車の先頭が越えた） */
      if (prev) for (const t of live) { const q = prev.trains.find(u => u.key === t.key); if (!q || !t.moving) continue;
        for (const s of prev.sig) { if (s.asp !== 0 || s.dir !== t.dir) continue; const yx = yAt(t.body, s.x); if (yx == null || Math.abs(yx - s.trk) > 4) continue;
          if ((q.x - s.x) * t.dir < -0.5 && (t.x - s.x) * t.dir > 0.5) { push(out.red, `${T.toFixed(2)} ${t.num} が赤の${s.kind}（${s.st || ''} ${s.km.toFixed(2)}km）を越えた`); out.redK[s.kind + (s.st || '')] = (out.redK[s.kind + (s.st || '')] || 0) + 1; } } }
      /* 4. 単線区間：中に列車がいれば「使用中」。反対向きの2本が同時にいない */
      const brT = live.filter(t => t.moving && t.y < M - 100);
      for (const u of P.one) { const ins = brT.filter(t => (t.st === u.a && t.nx === u.b) || (t.st === u.b && t.nx === u.a));
        const mid = ins.filter(t => { const xs = t.body.map(q => q[0]); return true; });
        if (mid.length && !u.t) push(out.oneMiss, `${fmt(T)} ${u.a}〜${u.b} ${mid.map(t => t.num)}`);
        if (new Set(mid.map(t => t.dir)).size > 1) push(out.oneHead, `${fmt(T)} ${u.a}〜${u.b} ${mid.map(t => t.num + (t.dir > 0 ? '▶' : '◀'))}`); }
      /* 5. 車両数：地図の上＋車庫・留置線 ＝ 全部の編成。同じ置き場所に2編成がいない */
      const reg = P.sets, onMap = tr.filter(t => !t.synth).length, inDep = reg.filter(s => s.depot).length;
      if (onMap + inDep !== reg.length) push(out.count, `${fmt(T)} 地図${onMap}＋車庫${inDep}≠${reg.length}`);
      const used = {}; for (const s of reg) if (s.depot) { const k = (s.yard || s.home) + ':' + s.slot; if (used[k]) push(out.slot, `${fmt(T)} ${k} ${used[k]} と ${s.id}`); used[k] = s.id; }
      const cap = { C: 28, P: 8, O: 2 }; for (const s of reg) if (s.depot && s.slot >= cap[s.yard || s.home]) push(out.slot, `${fmt(T)} ${s.yard || s.home} の ${s.slot}番（あふれ） over=${JSON.stringify(P.slotOver)}`);
      for (const t of tr) if (t.dead) { const xs = t.body.map(q => q[0]); if (Math.max(...xs) - Math.min(...xs) > 200 * 1.5) push(out.longDead, `${fmt(T)} 回送${t.num}`); }
      if ([270, 330, 420, 720, 1080, 1380, 1500, 1560].some(h => Math.abs(T - h) < step / 2)) out.snap[fmt(T)] = { 地図: tr.filter(t => !t.synth && !t.dead).length, 回送: tr.filter(t => t.dead).length, 車庫など: inDep, 全部: reg.length, 臨時貨物: tr.filter(t => t.synth).length, 赤以外の信号: P.sig.filter(s => s.asp != null && s.asp !== 0).length, 進路: P.routes.length, 鎖錠: P.pts.filter(p => p.lock).length, 反位: P.pts.filter(p => p.rev).length, 鳴る踏切: P.xings.filter(x => x.on).length };
      prev = P;
    }
    for (const k in out) if (Array.isArray(out[k])) out[k] = { n: out[k].n || 0, ex: out[k].slice() };
    return out;
  }, [step]);
  console.log(sc, JSON.stringify(r, null, 1));
  await b.close(); srv.kill();
})();
