// おにぎりの具を9種類に（港駅の売店をつくる回の6回目・2026-11-10）
//  1) 具は9種類。足した2つ（焼き鯖ほぐし・大きいおにぎり）は港駅の店だけ（share 0）。頼まれない夜の米のラインは前と同じ
//  2) 大きいおにぎりはご飯を1.5倍使う
//  3) 2店（緑ヶ丘＋港駅）の注文 → センターの合計 → 工場 → 納品書 → 店ごと・かご車
//  4) 切りかえと掃除・足りない夜を、具7種類のときと比べる（数字を表示）
const assert=require('node:assert/strict');
for(const f of ['factory-core','bread-core','sand-loaf','sand-core','donut-core','bento-core','center-core','factory-night','research-core','kiosk-staff','kiosk-walk','kiosk-core','minato-store-core'])require('../js/'+f+'.js');
const D=require('../data/factory.json'),K=require('../data/kiosk.json'),M=require('../data/minato-store.json'),C=require('../data/center.json');
const G=globalThis,F=G.FactoryCore,FN=G.FactoryNight,CC=G.CenterCore,mcfg=G.MinatoStore.cfg(K,M);
const FL=D.packLine.fillings,MP=Object.fromEntries(mcfg.products.map(p=>[p.id,p])),KP=Object.fromEntries(K.products.map(p=>[p.id,p]));

// 1)
assert.equal(FL.length,9,'具は9種類');
for(const f of FL){assert.ok(MP[f.kiosk]&&MP[f.kiosk].genre==='onigiri','港駅の店の品 '+f.kiosk);if(f.only==='minato'){assert.equal(f.share,0);assert.ok(!KP[f.kiosk],'緑ヶ丘の店にない品');}else assert.ok(KP[f.kiosk],'緑ヶ丘の店の品 '+f.kiosk);}
assert.deepEqual(FL.filter(f=>f.only).map(f=>f.kiosk).sort(),['oni_big','oni_yakisaba']);
for(const seed of [1,9])for(const season of ['winter','summer']){const s=F.simulate(D,{seed,season}).summary;assert.equal(s.fills.length,7,'頼まれない夜は7種類');assert.ok(s.fills.every(f=>!FL.find(x=>x.id===f.id).only));}
console.log('  具9種類（港駅の店だけ：焼き鯖ほぐし・大きいおにぎり）。頼まれない夜は7種類のまま');

// 2)
{const a=F.simulate(D,{seed:4,center:{oni_sake:600}}).summary,b=F.simulate(D,{seed:4,center:{oni_big:600}}).summary;
  assert.ok(b.batches>a.batches,'大きいおにぎりは釜が多く要る '+a.batches+' '+b.batches);
  const big=b.fills.find(f=>f.id==='soboro');assert.equal(big.order,600);}
console.log('  大きいおにぎり：同じ600個でも、鮭より釜が多く要る（ご飯1.5倍）');

// 3)
const lg=CC.emptyLog(),day=12;
CC.putOrder(K,C,lg,day,'M-home',{mode:'auto',items:{oni_sake:40,oni_tuna:30,oni_ume:12,dr_tea:20}},30);
CC.putOrder(mcfg,C,lg,day,'P-gate',{mode:'auto',items:{oni_sake:25,oni_tuna:18,oni_yakisaba:14,oni_big:12,bt_karaage:10,dr_tea:15}},30);
const d=lg.days.find(x=>x.day===day);
assert.deepEqual(d.factory.items,{oni_sake:65,oni_tuna:48,oni_ume:12,oni_yakisaba:14,oni_big:12,bt_karaage:10},'工場への発注は2店の合計（工場の品だけ）');
const night=FN.runNight(D,{},{day,no:d.factory.no,items:d.factory.items,season:'aut'});
assert.equal(night.rows.oni_big.line,'rice');assert.equal(night.rows.oni_yakisaba.line,'rice');assert.equal(night.rows.bt_karaage.line,'bento');
const sl=FN.slip(D,C,d,night);
assert.deepEqual(sl.stores['P-gate'].items.oni_big,[12,12]);assert.deepEqual(sl.stores['P-gate'].items.oni_sake,[25,25]);assert.deepEqual(sl.stores['M-home'].items.oni_sake,[40,40]);
assert.ok(!sl.stores['M-home'].items.oni_big,'緑ヶ丘の店には届かない');
const ct=CC.cart(mcfg,C,sl,'P-gate',null,null);let on=0;const bins=new Set();for(const b in ct.runs)for(const pid in ct.runs[b])if(pid==='oni_yakisaba'||pid==='oni_big'){on+=ct.runs[b][pid];bins.add(b);}
assert.equal(on,26,'かご車に新しい具がぜんぶ載る');assert.ok(bins.size>=2,'その日のうちに売る品なので便に分ける');
console.log('  2店の注文 → センターの合計 '+Object.values(d.factory.items).reduce((a,b)=>a+b,0)+'個 → 工場 → 納品書（店ごと）→ 港駅の店のかご車（'+[...bins].join('・')+'）');

// 4) 比べる（3季節×20夜）
const base={oni_sake:30,oni_tuna:24,oni_ume:12,oni_konbu:10,oni_mentai:10,oni_shio_n:16,oni_hesiko_n:16};
const nine={...base,oni_yakisaba:14,oni_big:12},seven={...base,oni_sake:37,oni_tuna:31,oni_hesiko_n:22,oni_shio_n:22};
const stat=c=>{let ch=0,cm=0,sn=0;for(const season of ['winter','mid','summer'])for(let seed=1;seed<=20;seed++){const s=F.simulate(D,{seed,season,center:c}).summary,x=s.lineStops[F.LN.CHANGE];ch+=x.n;cm+=x.min;if(s.short>0)sn++;}return {ch:ch/60,cm:cm/60,sn};};
const s7=stat(seven),s9=stat(nine);
assert.ok(s9.ch>s7.ch&&s9.cm>s7.cm,'具が増えると切りかえと掃除が増える');assert.ok(s9.sn>=s7.sn,'足りない夜は減らない');
console.log(`  比べる（同じ数を、7種類にのせる／9種類に分ける・60夜）：切りかえ ${s7.ch.toFixed(1)} → ${s9.ch.toFixed(1)}回/夜・掃除 ${s7.cm.toFixed(0)} → ${s9.cm.toFixed(0)}分/夜・足りない夜 ${s7.sn} → ${s9.sn}`);
console.log('minato-onigiri ok');
