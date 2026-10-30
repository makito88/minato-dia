/* =====================================================================
   トップページ：5つのレイヤー（世界・日本・沿線・店舗・従業員）から入る
   ・開いたときに表示する（「次から表示しない」で、開いたときは出さない）。上の帯の「トップ」でいつでも戻れる。
   ・各レイヤーのボタンは、いまある画面（路線図とダイヤ・沿線だより・駅ナカ リサーチ・売店・店員・街のカルテ）へつなぐだけ。
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

const L=[
 {id:'world',name:'世界',sub:'国際貿易・資源・金融・人口移動',img:'docs/img/map-world.jpg',art:SVG_WORLD,state:'一部',
  pins:[{x:44,y:31,t:COUNTRY,main:1},{x:8.4,y:19.5,t:'姉妹港'},{x:71.6,y:31,t:'北米西岸'},{x:32.5,y:48.5,t:'東南アジア'}],
  items:[['港の荷主をのぞく（海外とのお金の流れ）','karte:port'],['姉妹港ヴェステルハーフェンの歩み','karte:history']],soon:'資源の値段や為替が、売店まで届く道すじ（因果カード）'},
 {id:'japan',name:COUNTRY,sub:'日本にあたる架空の島国（名前は仮）・産業・港湾・鉄道・物流',img:'docs/img/map-country.jpg',art:SVG_JAPAN,state:'一部',
  pins:[{x:59.5,y:44,t:'みなと川沿線',main:1}],   // 沿線は全長30km余り。国の地図では1点になるので、印は1つだけ
  items:[['沿線の歩み 1885〜2026（日本の地方鉄道に似せた歴史）','karte:history'],['国・県と町のお金の流れ（交付税など）','karte:money']],soon:'国内の物流と産業の地図'},
 {id:'line',name:'沿線',sub:'人口・土地利用・駅・商業施設',img:'docs/img/route-map-painted.jpg',state:'遊べる',
  items:[['路線図とダイヤ（列車を走らせる）','play'],['沿線だより','tayori'],['駅ナカ リサーチ','research'],['街のカルテ（駅・市町村・名所・歴史）','karte:station']]},
 {id:'shop',name:'店舗',sub:'商品・在庫・売上・客の行動',img:'docs/img/top-kiosk.jpg',state:'遊べる',
  items:[['売店を運営する','kiosk:log'],['商品・値段・仕入れ','kiosk:items'],['客層・客単価・買ったきっかけ','kiosk:people'],['収支と万引きの疑い','kiosk:money']]},
 {id:'crew',name:'従業員',sub:'シフト・時給・やる気・暮らし',art:SVG_CREW,state:'遊べる',
  items:[['店員・シフト・時給','kiosk:crew'],['店員の1か月の暮らしとお金の流れ','karte:clerk']]}];

function go(a){const [k,v]=a.split(':');
  if(k==='karte'){openKarte(v);return;}
  close();
  if(k==='tayori')g(()=>$('tayoriBtn').click());
  else if(k==='research')g(()=>minatoResearch.open());
  else if(k==='kiosk')g(()=>minatoKiosk.openTab?minatoKiosk.openTab(v):minatoKiosk.open());}

const CSS=`.topv{position:fixed;inset:0;z-index:80;background:var(--paper);color:var(--ink);overflow:auto;padding:calc(env(safe-area-inset-top,0px) + 18px) max(16px,env(safe-area-inset-right,0px)) calc(env(safe-area-inset-bottom,0px) + 28px) max(16px,env(safe-area-inset-left,0px))}
.topv .in{max-width:1180px;margin:0 auto;display:grid;gap:14px}
.topv .hd{display:flex;flex-wrap:wrap;gap:10px 16px;align-items:flex-end;justify-content:space-between}
.topv h1{margin:0;font-size:clamp(22px,4vw,30px);letter-spacing:.04em}.topv .lede{margin:4px 0 0;color:var(--muted);font-size:14px;max-width:62ch;line-height:1.7}
.topv .go{font:inherit;font-weight:700;font-size:15px;border:1px solid var(--accent);background:var(--accent);color:var(--accent-ink);border-radius:999px;padding:10px 18px;cursor:pointer;min-height:44px}
.topv .grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px}
.topv .ly{grid-column:span 2;border:1px solid var(--line);border-radius:12px;background:var(--panel);overflow:hidden;display:flex;flex-direction:column}
.topv .ly.wide{grid-column:span 3}
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
@media (max-width:900px){.topv .grid{grid-template-columns:repeat(2,minmax(0,1fr))}.topv .ly,.topv .ly.wide{grid-column:span 1}.topv .ly:nth-child(3){grid-column:span 2}}
@media (max-width:560px){.topv .grid{grid-template-columns:1fr}.topv .ly,.topv .ly.wide,.topv .ly:nth-child(3){grid-column:auto}}`;

function render(){const box=$('topv');
  box.innerHTML=`<div class="in"><div class="hd"><div><h1>みなと川電鉄 ダイヤ工房</h1>
      <p class="lede">世界の出来事は、どうやって駅の売店まで届くのか。売店でのあなたの小さな判断は、どこまで届くのか。5つのレイヤーを行き来しながら、架空の沿線を動かしてみてください。</p></div>
      <button type="button" class="go" id="topGo">路線図とダイヤへ</button></div>
    <div class="grid">${L.map((x,i)=>`<section class="ly${i>=3?' wide':''}" aria-label="${x.name}"><div class="art">${x.img?`<img src="${x.img}" alt="${x.name}のイメージ" loading="lazy">`:x.art}${(x.pins||[]).map(p=>`<span class="pin${p.main?' main':''}" style="left:${p.x}%;top:${p.y}%">${p.t}</span>`).join('')}${x.pins?'<span class="cap">イメージ（AIで描いた絵）</span>':''}</div>
      <div class="bd"><div class="nm"><b>${x.name}</b><small>${x.sub}</small><span class="st${x.state==='遊べる'?' ok':''}">${x.state==='遊べる'?'遊べる':'読める（一部）'}</span></div>
      ${x.items.map(([t,a])=>`<button type="button" class="it${a.startsWith('karte')?' ext':''}" data-go="${a}">${t}</button>`).join('')}
      ${x.soon?`<div class="soon">準備中：${x.soon}</div>`:''}</div></section>`).join('')}</div>
    <div class="ft"><label><input type="checkbox" id="topSkip" ${g(()=>localStorage.getItem(KEY)==='1',false)?'checked':''}> 次から、開いたときにこのページを出さない</label>
      <span>上の帯の「トップ」で、いつでもここに戻れます。↗ は街のカルテ（別のタブ）が開きます。</span>
      <span>沿線・会社・人はすべて架空です。歴史や数字の多くは、現実の出来事や統計を元に作っています。</span></div></div>`;
  box.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>go(b.dataset.go));
  $('topGo').onclick=()=>go('play');
  $('topSkip').onchange=e=>{try{e.target.checked?localStorage.setItem(KEY,'1'):localStorage.removeItem(KEY);}catch(_){}};}
function open(){const b=$('topv');render();b.hidden=false;b.scrollTop=0;try{b.querySelector('.go').focus({preventScroll:true});}catch(e){}}
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
