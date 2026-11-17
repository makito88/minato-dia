/* 長い指令パネルの計算（DOM なし・node で読める）。docs/ctc-plan.md の段1。
   - 線路の形：キロどおりの縮尺（pxk＝1kmあたりの px）。本線は下の段に横一直線、温泉支線は川辺の東で分かれて上の段へ。
   - 列車の位置：ゲームの trips（seq・arr・dep・stop・op・down・set）と時刻 T から、キロと番線を出す。計算は変えない（読むだけ）。
   - 停車が長い理由：今のダイヤの中の「通過待ち・接続・行き違い・間かく・イベント」を、列車ごとに見分ける（index.html の makeEvents と同じ決まり）。
   - 数字・名前はすべて架空。線路の数は docs/map-tiles/haisen.json（配線図の案）にそろえる。 */
(function (root) {
  'use strict';
  const Y = { main: 300, br: 118, lane: 9, side: 27, brLoop: 10, kenou: 372, freight: 410 };
  const MAIN = ['C', 'S', 'U', 'M', 'K', 'N', 'P'], BR = ['K', 'F', 'T', 'O'];
  /* 川辺の分かれ道（川辺から支線の道のり km）：駅の東で本線から分かれ、少し上がって平らな所で上下がまとまり、上の段へのぼる
     下り：下りの本線から JUNC0 で分かれる／上り：上りの本線から UP0 で、下りの本線を平面交差して UP1 で合流 */
  const JUNC0 = 0.4, LV0 = 0.5, LV1 = 0.9, JUNC1 = 1.3, UP0 = 0.5, UP1 = 0.75, LVY = -50;
  const OS = 0.22;
  const LANES = { C: [-Y.side, -Y.lane, Y.lane, Y.side, Y.side + 18], P: [-Y.side, -Y.lane, Y.lane, Y.side] };
  const SIGBOX = 2.0;   /* 森下〜峠の交換信号所（森下から km・計画） */   /* 温泉の手前で2線に分かれる長さ */
  const STA = 0.35;                  /* 駅のポイントの範囲（駅の中心から km） */
  const ML = 2.8;                    /* 中央より西に取る幅（km）：中央車庫と県央本線 */
  const TYPE_COL = { L: '#e8792b', R: '#2f7fc0', E: '#c23a4c', X: '#3f8a63' };
  const TYPE_BODY = { L: '#f3f1ea', R: '#efe5c8', E: '#8e1f2e', X: '#2f5a48' };
  const REASON = {
    taihi: { name: '通過待ち', col: '#f0b44c' },
    conn: { name: '接続', col: '#5fc6e8' },
    kokan: { name: '行き違い待ち', col: '#c59cf0' },
    follow: { name: '前の列車との間かく', col: '#9fb3c4' },
    route: { name: '進路の待ち（運転停車）', col: '#9fb3c4' },
    incident: { name: 'できごと', col: '#ff6b6b' },
    crowd: { name: '混雑（乗り降り）', col: '#ff9b5c' },
    late: { name: '遅れ（前の列車・単線・接続）', col: '#e8c95c' },
    connCut: { name: '接続の打ち切り', col: '#7fb0ff' },
    swap: { name: '順番の入れかえ', col: '#7fe0b0' },
    recover: { name: '回復運転', col: '#8fd18f' },
  };

  function layout(ST, pxk) {
    pxk = pxk || 200;
    const xm = km => (ML + km) * pxk;
    const xK = xm(ST.K.km);
    const xb = bkm => xK + bkm * pxk;
    const W = Math.ceil(Math.max(xm(ST.P.km + 1.4), xb(ST.O.bkm + 1.2)));
    return { pxk, xm, xb, xK, W, H: 495, Y, ML, JUNC0, LV0, LV1, JUNC1, UP0, UP1, LVY, OS, STA };
  }
  const smooth = u => { u = Math.max(0, Math.min(1, u)); return u * u * (3 - 2 * u); };

  /* 駅 i で、その列車が使う番線のずれ（y）。本線は Y.main から、支線は Y.br から */
  function laneOff(tr, i, env) {
    const fx = env.laneFix && env.laneFix.get(tr);
    if (fx && fx.i === i) return fx.o;   /* 頭端の駅で、ほかの列車と同じ番線にならないように画面で決めた番線 */
    const s = tr.seq[i], p = tr.set ? tr.set.plat : 0, toBr = tr.seq.includes('O');
    if (s === 'C') return LANES.C[p % 5];   /* 中央5線・港4線（docs/track-dia-study.md のユーザーの決め） */
    if (s === 'P') return LANES.P[p % 4];
    if (s === 'O') return [-Y.lane, Y.lane][tr.num % 2];
    if (s === 'F' || s === 'T') return tr.down ? -Y.brLoop : Y.brLoop;
    if (s === 'K' && toBr) return tr.down ? -Y.side : Y.lane;   /* 川辺：温泉へは1番線、温泉からは3番線（指令盤の試作と同じ） */
    const base = tr.down ? -Y.lane : Y.lane;
    return (env.ST[s].taihi && env.onSiding(tr, i)) ? base * 3 : base;
  }
  /* 駅 i の番線の番号（1から）。発車標に出す */
  function trackNo(tr, i, env) {
    const s = tr.seq[i], o = laneOff(tr, i, env);
    if (s === 'C' || s === 'P') return LANES[s].indexOf(o) + 1;
    if (s === 'O') return o < 0 ? 1 : 2;
    if (s === 'F' || s === 'T') return o < 0 ? 1 : 2;
    if (env.ST[s].taihi) return o === -Y.side ? 1 : o === -Y.lane ? 2 : o === Y.lane ? 3 : 4;
    return tr.down ? 1 : 2;
  }
  const onBranch = s => s === 'F' || s === 'T' || s === 'O';
  function kmOf(s, env, br) { return br ? (s === 'K' ? 0 : env.ST[s].bkm) : env.ST[s].km; }

  /* 列車の位置 {x,y,dir,moving,i,dwell} */
  function trainPos(tr, T, L, env) {
    const n = tr.seq.length;
    let i = 0; while (i < n - 1 && tr.arr[i + 1] <= T) i++;
    const st = k => tr.seq[k];
    const atSt = k => {
      const s = st(k), o = laneOff(tr, k, env);
      if (onBranch(s)) return { x: L.xb(env.ST[s].bkm), y: Y.br + o };
      return { x: L.xm(env.ST[s].km), y: Y.main + o };
    };
    if (T < tr.dep[i] || i === n - 1) { const p = atSt(i); return { x: p.x, y: p.y, dir: tr.down ? 1 : -1, moving: false, i }; }
    const a = st(i), b = st(i + 1), br = onBranch(a) || onBranch(b);
    const raw = Math.max(0, Math.min(1, (T - tr.dep[i]) / (tr.arr[i + 1] - tr.dep[i])));
    const f = raw * 0.35 + 0.65 * smooth(raw);
    const ka = kmOf(a, env, br), kb = kmOf(b, env, br), km = ka + (kb - ka) * f;
    const oa = laneOff(tr, i, env), ob = laneOff(tr, i + 1, env);
    if (!br) {
      const run = tr.down ? -Y.lane : Y.lane;
      const da = Math.abs(km - ka), db = Math.abs(km - kb);
      let o = run;
      if (da < STA) o = oa + (run - oa) * smooth((da - 0.08) / (STA - 0.08));
      else if (db < STA) o = ob + (run - ob) * smooth((db - 0.08) / (STA - 0.08));
      return { x: L.xm(km), y: Y.main + o, dir: tr.down ? 1 : -1, moving: true, i, f: raw };
    }
    /* 支線：川辺から JUNC0〜JUNC1 で上の段へ上がる */
    const bkm = km;
    let y;
    if (bkm < JUNC1) {
      const oK = a === 'K' ? oa : ob, M = Y.main, run = tr.down ? -Y.lane : Y.lane;
      const P = tr.down ? [[0, M + oK], [STA, M + run], [JUNC0, M + run], [LV0, M + LVY], [LV1, M + LVY], [JUNC1, Y.br]]
        : [[0, M + oK], [STA, M + run], [UP0, M + run], [UP1, M + LVY], [LV1, M + LVY], [JUNC1, Y.br]];
      let k = 0; while (k < P.length - 2 && bkm > P[k + 1][0]) k++;
      const u = smooth((bkm - P[k][0]) / (P[k + 1][0] - P[k][0]));
      y = P[k][1] + (P[k + 1][1] - P[k][1]) * u;
    } else {
      const sF = [['F', 'T'].find(s => Math.abs(bkm - env.ST[s].bkm) < STA)];
      y = Y.br;
      if (sF[0]) {
        const s = sF[0], d = Math.abs(bkm - env.ST[s].bkm), o = s === a ? oa : s === b ? ob : 0;
        y = Y.br + o * (1 - smooth((d - 0.08) / (STA - 0.08)));
      }
      if ((a === 'O' || b === 'O') && Math.abs(bkm - env.ST.O.bkm) < OS) { const d = Math.abs(bkm - env.ST.O.bkm); y = Y.br + (b === 'O' ? ob : oa) * (1 - smooth((d - 0.06) / (OS - 0.06))); }
    }
    return { x: L.xb(bkm), y, dir: tr.down ? 1 : -1, moving: true, i, f: raw };
  }

  /* 停車が長い理由（いくつでも）。[{code, min, txt, by}] */
  function reasons(tr, i, env) {
    const out = [], s = tr.seq[i], n = tr.seq.length;
    const name = t => env.TYPES[t.type].name + ' ' + t.num;
    const stName = env.ST[s].name;
    if (i === n - 1) return out;
    const ev = tr.stop[i] ? env.evDwell(s, tr.arr[i]) : 0;
    if (ev > 0.05) {
      const nm = env.evName ? env.evName(s, tr.arr[i]) : '';
      out.push({ code: 'incident', min: ev, txt: `${stName}で${nm || 'できごと'}のため停車を長く（+${fmtMin(ev)}）` });
    }
    const nom = env.nomDwell(tr, i);
    let extra = (i === 0 ? (tr.want != null ? tr.dep[0] - tr.want : 0) : tr.dep[i] - tr.arr[i] - nom);
    if (extra < 0.3) return out;
    if (i === 0) { out.push({ code: 'follow', min: extra, txt: `${stName}で、前の列車との間かくをあけるため発車を遅らせる（+${fmtMin(extra)}）` }); return out; }
    if (env.onSiding(tr, i)) {
      for (const o of env.trips) {
        if (o === tr || o.down !== tr.down || env.TYPES[o.type].prio <= env.TYPES[tr.type].prio) continue;
        const j = o.seq.indexOf(s); if (j < 0) continue;
        if (o.arr[j] >= tr.arr[i] - 0.1 && o.arr[j] <= tr.dep[i] + 0.1) {
          if (o.stop[j] && o.dep[j] > o.arr[j]) out.push({ code: 'conn', min: extra, by: o, txt: `${stName}で${name(o)}と接続（乗りかえ）を待つ（+${fmtMin(extra)}）` });
          else out.push({ code: 'taihi', min: extra, by: o, txt: `${stName}で${name(o)}の通過待ち（+${fmtMin(extra)}）` });
        }
      }
      if (out.some(r => r.code === 'conn' || r.code === 'taihi')) return out;
    }
    if (s === 'F' || s === 'T') {
      for (const o of env.trips) {
        if (o === tr || o.down === tr.down) continue;
        const j = o.seq.indexOf(s); if (j < 0) continue;
        if (o.arr[j] >= tr.arr[i] - 0.2 && o.arr[j] <= tr.dep[i] + 0.2) { out.push({ code: 'kokan', min: extra, by: o, txt: `${stName}で${name(o)}との行き違い待ち（+${fmtMin(extra)}）` }); return out; }
      }
    }
    if (tr.op && tr.op[i]) out.push({ code: 'route', min: extra, txt: `${stName}で、前の列車が先の区間を出るまで運転停車（+${fmtMin(extra)}）` });
    else out.push({ code: 'follow', min: extra, txt: `${stName}で、前の列車との間かくをあけるため待つ（+${fmtMin(extra)}）` });
    return out;
  }
  function fmtMin(m) { return m >= 1 ? Math.round(m) + '分' : Math.round(m * 60) + '秒'; }

  /* 見どころ（待避・接続・行き違い・出入庫）を、列車への参照つきで。index.html の makeEvents と同じ決まり */
  function highlights(trips, sets, env) {
    const ev = [], name = t => env.TYPES[t.type].name + ' ' + t.num;
    for (const tr of trips) tr.seq.forEach((s, i) => {
      if (!env.onSiding(tr, i)) return;
      for (const o of trips) {
        if (o === tr || o.down !== tr.down || env.TYPES[o.type].prio <= env.TYPES[tr.type].prio) continue;
        const j = o.seq.indexOf(s); if (j < 0) continue;
        if (o.arr[j] >= tr.arr[i] - 0.1 && o.arr[j] <= tr.dep[i] + 0.1) {
          const conn = o.stop[j] && o.dep[j] > o.arr[j];
          ev.push({ t: o.arr[j], k: conn ? 'conn' : 'taihi', st: s, a: tr, b: o,
            txt: conn ? `${env.ST[s].name}で ${name(tr)} と ${name(o)} が接続` : `${env.ST[s].name}で ${name(o)} が ${name(tr)} を追いこす`,
            radio: conn ? `指令から${tr.num}列車、${env.ST[s].name}で${o.num}列車の到着を待って、乗りかえを受けてください。`
              : `指令から${tr.num}列車、${env.ST[s].name}で待避。${o.num}列車を先に通します。` });
        }
      }
    });
    const brT = trips.filter(t => t.seq.includes('O'));
    for (const X of ['F', 'T']) for (let a = 0; a < brT.length; a++) for (let b = a + 1; b < brT.length; b++) {
      const A = brT[a], B = brT[b]; if (A.down === B.down) continue;
      const i = A.seq.indexOf(X), j = B.seq.indexOf(X);
      const s0 = Math.max(A.arr[i], B.arr[j]), s1 = Math.min(A.dep[i], B.dep[j]);
      if (s1 > s0 - 0.2) ev.push({ t: s0, k: 'kokan', st: X, a: A, b: B, txt: `${env.ST[X].name}で ${name(A)} と ${name(B)} が行き違い`,
        radio: `指令から${A.num}列車・${B.num}列車、${env.ST[X].name}で行き違い。単線区間の進路を順に開きます。` });
    }
    for (const s of sets) {
      ev.push({ t: s.first - 8, k: 'depot', st: s.home, set: s, txt: `${env.DEPOTNAME[s.home]}から ${s.label}（${s.cars}両）が出庫`, radio: `${env.DEPOTNAME[s.home]}、${s.label}の出庫を許可します。` });
      ev.push({ t: s.last + 3, k: 'depot', st: s.home, set: s, txt: `${s.label} が${env.DEPOTNAME[s.home]}に入庫`, radio: `${s.label}、本日の仕業おわり。${env.DEPOTNAME[s.home]}へ入庫してください。` });
    }
    ev.sort((a, b) => a.t - b.t);
    return ev;
  }


  /* ===== 段2：きょうの乱れ（見せ方の層。ゲームの乗客・運賃の計算には返さない） =====
     予定（ゲームのダイヤ）に、混雑とできごとの小さな遅れを足し、プロの手順（前の列車との間かく・単線の順番・
     接続は上限まで待つ・待避の順番の入れかえ・回復運転）で、実際の発着を出す。数字はすべて仮。 */
  const RULE = { hw: 2.0, hws: 0.5, connMax: 5, swapMin: 2, recover: 0.03, turn: 4, iter: 10 };
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const SMALL = [['ドアに荷物がはさまり、開け直し', 0.5, 1.5], ['駆けこみ乗車', 0.3, 1.0], ['ホームの安全確認', 1.0, 2.0]];
  const MEDIUM = [['急病の人の手当て', 4, 8, 'stop'], ['線路に動物', 3, 6, 'run'], ['信号の確認', 2, 4, 'run']];
  function disturb(trips, env) {
    const R = rng((env.day || 1) * 7919 + trips.length * 13), dist = new Map();
    const put = (tr, i, o) => { let m = dist.get(tr); if (!m) dist.set(tr, m = {}); const c = m[i] || (m[i] = { dwell: 0, run: 0, txt: [] }); c.dwell += o.dwell || 0; c.run += o.run || 0; if (o.txt) c.txt.push(o); };
    for (const tr of trips) for (let i = 1; i < tr.seq.length - 1; i++) {
      if (!tr.stop[i] || !tr.cap) continue;
      const r = (tr.loadAfter && tr.loadAfter[i] || 0) / tr.cap, b = tr.bAt ? tr.bAt[i] || 0 : 0;
      const x = Math.min(1.5, Math.max(0, (r - 1.1) * 1.5) + Math.max(0, (b - 150) / 500));
      if (x >= 0.1) put(tr, i, { dwell: x, code: 'crowd', txt: `${env.ST[tr.seq[i]].name}で乗り降りに時間がかかった（${r >= 1.1 ? '車内' + Math.round(r * 100) + '%の混雑' : Math.round(b) + '人が乗った'}）` });
    }
    const rush = trips.filter(t => (t.dep[0] > 400 && t.dep[0] < 560) || (t.dep[0] > 1000 && t.dep[0] < 1140));
    const pickStop = tr => { const k = []; tr.seq.forEach((s, i) => { if (i > 0 && i < tr.seq.length - 1 && tr.stop[i]) k.push(i); }); return k.length ? k[Math.floor(R() * k.length)] : -1; };
    const ik = env.incidentK == null ? 1 : env.incidentK, nS = Math.round((3 + Math.floor(R() * 4)) * ik);   /* ik：保守の予算（経営のタブ） */
    for (let n = 0; n < nS && rush.length; n++) {
      const tr = rush[Math.floor(R() * rush.length)], i = pickStop(tr); if (i < 0) continue;
      const k = SMALL[Math.floor(R() * SMALL.length)], m = k[1] + R() * (k[2] - k[1]);
      put(tr, i, { dwell: m, code: 'incident', txt: `${env.ST[tr.seq[i]].name}で${k[0]}` });
    }
    if (R() < Math.min(0.95, 0.6 * ik)) {
      const k = MEDIUM[Math.floor(R() * MEDIUM.length)], pool = k[0] === '線路に動物' ? trips.filter(t => t.seq.includes('O')) : trips.filter(t => t.dep[0] > 330 && t.dep[0] < 1380);
      if (pool.length) {
        const tr = pool[Math.floor(R() * pool.length)], m = k[1] + R() * (k[2] - k[1]);
        if (k[3] === 'stop') { const i = pickStop(tr); if (i > 0) put(tr, i, { dwell: m, code: 'incident', big: true, txt: `${env.ST[tr.seq[i]].name}で${k[0]}` }); }
        else {
          const segs = []; for (let i = 0; i < tr.seq.length - 1; i++) { const br = onBranch(tr.seq[i]) || onBranch(tr.seq[i + 1]); if (k[0] !== '線路に動物' || br) segs.push(i); }
          const i = segs[Math.floor(R() * segs.length)];
          if (i != null) put(tr, i + 1, { run: m, code: 'incident', big: true, txt: `${env.ST[tr.seq[i]].name}〜${env.ST[tr.seq[i + 1]].name}で${k[0]}` });
        }
      }
    }
    return dist;
  }

  function disrupt(trips, hl, env) {
    const dist = disturb(trips, env), name = t => env.TYPES[t.type].name + ' ' + t.num;
    const A = new Map();
    trips.forEach(tr => A.set(tr, { arr: tr.arr.slice(), dep: tr.dep.slice(), why: tr.seq.map(() => []) }));
    /* 同じ駅から同じ向きに出る列車の順番（予定） */
    const order = {};
    trips.forEach(tr => tr.seq.forEach((s, i) => { if (i === tr.seq.length - 1) return; const k = s + (tr.down ? 'd' : 'u') + (onBranch(tr.seq[i + 1]) || onBranch(s) && tr.seq[i + 1] !== 'K' ? 'b' : 'm'); (order[k] || (order[k] = [])).push({ tr, i }); }));
    Object.values(order).forEach(L => L.sort((a, b) => a.tr.dep[a.i] - b.tr.dep[b.i]));
    const conns = hl.filter(h => h.k === 'conn'), passes = hl.filter(h => h.k === 'taihi' || h.k === 'conn');
    const brSec = {};
    trips.filter(t => t.seq.includes('O')).forEach(tr => tr.seq.forEach((s, i) => { if (i === tr.seq.length - 1) return; const b = tr.seq[i + 1]; if (!(onBranch(s) || onBranch(b))) return; const key = [s, b].sort().join(''); (brSec[key] || (brSec[key] = [])).push({ tr, i }); }));
    let swaps = new Set(), decisions = [];
    for (let it = 0; it < RULE.iter; it++) {
      const nextSwaps = new Set();
      /* 待避の順番の入れかえ：追いこす予定の列車が大きく遅れていたら、待っている列車を先に出す */
      for (const h of passes) {
        const L = h.a, X = h.b, i = L.seq.indexOf(h.st), j = X.seq.indexOf(h.st);
        const xa = A.get(X).arr[j], lReady = A.get(L).arr[i] + env.nomDwell(L, i);
        if (h.k === 'taihi' && xa - Math.max(lReady, L.dep[i]) > RULE.swapMin) nextSwaps.add(h);
      }
      swaps = nextSwaps;
      const swapEarly = new Set([...swaps].map(h => h.a.num + '@' + h.a.seq.indexOf(h.st)));
      const ord = {};
      for (const k in order) {
        const L = order[k].slice();
        for (const h of swaps) { const a = L.findIndex(o => o.tr === h.b && o.tr.seq[o.i] === h.st), b = L.findIndex(o => o.tr === h.a && o.tr.seq[o.i] === h.st); if (a >= 0 && b >= 0 && a < b) { const [x] = L.splice(b, 1); L.splice(a, 0, x); } }
        L.forEach((o, n) => { ord[o.tr.num + '@' + o.i] = n ? L[n - 1] : null; });
      }
      decisions = [];
      for (const tr of trips) {
        const a = A.get(tr), d = dist.get(tr) || {}, n = tr.seq.length;
        a.why = tr.seq.map(() => []);
        for (let i = 0; i < n; i++) {
          const s = tr.seq[i];
          if (i > 0) {
            const plannedRun = tr.arr[i] - tr.dep[i - 1], late = a.dep[i - 1] - tr.dep[i - 1];
            let run = plannedRun + ((d[i] && d[i].run) || 0);
            const rec = late > 0.3 ? Math.min(late, plannedRun * RULE.recover) : 0;
            run -= rec;
            let arr = Math.max(tr.arr[i], a.dep[i - 1] + run);
            if (d[i] && d[i].run) a.why[i].push(...d[i].txt.map(o => ({ code: o.code, min: d[i].run, txt: o.txt, big: o.big })));
            if (rec > 0.05) a.why[i].push({ code: 'recover', min: -rec, txt: `${env.ST[tr.seq[i - 1]].name}〜${env.ST[s].name}で回復運転（−${fmtMin(rec)}）` });
            a.arr[i] = arr;
          }
          if (i === n - 1) { a.dep[i] = a.arr[i]; break; }
          const nom = env.nomDwell(tr, i), extra = (d[i] && d[i].dwell) || 0;
          const early = swapEarly.has(tr.num + '@' + i);   /* 入れかえで先に出る列車は、予定より早く出てよい */
          const minDep = early ? tr.arr[i] + nom : tr.dep[i];
          let dep = Math.max(minDep, (i === 0 ? tr.dep[0] : a.arr[i] + nom) + extra), cause = null;
          /* 折り返し：同じ編成の前の列車が遅れて着いたら */
          if (i === 0 && tr.set) {
            const k = tr.set.trips.indexOf(tr), pv = k > 0 ? tr.set.trips[k - 1] : null;
            if (pv) { const pa = A.get(pv), ready = pa.arr[pa.arr.length - 1] + RULE.turn; if (ready > dep + 0.01) { dep = ready; cause = { code: 'late', by: pv, txt: `${env.ST[s].name}で、折り返す前の${name(pv)}が遅れて着いたため` }; } }
          }
          if (d[i] && d[i].dwell) a.why[i].push(...d[i].txt.map(o => ({ code: o.code, min: o.dwell != null ? o.dwell : extra, txt: o.txt, big: o.big })));
          /* 前の列車との間かく（同じ向き・同じ駅から） */
          const pred = ord[tr.num + '@' + i];
          if (pred) { const pd = A.get(pred.tr).dep[pred.i] + (onBranch(s) ? RULE.hws : RULE.hw); if (pd > dep + 0.01) { dep = pd; cause = { code: 'late', by: pred.tr, txt: `${env.ST[s].name}で、前を走る${name(pred.tr)}が遅れているため発車を待つ` }; } }
          /* 単線：反対から来る列車が先に区間を出るまで */
          const b = tr.seq[i + 1];
          if (onBranch(s) || onBranch(b)) {
            const key = [s, b].sort().join(''), list = brSec[key] || [];
            for (const o of list) {
              if (o.tr.down === tr.down) continue;
              const oa = A.get(o.tr), oEnter = o.tr.dep[o.i], tEnter = tr.dep[i];
              if (oEnter < tEnter - 0.01) { const free = oa.arr[o.i + 1] + RULE.hws; if (free > dep + 0.01) { dep = free; cause = { code: 'late', by: o.tr, txt: `${env.ST[s].name}で、単線の反対から来る${name(o.tr)}の遅れを待つ（行き違いの順番はそのまま）` }; } }
            }
          }
          /* 接続：相手が遅れても上限まで待つ */
          for (const h of conns) {
            if (h.a !== tr || h.st !== s) continue;
            const o = h.b, j = o.seq.indexOf(s), oa = A.get(o).arr[j], need = oa + 0.5;
            if (need <= dep + 0.01) continue;
            if (need - tr.dep[i] <= RULE.connMax) { dep = need; cause = { code: 'conn', by: o, txt: `${env.ST[s].name}で、遅れている${name(o)}からの乗りかえを待つ（上限${RULE.connMax}分以内）` }; decisions.push({ t: tr.dep[i], k: 'conn', st: s, a: tr, b: o, hold: need - tr.dep[i] }); }
            else { decisions.push({ t: tr.dep[i], k: 'connCut', st: s, a: tr, b: o, late: oa - o.arr[j] }); a.why[i].push({ code: 'connCut', min: 0, by: o, txt: `${env.ST[s].name}：${name(o)}の遅れが上限${RULE.connMax}分をこえたので、接続を打ち切って発車` }); }
          }
          if (cause) { cause.min = dep - Math.max(minDep, (i === 0 ? tr.dep[0] : a.arr[i] + nom) + extra); if (cause.min > 0.05) a.why[i].push(cause); }
          a.dep[i] = dep;
        }
      }
    }
    for (const h of swaps) decisions.push({ t: h.a.dep[h.a.seq.indexOf(h.st)], k: 'swap', st: h.st, a: h.a, b: h.b });
    dist.forEach((m, tr) => { for (const i in m) for (const o of m[i].txt) if (o.big || o.code === 'incident') decisions.push({ t: tr.arr[+i] || tr.dep[0], k: 'incident', st: tr.seq[+i], a: tr, txt: o.txt, min: (m[i].dwell || m[i].run) }); });
    decisions.sort((x, y) => x.t - y.t);
    decisions.forEach(c => card(c, A, trips, env));
    return { A, decisions, swaps, rule: RULE };
  }
  /* 判断のカード：起きたこと → 判断 → 理由 → 結果（もしも） */
  function card(c, A, trips, env) {
    const name = t => env.TYPES[t.type].name + ' ' + t.num, sn = env.ST[c.st].name, ml = (t, i) => A.get(t).dep[i] - t.dep[i];
    const nextSame = (tr, i) => { let best = null; for (const o of trips) { if (o === tr || o.down !== tr.down) continue; const j = o.seq.indexOf(tr.seq[i]); if (j < 0 || j === o.seq.length - 1 || !o.stop[j]) continue; if (o.seq[o.seq.length - 1] !== tr.seq[tr.seq.length - 1]) continue; if (o.dep[j] > tr.dep[i] && (!best || o.dep[j] < best.t)) best = { o, t: o.dep[j] }; } return best; };
    if (c.k === 'incident') { c.what = c.txt; c.dec = '安全を確かめてから運転を続ける'; c.why = '安全が先'; c.res = `${name(c.a)}が約${fmtMin(c.min)}遅れ、後ろの列車にもうつる`; c.radio = `${c.a.num}列車から指令、${c.txt}。確認して報告します。`; }
    if (c.k === 'conn') { const i = c.a.seq.indexOf(c.st), nx = nextSame(c.a, i);
      c.what = `${name(c.b)}が遅れて${sn}に着く`; c.dec = `${name(c.a)}は接続を待つ（+${fmtMin(c.hold)}）`; c.why = `遅れが上限${RULE.connMax}分以内`;
      c.res = `${name(c.a)}が${fmtMin(c.hold)}遅れて発車。待たなかったら、乗りかえの人は次の列車まで${nx ? Math.round(nx.t - c.a.dep[i]) + '分' : '長く'}待つ`; c.radio = `指令から${c.a.num}列車、${sn}で${c.b.num}列車の到着を待って発車してください。`; }
    if (c.k === 'connCut') { const i = c.a.seq.indexOf(c.st), nx = nextSame(c.a, i);
      c.what = `${name(c.b)}が${fmtMin(c.late)}遅れ`; c.dec = `${name(c.a)}は接続を打ち切って定時に発車`; c.why = `待つ上限${RULE.connMax}分をこえる（待つと後ろのダイヤ全体が遅れる）`;
      c.res = `乗りかえの人は次の${nx ? name(nx.o) + '（' + Math.round(nx.t - c.a.dep[i]) + '分後）' : '列車'}へ案内`; c.radio = `指令から${sn}駅、${c.b.num}列車からの乗りかえのお客さまを、次の列車へご案内ください。`; }
    if (c.k === 'swap') { const i = c.a.seq.indexOf(c.st), j = c.b.seq.indexOf(c.st), xl = A.get(c.b).arr[j] - c.b.arr[j];
      c.what = `${sn}で通過待ちの予定の${name(c.b)}が${fmtMin(xl)}遅れ`; c.dec = `${name(c.a)}を先に出す（順番の入れかえ）`; c.why = `待つと${name(c.a)}まで${fmtMin(xl)}近く遅れる`;
      const la = Math.max(0, ml(c.a, i)); c.res = `${name(c.a)}の遅れ ${la < 0.1 ? 'なし' : fmtMin(la)}。入れかえなければ約${fmtMin(xl)}`; c.radio = `指令から${c.a.num}列車、${sn}は待避取りやめ。先に発車してください。${c.b.num}列車はあとに続けます。`; }
    return c;
  }
  /* 実際の発着をもった列車（元の列車をうけつぐ。パネルの位置・札に使う） */
  function actual(tr, D2) { const a = D2.A.get(tr); if (!a) return tr; const p = Object.create(tr); p.arr = a.arr; p.dep = a.dep; p.base = tr; p.why = a.why; return p; }

  /* 編成がいま車庫にいるか */
  const inDepot = (s, T) => T < s.first - 8 || T > s.last + 9;

  const SHORT = { crowd: '混雑', late: '前の遅れ', connCut: '接続打切', swap: '入れかえ', recover: '回復', incident: 'できごと', taihi: '通過待ち', conn: '接続', kokan: '行き違い', follow: '間かく', route: '運転停車' };
  const api = { LANES, SIGBOX, SHORT, Y, MAIN, BR, TYPE_COL, TYPE_BODY, REASON, RULE, disrupt, actual, layout, laneOff, trackNo, trainPos, reasons, highlights, inDepot, fmtMin, smooth };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CtcCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
