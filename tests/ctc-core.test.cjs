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

/* 段3：貨物・臨時列車のスジ、外との接続、線路使用料（data/ctc-extra.json） */
{
  const X = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'ctc-extra.json'), 'utf8'));
  const S3 = C.extST(Object.fromEntries(Object.entries(ST).map(([k, v]) => [k, Object.assign({}, v, { wait: ['C', 'U', 'M', 'K', 'P', 'F', 'T', 'O'].includes(k) })])));
  assert.ok(S3.W.km < 0 && S3.Q.km === ST.P.km && !ST.W, '駅をふやすのは写しだけ（もとの ST は変えない）');
  /* 定期列車：中央10:00発の普通（全駅）。すき間に入れる貨物はこれと区間で重ならない */
  const reg0 = { type: 'L', seq: ['C', 'S', 'U', 'M', 'K', 'N', 'P'], stop: [1, 1, 1, 1, 1, 1, 1].map(Boolean), down: true, num: 1001 };
  reg0.dep = [600, 604, 608, 612, 617, 622, 627]; reg0.arr = [600, 603.5, 607.5, 611.5, 616.5, 621.5, 627];
  const syn = C.synth({ ST: S3, trips: [reg0], X, events: ['hanabi', 'nope'], holiday: false, sp: 1, dw: 0, day: 1 });
  assert.strictEqual(syn.trips.filter(t => t.type === 'Z').length, 2, 'イベントの日は臨時が1往復（知らないイベントは走らない）');
  assert.strictEqual(syn.trips.filter(t => t.type === 'G').length, 4, '平日の貨物は2往復');
  assert.strictEqual(C.synth({ ST: S3, trips: [reg0], X, events: [], holiday: true, sp: 1, dw: 0, day: 1 }).trips.length, 2, '休日は夜の貨物だけ');
  for (const t of syn.trips) {
    for (let i = 1; i < t.seq.length; i++) assert.ok(t.arr[i] > t.dep[i - 1] && t.dep[i] >= t.arr[i] - 1e-9, '時刻は進む ' + t.num);
    assert.ok(t.dep[0] >= t.want - 1e-9, '希望より早く出ない');
    assert.ok(t.seq.includes('C') && t.stop[t.seq.indexOf('C')], '中央で乗務員の交代');
    /* 同じ区間・同じ向きで追いこさない（走っているあいだの追いこしはない） */
    for (let i = 0; i < t.seq.length - 1; i++) { const j = reg0.seq.indexOf(t.seq[i]); if (j < 0 || reg0.seq[j + 1] !== t.seq[i + 1]) continue; assert.ok((reg0.dep[j] - t.dep[i]) * (reg0.arr[j + 1] - t.arr[i + 1]) >= 0, '区間で追いこさない'); }
  }
  const g = syn.trips.find(t => t.type === 'G' && t.down);
  assert.deepStrictEqual([g.seq[0], g.seq[g.seq.length - 1]], ['W', 'Q'], '貨物は連絡線から港貨物ターミナルへ');
  assert.ok(g.num % 2 === 1 && g.num > 8000, '下りは奇数');
  /* 線路使用料：連絡線の外（W〜中央）は数えない */
  const f = C.fee(syn.trips, X, S3);
  assert.ok(Math.abs(f.km.G - 4 * ST.P.km) < 1e-6, '貨物は 中央〜港のキロ×本数');
  assert.strictEqual(f.yen, Math.round(f.km.G * X.fee.G + f.km.Z * X.fee.Z));
  /* 外との接続：県央本線の到着から4〜12分で出る下りに乗りかえ。遅れたら5分まで待ち、こえたら打ち切り */
  const T3 = Object.assign({}, TYPES, C.SYN_TYPES);
  const ours = mk('L', 1101, ['C', 'S', 'U'], [[440, 440], [444, 444.5], [448, 448]], true);
  const ext = [{ t: 436, k: 'connOther', st: 'C', a: ours, arr: 432, late: 6, xfer: 4, label: '県央本線 特急 ひばり', ext: true, txt: 'x', radio: 'x' }];
  const R3 = C.disrupt([ours], ext, { ST, TYPES: T3, onSiding: () => false, nomDwell: () => 0.5, day: 2, ext });
  const a3 = R3.A.get(ours); assert.ok(Math.abs(a3.dep[0] - 442) < 1e-6, '6分遅れ→2分待つ');
  assert.ok(a3.why[0].some(w => w.code === 'connOther'), '理由は他社線との接続');
  assert.ok(R3.decisions.some(c => c.k === 'connOther' && c.what.includes('県央本線')));
  ext[0].late = 12;
  const R4 = C.disrupt([ours], ext, { ST, TYPES: T3, onSiding: () => false, nomDwell: () => 0.5, day: 2, ext });
  assert.ok(R4.A.get(ours).dep[0] < 440.01 && R4.decisions.some(c => c.k === 'connCut' && c.ext), '12分遅れは打ち切り');
  const hl3 = C.extConns([reg0, ours], syn.trips, { ST: S3, TYPES: T3, X, day: 5, wx: 'sun' });
  hl3.forEach(h => { assert.ok(C.REASON[h.k] && h.a && h.txt && h.radio, h.k); assert.ok(h.a.dep[h.a.seq.indexOf(h.st)] >= h.arr + h.xfer - 1e-9, '乗りかえの時間がある'); });
  assert.ok(C.synHighlights([], syn.trips, { ST: S3, TYPES: T3 }).some(h => h.k === 'crew'));
  console.log('ctc-core 段3 ok');
}

