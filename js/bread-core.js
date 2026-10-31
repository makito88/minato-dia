/* =====================================================================
   おにぎり工場（試作）のパンのラインの計算の中心
   ・仕込み（こねる）→ 一次発酵 → 分割・丸め → ベンチタイム → 成形（人の手）→ ホイロ（二次発酵）
     → 焼成（オーブン。カレーパンはフライヤー）→ 粗熱取り → 包装、を1分ずつ進める。
   ・発酵の時計：生地は酵母が生きているので、生地の温度で膨らむ速さが変わり、待ってくれない。
     焼く番が来ないあいだもホイロの中で膨らみ続け、進みすぎると酸っぱく形がだれ、もっと進むとしぼむ。
     足りないまま焼くと固く重い。米の「浸しすぎ」と同じ形だが、こちらは止められない。
   ・仕込みの間隔（ミキサーが次の生地をこねるまで）が、オーブンが焼ける速さより短いと、
     ホイロに生地がたまり、膨らみすぎる。ダイヤの「間隔」と同じ見方。
   ・詰まりは前へ逆流する：粗熱取りの台がいっぱい → オーブンが空かない → ホイロがいっぱい
     → 成形した生地が部屋で待つ → 成形が止まる。一次発酵の箱がいっぱいなら、ミキサーも待つ。
   ・注文は20:00に確定する（売店の締め切り）。それより前は見込みで仕込む。
   ・DOM を使わない。設定は data/factory.json の bread。数字はすべてゲームの仮の目安。
   ===================================================================== */
