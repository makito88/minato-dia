/* 沿線くらしアンケートの画面。計算は js/survey-core.js、設定は data/survey.json、駅の名前は docs/town.json。 */
(function(){
'use strict';
const SC=window.SurveyCore,$=id=>document.getElementById(id);
const V={D:null,T:null,years:[],year:0,q:0,opt:0,st:'C',playing:null};
const COLS=['--s1','--s2','--s3','--s4','--s5','--s6'];
const col=i=>`var(${COLS[i%COLS.length]})`;
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const pct=v=>Math.round(v)+'%';
const memo={};
function W(qi,id,y){const k=qi+'|'+id+'|'+y;return memo[k]||(memo[k]=SC.wave(V.D,V.D.questions[qi],id,y));}
function TOT(qi,y){const k=qi+'|*|'+y;return memo[k]||(memo[k]=SC.total(V.D,V.D.questions[qi],y));}
const Q=()=>V.D.questions[V.q];
const isRate=()=>Q().kind==='rate';
const optLabel=j=>isRate()?'はい':Q().options[j].label;
const ids=()=>V.T.stationOrder.filter(id=>V.D.areas[id]);
const nameOf=id=>V.T.stations[id].name;

/* ---------- 吹き出し ---------- */
const tip=$('tip');
function showTip(e,html){tip.innerHTML=html;tip.hidden=false;const x=Math.min(innerWidth-tip.offsetWidth-8,e.clientX+14),y=Math.max(8,e.clientY-tip.offsetHeight-10);tip.style.left=x+'px';tip.style.top=y+'px';}
function hideTip(){tip.hidden=true;}
function bindTips(root){root.querySelectorAll('[data-tip]').forEach(el=>{el.onmousemove=e=>showTip(e,el.dataset.tip);el.onmouseleave=hideTip;});}

/* ---------- 年と質問 ---------- */
function setYear(y){V.year=y;$('year').value=y;$('yr').innerHTML=`${y}<small>年10月</small>`;render();}
function buildTop(){
  const Y=V.years;$('year').min=Y[0];$('year').max=Y[Y.length-1];
  $('ticks').innerHTML=Y.map(y=>`<span>${y}</span>`).join('');
  $('year').oninput=e=>{stop();setYear(+e.target.value);};
  $('qs').innerHTML=V.D.questions.map((q,i)=>`<button type="button" data-q="${i}" aria-pressed="${i===V.q}">${esc(q.title)}</button>`).join('');
  $('qs').querySelectorAll('button').forEach(b=>b.onclick=()=>{V.q=+b.dataset.q;V.opt=0;$('qs').querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',x===b));render();});
  $('play').onclick=()=>{if(V.playing){stop();return;}let i=0;$('play').textContent='❚❚';setYear(V.years[0]);V.playing=setInterval(()=>{i++;if(i>=V.years.length){stop();return;}setYear(V.years[i]);},900);};}
function stop(){if(V.playing){clearInterval(V.playing);V.playing=null;}$('play').textContent='▶';}

/* ---------- 駅ごとにくらべる ---------- */
function refAt(y){const r=Q().ref;if(!r)return null;let best=null;for(const [yy,v] of r.points)if(yy<=y)best=v;return best;}
function renderRows(){
  const q=Q(),y=V.year;
  $('ask').innerHTML=`<b>${esc(q.title)}</b>${esc(q.ask)}`;
  // 凡例（選んだ答えを左にそろえて並べる）
  if(isRate()){$('legend').innerHTML=`<button type="button" aria-pressed="true"><i style="background:var(--bar)"></i>「はい」の割合</button>${q.ref?`<span class="src" style="align-self:center">┊ 点線＝${esc(q.ref.label)}</span>`:''}`;}
  else{$('legend').innerHTML=q.options.map((o,j)=>`<button type="button" data-o="${j}" aria-pressed="${j===V.opt}"><i style="background:${col(j)}"></i>${esc(o.label)}</button>`).join('');
    $('legend').querySelectorAll('button').forEach(b=>b.onclick=()=>{V.opt=+b.dataset.o;render();});}
  const order=isRate()?[0]:[V.opt,...q.options.map((_,j)=>j).filter(j=>j!==V.opt)];
  const row=(id,label,sub,w,cls)=>{
    let bar;
    if(isRate()){const r=refAt(y);bar=`<div class="bar" data-tip="${esc(`${label}・${y}年<br>はい ${pct(w.pct[0])}（${w.counts?w.counts[0]+'人／':''}${w.n}人）`)}"><span class="one" style="width:${w.pct[0]}%;background:var(--bar)"></span>${r!=null?`<i class="refmark" style="left:${r}%"></i>`:''}</div>`;}
    else bar=`<div class="bar">${order.map(j=>`<span style="width:calc(${w.pct[j]}% - 2px);background:${col(j)};opacity:${j===V.opt?1:.55}" data-tip="${esc(`${label}・${y}年<br>${q.options[j].label} <b>${pct(w.pct[j])}</b>${w.counts?`（${w.counts[j]}人）`:''}`)}"></span>`).join('')}</div>`;
    const v=w.pct[isRate()?0:V.opt];
    return `<div class="nm${cls||''}" data-st="${id}" aria-current="${id===V.st}">${esc(label)}<small>${esc(sub)}</small></div>${bar}<div class="v num${cls||''}">${pct(v)}</div>`;};
  let html=ids().map(id=>{const w=W(V.q,id,y);return row(id,nameOf(id),`${w.n}人`,w);}).join('');
  const t=TOT(V.q,y);html+=row('*','沿線全体',`${t.n}人`,t,' all');
  $('rows').innerHTML=html;
  $('rows').querySelectorAll('.nm[data-st]').forEach(el=>{if(el.dataset.st!=='*')el.onclick=()=>{V.st=el.dataset.st;render();};});
  $('rows').querySelectorAll('.bar').forEach((el,i)=>{const id=ids()[i];if(id)el.addEventListener('click',()=>{V.st=id;render();});});
  bindTips($('rows'));
  // 表
  const heads=isRate()?['はい']:q.options.map(o=>o.label);
  $('table').innerHTML=`<table class="tbl"><thead><tr><th>駅</th><th>人数</th>${heads.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${ids().map(id=>{const w=W(V.q,id,y);return `<tr><td>${esc(nameOf(id))}</td><td class="num">${w.n}</td>${heads.map((_,j)=>`<td class="num">${w.pct[j].toFixed(1)}%</td>`).join('')}</tr>`;}).join('')}</tbody></table>`;}

/* ---------- うつりかわり（小さなグラフを駅の数だけ） ---------- */
function renderMini(){
  const q=Q(),j=isRate()?0:V.opt,Y=V.years;
  $('trendTitle').textContent=`うつりかわり：${isRate()?q.title+'（はい）':q.options[j].label}`;
  const series=ids().map(id=>({id,name:nameOf(id),v:Y.map(y=>W(V.q,id,y).pct[j])}));
  series.push({id:'*',name:'沿線全体',v:Y.map(y=>TOT(V.q,y).pct[j])});
  const ref=isRate()&&q.ref?q.ref.points:null;
  let max=Math.max(...series.flatMap(s=>s.v),...(ref?ref.map(p=>p[1]):[0]));max=Math.min(100,Math.ceil((max+5)/10)*10);
  const w=160,h=70,px=i=>4+i*(w-8)/Math.max(1,Y.length-1),py=v=>h-4-v/max*(h-12);
  const yi=Y.indexOf(V.year);
  $('mini').innerHTML=series.map(s=>{
    const d=s.v.map((v,i)=>`${i?'L':'M'}${px(i).toFixed(1)},${py(v).toFixed(1)}`).join('');
    const refPath=ref&&s.id==='*'?ref.filter(p=>Y.includes(p[0])).map(p=>`<circle cx="${px(Y.indexOf(p[0]))}" cy="${py(p[1])}" r="3.2" fill="none" stroke="var(--ref)" stroke-width="1.5"/>`).join(''):'';
    const ch=s.v[yi]-s.v[0];
    return `<figure data-st="${s.id}" aria-current="${s.id===V.st}"><figcaption><span>${esc(s.name)}</span><span class="num">${pct(s.v[yi])} <small style="color:var(--muted)">${ch>=0?'+':''}${Math.round(ch)}</small></span></figcaption>
      <svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(s.name)}の${Y[0]}年から${Y[Y.length-1]}年">
      <line x1="0" x2="${w}" y1="${py(0)}" y2="${py(0)}" stroke="var(--grid)"/><line x1="0" x2="${w}" y1="${py(max/2)}" y2="${py(max/2)}" stroke="var(--grid)" stroke-dasharray="2 3"/>
      <line x1="${px(yi)}" x2="${px(yi)}" y1="4" y2="${h-4}" stroke="var(--accent)" stroke-width="1" opacity=".5"/>
      <path d="${d}" fill="none" stroke="${isRate()?'var(--bar)':col(j)}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>${refPath}
      ${s.v.map((v,i)=>`<circle cx="${px(i)}" cy="${py(v)}" r="${i===yi?4:2.2}" fill="${i===yi?'var(--accent)':(isRate()?'var(--bar)':col(j))}" stroke="var(--sheet)" stroke-width="1.5"/><rect x="${px(i)-8}" y="0" width="16" height="${h}" fill="transparent" data-tip="${esc(`${s.name}・${Y[i]}年 <b>${pct(v)}</b>`)}"/>`).join('')}
      </svg></figure>`;}).join('');
  $('mini').querySelectorAll('figure').forEach(f=>{if(f.dataset.st!=='*')f.onclick=()=>{V.st=f.dataset.st;render();};});
  bindTips($('mini'));
  $('refNote').innerHTML=ref?`○＝${esc(q.ref.label)}（実際の調査。<a href="${esc(q.ref.url)}" target="_blank" rel="noopener">${esc(q.ref.src)}</a>）。沿線全体のグラフに重ねています。縦の目もりは0〜${max}%。`:`縦の目もりは0〜${max}%（どの駅も同じ）。`;}

/* ---------- 年代でくらべる ---------- */
function renderAges(){
  const q=Q(),j=isRate()?0:V.opt,w=W(V.q,V.st,V.year);
  $('ageTitle').textContent=`年代でくらべる：${nameOf(V.st)}・${V.year}年（${isRate()?q.title:q.options[j].label}）`;
  $('ages').innerHTML=V.D.ages.map((a,ai)=>{const b=w.byAge[ai];return `<div>${esc(a)}<small class="src" style="display:block;line-height:1.1">${b.n}人</small></div><div class="bar" data-tip="${esc(`${nameOf(V.st)}・${a}<br><b>${pct(b.pct[j])}</b>（${b.n}人に聞いた）`)}"><span class="one" style="width:${b.pct[j]}%;background:${isRate()?'var(--bar)':col(j)}"></span></div><div class="v num">${b.n?pct(b.pct[j]):'—'}</div>`;}).join('');
  bindTips($('ages'));}

/* ---------- 読みとりメモ（その年の結果から、目立つところを文にする） ---------- */
function renderHint(){
  const q=Q(),j=isRate()?0:V.opt,Y=V.years,y=V.year,lab=isRate()?`「${q.title}」`:`「${q.options[j].label}」`;
  const now=ids().map(id=>({id,v:W(V.q,id,y).pct[j],v0:W(V.q,id,Y[0]).pct[j]}));
  const hi=[...now].sort((a,b)=>b.v-a.v),ch=[...now].sort((a,b)=>(b.v-b.v0)-(a.v-a.v0));
  const t=Y.map(yy=>TOT(V.q,yy).pct[j]);const peak=Y[t.indexOf(Math.max(...t))];
  const li=[];
  li.push(`${y}年に${lab}がいちばん多いのは<b>${esc(nameOf(hi[0].id))}</b>（${pct(hi[0].v)}）、いちばん少ないのは<b>${esc(nameOf(hi[hi.length-1].id))}</b>（${pct(hi[hi.length-1].v)}）。`);
  if(y>Y[0]){const up=ch[0],dn=ch[ch.length-1];
    li.push(`${Y[0]}年からいちばん増えたのは<b>${esc(nameOf(up.id))}</b>（${pct(up.v0)}→${pct(up.v)}）${dn.v-dn.v0<-2?`、減ったのは<b>${esc(nameOf(dn.id))}</b>（${pct(dn.v0)}→${pct(dn.v)}）`:''}。`);}
  li.push(`沿線全体では、${peak}年がいちばん多い（${pct(Math.max(...t))}）。`);
  const r=refAt(y);if(r!=null&&isRate())li.push(`全国の参考値（${pct(r)}）とくらべると、沿線全体は${TOT(V.q,y).pct[0]>r?'高め':'低め'}。${q.id==='net'?'（ただし聞き方がちがう数字です）':''}`);
  $('hint').innerHTML=li.map(x=>`<li>${x}</li>`).join('');}

function render(){if(!V.D)return;renderRows();renderMini();renderAges();renderHint();}

/* ---------- 読み込み ---------- */
Promise.all([fetch('data/survey.json').then(r=>r.json()),fetch('docs/town.json').then(r=>r.json())]).then(([D,T])=>{
  V.D=D;V.T=T;V.years=SC.years(D);V.year=V.years[V.years.length-1];
  const h=decodeURIComponent(location.hash.slice(1));const qi=D.questions.findIndex(q=>q.id===h);if(qi>=0)V.q=qi;
  buildTop();setYear(V.year);
  $('about').textContent=D.note;
  const refs=D.questions.filter(q=>q.ref).map(q=>`<a href="${esc(q.ref.url)}" target="_blank" rel="noopener">${esc(q.ref.src)}</a>`);
  $('sources').innerHTML='全国の参考値の出典：'+refs.join('／')+'。駅ごとの人数・答えはすべて架空です。';
}).catch(e=>{$('ask').textContent='読み込めませんでした：'+e.message;});
})();
