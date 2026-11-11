// 港駅の売店 3回目（絵の第1段）（2026-11-10）
//  ・絵の段取り（js/minato-store-anim.js）は、計算の出来事から人を作るだけ：人の数＝買った人＋見て帰った人（出来事を足さない）
//  ・人の場所はゲームの時刻だけで決まる（同じ時刻なら同じ。途中から見ても同じ）・店の床と改札口の帯の中にいる
//  ・同時に描く人数の上限（こえた分は点）・イートインの人は席へ・列の人は列の並びに
//  ・絵の段取りを作っても、計算の結果（res）は変わらない
const assert=require('node:assert/strict');
for(const f of ['research-core','kiosk-staff','kiosk-walk','kiosk-core','minato-store-core','minato-store-anim'])require('../js/'+f+'.js');
const K=require('../data/kiosk.json'),R=require('../data/research.json'),M=require('../data/minato-store.json');
const {KioskCore:KC,MinatoStore:MS,MinatoAnim:A}=globalThis;
const c=MS.cfg(K,M),H=KC.H,a=new Array(H).fill(0).map((_,h)=>h>=5&&h<24?(h>=7&&h<9||h>=17&&h<19?400:150):0),fl=[a,a.map(x=>x*0.3),a.map(x=>x*0.2),a.map(x=>x*0.3)];
const st=MS.create(K,M,KC,{seed:3,day:1});
const ctx={day:2,dow:2,cond:{day:'wd',wx:'sun',season:'aut'},flows:{hb:fl,ha:fl},stops:new Array(H).fill(4),plats:2,rcfg:R,order:st.order,express:[],addOn:[],edits:[],startT:0};
const res=KC.simulate(c,st,ctx),before=JSON.stringify(res);
const acts=A.build(res,c,st.layout),acts2=A.build(res,c,st.layout);
assert.equal(JSON.stringify(acts),JSON.stringify(acts2),'同じ結果から同じ人');
assert.equal(JSON.stringify(res),before,'絵の段取りで計算の結果は変わらない');
const nBuy=res.ev.filter(e=>e.k==='buy').length,nLook=res.ev.filter(e=>e.k==='look').length;
assert.equal(acts.filter(x=>x.kind==='buy').length,nBuy,'買った人の数');
assert.equal(acts.filter(x=>x.kind!=='buy').length,nLook,'見て帰った人の数');
// イートイン：席についた出来事は、どれも買った人につながる
const nEat=res.ev.filter(e=>e.k==='eatin').length,linked=acts.filter(x=>x.seat).length;
assert.ok(nEat>0);assert.equal(linked,nEat,'イートインの人が買った人につながる');
assert.equal(acts.filter(x=>x.range).length,res.ev.filter(e=>e.k==='range').length,'レンジの人がつながる');
// 時刻ごとの場所
const [x0,y0,w,h]=A.MAP.floor;let maxN=0,qSeen=0,eatSeen=0,payF=0,payS=0;
for(let t=5*60;t<23.5*60;t+=0.25){const L=A.at(acts,t,40),L2=A.at(acts,t,40);
  assert.equal(JSON.stringify(L.map(o=>[o.a.id,o.x,o.y])),JSON.stringify(L2.map(o=>[o.a.id,o.x,o.y])),'同じ時刻なら同じ');
  maxN=Math.max(maxN,L.length);assert.ok(L.filter(o=>!o.dot).length<=40,'上限');
  for(const o of L){assert.ok(Number.isFinite(o.x)&&Number.isFinite(o.y),'場所が数');assert.ok(o.x>=x0-5&&o.x<=x0+w+5&&o.y>=y0-5&&o.y<=600,'店か改札口の帯の中 '+o.ph+' '+o.x+','+o.y);
    if(o.ph==='queue')qSeen++;if(o.ph==='eat')eatSeen++;if(o.ph==='pay')o.a.lane==='f'?payF++:payS++;}
  // 有人レジ・セルフレジで会計中の人は、それぞれ1人まで
  assert.ok(L.filter(o=>o.ph==='pay'&&o.a.lane==='f').length<=1&&L.filter(o=>o.ph==='pay'&&o.a.lane==='s').length<=1,'レジは1台ずつ');}
