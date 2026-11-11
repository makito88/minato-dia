// ケーキドーナツのライン（2026-11-11 に置きかえ）：1個ずつ流れる計算のつじつま
//  ・品ごとに 作った数＝出荷＋だめ＋遅れ＋余り、出荷＋不足＝注文
//  ・①計量 → ②ミキサー → ③投入 の順で、計量の係・ミキサー・ホッパーの容量を守る。押し出しは1分に speed 個まで
//  ・コンベアなので追い越さない。箱は12個まで・同じ品だけ。箱に置いた数＝包んだ良い品。積んだ箱＝箱
//  ・どの時刻でも 押し出した＝ライン上＋はじいた＋包み終わった
const assert=require('node:assert/strict');
require('../js/donut-core.js');
const D=require('../data/factory.json'),K=require('../data/kiosk.json'),C=globalThis.DonutCore,B=D.donut;
const run=c=>C.simulate(D,c);
assert.deepEqual(run({seed:15}).summary,run({seed:15}).summary,'同じ夜は同じ');
let nights=0;
for(const season of Object.keys(D.seasons))for(let seed=1;seed<=12;seed++)for(const c of [{},{speed:6},{speed:20,boxers:1},{start:1320},{oilT:196}]){
 const r=run(Object.assign({season,seed},c)),s=r.summary;nights++;
 assert.equal(s.shipped+s.short,s.order);
 for(const p of s.prods){assert(K.products.some(k=>k.id===p.kiosk),'売店の品 '+p.kiosk);assert.equal(p.made,p.shipped+p.bad+p.late+p.surplus,'作った数 '+p.id);
   assert.equal(p.made,r.batches.filter(b=>b.prod===p.id).reduce((n,b)=>n+b.n,0));}
 let poured=0;
 r.batches.forEach((b,i)=>{assert(b.w1>b.w0&&b.m0>=b.w1&&b.m1>b.m0&&b.p0>=b.m1&&b.p1>b.p0,'順番 '+i);if(b.late)assert(b.w0>=D.orderConfirm);
   if(i){const a=r.batches[i-1];assert(b.w0>=a.m0-1e-9,'量った分がミキサーに入ってから次を量る');assert(b.m0>=a.p1-1e-9,'ミキサーは前の生地を入れ終わってから');}
   // ホッパー：入れる直前の量 + n ≦ 容量
   const out=C.upTo(r.dep,b.p0);assert(poured-out+b.n<=B.hopper+1e-9,'ホッパーの容量 '+i);poured+=b.n;assert(b.d0>=b.p1-1e-9,'入れてから押し出す');});
 for(let i=1;i<r.dep.length;i++){assert(r.dep[i]-r.dep[i-1]>=1/r.cfg.speed-1e-9,'押し出しの速さ');assert(r.pk[i]>=r.pk[i-1],'追い越さない');}
 const good=r.dep.length-s.bad;let placed=0;for(let i=0;i<r.dep.length;i++)if(!r.bad[i]){placed++;assert(r.pl[i]>=r.pk[i],'包んでから箱へ');}
 assert.equal(r.boxes.reduce((a,b)=>a+b.n,0),good,'箱に置いた数＝良い品');assert(r.boxes.every(b=>b.n>=1&&b.n<=B.box&&b.c1>b.c0),'1箱12個まで');
 for(let i=0;i<r.dep.length;i++)if(!r.bad[i])assert.equal(r.boxes[r.bx[i]].prod,r.pi[i],'箱は同じ品だけ');
 assert.equal(r.loads.length,r.boxes.length);r.loads.forEach((l,i)=>assert(l.l0>=r.boxes[i].c1-1e-9,'閉じてから積む'));
 for(const t of [r.T0,D.orderConfirm,r.T0+120,r.T0+240,r.T1]){const k=C.countsAt(r,t);assert.equal(k.dep,k.line+k.rej+k.pack);assert(k.placed<=k.pack&&k.loaded<=k.closed);}
 const y=s.yen;assert.equal(y.total,y.labor+y.material+y.oil+y.machine);
}
const a=run({seed:1});
assert(run({seed:1,speed:6}).summary.lastDone>a.summary.lastDone,'押し出しが遅いと終わりが遅い');
assert(run({seed:1,start:1320}).summary.short>=a.summary.short,'遅く始めると間に合わないことがある');
assert(run({seed:1,oilT:200}).summary.bad>a.summary.bad*5,'油が熱すぎると検査ではじく');
assert(run({seed:1,boxers:3}).summary.waits['箱詰め']<a.summary.waits['箱詰め'],'箱詰めの人を増やすと待ちが減る');
assert(run({seed:1,season:'summer'}).summary.lastDone>run({seed:1,season:'winter'}).summary.lastDone,'夏は冷ますのに時間がかかる');
const early=r=>r.batches.filter(b=>!b.late).map(b=>[b.prod,b.n,b.w0]);assert.deepEqual(early(a),early(run({seed:98})),'先の注文が見込みの分を変えない');
const snap=JSON.stringify(D);run({center:{don_sugar:30}});assert.equal(JSON.stringify(D),snap,'設定を変えない');
assert.equal(run({seed:2,center:{don_sugar:30,don_nama:10}}).summary.order-run({seed:2}).summary.order,40,'センターの分を足す');
assert.equal(run({speed:12.8}).cfg.speed,12,'整数');
console.log(`donut（ケーキドーナツ）：${nights}夜で、数のつじつま・順番・ホッパー・追い越しなし・箱・同じ夜は同じ`);
