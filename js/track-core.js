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
  if(S('pack')){const m=o.slip&&o.slip.store;S('pack').note=o.slip&&o.slip.no?(m?`納品書 ${o.slip.no}：出荷 ${sum(Object.fromEntries(Object.entries(m.items).map(([k,a])=>[k,a[1]+(a[2]||0)])))}/${sum(Object.fromEntries(Object.entries(m.items).map(([k,a])=>[k,a[0]])))}${m.short&&m.short.q>0?`・${m.short.n}品で${m.short.q}個足りない（その分は届かない）`:'・そろった'}${o.slip.late&&o.slip.late.mode==='wait'?`・工場が${o.slip.late.wait}分遅れ、トラックが待った`:''}${o.slip.late&&o.slip.late.mode==='chase'?`・あとからできた分は追いかけ便で${o.slip.late.bin}へ`:''}`:`納品書 ${o.slip.no}`):'';}
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

/* ---------- 取引先の分（取引の相談窓口の契約・第5回・2026-11-12。docs/deals-plan.md） ----------
   契約1つの、その運行日の荷物の流れ。数は dia-orders（deal・slip.deals・haul）と、配送会社の便の計算（HaisoCore.dayPlan から契約ごとの着いた時刻）で
   もう決まったものを、呼ぶ側（js/kiosk-view.js の minatoKiosk.dealTrack）が集めて渡す。ここでは時刻の順に並べるだけ（数を計算し直さない）。
   o={id, kind:'sell'|'haul', name, fixAt（前の日の確定の時刻・分。data/deals.json の fixAt）,
      sell：line, lineName, hand:'pickup'|'via'|'deliver', handT, st, q（頼まれた数）, s（届けた数・納品書の前は null）, slip（納品書の番号）
      haul：carts, from, cargo, other（自社で運べない・港浜急送）
      どちらも：to（駅）, toName, w:[はば], bin（積む便）, arr（着いた・着く時刻・便の計算から）, late（はばの終わりからの遅れ・分）, help（応援便）, miss（便にのらなかった）}
   返すもの：{id, kind, name, steps:[{id,t,place,label,note}], end（終わりの時刻）, w, late, miss, est（着く時刻が目安）} */
