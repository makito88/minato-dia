// 取引の相談窓口 第3回（2026-11-12）：配送の契約を配送会社とお金につなぐ
//  ・同じ条件なら同じ荷物（ゆれは ±wobble の中・0.5台きざみ・曜日と期間を守る）。積む便は時刻表とトラックの分だけで決まる
//  ・契約の届け先がない日は、配送会社の1日の計算が前と同じ（指紋）
//  ・契約の届け先は自社の店のあとに寄る：自社の店に着く時刻・センターが払う運賃は変わらない。かご車が足りなければ応援便（配送会社が払う）
//  ・結果の積み上げは同じ日を2回足さない。お金：荷主 → 配送会社・センター。店まで届ける契約は自社の便（工場 → 配送会社）
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
for(const f of ['center-core','haiso-core','deals-core','money-core','links/deals-to-haiso','links/deals-to-money','links/deals-to-factory'])require('../js/'+f+'.js');
const H=require('../data/haiso.json'),CCF=require('../data/center.json'),cfg=require('../data/deals.json'),M=require('../data/money.json'),LK=require('../data/links.json');
const {CenterCore:C,HaisoCore:HC,DealsCore:DC,MoneyCore:MC,DealsToHaiso:DH,DealsToMoney:DM,DealsToFactory:DF}=globalThis;
const hs=o=>crypto.createHash('sha1').update(JSON.stringify(o)).digest('hex').slice(0,16);

// 1) 橋：links.json にある・強さ0なら止まる
{const b=LK.links.find(x=>x.id===DH.ID);assert.ok(b,'deals-to-haiso が links.json にない');assert.equal(b.from,'deals');assert.equal(b.to,'haiso');assert.ok(DH.on(LK));
  const L0=JSON.parse(JSON.stringify(LK));L0.links.find(x=>x.id===DH.ID).strength=0;assert.equal(DH.on(L0),false,'強さ0で止まる');}

// 2) 契約の届け先がない日は、配送会社の計算が前と同じ（第3回の前の haiso-core.js で作った指紋）
{const inputs=[];
  for(let day=1;day<=30;day++){const own=[{key:'M-home',runs:[{bin:'朝の便',f:500+day*7,c:200},{bin:'昼前の便',f:100,c:90+day},{bin:'午後の便',f:80,c:60}]}];
    if(day%2)own.push({key:'P-naka',runs:[{bin:'朝の便',f:400,c:300},{bin:'昼前の便',f:2000+day*50,c:600}]});
    if(day%3===0)own.push({key:'C-x0',ext:true,runs:[{bin:'昼前の便',f:0,c:90}]});
    inputs.push({day,cond:{day:day%7<5?'wd':'we',wx:day%5?'sun':'rain'},slip:day%4?null:{late:{mode:day%8?'wait':'chase',wait:20,end:1620,at:1700,bin:'朝の便',fee:9000}},stores:own});}
  assert.equal(hs(inputs.map(i=>HC.dayPlan(H,CCF,C,i))),'3d652d35cae3e724','契約がない日の配送の計算が前と同じ');}

// 3) 配送の契約の荷物：同じなら同じ・ゆれ・0.5台きざみ・曜日・期間
const St=DC.newState(777,5),cat={};
const hauls=[];for(let d=1;d<=80&&hauls.length<4;d++)for(const o of DC.offersOn(cfg,cat,777,d))if(o.kind==='haul'&&hauls.length<4&&!hauls.some(h=>h.cargo==='frozen'&&o.cargo==='frozen'))hauls.push(o);
assert.ok(hauls.length>=3,'配送の相談が見つかる（販売の品がないときは配送だけ）');
hauls.forEach(o=>DC.decide(cfg,St,o,'accept',5,'keep'));
const binOf=(to,w)=>DC.binFor(CCF,H.handleMin,to,w);
assert.equal(DC.dayHauls(cfg,St,5,false,binOf),null,'引き受けた日はまだ（次の運行日から）');
assert.deepEqual(DC.dayHauls(cfg,St,6,false,binOf),DC.dayHauls(cfg,St,6,false,binOf),'同じ条件なら同じ荷物');
for(let d=6;d<=20;d++)for(const we of [false,true]){const o=DC.dayHauls(cfg,St,d,we,binOf)||{};
  for(const c of St.deals){const x=o[c.id];const runs=c.of.dow==='all'||(c.of.dow==='we')===we;
    if(!runs){assert.ok(!x,'運ばない曜日は書かない');continue;}assert.ok(x,'運ぶ曜日は書く');
    assert.equal(x.c*2,Math.round(x.c*2),'0.5台きざみ');assert.ok(Math.abs(x.c-c.of.carts)<=c.of.carts*cfg.haul.wobble+0.5,'ゆれの範囲');
    assert.ok(['朝の便','昼前の便','午後の便'].includes(x.b),'積む便が決まる');assert.equal(x.f,c.of.fare);
    assert.equal(x.s>0,/^川辺の配送センター/.test(c.of.from),'センターに持ち込むときだけ仕分け料');}}
