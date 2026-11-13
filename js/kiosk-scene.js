/* =====================================================================
   港駅の店の「動く試作」（2026-11-13・docs/scene-plan.md の段1）
   ・ユーザーが ChatGPT に描いてもらった絵（assets/images/kiosk-scene/）で、その日の港駅の店の
     本当の計算（MinatoStoreView.today の ev の buy）から、さっき買い物を終えた1人を選んで再生する。終わったら次の人へ。
   ・ここは見せ方だけ（DOM と canvas）。計算はしない・出来事を足さない・店の売上・在庫・保存は変えない。
     棚を回る順・品を取る時刻・払い方は計算にないので、決まった乱数と仮の数で作る（表示用）。
   ・設定は data/kiosk-scene.json。絵が届いたら、ファイルを置いて（必要なら設定に1行足して）読み直すだけで使われる。
     ない絵は、いちばん上の人の絵で代わりに描き、「まだ絵がない」と小さく出す。
   ・軽さ：売店の画面の絵を描くとき（js/minato-store-view.js の draw・1秒20回まで）に一緒に呼ばれる。
     画面を閉じているとき・「アニメだけ」のときは呼ばれても何もしない。絵は「比べる」を開いたときに初めて読む。
   ・node でも読める（plan と pose は計算だけ。tests/kiosk-scene.test.cjs）。
   ===================================================================== */
(function(root){
'use strict';
const fin=Number.isFinite;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
/* 決まった乱数（0〜1）：文字列から */
function hash(s){let h=2166136261;s=String(s);for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}h^=h>>>13;h=Math.imul(h,0x5bd1e995);h^=h>>>15;return (h>>>0)/4294967296;}
const pick=(r,a)=>Array.isArray(a)?a[0]+(a[1]-a[0])*r:a;

/* ---------- 通り道（点と線のつながりで、いちばん短い道） ---------- */
function shortest(S,from,to,extra){
  const N=Object.assign({},S.nodes),E=S.edges.slice();
  if(extra)for(const x of extra){N[x.id]=x.p;for(const o of x.on||[])E.push([x.id,o]);}
  const d={},prev={},left=new Set(Object.keys(N));for(const k of left)d[k]=Infinity;d[from]=0;
  const len=(a,b)=>Math.hypot(N[a][0]-N[b][0],N[a][1]-N[b][1]);
  while(left.size){let u=null;for(const k of left)if(u===null||d[k]<d[u])u=k;if(u===null||d[u]===Infinity)break;left.delete(u);if(u===to)break;
    for(const [a,b] of E){const v=a===u?b:b===u?a:null;if(v===null||!left.has(v))continue;const nd=d[u]+len(u,v);if(nd<d[v]){d[v]=nd;prev[v]=u;}}}
  if(d[to]===Infinity)return [N[from].slice(),N[to].slice()];
  const out=[];for(let k=to;k!==undefined;k=prev[k])out.unshift(N[k].slice());return out;}
function near(S,p){let b=null,bd=Infinity;for(const k in S.nodes){const n=S.nodes[k],d=Math.hypot(n[0]-p[0],n[1]-p[1]);if(d<bd){bd=d;b=k;}}return b;}
function route(points){let length=0;const seg=[];
  for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],dd=Math.hypot(b[0]-a[0],b[1]-a[1]);if(dd>0.01){seg.push({a,b,d:dd,from:length});length+=dd;}}
  return {points,length,at(u){const dist=clamp(u,0,1)*length,s=seg.find(s=>s.from+s.d>=dist-1e-9)||seg[seg.length-1];
    if(!s)return {x:points[0][0],y:points[0][1],dir:1,dist:0};
    const v=(dist-s.from)/s.d,x=s.a[0]+(s.b[0]-s.a[0])*v,y=s.a[1]+(s.b[1]-s.a[1])*v;
    const pt=dd=>{const D=clamp(dd,0,length),q=seg.find(q=>q.from+q.d>=D-1e-9)||seg[seg.length-1],w=(D-q.from)/q.d;return [q.a[0]+(q.b[0]-q.a[0])*w,q.a[1]+(q.b[1]-q.a[1])*w];};
    const p0=pt(dist-18),p1=pt(dist+18),dx=p1[0]-p0[0],dy=p1[1]-p0[1];   /* 向きは前後の少し先から（曲がり道で絵がちらつかないように） */
    return {x,y,dir:Math.abs(dx)>Math.abs(dy)*1.1?(dx>0?2:3):(dy>0?1:0),dist};}};}

/* 人らしい道（2026-11-13 ユーザーの指摘：直線・直角に曲がる・人の前を通る）：
   通り道の点を人ごとに少しずらし → 細かく分けて、背景の人のまわり（avoid の円）から外へ押し出し → 角を丸める */
