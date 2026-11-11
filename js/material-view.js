/* =====================================================================
   工場の画面「🚚 原材料」タブ（factory.html#material）。第5回・第1段：表示と記録だけ
   ・計算は js/material-core.js。ここは読むことと描くことだけ（製造の計算は変えない）。
   ・開いたときに、締めた運行日の夜の分まで記録を進める（売店の画面が締めで進めた分のつづき。同じ夜は2回数えない）。
   ・入荷の記録・品ごとの在庫の目盛り（あと何夜ぶん）・ロットのたどり（先入れ先出し）・原材料の一覧。
   ===================================================================== */
(function(){
'use strict';
const MC=window.MaterialCore;
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const J=k=>{try{return JSON.parse(localStorage.getItem(k)||'null');}catch(e){return null;}};
const hm=t=>{t=Math.round(t||0);const h=Math.floor(t/60)%24,m=t%60;return h+':'+String(m).padStart(2,'0');};
let D=null,S=null,T=0,active=false,filt='all',more=false,sel=null;
const V={};
/* 量の書き方：kg・L は小さいと小数1けた。枚・個は整数 */
function q(v,unit){v=+v||0;const dec=(unit==='kg'||unit==='L')&&Math.abs(v)<100?1:0;return v.toLocaleString('ja-JP',{maximumFractionDigits:dec,minimumFractionDigits:0})+unit;}
const daysLabel=d=>!d||!d.length?'—':d.length>=7?'毎日':`週${d.length}回`;
const dayWord=n=>`第${n}運行日`;
function today(){const e=J('dia-ensen');let d=(e&&e.day)|0;const lg=J('dia-orders');if(lg&&Array.isArray(lg.days))for(const x of lg.days)d=Math.max(d,x.day|0);return d;}
function sync(){T=today();const saved=MC.parse((()=>{try{return localStorage.getItem(MC.KEY);}catch(e){return null;}})());
  if(!T){S=saved||MC.newState(D,1);return;}
  const r=MC.catchUp(D,saved,J('dia-orders'),T);S=r.state;if(r.done||!saved)try{localStorage.setItem(MC.KEY,JSON.stringify(S));}catch(e){}}
const M=()=>D.materials;
const supName=it=>(M().suppliers||{})[it.sup]||it.sup||'';
const storeName=s=>(M().store||{})[s]||s;
const lineName=l=>(M().lines||{})[l]||l;
const showLine=it=>filt==='all'||it.line===filt;

function segs(){const L=M().lines||{};return `<div class="seg" role="group" aria-label="品の区分">${[['all','すべて'],...Object.entries(L)].map(([k,v])=>`<button type="button" data-f="${k}" class="${filt===k?'on':''}" aria-pressed="${filt===k}">${esc(v)}</button>`).join('')}</div>`;}
function meter(x){const it=x.it,cap=it.cap||1,w=Math.min(100,x.stock/cap*100),mark=x.avg>0?Math.min(100,x.avg*(M().warnNights||4)/cap*100):null;
  const word={low:'少ない',warn:'やや少ない',ok:'',idle:x.skip?'いまは使わない':'まだ使っていない'}[x.lvl];
  const nxt=x.next!=null?`次の入荷 ${dayWord(x.next)} ${hm(it.t)}（${q(it.qty,it.unit)}の予定）`:'次の入荷 —';
  return `<div class="mt-row ${x.lvl}"><div class="mt-h"><b>${esc(it.name)}</b> <span class="tag st-${it.store}">${esc(storeName(it.store))}</span>${word?` <span class="mt-w">${word}</span>`:''}</div>
    <div class="mt-bar" role="img" aria-label="${esc(it.name)}：在庫 ${q(x.stock,it.unit)}（置ける量 ${q(cap,it.unit)}）"><i style="width:${w.toFixed(1)}%"></i>${mark!=null?`<b style="left:${mark.toFixed(1)}%" title="${M().warnNights||4}夜ぶんの線"></b>`:''}</div>
    <div class="mt-n small"><span class="num">${q(x.stock,it.unit)}</span> / 置ける量 ${q(cap,it.unit)}・1夜に ${x.avg>0?q(x.avg,it.unit):'—'}${x.nights!=null?`・<b>あと ${x.nights>=10?Math.floor(x.nights):x.nights.toFixed(1)}夜ぶん</b>（いまある分だけで）`:''}${x.run!=null?`・<span class="${x.lvl==='low'?'bad':'warnc'}">入荷の予定を入れても、${dayWord(x.run)}の夜に足りなくなる見込み</span>`:''}・${nxt}${x.expired>0?`・<span class="bad">期限の切れたロット ${q(x.expired,it.unit)}</span>`:''}${x.short>0?`・<span class="bad">直近7夜で足りなかった ${q(x.short,it.unit)}</span>`:''}</div></div>`;}
function meters(st){const groups={};for(const x of st){if(!showLine(x.it))continue;(groups[x.it.line]||(groups[x.it.line]=[])).push(x);}
  const low=st.filter(x=>x.lvl==='low').map(x=>x.it.name),warn=st.filter(x=>x.lvl==='warn').map(x=>x.it.name);
  return `<p class="small">${low.length?`<span class="bad">少ない：${esc(low.join('・'))}</span>　`:''}${warn.length?`<span class="warnc">やや少ない：${esc(warn.join('・'))}</span>`:''}${!low.length&&!warn.length?`入荷の予定を入れると、どの品も${M().warnNights||4}夜のうちは足ります。`:''}</p>
    <p class="small muted">棒は置ける量に対する在庫。細い線は「${M().warnNights||4}夜ぶん」の量。1夜に使う量（直近7夜の平均）と入荷の予定で先を見通して、${M().lowNights||2}夜のうちに足りなくなりそうなら赤、${M().warnNights||4}夜のうちなら黄色。卵や野菜のように毎日届く品は、いまある分が少なくても、その日の入荷で間に合えば色は付きません。</p>
    ${Object.entries(groups).map(([l,xs])=>`<h3>${esc(lineName(l))}</h3><div class="mt-list">${xs.map(meter).join('')}</div>`).join('')}`;}
function receipts(){const R=MC.receipts(D,S).filter(r=>r.it&&showLine(r.it)),now=S.last+1,list=more?R:R.slice(0,30);
  if(!R.length)return '<p class="small muted">まだ入荷の記録がありません。</p>';
  return `<div class="tw"><table class="mt-tb"><thead><tr><th>日時</th><th>品名</th><th class="r">数量</th><th>仕入れ先</th><th>保管</th><th>消費期限</th><th>ロット番号</th></tr></thead><tbody>
    ${list.map(r=>`<tr><td class="nw">${r.init?`${dayWord(r.n)}（はじめの在庫）`:`${dayWord(r.n)} ${hm(r.t)}`}</td><td>${esc(r.it.name)}</td><td class="r num">${q(r.q,r.it.unit)}</td><td>${esc(r.sup)}</td><td>${esc(storeName(r.it.store))}</td><td class="nw ${r.exp<now?'bad':''}">${dayWord(r.exp)}まで</td><td class="num nw">${esc(r.no)}</td></tr>`).join('')}</tbody></table></div>
    ${R.length>30?`<button type="button" id="mtMore">${more?'30件だけにする':`もっと見る（全部で${R.length}件）`}</button>`:''}`;}
function trace(){const logs=S.log.slice().reverse();if(!logs.length)return '<p class="small muted">まだ夜の記録がありません。運行日を締めると、その夜の分から記録されます。</p>';
  if(sel==null||!logs.some(r=>r.n===sel))sel=logs[0].n;const tr=MC.trace(D,S,sel),r=tr.rec;
  const opts=logs.map(x=>`<option value="${x.n}"${x.n===sel?' selected':''}>${dayWord(x.n)}の夜（${dayWord(x.n+1)}の朝に出荷）${x.est?'・見込み':x.slip?'・納品書 '+esc(x.slip):''}</option>`).join('');
  const rice=(filt==='all'||filt==='rice')&&(tr.lines.rice||[]).find(x=>x.it.id==='rice'),first=rice&&rice.from[0];
  const lead=first?`<p>この夜のおにぎりの米は、<b>${dayWord(first.d)} ${hm(first.t)}</b> に届いたロット <b class="num">${esc(first.no)}</b>（${esc(first.sup)}）${rice.from.length>1?`から使いはじめ、つづけて ${rice.from.slice(1).map(f=>esc(f.no)).join('・')} から`:'から'}。古いロットから使います（先入れ先出し）。</p>`:'';
  const body=Object.entries(tr.lines).filter(([l])=>filt==='all'||l===filt).map(([l,xs])=>`<h3>${esc(lineName(l))}</h3><ul class="mt-tr">${xs.map(x=>`<li><b>${esc(x.it.name)}</b> <span class="num">${q(x.use,x.it.unit)}</span>${x.it.id==='rice'?' <span class="small muted">（お弁当のご飯も）</span>':x.it.id==='flour'?' <span class="small muted">（パンと、自社で焼くサンドの食パン）</span>':''} ← ${x.from.map(f=>`<span class="num">${esc(f.no)}</span> <span class="small muted">${dayWord(f.d)} ${hm(f.t)}・${esc(f.sup)}・${dayWord(f.exp)}まで</span> ${q(f.q,x.it.unit)}`).join('、')||'—'}${x.short?` <span class="bad">足りなかった ${q(x.short,x.it.unit)}</span>`:''}</li>`).join('')}</ul>`).join('');
  return `<div class="row"><label for="mtNight" class="small muted">どの夜</label><select id="mtNight">${opts}</select></div>
    ${r.est?'<p class="small warnc">この夜は納品書がなかったので（センターの発注がない夜など）、ラインの見込みの数で使った量を出しています。</p>':'<p class="small muted">使った量は、この夜の製造の結果（出荷・余り・遅れ・だめになった数と、米は炊いた釜の数）から出しています。</p>'}
    ${r.short?'<p class="small bad">足りなかった品があります。いまは表示と記録だけで、製造の計算は変えていません（作った数はそのまま）。</p>':''}${lead}${body}`;}
function list(){return `<details><summary>原材料の一覧（${M().items.length}品・すべて架空・数字は仮）</summary><div class="tw"><table class="mt-tb"><thead><tr><th>品名</th><th>区分</th><th>仕入れ先</th><th>届く単位</th><th class="r">1回に</th><th>入荷</th><th>日持ち</th><th>保管</th><th class="r">置ける量</th></tr></thead><tbody>
  ${M().items.map(it=>`<tr><td>${esc(it.name)}</td><td class="nw">${esc(lineName(it.line))}</td><td>${esc(supName(it))}</td><td class="nw">${esc(it.pack)}</td><td class="r num">${q(it.qty,it.unit)}</td><td class="nw">${daysLabel(it.days)} ${hm(it.t)}${it.onlyBuy?'（食パンを仕入れる夜だけ）':''}</td><td class="nw">${it.life}日</td><td>${esc(storeName(it.store))}</td><td class="r num">${q(it.cap,it.unit)}</td></tr>`).join('')}</tbody></table></div>
  <p class="small muted">入荷の日は、運行日の番号で数えた週の中の決まった日（センターの問屋への発注と同じ数え方）。置ける量をこえる分は、その回の量を減らして届きます（仮）。1個あたり使う量は、各ラインの設定（data/factory.json の packLine・bread・sand・donut・bento の mat）にあります。</p></details>`;}
function render(){const box=$('materialBox');if(!box||!D)return;sync();const st=MC.status(D,S),now=S.last+1;
  const nLog=S.log.length,est=S.log.filter(r=>r.est).length;
  box.innerHTML=`<section class="card"><h2>🚚 原材料：何が・いつ・どれくらい届いたか</h2>
    <p class="small">${T?`いまは${dayWord(T)}。記録は${dayWord(S.start||now)}の夜から${nLog?`${dayWord(S.last)}の夜まで（${nLog}夜ぶん${est?`・うち見込み${est}夜`:''}）`:'（まだありません）'}。`:'まだ運行日が始まっていません（トップから路線図とダイヤを開くと、運行日が進みはじめます）。いまは、はじめの在庫だけです。'}${S.gap?`長い留守のあいだの ${S.gap}夜ぶんは飛ばしました。`:''}</p>
    <p class="small muted">第1段は<b>表示と記録だけ</b>です。在庫＝入荷 − 使った量。足りなくなりそうでも、工場の製造の計算は変えていません。毎晩の製造の結果から使った量を出し、運行日の締めで記録が進みます（この画面を開いていなくても、売店の画面が締めたときに進みます）。仕入れ先・数字はすべて架空・仮です。</p>
    ${segs()}</section>
    <section class="card"><h2>在庫の目盛り（あと何夜ぶん）</h2>${meters(st)}</section>
    <section class="card"><h2>ロットのたどり（この夜の品は、いつ届いた分か）</h2>${trace()}</section>
    <section class="card"><h2>入荷の記録</h2>${receipts()}</section>
    <section class="card">${list()}</section>`;
  box.querySelectorAll('[data-f]').forEach(b=>b.onclick=()=>{filt=b.dataset.f;more=false;render();});
  const mb=$('mtMore');if(mb)mb.onclick=()=>{more=!more;render();};
  const ns=$('mtNight');if(ns)ns.onchange=()=>{sel=+ns.value;render();};}
async function init(){if(!$('materialView')||!MC)return;
  try{D=await fetch('data/factory.json',{cache:'no-cache'}).then(r=>r.json());}catch(e){$('materialBox').textContent='原材料の設定を読み込めませんでした。ページを再読み込みしてください。';return;}
  if(!D.materials){$('materialBox').textContent='原材料の設定（data/factory.json の materials）がありません。';return;}
  const set=v=>{active=v==='material';if(active)render();};
  window.addEventListener('factory-tab',e=>set(e.detail));set(!$('materialView').hidden?'material':'');
  // 開いたまま運行日が変わったときも（ほかのタブで売店が締めたとき）、見ていれば描き直す
  window.addEventListener('storage',e=>{if(active&&(e.key==='dia-orders'||e.key==='dia-ensen'||e.key===MC.KEY))render();});}
window.minatoMaterial={render,state:()=>S};
init();
})();
