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
   ctx = { day, dow(0=日〜6=土), cond:{day,wx,season}, flows:{hb,ha}, stops, plats, rcfg(research.json), order(その日の仕入れ数), express:[{t,items:{品:数}}]（古い形 {t,pid,q} も読める）, edits:[{t,layout,price,staff}] }
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
  // その日の気分：ジャンルごとの売れ方が、日によって少しぶれる（「甘い物の気分の日」など）
  const M=cfg.mood||{},rm=rng(hash(state.seed,ctx.day,'mood')),gz=()=>{const u=Math.max(1e-9,rm()),v2=rm();return Math.sqrt(-2*Math.log(u))*Math.cos(6.2832*v2);};
  const moodG={};for(const g of cfg.genres){const z=gz();moodG[g.id]=(M.fixed||[]).includes(g.id)?1:Math.exp(z*(M.daySd||0));}
  // なんとなく寄る人：買うつもりはなかったが、目に入った物を見に来る
  if(M.impulse)for(let h=Math.floor(O0/60);h<Math.ceil(O1/60);h++){const dwf=clamp(Math.pow(Math.max(0.3,(DW[h]||1.5))/2,cfg.visit.dwellPow),0.5,2);
    for(let p=0;p<4;p++){const n=poisson((F[p][h]||0)*M.impulse*dwf,r);for(let i=0;i<n;i++){const a=pickW(ageMix(p),r),ps=pickO(cfg.personaMap[String(p)][a],r),t=h*60+r()*60;if(t<O0||t>=O1)continue;
      visitors.push({t,p,a,ps,em:r()<Math.min(0.97,R.payment.emoney[a]*R.payment.purposeMul[p]),dw:DW[h]||1.5,imp:true});}}}
  // SNSを見て来る人：話題になっている品を目当てに、昼から夜に来る
  if(M.snsSeek)for(const pid in si0){const b=state.buzz[pid]||0;if(b<=0.03)continue;const n=poisson(dayFoot*b*M.snsSeek,r);
    for(let i=0;i<n;i++){const t=Math.max(O0,600+r()*660);if(t>=O1)continue;const ps=pickO({jk:3,salF:2,tou:2,stu:1},r);visitors.push({t,p:ps==='tou'?2:3,a:ps==='jk'?0:1,ps,em:true,dw:DW[Math.floor(t/60)]||1.5,sns:pid});}}
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
  const gapQ={},shrinkBy={};let shrinkCost=0,shrinkN=0;   // gapQ：なくなったが、まだ気づいていない品
  const noticeGap=t=>{const ks=Object.keys(gapQ).filter(k=>gapQ[k]>0);if(!ks.length)return;ev.push({t,k:'gap',items:ks.map(k=>[k,gapQ[k]])});for(const k of ks)gapQ[k]=0;};
  const shelfFill=(t,why)=>{if(why)noticeGap(t);let moved=0;for(const pid in SI){if(P[pid].genre==='hot')continue;const have=shelf[pid]||0,cap=SI[pid].cap;if(have>=cap)continue;const inBack=backQ(pid)-have;const k=Math.min(cap-have,Math.max(0,inBack));if(k>0){shelf[pid]=have+k;moved+=k;}}
    if(moved&&why)ev.push({t,k:'restock',n:moved,why});return moved;};
  // 棚にある数は「ロットのうち棚に出した数」。ロットの合計＝棚＋裏
  for(const pid in SI)shelf[pid]=0;
  // 納品
  const dayOrder=ctx.order||state.order;   // その日の便で届く数は、締め切りまでに出した発注で決まっている（途中で変えても、きょうの便は変わらない）
  const deliveries=cfg.deliveries.map(d=>({...d,t:Math.max(d.t,O0-1)}));
  // 臨時便：頼んだ時刻から lead 分後に、その品だけ届く
  let expressFee=0;for(const x of (ctx.express||[])){const items=x.items||(x.pid?{[x.pid]:x.q}:{});if(!Object.keys(items).some(k=>P[k]))continue;deliveries.push({t:x.t+cfg.express.lead,name:'臨時便',express:{items}});expressFee+=cfg.express.fee;}   // 1便に何品でものせられる。料金は便ごと
  deliveries.sort((a,b)=>a.t-b.t);
  const deliver=(d,t)=>{const s=setAt(t),si=shelfInfo(cfg,s.layout);let n=0,cost=0;const its={};
    if(d.express){let n2=0,c2=0;const names=[];for(const pid in d.express.items){const it=P[pid];if(!it)continue;const q=d.express.items[pid];(lots[pid]||(lots[pid]=[])).push({q,c:it.cost,d:ctx.day});n2+=q;c2+=q*it.cost;names.push(it.short);its[pid]=q;}
      deliveredCost+=c2;ev.push({t,k:'delivery',n:n2,cost:c2+cfg.express.fee,name:'臨時便（'+names.join('・')+'）',items:its,express:true});return;}
    for(const pid in si){const it=P[pid],g=ix.G[it.genre];if(!d.all&&!(d.genres||[]).includes(it.genre))continue;
      let q;if(g.life>=99||g.life>=2){q=Math.max(0,(dayOrder[pid]||0)-backQ(pid));}   // 日持ちする物は、そのジャンルの載っている便ごとに目標の数まで
      else{const share=d.all?0.5:0.25;q=Math.round((dayOrder[pid]||0)*share);}                                  // その日のうちに売る物は、朝5割・昼前と午後に2割5分ずつ
      if(q<=0)continue;(lots[pid]||(lots[pid]=[])).push({q,c:it.cost,d:ctx.day});n+=q;cost+=q*it.cost;its[pid]=q;}
    deliveredCost+=cost;ev.push({t,k:'delivery',n,cost,name:d.name,items:its});};   // items：この便で届いた品と数（画面の「次の便」に使う）
  // ホットスナック：冷凍で裏に置き、ケースが少なくなったら調理する（保温時間を過ぎたら捨てる）
  //   温める数は「この先 ahead 分に売れそうな数」。売れそうな数は、それまでの日の時間帯ごとの売れ方（state.hotF）から。まだ分からない時間帯は prior×時間帯の重み
  const HC=ix.G.hot.cook||{},HOLD=ix.G.hot.hold;
  const hotRate=(pid,h)=>{const f=state.hotF&&state.hotF[pid];return f&&f[h]!=null?f[h]:(HC.prior||0.6)*hm(ix.G.hot.hours,h);};
  const expire=(pid,t)=>{const q=hotQ[pid]||[];let n=0;while(q.length&&t-q[0].t>HOLD){const x=q.shift();waste+=x.c;add(wasteBy,pid,1);n++;}
    if(n)ev.push({t:Math.min(t,O1),k:'waste',pid,n,why:'保温時間切れ'});};
  const cookOne=(pid,t)=>{const q=hotQ[pid]||(hotQ[pid]=[]);expire(pid,t);if(t>=O1-(HC.stopBeforeClose||30)||!anyOn(t))return;   // 店員がいないと温められない
    const h=Math.floor(t/60),ah=(HC.ahead||45)/60,need=hotRate(pid,h)*ah;
    const want=clamp(Math.ceil(need-0.15),q.length?0:1,SI[pid].cap);   // 空のときは少なくとも1個
    if(q.length<want){const g2=take(pid,want-q.length);for(let i=0;i<g2.got;i++)q.push({t:t+6,c:g2.cost/g2.got});if(g2.got)ev.push({t,k:'cook',pid,n:g2.got});}};
  const cook=t=>{for(const pid in SI)if(P[pid].genre==='hot')cookOne(pid,t);};
  const hotStock=pid=>(hotQ[pid]||[]).length;
  // 列：店員の数だけ同時に会計できる
  // 店員：きょう働く人と時間（シフト）。会計・品出しは、その時間にいる人だけ。だれもいない時間は売店を閉める
  const KS=root.KioskStaff,W=KS.today(cfg,state,ctx.cond.day,ctx.day),free=W.map(()=>O0),served=W.map(()=>0),hasCrew=!!state.crew;
  const anyOn=t=>W.some(w=>KS.onAt(w,t));
  const eff=(k,t)=>KS.nextStart(W[k],Math.max(t,free[k]));                    // その人が次に会計を始められる時刻
  const pickS=t=>{let b=-1,bt=Infinity;for(let k=0;k<W.length;k++){const x=eff(k,t);if(x<bt){bt=x;b=k;}}return [b,bt];};
  const closedSp=[];{let a=O0;const cov=W.flatMap(w=>w.spans).sort((x,y)=>x[0]-y[0]);for(const [s0,e0] of cov){if(s0>a&&a<O1)closedSp.push([a,Math.min(s0,O1)]);a=Math.max(a,e0);}if(a<O1)closedSp.push([a,O1]);}
  for(const [a,b] of closedSp)ev.push({t:a,k:'closed',to:b});
  let closedN=0;
  // 世の中のブーム
  const trend=state.trend?cfg.trends.find(x=>x.id===state.trend.id):null;
  const trendOn=it=>trend&&it.tags.some(t=>trend.tags.includes(t))?1+trend.amp:1;
  const repF=pid=>{const x=state.rep[pid];if(!x||!x.n)return 1;const avg=(x.sum+3.6*4)/(x.n+4);return clamp(1+0.14*(avg-3.6),0.75,1.2);};
  const buzzF=pid=>1+(state.buzz[pid]||0);
  const stockOf=pid=>P[pid].genre==='hot'?hotStock(pid):(shelf[pid]||0);
  const takeShelf=(pid,q)=>{if(P[pid].genre==='hot'){expire(pid,nowT);const Q=hotQ[pid]||[];let c=0,k=0;while(k<q&&Q.length&&Q[0].t<=nowT){c+=Q.shift().c;k++;}if(k&&!Q.length)cookOne(pid,nowT);return {got:k,cost:c};}   // ケースが空になったら、すぐ温める
    const k=Math.min(q,shelf[pid]||0);shelf[pid]-=k;const g2=take(pid,k);return g2;};
  let nowT=O0,di=0,nextRestock=O0,nextSnap=Math.floor(O0/SNAP)*SNAP,ei=1;
  const applyEdit=t=>{while(ei<edits.length&&edits[ei].t<=t){const e=setAt(edits[ei].t);const old=SI;SI=shelfInfo(cfg,e.layout);cur=e;
      for(const pid in shelf)if(!SI[pid]){shelf[pid]=0;}                      // 棚から外した物は裏へ
      for(const pid in SI)if(shelf[pid]>SI[pid].cap)shelf[pid]=SI[pid].cap;
      ev.push({t:edits[ei].t,k:'edit'});shelfFill(edits[ei].t,'変えた棚に並べる');ei++;}};
  const takeSnap=t=>{while(nextSnap<=t){const o={},b={};for(const pid in SI){o[pid]=stockOf(pid);b[pid]=P[pid].genre==='hot'?backQ(pid):Math.max(0,backQ(pid)-(shelf[pid]||0));}snap.push({t:nextSnap,s:o,b});nextSnap+=SNAP;}};
  const tick=t=>{applyEdit(t);
    while(di<deliveries.length&&deliveries[di].t<=t){nowT=deliveries[di].t;deliver(deliveries[di],deliveries[di].t);shelfFill(deliveries[di].t,'納品のあと品出し');cook(deliveries[di].t);di++;}
    while(nextRestock<=t){nowT=nextRestock;let s0=-1;for(let k=0;k<W.length;k++)if(KS.onAt(W[k],nextRestock)&&free[k]<=nextRestock+5&&(s0<0||free[k]<free[s0]))s0=k;
      if(s0>=0){const moved=shelfFill(nextRestock,'品出し');if(moved)free[s0]=Math.max(free[s0],nextRestock)+cfg.restockMin/KS.speed(cfg,W[s0].p,'stock');}
      cook(nextRestock);nextRestock+=cfg.restockEvery;}
    takeSnap(t);};
  tick(O0);
  const priceOf=pid=>cur.price[pid]??P[pid].price;
  const recent=[],motives={};   // recent：直前に売れた品（前の人につられる）
  const herdF=(pid,t)=>{let n=0;for(let i=recent.length-1;i>=0&&t-recent[i].t<=(M.herdWin||4);i--)if(recent[i].pid===pid)n++;return 1+(M.herd||0)*Math.min(M.herdMax||3,n);};
  const newF=pid=>state.placedAt[pid]!=null&&ctx.day-state.placedAt[pid]>=0&&ctx.day-state.placedAt[pid]<(M.newDays||0)?(M.newBoost||1):1;
  const SH=cfg.shrink,rS=rng(hash(state.seed,ctx.day,'shrink')),guard=state.guard||{};
  const gMul=SH?Object.keys(SH.guard).filter(k=>guard[k]).reduce((m,k)=>m*SH.guard[k].mul,1):1;
  const steal=v=>{if(!SH)return;const h=Math.floor(v.t/60),on=W.filter(w=>KS.onAt(w,v.t)).length,busy=Math.min(1,Math.max(0,(Math.min(...free)-v.t)/2));
    const p=SH.base*(SH.place[state.place]??1)*(SH.station[state.st]??1)*(h>=SH.night.from?SH.night.mul:1)*(SH.staff[Math.min(SH.staff.length-1,Math.max(0,on-1))]||1)*(1+SH.busy*busy)*gMul;
    if(rS()>=p)return;
    const c=Object.keys(SI).filter(k=>P[k].genre!=='hot'&&(shelf[k]||0)>0).map(k=>{const zs=Object.keys(SI[k].zones);const zf=Math.max(...zs.map(z=>SH.zone[z]??1));return [k,zf*(SH.genre[P[k].genre]??0.6)*Math.sqrt(SI[k].face)];}).filter(x=>x[1]>0);
    if(!c.length)return;let tot=c.reduce((a,x)=>a+x[1],0),u=rS()*tot,pid=c[c.length-1][0];for(const [k,w] of c){u-=w;if(u<=0){pid=k;break;}}
    shelf[pid]-=1;const g2=take(pid,1);shrinkCost+=g2.cost;shrinkN+=1;add(shrinkBy,pid,1);add(gapQ,pid,1);};
  for(const v of visitors){tick(v.t);nowT=v.t;if(!anyOn(v.t)){closedN++;continue;}steal(v);const ps=ix.PS[v.ps],h=Math.floor(v.t/60);add(byPs,v.ps,0);
    if(v.imp){   // なんとなく：棚全体から目に入った物（安い・手軽・映える・いま売れている物ほど）を手に取る
      const all=Object.keys(SI).map(k=>P[k]).filter(c=>stockOf(c.id)>0&&!ix.G[c.genre].age&&!(M.fixed||[]).includes(c.genre));if(!all.length)continue;
      const ws=all.map(c=>c.w*SI[c.id].vis*(1+c.photo)*(priceOf(c.id)<=200?1.4:0.8)*(c.ease/5)*herdF(c.id,v.t)*(moodG[c.genre]||1)*buzzF(c.id)*trendOn(c)*newF(c.id)*Math.exp(-cfg.price.elastic*ps.priceSens*(priceOf(c.id)/c.price-1)));
      const c=all[pickW(ws,r)];const [k2,st2]=pickS(v.t),qd=st2>v.t+0.2;   // 会計に人が並んでいると気になる
      if(r()>(M.impulseBuy||0.5)*(qd?(M.queueLure||1):1))continue;
      const S2=cfg.service,svc2=(S2.base+(v.em?S2.emoney:S2.cash)+(c.genre==='hot'?S2.hot:0))/KS.speed(cfg,W[k2].p,'reg');
      if(st2-v.t>ps.patience*1.2)continue;free[k2]=st2+svc2/60;served[k2]++;const g2=takeShelf(c.id,1);if(!g2.got)continue;
      const y2=g2.got*priceOf(c.id);add(sold,c.id,g2.got);add(gross,c.id,y2);add(cogs,c.id,g2.cost);hourly[h]+=y2;hourlyN[h]++;add(byPs,v.ps,1);
      const mot=qd?'queue':'impulse';add(motives,mot,1);ev.push({t:st2,k:'buy',ps:v.ps,items:[[c.id,g2.got]],yen:y2,em:v.em,wait:st2-v.t,mot,by:hasCrew?W[k2].p.id:undefined});recent.push({t:st2,pid:c.id});
      if(r()<ps.sns*c.photo*0.35){const p2={t:st2+2,pid:c.id,ps:v.ps,good:true};posts.push(p2);ev.push({t:p2.t,k:'sns',pid:c.id,ps:v.ps,good:true});}
      continue;}
    const minor=v.a===0;
    // 何がほしいか（ジャンル）
    let want=null,target=v.reg?v.reg.pid:v.mania||v.sns||null;
    if(target)want=P[target].genre;
    else{const gw=cfg.genres.map(g=>{let w=g.base*(ps.pref[g.id]??1)*hm(g.hours,h)*((g.season&&g.season[ctx.cond.season])||1)*((g.wx&&g.wx[ctx.cond.wx])??1);
        if(g.age&&minor)w=0;if(trend&&ix.byG[g.id].some(it=>it.tags.some(t=>trend.tags.includes(t))))w*=1+trend.amp*0.6;return w*(moodG[g.id]||1);});
      want=cfg.genres[pickW(gw,r)].id;}
    // どれを選ぶか（棚に見えている物から）
    const cands=ix.byG[want].filter(it=>SI[it.id]);
    const logLook=(pid,why)=>{add(looked,pid||('g:'+want),1);add(reasons,why,1);ev.push({t:v.t,k:'look',ps:v.ps,pid,genre:want,why,reg:!!v.reg,mania:!!v.mania});};
    if(!cands.length){add(miss,want,1);logLook(null,'置いていない');if(v.reg)regEvents.push({g:v.reg,ok:false,why:'置いていない'});continue;}
    let it;if(target&&SI[target])it=P[target];
    else{const ws=cands.map(c=>{const pr=priceOf(c.id)/c.price;return c.w*SI[c.id].vis*repF(c.id)*buzzF(c.id)*trendOn(c)*herdF(c.id,v.t)*newF(c.id)*Math.exp(-cfg.price.elastic*ps.priceSens*(pr-1))*(stockOf(c.id)>0?1:0.6);});it=cands[pickW(ws,r)];}
    if(!it){logLook(null,'迷ってやめた');continue;}
    // 値段
    const ratio=priceOf(it.id)/it.price,buyP=Math.min(1,Math.exp(-cfg.price.elastic*ps.priceSens*Math.max(0,ratio-1))*(ratio<1?1+0.6*(1-ratio)*ps.priceSens:1)*0.92);
    if(!v.reg&&!v.mania&&!v.sns&&r()>buyP){logLook(it.id,ratio>cfg.price.tooHigh?'値段が高い':'見たけど買わなかった');continue;}
    // 在庫
    if(stockOf(it.id)<=0){add(lostSO,it.id,1);
      const alt=cands.filter(c=>c.id!==it.id&&stockOf(c.id)>0);
      if(!v.reg&&!v.mania&&!v.sns&&alt.length&&r()<0.45){it=alt[Math.floor(r()*alt.length)];}
      else{logLook(it.id,'売り切れ');if(v.reg)regEvents.push({g:v.reg,ok:false,why:'売り切れ'});
        if(it.photo>0.6&&r()<ps.sns*0.3)posts.push({t:v.t,pid:it.id,ps:v.ps,good:false});continue;}}
    // 列：電車の時間までに買えるか
    const items=[[it.id,v.mania?(1+Math.floor(r()*3)):1]];
    if(!v.reg&&!v.mania&&r()<cfg.visit.addOn){const ig=['gummy','colddrink','coffee','snack','hotdrink'].filter(g=>g!==want);const c2=ig.flatMap(g=>ix.byG[g]).filter(c=>SI[c.id]&&stockOf(c.id)>0&&!(ix.G[c.genre].age&&minor));
      if(c2.length){const ws=c2.map(c=>c.w*SI[c.id].vis);const k=pickW(ws,r);if(k>=0)items.push([c2[k].id,1]);}}
    const S=cfg.service;let svc=S.base+S.perItem*(items.length-1)+(v.em?S.emoney:S.cash);for(const [pid] of items){if(P[pid].genre==='hot')svc+=S.hot;if(ix.G[P[pid].genre].age)svc+=S.age;}
    const [k0,start]=pickS(v.t),wait=start-v.t;svc/=KS.speed(cfg,W[k0].p,'reg');
    const patience=ps.patience*(state.place==='home'?clamp(v.dw*0.7,0.6,3):3);
    if(wait>patience){logLook(it.id,'列が長い');if(v.reg)regEvents.push({g:v.reg,ok:false,why:'列が長い'});continue;}
    free[k0]=start+svc/60;served[k0]++;
    // 売る
    let yen=0,bought=[];
    for(const [pid,q] of items){const g2=takeShelf(pid,q);if(!g2.got)continue;const y=g2.got*priceOf(pid);yen+=y;add(sold,pid,g2.got);add(gross,pid,y);add(cogs,pid,g2.cost);bought.push([pid,g2.got]);}
    if(!bought.length){logLook(it.id,'売り切れ');continue;}
    hourly[h]+=yen;hourlyN[h]++;add(byPs,v.ps,1);
    // きっかけ：いちばん効いた「気分」の要素（前の人・SNS・ブーム・新商品）、なければ雨・買うつもり
    let mot=v.reg?'regular':v.mania?'mania':v.sns?'sns':null;
    if(!mot){const mp=P[bought[0][0]],fx={herd:herdF(mp.id,v.t)-1,sns:buzzF(mp.id)-1,trend:trendOn(mp)-1,new:newF(mp.id)-1};let best=null;for(const k in fx)if(fx[k]>0.25&&(!best||fx[k]>fx[best]))best=k;
      mot=best&&r()<fx[best]/(1+fx[best])?best:(mp.genre==='umbrella'&&(ctx.cond.wx==='rain'||ctx.cond.wx==='snow'))?'rain':'plan';}
    add(motives,mot,1);recent.push({t:start,pid:bought[0][0]});if(recent.length>60)recent.splice(0,20);
    const e={t:start,k:'buy',ps:v.ps,items:bought,yen,em:v.em,wait,reg:!!v.reg,mania:!!v.mania,mot,addon:bought.length>1,by:hasCrew?W[k0].p.id:undefined};ev.push(e);
    if(v.reg)regEvents.push({g:v.reg,ok:true});
    // 評価
    const main=P[bought[0][0]];
    if(main.taste[0]+main.taste[1]>0&&r()<ps.review){const rv=review(cfg,ps,main,priceOf(main.id)/main.price,r,hasCrew?(KS.careOf(cfg,W[k0].p)-1)*((cfg.crew.care||{}).stars||2.5):0);rv.t=start+3;rv.pid=main.id;rv.ps=v.ps;reviews.push(rv);ev.push({t:rv.t,k:'review',pid:main.id,ps:v.ps,stars:rv.stars,text:rv.text});}
    // SNS
    if(r()<ps.sns*main.photo*0.35){const p2={t:start+2,pid:main.id,ps:v.ps,good:true};posts.push(p2);ev.push({t:p2.t,k:'sns',pid:main.id,ps:v.ps,good:true});}
    // 常連になる
    if(!v.reg&&!v.mania&&main.regular>0.3&&state.regulars.length<cfg.regulars.max&&r()<cfg.regulars.join*main.regular){
      regEvents.push({join:{id:'r'+ctx.day+'_'+Math.floor(v.t),ps:v.ps,p:v.p,a:v.a,em:v.em,pid:main.id,t:Math.round(v.t),wd:v.p<=1,loyal:cfg.regulars.loyalty,since:ctx.day}});}
  }
  tick(O1);noticeGap(O1);
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
  const crewRes=W.map((w,k)=>{const x=KS.payOf(cfg,w,O0,O1);return {id:w.p.id,name:w.p.name,h:x.h,yen:x.yen,served:served[k],spans:w.spans};});
  const guardFee=SH?Object.keys(SH.guard).filter(k=>guard[k]).reduce((a,k)=>a+SH.guard[k].perDay,0):0;
  const recruit=hasCrew?(state.crew.ads||[]).filter(a=>a.day===ctx.day).length*cfg.crew.ad.fee:0;
  const pl={sales,cogs:cg,waste,returned,express:expressFee,staff:crewRes.reduce((s,x)=>s+x.yen,0),recruit,shrink:shrinkCost,guard:guardFee,rent:Math.max(sales*place.rentRate,place.rentMinSqm*cfg.area/30),fee:em*cfg.emoneyFee,util:cfg.utilityPerDay};
  pl.cost=pl.cogs+pl.waste+(pl.shrink||0)+(pl.guard||0)+pl.express+pl.staff+pl.recruit+pl.rent+pl.fee+pl.util;pl.profit=pl.sales-pl.cost;
  return {day:ctx.day,cond:ctx.cond,motives,moodG,ev,snap,sold,lostSO,looked,gross,cogs,hourly:Array.from(hourly),hourlyN:Array.from(hourlyN),byPs,miss,reasons,reviews,posts,regEvents,wasteBy,pl,carry,visitors:visitors.length,F,crew:crewRes,shrinkBy,shrinkN,closed:closedSp,closedN};}

