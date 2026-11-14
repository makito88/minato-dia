/* =====================================================================
   地図の吹き出しの絵（第8回・2026-11-14）。ゲームの地図（index.html）とお絵かき帖（route-editor.html）で同じ絵を使う。
   形：白い丸に絵・下に小さな三角のしっぽ・うすい影・ふちの色で種類。合う絵文字がないときは金の文字（1〜2文字）。
   ゲームの仕掛けの印（3D・2.5D・指令の金色のピン）と区別するため、金の文字の吹き出しは、白い細いふちの外に種類の色のふちを付ける。
   絵文字は端末ごとに見た目が違うので、Twemoji の SVG（assets/images/emoji/）を1回だけ小さな絵にして使う。
   ===================================================================== */
(function(){
'use strict';
const M=window.EventMapCore;
let CFG=null,KIND={};const IMG=new Map();
const B={onload:null};
function init(cfg){CFG=cfg;KIND={};(cfg.kinds||[]).forEach(k=>KIND[k.id]=k);}
function rimOf(it){return it.rim||(KIND[it.kind]&&KIND[it.kind].rim)||'#8a8f88';}
// 絵文字の絵（96px に1回だけ描いておく。読み込み中は null）
function sprite(e){if(!CFG||!e)return null;let s=IMG.get(e);if(s)return s.ready?s.cv:null;
  s={ready:false,cv:document.createElement('canvas')};IMG.set(e,s);const im=new Image();im.decoding='async';
  im.onload=()=>{s.cv.width=s.cv.height=96;const g=s.cv.getContext('2d');g.drawImage(im,0,0,96,96);s.ready=true;if(B.onload)B.onload();};
  im.onerror=()=>{s.bad=true;};im.src=(CFG.emojiDir||'assets/images/emoji/')+M.fileOf(e);return null;}
function bad(e){const s=IMG.get(e);return !!(s&&s.bad);}

// 丸としっぽをひとつの形に（tip＝しっぽの先＝場所）
function shape(c,x,y,cx,cy,r,hw){const a=Math.asin(Math.min(0.95,hw/r));c.beginPath();c.arc(cx,cy,r,Math.PI/2+a,Math.PI/2-a+Math.PI*2,false);c.lineTo(x,y);c.closePath();}
/* 1つ描く。b={x,y,icon,kind,rim,big,state,sel,count}・o={t:秒, k:大きさの倍率, px:1単位の画面の点の数, phase}
   返り値：{cx,cy,r}（当たり判定に使う） */
function draw(c,b,o){o=o||{};const S=(CFG&&CFG.size)||{r:10.5,big:14,tail:6.5},k=o.k||1,px=o.px||1,t=o.t||0;
  const st=b.state||'during',alpha=st==='during'?1:st==='before'?0.52:0.3;
  let r=(b.big?S.big:S.r)*k;const breathe=st==='during'?1+0.055*Math.sin(t*1.7+(o.phase||0)):1;r*=breathe;
  const tail=S.tail*k,hw=Math.max(2.6,r*0.36),cx=b.x,cy=b.y-tail-r*0.92,rim=rimOf(b),gold=!!(b.icon&&b.icon.t);
  c.save();c.globalAlpha=alpha;
  // 開いているあいだは、種類の色の輪がゆっくり広がる
  if(st==='during'&&!o.still){const ph=((t*0.42+(o.phase||0)*0.17)%1);c.save();c.globalAlpha=alpha*(1-ph)*0.55;c.strokeStyle=rim;c.lineWidth=1.6*k;c.beginPath();c.arc(cx,cy,r+2*k+ph*10*k,0,Math.PI*2);c.stroke();c.restore();}
  // まとめたもの：うしろに重なる丸
  if(b.count>1){c.save();c.fillStyle='#fffdf6';c.strokeStyle=rim;c.lineWidth=1.4*k;c.globalAlpha=alpha*0.9;c.shadowColor='rgba(40,30,20,.22)';c.shadowBlur=4*px*k;c.beginPath();c.arc(cx+r*0.48,cy-r*0.3,r*0.86,0,Math.PI*2);c.fill();c.shadowColor='transparent';c.stroke();c.restore();}
  // 影 → 白（金）の形 → ふち
  c.save();c.shadowColor='rgba(38,30,18,.32)';c.shadowBlur=7*px*k;c.shadowOffsetY=2.2*px*k;
  if(gold){const G=CFG&&CFG.gold||{},g=c.createLinearGradient(cx,cy-r,cx,cy+r);g.addColorStop(0,G.fill||'#c9a35c');g.addColorStop(1,G.fill2||'#b08640');c.fillStyle=g;}else c.fillStyle='#ffffff';
  shape(c,b.x,b.y,cx,cy,r,hw);c.fill();c.restore();
  if(gold){c.strokeStyle='#fff';c.lineWidth=1.3*k;shape(c,b.x,b.y,cx,cy,r,hw);c.stroke();c.strokeStyle=rim;c.lineWidth=2.2*k;shape(c,b.x,b.y,cx,cy,r+1.6*k,hw+0.8*k);c.stroke();}
  else{c.strokeStyle=rim;c.lineWidth=2*k;shape(c,b.x,b.y,cx,cy,r,hw);c.stroke();}
  // 中の絵
  if(gold){const txt=b.icon.t,n=Array.from(txt).length;c.fillStyle=(CFG&&CFG.gold&&CFG.gold.ink)||'#fff';c.textAlign='center';c.textBaseline='middle';
    c.font=`700 ${(n>1?0.82:1.12)*r}px "Zen Kaku Gothic New","Zen Maru Gothic",sans-serif`;c.fillText(txt,cx,cy+r*0.04);}
  else{const e=b.icon&&b.icon.e,sp=sprite(e),w=r*1.28;if(sp)c.drawImage(sp,cx-w/2,cy-w/2,w,w);
    else if(bad(e)||!sp){c.fillStyle=rim;c.textAlign='center';c.textBaseline='middle';c.font=`${r*1.05}px sans-serif`;c.fillText(e||'・',cx,cy+r*0.05);}}
  // 選んだもの
  if(b.sel){c.save();c.strokeStyle='#e2553f';c.lineWidth=1.6*k;c.setLineDash([3*k,2.4*k]);c.beginPath();c.arc(cx,cy,r+5*k,0,Math.PI*2);c.stroke();c.restore();}
  // まとめた数
  if(b.count>1){const bx=cx+r*0.8,by=cy-r*0.78,br=5.6*k;c.fillStyle='#24312c';c.beginPath();c.arc(bx,by,br,0,Math.PI*2);c.fill();c.strokeStyle='#fff';c.lineWidth=1.1*k;c.stroke();
    c.fillStyle='#fff';c.font=`700 ${7.4*k}px "Zen Kaku Gothic New",sans-serif`;c.textAlign='center';c.textBaseline='middle';c.fillText(String(b.count),bx,by+0.3*k);}
  c.restore();
  return {cx,cy,r:r+2*k};}
// 吹き出しの下の小さな名札
function label(c,text,x,y,o){o=o||{};const k=o.k||1;c.save();c.globalAlpha=o.alpha==null?1:o.alpha;c.font=`700 ${8.6*k}px "Zen Kaku Gothic New",sans-serif`;c.textAlign='center';c.textBaseline='middle';
  const w=c.measureText(text).width+9*k,h=13*k;let lx=x;if(o.minX!=null)lx=Math.max(o.minX+w/2,Math.min(o.maxX-w/2,lx));
  c.fillStyle='rgba(255,252,244,.93)';c.strokeStyle=o.rim||'rgba(36,49,44,.18)';c.lineWidth=0.9*k;c.beginPath();c.roundRect(lx-w/2,y,w,h,h/2);c.fill();c.stroke();
  c.fillStyle='#24312c';c.fillText(text,lx,y+h/2+0.4*k);c.restore();}
Object.assign(B,{init,draw,label,rimOf,sprite,kind:id=>KIND[id]});Object.defineProperty(B,'cfg',{get:()=>CFG});window.EventBubble=B;
})();
