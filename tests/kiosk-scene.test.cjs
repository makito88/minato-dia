// 港駅の店の「動く試作」（2026-11-13・js/kiosk-scene.js）
//  ・計算の結果（res）から、見せるための段取りを作るだけ：res は変わらない
//  ・買った人はみな段取りになる。時刻は来店（t-wait-stay）・会計の始め（t）・終わり（end）が計算どおり
//  ・どの時刻でも場所が数で、絵の店の中（または入口・出口の外の少し）にいる。同じ時刻なら同じ
//  ・すべての品のジャンルに、棚の場所（または店員が取る）がある。払い方は決まった乱数で同じ
//  ・選ぶのは、その時刻までに会計を終えた人だけ（まだ起きていない人は見せない）
const assert=require('node:assert/strict');
for(const f of ['research-core','kiosk-staff','kiosk-walk','kiosk-core','minato-store-core','kiosk-scene'])require('../js/'+f+'.js');
const K=require('../data/kiosk.json'),R=require('../data/research.json'),M=require('../data/minato-store.json'),S=require('../data/kiosk-scene.json');
const {KioskCore:KC,MinatoStore:MS,KioskScene:KSc}=globalThis;
const c=MS.cfg(K,M),H=KC.H,a=new Array(H).fill(0).map((_,h)=>h>=5&&h<24?(h>=7&&h<9||h>=17&&h<19?400:150):0),fl=[a,a.map(x=>x*0.3),a.map(x=>x*0.2),a.map(x=>x*0.3)];
const st=MS.create(K,M,KC,{seed:3,day:1});
const ctx={day:2,dow:2,cond:{day:'wd',wx:'sun',season:'aut'},flows:{hb:fl,ha:fl},stops:new Array(H).fill(4),plats:2,rcfg:R,order:st.order,express:[],addOn:[],edits:[],startT:0};
const res=KC.simulate(c,st,ctx),before=JSON.stringify(res),P={};for(const p of c.products)P[p.id]=p;
for(const p of c.products)assert.ok(S.spots[p.genre],'棚の場所がない：'+p.genre);
const o=i=>({idx:i,day:res.day,ev:res.ev,genreOf:id=>P[id].genre,nameOf:id=>P[id].name});
let n=0,lanes={},eat=0;
res.ev.forEach((e,i)=>{if(e.k!=='buy')return;const pl=KSc.plan(S,e,o(i));assert.ok(pl,'段取り '+i);n++;lanes[pl.lane]=1;if(pl.eat)eat++;
  assert.ok(Math.abs(pl.ta-(e.t-e.wait-e.stay))<1e-9&&pl.ts===e.t&&pl.te>=e.end,'時刻が計算どおり');
  assert.equal(pl.pay,KSc.plan(S,e,o(i)).pay,'払い方は同じ');
  for(let k=1;k<pl.segs.length;k++)assert.ok(Math.abs(pl.segs[k].a-pl.segs[k-1].b)<1e-6,'段取りがつながる '+pl.segs[k-1].ph+'→'+pl.segs[k].ph+' '+pl.segs[k-1].b+' '+pl.segs[k].a+' stay '+e.stay+' wait '+e.wait);
  const pay=pl.segs.find(s=>s.ph==='pay');assert.ok(pay&&Math.abs(pay.a-e.t)<1e-9,'会計の始め');
  for(let t=pl.ta;t<=pl.end+0.01;t+=0.03){const p1=KSc.pose(pl,t),p2=KSc.pose(pl,t);
    assert.ok(Number.isFinite(p1.x)&&Number.isFinite(p1.y),'場所が数');assert.equal(p1.x+','+p1.y,p2.x+','+p2.y,'同じ時刻なら同じ');
    assert.ok(p1.x>=60&&p1.x<=S.width-60&&p1.y>=200&&p1.y<=S.height,'絵の店の中 '+p1.ph+' '+p1.x+','+p1.y);
    if(t>=e.t&&t<pl.te)assert.equal(p1.ph,'pay');}});
assert.equal(n,res.ev.filter(e=>e.k==='buy').length);assert.ok(lanes.f&&lanes.s,'有人もセルフも');assert.ok(eat>0,'イートインの人も');
// 選ぶのは終わった人だけ
for(const T of [400,600,900,1200]){const i=KSc.choose(res.ev,T,new Set());if(i>=0)assert.ok(res.ev[i].end<=T,'まだ起きていない人は選ばない');}
assert.equal(KSc.choose(res.ev,200,new Set()),-1,'開店前はだれもいない');
assert.equal(JSON.stringify(res),before,'計算の結果は変わらない');
// 絵の設定：人の絵の名前がそろっている
for(const p of S.people)assert.ok(p.sheets.walk,'歩く絵の名前 '+p.id);
console.log('kiosk-scene ok（買った人 '+n+'・イートイン '+eat+'）');
