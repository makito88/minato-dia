/* =====================================================================
   おにぎり工場（試作）のサンドイッチのライン（チルド）の計算の中心
   ・機械のライン：具材の仕込み＝たまごサラダ（スチーマー→冷水→殻むき機→人が確かめる→和える）、
     レタス（人が選ぶ→洗い槽・殺菌→脱水機）、カツ（揚げる→急速冷却機で10℃まで）、フルーツとクリーム。できたものは冷蔵庫の在庫になる。
   ・組み立てのベルト：食パンの供給機が並べて塗り、たまごサラダとクリームは盛り付け機、ハム・レタス・カツ・果物は人がのせる。
     ベルトの速さを決め、人がのせる持ち場が追いつかなければベルトをそこまで遅くする。供給機と盛り付け機はときどき詰まって止まる。
   ・締め（冷蔵庫で冷やしてから切る）→ カット（機械）→ 三角パックに詰める（人）→ 2:30 の締め切り。
   ・冷たさの時計：組み立ての台に出した具材のトレーは、作業室の温度へ温まっていく。
     10℃をこえていた時間で減点、20分をこえたトレーの分は出荷しない。トレーが大きいほど長く外にいる、
     小さいほど冷蔵庫へ取りに行く回数がふえて組み立てが止まる。ベルトが詰まって止まっているあいだも温まる。
   ・水の時計：レタスの水切りが短いとパンにしみる（朝に売れるまでの時間に比例）。長すぎると葉が傷む。
   ・熱の時計：ゆで卵とカツは10℃まで冷えないと、はさめない。
   ・作業室を冷やすほど安全だが、人がのせる持ち場の手がかじかんで遅くなり、電気代がかかる（盛り付け機は遅くならない）。
   ・DOM を使わない。設定は data/factory.json の sand。数字はすべてゲームの仮の目安。
   ===================================================================== */
