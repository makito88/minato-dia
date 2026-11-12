// 売店 → センター → 工場 → センター → 売店 の流れを、おまかせで14運行日つなげて確かめる（2026-11-09）
//  ・注文の時刻：運行日 N の注文は、N-1 の 19:00 までに確定した数と、N-2 までの記録だけで決まる（19:00 より後の売れ行きを変えても同じ）
//  ・数のつじつま：店の注文＝工場への注文、出荷≦作った数、届いた数＋センターに残った数＝出荷数
//  ・パン：工場が作った数が、センターに残らずに店へ届く（step 2 から）
//  ・かご車：便ごとの数の合計＝出荷数（step 3 から）／トラック：店に着く時刻＝センターを出た時刻＋道の分（step 4 から）
const assert=require('node:assert/strict');
for(const f of ['research-core','kiosk-staff','kiosk-core','factory-core','bread-core','sand-loaf','sand-core','donut-core','center-core','factory-night'])require('../js/'+f+'.js');
const K=require('../data/kiosk.json'),R=require('../data/research.json'),D=require('../data/factory.json'),C=require('../data/center.json');
const {KioskCore:KC,CenterCore:CC,FactoryNight:FN}=globalThis;
const H=KC.H,a=new Array(H).fill(0).map((_,h)=>h>=5&&h<24?150:0),fl=[a,a,a,a];
const cond0={day:'wd',wx:'sun',season:'aut'},gen=pid=>K.products.find(p=>p.id===pid).genre;
const ctxOf=(st,day,order,extra,cond)=>Object.assign({day,dow:day%7,cond:cond||cond0,flows:{hb:fl,ha:fl},stops:new Array(H).fill(4),plats:2,rcfg:R,order,express:[],addOn:[],edits:[],startT:0},extra||{});

