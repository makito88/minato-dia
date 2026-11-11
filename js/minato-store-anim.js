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
const TRASH=[912,420];
const DOOR_IN=[(MAP.door.inX[0]+MAP.door.inX[1])/2,MAP.ent[1]];
/* 改札口 ↔ 店は、距離 ÷ その人の速さ（A1。前は決まった 0.12分・0.18分で、遠い人ほど速く見えた） */
const preOf=(g,sp)=>Math.max(0.01,dist(g,DOOR_IN)/sp),postOf=(g,from,sp)=>Math.max(0.01,dist(g,from)/sp);

/* ---------- A2（2026-11-11）：店の中の台本 ----------
   計算が決めた「何を買ったか・何分いたか」の中で、その何分をどう過ごしたかを、人の番号のハッシュで決める（途中から見ても同じ）。
   ・動き方の型：st まっすぐ／bf 行ったり来たり（となりの品を手に取って戻す）／loop ひと回り／wan ぶらぶら／fol 連れについていく。
   ・棚の前に立つ秒数は、品のジャンルごとの幅（walk.anim.dwell）の中だけ。余った時間は立ち止まりで埋めず、ほかの棚をのぞく・回る道で使う。
   ・出来事（買い物・帰る理由）は足さない。手に取って戻す品は、その時刻に棚にある同じジャンルの品から。 */
const DW0={onigiri:[4,15],sand:[5,15],bread:[4,15],donut:[4,15],colddrink:[3,10],coffee:[2,6],hotdrink:[3,10],energy:[2,6],alcohol:[5,15],snack:[4,12],gummy:[2,6],paper:[2,5],magazine:[10,60],
  daily:[5,20],umbrella:[3,8],bento:[8,25],cupmen:[5,15],omiyage:[15,60],browse:[3,10],glance:[2,6]};
const ST0={ps:{},rush:{h:[6,9],st:2.5},noon:{h:[11,15],wan:1.5,bf:1.5},night:{h:[21,26],bf:1.5},hurry:{st:8},omiyageLoop:0.5,follow:0.6};
const LOOP_Z=['fridge','shelf','dry','omiyage'],BROWSE_Z=['fridge','shelf','dry','omiyage','regfront','hook'];
const zoneAt=(Z,zk,k)=>{const z=Z[zk];return z?standOf(zk,k%(z.rows*z.cols),Z):null;};
function stockAt(res,T){const S=res.snap||[];let lo=0,hi=S.length-1;if(hi<0)return null;while(lo<hi){const m=(lo+hi+1)>>1;if(S[m].t<=T)lo=m;else hi=m-1;}return S[lo].s;}
function pickStyle(AN,ps,h,hurry,omi,seed){const SY=AN.styles||ST0,base=(SY.ps&&SY.ps[ps])||{st:3,bf:1,loop:1,wan:1},w={};for(const k of ['st','bf','loop','wan','fol'])w[k]=base[k]||0;
  const inH=(o)=>o&&o.h&&((h>=o.h[0]&&h<o.h[1])||(h+24>=o.h[0]&&h+24<o.h[1]));
  for(const o of [inH(SY.rush)&&SY.rush,inH(SY.noon)&&SY.noon,inH(SY.night)&&SY.night,hurry&&SY.hurry])if(o)for(const k in w)if(o[k])w[k]*=o[k];
  if(hurry)return 'st';
  if(omi&&hsh(seed,'omiL')<(SY.omiyageLoop??0.5))return 'loop';
  let s=0;for(const k in w)s+=w[k];let u=hsh(seed,'style')*s;for(const k in w){u-=w[k];if(u<0)return k;}return 'st';}
