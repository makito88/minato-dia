/* =====================================================================
   港駅の売店の絵の段取り（港駅の売店をつくる回の3回目・2026-11-10）
   ・計算の結果（KioskCore.simulate の res.ev）から、店の中を歩く人の「時刻 → 場所」を作るだけ。
     描くために出来事を足さない。人の場所は、ゲームの時刻 t だけで決まる（開き直しても・あとから見ても同じ）。
   ・店の見取り図（斜め上から見た店。キャンバスは 1000×600。下の帯は改札口とコンコース）もここに持つ。
   ・DOM もゲーム本体の変数も使わない（node のテストで確かめられる）。描くのは js/minato-store-view.js。
   ===================================================================== */
(function(root){
'use strict';
/* ---------- 見取り図（キャンバスの座標） ----------
   棚は [x, y, 幅, 奥行き, 前の面の高さ]。お客さんの立つ点は stand()。 */
const MAP={
  // 2026-11-10 ユーザーの頼みで見直し：コンコースを広く（店の床の下の端 y=456、コンコース 456〜600）。冷蔵ケースと低い棚を、品の数に合う長さに縮めた
  // （1 は約 0.9cm。冷蔵ケース 約3.2m＝飲み物の扉2枚＋お弁当の平台、低い棚 約1.6m の両面、乾物・おやつの棚 約1.1m の両面）。イートインに座れる席4（簡易的）
  floor:[30,70,940,386],                     // 店の床（下の端 y=456 が改札口側の壁）
  wallY:456,
  door:{inX:[100,200],outX:[700,790]},       // 入口（左下）と出口（右下）
  fx:{fridge:[40,72,350,26,34],hook:[34,150,22,140,0],rack:[34,310,22,90,0],umbrella:[70,410,26,26,10],
      shelf:[150,200,170,42,22],dry:[362,200,120,42,22],omiyage:[420,92,160,50,18],tobacco:[560,206,200,16,30],warmer:[770,206,40,16,24],
      counter:[560,292,200,32,26],hot:[680,288,72,30,22],self:[798,300,48,30,30],regfront:[360,412,150,20,12],
      eat:[930,110,34,250,0],range:[612,86,60,42,20],trash:[930,404,30,24,12],tables:[[722,112,40,30],[812,112,40,30]]},
  ent:[150,440],exit:[745,440],
  reg:{f:[600,372],s:[822,362]},              // 有人レジ・セルフレジでお客さんが立つ点
  clerk:{f:[600,260],hot:[716,260],self:[822,336]},
  q:{f:{x:600,y:382,dx:-30,dy:0},s:{x:822,y:384,dx:0,dy:20}},   // 列の並び方（先頭のうしろから）
  rangeAt:[642,150],
  seat:i=>i<6?[905,128+i*40]:[[708,130],[776,130],[798,130],[866,130]][Math.min(3,i-6)],   // 0〜5 立ち席（壁ぞい）・6〜9 座る席（小さなテーブル2つ）
  corr:[110,340,540,885]                      // 縦の通路（棚を突っ切らないように、ここを通る）
};
/* 歩く速さ（A1・2026-11-11）：港駅の店の設定の walk.anim（m/秒・絵の1 ≒ 0.9cm）から「座標/分」に。なければ下の値（同じ数字） */
const AN0={unitM:0.009,mps:{shf:1.3,salM:1.2,salF:1.1,stu:1.2,jk:1.0,sen:0.75,tou:0.9,hou:0.95,cru:0.85,fam:0.8,cpl:1.0,frd:1.0},mpsDefault:1.0,ease:0.5,hurry:0.85,pack:0.08,shuffle:0.25,
  local:{mps:1.1,cartMul:0.85,unloadPerBox:0.25,sign:0.7,cart:{shiomi:true}}};
const animOf=cfg=>(cfg&&cfg.walk&&cfg.walk.anim)||AN0;
const speedOf=(AN,ps)=>((AN.mps&&AN.mps[ps])||AN.mpsDefault||1)*60/(AN.unitM||0.009);
const STOP_ORDER=['umbrella','rack','hook','fridge','shelf','dry','omiyage','regfront'];
/* その品が置いてある場所と、その前に立つ点 */
function standOf(zk,i,Z){const z=Z[zk];if(!z)return null;const c=i%z.cols,r=Math.floor(i/z.cols);
  switch(zk){
    case 'fridge':return [60+c*(320/Math.max(1,z.cols-1)),146];
    case 'shelf':return [160+c*(150/Math.max(1,z.cols-1)),c%2?182:262];
    case 'dry':return [372+c*(100/Math.max(1,z.cols-1)),c%2?182:262];
    case 'hook':return [78,164+c*(112/Math.max(1,z.cols-1))];
    case 'rack':return [78,318+r*(74/Math.max(1,z.rows-1))];
    case 'umbrella':return [112,428];
    case 'omiyage':return [432+c*(136/Math.max(1,z.cols-1)),164];
    case 'regfront':return [372+c*(126/Math.max(1,z.cols-1)),400];
    default:return null;}}   // たばこ・ホット・ホット飲料はレジで受け取る
function placeIndex(cfg,layout){const out={};for(const zk in layout){(layout[zk]||[]).forEach((pid,i)=>{if(pid&&!out[pid])out[pid]=[zk,i];});}return out;}
/* 道のり：同じ横の通りなら真っすぐ、ちがえば近い縦の通路を通る */
function route(a,b){if(Math.abs(a[1]-b[1])<6)return [b];let best=MAP.corr[0],bd=Infinity;for(const c of MAP.corr){const d=Math.abs(a[0]-c)+Math.abs(b[0]-c);if(d<bd){bd=d;best=c;}}
  return [[best,a[1]],[best,b[1]],b];}
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
/* 道のりの点の列に時刻を割り当てる（A1 で見直し）：歩くのはいつも「その人の速さ」で、のこりは「立ち止まる点」で見る時間。
   歩くだけで「店にいた時間」の hurry 割をこえる人は、立ち止まらずに、その時間いっぱいで歩く（早足）。
   長く見る点では、shuffle 分ごとに棚に沿って半歩ずれる（1か所に固まらない。ずれ方はその人の番号で決まる） */
function legs(pts,t0,t1,stops,speed,AN,seed){// pts:[[x,y,stop?]]（最初が出発点）。返すもの：[{t,x,y}]（時刻の順）
  AN=AN||AN0;let D=0;for(let i=1;i<pts.length;i++)D+=dist(pts[i-1],pts[i]);
  const span=Math.max(0.01,t1-t0);let walk=D/speed,look=0;
  if(stops>0){if(walk>span*(AN.hurry||0.85))walk=span;else look=(span-walk)/stops;}else if(walk>span)walk=span;
  const out=[{t:t0,x:pts[0][0],y:pts[0][1]}];let t=t0;
  for(let i=1;i<pts.length;i++){const p=pts[i];t+=D>0?walk*dist(pts[i-1],p)/D:0;out.push({t,x:p[0],y:p[1]});
    if(p[2]&&look>0){const sh=AN.shuffle||0.25,n=look>sh*1.6?Math.min(40,Math.floor(look/sh)):0;
      if(!n){t+=look;out.push({t,x:p[0],y:p[1]});continue;}
      const vert=p[0]<90,seg=look/(n+1);   // 掛ける什器（左の壁）は縦にずれる
      for(let j=1;j<=n+1;j++){const o=j>n?0:(hsh(seed,i,j)<0.5?-1:1)*(7+hsh(seed,j,i)*9),q=[p[0]+(vert?0:o),p[1]+(vert?o:0)],z=out.at(-1),stp=Math.min(seg*0.5,dist([z.x,z.y],q)/speed);
        t+=seg-stp;out.push({t,x:z.x,y:z.y});t+=stp;out.push({t,x:q[0],y:q[1]});}}}
  if(out.at(-1).t<t1)out.push({t:t1,x:out.at(-1).x,y:out.at(-1).y});return out;}
/* 止まっている点のしるし（歩き出しと止まる前に少しゆるめるため） */
function mark(L){for(let i=0;i<L.length;i++){const a=L[i],b=L[i-1],c=L[i+1];a.r=(b&&b.x===a.x&&b.y===a.y)||(c&&c.x===a.x&&c.y===a.y)||i===0||i===L.length-1?1:0;}return L;}
const pl=P=>{let d=0;for(let i=1;i<P.length;i++)d+=dist(P[i-1],P[i]);return d;};
const pathOf=(a,list)=>{const out=[a];let cur=a;for(const p of list){for(const q of route(cur,p))out.push(q===p?p:[q[0],q[1]]);cur=p;}return out;};
/* 小さな決まった乱数（絵のばらつき用。計算の乱数とは別） */
const hsh=(...a)=>{let h=2166136261;for(const x of a){const s=String(x);for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}}return (h>>>0)/4294967296;};
const DOOR_IN=[(MAP.door.inX[0]+MAP.door.inX[1])/2,MAP.ent[1]];
/* 改札口 ↔ 店は、距離 ÷ その人の速さ（A1。前は決まった 0.12分・0.18分で、遠い人ほど速く見えた） */
const preOf=(g,sp)=>Math.max(0.01,dist(g,DOOR_IN)/sp),postOf=(g,from,sp)=>Math.max(0.01,dist(g,from)/sp);

/* 出来事の列 → 店の中の人（actor）の列。res が同じなら同じ */
function build(res,cfg,layout){const AN=animOf(cfg);EASE=AN.ease??AN0.ease;const pi=placeIndex(cfg,layout),Z=cfg.zones,G={};for(const g of cfg.genres)G[g.id]=g;const P={};for(const p of cfg.products)P[p.id]=p;
  const out=[],byEnd={};let n=0;
  const stopsOf=(items,seed)=>{const seen=new Set(),st=[];for(const [pid] of items){const w=pi[pid];if(!w)continue;const s=standOf(w[0],w[1],Z);if(!s||seen.has(w[0]))continue;seen.add(w[0]);st.push([w[0],s]);}
    st.sort((a,b)=>STOP_ORDER.indexOf(a[0])-STOP_ORDER.indexOf(b[0]));return st.slice(0,3).map(([,s])=>[s[0]+(hsh(seed,s[0])-0.5)*10,s[1],1]);};
  const gate=seed=>[380+hsh(seed,'g')*260,585];
  for(const e of res.ev){
    if(e.k==='buy'&&e.lane){const id=n++,ta=e.t-(e.wait||0)-(e.stay||0),tq=e.t-(e.wait||0),sp=speedOf(AN,e.ps),g=gate(id),pre=preOf(g,sp);
      const st=stopsOf(e.items,id),qp=MAP.q[e.lane];const qIn=[qp.x+qp.dx*1.5,qp.y+qp.dy*1.5];
      if(!st.length&&tq-ta>0.3)st.push([372+hsh(id,'rf')*126,400,1]);   // 棚の品を買わない人（たばこ・ホットだけ）で時間がある人は、レジ前の低い棚を見てから並ぶ（A1）
      const a={id,kind:'buy',ps:e.ps,lane:e.lane,ta,tq,ts:e.t,te:e.end,t0:ta-pre,t1:e.end,pre,gate:g,items:e.items.length,yen:e.yen,sp,
        walk:legs(pathOf(MAP.ent,[...st,qIn]),ta,tq,st.length,sp,AN,id)};
      out.push(a);byEnd[e.ps+'|'+(+e.end).toFixed(2)]=a;continue;}
    if(e.k==='look'&&e.lane&&e.why==='列が長い'){const id=n++,stay=e.stay||2,ta=e.t-stay,sp=speedOf(AN,e.ps),qp=MAP.q[e.lane],g=gate(id),pre=preOf(g,sp);
      const tail=[qp.x+qp.dx*Math.min(9,(e.q||0)+1),qp.y+qp.dy*Math.min(5,(e.q||0)+1)];   // 列のいちばんうしろ（セルフの列は短く描く）
      const st=e.pid?stopsOf([[e.pid,1]],id):[];
      const w=legs(pathOf(MAP.ent,[...st,tail]),ta,e.t,st.length,sp,AN,id),bp=pathOf(tail,[MAP.ent]),bt=pl(bp)/sp,back=legs(bp,e.t+0.06,e.t+0.06+bt,0,sp,AN,id);
      const post=postOf(g,MAP.ent,sp);out.push({id,kind:'left',ps:e.ps,lane:e.lane,ta,t0:ta-pre,t1:e.t+0.06+bt+post,pre,post,gate:g,q:e.q||0,walk:mark(w.concat(back)),out:'ent'});continue;}
    if(e.k==='look'&&!e.lane){const id=n++,sp=speedOf(AN,e.ps),g=gate(id),pre=preOf(g,sp),post=postOf(g,MAP.ent,sp);let s=null;
      if(e.pid&&pi[e.pid])s=standOf(pi[e.pid][0],pi[e.pid][1],Z);
      if(!s){const zk=(G[e.genre]&&G[e.genre].zones||[]).find(z=>Z[z]&&layout[z]);if(zk)s=standOf(zk,Math.floor(hsh(id)*(Z[zk].rows*Z[zk].cols)),Z);}
      if(!s)s=[300,150];const w=legs(pathOf(MAP.ent,[[s[0],s[1],1]]),e.t,e.t+0.5,1,sp,AN,id),bp=pathOf([s[0],s[1]],[MAP.ent]),bt=pl(bp)/sp,back=legs(bp,e.t+0.5,e.t+0.5+bt,0,sp,AN,id);
      out.push({id,kind:'look',ps:e.ps,why:e.why,ta:e.t,t0:e.t-pre,t1:e.t+0.5+bt+post,pre,post,gate:g,walk:mark(w.concat(back)),out:'ent'});continue;}}
  // イートイン・レンジ：その人の会計が終わった時刻（from）でつなぐ
  for(const e of res.ev){if(e.from==null||!(e.k==='range'||e.k==='eatin'||e.k==='eatfull'))continue;const a=byEnd[e.ps+'|'+(+e.from).toFixed(2)];if(!a)continue;
    if(e.k==='range'){a.range={t:e.t,min:(cfg.walk&&cfg.walk.eatIn&&cfg.walk.eatIn.range&&cfg.walk.eatIn.range.min)||1.5,eat:e.eat};}
    else if(e.k==='eatin'){a.seat={i:e.seat,t:e.t,to:e.to};}
    else a.full={t:e.t};}
  // 会計のあと：出口へ（レンジ・席に寄る人はそこへ）
  // 会計のあと（A1）：まっすぐ帰る人は、レジの横に半歩よけて、財布をしまう・袋を持ち直す（pack 分）
  for(const a of out){if(a.kind!=='buy')continue;const sp=a.sp,R=MAP.reg[a.lane],seq=[];let t=a.te,cur=R;
    const go=(p,t0,t1)=>{const P=pathOf(cur,[p]),L=legs(P,t0,Math.max(t1,t0+pl(P)/sp),0,sp,AN,a.id);seq.push(...L);cur=p;};   // 間に合わなくても、自分の速さより速くは歩かない
    if(!a.range&&!a.seat&&!a.full){const P=a.lane==='s'?[R[0]-26,R[1]+14]:[R[0]+30,R[1]+12],w=dist(R,P)/sp,pk=AN.pack||0.08;
      seq.push({t,x:R[0],y:R[1]},{t:t+w,x:P[0],y:P[1]},{t:t+w+pk,x:P[0],y:P[1]});a.pack={t0:t+w,t1:t+w+pk};t+=w+pk;cur=P;}
    if(a.range){go(MAP.rangeAt,t,Math.max(t+0.05,a.range.t));t=Math.max(seq.at(-1).t,a.range.t+a.range.min);seq.push({t,x:cur[0],y:cur[1]});}
    if(a.seat){const s=MAP.seat(a.seat.i);go(s,t,Math.max(t+0.05,a.seat.t));t=Math.max(seq.at(-1).t,a.seat.to);seq.push({t,x:s[0],y:s[1]});}
    else if(a.full){go([MAP.seat(3)[0]-30,MAP.seat(3)[1]],t,Math.max(t+0.05,a.full.t));t=Math.max(seq.at(-1).t,a.full.t+0.08);seq.push({t,x:cur[0],y:cur[1]});}
    go(MAP.exit,t,t+Math.max(0.02,pl(pathOf(cur,[MAP.exit]))/sp));a.after=mark(seq);a.post=postOf(a.gate,MAP.exit,sp);a.t1=seq.at(-1).t+a.post;mark(a.walk);}
  out.sort((x,y)=>x.t0-y.t0);
  let mx=0;for(const a of out){mx=Math.max(mx,a.t1);a.maxT1=mx;}   // 二分探索のため（ここまでで、いちばん遅く消える時刻）
  return out;}
/* 時刻の列の中の場所（直線でつなぐ） */
let EASE=AN0.ease;
function along(L,t){if(!L.length)return null;if(t<=L[0].t)return [L[0].x,L[0].y,0];for(let i=1;i<L.length;i++){if(t<=L[i].t){const a=L[i-1],b=L[i];let f=b.t>a.t?(t-a.t)/(b.t-a.t):1;
  if(EASE>0&&(a.r||b.r)){const g=a.r&&b.r?f*f*(3-2*f):a.r?f*f:1-(1-f)*(1-f);f=(1-EASE)*f+EASE*g;}   // 歩き出し・止まる前は少しゆるめる（平均の速さは同じ）
  return [a.x+(b.x-a.x)*f,a.y+(b.y-a.y)*f,b.x!==a.x||b.y!==a.y?1:0];}}const z=L.at(-1);return [z.x,z.y,0];}
const lerp=(a,b,f)=>[a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f];
/* 列の何番目か（前にいて、まだ会計を始めていない人の数。会計を始めた人の分は少しずつ詰める） */
const SH=0.04;
function qSlot(act,a,t){let k=0;for(const b of act){if(b===a||b.kind!=='buy'||b.lane!==a.lane||b.tq>=a.tq||b.tq>t)continue;if(b.ts>t)k++;else if(b.ts>t-SH)k+=1-(t-b.ts)/SH;}return k;}
/* 時刻 t に店の中にいる人。cap をこえる分は点だけ（dot:true） */
function at(actors,t,cap){cap=cap||40;let lo=0,hi=actors.length;while(lo<hi){const m=(lo+hi)>>1;if(actors[m].maxT1<t)lo=m+1;else hi=m;}
  const act=[];for(let i=lo;i<actors.length&&actors[i].t0<=t;i++){const a=actors[i];if(a.t1>=t)act.push(a);}
  const out=[];for(const a of act){let p=null,ph='';
    if(t<a.ta){p=lerp(a.gate,DOOR_IN,(t-a.t0)/a.pre);p.push(1);ph='in';}
    else if(a.kind==='buy'){
      if(t<a.tq){p=along(a.walk,t);ph='shop';}
      else if(t<a.ts){const Q=MAP.q[a.lane],k=qSlot(act,a,t),kk=a.lane==='s'?Math.min(k,4):k;const end=[Q.x+Q.dx*(kk+1),Q.y+Q.dy*(kk+1)],wk=a.walk.at(-1);
        const f=Math.min(1,(t-a.tq)/0.03);p=[wk.x+(end[0]-wk.x)*f,wk.y+(end[1]-wk.y)*f,f<1?1:0];ph='queue';a._k=k;}
      else if(t<a.te){const R=MAP.reg[a.lane];p=[R[0],R[1],0];ph='pay';}
      else{const last=a.after.at(-1);if(t<=last.t){p=along(a.after,t);ph=a.seat&&t>=a.seat.t&&t<a.seat.to?'eat':a.range&&t>=a.range.t&&t<a.range.t+a.range.min?'range':a.pack&&t>=a.pack.t0&&t<a.pack.t1?'pack':'out';}
        else{p=lerp([MAP.exit[0],MAP.exit[1]],a.gate,(t-last.t)/a.post);p.push(1);ph='gone';}}}
    else{const last=a.walk.at(-1);if(t<=last.t){p=along(a.walk,t);ph=a.kind;}else{p=lerp([MAP.ent[0],MAP.ent[1]],a.gate,(t-last.t)/a.post);p.push(1);ph='gone';}}
    if(p)out.push({a,x:p[0],y:p[1],mv:p[2],ph});}
  out.sort((u,v)=>u.y-v.y);
  if(out.length>cap){const keep=new Set(out.slice().sort((u,v)=>(v.ph==='pay'||v.ph==='queue')-(u.ph==='pay'||u.ph==='queue')).slice(0,cap));for(const o of out)if(!keep.has(o))o.dot=true;}
  return out;}
/* 店員の場所：有人レジ・ホットケースの前。セルフで呼ばれたら、その時間だけセルフレジへ */
function clerks(res,t,onAt){const C=(res.crew||[]).filter(w=>(w.spans||[]).some(([a,b])=>t>=a&&t<b));const out=[];
  const help=res.ev.filter(e=>e.k==='selfhelp'&&t>=e.t-0.05&&t<e.t+e.min+0.05);
  C.forEach((w,i)=>{const home=i===0?MAP.clerk.f:MAP.clerk.hot;let p=home,busy=null;const h=help.find(e=>e.by===w.id);
    if(h){const f0=Math.min(1,Math.max(0,(t-(h.t-0.05))/0.05)),f1=Math.min(1,Math.max(0,(h.t+h.min+0.05-t)/0.05));p=lerp(home,MAP.clerk.self,Math.min(f0,f1));busy='self';}
    out.push({id:w.id,name:w.name,x:p[0],y:p[1],busy});});
  const stop=help.some(e=>e.stop&&t>=e.t&&t<e.t+e.min);
  return {list:out,stop};}
/* 吹き出し（時刻が近い出来事だけ。win 分のあいだ出す） */
function bubbles(res,t,win){win=win||0.07;const out=[];const lo=t-win;
  let i=0,j=res.ev.length;while(i<j){const m=(i+j)>>1;if(res.ev[m].t<lo-2)i=m+1;else j=m;}
  for(;i<res.ev.length&&res.ev[i].t<=t;i++){const e=res.ev[i];
    if(e.k==='selfhelp'&&e.t>=lo)out.push({x:MAP.reg.s[0],y:MAP.reg.s[1]-50,text:'すみません…',kind:'help',e});
    else if(e.k==='look'&&e.why==='列が長い'&&e.t>=lo){const Q=MAP.q[e.lane||'f'],k=Math.min(9,(e.q||0)+1);out.push({x:Q.x+Q.dx*k,y:Q.y+Q.dy*Math.min(5,k)-48,text:(e.q||0)>=5?'床の印より長い…':'電車が来ちゃう',kind:'left',e});}
    else if(e.k==='range'){const tc=e.t+1.5;if(t>=tc&&t<tc+win)out.push({x:MAP.rangeAt[0]+20,y:MAP.rangeAt[1]-70,text:'チン',kind:'range',e});}
    else if(e.k==='eatfull'&&e.t>=lo)out.push({x:MAP.seat(3)[0]-40,y:MAP.seat(3)[1]-50,text:'席がいっぱい',kind:'full',e});
    else if(e.k==='delivery'&&e.t>=lo-0.05)out.push({x:MAP.ent[0]+60,y:MAP.ent[1]-40,text:e.name+'が届いた',kind:'deli',e});}
  return out;}
/* ---------- 地元のお店の人（A1・2026-11-11）----------
   届いた出来事（delivery・local）から、その人の「時刻 → 場所」を作る。届いた時刻 e.t に店の入口に着く。
   入口 → レジの横（荷物を下ろす）→ 箱を下ろす → レジの横で店員と検品・受け取りのサイン → 出口 → 改札口。
   お客さんと同じくらいの速さ（台車のときは少しゆっくり）。下ろした箱を棚に並べるのは店員（A3 で描く）。 */
const LOCAL_DROP=[500,328],LOCAL_SIGN=[546,330];   // 有人レジの左の端の前（列の印より上）。台車はレジの横に止めて（下ろす所の左）、サインのあと取りに戻る
function locals(res,cfg){const AN=animOf(cfg),LA=AN.local||AN0.local,out=[];let k=0,lastT=-1;
  for(const e of res.ev){if(e.k!=='delivery'||!e.local||!(e.n>0))continue;if(Math.abs(e.t-lastT)>0.5)k=0;lastT=e.t;
    const cart=!!(LA.cart&&LA.cart[e.local]),sp=(LA.mps||1.1)*60/(AN.unitM||0.009)*(cart?(LA.cartMul||0.85):1),seed='L'+e.local+e.t,g=[380+hsh(seed,'g')*260,585];
    const D=[LOCAL_DROP[0]-k*30,LOCAL_DROP[1]+k*6],S=[LOCAL_SIGN[0]-k*30,LOCAL_SIGN[1]],box=e.n<=6?1:e.n<=12?2:3;k++;
    const L=[];let t=e.t-preOf(g,sp);L.push({t,x:g[0],y:g[1]});t=e.t;L.push({t,x:DOOR_IN[0],y:DOOR_IN[1]});
    const walkTo=p=>{let cur=[L.at(-1).x,L.at(-1).y];for(const q of route(cur,p)){t+=dist(cur,q)/sp;L.push({t,x:q[0],y:q[1]});cur=q;}};
    const wait=m=>{t+=m;L.push({t,x:L.at(-1).x,y:L.at(-1).y});};
    walkTo(D);const u0=t;wait((LA.unloadPerBox||0.25)*box);const u1=t;
    walkTo(S);const s0=t;wait(LA.sign||0.7);const s1=t;if(cart){walkTo(D);wait(0.03);}const p0=t;walkTo([MAP.exit[0],S[1]]);walkTo(MAP.exit);t+=postOf(g,MAP.exit,sp);L.push({t,x:g[0],y:g[1]});
    out.push({e,shop:e.local,name:e.name,cart,box,drop:D,park:[D[0]-24,D[1]],L:mark(L),u0,u1,s0,s1,p0,t0:L[0].t,t1:t});}
  return out;}
/* 時刻 t の地元のお店の人：{x,y,mv,ph（in・unload・sign・out）,left（台車・かごに残っている箱）} */
function localAt(v,t){if(t<v.t0||t>v.t1)return null;const p=along(v.L,t),ph=t<v.u0?'in':t<v.u1?'unload':t>=v.s0&&t<v.s1?'sign':t<v.p0?'walk':'out';
  const left=t<v.u0?v.box:t<v.u1?Math.ceil(v.box*(1-(t-v.u0)/(v.u1-v.u0))-1e-9):0;return {x:p[0],y:p[1],mv:p[2],ph,left,put:v.box-left,cartAt:v.cart?(ph==='in'||ph==='out'?[p[0]+18,p[1]]:v.park):null};}
root.MinatoAnim={MAP,build,at,clerks,bubbles,standOf,placeIndex,along,locals,localAt};
})(typeof window!=='undefined'?window:globalThis);
