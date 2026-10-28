/* =====================================================================
   売店運営（第2段）の計算の中心
   ・その日のダイヤの乗降（目的×時間）から、売店に寄る人を出し、客層ごとに「何がほしいか」「どれを選ぶか」
     「値段は見合うか」「売り切れていないか」「列に並ぶ時間があるか」を決めて、1人ずつ売り買いを進める。
   ・仕入れ（1日3便）・品出し・ホットスナックの調理と保温時間・廃棄・返品（新聞・雑誌）・収支。
   ・評価（甘すぎた・量が少ないなど）、SNS投稿、常連、マニア、世の中のブームを、次の日以降の売れ方に反映する。
   ・その日の途中で棚割り・値段・仕入れ数・店員の人数を変えたら、変えた時刻から先だけが変わる（それまでは同じ）。
   ・DOM もゲーム本体の変数も使わない。設定は data/kiosk.json（客層の年代・支払い・場所は data/research.json）。
   ===================================================================== */
(function(root){
'use strict';
const H=30,T_END=1560,SNAP=5;
function hash(){let h=2166136261>>>0;for(const a of arguments){const s=String(a);for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}h^=0x9e;h=Math.imul(h,16777619)>>>0;}return h>>>0;}
function rng(seed){let a=seed>>>0;return function(){a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
const pickW=(w,r)=>{let s=0;for(const x of w)s+=x;if(s<=0)return -1;let y=r()*s;for(let i=0;i<w.length;i++){if(y<w[i])return i;y-=w[i];}return w.length-1;};
const pickO=(o,r)=>{const k=Object.keys(o);const i=pickW(k.map(x=>o[x]),r);return i<0?null:k[i];};
const hm=(list,h)=>{let m=1;if(list)for(const [a,b,k] of list)if(h>=a&&h<b)m*=k;return m;};
const poisson=(l,r)=>{if(l<=0)return 0;if(l<30){const L=Math.exp(-l);let k=0,p=1;do{k++;p*=r();}while(p>L);return k-1;}const u=Math.max(1e-9,r()),v=r();return Math.max(0,Math.round(l+Math.sqrt(l)*Math.sqrt(-2*Math.log(u))*Math.cos(6.2832*v)));};
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));

/* ---------- 下ごしらえ ---------- */
function index(cfg){if(cfg._ix)return cfg._ix;const P={},G={},PS={};for(const p of cfg.products)P[p.id]=p;for(const g of cfg.genres)G[g.id]=g;for(const p of cfg.personas)PS[p.id]=p;
  const byG={};for(const p of cfg.products)(byG[p.genre]||(byG[p.genre]=[])).push(p);cfg._ix={P,G,PS,byG};return cfg._ix;}
function life(cfg,pid){const ix=index(cfg);return ix.G[ix.P[pid].genre].life;}
/* 棚割りから、商品ごとの並べた数（フェイス）・棚に置ける数・見えやすさ */
function shelfInfo(cfg,layout){const out={};for(const z in cfg.zones){const Z=cfg.zones[z],arr=layout[z]||[];
    arr.forEach((pid,i)=>{if(!pid)return;const row=Math.floor(i/Z.cols),o=out[pid]||(out[pid]={face:0,cap:0,eye:0,zones:{}});o.face++;o.cap+=Z.depth;o.eye+=Z.eye[row]||1;o.zones[z]=1;});}
  for(const k in out){const o=out[k];o.vis=Math.sqrt(o.face)*(o.eye/o.face);}return out;}

/* 仕入れ数のはじめの値：その日のうちに売る物は棚1杯分、日持ちする物は棚2杯分、冷凍のホットスナックは棚3杯分 */
function defaultOrder(cfg,pid,cap){const ix=index(cfg),g=ix.G[ix.P[pid].genre];return g.id==='hot'?cap*3:g.life===0?cap:cap*2;}
/* ---------- 状態 ---------- */
function create(cfg,opts){const ix=index(cfg);const st={v:1,seed:(opts&&opts.seed)||1,st:(opts&&opts.st)||'C',place:(opts&&opts.place)||'home',openedDay:(opts&&opts.day)||1,closed:((opts&&opts.day)||1)-1,
  staff:1,layout:JSON.parse(JSON.stringify(cfg.layout)),price:{},order:{},lots:{},rep:{},buzz:{},regulars:[],trend:null,nextTrend:((opts&&opts.day)||1)+4,news:[],hist:[],placedAt:{},cash:0};
  for(const p of cfg.products)st.price[p.id]=p.price;
  const si=shelfInfo(cfg,st.layout);for(const pid in si){st.order[pid]=defaultOrder(cfg,pid,si[pid].cap);st.placedAt[pid]=-99;}
  return st;}

/* ---------- 1日を動かす ----------
   ctx = { day, dow(0=日〜6=土), cond:{day,wx,season}, flows:{hb,ha}, stops, plats, rcfg(research.json), order(その日の仕入れ数), express:[{t,pid,q}], edits:[{t,layout,price,staff}] }
   返すもの：出来事の列（買った・見たけど買わなかった・帰った・品出し・納品・評価・SNS…）、5分ごとの棚の在庫、商品別・時間帯・客層の集計、収支、次の日へ持ちこす物 */
function simulate(cfg,state,ctx){const ix=index(cfg),R=ctx.rcfg,r=rng(hash(state.seed,ctx.day,state.st,state.place)),rEv=rng(hash(state.seed,ctx.day,'ev'));
  const place=R.places[state.place],P=ix.P,O1=cfg.open[1]*60,O0=Math.min(O1-60,Math.max(cfg.open[0]*60,ctx.startT||0));
  // その時刻に効いている設定（途中で変えたら、その時刻から先はそれを使う）
  const edits=[{t:-1,layout:state.layout,price:state.price,order:state.order,staff:state.staff},...(ctx.edits||[])].sort((a,b)=>a.t-b.t);
  const setAt=t=>{let e=edits[0];for(const x of edits)if(x.t<=t)e={...e,...x};return e;};
  // 人の流れ・立ち止まれる時間・寄る人
  const RC=root.ResearchCore,F=RC.footfall(R,state.st,state.place,ctx.flows,ctx.plats),DW=RC.dwellOf(R,state.place,ctx.stops);
  const ageMix=p=>{const o=R.ages.station[state.st];return (o&&o[String(p)])||R.ages.byPurpose[p];};
  const visitors=[];
  for(let h=Math.floor(O0/60);h<Math.ceil(O1/60);h++){const dwf=clamp(Math.pow(Math.max(0.3,(DW[h]||1.5))/2,cfg.visit.dwellPow),0.5,2);
    for(let p=0;p<4;p++){const n=poisson((F[p][h]||0)*cfg.visit.cap[p]*dwf,r);
      for(let i=0;i<n;i++){const a=pickW(ageMix(p),r),pm=cfg.personaMap[String(p)][a],ps=pickO(pm,r);const t=h*60+r()*60;if(t<O0||t>=O1)continue;
        visitors.push({t,p,a,ps,em:r()<Math.min(0.97,R.payment.emoney[a]*R.payment.purposeMul[p]),dw:DW[h]||1.5});}}}
  // 常連：決まった時刻ごろに、決まった品を買いに来る（通勤・通学の人は平日だけ）
  for(const g of state.regulars){if(g.wd&&(ctx.cond.day!=='wd'))continue;if(r()<0.12)continue;const t=g.t+(r()-0.5)*12;if(t<O0||t>=O1)continue;visitors.push({t,p:g.p,a:g.a,ps:g.ps,em:g.em,dw:DW[Math.floor(t/60)]||1.5,reg:g});}
  // マニア：漫画誌の発売日（月曜）や、マニアの多い品を新しく置いた日に、朝から来る
  let dayFoot=0;for(let p=0;p<4;p++)for(let h=0;h<H;h++)dayFoot+=F[p][h];
  const si0=shelfInfo(cfg,setAt(O0).layout);
  for(const pid in si0){const it=P[pid];if(!it.mania)continue;const release=(it.id==='mg_manga'&&ctx.dow===1)||(state.placedAt[pid]===ctx.day)||(state.placedAt[pid]===ctx.day-1);
    if(!release)continue;const n=poisson(dayFoot*cfg.mania.rate/100*it.mania,r);for(let i=0;i<n;i++){const t=O0+30+r()*240;visitors.push({t,p:0,a:1,ps:r()<0.5?'stu':'salM',em:true,dw:3,mania:pid});}}
  visitors.sort((a,b)=>a.t-b.t);

  // 在庫：棚と裏（ロットごとに入った日を持つ）。ホットスナックは調理した時刻を持つ
  const lots={};for(const pid in state.lots)lots[pid]=state.lots[pid].map(x=>({...x}));
  const shelf={},back={},hotQ={};
  const backQ=pid=>(lots[pid]||[]).reduce((s,x)=>s+x.q,0);
  const take=(pid,q)=>{const L=lots[pid]||[];let need=q,cost=0;while(need>0&&L.length){const x=L[0],k=Math.min(need,x.q);x.q-=k;need-=k;cost+=k*x.c;if(x.q<=0)L.shift();}return {got:q-need,cost};};
  // 朝：前の日から残った物を棚へ
  let cur=setAt(O0),SI=shelfInfo(cfg,cur.layout);
  const ev=[],snap=[],sold={},lostSO={},looked={},rev={},gross={},cogs={},hourly=new Float64Array(H),hourlyN=new Float64Array(H),byPs={},miss={},reasons={},reviews=[],posts=[],regEvents=[];
  const add=(o,k,v)=>{o[k]=(o[k]||0)+v;};
  let waste=0,wasteBy={},returned=0,deliveredCost=0;
  const shelfFill=(t,why)=>{let moved=0;for(const pid in SI){if(P[pid].genre==='hot')continue;const have=shelf[pid]||0,cap=SI[pid].cap;if(have>=cap)continue;const inBack=backQ(pid)-have;const k=Math.min(cap-have,Math.max(0,inBack));if(k>0){shelf[pid]=have+k;moved+=k;}}
    if(moved&&why)ev.push({t,k:'restock',n:moved,why});return moved;};
  // 棚にある数は「ロットのうち棚に出した数」。ロットの合計＝棚＋裏
  for(const pid in SI)shelf[pid]=0;
  // 納品
  const dayOrder=ctx.order||state.order;   // その日の便で届く数は、締め切りまでに出した発注で決まっている（途中で変えても、きょうの便は変わらない）
  const deliveries=cfg.deliveries.map(d=>({...d,t:Math.max(d.t,O0-1)}));
  // 臨時便：頼んだ時刻から lead 分後に、その品だけ届く
  let expressFee=0;for(const x of (ctx.express||[])){const it=P[x.pid];if(!it)continue;deliveries.push({t:x.t+cfg.express.lead,name:'臨時便',express:x});expressFee+=cfg.express.fee;}
  deliveries.sort((a,b)=>a.t-b.t);
  const deliver=(d,t)=>{const s=setAt(t),si=shelfInfo(cfg,s.layout);let n=0,cost=0;
    if(d.express){const it=P[d.express.pid];(lots[it.id]||(lots[it.id]=[])).push({q:d.express.q,c:it.cost,d:ctx.day});deliveredCost+=d.express.q*it.cost;ev.push({t,k:'delivery',n:d.express.q,cost:d.express.q*it.cost+cfg.express.fee,name:'臨時便（'+it.short+'）'});return;}
    for(const pid in si){const it=P[pid],g=ix.G[it.genre];if(!d.all&&!(d.genres||[]).includes(it.genre))continue;
      let q;if(g.life>=99||g.life>=2){q=Math.max(0,(dayOrder[pid]||0)-backQ(pid));}   // 日持ちする物は、そのジャンルの載っている便ごとに目標の数まで
      else{const share=d.all?0.5:0.25;q=Math.round((dayOrder[pid]||0)*share);}                                  // その日のうちに売る物は、朝5割・昼前と午後に2割5分ずつ
      if(q<=0)continue;(lots[pid]||(lots[pid]=[])).push({q,c:it.cost,d:ctx.day});n+=q;cost+=q*it.cost;}
    deliveredCost+=cost;ev.push({t,k:'delivery',n,cost,name:d.name});};
  // ホットスナック：冷凍で裏に置き、ケースが少なくなったら調理する（保温時間を過ぎたら捨てる）
  const cook=t=>{for(const pid in SI){if(P[pid].genre!=='hot')continue;const q=hotQ[pid]||(hotQ[pid]=[]);const hold=ix.G.hot.hold;
      while(q.length&&t-q[0].t>hold){const x=q.shift();waste+=x.c;add(wasteBy,pid,1);ev.push({t,k:'waste',pid,n:1,why:'保温時間切れ'});}
      const cap=SI[pid].cap,want=Math.max(1,Math.ceil(cap*Math.min(1,hm(ix.G.hot.hours,Math.floor(t/60))/1.8)));   // 売れる時間帯ほど多めに温めておく
      if(q.length<Math.ceil(want/2)+ (want>2?1:0)){const k=want-q.length,g2=take(pid,k);for(let i=0;i<g2.got;i++)q.push({t:t+6,c:g2.cost/g2.got});if(g2.got)ev.push({t,k:'cook',pid,n:g2.got});}}};
  const hotStock=pid=>(hotQ[pid]||[]).length;
  // 列：店員の数だけ同時に会計できる
  let servers=new Array(cur.staff).fill(O0);
  // 世の中のブーム
  const trend=state.trend?cfg.trends.find(x=>x.id===state.trend.id):null;
  const trendOn=it=>trend&&it.tags.some(t=>trend.tags.includes(t))?1+trend.amp:1;
  const repF=pid=>{const x=state.rep[pid];if(!x||!x.n)return 1;const avg=(x.sum+3.6*4)/(x.n+4);return clamp(1+0.14*(avg-3.6),0.75,1.2);};
  const buzzF=pid=>1+(state.buzz[pid]||0);
  const stockOf=pid=>P[pid].genre==='hot'?hotStock(pid):(shelf[pid]||0);
  const takeShelf=(pid,q)=>{if(P[pid].genre==='hot'){const Q=hotQ[pid]||[];let c=0,k=0;while(k<q&&Q.length&&Q[0].t<=nowT){c+=Q.shift().c;k++;}return {got:k,cost:c};}
    const k=Math.min(q,shelf[pid]||0);shelf[pid]-=k;const g2=take(pid,k);return g2;};
  let nowT=O0,di=0,nextRestock=O0,nextSnap=Math.floor(O0/SNAP)*SNAP,ei=1;
  const applyEdit=t=>{while(ei<edits.length&&edits[ei].t<=t){const e=setAt(edits[ei].t);const old=SI;SI=shelfInfo(cfg,e.layout);cur=e;
      for(const pid in shelf)if(!SI[pid]){shelf[pid]=0;}                      // 棚から外した物は裏へ
      for(const pid in SI)if(shelf[pid]>SI[pid].cap)shelf[pid]=SI[pid].cap;
      if(e.staff!==servers.length){const ns=new Array(e.staff).fill(edits[ei].t);servers=ns;}
      ev.push({t:edits[ei].t,k:'edit'});shelfFill(edits[ei].t,'変えた棚に並べる');ei++;}};
  const takeSnap=t=>{while(nextSnap<=t){const o={};for(const pid in SI)o[pid]=stockOf(pid);snap.push({t:nextSnap,s:o});nextSnap+=SNAP;}};
  const tick=t=>{applyEdit(t);
    while(di<deliveries.length&&deliveries[di].t<=t){nowT=deliveries[di].t;deliver(deliveries[di],deliveries[di].t);shelfFill(deliveries[di].t,'納品のあと品出し');cook(deliveries[di].t);di++;}
    while(nextRestock<=t){nowT=nextRestock;const s0=servers.indexOf(Math.min(...servers));
      if(servers[s0]<=nextRestock+5){const moved=shelfFill(nextRestock,'品出し');if(moved)servers[s0]=Math.max(servers[s0],nextRestock)+cfg.restockMin;}
      cook(nextRestock);nextRestock+=cfg.restockEvery;}
    takeSnap(t);};
  tick(O0);
  const priceOf=pid=>cur.price[pid]??P[pid].price;
  for(const v of visitors){tick(v.t);nowT=v.t;const ps=ix.PS[v.ps],h=Math.floor(v.t/60);add(byPs,v.ps,0);
    const minor=v.a===0;
    // 何がほしいか（ジャンル）
    let want=null,target=v.reg?v.reg.pid:v.mania||null;
    if(target)want=P[target].genre;
    else{const gw=cfg.genres.map(g=>{let w=g.base*(ps.pref[g.id]??1)*hm(g.hours,h)*((g.season&&g.season[ctx.cond.season])||1)*((g.wx&&g.wx[ctx.cond.wx])??1);
        if(g.age&&minor)w=0;if(trend&&ix.byG[g.id].some(it=>it.tags.some(t=>trend.tags.includes(t))))w*=1+trend.amp*0.6;return w;});
      want=cfg.genres[pickW(gw,r)].id;}
    // どれを選ぶか（棚に見えている物から）
    const cands=ix.byG[want].filter(it=>SI[it.id]);
    const logLook=(pid,why)=>{add(looked,pid||('g:'+want),1);add(reasons,why,1);ev.push({t:v.t,k:'look',ps:v.ps,pid,genre:want,why,reg:!!v.reg,mania:!!v.mania});};
    if(!cands.length){add(miss,want,1);logLook(null,'置いていない');if(v.reg)regEvents.push({g:v.reg,ok:false,why:'置いていない'});continue;}
    let it;if(target&&SI[target])it=P[target];
    else{const ws=cands.map(c=>{const pr=priceOf(c.id)/c.price;return c.w*SI[c.id].vis*repF(c.id)*buzzF(c.id)*trendOn(c)*Math.exp(-cfg.price.elastic*ps.priceSens*(pr-1))*(stockOf(c.id)>0?1:0.6);});it=cands[pickW(ws,r)];}
    if(!it){logLook(null,'迷ってやめた');continue;}
    // 値段
    const ratio=priceOf(it.id)/it.price,buyP=Math.min(1,Math.exp(-cfg.price.elastic*ps.priceSens*Math.max(0,ratio-1))*(ratio<1?1+0.6*(1-ratio)*ps.priceSens:1)*0.92);
    if(!v.reg&&!v.mania&&r()>buyP){logLook(it.id,ratio>cfg.price.tooHigh?'値段が高い':'見たけど買わなかった');continue;}
    // 在庫
    if(stockOf(it.id)<=0){add(lostSO,it.id,1);
      const alt=cands.filter(c=>c.id!==it.id&&stockOf(c.id)>0);
      if(!v.reg&&!v.mania&&alt.length&&r()<0.45){it=alt[Math.floor(r()*alt.length)];}
      else{logLook(it.id,'売り切れ');if(v.reg)regEvents.push({g:v.reg,ok:false,why:'売り切れ'});
        if(it.photo>0.6&&r()<ps.sns*0.3)posts.push({t:v.t,pid:it.id,ps:v.ps,good:false});continue;}}
    // 列：電車の時間までに買えるか
    const items=[[it.id,v.mania?(1+Math.floor(r()*3)):1]];
    if(!v.reg&&!v.mania&&r()<cfg.visit.addOn){const ig=['gummy','colddrink','coffee','snack','hotdrink'].filter(g=>g!==want);const c2=ig.flatMap(g=>ix.byG[g]).filter(c=>SI[c.id]&&stockOf(c.id)>0&&!(ix.G[c.genre].age&&minor));
      if(c2.length){const ws=c2.map(c=>c.w*SI[c.id].vis);const k=pickW(ws,r);if(k>=0)items.push([c2[k].id,1]);}}
    const S=cfg.service;let svc=S.base+S.perItem*(items.length-1)+(v.em?S.emoney:S.cash);for(const [pid] of items){if(P[pid].genre==='hot')svc+=S.hot;if(ix.G[P[pid].genre].age)svc+=S.age;}
    const k0=servers.indexOf(Math.min(...servers)),start=Math.max(v.t,servers[k0]),wait=start-v.t;
    const patience=ps.patience*(state.place==='home'?clamp(v.dw*0.7,0.6,3):3);
    if(wait>patience){logLook(it.id,'列が長い');if(v.reg)regEvents.push({g:v.reg,ok:false,why:'列が長い'});continue;}
    servers[k0]=start+svc/60;
    // 売る
    let yen=0,bought=[];
    for(const [pid,q] of items){const g2=takeShelf(pid,q);if(!g2.got)continue;const y=g2.got*priceOf(pid);yen+=y;add(sold,pid,g2.got);add(gross,pid,y);add(cogs,pid,g2.cost);bought.push([pid,g2.got]);}
    if(!bought.length){logLook(it.id,'売り切れ');continue;}
    hourly[h]+=yen;hourlyN[h]++;add(byPs,v.ps,1);
    const e={t:start,k:'buy',ps:v.ps,items:bought,yen,em:v.em,wait,reg:!!v.reg,mania:!!v.mania};ev.push(e);
    if(v.reg)regEvents.push({g:v.reg,ok:true});
    // 評価
    const main=P[bought[0][0]];
    if(main.taste[0]+main.taste[1]>0&&r()<ps.review){const rv=review(cfg,ps,main,priceOf(main.id)/main.price,r);rv.t=start+3;rv.pid=main.id;rv.ps=v.ps;reviews.push(rv);ev.push({t:rv.t,k:'review',pid:main.id,ps:v.ps,stars:rv.stars,text:rv.text});}
    // SNS
    if(r()<ps.sns*main.photo*0.35){const p2={t:start+2,pid:main.id,ps:v.ps,good:true};posts.push(p2);ev.push({t:p2.t,k:'sns',pid:main.id,ps:v.ps,good:true});}
    // 常連になる
    if(!v.reg&&!v.mania&&main.regular>0.3&&state.regulars.length<cfg.regulars.max&&r()<cfg.regulars.join*main.regular){
      regEvents.push({join:{id:'r'+ctx.day+'_'+Math.floor(v.t),ps:v.ps,p:v.p,a:v.a,em:v.em,pid:main.id,t:Math.round(v.t),wd:v.p<=1,loyal:cfg.regulars.loyalty,since:ctx.day}});}
  }
  tick(O1);
  for(const pst of posts)if(!pst.good)ev.push({t:pst.t,k:'sns',pid:pst.pid,ps:pst.ps,good:false});
  // 閉店：その日のうちに売る物は廃棄、新聞・雑誌（返品できる物）は返品、パンは日持ちの分だけ残す
  const carry={};
  for(const pid in lots){const it=P[pid],g=ix.G[it.genre];const L=lots[pid].filter(x=>x.q>0);
    if(g.returnable&&(g.life===0||L.some(x=>ctx.day-x.d>=g.life))){for(const x of L){if(g.life===0||ctx.day-x.d>=g.life){returned+=x.q*x.c;x.q=0;}}}
    else for(const x of L){if(g.life<99&&ctx.day-x.d>=g.life){waste+=x.q*x.c;add(wasteBy,pid,x.q);ev.push({t:O1,k:'waste',pid,n:x.q,why:'期限'});x.q=0;}}
    const keep=L.filter(x=>x.q>0);if(keep.length)carry[pid]=keep;}
  for(const pid in hotQ){for(const x of hotQ[pid]){waste+=x.c;add(wasteBy,pid,1);}if(hotQ[pid].length)ev.push({t:O1,k:'waste',pid,n:hotQ[pid].length,why:'閉店'});}
  ev.sort((a,b)=>a.t-b.t);
  // 収支
  let sales=0,em=0;for(const e of ev)if(e.k==='buy'){sales+=e.yen;if(e.em)em+=e.yen;}
  let cg=0;for(const k in cogs)cg+=cogs[k];
  const staffH=edits.reduce((s,e,i)=>{const t0=Math.max(O0,e.t),t1=i+1<edits.length?Math.max(O0,edits[i+1].t):O1;return s+Math.max(0,t1-t0)/60*setAt(e.t).staff;},0);
  const pl={sales,cogs:cg,waste,returned,express:expressFee,staff:staffH*cfg.wage,rent:Math.max(sales*place.rentRate,place.rentMinSqm*cfg.area/30),fee:em*cfg.emoneyFee,util:cfg.utilityPerDay};
  pl.cost=pl.cogs+pl.waste+pl.express+pl.staff+pl.rent+pl.fee+pl.util;pl.profit=pl.sales-pl.cost;
  return {day:ctx.day,cond:ctx.cond,ev,snap,sold,lostSO,looked,gross,cogs,hourly:Array.from(hourly),hourlyN:Array.from(hourlyN),byPs,miss,reasons,reviews,posts,regEvents,wasteBy,pl,carry,visitors:visitors.length,F};}

/* 評価：客層の好み（甘さ・味の濃さ・量）と商品の味のずれ、値段 */
function review(cfg,ps,it,ratio,r){const [s,k,v]=it.taste,[ps1,pk,pv]=ps.taste,T=cfg.reviews;let stars=4.3+(r()-0.5)*0.8;const bad=[];
  if(s>0||it.genre==='donut'||it.genre==='bread'){if(s-ps1>1.2){stars-=(s-ps1-1)*0.9;bad.push('sweetHi');}else if(s>=3&&ps1-s>1.6){stars-=0.6;bad.push('sweetLo');}}
  if(k-pk>1.2){stars-=(k-pk-1)*0.8;bad.push('richHi');}else if(pk-k>1.8){stars-=0.6;bad.push('richLo');}
  if(pv-v>1.2){stars-=(pv-v-1)*0.8;bad.push('volLo');}else if(v-pv>1.6){stars-=0.5;bad.push('volHi');}
  if(ratio>1.08){stars-=(ratio-1)*4*ps.priceSens;bad.push('priceHi');}
  stars=clamp(Math.round(stars),1,5);let key;
  if(bad.length&&stars<=3)key=bad[Math.floor(r()*bad.length)];else if(ratio<0.95)key='priceOk';else if(it.temp==='hot'&&r()<0.4)key='warm';else if(it.temp==='cold'&&r()<0.25)key='cold';else key='good';
  const list=T[key];return {stars,key,text:list[Math.floor(r()*list.length)],bad};}

/* ---------- 運行日を締める：評判・SNSの話題・常連・ブーム・在庫の持ちこし・知らせ ---------- */
function closeDay(cfg,state,res,info){const ix=index(cfg),st=JSON.parse(JSON.stringify(state)),day=res.day,news=[];
  const say=(kind,title,text,pid)=>{const n={day,kind,title,text,pid};news.push(n);st.news.push(n);};
  st.lots=res.carry;st.closed=day;st.cash+=res.pl.profit;
  // 評判
  for(const rv of res.reviews){const x=st.rep[rv.pid]||(st.rep[rv.pid]={n:0,sum:0,keys:{}});x.n++;x.sum+=rv.stars;x.keys[rv.key]=(x.keys[rv.key]||0)+1;}
  for(const pid in st.rep){const x=st.rep[pid];const tot=Object.values(x.keys).reduce((a,b)=>a+b,0);for(const k of ['sweetHi','volLo','priceHi','richHi']){if((x.keys[k]||0)>=5&&(x.keys[k]/tot)>0.3&&!(x['said_'+k])){x['said_'+k]=day;const lab={sweetHi:'甘すぎる',volLo:'量が少ない',priceHi:'値段が高い',richHi:'味が濃い'}[k];
      say('review',`「${ix.P[pid].name}」は${lab}という声`,`これまでの評価${x.n}件のうち${x.keys[k]}件が「${lab}」。好みの合う客層を考えるか、値段や置き方を見直す手がかりになります。`,pid);}}}
  // SNS の話題（その日の投稿で上がり、毎日2割ずつ落ち着く）
  for(const pid in st.buzz){st.buzz[pid]*=0.8;if(st.buzz[pid]<0.02)delete st.buzz[pid];}
  const cnt={};for(const p of res.posts)cnt[p.pid]=(cnt[p.pid]||0)+(p.good?1:-0.4);
  for(const pid in cnt){st.buzz[pid]=clamp((st.buzz[pid]||0)+0.12*cnt[pid],-0.3,1.5);if(cnt[pid]>=2)say('sns',`「${ix.P[pid].name}」がSNSで話題に`,`この日${Math.round(cnt[pid])}件の投稿。しばらく買いに来る人が増えます。`,pid);}
  // 常連
  for(const e of res.regEvents){if(e.join&&st.regulars.length<cfg.regulars.max&&!st.regulars.some(g=>g.pid===e.join.pid&&Math.abs(g.t-e.join.t)<20)){st.regulars.push(e.join);
      if(st.regulars.length%10===0)say('regular','常連さんが増えています',`いま${st.regulars.length}人。「${ix.P[e.join.pid].name}」を毎日のように買う${(ix.PS[e.join.ps]||{}).name||''}など。`,e.join.pid);}
    else if(e.g){const g=st.regulars.find(x=>x.id===e.g.id);if(!g)continue;if(e.ok)g.loyal=Math.min(cfg.regulars.loyalty+2,g.loyal+0.3);else{g.loyal-=1;g.miss=(g.miss||0)+1;g.why=e.why;}}}
  const gone=st.regulars.filter(g=>g.loyal<=0);st.regulars=st.regulars.filter(g=>g.loyal>0);
  for(const g of gone)say('regular',`常連の${(ix.PS[g.ps]||{}).name||'人'}が来なくなった`,`毎日「${ix.P[g.pid].name}」を買っていた人。最近は${g.why||'目当ての品がない'}ことが続いていました。`,g.pid);
  // ブーム
  if(st.trend&&day>=st.trend.end){const t=cfg.trends.find(x=>x.id===st.trend.id);say('trend',`${t.name}が落ち着いてきた`,'話題は少しずつ別のものへ移っています。');st.trend=null;
    const r=rng(hash(st.seed,day,'tr'));st.nextTrend=day+cfg.trendTiming.gap[0]+Math.floor(r()*(cfg.trendTiming.gap[1]-cfg.trendTiming.gap[0]));}
  if(!st.trend&&day+1>=st.nextTrend){const r=rng(hash(st.seed,day,'tr2'));const list=cfg.trends.filter(x=>!st.lastTrend||x.id!==st.lastTrend);const t=list[Math.floor(r()*list.length)];
    st.trend={id:t.id,start:day+1,end:day+1+cfg.trendTiming.len[0]+Math.floor(r()*(cfg.trendTiming.len[1]-cfg.trendTiming.len[0]))};st.lastTrend=t.id;
    const have=cfg.products.filter(p=>p.tags.some(x=>t.tags.includes(x)));say('trend',`世の中は${t.name}`,`${t.text}　関係のある品：${have.map(p=>p.name).join('・')}。`);}
  // 売り切れ・置いていない・廃棄の多い品
  const so=Object.entries(res.lostSO).sort((a,b)=>b[1]-a[1])[0];if(so&&so[1]>=8)say('soldout',`「${ix.P[so[0]].name}」が売り切れて${so[1]}人が買えなかった`,'仕入れ数や棚の並べ方（フェイス）を増やすと、逃す客が減ります。',so[0]);
  const ms=Object.entries(res.miss).sort((a,b)=>b[1]-a[1])[0];if(ms&&ms[1]>=6)say('miss',`${ix.G[ms[0]].name}を探して、置いていなくて帰った人が${ms[1]}人`,'棚に置いていないジャンルを探しに来た人の数です。',null);
  const ws=Object.entries(res.wasteBy).sort((a,b)=>b[1]-a[1])[0];if(ws&&ws[1]>=8)say('waste',`「${ix.P[ws[0]].name}」を${ws[1]}個捨てた`,'売れ残りや保温時間切れ。仕入れ数を見直す手がかりになります。',ws[0]);
  // 記録
  const top=Object.entries(res.sold).sort((a,b)=>b[1]-a[1]).slice(0,5);
  st.hist.push({day,cond:res.cond,sales:Math.round(res.pl.sales),profit:Math.round(res.pl.profit),cust:Object.values(res.byPs).reduce((a,b)=>a+b,0),waste:Math.round(res.pl.waste),top});if(st.hist.length>60)st.hist.shift();
  if(st.news.length>80)st.news=st.news.slice(-80);
  return {state:st,news};}

/* その時刻の棚の在庫（5分ごとの記録から） */
function stockAt(res,T){let lo=0,hi=res.snap.length-1;if(hi<0)return {};while(lo<hi){const m=(lo+hi+1)>>1;if(res.snap[m].t<=T)lo=m;else hi=m-1;}return res.snap[lo].s;}
function idxAt(res,T){let lo=0,hi=res.ev.length;while(lo<hi){const m=(lo+hi)>>1;if(res.ev[m].t<=T)lo=m+1;else hi=m;}return lo;}
/* その時刻までの集計 */
function soFar(cfg,res,T){const k=idxAt(res,T),o={sales:0,cust:0,cogs:0,looks:0,items:{},ps:{},why:{}};const ix=index(cfg);
  for(let i=0;i<k;i++){const e=res.ev[i];if(e.k==='buy'){o.sales+=e.yen;o.cust++;o.ps[e.ps]=(o.ps[e.ps]||0)+1;for(const [pid,q] of e.items){o.items[pid]=(o.items[pid]||0)+q;o.cogs+=q*ix.P[pid].cost;}}else if(e.k==='look'){o.looks++;o.why[e.why]=(o.why[e.why]||0)+1;}}
  return o;}

root.KioskCore={H,index,shelfInfo,defaultOrder,create,simulate,closeDay,stockAt,idxAt,soFar,review};
})(typeof window!=='undefined'?window:globalThis);
