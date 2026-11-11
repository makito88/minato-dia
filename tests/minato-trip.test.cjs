// 港駅の売店：お客さんの「どこから・どこへ・なぜ」（walk.trip・2026-11-11）
//  ・港駅の店で買った人は、みな自分の客層の道を1つ持つ（会計の出来事の trip）・同じ条件なら同じ
//  ・道は時台に合うものが多い（朝は出勤、夕方は帰り）・道でほしいジャンルが変わる（会社員の帰りはお酒が多い）
//  ・緑ヶ丘の店は変わらない（指紋は tests/minato-store.test.cjs）
const assert=require('node:assert/strict');
for(const f of ['research-core','kiosk-staff','kiosk-walk','kiosk-core','minato-store-core'])require('../js/'+f+'.js');
const K=require('../data/kiosk.json'),R=require('../data/research.json'),M=require('../data/minato-store.json');
const {KioskCore:KC,MinatoStore:MS}=globalThis;
const c=MS.cfg(K,M),H=KC.H,a=new Array(H).fill(0).map((_,h)=>h>=5&&h<24?(h>=7&&h<9||h>=17&&h<19?400:150):0),fl=[a,a.map(x=>x*0.3),a.map(x=>x*0.2),a.map(x=>x*0.3)];
const RT={};for(const x of M.walk.trip.routes)RT[x.id]=x;const P={};for(const p of c.products)P[p.id]=p;
const run=()=>{let st=MS.create(K,M,KC,{seed:9,day:1});const out=[];for(let d=1;d<=6;d++){const res=KC.simulate(c,st,{day:d,dow:2,cond:{day:'wd',wx:'sun',season:'aut'},flows:{hb:fl,ha:fl},stops:new Array(H).fill(4),plats:2,rcfg:R,order:st.order,express:[],addOn:[],edits:[],startT:0});out.push(res);st=KC.closeDay(c,st,res,{}).state;}return out;};
const A=run(),B=run();
assert.equal(JSON.stringify(A.map(r=>r.ev.filter(e=>e.k==='buy').map(e=>e.trip))),JSON.stringify(B.map(r=>r.ev.filter(e=>e.k==='buy').map(e=>e.trip))),'同じ条件なら同じ道');
let n=0,inH=0;const cnt={},gs={};
for(const r of A)for(const e of r.ev){if(e.k!=='buy')continue;n++;assert.ok(e.trip&&RT[e.trip],'道がある '+e.ps);const x=RT[e.trip];assert.ok(x.ps.includes(e.ps),'客層の道');
  const h=Math.floor(e.t/60);if(x.hours.some(([a,b])=>h>=a-1&&h<b+1))inH++;cnt[e.trip]=(cnt[e.trip]||0)+1;
  const g=gs[e.trip]||(gs[e.trip]={});for(const [pid,q] of e.items){g[P[pid].genre]=(g[P[pid].genre]||0)+q;}}
assert.ok(inH/n>0.85,'道はたいてい時台に合う '+(inH/n).toFixed(2));
const share=(id,ge)=>{const g=gs[id]||{};const t=Object.values(g).reduce((s,x)=>s+x,0);return t?(g[ge]||0)/t:0;};
assert.ok(share('sal_pm','alcohol')>share('sal_am','alcohol')+0.03,'会社員の帰りはお酒が多い');
assert.ok(share('sal_am','coffee')>share('sal_pm','coffee'),'会社員の朝は缶コーヒーが多い');
assert.ok(share('tou_out','omiyage')>share('tou_in','omiyage'),'観光の帰りはおみやげが多い');
const top=Object.entries(cnt).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([k,v])=>RT[k].from+'→'+RT[k].to+' '+v).join('・');
console.log(`  どこから・どこへ（6日）：会計 ${n}人・道 ${Object.keys(cnt).length}種類・多い道 ${top}`);
console.log('minato-trip ok');
