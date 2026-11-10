// 港駅の売店 2回目（店の計算：中に入って歩く店）（2026-11-10）
//  ・港駅の店の設定（js/minato-store-core.js）：品108・置き場所の品はすべてある・新しい場所（おみやげの台・レジ前の棚）
//  ・14日動かす：同じ条件なら同じ結果／出来事は時刻の順／セルフの割合・セルフで呼ばれた回数・列で帰った人・イートイン・交代で働く人
//  ・客船の客は、強さ0のあいだ来ない（ctx.cruise があっても）。強さを上げると来る（8回目の入口）
//  ・店が2つ（緑ヶ丘 M-home と 港駅 P-gate）：センターの割り振り（allocate）・センターの倉庫（csOpen・csClose）・配送会社（トラックA・B）・お金の流れ（nStores）
const assert=require('node:assert/strict');
for(const f of ['research-core','kiosk-staff','kiosk-walk','kiosk-core','minato-store-core','center-core','haiso-core','money-core'])require('../js/'+f+'.js');
const K=require('../data/kiosk.json'),R=require('../data/research.json'),M=require('../data/minato-store.json'),C=require('../data/center.json'),Hz=require('../data/haiso.json'),MO=require('../data/money.json');
const {KioskCore:KC,MinatoStore:MS,CenterCore:CC,HaisoCore:HC,MoneyCore:MC}=globalThis;

// 1) 設定
const c=MS.cfg(K,M);
assert.equal(MS.cfg(K,M),c,'同じ設定');
assert.equal(c.products.length,M.count.total,'品の数');
assert.ok(c.walk&&c.walk.registers.self===1&&c.walk.registers.staffed===1,'有人1＋セルフ1');
for(const z of ['omiyage','regfront'])assert.ok(c.zones[z],'新しい場所 '+z);
const I=KC.index(c);
for(const z in c.layout){assert.ok(c.zones[z],'場所 '+z);assert.equal(c.layout[z].length,c.zones[z].rows*c.zones[z].cols,'場所の数 '+z);
  for(const pid of c.layout[z])if(pid){assert.ok(I.P[pid],'品 '+pid);assert.ok(I.G[I.P[pid].genre].zones.includes(z),pid+' は '+z+' に置ける');}}
const placed=new Set(Object.values(c.layout).flat().filter(Boolean));
for(const p of c.products)assert.ok(placed.has(p.id),'棚にない品 '+p.id);
assert.ok(!placed.has('mg_fashion'),'女性ファッション誌は置かない');
assert.ok(c.deliveries.find(d=>d.name==='昼前の便').genres.includes('bento'),'お弁当は昼前の便にも');

// 2) 14日
const H=KC.H,a=new Array(H).fill(0).map((_,h)=>h>=5&&h<24?(h>=7&&h<9||h>=17&&h<19?400:150):0),fl=[a,a.map(x=>x*0.3),a.map(x=>x*0.2),a.map(x=>x*0.3)];
const ctxOf=(st,day,extra)=>Object.assign({day,dow:day%7,cond:{day:day%7===0?'hol':day%7===6?'sat':'wd',wx:day%5===0?'rain':'sun',season:'aut'},flows:{hb:fl,ha:fl},stops:new Array(H).fill(4),plats:2,rcfg:R,order:st.order,express:[],addOn:[],edits:[],startT:0},extra||{});
function run14(cfg,extra){let st=MS.create(K,M,KC,{seed:3,day:1});const out=[];
  for(let day=1;day<=14;day++){const res=KC.simulate(cfg,st,ctxOf(st,day,extra));out.push(res);st=KC.closeDay(cfg,st,res).state;}return {out,st};}
