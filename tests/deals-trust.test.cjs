// 取引の相談窓口 第4回（2026-11-12）：営業・信用（評判）・更新と解約・値段の交渉・工場の収支の4つの取引先の移しかえ
//  ・同じ条件なら同じ相談（今までの相談は前と同じ・営業から届く相談も同じ）
//  ・保存の形（v:1 のまま、足した欄はなくても動く）と大きさ
//  ・移す日の作る数とお金が前と変わらない（チェックしていた取引先は今までの形のまま・deal に入れない）
const assert=require('node:assert/strict');
for(const f of ['factory-core','bread-core','sand-loaf','sand-core','donut-core','bento-core','center-core','factory-night','factory-pl','deals-core','money-core','links/deals-to-factory','links/deals-to-money','links/deals-to-haiso'])require('../js/'+f+'.js');
const D=require('../data/factory.json'),K=require('../data/kiosk.json'),Mk=require('../data/minato-store.json'),CCF=require('../data/center.json'),cfg=require('../data/deals.json'),M=require('../data/money.json'),LK=require('../data/links.json');
const {CenterCore:C,FactoryNight:FN,DealsCore:DC,MoneyCore:MC,DealsToFactory:DF,DealsToMoney:DM,FactoryPL:PL,SandCore:Sd}=globalThis;
Sd.simulate(D,{seed:1});
const pr=Object.fromEntries([...Mk.products,...K.products].map(p=>[p.id,p])),cat=DC.catalog(FN.kioskMap(D),pid=>pr[pid]);
const pl=D.pl.customers;

// 1) 今までの相談は前と同じ（第4回で中身の作り方を分けたが、乱数を引く順は同じ）
{let s='';for(let d=1;d<=300;d++)s+=JSON.stringify(DC.offersOn(cfg,cat,4242,d));assert.equal(DC.hashS(s),3738233446,'第3回までと同じ相談');}

// 2) 営業：1日に1回ずつ・1〜3日あとに届く・同じなら同じ・費用はお金の行に
{const S=DC.newState(77,20);assert.equal(DC.salesDo(cfg,S,20,'ws'),true);assert.equal(DC.salesDo(cfg,S,20,'ws'),false,'同じ日は1回');assert.equal(DC.salesDo(cfg,S,20,'door'),true);
  assert.equal(DC.salesDo(cfg,S,20,'xx'),false);assert.deepEqual(S.sales.map(x=>x.slice(0,2)),[[20,'ws'],[20,'door']]);
  const T=Object.fromEntries(cfg.sales.map(t=>[t.id,t]));for(const [,ty,k] of S.sales)assert.ok(k>=T[ty].n[0]-1&&k<=T[ty].n[1]+1);
  let got=[];for(let d=20;d<=25;d++){const a=DC.salesOffers(cfg,cat,S,d),b=DC.salesOffers(cfg,cat,S,d);assert.deepEqual(a,b,'同じなら同じ');for(const o of a){assert.ok(d>=21&&d<=23,'1〜3日あと');assert.equal(+o.id.split('-')[0],d,'id の頭は届く日');got.push(o);}}
  assert.equal(got.length,S.sales.reduce((t,x)=>t+x[2],0),'動いた分だけ届く');
  for(const o of got){if(o.sales==='ws'){assert.equal(o.kind,'sell');assert.equal(o.via,'intro');}else assert.equal(o.via,'ask');}
  const box=DC.inbox(cfg,cat,S,23,1440);assert.ok(got.filter(o=>o.day>=21).every(o=>box.some(x=>x.id===o.id)||o.exp<23),'受信箱に出る');
  const cs=DC.salesCost(cfg,S,20);assert.equal(cs.length,2);assert.deepEqual(cs.map(x=>[x.payer,x.yen]),[['factory',8000],['center',3000]]);assert.deepEqual(DC.salesCost(cfg,S,21),[]);
  assert.deepEqual(DM.sales(DC,cfg,S,20),cs);
  // お金：sales がなければ前と同じ。あれば工場とセンターの費用が増えるだけ
  const st={id:'C-home',name:'店',sales:50000,pl:{},delivered:{},sd:{},runs:2,route:()=>'factory',cost:()=>100};
  const L0=MC.groupLedger(M,{day:20,stores:[st]}),L1=MC.groupLedger(M,{day:20,stores:[st],sales:cs});
  assert.equal(L1.co.factory.out-L0.co.factory.out,8000);assert.equal(L1.co.center.out-L0.co.center.out,3000);assert.equal(L1.ext.out-L0.ext.out,11000);
  assert.deepEqual(MC.groupLedger(M,{day:20,stores:[st],sales:[]}).co,L0.co,'sales が空なら前と同じ');
  DC.prune(cfg,S,40);assert.equal(S.sales.length,0,'営業の記録は7日で消える');}

