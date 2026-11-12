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
/* センターの人と建物（A）：pieces＝その日にセンターで扱う個数。返すもの：{ops:運営の人, facility:建物, sort:[{label,h,yen}], sortH, total} */
function centerCost(M,pieces,n){const O=M.centerOps;if(!O)return null;const soc=1+(O.social||0);n=n>1?n:1;   // n：店の数（2026-11-10。決まった費用と仕分けの最低の時間を店の数で分ける。1なら前と同じ）
  const ops=R(O.staff.reduce((t,x)=>t+x.n*x.h*x.wage,0)*soc/n),S=O.sort,sort=S.shifts.map(sh=>{const h=Math.max((sh.minH||0)/n,pieces*(sh.share||0)/(S.perHour||450));return {label:sh.label,h:+h.toFixed(1),yen:R(h*S.wage*(1+(sh.night?(O.nightPremium||0):0))*soc)};});
  return {ops,facility:R((O.facility||0)/n),sort,sortH:+sort.reduce((t,x)=>t+x.h,0).toFixed(1),total:ops+(O.facility||0)+sort.reduce((t,x)=>t+x.yen,0)};}
/* o＝{day, sales, pl:売店の収支, delivered:{品:数}（その日に店に届いた品。臨時便は入れない）, route:pid→'factory'|'center'|'direct'|'local', cost:pid→仕入れ値,
       haiso:{runs}（HaisoCore.dayPlan の結果。なければ配送は0）, take, live:きょうの見込みなら true}
   返すもの：{v:1, day, live, inv:[{from,to,what,yen}], co:{会社:{in,out,net}}, ext:{in,out}} */
function dayLedger(M,o){const inv=[],add=(from,to,what,yen)=>{yen=R(yen||0);if(yen>0)inv.push({from,to,what,yen});};
  const take=o.take!=null?o.take:(M.take??0.15);let bF=0,bC=0,bD=0,bL=0;
  for(const pid in o.delivered||{}){const v=(o.delivered[pid]||0)*(o.cost(pid)||0),r=o.route(pid);if(r==='factory')bF+=v;else if(r==='center')bC+=v;else if(r==='local')bL+=v;else bD+=v;}
  const pl=o.pl||{};
  add('ext','kiosk','お客さんの買い物',o.sales||0);
  add('kiosk','center','仕入れ（工場の品）',bF);add('kiosk','center','仕入れ（センターの品）',bC);
  add('kiosk','ext','新聞・雑誌・たばこ（卸へ）',bD);
  add('kiosk','ext','地元のお店へ（ワッフル・へしこ）',bL);   // route が 'local' の品（橋 local-to-kiosk・2026-11-10）。0のときは行が出ない（前と同じ）
  add('kiosk','ext','店員の給料・交通費・保険',(pl.staff||0)+(pl.commute||0)+(pl.social||0)+(pl.recruit||0));
  add('kiosk','ext','家賃・電気・手数料など',(pl.rent||0)+(pl.util||0)+(pl.fee||0)+(pl.guard||0)+(pl.express||0));
  add('center','factory','工場の品の代金',bF*(1-take));
  add('center','ext','問屋の品の代金（店へ出した分）',bC*(M.wsRate??0.75));
  // A：センター全体の決まった費用を、店の数で分ける（o.nStores。なければ1店＝前と同じ。2026-11-10 に港駅の店のために入れた）。B：売店→センターのセンターフィー（品が届いた便ごと）
  {let pcs=0;for(const pid in o.delivered||{}){const r=o.route(pid);if(r==='factory'||r==='center')pcs+=o.delivered[pid]||0;}const CCo=centerCost(M,pcs,o.nStores);
    if(CCo){add('center','ext','センターの運営の人（センター長・事務・検品）',CCo.ops);add('center','ext','倉庫の家賃・電気・機械',CCo.facility);for(const x of CCo.sort)add('center','ext',`仕分けの人（${x.label}・${x.h}時間）`,x.yen);}
    else add('center','ext','倉庫と仕分け（センター全体の決まった費用）',(M.centerFixedDay||M.centerFixed||0)/(o.nStores>1?o.nStores:1));}
  add('kiosk','center','センターフィー（配送料・'+(o.runs||0)+'便）',((M.centerFee&&M.centerFee.perRun)||0)*(o.runs||0));
  add('factory','ext','材料・人件費・電気など',bF*(1-take)*(M.factoryCost??0.7));
  const runs=(o.haiso&&o.haiso.runs)||[];let fC=0,fF=0,xC=0,xF=0,hc=0;
  for(const r of runs){if(r.company==='haiso'){if(r.payer==='factory')fF+=r.fare||0;else fC+=r.fare||0;hc+=r.cost||0;}else{if(r.payer==='factory')xF+=r.fee||0;else xC+=r.fee||0;}}
  if(o.haiso&&o.haiso.sum)hc+=(o.haiso.sum.truckDay||0)+(o.haiso.sum.labor||0);   // 運転手の給料（シフト）も入れる（2026-11-12。前は入っていなかった）
  add('center','haiso','運賃（センター→店）',fC);add('factory','haiso','運賃（工場→センター）',fF);
  add('center','ext','他社の応援便',xC);add('factory','ext','他社の追いかけ便',xF);
  add('haiso','ext','燃料・運転手・トラック',hc);
  const co={};for(const k of ['kiosk','center','factory','haiso'])co[k]={in:0,out:0,net:0};const ext={in:0,out:0};
  for(const x of inv){if(co[x.to])co[x.to].in+=x.yen;else ext.out+=x.yen;if(co[x.from])co[x.from].out+=x.yen;else ext.in+=x.yen;}
  for(const k in co)co[k].net=co[k].in-co[k].out;
  return {v:1,day:o.day,live:!!o.live,inv,co,ext};}
