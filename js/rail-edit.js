/* =====================================================================
   お絵かき帖の「線路」の層（第7回・2026-11-13）。route-editor.html の道具「線路」で使う。形の計算は js/rail-shape.js。
   ・開くと今の線路（本線・川辺で分かれる支線）と2つの車庫（中央車庫・港留置線）を表示する。
   ・線路を引っぱると「曲がる点」ができる（なめらかな曲線にも）。駅の印を引っぱって動かせる。車庫の四角の位置・大きさ・出入りの道を直せる。
     「側線を描く」で、車庫の出入りの線や港の側線も描ける。駅の数・順番・つながり・キロ程は変えられない（ここには無い）。
   ・保存：dia-track（お絵かき帖の dia-routes とは別。元に戻す／やり直すも別）。「元の線路に戻す」・書き出す・読み込む。
   ・ゲーム（index.html）は開いたときに dia-track を読む。地図の x,y は見た目だけ（ダイヤ・乗客の計算はキロ程だけ）。
   ===================================================================== */
(function(){
'use strict';
const R=window.RailShape;
let base=null,sh=null,G=null,cur='',UNDO=[],REDO=[],H=null;
const E={sel:null,mode:'edit',draw:null,snap:null};
const DEPN={C:'中央車庫',P:'港留置線'};
const clone=o=>JSON.parse(JSON.stringify(o));
const geom=()=>G||(G=R.build(sh,base));
const changed=()=>{G=null;};
function persist(){R.save(localStorage,sh);}
function commit(){const s=JSON.stringify(sh);if(s===cur)return;UNDO.push(cur);if(UNDO.length>120)UNDO.shift();REDO=[];cur=s;persist();changed();H.ui();H.redraw();}
function revert(){sh=JSON.parse(cur);changed();H.redraw();}
function fixSel(){const s=E.sel;if(!s)return;if((s.k==='bend'&&!(sh.seg[s.key]&&sh.seg[s.key].p[s.i]))||((s.k==='extra'||s.k==='xpt')&&!sh.extra[s.i]))E.sel=null;}

/* ---------- はじめ ---------- */
function init(h,def){H=h;const st={};for(const [k,v] of Object.entries(def.rail.stations))st[k]={x:v.x,y:v.y,name:v.name,big:v.big};
  const dep={};for(const [k,v] of Object.entries(def.rail.depot||{}))if(k[0]!=='_')dep[k]=v;
  base={stations:st,lines:def.rail.lines,depot:dep};
  let raw=null;try{raw=JSON.parse(localStorage.getItem(R.KEY)||'null');}catch(e){}
  sh=R.normalize(raw,base);cur=JSON.stringify(sh);changed();}

/* ---------- 描く ---------- */
const SEGP=k=>{const g=geom(),[a,b]=k.split('-');return g.seg[k]?g.seg[k].pts:[g.st[a],g.st[b]];};
function railStroke(c,polys,k,scale){scale=scale||1;
  [['#e9ebe4',4.4],['#a87a5f',3.1],['#f4efe2',1.6,[2.6,2.6]]].forEach(([col,w,d])=>{c.save();c.strokeStyle=col;c.lineWidth=w*scale;c.lineJoin='round';c.lineCap=d?'butt':'round';c.setLineDash(d||[]);c.beginPath();
    polys.forEach(p=>{if(p.length<2)return;c.moveTo(p[0].x,p[0].y);for(let i=1;i<p.length;i++)c.lineTo(p[i].x,p[i].y);});c.stroke();c.restore();});}
// 背景としての線路（道具が「線路」でなくても、直した形で描く）
function drawRail(c,k,editing){const g=geom();
  // 車庫
  for(const [d,v] of Object.entries(g.depot)){const y=v.yard;c.save();c.fillStyle='rgba(250,247,238,.92)';c.strokeStyle=editing?'#a87a5f':'rgba(80,70,60,.35)';c.lineWidth=editing?1.2:0.8;c.beginPath();c.roundRect(y.x-4,y.y-4,y.w+8,y.h+8,4);c.fill();c.stroke();
    c.strokeStyle='#a87a5f';c.lineWidth=1.4;for(let i=0;i<4;i++){const yy=y.y+4+i*(y.h-8)/3;c.beginPath();c.moveTo(y.x,yy);c.lineTo(y.x+y.w,yy);c.stroke();}c.restore();}
  const polys=R.segKeys(base).map(SEGP);Object.values(g.depot).forEach(v=>polys.push(v.exit));g.extra.forEach(p=>polys.push(p));railStroke(c,polys,k);
  c.textAlign='center';c.textBaseline='middle';
  for(const [d,v] of Object.entries(g.depot)){c.font='700 8px "Zen Kaku Gothic New",sans-serif';c.lineJoin='round';c.strokeStyle='rgba(255,253,246,.95)';c.lineWidth=2.6;c.strokeText(DEPN[d]||d,v.yard.x+v.yard.w/2,v.yard.y-9);c.fillStyle='#5a4a3c';c.fillText(DEPN[d]||d,v.yard.x+v.yard.w/2,v.yard.y-9);}
  Object.entries(base.stations).forEach(([id,s0])=>{const s=g.st[id],on=editing&&E.sel&&E.sel.k==='st'&&E.sel.id===id;
    c.fillStyle='#fff';c.strokeStyle=on?'#e2553f':'#3d7f63';c.lineWidth=on?2.2:1.6;c.beginPath();c.roundRect(s.x-4.5,s.y-3.2,9,6.4,3.2);c.fill();c.stroke();
    const fs=s0.big?10.5:9.2;c.font=`700 ${fs}px "Zen Kaku Gothic New",sans-serif`;const w=c.measureText(s0.name).width+fs*0.9,h=fs*1.55,y=s.y+11+h/2;
    c.save();c.shadowColor='rgba(0,0,0,.22)';c.shadowBlur=2*k.z*k.dpr;c.shadowOffsetY=0.7*k.z*k.dpr;c.fillStyle=s0.big?'#2b6f52':'#3d7f63';c.beginPath();c.roundRect(s.x-w/2,y-h/2,w,h,3.4);c.fill();c.restore();
    c.strokeStyle='#fff';c.lineWidth=0.9;c.stroke();c.fillStyle='#fff';c.fillText(s0.name,s.x,y+0.4);});}
// 道具が「線路」のとき：いちばん上に、つかめる点を描く
function drawOverlay(c,k){const g=geom(),z=k.z,s=E.sel;
  // 選んだ区間・側線を目立たせる
  if(s&&(s.k==='seg'||s.k==='bend')){c.save();c.strokeStyle='#e2553f';c.lineWidth=1.8/z;c.setLineDash([5/z,3/z]);const p=SEGP(s.key);c.beginPath();p.forEach((q,i)=>i?c.lineTo(q.x,q.y):c.moveTo(q.x,q.y));c.stroke();c.restore();}
  if(s&&(s.k==='extra'||s.k==='xpt')&&g.extra[s.i]){c.save();c.strokeStyle='#e2553f';c.lineWidth=1.8/z;c.setLineDash([5/z,3/z]);const p=g.extra[s.i];c.beginPath();p.forEach((q,i)=>i?c.lineTo(q.x,q.y):c.moveTo(q.x,q.y));c.stroke();c.restore();}
  const dot=(x,y,r,fill,stroke)=>{c.fillStyle=fill;c.strokeStyle=stroke;c.lineWidth=1.5/z;c.beginPath();c.arc(x,y,r/z,0,7);c.fill();c.stroke();};
  // 曲がる点（区間の点は白・選んだ点は赤）
  for(const [key,v] of Object.entries(sh.seg)){const on=s&&(s.k==='seg'||s.k==='bend')&&s.key===key;
    if(on){c.save();c.strokeStyle='rgba(226,85,63,.45)';c.lineWidth=1/z;const cp=R.segCtrl(sh,base,key,g.st);c.beginPath();cp.forEach((p,i)=>i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]));c.stroke();c.restore();}
    v.p.forEach((p,i)=>dot(p[0],p[1],s&&s.k==='bend'&&s.key===key&&s.i===i?5:4,'#fff',on?'#e2553f':'#7a5a45'));}
  // 駅（引っぱれる）
  for(const [id,p] of Object.entries(g.st)){c.save();c.strokeStyle=s&&s.k==='st'&&s.id===id?'#e2553f':'rgba(61,127,99,.75)';c.lineWidth=1.4/z;c.setLineDash([2.5/z,2/z]);c.beginPath();c.arc(p.x,p.y,9/z,0,7);c.stroke();c.restore();}
  // 車庫：四角の角（大きさ）と出入りの道の点
  for(const [d,v] of Object.entries(g.depot)){const y=v.yard,on=s&&(s.k==='depot'||s.k==='exit'||s.k==='size')&&s.id===d;
    c.save();c.strokeStyle=on?'#e2553f':'rgba(168,122,95,.8)';c.lineWidth=1.3/z;c.setLineDash([4/z,3/z]);c.strokeRect(y.x-4,y.y-4,y.w+8,y.h+8);c.restore();
    c.fillStyle=on?'#e2553f':'#a87a5f';c.fillRect(y.x+y.w+4-4/z,y.y+y.h+4-4/z,8/z,8/z);
    v.exit.forEach((p,i)=>dot(p.x,p.y,s&&s.k==='exit'&&s.id===d&&s.i===i?4.6:3.6,i===v.exit.length-1?'#a87a5f':'#fff','#7a5a45'));}
  // 側線の点
  sh.extra.forEach((x,i)=>{const on=s&&(s.k==='extra'||s.k==='xpt')&&s.i===i;x.p.forEach((p,j)=>dot(p[0],p[1],on&&s.k==='xpt'&&s.j===j?4.6:3.4,on?'#fff':'#f4efe2',on?'#e2553f':'#7a5a45'));});
  // 描いている途中
  if(E.mode==='draw'&&E.draw!=null&&sh.extra[E.draw]&&E.hover){const L=sh.extra[E.draw].p.at(-1);c.save();c.strokeStyle='rgba(168,122,95,.7)';c.lineWidth=3/z;c.setLineDash([4/z,3/z]);c.beginPath();c.moveTo(L[0],L[1]);c.lineTo(E.hover[0],E.hover[1]);c.stroke();c.restore();}
  if(E.snap){c.strokeStyle='#e2553f';c.lineWidth=2/z;c.beginPath();c.arc(E.snap[0],E.snap[1],7/z,0,7);c.stroke();}}

