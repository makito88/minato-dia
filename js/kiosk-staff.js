/* =====================================================================
   売店の店員（計算だけ。画面は js/kiosk-view.js、設定は data/kiosk.json の crew）
   ・店員は一人ずつ：名前（架空）・種類（学生・主婦主夫・フリーター・シニア）・得意なこと（レジ・品出し・接客）
     ・入れる時間（平日・土曜・日曜祝日 × 朝・昼・夕方・夜）・週に働きたい時間・時給・やる気・慣れ。
   ・シフトは「平日・土曜・日曜祝日」の型ごとに、時間帯に誰が入るか。変更（shiftNext）と時給の変更（wageNext）は次の運行日から。
   ・その日の計算（kiosk-core の simulate）は today() で「きょう働く人と時間」を受け取る。
   ・運行日の終わりに close() で、やる気・慣れ・昇給の相談・辞める人・応募を進める。
   ===================================================================== */
(function(root){
'use strict';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function hash(...a){let h=2166136261>>>0;const s=a.join('|');for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}return h;}
function rng(seed){let a=seed>>>0;return ()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
const poisson=(l,r)=>{let n=0,p=Math.exp(-l),s=p;const u=r();while(u>s&&n<50){n++;p*=l/n;s+=p;}return n;};
const B=cfg=>cfg.crew.blocks;
const blk=(cfg,id)=>B(cfg).find(b=>b.id===id);
const TYPES=['wd','sat','hol'];

/* やる気と慣れが仕事に効く倍率 */
const moraleF=m=>0.85+0.3*clamp(m,0,100)/100;
const expF=(cfg,p)=>1+cfg.crew.exp.max*(1-Math.exp(-(p.days||0)/cfg.crew.exp.days));
const speed=(cfg,p,k)=>(p.skill[k]||1)*moraleF(p.morale)*expF(cfg,p);   // k：reg（レジ）・stock（品出し）
const careOf=(cfg,p)=>(p.skill.care||1)*moraleF(p.morale);
/* 得意・苦手の言葉 */
function traits(p){const o=[];const L={reg:['レジが速い','レジがゆっくり'],stock:['品出しが速い','品出しがゆっくり'],care:['接客がていねい','接客がそっけない']};
  for(const k in L){const v=p.skill[k]||1;if(v>=1.08)o.push({t:L[k][0],good:true});else if(v<=0.92)o.push({t:L[k][1],good:false});}return o;}
function moodWord(m){return m>=80?'やる気満々':m>=60?'元気':m>=45?'ふつう':m>=35?'少し不満':'辞めたそう';}

/* 一人つくる（応募してきた人・はじめからいる人） */
function person(cfg,r,used,opt){const C=cfg.crew,kd=opt&&opt.kind?C.kinds.find(k=>k.id===opt.kind):C.kinds[Math.floor(r()*C.kinds.length)];
  const names=C.names.filter(n=>!used.includes(n));const name=names.length?names[Math.floor(r()*names.length)]:C.names[Math.floor(r()*C.names.length)]+(used.length+1);
  const avail={};for(const t of TYPES){avail[t]=(kd.avail[t]||[]).filter(()=>r()>0.18);if(!avail[t].length&&(kd.avail[t]||[]).length)avail[t]=[kd.avail[t][Math.floor(r()*kd.avail[t].length)]];}
  const skill={};for(const k in kd.skill)skill[k]=+(kd.skill[k]*(0.9+r()*0.2)).toFixed(2);
  const want=Math.round(kd.want[0]+r()*(kd.want[1]-kd.want[0]));
  const expect=Math.round((C.market+kd.expect[0]+r()*(kd.expect[1]-kd.expect[0]))/10)*10;
  return {id:'c'+hash(name,r()).toString(36),name,kind:kd.id,skill,avail,want,expect,wage:Math.max(C.minWage,Math.ceil(expect/C.step)*C.step),morale:C.morale.start,days:0,notes:[]};}

/* はじめの店員：n 人ずつ（いない時間帯ができないように）入れる。古い保存（staff の人数だけ）から移すときにも使う */
function create(cfg,seed,day,n){const r=rng(hash('crew',seed)),C=cfg.crew,used=[],people=[];
  for(const kind of ['free','home','stu','free'].concat(n>=2?['stu','sen','home']:[]).concat(n>=3?['free','stu']:[]).slice(0,cfg.crew.max)){const p=person(cfg,r,used,{kind});used.push(p.name);p.from=day;p.days=10+Math.floor(r()*40);p.wage=Math.max(p.wage,C.market);people.push(p);}
  const crew={people,shift:{},ads:[],applicants:[]};
  for(const t of TYPES){crew.shift[t]={};for(const p of people)crew.shift[t][p.id]=[];}
  // 時間帯ごとに、入れる人のうちシフトが希望に対して少ない人から n 人入れる
  crew.shift=assign(cfg,people,()=>n,'even');
  return crew;}
/* 割り振り：時間帯ごとに need(型,時間帯) 人を入れる。入れる人のうち、希望に足りない時間が多く・入れる時間が少ない人から。
   希望の over 倍を超える人は、ほかにいなければ入れる。mode='cost' のときは、同じくらいなら時給の安い人から */
function assign(cfg,people,need,mode){const C=cfg.crew,sh={},hrs={},nAv=p=>TYPES.reduce((s,t)=>s+p.avail[t].length,0)||1;
  for(const t of TYPES){sh[t]={};for(const p of people)sh[t][p.id]=[];}
  const score=p=>(p.want-(hrs[p.id]||0))/nAv(p)-(mode==='cost'?((p.wageNext??p.wage)-C.market)/200:0);
  // 入れる人が少ない時間帯から先に決める（先に埋めないと、だれもいなくなる）
  const slots=[];for(const t of TYPES)for(const b of B(cfg))slots.push({t,b,n:people.filter(p=>p.avail[t].includes(b.id)).length});
  slots.sort((a,c)=>a.n-c.n);
  for(const {t,b} of slots){const add=(b.to-b.from)*C.weekDays[t],k=need(t,b);
    const cand=people.filter(p=>p.avail[t].includes(b.id)).sort((a,c)=>{const oa=(hrs[a.id]||0)+add>a.want*C.morale.over,oc=(hrs[c.id]||0)+add>c.want*C.morale.over;return (oa-oc)||(score(c)-score(a));});
    for(const p of cand.slice(0,k)){sh[t][p.id].push(b.id);hrs[p.id]=(hrs[p.id]||0)+add;}}
  for(const t of TYPES)for(const id in sh[t])sh[t][id].sort((a,c)=>B(cfg).findIndex(x=>x.id===a)-B(cfg).findIndex(x=>x.id===c));
  return sh;}
/* おまかせシフト：mode='cost' は各時間帯1人。'cover' は、1人あたり1時間の会計が busy 人を超えないように（最大3人）。
   perH[型][時間帯の番号]＝1時間に来るお客さんの見込み */
function autoShift(cfg,crew,day,mode,perH){const people=crew.people.filter(p=>p.leave==null&&active(p,day+1)),C=cfg.crew;
  const need=(t,b)=>mode==='cost'?1:Math.max(1,Math.min(3,Math.ceil(((perH[t]||[])[B(cfg).indexOf(b)]||0)/(C.morale.busy*0.9))));
  return assign(cfg,people,need,mode);}
function migrate(cfg,state){if(state.crew)return state.crew;state.crew=create(cfg,state.seed||1,state.openedDay||1,Math.max(1,state.staff||1));return state.crew;}

/* その人がその日に働くか（雇った日の次の日から・辞める日の前の日まで） */
const active=(p,day)=>(p.from==null||p.from<=day)&&(p.leave==null||p.leave>day);
/* 週のシフト時間 */
function weekHours(cfg,crew,id,useNext){const sh=useNext&&crew.shiftNext||crew.shift;let h=0;for(const t of TYPES)for(const b of (sh[t]&&sh[t][id])||[]){const x=blk(cfg,b);if(x)h+=(x.to-x.from)*cfg.crew.weekDays[t];}return h;}
/* きょう働く人：[{p, spans:[[from分,to分]...]}]。crew が無い古い保存は、人数ぶんの「1日中いる人」 */
function today(cfg,state,type,day){const crew=state.crew;
  if(!crew){const n=Math.max(1,state.staff||1),o=[];for(let i=0;i<n;i++)o.push({p:{id:'x'+i,name:'店員',skill:{reg:1,stock:1,care:1},morale:60,days:30,wage:cfg.wage},spans:[[cfg.open[0]*60,cfg.open[1]*60]]});return o;}
  const sh=crew.shift[type]||{},o=[];
  for(const p of crew.people){if(!active(p,day))continue;const bs=(sh[p.id]||[]).map(id=>blk(cfg,id)).filter(Boolean).sort((a,b)=>a.from-b.from);if(!bs.length)continue;
    const spans=[];for(const b of bs){const last=spans[spans.length-1];if(last&&last[1]===b.from*60)last[1]=b.to*60;else spans.push([b.from*60,b.to*60]);}o.push({p,spans});}
  return o;}
const onAt=(w,t)=>w.spans.some(([a,b])=>t>=a&&t<b);
const nextStart=(w,t)=>{let best=Infinity;for(const [a,b] of w.spans){if(t<b)best=Math.min(best,Math.max(a,t));}return best;};
/* 1日の人件費（22時からは割増） */
function payOf(cfg,w,O0,O1){const N=cfg.crew.night;let yen=0,h=0;for(const [a,b] of w.spans){const s=Math.max(a,O0),e=Math.min(b,O1);if(e<=s)continue;const nt=Math.max(0,e-Math.max(s,N.from*60));h+=(e-s)/60;yen+=((e-s)/60)*w.p.wage+(nt/60)*w.p.wage*(N.rate-1);}return {yen,h};}

/* 応募 */
function adsOpen(cfg,crew,day){return (crew.ads||[]).filter(a=>day-a.day<cfg.crew.ad.days);}

/* 運行日を締める：やる気・慣れ・昇給の相談・辞める人・応募・あすからのシフトと時給 */
function close(cfg,st,res,day,say){const C=cfg.crew,M=C.morale,crew=migrate(cfg,st),r=rng(hash('crewday',st.seed,day));
  const work={};for(const w of (res.crew||[]))work[w.id]=w;
  for(const p of crew.people){if(!active(p,day))continue;const w=work[p.id],notes=[];let d=0;
    const pay=clamp((p.wage-p.expect)/50*M.pay,M.payMin,M.payMax);d+=pay;if(pay<-1)notes.push('時給が希望より低い');
    const wh=weekHours(cfg,crew,p.id);if(wh>p.want*M.over){d-=M.overHit;notes.push('シフトが多すぎる');}else if(wh<p.want*M.under){d-=M.underHit;notes.push('シフトが少ない（もっと稼ぎたい）');}
    if(w&&w.h>0){const load=w.served/w.h;if(load>M.busy){d-=M.busyHit*(load>M.busy*1.4?1.6:1);notes.push('忙しすぎる');}p.days=(p.days||0)+1;p.lastServed=w.served;p.lastH=+w.h.toFixed(1);}else{p.lastServed=0;p.lastH=0;}
    if(p.ask&&p.wage<p.ask){d-=M.raiseHit;notes.push('昇給の返事を待っている');}
    d+=(M.home-p.morale)*(M.pull||0.15)+(r()-0.5)*3;p.morale=clamp(Math.round((p.morale+d)*10)/10,0,100);p.notes=notes;
    // 昇給の相談
    if(!p.ask&&p.days>0&&p.days%C.exp.raiseEvery===0&&w&&w.h>0){p.ask=p.wage+C.exp.raiseStep;p.askDay=day;p.expect=Math.max(p.expect,p.ask);
      say('crew',`${p.name}さんが時給の相談に来た`,`働いて${p.days}日。仕事にも慣れてきたので、時給を${p.ask.toLocaleString()}円（いまは${p.wage.toLocaleString()}円）にしてほしいそうです。「店員」で返事ができます。待たせると、やる気が下がります。`);}
    // 辞めたそう → 辞める
    if(p.morale<M.warn&&!p.warn){p.warn=day;say('crew',`${p.name}さんが辞めたそうにしている`,`気にしていること：${notes.join('・')||'とくに言わない'}。何日かこのままだと辞めてしまいます。`);}
    else if(p.morale>=M.ok&&p.warn){p.warn=null;}
    if(p.warn&&day-p.warn>=M.quitAfter&&p.morale<M.warn&&r()<M.quitP&&p.leave==null){p.leave=day+1;say('crew',`${p.name}さんが辞めることになった`,`あすからは来ません。シフトの穴は「店員」で埋めてください（だれもいない時間は、売店を閉めます）。`);}
  }
  // 時給の変更（あすから）・昇給への返事
  for(const p of crew.people){if(p.wageNext!=null){const up=p.wageNext>p.wage;p.wage=p.wageNext;delete p.wageNext;if(p.ask&&p.wage>=p.ask){p.morale=clamp(p.morale+M.raiseJoy,0,100);p.ask=null;say('crew',`${p.name}さんの時給が上がった`,`うれしそうです（やる気が上がりました）。`);}else if(up)p.morale=clamp(p.morale+M.raiseJoy/2,0,100);}}
  // シフトの変更（あすから）
  if(crew.shiftNext){crew.shift=crew.shiftNext;delete crew.shiftNext;}
  // 辞めた人を外す
  const gone=crew.people.filter(p=>p.leave!=null&&p.leave<=day+1).map(p=>p.id);
  if(gone.length){crew.people=crew.people.filter(p=>!gone.includes(p.id));for(const t of TYPES)for(const id of gone)delete crew.shift[t][id];}
  // 応募
  const used=crew.people.map(p=>p.name).concat(crew.applicants.map(a=>a.name));let nNew=0;
  for(const a of adsOpen(cfg,crew,day)){const n=poisson(C.ad.base*Math.exp((a.wage-C.market)/C.ad.k),r);
    for(let i=0;i<n;i++){const p=person(cfg,r,used,null);if(p.expect>a.wage+30)continue;used.push(p.name);p.wage=a.wage;p.until=day+C.ad.keep;p.came=day;crew.applicants.push(p);nNew++;}}
  const left=crew.applicants.filter(a=>a.until<=day).length;crew.applicants=crew.applicants.filter(a=>a.until>day);
  crew.ads=(crew.ads||[]).filter(a=>day-a.day<C.ad.days);
  if(nNew)say('crew',`募集に${nNew}人の応募があった`,`「店員」で会って、採用するか決められます（${C.ad.keep}日たつと、ほかで決まっていなくなります）。`);
  if(left)say('crew',`応募していた${left}人が、ほかで決まった`,'');
  return crew;}

root.KioskStaff={create,assign,autoShift,migrate,person,today,onAt,nextStart,payOf,speed,careOf,moraleF,expF,traits,moodWord,weekHours,active,close,adsOpen,TYPES,blk};
if(typeof module!=='undefined')module.exports=root.KioskStaff;
})(typeof window!=='undefined'?window:globalThis);