/* 評価：客層の好み（甘さ・味の濃さ・量）と商品の味のずれ、値段 */
function review(cfg,ps,it,ratio,r,care){care=care||0;const [s,k,v]=it.taste,[ps1,pk,pv]=ps.taste,T=cfg.reviews;let stars=4.3+(r()-0.5)*0.8;const bad=[];
  if(s>0||it.genre==='donut'||it.genre==='bread'){if(s-ps1>1.2){stars-=(s-ps1-1)*0.9;bad.push('sweetHi');}else if(s>=3&&ps1-s>1.6){stars-=0.6;bad.push('sweetLo');}}
  if(k-pk>1.2){stars-=(k-pk-1)*0.8;bad.push('richHi');}else if(pk-k>1.8){stars-=0.6;bad.push('richLo');}
  if(pv-v>1.2){stars-=(pv-v-1)*0.8;bad.push('volLo');}else if(v-pv>1.6){stars-=0.5;bad.push('volHi');}
  if(ratio>1.08){stars-=(ratio-1)*4*ps.priceSens;bad.push('priceHi');}
  stars=clamp(Math.round(stars+care),1,5);let key;const CR=cfg.crew&&cfg.crew.care||{};
  if(care<(CR.bad??-0.15)&&T.staffBad&&r()<0.3)key='staffBad';else if(care>(CR.good??0.25)&&T.staffGood&&stars>=4&&r()<0.25)key='staffGood';
  else if(bad.length&&stars<=3)key=bad[Math.floor(r()*bad.length)];else if(ratio<0.95)key='priceOk';else if(it.temp==='hot'&&r()<0.4)key='warm';else if(it.temp==='cold'&&r()<0.25)key='cold';else key='good';
  const list=T[key];return {stars,key,text:list[Math.floor(r()*list.length)],bad};}

