/* =====================================================================
   描いた路線を時刻どおりに走らせる：計算の部分（DOM を使わない。node でも読める）
   お絵かき帖（route-editor.html）の保存 dia-routes から、1日の便を作り、
   乗り物ごとに「いつ・道のどこにいるか」を先に計算しておく（見た目だけ。乗客や売店の計算には使わない）。
   - 便：路線の freq（1時間に n 本／1日に n 本）・first・last・round（往復なら両はしから同じ時刻に出る）
   - 速さ：data/routes.json の run.speed（km/時。道の長さは地図の単位 → run.unitsPerKm で km に）
   - 停留所：止まれる台数（stop.cap → 種類の cap → run.cap）。空いていなければ手前で待ち、空いたら入る。
     2台以上止まれるところは前後にずらして並ぶ。道の上でも前の車に近づきすぎたら速度を落とす（追い越さない）。
   - 予定：その便が1台だけで走ったときの時刻。遅れ＝実際に着いた時刻 − 予定。
   1日の時刻は 0〜1440 分（0:00 から）。地図の時刻（4:30〜26:00）は 1440 で割った余りで引く。
   ===================================================================== */
(function(root){
'use strict';
const RC=root.RouteCore||(typeof require!=='undefined'?require('./route-core.js'):null);
const DEF={unitsPerKm:36.8,dt:0.25,speed:{bus:24,truck:30,ship:22,plane:220},accel:{bus:1.6,truck:1.4,ship:0.35,plane:2.2},
  dwell:{bus:0.5,truck:5,ship:10,plane:14},dwellStop:{plaza:1.2,center:8,kiosk:6,factory:8,pier:10,airport:14},
  lay:{bus:3,truck:4,ship:8,plane:10},cap:{bus:1,plaza:4,center:3,kiosk:1,factory:2,pier:1,airport:2},
  gap:{min:14,slow:25,slot:14,look:28},lead:30,maxTrips:160,giveUp:6};
const MEDIUM={bus:'road',truck:'road',ship:'sea',plane:'air'};
const hyp=(x,y)=>Math.sqrt(x*x+y*y);
const cfgOf=c=>{const o=JSON.parse(JSON.stringify(DEF));if(c)for(const k in c){if(c[k]&&typeof c[k]==='object'&&!Array.isArray(c[k]))o[k]=Object.assign(o[k]||{},c[k]);else if(k[0]!=='_')o[k]=c[k];}return o;};
const modeOf=(doc,l)=>{const t=RC.lineType(doc,l);const m=(t&&t.mode)||'bus';return MEDIUM[m]?m:'bus';};

/* ---------- 道すじ（折れ線） ---------- */
function mkPath(pts){const cum=[0];for(let i=1;i<pts.length;i++)cum.push(cum[i-1]+hyp(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]));return {pts,cum,len:cum[cum.length-1]};}
function at(P,s){const {pts,cum}=P,n=pts.length;if(n<2)return {x:pts[0][0],y:pts[0][1],ang:0};
  if(s<=0){const a=pts[0],b=pts[1];return {x:a[0],y:a[1],ang:Math.atan2(b[1]-a[1],b[0]-a[0])};}
  if(s>=P.len){const a=pts[n-2],b=pts[n-1];return {x:b[0],y:b[1],ang:Math.atan2(b[1]-a[1],b[0]-a[0])};}
  let lo=0,hi=n-1;while(hi-lo>1){const m=(lo+hi)>>1;if(cum[m]<=s)lo=m;else hi=m;}
  const a=pts[lo],b=pts[hi],L=cum[hi]-cum[lo]||1e-9,u=(s-cum[lo])/L;
  return {x:a[0]+(b[0]-a[0])*u,y:a[1]+(b[1]-a[1])*u,ang:Math.atan2(b[1]-a[1],b[0]-a[0])};}
// 向きは前後 r の点から（角でかくっと回らないように）
function pose(P,s,r){r=r||2.2;const p=at(P,s),a=at(P,Math.max(0,s-r)),b=at(P,Math.min(P.len,s+r));const dx=b.x-a.x,dy=b.y-a.y;return {x:p.x,y:p.y,ang:(dx||dy)?Math.atan2(dy,dx):p.ang};}

function arcPts(A,B){const dx=B.x-A.x,dy=B.y-A.y,len=hyp(dx,dy)||1,bend=Math.min(60,len*0.16),mx=(A.x+B.x)/2-dy/len*bend,my=(A.y+B.y)/2+dx/len*bend,o=[];
  for(let i=0;i<=24;i++){const t=i/24,u=1-t;o.push([u*u*A.x+2*u*t*mx+t*t*B.x,u*u*A.y+2*u*t*my+t*t*B.y]);}return o;}
// 路線1本の道すじ（行き）：両はしに入る・出るための短い線（lead）を足す。stops は止まる停留所だけ
function linePathPts(doc,l,adj,lead){const legs=RC.linePath(doc,l,adj);if(!legs.length)return null;
  const pts=[];const push=q=>{const L=pts[pts.length-1];if(!L||hyp(q[0]-L[0],q[1]-L[1])>0.05)pts.push([q[0],q[1]]);};
  const marks=[];   // seq の番号 → 点の番号
  const seqIdx=[];l.seq.forEach((it,i)=>{if(RC.itemNode(doc,it))seqIdx.push(i);});
  legs.forEach((g,gi)=>{const A=doc.nodes[g.a];if(gi===0){push([A.x,A.y]);marks.push(pts.length-1);}
    if(!g.edges){arcPts(A,doc.nodes[g.b]).slice(1).forEach(push);}
    else g.edges.forEach(x=>{let f=RC.edgeFlat(doc,doc.edges[x.id]).map(p=>[p.x,p.y]);if(x.rev)f=f.reverse();f.forEach(push);});
    const B=doc.nodes[g.b];push([B.x,B.y]);marks.push(pts.length-1);});
  if(pts.length<2)return null;
  // 両はしの lead
  const dir=(a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],L=hyp(dx,dy)||1;return [dx/L,dy/L];};
  const d0=dir(pts[0],pts[1]),d1=dir(pts[pts.length-2],pts[pts.length-1]);
  pts.unshift([pts[0][0]-d0[0]*lead,pts[0][1]-d0[1]*lead]);const last=pts[pts.length-1];pts.push([last[0]+d1[0]*lead,last[1]+d1[1]*lead]);
  const P=mkPath(pts);
  const stops=[];marks.forEach((pi,k)=>{const it=l.seq[seqIdx[k]];if(!it||!it.s||it.pass)return;stops.push({sid:it.s,s:P.cum[pi+1]});});
  return {P,stops};}
