/* =====================================================================
   おにぎり工場（試作）のサンドイッチのラインの「サンドイッチ用食パン（角型）」
   ・現実には焼くのはパンの場所でも、作業の流れとしてはサンドイッチのラインの一部として扱う。
     サンドの夜と同じ時計で、午後から1分ずつ進める（sand-core.js が毎分 step を呼ぶ）。
   ・仕込み（ミキサー1回＝型1回分）→ 一次発酵 → 分割・丸め → ベンチ → 成形・型詰め
     → ホイロ（型の8分目まで膨らんだら焼ける。焼く番を待つあいだも膨らみ続ける）
     → 焼成（ふたをした角型。オーブン1台に1回分）→ 型から出して冷ます（芯が下がるまで切れない）
     → スライス（組み立ての少し前から、使う分だけ切る）→ 食パンの供給機へ。
   ・発酵の速さはパンのライン（data/factory.json の bread.ferm）と同じ式を使う。
   ・詰まりは前へ逆流する：冷ます棚がいっぱい → オーブンから出せない → ホイロで膨らみすぎる。
   ・DOM を使わない。設定は data/factory.json の sand.loaf。数字はすべてゲームの仮の目安。
   ===================================================================== */
(function(root){
'use strict';

const LS={WAIT:0,MIX:1,FERM:2,DIV:3,BENCH:4,SQ:5,SHAPE:6,PQ:7,PROOF:8,OQ:9,BAKE:10,COOL:11,COOLED:12,SLICE:13,DONE:14,CANCEL:-1};
const LS_LABEL={0:'まだ',1:'仕込み',2:'一次発酵',3:'分割・丸め',4:'ベンチ',5:'型詰めを待つ',6:'成形・型詰め',7:'ホイロを待つ',8:'ホイロ',9:'焼く番を待つ（ホイロの中）',10:'焼成',11:'冷ましている',12:'冷めて切るのを待つ',13:'スライス',14:'切り終わり',[-1]:'取りやめ'};
function hm(t){t=Math.round(t);const h=Math.floor(t/60)%24,m=t%60;return h+':'+String(m).padStart(2,'0');}

/* 発酵の速さ（27℃を1とした倍率）。パンのラインと同じ形 */
function fermRate(F,T){if(T<=4)return 0;if(T<=F.top)return Math.pow(F.q10,(T-F.tref)/10);if(T>=F.dead)return 0;return Math.pow(F.q10,(F.top-F.tref)/10)*(F.dead-T)/(F.dead-F.top);}
/* 1本から取れる枚数（両端の耳を落とす） */
function slicesPer(L,thick){return Math.floor((L.lenMm-2*L.heelMm)/thick);}
/* 要る枚数から、焼く本数と回数 */
function loavesFor(L,slices,thick,spare){return Math.ceil(slices*(1+spare/100)/slicesPer(L,thick));}
/* 1時間にこねる回数と、オーブンが焼ける回数（ダイヤの間隔と同じ見方） */
function flow(L,cfg){return {mixPerHour:60/Math.max(cfg.binterval,L.mix),ovenPerHour:60/(L.oven.bake+L.oven.load)*cfg.bovens};}
/* 冷ましかた：空気の温度と速さ */
function coolOf(L,mode,room){const c=L.cool[mode]||L.cool.rack;return {air:c.air==null?room:c.air,k:c.k,label:c.label,yen:c.yen||0};}
function coolMin(L,mode,room){const c=coolOf(L,mode,room);if(c.air>=L.cool.slice)return Infinity;return Math.log((L.cool.from-c.air)/(L.cool.slice-c.air))/c.k;}

function create(D,A,cfg,S,log,needSlices){
  const L=A.loaf,F=D.bread.ferm,Q=L.quality;const room=S.room;const per=slicesPer(L,cfg.bthick);
  const cool=coolOf(L,cfg.bcool,room);
  const batches=[];
  const add=(units,late)=>{const b={no:batches.length+1,units,late:!!late,st:LS.WAIT,T:room,p1:0,p2:0,left:0,tMix:null,tFerm:null,tDiv:null,tBench:null,tSQ:null,tShape:null,tPQ:null,tProof:null,tReady:null,tBake:null,oven:null,tCool:null,tCooled:null,tSlice:null,tDone:null,
    p2Bake:null,score:100,why:[],warned:0,bad:false};batches.push(b);return b;};
  const split=n=>{const out=[];for(let left=n;left>0;left-=L.batch)out.push(Math.min(L.batch,left));return out;};
  const plan0=loavesFor(L,needSlices(D.start),cfg.bthick,cfg.bspare);for(const u of split(plan0))add(u,false);
  const ovens=new Array(cfg.bovens).fill(null);
  let mixing=null,dividing=null,shaping=null,slicing=null,lastMix=-999;
  const stock=[];let sliced=0,used=0,firstSlice=null,lastSliceT=null,firstBake=null,ovenMin=0,coolYen=0,rackFull=0,proofWait=0,ovenWait=0,collapsed=0,leftAtEnd=null;
  const nm=b=>`食パン（型${b.no}回目）`;
  const haveSlices=()=>stock.reduce((a,x)=>a+x.n,0);
  const onRack=()=>batches.filter(b=>b.st===LS.COOL||b.st===LS.COOLED||b.st===LS.SLICE).reduce((a,b)=>a+b.units,0);
  const accrue=(b,base,isP1)=>{const p=isP1?b.p1:b.p2;if(p>=2)return 0;return Math.min(2-p,fermRate(F,b.T)/base);};
  const cm=coolMin(L,cfg.bcool,room);
  log(cfg.bstart,'info',`食パン：角型（${L.loafLabel}）を${batches.length}回・${plan0}本焼く予定（1本${per}枚・${cfg.bthick}mm。見込みのサンドに${cfg.bspare}%上乗せ）。冷まし方は${cool.label}で、芯が${L.cool.slice}℃に下がるまで${isFinite(cm)?`約${Math.round(cm)}分`:'下がりません'}。`);
  {const f=flow(L,cfg);if(f.mixPerHour>f.ovenPerHour*1.05)log(cfg.bstart,'warn',`食パン：こねる間隔${cfg.binterval}分（1時間に${f.mixPerHour.toFixed(1)}回）は、オーブン${cfg.bovens}台が焼ける1時間${f.ovenPerHour.toFixed(1)}回より速いので、ホイロに型がたまりそうです。`);}

  function judge(b,t){let s=100;const why=[];
    if(b.p1<Q.p1Low){const d=Math.round((Q.p1Low-b.p1)*Q.p1LowPer);s-=d;why.push(`一次発酵が足りない（${b.p1.toFixed(2)}）`);}
    if(b.p1>Q.p1High){const d=Math.round((b.p1-Q.p1High)*Q.p1HighPer);s-=d;why.push(`一次発酵が進みすぎ（${b.p1.toFixed(2)}）`);}
    if(b.p2>Q.p2High&&b.p2<=Q.collapse){const d=Math.round((b.p2-Q.p2High)*Q.p2HighPer);s-=d;why.push(`焼く前に膨らみすぎ（${b.p2.toFixed(2)}）。ふたに押されて、きめが粗い`);}
    if(b.p2>Q.collapse){b.bad=true;why.push(`焼く前に膨らみすぎて、焼いたあと腰が折れた（${b.p2.toFixed(2)}）`);}
    b.score=Math.max(0,s);b.why=why;
    if(b.bad){collapsed+=b.units;log(t,'bad',`${nm(b)}は、焼く番を待つあいだに膨らみすぎました（進み${b.p2.toFixed(2)}）。焼いても側面が折れるので、サンドには使えません。`);}
    else if(why.length)log(t,'warn',`${nm(b)}を焼き始めました。${why.join('・')}。`);}

  function step(t){
    /* スライス：組み立ての少し前から、切った枚数が少なくなったら次の1本を切る */
    if(slicing){const b=slicing;const n=Math.min(b.left,L.slicer.rate);b.left-=n;const ns=n*per;sliced+=ns;
      const pen=Math.max(0,100-b.score)*L.loafPen+Math.min(L.dry.loafCap,Math.max(0,t-b.tCooled-L.dry.loafFree)*L.dry.loafPer);
      stock.push({n:ns,t,pen});if(firstSlice==null){firstSlice=t;log(t,'info',`食パン：最初のパンを切りました（${nm(b)}）。供給機へ送ります。`);}lastSliceT=t;
      if(b.left<=1e-6){b.st=LS.DONE;b.tDone=t;slicing=null;}}
    if(!slicing&&t>=cfg.start-L.slicer.lead&&haveSlices()<L.slicer.ahead){const q=batches.filter(b=>b.st===LS.COOLED).sort((a,b)=>a.tCooled-b.tCooled)[0];
      if(q){slicing=q;q.st=LS.SLICE;q.tSlice=t;q.left=q.units;}}
    /* 冷ます（型から出して棚の上。芯の温度で決める） */
    let anyCool=false;for(const b of batches)if(b.st===LS.COOL||b.st===LS.COOLED){b.T+=(cool.air-b.T)*cool.k;anyCool=true;
      if(b.st===LS.COOL&&b.T<=L.cool.slice){b.st=LS.COOLED;b.tCooled=t;}}
    if(anyCool)coolYen+=cool.yen;
    /* 焼成：焼けたら型から出して棚へ。棚がいっぱいなら、オーブンの中で待つ（次の型が焼けない） */
    for(let k=0;k<ovens.length;k++){const b=ovens[k];if(!b)continue;
      if(t-b.tBake<L.oven.bake+L.oven.load){b.T+=(98-b.T)*0.12;ovenMin++;continue;}
      if(onRack()+b.units<=L.cool.racks){ovens[k]=null;b.st=LS.COOL;b.tCool=t;b.T=L.cool.from;}
      else{rackFull++;if(rackFull===1||rackFull%30===0)log(t,'warn',`食パン：冷ます棚がいっぱい（${L.cool.racks}本）で、焼けた${nm(b)}をオーブンから出せません。次の型が焼けず、ホイロで膨らみ続けます。`);}}
    for(let k=0;k<ovens.length;k++){if(ovens[k])continue;const q=batches.filter(b=>b.st===LS.OQ).sort((a,b)=>a.tReady-b.tReady)[0];if(!q)break;
      ovens[k]=q;q.st=LS.BAKE;q.tBake=t;q.oven=k;q.p2Bake=q.p2;judge(q,t);if(firstBake==null){firstBake=t;log(t,'info',`食パン：最初の型を焼き始めました（ふたをして${L.oven.bake}分）。`);}}
    /* ホイロ：型の8分目まで膨らんだら焼ける。焼く番を待つあいだも膨らみ続ける */
    for(const b of batches)if(b.st===LS.PROOF||b.st===LS.OQ){b.T+=(L.proof.T-b.T)*L.proof.k;b.p2+=accrue(b,L.proof.base,false);
      if(b.st===LS.PROOF&&b.p2>=L.proof.ready){b.st=LS.OQ;b.tReady=t;}
      if(b.st===LS.OQ){ovenWait++;if(!b.warned&&b.p2>Q.p2High){b.warned=1;log(t,'warn',`${nm(b)}が型の上まで膨らんできました（進み${b.p2.toFixed(2)}）。オーブンが空くのを待っています。`);}}}
    {let free=L.proof.racks-batches.filter(b=>b.st===LS.PROOF||b.st===LS.OQ).length;
      for(const b of batches.filter(x=>x.st===LS.PQ).sort((a,b)=>a.tPQ-b.tPQ)){if(free<=0){proofWait++;continue;}b.st=LS.PROOF;b.tProof=t;free--;}}
    /* 成形・型詰め（機械で丸めて、人が型に入れる） */
    if(shaping){const b=shaping;b.left-=L.shape;if(b.left<=1e-6){b.st=LS.PQ;b.tPQ=t;shaping=null;}}
    if(!shaping){const q=batches.filter(b=>b.st===LS.SQ).sort((a,b)=>a.tSQ-b.tSQ)[0];if(q){shaping=q;q.st=LS.SHAPE;q.tShape=t;q.left=q.units;}}
    for(const b of batches)if(b.st===LS.BENCH&&t-b.tBench>=L.bench){b.st=LS.SQ;b.tSQ=t;}
    for(const b of batches)if([LS.DIV,LS.BENCH,LS.SQ,LS.SHAPE,LS.PQ].includes(b.st)){b.T+=(room-b.T)*D.bread.shapeQueueK;if(b.st===LS.DIV)b.p1+=accrue(b,F.base1,true);else b.p2+=accrue(b,L.proof.base,false);}
    if(dividing){const b=dividing;b.left-=L.divide;if(b.left<=1e-6){b.st=LS.BENCH;b.tBench=t;dividing=null;}}
    if(!dividing){const q=batches.filter(b=>b.st===LS.FERM&&t-b.tFerm>=L.ferm1).sort((a,b)=>a.tFerm-b.tFerm)[0];if(q){dividing=q;q.st=LS.DIV;q.tDiv=t;q.left=q.units;}}
    for(const b of batches)if(b.st===LS.FERM){b.T+=(F.room-b.T)*F.k;b.p1+=accrue(b,F.base1,true);}
    if(mixing&&t-mixing.tMix>=L.mix){const b=mixing;mixing=null;b.st=LS.FERM;b.tFerm=t;b.T=L.knead;}
    if(!mixing&&t>=cfg.bstart&&t-lastMix>=cfg.binterval){const next=batches.find(b=>b.st===LS.WAIT);
      if(next&&batches.filter(b=>b.st===LS.FERM||b.st===LS.DIV).length<F.tubs){mixing=next;next.st=LS.MIX;next.tMix=t;lastMix=t;if(next.no===1)log(t,'info',`食パン：仕込みを始めました（こね上げ${L.knead}℃・1回${next.units}本分）。`);}}
  }
  /* 20:00 の注文で、まだこねていない回の本数を直す（足りなければ列の最後に追加） */
  function confirm(t){const need=Math.ceil(needSlices(t)*(1+L.afterSpare/100)/per);const live=batches.filter(b=>b.st!==LS.CANCEL);
    const fixed=live.filter(b=>b.st!==LS.WAIT).reduce((a,b)=>a+b.units,0),open=live.filter(b=>b.st===LS.WAIT);let rest=need-fixed;
    if(rest<=0){open.forEach(b=>{b.st=LS.CANCEL;});log(t,'order',`食パン：もう${fixed}本こねてあり、注文の${need}本に足ります${open.length?`（まだこねていない${open.length}回は取りやめ）`:''}${-rest>=L.batch/2?`。${-rest}本ほど余りそう`:''}。`);return;}
    const parts=split(rest);open.forEach((b,k)=>{if(k<parts.length)b.units=parts[k];else b.st=LS.CANCEL;});
    for(let k=open.length;k<parts.length;k++)add(parts[k],true);
    log(t,'order',`食パン：注文から数えると${need}本要ります。${parts.length>open.length?`${parts.length-open.length}回（${parts.slice(open.length).reduce((a,b)=>a+b,0)}本）を追加で仕込みます。焼けて冷めるのは遅くなります`:open.length>parts.length?`まだこねていない回を${open.length-parts.length}回取りやめ`:'まだこねていない回の本数を合わせ直しました'}。`);}
  /* 供給機が使う：古い順に取り、乾きと型の減点を返す */
  function take(n,t){let left=n,pen=0;while(left>1e-9&&stock.length){const x=stock[0];const q=Math.min(x.n,left);x.n-=q;left-=q;
      pen+=q*(x.pen+Math.min(L.dry.cap,Math.max(0,t-x.t-L.dry.free)*L.dry.perMin));if(x.n<=1e-9)stock.shift();}
    used+=n-left;return n?pen/n:0;}
  function snap(t){const c={};for(const b of batches)c[b.st]=(c[b.st]||0)+b.units;const rk=batches.filter(b=>b.st===LS.COOL||b.st===LS.COOLED);
    return {slices:haveSlices(),used,sliced,mix:mixing?1:0,ferm:(c[LS.FERM]||0)+(c[LS.DIV]||0),shape:(c[LS.BENCH]||0)+(c[LS.SQ]||0)+(c[LS.SHAPE]||0)+(c[LS.PQ]||0),
      proof:c[LS.PROOF]||0,oq:c[LS.OQ]||0,oven:ovens.map(b=>b?(t-b.tBake)/(L.oven.bake+L.oven.load):-1),cool:c[LS.COOL]||0,cooled:c[LS.COOLED]||0,slicing:slicing?1:0,
      hot:rk.length?Math.max(...rk.map(b=>b.T)):NaN,cold:rk.length?Math.min(...rk.map(b=>b.T)):NaN,p2:Math.max(0,...batches.filter(b=>b.st===LS.PROOF||b.st===LS.OQ).map(b=>b.p2))};}
  function summary(T1){const live=batches.filter(b=>b.st!==LS.CANCEL&&b.tMix!=null);const baked=live.filter(b=>b.tBake!=null);
    const loaves=live.reduce((a,b)=>a+b.units,0),unbaked=live.filter(b=>b.tBake==null).reduce((a,b)=>a+b.units,0);
    const notCut=batches.filter(b=>b.st===LS.COOL||b.st===LS.COOLED||b.st===LS.SLICE).reduce((a,b)=>a+(b.st===LS.SLICE?b.left:b.units),0);
    const sc=baked.filter(b=>!b.bad);return {per,thick:cfg.bthick,planned:plan0,mixed:live.length,loaves,late:live.filter(b=>b.late).length,unbaked,collapsed,sliced:Math.round(sliced),used:Math.round(used),
      leftSlices:Math.round(haveSlices()),leftLoaves:Math.round(notCut),firstBake,firstSlice,lastSlice:lastSliceT,ovenMin,rackFull,ovenWait,proofWait,coolMin:cm,coolLabel:cool.label,
      score:sc.length?Math.round(sc.reduce((a,b)=>a+b.score*b.units,0)/sc.reduce((a,b)=>a+b.units,0)):null,
      yen:{ing:loaves*L.cost.loafYen,oven:cfg.bovens*L.oven.cost+ovenMin*L.oven.gasPerMin,cool:Math.round(coolYen)}};}
  return {step,confirm,take,snap,summary,have:haveSlices,batches,per,lastActive:()=>Math.max(lastSliceT||0,...batches.map(b=>b.tDone||b.tCool||b.tBake||0))};
}

root.SandLoaf={LS,LS_LABEL,create,slicesPer,loavesFor,flow,coolMin,coolOf,fermRate,hm};
})(typeof window!=='undefined'?window:globalThis);
