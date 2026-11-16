/* =====================================================================
   地図の季節の見た目：ゲームの地図（index.html の #map）（第10回・2026-11-16）。
   本体からは init・image・key・drawOver・snowLift だけを呼ぶ。
   ・image()：その日の季節の絵（地図の絵の代わりに drawTerrain が敷く）。まだできていなければ null（今までの夏の絵）。
   ・key()：絵が変わったら変わる文字（本体の「動かない層」の作り直しに使う）。日付・天気・塗り・大きさが変わったら、
     少しあとに1回だけ作り直す（毎コマは計算しない）。
   ・drawOver(c,T,dk)：夜の雪明かり・桜のライトアップ・散りぎわの花びら（小さなものだけ）。
   ・snowLift()：雪が積もっている夜は、夜の幕を薄く（js/night-view.js が読む）。
   お絵かき帖の「季節」で塗ったもの（保存 dia-routes の season）を、開いたとき・フォーカス・別のタブで保存したときに読む。
   見た目だけ。乗客・売店・お金の計算には何も渡さない。
   ===================================================================== */
(function(){
'use strict';
const C=window.MapSeasonCore,R=window.MapSeasonRender;if(!C||!R)return;
const KEY='dia-routes';
let CFG=null,H=null,IMG=null,BASE=null,CC=null,CCKEY='',RAW=null,PAINT=null,OUT={},ver=0,want='',have='',busy=false,last=0;
const ART={};
const V={get ready(){return !!(CFG&&H&&OUT.cv&&have);}};

fetch('data/map-season.json?v=20261116a').then(r=>r.ok?r.json():null).catch(()=>null).then(c=>{if(!c)return;CFG=c;loadArt();check(true);});
IMG=new Image();IMG.decoding='async';IMG.onload=()=>{want='';};IMG.src='assets/images/map_bg.webp';
// やり方B：季節の絵があれば読む（なければ何もしない）
function loadArt(){const A=CFG.art||{};for(const [k,f] of Object.entries(A.files||{})){const im=new Image();im.decoding='async';im.onload=()=>{ART[k]={img:im};want='';};im.onerror=()=>{};im.src=(A.dir||'')+f;}}
function check(force){let s=null;try{s=localStorage.getItem(KEY);}catch(e){}if(s===RAW&&!force)return;RAW=s;let doc=null;try{doc=JSON.parse(s||'null');}catch(e){}
  const n=C.normalize(doc&&doc.season,CFG||{}),k=n.paint;if(PAINT&&PAINT.k===k&&!force)return;const {gw,gh}=C.dims(CFG||{});PAINT={k,a:C.rleDec(k,gw*gh),off:!!n.off};CCKEY='';want='';}
addEventListener('storage',e=>{if(e.key===KEY)check();});addEventListener('focus',()=>check());document.addEventListener('visibilitychange',()=>{if(!document.hidden)check();});

function init(host){H=host;}
const G=(f,d)=>{try{const v=f();return v==null?d:v;}catch(e){return d;}};
function resW(){const s=G(()=>H.scale(),1),cap=innerWidth<700?1600:2000;return Math.max(600,Math.min(cap,Math.ceil(1000*s/200)*200));}   // スマホは 1600 まで（地図が小さいので十分・軽く）
function today(){return {wx:G(()=>H.wx(),'sun')};}
function stateKey(){return [G(()=>H.ymd(),''),G(()=>H.wx(),''),resW(),PAINT?PAINT.k:'',Object.keys(ART).sort().join('+')].join('|');}

/* 作り直す（日付・天気・塗り・大きさ・季節の絵が変わったときだけ。少しあとに1回） */
function rebuild(){busy=false;if(!CFG||!H||!IMG.complete||!IMG.naturalWidth)return;const k=stateKey(),ymd=k.split('|')[0];if(!ymd)return;
  const t0=performance.now(),w=resW(),h=Math.round(w*0.42);
  // 重い下ごしらえは1回ずつ分けて（画面が止まらないように）：絵の見分け → 場所ごと → その日の絵
  if(!BASE||BASE.w!==w||BASE.h!==h){BASE=R.prepare(IMG,w,h,BASE);V.prepMs=performance.now()-t0;return later();}
  const rl=G(()=>H.rail(),null),ck=w+'|'+(PAINT?PAINT.k:'')+'|'+JSON.stringify(rl||'');if(ck!==CCKEY){CC=C.cells(CFG,BASE.A,PAINT&&PAINT.a,rl);CCKEY=ck;V.cellMs=performance.now()-t0;return later();}
  const Wt=C.weights(CFG,ymd),snow=C.snowCover(CFG,ymd,y=>G(()=>H.wxOf(y),null),today());
  OUT=R.build({cfg:CFG,base:BASE,Cc:CC,Wt,snow,art:ART},OUT);OUT.Wt=Wt;OUT.snow=snow;
  have=k;want=k;ver++;V.buildMs=performance.now()-t0;V.builds=(V.builds||0)+1;V.Wt=Wt;V.snow=snow;
  G(()=>H.redraw());}
function later(){busy=true;(window.requestIdleCallback||setTimeout)(rebuild,{timeout:400});}
function poke(){if(!CFG||!H)return;const now=performance.now();if(now-last<1500)return;last=now;const k=stateKey();if(k!==have&&!busy){busy=true;(window.requestIdleCallback||setTimeout)(rebuild,{timeout:400});}}

function image(){poke();return have&&OUT.cv?OUT.cv:null;}
function key(){poke();return have?'s'+ver:'';}
function snowLift(){if(!OUT.snow||!CFG)return 0;return Math.min(1,Math.max(OUT.snow.lo,OUT.snow.hi*0.4))*((CFG.night&&CFG.night.lift)||0.3);}
function snowLo(){return have&&OUT.snow?Math.min(1,OUT.snow.lo):0;}
function drawOver(c,T,dk){if(!have||!OUT.cv)return;const m=((T%1440)+1440)%1440,t=performance.now()/1000;
  try{R.drawNight(c,OUT,CFG,dk,m,t);}catch(e){}
  const p=OUT.Wt?OUT.Wt.petal:0;if(p>0.02)try{R.drawPetals(c,OUT,CFG,p,t,Math.max(1,Math.min(1.6,1/(G(()=>H.scale(),1)/2))));}catch(e){}}

Object.assign(V,{init,image,key,drawOver,snowLift,snowLo,check,rebuild});Object.defineProperties(V,{cfg:{get:()=>CFG},out:{get:()=>OUT}});window.MapSeasonView=V;
})();
