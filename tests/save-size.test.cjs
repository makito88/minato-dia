// 保存の大きさ（2026-11-09）：60運行日つづけても、新しい保存（dia-orders・dia-center・dia-money）が決めた大きさに収まる
//  ブラウザの保存（localStorage）は、ふつう 1つのサイトで約5MB（文字数）まで。ゲーム全体で 2MB 以内を目安にする
const assert=require('node:assert/strict');
const {run}=require('./chain.test.cjs');
for(const f of ['haiso-core','money-core'])require('../js/'+f+'.js');
const K=require('../data/kiosk.json'),C=require('../data/center.json'),H=require('../data/haiso.json'),M=require('../data/money.json');
const {CenterCore:CC,HaisoCore:HC,MoneyCore:MC}=globalThis;
const R=run(60);
const last=R.at(-1);
// dia-orders（30日分を残す）と dia-center（記録21日・発注12件）
const kb=o=>JSON.stringify(o).length/1024;
const csKB=kb(last.cs);
// dia-money：1日のまとめ×35日（1日ぶんの大きさ×35 で見積もる）
const P=Object.fromEntries(K.products.map(p=>[p.id,p])),L=MC.dayLedger(M,{day:1,sales:50000,pl:{staff:1,rent:1},delivered:Object.fromEntries(K.products.map(p=>[p.id,5])),route:pid=>CC.routeOf(C,P[pid].genre),cost:pid=>P[pid].cost,haiso:HC.dayPlan(H,C,CC,{day:1,cond:null,slip:null,stores:[{key:'M-home',runs:[{bin:'朝の便',f:100,c:100}]}]})});
const moneyKB=kb(L)*(M.keepDays||35);
console.log(`  60日つづけたあと：dia-center ${csKB.toFixed(1)}KB・dia-money 約${moneyKB.toFixed(1)}KB（35日分）`);
assert.ok(last.cs.log.length<=21,'倉庫の記録は21日まで');assert.ok(last.cs.po.length<=12,'発注の記録は12件まで');
assert.ok(csKB<40,'dia-center が大きすぎる');assert.ok(moneyKB<120,'dia-money が大きすぎる');
console.log('save-size.test ok');
