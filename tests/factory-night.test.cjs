// 工場の夜とセンターの発注のつなぎ（js/factory-night.js）と、4つのラインの「外から渡す注文」（cfg.center）
const assert=require('node:assert/strict');
for(const f of ['factory-core','bread-core','sand-loaf','sand-core','donut-core','center-core','factory-night'])require('../js/'+f+'.js');
const D=require('../data/factory.json'),K=require('../data/kiosk.json'),CC=require('../data/center.json');
const {FactoryCore:F,BreadCore:B,SandCore:S,DonutCore:Dn,CenterCore:C,FactoryNight:FN}=globalThis;
S.simulate(D,{seed:1});   // サンドは前から kinds に並びの番号（_k）を書き足すので、その後で写す（今回の変更の前から）
const snap=JSON.stringify(D);

// 1) 発注がない夜は今までどおり（center なし・空・工場にない品だけ）
for(const [core,name] of [[F,'rice'],[B,'bread'],[S,'sand'],[Dn,'donut']])for(const seed of [1,5]){
  const a=JSON.stringify(core.simulate(D,{seed}).summary);
  assert.equal(JSON.stringify(core.simulate(D,{seed,center:{}}).summary),a,name+': empty center keeps the night');
  assert.equal(JSON.stringify(core.simulate(D,{seed,center:{drink_tea:30}}).summary),a,name+': non-factory items are ignored');}

// 2) 何夜か：店の発注 → 工場の合計 → 4つのラインの注文に足される → 納品書の数が合う
const stores=[{st:'C',place:'home'},{st:'N',place:'gate'}];
const pick=['oni_sake','oni_ume','oni_shio_n','pan_melon','pan_curry','san_egg','san_mix','don_sugar','don_nama','dr_tea'];
let log=C.emptyLog(),nights=0,shortSeen=0;
for(let day=10;day<16;day++){
  stores.forEach((s,k)=>{const items={};pick.forEach((pid,j)=>items[pid]=3+((day*7+j*5+k*11)%9));C.putOrder(K,CC,log,day,C.storeKey(s),{mode:'auto',aim:'mid',items},30);});
  const d=log.days.find(x=>x.day===day);
  d.factory.items.pan_new=4;d.orders['C-home'].factory.pan_new=4;   // 工場の行き先の品だが、工場の設定にない品（仮）
  d.cond={day:'wd',wx:'sun',season:day%2?'aut':'win'};
  const cfgs={rice:{},bread:{},sand:{},donut:{}};
  if(day===15)cfgs.rice={batches:20,start:1140};   // 釜が少なく遅い夜：足りなくなる
  const night=FN.runNight(D,cfgs,{day,no:d.factory.no,items:d.factory.items,season:d.cond.season});
  // 工場の注文＝ほかの店・取引先の分（夜の番号どおり）＋センターの分
  const seed=FN.seedOf(day),season=FN.seasonOf(d.cond.season);
  const base={rice:F.simulate(D,Object.assign({},cfgs.rice,{seed,season})).summary.order,bread:B.simulate(D,{seed,season}).summary.order,sand:S.simulate(D,{seed,season}).summary.order,donut:Dn.simulate(D,{seed,season}).summary.order};
  const m=FN.kioskMap(D),add={rice:0,bread:0,sand:0,donut:0};
  for(const pid in d.factory.items)if(m[pid])add[m[pid].line]+=d.factory.items[pid];
  for(const L in base)assert.equal(night.lines[L].order,base[L]+add[L],`day ${day} ${L}: center order is added`);
  assert.deepEqual(Object.keys(night.stock),['pan_new'],'item the factory does not make → center stock');
  const sl=FN.slip(D,CC,d,night);d.slip=sl;
  for(const pid in sl.items){const [o,s]=sl.items[pid];assert.equal(o,d.factory.items[pid]);assert(s>=0&&s<=o);
    const sum=Object.values(sl.stores).reduce((a,x)=>a+(x.items[pid]?x.items[pid][1]:0),0);assert.equal(sum,s,'stores share the shipped amount');
    for(const k in sl.stores){const x=sl.stores[k].items[pid];if(x)assert.equal(x[0],d.orders[k].factory[pid]);}}
  const sq=Object.values(sl.items).reduce((a,x)=>a+x[0]-x[1],0);assert.equal(sl.short.q,sq);
  assert.equal(Object.values(sl.stores).reduce((a,x)=>a+x.short.q,0),sq,'store shortages add up');
  assert.equal(sl.stores['C-home'].truck,'A');assert.equal(sl.stores['N-gate'].truck,'B');
  assert.equal(sl.stores['C-home'].no,'O'+String(day).padStart(4,'0')+'-C-home','order number carried to the slip');
  assert.equal(sl.order,d.factory.no);
  if(sq>0)shortSeen++;nights++;
  console.log(`day ${day} ${d.factory.no}: center ${Object.values(d.factory.items).reduce((a,b)=>a+b,0)} → shipped ${Object.values(sl.items).reduce((a,x)=>a+x[1],0)}, short ${sl.short.n} items/${sl.short.q}`,JSON.stringify(night.lines));}
assert(shortSeen>=1,'a short night is reported');
assert.equal(JSON.stringify(D),snap,'factory configuration is not changed');
// 3) 工場の画面用：いちばん新しい発注
const w=FN.withCenter({seed:3},log);assert.equal(w.centerNo,'F0015');assert.equal(w.seed,3);
assert.equal(FN.withCenter({seed:3},null).center,undefined);
assert(/F0015/.test(FN.centerNote(D,log,'rice','個')));
console.log(`factory-night: ${nights} nights, orders passed to 4 lines, slips add up, short nights ${shortSeen}`);
