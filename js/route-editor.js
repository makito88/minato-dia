/* =====================================================================
   路線のお絵かき帖：画面の部分（route-editor.html）。計算は js/route-core.js、初めの種類は data/routes.json。
   方針：わかりやすさよりも、見た目のセンスと自由度。地図の絵が主役で、道具は浮かぶ小さなパレット。
   保存：ブラウザの dia-routes（dia- で始まるので引き継ぎコードに入る）。
   ===================================================================== */
(function(){
'use strict';
const C=window.RouteCore,$=id=>document.getElementById(id);
const KEY='dia-routes';
const FONTS={gothic:'"Zen Kaku Gothic New",sans-serif',maru:'"Zen Maru Gothic",sans-serif',mincho:'"Zen Old Mincho",serif',hand:'"Yomogi",cursive'};
const FONTN={gothic:'ゴシック',maru:'まる',mincho:'明朝',hand:'手書き'};
const SHAPES=['circle','ring','square','diamond','pill','hex','tri','star','anchor'];
const DASHN={solid:'実線',dash:'破線',dot:'点線',dashdot:'一点鎖線'};
const LP=['nw','n','ne','w','auto','e','sw','s','se'];
let DEF=null,doc=null,cur='',UNDO=[],REDO=[];
const S={tool:'pen',road:null,stopT:null,lineT:null,line:null,sel:null,poly:null,stroke:null,hover:null,showLines:false,style:null};
const V={x:0,y:0,z:1,w:0,h:0,dpr:1};
const cv=$('cv'),ctx=cv.getContext('2d');
const MAP=new Image();MAP.decoding='async';
let dirty=true;const redraw=()=>{dirty=true;};

/* ---------------- 保存・元に戻す ---------------- */
function save(){try{localStorage.setItem(KEY,cur);}catch(e){}}
function commit(){const s=JSON.stringify(doc);if(s===cur)return;UNDO.push(cur);if(UNDO.length>120)UNDO.shift();REDO=[];cur=s;save();ui();redraw();}
function revert(){doc=JSON.parse(cur);redraw();}
function undo(){if(S.tool==='rail'&&window.RailEdit){RailEdit.undo();return;}if(!UNDO.length)return;REDO.push(cur);cur=UNDO.pop();doc=JSON.parse(cur);fixSel();save();ui();redraw();}
function redo(){if(S.tool==='rail'&&window.RailEdit){RailEdit.redo();return;}if(!REDO.length)return;UNDO.push(cur);cur=REDO.pop();doc=JSON.parse(cur);fixSel();save();ui();redraw();}
function fixSel(){const s=S.sel;if(s&&!(s.k==='node'?doc.nodes[s.id]:s.k==='edge'?doc.edges[s.id]:doc.stops[s.id]))S.sel=null;
  if(S.line&&!doc.lines[S.line])S.line=null;if(S.poly&&!doc.nodes[S.poly])S.poly=null;
  if(!doc.types.road.find(t=>t.id===S.road))S.road=doc.types.road[0]&&doc.types.road[0].id;
  if(!doc.types.stop.find(t=>t.id===S.stopT))S.stopT=doc.types.stop[0]&&doc.types.stop[0].id;
  if(!doc.types.line.find(t=>t.id===S.lineT))S.lineT=doc.types.line[0]&&doc.types.line[0].id;}

/* ---------------- 見る位置 ---------------- */
const toW=(sx,sy)=>[sx/V.z+V.x,sy/V.z+V.y];
function fit(){const m=V.w<700?16:90,top=V.w<700?70:80,bot=V.w<700?140:110;const b=doc?bounds():[0,0,1000,420],bw=b[2]-b[0],bh=b[3]-b[1],cx=(b[0]+b[2])/2,cy=(b[1]+b[3])/2;
  let z=Math.min((V.w-m*2)/bw,(V.h-top-bot)/bh);if(fit.mob&&V.w<700)z=Math.min(z*2.2,(V.h-top-bot)/420);fit.mob=false;V.z=z;V.x=cx-V.w/2/z;V.y=cy-(top+(V.h-top-bot)/2)/z;redraw();}
function zoomAt(f,sx,sy){const [wx,wy]=toW(sx,sy);V.z=Math.max(0.25,Math.min(14,V.z*f));V.x=wx-sx/V.z;V.y=wy-sy/V.z;redraw();}
function resize(){V.dpr=Math.min(3,window.devicePixelRatio||1);V.w=innerWidth;V.h=innerHeight;cv.width=Math.round(V.w*V.dpr);cv.height=Math.round(V.h*V.dpr);redraw();}

/* ---------------- 線の描き方 ---------------- */
function dashOf(d,w){w=Math.max(w,0.6);return d==='dash'?[w*2.4,w*1.7]:d==='dot'?[0.01,w*2]:d==='dashdot'?[w*3,w*1.3,0.01,w*1.3]:[];}
const tyOf=(k,id)=>doc.types[k].find(t=>t.id===id)||doc.types[k][0];
// polys: [[x,y]…] の配列。st の見た目で、影 → 縁 → 発光つきの本体 の順に描く
function strokeStyled(c,polys,st,k,pass){const z=k.z,d=k.dpr,w=+st.width||2,cs=+st.casing||0,al=st.alpha==null?1:+st.alpha;
  const path=()=>{c.beginPath();polys.forEach(p=>{if(p.length<2)return;c.moveTo(p[0][0],p[0][1]);for(let i=1;i<p.length;i++)c.lineTo(p[i][0],p[i][1]);});};
  c.save();c.lineJoin='round';c.lineCap='round';c.globalAlpha=al;
  if((!pass||pass==='shadow')&&st.shadow){c.save();c.shadowColor='rgba(46,34,20,.38)';c.shadowBlur=3.2*z*d;c.shadowOffsetY=1.1*z*d;c.strokeStyle=cs>0?st.casingColor:st.color;c.lineWidth=w+cs*2;c.setLineDash(cs>0?[]:dashOf(st.dash,w));path();c.stroke();c.restore();}
  if((!pass||pass==='case')&&cs>0){c.strokeStyle=st.casingColor||'#fff';c.lineWidth=w+cs*2;c.setLineDash([]);path();c.stroke();}
  if(!pass||pass==='body'){if(+st.glow>0){c.shadowColor=st.color;c.shadowBlur=(+st.glow)*14*z*d;}
    c.strokeStyle=st.color;c.lineWidth=w;c.setLineDash(dashOf(st.dash,w));c.lineCap=st.dash==='dash'||st.dash==='dashdot'?'butt':'round';if(st.dash==='dot')c.lineCap='round';path();c.stroke();
    if(+st.glow>0.5){c.shadowBlur=0;c.globalAlpha=al*0.55;c.strokeStyle='#fff';c.lineWidth=Math.max(0.4,w*0.28);path();c.stroke();}}
  c.restore();}
const flatXY=f=>f.map(p=>[p.x,p.y]);

// 停留所の印
function shapePath(c,shape,x,y,r){c.beginPath();
  if(shape==='square'){c.roundRect(x-r,y-r,r*2,r*2,r*0.28);}
  else if(shape==='diamond'){c.moveTo(x,y-r*1.25);c.lineTo(x+r*1.25,y);c.lineTo(x,y+r*1.25);c.lineTo(x-r*1.25,y);c.closePath();}
  else if(shape==='pill'){c.roundRect(x-r*1.7,y-r*0.95,r*3.4,r*1.9,r*0.95);}
  else if(shape==='hex'){for(let i=0;i<6;i++){const a=Math.PI/3*i+Math.PI/6;c[i?'lineTo':'moveTo'](x+Math.cos(a)*r*1.12,y+Math.sin(a)*r*1.12);}c.closePath();}
  else if(shape==='tri'){c.moveTo(x,y-r*1.3);c.lineTo(x+r*1.2,y+r*0.8);c.lineTo(x-r*1.2,y+r*0.8);c.closePath();}
  else if(shape==='star'){for(let i=0;i<10;i++){const a=-Math.PI/2+Math.PI/5*i,rr=i%2?r*0.55:r*1.35;c[i?'lineTo':'moveTo'](x+Math.cos(a)*rr,y+Math.sin(a)*rr);}c.closePath();}
  else c.arc(x,y,r,0,Math.PI*2);}
function drawMarker(c,ty,x,y,k,sel){const r=(+ty.size||5)*(sel?1.15:1),lw=Math.max(0.8,r*0.32);
  c.save();c.shadowColor='rgba(40,30,20,.35)';c.shadowBlur=2.4*k.z*k.dpr;c.shadowOffsetY=0.8*k.z*k.dpr;
  c.fillStyle=ty.stroke||'#fff';shapePath(c,ty.shape,x,y,r+lw);c.fill();c.restore();
  c.fillStyle=ty.fill||'#fff';shapePath(c,ty.shape,x,y,r);c.fill();
  if(ty.shape==='ring'){c.fillStyle=ty.stroke||'#fff';c.beginPath();c.arc(x,y,r*0.45,0,7);c.fill();}
  if(ty.shape==='anchor'){c.save();c.strokeStyle=ty.stroke||'#fff';c.lineWidth=r*0.17;c.lineCap='round';c.beginPath();c.moveTo(x,y-r*0.55);c.lineTo(x,y+r*0.6);c.moveTo(x-r*0.38,y-r*0.25);c.lineTo(x+r*0.38,y-r*0.25);
    c.moveTo(x-r*0.6,y+r*0.05);c.quadraticCurveTo(x-r*0.5,y+r*0.62,x,y+r*0.6);c.quadraticCurveTo(x+r*0.5,y+r*0.62,x+r*0.6,y+r*0.05);c.stroke();c.beginPath();c.arc(x,y-r*0.66,r*0.14,0,7);c.stroke();c.restore();}
  if(sel){c.save();c.strokeStyle='#e2553f';c.lineWidth=1.4/k.z*1.2;c.setLineDash([3/k.z,2.5/k.z]);shapePath(c,ty.shape==='pill'?'pill':'circle',x,y,r+lw+3/k.z);c.stroke();c.restore();}}
const LPV={n:[0,-1],ne:[0.75,-0.75],e:[1,0],se:[0.75,0.75],s:[0,1],sw:[-0.75,0.75],w:[-1,0],nw:[-0.75,-0.75]};
function autoLP(nid,boxes,x,y,r,tw,th){const dirs=C.edgesOf(doc,nid).map(id=>{const e=doc.edges[id],c=C.ctrlOf(doc,e),q=e.a===nid?c[1]:c[c.length-2];return Math.atan2(q[1]-y,q[0]-x);});
  let best='e',bs=-1e9;for(const k of ['e','ne','n','w','nw','se','s','sw']){const v=LPV[k],a=Math.atan2(v[1],v[0]);let m=Math.PI;dirs.forEach(dd=>{let df=Math.abs(((a-dd)%(Math.PI*2)+Math.PI*3)%(Math.PI*2)-Math.PI);m=Math.min(m,df);});
    const b=labelBox(k,x,y,r,tw,th);let ov=0;boxes.forEach(o=>{const ix=Math.max(0,Math.min(b[2],o[2])-Math.max(b[0],o[0])),iy=Math.max(0,Math.min(b[3],o[3])-Math.max(b[1],o[1]));ov+=ix*iy;});
    const sc=m*10-ov*0.6-(k==='e'?0:k==='w'?0.4:1.2);if(sc>bs){bs=sc;best=k;}}return best;}
function labelBox(k,x,y,r,tw,th){const v=LPV[k],g=r+3;let cx=x+v[0]*(g+(v[0]?tw/2:0)),cy=y+v[1]*(g+(v[1]?th/2:0));return [cx-tw/2,cy-th/2,cx+tw/2,cy+th/2];}
function drawLabel(c,s,ty,x,y,k,boxes){if(ty.label==='none'||!s.name)return;const fs=(+ty.fontSize||8.5)*(s.big?1.25:1);
  c.font=`700 ${fs}px ${FONTS[ty.font]||FONTS.gothic}`;const tw=c.measureText(s.name).width+(ty.label==='tag'?fs*0.9:0),th=fs*(ty.label==='tag'?1.55:1.2);
  const r=(+ty.size||5)*(ty.shape==='pill'?1.6:1.15)+1;const lp=s.lp&&s.lp!=='auto'?s.lp:autoLP(s.node,boxes,x,y,r,tw,th);const b=labelBox(lp,x,y,r,tw,th);boxes.push(b);
  const cx=(b[0]+b[2])/2,cy=(b[1]+b[3])/2;c.textAlign='center';c.textBaseline='middle';
  if(ty.label==='tag'){c.save();c.shadowColor='rgba(40,30,20,.3)';c.shadowBlur=2*k.z*k.dpr;c.shadowOffsetY=0.6*k.z*k.dpr;c.fillStyle=ty.tagColor||(ty.fill==='#ffffff'?ty.stroke:ty.fill)||'#2c3a35';c.beginPath();c.roundRect(b[0],b[1],b[2]-b[0],b[3]-b[1],fs*0.42);c.fill();c.restore();
    c.strokeStyle='rgba(255,255,255,.9)';c.lineWidth=0.6;c.stroke();c.fillStyle='#fff';c.fillText(s.name,cx,cy+fs*0.04);}
  else{c.lineJoin='round';c.strokeStyle='rgba(255,253,246,.94)';c.lineWidth=fs*0.36;if(ty.label!=='plain')c.strokeText(s.name,cx,cy);c.fillStyle=ty.ink||'#24312c';c.fillText(s.name,cx,cy);}}

/* ---------------- 路線の形（同じ道は並べてずらす） ---------------- */
function offsetPoly(f,off){if(!off)return f.map(p=>[p.x,p.y]);const n=f.length,out=[];
  for(let i=0;i<n;i++){const a=f[Math.max(0,i-1)],b=f[Math.min(n-1,i+1)];let dx=b.x-a.x,dy=b.y-a.y;const L=Math.hypot(dx,dy)||1;out.push([f[i].x-dy/L*off,f[i].y+dx/L*off]);}return out;}
function linesGeom(ids){const adj=C.adjacency(doc),L=C.lineLanes(doc,ids),flat={};const ef=id=>flat[id]||(flat[id]=C.edgeFlat(doc,doc.edges[id]));
  const wOf=lid=>{const st=C.lineStyle(doc,doc.lines[lid]);return (+st.width||2)+2*(+st.casing||0);};
  const gap={};for(const [eid,m] of Object.entries(L.lane)){gap[eid]=Math.max(...Object.keys(m).map(wOf))*0.92;}
  const out={};
  ids.forEach(lid=>{const l=doc.lines[lid],polys=[];let curp=null;
    C.linePath(doc,l,adj).forEach(g=>{
      if(!g.edges){const A=doc.nodes[g.a],B=doc.nodes[g.b],dx=B.x-A.x,dy=B.y-A.y,len=Math.hypot(dx,dy)||1,bend=Math.min(60,len*0.16),mx=(A.x+B.x)/2-dy/len*bend,my=(A.y+B.y)/2+dx/len*bend,pts=[];
        for(let i=0;i<=24;i++){const t=i/24,u=1-t;pts.push([u*u*A.x+2*u*t*mx+t*t*B.x,u*u*A.y+2*u*t*my+t*t*B.y]);}
        if(curp){curp.push(...pts.slice(1));}else{curp=pts;polys.push(curp);}return;}
      g.edges.forEach(x=>{const n=L.cnt[x.id]||1,i=L.lane[x.id]?L.lane[x.id][lid]:0,off=(i-(n-1)/2)*(gap[x.id]||3);let p=offsetPoly(ef(x.id),off);if(x.rev)p=p.reverse();
        if(curp){curp.push(...p);}else{curp=p;polys.push(curp);}});});
    out[lid]=polys;});
  return out;}

/* ---------------- 背景：机・地図の絵・線路と駅 ---------------- */
function drawTable(c,k){c.save();c.setTransform(1,0,0,1,0,0);const g=c.createLinearGradient(0,0,c.canvas.width,c.canvas.height);g.addColorStop(0,'#e3ebe8');g.addColorStop(0.55,'#dde6e5');g.addColorStop(1,'#e9ecdf');c.fillStyle=g;c.fillRect(0,0,c.canvas.width,c.canvas.height);c.restore();
  // うすい方眼の点（地図の外にも描けることがわかるように）
  const step=k.z<0.6?100:k.z<2.5?25:5;const [x0,y0]=[k.x,k.y],x1=k.x+k.w/k.z,y1=k.y+k.h/k.z;c.fillStyle='rgba(60,90,90,.16)';const r=1.1/k.z;
  if((x1-x0)/step*(y1-y0)/step<12000)for(let x=Math.floor(x0/step)*step;x<x1;x+=step)for(let y=Math.floor(y0/step)*step;y<y1;y+=step){c.fillRect(x-r,y-r,r*2,r*2);}}
function drawSheet(c,k){const W=DEF.world.w,H=DEF.world.h;
  c.save();c.shadowColor='rgba(40,50,45,.28)';c.shadowBlur=26*k.z*k.dpr;c.shadowOffsetY=8*k.z*k.dpr;c.fillStyle='#f5f1e4';c.fillRect(-3,-3,W+6,H+6);c.restore();
  if(MAP.complete&&MAP.naturalWidth){c.save();c.globalAlpha=doc.view.mapAlpha;c.imageSmoothingQuality='high';c.drawImage(MAP,0,0,W,H);c.restore();}
  c.strokeStyle='rgba(255,255,255,.85)';c.lineWidth=1.6;c.strokeRect(-0.8,-0.8,W+1.6,H+1.6);}
function drawRail(c,k){if(window.RailEdit&&(doc.view.rail||S.tool==='rail')){RailEdit.drawRail(c,k,S.tool==='rail');return;}   // 第7回：線路は「線路」の層の形で（js/rail-edit.js）
  if(!doc.view.rail)return;const R=DEF.rail,P=s=>[R.stations[s].x,R.stations[s].y];
  const polys=R.lines.map(L=>L.map(P));
  [['#e9ebe4',4.4,[],1],['#a87a5f',3.1,[],1],['#f4efe2',1.6,[2.6,2.6],1]].forEach(([col,w,d])=>{c.save();c.strokeStyle=col;c.lineWidth=w;c.lineJoin='round';c.lineCap=d.length?'butt':'round';c.setLineDash(d);c.beginPath();polys.forEach(p=>{c.moveTo(...p[0]);p.slice(1).forEach(q=>c.lineTo(...q));});c.stroke();c.restore();});
  c.textAlign='center';c.textBaseline='middle';
  Object.values(R.stations).forEach(s=>{c.fillStyle='#fff';c.strokeStyle='#3d7f63';c.lineWidth=1.6;c.beginPath();c.roundRect(s.x-4.5,s.y-3.2,9,6.4,3.2);c.fill();c.stroke();
    const fs=s.big?10.5:9.2;c.font=`700 ${fs}px ${FONTS.gothic}`;const w=c.measureText(s.name).width+fs*0.9,h=fs*1.55,y=s.y+11+h/2;
    c.save();c.shadowColor='rgba(0,0,0,.22)';c.shadowBlur=2*k.z*k.dpr;c.shadowOffsetY=0.7*k.z*k.dpr;c.fillStyle=s.big?'#2b6f52':'#3d7f63';c.beginPath();c.roundRect(s.x-w/2,y-h/2,w,h,3.4);c.fill();c.restore();
    c.strokeStyle='#fff';c.lineWidth=0.9;c.stroke();c.fillStyle='#fff';c.fillText(s.name,s.x,y+0.4);});}

/* ---------------- 全体を描く（画面とPNGで共通） ---------------- */
function drawScene(c,k,o){o=o||{};
  c.setTransform(k.dpr,0,0,k.dpr,0,0);drawTable(c,k);
  c.setTransform(k.z*k.dpr,0,0,k.z*k.dpr,-k.x*k.z*k.dpr,-k.y*k.z*k.dpr);
  drawSheet(c,k);drawRail(c,k);
  // 道：影 → すべての縁 → すべての本体（交わるところがきれいにつながる）
  const by={};for(const [id,e] of Object.entries(doc.edges))(by[e.type]=by[e.type]||[]).push(flatXY(C.edgeFlat(doc,e)));
  const order=doc.types.road.slice().reverse().filter(t=>by[t.id]);Object.keys(by).forEach(t=>{if(!doc.types.road.find(x=>x.id===t))order.push({id:t,style:doc.types.road[0].style});});
  ['shadow','case','body'].forEach(p=>order.forEach(t=>strokeStyled(c,by[t.id],t.style,k,p)));
  // 路線
  const ids=doc.order.filter(id=>doc.lines[id]&&doc.lines[id].show!==false);const G=linesGeom(ids);
  const dim=!o.export&&S.tool==='line'&&S.line;
  ['shadow','case','body'].forEach(p=>ids.forEach(lid=>{const st=C.lineStyle(doc,doc.lines[lid]);if(dim&&lid!==S.line)st.alpha=(st.alpha==null?1:st.alpha)*0.3;strokeStyled(c,G[lid],st,k,p);}));
  // 点（描くときだけ見せる）
  if(!o.export&&S.tool!=='hand'){const deg={};Object.values(doc.edges).forEach(e=>{deg[e.a]=(deg[e.a]||0)+1;deg[e.b]=(deg[e.b]||0)+1;});const r=3/k.z,stopN=new Set(Object.values(doc.stops).map(s=>s.node));
    for(const [id,n] of Object.entries(doc.nodes)){if(stopN.has(id))continue;const d=deg[id]||0;if(S.tool!=='select'&&d===2)continue;
      c.fillStyle=d>2?'#24312c':'#fff';c.strokeStyle=d>2?'#fff':'#24312c';c.lineWidth=1.2/k.z;c.beginPath();c.arc(n.x,n.y,d>2?r*1.05:r*0.85,0,7);c.fill();c.stroke();}}
  // 選んだ道：形を変える点
  if(!o.export&&S.sel&&S.sel.k==='edge'&&doc.edges[S.sel.id]){const e=doc.edges[S.sel.id];c.save();c.strokeStyle='#e2553f';c.lineWidth=1.6/k.z;c.setLineDash([5/k.z,3/k.z]);const f=C.edgeFlat(doc,e);c.beginPath();f.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.stroke();
    c.setLineDash([]);const cp=C.ctrlOf(doc,e);c.strokeStyle='rgba(226,85,63,.45)';c.lineWidth=1/k.z;c.beginPath();cp.forEach((p,i)=>i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]));c.stroke();
    cp.forEach((p,i)=>{c.fillStyle=i&&i<cp.length-1?'#fff':'#e2553f';c.strokeStyle='#e2553f';c.lineWidth=1.6/k.z;c.beginPath();c.arc(p[0],p[1],(i&&i<cp.length-1?4.5:3.5)/k.z,0,7);c.fill();c.stroke();});c.restore();}
  if(!o.export&&S.sel&&S.sel.k==='node'&&doc.nodes[S.sel.id]){const n=doc.nodes[S.sel.id];c.strokeStyle='#e2553f';c.lineWidth=2/k.z;c.beginPath();c.arc(n.x,n.y,7/k.z,0,7);c.stroke();}
  // 停留所
  const boxes=[];const stops=Object.entries(doc.stops);
  stops.forEach(([id,s])=>{const n=doc.nodes[s.node];if(!n)return;const ty=Object.assign({},tyOf('stop',s.type),s.style||{});drawMarker(c,ty,n.x,n.y,k,!o.export&&S.sel&&S.sel.k==='stop'&&S.sel.id===id);});
  stops.forEach(([id,s])=>{const n=doc.nodes[s.node];if(!n)return;const ty=Object.assign({},tyOf('stop',s.type),s.style||{});drawLabel(c,s,ty,n.x,n.y,k,boxes);});
  if(o.export)return;
  if(S.tool==='rail'&&window.RailEdit){RailEdit.drawOverlay(c,k);return;}   // 線路の層：つかめる点
  // 描いている途中
  if(S.stroke&&S.stroke.pts.length>1){strokeStyled(c,[S.stroke.pts],tyOf('road',S.road).style,k);}
  if(S.poly&&doc.nodes[S.poly]&&S.hover){const n=doc.nodes[S.poly];const st=Object.assign({},tyOf('road',S.road).style);st.alpha=0.55;strokeStyled(c,[[[n.x,n.y],S.hover]],st,k);
    c.fillStyle='#e2553f';c.beginPath();c.arc(n.x,n.y,4/k.z,0,7);c.fill();}
  if(S.tool==='line'&&S.line&&doc.lines[S.line]){const l=doc.lines[S.line];l.seq.forEach((it,i)=>{const n=doc.nodes[C.itemNode(doc,it)];if(!n)return;c.fillStyle=C.lineStyle(doc,l).color;c.strokeStyle='#fff';c.lineWidth=1.5/k.z;
      c.beginPath();c.arc(n.x,n.y,(it.v?3.2:7)/k.z,0,7);c.fill();c.stroke();if(!it.v){c.fillStyle='#fff';c.font=`700 ${8/k.z}px ${FONTS.maru}`;c.textAlign='center';c.textBaseline='middle';c.fillText(String(l.seq.filter((q,j)=>j<=i&&q.s).length),n.x,n.y+0.3/k.z);}});}
  if(S.snap){c.strokeStyle='#e2553f';c.lineWidth=2/k.z;c.beginPath();c.arc(S.snap[0],S.snap[1],8/k.z,0,7);c.stroke();}
}
function frame(){if(dirty&&doc){dirty=false;drawScene(ctx,{x:V.x,y:V.y,z:V.z,w:V.w,h:V.h,dpr:V.dpr});}requestAnimationFrame(frame);}

