/* =====================================================================
   売店運営（第2段）の画面
   ・計算は js/kiosk-core.js、設定は data/kiosk.json（年代・支払い・場所は data/research.json）。ここは画面だけ。
   ・ゲームの時計（T）・運行日（ENS.day）・その日の条件（COND）・シミュレーション結果（D）を読むだけ。
   ・売店の正面（棚・在庫・値札）と、来るお客さんを描く。棚割り・値段・仕入れ数・店員の人数を変えられる。
   ・運行日が終わる（26:00を過ぎる）と、その日を締めて、評判・SNS・常連・ブームを次の日へ持ちこす。
   ===================================================================== */
(function(){
'use strict';
if(typeof KioskCore==='undefined'||typeof ResearchCore==='undefined')return;
const KC=KioskCore,RC=ResearchCore,KEY='dia-kiosk',H=KC.H;
const STORDER=['C','S','U','M','K','N','P','F','T','O'],PLACES=['home','naka','gate'];
const $=id=>document.getElementById(id);
const g=(f,d)=>{try{return f();}catch(e){return d;}};
const gT=()=>g(()=>T,600),gD=()=>g(()=>D,null),gDay=()=>g(()=>ENS.day,1),gCond=()=>g(()=>COND,{day:'wd',wx:'sun',season:'aut',evs:[]});
const stName=s=>g(()=>ST[s].name,s),fmtT=t=>g(()=>fmt(t),'');
const yen=n=>(n<0?'−':'')+'¥'+Math.round(Math.abs(n)).toLocaleString('ja-JP');
const man=n=>(n<0?'−':'')+(Math.abs(n)>=1e4?(Math.abs(n)/1e4).toFixed(1)+'万円':Math.round(Math.abs(n)).toLocaleString('ja-JP')+'円');
const num=n=>Math.round(n).toLocaleString('ja-JP');
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);
const DAYN={wd:'平日',sat:'土曜',hol:'日曜・祝日'},WXN={sun:'晴れ',cld:'くもり',rain:'雨',snow:'大雪'},SEAN={spr:'春',sum:'夏',aut:'秋',win:'冬'};

const V={cfg:null,rcfg:null,err:null,st:null,open:false,res:null,resKey:'',lastDay:null,tab:'log',form:{st:'C',place:'home'},
  cv:null,cx:null,raf:0,lastTs:0,people:[],bubbles:[],evI:0,lastT:null,slotAt:null,pend:null,showAll:false,panelT:0,heavyT:0};

const narrow=()=>window.innerWidth<760;
addEventListener('resize',()=>{const n=narrow();if(n!==V.wasNarrow){V.wasNarrow=n;if(V.open)render(true);}});
/* ---------- 読み込み・保存 ---------- */
Promise.all([fetch('data/kiosk.json').then(r=>{if(!r.ok)throw new Error('kiosk.json: HTTP '+r.status);return r.json();}),fetch('data/research.json').then(r=>{if(!r.ok)throw new Error('research.json: HTTP '+r.status);return r.json();})])
  .then(([c,rc])=>{V.cfg=c;V.rcfg=rc;try{const s=JSON.parse(localStorage.getItem(KEY)||'null');if(s&&s.v===1)V.st=s;}catch(e){}V.lastDay=gDay();badge();if(V.open)render(true);})
  .catch(e=>{V.err=String(e.message||e);if(V.open)render(true);});
function persist(){try{localStorage.setItem(KEY,JSON.stringify(V.st));}catch(e){}}
const ix=()=>KC.index(V.cfg);

/* ---------- その日の計算 ---------- */
function ctxNow(){const d=gD(),S=V.st;if(!d||!d.sim||!S)return null;const s=d.sim.stat[S.st];if(!s)return null;
  let stops;if(V.stopsD===d&&V.stopsSt===S.st)stops=V.stops;else{stops=new Array(H).fill(0);for(const t of d.trips){const i=t.seq.indexOf(S.st);if(i>=0&&t.stop[i])stops[Math.min(H-1,Math.floor(t.arr[i]/60))]++;}V.stops=stops;V.stopsD=d;V.stopsSt=S.st;}
  const c=gCond(),day=gDay();
  return {day,dow:(day+0)%7,cond:{day:c.day,wx:c.wx,season:c.season},flows:{hb:s.hb,ha:s.ha},stops,plats:g(()=>ST[S.st].plats,2)||2,rcfg:V.rcfg,order:orderFor(day),express:S.today&&S.today.day===day?(S.today.express||[]):[],edits:S.today&&S.today.day===day?S.today.edits:[],startT:S.openedDay===day?S.openedT:0};}
function checkDay(){if(!V.cfg||!V.st)return;const day=gDay();if(V.lastDay==null)V.lastDay=day;if(day===V.lastDay)return;
  if(day>V.lastDay&&V.res&&V.res.day===V.lastDay)closeToday(V.res);   // 日が進んだら、まず前の日の結果で締める（次の日の計算より先に）
  if(day<V.lastDay){V.st.closed=day-1;persist();}V.lastDay=day;V.res=null;}
function ensureRes(){if(!V.st||!V.cfg)return null;checkDay();const c=ctxNow();if(!c)return V.res;
  const k=c.day+'|'+c.cond.day+c.cond.wx+c.cond.season+'|'+(gD()&&gD().trips.length)+'|'+JSON.stringify(c.edits.map(e=>e.t))+'|'+c.express.length+'|'+(V.editRev||0);
  if(V.res&&V.resKey===k&&V.resD===gD())return V.res;
  V.res=KC.simulate(V.cfg,V.st,c);V.resKey=k;V.resD=gD();V.evI=KC.idxAt(V.res,gT());return V.res;}
function tick(){if(!V.cfg||!V.st)return;ensureRes();}
function closeToday(res){const S=V.st;
  // その日の最後の設定を、次の日からの設定にする。新しく並べた品は「並べた日」を覚える（マニアが来る）
  const last=S.today&&S.today.day===res.day&&S.today.edits.length?S.today.edits.at(-1):null;
  const before=new Set(Object.keys(KC.shelfInfo(V.cfg,S.layout)));
  const r=KC.closeDay(V.cfg,S,res,{});V.st=r.state;
  if(last){V.st.layout=last.layout;V.st.price=last.price;V.st.staff=last.staff;for(const pid in KC.shelfInfo(V.cfg,last.layout))if(!before.has(pid))V.st.placedAt[pid]=res.day+1;}
  {const S=V.st,nd=res.day+1;S.order=orderFor(nd);S.orderQ=(S.orderQ||[]).filter(e=>e.from>nd);}
  V.st.today=null;V.st.unread=(V.st.unread||0)+r.news.length;persist();badge();if(V.open)setTimeout(()=>render(true),0);}
/* 発注：締め切り（20:00）までに変えた数は次の運行日から、過ぎたらその次から。予定は orderQ に「何日目から」で持つ */
function orderFor(day){const S=V.st,o={...S.order};for(const e of (S.orderQ||[]).slice().sort((a,b)=>a.from-b.from))if(e.from<=day)Object.assign(o,e.order);return o;}
function nextOrderDay(){return gDay()+(gT()<V.cfg.orderDeadline?1:2);}
function editOrder(pid,delta){const S=V.st,na=nextOrderDay();S.orderQ=S.orderQ||[];let e=S.orderQ.find(x=>x.from===na);if(!e){e={from:na,order:orderFor(na)};S.orderQ.push(e);}
  e.order[pid]=Math.max(0,(e.order[pid]||0)+delta);persist();render(true);}
const dayWord=d=>{const k=d-gDay();return k===1?'あすの便から':k===2?'あさっての便から':`${k}日後の便から`;};
/* 臨時便：頼んでから1時間後に、その品だけ届く（1回3,000円・1日2回・6:00〜20:00） */
function expressLeft(){const S=V.st,day=gDay(),n=S.today&&S.today.day===day&&S.today.express?S.today.express.length:0;return V.cfg.express.max-n;}
function expressOpen(){const t=gT(),E=V.cfg.express;return t>=E.from&&t<=E.to&&expressLeft()>0;}
const expressAny=()=>expressOpen()||!!openExpress();
/* 臨時便は1便に何品でものせられる（{t, items:{品:数}}）。まだ届いていない便には、到着の addUntil 分前まで、同じ料金で品を足せる */
const expItems=x=>x.items||(x.pid?{[x.pid]:x.q}:{});
function todayExpress(){const S=V.st,day=gDay();if(!S.today||S.today.day!==day||!S.today.express)return [];for(const x of S.today.express)if(!x.items){x.items=expItems(x);delete x.pid;delete x.q;}return S.today.express;}
const expArrive=x=>x.t+V.cfg.express.lead;
function openExpress(){const E=V.cfg.express;return todayExpress().filter(x=>gT()<=expArrive(x)-E.addUntil).at(-1)||null;}   // まだ品を足せる便
function pendingExpress(pid){return todayExpress().filter(x=>expItems(x)[pid]&&expArrive(x)>gT()).at(-1)||null;}           // この品を頼んであって、まだ届いていない便
const expList=x=>Object.entries(expItems(x)).map(([p,q])=>ix().P[p].short+q+'個').join('・');
/* 前の便にのせる（届く時刻・料金・回数は変わらない。かかるのは足した分の原価だけ） */
function addToExpress(pid,q){const x=openExpress();if(!x||q<=0)return;const it=x.items||(x.items={});it[pid]=(it[pid]||0)+q;const P=ix().P[pid];
  V.st.news.push({day:gDay(),kind:'express',title:`臨時便にのせた：${P.name}＋${q}`,text:`${fmtT(expArrive(x))}着の便（${expList(x)}）といっしょに届きます。料金は増えません（足した分の原価${yen(q*P.cost)}）。`});
  persist();V.expSel=null;V.expConfirm=null;V.shConfirm=null;V.editRev=(V.editRev||0)+1;V.res=null;ensureRes();render(true);}
function orderExpress(pid,q){const S=V.st,day=gDay();if(!expressOpen()||q<=0)return;if(!S.today||S.today.day!==day)S.today={day,edits:[]};(S.today.express||(S.today.express=[])).push({t:gT(),items:{[pid]:q}});
  S.news.push({day,kind:'express',title:`臨時便を頼んだ：${ix().P[pid].name}×${q}`,text:`${fmtT(gT()+V.cfg.express.lead)}ごろ届きます（${yen(V.cfg.express.fee)}＋原価${yen(q*ix().P[pid].cost)}）。到着の${V.cfg.express.addUntil}分前までなら、ほかの品も同じ便にのせられます。`});
  persist();V.expSel=null;V.expConfirm=null;V.shConfirm=null;V.editRev=(V.editRev||0)+1;V.res=null;ensureRes();render(true);}
/* 臨時便のボタンを押したときの確認の中身（商品カードと商品の表で同じ） */
function expressConfirm(pid,q,idAdd,idNew,idNo){const ob=openExpress(),P=ix().P[pid];if(!ob)return '';const same=!!expItems(ob)[pid],at=fmtT(expArrive(ob));
  return `<div class="ks-pend" role="alert"><div><b>${same?`この品は、${at}着の臨時便ですでに${expItems(ob)[pid]}個頼んでいます。`:`${at}着の臨時便（${expList(ob)}）がまだ出ていません。`}</b></div>
    <div>${same?'前の注文に':'この品も同じ便にのせて、'}${q}個を足せます。届く時刻は${at}のまま、料金は増えません（足した分の原価${yen(q*P.cost)}）。のせられるのは到着の${V.cfg.express.addUntil}分前（${fmtT(expArrive(ob)-V.cfg.express.addUntil)}）まで。</div>
    <div class="ks-sbtns"><button type="button" class="ks-btn pri" id="${idAdd}">${same?`前の注文に${q}個追加する`:`同じ便にのせる（料金なし）`}</button>${!same&&expressOpen()?`<button type="button" class="ks-btn" id="${idNew}">別の便で頼む（${yen(V.cfg.express.fee)}・${fmtT(gT()+V.cfg.express.lead)}着）</button>`:''}<button type="button" class="ks-btn" id="${idNo}">やめる</button></div></div>`;}
/* 設定を変える（その時刻から先が変わる） */
function curSet(){const S=V.st,day=gDay();if(S.today&&S.today.day===day&&S.today.edits.length)return S.today.edits.at(-1);return {layout:S.layout,price:S.price,order:S.order,staff:S.staff};}
function edit(fn){const S=V.st,day=gDay(),c=JSON.parse(JSON.stringify(curSet()));fn(c);c.t=Math.max(gT(),(S.openedDay===day?S.openedT:0)+0.01);
  if(!S.today||S.today.day!==day)S.today={day,edits:[]};const L=S.today.edits;if(L.length&&Math.abs(L.at(-1).t-c.t)<1)L[L.length-1]=c;else L.push(c);
  persist();V.editRev=(V.editRev||0)+1;clearTimeout(V.pend);V.pend=setTimeout(()=>{V.res=null;ensureRes();render(true);},250);}

/* ---------- 商品ごとの「いま」 ---------- */
function counts(res,T){const k=KC.idxAt(res,T);if(V.cnt&&V.cnt.res===res&&V.cnt.k===k)return V.cnt;const c={res,k,sold:{},lost:{},looked:{}};
  for(let i=0;i<k;i++){const e=res.ev[i];if(e.k==='buy'){for(const [pid,q] of e.items)c.sold[pid]=(c.sold[pid]||0)+q;}else if(e.k==='look'&&e.pid){const o=e.why==='売り切れ'?c.lost:c.looked;o[e.pid]=(o[e.pid]||0)+1;}}
  V.cnt=c;return c;}
function nextDelivery(res,T,pid){const k=KC.idxAt(res,T);for(let i=k;i<res.ev.length;i++){const e=res.ev[i];if(e.k==='delivery'&&e.items&&e.items[pid])return {t:e.t,name:e.name,q:e.items[pid]};}return null;}
function pinfo(pid,res){const T0=gT(),set=curSet(),s=KC.shelfInfo(V.cfg,set.layout)[pid]||null,stock=(KC.stockAt(res,T0)[pid])||0,back=(KC.backAt(res,T0)[pid])||0,c=counts(res,T0);
  const cap=s?s.cap:0,st=!s?'none':stock+back<=0?'out':stock<=0?'wait':(stock+back)<=Math.max(1,Math.ceil(cap*0.25))?'low':'ok';
  return {s,cap,stock,back,sold:c.sold[pid]||0,lost:c.lost[pid]||0,looked:c.looked[pid]||0,next:nextDelivery(res,T0,pid),st};}
const motL=m=>m&&m!=='plan'?((V.cfg.mood&&V.cfg.mood.labels||{})[m]||''):'';   // 買ったきっかけ（「買うつもりで」は出さない）
function motText(pid,res){const T0=gT(),c={};let n=0;for(const e of res.ev){if(e.t>T0)break;if(e.k==='buy'&&e.items.some(([q])=>q===pid)){const m=e.mot||'plan';c[m]=(c[m]||0)+1;n++;}}
  if(!n)return 'まだ売れていません';const L=V.cfg.mood&&V.cfg.mood.labels||{};return Object.entries(c).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([m,k])=>`${L[m]||m} ${Math.round(k/n*100)}%`).join('・');}
