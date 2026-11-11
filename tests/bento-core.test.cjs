// お弁当のライン（工場の5本目・港駅の売店をつくる回の5回目・2026-11-10）
//  1) 一晩の計算：同じ条件なら同じ・数のつじつま・機械の重なりなし・消費期限・締め切り・設定を変えない
//  2) ほかの4ライン（米・パン・サンド・ドーナッツ）の結果は前と同じ（指紋 OTHERS。お弁当の計算を読みこんでも変わらない）
//  3) センターの注文 → 工場（お弁当のライン）→ 納品書 → かご車（チルド・朝／昼前／午後の便）の流れに乗る。ゆでたまごは問屋の品のまま
const assert=require('node:assert/strict'),crypto=require('node:crypto');
for(const f of ['factory-core','bread-core','sand-loaf','sand-core','donut-core','bento-core','center-core','factory-night','research-core','kiosk-staff','kiosk-walk','kiosk-core','minato-store-core'])require('../js/'+f+'.js');
const D=require('../data/factory.json'),K=require('../data/kiosk.json'),M=require('../data/minato-store.json'),C=require('../data/center.json');
const G=globalThis,BC=G.BentoCore,FN=G.FactoryNight,CC=G.CenterCore;
const run=c=>BC.simulate(D,c);

// 1) 一晩
assert.deepEqual(run({seed:15}),run({seed:15}),'同じ夜は同じ');
const mcfg=G.MinatoStore.cfg(K,M),MP=Object.fromEntries(mcfg.products.map(p=>[p.id,p]));
for(const season of Object.keys(D.seasons))for(let seed=1;seed<=12;seed++)for(const extra of [{},{chillers:1,center:{bt_karaage:30,bt_saba:20,bt_nori:20}},{start:1140}]){
  const r=run({season,seed,...extra}),s=r.summary;
  assert.equal(s.shipped+s.short,s.order,'出荷＋不足＝注文');
  for(const p of s.prods){assert.ok(MP[p.kiosk]&&MP[p.kiosk].genre==='bento','港駅の店の品 '+p.kiosk);
    const made=r.batches.filter(b=>b.prod===p.id).reduce((n,b)=>n+b.n,0);assert.equal(made,p.shipped+p.bad+p.late+p.surplus,'作った数のつじつま '+p.id);}
  for(const b of r.batches){for(const x of b.steps)assert.ok(x.end>=x.start);assert.ok(b.expire>b.done,'消費期限は包装のあと');assert.ok(b.okazu>=b.at&&b.fill>=b.okazu&&b.chill>=b.fill&&b.done>b.chill,'工程の順');}
  for(const k of Object.keys(D.bento.machines)){const bs=r.batches.filter(b=>b.mach===k).sort((a,b)=>a.okazu-b.okazu);
    for(let i=1;i<bs.length;i++){const pe=bs[i-1].steps.find(x=>x.label==='揚げる'||x.label==='焼く');assert.ok(bs[i].okazu>=pe.end,'おかずの機械が重なった '+k);}}
  for(let c=0;c<r.cfg.chillers;c++){const bs=r.batches.filter(b=>b.chiller===c).sort((a,b)=>a.chill-b.chill);for(let i=1;i<bs.length;i++)assert.ok(bs[i].chill>=bs[i-1].chill+r.chillMin,'急速冷却が重なった');}
  const y=s.yen;assert.equal(y.total,y.labor+y.material+y.chill+y.machine);}
const a=run({seed:1}),one=run({seed:1,chillers:1}),late=run({seed:1,start:1380,chillers:1,center:{bt_karaage:60,bt_saba:40,bt_nori:40}});
assert.equal(a.summary.short,0,'いつもの条件なら2:30に間に合う');
assert.ok(one.summary.lastDone>a.summary.lastDone,'急速冷却が1台だと遅くなる');
assert.equal(one.summary.neck[0],'急速冷却','急速冷却が1台なら、いちばん待つのは急速冷却');
assert.ok(late.summary.short>0,'遅く始めて冷却1台・注文が多いと、締め切りに間に合わない');
assert.ok(run({seed:1,season:'summer'}).chillMin>run({seed:1,season:'winter'}).chillMin,'夏は冷えるのに時間がかかる');
assert.deepEqual(run({start:1140,seed:1}).batches.filter(b=>!b.late&&b.at<D.orderConfirm).map(b=>[b.prod,b.n]),run({start:1140,seed:77}).batches.filter(b=>!b.late&&b.at<D.orderConfirm).map(b=>[b.prod,b.n]),'先の注文が見込みの分を変えない');
const snap=JSON.stringify(D);run({center:{bt_karaage:5}});assert.equal(JSON.stringify(D),snap,'設定を変えない');
{const c=run({seed:2,center:{bt_karaage:12,bt_saba:7}}).summary;const b=run({seed:2}).summary;
  assert.equal(c.order-b.order,19,'センターの分を足す');assert.equal(c.center,19);}
