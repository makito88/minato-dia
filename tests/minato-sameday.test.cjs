// 港駅の売店 7回目（橋：できたての便）（2026-11-10）
//  ・橋 factory-to-kiosk-sameday（js/links/factory-to-kiosk-sameday.js）：工場の朝の組が 6:00 から作り、8:00 に出荷 → みなと川運輸の昼の便 → 10:00ごろ港駅の店
//  ・{day, t, value} の t に確定した時刻（出荷の数は出荷の時刻、着いた時刻は着いた時刻）
//  ・その分は昼前の便から減る。棚に「できたて」の札（選ばれやすさ・仮）。料金は pl.sameday
//  ・強さ0・未接続なら null（前と同じ）。緑ヶ丘の店は変わらない（指紋は minato-store.test.cjs）
const assert=require('node:assert/strict');
for(const f of ['research-core','kiosk-staff','kiosk-walk','kiosk-core','minato-store-core','links/factory-to-kiosk-sameday'])require('../js/'+f+'.js');
const K=require('../data/kiosk.json'),R=require('../data/research.json'),M=require('../data/minato-store.json'),L=require('../data/links.json'),F=require('../data/factory.json'),HJ=require('../data/haiso.json');
const {KioskCore:KC,MinatoStore:MS,FactoryToKioskSameday:SD}=globalThis;
const c=MS.cfg(K,M),I=KC.index(c),CF={F,H:HJ,M};

// 1) 橋の形と設定
const lk=L.links.find(x=>x.id===SD.ID);
assert.ok(lk&&lk.state==='temp'&&lk.strength>0&&lk.read.at===F.sameday.ship,'仮の数値でつないだ・確定の時刻');
for(const pid of M.sameday.items)assert.ok(I.P[pid]&&I.P[pid].genre==='onigiri'&&F.sameday.cap[pid]>0,'品と上限 '+pid);
assert.ok(c.deliveries.some(d=>d.name===M.sameday.replace&&d.genres.includes('onigiri')),'減らす便がある');
const off=JSON.parse(JSON.stringify(L));off.links.find(x=>x.id===SD.ID).strength=0;
const none=JSON.parse(JSON.stringify(L));none.links.find(x=>x.id===SD.ID).state='none';
{const st=MS.create(K,M,KC,{seed:3,day:1});assert.equal(SD.plan(off,CF,st,{day:1}),null,'強さ0');assert.equal(SD.plan(none,CF,st,{day:1}),null,'未接続');
  assert.equal(SD.plan(L,{F:{},H:HJ,M},st,{day:1}),null,'設定がなければ null');}

// 2) 計画：時刻・{day,t,value}・釜の遅れ・雨の遅れ・上限
{const st=MS.create(K,M,KC,{seed:3,day:1});let trouble=0,rainMin=1e9,sunMax=0;
  for(let day=1;day<=300;day++){const wx=day%4===0?'rain':'sun',p=SD.plan(L,CF,st,{day,cond:{wx}});assert.ok(p,'計画 '+day);
    assert.equal(JSON.stringify(p),JSON.stringify(SD.plan(L,CF,st,{day,cond:{wx}})),'同じ日なら同じ');
    assert.ok(p.ship>=F.sameday.ship&&p.arrive===p.ship+HJ.sameday.min+p.delay,'時刻のつじつま');
    const vs=Object.fromEntries(p.values.map(v=>[v.name,v]));assert.ok(vs.shipped.day===day&&vs.shipped.t===p.ship&&vs.arrive.t===p.arrive,'t に確定した時刻');
    for(const pid in p.items){assert.ok(p.items[pid]<=F.sameday.cap[pid]&&p.items[pid]<=p.want[pid],'上限 '+pid);}
    if(p.trouble){trouble++;assert.equal(p.ship,F.sameday.ship+F.sameday.trouble.late,'釜の遅れの日は遅い');}
    if(wx==='rain')rainMin=Math.min(rainMin,p.delay);else sunMax=Math.max(sunMax,p.delay);}
  assert.ok(trouble>=5&&trouble<=45,'釜の遅れの日がときどき '+trouble);assert.ok(rainMin>=HJ.sameday.delay.wx.rain&&sunMax<=HJ.sameday.delay.max,'雨の日の遅れ');}

