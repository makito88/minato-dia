/* =====================================================================
   工場の夜とセンターの発注をつなぐ（発注と配送 第2回）。DOM も localStorage も使わない（node でも読める）
   ・センターの発注（dia-orders の days[].factory：その運行日の全店の合計、売店の商品IDごと）を、
     工場の4つのライン（米・パン・サンド・ドーナッツ）の注文に「外から」足す（cfg.center）。
     工場の注文＝ほかの店・取引先の分（今までの決まった乱数）＋センターの発注。発注がない夜は今までどおり。
   ・品の対応は、工場の設定（data/factory.json）の kiosk の欄＝売店の商品ID。売店にあって工場にない品は、センター在庫の品として扱う。
   ・運行日が変わるとき（売店の画面が締めたあと）に、その夜の結果から納品書を作る（slip）。
     不足は、ほかの店・取引先の分から先に減らす（売店を最優先・2026-11-07 第3回）。売店の分も足りないときは、店ごとに注文の割合で割る。
   ・売店には、納品書の出荷数までしか届かない（js/kiosk-core.js の ctx.supply。第3回から）。
   ===================================================================== */
(function(root){
'use strict';
const LINES=[
  {id:'rice',name:'おにぎり',core:'FactoryCore',key:'dia-factory',list:D=>D.packLine.fillings,rows:S=>S.fills,unit:'個'},
  {id:'bread',name:'パン',core:'BreadCore',key:'dia-factory-bread',list:D=>D.bread.products,rows:S=>S.prods,unit:'個'},
  {id:'sand',name:'サンド',core:'SandCore',key:'dia-factory-sand',list:D=>D.sand.products,rows:S=>S.prods,unit:'パック'},
  {id:'donut',name:'ドーナッツ',core:'DonutCore',key:'dia-factory-donut',list:D=>D.donut.products,rows:S=>S.prods,unit:'個'}];
/* 売店の商品ID → {line, id}（工場で作る品だけ） */
function kioskMap(D){const m={};for(const L of LINES){let list;try{list=L.list(D);}catch(e){continue;}for(const p of list||[])if(p.kiosk)m[p.kiosk]={line:L.id,id:p.id,name:p.name};}return m;}
/* 沿線暦の季節（spr/sum/aut/win）→ 工場の季節（winter/mid/summer） */
function seasonOf(s){return s==='sum'||s==='summer'?'summer':s==='win'||s==='winter'?'winter':'mid';}
/* 運行日ごとの夜の番号（同じ運行日なら同じ注文のゆらぎ） */
function seedOf(day){return ((Math.max(1,Math.floor(day)||1)-1)%9999)+1;}
/* いちばん新しい、工場への発注がある日 */
function latest(log){const ds=(log&&log.days||[]).filter(d=>d.factory&&Object.keys(d.factory.items||{}).length);return ds.at(-1)||null;}
/* 発注を「工場で作る品」と「工場にない品（センター在庫）」に分ける */
function splitItems(D,items){const m=kioskMap(D),made={},stock={};for(const pid in items||{}){const q=items[pid]|0;if(q<=0)continue;(m[pid]?made:stock)[pid]=q;}return {made,stock};}
/* 保存してある工場の条件（getItem：localStorage.getItem など）。米の釜は見込みに足りるだけ（工場の収支の見積もりと同じ） */
function cfgsFrom(getItem){const out={};for(const L of LINES){let c={};try{c=(JSON.parse(getItem(L.key)||'null')||{}).cfg||{};}catch(e){}out[L.id]=Object.assign({},c);}return out;}

/* その夜を4つのラインで回す。o={day,no,items,season}。D は（取引先などを入れた）写し。返すもの：ラインごとと品ごとの結果 */
function runNight(D,cfgs,o){const sp=splitItems(D,o.items),m=kioskMap(D),seed=seedOf(o.day),season=seasonOf(o.season);
  const lines={},rows={};
  for(const L of LINES){const C=root[L.core];if(!C)continue;const mine={};for(const pid in sp.made)if(m[pid].line===L.id)mine[pid]=sp.made[pid];
    const cfg=Object.assign({},cfgs&&cfgs[L.id]||{},{seed,season,center:mine,centerNo:o.no||null});
    const S=C.simulate(D,cfg).summary;lines[L.id]={order:S.order,shipped:S.shipped,short:S.short};
    const byId={};for(const r of L.rows(S)||[])byId[r.id]=r;
    for(const pid in mine){const r=byId[m[pid].id];if(!r)continue;rows[pid]={line:L.id,order:r.order,shipped:r.shipped,c:mine[pid]};}}
  return {seed,season,lines,rows,stock:sp.stock};}

/* センターの分（自社の売店）の出荷：売店を最優先（docs/factory-discussion.md の方針）。工場が足りないときは、ほかの店・取引先の分から減らす。
   売店の分が足りなくなるのは、出荷の合計がセンターの発注より少ないときだけ */
function centerShip(r){return Math.max(0,Math.min(r.c,r.shipped));}
/* 店ごとに割る（端数は大きい順） */
function share(total,parts){const keys=Object.keys(parts),sum=keys.reduce((a,k)=>a+parts[k],0),out={};if(!sum)return out;let left=total;
  const fr=keys.map(k=>{const x=total*parts[k]/sum;out[k]=Math.floor(x);left-=out[k];return [k,x-out[k]];}).sort((a,b)=>b[1]-a[1]);
  for(let i=0;i<fr.length&&left>0;i++,left--)out[fr[i][0]]++;return out;}
/* 便：店の駅からトラックを決める（data/center.json の slip.trucks） */
function truckOf(ccfg,store){const st=String(store).split('-')[0],T=(ccfg&&ccfg.slip&&ccfg.slip.trucks)||[];const t=T.find(x=>(x.st||[]).includes(st));return t?t.id:null;}

/* 納品書：day＝dia-orders の1日（orders・factory）、night＝runNight の結果。
   {no, order, day, seed, ready, at, items:{pid:[注文,出荷]}, short:{n,q}, stock:{pid:数}, stores:{店:{no,items,short,truck}}} */
function slip(D,ccfg,day,night){const f=day.factory||{},items={},stores={},S=ccfg&&ccfg.slip||{};let sn=0,sq=0;
  for(const pid in night.rows){const r=night.rows[pid],s=centerShip(r);items[pid]=[r.c,s];if(s<r.c){sn++;sq+=r.c-s;}
    const parts={};for(const k in day.orders||{}){const q=(day.orders[k].factory||{})[pid]||0;if(q>0)parts[k]=q;}
    const got=share(s,parts);for(const k in parts){const st=stores[k]||(stores[k]={no:day.orders[k].no,items:{},short:{n:0,q:0},truck:truckOf(ccfg,k)});
      st.items[pid]=[parts[k],got[k]||0];if((got[k]||0)<parts[k]){st.short.n++;st.short.q+=parts[k]-(got[k]||0);}}}
  for(const k in day.orders||{})for(const pid in night.stock){const q=(day.orders[k].factory||{})[pid]||0;if(!q)continue;const st=stores[k]||(stores[k]={no:day.orders[k].no,items:{},short:{n:0,q:0},truck:truckOf(ccfg,k)});(st.stock||(st.stock={}))[pid]=q;}
  return {no:'N'+String(day.day).padStart(4,'0'),order:f.no||null,day:day.day,seed:night.seed,season:night.season,
    ready:D.deadline,at:D.ship&&D.ship.depart,bin:S.bin||null,items,short:{n:sn,q:sq},stock:night.stock,lines:night.lines,stores};}

/* 工場の画面用：dia-orders の文字（getItem で読む）から、いちばん新しいセンターの発注を夜の条件に足す。
   画面の条件（cfg）は書きかえず、写しを返す。保存する条件には center を入れない */
function readLog(getItem){try{const o=JSON.parse(getItem('dia-orders')||'null');return o&&o.v===1&&Array.isArray(o.days)?o:null;}catch(e){return null;}}
function withCenter(cfg,log){const d=latest(log);if(!d)return cfg;return Object.assign({},cfg,{center:d.factory.items,centerNo:d.factory.no});}
function centerNote(D,log,lineId,unit){const d=latest(log);if(!d)return '';const m=kioskMap(D);let n=0;for(const pid in d.factory.items)if(m[pid]&&m[pid].line===lineId)n+=d.factory.items[pid];
  if(!n)return `センターの発注 ${d.factory.no}（第${d.day}運行日）には、このラインの品はありません。`;
  return `センターの発注 ${d.factory.no}（第${d.day}運行日）の${n}${unit||'個'}を、20:00の注文に足しています（ほかの店・取引先の分は夜の番号どおり）。${d.slip&&!d.slip.err?`納品書 ${d.slip.no} は夜の番号 ${d.slip.seed} の夜で作りました。`:''}`;}
root.FactoryNight={readLog,withCenter,centerNote,LINES,kioskMap,seasonOf,seedOf,latest,splitItems,cfgsFrom,runNight,centerShip,share,truckOf,slip};
if(typeof module!=='undefined')module.exports=root.FactoryNight;
})(typeof window!=='undefined'?window:globalThis);
