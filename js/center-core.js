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
   ・第3回（2026-11-07）から：工場の納品書（js/factory-night.js）で足りない品は、その出荷数までしか売店に届かない（supplyFor → kiosk-core の ctx.supply）。
     流れ（工場→センター→店ごとに分けてセンター在庫の品と合わせる→トラック→売店の便）の時刻は data/center.json の flow と slip.trucks。
   ・2026-11-09 から：運行日 N の注文は、N-1 の 19:00 の記録（pre）と N-2 までの1日の記録だけで決める（19:30 に決める注文が、それより後の売れ行きを使わないように）。
     運行日の締めで、どの便で何が届いたか・届かなかった分・センターに残った分（取引先へ）を「到着」として残す（arrival）。
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
  const out={day:res.day,store:storeKey(state),cond:res.cond?{day:res.cond.day,wx:res.cond.wx,season:res.cond.season}:null,
    waste:Math.round(res.pl&&res.pl.waste||0),soldout,items};
  const pre=preRecord(kcfg,res,cutOf(kcfg));if(pre)out.pre=pre;return out;}

/* 19:00 の記録（2026-11-09）：センターが次の運行日の注文を決める 19:30 に、もう確定している数だけ。
   売店の1日の出来事の列（res.ev・res.snap）から、その時刻までの [売れた数, 売り切れで逃した数, その時刻の在庫（棚＋裏）, うちその日に届いた分]。
   売店は 26:00 に締めるが、注文に使うのはこの数だけ（因果と時刻の順。19:00 より後の売れ行きは、次の次の運行日の注文から使う） */
function cutOf(kcfg){return kcfg.orderDeadline!=null?kcfg.orderDeadline:1140;}
function preRecord(kcfg,res,T){if(!res||!res.ev||!res.snap||!res.snap.length)return null;const sold={},lost={},got={};
  for(const e of res.ev){if(e.t>=T)break;if(e.k==='buy')for(const [pid,q] of e.items)sold[pid]=(sold[pid]||0)+q;
    else if(e.k==='look'&&e.why==='売り切れ'&&e.pid)lost[e.pid]=(lost[e.pid]||0)+1;
    else if(e.k==='delivery')for(const pid in e.items||{})got[pid]=(got[pid]||0)+e.items[pid];}
  let sn=res.snap[0];for(const x of res.snap){if(x.t<=T)sn=x;else break;}
  const items={},ids=new Set([...Object.keys(sold),...Object.keys(lost),...Object.keys(sn.s||{})]);
  for(const pid of ids){if(!genreOf(kcfg,pid))continue;const stock=((sn.s||{})[pid]||0)+((sn.b||{})[pid]||0);
    const a=[sold[pid]||0,lost[pid]||0,stock,Math.min(stock,got[pid]||0)];while(a.length&&a[a.length-1]===0)a.pop();if(a.length)items[pid]=a;}
  return {at:T,items};}
