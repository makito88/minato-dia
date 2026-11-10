/* お弁当のライン（工場の5本目・港駅の売店をつくる回の5回目・2026-11-10）。DOM に依存しない計算。数字・品質の線はゲームの仮定。
   流れ：おかずを作る（フライヤー・焼き台）→ ご飯（連続式の炊飯器）→ 詰める（人）→ 急速冷却（ブラストチラー）→ ふたと包装 → 2:30 までにチルドの部屋へ。
   ・注文＝ほかの店・取引先の分（決まった乱数）＋センターの発注（cfg.center：売店の商品IDごと。js/factory-night.js が dia-orders から渡す）。
   ・設定は data/factory.json の bento。ほかの4ラインの計算・乱数には触らない。
   返す形はドーナッツのライン（DonutCore）にそろえる：summary.prods[{id,kiosk,name,order,shipped,short,bad,late,surplus}]・summary.lastDone。 */
(function(root){
'use strict';
const hm=t=>`${Math.floor(t/60)%24}:${String(Math.floor(t%60)).padStart(2,'0')}`;
function rng(seed){let x=seed>>>0;return ()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};}
function normalize(D,input){const B=D.bento,c=Object.assign({},B.defaults,input);for(const k of Object.keys(B.ranges)){const [lo,hi]=B.ranges[k];const v=Number(c[k]);c[k]=Math.floor(Math.min(hi,Math.max(lo,Number.isFinite(v)?v:B.defaults[k])));}if(!D.seasons[c.season])c.season=B.defaults.season;return c;}
// 冷える時間（部屋の温度で変わる）。画面の表も同じ式を使う
const chillMin=(B,season)=>Math.ceil(B.chill.base*Math.max(0.7,1+(season.room-19)*B.chill.seasonK));
const fillMin=(B,n,fillers)=>Math.ceil(n/(B.fillRate*fillers));
const lidMin=(B,n)=>Math.ceil(n/B.lidRate);
function simulate(D,input){
 const B=D.bento,cfg=normalize(D,input),season=D.seasons[cfg.season],random=rng(cfg.seed);
 const products=B.products.map(p=>Object.assign({},p,{order:Math.round(B.forecast*p.share*(B.orderMin+random()*B.orderSpread))}));
 const cen={};if(cfg.center)for(const p of products)if(cfg.center[p.kiosk]>0){cen[p.id]=Math.round(cfg.center[p.kiosk]);p.order+=cen[p.id];}
 const cTot=Object.values(cen).reduce((a,b)=>a+b,0);
 // ひと組の並び：品ごとに組を作り、品を交互に並べる（フライヤーと焼き台が同時に動けるように）。
 // 20:00 より前に始める夜は、見込み（forecast×share）の分だけ先に作り、残りは注文確定のあとに作る
 const early=cfg.start<D.orderConfirm,queues=products.map(p=>{const q=[];let made=0;
   if(early){const fc=Math.round(B.forecast*p.share);while(made<fc){const n=Math.min(B.batch,fc-made);q.push({prod:p.id,n,at:cfg.start,late:false});made+=n;}}
   while(made<p.order){const n=Math.min(B.batch,p.order-made);q.push({prod:p.id,n,at:Math.max(cfg.start,D.orderConfirm),late:early});made+=n;}return q;});
 const batches=[];for(let i=0;queues.some(q=>i<q.length);i++)for(const q of queues)if(i<q.length)batches.push(q[i]);
 batches.sort((a,b)=>a.at-b.at);batches.forEach((b,i)=>b.id=i);
 const mFree={};for(const k in B.machines)mFree[k]=Array(B.machines[k].n).fill(cfg.start);
 let riceFree=cfg.start+B.rice.lead,fillFree=cfg.start,lidFree=cfg.start;   // ご飯は炊き始め（cfg.start）から lead 分で出始める
 const chFree=Array(cfg.chillers).fill(cfg.start),cm=chillMin(B,season);
 const ev=[],waits={おかずの機械:0,ご飯:0,詰める:0,急速冷却:0,ふたと包装:0};
 // 段取り（引く形）：急速冷却があく時刻に詰め終わるように詰め始め、詰め始めに間に合うようにおかずを始める。
 // いちばん遅い理由（ご飯・詰める人・急速冷却・おかずの機械）を、そのひと組の「待ち」として数える
 for(const b of batches){const p=products.find(x=>x.id===b.prod);b.steps=[];b.why=[];
  const step=(label,s,e)=>b.steps.push({label,start:s,end:e});
  const M=mFree[p.okazu];let slot=0;for(let i=1;i<M.length;i++)if(M[i]<M[slot])slot=i;
  let cs=0;for(let i=1;i<chFree.length;i++)if(chFree[i]<chFree[cs])cs=i;
  const fd=fillMin(B,b.n,cfg.fillers),riceAt=Math.max(b.at,riceFree);riceFree=riceAt+Math.ceil(b.n/B.rice.rate);
  const why={ご飯:riceAt,詰める:fillFree,急速冷却:chFree[cs]-fd};let target=b.at;for(const k in why)target=Math.max(target,why[k]);
  const ok=Math.max(b.at,M[slot],target-p.cook),okDone=ok+p.cook;why.おかずの機械=M[slot]+p.cook;
  if(ok>b.at)step('おかずを待つ',b.at,ok);b.okazu=ok;b.mach=p.okazu;step(p.okazu==='grill'?'焼く':'揚げる',ok,okDone);M[slot]=okDone;
  const fill=Math.max(okDone,target),fEnd=fill+fd;fillFree=fEnd;b.fill=fill;
  if(fill>okDone)step('詰めるのを待つ',okDone,fill);step('詰める',fill,fEnd);
  {let nk=null,v=-Infinity;for(const k in why)if(why[k]>v){v=why[k];nk=k;}const w=Math.max(0,fill-(b.at+p.cook));if(nk&&w>0)waits[nk]+=w;b.neck=w>0?nk:null;}
  const chS=Math.max(fEnd,chFree[cs]);if(chS>fEnd){waits.急速冷却+=chS-fEnd;step('冷却を待つ',fEnd,chS);}chFree[cs]=chS+cm;step('急速冷却',chS,chS+cm);b.chiller=cs;b.chill=chS;
  const lid=Math.max(chS+cm,lidFree);if(lid>chS+cm){waits.ふたと包装+=lid-(chS+cm);step('包装を待つ',chS+cm,lid);}lidFree=lid+lidMin(B,b.n);step('ふたと包装',lid,lidFree);
  b.done=lidFree;b.score=100;const hold=fill-okDone;
  if(hold>B.holdGrace){b.score-=Math.min(60,(hold-B.holdGrace)*B.holdPenalty);b.why.push(`おかずができてから詰めるまで${hold}分（しんなりした）`);}
  const roomWait=chS-fEnd;if(roomWait>B.chill.limit){b.score=0;b.why.push(`詰めてから冷やすまで${roomWait}分、部屋で待った（衛生の線をこえた）`);}
  b.score=Math.max(0,Math.round(b.score));b.good=b.score>=B.pass;b.expire=B.expiry;
  ev.push({t:ok,msg:`${p.name} ${b.n}個のおかずを${p.okazu==='grill'?'焼き':'揚げ'}始める${b.late===false&&early?'（見込み）':''}`});
  if(roomWait>B.chill.limit)ev.push({t:chS,msg:`${p.name} ${b.n}個：急速冷却があかず、${roomWait}分待った`});
  ev.push({t:b.done,msg:`${p.name} ${b.n}個：${b.good?'ふたと包装まで完了':'不合格（出さない）'}${b.done>D.deadline?'・締め切り後':''}`});}
 if(cfg.start+B.rice.lead>cfg.start)ev.push({t:cfg.start,msg:`炊飯器に米を入れる（最初のご飯は ${hm(cfg.start+B.rice.lead)}）`});
 ev.push({t:Math.max(D.orderConfirm,cfg.start),msg:`注文確定：${products.reduce((n,p)=>n+p.order,0)}個（${products.map(p=>p.name+p.order).join('・')}）`});
 if(cTot)ev.push({t:Math.max(D.orderConfirm,cfg.start),msg:`注文確定：センターから${cTot}個（${cfg.centerNo||'発注'}・${products.filter(p=>cen[p.id]).map(p=>p.name+cen[p.id]).join('・')}）。ほかの店・取引先の分に足して作ります`});
 ev.sort((a,b)=>a.t-b.t);
 const prods=products.map(p=>{const bs=batches.filter(b=>b.prod===p.id),available=bs.filter(b=>b.good&&b.done<=D.deadline).reduce((n,b)=>n+b.n,0),shipped=Math.min(p.order,available);
   return {id:p.id,kiosk:p.kiosk,name:p.name,order:p.order,center:cen[p.id]||0,shipped,short:p.order-shipped,bad:bs.filter(b=>!b.good).reduce((n,b)=>n+b.n,0),late:bs.filter(b=>b.good&&b.done>D.deadline).reduce((n,b)=>n+b.n,0),surplus:Math.max(0,available-p.order)};});
 const total=k=>prods.reduce((n,p)=>n+p[k],0),lastDone=batches.length?Math.max(...batches.map(b=>b.done)):cfg.start,end=Math.max(D.deadline,lastDone);
 const labor=Math.round((end-cfg.start)/60*(B.staff+cfg.fillers)*B.wage*B.nightFactor);
 const material=batches.reduce((n,b)=>n+b.n*products.find(p=>p.id===b.prod).cost,0),chill=cfg.chillers*B.chillCost,machine=B.machineCost;
 const yen={labor,material,chill,machine,total:labor+material+chill+machine};yen.perUnit=total('shipped')?Math.round(yen.total/total('shipped')):0;
 return {cfg,season,products,batches,ev,chillMin:cm,T0:cfg.start,T1:Math.max(B.end,end),summary:{prods,order:total('order'),center:cTot,shipped:total('shipped'),short:total('short'),bad:total('bad'),late:total('late'),surplus:total('surplus'),yen,waits,neck:Object.entries(waits).sort((a,b)=>b[1]-a[1])[0],lastDone}};
}
function stage(b,t){if(t<b.at)return 'まだ';for(const s of b.steps)if(t>=s.start&&t<s.end)return s.label;if(t<b.okazu)return 'まだ';return b.good?'包装ずみ':'不合格';}
root.BentoCore={simulate,normalize,hm,stage,chillMin,fillMin,lidMin};
if(typeof module!=='undefined')module.exports=root.BentoCore;
})(typeof window!=='undefined'?window:globalThis);
