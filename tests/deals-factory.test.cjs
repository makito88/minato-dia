// 取引の相談窓口 第2回（2026-11-12）：販売の契約を工場とお金につなぐ
//  ・同じ条件なら同じ契約の注文（ゆれは ±wobble の中・契約の期間と土日の数）
//  ・契約の注文がない日は、工場の夜も納品書も前と同じ（強さ0）
//  ・工場の注文は、そのラインに契約の分だけ増える。足りない夜の順番は 自社の売店 → 契約 → 今までの取引先
//  ・届けた数からお金（取引先 → 工場）。グループのもうけの式はくずれない。契約の積み上げは同じ日を2回足さない
const assert=require('node:assert/strict');
for(const f of ['factory-core','bread-core','sand-loaf','sand-core','donut-core','bento-core','center-core','factory-night','deals-core','money-core','links/deals-to-factory','links/deals-to-money'])require('../js/'+f+'.js');
const D=require('../data/factory.json'),K=require('../data/kiosk.json'),Mk=require('../data/minato-store.json'),CCF=require('../data/center.json'),cfg=require('../data/deals.json'),M=require('../data/money.json'),LK=require('../data/links.json');
const {CenterCore:C,FactoryNight:FN,DealsCore:DC,MoneyCore:MC,DealsToFactory:DF,DealsToMoney:DM,SandCore:S}=globalThis;
S.simulate(D,{seed:1});
const pr=Object.fromEntries([...Mk.products,...K.products].map(p=>[p.id,p])),cat=DC.catalog(FN.kioskMap(D),pid=>pr[pid]);

// 1) 橋：2本とも links.json にある・強さ0なら止まる
for(const id of [DF.ID,DM.ID]){const b=LK.links.find(x=>x.id===id);assert.ok(b,id+' が links.json にない');assert.ok(DF.on(LK)&&DM.on(LK));
  const L0=JSON.parse(JSON.stringify(LK));L0.links.find(x=>x.id===id).strength=0;assert.equal((id===DF.ID?DF:DM).on(L0),false,id+'：強さ0で止まる');}

// 2) 契約の注文：同じなら同じ・ゆれの範囲・期間の外は0・土日の数
const St=DC.newState(4242,10);
const sel=[];for(let d=1;d<=40&&sel.length<3;d++)for(const o of DC.offersOn(cfg,cat,4242,d))if(o.kind==='sell'&&sel.length<3)sel.push(o);
assert.equal(sel.length,3,'販売の相談が3つ見つかる');
sel.forEach((o,i)=>DC.decide(cfg,St,o,'accept',10,i?'keep':'trial'));
assert.equal(DC.dayOrders(cfg,St,10,false),null,'引き受けた日はまだ（次の運行日から）');
const a=DC.dayOrders(cfg,St,11,false),b=DC.dayOrders(cfg,St,11,false);assert.deepEqual(a,b,'同じ条件なら同じ契約の注文');
assert.notDeepEqual(DC.dayOrders(cfg,St,11,false),DC.dayOrders(cfg,St,12,false),'日がちがえばゆれる');
for(const c of St.deals){const o=a.by[c.id]||{};for(const i of c.of.items){const q=o[i.pid]||0;if(i.wd>0)assert.ok(Math.abs(q-i.wd)<=Math.ceil(i.wd*cfg.sell.wobble)+1,'ゆれの範囲 '+q+'/'+i.wd);}}
{const we=DC.dayOrders(cfg,St,11,true);const tw=St.deals.reduce((t,c)=>t+DC.qtyOf(c.of,true),0),gw=we?Object.values(we.items).reduce((x,y)=>x+y,0):0;assert.ok(Math.abs(gw-tw)<=tw*cfg.sell.wobble+3,'土日は we の数');}
const trialEnd=St.deals[0].to;assert.ok(!(DC.dayOrders(cfg,St,trialEnd+1,false)||{by:{}}).by[St.deals[0].id],'お試しが終わった日からは頼まない');

// 3) dia-orders に書く：強さ0（put しない）なら deal がない。put は2店の注文の日にだけ書く
const log=C.emptyLog(),stores=[{st:'C',place:'home'},{st:'N',place:'gate'}],pick=['oni_sake','oni_ume','pan_melon','san_egg','don_sugar','dr_tea'];
for(let day=11;day<=16;day++){stores.forEach((s,k)=>{const items={};pick.forEach((pid,j)=>items[pid]=4+((day*7+j*5+k*11)%9));C.putOrder(K,CCF,log,day,C.storeKey(s),{mode:'auto',aim:'mid',items},30);});
  log.days.find(x=>x.day===day).cond={day:'wd',wx:'sun',season:'aut'};}