// 3) 14日：昼前の便から減る・着いた時刻に届く・料金・同じなら同じ・ctx.sameday がなければ前と同じ
const H=KC.H,a=new Array(H).fill(0).map((_,h)=>h>=5&&h<24?(h>=7&&h<9||h>=11&&h<13||h>=17&&h<19?400:150):0),fl=[a,a.map(x=>x*0.3),a.map(x=>x*0.2),a.map(x=>x*0.3)];
const ctxOf=(st,day,extra)=>Object.assign({day,dow:day%7,cond:{day:day%7===0?'hol':day%7===6?'sat':'wd',wx:day%5===0?'rain':'sun',season:'aut'},flows:{hb:fl,ha:fl},stops:new Array(H).fill(4),plats:2,rcfg:R,order:st.order,express:[],addOn:[],edits:[],startT:0},extra||{});
const SP=new Set(M.sameday.items);
function run(Ln,days,kOne,seed){let st=MS.create(K,M,KC,{seed:seed||5,day:1});st.openedDay=1;const out=[],plans=[];
  for(let day=1;day<=days;day++){const cx=ctxOf(st,day);let p=SD.plan(Ln,CF,st,{day,cond:cx.cond});if(p&&kOne)p={...p,tag:{...p.tag,k:1}};plans.push(p);
    const res=KC.simulate(c,st,p?{...cx,sameday:p}:cx);out.push(res);st=KC.closeDay(c,st,res).state;}return {out,plans};}
const A=run(L,14),B=run(L,14),Z=run(off,14),A1=run(L,14,true);
assert.equal(JSON.stringify(A.out.map(r=>[r.pl,r.ev.length])),JSON.stringify(B.out.map(r=>[r.pl,r.ev.length])),'同じ条件なら同じ');
{const st=MS.create(K,M,KC,{seed:5,day:1}),r1=KC.simulate(c,st,ctxOf(st,2)),r2=KC.simulate(c,st,ctxOf(st,2,{sameday:undefined}));
  assert.equal(JSON.stringify(r1.pl),JSON.stringify(r2.pl),'ctx.sameday がなければ前と同じ');assert.ok(!('sameday' in r1.pl),'料金の欄も出ない');}
let got=0,fee=0;const soldF={on:0,all:0},soldF1={on:0,all:0};
A.out.forEach((r,i)=>{const p=A.plans[i],z=Z.out[i];
  const e=r.ev.find(x=>x.k==='delivery'&&x.sameday);assert.ok(e&&e.t===Math.max(p.arrive,c.open[0]*60-1)&&e.carrier==='みなと川運輸','できたての便 '+(i+1));
  assert.deepEqual(e.items,p.items,'届いた数＝出荷の数');got+=e.n;fee+=r.pl.sameday;assert.equal(r.pl.sameday,HJ.sameday.fee,'料金');
  const mid=r.ev.find(x=>x.k==='delivery'&&x.name===M.sameday.replace),mid0=z.ev.find(x=>x.k==='delivery'&&x.name===M.sameday.replace);
  for(const pid of SP)assert.equal((mid.items[pid]||0)+(p.items[pid]||0),Math.max(mid0.items[pid]||0,p.items[pid]||0),'昼前の便から減る '+pid);});
// 札の効き目：札のある時間に、おにぎりの中で札の品が選ばれる割合（k=1 と比べる）
const share=(R0,acc)=>R0.out.forEach((r,i)=>{const p=R0.plans[i];for(const e of r.ev){if(e.t<p.tag.from||e.t>=p.tag.to)continue;if(e.k==='buy')for(const [pid,q] of e.items){if(I.P[pid].genre==='onigiri'){acc.all+=q;if(SP.has(pid))acc.on+=q;}}else if(e.k==='look'&&e.why==='売り切れ'&&e.pid&&I.P[e.pid].genre==='onigiri'){acc.all++;if(SP.has(e.pid))acc.on++;}}});   // 売り切れで買えなかった人も「選んだ」に数える（札の品が早く売り切れると、買えた数だけでは比べられないため）
share(A,soldF);share(A1,soldF1);
for(const sd of [6,7,8]){share(run(L,14,false,sd),soldF);share(run(L,14,true,sd),soldF1);}   // 2026-11-11：1つの種だけだとぶれで逆になることがあるので、種を4つ合わせて比べる（客の「どこから・どこへ」を足したとき）
assert.ok(soldF.on/soldF.all>soldF1.on/soldF1.all,'札のある品が選ばれやすい '+JSON.stringify({soldF,soldF1}));
console.log(`  できたての便（14日）：届いた ${got}個・料金 ${fee.toLocaleString()}円・札の時間のおにぎりのうち札の品 ${(soldF.on/soldF.all*100).toFixed(1)}%（札の効き目なし ${(soldF1.on/soldF1.all*100).toFixed(1)}%）・着いた時刻 ${A.plans.map(p=>Math.floor(p.arrive/60)+':'+String(p.arrive%60).padStart(2,'0')).join(' ')}`);
console.log('minato-sameday.test ok');
