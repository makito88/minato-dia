/* =====================================================================
   トップページ：6つのレイヤー（世界・日本・沿線・店舗・従業員・工場）から入る
   ・開いたときに表示する（「次から表示しない」で、開いたときは出さない）。上の帯の「トップ」でいつでも戻れる。
   ・各レイヤーのボタンは、いまある画面（路線図とダイヤ・沿線だより・駅ナカ リサーチ・売店・店員・街のカルテ・おにぎり工場の米・パン・サンドイッチのライン）へつなぐだけ。
     まだ作っていない部分は「準備中」と書く。
   ・絵は、このゲームの絵（沿線の水彩マップ・売店）と、ここで描いたイメージ（世界・日本・従業員）。実在の地図や写真は使わない。
   ===================================================================== */
(function(){
'use strict';
const KEY='dia-top-skip',$=id=>document.getElementById(id),g=(f,d)=>{try{return f();}catch(e){return d;}};
const KARTE='docs/machi-karte.html';
const COUNTRY='澪洲国';   // 仮の島国の名前（決まったらここを変える）
const openKarte=h=>{window.open(KARTE+(h?'#'+h:''),'_blank','noopener');};

/* ---- イメージの絵（架空・説明用） ---- */
const SVG_WORLD=`<svg viewBox="0 0 400 220" role="img" aria-label="世界のイメージ：港浜の港から海の道が世界へ"><rect width="400" height="220" fill="#cfe3ec"/>
  <g fill="#e9dfc8" stroke="#b9a989" stroke-width="1.5"><path d="M30 60 C60 30 120 35 140 60 C150 85 120 110 95 120 C70 135 40 120 30 95 Z"/><path d="M160 40 C200 20 260 30 270 55 C280 80 250 95 215 90 C190 88 165 75 160 40 Z"/>
  <path d="M190 110 C215 100 240 115 238 145 C236 175 210 195 195 175 C182 158 178 125 190 110 Z"/><path d="M285 70 C320 55 370 70 375 100 C378 130 340 140 310 130 C290 122 278 95 285 70 Z"/><path d="M320 160 C340 150 365 160 360 180 C355 198 330 198 320 185 Z"/></g>
  <g fill="none" stroke-width="2.5" stroke-linecap="round"><path d="M352 92 C300 40 230 30 205 45" stroke="#c23b3b" stroke-dasharray="6 5"/><path d="M352 92 C330 140 280 170 235 150" stroke="#c98a54" stroke-dasharray="6 5"/><path d="M352 92 C250 120 150 140 110 100" stroke="#5d6f86" stroke-dasharray="6 5"/></g>
  <circle cx="352" cy="92" r="7" fill="#c23b3b" stroke="#fff" stroke-width="2"/><text x="340" y="80" font-size="13" text-anchor="end" fill="#3b2f25" font-weight="700">港浜</text>
  <circle cx="205" cy="45" r="5" fill="#fff" stroke="#3b2f25" stroke-width="2"/><text x="205" y="32" font-size="11" text-anchor="middle" fill="#3b2f25">姉妹港</text>
  <text x="8" y="212" font-size="10" fill="#6b7d88">イメージ（架空の世界の地図ではありません）</text></svg>`;
const SVG_JAPAN=`<svg viewBox="0 0 400 220" role="img" aria-label="国のイメージ：港と鉄道と物流"><rect width="400" height="220" fill="#dcebf0"/>
  <g fill="#efe6d2" stroke="#b9a989" stroke-width="1.5"><path d="M70 170 C90 140 130 130 170 120 C210 110 240 90 270 70 C295 55 320 40 345 30 C352 45 340 62 320 75 C290 95 260 115 225 132 C190 150 150 165 115 185 C95 196 70 190 70 170 Z"/><path d="M40 190 C55 182 70 190 62 202 C52 210 36 204 40 190 Z"/></g>
  <path d="M85 172 C130 150 180 135 220 120 C260 100 300 72 335 40" fill="none" stroke="#3b2f25" stroke-width="4"/><path d="M85 172 C130 150 180 135 220 120 C260 100 300 72 335 40" fill="none" stroke="#efe6d2" stroke-width="1.5" stroke-dasharray="8 6"/>
  <g fill="#fff" stroke="#3b2f25" stroke-width="2"><circle cx="120" cy="156" r="4"/><circle cx="300" cy="66" r="4"/></g>
  <circle cx="200" cy="128" r="9" fill="#c23b3b" stroke="#fff" stroke-width="2"/><text x="200" y="152" font-size="12" text-anchor="middle" fill="#3b2f25" font-weight="700">みなと川沿線</text>
  <g fill="#5d6f86"><path d="M150 186 l10 0 l4 -6 l-18 0z"/><path d="M262 120 l10 0 l4 -6 l-18 0z"/></g>
  <path d="M160 180 C175 192 200 194 230 188" fill="none" stroke="#5d6f86" stroke-width="1.5" stroke-dasharray="3 4"/>
  <text x="8" y="212" font-size="10" fill="#6b7d88">イメージ（実在の地図ではありません）</text></svg>`;
const SVG_CREW=`<svg viewBox="0 0 400 220" role="img" aria-label="従業員のイメージ：シフト表と店員"><rect width="400" height="220" fill="#f3ead7"/>
  <g font-size="11" fill="#5d5045"><text x="96" y="30">朝</text><text x="156" y="30">昼</text><text x="216" y="30">夕方</text><text x="282" y="30">夜</text></g>
  <g>${[['浜野',[1,1,0,0]],['水沢',[0,1,1,0]],['千早',[0,0,1,1]],['柳田',[1,0,0,1]]].map(([n,a],i)=>`<text x="20" y="${58+i*34}" font-size="13" fill="#3b2f25">${n}</text>${a.map((v,k)=>`<rect x="${80+k*62}" y="${42+i*34}" width="54" height="24" rx="5" fill="${v?'#2f8a6e':'none'}" stroke="${v?'#2f8a6e':'#c9bba3'}" stroke-dasharray="${v?'':'4 3'}"/>`).join('')}`).join('')}</g>
  <g transform="translate(345 120)"><circle r="16" fill="#f0c9a0"/><path d="M-16 -4 a16 16 0 0 1 32 0z" fill="#24345a"/><rect x="-18" y="14" width="36" height="44" rx="6" fill="#24345a"/><rect x="-6" y="16" width="12" height="40" fill="#fff"/></g>
  <text x="300" y="200" font-size="12" fill="#3b2f25">時給 ¥1,250〜</text></svg>`;

// 項目の3つ目が 'lab' のものは「見るだけ・試作」。カードには出さず、下の「研究室」の引き出しにまとめる（2026-11-09）
const L=[
 {id:'world',name:'世界',sub:'国際貿易・資源・金融・人口移動',img:'docs/img/map-world.jpg',art:SVG_WORLD,state:'一部',
  pins:[{x:44,y:31,t:COUNTRY,main:1},{x:8.4,y:19.5,t:'姉妹港'},{x:71.6,y:31,t:'北米西岸'},{x:32.5,y:48.5,t:'東南アジア'}],
  items:[['港の荷主をのぞく（海外とのお金の流れ）','karte:port','lab'],['姉妹港ヴェステルハーフェンの歩み','karte:history','lab']],soon:'資源の値段や為替が、売店まで届く道すじ（因果カード）'},
 {id:'japan',name:COUNTRY,sub:'日本にあたる架空の島国（名前は仮）・産業・港湾・鉄道・物流',img:'docs/img/map-country.jpg',art:SVG_JAPAN,state:'一部',
  pins:[{x:59.5,y:44,t:'みなと川沿線',main:1}],   // 沿線は全長30km余り。国の地図では1点になるので、印は1つだけ
  items:[['沿線の歩み 1885〜2026（日本の地方鉄道に似せた歴史）','karte:history','lab'],['国・県と町のお金の流れ（交付税など）','karte:money','lab']],soon:'国内の物流と産業の地図'},
 {id:'line',name:'沿線',sub:'人口・土地利用・駅・商業施設',img:'docs/img/route-map-painted.jpg',state:'遊べる',
  items:[['路線図とダイヤ（列車を走らせる）','play'],['沿線だより','tayori'],['駅ナカ リサーチ','research'],['街のカルテ（駅・市町村・名所・歴史）','karte:station','lab'],['路線を描く（バス・配送・船・空のお絵かき帖）','page:route-editor.html','lab'],['沿線くらしアンケート（駅ごとの暮らしのうつりかわり）','page:survey.html','lab']]},
 {id:'shop',name:'店舗',sub:'商品・在庫・売上・客の行動',img:'docs/img/top-kiosk.jpg',state:'遊べる',
  items:[['売店を運営する','kiosk:log'],['商品・値段・仕入れ','kiosk:items'],['客層・客単価・買ったきっかけ','kiosk:people'],['収支と万引きの疑い','kiosk:money'],['センターの倉庫（在庫・問屋への発注・足りなくなるおそれ）','center'],['配送会社（トラックの1日・自社便と他社便）','haiso'],['お金の流れ（4つの会社の入り・出・もうけ）','money'],['荷物の行方（注文した品はいまどこ・何時に並ぶ）','kiosk:track','lab']]},
 {id:'factory',name:'工場',sub:'おにぎり・パン・サンドイッチ・ドーナッツ・お弁当の一晩（港浜工場）',img:'docs/img/factory-line.jpg',state:'遊べる',note:'AIで描いたイメージです（架空の工場）。',
  items:[['おにぎり（米のライン・機械2本）','factory:rice'],['パン（発酵の時計・オーブン）','factory:bread'],['サンドイッチ（機械のライン・自社の食パン）','factory:sand'],['ドーナッツ（油の時計・仕上げ）','factory:donut'],['お弁当（急速冷却・チルド）','factory:bento'],['原材料（何が・いつ・どれくらい届いたか・ロットのたどり）','factory:material']]},
 {id:'crew',name:'従業員',sub:'シフト・時給・やる気・暮らし',art:SVG_CREW,state:'遊べる',
  items:[['店員・シフト・時給','kiosk:crew'],['店員の1か月の暮らしとお金の流れ','karte:clerk','lab']]}];

/* ---- きょうの沿線（2026-11-09）：島を並べて、それぞれの「きのうまでに確定した数字」を1枚に ----
   重い計算はしない。保存（dia-kiosk・dia-orders・dia-wxlog）と、橋の一覧（data/links.json）を読むだけ。
   アンケートの目立つ変化だけは、開いたあと手の空いたときに1回計算して覚えておく（同じ年なら作り直さない） */
const T={links:null,survey:null,sv:null,svKey:null,loading:false};
const J=k=>g(()=>JSON.parse(localStorage.getItem(k)||'null'),null);
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const yen=n=>(n<0?'−':'')+'¥'+Math.abs(Math.round(n)).toLocaleString();
const opNoon=()=>{const DAY=864e5,JS=9*36e5,S0=270*6e4;return new Date(Math.floor((Date.now()+JS-S0)/DAY)*DAY+S0-JS+12*36e5);};
const jfmt=(d,o)=>new Intl.DateTimeFormat('ja-JP',Object.assign({timeZone:'Asia/Tokyo'},o)).format(d);
const SRC={real:['現','現実から取り入れた数字'],assume:['仮','仮に決めた数字'],game:['内','ゲームの中で生まれた結果']};
const mark=k=>SRC[k]?`<i class="sm sm-${k}" title="${SRC[k][1]}">${SRC[k][0]}</i>`:'';
const stN=id=>g(()=>ST[id].name,id);
const coN=id=>g(()=>T.co.companies.find(x=>x.id===id).name,'');
function loadToday(){if(T.loading||T.links)return;T.loading=true;
  const j=u=>fetch(u).then(r=>r.ok?r.json():null).catch(()=>null);
  Promise.all([j('data/links.json?v=20261110g'),window.SurveyCore?j('data/survey.json'):null,j('data/companies.json?v=20261109g')]).then(([l,s,co])=>{T.links=l;T.survey=s;T.co=co;T.loading=false;
    const later=window.requestIdleCallback||(f=>setTimeout(f,200));later(()=>{svChange();paintToday();});paintToday();});}
// アンケートのいちばん新しい年と前の年で、いちばん大きく動いた駅・質問
function svChange(){const D=T.survey,SC=window.SurveyCore;if(!D||!SC)return null;const ys=SC.years(D,opNoon());if(ys.length<2)return null;const y=ys[ys.length-1];
  if(T.svKey===y)return T.sv;let best=null;
  for(const q of D.questions){if(q.kind!=='rate')continue;for(const id in D.areas){const a=SC.wave(D,q,id,y).pct[0],b=SC.wave(D,q,id,y-1).pct[0],d=a-b;if(!best||Math.abs(d)>Math.abs(best.d))best={q:q.title,qid:q.id,id,a,b,d,y};}}
  T.sv=best;T.svKey=y;return best;}
function todayHtml(){const day=g(()=>ENS.day,null),c=g(()=>COND,{}),d=opNoon(),ymd=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo'}).format(d);
  const WX={sun:['晴れ','☀'],cld:['くもり','☁'],rain:['雨','☂'],snow:['大雪','❄']}[c.wx]||['—',''],DK={wd:'平日',sat:'土曜',hol:'日曜・祝日'}[c.day]||'';
  const wxReal=!!g(()=>J('dia-wxlog')[ymd],null);
  // 売店：きのう締めた日
  const K=g(()=>minatoKiosk.state,null),h=K&&K.hist&&K.hist.length?K.hist[K.hist.length-1]:null;
  const so=h&&K.news?K.news.filter(n=>n.day===h.day&&n.kind==='soldout'):[];
  const kiosk=!K?`<p class="tx">まだ売店を出していません。</p>`:!h?`<p class="tx">${esc(stN(K.st))}駅の売店。まだ締めた日がありません。</p>`:
    `<div class="nums"><span><small>売上</small><b>${yen(h.sales)}</b></span><span><small>もうけ</small><b class="${h.profit<0?'neg':'pos'}">${yen(h.profit)}</b></span><span><small>廃棄</small><b>${yen(h.waste)}</b></span><span><small>お客さん</small><b>${h.cust.toLocaleString()}人</b></span></div>
     <p class="tx">第${h.day}運行日・${esc(stN(K.st))}駅。売り切れ：${so.length?esc(so[0].title):'目立つ売り切れはなし'}</p>`;
  // 工場と配送（dia-orders）
  const O=J('dia-orders'),days=O&&Array.isArray(O.days)?O.days:[],sd=days.filter(x=>x.slip&&!x.slip.err).slice(-1)[0],ad=days.filter(x=>x.arr).slice(-1)[0];
  let fac='<p class="tx">まだ工場に注文が届いていません（売店をセンターにおまかせにすると始まります）。</p>';
  if(sd){let o=0,s2=0;for(const k in sd.slip.items){o+=sd.slip.items[k][0];s2+=sd.slip.items[k][1];}let got=0;
    if(ad)for(const k in ad.arr)for(const r of ad.arr[k].runs||[])for(const pid in r.f||{})got+=r.f[pid];
    fac=`<div class="nums"><span><small>出荷</small><b>${s2.toLocaleString()}個</b></span><span><small>注文</small><b>${o.toLocaleString()}個</b></span>${ad?`<span><small>売店に届いた（第${ad.day}運行日）</small><b>${got.toLocaleString()}個</b></span>`:''}</div>
      <p class="tx">納品書 ${esc(sd.slip.no)}（第${sd.day}運行日）${sd.slip.short&&sd.slip.short.n?`・足りなかった品 ${sd.slip.short.n}品（${sd.slip.short.q}個）`:'・注文どおり出荷'}</p>`;}
  // センター（倉庫）と配送会社：それぞれの画面の計算を1回だけ読む
  const CI=K?g(()=>minatoKiosk.centerInfo(),null):null;let cen='<p class="tx">売店を出すと、センターが品を届け始めます。</p>';
  if(CI&&!CI.err){const o=Object.values(CI.out),sh=o.filter(x=>x.st==='short').length,th=o.filter(x=>x.st==='thin').length,tot=o.reduce((t,x)=>t+x.stock,0),pend=CI.cs.po.filter(p=>p.st!=='in').sort((a,b)=>a.arr-b.arr)[0];
    cen=`<div class="nums"><span><small>倉庫の在庫</small><b>${tot.toLocaleString()}個</b></span><span><small>足りなくなるおそれ</small><b class="${sh?'neg':''}">${sh}品</b></span><span><small>薄い</small><b>${th}品</b></span></div><p class="tx">${pend?`問屋の品が第${pend.arr}運行日に着く（${esc(pend.no)}）`:`次の発注は第${CI.nextOrder}運行日`}</p>`;}
  const HZ=K&&day!=null?g(()=>minatoHaiso.summary(day),null):null;
  const hz=HZ?`<div class="nums"><span><small>自社便</small><b>${HZ.own}便</b></span><span><small>他社便</small><b>${HZ.other}便</b></span><span><small>もうけ</small><b class="${HZ.profit<0?'neg':'pos'}">${yen(HZ.profit)}</b></span></div><p class="tx">トラック${HZ.trucks}台・${HZ.km}km${HZ.late?`・最大${HZ.late}分おくれ`:''}</p>`:'<p class="tx">売店を出すと、トラックが走り始めます。</p>';
  // アンケート
  const sv=T.svKey!=null?T.sv:null;
  const surv=!T.survey?`<p class="tx">${T.loading?'読み込み中…':'アンケートを読めませんでした。'}</p>`:!sv?`<p class="tx">${T.svKey==null?'集計中…':'比べられる年がまだありません。'}</p>`:
    `<div class="nums"><span><small>${esc(sv.q)}・${esc(stN(sv.id))}</small><b>${sv.b.toFixed(0)}% → ${sv.a.toFixed(0)}%</b></span></div><p class="tx">${sv.y}年10月の調査で、前の年からいちばん動いた数字（${sv.d>0?'+':''}${sv.d.toFixed(1)}ポイント）。</p>`;
  // 橋の一覧
  const LK=T.links,st=LK?LK.states:{},cnt={};if(LK)for(const b of LK.links)cnt[b.state]=(cnt[b.state]||0)+1;
  const isl=k=>String(k).split(',').map(x=>LK.islands[x]||x).join('・');
  const bridges=!LK?'<p class="tx">橋の一覧を読めませんでした。</p>':`<p class="bsum">${['done','temp','none','retired'].map(k=>`<span class="bs bs-${k}">${esc(st[k])} ${cnt[k]||0}</span>`).join('')}<span class="lg">数字の出どころ：${mark('real')}現実 ${mark('assume')}仮定 ${mark('game')}ゲーム内</span></p>
    <ul class="blist">${LK.links.map(b=>`<li class="bs-${b.state}"><span class="bst">${esc(st[b.state])}</span><b>${esc(isl(b.from))} → ${esc(isl(b.to))}</b><span class="bv">${b.values.map(v=>`${esc(v.name)}${mark(v.src)}`).join(' ')}</span><small>${esc(b.desc)}</small></li>`).join('')}</ul>`;
  return `<div class="tdhd"><h2>きょうの沿線</h2><p class="date">${day!=null?`第${day}運行日・`:''}${jfmt(d,{month:'long',day:'numeric',weekday:'short'})}・${DK}<span class="wx">${WX[1]} ${WX[0]}${mark(wxReal?'real':'assume')}</span></p></div>
   ${(()=>{const Y=g(()=>minatoMoney.yesterday(),null);if(!Y)return '';const K4={kiosk:'売店',center:'センター',factory:'工場',haiso:'配送'};
     return `<button type="button" class="money1" data-go="money"><span>第${Y.day}運行日のグループのもうけ</span><b class="${Y.net<0?'neg':'pos'}">${Y.net>0?'+':''}${yen(Y.net)}</b><small>${Object.keys(K4).map(k=>`${K4[k]} ${(Y.co[k].net>0?'+':'')}${yen(Y.co[k].net)}`).join('・')}</small><em>お金の流れ ›</em></button>`;})()}
   <p class="cohd">会社の窓<small>${esc(g(()=>T.co.group,'みなと川グループ'))}の4つの会社は、それぞれ別の会社。押すと、その会社の画面が開きます</small></p>
   <div class="isles co4">
    <button type="button" class="isle" data-go="kiosk:money"><span class="ih">売店<small>${esc(coN('kiosk'))}・きのうの収支</small>${mark('game')}</span>${kiosk}</button>
    <button type="button" class="isle" data-go="factory:rice"><span class="ih">工場<small>${esc(coN('factory'))}・出荷・届いた納品</small>${mark('game')}</span>${fac}</button>
    <button type="button" class="isle" data-go="center"><span class="ih">センター<small>${esc(coN('center'))}・倉庫</small>${mark('game')}</span>${cen}</button>
    <button type="button" class="isle" data-go="haiso"><span class="ih">配送会社<small>${esc(coN('haiso'))}・きょうの便</small>${mark('game')}</span>${hz}</button>
   </div>
   <div class="isles">
    <button type="button" class="isle" data-go="page:survey.html${sv?'#'+sv.qid:''}"><span class="ih">アンケート<small>目立つ変化</small>${mark('game')}</span>${surv}</button>
    ${(()=>{const L=g(()=>SEAS.list,[])||[];const pl=L.map(o=>o.st?stN(o.st)+'駅のあたり':'沿線のあちこち');
      return `<button type="button" class="isle" data-go="tayori"><span class="ih">季節のできごと<small>きょうの場所だけ</small>${mark('game')}</span><p class="tx">${L.length?`きょうは ${esc(pl.join('・'))} で、何かあるようです。くわしくは沿線だよりに。`:'きょうは、目立ったできごとの知らせはありません。'}</p></button>`;})()}
   </div>
   <details class="bridges"><summary>島をつなぐ橋（${LK?LK.links.length:0}本）<small>どの数字が、どこからどこへ渡っているか</small></summary>${bridges}</details>`;}
function paintToday(){const b=$('topToday');if(!b||$('topv').hidden)return;const op=b.querySelector('details')&&b.querySelector('details').open;b.innerHTML=todayHtml();if(op)b.querySelector('details').open=true;
  b.querySelectorAll('[data-go]').forEach(x=>x.onclick=()=>go(x.dataset.go));}

function go(a){const [k,v]=a.split(':');
  if(k==='karte'){openKarte(v);return;}
  if(k==='page'){location.href=a.slice(5);return;}
  if(k==='factory'){window.open('factory.html'+(v?'#'+v:''),'_blank','noopener');return;}
  close();
  if(k==='tayori')g(()=>$('tayoriBtn').click());
  else if(k==='research')g(()=>minatoResearch.open());
  else if(k==='center')g(()=>minatoCenter.open());
  else if(k==='haiso')g(()=>minatoHaiso.open());
  else if(k==='money')g(()=>minatoMoney.open());
  else if(k==='kiosk')g(()=>minatoKiosk.openTab?minatoKiosk.openTab(v):minatoKiosk.open());}

const CSS=`.topv{position:fixed;inset:0;z-index:80;background:var(--paper);color:var(--ink);overflow:auto;padding:calc(env(safe-area-inset-top,0px) + 18px) max(16px,env(safe-area-inset-right,0px)) calc(env(safe-area-inset-bottom,0px) + 28px) max(16px,env(safe-area-inset-left,0px))}
.topv .in{max-width:1180px;margin:0 auto;display:grid;gap:14px}
.topv .hd{display:flex;flex-wrap:wrap;gap:10px 16px;align-items:flex-end;justify-content:space-between}
.topv h1{margin:0;font-size:clamp(22px,4vw,30px);letter-spacing:.04em}.topv .lede{margin:4px 0 0;color:var(--muted);font-size:14px;max-width:62ch;line-height:1.7}
.topv .go{font:inherit;font-weight:700;font-size:15px;border:1px solid var(--accent);background:var(--accent);color:var(--accent-ink);border-radius:999px;padding:10px 18px;cursor:pointer;min-height:44px}
.topv .acts{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.topv .memo{font-size:14px;font-weight:700;color:var(--ink);text-decoration:none;border:1px solid var(--line);background:var(--panel);border-radius:999px;padding:8px 16px;min-height:44px;display:inline-flex;align-items:center;gap:6px}.topv .memo small{font-weight:400;color:var(--muted);font-size:12px}.topv .memo:hover{border-color:var(--accent)}
.topv .grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px}
.topv .ly{grid-column:span 2;border:1px solid var(--line);border-radius:12px;background:var(--panel);overflow:hidden;display:flex;flex-direction:column}
.topv .art{aspect-ratio:400/220;background:var(--line);overflow:hidden;position:relative}
.topv .pin{position:absolute;transform:translate(-50%,-130%);font-size:11.5px;font-weight:700;background:rgb(255 255 255 / .88);color:#3b2f25;border:1px solid #b9a989;border-radius:6px;padding:1px 6px;white-space:nowrap;pointer-events:none}.topv .pin::after{content:'';position:absolute;left:50%;bottom:-7px;width:8px;height:8px;margin-left:-4px;border-radius:50%;background:#c23b3b;border:1.5px solid #fff;transform:translateY(100%)}.topv .pin.main{background:#c23b3b;color:#fff;border-color:#c23b3b;font-size:12.5px}
.topv .cap{position:absolute;left:6px;bottom:4px;font-size:10px;color:#5d5045;background:rgb(255 255 255 / .7);border-radius:4px;padding:0 5px}.topv .art img,.topv .art svg{width:100%;height:100%;display:block;object-fit:cover}
.topv .bd{padding:10px 12px 12px;display:grid;gap:6px}
.topv .nm{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}.topv .nm b{font-size:20px}.topv .nm small{color:var(--muted);font-size:12.5px}
.topv .st{margin-left:auto;font-size:11px;border-radius:999px;padding:1px 8px;border:1px solid var(--line);color:var(--muted)}.topv .st.ok{color:#2f8a4a;border-color:#2f8a4a66}
.topv .bd button.it{font:inherit;font-size:13.5px;text-align:left;border:1px solid var(--line);background:var(--paper);color:var(--ink);border-radius:8px;padding:8px 10px;cursor:pointer;min-height:40px;display:flex;justify-content:space-between;gap:8px}
.topv .bd button.it::after{content:'→';color:var(--muted)}.topv .bd button.it.ext::after{content:'↗'}
.topv .soon{font-size:12px;color:var(--muted);border-top:1px dashed var(--line);padding-top:6px}
.topv .ft{display:flex;flex-wrap:wrap;gap:8px 18px;align-items:center;font-size:12.5px;color:var(--muted)}
.topv .ft label{display:flex;gap:6px;align-items:center;cursor:pointer;min-height:36px}
.topv .today{border:1px solid var(--line);border-radius:14px;background:var(--panel);padding:14px 14px 10px;display:grid;gap:12px;position:relative;overflow:hidden}
.topv .today::before{content:'';position:absolute;left:0;right:0;top:0;height:4px;background:repeating-linear-gradient(90deg,var(--accent) 0 28px,transparent 28px 36px);opacity:.55}
.topv .tdhd{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 14px}.topv .tdhd h2{margin:0;font-size:19px;letter-spacing:.12em}
.topv .date{margin:0;font-size:13.5px;color:var(--muted);display:flex;flex-wrap:wrap;gap:4px 10px;align-items:baseline}.topv .wx{color:var(--ink);font-weight:700}
.topv .isles{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.topv .isles:not(.co4){grid-template-columns:repeat(2,minmax(0,1fr))}
.topv .money1{font:inherit;color:inherit;text-align:left;border:1px solid var(--line);border-radius:10px;background:var(--paper);padding:8px 12px;display:flex;flex-wrap:wrap;gap:4px 12px;align-items:baseline;cursor:pointer}.topv .money1:hover{border-color:var(--accent)}.topv .money1 span{font-size:12.5px;color:var(--muted)}.topv .money1 b{font-size:18px;font-variant-numeric:tabular-nums}.topv .money1 b.neg{color:#b5452f}.topv .money1 b.pos{color:#2f7a4a}.topv .money1 small{font-size:11.5px;color:var(--muted)}.topv .money1 em{font-style:normal;margin-left:auto;font-size:12.5px;font-weight:700}
.topv .cohd{margin:0;font-weight:700;font-size:14px;display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}.topv .cohd small{font-weight:400;font-size:11.5px;color:var(--muted)}
.topv .isle{font:inherit;color:inherit;text-align:left;border:1px solid var(--line);border-radius:10px;background:var(--paper);padding:10px 11px;display:flex;flex-direction:column;gap:6px;min-width:0;cursor:pointer}
.topv button.isle:hover{border-color:var(--accent)}.topv .soonisle{border-style:dashed;cursor:default;opacity:.8}
.topv .ih{font-weight:700;font-size:14px;display:flex;align-items:baseline;gap:6px;flex-wrap:wrap}.topv .ih small{font-weight:400;color:var(--muted);font-size:11.5px}.topv .ih .sm{margin-left:auto}
.topv .nums{display:flex;flex-wrap:wrap;gap:4px 14px}.topv .nums span{display:flex;flex-direction:column;min-width:0}.topv .nums small{font-size:11px;color:var(--muted)}.topv .nums b{font-size:17px;font-variant-numeric:tabular-nums;letter-spacing:.01em}
.topv .nums b.neg{color:#b5452f}.topv .nums b.pos{color:#2f7a4a}
.topv .tx{margin:0;font-size:12px;color:var(--muted);line-height:1.6;overflow-wrap:anywhere}
.topv .sm{font-style:normal;font-size:10px;line-height:1;border-radius:3px;padding:2px 3px;border:1px solid;font-weight:700}
.topv .sm-real{color:#2b6c9c;border-color:#2b6c9c88}.topv .sm-assume{color:#a26a12;border-color:#a26a1288}.topv .sm-game{color:#2f7a4a;border-color:#2f7a4a88}
.topv .bridges{border-top:1px dashed var(--line);padding-top:8px;font-size:13px}.topv .bridges summary{cursor:pointer;font-weight:700;min-height:32px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}.topv .bridges summary small{font-weight:400;color:var(--muted);font-size:11.5px}
.topv .bsum{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:6px 0}.topv .bs{font-size:11.5px;border-radius:999px;padding:1px 9px;border:1px solid var(--line)}.topv .lg{margin-left:auto;font-size:11.5px;color:var(--muted);display:flex;gap:4px;align-items:center;flex-wrap:wrap}
.topv .bs-done .bst,.topv .bsum .bs-done{color:#2f7a4a;border-color:#2f7a4a66}.topv .bs-temp .bst,.topv .bsum .bs-temp{color:#a26a12;border-color:#a26a1266}.topv .bs-none .bst,.topv .bsum .bs-none{color:var(--muted)}.topv .bs-retired .bst,.topv .bsum .bs-retired{color:var(--muted);text-decoration:line-through}
.topv .blist{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:6px}
.topv .blist li{border:1px solid var(--line);border-radius:8px;padding:6px 8px;display:grid;gap:2px;background:var(--paper)}.topv .blist li.bs-none,.topv .blist li.bs-retired{border-style:dashed;opacity:.75}
.topv .blist .bst{font-size:10.5px;font-weight:700}.topv .blist b{font-size:13px}.topv .blist .bv{font-size:11px;color:var(--muted);display:flex;flex-wrap:wrap;gap:3px 8px}.topv .blist small{font-size:11px;color:var(--muted);line-height:1.5}
.topv .labgo{font:inherit;font-size:12.5px;text-align:left;border:1px dashed var(--line);background:none;color:var(--muted);border-radius:8px;padding:7px 10px;cursor:pointer;min-height:38px;display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}.topv .labgo small{font-size:11px}.topv .labgo:hover{border-color:var(--accent);color:var(--ink)}
.topv .lab{border:1px dashed var(--line);border-radius:12px;padding:8px 12px;background:var(--panel)}.topv .lab summary{cursor:pointer;font-weight:700;font-size:15px;min-height:40px;display:flex;align-items:center;gap:10px;flex-wrap:wrap}.topv .lab summary small{font-weight:400;color:var(--muted);font-size:12px}
.topv .labg{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px;padding:6px 0 4px}.topv .labc{display:grid;gap:6px;align-content:start;border-radius:8px;padding:4px}.topv .labc b{font-size:13px;color:var(--muted)}
.topv .labc.hl{animation:labhl 1.4s ease-out}@keyframes labhl{from{background:color-mix(in srgb,var(--accent) 22%,transparent)}to{background:transparent}}
@media (max-width:900px){.topv .isles{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:560px){.topv .isles{grid-template-columns:1fr}.topv .nums b{font-size:16px}}
@media (max-width:900px){.topv .grid{grid-template-columns:repeat(2,minmax(0,1fr))}.topv .ly,.topv .ly.wide{grid-column:span 1}}
@media (max-width:560px){.topv .grid{grid-template-columns:1fr}.topv .ly,.topv .ly.wide,.topv .ly:nth-child(3){grid-column:auto}}`;

const itBtn=(t,a)=>`<button type="button" class="it${/^(karte|factory):/.test(a)?' ext':''}" data-go="${a}">${t}</button>`;
function render(){const box=$('topv');
  box.innerHTML=`<div class="in"><div class="hd"><div><h1>みなと川ダイアリー</h1>
      <p class="lede">世界の出来事は、どうやって駅の売店まで届くのか。売店でのあなたの小さな判断は、どこまで届くのか。5つのレイヤーを行き来しながら、架空の沿線を動かしてみてください。</p></div>
      <div class="acts"><a class="memo" href="docs/ideas.html" target="_blank" rel="noopener">アイデア帳<small>これから足すこと</small>↗</a><button type="button" class="go" id="topGo">路線図とダイヤへ</button></div></div>
    <section class="today" id="topToday" aria-label="きょうの沿線"></section>
    <div class="grid">${L.map((x,i)=>`<section class="ly" aria-label="${x.name}"><div class="art">${x.img?`<img src="${x.img}" alt="${x.name}のイメージ" loading="lazy">`:x.art}${(x.pins||[]).map(p=>`<span class="pin${p.main?' main':''}" style="left:${p.x}%;top:${p.y}%">${p.t}</span>`).join('')}${x.pins?'<span class="cap">イメージ（AIで描いた絵）</span>':''}</div>
      <div class="bd"><div class="nm"><b>${x.name}</b><small>${x.sub}</small><span class="st${x.state==='遊べる'?' ok':''}">${x.state==='遊べる'?'遊べる':'読める（一部）'}</span></div>
      ${x.items.filter(i=>!i[2]).map(([t,a])=>itBtn(t,a)).join('')}${x.items.some(i=>i[2])?`<button type="button" class="labgo" data-lab="${x.id}">研究室で見る（${x.items.filter(i=>i[2]).length}）<small>見るだけ・試作</small></button>`:''}
      ${x.note?`<div class="soon">${x.note}</div>`:''}${x.soon?`<div class="soon">準備中：${x.soon}</div>`:''}</div></section>`).join('')}</div>
    <details class="lab" id="topLab"><summary>研究室<small>見るだけ・試作の画面。遊ぶ画面とは分けて、ここにまとめています（どれも消していません）</small></summary>
      <div class="labg">${L.filter(x=>x.items.some(i=>i[2])).map(x=>`<div class="labc" id="lab-${x.id}"><b>${x.name}</b>${x.items.filter(i=>i[2]).map(([t,a])=>itBtn(t,a)).join('')}</div>`).join('')}</div></details>
    <div class="ft"><label><input type="checkbox" id="topSkip" ${g(()=>localStorage.getItem(KEY)==='1',false)?'checked':''}> 次から、開いたときにこのページを出さない</label>
      <span>上の帯の「トップ」で、いつでもここに戻れます。↗ は別のタブで開きます（街のカルテ・アイデア帳）。</span>
      <span>沿線・会社・人はすべて架空です。歴史や数字の多くは、現実の出来事や統計を元に作っています。</span></div></div>`;
  box.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>go(b.dataset.go));
  box.querySelectorAll('[data-lab]').forEach(b=>b.onclick=()=>{const d=$('topLab');d.open=true;const c=$('lab-'+b.dataset.lab);if(c){c.scrollIntoView({behavior:'smooth',block:'center'});c.classList.remove('hl');void c.offsetWidth;c.classList.add('hl');}});
  $('topGo').onclick=()=>go('play');
  paintToday();loadToday();
  $('topSkip').onchange=e=>{try{e.target.checked?localStorage.setItem(KEY,'1'):localStorage.removeItem(KEY);}catch(_){}};}
function open(){const b=$('topv');b.hidden=false;render();b.scrollTop=0;try{b.querySelector('.go').focus({preventScroll:true});}catch(e){}}
function close(){const b=$('topv');if(b)b.hidden=true;}

{const s=document.createElement('style');s.textContent=CSS;document.head.appendChild(s);
 const v=document.createElement('div');v.id='topv';v.className='topv';v.hidden=true;v.setAttribute('role','dialog');v.setAttribute('aria-label','トップ');document.body.appendChild(v);
 // 上の帯に「トップ」（沿線だよりの前）と、小さい帯にも
 const mountBtn=()=>{const cb=document.querySelector('.clockbox');if(cb&&!$('topBtn')){const b=document.createElement('button');b.id='topBtn';b.type='button';b.className='tayoribtn';b.textContent='トップ';cb.after(b);b.onclick=open;}
   const mb=document.querySelector('.minibar-in');if(mb&&!$('mtop')){const b=document.createElement('button');b.id='mtop';b.type='button';b.className='mspeed tayorimini';b.textContent='トップ';mb.prepend(b);b.onclick=open;}};
 mountBtn();setTimeout(mountBtn,800);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('topv').hidden)close();});
 if(!g(()=>localStorage.getItem(KEY)==='1',false)&&!/#load=/.test(location.hash))open();}
window.minatoTop={open,close,layers:L};
})();
