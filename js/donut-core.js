/* =====================================================================
   ケーキドーナツ（個包装）のラインの一晩。DOM に依存しない計算。数字・品質の線はゲームの仮定。
   2026-11-11：イースト生地のライン（型抜き・発酵・手の仕上げ）から置きかえた（前の計算は git の履歴にある）。
   ・仕込みは1回 batch 個ぶん：① 計量 → ② ミキサー → ③ ボウルを傾けてホッパーへ（ホッパーに入りきらないときは待つ）。
     計量の係は、量った分がミキサーに入るまで次を量らない。ミキサーは、前の生地をホッパーへ入れ終わるまで次を混ぜない。
   ・④ 押し出しは1分に speed 個。ホッパーに生地があるあいだだけ、1個ずつ油へ落とす。
   ・そこから先は1個ずつ、決まった時間で ⑤ フライ・油切り → ⑥ 蜜 → ⑦ スパイラルクーラー → ＋チョコ → ⑧ 検査 → ⑨ 包装 を通る。
     コンベアなので全部の品が同じ道を通り、追い越さない（蜜やチョコのない品はカーテンを止めて通る）。
   ・⑩ 箱詰め：包装を出た順に1個ずつ置く（1人1個 place 分）。12個か、品が変わるときに箱を閉じる。⑪ 閉じた箱を順にトラックへ。
   ・出荷数：締め切り（D.deadline）までに包装を出た良い品。品ごとに 作った数＝出荷＋だめ＋遅れ＋余り。
   ・画面のために、1個ずつの時刻（押し出し・包装・箱に置いた時刻）と、回・箱・積んだ箱の時刻も返す（保存はしない）。
   ===================================================================== */
