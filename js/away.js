/* =====================================================================
   留守のあいだ
   ・このゲームはサーバーを持たないので、ページを閉じているあいだは何も動かない。
     そのかわり、開いたとき（スマホで裏から戻ったときも）に、前に見ていた時刻から
     何運行日たったかを数え、進めなかった運行日を1日ずつまとめて進める。
     沿線暦（ゲーム全体の運行日）・売店・リサーチがいっしょに進むので、閉じているあいだも動いていたように見える。
   ・運行日の区切りは日本時間の朝4:30（ゲームの運行日と同じ）。
   ・留守にしていた日の曜日・季節は実際の暦から、天気はその日ごとに決まった乱数で決める（祝日は分からないので平日・土日だけ）。
     最後に見ていた日は、そのときの条件のまま締める。
   ・留守のあいだは棚割り・値段・仕入れを変えられないので、最後の設定のまま営業したことにする。
   ・まとめて進めるのは最大14運行日。それより長いときは、最後に見ていた日と、そのあとの13日分だけ。
   ===================================================================== */
(function(){
'use strict';
const KEY='dia-away',MAXD=14,DAY=86400000,JST=9*3600000,START_MS=270*60000;
const g=(f,d)=>{try{return f();}catch(e){return d;}};
const $=id=>document.getElementById(id);
const opIndex=ms=>Math.floor((ms+JST-START_MS)/DAY);          // 日本時間の朝4:30で区切った「何日目」
const opDate=i=>new Date(i*DAY+START_MS-JST+12*3600000);       // その運行日の昼ごろ（曜日・月を見るため）
function load(){try{return JSON.parse(localStorage.getItem(KEY)||'null');}catch(e){return null;}}
function save(){if(V.busy)return;try{localStorage.setItem(KEY,JSON.stringify({at:Date.now(),day:g(()=>ENS.day,1),cond:g(()=>({day:COND.day,wx:COND.wx,season:COND.season}),null)}));}catch(e){}}
const V={busy:false};

function hash(s){let h=2166136261>>>0;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}return h;}
/* 留守にしていた日の条件：曜日と季節は実際の暦、天気は日ごとに決まった乱数 */
function condFor(i){const d=opDate(i),wd=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Tokyo',weekday:'short'}).format(d),mo=Number(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Tokyo',month:'numeric'}).format(d));
  const season=mo>=3&&mo<=5?'spr':mo>=6&&mo<=8?'sum':mo>=9&&mo<=11?'aut':'win',day=wd==='Sat'?'sat':wd==='Sun'?'hol':'wd';
  const r=(hash('wx'+i)%1000)/1000,w=season==='win'?[0.5,0.25,0.12,0.13]:[0.55,0.25,0.2,0];let k=0,a=0;for(;k<4;k++){a+=w[k];if(r<a)break;}
  return {day,season,wx:['sun','cld','rain','snow'][Math.min(3,k)]};}
const label=c=>({wd:'平日',sat:'土曜',hol:'日曜'}[c.day]||'')+'・'+({sun:'晴れ',cld:'くもり',rain:'雨',snow:'大雪'}[c.wx]||'');