function dealTimeline(ccfg,o){const F=ccfg.flow||{},K=ccfg.track||{},D=K.deal||{},S0=K.steps||[],at=id=>{const s=S0.find(x=>x.id===id);return s?stepT(s.t):null;};
  const steps=[],add=(id,t,place,label,note)=>{if(t!=null)steps.push({id,t,place,label,note:note||''});};
  const run=(F.runs||[]).find(r=>r.bin===o.bin)||null,dep=run?runT(run.depart):null,tr=o.to?truck(ccfg,o.to):null,hd=15;
  const fixT=(o.fixAt??1080)-1440,wTxt=o.w?`${fmt(o.w[0])}〜${fmt(o.w[1])}`:'';
  let arr=o.arr,est=false;if(arr==null&&dep!=null&&!o.other&&!o.miss){arr=dep+(tr?tr.min:0)+hd*2;est=true;}if(arr==null&&o.miss&&o.w)arr=o.w[1];   /* 便にのらなかった日は、はばの終わりで「届けられなかった」 */   /* 便の計算がないとき（目安）：出発＋駅までの分＋積みおろし2回（窓口の便の選び方と同じ） */
  const arrNote=()=>o.miss?'この日の便にのらなかった（届けられない）':`はば ${wTxt}${o.late>0?`・${o.late}分遅れ`:arr!=null&&o.w&&arr<=o.w[1]?'・間に合う':''}${o.help?'・かご車があふれた分は港浜急送の応援便':''}${est?'・時刻は目安':''}`;
  if(o.kind==='sell'){
    add('fix',fixT,'窓口',`${o.name}の注文の数が確定`,`${o.lineName||''} ${o.q||0}個（契約の数のまわりで少しゆれる）`);
    add('add',at('fix'),'工場','工場の注文に足した','センターの発注とは別の行（取引先・契約）');
    add('make',at('make'),'工場',`製造中（${o.lineName||'ライン'}）`,'人・材料・機械の時間は、自社の店の分といっしょに');
    add('pack',at('pack'),'工場','包装の締め切り・検品',o.s==null?'届ける数は納品書で決まる':o.s<o.q?`出荷 ${o.s}/${o.q}・${o.q-o.s}個足りない（足りない夜は自社の店が先）`:`出荷 ${o.s}/${o.q}・そろった`);
    if(o.hand==='pickup')add('end',o.handT,'工場',`${o.name}が工場へ取りに来る`,'ここで受け渡し');
    else if(o.hand==='via')add('end',o.handT,'工場','問屋の便が工場を出る','ここから先は問屋の便');
    else if(o.bin&&dep!=null){add('go1',at('go1'),'道','工場を出る（センターへ）','自社の店の品と同じトラック');
      add('ctr',at('ctr'),'センター','センターで仕分け',`${o.bin}にのせる`);
      add('dep',dep,'道',`${o.bin}が出発`,`${tr?tr.name:'トラック'}・自社の店をぜんぶ回ったあとに寄る`);
      add('end',arr,o.toName||'',`${o.name}に着く`,arrNote());}
    else add('end',o.handT,o.toName||'','港浜急送が届ける','自社の便につないでいないとき（費用は工場）');}
  else{
    add('fix',fixT,'窓口',`${o.name}の荷物の量が確定`,`かご車 ${o.carts}台${o.cargo?`・${o.cargo}`:''}`);
    if(o.other){const t0=o.w?o.w[0]-(D.other??90):null;add('load',t0,o.from||'','港浜急送が積む','自社の2トントラックでは運べない荷物（費用は配送会社）');
      add('end',o.w?o.w[1]:null,o.toName||'',`${o.toName||''}に着く（港浜急送）`,`はば ${wTxt}・時刻は港浜急送まかせ（目安）`);est=true;}
    else{add('load',dep!=null?dep-(D.load??30):null,o.from||'','荷物を積む',/センター/.test(o.from||'')?'荷主が持ち込み、センターで仕分け（仕分け料）':'となりの倉庫から');
      add('dep',dep,'道',`${o.bin||'便'}が出発`,`${tr?tr.name:'トラック'}・自社の店をぜんぶ回ったあとに寄る`);
      add('end',arr,o.toName||'',`${o.toName||''}に着く`,arrNote());}}
  steps.sort((a,b)=>a.t-b.t);const last=steps[steps.length-1];
  return {id:o.id,kind:o.kind,name:o.name,steps,end:last?last.t:null,w:o.w||null,late:o.late||0,miss:!!o.miss,est};}
/* いまどこか：now＝その運行日の0:00からの分。{i（いまの工程・−1＝まだ）, label, place, done, next（次の工程の時刻）} */
function dealWhere(tl,now){const S=tl.steps;if(!S.length)return {i:-1,label:'—',place:'',done:false,next:null};
  if(now<S[0].t)return {i:-1,label:'まだ数が決まる前',place:'',done:false,next:S[0].t};
  const L=S.length-1;if(now>=S[L].t)return {i:L,label:tl.miss?'届けられなかった':'受け渡しが済んだ',place:S[L].place,done:true,next:null};
  let i=0;for(let k=0;k<S.length;k++)if(S[k].t<=now)i=k;
  return {i,label:S[i].label,place:S[i].place,done:false,next:S[i+1].t};}

root.TrackCore={fmt,stepT,runT,truck,timeline,phases,where,shelfTimes,dealTimeline,dealWhere};
if(typeof module!=='undefined')module.exports=root.TrackCore;
})(typeof window!=='undefined'?window:globalThis);
