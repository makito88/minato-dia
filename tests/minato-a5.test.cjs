// 港駅の売店アニメ A5（2026-11-11）：計算2（js/kiosk-walk.js・港駅の店の設定 walk.carry・newPs・rush・self.svcPs があるときだけ）
//  ・持ち物：スマホだけ（電子マネーの人だけ・セルフへ）／小銭入れ（現金の人だけ・有人へ）／濡れた傘（雨の日・傘を買わない）／両手がふさがる荷物（2点まで）／
//    マイボトル（飲み物が減る）／乗船券（酔い止めを探して「置いていない」）
//  ・新しい客層4つ（市場帰り・船に乗る人・イベント帰り・セミナー）は、決めた日と時刻にだけ来る
//  ・会計の速さ：セルフは客層ごと（年配の人は遅い）・急いでいる人は速い（いちばん速い人で約8〜10秒）
//  ・設定がなければ、持ち物も新しい客層も出ない。緑ヶ丘の店の指紋は tests/minato-store.test.cjs が確かめる
const assert=require('node:assert/strict');
for(const f of ['research-core','kiosk-staff','kiosk-walk','kiosk-core','minato-store-core','links/local-to-kiosk'])require('../js/'+f+'.js');
const K=require('../data/kiosk.json'),R=require('../data/research.json'),M=require('../data/minato-store.json'),L=require('../data/links.json');
const {KioskCore:KC,MinatoStore:MS,LocalToKiosk:LK}=globalThis;
const c=MS.cfg(K,M),I=KC.index(c),G=pid=>I.P[pid].genre;
const H=KC.H,a=new Array(H).fill(0).map((_,h)=>h>=5&&h<24?(h>=7&&h<9||h>=17&&h<19?400:150):0),fl=[a,a.map(x=>x*0.3),a.map(x=>x*0.2),a.map(x=>x*0.3)];
const ctxOf=(st,day,extra)=>Object.assign({day,dow:day%7,cond:{day:day%7===0?'hol':day%7===6?'sat':'wd',wx:day%5===0?'rain':'sun',season:'aut'},flows:{hb:fl,ha:fl},stops:new Array(H).fill(4),plats:2,rcfg:R,order:st.order,express:[],addOn:[],edits:[],startT:0},extra||{});
const CRUISE={pax:2000,from:600,to:900};
function run(cfg,staff,days){let st=MS.create(K,M,KC,{seed:3,day:1,staff});const out=[];
  for(let day=1;day<=days;day++){const p=LK.plan(L,M,st,{day});const ex=p?{local:p}:{};if(day%7===5)ex.cruise=CRUISE;const res=KC.simulate(cfg,st,ctxOf(st,day,ex));out.push(res);st=KC.closeDay(cfg,st,res).state;}return out;}
const A=[...run(c,1,14),...run(c,2,14)];
assert.equal(JSON.stringify(run(c,1,3).map(r=>[r.pl,r.walk,r.ev.length])),JSON.stringify(A.slice(0,3).map(r=>[r.pl,r.walk,r.ev.length])),'同じ条件なら同じ');
const buys=A.flatMap(r=>r.ev.filter(e=>e.k==='buy').map(e=>Object.assign({day:r.day,wx:r.cond.wx,dk:r.cond.day},e)));
const has=(e,id)=>!!(e.carry&&e.carry.includes(id)),med=L=>{const s=L.slice().sort((x,y)=>x-y);return s.length?s[Math.floor(s.length/2)]:NaN;},sec=e=>(e.end-e.t)*60;
const share=L=>L.filter(e=>e.lane==='s').length/Math.max(1,L.length);
// 持ち物
for(const e of buys){if(!e.carry)continue;assert.ok(e.carry.filter(x=>x!=='umb').length<=c.walk.carry.max,'持ち物は2つまで（濡れた傘は数えない）');
  if(has(e,'phone'))assert.ok(e.em,'スマホだけの人は電子マネー');if(has(e,'coin'))assert.ok(!e.em,'小銭入れの人は現金');
  if(has(e,'umb')){assert.ok(e.wx==='rain'||e.wx==='snow','濡れた傘は雨の日だけ');assert.ok(!e.items.some(([p])=>G(p)==='umbrella'),'傘を持っている人は傘を買わない');}
  if(has(e,'load'))assert.ok(e.items.reduce((t,x)=>t+x[1],0)<=c.walk.carry.kinds.find(k=>k.id==='load').maxItems,'両手がふさがる人は2点まで');}