assert.ok(qSeen>0&&eatSeen>0&&payF>0&&payS>0,'列・イートイン・有人とセルフの会計が見える');
// 途中から見ても同じ（前の時刻を見たかどうかで変わらない）
{const t=8*60+13.3,fresh=A.build(res,c,st.layout);assert.equal(JSON.stringify(A.at(fresh,t).map(o=>[o.x,o.y])),JSON.stringify(A.at(acts,t).map(o=>[o.x,o.y])),'途中から');}
// 上限：小さくすると、こえた分は点
{let hit=false;for(let t=7*60;t<9*60&&!hit;t+=0.5){const L=A.at(acts,t,3);if(L.length>3){hit=true;assert.equal(L.filter(o=>!o.dot).length,3);}}assert.ok(hit,'人が多い時刻がある');}
// 店員とセルフで呼ばれたとき
{const e=res.ev.find(x=>x.k==='selfhelp');assert.ok(e);const C=A.clerks(res,e.t+e.min/2);assert.ok(C.list.some(k=>k.busy==='self'),'呼ばれた店員がセルフレジへ');
  assert.ok(A.bubbles(res,e.t+0.01).some(b=>b.kind==='help'),'吹き出し');}
// A1（2026-11-11）：歩く速さは客層ごとに一定・改札口 ↔ 店は距離 ÷ 速さ・会計のあとの短い動き・地元のお店の人
{const AN=c.walk.anim;assert.ok(AN&&AN.mps.shf>AN.mps.sen,'速さの設定（data/minato-store.json の walk.anim）');
  let fast=0,segs=0,stuck=0,packSeen=0,nPack=0;
  for(const x of acts){const sp=AN.mps[x.ps]*60/AN.unitM;
    if(x.inL){let D0=0;for(let i=1;i<x.inL.length;i++)D0+=Math.hypot(x.inL[i].x-x.inL[i-1].x,x.inL[i].y-x.inL[i-1].y);   // A6：駅の外から来た人・入口の外で立ち止まる人
      assert.ok(Math.abs(x.pre-D0/sp-(x.pr.prep?x.pr.prep.min:0))<1e-9,'外から入口までは距離 ÷ 速さ（＋入る前のしぐさ）');}
    else assert.ok(Math.abs(x.pre-Math.hypot(x.gate[0]-150,x.gate[1]-440)/sp)<1e-9,'改札口から入口までは距離 ÷ 速さ');
    const span=x.kind==='buy'?x.tq-x.ta:0,L=x.kind==='buy'?x.walk:[];let D=0;for(let i=1;i<L.length;i++)D+=Math.hypot(L[i].x-L[i-1].x,L[i].y-L[i-1].y);
    const hurry=x.kind==='buy'&&D/sp>span*AN.hurry;
    for(const W of [x.walk,x.after||[]])for(let i=1;i<W.length;i++){const d=Math.hypot(W[i].x-W[i-1].x,W[i].y-W[i-1].y),dt=W[i].t-W[i-1].t;if(d<1)continue;segs++;
      if(d/dt>sp*1.02&&!(hurry&&W===x.walk))fast++;}
    // 1か所に長く固まらない：買い物中に同じ点に止まるのは、shuffle の2倍まで
    if(x.kind==='buy')for(let i=1;i<L.length;i++)if(L[i].x===L[i-1].x&&L[i].y===L[i-1].y&&L[i].t-L[i-1].t>AN.shuffle*2+1e-9)stuck++;
    if(x.pack){nPack++;assert.ok(Math.abs(x.pack.t1-x.pack.t0-AN.pack)<1e-9);}}
  assert.equal(fast,0,'早足の人のほかは、自分の速さより速く歩かない');assert.equal(stuck,0,'棚の前で固まらない');assert.ok(nPack>0,'会計のあとに袋を持ち直す人がいる');
  for(let t=5*60;t<23.5*60;t+=0.05)for(const o of A.at(acts,t,40))if(o.ph==='pack')packSeen++;assert.ok(packSeen>0);
  // 地元のお店の人：届いた出来事から（出来事を足さない）。同じなら同じ・店の中・順番どおり
  const r2={...res,ev:[...res.ev,{t:400,k:'delivery',n:9,name:'汐見屋',local:'shiomi'},{t:570,k:'delivery',n:4,name:'ハーフェン堂',local:'hafen'}]};
  const V=A.locals(r2,c);assert.equal(V.length,2);assert.equal(JSON.stringify(V),JSON.stringify(A.locals(r2,c)),'同じなら同じ');
  assert.equal(A.locals(res,c).length,res.ev.filter(e=>e.k==='delivery'&&e.local&&e.n>0).length);
  for(const v of V){assert.ok(v.t0<v.e.t&&v.e.t<v.u0&&v.u0<v.u1&&v.u1<v.s0&&v.s0<v.s1&&v.s1<v.t1,'入る → 下ろす → サイン → 帰る');
    assert.ok(v.t1-v.t0<4,'地元のお店の人は数分で帰る（前は12分）');const seen=new Set();
    for(let t=v.t0;t<=v.t1;t+=0.01){const p=A.localAt(v,t);assert.ok(p&&p.x>=25&&p.x<=975&&p.y>=65&&p.y<=600);seen.add(p.ph);}
    for(const k of ['in','unload','sign','out'])assert.ok(seen.has(k),k);}
  assert.ok(V[0].cart&&!V[1].cart,'汐見屋は台車・ハーフェン堂はかご');
  console.log(`  A1：早足でない人は一定の速さ（区間${segs}）・会計のあと袋を持ち直す${nPack}人・地元のお店の人 ${V.map(v=>v.name+' '+(v.t1-v.t0).toFixed(1)+'分').join('・')}`);}
