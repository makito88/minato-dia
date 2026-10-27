/* =====================================================================
   駅ナカ商店（試作）の表示
   ・計算は js/shop-core.js、設定は data/shop.json。ここは絵と表だけ。
   ・ゲームの時計（T）と運行日（ENS.day）、列車シミュレーションの結果（D.sim）を読むだけで、
     ゲーム本体の数値は変えない。
   ・「自動で巡る」で駅を順に映し、客が来て、品物が減り、品出しで戻り、売上が積み上がるのを眺める。
   ===================================================================== */
(function(){
'use strict';
if(typeof ShopCore==='undefined')return;
const SC=ShopCore,KEY='dia-shop';
const V={cfg:null,err:null,state:null,plan:null,pk:'',open:false,st:'C',auto:true,tourT:0,lastT:null,cur:{},people:[],pops:[],walkers:[],sparks:[],unread:0,seen:0,cv:null,cx:null,raf:0,lastTs:0,panelT:0,layout:null};
const $=id=>document.getElementById(id);
const g=(n,d)=>{try{return n();}catch(e){return d;}};
const gameT=()=>g(()=>T,600),gameD=()=>g(()=>D,null),gameDay=()=>g(()=>ENS.day,1),gameCond=()=>g(()=>COND,{day:'wd',wx:'sun',season:'aut'});
const stName=s=>g(()=>ST[s].name,s);
const fmtT=t=>g(()=>fmt(t),String(Math.floor(t/60))+':'+String(Math.floor(t%60)).padStart(2,'0'));
const yenS=n=>'¥'+Math.round(n).toLocaleString('ja-JP');
const manS=n=>(n<0?'−':'')+(Math.abs(n)>=1e8?(Math.abs(n)/1e8).toFixed(2)+'億円':(Math.abs(n)/1e4).toFixed(Math.abs(n)>=1e6?0:1)+'万円');
const STORDER=['C','S','U','M','K','N','P','F','T','O'];

/* ---------- 読み込みと保存 ---------- */
function load(){fetch('data/shop.json').then(r=>{if(!r.ok)throw new Error('HTTP '+r.status);return r.json();}).then(c=>{V.cfg=c;
    let saved=null;try{saved=JSON.parse(localStorage.getItem(KEY)||'null');}catch(e){}
    V.state=SC.create(c,saved);
    if(!saved){V.state.closed=gameDay()-1;}          // はじめて開いた日から数える（過去の運行日にさかのぼって売ったことにはしない）
    V.seen=V.state.news.length;try{V.seen=Number(localStorage.getItem(KEY+'-seen'))||V.state.news.length;}catch(e){}
    V.lastDay=gameDay();persist();ensurePlan();badge();if(V.open)renderPanel(true);})
  .catch(e=>{V.err=String(e.message||e);if(V.open)renderPanel(true);});}
function persist(){try{localStorage.setItem(KEY,JSON.stringify(V.state));localStorage.setItem(KEY+'-seen',String(V.seen));}catch(e){}}

/* ---------- 計画：列車シミュレーションの乗降から、その運行日の売れ方を決める ---------- */
function flowsOf(d){const f={};for(const s of STORDER){const st=d.sim&&d.sim.stat&&d.sim.stat[s];if(!st)continue;f[s]={hb:st.hb,ha:st.ha};}return f;}
function ensurePlan(){const d=gameD();if(!V.cfg||!d||!d.sim)return;const c=gameCond(),day=gameDay();
  const k=day+'|'+c.day+c.wx+c.season+'|'+Object.keys(V.state.open).filter(x=>V.state.open[x]).join(',')+'|'+JSON.stringify(V.state.prod);
  if(V.plan&&V.planD===d&&V.pk===k)return;
  V.plan=SC.planDay(V.cfg,V.state,{day,cond:{day:c.day,wx:c.wx,season:c.season},flows:flowsOf(d)});V.planD=d;V.pk=k;V.cur={};V.lastT=null;}

/* 運行日が進んだら、前の日の計画で締める（沿線暦が日を進めたときだけ） */
function watchDay(){if(!V.cfg)return;const day=gameDay();
  if(day<V.lastDay){V.lastDay=day;V.state.closed=day-1;persist();}
  if(day>V.lastDay){const n=Math.min(7,day-V.lastDay);
    if(V.plan&&V.plan.day===V.lastDay){for(let i=0;i<n;i++){const p=i===0?V.plan:{...V.plan,day:V.lastDay+i};const r=SC.closeDay(V.cfg,V.state,p);V.state=r.state;}}
    V.lastDay=day;persist();badge();V.plan=null;
    const op=V.state.news.slice(V.seen).reverse().find(x=>x.kind==='open');if(op&&V.open&&V.auto){V.st=op.st;V.tourT=0;}}
  ensurePlan();}

/* ---------- 画面の骨組み ---------- */
const CSS=`
.shopbtn{position:relative}
.shopv{position:fixed;inset:0;z-index:66;background:var(--paper);color:var(--ink);overflow:auto;padding:calc(env(safe-area-inset-top,0px) + 10px) max(14px,env(safe-area-inset-right,0px)) calc(env(safe-area-inset-bottom,0px) + 20px) max(14px,env(safe-area-inset-left,0px))}
.shopv[hidden]{display:none!important}
.sv-in{max-width:1180px;margin:0 auto;display:grid;gap:12px}
.sv-hd{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px}
.sv-hd h2{margin:0;font-size:19px;letter-spacing:.04em}.sv-hd h2 small{font-size:12px;color:var(--muted);font-weight:400;margin-left:8px;letter-spacing:0}
.sv-sp{flex:1}
.sv-btn{font:inherit;font-size:13px;border:1px solid var(--line);background:var(--panel);color:var(--ink);border-radius:7px;padding:6px 11px;cursor:pointer}
.sv-btn[aria-pressed="true"]{background:var(--accent);color:var(--accent-ink);border-color:var(--accent);font-weight:700}
.sv-btn:focus-visible,.sv-tab:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.sv-tabs{display:flex;gap:6px;flex-wrap:wrap}
.sv-tab{font:inherit;font-size:13px;border:1px solid var(--line);background:var(--panel);color:var(--ink);border-radius:999px;padding:4px 11px;cursor:pointer;display:inline-flex;gap:6px;align-items:baseline}
.sv-tab b{font-size:11px;font-family:var(--f-mono);color:var(--muted);font-weight:400}
.sv-tab[aria-current="true"]{border-color:var(--ink);font-weight:700;background:var(--paper)}
.sv-tab[disabled]{opacity:.45;cursor:default}
.sv-stage{position:relative;border-radius:10px;overflow:hidden;border:1px solid var(--line);background:#2a2f33}
.sv-stage canvas{display:block;width:100%;height:auto}
.sv-cap{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:12px;color:var(--muted);padding:0 2px}
.sv-cap b{color:var(--ink);font-family:var(--f-mono);font-weight:700}
.sv-grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:12px}
.sv-card{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:12px 14px;min-width:0}
.sv-card h3{margin:0 0 8px;font-size:14px;display:flex;justify-content:space-between;gap:8px;align-items:baseline}.sv-card h3 small{font-size:11.5px;color:var(--muted);font-weight:400}
.c4{grid-column:span 4}.c5{grid-column:span 5}.c7{grid-column:span 7}.c8{grid-column:span 8}.c6{grid-column:span 6}.c12{grid-column:span 12}
@media (max-width:600px){.sv-hd h2 small{display:none}}
@media (max-width:900px){.c4,.c5,.c7,.c8,.c6{grid-column:span 12}}
.sv-big{font-family:var(--f-mono);font-size:30px;font-weight:700;line-height:1.1;font-variant-numeric:tabular-nums}
.sv-kv{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px 10px;margin-top:8px}
.sv-kv div{min-width:0}.sv-kv span{display:block;font-size:11px;color:var(--muted)}.sv-kv b{font-family:var(--f-mono);font-size:14px;font-variant-numeric:tabular-nums}
.sv-t{width:100%;min-width:560px;border-collapse:collapse;font-size:12.5px;font-variant-numeric:tabular-nums}
.sv-t th{font-size:11px;color:var(--muted);font-weight:400;text-align:right;padding:3px 6px;border-bottom:1px solid var(--line)}
.sv-t td{padding:5px 6px;border-bottom:1px solid var(--line);text-align:right;white-space:nowrap}
.sv-t td:first-child,.sv-t th:first-child{text-align:left;white-space:normal}
.sv-t .shut{color:var(--muted)}
.sv-bar{height:7px;border-radius:4px;background:var(--line);overflow:hidden;min-width:60px}.sv-bar i{display:block;height:100%;background:var(--accent)}
.sv-bar.low i{background:#c9573f}
.sv-rank{display:grid;gap:6px}.sv-rank div{display:grid;grid-template-columns:5.5em minmax(0,1fr) auto;gap:8px;align-items:center;font-size:12.5px}
.sv-rank u{text-decoration:none;display:block;height:10px;border-radius:3px}
.sv-rank em{font-style:normal;font-family:var(--f-mono);font-size:12px;color:var(--muted)}
.sv-hours{display:flex;align-items:flex-end;gap:2px;height:92px;border-bottom:1px solid var(--line)}
.sv-hours span{flex:1;background:var(--accent);opacity:.85;border-radius:2px 2px 0 0;min-height:1px}
.sv-hours span.now{background:#d9822b;opacity:1}.sv-hours span.fut{background:var(--line);opacity:.6}
.sv-hlab{display:flex;justify-content:space-between;font-size:10.5px;color:var(--muted);font-family:var(--f-mono);margin-top:3px}
.sv-goal{margin:4px 0 10px}.sv-goal p{margin:0 0 5px;font-size:12.5px}.sv-goal .sv-bar{height:9px}
.sv-news{display:grid;gap:7px;max-height:260px;overflow:auto;padding-right:2px}
.sv-news div{border-left:3px solid var(--line);padding:2px 0 2px 9px;font-size:12.5px;line-height:1.6}
.sv-news div.new{border-left-color:var(--accent)}
.sv-news b{display:block;font-size:13px}.sv-news small{color:var(--muted);font-size:11px;margin-right:6px}
.sv-news .k-open{border-left-color:#2f8a4a}.sv-news .k-dev{border-left-color:#7a5bb5}.sv-news .k-judge{border-left-color:#3a64b8}.sv-news .k-soldout{border-left-color:#c9573f}.sv-news .k-red{border-left-color:#c9573f}
.sv-days{display:flex;align-items:flex-end;gap:3px;height:54px;margin-top:6px}.sv-days span{flex:1;max-width:22px;background:var(--accent);opacity:.7;border-radius:2px 2px 0 0;min-height:1px}.sv-days span.neg{background:#c9573f}
.sv-note{font-size:11.5px;color:var(--muted);margin:6px 0 0;line-height:1.6}
.sv-trial{font-size:12.5px;margin:0 0 8px;padding:7px 9px;border-radius:7px;background:var(--paper);border:1px dashed var(--line2)}
`;
function mount(){const s=document.createElement('style');s.textContent=CSS;document.head.appendChild(s);
  const after=$('tayoriBtn')||document.querySelector('.clockbox');
  if(after){const b=document.createElement('button');b.id='shopBtn';b.type='button';b.className='tayoribtn shopbtn';b.innerHTML='駅ナカ商店<span class="dot" hidden></span>';after.after(b);b.onclick=()=>setOpen(true);}
  const mb=document.querySelector('.minibar-in');if(mb){const b=document.createElement('button');b.id='mshop';b.type='button';b.className='mspeed tayorimini';b.innerHTML='商店<span class="dot" hidden></span>';mb.appendChild(b);b.onclick=()=>setOpen(true);}
  const p=document.createElement('section');p.id='shopv';p.className='shopv';p.hidden=true;p.setAttribute('aria-label','駅ナカ商店');
  p.innerHTML=`<div class="sv-in">
    <div class="sv-hd"><h2>駅ナカ商店<small id="svCo">試作・自動で動きます</small></h2><span class="sv-sp"></span>
      <button type="button" class="sv-btn" id="svAuto" aria-pressed="true">自動で巡る</button>
      <button type="button" class="sv-btn" id="svClose">閉じる</button></div>
    <div class="sv-tabs" id="svTabs" role="tablist" aria-label="駅"></div>
    <div class="sv-stage"><canvas id="svCanvas" width="1000" height="440" aria-label="駅のコンコースと売店のようす"></canvas></div>
    <div class="sv-cap" id="svCap"></div>
    <div class="sv-grid">
      <div class="sv-card c4"><h3>今日の売上<small id="svDayLab"></small></h3><div class="sv-big" id="svSales">—</div><div class="sv-kv" id="svKv"></div><p class="sv-note" id="svNote1"></p></div>
      <div class="sv-card c8"><h3><span id="svShopsH">この駅の店</span><small>いまの時刻までの売れ行き</small></h3><div style="overflow-x:auto"><table class="sv-t" id="svShops"></table></div></div>
      <div class="sv-card c5"><h3>売れ筋<small id="svRankLab">この駅・ここまで</small></h3><div class="sv-rank" id="svRank"></div></div>
      <div class="sv-card c7"><h3>時間帯の売上<small id="svHrLab"></small></h3><div class="sv-hours" id="svHours"></div><div class="sv-hlab"><span>4時</span><span>8</span><span>12</span><span>16</span><span>20</span><span>24</span><span>26時</span></div></div>
      <div class="sv-card c12"><h3>経営のあゆみ<small id="svCash"></small></h3><div class="sv-grid" style="gap:14px">
        <div class="c5"><div class="sv-goal" id="svGoal"></div><div id="svTrial"></div><div style="font-size:12px;color:var(--muted)">運行日ごとの利益（最近30日）</div><div class="sv-days" id="svDays"></div>
          <p class="sv-note">利益＝売上−仕入れ−出店料（駅に払う売上の一部）−人件費などの定額。利益は積み立てに入り、貯まると次の店を出します。新商品は数日ためしに置いて、売れ行きで定番か終売かが決まります。今は全部自動です。電鉄の1日の収支には入れていません。</p></div>
        <div class="c7"><div class="sv-news" id="svNews"></div></div></div></div>
    </div></div>`;
  document.body.appendChild(p);
  $('svClose').onclick=()=>setOpen(false);$('svAuto').onclick=()=>{V.auto=!V.auto;$('svAuto').setAttribute('aria-pressed',V.auto);V.tourT=0;};
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&V.open)setOpen(false);});
  V.cv=$('svCanvas');V.cx=V.cv.getContext('2d');}
