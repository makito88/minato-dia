/* =====================================================================
   配送会社（みなと川運輸）の1日の計算（2026-11-09）
   ・工場→センター（定温トラック）、センター→店（2トントラック A・B）は自社便。
   ・追いかけ便（工場が遅れた夜）と、トラックに積みきれない便の応援は、他社（港浜急送）に頼む。
   ・便の時刻・店までの分・遅れは配送センターの決まり（CenterCore.truckRuns・納品書の slip.late）をそのまま使う。
     ここでは、それぞれの便が「どの会社の・どのトラックで・何台分（かご車）・何km・何時間・いくら」かを出すだけ（品物の数は変えない）。
   ・保存はしない。その日の便は、納品書・売店の便（または到着の記録）から毎回作り直す（同じ日なら同じ結果）。
   ・DOM も localStorage も使わない。設定は data/haiso.json（すべて仮）。
   ===================================================================== */
(function(root){
'use strict';
const sumV=o=>Object.values(o||{}).reduce((a,b)=>a+(b||0),0);
/* o＝{day, cond, slip, stores:[{key, runs:[{bin, f:工場の品の個数, c:センターの品の個数}]}]}
   返すもの：{day, runs:[便], sum:{own, other, carts, km, hours, cost, fare, fee, profit, late}} */
function dayPlan(H,C,CC,o){const runs=[],F=C.flow||{},LT=o.slip&&o.slip.late,wait=LT&&LT.mode==='wait'?LT.wait:0,T=H.trucks||{},cost=H.cost||{},fare=H.fare||{},of=H.otherFee||{};
  const per=H.perCart||{factory:300,center:150},cartsOf=(f,c)=>f/per.factory+c/per.center;
  const ownCost=(km,min)=>Math.round(km*(cost.fuelPerKm||0)+min/60*(cost.wageH||0));
  // 1) 工場→センター（定温トラック・自社）
  if(F.factory&&F.center){const fc=T.fc||{},n=fc.n||1,fTot=o.stores.reduce((t,s)=>t+s.runs.reduce((u,r)=>u+(r.f||0),0),0),carts=fTot/per.factory;
    const dep=F.factory.depart-1440+wait,min=(fc.min||15)*2+(H.handleMin||15);
    for(let i=0;i<n;i++)runs.push({leg:'fc',id:'F'+(i+1),company:H.own,label:`${fc.label||'定温トラック'} ${i+1}号`,depart:dep,arrive:dep+(fc.min||15),stops:[{key:'center',name:'川辺の配送センター',arrive:dep+(fc.min||15)}],
      carts:+(carts/n).toFixed(1),cap:fc.cap||16,km:(fc.km||10)*2,min,cost:ownCost((fc.km||10)*2,min),fare:fare.fc||0,payer:'factory',late:wait});}
  // 2) 追いかけ便（他社）
  if(LT&&LT.mode==='chase'){const dep=LT.end+20-1440,arr=LT.at-1440;runs.push({leg:'chase',id:'X1',company:H.other,label:'追いかけ便（工場→センター）',depart:dep,arrive:arr,stops:[{key:'center',name:'川辺の配送センター',arrive:arr}],carts:null,km:0,min:0,cost:0,fee:LT.fee||of.chase||0,payer:'factory',note:`${LT.bin}にのせる`});}
  // 3) センター→店（2トントラック・自社。積みきれない分は他社の応援便）
  const byTruck={};for(const s of o.stores){const tr=CC.truckFor(C,s.key);if(!tr)continue;(byTruck[tr.id]||(byTruck[tr.id]={tr,stores:[]})).stores.push(s);}
  const cs=T.cs||{},cap=cs.cap||10;
  for(const id in byTruck){const {tr,stores}=byTruck[id];
    (F.runs||[]).forEach((r,ri)=>{const legs=stores.map(s=>{const tp=CC.truckRuns(C,s.key,o.day,o.cond,wait)[ri],x=s.runs.find(v=>v.bin===r.bin)||{};return {key:s.key,arrive:tp.arrive,depart:tp.depart,late:tp.late,base:(CC.truckFor(C,s.key)||{}).min||0,carts:cartsOf(x.f||0,x.c||0),pcs:(x.f||0)+(x.c||0)};});
      const far=Math.max(0,...legs.map(l=>l.arrive-l.depart)),base=Math.max(0,...legs.map(l=>l.base)),carts=legs.reduce((t,l)=>t+l.carts,0),km=+(base*(cs.kmPerMin||0.6)*2).toFixed(1),min=far+base+(H.handleMin||15)*legs.length;   // 距離は道の分（遅れは距離に入れない）。運転の時間は行き（遅れを含む）＋帰り＋積みおろし
      const own=Math.min(carts,cap),over=Math.max(0,carts-cap),dep=legs.length?legs[0].depart:r.depart;
      runs.push({leg:'cs',id:id+(ri+1),truck:id,bin:r.bin,company:H.own,label:`${tr.name}・${r.bin}`,depart:dep,arrive:Math.max(...legs.map(l=>l.arrive)),stops:legs.map(l=>({key:l.key,arrive:l.arrive,late:l.late,pcs:l.pcs})),
        carts:+own.toFixed(1),cap,km,min,cost:ownCost(km,min),fare:Math.round((fare.perStop||0)*legs.length+(fare.perCart||0)*own),payer:'center',late:Math.max(0,...legs.map(l=>l.late||0))});
      if(over>0)runs.push({leg:'cs-extra',id:id+(ri+1)+'+',truck:id,bin:r.bin,company:H.other,label:`応援便（${tr.name}・${r.bin}）`,depart:dep,arrive:Math.max(...legs.map(l=>l.arrive)),stops:legs.map(l=>({key:l.key,arrive:l.arrive})),carts:+over.toFixed(1),cap,km:0,min:0,cost:0,fee:of.extra||0,payer:'center',note:'積みきれない分'});});}
  // 自社のトラックの1日の持ち費（その日に走ったトラックの台数ぶん）
  const ownTrucks=new Set(runs.filter(r=>r.company===H.own).map(r=>r.leg==='fc'?r.id:r.truck)),truckDay=ownTrucks.size*(cost.truckDay||0);
  const own=runs.filter(r=>r.company===H.own),oth=runs.filter(r=>r.company!==H.own);
  const sum={own:own.length,other:oth.length,trucks:ownTrucks.size,carts:+own.reduce((t,r)=>t+(r.carts||0),0).toFixed(1),km:+own.reduce((t,r)=>t+r.km,0).toFixed(1),hours:+(own.reduce((t,r)=>t+r.min,0)/60).toFixed(1),
    cost:own.reduce((t,r)=>t+r.cost,0)+truckDay,truckDay,fare:own.reduce((t,r)=>t+(r.fare||0),0),fee:oth.reduce((t,r)=>t+(r.fee||0),0),late:Math.max(0,...own.map(r=>r.late||0))};
  sum.profit=sum.fare-sum.cost;
  return {day:o.day,runs:runs.sort((a,b)=>a.depart-b.depart),sum};}
const api={dayPlan};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
root.HaisoCore=api;
})(typeof globalThis!=='undefined'?globalThis:this);
