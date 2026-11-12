// グループの収支（第3段・2026-11-12）：MoneyCore.groupLedger
//  ・会社の間のお金は払った側と受け取った側で同じ → グループのもうけ＝外から−外へ＝会社ごとのもうけの合計
//  ・センターの決まった費用・配送会社の便は、店がいくつあっても1回だけ
//  ・できたての便の品は工場から直接（センターを通らない）・運賃は配送会社へ
const assert=require('node:assert/strict');require('../js/money-core.js');const M=require('../data/money.json');const MC=globalThis.MoneyCore;
const cost=pid=>({a:100,b:50,c:80}[pid]||0),route=pid=>({a:'factory',b:'center',c:'factory'}[pid]);
const st=(id,k)=>({id,name:id,sales:100000*k,pl:{staff:20000*k,rent:3000,util:1500,sameday:id==='P'?2400:0},delivered:{a:100*k,b:200*k},sd:id==='P'?{c:8}:{},runs:3,route,cost});
const hz={runs:[{leg:'fc',company:'haiso',payer:'factory',fare:3000,cost:900},{leg:'cs',company:'haiso',payer:'center',fare:5000,cost:1200},{leg:'cs-extra',company:'other',payer:'center',fee:7000}],sum:{truckDay:4000,labor:9000}};
const L=MC.groupLedger(M,{day:5,stores:[st('M',1),st('P',2)],haiso:hz,take:0.15});
const sumNet=Object.values(L.co).reduce((t,c)=>t+c.net,0);
assert.equal(sumNet,L.ext.net,'会社ごとのもうけの合計＝グループのもうけ');
assert.equal(L.ext.in,300000,'外から入った＝2店の売上');
const grp=L.inv.filter(x=>x.from!=='ext'&&x.to!=='ext').reduce((t,x)=>t+x.yen,0);assert.equal(L.grp,grp,'会社の間のお金');
for(const k in L.co){const c=L.co[k];assert.equal(c.in,c.inExt+c.inGrp);assert.equal(c.out,c.outExt+c.outGrp);}
assert.equal(Object.values(L.co).reduce((t,c)=>t+c.inGrp,0),L.grp,'受け取った会社の間のお金＝払った会社の間のお金');
assert.equal(Object.values(L.co).reduce((t,c)=>t+c.outGrp,0),L.grp);
assert.equal(L.inv.filter(x=>x.what.startsWith('倉庫の家賃')).length,1,'センターの建物は1回');
assert.equal(L.inv.filter(x=>x.what==='燃料・運転手・トラック').length,1,'配送会社の費用は1回');
assert.equal(L.inv.find(x=>x.what==='燃料・運転手・トラック').yen,900+1200+4000+9000,'燃料＋トラック＋運転手');
assert.ok(L.inv.some(x=>x.from==='store:P'&&x.to==='factory'&&x.yen===640),'できたての便の品は工場へ直接');
assert.ok(L.inv.some(x=>x.from==='store:P'&&x.to==='haiso'&&x.yen===2400),'できたての便の運賃は配送会社へ');
assert.ok(!L.inv.some(x=>x.from==='store:M'&&x.to==='factory'),'緑ヶ丘はできたての便なし');
// 1店だけでも動く
const L1=MC.groupLedger(M,{day:5,stores:[st('M',1)],haiso:hz});assert.equal(Object.values(L1.co).reduce((t,c)=>t+c.net,0),L1.ext.net);
console.log('money-group ok（グループのもうけ',L.ext.net,'円・会社の間',L.grp,'円）');
