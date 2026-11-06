/* =====================================================================
   川辺の配送センター（自社）の計算：売上の記録と、おまかせ発注
   ・売店は毎晩、売れた数・売り切れで逃した数・廃棄・残りの在庫を自動でセンターへ送る（salesRecord）。
   ・センターは店ごと品ごとに次の運行日の数を決める（plan）。
       同じ型の日（平日・土曜・日曜祝日）の最近の「売れた数＋売り切れで逃した数」の平均を、
       天気・季節で直し（data/kiosk.json の genres の wx・season と、data/center.json の wxAll）、
       ねらい（廃棄を少なく／その間／売り切れを少なく）で上乗せの量を変える。
       その日のうちに売る品は「1日の数」、日持ちする品は「裏も合わせた在庫の目標」（売店の仕入れ数と同じ意味）なので、
       日持ちする品は残りの在庫が目標に入っている（届くのは目標との差だけ）。
   ・行き先：factory＝工場で作る品（全店の合計を20:00に工場へ）、center＝センター在庫の品（店ごとの便に割り振る）、
     direct＝新聞・雑誌・たばこ（センターを通らない。おまかせでも店の数のまま）。
   ・運行日ごとの記録（売上の記録とセンターの発注）は、画面がブラウザの dia-orders に残す（ここは計算だけ。DOM も localStorage も使わない）。
   ・第1段は売店の計算（js/kiosk-core.js）を変えない。工場で足りなくても売店にはいつもどおり届く扱い。
   ===================================================================== */
