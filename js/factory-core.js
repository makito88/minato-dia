/* =====================================================================
   おにぎり工場（試作）の計算の中心
   ・米のラインの一晩を1分ずつ進める：洗米 → 浸漬 → 炊飯 → 蒸らし →（釜で待ち）→ 冷却 → 待ち → 成形 → 冷蔵
   ・成形・包装は1本のライン：成形機 → 具入れ（人）→ 包装機 → ラベル → 検品 → 急冷 → 番重（店ごと）。
     具は決めた順に1種類ずつ作る（検品を通った数が注文に届いたら次の具へ）。ご飯は待っている釜から順に使う。
     雫の具には雫の米（新田の棚田米）の釜が要る。具を替えるたびに掃除で止まり、包装機はときどき詰まり、検品ではじいた分は出荷しない
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
const ST_LABEL={0:'まだ',1:'洗米',2:'浸漬',3:'炊飯',4:'蒸らし',5:'釜で待ち',6:'冷却',7:'待ち',8:'成形・包装',9:'冷蔵',[-1]:'取りやめ'};
/* ラインの状態（1分ごと） */
const LN={RUN:0,IDLE:1,CHANGE:2,JAM:3,METAL:4};
const LN_LABEL={0:'動いている',1:'米を待っている',2:'具の切り替え（掃除）',3:'包装機の詰まり',4:'異物の確認'};

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
/* ラインの速さ：機械（成形機・包装機）の上限と、具入れの人の手（疲れる）の小さいほう */
function lineCap(D){const L=D.packLine;return L?Math.min(L.formMachine,L.wrapMachine):D.form.maxRate;}
function formRate(D,crew,t){return Math.min(lineCap(D),D.form.perPerson*crew*fatigue(D,t));}
/* 具の切り替えの掃除（分）。薄い→濃いは短く、濃い→薄いは長い */
function washMin(D,from,to){const F=D.packLine.fillings;const a=F.findIndex(f=>f.id===from),b=F.findIndex(f=>f.id===to);return b>a?D.packLine.wash.up:D.packLine.wash.down;}
/* 具を作る順番 */
function fillOrder(D,rule){const F=D.packLine.fillings.slice();
  if(rule==='big')F.sort((a,b)=>b.share-a.share);               // 注文の多い順
  else if(rule==='nitta')F.sort((a,b)=>(b.brand?1:0)-(a.brand?1:0)); // 雫の具を先にまとめて（あとは薄い順）
  return F.map(f=>f.id);}                                         // light：薄い味から濃い味へ
/* 具ごとの本当の注文（20:00に分かる）。合計は actualOrder のまわりでばらつく */
function fillOrders(D,seed,season){const total=actualOrder(D,seed,season);const r=rng((seed*15485863+({winter:1,mid:2,summer:3}[season]||0)*31)>>>0);
  const out={};for(const f of D.packLine.fillings)out[f.id]=Math.max(0,Math.round(total*f.share*(1+D.packLine.orderSd*gauss(r))/10)*10);return out;}
/* 米の種類：雫の具は雫の米（n）、ほかはふつうの米（r） */
function riceKind(D,id){const f=D.packLine.fillings.find(x=>x.id===id);return f&&f.brand?'n':'r';}
/* 夕方に仕込む釜の並び：具を作る順に、要る米の種類の釜を並べる（見込みと予備で数える） */
function riceSeq(D,n,seq){const F={};D.packLine.fillings.forEach(f=>F[f.id]=f);const sp=1+D.packLine.spare;
  const u={n:0,r:0};for(const id of seq)u[riceKind(D,id)]+=D.forecast*F[id].share*sp;
  const cnt={n:u.n?Math.max(1,Math.round(n*u.n/(u.n+u.r))):0};cnt.r=Math.max(0,n-cnt.n);
  const out=[],emitted={n:0,r:0},cum={n:0,r:0};
  for(const id of seq){const k=riceKind(D,id);if(!u[k])continue;cum[k]+=D.forecast*F[id].share*sp*cnt[k]/u[k];
    while(emitted[k]<cnt[k]&&emitted[k]<Math.round(cum[k])){out.push(k);emitted[k]++;}}
  for(const k of ['r','n'])while(emitted[k]<cnt[k]){out.push(k);emitted[k]++;}
  return out;}