/* ---------------- 当たり判定 ---------------- */
const tol=()=>(S.touch?16:9)/V.z;
function hitStop(p){let best=null,bd=1e9;for(const [id,s] of Object.entries(doc.stops)){const n=doc.nodes[s.node];if(!n)continue;const ty=tyOf('stop',s.type),r=(+((s.style||{}).size||ty.size)||5)*(ty.shape==='pill'?1.7:1.3)+tol()*0.6,d=Math.hypot(n.x-p[0],n.y-p[1]);if(d<r&&d<bd){bd=d;best=id;}}return best;}
const hitNode=(p,skip)=>C.nearestNode(doc,p,tol(),skip);
const hitEdge=p=>C.nearestEdge(doc,p,tol()*0.85);
function hitHandle(p){if(!S.sel||S.sel.k!=='edge')return null;const e=doc.edges[S.sel.id];if(!e)return null;for(let i=0;i<e.pts.length;i++)if(Math.hypot(e.pts[i][0]-p[0],e.pts[i][1]-p[1])<tol())return i;return null;}

/* ---------------- 指・マウス ---------------- */
const P=new Map();let op=null,gest=null,lastTap={t:0,x:0,y:0};
function pos(ev){const r=cv.getBoundingClientRect();return [ev.clientX-r.left,ev.clientY-r.top];}
cv.addEventListener('pointerdown',ev=>{cv.setPointerCapture(ev.pointerId);S.touch=ev.pointerType!=='mouse';closePops();
  const sp=pos(ev);P.set(ev.pointerId,sp);
  if(P.size===2){if(op&&op.k==='rail')RailEdit.cancel();else if(op&&op.live)revert();if(op&&op.k==='stroke')S.stroke=null;op=null;const [a,b]=[...P.values()];gest={d:Math.hypot(a[0]-b[0],a[1]-b[1]),m:[(a[0]+b[0])/2,(a[1]+b[1])/2]};redraw();return;}
  if(P.size>2)return;
  const w=toW(...sp);const btn=ev.button;
  if(btn===2&&S.tool==='poly'&&S.poly){op=null;endPoly();return;}
  if(btn===2&&S.tool==='rail'&&window.RailEdit&&RailEdit.drawing){op=null;RailEdit.endDraw();return;}   // 側線：右クリックで終わる   // 右クリック：最後に置いた点で線を終える（右クリックした場所には点を置かない）
  if(btn===1||btn===2||S.tool==='hand'||S.space){op={k:'pan',sp,v:[V.x,V.y]};cv.classList.add('dragging');return;}
  if(S.tool==='rail'&&window.RailEdit){const r=RailEdit.down(w,tol());op=r?{k:'rail',sp,w,r,live:true,moved:false}:{k:'pan',sp,v:[V.x,V.y],tapEmpty:true,rail:true};return;}   // 線路の層
  op={k:'tap',sp,w,moved:false};
  if(S.tool==='pen'){op.k='stroke';S.stroke={pts:[w]};S.snap=null;}
  else if(S.tool==='select'){const h=hitHandle(w);if(h!=null){op={k:'pt',sp,w,i:h,live:true};return;}
    const st=hitStop(w);if(st){op={k:'node',sp,w,id:doc.stops[st].node,sel:{k:'stop',id:st},live:true};return;}
    const n=hitNode(w);if(n){op={k:'node',sp,w,id:n,sel:{k:'node',id:n},live:true};return;}
    const e=hitEdge(w);if(e){op={k:'edge',sp,w,e,live:true};return;}
    op={k:'pan',sp,v:[V.x,V.y],tapEmpty:true};}
});
cv.addEventListener('pointermove',ev=>{const sp=pos(ev);if(P.has(ev.pointerId))P.set(ev.pointerId,sp);
  if(gest&&P.size>=2){const [a,b]=[...P.values()],d=Math.hypot(a[0]-b[0],a[1]-b[1]),m=[(a[0]+b[0])/2,(a[1]+b[1])/2];zoomAt(d/gest.d,m[0],m[1]);V.x-=(m[0]-gest.m[0])/V.z;V.y-=(m[1]-gest.m[1])/V.z;gest={d,m};return;}
  const w=toW(...sp);
  if(!op){S.hover=w;if(S.tool==='poly'&&S.poly)redraw();hoverCursor(w);return;}
  const mv=Math.hypot(sp[0]-op.sp[0],sp[1]-op.sp[1]);if(mv>4)op.moved=true;
  if(op.k==='rail'){if(op.moved&&op.r.k!=='drawtap'){RailEdit.move(op.r,w);redraw();}return;}
  if(op.k==='tap'&&op.moved){op={k:'pan',sp:op.sp,v:[V.x,V.y]};}
  if(op.k==='pan'){if(op.moved||Math.hypot(sp[0]-op.sp[0],sp[1]-op.sp[1])>4){V.x=op.v[0]-(sp[0]-op.sp[0])/V.z;V.y=op.v[1]-(sp[1]-op.sp[1])/V.z;cv.classList.add('dragging');redraw();}return;}
  if(op.k==='stroke'){const L=S.stroke.pts[S.stroke.pts.length-1];if(Math.hypot(w[0]-L[0],w[1]-L[1])>1.2/V.z){S.stroke.pts.push(w);const n=hitNode(w);S.snap=n?[doc.nodes[n].x,doc.nodes[n].y]:null;redraw();}return;}
  if(op.k==='node'&&op.moved){const n=doc.nodes[op.id];if(!n)return;n.x=+w[0].toFixed(1);n.y=+w[1].toFixed(1);const t=hitNode(w,new Set([op.id]));S.snap=t?[doc.nodes[t].x,doc.nodes[t].y]:null;op.drag=true;redraw();return;}
  if(op.k==='pt'&&op.moved){const e=doc.edges[S.sel.id];e.pts[op.i]=[+w[0].toFixed(1),+w[1].toFixed(1)];redraw();return;}
  if(op.k==='edge'&&op.moved){if(!op.bent){const e=doc.edges[op.e.id];if(!e){op=null;return;}S.sel={k:'edge',id:op.e.id};C.insertBend(doc,op.e.id,op.e.x,op.e.y,op.e.k);e.smooth=true;op.bent=op.e.k;ui();}
    const e=doc.edges[op.e.id];e.pts[op.bent]=[+w[0].toFixed(1),+w[1].toFixed(1)];redraw();return;}
});
function endPointer(ev){const had=P.has(ev.pointerId);P.delete(ev.pointerId);if(gest){if(P.size<2)gest=null;op=null;return;}if(!had||!op)return;
  const o=op;op=null;cv.classList.remove('dragging');const w=toW(...pos(ev));
  if(o.k==='rail'){RailEdit.up(o.r,w,o.moved,dbl(o.sp));return;}
  if(o.k==='pan'){if(o.tapEmpty&&!o.moved){if(o.rail){RailEdit.tapEmpty(w,dbl(o.sp));return;}S.sel=null;ui();redraw();}return;}
  if(o.k==='stroke'){const raw=S.stroke.pts;S.stroke=null;S.snap=null;
    if(raw.length>2&&C.polyLen(raw.map(p=>({x:p[0],y:p[1]})))>6/V.z){const pts=C.simplify(raw,1.6/V.z);C.addPath(doc,pts,{type:S.road,smooth:true,snap:12/V.z});commit();}
    else tapPen(w);redraw();return;}
  if(o.k==='node'){S.snap=null;if(o.drag){const t=hitNode(w,new Set([o.id]));if(t)C.mergeNodes(doc,o.id,t);else{const e=C.nearestEdge(doc,w,tol()*0.7,new Set(C.edgesOf(doc,o.id)));if(e){const m=C.splitEdge(doc,e.id,e.x,e.y,e.k);C.mergeNodes(doc,o.id,m);}}
      S.sel=o.sel.k==='node'?(doc.nodes[o.id]?o.sel:(t?{k:'node',id:t}:null)):o.sel;commit();}
    else{if(dbl(o.sp)&&o.sel.k==='node'){} S.sel=o.sel;ui();redraw();}return;}
  if(o.k==='pt'){if(o.moved)commit();else if(dbl(o.sp)){doc.edges[S.sel.id].pts.splice(o.i,1);commit();}return;}
  if(o.k==='edge'){if(o.bent!=null){commit();return;}
    if(dbl(o.sp)){const m=C.splitEdge(doc,o.e.id,o.e.x,o.e.y,o.e.k);S.sel={k:'node',id:m};commit();toast('点を足しました。引っぱると道が分かれます');return;}
    S.sel={k:'edge',id:o.e.id};ui();redraw();lastTap={t:performance.now(),x:o.sp[0],y:o.sp[1]};return;}
  if(o.k==='tap'&&!o.moved){if(S.tool==='poly')tapPoly(w,o.sp);else if(S.tool==='stop')tapStop(w);else if(S.tool==='line')tapLine(w);}
}
function dbl(sp){const t=performance.now(),r=t-lastTap.t<380&&Math.hypot(sp[0]-lastTap.x,sp[1]-lastTap.y)<14;lastTap=r?{t:0,x:0,y:0}:{t,x:sp[0],y:sp[1]};return r;}
cv.addEventListener('pointerup',endPointer);cv.addEventListener('pointercancel',ev=>{P.delete(ev.pointerId);if(op&&op.k==='rail'){RailEdit.cancel();}else if(op&&op.live)revert();if(op&&op.k==='stroke')S.stroke=null;op=null;gest=null;redraw();});
cv.addEventListener('pointerleave',()=>{if(!op){S.hover=null;redraw();}});
cv.addEventListener('wheel',ev=>{ev.preventDefault();const sp=pos(ev);
  if(ev.shiftKey&&!ev.ctrlKey){V.x+=(ev.deltaY||ev.deltaX)/V.z;redraw();return;}
  if(!ev.ctrlKey&&Math.abs(ev.deltaX)>Math.abs(ev.deltaY)){V.x+=ev.deltaX/V.z;V.y+=ev.deltaY/V.z;redraw();return;}
  const dy=ev.deltaY*(ev.deltaMode===1?33:1);zoomAt(Math.exp(-dy*(ev.ctrlKey?0.01:0.0016)),sp[0],sp[1]);},{passive:false});
