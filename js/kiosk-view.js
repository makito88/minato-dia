/* =====================================================================
   売店運営（第2段）の画面
   ・計算は js/kiosk-core.js、設定は data/kiosk.json（年代・支払い・場所は data/research.json）。ここは画面だけ。
   ・ゲームの時計（T）・運行日（ENS.day）・その日の条件（COND）・シミュレーション結果（D）を読むだけ。
   ・売店の正面（棚・在庫・値札）と、来るお客さんを描く。棚割り・値段・仕入れ数・店員の人数を変えられる。
   ・運行日が終わる（26:00を過ぎる）と、その日を締めて、評判・SNS・常連・ブームを次の日へ持ちこす。
   ===================================================================== */
(function(){
'use strict';
if(typeof KioskCore==='undefined'||typeof ResearchCore==='undefined')return;
const KC=KioskCore,RC=ResearchCore,KEY='dia-kiosk',H=KC.H;
const STORDER=['C','S','U','M','K','N','P','F','T','O'],PLACES=['home','naka','gate'];
const $=id=>document.getElementById(id);
const g=(f,d)=>{try{return f();}catch(e){return d;}};
const gT=()=>g(()=>T,600),gD=()=>g(()=>D,null),gDay=()=>g(()=>ENS.day,1),gCond=()=>g(()=>COND,{day:'wd',wx:'sun',season:'aut',evs:[]});
const stName=s=>g(()=>ST[s].name,s),fmtT=t=>g(()=>fmt(t),'');
const yen=n=>(n<0?'−':'')+'¥'+Math.round(Math.abs(n)).toLocaleString('ja-JP');
const man=n=>(n<0?'−':'')+(Math.abs(n)>=1e4?(Math.abs(n)/1e4).toFixed(1)+'万円':Math.round(Math.abs(n)).toLocaleString('ja-JP')+'円');
const num=n=>Math.round(n).toLocaleString('ja-JP');
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);
const DAYN={wd:'平日',sat:'土曜',hol:'日曜・祝日'},WXN={sun:'晴れ',cld:'くもり',rain:'雨',snow:'大雪'},SEAN={spr:'春',sum:'夏',aut:'秋',win:'冬'};

const V={cfg:null,rcfg:null,err:null,st:null,open:false,res:null,resKey:'',lastDay:null,tab:'log',form:{st:'C',place:'home'},
  cv:null,cx:null,raf:0,lastTs:0,people:[],bubbles:[],evI:0,lastT:null,slotAt:null,pend:null,showAll:false,panelT:0,heavyT:0};

const narrow=()=>window.innerWidth<760;
addEventListener('resize',()=>{const n=narrow();if(n!==V.wasNarrow){V.wasNarrow=n;if(V.open)render(true);}});
/* ---------- 読み込み・保存 ---------- */
Promise.all([fetch('data/kiosk.json').then(r=>{if(!r.ok)throw new Error('kiosk.json: HTTP '+r.status);return r.json();}),fetch('data/research.json').then(r=>{if(!r.ok)throw new Error('research.json: HTTP '+r.status);return r.json();})])
  .then(([c,rc])=>{V.cfg=c;V.rcfg=rc;try{const s=JSON.parse(localStorage.getItem(KEY)||'null');if(s&&s.v===1)V.st=s;}catch(e){}V.lastDay=gDay();badge();if(V.open)render(true);})
  .catch(e=>{V.err=String(e.message||e);if(V.open)render(true);});
function persist(){try{localStorage.setItem(KEY,JSON.stringify(V.st));}catch(e){}}
const ix=()=>KC.index(V.cfg);

/* ---------- その日の計算 ---------- */
function ctxNow(){const d=gD(),S=V.st;if(!d||!d.sim||!S)return null;const s=d.sim.stat[S.st];if(!s)return null;
  const stops=new Array(H).fill(0);for(const t of d.trips){const i=t.seq.indexOf(S.st);if(i>=0&&t.stop[i])stops[Math.min(H-1,Math.floor(t.arr[i]/60))]++;}
  const c=gCond(),day=gDay();
  return {day,dow:(day+0)%7,cond:{day:c.day,wx:c.wx,season:c.season},flows:{hb:s.hb,ha:s.ha},stops,plats:g(()=>ST[S.st].plats,2)||2,rcfg:V.rcfg,edits:S.today&&S.today.day===day?S.today.edits:[],startT:S.openedDay===day?S.openedT:0};}
function checkDay(){if(!V.cfg||!V.st)return;const day=gDay();if(V.lastDay==null)V.lastDay=day;if(day===V.lastDay)return;
  if(day>V.lastDay&&V.res&&V.res.day===V.lastDay)closeToday(V.res);   // 日が進んだら、まず前の日の結果で締める（次の日の計算より先に）
  if(day<V.lastDay){V.st.closed=day-1;persist();}V.lastDay=day;V.res=null;}
function ensureRes(){if(!V.st||!V.cfg)return null;checkDay();const c=ctxNow();if(!c)return V.res;
  const k=c.day+'|'+c.cond.day+c.cond.wx+c.cond.season+'|'+(gD()&&gD().trips.length)+'|'+JSON.stringify(c.edits.map(e=>e.t))+'|'+(V.editRev||0);
  if(V.res&&V.resKey===k&&V.resD===gD())return V.res;
  V.res=KC.simulate(V.cfg,V.st,c);V.resKey=k;V.resD=gD();V.evI=KC.idxAt(V.res,gT());return V.res;}
function tick(){if(!V.cfg||!V.st)return;ensureRes();}
function closeToday(res){const S=V.st;
  // その日の最後の設定を、次の日からの設定にする。新しく並べた品は「並べた日」を覚える（マニアが来る）
  const last=S.today&&S.today.day===res.day&&S.today.edits.length?S.today.edits.at(-1):null;
  const before=new Set(Object.keys(KC.shelfInfo(V.cfg,S.layout)));
  const r=KC.closeDay(V.cfg,S,res,{});V.st=r.state;
  if(last){V.st.layout=last.layout;V.st.price=last.price;V.st.order=last.order;V.st.staff=last.staff;for(const pid in KC.shelfInfo(V.cfg,last.layout))if(!before.has(pid))V.st.placedAt[pid]=res.day+1;}
  V.st.today=null;V.st.unread=(V.st.unread||0)+r.news.length;persist();badge();if(V.open)setTimeout(()=>render(true),0);}
/* 設定を変える（その時刻から先が変わる） */
function curSet(){const S=V.st,day=gDay();if(S.today&&S.today.day===day&&S.today.edits.length)return S.today.edits.at(-1);return {layout:S.layout,price:S.price,order:S.order,staff:S.staff};}
function edit(fn){const S=V.st,day=gDay(),c=JSON.parse(JSON.stringify(curSet()));fn(c);c.t=Math.max(gT(),(S.openedDay===day?S.openedT:0)+0.01);
  if(!S.today||S.today.day!==day)S.today={day,edits:[]};const L=S.today.edits;if(L.length&&Math.abs(L.at(-1).t-c.t)<1)L[L.length-1]=c;else L.push(c);
  persist();V.editRev=(V.editRev||0)+1;clearTimeout(V.pend);V.pend=setTimeout(()=>{V.res=null;ensureRes();render(true);},250);}

/* ---------- 骨組み ---------- */
const CSS=`
.ksv{position:fixed;inset:0;z-index:67;background:var(--paper);color:var(--ink);overflow:auto;padding:calc(env(safe-area-inset-top,0px) + 10px) max(14px,env(safe-area-inset-right,0px)) calc(env(safe-area-inset-bottom,0px) + 24px) max(14px,env(safe-area-inset-left,0px))}
.ksv[hidden]{display:none!important}
.ks-in{max-width:1200px;margin:0 auto;display:grid;gap:10px}
.ks-hd{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px}.ks-hd h2{margin:0;font-size:19px}.ks-hd small{font-size:12px;color:var(--muted)}.ks-sp{flex:1}
.ks-btn,.ks-chip{font:inherit;font-size:13px;border:1px solid var(--line);background:var(--panel);color:var(--ink);border-radius:7px;padding:5px 10px;cursor:pointer}
.ks-chip{border-radius:999px;background:var(--paper)}.ks-chip[aria-pressed="true"],.ks-btn.pri{background:var(--ink);color:var(--paper);border-color:var(--ink);font-weight:700}
.ks-btn:focus-visible,.ks-chip:focus-visible,.ks-tab:focus-visible,.ks-slot:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.ks-card{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:12px 14px;min-width:0}
.ks-card h3{margin:0 0 8px;font-size:14px;display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:baseline}.ks-card h3 small{font-size:11.5px;color:var(--muted);font-weight:400}
.ks-stage{border-radius:10px;overflow:hidden;border:1px solid var(--line);background:#2a2f33}.ks-stage canvas{display:block;width:100%;height:auto}
.ks-kpi{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px}.ks-kpi div{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:7px 10px;min-width:0}
.ks-kpi span{display:block;font-size:11px;color:var(--muted)}.ks-kpi b{font-family:var(--f-mono);font-size:17px;font-variant-numeric:tabular-nums}.ks-kpi .neg{color:#c9573f}.ks-kpi .pos{color:#2f8a4a}
.ks-tabs{display:flex;gap:4px;flex-wrap:wrap;border-bottom:1px solid var(--line);position:sticky;top:calc(-10px - env(safe-area-inset-top,0px));z-index:3;background:var(--paper);padding-top:4px}
.ks-tab{font:inherit;font-size:13px;border:1px solid transparent;border-bottom:none;background:none;color:var(--muted);padding:7px 12px;border-radius:7px 7px 0 0;cursor:pointer}
.ks-tab[aria-selected="true"]{background:var(--panel);border-color:var(--line);color:var(--ink);font-weight:700;margin-bottom:-1px}
.ks-t{width:100%;border-collapse:collapse;font-size:12.5px;font-variant-numeric:tabular-nums}.ks-t th{font-size:11px;color:var(--muted);font-weight:400;text-align:right;padding:4px 6px;border-bottom:1px solid var(--line);white-space:nowrap;position:sticky;top:0;background:var(--panel)}
.ks-t td{padding:4px 6px;border-bottom:1px solid var(--line);text-align:right;white-space:nowrap}.ks-t td.l,.ks-t th.l{text-align:left;white-space:normal}
.ks-t .neg{color:#c9573f}.ks-t .pos{color:#2f8a4a}.ks-t .mut{color:var(--muted)}.ks-t tr.off td{opacity:.55}
.ks-num{display:inline-flex;align-items:center;gap:2px}.ks-num button{font:inherit;font-size:12px;width:22px;height:22px;border:1px solid var(--line);background:var(--paper);color:var(--ink);border-radius:5px;cursor:pointer;padding:0}
.ks-num b{min-width:3.4em;text-align:center;font-family:var(--f-mono);font-weight:400}
.ks-tags{display:inline-flex;gap:3px;flex-wrap:wrap}.ks-tags i{font-style:normal;font-size:10.5px;border:1px solid var(--line);border-radius:4px;padding:0 4px;color:var(--muted);white-space:nowrap}
.ks-tags i.hot{color:#c9573f;border-color:#e3b0a5}.ks-tags i.cold{color:#2e7fd1;border-color:#a9c8ea}.ks-tags i.trend{color:#b0711f;border-color:#e4c38f;font-weight:700}.ks-tags i.age{color:#8a3c8a;border-color:#d4a9d4}
.ks-log{display:grid;gap:3px;max-height:420px;overflow:auto;font-size:12.5px}.ks-log div{display:grid;grid-template-columns:3.4em 6em minmax(0,1fr) auto;gap:8px;padding:3px 4px;border-bottom:1px dashed var(--line)}
.ks-log time{font-family:var(--f-mono);color:var(--muted)}.ks-log .ps{color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ks-log em{font-style:normal;font-family:var(--f-mono)}
.ks-log .buy em{color:#2f8a4a}.ks-log .look{color:var(--muted)}.ks-log .rv{color:#9a6a1a}.ks-log .sns{color:#3a64b8}.ks-log .sys{color:var(--muted);font-size:11.5px}
.ks-zones{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px}
.ks-zone h4{margin:0 0 4px;font-size:12.5px;display:flex;justify-content:space-between}.ks-zone h4 small{color:var(--muted);font-weight:400}
.ks-grid{display:grid;gap:3px}.ks-slot{font:inherit;font-size:10.5px;min-height:34px;border:1px solid var(--line);border-radius:5px;background:var(--paper);color:var(--ink);cursor:pointer;padding:2px;line-height:1.2;overflow:hidden;text-align:center;position:relative}
.ks-slot i{position:absolute;left:0;right:0;bottom:0;height:4px}.ks-slot.empty{color:var(--muted);border-style:dashed}.ks-slot[aria-pressed="true"]{outline:2px solid var(--accent)}
.ks-pick{margin-top:10px;display:flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:12.5px;position:sticky;bottom:0;z-index:2;background:var(--panel);padding:8px 0;border-top:1px solid var(--line);box-shadow:0 -6px 12px -8px rgb(0 0 0 / .25)}.ks-pick select{font:inherit;font-size:13px;padding:4px 6px;border:1px solid var(--line);border-radius:6px;background:var(--paper);color:var(--ink);max-width:100%}
.ks-bars{display:grid;gap:4px}.ks-bars div{display:grid;grid-template-columns:7.5em minmax(0,1fr) 4.5em;gap:8px;align-items:center;font-size:12.5px}.ks-bars u{display:block;height:10px;border-radius:3px;background:var(--accent);text-decoration:none}.ks-bars em{font-style:normal;font-family:var(--f-mono);font-size:11.5px;text-align:right;color:var(--muted)}
.ks-hrs{display:flex;align-items:flex-end;gap:2px;height:90px;border-bottom:1px solid var(--line)}.ks-hrs span{flex:1;background:var(--accent);opacity:.85;border-radius:2px 2px 0 0;min-height:1px}.ks-hrs span.now{background:#d9822b;opacity:1}
.ks-hlab{display:flex;justify-content:space-between;font-size:10.5px;color:var(--muted);font-family:var(--f-mono);margin-top:3px}
.ks-news{display:grid;gap:7px}.ks-news div{border-left:3px solid var(--line);padding:2px 0 2px 9px;font-size:12.5px;line-height:1.6}.ks-news b{display:block;font-size:13px}.ks-news small{color:var(--muted);font-size:11px}
.ks-news .trend{border-left-color:#d9822b}.ks-news .sns{border-left-color:#3a64b8}.ks-news .regular{border-left-color:#2f8a4a}.ks-news .review{border-left-color:#9a6a1a}.ks-news .soldout,.ks-news .miss,.ks-news .waste{border-left-color:#c9573f}
.ks-g2{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:10px}
.ks-note{font-size:11.5px;color:var(--muted);margin:6px 0 0;line-height:1.65}
.ks-scroll{overflow:auto;max-height:520px}
.ks-cards{display:grid;gap:8px;margin-top:8px}.ks-pc{border:1px solid var(--line);border-radius:9px;padding:9px 10px;background:var(--paper)}.ks-pc.off{opacity:.6}
.ks-pc-h{display:flex;justify-content:space-between;gap:8px;align-items:baseline;margin-bottom:4px}.ks-pc-h b{font-size:14px}.ks-pc-h .mut,.ks-pc .mut{color:var(--muted);font-size:11.5px}
.ks-pc-g{display:grid;grid-template-columns:auto minmax(0,1fr);gap:6px 10px;align-items:center;margin-top:6px;font-size:12.5px}.ks-pc-g>span:nth-child(odd){color:var(--muted);font-size:11.5px}.ks-pc-g b{font-weight:400;font-family:var(--f-mono)}.ks-pc .neg{color:#c9573f}.ks-pc .pos{color:#2f8a4a}
@media (max-width:760px){.ks-num button{width:34px;height:34px;font-size:16px}.ks-slot{min-height:42px;font-size:11.5px}.ks-tab{padding:8px 10px}.ks-pick select{flex:1 1 100%;font-size:15px;padding:8px}}
`;
function mount(){const s=document.createElement('style');s.textContent=CSS;document.head.appendChild(s);
  const after=$('rsBtn')||$('tayoriBtn')||document.querySelector('.clockbox');
  if(after){const b=document.createElement('button');b.id='ksBtn';b.type='button';b.className='tayoribtn';b.innerHTML='売店<span class="dot" hidden></span>';after.after(b);b.onclick=()=>setOpen(true);}
  const mb=document.querySelector('.minibar-in');if(mb){const b=document.createElement('button');b.id='mks';b.type='button';b.className='mspeed tayorimini';b.innerHTML='売店<span class="dot" hidden></span>';mb.appendChild(b);b.onclick=()=>setOpen(true);}
  const p=document.createElement('section');p.id='ksv';p.className='ksv';p.hidden=true;p.setAttribute('aria-label','売店の運営');
  p.innerHTML=`<div class="ks-in"><div class="ks-hd"><h2 id="ksTitle">売店の運営</h2><small id="ksSub"></small><span class="ks-sp"></span><span id="ksSpd"></span><button type="button" class="ks-btn" id="ksClose">閉じる</button></div>
    <div id="ksTop"></div><div class="ks-stage"><canvas id="ksCanvas" width="1000" height="600" aria-label="売店の正面のようす"></canvas></div><div id="ksKpi" class="ks-kpi"></div>
    <div class="ks-tabs" role="tablist" id="ksTabs"></div><div id="ksBody"></div></div>`;
  document.body.appendChild(p);$('ksClose').onclick=()=>setOpen(false);document.addEventListener('keydown',e=>{if(e.key==='Escape'&&V.open)setOpen(false);});
  $('ksSpd').innerHTML=[1,30,180].map(m=>`<button type="button" class="ks-chip" data-m="${m}">×${m}</button>`).join(' ');
  $('ksSpd').querySelectorAll('button').forEach(b=>b.onclick=()=>{setMult(Number(b.dataset.m));});
  const TABS=[['log','売れ行き'],['items','商品・値段・仕入れ'],['layout','棚割り'],['people','客層・時間帯'],['money','収支'],['news','お知らせ']];
  $('ksTabs').innerHTML=TABS.map(([k,n])=>`<button type="button" class="ks-tab" role="tab" data-tab="${k}">${n}</button>`).join('');
  $('ksTabs').querySelectorAll('button').forEach(b=>b.onclick=()=>{V.tab=b.dataset.tab;if(V.tab==='news'&&V.st){V.st.unread=0;persist();badge();}render(true);});
  V.cv=$('ksCanvas');V.cx=V.cv.getContext('2d');V.cv.addEventListener('click',onCanvasClick);}
function setMult(m){g(()=>{speed=m/60;const ms=$('mspeed');if(ms)ms.textContent='×'+m;});document.querySelectorAll('#ksSpd button').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.m)===m)));}
function badge(){const n=V.st?V.st.unread||0:0;for(const id of ['ksBtn','mks']){const b=$(id);if(!b)continue;const d=b.querySelector('.dot');d.hidden=!n;d.textContent=n>9?'9+':String(n);}}
function setOpen(o){V.open=o;$('ksv').hidden=!o;if(o){V.prevSpeed=g(()=>speed,null);setMult(1);V.people=[];V.bubbles=[];V.lastT=null;render(true);cancelAnimationFrame(V.raf);V.lastTs=0;V.raf=requestAnimationFrame(loop);}
  else{cancelAnimationFrame(V.raf);if(V.prevSpeed!=null)g(()=>setSpeed(V.prevSpeed));}}

