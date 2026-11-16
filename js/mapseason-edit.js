/* =====================================================================
   お絵かき帖の「季節」の層（第10回・2026-11-16）。route-editor.html の道具「季節」（K）で使う。
   ・筆で塗る：「桜並木」「梅林」「紅葉の山」「田んぼ」（自動に戻す）。塗った場所は季節がはっきり出る。
     塗らないところは、地図の絵の色から自動で見分けたまま（木・草・田んぼのだいたいの形）。
   ・ゲームと同じ絵で、その日の季節をのぞける（梅・桜・散りぎわ・新緑・田植え・夏・稲穂・紅葉・冬・雪）。
   ・保存：dia-routes の season（{v:1, paint:"…"}。マス目は4×4で、同じ値が続くところを縮めた文字）。
     元に戻す／やり直すは路線と同じ。計算は js/mapseason-core.js、絵は js/mapseason-render.js。
   ===================================================================== */
(function(){
'use strict';
const C=window.MapSeasonCore,R=window.MapSeasonRender;if(!C||!R)return;
let H=null,CFG=null,IMG=null,BASE=null,SZ=0,A=null,KEY='',PV={key:'',out:{}},CCK='',CC=null,STROKE=null,tm=null;
const E={brush:'sakura',r:9,look:true,md:'04-01',snow:0};
const LOOK=[['梅','02-22'],['桜','04-01'],['散りぎわ','04-07'],['新緑','04-28'],['田植え','05-12'],['夏','07-20'],['稲穂','09-14'],['紅葉・山','10-28'],['紅葉・ふもと','11-26'],['冬','01-15'],['雪の日','01-20',0.85]];

function init(h){H=h;fetch('data/map-season.json?v=20261116a').then(r=>r.ok?r.json():null).catch(()=>null).then(c=>{if(!c)return;CFG=c;const d=C.dims(c);SZ=d.gw*d.gh;H.ui();H.redraw();});
  IMG=new Image();IMG.decoding='async';IMG.onload=()=>{H&&H.redraw();};IMG.src='assets/images/map_bg.webp';
  const n=new Date();E.md=String(n.getMonth()+1).padStart(2,'0')+'-'+String(n.getDate()).padStart(2,'0');}
function season(){const d=H.doc();d.season=C.normalize(d.season,CFG);return d.season;}
function grid(){const s=season();if(s.paint!==KEY||!A){A=C.rleDec(s.paint,SZ);KEY=s.paint;}return s;}
function store(){const s=season();s.paint=C.rleEnc(A);if(/^0(\.[0-9a-z]+)?$/.test(s.paint))s.paint='';KEY=s.paint;}

/* その日の季節の絵（塗り・日付・雪が変わったら、少しあとに作り直す） */
function bg(){if(!CFG||!E.look||!IMG||!IMG.complete||!IMG.naturalWidth)return null;grid();
  const key=KEY+'|'+E.md+'|'+E.snow;if(PV.key!==key&&!tm){tm=setTimeout(()=>{tm=null;make();H.redraw();},STROKE?400:30);}
  return PV.out.cv||null;}
function make(){grid();BASE=R.prepare(IMG,1000,420,BASE);const ck=KEY;if(ck!==CCK||!CC){CC=C.cells(CFG,BASE.A,A,null);CCK=ck;}
  const ymd='2026-'+E.md,Wt=C.weights(CFG,ymd);PV.out=R.build({cfg:CFG,base:BASE,Cc:CC,Wt,snow:{lo:E.snow,hi:Math.min(1,E.snow*1.3)},art:{}},PV.out);PV.out.Wt=Wt;PV.key=KEY+'|'+E.md+'|'+E.snow;}

/* ---------- 描く（塗ったところと筆の輪） ---------- */
const pc=code=>(CFG.paint||[]).find(p=>p.code===code);
function draw(c,k){if(!CFG)return;grid();const {c:cs,gw}=C.dims(CFG);
  c.save();c.globalAlpha=E.look?0.26:0.45;for(let i=0;i<SZ;i++){const v=A[i];if(!v)continue;const x=i%gw,y=(i/gw)|0;c.fillStyle=(pc(v)||{}).color||'#fff';c.fillRect(x*cs,y*cs,cs+0.05,cs+0.05);}c.restore();
  if(E.look&&PV.out.Wt&&PV.out.Wt.petal>0.02)R.drawPetals(c,PV.out,CFG,PV.out.Wt.petal,performance.now()/1000,1);
  const hv=H.hover&&H.hover();if(hv){const col=(CFG.paint.find(p=>p.id===E.brush)||{}).color||'#fff';c.save();c.strokeStyle='#fff';c.lineWidth=1.4/k.z;c.setLineDash([3/k.z,2/k.z]);c.beginPath();c.arc(hv[0],hv[1],E.r,0,7);c.stroke();
    c.setLineDash([]);c.strokeStyle=col||'#9aa';c.lineWidth=0.8/k.z;c.beginPath();c.arc(hv[0],hv[1],E.r+1.2/k.z,0,7);c.stroke();c.restore();}}

/* ---------- 指・マウス ---------- */
function down(w){if(!CFG)return null;grid();STROKE={a:A.slice(),n:0,last:w};STROKE.n+=C.paintAt(CFG,A,w[0],w[1],E.r,C.codeOf(CFG,E.brush));return STROKE;}
function move(o,w){if(!o)return;const L=o.last,d=Math.hypot(w[0]-L[0],w[1]-L[1]),st=Math.max(1,Math.ceil(d/(E.r*0.5)));
  for(let i=1;i<=st;i++)o.n+=C.paintAt(CFG,A,L[0]+(w[0]-L[0])*i/st,L[1]+(w[1]-L[1])*i/st,E.r,C.codeOf(CFG,E.brush));o.last=w;}
function up(o){if(!o)return;STROKE=null;if(!o.n){H.redraw();return;}store();H.commit();}
function cancel(o){if(o)A=o.a;STROKE=null;H.redraw();}

/* ---------- 下の棚 ---------- */
function dock(d,el,chip){if(!CFG){d.appendChild(el('div','row','<span class="hint">設定を読んでいます…</span>'));return;}
  grid();const r1=el('div','row wrap nlz');
  (CFG.paint||[]).forEach(p=>{const b=chip('',E.brush===p.id,()=>{E.brush=p.id;H.ui();});b.classList.add('mini');b.title=p.hint||'';
    const i=el('i','evdot');i.style.background=p.color||'repeating-linear-gradient(45deg,#fff 0 3px,#cfd6d0 3px 6px)';b.prepend(i);b.appendChild(document.createTextNode(p.name));r1.appendChild(b);});
  d.appendChild(r1);
  const r2=el('div','row');r2.appendChild(el('span','lab','筆の太さ'));const s=el('input');s.type='range';s.min=3;s.max=40;s.value=E.r;s.oninput=()=>{E.r=+s.value;H.redraw();};r2.appendChild(s);
  const cl=el('button','chip mini danger','季節の塗りを全部消す');cl.onclick=()=>{if(!confirm('塗ったものを消して、自動に戻しますか？（「元に戻す」で戻せます）'))return;A.fill(0);store();H.commit();};r2.appendChild(cl);
  r2.appendChild(el('span','hint','塗らないところは、地図の絵の色から自動で'));d.appendChild(r2);
  const r3=el('div','row wrap');const lk=chip('季節をのぞく',E.look,()=>{E.look=!E.look;H.ui();H.redraw();});lk.classList.add('mini');r3.appendChild(lk);
  LOOK.forEach(([t,md,sn])=>{const b=chip(t,E.look&&E.md===md&&E.snow===(sn||0),()=>{E.md=md;E.snow=sn||0;E.look=true;H.ui();H.redraw();});b.classList.add('mini');r3.appendChild(b);});
  const a=el('a','hint','くわしい見本（日付を動かす）');a.href='docs/season-preview.html';a.target='_blank';r3.appendChild(a);d.appendChild(r3);}

window.SeasonEdit={init,bg,draw,down,move,up,cancel,dock,E,get active(){return !!STROKE;}};
})();