assert.equal(DC.dayHauls(cfg,St,6+400,false,binOf),null,'期間が終わったら運ばない');
// 便の選び方：はばの終わりまでに着く便のうちいちばん遅いもの（時刻表だけで決まる）
assert.equal(DC.binFor(CCF,15,'P',[330,420]),'朝の便');assert.equal(DC.binFor(CCF,15,'P',[540,660]),'昼前の便');assert.equal(DC.binFor(CCF,15,'U',[840,960]),'午後の便');

// 4) dia-orders に書く（put）・注文のない日は書かない
const log=C.emptyLog();for(let day=6;day<=12;day++){C.putOrder(require('../data/kiosk.json'),CCF,log,day,'M-home',{mode:'auto',aim:'mid',items:{oni_sake:5}},30);log.days.find(x=>x.day===day).cond={day:'wd',wx:'sun'};}
assert.equal(DH.put(DC,cfg,St,log,99,{day:'wd'},CCF,H),null,'注文のない日には書かない');
const d6=log.days.find(x=>x.day===6),hw=DH.put(DC,cfg,St,log,6,d6.cond,CCF,H);assert.ok(hw&&d6.haul===hw,'その日に haul を書く');
assert.ok(JSON.stringify(d6.haul).length<200*Object.keys(d6.haul).length,'haul は小さい');

// 5) 便の計算：自社の店のあとに寄る・自社の店の時刻とセンターの運賃は変わらない
const base={day:6,cond:d6.cond,slip:null,stores:[{key:'M-home',runs:[{bin:'朝の便',f:900,c:400},{bin:'昼前の便',f:200,c:200},{bin:'午後の便',f:150,c:150}]},{key:'P-naka',runs:[{bin:'朝の便',f:600,c:300},{bin:'昼前の便',f:300,c:150},{bin:'午後の便',f:200,c:100}]}]};
const P0=HC.dayPlan(H,CCF,C,base),ex=DH.stops(DC,H,d6),P1=HC.dayPlan(H,CCF,C,{...base,stores:[...base.stores,...ex]});
assert.ok(ex.length>=1,'外の届け先ができる');
for(const r0 of P0.runs.filter(r=>r.leg==='cs')){const r1=P1.runs.find(r=>r.id===r0.id);assert.ok(r1,'同じ便がある');
  for(const s of r0.stops){const s1=r1.stops.find(x=>x.key===s.key);assert.equal(s1.arrive,s.arrive,'自社の店に着く時刻は同じ');}
  assert.equal(r1.fare,r0.fare,'センターが払う運賃は同じ');
  const ds=r1.stops.filter(x=>x.deal),last=Math.max(...r1.stops.filter(x=>!x.deal).map(x=>x.arrive));for(const x of ds)assert.ok(x.arrive>=last+H.handleMin,'契約の届け先は自社の店のあと');}
{const dF=P1.runs.reduce((t,r)=>t+(r.dfare||0),0),want=Object.values(d6.haul).filter(x=>!x.o).reduce((t,x)=>t+x.f,0);assert.equal(dF,want,'契約の運賃は荷主から（便に dfare）');
  assert.equal(P1.sum.profit,P1.sum.fare+(P1.sum.dfare||0)-P1.sum.cost-(P1.sum.dfee||0),'配送会社のもうけの式');assert.ok(P1.sum.cost>=P0.sum.cost,'寄り道のぶん費用は増える（減らない）');}
// かご車が足りない日：応援便のうち契約の分は配送会社が払う
{const big={k:'haul',c:9,to:'P',w:[540,660],b:'昼前の便',n:'テスト荷主',f:30000,s:0};const P2=HC.dayPlan(H,CCF,C,{...base,stores:[...base.stores,...DC.haulStops({t1:big},H.perCart)]});
  const xr=P2.runs.filter(r=>r.leg==='cs-extra'&&r.bin==='昼前の便');assert.ok(xr.some(r=>r.payer==='haiso'),'契約の荷物の応援便は配送会社が払う');
  const r0=P0.runs.find(r=>r.leg==='cs'&&r.bin==='昼前の便'&&r.truck==='B'),r2=P2.runs.find(r=>r.id===r0.id);assert.equal(r2.fare,r0.fare,'あふれても、センターが払う運賃は同じ');
  const R=DC.haulResults({t1:big},P2);assert.equal(R.t1.help,1,'結果に応援便');}

// 6) 結果の積み上げ：着いた時刻・遅れ・2回足さない
{const R=DC.haulResults(d6.haul,P1);for(const id in d6.haul){const x=d6.haul[id];if(x.o){assert.equal(R[id].other,1);continue;}assert.ok(R[id].arr!=null,'着いた時刻');assert.equal(R[id].late,Math.max(0,Math.round(R[id].arr-x.w[1])));}
  const S2=JSON.parse(JSON.stringify(St));assert.ok(DH.close(DC,S2,6,d6,P1),'結果を足す');const g1=JSON.stringify(S2.deals.map(c=>c.got));assert.equal(DH.close(DC,S2,6,d6,P1),false,'同じ日は2回足さない');assert.equal(JSON.stringify(S2.deals.map(c=>c.got)),g1);
  for(const c of S2.deals){const x=d6.haul[c.id];if(!x)continue;assert.equal(c.got.n,1);assert.equal(c.got.q,x.c);assert.equal(c.got.y,x.f);}}