/* 進める：最後に見ていた日（そのときの条件）→ 留守の日（暦の条件）を1日ずつ締める */
async function catchUp(reason){const a=load();if(!a){save();return;}
  const from=opIndex(a.at),now=opIndex(Date.now()),missed=now-from;if(missed<=0){save();return;}
  if(V.busy)return;V.busy=true;
  const n=Math.min(missed,MAXD),skip=missed-n,ksBefore=g(()=>minatoKiosk.state&&minatoKiosk.state.hist.length,0),rsBefore=g(()=>minatoResearch.state.studies.reduce((s,x)=>s+x.recs.length,0),0),day0=g(()=>ENS.day,1);
  const ov=overlay();const keepCond=g(()=>({...COND}),null),days=[];
  for(let k=0;k<n;k++){const i=k===0?from:now-(n-k);const c=k===0&&a.cond?a.cond:condFor(i);
    ov.textContent=`留守のあいだの運行日を進めています… ${k+1}／${n}（${label(c)}）`;await new Promise(r=>setTimeout(r,30));
    try{setCond({...COND,...c});rebuild();g(()=>minatoKiosk.sync());g(()=>minatoResearch.sync());   // その日のダイヤで売店・調査の1日分を出しておく
      ENSEN_UI.dayEnd(true);                                                                      // 沿線暦を次の運行日へ（ここで売店・調査がその日を締める）
      g(()=>minatoKiosk.sync());g(()=>minatoResearch.sync());days.push(c);}catch(e){console.warn('留守の運行日を進められませんでした',e);break;}}
  // きょうの条件に戻す（曜日・季節は暦、天気はあとで実際の天気を取りに行く）
  try{const c=condFor(now);setCond({...(keepCond||COND),day:c.day,season:c.season});saveCond();renderCondUI();rebuild();}catch(e){}
  try{T=liveT();}catch(e){}g(()=>liveCond().catch(()=>{}));
  V.busy=false;save();ov.remove();
  // まとめ
  const ks=g(()=>minatoKiosk.state,null),hist=ks?ks.hist.slice(ksBefore):[];
  const sales=hist.reduce((s,h)=>s+h.sales,0),profit=hist.reduce((s,h)=>s+h.profit,0),cust=hist.reduce((s,h)=>s+h.cust,0);
  const rsAfter=g(()=>minatoResearch.state.studies.reduce((s,x)=>s+x.recs.length,0),0);
  if(ks&&hist.length){ks.news.push({day:g(()=>ENS.day,1),kind:'away',title:`留守のあいだの${hist.length}日分`,text:`お客さん${cust.toLocaleString()}人・売上${Math.round(sales).toLocaleString()}円・損益${Math.round(profit).toLocaleString()}円（最後の棚割り・値段・仕入れのまま営業）。`});ks.unread=(ks.unread||0)+1;g(()=>minatoKiosk.persist());}
  show({n:days.length,skip,day0,day1:g(()=>ENS.day,1),hist,sales,profit,cust,rs:rsAfter-rsBefore,reason});}

/* ---------- 画面 ---------- */
function overlay(){const d=document.createElement('div');d.className='away-busy';d.setAttribute('role','status');document.body.appendChild(d);return d;}
function show(o){if(!o.n)return;const box=document.createElement('div');box.className='away';box.setAttribute('role','dialog');box.setAttribute('aria-label','留守のあいだのできごと');
  const yen=v=>(v<0?'−':'')+'¥'+Math.round(Math.abs(v)).toLocaleString('ja-JP');
  box.innerHTML=`<div class="away-in"><h2>留守のあいだに ${o.n}運行日 進みました</h2>
    <p>第${o.day0}運行日 → 第${o.day1}運行日。${o.skip?`長く留守にしていたので、最後に見ていた日とそのあとの${o.n-1}日分だけ進めました（${o.skip}日分は飛ばしています）。`:''}</p>
    ${o.hist.length?`<table><thead><tr><th>運行日</th><th>条件</th><th>お客さん</th><th>売上</th><th>損益</th></tr></thead><tbody>${o.hist.map(h=>`<tr><td>${h.day}</td><td>${label(h.cond)}</td><td>${h.cust}</td><td>${yen(h.sales)}</td><td class="${h.profit<0?'neg':'pos'}">${yen(h.profit)}</td></tr>`).join('')}</tbody></table>
      <p>売店の合計：お客さん ${o.cust.toLocaleString()}人・売上 ${yen(o.sales)}・損益 <b class="${o.profit<0?'neg':'pos'}">${yen(o.profit)}</b>。くわしくは売店の「お知らせ」と「収支」へ。</p>`:''}
    ${o.rs?`<p>リサーチ：調査の記録が ${o.rs}日分 増えました。</p>`:''}
    <p class="away-note">留守にしていた日の曜日と季節は実際の暦から、天気はその日ごとに決めています。棚割り・値段・仕入れは、最後の設定のままです。</p>
    <div class="away-btns">${g(()=>minatoKiosk.state,null)?'<button type="button" id="awayKs">売店を見る</button>':''}<button type="button" id="awayOk" class="pri">閉じる</button></div></div>`;
  document.body.appendChild(box);const close=()=>box.remove();$('awayOk').onclick=close;box.addEventListener('click',e=>{if(e.target===box)close();});
  if($('awayKs'))$('awayKs').onclick=()=>{close();g(()=>minatoKiosk.open());};$('awayOk').focus();}
