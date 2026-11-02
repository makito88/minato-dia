/* ドーナッツの画面。計算はDonutCore、条件だけをブラウザに保存する。 */
(function(){
'use strict';
const C=window.DonutCore,$=id=>document.getElementById(id),KEY='dia-factory-donut';
let D,R,cfg,cur,playing=false,active=false,last=0,minute=-1,speed=300;
const yen=n=>Math.round(n).toLocaleString()+'円';
function save(){try{localStorage.setItem(KEY,JSON.stringify({cfg}));}catch(e){}}
function run(){R=C.simulate(D,cfg);cfg=Object.assign({},R.cfg);cur=R.T0;minute=-1;playing=false;save();$('dresult').hidden=true;$('dresultWait').hidden=false;$('dscrub').min=R.T0;$('dscrub').max=R.T1;draw();}
function plan(){const B=D.donut;
 const select=(id,label,opts)=>`<div><label for="d${id}">${label}</label><select id="d${id}">${opts.map(([v,t])=>`<option value="${v}" ${String(cfg[id])===String(v)?'selected':''}>${t}</option>`).join('')}</select></div>`;
 const times=[];for(let t=B.ranges.start[0];t<=B.ranges.start[1];t+=15)times.push([t,C.hm(t)]);
 $('dplan').innerHTML=select('season','季節',Object.entries(D.seasons).map(([k,s])=>[k,s.label]))+select('start','仕込みを始める時刻',times)+select('fryers','専用フライヤー',[1,2,3].map(n=>[n,n+'台']))+select('oilT','油の温度',[155,160,165,170,175,180,185,190,195].map(n=>[n,n+'℃']))+select('oilEvery','油を交換する目安',[240,480,720,960,1440,2400].map(n=>[n,n+'個ごと／台']))+select('finishers','仕上げの人数',[1,2,3,4,5,6].map(n=>[n,n+'人']));
 for(const k of ['season','start','fryers','oilT','oilEvery','finishers'])$('d'+k).onchange=e=>{cfg[k]=k==='season'?e.target.value:+e.target.value;};
 $('dproducts').innerHTML=B.products.map(p=>`<span class="tag">🍩 ${p.name}</span>`).join(' ');
}
function result(){const s=R.summary,cfg=R.cfg;$('dresultWait').hidden=true;$('dresult').hidden=false;
 $('dresult').innerHTML=`<p class="big">注文 <b>${s.order.toLocaleString()}</b>個 → ${C.hm(D.deadline)}までに <b>${s.shipped.toLocaleString()}</b>個を包装して出荷。<span class="${s.short?'down':'up'}">${s.short?s.short+'個足りません':'全部そろいました'}</span></p>
 <div class="tw"><table><thead><tr><th>商品</th><th>注文</th><th>出荷</th><th>不足</th><th>不合格</th><th>締め切り後</th><th>余り</th></tr></thead><tbody>${s.prods.map(p=>`<tr><th>${p.name}</th>${['order','shipped','short','bad','late','surplus'].map(k=>`<td class="num r">${p[k]}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
 <p>いちばん待った工程：<b>${s.neck[1]?s.neck[0]:'特になし'}</b>（生地ごとの待ちの合計${s.neck[1]}分）。油の交換${s.changes}回。最後の包装 ${C.hm(s.lastDone)}。</p>
 <p>人件費 ${yen(s.yen.labor)} ／ 材料・袋 ${yen(s.yen.material)} ／ 油 ${yen(s.yen.oil)} ／ 機械 ${yen(s.yen.machine)}<br>合計 <b>${yen(s.yen.total)}</b>・出荷1個あたり ${s.yen.perUnit?yen(s.yen.perUnit):'—'}</p>
 <p class="small muted">消費期限は出荷日の22:00（その夜の製造で固定）。余りと不合格も費用に含む。人件費は仕込みから最後の包装または締め切りまで、仕上げ${cfg.finishers}人＋ほか${D.donut.staff}人。休憩の交代を含む概算です。売店への納品はまだ連動していません。</p>`;
}
function draw(){if(!R)return;const cfg=R.cfg,t=Math.floor(cur);$('dclock').textContent=C.hm(t);$('dscrub').value=t;$('dplay').textContent=playing?'❚❚ 止める':'▶ 再生';if(minute===t)return;minute=t;
 const made=R.batches.filter(b=>b.good&&b.done<=t&&b.done<=D.deadline).reduce((n,b)=>n+b.n,0);
 $('dclocks').innerHTML=`<div class="clk"><b>油の時計</b><span class="v">${cfg.oilT}℃・${cfg.fryers}台</span><div class="small">${cfg.oilEvery}個ごとに交換／台</div></div><div class="clk"><b>人の時計</b><span class="v">仕上げ ${cfg.finishers}人</span><div class="small">砂糖・チョコの持ち場を共用</div></div><div class="clk"><b>包装の時計</b><span class="v">${made}個 包装ずみ</span><div class="small">${C.hm(D.deadline)}まで・${t<D.orderConfirm?'注文は20:00確定':`注文 ${R.summary.order}個`}</div></div>`;
 $('devents').innerHTML=R.ev.filter(e=>e.t<=t).slice(-16).reverse().map(e=>`<li><span class="num">${C.hm(e.t)}</span><span>${e.msg}</span></li>`).join('')||'<li>これから仕込みます。</li>';
 const opened=[...$('dbatches').querySelectorAll('details')].map(e=>e.open);
 $('dbatches').innerHTML=R.batches.map((b,i)=>{const p=R.products.find(p=>p.id===b.prod),st=C.stage(b,t),seen=t>=b.done;return `<details ${opened[i]?'open':''}><summary>${p.name} ${b.n}個 — ${st}${seen?'（'+b.score+'点）':''}</summary><p class="small">${b.steps.filter(s=>s.end>s.start).map(s=>`${C.hm(s.start)}〜${C.hm(s.end)} ${s.label}`).join('<br>')}${seen&&b.why.length?'<br>'+b.why.join('・'):''}</p></details>`;}).join('');
 drawStage(t);if(t>=R.T1)result();
}
function drawStage(t){const cv=$('dstage'),w=cv.clientWidth||800,h=280,dpr=devicePixelRatio||1;cv.width=w*dpr;cv.height=h*dpr;cv.style.height=h+'px';const c=cv.getContext('2d');c.scale(dpr,dpr);const narrow=w<600,cols=narrow?3:6,boxW=w/cols,boxH=narrow?130:250;
 const groups=[['仕込み','一次発酵'],['成形','ホイロ'],['揚げる','揚げる順番を待つ','油を交換'],['冷ます'],['砂糖をまぶす','チョコをかける','砂糖で仕上げる','仕上げを待つ','仕上げを落ち着かせる'],['包装','包装を待つ','包装ずみ']];
 const labels=['こねる・発酵','成形・ホイロ','フライヤー','冷ます','仕上げ','包装'];c.font='12px sans-serif';c.textBaseline='top';
 groups.forEach((g,j)=>{const x=(j%cols)*boxW,y=Math.floor(j/cols)*140;c.fillStyle='#f4eee2';c.fillRect(x+3,y+4,boxW-6,boxH);c.fillStyle='#45372c';c.fillText(labels[j],x+10,y+12);const bs=R.batches.filter(b=>g.includes(C.stage(b,t)));c.fillText(bs.reduce((n,b)=>n+b.n,0)+'個',x+10,y+32);
 bs.slice(-6).forEach((b,k)=>{const p=R.products.find(p=>p.id===b.prod),cx=x+22+(k%3)*Math.min(32,(boxW-28)/3),cy=y+67+Math.floor(k/3)*30;c.beginPath();c.fillStyle=p.color;c.arc(cx,cy,10,0,Math.PI*2);c.fill();c.beginPath();c.fillStyle='#f4eee2';c.arc(cx,cy,4,0,Math.PI*2);c.fill();});});
}
async function init(){if(!$('donutView'))return;try{D=await fetch('data/factory.json',{cache:'no-cache'}).then(r=>r.json());let st={};try{st=JSON.parse(localStorage.getItem(KEY)||'{}')||{};}catch(e){}cfg=C.normalize(D,st.cfg);plan();run();}catch(e){$('dplan').textContent='ドーナッツの設定を読み込めませんでした。ページを再読み込みしてください。';console.error(e);return;}
 $('drun').onclick=()=>{run();playing=true;draw();};$('dnewNight').onclick=()=>{cfg.seed=cfg.seed%9999+1;run();};$('dplay').onclick=()=>{if(cur>=R.T1)cur=R.T0;playing=!playing;draw();};$('dscrub').oninput=e=>{cur=+e.target.value;draw();};$('dspeed').onchange=e=>{speed=+e.target.value;};$('dpeek').onclick=result;
 const set=v=>{active=v==='donut';if(active){$('lineName').textContent=D.donut.line;minute=-1;draw();}};window.addEventListener('factory-tab',e=>set(e.detail));set(!$('donutView').hidden?'donut':'');window.addEventListener('resize',()=>{if(active)drawStage(cur);});
 function tick(now){if(active&&playing&&!document.hidden){cur=Math.min(R.T1,cur+Math.min(0.25,(now-last)/1000)*speed/60);if(cur>=R.T1)playing=false;draw();}last=now;requestAnimationFrame(tick);}requestAnimationFrame(tick);
}
init();
})();