/* 段4：方針と自社の要望・フェリーの最終便 */
{
  const X = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'ctc-extra.json'), 'utf8'));
  const T4 = Object.assign({}, TYPES, C.SYN_TYPES, { R: { name: '快速', prio: 2 } });
  for (const k in C.POLICY) assert.ok(C.POLICY[k].name && C.POLICY[k].say && C.POLICY[k].connMax > 0, k);
  /* 接続を待つ上限：4分おくれの県央本線（予定の余裕なし）→ バランスは待つ・定時重視は打ち切る */
  const ours = mk('L', 1101, ['C', 'S', 'U'], [[436, 436], [440, 440.5], [444, 444]], true);
  const ext = [{ t: 436, k: 'connOther', st: 'C', a: ours, arr: 432, late: 4, xfer: 4, label: '県央本線 快速', ext: true, txt: 'x', radio: 'x' }];
  const go = rule => C.disrupt([ours], ext, { ST, TYPES: T4, onSiding: () => false, nomDwell: () => 0.5, day: 2, ext, rule });
  assert.ok(Math.abs(go(C.POLICY.balance).A.get(ours).dep[0] - 440) < 1e-6, 'バランス：4分待つ');
  const g2 = go(C.POLICY.ontime); assert.ok(g2.A.get(ours).dep[0] < 436.01 && g2.decisions.some(c => c.k === 'connCut' && c.why.includes('2分')), '定時重視：2分をこえるので打ち切り');
  assert.strictEqual(go().A.get(ours).dep[0], go(C.POLICY.balance).A.get(ours).dep[0], '方針なし＝バランス（前と同じ）');
  /* 売上重視：特急は待たせない */
  const exp4 = mk('E', 5101, ['C', 'U'], [[436, 436], [441, 441]], true), ext4 = [Object.assign({}, ext[0], { a: exp4 })];
  assert.ok(C.disrupt([exp4], ext4, { ST, TYPES: T4, onSiding: () => false, nomDwell: () => 0.5, day: 2, ext: ext4, rule: C.POLICY.sales }).A.get(exp4).dep[0] < 436.01, '売上重視：特急は1.5分まで');
  /* 要望：工場の一般公開日に、新田を通過する快速を止める。定時重視はことわる */
  const rap = mk('R', 3001, ['K', 'N', 'P'], [[600, 600], [603, 603], [607, 607]], true); rap.stop = [true, false, true];
  const loc = mk('L', 1201, ['K', 'N', 'P'], [[610, 610], [614, 614.5], [619, 619]], true);
  const renv = pol => ({ ST, TYPES: T4, X, events: ['kojo'], holiday: false, policy: pol });
  const qb = C.requests([rap, loc], renv('balance')).find(q => q.id === 'kojo-stop'), qo = C.requests([rap, loc], renv('ontime')).find(q => q.id === 'kojo-stop');
  assert.ok(qb.ok && qb.n === 1 && qb.hits[0].tr === rap && !qo.ok, '快速だけ・定時重視はことわる');
  assert.ok(!C.requests([rap, loc], Object.assign(renv('balance'), { events: [] })).some(q => q.id === 'kojo-stop'), '行事のない日は要望なし');
  const R5 = C.disrupt([rap, loc], [], { ST, TYPES: T4, onSiding: () => false, nomDwell: (tr, i) => tr.stop[i] ? 0.5 : 0, day: 2, requests: [qb] });
  const a5 = R5.A.get(rap); assert.ok(Math.abs(a5.dep[1] - a5.arr[1] - 1) < 1e-6 && a5.why[1].some(w => w.code === 'request'), '新田に1分止まる・理由は自社の要望');
  const c5 = R5.decisions.find(c => c.req); ['what', 'dec', 'why', 'res', 'radio'].forEach(k => assert.ok(c5[k], k)); assert.ok(c5.dec.startsWith('受ける'));
  assert.ok(C.disrupt([rap, loc], [], { ST, TYPES: T4, onSiding: () => false, nomDwell: () => 0, day: 2, requests: [qo] }).decisions.find(c => c.req).dec === 'ことわる');
  /* フェリーの最終便：乗りつげるいちばんおそい下り */
  const d1 = mk('L', 1301, ['N', 'P'], [[1270, 1270], [1276, 1276]], true), d2 = mk('L', 1303, ['N', 'P'], [[1281, 1281], [1287, 1287]], true);
  const bt = C.boats([d1, d2], { X }); assert.ok(bt.length === 1 && bt[0].tr === d1 && bt[0].t === 1290, '21:30の最終便には 21:16着の列車（歩いて7分）');
  const st4 = C.policyStats([ours], go(C.POLICY.balance)); assert.ok(st4.n === 1 && st4.held === 1 && st4.cut === 0 && st4.ontime === 0);
  console.log('ctc-core 段4 ok');
}

