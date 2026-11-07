/* ドーナッツの画面。計算はDonutCore、条件だけをブラウザに保存する。 */
(function(){
'use strict';
const C=window.DonutCore,$=id=>document.getElementById(id),KEY='dia-factory-donut';
let D,R,cfg,cur,playing=false,active=false,last=0,minute=-1,speed=300;
const yen=n=>Math.round(n).toLocaleString()+'円';
function save(){try{localStorage.setItem(KEY,JSON.stringify({cfg}));}catch(e){}}
function run(){R=C.simulate(D,(window.FactoryNight?FactoryNight.withCenter(cfg,FactoryNight.readLog(k=>{try{return localStorage.getItem(k);}catch(e){return null;}})):cfg));cfg=Object.assign({},R.cfg);delete cfg.center;delete cfg.centerNo;{const e=$('dnightInfo');if(e)e.textContent=`夜の番号 ${cfg.seed}`+(window.FactoryNight?' '+FactoryNight.centerNote(D,FactoryNight.readLog(k=>{try{return localStorage.getItem(k);}catch(e){return null;}}),'donut','個'):'');}cur=R.T0;minute=-1;playing=false;save();$('dresult').hidden=true;$('dresultWait').hidden=false;$('dscrub').min=R.T0;$('dscrub').max=R.T1;recipes();stations();draw();}
function plan(){const B=D.donut;
 const select=(id,label,opts)=>`<div><label for="d${id}">${label}</label><select id="d${id}">${opts.map(([v,t])=>`<option value="${v}" ${String(cfg[id])===String(v)?'selected':''}>${t}</option>`).join('')}</select></div>`;
 const times=[];for(let t=B.ranges.start[0];t<=B.ranges.start[1];t+=15)times.push([t,C.hm(t)]);
 $('dplan').innerHTML=select('season','季節',Object.entries(D.seasons).map(([k,s])=>[k,s.label]))+select('start','仕込みを始める時刻',times)+select('fryers','専用フライヤー',[1,2,3].map(n=>[n,n+'台']))+select('oilT','油の温度',[155,160,165,170,175,180,185,190,195].map(n=>[n,n+'℃']))+select('oilEvery','油を交換する目安',[240,480,720,960,1440,2400].map(n=>[n,n+'個ごと／台']))+select('finishers','仕上げの人数',[1,2,3,4,5,6].map(n=>[n,n+'人']));
 for(const k of ['season','start','fryers','oilT','oilEvery','finishers'])$('d'+k).onchange=e=>{cfg[k]=k==='season'?e.target.value:+e.target.value;recipes();};
 recipes();
 $('dproducts').innerHTML=B.products.map(p=>`<span class="tag">🍩 ${p.name}</span>`).join(' ');
}
// 工程と持ち場の対応（線の上の7つの場所）。
const COLS=[[30,135],[165,135],[300,170],[470,140],[610,130],[740,140],[880,90]];
function colOf(label){if(['仕込み','一次発酵'].includes(label))return 0;if(['成形を待つ','成形','ホイロ'].includes(label))return 1;if(['揚げる順番を待つ','油を交換','揚げる'].includes(label))return 2;if(label==='冷ます')return 3;if(['包装を待つ','包装'].includes(label))return 5;return 4;}
const crewOf=(st,c)=>st.crew==='finishers'?c.finishers:st.crew;
function crewText(st,c){const n=crewOf(st,c);return n===null||n===undefined?'人：まだ数えていない':n===0?'人なし（機械だけ）':`人 ${n}人（${st.role}）`;}
function recipes(){const B=D.donut,season=D.seasons[cfg.season]||D.seasons[B.defaults.season],n=B.batch;
 $('drecipes').innerHTML=`<div class="dgrid">${B.products.map(p=>{const r=p.recipe||{},fe=C.fermentMin(B,p,season),co=C.coolMin(B,p,season),loads=Math.ceil(n/B.fryCap),fin=Math.ceil(n/(p.finishRate*cfg.finishers));
  const rows=[['こねる',B.mix+'分','ミキサー'],['一次発酵',fe+'分',`部屋${season.room}℃・${season.label}`],['成形',Math.ceil(n/B.shapeRate)+'分',r.shape||''],['ホイロ（最後の発酵）',p.proof+'分',''],['揚げる',loads*p.fry+'分',`${B.fryCap}個ずつ${loads}回・1回${p.fry}分・向いている油は${p.oilT}℃（今夜は${cfg.oilT}℃）`],['冷ます',co+'分',''],[p.finish,fin+'分',`${cfg.finishers}人で`]];
  if(p.set)rows.push(['チョコを固める',p.set+'分','']);
  const sum=rows.reduce((a,x)=>a+parseInt(x[1]),0);
  return `<div class="drec"><h3><span class="ddot" style="background:${p.color}"></span>${p.name}</h3><p class="small"><b>生地：</b>${r.dough||'—'}</p>
  <p class="small"><b>配合</b>（粉＝100）：${(r.ratio||[]).map(([k,v])=>`${k} ${v}`).join('・')}</p>
  <table class="small"><tbody>${rows.map(([k,v,x])=>`<tr><th>${k}</th><td class="num r">${v}</td><td class="muted">${x}</td></tr>`).join('')}<tr><th>待ちがなければ</th><td class="num r"><b>${Math.floor(sum/60)}時間${sum%60}分</b></td><td class="muted">こね始めから仕上げまで（${n}個のひと組）</td></tr></tbody></table>
  <ul class="small">${(r.points||[]).map(x=>`<li>${x}</li>`).join('')}</ul></div>`;}).join('')}</div><p class="small muted">${B.recipeNote||''} ケーキドーナッツ（イーストを使わず発酵しない生地）は、まだ作っていません。</p>`;}
function stations(){const B=D.donut,c=R.cfg,use=COLS.map(()=>[Infinity,-Infinity]);
 for(const b of R.batches)for(const s of b.steps)if(s.end>s.start&&!/待つ/.test(s.label)){const u=use[colOf(s.label)];u[0]=Math.min(u[0],s.start);u[1]=Math.max(u[1],s.end);}
 for(const b of R.batches){const u=use[6];u[0]=Math.min(u[0],b.done);u[1]=Math.max(u[1],Math.min(b.done,D.deadline));}
 const known=(B.stations||[]).reduce((a,st)=>a+(Number.isFinite(crewOf(st,c))?crewOf(st,c):0),0);
 $('dstations').innerHTML=`<div class="tw"><table style="min-width:620px"><thead><tr><th>工程</th><th>機械</th><th>人</th><th>すること</th><th>今夜</th></tr></thead><tbody>${(B.stations||[]).map((st,i)=>{const u=use[i],n=crewOf(st,c);return `<tr><th>${st.name}</th><td>${st.machine||'—'}</td><td>${n===null||n===undefined?'<span class="muted">まだ</span>':n===0?'なし':n+'人<br><span class="small muted">'+st.role+'</span>'}</td><td class="small">${st.task}</td><td class="num small">${u[0]<u[1]?C.hm(u[0])+'〜'+C.hm(u[1]):'—'}</td></tr>`;}).join('')}</tbody></table></div>
 <p class="small muted">人は今夜 ${known}人（仕込み・成形・揚げ 各1人と仕上げ${c.finishers}人）。包装と出荷に付く人、休憩の交代、帰る時刻はまだ決めていません。そのため人件費は、${known}人が仕込みの始めから最後の包装（または2:30）までいる、という大まかな計算です。</p>`;}
function result(){const s=R.summary,cfg=R.cfg;$('dresultWait').hidden=true;$('dresult').hidden=false;
 $('dresult').innerHTML=`<p class="big">注文 <b>${s.order.toLocaleString()}</b>個 → ${C.hm(D.deadline)}までに <b>${s.shipped.toLocaleString()}</b>個を包装して出荷。<span class="${s.short?'down':'up'}">${s.short?s.short+'個足りません':'全部そろいました'}</span></p>
 <div class="tw"><table><thead><tr><th>商品</th><th>注文</th><th>出荷</th><th>不足</th><th>不合格</th><th>締め切り後</th><th>余り</th></tr></thead><tbody>${s.prods.map(p=>`<tr><th>${p.name}</th>${['order','shipped','short','bad','late','surplus'].map(k=>`<td class="num r">${p[k]}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
 <p>いちばん待った工程：<b>${s.neck[1]?s.neck[0]:'特になし'}</b>（生地ごとの待ちの合計${s.neck[1]}分）。油の交換${s.changes}回。最後の包装 ${C.hm(s.lastDone)}。</p>
 <p>人件費 ${yen(s.yen.labor)} ／ 材料・袋 ${yen(s.yen.material)} ／ 油 ${yen(s.yen.oil)} ／ 機械 ${yen(s.yen.machine)}<br>合計 <b>${yen(s.yen.total)}</b>・出荷1個あたり ${s.yen.perUnit?yen(s.yen.perUnit):'—'}</p>
 <p class="small muted">消費期限は出荷日の22:00（その夜の製造で固定）。余りと不合格も費用に含む。人件費は、仕込み・成形・揚げ 各1人と仕上げ${cfg.finishers}人が、仕込みの始めから最後の包装または締め切りまでいる計算（休憩の交代を含む概算）。包装・出荷の人と帰る時刻はまだ決めていません。売店への納品はまだ連動していません。</p>`;
}
function draw(){if(!R)return;const cfg=R.cfg,t=Math.floor(cur);$('dclock').textContent=C.hm(t);$('dscrub').value=t;$('dplay').textContent=playing?'❚❚ 止める':'▶ 再生';if(minute===t)return;minute=t;
 const made=R.batches.filter(b=>b.good&&b.done<=t&&b.done<=D.deadline).reduce((n,b)=>n+b.n,0);
 $('dclocks').innerHTML=`<div class="clk"><b>油の時計</b><span class="v">${cfg.oilT}℃・${cfg.fryers}台</span><div class="small">${cfg.oilEvery}個ごとに交換／台</div></div><div class="clk"><b>人の時計</b><span class="v">${D.donut.staff+cfg.finishers}人</span><div class="small">仕込み・成形・揚げ 各1人＋仕上げ${cfg.finishers}人</div></div><div class="clk"><b>包装の時計</b><span class="v">${made}個 包装ずみ</span><div class="small">${C.hm(D.deadline)}まで・${t<D.orderConfirm?'注文は20:00確定':`注文 ${R.summary.order}個`}</div></div>`;
 $('devents').innerHTML=R.ev.filter(e=>e.t<=t).slice(-16).reverse().map(e=>`<li><span class="num">${C.hm(e.t)}</span><span>${e.msg}</span></li>`).join('')||'<li>これから仕込みます。</li>';
 const opened=[...$('dbatches').querySelectorAll('details')].map(e=>e.open);
 $('dbatches').innerHTML=R.batches.map((b,i)=>{const p=R.products.find(p=>p.id===b.prod),st=C.stage(b,t),seen=t>=b.done;return `<details ${opened[i]?'open':''}><summary>${p.name} ${b.n}個 — ${st}${seen?'（'+b.score+'点）':''}</summary><p class="small">${b.steps.filter(s=>s.end>s.start).map(s=>`${C.hm(s.start)}〜${C.hm(s.end)} ${s.label}`).join('<br>')}${seen&&b.why.length?'<br>'+b.why.join('・'):''}</p></details>`;}).join('');
 drawStage(t);if(t>=R.T1)result();
}
function drawStage(t){
 const cv=$('dstage'),width=1000,height=330,dpr=window.devicePixelRatio||1;
 if(cv.width!==width*dpr||cv.height!==height*dpr){cv.width=width*dpr;cv.height=height*dpr;}
 const c=cv.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,width,height);
 const rect=(x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(x,y,w,h);};
 const text=(s,x,y,size=13,color='#51463c')=>{c.fillStyle=color;c.font=`bold ${size}px sans-serif`;c.textAlign='center';c.fillText(s,x,y);};
 const circ=(x,y,r,color)=>{c.fillStyle=color;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();};
 const phase=playing?performance.now()/1000:0;
 rect(0,0,1000,330,'#f6f2ea');rect(0,278,1000,52,'#e8dfd1');
 for(let x=0;x<1000;x+=110)rect(x,24,70,6,'#e1d5c5');
 // 工程ごとの場所。表示位置は各生地の計算上の工程と進み具合から決める。
 const locations={'仕込み':[75,110],'一次発酵':[110,170],'成形を待つ':[170,170],'成形':[170,240],'ホイロ':[240,300],'揚げる順番を待つ':[300,300],'油を交換':[300,300],'揚げる':[300,470],'冷ます':[470,610],'仕上げを待つ':[610,610],'砂糖をまぶす':[610,720],'チョコをかける':[610,720],'砂糖で仕上げる':[610,720],'仕上げを落ち着かせる':[720,740],'包装を待つ':[740,740],'包装':[740,880]};
 const SN=(D.donut.stations||[]);COLS.forEach(([x,w],i)=>{const st=SN[i]||{name:''};rect(x,54,w-4,31,'#dce7df');text(st.name,x+w/2,75,13,'#586f61');const n=crewOf(st,cfg);text(n===null||n===undefined?'人：まだ':n===0?'機械だけ':'人'+n+'＋機械',x+w/2,99,11,n?'#3d6b8f':'#8a8a80');});
 // 機械とベルトは添付の工場見学アニメの色や見せ方に合わせる。
 rect(18,234,960,30,'#718583');rect(25,239,946,13,'#a4b6af');
 for(let x=35;x<970;x+=34)circ(x+(playing?phase*22%34:0),257,4,'#dce3d9');
 for(let x=80;x<950;x+=190){rect(x,264,7,42,'#7f8c85');}
 rect(50,120,75,108,'#b5c8be');rect(61,133,53,47,'#eaf2e9');rect(83,147,6,60,'#829990');
 if(R.batches.some(b=>C.stage(b,t)==='仕込み')){c.save();c.translate(86,193);c.rotate(phase*3);rect(-22,-3,44,6,'#718a80');rect(-3,-18,6,36,'#718a80');c.restore();}
 rect(186,119,91,68,'#adc0b6');rect(199,131,66,40,'#e4eee6');rect(223,184,18,31,'#879c92');
 if(R.batches.some(b=>C.stage(b,t)==='成形'))rect(205,210+Math.sin(phase*5)*5,54,7,'#738c80');
 rect(305,192,158,43,'#8fa79c');rect(315,198,138,24,'#d7a548');
 for(let i=0;i<5;i++)circ(330+i*26,207+Math.sin(phase*4+i)*2,2,'#fbe1a0');
 rect(493,120,94,108,'#aebfb4');for(let y=134;y<222;y+=23)rect(500,y,80,4,'#e4eee5');
 rect(627,125,94,59,'#b6c7bd');rect(642,137,64,33,'#e7efe6');rect(665,185,18,28,'#8c9c93');
 rect(759,128,88,96,'#afc0b6');rect(771,142,64,38,'#e7efe6');text('包装',803,166,14,'#71897b');
 rect(892,164,64,64,'#e5c89f');rect(922,164,3,64,'#bb9775');text('出荷',924,201,14,'#987354');
 const active=R.batches.filter(b=>t>=b.mix&&t<b.done);
 for(const batch of active){const st=C.stage(batch,t),range=locations[st],step=batch.steps.find(s=>s.label===st&&t>=s.start&&t<s.end);if(!range||!step)continue;
 const progress=Math.max(0,Math.min(1,(t-step.start)/(step.end-step.start))),x=range[0]+(range[1]-range[0])*progress,p=R.products.find(p=>p.id===batch.prod);
 const raw=['仕込み','一次発酵','成形を待つ','成形','ホイロ','揚げる順番を待つ','油を交換'].includes(st);
 for(let k=0;k<3;k++){let dx=Math.max(36,x-k*15),y=228;
  if(raw){c.fillStyle='#e8c998';c.beginPath();c.ellipse(dx,y,9,6,0,0,7);c.fill();}
  else{circ(dx,y,8,'#b9783e');circ(dx,y-2,7,p.id==='choco'&&x>=610?'#70432d':'#d99b59');circ(dx,y-2,2.7,'#a4b6af');}
  if(st==='包装'){c.strokeStyle='#e8f4ed';c.lineWidth=2;c.strokeRect(dx-10,y-11,20,18);}
 }
 }
 // 文字は場所ごとに1つにまとめる（何組もあると重なって読めないため）。
 const groups=COLS.map(()=>[]);for(const b of active){const st=C.stage(b,t);if(locations[st])groups[colOf(st)].push([b,st]);}
 groups.forEach((g,i)=>{if(!g.length)return;const [x,w]=COLS[i],cx=x+w/2,short=n=>n==='生ドーナツ'?n:n.replace('ドーナツ','');
  const line1=g.length===1?short(R.products.find(p=>p.id===g[0][0].prod).name)+' '+g[0][0].n+'個':g.length+'組・'+g.reduce((a,[b])=>a+b.n,0)+'個';
  const sts=[...new Set(g.map(([,st])=>st))];c.fillStyle='rgba(255,253,248,.9)';c.fillRect(x+4,104,w-12,31);text(line1,cx,116,11);text(sts.length>2?sts.slice(0,2).join('・')+'…':sts.join('・'),cx,130,10,'#8b6044');});
 const done=R.batches.filter(b=>b.good&&b.done<=t&&b.done<=D.deadline).reduce((n,b)=>n+b.n,0);
 text('包装ずみ '+done+'個',905,298,13);text(active.length?'製造中の生地 '+active.length+'組':'生地の到着を待っています',140,298,13);
}
async function init(){if(!$('donutView'))return;try{D=await fetch('data/factory.json',{cache:'no-cache'}).then(r=>r.json());let st={};try{st=JSON.parse(localStorage.getItem(KEY)||'{}')||{};}catch(e){}cfg=C.normalize(D,st.cfg);plan();run();}catch(e){$('dplan').textContent='ドーナッツの設定を読み込めませんでした。ページを再読み込みしてください。';console.error(e);return;}
 $('drun').onclick=()=>{run();playing=true;draw();};$('dnewNight').onclick=()=>{cfg.seed=cfg.seed%9999+1;run();};$('dplay').onclick=()=>{if(cur>=R.T1)cur=R.T0;playing=!playing;draw();};$('dscrub').oninput=e=>{cur=+e.target.value;draw();};$('dspeed').onchange=e=>{speed=+e.target.value;};$('dpeek').onclick=result;
 const set=v=>{active=v==='donut';if(active){$('lineName').textContent=D.donut.line;minute=-1;draw();}};window.addEventListener('factory-tab',e=>set(e.detail));set(!$('donutView').hidden?'donut':'');window.addEventListener('resize',()=>{if(active)drawStage(cur);});
 function tick(now){if(active&&playing&&!document.hidden){cur=Math.min(R.T1,cur+Math.min(0.25,(now-last)/1000)*speed/60);if(cur>=R.T1)playing=false;draw();if(playing)drawStage(cur);}last=now;requestAnimationFrame(tick);}requestAnimationFrame(tick);
}
init();
})();