/* グループ全体の1日（2026-11-12・第3段）：店がいくつあっても、センター・工場・配送会社を1回だけ数える。
   o＝{day, live, take, haiso:{runs,sum}（その日の2店ぶんの便。1回だけ）, stores:[{id, name, sales, pl, delivered:{品:数}（いつもの便で届いた品）, sd:{品:数}（できたての便。工場から直接）, route, cost, runs:便の数}]}
   ・会社の間の請求書（店→センター・センター→工場・→配送会社）は、払った側と受け取った側で同じ額。グループのもうけ＝外から入ったお金−外へ出たお金（会社の間のお金は打ち消し合う）。
   ・センターの決まった費用は、ぜんぶ1回（店の数で割らない）。工場の費用は、自社の店の分だけ（ほかの取引先の分は入れない＝未接続）。
   返すもの：{v:1, day, live, inv, co:{会社:{in,out,net,inExt,inGrp,outExt,outGrp}}, ext:{in,out,net}, grp:会社の間で動いたお金} */
function groupLedger(M,o){const inv=[],add=(from,to,what,yen)=>{yen=R(yen||0);if(yen>0)inv.push({from,to,what,yen});};
  const take=o.take!=null?o.take:(M.take??0.15),ids=[];let F=0,Cc=0,SF=0,pcs=0;
  for(const s of o.stores||[]){const k='store:'+s.id;ids.push(k);let bF=0,bC=0,bD=0,bL=0,bS=0;
    for(const pid in s.delivered||{}){const q=s.delivered[pid]||0,v=q*(s.cost(pid)||0),r=s.route(pid);if(r==='factory'){bF+=v;pcs+=q;}else if(r==='center'){bC+=v;pcs+=q;}else if(r==='local')bL+=v;else bD+=v;}
    for(const pid in s.sd||{})bS+=(s.sd[pid]||0)*(s.cost(pid)||0);
    const pl=s.pl||{};
    add('ext',k,'お客さんの買い物',s.sales||0);
    add(k,'center','仕入れ（工場の品）',bF);add(k,'center','仕入れ（センターの品）',bC);
    add(k,'factory','できたての便の品（工場から直接）',bS);add(k,'haiso','できたての便の運賃',pl.sameday||0);
    add(k,'ext','新聞・雑誌・たばこ（卸へ）',bD);add(k,'ext','地元のお店へ',bL);
    add(k,'ext','店員の給料・交通費・保険',(pl.staff||0)+(pl.commute||0)+(pl.social||0)+(pl.recruit||0));
    add(k,'ext','家賃・電気・手数料など',(pl.rent||0)+(pl.util||0)+(pl.fee||0)+(pl.guard||0)+(pl.express||0));
    add(k,'center','センターフィー（配送料・'+(s.runs||0)+'便）',((M.centerFee&&M.centerFee.perRun)||0)*(s.runs||0));
    F+=bF;Cc+=bC;SF+=bS;}
  add('center','factory','工場の品の代金',F*(1-take));
  add('center','ext','問屋の品の代金（店へ出した分）',Cc*(M.wsRate??0.75));
  for(const x of o.hauls||[])pcs+=x.pcs||0;   /* 配送の契約でセンターを通る荷物も仕分けの人の時間に入れる（第3回）。なければ前と同じ */
  const CCo=centerCost(M,pcs,1);
  if(CCo){add('center','ext','センターの運営の人（センター長・事務・検品）',CCo.ops);add('center','ext','倉庫の家賃・電気・機械',CCo.facility);for(const x of CCo.sort)add('center','ext',`仕分けの人（${x.label}・${x.h}時間）`,x.yen);}
  else add('center','ext','倉庫と仕分け（センター全体の決まった費用）',M.centerFixedDay||M.centerFixed||0);
  add('factory','ext','材料・人件費・電気など（自社の店の分）',(F*(1-take)+SF)*(M.factoryCost??0.7));
  /* 取引の相談窓口の販売の契約（第2回・橋 deals-to-money）：取引先 → 工場の品の代金、工場から外への費用（仮の割合）。o.deals がなければ前と同じ */
  for(const x of o.deals||[]){add('ext','factory',`取引先・契約の品の代金（${x.name}）`,x.rev);add('factory','ext',`材料・人件費など（契約の分・${x.name}）`,x.cost);add('factory','ext',`港浜急送（${x.name}へ届ける・仮）`,x.fee);add('factory','haiso',`運賃（${x.name}へ届ける）`,x.hf);}
  /* 配送の契約（第3回・橋 deals-to-money の hauls）：荷主 → 配送会社の運賃、荷主 → センターの仕分け料、自社で運べない荷物の港浜急送。o.hauls がなければ前と同じ */
  for(const x of o.hauls||[]){add('ext','haiso',`運賃（荷主・${x.name}）`,x.fare);add('ext','center',`仕分け料（荷主・${x.name}）`,x.sort);add('haiso','ext',`港浜急送（${x.name}・自社で運べない荷物）`,x.other);}
  /* 自分から動く営業の費用（第4回・橋 deals-to-money の sales）：問屋に相談する＝工場、店に声をかける＝センター。o.sales がなければ前と同じ */
  for(const x of o.sales||[])add(x.payer||'center','ext',`営業の費用（${x.name}）`,x.yen);
  const runs=(o.haiso&&o.haiso.runs)||[];let fC=0,fF=0,xC=0,xF=0,xH=0,hc=0;
  for(const r of runs){if(r.company==='haiso'){if(r.payer==='factory')fF+=r.fare||0;else fC+=r.fare||0;hc+=r.cost||0;}else{if(r.payer==='factory')xF+=r.fee||0;else if(r.payer==='haiso')xH+=r.fee||0;else xC+=r.fee||0;}}
  add('haiso','ext','他社の応援便（契約の荷物）',xH);
  if(o.haiso&&o.haiso.sum)hc+=(o.haiso.sum.truckDay||0)+(o.haiso.sum.labor||0);
  add('center','haiso','運賃（センター→店）',fC);add('factory','haiso','運賃（工場→センター）',fF);
  add('center','ext','他社の応援便',xC);add('factory','ext','他社の追いかけ便',xF);
  add('haiso','ext','燃料・運転手・トラック',hc);
  const co={};for(const k of [...ids,'center','factory','haiso'])co[k]={in:0,out:0,net:0,inExt:0,inGrp:0,outExt:0,outGrp:0};const ext={in:0,out:0,net:0};let grp=0;
  for(const x of inv){const fi=!!co[x.from],ti=!!co[x.to];if(fi&&ti)grp+=x.yen;
    if(ti){co[x.to].in+=x.yen;co[x.to][fi?'inGrp':'inExt']+=x.yen;}else ext.out+=x.yen;
    if(fi){co[x.from].out+=x.yen;co[x.from][ti?'outGrp':'outExt']+=x.yen;}else ext.in+=x.yen;}
  for(const k in co)co[k].net=co[k].in-co[k].out;ext.net=ext.in-ext.out;
  return {v:1,day:o.day,live:!!o.live,inv,co,ext,grp,names:Object.fromEntries((o.stores||[]).map(s=>['store:'+s.id,s.name]))};}
