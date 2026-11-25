/* 鉄道の経営の画面（index.html の「経営」のタブ）。計算は js/keiei-core.js、設定は data/keiei.json、保存は dia-keiei。
   KeieiView.init(env)：env は ST・ALL・D()・day()・fmt・rebuild()
   KeieiView.dayEnd(D, day)：運行日を締めるとき（ENSEN_UI.dayEnd）に1回。D は運行の記録の実際の1日（D.base が予定。指令パネルには予定を渡す。2026-11-25）
   KeieiView.fx(day)：乗客の計算に掛ける倍率（index.html の ensRefresh で読む）
   KeieiView.incidentK()：指令パネルの「できごと」の起こりやすさ */
(function () {
  'use strict';
  const K = window.KeieiCore; if (!K) return;
  const SKEY = 'dia-keiei';
  let E = null, cfg = null, st = null, strength = 1, feeK = 1, divK = 1, host = null, range = 30, confirmKey = null, hover = null;
  const css = `
.kei{display:grid;gap:14px}
.kei-tiles{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
@media (max-width:760px){.kei-tiles{grid-template-columns:repeat(2,minmax(0,1fr))}}
.kei-tile{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:10px 12px;min-width:0}
.kei-tile span{display:block;font-size:12px;color:var(--muted)}
.kei-tile b{display:block;font-size:22px;font-variant-numeric:tabular-nums;line-height:1.25}
.kei-tile i{font-style:normal;font-size:12px;color:var(--muted)}
.kei-card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:12px 14px;min-width:0}
.kei-card h2{font-size:16px;margin:0 0 4px}
.kei-card .sub{font-size:12px;color:var(--muted)}
.kei-seg{display:inline-flex;border:1px solid var(--line);border-radius:9px;overflow:hidden;margin:6px 0}
.kei-seg button{font:inherit;font-size:12.5px;border:0;background:transparent;color:var(--ink);padding:4px 10px;cursor:pointer}
.kei-seg button[aria-pressed="true"]{background:var(--accent);color:var(--accent-ink)}
.kei-chart{overflow-x:auto}
.kei-chart svg{display:block;width:100%;min-width:520px;height:auto}
.kei-tip{font-size:12.5px;color:var(--ink);min-height:1.6em;font-variant-numeric:tabular-nums}
.kei-inv{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:10px;margin-top:8px}
.kei-it{border:1px solid var(--line);border-radius:10px;padding:10px;display:flex;flex-direction:column;gap:6px;min-width:0}
.kei-it h3{font-size:14px;margin:0}
.kei-it p{margin:0;font-size:12.5px;color:var(--muted)}
.kei-it .row{display:flex;gap:6px;align-items:center;flex-wrap:wrap;font-size:12.5px}
.kei-it select,.kei-it button,.kei-row button{font:inherit;font-size:12.5px;border:1px solid var(--line);border-radius:8px;background:var(--panel);color:var(--ink);padding:4px 8px}
.kei-it button.go{background:var(--accent);color:var(--accent-ink);border-color:var(--accent);cursor:pointer}
.kei-it button.go[data-arm="1"]{background:#c0392b;border-color:#c0392b;color:#fff}
.kei-it button:disabled{opacity:.5;cursor:default}
.kei-grp{width:100%;border-collapse:collapse;font-size:12.5px;font-variant-numeric:tabular-nums;margin-top:6px}.kei-grp td,.kei-grp th{padding:4px 6px;border-bottom:1px solid var(--line);text-align:right;white-space:nowrap}.kei-grp td:first-child,.kei-grp th:first-child{text-align:left}.kei-grp th{font-weight:400;color:var(--muted);font-size:11.5px}
.kei-link{font:inherit;font-size:12px;border:1px solid var(--line);background:var(--panel);color:var(--accent);border-radius:999px;padding:2px 10px;cursor:pointer}
.kei-own{list-style:none;margin:6px 0 0;padding:0;font-size:13px}
.kei-own li{padding:4px 0;border-bottom:1px dashed var(--line);display:flex;gap:8px;flex-wrap:wrap}
.kei-bar{display:inline-block;width:80px;height:7px;background:var(--line);border-radius:4px;vertical-align:middle;overflow:hidden}
.kei-bar i{display:block;height:100%;background:var(--accent)}
.kei-row{display:flex;gap:10px;flex-wrap:wrap;align-items:center;font-size:13px}
.kei-warn{color:#c0392b;font-weight:700}
.kei-parts{font-size:12px;color:var(--muted);margin-top:4px}
`;
  const man = v => (Math.abs(v) >= 1e8 ? (v / 1e8).toFixed(Math.abs(v) >= 1e9 ? 1 : 2) + '億' : Math.round(v / 1e4).toLocaleString() + '万') + '円';
  const num = v => Math.round(v).toLocaleString();
  const yn = v => (v < 0 ? '−' : '') + Math.abs(Math.round(v)).toLocaleString() + '円';
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  function load() { try { return JSON.parse(localStorage.getItem(SKEY) || 'null'); } catch (e) { return null; } }
  function save() { try { localStorage.setItem(SKEY, JSON.stringify(st)); } catch (e) { } }

  async function init(env) {
    E = env;
    host = document.getElementById('keieiHost'); if (!host) return;
    try { cfg = await (await fetch('data/keiei.json')).json(); } catch (e) { host.textContent = '経営の設定（data/keiei.json）を読めませんでした'; return; }
    try { const L = await (await fetch('data/links.json')).json(); const b = L.links.find(x => x.id === 'keiei-to-rail'); if (b) strength = b.state === 'retired' ? 0 : b.strength; const f = L.links.find(x => x.id === 'ctc-fee-to-keiei'); if (f) feeK = f.state === 'retired' ? 0 : f.strength; const dvl = L.links.find(x => x.id === 'group-to-keiei'); if (dvl) divK = dvl.state === 'retired' ? 0 : dvl.strength; } catch (e) { }
    st = K.normalize(load(), cfg, E.day()); save();
    const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
    host.addEventListener('click', onClick); host.addEventListener('input', onInput);
    render();
    if (E.ready) E.ready();
  }

  /* その日の数字（いま計算されている D から） */
  function today() {
    const D = E.D(); if (!D || !D.summary) return null;
    let late = null; try { late = window.CtcView && CtcView.lateShare ? CtcView.lateShare(D.base || D) : null; } catch (e) { }
    const m = K.metrics(D, E.ALL, late);
    return { m, sat: K.satisfaction(cfg, st, m, E.day()) };
  }

  function dayEnd(D, day) {
    if (!cfg || !st || !D || !D.summary) return;
    let late = null; try { late = window.CtcView && CtcView.lateShare ? CtcView.lateShare(D.base || D) : null; } catch (e) { }
    const m = K.metrics(D, E.ALL, late); try { m.fee = window.CtcView && CtcView.feeToday ? CtcView.feeToday(D.base || D) * feeK : 0; } catch (e) { m.fee = 0; }   /* 線路使用料（橋 ctc-fee-to-keiei） */
    /* 子会社からの配当（橋 group-to-keiei）：グループの記録は次の運行日の始めにできるので、ふつうは前の日の分がここで入る */
    try { const dv = K.dividend(cfg, groupDays(), st.divDay != null ? st.divDay : day - 2, day); m.div = dv.yen * divK; st.divDay = dv.last; } catch (e) { m.div = 0; }
    K.closeDay(cfg, st, m, day); save(); render();
  }
  function groupDays() { try { const o = JSON.parse(localStorage.getItem('dia-group') || 'null'); return o && Array.isArray(o.days) ? o.days : []; } catch (e) { return []; } }
  /* グループ全体（連結）の小さな表：いちばん新しい締めた日 */
  function groupBox() {
    const days = groupDays(), d = days[days.length - 1];
    if (!d || !d.co) return `<div class="kei-card"><h2>グループ全体（連結）</h2><div class="sub">まだ記録がありません。売店を出して運行日を締めると、次の運行日の始めに、鉄道と子会社（売店・センター・工場・配送会社）の1日がここに出ます。</div></div>`;
    const NM = { rail: '鉄道（親会社）', center: 'センター', factory: '工場', haiso: '配送会社' }, rk = k => k === 'rail' ? 0 : k.startsWith('store:') ? 1 : 2;
    const keys = Object.keys(d.co).sort((a, b) => rk(a) - rk(b)); let sub = 0, tot = 0;
    const tr = keys.map(k => { const c = d.co[k]; tot += c.net; if (k !== 'rail') sub += c.net;
      return `<tr><td>${esc((d.names && d.names[k]) || NM[k] || k)}</td><td>${yn(c.inExt)}</td><td>${yn(c.inGrp)}</td><td>${yn(c.outExt)}</td><td>${yn(c.outGrp)}</td><td><b style="color:${c.net < 0 ? '#c0392b' : 'inherit'}">${yn(c.net)}</b></td></tr>`; }).join('');
    const rate = (cfg.dividend && cfg.dividend.rate) || 0, dv = Math.round(Math.max(0, sub) * rate * divK);
    return `<div class="kei-card"><h2>グループ全体（連結）</h2><div class="sub">第${d.day}運行日。会社の間のお金（仕入れ・運賃・駅の家賃）は、払った会社と受け取った会社で打ち消し合うので、グループ全体のもうけは「外から入った−外へ出た」。</div>
      <div style="overflow-x:auto"><table class="kei-grp"><tr><th>会社</th><th>外から</th><th>グループ内から</th><th>外へ</th><th>グループ内へ</th><th>もうけ</th></tr>${tr}
      <tr><td><b>グループ全体</b></td><td colspan="4">${d.co.rail ? '' : '（この日は鉄道の記録なし・子会社だけ）'}</td><td><b style="color:${tot < 0 ? '#c0392b' : 'inherit'}">${yn(tot)}</b></td></tr></table></div>
      <div class="sub" style="margin-top:6px">子会社のもうけ ${yn(sub)} → 本社への配当（黒字の${Math.round(rate * 100)}%）<b> ${yn(dv)}</b>。配当は、次に運行日を締めるとき積み立てに入ります。${window.minatoMoney ? ' <button type="button" class="kei-link" data-money="1">お金の流れをくわしく</button>' : ''}</div></div>`;
  }
  const fx = day => (cfg && st ? K.fx(cfg, st, day, strength) : null);
  const incidentK = () => (cfg && st ? K.incidentK(cfg, st) : 1);

  /* ---- 画面 ---- */
  function render() {
    if (!host || !cfg || !st) return;
    const day = E.day(), T = today(), last = st.log[st.log.length - 1], prev = st.log[st.log.length - 2];
    const mt = cfg.maint.levels[st.maint]; void prev;
    host.innerHTML = `<div class="kei">
  <div class="kei-tiles">
    <div class="kei-tile"><span>投資に回せる積み立て</span><b>${man(st.bal)}</b><i>利益の${Math.round(st.share * 100)}%を毎日積み立て</i></div>
    <div class="kei-tile"><span>経費を引いた利益（きょうの見こみ）</span><b>${T ? man(T.m.profit) : '—'}</b>${last ? `<i>前の運行日 ${man(last.profit)}</i>` : ''}</div>
    <div class="kei-tile"><span>乗降客数（乗車×2・きょう）</span><b>${T ? num(T.m.riders * 2) : '—'}人</b>${last ? `<i>前の運行日 ${num(last.boardAlight)}人</i>` : ''}</div>
    <div class="kei-tile"><span>乗客の満足度（0〜100）</span><b>${T ? T.sat.score : '—'}</b>${last ? `<i>前の運行日 ${last.sat}</i>` : ''}</div>
  </div>
  ${st.bal < 0 ? '<div class="kei-card kei-warn">積み立てが足りなくなったので、保守を「けずる」にしました。</div>' : ''}
  <div class="kei-card"><h2>毎日の移り変わり</h2><div class="sub">1本＝1運行日（運行日を締めたときに記録）。いちばん右の点線は、きょうの見こみ。▼は投資を決めた日</div>
    <div class="kei-seg" role="group" aria-label="表示する日数">${[14, 30, 90, 0].map(n => `<button type="button" data-range="${n}" aria-pressed="${range === n}">${n ? n + '日' : '全部'}</button>`).join('')}</div>
    <div class="kei-chart" id="keiChart">${chart(T)}</div><div class="kei-tip" id="keiTip">${tipText(null, T)}</div>
    ${T ? `<div class="kei-parts">きょうの満足度の内わけ：${T.sat.parts.map(p => `${esc(p.name)} ${p.v >= 0 ? '+' : ''}${p.v}`).join('・')}（もとは ${cfg.sat.base}）</div>` : ''}</div>
  <div class="kei-card"><h2>お金の使い道</h2>
    <div class="kei-row"><label>利益のうち投資に回す割合 <input type="range" id="keiShare" min="${cfg.share.min * 100}" max="${cfg.share.max * 100}" step="5" value="${Math.round(st.share * 100)}"> <b id="keiShareV">${Math.round(st.share * 100)}%</b></label>
      <span class="sub">残りは人件費・借金の返済・株主への配当などに使ったとみなします（まだ計算には入れていません）。積み立てには、このほかに 駅ビルと住宅の家賃・線路使用料・子会社からの配当 が入ります</span></div>
    <div class="kei-row" style="margin-top:8px">線路・車両・信号の保守：<span class="kei-seg" role="group" aria-label="保守の予算">${Object.entries(cfg.maint.levels).map(([k, v]) => `<button type="button" data-maint="${k}" aria-pressed="${st.maint === k}">${v.name}（${v.cost ? man(v.cost) + '／日' : '0円'}）</button>`).join('')}</span>
      <span class="sub">いま：指令パネルの「できごと」×${mt.incident}・満足度 ${mt.sat >= 0 ? '+' : ''}${mt.sat}</span></div></div>
  ${groupBox()}
  <div class="kei-card"><h2>投資する</h2><div class="sub">積み立てから払います。工事のあと、効き目が少しずつ出ます（乗客の計算に入ります）。数字はすべて仮。</div>
    <div class="kei-inv">${cfg.invest.map(invCard).join('')}${cfg.later.map(l => `<div class="kei-it" style="opacity:.55"><h3>${esc(l.name)}</h3><p>準備中：${esc(l.why)}</p></div>`).join('')}</div></div>
  <div class="kei-card"><h2>持っている投資</h2>${st.owned.length ? `<ul class="kei-own">${st.owned.map(o => { const it = K.item(cfg, o.id), s = K.status(cfg, o, day);
      return `<li><b>${esc(it ? it.name : o.id)}</b>・${esc(E.ST[o.st].name)}駅・第${o.day}運行日に${man(o.cost)}<span>${s.kind === 'build' ? `工事中（あと${s.left}日）` : `効き目 <span class="kei-bar"><i style="width:${Math.round(s.e * 100)}%"></i></span> ${Math.round(s.e * 100)}%`}</span>${it && it.income ? `<span class="sub">収入 ${man(it.income * s.e)}／日</span>` : ''}</li>`; }).join('')}</ul>` : '<div class="sub">まだありません</div>'}</div>
</div>`;
    bindChart();
  }
  function invCard(it) {
    const day = E.day(), opts = it.stations.filter(s => !st.owned.some(o => o.id === it.id && o.st === s));
    const key = it.id, sel = (host.querySelector && host.querySelector(`select[data-st="${key}"]`)) || null;
    const cur = sel ? sel.value : opts[0];
    const ok = opts.length && st.bal >= it.cost;
    return `<div class="kei-it"><h3>${esc(it.name)}</h3><p>${esc(it.what)}</p><p>${esc(it.say)}</p>
      <div class="row">費用 <b>${man(it.cost)}</b>・工事 ${it.build}日${it.income ? `・収入 ${man(it.income)}／日` : ''}</div>
      <div class="row">${opts.length ? `<select data-st="${key}" aria-label="${esc(it.name)}を建てる駅">${opts.map(s => `<option value="${s}"${s === cur ? ' selected' : ''}>${esc(E.ST[s].name)}駅</option>`).join('')}</select>
        <button type="button" class="go" data-buy="${key}" ${ok ? '' : 'disabled'} data-arm="${confirmKey === key ? 1 : 0}">${confirmKey === key ? 'もう一度押すと決定' : '建てる'}</button>` : '<span class="sub">建てられる駅はもうありません</span>'}
      ${!ok && opts.length ? '<span class="sub">積み立てが足りません</span>' : ''}</div></div>`;
  }

  /* ---- グラフ（SVG・3段：利益／乗降客数／満足度） ---- */
  const COL = { pos: '#2f8a4a', neg: '#c0392b', ride: 'var(--accent)', sat: '#b5891e', grid: 'var(--line)', ink: 'var(--muted)' };
  function rows(T) {
    let L = st.log.slice(); if (range) L = L.slice(-range);
    const out = L.map(r => ({ ...r, est: false }));
    if (T) out.push({ day: E.day(), profit: T.m.profit, boardAlight: T.m.riders * 2, sat: T.sat.score, est: true });
    return out;
  }
  function chart(T) {
    const R = rows(T); if (!R.length) return '<div class="sub">まだ記録がありません</div>';
    const W = 760, padL = 64, padR = 12, H1 = 120, H2 = 90, H3 = 80, gap = 44, top = 26;
    const n = R.length, bw = Math.max(3, Math.min(26, (W - padL - padR) / n * 0.7)), X = i => padL + (W - padL - padR) * (n === 1 ? 0.5 : i / (n - 1) * (1 - 1 / n) + 0.5 / n);
    const y1 = top, y2 = y1 + H1 + gap, y3 = y2 + H2 + gap, Hh = y3 + H3 + 22;
    const pMax = Math.max(1, ...R.map(r => r.profit)), pMin = Math.min(0, ...R.map(r => r.profit)), pSpan = (pMax - pMin) || 1;
    const P = v => y1 + H1 * (1 - (v - pMin) / pSpan);
    const rv = R.map(r => r.boardAlight), rMin = Math.min(...rv) * 0.97, rMax = Math.max(...rv) * 1.03 || 1;
    const RY = v => y2 + H2 * (1 - (v - rMin) / (rMax - rMin || 1));
    const SY = v => y3 + H3 * (1 - v / 100);
    let s = `<svg viewBox="0 0 ${W} ${Hh}" role="img" aria-label="運行日ごとの利益・乗降客数・満足度">`;
    const lab = (y, t, c) => `<text x="${padL}" y="${y - 12}" font-size="12" font-weight="700" fill="${c}">${t}</text>`;
    s += lab(y1, '経費を引いた利益（円）', COL.pos) + lab(y2, '乗降客数（人・乗車×2）', COL.ride) + lab(y3, '乗客の満足度（0〜100）', COL.sat);
    const axis = (y, h, ticks, fmtT, Y) => ticks.map(v => `<line x1="${padL}" x2="${W - padR}" y1="${Y(v)}" y2="${Y(v)}" stroke="${COL.grid}" stroke-width="1"/><text x="${padL - 4}" y="${Y(v) + 4}" font-size="10" text-anchor="end" fill="${COL.ink}">${fmtT(v)}</text>`).join('');
    s += axis(y1, H1, [pMin, (pMin + pMax) / 2, pMax].filter((v, i, a) => a.indexOf(v) === i), v => !v ? '0' : (v / 1e4 >= 1000 || v / 1e4 <= -1000) ? (v / 1e8).toFixed(2) + '億' : Math.round(v / 1e4) + '万', P);
    s += axis(y2, H2, [rMin, (rMin + rMax) / 2, rMax], v => (v / 1e4).toFixed(1) + '万', RY);
    s += axis(y3, H3, [0, 50, 100], v => String(v), SY);
    R.forEach((r, i) => { const x = X(i), y0 = P(0), y = P(r.profit);
      s += `<rect x="${x - bw / 2}" y="${Math.min(y, y0)}" width="${bw}" height="${Math.max(1, Math.abs(y - y0))}" fill="${r.profit >= 0 ? COL.pos : COL.neg}" ${r.est ? 'fill-opacity=".35" stroke-dasharray="3 2" stroke="' + COL.pos + '"' : ''}/>`;
      if (r.spent) s += `<text x="${x}" y="${y1 - 2}" font-size="10" text-anchor="middle" fill="${COL.ink}">▼</text>`; });
    const line = (key, Y, col) => { const pts = R.map((r, i) => [X(i), Y(r[key])]); const solid = pts.slice(0, R[R.length - 1].est ? -1 : undefined);
      let o = solid.length > 1 ? `<polyline points="${solid.map(p => p.join(',')).join(' ')}" fill="none" stroke="${col}" stroke-width="2.2"/>` : '';
      if (R[R.length - 1].est && pts.length > 1) o += `<line x1="${pts[pts.length - 2][0]}" y1="${pts[pts.length - 2][1]}" x2="${pts[pts.length - 1][0]}" y2="${pts[pts.length - 1][1]}" stroke="${col}" stroke-width="2" stroke-dasharray="4 3"/>`;
      o += pts.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="${i === pts.length - 1 ? 3.6 : 2.4}" fill="${R[i].est ? 'var(--panel)' : col}" stroke="${col}" stroke-width="1.6"/>`).join(''); return o; };
    s += line('boardAlight', RY, COL.ride) + line('sat', SY, COL.sat);
    const step = Math.max(1, Math.ceil(n / 10));
    R.forEach((r, i) => { if (i % step === 0 || i === n - 1) s += `<text x="${X(i)}" y="${Hh - 6}" font-size="10" text-anchor="middle" fill="${COL.ink}">${r.est ? 'きょう' : '第' + r.day + '日'}</text>`; });
    R.forEach((r, i) => { s += `<rect data-i="${i}" x="${X(i) - (W - padL - padR) / n / 2}" y="0" width="${(W - padL - padR) / n}" height="${Hh}" fill="transparent"/>`; });
    return s + '</svg>';
  }
  function tipText(i, T) {
    const R = rows(T); const r = i == null ? R[R.length - 1] : R[i]; if (!r) return '';
    return `${r.est ? 'きょう（見こみ）' : '第' + r.day + '運行日'}：利益 ${man(r.profit)}・乗降客数 ${num(r.boardAlight)}人・満足度 ${r.sat}${r.spent ? `・投資 ${man(r.spent)}` : ''}${r.bal != null ? `・積み立て ${man(r.bal)}` : ''}`;
  }
  function bindChart() {
    const box = host.querySelector('#keiChart'); if (!box) return;
    const show = e => { const t = e.target.closest('rect[data-i]'); if (!t) return; host.querySelector('#keiTip').textContent = tipText(+t.dataset.i, today()); };
    box.addEventListener('mousemove', show); box.addEventListener('click', show);
  }

  function onInput(e) {
    if (e.target.id === 'keiShare') { st.share = +e.target.value / 100; host.querySelector('#keiShareV').textContent = e.target.value + '%'; save(); }
  }
  function onClick(e) {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.money) { try { minatoMoney.open(); } catch (e2) { } return; }
    if (b.dataset.range != null) { range = +b.dataset.range; render(); return; }
    if (b.dataset.maint) { st.maint = b.dataset.maint; save(); render(); return; }
    if (b.dataset.buy) {
      const id = b.dataset.buy, sel = host.querySelector(`select[data-st="${id}"]`), s = sel ? sel.value : null;
      if (confirmKey !== id) { confirmKey = id; render(); const s2 = host.querySelector(`select[data-st="${id}"]`); if (s2 && s) s2.value = s; setTimeout(() => { if (confirmKey === id) { confirmKey = null; render(); } }, 4000); return; }
      confirmKey = null;
      const r = K.buy(cfg, st, id, s, E.day());
      save(); render();
      if (!r.ok) { const tip = host.querySelector('#keiTip'); if (tip) tip.textContent = r.why; }
    }
  }

  window.KeieiView = { init, dayEnd, fx, incidentK, render, get state() { return st; } };
})();
