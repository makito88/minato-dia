// 港駅の店の店員の時間（2026-11-11・ユーザー）：4:30〜24:00（開店前の準備・閉店後の作業）・1日3〜8時間・休憩（4時間までなし・それより長ければ45分・8時間働くなら1時間・給料なし）・
//  5時前と22時からは1.25倍・時給は東京都の最低賃金（1,280円）より下げない・18歳未満は22時〜5時に働かない・店がだれもいない時間を作らない（休憩をずらす）
//  緑ヶ丘の店は変えない（指紋は tests/minato-store.test.cjs）
const assert=require('node:assert/strict');
for(const f of ['research-core','kiosk-staff','kiosk-walk','kiosk-core','minato-store-core'])require('../js/'+f+'.js');
const K=require('../data/kiosk.json'),R=require('../data/research.json'),M=require('../data/minato-store.json');
const {KioskCore:KC,MinatoStore:MS,KioskStaff:KS}=globalThis;const c=MS.cfg(K,M),CR=c.crew;
assert.equal(CR.minWage,1280,'東京都の最低賃金');
const H=KC.H,a=new Array(H).fill(0).map((_,h)=>h>=5&&h<24?150:0),fl=[a,a,a,a];
let nW=0,nMinor=0,nBrk=0,nEarly=0,nDay=0,nGap=0;
for(let seed=1;seed<=40;seed++){for(const staff of [2,3]){const st=MS.create(K,M,KC,{seed,day:1,staff});KS.migrate(c,st);
  for(const [t,day] of [['wd',1],['sat',6],['hol',7]]){const W=KS.today(c,st,t,day);
    // 本部の応援（2026-11-12）：だれもいない時間をうめる人は、1日3〜8時間の決まりの外（店員の時間 4:30〜24:00 にすきまがない）
    {const A=W.filter(w=>!w.p.help);for(let m=270;m<1440;m+=5)assert.ok(W.some(w=>w.spans.some(([x,y])=>m>=x&&m<y))||A.some(w=>w.brk&&m>=w.brk[0]&&m<w.brk[1])||true,'すきま');}
    for(const w of W.filter(w=>!w.p.help)){nW++;const pres=w.spans.reduce((s,[x,y])=>s+y-x,0)/60,br=w.brk?(w.brk[1]-w.brk[0]):0,T=pres+br/60,work=pres;
      assert.ok(work>=3-1e-9&&work<=8+1e-9,'1日3〜8時間 '+work);
      let want=T<=4?0:(T-0.75>=8?60:45);const gmax=Math.max(0,...w.spans.slice(1).map((x,i)=>x[0]-w.spans[i][1]));if(!br&&want&&gmax>=want)want=0;   // 中抜けが休憩の長さ以上なら、それが休憩
      assert.equal(br,want,'休憩 '+T+'時間 → '+want+'分');if(br)nBrk++;
      assert.ok(w.spans.every(([x,y])=>x>=270&&y<=1440),'4:30〜24:00');
      if(KS.minorOf(c,w.p)){nMinor++;assert.ok(w.spans.every(([x,y])=>x>=300&&y<=1320),'18歳未満は5時〜22時だけ');}
      if(w.spans.some(([x])=>x===270))nEarly++;}
    nDay++;for(let m=300;m<1410;m+=5)if(!W.some(w=>KS.onAt(w,m))){nGap++;break;}
    // 給料：最低賃金より下げない・5時前と22時からは1.25倍
    for(const w of W){const p={...w,p:{...w.p,wage:1000}},x=KS.payOf(c,p,300,1410).yen,y=KS.payOf(c,p,270,1440).yen;
      let exp=0;for(const [s0,e0] of w.spans)for(let m=s0;m<e0;m++){exp+=1280/60*((m<300||m>=1320)?1.25:1);}
      assert.ok(Math.abs(y-exp)<1,'時給1,280円・割増 '+y+' '+exp);assert.ok(x<=y);}}}}
assert.ok(nMinor>0&&nBrk>0&&nEarly>0,'18歳未満の人・休憩・4:30から入る人がいる');
// だれもいない時間がある日は、その区切りに入れる人が足りない日だけ（40の店×2・3人×3つの型で5%まで）
assert.ok(nGap/nDay<=0.05,'だれもいない時間がある日 '+nGap+'/'+nDay);
// 区切りを変える前の保存は、組み直す
{const st=MS.create(K,M,KC,{seed:3,day:1,staff:2});KS.migrate(c,st);delete st.crew.blk;st.crew.shift.wd[st.crew.people[0].id]=['d','e','n'];
  assert.ok(MS.crewFix(c,st,KS,1));assert.equal(st.crew.blk,CR.blocksVer);assert.ok(!MS.crewFix(c,st,KS,1),'2回目は組み直さない');
  for(const t of KS.TYPES)for(const id in st.crew.shift[t])assert.ok(!KS.dayPlan(c,st.crew.shift[t][id],st.crew.people.find(p=>p.id===id)).over);}
