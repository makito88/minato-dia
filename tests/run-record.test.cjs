/* 運行の記録（js/run-record-core.js・docs/run-record-plan.md の手順1）の確かめ：node tests/run-record.test.cjs */
const assert = require('node:assert');
const fs = require('node:fs'), path = require('node:path');
const C = require('../js/ctc-core.js');
const RC = require('../js/run-record-core.js');

/* 駅（index.html の km・bkm） */
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const ST = {};
for (const m of html.matchAll(/^\s+([CSUMKNPFTO]):\{name:'([^']+)',(?:km:([\d.]+),)?(?:bkm:([\d.]+),)?/gm)) ST[m[1]] = { name: m[2], km: m[3] != null ? +m[3] : undefined, bkm: m[4] != null ? +m[4] : undefined };
['U', 'M', 'K'].forEach(s => { ST[s].taihi = true; });
const TYPES = { L: { name: '普通', prio: 1, dwell: 0.5 }, E: { name: '特急', prio: 4, dwell: 0.5 } };
const X = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'ctc-extra.json'), 'utf8'));

/* 小さな1日：中央〜港の普通が往復（編成2本）、特急が1往復 */
const MAIN = ['C', 'S', 'U', 'M', 'K', 'N', 'P'];
let num = 1001;
function mkTrip(type, seq, t0, down, stops) {
  const arr = [t0], dep = [t0];
  for (let i = 1; i < seq.length; i++) { const run = Math.abs(ST[seq[i]].km - ST[seq[i - 1]].km) * (type === 'E' ? 0.9 : 1.4) + 0.6; arr.push(dep[i - 1] + run); dep.push(arr[i] + (i === seq.length - 1 ? 0 : (stops[i] ? 0.5 : 0))); }
  return { type, num: type === 'E' ? 5000 + (num++ % 100) * 2 + (down ? 1 : 0) : (num++) * 2 + (down ? 1 : 0), seq, stop: stops, down, arr, dep, cars: 6, cap: 600, loadAfter: seq.map(() => 500), bAt: seq.map(() => 80), op: seq.map(() => false) };
}
function day0() {
  const trips = [], sets = [];
  for (let k = 0; k < 2; k++) {
    const set = { home: 'C', label: `通勤車0${k + 1}編成`, cars: 6, plat: k, trips: [] };
    for (let t = 360 + k * 30; t < 1200; t += 60) {
      const d = mkTrip('L', MAIN, t, true, MAIN.map(() => true)), u = mkTrip('L', MAIN.slice().reverse(), d.arr[d.arr.length - 1] + 5, false, MAIN.map(() => true));
      d.set = u.set = set; set.trips.push(d, u); trips.push(d, u);
    }
    set.first = set.trips[0].dep[0]; set.last = set.trips[set.trips.length - 1].arr[MAIN.length - 1]; sets.push(set);
  }
  const ex = mkTrip('E', ['C', 'U', 'K', 'P'], 615, true, [true, false, true, true]); trips.push(ex);
  trips.sort((a, b) => a.dep[0] - b.dep[0]);
  return { trips, sets };
}
const D = day0();
const inp = o => Object.assign({ D, ST, TYPES, DEPOTNAME: { C: '中央車庫', P: '港留置線' }, X, hs: null, onSiding: () => false,
  nomDwell: (tr, i) => tr.stop[i] ? 0.5 : 0, evDwell: () => 0, dw: 0, sp: 1, day: 3, incidentK: 1, events: [], cond: { day: 'wd', wx: 'sun' }, policy: 'balance' }, o || {});

/* 1. 指令パネルと同じ材料なら、指令パネルと同じ実際の発着（disrupt を直接呼んだものと一致） */
const rec = RC.build(inp());
assert.strictEqual(rec.v, 1);
{
  const R = rec.raw, D2 = C.disrupt(R.SYN.trips.length ? D.trips.concat(R.SYN.trips) : D.trips, R.hl, { big: R.BIG, ST: R.SX, TYPES: R.TY2, onSiding: R.onSid, nomDwell: R.nomD, day: 3, incidentK: 1, ext: R.EXT,
    pre: C.synLate(R.SYN.trips, { X, day: 3 }), rule: C.POLICY.balance, requests: C.requests(D.trips, { ST: R.SX, TYPES: R.TY2, X, events: [], holiday: false, policy: 'balance' }), boats: R.BOATS });
  for (const row of rec.rows) { const a = D2.A.get(row.tr); assert.deepStrictEqual(row.arr, a.arr, '着 ' + row.num); assert.deepStrictEqual(row.dep, a.dep, '発 ' + row.num); }
}
assert.strictEqual(rec.rows.length, D.trips.length + rec.raw.SYN.trips.length, '定期＋臨時・貨物がぜんぶ同じ表に');
assert.ok(rec.rows.some(r => r.synth && r.offMap), '貨物（地図の外から来る列車）も表にある');
assert.ok(rec.rows.every(r => r.track.length === r.seq.length), '番線は止まる駅ごと');
assert.ok(rec.rows.filter(r => !r.offMap).every(r => r.track.every(x => x != null)), '地図の中の駅には番線がある');

