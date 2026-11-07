/* =====================================================================
   工場の画面の「いま」（2026-11-07）：4つのラインの画面が共通で使う、本当の時刻と速さのボタン
   ・ページを開くと、本当の時刻（この端末の時計）の工場をそのまま動かす（×1）。速さは ×60・×300・×900 に変えられ、「いま」で戻る。
   ・工場の夜は 18:00 から翌朝まで。0:00〜11:59 は前の夜の続き（24:00〜35:59 として数える）。
     夜の前（12:00〜開始）は始まる前の様子、夜のあと（終わり〜11:59）は終わったときの様子を出す。
   ・機械の動き（回る・流れる・湯気など）は、速さにかかわらず本当の秒で動かす（×1 でも動いているのがわかるように）。
   ===================================================================== */
(function(root){
'use strict';
const hm=t=>{t=Math.floor(t);return Math.floor(t/60)%24+':'+String(((t%60)+60)%60).padStart(2,'0');};
/* いまの時刻（0時からの分。正午より前は前の夜の続きとして +1440） */
function nowT(){const d=new Date();let m=d.getHours()*60+d.getMinutes()+d.getSeconds()/60+d.getMilliseconds()/60000;if(m<720)m+=1440;return m;}
/* 本当の秒（機械の動きの絵に使う） */
function sec(){return (typeof performance!=='undefined'?performance.now():Date.now())/1000;}
const SPEEDS=[['live','いま（×1）'],[60,'×60'],[300,'×300'],[900,'×900']];
/* 夜の T0〜T1 のどこを見せるか（分）。前は T0、あとは T1 */
function liveAt(T0,T1){return Math.max(T0,Math.min(T1,nowT()));}
/* 速さのボタンの下に出すひとこと */
function note(T0,T1,live,playing){const t=nowT();
  if(!live)return playing?'早送りで再生中。「いま」を押すと本当の時刻に戻ります。':'止めています。「いま」を押すと本当の時刻に戻ります。';
  if(!playing)return '止めています（「いま」か ▶ で、本当の時刻に戻ります）。';
  if(t<T0)return `いま ${hm(t)}。この工場は ${hm(T0)} から動きます（いまは始まる前の様子）。速さを変えると、夜を早送りで見られます。`;
  if(t>T1)return `今夜の分は ${hm(T1)} に終わりました（終わったときの様子）。次は ${hm(T0)} から。速さを変えると、夜を早送りで見られます。`;
  return `いま ${hm(t)} の工場を、本当の速さで動かしています。`;}
/* 動いている機械の目印（本当の秒で動く）。湯気・熱気：上に昇る丸。泡：油の中で上がる点。どちらも点の数は少なく（軽く） */
function puffs(c,x,y,w,n,color){const s=sec();c.save();c.strokeStyle=color||'rgba(150,160,170,.8)';c.lineWidth=1.5;
  for(let k=0;k<(n||3);k++){const u=(s*0.6+k/(n||3))%1,px=x+w*(k+0.5)/(n||3)+3*Math.sin(s*2+k);c.globalAlpha=0.7*(1-u);c.beginPath();c.arc(px,y-u*22,3+u*4,0,7);c.stroke();}c.restore();}
function bubbles(c,x,y,w,h,n){const s=sec();c.save();c.fillStyle='rgba(255,240,200,.85)';
  for(let k=0;k<(n||6);k++){const u=(s*0.9+k*0.37)%1,px=x+w*((k*0.61)%1);c.globalAlpha=1-u;c.beginPath();c.arc(px,y+h-u*h,1.6+u,0,7);c.fill();}c.restore();}
root.FactoryLive={nowT,sec,SPEEDS,liveAt,note,hm,puffs,bubbles};
})(typeof window!=='undefined'?window:globalThis);