function badge(){const n=V.state?Math.max(0,V.state.news.length-V.seen):0;for(const id of ['shopBtn','mshop']){const b=$(id);if(!b)continue;const d=b.querySelector('.dot');d.hidden=!n;d.textContent=n>9?'9+':String(n);b.setAttribute('aria-label','駅ナカ商店'+(n?`（新しい知らせ${n}件）`:''));}}
function setOpen(o){V.open=o;$('shopv').hidden=!o;
  if(o){ensurePlan();V.lastT=null;V.people=[];V.pops=[];V.sparks=[];renderPanel(true);cancelAnimationFrame(V.raf);V.lastTs=0;V.raf=requestAnimationFrame(loop);}
  else{cancelAnimationFrame(V.raf);if(V.state){V.seen=V.state.news.length;persist();badge();}}}

/* ---------- その駅の店と並べ方 ---------- */
function shopsAt(s){if(!V.plan)return [];return V.cfg.shops.filter(x=>x.st===s&&V.plan.shops[x.id]).map(x=>V.plan.shops[x.id]);}
function stationsWithShops(){return STORDER.filter(s=>shopsAt(s).length);}
function layoutFor(s){const sh=shopsAt(s),K=V.cfg.kinds;const w=sh.map(x=>x.kind==='vend'?Math.min(6,x.n)*K.vend.w+8:K[x.kind].w);
  const gap=18,total=w.reduce((a,b)=>a+b,0)+gap*Math.max(0,sh.length-1),L=150,R=850,k=Math.min(1,(R-L)/total);
  let x=L+((R-L)-total*k)/2;const out=[];sh.forEach((sp,i)=>{out.push({sp,x,w:w[i]*k,cx:x+w[i]*k/2});x+=(w[i]+gap)*k;});return out;}