/* ---------- 開店前：場所を選ぶ ---------- */
function renderSetup(){const f=V.form,R=V.rcfg,studies=g(()=>JSON.parse(localStorage.getItem('dia-research')||'null').studies,[])||[];
  const done=new Set(studies.filter(s=>s.recs&&s.recs.length).map(s=>s.st+'|'+s.place));
  const kiosk=R.types.find(t=>t.id==='kiosk');
  $('ksTop').innerHTML=`<div class="ks-card"><h3><span>売店を出す場所</span><small>リサーチで調べた場所には「調査済み」が付きます</small></h3>
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px">${STORDER.map(s=>`<button type="button" class="ks-chip" data-st="${s}" aria-pressed="${f.st===s}">${stName(s)}</button>`).join('')}</div>
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px">${PLACES.map(p=>`<button type="button" class="ks-chip" data-pl="${p}" aria-pressed="${f.place===p}">${R.places[p].name}${done.has(f.st+'|'+p)?'（調査済み）':''}</button>`).join('')}</div>
    <p class="ks-note">売店（約${V.cfg.area}㎡）。はじめにかかるお金の目安は${man(kiosk.init)}（リサーチの試算と同じ）。店員1人で6時〜23時。棚・値段・仕入れ数は、写真のような売店のよくある並べ方から始まり、あとで変えられます。開店はいまの時刻からで、次の便から品物が届きます。</p>
    <button type="button" class="ks-btn pri" id="ksOpen">${stName(f.st)}駅・${R.places[f.place].name}に売店を出す</button></div>`;
  $('ksTop').querySelectorAll('[data-st]').forEach(b=>b.onclick=()=>{f.st=b.dataset.st;render(true);});
  $('ksTop').querySelectorAll('[data-pl]').forEach(b=>b.onclick=()=>{f.place=b.dataset.pl;render(true);});
  $('ksOpen').onclick=()=>{const day=gDay();V.st=KC.create(V.cfg,{seed:(Date.now()%100000)+1,st:f.st,place:f.place,day});V.st.openedT=gT();V.st.openedDay=day;V.st.unread=0;
    V.st.news.push({day,kind:'open',title:`${stName(f.st)}駅・${R.places[f.place].name}に売店を開いた`,text:'はじめは、よくある売店の並べ方と値段です。売れ行きを見ながら変えていきましょう。'});persist();V.res=null;render(true);};}