const ST_LABEL={out:'売り切れ',wait:'棚が空（裏にあり・品出し待ち）',low:'残りわずか',ok:'在庫あり',none:'棚に置いていない'};
const nextText=n=>n?`${fmtT(n.t)} ${n.name}で＋${n.q}個`:'きょうはもう届きません';
/* 仕入れの変更が、いつから・いくつ変わるか */
function orderDiff(pid){const na=nextOrderDay(),cur=orderFor(gDay())[pid]||0,nx=orderFor(na)[pid]||0;return {na,cur,nx,d:nx-cur};}
function orderText(pid){const o=orderDiff(pid);return o.d?`${o.cur} → <b>${o.nx}</b>（${o.d>0?'＋':'−'}${Math.abs(o.d)}・第${o.na}運行日＝${dayWord(o.na).replace('の便から','')}の便から）`:`${o.cur}（変更なし）`;}

/* ---------- 骨組み ---------- */
const CSS=`
.ksv{position:fixed;inset:0;z-index:67;background:var(--paper);color:var(--ink);overflow:auto;padding:calc(env(safe-area-inset-top,0px) + 10px) max(14px,env(safe-area-inset-right,0px)) calc(env(safe-area-inset-bottom,0px) + 24px) max(14px,env(safe-area-inset-left,0px))}
.ksv[hidden]{display:none!important}
.ks-in{max-width:1200px;margin:0 auto;display:grid;gap:10px}
.ks-hd{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px}.ks-hd h2{margin:0;font-size:19px}.ks-hd small{font-size:12px;color:var(--muted)}.ks-sp{flex:1}
.ks-btn,.ks-chip{font:inherit;font-size:13px;border:1px solid var(--line);background:var(--panel);color:var(--ink);border-radius:7px;padding:5px 10px;cursor:pointer}
.ks-chip{border-radius:999px;background:var(--paper)}.ks-chip[aria-pressed="true"],.ks-btn.pri{background:var(--ink);color:var(--paper);border-color:var(--ink);font-weight:700}
.ks-btn:focus-visible,.ks-chip:focus-visible,.ks-tab:focus-visible,.ks-slot:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.ks-card{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:12px 14px;min-width:0}
.ks-card h3{margin:0 0 8px;font-size:14px;display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:baseline}.ks-card h3 small{font-size:11.5px;color:var(--muted);font-weight:400}
.ks-stage{border-radius:10px;overflow:hidden;border:1px solid var(--line);background:#2a2f33}.ks-stage canvas{display:block;width:100%;height:auto}
.ks-kpi{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px}.ks-kpi div{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:7px 10px;min-width:0}
.ks-kpi span{display:block;font-size:11px;color:var(--muted)}.ks-kpi b{font-family:var(--f-mono);font-size:17px;font-variant-numeric:tabular-nums}.ks-kpi .neg{color:#c9573f}.ks-kpi .pos{color:#2f8a4a}
.ks-tabs{display:flex;gap:4px;flex-wrap:wrap;border-bottom:1px solid var(--line);position:sticky;top:calc(-10px - env(safe-area-inset-top,0px));z-index:3;background:var(--paper);padding-top:4px}
.ks-tab{font:inherit;font-size:13px;border:1px solid transparent;border-bottom:none;background:none;color:var(--muted);padding:7px 12px;border-radius:7px 7px 0 0;cursor:pointer}
.ks-tab[aria-selected="true"]{background:var(--panel);border-color:var(--line);color:var(--ink);font-weight:700;margin-bottom:-1px}
.ks-t{width:100%;border-collapse:collapse;font-size:12.5px;font-variant-numeric:tabular-nums}.ks-t th{font-size:11px;color:var(--muted);font-weight:400;text-align:right;padding:4px 6px;border-bottom:1px solid var(--line);white-space:nowrap;position:sticky;top:0;background:var(--panel)}
.ks-t td{padding:4px 6px;border-bottom:1px solid var(--line);text-align:right;white-space:nowrap}.ks-t td.l,.ks-t th.l{text-align:left;white-space:normal}
.ks-t .neg{color:#c9573f}.ks-t .pos{color:#2f8a4a}.ks-t .mut{color:var(--muted)}.ks-t tr.off td{opacity:.55}
.ks-num{display:inline-flex;align-items:center;gap:2px}.ks-num button{font:inherit;font-size:12px;width:22px;height:22px;border:1px solid var(--line);background:var(--paper);color:var(--ink);border-radius:5px;cursor:pointer;padding:0}
.ks-num b{min-width:3.4em;text-align:center;font-family:var(--f-mono);font-weight:400}
.ks-tags{display:inline-flex;gap:3px;flex-wrap:wrap}.ks-tags i{font-style:normal;font-size:10.5px;border:1px solid var(--line);border-radius:4px;padding:0 4px;color:var(--muted);white-space:nowrap}
.ks-tags i.hot{color:#c9573f;border-color:#e3b0a5}.ks-tags i.cold{color:#2e7fd1;border-color:#a9c8ea}.ks-tags i.trend{color:#b0711f;border-color:#e4c38f;font-weight:700}.ks-tags i.age{color:#8a3c8a;border-color:#d4a9d4}
.ks-log{display:grid;gap:3px;font-size:12.5px}
.ks-newpill{position:fixed;bottom:calc(env(safe-area-inset-bottom,0px) + 16px);left:50%;transform:translateX(-50%);z-index:69;padding:9px 16px;border-radius:999px;font-size:14px;display:block;margin:0;background:var(--accent);color:var(--accent-ink);border-color:var(--accent);font-weight:700;box-shadow:0 2px 8px rgb(0 0 0 / .2)}
#ksMore{margin-bottom:72px}
@media (max-width:760px){.ks-log div{grid-template-columns:3.2em 5.2em minmax(0,1fr);}.ks-log div em{grid-column:3;justify-self:end}}.ks-log div{display:grid;grid-template-columns:3.4em 6em minmax(0,1fr) auto;gap:8px;padding:3px 4px;border-bottom:1px dashed var(--line)}
.ks-log time{font-family:var(--f-mono);color:var(--muted)}.ks-log .ps{color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ks-log em{font-style:normal;font-family:var(--f-mono)}
.ks-log .buy em{color:#2f8a4a}.ks-log .look{color:var(--muted)}.ks-log .rv{color:#9a6a1a}.ks-log .sns{color:#3a64b8}.ks-log .sys{color:var(--muted);font-size:11.5px}
.ks-zones{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px}
.ks-zone h4{margin:0 0 4px;font-size:12.5px;display:flex;justify-content:space-between}.ks-zone h4 small{color:var(--muted);font-weight:400}
.ks-grid{display:grid;gap:3px}.ks-slot{font:inherit;font-size:10.5px;min-height:34px;border:1px solid var(--line);border-radius:5px;background:var(--paper);color:var(--ink);cursor:pointer;padding:2px;line-height:1.2;overflow:hidden;text-align:center;position:relative}
.ks-slot i{position:absolute;left:0;right:0;bottom:0;height:4px}.ks-slot.empty{color:var(--muted);border-style:dashed}.ks-slot[aria-pressed="true"]{outline:2px solid var(--accent)}
.ks-pick{margin-top:10px;display:flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:12.5px;position:sticky;bottom:0;z-index:2;background:var(--panel);padding:8px 0;border-top:1px solid var(--line);box-shadow:0 -6px 12px -8px rgb(0 0 0 / .25)}.ks-pick select{font:inherit;font-size:13px;padding:4px 6px;border:1px solid var(--line);border-radius:6px;background:var(--paper);color:var(--ink);max-width:100%}
.ks-bars{display:grid;gap:4px}.ks-bars div{display:grid;grid-template-columns:7.5em minmax(0,1fr) 4.5em;gap:8px;align-items:center;font-size:12.5px}.ks-bars u{display:block;height:10px;border-radius:3px;background:var(--accent);text-decoration:none}.ks-bars em{font-style:normal;font-family:var(--f-mono);font-size:11.5px;text-align:right;color:var(--muted)}
.ks-hrs{display:flex;align-items:flex-end;gap:2px;height:90px;border-bottom:1px solid var(--line)}.ks-hrs span{flex:1;background:var(--accent);opacity:.85;border-radius:2px 2px 0 0;min-height:1px}.ks-hrs span.now{background:#d9822b;opacity:1}
.ks-hlab{display:flex;justify-content:space-between;font-size:10.5px;color:var(--muted);font-family:var(--f-mono);margin-top:3px}
.ks-news{display:grid;gap:7px}.ks-news div{border-left:3px solid var(--line);padding:2px 0 2px 9px;font-size:12.5px;line-height:1.6}.ks-news b{display:block;font-size:13px}.ks-news small{color:var(--muted);font-size:11px}
.ks-news .trend{border-left-color:#d9822b}.ks-news .sns{border-left-color:#3a64b8}.ks-news .regular{border-left-color:#2f8a4a}.ks-news .review{border-left-color:#9a6a1a}.ks-news .soldout,.ks-news .miss,.ks-news .waste{border-left-color:#c9573f}
.ks-g2{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:10px}
.ks-note{font-size:11.5px;color:var(--muted);margin:6px 0 0;line-height:1.65}
.ks-scroll{overflow-x:auto}
.ks-alert{display:flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:12.5px}.ks-alert>span{color:var(--muted);margin-right:4px}
.ks-al{font:inherit;font-size:12.5px;border:1px solid var(--line);background:var(--panel);color:var(--ink);border-radius:999px;padding:4px 10px;cursor:pointer;display:inline-flex;gap:6px;align-items:center}
.ks-al i{width:9px;height:9px;border-radius:50%;display:inline-block}.ks-al.out i{background:#d8382e}.ks-al.wait i{background:#e07a3a}.ks-al.low i{background:#e0a21b}.ks-al small{color:var(--muted)}
.ks-sheet{position:fixed;z-index:70;right:max(14px,env(safe-area-inset-right,0px));top:70px;width:min(380px,calc(100% - 28px));max-height:calc(100vh - 90px);overflow:auto;background:var(--panel);color:var(--ink);border:1px solid var(--line);border-radius:12px;box-shadow:0 10px 30px rgb(0 0 0 / .25);padding:12px 14px;display:grid;gap:8px;font-size:13px}
.ks-sheet[hidden]{display:none!important}.ks-sheet h3{margin:0;font-size:16px;display:flex;gap:8px;align-items:baseline;justify-content:space-between}.ks-sheet h3 small{font-size:11.5px;color:var(--muted);font-weight:400}
.ks-sg{display:grid;grid-template-columns:7.5em minmax(0,1fr);gap:6px 10px;align-items:center}.ks-sg>span:nth-child(odd){color:var(--muted);font-size:12px}.ks-sg b{font-family:var(--f-mono);font-weight:400}
.ks-st{display:inline-block;font-size:12px;border-radius:5px;padding:1px 7px;color:#fff;background:#2f8a4a}.ks-st.out{background:#d8382e}.ks-st.wait{background:#e07a3a}.ks-st.low{background:#e0a21b}.ks-st.none{background:#8a8a8a}
.ks-sbox{border:1px solid var(--line);border-radius:9px;padding:8px 10px;background:var(--paper);display:grid;gap:6px}.ks-sbox h4{margin:0;font-size:13px}.ks-sbox p{margin:0;font-size:12px;color:var(--muted);line-height:1.6}
.ks-sbtns{display:flex;flex-wrap:wrap;gap:6px}
.ks-pend{border:1px dashed var(--accent);border-radius:9px;padding:8px 10px;margin:8px 0;font-size:12.5px;display:grid;gap:4px}.ks-pend b{color:var(--accent)}.ks-pend button{font:inherit;font-size:11.5px;padding:1px 7px;border:1px solid var(--line);border-radius:5px;background:var(--panel);color:var(--ink);cursor:pointer;margin-left:6px}
.ks-diff{display:block;font-size:11px;color:var(--accent);white-space:nowrap}.ks-pname{font:inherit;background:none;border:none;padding:0;color:var(--ink);text-align:left;cursor:pointer;text-decoration:underline;text-decoration-color:var(--line);text-underline-offset:3px}
.ks-pname b{font-weight:700}
@media (max-width:760px){.ks-sheet{top:auto;bottom:0;right:0;left:0;width:auto;max-height:78vh;border-radius:14px 14px 0 0;padding-bottom:calc(env(safe-area-inset-bottom,0px) + 14px)}}
.ks-num b.chg{color:var(--accent);font-weight:700}.ks-exp{font-size:12px;padding:3px 8px}.ks-exp:disabled{opacity:.4}
.ks-cards{display:grid;gap:8px;margin-top:8px}.ks-pc{border:1px solid var(--line);border-radius:9px;padding:9px 10px;background:var(--paper)}.ks-pc.off{opacity:.6}
.ks-pc-h{display:flex;justify-content:space-between;gap:8px;align-items:baseline;margin-bottom:4px}.ks-pc-h b{font-size:14px}.ks-pc-h .mut,.ks-pc .mut{color:var(--muted);font-size:11.5px}
.ks-pc-g{display:grid;grid-template-columns:auto minmax(0,1fr);gap:6px 10px;align-items:center;margin-top:6px;font-size:12.5px}.ks-pc-g>span:nth-child(odd){color:var(--muted);font-size:11.5px}.ks-pc-g b{font-weight:400;font-family:var(--f-mono)}.ks-pc .neg{color:#c9573f}.ks-pc .pos{color:#2f8a4a}
@media (max-width:760px){.ks-num button{width:34px;height:34px;font-size:16px}.ks-slot{min-height:42px;font-size:11.5px}.ks-tab{padding:8px 10px}.ks-pick select{flex:1 1 100%;font-size:15px;padding:8px}}
`;
function mount(){const s=document.createElement('style');s.textContent=CSS;document.head.appendChild(s);
  const after=$('rsBtn')||$('tayoriBtn')||document.querySelector('.clockbox');
  if(after){const b=document.createElement('button');b.id='ksBtn';b.type='button';b.className='tayoribtn';b.innerHTML='売店<span class="dot" hidden></span>';after.after(b);b.onclick=()=>setOpen(true);}
  const mb=document.querySelector('.minibar-in');if(mb){const b=document.createElement('button');b.id='mks';b.type='button';b.className='mspeed tayorimini';b.innerHTML='売店<span class="dot" hidden></span>';mb.appendChild(b);b.onclick=()=>setOpen(true);}
  const p=document.createElement('section');p.id='ksv';p.className='ksv';p.hidden=true;p.setAttribute('aria-label','売店の運営');
  p.innerHTML=`<div class="ks-in"><div class="ks-hd"><h2 id="ksTitle">売店の運営</h2><small id="ksSub"></small><span class="ks-sp"></span><span id="ksSpd"></span><button type="button" class="ks-btn" id="ksClose">閉じる</button></div>
    <div id="ksTop"></div><div class="ks-stage"><canvas id="ksCanvas" width="1000" height="600" aria-label="売店の正面のようす（棚を押すと、その商品のカードが出ます）"></canvas></div><div id="ksAlert" class="ks-alert" aria-live="polite"></div><div id="ksKpi" class="ks-kpi"></div>
    <div class="ks-tabs" role="tablist" id="ksTabs"></div><div id="ksBody"></div></div>`;
  document.body.appendChild(p);const sh=document.createElement('aside');sh.id='ksSheet';sh.className='ks-sheet';sh.hidden=true;sh.setAttribute('aria-label','商品カード');p.appendChild(sh);
  $('ksClose').onclick=()=>setOpen(false);document.addEventListener('keydown',e=>{if(e.key==='Escape'&&V.open){if(V.sheet){closeSheet();return;}setOpen(false);}});
  $('ksSpd').innerHTML=[1,30,180].map(m=>`<button type="button" class="ks-chip" data-m="${m}">×${m}</button>`).join(' ');
  $('ksSpd').querySelectorAll('button').forEach(b=>b.onclick=()=>{setMult(Number(b.dataset.m));});
  const TABS=[['log','売れ行き'],['items','商品・値段・仕入れ'],['layout','棚割り'],['people','客層・時間帯'],['money','収支'],['news','お知らせ']];
  $('ksTabs').innerHTML=TABS.map(([k,n])=>`<button type="button" class="ks-tab" role="tab" data-tab="${k}">${n}</button>`).join('');
  $('ksTabs').querySelectorAll('button').forEach(b=>b.onclick=()=>{V.tab=b.dataset.tab;V.logRes=null;if(V.tab==='news'&&V.st){V.st.unread=0;persist();badge();}render(true);});
  V.cv=$('ksCanvas');V.cx=V.cv.getContext('2d');V.cv.addEventListener('click',onCanvasClick);}