cv.addEventListener('contextmenu',e=>e.preventDefault());
function hoverCursor(w){if(S.tool==='rail'&&window.RailEdit){cv.style.cursor=RailEdit.hover(w,tol());redraw();return;}if(S.tool!=='select'){cv.style.cursor='';return;}cv.style.cursor=hitHandle(w)!=null||hitStop(w)||hitNode(w)?'move':hitEdge(w)?'pointer':'';}

function tapPen(w){const st=hitStop(w);if(st){S.sel={k:'stop',id:st};setTool('select');}}
function tapPoly(w,sp){const ty=S.road;
  if(!S.poly){const n=C.anchor(doc,w,12/V.z);S.poly=n;lastTap={t:performance.now(),x:sp[0],y:sp[1]};redraw();return;}
  const from=doc.nodes[S.poly];if(dbl(sp)||Math.hypot(from.x-w[0],from.y-w[1])<tol()){endPoly();return;}
  const r=C.addPath(doc,[[from.x,from.y],w],{from:S.poly,type:ty,smooth:false,snap:12/V.z});S.poly=r?r.b:null;commit();lastTap={t:performance.now(),x:sp[0],y:sp[1]};}
function endPoly(){if(S.poly){C.dropOrphan(doc,S.poly);S.poly=null;commit();redraw();}}
function tapStop(w){const hit=hitStop(w);if(hit){S.sel={k:'stop',id:hit};ui();redraw();focusName();return;}
  const n=C.anchor(doc,w,12/V.z);const ty=tyOf('stop',S.stopT);const cnt=Object.values(doc.stops).filter(s=>s.type===ty.id).length+1;
  const id=C.uid(doc,'s');doc.stops[id]={name:ty.name+cnt,type:ty.id,node:n,lp:'auto'};S.sel={k:'stop',id};commit();focusName();}