/* ---------- 当たり判定 ---------- */
function hit(w,tol){const g=geom(),P={x:w[0],y:w[1]},d2=(x,y)=>Math.hypot(x-w[0],y-w[1]);
  // 1) 点（曲がる点・出入りの点・側線の点・車庫の角）
  for(const [key,v] of Object.entries(sh.seg))for(let i=0;i<v.p.length;i++)if(d2(v.p[i][0],v.p[i][1])<tol)return {k:'bend',key,i};
  for(const [d,v] of Object.entries(g.depot)){const y=v.yard;if(d2(y.x+y.w+4,y.y+y.h+4)<tol)return {k:'size',id:d};for(let i=0;i<v.exit.length;i++)if(d2(v.exit[i].x,v.exit[i].y)<tol)return {k:'exit',id:d,i};}
  for(let i=0;i<sh.extra.length;i++)for(let j=0;j<sh.extra[i].p.length;j++)if(d2(sh.extra[i].p[j][0],sh.extra[i].p[j][1])<tol)return {k:'xpt',i,j};
  // 2) 駅
  let bs=null,bd=tol+6;for(const [id,p] of Object.entries(g.st)){const d=d2(p.x,p.y);if(d<bd){bd=d;bs=id;}}if(bs)return {k:'st',id:bs};
  // 3) 線（区間・側線・出入りの道）
  let best=null;R.segKeys(base).forEach(key=>{const q=R.nearestOnPoly(SEGP(key),w);if(q&&q.d<tol*0.9&&(!best||q.d<best.d))best={k:'seg',key,d:q.d,x:q.x,y:q.y};});
  g.extra.forEach((p,i)=>{const q=R.nearestOnPoly(p,w);if(q&&q.d<tol*0.9&&(!best||q.d<best.d))best={k:'extra',i,d:q.d,x:q.x,y:q.y};});
  for(const [d,v] of Object.entries(g.depot)){const q=R.nearestOnPoly(v.exit,w);if(q&&q.d<tol*0.9&&(!best||q.d<best.d))best={k:'exitline',id:d,d:q.d,x:q.x,y:q.y,i:q.i};}
  if(best)return best;
  // 4) 車庫の四角の中
  for(const [d,v] of Object.entries(g.depot)){const y=v.yard;if(P.x>=y.x-4&&P.x<=y.x+y.w+4&&P.y>=y.y-4&&P.y<=y.y+y.h+4)return {k:'depot',id:d};}
  return null;}