function reversePath(R){const pts=R.P.pts.slice().reverse(),P=mkPath(pts);return {P,stops:R.stops.slice().reverse().map(x=>({sid:x.sid,s:P.len-x.s}))};}

/* ---------- 便 ---------- */
function departures(l,max){const f=l.freq||{unit:'h',n:2};const a=RC.hm(l.first);let b=RC.hm(l.last);if(a==null)return [];if(b==null)b=a;if(b<a)b+=1440;
  const out=[];if(f.unit==='d'){const n=Math.max(0,f.n|0);if(n===1)out.push(a);else for(let i=0;i<n;i++)out.push(a+(b-a)*i/(n-1));}
  else{const n=+f.n;if(n>0){const h=60/n;for(let t=a;t<=b+1e-6&&out.length<max;t+=h)out.push(t);}}
  return out.slice(0,max).map(t=>Math.round(t*100)/100);}
function capOf(doc,sid,cfg){const s=doc.stops[sid];if(!s)return 1;if(s.cap>0)return s.cap|0;const t=doc.types.stop.find(x=>x.id===s.type);if(t&&t.cap>0)return t.cap|0;return cfg.cap[s.type]||1;}
function dwellOf(doc,sid,mode,cfg){const s=doc.stops[sid];const t=s&&doc.types.stop.find(x=>x.id===s.type);
  if(s&&s.dwell>0)return +s.dwell;if(t&&t.dwell>0)return +t.dwell;if(s&&cfg.dwellStop[s.type]!=null&&(STOPMODE[s.type]||mode)===mode)return cfg.dwellStop[s.type];return cfg.dwell[mode];}
// 拠点の種類ごとの止まる分は、その拠点の乗り物だけ（岸壁に着くバスは、ふつうのバスの分）
const STOPMODE={plaza:'bus',center:'truck',kiosk:'truck',factory:'truck',pier:'ship',airport:'plane'};

