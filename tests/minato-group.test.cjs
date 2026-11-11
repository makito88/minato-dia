// 橋 minato-to-group（2026-11-12）：港駅の店の通常の注文を、緑ヶ丘の店と同じ流れ（dia-orders → 工場の夜 → 納品書 → センターのかご車 → トラック）にのせる
//  ・2店の注文がそろってから、工場の注文（全店の合計）と納品書を1回だけ作る
//  ・できたての便の分は夜の工場に頼まない（二重に作らない）。店の計算では昼前の便から引かない（noCut）
//  ・センターの品は、2店の便ごとの注文を倉庫の在庫で一度に割り振る（同じ在庫を二重に使わない）
//  ・強さ0なら on() が false（画面は前と同じ動き）
const assert=require('node:assert/strict');
for(const f of ['research-core','kiosk-staff','kiosk-walk','kiosk-core','factory-core','bread-core','sand-loaf','sand-core','donut-core','bento-core','center-core','factory-night','minato-store-core','links/factory-to-kiosk-sameday','links/minato-to-group'])require('../js/'+f+'.js');
const K=require('../data/kiosk.json'),R=require('../data/research.json'),D=require('../data/factory.json'),C=require('../data/center.json'),M=require('../data/minato-store.json'),L=require('../data/links.json'),HJ=require('../data/haiso.json');
const {KioskCore:KC,CenterCore:CC,FactoryNight:FN,MinatoStore:MS,FactoryToKioskSameday:SD,MinatoToGroup:G}=globalThis;
const PC=MS.cfg(K,M),H=KC.H,a=new Array(H).fill(0).map((_,h)=>h>=5&&h<24?150:0),fl=[a,a,a,a],cond={day:'wd',wx:'sun',season:'aut'};
const ctxOf=(day,order,extra)=>Object.assign({day,dow:day%7,cond,flows:{hb:fl,ha:fl},stops:new Array(H).fill(4),plats:2,rcfg:R,order,express:[],addOn:[],edits:[],startT:0},extra||{});
const GC={...K,products:[...K.products,...PC.products.filter(p=>!K.products.some(q=>q.id===p.id))],genres:[...K.genres,...PC.genres.filter(g=>!K.genres.some(x=>x.id===g.id))]};delete GC._cix;

// 1) 橋の形・強さ0
const lk=L.links.find(x=>x.id===G.ID);
assert.ok(lk&&lk.state==='temp'&&lk.strength>0&&lk.read&&lk.values.every(v=>v.src==='game'),'橋の形');
assert.ok(G.on(L));{const off=JSON.parse(JSON.stringify(L));off.links.find(x=>x.id===G.ID).strength=0;assert.ok(!G.on(off),'強さ0なら off');}

