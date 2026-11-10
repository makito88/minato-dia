// 港駅の売店 8回目（客船の日）（2026-11-10）
//  ・港の島 js/port-core.js：客船が寄る日は「保存の種＋暦の年」だけで決まる（季節のできごとと同じ作り）
//  ・橋 port-to-all（js/links/port-to-all.js）：季節のできごとと同じ形の1件（鉄道の倍率・売店のジャンル・便り）＋ ctx.cruise
//  ・強さ0・未接続なら null。港駅以外の売店のジャンルは変わらない
//  ※ いつ寄るかは、テストの表示にも出さない（数だけ）
const assert=require('node:assert/strict');
for(const f of ['season-core','port-core','links/port-to-all','research-core','kiosk-staff','kiosk-walk','kiosk-core','minato-store-core'])require('../js/'+f+'.js');
const P=require('../data/port.json'),L=require('../data/links.json'),SJ=require('../data/seasonal.json'),K=require('../data/kiosk.json'),R=require('../data/research.json'),M=require('../data/minato-store.json');
const {SeasonCore:S,PortCore:PC,PortToAll:PT,KioskCore:KC,MinatoStore:MS}=globalThis;

// 1) 橋の形
const lk=L.links.find(x=>x.id===PT.ID);assert.ok(lk&&lk.state==='temp'&&lk.strength>0,'仮の数値でつないだ');
const off=JSON.parse(JSON.stringify(L));off.links.find(x=>x.id===PT.ID).strength=0;
const none=JSON.parse(JSON.stringify(L));none.links.find(x=>x.id===PT.ID).state='none';

// 2) 1年の数・同じ種なら同じ・種がちがえばちがう
const a=S.indexOf(2027,1,1),b=S.indexOf(2028,1,1);
const days=seed=>{const o=[];for(let i=a;i<b;i++){const c=PC.today(P,seed,i);if(c)o.push(i);}return o;};
const mn=P.calls.reduce((t,c)=>t+(c.chance!=null&&c.chance<1?0:c.times[0]),0),mx=P.calls.reduce((t,c)=>t+c.times[1],0);
for(const seed of [1,2,3,99,12345]){const d=days(seed);assert.ok(d.length>=mn&&d.length<=mx,'1年に寄る回数 '+d.length);assert.deepEqual(d,days(seed),'同じ種なら同じ');}
assert.notDeepEqual(days(1),days(2),'種がちがえばちがう日');

// 3) 橋の結果：季節のできごとと同じ形で使える
const seed=7,hit=days(seed)[0],miss=hit+1;
assert.equal(PT.plan(off,P,seed,hit),null,'強さ0');assert.equal(PT.plan(none,P,seed,hit),null,'未接続');
if(!PC.today(P,seed,miss))assert.equal(PT.plan(L,P,seed,miss),null,'寄らない日は null');
const p=PT.plan(L,P,seed,hit);assert.ok(p&&p.item.st===P.station&&p.item.ev.letter.body.length,'できごと1件');
assert.ok(!/\{(ship|from|pax|arr|dep)\}/.test(p.item.ev.letter.body.join('')+p.item.ev.letter.title.join('')),'便りの穴埋め');
assert.ok(p.cruise.pax===p.call.pax&&p.cruise.from>p.call.arr&&p.cruise.to<p.call.dep,'売店に来る時刻');
assert.ok(p.values.every(v=>v.day===hit&&'value' in v),'{day,t,value} の形');
const rules=S.railRules(SJ,[p.item]);
const kOut=S.railFactor(rules,'P','X',Math.floor(p.call.arr/60)+1,2),kBack=S.railFactor(rules,'X','P',Math.floor(p.call.dep/60)-2,2),kCom=S.railFactor(rules,'X','P',8,0);
assert.ok(kOut>1.2&&kBack>1.2&&kCom===1,'港駅の観光の人がふえる（通勤は変わらない） '+[kOut,kBack,kCom]);
const gP=S.kioskFx(SJ,[p.item],'P'),gX=S.kioskFx(SJ,[p.item],'G');
assert.ok(gP&&gP.omiyage>1.2,'港駅の売店はおみやげが売れやすい');assert.equal(gX,null,'ほかの駅の売店は変わらない');

// 4) 港駅の店：客船の日は客船の客が来て、おみやげが売れる
const c=MS.cfg(K,M),H=KC.H,fa=new Array(H).fill(0).map((_,h)=>h>=5&&h<24?(h>=7&&h<9||h>=17&&h<19?400:150):0),fl=[fa,fa.map(x=>x*0.3),fa.map(x=>x*0.2),fa.map(x=>x*0.3)];
const ctxOf=(st,day,extra)=>Object.assign({day,dow:day%7,cond:{day:'wd',wx:'sun',season:'aut'},flows:{hb:fl,ha:fl},stops:new Array(H).fill(4),plats:2,rcfg:R,order:st.order,express:[],addOn:[],edits:[],startT:0},extra||{});
let omi0=0,omi1=0,cru=0,sal0=0,sal1=0;
for(let d=1;d<=5;d++){const st=MS.create(K,M,KC,{seed:d,day:1});
  const r0=KC.simulate(c,st,ctxOf(st,d)),r1=KC.simulate(c,st,ctxOf(st,d,{fx:S.mergeFx(undefined,gP),cruise:p.cruise}));
  const om=r=>Object.entries(r.sold).filter(([k])=>c.products.find(x=>x.id===k).genre==='omiyage').reduce((t,[,q])=>t+q,0);
  omi0+=om(r0);omi1+=om(r1);cru+=r1.walk.cruise;sal0+=r0.pl.sales;sal1+=r1.pl.sales;assert.ok(!r0.walk.cruise,'ふだんの日は来ない');}
assert.ok(cru>0&&omi1>omi0&&sal1>sal0,'客船の日 '+JSON.stringify({omi0,omi1,cru}));
console.log(`  客船の日：1年に ${days(1).length}・${days(2).length}・${days(3).length} 回（種ごと）・港駅の店（5日の平均）客船の客 ${Math.round(cru/5)}人・おみやげ ${(omi0/5).toFixed(1)} → ${(omi1/5).toFixed(1)}個・売上 ${Math.round(sal0/5).toLocaleString()} → ${Math.round(sal1/5).toLocaleString()}円`);
console.log('port.test ok');
