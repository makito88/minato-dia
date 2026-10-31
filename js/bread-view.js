/* =====================================================================
   おにぎり工場（試作）のパンのラインの画面
   ・上の「米のライン｜パンのライン」で切り替える（米のラインの画面はそのまま）。
   ・夕方の条件 → BreadCore.simulate で一晩を先に計算し、時刻に合わせて再生して描く。
   ・絵：仕込み → 一次発酵の箱 → 分割・ベンチ → 成形（人）→ ホイロの台車 → オーブン・フライヤー → 粗熱取りの台 → 包装。
     生地の箱は、発酵の進みに合わせてふくらむ。
   ・保存はブラウザの dia-factory-bread（条件と、前の夜の要約だけ）。
   ===================================================================== */
(function(){
'use strict';
const BC=window.BreadCore,BS=BC.BS,hm=BC.hm;
const $=id=>document.getElementById(id);
const KEY='dia-factory-bread',TAB='dia-factory-tab';
let D=null,B=null,cfg=null,R=null,prev=null,cur=0,playing=false,speed=300,selected=null,lastFrame=0,hits=[],resultShown=false,active=false,lastSide=-1,evCount=-1;
const SPEEDS=[[1,'×1'],[60,'×60'],[300,'×300'],[900,'×900']];
const ST_COLOR={1:'#7fb0de',2:'#e0a84a',3:'#b9a27a',4:'#c9b48a',5:'#9b7cc0',6:'#5d7896',7:'#c23b3b',8:'#d9822b',9:'#c23b3b',10:'#a8562b',11:'#5aa0a8',12:'#9b7cc0',13:'#2e7d4f',14:'#9aa6b1'};

function load(){try{return JSON.parse(localStorage.getItem(KEY)||'null')||{};}catch(e){return {};}}
function save(){try{localStorage.setItem(KEY,JSON.stringify({cfg,prev}));}catch(e){}}
function css(v){return getComputedStyle(document.documentElement).getPropertyValue(v).trim()||'#888';}
const yen=n=>n==null?'—':n.toLocaleString()+'円';
const P=id=>B.products.find(p=>p.id===id);
function tempColor(T){const stops=[[8,[70,120,200]],[20,[80,170,190]],[30,[120,190,120]],[40,[230,190,70]],[60,[235,140,60]],[96,[205,60,50]]];
  if(T<=stops[0][0])return rgb(stops[0][1]);for(let i=1;i<stops.length;i++){if(T<=stops[i][0]){const a=stops[i-1],b=stops[i],u=(T-a[0])/(b[0]-a[0]);return rgb(a[1].map((x,j)=>x+(b[1][j]-x)*u));}}return rgb(stops[stops.length-1][1]);}
function rgb(c){return `rgb(${c.map(x=>Math.round(x)).join(',')})`;}
/* 発酵の進みの色：足りない＝青、ちょうど＝緑、進みすぎ＝黄、しぼむ＝赤 */
function pColor(p,stage){const Q=B.quality;const lo=stage===1?Q.p1Low:Q.p2Low,hi=stage===1?Q.p1High:Q.p2High;
  if(stage===2&&p>Q.collapse)return css('--bad');if(p>hi)return css('--warn');if(p>=lo)return css('--ok');return css('--water2');}

/* ---------------- 切り替え ---------------- */
function buildTabs(){const tabs=$('lineTabs');if(!tabs)return;
  // 米・パン・サンドイッチの3つ。切り替えたら factory-tab の知らせを出す（サンドイッチの画面が聞く）
  const PANEL={rice:'riceView',bread:'breadView',sand:'sandView'};
  const NAME={rice:D.line,bread:B.line,sand:D.sand?D.sand.line:''};
  const set=v=>{if(!PANEL[v]||!$(PANEL[v]))v='rice';active=v==='bread';
    for(const k in PANEL){const el=$(PANEL[k]);if(el)el.hidden=k!==v;}
    for(const b of tabs.children){const on=b.dataset.v===v;b.classList.toggle('on',on);b.setAttribute('aria-selected',on);}
    $('lineName').textContent=NAME[v];
    try{localStorage.setItem(TAB,v);}catch(e){}
    window.dispatchEvent(new CustomEvent('factory-tab',{detail:v}));
    if(active){if(!R)run(false);else drawAll(true);}else if(v==='rice')window.dispatchEvent(new Event('resize'));};
  for(const b of tabs.children)b.onclick=()=>set(b.dataset.v);
  let v='rice';try{v=localStorage.getItem(TAB)||'rice';}catch(e){}
  if(location.hash==='#bread'||location.hash==='#sand')v=location.hash.slice(1);
  set(v);}

/* ---------------- 夕方に決める ---------------- */
function buildPlan(){
  const g=B.ranges;
  const seasonOpts=Object.entries(D.seasons).map(([k,s])=>`<option value="${k}">${s.label}</option>`).join('');
  const startOpts=[];for(let t=g.start[0];t<=g.start[1];t+=15)startOpts.push(`<option value="${t}">${hm(t)}</option>`);
  const pT=[];for(let T=g.proofT[0];T<=g.proofT[1];T+=2)pT.push(`<option value="${T}">${T}℃</option>`);
  const seg=(id,arr)=>`<div class="seg" id="${id}" role="group">${arr.map(([v,l])=>`<button data-v="${v}">${l}</button>`).join('')}</div>`;
  $('bplan').innerHTML=`
  <div><label for="bseason">季節</label><select id="bseason">${seasonOpts}</select><div class="hint" id="bseasonHint"></div></div>
  <div><label for="bstart">仕込みを始める時刻</label><select id="bstart">${startOpts.join('')}</select><div class="hint">パンは2日もつので、米より早く始めてもよい。注文は${hm(D.orderConfirm)}に届く</div></div>
  <div><label for="binterval">仕込みの間隔（ミキサーが次をこねるまで）</label><input type="range" id="binterval" min="${g.interval[0]}" max="${g.interval[1]}" step="5" style="width:100%"><div class="val"><span class="num" id="bintervalVal"></span>分 <span class="hint" id="bflowHint"></span></div></div>
  <div><label>オーブンの台数（1台に1回${B.oven.cap}個）</label>${seg('bovens',[[1,'1台'],[2,'2台'],[3,'3台']])}<div class="hint" id="bovenHint"></div></div>
  <div><label for="bknead">こね上げの温度</label><input type="range" id="bknead" min="${g.knead[0]}" max="${g.knead[1]}" step="1" style="width:100%"><div class="val"><span class="num" id="bkneadVal"></span>℃ <span class="hint" id="bwaterHint"></span></div></div>
  <div><label>酵母の量</label>${seg('byeast',Object.entries(B.yeast).filter(([k])=>k[0]!=='_').map(([k,y])=>[k,y.label]))}<div class="hint" id="byeastHint"></div></div>
  <div><label for="bferm1">一次発酵の時間（発酵室${B.ferm.room}℃）</label><input type="range" id="bferm1" min="${g.ferm1[0]}" max="${g.ferm1[1]}" step="5" style="width:100%"><div class="val"><span class="num" id="bferm1Val"></span>分 <span class="hint" id="bferm1Hint"></span></div></div>
  <div><label for="bproofT">ホイロ（二次発酵）の温度と時間</label><div class="row"><select id="bproofT">${pT.join('')}</select><input type="range" id="bproof" min="${g.proof[0]}" max="${g.proof[1]}" step="5" style="flex:1"></div><div class="val"><span class="num" id="bproofVal"></span>分 <span class="hint" id="bproofHint"></span></div></div>
  <div><label>成形の人数（人の手で包む・のせる）</label>${seg('bshapers',[2,3,4,5,6].map(n=>[n,n+'人']))}<div class="hint" id="bshapeHint"></div></div>`;
  const sync=()=>{const S=D.seasons[cfg.season];
    $('bseason').value=cfg.season;$('bstart').value=cfg.start;$('binterval').value=cfg.interval;$('bknead').value=cfg.knead;$('bferm1').value=cfg.ferm1;$('bproofT').value=cfg.proofT;$('bproof').value=cfg.proof;
    $('bseasonHint').textContent=`部屋${S.room}℃（成形・ベンチ・粗熱取りの部屋）。${S.room>=25?'生地が部屋で温まって進みやすく、パンが冷めにくい':S.room<=14?'生地が部屋で冷えて進みにくい。仕込み水を温かく':'ちょうどよい季節'}`;
    const f=BC.flow(D,cfg);$('bintervalVal').textContent=cfg.interval;
    $('bflowHint').textContent=`1時間に${f.mixPerHour.toFixed(1)}回こねる。オーブン${cfg.ovens}台は1時間に${f.ovenPerHour.toFixed(1)}回分焼ける${f.mixPerHour>f.ovenPerHour*1.02?'→ ホイロに生地がたまる':''}`;
    $('bflowHint').style.color=f.mixPerHour>f.ovenPerHour*1.02?css('--warn'):'';
    mark('bovens',cfg.ovens);$('bovenHint').textContent=`200個の生地は2回に分けて焼く（1回${B.products[0].min}分ほど＋入れ出し${B.oven.load}分）。1台 ${yen(B.oven.cost)}／夜＋ガス代。カレーパンはフライヤーで揚げる`;
    const w=BC.waterFor(B,cfg.knead,S.room);$('bkneadVal').textContent=cfg.knead;
    $('bwaterHint').textContent=`仕込み水 ${Math.round(w)}℃（${cfg.knead}×3 −（粉${S.room}＋部屋${S.room}＋摩擦${B.mix.friction}））${w>50?'。50℃より熱くはできない':w<1?'。氷水でもここまでは下げられない':''}`;
    mark('byeast',cfg.yeast);const y=B.yeast[cfg.yeast];$('byeastHint').textContent=`発酵の速さ ×${y.f}・1回の仕込みで${yen(y.yen)}`;
    $('bferm1Val').textContent=cfg.ferm1;
    {const r=BC.fermRate(B,cfg.knead)*y.f;const p=cfg.ferm1*r/B.ferm.base1;$('bferm1Hint').textContent=`こね上げのままの温度なら進み ${p.toFixed(2)}（ちょうどよいのは${B.quality.p1Low}〜${B.quality.p1High}）`;}
    $('bproofVal').textContent=cfg.proof;
    {const r=BC.fermRate(B,cfg.proofT)*y.f;$('bproofHint').textContent=`${cfg.proofT}℃では27℃の${BC.fermRate(B,cfg.proofT).toFixed(1)}倍速い。焼く番が来るまで、ホイロの中で膨らみ続ける（ちょうどよいのは焼くときに${B.quality.p2Low}〜${B.quality.p2High}、${B.quality.collapse}をこえるとしぼむ）`;void r;}
    mark('bshapers',cfg.shapers);$('bshapeHint').textContent=`1人1分にメロンパン${P('melon').shape}個・あん／クリーム／カレー${P('an').shape}個・塩バター${P('shio').shape}個。ほかに仕込み・窯・包装の係が${B.cost.fixedStaff}人`;
  };
  const mark=(id,v)=>{for(const b of $(id).children){const on=b.dataset.v===String(v);b.classList.toggle('on',on);b.setAttribute('aria-pressed',on);}};
  $('bseason').onchange=e=>{cfg.season=e.target.value;sync();};
  $('bstart').onchange=e=>{cfg.start=+e.target.value;sync();};
  for(const id of ['interval','knead','ferm1','proof'])$('b'+id).oninput=e=>{cfg[id]=+e.target.value;sync();};
  $('bproofT').onchange=e=>{cfg.proofT=+e.target.value;sync();};
  for(const b of $('bovens').children)b.onclick=()=>{cfg.ovens=+b.dataset.v;sync();};
  for(const b of $('byeast').children)b.onclick=()=>{cfg.yeast=b.dataset.v;sync();};
  for(const b of $('bshapers').children)b.onclick=()=>{cfg.shapers=+b.dataset.v;sync();};
  sync();
}

/* ---------------- 回す・再生 ---------------- */
function run(keepTime){
  if(R)prev={cfg:R.cfg,summary:R.summary};
  R=BC.simulate(D,cfg);resultShown=false;evCount=-1;
  $('bscrub').max=R.N-1;if(!keepTime)cur=0;cur=Math.min(cur,R.N-1);
  if(selected!=null&&!R.batches[selected])selected=null;
  $('bnightInfo').textContent=`夜の番号 ${cfg.seed}（同じ番号なら同じ注文。条件だけ変えて比べられます）`;
  $('bresult').hidden=true;$('bresultWait').hidden=false;save();drawAll(true);
}
function buildPlay(){
  $('bspeeds').innerHTML=SPEEDS.map(([v,l])=>`<button data-v="${v}">${l}</button>`).join('');
  for(const b of $('bspeeds').children)b.onclick=()=>{speed=+b.dataset.v;markSpeed();};markSpeed();
  $('bplayBtn').onclick=()=>{playing=!playing;if(playing&&cur>=R.N-1)cur=0;markPlay();lastFrame=performance.now();};
  $('bscrub').oninput=e=>{cur=+e.target.value;drawAll(true);};
  $('bpeek').onclick=()=>showResult();
}
function markSpeed(){for(const b of $('bspeeds').children){const on=+b.dataset.v===speed;b.classList.toggle('on',on);b.setAttribute('aria-pressed',on);}}
function markPlay(){$('bplayBtn').textContent=playing?'❚❚ 止める':'▶ 再生';$('bplayBtn').setAttribute('aria-label',playing?'止める':'再生');}
function tick(now){
  if(active&&playing&&R){const dt=Math.min(0.25,(now-lastFrame)/1000);cur+=dt*speed/60;if(cur>=R.N-1){cur=R.N-1;playing=false;markPlay();}drawAll(false);}
  lastFrame=now;requestAnimationFrame(tick);}
function drawAll(force){if(!R||!active)return;const i=Math.floor(cur);
  if(force){const ln=$('lineName');if(ln&&ln.textContent!==B.line)ln.textContent=B.line;}
  $('bscrub').value=i;$('bclock').textContent=hm(R.T0+i);drawStage();
  if(force||i!==lastSide){lastSide=i;drawClocks(i);drawEvents(i);drawGantt();drawBatch();if(i>=R.N-1&&!resultShown)showResult();}}

/* ---------------- 4つの時計 ---------------- */
function drawClocks(i){const S=R.season,a=R.agg;
  const live=R.batches.filter(b=>b.hs[i]===BS.PROOF||b.hs[i]===BS.OQ);const top=live.reduce((m,b)=>b.hp[i]>m.p?{p:b.hp[i],b}:m,{p:0,b:null});
  const shapingB=R.batches.find(b=>b.hs[i]===BS.SHAPE);
  const cool=R.batches.filter(b=>b.hs[i]===BS.COOL);const coolMax=cool.reduce((m,b)=>Math.max(m,b.hT[i]),0);
  $('bclocks').innerHTML=`
   <div class="clk"><b>発酵の時計</b><span class="v">${top.b?`いちばん進んだ ${P(top.b.prod).name}：<span class="num" style="color:${pColor(top.p,2)}">${top.p.toFixed(2)}</span>`:'ホイロに生地はない'}</span><div class="small muted">こね上げ${R.knead.toFixed(1)}℃・ホイロ${R.cfg.proofT}℃・${B.yeast[R.cfg.yeast].label}</div></div>
   <div class="clk"><b>オーブンの時計</b><span class="v">焼いている <span class="num">${a.ovenBusy[i]}</span>／${R.ovens}台</span><div class="small muted">焼く番を待つ台車 <span class="num" style="color:${a.inOQ[i]?css('--bad'):'inherit'}">${a.inOQ[i]}</span>・ホイロ ${a.inProof[i]+a.inOQ[i]}／${B.proof.racks}</div></div>
   <div class="clk"><b>冷めの時計（粗熱取り）</b><span class="v">台 <span class="num">${a.inCool[i]}</span>／${B.cool.racks}</span><div class="small muted">${cool.length?`いちばん熱い ${coolMax.toFixed(0)}℃ → ${B.cool.pack}℃で包む`:`${B.cool.pack}℃まで冷めたら包む`}・部屋${S.room}℃</div></div>
   <div class="clk"><b>人の時計（成形）</b><span class="v"><span class="num">${a.shapeRate[i].toFixed(0)}</span>個／分・${R.cfg.shapers}人</span><div class="small muted">${shapingB?`いま ${P(shapingB.prod).name}`:'成形の台は空き'}・待つ生地 ${R.batches.filter(b=>b.hs[i]===BS.SQ).length}</div></div>`;
}

/* ---------------- 工程の絵 ---------------- */
const TITLES={mix:'仕込み（ミキサー）',ferm:'一次発酵（発酵室の箱）',bench:'分割・丸め → ベンチ',shape:'成形（人の手）',proof:'ホイロ（二次発酵）',oven:'焼成（オーブン・フライヤー）',cool:'粗熱取り',pack:'包装 → 出荷'};
function layout(w){
  if(w<640){const ks=['mix','ferm','bench','shape','proof','oven','cool','pack'];const hs={mix:130,ferm:170,bench:150,shape:205,proof:190,oven:200,cool:170,pack:150};const box={};let y=30;
    for(const k of ks){box[k]=[12,y,376,hs[k]];y+=hs[k]+22;}return {W:400,H:y,box,mobile:true};}
  return {W:1040,H:520,box:{mix:[16,34,140,210],ferm:[172,34,340,210],bench:[528,34,190,210],shape:[734,34,290,210],
    proof:[16,290,330,216],oven:[362,290,340,216],cool:[718,290,180,216],pack:[914,290,110,216]},mobile:false};}
function rr(c,x,y,w,h,r){c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();}
function txt(c,s,x,y,o){o=o||{};c.fillStyle=o.color||css('--ink');c.font=(o.bold?'bold ':'')+(o.size||12)+'px '+(o.num?css('--f-num'):css('--f-body'));c.textAlign=o.align||'left';c.textBaseline='alphabetic';c.fillText(s,x,y);c.textAlign='left';}
function hit(x,y,w,h,b){hits.push([x,y,w,h,b]);}
function selRing(c,x,y,w,h,b){if(selected===b.id){c.strokeStyle=css('--focus');c.lineWidth=3;rr(c,x-3,y-3,w+6,h+6,6);c.stroke();c.lineWidth=1;}}
function frame(c,[x,y,w,h],title){c.fillStyle=css('--paper');c.strokeStyle=css('--line');c.lineWidth=1;rr(c,x,y,w,h,8);c.fill();c.stroke();txt(c,title,x+8,y+19,{bold:true,size:13});}
function person(c,x,y,col){c.fillStyle=col;c.beginPath();c.arc(x,y,4.5,0,7);c.fill();rr(c,x-5,y+6,10,10,3);c.fill();}
const inSt=(i,...ss)=>R.batches.filter(b=>ss.includes(b.hs[i]));
const short=b=>P(b.prod).name.replace('パン','').replace('バター','')||P(b.prod).name;
/* 生地の箱：進みに合わせて生地がふくらむ */
function tub(c,x,y,w,h,b,i,stage){const p=b.hp[i];
  c.strokeStyle=css('--steel');c.fillStyle=css('--sheet');c.lineWidth=1.5;rr(c,x,y,w,h,4);c.fill();c.stroke();c.lineWidth=1;
  const fill=Math.min(1,0.25+0.5*p/(stage===1?B.quality.p1High:B.quality.p2High));const dh=(h-18)*fill;
  c.fillStyle='#e9d6a8';c.beginPath();c.moveTo(x+3,y+h-3);c.lineTo(x+3,y+h-3-dh+6);c.quadraticCurveTo(x+w/2,y+h-3-dh-6,x+w-3,y+h-3-dh+6);c.lineTo(x+w-3,y+h-3);c.closePath();c.fill();
  c.fillStyle=P(b.prod).color;c.fillRect(x+3,y+3,w-6,4);
  txt(c,short(b),x+w/2,y+h-20,{align:'center',size:10.5,bold:true,color:'#3a2c18'});
  txt(c,p.toFixed(2),x+w/2,y+h-7,{align:'center',size:10,num:true,color:pColor(p,stage)==css('--ok')?'#2e5a3a':pColor(p,stage)});
  hit(x,y,w,h,b);selRing(c,x,y,w,h,b);}
function drawStage(){
  const cv=$('bstage');const cw=cv.clientWidth||cv.parentNode.clientWidth;if(!cw)return;const L=layout(cw);
  const dpr=window.devicePixelRatio||1,scale=cw/L.W;const nW=Math.round(cw*dpr),nH=Math.round(L.H*scale*dpr);
  if(cv.width!==nW||cv.height!==nH){cv.width=nW;cv.height=nH;cv.style.height=(L.H*scale)+'px';}
  const c=cv.getContext('2d');c.setTransform(dpr*scale,0,0,dpr*scale,0,0);c.clearRect(0,0,L.W,L.H);hits=[];
  const i=Math.floor(cur),t=R.T0+cur;
  txt(c,`${hm(t)}　${R.season.label}の夜・部屋${R.season.room}℃${t>=D.orderConfirm?`・注文 ${R.summary.order.toLocaleString()}個`:`・見込み ${B.forecast.toLocaleString()}個`}`,8,18,{size:12,color:css('--muted')});
  for(const k in L.box)frame(c,L.box[k],TITLES[k]);
  drawMix(c,L.box.mix,i,t);drawFerm(c,L.box.ferm,i);drawBench(c,L.box.bench,i,t);drawShape(c,L.box.shape,i,t);
  drawProof(c,L.box.proof,i,t);drawOven(c,L.box.oven,i,t);drawCool(c,L.box.cool,i);drawPack(c,L.box.pack,i,t);
}
function drawMix(c,[x,y,w,h],i,t){const b=inSt(i,BS.MIX)[0];const q=inSt(i,BS.WAIT).length;const cx=x+w/2,cy=y+h/2+6,r=Math.min(w,h)/2-30;
  c.fillStyle=css('--steel');c.beginPath();c.arc(cx,cy,r,0,7);c.fill();c.fillStyle=css('--sheet');c.beginPath();c.arc(cx,cy,r-6,0,7);c.fill();
  if(b){c.fillStyle='#e9d6a8';c.beginPath();c.arc(cx,cy,r-12,0,7);c.fill();const a=t*2.4;c.strokeStyle=css('--muted');c.lineWidth=3;c.beginPath();c.moveTo(cx,cy);c.lineTo(cx+Math.cos(a)*(r-14),cy+Math.sin(a)*(r-14));c.stroke();c.lineWidth=1;
    txt(c,short(b),cx,cy+4,{align:'center',bold:true,size:11,color:'#3a2c18'});hit(cx-r,cy-r,2*r,2*r,b);selRing(c,cx-r,cy-r,2*r,2*r,b);
    txt(c,`あと${Math.max(0,Math.ceil(B.mix.min-(t-b.tMix)))}分`,cx,y+h-26,{align:'center',size:10.5,color:css('--muted')});}
  else txt(c,t<R.cfg.start?`${hm(R.cfg.start)}から`:q?'次を待つ':'こね終わり',cx,cy+4,{align:'center',size:11,color:css('--muted')});
  txt(c,`こねる前 ${q}回・${R.cfg.interval}分ごと`,x+8,y+h-9,{size:10.5,color:css('--muted')});}
function drawFerm(c,box,i){const [x,y,w,h]=box;const inF=inSt(i,BS.FERM,BS.DIV).filter(b=>b.hs[i]===BS.FERM);const n=B.ferm.tubs,cols=n,gw=(w-16)/cols;
  for(let k=0;k<n;k++){const tx=x+8+k*gw+3,ty=y+34,tw=gw-6,th=h-64;const b=inF[k];
    if(!b){c.strokeStyle=css('--line');rr(c,tx,ty,tw,th,4);c.stroke();txt(c,'空き',tx+tw/2,ty+th/2,{align:'center',size:10,color:css('--muted')});continue;}
    tub(c,tx,ty,tw,th,b,i,1);const m=R.T0+i-b.tFerm;txt(c,`${m}分`,tx+tw/2,ty-4,{align:'center',size:10,num:true,color:m>R.cfg.ferm1?css('--bad'):css('--muted')});}
  txt(c,`${R.cfg.ferm1}分で分割へ・生地の数字＝一次の進み（${B.quality.p1Low}〜${B.quality.p1High}）`,x+8,y+h-9,{size:10.5,color:css('--muted')});}
function drawBench(c,[x,y,w,h],i,t){const d=inSt(i,BS.DIV)[0];const bs=inSt(i,BS.BENCH);
  txt(c,'分割・丸め',x+8,y+40,{size:11,bold:true});
  if(d){const f=1-Math.max(0,(d.units-(R.T0+i-d.tDiv)*B.divide.rate)/d.units);c.fillStyle=css('--line');c.fillRect(x+80,y+32,w-90,8);c.fillStyle='#e9d6a8';c.fillRect(x+80,y+32,(w-90)*Math.min(1,f),8);
    txt(c,short(d),x+80,y+54,{size:10.5});hit(x+8,y+28,w-16,30,d);selRing(c,x+8,y+28,w-16,30,d);}
  else txt(c,'—',x+80,y+40,{size:11,color:css('--muted')});
  txt(c,`ベンチ（${B.bench.min}分休ませる）`,x+8,y+80,{size:11,bold:true});
  bs.slice(0,3).forEach((b,k)=>{const ty=y+88+k*36;c.fillStyle=css('--sheet');c.strokeStyle=css('--line');rr(c,x+8,ty,w-16,30,4);c.fill();c.stroke();
    for(let q=0;q<8;q++){c.fillStyle='#e9d6a8';c.beginPath();c.arc(x+22+q*((w-60)/8),ty+15,5+2*Math.min(1,b.hp[i]),0,7);c.fill();}
    txt(c,`${short(b)} ${Math.max(0,B.bench.min-(R.T0+i-b.tBench))}分`,x+w-12,ty+19,{align:'right',size:10,color:css('--muted')});hit(x+8,ty,w-16,30,b);selRing(c,x+8,ty,w-16,30,b);});
  if(!bs.length)txt(c,'—',x+12,y+104,{size:11,color:css('--muted')});}
function drawShape(c,[x,y,w,h],i,t){const b=inSt(i,BS.SHAPE)[0];const q=inSt(i,BS.SQ);const n=R.cfg.shapers;
  c.fillStyle=css('--sheet');c.strokeStyle=css('--steel');rr(c,x+12,y+70,w-24,46,6);c.fill();c.stroke();
  for(let k=0;k<n;k++)person(c,x+30+k*((w-60)/Math.max(1,n-1||1)),y+48,'#5d7896');
  if(b){const done=b.units-Math.max(0,b.units-(R.T0+i-b.tShape)*P(b.prod).shape*n);const k=Math.min(14,Math.round(14*done/b.units));
    for(let q2=0;q2<k;q2++){c.fillStyle=P(b.prod).color;c.beginPath();c.arc(x+26+q2*((w-52)/14),y+93,6,0,7);c.fill();}
    txt(c,`${P(b.prod).name} ${Math.round(done)}／${b.units}個`,x+12,y+136,{size:11,bold:true});hit(x+12,y+70,w-24,46,b);selRing(c,x+12,y+70,w-24,46,b);}
  else txt(c,'成形の台は空き',x+w/2,y+98,{align:'center',size:11,color:css('--muted')});
  txt(c,q.length?`待つ生地 ${q.length}（部屋で進み続ける）`:'待つ生地なし',x+12,y+156,{size:10.5,color:q.length?css('--warn'):css('--muted')});
  q.slice(0,4).forEach((b,k)=>{const bx=x+12+k*66,by=y+164;c.fillStyle=css('--sheet');c.strokeStyle=css('--warn');rr(c,bx,by,60,30,4);c.fill();c.stroke();
    txt(c,short(b),bx+30,by+13,{align:'center',size:10,bold:true});txt(c,b.hp[i].toFixed(2),bx+30,by+25,{align:'center',size:9.5,num:true,color:css('--muted')});hit(bx,by,60,30,b);selRing(c,bx,by,60,30,b);});}
function drawProof(c,[x,y,w,h],i,t){const all=inSt(i,BS.PROOF,BS.OQ).sort((a,b)=>a.tProof-b.tProof);const pq=inSt(i,BS.PQ);const n=B.proof.racks,gw=(w-16)/n;
  c.fillStyle=css('--warn');c.globalAlpha=0.07;rr(c,x+4,y+26,w-8,h-56,6);c.fill();c.globalAlpha=1;
  txt(c,`${R.cfg.proofT}℃・${R.cfg.proof}分`,x+w-8,y+19,{align:'right',size:10.5,color:css('--muted')});
  for(let k=0;k<n;k++){const rx=x+8+k*gw+4,ry=y+34,rw=gw-8,rh=h-84;const b=all[k];
    c.strokeStyle=css('--steel');c.lineWidth=1.5;c.strokeRect(rx,ry,rw,rh);c.lineWidth=1;
    for(let s=1;s<5;s++){c.strokeStyle=css('--line');c.beginPath();c.moveTo(rx,ry+s*rh/5);c.lineTo(rx+rw,ry+s*rh/5);c.stroke();}
    if(!b){txt(c,'空き',rx+rw/2,ry+rh/2,{align:'center',size:10,color:css('--muted')});continue;}
    const p=b.hp[i],rad=Math.min(rw/8,3+4*Math.min(1.7,p));
    for(let s=0;s<5;s++)for(let q=0;q<3;q++){c.fillStyle=p>B.quality.collapse?'#cdbb8c':'#e9d6a8';c.beginPath();c.ellipse(rx+rw*(q+0.5)/3,ry+(s+0.75)*rh/5,rad,p>B.quality.collapse?rad*0.45:rad*0.8,0,0,7);c.fill();}
    const oq=b.hs[i]===BS.OQ;if(oq){c.strokeStyle=css('--bad');c.lineWidth=3;c.strokeRect(rx-2,ry-2,rw+4,rh+4);c.lineWidth=1;}
    txt(c,short(b),rx+rw/2,ry+rh+14,{align:'center',size:10.5,bold:true});
    txt(c,oq?`焼く番待ち ${R.T0+i-b.tReady}分`:`${R.T0+i-b.tProof}分`,rx+rw/2,ry+rh+27,{align:'center',size:9.5,color:oq?css('--bad'):css('--muted')});
    txt(c,p.toFixed(2),rx+rw/2,ry-3,{align:'center',size:10,num:true,color:pColor(p,2)});
    hit(rx,ry,rw,rh,b);selRing(c,rx,ry,rw,rh,b);}
  txt(c,pq.length?`入れずに部屋で待つ ${pq.length}`:'',x+8,y+h-6,{size:10.5,color:css('--bad')});}
function drawOven(c,[x,y,w,h],i,t){const bake=inSt(i,BS.BAKE);const nO=R.ovens;const slots=[];for(let k=0;k<nO;k++)slots.push(['oven',k]);slots.push(['fry',0]);
  const gw=(w-16)/slots.length;
  slots.forEach(([kind,k],j)=>{const ox=x+8+j*gw+4,oy=y+40,ow=gw-8,oh=h-90;const b=bake.find(q=>kind==='oven'?q.oven===k:q.oven==='F'+k);
    c.fillStyle=kind==='oven'?'#4a4f57':'#6b5a3a';rr(c,ox,oy,ow,oh,6);c.fill();c.fillStyle='#22262b';rr(c,ox+6,oy+8,ow-12,oh-30,4);c.fill();
    txt(c,kind==='oven'?`オーブン${k+1}`:'フライヤー',ox+ow/2,oy+oh-8,{align:'center',size:10,color:'#e3e9ee'});
    if(!b){txt(c,'空き',ox+ow/2,oy+oh/2-4,{align:'center',size:10,color:'#9aa8b5'});return;}
    const p=P(b.prod),per=p.min+B.oven.load,loads=kind==='oven'?Math.ceil(b.units/B.oven.cap):1,el=R.T0+i-b.tBake,ld=Math.min(loads,Math.floor(el/per)+1),u=Math.min(1,(el%per)/p.min);
    const blocked=el>=loads*per;
    c.fillStyle='#e0782b';c.globalAlpha=blocked?0.15:0.35+0.15*Math.sin(t*4);rr(c,ox+6,oy+8,ow-12,oh-30,4);c.fill();c.globalAlpha=1;
    const col=blocked?[150,95,50]:[233-u*83,214-u*119,168-u*118];
    for(let q=0;q<6;q++){c.fillStyle=rgb(col);c.beginPath();c.ellipse(ox+ow*(q%3+0.5)/3,oy+30+Math.floor(q/3)*(oh-60)/2,Math.min(ow/8,8),5,0,0,7);c.fill();}
    txt(c,short(b),ox+ow/2,oy-6,{align:'center',size:10.5,bold:true});
    txt(c,blocked?'出せない！':kind==='oven'?`${ld}／${loads}回目`:'揚げている',ox+ow/2,oy+oh+14,{align:'center',size:10,color:blocked?css('--bad'):css('--muted'),bold:blocked});
    hit(ox,oy,ow,oh,b);selRing(c,ox,oy,ow,oh,b);});
  txt(c,`入れ出し${B.oven.load}分・1回${B.oven.cap}個`,x+w-8,y+19,{align:'right',size:10,color:css('--muted')});}
function drawCool(c,[x,y,w,h],i){const all=inSt(i,BS.COOL,BS.PACKQ).sort((a,b)=>a.tCool-b.tCool);const n=B.cool.racks,cols=2,rows=Math.ceil(n/cols),gw=(w-16)/cols,gh=(h-60)/rows;
  for(let k=0;k<n;k++){const cx=x+8+(k%cols)*gw+3,cy=y+30+Math.floor(k/cols)*gh+2,cw2=gw-6,ch=gh-6;const b=all[k];
    if(!b){c.strokeStyle=css('--line');rr(c,cx,cy,cw2,ch,4);c.stroke();continue;}
    const T=b.hT[i];c.fillStyle=tempColor(T);rr(c,cx,cy,cw2,ch,4);c.fill();c.fillStyle='rgba(255,255,255,.6)';c.fillRect(cx+3,cy+3,cw2-6,ch-6);
    txt(c,short(b),cx+cw2/2,cy+ch/2-1,{align:'center',size:9.5,bold:true,color:'#18263a'});
    txt(c,b.hs[i]===BS.PACKQ?'冷めた':T.toFixed(0)+'℃',cx+cw2/2,cy+ch/2+10,{align:'center',size:9,num:true,color:'#18263a'});hit(cx,cy,cw2,ch,b);selRing(c,cx,cy,cw2,ch,b);}
  txt(c,`${B.cool.pack}℃で包む`,x+8,y+h-9,{size:10.5,color:css('--muted')});}
function drawPack(c,[x,y,w,h],i,t){const dl=D.deadline,ord=t>=D.orderConfirm?R.summary.order:B.forecast;
  const idx=Math.min(R.N-1,i),dIdx=Math.min(R.N-1,dl-R.T0);const made=Math.floor(t<dl?R.agg.packed[idx]:R.agg.packed[dIdx]);const p=Math.min(1,made/ord);
  const bx=x+12,bw=w-24,by=y+34,bh=h-96;c.strokeStyle=css('--line');c.strokeRect(bx,by,bw,bh);c.fillStyle=css('--ok');c.globalAlpha=0.75;c.fillRect(bx,by+bh*(1-p),bw,bh*p);c.globalAlpha=1;
  const pk=inSt(i,BS.PACK)[0];if(pk){hit(bx,by,bw,bh,pk);selRing(c,bx,by,bw,bh,pk);}
  txt(c,made.toLocaleString(),x+w/2,by+bh+16,{align:'center',num:true,bold:true});txt(c,`／${ord.toLocaleString()}個`,x+w/2,by+bh+30,{align:'center',size:10,color:css('--muted')});
  const left=dl-t;txt(c,left>0?`${hm(dl)}まで ${Math.floor(left/60)}:${String(Math.floor(left%60)).padStart(2,'0')}`:'締め切り後',x+w/2,y+h-8,{align:'center',size:10.5,bold:true,color:left>0&&left<60?css('--warn'):css('--ink')});}

/* ---------------- 生地ごとの帯 ---------------- */
function drawGantt(){const cv=$('bgantt');const cw=cv.clientWidth||1000;if(!cw)return;const bs=R.batches;const rowH=cw<640?9:11,top=18,left=cw<640?58:86,H=top+bs.length*rowH+8;
  const dpr=window.devicePixelRatio||1;if(cv.width!==Math.round(cw*dpr)||cv.height!==Math.round(H*dpr)){cv.width=Math.round(cw*dpr);cv.height=Math.round(H*dpr);cv.style.height=H+'px';}
  const c=cv.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,cw,H);const X=k=>left+(cw-left-6)*k/(R.N-1);
  c.font='10px '+css('--f-num');c.textBaseline='top';
  for(let t=R.T0;t<=R.T1;t+=60){const x=X(t-R.T0);c.fillStyle=css('--muted');if(cw>=640||(t/60)%2===0)c.fillText(hm(t),x-12,2);c.fillStyle=css('--line2');c.fillRect(x,top-2,1,H-top);}
  c.fillStyle=css('--bad');c.fillRect(X(D.deadline-R.T0),top-4,2,H-top);c.fillRect(X(D.orderConfirm-R.T0),top-4,1,H-top);
  bs.forEach((b,r)=>{const y=top+r*rowH;if(selected===b.id){c.fillStyle=css('--line');c.fillRect(0,y-1,cw,rowH);}
    c.fillStyle=css('--muted');c.font=(cw<640?'9px ':'10px ')+css('--f-body');c.textBaseline='middle';c.fillText(`${b.late?'+':''}${b.no} ${cw<640?short(b):P(b.prod).name}`,4,y+rowH/2);
    let s0=null,k0=0;for(let k=0;k<=R.N;k++){const s=k<R.N?b.hs[k]:null;if(s!==s0){if(s0!=null&&s0>0){c.fillStyle=s0===BS.DONE&&b.rank==='×'?css('--bad'):ST_COLOR[s0];
      c.globalAlpha=0.22;c.fillRect(X(k0),y,Math.max(1,X(k)-X(k0)),rowH-2);if(cur>k0){c.globalAlpha=1;c.fillRect(X(k0),y,Math.max(1,X(Math.min(k,cur))-X(k0)),rowH-2);}c.globalAlpha=1;}s0=s;k0=k;}}
    if(b.tCancel!=null){c.fillStyle=css('--muted');c.fillText('取りやめ',X(b.tCancel-R.T0)+4,y+rowH/2);}});
  c.fillStyle=css('--focus');c.fillRect(X(cur)-1,top-4,2,H-top);
  cv.onclick=e=>{const r=cv.getBoundingClientRect();const row=Math.floor((e.clientY-r.top-top)/rowH);if(row>=0&&row<bs.length){selected=bs[row].id;drawAll(true);}};}

/* ---------------- 生地を一つ追いかける ---------------- */
function drawBatch(){const box=$('bbatchBody');if(selected==null||!R.batches[selected]){box.className='muted small';box.innerHTML='絵の中の生地の箱・台車・オーブン、または下の帯の行を押すと、その生地の一晩が出ます。';return;}
  const b=R.batches[selected],i=Math.floor(cur),t=R.T0+i;box.className='';const seen=x=>x!=null&&x<=t;const rows=[];const p=P(b.prod);
  const span=(a,z)=>(z!=null&&z<=t?z:t)-a;
  if(b.tCancel!=null&&b.tMix==null)rows.push([hm(b.tCancel),'注文に合わせて、こねる前に取りやめ']);
  if(seen(b.tMix))rows.push([hm(b.tMix),`仕込み（${B.mix.min}分）・こね上げ${R.knead.toFixed(1)}℃`]);
  if(seen(b.tFerm))rows.push([hm(b.tFerm),`一次発酵 ${span(b.tFerm,b.tDiv)}分`]);
  if(seen(b.tDiv))rows.push([hm(b.tDiv),`分割・丸め（一次の進み ${(b.tBench!=null&&b.tBench<=t?b.hp[b.tDiv-R.T0]:b.hp[i]).toFixed(2)}）`]);
  if(seen(b.tBench))rows.push([hm(b.tBench),`ベンチ ${B.bench.min}分`]);
  if(seen(b.tSQ)&&b.wait.shape>0&&b.tShape!=null&&b.tShape>b.tSQ)rows.push([hm(b.tSQ),`成形の台を待つ ${span(b.tSQ,b.tShape)}分`]);
  if(seen(b.tShape))rows.push([hm(b.tShape),`成形（${R.cfg.shapers}人・1人1分${p.shape}個）`]);
  if(seen(b.tPQ)&&b.tProof!=null&&b.tProof>b.tPQ)rows.push([hm(b.tPQ),`ホイロがいっぱいで部屋で待つ ${span(b.tPQ,b.tProof)}分`]);
  if(seen(b.tProof))rows.push([hm(b.tProof),`ホイロ ${R.cfg.proofT}℃・${R.cfg.proof}分`]);
  if(seen(b.tReady)&&b.tBake!=b.tReady)rows.push([hm(b.tReady),`焼く番を待つ ${span(b.tReady,b.tBake)}分（ホイロの中で膨らみ続ける）`]);
  if(seen(b.tBake))rows.push([hm(b.tBake),`${p.bake==='fry'?'フライヤーで揚げる':`オーブン${b.oven+1}で焼く（${Math.ceil(b.units/B.oven.cap)}回）`}・二次の進み <b>${b.p2Bake.toFixed(2)}</b>`]);
  if(seen(b.tCool))rows.push([hm(b.tCool),`粗熱取り ${span(b.tCool,b.tCooled)}分（${B.cool.pack}℃まで）`]);
  if(seen(b.tPack))rows.push([hm(b.tPack),b.rank==='×'?'不合格で捨てた':`包装（${b.units}個）`]);
  if(seen(b.tDone)&&b.rank!=='×')rows.push([hm(b.tDone),`検品：<b>${b.rank}</b>（${b.score}点）・消費期限 ${b.tExpire>=2880?'翌々日':'翌日'}${hm(b.tExpire)}（${B.expiry?B.expiry.label:'包装から'+B.lifeHours+'時間'}）${b.tDone>=D.deadline?`・${hm(D.deadline)}の締め切りに間に合わない`:''}`]);
  const why=seen(b.tBake)?(b.why.length?`<div class="small" style="margin-top:6px">${b.why.map(w=>`・${w[0]}${w[1]?`（${w[1]}）`:''}`).join('<br>')}</div>`:'<div class="small muted" style="margin-top:6px">減点なし</div>'):'';
  box.innerHTML=`<div class="row" style="justify-content:space-between"><b class="big">${p.name}（生地${b.no}）・${b.units}個${b.late?' <span class="tag">20:00の追加</span>':''}</b>
    <span class="small">いま：<b>${BC.BS_LABEL[b.hs[i]]}</b>${b.hs[i]>0?` ・<span class="num">${b.hT[i].toFixed(1)}℃</span>`:''}</span></div>
    <div class="steps" style="margin-top:6px">${rows.map(r=>`<span class="num">${r[0]}</span><span>${r[1]}</span>`).join('')}</div>${why}
    <canvas id="bbchart" width="500" height="150" aria-label="この生地の温度と発酵の進みの移り変わり"></canvas>
    <div class="legend"><span><i style="background:${css('--warn')}"></i>生地の温度（℃）</span><span><i style="background:${css('--ok')}"></i>発酵の進み（右の目盛り。分割で一次→二次に切り替わる）</span></div>`;
  const cv=$('bbchart');const cw=cv.clientWidth||460,H=150,dpr=window.devicePixelRatio||1;cv.width=cw*dpr;cv.height=H*dpr;cv.style.height=H+'px';
  const c=cv.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);
  const a=b.tMix!=null?b.tMix-R.T0:0,z=Math.max(a+30,Math.min(R.N-1,b.tDone!=null?b.tDone-R.T0+20:R.N-1));
  const X=k=>30+(cw-60)*(k-a)/(z-a),Y=T=>H-18-(H-30)*T/100,G=v=>H-18-(H-30)*v/2;
  c.font='9px '+css('--f-num');for(const T of [0,30,60,90]){c.strokeStyle=css('--line2');c.beginPath();c.moveTo(30,Y(T));c.lineTo(cw-30,Y(T));c.stroke();c.fillStyle=css('--muted');c.fillText(T+'℃',2,Y(T)+3);}
  c.fillStyle=css('--ok');c.globalAlpha=0.1;c.fillRect(30,G(B.quality.p2High),cw-60,G(B.quality.p2Low)-G(B.quality.p2High));c.globalAlpha=1;
  for(const v of [1,B.quality.collapse]){c.fillStyle=v>1?css('--bad'):css('--ok');c.fillText(v.toFixed(1),cw-26,G(v)+3);}
  c.fillStyle=css('--muted');for(let tt=Math.ceil((R.T0+a)/60)*60;tt<=R.T0+z;tt+=60)c.fillText(hm(tt),X(tt-R.T0)-12,H-4);
  const upto=Math.min(z,i);const path=(fn,col,w)=>{c.strokeStyle=col;c.lineWidth=w;c.beginPath();let st=false;for(let k=a;k<=upto;k++){const v=fn(k);if(v==null){st=false;continue;}if(!st){c.moveTo(X(k),v);st=true;}else c.lineTo(X(k),v);}c.stroke();c.lineWidth=1;};
  path(k=>b.hs[k]>BS.MIX?Y(b.hT[k]):null,css('--warn'),2);
  path(k=>b.hs[k]>=BS.FERM&&b.hs[k]<=BS.DIV?G(b.hp[k]):null,css('--ok'),2);
  path(k=>b.hs[k]>BS.DIV&&b.hs[k]<=BS.OQ?G(b.hp[k]):null,css('--ok'),2);
  if(i>=a&&i<=z){c.fillStyle=css('--focus');c.fillRect(X(i)-1,10,2,H-28);}}

