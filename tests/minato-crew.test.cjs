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
    for(const w of W){nW++;const pres=w.spans.reduce((s,[x,y])=>s+y-x,0)/60,br=w.brk?(w.brk[1]-w.brk[0]):0,T=pres+br/60,work=pres;
      assert.ok(work>=3-1e-9&&work<=8+1e-9,'1日3〜8時間 '+work);
      const want=T<=4?0:(T-0.75>=8?60:45);assert.equal(br,want,'休憩 '+T+'時間 → '+want+'分');if(br)nBrk++;
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
  assert.equal(res.closedN,0,'閉まっている時間がない');assert.ok(res.crew.every(x=>x.yen/x.h>=1280-1e-6),'時給は1,280円から');}
console.log(`  店員の日 ${nW}（休憩あり ${nBrk}・18歳未満 ${nMinor}・4:30から ${nEarly}）・だれもいない時間がある日 ${nGap}/${nDay}`);
console.log('minato-crew ok');
