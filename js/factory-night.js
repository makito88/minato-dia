/* =====================================================================
   工場の夜とセンターの発注をつなぐ（発注と配送 第2回）。DOM も localStorage も使わない（node でも読める）
   ・センターの発注（dia-orders の days[].factory：その運行日の全店の合計、売店の商品IDごと）を、
     工場のライン（米・パン・サンド・ドーナッツ、2026-11-10 からお弁当も）の注文に「外から」足す（cfg.center）。
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
  {id:'donut',name:'ドーナッツ',core:'DonutCore',key:'dia-factory-donut',list:D=>D.donut.products,rows:S=>S.prods,unit:'個'},
  // 5本目：お弁当（港駅の売店をつくる回の5回目・2026-11-10）。BentoCore を読みこんでいないページでは、お弁当は工場の品にしない（opt）
  {id:'bento',name:'お弁当',core:'BentoCore',key:'dia-factory-bento',list:D=>D.bento.products,rows:S=>S.prods,unit:'個',opt:true}];
/* 売店の商品ID → {line, id}（工場で作る品だけ） */
function kioskMap(D){const m={};for(const L of LINES){if(L.opt&&!root[L.core])continue;let list;try{list=L.list(D);}catch(e){continue;}for(const p of list||[])if(p.kiosk)m[p.kiosk]={line:L.id,id:p.id,name:p.name};}return m;}
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

