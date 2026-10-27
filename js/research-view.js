/* =====================================================================
   駅ナカ リサーチ（第1段）の表示
   ・計算は js/research-core.js、設定は data/research.json。ここは画面だけ。
   ・ゲームの時計（T）・運行日（ENS.day）・その日の条件（COND）・シミュレーション結果（D）を読むだけで、
     ゲームの数値は変えない。
   ・調査は運行日を使う。26:00をまたいで沿線暦が次の運行日へ進むと、終わった日の分が1日分の記録になる。
   ===================================================================== */
(function(){
'use strict';
if(typeof ResearchCore==='undefined')return;
const RC=ResearchCore,KEY='dia-research',H=RC.H;
const STORDER=['C','S','U','M','K','N','P','F','T','O'];
const $=id=>document.getElementById(id);
const g=(f,d)=>{try{return f();}catch(e){return d;}};
const gT=()=>g(()=>T,600),gD=()=>g(()=>D,null),gDay=()=>g(()=>ENS.day,1),gCond=()=>g(()=>COND,{day:'wd',wx:'sun',season:'aut',evs:[]});
const stName=s=>g(()=>ST[s].name,s);
const fmtT=t=>g(()=>fmt(t),'');
const man=n=>(n<0?'−':'')+(Math.abs(n)>=1e8?(Math.abs(n)/1e8).toFixed(1)+'億円':Math.abs(n)>=1e4?(Math.abs(n)/1e4).toFixed(Math.abs(n)>=1e6?0:1)+'万円':Math.round(Math.abs(n)).toLocaleString('ja-JP')+'円');
const num=n=>Math.round(n).toLocaleString('ja-JP');
const pct=(x,d=0)=>(x*100).toFixed(d)+'%';
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);
const DAYN={wd:'平日',sat:'土曜',hol:'日曜・祝日'},WXN={sun:'晴れ',cld:'くもり',rain:'雨',snow:'大雪'},SEAN={spr:'春',sum:'夏',aut:'秋',win:'冬'};
const PCOL=['var(--p1,#3a64b8)','var(--p2,#7a5bb5)','var(--p3,#d9822b)','var(--p4,#2f8a6e)'];

const V={cfg:null,err:null,st:null,open:false,sel:null,form:{st:'C',place:'naka',count:true,interview:true,days:7},est:{type:'unmanned',dev:false},
  today:null,prov:null,provKey:'',lastDay:null,cv:null,cx:null,raf:0,lastTs:0,walkers:[],bubbles:[],bubT:0,panelT:0,seenV:0};

/* ---------- 保存 ---------- */
function blank(){return {v:1,seed:(Date.now()%100000)+1,studies:[],active:null,news:0};}
function load(){fetch('data/research.json').then(r=>{if(!r.ok)throw new Error('HTTP '+r.status);return r.json();}).then(c=>{V.cfg=c;
    try{const s=JSON.parse(localStorage.getItem(KEY)||'null');V.st=s&&s.v===1?s:blank();}catch(e){V.st=blank();}
    V.lastDay=gDay();V.sel=V.st.active||(V.st.studies.at(-1)||{}).id||null;badge();if(V.open)render(true);})
  .catch(e=>{V.err=String(e.message||e);if(V.open)render(true);});}
function persist(){try{localStorage.setItem(KEY,JSON.stringify(V.st));}catch(e){}}
const study=id=>V.st&&V.st.studies.find(s=>s.id===id);
const activeStudy=()=>V.st&&V.st.active?study(V.st.active):null;

/* ---------- その日の材料（終わった日の分を記録するため、日が進む前に覚えておく） ---------- */
function ctxFor(st,place){const d=gD();if(!d||!d.sim)return null;const s=d.sim.stat[st];if(!s)return null;
  const stops=new Array(H).fill(0);for(const t of d.trips){const i=t.seq.indexOf(st);if(i>=0&&t.stop[i])stops[Math.min(H-1,Math.floor(t.arr[i]/60))]++;}
  const c=gCond(),ev=g(()=>ACTIVE_EV.filter(e=>e.place===st).map(e=>e.name),[]);
  return {day:gDay(),st,place,cond:{day:c.day,wx:c.wx,season:c.season},ev,flows:{hb:s.hb.map(a=>Array.from(a)),ha:s.ha.map(a=>Array.from(a))},stops,plats:g(()=>ST[st].plats,2),year:Math.floor(gDay()/365)};}
function tick(){if(!V.cfg)return;const a=activeStudy(),day=gDay();
  if(day!==V.lastDay){
    if(day>V.lastDay&&a&&V.today&&V.today.day===V.lastDay&&V.today.st===a.st&&V.today.place===a.place)addRecord(a,V.today);
    if(day<V.lastDay&&a){/* 沿線暦を最初からやり直したときは、調査の続きの日を合わせる */}
    V.lastDay=day;V.prov=null;}
  if(a){const c=ctxFor(a.st,a.place);if(c)V.today=c;}}
function addRecord(a,ctx){const rec=RC.dayRecord(V.cfg,{...ctx,seed:V.st.seed,methods:a.m});a.recs.push(rec);a.spent=(a.spent||0)+rec.cost;
  if(a.recs.length>=a.days){a.status='done';V.st.active=null;if(!V.open)V.st.news++;}
  persist();badge();if(V.open)render(true);}
function startStudy(){const f=V.form;if(!f.count&&!f.interview)return;
  const id='s'+Date.now().toString(36);V.st.studies.push({id,st:f.st,place:f.place,m:{count:f.count,interview:f.interview},days:f.days,startDay:gDay(),recs:[],status:'active',spent:0});
  V.st.active=id;V.sel=id;V.today=null;V.prov=null;persist();render(true);}
function stopStudy(){const a=activeStudy();if(!a)return;a.status=a.recs.length?'done':'cancel';V.st.active=null;if(!a.recs.length)V.st.studies=V.st.studies.filter(s=>s!==a);V.sel=a.recs.length?a.id:(V.st.studies.at(-1)||{}).id||null;persist();render(true);}

/* ---------- 骨組み ---------- */
const CSS=`
.rsv{position:fixed;inset:0;z-index:66;background:var(--paper);color:var(--ink);overflow:auto;padding:calc(env(safe-area-inset-top,0px) + 10px) max(14px,env(safe-area-inset-right,0px)) calc(env(safe-area-inset-bottom,0px) + 24px) max(14px,env(safe-area-inset-left,0px))}
.rsv[hidden]{display:none!important}
.rs-in{max-width:1180px;margin:0 auto;display:grid;gap:12px}
.rs-hd{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px}.rs-hd h2{margin:0;font-size:19px}.rs-hd small{font-size:12px;color:var(--muted)}.rs-sp{flex:1}
.rs-btn{font:inherit;font-size:13px;border:1px solid var(--line);background:var(--panel);color:var(--ink);border-radius:7px;padding:6px 11px;cursor:pointer}
.rs-btn.pri{background:var(--accent);color:var(--accent-ink);border-color:var(--accent);font-weight:700}
.rs-btn:disabled{opacity:.45;cursor:default}
.rs-btn:focus-visible,.rs-chip:focus-visible,.rs-place:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.rs-card{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:12px 14px;min-width:0}
.rs-card h3{margin:0 0 8px;font-size:14px;display:flex;justify-content:space-between;gap:8px;align-items:baseline;flex-wrap:wrap}.rs-card h3 small{font-size:11.5px;color:var(--muted);font-weight:400}
.rs-grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:12px}
.c3{grid-column:span 3}.c4{grid-column:span 4}.c5{grid-column:span 5}.c6{grid-column:span 6}.c7{grid-column:span 7}.c8{grid-column:span 8}.c12{grid-column:span 12}
@media (max-width:900px){.c3,.c4,.c5,.c6,.c7,.c8{grid-column:span 12}}
.rs-row{display:flex;flex-wrap:wrap;gap:6px 8px;align-items:center;margin:0 0 10px}.rs-lab{font-size:12px;color:var(--muted);min-width:4.5em}
.rs-chip{font:inherit;font-size:13px;border:1px solid var(--line);background:var(--paper);color:var(--ink);border-radius:999px;padding:4px 11px;cursor:pointer}
.rs-chip[aria-pressed="true"]{background:var(--ink);color:var(--paper);border-color:var(--ink);font-weight:700}
.rs-places{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-bottom:10px}@media (max-width:700px){.rs-places{grid-template-columns:repeat(2,minmax(0,1fr))}}
.rs-place{font:inherit;text-align:left;border:1px solid var(--line);background:var(--paper);color:var(--ink);border-radius:8px;padding:8px 10px;cursor:pointer;font-size:11.5px;line-height:1.55}
.rs-place b{display:block;font-size:13.5px;margin-bottom:2px}.rs-place[aria-pressed="true"]{border-color:var(--accent);box-shadow:inset 0 0 0 1.5px var(--accent)}
.rs-meth{display:grid;gap:6px;margin-bottom:10px}.rs-meth label{display:grid;grid-template-columns:auto 1fr auto;gap:8px;align-items:start;font-size:12.5px;border:1px solid var(--line);border-radius:8px;padding:7px 10px;background:var(--paper);cursor:pointer}
.rs-meth label span{color:var(--muted);font-size:11.5px;display:block}.rs-meth b{font-size:13px}.rs-meth em{font-style:normal;font-family:var(--f-mono);font-size:12px;white-space:nowrap}
.rs-sum{font-size:13px;display:flex;flex-wrap:wrap;gap:6px 16px;align-items:center}.rs-sum b{font-family:var(--f-mono)}
.rs-note{font-size:11.5px;color:var(--muted);margin:6px 0 0;line-height:1.65}
.rs-stage{position:relative;border-radius:10px;overflow:hidden;border:1px solid var(--line);background:#2a2f33}.rs-stage canvas{display:block;width:100%;height:auto}
.rs-prog{height:8px;border-radius:4px;background:var(--line);overflow:hidden;margin:6px 0}.rs-prog i{display:block;height:100%;background:var(--accent)}
.rs-list{display:flex;gap:6px;flex-wrap:wrap}.rs-list .rs-chip{border-radius:7px;font-size:12px}
.rs-kv{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px 12px}.rs-kv div{min-width:0}.rs-kv span{display:block;font-size:11px;color:var(--muted)}.rs-kv b{font-family:var(--f-mono);font-size:16px;font-variant-numeric:tabular-nums}.rs-kv i{font-style:normal;font-size:11px;color:var(--muted);display:block}
.rs-hrs{display:flex;align-items:flex-end;gap:2px;height:110px;border-bottom:1px solid var(--line)}
.rs-hrs>div{flex:1;display:flex;flex-direction:column-reverse;min-width:0;height:100%}.rs-hrs span{display:block}
.rs-dw{display:flex;align-items:flex-end;gap:2px;height:34px;margin-top:4px}.rs-dw span{flex:1;background:#d9822b;opacity:.75;border-radius:2px 2px 0 0;min-height:1px}
.rs-hlab{display:flex;justify-content:space-between;font-size:10.5px;color:var(--muted);font-family:var(--f-mono);margin-top:3px}
.rs-leg{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:11.5px;color:var(--muted);margin-top:6px}.rs-leg i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:4px;vertical-align:-1px}
.rs-bars{display:grid;gap:5px}.rs-bars div{display:grid;grid-template-columns:7em minmax(0,1fr) 5.2em;gap:8px;align-items:center;font-size:12.5px}
.rs-bar{position:relative;height:11px;background:var(--line);border-radius:3px;overflow:hidden}.rs-bar i{position:absolute;left:0;top:0;bottom:0;background:var(--accent);border-radius:3px}.rs-bar u{position:absolute;top:2px;bottom:2px;background:rgba(0,0,0,.25);text-decoration:none}
.rs-bars em{font-style:normal;font-family:var(--f-mono);font-size:11.5px;text-align:right;color:var(--muted)}
.rs-t{width:100%;border-collapse:collapse;font-size:12.5px;font-variant-numeric:tabular-nums}.rs-t th{font-size:11px;color:var(--muted);font-weight:400;text-align:right;padding:3px 6px;border-bottom:1px solid var(--line)}
.rs-t td{padding:5px 6px;border-bottom:1px solid var(--line);text-align:right;white-space:nowrap}.rs-t td:first-child,.rs-t th:first-child{text-align:left;white-space:normal}
.rs-t .neg{color:#c9573f}.rs-t .pos{color:#2f8a4a}.rs-t .mut{color:var(--muted)}.rs-t tr.on td{background:var(--paper);font-weight:700}
.rs-voices{display:grid;gap:7px;max-height:330px;overflow:auto;padding-right:2px}
.rs-voices div{border-left:3px solid var(--line);padding:1px 0 1px 9px;font-size:13px;line-height:1.6}.rs-voices small{display:block;color:var(--muted);font-size:11px}
.rs-src{font-size:11px;color:var(--muted);margin:6px 0 0;padding-left:1.1em}.rs-src li{margin:2px 0}.rs-src a{color:inherit}
.rs-range{position:relative;height:26px;margin:8px 0 4px}.rs-range .ax{position:absolute;left:0;right:0;top:12px;height:2px;background:var(--line)}
.rs-range .bd{position:absolute;top:6px;height:14px;border-radius:7px;background:color-mix(in srgb,var(--accent) 30%,transparent);border:1px solid var(--accent)}
.rs-range .md{position:absolute;top:2px;width:3px;height:22px;background:var(--accent);border-radius:2px}
.rs-range .be{position:absolute;top:0;width:0;height:26px;border-left:2px dashed #c9573f}
.rs-split{display:flex;height:9px;border-radius:5px;overflow:hidden;margin:4px 0}.rs-split span:first-child{background:var(--accent)}.rs-split span:last-child{background:#c9a35c}
.rs-warn{font-size:12.5px;margin:8px 0 0;padding-left:1.1em}.rs-warn li{margin:3px 0}
select.rs-sel{font:inherit;font-size:13px;border:1px solid var(--line);background:var(--paper);color:var(--ink);border-radius:7px;padding:5px 8px}
.rs-empty{color:var(--muted);font-size:13px}
`;
function mount(){const s=document.createElement('style');s.textContent=CSS;document.head.appendChild(s);
  const after=$('tayoriBtn')||document.querySelector('.clockbox');
  if(after){const b=document.createElement('button');b.id='rsBtn';b.type='button';b.className='tayoribtn';b.innerHTML='駅ナカ リサーチ<span class="dot" hidden></span>';after.after(b);b.onclick=()=>setOpen(true);}
  const mb=document.querySelector('.minibar-in');if(mb){const b=document.createElement('button');b.id='mrs';b.type='button';b.className='mspeed tayorimini';b.innerHTML='調査<span class="dot" hidden></span>';mb.appendChild(b);b.onclick=()=>setOpen(true);}
  const p=document.createElement('section');p.id='rsv';p.className='rsv';p.hidden=true;p.setAttribute('aria-label','駅ナカ リサーチ');
  p.innerHTML=`<div class="rs-in">
   <div class="rs-hd"><h2>駅ナカ リサーチ</h2><small>まだ何も売っていません。どこに・何を置くかを決める前に、人の流れとお客さんの声を調べます。</small><span class="rs-sp"></span><button type="button" class="rs-btn" id="rsClose">閉じる</button></div>
   <div id="rsPlan"></div>
   <div class="rs-stage"><canvas id="rsCanvas" width="1000" height="400" aria-label="調べている場所のようす"></canvas></div>
   <div id="rsReport"></div></div>`;
  document.body.appendChild(p);$('rsClose').onclick=()=>setOpen(false);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&V.open)setOpen(false);});
  V.cv=$('rsCanvas');V.cx=V.cv.getContext('2d');}