/* ---------- 1日のぶんを計算する ---------- */
// 返り値 {veh:[…], stops:{sid:{cap}}}。veh：{id,line,name,mode,color,P,stops:[{sid,s,dw}],dep,t0,dt,s:Float32Array,st:Int8Array,arr:[],nom:[],from,to}
function simulate(doc,runCfg){const cfg=cfgOf(runCfg),dt=cfg.dt;doc=RC.normalize(doc,{roadTypes:[],stopTypes:[],lineTypes:[]});
  const adj=RC.adjacency(doc),V=[];
  (doc.order||[]).forEach(lid=>{const l=doc.lines[lid];if(!l||l.show===false||!l.seq||l.seq.length<2)return;
    const mode=modeOf(doc,l);const fw=linePathPts(doc,l,adj,cfg.lead);if(!fw||!fw.stops.length)return;
    const dirs=[fw];if(l.round)dirs.push(reversePath(fw));
    const deps=departures(l,cfg.maxTrips),col=RC.lineStyle(doc,l).color||'#2f5aa8';
    deps.forEach((d0,i)=>dirs.forEach((R,di)=>{const dep=((d0%1440)+1440)%1440;
      V.push({id:lid+'#'+i+(di?'r':''),line:lid,name:l.name||'',type:l.type,mode,color:col,P:R.P,
        stops:R.stops.map(x=>({sid:x.sid,s:x.s,dw:dwellOf(doc,x.sid,mode,cfg)})),dep,dir:di,
        from:R.stops[0].sid,to:R.stops[R.stops.length-1].sid});}));});
  const caps={};Object.keys(doc.stops).forEach(sid=>caps[sid]=capOf(doc,sid,cfg));
  V.forEach(v=>{v.spawn=v.dep-cfg.lay[v.mode];});
  // 予定（1台だけで走ったとき）
  V.forEach(v=>{const r=run([v],caps,cfg,true);v.nom=r[0].arr;});
  // みんなで走る（地上・海・空を別々に。中身は同じ決まり）
  const groups={};V.forEach(v=>(groups[MEDIUM[v.mode]]=groups[MEDIUM[v.mode]]||[]).push(v));
  Object.values(groups).forEach(g=>run(g,caps,cfg,false));
  V.forEach(v=>{v.delay=v.arr.map((t,k)=>k===0?Math.max(0,(v.leave[0]!=null?v.leave[0]:v.dep)-v.dep):(t!=null&&v.nom[k]!=null?Math.max(0,t-v.nom[k]):0));});
  return {veh:V,caps,cfg};}

// 時刻を dt ずつ進めて、乗り物の動きを記録する
function run(list,caps,cfg,solo){const dt=cfg.dt;if(!list.length)return list;
  const t0=Math.floor(Math.min(...list.map(v=>v.spawn))/dt)*dt;
  const vs=list.map(v=>({v,s:0,state:0,k:0,slot:-1,until:0,rec:[],st:[],t0:null,arr:new Array(v.stops.length).fill(null),leave:new Array(v.stops.length).fill(null),hold:0,pos:null,ldr:null,stall:0,done:false}));
  const berth={};   // sid → [slot→車の番号]
  const vmax=m=>cfg.speed[m]*cfg.unitsPerKm/60;   // 地図の単位/分
  const acc=m=>cfg.accel[m]*cfg.unitsPerKm;          // 地図の単位/分²（ブレーキの目安）
  const slotOff=(cap,j)=>((cap-1)/2-j)*cfg.gap.slot;
  const air=list[0].mode==='plane';
  let t=t0,alive=vs.length,guard=0;
  while(alive>0&&guard++<40000){
    // 1. 出てくる
    // 出るところに前の車がいれば、空くまで出ない（車庫で待つ）
    vs.forEach(o=>{if(o.state!==0||t<o.v.spawn)return;const s0=Math.max(0,cfg.lead-14),p0=at(o.v.P,s0);
      if(!solo&&!air&&vs.some(u=>(u.state===1||u.state===2)&&u.pos&&hyp(u.pos.x-p0.x,u.pos.y-p0.y)<cfg.gap.min))return;
      o.state=1;o.s=s0;o.t0=t;o.pos=pose(o.v.P,s0);});
    const act=vs.filter(o=>o.state===1||o.state===2);
    act.forEach(o=>{o.pos=pose(o.v.P,o.s);});
    // 2. 停留所の場所取り（近い順に）
    const req={};
    act.forEach(o=>{if(o.state!==1||o.slot>=0)return;const S=o.v.stops[o.k];if(!S)return;const d=S.s-o.s;if(d<cfg.gap.look+cfg.gap.slot*caps[S.sid]){(req[S.sid]=req[S.sid]||[]).push({o,d});}});
    Object.entries(req).forEach(([sid,arr])=>{const cap=solo?99:(caps[sid]||1);const b=berth[sid]||(berth[sid]=[]);arr.sort((a,b)=>a.d-b.d);
      arr.forEach(({o})=>{for(let j=0;j<cap;j++)if(b[j]==null){b[j]=o;o.slot=j;o.cap=cap;break;}});});
    // 3. 前の車（同じ向き・すぐ前）
    if(!solo&&!air){act.forEach(o=>{o.ldr=null;if(o.state!==1)return;const p=o.pos,hx=Math.cos(p.ang),hy=Math.sin(p.ang);let best=1e9,bo=null;
      act.forEach(u=>{if(u===o||u.state!==1)return;const dx=u.pos.x-p.x,dy=u.pos.y-p.y,al=dx*hx+dy*hy;if(al<=0.01||al>cfg.gap.slow+2)return;
        if(Math.abs(dx*hy-dy*hx)>2.4)return;if(Math.cos(u.pos.ang-p.ang)<0.55)return;if(al<best){best=al;bo=u;}});
      o.ldr=bo;o.gap=best;});
      act.forEach(o=>{if(o.ldr&&o.ldr.ldr===o&&vs.indexOf(o)<vs.indexOf(o.ldr))o.ldr=null;});}   // おたがいに前と思ったら、先に出た方が進む
    // 4. 進む・止まる
    act.forEach(o=>{const v=o.v;
      if(o.state===2){if(t>=o.until-1e-9){const S=v.stops[o.k];const b=berth[S.sid];if(b&&b[o.slot]===o)b[o.slot]=null;o.leave[o.k]=t;o.slot=-1;o.k++;o.state=1;}return;}
      const S=v.stops[o.k];let target,claimed=false;
      if(S){if(o.slot>=0){target=S.s+slotOff(o.cap,o.slot);claimed=true;}else target=S.s+slotOff(caps[S.sid]||1,(caps[S.sid]||1)-1)-cfg.gap.slot-1.2;}
      else target=v.P.len;
      let sp=vmax(v.mode);
      if(o.ldr&&o.stall<cfg.giveUp){const g=o.gap;sp*=Math.max(0,Math.min(1,(g-cfg.gap.min)/(cfg.gap.slow-cfg.gap.min)));}
      const rem=Math.max(0,target-o.s);sp=Math.min(sp,0.4+Math.sqrt(2*acc(v.mode)*rem));
      const ds=Math.min(sp*dt,rem);o.s+=ds;
      o.stall=ds<0.02?o.stall+dt:0;o.hold=(!claimed&&S&&rem<0.05)?1:(ds<0.02&&o.ldr?3:0);
      if(claimed&&rem-ds<0.02){o.s=target;o.state=2;o.arr[o.k]=t;o.until=t+(o.k===0?Math.max(S.dw,0.3):S.dw);if(o.k===0)o.until=Math.max(o.until,v.dep);}
      else if(!S&&o.s>=v.P.len-0.01){o.state=3;alive--;}});
    // 5. 記録（出ているあいだ）
    vs.forEach(o=>{if(o.t0==null||o.done)return;if(o.state===3){o.done=true;o.rec.push(o.s);o.st.push(0);return;}
      o.rec.push(o.s);o.st.push(o.state===2?10+o.slot:o.hold);});
    t=Math.round((t+dt)*1e6)/1e6;}
  vs.forEach(o=>{const v=o.v;v.arr=o.arr;v.leave=o.leave;if(solo)return;v.t0=o.t0;v.dt=dt;v.s=Float32Array.from(o.rec);v.st=Int8Array.from(o.st);v.t1=o.t0+(o.rec.length-1)*dt;});
  return vs.map(o=>o.v);}

