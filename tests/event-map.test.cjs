// 第8回（2026-11-14）地図の吹き出し：置いたイベントの形・その日に出るか・暦の帯・まとめ方・近くの駅・絵文字の絵がそろっているか
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const M=require('../js/event-map-core.js');
const RC=require('../js/route-core.js');
const cfg=require('../data/event-map.json'),routes=require('../data/routes.json');
const root=path.join(__dirname,'..');
// 形をそろえる：こわれたものは落とす・金の文字は2文字まで・効き目はなくてもよい
const ev=M.normalize({items:{a:{name:'花火',icon:{e:'🎆'},x:100,y:200,date:'2026-11-14',rep:'once'},b:{x:'x'},c:{icon:{t:'市場まつり'},x:1,y:2,date:'2025-11-14',rep:'year'},d:{icon:{e:'📚'},x:3,y:4,date:'2026-11-07',rep:'week',fx:{ride:'m',goods:['hot',3]}}},recent:['🎆',5]});
assert.deepEqual(Object.keys(ev.items),['a','c','d']);assert.equal(ev.items.c.icon.t,'市場');assert.deepEqual(ev.items.d.fx,{ride:'m',goods:['hot']});assert.deepEqual(ev.items.a.fx,{ride:'',goods:[]});
assert.deepEqual(ev.recent,['🎆']);assert.equal(ev.v,1);
// その日に出るか
assert.ok(M.occurs(ev.items.a,'2026-11-14'));assert.ok(!M.occurs(ev.items.a,'2026-11-15'));
assert.ok(M.occurs(ev.items.c,'2026-11-14')&&M.occurs(ev.items.c,'2027-11-14')&&!M.occurs(ev.items.c,'2024-11-14'),'毎年：同じ月日・始めた年から');
assert.ok(M.occurs(ev.items.d,'2026-11-14')&&M.occurs(ev.items.d,'2026-11-21')&&!M.occurs(ev.items.d,'2026-10-31')&&!M.occurs(ev.items.d,'2026-11-15'),'毎週：同じ曜日・始めた日から');
assert.deepEqual(M.forDay(ev,'2026-11-14').map(x=>x.id).sort(),['a','c','d']);
// 暦の帯：前後の日と、その日の数
const S=M.strip(ev,'2026-11-14',3,3);assert.equal(S.length,7);assert.equal(S[3].ymd,'2026-11-14');assert.equal(S[3].n,3);assert.equal(S[0].ymd,'2026-11-11');assert.equal(S[3].dow,6);
// 運行日の番号と日付（季節のできごとと同じ数え方）
const SC=require('../js/season-core.js');for(const y of ['2026-01-01','2026-11-14','2027-02-28'])assert.equal(SC.ymdOf(M.indexOf(y)),y);
assert.equal(M.todayYmd(Date.parse('2026-11-14T04:00:00+09:00')),'2026-11-13','朝4:30より前は前の運行日');
// 時刻
assert.equal(M.toMin('19:30'),1170);assert.equal(M.toMin('0:40'),1480);assert.equal(M.hm(1480),'0:40');
assert.equal(M.state(600,900,500),'before');assert.equal(M.state(600,900,700),'during');assert.equal(M.state(600,900,901),'after');
// 近くの駅・まとめる
const st=routes.rail.stations;assert.equal(M.nearest(st,600,290),'K');assert.equal(M.nearest(st,905,335),'P');
const g=M.cluster([{x:0,y:0},{x:10,y:5},{x:100,y:0}],26);assert.equal(g.length,2);assert.equal(g[0].items.length,2);
// お絵かき帖の保存（dia-routes）に入れても、路線の形をそろえるときに消えない・「ぜんぶ消す」以外では残る
const doc=RC.normalize({nodes:{},edges:{},stops:{},lines:{},order:[],evs:ev},routes);assert.deepEqual(doc.evs,ev);
// 絵文字の絵：設定に書いたものが全部 assets にある（tools/emoji-pick.py と同じ名前の決まり）
const dir=path.join(root,cfg.emojiDir),need=new Set();cfg.catalog.forEach(c=>c.items.forEach(([e])=>need.add(e)));Object.values(cfg.game).forEach(v=>need.add(v.e));Object.values(cfg.weather).forEach(v=>need.add(v.e));['spr','sum','aut','win'].forEach(k=>need.add(cfg.season[k]));
for(const e of need)assert.ok(fs.existsSync(path.join(dir,M.fileOf(e))),'絵がない：'+e+' '+M.fileOf(e));
assert.equal(M.fileOf('♨️'),'2668.svg');
// 言葉で探す・種類
assert.ok(M.search(cfg.catalog,'花火').some(x=>x.e==='🎆'));assert.equal(M.kindOfEmoji(cfg.catalog,'⚽'),'sport');assert.deepEqual(M.pushRecent(['a','b'],'b'),['b','a']);
// ゲームのイベント（index.html の EVENT_DATA）すべてに絵がある
const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),ids=[...html.slice(html.indexOf('const EVENT_DATA=['),html.indexOf('const EVMAP=')).matchAll(/\{id:'(\w+)'/g)].map(m=>m[1]);
assert.ok(ids.length>30);for(const id of ids)assert.ok(cfg.game[id],'ゲームのイベントの絵がない：'+id);
// 種類の色はすべて #rrggbb・ゲームが出す種類（季節のできごと）はお絵かき帖で選べない
cfg.kinds.forEach(k=>assert.match(k.rim,/^#[0-9a-f]{6}$/i));assert.ok(cfg.kinds.find(k=>k.id==='season').game);
// 計算の部分は DOM を使わない
const src=fs.readFileSync(path.join(root,'js/event-map-core.js'),'utf8');assert.ok(!/document\.|window\.|localStorage/.test(src));
console.log('event-map.test ok（絵文字 '+need.size+'・ゲームのイベント '+ids.length+'）');
