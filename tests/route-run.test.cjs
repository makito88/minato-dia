// 描いた路線を走らせる計算（js/route-run-core.js）のたしかめ。node tests/route-run.test.cjs
const assert=require('assert');
const C=require('../js/route-core.js');global.RouteCore=C;
const R=require('../js/route-run-core.js');
const defs=require('../data/routes.json');
function base(){const d=C.emptyDoc(defs);C.addPath(d,[[100,200],[300,200],[500,200]],{type:'avenue',smooth:false,snap:4});
  const st=(name,type,p)=>{const n=C.anchor(d,p,4);const id=C.uid(d,'s');d.stops[id]={name,type,node:n,lp:'auto'};return id;};
  const a=st('西','bus',[100,200]),b=st('まんなか','bus',[300,200]),c=st('東','bus',[500,200]);
  const L=(name,seq,extra)=>{const id=C.uid(d,'l');d.lines[id]=Object.assign({name,type:'city',style:{},seq:seq.map(s=>({s})),freq:{unit:'d',n:1},first:'08:00',last:'08:00',round:false,show:true},extra||{});d.order.push(id);return id;};
  return {d,a,b,c,L};}
// 1. 1台だけ：予定どおり（遅れなし）。速さは km/時 から
{const {d,a,b,c,L}=base();L('1号',[a,b,c]);const r=R.simulate(d,defs.run);assert.strictEqual(r.veh.length,1);const v=r.veh[0];
  assert.ok(v.arr.every(t=>t!=null),'ぜんぶの停留所に着く');assert.ok(v.delay.every(x=>x<0.01),'1台なら遅れない');
  const km=200/r.cfg.unitsPerKm,min=km/r.cfg.speed.bus*60;assert.ok(v.arr[1]-v.leave[0]>min*0.95&&v.arr[1]-v.leave[0]<min*1.6,'速さが合う '+(v.arr[1]-v.leave[0]).toFixed(2)+' / '+min.toFixed(2));}
// 2. 同じ時刻に2本：止まれるのが1台なら、あとの便は手前で待って遅れる。2台なら待たない
{const {d,a,b,c,L}=base();L('1号',[a,b,c]);L('2号',[a,b,c],{first:'08:00'});
  const r=R.simulate(d,defs.run);const [v1,v2]=r.veh;assert.ok(Math.max(v1.delay[0],v2.delay[0])>0.2,'始発で1台は待つ');
  // 追い越さない：まんなかに着く順は、始発を出た順のまま
  const first=v1.leave[0]<=v2.leave[0]?v1:v2,second=first===v1?v2:v1;assert.ok(first.arr[1]<second.arr[1],'追い越さない');
  // 待っているあいだ、手前で止まっている（2台が同じ場所に重ならない）
  let minD=1e9;for(let T=470;T<520;T+=0.25){const s=R.stateAt(r,T);if(s.length===2){const dd=Math.hypot(s[0].x-s[1].x,s[0].y-s[1].y);if(!(s[0].dwell&&s[1].dwell))minD=Math.min(minD,dd);}}
  assert.ok(minD>11,'近づきすぎない '+minD.toFixed(2));
  d.stops[a].cap=2;d.stops[b].cap=2;d.stops[c].cap=2;const r2=R.simulate(d,defs.run);assert.ok(r2.veh.every(v=>v.delay[0]<0.01),'2台止まれれば始発で待たない');
  const s2=R.stateAt(r2,479.6).filter(x=>x.dwell);assert.strictEqual(s2.length,2);assert.ok(Math.hypot(s2[0].x-s2[1].x,s2[0].y-s2[1].y)>11,'前後にずらして並ぶ');}
// 3. 便の数・往復・夜をまたぐ
{const l={freq:{unit:'h',n:2},first:'23:00',last:'01:00'};assert.deepStrictEqual(R.departures(l,99),[1380,1410,1440,1470,1500]);
  const {d,a,c,L}=base();L('深夜',[a,c],{freq:{unit:'h',n:1},first:'23:30',last:'00:30',round:true});const r=R.simulate(d,defs.run);assert.strictEqual(r.veh.length,4);
  assert.ok(R.stateAt(r,1440+40).length>=1,'地図の 24:40（0:40）にも走っている');}
// 4. 船は岸壁ごとに1隻
{const d=C.emptyDoc(defs);C.addPath(d,[[900,390],[1100,420]],{type:'sea',smooth:false,snap:4});const st=(name,type,p)=>{const n=C.anchor(d,p,4);const id=C.uid(d,'s');d.stops[id]={name,type,node:n,lp:'auto'};return id;};
  const a=st('岸壁','pier',[900,390]),b=st('島','pier',[1100,420]);const L=(n)=>{const id=C.uid(d,'l');d.lines[id]={name:n,type:'ferry',style:{},seq:[{s:a},{s:b}],freq:{unit:'d',n:1},first:'09:00',last:'09:00',round:false,show:true};d.order.push(id);};L('A');L('B');
  const r=R.simulate(d,defs.run);assert.ok(r.veh.some(v=>v.delay[0]>1),'2隻めは岸壁があくのを待つ');}
console.log('route-run ok');
