// 橋（data/links.json）と、アンケート → 売店のつなぎ（js/links/survey-to-kiosk.js）
//  ・links.json の各橋が「橋の約束」の欄をそろえている
//  ・強さ 0（または fx なし）なら、つなぐ前と同じ出来事の列・収支（前の版とも比べられる：OLD_KIOSK=…）
//  ・同じ日・同じ条件なら、何度作っても同じ
//  ・効き目は売店の保存（closeDay の結果）に書かれない
const assert=require('node:assert/strict');
for(const f of ['research-core','kiosk-staff','kiosk-core','survey-core','links/survey-to-kiosk'])require('../js/'+f+'.js');
const K=require('../data/kiosk.json'),R=require('../data/research.json'),S=require('../data/survey.json'),L=require('../data/links.json');
const {KioskCore:KC,SurveyCore:SC,SurveyToKiosk:SK}=globalThis;

// 1) 橋の約束
const SRC=['real','assume','game'],STATE=['done','temp','none','retired'],ids=new Set();
assert.equal(L.v,1);
for(const b of L.links){
  for(const k of ['id','name','from','to','state','strength','values','read','desc'])assert.ok(b[k]!=null,`${b.id}: ${k} がない`);
  assert.ok(!ids.has(b.id),'id が重なっている '+b.id);ids.add(b.id);
  assert.ok(STATE.includes(b.state),b.id+' state');
  assert.ok(Array.isArray(b.values)&&b.values.length,b.id+' values');
  for(const v of b.values){assert.ok(v.name&&v.unit,b.id+' value name/unit');assert.ok(SRC.includes(v.src),b.id+' value src '+v.src);}
  assert.ok(b.read.when,b.id+' read.when');assert.ok('at' in b.read,b.id+' read.at（時刻つきにできる欄）');
  for(const isl of String(b.from+','+b.to).split(','))assert.ok(L.islands[isl],b.id+' 島の名前 '+isl);}
console.log('  links.json：橋',L.links.length,'本の欄がそろっている');

// 売店の1日
const H=KC.H,a=new Array(H).fill(0).map((_,h)=>h>=5&&h<24?150:0),fl=[a,a,a,a];
const ctxOf=(st,day,extra)=>Object.assign({day,dow:day%7,cond:{day:'wd',wx:'sun',season:'aut'},flows:{hb:fl,ha:fl},stops:new Array(H).fill(4),plats:2,rcfg:R,order:st.order,express:[],addOn:[],edits:[],startT:0},extra||{});
const L0=JSON.parse(JSON.stringify(L));L0.links.find(x=>x.id===SK.ID).strength=0;
const st=KC.create(K,{st:'M',place:'home',seed:3});

// 2) 強さ 0 なら fx なしと同じ
for(const day of [5,6,9]){const fx0=SK.read(L0,S,SC,{st:'M',year:2026,isWeekday:true}).fx;
  const A=JSON.stringify(KC.simulate(K,st,ctxOf(st,day))),B=JSON.stringify(KC.simulate(K,st,ctxOf(st,day,{fx:fx0})));
  assert.equal(B,A,'強さ0 → 同じ day '+day);}
console.log('  強さ0：つなぐ前と同じ出来事の列・収支（3日）');
// 前の版の kiosk-core と比べる（任意）。例：git show HEAD~1:js/kiosk-core.js > /tmp/k.js; OLD_KIOSK=/tmp/k.js node tests/links.test.cjs
{const fs=require('node:fs');if(fs.existsSync(process.env.OLD_KIOSK||'')){const vm=require('node:vm'),box={};box.window=box;box.globalThis=box;
  for(const f of ['../js/research-core.js','../js/kiosk-staff.js'])vm.runInNewContext(fs.readFileSync(require.resolve(f),'utf8'),box);
  vm.runInNewContext(fs.readFileSync(process.env.OLD_KIOSK,'utf8'),box);
  const fx0=SK.read(L0,S,SC,{st:'M',year:2026,isWeekday:true}).fx;
  for(const day of [5,6,9])assert.equal(JSON.stringify(KC.simulate(K,st,ctxOf(st,day,{fx:fx0}))),JSON.stringify(box.KioskCore.simulate(K,st,ctxOf(st,day))),'前の版と同じ '+day);
  console.log('  強さ0：前の版の kiosk-core とも同じ');}}

// 3) 同じ条件なら同じ（つなぎを入れても）。効き目は毎回作り直しても同じ
const r1=SK.read(L,S,SC,{st:'M',year:2026,isWeekday:true});
const r2=SK.read(JSON.parse(JSON.stringify(L)),JSON.parse(JSON.stringify(S)),SC,{st:'M',year:2026,isWeekday:true});
assert.equal(JSON.stringify(r1),JSON.stringify(r2));
const X1=JSON.stringify(KC.simulate(K,st,ctxOf(st,7,{fx:r1.fx}))),X2=JSON.stringify(KC.simulate(K,st,ctxOf(st,7,{fx:JSON.parse(JSON.stringify(r2.fx))})));
assert.equal(X1,X2,'同じ日・同じ条件なら同じ');
assert.notEqual(X1,JSON.stringify(KC.simulate(K,st,ctxOf(st,7))),'強さ1なら少し変わる');
console.log('  同じ日・同じ条件なら何度作っても同じ');
// 土日はリモートワークの効き目なし
assert.equal(SK.read(L,S,SC,{st:'M',year:2026,isWeekday:false}).fx.foot,null);

// 4) 効き目は保存に入らない
{const res=KC.simulate(K,st,ctxOf(st,7,{fx:r1.fx}));const s2=KC.closeDay(K,st,res,{});const js=JSON.stringify(s2);
  for(const w of ['"fx"','"basket"','survey-to-kiosk'])assert.ok(!js.includes(w),'保存に効き目 '+w);}
console.log('  効き目は売店の保存に書かれない');

// 5) 大きさ：効き目は小さい
for(const id in S.areas){const fx=SK.read(L,S,SC,{st:id,year:2026,isWeekday:true}).fx;
  assert.ok(fx.basket>=0.85&&fx.basket<=1.1&&fx.em>=0.9&&fx.em<=1.25,id);}
console.log('  効き目の大きさは決めた範囲の中（全駅）');
console.log('links.test ok');