// 近くの線路にくっつける（側線・出入りの道を描くとき）
function snapTo(w,tol,skip){const g=geom();let best=null;const cand=(x,y)=>{const d=Math.hypot(x-w[0],y-w[1]);if(d<tol&&(!best||d<best.d))best={x,y,d};};
  for(const p of Object.values(g.st))cand(p.x,p.y);
  R.segKeys(base).forEach(key=>{const q=R.nearestOnPoly(SEGP(key),w);if(q)cand(q.x,q.y);});
  g.extra.forEach((p,i)=>{if(skip===i)return;const q=R.nearestOnPoly(p,w);if(q)cand(q.x,q.y);});
  return best?[+best.x.toFixed(1),+best.y.toFixed(1)]:null;}
const r1=v=>Math.round(v*10)/10;
function depotSh(d){const g=geom().depot[d];if(!sh.depot[d])sh.depot[d]={};const o=sh.depot[d];if(!o.yard)o.yard=[g.yard.x,g.yard.y,g.yard.w,g.yard.h];if(!o.exit)o.exit=g.exit.map(p=>[p.x,p.y]);return o;}

/* ---------- 指・マウス（route-editor.js から呼ぶ） ---------- */
function down(w,tol){if(E.mode==='draw')return {k:'drawtap',tol};const h=hit(w,tol);if(!h)return null;return Object.assign({w0:w,tol},h);}
function move(o,w){const x=r1(w[0]),y=r1(w[1]);E.snap=null;
  if(o.k==='st'){sh.st[o.id]=[x,y];}
  else if(o.k==='bend'){sh.seg[o.key].p[o.i]=[x,y];}
  else if(o.k==='seg'){if(o.bi==null){const cp=R.segCtrl(sh,base,o.key,geom().st);const i=R.insertIndex(cp,{x:o.x,y:o.y});const g=sh.seg[o.key]||(sh.seg[o.key]={p:[],s:1});g.p.splice(i-1,0,[x,y]);o.bi=i-1;E.sel={k:'bend',key:o.key,i:o.bi};}
    sh.seg[o.key].p[o.bi]=[x,y];}
  else if(o.k==='depot'){const d=depotSh(o.id);if(!o.y0){o.y0=d.yard.slice();o.e0=d.exit.map(p=>p.slice());}const dx=w[0]-o.w0[0],dy=w[1]-o.w0[1];
    d.yard[0]=r1(o.y0[0]+dx);d.yard[1]=r1(o.y0[1]+dy);d.exit=o.e0.map((p,i)=>i===o.e0.length-1?p:[r1(p[0]+dx),r1(p[1]+dy)]);}   // 出入りの道の最後（本線につながる点）は動かさない
  else if(o.k==='size'){const d=depotSh(o.id);d.yard[2]=Math.max(16,Math.min(220,r1(w[0]-4-d.yard[0])));d.yard[3]=Math.max(12,Math.min(120,r1(w[1]-4-d.yard[1])));}
  else if(o.k==='exit'){const d=depotSh(o.id);const sn=o.i===d.exit.length-1?snapTo(w,o.tol*1.2):null;E.snap=sn;d.exit[o.i]=sn||[x,y];}
  else if(o.k==='exitline'){const d=depotSh(o.id);if(o.bi==null){d.exit.splice(o.i,0,[x,y]);o.bi=o.i;E.sel={k:'exit',id:o.id,i:o.bi};}d.exit[o.bi]=[x,y];}
  else if(o.k==='xpt'){const p=sh.extra[o.i].p;const end=o.j===0||o.j===p.length-1;const sn=end?snapTo(w,o.tol*1.2,o.i):null;E.snap=sn;p[o.j]=sn||[x,y];}
  else if(o.k==='extra'){const p=sh.extra[o.i].p;if(o.bi==null){const cp=p;const i=R.insertIndex(cp,{x:o.x,y:o.y});p.splice(i,0,[x,y]);o.bi=i;E.sel={k:'xpt',i:o.i,j:i};}p[o.bi]=[x,y];}
  else return;
  o.moved=true;changed();}
