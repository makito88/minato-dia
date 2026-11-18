/* 長い指令パネルの画面（docs/ctc-plan.md の段1）。計算は js/ctc-core.js。
   index.html の「指令パネル」のタブで動く。ゲームの計算は読むだけで変えない。
   CtcView.init(env)：env は ST・TYPES・DEPOTNAME・D()・T()・onSiding・nomDwell・evDwell・evName・fmt・speed()・setSpeed()
   CtcView.frame()：画面が見えているときに毎フレーム呼ぶ（中で間引く） */
(function () {
  'use strict';
  const C = window.CtcCore; if (!C) return;
  const Y = C.Y;
  let YMAP = null;
  let HS = null, YS = null, YSKEY = null, LAY = null, LAYK = null, SIG = null;
  const layOf = () => { const k = pxk + '|' + (HS ? 1 : 0); if (!LAY || LAYK !== k) { LAY = CtcSignal.build(HS, SX, L, C); LAYK = k; genPoints(LAY); } return LAY; };
  /* 描いた線路から、線が分かれる所をすべて見つけてポイントにする（2026-11-19）。
     中央・港・車庫や留置線のはしご・貨物ターミナル・連絡線など、駅の形の表（haisen）で向きを決めていない所。
     はじめから向きを決めてあるポイント（川辺・森下・峠・温泉・交換信号所・途中の駅）の近くはそのまま */
  function genPoints(lay) {
    const c0 = ctx, oc = document.createElement('canvas'); oc.width = oc.height = 4; let R; ctx = oc.getContext('2d'); REC = [];
    try { drawTrack(); } finally { R = REC; REC = null; ctx = c0; }
    const segs = []; R.forEach((r, li) => { for (let k = 1; k < r.pts.length; k++) segs.push({ li, a: r.pts[k - 1], b: r.pts[k] }); });
    const old = lay.pts.filter(p => p.a != null && p.b != null && !p.gen).map(p => [p.x, p.y0 + p.trunk]), kx = L.xm(SX.K.km), kw = (C.GEO.K.J1 + 0.2) * pxk;
    const seen = [];
    R.forEach(r => r.pts.forEach(J => {
      if (seen.some(n => Math.hypot(n[0] - J[0], n[1] - J[1]) < 2)) return; seen.push(J);
      if (J[0] > kx - kw && J[0] < kx + kw && J[1] > L.Y.br - 30) return;   /* 川辺は決めてある */
      if (old.some(q => Math.hypot(q[0] - J[0], q[1] - J[1]) < 10)) return;
      const dirs = [];
      for (const s of segs) {
        const dx = s.b[0] - s.a[0], dy = s.b[1] - s.a[1], LL = dx * dx + dy * dy || 1, t = ((J[0] - s.a[0]) * dx + (J[1] - s.a[1]) * dy) / LL;
        if (t < -0.01 || t > 1.01 || Math.hypot(s.a[0] + t * dx - J[0], s.a[1] + t * dy - J[1]) > 1.2) continue;
        for (const [to, ok] of [[s.a, t > 0.01], [s.b, t < 0.99]]) { if (!ok) continue; const ex = to[0] - J[0], ey = to[1] - J[1], l = Math.hypot(ex, ey); if (l < 0.5) continue;
          const u = [ex / l, ey / l], d0 = dirs.find(d => d.u[0] * u[0] + d.u[1] * u[1] > 0.999); if (d0) d0.len = Math.min(d0.len, l); else dirs.push({ u, len: l, col: R[s.li].col }); }
      }
      if (dirs.length < 3) return;
      const dot = (a, b) => a.u[0] * b.u[0] + a.u[1] * b.u[1];
      if (dirs.length === 4 && dirs.every(a => dirs.some(b => dot(a, b) < -0.999))) return;   /* ひし形の交差（平面交差）はポイントではない */
      const tk = dirs.find(t => dirs.filter(d => d !== t && dot(d, t) < -0.2).length >= 2); if (!tk) return;
      const legs = dirs.filter(d => d !== tk && dot(d, tk) < -0.2).sort((a, b) => dot(a, tk) - dot(b, tk)), N = legs[0], Rr = legs[1];
      const yard = [N, Rr, tk].some(d => d.col === '#6d6250' || /^#8a7a52|^#b59a5a/.test(d.col));
      const nm = J[1] < L.Y.br + 40 ? null : (() => { let b = null; for (const k of ['C', 'S', 'U', 'M', 'N', 'P']) { if (!SX[k]) continue; const d = Math.abs(L.xm(SX[k].km) - J[0]); if (!b || d < b[1]) b = [k, d]; } return b && b[0]; })();
      const br = J[1] < L.Y.br + 40, st = br ? (() => { let b = null; for (const k of ['F', 'T', 'O']) { const d = Math.abs(L.xb(SX[k].bkm) - J[0]); if (!b || d < b[1]) b = [k, d]; } return b[0]; })() : nm;
      lay.pts.push({ gen: true, st, no: '', what: (SX[st] ? SX[st].name : '') + (yard ? 'の車庫・留置線・ターミナルのポイント' : 'のポイント'), J, uT: tk.u, uN: N.u, uR: Rr.u, lenN: N.len, lenR: Rr.len,
        a: 0, b: 1, trunk: 0, y0: J[1], x: J[0], len: Math.min(N.len, Rr.len), side: 'E', out: false, rule: null, cross: false, br, small: yard });
    }));
  }
  let GST = 'K', GKEY = null, BLOCKHOLD = false, LAG = new Map(), LAGT = null, PLKEY = null, selSig = null, SX = null, TY2 = null, X = null, SYN = { trips: [], sets: [] }, ALLT = [], EXT = [], FEE = null, pol = 'balance', CMP = null, CMPKEY = null, BIG = null, RUNF = null, NAT = null, LISTSRC = [], D2 = null, PX = new Map(), SETS2 = [], ALLHL = [], E = null, host, sc, spacer, cv, ctx, L = null, pxk = 200, sel = null, hits = [], hl = [], hlKey = null, lastDraw = 0, lastList = 0, slowedAt = -1;
  const PXK = [100, 200, 400];
  const css = `
.ctc{min-width:0;max-width:100%;background:#0c1826;border-radius:14px;color:#dbe6f0;padding:10px 0 12px;font-family:"Zen Kaku Gothic New",system-ui,sans-serif}
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
.ctc-gantt{margin:10px 12px 0;background:#0f1d2c;border-radius:10px;padding:8px 8px 6px}.ctc-gh{font-size:12.5px;color:#cfe0f2;display:flex;gap:8px;align-items:center;flex-wrap:wrap}.ctc-gh select{margin-left:auto;background:#0c1826;color:#dbe6f0;border:1px solid #35506c;border-radius:6px;padding:2px 6px}#ctcGantt{width:100%;height:230px;display:block}
`;
  const KCOL = { taihi: '#f0b44c', conn: '#5fc6e8', kokan: '#c59cf0', depot: '#9fb3c4' };
  const KNAME = { taihi: '通過待ち', conn: '接続', kokan: '行き違い', depot: '車庫' };

  function init(env) {
    E = env; SX = C.extST(E.ST); TY2 = Object.assign({}, E.TYPES, C.SYN_TYPES);
    host = document.getElementById('ctcHost'); if (!host) return;
    fetch('data/ctc-extra.json').then(r => r.json()).then(j => { X = j; hlKey = null; lastList = 0; draw(true); }).catch(() => { });
    fetch('data/ctc-haisen.json?v=20261119e').then(r => r.json()).then(j => { HS = j; YS = null; lastList = 0; draw(true); }).catch(() => { });   /* 駅の形・信号・ポイント（2026-11-17） */
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    host.innerHTML = `<div class="ctc">
  <div class="ctc-bar"><div><h2>指令パネル</h2><div class="sub">線路はキロどおりの縮尺。列車を押すと、その列車の待ちの理由が出ます。駅名を押すと発車標</div></div>
    <span class="ctc-seg" role="group" aria-label="縮尺" id="ctcZoom">${PXK.map(v => `<button type="button" data-v="${v}">1km=${v}px</button>`).join('')}</span>
    <button type="button" id="ctcNext">次の見どころへ ›</button>
    <label><input type="checkbox" id="ctcSlow" checked>見どころで1倍速に</label>
    <label><input type="checkbox" id="ctcFollow">選んだ列車を追う</label>
    <span class="ctc-seg" role="group" aria-label="指令の方針" id="ctcPol">${Object.entries(C.POLICY).map(([k, v]) => `<button type="button" data-p="${k}" title="${v.say}">${v.name}</button>`).join('')}</span>
    <label title="段2：混雑とできごとの小さな遅れを足し、プロの手順で動かした「きょうの実際」。乗客・運賃の計算には返しません"><input type="checkbox" id="ctcRan" checked>きょうの乱れ</label>
    <label title="段5：大きな事故（運転見合わせ・振替輸送・運転再開・運休）を、きょう、かならず起こして見る。切ると、運行日ごとの運（約1割）にもどる"><input type="checkbox" id="ctcBig">大きな事故の訓練</label></div>
  <div class="ctc-sc" id="ctcSc"><div id="ctcSp" style="height:1px"></div><canvas id="ctcCv" aria-label="指令パネル。線路と列車"></canvas></div>
  <div class="ctc-leg ctc-leg2"><span><i style="background:#f4f7fb;height:4px;width:18px"></i>進路ができた（白）</span><span><i style="background:#ff3b3b;opacity:.6;height:8px;width:18px"></i>列車がいる区間（赤）</span><span><i style="background:#ff3b3b;border-radius:50%"></i>止まれ <i style="background:#ffcc33;border-radius:50%;margin-left:4px"></i>注意 <i style="background:#3ddc84;border-radius:50%;margin-left:4px"></i>進め</span><span><i style="background:#4fd8ff;height:4px;width:18px"></i>ポイントがつながっている向き（反対側はすき間）　点滅＝転換中　🔒＝鎖錠</span><span><i style="background:none;border-top:2px dashed #f4f7fb;height:0;width:18px"></i>進路を作っているところ（点線）</span><span>▶▶ 単線区間を使っている列車の向き</span><span>入換信号（白い灯がよこ＝止まれ・ななめ＝進んでよい）</span><span>名札の％＝乗車率：<b style="color:#9fe8ff">〜99%</b> <b style="color:#ffe14a">100〜149%</b> <b style="color:#ffb35c">150〜179%</b> <b style="color:#ff7ad9">180%〜</b></span><span class="muted">信号機やポイント（①〜）を押すと、理由が見られます</span></div>
  <div class="ctc-leg">${Object.entries(C.REASON).map(([k, r]) => `<span><i style="background:${r.col}"></i>${r.name}</span>`).join('')}
    ${['L', 'R', 'E', 'X', 'Z', 'G'].map(k => `<span><i style="background:${tyCol({ type: k })};width:18px;height:6px;border-radius:3px"></i>${TY2[k].name}</span>`).join('')}</div>
  <div class="ctc-gantt"><div class="ctc-gh"><b>番線の予定</b>（いつ、どの番線に、どの列車がいるか・前6分〜後24分）<select id="ctcGSt" aria-label="駅をえらぶ"></select></div><svg id="ctcGantt" viewBox="0 0 1000 230" preserveAspectRatio="none"></svg>
    <div class="ctc-note" style="padding-top:2px">同じ行にならんだ2本が重なっている所が「待ち合わせ」。いちばん下は単線区間（1本ずつしか入れない）。帯の色は種別。白い線がいま。</div></div>
  <div class="ctc-grid">
    <div class="ctc-box"><h3>予告（これから10分）</h3><ul id="ctcSoon"></ul></div>
    <div class="ctc-box"><h3>無線（いまの判断）</h3><ul id="ctcRadio"></ul></div>
    <div class="ctc-box"><h3>判断のカード</h3><ul id="ctcCards"></ul></div>
    <div class="ctc-box"><h3>きょうの遅れの内訳（いままで）</h3><div id="ctcBars" class="ctc-bars"></div></div>
    <div class="ctc-box ctc-wide"><h3>方針をくらべる（きょう1日・同じ乱れで）</h3><div id="ctcCmp" class="muted">計算中</div></div>
    <div class="ctc-box ctc-wide"><h3>臨時列車・貨物・線路使用料（きょう）</h3><div id="ctcSyn" class="muted">読みこみ中</div></div>
    <div class="ctc-box ctc-wide" id="ctcInfo"><h3>選んだもの</h3><div class="muted">列車か駅名を押してください</div></div>
  </div>
  <div class="ctc-note">予定（ダイヤに入っている待避・接続・行き違い）と、段2の「きょうの乱れ」（混雑・小さなできごと→前の列車との間かく・単線の順番・接続は5分まで待つ・待避の順番の入れかえ・回復運転）。乱れは見せ方の層で、乗客・運賃の計算には返しません。数字は仮。段5：大きな事故（運行日ごとに約1割。「大きな事故の訓練」でいつでも）は、その区間の運転を見合わせ、ほかの列車は手前の駅で待ち、振替輸送・運転再開・運休（1往復を休んで定時に戻す）まで。折り返し運転はまだ。段4：方針（バランス・定時重視・接続重視・売上重視）を選ぶと、接続を待つ上限・入れかえ・回復運転・グループ会社の要望への答えが変わります。段3：県央本線・バス・フェリーとの接続（遅れたら5分まで待つ）、貨物（夜と昼のすいている時間・港貨物ターミナルへ）、イベントの日の臨時列車（県央本線から中央をこえて港・温泉で折り返し）。臨時と貨物は定期列車のすき間に入れ、定期列車のダイヤは変えません。線路使用料だけ経営のタブの収入へ。</div>
</div>`;
    { const sel = host.querySelector('#ctcGSt'); sel.innerHTML = ['C', 'S', 'U', 'M', 'K', 'N', 'P', 'F', 'T', 'O'].map(k => `<option value="${k}"${k === 'K' ? ' selected' : ''}>${k}</option>`).join(''); sel.addEventListener('change', () => { GST = sel.value; GKEY = null; draw(true); }); }
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
    host.querySelector('#ctcBig').addEventListener('change', () => { hlKey = null; lastList = 0; draw(true); const b = BIG; if (b && host.querySelector('#ctcBig').checked) { sc.scrollLeft = stX(b.a) - sc.clientWidth / 2; } });
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
    const key = D.trips.length + '|' + day + '|' + ik + '|' + (X ? 1 : 0) + '|' + evs.join(',') + '|' + cond.day + cond.wx + '|' + (host.querySelector('#ctcBig').checked ? 'B' : 'b') + '|' + pol;
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
    const force = host.querySelector('#ctcBig').checked; NAT = C.bigIncident(D.trips, { day, incidentK: ik });
    BIG = force ? C.bigIncident(D.trips, { day, incidentK: ik, force: true }) : NAT;
    const run = (k, big) => C.disrupt(ALLT, hl, { big: big === undefined ? BIG : big, ST: SX, TYPES: TY2, onSiding: onSid, nomDwell: nomD, day, incidentK: ik, ext: EXT, pre: X ? C.synLate(SYN.trips, { X, day }) : null, rule: C.POLICY[k],
      requests: X ? C.requests(D.trips, { ST: SX, TYPES: TY2, X, events: evs, holiday: cond.day && cond.day !== 'wd', policy: k }) : [], boats: BOATS });
    D2 = run(pol); D2.key = key; RUNF = force ? () => run(pol, NAT) : null;
    const ck = key.replace(/\|[a-z]+$/, '');
    if (CMPKEY !== ck) { CMPKEY = ck; CMP = null; setTimeout(() => { if (CMPKEY !== ck) return; CMP = {}; for (const k in C.POLICY) CMP[k] = C.policyStats(D.trips, k === pol ? D2 : run(k)); lastList = 0; }, 30); }
    FEE = X ? C.fee(SYN.trips, X, SX) : null;
    PX = new Map(); ALLT.forEach(t => PX.set(t, C.actual(t, D2)));
    /* ホームの長さ＝その駅に止まるいちばん長い編成（臨時・貨物も）。駅の形・信号の位置はここから（2026-11-18） */
    { const PL = {}; ALLT.forEach(t => t.seq.forEach((st, i) => { if (!C.GEO[st]) return; if (i === 0 || i === t.seq.length - 1 || t.stop[i]) PL[st] = Math.max(PL[st] || 0, (t.cars || 6) * 0.02); }));
      ALLT.forEach(t => { for (let i = 0; i < t.seq.length - 1; i++) { const u = t.seq[i] + t.seq[i + 1]; if (u === 'FT' || u === 'TF') PL.X = Math.max(PL.X || 0, (t.cars || 6) * 0.02); } });   /* 交換信号所の行き違い線は、通るいちばん長い編成が入る長さ */
      const k = JSON.stringify(PL); if (k !== PLKEY) { PLKEY = k; C.setPL(PL); LAY = null; YS = null; } }
    if (BIG) { const px = PX.get(BIG.tr); if (px) px.hold = { i: BIG.i, f: BIG.f, dur: BIG.dur, run: BIG.tr.arr[BIG.i + 1] - BIG.tr.dep[BIG.i] }; }
    SETS2 = D.sets.map(s => Object.assign(Object.create(s), { trips: s.trips.map(t => PX.get(t)).filter(t => !t.cancel) }));   /* 運休の列車は走らせない（編成は車庫のある駅で待つ） */
    D2.decisions.forEach(c => { c.txt = c.what + ' → ' + c.dec; });
    ALLHL = hl.filter(h => !D2.swaps.has(h)).concat(D2.decisions).sort((a, b) => a.t - b.t);   /* 入れかえた待避は、予定の見どころから外す */
  }
  const ran = () => host.querySelector('#ctcRan').checked;
  /* 配線の層（C.yard）：同じ番線に2本が入らないように番線を割りふった、見せるための編成。駅の形が読めるまでは前のまま */
  function yardSets(D) {
    const r = ran(), k = (r ? 'r' : 'p') + (D2 && D2.key) + (HS ? 1 : 0);
    if (YS && YSKEY === k) return YS;
    const reg = r ? SETS2 : D.sets, syn = SYN.sets.map(s => Object.assign(Object.create(s), { trips: s.trips.map(t => (r && PX.get(t)) || t) }));
    if (!HS) { YS = { reg, syn }; YSKEY = k; return YS; }
    const Y2 = C.yard(reg.concat(syn), { ST: SX, hs: HS, onSiding: onSid });
    const wrap = s => Object.assign(Object.create(s), { trips: s.trips.map(t => Y2.map.get(t) || t), rests: (Y2.rests.get(s) || []).map(r => Object.assign({}, r, { after: Y2.map.get(r.after) || r.after })) });
    YS = { reg: reg.map(wrap), syn: syn.map(wrap) }; YSKEY = k; YMAP = new Map(); Y2.map.forEach(v => YMAP.set(baseOf(v.yardOf), v)); return YS;
  }
  /* 発車標・列車の表の番線：配線の層で決めた番線（駅の形の番号） */
  const trackOf = (tr, i) => { const y = YMAP && YMAP.get(baseOf(tr)); return C.trackNo(y || tr, i, { ST: SX, hs: HS, onSiding: onSid }); };
  const restAt = (s, T) => (s.rests || []).find(r => T >= r.t0 && T <= r.t1);
  const envCore = D => ({ ST: SX, hs: HS, TYPES: TY2, onSiding: onSid, nomDwell: nomD, evDwell: E.evDwell, evName: E.evName, trips: ALLT.length ? ALLT : D.trips });
  /* 列車の、いまの遅れ（分）。乱れを見ていないときは 0 */
  function lateNow(t, T) { if (!t.base) return 0; const b = t.base; let i = 0; while (i < t.seq.length - 1 && t.dep[i] <= T) i++; const k = Math.max(0, i - 1); return T < t.dep[0] ? t.dep[0] - b.dep[0] : (t.arr[i] > T ? t.dep[k] - b.dep[k] : t.arr[i] - b.arr[i]); }

  /* ---- 編成の、いまの状態（車庫・回送・列車） ---- */
  function setNow(s, T) {
    if (C.inDepot(s, T) || !s.trips.length) return { depot: true };
    { const r = restAt(s, T); if (r) return restNow(s, r, T); }
    const tr0 = s.trips[0], trL = s.trips[s.trips.length - 1];
    { const ld = C.lead0(s); if (T < s.first - ld) return { dead: true, out: true, f: (T - (s.first - ld - 7)) / 7, trip: tr0 }; }
    if (T > trL.arr[trL.arr.length - 1] + 3) return { dead: true, out: false, f: (T - (trL.arr[trL.arr.length - 1] + 3)) / 6, trip: trL };
    for (let k = 0; k < s.trips.length; k++) {
      const tr = s.trips[k];
      if (T < tr.dep[0]) { const pv = k > 0 && s.trips[k - 1], r = pv && (s.rests || []).find(x => x.after === pv); if (r && T < r.t0) return { trip: pv }; return { trip: tr, wait: true }; }   /* 休む前の数分は、着いた番線にいる */
      if (T <= tr.arr[tr.arr.length - 1] + (k === s.trips.length - 1 ? 3 : 0)) return { trip: tr };
    }
    return { depot: true };
  }
  /* 臨時・貨物の、いまの状態（パネルの外＝県央本線にいるときは出さない） */
  /* 頭端の駅で休む編成：はじめの4分で車庫・留置線へ、おわりの4分でホームへ */
  function restNow(s, r, T) {
    const nx = s.trips[s.trips.indexOf(r.after) + 1] || r.after;
    if (T < r.t0 + 4) return { dead: true, out: false, f: (T - r.t0) / 4, trip: r.after, yard: r.at };
    if (T > r.t1 - 4) return { dead: true, out: true, f: 1 - (r.t1 - T) / 4, trip: nx, yard: r.at };
    return { depot: true, yard: r.at };
  }
  function synNow(s, T) {
    { const r = restAt(s, T); if (r) { const q = restNow(s, r, T); if (q.depot) q.rest = r.at; return q; } }
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
  /* 車庫・留置線の置き場所：編成ごとに決まった線（slot）。x は止まる編成の西のはし（km）、y は線の高さ */
  function depotPt(home, slot) {
    const YG = C.yardGeo();
    if (home === 'C') { const t = slot % 14, k = Math.min(1, (slot / 14) | 0); return { t, x: L.xm(YG.C.park[k]), y: YG.C.tracks[t].y }; }
    if (home === 'O') { const k = slot % 2; return { t: 0, x: L.xb(SX.O.bkm + YG.O.park[k]), y: YG.O.tracks[0].y }; }
    const t = slot % 4, k = Math.min(1, (slot / 4) | 0); return { t, x: L.xm(SX.P.km + YG.P.park[k]), y: YG.P.tracks[t].y };
  }
  /* 車庫・留置線から駅の番線（q）までの通り道（車庫の側から）。はしご・入出庫線・西のはしご・扇形に分かれる線の上だけを通る */
  function yardPath(at, dp, len, q) {
    const YG = C.yardGeo(), M = Y.main, PER = C.PER, G = C.GEO, P = [], add = (x, y) => P.push({ x, y }), xm = L.xm, xb = L.xb;
    add(dp.x + len, dp.y);
    if (at === 'C') {
      const t = YG.C.tracks[dp.t], lad = YG.C.ladder[t.lad], ld = YG.C.lead[t.lad];
      add(xm(t.jx), t.y); add(xm(lad[0][0]), lad[0][1]); add(xm(ld[1][0]), ld[1][1]);
      const lane = ld[1][1], xw = y => -0.03 - (y - (M - Y.side)) * PER;
      if (Math.abs(q.y - lane) > 1) { add(xm(xw(lane)), lane); add(xm(xw(q.y)), q.y); }
    } else if (at === 'P') {
      const k = SX.P.km, t = YG.P.tracks[dp.t], g = G.P, base = q.y < M ? M - Y.lane : M + Y.lane;
      add(xm(k + t.jx), t.y); add(xm(k + YG.P.lead[0][0]), M - Y.lane);
      if (q.y > M) { add(xm(k - g.cross[1]), M - Y.lane); add(xm(k - g.cross[0]), M + Y.lane); }
      if (Math.abs(q.y - base) > 1) { add(xm(k - g.d0 - Math.abs(q.y - base) / (2 * Y.lane) * C.STEP), base); add(xm(k - g.d0), q.y); }
    } else {
      const k = SX.O.bkm, O = YG.O, g = G.O;
      add(xb(k + O.lead[1][0]), O.lead[1][1]); add(xb(k + O.lead[0][0]), O.lead[0][1]); add(xb(k - g.d0 - C.STEP / 2), Y.br); add(xb(k - g.d0), q.y);
    }
    P.push({ x: q.x, y: q.y });
    /* 折り返す入換（2026-11-19）：向きが逆になる所では、編成がポイントを通りこして全部ぬけてから、もどる（車体がポイントの上で折れ曲がらないように） */
    for (let k = 1; k < P.length - 1; k++) { const a = P[k - 1], v = P[k], b = P[k + 1], ux = v.x - a.x, uy = v.y - a.y, wx = b.x - v.x, wy = b.y - v.y, lu = Math.hypot(ux, uy), lw = Math.hypot(wx, wy);
      if (lu < 0.5 || lw < 0.5 || (ux * wx + uy * wy) / (lu * lw) > -0.2) continue;
      /* 通りこす向きは、ポイントのまっすぐな側（線路の続き）：来た向きのまま か 出ていく向きの反対 の、水平に近いほう */
      const ov = len + 6, d1 = [ux / lu, uy / lu], d2 = [-wx / lw, -wy / lw], d = Math.abs(d1[1]) <= Math.abs(d2[1]) ? d1 : d2;
      P.splice(k + 1, 0, { x: v.x + d[0] * ov, y: v.y + d[1] * ov, rev: true }, { x: v.x, y: v.y }); k += 2; }
    return P;
  }
  /* 車庫・留置線の置き場所の割りふり（2026-11-18 点検で作りなおし）：編成が車庫・留置線にいるあいだ（出入りの回送も入れて）を区間にして、
     始まる時刻の順に、あいている置き場所のいちばん若い番号へ。同じ時刻に同じ置き場所へ2編成が入らない。いるあいだは同じ番号のまま */
  let SLOT = null, SLOTKEY = null, SLOTOVER = {};
  function buildSlots(Y3) {
    const iv = { C: [], P: [], O: [] }, endOf = t => t.arr[t.arr.length - 1];
    Y3.reg.forEach(s => { if (!s.trips.length) return; const h = s.home, a = s.trips[0], z = s.trips[s.trips.length - 1];
      if (iv[h]) { iv[h].push({ s, t0: -1e9, t1: a.dep[0] - 1 }); iv[h].push({ s, t0: endOf(z) + 3, t1: 1e9 }); }
      (s.rests || []).forEach(r => iv[r.at] && iv[r.at].push({ s, t0: r.t0, t1: r.t1 })); });
    Y3.syn.forEach(s => { if (!s.rest || !iv[s.rest] || s.trips.length < 2) return; const a = s.trips[0], z = s.trips[s.trips.length - 1]; iv[s.rest].push({ s, t0: endOf(a), t1: z.dep[0] }); });
    const cap = { C: 28, P: 8, O: 2 }; SLOTOVER = {};
    for (const k in iv) { const L2 = iv[k].sort((x, y) => x.t0 - y.t0), busy = [];
      for (const v of L2) { let j = busy.findIndex(e => e < v.t0 - 0.01); if (j < 0) { j = busy.length; busy.push(0); } busy[j] = v.t1; v.slot = j; if (j >= cap[k]) SLOTOVER[k] = Math.max(SLOTOVER[k] || 0, j + 1); } }
    return iv;
  }
  function slotOf(s, at, T) {
    const Y3 = YS; if (!Y3) return 0; if (SLOTKEY !== Y3) { SLOT = buildSlots(Y3); SLOTKEY = Y3; }
    const L2 = (SLOT[at] || []).filter(v => v.s === s || v.s === s.base || (s.base && v.s.base === s.base)); if (!L2.length) return 0;
    const v = L2.find(v => T >= v.t0 - 0.01 && T <= v.t1 + 0.01) || L2.reduce((a, b) => Math.min(Math.abs(T - a.t0), Math.abs(T - a.t1)) < Math.min(Math.abs(T - b.t0), Math.abs(T - b.t1)) ? a : b);
    return v.slot;
  }

  /* ---- 線路 ---- */
  let REC = null;   /* 確かめ用：描いた線路の折れ線を集める */
  function line(pts, col, w, dash) { if (REC) REC.push({ pts: pts.map(p => [p[0], p[1]]), col, w, dash: !!(dash && dash.length) }); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.setLineDash(dash || []); ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke(); ctx.setLineDash([]); }
  function loop(x0, x1, y0, y1, col) { const d = Math.min(0.15 * pxk, (x1 - x0) / 4); line([[x0, y0], [x0 + d, y1], [x1 - d, y1], [x1, y0]], col, 2.6); }
  function drawTrack() {
    const ST = SX, xm = L.xm, xb = L.xb, M = Y.main, TR = '#4a5d72', SD = '#3f5268', OLD = '#3b4856', OT = '#8a7fb8', S = L.STA * pxk;
    /* 線路はどこも同じ傾き（番線のあいだ 28px を C.STEP km で）。駅の形は C.GEO（止まるいちばん長い編成から）、車庫などは C.yardGeo()（2026-11-18） */
    const G = C.GEO, STP = C.STEP, K = C.LINK, YG = C.yardGeo(), P2 = (P, col, w, d) => line(P.map(([k, y]) => [xm(k), y]), col, w, d), asc = P => P.slice().sort((p, q) => p[0] - q[0]);
    const buf = (x, y, side) => { ctx.fillStyle = '#c96b4e'; ctx.fillRect(side > 0 ? x : x - 4, y - 6, 4, 12); };   /* 車止め */
    const fl = o => Math.abs(o - (o < 0 ? -Y.lane : Y.lane)) / (2 * Y.lane) * STP;
    /* 本線（複線）：中央の西のはしから港の車止めまで */
    line([[xm(-0.7), M - Y.lane], [xm(ST.P.km) + 6, M - Y.lane]], TR, 3.2); line([[xm(-0.7), M + Y.lane], [xm(ST.P.km) + 6, M + Y.lane]], TR, 3.2);
    /* 中央（5線・頭端）：東で本線へ。西は引上線（2〜4番線）・はしご・車庫・県央本線との連絡線 */
    { const g = G.C;
      C.LANES.C.forEach((o, j) => { if (o === -Y.lane || o === Y.lane) return; const w0 = j === 0 ? K.inW[2][0] : -0.7; line([[xm(w0), M + o], [xm(g.d0), M + o], [xm(g.d0 + fl(o)), M + (o < 0 ? -Y.lane : Y.lane)]], TR, 3.2); });
      [1, 2, 3].forEach(j => buf(xm(-0.7), M + C.LANES.C[j], -1));
      line([[xm(g.cross[0]), M - Y.lane], [xm(g.cross[1]), M + Y.lane]], SD, 2); line([[xm(g.cross[0]), M + Y.lane], [xm(g.cross[1]), M - Y.lane]], SD, 2);
      P2(YG.C.west, SD, 2.2); }
    /* 県央本線との連絡線（乗り入れの列車だけ）：入り（北）・出（南）・県央北 */
    P2(K.inW.slice(1), TR, 2.8); P2(K.in2, SD, 2); P2(asc(K.outW).slice(1), TR, 2.8); P2(K.north, TR, 2.8);
    /* 中央車庫（駅の南西）：3番線と5番線から入出庫線、はしご2本で14本すべての奥まで */
    const dTop = M + Y.dep, dBot = YG.C.tracks[13].y + 6;
    ctx.fillStyle = 'rgba(109,98,80,.18)'; ctx.fillRect(xm(-2.25), dTop, xm(-0.6) - xm(-2.25), dBot - dTop);
    YG.C.lead.forEach(Ld => P2(Ld, SD, 2.4)); YG.C.ladder.forEach(Ld => P2(Ld, SD, 2.2)); P2(YG.C.xover, SD, 1.8);
    YG.C.tracks.forEach(t => { line([[xm(YG.C.x0), t.y], [xm(t.jx), t.y]], '#6d6250', 1.6); buf(xm(YG.C.x0), t.y, -1); });
    /* 県央本線（他社線）：西から中央の北側（6・7番線）を通って、北東へ。ふだんの列車はこの線だけを使う */
    const k5 = C.YK5, k6 = C.YK6;
    line([[xm(-ML_()), k6], [xm(0.15), k6], [xm(0.6), k6 - 40], [xm(1.15), 4]], OT, 3, [10, 5]);
    line([[xm(-ML_()), k5], [xm(0.3), k5], [xm(0.75), k5 - 40], [xm(1.3), 4]], OT, 3, [10, 5]);
    ctx.fillStyle = 'rgba(138,127,184,.22)'; ctx.fillRect(xm(-0.3), k5 + 3, S * 0.95, 5);
    /* 途中の駅：外側の番線（待避線）と渡り線。どこも同じ傾き */
    ['S', 'U', 'M', 'N'].forEach(s => {
      const k = ST[s].km, g = G[s], hs = HS && HS.stations[s];
      (hs && hs.loops || []).forEach(([a, b]) => { const o = C.LCODE[b], m = C.LCODE[a], f = fl(o);
        line([[xm(k - g.d0 - f), M + m], [xm(k - g.d0), M + o], [xm(k + g.d0), M + o], [xm(k + g.d0 + f), M + m]], TR, 2.8); });
      if (g.cross) { line([[xm(k + g.cross[0]), M + Y.lane], [xm(k + g.cross[1]), M - Y.lane]], SD, 2); if (s === 'U') line([[xm(k + g.cross[0]), M - Y.lane], [xm(k + g.cross[1]), M + Y.lane]], SD, 2); }
    });
    /* 川辺：もとの指令盤（proto/kawabe）と同じ形。1番線・4番線、1番線の東で 1E と 1B、⑥で分かれて平面交差し ⑦で合流 */
    const KG = G.K, kk = ST.K.km, LV = M + KG.LV;
    { const d0 = KG.d0;
      line([[xm(kk - d0 - STP), M - Y.lane], [xm(kk - d0), M - Y.side], [xm(kk + d0), M - Y.side], [xm(kk + d0 + STP), M - Y.lane]], TR, 2.8);   /* 1番線（①・1E・④） */
      line([[xm(kk - d0 - STP), M + Y.lane], [xm(kk - d0), M + Y.side], [xm(kk + d0), M + Y.side], [xm(kk + d0 + STP), M + Y.lane]], TR, 2.8);   /* 4番線（②・⑤） */
      line([[xm(kk + d0), M - Y.side], [xm(kk + d0 + STP), LV], [xm(kk + KG.X6 + 0.05), LV], [xb(KG.J1), Y.br]], TR, 3);   /* 1B：温泉支線へ */
      line([[xm(kk + KG.X6), LV], [xm(kk + KG.X7), M + Y.lane]], TR, 2.8); }   /* ⑥から平面交差して ⑦で上りの本線へ */
    /* 港：頭端4線。手前からシーサス→外側の番線へ分かれる→ホーム。港留置線（はしご）・臨港線・港貨物ターミナル（はしご） */
    const px = xm(ST.P.km), GP = G.P, pk = d => xm(ST.P.km - d);
    [-Y.side, Y.side].forEach(o => line([[pk(GP.d0 + fl(o)), M + Math.sign(o) * Y.lane], [pk(GP.d0), M + o], [px + 6, M + o]], TR, 3.2));
    C.LANES.P.forEach(o => buf(px + 6, M + o, 1));
    line([[pk(GP.cross[1]), M - Y.lane], [pk(GP.cross[0]), M + Y.lane]], SD, 2); line([[pk(GP.cross[1]), M + Y.lane], [pk(GP.cross[0]), M - Y.lane]], SD, 2);
    const PK = d => xm(ST.P.km + d);
    P2(YG.P.lead.map(([d, y]) => [ST.P.km + d, y]), SD, 2.4);
    YG.P.tracks.forEach(t => { line([[PK(YG.P.x0), t.y], [PK(t.jx), t.y]], '#6d6250', 1.6); buf(PK(YG.P.x0), t.y, -1); });
    const F = K.frt, QY0 = YG.Q.tracks[0].y;
    line([[PK(F[0]), M - Y.lane], [PK(F[1]), M + Y.lane], [PK(F[2]), QY0], [PK(F[3]), QY0]], '#b59a5a', 2.4, [6, 4]);
    ctx.fillStyle = 'rgba(181,154,90,.12)'; ctx.fillRect(PK(F[3]) - 6, QY0 - 10, PK(YG.Q.x1) - PK(F[3]) + 16, YG.Q.tracks[3].y - QY0 + 20);
    P2(YG.Q.lead.map(([d, y]) => [ST.P.km + d, y]), '#8a7a52', 1.8, [6, 4]);
    YG.Q.tracks.forEach(t => { line([[PK(t.jx), t.y], [PK(YG.Q.x1), t.y]], '#8a7a52', 1.6, [6, 4]); buf(PK(YG.Q.x1), t.y, 1); });
    /* 温泉支線（単線）：川辺の支線の高さから上の段へ、森下・峠（行き違い）、温泉（頭端2線） */
    const jx1 = xb(KG.J1), sg = s => G[s].d0 + STP / 2;
    line([[jx1, Y.br], [xb(ST.F.bkm - sg('F')), Y.br]], TR, 3.2);
    { const k = ST.F.bkm + C.SIGBOX, e = G.X.d0 + STP / 2; line([[xb(ST.F.bkm + sg('F')), Y.br], [xb(k - e), Y.br]], TR, 3.2); line([[xb(k + e), Y.br], [xb(ST.T.bkm - sg('T')), Y.br]], TR, 3.2); }
    line([[xb(ST.T.bkm + sg('T')), Y.br], [xb(ST.O.bkm - sg('O')), Y.br]], TR, 3.2);
    ['F', 'T'].forEach(s => { const k = ST[s].bkm, g = G[s]; [-Y.brLoop, Y.brLoop].forEach(o => line([[xb(k - sg(s)), Y.br], [xb(k - g.d0), Y.br + o], [xb(k + g.d0), Y.br + o], [xb(k + sg(s)), Y.br]], TR, 2.8)); });
    { const k = ST.F.bkm + C.SIGBOX, g = G.X, hs = STP / 2;   /* 森下〜峠の交換信号所（2026-11-18 から使う）：行き違い線2本。下りは上、上りは下 */
      [-Y.brLoop, Y.brLoop].forEach(o => line([[xb(k - g.d0 - hs), Y.br], [xb(k - g.d0), Y.br + o], [xb(k + g.d0), Y.br + o], [xb(k + g.d0 + hs), Y.br]], TR, 2.8));
      ctx.font = '11px "Zen Kaku Gothic New",sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#c9d6e2'; ctx.fillText('交換信号所', xb(k), Y.br + Y.brLoop + 60); }
    const ox = xb(ST.O.bkm);
    [-Y.lane, Y.lane].forEach(o => { line([[xb(ST.O.bkm - sg('O')), Y.br], [xb(ST.O.bkm - G.O.d0), Y.br + o], [ox + 6, Y.br + o]], TR, 3.2); buf(ox + 6, Y.br + o, 1); });
    { const OB = d => xb(ST.O.bkm + d), Og = YG.O; line([[OB(Og.lead[0][0]), Og.lead[0][1]], [OB(Og.lead[1][0]), Og.lead[1][1]], [OB(Og.x0), Og.tracks[0].y]], '#b59a5a', 2.2, [6, 4]); buf(OB(Og.x0), Og.tracks[0].y, -1); }   /* 温泉留置線 */
    /* ホーム（data/ctc-haisen.json）：島式・相対式・単式・千鳥 */
    if (HS && window.CtcSignal) for (const p of layOf().plats) {   /* 川辺の指令室と同じホーム：うすい青の板、左に ↑↓番線、右にホームの行き先 */
      const w = p.x1 - p.x0, h = p.y1 - p.y0;
      ctx.fillStyle = '#22364b'; ctx.strokeStyle = '#35506c'; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(p.x0 + 0.5, p.y0 + 0.5, w - 1, h - 1, 3) : ctx.rect(p.x0 + 0.5, p.y0 + 0.5, w - 1, h - 1); ctx.fill(); ctx.stroke();
      const fs = h >= 18 ? 9 : 8.5; ctx.font = `${fs}px "Zen Kaku Gothic New",sans-serif`; ctx.textAlign = 'left'; ctx.fillStyle = '#9fb6cc';
      const lw = Math.max(...p.lines.map(t => ctx.measureText(t).width), 0);
      if (lw + 8 < w && pxk >= 200) { if (p.lines.length > 1) { ctx.fillText(p.lines[0], p.x0 + 4, p.y0 + h / 2 - 1); ctx.fillText(p.lines[1], p.x0 + 4, p.y0 + h / 2 + fs - 0.5); } else ctx.fillText(p.lines[0], p.x0 + 4, p.y0 + h / 2 + fs * 0.35);
        ctx.font = `${fs + 1}px "Zen Kaku Gothic New",sans-serif`; const ww = ctx.measureText(p.what).width;
        if (lw + ww + 18 < w) { ctx.textAlign = 'right'; ctx.fillStyle = '#6f8aa5'; ctx.fillText(p.what, p.x1 - 5, p.y0 + h / 2 + (fs + 1) * 0.35); } } }
    /* ラベル（設備） */
    ctx.font = '11px "Zen Kaku Gothic New",sans-serif'; ctx.textAlign = 'left'; ctx.fillStyle = '#8aa0b4';
    ctx.fillText('中央車庫', xm(-2.25), dTop - 6);
    ctx.fillText('港留置線', xm(ST.P.km - 1.7), M - Y.pyd - 8);
    ctx.fillStyle = '#a99be0'; ctx.fillText('県央本線（他社線）← 空港・県の西', xm(-ML_()) + 6, k6 - 8);
    ctx.fillText('県央本線 6・7番線', xm(-0.25), k6 - 8);
    ctx.save(); ctx.translate((xm(0.75) + xm(1.3)) / 2 + 22, (k5 - 40 + 4) / 2 + 10); ctx.rotate(Math.atan2(4 - (k5 - 40), xm(1.3) - xm(0.75))); ctx.fillText('→ 北へ（県央北）', 0, 0); ctx.restore();
    ctx.fillStyle = '#c9b27a'; ctx.textAlign = 'left'; ctx.fillText('連絡線・入り（乗り入れ）', xm(-1.0), M - Y.side - 6); ctx.textAlign = 'right'; ctx.fillText('連絡線・出（乗り入れ）', xm(-1.05) - 6, M + Y.side + 32); ctx.textAlign = 'left'; ctx.fillText('県央北へ（乗り入れ）', xm(0.72) + 6, C.YK5 - 22);
    ctx.fillText('臨港線・港貨物ターミナル', xm(ST.P.km + C.LINK.frt[3]), YG.Q.tracks[3].y + 20);
    ctx.fillText('温泉留置線（臨時列車用）', xb(ST.O.bkm - 1.55), Y.br + 50);
    ctx.fillStyle = '#8aa0b4'; ctx.fillText('温泉支線（単線）', jx1 + 10, Y.br + 50);
    /* 川辺の分かれ道（もとの指令盤と同じ言葉）：⑥から来る上りが下りの本線を横切る所（平面交差）と、上りの本線に入る所（合流点） */
    { const u = (KG.LV - (-Y.lane)) / (KG.LV - Y.lane), xx = xm(kk + KG.X6 + (KG.X7 - KG.X6) * u);
      ctx.font = '10.5px "Zen Kaku Gothic New",sans-serif'; ctx.textAlign = 'left'; ctx.fillStyle = '#7f98b2'; ctx.fillText('平面交差', xx + 8, M - Y.lane - 6);
      ctx.fillStyle = '#4fd8ff'; ctx.textAlign = 'center'; ctx.fillText('合流点', xm(kk + KG.X7), M + Y.lane + 42); ctx.textAlign = 'left'; }
  }
  /* 段5：事故の区間を赤く、場所に印。再開までの残りの分 */
  function drawBig(T) {
    const br = !C.MAIN.includes(BIG.a) || !C.MAIN.includes(BIG.b) || (BIG.tr.seq.includes('O') && (BIG.a === 'K' || BIG.b === 'K') && (BIG.a === 'F' || BIG.b === 'F'));
    const kx = s => br ? L.xb(s === 'K' ? 0 : SX[s].bkm) : L.xm(SX[s].km), xa = kx(BIG.a), xb2 = kx(BIG.b), y = br ? Y.br : Y.main, x0 = Math.min(xa, xb2), x1 = Math.max(xa, xb2);
    ctx.fillStyle = 'rgba(255,77,77,.13)'; ctx.fillRect(x0, y - 34, x1 - x0, 68);
    ctx.strokeStyle = '#ff4d4d'; ctx.lineWidth = 1.5; ctx.setLineDash([6, 5]); ctx.strokeRect(x0, y - 34, x1 - x0, 68); ctx.setLineDash([]);
    const xm = xa + (xb2 - xa) * (BIG.f * 0.35 + 0.65 * C.smooth(BIG.f)), blink = Math.floor(performance.now() / 500) % 2;
    ctx.fillStyle = blink ? '#ff4d4d' : '#ffb3b3'; ctx.beginPath(); ctx.moveTo(xm, y - 58); ctx.lineTo(xm + 11, y - 38); ctx.lineTo(xm - 11, y - 38); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#0d1620'; ctx.font = '700 12px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('!', xm, y - 42);
    ctx.font = '700 12px "Zen Kaku Gothic New",sans-serif'; ctx.fillStyle = '#ff8a8a'; ctx.fillText(`運転見合わせ：${BIG.name}（再開まで あと約${Math.max(1, Math.ceil(BIG.t1 - T))}分）`, (x0 + x1) / 2, y - 64);
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
    C.MAIN.forEach(s => { const x = L.xm(ST[s].km); if (s === 'C') { pill(x, Y.main + 104, ST[s].name, s); kmTxt(x, Y.main + 130, ST[s].km); } else { pill(x, Y.main - (HS ? 86 : 52), ST[s].name, s); kmTxt(x, Y.main + (HS ? 84 : 44), ST[s].km); } });   /* 中央は北に県央本線があるので、駅名を下に */
    ['F', 'T', 'O'].forEach(s => { const x = L.xb(ST[s].bkm); pill(x, Y.br - (HS ? 56 : 34), ST[s].name, s); kmTxt(x, Y.br + (HS ? 52 : 30), ST[s].bkm); });
    /* キロの目盛り */
    ctx.strokeStyle = '#1d2f40'; ctx.lineWidth = 1; ctx.font = '10px "IBM Plex Mono",monospace'; ctx.fillStyle = '#4f6476';
    for (let k = 0; k <= Math.ceil(ST.P.km); k++) { const x = L.xm(k); ctx.beginPath(); ctx.moveTo(x, L.H - 22); ctx.lineTo(x, L.H - 14); ctx.stroke(); if (k % (pxk >= 200 ? 1 : 2) === 0) ctx.fillText(String(k), x, L.H - 4); }
  }

  /* ---- 列車 ---- */
  /* 列車（川辺の指令室と同じ）：種別の色の太い線、名札は黒い板に「種別番号 乗車率」と遅れ。列車がいる区間の赤いにじみは CtcSignal.drawOcc */
  const KTY = { L: '#a9b8c7', R: '#ffa630', E: '#ff5470', X: '#b892ff' };
  const tyCol = tr => KTY[tr.type] || C.TYPE_COL[tr.type] || '#a9b8c7';
  const crowdCol = r => r < 1 ? '#9fe8ff' : r < 1.5 ? '#ffe14a' : r < 1.8 ? '#ffb35c' : '#ff7ad9';
  function loadOf(tr, p, T) { const b = baseOf(tr); if (!b.loadAfter || !b.cap) return null; const i = p.i;
    if (p.moving) return b.loadAfter[i] / b.cap; if (i === 0) return b.loadAfter[0] / b.cap; return (T < (tr.arr[i] + tr.dep[i]) / 2 ? b.loadAfter[i - 1] : b.loadAfter[i]) / b.cap; }
  function drawTrain(p, tr, dead, T, D) {
    const len = Math.max(10, tr.cars * 0.02 * pxk), B = CtcSignal.bodyOf(p, tr, pxk), col = tyCol(tr);
    ctx.globalAlpha = dead ? 0.45 : 1; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const isSel = sel && sel.tr === baseOf(tr);
    if (isSel) { ctx.strokeStyle = '#4fd1ff'; ctx.lineWidth = 13; ctx.beginPath(); B.forEach((q, k) => k ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); ctx.stroke(); }
    ctx.lineCap = 'butt'; ctx.strokeStyle = col; ctx.lineWidth = 8; ctx.beginPath(); B.forEach((q, k) => k ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); ctx.stroke();
    /* 1両ずつの区切り（両数が分かるように。1両＝20m）。先頭は少し明るく */
    if (pxk >= 200) { const cl = 0.02 * pxk, segs = []; let acc = 0; for (let k = 1; k < B.length; k++) { const a = B[k - 1], b = B[k], d = Math.hypot(b[0] - a[0], b[1] - a[1]); segs.push([a, b, acc, d]); acc += d; }
      ctx.strokeStyle = '#0c1826'; ctx.lineWidth = 1.2;
      for (let c = 1; c < tr.cars; c++) { const at = c * cl, sg = segs.find(q => at >= q[2] && at <= q[2] + q[3]); if (!sg) break; const [a, b, s0, d] = sg, u = (at - s0) / (d || 1), x = a[0] + (b[0] - a[0]) * u, y = a[1] + (b[1] - a[1]) * u, nx = -(b[1] - a[1]) / (d || 1), ny = (b[0] - a[0]) / (d || 1);
        ctx.beginPath(); ctx.moveTo(x - nx * 4, y - ny * 4); ctx.lineTo(x + nx * 4, y + ny * 4); ctx.stroke(); } }
    ctx.lineJoin = 'miter'; ctx.globalAlpha = 1;
    const xs = B.map(q => q[0]), ys = B.map(q => q[1]), x0 = Math.min(...xs), y0 = Math.min(...ys);
    hits.push({ x0: x0 - 5, x1: Math.max(...xs) + 5, y0: y0 - 7, y1: Math.max(...ys) + 7, tr });
    if (dead) return;
    /* 名札 */
    const s0 = tr.seq[p.i], term = !p.moving && (s0 === 'C' || s0 === 'P' || s0 === 'O');
    let late = lateNow(tr, T), why = '', whyCol = '#ffb070';
    /* 止まっている理由（2026-11-18・ユーザーの頼み）：信号待ち・通過待ち・接続・行き違い・時間調整・発車待ち・運転見合わせ を名札に。あと何分かも */
    { const n = tr.seq.length, i = p.i, left = tr.dep[i] - T, aft = left > 0.15 ? ' あと' + C.fmtMin(left) : '', hd = tr.hold && tr.hold.i === i;
      if (p.xwait) { const xw = tr.xw && tr.xw[i]; why = ' 行き違い待ち（交換信号所）' + (xw && xw[1] - T > 0.15 ? ' あと' + C.fmtMin(xw[1] - T) : ''); whyCol = C.REASON.kokan.col; }
      else if (p.redAt != null) { why = ' 信号待ち'; whyCol = '#ff8b8b'; }
      else if (p.held && p.moving) { why = ' 進路待ち'; whyCol = '#ff8b8b'; }
      else if (hd && p.moving && T > tr.dep[i] + tr.hold.f * tr.hold.run) { why = ' 運転見合わせ'; whyCol = C.REASON.incident.col; }
      else if (!p.moving && i === 0) { why = (['C', 'P', 'O'].includes(tr.seq[0]) ? ' 折り返し 発車' : ' 発車待ち') + aft; whyCol = '#9fb6cc'; }
      else if (!p.moving && i > 0 && i < n - 1 && T >= tr.arr[i]) {
        const act = (tr.why && tr.why[i] || []).filter(x => x.min > 0.05).sort((a, b) => b.min - a.min)[0];
        const r = act || C.reasons(baseOf(tr), i, envCore(D))[0];
        if (r) { why = ' ' + (C.SHORT[r.code] || C.REASON[r.code].name) + aft; whyCol = C.REASON[r.code].col; }
        else if (left > 1.0) { why = ' 時間調整' + aft; whyCol = '#8fd18f'; } }
    }
    const ld = loadOf(tr, p, T), name = TY2[tr.type].name + tr.num, pc = ld == null ? '' : ' ' + Math.round(ld * 100) + '%', dl = late >= 0.5 ? ' +' + Math.round(late) + '分' : '';
    const fs = pxk >= 200 ? 11 : 9.5; ctx.font = `${fs}px "Zen Kaku Gothic New",sans-serif`; const wN = ctx.measureText(name).width;
    ctx.font = `700 ${fs}px "Zen Kaku Gothic New",sans-serif`; const wP = ctx.measureText(pc).width, wD = ctx.measureText(dl).width, wW = ctx.measureText(why).width;
    const w = wN + wP + wD + wW + 12, hh = fs + 5;
    const mx = (B[0][0] + B[B.length - 1][0]) / 2, my = (B[0][1] + B[B.length - 1][1]) / 2, up = p.dir > 0;
    /* 頭端の駅で止まっている列車：中央は列車の西（引上線の側）、港・温泉は車止めの先に、同じ番線の高さで（信号・ホームの字と重ならないように） */
    const endX = s0 === 'P' ? L.xm(SX.P.km) + 16 : s0 === 'O' ? L.xb(SX.O.bkm) + 16 : 0;
    let cx = term ? (s0 === 'C' ? x0 - 10 - w / 2 : endX + w / 2) : mx, cy = term ? my : my + (up ? -17 : 19);
    ctx.fillStyle = '#05090e'; ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(cx - w / 2 + 0.5, cy - hh / 2 + 0.5, w, hh, 3) : ctx.rect(cx - w / 2, cy - hh / 2, w, hh); ctx.fill(); ctx.stroke();
    let tx = cx - w / 2 + 6; const ty = cy + fs * 0.36; ctx.textAlign = 'left';
    ctx.font = `${fs}px "Zen Kaku Gothic New",sans-serif`; ctx.fillStyle = '#fff'; ctx.fillText(name, tx, ty); tx += wN;
    ctx.font = `700 ${fs}px "Zen Kaku Gothic New",sans-serif`;
    if (pc) { ctx.fillStyle = crowdCol(ld); ctx.fillText(pc, tx, ty); tx += wP; }
    if (dl) { ctx.fillStyle = '#ffb070'; ctx.fillText(dl, tx, ty); tx += wD; }
    if (why) { ctx.fillStyle = whyCol; ctx.fillText(why, tx, ty); }
    hits.push({ x0: cx - w / 2, x1: cx + w / 2, y0: cy - hh / 2, y1: cy + hh / 2, tr });
  }

  /* 車体を線路の上に（1両ずつ、通ってきた線路をさかのぼる。ポイント・連絡線・臨港線・支線もそのまま。2026-11-18） */
  function withBody(tr, p, env) {
    const len = Math.max(10, tr.cars * 0.02 * pxk);
    if (p.seg != null && p.km != null) { p.body = C.bodyPts(tr, p.seg, p.km, len, L, env); const B = p.body; if (B.length > 1) p.ang = Math.atan2(B[0][1] - B[1][1], B[0][0] - B[1][0]); }
    return p;
  }
  /* 折れ線 path（{x,y} の並び）の上で、はじめから s px の所を先頭に、len px ぶんうしろへ。はじめより前は、最初の線をそのままのばす */
  function pathBody(path, s, len) {
    const P = path.map(q => [q.x, q.y]), cum = [0]; for (let k = 1; k < P.length; k++) cum.push(cum[k - 1] + Math.hypot(P[k][0] - P[k - 1][0], P[k][1] - P[k - 1][1]));
    const at = d => { if (d <= 0) { const a = P[0], b = P[1] || [P[0][0] + 1, P[0][1]], L0 = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [a[0] + (a[0] - b[0]) / L0 * -d, a[1] + (a[1] - b[1]) / L0 * -d]; }
      let k = 1; while (k < P.length - 1 && cum[k] < d) k++; const a = P[k - 1], b = P[k], u = (d - cum[k - 1]) / ((cum[k] - cum[k - 1]) || 1); return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]; };
    const out = [at(s)]; for (let k = P.length - 1; k >= 0; k--) if (cum[k] < s && cum[k] > s - len) out.push(P[k]); out.push(at(s - len)); return out;
  }
  /* 回送の、折れ線 path の上で f（0〜1）の所の位置と車体 */
  function deadAt(path, f, sl, i) {
    const seg = path.slice(1).map((b, k) => Math.hypot(b.x - path[k].x, b.y - path[k].y)), tot = seg.reduce((x, y) => x + y, 0) || 1;
    let dd = f * tot, k = 0; while (k < seg.length - 1 && dd > seg[k]) { dd -= seg[k]; k++; }
    const a = path[k], b = path[k + 1] || path[k], u = seg[k] ? Math.min(1, dd / seg[k]) : 0;
    const p = { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, dir: (b.x >= a.x ? 1 : -1), moving: true, i, ang: Math.atan2(b.y - a.y, b.x - a.x) };
    p.body = pathBody(path, f * tot, sl);   /* 回送も、はしご・入出庫線の上を1両ずつ */
    return p;
  }
  /* 車体どうしが近すぎるか（3.5px） */
  function bodyHit(A, B, tl) {
    tl = tl || 3.5; const segd = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], LL = dx * dx + dy * dy || 1, u = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / LL)); return Math.hypot(a[0] + u * dx - p[0], a[1] + u * dy - p[1]); };
    const near = (P, q) => P.length > 1 ? P.some((r, k) => k && segd(q, P[k - 1], r) < tl) : Math.hypot(P[0][0] - q[0], P[0][1] - q[1]) < tl;
    return A.some(q => near(B, q)) || B.some(q => near(A, q));
  }
  /* いまの全部の編成の位置（車庫の中は除く）。画面と確かめ（CtcView.pos）が同じものを使う */
  function posAll(D, T) {
      const Y3 = yardSets(D);
      if (LAGT == null || T < LAGT - 0.001 || T - LAGT > 1.5) LAG.clear(); const lagDt = LAGT == null ? 0 : Math.max(0, T - LAGT); LAGT = T;   /* 時刻を飛ばしたら、待ちの記録を消す */
      const states = Y3.reg.map(s => [s, setNow(s, T)]).concat(Y3.syn.map(s => [s, synNow(s, T)])), env = envCore(D);
      const out = [];
      states.forEach(([s, n0]) => { let n = n0;
        if (n.depot) return;
        let p;
        /* 出庫してきて、始発の発車を待つ列車：前の列車がまだ番線から出きっていなければ、回送のまま手前で待たせる（下でたしかめる。2026-11-18 点検） */
        if (!n.dead && n.wait && s.home && s.trips && T < n.trip.dep[0]) {
          const r = (s.rests || []).find(x => s.trips[s.trips.indexOf(x.after) + 1] === n.trip && T >= x.t1);
          if (n.trip === s.trips[0] && T >= s.first - C.lead0(s)) n = { dead: true, out: true, f: 1, trip: n.trip, origin: true };
          else if (r) n = { dead: true, out: true, f: 1, trip: n.trip, origin: true, yard: r.at }; }
        if (n.dead) {
          const tr = n.trip, i = n.out ? 0 : tr.seq.length - 1, f0 = Math.max(0, Math.min(1, n.f)), f = n.out ? f0 * f0 : Math.sqrt(f0);   /* 入庫は番線をすぐあける・出庫はホームに入るのを最後に（ほかの列車と重ならないように。2026-11-18 点検） */
          const q = C.trainPos(tr, n.out ? tr.dep[0] - 0.01 : tr.arr[i] + 0.01, L, env), at = n.yard || s.home, dp = depotPt(at, slotOf(s, at, T)), sl = Math.max(10, tr.cars * 0.02 * pxk);
          /* 車庫・留置線と駅のあいだは、はしご・入出庫線の上を通る（yardPath） */
          const via = yardPath(at, dp, sl, q), path = n.out ? via : via.slice().reverse();
          /* 向きを変えるとき（港・温泉：着いた向きと反対へ入庫、出庫して反対へ発車）は、駅の側のはしを車体の反対のはしに（車止めの先へはみ出ないように。2026-11-18 点検） */
          { const dr = tr.down ? 1 : -1;
            if (n.out) { const e = path.length - 1; if ((path[e].x - path[e - 1].x) * dr < 0) path[e] = { x: q.x - dr * sl, y: q.y }; }
            else if ((path[1].x - path[0].x) * dr < 0) path[0] = { x: q.x - dr * sl, y: q.y }; }
          n.track = { at, t: dp.t };
          p = deadAt(path, f, sl, i);
          out.push({ s, n, p, tr, dead: true, path, sl, f0, fs: n.out ? (u => u * u) : Math.sqrt });
        } else { const m = LAG.get(baseOf(n.trip)), tD = m && m.tr === n.trip ? Math.min(T, m.t + lagDt * 1.6) : T;   /* 閉塞で待った列車は、少し速く進んで追いつく */
          p = withBody(n.trip, C.trainPos(n.trip, tD, L, env), env); p.tD = tD;
          out.push({ s, n, p, tr: n.trip, dead: false }); }
      });
      /* 回送は、ほかの列車とぶつかるなら、その手前（車庫・留置線の側）で待つ（2026-11-18 点検） */
      /* 回送は、ほかの列車の「いま」だけでなく、30秒先までに進む所も避ける（向かってくる列車の前に出ない。2026-11-19） */
      const sweep = new Map(), bodyX = o => { if (o.dead) return o.p.body || [[o.p.x, o.p.y]]; if (!sweep.has(o)) { const B = o.p.body || [[o.p.x, o.p.y]];
        const f = [0.5, 0.25].map(dt => { const r = C.trainPos(o.tr, (o.p.tD != null ? o.p.tD : T) + dt, L, env); return [r.x, r.y]; }); sweep.set(o, o.p.moving || T >= o.tr.dep[o.p.i || 0] - 0.5 ? f.concat(B) : B); } return sweep.get(o); };
      for (const d of out) { if (!d.dead || !d.path) continue;
        const others = () => out.filter(o => o !== d).map(o => ({ p: { body: bodyX(o), x: o.p.x, y: o.p.y } }));
        /* ポイントの分かれ目では、となりの線の列車にもかからない所（車両限界：8px）で止まる（2026-11-19） */
        const HT = 8;
        if (!others().some(o => bodyHit(d.p.body, o.p.body || [[o.p.x, o.p.y]], HT))) continue;
        for (let k = 1; k <= 51; k++) { const f0 = Math.max(0, d.f0 - k * 0.02); const p2 = deadAt(d.path, d.fs(f0), d.sl, d.p.i);   /* 出はじめなら、もとの番線・置き場所で待つ */
          if (!others().some(o => bodyHit(p2.body, o.p.body || [[o.p.x, o.p.y]], HT))) { d.p = Object.assign(p2, { held: true }); break; } if (f0 === 0) break; } }
      /* 回送のまま待たなくてよかった始発の列車は、ふつうの列車にもどす */
      for (let k = 0; k < out.length; k++) { const d = out[k]; if (!d.n || !d.n.origin || d.p.held) continue;
        const p = withBody(d.tr, C.trainPos(d.tr, T, L, env), env); p.tD = T; out[k] = { s: d.s, n: { trip: d.tr, wait: true }, p, tr: d.tr, dead: false }; }
      /* 閉塞（2026-11-18 点検）：次の信号の先の区間に列車がいれば、信号の手前で待つ（ダイヤより遅れて見える。あいたら少し速く進んで追いつく） */
      /* 赤の信号の手前で止まる（2026-11-18 点検）：閉塞・場内・出発が赤なら、列車は信号の手前で待つ。
         ダイヤどおりの位置より遅れて見えるので、あいたら少し速く進んで追いつく（LAG）。時刻を飛ばしたときは待ちを消す */
      if (HS && window.CtcSignal) { const lay = layOf();
        const yAt = (B, x) => { for (let k = 1; k < B.length; k++) { const a = B[k - 1], b = B[k]; if ((a[0] - x) * (b[0] - x) <= 0 && a[0] !== b[0]) return a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]); } return null; };
        for (let pass = 0; pass < 2; pass++) {
          /* 信号の色は、ひとつ前の画面の位置で決める（動こうとしている列車じしんが、先の区間をふさいで赤に見えないように） */
          const prevQ = out.map(q => { if (q.dead) return q; const m = LAG.get(baseOf(q.tr)); if (!m || m.tr !== q.tr) return q; return Object.assign({}, q, { p: withBody(q.tr, C.trainPos(q.tr, m.t, L, env), env) }); });
          const st0 = CtcSignal.state(lay, prevQ, T, L, C, SX, env);
          for (const f of out) {
            if (f.dead) continue; const m = LAG.get(baseOf(f.tr)); if (!m || m.tr !== f.tr) continue;
            const dir = f.p.dir, x0 = m.x, x1 = f.p.x;  if ((x1 - x0) * dir <= 0.2) continue;
            const hit = lay.sig.filter(o => o.dir === dir && !o.plan && st0.asp.get(o) === CtcSignal.R && (o.x - x0) * dir > 2 && (x1 - (o.x - dir * 3)) * dir > 0)
              .filter(o => { let yy = yAt(f.p.body || [[x1, f.p.y]], o.x); if (yy == null) return Math.abs(m.y - o.trk) < 4; return Math.abs(yy - o.trk) < 4; })   /* 車体が信号の所までないときは、前の画面で信号の線にいたか */.sort((a, b) => (a.x - b.x) * dir)[0];
            if (!hit) continue;
            let lo = m.t, hi = f.p.tD; for (let k = 0; k < 14; k++) { const mid = (lo + hi) / 2, r = C.trainPos(f.tr, mid, L, env); if ((r.x - (hit.x - dir * 3)) * dir > 0) hi = mid; else lo = mid; }
            f.p = withBody(f.tr, Object.assign(C.trainPos(f.tr, lo, L, env), { held: true, moving: true, tD: lo, redAt: hit.id }), env);
          }
        } }
      out.forEach(q => { if (!q.dead && q.p.tD != null) LAG.set(baseOf(q.tr), { t: q.p.tD, x: q.p.x, y: q.p.y, tr: q.tr }); });
      /* 閉塞：同じ線路を同じ向きに走る列車は、前の列車の最後尾より先へ出ない（時刻の計算のずれで重なって見えないように） */
      const run = out.filter(q => !q.dead && q.p.moving);
      for (const f of run) {
        const fl = Math.max(10, f.tr.cars * 0.02 * pxk);
        for (const l of out) {
          if (l === f || l.dead || l.p.dir !== f.p.dir || Math.abs(l.p.y - f.p.y) > 3) continue;
          const ll = Math.max(10, l.tr.cars * 0.02 * pxk), tail = l.p.x - ll * l.p.dir;   /* 前の列車の最後尾 */
          const ahead = (l.p.x - f.p.x) * f.p.dir; if (ahead <= 0 || ahead > fl + ll + 60) continue;
          const lim = tail - 6 * f.p.dir; if ((f.p.x - lim) * f.p.dir > 0) {   /* 少し前の時刻の位置にもどす（線路の上のまま） */
            for (let k = 1; k <= 80; k++) { const p2 = C.trainPos(f.tr, T - k * 0.02, L, envCore(D)); if ((p2.x - lim) * f.p.dir <= 0) { f.p = withBody(f.tr, Object.assign(p2, { held: true, moving: true }), envCore(D)); break; } } }
        }
      }
      /* 頭端の駅ののど：出ていく列車の最後尾が抜けるまで、同じ番線へ着く列車は手前で待つ（時刻の計算では同時に見えることがあるので、画面で少し前の位置に止める） */
      const span = q => { const ln = Math.max(10, q.tr.cars * 0.02 * pxk); return q.p.dir > 0 ? [q.p.x - ln, q.p.x] : [q.p.x, q.p.x + ln]; };
      const hit = (a, b) => { if (Math.abs(a.p.y - b.p.y) > 3) return false; const [a0, a1] = span(a), [b0, b1] = span(b); return a0 < b1 - 1 && b0 < a1 - 1; };
      for (const f of run) {
        const tr = f.tr, j = f.p.i + 1; if (j !== tr.seq.length - 1 || !['C', 'P', 'O'].includes(tr.seq[j])) continue;   /* 終点の頭端の駅へ着く列車だけ */
        const foe = out.filter(o => o !== f && !o.dead && o.p.dir !== f.p.dir); if (!foe.some(o => hit(f, o))) continue;
        for (let k = 1; k <= 40; k++) { const p2 = C.trainPos(tr, T - k * 0.05, L, envCore(D)); const g = { p: withBody(tr, Object.assign({}, p2, { held: true, moving: true }), envCore(D)), tr }; if (!foe.some(o => hit(g, o))) { f.p = g.p; break; } }
      }
      return out;
  }
  function draw(force) {
    if (!host || !L || host.offsetParent === null) return;
    const now = performance.now(); if (!force && now - lastDraw < 33) return; lastDraw = now;
    const dpr = Math.min(2, window.devicePixelRatio || 1), w = sc.clientWidth, H = L.H;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(H * dpr); cv.style.width = w + 'px'; cv.style.height = H + 'px'; }
    const ox = sc.scrollLeft;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = '#0c1826'; ctx.fillRect(0, 0, w, H);
    ctx.save(); ctx.translate(-ox, 0); hits = [];
    drawTrack(); drawStations();
    const D = data(), T = E.T();
    if (D) { ensureHl(D); if (ran() && BIG && T >= BIG.t0 - 0.01 && T < BIG.t1) drawBig(T); }
    if (D) {
      ensureHl(D);
      /* 車庫の編成 */
      const used = { C: 0, P: 0 }, tot = { C: 0, P: 0 };
      const Y3 = yardSets(D);
      /* 車庫・留置線で休む編成：決まった線の奥に、本当の長さで（両数が分かるように、1両ずつ区切る） */
      const parked = (x, y, cars, col) => { const len = cars * 0.02 * pxk; ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + len, y); ctx.stroke();
        if (pxk >= 200) { ctx.strokeStyle = '#0c1826'; ctx.lineWidth = 1; for (let c = 1; c < cars; c++) { const cx = x + c * 0.02 * pxk; ctx.beginPath(); ctx.moveTo(cx, y - 2.5); ctx.lineTo(cx, y + 2.5); ctx.stroke(); } } };
      Y3.reg.forEach(s => { tot[s.home]++; const n = setNow(s, T); if (!n.depot) return; const at = n.yard || s.home, q = depotPt(at, slotOf(s, at, T)); if (at !== 'O') used[at]++; parked(q.x, q.y, s.cars, tyCol(s.trips[0])); });
      ctx.font = '700 12px "Zen Kaku Gothic New",sans-serif'; ctx.textAlign = 'left'; ctx.fillStyle = '#dbe6f0';
      ctx.fillText(`${used.C}/${tot.C}編成`, L.xm(-1.45), Y.main + Y.dep - 6); ctx.fillText(`${used.P}/${tot.P}編成`, L.xm(SX.P.km - 1.3), Y.main - Y.pyd - 8);
      /* 頭端の駅（中央・港・温泉）で止まっている列車の番線を、重ならないように割りふる */
      /* 留置線で休んでいる臨時列車 */
      Y3.syn.forEach(s => { const n = synNow(s, T); if (!n.rest) return; const q = depotPt(n.rest, slotOf(s, n.rest, T));
        parked(q.x, q.y, s.cars, tyCol(s.trips[0])); ctx.font = '700 10px "Zen Kaku Gothic New",sans-serif'; ctx.textAlign = 'left'; ctx.fillStyle = tyCol(s.trips[0]); ctx.fillText('臨' + s.trips[0].num + ' 休み', q.x, q.y - 6); });
      let selPos = null;
      const QQ = posAll(D, T);
      let lay = null, gg = null;
      if (HS && window.CtcSignal) { lay = layOf(); SIG = CtcSignal.state(lay, QQ, T, L, C, SX, envCore(D)); gg = { L, C, T, pxk, hits, env: envCore(D), view: [ox, ox + w], sel: selSig, name: tr => TY2[tr.type].name + tr.num }; CtcSignal.draw(ctx, lay, SIG, gg); CtcSignal.drawOcc(ctx, SIG, gg); }   /* 進路・踏切・ポイント・列車がいる区間（川辺の指令室と同じ部品・2026-11-18） */
      for (const q of QQ) { drawTrain(q.p, q.tr, q.dead, T, D); if (sel && sel.tr === baseOf(q.tr)) selPos = q.p; }
      if (lay) CtcSignal.drawTop(ctx, lay, SIG, gg);   /* 信号機・入換信号・単線区間は列車の上 */
      drawGantt(T);
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
    let canc = 0;
    ALLT.forEach(t => { const a = PX.get(t); if (!a) return; if (a.cancel) { if (t.dep[0] <= T) canc++; return; } a.seq.forEach((s, i) => { if ((i ? a.arr[i] : a.dep[0]) > T) return; (a.why[i] || []).forEach(w => { sum[w.code] = (sum[w.code] || 0) + w.min; }); });
      if (a.arr[a.arr.length - 1] <= T) { done++; if (a.arr[a.arr.length - 1] - t.arr[t.arr.length - 1] < 1) ontime++; } });
    const ks = Object.keys(sum).filter(k => Math.abs(sum[k]) >= 0.1).sort((a, b) => sum[b] - sum[a]), mx = Math.max(1, ...ks.map(k => Math.abs(sum[k])));
    box.innerHTML = `<div class="muted">着いた列車 ${done}本・定時（遅れ1分未満）${done ? Math.round(ontime / done * 100) : 100}%${canc ? '・運休 ' + canc + '本' : ''}</div>` + (ks.map(k => `<div><span class="n">${(C.REASON[k] || {}).name || k}</span><i style="width:${Math.round(Math.abs(sum[k]) / mx * 110)}px;background:${(C.REASON[k] || {}).col}"></i><em>${sum[k] < 0 ? '−' : ''}${Math.round(Math.abs(sum[k]))}分</em></div>`).join('') || '<div class="muted">まだ遅れはありません</div>');
  }
  function cmpBox() {
    const box = host.querySelector('#ctcCmp'); if (!box) return;
    if (!CMP) { box.innerHTML = '<div class="muted">計算中</div>'; return; }
    const rows = Object.entries(C.POLICY).map(([k, v]) => { const s = CMP[k]; return `<tr${k === pol ? ' style="background:#1d3a4a"' : ''}><td><b>${v.name}</b>${k === pol ? '（いま）' : ''}</td><td>${Math.round(s.ontime * 100)}%</td><td>${Math.round(s.late)}分</td><td>${s.held}回</td><td>${s.cut}回</td><td>${s.swap}回</td><td>${s.cancel}本</td><td>${s.req}件${s.reqNo ? '（ことわる' + s.reqNo + '）' : ''}</td></tr>`; }).join('');
    box.innerHTML = `<div style="overflow-x:auto"><table><tr><th>方針</th><th>定時（遅れ1分未満）</th><th>遅れの合計</th><th>接続を待った</th><th>接続を打ち切った</th><th>順番の入れかえ</th><th>運休</th><th>要望を受けた</th></tr>${rows}</table></div>
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
        return `<tr${now}><td>${SX[s].name}</td><td>${t}</td><td>${d}</td>${act}<td>${pass ? '' : trackOf(tr, i) + (typeof trackOf(tr, i) === 'number' ? '番線' : '')}</td><td class="why">${why.join('<br>')}</td></tr>`;
      }).join('');
      const tot = tr.delay > 0.5 ? `この列車の待ちの合計 +${Math.round(tr.delay)}分（ダイヤに入っている待避・接続・間かく）` : '待ちはほとんどありません';
      box.innerHTML = `<h3>${ty.name} ${tr.num} ${dest}行（${tr.cars}両・${tr.set ? esc(tr.set.label) : ''}）${ax && ax.cancel ? ' <span style="color:#ff8a8a">きょうは運休</span>' : ''}</h3><div class="muted">${tot}</div><div style="overflow-x:auto"><table><tr><th>駅</th><th>予定 着</th><th>予定 発</th>${ax ? '<th>実際</th>' : ''}<th>番線</th><th>理由（予定の待ち・きょうの乱れ）</th></tr>${rows}</table></div>`;
    } else if (sel.st) {
      const s = sel.st, deps = [];
      ALLT.forEach(tr => { const i = tr.seq.indexOf(s); if (i < 0 || i === tr.seq.length - 1) return; if (!tr.stop[i]) return; if (tr.dep[i] < T - 0.2) return; deps.push({ tr, i, t: tr.dep[i] }); });
      deps.sort((a, b) => a.t - b.t);
      const side = down => deps.filter(d => d.tr.down === down).slice(0, 5).map(d => { const ax = ran() ? PX.get(d.tr) : null, lt = ax ? ax.dep[d.i] - d.tr.dep[d.i] : 0;
        if (ax && ax.cancel) return `<tr style="opacity:.6"><td class="t">${E.fmt(d.t)}</td><td>${TY2[d.tr.type].name}</td><td>${SX[d.tr.seq[d.tr.seq.length - 1]].name}</td><td></td><td class="why" style="color:#ff8a8a">運休</td></tr>`;
        const aw = ax ? (ax.why[d.i] || []).filter(x => x.min > 0.05).sort((a, b) => b.min - a.min)[0] : null, r = aw || C.reasons(d.tr, d.i, env)[0];
        return `<tr><td class="t">${E.fmt(d.t)}${lt >= 0.5 ? `<br><span style="color:#ff8a8a">遅れ${C.fmtMin(lt)}</span>` : ''}</td><td>${TY2[d.tr.type].name}</td><td>${SX[d.tr.seq[d.tr.seq.length - 1]].name}</td><td>${trackOf(d.tr, d.i)}番線</td><td class="why">${r ? C.REASON[r.code].name + ' ' + C.fmtMin(r.min) : ''}</td></tr>`; }).join('') || '<tr><td class="muted" colspan="5">きょうはもうありません</td></tr>';
      box.innerHTML = `<h3>${SX[s].name}駅 発車標</h3>${HS && HS.stations[s] ? `<div class="muted">駅の形：${esc(HS.stations[s].kind)}</div>` : ''}<div style="overflow-x:auto"><table><tr><th colspan="5">${s === 'P' || s === 'O' ? '' : '下り（港・温泉方面）'}</th></tr>${side(true)}<tr><th colspan="5">上り（中央方面）</th></tr>${side(false)}</table></div>`;
    }
  }
  function onClick(e) {
    const r = cv.getBoundingClientRect(), x = e.clientX - r.left + sc.scrollLeft, y = e.clientY - r.top;
    const h = hits.slice().reverse().find(h => x >= h.x0 && x <= h.x1 && y >= h.y0 && y <= h.y1);
    if (!h) return;
    if (h.sig || h.point || h.shunt) { selSig = h.sig || null; draw(true); const box = host.querySelector('#ctcInfo'); box.innerHTML = '<h3>選んだもの</h3><p>' + CtcSignal.explain(h, SIG, E.fmt, TY2) + '</p>'; return; }
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
  function lateShare(D) { if (!E || !D || !D.trips) return null; ensureHl(D); const R = RUNF ? RUNF() : D2; let n = 0, late = 0;   /* 訓練の事故は、満足度には入れない。運休は遅れに数える */
    D.trips.forEach(t => { const a = R.A.get(t); if (!a) return; n++; if (a.cancel) { late++; return; } if (a.arr[a.arr.length - 1] - t.arr[t.arr.length - 1] >= 1) late++; }); return n ? late / n : null; }
  /* きょうの線路使用料（円・仮）。経営のタブが1日の終わりに読む（橋 ctc-fee-to-keiei） */
  function feeToday(D) { if (!E || !X || !D || !D.trips) return 0; ensureHl(D); return FEE ? FEE.yen : 0; }
  /* 確かめ用（headless）：時刻 T の、列車（車体）・信号・ポイント・単線区間・入換信号・車庫の編成。画面は描かない */
  function probe(T) {
    const D = data(); if (!D || !L || !HS) return null; ensureHl(D);
    const QQ = posAll(D, T), lay = layOf(), st = CtcSignal.state(lay, QQ, T, L, C, SX, envCore(D)), Y3 = yardSets(D);
    const sets = Y3.reg.map(s => { const n = setNow(s, T); return { id: s.id != null ? s.id : s.trips[0].num, home: s.home, depot: !!n.depot, yard: n.yard || null, slot: n.depot ? slotOf(s, n.yard || s.home, T) : null, first: s.trips[0].seq[0], last: s.trips[s.trips.length - 1].seq.slice(-1)[0] }; });
    const syn = Y3.syn.map(s => { const n = synNow(s, T); return { kind: s.kind, depot: !!n.depot, rest: n.rest || null }; });
    return {
      trains: QQ.map(q => ({ key: q.tr.num + '@' + (q.tr.yardOf || q.tr).dep[0].toFixed(2) + (q.dead ? 'd' : ''), num: q.tr.num, type: q.tr.type, dead: q.dead, held: !!q.p.held, xwait: !!q.p.xwait, moving: q.p.moving, dir: q.p.dir, i: q.p.i, seq: q.tr.seq.join(''), st: q.tr.seq[q.p.i], nx: q.tr.seq[q.p.i + 1] || null, x: q.p.x, y: q.p.y, body: CtcSignal.bodyOf(q.p, q.tr, pxk), cars: q.tr.cars, synth: !!(q.tr.synth || (q.tr.base && q.tr.base.synth)), track: q.n && q.n.track || null, lane: q.tr.lanes ? q.tr.lanes[q.p.i] : null })),
      sig: lay.sig.map(o => ({ trk: o.trk, id: o.id, kind: o.kind, line: o.line, dir: o.dir, st: o.st || null, km: o.km, x: o.x, lane: o.lane, asp: o.plan ? null : st.asp.get(o), br: !!o.br })),
      pts: lay.pts.map(p => { const v = st.pst.get(p) || {}; return { gen: !!p.gen, J: p.J, uN: p.uN, uR: p.uR, lenN: p.lenN, lenR: p.lenR, st: p.st, no: p.no, x: p.x, y0: p.y0, a: p.a, b: p.b, trunk: p.trunk, len: p.len, side: p.side, out: p.out, cross: p.cross, rule: p.rule, br: p.br, rev: !!v.rev, lock: !!v.lock, phase: v.phase || '', by: v.t ? v.t.tr.num : null }; }),
      one: (st.one || []).map(u => ({ a: u.a, b: u.b, t: u.t ? u.t.tr.num : null, ts: (u.ts || []).map(x => [x.tr.num, x.dir, x.moving ? 1 : 0]) })), shunt: (lay.shunt || []).map(sh => ({ at: sh.at, t: sh.t, main: !!sh.main, on: !!(st.sst && st.sst.get(sh)) })),
      routes: st.routes.map(r => ({ kind: r.kind, st: r.st, num: r.t.tr.num, prep: !!r.prep })), xings: lay.xings.map(x => ({ km: x.km, br: x.br, on: !!st.xst.get(x) })),
      sets, syn, slotOver: SLOTOVER, pxk, big: BIG ? { a: BIG.a, b: BIG.b, t0: BIG.t0, t1: BIG.t1, name: BIG.name } : null };
  }
  /* 番線の予定（川辺の指令盤と同じ図・2026-11-18）：えらんだ駅の番線ごとに、列車がいる時間を帯で。単線区間の行も */
  function drawGantt(T) {
    const g = host && host.querySelector('#ctcGantt'); if (!g || !YS || !HS) return;
    const key = GST + '|' + Math.round(T * 20); if (key === GKEY) return; GKEY = key;
    const st = HS.stations[GST]; if (!st) return; const names = SX ? (k => SX[k] ? SX[k].name : k) : (k => k);
    { const sel = host.querySelector('#ctcGSt'); if (sel && sel.options[0] && sel.options[0].textContent === sel.options[0].value) [...sel.options].forEach(o => { o.textContent = names(o.value); }); }
    const one = { K: [['K', 'F']], F: [['K', 'F'], ['F', 'T']], T: [['F', 'T'], ['T', 'O']], O: [['T', 'O']] }[GST] || [];
    const rows = st.lanes.map((c, j) => ({ lab: (st.num[j] || j + 1) + '番線', o: C.LCODE[c] })).concat(one.map(([a, b]) => ({ lab: '単線 ' + names(a) + '〜' + names(b), one: [a, b] })));
    const RH = Math.min(38, 200 / rows.length), t0 = T - 6, X = m => 120 + (m - t0) / 30 * 870, el = (n, a, txt) => { const e = document.createElementNS('http://www.w3.org/2000/svg', n); for (const k in a) e.setAttribute(k, a[k]); if (txt != null) e.textContent = txt; g.appendChild(e); return e; };
    g.innerHTML = '';
    rows.forEach((r, i) => { const y = 8 + i * RH; el('rect', { x: 120, y, width: 870, height: RH - 6, fill: i % 2 ? '#112234' : '#0e1d2d' }); el('text', { x: 112, y: y + RH / 2, fill: '#cfe0f2', 'font-size': r.one ? 11 : 13, 'text-anchor': 'end' }, r.lab); });
    const H = 8 + rows.length * RH;
    for (let m = Math.ceil(t0 / 5) * 5; m <= t0 + 30; m += 5) { el('line', { x1: X(m), y1: 6, x2: X(m), y2: H - 4, stroke: '#24384e' }); const mm = ((Math.round(m) % 1440) + 1440) % 1440; el('text', { x: X(m), y: H + 12, fill: '#8ea3b8', 'font-size': 11, 'text-anchor': 'middle' }, String(Math.floor(mm / 60)).padStart(2, '0') + ':' + String(mm % 60).padStart(2, '0')); }
    const bar = (row, a, b, tr, txt) => { const x0 = Math.max(120, X(a)), x1 = Math.min(990, X(b)); if (x1 <= x0) return; const y = 8 + row * RH + 3;
      el('rect', { x: x0, y, width: x1 - x0, height: RH - 12, rx: 4, fill: tyCol(tr), opacity: 0.92 }); if (x1 - x0 > 34) el('text', { x: x0 + 4, y: y + (RH - 12) / 2 + 4, fill: '#0b1420', 'font-size': 11, 'font-weight': 700 }, txt); };
    const trips = YS.reg.concat(YS.syn).flatMap(s => s.trips);
    for (const tr of trips) { const n = tr.seq.length, dest = names(tr.seq[n - 1]), nm = (TY2[tr.type] ? TY2[tr.type].name : '') ;
      tr.seq.forEach((s0, i) => { if (s0 !== GST || !tr.lanes) return; const a = i > 0 ? tr.arr[i] : tr.dep[i] - 2, b = i < n - 1 ? Math.max(tr.dep[i], a + 0.35) : tr.arr[i] + 3;
        if (b < t0 - 1 || a > t0 + 31) return; const r = rows.findIndex(r => r.o === tr.lanes[i]); if (r >= 0) bar(r, a, b, tr, nm + (i === n - 1 ? '着' : dest)); });
      rows.forEach((r, ri) => { if (!r.one) return; for (let i = 0; i < n - 1; i++) { const u = tr.seq[i], v = tr.seq[i + 1]; if (!((u === r.one[0] && v === r.one[1]) || (u === r.one[1] && v === r.one[0]))) continue; bar(ri, tr.dep[i], tr.arr[i + 1], tr, nm + ' ' + (tr.down ? '→' + names(v) : names(v) + '←')); } }); }
    el('line', { x1: X(T), y1: 4, x2: X(T), y2: H - 2, stroke: '#fff', 'stroke-width': 2 });
  }
  /* 確かめ用：描いた線路（折れ線）を全部 */
  function tracks() { if (!L) return null; REC = []; ctx.save(); try { drawTrack(); } finally { ctx.restore(); } const r = REC; REC = null; draw(true); return r; }
  window.CtcView = { posq: T => { const D = data(); return D ? posAll(D, T) : null; }, tracks, probe, init, frame: () => draw(false), redraw: () => draw(true), lateShare, feeToday, syn: () => ({ SYN, EXT, D2, YS }),
    pos: T => { const D = data(); if (!D || !L) return []; ensureHl(D); return posAll(D, T).map(q => ({ num: q.tr.num, type: q.tr.type, down: q.tr.down, dead: q.dead, x: q.p.x, y: q.p.y, moving: q.p.moving, st: q.tr.seq[q.p.i], len: Math.max(10, q.tr.cars * 0.02 * L.pxk), dir: q.p.dir })); } };   /* syn：確かめ用（headless） */
})();