function natural(S,pts,R,tag){if(pts.length<2)return pts;const J=(S.wander&&S.wander.jitter)||0,A=S.avoid||[];
  let P=pts.map((p,i)=>i===0||i===pts.length-1?p.slice():[p[0]+(R(tag+'jx'+i)-.5)*2*J,p[1]+(R(tag+'jy'+i)-.5)*2*J]);
  {const C=[P[0]];for(let i=1;i<P.length-1;i++){const a=P[i-1],b=P[i],c=P[i+1],l1=Math.hypot(b[0]-a[0],b[1]-a[1]),l2=Math.hypot(c[0]-b[0],c[1]-b[1]),r=Math.min(40,l1*.4,l2*.4);   /* 角を半径40くらいで丸める */
      if(r<2){C.push(b);continue;}const p0=[b[0]+(a[0]-b[0])*r/l1,b[1]+(a[1]-b[1])*r/l1],p2=[b[0]+(c[0]-b[0])*r/l2,b[1]+(c[1]-b[1])*r/l2];
      for(let k=0;k<=6;k++){const u=k/6,v=1-u;C.push([v*v*p0[0]+2*v*u*b[0]+u*u*p2[0],v*v*p0[1]+2*v*u*b[1]+u*u*p2[1]]);}}C.push(P[P.length-1]);P=C;}
  const Q=[];for(let i=1;i<P.length;i++){const a=P[i-1],b=P[i],n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/8));for(let k=i===1?0:1;k<=n;k++)Q.push([a[0]+(b[0]-a[0])*k/n,a[1]+(b[1]-a[1])*k/n]);}
  const s0=Q[0],s1=Q[Q.length-1],skip=A.filter(([x,y,r])=>Math.hypot(s0[0]-x,s0[1]-y)<r+10||Math.hypot(s1[0]-x,s1[1]-y)<r+10);
  for(let i=1;i<Q.length-1;i++){const q=Q[i];for(const c of A){if(skip.includes(c))continue;const [x,y,r]=c,dx=q[0]-x,dy=q[1]-y,dd=Math.hypot(dx,dy);
    if(dd<r){const k=dd>0.01?dd:1,ux=dd>0.01?dx/k:0,uy=dd>0.01?dy/k:1,e=Math.min(1,Math.min(i,Q.length-1-i)/5);q[0]+=ux*(r-dd)*e;q[1]+=uy*(r-dd)*e;}}}
  P=Q;for(let it=0;it<2;it++){const N=[P[0]];for(let i=0;i<P.length-1;i++){const a=P[i],b=P[i+1];N.push([a[0]*.75+b[0]*.25,a[1]*.75+b[1]*.25],[a[0]*.25+b[0]*.75,a[1]*.25+b[1]*.75]);}N.push(P[P.length-1]);
    const M=[N[0]];for(let i=1;i<N.length;i++){const m=M[M.length-1];if(Math.hypot(N[i][0]-m[0],N[i][1]-m[1])>=4||i===N.length-1)M.push(N[i]);}P=M;}
  return P;}

/* ---------- 1人の買い物を、見せるための段取りにする（計算の出来事は変えない） ----------
   e：buy の出来事（t 会計の始め・wait 並んだ分・stay 店にいた分・end 会計の終わり・lane f 有人／s セルフ・items）
   o：{idx 出来事の番号, day, ev その日の出来事の列, genreOf(pid), nameOf(pid)} */