/* その時刻より前に来る客の割合（ジャンルの時間帯×店の時間ごとの客）。19:00 までの数から1日の数を見込むのに使う */
function shareBefore(kcfg,state,gid,ty,T){const O0=kcfg.open[0],O1=kcfg.open[1],g=genreCfg(kcfg,gid),cH=state.custH&&state.custH[ty];
  const w=h=>hm(g.hours,h)*(cH&&cH[h]!=null?Math.max(0.2,cH[h]):1);let tot=0,pre=0;for(let h=O0;h<O1;h++){const x=w(h);tot+=x;pre+=x*clamp((T/60-h),0,1);}return tot?pre/tot:1;}

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
  const all=(recs||[]).filter(r=>r.store===key),ty=next&&next.day||'wd',fd=opts.forDay;
  // forDay（注文する運行日）があれば、1日まるごと使うのは2日前まで。前の日は 19:00 の記録（pre）だけ（19:30 に注文を決めるので）
  const prev=fd!=null?all.find(r=>r.day===fd-1&&r.pre):null,mine=fd!=null?all.filter(r=>r.day<=fd-2):all;
  const same=mine.filter(r=>r.cond&&r.cond.day===ty).slice(-(ccfg.lookback||4)),any=mine.slice(-(ccfg.lookback||4)*2);
  const items={},by={factory:{},center:{},direct:{}},why={},cur=opts.cur||state.order||{},shelf=opts.shelf||{};
  for(const pid in shelf){const gid=genreOf(kcfg,pid);if(!gid)continue;const route=routeOf(ccfg,gid),g=genreCfg(kcfg,gid),cap=shelf[pid].cap||0;
    if(route==='direct'){items[pid]=cur[pid]||0;by.direct[pid]=items[pid];why[pid]={from:'direct'};continue;}
    // 同じ型の日がなければ、型をまたいで（店全体の型の差は custH の合計の比で直す）
    let use=same,from='same';if(!use.length){use=any;from='any';}
    const tyN=t=>{const a=state.custH&&state.custH[t];return a?a.reduce((s,v)=>s+(v||0),0):0;},tyF=r=>{const a=tyN(ty),b=tyN(r.cond&&r.cond.day);return a>0&&b>0?clamp(a/b,0.5,2):1;};
    const vals=use.map(r=>{const x=r.items[pid]||[];const d=(x[0]||0)+(x[1]||0)*(ccfg.lostW??0.7);return d/condW(kcfg,ccfg,gid,r.cond)*(from==='any'?tyF(r):1);});
    if(prev&&(from==='any'||(prev.cond&&prev.cond.day===ty))){const ptY=(prev.cond&&prev.cond.day)||ty,sh=shareBefore(kcfg,state,gid,ptY,prev.pre.at);
      if(sh>=0.3){const x=prev.pre.items[pid]||[];const d=((x[0]||0)+(x[1]||0)*(ccfg.lostW??0.7))/sh;vals.push(d/condW(kcfg,ccfg,gid,prev.cond)*(from==='any'?tyF(prev):1));}}
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

/* 工場に頼む数（2026-11-09）：日持ちする工場の品（パン）の仕入れ数は「棚と裏の在庫の目標」なので、
   そのまま工場に頼むと、前の日の残りの分が店に届かずセンターに残る。前の日の 19:00 の記録から「次の朝に残っている数」を見込み、
   目標との差（＝届ける数）だけを頼む。残りの見込み：19:00 にあった、その日に届いた分（古い分から先に売れる）から、19:00 より後に売れる見込みを引く。
   前の日の記録がなければ、目標のまま。返すのは、その品の頼む数だけ {pid:数} */
function factoryQty(kcfg,ccfg,state,recs,forDay,items){const key=storeKey(state),prev=(recs||[]).find(r=>r.store===key&&r.day===forDay-1&&r.pre),out={};
  for(const pid in items){const gid=genreOf(kcfg,pid);if(!gid||routeOf(ccfg,gid)!=='factory')continue;const life=genreCfg(kcfg,gid).life||0;if(life<2)continue;
    const target=items[pid]||0;if(!prev){out[pid]=target;continue;}
    const x=prev.pre.items[pid]||[],sold=x[0]||0,lost=x[1]||0,stock=x[2]||0,fresh=x[3]||0,ty=(prev.cond&&prev.cond.day)||'wd',sh=shareBefore(kcfg,state,gid,ty,prev.pre.at);
    const after=sh>=0.05?(sold+lost*(ccfg.lostW??0.7))/sh*(1-sh):0,old=Math.max(0,stock-fresh),carry=Math.max(0,fresh-Math.max(0,after-old));
    out[pid]=Math.max(0,Math.round(target-carry));}
  return out;}

/* 運行日ごとの記録（dia-orders）に足す。log={v:1,days:[{day,recs:{店:記録},orders:{店:発注},factory:{no,items}}]} */
function emptyLog(){return {v:1,days:[]};}
function dayOf(log,day){let d=log.days.find(x=>x.day===day);if(!d){d={day,recs:{},orders:{}};log.days.push(d);log.days.sort((a,b)=>a.day-b.day);}return d;}
function putRecord(log,rec,keep){const d=dayOf(log,rec.day);d.recs[rec.store]=rec;trim(log,keep);return log;}
/* 発注：店ごとの数（自分で決めた店も、おまかせの店も）。工場で作る品は全店の合計を工場への発注に */
function putOrder(kcfg,ccfg,log,forDay,key,o,keep){const d=dayOf(log,forDay),f={},c={},dr={};
  for(const pid in o.items){const q=o.items[pid];if(!q)continue;const r=routeOf(ccfg,genreOf(kcfg,pid));(r==='factory'?f:r==='direct'?dr:c)[pid]=q;}
  if(o.fq)for(const pid in o.fq){if(o.fq[pid]>0)f[pid]=o.fq[pid];else delete f[pid];}   // 工場に頼む数（日持ちする工場の品は「届ける数」。factoryQty）
  d.orders[key]={no:orderNo(forDay,key),mode:o.mode||'self',aim:o.aim||null,factory:f,center:c,direct:dr,ask:o.ask||null};
  const tot={};for(const k in d.orders)for(const pid in d.orders[k].factory)tot[pid]=(tot[pid]||0)+d.orders[k].factory[pid];
  d.factory={no:'F'+String(forDay).padStart(4,'0'),at:ccfg.times&&ccfg.times.factoryFix||1200,items:tot,from:Object.values(d.orders).map(x=>x.no)};
  trim(log,keep);return log;}
function trim(log,keep){keep=keep||30;if(log.days.length>keep+1)log.days=log.days.slice(-(keep+1));}
function recsOf(log,key){return (log&&log.days||[]).map(d=>d.recs&&d.recs[key]).filter(Boolean);}

/* 売店に回せる工場の品の上限＝納品書の出荷数（工場の品すべて。届く数が工場の出荷数をこえないように） */
function supplyFor(slip,key,kcfg,ccfg,shelf){const m=slip&&!slip.err&&slip.stores&&slip.stores[key];if(!m)return null;const o={};
  for(const pid in m.items)o[pid]=m.items[pid][1];
  // 工場の品で、この店が頼まなかった品（届ける数が0）は、店に届かない（2026-11-09。shelf を渡したときだけ）
  if(kcfg&&ccfg&&shelf)for(const pid in shelf)if(o[pid]==null&&routeOf(ccfg,genreOf(kcfg,pid))==='factory')o[pid]=0;
  return Object.keys(o).length?o:null;}
/* かご車（2026-11-09）：センターが、工場から届いた品（納品書の出荷数）を、便ごとに店へ分ける。
   その日のうちに売る品（おにぎり・サンド・ドーナッツ）は、その品のジャンルが載っている便に、朝5・昼前2.5・午後2.5 の重みで分ける（端数は合計が出荷数とちょうど同じになるように）。
   日持ちする品（パン）は、載っている最初の便（朝の便）にまとめる。店は、この数をそのまま受け取る（店の計算は便ごとの数を決めない）。
   センター在庫の品（飲み物・お菓子など）は、いままでどおり、便が着いたときの店の在庫を見て足す（センターの在庫に限りはまだない）。
   返すもの：{runs:{便の名前:{品:数}}, pids:{品:1}, cut:{品:工場が足りなくて届かない数}}。納品書がなければ null */
function cart(kcfg,ccfg,slip,key,shelf){const sup=supplyFor(slip,key,kcfg,ccfg,shelf),ord=supplyOrdFor(slip,key,kcfg,ccfg,shelf);if(!sup)return null;
  const runs={},pids={},cut={},DL=kcfg.deliveries||[];for(const d of DL)runs[d.name]={};
  const m=slip.stores[key],LT=slip.late;
  // 追いかけ便（工場が遅れたとき）：あとからできた分を、のせる便（LT.bin）に足す
  if(LT&&LT.mode==='chase'&&LT.bin&&runs[LT.bin])for(const pid in m.items){const c2=m.items[pid][2]||0;if(c2>0&&sup[pid]!=null)runs[LT.bin][pid]=(runs[LT.bin][pid]||0)+c2;}
  for(const pid in sup){const gid=genreOf(kcfg,pid);if(!gid)continue;pids[pid]=1;const ch=(m.items[pid]&&m.items[pid][2])||0,q=sup[pid]||0,o=ord&&ord[pid]!=null?ord[pid]:q;if(o>q+ch)cut[pid]=o-q-ch;if(!q)continue;
    const on=DL.filter(d=>d.all||(d.genres||[]).includes(gid));if(!on.length)continue;
    if((genreCfg(kcfg,gid).life||0)>=2){runs[on[0].name][pid]=q;continue;}
    const w=on.map(d=>d.all?2:1),W=w.reduce((x,y)=>x+y,0),raw=w.map(x=>q*x/W),fl=raw.map(Math.floor);let left=q-fl.reduce((x,y)=>x+y,0);
    const ord2=raw.map((x,i)=>[x-fl[i],i]).sort((x,y)=>y[0]-x[0]||x[1]-y[1]);for(const [,i] of ord2){if(left<=0)break;fl[i]++;left--;}
    on.forEach((d,i)=>{if(fl[i])runs[d.name][pid]=fl[i];});}
  return {runs,pids,cut};}
/* 工場に頼んだ数（納品書の注文の数）。頼まなかった工場の品は0 */
function supplyOrdFor(slip,key,kcfg,ccfg,shelf){const s=supplyFor(slip,key,kcfg,ccfg,shelf);if(!s)return null;const m=slip.stores[key],o={};for(const pid in s)o[pid]=m.items[pid]?m.items[pid][0]:0;return o;}
/* トラックと、店に着く時刻（センターを出てからの分） */
function truckFor(ccfg,key){const st=String(key).split('-')[0],T=(ccfg.slip&&ccfg.slip.trucks)||[];const t=T.find(x=>(x.st||[]).includes(st));return t?{id:t.id,name:t.name,min:(t.min&&t.min[st])||0}:null;}
/* =====================================================================
   センターの倉庫（2026-11-09）：センター在庫の品（飲み物・お菓子・日用品・冷凍のホットスナック）に限りをつける
   ・倉庫の記録 cs＝{v:1, day:開けた運行日, closed:締めた運行日, stock:{品:数}, po:[問屋への発注], log:[日ごとの出入り]}（画面が dia-center に残す）
   ・運行日の始め（csOpen）：その日に着く問屋の品を在庫に足す → 発注日（data/center.json の ws.orderDays）なら、おまかせの数を問屋に頼む（次の運行日に着く）
   ・その日の店への便は、始めの在庫まで（kiosk-core の ctx.cstock）。足りなければ店に届く数が減る（res.ccut）
   ・運行日の締め（csClose）：その日に店へ出した数を在庫から引く。同じ日を2回引かない
   ・時刻の順：発注は運行日の始め（前の日の締めのあと）なので、前の日までの1日の記録を使ってよい
   ===================================================================== */
function csNew(){return {v:1,day:null,closed:null,stock:{},po:[],log:[]};}
function centerPids(kcfg,ccfg,shelf){return Object.keys(shelf||{}).filter(pid=>{const g=genreOf(kcfg,pid);return g&&routeOf(ccfg,g)==='center';});}
/* 1日の出る数の見込み（全店の合計）：最近の記録の「売れた数＋売り切れで逃した数×lostW」。記録がなければ 店の仕入れ数×guess */
function csDemand(kcfg,ccfg,recs,stores,pid,upto,cs){const W=ccfg.ws||{},lw=ccfg.lostW??0.7,by={};
  // センター自身の記録（店へ出した数＋足りなくて出せなかった数）が3日以上あれば、それを使う（店は便ごとに目標まで足すので、売れ方よりまとまって出る）
  const L=cs?cs.log.filter(x=>x.day<=upto&&!x.fill).slice(-(W.lookback||7)):[];   // fill：店を開いた日（棚を満たす分）は入れない
  if(L.length>=3){const v=L.map(x=>((x.out||{})[pid]||0)+((x.short||{})[pid]||0)),mu=v.reduce((a,b)=>a+b,0)/v.length,sd=Math.sqrt(v.reduce((a,b)=>a+(b-mu)*(b-mu),0)/Math.max(1,v.length-1));return {mu,sd:Math.max(sd,Math.sqrt(mu)),n:L.length,from:'center'};}
  for(const r of recs||[]){if(r.day>upto)continue;const st=stores.find(x=>x.key===r.store);if(!st)continue;const x=r.items[pid]||[];by[r.day]=(by[r.day]||0)+(x[0]||0)+(x[1]||0)*lw;}
  const days=Object.keys(by).map(Number).sort((a,b)=>a-b).slice(-(W.lookback||7)),vals=days.map(d=>by[d]),n=vals.length;
  if(!n){const g=stores.reduce((t,st)=>t+((st.order||{})[pid]||0),0)*(W.guess??0.35);return {mu:g,sd:Math.sqrt(g),n:0};}
  const mu=vals.reduce((a,b)=>a+b,0)/n,sd=n>=3?Math.sqrt(vals.reduce((a,b)=>a+(b-mu)*(b-mu),0)/(n-1)):Math.sqrt(mu);return {mu,sd:Math.max(sd,Math.sqrt(mu)),n};}
function nextOrderDay(ccfg,d){const O=(ccfg.ws&&ccfg.ws.orderDays)||[1,4];for(let k=0;k<14;k++)if(O.includes(((d+k)%7+7)%7))return d+k;return d+7;}
function onOrder(cs,pid,after){return cs.po.filter(p=>p.st!=='in'&&p.arr>after).reduce((t,p)=>t+((p.items||{})[pid]||0),0);}
/* おまかせの発注の数（day の朝に頼み、day+lead に着く。次の次の入荷＝次の発注日＋lead の前の日までを満たす） */
function wsQty(kcfg,ccfg,cs,day,pid,dm){const W=ccfg.ws||{},L=W.lead??1,d2=nextOrderDay(ccfg,day+1),span=d2-day,cs0=cs.stock[pid]||0;
  const need=dm.mu*span+(W.z??1.3)*dm.sd*Math.sqrt(span+L),pos=cs0+onOrder(cs,pid,day)-dm.mu*L,q=Math.max(0,need-pos);if(q<=0.5)return 0;
  const c=(W.case||{})[genreOf(kcfg,pid)]||1;return Math.ceil(q/c)*c;}
/* 運行日の始め。o＝{stores:[{key, order:仕入れ数, shelf}], recs:全店の売上の記録}。返すもの：この日に足した・頼んだこと */
function csOpen(kcfg,ccfg,cs,day,o){const W=ccfg.ws||{},stores=o.stores||[],pids=[...new Set(stores.flatMap(st=>centerPids(kcfg,ccfg,st.shelf)))],did={in:[],po:[]};
  if(cs.day==null){for(const pid of pids){const dm=csDemand(kcfg,ccfg,o.recs,stores,pid,day-1,cs),c=(W.case||{})[genreOf(kcfg,pid)]||1,fill=stores.reduce((t,st)=>t+((st.order||{})[pid]||0),0);cs.stock[pid]=Math.ceil((fill+dm.mu*(W.initDays??5))/c)*c;}cs.day=day-1;}   // はじめの在庫：店の棚を1回満たす分＋initDays 日分
  for(const pid of pids)if(cs.stock[pid]==null)cs.stock[pid]=0;
  for(let d=cs.day+1;d<=day;d++){
    for(const p of cs.po)if(p.st!=='in'&&p.arr<=d){for(const pid in p.items)cs.stock[pid]=(cs.stock[pid]||0)+p.items[pid];p.st='in';p.got=d;did.in.push(p.no);}
    if((W.orderDays||[1,4]).includes(((d%7)+7)%7)&&!cs.po.some(p=>p.day===d)){const items={};
      for(const pid of pids){const q=wsQty(kcfg,ccfg,cs,d,pid,csDemand(kcfg,ccfg,o.recs,stores,pid,d-1,cs));if(q>0)items[pid]=q;}
      if(Object.keys(items).length){const p={no:'W'+String(d).padStart(4,'0'),day:d,arr:d+(W.lead??1),items,st:'out'};cs.po.push(p);did.po.push(p.no);}}}
  cs.day=Math.max(cs.day,day);if(!cs.open||cs.open.day!==day){cs.open={day,stock:{...cs.stock}};did.changed=true;}   // その日の始めの在庫（店への便の上限。締めで在庫が減っても、その日の計算は変わらない）
  if(did.in.length||did.po.length)did.changed=true;if(cs.po.length>12)cs.po=cs.po.filter(p=>p.st!=='in').concat(cs.po.filter(p=>p.st==='in').slice(-8)).sort((a,b)=>a.day-b.day);
  return did;}
/* その日に店へ出したセンター在庫の品（便と当日の追加） */
function centerOut(kcfg,ccfg,res){const out={};for(const e of res.ev||[]){if(e.k!=='delivery'||(e.express&&!e.addOn))continue;for(const pid in e.items||{}){const g=genreOf(kcfg,pid);if(g&&routeOf(ccfg,g)==='center')out[pid]=(out[pid]||0)+e.items[pid];}}return out;}
/* 運行日の締め：店へ出した数を引く（同じ日を2回引かない） */
function csClose(kcfg,ccfg,cs,res){if(cs.closed!=null&&res.day<=cs.closed)return false;const out=centerOut(kcfg,ccfg,res);
  for(const pid in out)cs.stock[pid]=Math.max(0,(cs.stock[pid]||0)-out[pid]);
  cs.log.push({day:res.day,out,...(cs.log.length?{}:{fill:true}),short:res.ccut&&Object.keys(res.ccut).length?res.ccut:null});if(cs.log.length>21)cs.log=cs.log.slice(-21);cs.closed=res.day;return true;}
/* 在庫の見通し（画面用）：次に着く日までに出ていく見込みと、足りなくなるおそれ。
   返すもの：{pid:{stock, mu, cover:何日分, next:次に着く日, nextQ:その数, until:それまでに出る見込み, after:着く前の見込みの残り, st:'ok'|'thin'|'short'}} */
function csOutlook(kcfg,ccfg,cs,day,o){const W=ccfg.ws||{},stores=o.stores||[],out={},T=o.today||null;   // today：{done:きょうもう出した, todo:きょうこれから出す, cut:きょう足りずに出せなかった}（画面から）
  for(const pid of Object.keys(cs.stock)){const dm=csDemand(kcfg,ccfg,o.recs,stores,pid,day-1,cs),s0=cs.stock[pid]||0;
    const p=cs.po.filter(x=>x.st!=='in'&&x.arr>day&&(x.items||{})[pid]).sort((a,b)=>a.arr-b.arr)[0];
    const next=p?p.arr:nextOrderDay(ccfg,day+1)+(W.lead??1),days=next-day;
    // きょうの分は売店の計算でもう決まっている（T があれば、いまの在庫＝朝の在庫−もう出した数、きょうこれから出す数は見込みでなく実際の数）
    const done=T?(T.done[pid]||0):0,todo=T?(T.todo[pid]||0):0,now=Math.max(0,(T&&cs.open&&cs.open.day===day?(cs.open.stock[pid]||0):s0)-done);
    const until=T?todo+dm.mu*Math.max(0,days-1):dm.mu*days,after=now-until,cut=T&&T.cut?(T.cut[pid]||0):0;
    const st=cut>0||after<0?'short':(after<(W.z??1.3)*dm.sd*Math.sqrt(days)||now<dm.mu*1.5)?'thin':'ok';
    out[pid]={stock:now,cut,mu:dm.mu,sd:dm.sd,n:dm.n,cover:dm.mu>0?now/dm.mu:99,next,nextQ:p?p.items[pid]:0,planned:!p,until,after,st};}
  return out;}

/* トラックの便（2026-11-09）：センターを出る時刻（flow.runs の depart）＋店までの分＋遅れ＝店に着く時刻。
   遅れは slip.delay（トラック・便・運行日ごとに決まった乱数＋雨・大雪）。棚に並ぶのは、便の時刻と着いた時刻の遅いほう。
   時刻はその運行日の0:00からの分（朝の便は前の夜 28:00＝4:00 に出るので、1440 を引く）。
   返すもの：[{bin, t:便の時刻, depart, arrive, late:遅れ, shelf:棚に並ぶ時刻}] */
function hashS(s){let h=2166136261>>>0;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}return h>>>0;}
function truckRuns(ccfg,key,day,cond,wait){const F=ccfg.flow;if(!F)return [];const sortEnd=(F.center&&F.center.sortEnd)||0;wait=wait||0;const tr=truckFor(ccfg,key),TD=(ccfg.slip&&ccfg.slip.delay)||{};   // wait：工場を待った分（朝の便が遅れる）
  return (F.runs||[]).map(r=>{const u=(hashS(['truck',day,tr?tr.id:'-',r.bin].join('|'))%1000)/1000,late=Math.round((TD.max||0)*u*u)+(((TD.wx||{})[cond&&cond.wx])||0);
    const dep=r.depart>=1440?Math.max(r.depart,wait?sortEnd+wait:0)-1440:r.depart,arr=dep+(tr?tr.min:0)+late;return {bin:r.bin,t:r.t,depart:dep,arrive:arr,late:late+(r.depart>=1440?Math.max(0,dep+1440-r.depart):0),shelf:Math.max(r.t,arr)};});}
