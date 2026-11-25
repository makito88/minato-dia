// 沿線のバス網（2026-11-25）：会場の割合・季節のできごとの分け方・イベントの流れの分け方・フィーダーの表
const assert=require('node:assert/strict');
const BN=require('../js/busnet-core.js'),SC=require('../js/season-core.js');
const cfg=require('../data/busnet.json'),S1=require('../data/seasonal.json'),S2=require('../data/seasonal-extra.json'),S3=require('../data/seasonal-busnet.json');
const ALL=['C','S','U','M','K','N','P','F','T','O'];
// 1) 会場：割合の合計は1、駅は10駅のどれか、main は割合のいちばん大きい駅
for(const [id,v] of Object.entries(cfg.venues)){const ks=Object.keys(v.access);assert.ok(ks.length>=1&&ks.every(s=>ALL.includes(s)),id);
  const sum=ks.reduce((a,s)=>a+v.access[s],0);assert.ok(Math.abs(sum-1)<0.03,id+' 割合の合計 '+sum);assert.equal(v.main,ks.reduce((a,b)=>v.access[a]>=v.access[b]?a:b),id);}
// 2) 系統：停留所と経路がそろう・駅の一覧は10駅のどれか
for(const r of cfg.routes){assert.ok(cfg.routePath[r.no],r.no);for(const p of cfg.routePath[r.no])if(typeof p==='string')assert.ok(cfg.stops[p],r.no+' '+p);assert.ok(r.stations.every(s=>ALL.includes(s)));}
// 3) 新しい季節の行事：形がそろい、会場がある・id が重ならない
const ids=new Set([...S1.list,...S2.list].map(e=>e.id));
for(const e of S3.list){assert.ok(!ids.has(e.id),'重ならない '+e.id);assert.ok(cfg.venues[e.id],'会場 '+e.id);assert.ok(e.when&&e.rail&&e.letter&&e.only);}
const merged=SC.merge(S1,S2,S3);
// 4) 1年分：新しい行事も起きる。place で駅が会場の main になり、expand で割合の合計が強さにもどる
let seen=0,split=0;
for(let i=SC.indexOf(2027,1,1);i<SC.indexOf(2028,1,1);i++){const L=BN.place(cfg,SC.today(merged,12345,i));
  for(const o of L){const v=cfg.venues[o.id];if(!v||o.ev.scope==='line')continue;assert.equal(o.st,v.main);
    if(o.id.startsWith('n_'))seen++;const X=BN.expand([o]);if(X.length>1)split++;
    const m=X.reduce((a,x)=>a+x.mag,0);assert.ok(Math.abs(m-o.mag*(o.boost||1))<0.05*o.mag,o.id);}}
assert.ok(seen>=15,'新しい行事が1年に '+seen+' 回');assert.ok(split>=20,'2駅以上に分かれた日 '+split);
// 5) イベントの流れ：分けても量の合計は同じ・もとの駅は半分以上・2回目は変えない
const evs=[{id:'n_x',place:'M',flows:[{to:'M',amt:4,peak:600,sd:30,p:2},{from:'M',to:'C',amt:2,peak:900,sd:30,p:2},{from:'C',to:'S',amt:1,peak:600,sd:30,p:2}]}];
const c2={venues:{n_x:{main:'M',access:{M:0.2,U:0.5,K:0.3}}}};
const tot=e=>e.flows.reduce((a,f)=>a+f.amt,0),before=tot(evs[0]);
assert.equal(BN.eventFlows(c2,evs),1);assert.ok(Math.abs(tot(evs[0])-before)<0.01,'量の合計は同じ');
assert.equal(evs[0].flows[0].amt,2,'もとの駅は半分');assert.ok(evs[0].flows.some(f=>f.to==='U'&&f.bus));assert.ok(!evs[0].flows.some(f=>f.from&&f.from===f.to));
assert.equal(BN.eventFlows(c2,evs),0,'2回目は何もしない');
// 6) フィーダーの表：1倍の近く（0.97〜1.13）。中央がいちばん強い・土休日もある・並ぶ系統の組は減る
for(const hol of [false,true]){const T=BN.table(cfg,ALL,hol),N=ALL.length;let lo=9,hi=0;for(const v of T){lo=Math.min(lo,v);hi=Math.max(hi,v);}
  assert.ok(lo>0.97&&hi<1.13,'倍率のはば '+lo+'〜'+hi);}
const f=BN.feeder(cfg,false);assert.ok(Object.keys(f).every(s=>f[s]<=f.C),'中央がいちばん');
const c=BN.compete(cfg,false);assert.ok(c.KM>0&&c.CM>0,'並ぶ系統');
console.log('busnet-core OK');
// 7) お絵かき帖への描き込み（js/busnet-doc.js）：26系統・施設82か所・2回目は描かない・消すと自分の路線だけ残る・自分の路線は乗客に効く
{const RC=require('../js/route-core.js'),BD=require('../js/busnet-doc.js'),defs=require('../data/routes.json'),fac=require('../data/facilities.json');
  let doc=RC.normalize(null,defs);const n0=Object.keys(doc.lines).length;
  // 自分で描いた路線：大学前駅のそば→駅から遠い団地（1時間に4本）
  const a=RC.addNode(doc,316,322),b=RC.addNode(doc,316,250);RC.addEdge(doc,a,b,[],'street',false);
  doc.stops.u1={name:'大学前駅',type:'bus',node:a,lp:'auto'};doc.stops.u2={name:'北の団地',type:'bus',node:b,lp:'auto'};
  doc.lines.mine={name:'自分のバス',type:'city',style:{},seq:[{s:'u1'},{s:'u2'}],freq:{unit:'h',n:4},first:'06:00',last:'22:00',round:true,show:true};doc.order.push('mine');
  const n=BD.draw(RC,doc,cfg,fac,defs);assert.equal(n,cfg.routes.length,'系統の数');assert.equal(BD.draw(RC,doc,cfg,fac,defs),0,'2回目は描かない');
  assert.equal(Object.values(doc.stops).filter(s=>s.type==='spot').length,fac.list.length,'施設のピン');
  doc=RC.normalize(JSON.parse(JSON.stringify(doc)),defs);assert.ok(BD.has(doc),'保存して読み直しても印が残る');
  for(const l of Object.values(doc.lines)){if(!l.std)continue;const p=RC.linePath(doc,l);assert.ok(p,'道すじ '+l.name);}
  const ST={};for(const [k,v] of Object.entries(defs.rail.stations))ST[k]={x:v.x,y:v.y};
  const ur=BN.fromDoc(doc,ST,{upk:38});assert.equal(ur.length,1,'描き込んだ網は数えない・自分の路線だけ');assert.deepEqual(ur[0].stations,['U']);assert.equal(ur[0].wd,65);assert.ok(ur[0].feeder>0);
  const f0=BN.feeder(cfg,false),f1=BN.feeder(BN.withUser(cfg,ur),false);assert.ok(f1.U>f0.U,'自分の路線で大学前が強くなる');
  const m=BD.erase(RC,doc);assert.equal(m,cfg.routes.length);assert.ok(!Object.values(doc.stops).some(s=>s.std)&&!Object.values(doc.edges).some(e=>e.std));
  assert.ok(doc.lines.mine&&doc.stops.u1,'自分の路線は残る');assert.equal(Object.keys(doc.lines).length,n0+1);assert.equal(BD.draw(RC,Object.assign(doc,{std:{busnet:0}}),cfg,fac,defs)>0,true,'消したあとでもメニューからは描ける');}
console.log('busnet-doc OK');