function plan(S,e,o){
  if(!e||e.k!=='buy'||!fin(e.t)||!fin(e.end)||!fin(e.wait)||!fin(e.stay))return null;
  const key=(o.day||0)+'|'+(o.idx||0),R=n=>hash(key+'|'+n),lane=e.lane==='s'?'s':'f',miss=new Set();
  const ta=e.t-e.wait-e.stay,tq=e.t-e.wait,ts=e.t,te=Math.max(e.end,e.t+0.02);
  const items=(e.items||[]).map(([pid,n])=>({pid,n,genre:o.genreOf?o.genreOf(pid):null,name:o.nameOf?o.nameOf(pid):pid}));
  /* 棚を回る：ジャンルごとに1か所（最大3か所）。店員が取る品（ホットスナック・たばこ）は棚へ行かない */
  const stops=[],seen=new Set();
  for(const it of items){const sp=S.spots[it.genre];
    if(!sp){miss.add((it.name||it.pid)+'の棚の場所');continue;}
    if(sp.staff){it.staff=sp.staff;miss.add(sp.staff==='hot'?'店員がホットスナックを取る絵':'店員がうしろの棚から取る絵');continue;}
    if(seen.has(it.genre)||stops.length>=3){const st=stops.find(s=>s.genre===it.genre)||stops[stops.length-1];st.items.push(it);continue;}
    seen.add(it.genre);const r=R('x'+it.genre);
    stops.push({genre:it.genre,p:[Math.round(pick(r,sp.x)),Math.round(pick(R('y'+it.genre),sp.y))],on:sp.on,dir:sp.dir??0,reach:!!sp.reach,items:[it]});}
  for(const st of stops)st.hes=!!st.reach&&R('hes'+st.genre)<((S.wander||{}).hesitate??0.4);   /* 買う棚で迷う（手を伸ばしかけて戻す） */
  /* 回る順（2026-11-13 ユーザーのメモ）：まず目当ての品（いちばん初めの品）。ついで買いの品は、そのあと近い順に */
  if(stops.length>1){const main=stops.find(x=>x.items.includes(items.find(it=>!it.staff)))||stops[0],rest=stops.filter(x=>x!==main),ord=[main];let c0=main.p;
    while(rest.length){let bi=0,bd=Infinity;rest.forEach((x,i)=>{const dd=Math.hypot(x.p[0]-c0[0],x.p[1]-c0[1]);if(dd<bd){bd=dd;bi=i;}});const x=rest.splice(bi,1)[0];ord.push(x);c0=x.p;}stops.length=0;stops.push(...ord);}
  /* 道：入口 → 棚 → … → 列（または直接レジ） */
  const W=S.walkPxPerMin||1500,segs=[];let cur='in0';
  const legs=[],extraNodes=stops.map((st,i)=>({id:'_s'+i,p:st.p,on:st.on}));
  stops.forEach((st,i)=>{const id='_s'+i;legs.push(route(natural(S,shortest(S,cur,id,extraNodes),R,'L'+i)));cur=id;});
  const reg=lane==='s'?S.self:S.register,qBase=reg.queue,qStep=reg.queueStep||[-34,0],qMax=reg.queueMax||4;
  /* 列の前にいる人（同じレジ・自分より前に並んだ人で、まだ会計を始めていない人）：数だけ。姿は描かない */
  const others=(o.ev||[]).filter((b,i)=>i!==o.idx&&b.k==='buy'&&(b.lane==='s'?'s':'f')===lane&&fin(b.wait)&&fin(b.t)&&b.t-b.wait<tq&&b.t>tq-1e-9);
  const ahead=t=>others.reduce((n,b)=>n+(b.t-b.wait<=t&&b.t>t?1:0),0);
  const qPoint=t=>{const k=Math.min(qMax,ahead(t));return [qBase[0]+qStep[0]*k,qBase[1]+qStep[1]*k];};
  const apDist=Math.hypot(reg.stand[0]-qBase[0],reg.stand[1]-qBase[1]),noQ=e.wait<apDist/W+0.03;   /* ほとんど待たない人は、列に立たずにそのままレジへ */
  const toQ=shortest(S,cur,reg.via,extraNodes);toQ.push(noQ?reg.stand:qPoint(tq));legs.push(route(natural(S,toQ,R,'Q')));
  /* 気になるコーナー（attract）：前へ歩きながら、顔だけそちらへ向ける（ちらっと見る・少しゆっくりになる）。
     買ってしまいそうなときは、立ち止まって手に取る（tempt・買わずに戻す）。急いでいる人は見ない */
  const AT=S.attract||[],gz=legs.map(()=>null);let nGz=0;
  if(!e.rush)legs.forEach((l,i)=>{if(nGz>=3)return;const end=l.points[l.points.length-1];
    for(const [k,at] of AT.entries()){if(R('at'+i+'|'+k)>=(at.p||0))continue;if(Math.hypot(end[0]-at.at[0],end[1]-at.at[1])<at.r*0.7)continue;
      let best=Infinity,bd=0;const N=Math.ceil(l.length/10);for(let j=0;j<=N;j++){const q=l.at(j/N),dd=Math.hypot(q.x-at.at[0],q.y-at.at[1]);if(dd<best){best=dd;bd=q.dist;}}
      if(best>at.r||bd<30||bd>l.length-30)continue;gz[i]={d:bd,at,tempt:R('tp'+i+'|'+k)<(at.tempt||0)};nGz++;return;}});
  /* 店の中の時間（stay）を、歩く・見る・手を伸ばすに分ける。足りなければ、歩く速さを上げる */
  const GW=(S.gaze||{}).half||45,GK=(S.gaze||{}).slow||0.6,effLen=(l,g)=>l.length+(g?Math.min(l.length,2*GW)*(1/GK-1):0);
  const walkMin=legs.reduce((a,l,i)=>a+effLen(l,gz[i])/W,0),reachMin=stops.reduce((a,s)=>a+(s.reach?(S.reachMin||0.12)+(S.takeMin||0.06):0.08),0);
  const room=Math.max(0.05,e.stay),need=walkMin+reachMin,TP=(S.gaze||{}).tempt||[0.12,0.25];
  let tpN=0;for(const g of gz)if(g&&g.tempt){g.dur=pick(R('tpd'+g.at.label),TP);tpN+=g.dur;}
  if(need+tpN>room){for(const g of gz)if(g)g.tempt=false;tpN=0;}   /* 立ち止まる時間がなければ、ちらっと見るだけ */
  let wk=1,browse=0;
  if(need>room)wk=room/need;else browse=(room-need-tpN)/Math.max(1,stops.length);
  /* 歩く1区間：道 r の d0〜d1 を、気になるところ（g）のまわりだけゆっくり */
  const walkSeg=(t0,l,d0,d1,g,ph)=>{const w=g?[clamp(g.d-GW,d0,d1),clamp(g.d+GW,d0,d1)]:[d1,d1],E=(d1-d0)+(w[1]-w[0])*(1/GK-1),d=E/W*wk;
    segs.push({kind:'walk',a:t0,b:t0+d,r:l,d0,d1,w,E,gaze:g&&!g.tempt?g.at:null,ph});return t0+d;};
  let t=ta;
  legs.forEach((l,i)=>{const ph=i<stops.length?'walk':'toQueue',g=gz[i];
    if(g&&g.tempt){t=walkSeg(t,l,0,g.d,null,ph);const q=l.at(g.d/l.length),vx=g.at.at[0]-q.x,vy=g.at.at[1]-q.y,dir=Math.abs(vx)>Math.abs(vy)?(vx>0?2:3):(vy>0?1:0);
      segs.push({kind:'stand',a:t,b:t+g.dur,p:[q.x,q.y],dir,ph:'tempt',touch:dir===0&&!!g.at.reach,at:g.at});t+=g.dur;t=walkSeg(t,l,g.d,l.length,null,ph);}
    else t=walkSeg(t,l,0,l.length,g,ph);
    const st=stops[i];if(!st)return;
    const rm=(st.reach?(S.reachMin||0.12):0.04)*wk,tk=(st.reach?(S.takeMin||0.06):0.04)*wk;
    segs.push({kind:'stand',a:t,b:t+browse,p:st.p,dir:st.dir,ph:'browse',stop:i,hes:st.hes});t+=browse;
    segs.push({kind:'stand',a:t,b:t+rm,p:st.p,dir:st.dir,ph:st.reach?'reach':'look',stop:i});t+=rm;
    segs.push({kind:'stand',a:t,b:t+tk,p:st.p,dir:st.dir,ph:'take',stop:i,pick:i});t+=tk;});
  if(t<tq-1e-9){if(noQ)segs.push({kind:'stand',a:t,b:tq,p:reg.stand,dir:0,ph:'wait'});else segs.push({kind:'queue',a:t,b:tq,ph:'queue'});}   /* 棚に寄らない人（ホットスナックだけ等）は、レジの前で待つ */
  if(segs.length)segs[segs.length-1].b=tq;
  /* 列：tq〜ts。最後に呼ばれてレジの前へ */
  if(noQ){if(ts>tq)segs.push({kind:'stand',a:tq,b:ts,p:reg.stand,dir:0,ph:'wait'});}
  else{const ap=Math.max(apDist/W,Math.min(e.wait*0.5,S.approachMin||0.15)),apAt=Math.max(tq,ts-ap);
    if(apAt>tq)segs.push({kind:'queue',a:tq,b:apAt,ph:'queue'});
    segs.push({kind:'walk',a:apAt,b:ts,r:route([qPoint(apAt),reg.stand]),ph:'approach'});}
  segs.push({kind:'stand',a:ts,b:te,p:reg.stand,dir:0,ph:'pay'});
  /* 会計のあと：有人レジは横へよけて持ち直す。レンジ・イートインがあれば寄る。そして出口へ */
  t=te;let after=reg.stand;
  if(lane==='f'){const r=route([reg.stand,reg.pack]),d=r.length/W;segs.push({kind:'walk',a:t,b:t+d,r,ph:'aside'});t+=d;
    segs.push({kind:'stand',a:t,b:t+(S.packMin||0.1),p:reg.pack,dir:1,ph:'pack'});t+=S.packMin||0.1;after=reg.pack;}
  const from2=+te.toFixed(2),ps=e.ps;
  const rg=(o.ev||[]).find(x=>x.k==='range'&&x.ps===ps&&Math.abs(x.from-from2)<0.011);
  if(rg){const d=Math.max(0.3,(rg.t-te)+1);segs.push({kind:'stand',a:t,b:t+d,p:after,dir:0,ph:'range'});t+=d;miss.add('店員がレンジで温める絵');}
  const eat=(o.ev||[]).find(x=>x.k==='eatin'&&x.ps===ps&&Math.abs(x.from-from2)<0.011);
  const full=(o.ev||[]).find(x=>x.k==='eatfull'&&x.ps===ps&&Math.abs(x.from-from2)<0.011);
  if(eat){const E=S.eat,p=eat.sit?E.sit:E.stand,via=eat.sit?E.via:(E.viaStand||E.via);const r=route(natural(S,[after,...shortest(S,near(S,after),via),p],R,'E')),d=r.length/W;
    segs.push({kind:'walk',a:t,b:t+d,r,ph:'toEat'});t+=d;
    const dur=Math.max(0.5,(eat.to||eat.t+8)-Math.max(eat.t,t));segs.push({kind:'stand',a:t,b:t+dur,p,dir:eat.sit?E.sitDir:E.standDir,ph:eat.sit?'sit':'eat'});t+=dur;
    after=p;
    const r2=route(natural(S,[p,...shortest(S,via,S.exit)],R,'X2')),d2=r2.length/W;segs.push({kind:'walk',a:t,b:t+d2,r:r2,ph:'exit'});t+=d2;}
  else{const r=route(natural(S,[after,...shortest(S,near(S,after),S.exit)],R,'X')),d=r.length/W;segs.push({kind:'walk',a:t,b:t+d,r,ph:'exit'});t+=d;}
  /* 払い方（表示用・仮）：決まった乱数 */
  const P=S.pay||{},u=R('pay');const pay=u<(P.cash||0)?'cash':u<(P.cash||0)+(P.card||0)?'card':'phone';
  const hot=(S.attract||[]).find(a=>a.queue);if(hot&&lane==='f'&&R('hotq')<(hot.p||0))for(const sg of segs)if(sg.ph==='queue'||(sg.ph==='wait'&&sg.a<ts))sg.gaze=hot;   /* 列に並ぶと、レジ横のホットスナックが目に入る */
  return {key,idx:o.idx,e,ps:e.ps,lane,ta,tq,ts,te,end:t,segs,stops,items,pay,miss,ahead,qPoint,full:!!full,eat:!!eat};}

