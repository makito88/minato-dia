/* =====================================================================
   工場の原材料（第5回・第1段：表示と記録だけ）。DOM も localStorage も使わない（node でも読める）
   ・何が・いつ・どれくらい届いたか（入荷）と、毎晩の製造で使った量から、運行日ごとの在庫を記録する。
     在庫＝入荷 − 使った量。ロット（届いた1回ぶん）ごとに残りを持ち、古いロットから使う（先入れ先出し）。
   ・使った量は、その夜の製造の結果（納品書 dia-orders の days[].slip.lines：品ごとに作った数 mk・米の釜の数 pots）から出す。
     納品書のない夜（センターの発注がない夜など）は、ラインの見込みの数（forecast × share）で「見込み」として記録する。
   ・足りなくなっても、製造の計算は変えない（足りなかった量 short を記録して、画面で知らせるだけ）。
   ・夜の番号 n：第n運行日の18:00から始まる夜（出荷は第n+1運行日の朝）。その夜の結果は、第n+1運行日の納品書にある。
     入荷は第n運行日の昼まで（data/factory.json の materials.items[].t）なので、その夜の製造より前に届く。
   ・設定：data/factory.json の materials（品・仕入れ先・届く単位・日持ち・保管・置ける量・入荷の日と時刻）と、各ラインの mat（使う量）。
   ・保存：dia-materials（{v:1,...}。dia- で始まるので引き継ぎコードに入る）。直近 keepDays（30）夜ぶん。
   ===================================================================== */
