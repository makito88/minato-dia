/* =====================================================================
   夜の光：ゲームの地図（index.html の #map）に重ねる「光の層」（第9回・2026-11-15）。
   本体からは init・draw・dark だけを呼ぶ。地図の絵そのものは変えず、上に「夜の幕」と「光」を重ねる。
   ・光の絵は数分ごと（data/night-light.json の budget）に1枚だけ作り直し、毎コマはそれを貼るだけ（スマホでも軽く）。
   ・毎コマ描くのは、点滅・回る灯台・流れる車のライト・イベントの光などの小さなものだけ。
   ・お絵かき帖の「夜の光」で塗ったもの（保存 dia-routes の night）と、描いた道（edges）を使う。
     保存を読むのは、開いたとき・フォーカス・別のタブで保存したときだけ。
   ・dark(t)：その運行日の本当の暦の日の入り・日の出で暗さ 0〜1（冬は早く・夏は遅く）。
   見た目だけ。乗客・売店・お金の計算には何も渡さない。
   ===================================================================== */
(function(){
'use strict';
const N=window.NightCore,R=window.NightRender;if(!N||!R)return;
const KEY='dia-routes';
let CFG=null,H=null,RAW=null,PICK=null,M=null,BUF={},lastKey='',lastBuild=0,lastMin=-1e9,ver=0,SUN={ymd:'',s:null};
const V={get ready(){return !!(CFG&&H);}};

fetch('data/night-light.json?v=20261115a').then(r=>r.ok?r.json():null).catch(()=>null).then(c=>{if(!c)return;CFG=c;check(true);pickImage();redraw();});
// 地図の絵から「建物らしさ」を拾う（1回だけ）。読めないときは、塗りと形だけで決める
function pickImage(){const im=new Image();im.decoding='async';im.onload=()=>{try{const {gw,gh}=N.dims(CFG),w=gw*2,h=gh*2,cv=document.createElement('canvas');cv.width=w;cv.height=h;const g=cv.getContext('2d',{willReadFrequently:true});
    g.drawImage(im,0,0,w,h);PICK=N.pickScore(g.getImageData(0,0,w,h).data,w,h,CFG);model();redraw();}catch(e){}};im.src='assets/images/map_bg.webp';}
function check(force){let s=null;try{s=localStorage.getItem(KEY);}catch(e){}if(s===RAW&&!force)return;RAW=s;if(CFG){model();redraw();}}
addEventListener('storage',e=>{if(e.key===KEY)check();});addEventListener('focus',()=>check());document.addEventListener('visibilitychange',()=>{if(!document.hidden)check();});
function redraw(){lastKey='';if(H&&H.redraw)try{H.redraw();}catch(e){}}

/* 保存と設定から、明かり・道・星を作る（保存か絵が変わったときだけ） */
function model(){let doc=null;try{doc=JSON.parse(RAW||'null');}catch(e){}const RC=window.RouteCore;
  const m=N.model(CFG,doc,PICK,RC?(d,e)=>RC.edgeFlat(d,e).map(p=>[p.x,p.y]):null);m.groups=R.groups(m.L);M=m;ver++;lastKey='';}

/* host：index.html が渡す（ymd・天気・駅・列車・地図の大きさ・描き直し） */
function init(host){H=host;}
function dark(t){if(!CFG||!H)return null;let ymd='';try{ymd=H.ymd();}catch(e){}if(!ymd)return null;return N.darkness(t,ymd,CFG.sun);}

/* 毎コマ：幕と光を貼り、小さな光を描く。描いたら true（描けないときは本体が今までの幕を描く） */
function draw(c,T,dk){if(!CFG||!H||!M)return false;if(dk<=0)return true;
  const minute=((T%1440)+1440)%1440,cv=c.canvas,scale=H.scale(),wx=H.wx()||'',B=CFG.budget||{},step=B.step||4,now=performance.now();
  const key=[ver,Math.floor(minute/step),wx,cv.width,cv.height,scale.toFixed(4)].join('|');
  const urgent=!BUF.glow||ver+'|'+cv.width+'|'+cv.height+'|'+wx!==BUF.base||Math.abs(minute-lastMin)>30;
  if(key!==lastKey&&(urgent||now-lastBuild>(B.minMs||2200))){const t0=performance.now();
    R.build({cfg:CFG,G:M.G,L:M.L,groups:M.groups,stars:M.stars,roads:M.roads,stations:H.stations(),minute,wx,scale,W:cv.width,H:cv.height},BUF);
    BUF.base=ver+'|'+cv.width+'|'+cv.height+'|'+wx;lastKey=key;lastBuild=now;lastMin=minute;V.buildMs=performance.now()-t0;V.builds=(V.builds||0)+1;}
  const lift=window.MapSeasonView?Math.min(0.6,MapSeasonView.snowLift()||0):0;   // 第10回：雪が積もった夜は明るい（幕を薄く）
  c.save();c.setTransform(1,0,0,1,0,0);const VL=CFG.veil||{};if(VL.mul){c.globalCompositeOperation='multiply';c.globalAlpha=Math.min(1,dk)*(VL.mulA||0.5)*(1-lift*1.2);c.fillStyle=VL.mul;c.fillRect(0,0,cv.width,cv.height);c.globalCompositeOperation='source-over';}   // 青く沈める（灰色にしない）
  c.globalAlpha=Math.min(1,dk)*(1-lift);c.drawImage(BUF.veil,0,0);
  c.globalCompositeOperation='screen';c.globalAlpha=Math.min(1,dk*1.35);c.drawImage(BUF.glow,0,0);c.restore();
  let events=[];try{events=(H.events()||[]).filter(e=>e.state==='during').map(e=>({fx:N.eventFx(e,CFG),x:e.x,y:e.y,src:e.src})).filter(e=>e.fx&&!(e.fx==='hanabi'&&e.src==='game'));}catch(e){}
  let trains=[];try{trains=H.trains()||[];}catch(e){}
  V.dynN=R.dyn(c,{cfg:CFG,minute,dk,t:now/1000,wx,avi:M.avi,runs:M.roads.runs,events,trains});
  return true;}
// バス・配送の道の層（js/route-run.js）を、夜はうすく（光の帯が見えるように）
function roadAlpha(dk){return 1-(CFG?0.74:0.42)*dk;}

Object.assign(V,{init,draw,dark,check,roadAlpha});Object.defineProperties(V,{model:{get:()=>M},cfg:{get:()=>CFG},pick:{get:()=>PICK}});window.NightView=V;
})();
