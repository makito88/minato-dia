// 港駅の売店アニメ A4（2026-11-11）：計算1（js/kiosk-walk.js・港駅の店の設定 walk.age・care・localShelve・trash があるときだけ）
//  ・年齢確認：セルフでお酒を買う人は全員、店員が呼ばれる（selfhelp に age）／有人レジで確認するのは若く見える客層だけ
//  ・気配り：有人レジへ案内（guide・案内された人は有人レジ）／もう1人がレジに入る（cover・有人レジは止まらない）
//  ・地元のお店の品は、店員が並べ終えてから（shelve）売れる／ごみだけの人（trash・1日に数人）／ごみのついでに買う人（きっかけ trash・お菓子だけ）
//  ・設定がなければ、新しい出来事は出ない。緑ヶ丘の店の指紋は tests/minato-store.test.cjs が確かめる
const assert=require('node:assert/strict');
for(const f of ['research-core','kiosk-staff','kiosk-walk','kiosk-core','minato-store-core','links/local-to-kiosk'])require('../js/'+f+'.js');
const K=require('../data/kiosk.json'),R=require('../data/research.json'),M=require('../data/minato-store.json'),L=require('../data/links.json');
const {KioskCore:KC,MinatoStore:MS,LocalToKiosk:LK}=globalThis;
const c=MS.cfg(K,M),I=KC.index(c),G=pid=>I.P[pid].genre;
const H=KC.H,a=new Array(H).fill(0).map((_,h)=>h>=5&&h<24?(h>=7&&h<9||h>=17&&h<19?400:150):0),fl=[a,a.map(x=>x*0.3),a.map(x=>x*0.2),a.map(x=>x*0.3)];
const ctxOf=(st,day,extra)=>Object.assign({day,dow:day%7,cond:{day:day%7===0?'hol':day%7===6?'sat':'wd',wx:day%5===0?'rain':'sun',season:'aut'},flows:{hb:fl,ha:fl},stops:new Array(H).fill(4),plats:2,rcfg:R,order:st.order,express:[],addOn:[],edits:[],startT:0},extra||{});
function run(cfg,staff,days){let st=MS.create(K,M,KC,{seed:3,day:1,staff});const out=[];
  for(let day=1;day<=days;day++){const p=LK.plan(L,M,st,{day});const res=KC.simulate(cfg,st,ctxOf(st,day,p?{local:p}:{}));out.push(res);st=KC.closeDay(cfg,st,res).state;}return out;}
