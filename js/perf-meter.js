/* 負荷メーター：index.html?perf=1 で開いたときだけ、画面の左下に小さく出す（?perf=0 で消す。覚えておくのはこの端末だけ）。
   1秒ごとに：毎コマの処理の回数・地図の描き直しの回数・1コマの処理時間（平均と最大）・長い仕事（対応する端末だけ）・ゲーム時間の進み・電池（対応する端末だけ）。
   ふだんは何もしない（PERF は null のまま）。 */
(function(){
'use strict';
let on=false;try{const q=new URLSearchParams(location.search).get('perf');if(q==='1')localStorage.setItem('minato-perf','1');if(q==='0')localStorage.removeItem('minato-perf');on=localStorage.getItem('minato-perf')==='1';}catch(e){}
if(!on)return;
const S={raf:0,map:0,ft:0,fmax:0,fn:0,long:0,t0:performance.now(),T0:null,bat:null,bat0:null,batT0:0};
const r=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=f=>r(t=>{S.raf++;f(t);});
let fs=0;
PERF={f0(){fs=performance.now();},f1(){const d=performance.now()-fs;S.ft+=d;S.fn++;if(d>S.fmax)S.fmax=d;},n(k){S[k]=(S[k]||0)+1;}};
try{new PerformanceObserver(l=>{for(const e of l.getEntries())S.long+=e.duration;}).observe({type:'longtask',buffered:false});S.hasLong=true;}catch(e){S.hasLong=false;}
try{navigator.getBattery&&navigator.getBattery().then(b=>{S.bat=b;S.bat0=b.level;S.batT0=Date.now();});}catch(e){}
const box=document.createElement('div');box.id='perfMeter';
box.style.cssText='position:fixed;left:6px;bottom:6px;z-index:99999;background:rgba(10,14,20,.82);color:#e8f0f6;font:11px/1.45 ui-monospace,monospace;padding:6px 8px;border-radius:6px;pointer-events:none;white-space:pre';
const put=()=>{if(!box.isConnected&&document.body)document.body.appendChild(box);};
let last=performance.now();
setInterval(()=>{put();const now=performance.now(),sec=(now-last)/1000;last=now;
  let Tnow=null,sp=null,pl=null;try{Tnow=T;sp=speed;pl=playing;}catch(e){}
  const tr=(S.T0!=null&&pl&&sp)?((Tnow-S.T0)/sec/sp):null;S.T0=Tnow;
  let bat='';if(S.bat){const lv=S.bat.level*100;const h=(Date.now()-S.batT0)/3600000;const used=(S.bat0-S.bat.level)*100;bat=`\n電池 ${lv.toFixed(0)}%${S.bat.charging?'（充電中）':''}${h>0.05&&!S.bat.charging?` 減り ${(used/h).toFixed(1)}%/時`:''}`;}
  box.textContent=`毎コマ ${(S.raf/sec).toFixed(0)}/秒  地図 ${((S.map||0)/sec).toFixed(1)}/秒\n1コマ 平均${S.fn?(S.ft/S.fn).toFixed(1):'-'}ms 最大${S.fmax.toFixed(0)}ms`+
    (S.hasLong?`\n長い仕事 ${(S.long/sec/10).toFixed(0)}%`:'')+(tr!=null?`\n時間の進み ${tr.toFixed(2)}倍`:'')+bat+(()=>{try{return `\n画質 ${QFULL?'いつも最高（?quality=full）':'自動（?quality=auto）'} 細かさ${CDPR}倍`;}catch(e){return '';}})()+(document.hidden?'\n（裏）':'');
  S.raf=0;S.map=0;S.ft=0;S.fn=0;S.fmax=0;S.long=0;},1000);
})();