/* 2. 同じ条件なら同じ結果・条件が変われば作り直す（キー） */
const rec2 = RC.build(inp());
assert.deepStrictEqual(rec2.rows.map(r => r.dep.join()), rec.rows.map(r => r.dep.join()), '同じ日・同じ条件なら同じ');
assert.strictEqual(RC.keyOf(inp()), rec.key);
for (const o of [{ day: 4 }, { policy: 'ontime' }, { events: ['hanabi'] }, { cond: { day: 'ho', wx: 'sun' } }, { forceBig: true }, { incidentK: 0.5 }]) assert.notStrictEqual(RC.keyOf(inp(o)), rec.key, JSON.stringify(o));

/* 3. いる場所：キロ程と、2駅のあいだの割合 */
{
  const row = rec.rows.find(r => !r.synth && r.type === 'L' && r.down && !r.cancel);
  const before = RC.where(rec, row, row.arr[0] - 5); assert.strictEqual(before.st, 'before');
  const s0 = RC.where(rec, row, row.dep[0] - 0.01); assert.strictEqual(s0.st, 'stop'); assert.strictEqual(s0.a, 'C'); assert.ok(s0.track != null);
  const mid = (row.dep[2] + row.arr[3]) / 2, w = RC.where(rec, row, mid);
  assert.strictEqual(w.st, 'run'); assert.deepStrictEqual([w.a, w.b], ['U', 'M']);
  assert.ok(w.frac > 0.05 && w.frac < 0.95, '真ん中あたり ' + w.frac);
  assert.ok(w.km > ST.U.km && w.km < ST.M.km, 'キロ程は大学前と緑ヶ丘のあいだ');
  let last = -1; for (let T = row.dep[0]; T <= row.arr[row.arr.length - 1]; T += 0.25) { const q = RC.where(rec, row, T); if (q.km == null) continue; assert.ok(q.km >= last - 0.02, '下りは km が戻らない ' + T); last = q.km; }
  assert.strictEqual(RC.where(rec, row, row.arr[row.arr.length - 1] + 1).st, 'after');
}
/* 地図の外の区間は km を出さない（off） */
{
  const g = rec.rows.find(r => r.synth && r.seq[0] === 'W');
  if (g) { const q = RC.where(rec, g, (g.dep[0] + g.arr[1]) / 2); assert.strictEqual(q.st, 'off'); assert.strictEqual(q.km, null); }
}

/* 4. 大きな事故の訓練：運休の列車は 'cancel'・走らない。事故の列車は記録に残る */
{
  let bd = 1; while (!C.bigIncident(D.trips, { day: bd, force: true })) bd++;   /* 支線の事故（倒木）を選ぶ日は、この小さな1日では起きない */
  const rb = RC.build(inp({ forceBig: true, day: bd }));
  assert.ok(rb.big && rb.big.tr, '事故が起きる');
  assert.ok(rb.decisions.some(c => c.k === 'stop'), '運転見合わせのカード');
  const late = rb.rows.filter(r => !r.cancel && r.late > 0.5); assert.ok(late.length > 0, '遅れる列車がある');
  for (const r of rb.rows.filter(r => r.cancel)) { assert.strictEqual(RC.where(rb, r, r.dep[0] + 1).st, 'cancel'); assert.strictEqual(r.late, null); }
  assert.ok(!RC.liveAt(rb, 800).some(x => x.row.cancel), '運休は線路の上にいない');
  assert.ok(rb.raw.SETS2.every(s => s.trips.every(t => !t.cancel)), '編成の列車から運休を外す');
}

/* 5. 駅の発着（時刻の順） */
{
  const b = RC.boardAt(rec, 'K'); assert.ok(b.length > 10);
  for (let k = 1; k < b.length; k++) assert.ok(b[k].t >= b[k - 1].t);
}

/* 6. 駅の形（data/ctc-haisen.json）があれば番線を割りふる。予定の列車がぜんぶ残る */
{
  const hs = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'ctc-haisen.json'), 'utf8'));
  const ry = RC.build(inp({ hs }));
  assert.ok(ry.raw.yard && ry.raw.yard.map.size > 0, '番線の割りふり');
  assert.strictEqual(ry.rows.length, rec.rows.length);
  for (const r of ry.rows) { if (r.cancel) continue; for (let i = 1; i < r.seq.length; i++) assert.ok(r.arr[i] >= r.dep[i - 1] - 1e-9, '時刻は進む ' + r.num); }
}

/* 計算は DOM を使わない */
const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'run-record-core.js'), 'utf8');
assert.ok(!/document\.|localStorage|window\.(?!CtcCore)/.test(src.replace(/typeof window[^)]*\)/g, '')));
console.log('run-record ok');
