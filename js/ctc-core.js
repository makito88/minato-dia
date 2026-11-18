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
  const OS = 0.36;   /* 温泉：駅の手前で2線に分かれる長さ（ホーム 0.22km の外で分かれる） */
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
  const SHORT = { crowd: '混雑', late: '前の遅れ', connCut: '接続打切', swap: '入れかえ', recover: '回復', incident: 'できごと', taihi: '通過待ち', conn: '接続', kokan: '行き違い', follow: '間かく', route: '運転停車' };

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
    if (tr.lanes && tr.lanes[i] != null) return tr.lanes[i];   /* 配線の層（yard）が決めた番線 */
    const fx = env.laneFix && env.laneFix.get(tr);
    if (fx && fx.i === i) return fx.o;   /* 頭端の駅で、ほかの列車と同じ番線にならないように画面で決めた番線 */
    if (env.hs && env.hs.stations && env.hs.stations[tr.seq[i]]) return prefLanes(tr, i, env)[0];
    return laneOld(tr, i, env);
  }
  function laneOld(tr, i, env) {
    const s = tr.seq[i], p = tr.set ? tr.set.plat : 0, toBr = tr.seq.includes('O');
    if (s === 'C') return LANES.C[tr.synth ? 0 : p % 5];   /* 中央5線・港4線（docs/track-dia-study.md のユーザーの決め） */
    if (s === 'P') return LANES.P[p % 4];
    if (s === 'O') return [-Y.lane, Y.lane][tr.num % 2];
    if (s === 'F' || s === 'T') return tr.down ? -Y.brLoop : Y.brLoop;
    if (s === 'K' && toBr) return tr.down ? -Y.side : (env.onSiding && env.onSiding(tr, i) ? Y.side : Y.lane);   /* 川辺：温泉へは1番線、温泉からは3番線（通過待ちのときは4番線。指令盤の試作と同じ） */
    const base = tr.down ? -Y.lane : Y.lane;
    return (env.ST[s].taihi && env.onSiding(tr, i)) ? base * 3 : base;
  }
  /* ---- 駅の形（data/ctc-haisen.json・2026-11-17） ---- */
  const LCODE = { c: 0, '-s': -Y.side, '-l': -Y.lane, l: Y.lane, s: Y.side, s5: Y.side + 18, '-b': -Y.brLoop, b: Y.brLoop, b3: Y.brLoop * 2.6 };
  const lc = c => LCODE[c];
  /* その列車が駅 i で使える番線（はじめのものから）。今までの決め方（待避は外側など）を先に */
  function prefLanes(tr, i, env) {
    const s = tr.seq[i], st = env.hs.stations[s], old = laneOld(tr, i, env), A = st.alt || {};
    let list;
    if (A.any) list = (tr.synth && A.synOut && tr.seq[i + 1] === 'W' ? A.synOut : tr.synth && A.syn ? A.syn : A.any);   /* 中央：県央本線の西へ出る乗り入れは南側（出の線） */
    else {
      const d = tr.down ? 'down' : 'up', pass = !tr.stop[i] && i > 0 && i < tr.seq.length - 1, toBr = tr.seq.includes('O') && s === 'K';
      list = (toBr && tr.down && A.toBr) || (toBr && !tr.down && A.fromBr) || (pass && A[d + 'Pass']) || A[d] || st.lanes;
    }
    const L = list.map(lc);
    if (st.rule === 'outerStop') return L;   /* 緑ヶ丘：止まる列車はいつもホームの線（外側）、通過は まん中の通過線 */
    const k = L.indexOf(old); if (k > 0) { L.splice(k, 1); L.unshift(old); }
    return L;
  }
  /* 駅 i の番線の番号（1から）。発車標に出す */
  function trackNo(tr, i, env) {
    const s = tr.seq[i];
    if (env.hs && env.hs.stations && env.hs.stations[s]) { const st = env.hs.stations[s], k = st.lanes.map(lc).indexOf(laneOff(tr, i, env)); if (k >= 0) return st.num[k] || '通過線'; }
    if (s === 'W' || s === 'Q') return tr.down ? 1 : 2;
    const o = laneOff(tr, i, env);
    if (s === 'C' || s === 'P') return LANES[s].indexOf(o) + 1;
    if (s === 'O') return o < 0 ? 1 : 2;
    if (s === 'F' || s === 'T') return o < 0 ? 1 : 2;
    if (env.ST[s].taihi) return o === -Y.side ? 1 : o === -Y.lane ? 2 : o === Y.lane ? 3 : 4;
    return tr.down ? 1 : 2;
  }
  const onBranch = s => s === 'F' || s === 'T' || s === 'O';
  function kmOf(s, env, br) { return br ? (s === 'K' ? 0 : env.ST[s].bkm) : env.ST[s].km; }

  /* 列車の位置 {x,y,dir,moving,i,dwell} */
  const YK5 = Y.main - Y.side - 20, YK6 = YK5 - 16;   /* 県央本線の高さ：K5＝西行き（南側）、K6＝東行き（北側） */
  /* 中央の西の連絡線と港の臨港線の形（km, y）。ctc-view.js の drawTrack もこれを描く（2026-11-18・ユーザーの図）。
     入り：県央本線（東行き K6）から K5 を平面交差して1番線へ（2番線へは渡り線）。出：4・5番線から西へ出て、南西を回って K5（西行き）へ。
     臨港線：下りは下りの本線から上りの本線をまたいで南へ、上りは上りの本線へ合流。県央北：1番線の東のはしから北東の県央本線へ（乗り入れだけ） */
  const LINK = {
    inW: [[-9, YK6], [-1.05, YK6], [-0.55, Y.main - Y.side]],
    in2: [[-0.5, Y.main - Y.side], [-0.35, Y.main - Y.lane]],
    outW: [[-0.7, Y.main + Y.side + 18], [-1.0, Y.main + Y.side + 18], [-1.5, YK5], [-9, YK5]],
    out4: [[-0.45, Y.main + Y.side], [-0.6, Y.main + Y.side + 18]],
    north: [[0.34, Y.main - Y.side], [0.66, YK5 - 40 * (0.36 / 0.45)]],
    frt: [-1.5, -1.35, -1.05, -0.75, -0.6],   /* 港からの km：下りの本線をはなれる・上りの本線・南へ下りきる・ターミナルの手前・ターミナルの線 */
  };
  const poly = (P, k) => { if (k <= P[0][0]) return P[0][1]; for (let j = 1; j < P.length; j++) if (k <= P[j][0]) { const a = P[j - 1], b = P[j]; return a[1] + (b[1] - a[1]) * (k - a[0]) / ((b[0] - a[0]) || 1); } return P[P.length - 1][1]; };
  function extPos(tr, i, T, L, env) {
    const n = tr.seq.length, a = tr.seq[i], b = tr.seq[Math.min(n - 1, i + 1)], M = Y.main, run = tr.down ? -Y.lane : Y.lane;
    const qy = Y.freight - 5 + ((tr.num >> 1) % 2) * 9;
    const stopAt = s => s === 'W' ? { x: L.xm(env.ST.W.km), y: tr.down ? YK6 : YK5 } : { x: L.xm(env.ST.Q.km), y: qy };
    if (T < tr.dep[i] || i === n - 1) { const p = stopAt(a); return { x: p.x, y: p.y, dir: tr.down ? 1 : -1, moving: false, i }; }
    const raw = Math.max(0, Math.min(1, (T - tr.dep[i]) / (tr.arr[i + 1] - tr.dep[i]))), f = raw * 0.35 + 0.65 * smooth(raw);
    const ka = env.ST[a].km + (a === 'C' ? frontOff(tr, i, env) : 0), kb = env.ST[b].km + (b === 'C' ? frontOff(tr, i + 1, env) : 0), km = ka + (kb - ka) * f;
    let y;
    if (a === 'W' || b === 'W') {
      const yc = M + laneOff(tr, a === 'C' ? i : i + 1, env);
      if (tr.down) { y = km < -0.55 ? poly(LINK.inW, km) : yc === M - Y.lane ? poly(LINK.in2, km) : M - Y.side;   /* 入り（北） */
        if (km > -0.35) y = yc; }
      else { const asc = P => P.slice().sort((p, q) => p[0] - q[0]);   /* 出（南） */
        y = km < -0.7 ? poly(asc(LINK.outW), km) : yc === M + Y.side ? (km < -0.45 ? poly(asc(LINK.out4), km) : yc) : M + Y.side + 18; }
    } else {   /* 臨港線 */
      const P = env.ST.P.km, F = LINK.frt.map(d => P + d), N = env.ST.N.km, oN = laneOff(tr, a === 'N' ? i : i + 1, env);
      const tq = [[F[0], tr.down ? M - Y.lane : M + Y.lane], [F[1], M + Y.lane], [F[2], Y.freight - 10], [F[3], Y.freight - 10], [F[4], qy], [P + 1, qy]];
      if (km < F[0]) y = M + (Math.abs(km - N) < 0.8 ? laneGeo('N', Math.abs(km - N), oN, run) : run);
      else y = poly(tq, km);
    }
    return { x: L.xm(km), y, dir: tr.down ? 1 : -1, moving: true, i, f: raw };
  }
  /* 止まる位置のずれ（km・列車の先頭）。env.hs があるときだけ。中ほどの駅はホームの真ん中に、頭端の駅は車止め側に、千鳥の駅はずらす */
  function frontOff(tr, i, env) {
    const st = env.hs && env.hs.stations && env.hs.stations[tr.seq[i]]; if (!st) return 0;
    const n = tr.seq.length, len = (tr.cars || 6) * 0.02, s = tr.seq[i];
    if (st.stop === 'head') { const west = s === 'C'; if (west) return tr.down && (i === 0 || tr.seq[i - 1] === 'W') ? len : 0;   /* 中央：下りは東のはしまで出て止まる（連絡線から来る臨時・貨物も） */ return !tr.down && i === 0 ? -len : 0; }
    const stops = i === 0 || i === n - 1 || tr.stop[i];
    if (!stops) return 0;
    if (st.stop === 'stagger') return tr.down ? -0.025 : 0.025;   /* 千鳥：まん中の踏切をふさがない位置に止まる */
    return tr.down ? len / 2 : -len / 2;
  }
  /* 駅のまわりの線路の形（駅の中心からの km）：cross＝下りと上りを入れかえる渡り線・シーサス、fan＝本線から外側の番線へ分かれる所。
     ctc-view.js の drawTrack と同じ数字（どちらかを変えたら両方）。まっすぐな線なので、あいだは直線でつなぐ */
  const GEO = { C: { cross: [0.57, 0.68], fan: [0.34, 0.54] }, P: { cross: [0.5, 0.65], fan: [0.32, 0.45] }, U: { cross: [0.42, 0.56], fan: [0.2, 0.35] }, S: { cross: [0.21, 0.35], fan: [0.2, 0.35] }, N: { cross: [0.21, 0.35], fan: [0.2, 0.35] } };
  const lin = u => Math.max(0, Math.min(1, u));
  function laneGeo(s, d, o, run) {
    const G = GEO[s] || { cross: [0.42, 0.56], fan: [0.2, 0.35] }, base = o < 0 ? -Y.lane : Y.lane;
    let y = run;
    if (Math.sign(base) !== Math.sign(run)) y = run + (base - run) * lin((G.cross[1] - d) / (G.cross[1] - G.cross[0]));
    if (o !== base) y += (o - base) * lin((G.fan[1] - d) / (G.fan[1] - G.fan[0]));
    return y;
  }
  function trainPos(tr, T, L, env) {
    const n = tr.seq.length;
    let i = 0; while (i < n - 1 && tr.arr[i + 1] <= T) i++;
    if (tr.synth) { const a = tr.seq[i], b = tr.seq[Math.min(n - 1, i + 1)], stopped = T < tr.dep[i] || i === n - 1; if (a === 'W' || a === 'Q' || (!stopped && (b === 'W' || b === 'Q'))) return extPos(tr, i, T, L, env); }
    const st = k => tr.seq[k];
    const atSt = k => {
      const s = st(k), o = laneOff(tr, k, env), fo = frontOff(tr, k, env);
      if (onBranch(s)) return { x: L.xb(env.ST[s].bkm + fo), y: Y.br + o };
      return { x: L.xm(env.ST[s].km + fo), y: Y.main + o };
    };
    if (T < tr.dep[i] || i === n - 1) { const p = atSt(i); return { x: p.x, y: p.y, dir: tr.down ? 1 : -1, moving: false, i }; }
    const a = st(i), b = st(i + 1), br = onBranch(a) || onBranch(b);
    let raw = Math.max(0, Math.min(1, (T - tr.dep[i]) / (tr.arr[i + 1] - tr.dep[i])));
    if (tr.hold && tr.hold.i === i) {   /* 段5：事故にあった列車は、その場所で再開まで止まる */
      const h = tr.hold, a0 = tr.dep[i] + h.f * h.run, a1 = a0 + h.dur;
      raw = T < a0 ? h.f * (T - tr.dep[i]) / Math.max(0.01, a0 - tr.dep[i]) : T < a1 ? h.f : h.f + (1 - h.f) * Math.min(1, (T - a1) / Math.max(0.01, tr.arr[i + 1] - a1));
    }
    /* 止まる駅でだけ、ゆっくり出て・ゆっくり止まる（通過する駅では速いまま。追いこしの前後で列車が重ならないように） */
    const sa = i === 0 || tr.stop[i], sb = i + 1 === n - 1 || tr.stop[i + 1];
    const f = sa && sb ? raw * 0.35 + 0.65 * smooth(raw) : sa ? raw * 0.35 + 0.65 * raw * raw : sb ? raw * 0.35 + 0.65 * (1 - (1 - raw) * (1 - raw)) : raw;
    const ka = kmOf(a, env, br) + frontOff(tr, i, env), kb = kmOf(b, env, br) + frontOff(tr, i + 1, env), km = ka + (kb - ka) * f;
    const oa = laneOff(tr, i, env), ob = laneOff(tr, i + 1, env);
    if (!br) {
      const run = tr.down ? -Y.lane : Y.lane;
      /* 番線を変えるのは、線路の絵と同じ所（渡り線・シーサス・分かれる線）だけ。駅の中心からの距離で決める（2026-11-18） */
      const ca = env.ST[a].km, cb = env.ST[b].km, da = Math.abs(km - ca), db = Math.abs(km - cb);
      const o = da <= db ? laneGeo(a, da, oa, run) : laneGeo(b, db, ob, run);
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
        y = Y.br + o * lin((STA - d) / 0.15);   /* 分かれる線（駅の中心から 0.35〜0.2km）と同じ所で */
      }
      if ((a === 'O' || b === 'O') && Math.abs(bkm - env.ST.O.bkm) < OS) { const d = Math.abs(bkm - env.ST.O.bkm); y = Y.br + (b === 'O' ? ob : oa) * lin((OS - d) / (OS - 0.06)); }
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
  const RULE = { hw: 2.0, hws: 0.5, connMax: 5, swapMin: 2, recover: 0.03, turn: 4, iter: 10, cancelMin: 20 };
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
    if (env.big) put(env.big.tr, env.big.i + 1, { run: env.big.dur, code: 'stop', big: true, bigI: true, txt: `${env.ST[env.big.a].name}〜${env.ST[env.big.b].name}で${env.big.name}（この列車）` });   /* 段5：事故にあった列車は、その場で再開まで止まる */
    /* 自社の要望（段4）：受けた要望の分だけ、止まる時間をのばす */
    for (const q of env.requests || []) if (q.ok) for (const h of q.hits) put(h.tr, h.i, { dwell: h.min, code: 'request', txt: h.txt });
    if (env.pre) env.pre.forEach((o, tr) => put(tr, 0, { dwell: o.min, code: 'other', txt: o.txt }));
    return dist;
  }

  function disrupt(trips, hl, env) {
    /* 段4：方針（POLICY）で決まりの数字を変える。env.rule がなければ今までと同じ */
    const RL = Object.assign({}, RULE, env.rule || {}); env = Object.assign({}, env, { RL });
    const paid = t => t && (t.type === 'E' || t.type === 'X');
    /* 接続を待つ上限（分）。売上重視：料金のいる列車（特急・観光特急）は待たせず、特急からの乗りかえは長く待つ */
    const cmax = (tr, srcPaid) => RL.paid ? (paid(tr) ? RL.paidHold : srcPaid ? RL.paidWait : RL.connMax) : RL.connMax;
    const dist = disturb(trips, env), name = t => env.TYPES[t.type].name + ' ' + t.num;
    const A = new Map();
    trips.forEach(tr => A.set(tr, { arr: tr.arr.slice(), dep: tr.dep.slice(), why: tr.seq.map(() => []) }));
    /* 同じ駅から同じ向きに出る列車の順番（予定） */
    const order = {};
    trips.forEach(tr => tr.seq.forEach((s, i) => { if (i === tr.seq.length - 1) return; const k = s + (tr.down ? 'd' : 'u') + (onBranch(tr.seq[i + 1]) || onBranch(s) && tr.seq[i + 1] !== 'K' ? 'b' : 'm'); (order[k] || (order[k] = [])).push({ tr, i }); }));
    Object.values(order).forEach(L => L.sort((a, b) => a.tr.dep[a.i] - b.tr.dep[b.i]));
    const conns = hl.filter(h => h.k === 'conn'), passes = hl.filter(h => h.k === 'taihi' || h.k === 'conn' || h.k === 'passExtra'), ext = env.ext || [];
    const brSec = {};
    trips.filter(t => t.seq.includes('O')).forEach(tr => tr.seq.forEach((s, i) => { if (i === tr.seq.length - 1) return; const b = tr.seq[i + 1]; if (!(onBranch(s) || onBranch(b))) return; const key = [s, b].sort().join(''); (brSec[key] || (brSec[key] = [])).push({ tr, i }); }));
    /* 段5：大きな事故（env.big＝{name,a,b,t0,t1,dur,tr,i}）。その区間へは再開まで出さない（運転見合わせ）。
       先の駅に止められた列車がいるあいだは、手前の駅で待つ（駅の間に列車を止めない）。大きく遅れた編成は、1往復を運休して次から定時に戻す。env.big がなければ前と同じ */
    const BIG = env.big || null, cancelled = new Set(), cancels = [], NIT = RL.iter + (BIG ? 8 : 0);
    const blocked = (x, y) => BIG && ((x === BIG.a && y === BIG.b) || (x === BIG.b && y === BIG.a));
    const capOf = x => (x === 'C' || x === 'P' || x === 'O' || x === 'W' || x === 'Q') ? 9 : env.ST[x].taihi ? 2 : 1;
    const setsOf = BIG ? [...new Set(trips.filter(t => t.set && !t.synth).map(t => t.set))] : [];
    /* まだ始発駅（車庫のある駅）を出ていない列車で、再開の前に事故の区間へ入るはずのものは、1往復を運休（出すと手前の駅でつまる） */
    const pre = [];
    if (BIG) for (const st of setsOf) { const L = st.trips;
      for (let k = 0; k + 1 < L.length; k += 2) { const o = L[k], r = L[k + 1]; if (o.dep[0] < BIG.t0 - 0.01 || o.seq[0] !== r.seq[r.seq.length - 1]) continue;
        let hit = false; for (let j = 0; j < o.seq.length - 1; j++) if (blocked(o.seq[j], o.seq[j + 1]) && o.dep[j] < BIG.t1 - 3) hit = true;
        if (hit) { cancelled.add(o); cancelled.add(r); pre.push(o, r); } } }
    let swaps = new Set(), decisions = [];
    for (let it = 0; it < NIT; it++) {
      const nextSwaps = new Set();
      /* 待避の順番の入れかえ：追いこす予定の列車が大きく遅れていたら、待っている列車を先に出す */
      for (const h of passes) {
        const L = h.a, X = h.b, i = L.seq.indexOf(h.st), j = X.seq.indexOf(h.st);
        const xa = A.get(X).arr[j], lReady = A.get(L).arr[i] + env.nomDwell(L, i);
        if ((h.k === 'taihi' || h.k === 'passExtra') && !L.freight && xa - Math.max(lReady, L.dep[i]) > RL.swapMin) nextSwaps.add(h);   /* 貨物は遅いので先に出さない */
      }
      swaps = nextSwaps;
      const swapEarly = new Set([...swaps].map(h => h.a.num + '@' + h.a.seq.indexOf(h.st)));
      const ord = {};
      for (const k in order) {
        const L = BIG ? order[k].filter(o => !cancelled.has(o.tr)) : order[k].slice();
        for (const h of swaps) { const a = L.findIndex(o => o.tr === h.b && o.tr.seq[o.i] === h.st), b = L.findIndex(o => o.tr === h.a && o.tr.seq[o.i] === h.st); if (a >= 0 && b >= 0 && a < b) { const [x] = L.splice(b, 1); L.splice(a, 0, x); } }
        L.forEach((o, n) => { ord[o.tr.num + '@' + o.i] = n ? L[n - 1] : null; });
      }
      decisions = [];
      for (const tr of trips) {
        const a = A.get(tr), d = dist.get(tr) || {}, n = tr.seq.length;
        a.why = tr.seq.map(() => []);
        if (cancelled.has(tr)) { a.arr = tr.arr.slice(); a.dep = tr.dep.slice(); a.cancel = true; continue; }
        for (let i = 0; i < n; i++) {
          const s = tr.seq[i];
          if (i > 0) {
            const plannedRun = tr.arr[i] - tr.dep[i - 1], late = a.dep[i - 1] - tr.dep[i - 1];
            let run = plannedRun + ((d[i] && d[i].run) || 0);
            const rec = late > 0.3 ? Math.min(late, plannedRun * RL.recover) : 0;
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
            let k = tr.set.trips.indexOf(tr) - 1; while (k >= 0 && cancelled.has(tr.set.trips[k])) k--;   /* 運休した列車はとばす */
            const pv = k >= 0 ? tr.set.trips[k] : null;
            if (pv) { const pa = A.get(pv), ready = pa.arr[pa.arr.length - 1] + RL.turn; if (ready > dep + 0.01) { dep = ready; cause = { code: 'late', by: pv, txt: `${env.ST[s].name}で、折り返す前の${name(pv)}が遅れて着いたため` }; } }
          }
          if (d[i] && d[i].dwell) a.why[i].push(...d[i].txt.map(o => ({ code: o.code, min: o.dwell != null ? o.dwell : extra, txt: o.txt, big: o.big })));
          /* 前の列車との間かく（同じ向き・同じ駅から） */
          const pred = ord[tr.num + '@' + i];
          if (pred) { const pd = A.get(pred.tr).dep[pred.i] + (onBranch(s) ? RL.hws : RL.hw); if (pd > dep + 0.01) { dep = pd; cause = { code: 'late', by: pred.tr, txt: `${env.ST[s].name}で、前を走る${name(pred.tr)}が遅れているため発車を待つ` }; } }
          /* 単線：反対から来る列車が先に区間を出るまで */
          const b = tr.seq[i + 1];
          if (onBranch(s) || onBranch(b)) {
            const key = [s, b].sort().join(''), list = brSec[key] || [];
            for (const o of list) {
              if (o.tr.down === tr.down || cancelled.has(o.tr)) continue;
              const oa = A.get(o.tr), oEnter = o.tr.dep[o.i], tEnter = tr.dep[i];
              if (oEnter < tEnter - 0.01) { const free = oa.arr[o.i + 1] + RL.hws; if (free > dep + 0.01) { dep = free; cause = { code: 'late', by: o.tr, txt: `${env.ST[s].name}で、単線の反対から来る${name(o.tr)}の遅れを待つ（行き違いの順番はそのまま）` }; } }
            }
          }
          if (BIG) {
            /* 運転見合わせ：事故の区間へは、再開まで出さない */
            if (blocked(s, b) && tr !== BIG.tr && dep < BIG.t1 && (dep >= BIG.t0 - 0.01 || (tr.down === BIG.tr.down && dep > BIG.tr.dep[BIG.i]))) { dep = BIG.t1; cause = { code: 'stop', txt: `${env.ST[s].name}で運転見合わせ（${env.ST[BIG.a].name}〜${env.ST[BIG.b].name}の${BIG.name}）` }; }
            /* 先の駅がふさがっている：先の駅に、同じ向きの列車が入れる数（待避線のある駅は2本・川辺は温泉方面と本線で1本ずつ）だけ
               止められているあいだは、手前の駅で待つ。前を行く列車を6本までさかのぼって数える */
            const cap = capOf(b);
            if (cap < 9) {
              const grp = b === 'K' ? tr.seq.includes('O') : null, ds = []; let held = false, q = pred, over = 0;
              for (let c2 = 0; q && c2 < 6; c2++, q = ord[q.tr.num + '@' + q.i]) {
                const j = q.tr.seq.indexOf(b); if (j <= 0 || j >= q.tr.seq.length - 1) continue;
                if (grp != null && q.tr.seq.includes('O') !== grp) continue;
                if (q.tr.dep[j] > tr.dep[i + 1] - 0.01) { over++; continue; }   /* この列車が先の駅で追いこす相手（待避線で待っている）は数えない */
                const qd = A.get(q.tr).dep[j]; ds.push({ d: qd, tr: q.tr }); if (qd - q.tr.dep[j] > 1.5) held = true;
              }
              const lim = Math.max(1, (b === 'K' && grp ? 1 : cap) - over);
              if (held && ds.length >= lim) { ds.sort((x, y) => y.d - x.d); const h = ds[lim - 1], need = h.d + 0.3 - (tr.arr[i + 1] - tr.dep[i]); if (need > dep + 0.01) { dep = need; cause = { code: 'jam', by: h.tr, txt: `${env.ST[s].name}で待つ（先の${env.ST[b].name}に${name(h.tr)}が止まっているため）` }; } }
            }
          }
          /* 接続：相手が遅れても上限まで待つ */
          for (const h of conns) {
            if (h.a !== tr || h.st !== s) continue;
            const o = h.b; if (cancelled.has(o)) continue;
            const j = o.seq.indexOf(s), oa = A.get(o).arr[j], need = oa + 0.5, mx = cmax(tr, paid(o));
            if (need <= dep + 0.01) continue;
            if (need - tr.dep[i] <= mx) { dep = need; cause = { code: 'conn', by: o, txt: `${env.ST[s].name}で、遅れている${name(o)}からの乗りかえを待つ（上限${mx}分以内）` }; decisions.push({ t: tr.dep[i], k: 'conn', st: s, a: tr, b: o, hold: need - tr.dep[i], max: mx }); }
            else { decisions.push({ t: tr.dep[i], k: 'connCut', st: s, a: tr, b: o, late: oa - o.arr[j], max: mx }); a.why[i].push({ code: 'connCut', min: 0, by: o, txt: `${env.ST[s].name}：${name(o)}の遅れが上限${mx}分をこえたので、接続を打ち切って発車` }); }
          }
          /* 外との接続（他社線・バス・フェリー・臨時列車）：相手が遅れても上限まで待つ */
          for (const h of ext) {
            if (h.a !== tr || h.st !== s) continue;
            const oa = h.from ? A.get(h.from).arr[h.from.seq.indexOf(s)] : h.arr + h.late, need = oa + h.xfer, mx = cmax(tr, /特急/.test(h.label));
            if (need <= dep + 0.01) continue;
            if (need - tr.dep[i] <= mx) { dep = need; cause = { code: h.k, txt: `${env.ST[s].name}で、${h.from ? '遅れている' : fmtMin(oa - h.arr) + '遅れている'}${h.label}からの乗りかえを待つ（上限${mx}分以内）` }; decisions.push({ t: tr.dep[i], k: h.k, st: s, a: tr, ext: h, hold: need - tr.dep[i], late: oa - h.arr, max: mx }); }
            else { decisions.push({ t: tr.dep[i], k: 'connCut', st: s, a: tr, ext: h, late: oa - h.arr, max: mx }); a.why[i].push({ code: 'connCut', min: 0, txt: `${env.ST[s].name}：${h.label}の遅れ（${fmtMin(oa - h.arr)}）が上限${mx}分をこえたので、接続を打ち切って発車` }); }
          }
          if (cause) { cause.min = dep - Math.max(minDep, (i === 0 ? tr.dep[0] : a.arr[i] + nom) + extra); if (cause.min > 0.05) a.why[i].push(cause); }
          a.dep[i] = dep;
        }
      }
      /* 運休（間引き）：車庫のある駅に大きく遅れて戻った編成は、次の1往復を休んで、その次から定時に戻す */
      if (BIG && it < NIT - 4) for (const st of setsOf) {
        const L = st.trips;
        for (let k = 2; k + 1 < L.length; k += 2) {
          const o = L[k], r = L[k + 1]; if (cancelled.has(o) || o.dep[0] < BIG.t0 || o.seq[0] !== r.seq[r.seq.length - 1]) continue;
          let m = k - 1; while (m >= 0 && cancelled.has(L[m])) m--; if (m < 0) continue;
          const pa = A.get(L[m]), late = pa.arr[pa.arr.length - 1] + RL.turn - o.dep[0];
          if (late > RL.cancelMin) { cancelled.add(o); cancelled.add(r); cancels.push({ o, r, set: st, late }); break; }
        }
      }
    }
    for (const h of swaps) decisions.push({ t: h.a.dep[h.a.seq.indexOf(h.st)], k: 'swap', st: h.st, a: h.a, b: h.b });
    dist.forEach((m, tr) => { for (const i in m) for (const o of m[i].txt) if ((o.big || o.code === 'incident') && !o.bigI) decisions.push({ t: tr.arr[+i] || tr.dep[0], k: 'incident', st: tr.seq[+i], a: tr, txt: o.txt, min: (m[i].dwell || m[i].run) }); });
    /* 段5：大きな事故のカード（運転見合わせ → 振替輸送 → 運転再開 → 運休） */
    if (BIG) {
      const sec = `${env.ST[BIG.a].name}〜${env.ST[BIG.b].name}`, hm = t => `${Math.floor(t / 60) % 24}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
      let held = 0, mx = 0; trips.forEach(t => { const a = A.get(t); if (a.cancel) return; if (a.why.some(w => w.some(x => x.code === 'stop' || x.code === 'jam'))) held++; mx = Math.max(mx, a.arr[a.arr.length - 1] - t.arr[t.arr.length - 1]); });
      const B = (t, k, o) => decisions.push(Object.assign({ t, k, st: BIG.a, a: BIG.tr, big: true }, o));
      B(BIG.t0, 'stop', { what: `${hm(BIG.t0)}ごろ、${sec}で${BIG.name}（${name(BIG.tr)}）`, dec: `${sec}の運転を見合わせる。ほかの列車は手前の駅で止める`, why: '安全の確認が先。駅と駅の間には止めない（お客さんがおりられる駅で待つ）',
        res: `再開の見こみは${hm(BIG.t1)}ごろ（約${fmtMin(BIG.dur)}）。${held}本の列車が駅で待つ`, radio: `指令から全列車、${sec}で${BIG.name}。この区間の運転を見合わせます。各列車は次の駅で止まって、指示を待ってください。` });
      if (BIG.dur >= 30) B(BIG.t0 + 5, 'furikae', { what: `再開まで30分をこえる見こみ`, dec: onBranch(BIG.a) || onBranch(BIG.b) ? '路線バスに振替輸送を頼む（温泉方面）' : '県央本線と路線バスに振替輸送を頼む', why: '急ぐお客さんに、ほかの道を案内する（きっぷはそのまま使える）',
        res: '駅の放送と発車標で案内。振替の人数はまだ数えていない', radio: `指令から各駅、振替輸送を始めます。お客さまにご案内ください。` });
      B(BIG.t1, 'resume', { what: `${sec}の安全を確かめおわった`, dec: '運転再開。止まっていた列車を、前から順に間かくをあけて出す', why: '一度に出すと、先の駅でまたつまる',
        res: `いちばん大きい遅れは約${fmtMin(mx)}。運休は${cancelled.size}本`, radio: `指令から全列車、${sec}の運転を再開します。前の列車に続いて、順に発車してください。` });
      if (pre.length) B(BIG.t0 + 2, 'cancel', { what: `再開まで約${fmtMin(BIG.dur)}。${sec}を通る列車が、これから${pre.length}本ある`, dec: `まだ始発駅を出ていない${pre.length}本（${pre.length / 2}往復）を運休`, why: '出しても事故の区間の手前の駅でつまり、動ける列車までおくれる',
        res: 'お客さんは、再開のあとの列車か振替輸送へ。編成は車庫のある駅で待ち、次の列車から定時で出る', radio: `指令から中央駅・港駅、${sec}を通る列車は、再開まで発車を見合わせます（${pre.length}本を運休）。` });
      for (const c of cancels) decisions.push({ t: c.o.dep[0] - 3, k: 'cancel', st: c.o.seq[0], a: c.o, big: true, what: `${c.set.label}が約${fmtMin(c.late)}遅れで${env.ST[c.o.seq[0]].name}に戻る`, dec: `${name(c.o)}と、折り返しの${name(c.r)}を運休`, why: `遅れが${RL.cancelMin}分をこえた。この編成を次の列車から定時に戻す（遅れを後ろへ送らない）`,
        res: `お客さんは前後の列車へ。運休しなければ、この編成は終電近くまで遅れを引きずる`, radio: `指令から${env.ST[c.o.seq[0]].name}駅、${c.o.num}列車と${c.r.num}列車は運休とします。お客さまのご案内をお願いします。` });
    }
    /* 自社の要望（段4）：受けた・ことわったをカードに */
    for (const q of env.requests || []) decisions.push({ t: q.t, k: 'request', st: q.st, a: q.first || null, req: q });
    /* フェリーの最終便（段3の残り）：列車が遅れたら、出港を少し待ってもらう */
    for (const f of env.boats || []) { const at = A.get(f.tr).arr[f.i], late = at - f.tr.arr[f.i], need = at + f.xfer - f.t; if (late >= 0.5 && need > 0) decisions.push({ t: f.t, k: 'connFerry', st: f.st, a: f.tr, boat: f, late, need }); }
    decisions.sort((x, y) => x.t - y.t);
    decisions.forEach(c => card(c, A, trips, env));
    return { A, decisions, swaps, rule: RL, big: BIG, cancelled };
  }
  /* 判断のカード：起きたこと → 判断 → 理由 → 結果（もしも） */
  const RULE0 = RULE;
  function card(c, A, trips, env) {
    if (c.what) return c;   /* 大きな事故のカードは、もう文ができている */
    const RULE = env.RL || RULE0, name = t => env.TYPES[t.type].name + ' ' + t.num, sn = env.ST[c.st].name, ml = (t, i) => A.get(t).dep[i] - t.dep[i];
    const nextSame = (tr, i) => { let best = null; for (const o of trips) { if (o === tr || o.down !== tr.down) continue; const j = o.seq.indexOf(tr.seq[i]); if (j < 0 || j === o.seq.length - 1 || !o.stop[j]) continue; if (o.seq[o.seq.length - 1] !== tr.seq[tr.seq.length - 1]) continue; if (o.dep[j] > tr.dep[i] && (!best || o.dep[j] < best.t)) best = { o, t: o.dep[j] }; } return best; };
    if (c.req) { const q = c.req; c.what = `${q.from}から要望：${q.ask}`; c.dec = q.ok ? `受ける（${q.act}）` : 'ことわる'; c.why = q.why; c.res = q.ok ? (q.n ? `${q.n}本の列車が合わせて約${fmtMin(q.min)}長く止まる` : 'きょうは当てはまる列車なし') : 'ダイヤはそのまま'; c.radio = q.ok ? `指令から${sn}駅、${q.act}。${q.from}からの要望です。` : `指令から${q.from}、きょうは${q.why}のため、お受けできません。`; return c; }
    if (c.boat) { const f = c.boat, ok = c.need <= f.max; c.what = `${f.label}に乗りつぐ${name(c.a)}が${fmtMin(c.late)}遅れ（${sn}）`; c.dec = ok ? `${f.label}に、出港を${fmtMin(c.need)}待ってもらう` : `${f.label}は定時に出港（待てない）`; c.why = ok ? `島へ帰る最後の便。待つのは${f.max}分まで` : `待つ上限${f.max}分をこえる（船のダイヤの都合）`; c.res = ok ? '乗りかえの人は島へ帰れる' : '乗りかえの人は、あしたの始発便へ。港駅で宿の案内'; c.radio = ok ? `指令から${sn}駅、${f.label}に連絡。${c.a.num}列車の到着を待って出港します。` : `指令から${sn}駅、${f.label}は待てません。お客さまのご案内をお願いします。`; return c; }
    if (c.k === 'incident') { c.what = c.txt; c.dec = '安全を確かめてから運転を続ける'; c.why = '安全が先'; c.res = `${name(c.a)}が約${fmtMin(c.min)}遅れ、後ろの列車にもうつる`; c.radio = `${c.a.num}列車から指令、${c.txt}。確認して報告します。`; }
    if (c.k === 'conn') { const i = c.a.seq.indexOf(c.st), nx = nextSame(c.a, i);
      c.what = `${name(c.b)}が遅れて${sn}に着く`; c.dec = `${name(c.a)}は接続を待つ（+${fmtMin(c.hold)}）`; c.why = `遅れが上限${c.max != null ? c.max : RULE.connMax}分以内`;
      c.res = `${name(c.a)}が${fmtMin(c.hold)}遅れて発車。待たなかったら、乗りかえの人は次の列車まで${nx ? Math.round(nx.t - c.a.dep[i]) + '分' : '長く'}待つ`; c.radio = `指令から${c.a.num}列車、${sn}で${c.b.num}列車の到着を待って発車してください。`; }
    if (c.ext) { const i = c.a.seq.indexOf(c.st), nx = nextSame(c.a, i), lb = c.ext.label;
      if (c.k === 'connCut') { c.what = `${lb}が${fmtMin(c.late)}遅れ`; c.dec = `${name(c.a)}は接続を打ち切って定時に発車`; c.why = `待つ上限${c.max != null ? c.max : RULE.connMax}分をこえる（待つと後ろのダイヤ全体が遅れる）`;
        c.res = `乗りかえの人は次の${nx ? name(nx.o) + '（' + Math.round(nx.t - c.a.dep[i]) + '分後）' : '列車'}へ案内`; c.radio = `指令から${sn}駅、${lb}からの乗りかえのお客さまを、次の列車へご案内ください。`; }
      else { c.what = `${lb}が${c.late >= 0.1 ? fmtMin(c.late) + '遅れて' : '遅れて'}${sn}に着く`; c.dec = `${name(c.a)}は接続を待つ（+${fmtMin(c.hold)}）`; c.why = `遅れが上限${c.max != null ? c.max : RULE.connMax}分以内。${c.k === 'connFerry' ? '島へ帰る人・島から来る人は、次の列車まで長く待つことになる' : c.k === 'connBus' ? 'バスの人は駅まで走ってくる' : '乗りかえの人が多い'}`;
        c.res = `${name(c.a)}が${fmtMin(c.hold)}遅れて発車。待たなかったら、乗りかえの人は次の列車まで${nx ? Math.round(nx.t - c.a.dep[i]) + '分' : '長く'}待つ`; c.radio = `指令から${c.a.num}列車、${sn}で${lb}からの乗りかえを待って発車してください。`; }
      return c; }
    if (c.k === 'connCut') { const i = c.a.seq.indexOf(c.st), nx = nextSame(c.a, i);
      c.what = `${name(c.b)}が${fmtMin(c.late)}遅れ`; c.dec = `${name(c.a)}は接続を打ち切って定時に発車`; c.why = `待つ上限${c.max != null ? c.max : RULE.connMax}分をこえる（待つと後ろのダイヤ全体が遅れる）`;
      c.res = `乗りかえの人は次の${nx ? name(nx.o) + '（' + Math.round(nx.t - c.a.dep[i]) + '分後）' : '列車'}へ案内`; c.radio = `指令から${sn}駅、${c.b.num}列車からの乗りかえのお客さまを、次の列車へご案内ください。`; }
    if (c.k === 'swap') { const i = c.a.seq.indexOf(c.st), j = c.b.seq.indexOf(c.st), xl = A.get(c.b).arr[j] - c.b.arr[j];
      c.what = `${sn}で通過待ちの予定の${name(c.b)}が${fmtMin(xl)}遅れ`; c.dec = `${name(c.a)}を先に出す（順番の入れかえ）`; c.why = `待つと${name(c.a)}まで${fmtMin(xl)}近く遅れる`;
      const la = Math.max(0, ml(c.a, i)); c.res = `${name(c.a)}の遅れ ${la < 0.1 ? 'なし' : fmtMin(la)}。入れかえなければ約${fmtMin(xl)}`; c.radio = `指令から${c.a.num}列車、${sn}は待避取りやめ。先に発車してください。${c.b.num}列車はあとに続けます。`; }
    return c;
  }
  /* ===== 段3：他社線・バス・フェリーとの接続、貨物と臨時列車のスジ、線路使用料（data/ctc-extra.json・すべて仮） =====
     ゲームのダイヤ（定期列車）は変えない。貨物と臨時列車は、ゲームと同じ決まり（index.html の scheduleTrip：待てる駅で発車をずらす・
     同じ向きは2分・単線は0.5分あける）で、定期列車のすき間に入れる。乗客・運賃の計算には返さない。 */
  const SYN_TYPES = {
    G: { name: '貨物', short: '貨', prio: 0, vmax: 75, dwell: 0, stops: [] },
    Z: { name: '臨時', short: '臨', prio: 2.5, vmax: 100, dwell: 1, stops: ['C', 'U', 'K', 'P', 'T', 'O'] },
  };
  TYPE_COL.G = '#b08a4a'; TYPE_BODY.G = '#4a3b26'; TYPE_COL.Z = '#d04fb0'; TYPE_BODY.Z = '#f6dcef';
  Object.assign(REASON, {
    connOther: { name: '他社線（県央本線）との接続', col: '#a99be0' },
    connBus: { name: 'バスとの接続', col: '#6fd3a8' },
    connFerry: { name: 'フェリーとの接続', col: '#4fb8c8' },
    connExtra: { name: '臨時列車との接続', col: '#e98fd0' },
    passExtra: { name: '臨時列車の通過待ち', col: '#d97cc0' },
    other: { name: '他社線の中での遅れ', col: '#b9a9ff' },
    crew: { name: '乗務員の交代', col: '#c9b27a' },
    freight: { name: '貨物列車', col: '#b08a4a' },
    extra: { name: '臨時列車', col: '#d04fb0' },
  });
  Object.assign(SHORT, { connOther: '他社線接続', connBus: 'バス接続', connFerry: 'フェリー接続', connExtra: '臨時接続', passExtra: '臨時の通過待ち', other: '他社線の遅れ', crew: '乗務員交代' });
  /* 駅をふやす：W＝連絡線の西のはし（県央本線から）、Q＝港貨物ターミナル（港の手前で南へ分かれる臨港線の先） */
  function extST(ST) {
    return Object.assign({}, ST, { W: { name: '県央本線（連絡線）', km: -2.2, wait: true, ext: true }, Q: { name: '港貨物ターミナル', km: ST.P.km, wait: true, term: true } });
  }
  const isB = s => s === 'K' || onBranch(s);
  const segBr = (a, b) => isB(a) && isB(b) && !(a === 'K' && b === 'K');
  function segKm(a, b, ST) { return segBr(a, b) ? Math.abs((a === 'K' ? 0 : ST[a].bkm) - (b === 'K' ? 0 : ST[b].bkm)) : Math.abs(ST[a].km - ST[b].km); }
  function runT(a, b, ty, sa, sb, env) { const v = segBr(a, b) ? Math.min(ty.vmax, 65) : ty.vmax; return segKm(a, b, env.ST) / (v * (env.sp || 1)) * 60 + (sa ? 0.55 : 0) + (sb ? 0.55 : 0); }
  /* 止まる時間（臨時・貨物）。中央は乗務員の交代で crew 分 */
  function synDwell(tr, i, env) {
    if (!tr.stop[i] || i === 0 || i === tr.seq.length - 1) return 0;
    const s = tr.seq[i], ty = SYN_TYPES[tr.type];
    return (s === 'C' ? Math.max(ty.dwell, env.crew || 2) : ty.dwell) + (env.dw || 0) + (env.evDwell ? env.evDwell(s, tr.arr[i]) : 0);
  }
  /* すでにあるダイヤを、ゲームと同じ区間の帳面（reg）に書く */
  function buildReg(trips, ST) {
    const reg = {};
    for (const tr of trips) {
      const seq = tr.seq, n = seq.length, w = [0];
      for (let i = 1; i < n - 1; i++) if (ST[seq[i]].wait) w.push(i);
      w.push(n - 1);
      regPut(reg, tr, w);
    }
    return reg;
  }
  function regPut(reg, tr, w) {
    const seq = tr.seq;
    for (let b = 0; b < w.length - 1; b++) {
      const bi = w[b], bj = w[b + 1];
      if (segBr(seq[bi], seq[bi + 1])) { const key = 'B' + [seq[bi], seq[bj]].sort().join(''); (reg[key] || (reg[key] = [])).push({ e: tr.dep[bi], x: tr.arr[bj] }); }
      else for (let k = bi; k < bj; k++) { const key = seq[k] + '>' + seq[k + 1]; (reg[key] || (reg[key] = [])).push({ e: tr.dep[k], x: (k + 1 === bj) ? tr.arr[bj] : tr.dep[k + 1] }); }
    }
  }
  /* 1本をすき間に入れる（index.html の scheduleTrip を写したもの。止まる時間だけ synDwell） */
  function fitTrip(tr, reg, env) {
    const ST = env.ST, seq = tr.seq, n = seq.length, ty = SYN_TYPES[tr.type], HW = env.HW || 2, HWS = env.HWS || 0.5;
    tr.stop = seq.map((s, i) => i === 0 || i === n - 1 || s === 'C' || ty.stops.includes(s));
    const arr = new Array(n), dep = new Array(n), w = [0];
    for (let i = 1; i < n - 1; i++) if (ST[seq[i]].wait) w.push(i);
    w.push(n - 1);
    tr.op = new Array(n).fill(false); tr.arr = arr; tr.dep = dep;
    const dw = (k, t) => { arr[k] = t; return synDwell(tr, k, env); };
    let nominal = 0;
    for (let k = 0; k < n - 1; k++) { nominal += runT(seq[k], seq[k + 1], ty, tr.stop[k], tr.stop[k + 1], env); if (k + 1 < n - 1 && tr.stop[k + 1]) nominal += (seq[k + 1] === 'C' ? Math.max(ty.dwell, env.crew || 2) : ty.dwell) + (env.dw || 0); }
    tr.nominal = nominal; arr[0] = tr.want; dep[0] = tr.want;
    for (let b = 0; b < w.length - 1; b++) {
      const bi = w[b], bj = w[b + 1];
      const base = bi === 0 ? tr.want : arr[bi] + dw(bi, arr[bi]);
      let start = base, ta = [], td = [];
      const branch = segBr(seq[bi], seq[bi + 1]);
      for (let it = 0; it < 90; it++) {
        ta = []; td = []; td[bi] = start; let cur = start;
        for (let k = bi; k < bj; k++) {
          ta[k + 1] = cur + runT(seq[k], seq[k + 1], ty, tr.stop[k] || (k === bi && start > base + 0.01), tr.stop[k + 1], env);
          td[k + 1] = ta[k + 1] + dw(k + 1, ta[k + 1]); cur = td[k + 1];
        }
        let shift = 0;
        if (branch) {
          const key = 'B' + [seq[bi], seq[bj]].sort().join(''), e0 = start, x0 = ta[bj];
          for (const iv of reg[key] || []) if (!(iv.x + HWS <= e0 || x0 + HWS <= iv.e)) shift = Math.max(shift, iv.x + HWS - e0);
        } else {
          for (let k = bi; k < bj; k++) {
            const key = seq[k] + '>' + seq[k + 1], e0 = td[k], x0 = (k + 1 === bj) ? ta[bj] : td[k + 1];
            for (const iv of reg[key] || []) {
              const ahead = iv.e <= e0 - HW && iv.x <= x0 - HW, behind = iv.e >= e0 + HW && iv.x >= x0 + HW;
              if (!ahead && !behind) shift = Math.max(shift, iv.e + HW - e0, iv.x + HW - x0);
            }
          }
        }
        if (shift <= 1e-6) break; start += shift + 0.05;
      }
      dep[bi] = start; if (start > base + 0.05 && !tr.stop[bi]) tr.op[bi] = true;
      for (let k = bi + 1; k <= bj; k++) { arr[k] = ta[k]; dep[k] = td[k]; }
    }
    dep[n - 1] = arr[n - 1]; arr[0] = dep[0];
    tr.down = ['P', 'O', 'Q'].includes(seq[n - 1]);
    tr.delay = arr[n - 1] - dep[0] - nominal;
    regPut(reg, tr, w);
    return tr;
  }
  const FRT_DOWN = ['W', 'C', 'S', 'U', 'M', 'K', 'N', 'Q'], TO_P = ['W', 'C', 'S', 'U', 'M', 'K', 'N', 'P'], TO_O = ['W', 'C', 'S', 'U', 'M', 'K', 'F', 'T', 'O'];
  /* その日の貨物と臨時列車を作る。env：{ST（extST したもの）, trips（定期）, X（ctc-extra.json）, events:[id], holiday, sp, dw, evDwell, day} */
  function synth(env) {
    const X = env.X, out = [], sets = [], reg = buildReg(env.trips, env.ST), fenv = Object.assign({}, env, { crew: X.freight.crew });
    let nz = 0, ng = 0;
    const num = (tr, k) => { tr.num = (tr.type === 'G' ? 8000 : 9000) + k * 2 + (tr.down ? 1 : 2); };
    /* 臨時列車を先に（貨物は臨時にも道をゆずる） */
    for (const id of env.events || []) {
      const z = X.extra.byEvent[id]; if (!z) continue;
      const seq = z.to === 'O' ? TO_O : TO_P;
      const a = fitTrip({ type: 'Z', synth: true, extra: true, name: z.name, ev: id, seq: seq.slice(), want: z.out, cars: z.cars }, reg, fenv);
      const b = fitTrip({ type: 'Z', synth: true, extra: true, name: z.name, ev: id, seq: seq.slice().reverse(), want: Math.max(z.back, a.arr[a.arr.length - 1] + 12), cars: z.cars }, reg, fenv);
      num(a, nz); num(b, nz); nz++;
      const set = { synth: true, kind: 'Z', label: '臨時「' + z.name + '」', cars: z.cars, plat: z.to === 'P' ? 3 : 1, rest: z.to, trips: [a, b] };
      a.set = set; b.set = set; a.pair = null; b.pair = a; sets.push(set); out.push(a, b);
    }
    for (const r of X.freight.runs) {
      if (env.holiday && !r.holiday) continue;
      const tr = fitTrip({ type: 'G', synth: true, freight: true, name: X.freight.name, load: r.load, seq: r.dir === 'in' ? FRT_DOWN.slice() : FRT_DOWN.slice().reverse(), want: r.want, cars: 12 }, reg, fenv);
      if (tr.arr[tr.arr.length - 1] > 1590) continue;   /* 夜おそくなりすぎるスジは、その日は走らせない */
      num(tr, ng++);
      const set = { synth: true, kind: 'G', label: '貨物 ' + r.load, cars: 12, plat: 0, rest: r.dir === 'in' ? 'Q' : null, trips: [tr] };
      tr.set = set; sets.push(set); out.push(tr);
    }
    out.forEach(t => { t.cap = 0; t.loadAfter = []; });
    return { trips: out, sets };
  }
  /* 臨時・貨物が自社の線路を走ったキロ（連絡線から先）と線路使用料 */
  function fee(trips, X, ST) {
    let km = { G: 0, Z: 0 }, yen = 0;
    for (const t of trips) { if (!t.synth) continue; let k = 0; for (let i = 0; i < t.seq.length - 1; i++) { const a = t.seq[i], b = t.seq[i + 1]; if (a === 'W' || b === 'W') continue; k += segKm(a, b, ST); } km[t.type] += k; yen += k * (X.fee[t.type] || 0); }
    return { km, yen: Math.round(yen) };
  }
  /* 県央本線から来る臨時・貨物の、中央に着くまでの遅れ（運行日ごとに同じ） */
  function synLate(syn, env) {
    const R = rng((env.day || 1) * 7727 + 5), m = new Map(), Z = env.X.extra.late;
    for (const t of syn) {
      if (!t.down) continue;
      const p = t.extra ? Z.p : 0.3, mx = t.extra ? Z.max : 10, r = R(), v = R();
      if (r < p) { const min = 1 + v * (mx - 1); m.set(t, { min, txt: `県央本線の中で遅れて連絡線に入った（${fmtMin(min)}）` }); }
    }
    return m;
  }
  /* 臨時・貨物が待避線で待つ（定期列車に道をゆずる）か */
  function synOnSiding(tr, i, env) { const n = tr.seq.length; if (i <= 0 || i >= n - 1 || !env.ST[tr.seq[i]].taihi) return false; return tr.dep[i] - tr.arr[i] > synDwell(tr, i, env) + 0.4; }

  /* 外との接続（他社線・バス・フェリー・臨時列車）。その日の遅れ（乱数・運行日ごとに同じ）もここで決める。
     返すのは見どころの形 {t, k, st, a（待つ自社の列車）, from（臨時列車のとき）, arr（相手の予定の着）, late, xfer, label, txt, radio} */
  function extConns(trips, syn, env) {
    const X = env.X, R = rng((env.day || 1) * 104729 + 17), out = [], name = t => env.TYPES[t.type].name + ' ' + t.num, sn = s => env.ST[s].name;
    const lateOf = (o, rushK) => { const r = R(), b = R(), m = R(); if (o.bigP && b < o.bigP * 0.25) return o.bigMin + m * (o.bigMax - o.bigMin); return r < Math.min(0.95, o.lateP * (rushK || 1)) ? 1 + m * ((o.lateMax || 6) - 1) : 0; };
    /* その駅を、向きが合い、着いてから xfer〜win 分のあいだに出る自社の列車（いちばん早いもの） */
    const pick = (s, t0, t1, ok) => { let best = null; for (const tr of trips) { if (tr.synth) continue; const i = tr.seq.indexOf(s); if (i < 0 || i === tr.seq.length - 1 || !tr.stop[i]) continue; const d = tr.dep[i]; if (d < t0 || d > t1 || !ok(tr, i)) continue; if (!best || d < best.tr.dep[best.i]) best = { tr, i }; } return best; };
    const add = (k, s, at, late, xfer, label, p, extra) => {
      const t = p.tr.dep[p.i];
      out.push(Object.assign({ t: at + xfer, k, st: s, a: p.tr, arr: at, late, xfer, label, ext: true,
        txt: `${sn(s)}で ${label}${late >= 0.5 ? '（遅れ' + fmtMin(late) + '）' : ''} → ${name(p.tr)}（${Math.floor(t / 60) % 24}:${String(Math.round(t % 60)).padStart(2, '0')}発）に乗りかえ`,
        radio: late >= 0.5 ? `指令から${sn(s)}駅、${label}が${fmtMin(late)}遅れ。${p.tr.num}列車は接続をとります（上限${RULE.connMax}分）。` : `${sn(s)}駅、${label}からの乗りかえ、${p.tr.num}列車で受けます。` }, extra || {}));
    };
    const K = X.kenou;
    for (const ln of K.trains) for (let at = ln.first; at <= ln.last; at += ln.int) {
      const late = lateOf(K);
      let p = null;
      for (const ty of ln.want) { p = pick(K.st, at + K.xfer, at + K.win, (tr, i) => tr.down && i === 0 && tr.type === ty); if (p) break; }
      if (p) add('connOther', K.st, at, late, K.xfer, K.name + ' ' + ln.name, p);
    }
    const B = X.bus;
    for (const ln of B.lines) for (let at = ln.first; at <= ln.last; at += ln.int) {
      const rush = (at >= 420 && at <= 540) || (at >= 1020 && at <= 1140), late = lateOf(B, rush ? B.rushP / B.lateP : 1);
      const p = pick(ln.st, at + B.xfer, at + B.win, tr => tr.down === (ln.dir === 'down'));
      if (p) add('connBus', ln.st, at, late, B.xfer, 'バス「' + ln.name + '」', p);
    }
    const F = X.ferry, wxK = env.wx === 'rain' || env.wx === 'snow' ? F.wxP / F.lateP : 1;
    for (const at of F.arr) {
      const late = lateOf(F, wxK), p = pick(F.st, at + F.xfer, at + F.win, tr => !tr.down);
      if (p) add('connFerry', F.st, at, late, F.xfer, F.name, p);
    }
    /* 臨時列車から、川辺で支線（または本線）へ乗りかえ */
    for (const z of syn) {
      if (!z.extra) continue;
      const i = z.seq.indexOf('K'); if (i < 0 || !z.stop[i]) continue;
      const toBr = z.seq.includes('O'), at = z.arr[i];
      const p = pick('K', at + X.extra.xfer, at + X.extra.win, tr => tr.down === z.down && tr.seq.includes('O') !== toBr);
      if (p) add('connExtra', 'K', at, 0, X.extra.xfer, '臨時「' + z.name + '」' + z.num, p, { from: z });
    }
    out.sort((a, b) => a.t - b.t);
    return out;
  }
  /* 臨時・貨物の見どころ（乗務員の交代・臨時の通過待ち）。hl はふつうの見どころ（全部の列車で作ったもの）を直す */
  function synHighlights(hl, syn, env) {
    const name = t => env.TYPES[t.type].name + ' ' + t.num, out = [];
    for (const h of hl) {
      if (h.k !== 'taihi' && h.k !== 'conn') { out.push(h); continue; }
      if (h.a.type === 'G') { h.k = 'taihi'; h.txt = `${env.ST[h.st].name}で ${name(h.b)} が 貨物${h.a.num} を追いこす`; h.radio = `指令から${h.a.num}列車、${env.ST[h.st].name}の待避線へ。${h.b.num}列車を先に通します。`; }
      if (h.b.extra && h.k === 'taihi') { h.k = 'passExtra'; h.txt = `${env.ST[h.st].name}で 臨時「${h.b.name}」${h.b.num} が ${name(h.a)} を追いこす`; }
      out.push(h);
    }
    for (const t of syn) {
      const i = t.seq.indexOf('C'); if (i <= 0 || i === t.seq.length - 1) continue;
      const kind = t.type === 'G' ? '貨物' : '臨時「' + t.name + '」';
      out.push({ t: t.arr[i], k: 'crew', st: 'C', a: t, txt: `中央で ${kind}${t.num} の乗務員交代（${t.down ? '県央本線→みなと川電鉄' : 'みなと川電鉄→県央本線'}）`,
        radio: `指令から${t.num}列車、中央で乗務員交代。${t.down ? '連絡線から1番線へ入ります。' : '交代のあと、連絡線へ進路を開きます。'}` });
      const j = t.down ? 0 : t.seq.length - 1, at = t.down ? t.dep[0] : t.arr[j];
      out.push({ t: at, k: t.type === 'G' ? 'freight' : 'extra', st: t.down ? 'C' : 'C', a: t,
        txt: t.down ? `${kind}${t.num} が県央本線から連絡線に入る（${t.freight ? t.load : env.ST[t.seq[t.seq.length - 1]].name + 'ゆき'}）` : `${kind}${t.num} が連絡線から県央本線へ`,
        radio: t.down ? `県央本線の指令から、${t.num}列車を連絡線へ渡します。` : `${t.num}列車、県央本線へ渡ります。` });
      if (t.freight) { const q = t.seq.indexOf('Q'); if (q >= 0) out.push({ t: q === 0 ? t.dep[0] : t.arr[q], k: 'freight', st: 'Q', a: t, txt: q === 0 ? `貨物${t.num} が港貨物ターミナルを出発（${t.load}）` : `貨物${t.num} が臨港線から港貨物ターミナルに着く（${t.load}）`, radio: q === 0 ? `港貨物ターミナル、${t.num}列車の出発を許可します。` : `${t.num}列車、臨港線へ進路を開きます。` }); }
    }
    out.sort((a, b) => a.t - b.t);
    return out;
  }

  /* ===== 段4：方針と、自社（グループ会社）の要望（数字は仮） =====
     方針は、指令員の決まりの数字を変えるだけ（接続を待つ上限・入れかえを決める遅れ・回復運転の強さ）。プレイヤーが決めるのは方針だけ。 */
  const POLICY = {
    balance: { name: 'バランス', say: '接続は5分まで待つ。ふつうの指令', connMax: 5, swapMin: 2, recover: 0.03 },
    ontime: { name: '定時重視', say: '遅れを広げない。接続は2分まで・入れかえは早めに・回復運転を強める・要望はことわる', connMax: 2, swapMin: 1.5, recover: 0.05 },
    conn: { name: '接続重視', say: '乗りかえの人を置いていかない。接続は8分まで待つ', connMax: 8, swapMin: 3, recover: 0.03 },
    sales: { name: '売上重視', say: '料金のいる特急・観光特急は待たせず（1.5分まで）、特急からの乗りかえは8分まで待つ。グループ会社の要望を受ける', connMax: 5, swapMin: 2, recover: 0.03, paid: true, paidHold: 1.5, paidWait: 8 },
  };
  REASON.request = { name: '自社の要望', col: '#f29fb5' }; SHORT.request = '要望';
  Object.assign(REASON, { stop: { name: '運転見合わせ', col: '#ff4d4d' }, jam: { name: '先の駅がふさがっている', col: '#ff8f6b' }, furikae: { name: '振替輸送', col: '#ffb14d' }, resume: { name: '運転再開', col: '#6fe08a' }, cancel: { name: '運休', col: '#c0c7d0' } });
  Object.assign(SHORT, { stop: '運転見合わせ', jam: '先がつまる' });
  POLICY.ontime.cancelMin = 12; POLICY.conn.cancelMin = 30;
  /* ===== 段5：大きな事故（数字は仮）。運行日ごとに同じ。env：{day, incidentK, force（訓練：かならず起こす）, ST} =====
     返すもの {name, a, b, t0, t1, dur, tr（事故にあった列車）, i（区間の番号）, f（区間のどのあたり 0〜1）}、起きない日は null */
  const BIGP = 0.1;
  const BIGS = [['人身事故', 35, 55, 'main'], ['架線にビニールがからまった', 20, 35, 'main'], ['車両の故障', 25, 40, 'any'], ['踏切で車が立ち往生', 20, 30, 'main'], ['倒木', 40, 70, 'branch']];
  function bigIncident(trips, env) {
    const R = rng((env.day || 1) * 15485863 + 11), ik = env.incidentK == null ? 1 : env.incidentK, roll = R();
    if (!env.force && roll >= Math.min(0.5, BIGP * ik)) return null;
    const K = BIGS[Math.floor(R() * BIGS.length)];
    const pool = trips.filter(t => !t.synth && t.dep[0] > 400 && t.dep[0] < 1260 && (K[3] !== 'branch' || t.seq.includes('O')));
    if (!pool.length) return null;
    const tr = pool[Math.floor(R() * pool.length)], segs = [];
    for (let i = 0; i < tr.seq.length - 1; i++) { const br = onBranch(tr.seq[i]) || onBranch(tr.seq[i + 1]); if (K[3] === 'any' || (K[3] === 'branch') === br) segs.push(i); }
    if (!segs.length) return null;
    const i = segs[Math.floor(R() * segs.length)], f = 0.3 + 0.4 * R(), t0 = tr.dep[i] + (tr.arr[i + 1] - tr.dep[i]) * f, dur = K[1] + R() * (K[2] - K[1]);
    return { name: K[0], a: tr.seq[i], b: tr.seq[i + 1], t0, t1: t0 + dur, dur, tr, i, f };
  }
  /* その日の要望。env：{ST, TYPES, X, events:[id], holiday, policy}。返すもの [{id, from, ask, act, st, t, ok, why, n, min, hits:[{tr,i,min,txt}], first}] */
  function requests(trips, env) {
    const out = [], pol = env.policy || 'balance';
    for (const r of (env.X.requests || [])) {
      const w = r.when || {};
      if (w.events && !w.events.some(id => (env.events || []).includes(id))) continue;
      if (w.weekday && env.holiday) continue;
      const e = r.effect, hits = [];
      for (const tr of trips) {
        if (tr.synth || (e.types && !e.types.includes(tr.type)) || (e.dir && (e.dir === 'down') !== tr.down)) continue;
        const i = tr.seq.indexOf(e.st); if (i < 0 || i === tr.seq.length - 1) continue;
        const t = i === 0 ? tr.dep[0] : tr.arr[i]; if (t < e.from || t > e.to) continue;
        if (e.kind === 'stop' ? tr.stop[i] : !tr.stop[i]) continue;   /* stop＝通過する列車を臨時に止める／dwell＝止まる列車の停車をのばす */
        hits.push({ tr, i, min: e.min, txt: `${env.ST[e.st].name}で${r.from}の要望（${r.act}）` });
      }
      if (e.first) hits.splice(1);
      const ok = (r.accept || []).includes(pol);
      out.push({ id: r.id, from: r.from, ask: r.ask, act: r.act, st: e.st, t: Math.max(280, e.from - 20), ok, why: `方針「${POLICY[pol].name}」：${ok ? r.whyOk : r.whyNo}`, n: hits.length, min: hits.reduce((a, h) => a + h.min, 0), hits, first: hits[0] ? hits[0].tr : null });
    }
    return out;
  }
  /* フェリーの最終便：その便に乗りつげる、いちばんおそい下りの列車 */
  function boats(trips, env) {
    const F = env.X.ferry, out = [];
    for (const d of F.dep || []) {
      let best = null;
      for (const tr of trips) { if (tr.synth || !tr.down) continue; const i = tr.seq.length - 1; if (tr.seq[i] !== F.st) continue; const at = tr.arr[i]; if (at + F.xfer <= d.t && (!best || at > best.tr.arr[best.i])) best = { tr, i }; }
      if (best) out.push({ t: d.t, tr: best.tr, i: best.i, st: F.st, xfer: F.xfer, max: d.max, label: F.name + ' ' + d.name });
    }
    return out;
  }
  /* 方針をくらべる数字：定時の割合（着・遅れ1分未満）、遅れの合計、接続を待った・打ち切った回数、受けた要望 */
  function policyStats(trips, D2) {
    let n = 0, on = 0, late = 0;
    let can = 0;
    for (const t of trips) { if (t.synth) continue; const a = D2.A.get(t); if (!a) continue; if (a.cancel) { can++; n++; continue; } const l = a.arr[a.arr.length - 1] - t.arr[t.arr.length - 1]; n++; if (l < 1) on++; late += Math.max(0, l); }
    const cnt = k => D2.decisions.filter(k).length;
    return { n, cancel: can, ontime: n ? on / n : 1, late, held: cnt(c => !c.req && !c.boat && c.hold != null), cut: cnt(c => c.k === 'connCut'), swap: cnt(c => c.k === 'swap'), req: cnt(c => c.req && c.req.ok), reqNo: cnt(c => c.req && !c.req.ok) };
  }


  /* ---- 配線の層（2026-11-17）：同じ番線に2本が入らないように、番線を割りふり、入れないときは手前で待たせる ----
     sets：[{trips:[…時刻の順]}]（車庫の編成と、臨時・貨物の編成）。env：{ ST, hs（data/ctc-haisen.json）, onSiding }
     返すもの：Map（元の列車 → 見せる列車〈arr・dep・lanes を持つ〉）と、編成ごとの休み（頭端の駅で次の発車まで長いときは、ホームをあけて車庫・留置線へ）。
     見せ方の層だけ（ゲームの計算・乱れの計算は変えない）。ずらすのは、ふさがっていた分だけ。 */
  const BRSEG = new Set(['K|F', 'F|K', 'F|T', 'T|F', 'T|O', 'O|T']);
  function yard(sets, env) {
    const hs = env.hs, YD = hs.yards || {}, REST = YD.rest || 16, EPS = 0.3, EIN = 0.6, TURN = 2, HW = 1.0;   /* EIN：番線に入る前から、その番線をおさえる分・HW：同じ線路へ続けて出るときの間かく */
    const occ = new Map(), segs = new Map(), single = new Map(), yuse = {}, out = new Map(), rests = new Map(), TH = new Map();
    const key = (s, o) => s + '|' + o, inHs = s => !!(hs.stations && hs.stations[s]);
    const busy = (k, t0, t1, me) => (occ.get(k) || []).find(r => r !== me && r[0] < t1 && t0 < r[1]);
    const put = (k, t0, t1) => { if (!occ.has(k)) occ.set(k, []); const r = [t0, t1]; occ.get(k).push(r); return r; };
    const nextFree = (k, t0, t1) => { let t = t0; const d = t1 - t0; for (let g = 0; g < 60; g++) { const c = busy(k, t, t + d); if (!c) return t; t = c[1] + 0.05; } return t; };
    function pick(tr, i, t0, t1) {
      const s = tr.seq[i], L = prefLanes(tr, i, env);
      for (const o of L) if (!busy(key(s, o), t0, t1)) return { o, wait: 0 };
      let best = null; for (const o of L) { const t = nextFree(key(s, o), t0, t1); if (!best || t < best.t) best = { o, t }; }
      return { o: best.o, wait: best.t - t0 };
    }
    /* その番線のおさえを t1 までのばす。うしろに別の列車のおさえがあれば、その手前まで */
    function extend(k, r, t1) { if (!r) return t1; let lim = Infinity; for (const x of occ.get(k) || []) if (x !== r && x[0] >= r[0] && x[0] < lim) lim = x[0]; r[1] = Math.max(r[1], Math.min(t1, lim - 0.02)); return r[1]; }
    const yardFree = (at, t0, t1) => { const c = (YD[at] && YD[at].cap) || 0; return (yuse[at] || []).filter(r => r[0] < t1 && t0 < r[1]).length < c; };
    /* 頭端の駅（中央・港）ののど：ほかの本線を横切る出発と到着は、同時に動かない */
    const crossMove = (s, o, kind) => s === 'C' ? (kind === 'dep' ? o > 0 : o < 0) : s === 'P' ? (kind === 'arr' ? o > 0 : o < 0) : false;
    const winOf = (t, kind) => kind === 'dep' ? [t - 0.05, t + 0.7] : [t - 0.8, t + 0.05];
    function throat(s, t, o, kind) {
      if ((s !== 'C' && s !== 'P') || o == null) return t; const cx = crossMove(s, o, kind);
      for (let g = 0; g < 20; g++) { const [a, b] = winOf(t, kind), hit = (TH.get(s) || []).find(r => r.kind !== kind && (cx || r.cx) && r.a < b && a < r.b); if (!hit) return t; t = kind === 'dep' ? hit.b + 0.05 : hit.b + 0.85; }
      return t;
    }
    const noteThroat = (s, t, o, kind) => { if ((s !== 'C' && s !== 'P') || o == null) return; const [a, b] = winOf(t, kind); if (!TH.has(s)) TH.set(s, []); TH.get(s).push({ a, b, kind, cx: crossMove(s, o, kind) }); };
    const Q = [];   /* 出発のできごと（時刻の早いものから処理する） */
    function begin(ss, c) {
      const tr = ss.st.trips[ss.k]; if (!tr) return; const n = tr.seq.length, s = tr.seq[0];
      ss.tr = tr; ss.A = tr.arr.slice(); ss.D = tr.dep.slice(); ss.L = new Array(n).fill(null); ss.R = new Array(n).fill(null); ss.i = 0;
      if (c && c.lane != null && c.s === s) { ss.L[0] = c.lane; ss.R[0] = c.rec; ss.D[0] = Math.max(tr.dep[0], c.floor); }   /* 折り返し：着いた番線のまま */
      else if (inHs(s)) {
        const from = c && c.s === s ? c.from : tr.dep[0] - 2.5, floor = c && c.s === s ? c.floor : -1e9;
        const p = pick(tr, 0, from, Math.max(tr.dep[0], from) + EPS); ss.L[0] = p.o; ss.D[0] = Math.max(tr.dep[0] + p.wait, floor);
        ss.R[0] = put(key(s, p.o), from + p.wait, ss.D[0] + EPS); if (p.wait > 0 && c && c.rest) c.rest.t1 += p.wait;   /* ホームがあくまで、車庫・留置線で長く休む */
      } else ss.D[0] = Math.max(tr.dep[0], c && c.floor != null ? c.floor : -1e9);
      Q.push({ t: ss.D[0], ss });
    }
    function finish(ss, plan) {
      const tr = ss.tr, n = tr.seq.length; ss.D[n - 1] = Math.max(ss.D[n - 1], ss.A[n - 1]);
      const cp = Object.create(tr); cp.arr = ss.A; cp.dep = ss.D; cp.lanes = ss.L; cp.yardOf = tr; out.set(tr, cp);
      ss.k++; begin(ss, plan);
    }
    sets.forEach(st => { if (st.trips.length) begin({ st, k: 0 }, null); });
    for (let guard = 0; Q.length && guard < 200000; guard++) {
      let m = 0; for (let q = 1; q < Q.length; q++) if (Q[q].t < Q[m].t) m = q;
      const ss = Q.splice(m, 1)[0].ss, tr = ss.tr, n = tr.seq.length, i = ss.i, s = tr.seq[i], nx = tr.seq[i + 1];
      const run = tr.arr[i + 1] - tr.dep[i], sk = s + '|' + nx, sd = sk + '|' + (tr.down ? 'd' : 'u'), last = i + 1 === n - 1;
      const stopN = last || tr.stop[i + 1], nt = ss.st.trips[ss.k + 1], same = last && nt && nt.seq[0] === nx, at = nx === 'C' || nx === 'P' || nx === 'O' ? nx : null;
      let d = ss.D[i], a = 0, p = null, plan = null, win = null;
      for (let g = 0; g < 12; g++) {
        const d0 = d;
        for (const r of (segs.get(sd) || [])) if (r[0] <= d && d < r[0] + HW) d = r[0] + HW;   /* 前の列車が出てから HW 分は、同じ線路へ出ない */
        if (i === 0) d = throat(s, d, ss.L[0], 'dep');                                     /* 頭端の駅の出口で、入ってくる列車と交差しない */
        if (BRSEG.has(sk)) { const u = [s, nx].sort().join('|'); for (let h = 0; h < 20; h++) { const r = (single.get(u) || []).find(x => x[2] !== tr.down && x[0] < d + run && d < x[1]); if (!r) break; d = r[1] + 0.2; } }   /* 単線：反対の列車が使っているあいだは出ない */
        a = d + run; for (const r of (segs.get(sd) || [])) if (r[0] <= d && a < r[1] + HW) a = r[1] + HW;   /* 前の列車を追いこさない */
        if (inHs(nx)) {
          if (last) {
            a = throat(nx, a, prefLanes(tr, i + 1, env)[0], 'arr');
            const nd = same ? Math.max(nt.dep[0], a + TURN) : a + 3, restOk = same && at && nd - a >= REST && yardFree(at, a + 3, nd - 5);
            win = !same || restOk ? [a - EIN, a + 3] : [a - EIN, nd + EPS]; plan = { nd, rest: !!restOk };
            p = pick(tr, i + 1, win[0], win[1]);
            if (p.wait > 0 && same && !restOk && at && nd - a >= 9 && yardFree(at, a + 3, nd - 5)) { win = [a - EIN, a + 3]; plan.rest = true; p = pick(tr, i + 1, win[0], win[1]); }   /* ホームがあかないときは、短くても休ませる */
          } else { const dn = Math.max(tr.dep[i + 1], a + (stopN ? 0.3 : 0)); win = [a - EIN, dn + EPS]; p = pick(tr, i + 1, win[0], win[1]); }
          if (p.wait > 0) { d += p.wait; continue; }   /* 次の駅の番線があかないときは、いまの駅で待つ */
        }
        if (d === d0) break;
      }
      /* いまの駅の番線のおさえをのばす（うしろの列車のおさえの手前まで） */
      if (ss.R[i]) { const lim = extend(key(s, ss.L[i]), ss.R[i], d + EPS) - EPS; if (lim < d) d = Math.max(ss.D[i], lim); }   /* うしろの列車のために、いまの番線はあける（次の駅へはゆっくり進み、着く時刻はそのまま） */
      ss.D[i] = d; ss.A[i + 1] = a;
      if (env.log) env.log({ num: tr.num, at: nx, d, a, lane: p && p.o, win, busyNow: p ? (occ.get(key(nx, p.o)) || []).map(r => r.slice()) : null });   /* 確かめ用 */
      if (!segs.has(sd)) segs.set(sd, []); segs.get(sd).push([d, a]);
      if (BRSEG.has(sk)) { const u = [s, nx].sort().join('|'); if (!single.has(u)) single.set(u, []); single.get(u).push([d, a, tr.down]); }
      if (i === 0) noteThroat(s, d, ss.L[0], 'dep');
      ss.i = i + 1;
      if (!inHs(nx)) { ss.D[i + 1] = Math.max(tr.dep[i + 1], a + (stopN && !last ? 0.3 : 0)); if (last) { finish(ss, null); continue; } Q.push({ t: ss.D[i + 1], ss }); continue; }
      const o = p.o; ss.L[i + 1] = o;
      if (!last) { const dn = Math.max(tr.dep[i + 1], a + (stopN ? 0.3 : 0)); ss.D[i + 1] = dn; ss.R[i + 1] = put(key(nx, o), a - EIN, dn + EPS); Q.push({ t: dn, ss }); continue; }
      /* 終点 */
      noteThroat(nx, a, o, 'arr');
      const nd = same ? Math.max(nt.dep[0], a + TURN) : a + 3;
      if (!same) { put(key(nx, o), a - EIN, a + 3); finish(ss, nt ? { s: nt.seq[0], lane: null, from: nt.dep[0] - 2.5, floor: a + TURN } : null); continue; }
      if (plan.rest) {
        put(key(nx, o), a - EIN, a + 3); (yuse[at] = yuse[at] || []).push([a + 3, nd - 5]);
        const rr = { at, t0: a + 3, t1: nd - 5, after: tr }; if (!rests.has(ss.st)) rests.set(ss.st, []); rests.get(ss.st).push(rr);
        finish(ss, { s: nx, lane: null, from: nd - 5, floor: nd, rest: rr }); continue;
      }
      finish(ss, { s: nx, lane: o, floor: nd, rec: put(key(nx, o), a - EIN, nd + EPS) });
    }
    return { map: out, rests };
  }

  /* 実際の発着をもった列車（元の列車をうけつぐ。パネルの位置・札に使う） */
  function actual(tr, D2) { const a = D2.A.get(tr); if (!a) return tr; const p = Object.create(tr); p.arr = a.arr; p.dep = a.dep; p.base = tr; p.why = a.why; p.cancel = !!a.cancel; return p; }

  /* 編成がいま車庫にいるか */
  const inDepot = (s, T) => T < s.first - 8 || T > s.last + 9;

  const api = { LINK, GEO, YK5, YK6, yard, prefLanes, frontOff, LCODE, bigIncident, POLICY, requests, boats, policyStats, SYN_TYPES, extST, buildReg, fitTrip, synth, fee, synOnSiding, synDwell, synLate, extConns, synHighlights, LANES, SIGBOX, SHORT, Y, MAIN, BR, TYPE_COL, TYPE_BODY, REASON, RULE, disrupt, actual, layout, laneOff, trackNo, trainPos, reasons, highlights, inDepot, fmtMin, smooth };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CtcCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