(function(root){
'use strict';
const hm=t=>{t=Math.floor(t);return `${Math.floor(t/60)%24}:${String(((t%60)+60)%60).padStart(2,'0')}`;};
function rng(seed){let x=seed>>>0;return ()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};}
function normalize(D,input){const B=D.donut,c={};for(const k of Object.keys(B.defaults))c[k]=(input&&input[k]!=null)?input[k]:B.defaults[k];
  for(const k of Object.keys(B.ranges)){const [lo,hi]=B.ranges[k];const v=Number(c[k]);c[k]=Math.floor(Math.min(hi,Math.max(lo,Number.isFinite(v)?v:B.defaults[k])));}
  if(!D.seasons[c.season])c.season=B.defaults.season;
  if(input&&input.center)c.center=input.center;if(input&&input.centerNo)c.centerNo=input.centerNo;return c;}
/* 押し出してからの区切り（分）：[名前, 始め, 終わり]。冷却は季節で変わる */
function offsets(B,season){const F=B.flow,cool=(B.cool||{})[season]||20;let t=0;const out=[];
  for(const [k,d] of [['oil',F.oil],['fry',F.fry],['glaze',F.glaze],['cool',cool],['choco',F.choco],['insp',F.insp],['pack',F.pack]]){out.push([k,t,t+d]);t+=d;}
  return out;}
const offOf=(O,k)=>O.find(x=>x[0]===k);
function simulate(D,input){
 const B=D.donut,cfg=normalize(D,input),season=D.seasons[cfg.season],random=rng(cfg.seed),O=offsets(B,cfg.season),total=O.at(-1)[2];
 const products=B.products.map(p=>Object.assign({},p,{order:Math.round(B.forecast*p.share*(B.orderMin+random()*B.orderSpread))}));
 // センターの発注（cfg.center：売店の商品IDごと。js/factory-night.js が dia-orders から渡す）を、ほかの店・取引先の分に足す
 const cen={};if(cfg.center)for(const p of products)if(cfg.center[p.kiosk]>0){cen[p.id]=Math.round(cfg.center[p.kiosk]);p.order+=cen[p.id];}
 const cTot=Object.values(cen).reduce((a,b)=>a+b,0);
 const rate=cfg.speed,gap=1/rate,ev=[];
 // ---- ①〜④：仕込みの回と、1個ずつの押し出しの時刻 ----
 const batches=[],dep=[],pi=[],P=products.map(p=>p.id);
 let lastDep=-Infinity,poured=0,depCount=0;
 const addBatch=(p,n,late)=>{const prev=batches.at(-1);
   const w0=Math.max(late?D.orderConfirm:cfg.start,prev?prev.m0:cfg.start),w1=w0+B.weigh;
   const m0=Math.max(w1,prev?prev.p1:cfg.start),m1=m0+B.mix;
   // ホッパーに n 個ぶんの空き：押し出した数 ≧ これまでに入れた数 + n − 容量 になる時刻
   const need=poured+n-B.hopper;const free=need>0?dep[need-1]:-Infinity;
   const p0=Math.max(m1,free),p1=p0+B.pour;const b={id:batches.length,prod:p.id,n,late,w0,w1,m0,m1,p0,p1,wait:Math.max(0,p0-m1)};
   for(let j=0;j<n;j++){const t=Math.max(p1,lastDep+gap);dep.push(t);pi.push(P.indexOf(p.id));lastDep=t;}
   b.d0=dep[poured];b.d1=dep[poured+n-1];poured+=n;batches.push(b);return b;};
 // 注文前は見込みで仕込む（計量を始める時刻が20時より前の回だけ）。まだ量っていない分は、20時に注文へ合わせる
 for(const p of products){let made=0;const fc=Math.round(B.forecast*p.share);
   while(made<fc){const prev=batches.at(-1),w0=Math.max(cfg.start,prev?prev.m0:cfg.start);if(w0>=D.orderConfirm)break;const n=Math.min(B.batch,fc-made);addBatch(p,n,false);made+=n;}}
 for(const p of products){let made=batches.filter(b=>b.prod===p.id).reduce((n,b)=>n+b.n,0);
   while(made<p.order){const n=Math.min(B.batch,p.order-made);addBatch(p,n,true);made+=n;}}
 // ---- ⑤〜⑨：1個ずつ。検査で、油の温度のずれと金属検出ではじく ----
 const N=dep.length,pk=new Float64Array(N),bad=new Uint8Array(N),insp=offOf(O,'insp');
 const badP=products.map(p=>{const d=Math.abs(cfg.oilT-p.oilT)-B.tempGrace;return Math.min(B.badMax,Math.max(0,d)*B.tempBad)+B.metal;});
 for(let i=0;i<N;i++){pk[i]=dep[i]+total;bad[i]=random()<badP[pi[i]]?1:0;}
 // ---- ⑩ 箱詰め・⑪ 出荷 ----
 const pl=new Float64Array(N),bx=new Int32Array(N).fill(-1),boxes=[],loads=[];const per=B.place/cfg.boxers;let free=-Infinity,cur=null;
 const closeBox=t=>{cur.c0=t;cur.c1=t+B.close;free=cur.c1;cur=null;};
 for(let i=0;i<N;i++){if(bad[i])continue;
   if(cur&&cur.prod!==pi[i])closeBox(Math.max(free,cur.last));   // 品が変わるときは端数でも閉じる
   const s=Math.max(pk[i],free);if(!cur){cur={b0:s,n:0,prod:pi[i]};boxes.push(cur);}
   pl[i]=s+per;free=pl[i];bx[i]=boxes.length-1;cur.n++;cur.last=pl[i];if(cur.n>=B.box)closeBox(pl[i]);}
 if(cur)closeBox(Math.max(free,cur.last));
 let lf=-Infinity;for(const b of boxes){const l0=Math.max(b.c1,lf),l1=l0+B.load;loads.push({l0,l1});lf=l1;}
 // ---- 品ごとのまとめ ----
 const prods=products.map((p,k)=>{let made=0,badN=0,good=0,lateN=0;for(let i=0;i<N;i++){if(pi[i]!==k)continue;made++;if(bad[i])badN++;else if(pk[i]<=D.deadline)good++;else lateN++;}
   const shipped=Math.min(p.order,good);return {id:p.id,kiosk:p.kiosk,name:p.name,order:p.order,shipped,short:p.order-shipped,bad:badN,late:lateN,surplus:good-shipped,made};});
 const tot=k=>prods.reduce((n,p)=>n+p[k],0);
 const lastDone=N?Math.max(...pk):cfg.start,lastBox=boxes.length?boxes.at(-1).c1:lastDone,go=loads.length?loads.at(-1).l1:lastBox;
 const waits={'ホッパーの空き':Math.round(batches.reduce((a,b)=>a+b.wait,0)),'箱詰め':0};for(let i=0;i<N;i++)if(!bad[i])waits['箱詰め']+=pl[i]-per-pk[i];waits['箱詰め']=Math.round(waits['箱詰め']);
 // ---- 記録 ----
 for(const b of batches){const p=products.find(x=>x.id===b.prod);ev.push({t:b.w0,msg:`${p.name} ${b.n}個ぶんを計量${b.late?'（注文確定後）':'（見込み）'}`});
   if(b.wait>=1)ev.push({t:b.m1,msg:`${p.name}の生地：ホッパーに空きができるまで ${Math.round(b.wait)}分待つ`});
   ev.push({t:b.d0,msg:`${p.name}：押し出し始め（1分に${rate}個）`});}
 const rejN=tot('bad');if(rejN)ev.push({t:Math.min(...Array.from(dep).filter((_,i)=>bad[i]).map(t=>t+insp[2])),msg:`検査で最初にはじいた品（今夜は合わせて${rejN}個）`});
 ev.push({t:D.orderConfirm,msg:`注文確定：${tot('order')}個。まだ量っていない分を注文に合わせる`});
 if(cTot)ev.push({t:D.orderConfirm,msg:`注文確定：センターから${cTot}個（${cfg.centerNo||'発注'}・${products.filter(p=>cen[p.id]).map(p=>p.name+cen[p.id]).join('・')}）。ほかの店・取引先の分に足して作ります`});
 ev.push({t:lastDone,msg:`最後の1個を包み終わる（${tot('made')}個）`});ev.push({t:go,msg:`${boxes.length}箱を積み終わり、トラックが出る`});ev.sort((a,b)=>a.t-b.t);
 // ---- 費用 ----
 const end=Math.max(D.deadline,go),labor=Math.round((end-cfg.start)/60*(B.staff+cfg.boxers)*B.wage*B.nightFactor);
 const material=prods.reduce((n,p,k)=>n+p.made*products[k].cost,0),oil=B.oilCost,machine=B.fryerCost+B.machineCost;
 const yen={labor,material,oil,machine,total:labor+material+oil+machine};yen.perUnit=tot('shipped')?Math.round(yen.total/tot('shipped')):0;
 const neck=Object.entries(waits).sort((a,b)=>b[1]-a[1])[0];
 return {cfg,season,products,batches,ev,O,dep,pi,pk,bad,pl,bx,boxes,loads,go,per,T0:cfg.start,T1:Math.max(B.end,Math.ceil(go)+5),
   summary:{prods,order:tot('order'),shipped:tot('shipped'),short:tot('short'),bad:tot('bad'),late:tot('late'),surplus:tot('surplus'),made:tot('made'),boxes:boxes.length,yen,changes:0,waits,neck,lastDone,go}};
}
/* 時刻 t までに何個（押し出し・はじいた・包み終わった・箱に置いた）。dep・pk・pl は時刻の順 */
function upTo(a,t){let lo=0,hi=a.length;while(lo<hi){const m=(lo+hi)>>1;if(a[m]<=t)lo=m+1;else hi=m;}return lo;}
function countsAt(R,t){const insp=offOf(R.O,'insp');let rej=0,pack=0,placed=0;const nd=upTo(R.dep,t);
  for(let i=0;i<nd;i++){if(R.bad[i]){if(R.dep[i]+insp[1]+(insp[2]-insp[1])/2<=t)rej++;}else{if(R.pk[i]<=t)pack++;if(R.pl[i]<=t)placed++;}}
  let closed=0,loaded=0;for(const b of R.boxes)if(b.c1<=t)closed++;for(const l of R.loads)if(l.l1<=t)loaded++;
  return {dep:nd,rej,pack,placed,closed,loaded,line:nd-rej-pack};}
root.DonutCore={simulate,normalize,hm,offsets,countsAt,upTo};
if(typeof module!=='undefined')module.exports=root.DonutCore;
})(typeof window!=='undefined'?window:globalThis);
