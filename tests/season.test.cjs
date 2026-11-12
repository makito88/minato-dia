// 季節のできごと（js/season-core.js・data/seasonal.json・data/seasonal-extra.json）
//  ・設定の形（駅の性格・ジャンル・目的・時台が正しい）
//  ・同じ種・同じ日なら、何度でも同じ（PC とスマホで同じ引き継ぎコードなら同じ）。種が変わると変わる
//  ・1年に何件か起き、決めた時期の幅の中にだけ起きる。1日の上限を守る
//  ・売店：genre がないときは、今までとまったく同じ結果（乱数の引き方を変えない）
// 中身（どのできごとがいつか）は表示しない
const assert=require('node:assert/strict');
require('../js/season-core.js');
const SC=globalThis.SeasonCore,A=require('../data/seasonal.json'),B=require('../data/seasonal-extra.json'),K=require('../data/kiosk.json');
const cfg=SC.merge(A,B),G=new Set(K.genres.map(g=>g.id)),ST=Object.keys(cfg.stations),TR=new Set(Object.values(cfg.stations).flat());

// 1) 設定の形
const ids=new Set();
for(const e of cfg.list){assert.ok(e.id&&!ids.has(e.id),'id '+e.id);ids.add(e.id);
  assert.ok(Array.isArray(e.when)&&e.when.length===2&&e.when.every(x=>/^\d\d-\d\d$/.test(x)),e.id+' when');
  if(e.scope!=='line'){assert.ok(e.where&&Object.keys(e.where).length,e.id+' where');for(const t in e.where)assert.ok(TR.has(t),e.id+' where の性格がない '+t);
    assert.ok(Object.keys(SC.stationWeights(cfg,e)).length>0,e.id+' 起きる駅がない');}
  for(const r of e.rail||[]){assert.ok(r.p.every(p=>p>=0&&p<4),e.id+' p');assert.ok(r.h[0]>=4&&r.h[1]<=30&&r.h[0]<r.h[1],e.id+' h');assert.ok(Math.abs(r.k)<=1.5,e.id+' k');}
  for(const g in e.kiosk||{})assert.ok(G.has(g),e.id+' ジャンルがない '+g);
  assert.ok(e.letter&&e.letter.title&&e.letter.body,e.id+' letter');}
assert.ok(cfg.list.length>=20,'できごとの数');

// 2) 暦の番号
const i0=SC.indexOf(2026,11,10);assert.equal(SC.ymdOf(i0),'2026-11-10');assert.equal(SC.partsOf(i0).dow,2);
assert.equal(SC.opIndex(Date.UTC(2026,10,9,19,29)),i0-1);   // 日本時間 11/10 4:29 はまだ前の運行日
assert.equal(SC.opIndex(Date.UTC(2026,10,9,19,31)),i0);

// 3) 同じ種なら同じ・1年に何件か・幅の中だけ・1日の上限
function year(seed,y){const a=SC.indexOf(y,1,1),b=SC.indexOf(y,12,31),out=[];for(let i=a;i<=b;i++){const L=SC.today(cfg,seed,i);assert.ok(L.length<=cfg.maxPerDay);for(const o of L)out.push(o);}return out;}
const Y1=year(12345,2027),Y2=year(12345,2027),Y3=year(999,2027);
assert.deepEqual(Y1.map(o=>[o.i,o.id,o.st,o.mag]),Y2.map(o=>[o.i,o.id,o.st,o.mag]));
assert.notDeepEqual(Y1.map(o=>[o.i,o.id,o.st]),Y3.map(o=>[o.i,o.id,o.st]));
assert.ok(Y1.length>=25&&Y1.length<=120,'1年の件数 '+Y1.length);
const inWin=(e,i)=>{const p=SC.partsOf(i);for(const y of [p.y-1,p.y]){const [a,b]=SC.windowOf(e.when,y);if(i>=a&&i<=b)return true;}return false;};
for(const o of Y1){assert.ok(inWin(o.ev,o.i),o.id+' 幅の外');if(o.ev.dow)assert.ok(o.ev.dow.includes(SC.partsOf(o.i).dow),o.id+' 曜日');if(o.st)assert.ok(ST.includes(o.st));}
// 一部の日だけで（年の途中から計算しても）同じ
const mid=SC.indexOf(2027,8,1);assert.deepEqual(SC.today(cfg,12345,mid),Y1.filter(o=>o.i===mid));

// 4) 効き目
const any=Y1.find(o=>o.st&&o.ev.kiosk),L=[any];const R=SC.railRules(cfg,L);
let up=false;for(let h=4;h<30;h++)for(let p=0;p<4;p++)if(SC.railFactor(R,'C',any.st==='C'?'S':any.st,h,p)>1)up=true;
assert.ok(up||any.st==='C','鉄道の倍率');
const fx=SC.kioskFx(cfg,L,any.st);assert.ok(fx&&Object.values(fx).some(v=>v>1));assert.equal(SC.kioskFx(cfg,L,any.st==='C'?'S':'C'),null);
assert.deepEqual(SC.mergeFx({em:1.1},null),{em:1.1});assert.deepEqual(SC.mergeFx({em:1.1},{snack:1.2}),{em:1.1,genre:{snack:1.2}});

// 5) 売店：genre がなければ今までと同じ／あれば変わる
for(const f of ['research-core','kiosk-staff','kiosk-core'])require('../js/'+f+'.js');
const KC=globalThis.KioskCore,RC=globalThis.ResearchCore,Rc=require('../data/research.json');
const st=KC.create(K,{st:'S',place:'home',seed:7}),H=KC.H,fl0=new Array(H).fill(0).map((_,h)=>h>=5&&h<24?150:0),fl=[fl0,fl0,fl0,fl0];
const ctx={day:3,dow:3,cond:{day:'wd',wx:'sun',season:'aut'},flows:{hb:fl,ha:fl},stops:new Array(H).fill(4),plats:2,rcfg:Rc,order:st.order,express:[],addOn:[],edits:[],startT:0};
const a=KC.simulate(K,st,ctx),b=KC.simulate(K,st,{...ctx,fx:{}}),c=KC.simulate(K,st,{...ctx,fx:{genre:{colddrink:1.8,gummy:1.8}}});
assert.deepEqual(a.sold,b.sold);assert.notDeepEqual(a.sold,c.sold);
console.log(`season ok（${cfg.list.length}件・1年に${Y1.length}回）`);
