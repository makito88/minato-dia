/* =====================================================================
   注文を追いかける（アイデア帳 6.・発注と配送の「どこにあるか見えるアプリ」第1段・2026-11-08）
   ・dia-orders の記録（売上の記録 → センターの発注 → 工場への発注 → 製造 → 納品書 → 到着）を、注文番号ごとに時刻の順に並べる。
   ・時刻は data/center.json の flow（包装の締め切り・工場の出発・センター着・便の出発）と track（そのほかの時刻・すべて仮）、
     トラックの所要時間は slip.trucks、棚に並ぶ時刻は flow.runs の t（＝ data/kiosk.json の deliveries）。
   ・時刻は「その運行日の0:00からの分」にそろえる（前の日の夜はマイナス、例：前日19:00＝−300）。
   ・ここは計算だけ（DOM も localStorage も使わない。node でも読める）。画面は js/kiosk-view.js の「荷物の行方」タブ。
   ===================================================================== */
(function(root){
'use strict';
const pad=n=>String(n).padStart(2,'0');
/* 設定の時刻 → その運行日の0:00からの分。夜の工程（track.steps）は前の日の夜〜その日の朝なので、いつも −1440 */
const stepT=t=>t-1440;
/* 便の時刻：1440 をこえる値は夜中（その日の朝）、それより小さい値はその日の時刻 */
const runT=t=>t>=1440?t-1440:t;
/* 表示：前日19:00・2:30・翌日5:30 */
function fmt(t){const d=Math.floor(t/1440),m=((Math.round(t)%1440)+1440)%1440;return (d<0?'前日':d>0?'翌日':'')+Math.floor(m/60)+':'+pad(m%60);}
function truck(ccfg,key){const st=String(key).split('-')[0],T=(ccfg.slip&&ccfg.slip.trucks)||[];const t=T.find(x=>(x.st||[]).includes(st));return t?{id:t.id,name:t.name,min:(t.min&&t.min[st])||0}:null;}
const sum=o=>Object.values(o||{}).reduce((a,b)=>a+(+b||0),0);

/* 1つの注文（その運行日・その店）の流れ。
   o={day, key, order:{no,factory,center,direct}|null（dia-orders の orders[店]）, est:真なら見込み（まだ数が決まっていない）,
      fix:{no}|null（工場への発注 F…）, slip:{no, at, store:{no,items,short}}|null（納品書と、この店の分）,
      runs:[{f:{品:数}, c:数, d:数, cut:{品:数}|null}]（flow.runs と同じ並び。届いた・届く数）, genreOf:pid→ジャンル}
   返すもの：{no, day, truck, steps:[{id,t,place,label,text,note}], runs:[{bin,depart,arrive,soon,shelf,f,c,d,cut,n}], lines:{ライン:数}} */
function timeline(ccfg,o){const F=ccfg.flow||{},K=ccfg.track||{},tr=truck(ccfg,o.key),R=K.run||{},gOf=o.genreOf||(()=>null);
  const ord=o.order||{},fac=ord.factory||{},lines={};
  for(const pid in fac){const g=gOf(pid)||'?';lines[g]=(lines[g]||0)+fac[pid];}
  const steps=(K.steps||[]).map(s=>({id:s.id,t:stepT(s.t),place:s.place,label:s.label,text:s.text,note:''}));
  const S=id=>steps.find(s=>s.id===id);
  // 記録の番号と数を、それぞれの工程に書き添える
  if(S('sum'))S('sum').note=ord.no?`注文番号 ${ord.no}（工場の品${sum(fac)}・センター在庫${sum(ord.center)}・直送${sum(ord.direct)}）${o.est?'・いまは見込み（数は運行日の初めに決まる）':''}`:'';
  if(S('fix'))S('fix').note=o.fix&&o.fix.no?`工場への発注 ${o.fix.no}（全店の合計）`:'';
  if(S('make'))S('make').note=Object.keys(lines).map(g=>`${(K.lines||{})[g]||g} ${lines[g]}`).join('・');
  if(S('pack')){const m=o.slip&&o.slip.store;S('pack').note=o.slip&&o.slip.no?(m?`納品書 ${o.slip.no}：出荷 ${sum(Object.fromEntries(Object.entries(m.items).map(([k,a])=>[k,a[1]])))}/${sum(Object.fromEntries(Object.entries(m.items).map(([k,a])=>[k,a[0]])))}${m.short&&m.short.q>0?`・${m.short.n}品で${m.short.q}個足りない（その分は届かない）`:'・そろった'}`:`納品書 ${o.slip.no}`):'';}
  if(S('ctr'))S('ctr').note=F.center&&F.center.sort||'';
  const runs=(F.runs||[]).map((r,i)=>{const x=(o.runs||[])[i]||{},dep=runT(r.depart),arr=dep+(tr?tr.min:0)+(x.late||0);   // late：トラックの遅れ（分）
    return {bin:r.bin,depart:dep,arrive:arr,late:x.late||0,soon:Math.max(dep,arr-(R.soon??10)),shelf:Math.max(runT(r.t),arr),f:x.f||{},c:x.c||0,d:x.d||0,cut:x.cut||null,n:sum(x.f)+(x.c||0)+(x.d||0),hold:i>0?(F.center&&F.center.hold||''):''};});
  return {no:ord.no||null,day:o.day,key:o.key,truck:tr,est:!!o.est,steps,runs,lines,sortEnd:F.center?runT(F.center.sortEnd):null};}

/* いまどこか（店員から見る）。now＝その運行日の0:00からの分。
   返すもの：{label, place, from, to, run（便の番号・なければ −1）, eta（店に着く）, shelf（棚に並ぶ）, done, list（工程の一覧）} */
function phases(tl){const P=[],st=tl.steps,T=id=>{const s=st.find(x=>x.id===id);return s?s.t:null;};
  const add=(from,to,label,place,run)=>{if(from!=null&&to!=null&&to>=from)P.push({from,to,label,place,run:run??-1});};
  add(T('rec'),T('sum'),'売上の記録を送った','売店');
  add(T('sum'),T('fix'),'注文受付','センター');
  add(T('make'),T('pack'),'製造中','工場');
  add(T('pack'),T('load'),'包装・検品','工場');
  add(T('load'),T('go1'),'積み込み','工場');
  add(T('go1'),T('ctr'),'配送中（工場→センター）','道');
  const r0=tl.runs[0];add(T('ctr'),tl.sortEnd!=null?tl.sortEnd:r0&&r0.depart,'センターで仕分け','センター');
  let prev=tl.sortEnd;
  tl.runs.forEach((r,i)=>{if(!r.n&&i>0)return;
    if(prev!=null&&r.depart>prev)add(prev,r.depart,'センターの部屋で待つ','センター',i);
    add(r.depart,r.soon,'配送中（センター→売店）','道',i);add(r.soon,r.arrive,'もうすぐ到着','道',i);
    add(r.arrive,r.shelf,'売店に到着・品出し','売店',i);prev=r.shelf;});
  return P;}
function where(tl,now){const P=phases(tl),R=tl.runs.filter(r=>r.n||r===tl.runs[0]);
  const last=R.length?R[R.length-1].shelf:null;
  if(!P.length)return {label:'—',place:'',done:false,run:-1,list:P};
  if(now<P[0].from)return {label:'まだ注文の前',place:'売店',from:null,to:P[0].from,run:-1,eta:R[0]&&R[0].arrive,shelf:R[0]&&R[0].shelf,done:false,list:P};
  if(last!=null&&now>=last)return {label:'全部の便が届いた',place:'売店',run:tl.runs.length-1,done:true,list:P};
  // 便の棚の時刻をすぎたら、その便は届いた（次の便を見る）
  let cur=null;for(const p of P)if(p.from<=now)cur=p;
  const next=tl.runs.find((r,i)=>(r.n||i===0)&&now<r.shelf);
  const shelved=tl.runs.filter((r,i)=>(r.n||i===0)&&now>=r.shelf).map(r=>r.bin);
  return {label:cur.label,place:cur.place,from:cur.from,to:cur.to,run:cur.run,eta:next&&next.arrive,shelf:next&&next.shelf,nextBin:next&&next.bin,shelved,done:false,list:P};}

/* お客さんから見る：この品が次に棚に並ぶ時刻。
   o={genre, now（きょうの0:00からの分）, today:[{t,q}]（きょうの便でこの品が届く数）, tomorrowQ（あすの発注の数・わからなければ null）, deliveries（data/kiosk.json）}
   返すもの：[{day:0|1, t, q|null, bin}]（近い順・あすは朝の便からこの品をのせる便だけ） */
function shelfTimes(o){const out=[],D=o.deliveries||[];
  for(const x of o.today||[])if(x.t>o.now&&x.q>0)out.push({day:0,t:x.t,q:x.q,bin:x.bin||''});
  const carry=D.filter(d=>d.all||(d.genres||[]).includes(o.genre));
  carry.forEach((d,i)=>out.push({day:1,t:d.t,q:i===0?o.tomorrowQ??null:null,bin:d.name}));
  return out;}

root.TrackCore={fmt,stepT,runT,truck,timeline,phases,where,shelfTimes};
if(typeof module!=='undefined')module.exports=root.TrackCore;
})(typeof window!=='undefined'?window:globalThis);