(function(root){
'use strict';

const LC={IDLE:-1,CHANGE:10,TRIP:11,WAIT:12,DONE:13,JAM:14};   // 組み立ての状態（0〜4は品の番号）
const ING=['egg','lettuce','katsu','fruit'];
function rng(seed){let a=seed>>>0;return function(){a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
function gauss(r){let u=0,v=0;while(u===0)u=r();while(v===0)v=r();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);}
function hm(t){t=Math.round(t);const h=Math.floor(t/60)%24,m=t%60;return h+':'+String(m).padStart(2,'0');}
const sk={winter:1,mid:2,summer:3};
const YEN_SEASON={winter:0.7,mid:1,summer:1.5};

function orders(D,seed,season){const A=D.sand;const r=rng((seed*40503+(sk[season]||0)*131)>>>0);
  const total=Math.max(100,Math.round(A.forecast*(1+A.forecastSd*gauss(r))/10)*10);
  const out={};for(const p of A.products)out[p.id]=Math.max(0,Math.round(total*p.share*(1+A.orderSd*gauss(r))/10)*10);return out;}
/* トレーが10℃をこえるまでの分（作業室の温度が10℃以下なら、こえない） */
function safeMin(A,room){const c=A.cold;if(room<=c.safe)return Infinity;return Math.log((room-c.fridge)/(room-c.safe))/c.k;}
/* 水切りのあとに残る水の割合 */
function waterLeft(A,spin){return Math.exp(-spin/A.water.tau);}
/* 掃除の分：前の品にあって次の品にないアレルゲンがあれば長い */
/* ベルトの速さ：人がのせる持ち場が追いつく速さまで（盛り付け機だけの品は、決めたベルトの速さ） */
function beltRate(A,prod,speed,staff,hand){if(!prod.hands)return speed;return Math.min(speed,staff*A.belt.handRate*hand/prod.hands);}
function washMin(A,from,to){const P=id=>A.products.find(p=>p.id===id);const a=P(from).allergen,b=P(to).allergen;return a.some(x=>!b.includes(x))?A.wash.long:A.wash.short;}

function simulate(D,cfgIn){
  const A=D.sand;const cfg=Object.assign({},A.defaults,cfgIn||{});
  const S=D.seasons[cfg.season]||D.seasons.mid;
  const T0=D.start,T1=D.end,N=T1-T0+1;
  const P={};A.products.forEach((p,k)=>{P[p.id]=p;p._k=k;});
  const od=orders(D,cfg.seed,cfg.season);const order=Object.values(od).reduce((a,b)=>a+b,0);
  const seq=(A.orders[cfg.order]||A.orders.safe).seq.slice();
  const room=cfg.room,hand=A.room.hand[String(room)]||1,C=A.cold,PR=A.prep;
  const ev=[];const log=(t,k,msg)=>ev.push({t,k,msg});
  const tgt=(id,t)=>t<D.orderConfirm?A.forecast*P[id].share:od[id];
  const atgt=(id,t)=>Math.ceil(tgt(id,t)*(1+(A.spare||0)));   // 組み立ての目標（はじく分の予備こみ）
  const needIng=(ing,t)=>A.products.reduce((a,p)=>a+tgt(p.id,t)*(p.use[ing]||0),0)*1.03;

  /* 具材の在庫（できた順の山）と、仕込みの途中の山 */
  const stock={egg:[],lettuce:[],katsu:[],fruit:[]};const made={egg:0,lettuce:0,katsu:0,fruit:0};const lots=[];
  const have=ing=>stock[ing].reduce((a,x)=>a+x.left,0);
    let shellHit=null;   // 殻のかけらが残った回を、使うときに見つける
  const take=(ing,u,t)=>{let age=0,left=u;while(left>1e-9&&stock[ing].length){const x=stock[ing][0];
      if(x.shell){x.shell=false;shellHit={no:x.no,units:x.left,t};made[ing]-=x.left;stock[ing].shift();continue;}   // 捨てた分は、卵の係がもう1回作る
      const q=Math.min(x.left,left);x.left-=q;left-=q;age+=q*(t-x.tReady);if(x.left<=1e-9)stock[ing].shift();}return u?age/u:0;};
  const ready=(lot,t)=>{lot.st='ready';lot.tReady=t;stock[lot.ing].push({left:lot.units,tReady:t,no:lot.no,shell:lot.shell});};
  let boiler=null,peeler=null,checker=null,washer=null,fryer=null,fruitP=null;const bath=[],chill=[];
  // 夜ごとのくじ（条件を変えても、同じ時刻に同じくじを引く）
  const rl=rng((cfg.seed*92821+(sk[cfg.season]||0)*17)>>>0);const roll=()=>new Float32Array(N).map(()=>rl());
  const feedRoll=roll(),feedU=roll(),depRoll=roll(),depU=roll(),shellRoll=new Float32Array(40).map(()=>rl());
  const pick=([a,b],u)=>a+Math.floor(u*(b-a+1));
  const newLot=(ing,t)=>{const no=lots.filter(x=>x.ing===ing).length+1;const lot={ing,no,units:PR[ing].lot,t0:t,st:'start',T:null,tReady:null,shell:ing==='egg'&&shellRoll[(no-1)%40]<PR.egg.shellMiss};lots.push(lot);made[ing]+=lot.units;return lot;};
  const want=(ing,t)=>made[ing]<needIng(ing,t)-1e-6;

  /* 組み立て */
  let pi=0,cur=null,stop=null,tray=null,planDone=null,firstAsm=null,trips=0,changes=0,shellLost=0;const jams={feed:0,dep:0,shell:0,min:0};const got={};A.products.forEach(p=>got[p.id]=0);
  const chunks=[];   // 組み立てた分（締め → カット・包装を待つ）
  const waitIng={egg:0,lettuce:0,katsu:0,fruit:0};const waitLogged=new Set();let expWarn=0,expBad=0,trayNo=0;
  const res={};A.products.forEach(p=>res[p.id]={id:p.id,name:p.name,order:od[p.id],made:0,good:0,late:0,bad:0,cutRej:0,score:0,why:{cold:0,water:0,fresh:0,bruise:0}});
  let packed=0,packedBy=0,lastPack=null;
  const agg={rate:new Float32Array(N),jam:new Int8Array(N),line:new Int8Array(N).fill(LC.IDLE),trayT:new Float32Array(N).fill(NaN),trayExp:new Float32Array(N),made:new Float32Array(N),packed:new Float32Array(N),shime:new Float32Array(N),
    cut:new Float32Array(N),stock:{},st:{boil:new Int8Array(N),bath:new Int8Array(N),peel:new Int8Array(N),check:new Int8Array(N),wash:new Int8Array(N),fry:new Int8Array(N),chill:new Int8Array(N),fruit:new Int8Array(N)},
    bathT:[],chillT:[]};
  for(const g of ING)agg.stock[g]=new Float32Array(N);
  const wl=waterLeft(A,cfg.spin);
  log(T0,'info',`${S.label}の夜。作業室は${room}℃（手の速さ ×${hand}）。具材のトレーは冷蔵庫${C.fridge}℃から出すと、${isFinite(safeMin(A,room))?`${Math.round(safeMin(A,room))}分ほどで${C.safe}℃をこえます`:`${C.safe}℃をこえません`}。`);
  log(T0,'info',`ベルトは1分${cfg.speed}組。人がのせる持ち場に${cfg.staff}人で、${A.products.filter(p=>p.hands).map(p=>`${p.name.replace('サンド','')}は1分${Math.round(beltRate(A,p,cfg.speed,cfg.staff,hand))}組`).join('・')}まで（たまごは盛り付け機なので${cfg.speed}組）。`);
  log(T0,'info',`見込みは${A.forecast.toLocaleString()}個。仕込みは${hm(cfg.prepStart)}から、組み立ては${hm(cfg.start)}から。レタスの水切り${cfg.spin}分で、水が${Math.round(wl*100)}%残ります。`);

  for(let i=0;i<N;i++){const t=T0+i;
    if(t===D.orderConfirm)log(t,'order',`注文が確定：${order.toLocaleString()}個（${A.products.map(p=>p.name.replace('サンド','')+od[p.id]).join('・')}）。仕込みの数を合わせ直します。`);
    /* ---- 仕込み ---- */
    if(t>=cfg.prepStart){
      // たまごサラダ：スチーマー → 冷水 → 殻むき機 → 人が確かめる → 和える
      if(checker&&t-checker.tCheck>=PR.egg.check+PR.egg.mixMin){ready(checker,t);log(t,'info',`たまごサラダ${checker.no}回目ができました（${checker.units}個分）。`);checker=null;}
      if(peeler&&t-peeler.tPeel>=PR.egg.peel&&!checker){checker=peeler;checker.st='check';checker.tCheck=t;peeler=null;}
      if(!peeler){const q=bath.findIndex(x=>x.T<=C.safe);if(q>=0){peeler=bath.splice(q,1)[0];peeler.st='peel';peeler.tPeel=t;}}
      for(const x of bath)x.T+=(PR.egg.water-x.T)*PR.egg.k;
      if(boiler&&t-boiler.tBoil>=PR.egg.steam){if(bath.length<PR.egg.bath){boiler.st='bath';boiler.T=95;boiler.tBath=t;bath.push(boiler);boiler=null;}}
      if(!boiler&&want('egg',t)){boiler=newLot('egg',t);boiler.st='boil';boiler.tBoil=t;}
      // レタス
      const sortMin=Math.ceil(PR.lettuce.lot/(cfg.sorters*PR.lettuce.sortRate));
      if(washer&&t-washer.tWash>=sortMin+PR.lettuce.wash+cfg.spin){ready(washer,t);washer=null;}
      if(!washer&&want('lettuce',t)){washer=newLot('lettuce',t);washer.st='wash';washer.tWash=t;}
      // カツ：揚げる → 急速冷却機
      for(let j=chill.length-1;j>=0;j--){const x=chill[j];x.T+=(PR.katsu.air-x.T)*PR.katsu.k;if(x.T<=C.safe){chill.splice(j,1);ready(x,t);}}
      if(fryer&&t-fryer.tFry>=PR.katsu.fry){if(chill.length<PR.katsu.chill){fryer.st='chill';fryer.T=PR.katsu.from;fryer.tChill=t;chill.push(fryer);fryer=null;}}
      if(!fryer&&want('katsu',t)){fryer=newLot('katsu',t);fryer.st='fry';fryer.tFry=t;}
      // フルーツとクリーム
      if(fruitP&&t-fruitP.tF>=PR.fruit.min){ready(fruitP,t);fruitP=null;}
      if(!fruitP&&want('fruit',t)){fruitP=newLot('fruit',t);fruitP.st='fruit';fruitP.tF=t;}
    }
    /* ---- 組み立て ---- */
    let code=LC.IDLE,rateNow=0;
    if(t>=cfg.start&&planDone==null){
      if(stop&&t>=stop.until){if(stop.kind===LC.CHANGE)cur=stop.to;stop=null;}
      if(shellHit&&!stop){const h=shellHit;shellHit=null;const m=A.belt.shellStop;stop={kind:LC.JAM,until:t+m,why:'shell'};jams.shell++;jams.min+=m;shellLost+=h.units;
        log(t,'bad',`盛り付け機に入れる前のたまごサラダ（${h.no}回目）に殻のかけらが見つかりました。この回の残り${Math.round(h.units)}個分を捨て、ホッパーを洗って${m}分止めます。`);}
      if(stop)code=stop.kind;
      else{
        while(pi<seq.length&&got[seq[pi]]>=atgt(seq[pi],t)-1e-6)pi++;
        if(pi>=seq.length&&t>=D.orderConfirm){planDone=t;code=LC.DONE;if(tray){tray=null;}log(t,'info',`注文の分を全部組み立てました（${hm(t)}）。`);}
        else if(pi<seq.length){const id=seq[pi];
          if(cur==null)cur=id;
          if(cur!==id){if(tray){for(const g in P[cur].use)stock[g].unshift({left:tray.left*P[cur].use[g],tReady:t,no:0});tray=null;}
            const m=washMin(A,cur,id);stop={kind:LC.CHANGE,until:t+m,to:id};changes++;code=LC.CHANGE;
            log(t,'line',`品の切り替え：${P[cur].name}→${P[id].name}。${m===A.wash.long?'アレルゲン（'+P[cur].allergen.filter(x=>!P[id].allergen.includes(x)).join('・')+'）が残らないよう全部洗って':'台を拭いて'}${m}分止まります。`);}
          else{
            if(!tray||tray.left<=1e-6){tray=null;const need=atgt(id,t)-got[id];
              const avail=Math.min(...Object.keys(P[id].use).map(g=>have(g)/P[id].use[g]));
              const u=Math.min(cfg.tray,need,Math.floor(avail));
              if(u<1){code=LC.WAIT;for(const g in P[id].use)if(have(g)/P[id].use[g]<1)waitIng[g]++;
                if(!waitLogged.has(id)){waitLogged.add(id);const g=Object.keys(P[id].use).find(g=>have(g)/P[id].use[g]<1);log(t,'warn',`${P[id].name}の${PR[g].name}がまだできていないので、組み立てが待っています。`);}}
              else{let fresh=0;for(const g in P[id].use){const age=take(g,u*P[id].use[g],t);if(g==='fruit')fresh=Math.max(0,age-PR.fruit.freshFree)*PR.fruit.freshPerMin;}
                tray={prod:id,size:u,left:u,T:C.fridge,exp:0,fresh,no:++trayNo};trips++;stop={kind:LC.TRIP,until:t+A.trip};code=LC.TRIP;
                if(firstAsm==null){firstAsm=t;log(t,'info',`組み立てを始めました。最初は${P[id].name}。`);}}}
            if(tray&&code!==LC.TRIP&&!stop){const n=Math.min(tray.left,beltRate(A,P[id],cfg.speed,cfg.staff,hand),atgt(id,t)-got[id]);
              if(n>0){tray.left-=n;got[id]+=n;res[id].made+=n;chunks.push({prod:id,n,exp:tray.exp,fresh:tray.fresh,tAsm:t,ready:t+cfg.shime});code=P[id]._k;rateNow=n;
                // 食パンの供給機・盛り付け機の詰まり（ベルトが止まる。トレーは台の上で温まり続ける）
                const BF=A.belt;
                if(feedRoll[i]<BF.feeder.perMin){const m=pick(BF.feeder.min,feedU[i]);stop={kind:LC.JAM,until:t+1+m,why:'feed'};jams.feed++;jams.min+=m;if(jams.feed<=3)log(t+1,'line',`食パンの供給機でパンが重なって詰まりました。ベルトを${m}分止めて直します。`);}
                else if(P[id].deposit&&depRoll[i]<BF.deposit.perMin){const m=pick(BF.deposit.min,depU[i]);stop={kind:LC.JAM,until:t+1+m,why:'dep'};jams.dep++;jams.min+=m;if(jams.dep<=3)log(t+1,'line',`盛り付け機の口に${id==='fruit'?'クリーム':'たまごサラダ'}が詰まりました。ベルトを${m}分止めて口を洗います。`);}}}}}}
      if(code===LC.IDLE&&planDone!=null)code=LC.DONE;}
    else if(planDone!=null)code=LC.DONE;
    // 出ているトレーは作業室の温度へ
    if(tray){tray.T+=(room-tray.T)*C.k;if(tray.T>C.safe){tray.exp++;
      if(tray.exp===C.free+1&&expWarn++<3)log(t,'warn',`${P[tray.prod].name}のトレー${tray.no}が${C.safe}℃をこえて${C.free}分たちました（${tray.T.toFixed(1)}℃・残り${Math.round(tray.left)}個分）。`);
      if(tray.exp===C.limit+1&&expBad++<3)log(t,'bad',`${P[tray.prod].name}のトレー${tray.no}が${C.safe}℃をこえて${C.limit}分。このあとの分は出荷できません。`);}}
    /* ---- 締め → カット・包装 ---- */
    let cap=Math.min(A.pack.cut,cfg.packers*A.pack.perPacker),cutNow=0;
    while(cap>1e-9&&chunks.length&&chunks[0].ready<=t){const ch=chunks[0];const q=Math.min(ch.n,cap);ch.n-=q;cap-=q;cutNow+=q;const r=res[ch.prod];
      if(ch.exp>C.limit){r.bad+=q;}
      else{const rj=A.cut.reject+Math.max(0,A.shime.maxReject*(1-cfg.shime/A.shime.good));const good=q*(1-rj);r.cutRej+=q-good;
        const lt=P[ch.prod].use.lettuce||0;
        const wP=lt?wl*(A.water.sale+1440-ch.tAsm)/60*A.water.perHour*lt:0,bP=lt&&cfg.spin>A.water.bruise?(cfg.spin-A.water.bruise)*A.water.bruisePer*lt:0,cP=Math.max(0,ch.exp-C.free)*C.perMin;
        r.score+=good*Math.max(0,100-wP-bP-cP-ch.fresh);r.why.water+=good*wP;r.why.bruise+=good*bP;r.why.cold+=good*cP;r.why.fresh+=good*ch.fresh;
        if(t<D.deadline){r.good+=good;packedBy+=good;}else r.late+=good;packed+=good;}
      lastPack=t;if(ch.n<=1e-9)chunks.shift();}
    /* ---- 記録 ---- */
    agg.line[i]=code;agg.rate[i]=rateNow;agg.jam[i]=stop&&stop.kind===LC.JAM&&code===LC.JAM?({feed:1,dep:2,shell:3}[stop.why]||0):0;agg.trayT[i]=tray?tray.T:NaN;agg.trayExp[i]=tray?tray.exp:0;agg.made[i]=Object.values(got).reduce((a,b)=>a+b,0);agg.packed[i]=packed;agg.cut[i]=cutNow;
    agg.shime[i]=chunks.reduce((a,c)=>a+c.n,0);for(const g of ING)agg.stock[g][i]=have(g);
    const st=agg.st;st.boil[i]=boiler?1:0;st.bath[i]=bath.length;st.peel[i]=peeler?1:0;st.check[i]=checker?1:0;st.wash[i]=washer?1:0;st.fry[i]=fryer?1:0;st.chill[i]=chill.length;st.fruit[i]=fruitP?1:0;
    agg.bathT.push(bath.map(x=>x.T));agg.chillT.push(chill.map(x=>x.T));
    if(t===D.deadline)log(t,'ship',`${hm(t)}、包装の締め切り。ここまでのサンド${Math.floor(packedBy).toLocaleString()}個をチルドの箱で${D.ship.via}へ送ります。`);
  }
  /* ---- 朝の答え合わせ ---- */
  const ranks=D.quality.ranks;
  const prods=A.products.map(p=>{const r=res[p.id];const good=Math.floor(r.good+1e-6);const shipped=Math.min(r.order,good);const g=r.good+r.late;
    const score=g?Math.round(r.score/g):null;const avg=k=>g?r.why[k]/g:0;
    return {id:p.id,name:p.name,order:r.order,shipped,short:r.order-shipped,surplus:good-shipped,late:Math.floor(r.late),bad:Math.round(r.bad),cutRej:Math.round(r.cutRej),score,rank:score==null?'—':ranks.find(x=>score>=x[0])[1],
      why:{cold:avg('cold'),water:avg('water'),bruise:avg('bruise'),fresh:avg('fresh')}};});
  const shipped=prods.reduce((a,x)=>a+x.shipped,0);
  const waits=ING.map(g=>[`${PR[g].name}を待つ`,waitIng[g]]);const neck=waits.slice().sort((a,b)=>b[1]-a[1])[0];
  const lineStart=firstAsm||cfg.start,lineEnd=Math.max(planDone||T1,lineStart+30);
  const prepEnd=Math.max(cfg.prepStart+30,...lots.map(l=>l.tReady||T1));
  const Cc=D.cost,AC=A.cost;let labor=0;
  for(let t=cfg.prepStart;t<prepEnd;t++)labor+=(t>=Cc.nightFrom?Cc.nightRate:1)*AC.wage/60*(AC.prepFixed+cfg.sorters);
  for(let t=lineStart;t<lineEnd;t++)labor+=(t>=Cc.nightFrom?Cc.nightRate:1)*AC.wage/60*cfg.staff;
  const packEnd=Math.max(lastPack||lineEnd,lineEnd);for(let t=lineStart;t<packEnd;t++)labor+=(t>=Cc.nightFrom?Cc.nightRate:1)*AC.wage/60*cfg.packers;
  const coldYen=Math.round((A.room.yen[String(room)]||20)*(packEnd-lineStart)*(YEN_SEASON[cfg.season]||1));
  const chillYen=agg.st.chill.reduce((a,x)=>a+(x?A.cost.chillerPerMin:0),0);
  const food=Math.round(A.products.reduce((a,p)=>a+res[p.id].made*p.yen,0));
  const machine=AC.machineYen||0;const total=Math.round(labor+coldYen+chillYen+food+machine);
  const summary={order,forecast:A.forecast,shipped,short:order-shipped,prods,waits,neck,trips,changes,firstAsm,planDone,lastPack,lots:lots.length,
    bad:prods.reduce((a,x)=>a+x.bad,0),late:prods.reduce((a,x)=>a+x.late,0),cutRej:prods.reduce((a,x)=>a+x.cutRej,0),surplus:prods.reduce((a,x)=>a+x.surplus,0),
    water:wl,safeMin:safeMin(A,room),hand,
    jams,shellLost:Math.round(shellLost),yen:{labor:Math.round(labor),cold:coldYen,chill:chillYen,food,machine,total,perUnit:shipped?Math.round(total/shipped):null}};
  if(planDone==null)log(T1,'bad','朝までに、注文の分を組み立て終わりませんでした。');
  if(lastPack!=null)log(lastPack,'info',`最後のカット・包装が終わりました（${hm(lastPack)}）。`);
  ev.sort((a,b)=>a.t-b.t);
  return {cfg,season:S,T0,T1,N,agg,ev,summary,lots,seq,od};
}

root.SandCore={LC,ING,simulate,orders,safeMin,waterLeft,washMin,beltRate,hm};
})(typeof window!=='undefined'?window:globalThis);