// A2（2026-11-11）：動き方の型・品ごとに立ち止まる秒数・手に取って戻す・かご・よけ方・列は背中・ごみ箱
{const AN=c.walk.anim,D=AN.dwell,B=acts.filter(x=>x.kind==='buy'),sty={};let over=0,gum=0,gumMax=0,cmp=0,bk3=0,n3=0,bk1=0,trash=0,ext=0;
  const I=KC.index(c);
  for(const x of B){sty[x.style]=(sty[x.style]||0)+1;if(x.hurry)assert.ok(x.style==='st'||x.style==='rush','急いでいる人はまっすぐ');
    for(const r of x.stops){const d=(r.t1-r.t0)*60;if(r.kind==='wait'){assert.ok(d<20,'列の手前で待つのは少しだけ '+d);continue;}
      if(d>r.hi+0.01)over++;if(r.kind!=='pick'&&r.kind!=='read'&&r.kind!=='photo'&&r.kind!=='basket')ext++;
      // どの棚の前でも、その品のジャンルの幅（年配1.4倍・おみやげ1.5倍・夜1.3倍・表示を読む＋6秒）をこえない
      const g=r.g,cap=(D[g]||D.browse)[1]*1.4*1.5*1.3+6;assert.ok(d<=cap+0.01,g+' '+d.toFixed(1)+'秒');
      if(g==='gummy'){gum++;gumMax=Math.max(gumMax,d);}
      if(r.kind==='cmp'){cmp++;const p=I.P[r.pid],e=res.ev.find(v=>v.k==='buy'&&Math.abs(v.end-x.te)<1e-6&&v.ps===x.ps&&v.yen===x.yen);assert.ok(p,'戻す品がある');
        assert.ok(!e.items.some(([pid])=>pid===r.pid),'戻す品は買った品とちがう');assert.ok((KC.stockAt(res,x.ta+(x.tq-x.ta)*0.3)[r.pid]||0)>0,'戻す品はその時刻に棚にある');}}
    const nI=res.ev.find(v=>v.k==='buy'&&Math.abs(v.end-x.te)<1e-6&&v.ps===x.ps&&v.yen===x.yen).items.reduce((s,[,q])=>s+q,0);if(nI>=3){n3++;if(x.bk)bk3++;}if(nI===1&&x.bk)bk1++;
    if(x.trash)trash++;}
  assert.equal(over,0,'立ち止まる秒数は幅の中');assert.ok(gumMax<=6*1.4+6+0.01,'グミの棚で長く悩まない');
  assert.ok(Object.keys(sty).length>=4,'いろいろな動き方 '+JSON.stringify(sty));assert.ok(cmp>0,'手に取って戻す人がいる');assert.ok(ext>B.length,'余った時間はほかの棚をのぞく・回る');
  assert.ok(n3>0&&bk3/n3>0.6,'3点以上の人はたいていかご');assert.equal(bk1,0,'1点の人はかごを持たない');assert.ok(trash>0,'ごみ箱に寄る人がいる');
  // よけ方：棚の前で止まっている人どうしは重ならない（待っている人のほか）・列の人は背中
  let near=0,back=0,qn=0,bkSeen=0;
  for(let t=6*60;t<22*60;t+=0.2){const L=A.at(acts,t,40),S=L.filter(o=>o.ph==='shop'&&!o.mv&&!o.wait&&!o.dot);
    for(let i=0;i<S.length;i++)for(let j=0;j<i;j++)if(Math.abs(S[i].x-S[j].x)<c.walk.anim.slot.gap-0.01&&Math.abs(S[i].y-S[j].y)<c.walk.anim.slot.gap*0.6-0.01)near++;
    for(const o of L){if(o.ph==='queue'){qn++;if(o.back)back++;}if(o.bk)bkSeen++;}}
  assert.equal(near,0,'棚の前で重ならない');assert.ok(qn>0&&back===qn,'列の人はレジのほうを向く');assert.ok(bkSeen>0,'かごを持って歩く人が見える');
  // 連れについていく（客船の日）
  const ctx2={...ctx,day:3,cruise:{pax:600,from:9*60,to:15*60}},res2=KC.simulate(c,st,ctx2),acts3=A.build(res2,c,st.layout),nf=acts3.filter(x=>x.style==='fol').length;
  assert.ok(nf>0,'客船の客は連れについていく');
  console.log(`  A2：動き方 ${Object.entries(sty).map(([k,v])=>k+v).join('・')}・手に取って戻す${cmp}回・グミの前は最長${gumMax.toFixed(1)}秒・3点以上でかご ${bk3}/${n3}・ごみ箱に寄る${trash}人・客船の日に連れについていく${nf}人`);}
