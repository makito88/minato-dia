/* =====================================================================
   お絵かき帖の「夜の光」の層（第9回・2026-11-15）。route-editor.html の道具「夜の光」（N）で使う。
   ・筆で塗る：「まちの性格」（ビル街・工場/港・住宅・商店街/駅前・温泉/山・川/海・暗いまま・自動に戻す）と、
     「明かりの場所」（置く・置かない・自動に戻す）。塗らないところは、地図の絵から拾った自動のまま。
   ・ゲームと同じ絵で夜をのぞける（夕方・夜・深夜・明け方、晴れ・雨・雪）。色の組み合わせは性格ごとに自由に変えられる。
   ・保存：dia-routes の night（{v:1, zone:"…", lamp:"…", pal:{性格:[色…]}, base:true}。マス目は4×4で、同じ値が続くところを縮めた文字）。
     元に戻す／やり直すは路線と同じ。計算は js/night-core.js、絵は js/night-render.js。
   ===================================================================== */
(function(){
'use strict';
const N=window.NightCore,R=window.NightRender;if(!N||!R)return;
let H=null,CFG=null,PICK=null,SZ=0;
const E={mode:'zone',brush:'biz',lamp:1,r:10,view:'night',time:1260,wx:'',look:true,pal:false};
const TIMES=[['夕方',1050],['夜',1260],['深夜',1530],['明け方',320]];
let A=null,B=null,KEY='',PV={key:'',buf:{}},M=null,MKEY='',STROKE=null;

function init(h){H=h;fetch('data/night-light.json?v=20261115a').then(r=>r.ok?r.json():null).catch(()=>null).then(c=>{if(!c)return;CFG=c;SZ=N.dims(c).gw*N.dims(c).gh;pick();H.ui();H.redraw();});
  if(location.hash==='#night')requestAnimationFrame(()=>{});}
function pick(){const im=new Image();im.onload=()=>{try{const {gw,gh}=N.dims(CFG),w=gw*2,h=gh*2,cv=document.createElement('canvas');cv.width=w;cv.height=h;const g=cv.getContext('2d',{willReadFrequently:true});g.drawImage(im,0,0,w,h);PICK=N.pickScore(g.getImageData(0,0,w,h).data,w,h,CFG);MKEY='';H.redraw();}catch(e){}};im.src='assets/images/map_bg.webp';}
function night(){const d=H.doc();d.night=N.normalize(d.night,CFG);return d.night;}
// 保存の文字 ⇄ マス目（元に戻すで保存が変わったら読み直す）
function grids(){const n=night(),k=n.zone+'|'+n.lamp;if(k!==KEY||!A){A=N.rleDec(n.zone,SZ);B=N.rleDec(n.lamp,SZ);KEY=k;}return n;}
function store(){const n=night();n.zone=N.rleEnc(A);n.lamp=N.rleEnc(B);if(/^0(\.[0-9a-z]+)?$/.test(n.zone))n.zone='';if(/^0(\.[0-9a-z]+)?$/.test(n.lamp))n.lamp='';KEY=n.zone+'|'+n.lamp;}
function mdl(){const d=H.doc(),RC=window.RouteCore,k=JSON.stringify([d.night,d.edges,d.nodes&&Object.keys(d.nodes).length,(d.types&&d.types.road||[]).map(t=>t.id+t.style.width)])+(PICK?1:0);
  if(k!==MKEY||!M){M=N.model(CFG,d,PICK,RC?(dd,e)=>RC.edgeFlat(dd,e).map(p=>[p.x,p.y]):null);M.groups=R.groups(M.L);MKEY=k;PV.key='';}return M;}

/* ---------- 描く ---------- */
function ymdNow(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
const zc=code=>(CFG.zones||[]).find(z=>z.code===code);
function draw(c,k){if(!CFG)return;grids();
  if(E.look){const m=mdl(),key=MKEY+'|'+E.time+'|'+E.wx;
    if(PV.key!==key){R.build({cfg:CFG,G:m.G,L:m.L,groups:m.groups,stars:m.stars,roads:m.roads,stations:Object.values(H.stations()).map(s=>({x:s.x,y:s.y,ang:0})),minute:E.time%1440,wx:E.wx,scale:2,W:2000,H:840},PV.buf);PV.key=key;}
    const dk=N.darkness(E.time,ymdNow(),CFG.sun)||0.001,V=CFG.veil||{};
    c.save();if(V.mul){c.globalCompositeOperation='multiply';c.globalAlpha=dk*(V.mulA||0.5);c.fillStyle=V.mul;c.fillRect(0,0,N.W,N.H);c.globalCompositeOperation='source-over';}
    c.globalAlpha=dk;c.drawImage(PV.buf.veil,0,0,N.W,N.H);c.globalCompositeOperation='screen';c.globalAlpha=Math.min(1,dk*1.35);c.drawImage(PV.buf.glow,0,0,N.W,N.H);c.restore();
    R.dyn(c,{cfg:CFG,minute:E.time%1440,dk,t:3.3,wx:E.wx,avi:m.avi,runs:m.roads.runs,events:[],trains:[]});}
  // 塗ったところ（性格の色・明かりの印）。のぞいているときはうすく
  if(E.mode!=='look'){const {c:cs,gw}=N.dims(CFG),src=E.mode==='zone'?A:B;c.save();c.globalAlpha=E.look?0.32:0.42;
    for(let k2=0;k2<SZ;k2++){const v=src[k2];if(!v)continue;const i=k2%gw,j=(k2/gw)|0;c.fillStyle=E.mode==='zone'?((zc(v)||{}).paint||'#fff'):(v===1?'#ffd36b':'#1b2140');c.fillRect(i*cs,j*cs,cs+0.05,cs+0.05);}
    c.restore();}
  // 筆の輪
  const hv=H.hover&&H.hover();if(hv&&E.mode!=='look'){c.save();c.strokeStyle='#fff';c.lineWidth=1.4/k.z;c.setLineDash([3/k.z,2/k.z]);c.beginPath();c.arc(hv[0],hv[1],E.r,0,7);c.stroke();
    c.strokeStyle=E.mode==='zone'?((CFG.zones.find(z=>z.id===E.brush)||{}).paint||'#fff'):'#ffd36b';c.setLineDash([]);c.lineWidth=0.8/k.z;c.beginPath();c.arc(hv[0],hv[1],E.r+1.2/k.z,0,7);c.stroke();c.restore();}}

/* ---------- 指・マウス ---------- */
function val(){return E.mode==='zone'?N.codeOf(CFG,E.brush):E.lamp;}
function down(w){if(!CFG||E.mode==='look')return null;grids();STROKE={a:A.slice(),b:B.slice(),n:0,last:w};STROKE.n+=N.paintAt(CFG,E.mode==='zone'?A:B,w[0],w[1],E.r,val());return STROKE;}
function move(o,w){if(!o)return;const L=o.last,d=Math.hypot(w[0]-L[0],w[1]-L[1]),st=Math.max(1,Math.ceil(d/(E.r*0.5)));
  for(let i=1;i<=st;i++)o.n+=N.paintAt(CFG,E.mode==='zone'?A:B,L[0]+(w[0]-L[0])*i/st,L[1]+(w[1]-L[1])*i/st,E.r,val());o.last=w;}
function up(o){if(!o)return;STROKE=null;if(!o.n){H.redraw();return;}store();H.commit();}
function cancel(o){if(o){A=o.a;B=o.b;}STROKE=null;H.redraw();}

/* ---------- 下の棚 ---------- */
function dock(d,el,chip){if(!CFG){d.appendChild(el('div','row','<span class="hint">設定を読んでいます…</span>'));return;}
  const n=grids();
  const r1=el('div','row');const sg=el('div','seg');[['zone','まちの性格'],['lamp','明かりの場所'],['look','見るだけ']].forEach(([v,t])=>{const b=el('button',E.mode===v?'on':'',t);b.onclick=()=>{E.mode=v;H.ui();H.redraw();};sg.appendChild(b);});r1.appendChild(sg);
  const lk=chip('夜をのぞく',E.look,()=>{E.look=!E.look;H.ui();H.redraw();});lk.classList.add('mini');r1.appendChild(lk);d.appendChild(r1);
  if(E.mode==='zone'){const r=el('div','row wrap nlz');(CFG.zones||[]).forEach(z=>{const b=chip('',E.brush===z.id,()=>{E.brush=z.id;H.ui();});b.classList.add('mini');
      const i=el('i','evdot');i.style.background=z.auto?'repeating-linear-gradient(45deg,#fff 0 3px,#cfd6d0 3px 6px)':z.paint;b.prepend(i);b.appendChild(document.createTextNode(z.auto?'自動に戻す':z.name));r.appendChild(b);});d.appendChild(r);}
  if(E.mode==='lamp'){const r=el('div','row');[[1,'明かりを置く','#ffd36b'],[2,'置かない','#1b2140'],[0,'自動に戻す','']].forEach(([v,t,col])=>{const b=chip('',E.lamp===v,()=>{E.lamp=v;H.ui();});b.classList.add('mini');
      const i=el('i','evdot');i.style.background=col||'repeating-linear-gradient(45deg,#fff 0 3px,#cfd6d0 3px 6px)';b.prepend(i);b.appendChild(document.createTextNode(t));r.appendChild(b);});
    r.appendChild(el('span','hint','塗らないところは、地図の絵の屋根や壁から自動で'));d.appendChild(r);}
  if(E.mode!=='look'){const r=el('div','row');r.appendChild(el('span','lab','筆の太さ'));const s=el('input');s.type='range';s.min=3;s.max=40;s.value=E.r;s.oninput=()=>{E.r=+s.value;H.redraw();};r.appendChild(s);
    const cl=el('button','chip mini danger',E.mode==='zone'?'性格の塗りを全部消す':'明かりの塗りを全部消す');cl.onclick=()=>{if(!confirm('塗ったものを消して、自動に戻しますか？（「元に戻す」で戻せます）'))return;(E.mode==='zone'?A:B).fill(0);store();H.commit();};r.appendChild(cl);d.appendChild(r);}
  // のぞく時刻と天気・絵の道・色
  const r3=el('div','row wrap');TIMES.forEach(([t,m])=>{const b=chip(t,E.time===m,()=>{E.time=m;E.look=true;H.ui();H.redraw();});b.classList.add('mini');r3.appendChild(b);});
  const ws=el('div','seg');[['','晴れ'],['rain','雨'],['snow','雪']].forEach(([v,t])=>{const b=el('button',E.wx===v?'on':'',t);b.onclick=()=>{E.wx=v;E.look=true;H.ui();H.redraw();};ws.appendChild(b);});r3.appendChild(ws);
  const bs=chip('絵の道にも灯り',n.base!==false,()=>{n.base=n.base===false;H.commit();});bs.classList.add('mini');r3.appendChild(bs);
  const pc=chip('光の色',E.pal,()=>{E.pal=!E.pal;H.ui();});pc.classList.add('mini');r3.appendChild(pc);d.appendChild(r3);
  if(E.pal){const zid=E.mode==='zone'&&!['auto','water','dark'].includes(E.brush)?E.brush:'biz',cols=N.palette(CFG,n,zid).slice(0,5),r4=el('div','row wrap');
    const zs=el('select');(CFG.zones||[]).filter(z=>z.colors).forEach(z=>{const o=el('option',null,z.name);o.value=z.id;if(z.id===zid)o.selected=true;zs.appendChild(o);});zs.onchange=()=>{E.mode='zone';E.brush=zs.value;H.ui();};r4.appendChild(zs);
    cols.forEach((col,i)=>{const lb=el('label','evs-col');const ci=el('input');ci.type='color';ci.value=col;ci.onchange=()=>{const p=N.palette(CFG,n,zid).slice();p[i]=ci.value;n.pal[zid]=p;H.commit();};lb.appendChild(ci);r4.appendChild(lb);});
    if(n.pal[zid]){const rs=el('button','chip mini','元の色');rs.onclick=()=>{delete n.pal[zid];H.commit();};r4.appendChild(rs);}
    r4.appendChild(el('span','hint','その性格の明かりの色（窓・看板）。ゲームの地図にもそのまま'));d.appendChild(r4);}}

window.NightEdit={init,draw,down,move,up,cancel,dock,E,get active(){return !!STROKE;}};
})();