function newLine(){const t=tyOf('line',S.lineT);const id=C.uid(doc,'l');const n=doc.order.length+1;
  doc.lines[id]={name:t.name+' '+n+'号',type:t.id,style:{},seq:[],freq:{unit:'h',n:2},first:'06:30',last:'21:30',round:true,show:true};doc.order.push(id);S.line=id;return id;}
function tapLine(w){if(!S.line||!doc.lines[S.line])newLine();const l=doc.lines[S.line];
  const st=hitStop(w);let it=null;if(st)it={s:st};else{const n=hitNode(w);if(n)it={v:n};else{const e=hitEdge(w);if(e)it={v:C.splitEdge(doc,e.id,e.x,e.y,e.k)};}}
  if(!it){toast('停留所か道の上を押すと、路線に入ります');return;}
  const last=l.seq[l.seq.length-1];if(last&&(last.s===it.s&&it.s||last.v===it.v&&it.v))return;
  l.seq.push(it);commit();if(innerWidth>=700)showLines(true);}

/* ---------------- キー ---------------- */
addEventListener('keydown',ev=>{const tag=(ev.target.tagName||'').toLowerCase();const typing=tag==='input'||tag==='textarea'||tag==='select';
  const mod=ev.ctrlKey||ev.metaKey;
  if(mod&&ev.key.toLowerCase()==='z'&&!typing){ev.preventDefault();ev.shiftKey?redo():undo();return;}
  if(mod&&ev.key.toLowerCase()==='y'&&!typing){ev.preventDefault();redo();return;}
  if(typing){if(ev.key==='Enter'||ev.key==='Escape')ev.target.blur();return;}
  if(ev.key===' '){S.space=true;cv.classList.add('panning');ev.preventDefault();return;}
  if(S.tool==='rail'&&window.RailEdit&&(ev.key==='Escape'||ev.key==='Enter')&&RailEdit.drawing){RailEdit.endDraw();return;}
  if(S.tool==='rail'&&window.RailEdit&&(ev.key==='Delete'||ev.key==='Backspace')){RailEdit.del();ev.preventDefault();return;}
  if(ev.key==='Escape'){if(S.poly)endPoly();else{S.sel=null;closePops();ui();redraw();}return;}
  if(ev.key==='Enter'&&S.poly){endPoly();return;}
  if(ev.key==='Delete'||ev.key==='Backspace'){delSel();ev.preventDefault();return;}
  const m={v:'select',b:'pen',p:'poly',s:'stop',l:'line',h:'hand',r:'rail'}[ev.key.toLowerCase()];if(m&&!mod)setTool(m);
  if(ev.key==='0'&&!mod)fit();if(ev.key==='+'||ev.key==='=')zoomAt(1.25,V.w/2,V.h/2);if(ev.key==='-')zoomAt(0.8,V.w/2,V.h/2);});
