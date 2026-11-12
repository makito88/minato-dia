// 工場の原材料（第5回・2026-11-11）：何夜か回して、在庫の数が合うことを確かめる
//  ・在庫＝はじめ＋入荷 −（使った量 − 足りなかった量）。ロットの残りの合計＝在庫
//  ・古いロットから使う（先入れ先出し）。ロットのたどりの合計＝使った量 − 足りなかった量
//  ・同じ運行日に2回進めても、2回は数えない。発注があって納品書がまだの夜は待つ
//  ・製造の計算は変えない（runNight の出荷数は、原材料を足す前と同じ）
const assert=require('node:assert/strict');
for(const f of ['factory-core','bread-core','sand-loaf','sand-core','donut-core','bento-core','factory-night','material-core'])require('../js/'+f+'.js');
const D=require('../data/factory.json'),C=require('../data/center.json');
const {FactoryNight:FN,MaterialCore:MC}=globalThis;
const near=(a,b,m)=>assert.ok(Math.abs(a-b)<1e-6,m+` ${a} ≠ ${b}`);

// センターの発注（売店の商品ID）：工場で作る品を少しずつ
const map=FN.kioskMap(D),pids=Object.keys(map);
const log={v:1,days:[]};
const NIGHTS=20;
for(let day=2;day<=NIGHTS+1;day++){const items={};pids.forEach((p,i)=>{items[p]=10+((day*7+i*3)%25);});
  const d={day,factory:{no:'F'+day,items},orders:{'M-1':{no:'O'+day,factory:items}},cond:{season:'aut'}};
  const night=FN.runNight(D,{rice:{},bread:{},sand:{},donut:{}},{day,no:d.factory.no,items,season:'aut'});
  // 製造の計算は変えない：作った数は出荷＋余り＋遅れ＋だめ。出荷数は注文を超えない
  for(const L in night.lines){const ln=night.lines[L];assert.ok(ln.mk,'品ごとに作った数 '+L);assert.ok(ln.shipped<=ln.order);}
  assert.ok(night.lines.rice.pots>0,'米の釜の数');
  d.slip=FN.slip(D,C,d,night);log.days.push(d);}
// 発注はあるのに、まだ納品書がない日（待つ）
log.days.push({day:NIGHTS+2,factory:{no:'Fx',items:{[pids[0]]:5}},orders:{}});

let S=null;const step1=MC.catchUp(D,S,log,8);S=step1.state;
assert.equal(step1.done,1,'はじめは前の夜（第7運行日の夜）だけ');assert.equal(S.last,7);
const again=MC.catchUp(D,S,log,8);assert.equal(again.done,0,'同じ運行日に2回進めても数えない');
const r2=MC.catchUp(D,S,log,NIGHTS+2);S=r2.state;assert.equal(S.last,NIGHTS,'第'+(NIGHTS+1)+'運行日の納品書の夜まで');
const r3=MC.catchUp(D,S,log,NIGHTS+3);assert.equal(r3.done,0,'納品書がまだの夜は待つ');
assert.ok(S.log.every(r=>r.est===0||r.n<8),'納品書のある夜は見込みではない');

// 数のつじつま
const init={},tin={},tuse={},tshort={};
for(const l of S.lots)if(l.i)init[l.m]=(init[l.m]||0)+l.q;
for(const r of S.log){for(const [m,q] of r.in)tin[m]=(tin[m]||0)+q;for(const m in r.use)tuse[m]=(tuse[m]||0)+r.use[m];for(const m in r.short||{})tshort[m]=(tshort[m]||0)+r.short[m];
  for(const m in r.use){const got=(r.from[m]||[]).reduce((a,x)=>a+x[1],0);near(got,r.use[m]-((r.short||{})[m]||0),'ロットのたどりの合計＝使った量−足りない '+m+' 夜'+r.n);}}
for(const it of D.materials.items){const m=it.id,stock=MC.stockOf(S,m),calc=(init[m]||0)+(tin[m]||0)-((tuse[m]||0)-(tshort[m]||0));
  near(stock,calc,'在庫＝はじめ＋入荷−使った量 '+m);near(MC.balance(S,m),stock,'balance＝在庫 '+m);
  assert.ok(stock<=it.cap+1e-9,'置ける量まで '+m);}
// 先入れ先出し：ある品で、新しいロットから使い始めたあとに古いロットが残っていない
for(const r of S.log)for(const m in r.from){const ds=r.from[m].map(x=>x[0]);
  for(let i=1;i<ds.length;i++)assert.ok(ds[i-1]<=ds[i],'古いロットから '+m);
  // 使い始めたロットより古いロットは、その夜のあと残っていない（ロットの残りは減るだけなので、最後の状態で確かめる）
  if(r===S.log.at(-1)){const first=ds[ds.length-1];assert.ok(!S.lots.some(l=>l.m===m&&l.d<first&&l.left>0),'古いロットが残っていない '+m);}}
// 米：使った量＝釜の数×1釜の米（＋お弁当のご飯）
{const r=S.log.at(-1),sl=log.days.find(d=>d.day===r.n+1).slip;const bento=(sl.lines.bento?Object.values(sl.lines.bento.mk).reduce((a,b)=>a+b,0):0)*D.bento.mat.perUnit.rice;
  near(r.use.rice,sl.lines.rice.pots*D.riceKg+bento,'米＝釜×'+D.riceKg+'kg');}
// 見込みの夜（納品書がない）：見込みの数で使う
{const S2=MC.catchUp(D,null,{v:1,days:[]},40).state;assert.equal(S2.log.length,1);assert.equal(S2.log[0].est,1,'見込み');assert.ok(S2.log[0].use.rice>0);}
// 長い留守は maxNights 夜まで
{const S3=MC.catchUp(D,MC.catchUp(D,null,null,10).state,null,100).state;assert.ok(S3.log.length<=D.materials.keepDays);assert.equal(S3.last,99);assert.ok(S3.gap>0);
  const kb=JSON.stringify(S3).length/1024;console.log(`  30夜ぶんの dia-materials：${kb.toFixed(1)}KB`);assert.ok(kb<80,'dia-materials が大きすぎる');}
const st=MC.status(D,S);assert.equal(st.length,D.materials.items.length);
const tr=MC.trace(D,S,S.last);{const x=tr.lines.rice.find(x=>x.it.id==='rice');assert.ok(x.from.length>0&&/^KM-\d{4}/.test(x.from[0].no),'この夜のおにぎりの米のロット '+JSON.stringify(x.from[0]));}
assert.ok(MC.receipts(D,S).length>0);
console.log(`  ${S.log.length}夜：米の在庫 ${MC.stockOf(S,'rice')}kg・卵 ${MC.stockOf(S,'egg')}個・足りなかった品 ${Object.keys(tshort).join('・')||'なし'}`);
console.log('material-core.test ok');