/* 品ごとに作った数＝出荷＋余り＋遅れ＋だめになった数（原材料の使う量に使う。js/material-core.js） */
function madeOf(rows){const o={};for(const r of rows||[]){const n=(r.shipped||0)+(r.surplus||0)+(r.late||0)+(r.bad||0);if(n>0)o[r.id]=Math.round(n);}return o;}
/* その夜をラインごとに回す（お弁当は頼まれた夜だけ）。o={day,no,items,season}。D は（取引先などを入れた）写し。返すもの：ラインごとと品ごとの結果 */
function runNight(D,cfgs,o){const sp=splitItems(D,o.items),m=kioskMap(D),seed=seedOf(o.day),season=seasonOf(o.season);
  const lines={},rows={},dl=o.deal?splitItems(D,o.deal).made:{};   // 契約の注文（取引の相談窓口 第2回・橋 deals-to-factory）。なければ前と同じ
  for(const L of LINES){const C=root[L.core];if(!C)continue;const mine={};for(const pid in sp.made)if(m[pid].line===L.id)mine[pid]=sp.made[pid];
    const dm={};for(const pid in dl)if(m[pid].line===L.id)dm[pid]=dl[pid];const hasD=Object.keys(dm).length>0,both=Object.assign({},mine);for(const pid in dm)both[pid]=(both[pid]||0)+dm[pid];
    if(L.opt&&!Object.keys(both).length)continue;   /* お弁当：センターからも契約からも頼まれていない夜は、納品書に載せない（緑ヶ丘の店だけの記録は前と同じ） */
    const cfg=Object.assign({},cfgs&&cfgs[L.id]||{},{seed,season,center:both,centerNo:hasD?(o.no||'発注')+'＋取引先・契約':(o.no||null)});
    const S=C.simulate(D,cfg).summary;lines[L.id]={order:S.order,shipped:S.shipped,short:S.short,lastDone:S.lastDone!=null?S.lastDone:S.lastPack!=null?S.lastPack:null};
    const byId={};for(const r of L.rows(S)||[])byId[r.id]=r;
    lines[L.id].mk=madeOf(L.rows(S));   // 原材料（第5回）：品ごとに作った数。米は炊いた釜の数とはじいた数も。計算は変えず、結果を写すだけ
    if(L.id==='rice'){lines.rice.pots=S.batches|0;lines.rice.rej=(S.rej&&S.rej.all)|0;}if(L.id==='sand')lines.sand.own=(cfg.bread||(D.sand&&D.sand.defaults||{}).bread)==='own'?1:0;
    for(const pid in both){const r=byId[m[pid].id];if(!r)continue;rows[pid]={line:L.id,order:r.order,shipped:r.shipped,late:Math.max(0,Math.min((r.order||0)-(r.shipped||0),r.late||0)),c:mine[pid]||0};if(dm[pid])rows[pid].k=dm[pid];}}   // c：自社の店の分・k：契約の分   // late：締め切りのあとにできた数（足りない分まで）
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
/* 工場が遅れたとき（決め方 D・data/center.json の slip.late）：締め切りのあとにできた品（rows.late）が売店の分に要るとき、
   最後の品ができた時刻（そのラインの lastDone）までの遅れが waitMax 分までなら「待つ」（wait 分だけトラックと朝の便が遅れ、全部のせる）、
   それより長ければ「追いかけ便」（できてから積んでセンターへ。そのあとに出る最初の便にのせる）。返すもの：{mode:'none'|'wait'|'chase', wait, extra:{pid:数}, at, bin} */
function lateRule(D,ccfg,night){const LR=(ccfg&&ccfg.slip&&ccfg.slip.late)||null,extra={};let endT=null;
  for(const pid in night.rows){const r=night.rows[pid],e=Math.min(r.c,(r.shipped||0)+(r.late||0))-centerShip(r);if(e>0){extra[pid]=e;const ld=(night.lines[r.line]||{}).lastDone;if(ld!=null)endT=Math.max(endT??ld,ld);}}
  if(!LR||!Object.keys(extra).length||endT==null)return {mode:'none',wait:0,extra:{}};
  const wait=Math.max(0,Math.ceil(endT-D.deadline));if(wait<=LR.waitMax)return {mode:'wait',wait,extra};
  const at=endT+LR.load+LR.drive,ready=at+LR.sort,R=(ccfg.flow&&ccfg.flow.runs)||[];
  const run=R.map(x=>({bin:x.bin,dep:x.depart>=1440?x.depart:x.depart+1440})).find(x=>x.dep>=ready);
  return run?{mode:'chase',wait:0,extra,at,bin:run.bin,fee:LR.fee||0,end:endT}:{mode:'lost',wait:0,extra:{},end:endT};}
function slip(D,ccfg,day,night){const f=day.factory||{},items={},stores={},S=ccfg&&ccfg.slip||{};let sn=0,sq=0;const LT=lateRule(D,ccfg,night);
  for(const pid in night.rows){const r=night.rows[pid];if(!(r.c>0))continue;const e=LT.extra[pid]||0,s=centerShip(r)+(LT.mode==='wait'?e:0),ch=LT.mode==='chase'?e:0;items[pid]=ch?[r.c,s,ch]:[r.c,s];if(s+ch<r.c){sn++;sq+=r.c-s-ch;}
    const parts={};for(const k in day.orders||{}){const q=(day.orders[k].factory||{})[pid]||0;if(q>0)parts[k]=q;}
    const got=share(s,parts),rest={};for(const k in parts)rest[k]=Math.max(0,parts[k]-(got[k]||0));const gotC=ch?share(ch,rest):{};
    for(const k in parts){const st=stores[k]||(stores[k]={no:day.orders[k].no,items:{},short:{n:0,q:0},truck:truckOf(ccfg,k)});const c2=gotC[k]||0;
      st.items[pid]=c2?[parts[k],got[k]||0,c2]:[parts[k],got[k]||0];if((got[k]||0)+c2<parts[k]){st.short.n++;st.short.q+=parts[k]-(got[k]||0)-c2;}}}
  for(const k in day.orders||{})for(const pid in night.stock){const q=(day.orders[k].factory||{})[pid]||0;if(!q)continue;const st=stores[k]||(stores[k]={no:day.orders[k].no,items:{},short:{n:0,q:0},truck:truckOf(ccfg,k)});(st.stock||(st.stock={}))[pid]=q;}
  const deals=dealShip(day,night);
  const out={no:'N'+String(day.day).padStart(4,'0'),order:f.no||null,day:day.day,seed:night.seed,season:night.season,
    ready:D.deadline,at:D.ship&&D.ship.depart,bin:S.bin||null,items,short:{n:sn,q:sq},late:LT.mode==='none'?null:{mode:LT.mode,wait:LT.wait,end:LT.end??null,at:LT.at??null,bin:LT.bin??null,fee:LT.fee??0},stock:night.stock,lines:night.lines,stores};
  if(deals)out.deals=deals;return out;}
/* 契約の取引先の出荷（取引の相談窓口 第2回）：足りない夜の順番は 自社の売店 → 契約の取引先 → 今までの取引先。
   契約の分＝その品の出荷 − 自社の店の分（締め切りまでにできた数から。追いかけ便にはのせない）。契約が2つ以上なら注文の割合で割る。
   返すもの：{契約id:{it:{品:[注文,出荷]}}}（契約の注文がない日は null＝納品書は前と同じ形） */
function dealShip(day,night){const by=day.deal&&day.deal.by;if(!by)return null;const out={};
  for(const pid in night.rows){const r=night.rows[pid];if(!r.k)continue;const left=Math.max(0,Math.min(r.k,(r.shipped||0)-centerShip(r))),parts={};
    for(const id in by){const q=by[id][pid]||0;if(q>0)parts[id]=q;}const got=share(left,parts);
    for(const id in parts)((out[id]||(out[id]={it:{}})).it)[pid]=[parts[id],got[id]||0];}
  for(const id in by)if(!out[id])out[id]={it:Object.fromEntries(Object.entries(by[id]).map(([p,q])=>[p,[q,0]]))};   /* 工場で作っていない品の契約は届かない */
  return out;}

/* 工場の画面用：dia-orders の文字（getItem で読む）から、いちばん新しいセンターの発注を夜の条件に足す。
   画面の条件（cfg）は書きかえず、写しを返す。保存する条件には center を入れない */
function readLog(getItem){try{const o=JSON.parse(getItem('dia-orders')||'null');return o&&o.v===1&&Array.isArray(o.days)?o:null;}catch(e){return null;}}
function withCenter(cfg,log){const d=latest(log);if(!d)return cfg;const it=Object.assign({},d.factory.items),dI=d.deal&&d.deal.items;if(dI)for(const pid in dI)it[pid]=(it[pid]||0)+dI[pid];   // 契約の注文（第2回）も足す
  return Object.assign({},cfg,{center:it,centerNo:dI?d.factory.no+'＋取引先・契約':d.factory.no});}
function centerNote(D,log,lineId,unit){const d=latest(log);if(!d)return '';const m=kioskMap(D);let n=0;for(const pid in d.factory.items)if(m[pid]&&m[pid].line===lineId)n+=d.factory.items[pid];
  if(!n)return `センターの発注 ${d.factory.no}（第${d.day}運行日）には、このラインの品はありません。`;
  return `センターの発注 ${d.factory.no}（第${d.day}運行日）の${n}${unit||'個'}を、20:00の注文に足しています（ほかの店・取引先の分は夜の番号どおり）。${d.slip&&!d.slip.err?`納品書 ${d.slip.no} は夜の番号 ${d.slip.seed} の夜で作りました。`:''}`;}
root.FactoryNight={dealShip,madeOf,lateRule,readLog,withCenter,centerNote,LINES,kioskMap,seasonOf,seedOf,latest,splitItems,cfgsFrom,runNight,centerShip,share,truckOf,slip};
if(typeof module!=='undefined')module.exports=root.FactoryNight;
})(typeof window!=='undefined'?window:globalThis);