// A3：店員の台本（レジがいちばん先・セルフで呼ばれる・品出し・あいた時間の仕事・2人のときはレジに寄る）と、買ったものの吹き出し
{const run=staff=>{const s2=MS.create(K,M,KC,{seed:3,day:1,staff});const r=KC.simulate(c,s2,{...ctx,order:s2.order});const b=A.build(r,c,s2.layout);
    const r2={...r,ev:[...r.ev,{t:400,k:'delivery',n:9,name:'汐見屋',local:'shiomi',items:{om_hesiko:9}},{t:570,k:'delivery',n:4,name:'ハーフェン堂',local:'hafen',items:{om_waffle2:4}}].sort((x,y)=>x.t-y.t)};
    const before2=JSON.stringify(r2),P=A.plan(r2,c,b,s2.layout);assert.equal(JSON.stringify(r2),before2,'店員の台本で計算の結果は変わらない');
    const P2=A.plan({...r2},c,b,s2.layout);assert.equal(JSON.stringify(P.clerks.map(k=>k.L)),JSON.stringify(P2.clerks.map(k=>k.L)),'同じなら同じ');return {r:r2,b,P,s2};};
  const one=run(1),two=run(2),stat={};let payOK=0,payN=0,cover=0,greet=0,buyB=0,maxB=0;
  for(const X of [one,two]){const {r,b,P}=X,O0=c.open[0]*60,O1=c.open[1]*60;
    for(const k of P.clerks){for(let i=1;i<k.L.length;i++)assert.ok(k.L[i].t>=k.L[i-1].t-1e-9,'店員の時刻は順');for(const q of k.L)assert.ok(q.x>=x0-5&&q.x<=x0+w+5&&q.y>=y0-5&&q.y<=A.MAP.wallY,'店員は店の中');
      for(const q of k.rec){stat[q.kind]=(stat[q.kind]||0)+(q.t1-q.t0);}}
    // 有人レジで会計しているあいだは、店員がレジにいる（計算でセルフに呼ばれて有人レジが止まった時間の、ずれの分のほか）
    for(const a of b){if(a.kind!=='buy'||a.lane!=='f')continue;const t=(a.ts+a.te)/2;payN++;if(A.clerks(r,t,P).list.some(k=>Math.hypot(k.x-A.MAP.clerk.f[0],k.y-A.MAP.clerk.f[1])<2))payOK++;}
    // セルフで呼ばれた店員はセルフレジへ
    for(const e of r.ev.filter(e=>e.k==='selfhelp')){const L=A.clerks(r,e.t+e.min/2,P).list;assert.ok(L.some(k=>k.id===e.by&&k.busy==='self'),'呼ばれた店員がセルフへ');
      if(L.length>=2&&L.some(k=>k.act==='cover'))cover++;}
    // 吹き出し：会計が終わった時刻に「＋金額　品」と客層の札。同時に3つまで
    for(const a of b.filter(a=>a.kind==='buy').slice(0,200)){const B=A.bubbles(r,a.te+0.01,0.07,c,P).filter(x=>x.kind==='buy');maxB=Math.max(maxB,B.length);if(B.some(x=>x.e.end===a.te&&/^\+¥[\d,]+　/.test(x.text)&&x.sub))buyB++;}
    for(let t=O0;t<O1;t+=0.5){const B=A.bubbles(r,t,0.07,c,P);if(B.some(x=>x.kind==='greet'))greet++;assert.ok(B.filter(x=>x.kind==='buy').length<=3,'吹き出しの上限');}
    // 地元のお店の箱は、サインのあと店員が取りに来て棚へ
    for(const v of P.locals){assert.ok(v.pick!=null&&v.pick>=v.s1-1e-9,'店員が箱を取りに来る');}
    // 便が届いたら品出し（台車は品出しが終わるまで）
    for(const q of P.carts){assert.ok(q.cart.length>0&&q.done>q.e.t,'品出しをする '+q.e.name);}}
  assert.ok(payOK/payN>0.97,'有人レジの会計中は店員がレジ '+payOK+'/'+payN);
  assert.ok(two.P.clerks.length===2&&cover>0,'2人のときは、レジの人がセルフに呼ばれたら、もう1人がレジに入る');
  for(const k of ['stock','front','order','cook','waste','wipe','mop','carry'])assert.ok(stat[k]>0,'店員の仕事 '+k);
  assert.ok(buyB>=190&&maxB<=3&&greet>0,'買ったものの吹き出し・いらっしゃいませ');
  // 1人の時間は、あいた時間に売り場の仕事をする（ずっとレジに立っているだけではない）
  {const k=one.P.clerks[0];let away=0,n=0;for(let t=6*60;t<22*60;t+=0.5){const p=A.clerks(one.r,t,one.P).list[0];n++;if(Math.hypot(p.x-A.MAP.clerk.f[0],p.y-A.MAP.clerk.f[1])>40)away++;}assert.ok(away/n>0.2&&away/n<0.97,'1人でも売り場に出る '+away+'/'+n);}
  console.log(`  A3：店員の仕事（分・2日分）${Object.entries(stat).map(([k,v])=>k+Math.round(v)).join('・')}・有人レジの会計中に店員がレジ ${payOK}/${payN}・レジに入る${cover}回・吹き出し ${buyB}・いらっしゃいませ${greet}`);}
console.log(`  港駅の店の絵：人${acts.length}（買った${nBuy}・見て帰った${nLook}）・同時に最大${maxN}人・イートイン${nEat}人がつながる`);
console.log('minato-anim ok');
