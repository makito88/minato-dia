/* =====================================================================
   夜の光：計算の部分（第9回・2026-11-15。DOM を使わない・node で読める）。
   ・日の入り／日の出（本当の暦で）と、暗さ 0〜1（darkness）。
   ・まちの性格（ビル街・工場・住宅・商店街・温泉/山・川/海・暗いまま）のマス目（4×4 のマス、横250×縦105）。
     お絵かき帖で塗ったもの（保存 dia-routes の night.zone）が先、なければ data/night-light.json の auto（だいたいの形）。
   ・明かりを置く場所：塗ったもの（night.lamp：1＝置く・2＝置かない）、なければ地図の絵の色から拾った「建物らしさ」（pickScore）。
   ・明かり1つずつ（位置・色・いつ点くか th）を、マスの番号から決まった乱数で作る（毎回同じ）。
   ・道の光：道の種類と、通るところの性格（工場なら港の道・山なら山道）で、帯と街灯。
   ・時刻ごとの点いている割合（sched）。描くのは js/night-render.js。
   ここで作るものは見た目だけ。乗客・売店・お金の計算には何も渡さない。
   ===================================================================== */
(function(root){
'use strict';
const W=1000,H=420;
const clamp=(v,a,b)=>v<a?a:v>b?b:v;

/* ---------- 決まった乱数（マスの番号と何番目かから） ---------- */
function hash(a,b){let h=(Math.imul(a|0,0x9E3779B1)^Math.imul((b|0)+0x7F4A7C15,0x85EBCA77))>>>0;h^=h>>>15;h=Math.imul(h,0x2C1B3C6D)>>>0;h^=h>>>12;h=Math.imul(h,0x297A2D39)>>>0;h^=h>>>15;return (h>>>0)/4294967296;}

/* ---------- 日の入り・日の出（簡単な式。誤差は数分） ---------- */
function doy(ymd){const [y,m,d]=String(ymd).split('-').map(Number);const t=Date.UTC(y,m-1,d),t0=Date.UTC(y,0,1);return Math.round((t-t0)/864e5)+1;}
function sunTimes(ymd,sun){sun=sun||{lat:35.7,lon:139.41,tz:9};const N=doy(ymd)||172,rad=Math.PI/180;
  const B=2*Math.PI*(N-81)/365,eot=9.87*Math.sin(2*B)-7.53*Math.cos(B)-1.5*Math.sin(B);
  const dec=23.44*rad*Math.sin(B),lat=sun.lat*rad;
  const c=(Math.sin(-0.833*rad)-Math.sin(lat)*Math.sin(dec))/(Math.cos(lat)*Math.cos(dec));const ha=Math.acos(clamp(c,-1,1))/rad;
  const noon=720-4*sun.lon-eot+sun.tz*60;return {rise:noon-4*ha,set:noon+4*ha,noon};}
// 暗さ（0＝昼・1＝夜）。t はゲームの分（26:00 まで）。日の入りの dusk[0] 分後から dusk[1] 分後へ、日の出の dawn[0]〜dawn[1] で明るく
function darkness(t,ymd,sun){const m=((t%1440)+1440)%1440,s=sunTimes(ymd,sun),dk=(sun&&sun.dusk)||[-12,42],dw=(sun&&sun.dawn)||[-48,8];
  const a=s.set+dk[0],b=s.set+dk[1],c=s.rise+dw[0],d=s.rise+dw[1];
  if(m>=b||m<c)return 1;if(m>=d&&m<a)return 0;
  if(m>=a&&m<b){const u=(m-a)/(b-a);return u*u*(3-2*u);}
  const u=(m-c)/(d-c);return 1-u*u*(3-2*u);}

/* ---------- 時刻ごとの割合（[時, 割合] を直線でつなぐ。24時で0時に戻る） ---------- */
function frac(sched,m){if(!sched||!sched.length)return 1;const h=(((m%1440)+1440)%1440)/60;
  for(let i=0;i<sched.length-1;i++){const [h0,v0]=sched[i],[h1,v1]=sched[i+1];if(h>=h0&&h<=h1)return h1>h0?v0+(v1-v0)*(h-h0)/(h1-h0):v1;}
  return sched[sched.length-1][1];}

/* ---------- マス目 ---------- */
function dims(cfg){const c=(cfg&&cfg.cell)||4;return {c,gw:Math.ceil(W/c),gh:Math.ceil(H/c)};}
// 文字に縮める（同じ数が続くところをまとめる）：「値.個数」を , でつなぐ。個数は36進
function rleEnc(a){const out=[];let i=0;while(i<a.length){const v=a[i];let n=1;while(i+n<a.length&&a[i+n]===v)n++;out.push(v.toString(36)+(n>1?'.'+n.toString(36):''));i+=n;}return out.join(',');}
function rleDec(s,len){const a=new Uint8Array(len);if(typeof s!=='string'||!s)return a;let i=0;
  for(const p of s.split(',')){const [v,n]=p.split('.');const val=parseInt(v,36)|0,cnt=n?parseInt(n,36)|0:1;if(!(cnt>0))continue;a.fill(val&255,i,Math.min(len,i+cnt));i+=cnt;if(i>=len)break;}return a;}
function inPoly(x,y,P){let inside=false;for(let i=0,j=P.length-1;i<P.length;j=i++){const [xi,yi]=P[i],[xj,yj]=P[j];if(((yi>y)!==(yj>y))&&(x<(xj-xi)*(y-yi)/(yj-yi)+xi))inside=!inside;}return inside;}
function codeOf(cfg,id){const z=(cfg.zones||[]).find(z=>z.id===id);return z?z.code:0;}
function zoneOf(cfg,code){return (cfg.zones||[]).find(z=>z.code===code)||null;}
// 塗りがないところの性格（auto の形）と、明かりの多さの倍率
function autoZones(cfg){const {c,gw,gh}=dims(cfg),z=new Uint8Array(gw*gh),m=new Float32Array(gw*gh),A=cfg.auto||{},home=codeOf(cfg,'home');
  const polys=(A.polys||[]).map(p=>({code:codeOf(cfg,p.zone),pts:p.pts}));const ctr=A.center||[100,300],far=A.far||[0,1];
  for(let j=0;j<gh;j++)for(let i=0;i<gw;i++){const x=(i+0.5)*c,y=(j+0.5)*c,k=j*gw+i;let code=0;
    for(const p of polys)if(inPoly(x,y,p.pts)){code=p.code;break;}
    const d=Math.hypot(x-ctr[0],y-ctr[1]),fall=1-far[0]*clamp(d/far[1],0,1);
    if(!code){z[k]=home;m[k]=(A.rural==null?0.35:A.rural)*fall;}else{z[k]=code;m[k]=code===home?fall:1;}}
  return {z,m};}

/* ---------- 地図の絵から「建物らしさ」を拾う ----------
   rgba：絵を小さくした画素（横 w・縦 h。マス目の整数倍だと良い）。マスごとに 0〜1 と、水のマス */
function hsv(r,g,b){const mx=Math.max(r,g,b),mn=Math.min(r,g,b),d=mx-mn;let h=0;if(d){if(mx===r)h=((g-b)/d)%6;else if(mx===g)h=(b-r)/d+2;else h=(r-g)/d+4;h*=60;if(h<0)h+=360;}return [h,mx?d/mx:0,mx/255];}
function pickScore(rgba,w,h,cfg){const {gw,gh}=dims(cfg),P=(cfg.auto&&cfg.auto.pick)||{},score=new Float32Array(gw*gh),water=new Uint8Array(gw*gh);
  const cnt=new Float32Array(gw*gh),bld=new Float32Array(gw*gh),wat=new Float32Array(gw*gh);
  const inR=(v,r)=>v>=r[0]&&v<=r[1];const roofs=P.roof||[[0,28],[345,360]],green=P.green||[62,175],wr=P.water||[185,225];
  for(let y=0;y<h;y++){const j=Math.min(gh-1,Math.floor(y*gh/h));for(let x=0;x<w;x++){const i=Math.min(gw-1,Math.floor(x*gw/w)),o=(y*w+x)*4,k=j*gw+i;
    const [hu,s,v]=hsv(rgba[o],rgba[o+1],rgba[o+2]);cnt[k]++;
    if(inR(hu,wr)&&s>=(P.waterS||0.42)){wat[k]++;continue;}
    if(inR(hu,green)&&s>0.16)continue;
    if((s<(P.gray||0.24)&&inR(v,P.v||[0.42,0.97]))||(roofs.some(r=>inR(hu,r))&&s>=(P.roofS||0.3)&&v>0.42))bld[k]++;}}
  const mn=P.min==null?0.12:P.min,mx=P.max==null?0.62:P.max;
  for(let k=0;k<gw*gh;k++){if(!cnt[k])continue;const b=bld[k]/cnt[k];score[k]=clamp((b-mn)/(mx-mn),0,1);water[k]=wat[k]/cnt[k]>0.5?1:0;}
  return {score,water};}

/* ---------- 塗りと自動をあわせる ---------- */
function blankPaint(cfg){const {gw,gh}=dims(cfg);return {v:1,zone:'',lamp:'',pal:{},base:true,n:gw*gh};}
function normalize(n,cfg){const o=Object.assign(blankPaint(cfg),n&&typeof n==='object'?n:{});o.v=1;o.zone=typeof o.zone==='string'?o.zone:'';o.lamp=typeof o.lamp==='string'?o.lamp:'';
  o.pal=o.pal&&typeof o.pal==='object'?o.pal:{};for(const k of Object.keys(o.pal))if(!Array.isArray(o.pal[k])||!o.pal[k].every(c=>/^#[0-9a-f]{6}$/i.test(c)))delete o.pal[k];
  o.base=o.base!==false;delete o.n;return o;}
function merge(cfg,paint,pick){const {gw,gh}=dims(cfg),N=gw*gh,au=autoZones(cfg),pz=rleDec(paint&&paint.zone,N),pl=rleDec(paint&&paint.lamp,N);
  const z=new Uint8Array(N),m=new Float32Array(N),lamp=pl,water=new Uint8Array(N),pt=new Uint8Array(N);const wcode=codeOf(cfg,'water');
  for(let k=0;k<N;k++){if(pz[k]){z[k]=pz[k];m[k]=1;pt[k]=1;}else{z[k]=au.z[k];m[k]=au.m[k];if(pick&&pick.water[k])z[k]=wcode;}water[k]=z[k]===wcode?1:0;}
  return {z,m,lamp,water,painted:pt,gw,gh,c:dims(cfg).c};}

/* ---------- 明かり1つずつ ----------
   out：{x,y,col,th,s,z,g,kind}  th＝点いている割合がこれより大きいと点く。kind：w＝窓・g＝格子の窓・s＝看板 */
function palette(cfg,paint,zid){const p=paint&&paint.pal&&paint.pal[zid];if(p&&p.length)return p;const z=(cfg.zones||[]).find(q=>q.id===zid);return (z&&z.colors)||['#ffd27a'];}
function lights(cfg,G,score,paint){const out=[],{gw,gh,c}=G;const Z={};(cfg.zones||[]).forEach(z=>Z[z.code]=z);
  // 性格を塗ったところは、絵に建物がなくても少しは点く（0.45）
  for(let j=0;j<gh;j++)for(let i=0;i<gw;i++){const k=j*gw+i,zc=Z[G.z[k]];if(!zc||!zc.dens)continue;const L=G.lamp[k];if(L===2)continue;
    const sc=L===1?1:G.painted&&G.painted[k]?Math.max(0.45,score?score[k]:0.5):(score?score[k]:0.5);if(sc<=0)continue;const exp=zc.dens*G.m[k]*sc;let n=Math.floor(exp+hash(k,1));if(n<=0)continue;n=Math.min(n,8);
    const pal=palette(cfg,paint,zc.id),x0=i*c,y0=j*c;
    for(let q=0;q<n;q++){const r1=hash(k,10+q*7),r2=hash(k,11+q*7),r3=hash(k,12+q*7),r4=hash(k,13+q*7),r5=hash(k,14+q*7);
      const x=x0+r1*c,y=y0+r2*c,col=pal[Math.floor(r4*pal.length)%pal.length];
      if(zc.grid&&r5<zc.grid){   // ビル：窓が縦横にそろった格子（ところどころ消えている）
        const cols=2+Math.floor(r3*2),rows=2+Math.floor(hash(k,15+q*7)*2),dx=0.62,dy=0.7;
        for(let a=0;a<cols;a++)for(let b=0;b<rows;b++){const t=hash(k*31+q,a*7+b);out.push({x:x+a*dx,y:y+b*dy,col,th:t,s:0.34,z:zc.code,g:0.12,kind:'g'});}
        continue;}
      const sign=zc.sign&&r5<zc.sign;
      out.push({x,y,col,th:r3,s:sign?0.9+r5*0.6:0.45+r5*0.35,z:zc.code,g:(zc.glow||0.6)*(sign?1.6:1),kind:sign?'s':'w'});}}
  return out;}
// 星（暗いところ・温泉/山）
function stars(cfg,G,score){const out=[],{gw,gh,c}=G;const Z={};(cfg.zones||[]).forEach(z=>Z[z.code]=z);
  for(let k=0;k<gw*gh;k++){const zc=Z[G.z[k]];if(!zc||!zc.stars)continue;if(score&&score[k]>0.35)continue;if(hash(k,90)>0.06*zc.stars)continue;
    const i=k%gw,j=(k/gw)|0;out.push({x:(i+hash(k,91))*c,y:(j+hash(k,92))*c,b:0.35+hash(k,93)*0.65});}
  return out;}
// 航空障害灯：ビル街のマスから n 個（建物らしさの高いところを、決まった乱数で）
function aviation(cfg,G,score){const n=(cfg.aviation&&cfg.aviation.n)||0,biz=codeOf(cfg,'biz'),cand=[];
  for(let k=0;k<G.z.length;k++)if(G.z[k]===biz&&(!score||score[k]>0.5))cand.push([hash(k,77),k]);
  cand.sort((a,b)=>a[0]-b[0]);const out=[],{gw,c}=G;
  for(const [r,k] of cand){if(out.length>=n)break;const x=(k%gw+0.5)*c,y=(((k/gw)|0)+0.5)*c;if(out.some(p=>Math.hypot(p.x-x,p.y-y)<22))continue;out.push({x,y,ph:r*6.283});}
  return out;}

/* ---------- 道 ----------
   polys：[{type, pts:[[x,y]…]}]。通るところの性格で見た目を変え、帯（runs）と街灯（lamps）にする */
function roadStyle(type,zid){if(type==='avenue'||type==='street'||type==='lane'){if(zid==='factory')return 'port';if(zid==='onsen'||zid==='dark')return 'mountain';}return type;}
function zidAt(cfg,G,x,y){const i=clamp(Math.floor(x/G.c),0,G.gw-1),j=clamp(Math.floor(y/G.c),0,G.gh-1),zc=zoneOf(cfg,G.z[j*G.gw+i]);return zc?zc.id:'';}
function roads(cfg,G,polys){const runs=[],lamps=[],R=cfg.roads||{};let seed=1;
  for(const p of polys||[]){const pts=p.pts;if(!pts||pts.length<2||!R[p.type])continue;seed++;
    // 細かく分けて、ところごとの見た目を決める
    const fine=[];for(let i=0;i<pts.length-1;i++){const [x0,y0]=pts[i],[x1,y1]=pts[i+1],L=Math.hypot(x1-x0,y1-y0),n=Math.max(1,Math.ceil(L/4));for(let q=0;q<n;q++)fine.push([x0+(x1-x0)*q/n,y0+(y1-y0)*q/n]);}
    fine.push(pts[pts.length-1]);
    let cur=null,acc=0;
    for(let i=0;i<fine.length;i++){const [x,y]=fine[i],st=roadStyle(p.type,zidAt(cfg,G,x,y));
      if(!cur||cur.st!==st){if(cur)cur.pts.push([x,y]);cur={st,pts:[[x,y]],len:0};runs.push(cur);}else{const q=cur.pts[cur.pts.length-1];const d=Math.hypot(x-q[0],y-q[1]);cur.len+=d;acc+=d;cur.pts.push([x,y]);}
      const S=R[st];if(S&&S.lamp&&i>0){const sp=S.lamp;if(acc>=sp){acc-=sp;const h=hash(seed*7919+i,5);if(h<(S.lampP==null?1:S.lampP)){const prev=fine[i-1],ang=Math.atan2(y-prev[1],x-prev[0]),side=hash(seed,i)<0.5?-1:1;
        lamps.push({x:x-Math.sin(ang)*1.3*side,y:y+Math.cos(ang)*1.3*side,st,th:hash(seed*7919+i,6)});}}}}}
  return {runs:runs.filter(r=>r.pts.length>1),lamps};}
// お絵かき帖の道の種類 → 光の種類（大通り・生活道路・細い道。自分で足した種類は幅で）
function roadTypeOf(t){if(!t)return 'street';if(t.mode&&t.mode!=='road')return '';if(t.id==='avenue'||t.id==='street'||t.id==='lane')return t.id;const w=+(t.style&&t.style.width)||2;return w>=3.4?'avenue':w>=2?'street':'lane';}

/* ---------- まとめて作る（ゲームとお絵かき帖で同じ） ----------
   doc：dia-routes（night・edges・nodes・types）、pick：pickScore の結果（なければ null）、flat(doc,e)→[[x,y]…]（道の形。なければ両端の直線） */
function model(cfg,doc,pick,flat){const paint=normalize(doc&&doc.night,cfg),G=merge(cfg,paint,pick),score=pick&&pick.score,L=lights(cfg,G,score,paint);
  const polys=[];if(paint.base!==false)for(const r of (cfg.baseRoads&&cfg.baseRoads.list)||[])polys.push({type:r.type,pts:r.pts});
  if(doc&&doc.edges&&doc.nodes){const types=(doc.types&&doc.types.road)||[];
    for(const e of Object.values(doc.edges)){const t=types.find(q=>q.id===e.type)||{id:e.type},ty=roadTypeOf(t);if(!ty)continue;let pts=null;
      try{pts=flat?flat(doc,e):[[doc.nodes[e.a].x,doc.nodes[e.a].y],[doc.nodes[e.b].x,doc.nodes[e.b].y]];}catch(er){continue;}if(pts&&pts.length>1)polys.push({type:ty,pts});}}
  const rd=roads(cfg,G,polys);rd.runs.forEach(r=>{r.len=r.pts.reduce((a,p,i)=>i?a+Math.hypot(p[0]-r.pts[i-1][0],p[1]-r.pts[i-1][1]):0,0);});
  return {paint,G,L,stars:stars(cfg,G,score),avi:aviation(cfg,G,score),roads:rd};}
// 筆で塗る：マス目 a（Uint8Array）の、中心 x,y・半径 r（地図の単位）の中を v に。変わったマスの数
function paintAt(cfg,a,x,y,r,v){const {c,gw,gh}=dims(cfg);let n=0;const i0=Math.max(0,Math.floor((x-r)/c)),i1=Math.min(gw-1,Math.floor((x+r)/c)),j0=Math.max(0,Math.floor((y-r)/c)),j1=Math.min(gh-1,Math.floor((y+r)/c));
  for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){if(Math.hypot((i+0.5)*c-x,(j+0.5)*c-y)>r+c*0.5)continue;const k=j*gw+i;if(a[k]!==v){a[k]=v;n++;}}return n;}

/* ---------- イベントの光の種類 ---------- */
function eventFx(it,cfg){const E=(cfg&&cfg.events)||{};const e=it&&it.icon&&it.icon.e;if(e&&E.by&&E.by[e]!=null)return E.by[e];return (E.kind&&E.kind[it&&it.kind])||'';}

const api={W,H,hash,sunTimes,darkness,frac,dims,rleEnc,rleDec,inPoly,codeOf,zoneOf,autoZones,hsv,pickScore,blankPaint,normalize,merge,palette,lights,stars,aviation,roadStyle,roads,roadTypeOf,eventFx,model,paintAt};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.NightCore=api;
})(typeof window!=='undefined'?window:globalThis);
