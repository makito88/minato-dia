/* 橋：取引の相談窓口 → 工場（data/links.json の id "deals-to-factory"・2026-11-12・取引の相談窓口 第2回。docs/deals-plan.md）
   ・引き受けた販売の契約の、その運行日の注文の数（DealsCore.dayOrders：契約の数のまわりで決まった乱数で少しゆれる）を、
     dia-orders のその日に deal:{by:{契約id:{品:数}}, items:{品:合計}} として書く。工場の夜（FactoryNight.runNight）は、
     センターの発注とは別の行（取引先・契約）として注文に足す（人・材料・機械の時間は今の計算のまま増える）。
   ・時刻の順：運行日の始めに「2店の注文 → 契約の注文 → 納品書を1回」。画面の確定時刻は前の日 18:00（data/deals.json の fixAt）。
     数は保存の種と運行日と契約だけで決まり、同じ日の中でほかの島の数を読まない。
   ・足りない夜の順番：自社の売店 → 契約の取引先 → 今までの取引先（FactoryNight.dealShip）。
   ・その日の結果（届けた数とお金）は納品書の slip.deals に残し、契約の積み上げ（c.got）を dia-deals に足す（同じ日は2回足さない）。
   ・強さ0／未接続なら、dia-orders に deal を書かない＝工場も納品書も前と同じ。DOM も localStorage も使わない（node でも動く）。 */
(function(root){
'use strict';
const ID='deals-to-factory';
function linkOf(L){return L&&(L.links||[]).find(x=>x.id===ID)||null;}
function on(L){const lk=linkOf(L);return !!(lk&&lk.state!=='none'&&lk.state!=='retired'&&Number(lk.strength)>0);}
/* 運行日の始め：その日の契約の注文を dia-orders（log）の day に書く。cond.day が 'wd' 以外なら土日の数。返すもの：書いた deal（なければ null） */
function put(DC,cfg,S,log,day,cond){const d=log&&log.days.find(x=>x.day===day);if(!d||!DC||!S)return null;delete d.deal;
  const o=DC.dayOrders(cfg,S,day,!!(cond&&cond.day&&cond.day!=='wd'));if(!o)return null;d.deal=o;return o;}
/* 納品書ができたあと：契約ごとのお金を slip.deals に書き（y＝[売上,作る費用,届ける費用]・n＝相手の名前）、契約の積み上げに足す。返すもの：dia-deals を書きかえたか */
function settle(DC,cfg,S,day,slip){if(!slip||!slip.deals||!S)return false;let ch=false;
  for(const id in slip.deals){const c=(S.deals||[]).find(x=>x.id===id),x=slip.deals[id];if(!c)continue;const m=DC.dealMoney(cfg,c,x.it,x.own?x.hf:undefined);   /* own：自社の便で届ける（橋 deals-to-haiso・第3回） */x.y=[m.rev,m.cost,m.fee];x.n=c.of.name;if(DC.record(S,day,id,m,cfg))ch=true;}
  return ch;}
root.DealsToFactory={ID,on,put,settle};
if(typeof module!=='undefined'&&module.exports)module.exports=root.DealsToFactory;
})(typeof globalThis!=='undefined'?globalThis:this);
