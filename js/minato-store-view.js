/* =====================================================================
   港駅の売店（みなとスタンド 港駅改札前店）の画面（港駅の売店をつくる回の3回目・2026-11-10）
   ・売店の画面（js/kiosk-view.js）の「港駅の店」を選んだときだけ使う。売店の画面のキャンバスに、斜め上から見た店の中を描く。
   ・計算は KioskCore.simulate（歩く店は js/kiosk-walk.js）。設定は js/minato-store-core.js が作る。人の動きの段取りは js/minato-store-anim.js。
     ここは「店を出す・その日の計算を受け取る・運行日の終わりに締める・描く」だけ。描くために出来事を足さない。
   ・保存のキーは 'dia-kiosk-minato'（{v:1,...}。緑ヶ丘の店の 'dia-kiosk' とは別）。
   ・まだつないでいないもの（未接続）：センターのおまかせ発注・配送会社の便・お金の流れ・アンケートの橋。発注は店の数（はじめの数）のまま。
   ・軽さ：店の床と棚は1回だけ描いて使い回す（品の量の層は10秒に1回）。人の絵は客層ごとに作っておいた小さな絵。
     同時に描く人は40人まで（こえた分は点）。売店の画面を閉じているときは描かない（計算と締めは1秒に1回の見回りで続く）。
   ===================================================================== */