// 3) 信用：はじめ0.6・届けた日で上がる・足りない日で下がる・低すぎると相手が打ち切る
{const S=DC.newState(5,1);assert.equal(DC.repOf(cfg,S,'c1'),cfg.rep.base);assert.equal(DC.repAll(cfg,S),cfg.rep.base);
  const o=DC.offersOn(cfg,cat,5,3).concat(DC.offersOn(cfg,cat,5,4),DC.offersOn(cfg,cat,5,5),DC.offersOn(cfg,cat,5,6)).find(x=>x.kind==='sell');DC.decide(cfg,S,o,'accept',6,'keep');const c=S.deals[0];
  for(let d=7;d<=16;d++)DC.record(S,d,c.id,{q:100,s:100,short:0,profit:1000},cfg);
  assert.equal(DC.repOf(cfg,S,o.partner),Math.round((cfg.rep.base+10*cfg.rep.good)*100)/100,'10日届けて上がる');
  assert.equal(DC.record(S,16,c.id,{q:1,s:1,short:0,profit:0},cfg),false,'同じ日は2回足さない');
  let quit=null;for(let d=17;d<=40;d++){DC.record(S,d,c.id,{q:100,s:50,short:50,profit:0},cfg);if(c.qt){quit=d;break;}}
  assert.ok(quit,'足りない日がつづくと相手が打ち切る');assert.equal(c.to,quit,'打ち切りはその日の分まで');assert.ok(DC.repOf(cfg,S,o.partner)<cfg.rep.quit);
  assert.equal(DC.dayOrders(cfg,S,quit+1,false),null,'打ち切った次の日からは頼まない');
  // 配送：遅れた日で下がる・打ち切りは次の日の分まで（結果は前の日）
  const S2=DC.newState(6,1),h=[...Array(30)].flatMap((_,i)=>DC.offersOn(cfg,cat,6,i+1)).find(x=>x.kind==='haul');DC.decide(cfg,S2,h,'accept',30,'keep');const c2=S2.deals[0],to2=c2.to;
  let q2=null;for(let d=31;d<=60;d++){DC.recordHaul(S2,d,c2.id,{c:1,f:1000},{arr:600,late:40},cfg);if(c2.qt){q2=d;break;}}assert.ok(q2);assert.equal(c2.to,Math.min(to2,q2+1));}

