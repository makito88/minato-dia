/* 経営の計算（js/keiei-core.js）：node tests/keiei-core.test.cjs */
const assert = require('node:assert/strict');
const K = require('../js/keiei-core.js'), cfg = require('../data/keiei.json');
const st = K.create(cfg, 1);
assert.equal(st.bal, cfg.start.bal); assert.equal(st.share, cfg.share.def);
/* 投資なし → 倍率なし（乗客の計算は前と同じ） */
assert.equal(K.fx(cfg, st, 5).any, false);
const o = [10, 5, 3, 7]; assert.deepEqual(K.apply(K.fx(cfg, st, 5), o.slice(), 'K', 'C'), o);
st.bal = 2e9;
/* 買う：積み立てから引く・同じ駅に2つは建てない・足りなければ断る */
assert.ok(K.buy(cfg, st, 'mall', 'K', 3).ok);
assert.equal(st.bal, 2e9 - K.item(cfg, 'mall').cost);
assert.equal(K.buy(cfg, st, 'mall', 'K', 3).ok, false);
assert.equal(K.buy(cfg, st, 'mall', 'S', 3).ok, false, 'モールは桜町に建てられない');
const poor = K.create(cfg, 1); poor.bal = 1; assert.equal(K.buy(cfg, poor, 'kaizen', 'C', 1).why, '積み立てが足りません');
/* 工事中は効き目0、そのあと少しずつ1へ */
const it = K.item(cfg, 'mall'), own = st.owned[0];
assert.equal(K.progress(cfg, own, 3 + it.build - 1), 0);
assert.ok(K.progress(cfg, own, 3 + it.build) > 0 && K.progress(cfg, own, 3 + it.build) < 1);
assert.equal(K.progress(cfg, own, 3 + it.build + it.ramp + 5), 1);
const F = K.fx(cfg, st, 3 + it.build + it.ramp + 5);
assert.ok(F.any && F.D.K[3] > 0.1, 'モールの駅で降りる買い物の人がふえる');
const shop = K.apply(F, [0, 0, 0, 100], 'C', 'K'); assert.ok(shop[3] > 110);
assert.equal(K.apply(K.fx(cfg, st, 400, 0), [0, 0, 0, 100], 'C', 'K')[3], 100, '強さ0なら前と同じ');
/* 1日を締める：利益×割合＋事業の収入−保守 が積み立てにふえる・記録は1日1行 */
const m = { riders: 120000, aband: 10000, left: 2000, rev: 6e7, cost: 1.7e7, profit: 4.5e7, crowdShare: 0.05, conv: 1.08, boardBy: { C: 50000, K: 10000 }, lateShare: 0.03 };
const b0 = st.bal, day = 3 + it.build + it.ramp + 5;
const r = K.closeDay(cfg, st, m, day);
const inc = it.income, mc = cfg.maint.levels.mid.cost;
assert.equal(Math.round(st.bal), Math.round(b0 + 4.5e7 * st.share + inc - mc));
K.closeDay(cfg, st, m, day); assert.equal(st.log.filter(x => x.day === day).length, 1, '同じ日をもう一度締めても1行');
{ const b1 = st.bal, r2 = K.closeDay(cfg, st, { ...m, fee: 220000 }, day + 1); assert.equal(Math.round(st.bal - b1), Math.round(4.5e7 * st.share + inc - mc + 220000), '線路使用料も収入に入る'); assert.equal(r2.fee, 220000); }
assert.ok(r.sat > 0 && r.sat <= 100); assert.equal(r.boardAlight, 240000);
/* 満足度：混雑が多いほど下がる・保守を手厚くすると上がる・できごとがへる */
const s1 = K.satisfaction(cfg, st, m, day).score, s2 = K.satisfaction(cfg, st, { ...m, crowdShare: 0.3 }, day).score;
assert.ok(s2 < s1);
st.maint = 'high'; assert.ok(K.satisfaction(cfg, st, m, day).score > s1); assert.ok(K.incidentK(cfg, st) < 1);
/* こわれた保存は作り直す */
assert.equal(K.normalize({ v: 9 }, cfg, 2).bal, cfg.start.bal);
console.log('keiei-core ok');
