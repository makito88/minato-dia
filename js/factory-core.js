/* =====================================================================
   おにぎり工場（試作）の計算の中心
   ・米のラインの一晩を1分ずつ進める：洗米 → 浸漬 → 炊飯 → 蒸らし →（釜で待ち）→ 冷却 → 待ち → 成形 → 冷蔵
   ・材料・人・菌にそれぞれの時計がある：
       吸水（水温で速さが変わる）、温度（ニュートンの冷却）、菌（10〜52℃で増える）、人の疲れ（3時ごろ）
   ・釜の数・冷却の場所・成形の速さに限りがあり、詰まりは前の工程へ逆流する
     （冷却が満杯 → 釜が空かない → タンクで浸しすぎる → 洗米が待つ）
   ・注文は20:00に確定する。それより前は見込みで仕込む。
   ・同じ種（seed）なら同じ注文になるので、条件を1つ変えて同じ夜を計算し直し、差を見られる。
   ・DOM を使わない。設定は data/factory.json。数字はすべてゲームの仮の目安。
   ===================================================================== */
(function(root){
'use strict';

const ST={WAIT:0,WASH:1,SOAK:2,COOK:3,STEAM:4,POT:5,COOL:6,HOLD:7,FORM:8,DONE:9,CANCEL:-1};
const ST_LABEL={0:'まだ',1:'洗米',2:'浸漬',3:'炊飯',4:'蒸らし',5:'釜で待ち',6:'冷却',7:'待ち',8:'成形',9:'冷蔵',[-1]:'取りやめ'};

function rng(seed){let a=seed>>>0;return function(){a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
function gauss(r){let u=0,v=0;while(u===0)u=r();while(v===0)v=r();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);}
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));

/* 吸水の速さ τ（分）。水温が10℃下がるごとに q10 倍かかる */
function tau(D,water){return D.soak.tau20*Math.pow(D.soak.q10,(20-water)/10);}
/* 吸水の割合が good になるまでの分 */
function soakNeed(D,water){return Math.ceil(-Math.log(1-D.soak.good)*tau(D,water));}
/* 菌の増える速さ（log10／時）。ラトコフスキー型の形で、37℃が最大、52℃で0 */
function mu(D,T){const g=D.germ;if(T<=g.tmin||T>=g.tmax)return 0;
  if(T<=g.topt){const x=(T-g.tmin)/(g.topt-g.tmin);return g.muOpt*x*x;}
  return g.muOpt*(g.tmax-T)/(g.tmax-g.topt);}
/* 人の疲れ：成形の速さにかける倍率 */
function fatigue(D,t){const f=D.form.fatigue;const z=(t-f.center)/f.width;return 1-f.drop*Math.exp(-z*z);}
function formRate(D,crew,t){return Math.min(D.form.maxRate,D.form.perPerson*crew)*fatigue(D,t);}
/* その夜の本当の注文（20:00に分かる） */
function actualOrder(D,seed,season){const r=rng((seed*7919+({winter:1,mid:2,summer:3}[season]||0))>>>0);
  return Math.max(D.batchUnits,Math.round(D.forecast*(1+D.forecastSd*gauss(r))/10)*10);}

function hm(t){t=Math.round(t);const h=Math.floor(t/60)%24,m=t%60;return h+':'+String(m).padStart(2,'0');}

function simulate(D,cfgIn){
  const cfg=Object.assign({},D.defaults,cfgIn||{});
  const S=D.seasons[cfg.season]||D.seasons.mid;
  const T0=D.start,T1=D.end,N=T1-T0+1;
  const tauW=tau(D,S.water);
  const order=actualOrder(D,cfg.seed,cfg.season);
  const ev=[];const log=(t,k,msg,b)=>ev.push({t,k,msg,b:b==null?null:b});

  const batches=[];
  function addBatch(late){const id=batches.length;
    const b={id,no:id+1,late:!!late,st:ST.WAIT,T:S.room,f:0,g:null,
      tWash:null,tSoak:null,tCook:null,tSteam:null,tPotWait:null,tCool:null,tHold:null,tForm:null,tDone:null,tCancel:null,
      soakMin:0,potWait:0,coolMin:0,holdMin:0,left:D.batchUnits,made:0,madeBy:0,
      gAtCheck:null,score:null,rank:null,why:[],
      hs:new Int8Array(N).fill(ST.WAIT),hT:new Float32Array(N),hf:new Float32Array(N),hg:new Float32Array(N).fill(-1)};
    batches.push(b);return b;}
  for(let i=0;i<cfg.batches;i++)addBatch(false);

  let washing=null,washEnd=0;
  const tanks=[];            // 浸しているバッチ（順番どおり）
  const pots=new Array(D.cook.pots).fill(null); // 釜に入っているバッチ
  const cooler=[];           // 冷却中
  const hold=[];             // 成形を待つ
  let onLine=null;           // 成形中
  const agg={made:new Float32Array(N),rate:new Float32Array(N),inCool:new Int8Array(N)};
  let made=0,coolYen=0;
  const wait={wash:0,tank:0,pot:0,hold:0};
  let firstForm=null,lastDone=null,flaggedWarn=new Set();
  let coolBusyLogged=false,potBusyLogged=false;

  log(T0,'info',`${S.label}の夜。水温${S.water}℃、部屋${S.room}℃。この水温だと吸水に${soakNeed(D,S.water)}分ほどかかります。`);
  log(T0,'info',`見込みは${D.forecast.toLocaleString()}個（${cfg.batches}釜を仕込む予定）。本当の注文は${hm(D.orderConfirm)}に届きます。`);

  for(let i=0;i<N;i++){const t=T0+i;
    /* 注文の確定 */
    if(t===D.orderConfirm){
      const need=Math.ceil(order/D.batchUnits);
      const live=batches.filter(b=>b.st!==ST.CANCEL);
      log(t,'order',`注文が確定：${order.toLocaleString()}個（${need}釜分）。見込みより${order>=D.forecast?'+':''}${(order-D.forecast).toLocaleString()}個。`);
      if(live.length<need){const add=need-live.length;for(let k=0;k<add;k++)addBatch(true);
        log(t,'order',`${add}釜を追加で洗います（列の最後に並ぶので遅くなります）。`);}
      else if(live.length>need){let extra=live.length-need,c=0;
        for(let k=batches.length-1;k>=0&&extra>0;k--){const b=batches[k];if(b.st===ST.WAIT){b.st=ST.CANCEL;b.tCancel=t;extra--;c++;}}
        if(c)log(t,'order',`まだ洗っていない${c}釜を取りやめました。`);
        if(extra>0)log(t,'warn',`すでに洗った米が${extra}釜分多く、余りが出そうです。`);}
    }

    /* 成形（下流から先に進めて、場所を空ける） */
    const rate=formRate(D,cfg.crew,t);agg.rate[i]=rate;
    if(!onLine&&hold.length){onLine=hold.shift();onLine.st=ST.FORM;onLine.tForm=t;if(firstForm==null){firstForm=t;log(t,'info',`最初の釜（${onLine.no}）の成形が始まりました。`);}}
    if(onLine){const b=onLine;const n=Math.min(b.left,rate);b.left-=n;b.made+=n;made+=n;if(t<D.deadline)b.madeBy+=n;
      b.T+=(S.room-b.T)*D.hold.k;
      if(b.left<=1e-6){b.st=ST.DONE;b.tDone=t;lastDone=t;judge(b,t);onLine=null;
        if(hold.length){onLine=hold.shift();onLine.st=ST.FORM;onLine.tForm=t;}}}
    /* 待ち */
    for(const b of hold){b.holdMin++;wait.hold++;b.T+=(S.room-b.T)*D.hold.k;}
    /* 冷却 */
    {const n=cooler.length;if(n){const k=D.cool.k[cfg.fan]/(1+D.cool.loadPenalty*(n-1));coolYen+=D.cool.yenPerMin[cfg.fan];
      for(let j=cooler.length-1;j>=0;j--){const b=cooler[j];b.coolMin++;b.T+=(S.coolAir-b.T)*k;
        if(b.T<=D.cool.target){cooler.splice(j,1);b.st=ST.HOLD;b.tHold=t;hold.push(b);}}
      hold.sort((a,b)=>a.tHold-b.tHold||a.id-b.id);}
      agg.inCool[i]=cooler.length;}
    /* 釜：炊飯 → 蒸らし → 冷却へ（満杯なら釜で待つ） */
    for(let p=0;p<pots.length;p++){const b=pots[p];if(!b)continue;
      if(b.st===ST.COOK){b.T=Math.min(D.cook.temp,b.T+6);if(t-b.tCook>=D.cook.min){b.st=ST.STEAM;b.tSteam=t;b.T=D.cook.temp;b.g=D.germ.init;}}
      else if(b.st===ST.STEAM||b.st===ST.POT){
        const ready=b.st===ST.POT||t-b.tSteam>=D.cook.steam;
        if(ready){if(cooler.length<D.cool.slots){pots[p]=null;b.st=ST.COOL;b.tCool=t;cooler.push(b);}
          else{if(b.st!==ST.POT){b.st=ST.POT;b.tPotWait=t;}b.potWait++;wait.pot++;b.T+=(D.potHold.temp-b.T)*0.2;
            if(!coolBusyLogged&&b.potWait>=10){coolBusyLogged=true;log(t,'warn',`冷却がいっぱいで、炊き上がった釜（${b.no}）が10分待っています。釜が空かないので、次の米が炊けません。`,b.id);}}}}}
    /* 浸漬 → 空いた釜へ（浸した順） */
    for(const b of tanks){b.soakMin++;b.f=1-Math.exp(-b.soakMin/tauW);
      if(b.soakMin>cfg.soak)wait.tank++;}
    for(let p=0;p<pots.length;p++){if(pots[p])continue;
      const j=tanks.findIndex(b=>b.soakMin>=cfg.soak);if(j<0)break;
      const b=tanks.splice(j,1)[0];b.st=ST.COOK;b.tCook=t;pots[p]=b;b.pot=p;b.T=S.water;}
    if(!potBusyLogged&&tanks.length>=D.soak.tanks&&tanks.every(b=>b.soakMin>=cfg.soak)){potBusyLogged=true;
      log(t,'warn',`タンクが全部ふさがり、どの米も浸し終わっているのに釜が空きません。浸す時間が延びていきます。`);}
    /* 洗米 → タンク */
    if(washing&&t>=washEnd){const b=washing;washing=null;b.st=ST.SOAK;b.tSoak=t;b.T=S.water;tanks.push(b);}
    if(!washing&&t>=cfg.start){const next=batches.find(b=>b.st===ST.WAIT);
      if(next){if(tanks.length<D.soak.tanks){washing=next;next.st=ST.WASH;next.tWash=t;washEnd=t+D.wash.min;}else wait.wash++;}}

    /* 菌（炊いたあと） */
    for(const b of batches){if(b.g!=null&&b.st!==ST.CANCEL){
      if(b.st===ST.DONE){b.T+=(D.pack.chill-b.T)*D.pack.k;}
      b.g+=mu(D,b.T)/60;
      if(b.st!==ST.DONE&&b.g>=D.germ.warn&&!flaggedWarn.has(b.id)){flaggedWarn.add(b.id);log(t,'germ',`釜${b.no}：菌の目安が注意の線（${D.germ.warn}）をこえました（${ST_LABEL[b.st]}、${b.T.toFixed(0)}℃）。`,b.id);}}}
    /* 記録 */
    for(const b of batches){b.hs[i]=b.st;b.hT[i]=b.T;b.hf[i]=b.f;b.hg[i]=b.g==null?-1:b.g;}
    agg.made[i]=made;
    if(t===D.deadline)log(t,'ship',`${hm(t)}、荷物列車が出ました。`);
  }

  function judge(b,t){const Q=D.quality;let s=100;const why=[];
    if(b.f<D.soak.good){const d=Math.round((D.soak.good-b.f)*Q.underSoak);s-=d;why.push([`芯が残った（吸水${Math.round(b.f*100)}%）`,-d]);}
    if(b.soakMin>D.soak.crackAfter){const d=Math.min(Q.crackCap,Math.round((b.soakMin-D.soak.crackAfter)/Q.crackPerMin));s-=d;why.push([`浸しすぎて米が割れた（${b.soakMin}分）`,-d]);}
    if(b.potWait>Q.potWaitFree){const d=Math.min(Q.potWaitCap,Math.round((b.potWait-Q.potWaitFree)/Q.potWaitPerMin));s-=d;why.push([`釜で待って蒸れすぎた（${b.potWait}分）`,-d]);}
    const dry=b.tForm-b.tSteam-D.cook.steam;
    if(dry>Q.dryFree){const d=Math.min(Q.dryCap,Math.round((dry-Q.dryFree)/Q.dryPerMin));s-=d;why.push([`炊いてから成形まで${dry}分で、乾いた`,-d]);}
    b.score=Math.max(0,s);b.rank=Q.ranks.find(r=>b.score>=r[0])[1];
    b.gAtCheck=b.g;b.why=why;
    if(b.g>=D.germ.discard){b.rank='×';why.push([`菌の目安が${b.g.toFixed(1)}（${D.germ.discard}以上は出荷しない）`,0]);b.germOut=true;}
    if(b.rank==='×')log(t,'bad',`釜${b.no}は検品で不合格（${why.map(w=>w[0]).join('・')}）。`,b.id);}

  /* 朝の答え合わせ */
  const live=batches.filter(b=>b.st!==ST.CANCEL);
  let good=0,goodLate=0,bad=0,unfinished=0;const ranks={'◎':0,'○':0,'△':0,'×':0};
  for(const b of live){if(b.st===ST.DONE){ranks[b.rank]++;
      if(b.rank==='×')bad+=D.batchUnits;else{good+=b.madeBy;goodLate+=b.made-b.madeBy;}}
    else{unfinished+=b.left;if(b.made){ // 途中まで作った分（間に合った分は出す）
        good+=b.madeBy;goodLate+=b.made-b.madeBy;}}}
  const shipped=Math.min(order,Math.floor(good));
  const surplus=Math.floor(good-shipped);const late=Math.floor(goodLate);
  const short=order-shipped;
  /* 費用（仮） */
  const C=D.cost;let labor=0;
  const endWork=Math.max(lastDone||T1,T0+60);
  for(let t=cfg.start;t<endWork;t++){const r=(t>=C.nightFrom?C.nightRate:1)*C.wage/60;labor+=r*(cfg.crew+C.fixedStaff);}
  const rice=live.filter(b=>b.tWash!=null).length*D.riceKg*C.ricePerKg;
  const other=(made)*C.otherPerUnit;
  const total=Math.round(labor+rice+other+coolYen);
  const waits=[['洗米がタンクの空きを待つ',wait.wash],['浸し終わった米が釜を待つ',wait.tank],['炊けた米が冷却を待つ（釜で）',wait.pot],['冷めた米が成形を待つ',wait.hold]];
  const neck=waits.slice().sort((a,b)=>b[1]-a[1])[0];
  const gMax=Math.max(0,...live.filter(b=>b.gAtCheck!=null).map(b=>b.gAtCheck));
  const summary={order,forecast:D.forecast,planned:cfg.batches,batches:live.length,shipped,short,surplus:Math.max(0,surplus),late,bad,unfinished:Math.round(unfinished),
    ranks,firstForm,lastDone,gMax,waits,neck,soakNeed:soakNeed(D,S.water),
    yen:{labor:Math.round(labor),rice,other:Math.round(other),cool:coolYen,total,perUnit:shipped?Math.round(total/shipped):null}};
  if(lastDone!=null)log(lastDone,'info',`最後の釜の成形が終わりました（${hm(lastDone)}）。`);
  ev.sort((a,b)=>a.t-b.t);
  return {cfg,season:S,T0,T1,N,batches,agg,ev,summary,tauW};
}

root.FactoryCore={ST,ST_LABEL,simulate,tau,soakNeed,mu,fatigue,formRate,actualOrder,hm};
})(typeof window!=='undefined'?window:globalThis);