/* ---------- 毎フレーム ---------- */
function loop(ts){const dt=V.lastTs?Math.min(0.1,(ts-V.lastTs)/1000):0;V.lastTs=ts;
  if(!V.open)return;
  if(V.plan&&V.cfg){
    if(V.auto){V.tourT+=dt;const list=stationsWithShops();if(!list.includes(V.st))V.st=list[0]||'C';
      if(V.tourT>(V.cfg.view.tourSec||26)){V.tourT=0;const i=list.indexOf(V.st);V.st=list[(i+1)%list.length];V.people=[];V.pops=[];V.cur={};V.lastT=null;}}
    step(dt);}
  draw(ts/1000);
  V.panelT+=dt;if(V.panelT>0.4){V.panelT=0;renderPanel(false);}
  V.raf=requestAnimationFrame(loop);}

function step(dt){const Tn=gameT(),L=layoutFor(V.st);V.layout=L;
  const jump=V.lastT==null||Tn<V.lastT-0.01||Tn-V.lastT>30;
  for(const o of L){const sp=o.sp;let c=V.cur[sp.id];
    if(!c||jump){c=V.cur[sp.id]={i:SC.idxAt(sp,Tn),pend:0,pendN:0,lost:0,lastSpawn:0,last:null};continue;}
    while(c.i<sp.t.length&&sp.t[c.i]<=Tn){const k=c.i++;if(sp.lost[k]){c.lost++;c.lastLost=sp.pids[sp.pi[k]];}else{c.pend+=sp.yen[k];c.pendN++;c.last=sp.pids[sp.pi[k]];}}
    c.lastSpawn+=dt;
    if((c.pendN||c.lost)&&c.lastSpawn>=(V.cfg.view.minGapSec||0.55)&&V.people.length<40){c.lastSpawn=0;spawnBuyer(o,c.pend,c.pendN,c.last,c.lost,c.lastLost);c.pend=0;c.pendN=0;c.lost=0;}
    // 品出し・補充
    if(!jump)for(const rt of sp.restocks)if(V.lastT<rt&&rt<=Tn)spawnStaff(o);}
  if(!jump)ambient(dt,Tn);
  V.lastT=Tn;
  for(const p of V.people)movePerson(p,dt);V.people=V.people.filter(p=>!p.done);
  for(const q of V.pops){q.t+=dt;}V.pops=V.pops.filter(q=>q.t<1.8);
  for(const q of V.sparks){q.t+=dt;}V.sparks=V.sparks.filter(q=>q.t<1.2);}

const COATS=['#2f4858','#7a3b3b','#33658a','#55586a','#8a6d3b','#3d6b4f','#5b4a7a','#a2574a','#2b2b2b','#6b7b8c','#b08d57','#486c8f'];
function rnd(a,b){return a+Math.random()*(b-a);}
function exitX(){return Math.random()<0.5?rnd(40,110):rnd(890,960);}
function spawnBuyer(o,yen,n,pid,lost,lostPid){const fromL=Math.random()<0.5,x0=fromL?rnd(40,110):rnd(890,960),y0=fromL?rnd(360,410):rnd(330,350);
  const cat=SC.catalog(V.cfg),rain=['rain','snow'].includes(gameCond().wx);
  V.people.push({x:x0,y:y0,tx:o.cx+rnd(-o.w*0.32,o.w*0.32),ty:rnd(352,372),ex:exitX(),ey:rnd(360,420),st:0,wait:0,coat:COATS[Math.floor(Math.random()*COATS.length)],
    h:rnd(0.9,1.08),sp:rnd(70,95)*(V.speedMul||1),yen,n,pid,lost,lostPid,o,umb:rain&&Math.random()<0.6,bag:Math.random()<0.4,kid:Math.random()<0.06,cat});}