/* 店を増やしたら（試算・2026-11-09 にやり直し）：1店の1日（L1）を n 店ぶんにし、外の配達先を m 足す。
   配送会社は hzFor(n,m)（並べた便の計算。運転手はシフトで払う）。センターは「運営の人＋建物（決まった費用）＋仕分けの人（扱う個数で増える）」。
   外の配達先はセンターに配達の料金を払う（品物の代金は入れない）。返すもの：[{n, m, carts, pieces, haiso, center, centerCost, factory, kiosk1, group}] */
function project(M,L1,hzFor,ns,m){m=m||0;const k1=L1.co.kiosk,E=M.ext||{fee:{}};
  const sumI=f=>L1.inv.filter(f).reduce((t,x)=>t+x.yen,0);
  const cIn1=sumI(x=>x.from==='kiosk'&&x.to==='center'),cGoods1=sumI(x=>x.from==='center'&&(x.to==='factory'||x.what.startsWith('問屋')));
  const f1=L1.co.factory.net+sumI(x=>x.from==='factory'&&x.to!=='ext');
  return (ns||[1,2,4,6,8,10,12,16]).map(n=>{const hz=hzFor(n,m),S=hz.sum,cf=hz.runs.filter(r=>r.payer==='center').reduce((t,r)=>t+(r.fare||0)+(r.fee||0),0),ff=hz.runs.filter(r=>r.payer==='factory').reduce((t,r)=>t+(r.fare||0)+(r.fee||0),0);
    const pieces=hz.runs.filter(r=>r.leg==='cs').reduce((t,r)=>t+r.stops.reduce((u,x)=>u+(x.pcs||0),0),0),cc=centerCost(M,pieces)||{total:M.centerFixedDay||0,sortH:0};
    const extIn=m*((E.runs||1)*((E.fee.perRun||0)+(E.fee.perCart||0)*(E.carts||0)));
    const center=R((cIn1-cGoods1)*n+extIn-cf-cc.total),factory=R(f1*n-ff);
    return {n,m,carts:S.carts,pieces,haiso:{fare:S.fare,cost:S.cost,labor:S.labor,drivers:S.drivers,profit:S.profit,other:S.other},center,centerCost:{total:cc.total,sortH:cc.sortH},extIn:R(extIn),factory,kiosk1:R(k1.net),group:R(k1.net*n+center+factory+S.profit)};});}
/* いくつかの日を足す（7日の合計など） */
function sumDays(list){const co={},inv={};let n=0;for(const L of list){if(!L)continue;n++;for(const k in L.co){const c=co[k]||(co[k]={in:0,out:0,net:0});c.in+=L.co[k].in;c.out+=L.co[k].out;c.net+=L.co[k].net;}
  for(const x of L.inv){const key=x.from+'|'+x.to+'|'+x.what;(inv[key]||(inv[key]={from:x.from,to:x.to,what:x.what,yen:0})).yen+=x.yen;}}
  return {n,co,inv:Object.values(inv)};}
const api={dayLedger,groupLedger,sumDays,project,centerCost};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
root.MoneyCore=api;
})(typeof globalThis!=='undefined'?globalThis:this);
