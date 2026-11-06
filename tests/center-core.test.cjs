// センターのおまかせ発注の計算のテスト：記録がなければ店の数のまま、新聞・雑誌・たばこは店の数、ねらいで数の順がそろう、記録は30日ぶんに切る
const assert=require('assert'),CC=require('../js/center-core.js'),K=require('../data/kiosk.json'),C=require('../data/center.json');
const P=Object.fromEntries(K.products.map(p=>[p.id,p]));
const oni=K.products.find(p=>p.genre==='onigiri').id,tea=K.products.find(p=>p.genre==='colddrink').id,news=K.products.find(p=>p.genre==='paper').id;
const shelf={[oni]:{cap:8},[tea]:{cap:6},[news]:{cap:10}},state={st:'C',place:'home',order:{[oni]:12,[tea]:12,[news]:10},custH:{}};
// 記録なし → いまの数
let p=CC.plan(K,C,state,[],{day:'wd',wx:'sun',season:'aut'},{aim:'mid',shelf});
assert.deepStrictEqual(p.items,{[oni]:12,[tea]:12,[news]:10});
assert.strictEqual(CC.routeOf(C,'onigiri'),'factory');assert.strictEqual(CC.routeOf(C,'paper'),'direct');assert.strictEqual(CC.routeOf(C,'colddrink'),'center');
// 平日に20個売れて4人逃した記録が8日 → おにぎりは20前後、ねらいで 廃棄を少なく ≤ その間 ≤ 売り切れを少なく
const recs=[];for(let d=1;d<=8;d++)recs.push({day:d,store:'C-home',cond:{day:'wd',wx:'sun',season:'aut'},items:{[oni]:[20,4,0,0],[tea]:[30,0,0,5],[news]:[9,0,0,0]}});
const q={};for(const a of ['waste','mid','soldout'])q[a]=CC.plan(K,C,state,recs,{day:'wd',wx:'sun',season:'aut'},{aim:a,shelf}).items;
assert.ok(q.waste[oni]<=q.mid[oni]&&q.mid[oni]<=q.soldout[oni],JSON.stringify(q));
assert.ok(q.mid[oni]>=17&&q.mid[oni]<=25,'おにぎり '+q.mid[oni]);
assert.strictEqual(q.mid[news],10,'新聞は店の数のまま');
assert.ok(q.mid[tea]>=6,'飲み物は棚1杯以上');
// ほかの店の記録はまぜない
assert.deepStrictEqual(CC.plan(K,C,state,recs.map(r=>({...r,store:'U-soto'})),{day:'wd',wx:'sun',season:'aut'},{aim:'mid',shelf}).items[oni],12);
// 記録：発注番号・工場への合計・30日で切る
let log=CC.emptyLog();for(let d=1;d<=40;d++){CC.putRecord(log,{...recs[0],day:d},30);CC.putOrder(K,C,log,d+1,'C-home',{items:{[oni]:10,[tea]:5,[news]:3},mode:'auto',aim:'mid'},30);}
assert.ok(log.days.length<=31);const last=log.days.at(-1);
assert.strictEqual(last.orders['C-home'].no,'O0041-C-home');assert.deepStrictEqual(last.factory.items,{[oni]:10});assert.deepStrictEqual(last.orders['C-home'].direct,{[news]:3});
console.log('center-core ok');
