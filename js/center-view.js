/* =====================================================================
   川辺の配送センター｜倉庫の画面（2026-11-09）
   ・センター在庫の品（飲み物・お菓子・日用品・冷凍のホットスナック）が、いま倉庫にどれだけあるか
   ・問屋（みなと卸）への発注（週2回・おまかせ）と、着く予定
   ・きょう店へ出す数（便ごと）と、次の入荷までに足りなくなるおそれ
   ・計算は js/center-core.js（csOpen・csClose・csOutlook）。数は minatoKiosk.centerInfo() から読むだけ（ここでは何も書かない）
   ===================================================================== */
(function(){
'use strict';
const $=id=>document.getElementById(id),g=(f,d)=>{try{return f();}catch(e){return d;}};
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const N=n=>Math.round(n).toLocaleString();
const V={open:false,only:false,timer:0};
const ST_NAME={ok:'足りている',thin:'薄い',short:'足りなくなるおそれ'};const stName=o=>o.cut?`きょう ${o.cut}個 出せなかった`:ST_NAME[o.st];

const CSS=`.cwv{position:fixed;inset:0;z-index:85;background:var(--paper);color:var(--ink);overflow:auto;padding:calc(env(safe-area-inset-top,0px) + 14px) max(14px,env(safe-area-inset-right,0px)) calc(env(safe-area-inset-bottom,0px) + 24px) max(14px,env(safe-area-inset-left,0px))}
.cwv .in{max-width:1100px;margin:0 auto;display:grid;gap:12px}
.cwv .hd{display:flex;flex-wrap:wrap;gap:6px 14px;align-items:flex-end;justify-content:space-between}
.cwv h2{margin:0;font-size:clamp(19px,3.4vw,24px);letter-spacing:.06em}.cwv .sub{margin:3px 0 0;font-size:12.5px;color:var(--muted);line-height:1.6}
.cwv .x{font:inherit;font-size:14px;border:1px solid var(--line);background:var(--panel);color:var(--ink);border-radius:999px;padding:8px 16px;min-height:40px;cursor:pointer}
.cwv .card{border:1px solid var(--line);border-radius:12px;background:var(--panel);padding:12px 14px}
.cwv .card h3{margin:0 0 8px;font-size:14.5px;display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}.cwv .card h3 small{font-weight:400;color:var(--muted);font-size:11.5px}
.cwv .sum{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:1px;background:var(--line);border:1px solid var(--line);border-radius:12px;overflow:hidden}
.cwv .sum>div{background:var(--panel);padding:9px 12px;min-width:0}.cwv .sum b{display:block;font-size:19px;font-variant-numeric:tabular-nums;white-space:nowrap}.cwv .sum span{font-size:11.5px;color:var(--muted)}
.cwv .sum b.short{color:#c0392b}.cwv .sum b.thin{color:#b7791f}
.cwv .week{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:6px}
.cwv .dy{border:1px solid var(--line);border-radius:9px;padding:6px 7px;min-height:74px;display:flex;flex-direction:column;gap:4px;background:var(--paper);min-width:0}
.cwv .dy.today{border-color:var(--accent);box-shadow:inset 0 3px 0 var(--accent)}.cwv .dy .dn{font-size:11.5px;color:var(--muted)}.cwv .dy .dn b{color:var(--ink);font-size:13px}
.cwv .cwc{font-size:11px;border-radius:6px;padding:2px 5px;line-height:1.35;overflow-wrap:anywhere;color:var(--ink);max-width:100%;display:block}.cwv .cwc.po{background:color-mix(in srgb,var(--accent) 14%,transparent);color:var(--ink)}.cwv .cwc.in{background:color-mix(in srgb,#2b6c9c 16%,transparent)}.cwv .cwc.plan{border:1px dashed var(--line);color:var(--muted)}
.cwv .runs{display:flex;flex-wrap:wrap;gap:8px}.cwv .run{border:1px solid var(--line);border-radius:9px;padding:6px 10px;font-size:12.5px;background:var(--paper)}.cwv .run b{font-size:15px;font-variant-numeric:tabular-nums}.cwv .run.done{opacity:.7}.cwv .run .cut{color:#c0392b;font-weight:700}
.cwv .tools{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between}
.cwv .seg{display:inline-flex;border:1px solid var(--line);border-radius:8px;overflow:hidden}.cwv .seg button{font:inherit;font-size:12.5px;border:0;background:var(--panel);color:var(--ink);padding:6px 12px;min-height:34px;cursor:pointer}.cwv .seg button[aria-pressed="true"]{background:var(--accent);color:var(--accent-ink,#fff)}
.cwv .lg{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:11.5px;color:var(--muted);align-items:center}.cwv .lg i{display:inline-block;vertical-align:middle;margin-right:4px}
.cwv .zone h3 .zs{margin-left:auto;font-size:11.5px;color:var(--muted);font-weight:400}
.cwv .row{display:grid;grid-template-columns:minmax(0,10em) minmax(0,1fr) 17em;gap:4px 12px;align-items:center;padding:6px 0;border-top:1px solid var(--line)}
.cwv .row:first-of-type{border-top:0}
.cwv .nm{font-size:13px;font-weight:700;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.cwv .nm small{display:block;font-weight:400;font-size:11px;color:var(--muted)}
.cwv .bar{position:relative;height:18px;border-radius:5px;background:color-mix(in srgb,var(--line) 55%,transparent);overflow:hidden}
.cwv .bar .f{position:absolute;left:0;top:0;bottom:0;border-radius:5px 0 0 5px;background:#3f8f6b}.cwv .row.thin .bar .f{background:#d29b2c}.cwv .row.short .bar .f{background:#c0392b}
.cwv .bar .inc{position:absolute;top:0;bottom:0;background:repeating-linear-gradient(135deg,color-mix(in srgb,#2b6c9c 40%,transparent) 0 4px,transparent 4px 8px);border:1px dashed #2b6c9c88;border-left:0}
.cwv .bar .need{position:absolute;top:-2px;bottom:-2px;width:2px;background:var(--ink);opacity:.75}
.cwv .bar .q{position:absolute;left:6px;top:0;bottom:0;display:flex;align-items:center;font-size:11px;font-weight:700;color:#fff;text-shadow:0 0 3px rgb(0 0 0 / .5);font-variant-numeric:tabular-nums}
.cwv .nums{font-size:11.5px;color:var(--muted);line-height:1.45;font-variant-numeric:tabular-nums}.cwv .nums b{color:var(--ink)}
.cwv .st{font-size:10.5px;font-weight:700;border-radius:4px;padding:1px 5px;margin-left:4px}.cwv .st.short{background:#c0392b;color:#fff}.cwv .st.thin{background:#d29b2c;color:#fff}
.cwv table{width:100%;border-collapse:collapse;font-size:12.5px;font-variant-numeric:tabular-nums}.cwv th{font-weight:500;color:var(--muted);font-size:11.5px;text-align:right;padding:4px 6px;border-bottom:1px solid var(--line)}.cwv td{padding:5px 6px;border-bottom:1px solid var(--line);text-align:right}.cwv th:first-child,.cwv td:first-child{text-align:left}
.cwv .note{font-size:11.5px;color:var(--muted);line-height:1.65;margin:0}
.cwv .empty{padding:30px 10px;text-align:center;color:var(--muted)}
@media (max-width:820px){.cwv .sum{grid-template-columns:repeat(2,minmax(0,1fr))}.cwv .week{grid-template-columns:repeat(4,minmax(0,1fr))}}
@media (max-width:560px){.cwv .row{grid-template-columns:minmax(0,1fr)}.cwv .nm{white-space:normal}.cwv .sum b{font-size:17px}}`;

function dayLabel(d,day){const k=d-day;return k===0?'きょう':k===1?'あす':k===2?'あさって':k+'日後';}
function render(){const box=$('cwv');if(!box||!V.open)return;const I=g(()=>minatoKiosk.centerInfo(),{err:'売店の画面を読み込み中です'});
  if(I.err){box.innerHTML=`<div class="in"><div class="hd"><div><h2>川辺の配送センター｜倉庫</h2></div><button class="x" id="cwClose">閉じる</button></div><div class="card empty">${esc(I.err)}</div></div>`;$('cwClose').onclick=close;return;}
  const {day,cs,out,ws}=I,pids=Object.keys(out),cnt={ok:0,thin:0,short:0};let total=0;for(const p of pids){cnt[out[p].st]++;total+=out[p].stock;}
  const pend=cs.po.filter(p=>p.st!=='in').sort((a,b)=>a.arr-b.arr),nextIn=pend[0],nextOrd=I.nextOrder;
  // 1週間の帯：発注（済み・予定）と入荷
  const week=[];for(let d=day;d<day+8;d++){const po=cs.po.filter(p=>p.day===d),ar=cs.po.filter(p=>p.arr===d),isOrd=(ws.orderDays||[]).includes(d%7);
    const chips=[...po.map(p=>`<span class="cwc po">発注 ${esc(p.no)}<br>${N(Object.values(p.items).reduce((a,b)=>a+b,0))}個</span>`),
      ...(isOrd&&!po.length&&d>=day?[`<span class="cwc plan">発注の日（おまかせ）</span>`]:[]),
      ...ar.map(p=>`<span class="cwc in">入荷 ${esc(p.no)}${p.st==='in'?'（着いた）':''}<br>${N(Object.values(p.items).reduce((a,b)=>a+b,0))}個</span>`)];
    week.push(`<div class="dy${d===day?' today':''}"><span class="dn"><b>${dayLabel(d,day)}</b> 第${d}運行日</span>${chips.join('')}</div>`);}
  // きょうの店への便（センター在庫の品）
  const runs=I.runs.map(r=>`<div class="run${r.done?' done':''}">${esc(r.name)} ${esc(I.fmt(r.t))}　<b>${N(r.n)}</b>個 ${r.done?'出した':'これから'}${r.ccut?` <span class="cut">足りず ${N(r.ccut)}個 出せ${r.done?'なかった':'ない見込み'}</span>`:''}</div>`).join('')||'<span class="note">きょうの便の数は、売店の計算ができてから出ます。</span>';
  // ゾーンごとの棚
  const zones=(ws.zones||[]).map(z=>{let rows=pids.filter(p=>z.genres.includes(I.genre(p)));if(V.only)rows=rows.filter(p=>out[p].st!=='ok');if(!rows.length)return '';
    const ord={short:0,thin:1,ok:2};rows.sort((a,b)=>ord[out[a].st]-ord[out[b].st]||out[a].cover-out[b].cover);
    const scale=Math.max(1,...rows.map(p=>Math.max(out[p].stock+(out[p].nextQ||0),out[p].until)*1.08));
    const zs=rows.reduce((t,p)=>t+out[p].stock,0);
    return `<section class="card zone"><h3>${esc(z.name)}<span class="zs">${rows.length}品・${N(zs)}個</span></h3>${rows.map(p=>{const o=out[p],w=x=>Math.max(0,Math.min(100,x/scale*100)).toFixed(1)+'%';
      const tq=I.todo[p]||0,dq=I.done[p]||0;
      return `<div class="row ${o.st}"><div class="nm">${esc(I.name(p))}<small>${o.cover>=30?'30日分以上':`約${o.cover.toFixed(1)}日分`}${o.st!=='ok'?`<span class="st ${o.st}">${stName(o)}</span>`:''}</small></div>
        <div class="bar" title="在庫 ${N(o.stock)}個・次の入荷までに出る見込み ${N(o.until)}個・次の入荷 ${N(o.nextQ||0)}個"><span class="f" style="width:${w(o.stock)}"></span>${o.nextQ?`<span class="inc" style="left:${w(o.stock)};width:${w(o.nextQ)}"></span>`:''}<span class="need" style="left:${w(o.until)}"></span><span class="q">${N(o.stock)}</span></div>
        <div class="nums">次の入荷 ${o.planned?`<b>第${o.next}運行日</b>（これから発注）`:`<b>+${N(o.nextQ)}</b>・第${o.next}運行日`}<br>それまでに出る見込み ${N(o.until)}・きょう店へ ${N(dq)}${tq?`＋あと${N(tq)}`:''}</div></div>`;}).join('')}</section>`;}).join('')||`<div class="card empty">${V.only?'足りなくなるおそれ・薄い品はありません。':'品がありません。'}</div>`;
  // 発注の記録
  const hist=cs.po.slice().sort((a,b)=>b.day-a.day).map(p=>`<tr><td>${esc(p.no)}</td><td>第${p.day}運行日</td><td>第${p.arr}運行日</td><td>${Object.keys(p.items).length}品</td><td>${N(Object.values(p.items).reduce((a,b)=>a+b,0))}個</td><td>${p.st==='in'?'着いた':p.arr===day+1?'あす着く':'これから着く'}</td></tr>`).join('');
  box.innerHTML=`<div class="in">
    <div class="hd"><div><h2>川辺の配送センター｜倉庫</h2><p class="sub">第${day}運行日・届け先：${esc(I.store)}。センターに置いておく品（飲み物・お菓子・日用品・冷凍のホットスナック）。問屋（${esc(ws.name)}）へは週2回、センターのおまかせで発注します。在庫と出かたはゲームの中の数（内）、発注の決まりと数字は仮（仮）。</p></div><button class="x" id="cwClose">閉じる</button></div>
    <div class="sum"><div><b>${N(total)}</b><span>倉庫の在庫（${pids.length}品）</span></div><div><b class="${cnt.short?'short':''}">${cnt.short}品</b><span>足りなくなるおそれ</span></div><div><b class="${cnt.thin?'thin':''}">${cnt.thin}品</b><span>薄い</span></div>
      <div><b>${dayLabel(nextOrd,day)}</b><span>次の発注（第${nextOrd}運行日の朝）</span></div><div><b>${nextIn?dayLabel(nextIn.arr,day):'—'}</b><span>${nextIn?`次の入荷 ${N(Object.values(nextIn.items).reduce((a,b)=>a+b,0))}個（${esc(nextIn.no)}）`:'着く予定の発注はありません'}</span></div></div>
    <section class="card"><h3>この先1週間<small>発注の日の朝に頼むと、次の運行日の朝 3:00 にセンターへ着きます（朝の便に間に合う）</small></h3><div class="week">${week.join('')}</div></section>
    <section class="card"><h3>きょう店へ出す数（センター在庫の品）<small>店の在庫を見て、便ごとに足りない分を出す。倉庫に足りなければ減る</small></h3><div class="runs">${runs}</div></section>
    <div class="tools"><div class="seg" role="group" aria-label="表示"><button type="button" data-only="0" aria-pressed="${!V.only}">すべて</button><button type="button" data-only="1" aria-pressed="${V.only}">気になる品だけ（${cnt.short+cnt.thin}）</button></div>
      <div class="lg"><span><i style="width:14px;height:10px;background:#3f8f6b;border-radius:2px"></i>いまの在庫</span><span><i style="width:14px;height:10px;background:repeating-linear-gradient(135deg,#2b6c9c66 0 3px,transparent 3px 6px);border:1px dashed #2b6c9c"></i>次に着く数</span><span><i style="width:2px;height:12px;background:var(--ink)"></i>次の入荷までに出る見込み</span><span><span class="st thin">薄い</span>余裕が少ない</span><span><span class="st short">おそれ</span>入荷の前に切れる見込み</span></div></div>
    ${zones}
    <section class="card"><h3>問屋への発注の記録<small>おまかせ：最近の出かた×次の次の入荷までの日数＋ばらつきの分 − （在庫＋届く予定）を、ケース単位で</small></h3><div style="overflow-x:auto"><table><thead><tr><th>番号</th><th>発注</th><th>着く</th><th>品数</th><th>個数</th><th></th></tr></thead><tbody>${hist||'<tr><td colspan="6">まだ発注していません</td></tr>'}</tbody></table></div></section>
    <p class="note">「足りなくなるおそれ」：いまの在庫から、次の入荷までに出る見込みを引くとマイナス。「薄い」：入荷までは持つが、ばらつきの分（またはおよそ1.5日分）より少ない。出る見込みは、センターが店へ出した数（足りずに出せなかった分を含む）の最近の平均です。</p>
  </div>`;
  $('cwClose').onclick=close;box.querySelectorAll('[data-only]').forEach(b=>b.onclick=()=>{V.only=b.dataset.only==='1';render();});}
function open(){const b=$('cwv');b.hidden=false;V.open=true;b.scrollTop=0;render();clearInterval(V.timer);V.timer=setInterval(render,5000);}
function close(){const b=$('cwv');if(b)b.hidden=true;V.open=false;clearInterval(V.timer);}
{const s=document.createElement('style');s.textContent=CSS;document.head.appendChild(s);
 const v=document.createElement('div');v.id='cwv';v.className='cwv';v.hidden=true;v.setAttribute('role','dialog');v.setAttribute('aria-label','センターの倉庫');document.body.appendChild(v);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&V.open)close();});}
window.minatoCenter={open,close};
})();