/* その時刻の姿：{x,y,dir,ph,dist,reach,held:[品],paid} */
function pose(pl,t){
  const s=pl.segs.find(s=>t<s.b)||pl.segs[pl.segs.length-1],o={ph:s.ph,dir:1,dist:0,reach:0,seg:s};
  if(s.kind==='walk'){const u=s.b>s.a?clamp((t-s.a)/(s.b-s.a),0,1):1;let dist;
    if(s.E!=null){const e2=u*s.E,K=(s.E-(s.d1-s.d0))/Math.max(1e-9,s.w[1]-s.w[0])+1,pre=s.w[0]-s.d0,mid=(s.w[1]-s.w[0])*K;   /* 気になるところのまわりは、ゆっくり */
      dist=e2<=pre?s.d0+e2:e2<=pre+mid?s.w[0]+(e2-pre)/K:s.w[1]+(e2-pre-mid);}else dist=u*s.r.length;
    Object.assign(o,s.r.at(s.r.length?dist/s.r.length:1));o.mv=t<s.b&&t>=s.a;if(s.gaze&&dist>=s.w[0]&&dist<=s.w[1])o.gaze=s.gaze;}
  else if(s.kind==='queue'){const q=pl.qPoint(t);o.x=q[0];o.y=q[1];o.dir=2;o.ahead=pl.ahead(t);if(s.gaze)o.gaze=s.gaze;}   /* 列はレジの左に横に並ぶので、右（レジ）を向く */
  else{o.x=s.p[0];o.y=s.p[1];o.dir=s.dir;if(s.gaze)o.gaze=s.gaze;if(s.at)o.gaze=s.at;o.u=s.b>s.a?clamp((t-s.a)/(s.b-s.a),0,1):1;if(s.ph==='reach')o.reach=o.u;if(s.ph==='take')o.reach=1;}
  if(t>=pl.segs[pl.segs.length-1].b)o.ph='done';
  /* 手に持っている品：取ったあと（店員が取る品は会計のとき） */
  const held=[];pl.stops.forEach((st,i)=>{const tk=pl.segs.find(x=>x.pick===i);if(tk&&t>=tk.b-1e-9)held.push(...st.items);});
  if(t>=pl.ts)for(const it of pl.items)if(it.staff&&!held.includes(it))held.push(it);
  o.held=held;o.paid=t>=pl.te;return o;}

