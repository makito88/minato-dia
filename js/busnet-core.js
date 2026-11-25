/* =====================================================================
   沿線のバス網（計算だけ。DOM は使わない。node でも動く）
   設定は data/busnet.json（バス路線・停留所・行事の会場と、会場に人がどの駅から来るか）。
   1) 会場が駅から遠い行事：その日の乗り降りの増え方を、歩ける駅とバスで結ばれた駅に分けて掛ける
      （季節のできごと＝place と expand、プレイヤーが選ぶイベント＝eventFlows）。
   2) バスが駅に人を運んでくる（フィーダー）：駅を通る系統の本数と、駅から離れた停留所の割合で、
      その駅に乗り降りする人を少し増やす。電車と並んで走る系統は、その2駅の間を少し減らす（table）。
   効き目は保存しない。毎回この計算で作り直す。
   ===================================================================== */
(function(root){
'use strict';
// 季節のできごと：会場の決まっているものは、駅を会場のいちばん近い駅（main）にし、駅ごとの割合（access）をつける
function place(cfg,list){if(!cfg||!cfg.venues||!list)return list||[];
  return list.map(o=>{const v=cfg.venues[o.id];if(!v||!o.ev||o.ev.scope==='line'||!v.access)return o;
    return Object.assign({},o,{st:v.main,access:v.access,venue:v.name,boost:v.boost||1});});}
// 鉄道の効き目を作る前に、会場のある1件を駅ごとの数件に分ける（強さ mag × 割合 × 増便の上乗せ）
function expand(list){const out=[];for(const o of (list||[])){if(!o.access){out.push(o);continue;}const b=o.boost||1;
    for(const s in o.access)out.push(Object.assign({},o,{st:s,mag:o.mag*o.access[s]*b}));}return out;}
/* プレイヤーが選ぶイベント（index.html の EVENT_DATA）：その駅（place）へ来る・帰る流れの一部を、会場に行ける別の駅に分ける。
   もとの駅は半分より下げない（ゲームの作りを大きく変えないため）。1回だけ（_bus の印） */
function eventFlows(cfg,evs){if(!cfg||!cfg.venues)return 0;let n=0;
  for(const ev of evs){const v=cfg.venues[ev.id];if(!v||!v.access||ev._bus)continue;
    let own=v.access[ev.place]||0;const others=Object.keys(v.access).filter(s=>s!==ev.place);if(!others.length){ev._bus=1;continue;}
    const rest=1-own,keep=Math.max(0.5,own),scale=rest>0?(1-keep)/rest:0,add=[];
    for(const f of ev.flows){const t=f.to===ev.place,fr=f.from===ev.place;if(!t&&!fr)continue;
      for(const s of others){const g=Object.assign({},f,{amt:+(f.amt*v.access[s]*scale).toFixed(3),bus:1});if(t)g.to=s;if(fr)g.from=s;if(g.to&&g.from&&g.to===g.from)continue;add.push(g);}
      f.amt=+(f.amt*keep).toFixed(3);}
    ev.flows.push(...add);ev._bus=1;n++;}
  return n;}
// 駅ごとのフィーダーの強さ（0〜feedCap）。holiday なら土休日の本数
function feeder(cfg,holiday){const fx=cfg.fx||{},f={};
  for(const r of cfg.routes||[]){const n=holiday?r.we:r.wd,sts=r.stations||[];if(!sts.length)continue;const w=n*(r.feeder||0)/sts.length;for(const s of sts)f[s]=(f[s]||0)+w;}
  for(const s in f)f[s]=Math.min(fx.feedCap||0.06,f[s]*(fx.feedK||0));return f;}
// 電車と並ぶ系統：2駅の組ごとの減り方（0〜compCap）
function compete(cfg,holiday){const fx=cfg.fx||{},c={};
  for(const r of cfg.routes||[]){const sts=r.stations||[];if(sts.length<2)continue;const n=holiday?r.we:r.wd;
    for(let i=0;i<sts.length;i++)for(let j=i+1;j<sts.length;j++){const k=sts[i]<sts[j]?sts[i]+sts[j]:sts[j]+sts[i];c[k]=(c[k]||0)+n;}}
  for(const k in c)c[k]=Math.min(fx.compCap||0.02,c[k]*(fx.compK||0));return c;}
// 駅の組・目的ごとの倍率の表：Float32Array(N*N*4)。ALL は駅の並び（index.html の ALL）
function table(cfg,ALL,holiday){if(!cfg)return null;const N=ALL.length,T=new Float32Array(N*N*4).fill(1),f=feeder(cfg,holiday),c=compete(cfg,holiday),fp=(cfg.fx&&cfg.fx.feedP)||[1,1,1,1];
  for(let si=0;si<N;si++)for(let di=0;di<N;di++){if(si===di)continue;const a=ALL[si],b=ALL[di],k=a<b?a+b:b+a,cc=c[k]||0;
    for(let p=0;p<4;p++)T[(si*N+di)*4+p]=(1+(f[a]||0)*fp[p])*(1+(f[b]||0)*fp[p])*(1-cc);}
  return T;}
const api={place,expand,eventFlows,feeder,compete,table};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
root.BusNet=api;
})(typeof globalThis!=='undefined'?globalThis:this);
