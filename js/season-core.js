/* =====================================================================
   季節のできごと（計算だけ。DOM は使わない。node でも動く）
   ・暦にそった小さな行事が、プレイヤーの知らないうちに沿線のどこかで起きる。
   ・設定は data/seasonal.json と data/seasonal-extra.json（同じ形。extra はあとから足す場所）。
     1件ごとに「起こりやすい時期（本当の暦の月日の幅）」「起こりやすい駅の性格」「乗客への効き目」「売店で売れやすくなる品」だけを持つ。
   ・いつ・どこで起きるかは「保存の種（dia-ensen の seed）＋暦の年」だけで決まる。
     同じ引き継ぎコードなら、PC でもスマホでも、同じ日に同じできごとが起きる。画面の幅やダイヤには左右されない。
   ・効き目は保存しない（橋の決まり3）。毎回この計算で作り直す。
   ===================================================================== */
(function(root){
'use strict';
const DAY=86400000,JST=9*3600000,S0=270*60000;
// 運行日の番号（日本時間の朝4:30で区切る。js/away.js の opIndex と同じ）
const opIndex=ms=>Math.floor((ms+JST-S0)/DAY);
// 番号 → 日本時間の年・月・日・曜日（0＝日曜）
function partsOf(i){const d=new Date(i*DAY+S0+12*3600000);return {y:d.getUTCFullYear(),m:d.getUTCMonth()+1,d:d.getUTCDate(),dow:d.getUTCDay()};}
const indexOf=(y,m,d)=>Math.floor((Date.UTC(y,m-1,d,12)-S0)/DAY);
const ymdOf=i=>{const p=partsOf(i);return p.y+'-'+String(p.m).padStart(2,'0')+'-'+String(p.d).padStart(2,'0');};
function hash(){let h=2166136261>>>0;for(const a of arguments){const s=String(a);for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}h^=0x9e;h=Math.imul(h,16777619)>>>0;}return h;}
function rng(a){a|=0;return()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

// 設定をまとめる（本体＋あとから足す分）。同じ id はあとの方が勝つ
function merge(){const out={stations:{},list:[],maxPerDay:2,fx:{}};
  for(const c of arguments){if(!c)continue;if(c.stations)Object.assign(out.stations,c.stations);if(c.maxPerDay!=null)out.maxPerDay=c.maxPerDay;if(c.fx)Object.assign(out.fx,c.fx);
    for(const e of (c.list||[])){if(!e||!e.id)continue;const k=out.list.findIndex(x=>x.id===e.id);if(k>=0)out.list[k]=e;else out.list.push(e);}}
  return out;}

// 「MM-DD」の幅 → その年（幅の始まりの年）の運行日の番号の幅。年をまたぐ幅（12-28〜01-03）も読める
function windowOf(w,y){const [m0,d0]=w[0].split('-').map(Number),[m1,d1]=w[1].split('-').map(Number);
  const a=indexOf(y,m0,d0),b=indexOf((m1<m0||(m1===m0&&d1<d0))?y+1:y,m1,d1);return [a,b];}
// 駅の重み：駅の性格（stations）と、できごとの where（性格 → 重み）の合うものを足す
function stationWeights(cfg,ev){const W={};for(const st in cfg.stations){let w=0;for(const t of cfg.stations[st])w+=(ev.where&&ev.where[t])||0;if(ev.only&&!ev.only.includes(st))w=0;if(w>0)W[st]=w;}return W;}
function pickW(obj,r){const ks=Object.keys(obj);let tot=0;for(const k of ks)tot+=obj[k];let x=r()*tot;for(const k of ks){x-=obj[k];if(x<=0)return k;}return ks[ks.length-1];}

/* その年に、そのできごとが起きる日と駅：[{i, st, mag}]
   times（[最小,最大]）回、幅の中の日を選ぶ。dow があればその曜日だけ（例：運動会は土日）。
   chance（0〜1）で、その年は起きないこともある */
const cache=new Map();
function yearPlan(cfg,seed,ev,y){const key=seed+'|'+ev.id+'|'+y+'|'+(ev._v||'');if(cache.has(key))return cache.get(key);
  const r=rng(hash(seed,'season',ev.id,y)),out=[];
  if(ev.chance!=null&&r()>ev.chance){cache.set(key,out);return out;}
  const [a,b]=windowOf(ev.when,y),days=[];for(let i=a;i<=b;i++){if(ev.dow&&!ev.dow.includes(partsOf(i).dow))continue;days.push(i);}
  const t=ev.times||[1,1],n=Math.min(days.length,t[0]+Math.floor(r()*(t[1]-t[0]+1)));
  const W=ev.scope==='line'?null:stationWeights(cfg,ev);if(W&&!Object.keys(W).length){cache.set(key,out);return out;}
  const used=new Set();
  for(let k=0;k<n;k++){let i=null;for(let tries=0;tries<8;tries++){const c=days[Math.floor(r()*days.length)];if(!used.has(c)){i=c;break;}}if(i==null)continue;used.add(i);
    const st=W?pickW(W,r):null,m=ev.mag||[0.8,1.2];out.push({i,st,mag:+(m[0]+r()*(m[1]-m[0])).toFixed(3)});}
  if(cache.size>4000)cache.clear();cache.set(key,out);return out;}

/* その運行日（番号 i）に起きているできごと：[{id, i, ymd, st, mag, ev}]
   1日に maxPerDay 件まで（多いときは種で決まった順に残す）。同じ駅に2件は重ねない */
function today(cfg,seed,i){if(!cfg||!cfg.list)return [];const y=partsOf(i).y,hits=[];
  for(const ev of cfg.list){if(!ev.when)continue;for(const yy of [y-1,y]){for(const o of yearPlan(cfg,seed,ev,yy))if(o.i===i)hits.push({id:ev.id,i,ymd:ymdOf(i),st:o.st,mag:o.mag,ev});}}
  const r=rng(hash(seed,'pick',i));hits.forEach(h=>h._o=r());hits.sort((a,b)=>a._o-b._o);
  const out=[],usedSt=new Set();for(const h of hits){if(out.length>=(cfg.maxPerDay||2))break;const k=h.st||'*';if(usedSt.has(k))continue;usedSt.add(k);delete h._o;out.push(h);}
  return out;}

/* 鉄道の効き目：その日のできごとから「駅・時台・目的ごとの倍率」を作るための規則の一覧
   rail：[{to:true|from:true, p:[目的], h:[始,終), k:強さ}]。st のできごとは、その駅に着く（to）・出る（from）人に掛ける。
   scope:'line' のものは、全部の駅に掛ける（強さは lineK 倍に弱める）。
   返り値：[{st|null, to, from, p, h, k}]（k はもう mag を掛けたもの） */
function railRules(cfg,list,skipSt){const out=[],lk=(cfg.fx&&cfg.fx.lineK)||0.35;
  for(const o of list){if(o.st&&skipSt&&skipSt.has(o.st))continue;for(const r of (o.ev.rail||[]))out.push({st:o.st,to:!!r.to,from:!!r.from,p:r.p||[2,3],h:r.h||[9,17],k:r.k*o.mag*(o.st?1:lk)});}
  return out;}
// 1本の流れ（s→d、時台 h、目的 p）の倍率
function railFactor(rules,s,d,h,p){let k=1;for(const r of rules){if(!r.p.includes(p)||h<r.h[0]||h>=r.h[1])continue;
    if(r.st==null){k*=1+r.k;continue;}if((r.to&&d===r.st)||(r.from&&s===r.st))k*=1+r.k;}return k;}

/* 売店の効き目（ctx.fx の genre）：その駅のできごと（と沿線全体のもの）で、売れやすくなるジャンルの倍率
   kiosk：{ジャンル: 倍率}。沿線全体のものは、1 との差を lineK 倍に弱める */
function kioskFx(cfg,list,st){const g={};const lk=(cfg.fx&&cfg.fx.lineK)||0.35,cap=(cfg.fx&&cfg.fx.kioskMax)||1.8;let any=false;
  for(const o of list){if(o.st&&o.st!==st)continue;const s=o.st?1:lk;for(const k in (o.ev.kiosk||{})){const v=1+(o.ev.kiosk[k]-1)*o.mag*s;g[k]=Math.min(cap,Math.max(0.5,(g[k]||1)*v));any=true;}}
  return any?g:null;}
// 売店の ctx.fx を合わせる（ほかの橋の fx に genre を足すだけ。ほかの値は変えない）
function mergeFx(fx,genre){if(!genre)return fx;return Object.assign({},fx||{},{genre});}

const api={opIndex,partsOf,indexOf,ymdOf,merge,windowOf,stationWeights,yearPlan,today,railRules,railFactor,kioskFx,mergeFx,hash,rng};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
root.SeasonCore=api;
})(typeof globalThis!=='undefined'?globalThis:this);
