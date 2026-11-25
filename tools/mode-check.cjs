/* 2つのモード（運行の記録の手順4・2026-11-25）の確かめ：node tools/mode-check.cjs。はじめて開く・試運転にする・条件を変える・訓練・戻る・試運転のまま日をまたぐ・前の版から、を順に。Playwright が要る */
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require('/opt/npm-tools/node_modules/playwright'); } })();
const { spawn } = require('child_process');
(async () => {
  const port = 8821, srv = spawn('python3', ['-m', 'http.server', String(port)], { cwd: require('path').join(__dirname, '..'), stdio: 'ignore' }); await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch(); const ok = [], bad = [];
  const chk = (c, m) => (c ? ok : bad).push(m);
  /* A：はじめて開く */
  { const ctx = await b.newContext({ viewport: { width: 1300, height: 900 } }), p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.route(/open-meteo|holidays-jp/, r => r.abort());
    await p.goto(`http://localhost:${port}/index.html`); await p.waitForTimeout(4000);
    await p.evaluate(() => { document.querySelectorAll('.away').forEach(e => e.remove()); document.querySelectorAll('.rsv,.ksv,.topv').forEach(e => e.hidden = true); });
    let s = await p.evaluate(() => ({ MODE, LIVE, live: liveBtn.getAttribute('aria-pressed'), test: testBtn.getAttribute('aria-pressed'), evs: COND.evs.length }));
    chk(s.MODE === 'live' && s.LIVE && s.live === 'true' && s.test === 'false' && s.evs === 0, 'はじめては いまの沿線 ' + JSON.stringify(s));
    /* ×60 を押す → 試運転 */
    await p.evaluate(() => { spdMore.open = true; }); await p.click('#speed button[data-v="1"]'); await p.waitForTimeout(300);
    s = await p.evaluate(() => ({ MODE, LIVE, speed, toast: !document.querySelector('#modeToast').hidden, saved: JSON.parse(localStorage.getItem('dia-mode')), liveWx: MLIVE && MLIVE.wx, wx: COND.wx }));
    chk(s.MODE === 'test' && !s.LIVE && Math.abs(s.speed - 1) < 1e-9 && s.toast && s.saved.mode === 'test' && s.saved.live, '速さを変えたら試運転 ' + JSON.stringify(s));
    /* 条件を変える：締めの条件は いまの沿線のまま */
    const wx0 = s.liveWx;
    await p.evaluate(() => { setPane('plan'); }); await p.waitForTimeout(300);
    await p.selectOption('#c-wx', wx0 === 'snow' ? 'sun' : 'snow'); await p.waitForTimeout(600);
    s = await p.evaluate(() => ({ wx: COND.wx, rec: recCond(), away: JSON.parse(localStorage.getItem('dia-away') || 'null'), note: !modeNote.hidden }));
    chk(s.wx !== wx0 && s.rec.wx === wx0 && s.note, '試運転の天気は締めに入らない ' + JSON.stringify(s.rec) + ' 今=' + s.wx);
    /* イベントを選ぶ・事故の訓練 → 地図の記録も訓練 */
    await p.click('#evchips button[data-ev="hanabi"]').catch(() => {}); await p.waitForTimeout(600);
    await p.evaluate(() => { setPane('ctc'); }); await p.waitForTimeout(1500);
    await p.click('#ctcBig'); await p.waitForTimeout(2500);
    s = await p.evaluate(() => { setPane('run'); const r = RunRecord.get(); return { evs: COND.evs.slice(), forced: r && r.forced, big: r && r.big && r.big.name, mrf: MR && MR.rec.forced }; });
    await p.waitForTimeout(800); const s2 = await p.evaluate(() => ({ mrf: MR && MR.rec.forced }));
    chk(s.evs.includes('hanabi') && s.forced && s.big && s2.mrf, '試運転：イベント・訓練が地図にも ' + JSON.stringify(s) + JSON.stringify(s2));
    /* 試運転のあいだ、締めない */
    s = await p.evaluate(() => { const d0 = ENS.day; ENSEN_UI.dayEnd(true); return { d0, d1: ENS.day }; });
    chk(s.d0 === s.d1, '試運転では運行日を締めない ' + JSON.stringify(s));
    /* いまの沿線に戻る */
    await p.click('#liveBtn'); await p.waitForTimeout(1500);
    s = await p.evaluate(() => { const r = RunRecord.get(); return { MODE, LIVE, evs: COND.evs.length, wx: COND.wx, cb: document.querySelector('#ctcBig').checked, forced: r && r.forced, saved: JSON.parse(localStorage.getItem('dia-mode')) }; });
    chk(s.MODE === 'live' && s.LIVE && s.evs === 0 && !s.cb && s.forced === false && s.saved.mode === 'live', '戻ると本当の条件・訓練なし ' + JSON.stringify(s));
    /* 運行日をまたぐ（試運転のまま）→ いまの沿線に戻してから締める。売店の記録は いまの沿線の条件 */
    await p.evaluate(() => { setMode('test', 'btn'); setCond({ ...COND, wx: MLIVE.wx === 'snow' ? 'sun' : 'snow', day: 'hol', evs: ['hanabi'] }); saveCond(); rebuild(); });
    await p.waitForTimeout(500);
    s = await p.evaluate(async () => { const d0 = ENS.day, live = { ...MLIVE }; const seen = []; const de = ENSEN_UI.dayEnd; ENSEN_UI.dayEnd = function () { seen.push({ wx: COND.wx, day: COND.day, evs: COND.evs.length, MODE }); return de.apply(this, arguments); }; await minatoAway.test(1); await new Promise(r => setTimeout(r, 1500)); const h = minatoKiosk.state && minatoKiosk.state.hist; const last = h && h[h.length - 1];
      return { d0, d1: ENS.day, MODE, live: { wx: live.wx, day: live.day }, kc: last && last.cond, evs: COND.evs.length, seen }; });
    chk(s.d1 === s.d0 + 1 && s.MODE === 'live' && s.evs === 0 && s.seen.length === 1 && s.seen[0].wx === s.live.wx && s.seen[0].day === s.live.day && s.seen[0].evs === 0 && s.seen[0].MODE === 'live', '試運転のまま日をまたぐ → いまの沿線の条件で締める ' + JSON.stringify(s));
    chk(!errs.length, 'エラーなし ' + errs.slice(0, 2).join(' / '));
    await p.screenshot({ path: '/tmp/live.png', clip: { x: 0, y: 0, width: 1300, height: 140 } });
    await p.evaluate(() => setMode('test', 'btn')); await p.waitForTimeout(200); await p.screenshot({ path: '/tmp/test.png' });
    await ctx.close(); }
  /* B：前の版で イベントを選んで ×60 で遊んでいた人 → 試運転から */
  { const ctx = await b.newContext(), p = await ctx.newPage(); await p.route(/open-meteo|holidays-jp/, r => r.abort());
    await p.addInitScript(() => { if (!sessionStorage.getItem('s')) { localStorage.setItem('dia-live1', '1'); localStorage.setItem('dia-speed', '1'); localStorage.setItem('dia-cond', JSON.stringify({ day: 'sat', wx: 'rain', season: 'sum', evs: ['hanabi'] })); sessionStorage.setItem('s', '1'); } });
    await p.goto(`http://localhost:${port}/index.html`); await p.waitForTimeout(3500);
    const s = await p.evaluate(() => ({ MODE, evs: COND.evs, live: MLIVE && MLIVE.evs.length }));
    chk(s.MODE === 'test' && s.evs.includes('hanabi') && s.live === 0, '前の版で遊んでいた人は試運転から ' + JSON.stringify(s)); await ctx.close(); }
  console.log('OK', ok.length); ok.forEach(m => console.log(' ○', m.slice(0, 160))); bad.forEach(m => console.log(' ×', m.slice(0, 400)));
  await b.close(); srv.kill();
})();