function setMult(m){g(()=>{speed=m/60;const ms=$('mspeed');if(ms)ms.textContent='×'+m;});document.querySelectorAll('#ksSpd button').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.m)===m)));}
function badge(){const n=V.st?V.st.unread||0:0;for(const id of ['ksBtn','mks']){const b=$(id);if(!b)continue;const d=b.querySelector('.dot');d.hidden=!n;d.textContent=n>9?'9+':String(n);}}
function setOpen(o){V.open=o;$('ksv').hidden=!o;if(o){V.prevSpeed=g(()=>speed,null);setMult(1);V.people=[];V.bubbles=[];V.lastT=null;render(true);cancelAnimationFrame(V.raf);V.lastTs=0;V.raf=requestAnimationFrame(loop);}
  else{cancelAnimationFrame(V.raf);if(V.prevSpeed!=null)g(()=>setSpeed(V.prevSpeed));}}

/* ---------- 開店前：場所を選ぶ ---------- */
function renderSetup(){const f=V.form,R=V.rcfg,studies=g(()=>JSON.parse(localStorage.getItem('dia-research')||'null').studies,[])||[];
  const done=new Set(studies.filter(s=>s.recs&&s.recs.length).map(s=>s.st+'|'+s.place));
  const kiosk=R.types.find(t=>t.id==='kiosk');
  $('ksTop').innerHTML=`<div class="ks-card"><h3><span>売店を出す場所</span><small>リサーチで調べた場所には「調査済み」が付きます</small></h3>
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px">${STORDER.map(s=>`<button type="button" class="ks-chip" data-st="${s}" aria-pressed="${f.st===s}">${stName(s)}</button>`).join('')}</div>
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px">${PLACES.map(p=>`<button type="button" class="ks-chip" data-pl="${p}" aria-pressed="${f.place===p}">${R.places[p].name}${done.has(f.st+'|'+p)?'（調査済み）':''}</button>`).join('')}</div>
    <p class="ks-note">売店（約${V.cfg.area}㎡）。はじめにかかるお金の目安は${man(kiosk.init)}（リサーチの試算と同じ）。店員1人で6時〜23時。棚・値段・仕入れ数は、写真のような売店のよくある並べ方から始まり、あとで変えられます。開店はいまの時刻からで、次の便から品物が届きます。</p>
    <button type="button" class="ks-btn pri" id="ksOpen">${stName(f.st)}駅・${R.places[f.place].name}に売店を出す</button></div>`;
  $('ksTop').querySelectorAll('[data-st]').forEach(b=>b.onclick=()=>{f.st=b.dataset.st;render(true);});
  $('ksTop').querySelectorAll('[data-pl]').forEach(b=>b.onclick=()=>{f.place=b.dataset.pl;render(true);});
  $('ksOpen').onclick=()=>{const day=gDay();V.st=KC.create(V.cfg,{seed:(Date.now()%100000)+1,st:f.st,place:f.place,day});V.st.openedT=gT();V.st.openedDay=day;V.st.unread=0;
    V.st.news.push({day,kind:'open',title:`${stName(f.st)}駅・${R.places[f.place].name}に売店を開いた`,text:'はじめは、よくある売店の並べ方と値段です。売れ行きを見ながら変えていきましょう。'});persist();V.res=null;render(true);};}

/* ---------- 要注意：売り切れ・品出し待ち・残りわずか（押すと商品カード） ---------- */
function renderAlert(force){const box=$('ksAlert'),res=V.res;if(!box)return;if(!V.st||!res){box.innerHTML='';V.alKey='';return;}
  const si=KC.shelfInfo(V.cfg,curSet().layout),I=ix(),list=[];for(const pid in si){const x=pinfo(pid,res);if(x.st==='out'||x.st==='wait'||x.st==='low')list.push([pid,x]);}
  const order={out:0,wait:1,low:2};list.sort((a,b)=>order[a[1].st]-order[b[1].st]||b[1].lost-a[1].lost);
  const sub=x=>`${x.st==='low'?'残り'+(x.stock+x.back):x.st==='wait'?'裏に'+x.back:'0個'}${x.lost?'・逃した'+x.lost:''}${x.next?'・'+fmtT(x.next.t)+'に＋'+x.next.q:''}`;
  const key=list.map(([p,x])=>p+x.st).join('|');   // 品と状態が同じなら作り直さず、小さな字だけ書きかえる（押している途中のボタンを消さない）
  if(!force&&key===V.alKey){for(const [pid,x] of list){const e=box.querySelector(`[data-sh="${pid}"] small`);if(e){const t=sub(x);if(e.textContent!==t)e.textContent=t;}}return;}V.alKey=key;
  if(!list.length){box.innerHTML='<span>在庫：売り切れ・残りわずかの品はありません</span>';return;}
  const n=k=>list.filter(x=>x[1].st===k).length;
  box.innerHTML=`<span>在庫の要注意（押すと商品カード）：売り切れ${n('out')}・品出し待ち${n('wait')}・残りわずか${n('low')}</span>`+list.map(([pid,x])=>`<button type="button" class="ks-al ${x.st}" data-sh="${pid}"><i></i>${esc(I.P[pid].short)}<small>${sub(x)}</small></button>`).join('');
  box.querySelectorAll('[data-sh]').forEach(b=>b.onclick=()=>openSheet(b.dataset.sh));}