function spawnStaff(o){const fromL=o.cx<500,x0=fromL?30:970;V.people.push({x:x0,y:398,tx:o.cx,ty:362,ex:fromL?30:970,ey:398,st:0,wait:0,coat:'#1f5f8b',h:1,sp:55,staff:true,o,yen:0,n:0});}
function ambient(dt,Tn){const snap=g(()=>trafficSnapshot(Tn),null);const on=snap&&snap.stations[V.st]?snap.stations[V.st].onoffHour:0;
  const target=Math.min(16,Math.round(Math.sqrt(on)/3.2));V.walkAcc=(V.walkAcc||0)+dt*target*0.18;
  while(V.walkAcc>1){V.walkAcc-=1;const l2r=Math.random()<0.5;V.walkers.push({x:l2r?-10:1010,y:rnd(378,428),v:(l2r?1:-1)*rnd(80,120),coat:COATS[Math.floor(Math.random()*COATS.length)],h:rnd(0.9,1.05),umb:['rain','snow'].includes(gameCond().wx)&&Math.random()<0.6});}
  for(const w of V.walkers)w.x+=w.v*dt;V.walkers=V.walkers.filter(w=>w.x>-20&&w.x<1020).slice(-30);}
function movePerson(p,dt){const go=(tx,ty)=>{const dx=tx-p.x,dy=ty-p.y,d=Math.hypot(dx,dy);if(d<3)return true;const s=Math.min(d,p.sp*dt);p.x+=dx/d*s;p.y+=dy/d*s;p.dir=dx>=0?1:-1;p.walk=(p.walk||0)+s;return false;};
  if(p.st===0){if(go(p.tx,p.ty)){p.st=1;p.wait=0;
      if(p.staff){V.sparks.push({x:p.o.cx,y:260,t:0});V.pops.push({x:p.o.cx,y:150,t:0,txt:p.o.sp.kind==='vend'?'補充しました':'品出し',col:'#1f5f8b'});}
      else{const lane=V.pops.filter(q=>q.o===p.o&&q.t<0.9).length;if(p.n&&lane<3)V.pops.push({o:p.o,x:p.o.cx+(lane-1)*Math.min(70,p.o.w*0.3),y:132-lane*0,t:-lane*0.05,txt:'+'+yenS(p.yen)+(p.n>1?`（${p.n}人）`:''),sub:p.n===1&&p.pid?p.cat[p.pid].short:'',col:'#ffd76a'});
        if(p.lost&&lane<3)V.pops.push({o:p.o,x:p.o.cx,y:300,t:-0.15,txt:`売り切れ…${p.lost>1?'（'+p.lost+'人）':''}`,sub:p.lostPid?p.cat[p.lostPid].short:'',col:'#ff9a86'});}}}
  else if(p.st===1){p.wait+=dt;if(p.wait>(p.staff?1.6:0.7))p.st=2;}
  else if(go(p.ex,p.ey))p.done=true;}

/* ---------- 絵 ---------- */
function skyAt(t){const m=((t%1440)+1440)%1440;const K=[[0,'#0d1426','#1b2440'],[300,'#18223f','#3b3f63'],[330,'#e9926b','#6f6f9c'],[420,'#9fc8e8','#dfeef6'],[960,'#8fc0e6','#e8f1f4'],[1050,'#f0a06a','#7a7fb0'],[1110,'#30355e','#58507a'],[1170,'#0f1730','#1d2647'],[1440,'#0d1426','#1b2440']];
  let i=0;while(i<K.length-2&&m>=K[i+1][0])i++;const a=K[i],b=K[i+1],k=(m-a[0])/(b[0]-a[0]);
  const mix=(c1,c2)=>{const p=s=>[1,3,5].map(j=>parseInt(s.slice(j,j+2),16));const x=p(c1),y=p(c2);return 'rgb('+x.map((v,j)=>Math.round(v+(y[j]-v)*k)).join(',')+')';};
  return [mix(a[1],b[1]),mix(a[2],b[2])];}