/* ---------- 画面全体 ---------- */
function render(full){if(!V.open)return;
  if(!V.cfg){$('ksTop').innerHTML=`<div class="ks-card"><p>${V.err?'設定を読み込めませんでした（'+esc(V.err)+'）。パソコンで index.html を直接開いた場合は読み込めません。':'準備しています…'}</p></div>`;return;}
  if(!V.st){$('ksTitle').textContent='売店を出す';$('ksSub').textContent='';renderSetup();$('ksKpi').innerHTML='';$('ksBody').innerHTML='';$('ksTabs').hidden=true;return;}
  $('ksTabs').hidden=false;$('ksTop').innerHTML='';const S=V.st,c=gCond();
  $('ksTitle').textContent=`みなとスタンド ${stName(S.st)}駅${V.rcfg.places[S.place].name}店`;
  const tr=S.trend?V.cfg.trends.find(x=>x.id===S.trend.id):null;
  $('ksSub').textContent=`運行日${gDay()}（開店${gDay()-S.openedDay+1}日目）・${DAYN[c.day]}・${WXN[c.wx]}・${SEAN[c.season]}${tr?'・世の中は'+tr.name:''}・常連 ${S.regulars.length}人`;
  $('ksTabs').querySelectorAll('button').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.tab===V.tab)));
  renderKpi();if(full||V.tab==='log')renderBody(full);}