/* ---------------- 記録 ---------------- */
function drawEvents(i){const t=R.T0+i;const list=R.ev.filter(e=>e.t<=t);if(list.length===evCount)return;evCount=list.length;
  $('bevents').innerHTML=list.slice().reverse().map(e=>`<li class="${e.k}"${e.b!=null?` data-b="${e.b}" tabindex="0"`:''}><span class="num">${hm(e.t)}</span><span>${e.msg}</span></li>`).join('')||'<li class="muted">まだ何も起きていません。</li>';
  for(const li of $('bevents').querySelectorAll('li[data-b]')){const go=()=>{selected=+li.dataset.b;drawAll(true);};li.onclick=go;li.onkeydown=e=>{if(e.key==='Enter')go();};}}

/* ---------------- 朝の答え合わせ ---------------- */
function showResult(){resultShown=true;const s=R.summary;$('bresultWait').hidden=true;const el=$('bresult');el.hidden=false;
  const p=prev&&prev.summary,pc=prev&&prev.cfg;
  const diff=(a,b,good)=>{if(b==null)return '';const d=a-b;if(!d)return '<span class="muted">±0</span>';const better=good==='up'?d>0:d<0;return `<span class="${better?'up':'down'}">${d>0?'+':''}${d.toLocaleString()}</span>`;};
  const row=(label,a,b,good,fmt)=>`<tr><th>${label}</th><td class="r num">${fmt?fmt(a):a.toLocaleString()}</td>${p?`<td class="r num muted">${b==null?'—':(fmt?fmt(b):b.toLocaleString())}</td><td class="r num">${good?diff(a,b,good):''}</td>`:''}</tr>`;
  const same=p&&pc&&pc.seed===R.cfg.seed&&pc.season===R.cfg.season;const ch=p?changes(pc,R.cfg):[];
  el.innerHTML=`
   <p class="big">注文 <b class="num">${s.order.toLocaleString()}</b>個のうち、<b class="num">${s.shipped.toLocaleString()}</b>個を${hm(D.deadline)}までに包んで${D.ship.via}へ送れました。${s.short?`<span class="down">${s.short.toLocaleString()}個足りません。</span>`:'<span class="up">全部そろいました。</span>'}</p>
   <div class="tw"><table class="fills"><thead><tr><th>パン</th><th class="r">注文</th><th class="r">送れた</th><th class="r">足りない</th><th class="r">捨てた</th></tr></thead><tbody>
   ${s.prods.map(f=>`<tr><th>${f.name}</th><td class="r num">${f.order.toLocaleString()}</td><td class="r num">${f.shipped.toLocaleString()}</td><td class="r num">${f.short?`<span class="down">${f.short.toLocaleString()}</span>`:'<span class="muted">0</span>'}</td><td class="r num">${f.bad?`<span class="down">${f.bad}</span>`:'<span class="muted">0</span>'}</td></tr>`).join('')}
   </tbody></table></div>
   <p class="small">焼くときの二次の進みは <b class="num">${s.p2Min.toFixed(2)}〜${s.p2Max.toFixed(2)}</b>（ちょうどよいのは${B.quality.p2Low}〜${B.quality.p2High}）。品質 ◎${s.ranks['◎']}・○${s.ranks['○']}・△${s.ranks['△']}・×${s.ranks['×']}回${s.unbaked?`・<span class="down">焼けなかった生地 ${s.unbaked}回</span>`:''}。いちばん詰まったところ：<b>${s.neck[1]?s.neck[0]:'特になし'}</b>（生地ごとの待ちの合計 ${s.neck[1].toLocaleString()}分）。</p>
   <p class="small muted">仕込み ${s.mixed}回（見込みでは${s.planned}回）・こね上げ ${s.knead.toFixed(1)}℃（仕込み水 ${Math.round(s.waterUse)}℃）・最初に焼いた ${s.firstBake?hm(s.firstBake):'—'}・最後の包装 ${s.lastDone?hm(s.lastDone):'—'}。売店のパンは2日もつ。${s.expiry?`消費期限は${s.expiry.label}（その夜の製造に決まった期限で、包装が遅れても延びない。最初に包んだ分は期限まで${s.expiry.longest!=null?s.expiry.longest.toFixed(1):'—'}時間、決めたときに確かめた範囲は${s.expiry.maxH}時間まで）`:`消費期限は包装から${B.lifeHours}時間`}。</p>
   ${p?`<p class="small muted">右は前の夜（${same?'同じ夜・同じ注文':'<b>別の夜か季節なので注文が違います</b>'}）。${ch.length?'変えた条件：'+ch.join('、'):'条件は同じ'}</p>`:''}
   <table><thead><tr><th></th><th class="r">この夜</th>${p?'<th class="r">前の夜</th><th class="r">差</th>':''}</tr></thead><tbody>
   ${row('注文',s.order,p&&p.order)}${row('送れた',s.shipped,p&&p.shipped,'up')}${row('足りない',s.short,p&&p.short,'down')}
   ${row('不合格で捨てた',s.bad,p&&p.bad,'down')}${row(`${hm(D.deadline)}に間に合わなかった`,s.late,p&&p.late,'down')}${row('余り',s.surplus,p&&p.surplus,'down')}
   ${row('人件費',s.yen.labor,p&&p.yen.labor,'down',yen)}${row('酵母',s.yen.yeast,p&&p.yen.yeast,'down',yen)}${row('小麦・具・袋',s.yen.other,p&&p.yen.other,'down',yen)}
   ${row('オーブン（台数・ガス）',s.yen.oven,p&&p.yen.oven,'down',yen)}${row('フライヤー',s.yen.fry,p&&p.yen.fry,'down',yen)}${row('送れた1個あたり',s.yen.perUnit||0,p&&p.yen.perUnit,'down',v=>v?v+'円':'—')}
   </tbody></table>
   <p class="note">待ちの内訳：${s.waits.map(w=>`${w[0]} ${w[1].toLocaleString()}分`).join('・')}。費用は仮の目安です。条件を1つだけ変えて「この条件で夜を回す」を押すと、同じ夜（同じ注文）で比べられます。</p>`;
  save();}
