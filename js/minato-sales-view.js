/* =====================================================================
   港駅の売店：きょう売れたもの（棚 × 時間・品の一覧・いつもと比べる）の画面（2026-11-11・ユーザーの頼み）
   ・計算は js/minato-sales-core.js。ここは「描く」と「1日の記録を残す」だけ。
   ・1日の記録は dia-minato-sales（{v:1, days:[{v:1,day,kind,g,n,total}]}・直近35日。dia- なので引き継ぎコードに入る）。
   ・港駅の店の画面（js/minato-store-view.js）の panel から render、閉店の締めから record を呼ぶ。
   ・選んでいるタブ・棚は保存しない（開き直すと「棚 × 時間」）。
   ===================================================================== */
(function(){
'use strict';
if(typeof MinatoSalesCore==='undefined')return;
const C=MinatoSalesCore,KEY='dia-minato-sales',KEEP=35;
const UI={tab:'grid',cmp:'usual',sel:null,key:''};
const RAMP=['#fbe9d6','#f8d2a8','#f4b67a','#ee9a52','#e07b2e','#c4601c','#9c4914'];
const UP=['#f9dcc0','#f1b47c','#e07b2e','#b5561a'],DN=['#d6e4f0','#a9c6e0','#6f9fc9','#3f74a6'],MID='#e9e4dc';
const DARK=new Set([RAMP[4],RAMP[5],RAMP[6],UP[2],UP[3],DN[2],DN[3]]);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const num=n=>Math.round(n).toLocaleString('ja-JP');
const shade=(v,m)=>v>0?RAMP[Math.max(1,Math.min(6,Math.round(Math.pow(v/Math.max(1,m),0.75)*6)))]:null;
const jc=j=>j>0?UP[j]:j<0?DN[-j]:MID;
const inkOf=c=>c&&DARK.has(c)?'#fff':'#3b2a1c';
const sgn=d=>(d>=0?'+':'−')+Math.abs(Math.round(d));
/* ---------- 1日の記録 ---------- */
function load(){let o=null;try{o=JSON.parse(localStorage.getItem(KEY)||'null');}catch(e){}return o&&o.v===1&&Array.isArray(o.days)?o:{v:1,days:[]};}
let cache=null,cacheRaw=null;
function days(){let raw=null;try{raw=localStorage.getItem(KEY);}catch(e){}if(raw!==cacheRaw||!cache){cacheRaw=raw;cache=load();}return cache.days;}
function record(res,cfg,layout){if(!res||!res.ev)return;const o=load();o.days=o.days.filter(d=>d.day!==res.day);o.days.push(C.dayRec(res,cfg,layout));o.days.sort((a,b)=>a.day-b.day);
  if(o.days.length>KEEP)o.days=o.days.slice(-KEEP);try{localStorage.setItem(KEY,JSON.stringify(o));}catch(e){}cache=null;}
/* ---------- 見た目 ---------- */
const CSS=`.mss{margin-top:10px}.mss h3{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:0 0 8px;font-size:15px}
.mss .tabs{margin-left:auto;display:flex;gap:6px;flex-wrap:wrap}.mss button{font:inherit;font-size:12px;padding:4px 10px;border-radius:999px;border:1px solid var(--line2);background:transparent;color:var(--ink);cursor:pointer;min-height:30px}
.mss button.on{background:#ffb347;border-color:#ffb347;color:#22313a;font-weight:700}
.mss .k{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px}.mss .k>div{border:1px solid var(--line);border-radius:9px;padding:6px 12px;min-width:120px;flex:1 1 120px}
.mss .k small{display:block;color:var(--muted);font-size:11.5px}.mss .k b{font-size:20px}.mss .k b u{text-decoration:none;font-size:12px;color:var(--muted);margin-left:2px}.mss .k p{margin:2px 0 0;font-size:11.5px;font-weight:700}
.mss .up{color:#b5561a}.mss .dn{color:#3f74a6}.mss .eqc{color:var(--muted)}
.mss .g2{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.3fr);gap:12px}@media (max-width:760px){.mss .g2{grid-template-columns:1fr}}
.mss .bx{border:1px solid var(--line);border-radius:10px;padding:10px;min-width:0}.mss .bx h4{margin:0 0 6px;font-size:13px;display:flex;justify-content:space-between;align-items:baseline;gap:6px;flex-wrap:wrap}.mss .bx h4 small{font-weight:400;color:var(--muted);font-size:11px}
.mss svg{width:100%;height:auto;display:block}.mss svg rect.z{cursor:pointer}.mss .bn{font-weight:800;fill:#2a221a}.mss .ml{font-size:14px;fill:var(--muted);font-weight:700}
.mss .lg{display:flex;align-items:center;gap:5px;font-size:11px;color:var(--muted);margin-top:6px;flex-wrap:wrap}.mss .lg i{width:20px;height:10px;border-radius:2px;display:inline-block}
.mss .pk{margin-top:8px;border-top:1px dashed var(--line);padding-top:8px}.mss .pk b{font-size:12.5px}.mss .pk ul{list-style:none;margin:6px 0 0;padding:0;display:flex;gap:6px;flex-wrap:wrap}
.mss .pk li{background:#fff6ec;color:#3b2a1c;border:1px solid #f0c9a0;border-radius:999px;padding:3px 9px 3px 3px;font-size:12px;display:flex;align-items:center;gap:5px}.mss .pk li em{font-style:normal;color:#9c4914;font-weight:700}
.mss .rk{width:18px;height:18px;border-radius:50%;background:#e07b2e;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:10.5px;font-weight:800}
.mss .sc{overflow-x:auto;-webkit-overflow-scrolling:touch}.mss .hm{display:grid;gap:3px;align-items:center}
.mss .hm .l{position:sticky;left:0;background:var(--panel);z-index:3;box-shadow:4px 0 4px -3px rgba(0,0,0,.18);align-self:stretch;line-height:28px;font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer;padding-right:4px}.mss .hm .l.s{color:var(--muted);font-weight:400;cursor:default}@media (max-width:760px){.mss .hm .l{font-size:11px}}
.mss .hh{font-size:11.5px;color:var(--muted);text-align:center}.mss .hh.now{color:#e07b2e;font-weight:700}
.mss .c{height:28px;border-radius:5px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-weight:700;font-size:12.5px;line-height:1.05;font-variant-numeric:tabular-nums}.mss .c small{font-size:9px;font-weight:600;opacity:.85}
.mss .c.now{outline:2px dashed #7a3a0e;outline-offset:-2px}.mss .c.e{color:var(--muted);font-weight:400}
.mss .t{display:flex;align-items:center;gap:4px;height:26px}.mss .tb{position:relative;flex:0 0 40px;height:24px}.mss .tb i{position:absolute;left:0;top:5px;height:14px;background:var(--line2);border-radius:0 4px 4px 0}
.mss .tb s{position:absolute;top:1px;width:2px;height:22px;background:var(--ink);margin-left:-1px}.mss .t b{font-size:12.5px;min-width:26px;text-align:right}
.mss .t em{font-style:normal;font-size:10px;font-weight:700;padding:1px 4px;border-radius:4px;white-space:nowrap}.mss .t em.up{background:#fbe2cc}.mss .t em.dn{background:#dbe7f2}
.mss .cb{display:flex;flex-direction:column;align-items:center}.mss .cb span{font-size:10.5px;color:var(--muted)}.mss .cb div{position:relative;height:44px;width:64%}
.mss .cb i{position:absolute;bottom:0;left:0;right:0;background:#8d7b66;border-radius:3px 3px 0 0}.mss .cb s{position:absolute;bottom:0;left:-3px;right:-3px;border:1.5px dashed var(--ink);border-bottom:none;border-radius:3px 3px 0 0;z-index:2}
.mss .cb.now i{background:repeating-linear-gradient(135deg,#8d7b66 0 4px,#b9a894 4px 8px)}
.mss .nt{font-size:11px;color:var(--muted);margin:6px 0 0}.mss .seg{display:inline-flex;gap:4px}
.mss table{width:100%;border-collapse:collapse;font-size:12.5px}.mss td,.mss th{padding:4px 6px;border-bottom:1px solid var(--line);text-align:left}.mss th{color:var(--muted);font-weight:400;font-size:11.5px}.mss td.r{text-align:right;font-variant-numeric:tabular-nums}
.mss td.r{white-space:nowrap}@media (max-width:760px){.mss .hz{display:none}.mss table td .bar{width:calc(var(--w)*36px)}}.mss td .bar{width:calc(var(--w)*60px);display:inline-block;height:8px;background:#ee9a52;border-radius:0 3px 3px 0;vertical-align:middle;margin-right:6px}`;
let styled=false;function style(){if(styled)return;styled=true;const s=document.createElement('style');s.textContent=CSS;document.head.appendChild(s);}
const fm=t=>Math.floor(t/60)%24+':'+String(Math.floor(t%60)).padStart(2,'0');
const KINDN={wd:'平日',sat:'土曜',hol:'日曜祝日'};
/* ---------- 地図 ---------- */
function mapSvg(MAP,tot,col,lab,sel){const F=MAP.fx;let s=`<svg viewBox="24 50 952 420" role="img" aria-label="店の中の地図（棚ごとの売れた数）"><rect x="30" y="70" width="940" height="386" rx="8" fill="var(--paper)" stroke="var(--line2)"/>`;
  const R=k=>{const f=F[k];return f?[f[0],f[1],f[2],Math.max(18,f[3])]:null;};
  {const c=F.counter;if(c)s+=`<rect x="${c[0]}" y="${c[1]}" width="${c[2]}" height="${c[3]}" rx="4" fill="#cfc4b4"/><text x="${c[0]+40}" y="${c[1]+21}" class="ml" style="fill:#fff;font-size:12px">有人レジ</text>`;
    const sf=F.self;if(sf)s+=`<rect x="${sf[0]}" y="${sf[1]}" width="${sf[2]}" height="${sf[3]}" rx="4" fill="#3a4148"/>`;}
  const zs=C.ZONES.map(z=>z[0]).filter(z=>R(z));
  for(const z of zs){const [x,y,w,h]=R(z);s+=`<rect class="z" data-z="${z}" x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="${col[z]||'#efe6d8'}" stroke="${z===sel?'#22313a':'#a89880'}" stroke-width="${z===sel?3.5:1.5}"><title>${esc(C.NAME[z])}：${tot[z]||0}個</title></rect>`;}
  const big=Math.max(1,...zs.map(z=>tot[z]||0));
  for(const z of zs){const v=tot[z]||0;if(!v)continue;const [x,y,w,h]=R(z),cx=x+w/2,cy=y+h/2,r=10+15*Math.sqrt(v/big);
    s+=`<g style="pointer-events:none"><circle cx="${cx}" cy="${cy}" r="${r.toFixed(0)}" fill="#fffaf2" stroke="#3b2a1c" stroke-width="2"/><text x="${cx}" y="${cy+5}" text-anchor="middle" class="bn" style="font-size:${(12+6*Math.sqrt(v/big)).toFixed(0)}px">${lab[z]}</text></g>`;
    if(['fridge','shelf','dry','omiyage','regfront','tobacco'].includes(z))s+=`<text x="${cx}" y="${z==='regfront'?y+h+17:y-7}" text-anchor="middle" class="ml">${esc(C.NAME[z])}</text>`;}
  return s+`<text x="140" y="452" class="ml" style="fill:#2f8a5b">入口 ↑</text><text x="710" y="452" class="ml" style="fill:#b23a2e">出口 ↓</text></svg>`;}
/* ---------- 描く（時刻の「分」が変わったとき・タブを変えたときだけ書きかえる） ---------- */
function render(el,ctx){if(!el)return;style();const {res,Tn,cfg,layout,MAP}=ctx;if(!res||!cfg||!MAP)return;
  const D=days(),k=[res.day,Math.floor(Tn),UI.tab,UI.cmp,UI.sel,D.length,D.length&&D.at(-1).day,res.ev.length].join('|');
  if(el.dataset.mss===k&&el.firstChild)return;el.dataset.mss=k;
  const O0=cfg.open[0],O1=cfg.open[1],H0=Math.floor(O0),Hn=Math.min(Math.floor(Math.min(Tn,O1*60-1)/60),Math.ceil(O1)-1);
  if(Tn<O0*60){el.innerHTML=`<div class="ks-card mss"><h3>きょう売れたもの</h3><p class="nt">開店（${O0}:00）から、棚ごと・時間ごとに売れた数を出します。</p></div>`;return;}
  const T=Math.min(Tn,O1*60),S=C.soFar(res,cfg,layout,T),hours=[];for(let h=H0;h<=Hn;h++)hours.push(h);
  const kind=res.cond&&res.cond.day||'wd',bu=C.base(D,{mode:'usual',day:res.day,kind,n:4,min:2}),by=C.base(D,{mode:'yday',day:res.day});
  const B=UI.tab==='cmp'?(UI.cmp==='yday'?by:bu):bu,cmp=UI.tab==='cmp'&&!!B;
  const zs=C.ZONES.map(z=>z[0]).filter(z=>S.g[z]||(B&&B.g[z]));
  const tot={},ut={};for(const z of zs){tot[z]=0;ut[z]=0;for(const h of hours){tot[z]+=(S.g[z]&&S.g[z][h])||0;if(B)ut[z]+=C.upTo(B.g,z,h,T);}}
  zs.sort((a,b)=>(tot[b]-tot[a])||(ut[b]-ut[a]));
  const best=zs[0],sel=UI.sel&&zs.includes(UI.sel)?UI.sel:best;
  const UT=B?zs.reduce((s,z)=>s+ut[z],0):0,dp=UT>0?(S.total-UT)/UT*100:0;
  // 上の数字
  let kp=`<div class="k"><div><small>${fm(O0*60)}〜いままでに売れた</small><b>${num(S.total)}<u>個</u></b>${bu&&UI.tab!=='cmp'||cmp?`<p class="${Math.abs(dp)<5?'eqc':dp>0?'up':'dn'}">${cmp&&UI.cmp==='yday'?'きのう':'いつも'}より ${sgn(dp)}%（${cmp&&UI.cmp==='yday'?'きのう':'いつも'}は今ごろ${num(UT)}個）</p>`:''}</div>
    <div><small>お客さん（会計）</small><b>${num(S.n)}<u>人</u></b></div><div><small>売上</small><b>${num(S.yen)}<u>円</u></b></div>
    ${best?`<div><small>いちばん売れた棚</small><b style="font-size:16px">${esc(C.NAME[best])} ${num(tot[best])}個</b></div>`:''}</div>`;
  // 地図
  const col={},lab={},mx=Math.max(1,...zs.map(z=>tot[z]));
  for(const z of zs){if(cmp){col[z]=jc(C.judge(tot[z],ut[z]));lab[z]=sgn(tot[z]-ut[z]);}else{col[z]=shade(tot[z],mx);lab[z]=num(tot[z]);}}
  const top=Object.entries(S.items[sel]||{}).sort((a,b)=>b[1]-a[1]).slice(0,5),P={};for(const p of cfg.products)P[p.id]=p;
  const leg=cmp?`少ない<i style="background:${DN[3]}"></i><i style="background:${DN[1]}"></i><i style="background:${MID}"></i><i style="background:${UP[1]}"></i><i style="background:${UP[3]}"></i>多い（${UI.cmp==='yday'?'きのう':'いつも'}と比べて）`
    :`少ない<i style="background:${RAMP[1]}"></i><i style="background:${RAMP[3]}"></i><i style="background:${RAMP[5]}"></i><i style="background:${RAMP[6]}"></i>多い　棚を押すと、その棚の品`;
  const mapBox=`<div class="bx"><h4>店の中の地図<small>${cmp?'色：多い（オレンジ）・少ない（青）・同じくらい（灰）。丸は差（個）':'色が濃いほど売れた・丸は個数'}</small></h4>${mapSvg(MAP,tot,col,lab,sel)}<div class="lg">${leg}</div>
    ${sel?`<div class="pk"><b>${esc(C.NAME[sel])}でよく売れた品（いままで）</b><ul>${top.length?top.map(([pid,q],i)=>`<li><span class="rk">${i+1}</span>${esc(P[pid]?P[pid].name:pid)}<em>${q}個</em></li>`).join(''):'<li>まだ売れていません</li>'}</ul></div>`:''}</div>`;
  // 右：表 か 品の一覧
  let right='';
  if(UI.tab==='trip'){const RT={},PN={},GN={};for(const x of (cfg.walk&&cfg.walk.trip&&cfg.walk.trip.routes)||[])RT[x.id]=x;for(const p of cfg.personas)PN[p.id]=p.name;for(const g0 of cfg.genres)GN[g0.id]=g0.name;
    const T2={};for(const e of res.ev){if(e.t>T)break;if(e.k!=='buy'||!e.trip||!RT[e.trip])continue;const o=T2[e.trip]||(T2[e.trip]={n:0,q:0,g:{},ps:{}});o.n++;o.ps[e.ps]=(o.ps[e.ps]||0)+1;
      for(const [pid,q] of e.items){o.q+=q;const ge=P[pid]?P[pid].genre:'';o.g[ge]=(o.g[ge]||0)+q;}}
    const L=Object.entries(T2).sort((a,b)=>b[1].n-a[1].n),m=L.length?L[0][1].n:1;
    right=`<div class="bx"><h4>どこから来て、どこへ行く人か<small>${fm(O0*60)}〜${fm(T)}・会計した人</small></h4>${L.length?`<div class="sc" style="max-height:470px;overflow-y:auto"><table><tr><th>どこから → どこへ</th><th class="hz">客層</th><th class="r">人</th><th>よく買ったもの</th></tr>
      ${L.map(([id,o])=>{const x=RT[id],gs=Object.entries(o.g).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([g0])=>esc(GN[g0]||g0)).join('・');
        return `<tr><td><b>${esc(x.from)} → ${esc(x.to)}</b><br><small style="color:var(--muted)">${esc(x.why)}</small></td><td class="hz">${Object.keys(o.ps).map(k=>esc(PN[k]||k)).join('・')}</td><td class="r"><span class="bar" style="--w:${(o.n/m).toFixed(3)}"></span>${o.n}</td><td>${gs}</td></tr>`;}).join('')}</table></div>`
      :'<p class="nt">まだ会計した人がいません。</p>'}<p class="nt">お客さんは、客層とその時台に合う「道」を1つ持っています（すべて仮の数字）。道によって、ほしい物と店にいる時間が変わります。</p></div>`;}
  else if(UI.tab==='list'){const L=[];for(const z in S.items)for(const pid in S.items[z])L.push([pid,z,S.items[z][pid]]);L.sort((a,b)=>b[2]-a[2]);const m=L.length?L[0][2]:1;
    right=`<div class="bx"><h4>品の一覧<small>${fm(O0*60)}〜${fm(T)}・${L.length}品</small></h4><div class="sc" style="max-height:430px;overflow-y:auto"><table><tr><th>品</th><th class="hz">棚</th><th class="r">個</th><th class="r">売上</th></tr>
      ${L.map(([pid,z,q])=>`<tr><td>${esc(P[pid]?P[pid].name:pid)}</td><td class="hz">${esc(C.NAME[z])}</td><td class="r"><span class="bar" style="--w:${Math.max(0.04,q/m).toFixed(3)}"></span>${q}</td><td class="r">${num(q*((ctx.price&&ctx.price[pid])||(P[pid]?P[pid].price||0:0)))}円</td></tr>`).join('')}</table></div>
      <p class="nt">売上は値札の値段で数えた目安です（値引きは入りません）。</p></div>`;}
  else{const N=hours.length,cw=cmp?40:34,lw=innerWidth<760?80:104,cols=`${lw}px repeat(${N},minmax(${cw}px,1fr)) 100px`,mn=lw+N*(cw+3)+104;
    const cellMax=Math.max(1,...zs.flatMap(z=>hours.map(h=>(S.g[z]&&S.g[z][h])||0)));
    let g=`<div class="l s"></div>${hours.map(h=>`<div class="hh${h===Hn?' now':''}">${h}時</div>`).join('')}<div class="hh">合計${B?'<br><small>｜＝'+(UI.tab==='cmp'&&UI.cmp==='yday'?'きのう':'いつも')+'</small>':''}</div>`;
    const tmax=Math.max(1,...zs.map(z=>Math.max(tot[z],ut[z])));
    for(const z of zs){g+=`<div class="l" data-z="${z}" title="押すと、この棚の品">${esc(C.NAME[z])}</div>`;
      for(const h of hours){const v=(S.g[z]&&S.g[z][h])||0,now=h===Hn?' now':'';
        if(cmp){const u=C.upTo(B.g,z,h,T);if(!v&&u<0.5){g+=`<div class="c e${now}">·</div>`;continue;}const c=jc(C.judge(v,u));g+=`<div class="c${now}" style="background:${c};color:${inkOf(c)}" title="${h}時台 ${v}個（${UI.cmp==='yday'?'きのう':'いつも'} ${u.toFixed(1)}個）">${v}<small>${sgn(v-u)}</small></div>`;}
        else{const c=shade(v,cellMax);g+=v?`<div class="c${now}" style="background:${c};color:${inkOf(c)}" title="${h}時台 ${v}個">${v}</div>`:`<div class="c e${now}">·</div>`;}}
      let tag='';if(B){const d=tot[z]-ut[z],j=Math.abs(d)/Math.sqrt(ut[z]+1);tag=j>=1.5?`<em class="${d>0?'up':'dn'}">${d>0?'多め':'少なめ'}</em>`:'<em class="eqc">ふつう</em>';}
      g+=`<div class="t"><div class="tb"><i style="width:${(tot[z]/tmax*100).toFixed(0)}%"></i>${B?`<s style="left:${(ut[z]/tmax*100).toFixed(0)}%"></s>`:''}</div><b>${tot[z]}</b>${tag}</div>`;}
    const ch={},uh={};for(const h of hours){ch[h]=zs.reduce((s,z)=>s+((S.g[z]&&S.g[z][h])||0),0);uh[h]=B?zs.reduce((s,z)=>s+C.upTo(B.g,z,h,T),0):0;}const cm=Math.max(1,...hours.map(h=>Math.max(ch[h],uh[h])));
    g+=`<div class="l s">店ぜんぶ</div>${hours.map(h=>`<div class="cb${h===Hn?' now':''}"><span>${ch[h]}</span><div>${B?`<s style="height:${(uh[h]/cm*44).toFixed(0)}px"></s>`:''}<i style="height:${(ch[h]/cm*44).toFixed(0)}px"></i></div></div>`).join('')}<div></div>`;
    const ttl=UI.tab==='cmp'?`${UI.cmp==='yday'?'きのうと比べる':'いつもと比べる'}<small>${B?(UI.cmp==='yday'?'きのう（運行日'+B.days[0]+'）の同じ時刻まで':'いつも＝最近'+B.n+'回の'+(KINDN[kind]||'')+'の、同じ時刻までの平均'):''}</small>`:`棚ごと・時間ごとに売れた数<small>${Hn}時台は途中（点線）</small>`;
    const seg=UI.tab==='cmp'?`<div class="seg"><button data-c="usual" class="${UI.cmp==='usual'?'on':''}">いつも</button><button data-c="yday" class="${UI.cmp==='yday'?'on':''}">きのう</button></div>`:'';
    const none=UI.tab==='cmp'&&!B?`<p class="nt">${UI.cmp==='yday'?'きのうの記録がまだありません（閉店のあとに1日ずつ残ります）。':'同じ型の日（'+(KINDN[kind]||'')+'）の記録が2日たまると、いつもと比べられます。'}</p>`:'';
    right=`<div class="bx"><h4>${ttl}</h4>${seg}${none}<div class="sc"><div class="hm" style="grid-template-columns:${cols};min-width:${mn}px">${g}</div></div>
      <p class="nt">${B?'いちばん下の点線の枠と、合計の縦の線は「'+(UI.tab==='cmp'&&UI.cmp==='yday'?'きのう':'いつも')+'の同じ時刻まで」。':''}ホット・たばこ・ホット飲料はレジで受け取る品。数は計算で売れた個数（見て帰った人・売り切れで買えなかった人は入らない）。</p></div>`;}
  const tabs=[['grid','棚 × 時間'],['list','品の一覧'],['trip','どこへ行く人'],['cmp','いつもと比べる']].map(([t,n])=>`<button data-t="${t}" class="${UI.tab===t?'on':''}">${n}</button>`).join('');
  el.innerHTML=`<div class="ks-card mss"><h3>きょう売れたもの <span style="font-weight:400;font-size:12px;color:var(--muted)">${fm(T)}まで</span><span class="tabs">${tabs}</span></h3>${kp}<div class="g2">${mapBox}${right}</div></div>`;
  const re=()=>{el.dataset.mss='';render(el,ctx);};
  el.querySelectorAll('[data-t]').forEach(b=>b.onclick=()=>{UI.tab=b.dataset.t;re();});
  el.querySelectorAll('[data-c]').forEach(b=>b.onclick=()=>{UI.cmp=b.dataset.c;re();});
  el.querySelectorAll('[data-z]').forEach(b=>b.onclick=()=>{UI.sel=b.dataset.z;re();});
  {const sc=el.querySelector('.sc'),kk=UI.tab+'|'+hours.length;if(sc&&UI.tab!=='list'){if(UI.scK!==kk){UI.scK=kk;UI.scL=sc.scrollWidth;}sc.scrollLeft=UI.scL;sc.onscroll=()=>{UI.scL=sc.scrollLeft;};}}}   // 表は、いまの時間が見えるように右へ（時間が増えたときだけ。動かした場所は覚えておく）
window.MinatoSalesView={render,record,get days(){return days();},KEY};
})();