/* ---------- 運行日を締める：評判・SNSの話題・常連・ブーム・在庫の持ちこし・知らせ ---------- */
function closeDay(cfg,state,res,info){const ix=index(cfg),st=JSON.parse(JSON.stringify(state)),day=res.day,news=[];
  const say=(kind,title,text,pid)=>{const n={day,kind,title,text,pid};news.push(n);st.news.push(n);};
  st.lots=res.carry;st.closed=day;st.cash+=res.pl.profit;
  {const ty=res.cond&&res.cond.day||'wd',o=(st.custH||(st.custH={}))[ty];st.custH[ty]=res.hourlyN.map((v,h)=>o&&o[h]!=null?+(o[h]*0.7+v*0.3).toFixed(1):v);}   // 型ごとの1時間の会計の人数（おまかせシフトの見込みに使う）
  if(root.KioskStaff&&st.crew)root.KioskStaff.close(cfg,st,res,day,(kind,title,text)=>say(kind,title,text));
  {const hc=ix.G.hot&&ix.G.hot.cook,L=hc&&hc.learn||0.4,dem={};
    for(const e of res.ev){const h=Math.floor(e.t/60);if(e.k==='buy'){for(const [pid,q] of e.items)if(ix.P[pid].genre==='hot'){const a=dem[pid]||(dem[pid]=new Array(27).fill(0));a[h]+=q;}}
      else if(e.k==='look'&&e.pid&&e.why==='売り切れ'&&ix.P[e.pid].genre==='hot'){const a=dem[e.pid]||(dem[e.pid]=new Array(27).fill(0));a[h]+=1;}}
    const si=shelfInfo(cfg,st.layout);st.hotF=st.hotF||{};
    for(const pid in si){if(ix.P[pid].genre!=='hot')continue;const a=dem[pid]||new Array(27).fill(0),o=st.hotF[pid];
      st.hotF[pid]=a.map((v,h)=>o&&o[h]!=null?+(o[h]*(1-L)+v*L).toFixed(3):v);}}
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
  if(res.shrinkN){const sold=Object.values(res.sold).reduce((a,b)=>a+b,0),rate=res.shrinkN/(sold+res.shrinkN)*100,top=Object.entries(res.shrinkBy).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([k,n])=>ix.P[k].short+n).join('・');
    st.shrinkHist=(st.shrinkHist||[]).concat([{day,n:res.shrinkN,rate:+rate.toFixed(2),yen:Math.round(res.pl.shrink)}]).slice(-30);
    if(res.shrinkN>=3)say('shrink',`棚の数が合わない品が${res.shrinkN}個あった（万引きの疑い）`,`${top}など。原価で${Math.round(res.pl.shrink).toLocaleString()}円の損。売れた数に対して${rate.toFixed(1)}%。入口に近いフックやラックの小さな品ほどなくなりやすく、店員が1人の時間や、レジが混んでいる時間に多くなります。防犯ミラーやカメラは「収支」で付けられます。`);}
  if(st.guardNext){st.guard={...st.guardNext};delete st.guardNext;}
  const so=Object.entries(res.lostSO).sort((a,b)=>b[1]-a[1])[0];if(so&&so[1]>=8)say('soldout',cfg.hideLost?`「${ix.P[so[0]].name}」が売り切れてから、棚の前で残念そうにする人がいたようです`:`「${ix.P[so[0]].name}」が売り切れて${so[1]}人が買えなかった`,cfg.hideLost?'何人が買えなかったかは分かりません。仕入れ数や棚の並べ方（フェイス）を増やすと、どうなるでしょう。':'仕入れ数や棚の並べ方（フェイス）を増やすと、逃す客が減ります。',so[0]);
  const ms=Object.entries(res.miss).sort((a,b)=>b[1]-a[1])[0];if(ms&&ms[1]>=6)say('miss',`${ix.G[ms[0]].name}を探して、置いていなくて帰った人が${ms[1]}人`,'棚に置いていないジャンルを探しに来た人の数です。',null);
  const ws=Object.entries(res.wasteBy).sort((a,b)=>b[1]-a[1])[0];if(ws&&ws[1]>=8)say('waste',`「${ix.P[ws[0]].name}」を${ws[1]}個捨てた`,'売れ残りや保温時間切れ。仕入れ数を見直す手がかりになります。',ws[0]);
  // その日の気分：ふだんよりはっきり多く売れた・少なかったジャンル
  if(res.moodG){const L=cfg.mood&&cfg.mood.labels||{},hi=Object.entries(res.moodG).sort((a,b)=>b[1]-a[1])[0];if(hi&&hi[1]>1.22)say('mood',`きょうは「${ix.G[hi[0]].name}」の気分の人が多かった`,`天気や曜日とは別に、なんとなく${ix.G[hi[0]].name}に手がのびる人が多い日でした（ふだんの約${Math.round(hi[1]*100)}%）。日によってこういうぶれがあります。`);
    const tot=Object.values(res.motives||{}).reduce((a,b)=>a+b,0),herd=(res.motives||{}).herd||0,imp=((res.motives||{}).impulse||0)+((res.motives||{}).queue||0);
    if(tot>50&&imp/tot>0.18)say('mood','「なんとなく」買った人が多かった',`お客さん${tot}人のうち${imp}人が、買うつもりはなかったのに手に取っていました。目につく場所の品、安い品、手軽な品ほど売れます。`);
    if(tot>50&&herd/tot>0.08)say('mood','前の人につられて買う人が多かった',`${herd}人が、直前に同じ品が売れたのを見て買っていました。`);}
  // 記録
  const top=Object.entries(res.sold).sort((a,b)=>b[1]-a[1]).slice(0,5);
  st.hist.push({day,cond:res.cond,mot:res.motives,sales:Math.round(res.pl.sales),profit:Math.round(res.pl.profit),cust:Object.values(res.byPs).reduce((a,b)=>a+b,0),waste:Math.round(res.pl.waste),top});if(st.hist.length>60)st.hist.shift();
  if(st.news.length>80)st.news=st.news.slice(-80);
  return {state:st,news};}

