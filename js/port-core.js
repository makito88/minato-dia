/* =====================================================================
   港（客船の日）の島（計算だけ。DOM は使わない。node でも動く）（港駅の売店をつくる回の8回目・2026-11-10）
   ・客船が港浜の港に寄る日を、季節のできごとと同じく「保存の種＋暦の年」だけで決める（js/season-core.js の yearPlan を使う）。
     同じ引き継ぎコードなら、どの端末でも同じ日に同じ船が寄る。前もって画面に出さない（寄った朝に沿線だよりで知らせる）。
   ・設定は data/port.json（すべて仮）。結果は保存しない。
   ・today(P, seed, i)：その運行日（番号 i）に寄る船。寄らない日は null。
     返り値 {i, ymd, ship:{id,name,from,foreign}, pax, arr, dep, mag}
   ===================================================================== */
(function(root){
'use strict';
const SC=()=>root.SeasonCore;
/* その運行日に寄る船（1日に1隻まで） */
function today(P,seed,i){const S=SC();if(!P||!S||!P.calls)return null;const y=S.partsOf(i).y;
  for(const c of P.calls){const ev={id:'port-'+c.id,when:c.when,times:c.times,chance:c.chance,scope:'line',mag:[1,1]};
    for(const yy of [y-1,y])for(const o of S.yearPlan({stations:{}},seed,ev,yy))if(o.i===i)return shipOf(P,seed,i,c.id);}
  return null;}
function shipOf(P,seed,i,cid){const S=SC(),r=S.rng(S.hash(seed,'port',i)),ws={};for(const s of P.ships)ws[s.id]=s.w||1;
  let tot=0;for(const k in ws)tot+=ws[k];let x=r()*tot,s=P.ships[P.ships.length-1];for(const c of P.ships){x-=ws[c.id];if(x<=0){s=c;break;}}
  const pax=Math.round(s.pax[0]+r()*(s.pax[1]-s.pax[0]));
  const mag=+Math.min(1.6,Math.max(0.4,pax/(P.paxRef||2000))).toFixed(3);
  return {i,ymd:S.ymdOf(i),call:cid,ship:{id:s.id,name:s.name,from:s.from,foreign:!!s.foreign},pax,arr:s.arr,dep:s.dep,mag};}
const api={today};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
root.PortCore=api;
})(typeof globalThis!=='undefined'?globalThis:this);
