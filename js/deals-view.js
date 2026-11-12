/* =====================================================================
   取引の相談窓口｜画面（第1回・2026-11-12。docs/deals-plan.md）
   ・センターの画面（js/center-view.js）の2つ目のタブ。相談の一覧（受信箱）→ 中身と見込み → 返事、契約中の取引。
   ・計算は js/deals-core.js。見込みの数は minatoKiosk.flowInfo()（納品書の slip.lines・HaisoCore.dayPlan の便）から読むだけ。
   ・保存は dia-deals（{v:1,seed,d0,dec,deals}）。ここで書くのは返事をしたときだけ。
   ・第2回（2026-11-12）から販売の契約は工場とお金につながる（js/links/deals-to-factory.js・deals-to-money.js。結果は c.got）。配送の契約は第3回まで見込みだけ。
   ===================================================================== */
(function(){
'use strict';
const KEY='dia-deals';
const g=(f,d)=>{try{return f();}catch(e){return d;}};
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const N=n=>Math.round(n||0).toLocaleString();
const Y=n=>(n<0?'−':'')+Math.abs(Math.round(n||0)).toLocaleString()+'円';
const hm=t=>{if(t==null)return '—';const m=((Math.round(t)%1440)+1440)%1440;return Math.floor(m/60)+':'+String(m%60).padStart(2,'0');};
const V={cfg:null,cat:null,loading:false,sel:null,flt:'all',rerender:null,err:null};
const DC=()=>window.DealsCore;
const gDay=()=>g(()=>ENS.day,1),gWe=()=>g(()=>COND.day!=='wd',false);
const gNow=()=>{let m=((Date.now()/60000+540)%1440+1440)%1440;if(m<270)m+=1440;return m;};
function load(){try{const S=JSON.parse(localStorage.getItem(KEY)||'null');return DC().valid(S)?S:null;}catch(e){return null;}}
function save(S){try{localStorage.setItem(KEY,JSON.stringify(S));}catch(e){}}
function state(){let S=load();if(!S){S=DC().newState((Date.now()%100000)+1,gDay());save(S);}return S;}
/* 設定と品の一覧は、タブを開いたときに1回だけ読む（トップの読み込みは重くしない） */
function ensure(){if(V.cfg||V.loading)return;V.loading=true;
  Promise.all(['data/deals.json?v=20261112a','data/factory.json','data/kiosk.json',g(()=>MinatoStore.URL,null)||'data/kiosk.json'].map(u=>fetch(u).then(r=>r.ok?r.json():null).catch(()=>null))).then(([d,F,K,M])=>{
    V.loading=false;if(!d||!F){V.err='設定が読めませんでした';}else{V.cfg=d;const pr={};for(const p of [...((M&&M.products)||[]),...((K&&K.products)||[])])pr[p.id]=p;
      V.cat=DC().catalog(g(()=>FactoryNight.kioskMap(F),{}),pid=>pr[pid]);}
    if(V.rerender)V.rerender();});}

const CSS=`.dw{display:grid;gap:12px;--sell:#b8621b;--haul:#1f7a8c;--okc:#2f7d4f;--ngc:#c0392b;--wtc:#b7791f}
.dw .dw-hero{position:relative;overflow:hidden;border:1px solid var(--line);border-radius:14px;padding:14px 16px 12px;background:
  radial-gradient(120% 140% at 100% 0%,color-mix(in srgb,var(--sell) 14%,transparent),transparent 55%),
  radial-gradient(90% 120% at 0% 100%,color-mix(in srgb,var(--haul) 14%,transparent),transparent 60%),var(--panel)}
.dw .dw-hero h3{margin:0;font-family:var(--f-disp);font-weight:400;font-size:clamp(19px,3.6vw,25px);letter-spacing:.08em}
.dw .dw-hero p{margin:4px 0 0;font-size:12px;color:var(--muted);line-height:1.6;max-width:62em}
.dw .dw-kpi{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:12px}
.dw .dw-kpi div{border-top:2px solid var(--line);padding-top:5px;min-width:0}.dw .dw-kpi b{display:block;font-family:var(--f-mono);font-size:19px;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dw .dw-kpi span{font-size:11px;color:var(--muted)}.dw .dw-kpi .s b{color:var(--sell)}.dw .dw-kpi .h b{color:var(--haul)}
.dw .dw-note{display:flex;gap:8px;align-items:flex-start;font-size:11.5px;line-height:1.6;border:1px dashed color-mix(in srgb,var(--wtc) 60%,transparent);border-radius:10px;padding:7px 10px;background:color-mix(in srgb,var(--wtc) 7%,transparent)}
.dw .dw-note b{color:var(--wtc);white-space:nowrap}
.dw .dw-tools{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between}
.dw .dw-seg{display:inline-flex;border:1px solid var(--line);border-radius:999px;overflow:hidden;background:var(--panel);max-width:100%;overflow-x:auto}
.dw .dw-seg button{font:inherit;font-size:12.5px;border:0;background:transparent;color:var(--ink);padding:6px 13px;min-height:34px;cursor:pointer;white-space:nowrap}
.dw .dw-seg button[aria-pressed="true"]{background:var(--ink);color:var(--paper)}
.dw .dw-main{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,7fr);gap:12px;align-items:start}
.dw .dw-list{display:grid;gap:8px;min-width:0}
.dw .dw-card{position:relative;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 10px;text-align:left;font:inherit;color:var(--ink);cursor:pointer;
  border:1px solid var(--line);border-left:5px solid var(--k);border-radius:12px;padding:10px 12px 10px 12px;background:var(--panel);min-width:0;width:100%;box-sizing:border-box}
.dw .dw-card.sell{--k:var(--sell)}.dw .dw-card.haul{--k:var(--haul)}
.dw .dw-card[aria-current="true"]{box-shadow:0 0 0 2px var(--k);background:color-mix(in srgb,var(--k) 6%,var(--panel))}
.dw .dw-card .who{font-size:14px;font-weight:700;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dw .dw-card .what{grid-column:1/-1;font-size:12.5px;line-height:1.5;color:var(--ink);overflow-wrap:anywhere}
.dw .dw-card .meta{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:4px 10px;font-size:11px;color:var(--muted)}
.dw .tags{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:4px}
.dw .tg{font-size:10.5px;line-height:1;border-radius:999px;padding:4px 8px;border:1px solid var(--line);color:var(--muted);white-space:nowrap}
.dw .tg.k{background:var(--k);border-color:var(--k);color:#fff}.dw .tg.big{border-color:var(--ink);color:var(--ink);font-weight:700}.dw .tg.hold{border-color:var(--wtc);color:var(--wtc)}.dw .tg.last{border-color:var(--ngc);color:var(--ngc)}
.dw .stamp{width:50px;height:50px;border-radius:50%;border:1.5px solid color-mix(in srgb,var(--k) 70%,transparent);color:var(--k);display:grid;place-items:center;text-align:center;
  font-family:var(--f-led);font-size:10px;line-height:1.15;transform:rotate(-8deg);opacity:.9;grid-row:1/3;grid-column:2}
.dw .stamp b{display:block;font-size:13px;font-weight:400}
.dw .dw-empty{border:1px dashed var(--line);border-radius:12px;padding:22px 12px;text-align:center;color:var(--muted);font-size:12.5px;line-height:1.7}
.dw .dw-det{position:sticky;top:8px;border:1px solid var(--line);border-radius:14px;background:var(--panel);overflow:hidden;min-width:0}
.dw .dw-det .top{padding:12px 14px;border-bottom:1px solid var(--line);background:linear-gradient(90deg,color-mix(in srgb,var(--k) 16%,transparent),transparent 70%)}
.dw .dw-det.sell{--k:var(--sell)}.dw .dw-det.haul{--k:var(--haul)}
.dw .dw-det h4{margin:0;font-size:16px;line-height:1.4}.dw .dw-det .top p{margin:3px 0 0;font-size:11.5px;color:var(--muted);line-height:1.6}
.dw .sec{padding:11px 14px;border-bottom:1px solid var(--line)}.dw .sec:last-child{border-bottom:0}
.dw .sec h5{margin:0 0 7px;font-size:12px;letter-spacing:.1em;color:var(--muted);font-weight:700;display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.dw .sec h5 .v{margin-left:auto;letter-spacing:0;font-size:11px;border-radius:999px;padding:2px 8px;color:#fff}
.dw .v.ok{background:var(--okc)}.dw .v.tight{background:var(--wtc)}.dw .v.over,.dw .v.none{background:var(--ngc)}.dw .v.na{background:var(--muted)}.dw .v.first,.dw .v.other{background:var(--wtc)}.dw .v.after{background:var(--okc)}
.dw table{width:100%;border-collapse:collapse;font-size:12.5px;font-variant-numeric:tabular-nums}.dw th{font-weight:500;color:var(--muted);font-size:11px;text-align:right;padding:3px 5px;border-bottom:1px solid var(--line)}
.dw td{padding:5px;border-bottom:1px solid var(--line);text-align:right}.dw th:first-child,.dw td:first-child{text-align:left}.dw tr:last-child td{border-bottom:0}
.dw .terms{display:grid;grid-template-columns:auto minmax(0,1fr);gap:4px 12px;font-size:12.5px;line-height:1.5}.dw .terms dt{color:var(--muted);font-size:11.5px}.dw .terms dd{margin:0;overflow-wrap:anywhere}
.dw .say{font-size:12.5px;line-height:1.7;margin:6px 0 0}.dw .say b{font-family:var(--f-mono)}.dw .say.small{font-size:11.5px;color:var(--muted)}
.dw .tl{position:relative;height:30px;margin:4px 0 16px;border-radius:6px;background:color-mix(in srgb,var(--line) 40%,transparent)}
.dw .tl i{position:absolute;top:6px;height:18px;border-radius:4px}
.dw .tl .run{background:color-mix(in srgb,#8a5a2b 55%,transparent)}.dw .tl .spare{background:repeating-linear-gradient(135deg,color-mix(in srgb,var(--okc) 35%,transparent) 0 5px,transparent 5px 10px);border:1px dashed var(--okc)}
.dw .tl .need{top:10px;height:10px;background:var(--sell);border-radius:3px}.dw .tl .need.x{background:var(--ngc)}
.dw .tl .dl{position:absolute;top:-3px;bottom:-3px;border-left:2px solid var(--ngc)}.dw .tl .dl span,.dw .tl .lb{position:absolute;top:31px;font-size:9.5px;color:var(--muted);white-space:nowrap;transform:translateX(-50%)}
.dw .tl .dl span{color:var(--ngc);left:0}
.dw .slots{display:flex;gap:3px;flex-wrap:wrap;margin:4px 0 2px}.dw .slots i{width:20px;height:24px;border-radius:4px;border:1px solid var(--line);background:var(--paper);position:relative;overflow:hidden}
.dw .slots i u{position:absolute;left:0;right:0;bottom:0;background:#7b8794}.dw .slots i.o u{background:var(--haul)}.dw .slots i.x{border-color:var(--ngc)}.dw .slots i.x u{background:var(--ngc)}
.dw .money{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1px;background:var(--line);border:1px solid var(--line);border-radius:10px;overflow:hidden}
.dw .money div{background:var(--paper);padding:7px 9px;min-width:0}.dw .money b{display:block;font-family:var(--f-mono);font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.dw .money span{font-size:10.5px;color:var(--muted)}
.dw .money .p b{color:var(--okc)}.dw .money .m b{color:var(--ngc)}
.dw .acts{display:flex;flex-wrap:wrap;gap:8px}
.dw .acts button{font:inherit;font-size:13px;border-radius:999px;padding:8px 15px;min-height:40px;cursor:pointer;border:1px solid var(--line);background:var(--paper);color:var(--ink)}
.dw .acts .go{background:var(--k);border-color:var(--k);color:#fff;font-weight:700}.dw .acts .go2{border-color:var(--k);color:var(--k);font-weight:700}.dw .acts .no{color:var(--ngc)}
.dw .ct{display:grid;gap:8px}.dw .ctr{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 10px;border:1px solid var(--line);border-left:5px solid var(--k);border-radius:10px;padding:8px 11px;background:var(--panel);font-size:12.5px}
.dw .ctr.sell{--k:var(--sell)}.dw .ctr.haul{--k:var(--haul)}.dw .ctr.done{opacity:.6}
.dw .ctr .r{text-align:right;font-family:var(--f-mono);font-size:13px;white-space:nowrap}.dw .ctr small{color:var(--muted);font-size:11px;grid-column:1/-1;line-height:1.5}
.dw .bar2{grid-column:1/-1;height:5px;border-radius:3px;background:color-mix(in srgb,var(--line) 60%,transparent);overflow:hidden}.dw .bar2 u{display:block;height:100%;background:var(--k)}
.dw .gs{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:4px;margin:3px 0 1px}.dw .gs span{font-size:11px;color:var(--muted);border:1px solid var(--line);border-radius:7px;padding:3px 7px;background:var(--paper);white-space:nowrap}
.dw .gs b{font-family:var(--f-mono);font-size:12.5px;color:var(--ink);font-weight:600}.dw .gs .o b{color:var(--okc)}.dw .gs .x{border-color:color-mix(in srgb,var(--ngc) 50%,transparent)}.dw .gs .x b{color:var(--ngc)}.dw .gs .l{border-style:dashed}
.dw details{border:1px solid var(--line);border-radius:12px;padding:7px 12px;background:var(--panel)}.dw summary{cursor:pointer;font-size:13px;font-weight:700}
.dw .src{font-size:11px;color:var(--muted);line-height:1.65}
@media (max-width:860px){.dw .dw-main{grid-template-columns:minmax(0,1fr)}.dw .dw-det{position:static}}
@media (max-width:520px){.dw .dw-kpi{grid-template-columns:repeat(2,minmax(0,1fr))}.dw .money{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}.dw .money div:last-child{grid-column:1/-1}.dw .stamp{width:42px;height:42px;font-size:9px}.dw .stamp b{font-size:11px}}`;

/* 見込みに使う数（読むだけ）：工場＝納品書の slip.lines と開始の設定、配送＝HaisoCore.dayPlan の便 */
function inputs(){const I=g(()=>minatoKiosk.flowInfo(),null);if(!I||I.err)return {err:I&&I.err||'売店の画面を読み込み中です'};
  const F={lines:(I.slip&&I.slip.lines)||{},start:I.start||{},deadline:I.deadline,own:{}};
  if(I.slip&&I.slip.items)for(const pid in I.slip.items){const L=I.lineOf[pid];if(L)F.own[L]=(F.own[L]||0)+(I.slip.items[pid][0]||0);}
  F.dealIn={};if(I.slip&&I.slip.deals)for(const id in I.slip.deals)for(const pid in I.slip.deals[id].it){const L=I.lineOf[pid];if(L)F.dealIn[L]=(F.dealIn[L]||0)+(I.slip.deals[id].it[pid][0]||0);}   /* 今夜の納品書にもう入っている契約の分（第2回） */
  const P={runs:(I.haiso&&I.haiso.runs)||[],trucks:g(()=>minatoKiosk.ccfg.slip.trucks,[]),H:g(()=>minatoHaiso.cfg,null)||{}};
  return {F,P,slipNo:I.slip&&I.slip.no,day:I.day};}

function what(o){const C=V.cfg,stn=s=>(C.stations||{})[s]||s;
  if(o.kind==='sell'){const q=DC().qtyOf(o,false),qe=DC().qtyOf(o,true);return `${esc(DC().LN[o.line]||o.line)}　${o.items.map(i=>esc(i.name)).join('・')}　<b>平日 ${N(q)}</b>・土日 ${N(qe)}`;}
  const cg=(C.haul.cargo.find(x=>x.id===o.cargo)||{}).name||o.cargo;return `${esc(cg)}の荷物　かご車 <b>${o.carts}</b>台　→ ${esc(stn(o.to))}駅`;}
function handName(o){return ((V.cfg.sell.hand||[]).find(h=>h.id===o.hand)||{}).name||o.hand;}
function card(o){const big=o.size==='big',k=o.kind;
  const tags=[`<span class="tg k">${k==='sell'?'販売':'配送'}</span>`,`<span class="tg${big?' big':''}">${big?'大口':'小口'}</span>`,`<span class="tg">${o.via==='intro'?'問屋の紹介':'相手から'}</span>`,
    o.st2==='hold'?'<span class="tg hold">保留中</span>':'',o.left<=0?'<span class="tg last">きょうが期限</span>':''].join('');
  const tail=k==='sell'?`${esc(handName(o))} ${hm(o.handT)}・卸値 ${N(o.items.reduce((a,i)=>a+i.price*i.wd,0)/Math.max(1,DC().qtyOf(o,false)))}円/個`:`${hm(o.win[0])}〜${hm(o.win[1])}・運賃 ${N(o.fare)}円/日`;
  return `<button type="button" class="dw-card ${k}" data-id="${esc(o.id)}" aria-current="${V.sel===o.id}"><span class="who">${esc(o.name)}</span>
    <span class="stamp">第${o.day}日<b>${hm(o.t)}</b></span><span class="tags">${tags}</span><span class="what">${what(o)}</span>
    <span class="meta"><span>${tail}</span><span>期限 第${o.exp}運行日（あと${Math.max(0,o.left)}日）</span><span>${o.days}日間</span></span></button>`;}

/* 工場の時刻の帯：開始 → 最後の品 → 締め切り（空き）、この相談の分 */
function facBar(x){const t0=x.start,need=x.rate?x.q/x.rate:null,end=Math.max(x.deadline+20,x.last+(need||0)+10),W=end-t0,P=v=>((v-t0)/W*100).toFixed(2)+'%',Wd=v=>(Math.max(0,v)/W*100).toFixed(2)+'%';
  const over=need!=null&&x.last+need>x.deadline;
  return `<div class="tl" role="img" aria-label="ラインの時刻"><i class="run" style="left:0;width:${Wd(x.last-t0)}"></i>${x.deadline>x.last?`<i class="spare" style="left:${P(x.last)};width:${Wd(x.deadline-x.last)}"></i>`:''}
    ${need!=null?`<i class="need${over?' x':''}" style="left:${P(x.last)};width:${Wd(need)}"></i>`:''}<span class="dl" style="left:${P(x.deadline)}"><span>締め切り ${hm(x.deadline)}</span></span>
    <span class="lb" style="left:0;transform:none">開始 ${hm(t0)}</span><span class="lb" style="left:${P(x.last)}">最後 ${hm(x.last)}</span></div>`;}
function slots(used,add,cap){const n=Math.max(cap,Math.ceil(used+add)),out=[];for(let i=0;i<n;i++){const u=Math.max(0,Math.min(1,used-i)),a=Math.max(0,Math.min(1,used+add-i))-u,x=i>=cap;
  out.push(`<i class="${a>0?'o':''}${x?' x':''}"><u style="height:${((u+a)*100).toFixed(0)}%;${u>0&&a>0?`background:linear-gradient(to top,#7b8794 ${(u/(u+a)*100).toFixed(0)}%,var(--haul) 0)`:''}"></u></i>`);}return `<div class="slots" aria-label="かご車">${out.join('')}</div>`;}

function haulSec(x,o,title){const stn=s=>(V.cfg.stations||{})[s]||s;
  const verdict={after:'自社の店のあとに寄れる',first:'先に寄れば間に合う',other:'港浜急送に頼む',none:'合う便がない'}[x.mode]||'';
  let body='';
  if(x.mode==='after'||x.mode==='first'){const r=x.run;body=`<p class="say">${esc(x.truck)}の<b>${esc(r.bin)}</b>（センター ${hm(r.depart)} 発）。いま積むかご車 <b>${r.carts}</b>／${r.cap}台、この荷物 <b>${o.carts}</b>台。</p>${slots(r.carts,o.carts,r.cap)}
    <p class="say">${esc(stn(o.to))}駅に <b>${hm(x.arrive)}</b> ごろ着く見込み（希望 ${hm(o.win[0])}〜${hm(o.win[1])}${x.wait>0?`・${x.wait}分早いので待つ`:''}）。走る時間 +${x.addMin}分・+${x.km}km。</p>
    ${x.help?`<p class="say" style="color:var(--ngc)">かご車が足りないので、港浜急送の応援便がいります（1日 ${N(g(()=>minatoHaiso.cfg.otherFee.extra,15000))}円）。</p>`:''}
    <p class="say"><b>自社2店への影響：</b>${x.mode==='first'?`<span style="color:var(--wtc)">先に寄ると、この便の自社の店が約 <b>${x.ownDelay}</b>分 遅れます</span>`:'自社の店のあとに寄るので、店に着く時刻は変わりません'}。</p>`;}
  else body=`<p class="say">${esc(x.why||'')}</p>`;
  return `<div class="sec"><h5>${esc(title)}<span class="v ${x.mode}">${verdict}</span></h5>${body}${x.runDay===false?'<p class="say small">きょうは運ばない曜日です（きょうの便で見積もっています）。</p>':''}</div>`;}

function detail(o,inp){const C=V.cfg,we=gWe(),stn=s=>(C.stations||{})[s]||s,day=gDay(),S=state();
  const pt=(C.partners||[]).find(p=>p.id===o.partner)||{};
  let terms='',outl='',money=null,period=o.days;
  if(o.kind==='sell'){
    terms=`<table><thead><tr><th>品</th><th>平日</th><th>土日</th><th>卸値</th><th>売店の仕入れ値</th></tr></thead><tbody>${o.items.map(i=>`<tr><td>${esc(i.name)}</td><td>${N(i.wd)}</td><td>${N(i.we)}</td><td>${N(i.price)}円</td><td>${N(i.ref)}円</td></tr>`).join('')}</tbody></table>
      <dl class="terms" style="margin-top:8px"><dt>受け渡し</dt><dd>${esc(handName(o))}（${hm(o.handT)}${o.hand==='deliver'?`・${esc(stn(o.st))}駅の店へ`:''}）</dd><dt>期間</dt><dd>${o.days}運行日（お試しは${C.trial}日）</dd><dt>相手</dt><dd>${esc(pt.note||'')}</dd></dl>`;
    if(inp.err)outl=`<div class="sec"><h5>工場の見込み<span class="v na">まだ</span></h5><p class="say">${esc(inp.err)}</p></div>`;
    else{const x=DC().sellOutlook(C,S,o,inp.F,day,we);money=x.money;
      if(x.na)outl=`<div class="sec"><h5>工場（港浜フーズ）の見込み<span class="v na">まだ</span></h5><p class="say">${esc(x.na)}</p></div>`;
      else{const vd={ok:'間に合う',tight:'ぎりぎり',over:'足りない'}[x.fit];
        outl=`<div class="sec"><h5>工場（港浜フーズ）${esc(x.lineName)}のライン<span class="v ${x.fit}">${vd}</span></h5>${facBar(x)}
          <p class="say">今夜の${esc(x.lineName)}は <b>${N(x.order)}</b>${x.line==='sand'?'パック':'個'}（うち自社2店 ${N(x.own)}${x.din?`・契約の取引先 ${N(x.din)}`:''}）。最後の品が ${hm(x.last)}、あと <b>${Math.max(0,x.spareMin)}</b>分 のばせる（締め切り・人の勤務）。この速さ（1分に約${x.rate?x.rate.toFixed(1):'—'}）なら、あと約 <b>${N(x.spare)}</b> 作れる見込み${x.cm?`（引き受けた契約の ${N(x.cm)} を引いた数）`:''}。</p>
          <p class="say">この相談は${we?'土日':'平日'} <b>${N(x.q)}</b>。${x.fit==='ok'?'締め切りまでに作れます。':`締め切りを約 <b>${x.overMin??'—'}</b>分 すぎる見込みです。${x.fit==='tight'?'足りない夜は、今までの取引先の分から減らせば間に合います。':'足りない夜は、契約の分も減ってしまいます。'}`}</p>
          <p class="say"><b>自社2店への影響：</b>足りない夜は 自社の売店 → 契約の取引先 → 今までの取引先 の順に作るので、自社の店の分は減りません。</p>
          <p class="say small">納品書 ${esc(inp.slipNo||'')} の結果から読んだ見込みです（工場の計算はやり直していません）。</p></div>`;}
      if(o.hand==='deliver'&&!inp.err){const cpc=g(()=>minatoHaiso.cfg.perCart.factory,300),hx=DC().haulOutlook(C,{carts:Math.max(0.5,Math.round(DC().qtyOf(o,we)/cpc*2)/2),to:o.st,win:[o.handT-60,o.handT],cargo:'chill',dow:'all',fare:0},inp.P,we);
        outl+=haulSec(hx,{carts:Math.max(0.5,Math.round(DC().qtyOf(o,we)/cpc*2)/2),to:o.st,win:[o.handT-60,o.handT]},'店まで届ける（配送の契約がもう1つ・第3回）');}}
  }else{const cg=C.haul.cargo.find(x=>x.id===o.cargo)||{};
    terms=`<dl class="terms"><dt>荷物</dt><dd>${esc(cg.name)}・かご車 ${o.carts}台</dd><dt>積む場所</dt><dd>${esc(o.from)}</dd><dt>届け先</dt><dd>${esc(stn(o.to))}駅（${hm(o.win[0])}〜${hm(o.win[1])}）</dd>
      <dt>曜日</dt><dd>${esc(((C.haul.dow||[]).find(d=>d.id===o.dow)||{}).name||'')}</dd><dt>運賃</dt><dd>${N(o.fare)}円/日</dd><dt>期間</dt><dd>${o.days}運行日（お試しは${C.trial}日）</dd><dt>相手</dt><dd>${esc(pt.note||'')}</dd></dl>`;
    if(inp.err)outl=`<div class="sec"><h5>配送の見込み<span class="v na">まだ</span></h5><p class="say">${esc(inp.err)}</p></div>`;
    else{const x=DC().haulOutlook(C,o,inp.P,we);money={rev:x.fare,cost:x.cost,profit:x.profit};outl=haulSec(x,o,'配送（みなと川運輸）の見込み');}}
  const mon=money?`<div class="sec"><h5>お金の見込み（1日・${o.kind==='sell'?'工場':'配送会社'}）</h5><div class="money"><div><b>${Y(money.rev)}</b><span>${o.kind==='sell'?'売上（卸値）':'運賃'}</span></div><div class="m"><b>${Y(money.cost)}</b><span>${o.kind==='sell'?(money.fee?`作る費用（仮の割合）＋港浜急送 ${N(money.fee)}円`:'作る費用（仮の割合）'):'増える燃料・運転手・応援'}</span></div><div class="${money.profit>=0?'p':'m'}"><b>${Y(money.profit)}</b><span>もうけ</span></div></div>
    <p class="say small">${period}日つづけると、もうけは約 ${Y(money.profit*period)}（${we?'土日':'平日'}の数で計算）。${o.kind==='sell'&&money.ownRev?`同じ数を自社の売店に出したときの工場の手取りは ${Y(money.ownRev)}。`:''}</p></div>`:'';
  const acts=`<div class="sec"><h5>返事</h5><div class="acts"><button type="button" class="go" data-act="accept" data-mode="trial">お試し${C.trial}日で引き受ける</button><button type="button" class="go2" data-act="accept" data-mode="keep">${o.days}日 続けて引き受ける</button>
    ${o.st2==='hold'?'':'<button type="button" data-act="hold">保留（期限まで）</button>'}<button type="button" class="no" data-act="decline">断る</button></div>
    <p class="say small">契約は次の運行日から。数は前の日の ${hm(C.fixAt)} に確定する形です。${o.kind==='sell'?'販売の契約は、次の運行日から工場の注文（取引先・契約の行）とお金（取引先 → 工場の請求書）に入ります。':'<b>配送の契約はまだ見込みだけ</b>で、配送の便・お金には入りません（第3回でつなぎます）。'}</p></div>`;
  return `<div class="dw-det ${o.kind}"><div class="top"><h4>${esc(o.name)}</h4><p>${o.kind==='sell'?'販売の相談（工場が品を売る）':'配送の相談（みなと川運輸が荷物を運ぶ）'}・${o.via==='intro'?'問屋からの紹介':'相手からの依頼'}・第${o.day}運行日 ${hm(o.t)} に届いた</p></div>
    <div class="sec"><h5>条件</h5>${terms}</div>${outl}${mon}${acts}</div>`;}

function contractsHtml(S,day){const C=V.cfg,stn=s=>(C.stations||{})[s]||s,list=DC().contracts(S,day).sort((a,b)=>({on:0,soon:1,done:2}[a.state]-{on:0,soon:1,done:2}[b.state])||b.at-a.at);
  if(!list.length)return '<div class="dw-empty">契約中の取引はまだありません。相談を引き受けると、ここに並びます。</div>';
  return `<div class="ct">${list.map(c=>{const o=c.of,len=c.to-c.from+1,gone=Math.max(0,Math.min(len,day-c.from+1)),we=gWe();
    const m=c.kind==='sell'?DC().sellMoney(C,o,we):{profit:o.fare};const st={on:'契約中',soon:'あすから',done:'終わった'}[c.state];
    const w=c.kind==='sell'?`${esc(DC().LN[o.line]||o.line)} ${o.items.map(i=>esc(i.name)).join('・')}　平日 ${N(DC().qtyOf(o,false))}・土日 ${N(DC().qtyOf(o,true))}`:`かご車 ${o.carts}台 → ${esc(stn(o.to))}駅 ${hm(o.win[0])}〜${hm(o.win[1])}`;
    return `<div class="ctr ${c.kind} ${c.state}"><span><b>${esc(o.name)}</b>　<span class="tg">${st}</span> <span class="tg">${c.trial?'お試し':'続ける'}</span></span><span class="r">${c.kind==='sell'?'もうけ':'運賃'} ${Y(m.profit)}/日</span>
      <small>${w}<br>第${c.from}〜${c.to}運行日（${len}日・${gone}日目）・${c.kind==='sell'?gotLine(c):'見込みの運賃。日ごとの結果は配送につないでから（第3回）'}</small><span class="bar2"><u style="width:${(gone/len*100).toFixed(1)}%"></u></span></div>`;}).join('')}</div>`;}

/* 販売の契約の結果（第2回）：納品書のあとに積み上げた数（c.got）。まだ1日もなければ見込み */
function gotLine(c){const x=c.got;if(!x||!x.n)return '見込みのもうけ。結果は契約の始まる運行日の納品書から';
  const ld=x.ld||[0,0,0],sh=x.q-x.s,pc=x.q?x.s/x.q*100:100;
  return `工場の納品書から（実際の結果）</small><span class="gs"><span><b>${x.n}</b>日</span><span>届けた <b>${N(x.s)}</b>／${N(x.q)}</span><span class="${sh>0?'x':'o'}">${sh>0?`足りなかった <b>${N(sh)}</b>`:'不足 <b>0</b>'}</span><span>届けた割合 <b>${pc.toFixed(pc<100?1:0)}%</b></span><span>もうけ <b>${Y(x.y)}</b></span><span class="l">第${ld[0]}運行日 ${N(ld[2])}／${N(ld[1])}</span></span><small>`;}
function html(){if(!DC())return '<div class="card empty">窓口の計算を読み込み中です</div>';ensure();if(!V.cfg)return `<div class="card empty">${V.err?esc(V.err):'取引の相談窓口を開いています…'}</div>`;
  const S=state(),day=gDay(),now=gNow();DC().prune(V.cfg,S,day);
  const box=DC().inbox(V.cfg,V.cat,S,day,now),inp=inputs(),we=gWe();
  const flt={all:x=>true,sell:x=>x.kind==='sell',haul:x=>x.kind==='haul',hold:x=>x.st2==='hold'}[V.flt]||(()=>true),shown=box.filter(flt);
  if(!shown.some(o=>o.id===V.sel))V.sel=shown[0]?shown[0].id:null;const cur=shown.find(o=>o.id===V.sel);
  const cs=DC().contracts(S,day),on=cs.filter(c=>c.state!=='done'),prof=on.reduce((t,c)=>t+(c.kind==='sell'?DC().sellMoney(V.cfg,c.of,we).profit:c.of.fare),0);
  const cnt=k=>box.filter({sell:x=>x.kind==='sell',haul:x=>x.kind==='haul',hold:x=>x.st2==='hold'}[k]).length;
  const recent=Object.entries(S.dec).filter(([id,d])=>d[0]!=='hold').sort((a,b)=>b[1][1]-a[1][1]).slice(0,6);
  return `<div class="dw">
    <div class="dw-hero"><h3>相談の受信箱</h3><p>ほかの会社から「品を売ってほしい」「荷物を運んでほしい」という相談が届きます。工場（港浜フーズ）のラインの空きと、みなと川運輸の便のかご車の空きを見て、引き受けるか決めます。相談は運行日ごとに決まった乱数で届きます（相手の名前はすべて架空・数は仮）。</p>
      <div class="dw-kpi"><div><b>${box.length}</b><span>返事を待つ相談</span></div><div class="s"><b>${cnt('sell')}</b><span>販売の相談</span></div><div class="h"><b>${cnt('haul')}</b><span>配送の相談</span></div><div><b>${Y(prof)}</b><span>契約中・これから ${on.length}件の1日（販売のもうけ＋配送の運賃・見込み）</span></div></div></div>
    <div class="dw-note"><b>第2回</b><span>販売の契約は、工場の注文とお金につながりました（足りない夜は 自社の売店 → 契約の取引先 → 今までの取引先 の順に作ります）。配送の契約は、まだ見込みだけです（第3回でつなぎます）。</span></div>
    <div class="dw-tools"><div class="dw-seg" role="group" aria-label="絞り込み">${[['all','すべて',box.length],['sell','販売',cnt('sell')],['haul','配送',cnt('haul')],['hold','保留',cnt('hold')]].map(([k,l,n])=>`<button type="button" data-flt="${k}" aria-pressed="${V.flt===k}">${l} ${n}</button>`).join('')}</div>
      <span class="src">第${day}運行日・${we?'土日':'平日'}の数で見積もり</span></div>
    <div class="dw-main"><div class="dw-list">${shown.map(card).join('')||`<div class="dw-empty">${box.length?'この絞り込みの相談はありません。':'いま返事を待つ相談はありません。<br>相談は運行日ごとに 0〜2件 届きます。'}</div>`}</div>
      <div>${cur?detail(cur,inp):'<div class="dw-empty">相談を選ぶと、中身と見込みが出ます。</div>'}</div></div>
    <section><h3 style="font-size:14.5px;margin:6px 0 8px">契約中の取引</h3>${contractsHtml(S,day)}</section>
    ${recent.length?`<details><summary>最近の返事（${recent.length}）</summary><table><tbody>${recent.map(([id,d])=>{const c=S.deals.find(x=>x.id===id);return `<tr><td>相談 ${esc(id)}${c?`・${esc(c.of.name)}`:''}</td><td>${d[0]==='ok'?'引き受けた':'断った'}</td><td>第${d[1]}運行日</td></tr>`;}).join('')}</tbody></table></details>`:''}
    <p class="src">数の出どころ：相談の条件と工場の費用の割合・運賃は仮（data/deals.json）。ラインの空きは納品書（その夜の工場の結果）、便とかご車は配送会社の1日の計算（HaisoCore.dayPlan）から読んだ、ゲームの中の数（内）。保存は dia-deals（返事と契約だけ）。</p>
  </div>`;}
function bind(box,rerender){V.rerender=rerender;
  box.querySelectorAll('.dw [data-id]').forEach(b=>b.onclick=()=>{V.sel=b.dataset.id;rerender();const d=box.querySelector('.dw-det');if(d&&window.innerWidth<=860)d.scrollIntoView({block:'start',behavior:'smooth'});});
  box.querySelectorAll('.dw [data-flt]').forEach(b=>b.onclick=()=>{V.flt=b.dataset.flt;rerender();});
  box.querySelectorAll('.dw [data-act]').forEach(b=>b.onclick=()=>{const S=state(),day=gDay(),o=DC().inbox(V.cfg,V.cat,S,day,gNow()).find(x=>x.id===V.sel);if(!o)return;
    DC().decide(V.cfg,S,o,b.dataset.act,day,b.dataset.mode);save(S);if(b.dataset.act!=='hold')V.sel=null;rerender();});}
function count(){if(DC())ensure();if(!V.cfg||!DC())return null;const S=load();if(!S)return null;return DC().inbox(V.cfg,V.cat,S,gDay(),gNow()).length;}
{const s=document.createElement('style');s.textContent=CSS;document.head.appendChild(s);}
window.DealsView={html,bind,count,get cfg(){return V.cfg;}};
})();