function renderKpi(){const res=ensureRes();if(!res)return;const o=KC.soFar(V.cfg,res,gT()),P=res.pl;
  const share=res.pl.sales?o.sales/res.pl.sales:0;
  $('ksKpi').innerHTML=`<div><span>きょうの売上（いままで）</span><b>${yen(o.sales)}</b></div><div><span>お客さん</span><b>${num(o.cust)}人</b></div>
    <div><span>見たけど買わなかった</span><b>${num(o.looks)}人</b></div><div><span>粗利（売上−原価）</span><b>${yen(o.sales-o.cogs)}</b></div>
    <div><span>店員</span><b>${curSet().staff}人</b></div><div><span>積み立て</span><b class="${V.st.cash<0?'neg':'pos'}">${man(V.st.cash)}</b></div>`;}
function renderBody(full){const b=$('ksBody'),res=ensureRes();if(!res)return;
  if(V.tab==='log')return renderLog(b,res);
  if(!full)return;
  if(V.tab==='items')renderItems(b,res);else if(V.tab==='layout')renderLayout(b);else if(V.tab==='people')renderPeople(b,res);else if(V.tab==='money')renderMoney(b,res);else renderNews(b);}

/* 売れ行き：いまの時刻までの出来事（新しい順） */
function evText(e){const I=ix(),P=I.P,PS=I.PS,ps=e.ps?(PS[e.ps]||{}).short||e.ps:'';
  if(e.k==='buy')return ['buy',ps+(e.reg?'（常連）':e.mania?'（マニア）':''),e.items.map(([p,q])=>P[p].short+(q>1?'×'+q:'')).join('・')+(e.wait>0.5?`（${Math.round(e.wait*60)}秒待ち）`:''),yen(e.yen)];
  if(e.k==='look')return ['look',ps+(e.reg?'（常連）':''),(e.pid?P[e.pid].short:I.G[e.genre].name)+'… '+e.why,''];
  if(e.k==='review')return ['rv',ps,`${P[e.pid].short}「${e.text}」`,'★'.repeat(e.stars)];
  if(e.k==='sns')return ['sns',ps,`${P[e.pid].short}について投稿${e.good?'':'（不満）'}`,'SNS'];
  if(e.k==='delivery')return ['sys','',`${e.name}が届いた（${e.n}個・${yen(e.cost)}）`,''];
  if(e.k==='restock')return ['sys','',`${e.why}（${e.n}個）`,''];
  if(e.k==='cook')return ['sys','',`${P[e.pid].short}を${e.n}個温めた`,''];
  if(e.k==='waste')return ['sys','',`${P[e.pid].short}を${e.n}個捨てた（${e.why}）`,''];
  if(e.k==='edit')return ['sys','','棚・値段・仕入れを変えた',''];return ['sys','',e.k,''];}
function renderLog(b,res){const k=KC.idxAt(res,gT()),list=res.ev.slice(Math.max(0,k-120),k).reverse();
  b.innerHTML=`<div class="ks-card"><h3><span>売れ行き</span><small>いまの時刻までの出来事・新しい順（会計・見たけど買わなかった・評価・SNS・品出しなど）</small></h3><div class="ks-log">${list.map(e=>{const [c,ps,tx,r]=evText(e);return `<div class="${c}"><time>${fmtT(e.t)}</time><span class="ps">${esc(ps)}</span><span>${esc(tx)}</span><em>${esc(r)}</em></div>`;}).join('')||'<p class="ks-note">まだ何も起きていません。</p>'}</div></div>`;}

/* 商品：値段・仕入れ数・属性・売れ行き・評価 */
function renderItems(b,res){const I=ix(),S=V.st,set=curSet(),si=KC.shelfInfo(V.cfg,set.layout),stock=KC.stockAt(res,gT()),o=KC.soFar(V.cfg,res,gT());
  const tr=S.trend?V.cfg.trends.find(x=>x.id===S.trend.id):null;
  const lostSO={},looked={};const k=KC.idxAt(res,gT());for(let i=0;i<k;i++){const e=res.ev[i];if(e.k==='look'&&e.pid){(e.why==='売り切れ'?lostSO:looked)[e.pid]=((e.why==='売り切れ'?lostSO:looked)[e.pid]||0)+1;}}
  const list=V.cfg.products.filter(p=>V.showAll||si[p.id]);
  const tag=p=>{const t=[];const G=I.G[p.genre];t.push(p.temp==='hot'?'<i class="hot">温</i>':p.temp==='cold'?'<i class="cold">冷</i>':'<i>常温</i>');
    if(p.ease>=5)t.push('<i>手軽</i>');if(p.health>=4)t.push('<i>健康</i>');if(p.sudden)t.push('<i>突発</i>');if(p.genre==='hot')t.push('<i>温め・調理</i>');
    if(p.photo>=0.6)t.push('<i>映え</i>');if(p.regular>=0.6)t.push('<i>常連向き</i>');if(p.mania>=0.4)t.push('<i>マニア</i>');if(G.age)t.push('<i class="age">年齢確認</i>');
    if(G.returnable)t.push('<i>返品できる</i>');if(G.life===0)t.push('<i>その日限り</i>');if(tr&&p.tags.some(x=>tr.tags.includes(x)))t.push(`<i class="trend">${tr.name}</i>`);if((S.buzz[p.id]||0)>0.05)t.push('<i class="trend">SNSで話題</i>');return `<span class="ks-tags">${t.join('')}</span>`;};
  const rep=pid=>{const x=S.rep[pid];if(!x||!x.n)return '<span class="mut">—</span>';const avg=x.sum/x.n,keys=Object.entries(x.keys).sort((a,b)=>b[1]-a[1]).slice(0,2).map(([k2,n])=>({sweetHi:'甘すぎ',sweetLo:'甘さ不足',richHi:'濃い',richLo:'うすい',volLo:'量が少ない',volHi:'多すぎ',priceHi:'高い',priceOk:'安い',good:'満足',warm:'温かい',cold:'冷えてる',crush:'つぶれ'})[k2]+n).join('・');return `★${avg.toFixed(1)}（${x.n}）<br><span class="mut" style="font-size:11px">${keys}</span>`;};
  b.innerHTML=`<div class="ks-card"><h3><span>商品・値段・仕入れ</span><small>値段は「世の中のふつうの値段」との比も出します。仕入れ数は、その日のうちに売る物は1日の合計（朝5割・昼前と午後に2割5分ずつ）、日持ちする物は「裏も合わせた在庫の目標」（朝の便でそこまで足す）</small></h3>
    <label style="font-size:12.5px"><input type="checkbox" id="ksAll" ${V.showAll?'checked':''}> 棚に置いていない商品も出す</label>
    ${narrow()?`<div class="ks-cards">${list.map(p=>{const pr=set.price[p.id]??p.price,ratio=pr/p.price,cr=p.cost/pr,s=si[p.id];
      return `<div class="ks-pc ${s?'':'off'}"><div class="ks-pc-h"><b>${esc(p.name)}</b><span class="mut">${I.G[p.genre].name}</span></div>${tag(p)}
        <div class="ks-pc-g"><span>値段</span><span class="ks-num"><button type="button" data-pr="${p.id}" data-d="-10" aria-label="10円下げる">−</button><b>${yen(pr)}</b><button type="button" data-pr="${p.id}" data-d="10" aria-label="10円上げる">＋</button></span>
          <span>ふつう比・原価率</span><b class="${ratio>1.1?'neg':ratio<0.95?'pos':''}">${Math.round(ratio*100)}%・<span class="${cr>0.7?'neg':''}">${Math.round(cr*100)}%</span></b>
          <span>仕入れ数</span>${s?`<span class="ks-num"><button type="button" data-or="${p.id}" data-d="-1" aria-label="減らす">−</button><b>${set.order[p.id]||0}</b><button type="button" data-or="${p.id}" data-d="1" aria-label="増やす">＋</button></span>`:'<span class="mut">棚になし</span>'}
          <span>棚・いま</span><b>${s?`${s.face}列×${Math.round(s.cap/s.face)}・${stock[p.id]||0}個`:'—'}</b>
          <span>きょう</span><b>売れた${o.items[p.id]||0}・<span class="${lostSO[p.id]?'neg':''}">売切で逃した${lostSO[p.id]||0}</span>・見て買わず${looked[p.id]||0}</b>
          <span>評価</span><span>${rep(p.id)}</span></div></div>`;}).join('')}</div>`:`
    <div class="ks-scroll" style="margin-top:6px"><table class="ks-t" style="min-width:1100px"><thead><tr><th class="l">商品</th><th class="l">ようす</th><th>値段</th><th>ふつう比</th><th>原価（原価率）</th><th>仕入れ数</th><th>棚（列×奥）</th><th>いまの棚</th><th>きょう売れた</th><th>売切で逃した</th><th>見て買わず</th><th class="l">評価</th></tr></thead><tbody>
    ${list.map(p=>{const pr=set.price[p.id]??p.price,ratio=pr/p.price,cr=p.cost/pr,s=si[p.id];
      return `<tr class="${s?'':'off'}"><td class="l"><b>${esc(p.name)}</b><br><span class="mut" style="font-size:11px">${I.G[p.genre].name}</span></td><td class="l">${tag(p)}</td>
      <td><span class="ks-num"><button type="button" data-pr="${p.id}" data-d="-10" aria-label="10円下げる">−</button><b>${yen(pr)}</b><button type="button" data-pr="${p.id}" data-d="10" aria-label="10円上げる">＋</button></span></td>
      <td class="${ratio>1.1?'neg':ratio<0.95?'pos':''}">${Math.round(ratio*100)}%</td><td class="${cr>0.7?'neg':''}">${yen(p.cost)}（${Math.round(cr*100)}%）</td>
      <td>${s?`<span class="ks-num"><button type="button" data-or="${p.id}" data-d="-1">−</button><b>${set.order[p.id]||0}</b><button type="button" data-or="${p.id}" data-d="1">＋</button></span>`:'<span class="mut">棚になし</span>'}</td>
      <td>${s?`${s.face}×${Math.round(s.cap/s.face)}`:'—'}</td><td>${s?(stock[p.id]||0):'—'}</td><td>${o.items[p.id]||0}</td><td class="${lostSO[p.id]?'neg':''}">${lostSO[p.id]||0}</td><td>${looked[p.id]||0}</td><td class="l">${rep(p.id)}</td></tr>`;}).join('')}
    </tbody></table></div>`}<p class="ks-note">原価率が7割を超える品（たばこ・新聞・雑誌など）は、売れても残るお金が少ない品です。値段を上げすぎると、値段に敏感な客層（学生・買い物の人）から買わなくなります。棚に新しく置いた品は、次の便から並びます。</p></div>`;
  $('ksAll').onchange=e=>{V.showAll=e.target.checked;render(true);};
  b.querySelectorAll('[data-pr]').forEach(x=>x.onclick=()=>edit(c=>{const pid=x.dataset.pr;c.price[pid]=Math.max(10,(c.price[pid]??I.P[pid].price)+Number(x.dataset.d));}));
  b.querySelectorAll('[data-or]').forEach(x=>x.onclick=()=>edit(c=>{const pid=x.dataset.or,st=I.G[I.P[pid].genre].life===0?1:2;c.order[pid]=Math.max(0,(c.order[pid]||0)+Number(x.dataset.d)*st);}));}

