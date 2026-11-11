/* =====================================================================
   港駅の売店（みなとスタンド 港駅改札前店）の設定を作る（港駅の売店をつくる回の2回目・2026-11-10）
   ・data/kiosk.json（緑ヶ丘の店の設定）を写して、data/minato-store.json の品・ジャンル・客層・歩く店の棚と場所を合わせる。
     kiosk.json そのものは変えない（緑ヶ丘の店の棚・センター・値段の表は前と同じ）。
   ・できた設定には walk があるので、KioskCore.simulate は歩く店の計算（js/kiosk-walk.js）を使う。
   ・店の状態を作る：create(K, M, opts)。店の場所は港駅（P）の改札口の前（gate）。センターでの名前は 'P-gate'。
   ・保存のキー（画面を作る3回目から使う）：KEY='dia-kiosk-minato'（{v:1,...}。緑ヶ丘の店の 'dia-kiosk' とは別）。
   ・DOM もゲーム本体の変数も使わない。数字はすべて仮。
   ===================================================================== */
(function(root){
'use strict';
const KEY='dia-kiosk-minato',URL='data/minato-store.json?v=20261111a5';   // 設定のファイルを読むのはこのファイルの名前だけ（画面は MinatoStore.URL を使う）
const cache=new WeakMap();
/* 港駅の店の設定（同じ K・M なら同じものを返す） */
function cfg(K,M){let c=cache.get(M);if(c&&c._K===K)return c;
  const W=M.walk,drop=new Set(M.range.drop);
  c=JSON.parse(JSON.stringify(K));delete c._ix;delete c._cix;   // 緑ヶ丘の設定の索引（KioskCore・CenterCore が作る）は写さない
  c.products=c.products.filter(p=>!drop.has(p.id)).concat(JSON.parse(JSON.stringify(M.products)));
  c.genres=c.genres.concat(JSON.parse(JSON.stringify(M.genres)));
  for(const g of c.genres){const add=W.genreZones&&W.genreZones[g.id];if(Array.isArray(add))g.zones=[...new Set([...(g.zones||[]),...add])];}
  c.personas=c.personas.concat(JSON.parse(JSON.stringify(M.personas)));
  if(W.personaMap)for(const pk in W.personaMap){if(!c.personaMap[pk]||typeof W.personaMap[pk]!=='object')continue;for(const ak in W.personaMap[pk])c.personaMap[pk][+ak]={...W.personaMap[pk][ak]};}   // グループの客層（家族連れ・カップル・友人同士）は、観光と私用の目的のところだけ置きかえる（2026-11-10）
  c.zones=JSON.parse(JSON.stringify(W.zones));c.layout=JSON.parse(JSON.stringify(W.layout));
  c.open=M.store.open.slice();c.area=W.area||c.area;c.utilityPerDay=Math.round(c.utilityPerDay*(W.utilityMul||1));
  c.visit={...c.visit,cap:c.visit.cap.map(x=>x*(W.visitMul||1))};
  if(c.shrink){c.shrink={...c.shrink,zone:{...c.shrink.zone}};for(const z in W.shrinkZone)if(typeof W.shrinkZone[z]==='number')c.shrink.zone[z]=W.shrinkZone[z];}
  if(c.basket){c.basket={...c.basket,ps:{...c.basket.ps,...(W.basketPs||{})},pairs:{...c.basket.pairs,...(W.basketPairs||{})}};}
  const DV=W.deliveries||{};c.deliveries=c.deliveries.map(d=>{if(d.all)return d;const add=Object.keys(DV).filter(g=>Array.isArray(DV[g])&&DV[g].includes(d.name));return add.length?{...d,genres:[...d.genres,...add]}:d;});
  if(W.trash&&W.trash.label&&c.mood&&c.mood.labels)c.mood.labels.trash=W.trash.label;   // きっかけ「ごみのついでに」（A4）
  c.walk={...W,store:M.store};c.storeId=M.store.id;c._K=K;
  Object.defineProperty(c,'_K',{enumerable:false});
  cache.set(M,c);return c;}
/* 港駅の店を出す（運行日 day から）。KioskCore.create と同じ形（st:'P', place:'gate'）に、店の名前を足す */
function create(K,M,KC,opts){opts=opts||{};const c=cfg(K,M),st=KC.create(c,{seed:opts.seed||1,st:M.store.station,place:M.store.place,day:opts.day||1});
  st.store=M.store.id;st.staff=opts.staff||1;return st;}
/* ---------- おまかせ発注（港駅の売店アニメの S1・2026-11-11） ----------
   港駅の店の中だけで閉じる第1段：締めのたびに売上の記録（CenterCore.salesRecord と 19:00 の pre）を店の状態の om に残し、
   運行日の始めに、その記録から CenterCore.plan（緑ヶ丘のおまかせと同じ数の決め方）でその日の仕入れ数を決めて state.order にする。
   dia-orders・工場の納品書・センターの倉庫・配送会社の便・お金の流れには書かない（緑ヶ丘の店の結果を変えないため。第2段の宿題）。
   state.om={v:1,mode:'auto'|'self',aim,day:最後に数を決めた運行日,recs:[直近30日の記録（品ごとは [売れた数,逃した数] だけ・pre は最後の1日だけ）],last:{day,n,from}} */
const OM_KEEP=30;
function omInit(S,ccfg,mode){if(!S.om)S.om={v:1,mode:mode||'auto',aim:(ccfg&&ccfg.defaultAim)||'mid',day:null,recs:[]};return S.om;}
/* 締め：その日の結果の記録を残す（同じ日は置きかえ）。19:00 の記録（pre）は次の日の数を決めるのにしか使わないので、最後の1日だけ残す */
function omRecord(c,CC,S,res){const o=S.om;if(!o||!CC||!res)return null;const r=CC.salesRecord(c,S,res);
  // 保存を小さく：数を決めるのに使うのは品ごとの [売れた数, 売り切れで逃した数] だけなので、廃棄と残りの数は書かない（廃棄の金額・売り切れの品の数は残す）
  const its={};for(const pid in r.items){const a=r.items[pid].slice(0,2);while(a.length&&a[a.length-1]===0)a.pop();if(a.length)its[pid]=a;}r.items=its;
  o.recs=o.recs.filter(x=>x.day!==r.day).map(x=>{if(x.pre&&x.day<r.day){const y={...x};delete y.pre;return y;}return x;});
  o.recs.push(r);o.recs.sort((a,b)=>a.day-b.day);if(o.recs.length>OM_KEEP)o.recs=o.recs.slice(-OM_KEEP);return r;}
/* 運行日の始め：おまかせなら、その日の仕入れ数を決める（1日に1回）。新聞・雑誌・たばこ（direct）は店の数のまま。記録がないうちは、いまの数のまま */
function omOrder(c,CC,KC,ccfg,S,day,cond){const o=S.om;if(!o||!CC||!ccfg||o.day===day)return null;o.day=day;if(o.mode!=='auto')return null;
  const p=CC.plan(c,ccfg,S,o.recs,cond,{forDay:day,aim:o.aim,shelf:KC.shelfInfo(c,S.layout),cur:S.order});
  S.order={...S.order,...p.items};let n=0;for(const k in p.why)n=Math.max(n,p.why[k].n||0);o.last={day,n,type:p.type,aim:p.aim};return p;}
root.MinatoStore={KEY,URL,cfg,create,omInit,omRecord,omOrder};
})(typeof window!=='undefined'?window:globalThis);
