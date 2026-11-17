/* 指令パネルの配線の層（CtcCore.yard）と信号（js/ctc-signal.js）の小さな確かめ：node tests/ctc-signal.test.cjs */
const assert = require('node:assert');
const fs = require('node:fs'), path = require('node:path');
const C = require('../js/ctc-core.js'), S = require('../js/ctc-signal.js');
const HS = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'ctc-haisen.json'), 'utf8'));
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const ST = {};
for (const m of html.matchAll(/^\s+([CSUMKNPFTO]):\{name:'([^']+)',(?:km:([\d.]+),)?(?:bkm:([\d.]+),)?/gm)) ST[m[1]] = { name: m[2], km: m[3] != null ? +m[3] : undefined, bkm: m[4] != null ? +m[4] : undefined };
['U', 'M', 'K'].forEach(s => { ST[s].taihi = true; }); ST.K.bkm = 0;
const SX = C.extST(ST);
const mk = (type, num, seq, times, down, stop) => ({ type, num, seq, cars: 6, down, arr: times.map(t => t[0]), dep: times.map(t => t[1]), stop: stop || seq.map(() => true), op: seq.map(() => false) });
const env = { ST: SX, hs: HS, onSiding: () => false };

/* 1) 駅の形：どの駅にもホームと番線がある */
for (const s of ['C', 'S', 'U', 'M', 'K', 'N', 'P', 'F', 'T', 'O']) { const st = HS.stations[s]; assert.ok(st && st.plats.length && st.lanes.length === st.num.length, s + ' のホームと番線'); }
const kinds = Object.values(HS.stations).map(s => s.kind).join(' ');
for (const k of ['単式', '島式', '相対式', '2面3線', '2面4線', '千鳥']) assert.ok(kinds.includes(k), 'ホームの形 ' + k);

/* 2) 同じ駅・同じ向きに2本が続けて来ても、同じ番線に重ならない（あとの列車は手前の駅で待つか、となりの番線へ） */
{
  const a = mk('L', 1, ['C', 'S', 'U'], [[0, 0], [5, 9], [14, 14]], true);   /* 桜町で長く止まる */
  const b = mk('L', 3, ['C', 'S', 'U'], [[3, 3], [7, 7.5], [12, 12]], true);  /* 予定では a が止まっているうちに桜町へ着く */
  const Y = C.yard([{ trips: [a] }, { trips: [b] }], env), A = Y.map.get(a), B = Y.map.get(b);
  const ia = A.seq.indexOf('S'), ib = B.seq.indexOf('S');
  assert.ok(A.lanes[ia] !== B.lanes[ib] || B.arr[ib] > A.dep[ia], '桜町：同じ番線なら、前の列車が出てから入る');
  assert.ok(B.dep[0] >= b.dep[0], '待つのは前の駅（中央）で');
}
/* 3) 緑ヶ丘：止まる列車は外側のホームの線、通過する列車はまん中の通過線 */
{
  const l = mk('L', 5, ['C', 'S', 'U', 'M', 'K'], [[0, 0], [4, 4.5], [8, 8.5], [12, 16], [21, 21]], true);
  const e = mk('E', 7, ['C', 'U', 'M', 'K'], [[9, 9], [12, 12], [14, 14], [17, 17]], true, [true, false, false, true]);
  const Y = C.yard([{ trips: [l] }, { trips: [e] }], env), L1 = Y.map.get(l), E1 = Y.map.get(e);
  assert.strictEqual(L1.lanes[3], C.LCODE['-s'], '止まる普通は1番線（外側）');
  assert.strictEqual(E1.lanes[2], C.LCODE['-l'], '通過の特急は通過線');
  assert.strictEqual(C.trackNo(L1, 3, env), 1);
}
/* 4) 頭端の駅で次の発車まで長いときは、車庫で休む */
{
  const up = mk('L', 2, ['S', 'C'], [[0, 0], [5, 5]], false), dn = mk('L', 9, ['C', 'S'], [[40, 40], [45, 45]], true);
  const set = { trips: [up, dn] }, Y = C.yard([set], env), r = Y.rests.get(set);
  assert.ok(r && r.length === 1 && r[0].at === 'C' && r[0].t1 > r[0].t0, '中央車庫で休む');
}
/* 5) 信号：列車のいる区間の閉塞信号は赤、そのひとつ手前は黄 */
{
  const L = C.layout(SX, 200), lay = S.build(HS, SX, L, C);
  assert.ok(lay.sig.some(o => o.kind === '場内') && lay.sig.some(o => o.kind === '出発') && lay.sig.filter(o => o.kind === '閉塞').length >= 20, '場内・出発・閉塞');
  const ch = lay.chain.d, j = ch.findIndex((o, k) => k > 0 && o.kind === '閉塞' && ch[k - 1].kind === '閉塞' && ch[k + 1] && ch[k + 1].kind === '閉塞');
  const s0 = ch[j - 1], s1 = ch[j], km = (s1.km + ch[j + 1].km) / 2;
  const tr = mk('L', 11, ['C', 'P'], [[0, 0], [30, 30]], true);
  const Q = [{ tr, dead: false, p: { x: L.xm(km), y: C.Y.main - C.Y.lane, dir: 1, moving: true, i: 0 } }];
  const st = S.state(lay, Q, 10, L, C, SX);
  assert.strictEqual(st.asp.get(s1), S.R, '列車のいる区間は止まれ'); assert.strictEqual(st.asp.get(s0), S.Y, '手前は注意');
  assert.ok(lay.xings.length >= 10 && lay.pts.length >= 15, '踏切とポイント');
}
console.log('ctc-signal ok');
