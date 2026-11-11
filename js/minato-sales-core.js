/* =====================================================================
   港駅の売店：きょう売れたもの（棚 × 時間）の計算（2026-11-11・ユーザーの頼み）
   ・計算の結果（KioskCore.simulate の res.ev の buy）を、棚（店の場所）と時台ごとに数えるだけ。計算の結果は変えない。
   ・「いつも」＝同じ型の日（平日・土曜・日曜祝日）の最近 n 日の平均。「きのう」＝前の運行日。どちらも「同じ時刻まで」で比べる。
   ・1日の記録（dayRec）は小さく：{v:1, day, kind, g:{棚:{時:個}}}。保存は画面（js/minato-sales-view.js）が dia-minato-sales に。
   ・DOM もゲーム本体の変数も使わない（node のテストで確かめられる）。
   ===================================================================== */
(function(root){
'use strict';
/* 棚の名前と並び（店の見取り図 MinatoAnim.MAP.fx の場所の名前と同じ） */
const ZONES=[['fridge','冷蔵ケース'],['shelf','おにぎり・パンの棚'],['dry','乾物・おやつ'],['regfront','レジ前の棚'],['omiyage','おみやげ'],
  ['hot','ホット'],['warmer','ホット飲料'],['tobacco','たばこ'],['rack','新聞'],['hook','日用品'],['umbrella','傘'],['other','そのほか']];
const NAME=Object.fromEntries(ZONES);
/* 品 → 棚。棚にない品は、ホット・たばこはレジの場所、それ以外は「そのほか」 */
function zoneMap(cfg,layout){const m={},P={};for(const p of cfg.products)P[p.id]=p;
  for(const zk in layout)(layout[zk]||[]).forEach(pid=>{if(pid&&!m[pid])m[pid]=zk;});
  return pid=>m[pid]||(P[pid]&&P[pid].genre==='hot'?'hot':P[pid]&&P[pid].genre==='tobacco'?'tobacco':'other');}
const add=(o,z,h,q)=>{const r=o[z]||(o[z]={});r[h]=(r[h]||0)+q;};
/* 時刻 T（分）までに売れたもの：g 棚×時台の個数、items 棚ごとの品の個数、n 会計の数、yen 売上、total 個数 */
function soFar(res,cfg,layout,T){const zo=zoneMap(cfg,layout),g={},items={};let n=0,yen=0,total=0;
  for(const e of res.ev){if(e.t>T)break;if(e.k!=='buy')continue;n++;yen+=e.yen||0;const h=Math.floor(e.t/60);
    for(const [pid,q] of e.items){const z=zo(pid);add(g,z,h,q);add(items,z,pid,q);total+=q;}}
  return {g,items,n,yen,total};}
/* 1日の記録（閉店のあとに1回） */
function dayRec(res,cfg,layout){const s=soFar(res,cfg,layout,Infinity);return {v:1,day:res.day,kind:res.cond&&res.cond.day||'wd',g:s.g,n:s.n,total:s.total};}
/* くらべる相手：mode 'usual'（同じ型の日の最近 n 日の平均。min 日そろわなければ null）か 'yday'（前の運行日。なければ null） */
function base(days,o){const L=(days||[]).filter(d=>d&&d.v===1&&d.day<o.day);
  if(o.mode==='yday'){const y=L.find(d=>d.day===o.day-1);return y?{g:y.g,n:1,kind:y.kind,days:[y.day]}:null;}
  const S=L.filter(d=>d.kind===o.kind).sort((a,b)=>b.day-a.day).slice(0,o.n||4);if(S.length<(o.min||2))return null;
  const g={};for(const d of S)for(const z in d.g)for(const h in d.g[z])add(g,z,+h,d.g[z][h]/S.length);
  return {g,n:S.length,kind:o.kind,days:S.map(d=>d.day)};}
/* 相手の数を「同じ時刻まで」に：T の時台は、その時台の何分まで来たかの割合をかける */
function upTo(bg,z,h,T){const v=(bg[z]&&bg[z][h])||0,H=Math.floor(T/60);return h<H?v:h===H?v*((T%60)/60):0;}
/* いつもとの差の判定：-3〜3（0＝同じくらい）。少ない数の ±1 は同じくらい（数のばらつきで割る） */
function judge(v,u){if(v===0&&u<0.5)return 0;const z=(v-u)/Math.sqrt(u+1);if(Math.abs(z)<1.2)return 0;return Math.sign(z)*Math.min(3,1+Math.floor((Math.abs(z)-1.2)/0.9));}
root.MinatoSalesCore={ZONES,NAME,zoneMap,soFar,dayRec,base,upTo,judge};
})(typeof window!=='undefined'?window:globalThis);
