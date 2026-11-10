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
const SPEED={shf:7000,salM:6000,salF:5600,stu:6000,jk:5000,sen:3200,tou:4000,hou:4200,cru:3800};   // 歩く速さ（座標/分）。絵だけの数字
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
/* 道のりの点の列に時刻を割り当てる：歩く分は速さで、のこりは「立ち止まる点」で見る時間 */
function legs(pts,t0,t1,stops,speed){// pts:[[x,y,stop?]]（最初が出発点）。返すもの：[{t,x,y}]（時刻の順）
  let D=0;for(let i=1;i<pts.length;i++)D+=dist(pts[i-1],pts[i]);
  let walk=D/speed,span=Math.max(0.01,t1-t0);if(walk>span*0.9)walk=span*0.9;
  const look=stops>0?(span-walk)/stops:0,out=[{t:t0,x:pts[0][0],y:pts[0][1]}];let t=t0;
  for(let i=1;i<pts.length;i++){t+=D>0?walk*dist(pts[i-1],pts[i])/D:0;out.push({t,x:pts[i][0],y:pts[i][1]});if(pts[i][2]&&look>0){t+=look;out.push({t,x:pts[i][0],y:pts[i][1]});}}
  if(out.at(-1).t<t1)out.push({t:t1,x:out.at(-1).x,y:out.at(-1).y});return out;}
const pathOf=(a,list)=>{const out=[a];let cur=a;for(const p of list){for(const q of route(cur,p))out.push(q===p?p:[q[0],q[1]]);cur=p;}return out;};
/* 小さな決まった乱数（絵のばらつき用。計算の乱数とは別） */
const hsh=(...a)=>{let h=2166136261;for(const x of a){const s=String(x);for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}}return (h>>>0)/4294967296;};
const PRE=0.12,POST=0.18;   // 改札口から店へ・店から改札口へ歩く分（絵だけ）

/* 出来事の列 → 店の中の人（actor）の列。res が同じなら同じ */
function build(res,cfg,layout){const pi=placeIndex(cfg,layout),Z=cfg.zones,G={};for(const g of cfg.genres)G[g.id]=g;const P={};for(const p of cfg.products)P[p.id]=p;
  const out=[],byEnd={};let n=0;
  const stopsOf=(items,seed)=>{const seen=new Set(),st=[];for(const [pid] of items){const w=pi[pid];if(!w)continue;const s=standOf(w[0],w[1],Z);if(!s||seen.has(w[0]))continue;seen.add(w[0]);st.push([w[0],s]);}
    st.sort((a,b)=>STOP_ORDER.indexOf(a[0])-STOP_ORDER.indexOf(b[0]));return st.slice(0,3).map(([,s])=>[s[0]+(hsh(seed,s[0])-0.5)*10,s[1],1]);};
  const gate=seed=>[380+hsh(seed,'g')*260,585];
  for(const e of res.ev){
    if(e.k==='buy'&&e.lane){const id=n++,ta=e.t-(e.wait||0)-(e.stay||0),tq=e.t-(e.wait||0),sp=SPEED[e.ps]||5000;
      const st=stopsOf(e.items,id),qp=MAP.q[e.lane];const qIn=[qp.x+qp.dx*1.5,qp.y+qp.dy*1.5];
      const a={id,kind:'buy',ps:e.ps,lane:e.lane,ta,tq,ts:e.t,te:e.end,t0:ta-PRE,t1:e.end+POST,gate:gate(id),items:e.items.length,yen:e.yen,
        walk:legs(pathOf(MAP.ent,[...st,qIn]),ta,tq,st.length,sp)};
      out.push(a);byEnd[e.ps+'|'+(+e.end).toFixed(2)]=a;continue;}
    if(e.k==='look'&&e.lane&&e.why==='列が長い'){const id=n++,stay=e.stay||2,ta=e.t-stay,sp=SPEED[e.ps]||5000,qp=MAP.q[e.lane];
      const tail=[qp.x+qp.dx*Math.min(9,(e.q||0)+1),qp.y+qp.dy*Math.min(5,(e.q||0)+1)];   // 列のいちばんうしろ（セルフの列は短く描く）
      const st=e.pid?stopsOf([[e.pid,1]],id):[];
      const w=legs(pathOf(MAP.ent,[...st,tail]),ta,e.t,st.length,sp),back=legs(pathOf(tail,[MAP.ent]),e.t+0.06,e.t+0.06+0.12,0,sp);
      out.push({id,kind:'left',ps:e.ps,lane:e.lane,ta,t0:ta-PRE,t1:e.t+0.18+POST,gate:gate(id),q:e.q||0,walk:w.concat(back),out:'ent'});continue;}
    if(e.k==='look'&&!e.lane){const id=n++,sp=SPEED[e.ps]||5000;let s=null;
      if(e.pid&&pi[e.pid])s=standOf(pi[e.pid][0],pi[e.pid][1],Z);
      if(!s){const zk=(G[e.genre]&&G[e.genre].zones||[]).find(z=>Z[z]&&layout[z]);if(zk)s=standOf(zk,Math.floor(hsh(id)*(Z[zk].rows*Z[zk].cols)),Z);}
      if(!s)s=[300,150];const w=legs(pathOf(MAP.ent,[[s[0],s[1],1]]),e.t,e.t+0.5,1,sp),back=legs(pathOf([s[0],s[1]],[MAP.ent]),e.t+0.5,e.t+0.62,0,sp);
      out.push({id,kind:'look',ps:e.ps,why:e.why,ta:e.t,t0:e.t-PRE,t1:e.t+0.62+POST,gate:gate(id),walk:w.concat(back),out:'ent'});continue;}}
  // イートイン・レンジ：その人の会計が終わった時刻（from）でつなぐ
  for(const e of res.ev){if(e.from==null||!(e.k==='range'||e.k==='eatin'||e.k==='eatfull'))continue;const a=byEnd[e.ps+'|'+(+e.from).toFixed(2)];if(!a)continue;
    if(e.k==='range'){a.range={t:e.t,min:(cfg.walk&&cfg.walk.eatIn&&cfg.walk.eatIn.range&&cfg.walk.eatIn.range.min)||1.5,eat:e.eat};}
    else if(e.k==='eatin'){a.seat={i:e.seat,t:e.t,to:e.to};}
    else a.full={t:e.t};}
  // 会計のあと：出口へ（レンジ・席に寄る人はそこへ）
  for(const a of out){if(a.kind!=='buy')continue;const sp=SPEED[a.ps]||5000,R=MAP.reg[a.lane],seq=[];let t=a.te,cur=R;
    const go=(p,t0,t1)=>{const L=legs(pathOf(cur,[p]),t0,t1,0,sp);seq.push(...L);cur=p;};
    if(a.range){go(MAP.rangeAt,t,Math.max(t+0.05,a.range.t));t=a.range.t+a.range.min;seq.push({t,x:cur[0],y:cur[1]});}
    if(a.seat){const s=MAP.seat(a.seat.i);go(s,t,Math.max(t+0.05,a.seat.t));t=a.seat.to;seq.push({t,x:s[0],y:s[1]});}
    else if(a.full){go([MAP.seat(3)[0]-30,MAP.seat(3)[1]],t,Math.max(t+0.05,a.full.t));t=a.full.t+0.08;seq.push({t,x:cur[0],y:cur[1]});}
    go(MAP.exit,t,t+Math.max(0.05,dist(cur,MAP.exit)/sp));a.after=seq;a.t1=seq.at(-1).t+POST;}
  out.sort((x,y)=>x.t0-y.t0);
  let mx=0;for(const a of out){mx=Math.max(mx,a.t1);a.maxT1=mx;}   // 二分探索のため（ここまでで、いちばん遅く消える時刻）
  return out;}
