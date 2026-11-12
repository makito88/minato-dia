/* 橋：取引の相談窓口 → お金（data/links.json の id "deals-to-money"・2026-11-12・取引の相談窓口 第2回）
   ・納品書の slip.deals（契約ごとの届けた数と y＝[売上,作る費用,届ける費用]。DealsToFactory.settle が書く）を、グループの収支（MoneyCore.groupLedger）の行にする：
     請求書「取引先 → 工場（品の代金）」と、工場から外へ「材料・人件費など（契約の分・仮の割合）」「港浜急送（店まで届ける・仮）」。
   ・読むのは、その日の納品書（運行日の始めに確定した数）だけ。強さ0／未接続なら行を出さない＝グループの収支は前と同じ。 */
(function(root){
'use strict';
const ID='deals-to-money';
function linkOf(L){return L&&(L.links||[]).find(x=>x.id===ID)||null;}
function on(L){const lk=linkOf(L);return !!(lk&&lk.state!=='none'&&lk.state!=='retired'&&Number(lk.strength)>0);}
/* 返すもの：[{name, rev, cost, fee}]（MoneyCore.groupLedger の o.deals） */
function rows(slip){const out=[];if(!slip||!slip.deals)return out;for(const id in slip.deals){const x=slip.deals[id];if(!x.y)continue;out.push({id,name:x.n||id,rev:x.y[0]||0,cost:x.y[1]||0,fee:x.y[2]||0});}return out;}
root.DealsToMoney={ID,on,rows};
if(typeof module!=='undefined'&&module.exports)module.exports=root.DealsToMoney;
})(typeof globalThis!=='undefined'?globalThis:this);