/* 商品カード：その品のいま・次の便・仕入れ（いつから・いくつ）・臨時便・値段を1か所で */
function openSheet(pid){V.sheet=pid;V.shQ=null;V.shConfirm=null;renderSheet();$('ksSheet').hidden=false;}
function closeSheet(){V.sheet=null;$('ksSheet').hidden=true;}
function renderSheet(){const pid=V.sheet,box=$('ksSheet'),res=V.res;if(!pid||!res||!box)return;const I=ix(),p=I.P[pid],x=pinfo(pid,res),set=curSet(),pr=set.price[pid]??p.price,o=orderDiff(pid),E=V.cfg.express;if(!openExpress()&&V.shConfirm===pid)V.shConfirm=null;
  if(V.shQ==null)V.shQ=Math.max(1,x.cap||5);const life=I.G[p.genre].life,unit=life===0?'1日に届く数':'裏も合わせた目標の数';
  box.innerHTML=`<h3><span>${esc(p.name)}</span><button type="button" class="ks-btn" id="shClose">閉じる</button></h3>
    <div><span class="ks-st ${x.st}" id="shSt">${ST_LABEL[x.st]}</span> <small class="ks-note">${I.G[p.genre].name}・${yen(pr)}（原価${yen(p.cost)}）</small></div>
    <div class="ks-sg"><span>棚</span><b id="shShelf">${x.s?`${x.s.face}列×${Math.round(x.cap/x.s.face)}（最大${x.cap}個）`:'置いていない'}</b>
      <span>いま</span><b id="shNow">棚に${x.stock}個・裏に${x.back}個</b>
      <span>きょう</span><b id="shToday">売れた${x.sold}・売り切れで逃した${x.lost}・見て買わず${x.looked}</b>
      <span>次の便</span><b id="shNext">${nextText(x.next)}</b>
      <span>きっかけ</span><b id="shMot">${motText(pid,res)}</b></div>
    <div class="ks-sbox"><h4>仕入れ（${unit}）</h4>
      <div class="ks-sg"><span>きょうの便</span><b>${o.cur}</b><span>${dayWord(o.na)}</span><span class="ks-num"><button type="button" id="shOm" aria-label="減らす">−</button><b class="${o.d?'chg':''}">${o.nx}</b><button type="button" id="shOp" aria-label="増やす">＋</button></span></div>
      <p>${o.d?`第${o.na}運行日（${dayWord(o.na).replace('の便から','')}）から ${o.cur} → ${o.nx}（${o.d>0?'＋':'−'}${Math.abs(o.d)}）に変わります。`:'いまは変えていません。'}締め切りは${fmtT(V.cfg.orderDeadline)}。それを過ぎて変えるとその次の運行日からになります。きょうの便は変わりません。</p></div>
    <div class="ks-sbox"><h4>臨時便（いますぐ足す）</h4>
      <div class="ks-sbtns"><span class="ks-num"><button type="button" id="shEm" aria-label="減らす">−</button><b>${V.shQ}個</b><button type="button" id="shEp" aria-label="増やす">＋</button></span>
        ${V.shConfirm===pid?'':`<button type="button" class="ks-btn pri" id="shEgo" ${expressAny()&&x.s?'':'disabled'}>臨時便で頼む</button>`}</div>
      ${todayExpress().filter(e=>expArrive(e)>gT()).map(e=>`<p style="color:var(--ink)"><b>まだ届いていない臨時便：${fmtT(expArrive(e))}着（${expList(e)}）</b>${gT()<=expArrive(e)-E.addUntil?`・${fmtT(expArrive(e)-E.addUntil)}まで品を足せます`:'・積み込みずみ'}</p>`).join('')}
      ${V.shConfirm===pid?expressConfirm(pid,V.shQ,'shAdd','shNew','shNo'):''}
      <p>${openExpress()?`まだ出ていない臨時便があるので、押すと「同じ便にのせる（料金なし）」か「別の便で頼む」かを選べます。`:expressOpen()?`${fmtT(gT()+E.lead)}ごろ届きます。${yen(E.fee)}＋原価${yen(V.shQ*p.cost)}。きょうはあと${expressLeft()}回。`:expressLeft()<=0?'きょうの臨時便は使い切りました。':`臨時便は${fmtT(E.from)}〜${fmtT(E.to)}に頼めます。`}${x.s?'':'棚に置いていない品は頼めません。'}</p></div>
    <div class="ks-sbox"><h4>値段</h4><div class="ks-sbtns"><span class="ks-num"><button type="button" id="shPm" aria-label="10円下げる">−</button><b>${yen(pr)}</b><button type="button" id="shPp" aria-label="10円上げる">＋</button></span><small class="ks-note" style="margin:0">ふつうの値段の${Math.round(pr/p.price*100)}%・すぐに効きます</small></div></div>
    <div class="ks-sbtns"><button type="button" class="ks-btn" id="shLay">棚割りで並べ方を変える</button><button type="button" class="ks-btn" id="shTab">商品の表で見る</button></div>`;
  const st=life===0?1:2;
  $('shClose').onclick=closeSheet;$('shOm').onclick=()=>{editOrder(pid,-st);renderSheet();};$('shOp').onclick=()=>{editOrder(pid,st);renderSheet();};
  $('shEm').onclick=()=>{V.shQ=Math.max(1,V.shQ-1);renderSheet();};$('shEp').onclick=()=>{V.shQ+=1;renderSheet();};
  if($('shEgo'))$('shEgo').onclick=()=>{if(openExpress()){V.shConfirm=pid;renderSheet();return;}orderExpress(pid,V.shQ);V.shQ=null;renderSheet();};   // まだ出ていない便があれば、のせるか別にするかを確認
  if($('shAdd'))$('shAdd').onclick=()=>{addToExpress(pid,V.shQ);V.shQ=null;renderSheet();};if($('shNew'))$('shNew').onclick=()=>{orderExpress(pid,V.shQ);V.shQ=null;renderSheet();};if($('shNo'))$('shNo').onclick=()=>{V.shConfirm=null;renderSheet();};
  $('shPm').onclick=()=>{edit(c=>{c.price[pid]=Math.max(10,(c.price[pid]??p.price)-10);});setTimeout(renderSheet,300);};$('shPp').onclick=()=>{edit(c=>{c.price[pid]=(c.price[pid]??p.price)+10;});setTimeout(renderSheet,300);};
  $('shLay').onclick=()=>{const L=curSet().layout;for(const zk in L){const i=L[zk].indexOf(pid);if(i>=0){V.slotSel={z:zk,i};break;}}V.tab='layout';closeSheet();render(true);$('ksBody').scrollIntoView({block:'start'});};
  $('shTab').onclick=()=>{V.tab='items';closeSheet();render(true);setTimeout(()=>{const r=document.querySelector(`[data-row="${pid}"]`);if(r)r.scrollIntoView({block:'center'});},50);};}
/* 商品カードの数字だけを書きかえる（ボタンは作り直さないので、押している途中でも消えない） */
function updateSheet(){const pid=V.sheet,res=V.res;if(!pid||!res||!$('shNow'))return;const x=pinfo(pid,res);
  const set=(id,t)=>{const e=$(id);if(e&&e.textContent!==t)e.textContent=t;};set('shNow',`棚に${x.stock}個・裏に${x.back}個`);set('shToday',`売れた${x.sold}・売り切れで逃した${x.lost}・見て買わず${x.looked}`);set('shNext',nextText(x.next));set('shMot',motText(pid,res));
  const s=$('shSt');if(s&&!s.classList.contains(x.st)){s.className='ks-st '+x.st;s.textContent=ST_LABEL[x.st];}}

/* ---------- 画面全体 ---------- */
function render(full){if(!V.open)return;
  if(!V.cfg){$('ksTop').innerHTML=`<div class="ks-card"><p>${V.err?'設定を読み込めませんでした（'+esc(V.err)+'）。パソコンで index.html を直接開いた場合は読み込めません。':'準備しています…'}</p></div>`;return;}
  if(!V.st){$('ksTitle').textContent='売店を出す';$('ksSub').textContent='';renderSetup();$('ksKpi').innerHTML='';$('ksBody').innerHTML='';$('ksTabs').hidden=true;return;}
  $('ksTabs').hidden=false;$('ksTop').innerHTML='';const S=V.st,c=gCond();
  $('ksTitle').textContent=`みなとスタンド ${stName(S.st)}駅${V.rcfg.places[S.place].name}店`;
  const tr=S.trend?V.cfg.trends.find(x=>x.id===S.trend.id):null;
  $('ksSub').textContent=`運行日${gDay()}（開店${gDay()-S.openedDay+1}日目）・${DAYN[c.day]}・${WXN[c.wx]}・${SEAN[c.season]}${tr?'・世の中は'+tr.name:''}・常連 ${S.regulars.length}人`;
  $('ksTabs').querySelectorAll('button').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.tab===V.tab)));
  renderKpi();renderAlert(true);if(V.sheet)renderSheet();if(full||V.tab==='log')renderBody(full);}
function renderKpi(){const res=ensureRes();if(!res)return;const o=KC.soFar(V.cfg,res,gT()),P=res.pl;
  const share=res.pl.sales?o.sales/res.pl.sales:0;
  $('ksKpi').innerHTML=`<div><span>きょうの売上（いままで）</span><b>${yen(o.sales)}</b></div><div><span>お客さん</span><b>${num(o.cust)}人</b></div>
    <div><span>見たけど買わなかった</span><b>${num(o.looks)}人</b></div><div><span>粗利（売上−原価）</span><b>${yen(o.sales-o.cogs)}</b></div>
    <div><span>店員</span><b>${curSet().staff}人</b></div><div><span>積み立て</span><b class="${V.st.cash<0?'neg':'pos'}">${man(V.st.cash)}</b></div>`;}
function renderBody(full){const b=$('ksBody'),res=ensureRes();if(!res)return;
  if(V.tab==='log')return renderLog(b,res,full);
  if(!full)return;
  if(V.tab==='items')renderItems(b,res);else if(V.tab==='layout')renderLayout(b);else if(V.tab==='people')renderPeople(b,res);else if(V.tab==='money')renderMoney(b,res);else renderNews(b);}

/* 売れ行き：いまの時刻までの出来事（新しい順） */
function evText(e){const I=ix(),P=I.P,PS=I.PS,ps=e.ps?(PS[e.ps]||{}).short||e.ps:'';
  if(e.k==='buy')return ['buy',ps+(e.reg?'（常連）':e.mania?'（マニア）':''),e.items.map(([p,q])=>P[p].short+(q>1?'×'+q:'')).join('・')+(motL(e.mot)&&!e.reg&&!e.mania?`〔${motL(e.mot)}〕`:'')+(e.addon?'〔ついでに'+P[e.items[e.items.length-1][0]].short+'も〕':'')+(e.wait>0.5?`（${Math.round(e.wait*60)}秒待ち）`:''),yen(e.yen)];
  if(e.k==='look')return ['look',ps+(e.reg?'（常連）':''),(e.pid?P[e.pid].short:I.G[e.genre].name)+'… '+e.why,''];
  if(e.k==='review')return ['rv',ps,`${P[e.pid].short}「${e.text}」`,'★'.repeat(e.stars)];
  if(e.k==='sns')return ['sns',ps,`${P[e.pid].short}について投稿${e.good?'':'（不満）'}`,'SNS'];
  if(e.k==='delivery')return ['sys','',`${e.name}が届いた（${e.n}個・${yen(e.cost)}）`,''];
  if(e.k==='restock')return ['sys','',`${e.why}（${e.n}個）`,''];
  if(e.k==='cook')return ['sys','',`${P[e.pid].short}を${e.n}個温めた`,''];
  if(e.k==='waste')return ['sys','',`${P[e.pid].short}を${e.n}個捨てた（${e.why}）`,''];
  if(e.k==='edit')return ['sys','','棚・値段・仕入れを変えた',''];return ['sys','',e.k,''];}