function script(e,a,X){const {AN,pi,Z,P,res,lay}=X,id=a.id,sp=a.sp,span=Math.max(0.01,a.tq-a.ta),h=Math.floor(a.ta/60);
  const D=AN.dwell||DW0,M=AN.dwellMul||{},seed='s'+id;
  // 電車まであと何分（入ったとき）と、急いでいるか
  const TR=AN.train||{},dw=e.dw||1.5,slack=hsh(seed,'tt')*2*Math.max(0.5,dw),tt=(e.stay||0)+(e.wait||0)+slack;a.train=+tt.toFixed(2);a.hurry=slack<(TR.hurryPad??1.5)&&(e.stay||0)<=(TR.hurryStay??3);
  const mulOf=g=>{let m=1;if(a.hurry)m*=M.hurry??0.5;if(M.ps&&M.ps[e.ps])m*=M.ps[e.ps];const gp=M.genrePs&&M.genrePs[g];if(gp&&gp[e.ps])m*=gp[e.ps];
    if(M.night&&h>=M.night.from&&M.night.g&&M.night.g[g])m*=M.night.g[g];return m;};
  const sec=(g,k)=>{const r=D[g]||D.browse||[3,10];return {d:(r[0]+(r[1]-r[0])*hsh(seed,g,k))*mulOf(g),hi:r[1]*mulOf(g)};};
  // 買う品の立つ点（同じ棚のすぐそばの品はまとめる・4か所まで）
  const S=[];for(const [pid] of e.items){const w=pi[pid];if(!w)continue;const s=standOf(w[0],w[1],Z);if(!s)continue;const g=P[pid]&&P[pid].genre;
    const near=S.find(q=>q.zk===w[0]&&Math.abs(q.x-s[0])<16&&Math.abs(q.y-s[1])<6);if(near){near.pids.push(pid);continue;}
    S.push({zk:w[0],i:w[1],x:s[0]+(hsh(seed,pid)-0.5)*8,y:s[1],g,pids:[pid],kind:'pick'});}
  S.sort((u,v)=>STOP_ORDER.indexOf(u.zk)-STOP_ORDER.indexOf(v.zk)||u.x-v.x);S.splice(4);
  const omi=S.some(q=>q.zk==='omiyage');let style=pickStyle(AN,e.ps,h,a.hurry,omi,seed);
  const SY=AN.styles||ST0,omiOK=omi||(SY.omiyagePs||['tou','cru','fam','cpl','frd','jk','sen','hou']).includes(e.ps),noOmi=L=>omiOK?L:L.filter(z=>z!=='omiyage');   // おみやげの台をのぞくのは、観光・客船・家族・年配の人など（朝の会社員は寄らない）
  S.forEach((q,k)=>{const r=sec(q.g,k);q.d=r.d;q.hi=r.hi;
    if(e.ps==='sen'||(e.mot==='new'&&k===0)){const rd=(M.read||[3,6]);const b=rd[0]+(rd[1]-rd[0])*hsh(seed,'rd',k);q.d+=b*(a.hurry?0.5:1);q.hi+=rd[1];q.kind='read';}
    if(e.mot==='sns'&&k===0||q.zk==='omiyage'&&(e.ps==='tou'||e.ps==='cru')&&hsh(seed,'ph')<0.6)q.kind='photo';});
  // 行ったり来たり：はじめの棚（低い棚か冷蔵ケース）で、となりの同じジャンルの品を手に取って戻す（その時刻に棚にある品）
  const cmpAt=(q,t,k)=>{const L=lay[q.zk]||[],z=Z[q.zk];if(!z)return null;const out=[];for(const dj of [1,-1,2,-2]){const j=q.i+dj;if(j<0||j>=L.length)continue;const pid=L[j];if(!pid||q.pids.includes(pid)||e.items.some(([b])=>b===pid)||!P[pid]||P[pid].genre!==q.g)continue;out.push([j,pid]);}
    if(!out.length)return null;const sk=stockAt(res,t),ok=out.filter(([,pid])=>!sk||(sk[pid]||0)>0);if(!ok.length)return null;const [j,pid]=ok[Math.floor(hsh(seed,'cmp',k)*ok.length)];const s=standOf(q.zk,j,Z);
    return {zk:q.zk,i:j,x:s[0],y:s[1],g:q.g,pids:[],kind:'cmp',pid};};
  let stops=S.slice();const ext=[];
  if(style==='fol'&&X.lead){const L=X.lead.stops.filter(q=>q.kind!=='pick').slice(0,3);for(const q of L)ext.push({zk:q.zk,x:q.x+10,y:q.y,g:'glance',pids:[],kind:'look'});}
  if(style==='loop'){const k0=Math.floor(hsh(seed,'lk')*LOOP_Z.length),stopAt=[hsh(seed,'l1')*4|0,hsh(seed,'l2')*4|0];
    for(let k=0;k<LOOP_Z.length;k++){const zk=LOOP_Z[k];if(S.some(q=>q.zk===zk)||!omiOK&&zk==='omiyage')continue;const s=zoneAt(Z,zk,Math.floor(hsh(seed,'lz',k)*20));if(!s)continue;
      ext.push({zk,x:s[0],y:s[1],g:zk==='omiyage'?'omiyage':'browse',pids:[],kind:stopAt.includes((k+k0)%4)?'look':'pass'});}}
  stops=ext.concat(stops);
  if(style==='bf'){const k=stops.findIndex(q=>q.kind!=='look'&&q.kind!=='pass'&&(q.zk==='shelf'||q.zk==='fridge'));if(k>=0){const q=stops[k],n=2+Math.floor(hsh(seed,'bfn')*2),ins=[];
    for(let j=0;j<n;j++){const c=cmpAt(q,a.ta+span*0.3,j);if(!c)break;const r=sec(q.g,'c'+j);c.d=r.d*0.6;c.hi=r.hi;ins.push(c);}
    stops.splice(k,0,...ins.flatMap((c,j)=>j<ins.length-1?[c,{...q,pids:[],kind:'back',d:Math.min(q.d,2+hsh(seed,'bk',j)*3),hi:q.hi}]:[c]));}}
  else if(!a.hurry&&(e.ps==='salF'||e.mot==='new')&&hsh(seed,'cm1')<0.5){const k=stops.findIndex(q=>q.kind==='pick'||q.kind==='read');if(k>=0){const c=cmpAt(stops[k],a.ta+span*0.3,9);if(c){const r=sec(stops[k].g,'c9');c.d=r.d*0.6;c.hi=r.hi;stops.splice(k,0,c);}}}
  if(style==='wan'){const n=2+Math.floor(hsh(seed,'wn')*3);for(let j=0;j<n;j++){const BZ=noOmi(BROWSE_Z),zk=BZ[Math.floor(hsh(seed,'wz',j)*BZ.length)],s=zoneAt(Z,zk,Math.floor(hsh(seed,'wi',j)*20));if(!s)continue;
    stops.splice(Math.floor(hsh(seed,'wp',j)*(stops.length+1)),0,{zk,x:s[0],y:s[1],g:'glance',pids:[],kind:'look'});}}
  for(const [k,q] of stops.entries())if(q.d==null){const r=q.kind==='pass'?{d:0,hi:0}:sec(q.g,'x'+k);q.d=r.d;q.hi=r.hi;}
  // かご：3点以上はたいてい・2点はときどき。手がいっぱいになってから取りに行く人も
  const B=AN.basket||{p3:0.85,p2:0.25,late:0.35,at:[212,428]},nI=e.items.reduce((s,[,q])=>s+q,0),bk=hsh(seed,'bk')<(nI>=3?B.p3:nI===2?B.p2:0);
  if(bk){const picks=stops.map((q,k)=>q.kind==='pick'||q.kind==='read'||q.kind==='photo'?k:-1).filter(k=>k>=0);
    if(picks.length>=3&&hsh(seed,'bl')<B.late)stops.splice(picks[1]+1,0,{zk:'basket',x:B.at[0],y:B.at[1]+4,g:'basket',pids:[],kind:'basket',d:2,hi:3});else a.bkAt=a.ta;}
  // 時間の合わせ方：歩く分 + 立ち止まる分 と「店にいた時間」
  const qIn=X.qIn,walkOf=L=>pl(pathOf(MAP.ent,[...L.map(q=>[q.x,q.y]),qIn]))/sp,sumD=L=>L.reduce((s,q)=>s+q.d,0)/60;
  let W=walkOf(stops);
  if(W>span*(AN.hurry||0.85)){stops=stops.filter(q=>q.kind==='pick'||q.kind==='read'||q.kind==='photo'||q.kind==='basket');W=walkOf(stops);}
  if(W>span*(AN.hurry||0.85)){a.style='rush';a.stops=[];a.walk=legs(pathOf(MAP.ent,[...S.map(q=>[q.x,q.y,1]),qIn]),a.ta,a.tq,S.length,sp,AN,id);if(bk&&!a.bkAt)a.bkAt=a.ta;return;}
  let Dd=sumD(stops);
  if(W+Dd>span){const f=Math.max(0,(span-W)/Math.max(1e-9,Dd));for(const q of stops)q.d*=f;}
  else{ // 余った時間：ほかの棚をのぞく・回る道を長く（立ち止まりで埋めない）
    let left=span-W-Dd,k=0;const pool=noOmi(style==='st'?['regfront','fridge','dry','shelf']:style==='loop'?LOOP_Z.concat(['regfront']):BROWSE_Z);let rack=0;
    // 長くいる人（あと1.5分より多く余る）は、雑誌の立ち読みやおみやげの台も
    while(left>2/60&&k<160){const long=left>1.5&&hsh(seed,'lg',k)<0.3,zk=long?(!rack&&hsh(seed,'lz',k)<0.4?'rack':omiOK?'omiyage':'dry'):pool[Math.floor(hsh(seed,'fz',k)*pool.length)],s=zk==='rack'?standOf('rack',Math.floor(hsh(seed,'fr',k)*7),Z):zoneAt(Z,zk,Math.floor(hsh(seed,'fi',k)*20));k++;if(!s)continue;
      const pass=!long&&hsh(seed,'fs',k)<0.35;   // 3回に1回くらいは、立ち止まらずに通るだけ（回る道を長く）
      const g=zk==='rack'?(long||hsh(seed,'mg',k)<0.5?'magazine':'paper'):zk==='omiyage'?'omiyage':style==='wan'?'glance':'browse',r=pass?{d:0,hi:0}:sec(g,'f'+k);let pos=1+Math.floor(hsh(seed,'fp',k)*Math.max(1,stops.length-1));
      const q={zk,x:s[0]+(hsh(seed,'fx',k)-0.5)*12,y:s[1],g,pids:[],kind:pass?'pass':zk==='rack'?'read':'look',d:r.d,hi:r.hi},L2=stops.slice();pos=Math.min(pos,L2.length);L2.splice(pos,0,q);
      const P0=pos>0?L2[pos-1]:{x:MAP.ent[0],y:MAP.ent[1]},N0=pos+1<L2.length?L2[pos+1]:{x:qIn[0],y:qIn[1]},sg=(u,v)=>pl(pathOf([u.x,u.y],[[v.x,v.y]]))/sp,W2=W+sg(P0,q)+sg(q,N0)-sg(P0,N0),need=W2-W+q.d/60;if(need<=left){stops=L2;W=W2;left-=need;if(zk==='rack')rack++;continue;}
      const dd=(left-(W2-W))*60;if(dd>=1&&!pass){q.d=Math.min(q.d,dd);stops=L2;left-=(W2-W)+q.d/60;W=W2;break;}}
    // まだ少し余れば、棚ごとの幅の中で少しずつ長く。それでも余る分は、列の手前でレジ前の棚をちらっと見る分
    Dd=sumD(stops);left=span-W-Dd;for(const q of stops){if(left<=1e-6)break;const add=Math.min(left*60,Math.max(0,q.hi-q.d));q.d+=add;left-=add/60;}
    if(left>1e-6)a.lastLook=left;}
  a.style=style;
  // 時刻を割り当てる（歩くのはいつもその人の速さ。長く立つ所では半歩ずつずれる）
  const out=[{t:a.ta,x:MAP.ent[0],y:MAP.ent[1]}],rec=[];let t=a.ta,cur=MAP.ent;const sh=AN.shuffle||0.25;
  const walkTo=p=>{for(const q of route(cur,p)){t+=dist(cur,q)/sp;out.push({t,x:q[0],y:q[1]});cur=q;}};
  const hold=(q,dm)=>{if(dm<=0)return;const n=dm>sh*1.6?Math.min(40,Math.floor(dm/sh)):0,vert=q.x<90;if(!n){t+=dm;out.push({t,x:cur[0],y:cur[1]});return;}
    const seg=dm/(n+1),base=[cur[0],cur[1]];for(let j=1;j<=n+1;j++){const o=j>n?0:(hsh(seed,'h',rec.length,j)<0.5?-1:1)*(7+hsh(seed,j,'o')*9),p=[base[0]+(vert?0:o),base[1]+(vert?o:0)],stp=Math.min(seg*0.5,dist(cur,p)/sp);
      t+=seg-stp;out.push({t,x:cur[0],y:cur[1]});t+=stp;out.push({t,x:p[0],y:p[1]});cur=p;}};
  for(const q of stops){walkTo([q.x,q.y]);const t0=t;hold(q,q.d/60);if(q.kind!=='pass')rec.push({t0,t1:t,x:q.x,y:q.y,kind:q.kind,zk:q.zk,g:q.g,pid:q.pid||(q.pids&&q.pids[0])||null,n:(q.pids||[]).length,hi:q.hi||0,d:q.d});
    if(q.kind==='basket')a.bkAt=t;}
  walkTo(qIn);if(a.lastLook){const t0=t;t+=a.lastLook;out.push({t,x:cur[0],y:cur[1]});rec.push({t0,t1:t,x:cur[0],y:cur[1],kind:'wait',zk:'regfront',g:'glance',pid:null,n:0,hi:0,d:a.lastLook*60});}
  if(out.at(-1).t<a.tq)out.push({t:a.tq,x:cur[0],y:cur[1]});
  // 計算の時刻（列に入る時刻）より遅れたら、少し速めて合わせる（めったにない。丸めの分）
  const T=out.at(-1).t;if(T>a.tq+1e-9){const f=(a.tq-a.ta)/(T-a.ta);for(const p of out)p.t=a.ta+(p.t-a.ta)*f;for(const r of rec){r.t0=a.ta+(r.t0-a.ta)*f;r.t1=a.ta+(r.t1-a.ta)*f;}}
  a.walk=out;a.stops=rec;a.bk=bk;}

