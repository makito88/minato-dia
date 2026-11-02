/* ドーナッツの一晩。DOMに依存しない計算。数字・品質の線はゲームの仮定。 */
(function(root){
'use strict';
const hm=t=>`${Math.floor(t/60)%24}:${String(Math.floor(t%60)).padStart(2,'0')}`;
function rng(seed){let x=seed>>>0;return ()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};}
function normalize(D,input){const B=D.donut,c=Object.assign({},B.defaults,input);for(const k of Object.keys(B.ranges)){const [lo,hi]=B.ranges[k];const v=Number(c[k]);c[k]=Math.floor(Math.min(hi,Math.max(lo,Number.isFinite(v)?v:B.defaults[k])));}if(!D.seasons[c.season])c.season=B.defaults.season;return c;}
function simulate(D,input){
 const B=D.donut,cfg=normalize(D,input),season=D.seasons[cfg.season],random=rng(cfg.seed);
 const products=B.products.map(p=>Object.assign({},p,{order:Math.round(B.forecast*p.share*(B.orderMin+random()*B.orderSpread))}));
 const batches=[],ev=[],waits={成形:0,揚げる順番:0,仕上げ:0,包装:0};
 // 注文前は見込みで仕込む。まだこねていない分は20時に注文へ合わせる。
 let mixFree=cfg.start;
 for(const p of products){let made=0;const forecast=Math.round(B.forecast*p.share);
  while(made<forecast&&mixFree<D.orderConfirm){const n=Math.min(B.batch,forecast-made);batches.push({id:batches.length,prod:p.id,n,mix:mixFree,late:false});made+=n;mixFree+=B.mix;}
 }
 mixFree=Math.max(mixFree,D.orderConfirm);
 for(const p of products){let made=batches.filter(b=>b.prod===p.id).reduce((n,b)=>n+b.n,0);
  while(made<p.order){const n=Math.min(B.batch,p.order-made);batches.push({id:batches.length,prod:p.id,n,mix:mixFree,late:true});made+=n;mixFree+=B.mix;}
 }
 batches.sort((a,b)=>a.mix-b.mix);const fryFree=Array(cfg.fryers).fill(cfg.start),oil=Array(cfg.fryers).fill(0);let shapeFree=cfg.start,finishFree=cfg.start,packFree=cfg.start;
 for(const b of batches){const p=products.find(p=>p.id===b.prod);b.steps=[];b.why=[];b.oilChanges=0;
  const step=(label,start,end)=>{b.steps.push({label,start,end});};
  step('仕込み',b.mix,b.mix+B.mix);
  let t=b.mix+B.mix;const ferment=Math.ceil(p.ferment*Math.pow(B.fermentQ10,(B.fermentRef-season.room)/10));step('一次発酵',t,t+ferment);t+=ferment;
  b.shape=Math.max(t,shapeFree);waits.成形+=b.shape-t;step('成形を待つ',t,b.shape);shapeFree=b.shape+Math.ceil(b.n/B.shapeRate);step('成形',b.shape,shapeFree);
  t=shapeFree;step('ホイロ',t,t+p.proof);const ready=t+p.proof;
  let slot=0;for(let i=1;i<fryFree.length;i++)if(fryFree[i]<fryFree[slot])slot=i;
  let fry=Math.max(ready,fryFree[slot]);
  if(oil[slot]+b.n>cfg.oilEvery&&oil[slot]>0){step('油を交換',fry,fry+B.oilChange);ev.push({t:fry,msg:`フライヤー${slot+1}の油を交換（${B.oilChange}分）`});fry+=B.oilChange;oil[slot]=0;b.oilChanges++;}
  b.fry=fry;b.slot=slot;b.oil=oil[slot]+b.n;waits.揚げる順番+=fry-ready;step('揚げる順番を待つ',ready,fry);
  const fryMin=Math.ceil(b.n/B.fryCap)*p.fry;step('揚げる',fry,fry+fryMin);fryFree[slot]=fry+fryMin;oil[slot]+=b.n;
  b.score=100;
  if(fry-ready>B.proofGrace){b.score-=Math.min(65,(fry-ready-B.proofGrace)*B.proofPenalty);b.why.push('揚げる番を待って発酵が進みすぎた');}
  if(Math.abs(cfg.oilT-p.oilT)>B.tempGrace){b.score-=Math.abs(cfg.oilT-p.oilT)*B.tempPenalty;b.why.push(cfg.oilT<p.oilT?'油の温度が低く、油っぽい':'油の温度が高く、焦げやすい');}
  if(b.oil>B.oilGood){b.score-=Math.min(60,(b.oil-B.oilGood)*B.oilPenalty);b.why.push('使い続けた油で風味が落ちた');}
  // 熱いままチョコをかけたり包装したりしない。夏は冷却時間が延びる。
  t=fry+fryMin;const cool=Math.ceil(p.cool*Math.max(B.coolMinFactor,1+(season.room-B.coolRef)*B.coolSeason));step('冷ます',t,t+cool);t+=cool;
  const finish=Math.max(t,finishFree);waits.仕上げ+=finish-t;step('仕上げを待つ',t,finish);finishFree=finish+Math.ceil(b.n/(p.finishRate*cfg.finishers));step(p.finish,finish,finishFree);
  t=finishFree;step('仕上げを落ち着かせる',t,t+p.set);t+=p.set;
  const pack=Math.max(t,packFree);waits.包装+=pack-t;step('包装を待つ',t,pack);packFree=pack+Math.ceil(b.n/B.packRate);step('包装',pack,packFree);
  b.done=packFree;b.score=Math.max(0,Math.round(b.score));b.good=b.score>=B.pass;b.expire=B.expiry;
  ev.push({t:b.mix,msg:`${p.name} ${b.n}個を仕込む${b.late?'（注文確定後）':'（見込み）'}`});
  ev.push({t:b.done,msg:`${p.name} ${b.n}個：${b.good?'包装完了':'品質不合格'}${b.done>D.deadline?'・締め切り後':''}`});
 }
 ev.push({t:D.orderConfirm,msg:`注文確定：${products.reduce((n,p)=>n+p.order,0)}個。こねる前の分を調整し、足りない分を追加`});ev.sort((a,b)=>a.t-b.t);
 const prods=products.map(p=>{const bs=batches.filter(b=>b.prod===p.id),available=bs.filter(b=>b.good&&b.done<=D.deadline).reduce((n,b)=>n+b.n,0),shipped=Math.min(p.order,available);return {id:p.id,kiosk:p.kiosk,name:p.name,order:p.order,shipped,short:p.order-shipped,bad:bs.filter(b=>!b.good).reduce((n,b)=>n+b.n,0),late:bs.filter(b=>b.good&&b.done>D.deadline).reduce((n,b)=>n+b.n,0),surplus:Math.max(0,available-p.order)};});
 const total=k=>prods.reduce((n,p)=>n+p[k],0),end=Math.max(D.deadline,...batches.map(b=>b.done));
 const labor=Math.round((end-cfg.start)/60*(B.staff+cfg.finishers)*B.wage*B.nightFactor);
 const material=batches.reduce((n,b)=>n+b.n*products.find(p=>p.id===b.prod).cost,0),changes=batches.reduce((n,b)=>n+b.oilChanges,0);
 const oilCost=(cfg.fryers+changes)*B.oilCost,machine=cfg.fryers*B.fryerCost;
 const yen={labor,material,oil:oilCost,machine,total:labor+material+oilCost+machine};yen.perUnit=total('shipped')?Math.round(yen.total/total('shipped')):0;
 return {cfg,season,products,batches,ev,T0:cfg.start,T1:Math.max(B.end,end),summary:{prods,order:total('order'),shipped:total('shipped'),short:total('short'),bad:total('bad'),late:total('late'),surplus:total('surplus'),yen,changes,waits,neck:Object.entries(waits).sort((a,b)=>b[1]-a[1])[0],lastDone:Math.max(...batches.map(b=>b.done))}};
}
function stage(b,t){if(t<b.mix)return 'まだ';for(const s of b.steps)if(t>=s.start&&t<s.end)return s.label;return b.good?'包装ずみ':'不合格';}
root.DonutCore={simulate,normalize,hm,stage};
})(typeof window!=='undefined'?window:globalThis);