function badge(){const n=V.st?V.st.news:0;for(const id of ['rsBtn','mrs']){const b=$(id);if(!b)continue;const d=b.querySelector('.dot');d.hidden=!n;d.textContent=String(n);b.setAttribute('aria-label','駅ナカ リサーチ'+(n?'（調査が終わりました）':''));}}
function setOpen(o){V.open=o;$('rsv').hidden=!o;if(o){if(V.st){V.st.news=0;persist();badge();}render(true);cancelAnimationFrame(V.raf);V.lastTs=0;V.walkers=[];V.bubbles=[];V.raf=requestAnimationFrame(loop);}else cancelAnimationFrame(V.raf);}

/* ---------- 調査の計画 ---------- */
function renderPlan(){const box=$('rsPlan'),C=V.cfg,a=activeStudy();
  if(a){const c=gCond(),evs=g(()=>ACTIVE_EV.filter(e=>e.place===a.st).map(e=>e.name),[]);
    box.innerHTML=`<div class="rs-card"><h3><span>調査中：${stName(a.st)}駅・${C.places[a.place].name}</span><small>${[a.m.count&&'人の流れを数える',a.m.interview&&'聞き取り'].filter(Boolean).join('・')}</small></h3>
      <div class="rs-prog"><i style="width:${a.recs.length/a.days*100}%"></i></div>
      <div class="rs-sum"><span>記録 <b>${a.recs.length}</b>／${a.days}日</span><span>きょう（運行日${gDay()}）：${DAYN[c.day]}・${WXN[c.wx]}・${SEAN[c.season]}${evs.length?'・'+esc(evs.join('、')):''}</span><span>かかった費用 <b>${man(a.spent||0)}</b></span><span class="rs-sp"></span><button type="button" class="rs-btn" id="rsStop">${a.recs.length?'ここで打ち切る':'やめる'}</button>${dev()?'<button type="button" class="rs-btn" id="rsDevDay">きょうを1日分として記録（開発用）</button>':''}</div>
      <p class="rs-note">運行日が1日終わる（26:00を過ぎて次の運行日へ進む）ごとに、その日の分が記録になります。曜日・天気・イベントはその日の条件しだいです。いろいろな日を調べるほど、レポートの幅がせまくなります。</p></div>`;
    $('rsStop').onclick=stopStudy;if($('rsDevDay'))$('rsDevDay').onclick=()=>{const c=ctxFor(a.st,a.place);if(c)addRecord(a,{...c,day:a.startDay+a.recs.length});};return;}
  const f=V.form,M=C.methods,cost=(f.count?M.count.costPerDay:0)+(f.interview?M.interview.costPerDay:0);
  box.innerHTML=`<div class="rs-card"><h3><span>調査の計画</span><small>調べ方ごとに1日いくらかかります</small></h3>
    <div class="rs-row"><span class="rs-lab">駅</span>${STORDER.map(s=>`<button type="button" class="rs-chip" data-st="${s}" aria-pressed="${f.st===s}">${stName(s)}</button>`).join('')}</div>
    <div class="rs-places">${Object.entries(C.places).map(([k,p])=>`<button type="button" class="rs-place" data-pl="${k}" aria-pressed="${f.place===k}"><b>${p.name}</b>${p.note}</button>`).join('')}</div>
    <div class="rs-meth">
      <label><input type="checkbox" id="rsM1" ${f.count?'checked':''}><div><b>${M.count.name}</b><span>${M.count.desc}</span></div><em>${man(M.count.costPerDay)}／日</em></label>
      <label><input type="checkbox" id="rsM2" ${f.interview?'checked':''}><div><b>${M.interview.name}</b><span>${M.interview.desc}</span></div><em>${man(M.interview.costPerDay)}／日</em></label></div>
    <div class="rs-row"><span class="rs-lab">日数</span>${[1,3,7,14].map(d=>`<button type="button" class="rs-chip" data-days="${d}" aria-pressed="${f.days===d}">${d}日</button>`).join('')}</div>
    <div class="rs-sum"><span>費用の見込み <b>${man(cost*f.days)}</b>（${man(cost)}×${f.days}日）</span><span class="rs-sp"></span><button type="button" class="rs-btn pri" id="rsGo" ${cost?'':'disabled'}>この計画で調べはじめる</button></div>
    <p class="rs-note">1日だけだと「その日だけのようす」かもしれません。平日と土日、晴れと雨、イベントの日を調べ分けると差が見えます。</p></div>`;
  box.querySelectorAll('[data-st]').forEach(b=>b.onclick=()=>{f.st=b.dataset.st;render(true);});
  box.querySelectorAll('[data-pl]').forEach(b=>b.onclick=()=>{f.place=b.dataset.pl;render(true);});
  box.querySelectorAll('[data-days]').forEach(b=>b.onclick=()=>{f.days=Number(b.dataset.days);render(true);});
  $('rsM1').onchange=e=>{f.count=e.target.checked;render(true);};$('rsM2').onchange=e=>{f.interview=e.target.checked;render(true);};$('rsGo').onclick=startStudy;}