// 4) 値段の交渉：値上げほど見込みが下がる・同じなら同じ返事・うなずけば条件を変えた契約・2回断られると引っこめる
{const S=DC.newState(4242,10),box=DC.inbox(cfg,cat,S,10,1440),o=box.find(x=>x.kind==='sell')||box[0];
  const ps=cfg.nego.up.map(up=>DC.negoChance(cfg,S,o,{up,qm:1}));for(let i=1;i<ps.length;i++)assert.ok(ps[i]<ps[i-1],'値上げほど見込みが下がる');
  assert.ok(DC.negoChance(cfg,S,o,{up:0,qm:0.6})<DC.negoChance(cfg,S,o,{up:0,qm:1}),'数を変えても下がる');
  const S1=JSON.parse(JSON.stringify(S)),S2=JSON.parse(JSON.stringify(S));assert.deepEqual(DC.negotiate(cfg,S1,o,10,{up:0.1,qm:1},'keep'),DC.negotiate(cfg,S2,o,10,{up:0.1,qm:1},'keep'),'同じなら同じ返事');
  // うなずくまで探す（決まった乱数なので、どこかでうなずく相談がある）
  let okO=null,Sx=null;for(let d=10;d<=40&&!okO;d++){const Sy=DC.newState(4242,d);for(const x of DC.inbox(cfg,cat,Sy,d,1440).filter(x=>x.kind==='sell')){const r=DC.negotiate(cfg,Sy,x,d,{up:0.05,qm:0.8},'keep');if(r&&r.ok){okO=x;Sx=Sy;break;}}}
  assert.ok(okO,'うなずく相談がある');const c=Sx.deals.find(x=>x.id===okO.id);assert.deepEqual(c.ng,[0.05,0.8]);
  okO.items.forEach((i,j)=>{assert.equal(c.of.items[j].price,Math.round(i.price*1.05));assert.ok(Math.abs(c.of.items[j].wd-i.wd*0.8)<=10);});
  // 断られる：受信箱に残る（nx）→ もう1回断られると引っこめる
  let nO=null,Sn=null;for(let d=10;d<=60&&!nO;d++){const Sy=DC.newState(4242,d);for(const x of DC.inbox(cfg,cat,Sy,d,1440)){const T=JSON.parse(JSON.stringify(Sy));const r1=DC.negotiate(cfg,T,x,d,{up:0.15,qm:1},'keep');if(r1&&!r1.ok){const r2=DC.negotiate(cfg,T,x,d,{up:0.15,qm:1},'keep');if(r2&&!r2.ok){nO=x;Sn=Sy;break;}}}}
  assert.ok(nO,'2回断られる相談がある');const r1=DC.negotiate(cfg,Sn,nO,nO.day,{up:0.15,qm:1},'keep');assert.equal(r1.ok,false);
  const b1=DC.inbox(cfg,cat,Sn,nO.day,1440).find(x=>x.id===nO.id);assert.ok(b1&&b1.st2==='nx'&&b1.nx===1,'断られても受信箱に残る');
  DC.decide(cfg,Sn,nO,'hold',nO.day);assert.equal(Sn.dec[nO.id][2],1,'保留にしても断られた回数は残る');
  const r2=DC.negotiate(cfg,Sn,nO,nO.day,{up:0.15,qm:1},'keep');assert.equal(r2.gone,true);assert.ok(!DC.inbox(cfg,cat,Sn,nO.day,1440).some(x=>x.id===nO.id),'引っこめた相談は出ない');}