function isNight(t){const m=((t%1440)+1440)%1440;return m<330||m>1110;}
function rr(c,x,y,w,h,r){c.beginPath();c.roundRect(x,y,w,h,r);}
function draw(time){const c=V.cx;if(!c)return;const W=1000,H=440,Tn=gameT(),cond=gameCond();c.save();c.clearRect(0,0,W,H);
  if(!V.cfg||!V.plan){c.fillStyle='#2a2f33';c.fillRect(0,0,W,H);c.fillStyle='#fff';c.font='16px sans-serif';c.textAlign='center';c.fillText(V.err?'data/shop.json を読み込めませんでした（'+V.err+'）':'準備しています…',W/2,H/2);c.restore();return;}
  const night=isNight(Tn),[s1,s2]=skyAt(Tn);
  // 天井と窓
  c.fillStyle='#3a3f44';c.fillRect(0,0,W,26);
  for(let i=0;i<4;i++){const x=40+i*240,y=34,w=200,h=86;const gr=c.createLinearGradient(0,y,0,y+h);gr.addColorStop(0,s1);gr.addColorStop(1,s2);c.fillStyle=gr;c.fillRect(x,y,w,h);
    const sc=(V.cfg.view.scenery||{})[V.st]||'city';c.save();c.beginPath();c.rect(x,y,w,h);c.clip();
    if(sc==='city'||sc==='town'){const n=sc==='city'?6:9;c.fillStyle=night?'rgba(255,240,200,.5)':'rgba(40,60,70,.35)';for(let b=0;b<n;b++){const bw=w/n,bh=(sc==='city'?18:8)+((b*37+i*13)%(sc==='city'?34:18));c.fillRect(x+b*bw+3,y+h-bh,bw-6,bh);}}   // 遠くの建物
    else if(sc==='sea'){c.fillStyle=night?'#162a44':'#4f8fbf';c.fillRect(x,y+h*0.62,w,h);c.fillStyle='rgba(255,255,255,.35)';for(let k=0;k<5;k++)c.fillRect(x+((k*47+time*10+i*30)%w),y+h*0.7+k*5,18,1.5);c.fillStyle=night?'rgba(255,230,160,.7)':'#e9e4da';c.fillRect(x+((i*70+40)%w),y+h*0.5,30,10);c.fillRect(x+((i*70+48)%w),y+h*0.43,10,7);}   // 海と船
    else if(sc==='mountain'){c.fillStyle=night?'#1d2b2a':'#5f8a5a';c.beginPath();c.moveTo(x,y+h);for(let k=0;k<=6;k++)c.lineTo(x+k*w/6,y+h*(0.35+0.25*((k*7+i*3)%3)/2));c.lineTo(x+w,y+h);c.fill();c.fillStyle=night?'#152020':'#3f6b45';c.beginPath();c.moveTo(x,y+h);for(let k=0;k<=8;k++)c.lineTo(x+k*w/8,y+h*(0.62+0.12*((k*5+i)%3)/2));c.lineTo(x+w,y+h);c.fill();}
    else{c.fillStyle=night?'#1e2a1c':'#8fb062';c.fillRect(x,y+h*0.7,w,h);c.fillStyle=night?'#16201a':'#6f9450';for(let k=0;k<4;k++)c.fillRect(x,y+h*0.74+k*6,w,1.5);c.fillStyle=night?'rgba(255,240,200,.5)':'rgba(60,60,50,.4)';c.fillRect(x+((i*60+30)%w),y+h*0.58,22,12);}   // 田畑と家
    c.restore();
    if(cond.wx==='rain'){c.strokeStyle='rgba(220,235,255,.45)';c.lineWidth=1;for(let r=0;r<14;r++){const rx=x+((r*53+time*160)%w),ry=y+((r*29+time*260)%h);c.beginPath();c.moveTo(rx,ry);c.lineTo(rx-3,ry+9);c.stroke();}}
    if(cond.wx==='snow'){c.fillStyle='rgba(255,255,255,.85)';for(let r=0;r<16;r++){const rx=x+((r*41+Math.sin(time+r)*8+time*12)%w+w)%w,ry=y+((r*23+time*28)%h);c.beginPath();c.arc(rx,ry,1.6,0,7);c.fill();}}
    c.strokeStyle='#5b6167';c.lineWidth=4;c.strokeRect(x,y,w,h);c.beginPath();c.moveTo(x+w/2,y);c.lineTo(x+w/2,y+h);c.stroke();}
  // 壁
  const wall=c.createLinearGradient(0,120,0,330);wall.addColorStop(0,night?'#b9b3a6':'#ddd6c8');wall.addColorStop(1,night?'#a49e92':'#cfc7b7');c.fillStyle=wall;c.fillRect(0,120,W,212);
  c.strokeStyle='rgba(0,0,0,.06)';c.lineWidth=1;for(let x=0;x<W;x+=40){c.beginPath();c.moveTo(x,120);c.lineTo(x,332);c.stroke();}
  c.fillStyle='#4b5157';c.fillRect(0,118,W,6);
  // 床
  const fl=c.createLinearGradient(0,332,0,H);fl.addColorStop(0,'#9a9890');fl.addColorStop(1,'#bdbab0');c.fillStyle=fl;c.fillRect(0,332,W,H-332);
  c.strokeStyle='rgba(0,0,0,.08)';for(let y=346;y<H;y+=(y-320)*0.35+8){c.beginPath();c.moveTo(0,y);c.lineTo(W,y);c.stroke();}
  for(let x=-400;x<1400;x+=70){c.beginPath();c.moveTo(500+(x-500)*0.5,332);c.lineTo(x,H);c.stroke();}
  c.fillStyle='#e2c84a';c.fillRect(0,402,W,5);   // 点字ブロックの帯
  // 駅名の吊り看板
  c.fillStyle='#1e3a52';rr(c,410,6,180,38,4);c.fill();c.strokeStyle='#d8dde2';c.lineWidth=1.5;c.stroke();
  c.fillStyle='#fff';c.font='700 19px "Zen Kaku Gothic New",sans-serif';c.textAlign='center';c.fillText(stName(V.st)+' 駅',500,33);
  // 改札（左）と階段（右）
  for(let i=0;i<3;i++){const x=24+i*36;c.fillStyle='#d7dbe0';rr(c,x,300,26,58,3);c.fill();c.fillStyle='#4a7fb5';c.fillRect(x+4,306,18,6);c.fillStyle=Math.sin(time*3+i)>0?'#5fd38a':'#3a8a5a';c.fillRect(x+9,318,8,4);}
  c.fillStyle='#294b6b';rr(c,18,262,118,24,3);c.fill();c.fillStyle='#fff';c.font='700 13px sans-serif';c.fillText('改札口',77,279);
  c.fillStyle='#8c8a84';for(let i=0;i<7;i++){c.fillRect(880+i*0,332-i*14,120,14);}c.fillStyle='#77756f';for(let i=0;i<7;i++)c.fillRect(880,330-i*14,120,2);
  c.fillStyle='#294b6b';rr(c,878,236,118,24,3);c.fill();c.fillStyle='#fff';c.fillText('のりば ↑',937,253);
  // 店
  const L=V.layout||layoutFor(V.st);for(const o of L)drawShop(c,o,Tn,night,time);
  // 人（奥から順に）
  const all=[...V.walkers.map(w=>({...w,walker:true})),...V.people].sort((a,b)=>a.y-b.y);for(const p of all)drawPerson(c,p,time);
  // 吹き出し
  for(const q of V.pops){if(q.t<0)continue;const a=1-Math.max(0,(q.t-1.1)/0.7),y=q.y-q.t*22;c.globalAlpha=Math.max(0,a);c.font='700 15px "JetBrains Mono",monospace';c.textAlign='center';
    const tw=c.measureText(q.txt).width+14;c.font='700 11.5px sans-serif';const sw=q.sub?c.measureText(q.sub).width+12:0;c.fillStyle='rgba(18,22,26,.82)';rr(c,q.x-Math.max(tw,sw)/2,y-17,Math.max(tw,sw),q.sub?38:24,6);c.fill();c.font='700 15px "JetBrains Mono",monospace';c.lineWidth=4;c.strokeStyle='rgba(20,24,28,.85)';c.fillStyle=q.col;c.fillText(q.txt,q.x,y);
    if(q.sub){c.font='700 11.5px sans-serif';c.fillStyle='#fff';c.fillText(q.sub,q.x,y+15);}c.globalAlpha=1;}
  for(const s of V.sparks){const a=1-s.t/1.2;c.strokeStyle=`rgba(255,240,170,${a})`;c.lineWidth=2;for(let i=0;i<8;i++){const an=i*0.785+s.t,r1=20+s.t*40,r2=r1+10;c.beginPath();c.moveTo(s.x+Math.cos(an)*r1,s.y+Math.sin(an)*r1*0.6);c.lineTo(s.x+Math.cos(an)*r2,s.y+Math.sin(an)*r2*0.6);c.stroke();}}
  if(night){c.fillStyle='rgba(10,20,50,.12)';c.fillRect(0,0,W,H);}
  // 時計
  c.fillStyle='rgba(15,20,24,.78)';rr(c,W-128,34,116,40,6);c.fill();c.fillStyle='#ffb347';c.font='700 24px "DotGothic16",monospace';c.textAlign='center';c.fillText(fmtT(Tn),W-70,63);
  c.restore();}

