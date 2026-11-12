// 沿線くらしアンケートの計算のテスト：同じ年・駅なら同じ答え、割合の合計は100%、人数が合う
const assert=require('assert'),S=require('../js/survey-core.js'),D=require('../data/survey.json');
const Y=S.years(D,new Date('2026-11-06T00:00:00+09:00'));assert.deepStrictEqual(Y[0],2019);assert.strictEqual(Y[Y.length-1],2026);
assert.strictEqual(S.years(D,new Date('2027-09-30T12:00:00+09:00')).slice(-1)[0],2026,'10月より前は前の年まで');
for(const q of D.questions)for(const id in D.areas)for(const y of [2019,2020,2026]){
  const a=S.wave(D,q,id,y),b=S.wave(D,q,id,y);assert.deepStrictEqual(a,b,'同じ答え');
  assert.strictEqual(a.counts.reduce((s,x)=>s+x,0),D.areas[id].n);assert.ok(Math.abs(a.pct.reduce((s,x)=>s+x,0)-100)<1e-6);
  assert.strictEqual(a.byAge.reduce((s,x)=>s+x.n,0),D.areas[id].n);}
const ai=D.questions.find(q=>q.id==='ai');assert.ok(S.total(D,ai,2026).pct[0]>S.total(D,ai,2023).pct[0]+20,'生成AIは増える');
console.log('survey-core ok');
