/* 橋：港（客船の日） → 鉄道・売店（data/links.json の id "port-to-all"・港駅の売店をつくる回の8回目・2026-11-10）
   ・読むのは、運行日の始めに決まっている数字だけ：保存の種と、その運行日の暦の日付（港の島 js/port-core.js が船を決める）。
     鉄道・売店の結果は港に戻さない（一方向）。効き目は保存しない（決まり3）。
   ・渡し方は、季節のできごとと同じ形のできごと1件（item）にして、本体の SEAS.list に足す
     → 鉄道の倍率（railRules）・売店のジャンル（kioskFx）・沿線だより（letter）は、季節のできごとの道をそのまま通る。
     売店の客船の客は ctx.cruise（{pax, from, to}。js/kiosk-walk.js が使う）。
   ・strength 0・未接続・廃止のときは null（前と同じ）。
   返り値 plan()：{v:1, id, day:i, strength, call, item, cruise, values:[{name,unit,src,value,day,t}]} */
(function(root){
'use strict';
const ID='port-to-all';
function linkOf(L){return L&&(L.links||[]).find(x=>x.id===ID)||null;}
const hm=m=>Math.floor(m/60)+':'+String(m%60).padStart(2,'0');
/* L=links.json、P=港の設定（data/port.json）、seed=保存の種、i=運行日の番号（暦） */
function plan(L,P,seed,i){const lk=linkOf(L);if(!lk||lk.state==='none'||lk.state==='retired')return null;
  const s=Number(lk.strength)||0;if(!s||!P||!root.PortCore)return null;
  const c=root.PortCore.today(P,seed,i);if(!c)return null;
  const h0=Math.floor(c.arr/60),h1=Math.floor(c.dep/60);
  const rail=(P.rail||[]).map(r=>{const a=r.hk[0]<0?h1+r.hk[0]:h0+r.hk[0],b=r.hk[1]<0?h1+r.hk[1]:h0+r.hk[1];return {to:!!r.to,from:!!r.from,p:r.p,h:[a,Math.max(a+1,b)],k:r.k*s};});
  const kiosk={};for(const g in (P.kiosk||{}))kiosk[g]=1+(P.kiosk[g]-1)*s;
  const tx={ship:c.ship.name,from:c.ship.from,pax:c.pax.toLocaleString('ja-JP'),arr:hm(c.arr),dep:hm(c.dep)};
  const fill=t=>String(t).replace(/\{(ship|from|pax|arr|dep)\}/g,(_,k)=>tx[k]);
  const L0=P.letter||{},letter={who:L0.who,src:L0.src,title:(L0.title||[]).map(fill),body:(L0.body||[]).map(fill)};
  const item={id:'port_cruise',i,ymd:c.ymd,st:P.station,mag:c.mag,ev:{id:'port_cruise',name:'客船の日（'+c.ship.name+'）',rail,kiosk,letter}};
  const SH=P.shop||{},cruise={pax:Math.round(c.pax*Math.min(1,s)),from:c.arr+(SH.before||0),to:c.dep-(SH.after||0),ship:c.ship.name};
  const vu=n=>(lk.values||[]).find(x=>x.name===n)||{};
  const values=[{name:'ship',unit:vu('ship').unit||'',src:vu('ship').src||'game',value:{name:c.ship.name,pax:c.pax,arr:c.arr,dep:c.dep},day:i,t:null},
    {name:'railK',unit:vu('railK').unit||'',src:vu('railK').src||'assume',value:rail,day:i,t:null},
    {name:'cruise',unit:vu('cruise').unit||'',src:vu('cruise').src||'assume',value:{genre:kiosk,pax:cruise.pax},day:i,t:null}];
  return {v:1,id:ID,day:i,strength:s,call:c,item,cruise,values};}
const api={ID,plan};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
root.PortToAll=api;
})(typeof globalThis!=='undefined'?globalThis:this);