function shutter(c,o,txt){c.fillStyle='#9aa1a8';c.fillRect(o.x,150,o.w,182);c.strokeStyle='rgba(0,0,0,.18)';for(let y=154;y<332;y+=7){c.beginPath();c.moveTo(o.x,y);c.lineTo(o.x+o.w,y);c.stroke();}
  c.fillStyle='#fff';rr(c,o.cx-38,226,76,22,3);c.fill();c.fillStyle='#333';c.font='700 12px sans-serif';c.textAlign='center';c.fillText(txt,o.cx,241);}
function plaque(c,o,txt){c.font='700 11px sans-serif';const w=Math.min(o.w+10,c.measureText(txt).width+14);c.fillStyle='rgba(20,30,40,.82)';rr(c,o.cx-w/2,338,w,17,3);c.fill();c.fillStyle='#fff';c.textAlign='center';c.save();c.beginPath();c.rect(o.cx-w/2,338,w,17);c.clip();c.fillText(txt,o.cx,350);c.restore();}
function drawShop(c,o,Tn,night,time){const sp=o.sp,cat=SC.catalog(V.cfg),stock=SC.stockAt(sp,Tn),isOpen=Tn>=sp.open[0]&&Tn<sp.open[1];
  const P=sp.pids.map(id=>cat[id]);const frac=i=>sp.par[i]?stock[i]/sp.par[i]:0;
  if(sp.kind==='vend'){const n=Math.min(6,sp.n),mw=(o.w-8)/n;
    for(let m=0;m<n;m++){const x=o.x+4+m*mw,w=mw-6,body=['#c8333a','#2a6fb0','#e9e6df','#2f8a6e','#c8333a','#2a6fb0'][m];
      c.fillStyle='rgba(0,0,0,.2)';c.fillRect(x+3,334,w,6);c.fillStyle=body;rr(c,x,170,w,164,4);c.fill();
      c.fillStyle=night?'#fdf6d8':'#eef3f5';c.fillRect(x+5,180,w-10,74);
      const cols=Math.max(1,Math.min(4,Math.floor((w-10)/11)));const ids=[];for(let r=0;r<3;r++)for(let k=0;k<cols;k++)ids.push((m*cols*3+r*cols+k)%P.length);
      ids.forEach((pi,j)=>{const r=Math.floor(j/cols),k=j%cols,cx=x+8+k*((w-14)/cols),cy=184+r*23,cw=(w-14)/cols-3;
        c.fillStyle=P[pi].color;rr(c,cx,cy,cw,17,2);c.fill();c.fillStyle='rgba(255,255,255,.35)';c.fillRect(cx+1,cy+2,2,12);
        const so=stock[pi]<=0&&isOpen;c.fillStyle=so?'#e2332b':(P[pi].temp==='hot'?'#d9542b':'#2e7fd1');c.fillRect(cx,cy+18,cw,3);
        if(so){c.fillStyle='#e2332b';c.font='700 7.5px sans-serif';c.textAlign='center';c.fillText('売切',cx+cw/2,cy+11);}});
      c.fillStyle='#1d1d1d';c.fillRect(x+6,266,w-12,10);c.fillStyle='#ffd34a';c.font='9px monospace';c.textAlign='center';c.fillText('¥',x+w/2,274);
      c.fillStyle='#222';c.fillRect(x+8,292,w-16,20);
      if(night){c.fillStyle='rgba(255,250,215,.18)';c.beginPath();c.ellipse(x+w/2,348,w*0.8,10,0,0,7);c.fill();}}
    plaque(c,o,'自販機 '+sp.n+'台');return;}
  if(!isOpen){shutter(c,o,Tn<sp.open[0]?'準備中':'本日終了');plaque(c,o,sp.name.replace(/^.*? /,''));return;}
  const K={kiosk:['#0b6b64','みなとスタンド'],souv:['#2b3d6b','おみやげ'],bento:['#a8322c','駅 弁'],cafe:['#6b4a2e','COFFEE']}[sp.kind];
  // 庇
  c.fillStyle=K[0];c.fillRect(o.x-4,146,o.w+8,26);c.fillStyle='#fff';c.font='700 14px "Zen Kaku Gothic New",sans-serif';c.textAlign='center';c.fillText(K[1],o.cx,165);
  for(let x=o.x-4;x<o.x+o.w+4;x+=16){c.fillStyle=K[0];c.beginPath();c.arc(x+8,172,8,0,Math.PI);c.fill();}
  // 奥の棚
  c.fillStyle=night?'#efe7d0':'#f6f1e3';c.fillRect(o.x,180,o.w,92);
  const shelves=3,perRow=Math.ceil(P.length/shelves);
  for(let s=0;s<shelves;s++){const y=184+s*30;c.fillStyle='#8a7a5e';c.fillRect(o.x+2,y+24,o.w-4,3);}
  P.forEach((p,i)=>{const s=Math.floor(i/perRow),k=i%perRow,cw=(o.w-8)/perRow,x=o.x+4+k*cw,y=184+s*30;
    const slots=sp.kind==='souv'||sp.kind==='bento'?4:5,n=Math.ceil(frac(i)*slots-1e-6);
    for(let j=0;j<slots;j++){const bx=x+2+j*((cw-6)/slots),bw=Math.max(2,(cw-6)/slots-1.5),bh=sp.kind==='souv'?14:sp.kind==='bento'?10:17;
      if(j<n){c.fillStyle=p.color;rr(c,bx,y+24-bh,bw,bh,1.5);c.fill();c.fillStyle='rgba(255,255,255,.25)';c.fillRect(bx,y+24-bh,bw,2);}
      else{c.strokeStyle='rgba(0,0,0,.12)';c.strokeRect(bx+0.5,y+24-bh+0.5,bw-1,bh-1);}}
    if(stock[i]<=0){c.fillStyle='#d8382e';rr(c,x+cw/2-14,y+6,28,13,2);c.fill();c.fillStyle='#fff';c.font='700 9px sans-serif';c.textAlign='center';c.fillText('売切',x+cw/2,y+16);}
    else if(frac(i)<(V.cfg.view.lowStock||0.2)){c.fillStyle='#e0a21b';c.font='700 8.5px sans-serif';c.textAlign='center';c.fillText('残りわずか',x+cw/2,y+4);}});
  // 店員
  const sx=o.cx+Math.sin(time*0.7+o.x)*o.w*0.25;c.fillStyle='#f0c9a0';c.beginPath();c.arc(sx,262,8,0,7);c.fill();c.fillStyle=K[0];rr(c,sx-10,270,20,12,4);c.fill();c.fillStyle='#2b2016';c.beginPath();c.arc(sx,258,8,Math.PI,0);c.fill();
  // 手前のカウンター
  c.fillStyle=K[0];rr(c,o.x,276,o.w,58,3);c.fill();c.fillStyle='rgba(255,255,255,.12)';c.fillRect(o.x,276,o.w,6);
  if(sp.kind==='souv'){c.fillStyle='#fff';c.font='700 12px sans-serif';c.textAlign='center';c.fillText('みやげ',o.cx,312);}
  else if(sp.kind==='bento'){c.fillStyle='#f6e7c8';c.fillRect(o.x+8,284,o.w-16,34);P.forEach((p,i)=>{const bw=(o.w-24)/P.length;if(stock[i]>0){c.fillStyle=p.color;c.fillRect(o.x+12+i*bw,292,bw-6,18);c.fillStyle='#fff';c.fillRect(o.x+12+i*bw,292,bw-6,3);}});}
  else if(sp.kind==='cafe'){c.fillStyle='#d9d4c8';c.fillRect(o.x+10,248,26,28);c.fillStyle='#333';c.fillRect(o.x+14,252,18,8);
    c.fillStyle='rgba(255,255,255,.5)';for(let i=0;i<3;i++){c.beginPath();c.arc(o.x+23+Math.sin(time*2+i)*3,240-i*7-((time*12)%7),2.5,0,7);c.fill();}}
  else{c.fillStyle='#f0f0e8';c.fillRect(o.x+10,286,32,20);c.fillStyle='#333';c.fillRect(o.x+14,290,24,4);c.fillStyle='#555';c.fillRect(o.x+14,297,16,2);}
  plaque(c,o,sp.name.replace(/^みなとスタンド |^駅弁 /,''));}

