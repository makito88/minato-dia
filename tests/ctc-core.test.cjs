/* 長い指令パネルの計算（js/ctc-core.js）の小さな確かめ：node tests/ctc-core.test.cjs */
const assert = require('node:assert');
const fs = require('node:fs'), path = require('node:path');
const C = require('../js/ctc-core.js');

/* index.html の ST の km・bkm を読む（パネルはキロどおり） */
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const ST = {};
for (const m of html.matchAll(/^\s+([CSUMKNPFTO]):\{name:'([^']+)',(?:km:([\d.]+),)?(?:bkm:([\d.]+),)?/gm)) ST[m[1]] = { name: m[2], km: m[3] != null ? +m[3] : undefined, bkm: m[4] != null ? +m[4] : undefined };
['U', 'M', 'K'].forEach(s => { ST[s].taihi = true; });
assert.strictEqual(ST.P.km, 21.5); assert.strictEqual(ST.O.bkm, 12.9); assert.strictEqual(ST.K.bkm, 0);

/* 縮尺：駅の x はキロ×pxk（中央からの差） */
for (const pxk of [100, 200, 400]) {
  const L = C.layout(ST, pxk);
  for (const s of C.MAIN) assert.ok(Math.abs(L.xm(ST[s].km) - L.xm(0) - ST[s].km * pxk) < 1e-6);
  assert.ok(Math.abs(L.xb(ST.O.bkm) - L.xm(ST.K.km) - ST.O.bkm * pxk) < 1e-6);
  assert.ok(L.W >= L.xm(ST.P.km) && L.W >= L.xb(ST.O.bkm));
}

/* 列車の位置：駅に止まっているときは駅の x、走っているときは2駅のあいだ */
const L = C.layout(ST, 200);
const TYPES = { L: { name: '普通', prio: 1 }, E: { name: '特急', prio: 4 } };
const mk = (type, num, seq, times, down) => ({ type, num, seq, cars: 6, down, arr: times.map(t => t[0]), dep: times.map(t => t[1]), stop: seq.map(() => true), op: seq.map(() => false), want: times[0][1] });
const local = mk('L', 1001, ['C', 'S', 'U', 'M'], [[0, 0], [5, 5.5], [10, 14], [19, 19]], true);
const exp = mk('E', 5001, ['C', 'U', 'M'], [[6, 6], [11.5, 11.5], [15, 15]], true);
exp.stop = [true, false, true];
const onSiding = (tr, i) => tr === local && tr.seq[i] === 'U';
const env = { ST, TYPES, onSiding, nomDwell: (tr, i) => tr.stop[i] ? 0.5 : 0, evDwell: () => 0, trips: [local, exp] };
const p0 = C.trainPos(local, 12, L, env);
assert.ok(!p0.moving && Math.abs(p0.x - L.xm(ST.U.km)) < 1e-6, '大学前に止まっている');
assert.strictEqual(p0.y, C.Y.main - C.Y.side, '待避線（下りの外側）にいる');
const p1 = C.trainPos(local, 7, L, env);
assert.ok(p1.moving && p1.x > L.xm(ST.S.km) && p1.x < L.xm(ST.U.km), '桜町と大学前のあいだ');

/* 停車が長い理由：大学前で特急の通過待ち */
const r = C.reasons(local, 2, env);
assert.strictEqual(r[0].code, 'taihi'); assert.strictEqual(r[0].by, exp);
assert.ok(Math.abs(r[0].min - 3.5) < 1e-6);
assert.deepStrictEqual(C.reasons(local, 1, env), [], '桜町はふつうの停車');

/* 見どころ（index.html の makeEvents と同じ決まり） */
const sets = [{ home: 'C', label: '通勤車01編成', cars: 6, first: 0, last: 19, trips: [local] }];
const hl = C.highlights([local, exp], sets, { ST, TYPES, onSiding, DEPOTNAME: { C: '中央車庫', P: '港留置線' } });
assert.ok(hl.some(h => h.k === 'taihi' && h.a === local && h.b === exp && h.radio.includes('5001')));
assert.strictEqual(hl.filter(h => h.k === 'depot').length, 2);
assert.ok(C.inDepot(sets[0], -9) && !C.inDepot(sets[0], 5));

/* 計算は DOM を使わない */
const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'ctc-core.js'), 'utf8');
assert.ok(!/document\.|window\.(?!CtcCore)/.test(src.replace(/typeof window[^)]*\)/g, '')));
console.log('ctc-core ok');

/* 段2：きょうの乱れ（見せ方の層） */
{
  const loc2 = mk('L', 1003, ['C', 'S', 'U', 'M'], [[20, 20], [25, 25.5], [30, 34], [39, 39]], true);
  const exp2 = mk('E', 5003, ['C', 'U', 'M'], [[26, 26], [31.5, 31.5], [35, 35]], true); exp2.stop = [true, false, true];
  const all = [loc2, exp2], onS = (tr, i) => tr === loc2 && tr.seq[i] === 'U';
  const env2 = { ST, TYPES, onSiding: onS, nomDwell: (tr, i) => tr.stop[i] ? 0.5 : 0, day: 3 };
  const hl2 = C.highlights(all, [], { ST, TYPES, onSiding: onS, DEPOTNAME: {} });
  const R2 = C.disrupt(all, hl2, env2);
  for (const tr of all) { const a = R2.A.get(tr); a.dep.forEach((d, i) => assert.ok(d >= tr.dep[i] - 1e-9 || R2.swaps.size, '予定より早く出ない（入れかえのときをのぞく）')); }
  const p2 = C.actual(loc2, R2); assert.strictEqual(p2.base, loc2); assert.strictEqual(p2.seq, loc2.seq);
  assert.strictEqual(C.disrupt(all, hl2, env2).A.get(loc2).arr.join(), R2.A.get(loc2).arr.join(), '同じ日なら同じ結果');
  /* 遅れの理由はコードつき・カードは4つの欄がそろう */
  for (const tr of all) R2.A.get(tr).why.flat().forEach(w => assert.ok(C.REASON[w.code], w.code));
  R2.decisions.forEach(c => ['what', 'dec', 'why', 'res', 'radio'].forEach(k => assert.ok(typeof c[k] === 'string' && c[k], k)));
  console.log('ctc-core 段2 ok');
}
