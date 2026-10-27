/* =====================================================================
   駅ナカ リサーチ（第1段）の計算の中心
   ・列車シミュレーションの乗降（駅・目的・1時間ごと）と、ダイヤの停車本数から、
     選んだ場所を通る人・立ち止まれる時間・客層を出す。
   ・調査は運行日ごとに1日分の記録になる。数えた人数には誤差、聞き取りには答えた人数の限りがある。
   ・集めた記録から、レポート（幅つき）と業態ごとの収支の試算を出す。売れる前提にはせず、
     「置いてみないとわからない部分」の幅も必ず含める。
   ・DOM もゲーム本体の変数も使わない。設定は data/research.json。
   ===================================================================== */
(function(root){
'use strict';
function hash(){let h=2166136261>>>0;for(const a of arguments){const s=String(a);for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}h^=0x9e;h=Math.imul(h,16777619)>>>0;}return h>>>0;}
function rng(seed){let a=seed>>>0;return function(){a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
const gauss=r=>{const u=Math.max(1e-9,r()),v=r();return Math.sqrt(-2*Math.log(u))*Math.cos(6.2832*v);};
const pick=(w,r)=>{let s=0;for(const x of w)s+=x;if(s<=0)return -1;let y=r()*s;for(let i=0;i<w.length;i++){if(y<w[i])return i;y-=w[i];}return w.length-1;};
const hm=(list,h)=>{let m=1;if(list)for(const [a,b,k] of list)if(h>=a&&h<b)m*=k;return m;};
const inH=(list,h)=>list.some(([a,b])=>h>=a&&h<b);
const H=30;

/* ---------- 場所を通る人（目的×時間） ---------- */
function footfall(cfg,st,place,fl,plats){const P=cfg.places[place],F=[0,1,2,3].map(()=>new Float64Array(H));
  const div=P.perPlatform?Math.max(1,(plats||2)/2):1;
  for(let p=0;p<4;p++)for(let h=0;h<H;h++)F[p][h]=((fl.hb[p][h]||0)*(P.flow.hb||0)+(fl.ha[p][h]||0)*(P.flow.ha||0))/div;
  if(P.flow.locals){const L=cfg.locals,tot=(L[st]||0)*P.flow.locals;let w=new Float64Array(H),ws=0;for(let h=5;h<24;h++){w[h]=hm(L.hours,h)*(h>=6&&h<23?1:0.15);ws+=w[h];}
    for(let h=0;h<H;h++)F[3][h]+=tot*w[h]/ws;}
  return F;}
/* 立ち止まれる時間（分）。ホームは列車の間隔から、ほかは場所ごとの目安 */
function dwellOf(cfg,place,stops){const P=cfg.places[place],d=new Float64Array(H);
  for(let h=0;h<H;h++){if(P.dwell==='headway'){const n=stops[h]||0;d[h]=n>0?Math.min(15,60/Math.max(1,n/2)/2+0.5):0;}else d[h]=P.dwell;}
  return d;}
function ageMix(cfg,st,p){const o=cfg.ages.station[st];return (o&&o[String(p)])||cfg.ages.byPurpose[p];}
function emoneyP(cfg,a,p){return Math.min(0.97,cfg.payment.emoney[a]*cfg.payment.purposeMul[p]);}

/* ---------- 調査1日分 ----------
   ctx = { seed, day, st, place, methods:{count,interview}, cond:{day,wx,season}, ev:[名前], flows:{hb,ha}, stops:[時間ごとの停車本数], plats, year } */
function dayRecord(cfg,ctx){const r=rng(hash(ctx.seed,ctx.day,ctx.st,ctx.place)),F=footfall(cfg,ctx.st,ctx.place,ctx.flows,ctx.plats),dw=dwellOf(cfg,ctx.place,ctx.stops);
  const rec={day:ctx.day,cond:{...ctx.cond},ev:ctx.ev||[],m:{...ctx.methods},cost:0};
  let tot=0;for(let p=0;p<4;p++)for(let h=0;h<H;h++)tot+=F[p][h];
  // 数える：時間ごとに少しずつ誤差が出る
  if(ctx.methods.count){const nz=cfg.methods.count.noise;rec.F=F.map(a=>Array.from(a,v=>Math.max(0,Math.round(v*(1+nz*gauss(r))))));rec.dw=Array.from(dw,v=>+v.toFixed(1));rec.cost+=cfg.methods.count.costPerDay;}
  // 聞き取り：答えてくれた人から、客層・支払い・ほしい物・声
  if(ctx.methods.interview){const I=cfg.methods.interview;rec.cost+=I.costPerDay;
    let n=Math.round(Math.min(I.perDay[1],Math.max(I.perDay[0],tot*I.share)));n=Math.min(n,Math.floor(tot*0.4));
    const hw=new Float64Array(H);for(let h=0;h<H;h++){let s=0;for(let p=0;p<4;p++)s+=F[p][h];hw[h]=h>=7&&h<21?s:0;}   // 調査員がいるのは7時〜21時
    const age=[0,0,0,0,0],pur=[0,0,0,0],want={},voices=[];let em=0,mag=0,man=0,alc=0,adults=0;
    const W=cfg.wants;
    for(let i=0;i<n;i++){const h=pick(hw,r);if(h<0)break;const p=pick([0,1,2,3].map(q=>F[q][h]),r),a=pick(ageMix(cfg,ctx.st,p),r);age[a]++;pur[p]++;
      const pay=r()<emoneyP(cfg,a,p);if(pay)em++;if(a>0)adults++;
      // 雑誌・漫画・酒たばこ：「ふだん駅で買うか」を聞く（1日の割合に直すと小さいので、週に1回以上を数える）
      if(r()<Math.min(0.9,cfg.magazine.rate[a]*7*hm(cfg.magazine.hours,h)*Math.pow(1+cfg.magazine.trend.magazine,ctx.year||0)))mag++;
      if(r()<Math.min(0.9,cfg.magazine.manga[a]*7*Math.pow(1+cfg.magazine.trend.manga,ctx.year||0)))man++;
      if(a>0&&r()<Math.min(0.9,cfg.ageCheck.rate[a]*cfg.ageCheck.purposeMul[p]*hm(cfg.ageCheck.hours,h)*7))alc++;
      const ww=W.map(x=>(inH(x.hours,h)?hm(x.hours,h):0.15)*x.p[p]*x.age[a]*((x.season&&x.season[ctx.cond.season])||1)*((x.wx&&x.wx[ctx.cond.wx])??1)*Math.pow(Math.max(0.5,dw[h]||1)/2,x.dwell||0)*(x.board&&ctx.place==='home'?1.4:1));
      ww.push(2.2);   // とくにほしい物はない
      const k=pick(ww,r);let text=null,kind=null;
      if(k<W.length){want[W[k].id]=(want[W[k].id]||0)+1;if(r()<0.35){text=W[k].voices[Math.floor(r()*W[k].voices.length)];kind=W[k].id;}}
      if(!text){for(const c of cfg.complaints){let ok=false;
          if(c.if==='cash')ok=!pay&&c.age.includes(a)&&r()<0.4;
          else if(c.if==='hurry')ok=p===0&&(dw[h]||1)<2&&(h<10)&&r()<0.12;
          else if(c.if==='competitor')ok=(ctx.place==='soto'||ctx.place==='gate')&&r()<0.06;
          if(ok){text=c.voices[Math.floor(r()*c.voices.length)];kind=c.if;break;}}}
      if(text&&voices.length<10&&!voices.some(v=>v.t===text))voices.push({t:text,k:kind,a,p,h});}
    rec.I={n,age,pur,em,mag,man,alc,adults,want,voices};
    if(!ctx.methods.count)rec.Frough=Math.round(tot*(1+0.3*gauss(r)));}    // 数えていなければ、調査員の見た目の感じだけ
  rec.tot=Math.round(rec.F?rec.F.reduce((s,a)=>s+a.reduce((x,y)=>x+y,0),0):(rec.Frough||0));
  return rec;}

/* 今日これまでに通った人（映像の数字用） */
function soFar(F,T){let s=0;const hh=Math.floor(T/60),fr=(T%60)/60;for(let p=0;p<4;p++){for(let h=0;h<hh&&h<H;h++)s+=F[p][h];if(hh<H)s+=F[p][hh]*fr;}return s;}

/* ---------- 集計：レポート ---------- */
const DAYK=['wd','sat','hol'];
function aggregate(cfg,recs){const rep={days:recs.length,cost:recs.reduce((s,x)=>s+x.cost,0),cover:{day:{},wx:{},ev:0},count:0,interview:0};
  if(!recs.length)return rep;
  for(const x of recs){rep.cover.day[x.cond.day]=(rep.cover.day[x.cond.day]||0)+1;rep.cover.wx[x.cond.wx]=(rep.cover.wx[x.cond.wx]||0)+1;if(x.ev.length)rep.cover.ev++;if(x.F)rep.count++;if(x.I)rep.interview++;}
  // 人の流れ（数えた日だけ）：曜日の種類ごとの平均と、日ごとのばらつき
  const cnt=recs.filter(x=>x.F);
  if(cnt.length){rep.byDay={};for(const k of DAYK){const xs=cnt.filter(x=>x.cond.day===k);if(!xs.length)continue;
      const F=[0,1,2,3].map(p=>Array.from({length:H},(_,h)=>xs.reduce((s,x)=>s+x.F[p][h],0)/xs.length));const tots=xs.map(x=>x.tot),m=tots.reduce((a,b)=>a+b,0)/tots.length;
      const sd=tots.length>1?Math.sqrt(tots.reduce((a,b)=>a+(b-m)**2,0)/(tots.length-1))/m:0.12;
      rep.byDay[k]={n:xs.length,F,tot:m,relSd:Math.max(cfg.methods.count.noise/Math.sqrt(xs.length*6),sd/Math.sqrt(xs.length))};}
    rep.dw=Array.from({length:H},(_,h)=>cnt.reduce((s,x)=>s+x.dw[h],0)/cnt.length);
    const all=[0,1,2,3].map(p=>Array.from({length:H},(_,h)=>cnt.reduce((s,x)=>s+x.F[p][h],0)/cnt.length));rep.F=all;rep.tot=cnt.reduce((s,x)=>s+x.tot,0)/cnt.length;
    // 天気・イベントごとの差（平日の晴れ・くもりを1とした比）
    const base=cnt.filter(x=>x.cond.day==='wd'&&(x.cond.wx==='sun'||x.cond.wx==='cld')&&!x.ev.length);const bm=base.length?base.reduce((s,x)=>s+x.tot,0)/base.length:null;
    const grp=(f,label)=>{const xs=cnt.filter(f);return {label,n:xs.length,ratio:bm&&xs.length?xs.reduce((s,x)=>s+x.tot,0)/xs.length/bm:null,tot:xs.length?xs.reduce((s,x)=>s+x.tot,0)/xs.length:null};};
    rep.diff=[grp(x=>x.cond.day==='wd'&&(x.cond.wx==='sun'||x.cond.wx==='cld')&&!x.ev.length,'平日・晴れ／くもり'),grp(x=>x.cond.day==='sat','土曜'),grp(x=>x.cond.day==='hol','日曜・祝日'),
      grp(x=>x.cond.day==='wd'&&x.cond.wx==='rain','平日・雨'),grp(x=>x.cond.day==='wd'&&x.cond.wx==='snow','平日・大雪'),grp(x=>x.ev.length>0,'イベントのある日')];}
  else{const xs=recs.filter(x=>x.Frough);rep.rough=xs.length?xs.reduce((s,x)=>s+x.Frough,0)/xs.length:null;}
  // 聞き取り
  const iv=recs.filter(x=>x.I);
  if(iv.length){const S={n:0,age:[0,0,0,0,0],pur:[0,0,0,0],em:0,mag:0,man:0,alc:0,adults:0,want:{}};const voices=[];
    for(const x of iv){const I=x.I;S.n+=I.n;S.em+=I.em;S.mag+=I.mag;S.man+=I.man;S.alc+=I.alc;S.adults+=I.adults;I.age.forEach((v,i)=>S.age[i]+=v);I.pur.forEach((v,i)=>S.pur[i]+=v);for(const k in I.want)S.want[k]=(S.want[k]||0)+I.want[k];
      for(const v of I.voices)voices.push({...v,day:x.day,cond:x.cond});}
    const ci=(k,n)=>{const p=n?k/n:0;return {p,lo:Math.max(0,p-1.96*Math.sqrt(p*(1-p)/Math.max(1,n))),hi:Math.min(1,p+1.96*Math.sqrt(p*(1-p)/Math.max(1,n)))};};
    rep.I={n:S.n,age:S.age.map(v=>ci(v,S.n)),pur:S.pur.map(v=>ci(v,S.n)),em:ci(S.em,S.n),mag:ci(S.mag,S.n),man:ci(S.man,S.n),alc:ci(S.alc,S.adults),
      want:Object.entries(S.want).map(([k,v])=>({id:k,...ci(v,S.n),k:v})).sort((a,b)=>b.k-a.k),voices:voices.slice(-40).reverse()};}
  return rep;}

/* ---------- 試算：業態ごとの売上と費用 ----------
   opts = { st, place, season, ageDevice } 返すのは、見込みの1日売上（少なめ・見込み・多め）、月の費用と損益、初期費用の回収月数、注意点 */
function estimate(cfg,rep,typeId,opts){const T=cfg.types.find(x=>x.id===typeId),P=cfg.places[opts.place];const out={type:T,notes:[],ok:true};
  if(!T.places.includes(opts.place)){out.ok=false;out.why=`${P.name}には置けません（${opts.place==='home'?'ホームは狭く、通路をふさげない':'この業態に合う場所ではない'}）。`;return out;}
  if(T.area>P.maxArea){out.ok=false;out.why=`広さが足りません（${T.area}㎡要る／${P.name}は${P.maxArea}㎡まで）。`;return out;}
  if(!rep.byDay&&!rep.rough){out.ok=false;out.why='人の流れを調べていないので、試算できません。「人の流れを数える」か「聞き取り」で1日以上調べてください。';return out;}
  const sdParts=[];
  // 曜日の種類ごとの人の流れ（調べていない曜日は目安で推し量る）
  let baseKey=rep.byDay?(rep.byDay.wd?'wd':Object.keys(rep.byDay)[0]):null;
  const dayF={},daySd={};
  for(const k of DAYK){if(rep.byDay&&rep.byDay[k]){dayF[k]=rep.byDay[k].F;daySd[k]=rep.byDay[k].relSd;continue;}
    const g=cfg.condGuess.day,b=rep.byDay?rep.byDay[baseKey]:null;const ratio=g[k][0]/g[baseKey||'wd'][0];
    if(b){dayF[k]=b.F.map(a=>a.map(v=>v*ratio));daySd[k]=Math.hypot(b.relSd,g[k][1]+g[baseKey][1]);}
    else{const F0=[0,1,2,3].map(()=>new Array(H).fill(0));const tot=rep.rough;for(let h=0;h<H;h++){const w=h>=6&&h<23?1:0.1;for(let p=0;p<4;p++)F0[p][h]=tot*ratio*w/17.6*[0.6,0.08,0.12,0.2][p];}dayF[k]=F0;daySd[k]=Math.hypot(0.35,g[k][1]);}}
  if(!rep.byDay)out.notes.push('人数を数えていないので、通る人の数も時間帯も大まかです（幅が広くなります）。');
  // 天気：調べた日の天気と、ふつうの天気の割合（晴れ6・くもり2・雨2）の差
  const wxMix={sun:0.6,cld:0.2,rain:0.2};const seen=Object.keys(rep.cover.wx);const wxUnknown=Object.keys(wxMix).filter(w=>!seen.includes(w));
  const wxSd=wxUnknown.reduce((s,w)=>s+wxMix[w]*cfg.condGuess.wx[w][1],0);if(wxSd>0)sdParts.push(wxSd);
  // 客層と支払い：聞き取りがあればその割合、なければ全国の目安（幅を広く）
  const ageOf=p=>{if(rep.I&&rep.I.n>=20){const a=rep.I.age.map(x=>x.p);return a;}return ageMix(cfg,opts.st,p);};
  let emShare=null,emSd=0.12;if(rep.I&&rep.I.n>=20){emShare=rep.I.em.p;emSd=(rep.I.em.hi-rep.I.em.lo)/3.92/Math.max(0.05,emShare);}
  // 1日の売上（曜日の種類ごと）
  const dayCalc=k=>{const F=dayF[k];let cust=0,yen=0,capHit=0,lostCash=0,alc=0;
    for(let h=0;h<H;h++){if(!inH(T.hours,h))continue;let c=0,cashLost=0;
      const dwf=Math.min(2.5,Math.max(0.4,Math.pow(Math.max(0.3,(rep.dw?rep.dw[h]:P.dwell==='headway'?3:P.dwell))/2,T.dwellPow||0)));
      for(let p=0;p<4;p++){const am=ageOf(p);let af=0;for(let a=0;a<5;a++)af+=am[a]*T.ageMul[a];
        let x=F[p][h]*T.cap[p]*af*hm(T.prof,h)*dwf*((T.season&&T.season[opts.season])||1);
        let wm=0;for(const w in wxMix)wm+=wxMix[w]*((T.wx&&T.wx[w])??1);x*=wm;
        if(T.emoneyOnly){let e=0;if(emShare!=null)e=emShare;else{for(let a=0;a<5;a++)e+=am[a]*emoneyP(cfg,a,p);}cashLost+=x*(1-e);x*=e;}
        c+=x;}
      if(c>T.capPerHour){capHit+=c-T.capPerHour;c=T.capPerHour;}
      cust+=c;lostCash+=cashLost;}
    yen=cust*T.ticket;return {cust,yen,capHit,lostCash};};
  const days={};let wsum=0,yen=0,cust=0,sd2=0,capHit=0,lostCash=0;for(const k of DAYK){const d=dayCalc(k);days[k]=d;const w=cfg.weekMix[k];wsum+=w;yen+=d.yen*w;cust+=d.cust*w;capHit+=d.capHit*w;lostCash+=d.lostCash*w;sd2+=(w*daySd[k])**2;}
  yen/=wsum;cust/=wsum;capHit/=wsum;lostCash/=wsum;const sdFlow=Math.sqrt(sd2)/wsum*Math.sqrt(DAYK.length);
  sdParts.push(sdFlow);if(T.emoneyOnly)sdParts.push(emSd);
  const sdResearch=Math.sqrt(sdParts.reduce((s,x)=>s+x*x,0)),sdFit=cfg.fitSd,sd=Math.hypot(sdResearch,sdFit);
  out.days=days;out.cust=cust;out.sd={research:sdResearch,fit:sdFit,all:sd};
  const z=1.2816;out.daily={lo:yen*Math.exp(-z*sd),mid:yen,hi:yen*Math.exp(z*sd)};
  // 月の費用と損益（30日）
  const emRate=T.emoneyOnly?1:(emShare??0.55);
  const month=sales=>{const c={};
    if(T.id==='vend'){c.elec=T.monthly;const owner=sales*T.ownerShare;return {sales,income:owner,cost:c,profit:owner-T.monthly,label:'手数料収入'};}
    c.cogs=sales*T.cogs;c.waste=sales*(T.waste||0);c.staff=T.staffHours*cfg.wage*30;c.fee=sales*emRate*cfg.emoneyFee;
    if(T.daily)c.space=T.daily*30;if(!T.rentNone)c.rent=Math.max(sales*P.rentRate,P.rentMinSqm*T.area);
    c.system=T.monthly||0;if(T.emoneyOnly&&opts.ageDevice&&T.ageCheckDevice)c.system+=T.ageCheckDevice.monthly;
    const tot=Object.values(c).reduce((a,b)=>a+b,0);return {sales,income:sales,cost:c,costTot:tot,profit:sales-tot};};
  out.month={lo:month(out.daily.lo*30),mid:month(out.daily.mid*30),hi:month(out.daily.hi*30)};
  out.init=T.init+(T.emoneyOnly&&opts.ageDevice&&T.ageCheckDevice?T.ageCheckDevice.init:0);
  out.payback=out.month.mid.profit>0?out.init/out.month.mid.profit:null;
  // 損益がちょうど0になる1日の売上（二分法）
  let lo=0,hi=5e7;if(month(hi).profit<0)out.breakeven=null;else{for(let i=0;i<60;i++){const m=(lo+hi)/2;if(month(m).profit<0)lo=m;else hi=m;}out.breakeven=hi/30;}
  out.pLoss=(()=>{if(out.breakeven==null)return 1;if(out.breakeven<=0)return 0;const x=(Math.log(out.breakeven)-Math.log(yen))/sd;return 0.5*(1+erf(x/Math.SQRT2));})();
  // 注意点
  if(capHit>cust*0.03)out.notes.push(`混む時間に客をさばききれません（1日あたり約${Math.round(capHit)}人を逃す見込み・1時間に${T.capPerHour}人まで）。`);
  if(T.emoneyOnly)out.notes.push(`現金で払う人は買えません（1日あたり約${Math.round(lostCash)}人）。`+(emShare==null?'聞き取りをしていないので、支払い方は全国の目安です。':''));
  if(T.emoneyOnly&&!opts.ageDevice)out.notes.push('本人確認の機械がないので、酒・たばこは売れません。');
  if(T.novelty)out.notes.push(`開店してしばらくは話題で売上が上がり（はじめは見込みの約${Math.round((1+T.novelty.boost)*100)}%）、${T.novelty.halfLife}日ほどで半分ほど落ち着きます。見込みは落ち着いた後の数字です。`);
  if(T.id==='vend')out.notes.push(`1日の販売数の見込みは約${Math.round(cust)}本（設置の目安は1日8本以上）。`);
  if(T.id==='ramen'&&opts.place==='home'&&rep.dw){const m=Math.max(...rep.dw.slice(17,23));if(m<4)out.notes.push('夜のホームの待ち時間が短く（列車の間隔が短い）、食べていく時間のある人が少なめです。');}
  out.notes.push(...(T.assume?[`仮の数字：${T.assume}`]:[]));
  return out;}
function erf(x){const t=1/(1+0.3275911*Math.abs(x)),y=1-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-0.284496736)*t+0.254829592)*t*Math.exp(-x*x);return x>=0?y:-y;}

root.ResearchCore={H,footfall,dwellOf,dayRecord,soFar,aggregate,estimate,hash,rng};
})(typeof window!=='undefined'?window:globalThis);
