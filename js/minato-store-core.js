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
const KEY='dia-kiosk-minato',URL='data/minato-store.json';   // 設定のファイルを読むのはこのファイルの名前だけ（画面は MinatoStore.URL を使う）
const cache=new WeakMap();
/* 港駅の店の設定（同じ K・M なら同じものを返す） */
function cfg(K,M){let c=cache.get(M);if(c&&c._K===K)return c;
  const W=M.walk,drop=new Set(M.range.drop);
  c=JSON.parse(JSON.stringify(K));delete c._ix;delete c._cix;   // 緑ヶ丘の設定の索引（KioskCore・CenterCore が作る）は写さない
  c.products=c.products.filter(p=>!drop.has(p.id)).concat(JSON.parse(JSON.stringify(M.products)));
  c.genres=c.genres.concat(JSON.parse(JSON.stringify(M.genres)));
  for(const g of c.genres){const add=W.genreZones&&W.genreZones[g.id];if(Array.isArray(add))g.zones=[...new Set([...(g.zones||[]),...add])];}
  c.personas=c.personas.concat(JSON.parse(JSON.stringify(M.personas)));
  c.zones=JSON.parse(JSON.stringify(W.zones));c.layout=JSON.parse(JSON.stringify(W.layout));
  c.open=M.store.open.slice();c.area=W.area||c.area;c.utilityPerDay=Math.round(c.utilityPerDay*(W.utilityMul||1));
  c.visit={...c.visit,cap:c.visit.cap.map(x=>x*(W.visitMul||1))};
  if(c.shrink){c.shrink={...c.shrink,zone:{...c.shrink.zone}};for(const z in W.shrinkZone)if(typeof W.shrinkZone[z]==='number')c.shrink.zone[z]=W.shrinkZone[z];}
  if(c.basket){c.basket={...c.basket,ps:{...c.basket.ps,...(W.basketPs||{})},pairs:{...c.basket.pairs,...(W.basketPairs||{})}};}
  const DV=W.deliveries||{};c.deliveries=c.deliveries.map(d=>{if(d.all)return d;const add=Object.keys(DV).filter(g=>Array.isArray(DV[g])&&DV[g].includes(d.name));return add.length?{...d,genres:[...d.genres,...add]}:d;});
  c.walk={...W,store:M.store};c.storeId=M.store.id;c._K=K;
  Object.defineProperty(c,'_K',{enumerable:false});
  cache.set(M,c);return c;}
/* 港駅の店を出す（運行日 day から）。KioskCore.create と同じ形（st:'P', place:'gate'）に、店の名前を足す */
function create(K,M,KC,opts){opts=opts||{};const c=cfg(K,M),st=KC.create(c,{seed:opts.seed||1,st:M.store.station,place:M.store.place,day:opts.day||1});
  st.store=M.store.id;st.staff=opts.staff||1;return st;}
root.MinatoStore={KEY,URL,cfg,create};
})(typeof window!=='undefined'?window:globalThis);
