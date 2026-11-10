// 港駅の売店（data/minato-store.json）。港駅の売店をつくる回の1回目（2026-11-10）から
//  ・設定の形がそろっている（新しい品は data/kiosk.json の品と同じ欄・id が重ならない・ジャンルと客層の名前がある）
//  ・品の数は約110（置ける今の品＋新しい品）
//  ・緑ヶ丘の店は変わらない：kiosk.json に港駅の品・ジャンル・客層が入っていない、
//    minato-store.json を読むのは js/minato-store-core.js だけ（2回目から。KioskCore は設定の walk を見るだけ）、
//    歩く店の計算（js/kiosk-walk.js）を読みこんでも、
//    いつもの条件の3日分の出来事の列・収支が、決めておいた指紋（GREEN）と同じ
//    （港駅の売店の回では、この指紋を変えてはいけない。ほかの仕事で売店の計算を変えたときだけ、わけを書いて指紋を作り直す：
//     MINATO_PRINT=1 node tests/minato-store.test.cjs で新しい指紋を表示）
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
for(const f of ['research-core','kiosk-staff','kiosk-walk','kiosk-core','minato-store-core'])require('../js/'+f+'.js');
const K=require('../data/kiosk.json'),R=require('../data/research.json'),M=require('../data/minato-store.json'),L=require('../data/links.json');
const KC=globalThis.KioskCore;

// 1) 形
assert.equal(M.v,1);
const kIds=new Set(K.products.map(p=>p.id)),kGen=new Set(K.genres.map(g=>g.id)),mGen=new Set(M.genres.map(g=>g.id));
const fields=new Set();for(const p of K.products)for(const k in p)if(k!=='brand')fields.add(k);
const nIds=new Set();
for(const p of M.products){
  for(const k of fields)assert.ok(p[k]!=null,p.id+': '+k+' がない');
  assert.ok(!kIds.has(p.id)&&!nIds.has(p.id),'id が重なっている '+p.id);nIds.add(p.id);
  assert.ok(kGen.has(p.genre)||mGen.has(p.genre),p.id+' ジャンル '+p.genre);
  assert.ok(p.price>0&&p.cost>0&&p.cost<p.price,p.id+' 値段と原価');
  if(p.brand)assert.ok(K.brands[p.brand],p.id+' brand');}
for(const g of M.genres){assert.ok(!kGen.has(g.id),'ジャンルが重なっている '+g.id);for(const k of ['id','name','zones','hours','base','life'])assert.ok(g[k]!=null,g.id+' '+k);}
const kPer=new Set(K.personas.map(p=>p.id));
for(const p of M.personas){assert.ok(!kPer.has(p.id),'客層が重なっている '+p.id);
  for(const k of ['id','name','short','icon','pref','priceSens','patience','sns','review','taste','male'])assert.ok(p[k]!=null,p.id+' '+k);
  for(const g in p.pref)assert.ok(kGen.has(g)||mGen.has(g),p.id+' pref '+g);}
assert.equal(M.personas.find(p=>p.id==='cru').strength,1,'客船の客は8回目から（客船の日に ctx.cruise があるときだけ来る）');
for(const k of ['drop','more','less'])for(const id of M.range[k])assert.ok(kIds.has(id),'range.'+k+' '+id);
for(const s of M.localShops)for(const id of s.items){const p=M.products.find(x=>x.id===id);assert.ok(p&&p.shop===s.id,s.id+' の品 '+id);}
const total=K.products.length-M.range.drop.length+M.products.length;
assert.ok(total>=100&&total<=115,'品の数 '+total);
assert.deepEqual(M.count,{kiosk:K.products.length,keep:K.products.length-M.range.drop.length,new:M.products.length,total});
for(const isl of ['local','port'])assert.ok(L.islands[isl],'島 '+isl);
for(const id of ['local-to-kiosk','factory-bento-to-center','port-to-all'])assert.ok(L.links.find(b=>b.id===id),'橋の下書き '+id);
console.log('  港駅の売店の設定：品',total,'（新しい品',M.products.length,'）・ジャンル',M.genres.length,'・客層',M.personas.length,'の形がそろっている');

// 2) 緑ヶ丘の店は変わらない
const kjs=JSON.stringify(K);
for(const id of [...nIds,...mGen,...M.personas.map(p=>p.id)])assert.ok(!kjs.includes('"'+id+'"'),'kiosk.json に港駅の設定が入った '+id);
const js=fs.readdirSync(path.join(__dirname,'../js'),{recursive:true}).filter(f=>f.endsWith('.js'));
// 2回目（2026-11-10）から：minato-store.json を読むのは minato-store-core.js だけ。港駅の店の設定を作っても kiosk.json は変わらない
for(const f of js)if(f!=='minato-store-core.js')assert.ok(!fs.readFileSync(path.join(__dirname,'../js',f),'utf8').includes('minato-store.json'),'minato-store.json を読むのは minato-store-core.js だけ '+f);
globalThis.MinatoStore.cfg(K,M);assert.equal(JSON.stringify(K),kjs,'港駅の店の設定を作っても kiosk.json の中身は同じ');
assert.ok(!K.walk,'緑ヶ丘の設定に walk がない（歩く店の計算は通らない）');
const H=KC.H,a=new Array(H).fill(0).map((_,h)=>h>=5&&h<24?150:0),fl=[a,a,a,a];
const st=KC.create(K,{st:'M',place:'home',seed:3});
const out=[5,6,9].map(day=>KC.simulate(K,st,{day,dow:day%7,cond:{day:'wd',wx:'sun',season:'aut'},flows:{hb:fl,ha:fl},stops:new Array(H).fill(4),plats:2,rcfg:R,order:st.order,express:[],addOn:[],edits:[],startT:0}));
const print=crypto.createHash('sha256').update(JSON.stringify(out)).digest('hex').slice(0,16);
const GREEN='2a115347a9a3ab65';
if(process.env.MINATO_PRINT)console.log('  指紋',print);
assert.equal(print,GREEN,'緑ヶ丘の店の3日分の結果が変わった');
console.log('  緑ヶ丘の店：3日分の出来事の列・収支が前と同じ（指紋 '+print+'）');
console.log('minato-store ok');
