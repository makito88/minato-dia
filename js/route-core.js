/* =====================================================================
   路線のお絵かき：計算の部分（DOM を使わない）。route-editor.html から使う。第2段（走らせる）でもこのまま使えるように。
   データの形（ブラウザの dia-routes に保存）：
     nodes : { id: {x,y} }                         点（ゲームの地図の座標。横1000×縦420、外にもはみ出してよい）
     edges : { id: {a,b,type,pts:[[x,y]..],smooth} } 道。a→b の間の形を pts（制御点）で持つ。smooth=true ならなめらかな曲線
     stops : { id: {name,type,node,lp,style} }     停留所・拠点（どれかの点の上）。lp＝名前の位置（auto/n/ne/e/se/s/sw/w/nw）
     lines : { id: {name,type,style,seq:[{s:停留所}|{v:経由の点}],pass..,freq,first,last,round,show,direct} }
     order : [路線のid…]（描く順・並べる順）
     types : { road:[…], stop:[…], line:[…] }   種類（名前と見た目。自由に足せる）
   ===================================================================== */
(function(root){
'use strict';
const clone=o=>JSON.parse(JSON.stringify(o));
const hyp=(x,y)=>Math.sqrt(x*x+y*y);
const dist=(p,q)=>hyp(p[0]-q[0],p[1]-q[1]);

function uid(doc,p){doc.seq=(doc.seq||0)+1;return p+doc.seq.toString(36);}

function emptyDoc(defs){return {v:1,seq:0,nodes:{},edges:{},stops:{},lines:{},order:[],
  types:{road:clone(defs.roadTypes||[]),stop:clone(defs.stopTypes||[]),line:clone(defs.lineTypes||[])},view:{mapAlpha:1,rail:true}};}

function normalize(doc,defs){
  if(!doc||typeof doc!=='object'||!doc.nodes)return emptyDoc(defs);
  const d=Object.assign(emptyDoc(defs),doc);
  ['nodes','edges','stops','lines'].forEach(k=>{if(!d[k]||typeof d[k]!=='object')d[k]={};});
  if(!Array.isArray(d.order))d.order=[];
  d.order=d.order.filter(id=>d.lines[id]);Object.keys(d.lines).forEach(id=>{if(!d.order.includes(id))d.order.push(id);});
  d.types=Object.assign({road:[],stop:[],line:[]},d.types||{});
  ['road','stop','line'].forEach(k=>{if(!Array.isArray(d.types[k])||!d.types[k].length)d.types[k]=clone(defs[k+'Types']||[]);});
  // 壊れた参照を落とす
  for(const [id,e] of Object.entries(d.edges))if(!d.nodes[e.a]||!d.nodes[e.b]){delete d.edges[id];}else{if(!Array.isArray(e.pts))e.pts=[];}
  for(const [id,s] of Object.entries(d.stops))if(!d.nodes[s.node])delete d.stops[id];
  for(const l of Object.values(d.lines)){l.seq=(l.seq||[]).filter(it=>it.s?d.stops[it.s]:d.nodes[it.v]);}
  d.view=Object.assign({mapAlpha:1,rail:true},d.view||{});
  return d;}

/* ---------- 形（制御点の並び → 細かい折れ線） ---------- */
function ctrlOf(doc,e){const A=doc.nodes[e.a],B=doc.nodes[e.b];return [[A.x,A.y],...e.pts.map(p=>[p[0],p[1]]),[B.x,B.y]];}
// Catmull-Rom を3次ベジェにした区間（P1→P2 の c1,c2）
function bez(c,i){const p0=c[Math.max(0,i-1)],p1=c[i],p2=c[i+1],p3=c[Math.min(c.length-1,i+2)];
  return [p1,[p1[0]+(p2[0]-p0[0])/6,p1[1]+(p2[1]-p0[1])/6],[p2[0]-(p3[0]-p1[0])/6,p2[1]-(p3[1]-p1[1])/6],p2];}
function bezPt(b,t){const u=1-t;return [u*u*u*b[0][0]+3*u*u*t*b[1][0]+3*u*t*t*b[2][0]+t*t*t*b[3][0],u*u*u*b[0][1]+3*u*u*t*b[1][1]+3*u*t*t*b[2][1]+t*t*t*b[3][1]];}
// 戻り値：[{x,y,k}]（k＝何番目の制御区間か）
function flatten(c,smooth){const out=[{x:c[0][0],y:c[0][1],k:0}];
  for(let i=0;i<c.length-1;i++){
    if(smooth&&c.length>2){const b=bez(c,i),n=Math.max(2,Math.min(24,Math.ceil(dist(c[i],c[i+1])/4)));
      for(let j=1;j<=n;j++){const p=bezPt(b,j/n);out.push({x:p[0],y:p[1],k:i});}}
    else out.push({x:c[i+1][0],y:c[i+1][1],k:i});}
  return out;}
function edgeFlat(doc,e){return flatten(ctrlOf(doc,e),e.smooth);}
function polyLen(f){let L=0;for(let i=1;i<f.length;i++)L+=hyp(f[i].x-f[i-1].x,f[i].y-f[i-1].y);return L;}
function edgeLen(doc,e){return polyLen(edgeFlat(doc,e));}

/* ---------- 近いものをさがす ---------- */
function segNear(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,L2=dx*dx+dy*dy||1e-9;let t=((p[0]-a.x)*dx+(p[1]-a.y)*dy)/L2;t=Math.max(0,Math.min(1,t));
  const x=a.x+t*dx,y=a.y+t*dy;return {x,y,t,d:hyp(p[0]-x,p[1]-y)};}
function nearestNode(doc,p,r,skip){let best=null,bd=r;for(const [id,n] of Object.entries(doc.nodes)){if(skip&&skip.has(id))continue;const d=hyp(n.x-p[0],n.y-p[1]);if(d<=bd){bd=d;best=id;}}return best;}
function nearestEdge(doc,p,r,skip){let best=null;
  for(const [id,e] of Object.entries(doc.edges)){if(skip&&skip.has(id))continue;const f=edgeFlat(doc,e);
    for(let i=1;i<f.length;i++){const q=segNear(p,f[i-1],f[i]);if(q.d<=r&&(!best||q.d<best.d))best={id,x:q.x,y:q.y,d:q.d,k:f[i].k};}}
  return best;}

/* ---------- 点と道をいじる ---------- */
function addNode(doc,x,y){const id=uid(doc,'n');doc.nodes[id]={x:+x.toFixed(1),y:+y.toFixed(1)};return id;}
function addEdge(doc,a,b,pts,type,smooth){const id=uid(doc,'e');doc.edges[id]={a,b,type,pts:(pts||[]).map(p=>[+p[0].toFixed(1),+p[1].toFixed(1)]),smooth:!!smooth};return id;}
// 道 eid を、制御区間 k の中の点 (x,y) で2本に分ける。nid を渡せばその点でつなぐ。前半は元の id のまま。
function splitEdge(doc,eid,x,y,k,nid){const e=doc.edges[eid];if(!e)return null;
  if(!nid)nid=addNode(doc,x,y);
  const c=ctrlOf(doc,e);k=Math.max(0,Math.min(c.length-2,k|0));
  const first=c.slice(1,k+1),second=c.slice(k+1,c.length-1);
  const b=e.b;e.b=nid;e.pts=first;
  addEdge(doc,nid,b,second,e.type,e.smooth);
  return nid;}
// 点 p をつなぎ先にする：近い点 → 近い道（そこで分ける）→ 新しい点
function anchor(doc,p,r){const n=nearestNode(doc,p,r);if(n)return n;
  const e=nearestEdge(doc,p,r);if(e)return splitEdge(doc,e.id,e.x,e.y,e.k);
  return addNode(doc,p[0],p[1]);}

function segX(p1,p2,p3,p4){const d=(p2.x-p1.x)*(p4.y-p3.y)-(p2.y-p1.y)*(p4.x-p3.x);if(Math.abs(d)<1e-9)return null;
  const t=((p3.x-p1.x)*(p4.y-p3.y)-(p3.y-p1.y)*(p4.x-p3.x))/d,u=((p3.x-p1.x)*(p2.y-p1.y)-(p3.y-p1.y)*(p2.x-p1.x))/d;
  if(t<0||t>1||u<0||u>1)return null;return {x:p1.x+t*(p2.x-p1.x),y:p1.y+t*(p2.y-p1.y),t,u};}

// 道 eid とほかの道が交わるところに交差点（点）を作る
function makeCrossings(doc,eid){const e=doc.edges[eid];if(!e)return;
  const fN=edgeFlat(doc,e),near=(q,n)=>{const N=doc.nodes[n];return hyp(q.x-N.x,q.y-N.y)<3;};
  const hits=[];   // {other,x,y,ko,po,kn,pn}
  for(const [oid,o] of Object.entries(doc.edges)){if(oid===eid)continue;const fO=edgeFlat(doc,o);
    for(let i=1;i<fN.length;i++)for(let j=1;j<fO.length;j++){const q=segX(fN[i-1],fN[i],fO[j-1],fO[j]);if(!q)continue;
      if(near(q,e.a)||near(q,e.b)||near(q,o.a)||near(q,o.b))continue;
      if(hits.some(h=>hyp(h.x-q.x,h.y-q.y)<2))continue;
      hits.push({other:oid,x:q.x,y:q.y,ko:fO[j].k,po:j+q.u,kn:fN[i].k,pn:i+q.t});}}
  if(!hits.length)return;
  // ほかの道：後ろから分ける（前の区間の番号がずれない）
  const byO={};hits.forEach(h=>(byO[h.other]=byO[h.other]||[]).push(h));
  for(const [oid,arr] of Object.entries(byO)){arr.sort((a,b)=>b.po-a.po);arr.forEach(h=>{h.nid=splitEdge(doc,oid,h.x,h.y,h.ko);});}
  hits.sort((a,b)=>b.pn-a.pn);hits.forEach(h=>splitEdge(doc,eid,h.x,h.y,h.kn,h.nid));}

// 描いた線（点の並び）を道にする。始まりと終わりは近い点・道につなぐ。返り値 {a,b}
function addPath(doc,pts,o){o=o||{};if(!pts||pts.length<2)return null;const r=o.snap||8;
  const a=o.from||anchor(doc,pts[0],r);let b=o.to||anchor(doc,pts[pts.length-1],r);
  if(a===b&&pts.length<4)return {a,b:a};
  const A=doc.nodes[a],B=doc.nodes[b];
  let mid=pts.slice(1,-1).filter(p=>hyp(p[0]-A.x,p[1]-A.y)>1.5&&hyp(p[0]-B.x,p[1]-B.y)>1.5);
  const id=addEdge(doc,a,b,mid,o.type,o.smooth&&mid.length>0);
  if(edgeLen(doc,doc.edges[id])<1.5){delete doc.edges[id];return {a,b};}
  if(o.cross!==false)makeCrossings(doc,id);
  return {a,b};}

function edgesOf(doc,n){return Object.keys(doc.edges).filter(id=>doc.edges[id].a===n||doc.edges[id].b===n);}
function stopsOn(doc,n){return Object.keys(doc.stops).filter(id=>doc.stops[id].node===n);}
function dropOrphan(doc,n){if(doc.nodes[n]&&!edgesOf(doc,n).length&&!stopsOn(doc,n).length&&!Object.values(doc.lines).some(l=>l.seq.some(it=>it.v===n)))delete doc.nodes[n];}
function deleteStop(doc,sid){delete doc.stops[sid];for(const l of Object.values(doc.lines))l.seq=l.seq.filter(it=>it.s!==sid);}
function deleteNode(doc,n){edgesOf(doc,n).forEach(id=>{const e=doc.edges[id];delete doc.edges[id];[e.a,e.b].forEach(m=>m!==n&&dropOrphan(doc,m));});
  stopsOn(doc,n).forEach(s=>deleteStop(doc,s));for(const l of Object.values(doc.lines))l.seq=l.seq.filter(it=>it.v!==n);delete doc.nodes[n];}
function deleteEdge(doc,id){const e=doc.edges[id];if(!e)return;delete doc.edges[id];dropOrphan(doc,e.a);dropOrphan(doc,e.b);}
// 点 from を点 to にまとめる
function mergeNodes(doc,from,to){if(from===to||!doc.nodes[from]||!doc.nodes[to])return;
  for(const [id,e] of Object.entries(doc.edges)){if(e.a===from)e.a=to;if(e.b===from)e.b=to;if(e.a===e.b&&e.pts.length<2)delete doc.edges[id];}
  stopsOn(doc,from).forEach(s=>doc.stops[s].node=to);
  for(const l of Object.values(doc.lines))l.seq.forEach(it=>{if(it.v===from)it.v=to;});
  delete doc.nodes[from];}
// 点を分ける：つながる道ごとに別の点にして、少し離す
function detachNode(doc,n){const es=edgesOf(doc,n);if(es.length<2)return;const N=doc.nodes[n];
  es.slice(1).forEach(id=>{const e=doc.edges[id],c=ctrlOf(doc,e),to=e.a===n?c[1]:c[c.length-2],dx=to[0]-N.x,dy=to[1]-N.y,L=hyp(dx,dy)||1;
    const m=addNode(doc,N.x+dx/L*6,N.y+dy/L*6);if(e.a===n)e.a=m;else e.b=m;});}
// 道の途中に点（曲げる点）を足す／消す
function insertBend(doc,id,x,y,k){const e=doc.edges[id];e.pts.splice(k,0,[+x.toFixed(1),+y.toFixed(1)]);}

/* ---------- いちばん近い道（ダイクストラ） ---------- */
function adjacency(doc){const adj={};for(const [id,e] of Object.entries(doc.edges)){const L=edgeLen(doc,e);
  (adj[e.a]=adj[e.a]||[]).push({to:e.b,id,rev:false,L});(adj[e.b]=adj[e.b]||[]).push({to:e.a,id,rev:true,L});}return adj;}
function shortest(doc,from,to,adj){if(from===to)return {edges:[],len:0};adj=adj||adjacency(doc);
  const D={[from]:0},P={},done=new Set();const q=[[0,from]];
  while(q.length){let bi=0;for(let i=1;i<q.length;i++)if(q[i][0]<q[bi][0])bi=i;const [d,u]=q.splice(bi,1)[0];if(done.has(u))continue;done.add(u);if(u===to)break;
    for(const x of adj[u]||[]){const nd=d+x.L;if(D[x.to]===undefined||nd<D[x.to]){D[x.to]=nd;P[x.to]={u,id:x.id,rev:x.rev};q.push([nd,x.to]);}}}
  if(D[to]===undefined)return null;const edges=[];let v=to;while(v!==from){const p=P[v];edges.unshift({id:p.id,rev:p.rev});v=p.u;}return {edges,len:D[to]};}
const itemNode=(doc,it)=>it.s?doc.stops[it.s]&&doc.stops[it.s].node:it.v;
// 路線の道すじ：[{a,b,edges:[{id,rev}]|null(まっすぐ結ぶ)}]
function linePath(doc,l,adj){adj=adj||adjacency(doc);const legs=[];const t=lineType(doc,l),direct=l.direct!=null?l.direct:!!(t&&t.direct);
  for(let i=1;i<l.seq.length;i++){const a=itemNode(doc,l.seq[i-1]),b=itemNode(doc,l.seq[i]);if(!a||!b)continue;
    const p=direct?null:shortest(doc,a,b,adj);legs.push({a,b,edges:p?p.edges:null,len:p?p.len:dist([doc.nodes[a].x,doc.nodes[a].y],[doc.nodes[b].x,doc.nodes[b].y])});}
  return legs;}
function lineType(doc,l){return doc.types.line.find(t=>t.id===l.type)||doc.types.line[0];}
function lineStyle(doc,l){const t=lineType(doc,l);return Object.assign({},t?t.style:{},l.style||{});}
// 同じ道を通る路線に、並べる位置を振る：{edgeId:{lineId:i}}, 本数 {edgeId:n}
function lineLanes(doc,ids){const adj=adjacency(doc),use={};
  ids.forEach(lid=>{const l=doc.lines[lid];linePath(doc,l,adj).forEach(g=>(g.edges||[]).forEach(x=>{(use[x.id]=use[x.id]||[]);if(!use[x.id].includes(lid))use[x.id].push(lid);}));});
  const lane={},cnt={};for(const [eid,arr] of Object.entries(use)){cnt[eid]=arr.length;lane[eid]={};arr.forEach((lid,i)=>lane[eid][lid]=i);}
  return {lane,cnt};}

/* ---------- 運行（第2段で使う） ---------- */
const hm=s=>{const m=/^(\d{1,2}):(\d{2})$/.exec(s||'');return m?(+m[1])*60+(+m[2]):null;};
function tripsPerDay(l){const f=l.freq||{unit:'h',n:2};if(f.unit==='d')return Math.max(0,f.n|0);const a=hm(l.first),b=hm(l.last);if(a==null||b==null||b<=a)return 0;return Math.floor((b-a)/60*f.n)+1;}

// 書き出し用：路線ごとに計算した道すじ（道の id の並び）も付ける
function exportDoc(doc){const d=clone(doc),adj=adjacency(doc);
  for(const [id,l] of Object.entries(d.lines)){l.path=linePath(doc,doc.lines[id],adj).map(g=>({a:g.a,b:g.b,edges:g.edges?g.edges.map(x=>(x.rev?'-':'')+x.id):null,len:+g.len.toFixed(1)}));l.tripsPerDay=tripsPerDay(l);}
  d.format='minato-dia-routes';return d;}

// 線を間引く（Ramer–Douglas–Peucker）
function simplify(pts,eps){if(pts.length<3)return pts.slice();
  const keep=new Array(pts.length).fill(false);keep[0]=keep[pts.length-1]=true;const st=[[0,pts.length-1]];
  while(st.length){const [i,j]=st.pop();let md=0,mi=-1;const a={x:pts[i][0],y:pts[i][1]},b={x:pts[j][0],y:pts[j][1]};
    for(let k=i+1;k<j;k++){const d=segNear(pts[k],a,b).d;if(d>md){md=d;mi=k;}}
    if(md>eps&&mi>0){keep[mi]=true;st.push([i,mi],[mi,j]);}}
  return pts.filter((_,i)=>keep[i]);}

const API={clone,uid,emptyDoc,normalize,ctrlOf,bez,flatten,edgeFlat,edgeLen,polyLen,nearestNode,nearestEdge,segNear,addNode,addEdge,splitEdge,anchor,makeCrossings,addPath,
  edgesOf,stopsOn,deleteStop,deleteNode,deleteEdge,mergeNodes,detachNode,insertBend,dropOrphan,adjacency,shortest,linePath,lineType,lineStyle,lineLanes,tripsPerDay,hm,exportDoc,simplify,itemNode};
if(typeof module!=='undefined'&&module.exports)module.exports=API;else root.RouteCore=API;
})(typeof window!=='undefined'?window:globalThis);