(function(){
'use strict';
if(typeof KioskCore==='undefined'||typeof MinatoStore==='undefined'||typeof MinatoAnim==='undefined')return;
const KC=KioskCore,MS=MinatoStore,A=MinatoAnim,KS=window.KioskStaff,MAP=A.MAP;
const g=(f,d)=>{try{return f();}catch(e){return d;}};
const gT=()=>{let m=((Date.now()/60000+540)%1440+1440)%1440;if(m<270)m+=1440;return Math.min(m,1560);},gD=()=>g(()=>D,null),gDay=()=>g(()=>ENS.day,1),gCond=()=>g(()=>COND,{day:'wd',wx:'sun',season:'aut',evs:[]});
const fmtT=t=>g(()=>fmt(t),'');
const yen=n=>(n<0?'−':'')+'¥'+Math.round(Math.abs(n)).toLocaleString('ja-JP');
const num=n=>Math.round(n).toLocaleString('ja-JP');
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);
const DAYN={wd:'平日',sat:'土曜',hol:'日曜・祝日'},WXN={sun:'晴れ',cld:'くもり',rain:'雨',snow:'大雪'};
const V={K:null,M:null,R:null,cfg:null,st:null,err:null,res:null,resKey:'',resD:null,lastDay:null,acts:null,actsRes:null,bg:null,shelf:null,shelfK:'',half:'reg',spr:{},cap:40};

{const st=document.createElement('style');st.textContent='.ms-leg{display:flex;flex-wrap:wrap;gap:4px 12px;margin-top:6px;font-size:12px;color:var(--muted)}.ms-leg i{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:4px;vertical-align:-1px}.ms-half{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.ms-half[hidden]{display:none}.ks-which{display:flex;flex-wrap:wrap;gap:6px}.ks-which[hidden]{display:none}';document.head.appendChild(st);}
/* ---------- 読み込み・保存 ---------- */
const getJ=u=>fetch(u).then(r=>{if(!r.ok)throw new Error(u+': HTTP '+r.status);return r.json();});
Promise.all([getJ('data/kiosk.json'),getJ(MS.URL),getJ('data/research.json'),getJ('data/links.json?v=20261110g').catch(()=>null),getJ('data/factory.json?v=20261110g').catch(()=>null),getJ('data/haiso.json?v=20261110g').catch(()=>null)]).then(([K,M,R,L,FJ,HJ])=>{V.K=K;V.M=M;V.R=R;V.L=L;V.FJ=FJ;V.HJ=HJ;V.cfg=MS.cfg(K,M);
  try{const s=JSON.parse(localStorage.getItem(MS.KEY)||'null');if(s&&s.v===1){for(const z in V.cfg.layout)if(!s.layout[z]){s.layout=JSON.parse(JSON.stringify(V.cfg.layout));break;}V.st=s;}   /* 棚の場所が増えたとき（2026-11-10 の乾物・おやつの棚）は、新しい棚割りにする */}catch(e){}V.lastDay=gDay();refresh();}).catch(e=>{V.err=String(e.message||e);refresh();});
function persist(){try{localStorage.setItem(MS.KEY,JSON.stringify(V.st));}catch(e){}}
const refresh=()=>g(()=>window.minatoKiosk&&minatoKiosk.refresh&&minatoKiosk.refresh());

/* ---------- その日の計算 ---------- */
function ctxNow(){const d=gD(),S=V.st;if(!d||!d.sim||!S)return null;const s=d.sim.stat[S.st];if(!s)return null;
  let stops;if(V.stopsD===d)stops=V.stops;else{stops=new Array(KC.H).fill(0);for(const t of d.trips){const i=t.seq.indexOf(S.st);if(i>=0&&t.stop[i])stops[Math.min(KC.H-1,Math.floor(t.arr[i]/60))]++;}V.stops=stops;V.stopsD=d;}
  const c=gCond(),day=gDay(),ge=g(()=>seasKioskGenre(S.st),null);
  return {day,dow:day%7,cond:{day:c.day,wx:c.wx,season:c.season},flows:{hb:s.hb,ha:s.ha},stops,plats:g(()=>ST[S.st].plats,2)||2,rcfg:V.R,order:S.order,express:[],addOn:[],edits:[],startT:S.openedDay===day?S.openedT:0,
    fx:ge?SeasonCore.mergeFx(undefined,ge):undefined,local:localNow(S,day),sameday:samedayNow(S,day,c),cruise:g(()=>SEAS.portPlan?SEAS.portPlan.cruise:undefined,undefined)};}
/* 橋：工場 → 売店（できたての便・js/links/factory-to-kiosk-sameday.js）。前の夜の発注と、運行日の始めの天気だけから決まる（同じ日なら同じ） */
function samedayNow(S,day,c){if(!window.FactoryToKioskSameday||!V.L||!V.FJ||!V.HJ)return undefined;const k=day+'|'+c.wx;if(V.sdK===S&&V.sdKey===k)return V.sd;
  V.sd=g(()=>FactoryToKioskSameday.plan(V.L,{F:V.FJ,H:V.HJ,M:V.M},S,{day,cond:{wx:c.wx}}),null)||undefined;V.sdK=S;V.sdKey=k;return V.sd;}
/* 橋：地元のお店 → 売店（js/links/local-to-kiosk.js）。前の夜の締めのあとの店の状態だけから、その日に届く数を決める（同じ日なら同じ） */
function localNow(S,day){if(!window.LocalToKiosk||!V.L)return undefined;if(V.localK===S&&V.localDay===day)return V.local;
  V.local=g(()=>LocalToKiosk.plan(V.L,V.M,S,{day}),null)||undefined;V.localK=S;V.localDay=day;return V.local;}
function checkDay(){const day=gDay();if(V.lastDay==null)V.lastDay=day;if(day===V.lastDay)return;
  if(day>V.lastDay&&V.res&&V.res.day===V.lastDay)closeToday(V.res);   // 日が進んだら、まず前の日の結果で締める（緑ヶ丘の店と同じ）
  if(day<V.lastDay){V.st.closed=day-1;persist();}V.lastDay=day;V.res=null;}
function ensureRes(){if(!V.st||!V.cfg)return null;checkDay();const c=ctxNow();if(!c)return V.res;
  const k=c.day+'|'+c.cond.day+c.cond.wx+c.cond.season+'|'+(gD()&&gD().trips.length)+'|'+c.startT+'|'+(c.fx?JSON.stringify(c.fx):'')+'|'+(c.sameday?c.sameday.arrive:'')+'|'+(c.cruise?c.cruise.pax:'');
  if(V.res&&V.resKey===k&&V.resD===gD())return V.res;
  V.res=KC.simulate(V.cfg,V.st,c);V.resKey=k;V.resD=gD();return V.res;}
function closeToday(res){const r=KC.closeDay(V.cfg,V.st,res,{});const lc=V.localDay===res.day?V.local:null;V.st=r.state;
  if(lc)for(const x of lc.say)V.st.news.push({day:res.day,kind:'local',title:x.name+'（'+x.person+'）',text:'「'+x.text+'」'});   /* 便り：地元のお店の人のひとこと */
  V.st.today=null;V.st.unread=(V.st.unread||0)+r.news.length;persist();}
function tick(){if(V.cfg&&V.st)ensureRes();}
setInterval(tick,1000);

/* ---------- 店を出す ---------- */
function openStore(){const day=gDay(),st=MS.create(V.K,V.M,KC,{seed:(Date.now()%100000)+1,day,staff:2});
  if(KS)KS.migrate(V.cfg,st);st.openedT=gT();st.openedDay=day;st.unread=0;
  st.news.push({day,kind:'open',title:'港駅・改札口の前に「港の店」を開いた',text:'中に入って歩く店です。レジは有人1台とセルフ1台、イートインは立ち席6と座れる席4。発注は、はじめの数のままです（センターのおまかせ・配送会社の便・お金の流れには、まだつないでいません）。ワッフルとへしこは、地元のお店（ハーフェン堂・汐見屋）が自分で届けます。'});
  V.st=st;V.res=null;V.lastDay=day;persist();refresh();}

/* ---------- 売店の画面の上の欄 ---------- */
const PSN=()=>{const o={};for(const p of V.cfg.personas)o[p.id]=p;return o;};
function render(o){const {top,kpi,title,sub}=o;title.textContent=V.M?V.M.store.name:'港駅の店';
  if(!V.cfg){top.innerHTML=`<div class="ks-card"><p>${V.err?'港駅の店の設定を読み込めませんでした（'+esc(V.err)+'）':'準備しています…'}</p></div>`;sub.textContent='';kpi.innerHTML='';return;}
  const W=V.cfg.walk,M=V.M;
  if(!V.st){sub.textContent='まだ出していません';kpi.innerHTML='';
    top.innerHTML=`<div class="ks-card"><h3><span>港駅・改札口の前に、2つ目の店を出す</span><small>みなとスタンド（緑ヶ丘の店とは別の店）</small></h3>
      <p class="ks-note">お客さんが<b>中に入って歩く店</b>です。入口 → 冷蔵ケース → おにぎりの低い棚 → 床の印のところで並ぶ → レジ（有人1台＋セルフ1台）→ 出口。おみやげは奥の角、乾物・おやつは低い棚のとなり、イートインは立ち席${W.eatIn.stand??W.eatIn.seats}${W.eatIn.sit?'＋座れる席'+W.eatIn.sit:''}（レンジ・お湯）。品は${V.cfg.products.length}品。開店は${M.store.open[0]}時〜${Math.floor(M.store.open[1])}時半（仮）。</p>
      <p class="ks-note">港で働く人の交代（6・14・22時）の前後に、作業着の人が早足で来ます。発注は、はじめの数のままです。<b>センターのおまかせ・配送会社の便・お金の流れには、まだつないでいません</b>（あとの回で）。</p>
      <button type="button" class="ks-btn pri" id="msOpen">港駅・改札口の前に「港の店」を出す</button></div>`;
    top.querySelector('#msOpen').onclick=openStore;return;}
  const S=V.st,c=gCond();sub.textContent=`運行日${gDay()}（開店${gDay()-S.openedDay+1}日目）・${DAYN[c.day]||''}・${WXN[c.wx]||''}・歩く店・有人1＋セルフ1`;
  const P=PSN(),ps=['shf','salM','salF','stu','jk','sen','tou','hou','fam','cpl','frd'].filter(k=>P[k]);
  const h=`<div class="ks-card ms-top"><p class="ks-note" style="margin:0">斜め上から見た店の中です。人は、売店の計算で起きた出来事（買った・見て帰った・列で帰った・セルフで迷った・イートイン）を時刻の順に描いたものです。
    <span class="ks-lst">未接続</span> センターのおまかせ・センターからの配送会社の便・お金の流れ（発注は、はじめの数のまま）</p><div id="msLocal"></div>
    <div class="ms-leg">${ps.map(k=>`<span><i style="background:${P[k].icon}"></i>${esc(P[k].short)}</span>`).join('')}</div>
    <div class="ms-half"><button type="button" class="ks-chip" data-fan="1" aria-pressed="${!!V.fan}">見える範囲（防犯）</button></div><div class="ms-half" ${innerWidth<760?'':'hidden'}><button type="button" class="ks-chip" data-h="reg" aria-pressed="${V.half==='reg'}">レジ側を大きく</button><button type="button" class="ks-chip" data-h="ent" aria-pressed="${V.half==='ent'}">入口側を大きく</button><button type="button" class="ks-chip" data-h="all" aria-pressed="${V.half==='all'}">店ぜんぶ</button></div></div>`;
  if(top.dataset.k!==h){top.innerHTML=h;top.dataset.k=h;top.querySelectorAll('[data-h]').forEach(b=>b.onclick=()=>{V.half=b.dataset.h;render(o);});const fb=top.querySelector('[data-fan]');if(fb)fb.onclick=()=>{V.fan=!V.fan;render(o);};}
  panel(kpi);}
function panel(kpi){kpi=kpi||document.getElementById('ksKpi');const res=ensureRes();if(!kpi||!res)return;
  {const el=document.getElementById('msLocal');if(el){const h=cruiseLine()+localLine()+samedayLine();if(el.dataset.k!==h){el.innerHTML=h;el.dataset.k=h;}}}   /* 地元のお店の欄は時刻で変わるので、数字の欄といっしょに */
  const Tn=gT(),o=KC.soFar(V.cfg,res,Tn),k=KC.idxAt(res,Tn);
  let f=0,s=0,help=0,left=0,eat=0,sit=0,loc=0,sdf=0;for(let i=0;i<k;i++){const e=res.ev[i];if(e.k==='delivery'&&e.local)loc+=e.cost||0;if(e.k==='delivery'&&e.sameday)sdf+=e.fee||0;if(e.k==='buy'){if(e.lane==='s')s++;else f++;}else if(e.k==='selfhelp')help++;else if(e.k==='look'&&e.why==='列が長い')left++;else if(e.k==='eatin'){eat++;if(e.sit)sit++;}}
  const on=(res.crew||[]).filter(w=>(w.spans||[]).some(([a,b])=>Tn>=a&&Tn<b)).map(w=>esc(w.name));
  kpi.innerHTML=`<div><span>きょうの売上（いままで）</span><b>${yen(o.sales)}</b></div><div><span>お客さん</span><b>${num(o.cust)}人</b></div>
    <div><span>セルフレジの割合</span><b>${f+s?Math.round(s/(f+s)*100):0}%</b></div><div><span>セルフで店員を呼んだ</span><b>${help}回</b></div>
    <div><span>列が長くて帰った</span><b>${left}人</b></div><div><span>イートイン（うち座った）</span><b>${eat}人（${sit}人）</b></div><div><span>地元のお店へ（仕入れ）</span><b>${yen(loc)}</b></div><div><span>できたての便（運賃）</span><b>${yen(sdf)}</b></div><div><span>いまの店員</span><b>${on.length?on.join('・'):'だれもいない'}</b></div>`;}

/* 地元のお店（橋 local-to-kiosk）：きょう届く・届いた数と、お店の人のひとこと */
function localLine(){const S=V.st,lc=S&&localNow(S,gDay());if(!lc)return '';const P={};for(const p of V.cfg.products)P[p.id]=p;const Tn=gT();
  const rows=V.M.localShops.map(sh=>{const r=lc.runs.find(x=>x.shop===sh.id),sy=lc.say.find(x=>x.shop===sh.id);
    const what=lc.closed.includes(sh.id)?'きょうは休み':r?(Tn>=r.t?fmtT(r.t)+'に届いた：':fmtT(r.t)+'に届く予定：')+Object.entries(r.items).map(([p,q])=>esc(P[p]?P[p].short:p)+' '+q).join('・'):'きょうは足りている（届けない）';
    return `<li><b>${esc(sh.name)}</b>（${esc(sh.kind)}）${what}${sy?`<br><span style="color:var(--muted)">${esc(sh.person)}「${esc(sy.text)}」</span>`:''}</li>`;}).join('');
  return `<div class="ks-note" style="margin:6px 0 0"><span class="ks-lst">仮の数値</span> 地元のお店から直接（センターを通らない）<ul style="margin:4px 0 0;padding-left:18px">${rows}</ul></div>`;}

/* 客船の日（橋 port-to-all）：その日の朝に決まっている分だけ（先の予定は出さない） */
function cruiseLine(){const pp=g(()=>SEAS.portPlan,null);if(!pp)return '';const c=pp.call;
  return `<div class="ks-note" style="margin:6px 0 0"><span class="ks-lst">仮の数値</span> 🚢 きょうは客船の日：${esc(c.ship.name)}（${esc(c.ship.from)}・約${num(c.pax)}人）が港浜ふ頭に。${fmtT(c.arr)}に着いて${fmtT(c.dep)}に出る。客船の客は${fmtT(pp.cruise.from)}〜${fmtT(pp.cruise.to)}ごろに来る（おみやげ・水・サンドが売れやすい）</div>`;}

/* できたての便（橋 factory-to-kiosk-sameday）：工場の出荷 → みなと川運輸 → 店に着く、と「できたて」の札の時間 */
function samedayLine(){const S=V.st,sd=S&&samedayNow(S,gDay(),gCond());if(!sd)return '';const P={};for(const p of V.cfg.products)P[p.id]=p;const Tn=gT();
  const its=Object.entries(sd.items).map(([p,q])=>esc(P[p]?P[p].short:p)+' '+q).join('・');
  const st=Tn<sd.ship?`工場で作っている（${fmtT(sd.ship)}に出荷の予定）`:Tn<sd.arrive?`${fmtT(sd.ship)}に工場を出た・${fmtT(sd.arrive)}に着く予定`:Tn<sd.tag.to?`${fmtT(sd.arrive)}に着いた・棚に「${esc(sd.tag.label)}」の札（${fmtT(sd.tag.to)}まで）`:`${fmtT(sd.arrive)}に着いた（札は${fmtT(sd.tag.to)}まで）`;
  const why=[sd.trouble?`工場の朝の釜が遅れて${sd.late}分おそい出荷・少なめ`:'',sd.delay>=10?`トラックが${sd.delay}分おくれ`:''].filter(Boolean).join('・');
  return `<div class="ks-note" style="margin:6px 0 0"><span class="ks-lst">仮の数値</span> できたての便（${esc(sd.carrier)}・工場の朝の組 → 店）：${st}<br>${its}（${esc(sd.replace)}の分を炊きたてで）${why?`<br><span style="color:var(--warn)">${why}</span>`:''}</div>`;}

/* ---------- 絵：小さな絵を作っておく ---------- */
const SC=2;
function mk(w,h,f){const c=document.createElement('canvas');c.width=w*SC;c.height=h*SC;const x=c.getContext('2d');x.scale(SC,SC);f(x);return c;}
const LOOK={salM:{body:'#3a4a6a',hair:'#2b2016',acc:'tie'},salF:{body:'#8a5b7a',hair:'#3a2618'},jk:{body:'#f2f2f2',skirt:'#24345a',hair:'#2b2016',acc:'ribbon'},stu:{body:'#1f2630',hair:'#1a1410'},
  sen:{body:'#7a6a5a',hair:'#c9c9c9',acc:'cane'},tou:{body:'#d9822b',hair:'#5a3a20',acc:'flag'},hou:{body:'#5b8a3a',hair:'#3a2618',acc:'bag'},shf:{body:'#7d7a4a',hair:'#2b2016',acc:'vest',cap:'#3c4a2a'},
  cru:{body:'#f4f0e6',hair:'#b08a5a',acc:'hat'},fam:{body:'#e07a5f',hair:'#3a2618',acc:'bag',with:{body:'#f2c14e',hair:'#3a2618',kid:true}},
  cpl:{body:'#c9578a',hair:'#2b2016',with:{body:'#4a6a8a',hair:'#2b2016'}},frd:{body:'#8a6ad0',hair:'#1a1410',with:{body:'#3aa38a',hair:'#5a3a20'}},clerk:{body:'#2f8a6e',hair:'#2b2016',acc:'apron',cap:'#2f8a6e'}};
function fig(c,cx,L,st){c.fillStyle='rgba(0,0,0,.2)';c.beginPath();c.ellipse(cx,40,8,3,0,0,7);c.fill();
    c.strokeStyle='#2a2a30';c.lineWidth=3;c.lineCap='round';c.beginPath();c.moveTo(cx-3,30);c.lineTo(cx-3+st,39);c.moveTo(cx+3,30);c.lineTo(cx+3-st,39);c.stroke();
    if(L.skirt){c.fillStyle=L.skirt;c.beginPath();c.moveTo(cx-7,26);c.lineTo(cx+7,26);c.lineTo(cx+8,32);c.lineTo(cx-8,32);c.closePath();c.fill();}
    c.fillStyle=L.body;c.beginPath();c.roundRect(cx-7,14,14,15,4);c.fill();
    if(L.acc==='vest'){c.fillStyle='#e8d23a';c.fillRect(cx-7,20,14,2.5);}
    if(L.acc==='apron'){c.fillStyle='#f4f4ee';c.fillRect(cx-4,17,8,12);}
    if(L.acc==='tie'){c.fillStyle='#c4302b';c.fillRect(cx-1,15,2,7);}
    if(L.acc==='ribbon'){c.fillStyle='#c4302b';c.fillRect(cx-2,15,4,3);}
    if(L.acc==='bag'){c.fillStyle='#e6dcc0';c.fillRect(cx+6,22,6,7);}
    if(L.acc==='cane'){c.strokeStyle='#5a4030';c.lineWidth=1.5;c.beginPath();c.moveTo(cx+9,22);c.lineTo(cx+10,40);c.stroke();}
    if(L.acc==='flag'){c.strokeStyle='#555';c.lineWidth=1.2;c.beginPath();c.moveTo(cx+8,24);c.lineTo(cx+8,2);c.stroke();c.fillStyle='#e8433a';c.beginPath();c.moveTo(cx+8,2);c.lineTo(cx+16,5);c.lineTo(cx+8,8);c.closePath();c.fill();}
    c.fillStyle='#f0c9a0';c.beginPath();c.arc(cx,9,5.5,0,7);c.fill();
    c.fillStyle=L.hair;c.beginPath();c.arc(cx,7.5,5.6,Math.PI*1.05,Math.PI*1.95);c.fill();
    if(L.cap){c.fillStyle=L.cap;c.beginPath();c.arc(cx,7,5.8,Math.PI,0);c.fill();c.fillRect(cx-1,6,8,1.8);}
    if(L.acc==='hat'){c.fillStyle='#e9dcb5';c.beginPath();c.ellipse(cx,6,9,2.5,0,0,7);c.fill();c.beginPath();c.arc(cx,5,4.5,Math.PI,0);c.fill();}}
/* 人の小さな絵。グループ（家族連れ・カップル・友人同士）は、となりにもう1人（子どもは小さく）を描いた横長の絵 */
function sprite(ps,fr){const k=ps+fr;if(V.spr[k])return V.spr[k];const L=LOOK[ps]||{body:'#555',hair:'#222'},st=fr?2.5:-2.5,W2=L.with?46:28;
  return V.spr[k]=mk(W2,44,c=>{if(L.with){const w=L.with,sc=w.kid?0.7:1;c.save();c.translate(32,44*(1-sc));c.scale(sc,sc);fig(c,0,w,-st);c.restore();}fig(c,14,L,st);});}
/* 店の床・壁・棚（1回だけ描く） */
function box(c,[x,y,w,d,h],top,front){c.fillStyle=front;c.fillRect(x,y+d-h,w,h);c.fillStyle=top;c.fillRect(x,y-h,w,d);c.strokeStyle='rgba(0,0,0,.18)';c.lineWidth=1;c.strokeRect(x+.5,y-h+.5,w-1,d+h-1);}
function label(c,t,x,y,col,size){c.fillStyle=col||'#55504a';c.font=`${size||11}px "Zen Kaku Gothic New",sans-serif`;c.textAlign='center';c.fillText(t,x,y);}
function bg(){if(V.bg)return V.bg;return V.bg=mk(1000,600,c=>{const F=MAP.fx,WY=MAP.wallY;
  // コンコースと改札口（2026-11-10：コンコースを広く。店の壁 y=456 から改札口まで）
  c.fillStyle='#bdb8ad';c.fillRect(0,WY,1000,600-WY);c.strokeStyle='rgba(255,255,255,.25)';for(let x=0;x<1000;x+=40){c.beginPath();c.moveTo(x,WY);c.lineTo(x,600);c.stroke();}
  c.fillStyle='#e2c84a';for(let x=310;x<700;x+=6)c.fillRect(x,548,3,3);
  for(let i=0;i<6;i++){const x=320+i*64;c.fillStyle='#8e959b';c.fillRect(x,560,14,36);c.fillStyle='#5d6469';c.fillRect(x,560,14,6);c.fillStyle=i%2?'#2f8a6e':'#3a6ab0';c.fillRect(x+3,568,8,4);}
  label(c,'港駅 改札口',505,540,'#3a3f44',12);label(c,'コンコース',120,540,'#5a5f64',12);
  // 看板と壁
  c.fillStyle='#22313a';c.fillRect(0,0,1000,40);c.fillStyle='#d33a3a';c.fillRect(20,12,46,5);c.fillRect(20,22,46,5);
  c.fillStyle='#fff';c.font='700 20px "Zen Kaku Gothic New",sans-serif';c.textAlign='left';c.fillText('みなとスタンド 港駅改札前店',80,28);c.fillStyle='#9fd3c7';c.font='12px sans-serif';c.fillText('Haven Stand',398,28);
  c.fillStyle='#e8e2d4';c.fillRect(0,40,1000,30);
  // 床
  c.fillStyle='#ece7dc';c.fillRect(30,70,940,WY-70);c.strokeStyle='rgba(0,0,0,.05)';for(let x=30;x<970;x+=36){c.beginPath();c.moveTo(x,70);c.lineTo(x,WY);c.stroke();}for(let y=70;y<WY;y+=36){c.beginPath();c.moveTo(30,y);c.lineTo(970,y);c.stroke();}
  c.fillStyle='#d9d2c2';c.fillRect(0,40,30,WY-30);c.fillRect(970,40,30,WY-30);
  // 改札口側の壁（ガラス）と入口・出口
  c.fillStyle='#9fc3d0';c.fillRect(30,WY-4,940,6);c.fillStyle='#ece7dc';c.fillRect(MAP.door.inX[0],WY-6,MAP.door.inX[1]-MAP.door.inX[0],10);c.fillRect(MAP.door.outX[0],WY-6,MAP.door.outX[1]-MAP.door.outX[0],10);
  c.fillStyle='#2f8a6e';c.font='700 11px sans-serif';c.textAlign='center';c.fillText('入口 ↑',150,WY+20);c.fillStyle='#8a3a3a';c.fillText('出口 ↓',745,WY+20);
  // 一本道の矢印（入口 → 冷蔵ケース → 低い棚 → レジ）
  c.strokeStyle='rgba(47,138,110,.16)';c.lineWidth=10;c.lineCap='round';c.setLineDash([2,16]);c.beginPath();c.moveTo(150,430);c.lineTo(110,300);c.lineTo(110,156);c.lineTo(340,156);c.lineTo(340,300);c.lineTo(540,300);c.lineTo(540,380);c.lineTo(580,380);c.stroke();c.setLineDash([]);
  // 棚
  box(c,F.fridge,'#cfd9dc','#9fb3bb');box(c,F.shelf,'#e3d7bd','#c4b493');box(c,F.dry,'#e6dcc8','#c9b99a');box(c,F.omiyage,'#c9a57a','#9a7a52');box(c,F.regfront,'#e3d7bd','#c4b493');
  box(c,F.tobacco,'#bdb3a0','#8f8570');box(c,F.warmer,'#e8b98f','#c48a5a');box(c,F.counter,'#b9b2a3','#8c8576');box(c,F.hot,'#f3d9a6','#c9a25a');box(c,F.self,'#4a5056','#33383d');
  box(c,F.hook,'#d9d3c3','#bdb6a4');box(c,F.rack,'#f4f4f0','#cfcfc8');box(c,F.umbrella,'#c9dde6','#9fb3bb');box(c,F.range,'#d6d6d0','#9a9a94');box(c,F.trash,'#7a8a7a','#5a6a5a');
  // 冷蔵ケースの区切り（左：お弁当・サンドの平台／右：飲み物・お酒の扉）
  c.strokeStyle='rgba(255,255,255,.8)';c.lineWidth=2;for(const x of [180,285]){c.beginPath();c.moveTo(F.fridge[0]+x,F.fridge[1]-F.fridge[4]+2);c.lineTo(F.fridge[0]+x,F.fridge[1]+F.fridge[3]-2);c.stroke();}
  // イートイン：壁ぞいの立ち席（カウンター）と、座れる席（簡易的な小さなテーブル2つ・あとで隣にカフェ）
  c.fillStyle='#c8b28c';c.fillRect(F.eat[0],F.eat[1],F.eat[2],F.eat[3]);c.fillStyle='#a8925c';c.fillRect(F.eat[0],F.eat[1],4,F.eat[3]);
  for(const [x,y,w,h] of F.tables){c.fillStyle='rgba(0,0,0,.1)';c.fillRect(x+3,y+h,w-2,4);c.fillStyle='#d8c39a';c.beginPath();c.roundRect(x,y,w,h,4);c.fill();c.strokeStyle='#a8925c';c.lineWidth=1;c.stroke();}
  for(let i=6;i<10;i++){const [x,y]=MAP.seat(i);c.fillStyle='#8a6e4a';c.beginPath();c.roundRect(x-9,y+2,18,12,3);c.fill();c.fillStyle='#a8865a';c.fillRect(x-9,y-6,18,6);}
  // レジの機械
  c.fillStyle='#4a5056';c.beginPath();c.roundRect(580,270,40,22,3);c.fill();c.fillStyle='#9fd3c7';c.fillRect(586,274,26,8);c.fillStyle='#9fd3c7';c.fillRect(806,284,30,12);
  // 床の印（有人レジの列）
  for(let k=1;k<=6;k++){const x=MAP.q.f.x+MAP.q.f.dx*k;c.fillStyle=k<=5?'rgba(47,138,110,.35)':'rgba(0,0,0,.08)';c.beginPath();c.ellipse(x,MAP.q.f.y+6,8,3,0,0,7);c.fill();}
  {const x=MAP.q.f.x+MAP.q.f.dx*5.5;c.strokeStyle='#d8382e';c.lineWidth=2;c.beginPath();c.moveTo(x,MAP.q.f.y-16);c.lineTo(x,MAP.q.f.y+16);c.stroke();label(c,'床の印',x,MAP.q.f.y-20,'#b02e26',10);}
  for(let k=1;k<=3;k++){c.fillStyle='rgba(58,106,176,.3)';c.beginPath();c.ellipse(MAP.q.s.x,MAP.q.s.y+MAP.q.s.dy*k+6,8,3,0,0,7);c.fill();}
  // 立ち席の印・ミラー・カメラ
  for(let i=0;i<6;i++){const [x,y]=MAP.seat(i);c.fillStyle='rgba(0,0,0,.08)';c.beginPath();c.ellipse(x,y+4,9,3,0,0,7);c.fill();}
  c.fillStyle='#cfe3ea';c.strokeStyle='#8aa';c.lineWidth=2;c.beginPath();c.arc(44,82,9,0,7);c.fill();c.stroke();c.beginPath();c.arc(410,82,9,0,7);c.fill();c.stroke();
  c.fillStyle='#333';c.fillRect(950,76,12,7);c.fillRect(36,WY-12,12,7);
  // 名札
  label(c,'冷蔵ケース（お弁当・サンド｜飲み物・お酒）',215,108,'#3a4a50');label(c,'おにぎり・サンド・パン・ドーナツ',235,166,'#55504a',10);label(c,'乾物・おやつ（カップ麺・スナック）',422,166,'#55504a',10);label(c,'おみやげ',500,66,'#6a4a2a');
  label(c,'たばこ',600,170);label(c,'ホット',716,282);label(c,'有人レジ',600,318,'#fff',10);label(c,'セルフ',822,320,'#fff',10);label(c,'レジ前の棚（グミ・小物）',435,450,'#55504a',10);
  label(c,'イートイン（立ち席6）',946,100,'#6a5a3a',10);label(c,'座れる席（4）',787,104,'#6a5a3a',10);label(c,'レンジ・お湯',642,52,'#55504a',10);label(c,'ごみ',945,398,'#55504a',10);label(c,'日用品',45,144,'#55504a',10);label(c,'新聞',45,304,'#55504a',10);label(c,'傘',83,448,'#55504a',10);});}
/* 品の量（10秒に1回描き直す） */
const DISP={fridge:'front',tobacco:'front',hot:'front',warmer:'front',hook:'v',rack:'v'};
function shelfLayer(res,Tn){const k=Math.floor(Tn*6)+'|'+(res&&res.day);if(V.shelf&&V.shelfK===k)return V.shelf;V.shelfK=k;
  const S=V.st,I=KC.index(V.cfg),si=KC.shelfInfo(V.cfg,S.layout),stock=res?KC.stockAt(res,Tn):{};
  const cv=V.shelf||(V.shelf=document.createElement('canvas'));cv.width=1000*SC;cv.height=600*SC;const c=cv.getContext('2d');c.setTransform(SC,0,0,SC,0,0);c.clearRect(0,0,1000,600);
  for(const zk in S.layout){const F=MAP.fx[zk],z=V.cfg.zones[zk];if(!F||!z)continue;const [x,y,w,d,h]=F,mode=DISP[zk]||'top';
    let rx,ry,rw,rh;if(mode==='front'){rx=x+2;ry=y+d-h+2;rw=w-4;rh=h-4;}else{rx=x+2;ry=y-h+2;rw=w-4;rh=d-4;}
    const R=mode==='v'?z.cols:z.rows,C=mode==='v'?z.rows:z.cols;
    (S.layout[zk]||[]).forEach((pid,i)=>{const r=Math.floor(i/z.cols),cc=i%z.cols,rr=mode==='v'?cc:r,col=mode==='v'?r:cc;
      const sx=rx+col*rw/C,sy=ry+rr*rh/R,sw=rw/C-1,sh=rh/R-1;if(!pid){c.fillStyle='rgba(0,0,0,.06)';c.fillRect(sx,sy,sw,sh);return;}
      const p=I.P[pid],s=si[pid],q=stock[pid]||0,fr=s?Math.min(1,q/Math.max(1,s.cap)):0;
      c.fillStyle='rgba(255,255,255,.5)';c.fillRect(sx,sy,sw,sh);
      if(q>0){c.fillStyle=p.color||'#888';c.globalAlpha=0.45+0.55*fr;c.fillRect(sx,sy+sh*(1-Math.max(0.25,fr)),sw,sh*Math.max(0.25,fr));c.globalAlpha=1;}
      else{c.fillStyle='#d8382e';c.fillRect(sx+sw/2-1.5,sy+sh/2-1.5,3,3);}});}
  return cv;}

/* ---------- 絵：毎コマ ---------- */
function bubble(c,x,y,t,col){c.font='12px "Zen Kaku Gothic New",sans-serif';const w=c.measureText(t).width+14;x=Math.max(34+w/2,Math.min(966-w/2,x));c.fillStyle=col;c.beginPath();c.roundRect(x-w/2,y-11,w,20,8);c.fill();c.beginPath();c.moveTo(x-4,y+9);c.lineTo(x,y+15);c.lineTo(x+4,y+9);c.fill();c.fillStyle='#1c2826';c.textAlign='center';c.fillText(t,x,y+3);}
function view(){const n=innerWidth<760;if(!n||V.half==='all')return null;return V.half==='ent'?{x:20,y:80,w:600}:{x:400,y:96,w:600};}
function draw(c,dt){const Tn=gT();if(!V.cfg){c.fillStyle='#2a2f33';c.fillRect(0,0,1000,600);return;}
  if(!V.st){c.drawImage(bg(),0,0,1000,600);c.fillStyle='rgba(20,24,28,.55)';c.fillRect(0,0,1000,600);c.fillStyle='#fff';c.font='700 20px sans-serif';c.textAlign='center';c.fillText('港駅・改札口の前に、まだ店がありません',500,300);return;}
  const res=ensureRes(),vw=view();c.save();if(vw){const s=1000/vw.w;c.scale(s,s);c.translate(-vw.x,-vw.y);}
  c.drawImage(bg(),0,0,1000,600);if(res)c.drawImage(shelfLayer(res,Tn),0,0,1000,600);
  const FX=window.MinatoFx,FF=res&&FX?fxCtx(res,Tn):null;   // 絵の第2段（js/minato-store-fx.js）：重ねて描くだけ
  if(FF){if(V.actsRes!==res){V.acts=A.build(res,V.cfg,V.st.layout);V.actsRes=res;}FF.acts=V.acts;FX.under(c,FF);}
  if(res){if(V.actsRes!==res){V.acts=A.build(res,V.cfg,V.st.layout);V.actsRes=res;}
    const K=A.clerks(res,Tn);
    for(const k of K.list){const sp=sprite('clerk',0);c.drawImage(sp,k.x-14,k.y-38,28,44);}
    if(!K.list.length){c.fillStyle='#7a2e2e';c.beginPath();c.roundRect(560,240,150,28,6);c.fill();c.fillStyle='#fff';c.font='700 13px sans-serif';c.textAlign='center';c.fillText('ただいま休止中',635,259);}
    if(K.stop){c.fillStyle='#e0a21b';c.beginPath();c.roundRect(566,300,68,16,4);c.fill();c.fillStyle='#fff';c.font='700 10px sans-serif';c.textAlign='center';c.fillText('しばらくお待ちを',600,312);}
    const L=A.at(V.acts,Tn,V.cap),wk=Math.floor(Date.now()/220)%2;
    for(const o of L){if(o.dot){c.fillStyle=(V.cfg.personas.find(p=>p.id===o.a.ps)||{}).icon||'#555';c.beginPath();c.arc(o.x,o.y-4,3.5,0,7);c.fill();continue;}
      const sp=sprite(o.a.ps,o.mv?wk:0),sw=sp.width/SC;c.drawImage(sp,o.x-14,o.y-38,sw,44);
      if(o.ph==='pay'&&o.a.lane==='s'){c.fillStyle='rgba(159,211,199,.7)';c.fillRect(o.x-6,o.y-46,12,4);}
      if(o.ph==='pack'){c.fillStyle='#e8e2d4';c.fillRect(o.x+6,o.y-20+Math.sin(Tn*700)*1.5,7,9);}   // 会計のあと：袋を持ち直す（A1）
      if(o.ph==='eat'){c.fillStyle='#fff';c.beginPath();c.ellipse(o.x+14,o.y-16,5,3,0,0,7);c.fill();}}
    if(FF)FX.over(c,FF);
    for(const b of A.bubbles(res,Tn))bubble(c,b.x,b.y,b.text,b.kind==='help'?'#ffe7a3':b.kind==='left'?'#ffd3c9':b.kind==='range'?'#fff2c2':b.kind==='full'?'#ffe0e0':'#e6e6e6');}
  c.restore();
  // 時計と、開店前・閉店後
  c.fillStyle='rgba(15,20,24,.82)';c.beginPath();c.roundRect(10,46,96,26,5);c.fill();c.fillStyle='#ffb347';c.font='700 18px "DotGothic16",monospace';c.textAlign='left';c.fillText(fmtT(Tn),20,66);
  const O0=V.cfg.open[0]*60,O1=V.cfg.open[1]*60;if(Tn>=O1&&FF&&!vw){FX.closed(c,FF);return;}if(Tn<O0||Tn>=O1){c.fillStyle='rgba(20,24,28,.5)';c.fillRect(0,40,1000,560);c.fillStyle='#fff';c.font='700 22px sans-serif';c.textAlign='center';c.fillText(Tn<O0?`開店前（${V.cfg.open[0]}:00から）`:'本日の営業は終わりました',500,300);}}
function fxCtx(res,Tn){const S=V.st,day=gDay(),c=gCond();return {res,Tn,cfg:V.cfg,st:S,cond:{wx:c.wx,season:c.season,day:c.day},port:g(()=>SEAS.portPlan,null),sd:samedayNow(S,day,c)||null,fan:!!V.fan,local:V.localDay===res.day?V.local:null};}
function click(){if(innerWidth<760){V.half=V.half==='reg'?'ent':V.half==='ent'?'all':'reg';const t=document.getElementById('ksTop');if(t)t.dataset.k='';refresh();}}   // スマホ：押すと、レジ側 → 入口側 → 店ぜんぶ

window.MinatoStoreView={render,panel,draw,click,get ready(){return !!V.cfg;},get state(){return V.st;},get today(){return ensureRes();},get actors(){return V.acts;},
  closeToday(){const r=ensureRes();if(r)closeToday(r);return V.st&&V.st.hist&&V.st.hist.at(-1);},   // 開発用
  reset(){try{localStorage.removeItem(MS.KEY);}catch(e){}V.st=null;V.res=null;refresh();}};
})();