/* 流れの時刻（画面用）：工場の包装の締め切り → 工場を出る → センターに着く → 分けて合わせる → 便ごとにトラックが出る → 店に着く → 便の時刻に棚へ */
function flowOf(ccfg,key){const F=ccfg.flow;if(!F)return null;const tr=truckFor(ccfg,key);
  return {factory:F.factory,center:F.center,truck:tr,runs:(F.runs||[]).map(r=>({bin:r.bin,t:r.t,depart:r.depart,arrive:r.depart+(tr?tr.min:0),factory:r.factory}))};}
/* 到着の記録：その運行日の結果（kiosk-core の simulate）から、便ごとに工場の品（品ごと）・センター在庫の品・直送の品（数だけ）、
   工場の不足で届かなかった数（cut）、納品書の出荷数のうち届かずにセンターに残った数（left：取引先へ回す分） */
function arrival(kcfg,ccfg,state,res,slip){const key=storeKey(state),m=slip&&!slip.err&&slip.stores&&slip.stores[key],fItems=m?m.items:{},runs=[],got={};
  const binOf=t=>{const R=(ccfg.flow&&ccfg.flow.runs)||[];let best=null;for(const r of R)if(Math.abs(r.t-t)<=60&&(!best||Math.abs(r.t-t)<Math.abs(best.t-t)))best=r;return best;};
  for(const e of res.ev||[]){if(e.k!=='delivery'||e.express||e.addOn)continue;const f={},n={c:0,d:0};
    for(const pid in e.items||{}){const q=e.items[pid],r=routeOf(ccfg,genreOf(kcfg,pid));if(r==='factory'){f[pid]=q;got[pid]=(got[pid]||0)+q;}else n[r==='direct'?'d':'c']+=q;}
    const b=binOf(e.t);runs.push({t:e.t,bin:b?b.bin:e.name,f,c:n.c,d:n.d,cut:e.cut||null});}
  const left={};for(const pid in fItems){const l=fItems[pid][1]+(fItems[pid][2]||0)-(got[pid]||0);if(l>0)left[pid]=l;}   // 追いかけ便の分（[2]）も出荷に入れる
  const tr=truckFor(ccfg,key);return {day:res.day,store:key,no:m?m.no:null,slip:slip&&slip.no||null,truck:tr?tr.id:null,runs,cut:res.cut&&Object.keys(res.cut).length?res.cut:null,left};}
function putArrival(log,a,keep){const d=dayOf(log,a.day);(d.arr||(d.arr={}))[a.store]=a;trim(log,keep);return log;}

root.CenterCore={csNew,centerPids,csDemand,nextOrderDay,wsQty,csOpen,centerOut,csClose,csOutlook,truckRuns,cart,supplyOrdFor,factoryQty,preRecord,shareBefore,cutOf,storeKey,orderNo,routeOf,salesRecord,plan,segShare,condW,emptyLog,putRecord,putOrder,recsOf,supplyFor,truckFor,flowOf,arrival,putArrival};
if(typeof module!=='undefined')module.exports=root.CenterCore;
})(typeof window!=='undefined'?window:globalThis);