addEventListener('keyup',ev=>{if(ev.key===' '){S.space=false;cv.classList.remove('panning');}});
function delSel(){const s=S.sel;if(!s)return;if(s.k==='node')C.deleteNode(doc,s.id);else if(s.k==='edge')C.deleteEdge(doc,s.id);else if(s.k==='stop'){const n=doc.stops[s.id].node;C.deleteStop(doc,s.id);C.dropOrphan(doc,n);}S.sel=null;commit();}

/* ---------------- 見本の小さな絵 ---------------- */
function swatch(cvs,kind,obj){const d=Math.min(2,window.devicePixelRatio||1),W=cvs.clientWidth||40,H=cvs.clientHeight||18;cvs.width=W*d;cvs.height=H*d;const c=cvs.getContext('2d');c.setTransform(d,0,0,d,0,0);
  const k={z:1,dpr:d};
  if(kind==='stop'){const r=Math.min(H,W)/2-3,sz=Math.min(+obj.size||5,r/1.5);drawMarker(c,Object.assign({},obj,{size:sz}),W/2,H/2,k);return;}
  const st=Object.assign({},obj),sc=Math.min(1.6,(H*0.5)/((+st.width||2)+2*(+st.casing||0)));st.width=(+st.width||2)*Math.max(sc,0.9);st.casing=(+st.casing||0)*Math.max(sc,0.9);
  if(kind==='road'||kind==='line'){c.fillStyle=kind==='road'?'#c9d8b3':'#e6e9da';c.beginPath();c.roundRect(0,0,W,H,5);c.fill();}
  const pts=[];for(let i=0;i<=20;i++){const t=i/20;pts.push([4+t*(W-8),H/2+Math.sin(t*Math.PI*2)*H*0.2]);}strokeStyled(c,[pts],st,k);}

/* ---------------- 画面の部品 ---------------- */
const el=(tag,cls,html)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(html!=null)e.innerHTML=html;return e;};
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function chip(label,on,fn,sw){const b=el('button','chip'+(on?' on':''));if(sw){const c=el('canvas');b.appendChild(c);requestAnimationFrame(()=>swatch(c,sw[0],sw[1]));}b.appendChild(document.createTextNode(label));b.onclick=fn;return b;}
function setTool(t){if(S.poly&&t!=='poly')endPoly();if(S.tool==='rail'&&t!=='rail'&&window.RailEdit&&RailEdit.drawing)RailEdit.endDraw();S.tool=t;cv.className='t-'+t;if(t!=='select'&&S.sel&&!(t==='stop'&&S.sel.k==='stop'))S.sel=null;closePops();ui();redraw();}
document.querySelectorAll('.tool').forEach(b=>b.onclick=()=>setTool(b.dataset.t));
function focusName(){requestAnimationFrame(()=>{const i=document.querySelector('#dock .namein');if(i&&!S.touch){i.focus();i.select();}});}

function ui(){document.querySelectorAll('.tool').forEach(b=>b.classList.toggle('on',b.dataset.t===S.tool));
  const RL=S.tool==='rail'&&window.RailEdit;$('undo').disabled=RL?!RailEdit.canUndo:!UNDO.length;$('redo').disabled=RL?!RailEdit.canRedo:!REDO.length;dock();lineList();dots();
  $('railLbl').textContent=doc.view.rail?'線路と駅をかくす':'線路と駅を見せる';$('mapAlpha').value=doc.view.mapAlpha;}
function dots(){const d=$('ldots');d.innerHTML='';doc.order.slice(0,5).forEach(id=>{const i=el('i');i.style.background=C.lineStyle(doc,doc.lines[id]).color;d.appendChild(i);});if(!doc.order.length){const i=el('i');i.style.background='#c9c3b4';d.appendChild(i);}}

function typeRow(kind,curId,pick){const r=el('div','row');const arr=doc.types[kind];
  arr.forEach(t=>r.appendChild(chip(t.name,t.id===curId,()=>pick(t.id),[kind,kind==='stop'?t:t.style])));
  const ed=el('button','chip mini add','✎ 見た目');ed.onclick=()=>openStyle(kind,curId);r.appendChild(ed);
  const ad=el('button','chip mini add','＋ 種類');ad.onclick=()=>{const base=arr.find(t=>t.id===curId)||arr[0];const n=C.clone(base);n.id=C.uid(doc,kind[0]+'t');n.name='新しい'+({road:'道',stop:'拠点',line:'種類'}[kind]);if(n.style)n.style.color=DEF.palette[(arr.length*5)%DEF.palette.length];else n.fill=DEF.palette[(arr.length*5)%DEF.palette.length];arr.push(n);pick(n.id);commit();openStyle(kind,n.id);};r.appendChild(ad);
  return r;}
