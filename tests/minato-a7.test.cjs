// 港駅の売店アニメ A7（2026-11-11）：レジは着いた順・レジの選び方（js/kiosk-walk.js・港駅の店の設定 walk.fifo・walk.self.choose があるときだけ）
//  ・同じレジでは「着いた順＝会計を始めた順」。待っている人のうしろから来た人が先に会計しない（前は店に入った順に決めていて、割り込みがあった）
//  ・レジの選び方：セルフに人がいて有人レジに店員が立っていれば有人へ／立っていなければセルフで待つ／どうしてもセルフの人はセルフ
//  ・絵（js/minato-store-anim.js）の列も着いた順に並ぶ
//  ・設定がなければ前の決め方（緑ヶ丘の店の指紋は tests/minato-store.test.cjs）
const assert=require('node:assert/strict');
for(const f of ['research-core','kiosk-staff','kiosk-walk','kiosk-core','minato-store-core','minato-store-anim','links/local-to-kiosk'])require('../js/'+f+'.js');
const K=require('../data/kiosk.json'),R=require('../data/research.json'),M=require('../data/minato-store.json'),L=require('../data/links.json');
const {KioskCore:KC,MinatoStore:MS,MinatoAnim:AN,LocalToKiosk:LK}=globalThis;
const c=MS.cfg(K,M);
const H=KC.H,a=new Array(H).fill(0).map((_,h)=>h>=5&&h<24?(h>=7&&h<9||h>=17&&h<19?400:150):0),fl=[a,a.map(x=>x*0.3),a.map(x=>x*0.2),a.map(x=>x*0.3)];
const ctxOf=(st,day,extra)=>Object.assign({day,dow:day%7,cond:{day:day%7===0?'hol':day%7===6?'sat':'wd',wx:day%5===0?'rain':'sun',season:'aut'},flows:{hb:fl,ha:fl},stops:new Array(H).fill(4),plats:2,rcfg:R,order:st.order,express:[],addOn:[],edits:[],startT:0},extra||{});
function run(cfg,staff,days){let st=MS.create(K,M,KC,{seed:3,day:1,staff});const out=[];
  for(let day=1;day<=days;day++){const p=LK.plan(L,M,st,{day});const ex=p?{local:p}:{};if(day%7===5)ex.cruise={pax:2000,from:600,to:900};const res=KC.simulate(cfg,st,ctxOf(st,day,ex));res._layout=st.layout;out.push(res);st=KC.closeDay(cfg,st,res).state;}return out;}
// 割り込み：同じレジで、先に着いた人より先に会計を始めた人の数（wait は小数2けたに丸めてあるので 0.011 分までは同じとみる）
const cuts=res=>{let n=0;const B=res.ev.filter(e=>e.k==='buy'&&e.lane);for(const ln of ['f','s']){const X=B.filter(e=>e.lane===ln).map(e=>({ta:e.t-e.wait,ts:e.t})).sort((x,y)=>x.ta-y.ta);let mx=-1,j=0;for(const x of X){while(j<X.length&&X[j].ta<x.ta-0.011){mx=Math.max(mx,X[j].ts);j++;}if(x.ts<mx-1e-6)n++;}}return n;};   // はっきり先に着いた人（0.011分より前）より先に始めた人
const A1=run(c,1,14),A2=run(c,2,14);
assert.equal(JSON.stringify(run(c,1,3).map(r=>[r.pl,r.walk,r.ev.length])),JSON.stringify(A1.slice(0,3).map(r=>[r.pl,r.walk,r.ev.length])),'同じ条件なら同じ');
for(const r of [...A1,...A2]){assert.equal(cuts(r),0,'着いた順に会計（'+r.day+'日目）');for(let i=1;i<r.ev.length;i++)assert.ok(r.ev[i].t>=r.ev[i-1].t,'時刻の順');}
// 設定がなければ前の決め方（入った順）：割り込みが出る＝直したことの確かめ
const c0={...c,walk:{...c.walk,self:{...c.walk.self}}};delete c0.walk.fifo;delete c0.walk.self.choose;
const Z=run(c0,1,4),zc=Z.reduce((s,r)=>s+cuts(r),0);assert.ok(zc>20,'前の決め方では割り込みがあった '+zc);
for(const r of Z)assert.equal(r.walk.insist,undefined,'設定がなければ選び方の数は出ない');
// レジの選び方
const sum=(A,k)=>A.reduce((s,r)=>s+(r.walk[k]||0),0);
const s1={insist:sum(A1,'insist'),toStaffed:sum(A1,'toStaffed'),waitSelf:sum(A1,'waitSelf'),toSelf:sum(A1,'toSelf')},s2={insist:sum(A2,'insist'),toStaffed:sum(A2,'toStaffed'),waitSelf:sum(A2,'waitSelf'),toSelf:sum(A2,'toSelf')};
assert.ok(s1.insist>200&&s2.insist>200,'どうしてもセルフの人');
assert.ok(s2.toStaffed>s1.toStaffed,'店員2人の時間は、有人レジに店員が立っていることが多く、有人へ移る人が多い '+s1.toStaffed+'→'+s2.toStaffed);
assert.ok(s1.waitSelf>s2.waitSelf,'店員1人の時間は、店員が売り場にいてセルフで待つ人が多い '+s1.waitSelf+'→'+s2.waitSelf);
// 列で帰った人が、入った順のときより少ない（割り込みで待たされていた分）
const lk=A=>A.reduce((s,r)=>s+r.ev.filter(e=>e.k==='look'&&e.why==='列が長い').length,0);
{const B1=run(c0,1,14);assert.ok(lk(A1)<lk(B1),'列で帰った人が減る '+lk(B1)+'→'+lk(A1));}
// 絵：列は着いた順（同じレジで、先に列に入った人が先に会計・列の何番目かも着いた順）
let chk=0;for(const r of [A1[1],A2[4]]){const acts=AN.build(r,c,r._layout);
  for(const ln of ['f','s']){const X=acts.filter(x=>x.kind==='buy'&&x.lane===ln).sort((x,y)=>x.tq-y.tq);let mx=-1,j=0;for(const x of X){while(j<X.length&&X[j].tq<x.tq-0.011){mx=Math.max(mx,X[j].ts);j++;}assert.ok(x.ts>=mx-1e-6,'絵の列も着いた順');}}
  for(let t=6*60;t<22*60;t+=0.25){const Lq=AN.at(acts,t,40).filter(o=>o.ph==='queue');for(const ln of ['f','s']){const Q=Lq.filter(o=>o.a.lane===ln).sort((x,y)=>x.a.tq-y.a.tq);
    for(let i=1;i<Q.length;i++){assert.ok(Q[i].a._k>=Q[i-1].a._k-1e-9,'列の何番目かは着いた順');chk++;}}}}
console.log(`  14日：割り込み 0（前の決め方では4日で ${zc}）・店員1人 ${JSON.stringify(s1)}・2人 ${JSON.stringify(s2)}・列で帰った ${lk(A1)}・列の並びを見た ${chk}`);
console.log('minato-a7 ok');