function drawPerson(c,p,time){const s=(0.55+(p.y-330)/140*0.55)*(p.h||1)*(p.kid?0.7:1),x=p.x,y=p.y,step=Math.sin((p.walk||p.x)*0.12)*3*s;
  c.save();c.translate(x,y);c.scale(s,s);
  c.fillStyle='rgba(0,0,0,.18)';c.beginPath();c.ellipse(0,0,13,4,0,0,7);c.fill();
  c.strokeStyle='#2a2a30';c.lineWidth=5;c.lineCap='round';c.beginPath();c.moveTo(-3,-26);c.lineTo(-3+step,-2);c.moveTo(3,-26);c.lineTo(3-step,-2);c.stroke();
  c.fillStyle=p.coat;rr(c,-10,-62,20,38,6);c.fill();
  if(p.staff){c.fillStyle='#fff';c.fillRect(-10,-48,20,3);c.fillStyle='#c9a35c';rr(c,14,-30,26,22,2);c.fill();c.fillStyle='#8a7048';c.fillRect(14,-22,26,2);c.strokeStyle='#555';c.lineWidth=2;c.beginPath();c.moveTo(14,-8);c.lineTo(12,-34);c.stroke();c.fillStyle='#333';c.beginPath();c.arc(18,-4,3,0,7);c.arc(36,-4,3,0,7);c.fill();}
  if(p.bag){c.fillStyle='#d9c7a0';rr(c,8,-40,9,12,2);c.fill();}
  if(p.umb){c.strokeStyle='#3d4e66';c.lineWidth=2.5;c.beginPath();c.moveTo(-12,-44);c.lineTo(-14,-6);c.stroke();}
  c.fillStyle='#f0c9a0';c.beginPath();c.arc(0,-72,9,0,7);c.fill();c.fillStyle='#2b2016';c.beginPath();c.arc(0,-75,9,Math.PI*1.05,Math.PI*1.95);c.fill();
  if(p.st===1&&!p.staff&&!p.walker){c.fillStyle='#ffd76a';c.beginPath();c.arc(12*(p.dir||1),-50,3,0,7);c.fill();}
  c.restore();}