function dock(){const d=$('dock');d.innerHTML='';const s=S.sel;
  if(S.tool==='rail'&&window.RailEdit){RailEdit.dock(d,el,chip);d.hidden=!d.children.length;return;}   // 線路の層の棚
  if(S.tool==='pen'||S.tool==='poly'){d.appendChild(typeRow('road',S.road,id=>{S.road=id;ui();}));if(S.poly){const r=el('div','row');r.appendChild(chip('✓ ここで終わる',false,endPoly));d.appendChild(r);}}
  else if(S.tool==='stop'&&!(s&&s.k==='stop'))d.appendChild(typeRow('stop',S.stopT,id=>{S.stopT=id;ui();}));
  else if(S.tool==='line'){const r=el('div','row');doc.order.forEach(id=>{const l=doc.lines[id];r.appendChild(chip(l.name,id===S.line,()=>{S.line=id;ui();redraw();if(innerWidth>=700)showLines(true);},['line',C.lineStyle(doc,l)]));});
    const nb=el('button','chip mini add','＋ 新しい路線');nb.onclick=()=>{newLine();commit();if(innerWidth>=700)showLines(true);};r.appendChild(nb);d.appendChild(r);
    const l=S.line&&doc.lines[S.line];if(l&&innerWidth<700){const r3=el('div','row');const nS=l.seq.filter(x=>x.s).length;
      r3.appendChild(el('span','hint',nS?l.seq.filter(x=>x.s).map(x=>esc(doc.stops[x.s].name)).join(' › '):'停留所を順に押す'));
      if(l.seq.length){const b=el('button','chip mini add','1つもどす');b.onclick=()=>{l.seq.pop();commit();};r3.appendChild(b);}
      const e=el('button','chip mini add','くわしく');e.onclick=()=>showLines(true);r3.appendChild(e);d.appendChild(r3);}
    const r2=el('div','row');r2.appendChild(el('span','lab','種類'));doc.types.line.forEach(t=>r2.appendChild(chip(t.name,t.id===S.lineT,()=>{S.lineT=t.id;if(S.line&&doc.lines[S.line]&&!doc.lines[S.line].seq.length){doc.lines[S.line].type=t.id;commit();}else ui();},['line',t.style])));
    const ed=el('button','chip mini add','✎');ed.onclick=()=>openStyle('line',S.lineT);r2.appendChild(ed);d.appendChild(r2);}
  if(s&&(S.tool==='select'||S.tool==='stop')){
    if(s.k==='stop'){const st=doc.stops[s.id];const r=el('div','row');const i=el('input','namein');i.value=st.name;i.placeholder='名前（例：緑ヶ丘駅北口）';i.oninput=()=>{st.name=i.value;redraw();};i.onchange=()=>commit();r.appendChild(i);
      const lp=el('div','lp');LP.forEach(k=>{const b=el('button',(k==='auto'?'c':'')+((st.lp||'auto')===k?' on':''),k==='auto'?'自':'');b.title=k==='auto'?'名前の位置：おまかせ':'名前の位置';b.onclick=()=>{st.lp=k;commit();};lp.appendChild(b);});r.appendChild(lp);
      const del=el('button','chip mini danger','消す');del.onclick=delSel;r.appendChild(del);d.appendChild(r);
      d.appendChild(typeRow('stop',st.type,id=>{st.type=id;S.stopT=id;commit();}));
      // 止まれる台数（地図で走らせるとき、空いていなければ手前で待つ）
      const ty=tyOf('stop',st.type),dc=ty.cap||(DEF.run&&DEF.run.cap&&DEF.run.cap[ty.id])||1,cap=st.cap>0?st.cap:dc;
      const rc=el('div','row');rc.appendChild(el('span','lab','止まれる'));const sg=el('div','seg capseg');
      const mk=(t,fn,on)=>{const b=el('button',on?'on':'',t);b.onclick=fn;sg.appendChild(b);};
      mk('−',()=>{st.cap=Math.max(1,cap-1);commit();});mk(cap+'台',()=>{delete st.cap;commit();},st.cap>0);mk('＋',()=>{st.cap=Math.min(12,cap+1);commit();});
      rc.appendChild(sg);rc.appendChild(el('span','hint',st.cap>0?'まんなかを押すと種類のふつう（'+dc+'台）にもどる':'種類のふつう'));d.appendChild(rc);}
    else if(s.k==='edge'){const e=doc.edges[s.id];d.appendChild(typeRow('road',e.type,id=>{e.type=id;S.road=id;commit();}));
      const r=el('div','row');const sg=el('div','seg');[['なめらか',true],['かくかく',false]].forEach(([n,v])=>{const b=el('button',e.smooth===v?'on':'',n);b.onclick=()=>{e.smooth=v;commit();};sg.appendChild(b);});r.appendChild(sg);
      r.appendChild(el('span','hint','道を引っぱると曲がる・2回押すと点を足す'));const del=el('button','chip mini danger','消す');del.onclick=delSel;r.appendChild(del);d.appendChild(r);}
    else if(s.k==='node'){const r=el('div','row');const n=C.edgesOf(doc,s.id).length;
      r.appendChild(chip('ここに停留所',false,()=>{const ty=tyOf('stop',S.stopT);const id=C.uid(doc,'s');doc.stops[id]={name:ty.name+(Object.keys(doc.stops).length+1),type:ty.id,node:s.id,lp:'auto'};S.sel={k:'stop',id};commit();focusName();}));
      if(n>1)r.appendChild(chip('分ける',false,()=>{C.detachNode(doc,s.id);commit();toast('点を分けました。それぞれ動かせます');}));
      r.appendChild(el('span','hint','ほかの点に重ねると、まとまる'));
      const del=el('button','chip mini danger','消す');del.onclick=delSel;r.appendChild(del);d.appendChild(r);}}
  d.hidden=!d.children.length;}

/* ---------------- 路線の帳面 ---------------- */
function showLines(v){const p=$('lines');p.hidden=!v;S.showLines=v;if(v){$('menu').hidden=true;}lineList();}
$('linesBtn').onclick=()=>showLines($('lines').hidden);$('linesClose').onclick=()=>showLines(false);
const eyeSvg=on=>on?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>':'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3 3l18 18M10.6 5.1A10 10 0 0112 5c6.4 0 10 7 10 7a17 17 0 01-3.2 4M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7a9.6 9.6 0 005.4-1.6"/></svg>';
function lineList(){if($('lines').hidden)return;const box=$('lineList');box.innerHTML='';
  if(!doc.order.length){box.appendChild(el('div','hint','<div style="padding:4px 8px 10px">まだ路線がありません。<br>「路線」の道具で、停留所を順に押してください。</div>'));}
  doc.order.forEach((id,idx)=>{const l=doc.lines[id],t=C.lineType(doc,l);const row=el('div','lrow'+(id===S.line?' on':''));const c=el('canvas');row.appendChild(c);requestAnimationFrame(()=>swatch(c,'line',C.lineStyle(doc,l)));
    const nm=el('div','nm',esc(l.name)+'<small>'+esc(t?t.name:'')+'・停留所'+l.seq.filter(x=>x.s).length+'</small>');row.appendChild(nm);
    const eye=el('button','eye'+(l.show===false?' off':''),eyeSvg(l.show!==false));eye.title='表示の入り切り';eye.onclick=ev=>{ev.stopPropagation();l.show=l.show===false;commit();};row.appendChild(eye);
    row.onclick=()=>{S.line=S.line===id&&S.tool==='line'?null:id;if(S.line)setTool('line');else{ui();redraw();}};box.appendChild(row);
    if(id===S.line)box.appendChild(lineEditor(l,id,idx));});}
function lineEditor(l,id,idx){const w=el('div','ledit');
  const nm=el('input','namein');nm.value=l.name;nm.placeholder='路線の名前（例：緑ヶ丘駅バスルート1）';nm.oninput=()=>{l.name=nm.value;};nm.onchange=()=>commit();w.appendChild(nm);
  const r=el('div','row');doc.types.line.forEach(t=>{const b=chip(t.name,t.id===l.type,()=>{l.type=t.id;commit();},['line',t.style]);b.classList.add('mini');r.appendChild(b);});w.appendChild(r);
  const sq=el('div','seq');let n=0;
  if(!l.seq.length)sq.appendChild(el('span','hint','地図の停留所を順に押す。道の上を押すと「経由」になります。'));
  l.seq.forEach((it,i)=>{if(i)sq.appendChild(el('span','arr','›'));const isS=!!it.s;if(isS)n++;
    const c=el('span','sq'+(isS?(it.pass?' pass':''):' via'));c.style.color=isS?C.lineStyle(doc,l).color:'';
    const lab=isS?esc(doc.stops[it.s].name):'経由';c.innerHTML=(isS?'<i></i>':'')+'<span style="color:var(--ink)">'+lab+'</span>';
    if(isS){c.title='押すと「通過」と「止まる」を切りかえ';c.style.cursor='pointer';c.onclick=()=>{it.pass=!it.pass;commit();};}
    const x=el('button','','×');x.title='はずす';x.onclick=ev=>{ev.stopPropagation();l.seq.splice(i,1);commit();};c.appendChild(x);sq.appendChild(c);});
  w.appendChild(sq);
  const r2=el('div','row');
  r2.appendChild(chip('✎ 見た目',false,()=>openStyle('lineOne',id)));
  const t=C.lineType(doc,l);const direct=l.direct!=null?l.direct:!!(t&&t.direct);
  const sg=el('div','seg');[['道を通る',false],['まっすぐ結ぶ',true]].forEach(([nn,v])=>{const b=el('button',direct===v?'on':'',nn);b.onclick=()=>{l.direct=v;commit();};sg.appendChild(b);});r2.appendChild(sg);w.appendChild(r2);
  const det=el('details','run');det.open=!!S.runOpen;det.ontoggle=()=>{S.runOpen=det.open;};det.innerHTML='<summary>運行（本数・始発・終発）</summary>';
  const g=el('div','grid2');const f=l.freq||(l.freq={unit:'h',n:2});
  g.innerHTML=`<span>本数</span><span style="display:flex;gap:6px"><input type="number" min="0" max="60" step="1" id="fqn" value="${f.n}" style="width:70px"><select id="fqu"><option value="h"${f.unit==='h'?' selected':''}>1時間に</option><option value="d"${f.unit==='d'?' selected':''}>1日に</option></select></span>
    <span>始発</span><input type="time" id="fqa" value="${l.first||''}"><span>終発</span><input type="time" id="fqb" value="${l.last||''}">
    <span>走り方</span><span class="seg" id="fqr"><button class="${l.round?'':'on'}" data-v="0">片道</button><button class="${l.round?'on':''}" data-v="1">往復</button></span>
    <span></span><span class="hint">1日 約${C.tripsPerDay(l)}便${l.round?'（片道ごと）':''}</span>`;
  det.appendChild(g);w.appendChild(det);
  setTimeout(()=>{const q=s=>g.querySelector(s);q('#fqn').onchange=e=>{f.n=Math.max(0,+e.target.value||0);commit();};q('#fqu').onchange=e=>{f.unit=e.target.value;commit();};
    q('#fqa').onchange=e=>{l.first=e.target.value;commit();};q('#fqb').onchange=e=>{l.last=e.target.value;commit();};g.querySelectorAll('#fqr button').forEach(b=>b.onclick=()=>{l.round=b.dataset.v==='1';commit();});});
  const r3=el('div','btnrow');
  if(idx>0)r3.appendChild(chip('↑ 上へ',false,()=>{doc.order.splice(idx,1);doc.order.splice(idx-1,0,id);commit();}));
  r3.appendChild(chip('複製',false,()=>{const nid=C.uid(doc,'l');doc.lines[nid]=C.clone(l);doc.lines[nid].name=l.name+'（写し）';doc.order.splice(idx+1,0,nid);S.line=nid;commit();}));
  r3.appendChild(chip('逆向き',false,()=>{l.seq.reverse();commit();}));
  const del=chip('路線を消す',false,()=>{delete doc.lines[id];doc.order=doc.order.filter(x=>x!==id);S.line=null;commit();});del.classList.add('danger');r3.appendChild(del);
  r3.querySelectorAll('.chip').forEach(b=>b.classList.add('mini'));w.appendChild(r3);
  return w;}

