/* =====================================================================
   配送会社（みなと川運輸）の画面（2026-11-09）
   ・きょう（または前の日）の便を、トラックごとの時間の帯で見せる（自社便と他社便を色で分ける）
   ・便ごとの積んだ量（かご車）・距離・運転の時間・費用・運賃
   ・計算は js/haiso-core.js（HaisoCore.dayPlan）。数は minatoKiosk.haisoInput() から読むだけ（何も書かない）
   ===================================================================== */
(function(){
'use strict';
const $=id=>document.getElementById(id),g=(f,d)=>{try{return f();}catch(e){return d;}};
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const yen=n=>(n<0?'−':'')+'¥'+Math.abs(Math.round(n)).toLocaleString();
const hm=t=>{t=Math.round(t);const h=Math.floor(((t%1440)+1440)%1440/60),m=((t%60)+60)%60;return h+':'+String(m).padStart(2,'0');};
const V={open:false,back:0,H:null,CO:null,timer:0};
Promise.all(['data/haiso.json?v=20261109m','data/companies.json?v=20261109g'].map(u=>fetch(u).then(r=>r.ok?r.json():null).catch(()=>null))).then(([h,c])=>{V.H=h;V.CO=c;if(V.open)render();});
const coName=id=>g(()=>V.CO.companies.find(x=>x.id===id).name,id);

const CSS=`.hzv{position:fixed;inset:0;z-index:85;background:var(--paper);color:var(--ink);overflow:auto;padding:calc(env(safe-area-inset-top,0px) + 14px) max(14px,env(safe-area-inset-right,0px)) calc(env(safe-area-inset-bottom,0px) + 24px) max(14px,env(safe-area-inset-left,0px))}
.hzv .in{max-width:1100px;margin:0 auto;display:grid;gap:12px}
.hzv .hd{display:flex;flex-wrap:wrap;gap:6px 14px;align-items:flex-end;justify-content:space-between}
.hzv h2{margin:0;font-size:clamp(19px,3.4vw,24px);letter-spacing:.06em}.hzv .sub{margin:3px 0 0;font-size:12.5px;color:var(--muted);line-height:1.6}
.hzv .x{font:inherit;font-size:14px;border:1px solid var(--line);background:var(--panel);color:var(--ink);border-radius:999px;padding:8px 16px;min-height:40px;cursor:pointer}
.hzv .card{border:1px solid var(--line);border-radius:12px;background:var(--panel);padding:12px 14px;min-width:0}
.hzv .card h3{margin:0 0 8px;font-size:14.5px;display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}.hzv .card h3 small{font-weight:400;color:var(--muted);font-size:11.5px}
.hzv .sum{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:1px;background:var(--line);border:1px solid var(--line);border-radius:12px;overflow:hidden}
.hzv .sum>div{background:var(--panel);padding:9px 12px;min-width:0}.hzv .sum b{display:block;font-size:18px;font-variant-numeric:tabular-nums;white-space:nowrap}.hzv .sum span{font-size:11.5px;color:var(--muted)}
.hzv .sum b.neg{color:#c0392b}.hzv .sum b.pos{color:#2f7a4a}
.hzv .days{display:inline-flex;border:1px solid var(--line);border-radius:8px;overflow:hidden;flex-wrap:wrap}.hzv .days button{font:inherit;font-size:12.5px;border:0;background:var(--panel);color:var(--ink);padding:6px 11px;min-height:34px;cursor:pointer}.hzv .days button[aria-pressed="true"]{background:var(--accent);color:var(--accent-ink,#fff)}.hzv .days button:disabled{opacity:.4;cursor:default}
.hzv .gantt{position:relative;display:grid;grid-template-columns:8.5em minmax(0,1fr);row-gap:6px;column-gap:10px;align-items:center}
.hzv .gl{font-size:12px;font-weight:700;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.hzv .gl small{display:block;font-weight:400;color:var(--muted);font-size:10.5px}
.hzv .track{position:relative;height:26px;border-radius:6px;background:color-mix(in srgb,var(--line) 45%,transparent)}
.hzv .rb{position:absolute;top:3px;bottom:3px;border-radius:5px;background:#2f6f9a;color:#fff;font-size:10.5px;display:flex;align-items:center;padding:0 4px;overflow:hidden;white-space:nowrap;min-width:6px}
.hzv .rb .ret{position:absolute;top:0;bottom:0;right:0;background:rgb(255 255 255 / .28)}
.hzv .rb.other{background:#c77d2a}.hzv .rb.late{box-shadow:inset 0 -3px 0 #c0392b}
.hzv .axis{position:relative;height:16px;font-size:10.5px;color:var(--muted)}.hzv .axis span{position:absolute;transform:translateX(-50%)}
.hzv .now{position:absolute;top:0;bottom:0;width:2px;background:#c0392b;pointer-events:none}
.hzv .lg{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:11.5px;color:var(--muted);margin-top:8px}.hzv .lg i{display:inline-block;width:14px;height:10px;border-radius:2px;vertical-align:middle;margin-right:4px}
.hzv table{width:100%;border-collapse:collapse;font-size:12.5px;font-variant-numeric:tabular-nums}.hzv th{font-weight:500;color:var(--muted);font-size:11.5px;text-align:right;padding:4px 6px;border-bottom:1px solid var(--line);white-space:nowrap}.hzv td{padding:5px 6px;border-bottom:1px solid var(--line);text-align:right;white-space:nowrap}.hzv th:first-child,.hzv td:first-child{text-align:left}
.hzv .co{font-size:10.5px;border-radius:4px;padding:1px 5px;color:#fff;background:#2f6f9a}.hzv .co.other{background:#c77d2a}
.hzv .note{font-size:11.5px;color:var(--muted);line-height:1.65;margin:0}
.hzv .empty{padding:30px 10px;text-align:center;color:var(--muted)}
@media (max-width:820px){.hzv .sum{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media (max-width:560px){.hzv .sum{grid-template-columns:repeat(2,minmax(0,1fr))}.hzv .gantt{grid-template-columns:5.5em minmax(0,1fr)}.hzv .sum b{font-size:16px}}`;

function render(){const box=$('hzv');if(!box||!V.open)return;
  const shell=(inner)=>`<div class="in"><div class="hd"><div><h2>${esc(coName('haiso'))}｜配送会社</h2><p class="sub">みなと川グループの運送会社。工場→センターと、センター→店のトラックを走らせる。追いかけ便と、積みきれない便の応援は他社（${esc(coName('other'))}）に頼む。便の数と時刻はゲームの中の結果（内）、費用と運賃は仮（仮）。</p></div><button class="x" id="hzClose">閉じる</button></div>${inner}</div>`;
  const today=g(()=>minatoKiosk.day,null),day=today==null?null:today-V.back,inp=day==null?null:g(()=>minatoKiosk.haisoInput(day),null),C=g(()=>minatoKiosk.ccfg,null);
  if(!V.H||!C||!window.HaisoCore||!window.CenterCore){box.innerHTML=shell('<div class="card empty">設定を読み込み中です。</div>');$('hzClose').onclick=close;return;}
  const dayBtns=[0,1,2,3,4,5,6].map(k=>{const ok=k===0||!!g(()=>minatoKiosk.haisoInput(today-k),null);return `<button type="button" data-back="${k}" aria-pressed="${V.back===k}" ${ok?'':'disabled'}>${k===0?'きょう':k===1?'きのう':k+'日前'}</button>`;}).join('');
  if(!inp){box.innerHTML=shell(`<div><div class="days">${dayBtns}</div></div><div class="card empty">${today==null?'まだ売店がありません。':'この日の便の記録がありません（売店を出す前の日・記録が残っていない日）。'}</div>`);$('hzClose').onclick=close;bindDays(box);return;}
  const P=HaisoCore.dayPlan(V.H,C,CenterCore,inp),S=P.sum,T0=150,T1=17*60,X=t=>((Math.max(T0,Math.min(T1,t))-T0)/(T1-T0)*100).toFixed(2)+'%';
  // トラックごとの行（自社：工場→センターの2台、店へのトラック、他社）
  const lanes=[];const add=(id,label,sub)=>{if(!lanes.find(l=>l.id===id))lanes.push({id,label,sub,runs:[]});return lanes.find(l=>l.id===id);};
  for(const r of P.runs){const id=r.leg==='fc'?r.id:r.leg==='cs'?r.truck:'other',L=id==='other'?add('other',coName('other'),'他社'):r.leg==='fc'?add(id,`定温 ${r.id.slice(1)}号`,'工場→センター'):add(id,`トラック${id}`,'センター→店');L.runs.push(r);}
  const now=V.back===0?g(()=>{let m=((Date.now()/60000+540)%1440+1440)%1440;if(m<270)m+=1440;return m;},null):null;
  const lanesH=lanes.map(L=>`<div class="gl">${esc(L.label)}<small>${esc(L.sub)}</small></div><div class="track">${L.runs.map(r=>{const back=r.leg==='cs'?(r.arrive-r.depart):r.leg==='fc'?(r.arrive-r.depart):0,end=r.arrive+back+(V.H.handleMin||15);
      const w=Math.max(0.6,((Math.min(T1,end)-Math.max(T0,r.depart))/(T1-T0)*100)),rw=back?Math.min(100,back/(end-r.depart)*100):0;
      return `<span class="rb ${r.company!==V.H.own?'other':''} ${r.late?'late':''}" style="left:${X(r.depart)};width:${w.toFixed(2)}%" title="${esc(r.label)}｜${hm(r.depart)}出発→${hm(r.arrive)}着${r.carts!=null?`｜かご車${r.carts}台`:''}${r.late?`｜${r.late}分おくれ`:''}">${esc(r.bin?r.bin.replace('の便',''):r.leg==='chase'?'追いかけ':'')}${rw?`<span class="ret" style="width:${rw.toFixed(1)}%"></span>`:''}</span>`;}).join('')}${now!=null&&now>=T0&&now<=T1?`<span class="now" style="left:${X(now)}"></span>`:''}</div>`).join('');
  const ticks=[3,5,7,9,11,13,15,17].map(h=>`<span style="left:${X(h*60)}">${h}:00</span>`).join('');
  const rows=P.runs.map(r=>`<tr><td><span class="co ${r.company!==V.H.own?'other':''}">${r.company===V.H.own?'自社':'他社'}</span> ${esc(r.label)}</td><td>${hm(r.depart)}</td><td>${hm(r.arrive)}${r.late?`（${r.late}分おくれ）`:''}</td><td>${r.carts!=null?r.carts+'台':'—'}</td><td>${r.km?r.km+'km':'—'}</td><td>${r.min?(r.min/60).toFixed(1)+'時間':'—'}</td><td>${r.company===V.H.own?yen(r.cost):'—'}</td><td>${r.fare?yen(r.fare):r.fee?`${yen(r.fee)}（${r.payer==='factory'?'工場':'センター'}が他社へ）`:'—'}</td></tr>`).join('');
  box.innerHTML=shell(`<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between"><div class="days">${dayBtns}</div><span class="note">第${inp.day}運行日・届け先：${esc(inp.store)}</span></div>
    <div class="sum"><div><b>${S.own}便</b><span>自社便（トラック${S.trucks}台）</span></div><div><b>${S.other}便</b><span>他社便（追いかけ・応援）</span></div><div><b>${S.carts}台</b><span>運んだかご車</span></div><div><b>${S.km}km</b><span>走った距離（帰り道を含む）</span></div><div><b>${yen(S.fare)}</b><span>運賃の収入（センター・工場から）</span></div><div><b class="${S.profit<0?'neg':'pos'}">${yen(S.profit)}</b><span>もうけ（費用 ${yen(S.cost)}）</span></div></div>
    <section class="card"><h3>トラックの1日<small>帯の濃いところが行き、うすいところが帰り道。赤い線がいま${S.late?`・赤い下線は遅れた便（最大${S.late}分）`:''}</small></h3>
      <div class="gantt">${lanesH}<div></div><div class="axis">${ticks}</div></div>
      <div class="lg"><span><i style="background:#2f6f9a"></i>自社便（${esc(coName('haiso'))}）</span><span><i style="background:#c77d2a"></i>他社便（${esc(coName('other'))}）</span></div></section>
    <section class="card"><h3>便ごとの内訳<small>かご車は、工場の品${V.H.perCart.factory}個・センターの品${V.H.perCart.center}個で1台（仮）。トラック1台に${V.H.trucks.cs.cap}台まで</small></h3><div style="overflow-x:auto"><table><thead><tr><th>便</th><th>出発</th><th>着</th><th>かご車</th><th>距離</th><th>運転</th><th>費用</th><th>運賃・料金</th></tr></thead><tbody>${rows}</tbody></table></div>
      <p class="note" style="margin-top:8px">費用＝燃料（${V.H.cost.fuelPerKm}円/km）＋運転手（時給${V.H.cost.wageH.toLocaleString()}円・積みおろしと帰り道を含む）＋トラックの持ち費（1台1日${V.H.cost.truckDay.toLocaleString()}円・${S.trucks}台で${yen(S.truckDay)}）。運賃＝店に寄るごと${yen(V.H.fare.perStop)}＋かご車1台${yen(V.H.fare.perCart)}（センターが払う）、工場→センターはかご車1台${yen(V.H.fare.fcPerCart)}（工場が払う。トラックの費用もこの店の荷物の分だけ）。他社便の料金は、頼んだ会社（工場・センター）が他社へ直接払う。お金を会社どうしでやりとりする記録（請求書）は、これから作る。</p></section>`);
  $('hzClose').onclick=close;bindDays(box);}
function bindDays(box){box.querySelectorAll('[data-back]').forEach(b=>b.onclick=()=>{V.back=Number(b.dataset.back);render();});}
function open(){const b=$('hzv');b.hidden=false;V.open=true;V.back=0;b.scrollTop=0;render();clearInterval(V.timer);V.timer=setInterval(render,10000);}
function close(){const b=$('hzv');if(b)b.hidden=true;V.open=false;clearInterval(V.timer);}
/* トップの窓用：きょうの便のまとめ（軽い） */
function summary(day){const inp=g(()=>minatoKiosk.haisoInput(day),null),C=g(()=>minatoKiosk.ccfg,null);if(!inp||!V.H||!C||!window.HaisoCore)return null;return g(()=>HaisoCore.dayPlan(V.H,C,CenterCore,inp).sum,null);}
{const s=document.createElement('style');s.textContent=CSS;document.head.appendChild(s);
 const v=document.createElement('div');v.id='hzv';v.className='hzv';v.hidden=true;v.setAttribute('role','dialog');v.setAttribute('aria-label','配送会社');document.body.appendChild(v);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&V.open)close();});}
window.minatoHaiso={open,close,summary,coName,get cfg(){return V.H;}};
})();
