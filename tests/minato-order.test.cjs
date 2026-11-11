// 港駅の売店アニメの S1（2026-11-11）：港駅の店の発注をおまかせに（js/minato-store-core.js の omInit・omRecord・omOrder）
//  ・数の決め方は緑ヶ丘のおまかせと同じ CenterCore.plan。記録は港駅の店の状態の om（{v:1,...}・直近30日・pre は最後の1日だけ）
//  ・1日に1回だけ決める／自分で決めるときは数を変えない／新聞・雑誌・たばこは店の数のまま／記録がない日は、いまの数のまま
//  ・14日（晴れと雨・平日と土日）で、前（はじめの数のまま）と後（おまかせ）を比べる：おにぎり・サンドの売り切れで逃した数が大きく減り、廃棄は増えすぎない
//  ・dia-orders・センター・工場には書かない（緑ヶ丘の店の指紋は tests/minato-store.test.cjs が確かめる）
const assert=require('node:assert/strict');
for(const f of ['research-core','kiosk-staff','kiosk-walk','kiosk-core','minato-store-core','center-core'])require('../js/'+f+'.js');
const K=require('../data/kiosk.json'),R=require('../data/research.json'),M=require('../data/minato-store.json'),C=require('../data/center.json');
const {KioskCore:KC,MinatoStore:MS,CenterCore:CC}=globalThis;
const c=MS.cfg(K,M),I=KC.index(c);
const H=KC.H,a=new Array(H).fill(0).map((_,h)=>h>=5&&h<24?(h>=7&&h<9||h>=17&&h<19?400:150):0),fl=[a,a.map(x=>x*0.3),a.map(x=>x*0.2),a.map(x=>x*0.3)];
const ctxOf=(st,day)=>({day,dow:day%7,cond:{day:day%7===0?'hol':day%7===6?'sat':'wd',wx:day%5===0?'rain':'sun',season:'aut'},flows:{hb:fl,ha:fl},stops:new Array(H).fill(4),plats:2,rcfg:R,order:st.order,express:[],addOn:[],edits:[],startT:0});
const DAYS=14,FROM=5;   // 比べるのは5日目から（はじめの数日は記録が少なく、いまの数と混ぜるため）
function run(auto,aim){let st=MS.create(K,M,KC,{seed:3,day:1});if(auto){MS.omInit(st,C);st.om.aim=aim||'mid';}
  const g={},tot={sales:0,gp:0,waste:0,lost:0},orders=[];
  for(let d=1;d<=DAYS;d++){const cx=ctxOf(st,d);if(auto){MS.omOrder(c,CC,KC,C,st,d,cx.cond);assert.equal(MS.omOrder(c,CC,KC,C,st,d,cx.cond),null,'1日に1回だけ');}
    cx.order=st.order;orders.push({...st.order});const res=KC.simulate(c,st,cx);
    if(d>=FROM){tot.sales+=res.pl.sales;tot.gp+=res.pl.sales-res.pl.cogs-res.pl.waste;tot.waste+=res.pl.waste;
      const add=(o,k)=>{for(const pid in o){const ge=I.P[pid].genre,x=g[ge]||(g[ge]={sold:0,lost:0,waste:0});x[k]+=o[pid];if(k==='lost')tot.lost+=o[pid];}};
      add(res.sold,'sold');add(res.lostSO,'lost');add(res.wasteBy,'waste');}
    if(auto)MS.omRecord(c,CC,st,res);st=KC.closeDay(c,st,res).state;}
  return {g,tot,st,orders};}

// 1) 形と決まり
{const st=MS.create(K,M,KC,{seed:3,day:1}),o=MS.omInit(st,C);
  assert.deepEqual(Object.keys(o).sort(),['aim','day','mode','recs','v']);assert.equal(o.v,1);assert.equal(o.mode,'auto','新しい店は最初からおまかせ');assert.equal(o.aim,'mid');
  assert.equal(MS.omInit(st,C),o,'2回目は同じもの');
  const before={...st.order},p=MS.omOrder(c,CC,KC,C,st,1,{day:'wd',wx:'sun',season:'aut'});
  assert.ok(p,'数を決めた');assert.deepEqual(st.order,before,'記録がない日は、いまの数のまま');
  const s2=MS.create(K,M,KC,{seed:3,day:1});MS.omInit(s2,C,'self');const b2={...s2.order};assert.equal(MS.omOrder(c,CC,KC,C,s2,1,{day:'wd',wx:'sun',season:'aut'}),null);assert.deepEqual(s2.order,b2,'自分で決めるときは変えない');
  const s3=MS.create(K,M,KC,{seed:3,day:1});assert.equal(MS.omOrder(c,CC,KC,C,s3,1,{day:'wd',wx:'sun',season:'aut'}),null,'om がなければ何もしない');}

