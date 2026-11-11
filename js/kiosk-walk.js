/* =====================================================================
   中に入って歩く店の計算（港駅の売店をつくる回の2回目・2026-11-10）
   ・KioskCore.simulate が、設定に walk があるとき（港駅の店）だけ使う。緑ヶ丘の店（walk なし）は今までと同じ道を通る。
   ・ここで決めること：交代で働く人・客船の客が来る時刻／店にいる時間（長いほどかごの品が増える）／
     有人レジ1台とセルフ1台（セルフで迷うと店員が呼ばれ、有人レジが止まる）／列が床の印をこえると最後尾が帰る／
     イートイン（席・レンジ・お湯。席がうまっていると持ち帰る）。
   ・イートインの出来事（range・eatin・eatfull）の from は、その人の会計が終わった時刻（買った出来事の end と同じ。3回目の絵で人をつなぐため。計算は変えない）。
   ・乱数は自分の種（'walk'）だけを使う。設定は港駅の店の設定ファイルの walk（js/minato-store-core.js が合わせて cfg.walk にする）。数字はすべて仮。
   ・A4（2026-11-11・設定に age・care・localShelve・trash があるときだけ）：年齢確認（セルフでお酒→店員が呼ばれる・有人は若く見える客層だけ）／
     気配り（有人レジへ案内 guide・もう1人がレジに入る cover。強さは店員の「接客」careOf）／地元のお店の品は店員が並べてから棚へ（shelveAt）／
     ごみだけの人・ごみのついでに買う人（trash）。気配りの乱数は自分の種（'care'）、ごみの人は（'trash'）。
   ・A5（2026-11-11・設定に carry・newPs・rush・self.svcPs があるときだけ）：持ち物（carryOf。人ごとの種 'carry'）／新しい客層4つ（市場帰り・船に乗る・
     イベント帰り・セミナー。種 'newps'・催しの日は 'hall'）／会計の速さ（セルフは客層ごと self.svcPs・急いでいる人 rush は両方のレジで速い。種 'rush'）。
   ・DOM もゲーム本体の変数も使わない。
   ===================================================================== */
