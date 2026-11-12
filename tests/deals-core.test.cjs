// 取引の相談窓口 第1回（2026-11-12）：同じ条件なら同じ相談・保存の形と大きさ・見込みの計算・まだ工場や配送には効かない
const assert=require('node:assert/strict');
const DC=require('../js/deals-core.js');
const F=require('../data/factory.json'),K=require('../data/kiosk.json'),M=require('../data/minato-store.json'),cfg=require('../data/deals.json'),H=require('../data/haiso.json'),C=require('../data/center.json');
globalThis.BentoCore=globalThis.BentoCore||{};
const FN=require('../js/factory-night.js');
const pr=Object.fromEntries([...M.products,...K.products].map(p=>[p.id,p]));
const cat=DC.catalog(FN.kioskMap(F),pid=>pr[pid]);
// 1) 品の一覧：5本のラインすべてに品がある
for(const L of ['rice','bread','sand','donut','bento'])assert.ok((cat[L]||[]).length>0,'品の一覧に '+L);
// 2) 同じ種と運行日なら同じ相談。種がちがえば（たいてい）ちがう
const a=JSON.stringify(DC.offersOn(cfg,cat,777,12)),b=JSON.stringify(DC.offersOn(cfg,cat,777,12));assert.equal(a,b,'同じ条件なら同じ相談');
let diff=0;for(let d=1;d<=20;d++)if(JSON.stringify(DC.offersOn(cfg,cat,777,d))!==JSON.stringify(DC.offersOn(cfg,cat,778,d)))diff++;assert.ok(diff>10,'種がちがえば相談もちがう');
// 3) 相談の中身：数は1日0〜2件・時刻のはば・卸値は売店の仕入れ値より安い・名前は data の架空の相手
let n=0,sell=0,haul=0;const names=new Set(cfg.partners.map(p=>p.name));
for(let d=1;d<=200;d++){const os=DC.offersOn(cfg,cat,4242,d);assert.ok(os.length<=cfg.perDay.length-1);n+=os.length;
  for(const o of os){assert.ok(o.t>=cfg.arrive[0]&&o.t<=cfg.arrive[1]);assert.ok(names.has(o.name));assert.equal(o.exp,d+cfg.reply);
    if(o.kind==='sell'){sell++;assert.ok(o.items.length>=1&&o.items.length<=3);for(const i of o.items){assert.ok(i.price<i.ref,'卸値は仕入れ値より安い');assert.ok(i.wd>=10&&i.we>=0);}}
    else{haul++;assert.ok(o.carts>=0.5&&o.fare>0);assert.ok(cfg.stations[o.to]&&o.to!=='K');}}}