assert.equal(DF.put(DC,cfg,St,log,99,{day:'wd'}),null,'注文のない日には書かない');
let shortN=0,nights=0;
for(let day=11;day<=16;day++){const d=log.days.find(x=>x.day===day),cfgs={rice:{},bread:{},sand:{},donut:{}};if(day===16)cfgs.rice={batches:20,start:1140};   // 釜が少なく遅い夜
  const n0=FN.runNight(D,cfgs,{day,no:d.factory.no,items:d.factory.items,season:'aut'}),s0=JSON.stringify(FN.slip(D,CCF,d,n0));
  // 契約の注文がない日：前と同じ（deal なし・空の deal でも同じ）
  assert.equal(JSON.stringify(FN.runNight(D,cfgs,{day,no:d.factory.no,items:d.factory.items,season:'aut',deal:undefined})),JSON.stringify(n0),'deal なし → 同じ夜');
  assert.ok(!JSON.parse(s0).deals,'deal なし → 納品書に deals がない');
  const dl=DF.put(DC,cfg,St,log,day,d.cond);assert.ok(dl&&d.deal===dl,'その日に deal を書く');
  const n1=FN.runNight(D,cfgs,{day,no:d.factory.no,items:d.factory.items,season:'aut',deal:d.deal.items}),sl=FN.slip(D,CCF,d,n1);nights++;
  const m=FN.kioskMap(D),add={};for(const pid in d.deal.items)if(m[pid])add[m[pid].line]=(add[m[pid].line]||0)+d.deal.items[pid];
  for(const L in n1.lines)assert.equal(n1.lines[L].order,((n0.lines[L]||{}).order||0)+(add[L]||0),`day ${day} ${L}：契約の分だけ注文が増える`);
  // 自社の店の行（items）は、品も注文の数も前と同じ
  assert.deepEqual(Object.keys(sl.items).sort(),Object.keys(JSON.parse(s0).items).sort());for(const pid in sl.items)assert.equal(sl.items[pid][0],JSON.parse(s0).items[pid][0]);
  // 足りない夜の順番：契約の分は「出荷 − 自社の店の分」まで。自社の店が足りない品は、契約には届かない
  for(const pid in n1.rows){const r=n1.rows[pid];if(!r.k)continue;const own=FN.centerShip(r),got=Object.values(sl.deals).reduce((t,x)=>t+((x.it[pid]||[0,0])[1]),0);
    assert.ok(own+got<=r.shipped,'自社＋契約 ≦ 出荷');assert.ok(got<=r.k);if(own<r.c)assert.equal(got,0,'自社の店が足りなければ契約は0');if(got<r.k){assert.equal(got,Math.max(0,r.shipped-own));shortN++;}}
  for(const id in dl.by)assert.ok(sl.deals[id],'契約ごとの行');
  // お金と契約の積み上げ
  const before=JSON.stringify(St);assert.ok(DF.settle(DC,cfg,St,day,sl));assert.equal(DF.settle(DC,cfg,St,day,sl),false,'同じ日は2回足さない');
  for(const id in sl.deals){const x=sl.deals[id],c=St.deals.find(y=>y.id===id),mm=DC.dealMoney(cfg,c,x.it);assert.deepEqual(x.y,[mm.rev,mm.cost,mm.fee]);assert.ok(mm.rev>0||mm.s===0);}
  assert.notEqual(JSON.stringify(St),before);}
assert.ok(shortN>=1,'足りない夜に契約の分が減る（'+shortN+'品）');
for(const c of St.deals){assert.ok(c.got&&c.got.n>0);assert.ok(c.got.s<=c.got.q);}
console.log(`  ${nights}夜：契約の分だけ注文が増え、足りない夜は 自社 → 契約 → 今まで の順（契約が減った品 ${shortN}）`);

// 4) お金：取引先 → 工場。グループのもうけ＝外から−外へ＝会社ごとの合計。deals なしなら前と同じ
const cost=pid=>({a:100}[pid]||0),route=()=>'factory',st={id:'M',name:'M',sales:100000,pl:{staff:20000},delivered:{a:100},sd:{},runs:3,route,cost};
const base={day:5,stores:[st],haiso:{runs:[],sum:{}},take:0.15};
const L0=MC.groupLedger(M,base),L00=MC.groupLedger(M,Object.assign({},base,{deals:[]}));assert.deepEqual(L00,L0,'deals が空なら前と同じ');
const rows=DM.rows(log.days.find(x=>x.day===16).slip||{deals:{z:{n:'相手',y:[50000,30000,6000]}}});
const L1=MC.groupLedger(M,Object.assign({},base,{deals:[{name:'相手',rev:50000,cost:30000,fee:6000}]}));
assert.equal(L1.co.factory.inExt-L0.co.factory.inExt,50000,'取引先 → 工場');assert.equal(L1.ext.net-L0.ext.net,50000-30000-6000);
assert.equal(Object.values(L1.co).reduce((t,c)=>t+c.net,0),L1.ext.net,'会社ごとのもうけの合計＝グループのもうけ');
assert.ok(Array.isArray(rows));

// 5) 保存の大きさ：契約の積み上げを足しても小さい
const S2=DC.newState(99,1);for(let d=1;d<=180;d++){for(const o of DC.inbox(cfg,cat,S2,d,1440))DC.decide(cfg,S2,o,'accept',d,'keep');for(const c of S2.deals)if(c.kind==='sell'&&DC.stateOf(c,d)==='on')DC.record(S2,d,c.id,{q:100,s:95,profit:3000});DC.prune(cfg,S2,d);}
const kb=JSON.stringify(S2).length/1024;console.log(`  180日すべて引き受けて毎日結果を足したあと：dia-deals ${kb.toFixed(1)}KB`);assert.ok(kb<14,'dia-deals が大きすぎる');
console.log('deals-factory.test ok');
