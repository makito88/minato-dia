/* =====================================================================
   お金の流れ（2026-11-09）：会社どうしの請求書と、会社ごとの1日の出入り
   ・品物が1回動くたびに請求書（だれが・だれに・いくら＝数×値段）。島の中の費用（人件費・燃料など）は「外へ」の請求書。
   ・会社：kiosk 売店・center センター・factory 工場・haiso 配送会社。ext＝グループの外（お客さん・問屋・他社・働く人・大家など）。
   ・つじつま：会社どうしの請求書は、払った側と受け取った側で同じ。会社の出入りの合計＝お客さんから入ったお金−外へ出たお金。
   ・DOM も localStorage も使わない。値段の決まりは data/money.json（仮）。
   ===================================================================== */
(function(root){
'use strict';
const R=Math.round;
/* o＝{day, sales, pl:売店の収支, delivered:{品:数}（その日に店に届いた品。臨時便は入れない）, route:pid→'factory'|'center'|'direct', cost:pid→仕入れ値,
       haiso:{runs}（HaisoCore.dayPlan の結果。なければ配送は0）, take, live:きょうの見込みなら true}
   返すもの：{v:1, day, live, inv:[{from,to,what,yen}], co:{会社:{in,out,net}}, ext:{in,out}} */
function dayLedger(M,o){const inv=[],add=(from,to,what,yen)=>{yen=R(yen||0);if(yen>0)inv.push({from,to,what,yen});};
  const take=o.take!=null?o.take:(M.take??0.15);let bF=0,bC=0,bD=0;
  for(const pid in o.delivered||{}){const v=(o.delivered[pid]||0)*(o.cost(pid)||0),r=o.route(pid);if(r==='factory')bF+=v;else if(r==='center')bC+=v;else bD+=v;}
  const pl=o.pl||{};
  add('ext','kiosk','お客さんの買い物',o.sales||0);
  add('kiosk','center','仕入れ（工場の品）',bF);add('kiosk','center','仕入れ（センターの品）',bC);
  add('kiosk','ext','新聞・雑誌・たばこ（卸へ）',bD);
  add('kiosk','ext','店員の給料・交通費・保険',(pl.staff||0)+(pl.commute||0)+(pl.social||0)+(pl.recruit||0));
  add('kiosk','ext','家賃・電気・手数料など',(pl.rent||0)+(pl.util||0)+(pl.fee||0)+(pl.guard||0)+(pl.express||0));
  add('center','factory','工場の品の代金',bF*(1-take));
  add('center','ext','問屋の品の代金（店へ出した分）',bC*(M.wsRate??0.75));
  // A：センター全体の決まった費用を、店の数で分ける（o.nStores。いまは1店）。B：売店→センターのセンターフィー（品が届いた便ごと）
  add('center','ext','倉庫と仕分け（センター全体の決まった費用'+((o.nStores||1)>1?'・'+(o.nStores)+'店で分けた分':'')+'）',M.centerFixedDay!=null?M.centerFixedDay/(o.nStores||1):(M.centerFixed||0));
  add('kiosk','center','センターフィー（配送料・'+(o.runs||0)+'便）',((M.centerFee&&M.centerFee.perRun)||0)*(o.runs||0));
  add('factory','ext','材料・人件費・電気など',bF*(1-take)*(M.factoryCost??0.7));
  const runs=(o.haiso&&o.haiso.runs)||[];let fC=0,fF=0,xC=0,xF=0,hc=0;
  for(const r of runs){if(r.company==='haiso'){if(r.payer==='factory')fF+=r.fare||0;else fC+=r.fare||0;hc+=r.cost||0;}else{if(r.payer==='factory')xF+=r.fee||0;else xC+=r.fee||0;}}
  if(o.haiso&&o.haiso.sum)hc+=o.haiso.sum.truckDay||0;
  add('center','haiso','運賃（センター→店）',fC);add('factory','haiso','運賃（工場→センター）',fF);
  add('center','ext','他社の応援便',xC);add('factory','ext','他社の追いかけ便',xF);
  add('haiso','ext','燃料・運転手・トラック',hc);
  const co={};for(const k of ['kiosk','center','factory','haiso'])co[k]={in:0,out:0,net:0};const ext={in:0,out:0};
  for(const x of inv){if(co[x.to])co[x.to].in+=x.yen;else ext.out+=x.yen;if(co[x.from])co[x.from].out+=x.yen;else ext.in+=x.yen;}
  for(const k in co)co[k].net=co[k].in-co[k].out;
  return {v:1,day:o.day,live:!!o.live,inv,co,ext};}
/* 店を増やしたら（試算）：1店の1日（L1＝nStores 1 で作ったもの）を n 店ぶんにし、配送会社は hzFor(n)（n 店を並べた便の計算）を使う。
   センターの決まった費用は n 店で分けるので、1店あたりの負担が下がる。返すもの：[{n, carts, haiso:{fare,cost,profit,other}, center, kiosk1, group}] */
function project(M,L1,hzFor,ns){const fx=M.centerFixedDay||0,c1=L1.co.center,k1=L1.co.kiosk;
  const cFare1=L1.inv.filter(x=>x.from==='center'&&(x.to==='haiso'||x.what==='他社の応援便')).reduce((t,x)=>t+x.yen,0),cFix1=L1.inv.filter(x=>x.from==='center'&&x.what.startsWith('倉庫と仕分け')).reduce((t,x)=>t+x.yen,0);
  const cBase=c1.net+cFare1+cFix1;   // 1店あたり：運賃と決まった費用を引く前のセンターのもうけ
  const f1=L1.co.factory.net+L1.inv.filter(x=>x.from==='factory'&&x.to!=='ext').reduce((t,x)=>t+x.yen,0);
  return (ns||[1,2,4,6,8,10,12,16]).map(n=>{const hz=hzFor(n),S=hz.sum,cf=hz.runs.filter(r=>r.payer==='center').reduce((t,r)=>t+(r.fare||0)+(r.fee||0),0),ff=hz.runs.filter(r=>r.payer==='factory').reduce((t,r)=>t+(r.fare||0)+(r.fee||0),0);
    const center=R(cBase*n-cf-fx),factory=R(f1*n-ff);return {n,carts:S.carts,stops:hz.runs.filter(r=>r.leg==='cs').reduce((t,r)=>t+r.stops.length,0),haiso:{fare:S.fare,cost:S.cost,profit:S.profit,other:S.other},center,factory,kiosk1:R(k1.net),group:R(k1.net*n+center+factory+S.profit)};});}
/* いくつかの日を足す（7日の合計など） */
function sumDays(list){const co={},inv={};let n=0;for(const L of list){if(!L)continue;n++;for(const k in L.co){const c=co[k]||(co[k]={in:0,out:0,net:0});c.in+=L.co[k].in;c.out+=L.co[k].out;c.net+=L.co[k].net;}
  for(const x of L.inv){const key=x.from+'|'+x.to+'|'+x.what;(inv[key]||(inv[key]={from:x.from,to:x.to,what:x.what,yen:0})).yen+=x.yen;}}
  return {n,co,inv:Object.values(inv)};}
const api={dayLedger,sumDays,project};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
root.MoneyCore=api;
})(typeof globalThis!=='undefined'?globalThis:this);
