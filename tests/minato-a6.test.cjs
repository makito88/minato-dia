// 港駅の売店アニメ A6（2026-11-11）：持ち物の絵・新しい客層の絵・電車まであと何分の時計（js/minato-store-anim.js・絵だけ）
//  ・絵の段取りを作っても計算の結果は変わらない・同じ結果から同じ絵（途中から見ても同じ）
//  ・絵だけの持ち物は客層ごとの一覧から・2つまで（夏の日傘とファンは夏だけ）
//  ・キャリーケース・シルバーカー・ベビーカーの人は、低い棚と乾物の棚のあいだ（せまい通路）を通らない
//  ・キャリーケースを入口の近くに置く人は、店にいた時間の中で置いて・取りに戻る。空き缶の人はまずごみ箱へ
//  ・駅の外から来た人・行く人はコンコースの端から出入りし、店の中を横切らない。入る前のしぐさは入口の外で
//  ・時計は急いでいる人だけ・あと4分より短いとき。市場帰りの人のしずくは、店員のモップか、乾いたら消える
const assert=require('node:assert/strict');
for(const f of ['research-core','kiosk-staff','kiosk-walk','kiosk-core','minato-store-core','minato-store-anim'])require('../js/'+f+'.js');
const K=require('../data/kiosk.json'),R=require('../data/research.json'),M=require('../data/minato-store.json');
const {KioskCore:KC,MinatoStore:MS,MinatoAnim:A}=globalThis;
const c=MS.cfg(K,M),H=KC.H,a=new Array(H).fill(0).map((_,h)=>h>=5&&h<24?(h>=7&&h<9||h>=17&&h<19?400:150):0),fl=[a,a.map(x=>x*0.3),a.map(x=>x*0.2),a.map(x=>x*0.3)];
const MAP_EXIT=A.MAP.exit[0],PR=c.walk.anim.props;
let nWide=0,nPark=0,nCan=0,nTown=0,nPrep=0,nClock=0,nDrip=0,nMop=0,summer=0;
for(const [day,wx,season,staff] of [[2,'sun','sum',1],[4,'rain','aut',2],[9,'sun','sum',2]]){
  const st=MS.create(K,M,KC,{seed:5,day:1,staff});
  const ctx={day,dow:day%7,cond:{day:'wd',wx,season},flows:{hb:fl,ha:fl},stops:new Array(H).fill(4),plats:2,rcfg:R,order:st.order,express:[],addOn:[],edits:[],startT:0};
  const res=KC.simulate(c,st,ctx),before=JSON.stringify(res);
  const acts=A.build(res,c,st.layout),P=A.plan(res,c,acts,st.layout);
  assert.equal(JSON.stringify(res),before,'絵の段取りで計算の結果は変わらない');
  const acts2=A.build(res,c,st.layout);assert.equal(JSON.stringify(acts.map(x=>[x.pr,x.gate,x.gout,x.inL,x.park,x.canT])),JSON.stringify(acts2.map(x=>[x.pr,x.gate,x.gout,x.inL,x.park,x.canT])),'同じ結果から同じ持ち物と道');
  for(const x of acts){if(x.kind!=='buy')continue;const L=x.pr.L,okL=(PR.ps[x.ps]||[]).map(q=>q[0]).concat(Object.keys(PR.summer),['suitcase']);
    assert.ok(L.every(k=>okL.includes(k)),'客層の一覧にある持ち物だけ '+x.ps+' '+L);
    if(season!=='sum')assert.ok(!L.includes('parasol')&&!L.includes('fan'),'日傘とファンは夏だけ');else if(L.includes('parasol')||L.includes('fan'))summer++;
    assert.ok(L.filter(k=>!PR.summer[k]&&k!=='suitcase').length<=PR.max,'絵だけの持ち物は2つまで');
    if(x.pr.wide){nWide++;for(const W of [x.walk,x.after])for(let i=1;i<W.length;i++){const p=W[i-1],q=W[i];assert.ok(!(Math.abs(p.x-340)<1&&Math.abs(q.x-340)<1&&Math.abs(p.y-q.y)>5),'広い通路だけ（x=340 を縦に通らない）');}}
    if(x.park){nPark++;assert.ok(x.park[0]>=x.ta-1e-9&&x.park[1]<=x.tq+1e-9&&x.park[0]<x.park[1],'置いて・取りに戻るのは店にいた時間の中');}
    if(x.canT!=null){nCan++;assert.ok(x.canT>=x.ta&&x.canT<=x.tq,'空き缶は店にいた時間の中で捨てる');assert.ok(x.stops.some(r=>r.kind==='trash'),'ごみ箱に寄る');}
    if(x.gate[0]<200){nTown++;assert.ok(x.inL,'駅の外から来た人');}
    if(x.pr.prep)nPrep++;}
  // 時刻ごとの絵
  const PREP=x=>x.pr&&x.pr.prep;
  for(let t=5*60;t<23.5*60;t+=0.2){const L=A.at(acts,t,40);
    for(const o of L){const x=o.a;
      if(o.clock!=null){nClock++;assert.ok(x.hurry,'時計は急いでいる人だけ');assert.ok(o.clock>=0&&o.clock<(PR.clock.show),'あと4分より短いとき');}
      if(o.prep){assert.ok(PREP(x)&&o.prep===x.pr.prep.kind,'入る前のしぐさ');assert.ok(o.y>456,'入る前のしぐさは入口の外 '+o.y);}
      if(o.ph==='gone'&&x.gout&&x.gout[0]<200&&o.x<MAP_EXIT-30)assert.ok(o.y>=456,'駅の外へ行く人は店の中を横切らない '+o.x+','+o.y);
      if(o.ph==='in'&&x.gate[0]<200&&!o.prep)assert.ok(o.y>=436,'駅の外から来る人はコンコースを歩く');
      if(o.parked)assert.ok(x.park&&t>=x.park[0]&&t<x.park[1]);}}
  // 床のしずく → モップ
  for(const d of P.drips){nDrip++;const x=acts.find(y=>y.id===d.a);assert.ok(x&&x.pr.drip,'長靴・濡れたタオルの人');assert.ok(d.pts.every(p=>p.y<=460&&p.x>=30&&p.x<=970),'しずくは店の床');
    assert.ok(d.t1<=d.dry+1e-9,'拭くか、乾いたら消える');if(d.t1<d.dry-1e-9)nMop++;}
  for(const x of acts)if(x.kind==='buy'&&x.pr.drip)assert.ok(P.drips.some(d=>d.a===x.id),'しずくの人はしずくを残す');
}
console.log(`A6：広い通路だけ${nWide}・キャリーケースを置く${nPark}・空き缶をごみ箱へ${nCan}・駅の外から${nTown}・入る前のしぐさ${nPrep}・夏の日傘とファン${summer}・時計（コマ）${nClock}・しずく${nDrip}（モップで拭いた${nMop}）`);
assert.ok(nWide>0&&nCan>0&&nTown>0&&nPrep>0&&nClock>0&&nDrip>0&&nMop>0&&summer>0,'どれも出る');
console.log('minato-a6 ok');