/* 棚割り：区画ごとの枠に、どの品を置くか */
function renderLayout(b){const I=ix(),set=curSet(),Z=V.cfg.zones,sel=V.slotSel;
  let pick='';if(sel){const z=Z[sel.z],cur=set.layout[sel.z][sel.i],ok=V.cfg.products.filter(p=>I.G[p.genre].zones.includes(sel.z));
    pick=`<div class="ks-pick"><span>${z.name}の${Math.floor(sel.i/z.cols)+1}段目・${sel.i%z.cols+1}列目：</span><select id="ksPickSel"><option value="">（空ける）</option>${ok.map(p=>`<option value="${p.id}" ${p.id===cur?'selected':''}>${esc(p.name)}（${yen(set.price[p.id]??p.price)}）</option>`).join('')}</select>
      <button type="button" class="ks-btn" id="ksPickClose">閉じる</button><span class="ks-note" style="margin:0">同じ品を隣の枠にも置くと「列」が増え、目につきやすく、たくさん並べられます。</span></div>`;}
  b.innerHTML=`<div class="ks-card"><h3><span>棚割り</span><small>枠を押して、置く品を選びます（区画ごとに置ける品が決まっています）</small></h3>
    <div class="ks-zones" style="margin-top:10px">${Object.entries(Z).map(([zk,z])=>`<div class="ks-zone"><h4>${z.name}<small>${z.rows}段×${z.cols}列・1列に${z.depth}個</small></h4>
      <div class="ks-grid" style="grid-template-columns:repeat(${z.cols},minmax(0,1fr))">${(set.layout[zk]||[]).map((pid,i)=>{const p=pid&&I.P[pid];return `<button type="button" class="ks-slot ${p?'':'empty'}" data-z="${zk}" data-i="${i}" aria-pressed="${!!(sel&&sel.z===zk&&sel.i===i)}">${p?esc(p.short):'空き'}${p?`<i style="background:${p.color}"></i>`:''}</button>`;}).join('')}</div></div>`).join('')}</div>
    ${pick}<p class="ks-note">目の高さ（冷蔵ケースの2・3段目、中央の棚の2・3段目など）ほど目につきます。いま置いていない品：${V.cfg.products.filter(p=>!KC.shelfInfo(V.cfg,set.layout)[p.id]).map(p=>p.short).join('・')}</p></div>`;
  b.querySelectorAll('.ks-slot').forEach(x=>x.onclick=()=>{V.slotSel={z:x.dataset.z,i:Number(x.dataset.i)};render(true);});
  if($('ksPickSel'))$('ksPickSel').onchange=e=>{const {z,i}=V.slotSel,v=e.target.value||null;edit(c=>{c.layout[z][i]=v;if(v&&!c.order[v])c.order[v]=KC.defaultOrder(V.cfg,v,V.cfg.zones[z].depth);});};
  if($('ksPickClose'))$('ksPickClose').onclick=()=>{V.slotSel=null;render(true);};}

/* 客層・時間帯・買わなかった理由・置いていなくて帰った人 */
function renderPeople(b,res){const I=ix(),T0=gT(),k=KC.idxAt(res,T0),ps={},psLook={},why={},miss={},hr=new Float64Array(H),items={};
  for(let i=0;i<k;i++){const e=res.ev[i];if(e.k==='buy'){ps[e.ps]=(ps[e.ps]||0)+1;hr[Math.floor(e.t/60)]+=e.yen;const m=items[e.ps]||(items[e.ps]={});for(const [p,q] of e.items)m[p]=(m[p]||0)+q;}
    else if(e.k==='look'){psLook[e.ps]=(psLook[e.ps]||0)+1;why[e.why]=(why[e.why]||0)+1;if(e.why==='置いていない')miss[e.genre]=(miss[e.genre]||0)+1;}}
  const mx=Math.max(1,...Object.values(ps)),hm=Math.max(1,...hr),hN=Math.floor(T0/60);
  b.innerHTML=`<div class="ks-g2"><div class="ks-card"><h3><span>買った人の客層</span><small>いままで</small></h3><div class="ks-bars">${V.cfg.personas.map(p=>`<div><span>${p.name}</span><u style="width:${(ps[p.id]||0)/mx*100}%;background:${p.icon}"></u><em>${ps[p.id]||0}人</em></div>`).join('')}</div>
      <p class="ks-note">客層ごとのよく買う品：${V.cfg.personas.filter(p=>items[p.id]).map(p=>`${p.short}＝${Object.entries(items[p.id]).sort((a,b)=>b[1]-a[1]).slice(0,2).map(([x])=>I.P[x].short).join('・')}`).join('／')||'—'}</p></div>
    <div class="ks-card"><h3><span>見たけど買わなかった理由</span></h3><div class="ks-bars">${Object.entries(why).sort((a,b)=>b[1]-a[1]).map(([w,n])=>`<div><span>${w}</span><u style="width:${n/Math.max(...Object.values(why))*100}%;background:#c9a35c"></u><em>${n}人</em></div>`).join('')||'<p class="ks-note">まだいません。</p>'}</div>
      <p class="ks-note">置いていなくて帰った人がほしかった物：${Object.entries(miss).map(([gid,n])=>I.G[gid].name+' '+n+'人').join('・')||'—'}</p></div>
    <div class="ks-card"><h3><span>時間帯の売上</span><small>いまの時刻まで</small></h3><div class="ks-hrs">${Array.from({length:19},(_,j)=>{const h=j+5;return `<span class="${h===hN?'now':''}" style="height:${hr[h]/hm*100}%" title="${h}時台 ${yen(hr[h])}"></span>`;}).join('')}</div><div class="ks-hlab"><span>5時</span><span>9</span><span>13</span><span>17</span><span>21</span><span>23時</span></div></div></div>`;}