/* 出来事の列 → 店の中の人（actor）の列。res が同じなら同じ */
function build(res,cfg,layout){const AN=animOf(cfg);EASE=AN.ease??AN0.ease;SLOT=Object.assign({gap:16,step:18,keep:4},AN.slot||{});const pi=placeIndex(cfg,layout),Z=cfg.zones,G={};for(const g of cfg.genres)G[g.id]=g;const P={};for(const p of cfg.products)P[p.id]=p;
  const out=[],byEnd={},lead={};let n=0;
  const stopsOf=(items,seed)=>{const seen=new Set(),st=[];for(const [pid] of items){const w=pi[pid];if(!w)continue;const s=standOf(w[0],w[1],Z);if(!s||seen.has(w[0]))continue;seen.add(w[0]);st.push([w[0],s]);}
    st.sort((a,b)=>STOP_ORDER.indexOf(a[0])-STOP_ORDER.indexOf(b[0]));return st.slice(0,3).map(([,s])=>[s[0]+(hsh(seed,s[0])-0.5)*10,s[1],1]);};
  const gate=seed=>[380+hsh(seed,'g')*260,585];
  for(const e of res.ev){
    if(e.k==='buy'&&e.lane){const id=n++,ta=e.t-(e.wait||0)-(e.stay||0),tq=e.t-(e.wait||0),sp=speedOf(AN,e.ps),g=gate(id),pre=preOf(g,sp);
      const qp=MAP.q[e.lane];const qIn=[qp.x+qp.dx*1.5,qp.y+qp.dy*1.5];
      const a={id,kind:'buy',ps:e.ps,lane:e.lane,ta,tq,ts:e.t,te:e.end,t0:ta-pre,t1:e.end,pre,gate:g,items:e.items.length,yen:e.yen,sp,mot:e.mot};
      // A2：店の中の台本（動き方の型・品ごとの秒数・手に取って戻す・かご）。連れについていくのは、少し前に入った同じ客層の人
      const ld=lead[e.ps],lp=AN.styles&&AN.styles.follow||0.6;script(e,a,{AN,pi,Z,P,res,lay:layout||{},qIn,lead:ld&&Math.abs(ld.ta-ta)<lp&&ld.style!=='fol'?ld:null});lead[e.ps]=a;
      out.push(a);byEnd[e.ps+'|'+(+e.end).toFixed(2)]=a;continue;}
    if(e.k==='look'&&e.lane&&e.why==='列が長い'){const id=n++,stay=e.stay||2,ta=e.t-stay,sp=speedOf(AN,e.ps),qp=MAP.q[e.lane],g=gate(id),pre=preOf(g,sp);
      const tail=[qp.x+qp.dx*Math.min(9,(e.q||0)+1),qp.y+qp.dy*Math.min(5,(e.q||0)+1)];   // 列のいちばんうしろ（セルフの列は短く描く）
      const st=e.pid?stopsOf([[e.pid,1]],id):[];
      const w=legs(pathOf(MAP.ent,[...st,tail]),ta,e.t,st.length,sp,AN,id),bp=pathOf(tail,[MAP.ent]),bt=pl(bp)/sp,back=legs(bp,e.t+0.06,e.t+0.06+bt,0,sp,AN,id);
      const post=postOf(g,MAP.ent,sp);out.push({id,kind:'left',ps:e.ps,lane:e.lane,ta,t0:ta-pre,t1:e.t+0.06+bt+post,pre,post,gate:g,q:e.q||0,walk:mark(w.concat(back)),out:'ent'});continue;}
    if(e.k==='look'&&!e.lane){const id=n++,sp=speedOf(AN,e.ps),g=gate(id),pre=preOf(g,sp),post=postOf(g,MAP.ent,sp);let s=null;
      if(e.pid&&pi[e.pid])s=standOf(pi[e.pid][0],pi[e.pid][1],Z);
      if(!s){const zk=(G[e.genre]&&G[e.genre].zones||[]).find(z=>Z[z]&&layout[z]);if(zk)s=standOf(zk,Math.floor(hsh(id)*(Z[zk].rows*Z[zk].cols)),Z);}
      if(!s)s=[300,150];
      // A2：見て帰る人も、その品のジャンルの秒数の幅で（前は30秒）。歩く分を足す
      const gg=e.pid&&P[e.pid]?P[e.pid].genre:e.genre,R=(AN.dwell||DW0)[gg]||(AN.dwell||DW0).browse,lk=(R[0]+(R[1]-R[0])*hsh(id,'lk'))/60+pl(pathOf(MAP.ent,[s]))/sp;
      const w=legs(pathOf(MAP.ent,[[s[0],s[1],1]]),e.t,e.t+lk,1,sp,AN,id),bp=pathOf([s[0],s[1]],[MAP.ent]),bt=pl(bp)/sp,back=legs(bp,e.t+lk,e.t+lk+bt,0,sp,AN,id);
      out.push({id,kind:'look',ps:e.ps,why:e.why,ta:e.t,t0:e.t-pre,t1:e.t+lk+bt+post,pre,post,gate:g,walk:mark(w.concat(back)),out:'ent'});continue;}}
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
    if(a.seat){const s=MAP.seat(a.seat.i);go(s,t,Math.max(t+0.05,a.seat.t));t=Math.max(seq.at(-1).t,a.seat.to);seq.push({t,x:s[0],y:s[1]});
      if(hsh(a.id,'trash')<(AN.trashP??0.5)){go(TRASH,t,t);t=seq.at(-1).t;a.trash={t0:t,t1:t+0.05};t+=0.05;seq.push({t,x:cur[0],y:cur[1]});}}   // 食べ終わった人の半分くらいは、ごみ箱に寄ってから出る（A2）
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
/* A2：いま何をしているか（台本の部品）・手に持っている品・かご */
const PICK={pick:1,read:1,photo:1};
function doing(o,a,t){const R=a.stops||[];let n=0;for(const r of R){if(r.t1<=t){if(PICK[r.kind])n+=Math.max(1,r.n);continue;}if(t>=r.t0&&o.ph==='shop'){o.act=r.kind;o.zk=r.zk;if(r.kind==='cmp')o.hand=r.pid;else if(PICK[r.kind]&&t>r.t0+(r.t1-r.t0)*0.6)o.hand=r.pid;}break;}
  o.hold=o.ph==='shop'||o.ph==='queue'?n:0;if(a.bk&&a.bkAt!=null&&t>=a.bkAt&&(o.ph==='shop'||o.ph==='queue'||(o.ph==='pay'&&t<a.ts+(a.te-a.ts)*0.3)))o.bk=o.ph==='queue'?'low':'up';
  if(a.hurry&&(o.ph==='queue'||o.ph==='shop'&&o.hold>0))o.ready=true;}   // 急いでいる人は、列の前からスマホや財布を手に（A6 で絵に）
/* A2：立つ場所とよけ方。その時刻に店にいる人だけから決める（途中から見ても同じ）。
   ・棚の前で止まっている人が近すぎたら、あとから来た人が棚に沿ってずれる（左右に2か所ずつ）。あかなければ少しうしろで待つ。
   ・歩いている人は、進む向きの左側を少しだけ歩く（すれちがうときに重ならない） */
let SLOT={gap:16,step:18,keep:4};
function avoid(L,t){const G=SLOT.gap,ST=SLOT.step,stand=[];
  for(const o of L){if(o.ph!=='shop'&&o.ph!=='look'&&o.ph!=='left')continue;
    if(o.mv){const W=o.ph==='shop'?o.a.walk:o.a.walk,q=along(W,t+0.01);if(q){const dx=q[0]-o.x,dy=q[1]-o.y,d=Math.hypot(dx,dy);if(d>0.01){o.x+=dy/d*SLOT.keep;o.y-=dx/d*SLOT.keep;}}continue;}
    stand.push(o);}
  stand.sort((u,v)=>u.a.ta-v.a.ta||u.a.id-v.a.id);const placed=[];
  for(const o of stand){const vert=o.x<90,ok=(x,y)=>placed.every(p=>Math.abs(p.x-x)>=G||Math.abs(p.y-y)>=G*0.6);
    if(!ok(o.x,o.y)){let done=false;for(const k of [1,-1,2,-2]){const x=o.x+(vert?0:k*ST),y=o.y+(vert?k*ST*1.6:0);if(x<40||x>960||y<80||y>450)continue;if(ok(x,y)){o.x=x;o.y=y;done=true;break;}}
      if(!done){const up=o.y<200;o.y+=up?-0:22;o.wait=true;}}
    placed.push(o);}}
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
    if(p){const o={a,x:p[0],y:p[1],mv:p[2],ph};if(a.kind==='buy')doing(o,a,t);if(ph==='queue')o.back=true;out.push(o);}}
  avoid(out,t);
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