(function(root){
'use strict';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const hm=(list,h)=>{let m=1;if(list)for(const [a,b,k] of list)if(h>=a&&h<b)m*=k;return m;};

function storeKey(state){return state.st+'-'+state.place;}
function orderNo(forDay,key){return 'O'+String(forDay).padStart(4,'0')+'-'+key;}
function genreOf(kcfg,pid){const p=kcfg._cix||(kcfg._cix=Object.fromEntries(kcfg.products.map(x=>[x.id,x])));return p[pid]&&p[pid].genre;}
function genreCfg(kcfg,gid){return kcfg.genres.find(g=>g.id===gid)||{};}
function routeOf(ccfg,gid){const R=ccfg.routes||{};if((R.factory||[]).includes(gid))return 'factory';if((R.direct||[]).includes(gid))return 'direct';return 'center';}

/* 売上の記録：その運行日の結果（kiosk-core の simulate の戻り値）から、品ごとに
   [売れた数, 売り切れで逃した数, 廃棄, 閉店のあとの残り]（その日の仕入れ数は、前の日の発注 orders に入っている） */
function salesRecord(kcfg,state,res){const items={},ids=new Set([...Object.keys(res.sold||{}),...Object.keys(res.lostSO||{}),...Object.keys(res.wasteBy||{}),...Object.keys(res.carry||{})]);
  for(const pid of ids){if(!genreOf(kcfg,pid))continue;const left=(res.carry&&res.carry[pid]||[]).reduce((s,x)=>s+(x.q||0),0);
    const a=[res.sold[pid]||0,res.lostSO[pid]||0,res.wasteBy[pid]||0,left];
    while(a.length&&a[a.length-1]===0)a.pop();if(a.length)items[pid]=a;}   // 終わりの0は書かない（引き継ぎコードを小さく）
  const soldout=Object.keys(res.lostSO||{}).filter(k=>res.lostSO[k]>0).length;
  return {day:res.day,store:storeKey(state),cond:res.cond?{day:res.cond.day,wx:res.cond.wx,season:res.cond.season}:null,
    waste:Math.round(res.pl&&res.pl.waste||0),soldout,items};}

/* 天気・季節の向き不向き（店全体×ジャンル）。倍率は 1/cap〜cap に収める */
function condW(kcfg,ccfg,gid,c){if(!c)return 1;const g=genreCfg(kcfg,gid),cap=ccfg.wxCap||4;
  const w=((ccfg.wxAll||{})[c.wx]??1)*((g.wx&&g.wx[c.wx])??1)*((g.season&&g.season[c.season])||1);return clamp(w,1/cap,cap);}

/* 日持ちする品：便と便のあいだにいちばん多く売れる割合（目標はその分を満たせばよい）。
   便のある時刻は kiosk.json の deliveries、時間帯の売れやすさはジャンルの hours×店の時間ごとの客（custH） */
function segShare(kcfg,state,gid,ty){const O0=kcfg.open[0],O1=kcfg.open[1],g=genreCfg(kcfg,gid),cH=state.custH&&state.custH[ty];
  const ts=kcfg.deliveries.filter(d=>d.all||(d.genres||[]).includes(gid)).map(d=>Math.max(O0,d.t/60)).sort((a,b)=>a-b);
  const w=h=>hm(g.hours,h)*(cH&&cH[h]!=null?Math.max(0.2,cH[h]):1);let tot=0;for(let h=O0;h<O1;h++)tot+=w(h);if(!tot)return 1;
  let best=0;for(let i=0;i<ts.length;i++){const a=ts[i],b=i+1<ts.length?ts[i+1]:O1;let s=0;for(let h=Math.floor(a);h<O1&&h<b;h++)s+=w(h)*(Math.min(b,h+1)-Math.max(a,h));best=Math.max(best,s);}
  return clamp(best/tot,0.15,1);}

/* おまかせの数：店ごと品ごとに次の運行日の数
   recs：この店の売上の記録（古い順。ほかの店・移転前の記録はまぜない）
   next：次の運行日の条件 {day:'wd'|'sat'|'hol',wx,season}（天気は予報のつもり）
   opts：{aim:'waste'|'mid'|'soldout', shelf: kiosk-core の shelfInfo（棚に置いている品だけ決める）, cur: 店のいまの仕入れ数}
   返すもの：{items:{pid:数}, by:{factory:{},center:{},direct:{}}, why:{pid:{mu,sd,n,from}}} */
function plan(kcfg,ccfg,state,recs,next,opts){opts=opts||{};const A=(ccfg.aims||{})[opts.aim||ccfg.defaultAim||'mid']||{z:0.35},key=storeKey(state);
  const mine=(recs||[]).filter(r=>r.store===key),ty=next&&next.day||'wd';
  const same=mine.filter(r=>r.cond&&r.cond.day===ty).slice(-(ccfg.lookback||4)),any=mine.slice(-(ccfg.lookback||4)*2);
  const items={},by={factory:{},center:{},direct:{}},why={},cur=opts.cur||state.order||{},shelf=opts.shelf||{};
  for(const pid in shelf){const gid=genreOf(kcfg,pid);if(!gid)continue;const route=routeOf(ccfg,gid),g=genreCfg(kcfg,gid),cap=shelf[pid].cap||0;
    if(route==='direct'){items[pid]=cur[pid]||0;by.direct[pid]=items[pid];why[pid]={from:'direct'};continue;}
    // 同じ型の日がなければ、型をまたいで（店全体の型の差は custH の合計の比で直す）
    let use=same,from='same';if(!use.length){use=any;from='any';}
    const tyN=t=>{const a=state.custH&&state.custH[t];return a?a.reduce((s,v)=>s+(v||0),0):0;},tyF=r=>{const a=tyN(ty),b=tyN(r.cond&&r.cond.day);return a>0&&b>0?clamp(a/b,0.5,2):1;};
    const vals=use.map(r=>{const x=r.items[pid]||[];const d=(x[0]||0)+(x[1]||0)*(ccfg.lostW??0.7);return d/condW(kcfg,ccfg,gid,r.cond)*(from==='any'?tyF(r):1);});
    const n=vals.length,wn=condW(kcfg,ccfg,gid,next);
    const life=g.life||0,perish=life<99;   // その日のうちに売る品・パン（2日）は捨てることがある
    let mu=n?vals.reduce((a,b)=>a+b,0)/n*wn:0;
    let sd=Math.sqrt(mu+Math.pow((ccfg.cv||0.18)*mu,2));
    if(n>=4){const m0=vals.reduce((a,b)=>a+b,0)/n,s0=Math.sqrt(vals.reduce((a,b)=>a+(b-m0)*(b-m0),0)/(n-1))*wn;sd=Math.max(sd,s0);}
    const z=perish?A.z:(ccfg.keepZ??1.3);
    let q;
    if(life===0)q=mu+z*sd;                                             // 1日の数
    else{const sh=segShare(kcfg,state,gid,ty);const m2=mu*sh,s2=Math.max(Math.sqrt(m2+Math.pow((ccfg.cv||0.18)*m2,2)),n>=4?sd*sh:0);
      q=m2+z*s2;if(!perish&&ccfg.minShelf)q=Math.max(q,cap);}              // 在庫の目標（便と便のあいだの分）
    q=Math.max(0,Math.round(q));
    // 記録が少ないうちは、いまの仕入れ数と混ぜる
    const wu=ccfg.warmup??2,w=n/(n+wu),c0=cur[pid]!=null?cur[pid]:q;
    if(!n)q=c0;else q=Math.max(0,Math.round(w*q+(1-w)*c0));
    if(q===0&&mu>0.3)q=1;
    items[pid]=q;by[route][pid]=q;why[pid]={mu:+mu.toFixed(1),sd:+sd.toFixed(1),n,from,w:+w.toFixed(2)};}
  return {items,by,why,aim:opts.aim||ccfg.defaultAim||'mid',type:ty};}

/* 運行日ごとの記録（dia-orders）に足す。log={v:1,days:[{day,recs:{店:記録},orders:{店:発注},factory:{no,items}}]} */
function emptyLog(){return {v:1,days:[]};}
function dayOf(log,day){let d=log.days.find(x=>x.day===day);if(!d){d={day,recs:{},orders:{}};log.days.push(d);log.days.sort((a,b)=>a.day-b.day);}return d;}
function putRecord(log,rec,keep){const d=dayOf(log,rec.day);d.recs[rec.store]=rec;trim(log,keep);return log;}
/* 発注：店ごとの数（自分で決めた店も、おまかせの店も）。工場で作る品は全店の合計を工場への発注に */
function putOrder(kcfg,ccfg,log,forDay,key,o,keep){const d=dayOf(log,forDay),f={},c={},dr={};
  for(const pid in o.items){const q=o.items[pid];if(!q)continue;const r=routeOf(ccfg,genreOf(kcfg,pid));(r==='factory'?f:r==='direct'?dr:c)[pid]=q;}
  d.orders[key]={no:orderNo(forDay,key),mode:o.mode||'self',aim:o.aim||null,factory:f,center:c,direct:dr,ask:o.ask||null};
  const tot={};for(const k in d.orders)for(const pid in d.orders[k].factory)tot[pid]=(tot[pid]||0)+d.orders[k].factory[pid];
  d.factory={no:'F'+String(forDay).padStart(4,'0'),at:ccfg.times&&ccfg.times.factoryFix||1200,items:tot,from:Object.values(d.orders).map(x=>x.no)};
  trim(log,keep);return log;}
function trim(log,keep){keep=keep||30;if(log.days.length>keep+1)log.days=log.days.slice(-(keep+1));}
function recsOf(log,key){return (log&&log.days||[]).map(d=>d.recs&&d.recs[key]).filter(Boolean);}

root.CenterCore={storeKey,orderNo,routeOf,salesRecord,plan,segShare,condW,emptyLog,putRecord,putOrder,recsOf};
if(typeof module!=='undefined')module.exports=root.CenterCore;
})(typeof window!=='undefined'?window:globalThis);
