/* =====================================================================
   取引の相談窓口｜計算（第1回・2026-11-12。docs/deals-plan.md）
   ・ほかの会社から届く相談（販売＝工場が品を売る／配送＝みなと川運輸が荷物を運ぶ）を、保存の種と運行日から決まった乱数で作る（同じなら同じ）。
   ・返事（引き受ける〈お試し7日／続ける〉・断る・保留）と契約を、保存 dia-deals（{v:1,...}）の形で持つ。相談そのものは保存せず、毎回作り直す。
   ・見込み：工場（ラインの空き・締め切り）と配送（便のかご車の空き・時刻・自社2店への影響）を、
     すでにある計算の結果（納品書 slip.lines・HaisoCore.dayPlan の便）から読んで出すだけ。工場や配送の計算をやり直さない。
   ・第1回は見込みだけ。第2回（2026-11-12）から、販売の契約の注文を工場へ（dayOrders）、届けた数からお金（dealMoney）。第3回（2026-11-12）から、配送の契約と「店まで届ける」を配送会社の便へ（dayHauls・haulStops）。
   ・DOM も localStorage も使わない（node でも読める）。設定は data/deals.json（すべて仮）。
   ===================================================================== */
(function(root){
'use strict';
/* 決まった乱数（種と運行日と目的の文字から） */
function hashS(s){let h=2166136261>>>0;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}return h>>>0;}
function rngOf(){let a=hashS(Array.prototype.join.call(arguments,'|'))||1;return ()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
const pickP=(r,list)=>{const tot=list.reduce((a,x)=>a+(x.p!=null?x.p:x.w!=null?x.w:1),0);let u=r()*tot;for(const x of list){u-=(x.p!=null?x.p:x.w!=null?x.w:1);if(u<0)return x;}return list[list.length-1];};
const pick=(r,a)=>a[Math.floor(r()*a.length)%a.length];
const span=(r,a)=>a[0]+(a[1]-a[0])*r();
const r10=x=>Math.max(10,Math.round(x/10)*10),r100=x=>Math.round(x/100)*100;
const LN={rice:'おにぎり',bread:'パン',sand:'サンド',donut:'ドーナツ',bento:'お弁当'};

/* 売れる品の一覧：map＝FactoryNight.kioskMap（売店の商品ID → {line,name}）、priceOf(pid)→{cost}（売店の仕入れ値） */
function catalog(map,priceOf){const out={};for(const pid in map){const p=priceOf(pid);if(!p||!(p.cost>0))continue;const L=map[pid].line;(out[L]||(out[L]=[])).push({pid,name:map[pid].name,cost:p.cost});}return out;}

/* その運行日に届く相談（保存しない・毎回同じ） */
function offersOn(cfg,cat,seed,day){const r=rngOf('deals',seed,day),pd=cfg.perDay||[1],n=(()=>{let u=r();for(let i=0;i<pd.length;i++){u-=pd[i];if(u<0)return i;}return pd.length-1;})();
  const out=[],A=cfg.arrive||[480,1140];
  for(let i=0;i<n;i++){const t=r10(span(r,A)),sell=r()<(cfg.kindP??0.6)&&Object.keys(cat||{}).length,pt=pick(r,cfg.partners),big=r()<(pt.via==='intro'?0.7:0.25),base={id:day+'-'+i,day,t,exp:day+(cfg.reply||3),partner:pt.id,name:pt.name,st:pt.st,pkind:pt.kind,via:pt.via,size:big?'big':'small'};
    if(sell){const S=cfg.sell,lines=Object.keys(S.lines).filter(k=>(cat[k]||[]).length),L=pickP(r,lines.map(k=>({k,w:S.lines[k].w}))).k,list=cat[L].slice(),k=Math.min(list.length,1+Math.floor(r()*3)),items=[];
      const tot=span(r,S.lines[L][base.size]),ws=[];for(let j=0;j<k;j++){const x=list.splice(Math.floor(r()*list.length),1)[0];ws.push(0.5+r());items.push(x);}
      const wsum=ws.reduce((a,b)=>a+b,0),pr=S.price[pt.via]||S.price.ask,off=big?(S.price.bigOff||0):0,we=(S.weekend||{})[pt.kind]??0.8;
      const lines2=items.map((x,j)=>{const q=r10(tot*ws[j]/wsum);return {pid:x.pid,name:x.name,wd:q,we:Math.round(q*we/10)*10,price:Math.round(x.cost*(span(r,pr)-off)),ref:x.cost};});
      const h=pickP(r,S.hand),ht=r10(span(r,h.t));
      out.push(Object.assign(base,{kind:'sell',line:L,items:lines2,hand:h.id,handT:ht,days:pick(r,S.days)}));}
    else{const H=cfg.haul,cg=pickP(r,H.cargo),c=Math.round(span(r,H.carts[base.size])*2)/2,dests=Object.keys(cfg.stations).filter(s=>s!=='K'),to0=pick(r,dests),to=pt.kind==='wholesale'||pt.st==='K'?to0:pt.st,w=pick(r,H.win),dw=pickP(r,H.dow);
      const fare=r100(c*span(r,H.fare.perCart)+span(r,H.fare.perStop));
      out.push(Object.assign(base,{kind:'haul',cargo:cg.id,carts:Math.max(0.5,c),from:pick(r,H.from),to,win:w.slice(),dow:dw.id,fare,days:pick(r,H.days)}));}}
  return out.sort((a,b)=>a.t-b.t);}

/* 保存（dia-deals）：{v:1, seed, d0:はじめた運行日, dec:{相談id:[返事,運行日]}, deals:[契約]} */
function newState(seed,day){return {v:1,seed:seed>>>0||1,d0:Math.max(1,day|0),dec:{},deals:[]};}
function valid(S){return !!(S&&S.v===1&&S.seed&&S.dec&&Array.isArray(S.deals));}
/* 受信箱：届いていて（きょうは now より前）、期限の中で、返事がまだ（または保留）の相談。見るのは、はじめた日の2日前から */
function inbox(cfg,cat,S,day,now){const out=[],d1=Math.max(1,S.d0-2,day-(cfg.reply||3));
  for(let d=d1;d<=day;d++)for(const o of offersOn(cfg,cat,S.seed,d)){if(d===day&&now!=null&&o.t>now)continue;if(o.exp<day)continue;const dc=S.dec[o.id];if(dc&&dc[0]!=='hold')continue;o.st2=dc?'hold':'new';o.left=o.exp-day;out.push(o);}
  return out.sort((a,b)=>(b.day-a.day)||(b.t-a.t));}
/* 返事。act：accept・decline・hold。mode：trial（お試し）／keep（続ける＝相手が望む期間）。契約は次の運行日から（前の日 18:00 に数が確定する形） */
function decide(cfg,S,o,act,day,mode){if(!S||!o)return S;if(act==='hold'){S.dec[o.id]=['hold',day];return S;}
  if(act==='decline'){S.dec[o.id]=['no',day];return S;}
  if(act==='accept'){if(S.deals.some(x=>x.id===o.id))return S;const trial=mode==='trial',len=trial?(cfg.trial||7):o.days;S.dec[o.id]=['ok',day];
    const c={id:o.id,kind:o.kind,at:day,from:day+1,to:day+len,trial,of:snap(o)};S.deals.push(c);}
  return S;}
/* 契約に残す相談の中身（画面と第2回からの計算に要るものだけ） */
function snap(o){const k=['partner','name','st','pkind','via','size','days'];const x={};for(const n of k)x[n]=o[n];
  if(o.kind==='sell')Object.assign(x,{line:o.line,items:o.items.map(i=>({pid:i.pid,name:i.name,wd:i.wd,we:i.we,price:i.price,ref:i.ref})),hand:o.hand,handT:o.handT});
  else Object.assign(x,{cargo:o.cargo,carts:o.carts,from:o.from,to:o.to,win:o.win,dow:o.dow,fare:o.fare});return x;}
/* 契約の状態：soon（これから）・on（契約中）・done（終わった） */
function stateOf(c,day){return day<c.from?'soon':day>c.to?'done':'on';}
function contracts(S,day){return (S.deals||[]).map(c=>Object.assign({},c,{state:stateOf(c,day)}));}
/* 古い返事と、終わってから長い契約を消す（保存を小さく保つ） */
function prune(cfg,S,day){const K=cfg.keep||{};const dk=K.dec||21;for(const id in S.dec){const d=+id.split('-')[0];if(day-d>dk&&!S.deals.some(c=>c.id===id))delete S.dec[id];}
  S.deals=S.deals.filter(c=>day-c.to<=(K.ended||30));if(S.deals.length>(K.maxDeals||24))S.deals=S.deals.slice(-(K.maxDeals||24));return S;}

/* 1日の数（土日は we） */
const qtyOf=(o,we)=>(o.items||[]).reduce((a,i)=>a+(we?i.we:i.wd),0);
/* すでに引き受けた販売の契約が、そのラインに足す数（day に効く契約。第1回はまだ工場に渡さない＝見込みで差し引くだけ） */
function committed(S,line,day,we,skip){let n=0;for(const c of S.deals||[]){if(c.kind!=='sell'||c.id===skip||c.of.line!==line)continue;if(day>c.to)continue;n+=qtyOf(c.of,we);}return n;}

/* 工場の見込み。F＝{lines:{id:{order,shipped,short,lastDone}}, start:{id:分}, deadline:分, own:{id:自社2店の数}}（納品書と工場の設定から。読むだけ）
   空き＝（締め切り − 最後の品ができた時刻）× そのラインのその夜の速さ（出荷 ÷ 作った時間）− ほかの契約の分 */
function sellOutlook(cfg,S,o,F,day,we){const q=qtyOf(o,we),money=sellMoney(cfg,o,we),res={q,money,line:o.line,lineName:LN[o.line]||o.line};
  const L=F&&F.lines&&F.lines[o.line];if(!L||L.lastDone==null){res.na=F&&F.lines&&Object.keys(F.lines).length?`今夜は${res.lineName}のラインを動かしていません（自社の店からも契約からも頼まれていない夜）。引き受けると、契約の日はこのラインを動かします。`:'今夜の工場の結果（納品書）がまだないので、ラインの空きは出せません。';return res;}
  const st=F.start&&F.start[o.line],dl=F.deadline,run=st!=null?L.lastDone-st:null,rate=run>0?(L.shipped||0)/run:null;
  const ext=(cfg.sell&&cfg.sell.extraMax)||120,spareMin=Math.round(Math.min(dl-L.lastDone,ext)),din=((F.dealIn||{})[o.line])||0,cm=Math.max(0,committed(S,o.line,day,we,o.id)-din),own=(F.own||{})[o.line]||0,others=Math.max(0,(L.order||0)-own-din);
  const full=(L.short||0)>Math.max(2,(L.order||0)*0.01),spare=rate&&!full?Math.max(0,Math.floor(rate*Math.max(0,spareMin))-cm):0;
  Object.assign(res,{start:st,last:L.lastDone,deadline:dl,spareMin,rate,spare,cm,din,own,others,order:L.order||0,short:L.short||0});
  if(q<=spare){res.fit='ok';res.overMin=0;}
  else{const over=q-spare;res.overMin=rate?Math.ceil(over/rate):null;res.fit=over<=others?'tight':'over';res.over=over;}
  return res;}
function sellMoney(cfg,o,we,ownFare){const lc=((cfg.sell.lines||{})[o.line]||{}).cost||0.7;let rev=0,cost=0,own=0;
  for(const i of o.items){const q=we?i.we:i.wd,ref=i.ref!=null?i.ref:(i.price/0.85);rev+=q*i.price;cost+=q*ref*lc;own+=q*ref*0.85;}
  const fee=o.hand==='deliver'?(ownFare!=null?ownFare(we?qtyOf(o,true):qtyOf(o,false)):((cfg.sell&&cfg.sell.deliverFee)||0)):0;   /* 店まで届ける：ownFare（第3回・自社の便の運賃を数から）がなければ港浜急送（仮） */
  return {rev:Math.round(rev),cost:Math.round(cost+fee),fee,profit:Math.round(rev-cost-fee),ownRev:Math.round(own)};}

/* 配送の見込み。P＝{runs:HaisoCore.dayPlan の runs, trucks:center.json の slip.trucks, H:data/haiso.json}（読むだけ）
   o＝{carts, to:駅, win:[早い,遅い], cargo, fare}。届け先は自社の店のあとに寄る。間に合わなければ「先に寄ると自社の店が○分遅れる」 */
function haulOutlook(cfg,o,P,we){const H=(P&&P.H)||{},res={carts:o.carts,fare:o.fare||0},cg=(cfg.haul.cargo||[]).find(x=>x.id===o.cargo)||{};
  const runDay=o.dow==='all'||(o.dow==='we')===!!we;res.runDay=runDay;
  const wage=(H.driver?H.driver.wage*(1+(H.driver.social||0)):((H.cost||{}).wageH||1950)),fuel=(H.cost||{}).fuelPerKm||38,kpm=((H.trucks||{}).cs||{}).kmPerMin||0.6,hd=H.handleMin||15,fee=(H.otherFee||{}).extra||15000;
  const costOf=(min,km)=>Math.round(km*fuel+min/60*wage);
  if(cg.own===false){res.mode='other';res.why=`${cg.name||'この荷物'}は自社の2トントラックでは運べないので、港浜急送に頼む形になります`;res.cost=fee;res.profit=res.fare-fee;return res;}
  const tr=((P&&P.trucks)||[]).find(t=>(t.st||[]).includes(o.to));if(!tr){res.mode='none';res.why='届け先の駅に行くトラックがありません';res.cost=0;res.profit=0;return res;}
  const mn=s=>(tr.min||{})[s]??null,mTo=mn(o.to)||0;res.truck=tr.name||tr.id;
  const runs=((P&&P.runs)||[]).filter(r=>r.leg==='cs'&&r.truck===tr.id);
  const opts=runs.map(r=>{const stops=(r.stops||[]).filter(v=>!v.deal),last=stops.reduce((a,s)=>!a||s.arrive>a.arrive?s:a,null),lastSt=last?String(last.key).split('-')[0]:null,lm=lastSt?mn(lastSt)||0:0;
    const detour=Math.abs(mTo-lm),after=(last?last.arrive:r.depart)+hd+detour,first=r.depart+(r.late||0)+mTo;
    const ownSt=stops.map(s=>String(s.key).split('-')[0]),ownDelay=Math.max(0,...ownSt.map(s=>{const m=mn(s)||0;return hd+Math.max(0,mTo+Math.abs(m-mTo)-m);}));
    const spare=+(Math.max(0,(r.cap||10)-(r.carts||0))).toFixed(1);
    return {id:r.id,bin:r.bin,depart:r.depart,last:last?last.arrive:null,after,first,ownDelay,spare,carts:r.carts||0,cap:r.cap||10,detour};});
  const W=o.win||[0,1440],inW=t=>t<=W[1];
  let best=opts.filter(x=>inW(x.after)).sort((a,b)=>Math.abs(a.after-W[0])-Math.abs(b.after-W[0]))[0],how='after';
  if(!best){best=opts.filter(x=>inW(x.first)).sort((a,b)=>a.ownDelay-b.ownDelay)[0];how='first';}
  if(!best){res.mode='none';res.why=runs.length?'この時刻に届けられる便がありません（港浜急送に頼む形）':'この駅へのトラックは、きょう走っていません（新しく便を出すか、港浜急送）';res.cost=fee;res.profit=res.fare-fee;res.opts=opts;return res;}
  const arr=how==='after'?best.after:best.first,addMin=hd+best.detour*2,km=+(best.detour*2*kpm).toFixed(1),help=o.carts>best.spare;
  const cost=costOf(addMin,km)+(help?fee:0);
  Object.assign(res,{mode:how,run:best,arrive:arr,wait:Math.max(0,W[0]-arr),addMin,km,help,ownDelay:how==='first'?best.ownDelay:0,cost,profit:res.fare-cost,opts});
  return res;}

/* ---------- 第2回（2026-11-12）：販売の契約を工場とお金へ（橋 deals-to-factory・deals-to-money。つなぐのは js/links/deals-to-*.js） ----------
   その運行日の契約の注文：契約の数（平日 wd・土日 we）のまわりで、保存の種と運行日と契約の id から決まった乱数で少しゆれる（cfg.sell.wobble・仮）。
   返すもの：{by:{契約id:{品:数}}, items:{品:合計}}（1つもなければ null） */
function dayOrders(cfg,S,day,we){const z=((cfg&&cfg.sell)||{}).wobble??0.1,by={},items={};let n=0;if(!S)return null;
  for(const c of S.deals||[]){if(c.kind!=='sell'||day<c.from||day>c.to)continue;const r=rngOf('dord',S.seed,day,c.id),o={};
    for(const i of c.of.items||[]){const base=we?i.we:i.wd;const u=r();if(!(base>0))continue;const q=Math.max(0,Math.round(base*(1+(u*2-1)*z)));if(q>0){o[i.pid]=(o[i.pid]||0)+q;items[i.pid]=(items[i.pid]||0)+q;n++;}}
    if(Object.keys(o).length)by[c.id]=o;}
  return n?{by,items}:null;}
/* 届けた数（納品書の slip.deals[id].it＝{品:[注文,出荷]}）からお金：売上＝出荷×卸値、作る費用＝出荷×仕入れ値×ラインの割合（仮）、
   店まで届けるときは港浜急送の費用（cfg.sell.deliverFee・仮。自社で運ぶ配送の契約は第3回） */
function dealMoney(cfg,c,it,ownFare){const o=c.of,lc=(((cfg&&cfg.sell&&cfg.sell.lines)||{})[o.line]||{}).cost||0.7,P={};for(const i of o.items||[])P[i.pid]=i;let rev=0,cost=0,q=0,s=0;
  for(const pid in it||{}){const a=it[pid],i=P[pid];q+=a[0]||0;s+=a[1]||0;if(!i)continue;const ref=i.ref!=null?i.ref:(i.price/0.85);rev+=(a[1]||0)*i.price;cost+=(a[1]||0)*ref*lc;}
  const fee=o.hand==='deliver'&&s>0?(ownFare!=null?ownFare:((cfg&&cfg.sell&&cfg.sell.deliverFee)||0)):0;   /* ownFare：自社の便で届けるときの運賃（第3回）。なければ港浜急送（仮） */
  return {q,s,short:q-s,rev:Math.round(rev),cost:Math.round(cost),fee,profit:Math.round(rev-cost-fee)};}
/* 契約に、その日の結果を足す（同じ日は2回足さない）。c.got＝{n:日数, q:頼まれた数, s:届けた数, y:もうけ, last:最後の日, ld:[日,頼まれた,届けた]} */
function record(S,day,id,m){const c=(S.deals||[]).find(x=>x.id===id);if(!c)return false;const g=c.got||(c.got={n:0,q:0,s:0,y:0,last:0});if(day<=g.last)return false;
  g.n++;g.q+=m.q;g.s+=m.s;g.y+=m.profit;g.last=day;g.ld=[day,m.q,m.s];return true;}

/* ---------- 第3回（2026-11-12）：配送の契約を配送会社とお金へ（橋 deals-to-haiso。つなぐのは js/links/deals-to-haiso.js） ----------
   その運行日に走る配送の契約の荷物（かご車）：契約の数のまわりで決まった乱数で少しゆれる（cfg.haul.wobble・0.5台きざみ・仮）。曜日（毎日・平日だけ・土日だけ）を守る。
   返すもの：{契約id:{k:'haul', c:かご車, to:駅, w:[早い,遅い], b:便, n:相手, f:運賃, s:仕分け料, o:1＝自社で運べない（港浜急送）}}（1つもなければ null）
   binOf(to,w)：届け先の駅と時刻のはばから、どの便に積むか（センターの時刻表とトラックの分だけで決める。その日の結果は読まない） */
function dayHauls(cfg,S,day,we,binOf){const H=(cfg&&cfg.haul)||{},z=H.wobble??0.15,out={};let n=0;if(!S)return null;
  for(const c of S.deals||[]){if(c.kind!=='haul'||day<c.from||day>c.to)continue;const o=c.of;if(o.dow==='wd'&&we||o.dow==='we'&&!we)continue;
    const r=rngOf('dhaul',S.seed,day,c.id),u=r(),q=Math.max(0.5,Math.round(o.carts*(1+(u*2-1)*z)*2)/2),cg=(H.cargo||[]).find(x=>x.id===o.cargo)||{};
    const x={k:'haul',c:q,to:o.to,w:o.win.slice(),b:binOf?binOf(o.to,o.win):null,n:o.name,f:o.fare||0,s:/^川辺の配送センター/.test(o.from||'')?Math.round(q*(H.sort||0)):0};
    if(cg.own===false)x.o=1;out[c.id]=x;n++;}
  return n?out:null;}
/* どの便に積むか：ccfg＝data/center.json（flow.runs・slip.trucks）、hd＝積みおろしの分。自社の店のあとに寄る目安（出発＋駅までの分＋積みおろし2回）が、はばの終わりまでに着く便のうちいちばん遅いもの。なければ最初の便 */
function binFor(ccfg,hd,to,w){const R=((ccfg&&ccfg.flow)||{}).runs||[],T=((ccfg&&ccfg.slip)||{}).trucks||[],tr=T.find(t=>(t.st||[]).includes(to));if(!R.length)return null;const m=tr&&tr.min?tr.min[to]||0:0;
  const est=R.map(r=>({bin:r.bin,e:(r.depart>=1440?r.depart-1440:r.depart)+m+(hd||15)*2}));const ok=est.filter(x=>x.e<=w[1]).sort((a,b)=>b.e-a.e);return (ok[0]||est.slice().sort((a,b)=>a.e-b.e)[0]).bin;}
/* 配送会社の1日の計算（HaisoCore.dayPlan）に足す届け先：dh＝その日の d.haul。自社で運べない荷物（o）は足さない。
   販売の「店まで届ける」（k:'sell'）は工場の品（f＝個数）、配送の契約は荷主の荷物（c＝かご車 × センターの品のかご車1台の数） */
function haulStops(dh,perCart){const pc=perCart||{factory:300,center:150},out=[];let i=0;
  for(const id in dh||{}){const x=dh[id];i++;if(x.o||!x.b)continue;out.push({key:x.to+'-d'+i,ext:true,after:true,deal:id,name:x.n,fare:x.f||0,runs:[{bin:x.b,f:x.k==='sell'?(x.p||0):0,c:x.k==='sell'?0:Math.round((x.c||0)*(pc.center||150))}]});}
  return out;}
/* その日の結果（便の計算から）：契約ごとに {arr:着いた時刻, late:はばの終わりからの遅れ（分）, c:かご車, help:応援便がいった} */
function haulResults(dh,plan){const out={};if(!dh||!plan)return out;
  for(const id in dh){const x=dh[id];if(x.o){out[id]={arr:null,late:0,c:x.c,other:1};continue;}let st=null,run=null;for(const r of plan.runs||[]){if(r.leg!=='cs')continue;const s=(r.stops||[]).find(v=>v.deal===id);if(s){st=s;run=r;break;}}
    if(!st){out[id]={arr:null,late:0,c:0,miss:1};continue;}const help=(plan.runs||[]).some(r=>r.leg==='cs-extra'&&r.truck===run.truck&&r.bin===run.bin&&r.payer==='haiso');
    out[id]={arr:st.arrive,late:Math.max(0,Math.round(st.arrive-x.w[1])),c:x.k==='sell'?+(st.carts||0):x.c,help:help?1:0};}
  return out;}
/* 配送の契約に、その日の結果を足す（同じ日は2回足さない）。c.got＝{n:日数, q:頼まれたかご車, s:運んだかご車, y:運賃, lt:遅れた日, lm:いちばんの遅れ, last, ld:[日,着いた時刻,遅れ]} */
function recordHaul(S,day,id,x,res){const c=(S.deals||[]).find(v=>v.id===id);if(!c||c.kind!=='haul')return false;const g=c.got||(c.got={n:0,q:0,s:0,y:0,lt:0,lm:0,last:0});if(day<=g.last)return false;
  g.n++;g.q=+(g.q+x.c).toFixed(1);g.s=+(g.s+(res&&!res.miss?x.c:0)).toFixed(1);g.y+=x.f||0;if(res&&res.late>0){g.lt=(g.lt||0)+1;g.lm=Math.max(g.lm||0,res.late);}g.last=day;g.ld=[day,res?res.arr:null,res?res.late:0];return true;}
/* 自社で運ぶ「店まで届ける」の運賃（みなと川運輸の運賃表：1か所＋かご車。グループの中のお金）。H＝data/haiso.json */
function ownDeliverFare(H,pcs){const f=(H&&H.fare)||{},pc=((H&&H.perCart)||{}).factory||300;return pcs>0?Math.round((f.perStop||0)+(f.perCart||0)*pcs/pc):0;}

const api={dayHauls,binFor,haulStops,haulResults,recordHaul,ownDeliverFare,dayOrders,dealMoney,record,hashS,rngOf,catalog,offersOn,newState,valid,inbox,decide,snap,stateOf,contracts,prune,qtyOf,committed,sellOutlook,sellMoney,haulOutlook,LN};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
root.DealsCore=api;
})(typeof globalThis!=='undefined'?globalThis:this);