function changes(a,b){const out=[];const L={season:'季節',start:'仕込みの開始',interval:'仕込みの間隔',ovens:'オーブン',knead:'こね上げ',yeast:'酵母',ferm1:'一次発酵',proofT:'ホイロの温度',proof:'ホイロの時間',shapers:'成形の人数'};
  const f=(k,v)=>k==='season'?D.seasons[v].label:k==='start'?hm(v):k==='yeast'?B.yeast[v].label:k==='ovens'?v+'台':k==='shapers'?v+'人':k==='knead'||k==='proofT'?v+'℃':v+'分';
  for(const k in L)if(a[k]!==b[k])out.push(`${L[k]} ${f(k,a[k])}→${f(k,b[k])}`);return out;}

function onClick(e){const cv=$('bstage');const r=cv.getBoundingClientRect();const L=layout(cv.clientWidth);const s=L.W/r.width;const x=(e.clientX-r.left)*s,y=(e.clientY-r.top)*s;
  for(let k=hits.length-1;k>=0;k--){const [hx,hy,hw,hh,b]=hits[k];if(x>=hx&&x<=hx+hw&&y>=hy&&y<=hy+hh){selected=b.id;drawAll(true);if(window.innerWidth<760)$('bbatchCard').scrollIntoView({behavior:'smooth',block:'start'});return;}}}