/* ---------- いまの姿 ---------- */
// m：0:00 からの分（地図の T でもよい）。返り値 [{v,x,y,ang,state,slot,k,delay}]
function stateAt(R,T){if(!R)return [];const m=((T%1440)+1440)%1440,out=[];
  R.veh.forEach(v=>{if(!v.s)return;for(const tt of [m,m+1440,m-1440]){if(tt<v.t0||tt>v.t1)continue;
    const f=(tt-v.t0)/v.dt,i=Math.min(v.s.length-1,Math.floor(f)),u=f-i,s=i+1<v.s.length?v.s[i]+(v.s[i+1]-v.s[i])*u:v.s[i];const code=v.st[i];
    const p=pose(v.P,s);let k=0;while(k<v.stops.length&&v.arr[k]!=null&&v.arr[k]<=tt)k++;
    const dwell=code>=10;
    // いまの遅れ：最後に着いた停留所の遅れ。次の停留所の予定を過ぎていれば、そのぶんも
    let delay=0;for(let j=0;j<k;j++)delay=v.delay[j];
    if(k===1&&v.leave[0]!=null&&tt<v.leave[0])delay=Math.max(0,tt-v.dep);   // 始発で、まだ出られていない
    if(k<v.stops.length&&v.nom[k]!=null&&tt>v.nom[k])delay=Math.max(delay,Math.min(v.delay[k],tt-v.nom[k]));
    out.push({v,x:p.x,y:p.y,ang:p.ang,s,t:tt,dwell,slot:dwell?code-10:-1,wait:code===1,jam:code===3,k,atStop:dwell?k-1:-1,delay,
      fade:Math.min(1,(tt-v.t0)/1.2,(v.t1-tt)/1.2)});break;}});
  return out;}

const API={DEF,cfgOf,simulate,stateAt,departures,capOf,pose,at,mkPath,MEDIUM};
if(typeof module!=='undefined'&&module.exports)module.exports=API;else root.RouteRun=API;
})(typeof window!=='undefined'?window:globalThis);
