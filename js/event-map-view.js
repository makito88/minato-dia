/* =====================================================================
   地図の吹き出しとカード（第8回・2026-11-14）。ゲームの地図（index.html の #map）の「イベント」の層。
   出すもの：ゲームのイベント（この日の条件で選んだもの）・季節のできごと（その日になってから。前もって出さない）・
            お絵かき帖の「イベント」の層で置いたもの（保存 dia-routes の evs。その運行日の暦に合うものだけ）・
            天気（雨・大雪）・売店の開店と閉店。
   本体（index.html）からは init・draw・click だけを呼ぶ。乗客・売店の計算には何も渡さない（効き目は表示だけ）。
   ===================================================================== */
(function(){
'use strict';
const M=window.EventMapCore,Bub=window.EventBubble;if(!M||!Bub)return;
const KEY='dia-routes';
let CFG=null,GEN=[],H=null,RAW=null,EVS={v:1,items:{},recent:[]},HITS=[],SEL=null,LAST=[];
const V={get ready(){return !!(CFG&&H);}};

/* ---------- 読み込み ---------- */
Promise.all([fetch('data/event-map.json?v=20261114a').then(r=>r.ok?r.json():null).catch(()=>null),fetch('data/kiosk.json').then(r=>r.ok?r.json():null).catch(()=>null)]).then(([c,k])=>{
  if(!c)return;CFG=c;Bub.init(c);GEN=(k&&k.genres)||[];Bub.onload=()=>{if(H&&H.redraw)H.redraw();};check();});
function check(){let s=null;try{s=localStorage.getItem(KEY);}catch(e){}if(s===RAW)return;RAW=s;let j=null;try{j=JSON.parse(s||'null');}catch(e){}EVS=M.normalize(j&&j.evs);if(H&&H.redraw)H.redraw();}
addEventListener('storage',e=>{if(e.key===KEY)check();});addEventListener('focus',check);document.addEventListener('visibilitychange',()=>{if(!document.hidden)check();});

/* host：index.html が渡す（ST・T・evPos・季節のできごと・天気・暦の日付・カードのボタン） */
function init(host){H=host;}

/* ---------- その時刻に地図に出すものを集める ---------- */
const G=(f,d)=>{try{return f();}catch(e){return d;}};
function seasonKey(){const m=+(G(()=>H.ymd(),'2026-01-01')).slice(5,7);return m>=3&&m<=5?'spr':m>=6&&m<=8?'sum':m>=9&&m<=11?'aut':'win';}
function collect(snapEvents){const T=H.T(),ST=H.ST(),out=[];
  // 1) ゲームのイベント
  for(const {ev,state} of snapEvents||[]){const g=CFG.game[ev.id]||{},p=H.evPos(ev),amt=(ev.flows||[]).reduce((a,f)=>a+(f.amt||0),0);
    out.push({key:'g:'+ev.id,src:'game',ref:ev,x:p.x,y:p.y,icon:g.e?{e:g.e}:{t:String(ev.icon||'催').slice(0,2)},kind:g.kind||'fes',big:amt>=(CFG.bigFlow||30),state,a:ev.start,b:ev.end,name:ev.name,st:ev.place,desc:ev.desc||'',line:true});}
  // 2) 季節のできごと（その日のものだけ。SEAS.list はきょうの分しか持っていない）
  const SC=CFG.season||{};for(const o of G(()=>H.seas(),[])||[]){const rr=(o.ev.rail&&o.ev.rail[0]&&o.ev.rail[0].h)||[9,17],a=rr[0]*60,b=rr[1]*60;
    const p=o.st&&ST[o.st]?{x:ST[o.st].x+(SC.dx||20),y:ST[o.st].y+(SC.dy||-40)}:{x:(SC.line||[540,120])[0],y:(SC.line||[540,120])[1]};
    const goods=Object.keys(o.ev.kiosk||{}).filter(k=>o.ev.kiosk[k]>1);
    out.push({key:'s:'+o.id,src:'seas',ref:o,x:p.x,y:p.y,icon:{e:SC[seasonKey()]||'🍂'},kind:'season',big:(o.mag||1)>=1.25,state:M.state(a,b,T),a,b,name:o.ev.name||SC.name,st:o.st||'',desc:(o.ev.letter&&o.ev.letter.title)||'',fx:{ride:'s',goods},line:!!o.st});}
  // 3) お絵かき帖で置いたもの（その運行日の暦に合うもの）
  const ymd=G(()=>H.ymd(),'');if(ymd)for(const it of M.forDay(EVS,ymd)){const a=M.toMin(it.start),b=M.toMin(it.end);
    out.push({key:'u:'+it.id,src:'user',ref:it,x:it.x,y:it.y,icon:it.icon,kind:it.kind,rim:it.rim,big:it.big,state:M.state(a,b<a?b+1440:b,T),a,b,name:it.name,st:it.st,desc:it.memo,img:it.img,fx:it.fx,line:!!it.st});}
  // 4) 天気
  const w=CFG.weather&&CFG.weather[G(()=>H.wx(),'')];if(w)out.push({key:'w',src:'wx',x:w.pos[0],y:w.pos[1],icon:{e:w.e},kind:'weather',big:!!w.big,state:'during',a:270,b:1560,name:w.name,st:'',desc:w.note||'',fx:{ride:'',goods:w.goods||[]}});
  // 5) 売店の開店・閉店（開店のまわりと閉店のまわりだけ）
  const SW=CFG.shopWin||{};for(const s of CFG.shops||[]){const st=ST[s.st];if(!st)continue;let lab=null,a,b;
    if(T>=s.open-(SW.before||15)&&T<=s.open+(SW.after||40)){lab='開店';a=s.open;b=s.open+(SW.after||40);}
    else if(T>=s.close-(SW.closeBefore||30)&&T<=s.close+(SW.closeAfter||20)){lab='閉店';a=s.close-(SW.closeBefore||30);b=s.close;}
    if(!lab)continue;out.push({key:'k:'+s.id,src:'shop',ref:s,x:st.x+(s.dx||0),y:st.y+(s.dy||0),icon:{e:lab==='開店'?'🏪':'🌙'},kind:'shop',big:false,state:M.state(a,b,T),a,b,name:s.name+(lab==='開店'?' 開店':' まもなく閉店'),st:s.st,desc:lab==='開店'?`${M.hm(s.open)}に開きます`:`${M.hm(s.close)}に閉まります`,line:false});}
  return out;}

/* ---------- 描く ---------- */
function draw(c,snap,dk){if(!V.ready)return false;const t=performance.now()/1000,px=H.px(),ST=H.ST();
  const items=M.order(collect(snap.events));LAST=items;HITS=[];
  // 会場の駅との点線（うすく）
  c.save();c.setLineDash([2,3]);c.lineWidth=1;for(const it of items){if(!it.line||!ST[it.st])continue;c.globalAlpha=it.state==='after'?0.18:0.42;c.strokeStyle=Bub.rimOf(it);c.beginPath();c.moveTo(it.x,it.y);c.lineTo(ST[it.st].x,ST[it.st].y);c.stroke();}c.restore();
  // 花火（今までの演出をそのまま）
  for(const it of items)if(it.src==='game'&&it.state==='during'&&it.ref.anim==='fireworks'&&dk>0.2&&H.fireworks)H.fireworks(c,it,t);
  const groups=M.cluster(items,(CFG.size&&CFG.size.cluster)||26);
  // 奥（上）から手前（下）へ
  groups.sort((a,b)=>a.y-b.y).forEach((g,gi)=>{const top=g.items[0],sel=SEL&&g.items.some(i=>i.key===SEL);
    const h=Bub.draw(c,Object.assign({},top,{count:g.items.length,sel}),{t,px,phase:gi*1.3});HITS.push({cx:h.cx,cy:h.cy,r:h.r,g});
    if(top.state==='during'&&(top.big||sel||g.items.length===1&&top.src!=='shop'))Bub.label(c,top.name+(g.items.length>1?` ほか${g.items.length-1}`:''),top.x,top.y+3,{rim:Bub.rimOf(top),minX:4,maxX:996});});
  return true;}

/* ---------- 押す ---------- */
function click(x,y){if(!V.ready)return false;let best=null,bd=1e9;for(const h of HITS){const d=Math.hypot(h.cx-x,h.cy-y);if(d<h.r+6&&d<bd){bd=d;best=h;}}
  if(!best)return false;const g=best.g;if(g.items.length>1)openList(g.items);else openCard(g.items[0]);return true;}

/* ---------- カード ---------- */
const CSS=`.evc-dim{position:fixed;inset:0;z-index:70;background:rgba(18,26,23,.42);backdrop-filter:blur(1.5px) saturate(.85);-webkit-backdrop-filter:blur(1.5px) saturate(.85);display:grid;place-items:center;padding:16px;animation:evcIn .18s ease-out}
.evc-dim[hidden]{display:none!important}
@keyframes evcIn{from{opacity:0}to{opacity:1}}@keyframes evcUp{from{transform:translateY(14px) scale(.98);opacity:0}to{transform:none;opacity:1}}
.evc{width:min(360px,100%);max-height:calc(100dvh - 32px);overflow:auto;background:var(--panel);color:var(--ink);border-radius:22px;box-shadow:0 24px 60px -12px rgba(0,0,0,.45),0 0 0 1px rgba(255,255,255,.06) inset;animation:evcUp .24s cubic-bezier(.2,.8,.2,1);position:relative;font-family:"Zen Kaku Gothic New",sans-serif}
.evc .pic{position:relative;aspect-ratio:16/10;background:#d9e2d6;overflow:hidden;border-radius:22px 22px 0 0}
.evc .pic img,.evc .pic canvas{width:100%;height:100%;object-fit:cover;display:block}
.evc .pic::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,0) 55%,rgba(0,0,0,.28))}
.evc .pic .src{position:absolute;right:10px;bottom:8px;z-index:1;font-size:10.5px;color:#fff;opacity:.85;letter-spacing:.04em}
.evc .seal{position:absolute;left:14px;top:12px;z-index:1;background:#c8402c;color:#fff;border-radius:8px;padding:5px 7px 4px;font:400 12px/1.15 "Dela Gothic One",sans-serif;text-align:center;transform:rotate(-5deg);box-shadow:0 3px 8px rgba(0,0,0,.25);letter-spacing:.02em}
.evc .seal small{display:block;font:700 9px "Zen Kaku Gothic New",sans-serif;opacity:.9}
.evc .x{position:absolute;right:10px;top:10px;z-index:2;width:34px;height:34px;border-radius:50%;border:0;background:rgba(255,255,255,.88);color:#1c2826;font-size:18px;line-height:1;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.18)}
.evc .ico{position:absolute;left:16px;top:calc(min(360px,100vw - 32px) * .625 - 30px);z-index:2;width:56px;height:56px;border-radius:50%;background:#fff;display:grid;place-items:center;border:3px solid var(--rim);box-shadow:0 6px 16px rgba(0,0,0,.22)}
.evc .ico img{width:34px;height:34px}.evc .ico.gold{background:linear-gradient(#c9a35c,#b08640);box-shadow:0 0 0 2px #fff inset,0 6px 16px rgba(0,0,0,.22);color:#fff;font:700 20px "Zen Kaku Gothic New",sans-serif}
.evc .perf{height:0;border-top:2px dashed var(--line2);margin:0 18px;position:relative}
.evc .body{padding:30px 18px 6px}
.evc .kind{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:700;color:var(--rim);letter-spacing:.06em}
.evc .kind i{width:8px;height:8px;border-radius:50%;background:var(--rim)}
.evc h3{margin:4px 0 2px;font:700 21px/1.4 "Zen Kaku Gothic New",sans-serif;letter-spacing:.03em}
.evc .desc{margin:6px 0 10px;font-size:13px;line-height:1.7;color:var(--muted)}
.evc dl{display:grid;grid-template-columns:auto 1fr;gap:7px 12px;margin:10px 0 14px;font-size:13.5px;align-items:center}
.evc dt{font-size:11px;color:var(--muted);letter-spacing:.08em}
.evc dd{margin:0;font-weight:700}
.evc .stn{display:inline-block;background:#3d7f63;color:#fff;border-radius:5px;padding:1px 8px;font-size:12.5px;box-shadow:0 0 0 1px #fff inset}
.evc .evp{display:inline-block;margin-left:6px;font-size:11px;padding:1px 8px;border-radius:99px;background:var(--line);color:var(--ink);font-weight:700;vertical-align:1px}
.evc .evp.during{background:var(--rim);color:#fff}
.evc .fx{display:flex;flex-wrap:wrap;gap:5px}.evc .fx span{font-size:12px;font-weight:700;background:color-mix(in srgb,var(--rim) 14%,transparent);border:1px solid color-mix(in srgb,var(--rim) 40%,transparent);border-radius:99px;padding:2px 9px}
.evc .note{font-size:11px;color:var(--muted);margin:-6px 0 12px}
.evc .acts{display:flex;gap:8px;padding:0 18px 18px;flex-wrap:wrap}
.evc .acts button{flex:1 1 130px;min-height:44px;border-radius:14px;border:1px solid var(--line2);background:var(--paper);color:var(--ink);font:700 13.5px "Zen Kaku Gothic New",sans-serif;cursor:pointer}
.evc .acts button.main{background:var(--ink);color:var(--panel);border-color:var(--ink)}
.evc .list{padding:16px 14px 14px}.evc .list h3{font-size:17px;margin:2px 4px 10px}
.evc .row{display:flex;align-items:center;gap:10px;width:100%;text-align:left;border:0;background:transparent;color:var(--ink);border-radius:14px;padding:8px;cursor:pointer;font:inherit}
.evc .row:hover{background:var(--paper)}.evc .row .ico{position:static;width:40px;height:40px;border-width:2px;flex:0 0 auto;box-shadow:none}.evc .row .ico img{width:24px;height:24px}.evc .row .ico.gold{font-size:15px}
.evc .row b{display:block;font-size:14px}.evc .row small{color:var(--muted);font-size:12px}
@media (max-width:560px){.evc-dim{place-items:end center;padding:0}.evc{width:100%;border-radius:22px 22px 0 0;max-height:88dvh;padding-bottom:env(safe-area-inset-bottom,0px)}.evc .ico{top:calc(100vw * .625 - 30px)}}
@media (prefers-reduced-motion:reduce){.evc-dim,.evc{animation:none}}`;
let BOX=null;
function box(){if(BOX)return BOX;const s=document.createElement('style');s.textContent=CSS;document.head.appendChild(s);
  BOX=document.createElement('div');BOX.className='evc-dim';BOX.hidden=true;BOX.setAttribute('role','dialog');BOX.setAttribute('aria-modal','true');document.body.appendChild(BOX);
  BOX.addEventListener('click',e=>{if(e.target===BOX)close();});addEventListener('keydown',e=>{if(e.key==='Escape'&&!BOX.hidden)close();});return BOX;}
function close(){if(BOX)BOX.hidden=true;SEL=null;if(H&&H.redraw)H.redraw();}
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const ST_NAME={before:'これから',during:'ひらいています',after:'おわりました'};
function iconHtml(it){const rim=Bub.rimOf(it);if(it.icon&&it.icon.t)return `<div class="ico gold" style="--rim:${rim}">${esc(it.icon.t)}</div>`;
  return `<div class="ico" style="--rim:${rim}"><img alt="" src="${esc((CFG.emojiDir||'')+M.fileOf(it.icon.e))}"></div>`;}
function kindName(it){const k=Bub.kind(it.kind);return it.src==='shop'?'売店':it.src==='wx'?'きょうの天気':k?k.name:'イベント';}
// 画像がないときは、地図のその場所を切り取る
function mapCrop(it){const src=H.canvas(),cv=document.createElement('canvas');cv.width=640;cv.height=400;const g=cv.getContext('2d');
  const k=src.width/1000,w=220,h=137.5,x0=Math.max(0,Math.min(1000-w,it.x-w/2)),y0=Math.max(0,Math.min(420-h,it.y-h*0.62));
  try{g.drawImage(src,x0*k,y0*k,w*k,h*k,0,0,640,400);}catch(e){}
  const v=g.createRadialGradient(320,200,120,320,200,420);v.addColorStop(0,'rgba(255,250,235,0)');v.addColorStop(1,'rgba(40,40,30,.28)');g.fillStyle=v;g.fillRect(0,0,640,400);return cv;}
function openCard(it){const b=box();SEL=it.key;const rim=Bub.rimOf(it),ymd=G(()=>H.ymd(),''),fx=M.fxText(it.fx,GEN,CFG.ride);
  const tm=it.src==='wx'?'一日じゅう':`${M.hm(it.a)}〜${M.hm(it.b)}`,stn=it.st&&H.ST()[it.st]?`<span class="stn">${esc(H.ST()[it.st].name)}</span> 駅`:'沿線ぜんたい';
  let fxh='';if(it.src==='game'){const n=G(()=>H.extra(it.ref.id),null);fxh=`<dt>乗客</dt><dd>${n!=null?`約${n.toLocaleString()}人ふえる見込み`:'集計しています'}</dd>`;}
  else{if(fx.ride)fxh+=`<dt>乗客</dt><dd>${esc(fx.ride)}</dd>`;if(fx.goods)fxh+=`<dt>売れやすい品</dt><dd><div class="fx">${fx.goods.split('・').map(x=>`<span>${esc(x)}</span>`).join('')}</div></dd>`;}
  const [, mo, dd]=ymd.split('-');
  b.innerHTML=`<div class="evc" style="--rim:${rim}">
    <div class="pic">${it.img?`<img alt="" src="${esc(it.img)}">`:''}<span class="seal">${+mo||''}<small>月</small>${+dd||''}<small>日</small></span><span class="src">${it.img?'':'地図のこのあたり'}</span></div>
    <button class="x" type="button" aria-label="閉じる">×</button>${iconHtml(it)}
    <div class="body"><span class="kind"><i></i>${esc(kindName(it))}</span><h3>${esc(it.name)}</h3>${it.desc?`<p class="desc">${esc(it.desc)}</p>`:''}
    <dl><dt>場所</dt><dd>${stn}</dd><dt>時間</dt><dd>${tm}<span class="evp ${it.state}">${ST_NAME[it.state]}</span></dd>${fxh}</dl>
    ${it.src==='user'&&(fx.ride||fx.goods)?'<p class="note">効き目はいまは表示だけ（乗客・売店の計算にはまだつないでいません）</p>':''}</div>
    <div class="perf"></div><div style="height:14px"></div>
    <div class="acts">${it.src==='game'?'<button type="button" data-a="detail" class="main">人の流れを見る</button>':''}<button type="button" data-a="letters"${it.src!=='game'?' class="main"':''}>沿線だよりで読む</button><button type="button" data-a="kiosk">売店を見る</button>${it.src==='user'?'<button type="button" data-a="edit">お絵かき帖で直す</button>':''}</div></div>`;
  if(!it.img){const p=b.querySelector('.pic');p.insertBefore(mapCrop(it),p.firstChild);}
  b.querySelector('.x').onclick=close;
  b.querySelectorAll('[data-a]').forEach(x=>x.onclick=()=>{const a=x.dataset.a;close();
    if(a==='detail')H.select(it.ref.id);else if(a==='letters')H.letters();else if(a==='kiosk')H.kiosk(it.src==='shop'?it.ref.go:it.st==='P'?'minato':'home');else if(a==='edit')location.href='route-editor.html#event:'+it.ref.id;});
  b.hidden=false;H.redraw();setTimeout(()=>{try{b.querySelector('.x').focus({preventScroll:true});}catch(e){}},30);}
function openList(items){const b=box();SEL=items[0].key;
  b.innerHTML=`<div class="evc"><div class="list"><button class="x" type="button" aria-label="閉じる">×</button><h3>このあたりのできごと（${items.length}）</h3>
    ${items.map((it,i)=>`<button class="row" type="button" data-i="${i}">${iconHtml(it)}<span><b>${esc(it.name)}</b><small>${it.src==='wx'?'一日じゅう':M.hm(it.a)+'〜'+M.hm(it.b)}・${ST_NAME[it.state]}</small></span></button>`).join('')}</div></div>`;
  b.querySelector('.x').onclick=close;b.querySelectorAll('[data-i]').forEach(x=>x.onclick=()=>openCard(items[+x.dataset.i]));b.hidden=false;H.redraw();}

Object.assign(V,{init,draw,click,close,check,openCard});Object.defineProperties(V,{items:{get:()=>LAST},evs:{get:()=>EVS},hits:{get:()=>HITS}});window.EventMapView=V;
})();