/* 一覧は作り直さない：新しい出来事を上に足すだけ。下の方を読んでいるあいだは足さずに「新しい出来事 ○件」を出す（スクロールが先頭に戻らないように） */
const logRow=e=>{const [c,ps,tx,r]=evText(e);return `<div class="${c}"><time>${fmtT(e.t)}</time><span class="ps">${esc(ps)}</span><span>${esc(tx)}</span><em>${esc(r)}</em></div>`;};
function renderLog(b,res,full){const k=KC.idxAt(res,gT());let box=$('ksLog');
  const rebuild=full||!box||V.logRes!==res||k<V.logK||!b.contains(box);
  if(rebuild){V.logRes=res;V.logK=k;V.logFrom=Math.max(0,k-80);
    b.innerHTML=`<div class="ks-card"><h3><span>売れ行き</span><small>いまの時刻までの出来事・新しい順（会計・見たけど買わなかった・評価・SNS・品出しなど）</small></h3>
      <button type="button" class="ks-btn ks-newpill" id="ksNew" hidden></button><div class="ks-log" id="ksLog">${res.ev.slice(V.logFrom,k).reverse().map(logRow).join('')||'<p class="ks-note" id="ksLogEmpty">まだ何も起きていません。</p>'}</div>
      <div style="margin-top:8px;text-align:center"><button type="button" class="ks-btn" id="ksMore" ${V.logFrom>0?'':'hidden'}>もっと前を見る</button></div></div>`;
    box=$('ksLog');
    $('ksMore').onclick=()=>{const r=V.logRes,to=V.logFrom,from=Math.max(0,to-100);box.insertAdjacentHTML('beforeend',r.ev.slice(from,to).reverse().map(logRow).join(''));V.logFrom=from;$('ksMore').hidden=from<=0;};
    $('ksNew').onclick=()=>{flushLog(true);box.scrollIntoView({block:'start',behavior:'smooth'});};
    return;}
  if(k===V.logK)return;
  // 読んでいる途中か：パソコンは一覧の中のスクロール、スマホはページのスクロールで判断
  const reading=box.getBoundingClientRect().top<120;   // 一覧の先頭が画面の上に隠れていたら、読んでいる途中
  if(reading){const n=k-V.logK;const pill=$('ksNew');pill.hidden=false;pill.textContent=`↑ 新しい出来事 ${n}件`;V.logPend=k;return;}
  flushLog(false);}
function flushLog(force){const box=$('ksLog'),res=V.logRes;if(!box||!res)return;const k=force?KC.idxAt(res,gT()):KC.idxAt(res,gT());
  const add=res.ev.slice(V.logK,k).reverse().map(logRow).join('');const em=$('ksLogEmpty');if(em)em.remove();
  if(add)box.insertAdjacentHTML('afterbegin',add);V.logK=k;$('ksNew').hidden=true;
  while(box.children.length>400){box.lastElementChild.remove();V.logFrom++;}if($('ksMore'))$('ksMore').hidden=V.logFrom<=0;}

/* 商品：値段・仕入れ数・属性・売れ行き・評価 */
function renderItems(b,res){const I=ix(),S=V.st,set=curSet(),si=KC.shelfInfo(V.cfg,set.layout),stock=KC.stockAt(res,gT()),o=KC.soFar(V.cfg,res,gT()),na=nextOrderDay(),nextO=orderFor(na),today=orderFor(gDay());
  const ordCell=(p,s)=>{const v=nextO[p.id]||0,cur=today[p.id]||0;if(!s&&!v)return '<span class="mut">棚になし</span>';return `<span class="ks-num"><button type="button" data-or="${p.id}" data-d="-1" aria-label="減らす">−</button><b class="${v!==cur?'chg':''}">${v}</b><button type="button" data-or="${p.id}" data-d="1" aria-label="増やす">＋</button></span>${v!==cur?`<span class="ks-diff">きょう${cur}から${v>cur?'＋':'−'}${Math.abs(v-cur)}</span>`:''}`;};
  // 発注の予定：まだ効いていない変更を、何日目からかと増減でまとめる（取り消しもできる）
  const pend=[];for(const e of (S.orderQ||[]).slice().sort((a,b)=>a.from-b.from)){const before=orderFor(e.from-1);for(const pid in e.order){if((e.order[pid]||0)!==(before[pid]||0))pend.push({from:e.from,pid,a:before[pid]||0,b:e.order[pid]||0});}}
  const pendBox=pend.length?`<div class="ks-pend"><div><b>発注の予定（まだ届いていない変更）</b></div>${pend.map(x=>`<div>第${x.from}運行日（${dayWord(x.from).replace('の便から','')}）から：${esc(I.P[x.pid].name)} ${x.a} → <b>${x.b}</b>（${x.b>x.a?'＋':'−'}${Math.abs(x.b-x.a)}）<button type="button" data-undo="${x.from}|${x.pid}">取り消す</button></div>`).join('')}</div>`:'';
  const expBox=()=>{const pid=V.expSel;if(!pid)return '';const p=I.P[pid],q=V.expQ;return `<div class="ks-pick" id="ksExpBox"><b>臨時便：${esc(p.name)}</b><span class="ks-num"><button type="button" id="ksExM" aria-label="減らす">−</button><b>${q}個</b><button type="button" id="ksExP" aria-label="増やす">＋</button></span>
      ${V.expConfirm===pid&&openExpress()?expressConfirm(pid,q,'ksExAdd','ksExNew','ksExNo'):`<span>${openExpress()?`まだ出ていない臨時便：${fmtT(expArrive(openExpress()))}着（${expList(openExpress())}）。`:''}${yen(V.cfg.express.fee)}＋原価${yen(q*p.cost)}・${fmtT(gT()+V.cfg.express.lead)}ごろ届く</span><button type="button" class="ks-btn pri" id="ksExGo" ${expressAny()?'':'disabled'}>頼む</button><button type="button" class="ks-btn" id="ksExNo">やめる</button>`}</div>`;};
  const tr=S.trend?V.cfg.trends.find(x=>x.id===S.trend.id):null;
  const lostSO={},looked={};const k=KC.idxAt(res,gT());for(let i=0;i<k;i++){const e=res.ev[i];if(e.k==='look'&&e.pid){(e.why==='売り切れ'?lostSO:looked)[e.pid]=((e.why==='売り切れ'?lostSO:looked)[e.pid]||0)+1;}}
  const list=V.cfg.products.filter(p=>V.showAll||si[p.id]);
  const tag=p=>{const t=[];const G=I.G[p.genre];t.push(p.temp==='hot'?'<i class="hot">温</i>':p.temp==='cold'?'<i class="cold">冷</i>':'<i>常温</i>');
    if(p.ease>=5)t.push('<i>手軽</i>');if(p.health>=4)t.push('<i>健康</i>');if(p.sudden)t.push('<i>突発</i>');if(p.genre==='hot')t.push('<i>温め・調理</i>');
    if(p.photo>=0.6)t.push('<i>映え</i>');if(p.regular>=0.6)t.push('<i>常連向き</i>');if(p.mania>=0.4)t.push('<i>マニア</i>');if(G.age)t.push('<i class="age">年齢確認</i>');
    if(G.returnable)t.push('<i>返品できる</i>');if(G.life===0)t.push('<i>その日限り</i>');if(tr&&p.tags.some(x=>tr.tags.includes(x)))t.push(`<i class="trend">${tr.name}</i>`);if((S.buzz[p.id]||0)>0.05)t.push('<i class="trend">SNSで話題</i>');return `<span class="ks-tags">${t.join('')}</span>`;};
  const rep=pid=>{const x=S.rep[pid];if(!x||!x.n)return '<span class="mut">—</span>';const avg=x.sum/x.n,keys=Object.entries(x.keys).sort((a,b)=>b[1]-a[1]).slice(0,2).map(([k2,n])=>({sweetHi:'甘すぎ',sweetLo:'甘さ不足',richHi:'濃い',richLo:'うすい',volLo:'量が少ない',volHi:'多すぎ',priceHi:'高い',priceOk:'安い',good:'満足',warm:'温かい',cold:'冷えてる',crush:'つぶれ'})[k2]+n).join('・');return `★${avg.toFixed(1)}（${x.n}）<br><span class="mut" style="font-size:11px">${keys}</span>`;};
  b.innerHTML=`<div class="ks-card"><h3><span>商品・値段・仕入れ</span><small>値段は「世の中のふつうの値段」との比も出します</small></h3>
    <p class="ks-note" style="margin-top:0">仕入れの締め切りは${fmtT(V.cfg.orderDeadline)}。いま変えた仕入れ数は<b>${dayWord(na)}</b>届きます（きょうの便は変わりません）。その日のうちに売る物は1日の数（朝5割・昼前と午後に2割5分ずつ）、日持ちする物は「裏も合わせた在庫の目標」です。急ぐときは<b>臨時便</b>（${yen(V.cfg.express.fee)}＋原価・${V.cfg.express.lead}分後に届く・1日${V.cfg.express.max}回まで・${fmtT(V.cfg.express.from)}〜${fmtT(V.cfg.express.to)}）。きょうの残り：${expressLeft()}回。</p>
    ${expBox()}${pendBox}
    <label style="font-size:12.5px"><input type="checkbox" id="ksAll" ${V.showAll?'checked':''}> 棚に置いていない商品も出す</label>
    ${narrow()?`<div class="ks-cards">${list.map(p=>{const pr=set.price[p.id]??p.price,ratio=pr/p.price,cr=p.cost/pr,s=si[p.id];
      return `<div class="ks-pc ${s?'':'off'}" data-row="${p.id}"><div class="ks-pc-h"><button type="button" class="ks-pname" data-sh="${p.id}"><b>${esc(p.name)}</b></button><span class="mut">${I.G[p.genre].name}</span></div>${tag(p)}
        <div class="ks-pc-g"><span>値段</span><span class="ks-num"><button type="button" data-pr="${p.id}" data-d="-10" aria-label="10円下げる">−</button><b>${yen(pr)}</b><button type="button" data-pr="${p.id}" data-d="10" aria-label="10円上げる">＋</button></span>
          <span>ふつう比・原価率</span><b class="${ratio>1.1?'neg':ratio<0.95?'pos':''}">${Math.round(ratio*100)}%・<span class="${cr>0.7?'neg':''}">${Math.round(cr*100)}%</span></b>
          <span>仕入れ（${dayWord(na)}）</span><span>${ordCell(p,s)}</span>
          <span>きょうの仕入れ</span><b>${s||today[p.id]?(today[p.id]||0):'—'}${s?` <button type="button" class="ks-btn ks-exp" data-ex="${p.id}" ${expressAny()?'':'disabled'}>${pendingExpress(p.id)?'臨時便（頼み済み）':'臨時便'}</button>`:''}</b>
          <span>棚・いま</span><b>${s?`${s.face}列×${Math.round(s.cap/s.face)}・<span data-f="stock">${stock[p.id]||0}</span>個`:'—'}</b>
          <span>きょう</span><b>売れた<span data-f="sold">${o.items[p.id]||0}</span>・売切で逃した<span data-f="lost" class="${lostSO[p.id]?'neg':''}">${lostSO[p.id]||0}</span>・見て買わず<span data-f="looked">${looked[p.id]||0}</span></b>
          <span>評価</span><span>${rep(p.id)}</span></div></div>`;}).join('')}</div>`:`
    <div class="ks-scroll" style="margin-top:6px"><table class="ks-t" style="min-width:1320px"><thead><tr><th class="l">商品</th><th class="l">ようす</th><th>値段</th><th>ふつう比</th><th>原価（原価率）</th><th>仕入れ（${dayWord(na)}）</th><th>きょうの仕入れ</th><th></th><th>棚（列×奥）</th><th>いまの棚</th><th>きょう売れた</th><th>売切で逃した</th><th>見て買わず</th><th class="l">評価</th></tr></thead><tbody>
    ${list.map(p=>{const pr=set.price[p.id]??p.price,ratio=pr/p.price,cr=p.cost/pr,s=si[p.id];
      return `<tr class="${s?'':'off'}" data-row="${p.id}"><td class="l"><button type="button" class="ks-pname" data-sh="${p.id}"><b>${esc(p.name)}</b></button><br><span class="mut" style="font-size:11px">${I.G[p.genre].name}</span></td><td class="l">${tag(p)}</td>
      <td><span class="ks-num"><button type="button" data-pr="${p.id}" data-d="-10" aria-label="10円下げる">−</button><b>${yen(pr)}</b><button type="button" data-pr="${p.id}" data-d="10" aria-label="10円上げる">＋</button></span></td>
      <td class="${ratio>1.1?'neg':ratio<0.95?'pos':''}">${Math.round(ratio*100)}%</td><td class="${cr>0.7?'neg':''}">${yen(p.cost)}（${Math.round(cr*100)}%）</td>
      <td>${ordCell(p,s)}</td><td>${s||today[p.id]?(today[p.id]||0):'—'}</td><td>${s?`<button type="button" class="ks-btn ks-exp" data-ex="${p.id}" ${expressAny()?'':'disabled'}>${pendingExpress(p.id)?'臨時便（頼み済み）':'臨時便'}</button>`:''}</td>
      <td>${s?`${s.face}×${Math.round(s.cap/s.face)}`:'—'}</td><td data-f="stock">${s?(stock[p.id]||0):'—'}</td><td data-f="sold">${o.items[p.id]||0}</td><td data-f="lost" class="${lostSO[p.id]?'neg':''}">${lostSO[p.id]||0}</td><td data-f="looked">${looked[p.id]||0}</td><td class="l">${rep(p.id)}</td></tr>`;}).join('')}
    </tbody></table></div>`}<p class="ks-note">原価率が7割を超える品（たばこ・新聞・雑誌など）は、売れても残るお金が少ない品です。値段を上げすぎると、値段に敏感な客層（学生・買い物の人）から買わなくなります。棚に新しく置いた品は、次の便から並びます。</p></div>`;
  $('ksAll').onchange=e=>{V.showAll=e.target.checked;render(true);};
  b.querySelectorAll('[data-sh]').forEach(x=>x.onclick=()=>openSheet(x.dataset.sh));
  b.querySelectorAll('[data-undo]').forEach(x=>x.onclick=()=>{const [f,pid]=x.dataset.undo.split('|'),e=(S.orderQ||[]).find(q=>q.from===Number(f));if(e){e.order[pid]=orderFor(e.from-1)[pid]||0;persist();render(true);}});
  b.querySelectorAll('[data-pr]').forEach(x=>x.onclick=()=>edit(c=>{const pid=x.dataset.pr;c.price[pid]=Math.max(10,(c.price[pid]??I.P[pid].price)+Number(x.dataset.d));}));
  b.querySelectorAll('[data-or]').forEach(x=>x.onclick=()=>{const pid=x.dataset.or,st=I.G[I.P[pid].genre].life===0?1:2;editOrder(pid,Number(x.dataset.d)*st);});
  b.querySelectorAll('[data-ex]').forEach(x=>x.onclick=()=>{const pid=x.dataset.ex;V.expSel=pid;V.expConfirm=null;V.expQ=Math.max(1,(si[pid]&&si[pid].cap)||5);render(true);});
  if($('ksExM')){$('ksExM').onclick=()=>{V.expQ=Math.max(1,V.expQ-1);render(true);};$('ksExP').onclick=()=>{V.expQ+=1;render(true);};if($('ksExGo'))$('ksExGo').onclick=()=>{if(openExpress()){V.expConfirm=V.expSel;render(true);return;}orderExpress(V.expSel,V.expQ);};if($('ksExNew'))$('ksExNew').onclick=()=>orderExpress(V.expSel,V.expQ);
    if($('ksExAdd'))$('ksExAdd').onclick=()=>addToExpress(V.expSel,V.expQ);$('ksExNo').onclick=()=>{V.expSel=null;V.expConfirm=null;render(true);};}}