/* ---------------- 見た目の小窓 ---------------- */
function closePops(){$('style').hidden=true;$('menu').hidden=true;S.style=null;}
function openStyle(kind,id){$('menu').hidden=true;const box=$('style');box.hidden=false;S.style={kind,id};renderStyle();}
function renderStyle(){const box=$('style'),o=S.style;if(!o)return;box.innerHTML='';
  let obj,st,title;
  if(o.kind==='lineOne'){const l=doc.lines[o.id];if(!l){closePops();return;}obj=l;l.style=l.style||{};st=new Proxy({},{get:(_,k)=>C.lineStyle(doc,l)[k],set:(_,k,v)=>{l.style[k]=v;return true;}});title=l.name;}
  else{obj=doc.types[o.kind==='lineOne'?'line':o.kind].find(t=>t.id===o.id);if(!obj){closePops();return;}st=o.kind==='stop'?obj:obj.style;}
  const kind=o.kind==='lineOne'?'line':o.kind;
  const hd=el('div','sthd');
  if(o.kind!=='lineOne'){const nm=el('input','namein');nm.value=obj.name;nm.oninput=()=>{obj.name=nm.value;};nm.onchange=()=>commit();hd.appendChild(nm);}
  else hd.appendChild(el('b','',esc(title)+' <span class="hint">だけの見た目</span>'));
  const x=el('button','ib','<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>');x.onclick=()=>{commit();closePops();};hd.appendChild(x);box.appendChild(hd);
  const pv=el('div','prev');const pc=el('canvas');pv.appendChild(pc);box.appendChild(pv);
  const paint=()=>{const d=Math.min(2,devicePixelRatio||1),W=pv.clientWidth,H=pv.clientHeight;pc.width=W*d;pc.height=H*d;const c=pc.getContext('2d');c.setTransform(d,0,0,d,0,0);
    if(MAP.complete&&MAP.naturalWidth){c.globalAlpha=0.9;c.drawImage(MAP,560,250,300,300*H/W,0,0,W,H);c.globalAlpha=1;}
    const k={z:1.6,dpr:d};c.save();c.scale(1.6,1.6);const w2=W/1.6,h2=H/1.6;
    if(kind==='stop'){const pts=[];for(let i=0;i<=30;i++){const t=i/30;pts.push([t*w2,h2/2+Math.sin(t*5)*3]);}strokeStyled(c,[pts],doc.types.road[0].style,k);const s={name:obj.name||'停留所',node:null,lp:'e'};drawMarker(c,st,w2*0.32,h2/2,k);drawLabel(c,s,st,w2*0.32,h2/2,k,[]);}
    else{const pts=[];for(let i=0;i<=40;i++){const t=i/40;pts.push([10+t*(w2-20),h2/2+Math.sin(t*Math.PI*2)*h2*0.22]);}strokeStyled(c,[pts],Object.assign({},kind==='line'&&o.kind==='lineOne'?C.lineStyle(doc,obj):st),k);}
    c.restore();};
  const live=()=>{paint();redraw();dock();};
  const colorRow=(label,key)=>{box.appendChild(el('div','sl','<span>'+label+'</span><span></span>'));const sw=el('div','sw');
    DEF.palette.forEach(col=>{const b=el('button',st[key]&&st[key].toLowerCase()===col?'on':'');b.style.background=col;b.onclick=()=>{st[key]=col;commit();renderStyle();};sw.appendChild(b);});
    const lb=el('label');lb.title='自由な色';const inp=el('input');inp.type='color';inp.value=/^#[0-9a-f]{6}$/i.test(st[key]||'')?st[key]:'#888888';inp.oninput=()=>{st[key]=inp.value;live();};inp.onchange=()=>{commit();renderStyle();};lb.appendChild(inp);sw.appendChild(lb);box.appendChild(sw);};
  const slider=(label,key,min,max,step)=>{const r=el('div','sl');r.innerHTML='<span>'+label+'</span>';const i=el('input');i.type='range';i.min=min;i.max=max;i.step=step;i.value=st[key]==null?min:st[key];i.oninput=()=>{st[key]=+i.value;live();};i.onchange=()=>commit();r.appendChild(i);box.appendChild(r);};
  const buttons=(label,key,opts,cls,draw)=>{const r=el('div','sl');r.innerHTML='<span>'+label+'</span>';const s=el('div','shapes'+(cls?' '+cls:''));
    opts.forEach(([v,n])=>{const b=el('button',st[key]===v?'on':'');b.title=n;if(draw){const c=el('canvas');b.appendChild(c);requestAnimationFrame(()=>draw(c,v));}else b.textContent=n;b.onclick=()=>{st[key]=v;commit();renderStyle();};s.appendChild(b);});r.appendChild(s);box.appendChild(r);};
  if(kind==='stop'){colorRow('塗り','fill');colorRow('ふち','stroke');
    buttons('形','shape',SHAPES.map(s=>[s,s]),'',(c,v)=>{const d=2;c.width=52;c.height=52;const g=c.getContext('2d');g.setTransform(d,0,0,d,0,0);drawMarker(g,Object.assign({},st,{shape:v,size:6}),13,13,{z:1,dpr:d});});
    slider('大きさ','size',2,14,0.5);slider('文字','fontSize',5,20,0.5);
    buttons('書体','font',Object.entries(FONTN),'txt');
    buttons('名前','label',[['halo','ふち取り'],['tag','札'],['plain','そのまま'],['none','出さない']],'txt');}
  else{colorRow('色','color');slider('太さ','width',0.5,14,0.25);slider('ふち','casing',0,5,0.1);
    const cr=el('div','sw');['#ffffff','#fffaf0','#24312c','#3b3b3b','#a8968a','#f6e9c9'].forEach(col=>{const b=el('button',(st.casingColor||'').toLowerCase()===col?'on':'');b.style.background=col;b.onclick=()=>{st.casingColor=col;commit();renderStyle();};cr.appendChild(b);});
    const lb=el('label');const inp=el('input');inp.type='color';inp.value=/^#[0-9a-f]{6}$/i.test(st.casingColor||'')?st.casingColor:'#ffffff';inp.oninput=()=>{st.casingColor=inp.value;live();};inp.onchange=()=>{commit();renderStyle();};lb.appendChild(inp);cr.appendChild(lb);
    const crl=el('div','sl','<span>ふちの色</span>');crl.appendChild(cr);box.appendChild(crl);
    buttons('線','dash',Object.entries(DASHN),'txt');slider('濃さ','alpha',0.15,1,0.05);slider('光','glow',0,1,0.05);
    buttons('影','shadow',[[true,'あり'],[false,'なし']],'txt');}
  if(o.kind==='lineOne'){const r=el('div','btnrow');r.appendChild(chip('種類の見た目にもどす',false,()=>{doc.lines[o.id].style={};commit();renderStyle();}));box.appendChild(r);}
  else{const arr=doc.types[kind];if(arr.length>1){const r=el('div','btnrow');const used=kind==='road'?Object.values(doc.edges).some(e=>e.type===obj.id):kind==='stop'?Object.values(doc.stops).some(s=>s.type===obj.id):Object.values(doc.lines).some(l=>l.type===obj.id);
    const b=chip(used?'この種類を消す（使っている分は1つ目の種類に）':'この種類を消す',false,()=>{const i=arr.indexOf(obj);arr.splice(i,1);const f=arr[0].id;
      if(kind==='road')Object.values(doc.edges).forEach(e=>{if(e.type===obj.id)e.type=f;});else if(kind==='stop')Object.values(doc.stops).forEach(s=>{if(s.type===obj.id)s.type=f;});else Object.values(doc.lines).forEach(l=>{if(l.type===obj.id)l.type=f;});
      fixSel();commit();closePops();});b.classList.add('mini','danger');r.appendChild(b);box.appendChild(r);}}
  requestAnimationFrame(paint);}

/* ---------------- メニュー ---------------- */
$('menuBtn').onclick=()=>{const m=$('menu');const v=m.hidden;closePops();m.hidden=!v;if(v&&innerWidth<700)showLines(false);};
$('mapAlpha').oninput=e=>{doc.view.mapAlpha=+e.target.value;redraw();};$('mapAlpha').onchange=()=>commit();
document.querySelectorAll('#menu .mi').forEach(b=>b.onclick=()=>{const m=b.dataset.m;
  if(m==='png')savePNG();else if(m==='export')exportJSON();else if(m==='import')$('file').click();
  else if(m==='rail'){doc.view.rail=!doc.view.rail;commit();}else if(m==='fit')fit();
  else if(m==='example'){example();}else if(m==='clear'){if(confirm('描いたものをぜんぶ消しますか？（「元に戻す」で戻せます）')){const t=doc.types,v=doc.view;doc=C.emptyDoc(DEF);doc.types=t;doc.view=v;S.sel=null;S.line=null;S.poly=null;commit();}}
  if(m!=='rail')$('menu').hidden=true;});
$('undo').onclick=undo;$('redo').onclick=redo;
document.querySelectorAll('#zoom .ib').forEach(b=>b.onclick=()=>zoomAt(+b.dataset.z,V.w/2,V.h/2));
function download(name,blob){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),3000);}
const stamp=()=>new Date().toISOString().slice(0,16).replace(/[:T-]/g,'');
function exportJSON(){download('minato-routes-'+stamp()+'.json',new Blob([JSON.stringify(C.exportDoc(doc),null,1)],{type:'application/json'}));toast('JSON に書き出しました');}
$('file').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;try{const j=JSON.parse(await f.text());if(!j.nodes)throw 0;Object.values(j.lines||{}).forEach(l=>{delete l.path;delete l.tripsPerDay;});delete j.format;
  doc=C.normalize(j,DEF);S.sel=null;S.line=null;S.poly=null;fixSel();commit();toast('読み込みました');}catch(er){toast('読み込めませんでした（この帖で書き出した JSON を選んでください）');}};