// 5) 解約と更新
{const S=DC.newState(4242,10),os=DC.inbox(cfg,cat,S,10,1440);assert.ok(os.length>=2);
  DC.decide(cfg,S,os[0],'accept',10,'trial');DC.decide(cfg,S,os[1],'accept',10,'keep');const [t,k]=S.deals;
  DC.cancel(cfg,S,t.id,12);assert.equal(t.to,12,'お試しはその日で終わる');assert.equal(DC.repOf(cfg,S,t.of.partner),cfg.rep.base,'お試しの解約は信用が下がらない');
  const p0=DC.repOf(cfg,S,k.of.partner);DC.cancel(cfg,S,k.id,12);assert.equal(k.to,12+cfg.notice,'続ける契約は予告のあと');assert.ok(DC.repOf(cfg,S,k.of.partner)<p0||k.of.partner===t.of.partner,'続ける契約の解約は信用が下がる');
  assert.equal(DC.cancel(cfg,S,k.id,13),null,'2回は解約しない');
  const S2=DC.newState(4242,10);DC.decide(cfg,S2,os[0],'accept',10,'trial');DC.cancel(cfg,S2,os[0].id,10);assert.equal(DC.stateOf(S2.deals[0],11),'done','始まる前に解約すると始めない');
  // 更新：終わりの3日前から終わって7日まで・決まった乱数・断られたらもう頼めない
  const S3=DC.newState(4242,10);DC.decide(cfg,S3,os[0],'accept',10,'trial');const c=S3.deals[0];
  assert.equal(DC.renewInfo(cfg,S3,c,c.to-4),null);assert.ok(DC.renewInfo(cfg,S3,c,c.to-3));assert.ok(DC.renewInfo(cfg,S3,c,c.to+7));assert.equal(DC.renewInfo(cfg,S3,c,c.to+8),null);
  const A=JSON.parse(JSON.stringify(S3)),B=JSON.parse(JSON.stringify(S3));assert.deepEqual(DC.renew(cfg,A,c.id,c.to),DC.renew(cfg,B,c.id,c.to),'同じなら同じ返事');
  const r=DC.renew(cfg,S3,c.id,c.to);if(r.ok){assert.equal(c.to,r.to);assert.equal(c.trial,false);assert.equal(c.rn,1);}else{assert.equal(c.rf,c.to);assert.equal(DC.renewInfo(cfg,S3,c,c.to),null,'断られたらもう頼めない');}
  // 信用が高いほど更新の見込みが高い
  const hi=JSON.parse(JSON.stringify(S3)),lo=JSON.parse(JSON.stringify(S3));delete hi.deals[0].rf;delete lo.deals[0].rf;hi.rep={[c.of.partner]:[30,0,0]};lo.rep={[c.of.partner]:[5,4,0]};
  assert.ok(DC.renewInfo(cfg,hi,hi.deals[0],c.to).p>DC.renewInfo(cfg,lo,lo.deals[0],c.to).p);}

// 6) 工場の収支の4つの取引先の移しかえ：移す日の作る数とお金が前と変わらない
{const checked=['port','hosp'];const S=DC.newState(4242,30);
  assert.equal(DC.migrate(cfg,cat,S,30,pl,checked),true);assert.equal(DC.migrate(cfg,cat,S,31,pl,checked),false,'移しかえは1回だけ');
  assert.equal(S.m4,30);const leg=S.deals.filter(c=>c.leg);assert.deepEqual(leg.map(c=>c.pl).sort(),['hosp','port']);
  for(const c of leg){const pc=pl.find(x=>x.id===c.pl);assert.equal(c.of.line,'rice');assert.ok(Math.abs(DC.qtyOf(c.of,false)-pc.units)<=20,'今までの数のまま '+c.pl);assert.equal(c.of.partner,cfg.legacy.map[c.pl]);}
  const box=DC.inbox(cfg,cat,S,30,1440,pl),fo=box.filter(o=>o.pl);assert.deepEqual(fo.map(o=>o.pl).sort(),['inn','univ'],'チェックしていなかった2つは最初の相談');
  assert.ok(DC.inbox(cfg,cat,S,30+cfg.legacy.exp,1440,pl).some(o=>o.pl),'期限まで出る');assert.ok(!DC.inbox(cfg,cat,S,31+cfg.legacy.exp,1440,pl).some(o=>o.pl));
  for(const o of fo)for(const i of o.items)assert.equal(i.price,Math.round(i.ref*cfg.legacy.price),'値段は売店と同じ取り分');
  // 今までの形の契約は、工場の注文（deal）にも、見込みの「引き受けた契約の分」にも入れない
  for(let d=30;d<=40;d++)assert.equal(DC.dayOrders(cfg,S,d,false),null,'deal に入れない');
  assert.equal(DC.committed(S,'rice',35,false),0);
  // 工場の夜：移す前（dia-factory-pl のチェック）と、移したあとで同じ夜・同じ納品書・同じお金の行
  const log=C.emptyLog(),items={oni_sake:30,oni_ume:24,pan_melon:12,san_egg:8};C.putOrder(K,CCF,log,31,C.storeKey({st:'C',place:'home'}),{mode:'auto',aim:'mid',items},30);const d=log.days.find(x=>x.day===31);d.cond={day:'wd',season:'aut'};
  const s={take:D.pl.take.default,building:D.pl.building.default,customers:checked,equip:false};
  const night=dl=>{const Dx=PL.apply(JSON.parse(JSON.stringify(D)),s),cfgs={rice:{batches:PL.suggestBatches(Dx)},bread:{},sand:{},donut:{}};const n=FN.runNight(Dx,cfgs,{day:31,no:d.factory.no,items:d.factory.items,season:'aut',deal:dl&&dl.items});return {n:JSON.stringify(n),s:FN.slip(Dx,CCF,d,n)};};
  const before=night(null);const put=DF.put(DC,cfg,S,log,31,d.cond);assert.equal(put,null,'移したあとも deal を書かない');const after=night(d.deal);
  assert.equal(after.n,before.n,'同じ夜（作る数）');assert.deepEqual(after.s,before.s,'同じ納品書');assert.deepEqual(DM.rows(after.s),DM.rows(before.s),'同じお金の行');assert.deepEqual(DM.rows(after.s),[]);
  // 解約すると今までの形の契約は終わる（工場の見込みから外すのは画面が dia-factory-pl を書きかえる）
  const c=DC.cancel(cfg,S,leg[0].id,32);assert.equal(c.to,32);assert.equal(DC.repOf(cfg,S,leg[0].of.partner),cfg.rep.base,'今までの形の解約は信用が下がらない');
  // 契約がいっぱいでも今までの形の契約は消さない
  for(let i=0;i<40;i++)S.deals.push({id:(100+i)+'-0',kind:'haul',at:100,from:101,to:200,of:{partner:'c1'}});DC.prune(cfg,S,110);assert.ok(S.deals.some(c=>c.leg&&c.pl==='hosp'),'今までの形の契約は残る');assert.ok(S.deals.length<=cfg.keep.maxDeals);}

