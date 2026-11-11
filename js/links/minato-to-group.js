/* 橋：港駅の店 → グループの流れ（配送センター・工場・配送会社）（data/links.json の id "minato-to-group"・2026-11-12）
   ユーザーの頼み（2026-11-12）：「2店舗の注文をそろえてから、工場の生産・配送に時間の順に反映したい」。
   ・港駅の店の「通常の注文」（おまかせ発注 MinatoStore.omOrder の数）を、緑ヶ丘の店と同じ dia-orders の同じ日に足す。
     工場の注文（days[].factory）は全店の合計になり、工場の夜・納品書・センターのかご車・トラックの便に、2店ぶんがのる。
   ・時刻の順：運行日の始めに、①両方の店が前の日を締める（売上の記録をセンターへ）→ ②両方の店の注文がそろう → ③工場の納品書を1回だけ作る。
     片方の店がまだ前の日を締めていないとき（留守のあいだに日が飛んだときなど）は、その店はその日の流れにのせない（届く数に上限なし＝前と同じ）。
   ・できたての便（橋 factory-to-kiosk-sameday）の分は二重に作らない：その日の計画の want（昼前の便の分）を、夜の工場への注文から引く。
     店の計算では、昼前の便からもう一度引かない（ctx.sameday.noCut）。工場の朝の組が作れなかった分（釜の遅れの日）は、届かない（予定と実績のちがい）。
   ・保存はしない（決まり3）。dia-orders に残るのは、緑ヶ丘の店と同じ形の注文・記録・到着だけ。強さ0／未接続なら前と同じ（港駅の店は上限なし）。
   ・DOM も localStorage も使わない（node でも動く）。 */
(function(root){
'use strict';
const ID='minato-to-group';
function linkOf(L){return L&&(L.links||[]).find(x=>x.id===ID)||null;}
function on(L){const lk=linkOf(L);return !!(lk&&lk.state!=='none'&&lk.state!=='retired'&&Number(lk.strength)>0);}
/* 港駅の店の、その運行日の注文を dia-orders（log）に足す。
   c＝港駅の店の設定・S＝港駅の店の状態（S.order はその日の数に決まっていること）・why＝おまかせの見込み（CenterCore.plan の why）・sd＝できたての便の計画
   返すもの：店の key */
function putOrder(CC,c,ccfg,log,day,S,cond,why,sd,keep){
  const key=CC.storeKey(S),items={...(S.order||{})},recs=(S.om&&S.om.recs)||[];
  const fq={...(CC.factoryQty(c,ccfg,S,recs,day,items)||{})},want=(sd&&sd.want)||{},night={...items};
  for(const pid in want){if(night[pid]!=null)night[pid]=Math.max(0,night[pid]-want[pid]);if(fq[pid]!=null)fq[pid]=Math.max(0,fq[pid]-want[pid]);}
  CC.putOrder(c,ccfg,log,day,key,{mode:(S.om&&S.om.mode)||'self',aim:(S.om&&S.om.aim)||null,items:night,fq},keep);
  const d=log.days.find(x=>x.day===day);
  if(d){if(!d.cond&&cond)d.cond=cond;const o=d.orders[key];
    if(CC.runOrder)o.crun=CC.runOrder(c,ccfg,S,recs,day,cond,items,why||null);   // センターの品の便ごとの注文（緑ヶ丘の店と同じ決め方）
    if(Object.keys(want).length)o.sd={want:{...want}};}                        // 夜の工場から引いた、できたての便の分
  return key;}
root.MinatoToGroup={ID,on,putOrder};
if(typeof module!=='undefined')module.exports=root.MinatoToGroup;
})(typeof window!=='undefined'?window:globalThis);