function up(o,w,moved,dbl){E.snap=null;
  if(o.k==='drawtap'){tapDraw(w,o.tol||12,dbl);return;}
  if(moved&&o.moved){if(o.k==='st')E.sel={k:'st',id:o.id};else if(o.k==='bend')E.sel={k:'bend',key:o.key,i:o.i};else if(o.k==='depot'||o.k==='size')E.sel={k:o.k,id:o.id};else if(o.k==='exit')E.sel={k:'exit',id:o.id,i:o.i};else if(o.k==='xpt')E.sel={k:'xpt',i:o.i,j:o.j};
    commit();return;}
  // 押しただけ
  if(dbl){if(o.k==='bend'){sh.seg[o.key].p.splice(o.i,1);if(!sh.seg[o.key].p.length)delete sh.seg[o.key];E.sel=sh.seg[o.key]?{k:'seg',key:o.key}:null;commit();H.toast('曲がる点を消しました');return;}
    if(o.k==='seg'){const cp=R.segCtrl(sh,base,o.key,geom().st);const i=R.insertIndex(cp,{x:o.x,y:o.y});const g=sh.seg[o.key]||(sh.seg[o.key]={p:[],s:1});g.p.splice(i-1,0,[r1(o.x),r1(o.y)]);E.sel={k:'bend',key:o.key,i:i-1};commit();H.toast('曲がる点を足しました。引っぱると線路が曲がります');return;}
    if(o.k==='exit'){const d=depotSh(o.id);if(d.exit.length>2&&o.i<d.exit.length-1){d.exit.splice(o.i,1);E.sel={k:'depot',id:o.id};commit();}return;}
    if(o.k==='exitline'){const d=depotSh(o.id);d.exit.splice(o.i,0,[r1(o.x),r1(o.y)]);E.sel={k:'exit',id:o.id,i:o.i};commit();return;}
    if(o.k==='xpt'){const p=sh.extra[o.i].p;if(p.length>2){p.splice(o.j,1);E.sel={k:'extra',i:o.i};commit();}return;}}
  if(o.k==='exitline')E.sel={k:'depot',id:o.id};else if(o.k==='size')E.sel={k:'depot',id:o.id};else E.sel=Object.assign({},o,{w0:undefined});
  if(E.sel&&E.sel.k==='bend')E.sel={k:'bend',key:o.key,i:o.i};
  H.ui();H.redraw();}