// 7) 保存の形と大きさ：v:1 のまま・180日 営業も交渉もすべてしても小さい
{const S=DC.newState(99,1);DC.migrate(cfg,cat,S,1,pl,['univ']);
  for(let d=1;d<=180;d++){if(d%2)DC.salesDo(cfg,S,d,'ws');if(d%3===0)DC.salesDo(cfg,S,d,'door');
    for(const o of DC.inbox(cfg,cat,S,d,1440,pl)){if(d%4===0)DC.negotiate(cfg,S,o,d,{up:0.05,qm:1},'keep');else DC.decide(cfg,S,o,d%3?'accept':'decline',d,'keep');}
    for(const c of S.deals){if(c.kind==='sell'&&!c.leg&&d>=c.from&&d<=c.to)DC.record(S,d,c.id,{q:100,s:d%5?100:90,short:d%5?0:10,profit:500},cfg);}
    for(const c of S.deals){if(DC.renewInfo(cfg,S,c,d)&&d%2)DC.renew(cfg,S,c.id,d);}DC.prune(cfg,S,d);}
  assert.ok(DC.valid(S));assert.equal(S.v,1);const kb=JSON.stringify(S).length/1024;console.log(`  180日 営業・交渉・更新をすべてしたあと：dia-deals ${kb.toFixed(1)}KB・契約 ${S.deals.length}件・相手 ${Object.keys(S.rep||{}).length}`);
  assert.ok(kb<14,'dia-deals が大きすぎる '+kb);
  // 足した欄がない古い保存（第3回まで）もそのまま動く
  const old={v:1,seed:5,d0:3,dec:{},deals:[]};assert.ok(DC.valid(old));assert.ok(Array.isArray(DC.inbox(cfg,cat,old,5,1440)));assert.equal(DC.repAll(cfg,old),cfg.rep.base);DC.prune(cfg,old,9);assert.deepEqual(Object.keys(old),['v','seed','d0','dec','deals']);}

// 8) 工場の収支の画面は取引先を選べない（窓口に移した）。窓口を読むファイルの約束は第2回のまま（deals-core.test の8）
{const t=require('node:fs').readFileSync(require('node:path').join(__dirname,'../js/factory-pl.js'),'utf8');assert.ok(!/type="checkbox" data-c=/.test(t),'工場の収支に取引先のチェックが残っている');}
console.log('deals-trust ok');