/* 収支 */
function renderMoney(b,res){const S=V.st,P=res.pl,o=KC.soFar(V.cfg,res,gT());
  const row=(n,v,cls)=>`<tr><td class="l">${n}</td><td class="${cls||''}">${yen(v)}</td></tr>`;
  b.innerHTML=`<div class="ks-g2"><div class="ks-card"><h3><span>きょう1日の見込み</span><small>このまま閉店まで続けた場合（いまの設定で）</small></h3><table class="ks-t"><tbody>
      ${row('売上',P.sales)}${row('仕入れ原価（売れた分）',-P.cogs,'mut')}${row('廃棄（売れ残り・保温切れ）',-P.waste,'mut')}${row('人件費',-P.staff,'mut')}${row('場所代（売上の'+Math.round(V.rcfg.places[S.place].rentRate*100)+'%か最低額）',-P.rent,'mut')}${row('電子マネーの手数料',-P.fee,'mut')}${row('電気代など',-P.util,'mut')}
      <tr><td class="l"><b>損益</b></td><td class="${P.profit<0?'neg':'pos'}"><b>${yen(P.profit)}</b></td></tr></tbody></table>
      <p class="ks-note">いまの時刻までの売上は ${yen(o.sales)}。新聞・雑誌の売れ残りは返品するので、捨てる分には入りません。</p></div>
    <div class="ks-card"><h3><span>これまでの運行日</span><small>積み立て ${man(S.cash)}</small></h3><div class="ks-scroll" style="max-height:300px"><table class="ks-t"><thead><tr><th class="l">運行日</th><th>客</th><th>売上</th><th>廃棄</th><th>損益</th><th class="l">売れ筋</th></tr></thead><tbody>
      ${S.hist.slice().reverse().map(h=>`<tr><td class="l">${h.day}（${DAYN[h.cond.day]}・${WXN[h.cond.wx]}）</td><td>${h.cust}</td><td>${yen(h.sales)}</td><td>${yen(h.waste)}</td><td class="${h.profit<0?'neg':'pos'}">${yen(h.profit)}</td><td class="l">${h.top.slice(0,3).map(([p,q])=>ix().P[p].short+q).join('・')}</td></tr>`).join('')||'<tr><td class="l" colspan="6">まだ締めた日はありません（26:00を過ぎると締めます）。</td></tr>'}</tbody></table></div>
      <div style="margin-top:10px;display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span style="font-size:12.5px">店員の人数</span>${[1,2,3].map(n=>`<button type="button" class="ks-chip" data-staff="${n}" aria-pressed="${curSet().staff===n}">${n}人</button>`).join('')}<span class="ks-note" style="margin:0">ふやすと列が短くなり、電車の時間で帰る人が減ります。人件費は1人1時間${yen(V.cfg.wage)}。</span></div></div></div>`;
  b.querySelectorAll('[data-staff]').forEach(x=>x.onclick=()=>edit(c=>{c.staff=Number(x.dataset.staff);}));}
function renderNews(b){const S=V.st,list=S.news.slice().reverse();
  b.innerHTML=`<div class="ks-card"><h3><span>お知らせ</span><small>ブーム・SNS・常連・評価・売り切れ・廃棄など（運行日の終わりに届きます）</small></h3><div class="ks-news">${list.map(n=>`<div class="${n.kind}"><b>${esc(n.title)}</b><small>運行日${n.day}</small> ${esc(n.text)}</div>`).join('')||'<p class="ks-note">まだありません。</p>'}</div></div>`;}

/* ---------- 売店の正面の絵 ---------- */
const BOX={hook:[136,118,170,190],top:[320,110,380,40],fridge:[136,316,190,190],shelf:[336,160,190,346],tobacco:[540,160,170,44],hot:[724,250,110,80],warmer:[724,334,110,30],umbrella:[690,372,30,134],rack:[860,150,110,356]};
function zoneSlots(zk){const z=V.cfg.zones[zk],[x,y,w,h]=BOX[zk],out=[];const cw=w/z.cols,rh=h/z.rows;for(let i=0;i<z.rows*z.cols;i++){const r=Math.floor(i/z.cols),c=i%z.cols;out.push([x+c*cw,y+r*rh,cw,rh]);}return out;}
function rr(c,x,y,w,h,r){c.beginPath();c.roundRect(x,y,w,h,r);}
function drawItem(c,p,x,y,w,h,k){const col=p.color,gid=p.genre;c.save();
  if(gid==='onigiri'){for(let j=0;j<k;j++){const xx=x+4+j*(w-8)/Math.max(1,k);c.fillStyle='#f4f1e6';c.beginPath();c.moveTo(xx+w*0.14,y+h*0.25);c.lineTo(xx,y+h*0.85);c.lineTo(xx+w*0.28,y+h*0.85);c.closePath();c.fill();c.fillStyle='#1d2b22';c.fillRect(xx+w*0.06,y+h*0.62,w*0.16,h*0.23);}}
  else if(gid==='colddrink'||gid==='coffee'||gid==='energy'||gid==='alcohol'||gid==='hotdrink'){const can=gid!=='colddrink';for(let j=0;j<Math.min(3,k);j++){const bw=can?w*0.22:w*0.2,xx=x+3+j*(w-6)/3;c.fillStyle=col;rr(c,xx,y+(can?h*0.3:h*0.12),bw,h*(can?0.62:0.8),2);c.fill();c.fillStyle='rgba(255,255,255,.35)';c.fillRect(xx+1,y+h*0.4,2,h*0.3);if(!can){c.fillStyle='#ddd';c.fillRect(xx+bw*0.3,y+h*0.05,bw*0.4,h*0.08);}}}
  else if(gid==='bread'||gid==='donut'||gid==='hot'){for(let j=0;j<Math.min(3,k);j++){const xx=x+w*0.18+j*w*0.3;c.fillStyle=col;c.beginPath();c.ellipse(xx,y+h*0.62,w*0.15,h*0.26,0,0,7);c.fill();if(gid==='donut'){c.fillStyle='rgba(0,0,0,.25)';c.beginPath();c.arc(xx,y+h*0.62,w*0.04,0,7);c.fill();}}}
  else if(gid==='sand'){for(let j=0;j<Math.min(2,k);j++){const xx=x+4+j*w*0.45;c.fillStyle='#fbf6e8';c.beginPath();c.moveTo(xx,y+h*0.85);c.lineTo(xx+w*0.38,y+h*0.85);c.lineTo(xx+w*0.38,y+h*0.25);c.closePath();c.fill();c.fillStyle=col;c.fillRect(xx+w*0.05,y+h*0.62,w*0.3,h*0.08);}}
  else if(gid==='paper'||gid==='magazine'){for(let j=0;j<Math.min(3,k);j++){c.fillStyle=gid==='paper'?'#eeeee6':col;rr(c,x+6+j*3,y+4+j*2,w-22,h-12,2);c.fill();c.fillStyle=gid==='paper'?col:'rgba(255,255,255,.7)';c.fillRect(x+10+j*3,y+8+j*2,w-32,6);}}
  else if(gid==='tobacco'){for(let j=0;j<Math.min(4,k);j++){c.fillStyle=col;c.fillRect(x+3+j*(w-6)/4,y+h*0.2,(w-6)/4-2,h*0.7);c.fillStyle='rgba(0,0,0,.2)';c.fillRect(x+3+j*(w-6)/4,y+h*0.2,(w-6)/4-2,3);}}
  else if(gid==='umbrella'){for(let j=0;j<Math.min(8,k);j++){c.strokeStyle=j%3===2?'#2b3d6b':'#c9dde6';c.lineWidth=4;c.beginPath();c.moveTo(x+6+j*2.6,y+10);c.lineTo(x+8+j*2.6,y+h-4);c.stroke();}}
  else{for(let j=0;j<Math.min(2,k);j++){c.fillStyle=col;rr(c,x+3+j*w*0.46,y+h*0.12,w*0.42,h*0.8,3);c.fill();c.fillStyle='rgba(255,255,255,.4)';c.fillRect(x+5+j*w*0.46,y+h*0.2,w*0.3,h*0.12);}}
  c.restore();}