// 2) 10運行日：2店をそろえて流す
let sm=KC.create(K,{st:'M',place:'home',seed:3,day:1}),sp=MS.create(K,M,KC,{seed:5,day:1});MS.omInit(sp,C,'auto');
const km=CC.storeKey(sm),kp=CC.storeKey(sp),log=CC.emptyLog(),cs=CC.csNew();let sdDays=0;
assert.notEqual(km,kp);
for(let day=1;day<=10;day++){
  // 運行日の始め：両方の店の注文
  const recsM=CC.recsOf(log,km),pm=CC.plan(K,C,sm,recsM,cond,{forDay:day,aim:'mid',shelf:KC.shelfInfo(K,sm.layout),cur:sm.order});sm.order={...sm.order,...pm.items};
  CC.putOrder(K,C,log,day,km,{mode:'auto',items:sm.order,fq:CC.factoryQty(K,C,sm,recsM,day,sm.order)},30);
  const d=log.days.find(x=>x.day===day);d.cond=cond;d.orders[km].crun=CC.runOrder(K,C,sm,recsM,day,cond,sm.order,pm.why);
  const pp=MS.omOrder(PC,CC,KC,C,sp,day,cond),sd=SD.plan(L,{F:D,H:HJ,M},sp,{day,cond:{wx:cond.wx}});
  G.putOrder(CC,PC,C,log,day,sp,cond,pp&&pp.why,sd,30);
  const op=d.orders[kp];assert.ok(op&&op.crun,'港駅の店の注文と便ごとの注文がのった');
  // 工場の注文＝2店の合計
  for(const pid in d.factory.items)assert.equal(d.factory.items[pid],((d.orders[km].factory||{})[pid]||0)+((op.factory||{})[pid]||0),'工場の注文＝2店の合計 '+pid);
  // できたての便の分は、夜の工場に頼まない
  if(sd){sdDays++;assert.ok(op.sd&&op.sd.want,'できたての分を覚える');for(const pid in sd.want)assert.equal((op.factory[pid]||0),Math.max(0,(sp.order[pid]||0)-sd.want[pid]),'夜の工場は注文−できたての分 '+pid);}
  // 工場の夜と納品書（1回だけ）
  const night=FN.runNight(D,{rice:{},bread:{},sand:{},donut:{}},{day,no:d.factory.no,items:d.factory.items,season:'aut'});d.slip=FN.slip(D,C,d,night);
  for(const pid in d.slip.items){const [ord,ship,ch]=d.slip.items[pid];const got=[km,kp].reduce((t,k)=>t+((d.slip.stores[k]&&d.slip.stores[k].items[pid])?(d.slip.stores[k].items[pid][1]+(d.slip.stores[k].items[pid][2]||0)):0),0);
    assert.ok(got<=ship+(ch||0),'2店に分けた数 ≦ 出荷 '+pid);}
  // センターの倉庫：2店で開き、2店の便ごとの注文を一度に割り振る
  const shM=KC.shelfInfo(K,sm.layout),shP=KC.shelfInfo(PC,sp.layout);
  CC.csOpen(GC,C,cs,day,{stores:[{key:km,order:sm.order,shelf:shM},{key:kp,order:sp.order,shelf:shP}],recs:CC.recsOf(log,km).concat(CC.recsOf(log,kp))});
  const al=CC.allocate(K,[{key:km,runs:d.orders[km].crun},{key:kp,runs:op.crun}],cs.stock);
  for(const pid in cs.stock){const t=[km,kp].reduce((x,k)=>x+Object.values(al[k].runs).reduce((y,r)=>y+(r[pid]||0),0),0);assert.ok(t<=cs.stock[pid],'割り振りの合計 ≦ 倉庫の在庫 '+pid);}
  const ctM=CC.cart(K,C,d.slip,km,shM,al[km]),ctP=CC.cart(PC,C,d.slip,kp,shP,al[kp]);
  const tr=k=>Object.fromEntries(CC.truckRuns(C,k,day,cond,0).map(r=>[r.bin,r.arrive]));
  const rm=KC.simulate(K,sm,ctxOf(day,sm.order,{supply:CC.supplyFor(d.slip,km,K,C,shM),supplyOrd:CC.supplyOrdFor(d.slip,km,K,C,shM),cart:ctM,truck:tr(km)}));
  const sdx=sd?{...sd,noCut:true}:undefined;
  const rp=KC.simulate(PC,sp,ctxOf(day,sp.order,{supply:CC.supplyFor(d.slip,kp,PC,C,shP),supplyOrd:CC.supplyOrdFor(d.slip,kp,PC,C,shP),cart:ctP,truck:tr(kp),sameday:sdx}));
  // 港駅の店の工場の品：いつもの便で届いた数＝納品書の出荷のうち港駅の店の分（できたての分を二重に引かない）
  const mp=d.slip.stores[kp];if(mp)for(const pid in mp.items){const want=mp.items[pid][1]+(mp.items[pid][2]||0),got=rp.ev.filter(e=>e.k==='delivery'&&!e.express&&!e.addOn&&!e.local&&!e.sameday).reduce((t,e)=>t+((e.items||{})[pid]||0),0);
    assert.equal(got,want,'港駅の店：いつもの便で届く＝出荷の分 '+pid+' day '+day);}
  if(sd){const e=rp.ev.find(x=>x.k==='delivery'&&x.sameday);assert.ok(e,'できたての便は別に届く');for(const pid in sd.items)assert.equal(e.items[pid]||0,sd.items[pid],'できたての便の数 '+pid);}
  CC.csClose(GC,C,cs,[rm,rp]);
  // 締め：記録をセンターへ・状態を次の日へ
  CC.putRecord(log,CC.salesRecord(K,sm,rm),30);CC.putArrival(log,CC.arrival(K,C,sm,rm,d.slip),30);
  MS.omRecord(PC,CC,sp,rp);CC.putRecord(log,CC.salesRecord(PC,sp,rp),30);CC.putArrival(log,CC.arrival(PC,C,sp,rp,d.slip),30);
  sm=KC.closeDay(K,sm,rm,{}).state;sp=KC.closeDay(PC,sp,rp,{}).state;}
assert.ok(sdDays>0,'できたての便の日があった');
// 3) 同じ条件なら同じ（決まった乱数）
console.log('minato-group ok（10運行日・できたての便',sdDays,'日・港駅の店のキー',kp+'）');