function tapEmpty(w,dbl){if(E.mode==='draw'){tapDraw(w,12,dbl);return;}E.sel=null;H.ui();H.redraw();}
function tapDraw(w,tol,dbl){const sn=snapTo(w,tol)||[r1(w[0]),r1(w[1])];
  if(E.draw==null||!sh.extra[E.draw]){sh.extra.push({p:[sn],s:0});E.draw=sh.extra.length-1;changed();H.ui();H.redraw();return;}   // 1点目（保存は2点目から）
  const p=sh.extra[E.draw].p,L=p.at(-1);if(dbl||Math.hypot(L[0]-sn[0],L[1]-sn[1])<3){endDraw();return;}
  p.push(sn);if(p.length>=2)commit();else{changed();H.redraw();}}
function endDraw(){if(E.draw!=null&&sh.extra[E.draw]&&sh.extra[E.draw].p.length<2){sh.extra.splice(E.draw,1);changed();}
  const i=E.draw;E.draw=null;E.mode='edit';if(i!=null&&sh.extra[i])E.sel={k:'extra',i};H.ui();H.redraw();}
function hover(w,tol){E.hover=w;if(E.mode==='draw')return 'crosshair';const h=hit(w,tol);return !h?'':h.k==='seg'||h.k==='extra'||h.k==='exitline'?'pointer':'move';}
function cancel(){revert();}
function del(){const s=E.sel;if(!s)return;
  if(s.k==='bend'){sh.seg[s.key].p.splice(s.i,1);if(!sh.seg[s.key].p.length)delete sh.seg[s.key];}
  else if(s.k==='seg'){delete sh.seg[s.key];}
  else if(s.k==='extra'||s.k==='xpt'){if(s.k==='xpt'&&sh.extra[s.i].p.length>2)sh.extra[s.i].p.splice(s.j,1);else sh.extra.splice(s.i,1);}
  else if(s.k==='st'){delete sh.st[s.id];}
  else if(s.k==='depot'||s.k==='size'){delete sh.depot[s.id];}
  else if(s.k==='exit'){const d=depotSh(s.id);if(d.exit.length>2&&s.i<d.exit.length-1)d.exit.splice(s.i,1);}
  E.sel=null;commit();}
