// 発注と配送 第3回：工場 → センター → 売店の流れのつじつま
//  ・納品書の出荷数（ctx.supply）がなければ、売店の計算は今までと同じ
//  ・売店に届く工場の品は、納品書の出荷数をこえない。工場が足りなかった品だけ「届かなかった数（cut）」になる
//  ・到着の記録：届いた数＋センターに残った数＝出荷数
const assert=require('node:assert/strict');
for(const f of ['research-core','kiosk-staff','kiosk-core','factory-core','bread-core','sand-loaf','sand-core','donut-core','center-core','factory-night'])require('../js/'+f+'.js');
const K=require('../data/kiosk.json'),R=require('../data/research.json'),D=require('../data/factory.json'),C=require('../data/center.json');
const {KioskCore:KC,CenterCore:CC,FactoryNight:FN}=globalThis;
const H=KC.H,a=new Array(H).fill(0).map((_,h)=>h>=5&&h<24?150:0),fl=[a,a,a,a];
const ctxOf=(st,day,extra)=>Object.assign({day,dow:day%7,cond:{day:'wd',wx:'sun',season:'aut'},flows:{hb:fl,ha:fl},stops:new Array(H).fill(4),plats:2,rcfg:R,order:st.order,express:[],addOn:[],edits:[],startT:0},extra||{});
const isF=pid=>CC.routeOf(C,K.products.find(p=>p.id===pid).genre)==='factory';
const deliveredF=res=>{const o={};for(const e of res.ev)if(e.k==='delivery'&&!e.express&&!e.addOn)for(const pid in e.items)if(isF(pid))o[pid]=(o[pid]||0)+e.items[pid];return o;};

// 1) 上限なしは今までと同じ（前の kiosk-core と比べる）
// 前の版（git show で取り出したもの）を OLD_KIOSK に渡したときだけ比べる。例：git show 1e20e98:js/kiosk-core.js > /tmp/k.js; OLD_KIOSK=/tmp/k.js node tests/flow.test.cjs
{const vm=require('node:vm'),fs=require('node:fs');const box={};box.window=box;box.globalThis=box;
  for(const f of ['../js/research-core.js','../js/kiosk-staff.js'])vm.runInNewContext(fs.readFileSync(require.resolve(f),'utf8'),box);
  const oldSrc=fs.existsSync(process.env.OLD_KIOSK||'')?fs.readFileSync(process.env.OLD_KIOSK,'utf8'):null;
  if(oldSrc){vm.runInNewContext(oldSrc,box);const st=KC.create(K,{st:'M',place:'home',seed:3});
    for(const day of [5,6,9]){const A=JSON.stringify(box.KioskCore.simulate(K,st,ctxOf(st,day))),B=KC.simulate(K,st,ctxOf(st,day));delete B.cut;delete B.supplyLeft;assert.equal(JSON.stringify(B),A,'no supply → same day '+day);}
    console.log('  上限なしは前の版と同じ（3日）');}}

// 2) 全部の流れ：店の発注 → 工場の夜 → 納品書 → 売店に届く数 → 到着の記録
const st=KC.create(K,{st:'M',place:'home',seed:3}),key=CC.storeKey(st);
let log=CC.emptyLog(),shortDays=0,cutAll=0;
for(let day=10;day<16;day++){
  CC.putOrder(K,C,log,day,key,{mode:'self',items:st.order},30);const d=log.days.find(x=>x.day===day);d.cond={day:'wd',wx:'sun',season:'aut'};
  const cfgs={rice:{},bread:{},sand:{},donut:{}};if(day>=14)cfgs.rice={batches:20,start:1140};   // 釜が少なく遅い夜：工場が足りない
  const night=FN.runNight(D,cfgs,{day,no:d.factory.no,items:d.factory.items,season:'aut'});
  d.slip=FN.slip(D,C,d,night);const m=d.slip.stores[key];
  // 売店を最優先：工場の出荷が足りていれば、売店の分は満たされる
  for(const pid in night.rows){const r=night.rows[pid];if(r.shipped>=r.c)assert.equal(m.items[pid][1],r.c,'store first '+pid);}
  const sup=CC.supplyFor(d.slip,key),res=KC.simulate(K,st,ctxOf(st,day,{supply:sup}));
  const got=deliveredF(res);
  for(const pid in m.items){const [o,s]=m.items[pid];assert((got[pid]||0)<=s,`届いた数 ≤ 出荷数 ${pid} ${got[pid]}>${s}`);
    if(s>=o)assert(!(res.cut&&res.cut[pid]),'cut only when short '+pid);}
  const arr=CC.arrival(K,C,st,res,d.slip);CC.putArrival(log,arr,30);
  for(const pid in m.items){const s=m.items[pid][1];assert.equal((got[pid]||0)+(arr.left[pid]||0),s,'届いた＋センターに残った＝出荷 '+pid);}
  assert.equal(arr.runs.length,3);assert.deepEqual(arr.runs.map(r=>r.bin),['朝の便','昼前の便','午後の便']);
  const cut=Object.values(res.cut||{}).reduce((a,b)=>a+b,0);cutAll+=cut;if(m.short.q>0){shortDays++;assert(cut>0,'short slip → cut');}
  console.log(`  第${day}運行日 ${m.no}：工場の品 発注${Object.values(m.items).reduce((a,x)=>a+x[0],0)}・出荷${Object.values(m.items).reduce((a,x)=>a+x[1],0)}・届いた${Object.values(got).reduce((a,b)=>a+b,0)}・届かない${cut}・センターに残った${Object.values(arr.left).reduce((a,b)=>a+b,0)}・トラック${arr.truck}`);}
assert(shortDays>=1,'a short night happened');
// 流れの時刻：トラックが便の時刻より前に着く
for(const k of ['M-home','C-home','F-home','O-home','N-home']){const F=CC.flowOf(C,k);for(const r of F.runs)assert(r.arrive%1440<=r.t,`${k} ${r.bin} 着${r.arrive} 便${r.t}`);}
console.log(`flow: 6 nights, store-first slips, deliveries ≤ shipped, delivered+left = shipped, short nights ${shortDays}, cut ${cutAll}`);