/* 時刻の列の中の場所（直線でつなぐ） */
function along(L,t){if(!L.length)return null;if(t<=L[0].t)return [L[0].x,L[0].y,0];for(let i=1;i<L.length;i++){if(t<=L[i].t){const a=L[i-1],b=L[i],f=b.t>a.t?(t-a.t)/(b.t-a.t):1;return [a.x+(b.x-a.x)*f,a.y+(b.y-a.y)*f,b.x!==a.x||b.y!==a.y?1:0];}}const z=L.at(-1);return [z.x,z.y,0];}
const lerp=(a,b,f)=>[a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f];
/* 列の何番目か（前にいて、まだ会計を始めていない人の数。会計を始めた人の分は少しずつ詰める） */
const SH=0.04;
function qSlot(act,a,t){let k=0;for(const b of act){if(b===a||b.kind!=='buy'||b.lane!==a.lane||b.tq>=a.tq||b.tq>t)continue;if(b.ts>t)k++;else if(b.ts>t-SH)k+=1-(t-b.ts)/SH;}return k;}
/* 時刻 t に店の中にいる人。cap をこえる分は点だけ（dot:true） */
function at(actors,t,cap){cap=cap||40;let lo=0,hi=actors.length;while(lo<hi){const m=(lo+hi)>>1;if(actors[m].maxT1<t)lo=m+1;else hi=m;}
  const act=[];for(let i=lo;i<actors.length&&actors[i].t0<=t;i++){const a=actors[i];if(a.t1>=t)act.push(a);}
  const out=[];for(const a of act){let p=null,ph='';
    if(t<a.ta){p=lerp(a.gate,[(MAP.door.inX[0]+MAP.door.inX[1])/2,MAP.ent[1]],(t-a.t0)/PRE);p.push(1);ph='in';}
    else if(a.kind==='buy'){
      if(t<a.tq){p=along(a.walk,t);ph='shop';}
      else if(t<a.ts){const Q=MAP.q[a.lane],k=qSlot(act,a,t),kk=a.lane==='s'?Math.min(k,4):k;const end=[Q.x+Q.dx*(kk+1),Q.y+Q.dy*(kk+1)],wk=a.walk.at(-1);
        const f=Math.min(1,(t-a.tq)/0.03);p=[wk.x+(end[0]-wk.x)*f,wk.y+(end[1]-wk.y)*f,f<1?1:0];ph='queue';a._k=k;}
      else if(t<a.te){const R=MAP.reg[a.lane];p=[R[0],R[1],0];ph='pay';}
      else{const last=a.after.at(-1);if(t<=last.t){p=along(a.after,t);ph=a.seat&&t>=a.seat.t&&t<a.seat.to?'eat':a.range&&t>=a.range.t&&t<a.range.t+a.range.min?'range':'out';}
        else{p=lerp([MAP.exit[0],MAP.exit[1]],a.gate,(t-last.t)/POST);p.push(1);ph='gone';}}}
    else{const last=a.walk.at(-1);if(t<=last.t){p=along(a.walk,t);ph=a.kind;}else{p=lerp([MAP.ent[0],MAP.ent[1]],a.gate,(t-last.t)/POST);p.push(1);ph='gone';}}
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
root.MinatoAnim={MAP,build,at,clerks,bubbles,standOf,placeIndex,along};
})(typeof window!=='undefined'?window:globalThis);
