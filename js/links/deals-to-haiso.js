/* 橋：取引の相談窓口 → 配送会社（data/links.json の id "deals-to-haiso"・2026-11-12・取引の相談窓口 第3回。docs/deals-plan.md）
   ・引き受けた配送の契約の、その運行日の荷物（かご車・届け先・時刻のはば・積む便）を、dia-orders のその日に haul:{契約id:{...}} として書く（put）。
     販売の契約の「店まで届ける」も、納品書で届けた数が決まったあとに同じ欄へ足す（sell）。工場の費用は港浜急送ではなく、みなと川運輸の運賃（グループの中）になる。
   ・配送会社の1日の計算（HaisoCore.dayPlan）には、外の届け先（ext・after）として足す（stops）。自社の店をぜんぶ回ったあとに寄るので、自社の店に着く時刻は変わらない。
     かご車が足りなければ港浜急送の応援便（契約の荷物の分は配送会社が払う）。冷凍など自社で運べない荷物は、港浜急送に頼む（費用は配送会社）。
   ・時刻の順：運行日の始めに「2店の注文 → 契約の注文 → 配送の契約の荷物 → 納品書（→ 店まで届ける数）」。画面の確定時刻は前の日 18:00。
     数は保存の種と運行日と契約だけで決まり、同じ日の中で配送の結果を読まない。日ごとの結果（着いた時刻・遅れ）は、その日を締めたあとに契約へ足す（close）。
   ・強さ0／未接続なら、dia-orders に haul を書かない＝配送会社もお金も前と同じ。DOM も localStorage も使わない（node でも動く）。 */
(function(root){
'use strict';
const ID='deals-to-haiso';
function linkOf(L){return L&&(L.links||[]).find(x=>x.id===ID)||null;}
function on(L){const lk=linkOf(L);return !!(lk&&lk.state!=='none'&&lk.state!=='retired'&&Number(lk.strength)>0);}
const binFn=(DC,ccfg,H)=>(to,w)=>DC.binFor(ccfg,(H&&H.handleMin)||15,to,w);
/* 運行日の始め（契約の注文のあと・納品書の前）：配送の契約の荷物を書く。返すもの：書いた haul（なければ null） */
function put(DC,cfg,S,log,day,cond,ccfg,H){const d=log&&log.days.find(x=>x.day===day);if(!d||!DC||!S)return null;delete d.haul;
  const o=DC.dayHauls(cfg,S,day,!!(cond&&cond.day&&cond.day!=='wd'),binFn(DC,ccfg,H));if(!o)return null;d.haul=o;return o;}
/* 納品書のあと（DealsToFactory.settle の前）：販売の「店まで届ける」契約の届けた数を haul に足し、slip.deals に自社の便の印（own）と運賃（hf）を付ける */
function sell(DC,cfg,S,d,slip,ccfg,H){if(!d||!slip||!slip.deals||!S)return false;let n=0;const win=((cfg&&cfg.sell)||{}).deliverWin||60;
  for(const id in slip.deals){const c=(S.deals||[]).find(x=>x.id===id);if(!c||c.of.hand!=='deliver')continue;const x=slip.deals[id];let p=0;for(const pid in x.it||{})p+=(x.it[pid][1]||0);
    if(!(p>0))continue;const w=[c.of.handT-win,c.of.handT],hf=DC.ownDeliverFare(H,p);x.own=1;x.hf=hf;
    (d.haul||(d.haul={}))[id]={k:'sell',p,to:c.of.st,w,b:DC.binFor(ccfg,(H&&H.handleMin)||15,c.of.st,w),n:c.of.name,f:hf};n++;}
  return n>0;}
/* 配送会社の1日の計算に足す届け先（HaisoCore.dayPlan の stores に足す） */
function stops(DC,H,d){return d&&d.haul?DC.haulStops(d.haul,H&&H.perCart):[];}
/* その日を締めたあと：便の計算（plan＝HaisoCore.dayPlan）から、配送の契約ごとの結果を積み上げる。返すもの：dia-deals を書きかえたか */
function close(DC,S,day,d,plan){if(!d||!d.haul||!S)return false;const R=DC.haulResults(d.haul,plan);let ch=false;
  for(const id in d.haul){const x=d.haul[id];if(x.k!=='haul')continue;if(DC.recordHaul(S,day,id,x,R[id]))ch=true;}return ch;}
root.DealsToHaiso={ID,on,put,sell,stops,close};
if(typeof module!=='undefined'&&module.exports)module.exports=root.DealsToHaiso;
})(typeof globalThis!=='undefined'?globalThis:this);
