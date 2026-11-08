// 荷物の行方（js/track-core.js）のテスト： node tests/track-core.test.cjs
const assert=require('assert'),T=require('../js/track-core.js'),C=require('../data/center.json');
assert.strictEqual(T.fmt(-300),'前日19:00');assert.strictEqual(T.fmt(150),'2:30');assert.strictEqual(T.fmt(330),'5:30');assert.strictEqual(T.fmt(1440+330),'翌日5:30');
const g={a:'onigiri',b:'sand',c:'colddrink'};
const o={day:5,key:'M-home',order:{no:'O0005-M-home',factory:{a:10,b:4},center:{c:6},direct:{}},fix:{no:'F0005'},
  slip:{no:'N0005',store:{no:'O0005-M-home',items:{a:[10,8],b:[4,4]},short:{n:1,q:2}}},
  runs:[{f:{a:5,b:2},c:6,d:0},{f:{a:2,b:1},c:0,d:0},{f:{a:1,b:1},c:0,d:0}],genreOf:p=>g[p]};
const tl=T.timeline(C,o);
assert.strictEqual(tl.truck.id,'A');assert.strictEqual(tl.truck.min,55);
// 工程の時刻は時刻表どおり（前日19:00 → 2:30 包装 → 3:05 出発 → 3:20 センター）
const S=Object.fromEntries(tl.steps.map(s=>[s.id,s.t]));
assert.deepStrictEqual([S.rec,S.sum,S.fix,S.pack,S.load,S.go1,S.ctr],[-300,-270,-240,150,170,185,200]);
for(let i=1;i<tl.steps.length;i++)assert.ok(tl.steps[i].t>=tl.steps[i-1].t,'時刻の順');
// 便：センター発 → 店着 → 棚。どの便も棚より前に店に着く
assert.deepStrictEqual(tl.runs.map(r=>[r.depart,r.arrive,r.shelf]),[[240,295,330],[555,610,630],[855,910,930]]);
assert.ok(/2個足りない/.test(tl.steps.find(s=>s.id==='pack').note));
// いまどこ
const at=t=>T.where(tl,t);
assert.strictEqual(at(-400).label,'まだ注文の前');
assert.strictEqual(at(-260).label,'注文受付');
assert.strictEqual(at(0).label,'製造中');
assert.strictEqual(at(160).label,'包装・検品');
assert.strictEqual(at(180).label,'積み込み');
assert.strictEqual(at(190).label,'配送中（工場→センター）');
assert.strictEqual(at(210).label,'センターで仕分け');
assert.strictEqual(at(250).label,'配送中（センター→売店）');
assert.strictEqual(at(290).label,'もうすぐ到着');
assert.strictEqual(at(300).label,'売店に到着・品出し');
assert.strictEqual(at(300).eta,295);assert.strictEqual(at(300).shelf,330);
const w=at(400);assert.strictEqual(w.label,'センターの部屋で待つ');assert.strictEqual(w.nextBin,'昼前の便');assert.deepStrictEqual(w.shelved,['朝の便']);
assert.strictEqual(at(580).label,'配送中（センター→売店）');
assert.ok(at(1000).done);
// 昼前・午後に品がなければ、朝の便で終わり
const tl2=T.timeline(C,{...o,runs:[o.runs[0],{},{}]});assert.ok(T.where(tl2,340).done);
// お客さん：きょうのこれからの便と、あすの便（このジャンルをのせる便だけ）
const D=require('../data/kiosk.json').deliveries;
const st=T.shelfTimes({genre:'bread',now:600,today:[{t:330,q:3},{t:630,q:2,bin:'昼前の便'}],tomorrowQ:7,deliveries:D});
assert.deepStrictEqual(st.map(x=>[x.day,x.t,x.q]),[[0,630,2],[1,330,7],[1,630,null]]);
const sp=T.shelfTimes({genre:'snack',now:1300,today:[],tomorrowQ:null,deliveries:D});assert.deepStrictEqual(sp.map(x=>x.t),[330]);
// 川辺（センターのとなり・5分）：もうすぐ到着はセンターを出たあと
const tk=T.timeline(C,{...o,key:'K-home'});assert.deepStrictEqual([tk.runs[0].depart,tk.runs[0].soon,tk.runs[0].arrive],[240,240,245]);
for(const r of tk.runs.concat(tl.runs))assert.ok(r.depart<=r.soon&&r.soon<=r.arrive&&r.arrive<=r.shelf);
console.log('track-core: ok');