function updateItems(){const res=V.res;if(!res||V.tab!=='items')return;const T0=gT(),stock=KC.stockAt(res,T0),c=counts(res,T0);
  document.querySelectorAll('#ksBody [data-row]').forEach(r=>{const pid=r.dataset.row,vals={stock:stock[pid]||0,sold:c.sold[pid]||0,lost:c.lost[pid]||0,looked:c.looked[pid]||0};
    r.querySelectorAll('[data-f]').forEach(e=>{const v=vals[e.dataset.f];if(v==null||e.textContent==='—')return;const t=String(v);if(e.textContent!==t)e.textContent=t;if(e.dataset.f==='lost')e.classList.toggle('neg',v>0);});});}

/* 棚割り：区画ごとの枠に、どの品を置くか */
function renderLayout(b){const I=ix(),set=curSet(),Z=V.cfg.zones,sel=V.slotSel;
  let pick='';if(sel){const z=Z[sel.z],cur=set.layout[sel.z][sel.i],ok=V.cfg.products.filter(p=>I.G[p.genre].zones.includes(sel.z));
    pick=`<div class="ks-pick"><span>${z.name}の${Math.floor(sel.i/z.cols)+1}段目・${sel.i%z.cols+1}列目：</span><select id="ksPickSel"><option value="">（空ける）</option>${ok.map(p=>`<option value="${p.id}" ${p.id===cur?'selected':''}>${esc(p.name)}（${yen(set.price[p.id]??p.price)}）</option>`).join('')}</select>
      <button type="button" class="ks-btn" id="ksPickClose">閉じる</button><span class="ks-note" style="margin:0">同じ品を隣の枠にも置くと「列」が増え、目につきやすく、たくさん並べられます。新しく置いた品は、仕入れの締め切りしだいで${dayWord(nextOrderDay())}届きます（急ぐなら「商品」の臨時便）。</span></div>`;}
  b.innerHTML=`<div class="ks-card"><h3><span>棚割り</span><small>枠を押して、置く品を選びます（区画ごとに置ける品が決まっています）</small></h3>
    <div class="ks-zones" style="margin-top:10px">${Object.entries(Z).map(([zk,z])=>`<div class="ks-zone"><h4>${z.name}<small>${z.rows}段×${z.cols}列・1列に${z.depth}個</small></h4>
      <div class="ks-grid" style="grid-template-columns:repeat(${z.cols},minmax(0,1fr))">${(set.layout[zk]||[]).map((pid,i)=>{const p=pid&&I.P[pid];return `<button type="button" class="ks-slot ${p?'':'empty'}" data-z="${zk}" data-i="${i}" aria-pressed="${!!(sel&&sel.z===zk&&sel.i===i)}">${p?esc(p.short):'空き'}${p?`<i style="background:${p.color}"></i>`:''}</button>`;}).join('')}</div></div>`).join('')}</div>
    ${pick}<p class="ks-note">目の高さ（冷蔵ケースの2・3段目、中央の棚の2・3段目など）ほど目につきます。いま置いていない品：${V.cfg.products.filter(p=>!KC.shelfInfo(V.cfg,set.layout)[p.id]).map(p=>p.short).join('・')}</p></div>`;
  b.querySelectorAll('.ks-slot').forEach(x=>x.onclick=()=>{V.slotSel={z:x.dataset.z,i:Number(x.dataset.i)};render(true);});
  if($('ksPickSel'))$('ksPickSel').onchange=e=>{const {z,i}=V.slotSel,v=e.target.value||null;edit(c=>{c.layout[z][i]=v;});if(v){const na=nextOrderDay();if(!orderFor(na)[v]){V.st.orderQ=V.st.orderQ||[];let e=V.st.orderQ.find(x=>x.from===na);if(!e){e={from:na,order:orderFor(na)};V.st.orderQ.push(e);}e.order[v]=KC.defaultOrder(V.cfg,v,V.cfg.zones[z].depth);persist();}}};
  if($('ksPickClose'))$('ksPickClose').onclick=()=>{V.slotSel=null;render(true);};}

/* 客層・時間帯・買わなかった理由・置いていなくて帰った人 */
function renderPeople(b,res){const I=ix(),T0=gT(),k=KC.idxAt(res,T0),ps={},psLook={},why={},miss={},hr=new Float64Array(H),items={},mot={},addon={n:0};
  for(let i=0;i<k;i++){const e=res.ev[i];if(e.k==='buy'){ps[e.ps]=(ps[e.ps]||0)+1;const mm=e.mot||'plan';mot[mm]=(mot[mm]||0)+1;if(e.addon)addon.n++;hr[Math.floor(e.t/60)]+=e.yen;const m=items[e.ps]||(items[e.ps]={});for(const [p,q] of e.items)m[p]=(m[p]||0)+q;}
    else if(e.k==='look'){psLook[e.ps]=(psLook[e.ps]||0)+1;why[e.why]=(why[e.why]||0)+1;if(e.why==='置いていない')miss[e.genre]=(miss[e.genre]||0)+1;}}
  const mx=Math.max(1,...Object.values(ps)),hm=Math.max(1,...hr),hN=Math.floor(T0/60);
  b.innerHTML=`<div class="ks-g2"><div class="ks-card"><h3><span>買った人の客層</span><small>いままで</small></h3><div class="ks-bars">${V.cfg.personas.map(p=>`<div><span>${p.name}</span><u style="width:${(ps[p.id]||0)/mx*100}%;background:${p.icon}"></u><em>${ps[p.id]||0}人</em></div>`).join('')}</div>
      <p class="ks-note">客層ごとのよく買う品：${V.cfg.personas.filter(p=>items[p.id]).map(p=>`${p.short}＝${Object.entries(items[p.id]).sort((a,b)=>b[1]-a[1]).slice(0,2).map(([x])=>I.P[x].short).join('・')}`).join('／')||'—'}</p></div>
    <div class="ks-card"><h3><span>見たけど買わなかった理由</span></h3><div class="ks-bars">${Object.entries(why).sort((a,b)=>b[1]-a[1]).map(([w,n])=>`<div><span>${w}</span><u style="width:${n/Math.max(...Object.values(why))*100}%;background:#c9a35c"></u><em>${n}人</em></div>`).join('')||'<p class="ks-note">まだいません。</p>'}</div>
      <p class="ks-note">置いていなくて帰った人がほしかった物：${Object.entries(miss).map(([gid,n])=>I.G[gid].name+' '+n+'人').join('・')||'—'}</p></div>
    <div class="ks-card"><h3><span>買ったきっかけ</span><small>いままで</small></h3>${(()=>{const L=V.cfg.mood&&V.cfg.mood.labels||{},en=Object.entries(mot).sort((a,b)=>b[1]-a[1]),m2=Math.max(1,...en.map(x=>x[1])),tot=en.reduce((a,x)=>a+x[1],0);
        const C={plan:'#8aa1b8',impulse:'#e0a84f',queue:'#d98a5b',herd:'#c97bb0',sns:'#5b8fd9',trend:'#d9645b',new:'#5bb08a',rain:'#6aa7c9',regular:'#9a8a6a',mania:'#7a6ad9'};
        return `<div class="ks-bars">${en.map(([m,n])=>`<div><span>${L[m]||m}</span><u style="width:${n/m2*100}%;background:${C[m]||'#999'}"></u><em>${n}人</em></div>`).join('')||'<p class="ks-note">まだいません。</p>'}</div>
        <p class="ks-note">${tot?`${addon.n}人は、ついでにもう1品買っていました。`:''}${res.moodG?'きょうの気分：'+Object.entries(res.moodG).sort((a,b)=>b[1]-a[1]).slice(0,2).map(([gid,v])=>`${I.G[gid].name}がふだんの${Math.round(v*100)}%`).join('・')+'、'+Object.entries(res.moodG).sort((a,b)=>a[1]-b[1]).slice(0,1).map(([gid,v])=>`${I.G[gid].name}は${Math.round(v*100)}%`).join('')+'。':''}「なんとなく」は目につく場所・安い・手軽な品、「前の人につられて」は数分前に同じ品が売れたとき、「SNSを見て」は話題の品を目当てに来た人です。</p>`;})()}</div>
    <div class="ks-card"><h3><span>時間帯の売上</span><small>いまの時刻まで</small></h3><div class="ks-hrs">${Array.from({length:19},(_,j)=>{const h=j+5;return `<span class="${h===hN?'now':''}" style="height:${hr[h]/hm*100}%" title="${h}時台 ${yen(hr[h])}"></span>`;}).join('')}</div><div class="ks-hlab"><span>5時</span><span>9</span><span>13</span><span>17</span><span>21</span><span>23時</span></div></div></div>`;}