function bounds(){let x0=0,y0=0,x1=DEF.world.w,y1=DEF.world.h;Object.values(doc.nodes).forEach(n=>{x0=Math.min(x0,n.x-30);y0=Math.min(y0,n.y-30);x1=Math.max(x1,n.x+60);y1=Math.max(y1,n.y+30);});Object.values(doc.edges).forEach(e=>e.pts.forEach(p=>{x0=Math.min(x0,p[0]-20);y0=Math.min(y0,p[1]-20);x1=Math.max(x1,p[0]+20);y1=Math.max(y1,p[1]+20);}));return [x0-24,y0-24,x1+24,y1+24];}
function savePNG(){const b=bounds(),sc=2.6,W=Math.round((b[2]-b[0])*sc),H=Math.round((b[3]-b[1])*sc);const lim=8000;const f=Math.min(1,lim/Math.max(W,H));const c=document.createElement('canvas');c.width=Math.round(W*f);c.height=Math.round(H*f);
  drawScene(c.getContext('2d'),{x:b[0],y:b[1],z:sc*f,w:c.width,h:c.height,dpr:1},{export:true});
  c.toBlob(bl=>{if(bl){download('minato-routes-'+stamp()+'.png',bl);toast('画像で保存しました');}},'image/png');}
let tt=0;function toast(m){const t=$('toast');t.textContent=m;t.classList.add('show');clearTimeout(tt);tt=setTimeout(()=>t.classList.remove('show'),2400);}

/* ---------------- 例（メニューの「例を描いてみる」。元に戻すで消せる） ---------------- */
function example(){const R=(pts,type,smooth=true)=>C.addPath(doc,pts,{type,smooth,snap:6});
  const st=(name,type,p,lp)=>{const n=C.anchor(doc,p,6);const id=C.uid(doc,'s');doc.stops[id]={name,type,node:n,lp:lp||'auto'};return id;};
  // 道路の網
  R([[150,300],[230,292],[330,296],[420,286],[505,280],[590,276],[680,282],[760,292],[840,300],[905,306]],'avenue');
  R([[480,305],[470,250],[452,190],[430,130],[400,80]],'street');
  R([[356,322],[350,370],[372,405]],'street');
  R([[606,296],[640,250],[652,216]],'street');
  R([[760,312],[790,350],[850,372],[904,380]],'street');
  R([[232,330],[260,380],[330,395],[420,388],[505,355],[560,330],[600,320]],'lane');
  R([[150,300],[120,250],[150,190],[230,170],[300,200],[330,250]],'lane');
  R([[912,392],[980,420],[1060,430],[1150,400]],'sea');
  R([[912,392],[960,470],[1010,520]],'sea');
  R([[1080,140],[980,60],[860,40],[700,30]],'air');
  R([[700,30],[560,40],[420,60]],'air');
  R([[606,296],[600,350],[640,395]],'lane');
  // 停留所・拠点
  const a=st('緑ヶ丘駅北口','plaza',[478,262],'w'),b=st('緑ヶ丘団地','bus',[436,140]),c=st('桜町三丁目','bus',[300,393],'s'),d=st('大学正門','bus',[352,370],'e'),e=st('中央駅西口','plaza',[150,300],'s');
  const f=st('川辺センター','center',[640,250],'e'),g=st('緑ヶ丘の売店','kiosk',[535,279],'n'),h=st('港の工場','factory',[860,302],'n'),i=st('みなと港 第2岸壁','pier',[912,392],'w');
  const j=st('ひのき島','pier',[1150,400],'s'),k=st('沖ノ瀬','pier',[1010,520],'s'),m=st('みなと空港','airport',[1080,140],'e'),n2=st('温泉の丘','bus',[420,60],'n'),o=st('森のはずれ','bus',[230,170],'n');
  const p=st('新田市場','bus',[790,350],'e'),q=st('川辺の河原','bus',[640,395],'s');
  const L=(name,type,seq,extra)=>{const id=C.uid(doc,'l');doc.lines[id]=Object.assign({name,type,style:{},seq:seq.map(s=>({s})),freq:{unit:'h',n:3},first:'06:20',last:'22:10',round:true,show:true},extra||{});doc.order.push(id);return id;};
  L('緑ヶ丘駅バスルート1','city',[e,c,d,a,b]);
  L('コミュニティバス さくら号','community',[o,e,c,d,a,g,f,q],{freq:{unit:'h',n:1}});
  L('市バス 港線','city',[a,f,p,h,i],{style:{color:'#3aa0d8'}});
  const OX=DEF.ownExample||{},o1=OX.centerToKiosk||{first:'04:00',last:'04:40',n:2},o2=OX.factoryToCenter||{first:'03:05',last:'03:05',n:1};
  L('自社の配送 朝の便','own',[f,g,a,e],{freq:{unit:'d',n:o1.n},first:o1.first,last:o1.last,round:false});
  L('自社の配送 工場→センター','own',[h,f],{freq:{unit:'d',n:o2.n},first:o2.first,last:o2.last,round:false});
  L('自社の配送 昼前・午後の便','own',[f,g,a],{freq:{unit:'d',n:2},first:'09:15',last:'14:15',round:false});
  L('よその会社の配送','other',[h,f,a,e],{freq:{unit:'d',n:4}});
  L('ひのき島フェリー','ferry',[i,j],{freq:{unit:'d',n:6},first:'07:00',last:'19:00'});
  L('沖ノ瀬 貨物船','cargo',[i,k],{freq:{unit:'d',n:2},first:'06:30',last:'21:40'});
  L('深夜バス みなと号','city',[e,d,a,f,p,i],{freq:{unit:'h',n:1},first:'23:10',last:'00:40',round:false,style:{color:'#6b4fa8'}});
  L('みなと空港 遊覧便','sky',[m,n2],{freq:{unit:'d',n:3},first:'09:00',last:'16:00'});
  commit();fit();toast('例を描きました。いらなければ「元に戻す」で消せます');showLines(innerWidth>=700);}

/* ---------------- はじめ ---------------- */
async function init(){try{DEF=await fetch('data/routes.json',{cache:'no-cache'}).then(r=>r.json());}catch(e){toast('設定（data/routes.json）を読み込めませんでした');return;}
  MAP.onload=redraw;MAP.src=DEF.world.bg;
  let saved=null;try{saved=JSON.parse(localStorage.getItem(KEY)||'null');}catch(e){}
  doc=C.normalize(saved,DEF);cur=JSON.stringify(doc);fixSel();
  if(window.RailEdit)RailEdit.init({ui:()=>ui(),redraw,toast},DEF);
  resize();fit.mob=true;fit();setTool(/track|rail/.test(location.hash)&&window.RailEdit?'rail':'pen');showLines(false);
  if(document.fonts){['700 10px "Zen Kaku Gothic New"','700 10px "Zen Maru Gothic"','700 10px "Zen Old Mincho"','400 10px "Yomogi"'].forEach(f=>document.fonts.load(f,'あ駅').then(redraw,()=>{}));document.fonts.ready.then(redraw);}
  addEventListener('resize',()=>{const w=V.w;resize();if(Math.abs(innerWidth-w)>120)fit();});
  requestAnimationFrame(frame);
  window.__routeEditor={get doc(){return doc;},S,V,example,commit,setTool,fit};}
init();
})();