// 7) お金：荷主 → 配送会社・センター、自社で運べない荷物は港浜急送（配送会社）。外と中のつじつま
{const rows=DM.hauls(d6.haul,H);assert.equal(rows.length,Object.keys(d6.haul).length);
  const st=[{id:'M-home',name:'緑ヶ丘',sales:90000,pl:{staff:20000},delivered:{oni_sake:30},sd:{},runs:3,route:()=>'factory',cost:()=>120}];
  const L0=MC.groupLedger(M,{day:6,haiso:P0,stores:st}),L1=MC.groupLedger(M,{day:6,haiso:P1,stores:st,hauls:rows});
  const sum=(L,f)=>L.inv.filter(f).reduce((t,x)=>t+x.yen,0);
  assert.equal(sum(L1,x=>x.from==='ext'&&x.to==='haiso'),rows.reduce((t,x)=>t+x.fare,0),'荷主 → 配送会社の運賃');
  assert.equal(sum(L1,x=>x.from==='ext'&&x.to==='center'&&x.what.startsWith('仕分け料')),rows.reduce((t,x)=>t+x.sort,0),'荷主 → センターの仕分け料');
  assert.equal(sum(L1,x=>x.from==='center'&&x.to==='haiso'),sum(L0,x=>x.from==='center'&&x.to==='haiso'),'センター → 配送会社の運賃は変わらない');
  for(const L of [L0,L1])assert.equal(L.ext.net,Object.values(L.co).reduce((t,c)=>t+c.net,0),'グループのもうけ＝会社のもうけの合計');
  assert.deepEqual(MC.groupLedger(M,{day:6,haiso:P0,stores:st,hauls:[]}),L0,'hauls が空なら前と同じ');}

// 8) 店まで届ける（販売の契約）：自社の便・工場 → 配送会社の運賃（港浜急送の費用は出ない）
{const Ss=DC.newState(31,3);Ss.deals.push({id:'9-0',kind:'sell',at:3,from:4,to:30,trial:false,of:{partner:'c1',name:'ハマナスマート 港町店',st:'P',line:'rice',items:[{pid:'oni_sake',name:'鮭',wd:200,we:180,price:150,ref:160}],hand:'deliver',handT:480,days:30}});
  const dd={day:6,haul:null},slip={deals:{'9-0':{it:{oni_sake:[200,190]}}}};
  assert.ok(DH.sell(DC,cfg,Ss,dd,slip,CCF,H),'店まで届ける荷物を足す');const x=dd.haul['9-0'];assert.equal(x.k,'sell');assert.equal(x.p,190);assert.equal(x.to,'P');assert.ok(x.b);
  assert.equal(slip.deals['9-0'].own,1);assert.equal(slip.deals['9-0'].hf,DC.ownDeliverFare(H,190));
  DF.settle(DC,cfg,Ss,6,slip);assert.equal(slip.deals['9-0'].y[2],slip.deals['9-0'].hf,'工場の届ける費用＝自社の便の運賃');
  const r=DM.rows(slip)[0];assert.equal(r.fee,0,'港浜急送の費用は出ない');assert.equal(r.hf,slip.deals['9-0'].hf);
  const st=DC.haulStops(dd.haul,H.perCart)[0];assert.equal(st.runs[0].f,190,'工場の品として便に積む');assert.equal(DM.hauls(dd.haul,H).length,0,'販売の契約は配送の請求書にしない（工場 → 配送会社）');
  const L=MC.groupLedger(M,{day:6,stores:[],deals:[r]});assert.ok(L.inv.some(v=>v.from==='factory'&&v.to==='haiso'&&v.yen===r.hf),'工場 → 配送会社の運賃');assert.ok(!L.inv.some(v=>v.what.startsWith('港浜急送')),'港浜急送の行は出ない');
  // 橋をつながないとき（own なし）は前と同じ港浜急送
  const slip2={deals:{'9-0':{it:{oni_sake:[200,190]}}}},S3=JSON.parse(JSON.stringify(Ss));delete S3.deals[0].got;DF.settle(DC,cfg,S3,7,slip2);assert.equal(slip2.deals['9-0'].y[2],cfg.sell.deliverFee,'つながないときは港浜急送');}

// 9) 保存の大きさ：配送の契約を24件・結果つきでも小さい
{const S4=DC.newState(5,1);for(let d=1;d<=200&&S4.deals.length<24;d++)for(const o of DC.offersOn(cfg,{},5,d))if(S4.deals.length<24)DC.decide(cfg,S4,o,'accept',d,'keep');
  for(const c of S4.deals)DC.recordHaul(S4,c.from,c.id,{c:c.of.carts,f:c.of.fare},{arr:600,late:12});
  assert.ok(JSON.stringify(S4).length<12000,'dia-deals は 12KB より小さい：'+JSON.stringify(S4).length);}
console.log('deals-haiso ok');