function run(days,opts){opts=opts||{};const cond=opts.wx?{day:'wd',wx:opts.wx,season:'aut'}:cond0;let st=KC.create(K,{st:opts.st||'M',place:'home',seed:3,day:1});const key=CC.storeKey(st);let log=CC.emptyLog();const out=[];const CF=opts.ccfg||C,cs=CC.csNew();
  for(let day=1;day<=days;day++){
    const shelf=KC.shelfInfo(K,st.layout),recs=CC.recsOf(log,key);
    const p=CC.plan(K,C,st,recs,cond,{forDay:day,aim:'mid',shelf,cur:st.order});
    // 注文の時刻：前の日の 19:00 より後の売れ行き（1日まるごとの記録）を変えても、注文は同じ
    if(day>2){const r2=JSON.parse(JSON.stringify(recs)),pv=r2.find(r=>r.day===day-1);for(const pid in pv.items)pv.items[pid]=[999,999,0,0];
      assert.deepEqual(CC.plan(K,C,st,r2,cond,{forDay:day,aim:'mid',shelf,cur:st.order}).items,p.items,'19:00 より後の数は注文に使わない day '+day);}
    const order={...st.order,...p.items};st.order=order;
    const fq=CC.factoryQty(K,C,st,recs,day,order);CC.putOrder(K,C,log,day,key,{mode:'auto',items:order,fq},30);const d=log.days.find(x=>x.day===day);d.cond=cond;
    const crun=opts.oldCenter?null:CC.runOrder(K,C,st,recs,day,cond,order,p.why);   // 店の便ごとの注文（センターの品）。前の夜に確定した数だけで決める
    const night=FN.runNight(D,{rice:opts.shortFrom&&day>=opts.shortFrom?(opts.rice||{batches:20,start:1140}):{},bread:{},sand:{},donut:{}},{day,no:d.factory.no,items:d.factory.items,season:'aut'});
    d.slip=FN.slip(D,C,d,night);const m=d.slip.stores[key];
    for(const pid in d.factory.items)assert.equal(m.items[pid][0],d.orders[key].factory[pid],'店の注文＝工場への注文 '+pid);
    const sh2=KC.shelfInfo(K,st.layout);
    CC.csOpen(K,CF,cs,day,{stores:[{key,order,shelf:sh2}],recs:CC.recsOf(log,key)});const open={...cs.stock},cst={};for(const pid of CC.centerPids(K,CF,sh2))cst[pid]=cs.stock[pid]||0;
    const tp=CC.truckRuns(C,key,day,cond,d.slip.late&&d.slip.late.mode==='wait'?d.slip.late.wait:0),co=crun?CC.allocate(K,[{key,runs:crun}],cs.stock)[key]:null,ct=opts.noCart?null:CC.cart(K,C,d.slip,key,sh2,co);
    if(co)for(const e0 of [0])for(const b in co.runs)for(const pid in co.runs[b])assert.ok(co.runs[b][pid]<=(crun[b][pid]||0),'割り振り ≦ 注文');
    if(ct)for(const pid in m.items){const t=Object.values(ct.runs).reduce((x,r)=>x+(r[pid]||0),0);assert.equal(t,m.items[pid][1]+(m.items[pid][2]||0),'かご車の合計＝出荷数（追いかけ便を含む） '+pid);}
    const res=KC.simulate(K,st,ctxOf(st,day,order,{cstock:cst,supply:CC.supplyFor(d.slip,key,K,C,sh2),supplyOrd:CC.supplyOrdFor(d.slip,key,K,C,sh2),cart:ct,truck:Object.fromEntries(tp.map(r=>[r.bin,r.arrive]))},cond));
    for(const e of res.ev)if(e.k==='delivery'&&!e.express&&!e.addOn){const r=tp.find(x=>x.bin===e.name);assert.equal(e.t,Math.max(K.open[0]*60-1,r.shelf),'棚に並ぶ時刻＝便の時刻と着いた時刻の遅いほう '+e.name);if(r.arrive>r.t)assert.equal(e.late,Math.round(r.arrive-r.t));}
    if(ct)for(const e of res.ev)if(e.k==='delivery'&&!e.express&&!e.addOn)for(const pid in ct.pids)assert.equal(e.items[pid]||0,(ct.runs[e.name]||{})[pid]||0,'便ごとに、かご車のとおり届く '+e.name+' '+pid);
    if(m.short.q===0)assert.ok(!res.cut||!Object.keys(res.cut).length,'工場が足りた日は「届かなかった」がない day '+day);
    const arr=CC.arrival(K,C,st,res,d.slip);CC.putArrival(log,arr,30);
    const byG={};for(const pid in m.items){const g=gen(pid),o=byG[g]||(byG[g]={ord:0,ship:0,got:0,left:0});o.ord+=m.items[pid][0];o.ship+=m.items[pid][1]+(m.items[pid][2]||0);o.left+=arr.left[pid]||0;}
    for(const r of arr.runs)for(const pid in r.f)byG[gen(pid)].got+=r.f[pid];
    for(const g in byG){const o=byG[g];assert.ok(o.ship<=o.ord);assert.equal(o.got+o.left,o.ship,'届いた＋残った＝出荷 '+g+' day '+day+' '+JSON.stringify(o)+JSON.stringify(m.items));}
    const rec=CC.salesRecord(K,st,res);assert.ok(rec.pre&&rec.pre.at===CC.cutOf(K),'19:00 の記録');CC.putRecord(log,rec,30);
    {const o2=CC.centerOut(K,CF,res);for(const pid in o2)assert.ok(o2[pid]<=open[pid],'センターから出した数 ≦ 朝の在庫 '+pid);CC.csClose(K,CF,cs,res);
      for(const pid in open)assert.equal(cs.stock[pid],Math.max(0,open[pid]-(o2[pid]||0)),'在庫＝朝の在庫−出した数 '+pid);}
    out.push({day,sales:res.pl.sales,profit:res.pl.profit,lostC:Object.entries(res.lostSO||{}).filter(([pid])=>CC.routeOf(C,gen(pid))==='center').reduce((t,[,v])=>t+v,0),ccut:Object.values(res.ccut||{}).reduce((x,y)=>x+y,0),cs:JSON.parse(JSON.stringify(cs)),byG,late:d.slip.late,chase:Object.values(m.items).reduce((t,x)=>t+(x[2]||0),0),short:m.short.q,cut:Object.values(res.cut||{}).reduce((x,y)=>x+y,0)});st=KC.closeDay(K,st,res,{}).state;}
  return out;}