/* 収支 */
function renderMoney(b,res){const S=V.st,P=res.pl,o=KC.soFar(V.cfg,res,gT());
  const row=(n,v,cls)=>`<tr><td class="l">${n}</td><td class="${cls||''}">${yen(v)}</td></tr>`;
  b.innerHTML=`<div class="ks-g2"><div class="ks-card"><h3><span>きょう1日の見込み</span><small>このまま閉店まで続けた場合（いまの設定で）</small></h3><table class="ks-t"><tbody>
      ${row('売上',P.sales)}${row('仕入れ原価（売れた分）',-P.cogs,'mut')}${row('廃棄（売れ残り・保温切れ）',-P.waste,'mut')}${P.express?row('臨時便の料金',-P.express,'mut'):''}${row('人件費',-P.staff,'mut')}${row('場所代（売上の'+Math.round(V.rcfg.places[S.place].rentRate*100)+'%か最低額）',-P.rent,'mut')}${row('電子マネーの手数料',-P.fee,'mut')}${row('電気代など',-P.util,'mut')}
      <tr><td class="l"><b>損益</b></td><td class="${P.profit<0?'neg':'pos'}"><b>${yen(P.profit)}</b></td></tr></tbody></table>
      <p class="ks-note">いまの時刻までの売上は ${yen(o.sales)}。新聞・雑誌の売れ残りは返品するので、捨てる分には入りません。</p></div>
    <div class="ks-card"><h3><span>これまでの運行日</span><small>積み立て ${man(S.cash)}</small></h3><div class="ks-scroll" style="max-height:300px"><table class="ks-t"><thead><tr><th class="l">運行日</th><th>客</th><th>売上</th><th>廃棄</th><th>損益</th><th class="l">売れ筋</th></tr></thead><tbody>
      ${S.hist.slice().reverse().map(h=>`<tr><td class="l">${h.day}（${DAYN[h.cond.day]}・${WXN[h.cond.wx]}）</td><td>${h.cust}</td><td>${yen(h.sales)}</td><td>${yen(h.waste)}</td><td class="${h.profit<0?'neg':'pos'}">${yen(h.profit)}</td><td class="l">${h.top.slice(0,3).map(([p,q])=>ix().P[p].short+q).join('・')}</td></tr>`).join('')||'<tr><td class="l" colspan="6">まだ締めた日はありません（26:00を過ぎると締めます）。</td></tr>'}</tbody></table></div>
      <div style="margin-top:10px;display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span style="font-size:12.5px">店員の人数</span>${[1,2,3].map(n=>`<button type="button" class="ks-chip" data-staff="${n}" aria-pressed="${curSet().staff===n}">${n}人</button>`).join('')}<span class="ks-note" style="margin:0">ふやすと列が短くなり、電車の時間で帰る人が減ります。人件費は1人1時間${yen(V.cfg.wage)}。</span></div></div></div>`;
  b.querySelectorAll('[data-staff]').forEach(x=>x.onclick=()=>edit(c=>{c.staff=Number(x.dataset.staff);}));}
function renderNews(b){const S=V.st,list=S.news.slice().reverse();
  b.innerHTML=`<div class="ks-card"><h3><span>お知らせ</span><small>ブーム・SNS・常連・評価・売り切れ・廃棄など（運行日の終わりに届きます）</small></h3><div class="ks-news">${list.map(n=>`<div class="${n.kind}"><b>${esc(n.title)}</b><small>運行日${n.day}</small> ${esc(n.text)}</div>`).join('')||'<p class="ks-note">まだありません。</p>'}</div></div>`;}

/* ---------- 売店の正面の絵 ---------- */
const BOX={hook:[136,118,170,190],top:[320,110,380,40],fridge:[136,316,190,190],shelf:[336,160,190,346],tobacco:[540,160,170,44],hot:[724,250,110,80],warmer:[724,334,110,30],umbrella:[690,372,30,134],rack:[860,150,110,356]};
function zoneSlots(zk){const z=V.cfg.zones[zk],[x,y,w,h]=BOX[zk],out=[];const cw=w/z.cols,rh=h/z.rows;for(let i=0;i<z.rows*z.cols;i++){const r=Math.floor(i/z.cols),c=i%z.cols;out.push([x+c*cw,y+r*rh,cw,rh]);}return out;}
function rr(c,x,y,w,h,r){c.beginPath();c.roundRect(x,y,w,h,r);}
function drawItem(c,p,x,y,w,h,k){const col=p.color,gid=p.genre;c.save();
  if(gid==='onigiri'){for(let j=0;j<k;j++){const xx=x+4+j*(w-8)/Math.max(1,k);c.fillStyle='#f4f1e6';c.beginPath();c.moveTo(xx+w*0.14,y+h*0.25);c.lineTo(xx,y+h*0.85);c.lineTo(xx+w*0.28,y+h*0.85);c.closePath();c.fill();c.fillStyle='#1d2b22';c.fillRect(xx+w*0.06,y+h*0.62,w*0.16,h*0.23);}}
  else if(gid==='colddrink'||gid==='coffee'||gid==='energy'||gid==='alcohol'||gid==='hotdrink'){const can=gid!=='colddrink';for(let j=0;j<Math.min(3,k);j++){const bw=can?w*0.22:w*0.2,xx=x+3+j*(w-6)/3;c.fillStyle=col;rr(c,xx,y+(can?h*0.3:h*0.12),bw,h*(can?0.62:0.8),2);c.fill();c.fillStyle='rgba(255,255,255,.35)';c.fillRect(xx+1,y+h*0.4,2,h*0.3);if(!can){c.fillStyle='#ddd';c.fillRect(xx+bw*0.3,y+h*0.05,bw*0.4,h*0.08);}}}
  else if(gid==='bread'||gid==='donut'||gid==='hot'){for(let j=0;j<Math.min(3,k);j++){const xx=x+w*0.18+j*w*0.3;c.fillStyle=col;c.beginPath();c.ellipse(xx,y+h*0.62,w*0.15,h*0.26,0,0,7);c.fill();if(gid==='donut'){c.fillStyle='rgba(0,0,0,.25)';c.beginPath();c.arc(xx,y+h*0.62,w*0.04,0,7);c.fill();}}}
  else if(gid==='sand'){for(let j=0;j<Math.min(2,k);j++){const xx=x+4+j*w*0.45;c.fillStyle='#fbf6e8';c.beginPath();c.moveTo(xx,y+h*0.85);c.lineTo(xx+w*0.38,y+h*0.85);c.lineTo(xx+w*0.38,y+h*0.25);c.closePath();c.fill();c.fillStyle=col;c.fillRect(xx+w*0.05,y+h*0.62,w*0.3,h*0.08);}}
  else if(gid==='paper'||gid==='magazine'){for(let j=0;j<Math.min(3,k);j++){c.fillStyle=gid==='paper'?'#eeeee6':col;rr(c,x+6+j*3,y+4+j*2,w-22,h-12,2);c.fill();c.fillStyle=gid==='paper'?col:'rgba(255,255,255,.7)';c.fillRect(x+10+j*3,y+8+j*2,w-32,6);}}
  else if(gid==='tobacco'){for(let j=0;j<Math.min(4,k);j++){c.fillStyle=col;c.fillRect(x+3+j*(w-6)/4,y+h*0.2,(w-6)/4-2,h*0.7);c.fillStyle='rgba(0,0,0,.2)';c.fillRect(x+3+j*(w-6)/4,y+h*0.2,(w-6)/4-2,3);}}
  else if(gid==='umbrella'){for(let j=0;j<Math.min(8,k);j++){c.strokeStyle=j%3===2?'#2b3d6b':'#c9dde6';c.lineWidth=4;c.beginPath();c.moveTo(x+6+j*2.6,y+10);c.lineTo(x+8+j*2.6,y+h-4);c.stroke();}}
  else{for(let j=0;j<Math.min(2,k);j++){c.fillStyle=col;rr(c,x+3+j*w*0.46,y+h*0.12,w*0.42,h*0.8,3);c.fill();c.fillStyle='rgba(255,255,255,.4)';c.fillRect(x+5+j*w*0.46,y+h*0.2,w*0.3,h*0.12);}}
  c.restore();}
function drawKiosk(c,res,Tn){const I=ix(),set=curSet(),si=KC.shelfInfo(V.cfg,set.layout),stock=res?KC.stockAt(res,Tn):{};const W=1000;
  // ホーム
  c.fillStyle='#3a3f44';c.fillRect(0,0,W,30);c.fillStyle='#c9c6be';c.fillRect(0,30,W,470);c.fillStyle='#a7a49b';c.fillRect(0,500,W,100);c.fillStyle='#e2c84a';c.fillRect(0,588,W,8);
  for(const x of [60,950]){c.fillStyle='#d4d1c9';c.fillRect(x-10,30,20,470);c.fillStyle='#c4302b';for(let y=180;y<300;y+=24)c.fillRect(x-10,y,20,10);}
  // 本体と看板
  c.fillStyle='#d8d3c6';c.fillRect(110,40,880-110+100,470);c.fillStyle='#f6f4ef';rr(c,110,40,870,64,4);c.fill();
  c.fillStyle='#d33a3a';c.fillRect(124,56,120,8);c.fillRect(124,72,120,8);c.fillStyle='#22313a';c.font='700 30px "Zen Kaku Gothic New",sans-serif';c.textAlign='left';c.fillText('みなとスタンド',258,84);
  c.font='700 34px "Zen Kaku Gothic New",sans-serif';c.fillText('売店',520,86);c.fillStyle='#2f8a6e';rr(c,820,52,140,40,4);c.fill();c.fillStyle='#fff';c.font='700 13px sans-serif';c.fillText('電子マネー',840,70);c.fillText('使えます',846,86);
  c.fillStyle='#efece4';c.fillRect(124,104,746,402);
  // 区画の下地
  const bg={hook:'#e9e6df',top:'#efece4',fridge:'#dfe7ea',shelf:'#f1ebdd',tobacco:'#d9d3c3',hot:'#f3d9a6',warmer:'#efd0b8',umbrella:'#e6e3dc',rack:'#f4f4f0'};
  for(const zk in BOX){const [x,y,w,h]=BOX[zk];c.fillStyle=bg[zk];c.fillRect(x-2,y-2,w+4,h+4);if(zk==='fridge'||zk==='hot'){c.strokeStyle=zk==='hot'?'#b48a3a':'#9fb3bb';c.lineWidth=3;c.strokeRect(x-3,y-3,w+6,h+6);}}
  // 商品
  for(const zk in BOX){const z=V.cfg.zones[zk],sl=zoneSlots(zk),arr=set.layout[zk]||[];
    arr.forEach((pid,i)=>{const [x,y,w,h]=sl[i];if(zk==='shelf'||zk==='fridge'||zk==='hook'){c.fillStyle='rgba(0,0,0,.12)';c.fillRect(x,y+h-3,w,2);}if(!pid)return;const p=I.P[pid],s=si[pid];
      const per=s?(stock[pid]||0)/s.face:0,k=Math.max(0,Math.ceil(Math.min(z.depth,per)/z.depth*3-1e-6)*(zk==='umbrella'?2.6:1));
      if(k>0)drawItem(c,p,x+1,y+1,w-2,h-6,zk==='umbrella'?Math.ceil(per/2):k);
      // 値札・売切
      const pr=set.price[pid]??p.price,sv=stock[pid]||0,lowS=s&&sv>0&&sv<=Math.max(1,Math.ceil(s.cap*0.25));
      c.fillStyle=sv<=0?'#d8382e':lowS?'#e0a21b':'#ffffff';c.fillRect(x+2,y+h-11,Math.min(w-4,42),9);c.fillStyle=sv<=0||lowS?'#fff':'#333';c.font='8px sans-serif';c.textAlign='left';c.fillText(sv<=0?'売切':lowS?'残り'+sv:pr+'円',x+4,y+h-4);
      if(V.sheet===pid){c.strokeStyle='#0b6b64';c.lineWidth=3;c.strokeRect(x,y,w,h);}});}
  c.fillStyle='#55504a';c.font='11px sans-serif';c.textAlign='left';c.fillText('たばこ（年齢確認）',540,156);c.fillText('ホットスナック',724,246);
  // 会計カウンターと店員
  c.fillStyle='#b9b2a3';c.fillRect(540,330,180,40);c.fillStyle='#e9e5dc';c.fillRect(540,370,150,136);c.fillStyle='#4a5056';rr(c,600,300,70,34,4);c.fill();c.fillStyle='#9fd3c7';c.fillRect(608,306,40,12);
  c.fillStyle='#2f8a6e';rr(c,560,392,70,28,3);c.fill();c.fillStyle='#fff';c.font='700 11px sans-serif';c.fillText('お会計',574,410);
  const n=curSet().staff;for(let i=0;i<n;i++){const sx=580+i*55,sy=262;c.fillStyle='#f0c9a0';c.beginPath();c.arc(sx,sy,13,0,7);c.fill();c.fillStyle='#24345a';c.beginPath();c.arc(sx,sy-4,13,Math.PI,0);c.fill();c.fillRect(sx-16,sy+12,32,30);c.fillStyle='#fff';c.fillRect(sx-6,sy+14,12,26);}
  // ラックの名札
  c.fillStyle='#55504a';c.fillText('新聞・雑誌',870,146);}