/* その時刻までに会計を終えた買い物のうち、まだ見せていない、いちばん新しい人 */
function choose(ev,Tn,played){let best=-1;
  (ev||[]).forEach((e,i)=>{if(e.k!=='buy'||!fin(e.end)||!fin(e.stay)||!fin(e.wait)||e.end>Tn||played.has(i))return;if(best<0||e.end>ev[best].end)best=i;});
  return best;}

const API={hash,shortest,route,plan,pose,choose};
if(typeof document==='undefined'){root.KioskScene=API;return;}

/* =====================================================================
   画面（ブラウザだけ）
   ===================================================================== */
const U={S:null,F:null,img:{},bg:null,loading:null,err:null,el:null,cv:null,cap:null,pl:null,clock:0,played:new Set(),resRef:null,
  close:null,paused:false,cam:null,lastCap:'',idleCheck:0,people:[],staff:null,still:false};
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);
const fmt=t=>{const s=Math.floor(t*60+1e-6);return Math.floor(s/3600)%24+':'+String(Math.floor(s/60)%60).padStart(2,'0');};
function loadImg(src){return new Promise(ok=>{const im=new Image();im.onload=()=>ok(im);im.onerror=()=>ok(null);im.src=src;});}
function load(){if(U.loading)return U.loading;
  U.loading=(async()=>{try{
    U.S=await (await fetch('data/kiosk-scene.json')).json();const S=U.S,D=S.dir;
    for(const b of S.background){const im=await loadImg(D+b);if(im){U.bg=im;U.bgName=b;break;}}
    if(!U.bg)throw new Error('背景の絵が読めません');
    const fr={};
    U.people=await Promise.all(S.people.map(async p=>{const P={def:p,sh:{},fr:null};
      if(p.frames){if(!fr[p.frames])fr[p.frames]=await fetch(D+p.frames).then(r=>r.ok?r.json():null).catch(()=>null);P.fr=fr[p.frames];}
      await Promise.all(Object.entries(p.sheets).map(async([k,f])=>{if(!U.img[f])U.img[f]=loadImg(D+f);const im=await U.img[f];if(im)P.sh[k]=im;}));
      return P;}));
    if(S.staff){const P={def:S.staff,sh:{}};await Promise.all(Object.entries(S.staff.sheets).map(async([k,f])=>{const im=await loadImg(D+f);if(im)P.sh[k]=im;}));U.staff=P;}
    if(!U.people[0]||!U.people[0].sh.walk)throw new Error('人の絵が読めません');
  }catch(e){U.err=e.message||String(e);}})();
  return U.loading;}
/* 絵の1コマ：frames.json の人は切り出し位置、grid の人はマス目 */
function frameOf(P,key,i){const im=P.sh[key];if(!im)return null;
  if(P.fr){const f=P.fr,[a,b]=key.split(':');const L=a==='walk'?f.walk:a==='reach'?f.reach:a==='carry'?(f.carry||{})[b]:a==='pay'?(f.payment||{})[b]:null;if(!L||!L.length)return null;const x=L[Math.min(i,L.length-1)];return {im,x:x.x,y:x.y,w:x.w,h:x.h,ax:x.anchor};}
  const g=P.def.grid,cw=g.cell[0],ch=g.cell[1],cols=Math.max(1,Math.floor(im.width/cw)),rows=Math.max(1,Math.floor(im.height/ch)),n=cols*rows,k=Math.min(i,n-1);
  return {im,x:(k%cols)*cw,y:Math.floor(k/cols)*ch,w:cw,h:g.foot[1],ax:g.foot[0],hs:g.body||g.foot[1]};}   /* hs：頭から足までの高さ（絵の人の大きさをそろえる） */
function personFor(ps){const i=U.people.findIndex(P=>(P.def.ps||[]).includes(ps)&&P.sh.walk);return i>=0?{P:U.people[i],sub:false}:{P:U.people[0],sub:true};}