const R14=run(14);
// パン：作ったのにセンターに残る数（前は14日で30個前後）
const breadLeft=R14.reduce((t,x)=>t+((x.byG.bread||{}).left||0),0);console.log('  パンがセンターに残った数（14日）',breadLeft);assert.ok(breadLeft<=8,'パンの作りすぎ '+breadLeft);
for(const x of R14)console.log('  第'+x.day+'運行日',Object.entries(x.byG).map(([g,o])=>`${g} 注文${o.ord}・出荷${o.ship}・届いた${o.got}・残り${o.left}`).join('／'));
// 工場が足りない夜（釜が少なく遅い）：足りない数だけ「届かなかった」になり、届いた数＋残り＝出荷数のまま
{const S=run(6,{shortFrom:4});const sd=S.filter(x=>x.short>0);console.log('  釜が少なく遅い夜：',S.filter(x=>x.day>=4).map(x=>'第'+x.day+'運行日 '+(x.late?x.late.mode+(x.late.mode==='wait'?x.late.wait+'分':' '+x.chase+'個→'+x.late.bin):'遅れなし')+'・足りない'+x.short).join('／'));assert.ok(S.some(x=>x.day>=4&&(x.short>0||x.late)),'遅れか足りない夜がある');for(const x of sd)assert.equal(x.cut,x.short,'届かなかった数＝足りなかった数 day '+x.day);
  console.log('  工場が足りない夜：',sd.map(x=>'第'+x.day+'運行日 '+x.short+'個').join('・'));}
// 工場が遅れた夜（決め方 D）：遅れが短ければ待つ（全部届き、朝の便が遅れる）、長ければ追いかけ便（あとからできた分を次の便で）
{const seen={};for(const [sf,b] of [[1140,32],[1160,32],[1140,24],[1200,32]]){const S=run(3,{shortFrom:2,rice:{batches:b,start:sf}});for(const x of S)if(x.late)seen[x.late.mode]=(seen[x.late.mode]||0)+1;}
  console.log('  工場が遅れた夜の決め方',seen);assert.ok(seen.chase,'追いかけ便が起きる');}
// 決め方 D の境目（作った夜で確かめる）：締め切り 2:30 から10分なら待つ、30分なら追いかけ便で朝の便、80分なら昼前の便
{const night=ld=>({rows:{oni_sake:{line:'rice',order:100,shipped:70,late:30,c:90}},lines:{rice:{lastDone:ld}},stock:{}});
  const w=FN.lateRule(D,C,night(D.deadline+10));assert.equal(w.mode,'wait');assert.equal(w.wait,10);
  const c1=FN.lateRule(D,C,night(D.deadline+30)),c2=FN.lateRule(D,C,night(D.deadline+80));assert.equal(c1.mode,'chase');assert.equal(c1.bin,'朝の便');assert.equal(c2.bin,'昼前の便');
  const t0=CC.truckRuns(C,'M-home',3,cond0,0)[0],t1=CC.truckRuns(C,'M-home',3,cond0,10)[0];assert.equal(t1.arrive-t0.arrive,10,'待った分だけ朝の便が遅れる');
  console.log('  決め方 D：10分→待つ（朝の便が10分遅れる）・30分→追いかけ便で朝の便・80分→昼前の便');}
// センターの倉庫：おまかせで問屋に頼めば、14日でセンターの品はほとんど切れない。頼まないと切れて、店に届く数が減る
{const ok=R14.reduce((t,x)=>t+x.ccut,0),pos=R14.at(-1).cs.po;
  const C0=JSON.parse(JSON.stringify(C));C0.ws.orderDays=[];const NG=run(14,{ccfg:C0}),ng=NG.reduce((t,x)=>t+x.ccut,0);
  console.log('  センターの倉庫（14日）：おまかせで問屋へ',R14.at(-1).cs.po.length,'回発注・届かなかった数',ok,'／問屋に頼まないと',ng);
  assert.ok(pos.length>=3,'週2回の発注');assert.ok(ok<=ng/5,'おまかせで切れにくい');assert.ok(ng>0,'頼まないと切れる');
  for(const p of pos)assert.equal(p.arr,p.day+1,'次の運行日に着く');}
// 店の便ごとの注文（センターの品を前の夜に決める）と、前のやり方（便が着いた時刻の店の在庫を見て足す）をくらべる
{const A=R14.slice(7),B=run(14,{oldCenter:true}).slice(7),av=(X,f)=>Math.round(X.reduce((t,x)=>t+f(x),0)/X.length);
  console.log(`  センターの品（8〜14日目の平均）：前の夜に決める 売上${av(A,x=>x.sales)}・売り切れで逃した${av(A,x=>x.lostC)}／前のやり方 売上${av(B,x=>x.sales)}・売り切れで逃した${av(B,x=>x.lostC)}`);
  assert.ok(av(A,x=>x.sales)>av(B,x=>x.sales)*0.95,'前の夜に決めても、売上が大きく落ちない');}
// 大雪の森下：トラックが遅れて、昼前の便が便の時刻より遅く並ぶ
{const S=run(3,{st:'F',wx:'snow'});console.log('  大雪の森下：昼前の便',CC.truckRuns(C,'F-home',2,{wx:'snow'})[1]);}
module.exports={run};
console.log('chain.test ok');
