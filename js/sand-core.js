/* =====================================================================
   おにぎり工場（試作）のサンドイッチのライン（チルド・機械のライン）の計算の中心
   ・品（パック）と、ラインで作るサンド（具の種類）を分ける。1組＝食パン2枚のサンド1つ、切ると2切れ。
     たまご・ハムレタス・カツ・フルーツは同じ具2切れで1パック。ミックスは、たまご・ツナ・ハムレタス（チーズなし）を
     1切れずつ。ミックスのたまごとハムレタスは、単品と同じ流れで作ったサンドを切り分けて使う（ツナだけ別に作る）。
   ・原材料ごとにアレルゲンを持ち、サンド・品のアレルゲンは原材料から集める。品を替えるときの洗浄の長さもここから決める。
   ・具材の仕込み：たまごサラダ（スチーマー→冷水→殻むき機→人が確かめる→和える）、レタス（人が選ぶ→洗い槽・殺菌→脱水機）、
     カツ（揚げる→急速冷却機で10℃まで）、フルーツとツナサラダ（同じ係）。
     「時間がたったら」ではなく「合格したら」在庫になる：冷却・洗浄・配合は、品質確認の人の確認を待つ。
   ・組み立てのベルト：食パンの供給機・盛り付け機・人がのせる持ち場。供給機と盛り付け機はときどき詰まる。
   ・品の切り替え：残った具材・ラベル・包材を下げる → 洗浄（アレルゲンが残るなら長い）→ 初品確認と表示の照合（品質確認の人）。
   ・冷たさの時計：台に出したトレーは作業室の温度へ温まる。10℃こえが長い分は保留にして、品質確認の人が評価する。
   ・締め → カット（機械・1組を2切れに）→ 三角パックに詰める（人）→ 2:30 の締め切り → 終業の分解洗浄。
   ・消費期限は、その夜の製造に決まった期限（包装が遅れても延びない）。
   ・DOM を使わない。設定は data/factory.json の sand。数字はすべてゲームの仮の目安。
   ===================================================================== */