/* 段5：大きな事故（運転見合わせ・先の駅がふさがる・運転再開・運休） */
{
  const T5 = Object.assign({}, TYPES, C.SYN_TYPES);
  const seq = ['C', 'S', 'U', 'M'], line = (num, t) => mk('L', num, seq, [[t, t], [t + 4, t + 4.5], [t + 8.5, t + 9], [t + 13, t + 13]], true);
  const t1 = line(1001, 600), t2 = line(1003, 610), t3 = line(1005, 620), t4 = line(1007, 630), all = [t1, t2, t3, t4];
  /* 桜町〜大学前で 30分。事故にあうのは 1003（610発・桜町 614.5発） */
  const big = { name: '架線にビニールがからまった', a: 'S', b: 'U', t0: 616, t1: 646, dur: 30, tr: t2, i: 1, f: 0.4 };
  const env5 = { ST, TYPES: T5, onSiding: () => false, nomDwell: (tr, i) => tr.stop[i] ? 0.5 : 0, day: 4, big };
  const R = C.disrupt(all, [], env5), a = t => R.A.get(t);
  assert.ok(a(t1).arr[3] < 613.5, '事故の前に通った列車はそのまま');
  assert.ok(a(t2).arr[2] > 640, '事故にあった列車は再開まで動けない');
  assert.ok(a(t3).dep[1] >= 646 - 1e-6 && a(t3).why[1].some(w => w.code === 'stop'), '次の列車は桜町で運転見合わせ');
  assert.ok(a(t4).dep[0] >= a(t3).dep[1] + 0.3 - 4 - 1e-6 && a(t4).why[0].some(w => w.code === 'jam'), 'その次は中央で待つ（桜町がふさがっている）');
  assert.ok(a(t4).arr[1] >= a(t3).dep[1], '同じ駅に2本入らない');
  for (const k of ['stop', 'furikae', 'resume']) { const c = R.decisions.find(x => x.k === k); assert.ok(c, k); ['what', 'dec', 'why', 'res', 'radio'].forEach(f => assert.ok(c[f], k + f)); }
  const R0 = C.disrupt(all, [], Object.assign({}, env5, { big: null })); assert.ok(R0.A.get(t3).dep[1] < 626 && !R0.decisions.some(c => c.big), '事故がなければ前と同じ');
  /* 運休：車庫のある駅に20分をこえて遅れて戻った編成は、次の1往復を休む */
  const o1 = line(1101, 590), r1 = mk('L', 1102, seq.slice().reverse(), [[640, 640], [644, 644.5], [648.5, 649], [653, 653]], false);
  const o2 = line(1103, 660), r2 = mk('L', 1104, seq.slice().reverse(), [[680, 680], [684, 684.5], [688.5, 689], [693, 693]], false);
  const o3 = line(1105, 700), set = { label: '通勤車09編成', trips: [o1, r1, o2, r2, o3] }; [o1, r1, o2, r2, o3].forEach(t => { t.set = set; });
  const big2 = { name: '人身事故', a: 'S', b: 'U', t0: 642, t1: 682, dur: 40, tr: r1, i: 1, f: 0.5 };
  const Rc = C.disrupt([o1, r1, o2, r2, o3], [], Object.assign({}, env5, { big: big2 }));
  assert.ok(Rc.cancelled.has(o2) && Rc.cancelled.has(r2) && Rc.A.get(o2).cancel, '1往復を運休');
  assert.ok(Rc.A.get(o3).dep[0] < 700.01, '次の列車から定時');
  assert.ok(Rc.decisions.some(c => c.k === 'cancel' && c.dec.includes('2本')), '始発駅を出る前の1往復を運休');
  assert.strictEqual(C.policyStats([o1, r1, o2, r2, o3], Rc).cancel, 2);
  assert.ok(C.actual(o2, Rc).cancel);
  /* 起きる日は運行日で決まる・訓練ならかならず */
  const b1 = C.bigIncident(all, { day: 9, force: true }), b2 = C.bigIncident(all, { day: 9, force: true });
  assert.ok(b1 && b1.t1 > b1.t0 && all.includes(b1.tr) && b1.tr.seq[b1.i] === b1.a && b1.a === b2.a && b1.t0 === b2.t0);
  let hit = 0; for (let d = 1; d <= 300; d++) if (C.bigIncident(all, { day: d })) hit++; assert.ok(hit > 10 && hit < 60, 'ふつうの日は約1割 ' + hit);
  console.log('ctc-core 段5 ok');
}