/* その時刻の棚の在庫（5分ごとの記録から） */
function backAt(res,T){let lo=0,hi=res.snap.length-1;if(hi<0)return {};while(lo<hi){const m=(lo+hi+1)>>1;if(res.snap[m].t<=T)lo=m;else hi=m-1;}return res.snap[lo].b||{};}
function stockAt(res,T){let lo=0,hi=res.snap.length-1;if(hi<0)return {};while(lo<hi){const m=(lo+hi+1)>>1;if(res.snap[m].t<=T)lo=m;else hi=m-1;}return res.snap[lo].s;}
function idxAt(res,T){let lo=0,hi=res.ev.length;while(lo<hi){const m=(lo+hi)>>1;if(res.ev[m].t<=T)lo=m+1;else hi=m;}return lo;}
/* その時刻までの集計 */
function soFar(cfg,res,T){const k=idxAt(res,T),o={sales:0,cust:0,cogs:0,looks:0,items:{},ps:{},why:{}};const ix=index(cfg);
  for(let i=0;i<k;i++){const e=res.ev[i];if(e.k==='buy'){o.sales+=e.yen;o.cust++;o.ps[e.ps]=(o.ps[e.ps]||0)+1;for(const [pid,q] of e.items){o.items[pid]=(o.items[pid]||0)+q;o.cogs+=q*ix.P[pid].cost;}}else if(e.k==='look'){o.looks++;o.why[e.why]=(o.why[e.why]||0)+1;}}
  return o;}

root.KioskCore={H,index,shelfInfo,defaultOrder,backAt,create,simulate,closeDay,stockAt,idxAt,soFar,review};
})(typeof window!=='undefined'?window:globalThis);
