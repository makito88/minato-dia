// 港駅の売店 4回目（橋：地元の店 → 売店）（2026-11-10）
//  ・橋 local-to-kiosk（js/links/local-to-kiosk.js）：ハーフェン堂（ワッフル）と汐見屋（へしこ）が自分で届ける。センターの便には載らない
//  ・届く数＝発注の数−前の夜の残り（お店の作れる数まで）。休みの日は届かない。少なめの日は半分（種と運行日で決まる）
//  ・買い取り：ワッフルは日持ち4日・へしこ60日を過ぎたら捨てる
//  ・強さ0・未接続なら null（前と同じ）。緑ヶ丘の店は変わらない（指紋は minato-store.test.cjs）
//  ・お金の流れ：route 'local' の品は「地元のお店へ」の行（ないときは行が出ない）
const assert=require('node:assert/strict');
for(const f of ['research-core','kiosk-staff','kiosk-walk','kiosk-core','minato-store-core','center-core','money-core','links/local-to-kiosk'])require('../js/'+f+'.js');
const K=require('../data/kiosk.json'),R=require('../data/research.json'),M=require('../data/minato-store.json'),L=require('../data/links.json'),MO=require('../data/money.json'),C=require('../data/center.json');
const {KioskCore:KC,MinatoStore:MS,LocalToKiosk:LK,MoneyCore:MC,CenterCore:CC}=globalThis;
const c=MS.cfg(K,M),I=KC.index(c);

// 1) 橋の形
const lk=L.links.find(x=>x.id===LK.ID);
assert.ok(lk&&lk.state==='temp'&&lk.strength>0,'仮の数値でつないだ');
for(const sh of M.localShops){const S=sh.supply;assert.ok(S&&S.arrive>0&&S.cap&&S.say&&S.say.normal===sh.say,'お店の事情 '+sh.id);for(const pid of sh.items)assert.ok(S.cap[pid]>0&&I.P[pid],'上限 '+pid);}
const off=JSON.parse(JSON.stringify(L));off.links.find(x=>x.id===LK.ID).strength=0;
const none=JSON.parse(JSON.stringify(L));none.links.find(x=>x.id===LK.ID).state='none';
{const st=MS.create(K,M,KC,{seed:3,day:1});assert.equal(LK.plan(off,M,st,{day:1}),null,'強さ0');assert.equal(LK.plan(none,M,st,{day:1}),null,'未接続');}

// 2) 14日：同じ条件なら同じ・センターの便に載らない・休み・上限・期限
const H=KC.H,a=new Array(H).fill(0).map((_,h)=>h>=5&&h<24?(h>=7&&h<9||h>=17&&h<19?400:150):0),fl=[a,a.map(x=>x*0.3),a.map(x=>x*0.2),a.map(x=>x*0.3)];
const ctxOf=(st,day,extra)=>Object.assign({day,dow:day%7,cond:{day:day%7===0?'hol':day%7===6?'sat':'wd',wx:day%5===0?'rain':'sun',season:'aut'},flows:{hb:fl,ha:fl},stops:new Array(H).fill(4),plats:2,rcfg:R,order:st.order,express:[],addOn:[],edits:[],startT:0},extra||{});
function run(Ln,days){let st=MS.create(K,M,KC,{seed:3,day:1});st.openedDay=1;const out=[],plans=[];
  for(let day=1;day<=days;day++){const p=LK.plan(Ln,M,st,{day});plans.push(p);const res=KC.simulate(c,st,ctxOf(st,day,p?{local:p}:{}));out.push(res);st=KC.closeDay(c,st,res).state;}return {out,plans,st};}
const A=run(L,21),B=run(L,21),Z=run(off,21);
assert.equal(JSON.stringify(A.out.map(r=>[r.pl,r.ev.length])),JSON.stringify(B.out.map(r=>[r.pl,r.ev.length])),'同じ条件なら同じ');
assert.equal(JSON.stringify(A.plans),JSON.stringify(B.plans),'届く数も同じ');
// 強さ0なら ctx.local なし＝3回目までと同じ道（地元のお店の品はセンターの朝の便）
{const st=MS.create(K,M,KC,{seed:3,day:1}),r1=KC.simulate(c,st,ctxOf(st,2)),r2=KC.simulate(c,st,ctxOf(st,2,{local:undefined}));assert.equal(JSON.stringify(r1.pl),JSON.stringify(r2.pl),'ctx.local がなければ前と同じ');
  const ev=r1.ev.find(e=>e.k==='delivery'&&e.name==='朝の便');assert.ok(ev.items.om_waffle2>0,'つなぐ前はセンターの朝の便で届いていた');}