/* ---------- 描く ---------- */
function sizeAt(y){const z=U.S.size;return z.base+Math.max(0,y-z.y0)*z.k;}
function sprite(c,f,x,y,h,alpha){if(!f)return;const s=h/(f.hs||f.h);c.globalAlpha=alpha==null?1:alpha;c.drawImage(f.im,f.x,f.y,f.w,f.h,x-f.ax*s,y-f.h*s,f.w*s,f.h*s);c.globalAlpha=1;}
function drawPerson(c,pl,o,miss){const S=U.S,{P,sub}=personFor(pl.ps),h=sizeAt(o.y),fr=(k,i)=>frameOf(P,k,i);
  if(sub)miss.add('この客層の絵（'+P.def.name+'の絵で代わり）');
  let drink=o.held.find(it=>S.carryAs[it.genre]||P.sh['carry:'+it.pid]),other=o.held.find(it=>it!==drink);
  let ck=drink?(P.sh['carry:'+drink.pid]?'carry:'+drink.pid:'carry:'+S.carryAs[drink.genre]):null;
  if(ck&&!P.sh[ck]){ck=null;other=other||drink;drink=null;}   /* 飲み物を持つ絵がない人は、ほかの品と同じ「持つ」絵で */
  if(drink&&ck&&ck!=='carry:'+drink.pid)miss.add(drink.name+'を持つ絵（'+(ck.endsWith('cf_black')?'缶コーヒー':'スポーツドリンク')+'で代わり）');
  if(other&&!P.sh.hold)miss.add((other.name||'品')+'を持つ絵');
  const step=[0,1,1,2,3,3][Math.floor((o.dist||0)/11)%6];   /* 足をそろえたコマを長めに（店の中は小股に見せる・2026-11-13） */
  c.fillStyle='rgba(60,50,34,.17)';c.beginPath();c.ellipse(o.x+h*.23,o.y+h*.16,h*.36,9,.56,0,7);c.fill();
  c.fillStyle='rgba(61,52,37,.16)';c.beginPath();c.ellipse(o.x,o.y+1,16,5,0,0,7);c.fill();
  const ph=o.ph;
  if((ph==='sit'||ph==='eat')&&P.sh[ph==='sit'?'sit':'eat']){sprite(c,fr(ph==='sit'?'sit':'eat',Math.floor((o.u||0)*40)%2),o.x,o.y,h);return;}   /* 座る・食べる絵（届いたら） */
  if(ph==='sit'||ph==='eat')miss.add(ph==='sit'?'座って食べる絵':'立って食べる絵');
  if(ph==='pay'&&pl.lane==='s'&&!P.sh['pay-self']&&P.sh.reach){const u=o.u||0,pos=u<.25?u/.25:u<.75?1:Math.max(0,1-(u-.75)/.25);   /* セルフレジ：画面にふれる（手を伸ばす絵で代わり） */
    miss.add('セルフレジで払う絵（画面にふれる絵で代わり）');sprite(c,fr('reach',0),o.x,o.y,h);if(pos>0)sprite(c,fr('reach',1),o.x,o.y,h,pos);return;}
  if(ph==='pay'&&pl.lane==='s'&&P.sh['pay-self']){const u=o.u||0;sprite(c,fr('pay-self',Math.min(3,Math.floor(u*4))),o.x,o.y,h);return;}
  if(ph==='pay'&&P.sh['pay-'+pl.pay]){const u=o.u||0;sprite(c,fr('pay-'+pl.pay,u<.18?0:u<.4?1:u<.72?2:3),o.x,o.y,h);return;}   /* 現金・スマホで払う絵（届いたら） */
  if(ph==='pay'){const pk=ck?'pay:'+ck.slice(6):P.sh.pay?'pay':'pay:cf_black';const pf=fr(pk,0)?pk:(P.sh.pay?'pay':Object.keys(P.sh).find(k=>k.startsWith('pay:')));
    if(pl.pay!=='card'&&!P.sh['pay-'+pl.pay])miss.add(pl.pay==='cash'?'現金で払う絵（カードの絵で代わり）':'スマホで払う絵（カードの絵で代わり）');
    if(!ck&&pf&&pf!=='pay')miss.add('品を持たずに払う絵（飲み物を持った絵で代わり）');
    const u=o.u||0,k=u<.18?0:u<.4?1:u<.72?2:3;if(pf){sprite(c,fr(pf,k),o.x,o.y,h);return;}}
  if((ph==='reach'||ph==='take')&&!P.sh.reach)miss.add('手を伸ばす絵');
  if(ph==='tempt'&&o.dir!==0)miss.add('横の棚の品を手に取る絵');
  if(o.gaze&&o.mv)miss.add('歩きながら横を見る絵（吹き出しで代わり）');
  if((ph==='tempt'||ph==='browse')&&o.dir===0&&P.sh.reach&&!ck){const sg=o.seg||{},u=o.u||0,w=(sg.touch||sg.hes)?Math.sin(Math.PI*clamp((u-.3)/.45,0,1)):0;   /* 寄り道で手に取って戻す・買う棚で迷う */
    sprite(c,fr('reach',0),o.x,o.y,h);if(w>0)sprite(c,fr('reach',1),o.x,o.y,h,w);return;}
  if((ph==='reach'||ph==='take'||(ph==='browse'&&!ck))&&o.dir===0&&P.sh.reach){const pos=ph==='take'?2+Math.min(1,o.u||0):ph==='reach'?(o.reach||0)*2:0,a=Math.floor(pos),b=Math.min(3,a+1),f=pos-a;
    sprite(c,fr('reach',a),o.x,o.y,h);if(f>0)sprite(c,fr('reach',b),o.x,o.y,h,f);return;}
  if(ck&&ph!=='walk'&&ph!=='toQueue'&&ph!=='approach'&&ph!=='aside'&&ph!=='exit'&&ph!=='toEat'&&o.dir===0){const pk='pay:'+ck.slice(6);if(P.sh[pk]){sprite(c,fr(pk,0),o.x,o.y,h);return;}}
  const moving=!!o.mv,i=o.dir*4+(moving?step:1);
  if(ck){sprite(c,fr(ck,o.dir*4+(moving?step:1)),o.x,o.y,h);return;}
  if(other&&P.sh.hold){sprite(c,fr('hold',i),o.x,o.y,h);return;}
  sprite(c,fr('walk',i),o.x,o.y,h);
  if(other){c.fillStyle='rgba(255,255,255,.9)';c.strokeStyle='#5b6b66';c.lineWidth=1.2;const bx=o.x+(o.dir===3?-h*.2:h*.14),by=o.y-h*.42;c.beginPath();c.roundRect(bx-6,by-7,12,13,2);c.fill();c.stroke();}}
function drawStaff(c,pl,o){const P=U.staff;if(!P||!P.sh.idle||U.bgName===U.S.background[U.S.background.length-1])return;
  const d=P.def,h=sizeAt(d.at[1]);let k='idle',i=0;
  if(o&&o.ph==='pay'&&pl.lane==='f'){const hot=pl.items.some(it=>it.staff==='hot');k=hot&&(o.u||0)<.3&&P.sh.hot?'hot':(o.u||0)<.7&&P.sh.scan?'scan':P.sh.bag?'bag':'idle';i=Math.floor((o.u||0)*8)%4;}
  sprite(c,frameOf(P,k,i),d.at[0],d.at[1],h);
  if(d.cover){const [x,y,w,hh]=d.cover,kx=U.bg.width/U.S.width,ky=U.bg.height/U.S.height;c.drawImage(U.bg,x*kx,y*ky,w*kx,hh*ky,x,y,w,hh);}}   /* カウンターの前の面を上からかぶせて、店員の下半身をかくす */
