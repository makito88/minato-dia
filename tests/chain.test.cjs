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
const cond={day:'wd',wx:'sun',season:'aut'},gen=pid=>K.products.find(p=>p.id===pid).genre;
const ctxOf=(st,day,order,extra)=>Object.assign({day,dow:day%7,cond,flows:{hb:fl,ha:fl},stops:new Array(H).fill(4),plats:2,rcfg:R,order,express:[],addOn:[],edits:[],startT:0},extra||{});

function run(days,opts){opts=opts||{};let st=KC.create(K,{st:'M',place:'home',seed:3,day:1});const key=CC.storeKey(st);let log=CC.emptyLog();const out=[];
  for(let day=1;day<=days;day++){
    const shelf=KC.shelfInfo(K,st.layout),recs=CC.recsOf(log,key);
    const p=CC.plan(K,C,st,recs,cond,{forDay:day,aim:'mid',shelf,cur:st.order});
    // 注文の時刻：前の日の 19:00 より後の売れ行き（1日まるごとの記録）を変えても、注文は同じ
    if(day>2){const r2=JSON.parse(JSON.stringify(recs)),pv=r2.find(r=>r.day===day-1);for(const pid in pv.items)pv.items[pid]=[999,999,0,0];
      assert.deepEqual(CC.plan(K,C,st,r2,cond,{forDay:day,aim:'mid',shelf,cur:st.order}).items,p.items,'19:00 より後の数は注文に使わない day '+day);}
    const order={...st.order,...p.items};st.order=order;
    CC.putOrder(K,C,log,day,key,{mode:'auto',items:order},30);const d=log.days.find(x=>x.day===day);d.cond=cond;
    const night=FN.runNight(D,{rice:{},bread:{},sand:{},donut:{}},{day,no:d.factory.no,items:d.factory.items,season:'aut'});
    d.slip=FN.slip(D,C,d,night);const m=d.slip.stores[key];
    for(const pid in d.factory.items)assert.equal(m.items[pid][0],d.orders[key].factory[pid],'店の注文＝工場への注文 '+pid);
    const res=KC.simulate(K,st,ctxOf(st,day,order,{supply:CC.supplyFor(d.slip,key)}));
    const arr=CC.arrival(K,C,st,res,d.slip);CC.putArrival(log,arr,30);
    const byG={};for(const pid in m.items){const g=gen(pid),o=byG[g]||(byG[g]={ord:0,ship:0,got:0,left:0});o.ord+=m.items[pid][0];o.ship+=m.items[pid][1];o.left+=arr.left[pid]||0;}
    for(const r of arr.runs)for(const pid in r.f)byG[gen(pid)].got+=r.f[pid];
    for(const g in byG){const o=byG[g];assert.ok(o.ship<=o.ord);assert.equal(o.got+o.left,o.ship,'届いた＋残った＝出荷 '+g);}
    const rec=CC.salesRecord(K,st,res);assert.ok(rec.pre&&rec.pre.at===CC.cutOf(K),'19:00 の記録');CC.putRecord(log,rec,30);
    st=KC.closeDay(K,st,res,{}).state;out.push({day,byG});}
  return out;}

const R14=run(14);
for(const x of R14)console.log('  第'+x.day+'運行日',Object.entries(x.byG).map(([g,o])=>`${g} 注文${o.ord}・出荷${o.ship}・届いた${o.got}・残り${o.left}`).join('／'));
module.exports={run};
console.log('chain.test ok');