/* その夜の本当の注文（20:00に分かる） */
function actualOrder(D,seed,season){const r=rng((seed*7919+({winter:1,mid:2,summer:3}[season]||0))>>>0);
  return Math.max(D.batchUnits,Math.round(D.forecast*(1+D.forecastSd*gauss(r))/10)*10);}

function hm(t){t=Math.round(t);const h=Math.floor(t/60)%24,m=t%60;return h+':'+String(m).padStart(2,'0');}

function simulate(D,cfgIn){
  const cfg=Object.assign({},D.defaults,cfgIn||{});
  const S=D.seasons[cfg.season]||D.seasons.mid;
  const T0=D.start,T1=D.end,N=T1-T0+1;
  const tauW=tau(D,S.water);
  const PL=D.packLine;const FILL={};PL.fillings.forEach(f=>FILL[f.id]=f);
  const fo=fillOrders(D,cfg.seed,cfg.season);const order=Object.values(fo).reduce((a,b)=>a+b,0);
  const seq=fillOrder(D,cfg.order);
  const ev=[];const log=(t,k,msg,b)=>ev.push({t,k,msg,b:b==null?null:b});

  const batches=[];
  function addBatch(late,kind){const id=batches.length;
    const b={id,no:id+1,late:!!late,kind,parts:{},partsBy:{},leftover:0,st:ST.WAIT,T:S.room,f:0,g:null,
      tWash:null,tSoak:null,tCook:null,tSteam:null,tPotWait:null,tCool:null,tHold:null,tForm:null,tDone:null,tCancel:null,
      soakMin:0,potWait:0,coolMin:0,holdMin:0,left:D.batchUnits,made:0,madeBy:0,formed:0,rej:{weight:0,wrap:0,metal:0},tExpire:null,
      gAtCheck:null,score:null,rank:null,why:[],
      hs:new Int8Array(N).fill(ST.WAIT),hT:new Float32Array(N),hf:new Float32Array(N),hg:new Float32Array(N).fill(-1)};
    batches.push(b);return b;}
  for(const k of riceSeq(D,cfg.batches,seq))addBatch(false,k);

  let washing=null,washEnd=0;
  const tanks=[];            // 浸しているバッチ（順番どおり）
  const pots=new Array(D.cook.pots).fill(null); // 釜に入っているバッチ
  const cooler=[];           // 冷却中
  const hold=[];             // 成形を待つ
  let onLine=null;           // 成形中
  const agg={made:new Float32Array(N),rate:new Float32Array(N),inCool:new Int8Array(N),line:new Int8Array(N),rej:new Float32Array(N),formed:new Float32Array(N),fill:new Int8Array(N).fill(-1),got:new Float32Array(N),tgt:new Float32Array(N)};
  // ラインの出来事は、夜の番号と季節で決まる（条件を変えても、同じ時刻に同じくじを引く）
  const rl=rng((cfg.seed*104729+({winter:1,mid:2,summer:3}[cfg.season]||0)*7)>>>0);
  const jamRoll=new Float32Array(N).map(()=>rl());const jamLen=new Int8Array(N).map(()=>PL.jam.min[0]+Math.floor(rl()*(PL.jam.min[1]-PL.jam.min[0]+1)));
  const metalAt=rl()<PL.metal.perNight?T0+240+Math.floor(rl()*300):null;let metalDone=false;
  let stop=null,curFill=null,jamEnd=-99,formedAll=0,rejAll=0,settleLeft=0,planDone=null,riceLeft=0;const stops=[];
  const plan=seq.slice();let pi=0;const got={};for(const id of seq)got[id]=0;
  const tgt=(id,t)=>t<D.orderConfirm?D.forecast*FILL[id].share:fo[id];
  const deferred=new Set(),downgraded=new Set();
  const kindName=k=>k==='n'?'雫の米':'ふつうの米';
  // 雫の米の釜を、ふつうの具に回してよいか：この先の雫の具に要る分（予備こみ）を、ほかの雫の釜でまかなえるなら回す
  const nSpare=(b,t)=>{const ids=[...new Set(plan.slice(pi))].filter(id=>riceKind(D,id)==='n');
    const need=ids.reduce((a,id)=>a+Math.max(0,tgt(id,t)-got[id]),0)*(1+PL.spare);
    const have=batches.filter(x=>x!==b&&x.kind==='n'&&x.st!==ST.CANCEL&&x.st!==ST.DONE).reduce((a,x)=>a+x.left,0);return have>=need;};
  let made=0,coolYen=0;
  const wait={wash:0,tank:0,pot:0,hold:0};const rejT={weight:0,wrap:0,metal:0};
  let firstForm=null,lastDone=null,flaggedWarn=new Set();
  let coolBusyLogged=false,potBusyLogged=false;

  log(T0,'info',`${S.label}の夜。水温${S.water}℃、部屋${S.room}℃。この水温だと吸水に${soakNeed(D,S.water)}分ほどかかります。`);
  log(T0,'info',`見込みは${D.forecast.toLocaleString()}個（${cfg.batches}釜を仕込む予定）。本当の注文は${hm(D.orderConfirm)}に届きます。`);

  for(let i=0;i<N;i++){const t=T0+i;
    /* 注文の確定 */
    if(t===D.orderConfirm){
      const need=Math.ceil(order/D.batchUnits);
      const live=batches.filter(b=>b.st!==ST.CANCEL);
      log(t,'order',`注文が確定：${order.toLocaleString()}個。見込みより${order>=D.forecast?'+':''}${(order-D.forecast).toLocaleString()}個（${seq.map(id=>FILL[id].name+fo[id]).join('・')}）。`);
      const msg=[];
      for(const k of ['r','n']){let u=0;for(const id of seq)if(riceKind(D,id)===k)u+=fo[id];if(!u&&!batches.some(b=>b.kind===k))continue;
        const need=Math.ceil(u*(1+PL.spare)/D.batchUnits);const mine=batches.filter(b=>b.kind===k&&b.st!==ST.CANCEL);
        if(mine.length<need){for(let j=mine.length;j<need;j++)addBatch(true,k);msg.push(`${kindName(k)}を${need-mine.length}釜追加で洗います（列の最後に並ぶので遅くなります）`);}
        else if(mine.length>need){let extra=mine.length-need,c=0;
          for(let j=mine.length-1;j>=0&&extra>0;j--){const b=mine[j];if(b.st===ST.WAIT){b.st=ST.CANCEL;b.tCancel=t;extra--;c++;}}
          if(c)msg.push(`まだ洗っていない${kindName(k)}の${c}釜を取りやめました`);if(extra>0)msg.push(`すでに洗った${kindName(k)}が${extra}釜分多く、余りが出そうです`);}}
      for(let j=0;j<pi;j++){const id=plan[j];if(got[id]<fo[id]-1e-6&&!plan.slice(pi).includes(id)){plan.push(id);msg.push(`${FILL[id].name}は見込みの分を作り終えていたので、足りない分を最後に作ります`);}}
      for(const m of msg)log(t,'order',m+'。');
    }

    /* 成形・包装のライン（下流から先に進めて、場所を空ける）
       成形機 → 具入れ（人）→ 包装機 → ラベル → 検品（重さ・金属・包み）→ 急冷 → 番重 */
    let rate=0,code=LN.IDLE,formedNow=0;
    const finish=(b)=>{b.st=ST.DONE;b.tDone=t;b.tExpire=t+PL.labelHours*60;lastDone=t;judge(b,t);};
    const toFeed=(b)=>{riceLeft+=b.left;b.leftover=b.left;b.left=0;};
    if(stop&&t>=stop.until){if(stop.code===LN.CHANGE){curFill=stop.to;settleLeft=PL.settle.units;}if(stop.code===LN.JAM)jamEnd=t;stop=null;}
    const feedHold=()=>{let n=0,u=0;while(hold.length){const b=hold.shift();u+=b.left;n++;toFeed(b);if(b.formed>0)finish(b);else{b.st=ST.CANCEL;b.tCancel=t;}}return [n,u];};
    if(planDone!=null)feedHold();
    else if(!stop){
      while(pi<plan.length&&got[plan[pi]]>=tgt(plan[pi],t)-1e-6)pi++;
      if(pi>=plan.length&&t>=D.orderConfirm){planDone=t;
        let n=0,u=0;if(onLine){u+=onLine.left;n++;toFeed(onLine);finish(onLine);onLine=null;}
        {const [n2,u2]=feedHold();n+=n2;u+=u2;}
        let w=0;for(const b of batches)if(b.st===ST.WAIT){b.st=ST.CANCEL;b.tCancel=t;w++;}
        log(t,'info',`注文の分が全部そろいました。${n?`残ったご飯（${n}釜・${Math.round(u)}個分）は飼料へ。`:''}${w?`まだ洗っていない${w}釜は取りやめ。`:''}`);}
      else if(pi<plan.length){const want=plan[pi];
        if(curFill==null){curFill=want;settleLeft=PL.settle.units;}
        else if(curFill!==want){const m=washMin(D,curFill,want);stop={code:LN.CHANGE,t0:t,until:t+m,from:curFill,to:want};stops.push(stop);
          log(t,'line',`具の切り替え：${FILL[curFill].name}→${FILL[want].name}。${m===PL.wash.up?'薄い味から濃い味へなので、軽く拭いて':'濃い味から薄い味へ戻るので、全部洗って'}${m}分止まります。`);}}}
    if(!stop&&planDone==null&&pi<plan.length&&curFill===plan[pi]){
      const k=riceKind(D,curFill);
      if(onLine&&onLine.left<=1e-6){finish(onLine);onLine=null;}
      // 種類の合わない米の残りは待ちへ戻す（ふつうの米は雫の具に使えない。雫の米は、この先の雫の具に要るなら取っておく）
      if(onLine&&onLine.kind!==k&&(k==='n'||!nSpare(onLine,t))){onLine.st=ST.HOLD;hold.unshift(onLine);onLine=null;}
      if(!onLine){let j=hold.findIndex(b=>b.kind===k);
        if(j<0&&k==='r')j=hold.findIndex(b=>b.kind==='n'&&nSpare(b,t)); // 余る雫の米は、ふつうの具に回す
        if(j>=0){onLine=hold.splice(j,1)[0];onLine.st=ST.FORM;if(onLine.tForm==null)onLine.tForm=t;
          if(onLine.kind!==k&&!downgraded.has(onLine.id)){downgraded.add(onLine.id);log(t,'line',`雫の米（釜${onLine.no}）がこの先の雫の具より多いので、${FILL[curFill].name}に使います。`,onLine.id);}
          if(firstForm==null){firstForm=t;log(t,'info',`最初の釜（${onLine.no}）の成形が始まりました。具は${FILL[curFill].name}から。`);}}
        else{const soon=batches.some(b=>b.kind===k&&(b.st===ST.COOK||b.st===ST.STEAM||b.st===ST.POT||b.st===ST.COOL));
          const others=plan.slice(pi+1).some(id=>id!==curFill);
          if(!soon&&others&&!deferred.has(curFill)&&t>=D.orderConfirm){deferred.add(curFill);const id=plan.splice(pi,1)[0];plan.push(id);
            log(t,'warn',`${FILL[id].name}に使う${kindName(k)}がすぐには炊き上がらないので、${FILL[id].name}の残りを後回しにします。`);}}}
      if(onLine){code=LN.RUN;const b=onLine;rate=formRate(D,cfg.crew,t);
        const r0=PL.weightReject+PL.wrapReject+(t-jamEnd<PL.jam.after?PL.jam.afterReject:0);
        const need=Math.max(0,tgt(curFill,t)-got[curFill]);
        const n=Math.min(b.left,rate,need/(1-r0)+0.01);
        let rw=n*PL.weightReject,rp=n*PL.wrapReject,rm=0;
        if(settleLeft>0){const q=Math.min(n,settleLeft);rw+=q*PL.settle.reject;settleLeft-=q;}
        if(t-jamEnd<PL.jam.after)rp+=n*PL.jam.afterReject;
        if(metalAt!=null&&!metalDone&&t>=metalAt){metalDone=true;rm=n-rw-rp;
          stop={code:LN.METAL,t0:t+1,until:t+1+PL.metal.stop};stops.push(stop);
          log(t,'bad',`検品の金属の反応（${FILL[curFill].name}・釜${b.no}）。この1分の${Math.round(n)}個をはじき、ラインを${PL.metal.stop}分止めて確かめます。`,b.id);}
        const good=n-rw-rp-rm;
        b.left-=n;b.formed+=n;b.made+=good;made+=good;formedAll+=n;formedNow=n;got[curFill]+=good;
        b.parts[curFill]=(b.parts[curFill]||0)+good;if(t<D.deadline){b.madeBy+=good;b.partsBy[curFill]=(b.partsBy[curFill]||0)+good;}
        b.rej.weight+=rw;b.rej.wrap+=rp;b.rej.metal+=rm;rejT.weight+=rw;rejT.wrap+=rp;rejT.metal+=rm;rejAll+=rw+rp+rm;
        b.T+=(S.room-b.T)*D.hold.k;
        if(b.left<=1e-6){finish(b);onLine=null;}
        if(!stop&&jamRoll[i]<PL.jam.perMin){const m=jamLen[i];stop={code:LN.JAM,t0:t+1,until:t+1+m};stops.push(stop);
          log(t+1,'line',`包装機が詰まりました。フィルムを直して${m}分後に動かします（直したあと少しのあいだ、包みの崩れがふえます）。`);}}}
    else if(stop&&onLine){onLine.T+=(S.room-onLine.T)*D.hold.k;}
    if(stop&&t>=stop.t0)code=stop.code;else if(planDone!=null)code=LN.IDLE;
    agg.rate[i]=formedNow;agg.line[i]=code;
    if(curFill!=null&&planDone==null){agg.fill[i]=PL.fillings.findIndex(f=>f.id===curFill);agg.got[i]=got[curFill];agg.tgt[i]=tgt(curFill,t);}
    /* 待ち */
    for(const b of hold){b.holdMin++;wait.hold++;b.T+=(S.room-b.T)*D.hold.k;}
    /* 冷却 */
    {const n=cooler.length;if(n){const k=D.cool.k[cfg.fan]/(1+D.cool.loadPenalty*(n-1));coolYen+=D.cool.yenPerMin[cfg.fan];
      for(let j=cooler.length-1;j>=0;j--){const b=cooler[j];b.coolMin++;b.T+=(S.coolAir-b.T)*k;
        if(b.T<=D.cool.target){cooler.splice(j,1);b.st=ST.HOLD;b.tHold=t;hold.push(b);}}
      hold.sort((a,b)=>a.tHold-b.tHold||a.id-b.id);}
      agg.inCool[i]=cooler.length;}
    /* 釜：炊飯 → 蒸らし → 冷却へ（満杯なら釜で待つ）。冷却へは炊き上がった順に送る */
    const readyPots=[];
    for(let p=0;p<pots.length;p++){const b=pots[p];if(!b)continue;
      if(b.st===ST.COOK){b.T=Math.min(D.cook.temp,b.T+6);if(t-b.tCook>=D.cook.min){b.st=ST.STEAM;b.tSteam=t;b.T=D.cook.temp;b.g=D.germ.init;}}
      else if(b.st===ST.POT||(b.st===ST.STEAM&&t-b.tSteam>=D.cook.steam))readyPots.push(p);}
    readyPots.sort((x,y)=>pots[x].tSteam-pots[y].tSteam||pots[x].id-pots[y].id);
    for(const p of readyPots){const b=pots[p];
      if(cooler.length<D.cool.slots){pots[p]=null;b.st=ST.COOL;b.tCool=t;cooler.push(b);}
      else{if(b.st!==ST.POT){b.st=ST.POT;b.tPotWait=t;}b.potWait++;wait.pot++;b.T+=(D.potHold.temp-b.T)*0.2;
        if(!coolBusyLogged&&b.potWait>=10){coolBusyLogged=true;log(t,'warn',`冷却がいっぱいで、炊き上がった釜（${b.no}）が10分待っています。釜が空かないので、次の米が炊けません。`,b.id);}}}
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
    agg.made[i]=made;agg.rej[i]=rejAll;agg.formed[i]=formedAll;
    for(const [st,lab,note] of (D.ship.steps||[])){if(st===t&&!(st===D.deadline&&lab!=='包装の締め切り'))log(t,'ship',st===D.deadline?`${hm(t)}、包装の締め切り。ここまでの${Math.floor(made).toLocaleString()}個から、検品を通った分を${D.ship.via}へ送ります。`:`${hm(t)}、${lab}。${note}。`);}
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
  const fills={};for(const id of seq)fills[id]={id,name:FILL[id].name,brand:FILL[id].brand||null,order:fo[id],good:0,late:0};
  for(const b of batches){if(b.st===ST.DONE)ranks[b.rank]++;
    if(b.st===ST.DONE&&b.rank==='×'){bad+=b.made;continue;}
    for(const id in b.parts){fills[id].good+=b.partsBy[id]||0;fills[id].late+=b.parts[id]-(b.partsBy[id]||0);}}
  let shipped=0,surplus=0,late=0;
  for(const id of seq){const f=fills[id];f.good=Math.floor(f.good+1e-6);f.late=Math.floor(f.late+1e-6);f.shipped=Math.min(f.order,f.good);f.short=f.order-f.shipped;
    f.surplus=f.good-f.shipped;f.lateUse=Math.min(f.short,f.late);f.unmade=f.short-f.lateUse;
    shipped+=f.shipped;surplus+=f.surplus;late+=f.lateUse;unfinished+=f.unmade;}
  const short=order-shipped;
  /* 店ごとの番重（センターで店ごとに分ける） */
  const stores=PL.stores.map(([name,share])=>({name,units:0,crates:0,share}));
  {let left=shipped;stores.forEach((st,k)=>{st.units=k===stores.length-1?left:Math.round(shipped*st.share);left-=st.units;st.crates=Math.ceil(st.units/PL.crate);});}
  const lineStops={};for(const k of [LN.CHANGE,LN.JAM,LN.METAL]){const xs=stops.filter(x=>x.code===k);lineStops[k]={n:xs.length,min:xs.reduce((a,x)=>a+Math.min(x.until,T1)-x.t0,0)};}
  /* 費用（仮） */
  const C=D.cost;let labor=0;
  const endWork=Math.max(lastDone||T1,T0+60);
  for(let t=cfg.start;t<endWork;t++){const r=(t>=C.nightFrom?C.nightRate:1)*C.wage/60;labor+=r*(cfg.crew+C.fixedStaff);}
  const rice=batches.filter(b=>b.tWash!=null).length*D.riceKg*C.ricePerKg;
  const other=formedAll*C.otherPerUnit;
  const total=Math.round(labor+rice+other+coolYen);
  const waits=[['洗米がタンクの空きを待つ',wait.wash],['浸し終わった米が釜を待つ',wait.tank],['炊けた米が冷却を待つ（釜で）',wait.pot],['冷めた米が成形・包装を待つ',wait.hold]];
  const neck=waits.slice().sort((a,b)=>b[1]-a[1])[0];
  const gMax=Math.max(0,...live.filter(b=>b.gAtCheck!=null).map(b=>b.gAtCheck));
  const summary={order,forecast:D.forecast,planned:cfg.batches,batches:batches.filter(b=>b.tWash!=null).length,shipped,short,surplus:Math.max(0,surplus)+Math.round(riceLeft),riceLeft:Math.round(riceLeft),planDone,late,bad:Math.round(bad),unfinished:Math.round(unfinished),
    fills:seq.map(id=>fills[id]),stores,crates:stores.reduce((a,x)=>a+x.crates,0),rej:{weight:Math.round(rejT.weight),wrap:Math.round(rejT.wrap),metal:Math.round(rejT.metal),all:Math.round(rejAll)},lineStops,
    ranks,firstForm,lastDone,gMax,waits,neck,soakNeed:soakNeed(D,S.water),
    yen:{labor:Math.round(labor),rice,other:Math.round(other),cool:coolYen,total,perUnit:shipped?Math.round(total/shipped):null}};
  if(lastDone!=null)log(lastDone,'info',`最後の釜の成形が終わりました（${hm(lastDone)}）。`);
  ev.sort((a,b)=>a.t-b.t);
  return {cfg,season:S,T0,T1,N,batches,agg,ev,summary,tauW,stops};
}

root.FactoryCore={ST,ST_LABEL,LN,LN_LABEL,simulate,tau,soakNeed,mu,fatigue,formRate,lineCap,washMin,fillOrder,riceKind,actualOrder,hm};
})(typeof window!=='undefined'?window:globalThis);