assert.ok(n>150&&n<260,'200日で相談 '+n+'件');assert.ok(sell>haul&&haul>30,'販売と配送の両方 '+sell+'/'+haul);
// 4) 受信箱と返事：保留は残る・断ると消える・引き受けると契約（次の運行日から・お試し7日）
const S=DC.newState(4242,10);assert.deepEqual(Object.keys(S),['v','seed','d0','dec','deals']);assert.equal(S.v,1);
let box=DC.inbox(cfg,cat,S,10,1440);assert.ok(box.length>0,'はじめから相談がある');
const late=DC.inbox(cfg,cat,S,10,0);assert.ok(late.every(o=>o.day<10),'まだ届いていない時刻の相談は出ない');
const o0=box[0];DC.decide(cfg,S,o0,'hold',10);box=DC.inbox(cfg,cat,S,10,1440);assert.equal(box.find(o=>o.id===o0.id).st2,'hold');
DC.decide(cfg,S,o0,'accept',10,'trial');assert.equal(S.deals.length,1);assert.equal(S.deals[0].from,11);assert.equal(S.deals[0].to,10+cfg.trial);
assert.ok(!DC.inbox(cfg,cat,S,10,1440).some(o=>o.id===o0.id),'引き受けた相談は受信箱から消える');
DC.decide(cfg,S,o0,'accept',10,'keep');assert.equal(S.deals.length,1,'二重に契約しない');
assert.equal(DC.stateOf(S.deals[0],10),'soon');assert.equal(DC.stateOf(S.deals[0],11),'on');assert.equal(DC.stateOf(S.deals[0],10+cfg.trial+1),'done');
// 5) 保存の大きさ：毎日すべて引き受けても、180日たっても小さい（引き継ぎコードに入る）
const S2=DC.newState(99,1);for(let d=1;d<=180;d++){for(const o of DC.inbox(cfg,cat,S2,d,1440))DC.decide(cfg,S2,o,d%3?'accept':'decline',d,'keep');DC.prune(cfg,S2,d);}
const kb=JSON.stringify(S2).length/1024;console.log(`  180日すべて返事したあと：dia-deals ${kb.toFixed(1)}KB・契約 ${S2.deals.length}件`);
assert.ok(kb<12,'dia-deals が大きすぎる');assert.ok(S2.deals.length<=cfg.keep.maxDeals);
// 6) 工場の見込み：空き＝のばせる分×速さ − ほかの契約。足りなければ締め切りをすぎる分
const Fx={lines:{rice:{order:6000,shipped:6000,short:0,lastDone:1530}},start:{rice:1110},deadline:1590,own:{rice:200}};
const S3=DC.newState(1,1),os={kind:'sell',id:'x',line:'rice',items:[{pid:'oni_ume',name:'梅',wd:300,we:100,price:100,ref:114}]};
let x=DC.sellOutlook(cfg,S3,os,Fx,1,false);assert.equal(x.spareMin,60);assert.ok(Math.abs(x.rate-6000/420)<1e-9);assert.equal(x.spare,Math.floor(6000/420*60));assert.equal(x.fit,'ok');
assert.equal(x.money.rev,30000);assert.equal(x.money.cost,Math.round(300*114*cfg.sell.lines.rice.cost));
x=DC.sellOutlook(cfg,S3,Object.assign({},os,{items:[{...os.items[0],wd:1200}]}),Fx,1,false);assert.equal(x.fit,'tight');assert.ok(x.overMin>0);
S3.deals.push({id:'y',kind:'sell',from:1,to:30,of:{line:'rice',items:[{wd:500,we:0}]}});x=DC.sellOutlook(cfg,S3,os,Fx,1,false);assert.equal(x.cm,500);assert.equal(x.spare,Math.floor(6000/420*60)-500,'引き受けた契約の分を差し引く');
assert.ok(DC.sellOutlook(cfg,S3,os,{lines:{}},1,false).na,'納品書がなければ「まだ」');
// 7) 配送の見込み：自社の店のあとに寄る・かご車の空き・間に合わなければ先に寄って店が遅れる・冷凍は港浜急送
const runs=[{leg:'cs',id:'A1',truck:'A',bin:'朝の便',depart:240,late:0,carts:6,cap:10,stops:[{key:'M-home',arrive:300}]}];
const P={runs,trucks:C.slip.trucks,H};
let h=DC.haulOutlook(cfg,{carts:2,to:'C',win:[330,420],cargo:'dry',dow:'all',fare:8000},P,false);
assert.equal(h.mode,'after');assert.equal(h.arrive,300+H.handleMin+Math.abs(25-55));assert.equal(h.help,false);assert.equal(h.ownDelay,0);
h=DC.haulOutlook(cfg,{carts:5,to:'C',win:[330,420],cargo:'dry',dow:'all',fare:8000},P,false);assert.equal(h.help,true,'かご車が足りなければ応援便');
h=DC.haulOutlook(cfg,{carts:1,to:'F',win:[250,320],cargo:'dry',dow:'all',fare:8000},P,false);assert.equal(h.mode,'first');assert.ok(h.ownDelay>=H.handleMin,'先に寄ると自社の店が遅れる');
h=DC.haulOutlook(cfg,{carts:1,to:'C',win:[330,420],cargo:'frozen',dow:'all',fare:8000},P,false);assert.equal(h.mode,'other');
h=DC.haulOutlook(cfg,{carts:1,to:'P',win:[330,420],cargo:'dry',dow:'all',fare:8000},P,false);assert.equal(h.mode,'none','便のないトラック');
// 8) 第1回の約束：窓口はまだ工場・配送・お金に何も渡さない（ほかの計算のファイルが DealsCore も dia-deals も読まない）
const fs=require('node:fs'),path=require('node:path');
for(const f of fs.readdirSync(path.join(__dirname,'../js')).filter(f=>f.endsWith('.js')&&!f.startsWith('deals-')&&f!=='center-view.js')){const t=fs.readFileSync(path.join(__dirname,'../js',f),'utf8');assert.ok(!/DealsCore|dia-deals|DealsView/.test(t),f+' が窓口を読んでいる');}
console.log('deals-core.test ok');