const A=run14(c),B=run14(c);
assert.equal(JSON.stringify(A.out.map(r=>[r.pl,r.walk,r.ev.length])),JSON.stringify(B.out.map(r=>[r.pl,r.walk,r.ev.length])),'同じ条件なら同じ');
assert.equal(A.st.st,'P');assert.equal(A.st.place,'gate');assert.equal(CC.storeKey(A.st),'P-gate');assert.equal(A.st.store,'minato');
const sum={sales:0,cust:0,items:0,self:0,staffed:0,help:0,qLeft:0,long:0,eatIn:0,eatFull:0,shift:0,cruise:0,shfBuy:0,omi:0,bento:0};
for(const r of A.out){for(let i=1;i<r.ev.length;i++)assert.ok(r.ev[i].t>=r.ev[i-1].t,'時刻の順');
  const W=r.walk;assert.ok(W,'歩く店の集計');sum.sales+=r.pl.sales;sum.self+=W.self;sum.staffed+=W.staffed;sum.help+=W.selfHelp;sum.qLeft+=W.queueLeft;sum.eatIn+=W.eatIn;sum.eatFull+=W.eatFull;sum.shift+=W.shift;sum.cruise+=W.cruise;
  sum.long+=r.reasons['列が長い']||0;sum.shfBuy+=r.byPs.shf||0;assert.ok(!r.byPs.cru,'客船の客は来ない');
  for(const e of r.ev){if(e.k==='buy'){sum.cust++;assert.ok(e.lane==='f'||e.lane==='s','レジ');assert.ok(e.stay>0,'店にいた分');
      for(const [pid,q] of e.items){sum.items+=q;const g=I.P[pid].genre;if(g==='omiyage')sum.omi+=q;if(g==='bento')sum.bento+=q;
        if(e.lane==='s')assert.ok(!['hot','tobacco','alcohol'].includes(g),'セルフで買えない品 '+pid);}}
    if(e.k==='eatin')assert.ok(e.seat>=0&&e.seat<c.walk.eatIn.seats&&e.to>e.t,'席');}}
const selfShare=sum.self/(sum.self+sum.staffed);
assert.ok(sum.sales>0&&sum.cust>0);assert.ok(selfShare>0.2&&selfShare<0.8,'セルフの割合 '+selfShare);
assert.ok(sum.help>0,'セルフで迷って店員が呼ばれる');assert.ok(sum.long>0,'列が長くて帰る人');assert.ok(sum.eatIn>0,'イートイン');
assert.ok(sum.shift>0&&sum.shfBuy>0,'交代で働く人');assert.equal(sum.cruise,0);assert.ok(sum.omi>0&&sum.bento>0,'おみやげ・お弁当が売れる');
console.log(`  港駅の店 14日：売上${Math.round(sum.sales/14).toLocaleString()}円/日・${Math.round(sum.cust/14)}人/日・1人${(sum.items/sum.cust).toFixed(2)}点・セルフ${(selfShare*100).toFixed(0)}%・セルフで呼ばれた${sum.help}回・列で帰った${sum.long}人（床の印${sum.qLeft}）・イートイン${sum.eatIn}人（満席${sum.eatFull}）・交代の人${sum.shfBuy}人が買った`);
// 店にいる時間：観光客は会社員より長い・長いほどかごの品が増える
{const e=A.out.flatMap(r=>r.ev.filter(x=>x.k==='buy'));const avg=ps=>{const L=e.filter(x=>x.ps===ps);return L.reduce((t,x)=>t+x.stay,0)/L.length;};assert.ok(avg('tou')>avg('salM'),'観光客は長くいる');
  const long=e.filter(x=>x.stay>=6),short=e.filter(x=>x.stay<2.5),n=L=>L.reduce((t,x)=>t+x.items.length,0)/L.length;assert.ok(n(long)>n(short),'長くいるほど品が増える');}

// 3) 客船の客：強さ0なら ctx.cruise があっても来ない。強さを上げると来る（8回目の入口）
{const cr={cruise:{pax:1500,from:600,to:900}};const st=MS.create(K,M,KC,{seed:3,day:1});
  const r0=KC.simulate(c,st,ctxOf(st,3,cr)),r00=KC.simulate(c,st,ctxOf(st,3));assert.equal(JSON.stringify(r0.pl),JSON.stringify(r00.pl),'強さ0なら同じ');
  const M2=JSON.parse(JSON.stringify(M));M2.personas.find(p=>p.id==='cru').strength=1;const c2=MS.cfg(K,M2),st2=MS.create(K,M2,KC,{seed:3,day:1}),r1=KC.simulate(c2,st2,ctxOf(st2,3,cr));
  assert.ok(r1.walk.cruise>0&&r1.byPs.cru>0,'強さ1なら客船の客が来る');}

