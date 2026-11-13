// 線路の形（js/rail-shape.js・第7回）のたしかめ。node tests/rail-shape.test.cjs
const assert=require('assert');const fs=require('fs');
const R=require('../js/rail-shape.js');
const defs=require('../data/routes.json');
const dep={};for(const [k,v] of Object.entries(defs.rail.depot))if(k[0]!=='_')dep[k]=v;
const base={stations:defs.rail.stations,lines:defs.rail.lines,depot:dep};
// 1. index.html の駅の x,y・車庫と data/routes.json がそろっている
{const html=fs.readFileSync(__dirname+'/../index.html','utf8');for(const [s,v] of Object.entries(base.stations)){const m=new RegExp(s+":\\{name:'[^']+'[^}]*x:(\\d+),y:(\\d+)").exec(html);assert.ok(m,'ST.'+s);assert.deepStrictEqual([+m[1],+m[2]],[v.x,v.y],'駅の位置 '+s);}
  assert.ok(html.includes(`C:{yard:{x:${dep.C.yard.x},y:${dep.C.yard.y},w:${dep.C.yard.w},h:${dep.C.yard.h}}`),'車庫の位置');}
// 2. 空の保存は「なし」（今までの直線のまま）。こわれた値は捨てる
{const mem={};const st={getItem:k=>mem[k]||null,setItem:(k,v)=>{mem[k]=v;},removeItem:k=>{delete mem[k];}};
  assert.strictEqual(R.load(st,base),null);mem['dia-track']='{"v":1}';assert.strictEqual(R.load(st,base),null);mem['dia-track']='こわれた';assert.strictEqual(R.load(st,base),null);
  const n=R.normalize({st:{C:[1,2],Z:[3,4],S:['a',1]},seg:{'C-S':{p:[[150,330],[1,'x']],s:1},'C-P':{p:[[1,1]]}},extra:[{p:[[1,1]]}],depot:{C:{yard:[1,2,3,4]},Q:{yard:[1,1,30,30]}}},base);
  assert.deepStrictEqual(Object.keys(n.st),['C']);assert.deepStrictEqual(Object.keys(n.seg),['C-S']);assert.strictEqual(n.seg['C-S'].p.length,1);assert.strictEqual(n.extra.length,0);
  assert.deepStrictEqual(n.depot.C.yard,[1,2,16,12],'車庫は小さすぎない');assert.ok(!n.depot.Q);
  R.save(st,R.normalize(null,base));assert.ok(!('dia-track' in mem),'元の線路なら保存を消す');}
// 3. 曲げた区間：両端は駅、道の長さで進む、逆向きは同じ点、向きは路線の順の左手
{const sh=R.normalize({st:{M:[482,312]},seg:{'U-M':{p:[[420,296]],s:1},'K-F':{p:[[640,262]],s:0}}},base);const g=R.build(sh,base);
  const a=g.segAt('U','M',0),b=g.segAt('U','M',1);assert.ok(Math.hypot(a.x-356,a.y-322)<0.01&&Math.hypot(b.x-482,b.y-312)<0.01,'両端は駅（動かした駅も）');
  const p=g.segAt('U','M',0.3),q=g.segAt('M','U',0.7);assert.ok(Math.hypot(p.x-q.x,p.y-q.y)<0.01,'逆向きでも同じ点');assert.ok(Math.abs(p.nx-q.nx)<1e-9,'向き（左手）は路線の順');
  const L=g.segLen('U','M');let s=0,prev=g.segAt('U','M',0);for(let i=1;i<=100;i++){const r=g.segAt('U','M',i/100);s+=Math.hypot(r.x-prev.x,r.y-prev.y);prev=r;}assert.ok(Math.abs(s-L)<0.5,'長さ');
  const h=g.segAt('U','M',0.5),h1=g.segAt('U','M',0),h2=g.segAt('U','M',1);let s1=0;prev=h1;for(let i=1;i<=50;i++){const r=g.segAt('U','M',i/100);s1+=Math.hypot(r.x-prev.x,r.y-prev.y);prev=r;}assert.ok(Math.abs(s1-L/2)<0.5,'半分の f は半分の道のり');void h;void h2;
  assert.strictEqual(g.segAt('C','S',0.5),null,'曲げていない区間は null（今までの直線の計算）');assert.deepStrictEqual(g.segMid('C','S',0,1,7),[]);
  const k=g.segAt('K','F',0.5);assert.ok(Math.abs(k.x-640)<4,'かくかくは折れ線');
  const mid=g.segMid('U','M',0,1,0);assert.ok(mid.length>3);assert.ok(Math.hypot(mid[0].x-356,mid[0].y-322)<Math.hypot(mid.at(-1).x-356,mid.at(-1).y-322),'segMid は a→b の順');}
// 4. ダイヤ・乗客の計算は地図の x,y を読まない（index.html の simulate・ダイヤの組み立ては km だけ）
{const html=fs.readFileSync(__dirname+'/../index.html','utf8');const a=html.indexOf('function simulate(trips)'),b=html.indexOf('/* ---------- geometry ---------- */');assert.ok(a>0&&b>a);
  const core=html.slice(html.indexOf('/* ======================= CORE (no DOM)'),b).replace(/const RAILBASE[\s\S]*?if\(RG\)for\(const s in RG\.st\)\{[^}]*\}/,'');
  assert.ok(!/ST\[[^\]]+\]\.(x|y)\b/.test(core),'計算の部分で駅の x,y を読んでいない');}
console.log('rail-shape ok');
