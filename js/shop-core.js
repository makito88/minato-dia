/* =====================================================================
   駅ナカ商店（試作）の計算の中心
   ・列車シミュレーションの「駅ごと・目的ごと・1時間ごとの乗降」から、
     各店に来る客・買う商品・品出し・売り切れ・その日の収支を決める。
   ・運行日の終わりに締めて、積み立てが貯まれば出店し、新商品を試験販売して定番か終売かを決める。
   ・DOM もゲーム本体の変数も使わない。入力は引数だけ、乱数は「種＋運行日＋店」だけで決まる。
   ・設定は data/shop.json。
   ===================================================================== */
(function(root){
'use strict';
const T0=270,T1=1560,SLOT=5,NSLOT=Math.floor((T1-T0)/SLOT)+1;   // 4:30〜26:00、在庫は5分ごとに記録する

function hash(){let h=2166136261>>>0;for(const a of arguments){const s=String(a);for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}h^=0x9e;h=Math.imul(h,16777619)>>>0;}return h>>>0;}
function rng(seed){let a=seed>>>0;return function(){a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
function poisson(lam,r){if(lam<=0)return 0;if(lam<40){const L=Math.exp(-lam);let k=0,p=1;do{k++;p*=r();}while(p>L);return k-1;}
  const u=Math.max(1e-9,r()),v=r();return Math.max(0,Math.round(lam+Math.sqrt(lam)*Math.sqrt(-2*Math.log(u))*Math.cos(6.2832*v)));}

/* ---------- 状態（保存するもの） ---------- */
function create(cfg,saved){
  const st={v:1,seed:(cfg.start&&cfg.start.seed)||1,cash:(cfg.start&&cfg.start.cash)||0,closed:0,open:{},prod:{},devNext:0,hist:[],news:[],flags:{}};
  for(const s of cfg.shops)st.open[s.id]=!!s.open;
  if(saved&&saved.v===1){Object.assign(st,saved);st.open={...Object.fromEntries(cfg.shops.map(s=>[s.id,!!s.open])),...(saved.open||{})};}
  return st;}

/* 商品の一覧（設定の商品＋新商品の候補） */
function catalog(cfg){const m={};for(const p of cfg.products)m[p.id]=p;for(const p of (cfg.dev&&cfg.dev.list)||[])m[p.id]={...p,dev:true};return m;}

/* その店でいま売っている商品（終売した新商品は外す） */
function shopProducts(cfg,state,shop){const ids=[...shop.products];
  for(const d of (cfg.dev&&cfg.dev.list)||[]){const s=state.prod[d.id];if(d.shop===shop.id&&s&&(s.status==='trial'||s.status==='regular'))ids.push(d.id);}
  return ids;}

function hourMult(p,h){let m=1;if(p.hours)for(const [a,b,k] of p.hours)if(h>=a&&h<b)m*=k;return m;}
function prodWeight(cfg,p,h,cond){let w=p.w*hourMult(p,h);
  if(p.seasons&&!p.seasons.includes(cond.season))return 0;
  if(p.temp&&cfg.seasonMult&&cfg.seasonMult[p.temp])w*=cfg.seasonMult[p.temp][cond.season]??1;
  if(p.wx)w*=p.wx[cond.wx]??1;
  if(p.temp==='cold'&&cond.wx==='rain')w*=0.8;if(p.temp==='hot'&&(cond.wx==='rain'||cond.wx==='snow'))w*=1.25;
  return w;}
function parOf(kind,shop,p){const k=shop.stock??1;return Math.max(1,Math.round(p.stock*k*(kind==='vend'?(shop.n||1)*0.25:1)));}

/* ---------- 1運行日の計画 ----------
   input = { day, cond:{day,wx,season}, flows:{ 駅: { hb:[目的][時], ha:[目的][時] } } }
   返すもの：店ごとに、売れた時刻の並び（t・商品・数・金額）、売り切れで買えなかった客、5分ごとの在庫、品出しの時刻、1時間ごとと1日の合計 */
function planDay(cfg,state,input){
  const cat=catalog(cfg),out={day:input.day,cond:input.cond,shops:{}};
  for(const shop of cfg.shops){if(!state.open[shop.id])continue;const fl=input.flows[shop.st];if(!fl)continue;
    const K=cfg.kinds[shop.kind],pids=shopProducts(cfg,state,shop).filter(id=>cat[id]),P=pids.map(id=>cat[id]),np=P.length;
    const r=rng(hash(state.seed,input.day,shop.id));
    const o0=Math.max(T0,shop.hours[0]*60),o1=Math.min(T1,shop.hours[1]*60);
    const par=P.map(p=>parOf(shop.kind,shop,p)),stock=par.slice();
    const restocks=K.restock.filter(t=>t>o0&&t<o1);
    const ev={t:[],pi:[],q:[],yen:[],lost:[],cc:[]};      // lost=1 は売り切れで買えなかった客（pi は欲しかった商品）
    const hourly={yen:new Float64Array(30),cust:new Float64Array(30),lost:new Float64Array(30)};
    const tot={yen:0,cogs:0,cust:0,units:0,lost:0,lostYen:0,byProd:new Float64Array(np),lostProd:new Float64Array(np)};
    const snap=new Uint16Array(NSLOT*np);let si=0;
    const rec=t=>{while(si<NSLOT&&T0+si*SLOT<=t){snap.set(stock,si*np);si++;}};
    let ri=0;
    for(let h=Math.floor(o0/60);h*60<o1;h++){
      let lam=0;const flow=K.by==='board'?[fl.hb]:K.by==='alight'?[fl.ha]:[fl.hb,fl.ha];
      for(let p=0;p<4;p++)for(const f of flow)lam+=(f[p][h]||0)*K.rate[p];
      lam*=shop.size*(shop.kind==='vend'?Math.sqrt(shop.n||1)/Math.sqrt(3):1);   // 自販機は台数が多いほど客が増える（ただし頭打ち）
      const a=Math.max(o0,h*60),b=Math.min(o1,h*60+60);if(b<=a)continue;lam*=(b-a)/60;
      const n=poisson(lam,r),ts=[];for(let i=0;i<n;i++)ts.push(a+r()*(b-a));ts.sort((x,y)=>x-y);
      const w=P.map(p=>prodWeight(cfg,p,h,input.cond));let wsum=0;for(const x of w)wsum+=x;if(wsum<=0)continue;
      for(const t of ts){
        while(ri<restocks.length&&restocks[ri]<=t){rec(restocks[ri]);for(let i=0;i<np;i++)stock[i]=par[i];ri++;}
        rec(t);
        let x=r()*wsum,i=0;while(i<np-1&&x>=w[i]){x-=w[i];i++;}
        tot.cust++;hourly.cust[h]++;
        if(stock[i]<=0){tot.lost++;tot.lostYen+=P[i].price;tot.lostProd[i]++;hourly.lost[h]++;ev.t.push(t);ev.pi.push(i);ev.q.push(0);ev.yen.push(0);ev.lost.push(1);ev.cc.push(tot.cust);
          if(r()<0.45){let s2=0;for(let j=0;j<np;j++)if(stock[j]>0)s2+=w[j];if(s2>0){let y=r()*s2,j=0;for(;j<np;j++){if(stock[j]<=0)continue;if(y<w[j])break;y-=w[j];}i=Math.min(j,np-1);if(stock[i]<=0)continue;}else continue;}
          else continue;}
        const q=Math.min(stock[i],K.units[Math.floor(r()*K.units.length)]);stock[i]-=q;
        const yen=q*P[i].price;tot.yen+=yen;tot.cogs+=q*P[i].cost;tot.units+=q;tot.byProd[i]+=q;hourly.yen[h]+=yen;
        ev.t.push(t);ev.pi.push(i);ev.q.push(q);ev.yen.push(yen);ev.lost.push(0);ev.cc.push(tot.cust);}
    }
    while(ri<restocks.length){rec(restocks[ri]);for(let i=0;i<np;i++)stock[i]=par[i];ri++;}
    rec(T1+1);
    const cum=new Float64Array(ev.t.length);let c=0;for(let i=0;i<ev.t.length;i++){c+=ev.yen[i];cum[i]=c;}
    out.shops[shop.id]={id:shop.id,st:shop.st,kind:shop.kind,name:shop.name,n:shop.n||1,pids,par,np,open:[o0,o1],restocks,
      t:Float32Array.from(ev.t),pi:Uint8Array.from(ev.pi),q:Uint8Array.from(ev.q),yen:Float32Array.from(ev.yen),lost:Uint8Array.from(ev.lost),cum,cc:Uint32Array.from(ev.cc),snap,hourly,tot,
      dayCost:K.dayCost*(shop.kind==='vend'?(shop.n||1):1),feeRate:K.feeRate};}
  return out;}

/* その時刻までに何件目の出来事まで進んだか（二分探索） */
function idxAt(sp,T){let lo=0,hi=sp.t.length;while(lo<hi){const m=(lo+hi)>>1;if(sp.t[m]<=T)lo=m+1;else hi=m;}return lo;}
/* その時刻の在庫（5分ごとの記録から） */
function stockAt(sp,T){const s=Math.max(0,Math.min(NSLOT-1,Math.floor((T-T0)/SLOT)));return sp.snap.subarray(s*sp.np,(s+1)*sp.np);}
/* その時刻までの合計 */
function soFar(sp,T){const k=idxAt(sp,T);let lost=0;for(let i=0;i<k;i++)if(sp.lost[i])lost++;
  return {k,yen:k?sp.cum[k-1]:0,cust:k?sp.cc[k-1]:0,lost};}
function shopProfit(sp){const fee=sp.tot.yen*sp.feeRate;return {sales:sp.tot.yen,cogs:sp.tot.cogs,fee,fixed:sp.dayCost,profit:sp.tot.yen-sp.tot.cogs-fee-sp.dayCost};}

/* ---------- 運行日を締める：積み立て・出店・新商品・便り ---------- */
function closeDay(cfg,state,plan){
  const cat=catalog(cfg),news=[],day=plan.day,st=JSON.parse(JSON.stringify(state));
  const add=(kind,stn,title,text)=>{const n={day,kind,st:stn,title,text};news.push(n);st.news.push(n);};
  let sales=0,profit=0;const byShop={};
  for(const id in plan.shops){const sp=plan.shops[id],pf=shopProfit(sp);sales+=pf.sales;profit+=pf.profit;
    const top=[...sp.pids.keys()].sort((a,b)=>sp.tot.byProd[b]-sp.tot.byProd[a]).slice(0,3).map(i=>[sp.pids[i],sp.tot.byProd[i]]);
    byShop[id]={s:Math.round(pf.sales),p:Math.round(pf.profit),c:sp.tot.cust,l:sp.tot.lost,top};}
  st.cash+=profit;st.closed=day;
  const prevBest=st.hist.reduce((m,h)=>Math.max(m,h.sales),0);
  st.hist.push({day,sales:Math.round(sales),profit:Math.round(profit),byShop});if(st.hist.length>30)st.hist.shift();
  if(st.hist.length>3&&sales>prevBest*1.001)add('record',null,'1日の売上が過去最高に',`全店の売上が ${Math.round(sales/1000).toLocaleString()} 千円になりました。`);

  // 売り切れが続いた店（同じ店は5運行日に1回まで）
  let worst=null;for(const id in plan.shops){const sp=plan.shops[id];if(sp.tot.lost<40||sp.tot.lost<sp.tot.cust*0.08)continue;if((st.flags['so_'+id]||-99)>day-5)continue;if(!worst||sp.tot.lost>worst.tot.lost)worst=sp;}
  if(worst&&(st.flags.soAny||-99)<=day-3){st.flags.soAny=day;const i=[...worst.pids.keys()].sort((a,b)=>worst.tot.lostProd[b]-worst.tot.lostProd[a])[0],p=cat[worst.pids[i]];st.flags['so_'+worst.id]=day;
    add('soldout',worst.st,`${worst.name}で売り切れ`,`「${p.name}」がなくなり、${Math.round(worst.tot.lostProd[i])}人が買えませんでした（店全体では${Math.round(worst.tot.lost)}人）。`);}

  // 赤字が7運行日続いた店（どうするかはまだ決めていない：知らせるだけ）
  for(const id in byShop){const h=st.hist.slice(-7);if(h.length===7&&h.every(x=>x.byShop[id]&&x.byShop[id].p<0)&&(st.flags['red_'+id]||-99)<=day-7){st.flags['red_'+id]=day;const s=cfg.shops.find(x=>x.id===id);add('red',s.st,`${s.name}が赤字続き`,'この1週間、売上で家賃・人件費・仕入れをまかなえていません。');}}

  // 新商品：試験販売の判定
  for(const d of (cfg.dev&&cfg.dev.list)||[]){const s=st.prod[d.id];if(!s||s.status!=='trial')continue;const sp=plan.shops[d.shop];if(!sp)continue;
    const i=sp.pids.indexOf(d.id);if(i<0)continue;const base=sp.pids.map((pid,j)=>!cat[pid].dev?sp.tot.byProd[j]:null).filter(x=>x!=null&&x>0).sort((a,b)=>a-b);
    const med=base.length?base[Math.floor(base.length/2)]:1;s.ratios.push(sp.tot.byProd[i]/Math.max(1,med));s.units+=sp.tot.byProd[i];
    if(s.ratios.length>=cfg.dev.trialDays){const avg=s.ratios.reduce((a,b)=>a+b,0)/s.ratios.length,shop=cfg.shops.find(x=>x.id===d.shop);
      if(avg>=cfg.dev.keepRatio){s.status='regular';add('judge',shop.st,`「${d.name}」が定番に`,`${shop.name}で${s.ratios.length}日間に${Math.round(s.units)}個売れ、ほかの商品とならぶ売れ行きでした。これからも置きます。`);}
      else{s.status='ended';add('judge',shop.st,`「${d.name}」は終売`,`${shop.name}で${s.ratios.length}日間に${Math.round(s.units)}個。定番の商品にはおよびませんでした。`);}}}

  // 新商品：試験販売を始める（運行日 every ごと、同時に1つまで）
  const list=(cfg.dev&&cfg.dev.list)||[];const busy=list.some(d=>st.prod[d.id]&&st.prod[d.id].status==='trial');
  if(!busy&&day%cfg.dev.every===0){for(let k=st.devNext;k<list.length;k++){const d=list[k];if(!st.open[d.shop]||st.prod[d.id])continue;if(st.cash<d.devCost)break;
      st.cash-=d.devCost;st.prod[d.id]={status:'trial',since:day+1,ratios:[],units:0};st.devNext=k+1;const shop=cfg.shops.find(x=>x.id===d.shop);
      add('dev',shop.st,`新商品「${d.name}」を試験販売`,`次の運行日から${cfg.dev.trialDays}日間、${shop.name}に置いてみます（${d.price.toLocaleString()}円）。売れ行きしだいで定番にします。`);break;}}

  // 出店：計画の順に、積み立てが費用に届いたら1日1店まで
  for(const pl of cfg.plans||[]){if(st.open[pl.shop])continue;if(st.cash>=pl.cost){st.cash-=pl.cost;st.open[pl.shop]=true;const s=cfg.shops.find(x=>x.id===pl.shop);add('open',s.st,`出店：${s.name}`,pl.news);}break;}

  if(st.news.length>60)st.news=st.news.slice(-60);
  return {state:st,news,sales,profit};}

function nextPlan(cfg,state){for(const pl of cfg.plans||[])if(!state.open[pl.shop])return {...pl,shopDef:cfg.shops.find(x=>x.id===pl.shop)};return null;}

root.ShopCore={T0,T1,SLOT,create,catalog,shopProducts,planDay,closeDay,idxAt,stockAt,soFar,shopProfit,nextPlan,prodWeight};
})(typeof window!=='undefined'?window:globalThis);