(function(root){
'use strict';

const LC={IDLE:-1,CHANGE:10,TRIP:11,WAIT:12,DONE:13,JAM:14,CLEAR:15,QC:16,CLEAN:17};   // 組み立ての状態（0〜4はサンドの番号）
const ING=['egg','tuna','lettuce','katsu','fruit'];
function rng(seed){let a=seed>>>0;return function(){a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
function gauss(r){let u=0,v=0;while(u===0)u=r();while(v===0)v=r();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);}
function hm(t){t=Math.round(t);const h=Math.floor(t/60)%24,m=t%60;return h+':'+String(m).padStart(2,'0');}
const sk={winter:1,mid:2,summer:3};
const YEN_SEASON={winter:0.7,mid:1,summer:1.5};

/* ---- 規格：原材料からアレルゲンを集める ---- */
const uniq=xs=>[...new Set(xs)];
function kindOf(A,id){return A.kinds.find(k=>k.id===id);}
function kindAllergen(A,id){return uniq(kindOf(A,id).parts.flatMap(p=>A.ingredients[p].allergen));}
function productKinds(A,p){return Object.keys(p.pieces);}
function productParts(A,p){const ps=uniq(productKinds(A,p).flatMap(k=>kindOf(A,k).parts));if(p.cheese)ps.push('cheese');return ps;}
function productAllergen(A,p){const L=A.allergenList,all=uniq(productParts(A,p).flatMap(x=>A.ingredients[x].allergen));
  const order=[...L.required,...L.recommended];all.sort((a,b)=>order.indexOf(a)-order.indexOf(b));
  return {required:all.filter(a=>L.required.includes(a)),recommended:all.filter(a=>L.recommended.includes(a))};}
function spec(A){return A.products.map(p=>({id:p.id,name:p.name,spec:p.spec||'',cheese:!!p.cheese,pieces:Object.values(p.pieces).reduce((a,b)=>a+b,0),
  kinds:productKinds(A,p).map(k=>kindOf(A,k).name),parts:productParts(A,p).map(x=>A.ingredients[x].name),allergen:productAllergen(A,p)}));}
/* 掃除の分：前のサンドにあって次のサンドにないアレルゲンがあれば長い */
function washLeft(A,from,to){const b=kindAllergen(A,to);return kindAllergen(A,from).filter(x=>!b.includes(x));}
function washMin(A,from,to){return washLeft(A,from,to).length?A.wash.long:A.wash.short;}
/* 消費期限：製造日（夜の始まりの日）の day 日後の at 分。包装の時刻では変わらない */
function expiryAt(rule){return rule.day*1440+rule.at;}

function orders(D,seed,season){const A=D.sand;const r=rng((seed*40503+(sk[season]||0)*131)>>>0);
  const total=Math.max(100,Math.round(A.forecast*(1+A.forecastSd*gauss(r))/10)*10);
  const out={};for(const p of A.products)out[p.id]=Math.max(0,Math.round(total*p.share*(1+A.orderSd*gauss(r))/10)*10);return out;}
function safeMin(A,room){const c=A.cold;if(room<=c.safe)return Infinity;return Math.log((room-c.fridge)/(room-c.safe))/c.k;}
function waterLeft(A,spin){return Math.exp(-spin/A.water.tau);}
/* ベルトの速さ（組／分）：人がのせる持ち場が追いつく速さまで */
function beltRate(A,kind,speed,staff,hand){if(!kind.hands)return speed;return Math.min(speed,staff*A.belt.handRate*hand/kind.hands);}

function simulate(D,cfgIn){
  const A=D.sand;const cfg=Object.assign({},A.defaults,cfgIn||{});
  const S=D.seasons[cfg.season]||D.seasons.mid;
  const T0=D.start,T1=D.end,N=T1-T0+1;
  const P={},K={};A.products.forEach(p=>P[p.id]=p);A.kinds.forEach((k,j)=>{K[k.id]=k;k._k=j;});
  const od=orders(D,cfg.seed,cfg.season);const order=Object.values(od).reduce((a,b)=>a+b,0);
  const seq=(A.orders[cfg.order]||A.orders.safe).seq.slice();
  const room=cfg.room,hand=A.room.hand[String(room)]||1,C=A.cold,PR=A.prep,QC=A.qc;
  const ev=[];const log=(t,k,msg)=>ev.push({t,k,msg});
  const ptgt=(id,t)=>Math.ceil((t<D.orderConfirm?A.forecast*P[id].share:od[id])*(1+(A.spare||0)));   // 詰めるパックの目標（予備こみ）
  const packTgt=(id,t)=>Math.ceil(t<D.orderConfirm?A.forecast*P[id].share:od[id]);   // 詰めるのは注文の数まで（予備の切れは、足りない品のために残す）
  const ktgt=(k,t)=>Math.ceil(A.products.reduce((a,p)=>a+ptgt(p.id,t)*(p.pieces[k]||0),0)/2);           // 作るサンドの組数
  const needIng=(g,t)=>A.kinds.reduce((a,k)=>a+ktgt(k.id,t)*(k.use[g]||0),0)*1.02;
  const EXP=expiryAt(A.expiry),basisFrom=EXP-A.expiry.maxH*60;

  /* ---- くじ（条件を変えても、同じ時刻に同じくじ） ---- */
  const rl=rng((cfg.seed*92821+(sk[cfg.season]||0)*17)>>>0);const roll=()=>new Float32Array(N).map(()=>rl());
  const feedRoll=roll(),feedU=roll(),depRoll=roll(),depU=roll(),shellRoll=new Float32Array(40).map(()=>rl());
  const pick=([a,b],u)=>a+Math.floor(u*(b-a+1));

  /* ---- 品質確認の人：仕事の列（初品確認 → 冷却・配合・洗浄 → 保留の評価） ---- */
  const qcq=[];let qcBusy=null;const qcLog={first:0,cool:0,wash:0,mix:0,hold:0,busy:0};
  const qcAdd=(t,kind,pri,dur,done,label)=>qcq.push({t0:t,kind,pri,dur,done,label});

  /* ---- 具材の在庫と仕込み ---- */
  const stock={},made={};for(const g of ING){stock[g]=[];made[g]=0;}const lots=[];
  const have=g=>stock[g].reduce((a,x)=>a+x.left,0);
  let shellHit=null;
  const take=(g,u,t)=>{let age=0,left=u;while(left>1e-9&&stock[g].length){const x=stock[g][0];
      if(x.shell){x.shell=false;shellHit={no:x.no,units:x.left,t};made[g]-=x.left;stock[g].shift();continue;}   // 捨てた分は、もう1回作る
      const q=Math.min(x.left,left);x.left-=q;left-=q;age+=q*(t-x.tReady);if(x.left<=1e-9)stock[g].shift();}return u?age/u:0;};
  const toStock=(lot,t)=>{lot.st='ready';lot.tReady=t;stock[lot.ing].push({left:lot.units,tReady:t,no:lot.no,shell:lot.shell});};
  // 合格を待つ（品質確認の人の確認が終わったら在庫になる）
  const passQC=(lot,t,kind,label)=>{lot.st='qc';lot.tQC=t;qcAdd(t,kind,1,QC[kind],(t2)=>{toStock(lot,t2);},label);};
  let boiler=null,peeler=null,checker=null,washer=null,fryer=null,ft=null;const bath=[],chill=[];
  const newLot=(g,t)=>{const no=lots.filter(x=>x.ing===g).length+1;const lot={ing:g,no,units:PR[g].lot,t0:t,st:'start',T:null,tReady:null,shell:g==='egg'&&shellRoll[(no-1)%40]<PR.egg.shellMiss};lots.push(lot);made[g]+=lot.units;return lot;};
  const want=(g,t)=>made[g]<needIng(g,t)-1e-6;

  /* ---- 組み立て ---- */
  let pi=0,cur=null,stop=null,tray=null,planDone=null,firstAsm=null,trips=0,changes=0,shellLost=0,started=false;
  const jams={feed:0,dep:0,shell:0,min:0};const got={};A.kinds.forEach(k=>got[k.id]=0);
  const chunks=[];const holdBin=[];const waitIng={};ING.forEach(g=>waitIng[g]=0);const waitLogged=new Set();let expWarn=0,trayNo=0,qcWaitLine=0,qcWaitPrep=0;
  const kres={};A.kinds.forEach(k=>kres[k.id]={id:k.id,name:k.name,made:0,cutRej:0,holdN:0,holdOk:0,holdBad:0});
  const pool={};A.kinds.forEach(k=>pool[k.id]=[]);   // 切ったあとの切れの山（具ごと）
  const res={};A.products.forEach(p=>res[p.id]={id:p.id,name:p.name,order:od[p.id],good:0,late:0,packed:0,early:0,score:0,why:{cold:0,water:0,fresh:0,bruise:0,hold:0}});
  let packedAll=0,packedBy=0,lastPack=null,cleanStart=null,cleanEnd=null,lastCut=null;
  const agg={rate:new Float32Array(N),jam:new Int8Array(N),line:new Int8Array(N).fill(LC.IDLE),trayT:new Float32Array(N).fill(NaN),trayExp:new Float32Array(N),made:new Float32Array(N),packed:new Float32Array(N),shime:new Float32Array(N),
    cut:new Float32Array(N),pack:new Float32Array(N),qc:new Int8Array(N),qcq:new Int8Array(N),hold:new Float32Array(N),stock:{},pool:{},
    st:{boil:new Int8Array(N),bath:new Int8Array(N),peel:new Int8Array(N),check:new Int8Array(N),wash:new Int8Array(N),fry:new Int8Array(N),chill:new Int8Array(N),ft:new Int8Array(N)},bathT:[],chillT:[]};
  for(const g of ING)agg.stock[g]=new Float32Array(N);for(const k of A.kinds)agg.pool[k.id]=new Float32Array(N);
  const QCODE={first:1,cool:2,wash:2,mix:2,hold:3};
  const wl=waterLeft(A,cfg.spin);
  const poolHave=k=>pool[k].reduce((a,x)=>a+x.n,0);
  const poolTake=(k,n)=>{let left=n,score=0;const why={cold:0,water:0,fresh:0,bruise:0,hold:0};
    while(left>1e-9&&pool[k].length){const x=pool[k][0];const q=Math.min(x.n,left);x.n-=q;left-=q;score+=x.score*q;for(const w in why)why[w]+=x.why[w]*q;if(x.n<=1e-9)pool[k].shift();}
    return {score,why};};
  /* 切る：1組を2切れにして、具ごとの山へ（品質の点を持たせる） */
  const cutPieces=(ch,q)=>{const kr=kres[ch.kind];const rj=A.cut.reject+Math.max(0,A.shime.maxReject*(1-cfg.shime/A.shime.good));const good=q*(1-rj);kr.cutRej+=q-good;
    const lt=K[ch.kind].use.lettuce||0;
    const wP=lt?wl*(A.water.sale+1440-ch.tAsm)/60*A.water.perHour*lt:0,bP=lt&&cfg.spin>A.water.bruise?(cfg.spin-A.water.bruise)*A.water.bruisePer*lt:0;
    const cP=Math.max(0,Math.min(ch.exp,C.limit)-C.free)*C.perMin,hP=ch.released?A.hold.releasePenalty:0;
    const score=Math.max(0,100-wP-bP-cP-ch.fresh-hP);
    pool[ch.kind].push({n:good*2,score,why:{cold:cP,water:wP,fresh:ch.fresh,bruise:bP,hold:hP},tAsm:ch.tAsm});};
  /* トレーを閉じる：保留になった分があれば、品質確認の人に評価を頼む */
  const closeTray=(t)=>{const tr=tray;tray=null;if(!tr||!tr.held)return;kres[tr.kind].holdN+=tr.held;
    qcAdd(t,'hold',2,QC.hold,(t2)=>{const mine=[];for(let j=holdBin.length-1;j>=0;j--)if(holdBin[j].tray===tr.no)mine.push(holdBin.splice(j,1)[0]);
        for(let j=chunks.length-1;j>=0;j--)if(chunks[j].tray===tr.no&&chunks[j].hold)mine.push(chunks.splice(j,1)[0]);
        let ok=0,bad=0;for(const ch of mine){if(ch.exp<=A.hold.release){ch.hold=false;ch.released=true;ch.ready=t2;chunks.push(ch);ok+=ch.n;}else bad+=ch.n;}
        chunks.sort((a,b)=>a.ready-b.ready);kres[tr.kind].holdOk+=ok;kres[tr.kind].holdBad+=bad;
        log(t2,bad?'bad':'warn',`保留の評価（${K[tr.kind].name}のトレー${tr.no}）：${ok?`${Math.round(ok)}組は減点つきで出す`:''}${ok&&bad?'・':''}${bad?`${Math.round(bad)}組は${C.safe}℃こえが${A.hold.release}分をこえたので捨てる`:''}。`);},`保留の評価：${K[tr.kind].name}`);};
  const firstCheck=(t,label)=>qcAdd(t,'first',0,QC.first+QC.label,()=>{if(stop&&stop.kind===LC.QC)stop=null;},label);

  log(T0,'info',`${S.label}の夜。作業室は${room}℃（人の手の速さ ×${hand}）。具材のトレーは冷蔵庫${C.fridge}℃から出すと、${isFinite(safeMin(A,room))?`${Math.round(safeMin(A,room))}分ほどで${C.safe}℃をこえます`:`${C.safe}℃をこえません`}。`);
  log(T0,'info',`ベルトは1分${cfg.speed}組（1組＝食パン2枚）。のせる人${cfg.staff}人で、${A.kinds.filter(k=>k.hands).map(k=>`${k.name}は1分${Math.round(beltRate(A,k,cfg.speed,cfg.staff,hand))}組`).join('・')}まで（盛り付け機だけの具は${cfg.speed}組）。`);
  log(T0,'info',`見込みは${A.forecast.toLocaleString()}パック。ミックスはたまご・ツナ・ハムレタス（チーズなし）の3切れ。消費期限は${A.expiry.label}（この夜の製造に決まった期限）。`);

  for(let i=0;i<N;i++){const t=T0+i;
    if(t===D.orderConfirm)log(t,'order',`注文が確定：${order.toLocaleString()}パック（${A.products.map(p=>p.name.replace('サンド','')+od[p.id]).join('・')}）。仕込みと組み立ての数を合わせ直します。`);
    /* ---- 品質確認の人 ---- */
    if(qcBusy&&t>=qcBusy.until){qcBusy.task.done(t);qcBusy=null;}
    if(!qcBusy&&qcq.length){qcq.sort((a,b)=>a.pri-b.pri||a.t0-b.t0);const task=qcq.shift();qcBusy={task,until:t+task.dur};qcLog[task.kind]++;qcLog.busy+=task.dur;}
    for(const q of qcq){if(q.kind==='first')qcWaitLine++;else if(q.pri===1)qcWaitPrep++;}
    /* ---- 仕込み ---- */
    if(t>=cfg.prepStart){
      // たまごサラダ：スチーマー → 冷水 → 殻むき機 → 人が確かめる → 和える → 配合の確認
      if(checker&&t-checker.tCheck>=PR.egg.check+PR.egg.mixMin){passQC(checker,t,'mix',`配合の確認：たまごサラダ${checker.no}回目`);checker=null;}
      if(peeler&&t-peeler.tPeel>=PR.egg.peel&&!checker){checker=peeler;checker.st='check';checker.tCheck=t;peeler=null;}
      if(!peeler){const q=bath.findIndex(x=>x.T<=C.safe);if(q>=0){peeler=bath.splice(q,1)[0];peeler.st='peel';peeler.tPeel=t;}}
      for(const x of bath)x.T+=(PR.egg.water-x.T)*PR.egg.k;
      if(boiler&&t-boiler.tBoil>=PR.egg.steam){if(bath.length<PR.egg.bath){boiler.st='bath';boiler.T=95;boiler.tBath=t;bath.push(boiler);boiler=null;}}
      if(!boiler&&want('egg',t)){boiler=newLot('egg',t);boiler.st='boil';boiler.tBoil=t;}
      // レタス：人が選ぶ → 洗い槽・殺菌 → 脱水機 → 洗浄・水切りの確認
      const sortMin=Math.ceil(PR.lettuce.lot/(cfg.sorters*PR.lettuce.sortRate));
      if(washer&&t-washer.tWash>=sortMin+PR.lettuce.wash+cfg.spin){passQC(washer,t,'wash',`洗浄・水切りの確認：レタス${washer.no}回目`);washer=null;}
      if(!washer&&want('lettuce',t)){washer=newLot('lettuce',t);washer.st='wash';washer.tWash=t;}
      // カツ：揚げる（中心の温度はカツの係が確かめる）→ 急速冷却機 → 冷却の合格（品質確認の人）
      for(let j=chill.length-1;j>=0;j--){const x=chill[j];x.T+=(PR.katsu.air-x.T)*PR.katsu.k;if(x.T<=C.safe){chill.splice(j,1);passQC(x,t,'cool',`冷却の合格：カツ${x.no}回目`);}}
      if(fryer&&t-fryer.tFry>=PR.katsu.fry){if(chill.length<PR.katsu.chill){fryer.st='chill';fryer.T=PR.katsu.from;fryer.tChill=t;chill.push(fryer);fryer=null;}}
      if(!fryer&&want('katsu',t)){fryer=newLot('katsu',t);fryer.st='fry';fryer.tFry=t;}
      // フルーツとツナサラダ（同じ係が、足りないほうから）
      if(ft&&t-ft.tF>=PR[ft.ing].min){passQC(ft,t,'mix',`配合の確認：${PR[ft.ing].name}${ft.no}回目`);ft=null;}
      if(!ft){const cand=['tuna','fruit'].filter(g=>want(g,t)).sort((a,b)=>made[a]/Math.max(1,needIng(a,t))-made[b]/Math.max(1,needIng(b,t)));
        if(cand.length){ft=newLot(cand[0],t);ft.st='ft';ft.tF=t;}}
    }
    /* ---- 組み立て ---- */
    let code=LC.IDLE,rateNow=0;
    if(t>=cfg.start&&planDone==null){
      if(!started){started=true;stop={kind:LC.QC};firstCheck(t,'始業の初品確認');
        log(t,'line','組み立ての始業。品質確認の人が初品（重さ・断面・表示）を確かめるまで、ベルトは動きません。');}
      if(stop&&stop.until!=null&&t>=stop.until){
        if(stop.kind===LC.CLEAR)stop={kind:LC.CHANGE,until:t+stop.m,to:stop.to};
        else if(stop.kind===LC.CHANGE){cur=stop.to;const to=stop.to;stop={kind:LC.QC};firstCheck(t,`初品確認・表示の照合：${K[to].name}`);}
        else stop=null;}
      if(shellHit&&!stop){const h=shellHit;shellHit=null;const m=A.belt.shellStop;stop={kind:LC.JAM,until:t+m,why:'shell'};jams.shell++;jams.min+=m;shellLost+=h.units;
        log(t,'bad',`盛り付け機に入れる前のたまごサラダ（${h.no}回目）に殻のかけらが見つかりました。この回の残り${Math.round(h.units)}組分を捨て、ホッパーを洗って${m}分止めます。`);}
      if(stop)code=stop.kind;
      else{
        while(pi<seq.length&&got[seq[pi]]>=ktgt(seq[pi],t)-1e-6)pi++;
        if(pi>=seq.length&&t>=D.orderConfirm){planDone=t;code=LC.DONE;if(tray)closeTray(t);log(t,'info',`注文の分を全部組み立てました（${hm(t)}）。`);}
        else if(pi<seq.length){const id=seq[pi];
          if(cur==null)cur=id;
          if(cur!==id){if(tray){for(const g in K[cur].use)stock[g].unshift({left:tray.left*K[cur].use[g],tReady:t,no:0});closeTray(t);}
            const m=washMin(A,cur,id),left=washLeft(A,cur,id);stop={kind:LC.CLEAR,until:t+A.change.clear,to:id,m};changes++;code=LC.CLEAR;
            log(t,'line',`品の切り替え：${K[cur].name}→${K[id].name}。残った具材・ラベル・包材を下げて${A.change.clear}分、${left.length?`アレルゲン（${left.join('・')}）が残らないよう全部洗って`:'台とノズルを拭いて'}${m}分、そのあと初品確認。`);}
          else{
            if(!tray||tray.left<=1e-6){if(tray)closeTray(t);const need=ktgt(id,t)-got[id];
              const avail=Math.min(...Object.keys(K[id].use).map(g=>have(g)/K[id].use[g]));
              const u=Math.min(cfg.tray,need,Math.floor(avail));
              if(u<1){code=LC.WAIT;for(const g in K[id].use)if(have(g)/K[id].use[g]<1)waitIng[g]++;
                if(!waitLogged.has(id)){waitLogged.add(id);const g=Object.keys(K[id].use).find(g=>have(g)/K[id].use[g]<1);log(t,'warn',`${K[id].name}の${PR[g].name}がまだ合格していないので、組み立てが待っています。`);}}
              else{let fresh=0;for(const g in K[id].use){const age=take(g,u*K[id].use[g],t);if(g==='fruit')fresh=Math.max(0,age-PR.fruit.freshFree)*PR.fruit.freshPerMin;}
                tray={kind:id,size:u,left:u,T:C.fridge,exp:0,fresh,no:++trayNo,held:0};trips++;stop={kind:LC.TRIP,until:t+A.trip};code=LC.TRIP;
                if(firstAsm==null){firstAsm=t;log(t,'info',`組み立てを始めました。最初は${K[id].name}。`);}}}
            if(tray&&code!==LC.TRIP&&!stop){const n=Math.min(tray.left,beltRate(A,K[id],cfg.speed,cfg.staff,hand),ktgt(id,t)-got[id]);
              if(n>0){tray.left-=n;got[id]+=n;kres[id].made+=n;const hold=tray.exp>C.limit;if(hold)tray.held+=n;
                chunks.push({kind:id,n,exp:tray.exp,fresh:tray.fresh,tAsm:t,ready:t+cfg.shime,hold,tray:tray.no});code=K[id]._k;rateNow=n;if(tray.left<=1e-6)closeTray(t);
                const BF=A.belt;
                if(feedRoll[i]<BF.feeder.perMin){const m=pick(BF.feeder.min,feedU[i]);stop={kind:LC.JAM,until:t+1+m,why:'feed'};jams.feed++;jams.min+=m;if(jams.feed<=3)log(t+1,'line',`食パンの供給機でパンが重なって詰まりました。ベルトを${m}分止めて直します。`);}
                else if(K[id].deposit&&depRoll[i]<BF.deposit.perMin){const m=pick(BF.deposit.min,depU[i]);stop={kind:LC.JAM,until:t+1+m,why:'dep'};jams.dep++;jams.min+=m;if(jams.dep<=3)log(t+1,'line',`盛り付け機の口が詰まりました（${K[id].name}）。ベルトを${m}分止めて口を洗います。`);}}}}}}
    }
    else if(planDone!=null)code=LC.DONE;
    // 出ているトレーは作業室の温度へ（ベルトが止まっていても）
    if(tray){tray.T+=(room-tray.T)*C.k;if(tray.T>C.safe){tray.exp++;
      if(tray.exp===C.free+1&&expWarn++<3)log(t,'warn',`${K[tray.kind].name}のトレー${tray.no}が${C.safe}℃をこえて${C.free}分（${tray.T.toFixed(1)}℃・残り${Math.round(tray.left)}組分）。`);
      if(tray.exp===C.limit+1)log(t,'bad',`${K[tray.kind].name}のトレー${tray.no}が${C.safe}℃をこえて${C.limit}分。このあとの分は保留にして、品質確認の人が評価します。`);}}
    /* ---- 締め → カット（1組を2切れ）。保留の分は評価を待つ ---- */
    let cap=A.pack.cut,cutNow=0;
    while(cap>1e-9&&chunks.length&&chunks[0].ready<=t){const ch=chunks[0];
      if(ch.hold){holdBin.push(chunks.shift());continue;}
      const q=Math.min(ch.n,cap);ch.n-=q;cap-=q;cutNow+=q;cutPieces(ch,q);lastCut=t;if(ch.n<=1e-9)chunks.shift();}
    /* ---- 三角パックに詰める（人）：いちばん前から待っている切れの品から ---- */
    let pcap=cfg.packers,packNow=0;
    for(let guard=0;guard<400&&pcap>1e-6;guard++){
      let best=null,bt=Infinity;
      for(const p of A.products){if(res[p.id].packed>=packTgt(p.id,t)-1e-6)continue;
        if(!Object.entries(p.pieces).every(([k,n])=>poolHave(k)>=n-1e-6))continue;
        const tt=Math.max(...Object.keys(p.pieces).map(k=>pool[k][0].tAsm));if(tt<bt){bt=tt;best=p;}}
      if(!best)break;
      const per=Object.keys(best.pieces).length>1?A.pack.mix:A.pack.two;
      const n=Math.min(1,pcap*per,packTgt(best.id,t)-res[best.id].packed);if(n<=1e-6)break;pcap-=n/per;packNow+=n;
      let sc=0,pc=0;const w={cold:0,water:0,fresh:0,bruise:0,hold:0};
      for(const [k,cnt] of Object.entries(best.pieces)){const r=poolTake(k,cnt*n);sc+=r.score;pc+=cnt*n;for(const x in w)w[x]+=r.why[x];}
      const r=res[best.id];r.packed+=n;r.score+=sc/pc*n;for(const x in w)r.why[x]+=w[x]/pc*n;
      if(t<basisFrom)r.early+=n;else if(t<D.deadline){r.good+=n;packedBy+=n;}else r.late+=n;packedAll+=n;lastPack=t;}
    // すべて包み終わったら、終業の分解洗浄
    if(planDone!=null&&cleanStart==null&&t>planDone&&!chunks.length&&!holdBin.length&&!qcq.some(q=>q.kind==='hold')&&!(qcBusy&&qcBusy.task.kind==='hold')&&!packNow&&!cutNow){
      cleanStart=t;cleanEnd=t+A.clean.min;log(t,'line',`カットと包装が終わりました。終業の分解洗浄（盛り付け機・ミキサー・コンベヤー・切断刃）を${A.clean.min}分。${hm(cleanEnd)}に終わる予定です（目安 ${hm(A.clean.by)}）。`);}
    if(cleanStart!=null&&t>=cleanStart&&t<cleanEnd)code=LC.CLEAN;
    /* ---- 記録 ---- */
    agg.line[i]=code;agg.rate[i]=rateNow;agg.jam[i]=stop&&stop.kind===LC.JAM&&code===LC.JAM?({feed:1,dep:2,shell:3}[stop.why]||0):0;
    agg.trayT[i]=tray?tray.T:NaN;agg.trayExp[i]=tray?tray.exp:0;agg.made[i]=Object.values(got).reduce((a,b)=>a+b,0);agg.packed[i]=packedAll;agg.cut[i]=cutNow;agg.pack[i]=packNow;
    agg.shime[i]=chunks.reduce((a,c)=>a+c.n,0);agg.hold[i]=holdBin.reduce((a,c)=>a+c.n,0);for(const g of ING)agg.stock[g][i]=have(g);for(const k of A.kinds)agg.pool[k.id][i]=poolHave(k.id);
    agg.qc[i]=qcBusy?QCODE[qcBusy.task.kind]:0;agg.qcq[i]=qcq.length;
    const st=agg.st;st.boil[i]=boiler?1:0;st.bath[i]=bath.length;st.peel[i]=peeler?1:0;st.check[i]=checker?1:0;st.wash[i]=washer?1:0;st.fry[i]=fryer?1:0;st.chill[i]=chill.length;st.ft[i]=ft?(ft.ing==='fruit'?1:2):0;
    agg.bathT.push(bath.map(x=>x.T));agg.chillT.push(chill.map(x=>x.T));
    if(t===D.deadline)log(t,'ship',`${hm(t)}、包装の締め切り。ここまでのサンド${Math.floor(packedBy).toLocaleString()}パックをチルドの箱で${D.ship.via}へ送ります（消費期限 ${A.expiry.label}）。`);
  }

  /* ---- 朝の答え合わせ ---- */
  const ranks=D.quality.ranks;
  const prods=A.products.map(p=>{const r=res[p.id];const good=Math.floor(r.good+1e-6);const shipped=Math.min(r.order,good);const g=r.packed;
    const score=g?Math.round(r.score/g):null;const avg=k=>g?r.why[k]/g:0;
    return {id:p.id,name:p.name,order:r.order,shipped,short:r.order-shipped,surplus:good-shipped,late:Math.floor(r.late+1e-6),early:Math.floor(r.early+1e-6),score,rank:score==null?'—':ranks.find(x=>score>=x[0])[1],
      why:{cold:avg('cold'),water:avg('water'),bruise:avg('bruise'),fresh:avg('fresh'),hold:avg('hold')}};});
  const kinds=A.kinds.map(k=>{const r=kres[k.id];return {id:k.id,name:k.name,target:ktgt(k.id,T1),made:Math.round(r.made),cutRej:Math.round(r.cutRej),holdN:Math.round(r.holdN),holdOk:Math.round(r.holdOk),holdBad:Math.round(r.holdBad),leftPieces:Math.round(poolHave(k.id))};});
  const shipped=prods.reduce((a,x)=>a+x.shipped,0);
  const waits=[...ING.map(g=>[`${PR[g].name}の合格を待つ`,waitIng[g]]),['初品確認を待つ（ライン）',qcWaitLine]];const neck=waits.slice().sort((a,b)=>b[1]-a[1])[0];
  const lineStart=cfg.start,endAll=cleanEnd||T1,prepEnd=Math.max(cfg.prepStart+30,...lots.map(l=>l.tReady||T1));
  const Cc=D.cost,AC=A.cost;let labor=0;const wage=t=>(t>=Cc.nightFrom?Cc.nightRate:1)*AC.wage/60;
  for(let t=cfg.prepStart;t<prepEnd;t++)labor+=wage(t)*(AC.prepFixed+cfg.sorters);
  for(let t=cfg.prepStart;t<endAll;t++)labor+=wage(t)*(AC.qcStaff||1);
  for(let t=lineStart;t<endAll;t++)labor+=wage(t)*(cfg.staff+cfg.packers);
  const coldYen=Math.round((A.room.yen[String(room)]||20)*(endAll-lineStart)*(YEN_SEASON[cfg.season]||1));
  const chillYen=agg.st.chill.reduce((a,x)=>a+(x?AC.chillerPerMin:0),0);
  const food=Math.round(A.kinds.reduce((a,k)=>a+kres[k.id].made*(k.yen||0),0));const machine=AC.machineYen||0;
  const total=Math.round(labor+coldYen+chillYen+food+machine);
  const summary={order,forecast:A.forecast,shipped,short:order-shipped,prods,kinds,waits,neck,trips,changes,firstAsm,planDone,lastPack,lastCut,cleanStart,cleanEnd,cleanBy:A.clean.by,lots:lots.length,
    bad:kinds.reduce((a,x)=>a+x.holdBad,0),late:prods.reduce((a,x)=>a+x.late,0),early:prods.reduce((a,x)=>a+x.early,0),cutRej:kinds.reduce((a,x)=>a+x.cutRej,0),surplus:prods.reduce((a,x)=>a+x.surplus,0),
    water:wl,safeMin:safeMin(A,room),hand,jams,shellLost:Math.round(shellLost),qc:Object.assign({},qcLog,{waitLine:qcWaitLine,waitPrep:qcWaitPrep}),
    expiry:{at:EXP,label:A.expiry.label,maxH:A.expiry.maxH,basisFrom},spec:spec(A),
    yen:{labor:Math.round(labor),cold:coldYen,chill:chillYen,food,machine,total,perUnit:shipped?Math.round(total/shipped):null}};
  if(planDone==null)log(T1,'bad','朝までに、注文の分を組み立て終わりませんでした。');
  if(lastPack!=null)log(lastPack,'info',`最後のパック詰めが終わりました（${hm(lastPack)}）。`);
  if(cleanEnd!=null&&cleanEnd>A.clean.by)log(cleanEnd,'warn',`終業の分解洗浄が終わったのは${hm(cleanEnd)}で、目安の${hm(A.clean.by)}をこえました。`);
  if(summary.early)log(basisFrom,'warn',`${hm(basisFrom)}より前に包んだ${summary.early}パックは、期限を決めたときに確かめた範囲（包装から${A.expiry.maxH}時間）の外なので出荷しません。`);
  ev.sort((a,b)=>a.t-b.t);
  return {cfg,season:S,T0,T1,N,agg,ev,summary,lots,seq,od};
}

root.SandCore={LC,ING,simulate,orders,safeMin,waterLeft,washMin,washLeft,beltRate,kindAllergen,productAllergen,spec,expiryAt,hm};
})(typeof window!=='undefined'?window:globalThis);
