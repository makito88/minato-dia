/* お弁当のラインの画面（工場の5本目・港駅の売店をつくる回の5回目・2026-11-10）。計算は BentoCore（js/bento-core.js）、条件だけをブラウザに保存する（dia-factory-bento）。
   見せ方はドーナッツのライン（js/donut-view.js）にそろえる：夕方に決める → 作り方と持ち場 → 夜のライン（絵・時計・記録）→ 朝の答え合わせ。 */
(function(){
'use strict';
const C=window.BentoCore,$=id=>document.getElementById(id),KEY='dia-factory-bento',FL=window.FactoryLive;
let D,R,cfg,cur,playing=true,active=false,last=0,minute=-1,speed='live',lastDraw=0;
const yen=n=>Math.round(n).toLocaleString()+'円';
const getItem=k=>{try{return localStorage.getItem(k);}catch(e){return null;}};
function liveNote(){const e=$('btliveNote');if(e&&R)e.textContent=FL.note(R.T0,R.T1,speed==='live',playing);}
function save(){try{localStorage.setItem(KEY,JSON.stringify({v:1,cfg}));}catch(e){}}
function run(){const FN=window.FactoryNight,log=FN?FN.readLog(getItem):null;
  R=C.simulate(D,FN?FN.withCenter(cfg,log):cfg);cfg=Object.assign({},R.cfg);delete cfg.center;delete cfg.centerNo;
  {const e=$('btnightInfo');if(e)e.textContent=`夜の番号 ${cfg.seed}`+(FN?' '+FN.centerNote(D,log,'bento','個'):'');}
  cur=speed==='live'?FL.liveAt(R.T0,R.T1):R.T0;minute=-1;playing=speed==='live';save();$('btresult').hidden=true;$('btresultWait').hidden=false;$('btscrub').min=R.T0;$('btscrub').max=R.T1;recipes();stations();draw();}
function plan(){const B=D.bento;
  const select=(id,label,opts)=>`<div><label for="bt${id}">${label}</label><select id="bt${id}">${opts.map(([v,t])=>`<option value="${v}" ${String(cfg[id])===String(v)?'selected':''}>${t}</option>`).join('')}</select></div>`;
  const times=[];for(let t=B.ranges.start[0];t<=B.ranges.start[1];t+=15)times.push([t,C.hm(t)]);
  const rng=k=>{const [a,b]=B.ranges[k],o=[];for(let n=a;n<=b;n++)o.push(n);return o;};
  $('btplan').innerHTML=select('season','季節',Object.entries(D.seasons).map(([k,s])=>[k,s.label]))+select('start','炊き始める時刻',times)+select('fillers','詰める人',rng('fillers').map(n=>[n,n+'人']))+select('chillers','急速冷却の機械',rng('chillers').map(n=>[n,n+'台']));
  for(const k of ['season','start','fillers','chillers'])$('bt'+k).onchange=e=>{cfg[k]=k==='season'?e.target.value:+e.target.value;recipes();};
  $('btproducts').innerHTML=B.products.map(p=>`<span class="tag">🍱 ${p.name}</span>`).join(' ');}
function recipes(){const B=D.bento,season=D.seasons[cfg.season]||D.seasons[B.defaults.season],n=B.batch,cm=C.chillMin(B,season);
  $('btrecipes').innerHTML=`<div class="dgrid">${B.products.map(p=>{const rows=[[p.okazu==='grill'?'焼く':'揚げる',p.cook+'分',B.machines[p.okazu].name],['ご飯',Math.ceil(n/B.rice.rate)+'分',`炊飯器から1分に${B.rice.rate}食ぶん`],['詰める',C.fillMin(B,n,cfg.fillers)+'分',`${cfg.fillers}人で`],['急速冷却',cm+'分',`部屋${season.room}℃・${season.label}`],['ふたと包装',C.lidMin(B,n)+'分','ラベルに消費期限']];
    const sum=p.cook+C.fillMin(B,n,cfg.fillers)+cm+C.lidMin(B,n);
    return `<div class="drec"><h3><span class="ddot" style="background:${p.color}"></span>${p.name}</h3><p class="small"><b>中身：</b>${(p.menu||[]).join('・')}</p><p class="small muted">アレルゲン（仮）：${(p.allergen||[]).join('・')}</p>
    <table class="small"><tbody>${rows.map(([k,v,x])=>`<tr><th>${k}</th><td class="num r">${v}</td><td class="muted">${x}</td></tr>`).join('')}<tr><th>待ちがなければ</th><td class="num r"><b>${Math.floor(sum/60)}時間${sum%60}分</b></td><td class="muted">おかずから包装まで（${n}個のひと組）</td></tr></tbody></table></div>`;}).join('')}</div>
    <p class="small muted">${B.rice.note}。${B.holdNote}。${B.chill.note}。</p><p class="small muted">${B.share}</p>`;}
// 工程 → 絵の場所（0 おかず・1 ご飯・2 詰める・3 急速冷却・4 ふたと包装・5 出荷）
const COLS=[[20,170],[200,120],[330,180],[520,170],[700,160],[870,115]];
function colOf(label){if(['おかずを待つ','揚げる','焼く'].includes(label))return 0;if(['詰めるのを待つ','詰める'].includes(label))return 2;if(['冷却を待つ','急速冷却'].includes(label))return 3;if(['包装を待つ','ふたと包装'].includes(label))return 4;return 5;}
const crewOf=(st,c)=>st.crew==='fillers'?c.fillers:st.crew;
function stations(){const B=D.bento,c=R.cfg,use=COLS.map(()=>[Infinity,-Infinity]);
  for(const b of R.batches)for(const s of b.steps)if(s.end>s.start&&!/待つ/.test(s.label)){const u=use[colOf(s.label)];u[0]=Math.min(u[0],s.start);u[1]=Math.max(u[1],s.end);}
  use[1]=[c.start,Math.max(...R.batches.map(b=>b.fill),c.start)];for(const b of R.batches){const u=use[5];u[0]=Math.min(u[0],b.done);u[1]=Math.max(u[1],Math.min(b.done,D.deadline));}
  const known=(B.stations||[]).reduce((a,st)=>a+(Number.isFinite(crewOf(st,c))?crewOf(st,c):0),0);
  $('btstations').innerHTML=`<div class="tw"><table style="min-width:620px"><thead><tr><th>工程</th><th>機械</th><th>人</th><th>すること</th><th>今夜</th></tr></thead><tbody>${(B.stations||[]).map((st,i)=>{const u=use[i],n=crewOf(st,c);return `<tr><th>${st.name}</th><td>${st.machine||'—'}</td><td>${n===null||n===undefined?'<span class="muted">まだ</span>':n===0?'なし':n+'人<br><span class="small muted">'+st.role+'</span>'}</td><td class="small">${st.task}</td><td class="num small">${u&&u[0]<u[1]?C.hm(u[0])+'〜'+C.hm(u[1]):'—'}</td></tr>`;}).join('')}</tbody></table></div>
  <p class="small muted">人は今夜 ${known}人（${B.staffNote}）。出荷の人と休憩の交代はまだ数えていません。人件費は、${known}人が炊き始めから最後の包装（または2:30）までいる、という大まかな計算です。</p>`;}
function result(){const s=R.summary,B=D.bento;$('btresultWait').hidden=true;$('btresult').hidden=false;
  $('btresult').innerHTML=`<p class="big">注文 <b>${s.order}</b>個${s.center?`（うちセンター ${s.center}個）`:''} → ${C.hm(D.deadline)}までに <b>${s.shipped}</b>個をチルドで出荷。<span class="${s.short?'down':'up'}">${s.short?s.short+'個足りません':'全部そろいました'}</span></p>
  <div class="tw"><table><thead><tr><th>お弁当</th><th>注文</th><th>うちセンター</th><th>出荷</th><th>不足</th><th>不合格</th><th>締め切り後</th><th>余り</th></tr></thead><tbody>${s.prods.map(p=>`<tr><th>${p.name}</th>${['order','center','shipped','short','bad','late','surplus'].map(k=>`<td class="num r">${p[k]}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
  <p>いちばん待った理由：<b>${s.neck[1]?s.neck[0]:'特になし'}</b>（ひと組ごとの待ちの合計${s.neck[1]}分）。最後の包装 ${C.hm(s.lastDone)}。</p>
  <p>人件費 ${yen(s.yen.labor)} ／ 材料・容器 ${yen(s.yen.material)} ／ 急速冷却 ${yen(s.yen.chill)} ／ 機械 ${yen(s.yen.machine)}<br>合計 <b>${yen(s.yen.total)}</b>・出荷1個あたり ${s.yen.perUnit?yen(s.yen.perUnit):'—'}</p>
  <p class="small muted">${B.expiryNote}。センターから頼まれたお弁当（港駅の店の分）は、納品書にのって、チルドのかご車で朝・昼前・午後の便に分けて届きます。</p>`;}
function draw(){if(!R)return;const c=R.cfg,t=Math.floor(cur);$('btclock').textContent=C.hm(t);$('btscrub').value=t;$('btplay').textContent=playing?'❚❚ 止める':'▶ 再生';if(minute===t)return;minute=t;liveNote();
  const made=R.batches.filter(b=>b.good&&b.done<=t&&b.done<=D.deadline).reduce((n,b)=>n+b.n,0),inChill=R.batches.filter(b=>t>=b.chill&&t<b.chill+R.chillMin).length;
  $('btclocks').innerHTML=`<div class="clk"><b>ご飯の時計</b><span class="v">${t<c.start+D.bento.rice.lead?'炊いている':'炊けている'}</span><div class="small">最初のご飯 ${C.hm(c.start+D.bento.rice.lead)}</div></div><div class="clk"><b>冷却の時計</b><span class="v">${inChill}／${c.chillers}台</span><div class="small">ひと組 ${R.chillMin}分</div></div><div class="clk"><b>人の時計</b><span class="v">${D.bento.staff+c.fillers}人</span><div class="small">詰める${c.fillers}人＋おかず・包装</div></div><div class="clk"><b>包装の時計</b><span class="v">${made}個 包装ずみ</span><div class="small">${C.hm(D.deadline)}まで・${t<D.orderConfirm?'注文は20:00確定':`注文 ${R.summary.order}個`}</div></div>`;
  $('btevents').innerHTML=R.ev.filter(e=>e.t<=t).slice(-16).reverse().map(e=>`<li><span class="num">${C.hm(e.t)}</span><span>${e.msg}</span></li>`).join('')||'<li>これから炊き始めます。</li>';
  const opened=[...$('btbatches').querySelectorAll('details')].map(e=>e.open);
  $('btbatches').innerHTML=R.batches.map((b,i)=>{const p=R.products.find(p=>p.id===b.prod),st=C.stage(b,t),seen=t>=b.done;return `<details ${opened[i]?'open':''}><summary>${p.name} ${b.n}個 — ${st}${seen?'（'+b.score+'点）':''}</summary><p class="small">${b.steps.filter(s=>s.end>s.start).map(s=>`${C.hm(s.start)}〜${C.hm(s.end)} ${s.label}`).join('<br>')}${seen&&b.why.length?'<br>'+b.why.join('・'):''}</p></details>`;}).join('');
  drawStage(t);if(t>=R.T1)result();}
function drawStage(t){const cv=$('btstage'),W=1000,H=300,dpr=window.devicePixelRatio||1;
  if(cv.width!==W*dpr||cv.height!==H*dpr){cv.width=W*dpr;cv.height=H*dpr;}
  const c=cv.getContext('2d'),cf=R.cfg;c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,W,H);
  const rect=(x,y,w,h,col)=>{c.fillStyle=col;c.fillRect(x,y,w,h);};
  const text=(s,x,y,size=13,col='#51463c')=>{c.fillStyle=col;c.font=`bold ${size}px sans-serif`;c.textAlign='center';c.fillText(s,x,y);};
  const circ=(x,y,r,col)=>{c.fillStyle=col;c.beginPath();c.arc(x,y,r,0,7);c.fill();};
  const phase=playing?FL.sec():0;
  rect(0,0,W,H,'#f3f5f2');rect(0,252,W,48,'#dfe5e0');
  const SN=D.bento.stations||[];COLS.forEach(([x,w],i)=>{const st=SN[i]||{name:''};rect(x,20,w-6,30,'#dbe6ee');text(st.name,x+w/2-3,40,13,'#4f6878');const n=crewOf(st,cf);text(n===null||n===undefined?'人：まだ':n===0?'機械だけ':'人'+n+'＋機械',x+w/2-3,64,11,n?'#3d6b8f':'#8a8a80');});
  // 機械：フライヤーと焼き台・炊飯器・ベルト・急速冷却・ふたの機械・チルドの部屋
  rect(28,120,70,70,'#9fb2a8');rect(36,128,54,30,'#d9a548');text('揚げ',63,180,11,'#3f5248');
  rect(104,120,70,70,'#9fb2a8');for(let i=0;i<4;i++)rect(110,130+i*12,58,4,'#6b4a3a');text('焼き',139,180,11,'#3f5248');
  const busy=k=>R.batches.some(b=>b.mach===k&&t>=b.okazu&&t<b.okazu+R.products.find(p=>p.id===b.prod).cook);
  if(busy('fryer'))for(let i=0;i<4;i++)circ(46+i*13,143+Math.sin(phase*5+i)*3,2,'#fbe1a0');
  if(busy('grill'))for(let i=0;i<3;i++){c.globalAlpha=.35;circ(120+i*18,112-((phase*20+i*9)%24),5,'#bbb');c.globalAlpha=1;}
  rect(212,110,96,90,'#b9c6be');c.fillStyle='#eef2ef';c.beginPath();c.ellipse(260,130,34,10,0,0,7);c.fill();text(t<cf.start+D.bento.rice.lead?'炊飯中':'ご飯',260,175,12,'#3f5248');
  rect(330,205,350,26,'#728683');rect(336,209,338,10,'#a7b8b1');for(let x=340;x<672;x+=30)circ(x+(playing?phase*18%30:0),225,3,'#dce3d9');
  for(let i=0;i<cf.fillers;i++){const x=350+i*(160/Math.max(1,cf.fillers-1||1)),y=i%2?245:180;circ(x,y,7,'#3d6b8f');rect(x-6,y+6,12,10,'#e8edf2');}
  for(let i=0;i<cf.chillers;i++){const x=528+i*55;rect(x,105,50,100,'#a9bccb');rect(x+6,113,38,60,'#e6f1f8');const on=R.batches.some(b=>b.chiller===i&&t>=b.chill&&t<b.chill+R.chillMin);text(on?'❄':'',x+25,150,18,'#5d8db0');}
  rect(712,125,120,80,'#b2c0b8');rect(724,137,96,36,'#eef3ef');text('ふた・ラベル',772,195,11,'#3f5248');
  rect(880,110,100,95,'#cfdde8');rect(928,110,3,95,'#9db3c4');text('チルド 5℃',930,225,12,'#4b6a82');
  // ひと組の絵：容器（ご飯の白とおかずの色）。場所は計算の工程と進み具合から
  const loc={'おかずを待つ':[30,30],'揚げる':[40,90],'焼く':[115,165],'詰めるのを待つ':[335,335],'詰める':[340,670],'冷却を待つ':[525,525],'急速冷却':[540,690],'包装を待つ':[715,715],'ふたと包装':[720,830]};
  const act=R.batches.filter(b=>t>=b.at&&t<b.done),groups=COLS.map(()=>[]);
  for(const b of act){const st=C.stage(b,t),r=loc[st],s=b.steps.find(x=>x.label===st&&t>=x.start&&t<x.end);if(!r||!s)continue;groups[colOf(st)].push([b,st]);
    if(st==='おかずを待つ')continue;
    const pr=Math.max(0,Math.min(1,(t-s.start)/Math.max(1,s.end-s.start))),x=st==='急速冷却'?543+b.chiller*55:r[0]+(r[1]-r[0])*pr,y=st==='急速冷却'?160:st==='揚げる'||st==='焼く'?200:198,p=R.products.find(q=>q.id===b.prod);
    if(st==='揚げる'||st==='焼く'){circ(x,y,6,p.color);continue;}
    const packed=st==='ふたと包装'&&pr>0.5;rect(x-11,y-8,22,14,'#2b2b2b');rect(x-9,y-6,9,10,'#f7f5ef');rect(x,y-6,9,10,p.color);if(packed){c.strokeStyle='#e8f4ed';c.lineWidth=2;c.strokeRect(x-12,y-9,24,16);}}
  groups.forEach((g,i)=>{if(!g.length)return;const [x,w]=COLS[i],cx=x+w/2-3;const l1=g.length===1?R.products.find(p=>p.id===g[0][0].prod).name+' '+g[0][0].n+'個':g.length+'組・'+g.reduce((a,[b])=>a+b.n,0)+'個';
    const sts=[...new Set(g.map(([,s])=>s))];c.fillStyle='rgba(255,255,255,.92)';c.fillRect(x+2,72,w-10,30);text(l1,cx,84,11);text(sts.length>2?sts.slice(0,2).join('・')+'…':sts.join('・'),cx,98,10,'#6b5a44');});
  const done=R.batches.filter(b=>b.good&&b.done<=t&&b.done<=D.deadline).reduce((n,b)=>n+b.n,0);
  text('チルドの部屋 '+done+'個',930,280,13);text(act.length?'作っているひと組 '+act.length+'組':t<cf.start?'夕方：まだ始まっていません':'ひと組を待っています',150,280,13);}
async function init(){if(!$('bentoView')||!C)return;try{D=await fetch('data/factory.json',{cache:'no-cache'}).then(r=>r.json());let st={};try{st=JSON.parse(getItem(KEY)||'{}')||{};}catch(e){}cfg=C.normalize(D,st.cfg);plan();run();}catch(e){$('btplan').textContent='お弁当のラインの設定を読み込めませんでした。ページを再読み込みしてください。';console.error(e);return;}
  $('btrun').onclick=()=>{run();playing=true;draw();};$('btnewNight').onclick=()=>{cfg.seed=cfg.seed%9999+1;run();};$('btplay').onclick=()=>{if(cur>=R.T1&&speed!=='live')cur=R.T0;playing=!playing;minute=-1;draw();};
  $('btscrub').oninput=e=>{cur=+e.target.value;if(speed==='live'&&playing)playing=false;minute=-1;draw();};$('btspeed').onchange=e=>{const v=e.target.value;speed=v==='live'?'live':+v;playing=true;if(cur>=R.T1&&speed!=='live')cur=R.T0;minute=-1;draw();};$('btpeek').onclick=result;
  const set=v=>{active=v==='bento';if(active){$('lineName').textContent=D.bento.line;minute=-1;draw();}};window.addEventListener('factory-tab',e=>set(e.detail));set(!$('bentoView').hidden?'bento':'');window.addEventListener('resize',()=>{if(active)drawStage(cur);});
  function tick(now){if(active&&playing&&!document.hidden){if(speed==='live')cur=FL.liveAt(R.T0,R.T1);else{cur=Math.min(R.T1,cur+Math.min(0.25,(now-last)/1000)*speed/60);if(cur>=R.T1)playing=false;}
    if(speed!=='live'||now-lastDraw>=50){lastDraw=now;draw();if(playing)drawStage(cur);}}last=now;requestAnimationFrame(tick);}requestAnimationFrame(tick);}
init();
})();