const dev=()=>/(^|#|&)dev\b/.test(location.hash);

/* ---------- レポート ---------- */
function bars(rows){return `<div class="rs-bars">${rows.map(r=>`<div><span>${r.n}</span><div class="rs-bar"><i style="width:${Math.min(100,r.p*100/(r.max||1))}%;background:${r.c||'var(--accent)'}"></i>${r.lo!=null?`<u style="left:${r.lo*100/(r.max||1)}%;width:${Math.max(0.5,(r.hi-r.lo)*100/(r.max||1))}%"></u>`:''}</div><em>${r.t||pct(r.p)}</em></div>`).join('')}</div>`;}
function renderReport(){const box=$('rsReport'),C=V.cfg,list=V.st.studies.filter(s=>s.recs.length);
  if(!list.length){box.innerHTML=`<div class="rs-card"><p class="rs-empty">まだ調査の記録はありません。上で場所と調べ方を選んで始めると、運行日が1日終わるごとにここへレポートがたまります。</p></div>`;return;}
  if(!study(V.sel)||!study(V.sel).recs.length)V.sel=list.at(-1).id;
  const s=study(V.sel),rep=RC.aggregate(C,s.recs),P=C.places[s.place];
  const sw=list.length>1?`<div class="rs-list">${list.map(x=>`<button type="button" class="rs-chip" data-sel="${x.id}" aria-pressed="${x.id===s.id}">${stName(x.st)}・${C.places[x.place].name}（${x.recs.length}日${x.status==='active'?'・調査中':''}）</button>`).join('')}</div>`:'';
  const cov=`${Object.entries(rep.cover.day).map(([k,v])=>DAYN[k]+v).join('・')}／${Object.entries(rep.cover.wx).map(([k,v])=>WXN[k]+v).join('・')}${rep.cover.ev?'／イベントの日'+rep.cover.ev:''}`;
  let h=`<div class="rs-grid">
   <div class="rs-card c12"><h3><span>レポート：${stName(s.st)}駅・${P.name}</span><small>${rep.days}日分（${cov}）・費用 ${man(rep.cost)}</small></h3>${sw}</div>`;
  // 人の流れ
  if(rep.F){const tot=new Array(H).fill(0);for(let p=0;p<4;p++)for(let hh=0;hh<H;hh++)tot[hh]+=rep.F[p][hh];const mx=Math.max(1,...tot.slice(4,26));
    const dwmx=Math.max(1,...rep.dw.slice(4,26));const peak=tot.indexOf(Math.max(...tot));
    h+=`<div class="rs-card c8"><h3><span>時間帯ごとに通る人</span><small>${rep.count}日の平均・1日 約${num(rep.tot)}人・いちばん多いのは${peak}時台</small></h3>
      <div class="rs-hrs">${Array.from({length:22},(_,j)=>{const hh=j+4;return `<div title="${hh}時台 ${num(tot[hh])}人">${[0,1,2,3].map(p=>`<span style="height:${rep.F[p][hh]/mx*100}%;background:${PCOL[p]}"></span>`).join('')}</div>`;}).join('')}</div>
      <div class="rs-dw">${Array.from({length:22},(_,j)=>`<span title="${j+4}時台 約${rep.dw[j+4].toFixed(1)}分" style="height:${rep.dw[j+4]/dwmx*100}%"></span>`).join('')}</div>
      <div class="rs-hlab"><span>4時</span><span>8</span><span>12</span><span>16</span><span>20</span><span>24</span><span>26時</span></div>
      <div class="rs-leg">${C.purposes.map((n,p)=>`<span><i style="background:${PCOL[p]}"></i>${n}</span>`).join('')}<span><i style="background:#d9822b"></i>立ち止まれる時間（${s.place==='home'?'列車の間隔から：待ち時間の平均':'場所の目安'}）</span></div></div>`;
    h+=`<div class="rs-card c4"><h3><span>曜日・天気・イベントの差</span><small>通る人の数</small></h3><table class="rs-t"><thead><tr><th></th><th>日数</th><th>1日の人数</th><th>平日比</th></tr></thead><tbody>${rep.diff.map(d=>`<tr><td>${d.label}</td><td>${d.n||''}</td><td>${d.tot?num(d.tot):'<span class="mut">まだ</span>'}</td><td>${d.ratio?pct(d.ratio):'<span class="mut">—</span>'}</td></tr>`).join('')}</tbody></table>
      <p class="rs-note">調べていない日は、試算では目安で推し量ります（そのぶん幅が広がります）。</p></div>`;}
  else h+=`<div class="rs-card c12"><h3><span>通る人</span></h3><p class="rs-empty">人数は数えていません。聞き取りの調査員の見た感じでは、1日 約${num(rep.rough||0)}人（大まか）。</p></div>`;
  // 客層・支払い
  if(rep.I){const I=rep.I;
    h+=`<div class="rs-card c4"><h3><span>客層（目的）</span><small>答えた人 ${num(I.n)}人</small></h3>${bars(I.pur.map((x,p)=>({n:C.purposes[p],p:x.p,lo:x.lo,hi:x.hi,c:PCOL[p]})))}
      <h3 style="margin-top:12px"><span>年代</span></h3>${bars(I.age.map((x,a)=>({n:C.ages.names[a],p:x.p,lo:x.lo,hi:x.hi})))}<p class="rs-note">灰色の帯は、答えた人の数から見た幅（95%）。</p></div>`;
    h+=`<div class="rs-card c4"><h3><span>支払い・品目</span><small>聞き取りから</small></h3><div class="rs-kv">
      <div><span>電子マネーで払う</span><b>${pct(I.em.p)}</b><i>${pct(I.em.lo)}〜${pct(I.em.hi)}</i></div><div><span>現金で払う</span><b>${pct(1-I.em.p)}</b><i>無人の店では買えない人</i></div>
      <div><span>紙の雑誌を週1回以上買う</span><b>${pct(I.mag.p,1)}</b><i>年に約1割ずつ減っている</i></div><div><span>漫画雑誌を週1回以上買う</span><b>${pct(I.man.p,1)}</b><i>電子で読む人が増えている</i></div>
      <div><span>酒・たばこを駅で買う</span><b>${pct(I.alc.p,1)}</b><i>20歳以上のうち。年齢確認が要る</i></div></div>
      <ul class="rs-src">${[...C.payment.src,...C.magazine.src,...C.ageCheck.src].map(x=>`<li><a href="${x.u}" target="_blank" rel="noopener">${esc(x.t)}</a></li>`).join('')}</ul></div>`;
    const W=Object.fromEntries(C.wants.map(w=>[w.id,w.name]));
    h+=`<div class="rs-card c4"><h3><span>ほしい物</span><small>「駅で何があったら買う？」</small></h3>${I.want.length?bars(I.want.slice(0,8).map(w=>({n:W[w.id],p:w.p,lo:w.lo,hi:w.hi,max:Math.max(0.05,I.want[0].hi)}))):'<p class="rs-empty">とくになし</p>'}<p class="rs-note">答えた人のうちの割合。ほしいと言っても、買うとは限りません。</p></div>`;
    h+=`<div class="rs-card c12"><h3><span>お客さんの声</span><small>新しい順</small></h3><div class="rs-voices">${I.voices.map(v=>`<div>「${esc(v.t)}」<small>${C.ages.names[v.a]}・${C.purposes[v.p]}・${v.h}時ごろ／運行日${v.day}（${DAYN[v.cond.day]}・${WXN[v.cond.wx]}）</small></div>`).join('')||'<p class="rs-empty">まだ声は集まっていません。</p>'}</div></div>`;}
  else h+=`<div class="rs-card c12"><p class="rs-empty">聞き取りはしていないので、客層・支払い方・お客さんの声はわかりません（試算では全国の目安を使い、幅を広くします）。</p></div>`;
  // 試算
  h+=`<div class="rs-card c12" id="rsEst"></div></div>`;
  box.innerHTML=h;box.querySelectorAll('[data-sel]').forEach(b=>b.onclick=()=>{V.sel=b.dataset.sel;render(true);});
  renderEst(s,rep);}
function renderEst(s,rep){const C=V.cfg,box=$('rsEst'),season=gCond().season,o=V.est;
  const all=C.types.map(t=>({t,e:RC.estimate(C,rep,t.id,{st:s.st,place:s.place,season,ageDevice:o.dev})}));
  if(!all.find(x=>x.t.id===o.type&&x.e.ok)){const f=all.find(x=>x.e.ok);if(f)o.type=f.t.id;}
  const cur=all.find(x=>x.t.id===o.type)||all[0],e=cur.e,T=cur.t;
  let h=`<h3><span>試算：もしここに置いたら</span><small>${SEAN[season]}の見込み・1か月＝30日。売れる前提にはしていません</small></h3>
    <div class="rs-row"><span class="rs-lab">業態</span><select class="rs-sel" id="rsType">${all.map(x=>`<option value="${x.t.id}" ${x.t.id===o.type?'selected':''} ${x.e.ok?'':'disabled'}>${x.t.name}${x.e.ok?'':'（置けない）'}</option>`).join('')}</select>
    ${T.ageCheckDevice?`<label style="font-size:12.5px"><input type="checkbox" id="rsDev" ${o.dev?'checked':''}> 本人確認の機械をつける（酒・たばこを売る・${man(T.ageCheckDevice.init)}＋月${man(T.ageCheckDevice.monthly)}）</label>`:''}</div>`;
  if(!e.ok){h+=`<p class="rs-empty">${e.why}</p>`;}
  else{const M=e.month,max=Math.max(e.daily.hi,e.breakeven||0)*1.1,X=v=>Math.min(100,v/max*100);
    const lab={cogs:'仕入れ',waste:'捨てる分',staff:'人件費',fee:'電子マネーの手数料',rent:'場所代',space:'場所代・道具・人（1日いくら）',system:'システム・設備の月額',elec:'電気代'};
    h+=`<div class="rs-grid"><div class="c7">
      <div class="rs-kv"><div><span>1日の売上（少なめ）</span><b>${man(e.daily.lo)}</b></div><div><span>1日の売上（見込み）</span><b>${man(e.daily.mid)}</b><i>お客さん 約${num(e.cust)}人</i></div><div><span>1日の売上（多め）</span><b>${man(e.daily.hi)}</b></div></div>
      <div class="rs-range" aria-hidden="true"><div class="ax"></div><div class="bd" style="left:${X(e.daily.lo)}%;width:${X(e.daily.hi)-X(e.daily.lo)}%"></div><div class="md" style="left:${X(e.daily.mid)}%"></div>${e.breakeven?`<div class="be" style="left:${X(e.breakeven)}%" title="損益が0になる売上"></div>`:''}</div>
      <p class="rs-note">赤い点線＝損益がちょうど0になる1日の売上（${e.breakeven?man(e.breakeven):'—'}）。${T.id==='vend'?'':`赤字になる見込みは約<b>${Math.round(e.pLoss*100)}%</b>。`}</p>
      <div style="font-size:12px;margin-top:8px">幅のうちわけ：<span style="color:var(--accent)">■</span> 調査で減らせる部分　<span style="color:#c9a35c">■</span> 置いてみないとわからない部分</div>
      <div class="rs-split"><span style="width:${e.sd.research**2/(e.sd.research**2+e.sd.fit**2)*100}%"></span><span style="flex:1"></span></div>
      <p class="rs-note">${C.fitNote}</p>
      <ul class="rs-warn">${e.notes.map(n=>`<li>${esc(n)}</li>`).join('')}</ul></div>
     <div class="c5"><table class="rs-t"><thead><tr><th>1か月</th><th>少なめ</th><th>見込み</th><th>多め</th></tr></thead><tbody>
      <tr><td>売上</td>${['lo','mid','hi'].map(k=>`<td>${man(M[k].sales)}</td>`).join('')}</tr>
      ${T.id==='vend'?`<tr><td>手数料収入（${pct(T.ownerShare)}）</td>${['lo','mid','hi'].map(k=>`<td>${man(M[k].income)}</td>`).join('')}</tr>`:''}
      ${Object.keys(M.mid.cost).map(k=>`<tr><td class="mut">${lab[k]||k}</td>${['lo','mid','hi'].map(q=>`<td class="mut">−${man(M[q].cost[k])}</td>`).join('')}</tr>`).join('')}
      <tr><td><b>損益</b></td>${['lo','mid','hi'].map(k=>`<td class="${M[k].profit<0?'neg':'pos'}"><b>${man(M[k].profit)}</b></td>`).join('')}</tr></tbody></table>
      <div class="rs-kv" style="margin-top:10px"><div><span>はじめにかかるお金</span><b>${man(e.init)}</b></div><div><span>取り戻すまで（見込み）</span><b>${!e.init?'—':e.payback?(e.payback<120?Math.ceil(e.payback)+'か月':'10年以上'):'—'}</b><i>${!e.init?'はじめのお金はかからない':e.payback?'':'見込みでは黒字にならず、戻らない'}</i></div></div></div></div>
     <p class="rs-note">${esc(T.note)}</p><ul class="rs-src">${T.src.map(x=>`<li><a href="${x.u}" target="_blank" rel="noopener">${esc(x.t)}</a></li>`).join('')}</ul>`;}
  h+=`<h3 style="margin-top:14px"><span>この場所で業態をくらべる</span><small>見込みの1か月の損益と、赤字になる見込み</small></h3><div style="overflow-x:auto"><table class="rs-t" style="min-width:560px"><thead><tr><th>業態</th><th>1日の売上（見込み）</th><th>1日の客</th><th>1か月の損益</th><th>赤字の見込み</th><th>はじめのお金</th></tr></thead><tbody>
    ${all.map(x=>x.e.ok?`<tr class="${x.t.id===o.type?'on':''}"><td>${x.t.name}</td><td>${man(x.e.daily.mid)}</td><td>${num(x.e.cust)}人</td><td class="${x.e.month.mid.profit<0?'neg':'pos'}">${man(x.e.month.mid.profit)}</td><td>${Math.round(x.e.pLoss*100)}%</td><td>${man(x.e.init)}</td></tr>`:`<tr><td class="mut">${x.t.name}</td><td colspan="5" class="mut" style="text-align:left">${esc(x.e.why)}</td></tr>`).join('')}</tbody></table></div>
    <p class="rs-note">数字は調べた結果と目安から出した見込みです。実際に置いて売れるかは、次の段（試し置き）で確かめます。</p>`;
  box.innerHTML=h;$('rsType').onchange=ev=>{o.type=ev.target.value;renderEst(s,rep);};if($('rsDev'))$('rsDev').onchange=ev=>{o.dev=ev.target.checked;renderEst(s,rep);};}

function render(full){if(!V.open)return;
  if(!V.cfg){$('rsPlan').innerHTML=`<div class="rs-card"><p class="rs-empty">${V.err?'設定（data/research.json）を読み込めませんでした。パソコンで index.html を直接開いた場合は読み込めません（GitHub Pages では動きます）。':'準備しています…'}</p></div>`;$('rsReport').innerHTML='';return;}
  renderPlan();if(full)renderReport();}

/* ---------- 映像 ---------- */
function scenePlace(){const a=activeStudy();if(a)return {st:a.st,place:a.place,live:true,m:a.m};const s=study(V.sel);if(s)return {st:s.st,place:s.place,live:false,m:s.m};return {st:V.form.st,place:V.form.place,live:false,m:{count:V.form.count,interview:V.form.interview}};}
function provisional(sp){const k=sp.st+sp.place+gDay()+'|'+(gD()&&gD().trips.length)+gCond().wx+gCond().day;if(V.prov&&V.provKey===k)return V.prov;
  const c=ctxFor(sp.st,sp.place);if(!c)return null;V.provKey=k;V.prov={F:RC.footfall(V.cfg,sp.st,sp.place,c.flows,c.plats),rec:RC.dayRecord(V.cfg,{...c,seed:V.st.seed,methods:{count:false,interview:true}}),stops:c.stops};return V.prov;}
function loop(ts){const dt=V.lastTs?Math.min(0.1,(ts-V.lastTs)/1000):0;V.lastTs=ts;if(!V.open)return;
  if(V.cfg)draw(dt,ts/1000);V.panelT+=dt;if(V.panelT>1){V.panelT=0;if(activeStudy())renderPlan();}
  V.raf=requestAnimationFrame(loop);}
const COATS=['#2f4858','#7a3b3b','#33658a','#55586a','#8a6d3b','#3d6b4f','#5b4a7a','#a2574a','#2b2b2b','#6b7b8c','#b08d57','#486c8f'];
const rnd=(a,b)=>a+Math.random()*(b-a);
function rr(c,x,y,w,h,r){c.beginPath();c.roundRect(x,y,w,h,r);}
function sky(t){const m=((t%1440)+1440)%1440;const K=[[0,'#0d1426','#1b2440'],[300,'#18223f','#3b3f63'],[330,'#e9926b','#6f6f9c'],[420,'#9fc8e8','#dfeef6'],[960,'#8fc0e6','#e8f1f4'],[1050,'#f0a06a','#7a7fb0'],[1110,'#30355e','#58507a'],[1170,'#0f1730','#1d2647'],[1440,'#0d1426','#1b2440']];
  let i=0;while(i<K.length-2&&m>=K[i+1][0])i++;const a=K[i],b=K[i+1],k=(m-a[0])/(b[0]-a[0]);const P=s=>[1,3,5].map(j=>parseInt(s.slice(j,j+2),16));const mix=(x,y)=>'rgb('+P(x).map((v,j)=>Math.round(v+(P(y)[j]-v)*k)).join(',')+')';return [mix(a[1],b[1]),mix(a[2],b[2])];}
function person(c,p,t){const s=(0.5+(p.y-250)/150*0.55)*(p.h||1),step=Math.sin((p.walk||0)*0.12)*3;c.save();c.translate(p.x,p.y);c.scale(s,s);
  c.fillStyle='rgba(0,0,0,.18)';c.beginPath();c.ellipse(0,0,12,4,0,0,7);c.fill();
  c.strokeStyle='#2a2a30';c.lineWidth=5;c.lineCap='round';c.beginPath();c.moveTo(-3,-26);c.lineTo(-3+step,-2);c.moveTo(3,-26);c.lineTo(3-step,-2);c.stroke();
  c.fillStyle=p.coat;rr(c,-10,-62,20,38,6);c.fill();if(p.bag){c.fillStyle='#d9c7a0';rr(c,8,-40,9,12,2);c.fill();}
  if(p.umb){c.strokeStyle='#3d4e66';c.lineWidth=2.5;c.beginPath();c.moveTo(-12,-44);c.lineTo(-14,-6);c.stroke();}
  c.fillStyle='#f0c9a0';c.beginPath();c.arc(0,-72,9,0,7);c.fill();c.fillStyle=p.hair||'#2b2016';c.beginPath();c.arc(0,-75,9,Math.PI*1.05,Math.PI*1.95);c.fill();
  if(p.staff){c.fillStyle='#e8c33a';c.fillRect(-10,-58,20,5);c.fillStyle='#f6f3ea';rr(c,9,-52,13,17,2);c.fill();c.strokeStyle='#777';c.lineWidth=1;c.strokeRect(9,-52,13,17);}
  c.restore();}
function draw(dt,time){const c=V.cx,W=1000,Hh=400,Tn=gT(),cond=gCond(),sp=scenePlace(),pv=provisional(sp);c.save();c.clearRect(0,0,W,Hh);
  const night=(()=>{const m=((Tn%1440)+1440)%1440;return m<330||m>1110;})(),[s1,s2]=sky(Tn),rain=cond.wx==='rain'||cond.wx==='snow';
  const hh=Math.min(H-1,Math.floor(Tn/60));let rate=0;if(pv)for(let p=0;p<4;p++)rate+=pv.F[p][hh];
  const home=sp.place==='home',outside=sp.place==='soto';
  // 背景
  if(home||outside){const gr=c.createLinearGradient(0,0,0,200);gr.addColorStop(0,s1);gr.addColorStop(1,s2);c.fillStyle=gr;c.fillRect(0,0,W,230);
    c.fillStyle=night?'rgba(255,240,200,.45)':'rgba(40,60,70,.3)';for(let b=0;b<14;b++){const bh=30+((b*37)%60);c.fillRect(b*75,190-bh,60,bh+40);}
    if(cond.wx==='rain'){c.strokeStyle='rgba(220,235,255,.5)';c.lineWidth=1;for(let r=0;r<70;r++){const x=(r*97+time*170)%W,y=(r*53+time*300)%240;c.beginPath();c.moveTo(x,y);c.lineTo(x-3,y+10);c.stroke();}}
    if(cond.wx==='snow'){c.fillStyle='rgba(255,255,255,.9)';for(let r=0;r<70;r++){const x=((r*97+Math.sin(time+r)*10+time*14)%W+W)%W,y=(r*53+time*30)%240;c.beginPath();c.arc(x,y,2,0,7);c.fill();}}}
  if(home){// 奥：線路、手前：ホーム
    c.fillStyle='#3b3833';c.fillRect(0,196,W,44);c.fillStyle='#6b675f';for(let x=0;x<W;x+=22)c.fillRect(x,214,12,22);c.fillStyle='#9a958a';c.fillRect(0,216,W,3);c.fillRect(0,232,W,3);
    c.fillStyle='#d6d3ca';c.fillRect(0,236,W,8);c.fillStyle='#e2c84a';c.fillRect(0,244,W,6);c.fillStyle='#a7a49b';c.fillRect(0,250,W,150);
    c.strokeStyle='rgba(0,0,0,.07)';for(let y=262;y<400;y+=(y-230)*0.3+6){c.beginPath();c.moveTo(0,y);c.lineTo(W,y);c.stroke();}
    c.fillStyle='#4a5056';c.fillRect(0,0,W,22);}
  else{if(!outside){const wl=c.createLinearGradient(0,0,0,230);wl.addColorStop(0,night?'#b9b3a6':'#ddd6c8');wl.addColorStop(1,night?'#a49e92':'#cfc7b7');c.fillStyle=wl;c.fillRect(0,0,W,230);c.fillStyle='#3a3f44';c.fillRect(0,0,W,24);
      c.fillStyle='#1e3a52';rr(c,400,34,200,40,4);c.fill();c.fillStyle='#fff';c.font='700 19px "Zen Kaku Gothic New",sans-serif';c.textAlign='center';c.fillText(stName(sp.st)+' 駅',500,61);}
    else{c.fillStyle=night?'#58544c':'#cfc6b4';c.fillRect(260,40,480,190);c.fillStyle='#294b6b';rr(c,380,56,240,40,4);c.fill();c.fillStyle='#fff';c.font='700 20px "Zen Kaku Gothic New",sans-serif';c.textAlign='center';c.fillText(stName(sp.st)+' 駅',500,84);
      c.fillStyle=night?'#ffe9a8':'#2b3540';c.fillRect(420,130,160,100);}
    c.fillStyle=outside?'#8f8c86':'#9a9890';c.fillRect(0,230,W,170);c.strokeStyle='rgba(0,0,0,.08)';for(let y=240;y<400;y+=(y-210)*0.3+6){c.beginPath();c.moveTo(0,y);c.lineTo(W,y);c.stroke();}
    if(sp.place==='gate'){for(let i=0;i<6;i++){const x=320+i*62;c.fillStyle='#d7dbe0';rr(c,x,200,34,64,3);c.fill();c.fillStyle='#4a7fb5';c.fillRect(x+6,208,22,6);c.fillStyle=Math.sin(time*3+i)>0?'#5fd38a':'#3a8a5a';c.fillRect(x+12,222,10,4);}
      c.fillStyle='#294b6b';rr(c,420,150,160,28,3);c.fill();c.fillStyle='#fff';c.font='700 14px sans-serif';c.fillText('改札口',500,169);}
    if(sp.place==='naka'){c.fillStyle='#294b6b';rr(c,40,120,150,28,3);c.fill();rr(c,810,120,150,28,3);c.fill();c.fillStyle='#fff';c.font='700 13px sans-serif';c.fillText('← 改札口',115,139);c.fillText('のりば →',885,139);}}
  // ホームに止まる列車（ダイヤどおり）
  if(home){const d=gD();let tr=null,ph=0;if(d)for(const t of d.trips){const i=t.seq.indexOf(sp.st);if(i<0||!t.stop[i])continue;if(Tn>=t.arr[i]-0.6&&Tn<=t.dep[i]+0.6){tr=t;ph=Tn<t.arr[i]?(Tn-t.arr[i])/0.6:Tn>t.dep[i]?(Tn-t.dep[i])/0.6:0;break;}}
    if(tr){const cls=g(()=>TYPES[tr.type].cls,'commuter'),col={commuter:'#2f7a6e',express:'#c8333a',tourist:'#2b3d6b'}[cls]||'#2f7a6e',x0=ph*1100*(tr.down?1:-1);
      const i=tr.seq.indexOf(sp.st),open=ph===0&&Tn>tr.arr[i]+0.1&&Tn<tr.dep[i]-0.1;
      for(let k=0;k<6;k++){const x=x0+k*172-30;c.fillStyle='#dfe3e6';rr(c,x,130,168,104,6);c.fill();c.fillStyle=col;c.fillRect(x,206,168,9);c.fillStyle='#2a3a48';for(let w=0;w<3;w++)c.fillRect(x+12+w*54,146,40,30);
        c.fillStyle=open?'#1b2228':'#c7ccd0';c.fillRect(x+70,142,26,90);c.strokeStyle='#9aa0a5';c.lineWidth=1;c.strokeRect(x+70.5,142.5,25,89);}
      c.fillStyle='rgba(0,0,0,.65)';rr(c,W-250,96,230,24,4);c.fill();c.fillStyle='#ffd34a';c.font='700 13px sans-serif';c.textAlign='left';c.fillText(`${g(()=>TYPES[tr.type].name,'')} ${g(()=>ST[tr.seq.at(-1)].name,'')}行 ${open?'ドアが開いています':ph<0?'まもなく到着':ph>0?'発車':'停車中'}`,W-240,113);}
    // 駅名標（列車の手前のホームに立つ）
    c.fillStyle='#5b6167';c.fillRect(497,206,6,50);c.fillStyle='#fff';rr(c,400,150,200,54,4);c.fill();c.strokeStyle='#1f6b5e';c.lineWidth=3;c.stroke();c.fillStyle='#1f2a2a';c.font='700 24px "Zen Kaku Gothic New",sans-serif';c.textAlign='center';c.fillText(stName(sp.st),500,184);c.fillStyle='#1f6b5e';c.fillRect(400,194,200,10);}
  // 人の流れ（数は1時間あたりの人数から、見た目の量に直す）
  const spawn=Math.min(4,Math.sqrt(rate)/22)*(g(()=>playing,true)?1:0);V.acc=(V.acc||0)+dt*spawn;
  while(V.acc>1&&V.walkers.length<60){V.acc-=1;const l2r=Math.random()<0.5;const y=home?rnd(272,392):rnd(268,392);
    V.walkers.push({x:l2r?-20:1020,y,v:(l2r?1:-1)*rnd(70,120)*(home?0.7:1),coat:COATS[Math.floor(Math.random()*COATS.length)],h:rnd(0.9,1.05),bag:Math.random()<0.35,umb:rain&&Math.random()<0.6,stop:home&&Math.random()<0.5?rnd(100,900):null,wait:0});}
  for(const w of V.walkers){if(w.stop!=null&&Math.abs(w.x-w.stop)<4&&w.wait<rnd(3,9)){w.wait+=dt;continue;}w.x+=w.v*dt;w.walk=(w.walk||0)+Math.abs(w.v*dt);}
  V.walkers=V.walkers.filter(w=>w.x>-30&&w.x<1030);
  // 調査員
  const staff=[];if(sp.m.count)staff.push({x:900,y:home?372:360,coat:'#1f5f8b',staff:true,h:1});
  if(sp.m.interview){const ix=150+Math.sin(time*0.25)*60;staff.push({x:ix,y:home?360:350,coat:'#7a3b3b',staff:true,h:1,walk:time*40});}
  [...V.walkers,...staff].sort((a,b)=>a.y-b.y).forEach(p=>person(c,p,time));
  // 数えた人数・声
  if(sp.live||true){const n=pv?RC.soFar(pv.F,Tn):0;
    if(sp.m.count){c.fillStyle='rgba(15,20,24,.82)';rr(c,W-232,home?20:150,212,64,8);c.fill();c.fillStyle='#9fd3c7';c.font='12px sans-serif';c.textAlign='left';c.fillText(sp.live?'きょう数えた人（いまの時刻まで）':'下見：通った人の目安',W-220,(home?20:150)+20);
      c.fillStyle='#ffb347';c.font='700 26px "DotGothic16",monospace';c.fillText(num(n)+' 人',W-220,(home?20:150)+52);
      if(Math.floor(time*6)%2===0&&rate>0){c.fillStyle='#ffd34a';c.beginPath();c.arc(W-34,(home?20:150)+44,4,0,7);c.fill();}}
    if(sp.m.interview&&pv&&sp.live){V.bubT+=dt;const vs=pv.rec.I.voices.filter(v=>v.h<=hh);if(V.bubT>6&&vs.length){V.bubT=0;const v=vs[Math.floor(Math.random()*vs.length)];V.bubbles.push({t:0,v});}}
    V.bubbles=V.bubbles.filter(b=>(b.t+=dt)<5.5);
    for(const b of V.bubbles){const a=Math.min(1,b.t*2,(5.5-b.t)*1.5);c.globalAlpha=a;c.font='14px "Zen Kaku Gothic New",sans-serif';const tx='「'+b.v.t+'」',tw=Math.min(560,c.measureText(tx).width+24),x=40,y=home?70:180;
      c.fillStyle='rgba(255,255,255,.95)';rr(c,x,y,tw,46,10);c.fill();c.beginPath();c.moveTo(x+90,y+46);c.lineTo(x+110,y+46);c.lineTo(x+120,y+64);c.fill();
      c.fillStyle='#1c2826';c.textAlign='left';c.save();c.beginPath();c.rect(x,y,tw,46);c.clip();c.fillText(tx,x+12,y+20);c.fillStyle='#5b6a66';c.font='11px sans-serif';c.fillText(`${V.cfg.ages.names[b.v.a]}・${V.cfg.purposes[b.v.p]}`,x+12,y+38);c.restore();c.globalAlpha=1;}}
  if(night){c.fillStyle='rgba(10,20,50,.12)';c.fillRect(0,0,W,Hh);}
  c.fillStyle='rgba(15,20,24,.78)';rr(c,20,20,340,40,6);c.fill();c.fillStyle='#ffb347';c.font='700 22px "DotGothic16",monospace';c.textAlign='left';c.fillText(fmtT(Tn),32,48);
  c.fillStyle='#fff';c.font='13px sans-serif';c.fillText(`${stName(sp.st)}・${V.cfg.places[sp.place].name}`,118,46);
  if(!sp.live){c.fillStyle='rgba(15,20,24,.7)';rr(c,20,66,340,24,5);c.fill();c.fillStyle='#fff';c.font='12px sans-serif';c.fillText(study(V.sel)?'レポートの場所（いまは調べていません）':'下見中（調査はまだ始めていません）',30,83);}
  c.restore();}

/* ---------- 起動 ---------- */
mount();load();setInterval(tick,1000);
window.minatoResearch={get state(){return V.st;},open:()=>setOpen(true),
  recordToday(){const a=activeStudy();if(!a)return null;const c=ctxFor(a.st,a.place);if(c)addRecord(a,{...c,day:a.startDay+a.recs.length});return a.recs.length;},   // 開発用：きょうの条件で1日分を記録する
  reset(){V.st=blank();persist();V.sel=null;badge();render(true);}};
})();
