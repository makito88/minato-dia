/* =====================================================================
   中に入って歩く店の計算（港駅の売店をつくる回の2回目・2026-11-10）
   ・KioskCore.simulate が、設定に walk があるとき（港駅の店）だけ使う。緑ヶ丘の店（walk なし）は今までと同じ道を通る。
   ・ここで決めること：交代で働く人・客船の客が来る時刻／店にいる時間（長いほどかごの品が増える）／
     有人レジ1台とセルフ1台（セルフで迷うと店員が呼ばれ、有人レジが止まる）／列が床の印をこえると最後尾が帰る／
     イートイン（席・レンジ・お湯。席がうまっていると持ち帰る）。
   ・イートインの出来事（range・eatin・eatfull）の from は、その人の会計が終わった時刻（買った出来事の end と同じ。3回目の絵で人をつなぐため。計算は変えない）。
   ・乱数は自分の種（'walk'）だけを使う。設定は港駅の店の設定ファイルの walk（js/minato-store-core.js が合わせて cfg.walk にする）。数字はすべて仮。
   ・DOM もゲーム本体の変数も使わない。
   ===================================================================== */
(function(root){
'use strict';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
/* h：KioskCore の道具（hash・rng・poisson・pickW）。o：{R, DW, O0, O1, ageMix} */
function begin(cfg,state,ctx,h,o){const W=cfg.walk,r=h.rng(h.hash(state.seed,ctx.day,state.st,state.place,'walk'));
  const gz=()=>{const u=Math.max(1e-9,r()),v=r();return Math.sqrt(-2*Math.log(u))*Math.cos(6.2832*v);};
  const S={shift:0,cruise:0,self:0,staffed:0,selfHelp:0,queueLeft:0,eatIn:0,eatFull:0,range:0,stay:0,stayN:0,items:0};
  let B=null,regFree=o.O0,selfFree=o.O0,rangeFree=o.O0;const qS=[],qF=[],seats=new Array((W.eatIn&&W.eatIn.seats)||0).fill(o.O0);
  /* 来る人：交代で働く人（毎日）・客船の客（ctx.cruise があり、強さ＞0 のときだけ） */
  function visitors(){const out=[],PS=cfg.personas,shf=PS.find(p=>p.id==='shf'),cru=PS.find(p=>p.id==='cru');
    const one=(t,ps,a,em,tag)=>{if(t<o.O0||t>=o.O1)return;const hh=Math.floor(t/60);out.push({t,p:ps==='cru'?2:0,a,ps,em,dw:o.DW[hh]||1.5,[tag]:true});};
    if(shf&&shf.when&&shf.when.shifts){const w=shf.when,per=w.emp*w.shiftShare/3*w.railShare*w.visit*(shf.strength??1);
      for(const s of w.shifts){for(const [a,b] of [[s*60-w.before,s*60],[s*60,s*60+w.after]]){const n=h.poisson(per,r);
        for(let i=0;i<n;i++){const t=a+r()*(b-a),age=Math.max(1,h.pickW(w.age,r));one(t,'shf',age,r()<w.em,'shf');S.shift++;}}}}
    const C=ctx.cruise;if(cru&&C&&(cru.strength||0)>0&&C.pax>0){const n=h.poisson(C.pax*(cru.when.visit||0.1)*cru.strength,r);
      for(let i=0;i<n;i++){const t=C.from+r()*Math.max(1,C.to-C.from);one(t,'cru',r()<0.5?3:4,r()<0.7,'cru');S.cruise++;}}
    return out;}
  /* 店にいる分（人ごと。対数のぶれ） */
  const stayOf=v=>{if(v.stay==null){const m=W.stay[v.ps]||3.5;v.stay=+(m*Math.exp((W.stay.sd||0.3)*gz())).toFixed(2);if(v.imp)v.stay=+(v.stay*0.6).toFixed(2);}return v.stay;};
  const basketMul=v=>{const K=W.stayBasket||{};return clamp(Math.pow(stayOf(v)/(K.ref||3.5),K.pow||0.5),K.min||0.6,K.max||2);};
  const qLen=(q,t)=>{let n=0;for(let i=q.length-1;i>=0;i--)if(q[i]>t)n++;return n;};
  /* 会計の計画（まだ決めない）。svc＝秒（店員の速さで割る前）。返すもの：{lane:'f'有人|'s'セルフ, k, start, end, wait, qn, full} */
  function plan(v,items,svc){const t=v.t+stayOf(v),SF=W.self||{},I=B.ix,noSelf=items.some(([pid])=>(SF.noSelf||[]).includes(I.P[pid].genre)||I.G[I.P[pid].genre].age);
    const [k,eff]=B.pickS(t),fStart=Math.max(eff,regFree),sStart=Math.max(t,selfFree);
    let lane='f';
    if(!noSelf&&(W.registers.self||0)>0){const like=r()<((SF.pick||{})[v.ps]??0.5),sw=SF.switch||3;
      lane=like?(sStart>fStart+sw?'f':'s'):(fStart>sStart+sw&&r()<0.5?'s':'f');}
    if(lane==='f'&&k<0)lane=noSelf?'f':'s';
    const start=lane==='s'?sStart:fStart,q=lane==='s'?qS:qF,qn=qLen(q,t);
    const sec=lane==='s'?svc*(SF.svcMul||1.3):svc/B.speed(k);
    return {v,t,lane,k,start,end:start+sec/60,wait:start-t,qn,full:qn>=(W.queueMark||99),items};}
  /* 会計を決める（品を渡したあとに呼ぶ）。セルフで迷ったら店員を呼ぶ（有人レジが止まる） */
  function commit(p,ev){const SF=W.self||{};S.stay+=p.v.stay;S.stayN++;
    if(p.lane==='f'){regFree=p.end;B.free[p.k]=p.end;qF.push(p.start);S.staffed++;}
    else{let end=p.end;S.self++;
      if(r()<((SF.confuse||{})[p.v.ps]??0.05)){const hp=SF.help||[1.5,3],min=hp[0]+r()*(hp[1]-hp[0]),tc=p.start+(end-p.start)*0.5;
        // 手のあいている店員（1分以内）がいればその人、いなければ有人レジの人が行く（そのあいだ有人レジは止まる）
        let who=-1,best=Infinity;for(let k=0;k<B.W.length;k++){if(!B.onAt(B.W[k],tc))continue;const f=Math.max(B.free[k],tc);if(f<best){best=f;who=k;}}
        if(who>=0){const at=Math.max(B.free[who],tc),regStop=B.W.filter(w=>B.onAt(w,tc)).length<=1||best>tc+1;B.free[who]=at+min;if(regStop)regFree=Math.max(regFree,at)+min;end=Math.max(end,at+min);
          ev.push({t:tc,k:'selfhelp',ps:p.v.ps,by:B.W[who].p.id,min:+min.toFixed(1),stop:regStop});S.selfHelp++;}}
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
    ev.push(Object.assign({t:tSit,k:'eatin',ps:p.v.ps,pid,seat:si,sit:sit,to:+to.toFixed(1),from:+t0.toFixed(2)},many?{seats:many,n:many.length}:{}));S.eatIn++;if(sit)S.eatSit=(S.eatSit||0)+1;}
  /* KioskCore の店員の道具をつなぐ（simulate の中で、店員が決まってから） */
  const bind=b=>{B=b;};
  const stats=()=>({shift:S.shift,cruise:S.cruise,self:S.self,staffed:S.staffed,selfShare:S.self+S.staffed?+(S.self/(S.self+S.staffed)).toFixed(3):0,selfHelp:S.selfHelp,queueLeft:S.queueLeft,
    eatIn:S.eatIn,eatSit:S.eatSit||0,eatFull:S.eatFull,range:S.range,stayAvg:S.stayN?+(S.stay/S.stayN).toFixed(2):0});
  return {visitors,stayOf,basketMul,plan,commit,left,after,bind,stats};}
root.KioskWalk={begin};
})(typeof window!=='undefined'?window:globalThis);
