/* =====================================================================
   描いた路線を時刻どおりに走らせる：絵の部分（index.html の地図 #map の上に描く。見た目だけ）
   計算は js/route-run-core.js（RouteRun）。路線はお絵かき帖の保存 dia-routes、決まりは data/routes.json の run。
   本体（index.html）からは3つだけ呼ぶ：RouteRunView.draw(ctx,T,dk)・RouteRunView.click(x,y)・RouteRunView.legend()
   乗客や売店の計算には何も渡さない。
   ===================================================================== */
(function(){
'use strict';
const C=window.RouteCore,R=window.RouteRun;if(!C||!R)return;
const KEY='dia-routes';
let DEF=null,RAW=null,DOC=null,SIM=null,busy=false,SEL=null,HITS=[],LAYER={cv:null,key:''};
const MODE={bus:'バス',truck:'トラック',ship:'船',plane:'飛行機'};
const OWNER={self:'自社',other:'よその会社',public:''};

/* ---------- 読み込み・計算（保存が変わったときだけ） ---------- */
fetch('data/routes.json',{cache:'no-cache'}).then(r=>r.ok?r.json():null).then(d=>{DEF=d||{};check();}).catch(()=>{DEF={};check();});
function check(){if(!DEF)return;let s=null;try{s=localStorage.getItem(KEY);}catch(e){}if(s===RAW)return;RAW=s;SIM=null;DOC=null;LAYER.key='';SEL=null;hideCard();
  if(!s)return;let j=null;try{j=JSON.parse(s);}catch(e){return;}if(!j||!j.lines||!Object.keys(j.lines).length)return;
  if(busy)return;busy=true;setTimeout(()=>{try{DOC=C.normalize(j,DEF);SIM=R.simulate(DOC,DEF.run);if(typeof window.renderLegend==='function')window.renderLegend();}catch(e){console.warn('route-run',e);SIM=null;}busy=false;},30);}
addEventListener('storage',e=>{if(e.key===KEY)check();});addEventListener('focus',check);document.addEventListener('visibilitychange',()=>{if(!document.hidden)check();});

/* ---------- 道と路線（動かないので1枚に作り置く） ---------- */
function shapePath(c,shape,x,y,r){c.beginPath();
  if(shape==='square'){c.roundRect(x-r,y-r,r*2,r*2,r*0.3);}
  else if(shape==='diamond'){c.moveTo(x,y-r*1.25);c.lineTo(x+r*1.25,y);c.lineTo(x,y+r*1.25);c.lineTo(x-r*1.25,y);c.closePath();}
  else if(shape==='pill'){c.roundRect(x-r*1.7,y-r*0.95,r*3.4,r*1.9,r*0.95);}
  else if(shape==='hex'){for(let i=0;i<6;i++){const a=Math.PI/3*i+Math.PI/6;c[i?'lineTo':'moveTo'](x+Math.cos(a)*r*1.12,y+Math.sin(a)*r*1.12);}c.closePath();}
  else if(shape==='star'){for(let i=0;i<10;i++){const a=-Math.PI/2+Math.PI/5*i,rr=i%2?r*0.55:r*1.35;c[i?'lineTo':'moveTo'](x+Math.cos(a)*rr,y+Math.sin(a)*rr);}c.closePath();}
  else if(shape==='tri'){c.moveTo(x,y-r*1.3);c.lineTo(x+r*1.2,y+r*0.8);c.lineTo(x-r*1.2,y+r*0.8);c.closePath();}
  else c.arc(x,y,r,0,Math.PI*2);}
const dashOf=(d,w)=>{w=Math.max(w,0.6);return d==='dash'?[w*2.4,w*1.7]:d==='dot'?[0.01,w*2]:d==='dashdot'?[w*3,w*1.3,0.01,w*1.3]:[];};
function offsetPoly(f,off){const n=f.length,out=[];for(let i=0;i<n;i++){const a=f[Math.max(0,i-1)],b=f[Math.min(n-1,i+1)];const dx=b.x-a.x,dy=b.y-a.y,L=Math.hypot(dx,dy)||1;out.push([f[i].x-dy/L*off,f[i].y+dx/L*off]);}return out;}
function strokePolys(c,polys){c.beginPath();polys.forEach(p=>{if(p.length<2)return;c.moveTo(p[0][0],p[0][1]);for(let i=1;i<p.length;i++)c.lineTo(p[i][0],p[i][1]);});c.stroke();}
function buildLayer(main){const k=main.getTransform(),key=[RAW&&RAW.length,RAW&&RAW.slice(-64),main.canvas.width,main.canvas.height,k.a.toFixed(4)].join('|');
  if(LAYER.key===key)return LAYER.cv;const cv=LAYER.cv||(LAYER.cv=document.createElement('canvas'));cv.width=main.canvas.width;cv.height=main.canvas.height;
  const c=cv.getContext('2d');c.setTransform(k);const z=k.a,doc=DOC;
  c.lineJoin='round';c.lineCap='round';
  // 道：縁 → 本体（地図の絵を消さないように、細く・少しすける）
  const by={};Object.values(doc.edges).forEach(e=>{(by[e.type]=by[e.type]||[]).push(C.edgeFlat(doc,e).map(p=>[p.x,p.y]));});
  const rt=id=>doc.types.road.find(t=>t.id===id)||doc.types.road[0]||{style:{}};
  const types=Object.keys(by);
  types.forEach(id=>{const st=rt(id).style||{};if(!(+st.casing>0))return;c.globalAlpha=0.55*(st.alpha==null?1:st.alpha);c.strokeStyle=st.casingColor||'#a8968a';c.lineWidth=((+st.width||2)+2*st.casing)*0.72;c.setLineDash([]);strokePolys(c,by[id]);});
  types.forEach(id=>{const st=rt(id).style||{};const w=(+st.width||2)*0.72;c.globalAlpha=0.8*(st.alpha==null?1:st.alpha);c.strokeStyle=st.color||'#fff';c.lineWidth=w;c.setLineDash(dashOf(st.dash,w));c.lineCap=st.dash==='dash'||st.dash==='dashdot'?'butt':'round';strokePolys(c,by[id]);});
  c.setLineDash([]);c.lineCap='round';
  // 路線：同じ道は並べてずらす（お絵かき帖と同じ考え）
  const ids=doc.order.filter(id=>doc.lines[id]&&doc.lines[id].show!==false),adj=C.adjacency(doc),L=C.lineLanes(doc,ids),flat={},ef=id=>flat[id]||(flat[id]=C.edgeFlat(doc,doc.edges[id]));
  const geo={};ids.forEach(lid=>{const l=doc.lines[lid],polys=[];let cur=null;
    C.linePath(doc,l,adj).forEach(g=>{let p;if(!g.edges){const A=doc.nodes[g.a],B=doc.nodes[g.b],dx=B.x-A.x,dy=B.y-A.y,len=Math.hypot(dx,dy)||1,bend=Math.min(60,len*0.16),mx=(A.x+B.x)/2-dy/len*bend,my=(A.y+B.y)/2+dx/len*bend;p=[];for(let i=0;i<=24;i++){const t=i/24,u=1-t;p.push([u*u*A.x+2*u*t*mx+t*t*B.x,u*u*A.y+2*u*t*my+t*t*B.y]);}
        if(cur)cur.push(...p.slice(1));else{cur=p;polys.push(cur);}return;}
      g.edges.forEach(x=>{const n=L.cnt[x.id]||1,i=L.lane[x.id]?L.lane[x.id][lid]:0;let q=offsetPoly(ef(x.id),(i-(n-1)/2)*2.1);if(x.rev)q=q.reverse();if(cur)cur.push(...q);else{cur=q;polys.push(cur);}});});
    geo[lid]=polys;});
  ids.forEach(lid=>{c.globalAlpha=0.75;c.strokeStyle='#fffdf6';c.lineWidth=2.6;c.setLineDash([]);strokePolys(c,geo[lid]);});
  ids.forEach(lid=>{const st=C.lineStyle(doc,doc.lines[lid]);c.globalAlpha=0.9*(st.alpha==null?1:st.alpha);c.strokeStyle=st.color||'#2f5aa8';c.lineWidth=1.35;c.setLineDash(dashOf(st.dash,1.2));c.lineCap=st.dash==='dash'||st.dash==='dashdot'?'butt':'round';strokePolys(c,geo[lid]);});
  c.setLineDash([]);c.globalAlpha=1;
  // 停留所：小さな印と名前
  const used=new Set();ids.forEach(lid=>doc.lines[lid].seq.forEach(it=>{if(it.s)used.add(it.s);}));
  c.textBaseline='middle';
  Object.entries(doc.stops).forEach(([sid,s])=>{if(!used.has(sid))return;const n=doc.nodes[s.node];if(!n)return;const ty=Object.assign({},doc.types.stop.find(t=>t.id===s.type)||{},s.style||{});const r=Math.max(1.8,(+ty.size||5)*0.48);
    c.save();c.shadowColor='rgba(40,30,20,.35)';c.shadowBlur=1.6*z;c.shadowOffsetY=0.5*z;c.fillStyle=ty.stroke||'#2c3a35';shapePath(c,ty.shape,n.x,n.y,r+0.9);c.fill();c.restore();
    c.fillStyle=ty.fill||'#fff';shapePath(c,ty.shape,n.x,n.y,r);c.fill();
    if(ty.label==='none'||!s.name)return;const fs=6.2;c.font=`700 ${fs}px "Zen Maru Gothic","Zen Kaku Gothic New",sans-serif`;c.textAlign='left';
    const x=n.x+r+2.2,y=n.y-r-1.6;c.lineJoin='round';c.strokeStyle='rgba(255,253,246,.92)';c.lineWidth=2.2;c.strokeText(s.name,x,y);c.fillStyle='#34413b';c.fillText(s.name,x,y);});
  LAYER.key=key;return cv;}

/* ---------- 乗り物の絵（前が +x。上から見た形） ---------- */
function shade(hex,f){const m=/^#?([0-9a-f]{6})$/i.exec(hex||'');if(!m)return hex;const n=parseInt(m[1],16);let r=n>>16,g=n>>8&255,b=n&255;
  if(f<0){r*=1+f;g*=1+f;b*=1+f;}else{r+=(255-r)*f;g+=(255-g)*f;b+=(255-b)*f;}return `rgb(${r|0},${g|0},${b|0})`;}
function bus(c,col,night){const L=9.6,W=3.7;
  c.fillStyle='rgba(28,24,20,.28)';c.beginPath();c.roundRect(-L/2+0.6,-W/2+0.9,L,W,1.3);c.fill();
  c.fillStyle=night?'#cfd2cf':'#fbfaf4';c.beginPath();c.roundRect(-L/2,-W/2,L,W,[0.9,1.6,1.6,0.9]);c.fill();
  c.fillStyle=col;c.fillRect(-L/2+0.5,-W/2,L-1.2,0.62);c.fillRect(-L/2+0.5,W/2-0.62,L-1.2,0.62);   // 横の帯
  c.fillStyle=night?'#b9bdb9':'#e7e4d8';c.beginPath();c.roundRect(-L/2+1.1,-W/2+0.85,L-2.6,W-1.7,0.6);c.fill();   // 屋根
  c.fillStyle=night?'#a9ada9':'#d6d2c4';c.fillRect(-1.2,-0.75,2.6,1.5);   // 冷房
  c.fillStyle=col;c.fillRect(L/2-1.45,-W/2+0.6,0.42,W-1.2);   // 前の行き先の帯
  c.fillStyle='#2b363e';c.beginPath();c.roundRect(L/2-0.95,-W/2+0.45,0.62,W-0.9,0.3);c.fill();   // 前のガラス
  c.fillRect(-L/2+0.25,-W/2+0.7,0.32,W-1.4);
  if(night){c.fillStyle='rgba(255,226,150,.85)';c.fillRect(-L/2+1.2,-W/2+0.18,L-3,0.3);c.fillRect(-L/2+1.2,W/2-0.48,L-3,0.3);}}   // 窓の明かり
function truck(c,col,night,own){const L=9.4,W=3.6,cab=2.5;
  c.fillStyle='rgba(28,24,20,.28)';c.beginPath();c.roundRect(-L/2+0.6,-W/2+0.9,L,W,1);c.fill();
  c.fillStyle=night?'#c9c6bc':(own?'#fffaf0':'#f1f1ee');c.beginPath();c.roundRect(-L/2,-W/2,L-cab-0.3,W,0.5);c.fill();   // 荷台の箱
  c.fillStyle=col;c.fillRect(-L/2+0.4,-0.55,L-cab-1.1,1.1);   // 屋根の帯
  c.strokeStyle='rgba(0,0,0,.12)';c.lineWidth=0.18;for(let i=1;i<4;i++){const x=-L/2+i*(L-cab-0.3)/4;c.beginPath();c.moveTo(x,-W/2+0.2);c.lineTo(x,W/2-0.2);c.stroke();}
  c.fillStyle=night?shade(col,-0.35):col;c.beginPath();c.roundRect(L/2-cab,-W/2+0.15,cab,W-0.3,[0.4,1.3,1.3,0.4]);c.fill();   // 運転台
  c.fillStyle='#26323a';c.beginPath();c.roundRect(L/2-0.85,-W/2+0.55,0.55,W-1.1,0.25);c.fill();}
function ship(c,col,night,cargo,moving,t){const L=cargo?17:15,W=cargo?5.4:5;
  if(moving){c.save();c.globalCompositeOperation='source-over';const g=c.createLinearGradient(-L/2,0,-L/2-22,0);g.addColorStop(0,'rgba(255,255,255,.75)');g.addColorStop(1,'rgba(255,255,255,0)');
    c.strokeStyle=g;c.lineWidth=0.9;c.beginPath();c.moveTo(-L/2+1,-W/2+0.6);c.lineTo(-L/2-22,-W/2-5);c.moveTo(-L/2+1,W/2-0.6);c.lineTo(-L/2-22,W/2+5);c.stroke();
    c.fillStyle=g;c.beginPath();c.ellipse(-L/2-5,0,6,W*0.42,0,0,7);c.fill();
    c.strokeStyle='rgba(255,255,255,.55)';c.lineWidth=0.5;c.beginPath();c.moveTo(L/2,0);c.quadraticCurveTo(L/2-2,-W/2-1.4,L/2-6,-W/2-1.4);c.moveTo(L/2,0);c.quadraticCurveTo(L/2-2,W/2+1.4,L/2-6,W/2+1.4);c.stroke();c.restore();}
  c.fillStyle='rgba(10,30,50,.22)';c.beginPath();c.ellipse(0.8,1,L/2+0.6,W/2+0.6,0,0,7);c.fill();
  const hull=()=>{c.beginPath();c.moveTo(-L/2,-W/2+0.6);c.lineTo(L/2-4.5,-W/2);c.quadraticCurveTo(L/2+0.4,-W/2+0.6,L/2+0.9,0);c.quadraticCurveTo(L/2+0.4,W/2-0.6,L/2-4.5,W/2);c.lineTo(-L/2,W/2-0.6);c.closePath();};
  c.fillStyle=cargo?(night?shade(col,-0.45):shade(col,-0.15)):(night?'#d4d6d4':'#fbfbf7');hull();c.fill();
  c.strokeStyle=cargo?shade(col,-0.45):col;c.lineWidth=0.55;hull();c.stroke();
  if(cargo){const P=['#e2553f','#3aa0d8','#e8b33a','#3f9b6b','#f6e9c9','#2f5aa8'];for(let i=0;i<4;i++)for(let j=0;j<2;j++){c.fillStyle=night?shade(P[(i*2+j)%6],-0.45):P[(i*2+j)%6];c.fillRect(-L/2+4.2+i*2.3,-W/2+0.9+j*1.85,2.05,1.65);}
    c.fillStyle=night?'#bfc2bf':'#f7f6f0';c.fillRect(-L/2+0.8,-W/2+1.1,2.6,W-2.2);c.fillStyle='#2b363e';c.fillRect(-L/2+2.9,-W/2+1.4,0.4,W-2.8);}
  else{c.fillStyle=night?'#b3b7b4':'#eef0ec';c.beginPath();c.roundRect(-L/2+2.2,-W/2+1,L-7.4,W-2,0.9);c.fill();
    c.fillStyle=col;c.fillRect(-L/2+2.4,-0.32,L-7.8,0.64);c.fillStyle='#2b363e';c.fillRect(L/2-5.6,-W/2+1.3,0.45,W-2.6);
    c.fillStyle=col;c.beginPath();c.arc(-L/2+4,0,0.95,0,7);c.fill();if(!night){c.fillStyle='rgba(255,255,255,.7)';c.beginPath();c.arc(-L/2+3.8,-0.25,0.35,0,7);c.fill();}}}
function plane(c,col,night){c.fillStyle=night?'#cfd3d6':'#fdfdfb';
  c.beginPath();c.moveTo(1.2,-0.8);c.lineTo(-1.6,-6.2);c.lineTo(-3,-6.2);c.lineTo(-1.6,-0.8);c.lineTo(-1.6,0.8);c.lineTo(-3,6.2);c.lineTo(-1.6,6.2);c.lineTo(1.2,0.8);c.closePath();c.fill();   // 主翼
  c.beginPath();c.moveTo(-4.4,-0.5);c.lineTo(-5.7,-2.6);c.lineTo(-6.4,-2.6);c.lineTo(-5.9,-0.5);c.lineTo(-5.9,0.5);c.lineTo(-6.4,2.6);c.lineTo(-5.7,2.6);c.lineTo(-4.4,0.5);c.closePath();c.fill();   // 尾翼
  c.beginPath();c.ellipse(-0.3,0,6.1,0.95,0,0,7);c.fill();
  c.fillStyle=col;c.beginPath();c.moveTo(-5.4,-0.3);c.lineTo(-6.6,-0.3);c.lineTo(-6.6,0.3);c.lineTo(-5.4,0.3);c.closePath();c.fill();c.fillRect(-4.6,-0.22,8,0.44);   // 色の帯
  c.fillStyle=night?'#9aa0a4':'#c8ccd0';c.fillRect(-0.9,-3.5,1.4,0.7);c.fillRect(-0.9,2.8,1.4,0.7);   // エンジン
  c.fillStyle='#2b363e';c.beginPath();c.ellipse(5.2,0,0.5,0.55,0,0,7);c.fill();}

// 地図の絵の上でも見えるように、白いふちと影（シールのように）
const SZ={bus:1.3,truck:1.3,ship:1.3,plane:1.4};
function sticker(c,mode,cargo,night){c.save();c.shadowColor='rgba(20,28,26,.45)';c.shadowBlur=2.2*c.getTransform().a/ (SZ[mode]||1);c.shadowOffsetY=0.6;
  c.fillStyle=night?'rgba(40,48,46,.85)':'rgba(255,255,250,.95)';c.beginPath();
  if(mode==='bus'||mode==='truck')c.roundRect(-5.35,-2.4,10.7,4.8,1.9);
  else if(mode==='ship'){const L=cargo?17:15,W=cargo?5.4:5;c.moveTo(-L/2-0.8,-W/2-0.2);c.lineTo(L/2-4.5,-W/2-0.8);c.quadraticCurveTo(L/2+1.4,-W/2,L/2+1.8,0);c.quadraticCurveTo(L/2+1.4,W/2,L/2-4.5,W/2+0.8);c.lineTo(-L/2-0.8,W/2+0.2);c.closePath();}
  else{c.ellipse(-0.3,0,6.9,1.7,0,0,7);c.rect(-3.4,-6.9,4.9,13.8);}
  c.fill();c.restore();}
/* ---------- 夜の明かり ---------- */
function glowDot(c,x,y,r,col,a){const g=c.createRadialGradient(x,y,0,x,y,r*4.5);g.addColorStop(0,col.replace('A',a));g.addColorStop(1,col.replace('A',0));c.fillStyle=g;c.beginPath();c.arc(x,y,r*4.5,0,7);c.fill();c.fillStyle=col.replace('A',Math.min(1,a*1.4));c.beginPath();c.arc(x,y,r,0,7);c.fill();}
function lights(c,mode,a,o,t,moving,alt){c.save();c.globalCompositeOperation='lighter';
  if(mode==='bus'||mode==='truck'){const L=mode==='bus'?4.8:4.7;
    if(moving||o.dwell){const g=c.createRadialGradient(L,0,0.5,L,0,11);g.addColorStop(0,`rgba(255,240,200,${0.4*a})`);g.addColorStop(1,'rgba(255,240,200,0)');c.fillStyle=g;c.beginPath();c.moveTo(L,-1.5);c.lineTo(L+10,-5.2);c.quadraticCurveTo(L+12,0,L+10,5.2);c.lineTo(L,1.5);c.closePath();c.fill();}
    glowDot(c,L+0.1,-1.25,0.42,'rgba(255,250,232,A)',0.9*a);glowDot(c,L+0.1,1.25,0.42,'rgba(255,250,232,A)',0.9*a);
    const br=o.dwell||!moving?1:0.6;glowDot(c,-L-0.1,-1.3,0.38,'rgba(255,40,40,A)',0.75*a*br);glowDot(c,-L-0.1,1.3,0.38,'rgba(255,40,40,A)',0.75*a*br);}
  else if(mode==='ship'){glowDot(c,1.5,-2.7,0.45,'rgba(255,50,50,A)',0.95*a);glowDot(c,1.5,2.7,0.45,'rgba(60,255,120,A)',0.95*a);glowDot(c,3,0,0.42,'rgba(255,255,240,A)',0.95*a);glowDot(c,-7.4,0,0.38,'rgba(255,255,240,A)',0.8*a);
    c.globalAlpha=0.12*a;c.fillStyle='#ffe9b0';c.beginPath();c.ellipse(-1,0,8,3.4,0,0,7);c.fill();}
  else if(mode==='plane'){glowDot(c,-1.9,-6.3,0.4,'rgba(255,50,50,A)',0.9*a);glowDot(c,-1.9,6.3,0.4,'rgba(70,255,130,A)',0.9*a);
    const b=(Math.sin(t*6.3)>0.55)?1:0.15;glowDot(c,-0.4,0,0.45,'rgba(255,60,60,A)',b*a);
    const st=((t*1000)%1300)<90?1:0;if(st){glowDot(c,-2.2,-6.4,0.5,'rgba(255,255,255,A)',a);glowDot(c,-2.2,6.4,0.5,'rgba(255,255,255,A)',a);}
    if(alt<0.5&&moving){const g=c.createLinearGradient(5.6,0,22,0);g.addColorStop(0,`rgba(255,248,225,${0.35*a*(1-alt*2)})`);g.addColorStop(1,'rgba(255,248,225,0)');c.fillStyle=g;c.beginPath();c.moveTo(5.6,-0.6);c.lineTo(22,-4);c.lineTo(22,4);c.lineTo(5.6,0.6);c.closePath();c.fill();}}
  c.restore();}

/* ---------- 毎回の描画（index.html の drawMap から） ---------- */
function draw(c,T,dk){HITS=[];if(!SIM||!DOC){if(DEF&&!busy)check();return;}
  const k=c.getTransform(),lay=buildLayer(c);c.save();c.setTransform(1,0,0,1,0,0);c.globalAlpha=1-0.42*dk;c.drawImage(lay,0,0);c.restore();
  const now=performance.now()/1000,night=dk>0.35,la=Math.min(1,Math.max(0,(dk-0.08)*1.5));
  const list=R.stateAt(SIM,T);
  // 地上 → 海 → 空 の順に（飛行機がいちばん上）
  const ord={ship:0,truck:1,bus:1,plane:2};list.sort((a,b)=>ord[a.v.mode]-ord[b.v.mode]);
  list.forEach(o=>{const v=o.v,mode=v.mode,lt=DOC.types.line.find(t=>t.id===v.type)||{};
    // 左側通行（船は右側）・停留所では寄せる
    const side=mode==='ship'?3.6:mode==='plane'?0:(3+(o.dwell?2.8:0)),lx=Math.sin(o.ang),ly=-Math.cos(o.ang);
    let x=o.x+lx*side*(mode==='ship'?-1:1),y=o.y+ly*side*(mode==='ship'?-1:1);
    const moving=!o.dwell&&!o.wait;
    let alt=0,sc=1;if(mode==='plane'){const S=v.stops,a=S[0].s,b=S[S.length-1].s;alt=o.dwell?0:Math.max(0,Math.min(1,Math.min(o.s-a,b-o.s)/55));sc=1+0.32*alt;}
    c.save();c.globalAlpha=Math.max(0,Math.min(1,o.fade));
    if(mode==='plane'&&alt>0.02){c.save();c.translate(x+alt*9,y+alt*13);c.rotate(o.ang);c.scale(0.9,0.9);c.globalAlpha*=0.16*(1-alt*0.3);c.fillStyle='#1d2a30';c.beginPath();c.ellipse(-0.3,0,6.1,1,0,0,7);c.fill();c.fillRect(-2.2,-6,1.6,12);c.fillRect(-6,-2.4,1,4.8);c.restore();}
    c.translate(x,y);c.rotate(o.ang);c.scale(sc*SZ[mode],sc*SZ[mode]);
    sticker(c,mode,v.type==='cargo'||lt.owner==='other',night);
    if(mode==='bus')bus(c,v.color,night);else if(mode==='truck')truck(c,v.color,night,lt.owner==='self');else if(mode==='ship')ship(c,v.color,night,v.type==='cargo'||lt.owner==='other',moving,now);else plane(c,v.color,night);
    if(la>0)lights(c,mode,la,o,now,moving,alt);
    c.restore();
    if(o.wait){const p=0.5+0.5*Math.sin(now*4);c.save();c.globalAlpha=0.5+0.4*p;c.fillStyle='#f0a53a';c.strokeStyle='#fff';c.lineWidth=0.6;c.beginPath();c.arc(x,y-8,1.9,0,7);c.fill();c.stroke();c.restore();}
    HITS.push({o,x,y});
    if(SEL&&SEL===v.id){c.save();c.strokeStyle=v.color;c.lineWidth=1.3;c.setLineDash([2.2,1.6]);c.lineDashOffset=-now*6;c.beginPath();c.arc(x,y,mode==='ship'?14:mode==='plane'?12*sc:10.5,0,7);c.stroke();c.restore();}});
  if(SEL){const h=HITS.find(h=>h.o.v.id===SEL);if(h)showCard(h,k.a/(window.devicePixelRatio>2&&k.a>0?1:1));else hideCard();}}

/* ---------- 押したときの小さなカード ---------- */
const fm=m=>{m=((Math.round(m)%1440)+1440)%1440;return Math.floor(m/60)+':'+String(m%60).padStart(2,'0');};
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
let CARD=null,cardKey='';
function card(){if(CARD)return CARD;const wrap=document.getElementById('mapwrap');if(!wrap)return null;if(getComputedStyle(wrap).position==='static')wrap.style.position='relative';
  const st=document.createElement('style');st.textContent=`
.rrcard{position:absolute;z-index:6;min-width:184px;max-width:240px;padding:9px 11px 9px 13px;border-radius:13px;pointer-events:auto;
  background:linear-gradient(160deg,rgba(255,253,247,.94),rgba(247,242,230,.9));backdrop-filter:blur(8px) saturate(1.2);-webkit-backdrop-filter:blur(8px) saturate(1.2);
  box-shadow:0 10px 28px -10px rgba(40,32,20,.45),0 1px 0 rgba(255,255,255,.8) inset;border:1px solid rgba(60,50,35,.12);color:#24312c;font-size:12px;line-height:1.45;transform:translate(-50%,calc(-100% - 16px));transition:left .18s linear,top .18s linear}
.rrcard::before{content:"";position:absolute;left:0;top:10px;bottom:10px;width:3.5px;border-radius:0 3px 3px 0;background:var(--c)}
.rrcard::after{content:"";position:absolute;left:50%;bottom:-6px;width:11px;height:11px;transform:translateX(-50%) rotate(45deg);background:rgba(248,244,233,.94);border-right:1px solid rgba(60,50,35,.12);border-bottom:1px solid rgba(60,50,35,.12)}
.rrcard.below{transform:translate(-50%,16px)}.rrcard.below::after{bottom:auto;top:-6px;transform:translateX(-50%) rotate(225deg)}
.rrcard .hd{display:flex;align-items:center;gap:6px;margin-bottom:3px}.rrcard .hd b{font-size:13px;letter-spacing:.02em;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rrcard .md{font-size:10px;color:#fff;background:var(--c);border-radius:999px;padding:1px 7px;white-space:nowrap;font-weight:700}
.rrcard .x{border:0;background:transparent;color:#7a827d;font-size:15px;line-height:1;padding:0 2px;cursor:pointer}
.rrcard .od{color:#4c5852;font-size:11.5px}.rrcard .od i{font-style:normal;color:var(--c);padding:0 3px;font-weight:700}
.rrcard .nx{display:flex;align-items:baseline;gap:6px;margin-top:5px;padding-top:5px;border-top:1px dashed rgba(60,50,35,.18)}
.rrcard .nx small{color:#7a827d;font-size:10.5px}.rrcard .nx span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.rrcard .nx b{font:700 13px "JetBrains Mono",ui-monospace,monospace;letter-spacing:-.02em}
.rrcard .tg{display:inline-block;margin-top:5px;margin-right:4px;font-size:10.5px;border-radius:6px;padding:1px 7px;background:rgba(63,155,107,.13);color:#2f7a55;font-weight:700}
.rrcard .tg.late{background:rgba(226,85,63,.13);color:#b8432f}.rrcard .tg.wait{background:rgba(240,165,58,.18);color:#9a5d0c}.rrcard .tg.dw{background:rgba(47,90,168,.1);color:#2f5aa8}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) .rrcard{background:linear-gradient(160deg,rgba(36,42,40,.94),rgba(28,32,31,.92));color:#eef0ea;border-color:rgba(255,255,255,.1)}:root:not([data-theme="light"]) .rrcard::after{background:rgba(30,34,33,.94)}:root:not([data-theme="light"]) .rrcard .od{color:#c3cac5}}
:root[data-theme="dark"] .rrcard{background:linear-gradient(160deg,rgba(36,42,40,.94),rgba(28,32,31,.92));color:#eef0ea;border-color:rgba(255,255,255,.1)}:root[data-theme="dark"] .rrcard::after{background:rgba(30,34,33,.94)}:root[data-theme="dark"] .rrcard .od{color:#c3cac5}`;
  document.head.appendChild(st);CARD=document.createElement('div');CARD.className='rrcard';CARD.hidden=true;wrap.appendChild(CARD);
  CARD.addEventListener('click',e=>{e.stopPropagation();if(e.target.closest('.x')){SEL=null;hideCard();}});return CARD;}
function showCard(h){const el=card();if(!el)return;const map=document.getElementById('map'),MS=map.clientWidth/1000;const o=h.o,v=o.v,doc=DOC,nm=sid=>(doc.stops[sid]||{}).name||'';
  const lt=doc.types.line.find(t=>t.id===v.type)||{},ow=OWNER[lt.owner]||'';
  const n=v.stops.length,k=Math.min(o.k,n-1),done=o.k>=n;
  let tags='';const dl=Math.round(o.delay);
  if(o.wait)tags+=`<span class="tg wait">${o.k===0?'のりばの空き待ち':'停留所の空き待ち'}</span>`;
  else if(o.dwell)tags+=`<span class="tg dw">${esc(nm(v.stops[o.atStop].sid))}に${v.mode==='ship'?'着岸中':v.mode==='plane'?'駐機中':'停車中'}</span>`;
  tags+=dl>=1?`<span class="tg late">${dl}分遅れ</span>`:'<span class="tg">ほぼ定刻</span>';
  const next=done?`<small>終点</small><span>${esc(nm(v.to))}</span><b>着</b>`:`<small>${o.k===n-1?'終点':'次'}</small><span>${esc(nm(v.stops[k].sid))}</span><b>${v.arr[k]!=null?fm(v.arr[k]):'—'}</b><small>着</small>`;
  const html=`<div class="hd"><b>${esc(v.name)}</b><span class="md">${ow?ow+'の':''}${MODE[v.mode]}</span><button class="x" aria-label="閉じる">×</button></div>
    <div class="od">${esc(nm(v.from))}<i>→</i>${esc(nm(v.to))}　<span style="opacity:.75">${fm(v.dep)}発</span></div><div class="nx">${next}</div><div>${tags}</div>`;
  const key=v.id+'|'+html;if(key!==cardKey){el.innerHTML=html;cardKey=key;}
  el.style.setProperty('--c',v.color);const px=map.offsetLeft+h.x*MS,py=map.offsetTop+h.y*MS;el.classList.toggle('below',h.y*MS<120);
  el.style.left=Math.max(100,Math.min(map.offsetLeft+map.clientWidth-100,px))+'px';el.style.top=py+'px';el.hidden=false;}
function hideCard(){if(CARD){CARD.hidden=true;cardKey='';}}
// 地図を押したとき：乗り物の近くなら選ぶ（true を返す）。ほかを押したらカードを閉じる
function click(x,y){let best=null,bd=10;HITS.forEach(h=>{const d=Math.hypot(h.x-x,h.y-y);if(d<bd){bd=d;best=h;}});
  if(best){SEL=best.o.v.id;showCard(best);return true;}if(SEL){SEL=null;hideCard();}return false;}
function legend(){if(!SIM||!SIM.veh.length)return '<span style="opacity:.8">バス・配送：お絵かき帖（研究室の「路線のお絵かき帖」）で路線を描くと、ここを時刻どおりに走ります</span>';
  const seen={};SIM.veh.forEach(v=>{if(!seen[v.line])seen[v.line]=v;});const arr=Object.values(seen).slice(0,6);
  return arr.map(v=>`<span><i style="background:${v.color}"></i>${esc(v.name)}</span>`).join('')+(Object.keys(seen).length>6?`<span>ほか${Object.keys(seen).length-6}路線</span>`:'');}
window.RouteRunView={draw,click,legend,check,get sim(){return SIM;},get doc(){return DOC;},select(id){SEL=id;}};
})();
