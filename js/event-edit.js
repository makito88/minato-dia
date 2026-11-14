/* =====================================================================
   お絵かき帖の「イベント」の層（配置メモ・第8回・2026-11-14）。route-editor.html の道具「イベント」（E）で使う。
   ・地図を押すと、選んでいる日にイベントを置く。引っぱると動く。近くの駅に自動で結びつく。
   ・シート：印（種類で分けた絵文字・言葉で探す・最近使ったもの・なければ金の文字1〜2文字）、ふちの色（種類で自動・自由に）、
     名前・日とくり返し（一度だけ・毎年・毎週）・時間・大きさ・画像・メモ・効き目（なくても置ける。いまは表示だけ）。
   ・地図の下の細い「暦の帯」で日をずらすと、その日の吹き出しだけ出る。一覧（種類・駅・月でしぼる）。
   ・保存：お絵かき帖の dia-routes の evs（{v:1, items:{id:…}, recent:[…]}）。元に戻す／やり直すは路線と同じ。
   ・ここに置くのはユーザーが決めたイベントだけ（季節のできごとは出さない）。計算は js/event-map-core.js、絵は js/event-bubble.js。
   ===================================================================== */
(function(){
'use strict';
const M=window.EventMapCore,Bub=window.EventBubble;
let H=null,CFG=null,GEN=[];
const E={day:M.todayYmd(Date.now()),sel:null,sheet:false,list:false,cat:'fes',q:'',goldTxt:'',lf:{kind:'',st:'',m:''},hits:[]};
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const DOW='日月火水木金土';

function init(h){H=h;Promise.all([fetch('data/event-map.json?v=20261114a').then(r=>r.ok?r.json():null).catch(()=>null),fetch('data/kiosk.json').then(r=>r.ok?r.json():null).catch(()=>null)]).then(([c,k])=>{
  if(!c)return;CFG=c;Bub.init(c);GEN=(k&&k.genres)||[];Bub.onload=()=>H.redraw();
  const m=/#event(?::(\w+))?/.exec(location.hash);if(m){const it=m[1]&&evs().items[m[1]];if(it){E.sel=m[1];if(it.date&&!M.occurs(it,E.day))E.day=it.date;E.sheet=true;}}
  H.ui();H.redraw();});}
// 保存の evs（なければ作る）
function evs(){const d=H.doc();if(!d.evs||!d.evs.items)d.evs=M.normalize(d.evs);return d.evs;}
const cur=()=>E.sel&&evs().items[E.sel];
const today=()=>M.forDay(evs(),E.day);

/* ---------- 描く（道具が「イベント」のとき） ---------- */
function draw(c,k){if(!CFG)return;const ST=H.stations(),px=k.z*k.dpr,list=today();E.hits=[];
  c.save();c.setLineDash([2,2.6]);c.lineWidth=0.9;list.forEach(it=>{const s=ST[it.st];if(!s)return;c.strokeStyle=Bub.rimOf(it);c.globalAlpha=0.55;c.beginPath();c.moveTo(it.x,it.y);c.lineTo(s.x,s.y);c.stroke();});c.restore();
  list.slice().sort((a,b)=>a.y-b.y).forEach(it=>{const h=Bub.draw(c,Object.assign({},it,{state:'during',sel:it.id===E.sel}),{t:0,px,still:true});E.hits.push({id:it.id,cx:h.cx,cy:h.cy,r:h.r,x:it.x,y:it.y});
    Bub.label(c,it.name,it.x,it.y+3,{rim:Bub.rimOf(it)});});
  // ほかの日のものは、うすい点で（どこに何があるかの目安）
  const on=new Set(list.map(i=>i.id));c.save();for(const [id,it] of Object.entries(evs().items)){if(on.has(id))continue;c.globalAlpha=0.35;c.fillStyle=Bub.rimOf(it);c.beginPath();c.arc(it.x,it.y,2.2,0,7);c.fill();}c.restore();}

/* ---------- 指・マウス（route-editor.js から呼ぶ） ---------- */
function hit(w,tol){let best=null,bd=1e9;for(const h of E.hits){const d=Math.min(Math.hypot(h.cx-w[0],h.cy-w[1])-h.r,Math.hypot(h.x-w[0],h.y-w[1])-2);if(d<tol*0.6&&d<bd){bd=d;best=h;}}return best;}
function down(w,tol){const h=hit(w,tol);if(!h)return null;const it=evs().items[h.id];return {id:h.id,dx:it.x-w[0],dy:it.y-w[1]};}
function move(o,w){const it=evs().items[o.id];if(!it)return;it.x=+(w[0]+o.dx).toFixed(1);it.y=+(w[1]+o.dy).toFixed(1);it.st=M.nearest(H.stations(),it.x,it.y);o.moved=true;}
function up(o,w,moved){if(moved&&o.moved){E.sel=o.id;H.commit();return;}E.sel=o.id;E.sheet=true;E.list=false;H.ui();H.redraw();}
function tapEmpty(w){if(!CFG)return;if(E.sheet&&E.sel){E.sel=null;E.sheet=false;H.ui();H.redraw();return;}   // シートを開いているときは、まず閉じる
  const v=evs(),id=M.uid(v.items),e=(v.recent&&v.recent[0])||'🎉',st=M.nearest(H.stations(),w[0],w[1]);
  v.items[id]=M.normItem({name:'新しいイベント',kind:M.kindOfEmoji(CFG.catalog,e),icon:{e},x:w[0],y:w[1],st,date:E.day,rep:'once',start:'10:00',end:'16:00'});
  E.sel=id;E.sheet=true;E.list=false;H.commit();H.toast('置きました。印と名前を選んでください（引っぱると動きます）');}
function del(){const v=evs();if(E.sel&&v.items[E.sel]){delete v.items[E.sel];E.sel=null;E.sheet=false;H.commit();H.toast('イベントを消しました（「元に戻す」で戻せます）');}}
function cancel(){}
function fixSel(){if(E.sel&&!evs().items[E.sel]){E.sel=null;E.sheet=false;}}

/* ---------- 下の棚：暦の帯 ---------- */
function dock(d,el,chip){if(!CFG){d.appendChild(el('div','row','<span class="hint">設定を読んでいます…</span>'));return;}
  const r=el('div','row evstrip');const days=M.strip(evs(),E.day,10,10);
  const nav=(t,dd)=>{const b=el('button','evnav',t);b.onclick=()=>{E.day=M.ymdOf(M.indexOf(E.day)+dd);H.ui();H.redraw();};return b;};
  r.appendChild(nav('‹',-7));
  let lastM=null;days.forEach(x=>{if(x.m!==lastM){r.appendChild(el('span','evmon',x.m+'月'));lastM=x.m;}
    const b=el('button','evday'+(x.ymd===E.day?' on':'')+(x.dow===0?' sun':x.dow===6?' sat':'')+(x.ymd===M.todayYmd(Date.now())?' now':''),`<small>${DOW[x.dow]}</small><b>${x.d}</b>${x.n?`<i>${x.n>1?x.n:''}</i>`:''}`);
    b.title=x.ymd;b.onclick=()=>{E.day=x.ymd;E.sel=null;E.sheet=false;H.ui();H.redraw();};r.appendChild(b);});
  r.appendChild(nav('›',7));d.appendChild(r);
  requestAnimationFrame(()=>{const on=r.querySelector('.evday.on');if(on)r.scrollLeft=on.offsetLeft-r.clientWidth/2+on.offsetWidth/2;});
  const r2=el('div','row');const n=today().length,[y,m,dd]=E.day.split('-');
  r2.appendChild(el('span','lab',`${+m}月${+dd}日（${DOW[M.dowOf(E.day)]}）`));
  r2.appendChild(el('span','hint',n?`この日の吹き出し ${n}`:'地図を押すと、この日にイベントを置けます'));
  const t=chip('きょう',false,()=>{E.day=M.todayYmd(Date.now());H.ui();H.redraw();});t.classList.add('mini');r2.appendChild(t);
  const L=chip('一覧（'+Object.keys(evs().items).length+'）',E.list,()=>{E.list=!E.list;E.sheet=false;H.ui();});L.classList.add('mini');r2.appendChild(L);
  d.appendChild(r2);
  sheet();}

/* ---------- シート（右・スマホは下） ---------- */
function panel(){let p=$('evsheet');if(!p){p=document.createElement('section');p.id='evsheet';p.className='glass';p.hidden=true;document.body.appendChild(p);}return p;}
function hide(){const p=$('evsheet');if(p)p.hidden=true;}
function sheet(){const p=panel();if(E.list){listView(p);return;}const it=cur();if(!E.sheet||!it){p.hidden=true;return;}p.hidden=false;
  const scroll=p.querySelector('.evs-in')?p.querySelector('.evs-in').scrollTop:0;p.innerHTML='';
  const el=(t,c,h)=>{const e=document.createElement(t);if(c)e.className=c;if(h!=null)e.innerHTML=h;return e;};
  const set=(f,live)=>{f(it);if(live){H.redraw();prev();}else{H.commit();}};
  const hd=el('div','evs-hd');const pv=el('canvas','evs-pv');hd.appendChild(pv);
  const nm=el('input','namein');nm.value=it.name;nm.placeholder='名前（例：川辺の灯ろう流し）';nm.maxLength=40;nm.oninput=()=>set(x=>x.name=nm.value,true);nm.onchange=()=>H.commit();hd.appendChild(nm);
  const x=el('button','ib','<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>');x.title='閉じる';x.onclick=()=>{E.sheet=false;E.sel=null;H.ui();H.redraw();};hd.appendChild(x);p.appendChild(hd);
  const body=el('div','evs-in');p.appendChild(body);
  const sec=(t,extra)=>{const s=el('div','evs-sec');s.appendChild(el('div','evs-t',t+(extra?`<small>${extra}</small>`:'')));body.appendChild(s);return s;};
  const ST=H.stations(),stn=ST[it.st];
  body.appendChild(el('div','evs-at',`<span class="stn">${esc(stn?stn.name:'—')}</span> 駅の近く <small>（引っぱって動かすと、近くの駅が自動で変わります）</small>`));
  // 印
  const s1=sec('印','絵文字から選ぶ・なければ金の文字');
  const sr=el('input','evs-q');sr.type='search';sr.placeholder='言葉で探す（例：花火・祭り・雨）';sr.value=E.q;sr.oninput=()=>{E.q=sr.value;grid();};s1.appendChild(sr);
  const tabs=el('div','row evs-tabs');const rec=(evs().recent||[]).length;
  if(rec)tabs.appendChild(tab('recent','最近'));CFG.catalog.forEach(c=>tabs.appendChild(tab(c.id,c.name)));tabs.appendChild(tab('gold','金の文字'));s1.appendChild(tabs);
  function tab(id,n){const b=el('button','chip mini'+(E.cat===id?' on':''),n);b.onclick=()=>{E.cat=id;E.q='';sr.value='';tabs.querySelectorAll('.chip').forEach(z=>z.classList.toggle('on',z===b));grid();};return b;}
  const gd=el('div','evs-grid');s1.appendChild(gd);
  function pick(e){evs().recent=M.pushRecent(evs().recent,e);set(z=>{z.icon={e};if(!z.rim)z.kind=M.kindOfEmoji(CFG.catalog,e);});}
  function grid(){gd.innerHTML='';gd.classList.toggle('gold',E.cat==='gold'&&!E.q);
    if(E.cat==='gold'&&!E.q){const g=el('div','evs-gold');const i=el('input','namein');i.maxLength=2;i.placeholder='1〜2文字';i.value=it.icon.t||E.goldTxt;i.oninput=()=>{E.goldTxt=i.value;};
      const ok=el('button','chip','金の文字にする');ok.onclick=()=>{const t=Array.from(i.value.trim()).slice(0,2).join('');if(!t){H.toast('1〜2文字を書いてください');return;}set(z=>z.icon={t});};
      g.appendChild(i);g.appendChild(ok);g.appendChild(el('span','hint','合う絵文字がないときに。ゲームの仕掛けの金の印と見分けられるよう、外側に種類の色のふちが付きます'));gd.appendChild(g);return;}
    let L=[];if(E.q)L=M.search(CFG.catalog,E.q).map(o=>o.e);else if(E.cat==='recent')L=evs().recent||[];else{const c=CFG.catalog.find(z=>z.id===E.cat);L=c?c.items.map(z=>z[0]):[];}
    if(!L.length){gd.appendChild(el('span','hint',E.q?'見つかりませんでした。「金の文字」で1〜2文字にもできます':'まだありません'));return;}
    L.forEach(e=>{const b=el('button','evs-e'+(it.icon.e===e?' on':''));const im=el('img');im.alt=e;im.loading='lazy';im.src=(CFG.emojiDir||'')+M.fileOf(e);b.appendChild(im);b.title=(M.search(CFG.catalog,e)[0]||{}).w||e;b.onclick=()=>pick(e);gd.appendChild(b);});}
  grid();
  // 種類とふちの色
  const s2=sec('種類とふちの色',it.rim?'自由な色':'種類で自動');const kr=el('div','row wrap');
  CFG.kinds.filter(k=>!k.game).forEach(k=>{const b=el('button','chip mini'+(it.kind===k.id?' on':''),`<i class="evdot" style="background:${k.rim}"></i>${esc(k.name)}`);b.onclick=()=>set(z=>z.kind=k.id);kr.appendChild(b);});s2.appendChild(kr);
  const cr=el('div','row');const au=el('button','chip mini'+(!it.rim?' on':''),'種類の色');au.onclick=()=>set(z=>z.rim='');cr.appendChild(au);
  const lb=el('label','evs-col');const ci=el('input');ci.type='color';ci.value=Bub.rimOf(it);ci.oninput=()=>set(z=>z.rim=ci.value,true);ci.onchange=()=>H.commit();lb.appendChild(ci);lb.appendChild(document.createTextNode('自由な色'));cr.appendChild(lb);
  const bg=el('div','seg');[['ふつう',false],['大きめ',true]].forEach(([n,v])=>{const b=el('button',!!it.big===v?'on':'',n);b.onclick=()=>set(z=>z.big=v);bg.appendChild(b);});cr.appendChild(bg);s2.appendChild(cr);
  // 日と時間
  const s3=sec('日と時間');const g3=el('div','grid2');
  g3.innerHTML=`<span>日</span><input type="date" class="evd" value="${esc(it.date)}"><span>くり返し</span><span class="seg evr"></span><span>時間</span><span class="evt"><input type="time" class="eva" value="${esc(it.start)}"> 〜 <input type="time" class="evb" value="${esc(it.end)}"></span>`;s3.appendChild(g3);
  const rp=g3.querySelector('.evr');[['once','一度だけ'],['year','毎年'],['week','毎週']].forEach(([v,n])=>{const b=el('button',it.rep===v?'on':'',n);b.onclick=()=>set(z=>z.rep=v);rp.appendChild(b);});
  g3.querySelector('.evd').onchange=e=>{const v=e.target.value;if(!v)return;set(z=>z.date=v);E.day=v;H.ui();};
  g3.querySelector('.eva').onchange=e=>set(z=>z.start=e.target.value||'10:00');g3.querySelector('.evb').onchange=e=>set(z=>z.end=e.target.value||'16:00');
  s3.appendChild(el('div','hint',it.rep==='year'?`毎年 ${+it.date.slice(5,7)}月${+it.date.slice(8)}日に出ます`:it.rep==='week'?`毎週 ${DOW[M.dowOf(it.date)]}曜日に出ます（${it.date}から）`:'この日だけ出ます'));
  // 画像
  const s4=sec('画像','なくてもよい・なければ地図のその場所');const ir=el('div','row evs-img');
  if(it.img){const im=el('img');im.src=it.img;ir.appendChild(im);const rm=el('button','chip mini danger','外す');rm.onclick=()=>set(z=>z.img='');ir.appendChild(rm);}
  const pk=el('button','chip mini',it.img?'ほかの画像':'絵や写真をえらぶ');pk.onclick=()=>file().click();ir.appendChild(pk);s4.appendChild(ir);
  // メモ
  const s5=sec('メモ');const ta=el('textarea','evs-memo');ta.rows=2;ta.maxLength=400;ta.placeholder='カードに出る説明（なくてもよい）';ta.value=it.memo;ta.oninput=()=>{it.memo=ta.value;};ta.onchange=()=>H.commit();s5.appendChild(ta);
  // 効き目
  const s6=sec('効き目','なくても置ける・いまは表示だけ');const rr=el('div','row');rr.appendChild(el('span','lab','乗客'));const rs=el('div','seg');
  (CFG.ride||[]).forEach(([v,n])=>{const b=el('button',it.fx.ride===v?'on':'',n);b.onclick=()=>set(z=>z.fx.ride=v);rs.appendChild(b);});rr.appendChild(rs);s6.appendChild(rr);
  const gr=el('div','row wrap');gr.appendChild(el('span','lab','売店で売れやすい品'));GEN.forEach(g=>{const on=it.fx.goods.includes(g.id);const b=el('button','chip mini'+(on?' on':''),esc(g.name));
    b.onclick=()=>set(z=>{z.fx.goods=on?z.fx.goods.filter(q=>q!==g.id):z.fx.goods.concat(g.id).slice(0,6);});gr.appendChild(b);});s6.appendChild(gr);
  const ft=el('div','row evs-foot');const dl=el('button','chip mini danger','このイベントを消す');dl.onclick=del;ft.appendChild(dl);
  const cp=el('button','chip mini','写しを置く');cp.onclick=()=>{const v=evs(),id=M.uid(v.items);v.items[id]=M.normItem(Object.assign({},it,{x:it.x+14,y:it.y+6,name:it.name+'（写し）'}));E.sel=id;H.commit();};ft.appendChild(cp);body.appendChild(ft);
  body.scrollTop=scroll;
  function prev(){const d=Math.min(2,devicePixelRatio||1);pv.width=56*d;pv.height=56*d;const c=pv.getContext('2d');c.setTransform(d*1.45,0,0,d*1.45,0,0);Bub.draw(c,Object.assign({},it,{x:19.3,y:35,state:'during'}),{t:0,px:d*1.45,still:true});}
  prev();}
function listView(p){p.hidden=false;p.innerHTML='';const el=(t,c,h)=>{const e=document.createElement(t);if(c)e.className=c;if(h!=null)e.innerHTML=h;return e;};
  const hd=el('div','evs-hd');hd.appendChild(el('b','evs-ttl','イベントの一覧'));const x=el('button','ib','<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>');x.onclick=()=>{E.list=false;H.ui();};hd.appendChild(x);p.appendChild(hd);
  const body=el('div','evs-in');p.appendChild(body);const ST=H.stations(),F=E.lf;
  const fr=el('div','evs-filter');const sel=(key,opts)=>{const s=el('select');s.innerHTML=opts.map(([v,n])=>`<option value="${esc(v)}"${F[key]===v?' selected':''}>${esc(n)}</option>`).join('');s.onchange=()=>{F[key]=s.value;listView(p);};fr.appendChild(s);};
  sel('kind',[['','種類：すべて']].concat(CFG.kinds.filter(k=>!k.game).map(k=>[k.id,k.name])));
  sel('st',[['','駅：すべて']].concat(Object.entries(ST).map(([k,s])=>[k,s.name])));
  sel('m',[['','月：すべて']].concat(Array.from({length:12},(_,i)=>[String(i+1),(i+1)+'月'])));body.appendChild(fr);
  const all=Object.entries(evs().items).map(([id,it])=>Object.assign({id},it)).filter(it=>(!F.kind||it.kind===F.kind)&&(!F.st||it.st===F.st)&&(!F.m||it.rep==='week'||+it.date.slice(5,7)===+F.m))
    .sort((a,b)=>(a.date.slice(5)+a.start).localeCompare(b.date.slice(5)+b.start));
  if(!all.length)body.appendChild(el('div','hint',Object.keys(evs().items).length?'条件に合うイベントはありません':'まだありません。暦の帯で日を選んで、地図を押すと置けます。'));
  all.forEach(it=>{const b=el('button','evs-row');const ic=el('span','evs-ri');ic.style.setProperty('--rim',Bub.rimOf(it));
    if(it.icon.t){ic.classList.add('gold');ic.textContent=it.icon.t;}else{const im=el('img');im.src=(CFG.emojiDir||'')+M.fileOf(it.icon.e);im.alt='';ic.appendChild(im);}b.appendChild(ic);
    const rp=it.rep==='year'?'毎年 ':it.rep==='week'?'毎週'+DOW[M.dowOf(it.date)]+' ':'';
    b.appendChild(el('span','evs-rt',`<b>${esc(it.name)}</b><small>${rp}${+it.date.slice(5,7)}/${+it.date.slice(8)}・${esc(it.start)}〜${esc(it.end)}・${esc(ST[it.st]?ST[it.st].name:'')}</small>`));
    b.onclick=()=>{if(!M.occurs(it,E.day))E.day=it.date;E.sel=it.id;E.sheet=true;E.list=false;H.ui();H.redraw();H.focus(it.x,it.y);};body.appendChild(b);});}
// 画像：小さくしてから保存（引き継ぎコードに入るので、横 480 までの JPEG）
let FI=null;function file(){if(FI)return FI;FI=document.createElement('input');FI.type='file';FI.accept='image/*';FI.hidden=true;document.body.appendChild(FI);
  FI.onchange=e=>{const f=e.target.files[0];e.target.value='';const it=cur();if(!f||!it)return;const url=URL.createObjectURL(f),im=new Image();
    im.onload=()=>{const W=480,Hh=300,s=Math.max(W/im.naturalWidth,Hh/im.naturalHeight),cv=document.createElement('canvas');cv.width=W;cv.height=Hh;const g=cv.getContext('2d');
      const w=im.naturalWidth*s,h=im.naturalHeight*s;g.drawImage(im,(W-w)/2,(Hh-h)/2,w,h);URL.revokeObjectURL(url);const d=cv.toDataURL('image/jpeg',0.72);
      if(d.length>90000){H.toast('画像が大きすぎました');return;}it.img=d;H.commit();H.toast('画像を付けました（小さくして保存しています）');};
    im.onerror=()=>{URL.revokeObjectURL(url);H.toast('この画像は読めませんでした');};im.src=url;};return FI;}

window.EventEdit={init,draw,down,move,up,tapEmpty,del,cancel,dock,hide,fixSel,E};
})();