// 4) 店が2つ：センター・配送会社・お金の流れ
{const sg=KC.create(K,{st:'M',place:'home',seed:3}),sm=MS.create(K,M,KC,{seed:3,day:1}),cond={day:'wd',wx:'sun',season:'aut'};
  // センターの割り振り：足りない品は店の注文の割合で分ける
  const al=CC.allocate(c,[{key:'M-home',runs:{'朝の便':{dr_tea:30}}},{key:'P-gate',runs:{'朝の便':{dr_tea:10,bt_karaage:4}}}],{dr_tea:20});
  assert.equal(al['M-home'].runs['朝の便'].dr_tea+al['P-gate'].runs['朝の便'].dr_tea,20);assert.equal(al['M-home'].runs['朝の便'].dr_tea,15);assert.equal(al['P-gate'].runs['朝の便'].bt_karaage,4);
  // センターの倉庫：2店で7日。その日の始めの在庫を2店で割り振り、締めは2店の分をまとめて引く
  const cs=CC.csNew(),recs=[];let S=[sg,sm];const cfgs=[K,c],keys=['M-home','P-gate'];const day0=Math.max(...S.map(x=>x.openedDay));
  for(let day=3;day<=9;day++){const stores=S.map((s,i)=>({key:keys[i],order:s.order,shelf:KC.shelfInfo(cfgs[i],s.layout)}));CC.csOpen(c,C,cs,day,{stores,recs});
    const start={...cs.open.stock};for(const pid in start)assert.ok(start[pid]>=0);
    const orders=S.map((s,i)=>{const r={};for(const pid of CC.centerPids(c,C,stores[i].shelf))r[pid]=s.order[pid]||0;return {key:keys[i],runs:{'朝の便':r}};});
    const al2=CC.allocate(c,orders,start),res=S.map((s,i)=>KC.simulate(cfgs[i],s,ctxOf(s,day,{cstock:Object.fromEntries(Object.keys(orders[i].runs['朝の便']).map(pid=>[pid,(al2[keys[i]].runs['朝の便']||{})[pid]||0]))})));   // 割り振りが0の品も0として渡す
    const out=res.map((r,i)=>CC.centerOut(c,C,r));for(const pid in start){const o=(out[0][pid]||0)+(out[1][pid]||0);assert.ok(o<=start[pid],'倉庫より多く出さない '+pid);}
    assert.ok(CC.csClose(c,C,cs,res),'2店の締め');assert.ok(!CC.csClose(c,C,cs,res[1]),'同じ日を2回引かない');
    for(const pid in start)assert.equal(cs.stock[pid],Math.max(0,start[pid]-(out[0][pid]||0)-(out[1][pid]||0)),'2店の分を引く '+pid);
    res.forEach((r,i)=>recs.push(CC.salesRecord(cfgs[i],S[i],r)));S=S.map((s,i)=>KC.closeDay(cfgs[i],s,res[i]).state);}
  assert.ok(recs.some(r=>r.store==='P-gate')&&recs.some(r=>r.store==='M-home'),'売上の記録は店ごと');
  // 配送会社：緑ヶ丘はトラックA、港駅はトラックB
  const R1=[{bin:'朝の便',f:200,c:100},{bin:'昼前の便',f:60,c:20},{bin:'午後の便',f:40,c:10}];
  const hz=HC.dayPlan(Hz,C,CC,{day:5,cond,slip:null,stores:[{key:'M-home',runs:R1},{key:'P-gate',runs:R1}]}),tr=new Set(hz.runs.filter(r=>r.leg==='cs').map(r=>r.truck));
  assert.ok(tr.has('A')&&tr.has('B'),'トラックA・Bが走る');
  // お金の流れ：センターの決まった費用は店の数で分ける（1店なら前と同じ）
  const base={day:5,runs:3,sales:100000,pl:{},delivered:{dr_tea:100},route:()=>'center',cost:()=>100,haiso:null};
  const L1=MC.dayLedger(MO,{...base,nStores:1}),L0=MC.dayLedger(MO,base),L2=MC.dayLedger(MO,{...base,nStores:2});
  assert.equal(JSON.stringify(L0),JSON.stringify(L1),'nStores なし＝1店');
  const fix=L=>L.inv.filter(x=>x.from==='center'&&x.to==='ext'&&(x.what.startsWith('センターの運営')||x.what.startsWith('倉庫'))).reduce((t,x)=>t+x.yen,0);
  assert.ok(Math.abs(fix(L2)-fix(L1)/2)<=2,'2店なら1店あたりの決まった費用は半分');}
console.log('minato-walk ok');