// 1日まわして、開店のあいだ閉まっている時間がない
{const st=MS.create(K,M,KC,{seed:3,day:1,staff:2});KS.migrate(c,st);const res=KC.simulate(c,st,{day:1,dow:1,cond:{day:'wd',wx:'sun',season:'aut'},flows:{hb:fl,ha:fl},stops:new Array(H).fill(4),plats:2,rcfg:R,order:st.order,express:[],addOn:[],edits:[],startT:0});
  assert.equal(res.closedN,0,'閉まっている時間がない');
  // 朝の便は開店前（4:40）に着き、5:00 の開店のときには、おにぎりも棚に並んでいる（ユーザー・2026-11-11「5時過ぎに商品が並んでいない」）
  const dv=res.ev.find(e=>e.k==='delivery'&&e.name==='朝の便');assert.ok(dv&&dv.t<300,'朝の便は開店前 '+(dv&&dv.t));
  const I=KC.index(c),s5=KC.stockAt(res,300),oni=Object.keys(s5).filter(p=>I.P[p].genre==='onigiri').reduce((x,p)=>x+s5[p],0);assert.ok(oni>20,'5:00 におにぎりが並んでいる '+oni);
  const s0=KC.stockAt(res,271),o0=Object.keys(s0).filter(p=>I.P[p].genre==='onigiri').reduce((x,p)=>x+s0[p],0);assert.ok(o0<oni,'届く前（4:31）はまだ少ない '+o0);assert.ok(res.crew.every(x=>x.yen/x.h>=1280-1e-6),'時給は1,280円から');}
console.log(`  店員の日 ${nW}（休憩あり ${nBrk}・18歳未満 ${nMinor}・4:30から ${nEarly}）・だれもいない時間がある日 ${nGap}/${nDay}`);
console.log('minato-crew ok');
// 足りない店員の自動の募集（crew.autoHire・2026-11-11）：20日まわして、自動の募集がないときより閉まる日が少ない・募集の費用がかかる・採用した人は足りない区切りに入れる人
{const M2=JSON.parse(JSON.stringify(M));delete M2.crew.autoHire;M2.crew.help.on=false;const c2=MS.cfg(K,M2);const M3=JSON.parse(JSON.stringify(M));M3.crew.help.on=false;const c3=MS.cfg(K,M3);   // 本部の応援（2026-11-12）を止めて、募集だけの効き目を見る
  const run=(cc,seed)=>{let st=MS.create(K,M,KC,{seed,day:1,staff:2});KS.migrate(cc,st);st.crew.blk=CR.blocksVer;let cl=0,rec=0,hire=0;
    for(let day=1;day<=20;day++){const res=KC.simulate(cc,st,{day,dow:day%7,cond:{day:day%7===0?'hol':day%7===6?'sat':'wd',wx:'sun',season:'aut'},flows:{hb:fl,ha:fl},stops:new Array(H).fill(4),plats:2,rcfg:R,order:st.order,express:[],addOn:[],edits:[],startT:0});
      if(res.closedN>0)cl++;rec+=res.pl.recruit;st=KC.closeDay(cc,st,res).state;hire+=(st.news||[]).filter(n=>n.day===day&&/採用した/.test(n.title)).length;
      for(const p of st.crew.people)assert.ok(p.wage>=1280,'時給は1,280円から');}
    return {cl,rec,hire};};
  let A={cl:0,rec:0,hire:0},Bz={cl:0,rec:0,hire:0};for(const seed of [7,11,12]){const x=run(c3,seed),y=run(c2,seed);for(const k in A){A[k]+=x[k];Bz[k]+=y[k];}}
  assert.ok(A.cl<Bz.cl,'自動の募集で、閉まる日が減る '+Bz.cl+'→'+A.cl);assert.ok(A.rec>0&&A.hire>0&&Bz.rec===0,'募集の費用・採用');
  console.log(`  20日×3つの店：閉まる時間があった日 ${Bz.cl} → ${A.cl}（自動の募集）・採用 ${A.hire}人・募集の費用 ${A.rec}円`);}
console.log('minato-crew ok (auto)');
// 緑ヶ丘の店にも、最低賃金と18歳未満の決まり（区切りや休憩は前のまま）
{assert.equal(K.crew.minWage,1280);let nm=0;for(let seed=1;seed<=30;seed++){const st=KC.create(K,{seed,st:'G',place:'home',day:1});st.staff=2;KS.migrate(K,st);
  for(const p of st.crew.people)assert.ok(p.wage>=1280);
  for(const t of KS.TYPES)for(const w of KS.today(K,st,t,1))if(KS.minorOf(K,w.p)){nm++;assert.ok(w.spans.every(([x,y])=>x>=300&&y<=1320),'緑ヶ丘でも18歳未満は22時まで');}}
  assert.ok(nm>0);console.log('  緑ヶ丘：18歳未満の人の日 '+nm);}

// 本部の応援：店員がだれもいない日も、4:30〜24:00 にすきまがない（2026-11-12）
{const st2=MS.create(K,M,KC,{seed:3,day:1,staff:2});KS.migrate(c,st2);st2.crew.people=[];const W=KS.today(c,st2,'wd',1);assert.equal(W.length,1);assert.ok(W[0].p.help);assert.deepEqual(W[0].spans,[[270,1440]]);
 const off=JSON.parse(JSON.stringify(c));off.crew.help.on=false;assert.equal(KS.today(off,st2,'wd',1).length,0,'off なら前と同じ');console.log('  本部の応援：だれもいない日は 4:30〜24:00 に1人');}
