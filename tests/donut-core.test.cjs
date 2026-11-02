const assert=require('node:assert/strict');
const fs=require('node:fs');
require('../js/donut-core.js');
const D=require('../data/factory.json'),K=require('../data/kiosk.json'),C=globalThis.DonutCore;
const run=c=>C.simulate(D,c);
assert.deepEqual(run({seed:15}),run({seed:15}),'same night is reproducible');
for(const season of Object.keys(D.seasons))for(let seed=1;seed<=20;seed++){
 const r=run({season,seed});
 assert.equal(r.summary.shipped+r.summary.short,r.summary.order);
 for(const p of r.summary.prods){assert(K.products.some(k=>k.id===p.kiosk));const made=r.batches.filter(b=>b.prod===p.id).reduce((n,b)=>n+b.n,0);assert.equal(made,p.shipped+p.bad+p.late+p.surplus);}
 for(const b of r.batches){for(const s of b.steps)assert(s.end>=s.start);assert(b.expire>b.done);if(b.late)assert(b.mix>=D.orderConfirm);}
 for(let slot=0;slot<r.cfg.fryers;slot++){
  const bs=r.batches.filter(b=>b.slot===slot).sort((a,b)=>a.fry-b.fry);
  for(let i=1;i<bs.length;i++){const prev=bs[i-1].steps.find(s=>s.label==='揚げる');assert(bs[i].fry>=prev.end,'fryer double-booking');}
 }
 const y=r.summary.yen;assert.equal(y.total,y.labor+y.material+y.oil+y.machine);
}
const a=run({seed:1}),slow=run({seed:1,finishers:1}),late=run({seed:1,start:1320});
assert(slow.summary.lastDone>a.summary.lastDone,'fewer finishers delay completion');
assert(late.summary.short>0,'late start misses dispatch');
assert(run({oilT:195}).summary.bad>a.summary.bad,'overheated oil rejects product');
assert(run({fryers:1,oilEvery:2400}).batches.some(b=>b.why.some(w=>w.includes('油で風味'))),'old oil affects quality');
assert.deepEqual(a.batches.filter(b=>b.mix<D.orderConfirm).map(b=>[b.prod,b.n,b.mix]),run({seed:98}).batches.filter(b=>b.mix<D.orderConfirm).map(b=>[b.prod,b.n,b.mix]),'future orders cannot change early forecast');
const snapshot=JSON.stringify(D);run({});assert.equal(JSON.stringify(D),snapshot,'configuration is immutable');
assert.equal(run({fryers:2.8}).cfg.fryers,2,'integer machine count');
console.log('donut: 60 nights, conservation, resources, quality, deadline, determinism passed');