console.log('  お弁当のライン：3季節×12夜×3条件で、数のつじつま・機械の重なりなし・消費期限・締め切り・同じ夜は同じ');

// 2) ほかのラインは前と同じ（5回目の前に作った指紋）。ドーナッツは 2026-11-11 にケーキドーナツのラインへ置きかえたので、指紋から外した（米・パン・サンドと、納品書のうちドーナッツ以外）
const out=[];
for(const c of ['FactoryCore','BreadCore','SandCore'])for(const season of ['winter','mid','summer'])for(const seed of [1,7,42])out.push(JSON.stringify(G[c].simulate(D,{seed,season}).summary));
const items={oni_sake:40,oni_tuna:30,san_mix:12,pan_melon:9,dr_tea:20};
// 原材料（第5回）で足した欄（品ごとに作った数 mk・米の釜 pots・はじいた数 rej・自社の食パン own）は、結果を写しただけなので、くらべる前に外す
const noMat=n=>{delete n.lines.donut;for(const L in n.lines){const x=n.lines[L];delete x.mk;delete x.pots;delete x.rej;delete x.own;}return n;};
for(const day of [3,4])out.push(JSON.stringify(noMat(FN.runNight(D,{rice:{},bread:{},sand:{},donut:{}},{day,no:'F1',items,season:'aut'}))));
const OTHERS='c603405d36b6e778',fp=crypto.createHash('sha256').update(out.join('|')).digest('hex').slice(0,16);
assert.equal(fp,OTHERS,'ほかのラインの結果が変わった');
console.log('  ほかの4ライン：結果と、緑ヶ丘の品だけの夜の納品の計算が前と同じ（指紋 '+fp+'）');

// 3) 流れに乗る
assert.equal(CC.routeOf(C,'bento','bt_karaage'),'factory');assert.equal(CC.routeOf(C,'bento','bt_egg'),'center','ゆでたまごは問屋の品');assert.equal(CC.routeOf(C,'onigiri','oni_sake'),'factory');
const map=FN.kioskMap(D);for(const id of ['bt_karaage','bt_saba','bt_nori'])assert.equal(map[id].line,'bento');assert.ok(!map.bt_egg);
const day={day:9,orders:{'M-home':{no:'O0009-M-home',factory:{oni_sake:30,san_mix:6}},'P-gate':{no:'O0009-P-gate',factory:{oni_sake:20,bt_karaage:14,bt_saba:9,bt_nori:8,bt_egg:6}}},factory:{no:'F0009',items:{oni_sake:50,san_mix:6,bt_karaage:14,bt_saba:9,bt_nori:8,bt_egg:6}}};
const night=FN.runNight(D,{},{day:9,no:'F0009',items:day.factory.items,season:'aut'});
assert.ok(night.lines.bento,'お弁当のラインが回った');assert.equal(night.rows.bt_karaage.line,'bento');assert.equal(night.stock.bt_egg,6,'ゆでたまごはセンター在庫の品');
const sl=FN.slip(D,C,day,night),pg=sl.stores['P-gate'];
assert.deepEqual(pg.items.bt_karaage,[14,14]);assert.deepEqual(pg.items.bt_saba,[9,9]);assert.ok(!sl.stores['M-home'].items.bt_karaage,'緑ヶ丘の店には届かない');
const ct=CC.cart(mcfg,C,sl,'P-gate',null,null);
const by={};for(const b in ct.runs)for(const pid in ct.runs[b])if(pid.startsWith('bt_'))by[b]=(by[b]||0)+ct.runs[b][pid];
assert.equal(Object.values(by).reduce((x,y)=>x+y,0),31,'かご車にお弁当がぜんぶ載る');
assert.ok(by['朝の便']>0&&by['昼前の便']>0&&by['午後の便']>0,'お弁当は朝・昼前・午後の便に分ける '+JSON.stringify(by));
assert.equal(C.track.temps.bento,'チルド（5℃）');assert.ok(C.track.lines.bento);
// 緑ヶ丘の店だけの夜は、お弁当のラインを納品書に載せない（dia-orders の形は前と同じ）
assert.ok(!FN.runNight(D,{},{day:3,no:'F1',items,season:'aut'}).lines.bento);
// BentoCore を読みこんでいないページでは、お弁当は工場の品にしない
{const keep=G.BentoCore;delete G.BentoCore;try{assert.ok(!FN.kioskMap(D).bt_karaage);}finally{G.BentoCore=keep;}}
console.log('  流れ：センターの注文 → お弁当のライン → 納品書 → かご車（朝 '+by['朝の便']+'・昼前 '+by['昼前の便']+'・午後 '+by['午後の便']+'）。ゆでたまごは問屋の品のまま');
console.log('bento ok');