// 2) 14日の前と後
const A=run(false),B=run(true),B2=run(true);
assert.equal(JSON.stringify(B.orders),JSON.stringify(B2.orders),'同じ条件なら同じ数');
for(const o of B.orders.slice(1)){for(const pid in o){const ge=I.P[pid].genre;if(CC.routeOf(C,ge,pid)==='direct')assert.equal(o[pid],B.orders[0][pid],'店の数のまま（新聞・雑誌・たばこ）'+pid);}}
assert.ok(B.orders.some((o,i)=>i>0&&Object.keys(o).some(pid=>o[pid]!==B.orders[0][pid])),'おまかせで数が変わる');
const om=B.st.om;assert.equal(om.recs.length,DAYS);assert.ok(om.recs.every(r=>r.store==='P-gate'),'港駅の店の記録だけ');
assert.equal(om.recs.filter(r=>r.pre).length,1,'pre は最後の1日だけ');assert.equal(om.recs.at(-1).day,DAYS);assert.ok(om.recs.at(-1).pre);
assert.ok(JSON.stringify(om).length<60000,'保存が大きすぎない '+JSON.stringify(om).length);
const lost=(X,ge)=>(X.g[ge]||{}).lost||0;
for(const ge of ['onigiri','sand'])assert.ok(lost(B,ge)<=lost(A,ge)*0.7,ge+' の売り切れで逃した数が大きく減る '+lost(A,ge)+' → '+lost(B,ge));
assert.ok(B.tot.waste<=A.tot.waste*1.3,'廃棄が増えすぎない '+Math.round(A.tot.waste)+' → '+Math.round(B.tot.waste));
assert.ok(B.tot.gp>=A.tot.gp*0.95,'粗利が大きく減らない '+Math.round(A.tot.gp)+' → '+Math.round(B.tot.gp));
const S=run(true,'soldout'),W=run(true,'waste');
assert.ok(lost(S,'onigiri')<lost(B,'onigiri')&&lost(B,'onigiri')<lost(W,'onigiri'),'ねらい：売り切れを少なく < その間 < 廃棄を少なく（おにぎりの逃した数）');
assert.ok(S.tot.waste>B.tot.waste&&B.tot.waste>W.tot.waste,'ねらい：廃棄は逆の順');
const r=x=>Math.round(x).toLocaleString('ja-JP');
console.log(`  港駅の店の${FROM}〜${DAYS}日目（前＝はじめの数のまま → 後＝おまかせ「その間」）`);
console.log(`   売上 ${r(A.tot.sales)} → ${r(B.tot.sales)}・粗利（売上−原価−廃棄）${r(A.tot.gp)} → ${r(B.tot.gp)}・廃棄 ${r(A.tot.waste)} → ${r(B.tot.waste)}円・売り切れで逃した ${A.tot.lost} → ${B.tot.lost}人`);
for(const ge of ['onigiri','sand','donut','bread','bento','gummy','hot']){const x=A.g[ge]||{},y=B.g[ge]||{};console.log(`   ${ge}: 売れた ${x.sold||0} → ${y.sold||0}・逃した ${x.lost||0} → ${y.lost||0}・廃棄 ${x.waste||0} → ${y.waste||0}`);}
console.log(`   ねらい「廃棄を少なく」：粗利 ${r(W.tot.gp)}・廃棄 ${r(W.tot.waste)}・逃した ${W.tot.lost}／「売り切れを少なく」：粗利 ${r(S.tot.gp)}・廃棄 ${r(S.tot.waste)}・逃した ${S.tot.lost}`);
console.log('minato-order ok');
