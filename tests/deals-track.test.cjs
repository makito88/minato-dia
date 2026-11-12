/* 取引の相談窓口 第5回：荷物の行方に取引先の分（js/track-core.js の dealTimeline・dealWhere）のテスト： node tests/deals-track.test.cjs */
const assert=require('assert'),fs=require('fs'),path=require('path'),T=require('../js/track-core.js'),C=require('../data/center.json'),D=require('../data/deals.json');
/* 1) 販売・店まで届ける：前日18:00 確定 → 20:00 工場へ → 製造 → 2:30 包装 → 3:05 工場発 → 3:20 センター → 便の出発 → 着く */
const sell={id:'5-0',kind:'sell',name:'テストマート',fixAt:D.fixAt,line:'rice',lineName:'おにぎり',hand:'deliver',handT:420,st:'C',q:300,s:280,to:'C',toName:'中央駅',w:[360,420],bin:'朝の便',arr:300,late:0,help:0,miss:false};
let tl=T.dealTimeline(C,sell);const id=tl.steps.map(s=>s.id),tt=Object.fromEntries(tl.steps.map(s=>[s.id,s.t]));
assert.deepStrictEqual(id,['fix','add','make','pack','go1','ctr','dep','end']);
assert.deepStrictEqual([tt.fix,tt.add,tt.pack,tt.go1,tt.ctr,tt.dep,tt.end],[-360,-240,150,185,200,240,300]);
for(let i=1;i<tl.steps.length;i++)assert.ok(tl.steps[i].t>=tl.steps[i-1].t,'時刻の順');
assert.ok(/280\/300・20個足りない/.test(tl.steps.find(s=>s.id==='pack').note),'足りない数は納品書から');
assert.strictEqual(tl.est,false,'便の計算の時刻をそのまま使う');
/* 便の計算がないときは目安（出発＋駅までの分＋積みおろし2回） */
tl=T.dealTimeline(C,{...sell,arr:null});assert.strictEqual(tl.end,240+25+30);assert.strictEqual(tl.est,true);
/* 2) 取りに来る・問屋の便：包装のあと、受け渡しの時刻で終わる */
tl=T.dealTimeline(C,{...sell,hand:'pickup',handT:330,bin:null,w:null,s:null});assert.deepStrictEqual(tl.steps.map(s=>s.id),['fix','add','make','pack','end']);assert.strictEqual(tl.end,330);
assert.ok(/納品書で決まる/.test(tl.steps.find(s=>s.id==='pack').note),'納品書の前は数がまだ');
tl=T.dealTimeline(C,{...sell,hand:'via',handT:300,bin:null,w:null});assert.ok(/問屋の便/.test(tl.steps.at(-1).label));
/* 3) 配送の契約：確定 → 積む（出発の30分前）→ 出発 → 着く。遅れ・応援便・便にのらなかった */
const haul={id:'6-1',kind:'haul',name:'テスト病院',fixAt:D.fixAt,carts:1.5,from:'川辺の配送センター（荷主が持ち込む）',cargo:'チルド',other:false,to:'F',toName:'森下駅',w:[540,660],bin:'昼前の便',arr:680,late:20,help:1,miss:false};
tl=T.dealTimeline(C,haul);assert.deepStrictEqual(tl.steps.map(s=>[s.id,s.t]),[['fix',-360],['load',555-(C.track.deal.load)],['dep',555],['end',680]]);
assert.ok(/20分遅れ/.test(tl.steps.at(-1).note)&&/応援便/.test(tl.steps.at(-1).note));assert.ok(/仕分け料/.test(tl.steps[1].note));
tl=T.dealTimeline(C,{...haul,arr:null,late:0,miss:true});assert.strictEqual(tl.miss,true);assert.ok(/のらなかった/.test(tl.steps.at(-1).note));
assert.strictEqual(T.dealWhere(tl,2000).label,'届けられなかった');
/* 冷凍（自社で運べない）：港浜急送が積む → はばの終わりに着く（目安） */
tl=T.dealTimeline(C,{...haul,other:true,arr:null,late:0,help:0,bin:null});assert.deepStrictEqual(tl.steps.map(s=>[s.id,s.t]),[['fix',-360],['load',540-C.track.deal.other],['end',660]]);assert.strictEqual(tl.est,true);
/* 4) いまどこ */
tl=T.dealTimeline(C,sell);const W=t=>T.dealWhere(tl,t);
assert.strictEqual(W(-400).i,-1);assert.strictEqual(W(-300).label,'テストマートの注文の数が確定');assert.strictEqual(W(-300).next,-240);
assert.ok(/製造中/.test(W(0).label));assert.strictEqual(W(190).label,'工場を出る（センターへ）');assert.strictEqual(W(250).label,'朝の便が出発');
assert.strictEqual(W(300).done,true);assert.strictEqual(W(300).label,'受け渡しが済んだ');
/* 5) 同じ入力なら同じ（数を計算し直さない・乱数を使わない） */
assert.deepStrictEqual(T.dealTimeline(C,sell),T.dealTimeline(C,JSON.parse(JSON.stringify(sell))));
/* 6) 約束：track-core.js は窓口（DealsCore・dia-deals）を直接読まない。数は kiosk-view.js の minatoKiosk.dealTrack が集める。行の途中の // を書かない */
const src=fs.readFileSync(path.join(__dirname,'../js/track-core.js'),'utf8').replace(/\/\*[\s\S]*?\*\//g,'');   /* コメントは除く */
assert.ok(!/DealsCore|dia-deals|localStorage|document\./.test(src),'track-core は計算だけ');
const kv=fs.readFileSync(path.join(__dirname,'../js/kiosk-view.js'),'utf8');assert.ok(/dealTrack\(day\)\{/.test(kv),'minatoKiosk.dealTrack');
const dv=fs.readFileSync(path.join(__dirname,'../js/deals-view.js'),'utf8');assert.ok(/TrackCore/.test(dv)&&/minatoKiosk\.dealTrack/.test(dv),'窓口の画面は読むだけ');
assert.ok(!/minatoKiosk\.dealTrack[^;]*setItem/.test(dv),'荷物の行方では保存しない');
/* 7) 設定は data/：center.json の track.deal */
assert.ok(C.track.deal&&C.track.deal.load>0&&C.track.deal.other>0);
console.log('deals-track.test ok');