function undo(){if(!UNDO.length)return;REDO.push(cur);cur=UNDO.pop();sh=JSON.parse(cur);fixSel();persist();changed();H.ui();H.redraw();}
function redo(){if(!REDO.length)return;UNDO.push(cur);cur=REDO.pop();sh=JSON.parse(cur);fixSel();persist();changed();H.ui();H.redraw();}

/* ---------- 下の棚 ---------- */
function dock(d,el,chip){const s=E.sel;
  const r=el('div','row');
  const sg=el('div','seg');[['動かす・曲げる','edit'],['側線を描く','draw']].forEach(([n,m])=>{const b=el('button',E.mode===m?'on':'',n);b.onclick=()=>{if(m==='edit')endDraw();else{E.mode='draw';E.draw=null;E.sel=null;H.ui();H.redraw();}};sg.appendChild(b);});r.appendChild(sg);
  if(E.mode==='draw'){r.appendChild(el('span','hint',E.draw==null?'地図を押して側線の点を置く（線路の近くはくっつく）':'つづけて押す・2回押すか「ここで終わる」'));if(E.draw!=null)r.appendChild(chip('✓ ここで終わる',false,endDraw));d.appendChild(r);return;}
  let hint='線路を引っぱると曲がる・駅や車庫の印も引っぱれる';
  if(s&&(s.k==='seg'||s.k==='bend')){const g=sh.seg[s.key];const [a,b]=s.key.split('-');hint=`${base.stations[a].name}〜${base.stations[b].name}`+(g?`・曲がる点 ${g.p.length}`:'・まっすぐ');
    if(g){const sg2=el('div','seg');[['なめらか',1],['かくかく',0]].forEach(([n,v])=>{const b2=el('button',g.s===v?'on':'',n);b2.onclick=()=>{g.s=v;commit();};sg2.appendChild(b2);});r.appendChild(sg2);
      const x=chip('まっすぐにもどす',false,()=>{delete sh.seg[s.key];E.sel={k:'seg',key:s.key};commit();});x.classList.add('mini');r.appendChild(x);
      if(s.k==='bend'){const y=chip('この点を消す',false,del);y.classList.add('mini','danger');r.appendChild(y);}}}
  else if(s&&s.k==='st'){hint=`${base.stations[s.id].name}駅の位置（地図の上だけ。キロ程は同じ）`;if(sh.st[s.id]){const x=chip('元の位置',false,()=>{delete sh.st[s.id];commit();});x.classList.add('mini');r.appendChild(x);}}
  else if(s&&(s.k==='depot'||s.k==='size'||s.k==='exit')){hint=`${DEPN[s.id]}：中を引っぱると動く・右下の角で大きさ・出入りの道は点を引っぱる（2回押すと点を足す・消す）`;if(sh.depot[s.id]){const x=chip('元にもどす',false,()=>{delete sh.depot[s.id];commit();});x.classList.add('mini');r.appendChild(x);}}
  else if(s&&(s.k==='extra'||s.k==='xpt')&&sh.extra[s.i]){const g=sh.extra[s.i];hint='描いた側線（引っぱると点が増える・2回押すと点を消す）';const sg2=el('div','seg');[['なめらか',1],['かくかく',0]].forEach(([n,v])=>{const b2=el('button',g.s===v?'on':'',n);b2.onclick=()=>{g.s=v;commit();};sg2.appendChild(b2);});r.appendChild(sg2);
    const y=chip('この側線を消す',false,()=>{sh.extra.splice(s.i,1);E.sel=null;commit();});y.classList.add('mini','danger');r.appendChild(y);}
  r.appendChild(el('span','hint',hint));d.appendChild(r);
  const r2=el('div','row');r2.appendChild(el('span','lab','線路'));
  const bx=chip('書き出す',false,exportJSON);bx.classList.add('mini');r2.appendChild(bx);
  const bi=chip('読み込む',false,()=>file().click());bi.classList.add('mini');r2.appendChild(bi);
  const br=chip('元の線路に戻す',false,()=>{if(R.isEmpty(sh)){H.toast('いまは元の線路のままです');return;}sh=R.normalize(null,base);E.sel=null;commit();H.toast('元の線路に戻しました（「元に戻す」で取り消せます）');});br.classList.add('mini','danger');r2.appendChild(br);
  r2.appendChild(el('span','hint',R.isEmpty(sh)?'いまは元の線路（直線）':'ゲームの地図は、開き直すとこの形になります'));d.appendChild(r2);}
let FI=null;function file(){if(FI)return FI;FI=document.createElement('input');FI.type='file';FI.accept='application/json,.json';FI.hidden=true;document.body.appendChild(FI);
  FI.onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;try{const j=JSON.parse(await f.text());const raw=j.track||j;if(!raw||(!raw.st&&!raw.seg&&!raw.depot&&!raw.extra))throw 0;sh=R.normalize(raw,base);E.sel=null;commit();H.toast('線路を読み込みました');}catch(er){H.toast('読み込めませんでした（この帖の「線路」で書き出した JSON を選んでください）');}};return FI;}
function exportJSON(){const b=new Blob([JSON.stringify({format:'minato-track',v:1,track:sh},null,1)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='minato-track-'+new Date().toISOString().slice(0,16).replace(/[:T-]/g,'')+'.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),3000);H.toast('線路を JSON に書き出しました');}

window.RailEdit={init,drawRail,drawOverlay,down,move,up,tapEmpty,hover,cancel,del,undo,redo,dock,endDraw,
  get canUndo(){return UNDO.length>0;},get canRedo(){return REDO.length>0;},get drawing(){return E.mode==='draw'&&E.draw!=null;},get shape(){return sh;},E};
})();
