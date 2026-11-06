/* 沿線くらしアンケート（定点調査）の計算。画面は js/survey-view.js、設定は data/survey.json。
   駅ごとのまわりに住む人に、毎年10月に同じ質問をした結果を作る。
   答えの割合 = 駅の性格（f）＋年代（age）＋時代の流れ（t・tAge）から決めた「その人の選びやすさ」
   そこから聞いた人数（n）ぶんを乱数で引くので、本物の調査のように少しぶれる（同じ年・同じ駅なら毎回同じ）。 */
(function(root){
'use strict';
// 決まった乱数（文字列の種から）
function seedOf(str){let h=2166136261;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
function rng(seed){let a=seed>>>0;return ()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}

// 時代の流れの値（0〜）
function curve(c,year){
  if(!c)return 0;
  if(c.table){const t=c.table;if(t[year]!=null)return t[year];const ys=Object.keys(t).map(Number).sort((a,b)=>a-b);return year<ys[0]?0:(c.after!=null?c.after:t[ys[ys.length-1]]);}
  if(c.linear){const L=c.linear;return Math.max(0,Math.min(L.max!=null?L.max:9,(year-L.from)*L.per));}
  if(c.logistic){const L=c.logistic;return 1/(1+Math.exp(-L.k*(year-L.mid)));}
  return 0;}

// 選びやすさ（logit）。a=駅の設定、ai=年代の番号
function score(D,o,a,ai,year){
  let v=o.base||0;
  if(o.age)v+=o.age[ai]||0;
  for(const k in (o.f||{}))v+=(o.f[k]||0)*((a.f&&a.f[k])||0);
  for(const k in (o.t||{}))v+=(o.t[k]||0)*curve(D.curves[k],year);
  for(const k in (o.tAge||{}))v+=((o.tAge[k]||[])[ai]||0)*curve(D.curves[k],year);
  return v;}
const sig=x=>1/(1+Math.exp(-x));

// 本当の割合（ぶれなし）：年代ごと
function trueShares(D,q,a,ai,year){
  if(q.kind==='rate'){const p=sig(score(D,q,a,ai,year));return [p,1-p];}
  const e=q.options.map(o=>Math.exp(score(D,o,a,ai,year)));const s=e.reduce((x,y)=>x+y,0);return e.map(x=>x/s);}

// 調査した年の一覧（毎年 month 月に調査。その月を過ぎた年まで）
function years(D,now){const d=now instanceof Date?now:new Date(now==null?Date.now():now);
  const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'numeric'}).formatToParts(d).map(x=>[x.type,x.value]));
  const last=Number(p.month)>=D.month?Number(p.year):Number(p.year)-1;const out=[];for(let y=D.start;y<=last;y++)out.push(y);return out;}

/* 1つの質問・1つの駅・1つの年の結果。
   返り値：{n, counts:[選択肢ごと], pct:[%], byAge:[{n,pct:[%]}], truth:[ぶれなしの%]} （rate は選択肢が [はい, いいえ]） */
function wave(D,q,id,year){
  const a=D.areas[id],r=rng(seedOf([q.id,id,year].join('|')));
  const k=q.kind==='rate'?2:q.options.length,counts=new Array(k).fill(0),byAge=D.ages.map(()=>({n:0,c:new Array(k).fill(0)}));
  const truth=new Array(k).fill(0);
  a.ages.forEach((w,ai)=>{trueShares(D,q,a,ai,year).forEach((p,j)=>truth[j]+=w*p);});
  // 聞いた人：年代は駅の年代の割合から引き、答えはその年代の割合から引く
  const cumA=[];a.ages.reduce((s,w,i)=>(cumA[i]=s+w),0);
  for(let i=0;i<a.n;i++){const u=r()*cumA[cumA.length-1];let ai=cumA.findIndex(c=>u<c);if(ai<0)ai=cumA.length-1;
    const sh=trueShares(D,q,a,ai,year);let v=r(),j=0;while(j<k-1&&v>=sh[j]){v-=sh[j];j++;}
    counts[j]++;byAge[ai].n++;byAge[ai].c[j]++;}
  const pc=(c,n)=>c.map(x=>n?x/n*100:0);
  return {n:a.n,counts,pct:pc(counts,a.n),byAge:byAge.map(b=>({n:b.n,pct:pc(b.c,b.n)})),truth:truth.map(x=>x*100)};}

/* 沿線全体（駅ごとの結果を、聞いた人数で合わせる） */
function total(D,q,year){let n=0;const k=q.kind==='rate'?2:q.options.length,c=new Array(k).fill(0);
  for(const id in D.areas){const w=wave(D,q,id,year);n+=w.n;w.counts.forEach((x,j)=>c[j]+=x);}return {n,pct:c.map(x=>x/n*100)};}

const api={seedOf,rng,curve,score,trueShares,years,wave,total};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
root.SurveyCore=api;
})(typeof globalThis!=='undefined'?globalThis:this);
