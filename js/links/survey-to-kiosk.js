/* 橋：アンケート → 売店（data/links.json の id "survey-to-kiosk"）
   売店がその日の客（出来事の列）を作るときに渡す「効き目」を作る。
   ・読むのは、その駅の、いちばん新しい調査の年の結果（もう確定した数字）だけ。売店の結果はアンケートに戻さない（一方向）。
   ・効き目は保存しない。毎回、決まった計算で作り直す（同じ年・同じ駅・同じ強さなら、いつ・どの端末でも同じ）。
   ・strength 0 のときは、すべて 1（つなぐ前とまったく同じ）。
   返り値 read()：{v:1, id, st, year, strength, values:[{name,unit,src,value,day,t,year}], fx}
     fx（売店の計算が受け取る入口 ctx.fx）：
       foot[p][h]：目的 p・時刻 h の客の来やすさの倍率（なければ 1）
       age[p][a]：目的 p の客の年代 a の重みの倍率
       em：電子マネーで払う人の割合の倍率／basket：ついで買いの倍率 */
(function(root){
'use strict';
const ID='survey-to-kiosk',H=30;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const cache={};
function linkOf(L){return L&&(L.links||[]).find(x=>x.id===ID)||null;}
// その駅・その年の値（%）。rate の質問だけ使う
function rateOf(SC,D,qid,st,year){const q=D.questions.find(x=>x.id===qid&&x.kind==='rate');if(!q||!D.areas[st])return null;return SC.wave(D,q,st,year).pct[0];}
function lineAges(D){const k=D.ages.length,s=new Array(k).fill(0);let n=0;for(const id in D.areas){const a=D.areas[id];n+=a.n;a.ages.forEach((w,i)=>s[i]+=w*a.n);}return s.map(x=>x/n);}
/* opts：{st, year, isWeekday}。L=links.json、D=survey.json、SC=SurveyCore */
function read(L,D,SC,opts){const lk=linkOf(L);if(!lk||!D||!SC||lk.state==='none'||lk.state==='retired')return null;
  const st=opts.st,year=opts.year,s=Number(lk.strength)||0,wd=!!opts.isWeekday;if(!D.areas[st]||year==null)return null;
  const key=[st,year,s,wd,JSON.stringify(lk.effects)].join('|');if(cache[key])return cache[key];
  const E=lk.effects||{},net=rateOf(SC,D,'net',st,year),cl=rateOf(SC,D,'cashless',st,year),rm=rateOf(SC,D,'remote',st,year);
  const ages=D.areas[st].ages,la=lineAges(D);
  const fx={foot:null,age:null,em:1,basket:1};
  if(E.net&&net!=null)fx.basket=s?clamp(1-E.net.k*s*(net-E.net.ref)/100,E.net.min,E.net.max):1;
  if(E.cashless&&cl!=null)fx.em=s?clamp(1+E.cashless.k*s*(cl-E.cashless.ref)/E.cashless.ref,E.cashless.min,E.cashless.max):1;
  if(E.remote&&rm!=null&&wd&&s){const R=E.remote,d=(rm-R.ref)/100,foot=[null,null,null,null];
    foot[0]=new Array(H).fill(1);for(let h=R.morning[0];h<R.morning[1];h++)foot[0][h]=clamp(1-R.kMorning*s*d,0.6,1.2);
    foot[3]=new Array(H).fill(1);for(let h=R.noon[0];h<R.noon[1];h++)foot[3][h]=clamp(1+R.kNoon*s*d,0.8,1.3);
    fx.foot=foot;}
  if(E.ages&&s){fx.age={};for(const p of E.ages.purposes||[])fx.age[p]=ages.map((w,i)=>Math.pow(w/la[i],E.ages.k*s));}
  const val=(name,value)=>{const v=(lk.values||[]).find(x=>x.name===name)||{};return {name,unit:v.unit||'',src:v.src||'game',value,day:null,t:null,year};};
  const out={v:1,id:ID,st,year,strength:s,values:[val('net',net),val('cashless',cl),val('remote',rm),val('ages',ages.slice())],fx};
  cache[key]=out;return out;}
/* 調査の年：その運行日の日付（昼ごろ）から。毎年 D.month 月に調査（その月に入ったら新しい年） */
function yearFor(D,SC,date){const ys=SC.years(D,date);return ys.length?ys[ys.length-1]:null;}
const api={ID,read,yearFor,lineAges};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
root.SurveyToKiosk=api;
})(typeof globalThis!=='undefined'?globalThis:this);
