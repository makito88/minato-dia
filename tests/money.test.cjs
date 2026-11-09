// お金の流れ（js/money-core.js）
//  ・会社どうしの請求書は、払った側と受け取った側で同じ（グループの中で消えない・増えない）
//  ・4つの会社の出入りの合計＝お客さんから入ったお金−外へ出たお金
//  ・売店→センターの仕入れ代金＝その日に届いた品（工場の品・センターの品）×仕入れ値
const assert=require('node:assert/strict');
for(const f of ['research-core','kiosk-staff','kiosk-core','center-core','haiso-core','money-core'])require('../js/'+f+'.js');
const K=require('../data/kiosk.json'),R=require('../data/research.json'),C=require('../data/center.json'),H=require('../data/haiso.json'),M=require('../data/money.json');
const {KioskCore:KC,CenterCore:CC,HaisoCore:HC,MoneyCore:MC}=globalThis;
const Hh=KC.H,a=new Array(Hh).fill(0).map((_,h)=>h>=5&&h<24?150:0),fl=[a,a,a,a],cond={day:'wd',wx:'sun',season:'aut'};
const st=KC.create(K,{st:'M',place:'home',seed:3});
const res=KC.simulate(K,st,{day:5,dow:5,cond,flows:{hb:fl,ha:fl},stops:new Array(Hh).fill(4),plats:2,rcfg:R,order:st.order,express:[],addOn:[],edits:[],startT:0});
const P=Object.fromEntries(K.products.map(p=>[p.id,p])),route=pid=>CC.routeOf(C,P[pid].genre),dl={},runs={};
for(const e of res.ev){if(e.k!=='delivery'||e.express)continue;const x=runs[e.name]||(runs[e.name]={bin:e.name,f:0,c:0});for(const pid in e.items){dl[pid]=(dl[pid]||0)+e.items[pid];if(route(pid)==='factory')x.f+=e.items[pid];else if(route(pid)==='center')x.c+=e.items[pid];}}
const hz=HC.dayPlan(H,C,CC,{day:5,cond,slip:null,stores:[{key:'M-home',runs:Object.values(runs)}]});
const L=MC.dayLedger(M,{day:5,nStores:1,runs:3,sales:res.pl.sales,pl:res.pl,delivered:dl,route,cost:pid=>P[pid].cost,haiso:hz});
for(const x of L.inv)assert.ok(x.yen>0&&x.what,'請求書');
const net=Object.values(L.co).reduce((t,c)=>t+c.net,0);assert.equal(net,L.ext.in-L.ext.out,'会社の出入りの合計＝外から入った−外へ出た');
let buy=0;for(const pid in dl)if(route(pid)!=='direct')buy+=dl[pid]*P[pid].cost;
const k2c=L.inv.filter(x=>x.from==='kiosk'&&x.to==='center'&&x.what.startsWith('仕入れ')).reduce((t,x)=>t+x.yen,0);assert.ok(Math.abs(k2c-buy)<=2,'売店→センター＝届いた品×仕入れ値');
assert.equal(L.co.kiosk.in,Math.round(res.pl.sales),'売店に入ったお金＝売上');
const c2h=L.inv.filter(x=>x.to==='haiso').reduce((t,x)=>t+x.yen,0);assert.equal(c2h,hz.sum.fare,'配送会社に入ったお金＝運賃');
assert.equal(L.inv.find(x=>x.what.startsWith('センターフィー')).yen,M.centerFee.perRun*3,'B：センターフィー＝便の数×1便の料金');
// A：決まった費用はセンター全体で1つ。店を増やす試算では、センターの1店あたりの負担が下がる
const keys=['M-home','K-home','C-home','C-gate','S-home','U-home'],hzFor=n=>HC.dayPlan(H,C,CC,{day:5,cond,slip:null,stores:keys.slice(0,n).map(key=>({key,runs:Object.values(runs)}))});
const PJ=MC.project(M,L,hzFor,[1,2,4,6]);assert.ok(PJ[3].center>PJ[0].center,'店が増えるとセンターは良くなる');assert.ok(PJ[3].haiso.profit>PJ[0].haiso.profit,'配送会社も');
console.log('  試算：',PJ.map(r=>`${r.n}店 配送${r.haiso.profit}・センター${r.center}`).join('／'));
// 人件費：センターは運営の人・建物・仕分けの人（扱う個数で時間が増える）、配送会社は運転手のシフト
const c1=MC.centerCost(M,400),c2=MC.centerCost(M,6000);assert.ok(c2.sortH>c1.sortH&&c2.total>c1.total,'個数が増えると仕分けの時間が増える');assert.equal(c1.ops,c2.ops,'運営の人は個数によらない');
assert.ok(hz.sum.labor>0&&hz.sum.drivers>=3,'運転手のシフト');
// 外の配達先を足すと、センターと配送会社の収入が増える
const hzX=(n,m)=>HC.dayPlan(H,C,CC,{day:5,cond,slip:null,stores:[...keys.slice(0,n).map(key=>({key,runs:Object.values(runs)})),...Array.from({length:m||0},(_,i)=>({key:['K','C','S','U','M','F'][i%6]+'-x'+i,ext:true,runs:[{bin:M.ext.bin,f:0,c:M.ext.carts*H.perCart.center}]}))]});
const X0=MC.project(M,L,hzX,[1],0)[0],X20=MC.project(M,L,hzX,[1],20)[0];assert.ok(X20.haiso.fare>X0.haiso.fare&&X20.extIn>0,'外の配達先');
const S=MC.sumDays([L,L]);assert.equal(S.co.kiosk.net,L.co.kiosk.net*2);
console.log('money.test ok',Object.entries(L.co).map(([k,c])=>`${k} ${c.net}`).join('・'),'グループ',net);
