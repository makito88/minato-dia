// 港駅の売店：きょう売れたもの（棚 × 時間・いつもと比べる）の計算（js/minato-sales-core.js・2026-11-11）
//  ・数えるだけで、計算の結果（res）は変わらない・棚 × 時台の合計＝その時刻までに売れた個数
//  ・「いつも」は同じ型の日が2日そろってから・「きのう」は前の運行日・同じ時刻までに切る・小さな差は「同じくらい」
const assert=require('node:assert/strict');
for(const f of ['research-core','kiosk-staff','kiosk-walk','kiosk-core','minato-store-core','minato-sales-core'])require('../js/'+f+'.js');
const K=require('../data/kiosk.json'),R=require('../data/research.json'),M=require('../data/minato-store.json');
const {KioskCore:KC,MinatoStore:MS,MinatoSalesCore:SC}=globalThis;
const c=MS.cfg(K,M),H=KC.H,a=new Array(H).fill(0).map((_,h)=>h>=5&&h<24?(h>=7&&h<9||h>=17&&h<19?400:150):0),fl=[a,a.map(x=>x*0.3),a.map(x=>x*0.2),a.map(x=>x*0.3)];
let st=MS.create(K,M,KC,{seed:5,day:1});const recs=[];let last=null;
for(let d=1;d<=5;d++){const kind=d===4?'sat':'wd';
  const res=KC.simulate(c,st,{day:d,dow:d%7,cond:{day:kind,wx:'sun',season:'aut'},flows:{hb:fl,ha:fl},stops:new Array(H).fill(4),plats:2,rcfg:R,order:st.order,express:[],addOn:[],edits:[],startT:0});
  const before=JSON.stringify(res);
  for(const T of [8*60+20,13*60,24*60]){const s=SC.soFar(res,c,st.layout,T);let n=0,items=0;for(const e of res.ev)if(e.k==='buy'&&e.t<=T){n++;for(const [,q] of e.items)items+=q;}
    let g=0;for(const z in s.g)for(const h in s.g[z]){g+=s.g[z][h];assert.ok(+h<=Math.floor(T/60),'まだ来ていない時台はない');assert.ok(SC.NAME[z],'棚の名前 '+z);}
    assert.equal(s.n,n);assert.equal(s.total,items);assert.equal(g,items,'棚 × 時台の合計＝売れた個数');}
  assert.equal(JSON.stringify(res),before,'数えても計算の結果は変わらない');
  const r=SC.dayRec(res,c,st.layout);assert.equal(r.v,1);assert.equal(r.day,d);assert.equal(r.kind,kind);
  // くらべる相手
  const bu=SC.base(recs,{mode:'usual',day:d,kind,n:4,min:2}),by=SC.base(recs,{mode:'yday',day:d});
  const same=recs.filter(x=>x.kind===kind).length;assert.equal(!!bu,same>=2,'いつもは同じ型の日が2日そろってから（'+d+'日目）');assert.equal(!!by,d>1,'きのう');
  if(bu){assert.ok(bu.days.every(x=>recs.find(y=>y.day===x).kind===kind),'同じ型の日だけ');}
  recs.push(r);st=KC.closeDay(c,st,res,{}).state;last=res;}
// 同じ時刻までに切る
{const g={fridge:{8:30,9:12}};assert.equal(SC.upTo(g,'fridge',8,9*60+30),30);assert.equal(SC.upTo(g,'fridge',9,9*60+30),6);assert.equal(SC.upTo(g,'fridge',10,9*60+30),0);}
// 判定：小さな差は 0、大きな差は ±、向きは同じ
assert.equal(SC.judge(2,1),0);assert.equal(SC.judge(0,0),0);assert.equal(SC.judge(1,2),0);assert.ok(SC.judge(40,20)>0);assert.ok(SC.judge(10,30)<0);assert.ok(SC.judge(80,20)>=SC.judge(40,20));
for(let v=0;v<60;v+=3)for(let u=0;u<60;u+=4){const j=SC.judge(v,u);assert.ok(j>=-3&&j<=3&&Number.isInteger(j));}
// 平均：同じ型の日の平均
{const L=[{v:1,day:1,kind:'wd',g:{fridge:{7:10}}},{v:1,day:2,kind:'wd',g:{fridge:{7:20}}},{v:1,day:3,kind:'sat',g:{fridge:{7:99}}}];
  const b=SC.base(L,{mode:'usual',day:4,kind:'wd',n:4,min:2});assert.equal(b.g.fridge[7],15);assert.equal(b.n,2);
  assert.equal(SC.base(L,{mode:'yday',day:4}).g.fridge[7],99);assert.equal(SC.base(L,{mode:'usual',day:2,kind:'wd'}),null,'その日より前だけ');}
const s=SC.soFar(last,c,st.layout,10*60+50);
console.log(`  きょう売れたもの：10:50 までに ${s.total}個（${s.n}人）・棚 ${Object.keys(s.g).length}・記録 ${recs.length}日`);
console.log('minato-sales ok');