const A1=run(c,1,14),A2=run(c,2,14);
assert.equal(JSON.stringify(run(c,1,3).map(r=>[r.pl,r.walk,r.ev.length])),JSON.stringify(A1.slice(0,3).map(r=>[r.pl,r.walk,r.ev.length])),'同じ条件なら同じ');
const S={alcSelf:0,ageCall:0,young:0,old:0,guide:0,guideF:0,cover:0,coverNoStop:0,shelve:0,early:0,trash:0,trashBuy:0};
for(const res of [...A1,...A2]){const ev=res.ev;for(let i=1;i<ev.length;i++)assert.ok(ev[i].t>=ev[i-1].t,'時刻の順');
  const calls=ev.filter(e=>e.k==='selfhelp'&&e.age);S.ageCall+=calls.length;
  for(const e of ev){
    if(e.k==='buy'&&e.items.some(([p])=>G(p)==='alcohol')){
      if(e.lane==='s'){S.alcSelf++;assert.equal(e.age,'self','セルフのお酒は年齢確認');assert.ok(calls.some(x=>x.t>=e.t-0.01&&x.t<=e.end+0.01),'セルフのお酒で店員が呼ばれる');}
      else if(c.walk.age.young.includes(e.ps)){S.young++;assert.equal(e.age,'staffed','若く見える客層は有人レジで確認');}
      else{S.old++;assert.ok(!e.age,'ほかの客層は有人レジで確認しない');}}
    if(e.k==='buy'&&e.guide){S.guideF++;assert.equal(e.lane,'f','案内された人は有人レジ');}
    if(e.k==='guide')S.guide++;
    if(e.k==='cover'){S.cover++;assert.notEqual(e.by,e.from,'もう1人がレジに入る');const h=ev.find(x=>x.k==='selfhelp'&&x.by===e.from&&Math.abs(x.t-e.t)<5);if(h&&!h.stop)S.coverNoStop++;}
    if(e.k==='trash'){S.trash++;assert.ok(!ev.some(x=>x.k==='buy'&&x.t===e.t),'ごみだけの人は買わない');}
    if(e.k==='buy'&&e.mot==='trash'){S.trashBuy++;assert.ok(e.trash);assert.ok(e.items.every(([p],i)=>i>0||['snack','gummy'].includes(G(p))),'ごみのついでは、お菓子の棚から');}
    if(e.k==='shelve'){S.shelve++;assert.ok(e.t>e.from,'並べ終えるのは届いたあと');
}}}
assert.ok(S.alcSelf>20,'セルフでお酒を買う人がいる '+S.alcSelf);
assert.ok(S.young>0&&S.old>0,'有人レジのお酒：若い客層と、ほかの客層');
assert.ok(S.guide>50&&S.guideF>0&&S.guideF<=S.guide,'有人レジへ案内 '+S.guide+'・案内されて買った '+S.guideF);
assert.ok(S.cover>0&&S.coverNoStop===S.cover,'レジに入る（有人レジは止まらない）'+S.cover);
assert.ok(A1.every(r=>!r.ev.some(e=>e.k==='cover')),'店員が1人のときは、レジに入る人はいない');
assert.ok(S.shelve>=24,'地元のお店の品を並べる '+S.shelve);
const dl=[...A1].flatMap(r=>r.ev.filter(e=>e.k==='shelve').map(e=>e.t-e.from));assert.ok(dl.every(x=>x>=c.walk.localShelve.sign&&x<30),'並べ終えるまで数分 '+Math.min(...dl).toFixed(1)+'〜'+Math.max(...dl).toFixed(1));
const perDay=S.trash/28;assert.ok(perDay>=1&&perDay<=8,'ごみだけの人は1日に数人 '+perDay.toFixed(1));
assert.ok(S.trashBuy/28>=0.5&&S.trashBuy/28<=6,'ごみのついでに買う人は1日に数人 '+(S.trashBuy/28).toFixed(1));
assert.ok(A1.every(r=>r.walk.trash>=r.walk.eatIn),'ごみ箱のめやす');
// 地元のお店の品：その日に届いた分は、並べ終えるまで売れない（届いてから並べ終えるまでに売れた数 ≦ 朝の棚の残り）
for(const r of A1){for(const e of r.ev.filter(x=>x.k==='shelve')){let n={};for(const x of r.ev)if(x.k==='buy'&&x.t>e.from&&x.t<e.t)for(const [p,q] of x.items)if(e.items[p])n[p]=(n[p]||0)+q;
  const s0=r.snap.filter(s=>s.t<=e.from).at(-1);for(const p in n)assert.ok(s0&&n[p]<=(s0.s[p]||0),'並べる前に売れたのは、前からあった分だけ '+p);}}
// 設定がなければ、新しい出来事は出ない
const c0={...c,walk:{...c.walk}};delete c0.walk.age;delete c0.walk.care;delete c0.walk.localShelve;delete c0.walk.trash;c0.walk.self={...c.walk.self,noSelf:[...c.walk.self.noSelf,'alcohol']};
const Z=run(c0,2,4);for(const r of Z){assert.ok(!r.ev.some(e=>['guide','cover','shelve','trash'].includes(e.k)||e.age||e.mot==='trash'),'設定がないとき');assert.equal(r.walk.guide,undefined);
  for(const e of r.ev)if(e.k==='buy'&&e.lane==='s')assert.ok(!e.items.some(([p])=>G(p)==='alcohol'),'設定がないときはセルフでお酒を買えない');}
console.log(`  14日×店員1人・2人：セルフでお酒 ${S.alcSelf}（年齢確認で呼ばれた ${S.ageCall}）・有人で確認した若い客層 ${S.young}・案内 ${S.guide}・レジに入る ${S.cover}・並べた ${S.shelve}（${(dl.reduce((x,y)=>x+y,0)/dl.length).toFixed(1)}分）・ごみだけ ${S.trash}・ごみのついで ${S.trashBuy}`);
console.log('minato-a4 ok');
