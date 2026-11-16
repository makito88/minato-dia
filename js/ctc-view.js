/* 長い指令パネルの画面（docs/ctc-plan.md の段1）。計算は js/ctc-core.js。
   index.html の「指令パネル」のタブで動く。ゲームの計算は読むだけで変えない。
   CtcView.init(env)：env は ST・TYPES・DEPOTNAME・D()・T()・onSiding・nomDwell・evDwell・evName・fmt・speed()・setSpeed()
   CtcView.frame()：画面が見えているときに毎フレーム呼ぶ（中で間引く） */
(function () {
  'use strict';
  const C = window.CtcCore; if (!C) return;
  const Y = C.Y;
  let E = null, host, sc, spacer, cv, ctx, L = null, pxk = 200, sel = null, hits = [], hl = [], hlKey = null, lastDraw = 0, lastList = 0, slowedAt = -1;
  const PXK = [100, 200, 400];
  const css = `
.ctc{min-width:0;max-width:100%;background:#0d1620;border-radius:14px;color:#dbe6f0;padding:10px 0 12px;font-family:"Zen Kaku Gothic New",system-ui,sans-serif}
.ctc-bar{display:flex;flex-wrap:wrap;gap:6px 12px;align-items:center;padding:0 12px 8px}
.ctc-bar h2{font-size:16px;margin:0;color:#fff}
.ctc-bar .sub{font-size:11.5px;color:#8aa0b4}
.ctc-bar button{font:inherit;font-size:12.5px;color:#dbe6f0;background:#1a2a3a;border:1px solid #2c4256;border-radius:8px;padding:4px 10px;cursor:pointer}
.ctc-bar button[aria-pressed="true"]{background:#2d6f8f;border-color:#4fd1ff;color:#fff}
.ctc-bar label{font-size:12px;color:#b8c8d6;display:inline-flex;gap:4px;align-items:center}
.ctc-seg{display:inline-flex;gap:0}.ctc-seg button{border-radius:0}.ctc-seg button:first-child{border-radius:8px 0 0 8px}.ctc-seg button:last-child{border-radius:0 8px 8px 0}
.ctc-sc{overflow-x:auto;overflow-y:hidden;position:relative;-webkit-overflow-scrolling:touch}
.ctc-sc canvas{position:sticky;left:0;display:block}
.ctc-leg{display:flex;flex-wrap:wrap;gap:4px 12px;padding:6px 12px 0;font-size:11.5px;color:#a9bccb}
.ctc-leg i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:4px;vertical-align:-1px}
.ctc-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;padding:10px 12px 0}
@media (max-width:900px){.ctc-grid{grid-template-columns:1fr}}
.ctc-box{background:#111e2b;border:1px solid #22364a;border-radius:10px;padding:8px 10px;min-width:0}
.ctc-box h3{font-size:13px;margin:0 0 6px;color:#fff}
.ctc-box ul{list-style:none;margin:0;padding:0;font-size:12.5px;line-height:1.55}
.ctc-box li{padding:3px 0;border-bottom:1px dashed #22364a}
.ctc-box li:last-child{border-bottom:0}
.ctc-box .t{font-family:"IBM Plex Mono",ui-monospace,monospace;color:#ffd36b;margin-right:6px}
.ctc-box .k{display:inline-block;font-size:10.5px;border-radius:4px;padding:0 5px;margin-right:5px;color:#0d1620;font-weight:700}
.ctc-box button.go{font:inherit;font-size:11px;margin-left:6px;color:#4fd1ff;background:none;border:1px solid #2c4256;border-radius:6px;padding:0 6px;cursor:pointer}
.ctc-box .muted{color:#8aa0b4;font-size:12px}
.ctc-box table{width:100%;border-collapse:collapse;font-size:12px}
.ctc-box td,.ctc-box th{padding:2px 4px;text-align:left;border-bottom:1px solid #1d2f40;white-space:nowrap}
.ctc-box th{color:#8aa0b4;font-weight:400}
.ctc-box td.why{white-space:normal;color:#f0b44c}
.ctc-note{font-size:11px;color:#6f8597;padding:8px 12px 0}
`;
  const KCOL = { taihi: '#f0b44c', conn: '#5fc6e8', kokan: '#c59cf0', depot: '#9fb3c4' };
  const KNAME = { taihi: '通過待ち', conn: '接続', kokan: '行き違い', depot: '車庫' };

  function init(env) {
    E = env;
    host = document.getElementById('ctcHost'); if (!host) return;
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    host.innerHTML = `<div class="ctc">
  <div class="ctc-bar"><div><h2>指令パネル</h2><div class="sub">線路はキロどおりの縮尺。列車を押すと、その列車の待ちの理由が出ます。駅名を押すと発車標</div></div>
    <span class="ctc-seg" role="group" aria-label="縮尺" id="ctcZoom">${PXK.map(v => `<button type="button" data-v="${v}">1km=${v}px</button>`).join('')}</span>
    <button type="button" id="ctcNext">次の見どころへ ›</button>
    <label><input type="checkbox" id="ctcSlow" checked>見どころで1倍速に</label>
    <label><input type="checkbox" id="ctcFollow">選んだ列車を追う</label></div>
  <div class="ctc-sc" id="ctcSc"><div id="ctcSp" style="height:1px"></div><canvas id="ctcCv" aria-label="指令パネル。線路と列車"></canvas></div>
  <div class="ctc-leg">${Object.entries(C.REASON).map(([k, r]) => `<span><i style="background:${r.col}"></i>${r.name}</span>`).join('')}
    ${['L', 'R', 'E', 'X'].map(k => `<span><i style="background:${C.TYPE_BODY[k]};border:2px solid ${C.TYPE_COL[k]}"></i>${E.TYPES[k].name}</span>`).join('')}</div>
  <div class="ctc-grid">
    <div class="ctc-box"><h3>予告（これから10分）</h3><ul id="ctcSoon"></ul></div>
    <div class="ctc-box"><h3>無線（いまの判断）</h3><ul id="ctcRadio"></ul></div>
    <div class="ctc-box" id="ctcInfo"><h3>選んだもの</h3><div class="muted">列車か駅名を押してください</div></div>
  </div>
  <div class="ctc-note">段1：今のダイヤの中の待避・接続・行き違い・出入庫を見せています。連絡線・港貨物ターミナル・温泉留置線は線路だけ（列車はまだ走りません）。臨時列車・貨物・他社線との接続・遅れの対応は次の段で。</div>
</div>`;
    sc = host.querySelector('#ctcSc'); spacer = host.querySelector('#ctcSp'); cv = host.querySelector('#ctcCv'); ctx = cv.getContext('2d');
    host.querySelector('#ctcZoom').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; setZoom(+b.dataset.v); });
    host.querySelector('#ctcNext').addEventListener('click', nextHighlight);
    cv.addEventListener('click', onClick);
    sc.addEventListener('scroll', () => draw(true), { passive: true });
    window.addEventListener('resize', () => draw(true));
    host.addEventListener('click', e => { const b = e.target.closest('button.go'); if (!b) return; const h = hl[+b.dataset.i]; if (h) focusHl(h); });
    let z = 200; try { z = +localStorage.getItem('dia-ctc-zoom') || 200; } catch (e) { }
    setZoom(PXK.includes(z) ? z : 200, true);
  }

  function setZoom(v, first) {
    const T = E.T(), center = L ? (sc.scrollLeft + sc.clientWidth / 2) / L.pxk : C.Y && 3;
    pxk = v; L = C.layout(E.ST, pxk); spacer.style.width = L.W + 'px';
    host.querySelectorAll('#ctcZoom button').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.v === v)));
    try { localStorage.setItem('dia-ctc-zoom', String(v)); } catch (e) { }
    sc.scrollLeft = first ? L.xm(-0.6) - 20 : center * L.pxk - sc.clientWidth / 2;
    draw(true); void T;
  }

  function data() { const D = E.D(); return D && D.trips ? D : null; }
  function ensureHl(D) {
    if (hlKey === D) return;
    hlKey = D;
    hl = C.highlights(D.trips, D.sets, { ST: E.ST, TYPES: E.TYPES, onSiding: E.onSiding, DEPOTNAME: E.DEPOTNAME });
  }
  const envCore = D => ({ ST: E.ST, TYPES: E.TYPES, onSiding: E.onSiding, nomDwell: E.nomDwell, evDwell: E.evDwell, evName: E.evName, trips: D.trips });

  /* ---- 編成の、いまの状態（車庫・回送・列車） ---- */
  function setNow(s, T) {
    if (C.inDepot(s, T)) return { depot: true };
    const tr0 = s.trips[0], trL = s.trips[s.trips.length - 1];
    if (T < s.first - 1) return { dead: true, out: true, f: (T - (s.first - 8)) / 7, trip: tr0 };
    if (T > trL.arr[trL.arr.length - 1] + 3) return { dead: true, out: false, f: (T - (trL.arr[trL.arr.length - 1] + 3)) / 6, trip: trL };
    for (let k = 0; k < s.trips.length; k++) {
      const tr = s.trips[k];
      if (T < tr.dep[0]) return { trip: tr, wait: true };
      if (T <= tr.arr[tr.arr.length - 1] + (k === s.trips.length - 1 ? 3 : 0)) return { trip: tr };
    }
    return { depot: true };
  }
  function depotPt(home, slot) {
    if (home === 'C') { const tr = slot % 14, k = (slot / 14) | 0; return { x: L.xm(-2.15 + k * 0.62) + 8, y: Y.main - 112 + tr * 5.2 }; }
    const tr = slot % 4, k = (slot / 4) | 0; return { x: L.xm(E.ST.P.km - 1.55 + k * 0.3) + 8, y: Y.main - 78 + tr * 9 };
  }

  /* ---- 線路 ---- */
  function line(pts, col, w, dash) { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.setLineDash(dash || []); ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke(); ctx.setLineDash([]); }
  function loop(x0, x1, y0, y1, col) { const d = Math.min(0.15 * pxk, (x1 - x0) / 4); line([[x0, y0], [x0 + d, y1], [x1 - d, y1], [x1, y0]], col, 2.6); }
  function drawTrack() {
    const ST = E.ST, xm = L.xm, xb = L.xb, M = Y.main, TR = '#6c8094', SD = '#4f6276', OLD = '#3b4856', OT = '#8a7fb8', S = L.STA * pxk;
    /* 本線（複線） */
    line([[xm(0.35), M - Y.lane], [xm(ST.P.km - 0.35), M - Y.lane]], TR, 3.2);
    line([[xm(0.35), M + Y.lane], [xm(ST.P.km - 0.35), M + Y.lane]], TR, 3.2);
    /* 中央（4線・頭端の西に引上線と車庫） */
    const cx = xm(0);
    [-Y.side, -Y.lane, Y.lane, Y.side].forEach(o => line([[xm(-0.3), M + o], [cx + S * 0.4, M + o]], TR, 3.2));
    line([[cx + S * 0.4, M - Y.side], [xm(0.35), M - Y.lane]], TR, 2.6); line([[cx + S * 0.4, M + Y.side], [xm(0.35), M + Y.lane]], TR, 2.6);
    line([[cx + S * 0.55, M - Y.lane], [cx + S * 0.85, M + Y.lane]], SD, 2); line([[cx + S * 0.55, M + Y.lane], [cx + S * 0.85, M - Y.lane]], SD, 2);
    line([[xm(-0.3), M - Y.side], [xm(-0.75), M - Y.side - 30], [xm(-0.8), M - 46]], SD, 2.4);
    /* 中央車庫 */
    ctx.fillStyle = 'rgba(109,98,80,.25)'; ctx.fillRect(xm(-2.25), M - 118, xm(-0.8) - xm(-2.25), 78);
    for (let k = 0; k < 14; k++) line([[xm(-2.2), M - 112 + k * 5.2], [xm(-0.85), M - 112 + k * 5.2]], '#6d6250', 1.2);
    line([[xm(-0.85), M - 46], [xm(-0.85), M - 112]], SD, 2);
    /* 県央本線（他社線）と連絡線 */
    line([[xm(-ML_()), Y.kenou - 8], [xm(1.6), Y.kenou - 8]], OT, 3, [10, 5]);
    line([[xm(-ML_()), Y.kenou + 8], [xm(1.6), Y.kenou + 8]], OT, 3, [10, 5]);
    line([[xm(1.6), Y.kenou - 8], [xm(2.4), Y.kenou - 40]], OT, 3, [10, 5]);
    line([[xm(-0.3), M + Y.side], [xm(-0.9), Y.kenou - 8]], '#b59a5a', 2.4, [6, 4]);
    /* 待避のある駅・ふつうの駅 */
    ['S', 'U', 'M', 'K', 'N'].forEach(s => {
      const x = xm(ST[s].km);
      if (ST[s].taihi) { loop(x - S, x + (s === 'K' ? L.JUNC0 * pxk : S), M - Y.lane, M - Y.side, TR); loop(x - S, x + S, M + Y.lane, M + Y.side, TR); }
      if (s === 'S' || s === 'N') line([[x + S * 0.6, M + Y.lane], [x + S, M - Y.lane]], SD, 2);
      if (s === 'U') { line([[x + S * 1.2, M - Y.lane], [x + S * 1.6, M + Y.lane]], SD, 2); line([[x + S * 1.2, M + Y.lane], [x + S * 1.6, M - Y.lane]], SD, 2); }
    });
    /* 港（頭端2線・留置線・貨物の臨港線とターミナル） */
    const px = xm(ST.P.km);
    line([[xm(ST.P.km - 0.35), M - Y.lane], [px + 6, M - Y.lane]], TR, 3.2); line([[xm(ST.P.km - 0.35), M + Y.lane], [px + 6, M + Y.lane]], TR, 3.2);
    ctx.fillStyle = '#c96b4e'; ctx.fillRect(px + 6, M - Y.lane - 6, 4, 12); ctx.fillRect(px + 6, M + Y.lane - 6, 4, 12);
    line([[px - S * 0.9, M - Y.lane], [px - S * 0.5, M + Y.lane]], SD, 2); line([[px - S * 0.9, M + Y.lane], [px - S * 0.5, M - Y.lane]], SD, 2);
    line([[xm(ST.P.km - 0.75), M - Y.lane], [xm(ST.P.km - 0.95), M - 50]], SD, 2.2);
    for (let k = 0; k < 4; k++) line([[xm(ST.P.km - 1.6), M - 78 + k * 9], [xm(ST.P.km - 0.95), M - 78 + k * 9]], '#6d6250', 1.6);
    line([[xm(ST.P.km - 0.95), M - 50], [xm(ST.P.km - 0.95), M - 78]], SD, 2);
    line([[xm(ST.P.km - 1.3), M + Y.lane], [xm(ST.P.km - 1.0), Y.freight - 10], [xm(ST.P.km - 0.6), Y.freight - 10]], '#b59a5a', 2.4, [6, 4]);
    ctx.fillStyle = 'rgba(181,154,90,.12)'; ctx.fillRect(xm(ST.P.km - 0.6), Y.freight - 20, xm(ST.P.km + 0.6) - xm(ST.P.km - 0.6), 32);
    for (let k = 0; k < 3; k++) line([[xm(ST.P.km - 0.6), Y.freight - 14 + k * 9], [xm(ST.P.km + 0.55), Y.freight - 14 + k * 9]], '#8a7a52', 1.4, [6, 4]);
    /* 温泉支線（単線）：川辺の東で上の段へ */
    const jx0 = xb(L.JUNC0), jx1 = xb(L.JUNC1);
    line([[jx0, M - Y.side], [jx1, Y.br], [xb(ST.F.bkm) - S, Y.br]], TR, 3.2);
    line([[xb(ST.F.bkm) + S, Y.br], [xb(ST.T.bkm) - S, Y.br]], TR, 3.2);
    line([[xb(ST.T.bkm) + S, Y.br], [xb(ST.O.bkm - 0.35), Y.br]], TR, 3.2);
    line([[jx0, M + Y.lane], [jx1, Y.br]], SD, 2.2);
    ['F', 'T'].forEach(s => { const x = xb(ST[s].bkm); loop(x - S, x + S, Y.br, Y.br - Y.brLoop, TR); loop(x - S, x + S, Y.br, Y.br + Y.brLoop, TR); });
    const ox = xb(ST.O.bkm);
    line([[xb(ST.O.bkm - 0.35), Y.br], [ox - S * 0.4, Y.br - Y.lane], [ox + 6, Y.br - Y.lane]], TR, 3.2);
    line([[xb(ST.O.bkm - 0.35), Y.br], [ox - S * 0.4, Y.br + Y.lane], [ox + 6, Y.br + Y.lane]], TR, 3.2);
    ctx.fillStyle = '#c96b4e'; ctx.fillRect(ox + 6, Y.br - Y.lane - 6, 4, 12); ctx.fillRect(ox + 6, Y.br + Y.lane - 6, 4, 12);
    line([[xb(ST.O.bkm - 0.6), Y.br], [xb(ST.O.bkm - 0.75), Y.br + 32], [xb(ST.O.bkm - 0.15), Y.br + 32]], '#b59a5a', 2.2, [6, 4]);
    /* ラベル（設備） */
    ctx.font = '11px "Zen Kaku Gothic New",sans-serif'; ctx.textAlign = 'left'; ctx.fillStyle = '#8aa0b4';
    ctx.fillText('中央車庫', xm(-2.25), M - 124);
    ctx.fillText('港留置線', xm(ST.P.km - 1.6), M - 86);
    ctx.fillStyle = '#a99be0'; ctx.fillText('県央本線（他社線）← 空港・県の西', xm(-ML_()) + 6, Y.kenou + 26);
    ctx.fillText('→ 北へ（県央北）', xm(1.6) + 6, Y.kenou + 26);
    ctx.fillStyle = '#c9b27a'; ctx.textAlign = 'right'; ctx.fillText('連絡線（臨時・貨物の直通用・準備中）→', xm(-0.95), Y.kenou - 14); ctx.textAlign = 'left';
    ctx.fillText('臨港線・港貨物ターミナル（準備中）', xm(ST.P.km - 0.6), Y.freight + 26);
    ctx.fillText('温泉留置線（臨時列車用・準備中）', xb(ST.O.bkm - 0.75), Y.br + 48);
    ctx.fillStyle = '#8aa0b4'; ctx.fillText('温泉支線（単線）', jx1 + 6, Y.br + 22);
  }
  function ML_() { return L.ML - 0.05; }

  function drawStations() {
    const ST = E.ST; ctx.textAlign = 'center';
    const pill = (x, y, t, s) => {
      ctx.font = '700 15px "Zen Kaku Gothic New",sans-serif'; const w = ctx.measureText(t).width + 16;
      ctx.fillStyle = '#1d4a5a'; ctx.strokeStyle = '#4fd1ff'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x - w / 2, y - 13, w, 24, 6) : ctx.rect(x - w / 2, y - 13, w, 24); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.fillText(t, x, y + 5); hits.push({ x0: x - w / 2, x1: x + w / 2, y0: y - 13, y1: y + 11, st: s });
    };
    const kmTxt = (x, y, k) => { ctx.font = '10.5px "IBM Plex Mono",monospace'; ctx.fillStyle = '#6f8597'; ctx.fillText(k.toFixed(1) + 'km', x, y); };
    C.MAIN.forEach(s => { const x = L.xm(ST[s].km); pill(x, Y.main - 52, ST[s].name, s); kmTxt(x, Y.main + 44, ST[s].km); });
    ['F', 'T', 'O'].forEach(s => { const x = L.xb(ST[s].bkm); pill(x, Y.br - 34, ST[s].name, s); kmTxt(x, Y.br + 30, ST[s].bkm); });
    /* キロの目盛り */
    ctx.strokeStyle = '#1d2f40'; ctx.lineWidth = 1; ctx.font = '10px "IBM Plex Mono",monospace'; ctx.fillStyle = '#4f6476';
    for (let k = 0; k <= Math.ceil(ST.P.km); k++) { const x = L.xm(k); ctx.beginPath(); ctx.moveTo(x, L.H - 22); ctx.lineTo(x, L.H - 14); ctx.stroke(); if (k % (pxk >= 200 ? 1 : 2) === 0) ctx.fillText(String(k), x, L.H - 4); }
  }

  /* ---- 列車 ---- */
  function drawTrain(p, tr, dead, T, D) {
    const len = Math.max(10, tr.cars * 0.02 * pxk), h = 8, x0 = p.dir > 0 ? p.x - len : p.x, y0 = p.y - h / 2;
    ctx.globalAlpha = dead ? 0.45 : 1;
    ctx.fillStyle = C.TYPE_BODY[tr.type]; ctx.fillRect(x0, y0, len, h);
    ctx.fillStyle = C.TYPE_COL[tr.type]; ctx.fillRect(x0, y0 + h / 2 - 1, len, 2);
    ctx.fillStyle = '#ffe9a8'; const fx = p.dir > 0 ? x0 + len : x0;
    ctx.beginPath(); ctx.moveTo(fx, y0); ctx.lineTo(fx + 5 * p.dir, p.y); ctx.lineTo(fx, y0 + h); ctx.fill();
    const isSel = sel && sel.tr === tr;
    if (isSel) { ctx.strokeStyle = '#4fd1ff'; ctx.lineWidth = 2; ctx.strokeRect(x0 - 3, y0 - 3, len + 6, h + 6); }
    ctx.globalAlpha = 1;
    hits.push({ x0: x0 - 4, x1: x0 + len + 8, y0: y0 - 6, y1: y0 + h + 6, tr });
    if (dead) return;
    /* 札：種別と番号、停車中で待ちが長いときは理由 */
    const up = p.dir > 0, ty = up ? y0 - 6 : y0 + h + 14;
    ctx.font = '700 10.5px "Zen Kaku Gothic New",sans-serif'; ctx.textAlign = 'center';
    let tag = E.TYPES[tr.type].short + tr.num, col = '#dbe6f0';
    if (!p.moving && p.i > 0 && p.i < tr.seq.length - 1 && T >= tr.arr[p.i]) {
      const r = C.reasons(tr, p.i, envCore(D))[0];
      if (r) { tag += ' +' + C.fmtMin(r.min) + ' ' + C.REASON[r.code].name; col = C.REASON[r.code].col; }
    }
    ctx.lineWidth = 3; ctx.strokeStyle = '#0d1620'; ctx.strokeText(tag, x0 + len / 2, ty); ctx.fillStyle = col; ctx.fillText(tag, x0 + len / 2, ty);
  }

  function draw(force) {
    if (!host || !L || host.offsetParent === null) return;
    const now = performance.now(); if (!force && now - lastDraw < 33) return; lastDraw = now;
    const dpr = Math.min(2, window.devicePixelRatio || 1), w = sc.clientWidth, H = L.H;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(H * dpr); cv.style.width = w + 'px'; cv.style.height = H + 'px'; }
    const ox = sc.scrollLeft;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = '#0d1620'; ctx.fillRect(0, 0, w, H);
    ctx.save(); ctx.translate(-ox, 0); hits = [];
    drawTrack(); drawStations();
    const D = data(), T = E.T();
    if (D) {
      ensureHl(D);
      /* 車庫の編成 */
      const used = { C: 0, P: 0 }, tot = { C: 0, P: 0 };
      D.sets.forEach(s => { tot[s.home]++; const n = setNow(s, T); if (n.depot) { const q = depotPt(s.home, used[s.home]++); ctx.fillStyle = C.TYPE_BODY[s.trips[0].type]; ctx.fillRect(q.x, q.y - 2, Math.min(0.55 * pxk * (s.home === 'C' ? 1 : 0.5), s.cars * 0.02 * pxk * 0.6), 4); } });
      ctx.font = '700 12px "Zen Kaku Gothic New",sans-serif'; ctx.textAlign = 'left'; ctx.fillStyle = '#dbe6f0';
      ctx.fillText(`${used.C}/${tot.C}編成`, L.xm(-1.45), Y.main - 124); ctx.fillText(`${used.P}/${tot.P}編成`, L.xm(E.ST.P.km - 1.15), Y.main - 86);
      /* 頭端の駅（中央・港・温泉）で止まっている列車の番線を、重ならないように割りふる */
      const states = D.sets.map(s => [s, setNow(s, T)]), env = envCore(D);
      env.laneFix = new Map();
      for (const term of ['C', 'P', 'O']) {
        const lanes = term === 'C' ? [-Y.side, -Y.lane, Y.lane, Y.side] : [-Y.lane, Y.lane], used = new Set(), wait = [];
        states.forEach(([s, n]) => { if (n.depot || n.dead) return; const tr = n.trip, k = tr.seq.length;
          let i = -1; if (tr.seq[0] === term && T < tr.dep[0]) i = 0; else if (tr.seq[k - 1] === term && T >= tr.arr[k - 1]) i = k - 1;
          if (i >= 0) wait.push({ tr, i, t: i === 0 ? (tr.pair ? tr.pair.arr[tr.pair.arr.length - 1] : tr.dep[0] - 30) : tr.arr[k - 1] }); });
        wait.sort((a, b) => a.t - b.t).forEach(w => { let o = C.laneOff(w.tr, w.i, { ST: E.ST, onSiding: E.onSiding }); if (used.has(o)) o = lanes.find(l => !used.has(l)) ?? o; used.add(o); env.laneFix.set(w.tr, { i: w.i, o }); });
      }
      /* 走っている編成 */
      let selPos = null;
      states.forEach(([s, n]) => {
        if (n.depot) return;
        let p;
        if (n.dead) {
          const tr = n.trip, i = n.out ? 0 : tr.seq.length - 1, f = C.smooth(Math.max(0, Math.min(1, n.f)));
          const q = C.trainPos(tr, n.out ? tr.dep[0] - 0.01 : tr.arr[i] + 0.01, L, env), dp = depotPt(s.home, 0);
          const a = n.out ? dp : q, b = n.out ? q : dp;
          p = { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, dir: (b.x >= a.x ? 1 : -1), moving: true, i };
          drawTrain(p, tr, true, T, D);
        } else { p = C.trainPos(n.trip, T, L, env); drawTrain(p, n.trip, false, T, D); }
        if (sel && sel.tr === n.trip) selPos = p;
      });
      if (selPos && host.querySelector('#ctcFollow').checked) { const want = selPos.x - w / 2; if (Math.abs(sc.scrollLeft - want) > 40) sc.scrollLeft += (want - sc.scrollLeft) * 0.15; }
      /* 見どころの前で1倍速に */
      if (host.querySelector('#ctcSlow').checked && E.speed() > 1.01) {
        const h = hl.find(h => h.k !== 'depot' && h.t > T && h.t - T < 1.2);
        if (h && slowedAt !== h.t) { slowedAt = h.t; E.setSpeed(1); }
      }
    }
    ctx.restore();
    ctx.font = '700 13px "IBM Plex Mono",monospace'; ctx.textAlign = 'right'; ctx.fillStyle = '#ffd36b'; ctx.fillText(E.fmt(E.T()), w - 10, 18);
    if (D && now - lastList > 500) { lastList = now; lists(D, T); }
  }

  /* ---- 予告・無線・選んだもの ---- */
  const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
  function lists(D, T) {
    const soon = [], past = [];
    hl.forEach((h, i) => { if (h.t > T && h.t <= T + 10) soon.push([h, i]); else if (h.t <= T && h.t > T - (h.k === 'depot' ? 6 : 60)) past.push([h, i]); });   /* 出入庫は多いので、無線には6分だけ残す */
    const k = h => `<span class="k" style="background:${KCOL[h.k]}">${KNAME[h.k]}</span>`;
    host.querySelector('#ctcSoon').innerHTML = soon.slice(0, 8).map(([h, i]) => `<li><span class="t">あと${Math.max(1, Math.ceil(h.t - T))}分</span>${k(h)}${esc(h.txt)}<button class="go" data-i="${i}">見る</button></li>`).join('') || '<li class="muted">10分以内の見どころはありません</li>';
    host.querySelector('#ctcRadio').innerHTML = past.slice(-8).reverse().map(([h, i]) => `<li><span class="t">${E.fmt(h.t)}</span>${k(h)}${esc(h.radio)}<button class="go" data-i="${i}">見る</button></li>`).join('') || '<li class="muted">まだありません</li>';
    if (sel) info(D, T);
  }
  function info(D, T) {
    const box = host.querySelector('#ctcInfo'), env = envCore(D);
    if (sel.tr) {
      const tr = sel.tr, ty = E.TYPES[tr.type], dest = E.ST[tr.seq[tr.seq.length - 1]].name;
      const rows = tr.seq.map((s, i) => {
        const r = C.reasons(tr, i, env), pass = !tr.stop[i] && !tr.op[i];
        const t = i === 0 ? '' : E.fmt(tr.arr[i]), d = i === tr.seq.length - 1 ? '' : (pass ? 'レ' : E.fmt(tr.dep[i]));
        const now = T >= (tr.arr[i] || 0) && T < (tr.dep[i] || 0) ? ' style="background:#1d3a4a"' : '';
        return `<tr${now}><td>${E.ST[s].name}</td><td>${t}</td><td>${d}</td><td>${pass ? '' : C.trackNo(tr, i, { ST: E.ST, onSiding: E.onSiding }) + '番線'}</td><td class="why">${r.map(x => esc(x.txt)).join('<br>')}</td></tr>`;
      }).join('');
      const tot = tr.delay > 0.5 ? `この列車の待ちの合計 +${Math.round(tr.delay)}分（ダイヤに入っている待避・接続・間かく）` : '待ちはほとんどありません';
      box.innerHTML = `<h3>${ty.name} ${tr.num} ${dest}行（${tr.cars}両・${tr.set ? esc(tr.set.label) : ''}）</h3><div class="muted">${tot}</div><div style="overflow-x:auto"><table><tr><th>駅</th><th>着</th><th>発</th><th>番線</th><th>停車が長い理由</th></tr>${rows}</table></div>`;
    } else if (sel.st) {
      const s = sel.st, deps = [];
      D.trips.forEach(tr => { const i = tr.seq.indexOf(s); if (i < 0 || i === tr.seq.length - 1) return; if (!tr.stop[i]) return; if (tr.dep[i] < T - 0.2) return; deps.push({ tr, i, t: tr.dep[i] }); });
      deps.sort((a, b) => a.t - b.t);
      const side = down => deps.filter(d => d.tr.down === down).slice(0, 5).map(d => { const r = C.reasons(d.tr, d.i, env)[0];
        return `<tr><td class="t">${E.fmt(d.t)}</td><td>${E.TYPES[d.tr.type].name}</td><td>${E.ST[d.tr.seq[d.tr.seq.length - 1]].name}</td><td>${C.trackNo(d.tr, d.i, { ST: E.ST, onSiding: E.onSiding })}番線</td><td class="why">${r ? C.REASON[r.code].name + ' ' + C.fmtMin(r.min) : ''}</td></tr>`; }).join('') || '<tr><td class="muted" colspan="5">きょうはもうありません</td></tr>';
      box.innerHTML = `<h3>${E.ST[s].name}駅 発車標</h3><div style="overflow-x:auto"><table><tr><th colspan="5">${s === 'P' || s === 'O' ? '' : '下り（港・温泉方面）'}</th></tr>${side(true)}<tr><th colspan="5">上り（中央方面）</th></tr>${side(false)}</table></div>`;
    }
  }
  function onClick(e) {
    const r = cv.getBoundingClientRect(), x = e.clientX - r.left + sc.scrollLeft, y = e.clientY - r.top;
    const h = hits.slice().reverse().find(h => x >= h.x0 && x <= h.x1 && y >= h.y0 && y <= h.y1);
    if (!h) return;
    sel = h.tr ? { tr: h.tr } : { st: h.st };
    const D = data(); if (D) info(D, E.T()); draw(true);
  }
  function stX(s) { return C.MAIN.includes(s) ? L.xm(E.ST[s].km) : L.xb(E.ST[s].bkm); }
  function focusHl(h) {
    if (h.a) sel = { tr: h.a };
    sc.scrollLeft = stX(h.st) - sc.clientWidth / 2;
    const D = data(); if (D) info(D, E.T()); draw(true);
  }
  function nextHighlight() { const T = E.T(); const h = hl.find(h => h.k !== 'depot' && h.t > T); if (h) focusHl(h); }

  window.CtcView = { init, frame: () => draw(false), redraw: () => draw(true) };
})();