const ph=buys.filter(e=>has(e,'phone')),co=buys.filter(e=>has(e,'coin'));
assert.ok(ph.length>200&&co.length>100,'スマホ・小銭入れの人がいる');assert.ok(share(ph)>share(co)+0.3,'スマホだけの人はセルフ、小銭入れの人は有人へ');
const drink=L=>L.filter(e=>e.items.some(([p])=>['colddrink','coffee','hotdrink'].includes(G(p)))).length/Math.max(1,L.length);
const bt=buys.filter(e=>has(e,'bottle')),nb=buys.filter(e=>!has(e,'bottle'));assert.ok(bt.length>50&&drink(bt)<drink(nb),'マイボトルの人は飲み物を買いにくい');
const rainUm=buys.filter(e=>e.wx==='rain'&&e.items.some(([p])=>G(p)==='umbrella'));assert.ok(rainUm.length>0,'雨の日に傘を持っていない人が傘を買う');
const seek=A.flatMap(r=>r.ev.filter(e=>e.k==='look'&&e.want==='酔い止め'));assert.ok(seek.length>0&&seek.every(e=>e.why==='置いていない'&&(e.ps==='fer'||e.ps==='cru')),'酔い止めを探して「置いていない」');
assert.ok(A.some(r=>r.walk.carry&&r.walk.carry.can>0),'空き缶の人がいる');
// 新しい客層4つ
const enter=e=>e.t-(e.stay||0)-(e.wait||0);
const NP=c.walk.newPs,cnt={};
for(const e of buys){if(!NP[e.ps])continue;cnt[e.ps]=(cnt[e.ps]||0)+1;const hs=NP[e.ps].hours,t0=enter(e)/60;
  if(!(e.ps==='fer'&&A.find(r=>r.day===e.day&&r.cond)&&e.day%7===5))assert.ok(hs.some(([x,y])=>t0>=x-0.02&&t0<y+0.02),e.ps+' は決めた時刻に来る');
  if(e.ps==='mkt')assert.ok(e.dk!=='hol'&&e.day%7!==3,'市場が休みの日は市場帰りの人は来ない');
  if(e.ps==='smn')assert.equal(e.dk,'wd','セミナーは平日だけ');}
for(const id of ['mkt','fer','evt','smn'])assert.ok(cnt[id]>0,id+' が来る');
const ferDay=A.filter(r=>r.day%7===5).reduce((t,r)=>t+(r.walk.newPs.fer||0),0)/A.filter(r=>r.day%7===5).length,ferOff=A.filter(r=>r.day%7===1||r.day%7===2).reduce((t,r)=>t+(r.walk.newPs.fer||0),0)/A.filter(r=>r.day%7===1||r.day%7===2).length;
assert.ok(ferDay>ferOff*2,'客船が寄る日は船に乗る人が多い');
assert.ok(buys.filter(e=>e.ps==='mkt').every(e=>has(e,'load')?e.items.length<=2:true));
// 会計の速さ（品1つ・セルフで呼ばれていない人）
const one=buys.filter(e=>e.items.length===1&&e.items[0][1]===1&&G(e.items[0][0])!=='alcohol'&&!e.age),help=new Set();
for(const r of A)for(const e of r.ev)if(e.k==='selfhelp')help.add(r.day+':'+e.t.toFixed(3));
const noHelp=one.filter(e=>!(e.lane==='s'&&A.some(r=>r.day===e.day&&r.ev.some(x=>x.k==='selfhelp'&&x.t>=e.t&&x.t<=e.end))));
const S=(f)=>med(noHelp.filter(f).map(sec));
// 払い方をそろえて比べる（年配の人のセルフは数が少なく、現金と電子マネーで会計の秒数がちがうため。2026-11-11 に、そろえる形にした）
const senS=S(e=>e.lane==='s'&&e.ps==='sen'&&!e.rush&&!e.em),salS=S(e=>e.lane==='s'&&e.ps==='salM'&&!e.rush&&!has(e,'phone')&&!e.em);
assert.ok(senS>salS*1.4,'年配の人はセルフが遅い（'+senS.toFixed(1)+'秒・会社員 '+salS.toFixed(1)+'秒）');
const fR=S(e=>e.lane==='f'&&e.rush&&e.em),fN=S(e=>e.lane==='f'&&!e.rush&&e.em);assert.ok(fR<fN,'急いでいる人は有人レジでも速い');
const fast=noHelp.filter(e=>e.lane==='s'&&e.rush&&e.em&&has(e,'phone')&&['salM','salF','stu','jk','shf'].includes(e.ps)).map(sec);
assert.ok(fast.length>10&&med(fast)>=7&&med(fast)<=10.5,'急いでいて電子マネーでセルフの人がいちばん速い（約8〜10秒）：'+med(fast).toFixed(1));
// 設定がなければ出ない（持ち物・新しい客層・急ぎ）
{const M0=JSON.parse(JSON.stringify(M));for(const k of ['carry','newPs','rush'])delete M0.walk[k];delete M0.walk.self.svcPs;const c0=MS.cfg(K,M0),R0=run(c0,1,3);
  for(const r of R0)for(const e of r.ev){assert.ok(!e.carry&&!e.rush&&!NP[e.ps],'設定がなければ出ない');}}
console.log('A5 ok：28日で',buys.length,'人が買った・スマホだけ',ph.length,'（セルフ',(share(ph)*100).toFixed(0)+'%）・小銭入れ',co.length,'（セルフ',(share(co)*100).toFixed(0)+'%）・新しい客層',JSON.stringify(cnt),
  '・酔い止めを探した',seek.length,'・セルフ（品1つ）年配',senS.toFixed(1)+'秒／会社員',salS.toFixed(1)+'秒・いちばん速い人',med(fast).toFixed(1)+'秒');