function personColor(ps){const p=ix().PS[ps];return p?p.icon:'#555';}
function spawnFromEvent(e){const I=ix();const pid=e.pid||(e.items&&e.items[0][0]);let zx=480;if(pid){for(const zk in BOX){const arr=curSet().layout[zk]||[],i=arr.indexOf(pid);if(i>=0){const sl=zoneSlots(zk)[i];zx=sl[0]+sl[2]/2;break;}}}
  const from=Math.random()<0.5?-30:1030,y=540+Math.random()*40;
  const P0={x:from,y,tx:clampX(zx),ty:y,ps:e.ps,col:personColor(e.ps),st:0,t:0,e,walk:0,kid:e.ps==='jk'||e.ps==='stu'};
  V.people.push(P0);if(V.people.length>24)V.people.shift();}
const clampX=x=>Math.max(60,Math.min(980,x));
function bubble(x,y,text,col,sub){V.bubbles.push({x,y,text,col,sub,t:0});if(V.bubbles.length>10)V.bubbles.shift();}
function stepPeople(dt,mv){const I=ix();for(const p of V.people){const sp=110*mv*dt;
  if(p.st===0){const dx=p.tx-p.x;if(Math.abs(dx)<4){p.st=1;p.t=0;}else{p.x+=Math.sign(dx)*Math.min(Math.abs(dx),sp);p.walk+=sp;p.dir=Math.sign(dx);}}
  else if(p.st===1){p.t+=dt*mv;if(p.t>1.4){const e=p.e;
      if(e.k==='buy'){p.tx=clampX(610+Math.random()*30);p.st=2;}
      else{const why=e.why;bubble(p.x,p.y-90,why==='値段が高い'?'高いなあ…':why==='売り切れ'?'売り切れか…':why==='置いていない'?I.G[e.genre].name+'、ないのか':why==='列が長い'?'電車が来ちゃう':'うーん…','#ffe7a3',(I.PS[e.ps]||{}).short);p.st=3;p.tx=Math.random()<0.5?-40:1040;}}}
  else if(p.st===2){const dx=p.tx-p.x;if(Math.abs(dx)<4){p.t+=dt*mv;if(!p.paid){p.paid=true;const e=p.e;bubble(p.x,p.y-96,'+'+yen(e.yen)+'　'+e.items.map(([q])=>I.P[q].short).join('・'),'#bff0c8',(I.PS[e.ps]||{}).short+(e.reg?'・常連':e.mania?'・マニア':motL(e.mot)?'・'+motL(e.mot):''));}
      if(p.t>2.2){p.st=3;p.tx=Math.random()<0.5?-40:1040;}}else{p.x+=Math.sign(dx)*Math.min(Math.abs(dx),110*mv*dt);p.walk+=110*mv*dt;}}
  else{const dx=p.tx-p.x;p.x+=Math.sign(dx)*Math.min(Math.abs(dx),130*mv*dt);p.walk+=130*mv*dt;if(Math.abs(dx)<4)p.gone=true;}}
  V.people=V.people.filter(p=>!p.gone);}
function drawPerson(c,p){const s=p.kid?0.85:1;c.save();c.translate(p.x,p.y);c.scale(s,s);const step=Math.sin(p.walk*0.12)*3;
  c.fillStyle='rgba(0,0,0,.18)';c.beginPath();c.ellipse(0,0,13,4,0,0,7);c.fill();c.strokeStyle='#2a2a30';c.lineWidth=5;c.lineCap='round';c.beginPath();c.moveTo(-3,-26);c.lineTo(-3+step,-2);c.moveTo(3,-26);c.lineTo(3-step,-2);c.stroke();
  c.fillStyle=p.col;rr(c,-11,-64,22,40,6);c.fill();if(p.ps==='jk'){c.fillStyle='#24345a';c.fillRect(-11,-34,22,10);c.fillStyle='#d33a3a';c.fillRect(-3,-60,6,6);}
  c.fillStyle='#f0c9a0';c.beginPath();c.arc(0,-74,10,0,7);c.fill();c.fillStyle=p.ps==='sen'?'#bdbdbd':'#2b2016';c.beginPath();c.arc(0,-77,10,Math.PI*1.05,Math.PI*1.95);c.fill();
  if(p.ps==='jk'){c.fillRect(-10,-78,4,16);c.fillRect(6,-78,4,16);}c.restore();}
function draw(dt,time){const c=V.cx,Tn=gT();if(!c)return;c.clearRect(0,0,1000,600);
  if(!V.st){c.fillStyle='#2a2f33';c.fillRect(0,0,1000,600);c.fillStyle='#fff';c.font='16px sans-serif';c.textAlign='center';c.fillText('売店を出す場所を選んでください',500,300);return;}
  const res=ensureRes();drawKiosk(c,res,Tn);
  const mult=g(()=>playing,true)?Math.max(0,g(()=>speed,1/60)*60):0,mv=Math.min(6,Math.max(1,mult));
  // 出来事から人を出す（速いときは、絵にするのは1秒に3人まで。全部は「売れ行き」に出る）
  if(res){if(V.lastT==null||Tn<V.lastT-0.01||Tn-V.lastT>20){V.evI=KC.idxAt(res,Tn);V.people=[];}
    V.spawnBudget=Math.min(3,(V.spawnBudget||0)+dt*3);
    while(V.evI<res.ev.length&&res.ev[V.evI].t<=Tn){const e=res.ev[V.evI++];
      if((e.k==='buy'||e.k==='look')&&V.spawnBudget>=1){V.spawnBudget-=1;spawnFromEvent(e);}
      else if(e.k==='review'&&V.spawnBudget>=0.5){bubble(300+Math.random()*400,470,'★'.repeat(e.stars)+'「'+e.text+'」','#fff2c2',ix().P[e.pid].short);}
      else if(e.k==='sns'){bubble(200+Math.random()*600,440,(e.good?'SNSに投稿：':'SNSに不満：')+ix().P[e.pid].short,'#c9dcff',(ix().PS[e.ps]||{}).short);}
      else if(e.k==='delivery'){bubble(500,140,e.name+'が届いた','#e6e6e6','');}}
    V.lastT=Tn;}
  stepPeople(dt,mv);for(const p of V.people.slice().sort((a,b)=>a.y-b.y))drawPerson(c,p);
  V.bubbles=V.bubbles.filter(b=>(b.t+=dt)<3.2);
  for(const b of V.bubbles){const a=Math.min(1,b.t*3,(3.2-b.t)*1.5);c.globalAlpha=a;c.font='13px "Zen Kaku Gothic New",sans-serif';const w=Math.min(380,c.measureText(b.text).width+20),x=Math.max(10,Math.min(990-w,b.x-w/2)),y=b.y-b.t*10;
    c.fillStyle=b.col;rr(c,x,y,w,b.sub?36:22,8);c.fill();c.fillStyle='#1c2826';c.textAlign='left';c.fillText(b.text,x+10,y+15);if(b.sub){c.fillStyle='#5b6a66';c.font='11px sans-serif';c.fillText(b.sub,x+10,y+30);}c.globalAlpha=1;}
  // 時計
  c.fillStyle='rgba(15,20,24,.82)';rr(c,10,8,96,26,5);c.fill();c.fillStyle='#ffb347';c.font='700 18px "DotGothic16",monospace';c.textAlign='left';c.fillText(fmtT(Tn),20,28);
  const O0=V.cfg.open[0]*60,O1=V.cfg.open[1]*60;if(Tn<O0||Tn>=O1){c.fillStyle='rgba(20,24,28,.55)';c.fillRect(124,104,746,402);c.fillStyle='#fff';c.font='700 22px sans-serif';c.textAlign='center';c.fillText(Tn<O0?'開店前（6:00から）':'本日の営業は終わりました',497,300);}}
function onCanvasClick(ev){if(!V.st)return;const r=V.cv.getBoundingClientRect(),x=(ev.clientX-r.left)*1000/r.width,y=(ev.clientY-r.top)*600/r.height;
  for(const zk in BOX){const sl=zoneSlots(zk);for(let i=0;i<sl.length;i++){const [sx,sy,sw,sh]=sl[i];if(x>=sx&&x<=sx+sw&&y>=sy&&y<=sy+sh){const pid=(curSet().layout[zk]||[])[i];
      if(pid){openSheet(pid);return;}V.tab='layout';V.slotSel={z:zk,i};render(true);$('ksBody').scrollIntoView({behavior:'smooth',block:'start'});return;}}}}   // 品のある枠は商品カード、空き枠は棚割り
function loop(ts){const dt=V.lastTs?Math.min(0.1,(ts-V.lastTs)/1000):0;V.lastTs=ts;if(!V.open)return;
  V.drawAcc=(V.drawAcc||0)+dt;const fps=g(()=>playing,true)?30:8;if(V.cfg&&V.drawAcc>=1/fps-0.002){draw(V.drawAcc,ts/1000);V.drawAcc=0;}V.panelT+=dt;if(V.panelT>0.6){V.panelT=0;if(V.st){renderKpi();if(V.tab==='log')renderBody(false);}}
  V.heavyT+=dt;if(V.heavyT>1){V.heavyT=0;if(V.st){renderAlert(false);updateSheet();updateItems();V.slowT=(V.slowT||0)+1;if(V.slowT>=5&&(V.tab==='people')){V.slowT=0;renderBody(true);}}}
  V.raf=requestAnimationFrame(loop);}

/* ---------- 起動 ---------- */
mount();setInterval(tick,1000);
window.minatoKiosk={get state(){return V.st;},get today(){return V.res;},open:()=>setOpen(true),sync:()=>{ensureRes();},persist:()=>persist(),get ready(){return !!V.cfg;},
  closeToday(){const r=ensureRes();if(r){closeToday(r);g(()=>{ENS.day=ENS.day;});}return V.st&&V.st.hist.at(-1);},   // 開発用：きょうの分で1日を締める（運行日は進めない）
  reset(){try{localStorage.removeItem(KEY);}catch(e){}V.st=null;V.res=null;render(true);badge();}};
})();