function legends(){
  $('bLegend').innerHTML=`<span><i style="background:${css('--water2')}"></i>発酵が足りない</span><span><i style="background:${css('--ok')}"></i>ちょうどよい</span><span><i style="background:${css('--warn')}"></i>進みすぎ（酸っぱい・形がだれる）</span><span><i style="background:${css('--bad')}"></i>しぼんだ／焼く番を待つ台車</span>`;
  $('bstLegend').innerHTML=[1,2,3,4,5,6,7,8,9,10,11,12,13,14].map(s=>`<span><i style="background:${ST_COLOR[s]}"></i>${BC.BS_LABEL[s]}</span>`).join('')+`<span><i style="background:${css('--bad')}"></i>赤い縦線：20:00 注文確定・${hm(D.deadline)} 包装の締め切り</span>`;}

/* できあがりのイメージ（AIで描いた絵に、品名を重ねる） */
function buildHeroes(){const ph=D.photo;if(!ph)return;
  const nameOf=(line,id)=>{if(line==='bread'){const p=B.products.find(x=>x.id===id);return p?p.name:id;}
    const f=D.packLine.fillings.find(x=>x.id===id);return f?(f.brand?`<b class="nm">${f.brand}</b>`:'')+f.name:id;};
  for(const [line,el] of [['rice','riceHero'],['bread','breadHero']]){const h=ph[line],box=$(el);if(!h||!box)continue;
    box.innerHTML=`<div class="pic"><img src="${h.src}" alt="${h.alt}" loading="lazy">${h.items.map(([id,x,y])=>`<span class="lb" style="left:${x}%;top:${y}%">${nameOf(line,id)}</span>`).join('')}</div><figcaption>${h.caption}。AIで描いたイメージです（品名はあとから重ねた文字）。</figcaption>`;}}
async function init(){if(!$('breadView'))return;
  try{const r=await fetch('data/factory.json',{cache:'no-cache'});D=await r.json();}catch(e){return;}
  B=D.bread;if(!B)return;
  const st=load();let base={};try{base=(JSON.parse(localStorage.getItem('dia-factory')||'null')||{}).cfg||{};}catch(e){}
  cfg=Object.assign({},B.defaults,st.cfg||{season:base.season||B.defaults.season,seed:base.seed||B.defaults.seed});prev=st.prev||null;
  buildHeroes();buildPlan();buildPlay();legends();
  $('brun').onclick=()=>{run(false);playing=true;markPlay();};
  $('bnewNight').onclick=()=>{cfg.seed=(cfg.seed%9999)+1;run(false);};
  $('bstage').addEventListener('click',onClick);
  window.addEventListener('resize',()=>drawAll(true));
  const mq=window.matchMedia('(prefers-color-scheme: dark)');if(mq.addEventListener)mq.addEventListener('change',()=>{legends();drawAll(true);});
  buildTabs();
  requestAnimationFrame(t=>{lastFrame=t;tick(t);});}
init();
})();
