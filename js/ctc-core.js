/* 長い指令パネルの計算（DOM なし・node で読める）。docs/ctc-plan.md の段1。
   - 線路の形：キロどおりの縮尺（pxk＝1kmあたりの px）。本線は下の段に横一直線、温泉支線は川辺の東で分かれて上の段へ。
   - 列車の位置：ゲームの trips（seq・arr・dep・stop・op・down・set）と時刻 T から、キロと番線を出す。計算は変えない（読むだけ）。
   - 停車が長い理由：今のダイヤの中の「通過待ち・接続・行き違い・間かく・イベント」を、列車ごとに見分ける（index.html の makeEvents と同じ決まり）。
   - 数字・名前はすべて架空。線路の数は docs/map-tiles/haisen.json（配線図の案）にそろえる。 */
(function (root) {
  'use strict';
  const Y = { main: 300, br: 118, lane: 9, side: 27, brLoop: 10, kenou: 372, freight: 410 };
  const MAIN = ['C', 'S', 'U', 'M', 'K', 'N', 'P'], BR = ['K', 'F', 'T', 'O'];
  const JUNC0 = 0.3, JUNC1 = 1.0;   /* 支線が本線から離れはじめる所・上の段に着く所（川辺から支線の道のり km） */
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
  };

  function layout(ST, pxk) {
    pxk = pxk || 200;
    const xm = km => (ML + km) * pxk;
    const xK = xm(ST.K.km);
    const xb = bkm => xK + bkm * pxk;
    const W = Math.ceil(Math.max(xm(ST.P.km + 1.4), xb(ST.O.bkm + 1.2)));
    return { pxk, xm, xb, xK, W, H: 450, Y, ML, JUNC0, JUNC1, STA };
  }
  const smooth = u => { u = Math.max(0, Math.min(1, u)); return u * u * (3 - 2 * u); };

  /* 駅 i で、その列車が使う番線のずれ（y）。本線は Y.main から、支線は Y.br から */
  function laneOff(tr, i, env) {
    const fx = env.laneFix && env.laneFix.get(tr);
    if (fx && fx.i === i) return fx.o;   /* 頭端の駅で、ほかの列車と同じ番線にならないように画面で決めた番線 */
    const s = tr.seq[i], p = tr.set ? tr.set.plat : 0, toBr = tr.seq.includes('O');
    if (s === 'C') return [-Y.side, -Y.lane, Y.lane, Y.side][p % 4];
    if (s === 'P') return [-Y.lane, Y.lane][p % 2];
    if (s === 'O') return [-Y.lane, Y.lane][tr.num % 2];
    if (s === 'F' || s === 'T') return tr.down ? -Y.brLoop : Y.brLoop;
    if (s === 'K' && toBr) return tr.down ? -Y.side : Y.lane;   /* 川辺：温泉へは1番線、温泉からは3番線（指令盤の試作と同じ） */
    const base = tr.down ? -Y.lane : Y.lane;
    return (env.ST[s].taihi && env.onSiding(tr, i)) ? base * 3 : base;
  }
  /* 駅 i の番線の番号（1から）。発車標に出す */
  function trackNo(tr, i, env) {
    const s = tr.seq[i], o = laneOff(tr, i, env);
    if (s === 'C') return [-Y.side, -Y.lane, Y.lane, Y.side].indexOf(o) + 1;
    if (s === 'P' || s === 'O') return o < 0 ? 1 : 2;
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
      const yK = Y.main + (a === 'K' ? oa : ob);
      const u = smooth((bkm - JUNC0) / (JUNC1 - JUNC0));
      y = yK + (Y.br - yK) * u;
    } else {
      const sF = [['F', 'T'].find(s => Math.abs(bkm - env.ST[s].bkm) < STA)];
      y = Y.br;
      if (sF[0]) {
        const s = sF[0], d = Math.abs(bkm - env.ST[s].bkm), o = s === a ? oa : s === b ? ob : 0;
        y = Y.br + o * (1 - smooth((d - 0.08) / (STA - 0.08)));
      }
      if (b === 'O' && Math.abs(bkm - env.ST.O.bkm) < STA) { const d = Math.abs(bkm - env.ST.O.bkm); y = Y.br + ob * (1 - smooth((d - 0.08) / (STA - 0.08))); }
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

  /* 編成がいま車庫にいるか */
  const inDepot = (s, T) => T < s.first - 8 || T > s.last + 9;

  const api = { Y, MAIN, BR, TYPE_COL, TYPE_BODY, REASON, layout, laneOff, trackNo, trainPos, reasons, highlights, inDepot, fmtMin, smooth };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CtcCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