/* ---------- 表 ---------- */
function renderPanel(full){if(!V.open)return;
  const tabs=$('svTabs');
  if(!V.cfg||!V.plan){$('svCap').textContent=V.err?'設定（data/shop.json）を読み込めませんでした。パソコンで index.html を直接開いた場合は読み込めません（GitHub Pages では動きます）。':'準備しています…';return;}
  const Tn=gameT(),cat=SC.catalog(V.cfg),day=gameDay();
  // 駅のタブ
  const list=stationsWithShops();
  if(full||tabs.dataset.k!==list.join()+V.st){tabs.dataset.k=list.join()+V.st;tabs.innerHTML=STORDER.map(s=>`<button type="button" class="sv-tab" role="tab" data-s="${s}" aria-current="${s===V.st}" ${list.includes(s)?'':'disabled'}>${stName(s)}<b data-y="${s}"></b></button>`).join('');
    tabs.querySelectorAll('button').forEach(b=>b.onclick=()=>{V.st=b.dataset.s;V.auto=false;$('svAuto').setAttribute('aria-pressed','false');V.people=[];V.pops=[];V.cur={};V.lastT=null;renderPanel(true);});}
  let all={yen:0,cust:0,lost:0,cogs:0};const bySt={};
  for(const id in V.plan.shops){const sp=V.plan.shops[id],f=SC.soFar(sp,Tn);all.yen+=f.yen;all.cust+=f.cust;all.lost+=f.lost;bySt[sp.st]=(bySt[sp.st]||0)+f.yen;
    let cg=0;for(let i=0;i<f.k;i++)if(!sp.lost[i])cg+=sp.q[i]*cat[sp.pids[sp.pi[i]]].cost;all.cogs+=cg;}
  tabs.querySelectorAll('b[data-y]').forEach(b=>{const v=bySt[b.dataset.y];b.textContent=!v?'':v<10000?yenS(v):manS(v);});
  $('svCo').textContent=(V.cfg.company||'')+'（試作・自動で動きます）';
  $('svDayLab').textContent=`運行日 ${day}・${fmtT(Tn)}まで`;
  $('svSales').textContent=yenS(all.yen);
  $('svKv').innerHTML=`<div><span>粗利（売上−仕入れ）</span><b>${manS(all.yen-all.cogs)}</b></div><div><span>お客さん</span><b>${all.cust.toLocaleString()}人</b></div><div><span>売り切れで買えず</span><b>${all.lost.toLocaleString()}人</b></div>`;
  const shops=shopsAt(V.st);const c=gameCond();
  $('svNote1').textContent=`全${Object.keys(V.plan.shops).length}店の合計。客の数は、この日のダイヤで駅に乗り降りする人（目的別・1時間ごと）から決まります。`;
  // 店の表
  $('svShopsH').textContent=stName(V.st)+'駅の店';
  $('svShops').innerHTML=`<thead><tr><th>店</th><th>売上</th><th>客</th><th>売切で逃した</th><th>棚の残り</th><th>品出し</th></tr></thead><tbody>`+shops.map(sp=>{const f=SC.soFar(sp,Tn),stk=SC.stockAt(sp,Tn);let a=0,b=0;for(let i=0;i<sp.np;i++){a+=Math.min(stk[i],sp.par[i]);b+=sp.par[i];}const r=b?a/b:0;
      const open=Tn>=sp.open[0]&&Tn<sp.open[1],nx=sp.restocks.find(t=>t>Tn);
      return `<tr class="${open?'':'shut'}"><td>${sp.name}${open?'':'（営業時間外）'}</td><td>${yenS(f.yen)}</td><td>${f.cust.toLocaleString()}</td><td>${f.lost?f.lost.toLocaleString()+'人':'—'}</td><td><div class="sv-bar ${r<0.25?'low':''}"><i style="width:${Math.round(r*100)}%"></i></div></td><td>${nx?'次 '+fmtT(nx):'—'}</td></tr>`;}).join('')+'</tbody>';
  // 売れ筋
  const tally={};for(const sp of shops){const k=SC.idxAt(sp,Tn);for(let i=0;i<k;i++)if(!sp.lost[i]){const id=sp.pids[sp.pi[i]];tally[id]=(tally[id]||0)+sp.q[i];}}
  const top=Object.entries(tally).sort((a,b)=>b[1]-a[1]).slice(0,7),mx=top.length?top[0][1]:1;
  $('svRank').innerHTML=top.length?top.map(([id,n])=>`<div><span>${cat[id].short}</span><u style="width:${Math.max(3,n/mx*100)}%;background:${cat[id].color}"></u><em>${n.toLocaleString()}個</em></div>`).join(''):'<p class="sv-note">まだ何も売れていません。</p>';
  $('svRankLab').textContent=stName(V.st)+'駅・'+fmtT(Tn)+'まで';
  // 時間帯
  const hr=new Float64Array(30);for(const sp of shops)for(let h=0;h<30;h++)hr[h]+=sp.hourly.yen[h];const hNow=Math.floor(Tn/60);
  const hm=Math.max(1,...Array.from(hr).slice(4,Math.max(5,Math.min(26,hNow))));
  // 今の時間帯は「いままで」の分だけ、先の時間は空けておく
  const cur=new Float64Array(30);for(const sp of shops){const k=SC.idxAt(sp,Tn);for(let i=0;i<k;i++){const h=Math.floor(sp.t[i]/60);if(h===hNow)cur[h]+=sp.yen[i];}}
  $('svHours').innerHTML=Array.from({length:22},(_,j)=>{const h=j+4,v=h<hNow?hr[h]:h===hNow?cur[h]:0;return `<span class="${h===hNow?'now':''}" style="height:${Math.round(v/hm*100)}%" title="${h}時台 ${yenS(v)}"></span>`;}).join('');
  $('svHrLab').textContent=`${stName(V.st)}駅・${({wd:'平日',sat:'土曜',hol:'日曜・祝日'})[c.day]||''} ${({sun:'晴れ',cld:'くもり',rain:'雨',snow:'大雪'})[c.wx]||''}`;
  // 経営のあゆみ
  const S=V.state;$('svCash').textContent='積み立て '+manS(S.cash);
  const np=SC.nextPlan(V.cfg,S);
  $('svGoal').innerHTML=np?`<p>次の出店：<b>${np.shopDef.name}</b>（${stName(np.shopDef.st)}駅）</p><div class="sv-bar"><i style="width:${Math.min(100,Math.max(0,S.cash/np.cost*100)).toFixed(1)}%"></i></div><p class="sv-note">積み立て ${manS(S.cash)} ／ 必要 ${manS(np.cost)}</p>`:'<p>計画していた店は、すべて出しました。</p>';
  const tr=(V.cfg.dev.list||[]).find(d=>S.prod[d.id]&&S.prod[d.id].status==='trial');
  $('svTrial').innerHTML=tr?`<div class="sv-trial">試験販売中：<b>${tr.name}</b>（${V.cfg.shops.find(x=>x.id===tr.shop).name}）　${S.prod[tr.id].ratios.length}／${V.cfg.dev.trialDays}日目</div>`:'';
  const h30=S.hist.slice(-30),pm=Math.max(1,...h30.map(x=>Math.abs(x.profit)));
  $('svDays').innerHTML=h30.length?h30.map(x=>`<span class="${x.profit<0?'neg':''}" style="height:${Math.max(2,Math.abs(x.profit)/pm*100)}%" title="運行日${x.day}：売上 ${manS(x.sales)}・利益 ${manS(x.profit)}"></span>`).join(''):'<span style="opacity:0"></span>';
  if(full||$('svNews').dataset.n!==String(S.news.length)){$('svNews').dataset.n=String(S.news.length);
    const items=S.news.slice().reverse().slice(0,20);
    $('svNews').innerHTML=items.length?items.map((n,i)=>`<div class="k-${n.kind} ${S.news.length-i>V.seen?'new':''}"><b>${n.title}</b><small>運行日${n.day}${n.st?'・'+stName(n.st)+'駅':''}</small>${n.text}</div>`).join(''):'<p class="sv-note">まだ知らせはありません。運行日が終わる（26:00を過ぎる）と、その日の売上を締めて、ここに出店や新商品の知らせが届きます。</p>';}
  // 映像の下の説明
  const shown=shops.reduce((a,sp)=>a+SC.soFar(sp,Tn).cust,0);
  $('svCap').innerHTML=`<span><b>${fmtT(Tn)}</b> ${stName(V.st)}駅のコンコース</span><span>${V.auto?'自動で駅を巡っています（駅のボタンで止まります）':'この駅を映しています'}</span><span>客が多いときは、1人の絵に数人分の買い物をまとめて「○人」と出します</span>`;}

/* ---------- 起動 ---------- */
mount();load();setInterval(()=>{watchDay();},1000);
window.minatoShop={get state(){return V.state;},get plan(){return V.plan;},open:()=>setOpen(true),close:()=>setOpen(false),
  closeToday(){if(!V.plan)return null;const r=SC.closeDay(V.cfg,V.state,V.plan);V.state=r.state;persist();badge();V.plan=null;ensurePlan();if(V.open)renderPanel(true);return r;},   // 開発用：今日の計画で1日分を締める
  reset(){try{localStorage.removeItem(KEY);localStorage.removeItem(KEY+'-seen');}catch(e){}V.state=SC.create(V.cfg);V.state.closed=gameDay()-1;V.seen=0;persist();V.plan=null;ensurePlan();badge();if(V.open)renderPanel(true);}};
})();