function drawKiosk(c,res,Tn){const I=ix(),set=curSet(),si=KC.shelfInfo(V.cfg,set.layout),stock=res?KC.stockAt(res,Tn):{};const W=1000;
  // ホーム
  c.fillStyle='#3a3f44';c.fillRect(0,0,W,30);c.fillStyle='#c9c6be';c.fillRect(0,30,W,470);c.fillStyle='#a7a49b';c.fillRect(0,500,W,100);c.fillStyle='#e2c84a';c.fillRect(0,588,W,8);
  for(const x of [60,950]){c.fillStyle='#d4d1c9';c.fillRect(x-10,30,20,470);c.fillStyle='#c4302b';for(let y=180;y<300;y+=24)c.fillRect(x-10,y,20,10);}
  // 本体と看板
  c.fillStyle='#d8d3c6';c.fillRect(110,40,880-110+100,470);c.fillStyle='#f6f4ef';rr(c,110,40,870,64,4);c.fill();
  c.fillStyle='#d33a3a';c.fillRect(124,56,120,8);c.fillRect(124,72,120,8);c.fillStyle='#22313a';c.font='700 30px "Zen Kaku Gothic New",sans-serif';c.textAlign='left';c.fillText('みなとスタンド',258,84);
  c.font='700 34px "Zen Kaku Gothic New",sans-serif';c.fillText('売店',520,86);c.fillStyle='#2f8a6e';rr(c,820,52,140,40,4);c.fill();c.fillStyle='#fff';c.font='700 13px sans-serif';c.fillText('電子マネー',840,70);c.fillText('使えます',846,86);
  c.fillStyle='#efece4';c.fillRect(124,104,746,402);
  // 区画の下地
  const bg={hook:'#e9e6df',top:'#efece4',fridge:'#dfe7ea',shelf:'#f1ebdd',tobacco:'#d9d3c3',hot:'#f3d9a6',warmer:'#efd0b8',umbrella:'#e6e3dc',rack:'#f4f4f0'};
  for(const zk in BOX){const [x,y,w,h]=BOX[zk];c.fillStyle=bg[zk];c.fillRect(x-2,y-2,w+4,h+4);if(zk==='fridge'||zk==='hot'){c.strokeStyle=zk==='hot'?'#b48a3a':'#9fb3bb';c.lineWidth=3;c.strokeRect(x-3,y-3,w+6,h+6);}}
  // 商品
  for(const zk in BOX){const z=V.cfg.zones[zk],sl=zoneSlots(zk),arr=set.layout[zk]||[];
    arr.forEach((pid,i)=>{const [x,y,w,h]=sl[i];if(zk==='shelf'||zk==='fridge'||zk==='hook'){c.fillStyle='rgba(0,0,0,.12)';c.fillRect(x,y+h-3,w,2);}if(!pid)return;const p=I.P[pid],s=si[pid];
      const per=s?(stock[pid]||0)/s.face:0,k=Math.max(0,Math.ceil(Math.min(z.depth,per)/z.depth*3-1e-6)*(zk==='umbrella'?2.6:1));
      if(k>0)drawItem(c,p,x+1,y+1,w-2,h-6,zk==='umbrella'?Math.ceil(per/2):k);
      // 値札・売切
      const pr=set.price[pid]??p.price;c.fillStyle=(stock[pid]||0)<=0?'#d8382e':'#ffffff';c.fillRect(x+2,y+h-11,Math.min(w-4,42),9);c.fillStyle=(stock[pid]||0)<=0?'#fff':'#333';c.font='8px sans-serif';c.textAlign='left';c.fillText((stock[pid]||0)<=0?'売切':pr+'円',x+4,y+h-4);});}
  c.fillStyle='#55504a';c.font='11px sans-serif';c.textAlign='left';c.fillText('たばこ（年齢確認）',540,156);c.fillText('ホットスナック',724,246);
  // 会計カウンターと店員
  c.fillStyle='#b9b2a3';c.fillRect(540,330,180,40);c.fillStyle='#e9e5dc';c.fillRect(540,370,150,136);c.fillStyle='#4a5056';rr(c,600,300,70,34,4);c.fill();c.fillStyle='#9fd3c7';c.fillRect(608,306,40,12);
  c.fillStyle='#2f8a6e';rr(c,560,392,70,28,3);c.fill();c.fillStyle='#fff';c.font='700 11px sans-serif';c.fillText('お会計',574,410);
  const n=curSet().staff;for(let i=0;i<n;i++){const sx=580+i*55,sy=262;c.fillStyle='#f0c9a0';c.beginPath();c.arc(sx,sy,13,0,7);c.fill();c.fillStyle='#24345a';c.beginPath();c.arc(sx,sy-4,13,Math.PI,0);c.fill();c.fillRect(sx-16,sy+12,32,30);c.fillStyle='#fff';c.fillRect(sx-6,sy+14,12,26);}
  // ラックの名札
  c.fillStyle='#55504a';c.fillText('新聞・雑誌',870,146);}
function personColor(ps){const p=ix().PS[ps];return p?p.icon:'#555';}
function spawnFromEvent(e){const I=ix();const pid=e.pid||(e.items&&e.items[0][0]);let zx=480;if(pid){for(const zk in BOX){const arr=curSet().layout[zk]||[],i=arr.indexOf(pid);if(i>=0){const sl=zoneSlots(zk)[i];zx=sl[0]+sl[2]/2;break;}}}
  const from=Math.random()<0.5?-30:1030,y=540+Math.random()*40;
  const P0={x:from,y,tx:clampX(zx),ty:y,ps:e.ps,col:personColor(e.ps),st:0,t:0,e,walk:0,kid:e.ps==='jk'||e.ps==='stu'};
  V.people.push(P0);if(V.people.length>24)V.people.shift();}