(function(root){
'use strict';

const BS={WAIT:0,MIX:1,FERM:2,DIV:3,BENCH:4,SQ:5,SHAPE:6,PQ:7,PROOF:8,OQ:9,BAKE:10,COOL:11,PACKQ:12,PACK:13,DONE:14,CANCEL:-1};
const BS_LABEL={0:'まだ',1:'仕込み',2:'一次発酵',3:'分割・丸め',4:'ベンチタイム',5:'成形を待つ',6:'成形',7:'ホイロを待つ（部屋）',8:'ホイロ',9:'焼く番を待つ（ホイロの中）',10:'焼成',11:'粗熱取り',12:'包装を待つ',13:'包装',14:'包装ずみ',[-1]:'取りやめ'};

function rng(seed){let a=seed>>>0;return function(){a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
function gauss(r){let u=0,v=0;while(u===0)u=r();while(v===0)v=r();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);}
function hm(t){t=Math.round(t);const h=Math.floor(t/60)%24,m=t%60;return h+':'+String(m).padStart(2,'0');}
const sk={winter:1,mid:2,summer:3};

/* 発酵の速さ（27℃を1とした倍率）。10℃上がるごとに q10 倍。38℃をこえると弱り、50℃で止まる */
function fermRate(B,T){const F=B.ferm;if(T<=4)return 0;
  if(T<=F.top)return Math.pow(F.q10,(T-F.tref)/10);
  if(T>=F.dead)return 0;return Math.pow(F.q10,(F.top-F.tref)/10)*(F.dead-T)/(F.dead-F.top);}
/* 仕込み水の温度 ＝ こね上げの温度×3 −（粉の温度＋部屋の温度＋摩擦）。粉は部屋と同じ温度とする */
function waterFor(B,knead,room){return knead*3-(room+room+B.mix.friction);}
/* その夜の、品ごとの本当の注文（20:00に分かる） */
function orders(D,seed,season){const B=D.bread;const r=rng((seed*2654435+(sk[season]||0)*97)>>>0);
  const total=Math.max(B.batchMax,Math.round(B.forecast*(1+B.forecastSd*gauss(r))/10)*10);
  const out={};for(const p of B.products)out[p.id]=Math.max(0,Math.round(total*p.share*(1+B.orderSd*gauss(r))/10)*10);return out;}
/* 見込み（または注文）の数から、品ごとの仕込みの回数と1回の数 */
function split(B,units){if(units<=0)return [];const n=Math.ceil(units/B.batchMax);const each=Math.ceil(units/n/10)*10;const out=[];let left=units;
  for(let k=0;k<n;k++){const u=Math.min(each,Math.ceil(left/10)*10);out.push(u);left-=u;}return out.filter(u=>u>0);}
/* オーブンが1時間に焼ける生地の数（入れ出しこみ）と、仕込みの間隔から見た1時間の生地の数 */
function flow(D,cfg){const B=D.bread;const ov=B.products.filter(p=>p.bake==='oven');const avg=Math.ceil(B.batchMax/B.oven.cap)*ov.reduce((a,p)=>a+p.share*(p.min+B.oven.load),0)/ov.reduce((a,p)=>a+p.share,0);
  return {ovenPerHour:60/avg*cfg.ovens,mixPerHour:60/Math.max(cfg.interval,B.mix.min),ovenMin:avg};}

function simulate(D,cfgIn){
  const B=D.bread;const cfg=Object.assign({},B.defaults,cfgIn||{});
  const S=D.seasons[cfg.season]||D.seasons.mid;
  const T0=D.start,T1=D.end,N=T1-T0+1;
  const P={};B.products.forEach(p=>P[p.id]=p);
  const yeast=B.yeast[cfg.yeast]||B.yeast.mid;
  const od=orders(D,cfg.seed,cfg.season);const order=Object.values(od).reduce((a,b)=>a+b,0);
  const ev=[];const log=(t,k,msg,b)=>ev.push({t,k,msg,b:b==null?null:b});
  const room=S.room;
  // 消費期限は、その夜の製造に決まった期限（包装が遅れても延びない）。古い設定は包装から lifeHours 時間
  const XR=B.expiry,EXP=XR?XR.day*1440+XR.at:null;
  // こね上げの温度：仕込み水は 1〜50℃ の範囲でしか用意できない（冬の熱すぎる水・夏の氷水には限りがある）
  const wNeed=waterFor(B,cfg.knead,room);const wUse=Math.max(1,Math.min(50,wNeed));
  const knead=(wUse+room+room+B.mix.friction)/3;

  const batches=[];
  function add(prod,units,late){const id=batches.length;
    const b={id,no:id+1,prod,units,late:!!late,st:BS.WAIT,T:room,p1:0,p2:0,left:0,packed:0,packedBy:0,
      tMix:null,tFerm:null,tDiv:null,tBench:null,tSQ:null,tShape:null,tPQ:null,tProof:null,tReady:null,tBake:null,tCool:null,tCooled:null,tPack:null,tDone:null,tCancel:null,tExpire:null,
      oven:null,dev:null,wait:{tub:0,shape:0,proof:0,oven:0,cool:0,pack:0},p1Bake:null,p2Bake:null,score:null,rank:null,why:[],warned:0,
      hs:new Int8Array(N).fill(BS.WAIT),hT:new Float32Array(N),hp:new Float32Array(N)};
    batches.push(b);return b;}
  // 夕方：見込みで仕込みの並びを作る（品の並び順に、同じ品をまとめて）
  for(const p of B.products)for(const u of split(B,Math.ceil(B.forecast*p.share*(1+B.spare)/10)*10))add(p.id,u,false);

  const ovens=new Array(cfg.ovens).fill(null),fryers=new Array(B.fryer.units).fill(null);
  let mixing=null,dividing=null,shaping=null,packing=null,lastMix=-999;
  const agg={packed:new Float32Array(N),shapeRate:new Float32Array(N),inProof:new Int8Array(N),inOQ:new Int8Array(N),inCool:new Int8Array(N),ovenBusy:new Int8Array(N),maxP2:new Float32Array(N)};
  let packedAll=0,packedBy=0,ovenMin=0,fryMin=0,firstBake=null,lastDone=null,confirmed=false;
  const wait={tub:0,shape:0,proof:0,oven:0,cool:0,pack:0};
  const counts=()=>{const c={};for(const b of batches)c[b.st]=(c[b.st]||0)+1;return c;};
  const nm=b=>`${P[b.prod].name}（生地${b.no}）`;

  log(T0,'info',`${S.label}の夜。部屋${room}℃・発酵室${B.ferm.room}℃。こね上げ${cfg.knead}℃にするには仕込み水が${Math.round(wNeed)}℃。`);
  if(Math.abs(wNeed-wUse)>0.5)log(T0,'warn',`仕込み水を${Math.round(wNeed)}℃にはできないので${Math.round(wUse)}℃で仕込みます。こね上げは${knead.toFixed(1)}℃になります。`);
  {const f=flow(D,cfg);log(T0,'info',`見込みは${B.forecast.toLocaleString()}個（${batches.length}回仕込む）。ミキサーは${cfg.interval}分ごと＝1時間に${f.mixPerHour.toFixed(1)}回、オーブン${cfg.ovens}台は1時間に${f.ovenPerHour.toFixed(1)}回焼けます${f.mixPerHour>f.ovenPerHour*1.05?'（仕込みのほうが速いので、ホイロに生地がたまりそう）':''}。`);}

  /* オーブンは1回100個（200個の生地は2回に分ける）。フライヤーは流しながら1回で揚げる */
  const bakeMin=b=>{const p=P[b.prod];return p.bake==='fry'?p.min+B.oven.load:Math.ceil(b.units/B.oven.cap)*(p.min+B.oven.load);};
  // しぼんだあとは膨らまない（進みは2.0で止める）
  const accrue=(b,base)=>{const p=base===B.ferm.base1?b.p1:b.p2;if(p>=2)return 0;return Math.min(2-p,fermRate(B,b.T)*yeast.f/base);};
  for(let i=0;i<N;i++){const t=T0+i;
    /* 注文の確定（20:00） */
    if(t===D.orderConfirm){confirmed=true;const msg=[];
      log(t,'order',`注文が確定：${order.toLocaleString()}個（${B.products.map(p=>p.name+od[p.id]).join('・')}）。`);
      for(const p of B.products){const need=Math.ceil(od[p.id]*(1+B.spare)/10)*10;const mine=batches.filter(b=>b.prod===p.id&&b.st!==BS.CANCEL);
        const fixed=mine.filter(b=>b.st!==BS.WAIT).reduce((a,b)=>a+b.units,0);const open=mine.filter(b=>b.st===BS.WAIT);
        let rest=need-fixed;
        if(rest<=0){for(const b of open){b.st=BS.CANCEL;b.tCancel=t;}if(open.length)msg.push(`${p.name}はもう足りるので、まだこねていない${open.length}回を取りやめ`);if(rest<-B.batchMax/4)msg.push(`${p.name}は${-rest}個ほど多くこねてあり、余りそう`);continue;}
        const parts=split(B,rest);
        open.forEach((b,k)=>{if(k<parts.length)b.units=parts[k];else{b.st=BS.CANCEL;b.tCancel=t;}});
        if(parts.length>open.length){for(let k=open.length;k<parts.length;k++)add(p.id,parts[k],true);msg.push(`${p.name}を${parts.length-open.length}回追加で仕込みます（列の最後に並ぶので遅くなります）`);}
        else if(parts.length<open.length)msg.push(`${p.name}の仕込みを${open.length-parts.length}回取りやめ`);}
      // 追加の生地は、同じ品のあとに並べ直さず列の最後（見込みでこねる順を崩さない）
      for(const m of msg)log(t,'order',m+'。');}

    const c=counts();
    /* 包装 */
    if(packing){const b=packing;const n=Math.min(b.left,B.pack.rate);b.left-=n;
      const ok=b.rank!=='×';if(ok){b.packed+=n;packedAll+=n;if(t<D.deadline){b.packedBy+=n;packedBy+=n;}}
      if(b.left<=1e-6){b.st=BS.DONE;b.tDone=t;b.tExpire=EXP!=null?EXP:t+B.lifeHours*60;packing=null;lastDone=t;}}
    if(!packing){const q=batches.filter(b=>b.st===BS.PACKQ).sort((a,b)=>a.tCooled-b.tCooled||a.id-b.id)[0];
      if(q){packing=q;q.st=BS.PACK;q.tPack=t;q.left=q.units;
        const dry=t-q.tCooled-B.cool.dryFree;if(dry>0){const d=Math.min(B.quality.dryCap,Math.round(dry*B.quality.dryPerMin));q.score=Math.max(0,q.score-d);q.why.push([`冷めてから包装まで${t-q.tCooled}分待って乾いた`,-d]);q.rank=rankOf(q.score,q.rank==='×');}
        if(q.rank==='×'){log(t,'bad',`${nm(q)}は検品で不合格（${q.why.map(w=>w[0]).join('・')}）。包装せずに捨てます。`,q.id);q.st=BS.DONE;q.tDone=t;q.left=0;packing=null;}}}
    for(const b of batches)if(b.st===BS.PACKQ){b.wait.pack++;wait.pack++;}
    /* 粗熱取り（台の上で部屋の温度へ） */
    for(const b of batches)if(b.st===BS.COOL||b.st===BS.PACKQ){b.T+=(room-b.T)*B.cool.k;
      if(b.st===BS.COOL&&b.T<=B.cool.pack){b.st=BS.PACKQ;b.tCooled=t;}}
    /* 焼成・揚げ */
    const unload=(arr,kind)=>{for(let k=0;k<arr.length;k++){const b=arr[k];if(!b)continue;const p=P[b.prod];
      if(t-b.tBake<bakeMin(b)){b.T+=(96-b.T)*0.18;if(kind==='oven')ovenMin++;else fryMin++;continue;}
      const onRack=batches.filter(x=>x.st===BS.COOL||x.st===BS.PACKQ).length;
      if(onRack<B.cool.racks){arr[k]=null;b.st=BS.COOL;b.tCool=t;b.T=Math.max(b.T,92);}
      else{b.wait.cool++;wait.cool++;if(b.wait.cool===5)log(t,'warn',`粗熱取りの台がいっぱいで、焼けた${nm(b)}をオーブンから出せません。次の生地が焼けず、ホイロで待ちます。`,b.id);}}};
    unload(ovens,'oven');unload(fryers,'fry');
    const load=(arr,kind)=>{for(let k=0;k<arr.length;k++){if(arr[k])continue;
      const q=batches.filter(b=>b.st===BS.OQ&&P[b.prod].bake===kind).sort((a,b)=>a.tReady-b.tReady||a.id-b.id)[0];if(!q)break;
      arr[k]=q;q.st=BS.BAKE;q.tBake=t;q.oven=kind==='oven'?k:'F'+k;q.p1Bake=q.p1;q.p2Bake=q.p2;judge(q,t);
      if(firstBake==null){firstBake=t;log(t,'info',`最初の生地を焼き始めました（${nm(q)}）。`,q.id);}}};
    load(ovens,'oven');load(fryers,'fry');
    /* ホイロ（焼く番を待つあいだも、中で膨らみ続ける） */
    for(const b of batches)if(b.st===BS.PROOF||b.st===BS.OQ){b.T+=(cfg.proofT-b.T)*B.proof.k;b.p2+=accrue(b,B.ferm.base2);
      if(b.st===BS.PROOF&&t-b.tProof>=cfg.proof){b.st=BS.OQ;b.tReady=t;}
      if(b.st===BS.OQ){b.wait.oven++;wait.oven++;
        if(b.warned<1&&b.p2>B.quality.p2High){b.warned=1;log(t,'warn',`${nm(b)}が焼く番を待つあいだに膨らみすぎています（進み${b.p2.toFixed(2)}）。オーブンが空くのを待つしかありません。`,b.id);}
        if(b.warned<2&&b.p2>B.quality.collapse){b.warned=2;log(t,'bad',`${nm(b)}がしぼみました（進み${b.p2.toFixed(2)}）。焼いても出荷できません。`,b.id);}}}
    /* ホイロを待つ（部屋）→ ホイロへ */
    {const inBox=batches.filter(b=>b.st===BS.PROOF||b.st===BS.OQ).length;let free=B.proof.racks-inBox;
      for(const b of batches.filter(x=>x.st===BS.PQ).sort((a,b)=>a.tPQ-b.tPQ)){if(free<=0)break;b.st=BS.PROOF;b.tProof=t;free--;}}
    /* 成形（人の手。1つの生地ずつ） */
    let shapeNow=0;
    if(shaping){const b=shaping;const r=P[b.prod].shape*cfg.shapers;const n=Math.min(b.left,r);b.left-=n;shapeNow=n;
      if(b.left<=1e-6){b.st=BS.PQ;b.tPQ=t;shaping=null;
        const inBox=batches.filter(x=>x.st===BS.PROOF||x.st===BS.OQ).length;if(inBox<B.proof.racks){b.st=BS.PROOF;b.tProof=t;}}}
    if(!shaping){const q=batches.filter(b=>b.st===BS.SQ).sort((a,b)=>a.tSQ-b.tSQ)[0];if(q){shaping=q;q.st=BS.SHAPE;q.tShape=t;q.left=q.units;}}
    for(const b of batches)if(b.st===BS.PQ){b.wait.proof++;wait.proof++;}
    for(const b of batches)if(b.st===BS.SQ){b.wait.shape++;wait.shape++;}
    /* ベンチタイム → 成形を待つ */
    for(const b of batches)if(b.st===BS.BENCH&&t-b.tBench>=B.bench.min){b.st=BS.SQ;b.tSQ=t;}
    /* 部屋にいる生地（分割・ベンチ・成形待ち・成形・ホイロ待ち）は、部屋の温度へゆっくり近づき、二次の進みが進む */
    for(const b of batches)if([BS.DIV,BS.BENCH,BS.SQ,BS.SHAPE,BS.PQ].includes(b.st)){b.T+=(room-b.T)*B.shapeQueueK;
      if(b.st===BS.DIV)b.p1+=accrue(b,B.ferm.base1);else b.p2+=accrue(b,B.ferm.base2);}
    /* 分割・丸め */
    if(dividing){const b=dividing;b.left-=B.divide.rate;if(b.left<=1e-6){b.st=BS.BENCH;b.tBench=t;dividing=null;}}
    if(!dividing){const q=batches.filter(b=>b.st===BS.FERM&&t-b.tFerm>=cfg.ferm1).sort((a,b)=>a.tFerm-b.tFerm)[0];
      if(q){dividing=q;q.st=BS.DIV;q.tDiv=t;q.left=q.units;}}
    /* 一次発酵（発酵室の箱） */
    for(const b of batches)if(b.st===BS.FERM){b.T+=(B.ferm.room-b.T)*B.ferm.k;b.p1+=accrue(b,B.ferm.base1);
      if(t-b.tFerm>cfg.ferm1){b.wait.tub++;wait.tub++;}}
    /* 仕込み（ミキサー1台）。一次発酵の箱に空きがないと、こね始められない */
    if(mixing&&t-mixing.tMix>=B.mix.min){const b=mixing;mixing=null;b.st=BS.FERM;b.tFerm=t;b.T=knead;}
    if(!mixing&&t>=cfg.start&&t-lastMix>=cfg.interval){const next=batches.find(b=>b.st===BS.WAIT);
      if(next){const tubs=batches.filter(b=>b.st===BS.FERM||b.st===BS.DIV).length+1;
        if(tubs<=B.ferm.tubs){mixing=next;next.st=BS.MIX;next.tMix=t;lastMix=t;}}}

    /* 記録 */
    let mp=0;for(const b of batches){b.hs[i]=b.st;b.hT[i]=b.T;const v=b.st<=BS.DIV?b.p1:b.p2;b.hp[i]=b.st>=BS.BAKE?b.p2Bake||0:v;
      if((b.st===BS.PROOF||b.st===BS.OQ)&&b.p2>mp)mp=b.p2;}
    agg.packed[i]=packedAll;agg.shapeRate[i]=shapeNow;agg.maxP2[i]=mp;
    agg.inProof[i]=batches.filter(b=>b.st===BS.PROOF).length;agg.inOQ[i]=batches.filter(b=>b.st===BS.OQ).length;
    agg.inCool[i]=batches.filter(b=>b.st===BS.COOL||b.st===BS.PACKQ).length;agg.ovenBusy[i]=ovens.filter(Boolean).length;
    if(t===D.deadline)log(t,'ship',`${hm(t)}、包装の締め切り。ここまでに包んだパン${Math.floor(packedBy).toLocaleString()}個を${D.ship.via}へ送ります。`);
  }

  function rankOf(s,x){if(x)return '×';return D.quality.ranks.find(r=>s>=r[0])[1];}
  function judge(b,t){const Q=B.quality;let s=100;const why=[];
    if(b.p1<Q.p1Low){const d=Math.round((Q.p1Low-b.p1)*Q.p1LowPer);s-=d;why.push([`一次発酵が足りない（進み${b.p1.toFixed(2)}）。ふくらみが弱い`,-d]);}
    if(b.p1>Q.p1High){const d=Math.round((b.p1-Q.p1High)*Q.p1HighPer);s-=d;why.push([`一次発酵が進みすぎ（進み${b.p1.toFixed(2)}）。酸っぱい匂い`,-d]);}
    if(b.p2<Q.p2Low){const d=Math.round((Q.p2Low-b.p2)*Q.p2LowPer);s-=d;why.push([`ホイロが足りないまま焼いた（進み${b.p2.toFixed(2)}）。固く重い`,-d]);}
    if(b.p2>Q.p2High&&b.p2<=Q.collapse){const d=Math.round((b.p2-Q.p2High)*Q.p2HighPer);s-=d;why.push([`焼く前に膨らみすぎ（進み${b.p2.toFixed(2)}）。酸っぱく、形がだれた`,-d]);}
    const out=b.p2>Q.collapse;if(out)why.push([`焼く前にしぼんだ（進み${b.p2.toFixed(2)}）`,0]);
    b.score=Math.max(0,s);b.rank=rankOf(b.score,out||b.score<D.quality.ranks[D.quality.ranks.length-2][0]);b.why=why;
    if(b.p2>Q.p2High||b.p2<Q.p2Low)log(t,b.rank==='×'?'bad':'warn',`${nm(b)}を${P[b.prod].bake==='fry'?'揚げ':'焼き'}始めました。二次の進み${b.p2.toFixed(2)}（ちょうどよいのは${Q.p2Low}〜${Q.p2High}）。`,b.id);}

  /* 朝の答え合わせ */
  const prods=B.products.map(p=>{const mine=batches.filter(b=>b.prod===p.id&&b.st!==BS.CANCEL);
    const good=Math.floor(mine.reduce((a,b)=>a+b.packedBy,0)+1e-6),all=Math.floor(mine.reduce((a,b)=>a+b.packed,0)+1e-6);
    const bad=mine.filter(b=>b.rank==='×').reduce((a,b)=>a+b.units,0);
    const shipped=Math.min(od[p.id],good);return {id:p.id,name:p.name,order:od[p.id],shipped,short:od[p.id]-shipped,surplus:good-shipped,late:Math.max(0,all-good),bad};});
  const shipped=prods.reduce((a,x)=>a+x.shipped,0);
  const live=batches.filter(b=>b.tMix!=null);
  const ranks={'◎':0,'○':0,'△':0,'×':0};for(const b of live)if(b.rank)ranks[b.rank]++;
  const unbaked=live.filter(b=>b.tBake==null).length;
  const waits=[['一次発酵のあと、分割の機械を待つ',wait.tub],['成形の台が空くのを待つ',wait.shape],['ホイロが空くのを待つ（部屋で）',wait.proof],['焼く番を待つ（ホイロの中で膨らみ続ける）',wait.oven],['粗熱取りの台が空かず、オーブンから出せない',wait.cool],['冷めたのに包装を待つ',wait.pack]];
  const neck=waits.slice().sort((a,b)=>b[1]-a[1])[0];
  const p2s=live.filter(b=>b.p2Bake!=null).map(b=>b.p2Bake);
  /* 費用（仮） */
  const C=D.cost,BC=B.cost;let labor=0;const s0=cfg.start,s1=Math.max(lastDone||T1,s0+60);
  for(let t=s0;t<s1;t++)labor+=(t>=C.nightFrom?C.nightRate:1)*BC.wage/60*(BC.fixedStaff+cfg.shapers);
  const yeastYen=live.length*yeast.yen;const other=live.reduce((a,b)=>a+b.units,0)*BC.otherPerUnit;
  const ovenYen=cfg.ovens*B.oven.cost+ovenMin*B.oven.gasPerMin,fryYen=B.fryer.units*B.fryer.cost+fryMin*B.fryer.perMin;
  const total=Math.round(labor+yeastYen+other+ovenYen+fryYen);
  const summary={order,forecast:B.forecast,shipped,short:order-shipped,prods,ranks,unbaked,mixed:live.length,planned:batches.filter(b=>!b.late).length,
    late:prods.reduce((a,x)=>a+x.late,0),bad:prods.reduce((a,x)=>a+x.bad,0),surplus:prods.reduce((a,x)=>a+x.surplus,0),
    firstBake,lastDone,waits,neck,knead,water:wNeed,waterUse:wUse,p2Max:p2s.length?Math.max(...p2s):0,p2Min:p2s.length?Math.min(...p2s):0,flow:flow(D,cfg),
    yen:{labor:Math.round(labor),yeast:yeastYen,other,oven:Math.round(ovenYen),fry:Math.round(fryYen),total,perUnit:shipped?Math.round(total/shipped):null},
    expiry:XR?{at:EXP,label:XR.label,maxH:XR.maxH,longest:(()=>{const ts=batches.filter(b=>b.tPack!=null).map(b=>b.tPack);return ts.length?(EXP-Math.min(...ts))/60:null;})()}:null};
  if(lastDone!=null)log(lastDone,'info',`最後の生地の包装が終わりました（${hm(lastDone)}）。`);
  if(unbaked)log(T1,'bad',`${unbaked}回分の生地は、朝までに焼けませんでした。`);
  ev.sort((a,b)=>a.t-b.t);
  return {cfg,season:S,T0,T1,N,batches,agg,ev,summary,knead,ovens:cfg.ovens};
}

root.BreadCore={BS,BS_LABEL,simulate,fermRate,waterFor,orders,flow,hm};
})(typeof window!=='undefined'?window:globalThis);