function draw(dt){const S=U.S,c=U.cv.getContext('2d'),W=U.cv.width,H=U.cv.height,pl=U.pl,miss=pl?pl.miss:new Set();   /* まだ絵がないもの：その人を見せているあいだ、ためていく */
  const o=pl?pose(pl,U.clock):null;
  const close=U.close,tw=close?620:S.width,vh=tw*H/W,px=o?o.x:S.width/2,py=o?o.y-sizeAt(o.y)*.5:S.height/2;
  const tx=close?clamp(px+40,tw/2,S.width-tw/2):S.width/2,ty=close?clamp(py,vh/2,S.height-vh/2):S.height/2;
  if(!U.cam)U.cam={x:tx,y:ty,w:tw};const bl=dt?1-Math.exp(-4*dt):1;U.cam.x+=(tx-U.cam.x)*bl;U.cam.y+=(ty-U.cam.y)*bl;U.cam.w+=(tw-U.cam.w)*bl;
  const sc=close?W/U.cam.w:Math.min(W/S.width,H/S.height);
  c.setTransform(1,0,0,1,0,0);c.fillStyle='#e5d6bd';c.fillRect(0,0,W,H);
  c.translate(W/2,H/2);c.scale(sc,sc);c.translate(close?-U.cam.x:-S.width/2,close?-U.cam.y:-S.height/2);
  c.drawImage(U.bg,0,0,S.width,S.height);
  /* カードの読み取り機と、列の床の印 */
  const R=S.register;   /* カードの読み取り機は背景の絵にあるので、前の試作の四角は描かない */
  c.strokeStyle='rgba(193,199,175,.95)';c.lineWidth=3;c.setLineDash([5,5]);for(const q of [R.queue,S.self.queue]){c.beginPath();c.moveTo(q[0]-16,q[1]+3);c.lineTo(q[0]+16,q[1]+3);c.stroke();}c.setLineDash([]);
  drawStaff(c,pl,o);
  if(o&&o.ph!=='done'){drawPerson(c,pl,o,miss);
    const h=sizeAt(o.y);for(const s of S.occluders)if(o.y<s.front&&o.x+h*.3>s.x&&o.x-h*.3<s.x+s.w){const kx=U.bg.width/S.width,ky=U.bg.height/S.height;c.drawImage(U.bg,s.x*kx,s.y*ky,s.w*kx,s.h*ky,s.x,s.y,s.w,s.h);}
    if(o.gaze){const g=o.gaze,sd=g.at[0]>=o.x?1:-1,bx=o.x+sd*h*.2,by=o.y-h-4;   /* ちらっと見る（顔だけそちらへ）：頭の横に小さな吹き出し。しっぽは見ている棚のほうへ */
      c.font='700 13px sans-serif';const tx4=o.ph==='tempt'?'気になる…':'ちらっ',w=c.measureText(tx4).width+12,x0=sd>0?bx:bx-w;
      c.fillStyle='rgba(255,252,240,.95)';c.strokeStyle='rgba(90,80,60,.55)';c.lineWidth=1;c.beginPath();c.roundRect(x0,by-18,w,19,6);c.fill();c.stroke();
      const ang=Math.atan2(g.at[1]-(by-8),g.at[0]-(x0+w/2)),tx5=x0+w/2+Math.cos(ang)*(w/2+7),ty5=by-8+Math.sin(ang)*15;
      c.beginPath();c.moveTo(x0+w/2+Math.cos(ang)*(w/2-4)-Math.sin(ang)*4,by-8+Math.sin(ang)*8+Math.cos(ang)*4);c.lineTo(tx5,ty5);c.lineTo(x0+w/2+Math.cos(ang)*(w/2-4)+Math.sin(ang)*4,by-8+Math.sin(ang)*8-Math.cos(ang)*4);c.closePath();c.fill();
      c.fillStyle='#5a4a2a';c.textAlign='center';c.fillText(tx4,x0+w/2,by-4);}
    if(o.ph==='queue'&&o.ahead>0){c.font='700 15px sans-serif';const tx3=`前に${o.ahead}人`;const w=c.measureText(tx3).width+12;c.fillStyle='rgba(255,250,238,.92)';c.beginPath();c.roundRect(o.x-w/2,o.y-h-26,w,20,5);c.fill();c.fillStyle='#3b4a46';c.textAlign='center';c.fillText(tx3,o.x,o.y-h-11);}}
  c.setTransform(1,0,0,1,0,0);
  /* 左上：見ている時刻 */
  c.fillStyle='rgba(15,20,24,.78)';c.beginPath();c.roundRect(10,10,pl?230:300,30,6);c.fill();c.fillStyle='#ffd08a';c.font='700 17px sans-serif';c.textAlign='left';
  c.fillText(pl?('再生 '+fmt(U.clock)+(U.fast?'（早送り）':'')):'次のお客さんを待っています',20,31);
  caption(pl,o,miss);}
