/* =====================================================================
   線路の形（第7回・2026-11-13）：お絵かき帖の「線路」の層で直した、地図の上の線路の形。
   計算だけ（DOM なし・node で読める）。index.html と js/rail-edit.js が使う。
   ・ダイヤ・乗客・運賃の計算はキロ程（km）だけを使う。ここで変わるのは地図の x,y（見た目）だけ。
   ・保存：ブラウザの dia-track（dia- で始まるので引き継ぎコードに入る）。保存がなければ今までの直線のまま。
     {v:1, st:{駅:[x,y]}, seg:{'C-S':{p:[[x,y]…],s:1}}, depot:{C:{yard:[x,y,w,h],exit:[[x,y]…]}}, extra:[{p:[[x,y]…],s:0|1}]}
     seg のかぎは路線の順（本線 C→P・支線 K→O）。p は駅と駅のあいだの「曲がる点」、s:1 はなめらかな曲線。
   ・駅の数・順番・つながり・キロ程はここでは変えられない（base の駅と線だけを読む）。
   ===================================================================== */
(function(root){
'use strict';
const KEY='dia-track';
const r1=v=>Math.round(v*10)/10;
const num=v=>typeof v==='number'&&isFinite(v);
const okPt=p=>Array.isArray(p)&&p.length>=2&&num(p[0])&&num(p[1])&&Math.abs(p[0])<5000&&Math.abs(p[1])<5000;

// base：{stations:{id:{x,y}}, lines:[[id…]…], depot:{id:{yard:{x,y,w,h},exit:[{x,y}…]}}}
function segKeys(base){const out=[];base.lines.forEach(L=>{for(let i=0;i<L.length-1;i++)out.push(L[i]+'-'+L[i+1]);});return out;}
function keyOf(base,a,b){for(const L of base.lines){const i=L.indexOf(a),j=L.indexOf(b);if(i>=0&&j>=0&&Math.abs(i-j)===1)return i<j?{key:a+'-'+b,rev:false}:{key:b+'-'+a,rev:true};}return null;}

/* 保存を読みやすい形にそろえる（こわれた値は捨てる） */
function normalize(raw,base){const out={v:1,st:{},seg:{},depot:{},extra:[]};if(!raw||typeof raw!=='object')return out;
  const keys=new Set(segKeys(base));
  for(const s in raw.st||{})if(base.stations[s]&&okPt(raw.st[s]))out.st[s]=[r1(raw.st[s][0]),r1(raw.st[s][1])];
  for(const k in raw.seg||{}){const g=raw.seg[k];if(!keys.has(k)||!g||!Array.isArray(g.p))continue;const p=g.p.filter(okPt).slice(0,60).map(q=>[r1(q[0]),r1(q[1])]);if(p.length)out.seg[k]={p,s:g.s?1:0};}
  for(const d in raw.depot||{}){const g=raw.depot[d];if(!base.depot||!base.depot[d]||!g)continue;const o={};
    if(Array.isArray(g.yard)&&g.yard.length===4&&g.yard.every(num))o.yard=[r1(g.yard[0]),r1(g.yard[1]),Math.max(16,Math.min(220,r1(g.yard[2]))),Math.max(12,Math.min(120,r1(g.yard[3])))];
    if(Array.isArray(g.exit)){const e=g.exit.filter(okPt).slice(0,30).map(q=>[r1(q[0]),r1(q[1])]);if(e.length>=2)o.exit=e;}
    if(o.yard||o.exit)out.depot[d]=o;}
  (raw.extra||[]).slice(0,40).forEach(x=>{if(!x||!Array.isArray(x.p))return;const p=x.p.filter(okPt).slice(0,80).map(q=>[r1(q[0]),r1(q[1])]);if(p.length>=2)out.extra.push({p,s:x.s?1:0});});
  return out;}
const isEmpty=sh=>!sh||(!Object.keys(sh.st).length&&!Object.keys(sh.seg).length&&!Object.keys(sh.depot).length&&!sh.extra.length);
function load(storage,base){try{const raw=JSON.parse(storage.getItem(KEY)||'null');if(!raw)return null;const sh=normalize(raw,base);return isEmpty(sh)?null:sh;}catch(e){return null;}}
function save(storage,sh){try{if(isEmpty(sh))storage.removeItem(KEY);else storage.setItem(KEY,JSON.stringify(sh));return true;}catch(e){return false;}}

/* 曲線を細かい折れ線に（なめらか＝Catmull-Rom） */
function flatten(ctrl,smooth){if(ctrl.length<3||!smooth)return ctrl.map(p=>({x:p[0],y:p[1]}));const out=[];const n=ctrl.length;
  for(let i=0;i<n-1;i++){const p0=ctrl[Math.max(0,i-1)],p1=ctrl[i],p2=ctrl[i+1],p3=ctrl[Math.min(n-1,i+2)];const L=Math.hypot(p2[0]-p1[0],p2[1]-p1[1]),m=Math.max(4,Math.min(24,Math.ceil(L/3)));
    for(let k=0;k<m;k++){const t=k/m,t2=t*t,t3=t2*t;
      out.push({x:0.5*((2*p1[0])+(-p0[0]+p2[0])*t+(2*p0[0]-5*p1[0]+4*p2[0]-p3[0])*t2+(-p0[0]+3*p1[0]-3*p2[0]+p3[0])*t3),
                y:0.5*((2*p1[1])+(-p0[1]+p2[1])*t+(2*p0[1]-5*p1[1]+4*p2[1]-p3[1])*t2+(-p0[1]+3*p1[1]-3*p2[1]+p3[1])*t3)});}}
  out.push({x:ctrl[n-1][0],y:ctrl[n-1][1]});return out;}
// 折れ線に長さの目盛り（s）を付ける
function measure(pts){let s=0;const out=[{x:pts[0].x,y:pts[0].y,s:0}];for(let i=1;i<pts.length;i++){const d=Math.hypot(pts[i].x-pts[i-1].x,pts[i].y-pts[i-1].y);if(d<1e-6)continue;s+=d;out.push({x:pts[i].x,y:pts[i].y,s});}return {pts:out,L:s};}
// 長さ s の位置と向き
function atLen(m,s){const P=m.pts,n=P.length;if(n<2)return {x:P[0].x,y:P[0].y,tx:1,ty:0};
  if(s<=0){const tx=(P[1].x-P[0].x)/(P[1].s),ty=(P[1].y-P[0].y)/(P[1].s);return {x:P[0].x+tx*s,y:P[0].y+ty*s,tx,ty};}
  if(s>=m.L){const a=P[n-2],b=P[n-1],d=b.s-a.s,tx=(b.x-a.x)/d,ty=(b.y-a.y)/d;return {x:b.x+tx*(s-m.L),y:b.y+ty*(s-m.L),tx,ty};}
  let lo=0,hi=n-1;while(hi-lo>1){const mid=(lo+hi)>>1;if(P[mid].s<=s)lo=mid;else hi=mid;}
  const a=P[lo],b=P[hi],d=b.s-a.s,u=(s-a.s)/d,tx=(b.x-a.x)/d,ty=(b.y-a.y)/d;return {x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u,tx,ty};}

function stationsOf(sh,base){const o={};for(const s in base.stations){const p=sh&&sh.st[s];o[s]=p?{x:p[0],y:p[1]}:{x:base.stations[s].x,y:base.stations[s].y};}return o;}
function segCtrl(sh,base,key,stp){const [a,b]=key.split('-');const S=stp||stationsOf(sh,base);const g=sh&&sh.seg[key];return [[S[a].x,S[a].y],...(g?g.p:[]),[S[b].x,S[b].y]];}
function depotOf(sh,base,d){const b=base.depot[d],g=sh&&sh.depot[d]||{};
  return {yard:g.yard?{x:g.yard[0],y:g.yard[1],w:g.yard[2],h:g.yard[3]}:Object.assign({},b.yard),exit:g.exit?g.exit.map(p=>({x:p[0],y:p[1]})):b.exit.map(p=>({x:p.x,y:p.y}))};}

/* 形を組み立てる：駅の位置・区間ごとの曲線（曲がる点のある区間だけ）・車庫・側線 */
function build(sh,base){const st=stationsOf(sh,base),seg={};
  segKeys(base).forEach(k=>{const g=sh&&sh.seg[k];if(!g)return;seg[k]=measure(flatten(segCtrl(sh,base,k,st),!!g.s));});
  const depot={};for(const d in base.depot||{})depot[d]=depotOf(sh,base,d);
  const extra=(sh?sh.extra:[]).map(x=>flatten(x.p,!!x.s));
  return {st,seg,depot,extra,
    // a→b の区間の f（0..1・道の長さで）の位置。n は路線の順の向きの左手（今までの NM・NB と同じ向き）。曲がる点のない区間は null
    segAt(a,b,f){const k=keyOf(base,a,b);if(!k||!seg[k.key])return null;const m=seg[k.key],q=atLen(m,(k.rev?1-f:f)*m.L);return {x:q.x,y:q.y,nx:-q.ty,ny:q.tx,tx:q.tx,ty:q.ty};},
    // a→b の区間の f0..f1 のあいだの点（両端は含まない）。曲がる点のない区間は空
    segMid(a,b,f0,f1,off){const k=keyOf(base,a,b);if(!k||!seg[k.key])return [];const m=seg[k.key],out=[];
      const s0=(k.rev?1-f0:f0)*m.L,s1=(k.rev?1-f1:f1)*m.L,lo=Math.min(s0,s1),hi=Math.max(s0,s1);
      const P=m.pts;for(let j=0;j<P.length;j++){const p=P[j];if(!(p.s>lo+0.3&&p.s<hi-0.3))continue;
        const A=P[Math.max(0,j-1)],B=P[Math.min(P.length-1,j+1)],d=Math.hypot(B.x-A.x,B.y-A.y)||1,nx=-(B.y-A.y)/d,ny=(B.x-A.x)/d;out.push({x:p.x+nx*off,y:p.y+ny*off});}
      if(s1<s0)out.reverse();return out;},
    segLen(a,b){const k=keyOf(base,a,b);if(k&&seg[k.key])return seg[k.key].L;return Math.hypot(st[b].x-st[a].x,st[b].y-st[a].y);}};}

/* お絵かき帖で使う：折れ線のいちばん近いところ */
function nearestOnPoly(pts,p){let best=null;for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i],dx=b.x-a.x,dy=b.y-a.y,L2=dx*dx+dy*dy||1e-9;let t=((p[0]-a.x)*dx+(p[1]-a.y)*dy)/L2;t=Math.max(0,Math.min(1,t));
    const x=a.x+t*dx,y=a.y+t*dy,d=Math.hypot(p[0]-x,p[1]-y);if(!best||d<best.d)best={i,t,x,y,d};}return best;}
// 制御点の列 ctrl の中で、点 p を入れる場所（曲線の上の近いところの前後の制御点の間）
function insertIndex(ctrl,p){let best=1,bd=1e9;for(let i=1;i<ctrl.length;i++){const a={x:ctrl[i-1][0],y:ctrl[i-1][1]},b={x:ctrl[i][0],y:ctrl[i][1]};const q=nearestOnPoly([a,b],p);if(q.d<bd){bd=q.d;best=i;}}return best;}

const api={KEY,segKeys,keyOf,normalize,isEmpty,load,save,flatten,measure,atLen,stationsOf,segCtrl,depotOf,build,nearestOnPoly,insertIndex};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.RailShape=api;
})(typeof window!=='undefined'?window:globalThis);