const CSS=`.away-busy{position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:90;background:var(--ink);color:var(--paper);font-size:13px;padding:8px 14px;border-radius:999px;box-shadow:0 4px 14px rgb(0 0 0 / .25)}
.away{position:fixed;inset:0;z-index:85;background:rgb(0 0 0 / .45);display:flex;align-items:center;justify-content:center;padding:16px}
.away-in{background:var(--paper);color:var(--ink);border-radius:14px;width:min(560px,100%);max-height:88vh;overflow:auto;padding:16px 18px;display:grid;gap:8px;font-size:13.5px;line-height:1.65}
.away-in h2{margin:0;font-size:18px}.away-in p{margin:0}.away-in table{border-collapse:collapse;font-size:12.5px;font-variant-numeric:tabular-nums;width:100%}
.away-in th{font-size:11px;color:var(--muted);font-weight:400;text-align:right;padding:3px 6px;border-bottom:1px solid var(--line)}.away-in td{text-align:right;padding:3px 6px;border-bottom:1px solid var(--line)}.away-in td:first-child,.away-in th:first-child{text-align:left}
.away-in .neg{color:#c9573f}.away-in .pos{color:#2f8a4a}.away-note{font-size:11.5px;color:var(--muted)}
.away-btns{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}.away-btns button{font:inherit;font-size:14px;border:1px solid var(--line);background:var(--panel);color:var(--ink);border-radius:8px;padding:9px 14px;cursor:pointer;min-height:40px}
.away-btns button.pri{background:var(--accent);color:var(--accent-ink);border-color:var(--accent);font-weight:700}`;

/* ---------- 起動 ---------- */
{const s=document.createElement('style');s.textContent=CSS;document.head.appendChild(s);}
// 沿線暦・売店・リサーチの設定が読みこまれるのを待ってから、留守のあいだの分を進める
(function wait(n){const ok=g(()=>ENSEN_UI.ready,false)&&g(()=>minatoKiosk.ready,true)&&g(()=>minatoResearch.ready,true)&&g(()=>!!D,false);
  if(ok||n>60){setTimeout(()=>catchUp('open'),300);return;}setTimeout(()=>wait(n+1),250);})(0);
// 開いているあいだは、見ていた時刻を覚えておく。スマホで裏に回して戻ったときも、留守の分を進めて時刻を今に合わせる
setInterval(save,20000);
let hiddenAt=0;
document.addEventListener('visibilitychange',()=>{if(document.hidden){hiddenAt=Date.now();save();return;}
  if(hiddenAt&&Date.now()-hiddenAt>3*60000){const a=load();if(a&&opIndex(Date.now())>opIndex(a.at))catchUp('resume');else{try{T=liveT();}catch(e){}save();}}hiddenAt=0;});
addEventListener('pagehide',save);
window.minatoAway={catchUp,load,condFor,opIndex,
  // 開発用：前に見ていた時刻を n 日前にずらして、留守の分を進める動きを試す
  test(n){const a=load()||{};a.at=Date.now()-n*DAY;a.day=g(()=>ENS.day,1);a.cond=g(()=>({day:COND.day,wx:COND.wx,season:COND.season}),null);localStorage.setItem(KEY,JSON.stringify(a));return catchUp('test');}};
})();
