/* =====================================================================
   列車の絵（第7回・2026-11-13）。お手本は docs/ref/train-style-reference.png と、ユーザーと見た試し描き docs/ref/train-style-mock.png。
   ・地図：1両ずつ、線路の上の位置と向きに置く（前後2点を線路の上に取って回す）。真上に近い見下ろしで、
     手前（南＝画面の下）に側面が少し見える（車体を画面の下へ押し出した形）。丸い屋根・冷房の箱2つ・濃い縁取り・帯と客室の窓・
     先頭は丸く黒い前面の窓（光の反射つき）・最後尾に赤い尾灯・うすい影。
   ・編成のパネル：その編成を横から見た大きな絵（drawSide）。
   ・色と大きさは data/train-style.json（なければ下の DEF）。計算には何も使わない（見た目だけ）。
   ・夜の明るさは外から変えられる：TrainArt.light.win / TrainArt.light.head に (dk)=>0..1 の関数を入れると、それを使う（第9回の光と合わせるため）。
   ===================================================================== */
(function(root){
'use strict';
const DEF={types:{
  L:{name:'普通',body:'#f3f1ea',stripe:'#e8792b',roof:'#c9cdd0',roofHi:'#eef0f1',edge:'#2b3a4c',win:5},
  R:{name:'快速',body:'#efe5c8',stripe:'#2f7fc0',roof:'#d9d2bd',roofHi:'#f6f1e2',edge:'#2b3a4c',win:5},
  E:{name:'特急',body:'#8e1f2e',stripe:'#e1c46a',roof:'#cfd3d6',roofHi:'#f1f2f3',edge:'#2a1d24',win:6},
  X:{name:'観光特急',body:'#2f5a48',stripe:'#e9cf8c',roof:'#d6d2c4',roofHi:'#f4f0e2',edge:'#1d2a24',win:4}},
  dead:{alpha:0.72},size:{carL:{2:8.4,3:8.4,4:8,6:6.8,8:5.9,10:5.3},W:3.3,side:1.5,gap:0.75},night:{win:'#ffe3a3',head:'#fff4cf'}};
let CFG=DEF;
const A={cfg:()=>CFG,light:{win:null,head:null},onload:null};
if(typeof fetch==='function')fetch('data/train-style.json',{cache:'no-cache'}).then(r=>r.json()).then(j=>{CFG=Object.assign({},DEF,j,{types:Object.assign({},DEF.types,j.types||{}),size:Object.assign({},DEF.size,j.size||{}),night:Object.assign({},DEF.night,j.night||{})});if(A.onload)A.onload();}).catch(()=>{});
A.livery=t=>CFG.types[t]||CFG.types.L;
// 1両の長さ（両数が多いほど少し短く。地図の縮尺よりずっと大きい）。k は画面の大きさによる倍率
A.size=(cars,k)=>{k=k||1;const T=CFG.size.carL;let L=8;const ks=Object.keys(T).map(Number).sort((a,b)=>a-b);for(const n of ks)if(cars>=n)L=T[n];return {L:L*k,W:CFG.size.W*k,side:CFG.size.side*k,gap:CFG.size.gap*k};};
A.length=(cars,k)=>{const s=A.size(cars,k);return cars*s.L+(cars-1)*s.gap;};

/* 1両の外形（上から見た角丸の四角。先頭・最後尾は丸く）。world 座標の点の列で返す */
function outline(x,y,ang,L,W,head,tail){const pts=[],c=Math.cos(ang),s=Math.sin(ang),hr=head?W*0.55:W*0.22,tr=tail?W*0.45:W*0.22;
  const arc=(cx,cy,r,a0,a1)=>{for(let i=0;i<=4;i++){const a=a0+(a1-a0)*i/4;const lx=cx+Math.cos(a)*r,ly=cy+Math.sin(a)*r;pts.push({x:x+lx*c-ly*s,y:y+lx*s+ly*c});}};
  const x0=-L/2,x1=L/2,y0=-W/2,y1=W/2;
  arc(x1-hr,y0+hr,hr,-Math.PI/2,0);arc(x1-hr,y1-hr,hr,0,Math.PI/2);arc(x0+tr,y1-tr,tr,Math.PI/2,Math.PI);arc(x0+tr,y0+tr,tr,Math.PI,Math.PI*1.5);return pts;}
function hull(P){const p=P.slice().sort((a,b)=>a.x-b.x||a.y-b.y);const cr=(o,a,b)=>(a.x-o.x)*(b.y-o.y)-(a.y-o.y)*(b.x-o.x);const lo=[],up=[];
  for(const q of p){while(lo.length>=2&&cr(lo[lo.length-2],lo[lo.length-1],q)<=0)lo.pop();lo.push(q);}
  for(let i=p.length-1;i>=0;i--){const q=p[i];while(up.length>=2&&cr(up[up.length-2],up[up.length-1],q)<=0)up.pop();up.push(q);}
  lo.pop();up.pop();return lo.concat(up);}
function poly(c,P,dx,dy){dx=dx||0;dy=dy||0;c.beginPath();P.forEach((q,i)=>i?c.lineTo(q.x+dx,q.y+dy):c.moveTo(q.x+dx,q.y+dy));c.closePath();}
function lighten(hex,f){const m=/^#?([0-9a-f]{6})$/i.exec(hex||'');if(!m)return hex;const n=parseInt(m[1],16);let r=n>>16,g=(n>>8)&255,b=n&255;
  r=Math.round(r+(255-r)*f);g=Math.round(g+(255-g)*f);b=Math.round(b+(255-b)*f);return `rgb(${r},${g},${b})`;}
const nightWin=dk=>A.light.win?A.light.win(dk):Math.max(0,Math.min(1,(dk-0.25)/0.5));
const nightHead=dk=>A.light.head?A.light.head(dk):Math.max(0,Math.min(1,(dk-0.2)/0.5));

/* 地図の列車：cars＝[{x,y,ang}]（先頭から）。o：{type, dk, stopped, faded, k（大きさの倍率）, zoom（画面の1単位の画素の数）} */
A.drawTrain=function(c,cars,o){const st=A.livery(o.type),n=cars.length;if(!n)return;const sz=A.size(n,o.k),L=sz.L,W=sz.W,side=sz.side,dk=o.dk||0,z=o.zoom||1;
  const fine=z>=2.2;   // 拡大しているとき：冷房の箱の格子・窓まで描く
  c.save();if(o.faded)c.globalAlpha=CFG.dead.alpha;
  const shapes=cars.map((p,i)=>{const P=outline(p.x,p.y,p.ang,L,W,i===0,i===n-1);const H=hull(P.concat(P.map(q=>({x:q.x,y:q.y+side}))));return {p,P,H};});
  // 影（右下にうすく）
  c.fillStyle='rgba(20,28,36,.26)';shapes.forEach(s=>{poly(c,s.H,0.55,side*0.7);c.fill();});
  // 前照灯（夜）
  const hl=nightHead(dk);if(hl>0.02&&!o.faded){const p=cars[0],ca=Math.cos(p.ang),sa=Math.sin(p.ang),fx=p.x+ca*L*0.5,fy=p.y+sa*L*0.5+side*0.4;
    c.save();c.globalCompositeOperation='lighter';c.translate(fx,fy);c.rotate(p.ang);const g=c.createRadialGradient(0,0,0,0,0,L*2.4);g.addColorStop(0,`rgba(255,240,200,${0.55*hl})`);g.addColorStop(1,'rgba(255,240,200,0)');
    c.fillStyle=g;c.beginPath();c.moveTo(0,-W*0.3);c.lineTo(L*2.4,-W*1.25);c.quadraticCurveTo(L*2.8,0,L*2.4,W*1.25);c.lineTo(0,W*0.3);c.closePath();c.fill();c.restore();}
  // 連結部（黒い幌）
  c.fillStyle='#1e242b';for(let i=1;i<n;i++){const a=cars[i-1],b=cars[i],ax=a.x-Math.cos(a.ang)*L/2,ay=a.y-Math.sin(a.ang)*L/2,bx=b.x+Math.cos(b.ang)*L/2,by=b.y+Math.sin(b.ang)*L/2;
    c.save();c.translate((ax+bx)/2,(ay+by)/2+side*0.35);c.rotate(Math.atan2(ay-by,ax-bx));c.fillRect(-sz.gap*0.5-0.5,-W*0.36,sz.gap+1,W*0.72);c.restore();}
  const wl=nightWin(dk);
  shapes.forEach((s,i)=>{const p=s.p,head=i===0,tail=i===n-1,ca=Math.cos(p.ang),sa=Math.sin(p.ang);
    // 車体（側面を含む外形）
    poly(c,s.H);c.fillStyle=st.body;c.fill();
    // 側面：帯と客室の窓（外形の中だけ）
    c.save();poly(c,s.H);c.clip();
    c.lineJoin='round';c.strokeStyle=st.stripe;c.lineWidth=side*0.5;poly(c,s.P,0,side*0.78);c.stroke();
    const win=wl>0.02&&!o.faded?CFG.night.win:'rgba(28,42,58,.9)';c.strokeStyle=win;c.lineWidth=side*0.32;c.setLineDash([L/(st.win*1.9),L/(st.win*3.4)]);poly(c,s.P,0,side*0.32);c.stroke();c.setLineDash([]);
    if(wl>0.02&&!o.faded){c.globalAlpha*=0.55*wl;c.strokeStyle=CFG.night.win;c.lineWidth=side*0.9;poly(c,s.P,0,side*0.32);c.stroke();}
    c.restore();
    // 上の面と縁取り
    poly(c,s.P);c.fillStyle=lighten(st.body,0.08);c.fill();
    poly(c,s.H);c.lineWidth=Math.max(0.35,W*0.13);c.strokeStyle=st.edge;c.lineJoin='round';c.stroke();
    // 屋根（丸みのあるうすい灰色・明るいところ）
    c.save();c.translate(p.x,p.y);c.rotate(p.ang);
    const rl=L-(head?W*0.95:W*0.42)-(tail?W*0.3:W*0.22),rx=-L/2+(tail?W*0.3:W*0.22),rw=W*0.72;
    const g=c.createLinearGradient(0,-rw/2,0,rw/2);g.addColorStop(0,st.roofHi);g.addColorStop(1,st.roof);c.fillStyle=g;
    c.beginPath();c.roundRect(rx,-rw/2,rl,rw,rw*0.45);c.fill();c.lineWidth=Math.max(0.25,W*0.07);c.strokeStyle=lighten(st.edge,0.25);c.stroke();
    // 冷房の箱 2つ
    for(const fx of [0.26,0.68]){const bw=Math.min(rl*0.24,W*0.62),bh=rw*0.7,bx=rx+rl*fx-bw/2,by=-bh/2;c.fillStyle='#f6f7f5';c.fillRect(bx,by,bw,bh);c.lineWidth=Math.max(0.18,W*0.05);c.strokeStyle='#8f979f';c.strokeRect(bx,by,bw,bh);
      if(fine){c.strokeStyle='#b5bcc2';c.lineWidth=W*0.03;c.beginPath();for(let k=1;k<4;k++){c.moveTo(bx+bw*0.1,by+bh*k/4);c.lineTo(bx+bw*0.9,by+bh*k/4);}c.moveTo(bx+bw/2,by+bh*0.08);c.lineTo(bx+bw/2,by+bh*0.92);c.stroke();}}
    // 先頭：丸く黒い前面の窓と光の反射
    if(head){c.fillStyle='#16212c';c.beginPath();c.moveTo(L/2-W*0.62,-W*0.44);c.quadraticCurveTo(L/2-W*0.06,-W*0.44,L/2-W*0.06,0);c.quadraticCurveTo(L/2-W*0.06,W*0.44,L/2-W*0.62,W*0.44);c.quadraticCurveTo(L/2-W*0.5,0,L/2-W*0.62,-W*0.44);c.fill();
      c.fillStyle='rgba(255,255,255,.42)';c.beginPath();c.moveTo(L/2-W*0.5,-W*0.32);c.lineTo(L/2-W*0.36,-W*0.32);c.lineTo(L/2-W*0.44,-W*0.02);c.lineTo(L/2-W*0.56,-W*0.02);c.fill();}
    c.restore();
    // 先頭の窓の下（手前の側面）も黒く
    if(head){const fx=p.x+ca*(L/2-W*0.3),fy=p.y+sa*(L/2-W*0.3);c.fillStyle='#16212c';c.beginPath();c.ellipse(fx,fy+W*0.45+side*0.35,Math.max(0.6,W*0.22+Math.abs(sa)*W*0.2),side*0.32,0,0,Math.PI*2);c.fill();}
    // 最後尾の赤い尾灯（手前の側面の後ろの角）
    if(tail){const tx=p.x-ca*(L/2-W*0.25),ty=p.y-sa*(L/2-W*0.25);c.fillStyle='#d8392b';c.beginPath();c.arc(tx-sa*W*0.35,ty+ca*W*0.35+side*0.55,Math.max(0.35,W*0.13),0,Math.PI*2);c.fill();
      if(dk>0.3){c.fillStyle=`rgba(255,80,60,${0.35*dk})`;c.beginPath();c.arc(tx-sa*W*0.35,ty+ca*W*0.35+side*0.55,W*0.45,0,Math.PI*2);c.fill();}}
    // 開いたドア（停車中）：側面に明るい点
    if(o.stopped&&!o.faded){c.fillStyle='rgba(255,246,200,.95)';for(const f of [-0.28,0,0.28]){const dx=p.x+ca*L*f,dy=p.y+sa*L*f;c.beginPath();c.ellipse(dx-sa*W*0.5,dy+ca*W*0.5+side*0.5,Math.max(0.3,W*0.1),side*0.3,0,0,Math.PI*2);c.fill();}}
  });
  c.restore();};

/* 横から見た編成（編成のパネル）。x,y＝左上、w,h＝描く場所。先頭は右。n 両 */
A.drawSide=function(c,x,y,w,h,n,type,o){o=o||{};const st=A.livery(type),gap=Math.max(6,h*0.09),cw=(w-gap*(n-1))/n,ch=h;
  const roofH=ch*0.6,sideH=ch-roofH,r=ch*0.22;
  for(let i=0;i<n;i++){const head=i===n-1,tail=i===0,x0=x+i*(cw+gap);
    if(i>0){c.fillStyle='#1e242b';c.fillRect(x0-gap-2,y+ch*0.22,gap+4,ch*0.6);c.fillStyle='rgba(255,255,255,.12)';for(let k=0;k<4;k++)c.fillRect(x0-gap-1+k*(gap+2)/4,y+ch*0.24,1,ch*0.56);}
    const shape=()=>{c.beginPath();const hr=head?ch*0.52:r,tr=tail?ch*0.3:r;c.moveTo(x0+tr,y);c.lineTo(x0+cw-hr,y);c.quadraticCurveTo(x0+cw,y,x0+cw,y+hr);c.lineTo(x0+cw,y+ch-hr*0.6);c.quadraticCurveTo(x0+cw,y+ch,x0+cw-hr*0.6,y+ch);
      c.lineTo(x0+tr*0.6,y+ch);c.quadraticCurveTo(x0,y+ch,x0,y+ch-tr*0.6);c.lineTo(x0,y+tr);c.quadraticCurveTo(x0,y,x0+tr,y);c.closePath();};
    c.save();c.shadowColor='rgba(0,0,0,.35)';c.shadowBlur=ch*0.12;c.shadowOffsetY=ch*0.08;shape();c.fillStyle=st.body;c.fill();c.restore();
    c.save();shape();c.clip();
    // 屋根（上の明るい面）
    const g=c.createLinearGradient(0,y,0,y+roofH);g.addColorStop(0,st.roofHi);g.addColorStop(1,st.roof);c.fillStyle=g;c.beginPath();c.roundRect(x0+cw*0.035,y+ch*0.07,cw*0.93-(head?ch*0.35:0),roofH-ch*0.06,ch*0.12);c.fill();
    c.strokeStyle='rgba(0,0,0,.18)';c.lineWidth=1;c.stroke();
    // 冷房の箱
    for(const fx of [0.28,0.6]){const bw=Math.min(cw*0.16,ch*0.55),bh=roofH*0.62,bx=x0+cw*fx-bw/2,by=y+ch*0.07+(roofH-ch*0.06-bh)/2;c.fillStyle='#f7f8f6';c.fillRect(bx,by,bw,bh);c.strokeStyle='#8c949b';c.lineWidth=1.2;c.strokeRect(bx,by,bw,bh);
      c.strokeStyle='#aab1b7';c.lineWidth=1;c.beginPath();for(let k=1;k<5;k++){c.moveTo(bx+3,by+bh*k/5);c.lineTo(bx+bw/2-2,by+bh*k/5);c.moveTo(bx+bw/2+2,by+bh*k/5);c.lineTo(bx+bw-3,by+bh*k/5);}c.stroke();}
    // 側面：客室の窓と帯
    const wy=y+roofH+sideH*0.12,wh=sideH*0.38,nw=st.win+1,ww=(cw*0.84)/nw;const lit=(o.win||0)>0.02;
    for(let k=0;k<nw;k++){c.fillStyle=lit?CFG.night.win:'#1f2d3b';c.beginPath();c.roundRect(x0+cw*0.08+k*ww+1.5,wy,ww-3,wh,1.5);c.fill();if(!lit){c.fillStyle='rgba(255,255,255,.18)';c.fillRect(x0+cw*0.08+k*ww+2.5,wy+1,ww*0.25,wh-2);}}
    c.fillStyle=st.stripe;c.fillRect(x0,y+roofH+sideH*0.6,cw,sideH*0.24);
    c.restore();
    shape();c.lineWidth=Math.max(1.6,ch*0.05);c.strokeStyle=st.edge;c.stroke();
    if(head){c.fillStyle='#16212c';c.beginPath();c.moveTo(x0+cw-ch*0.5,y+ch*0.04);c.quadraticCurveTo(x0+cw-ch*0.04,y+ch*0.06,x0+cw-ch*0.05,y+ch*0.55);c.quadraticCurveTo(x0+cw-ch*0.12,y+ch*0.9,x0+cw-ch*0.32,y+ch*0.86);c.quadraticCurveTo(x0+cw-ch*0.46,y+ch*0.45,x0+cw-ch*0.5,y+ch*0.04);c.fill();
      c.fillStyle='rgba(255,255,255,.4)';c.beginPath();c.moveTo(x0+cw-ch*0.4,y+ch*0.12);c.lineTo(x0+cw-ch*0.3,y+ch*0.12);c.lineTo(x0+cw-ch*0.36,y+ch*0.5);c.lineTo(x0+cw-ch*0.44,y+ch*0.5);c.fill();
      c.fillStyle=(o.head||0)>0.02?CFG.night.head:'#e9eef2';c.beginPath();c.ellipse(x0+cw-ch*0.1,y+ch*0.8,ch*0.05,ch*0.04,0,0,7);c.fill();}
    if(tail){c.fillStyle='#d8392b';c.beginPath();c.ellipse(x0+ch*0.08,y+ch*0.8,ch*0.045,ch*0.04,0,0,7);c.fill();}}};

if(typeof module!=='undefined'&&module.exports)module.exports=A;else root.TrainArt=A;
})(typeof window!=='undefined'?window:globalThis);