(function(root){
'use strict';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
/* h：KioskCore の道具（hash・rng・poisson・pickW）。o：{R, DW, O0, O1, ageMix} */
function begin(cfg,state,ctx,h,o){const W=cfg.walk,r=h.rng(h.hash(state.seed,ctx.day,state.st,state.place,'walk'));
  const gz=()=>{const u=Math.max(1e-9,r()),v=r();return Math.sqrt(-2*Math.log(u))*Math.cos(6.2832*v);};
  const S={shift:0,cruise:0,self:0,staffed:0,selfHelp:0,queueLeft:0,eatIn:0,eatFull:0,range:0,stay:0,stayN:0,items:0,ageSelf:0,ageF:0,guide:0,cover:0,regStop:0,trashOnly:0,trashBuy:0,trash:0,newPs:{},carry:{},seek:0,seekLeft:0,rush:0,capped:0};
  const AG=W.age||null,CR=W.care||null,TS=W.trash||null,CA=W.carry||null,NP=W.newPs||null,RU=W.rush||null,rC=h.rng(h.hash(state.seed,ctx.day,state.st,state.place,'care')),extraEv=[];
  /* 気配り（A4）：その店員がするか。接客がていねい・ふつうの店員はたいてい、そっけない店員とやる気の低い店員はときどき（数字は仮） */
  const careP=w=>{if(!CR)return 0;const p=w.p,lo=(p.skill&&p.skill.care||1)<=(CR.loCare??0.92)||(p.morale??60)<(CR.loMorale??45);return lo?(CR.lo??0.35):(CR.hi??0.9);};
  const ageItems=items=>items.filter(([pid])=>B.ix.G[B.ix.P[pid].genre].age).length;
  let B=null,regFree=o.O0,selfFree=o.O0,rangeFree=o.O0;const qS=[],qF=[],seats=new Array((W.eatIn&&W.eatIn.seats)||0).fill(o.O0);
  /* 来る人：交代で働く人（毎日）・客船の客（ctx.cruise があり、強さ＞0 のときだけ） */
  function visitors(){const out=[],PS=cfg.personas,shf=PS.find(p=>p.id==='shf'),cru=PS.find(p=>p.id==='cru');
    const one=(t,ps,a,em,tag)=>{if(t<o.O0||t>=o.O1)return;const hh=Math.floor(t/60);out.push({t,p:ps==='cru'?2:0,a,ps,em,dw:o.DW[hh]||1.5,[tag]:true});};
    if(shf&&shf.when&&shf.when.shifts){const w=shf.when,per=w.emp*w.shiftShare/3*w.railShare*w.visit*(shf.strength??1);
      for(const s of w.shifts){for(const [a,b] of [[s*60-w.before,s*60],[s*60,s*60+w.after]]){const n=h.poisson(per,r);
        for(let i=0;i<n;i++){const t=a+r()*(b-a),age=Math.max(1,h.pickW(w.age,r));one(t,'shf',age,r()<w.em,'shf');S.shift++;}}}}
    const C=ctx.cruise;if(cru&&C&&(cru.strength||0)>0&&C.pax>0){const n=h.poisson(C.pax*(cru.when.visit||0.1)*cru.strength,r);
      for(let i=0;i<n;i++){const t=C.from+r()*Math.max(1,C.to-C.from);one(t,'cru',r()<0.5?3:4,r()<0.7,'cru');S.cruise++;}}
    /* ごみの人（A4・設定 trash があるときだけ）：ごみだけ捨てに来る人（買わない・出来事 trash）と、ごみのついでにお菓子を買う人（来る人に足す・きっかけ「ついでに」） */
    if(TS){const rt=h.rng(h.hash(state.seed,ctx.day,state.st,state.place,'trash')),hs=TS.hours||[[6,22]],len=hs.reduce((a,[x,y])=>a+(y-x),0),PSW=TS.ps||{hou:1},ks=Object.keys(PSW);
      const at=()=>{let u=rt()*len;for(const [x,y] of hs){if(u<y-x)return (x+u)*60;u-=y-x;}return hs[0][0]*60;};
      const nO=h.poisson(TS.only||0,rt);for(let i=0;i<nO;i++){const t=at(),ps=ks[h.pickW(ks.map(k=>PSW[k]),rt)];if(t<o.O0||t>=o.O1)continue;extraEv.push({t,k:'trash',ps});}
      const nB=h.poisson(TS.buy||0,rt);for(let i=0;i<nB;i++){const t=at(),ps=ks[h.pickW(ks.map(k=>PSW[k]),rt)];if(t<o.O0||t>=o.O1)continue;out.push({t,p:3,a:(TS.age||{})[ps]??2,ps,em:rt()<(TS.em??0.6),dw:o.DW[Math.floor(t/60)]||1.5,trash:true});S.trashBuy++;}}
    /* 新しい客層4つ（A5・設定 newPs があるときだけ。港駅の店だけ）：市場帰り・船に乗る人・イベント帰り・セミナーに行く人。乱数は自分の種（'newps'）、港浜ホールの催しの日は（'hall'） */
    if(NP){const rn=h.rng(h.hash(state.seed,ctx.day,state.st,state.place,'newps')),rh=h.rng(h.hash(state.seed,ctx.day,'hall')),dk=ctx.cond&&ctx.cond.day||'wd';
      const inH=(hs,u)=>{const len=hs.reduce((a,[x,y])=>a+(y-x),0);let x=u*len;for(const [a,b] of hs){if(x<b-a)return (a+x)*60;x-=b-a;}return hs[0][0]*60;};
      const add=(id,n,tOf)=>{const N=NP[id];if(!N||!cfg.personas.some(p=>p.id===id))return;for(let i=0;i<n;i++){const t=tOf(),hh=Math.floor(t/60);if(t<o.O0||t>=o.O1)continue;
        out.push({t,p:N.p||0,a:Math.max(0,h.pickW(N.a||[0,1],rn)),ps:id,em:rn()<(N.em??0.6),dw:o.DW[hh]||1.5,np:id});S.newPs[id]=(S.newPs[id]||0)+1;}};
      const hall={};for(const id of Object.keys(NP)){const N=NP[id];if(N.days)hall[id]=rh()<(N.days[dk]||0);}   // 港浜ホールの催しがある日か（同じ日なら同じ）
      for(const id of Object.keys(NP)){const N=NP[id];if(N.closed&&((N.closed.day||[]).includes(dk)||(N.closed.dow||[]).includes(ctx.dow)))continue;
        if(N.days&&!hall[id])continue;
        const hs=N.hours||[[8,18]];
        if(N.n)add(id,h.poisson(N.n,rn),()=>inH(hs,rn()));
        if(N.base)add(id,h.poisson(N.base[dk]||0,rn),()=>inH(hs,rn()));
        const C=ctx.cruise;if(N.cruise&&C&&C.pax>0&&cru&&(cru.strength||0)>0){const [b0,b1]=N.cruiseBefore||[90,20];add(id,h.poisson(C.pax*N.cruise,rn),()=>C.to-b0+rn()*(b0-b1));}}}
    return out;}
  /* 持ち物（A5・設定 carry があるときだけ）：買い物に効く持ち物を、人ごとの種（'carry'）で決める。同じ人なら同じ。null＝なし */
  const carryOf=v=>{if(v.carry!==undefined)return v.carry;v.carry=null;if(!CA)return null;
    const rc=h.rng(h.hash(state.seed,ctx.day,state.st,state.place,'carry',Math.round(v.t*1000),v.ps,v.a)),hh=Math.floor(v.t/60),out=[];let n=0;
    for(const k of CA.kinds){const u=rc();if(k.pay==='em'&&!v.em||k.pay==='cash'&&v.em)continue;
      let p;if(k.wx){if(!(ctx.cond&&k.wx.includes(ctx.cond.wx)))continue;p=k.p??0.8;}else p=(k.ps&&k.ps[v.ps])??k.psDefault??0;
      if(k.hours&&k.hours.some(([a,b])=>hh>=a&&hh<b))p*=k.hMul||1;
      if(u>=p)continue;if(!k.wx){if(n>=(CA.max||2))continue;n++;}
      out.push(k.id);S.carry[k.id]=(S.carry[k.id]||0)+1;if(k.trash)S.trash++;}   // 空き缶・ペットボトル：まずごみ箱へ（ごみのたまる早さに足す）
    if(out.length)v.carry=out;return v.carry;};
  const KI={};if(CA)for(const k of CA.kinds)KI[k.id]=k;
  const has=(v,id)=>{const c=carryOf(v);return !!(c&&c.includes(id));};
  /* 持ち物で、ほしいジャンルの重さが変わる（マイボトル・濡れた傘・子ども・空き缶）。傘を持っていない人は雨の日に傘を買いやすい */
  const carryG=(v,g)=>{if(!CA)return 1;const c=carryOf(v);let m=1;if(c)for(const id of c){const k=KI[id];if(k&&k.genre&&k.genre[g]!=null)m*=k.genre[g];}
    const U=KI.umb;if(U&&U.without&&U.without[g]!=null&&ctx.cond&&U.wx.includes(ctx.cond.wx)&&!(c&&c.includes('umb')))m*=U.without[g];return m;};
  /* 持ち物で、そのジャンルを買わない（濡れた傘の人は傘を買わない）。かごに足す品・なんとなく手に取る品にも効かせる */
  const block=(v,g)=>{if(!CA)return false;if(v.cb===undefined){const c=carryOf(v);v.cb=null;if(c)for(const id of c){const k=KI[id];if(k&&k.genre)for(const gg in k.genre)if(k.genre[gg]===0)(v.cb||(v.cb={}))[gg]=1;}}return !!(v.cb&&v.cb[g]);};   // 人ごとに1回だけ調べる
  /* 酔い止めを探す（乗船券の人）：売っていないので、leave の人は「置いていない」で帰り、ほかは代わりのジャンル。null＝探さない */
  const seek=v=>{const K=KI.ticket;if(!K||!has(v,'ticket'))return null;const rs=h.rng(h.hash(state.seed,ctx.day,'seek',Math.round(v.t*1000),v.ps));
    if(rs()>=(K.seek??0.5))return null;S.seek++;if(rs()<(K.leave??0.5)){S.seekLeft++;return {miss:true,want:'酔い止め'};}return {genre:K.alt||'gummy',want:'酔い止め'};};
  /* 両手がふさがる荷物：買う品は maxItems まで（かごを持てない） */
  const cap=(v,items)=>{const K=KI.load;if(!K||!has(v,'load'))return;const m=K.maxItems||2;let n=0;for(let i=0;i<items.length;i++){if(n>=m){items.length=i;S.capped++;break;}if(items[i][1]>m-n)items[i][1]=m-n;n+=items[i][1];}};
  /* 急いでいる人（A5・設定 rush があるときだけ）：電車までの余りが短く、店にいる時間も短い人。乱数は人ごとの種（'rush'） */
  const rushOf=v=>{if(v.rush!==undefined)return v.rush;v.rush=false;if(!RU)return false;const rr=h.rng(h.hash(state.seed,ctx.day,'rush',Math.round(v.t*1000),v.ps));
    const slack=rr()*2*Math.max(0.5,v.dw||1.5);v.rush=slack<(RU.pad??1.5)&&stayOf(v)<=(RU.stay??3);return v.rush;};
  /* ごみのついでに買う人のほしいジャンル（A4）：お菓子の棚だけ */
  const trashG=(v,g)=>v.trash&&TS?((TS.genre||{})[g]||0):1;
  /* どこから・どこへ・なぜ（2026-11-11・設定 walk.trip があるときだけ）：客層とその時台に合う道を1つ選ぶ。乱数は自分の種（'trip'）だけ */
  const TR=W.trip&&W.trip.routes||null,rT=TR?h.rng(h.hash(state.seed,ctx.day,state.st,state.place,'trip')):null;
  const tripOf=v=>{if(!TR)return null;if(v.trip!==undefined)return v.trip;const hh=Math.floor(v.t/60),off=W.trip.off??0.05;
    const L=TR.filter(x=>x.ps.includes(v.ps));if(!L.length){v.trip=null;return null;}
    const ws=L.map(x=>(x.w||1)*((x.hours||[]).some(([a,b])=>hh>=a&&hh<b)?1:off));v.trip=L[h.pickW(ws,rT)];return v.trip;};
  const gMul=(v,g)=>{const x=tripOf(v);return (x&&x.genre&&x.genre[g]!=null?x.genre[g]:1)*(CA?carryG(v,g):1);};   // A5：持ち物の分もかける
  /* 店にいる分（人ごと。対数のぶれ）。道（trip）の stay 倍をかける */
  const stayOf=v=>{if(v.stay==null){const sp=CA&&has(v,'phone')?(KI.phone.stay||1):1;const m=W.stay[v.ps]||3.5;v.stay=+(m*Math.exp((W.stay.sd||0.3)*gz())).toFixed(2);if(v.imp)v.stay=+(v.stay*0.6).toFixed(2);const x=tripOf(v);if(x&&x.stay)v.stay=+(v.stay*x.stay).toFixed(2);if(sp!==1)v.stay=+(v.stay*sp).toFixed(2);}return v.stay;};   // A5：スマホだけの人はまっすぐ寄り
  const basketMul=v=>{const K=W.stayBasket||{};return clamp(Math.pow(stayOf(v)/(K.ref||3.5),K.pow||0.5),K.min||0.6,K.max||2)*(CA&&has(v,'cart')?(KI.cart.basket||1):1);};   // A5：シルバーカーは少し多めに
  const qLen=(q,t)=>{let n=0;for(let i=q.length-1;i>=0;i--)if(q[i]>t)n++;return n;};
  /* 会計の計画（まだ決めない）。svc＝秒（店員の速さで割る前）。返すもの：{lane:'f'有人|'s'セルフ, k, start, end, wait, qn, full} */
  function plan(v,items,svc){const t=v.t+stayOf(v),SF=W.self||{},I=B.ix,noSelf=items.some(([pid])=>(SF.noSelf||[]).includes(I.P[pid].genre)||(!AG&&I.G[I.P[pid].genre].age));   // A4：年齢確認の設定があれば、お酒もセルフで買える（店員が呼ばれて確認する）
    const [k,eff]=B.pickS(t),fStart=Math.max(eff,regFree),sStart=Math.max(t,selfFree);
    let lane='f';
    if(!noSelf&&(W.registers.self||0)>0){let pk=(SF.pick||{})[v.ps]??0.5;if(CA){if(has(v,'phone'))pk=Math.min(0.95,pk*(KI.phone.pick||1));if(has(v,'coin'))pk*=KI.coin.pick??1;}   // A5：スマホだけの人はセルフへ・小銭入れの人は有人へ
      const like=r()<pk,sw=SF.switch||3;
      lane=like?(sStart>fStart+sw?'f':'s'):(fStart>sStart+sw&&r()<0.5?'s':'f');}
    if(lane==='f'&&k<0)lane=noSelf?'f':'s';
    // 年齢確認（A4）：nA＝年齢の確認がいる品の数（会計の秒数 svc には、品ごとに service.age が入っている）
    const nA=AG?ageItems(items):0,young=nA>0&&(AG.young||[]).includes(v.ps);
    // 気配り：有人レジへ案内（A4）。セルフで店員を呼ぶことになりそうな人を、有人レジがすいているときだけ、レジに並ぶ前に有人レジへ
    let guide=null;
    if(CR&&lane==='s'&&k>=0&&fStart<=t+(CR.guideFree??0.3)){const likely=nA>0||(CA&&KI.coin&&KI.coin.guide&&has(v,'coin'))||((SF.confuse||{})[v.ps]??0.05)>=(CR.guideConfuse??0.1)||items.reduce((a,x)=>a+x[1],0)>=(CR.guideItems??4);
      if(likely){let who=-1,bp=0;for(let j=0;j<B.W.length;j++)if(B.onAt(B.W[j],t)){const cp=careP(B.W[j]);if(cp>bp){bp=cp;who=j;}}
        if(who>=0&&rC()<bp){lane='f';guide=B.W[who].p.id;}}}
    const start=lane==='s'?sStart:fStart,q=lane==='s'?qS:qF,qn=qLen(q,t);
    const svc2=AG&&nA>0&&!(lane==='f'&&young)?svc-nA*(cfg.service.age||0):svc;   // 有人レジで確認するのは若く見える客層だけ。セルフは画面では確認しない（店員が来る）
    // 会計の速さ（A5）：セルフは客層ごと（svcPs）・スマホだけの人はもっと速い・エコバッグは少し短い・急いでいる人はどちらのレジでも速い
    const svc3=Math.max(3,svc2-(CA&&has(v,'eco')?(KI.eco.sec||0):0)),ru=RU&&rushOf(v)?(RU.mul??0.8):1;
    const sm=lane==='s'?((SF.svcPs&&SF.svcPs[v.ps])??(SF.svcMul||1.3))*(CA&&has(v,'phone')?(KI.phone.selfMul||1):1):1;
    const sec=(lane==='s'?svc3*sm:svc3/B.speed(k))*ru;
    return {v,t,lane,k,start,end:start+sec/60,wait:start-t,qn,full:qn>=(W.queueMark||99),items,guide,rush:ru!==1,age:nA>0?(lane==='s'?'self':young?'staffed':null):null};}
  /* 会計を決める（品を渡したあとに呼ぶ）。セルフで迷ったら店員を呼ぶ（有人レジが止まる） */
  function commit(p,ev){const SF=W.self||{};S.stay+=p.v.stay;S.stayN++;if(p.rush)S.rush++;
    if(p.guide){ev.push({t:Math.max(p.v.t,p.t-0.3),k:'guide',ps:p.v.ps,by:p.guide});S.guide++;}
    if(p.age==='staffed')S.ageF++;
    if(p.lane==='f'){regFree=p.end;B.free[p.k]=p.end;qF.push(p.start);S.staffed++;}
    else{let end=p.end;S.self++;
      const conf=r()<((SF.confuse||{})[p.v.ps]??0.05),ageC=p.age==='self';
      if(conf||ageC){const hp=SF.help||[1.5,3],min=(conf?hp[0]+r()*(hp[1]-hp[0]):0)+(ageC?(AG.selfMin??0.4):0),tc=p.start+(end-p.start)*0.5;
        // 手のあいている店員（1分以内）がいればその人、いなければ有人レジの人が行く（そのあいだ有人レジは止まる）
        let who=-1,best=Infinity;for(let k=0;k<B.W.length;k++){if(!B.onAt(B.W[k],tc))continue;const f=Math.max(B.free[k],tc);if(f<best){best=f;who=k;}}
        if(who>=0){const at=Math.max(B.free[who],tc),on=[];for(let k=0;k<B.W.length;k++)if(B.onAt(B.W[k],tc))on.push(k);let regStop=on.length<=1||best>tc+1;
          // 気配り：レジに寄る（A4）。もう1人の店員がいれば、その人がレジに入る（有人レジは止まらない。会計はその人の速さ）
          if(CR&&regStop&&on.length>=2){const o=on.find(k=>k!==who);if(o!=null&&rC()<careP(B.W[o])){regStop=false;ev.push({t:at,k:'cover',by:B.W[o].p.id,from:B.W[who].p.id,min:+min.toFixed(1),why:ageC?'age':'help'});S.cover++;}}
          B.free[who]=at+min;if(regStop){regFree=Math.max(regFree,at)+min;S.regStop+=min;}end=Math.max(end,at+min);
          const e={t:tc,k:'selfhelp',ps:p.v.ps,by:B.W[who].p.id,min:+min.toFixed(1),stop:regStop};if(ageC)e.age=true;ev.push(e);S.selfHelp++;if(ageC)S.ageSelf++;}}
      selfFree=end;p.end=end;qS.push(p.start);}
    if(qF.length>80)qF.splice(0,40);if(qS.length>80)qS.splice(0,40);
    return p;}
  /* 列が床の印をこえていて帰った人 */
  const left=()=>{S.queueLeft++;};
  /* 買ったあと：イートイン（席・レンジ・お湯） */
  function after(p,bought,ev){const E=W.eatIn;if(!E)return;const I=B.ix;let g=null,best=0;
    for(const [pid] of bought){const gg=I.P[pid].genre,pp=(E.p||{})[gg]||0;if(pp>best){best=pp;g=gg;}}
    if(!g)return;const t0=p.end,pid=bought.find(([x])=>I.P[x].genre===g)[0];
    const eat=r()<best*((E.ps||{})[p.v.ps]??1);
    let tSit=t0;
    if(g==='bento'&&E.range&&(eat?r()<E.range.p:r()<E.range.takeP)){const rs=Math.max(t0,rangeFree);rangeFree=rs+E.range.min;ev.push({t:rs,k:'range',ps:p.v.ps,pid,wait:+(rs-t0).toFixed(1),eat,from:+t0.toFixed(2)});S.range++;tSit=rs+E.range.min;}
    if(!eat)return;
    if(g==='cupmen'&&E.water)tSit=t0+E.water.min;
    // 席の種類（2026-11-10）：E.stand があれば 0〜stand-1 が立ち席、そのあとが座る席。座りたい客層（sitPs）は座る席から、年配の人（sitOnly）は座る席だけ。ないときは前と同じ（どの席でも）
    const nSt=E.stand!=null?E.stand:seats.length,free=(a,b)=>{let k=-1;for(let i=a;i<b;i++)if(seats[i]<=tSit&&(k<0||seats[i]<seats[k]))k=i;return k;};
    // グループ（家族連れ・カップル・友人同士・2026-11-10）：何人かを決め、まとめて座る。座れる席は2席のテーブルごと（2人ならテーブル1つ、3〜4人ならテーブル2つ）。立ち席はあいている席を人数ぶん
    const GR=E.groups&&E.groups[p.v.ps];let si=-1,many=null;
    if(GR&&E.stand!=null){const sz=GR.size[0]+Math.floor(r()*(GR.size[1]-GR.size[0]+1)),wantS=GR.sitOnly||r()<(GR.sit||0);
      const sitSet=()=>{const T=[];for(let i=nSt;i+1<seats.length;i+=2)if(seats[i]<=tSit&&seats[i+1]<=tSit)T.push([i,i+1]);if(sz<=2)return T.length?T[0].slice(0,sz):null;const all=T.flat();return all.length>=sz?all.slice(0,sz):null;};
      const standSet=()=>{const F=[];for(let i=0;i<nSt;i++)if(seats[i]<=tSit)F.push(i);return F.length>=sz?F.slice(0,sz):null;};
      many=wantS?(sitSet()||(GR.sitOnly?null:standSet())):(standSet()||sitSet());if(many)si=many[0];}
    else{const wantSit=E.sitPs&&r()<(E.sitPs[p.v.ps]||0),only=(E.sitOnly||[]).includes(p.v.ps);
      si=only?free(nSt,seats.length):wantSit?free(nSt,seats.length):free(0,nSt);if(si<0&&!only)si=wantSit?free(0,nSt):free(nSt,seats.length);}
    if(si<0){ev.push({t:tSit,k:'eatfull',ps:p.v.ps,pid,from:+t0.toFixed(2)});S.eatFull++;return;}
    const sit=si>=nSt&&E.stand!=null,to=tSit+((E.eat||{})[g]||8)*(sit?(E.sitMul||1):1)+(g==='cupmen'&&E.water?E.water.wait:0);for(const i of many||[si])seats[i]=to;
    if(TS)S.trash++;   // 食べた人はごみを出す（ごみ箱のたまる早さのめやす）
    ev.push(Object.assign({t:tSit,k:'eatin',ps:p.v.ps,pid,seat:si,sit:sit,to:+to.toFixed(1),from:+t0.toFixed(2)},many?{seats:many,n:many.length}:{}));S.eatIn++;if(sit)S.eatSit=(S.eatSit||0)+1;}
  /* 地元のお店の品を店員が並べ終える時刻（A4・設定 localShelve があるときだけ）：受け取りのサインのあと、手のあいた店員（レジ優先なので、いまの会計が終わってから）が品の数だけ並べる */
  const shelveAt=(t,n,KS,cfg)=>{const LS=W.localShelve;if(!LS||!B)return null;let best=Infinity,k0=-1;
    for(let k=0;k<B.W.length;k++){const x=KS.nextStart(B.W[k],Math.max(t+(LS.sign??1.5),B.free[k]));if(x<best){best=x;k0=k;}}
    if(k0<0||!isFinite(best))return null;return {t:best+n*(LS.sec??8)/60/KS.speed(cfg,B.W[k0].p,'stock'),by:B.W[k0].p.id,start:best};};
  /* ごみだけの人など、来る人の列に入らない出来事（simulate の最後に足す） */
  const extra=()=>{for(const e of extraEv){S.trashOnly++;S.trash++;}return extraEv;};
  /* KioskCore の店員の道具をつなぐ（simulate の中で、店員が決まってから） */
  const bind=b=>{B=b;};
  const stats=()=>({shift:S.shift,cruise:S.cruise,self:S.self,staffed:S.staffed,selfShare:S.self+S.staffed?+(S.self/(S.self+S.staffed)).toFixed(3):0,selfHelp:S.selfHelp,queueLeft:S.queueLeft,
    eatIn:S.eatIn,eatSit:S.eatSit||0,eatFull:S.eatFull,range:S.range,stayAvg:S.stayN?+(S.stay/S.stayN).toFixed(2):0,
    ...(NP||CA||RU?{newPs:S.newPs,carry:S.carry,seek:S.seek,seekLeft:S.seekLeft,rush:S.rush,capped:S.capped}:{}),
    ...(AG||CR||TS?{ageSelf:S.ageSelf,ageF:S.ageF,guide:S.guide,cover:S.cover,regStop:+S.regStop.toFixed(1),trashOnly:S.trashOnly,trashBuy:S.trashBuy,trash:S.trash}:{})});
  return {visitors,stayOf,basketMul,plan,commit,left,after,bind,stats,tripOf,gMul,trashG,shelveAt,extra,carryOf,seek,cap,rushOf,block};}
root.KioskWalk={begin};
})(typeof window!=='undefined'?window:globalThis);