const clampX=x=>Math.max(60,Math.min(980,x));
function bubble(x,y,text,col,sub){V.bubbles.push({x,y,text,col,sub,t:0});if(V.bubbles.length>10)V.bubbles.shift();}
function stepPeople(dt,mv){const I=ix();for(const p of V.people){const sp=110*mv*dt;
  if(p.st===0){const dx=p.tx-p.x;if(Math.abs(dx)<4){p.st=1;p.t=0;}else{p.x+=Math.sign(dx)*Math.min(Math.abs(dx),sp);p.walk+=sp;p.dir=Math.sign(dx);}}
  else if(p.st===1){p.t+=dt*mv;if(p.t>1.4){const e=p.e;
      if(e.k==='buy'){p.tx=clampX(610+Math.random()*30);p.st=2;}
      else{const why=e.why;bubble(p.x,p.y-90,why==='値段が高い'?'高いなあ…':why==='売り切れ'?'売り切れか…':why==='置いていない'?I.G[e.genre].name+'、ないのか':why==='列が長い'?'電車が来ちゃう':'うーん…','#ffe7a3',(I.PS[e.ps]||{}).short);p.st=3;p.tx=Math.random()<0.5?-40:1040;}}}
  else if(p.st===2){const dx=p.tx-p.x;if(Math.abs(dx)<4){p.t+=dt*mv;if(!p.paid){p.paid=true;const e=p.e;bubble(p.x,p.y-96,'+'+yen(e.yen)+'　'+e.items.map(([q])=>I.P[q].short).join('・'),'#bff0c8',(I.PS[e.ps]||{}).short+(e.reg?'・常連':e.mania?'・マニア':''));}
      if(p.t>2.2){p.st=3;p.tx=Math.random()<0.5?-40:1040;}}else{p.x+=Math.sign(dx)*Math.min(Math.abs(dx),110*mv*dt);p.walk+=110*mv*dt;}}
  else{const dx=p.tx-p.x;p.x+=Math.sign(dx)*Math.min(Math.abs(dx),130*mv*dt);p.walk+=130*mv*dt;if(Math.abs(dx)<4)p.gone=true;}}
  V.people=V.people.filter(p=>!p.gone);}
function drawPerson(c,p){const s=p.kid?0.85:1;c.save();c.translate(p.x,p.y);c.scale(s,s);const step=Math.sin(p.walk*0.12)*3;
  c.fillStyle='rgba(0,0,0,.18)';c.beginPath();c.ellipse(0,0,13,4,0,0,7);c.fill();c.strokeStyle='#2a2a30';c.lineWidth=5;c.lineCap='round';c.beginPath();c.moveTo(-3,-26);c.lineTo(-3+step,-2);c.moveTo(3,-26);c.lineTo(3-step,-2);c.stroke();
  c.fillStyle=p.col;rr(c,-11,-64,22,40,6);c.fill();if(p.ps==='jk'){c.fillStyle='#24345a';c.fillRect(-11,-34,22,10);c.fillStyle='#d33a3a';c.fillRect(-3,-60,6,6);}
  c.fillStyle='#f0c9a0';c.beginPath();c.arc(0,-74,10,0,7);c.fill();c.fillStyle=p.ps==='sen'?'#bdbdbd':'#2b2016';c.beginPath();c.arc(0,-77,10,Math.PI*1.05,Math.PI*1.95);c.fill();
  if(p.ps==='jk'){c.fillRect(-10,-78,4,16);c.fillRect(6,-78,4,16);}c.restore();}
function draw(dt,time){const c=V.cx,Tn=gT();if(!c)return;c.clearRect(0,0,1000,600);
  if(!V.st){c.fillStyle='#2a2f33';c.fillRect(0,0,1000,600);c.fillStyle='#fff';c.font='16px sans-serif';c.textAlign='center';c.fillText('売店を出す場所を選んでください',500,300);return;}
  const res=ensureRes();drawKiosk(c,res,Tn);
  const mult=g(()=>playing,true)?Math.max(0,g(()=>speed,1/60)*60):0,mv=Math.min(6,Math.max(1,mult));
  // 出来事から人を出す（速いときは、絵にするのは1秒に3人まで。全部は「売れ行き」に出る）
  if(res){if(V.lastT==null||Tn<V.lastT-0.01||Tn-V.lastT>20){V.evI=KC.idxAt(res,Tn);V.people=[];}
    V.spawnBudget=Math.min(3,(V.spawnBudget||0)+dt*3);
    while(V.evI<res.ev.length&&res.ev[V.evI].t<=Tn){const e=res.ev[V.evI++];
      if((e.k==='buy'||e.k==='look')&&V.spawnBudget>=1){V.spawnBudget-=1;spawnFromEvent(e);}
      else if(e.k==='review'&&V.spawnBudget>=0.5){bubble(300+Math.random()*400,470,'★'.repeat(e.stars)+'「'+e.text+'」','#fff2c2',ix().P[e.pid].short);}
      else if(e.k==='sns'){bubble(200+Math.random()*600,440,(e.good?'SNSに投稿：':'SNSに不満：')+ix().P[e.pid].short,'#c9dcff',(ix().PS[e.ps]||{}).short);}
      else if(e.k==='delivery'){bubble(500,140,e.name+'が届いた','#e6e6e6','');}}
    V.lastT=Tn;}
  stepPeople(dt,mv);for(const p of V.people.slice().sort((a,b)=>a.y-b.y))drawPerson(c,p);
  V.bubbles=V.bubbles.filter(b=>(b.t+=dt)<3.2);
  for(const b of V.bubbles){const a=Math.min(1,b.t*3,(3.2-b.t)*1.5);c.globalAlpha=a;c.font='13px "Zen Kaku Gothic New",sans-serif';const w=Math.min(380,c.measureText(b.text).width+20),x=Math.max(10,Math.min(990-w,b.x-w/2)),y=b.y-b.t*10;
    c.fillStyle=b.col;rr(c,x,y,w,b.sub?36:22,8);c.fill();c.fillStyle='#1c2826';c.textAlign='left';c.fillText(b.text,x+10,y+15);if(b.sub){c.fillStyle='#5b6a66';c.font='11px sans-serif';c.fillText(b.sub,x+10,y+30);}c.globalAlpha=1;}
  // 時計
  c.fillStyle='rgba(15,20,24,.82)';rr(c,10,8,96,26,5);c.fill();c.fillStyle='#ffb347';c.font='700 18px "DotGothic16",monospace';c.textAlign='left';c.fillText(fmtT(Tn),20,28);
  const O0=V.cfg.open[0]*60,O1=V.cfg.open[1]*60;if(Tn<O0||Tn>=O1){c.fillStyle='rgba(20,24,28,.55)';c.fillRect(124,104,746,402);c.fillStyle='#fff';c.font='700 22px sans-serif';c.textAlign='center';c.fillText(Tn<O0?'開店前（6:00から）':'本日の営業は終わりました',497,300);}}
function onCanvasClick(ev){if(!V.st)return;const r=V.cv.getBoundingClientRect(),x=(ev.clientX-r.left)*1000/r.width,y=(ev.clientY-r.top)*600/r.height;
  for(const zk in BOX){const sl=zoneSlots(zk);for(let i=0;i<sl.length;i++){const [sx,sy,sw,sh]=sl[i];if(x>=sx&&x<=sx+sw&&y>=sy&&y<=sy+sh){V.tab='layout';V.slotSel={z:zk,i};render(true);$('ksBody').scrollIntoView({behavior:'smooth',block:'start'});return;}}}}
function loop(ts){const dt=V.lastTs?Math.min(0.1,(ts-V.lastTs)/1000):0;V.lastTs=ts;if(!V.open)return;
  if(V.cfg)draw(dt,ts/1000);V.panelT+=dt;if(V.panelT>0.6){V.panelT=0;if(V.st){renderKpi();if(V.tab==='log')renderBody(false);}}
  V.heavyT+=dt;if(V.heavyT>4){V.heavyT=0;if(V.st&&(V.tab==='items'||V.tab==='people'||V.tab==='money')&&!document.activeElement.closest?.('#ksBody'))renderBody(true);}
  V.raf=requestAnimationFrame(loop);}

/* ---------- 起動 ---------- */
mount();setInterval(tick,1000);
window.minatoKiosk={get state(){return V.st;},get today(){return V.res;},open:()=>setOpen(true),
  closeToday(){const r=ensureRes();if(r){closeToday(r);g(()=>{ENS.day=ENS.day;});}return V.st&&V.st.hist.at(-1);},   // 開発用：きょうの分で1日を締める（運行日は進めない）
  reset(){try{localStorage.removeItem(KEY);}catch(e){}V.st=null;V.res=null;render(true);badge();}};
})();