const LP=new Set(M.localShops.flatMap(s=>s.items));let sold={},waste={},got={},closedSeen={hafen:0,shiomi:0},shortSeen=0,lcost=0;
A.out.forEach((r,i)=>{const day=i+1,p=A.plans[i];assert.ok(p,'橋の計画 '+day);
  for(const e of r.ev){if(e.k==='delivery'){for(const pid in e.items||{}){if(LP.has(pid))assert.ok(e.local,'地元の品はお店が届ける '+e.name+' '+pid);}
      if(e.local){const sh=M.localShops.find(s=>s.id===e.local);assert.equal(e.t,sh.supply.arrive,'届く時刻');assert.ok(!sh.supply.closedDow.includes(day%7),'休みの日は届かない');lcost+=e.cost;
        for(const pid in e.items){assert.ok(e.items[pid]<=sh.supply.cap[pid],'上限 '+pid);got[pid]=(got[pid]||0)+e.items[pid];}}}
    if(e.k==='buy')for(const [pid,q] of e.items)if(LP.has(pid))sold[pid]=(sold[pid]||0)+q;
    if(e.k==='waste'&&LP.has(e.pid))waste[e.pid]=(waste[e.pid]||0)+e.n;}
  for(const s of p.closed)closedSeen[s]++;if(p.say.some(x=>x.kind==='short'))shortSeen++;
  assert.ok(p.values.every(v=>v.day===day&&'value' in v),'{day,t,value} の形');});
assert.ok(closedSeen.hafen>=2&&closedSeen.shiomi>=2,'休みの日がある '+JSON.stringify(closedSeen));
assert.ok(got.om_waffle2>0&&got.om_hesiko>0&&(sold.om_waffle2||0)>0,'届いて売れる '+JSON.stringify({got,sold}));
assert.equal(A.plans[0].say.filter(x=>x.kind==='first').length,2,'はじめの日のひとこと');
// 日持ち：ワッフルは4日を過ぎたら捨てる。へしこ（60日）は21日では捨てない
for(const pid in A.st.lots)if(LP.has(pid))for(const x of A.st.lots[pid])assert.ok(21-x.d<(I.P[pid].life??99),'日持ちの中 '+pid);
assert.ok(!waste.om_hesiko,'へしこは捨てない');
// ジャンルの日持ち（おみやげは99）だけなら、ワッフルの期限切れはない
{let zw=0;for(const r of Z.out)for(const e of r.ev)if(e.k==='waste'&&e.pid&&e.pid.startsWith('om_waffle'))zw+=e.n;assert.equal(zw,0,'強さ0ならジャンルの日持ちのまま');}
// センターの品の記録（centerOut）に地元の品は入らない
for(const r of A.out){const o=CC.centerOut(c,C,r);for(const pid of LP)assert.ok(!o[pid],'センターの品に入らない '+pid);}

// 3) お金の流れ：route 'local' → 「地元のお店へ」
{const base={day:1,sales:1000,pl:{},delivered:{om_waffle2:3,dr_tea:2},cost:pid=>I.P[pid].cost,haiso:null,take:0.15};
  const L1=MC.dayLedger(MO,{...base,route:pid=>LP.has(pid)?'local':'center'}),x=L1.inv.find(v=>v.what.startsWith('地元のお店へ'));
  assert.ok(x&&x.from==='kiosk'&&x.to==='ext'&&x.yen===3*I.P.om_waffle2.cost,'地元のお店へ');
  const L0=MC.dayLedger(MO,{...base,delivered:{dr_tea:2},route:()=>'center'});assert.ok(!L0.inv.some(v=>v.what.startsWith('地元のお店へ')),'なければ行は出ない');}

const sumG=o=>Object.values(o).reduce((t,x)=>t+x,0);
console.log(`  地元のお店（21日）：届いた ${sumG(got)}個（${Object.entries(got).map(([p,q])=>I.P[p].short+q).join('・')}）・売れた ${sumG(sold)}個・捨てた ${sumG(waste)}個（${Object.entries(waste).map(([p,q])=>I.P[p].short+q).join('・')||'なし'}）・仕入れ ${lcost.toLocaleString()}円・休み ハーフェン堂${closedSeen.hafen}日／汐見屋${closedSeen.shiomi}日・少なめ ${shortSeen}回`);
console.log('minato-local.test ok');
