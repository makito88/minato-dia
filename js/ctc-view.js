/* 長い指令パネルの画面（docs/ctc-plan.md の段1）。計算は js/ctc-core.js。
   index.html の「指令パネル」のタブで動く。ゲームの計算は読むだけで変えない。
   CtcView.init(env)：env は ST・TYPES・DEPOTNAME・D()・T()・onSiding・nomDwell・evDwell・evName・fmt・speed()・setSpeed()
   CtcView.frame()：画面が見えているときに毎フレーム呼ぶ（中で間引く） */
(function () {
  'use strict';
  const C = window.CtcCore; if (!C) return;
  const Y = C.Y;
  let SX = null, TY2 = null, X = null, SYN = { trips: [], sets: [] }, ALLT = [], EXT = [], FEE = null, pol = 'balance', CMP = null, CMPKEY = null, LISTSRC = [], D2 = null, PX = new Map(), SETS2 = [], ALLHL = [], E = null, host, sc, spacer, cv, ctx, L = null, pxk = 200, sel = null, hits = [], hl = [], hlKey = null, lastDraw = 0, lastList = 0, slowedAt = -1;
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
.ctc-wide{grid-column:span 2}
@media (max-width:900px){.ctc-wide{grid-column:auto}}
.ctc-card{border-left:3px solid #4fd1ff;padding:4px 0 4px 8px!important}
.ctc-card b{color:#fff;font-weight:700}
.ctc-card .lab{display:inline-block;min-width:3.6em;color:#8aa0b4;font-size:11px}
.ctc-bars div{display:flex;align-items:center;gap:6px;font-size:12px;margin:3px 0}
.ctc-bars span.n{min-width:10.5em;color:#b8c8d6}
.ctc-bars i{height:9px;border-radius:3px;display:inline-block}
.ctc-bars em{font-style:normal;font-family:"IBM Plex Mono",monospace;color:#ffd36b}
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
    E = env; SX = C.extST(E.ST); TY2 = Object.assign({}, E.TYPES, C.SYN_TYPES);
    host = document.getElementById('ctcHost'); if (!host) return;
    fetch('data/ctc-extra.json').then(r => r.json()).then(j => { X = j; hlKey = null; lastList = 0; draw(true); }).catch(() => { });
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    host.innerHTML = `<div class="ctc">
  <div class="ctc-bar"><div><h2>指令パネル</h2><div class="sub">線路はキロどおりの縮尺。列車を押すと、その列車の待ちの理由が出ます。駅名を押すと発車標</div></div>
    <span class="ctc-seg" role="group" aria-label="縮尺" id="ctcZoom">${PXK.map(v => `<button type="button" data-v="${v}">1km=${v}px</button>`).join('')}</span>
    <button type="button" id="ctcNext">次の見どころへ ›</button>
    <label><input type="checkbox" id="ctcSlow" checked>見どころで1倍速に</label>
    <label><input type="checkbox" id="ctcFollow">選んだ列車を追う</label>
    <span class="ctc-seg" role="group" aria-label="指令の方針" id="ctcPol">${Object.entries(C.POLICY).map(([k, v]) => `<button type="button" data-p="${k}" title="${v.say}">${v.name}</button>`).join('')}</span>
    <label title="段2：混雑とできごとの小さな遅れを足し、プロの手順で動かした「きょうの実際」。乗客・運賃の計算には返しません"><input type="checkbox" id="ctcRan" checked>きょうの乱れ</label></div>
  <div class="ctc-sc" id="ctcSc"><div id="ctcSp" style="height:1px"></div><canvas id="ctcCv" aria-label="指令パネル。線路と列車"></canvas></div>
  <div class="ctc-leg">${Object.entries(C.REASON).map(([k, r]) => `<span><i style="background:${r.col}"></i>${r.name}</span>`).join('')}
    ${['L', 'R', 'E', 'X', 'Z', 'G'].map(k => `<span><i style="background:${C.TYPE_BODY[k]};border:2px solid ${C.TYPE_COL[k]}"></i>${TY2[k].name}</span>`).join('')}</div>
  <div class="ctc-grid">
    <div class="ctc-box"><h3>予告（これから10分）</h3><ul id="ctcSoon"></ul></div>
    <div class="ctc-box"><h3>無線（いまの判断）</h3><ul id="ctcRadio"></ul></div>
    <div class="ctc-box"><h3>判断のカード</h3><ul id="ctcCards"></ul></div>
    <div class="ctc-box"><h3>きょうの遅れの内訳（いままで）</h3><div id="ctcBars" class="ctc-bars"></div></div>
    <div class="ctc-box ctc-wide"><h3>方針をくらべる（きょう1日・同じ乱れで）</h3><div id="ctcCmp" class="muted">計算中</div></div>
    <div class="ctc-box ctc-wide"><h3>臨時列車・貨物・線路使用料（きょう）</h3><div id="ctcSyn" class="muted">読みこみ中</div></div>
    <div class="ctc-box ctc-wide" id="ctcInfo"><h3>選んだもの</h3><div class="muted">列車か駅名を押してください</div></div>
  </div>
  <div class="ctc-note">予定（ダイヤに入っている待避・接続・行き違い）と、段2の「きょうの乱れ」（混雑・小さなできごと→前の列車との間かく・単線の順番・接続は5分まで待つ・待避の順番の入れかえ・回復運転）。乱れは見せ方の層で、乗客・運賃の計算には返しません。数字は仮。段4：方針（バランス・定時重視・接続重視・売上重視）を選ぶと、接続を待つ上限・入れかえ・回復運転・グループ会社の要望への答えが変わります。段3：県央本線・バス・フェリーとの接続（遅れたら5分まで待つ）、貨物（夜と昼のすいている時間・港貨物ターミナルへ）、イベントの日の臨時列車（県央本線から中央をこえて港・温泉で折り返し）。臨時と貨物は定期列車のすき間に入れ、定期列車のダイヤは変えません。線路使用料だけ経営のタブの収入へ。</div>
</div>`;
    sc = host.querySelector('#ctcSc'); spacer = host.querySelector('#ctcSp'); cv = host.querySelector('#ctcCv'); ctx = cv.getContext('2d');
    host.querySelector('#ctcZoom').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; setZoom(+b.dataset.v); });
    host.querySelector('#ctcNext').addEventListener('click', nextHighlight);
    cv.addEventListener('click', onClick);
    sc.addEventListener('scroll', () => draw(true), { passive: true });
    window.addEventListener('resize', () => draw(true));
    host.addEventListener('click', e => { const b = e.target.closest('button.go'); if (!b) return; const h = LISTSRC[+b.dataset.i]; if (h) focusHl(h); });
    try { const v = localStorage.getItem('dia-ctc-policy'); if (C.POLICY[v]) pol = v; } catch (e) { }
    const polBtn = () => host.querySelectorAll('#ctcPol button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.p === pol)));
    host.querySelector('#ctcPol').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; pol = b.dataset.p; try { localStorage.setItem('dia-ctc-policy', pol); } catch (e2) { } polBtn(); hlKey = null; lastList = 0; draw(true); });
    polBtn();
    host.querySelector('#ctcRan').addEventListener('change', () => { lastList = 0; draw(true); });
    let z = 200; try { z = +localStorage.getItem('dia-ctc-zoom') || 200; } catch (e) { }
    setZoom(PXK.includes(z) ? z : 200, true);
  }

  function setZoom(v, first) {
    const T = E.T(), center = L ? (sc.scrollLeft + sc.clientWidth / 2) / L.pxk : C.Y && 3;
    pxk = v; L = C.layout(SX, pxk); spacer.style.width = L.W + 'px';
    host.querySelectorAll('#ctcZoom button').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.v === v)));
    try { localStorage.setItem('dia-ctc-zoom', String(v)); } catch (e) { }
    sc.scrollLeft = first ? L.xm(-0.6) - 20 : center * L.pxk - sc.clientWidth / 2;
    draw(true); void T;
  }

  function data() { const D = E.D(); return D && D.trips ? D : null; }
  const baseOf = t => (t && t.base) || t;
  const senv = () => ({ ST: SX, dw: E.dw ? E.dw() : 0, evDwell: E.evDwell, crew: X ? X.freight.crew : 2 });
  const onSid = (t, i) => { const b = baseOf(t); return b.synth ? C.synOnSiding(b, i, senv()) : E.onSiding(b, i); };
  const nomD = (t, i) => { const b = baseOf(t); return b.synth ? C.synDwell(b, i, senv()) : E.nomDwell(b, i); };
  function ensureHl(D) {
    const day = E.day ? E.day() : 1, ik = E.incidentK ? E.incidentK() : 1, evs = E.events ? E.events() : [], cond = E.cond ? E.cond() : {};
    const key = D.trips.length + '|' + day + '|' + ik + '|' + (X ? 1 : 0) + '|' + evs.join(',') + '|' + cond.day + cond.wx + '|' + pol;
    if (hlKey === D && D2 && D2.key === key) return;
    hlKey = D;
    SYN = X ? C.synth(Object.assign(senv(), { trips: D.trips, X, events: evs, holiday: cond.day && cond.day !== 'wd', sp: E.sp ? E.sp() : 1, day })) : { trips: [], sets: [] };
    ALLT = D.trips.concat(SYN.trips);
    const henv = { ST: SX, TYPES: TY2, onSiding: onSid, DEPOTNAME: E.DEPOTNAME };
    EXT = X ? C.extConns(D.trips, SYN.trips, { ST: SX, TYPES: TY2, X, day, wx: cond.wx }) : [];
    hl = C.synHighlights(C.highlights(ALLT, D.sets, henv), SYN.trips, henv).concat(EXT).sort((a, b) => a.t - b.t);
    const BOATS = X ? C.boats(D.trips, { X }) : [];
    BOATS.forEach(f => hl.push({ t: f.t - 6, k: 'connFerry', st: f.st, a: f.tr, txt: `港で ${TY2[f.tr.type].name} ${f.tr.num} → ${f.label}（${E.fmt(f.t)}発）に乗りつぎ`, radio: `港駅、${f.tr.num}列車から${f.label}への乗りつぎがあります。` }));
    hl.sort((a, b) => a.t - b.t);
    /* 方針ごとに同じ乱れで動かす（段4）。いまの方針の結果を画面に、ほかの方針は「くらべる」の表に */
    const run = k => C.disrupt(ALLT, hl, { ST: SX, TYPES: TY2, onSiding: onSid, nomDwell: nomD, day, incidentK: ik, ext: EXT, pre: X ? C.synLate(SYN.trips, { X, day }) : null, rule: C.POLICY[k],
      requests: X ? C.requests(D.trips, { ST: SX, TYPES: TY2, X, events: evs, holiday: cond.day && cond.day !== 'wd', policy: k }) : [], boats: BOATS });
    D2 = run(pol); D2.key = key;
    const ck = key.replace(/\|[a-z]+$/, '');
    if (CMPKEY !== ck) { CMPKEY = ck; CMP = null; setTimeout(() => { if (CMPKEY !== ck) return; CMP = {}; for (const k in C.POLICY) CMP[k] = C.policyStats(D.trips, k === pol ? D2 : run(k)); lastList = 0; }, 30); }
    FEE = X ? C.fee(SYN.trips, X, SX) : null;
    PX = new Map(); ALLT.forEach(t => PX.set(t, C.actual(t, D2)));
    SETS2 = D.sets.map(s => Object.assign(Object.create(s), { trips: s.trips.map(t => PX.get(t)) }));
    D2.decisions.forEach(c => { c.txt = c.what + ' → ' + c.dec; });
    ALLHL = hl.filter(h => !D2.swaps.has(h)).concat(D2.decisions).sort((a, b) => a.t - b.t);   /* 入れかえた待避は、予定の見どころから外す */
  }
  const ran = () => host.querySelector('#ctcRan').checked;
  const envCore = D => ({ ST: SX, TYPES: TY2, onSiding: onSid, nomDwell: nomD, evDwell: E.evDwell, evName: E.evName, trips: ALLT.length ? ALLT : D.trips });
  /* 列車の、いまの遅れ（分）。乱れを見ていないときは 0 */
  function lateNow(t, T) { if (!t.base) return 0; const b = t.base; let i = 0; while (i < t.seq.length - 1 && t.dep[i] <= T) i++; const k = Math.max(0, i - 1); return T < t.dep[0] ? t.dep[0] - b.dep[0] : (t.arr[i] > T ? t.dep[k] - b.dep[k] : t.arr[i] - b.arr[i]); }

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
  /* 臨時・貨物の、いまの状態（パネルの外＝県央本線にいるときは出さない） */
  function synNow(s, T) {
    const tr = s.trips, a = tr[0], z = tr[tr.length - 1], end = t => t.arr[t.arr.length - 1];
    if (s.kind === 'G') { const q0 = a.seq[0] === 'Q';
      if (T >= a.dep[0] - (q0 ? 30 : 0) && T <= end(a) + (a.seq[a.seq.length - 1] === 'Q' ? 40 : 0)) return { trip: a, wait: T < a.dep[0] };
      return { depot: true }; }
    if (T < a.dep[0] || T > end(z)) return { depot: true };
    if (T <= end(a)) return { trip: a };
    if (T >= z.dep[0]) return { trip: z };
    if (T < end(a) + 8 || T > z.dep[0] - 10) return { trip: T < end(a) + 8 ? a : z, wait: true };
    return { depot: true, rest: s.rest };
  }
  function depotPt(home, slot) {
    if (home === 'C') { const tr = slot % 14, k = (slot / 14) | 0; return { x: L.xm(-2.15 + k * 0.62) + 8, y: Y.main + 92 + tr * 5.2 }; }
    const tr = slot % 4, k = (slot / 4) | 0; return { x: L.xm(SX.P.km - 1.55 + k * 0.3) + 8, y: Y.main - 78 + tr * 9 };
  }

  /* ---- 線路 ---- */
  function line(pts, col, w, dash) { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.setLineDash(dash || []); ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke(); ctx.setLineDash([]); }
  function loop(x0, x1, y0, y1, col) { const d = Math.min(0.15 * pxk, (x1 - x0) / 4); line([[x0, y0], [x0 + d, y1], [x1 - d, y1], [x1, y0]], col, 2.6); }
  function drawTrack() {
    const ST = SX, xm = L.xm, xb = L.xb, M = Y.main, TR = '#6c8094', SD = '#4f6276', OLD = '#3b4856', OT = '#8a7fb8', S = L.STA * pxk;
    /* 本線（複線） */
    line([[xm(0.35), M - Y.lane], [xm(ST.P.km - 0.35), M - Y.lane]], TR, 3.2);
    line([[xm(0.35), M + Y.lane], [xm(ST.P.km - 0.35), M + Y.lane]], TR, 3.2);
    /* 中央（4線・頭端の西に引上線と車庫） */
    const cx = xm(0);
    C.LANES.C.forEach(o => line([[xm(-0.7), M + o], [cx + S * 0.4, M + o]], TR, 3.2));
    line([[cx + S * 0.4, M + C.LANES.C[4]], [cx + S * 0.6, M + Y.side]], TR, 2.6);   /* 5番線は4番線へ合流 */   /* 西のはしは連絡線と車庫への入出庫線 */
    line([[cx + S * 0.4, M - Y.side], [xm(0.35), M - Y.lane]], TR, 2.6); line([[cx + S * 0.4, M + Y.side], [xm(0.35), M + Y.lane]], TR, 2.6);
    line([[cx + S * 0.55, M - Y.lane], [cx + S * 0.85, M + Y.lane]], SD, 2); line([[cx + S * 0.55, M + Y.lane], [cx + S * 0.85, M - Y.lane]], SD, 2);
    /* 中央車庫（駅の南西）：3・4番線の西のはしから2本の入出庫線 */
    const dTop = M + 86, dBot = dTop + 14 * 5.2 + 6;
    line([[xm(-0.3), M + Y.lane], [xm(-0.55), M + Y.side + 14], [xm(-0.8), dTop + 6]], SD, 2.4);
    line([[xm(-0.3), M + C.LANES.C[4]], [xm(-0.5), M + C.LANES.C[4] + 14], [xm(-0.8), dTop + 30]], SD, 2.4);
    ctx.fillStyle = 'rgba(109,98,80,.25)'; ctx.fillRect(xm(-2.25), dTop, xm(-0.8) - xm(-2.25), dBot - dTop);
    for (let k = 0; k < 14; k++) line([[xm(-2.2), dTop + 6 + k * 5.2], [xm(-0.85), dTop + 6 + k * 5.2]], '#6d6250', 1.2);
    line([[xm(-0.85), dTop + 6], [xm(-0.85), dBot - 6]], SD, 2);
    /* 県央本線（他社線）：西から中央の北側（5・6番線）を通って、北東へ。西のはしで連絡線 */
    const k5 = M - Y.side - 20, k6 = k5 - 16;
    line([[xm(-ML_()), k6], [xm(0.15), k6], [xm(0.6), k6 - 40], [xm(1.15), 4]], OT, 3, [10, 5]);
    line([[xm(-ML_()), k5], [xm(0.3), k5], [xm(0.75), k5 - 40], [xm(1.3), 4]], OT, 3, [10, 5]);
    ctx.fillStyle = 'rgba(138,127,184,.22)'; ctx.fillRect(xm(-0.3), k5 + 3, S * 0.95, 5);
    line([[xm(-0.65), k5], [xm(-0.42), M - Y.side]], '#b59a5a', 2.4, [6, 4]);
    line([[xm(-0.8), k6], [xm(-0.55), M - Y.lane]], '#b59a5a', 2.4, [6, 4]);
    /* 待避のある駅・ふつうの駅 */
    ['S', 'U', 'M', 'K', 'N'].forEach(s => {
      const x = xm(ST[s].km);
      if (ST[s].taihi) { loop(x - S, x + S, M - Y.lane, M - Y.side, TR); loop(x - S, x + S, M + Y.lane, M + Y.side, TR); }
      if (s === 'S' || s === 'N') line([[x + S * 0.6, M + Y.lane], [x + S, M - Y.lane]], SD, 2);
      if (s === 'U') { line([[x + S * 1.2, M - Y.lane], [x + S * 1.6, M + Y.lane]], SD, 2); line([[x + S * 1.2, M + Y.lane], [x + S * 1.6, M - Y.lane]], SD, 2); }
    });
    /* 港（頭端2線・留置線・貨物の臨港線とターミナル） */
    const px = xm(ST.P.km);
    /* 港：頭端4線（docs/track-dia-study.md） */
    C.LANES.P.forEach(o => { const inner = Math.abs(o) === Y.lane; line(inner ? [[xm(ST.P.km - 0.35), M + o], [px + 6, M + o]] : [[px - S * 0.45, M + Math.sign(o) * Y.lane], [px - S * 0.2, M + o], [px + 6, M + o]], TR, 3.2); ctx.fillStyle = '#c96b4e'; ctx.fillRect(px + 6, M + o - 6, 4, 12); });
    line([[px - S * 0.9, M - Y.lane], [px - S * 0.5, M + Y.lane]], SD, 2); line([[px - S * 0.9, M + Y.lane], [px - S * 0.5, M - Y.lane]], SD, 2);
    line([[xm(ST.P.km - 0.75), M - Y.lane], [xm(ST.P.km - 0.95), M - 50]], SD, 2.2);
    for (let k = 0; k < 4; k++) line([[xm(ST.P.km - 1.6), M - 78 + k * 9], [xm(ST.P.km - 0.95), M - 78 + k * 9]], '#6d6250', 1.6);
    line([[xm(ST.P.km - 0.95), M - 50], [xm(ST.P.km - 0.95), M - 78]], SD, 2);
    line([[xm(ST.P.km - 1.3), M + Y.lane], [xm(ST.P.km - 1.0), Y.freight - 10], [xm(ST.P.km - 0.6), Y.freight - 10]], '#b59a5a', 2.4, [6, 4]);
    ctx.fillStyle = 'rgba(181,154,90,.12)'; ctx.fillRect(xm(ST.P.km - 0.6), Y.freight - 20, xm(ST.P.km + 0.6) - xm(ST.P.km - 0.6), 32);
    for (let k = 0; k < 3; k++) line([[xm(ST.P.km - 0.6), Y.freight - 14 + k * 9], [xm(ST.P.km + 0.55), Y.freight - 14 + k * 9]], '#8a7a52', 1.4, [6, 4]);
    /* 温泉支線（単線）：川辺の東で上の段へ */
    const jx1 = xb(L.JUNC1);
    line([[xb(L.JUNC0), M - Y.lane], [xb(L.LV0), M + L.LVY], [xb(L.LV1), M + L.LVY], [jx1, Y.br], [xb(ST.F.bkm) - S, Y.br]], TR, 3.2);
    line([[xb(ST.F.bkm) + S, Y.br], [xb(ST.T.bkm) - S, Y.br]], TR, 3.2);
    line([[xb(ST.T.bkm) + S, Y.br], [xb(ST.O.bkm - L.OS), Y.br]], TR, 3.2);
    line([[xb(L.UP0), M + Y.lane], [xb(L.UP1), M + L.LVY]], TR, 2.6);   /* 上り：下りの本線を平面交差して合流 */
    ['F', 'T'].forEach(s => { const x = xb(ST[s].bkm); loop(x - S, x + S, Y.br, Y.br - Y.brLoop, TR); loop(x - S, x + S, Y.br, Y.br + Y.brLoop, TR); });
    { const x = xb(ST.F.bkm + C.SIGBOX), s2 = S * 0.8;   /* 森下〜峠の交換信号所（計画。まだ列車は使わない） */
      line([[x - s2, Y.br], [x - s2 + 12, Y.br + Y.brLoop + 4], [x + s2 - 12, Y.br + Y.brLoop + 4], [x + s2, Y.br]], '#b59a5a', 2.2, [6, 4]);
      ctx.font = '11px "Zen Kaku Gothic New",sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#c9b27a'; ctx.fillText('交換信号所（計画）', x, Y.br + 34); }
    const ox = xb(ST.O.bkm);
    line([[xb(ST.O.bkm - L.OS), Y.br], [xb(ST.O.bkm - 0.06), Y.br - Y.lane], [ox + 6, Y.br - Y.lane]], TR, 3.2);
    line([[xb(ST.O.bkm - L.OS), Y.br], [xb(ST.O.bkm - 0.06), Y.br + Y.lane], [ox + 6, Y.br + Y.lane]], TR, 3.2);
    ctx.fillStyle = '#c96b4e'; ctx.fillRect(ox + 6, Y.br - Y.lane - 6, 4, 12); ctx.fillRect(ox + 6, Y.br + Y.lane - 6, 4, 12);
    line([[xb(ST.O.bkm - 0.45), Y.br], [xb(ST.O.bkm - 0.62), Y.br + 32], [xb(ST.O.bkm - 1.4), Y.br + 32]], '#b59a5a', 2.2, [6, 4]);   /* 温泉留置線：駅の手前で分かれて西（左）へ */
    /* ラベル（設備） */
    ctx.font = '11px "Zen Kaku Gothic New",sans-serif'; ctx.textAlign = 'left'; ctx.fillStyle = '#8aa0b4';
    ctx.fillText('中央車庫', xm(-2.25), dTop - 6);
    ctx.fillText('港留置線', xm(ST.P.km - 1.6), M - 86);
    ctx.fillStyle = '#a99be0'; ctx.fillText('県央本線（他社線）← 空港・県の西', xm(-ML_()) + 6, k6 - 8);
    ctx.fillText('県央本線 6・7番線', xm(-0.25), k6 - 8);
    ctx.save(); ctx.translate((xm(0.75) + xm(1.3)) / 2 + 22, (k5 - 40 + 4) / 2 + 10); ctx.rotate(Math.atan2(4 - (k5 - 40), xm(1.3) - xm(0.75))); ctx.fillText('→ 北へ（県央北）', 0, 0); ctx.restore();
    ctx.fillStyle = '#c9b27a'; ctx.textAlign = 'right'; ctx.fillText('連絡線（臨時・貨物の直通用）', xm(-0.85), M - Y.side - 6); ctx.textAlign = 'left';
    ctx.fillText('臨港線・港貨物ターミナル', xm(ST.P.km - 0.6), Y.freight + 26);
    ctx.fillText('温泉留置線（臨時列車用）', xb(ST.O.bkm - 1.4), Y.br + 48);
    ctx.fillStyle = '#8aa0b4'; ctx.fillText('温泉支線（単線）', jx1 + 10, Y.br + 22);
  }
  function ML_() { return L.ML - 0.05; }

  function drawStations() {
    const ST = SX; ctx.textAlign = 'center';
    const pill = (x, y, t, s) => {
      ctx.font = '700 15px "Zen Kaku Gothic New",sans-serif'; const w = ctx.measureText(t).width + 16;
      ctx.fillStyle = '#1d4a5a'; ctx.strokeStyle = '#4fd1ff'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x - w / 2, y - 13, w, 24, 6) : ctx.rect(x - w / 2, y - 13, w, 24); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.fillText(t, x, y + 5); hits.push({ x0: x - w / 2, x1: x + w / 2, y0: y - 13, y1: y + 11, st: s });
    };
    const kmTxt = (x, y, k) => { ctx.font = '10.5px "IBM Plex Mono",monospace'; ctx.fillStyle = '#6f8597'; ctx.fillText(k.toFixed(1) + 'km', x, y); };
    C.MAIN.forEach(s => { const x = L.xm(ST[s].km); if (s === 'C') { pill(x, Y.main + 70, ST[s].name, s); kmTxt(x, Y.main + 98, ST[s].km); } else { pill(x, Y.main - 52, ST[s].name, s); kmTxt(x, Y.main + 44, ST[s].km); } });   /* 中央は北に県央本線があるので、駅名を下に */
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
    const isSel = sel && sel.tr === baseOf(tr);
    if (isSel) { ctx.strokeStyle = '#4fd1ff'; ctx.lineWidth = 2; ctx.strokeRect(x0 - 3, y0 - 3, len + 6, h + 6); }
    ctx.globalAlpha = 1;
    hits.push({ x0: x0 - 4, x1: x0 + len + 8, y0: y0 - 6, y1: y0 + h + 6, tr });
    if (dead) return;
    /* 札：種別と番号、停車中で待ちが長いときは理由 */
    const up = p.dir > 0, s0 = tr.seq[p.i], term = !p.moving && (s0 === 'C' || s0 === 'P' || s0 === 'O');
    const ty = term ? p.y + 4 : (up ? y0 - 6 : y0 + h + 14);
    ctx.font = '700 10.5px "Zen Kaku Gothic New",sans-serif'; ctx.textAlign = term ? (s0 === 'C' ? 'left' : 'right') : 'center';
    let tag = TY2[tr.type].short + tr.num, col = '#dbe6f0';
    const late = lateNow(tr, T);
    if (late >= 0.5) { tag += ' 遅れ' + C.fmtMin(late); col = '#ff8a8a'; }
    if (!p.moving && p.i > 0 && p.i < tr.seq.length - 1 && T >= tr.arr[p.i]) {
      const act = (tr.why && tr.why[p.i] || []).filter(x => x.min > 0.05).sort((a, b) => b.min - a.min)[0];
      const r = act || C.reasons(baseOf(tr), p.i, envCore(D))[0];
      if (r) { tag += ' ' + (C.SHORT[r.code] || C.REASON[r.code].name) + ' +' + C.fmtMin(r.min); if (late < 0.5 || act) col = C.REASON[r.code].col; }
    }
    const tx = term ? (s0 === 'C' ? x0 + len + 30 : x0 - 12) : x0 + len / 2;   /* 頭端の駅では、札を横に出して重ならないように */
    ctx.lineWidth = 3; ctx.strokeStyle = '#0d1620'; ctx.strokeText(tag, tx, ty); ctx.fillStyle = col; ctx.fillText(tag, tx, ty);
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
      const SS = ran() ? SETS2 : D.sets;
      SS.forEach(s => { tot[s.home]++; const n = setNow(s, T); if (n.depot) { const q = depotPt(s.home, used[s.home]++); ctx.fillStyle = C.TYPE_BODY[s.trips[0].type]; ctx.fillRect(q.x, q.y - 2, Math.min(0.55 * pxk * (s.home === 'C' ? 1 : 0.5), s.cars * 0.02 * pxk * 0.6), 4); } });
      ctx.font = '700 12px "Zen Kaku Gothic New",sans-serif'; ctx.textAlign = 'left'; ctx.fillStyle = '#dbe6f0';
      ctx.fillText(`${used.C}/${tot.C}編成`, L.xm(-1.45), Y.main + 80); ctx.fillText(`${used.P}/${tot.P}編成`, L.xm(SX.P.km - 1.15), Y.main - 86);
      /* 頭端の駅（中央・港・温泉）で止まっている列車の番線を、重ならないように割りふる */
      /* 留置線で休んでいる臨時列車 */
      SYN.sets.forEach(s => { const n = synNow(s, T); if (!n.rest) return; const q = n.rest === 'O' ? { x: L.xb(SX.O.bkm - 1.3), y: Y.br + 32 } : { x: L.xm(SX.P.km - 2.1), y: Y.main - 51 };
        ctx.fillStyle = C.TYPE_BODY.Z; ctx.fillRect(q.x, q.y - 3, s.cars * 0.02 * pxk * 0.6, 6); ctx.font = '700 10px "Zen Kaku Gothic New",sans-serif'; ctx.textAlign = 'left'; ctx.fillStyle = C.TYPE_COL.Z; ctx.fillText('臨' + s.trips[0].num + ' 休み', q.x, q.y - 6); });
      const states = SS.map(s => [s, setNow(s, T)]).concat(SYN.sets.map(s => { const n = synNow(s, T); if (n.trip && ran()) n.trip = PX.get(n.trip) || n.trip; return [s, n]; })), env = envCore(D);
      env.laneFix = new Map();
      for (const term of ['C', 'P', 'O']) {
        const lanes = term === 'O' ? [-Y.lane, Y.lane] : C.LANES[term], used = new Set(), wait = [];
        states.forEach(([s, n]) => { if (n.depot || n.dead) return; const tr = n.trip, k = tr.seq.length;
          let i = -1; if (tr.seq[0] === term && T < tr.dep[0]) i = 0; else if (tr.seq[k - 1] === term && T >= tr.arr[k - 1]) i = k - 1;
          if (i >= 0) wait.push({ tr, i, t: i === 0 ? (tr.pair ? tr.pair.arr[tr.pair.arr.length - 1] : tr.dep[0] - 30) : tr.arr[k - 1] }); });
        wait.sort((a, b) => a.t - b.t).forEach(w => { let o = C.laneOff(w.tr, w.i, { ST: SX, onSiding: onSid }); if (used.has(o)) o = lanes.find(l => !used.has(l)) ?? o; used.add(o); env.laneFix.set(w.tr, { i: w.i, o }); });
      }
      /* 走っている編成 */
      let selPos = null;
      states.forEach(([s, n]) => {
        if (n.depot) return;
        let p;
        if (n.dead) {
          const tr = n.trip, i = n.out ? 0 : tr.seq.length - 1, f = C.smooth(Math.max(0, Math.min(1, n.f)));
          const q = C.trainPos(tr, n.out ? tr.dep[0] - 0.01 : tr.arr[i] + 0.01, L, env), dp = depotPt(s.home, 0);
          /* 車庫と駅のあいだは、入出庫線の上を通る */
          const via = s.home === 'C' ? [{ x: L.xm(-0.8), y: Y.main + 92 }, { x: L.xm(-0.3), y: Y.main + Y.lane }] : [{ x: L.xm(SX.P.km - 0.95), y: Y.main - 50 }, { x: L.xm(SX.P.km - 0.75), y: Y.main - Y.lane }];
          const path = n.out ? [dp, ...via, q] : [q, ...via.slice().reverse(), dp];
          const seg = path.slice(1).map((b, k) => Math.hypot(b.x - path[k].x, b.y - path[k].y)), tot = seg.reduce((x, y) => x + y, 0) || 1;
          let dd = f * tot, k = 0; while (k < seg.length - 1 && dd > seg[k]) { dd -= seg[k]; k++; }
          const a = path[k], b = path[k + 1], u = seg[k] ? Math.min(1, dd / seg[k]) : 0;
          p = { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, dir: (b.x >= a.x ? 1 : -1), moving: true, i };
          drawTrain(p, tr, true, T, D);
        } else { p = C.trainPos(n.trip, T, L, env); drawTrain(p, n.trip, false, T, D); }
        if (sel && sel.tr === baseOf(n.trip)) selPos = p;
      });
      if (selPos && host.querySelector('#ctcFollow').checked) { const want = selPos.x - w / 2; if (Math.abs(sc.scrollLeft - want) > 40) sc.scrollLeft += (want - sc.scrollLeft) * 0.15; }
      /* 見どころの前で1倍速に */
      if (host.querySelector('#ctcSlow').checked && E.speed() > 1.01) {
        const h = (ran() ? ALLHL : hl).find(h => h.k !== 'depot' && h.t > T && h.t - T < 1.2);
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
    const soon = [], past = [], src = ran() ? ALLHL : hl; LISTSRC = src;
    src.forEach((h, i) => { if (h.t > T && h.t <= T + 10) soon.push([h, i]); else if (h.t <= T && h.t > T - (h.k === 'depot' ? 6 : 60)) past.push([h, i]); });   /* 出入庫は多いので、無線には6分だけ残す */
    const k = h => `<span class="k" style="background:${KCOL[h.k] || (C.REASON[h.k] || {}).col || '#9fb3c4'}">${KNAME[h.k] || (h.k === 'incident' ? 'できごと' : (C.REASON[h.k] || {}).name || '')}</span>`;
    host.querySelector('#ctcSoon').innerHTML = soon.slice(0, 8).map(([h, i]) => `<li><span class="t">あと${Math.max(1, Math.ceil(h.t - T))}分</span>${k(h)}${esc(h.txt)}<button class="go" data-i="${i}">見る</button></li>`).join('') || '<li class="muted">10分以内の見どころはありません</li>';
    host.querySelector('#ctcRadio').innerHTML = past.slice(-8).reverse().map(([h, i]) => `<li><span class="t">${E.fmt(h.t)}</span>${k(h)}${esc(h.radio)}<button class="go" data-i="${i}">見る</button></li>`).join('') || '<li class="muted">まだありません</li>';
    /* 判断のカード（段2） */
    const cards = ran() && D2 ? D2.decisions.filter(c => c.t <= T + 0.01 && c.t > T - 180).slice(-4).reverse() : [];
    host.querySelector('#ctcCards').innerHTML = cards.map(c => `<li class="ctc-card" style="border-color:${(C.REASON[c.k] || {}).col || '#4fd1ff'}"><span class="t">${E.fmt(c.t)}</span>${k(c)}
      <div><span class="lab">起きたこと</span>${esc(c.what)}</div><div><span class="lab">判断</span><b>${esc(c.dec)}</b></div><div><span class="lab">理由</span>${esc(c.why)}</div><div><span class="lab">結果</span>${esc(c.res)}</div>
      <button class="go" data-i="${src.indexOf(c)}">見る</button></li>`).join('') || `<li class="muted">${ran() ? 'まだ判断はありません（3時間以内）' : '「きょうの乱れ」を入れると出ます'}</li>`;
    bars(D, T); synBox(T); cmpBox();
    if (sel) info(D, T);
  }
  function bars(D, T) {
    const box = host.querySelector('#ctcBars');
    if (!ran() || !D2) { box.innerHTML = '<div class="muted">「きょうの乱れ」を入れると出ます</div>'; return; }
    const sum = {}; let done = 0, ontime = 0;
    ALLT.forEach(t => { const a = PX.get(t); if (!a) return; a.seq.forEach((s, i) => { if ((i ? a.arr[i] : a.dep[0]) > T) return; (a.why[i] || []).forEach(w => { sum[w.code] = (sum[w.code] || 0) + w.min; }); });
      if (a.arr[a.arr.length - 1] <= T) { done++; if (a.arr[a.arr.length - 1] - t.arr[t.arr.length - 1] < 1) ontime++; } });
    const ks = Object.keys(sum).filter(k => Math.abs(sum[k]) >= 0.1).sort((a, b) => sum[b] - sum[a]), mx = Math.max(1, ...ks.map(k => Math.abs(sum[k])));
    box.innerHTML = `<div class="muted">着いた列車 ${done}本・定時（遅れ1分未満）${done ? Math.round(ontime / done * 100) : 100}%</div>` + (ks.map(k => `<div><span class="n">${(C.REASON[k] || {}).name || k}</span><i style="width:${Math.round(Math.abs(sum[k]) / mx * 110)}px;background:${(C.REASON[k] || {}).col}"></i><em>${sum[k] < 0 ? '−' : ''}${Math.round(Math.abs(sum[k]))}分</em></div>`).join('') || '<div class="muted">まだ遅れはありません</div>');
  }
  function cmpBox() {
    const box = host.querySelector('#ctcCmp'); if (!box) return;
    if (!CMP) { box.innerHTML = '<div class="muted">計算中</div>'; return; }
    const rows = Object.entries(C.POLICY).map(([k, v]) => { const s = CMP[k]; return `<tr${k === pol ? ' style="background:#1d3a4a"' : ''}><td><b>${v.name}</b>${k === pol ? '（いま）' : ''}</td><td>${Math.round(s.ontime * 100)}%</td><td>${Math.round(s.late)}分</td><td>${s.held}回</td><td>${s.cut}回</td><td>${s.swap}回</td><td>${s.req}件${s.reqNo ? '（ことわる' + s.reqNo + '）' : ''}</td></tr>`; }).join('');
    box.innerHTML = `<div style="overflow-x:auto"><table><tr><th>方針</th><th>定時（遅れ1分未満）</th><th>遅れの合計</th><th>接続を待った</th><th>接続を打ち切った</th><th>順番の入れかえ</th><th>要望を受けた</th></tr>${rows}</table></div>
      <div class="muted" style="margin-top:4px">${C.POLICY[pol].name}：${C.POLICY[pol].say}。同じ日の同じ混雑・できごと・他社線の遅れで、方針だけ変えた結果（定期列車だけ数える）。</div>`;
  }
  function synBox(T) {
    const box = host.querySelector('#ctcSyn'); if (!box) return;
    if (!X) { box.innerHTML = '<div class="muted">data/ctc-extra.json を読めませんでした</div>'; return; }
    const rows = SYN.trips.slice().sort((a, b) => a.dep[0] - b.dep[0]).map(t => { const ax = ran() ? PX.get(t) : t, n = t.seq.length, l = ax.arr[n - 1] - t.arr[n - 1];
      const from = SX[t.seq[0]].name, to = SX[t.seq[n - 1]].name, now = T >= ax.dep[0] && T <= ax.arr[n - 1];
      return `<tr${now ? ' style="background:#1d3a4a"' : ''}><td><span class="k" style="background:${C.TYPE_COL[t.type]}">${t.type === 'G' ? '貨物' : '臨時'}</span>${t.num}</td><td>${t.extra ? esc(t.name) : esc(t.load)}</td><td>${E.fmt(t.dep[0])} ${esc(from)}</td><td>${E.fmt(t.arr[n - 1])} ${esc(to)}${l >= 0.5 ? ` <span style="color:#ff8a8a">+${C.fmtMin(l)}</span>` : ''}</td><td>${t.delay >= 1 ? '待ち' + Math.round(t.delay) + '分' : ''}</td></tr>`; }).join('');
    const ev = (E.events ? E.events() : []).filter(id => X.extra.byEvent[id]);
    box.innerHTML = `<div class="muted">${ev.length ? 'イベントの日：臨時「' + ev.map(id => X.extra.byEvent[id].name).join('」「') + '」' : 'きょうは臨時列車なし（イベントの日に走ります）'}</div>
      <div style="overflow-x:auto"><table><tr><th>列車</th><th>中身</th><th>発</th><th>着</th><th>すき間の待ち</th></tr>${rows || '<tr><td colspan="5" class="muted">なし</td></tr>'}</table></div>
      <div class="muted" style="margin-top:4px">線路使用料（仮）：貨物 ${FEE.km.G.toFixed(1)}km×${X.fee.G.toLocaleString()}円・臨時 ${FEE.km.Z.toFixed(1)}km×${X.fee.Z.toLocaleString()}円 ＝ <b style="color:#ffd36b">${FEE.yen.toLocaleString()}円</b>（経営のタブの収入へ）</div>`;
  }
  function info(D, T) {
    const box = host.querySelector('#ctcInfo'), env = envCore(D);
    if (sel.tr) {
      const tr = sel.tr, ty = TY2[tr.type], dest = SX[tr.seq[tr.seq.length - 1]].name, ax = ran() ? PX.get(tr) : null, last = tr.seq.length - 1;
      const rows = tr.seq.map((s, i) => {
        const r = C.reasons(tr, i, env), pass = !tr.stop[i] && !tr.op[i];
        const t = i === 0 ? '' : E.fmt(tr.arr[i]), d = i === last ? '' : (pass ? 'レ' : E.fmt(tr.dep[i]));
        const at = ax ? (i === last ? ax.arr[i] : ax.dep[i]) : null, lt = ax ? at - (i === last ? tr.arr[i] : tr.dep[i]) : 0;
        const act = ax ? `<td>${pass && i !== last ? 'レ' : E.fmt(at)}${lt >= 0.5 ? ` <span style="color:#ff8a8a">+${C.fmtMin(lt)}</span>` : ''}</td>` : '';
        const why = r.map(x => esc(x.txt)).concat(ax ? (ax.why[i] || []).map(x => `<span style="color:${(C.REASON[x.code] || {}).col}">${esc(x.txt)}${x.min > 0.05 && x.code !== 'crowd' && x.code !== 'incident' ? `（+${C.fmtMin(x.min)}）` : x.code === 'crowd' ? `（+${C.fmtMin(x.min)}）` : ''}</span>`) : []);
        const tt = ax || tr, now = T >= (tt.arr[i] || 0) && T < (tt.dep[i] || 0) ? ' style="background:#1d3a4a"' : '';
        return `<tr${now}><td>${SX[s].name}</td><td>${t}</td><td>${d}</td>${act}<td>${pass ? '' : C.trackNo(tr, i, { ST: SX, onSiding: onSid }) + '番線'}</td><td class="why">${why.join('<br>')}</td></tr>`;
      }).join('');
      const tot = tr.delay > 0.5 ? `この列車の待ちの合計 +${Math.round(tr.delay)}分（ダイヤに入っている待避・接続・間かく）` : '待ちはほとんどありません';
      box.innerHTML = `<h3>${ty.name} ${tr.num} ${dest}行（${tr.cars}両・${tr.set ? esc(tr.set.label) : ''}）</h3><div class="muted">${tot}</div><div style="overflow-x:auto"><table><tr><th>駅</th><th>予定 着</th><th>予定 発</th>${ax ? '<th>実際</th>' : ''}<th>番線</th><th>理由（予定の待ち・きょうの乱れ）</th></tr>${rows}</table></div>`;
    } else if (sel.st) {
      const s = sel.st, deps = [];
      ALLT.forEach(tr => { const i = tr.seq.indexOf(s); if (i < 0 || i === tr.seq.length - 1) return; if (!tr.stop[i]) return; if (tr.dep[i] < T - 0.2) return; deps.push({ tr, i, t: tr.dep[i] }); });
      deps.sort((a, b) => a.t - b.t);
      const side = down => deps.filter(d => d.tr.down === down).slice(0, 5).map(d => { const ax = ran() ? PX.get(d.tr) : null, lt = ax ? ax.dep[d.i] - d.tr.dep[d.i] : 0;
        const aw = ax ? (ax.why[d.i] || []).filter(x => x.min > 0.05).sort((a, b) => b.min - a.min)[0] : null, r = aw || C.reasons(d.tr, d.i, env)[0];
        return `<tr><td class="t">${E.fmt(d.t)}${lt >= 0.5 ? `<br><span style="color:#ff8a8a">遅れ${C.fmtMin(lt)}</span>` : ''}</td><td>${TY2[d.tr.type].name}</td><td>${SX[d.tr.seq[d.tr.seq.length - 1]].name}</td><td>${C.trackNo(d.tr, d.i, { ST: SX, onSiding: onSid })}番線</td><td class="why">${r ? C.REASON[r.code].name + ' ' + C.fmtMin(r.min) : ''}</td></tr>`; }).join('') || '<tr><td class="muted" colspan="5">きょうはもうありません</td></tr>';
      box.innerHTML = `<h3>${SX[s].name}駅 発車標</h3><div style="overflow-x:auto"><table><tr><th colspan="5">${s === 'P' || s === 'O' ? '' : '下り（港・温泉方面）'}</th></tr>${side(true)}<tr><th colspan="5">上り（中央方面）</th></tr>${side(false)}</table></div>`;
    }
  }
  function onClick(e) {
    const r = cv.getBoundingClientRect(), x = e.clientX - r.left + sc.scrollLeft, y = e.clientY - r.top;
    const h = hits.slice().reverse().find(h => x >= h.x0 && x <= h.x1 && y >= h.y0 && y <= h.y1);
    if (!h) return;
    sel = h.tr ? { tr: baseOf(h.tr) } : { st: h.st };
    const D = data(); if (D) info(D, E.T()); draw(true);
  }
  function stX(s) { return C.MAIN.includes(s) || s === 'W' || s === 'Q' ? L.xm(SX[s].km) : L.xb(SX[s].bkm); }
  function focusHl(h) {
    if (h.a) sel = { tr: baseOf(h.a) };
    sc.scrollLeft = stX(h.st) - sc.clientWidth / 2;
    const D = data(); if (D) info(D, E.T()); draw(true);
  }
  function nextHighlight() { const T = E.T(); const h = (ran() ? ALLHL : hl).find(h => h.k !== 'depot' && h.t > T); if (h) focusHl(h); }

  /* 1分以上遅れて着いた列車の割合（経営のタブの満足度に使う）。指令パネルを開いていなくても計算する */
  function lateShare(D) { if (!E || !D || !D.trips) return null; ensureHl(D); let n = 0, late = 0; D.trips.forEach(t => { const a = D2.A.get(t); if (!a) return; n++; if (a.arr[a.arr.length - 1] - t.arr[t.arr.length - 1] >= 1) late++; }); return n ? late / n : null; }
  /* きょうの線路使用料（円・仮）。経営のタブが1日の終わりに読む（橋 ctc-fee-to-keiei） */
  function feeToday(D) { if (!E || !X || !D || !D.trips) return 0; ensureHl(D); return FEE ? FEE.yen : 0; }
  window.CtcView = { init, frame: () => draw(false), redraw: () => draw(true), lateShare, feeToday, syn: () => ({ SYN, EXT, D2 }) };   /* syn：確かめ用（headless） */
})();
