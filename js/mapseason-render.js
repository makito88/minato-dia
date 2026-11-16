/* =====================================================================
   地図の季節の見た目：絵の部分（第10回・2026-11-16）。ゲームの地図とお絵かき帖で同じ絵。
   ・prepare：地図の絵を w×h のオフスクリーンに描き、色の元（ImageData）と「木・草・水」の割合（MapSeasonCore.attrs）を1回だけ作る。
   ・build：その日の季節の絵を1枚作る（色の塗りかえ → 花の点）。季節の絵（やり方B）が読めていれば先に混ぜる。
     作るのは日に1回（日付・天気・塗り・大きさが変わったときだけ）。毎コマはこの1枚を貼るだけ。
   ・masks：夜の雪明かりと桜のライトアップに使う小さな絵（250×105 くらい）。
   ・drawNight／drawPetals：毎コマの小さなもの（夜の光・散りぎわの花びら。上限あり）。
   ===================================================================== */
(function(){
'use strict';
const C=window.MapSeasonCore;if(!C)return;
const canvasOf=(cv,w,h)=>{cv=cv||document.createElement('canvas');if(cv.width!==w)cv.width=w;if(cv.height!==h)cv.height=h;return cv;};

/* 地図の絵 → 色の元と割合（大きさごとに1回） */
function prepare(img,w,h,old){if(old&&old.w===w&&old.h===h&&old.img===img)return old;
  const cv=canvasOf(null,w,h),g=cv.getContext('2d',{willReadFrequently:true});g.imageSmoothingQuality='high';g.drawImage(img,0,0,w,h);
  const id=g.getImageData(0,0,w,h);return {img,w,h,px:id.data,A:C.attrs(id.data,w,h)};}
// 季節の絵（やり方B）を同じ大きさの色の元に（絵ごとに1回）
function artPx(img,w,h,cache){const k=w+'x'+h;cache=cache||{};if(cache[k])return cache[k];const cv=canvasOf(null,w,h),g=cv.getContext('2d',{willReadFrequently:true});g.imageSmoothingQuality='high';g.drawImage(img,0,0,w,h);return (cache[k]=g.getImageData(0,0,w,h).data);}

/* その日の1枚。S：{cfg, base(prepare), Cc(cells), Wt(weights), snow, art:{spring:{img,cache},…}}。out：前の結果（使い回す） */
function build(S,out){out=out||{};const {cfg,base,Cc,Wt}=S,w=base.w,h=base.h;const t0=(typeof performance!=='undefined'?performance.now():0);
  let src=base.px;const on={};
  // やり方B：季節の絵があれば、その季節の強さで元の絵に混ぜてから塗りかえる
  const mix=[];for(const k of ['spring','autumn','winter']){const a=S.art&&S.art[k];if(a&&a.img&&Wt.art[k]>0.01){mix.push([artPx(a.img,w,h,a.cache||(a.cache={})),Wt.art[k]]);on[k]=1;}else if(a&&a.img)on[k]=1;}
  if(mix.length){const tot=mix.reduce((s,m)=>s+m[1],0),k0=tot>1?1/tot:1,o=new Uint8ClampedArray(src.length);
    for(let i=0;i<src.length;i+=4){let r=src[i],g=src[i+1],b=src[i+2];for(const [p,a0] of mix){const a=a0*k0;r+=(p[i]-src[i])*a;g+=(p[i+1]-src[i+1])*a;b+=(p[i+2]-src[i+2])*a;}o[i]=r;o[i+1]=g;o[i+2]=b;o[i+3]=255;}src=o;}
  const cv=out.cv=canvasOf(out.cv,w,h),g=cv.getContext('2d');const id=g.createImageData(w,h);
  C.recolor(cfg,src,id.data,base.A,Cc,Wt,S.snow,(cfg.art&&cfg.art.over===false)?{}:on);g.putImageData(id,0,0);
  // 花の点（桜・梅・散った花びら）
  const st=out.stamps=C.stamps(cfg,base.A,Cc,Wt),k=w/C.W;g.save();g.scale(k,h/C.H);
  for(const s of st){if(s.k==='sakura'){g.globalAlpha=s.a*0.35;g.fillStyle='rgb(206,120,150)';g.beginPath();g.arc(s.x+s.r*0.35,s.y+s.r*0.45,s.r,0,6.3);g.fill();}
    g.globalAlpha=s.a;g.fillStyle=`rgb(${s.c[0]},${s.c[1]},${s.c[2]})`;g.beginPath();g.arc(s.x,s.y,s.r,0,6.3);g.fill();
    if(s.k!=='petal'&&s.r>0.9){g.globalAlpha=s.a*0.7;g.fillStyle='#fff';g.beginPath();g.arc(s.x-s.r*0.3,s.y-s.r*0.35,s.r*0.38,0,6.3);g.fill();}}
  g.restore();
  masks(S,out);out.ms=(typeof performance!=='undefined'?performance.now():0)-t0;return out;}

/* 夜の雪明かり（白い所）と桜のライトアップ（桜の所）の小さな絵 */
function masks(S,out){const {cfg,Cc,Wt,snow}=S,w=Cc.cw,h=Cc.ch,sn=snow||{lo:0,hi:0};
  const a=out.mSnow=canvasOf(out.mSnow,w,h),b=out.mSak=canvasOf(out.mSak,w,h),ga=a.getContext('2d'),gb=b.getContext('2d'),A=ga.createImageData(w,h),B=gb.createImageData(w,h);
  const N=(cfg.night||{}),sg=N.snowGlow||[190,210,255,0.3],lc=(N.light&&N.light.color)||[255,170,205];let anyS=0,anyK=0;
  for(let i=0;i<w*h;i++){const alt=Cc.alt[i]/255,wa=Cc.water[i]/255,s=sn.lo+(sn.hi-sn.lo)*alt,cp=Wt.cap<2?Math.max(0,Math.min(1,(alt-Wt.cap+0.02)/0.11)):0,v=Math.max(Math.min(1,s*1.3),cp)*(1-wa);
    A.data[i*4]=sg[0];A.data[i*4+1]=sg[1];A.data[i*4+2]=sg[2];A.data[i*4+3]=Math.round(255*v);if(v>0.05)anyS=1;
    const k=(Cc.sak[i]/255)*Wt.sakura*(1-wa)*Math.min(1,(Cc.paint[i]===1?0.8:0)+(Cc.vg?Cc.vg[i]/255*1.6:1));B.data[i*4]=lc[0];B.data[i*4+1]=lc[1];B.data[i*4+2]=lc[2];B.data[i*4+3]=Math.round(255*k);if(k>0.05)anyK=1;}
  ga.putImageData(A,0,0);gb.putImageData(B,0,0);out.anyS=anyS;out.anyK=anyK;
  // ライトアップの灯り（桜の点から少し）
  out.lamps=(out.stamps||[]).filter((s,i)=>s.k==='sakura'&&C.hash(Math.round(s.x*10),Math.round(s.y*10),5)<0.025).slice(0,140);}

/* 毎コマ：夜（雪明かり・桜のライトアップ）。c は地図の単位の変換ずみ */
function drawNight(c,out,cfg,dk,minute,t){if(!out||!out.mSnow||dk<=0.02)return;const N=cfg.night||{};c.save();c.imageSmoothingEnabled=true;
  if(out.anyS){c.globalCompositeOperation='screen';c.globalAlpha=Math.min(1,dk)*((N.snowGlow&&N.snowGlow[3])||0.3);c.drawImage(out.mSnow,0,0,C.W,C.H);}
  const L=N.light||{},k=C.lightupK(cfg,minute)*dk;
  if(out.anyK&&k>0.02){c.globalCompositeOperation='screen';c.globalAlpha=k*(L.a||0.5);c.drawImage(out.mSak,0,0,C.W,C.H);
    c.globalCompositeOperation='lighter';const lp=L.lamp||[255,226,180];
    for(const s of out.lamps||[]){const tw=0.75+0.25*Math.sin(t*2.1+s.x);c.globalAlpha=k*0.5*tw;c.fillStyle=`rgb(${lp[0]},${lp[1]},${lp[2]})`;c.beginPath();c.arc(s.x,s.y,1.7,0,6.3);c.fill();
      c.globalAlpha=k*0.9*tw;c.fillStyle='#fff6ea';c.beginPath();c.arc(s.x,s.y,0.55,0,6.3);c.fill();}}
  c.restore();}

/* 毎コマ：散りぎわの花びら（桜の点の場所から生まれて、風で流れる） */
function drawPetals(c,out,cfg,str,t,P){if(!out||str<=0.02)return;const src=(out.stamps||[]).filter(s=>s.k==='sakura');if(!src.length)return;const n=Math.round(((cfg.fx&&cfg.fx.n)||40)*str);
  c.save();for(let i=0;i<n;i++){const s=src[Math.floor(C.hash(i,7,3)*src.length)],life=6+C.hash(i,9,1)*5,ph=(t/life+C.hash(i,3,9))%1,
    x=s.x+ph*26+Math.sin(t*1.7+i)*2.2,y=s.y-4+ph*18+Math.sin(t*2.3+i*1.3)*1.4,a=Math.sin(ph*Math.PI)*0.95;
    c.globalAlpha=a;c.fillStyle=i%3?'#ffd9e4':'#fff2f6';c.save();c.translate(x,y);c.rotate(t*2+i);c.beginPath();c.ellipse(0,0,1.25*(P||1),0.65*(P||1),0,0,6.3);c.fill();c.restore();}
  c.restore();}

window.MapSeasonRender={prepare,build,masks,drawNight,drawPetals,artPx};
})();