const PH={walk:'棚へ歩いています',tempt:'気になって立ち止まり、手に取ってみます（買わずに戻す）',browse:'棚の品を見ています',reach:'手を伸ばして取ります',look:'棚の品を手に取ります',take:'品を取りました',toQueue:'レジへ向かいます',queue:'列で順番を待っています',approach:'呼ばれてレジの前へ',wait:'レジの前で、前の人の会計が終わるのを待ちます',pay:'会計しています',aside:'次の人のために、横へよけます',pack:'品を持ち直します',range:'お弁当を温めてもらっています',toEat:'イートインの席へ',eat:'立ち席で食べています',sit:'席に座って食べています',exit:'店を出ます',done:'店を出ました'};
const PAYN={cash:'現金',card:'カード',phone:'スマホ'};
function caption(pl,o,miss){if(!U.cap)return;let h;
  if(!pl)h=`<b>次のお客さんを待っています。</b><span>この店で会計を終えた人が出ると、その人を再生します（売店の計算の記録から）。</span>`;
  else{const PS=U.psName||{},e=pl.e,its=pl.items.map(it=>esc(it.name)+(it.n>1?'×'+it.n:'')).join('・');
    h=`<b>さっきのお客さん：${esc(PS[pl.ps]||pl.ps)}</b>　${fmt(pl.ta)} 来店 → ${fmt(pl.ts)} 会計（${pl.lane==='s'?'セルフレジ':'有人レジ'}・待ち ${Math.round(e.wait*60)}秒・${PAYN[pl.pay]}<i>仮</i>）・¥${Math.round(e.yen||0).toLocaleString('ja-JP')}<br><span>${its}</span>`+
      `<br><span class="st">いま：${PH[o?o.ph:'done']||''}${o&&o.gaze&&o.ph!=='tempt'?'（'+esc(o.gaze.label)+'をちらっと見ながら）':''}${o&&o.ph==='tempt'?'（'+esc(o.gaze.label)+'）':''}${o&&o.ph==='queue'&&o.ahead?'（前に'+o.ahead+'人・姿はまだ）':''}</span>`+
      (miss.size?`<br><small>まだ絵がない：${[...miss].map(esc).join('／')}</small>`:'');}
  if(h!==U.lastCap){U.lastCap=h;U.cap.innerHTML=h;}}

/* ---------- 次の人を選ぶ ---------- */
function next(res,Tn,cfg){const ev=res&&res.ev;if(!ev){U.pl=null;return;}
  if(U.resRef!==ev){U.resRef=ev;U.played=new Set();}
  const i=choose(ev,Tn,U.played);if(i<0){U.pl=null;return;}
  U.played.add(i);const P={};for(const p of cfg.products||[])P[p.id]=p;
  U.psName={};for(const p of cfg.personas||[])U.psName[p.id]=p.name||p.short||p.id;
  const pl=plan(U.S,ev[i],{idx:i,day:res.day,ev,genreOf:id=>P[id]&&P[id].genre,nameOf:id=>P[id]?P[id].name:id});
  if(!pl){U.pl=null;return;}U.pl=pl;U.clock=pl.ta;U.cam=null;}

/* ---------- 外から呼ぶもの ---------- */
function mount(el){if(U.el===el&&el.isConnected)return;U.el=el;
  if(U.close===null)U.close=innerWidth<900;
  el.innerHTML=`<div class="kc-wrap"><canvas width="1000" height="600" aria-label="港駅の店の動く試作（ユーザーが ChatGPT に描いてもらった絵）。さっき買い物を終えたお客さんを再生します"></canvas><p class="kc-load">試作の絵を読み込んでいます…</p></div>
    <div class="kc-bar"><button type="button" class="ks-chip" data-k="zoom"></button><button type="button" class="ks-chip" data-k="pause">一時停止</button><button type="button" class="ks-chip" data-k="next">次の人へ</button><button type="button" class="ks-chip" data-k="still" aria-pressed="false">止まった完成イメージ</button></div>
    <div class="kc-cap" aria-live="off"></div><img class="kc-still" hidden alt="港駅の売店の完成イメージ（ユーザーの絵）" loading="lazy">`;
  U.cv=el.querySelector('canvas');U.cap=el.querySelector('.kc-cap');U.lastCap='';U.cam=null;
  const z=el.querySelector('[data-k=zoom]'),zl=()=>{z.textContent=U.close?'店ぜんぶを見る':'客を大きく見る';};zl();
  z.onclick=()=>{U.close=!U.close;zl();};
  const pz=el.querySelector('[data-k=pause]');pz.onclick=()=>{U.paused=!U.paused;pz.textContent=U.paused?'再生':'一時停止';};
  el.querySelector('[data-k=next]').onclick=()=>{U.skip=true;};
  const sb=el.querySelector('[data-k=still]'),im=el.querySelector('.kc-still');
  sb.onclick=()=>{U.still=!U.still;sb.setAttribute('aria-pressed',String(U.still));if(U.still&&!im.src)im.src='assets/images/minato-store-concept.webp';im.hidden=!U.still;};
  load().then(()=>{const L=el.querySelector('.kc-load');if(L){if(U.err)L.textContent='試作の絵を読み込めませんでした（'+U.err+'）';else L.remove();}});}
function unmount(){U.el=null;U.cv=null;U.cap=null;}
/* 売店の画面の絵と一緒に呼ばれる（dt 秒・Tn ゲームの分・res その日の計算・cfg 店の設定） */
function tick(dt,Tn,res,cfg){if(!U.el||!U.cv||!U.el.isConnected||!U.S||!U.bg||U.err)return;
  if(U.skip){U.skip=false;U.pl=null;}
  if(!U.pl){U.idleCheck-=dt;if(U.idleCheck<=0||!U.drawnIdle){U.idleCheck=1;next(res,Tn,cfg||{});if(!U.pl){if(!U.drawnIdle){draw(0);U.drawnIdle=true;}return;}}}
  U.drawnIdle=false;
  if(!U.paused&&U.pl){const s=U.pl.segs.find(s=>U.clock<s.b);let rate=U.S.rate||3;
    if(s&&s.kind!=='walk'){const real=(s.b-s.a)*60/rate;if(real>(U.S.standMaxSec||6))rate=(s.b-s.a)*60/(U.S.standMaxSec||6);}
    U.fast=rate>(U.S.rate||3)+0.01;U.clock+=dt*rate/60;
    if(U.clock>=U.pl.end){draw(dt);U.pl=null;U.idleCheck=0;return;}}
  draw(dt);}
root.KioskScene=Object.assign(API,{mount,unmount,tick,load,get state(){return U;}});
})(typeof window==='undefined'?globalThis:window);