(function(root){
'use strict';
const KEY='dia-materials';
const r3=x=>Math.round(x*1000)/1000;
const LINES=['rice','bread','sand','donut','bento'];
const LCFG={rice:D=>D.packLine,bread:D=>D.bread,sand:D=>D.sand,donut:D=>D.donut,bento:D=>D.bento};
const PRODS={rice:D=>D.packLine&&D.packLine.fillings,bread:D=>D.bread&&D.bread.products,sand:D=>D.sand&&D.sand.products,donut:D=>D.donut&&D.donut.products,bento:D=>D.bento&&D.bento.products};
const FORE={rice:D=>D.forecast,bread:D=>D.bread&&D.bread.forecast,sand:D=>D.sand&&D.sand.forecast,donut:D=>D.donut&&D.donut.forecast,bento:()=>0};   // お弁当は頼まれた夜だけ作る
const M=D=>D.materials||{};
const items=D=>M(D).items||[];
const itemOf=(D,id)=>items(D).find(x=>x.id===id)||null;
const pad=n=>String(Math.max(0,n|0)).padStart(4,'0');

/* 見込みの夜（納品書がない夜）：ラインの見込みの数を品の割合で分ける */
function estLines(D){const out={};
  for(const L of LINES){const f=FORE[L](D)||0,ps=PRODS[L](D)||[];if(!f||!ps.length)continue;const mk={};for(const p of ps){const n=Math.round(f*(p.share||0));if(n>0)mk[p.id]=n;}
    out[L]={mk};if(L==='rice')out.rice.pots=Math.ceil(f*(1+((D.packLine&&D.packLine.spare)||0))/(D.batchUnits||200));
    if(L==='sand')out.sand.own=((D.sand.defaults||{}).bread==='own')?1:0;}
  return out;}
/* 品ごとの数がない古い納品書：出荷数を品の割合で分ける */
function mkOf(D,L,ln){if(ln.mk)return ln.mk;const ps=PRODS[L](D)||[],tot=ps.reduce((a,p)=>a+(p.share||0),0)||1,mk={};for(const p of ps){const n=Math.round((ln.shipped||0)*(p.share||0)/tot);if(n>0)mk[p.id]=n;}return mk;}
function addTo(u,m,k){if(!m||!k)return;for(const id in m){if(id[0]==='_')continue;u[id]=(u[id]||0)+m[id]*k;}}
/* その夜に使った量（品ごと）。lines＝納品書の lines（ラインごとの mk・pots・rej・own） */
function usage(D,lines){const u={},byLine={};
  for(const L of LINES){const ln=lines&&lines[L];const C=ln&&(LCFG[L](D)||{}).mat;if(!C)continue;const v={};const mk=mkOf(D,L,ln);
    const units=Object.values(mk).reduce((a,b)=>a+b,0);
    addTo(v,C.perUnit,units+(ln.rej||0));
    if(C.perPot){const pots=ln.pots!=null?ln.pots:Math.ceil(units/(D.batchUnits||200));addTo(v,L==='rice'&&D.riceKg?{rice:D.riceKg}:C.perPot,pots);}
    const P={};for(const p of PRODS[L](D)||[])P[p.id]=p;
    for(const pid in mk){const n=mk[pid],p=P[pid];
      if(C.perProduct)addTo(v,C.perProduct[pid],n);
      if(p&&p.pieces&&(C.perPiece||C.perKind)){const per=Object.assign({},C.perPiece||{},ln.own&&C.own?C.own:{});
        for(const k in p.pieces){const pc=n*p.pieces[k];addTo(v,per,pc);if(C.perKind)addTo(v,C.perKind[k],pc);}}
      if(p&&p.recipe&&C.recipe&&C.doughG){const R=p.recipe.ratio||[],sum=R.reduce((a,x)=>a+x[1],0)||1;
        for(const [name,w] of R){const mid=C.recipe[name];if(mid)v[mid]=(v[mid]||0)+n*C.doughG/1000*w/sum;}}}
    for(const id in v){if(!v[id])continue;v[id]=r3(v[id]);u[id]=r3((u[id]||0)+v[id]);}byLine[L]=v;}
  return {all:u,byLine};}

/* 在庫。ロットは {m:品, d:届いた運行日, q:届いた量, left:残り, i:1＝はじめの在庫}（保存を小さくするため、番号・時刻・期限・仕入れ先は設定から出す） */
const stockOf=(S,mid)=>r3(S.lots.filter(l=>l.m===mid).reduce((a,l)=>a+l.left,0));
const lotKey=l=>l.m+'@'+l.d;
/* ロット番号・届いた時刻・消費期限（届いた運行日＋日持ち）・仕入れ先 */
function lotInfo(D,l){const it=itemOf(D,l.m)||{id:l.m},sup=it.sup&&M(D).suppliers?M(D).suppliers[it.sup]:'';
  return {no:`${it.code||String(l.m).toUpperCase().slice(0,2)}-${pad(l.d)}${l.i?'-0':''}`,t:l.i?0:(it.t||0),exp:l.d+(it.life||0),sup:sup||it.sup||'',it};}
function newLot(S,it,n,q,init){const lot={m:it.id,d:n,q:r3(q),left:r3(q)};if(init)lot.i=1;S.lots.push(lot);return lot;}
/* はじめの在庫：見込みの夜 initNights 夜ぶん（1回の入荷より少なければ1回ぶん。置ける量まで。届く単位で切り上げ） */
function newState(D,today){const C=M(D),n0=Math.max(0,(today|0)-2),E=estLines(D),est=usage(D,E).all,S={v:1,last:n0,lots:[],log:[],flags:{sandBuy:!E.sand||!E.sand.own},start:n0+1};
  for(const it of items(D)){if(it.onlyBuy&&!S.flags.sandBuy)continue;const want=Math.max(it.qty||0,(est[it.id]||0)*(C.initNights||3)),pq=it.packQty||1;
    const q=Math.min(it.cap||Infinity,Math.ceil(want/pq)*pq);if(q>0)newLot(S,it,n0,q,true);}
  return S;}
/* 第n運行日に届く品（その夜の製造より前）：入荷の日（n を7で割った余り）なら qty。置ける量をこえる分は届く単位で減らす */
function deliveries(D,S,n){const out=[];
  for(const it of items(D)){if(!(it.days||[]).includes(((n%7)+7)%7))continue;if(it.onlyBuy&&!S.flags.sandBuy)continue;
    const pq=it.packQty||1,room=(it.cap||Infinity)-stockOf(S,it.id);let q=it.qty||0;if(q>room)q=Math.max(0,Math.floor(room/pq)*pq);
    if(q>0)out.push({it,q});}
  return out.sort((a,b)=>(a.it.t||0)-(b.it.t||0));}
/* 古いロットから使う（先入れ先出し）。足りない分は short。from＝[[ロットの届いた運行日, 量, はじめの在庫なら1]] */
function consume(S,mid,need){const from=[];let left=need;
  for(const l of S.lots.filter(x=>x.m===mid&&x.left>0).sort((a,b)=>a.d-b.d||(b.i||0)-(a.i||0))){if(left<=1e-9)break;const q=Math.min(l.left,left);l.left=r3(l.left-q);left=r3(left-q);from.push(l.i?[l.d,r3(q),1]:[l.d,r3(q)]);}
  return {from,short:left>1e-9?r3(left):0};}
/* 1夜ぶん進める。src＝{lines, no}（納品書）か null（見込み）。記録 {n, est, slip, in:[[品,量]], use:{品:量}, from:{品:[[運行日,量]]}, short?} */
function step(D,S,n,src){const ins=[];
  for(const {it,q} of deliveries(D,S,n)){const lot=newLot(S,it,n,q);ins.push([it.id,lot.q]);}
  const lines=src&&src.lines?src.lines:estLines(D),U=usage(D,lines),use={},from={},short={};
  for(const mid in U.all){if(!itemOf(D,mid))continue;const c=consume(S,mid,U.all[mid]);use[mid]=U.all[mid];if(c.from.length)from[mid]=c.from;if(c.short)short[mid]=c.short;}
  const rec={n,est:src&&src.lines?0:1,in:ins,use,from};if(src&&src.no)rec.slip=src.no;if(Object.keys(short).length)rec.short=short;
  S.log.push(rec);
  if(lines.sand)S.flags.sandBuy=!lines.sand.own;
  return rec;}
/* その夜の結果：第n+1運行日の納品書。'wait'＝発注はあるのに納品書がまだ（売店の画面があとで作る） */
function nightSrc(log,n,today){const d=log&&Array.isArray(log.days)?log.days.find(x=>x.day===n+1):null;
  if(d&&d.slip&&!d.slip.err&&d.slip.lines)return {lines:d.slip.lines,no:d.slip.no};
  if(d&&d.factory&&Object.keys(d.factory.items||{}).length&&!d.slip&&n+1>today-7)return 'wait';
  return null;}
/* 運行日の締めで進める：前に記録した夜の次から、第today−1運行日の夜まで（暦でだけ進む・同じ夜は2回数えない）。
   返すもの {state, done（進めた夜の数）} */
function catchUp(D,S,log,today){const C=M(D);if(!items(D).length)return {state:S,done:0};
  today=Math.max(1,today|0);if(!S||S.v!==1||!Array.isArray(S.lots))S=newState(D,today);
  let n=S.last+1,done=0;const end=today-1,mx=C.maxNights||30;
  if(end-n+1>mx){S.gap=(S.gap||0)+(end-mx+1-n);n=end-mx+1;}
  for(;n<=end;n++){const src=nightSrc(log,n,today);if(src==='wait')break;step(D,S,n,src);S.last=n;done++;}
  if(done)trim(D,S);
  return {state:S,done};}
/* 直近 keepDays 夜ぶんだけ残す。使い切ったロットも、記録に残っているあいだは残す（たどるため） */
function trim(D,S){const k=M(D).keepDays||30,lo=S.last-k+1;S.log=S.log.filter(r=>r.n>=lo);
  const used=new Set();for(const r of S.log){for(const m in r.from)for(const x of r.from[m])used.add(m+'@'+x[0]);for(const x of r.in)used.add(x[0]+'@'+r.n);}
  S.lots=S.lots.filter(l=>l.left>0||used.has(lotKey(l)));}

/* ---- 画面用（計算だけ） ---- */
/* 次に届く日（第n運行日から先） */
function nextIn(D,it,n){for(let k=0;k<14;k++){const d=n+k;if((it.days||[]).includes(((d%7)+7)%7))return d;}return null;}
/* 見通し：入荷の予定（qty・置ける量まで）と1夜の使う量 avg で、この先 horizon 夜を進めて、最初に足りなくなる夜（なければ null） */
function runOut(it,stock,avg,now,skip,horizon){let x=stock;for(let k=0;k<(horizon||7);k++){const n=now+k;if(!skip&&(it.days||[]).includes(((n%7)+7)%7)){const pq=it.packQty||1,room=(it.cap||Infinity)-x;let q=it.qty||0;if(q>room)q=Math.max(0,Math.floor(room/pq)*pq);x+=q;}
  x-=avg;if(x<-1e-9)return n;}return null;}
/* 品ごとのいま：在庫・1夜の使う量（直近7夜の平均）・あと何夜ぶん・次の入荷・期限の切れたロット */
function status(D,S){const C=M(D),out=[],recent=S.log.slice(-7),now=S.last+1;
  for(const it of items(D)){const stock=stockOf(S,it.id),uses=recent.map(r=>r.use[it.id]||0),avg=uses.length?r3(uses.reduce((a,b)=>a+b,0)/uses.length):0;
    const nights=avg>0?stock/avg:null,lots=S.lots.filter(l=>l.m===it.id&&l.left>0).sort((a,b)=>a.d-b.d||(b.i||0)-(a.i||0)).map(l=>Object.assign({},l,lotInfo(D,l)));
    const skip=it.onlyBuy&&!S.flags.sandBuy,run=avg>0?runOut(it,stock,avg,now,skip):null;
    // 色：入荷の予定を入れて見通し、lowNights 夜のうちに足りなくなりそうなら赤、warnNights 夜のうちなら黄色
    const lvl=avg<=0?'idle':run!=null&&run-now<(C.lowNights||2)?'low':run!=null&&run-now<(C.warnNights||4)?'warn':'ok';
    out.push({it,stock,avg,nights,run,lvl:skip&&!stock?'idle':lvl,lots,next:skip?null:nextIn(D,it,now),expired:r3(lots.filter(l=>l.exp<now).reduce((a,l)=>a+l.left,0)),skip,short:r3(recent.reduce((a,r)=>a+((r.short||{})[it.id]||0),0))});}
  return out;}
/* 入荷の記録（新しい順） */
function receipts(D,S){const out=[];
  for(const r of S.log)for(const [m,q] of r.in){const I=lotInfo(D,{m,d:r.n});out.push(Object.assign({n:r.n,q},I));}
  for(const l of S.lots)if(l.i)out.push(Object.assign({n:l.d,q:l.q,init:1},lotInfo(D,l)));
  return out.sort((a,b)=>b.n-a.n||b.t-a.t);}
/* ロットのたどり：その夜、品の区分（items[].line：米・パン・サンド・ドーナッツ・包材）ごとに、どのロットから使ったか */
function trace(D,S,n){const r=S.log.find(x=>x.n===n);if(!r)return null;const lines={};
  for(const it of items(D)){const use=r.use[it.id]||0;if(!use)continue;
    (lines[it.line]||(lines[it.line]=[])).push({it,use,short:(r.short||{})[it.id]||0,from:(r.from[it.id]||[]).map(([d,q,i])=>Object.assign({d,q},lotInfo(D,{m:it.id,d,i})))});}
  return {rec:r,lines};}
/* 在庫のつじつま（確かめ用）：はじめ＋入荷−（使った−足りない） */
function balance(S,mid){let a=0;for(const l of S.lots)if(l.i&&l.m===mid)a+=l.q;for(const r of S.log){for(const [m,q] of r.in)if(m===mid)a+=q;a-=(r.use[mid]||0)-((r.short||{})[mid]||0);}return r3(a);}
function parse(str){try{const o=JSON.parse(str||'null');return o&&o.v===1?o:null;}catch(e){return null;}}
root.MaterialCore={KEY,LINES,estLines,usage,newState,deliveries,consume,step,nightSrc,catchUp,trim,stockOf,lotInfo,status,receipts,trace,balance,runOut,nextIn,itemOf,parse};
if(typeof module!=='undefined')module.exports=root.MaterialCore;
})(typeof window!=='undefined'?window:globalThis);
