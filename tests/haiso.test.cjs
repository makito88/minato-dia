// 配送会社（みなと川運輸）の1日（js/haiso-core.js）
//  ・工場→センターは自社の定温トラック2台、センター→店はトラック A・B の3便（自社）
//  ・積みきれない便は他社の応援便、追いかけ便は他社
//  ・便の時刻はセンターの決まり（truckRuns）と同じ。同じ入力なら同じ結果
const assert=require('node:assert/strict');
for(const f of ['center-core','haiso-core'])require('../js/'+f+'.js');
const C=require('../data/center.json'),H=require('../data/haiso.json'),CO=require('../data/companies.json');
const {CenterCore:CC,HaisoCore:HC}=globalThis;
const cond={day:'wd',wx:'sun',season:'aut'};
const inp=(runs,extra)=>Object.assign({day:5,cond,slip:null,stores:[{key:'M-home',runs}]},extra||{});
const R1=[{bin:'朝の便',f:300,c:150},{bin:'昼前の便',f:100,c:2000},{bin:'午後の便',f:60,c:30}];
const P=HC.dayPlan(H,C,CC,inp(R1));
assert.deepEqual(P.runs.filter(r=>r.leg==='fc').map(r=>r.company),['haiso','haiso'],'工場→センターは自社2台');
const cs=P.runs.filter(r=>r.leg==='cs');assert.equal(cs.length,3);assert.ok(cs.every(r=>r.company==='haiso'&&r.truck==='A'),'緑ヶ丘はトラックA');
const tp=CC.truckRuns(C,'M-home',5,cond,0);cs.forEach((r,i)=>assert.equal(r.stops[0].arrive,tp[i].arrive,'着く時刻はセンターの決まりと同じ'));
const ex=P.runs.filter(r=>r.leg==='cs-extra');assert.equal(ex.length,1,'積みきれない便だけ応援');assert.equal(ex[0].company,'other');assert.equal(ex[0].bin,'昼前の便');
assert.ok(Math.abs(cs[1].carts+ex[0].carts-(100/300+2000/150))<0.11,'自社＋応援＝荷物の全部');
assert.equal(P.sum.other,1);assert.ok(P.sum.cost>0&&P.sum.fare>0);
assert.equal(JSON.stringify(HC.dayPlan(H,C,CC,inp(R1))),JSON.stringify(P),'同じ入力なら同じ');
// 追いかけ便（他社）と、待った分だけ遅れる朝の便
const ch=HC.dayPlan(H,C,CC,inp(R1,{slip:{late:{mode:'chase',end:1620,at:1655,bin:'朝の便',fee:9000}}}));const x=ch.runs.find(r=>r.leg==='chase');assert.ok(x&&x.company==='other'&&x.fee===9000);
const w=HC.dayPlan(H,C,CC,inp(R1,{slip:{late:{mode:'wait',wait:10}}}));assert.equal(w.runs.find(r=>r.leg==='fc').depart-P.runs.find(r=>r.leg==='fc').depart,10);
// 港の店はトラックB
assert.ok(HC.dayPlan(H,C,CC,{day:5,cond,slip:null,stores:[{key:'P-gate',runs:R1}]}).runs.filter(r=>r.leg==='cs').every(r=>r.truck==='B'));
// 会社の一覧
for(const id of ['kiosk','center','factory','haiso','other','ws'])assert.ok(CO.companies.find(c=>c.id===id),'会社 '+id);
console.log(`haiso.test ok（自社${P.sum.own}便・他社${P.sum.other}便・${P.sum.km}km・費用${P.sum.cost}円・運賃${P.sum.fare}円）`);
