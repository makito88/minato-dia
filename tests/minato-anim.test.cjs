// 港駅の売店 3回目（絵の第1段）（2026-11-10）
//  ・絵の段取り（js/minato-store-anim.js）は、計算の出来事から人を作るだけ：人の数＝買った人＋見て帰った人（出来事を足さない）
//  ・人の場所はゲームの時刻だけで決まる（同じ時刻なら同じ。途中から見ても同じ）・店の床と改札口の帯の中にいる
//  ・同時に描く人数の上限（こえた分は点）・イートインの人は席へ・列の人は列の並びに
//  ・絵の段取りを作っても、計算の結果（res）は変わらない
const assert=require('node:assert/strict');
for(const f of ['research-core','kiosk-staff','kiosk-walk','kiosk-core','minato-store-core','minato-store-anim'])require('../js/'+f+'.js');
const K=require('../data/kiosk.json'),R=require('../data/research.json'),M=require('../data/minato-store.json');
const {KioskCore:KC,MinatoStore:MS,MinatoAnim:A}=globalThis;
const c=MS.cfg(K,M),H=KC.H,a=new Array(H).fill(0).map((_,h)=>h>=5&&h<24?(h>=7&&h<9||h>=17&&h<19?400:150):0),fl=[a,a.map(x=>x*0.3),a.map(x=>x*0.2),a.map(x=>x*0.3)];
const st=MS.create(K,M,KC,{seed:3,day:1});
const ctx={day:2,dow:2,cond:{day:'wd',wx:'sun',season:'aut'},flows:{hb:fl,ha:fl},stops:new Array(H).fill(4),plats:2,rcfg:R,order:st.order,express:[],addOn:[],edits:[],startT:0};
const res=KC.simulate(c,st,ctx),before=JSON.stringify(res);
const acts=A.build(res,c,st.layout),acts2=A.build(res,c,st.layout);
assert.equal(JSON.stringify(acts),JSON.stringify(acts2),'同じ結果から同じ人');
assert.equal(JSON.stringify(res),before,'絵の段取りで計算の結果は変わらない');
const nBuy=res.ev.filter(e=>e.k==='buy').length,nLook=res.ev.filter(e=>e.k==='look').length;
assert.equal(acts.filter(x=>x.kind==='buy').length,nBuy,'買った人の数');
assert.equal(acts.filter(x=>x.kind!=='buy').length,nLook,'見て帰った人の数');
// イートイン：席についた出来事は、どれも買った人につながる
const nEat=res.ev.filter(e=>e.k==='eatin').length,linked=acts.filter(x=>x.seat).length;
assert.ok(nEat>0);assert.equal(linked,nEat,'イートインの人が買った人につながる');
assert.equal(acts.filter(x=>x.range).length,res.ev.filter(e=>e.k==='range').length,'レンジの人がつながる');
// 時刻ごとの場所
const [x0,y0,w,h]=A.MAP.floor;let maxN=0,qSeen=0,eatSeen=0,payF=0,payS=0;
for(let t=5*60;t<23.5*60;t+=0.25){const L=A.at(acts,t,40),L2=A.at(acts,t,40);
  assert.equal(JSON.stringify(L.map(o=>[o.a.id,o.x,o.y])),JSON.stringify(L2.map(o=>[o.a.id,o.x,o.y])),'同じ時刻なら同じ');
  maxN=Math.max(maxN,L.length);assert.ok(L.filter(o=>!o.dot).length<=40,'上限');
  for(const o of L){assert.ok(Number.isFinite(o.x)&&Number.isFinite(o.y),'場所が数');assert.ok(o.x>=x0-5&&o.x<=x0+w+5&&o.y>=y0-5&&o.y<=600,'店か改札口の帯の中 '+o.ph+' '+o.x+','+o.y);
    if(o.ph==='queue')qSeen++;if(o.ph==='eat')eatSeen++;if(o.ph==='pay')o.a.lane==='f'?payF++:payS++;}
  // 有人レジ・セルフレジで会計中の人は、それぞれ1人まで
  assert.ok(L.filter(o=>o.ph==='pay'&&o.a.lane==='f').length<=1&&L.filter(o=>o.ph==='pay'&&o.a.lane==='s').length<=1,'レジは1台ずつ');}
assert.ok(qSeen>0&&eatSeen>0&&payF>0&&payS>0,'列・イートイン・有人とセルフの会計が見える');
// 途中から見ても同じ（前の時刻を見たかどうかで変わらない）
{const t=8*60+13.3,fresh=A.build(res,c,st.layout);assert.equal(JSON.stringify(A.at(fresh,t).map(o=>[o.x,o.y])),JSON.stringify(A.at(acts,t).map(o=>[o.x,o.y])),'途中から');}
// 上限：小さくすると、こえた分は点
{let hit=false;for(let t=7*60;t<9*60&&!hit;t+=0.5){const L=A.at(acts,t,3);if(L.length>3){hit=true;assert.equal(L.filter(o=>!o.dot).length,3);}}assert.ok(hit,'人が多い時刻がある');}
// 店員とセルフで呼ばれたとき
{const e=res.ev.find(x=>x.k==='selfhelp');assert.ok(e);const C=A.clerks(res,e.t+e.min/2);assert.ok(C.list.some(k=>k.busy==='self'),'呼ばれた店員がセルフレジへ');
  assert.ok(A.bubbles(res,e.t+0.01).some(b=>b.kind==='help'),'吹き出し');}
console.log(`  港駅の店の絵：人${acts.length}（買った${nBuy}・見て帰った${nLook}）・同時に最大${maxN}人・イートイン${nEat}人がつながる`);
console.log('minato-anim ok');
