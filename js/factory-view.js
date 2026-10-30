/* =====================================================================
   おにぎり工場（試作）の画面
   ・夕方の条件 → FactoryCore.simulate で一晩を先に計算し、その結果を時刻に合わせて再生して描く。
   ・成形・包装は7つの持ち場（成形機・具入れ・包装機・ラベル・検品・急冷・番重）を1本のベルトで描く
   ・絵（工程の箱）・釜ごとの帯・釜を一つ追いかけるカード・工場の記録・朝の答え合わせ（前の夜と比べる）。
   ・保存はブラウザの dia-factory（条件と、前の夜の結果の要約だけ）。
   ===================================================================== */
(function(){
'use strict';
const F=window.FactoryCore,ST=F.ST,hm=F.hm;
const $=id=>document.getElementById(id);
const KEY='dia-factory';
let D=null,cfg=null,R=null,prev=null,cur=0,playing=false,speed=300,selected=null,lastFrame=0,hits=[],resultShown=false;
const SPEEDS=[[1,'×1'],[60,'×60'],[300,'×300'],[900,'×900']];
const ST_COLOR={1:'#7fb0de',2:'#4f86b8',3:'#d9822b',4:'#e0a84a',5:'#c23b3b',6:'#5aa0a8',7:'#9b7cc0',8:'#2e7d4f',9:'#9aa6b1'};

function load(){try{const s=JSON.parse(localStorage.getItem(KEY)||'null');return s||{};}catch(e){return {};}}
function save(){try{localStorage.setItem(KEY,JSON.stringify({cfg,prev}));}catch(e){}}
function css(v){return getComputedStyle(document.documentElement).getPropertyValue(v).trim()||'#888';}
function tempColor(T){const stops=[[8,[70,120,200]],[20,[80,170,190]],[32,[120,190,120]],[45,[230,190,70]],[60,[235,140,60]],[95,[205,60,50]]];
  if(T<=stops[0][0])return rgb(stops[0][1]);for(let i=1;i<stops.length;i++){if(T<=stops[i][0]){const a=stops[i-1],b=stops[i],u=(T-a[0])/(b[0]-a[0]);return rgb(a[1].map((x,j)=>x+(b[1][j]-x)*u));}}return rgb(stops[stops.length-1][1]);}
function rgb(c){return `rgb(${c.map(x=>Math.round(x)).join(',')})`;}
const yen=n=>n==null?'—':n.toLocaleString()+'円';

/* ---------------- 夕方に決める ---------------- */
function buildPlan(){
  const P=$('plan');const g=D.ranges;
  const seasonOpts=Object.entries(D.seasons).map(([k,s])=>`<option value="${k}">${s.label}</option>`).join('');
  const startOpts=[];for(let t=g.start[0];t<=g.start[1];t+=15)startOpts.push(`<option value="${t}">${hm(t)}</option>`);
  P.innerHTML=`
  <div><label for="season">季節</label><select id="season">${seasonOpts}</select><div class="hint" id="seasonHint"></div></div>
  <div><label for="batches">仕込む釜の数（1釜＝${D.batchUnits}個）</label><input type="number" id="batches" min="${g.batches[0]}" max="${g.batches[1]}" step="1" style="width:80px"> <span class="val num" id="batchesUnits"></span><div class="hint">見込みは${D.forecast.toLocaleString()}個。本当の注文は${hm(D.orderConfirm)}に届く</div></div>
  <div><label for="start">洗米を始める時刻</label><select id="start">${startOpts.join('')}</select><div class="hint">早いほど余裕があるが、注文が分かる前に洗う米がふえる</div></div>
  <div><label for="soak">浸す時間（少なくとも）</label><input type="range" id="soak" min="${g.soak[0]}" max="${g.soak[1]}" step="5" style="width:100%"><div class="val"><span class="num" id="soakVal"></span>分 <span class="hint" id="soakHint"></span></div></div>
  <div><label>冷却の強さ</label><div class="seg" id="fan" role="group" aria-label="冷却の強さ">
    <button data-v="weak">弱</button><button data-v="mid">中</button><button data-v="strong">強</button></div><div class="hint" id="fanHint"></div></div>
  <div><label for="crew">具入れの人数</label><input type="number" id="crew" min="${g.crew[0]}" max="${g.crew[1]}" step="1" style="width:70px"> <span class="hint" id="crewHint"></span></div>
  <div><label>機械の番</label><div class="seg" id="tech" role="group" aria-label="機械の番">
    <button data-v="1">置く</button><button data-v="0">置かない</button></div><div class="hint" id="techHint"></div></div>
  <div><label>具入れの休憩（1人ずつ${D.staff.break.min}分）</label><div class="seg" id="breakAt" role="group" aria-label="休憩の時間帯">
    ${Object.entries(D.staff.break.at).map(([k,v])=>`<button data-v="${k}">${hm(v)}から</button>`).join('')}</div>
    <div class="seg" id="relief" role="group" aria-label="交代の人" style="margin-top:6px"><button data-v="1">交代の人を呼ぶ</button><button data-v="0">呼ばない</button></div><div class="hint" id="breakHint"></div></div>
  <div><label>具の切り替えのときの表示の確認</label><div class="seg" id="labelCheck" role="group" aria-label="表示の確認">
    <button data-v="1">確かめる</button><button data-v="0">省く</button></div><div class="hint" id="labelHint"></div></div>
  <div><label>具を作る順番</label><div class="seg" id="order" role="group" aria-label="具を作る順番">
    <button data-v="light">薄い味から</button><button data-v="big">注文の多い順</button><button data-v="nitta">雫を先に</button></div><div class="hint" id="orderHint"></div></div>`;
  const sync=()=>{
    $('season').value=cfg.season;$('batches').value=cfg.batches;$('start').value=cfg.start;$('soak').value=cfg.soak;$('crew').value=cfg.crew;
    $('batchesUnits').textContent=`＝${(cfg.batches*D.batchUnits).toLocaleString()}個`;
    const S=D.seasons[cfg.season];const need=F.soakNeed(D,S.water);
    $('seasonHint').textContent=`水${S.water}℃・部屋${S.room}℃・冷却の空気${S.coolAir}℃。${S.note}`;
    $('soakVal').textContent=cfg.soak;
    $('soakHint').textContent=cfg.soak<need?`この水温では吸水${Math.round((1-Math.exp(-cfg.soak/F.tau(D,S.water)))*100)}%（芯が残る。目安${need}分）`:cfg.soak>D.soak.crackAfter?`浸しすぎ（${D.soak.crackAfter}分をこえると割れる）`:`吸水${Math.round((1-Math.exp(-cfg.soak/F.tau(D,S.water)))*100)}%（目安${need}分）`;
    for(const b of $('fan').children)b.classList.toggle('on',b.dataset.v===cfg.fan),b.setAttribute('aria-pressed',b.dataset.v===cfg.fan);
    $('fanHint').textContent=`電気代 ${D.cool.yenPerMin[cfg.fan]}円／分（冷やしているあいだ）`;
    $('crewHint').textContent=`手で${D.form.perPerson*cfg.crew}個／分（機械は成形${D.packLine.formMachine}・包装${D.packLine.wrapMachine}個／分まで）`;
    for(const b of $('order').children)b.classList.toggle('on',b.dataset.v===cfg.order),b.setAttribute('aria-pressed',b.dataset.v===cfg.order);
    const SF=D.staff,mark=(id,v)=>{for(const b of $(id).children){const on=b.dataset.v===String(v);b.classList.toggle('on',on);b.setAttribute('aria-pressed',on);}};
    mark('tech',cfg.tech?1:0);mark('breakAt',cfg.breakAt);mark('relief',cfg.relief?1:0);mark('labelCheck',cfg.labelCheck?1:0);
    $('techHint').textContent=cfg.tech?`包装機の詰まりは${SF.tech.jamWith.join('〜')}分で直り、成形機の重さのずれに${SF.drift.detectWith}分で気づく（1人分の時給）`:`詰まりは具入れの人が直しに行くので${SF.tech.jamWithout.join('〜')}分。重さのずれは抜き取りか${SF.drift.detectWithout}分たってから気づく`;
    const bs=SF.break.at[cfg.breakAt],be=bs+SF.break.min*cfg.crew;
    $('breakHint').textContent=`${hm(bs)}〜${hm(be)}に${cfg.crew}人が順に休む。${cfg.relief?'交代の人が入るので手は減らない（そのぶんの時給）':'そのあいだ具入れが1人少ない'}。休んだ人はそのあと2時間半ほど疲れが半分`;
    $('labelHint').textContent=cfg.labelCheck?`切り替えのたびに品質管理が${SF.label.check}分かけて品名・期限・原材料を確かめる`:`切り替えが${SF.label.check}分ずつ早い。ただし${Math.round(SF.label.miss*100)}%の確率でラベルが前の具のまま→見つかるまでの分を貼り直す（卵が表示にないときは捨てる）`;
    const seq=F.fillOrder(D,cfg.order).map(id=>D.packLine.fillings.find(f=>f.id===id));
    let ws=0,wl=0;for(let k=1;k<seq.length;k++){const m=F.washMin(D,seq[k-1].id,seq[k].id);m===D.packLine.wash.up?ws++:wl++;}
    $('orderHint').textContent=`${seq.map(f=>f.name+(f.brand?'〔'+f.brand+'〕':'')).join('→')}。掃除は短い${ws}回・長い${wl}回（注文が増えた具は最後にもう一度）`;
  };
  $('season').onchange=e=>{cfg.season=e.target.value;sync();};
  $('batches').onchange=e=>{cfg.batches=clampInt(e.target.value,g.batches);sync();};
  $('start').onchange=e=>{cfg.start=+e.target.value;sync();};
  $('soak').oninput=e=>{cfg.soak=+e.target.value;sync();};
  $('crew').onchange=e=>{cfg.crew=clampInt(e.target.value,g.crew);sync();};
  for(const b of $('fan').children)b.onclick=()=>{cfg.fan=b.dataset.v;sync();};
  for(const b of $('order').children)b.onclick=()=>{cfg.order=b.dataset.v;sync();};
  for(const b of $('tech').children)b.onclick=()=>{cfg.tech=b.dataset.v==='1';sync();};
  for(const b of $('breakAt').children)b.onclick=()=>{cfg.breakAt=b.dataset.v;sync();};
  for(const b of $('relief').children)b.onclick=()=>{cfg.relief=b.dataset.v==='1';sync();};
  for(const b of $('labelCheck').children)b.onclick=()=>{cfg.labelCheck=b.dataset.v==='1';sync();};
  sync();
}
function clampInt(v,[a,b]){v=Math.round(+v);if(!isFinite(v))v=a;return Math.max(a,Math.min(b,v));}

/* ---------------- 回す ---------------- */
function run(keepTime){
  if(R){prev={cfg:R.cfg,summary:R.summary};}
  R=F.simulate(D,cfg);resultShown=false;
  $('scrub').max=R.N-1;if(!keepTime)cur=0;cur=Math.min(cur,R.N-1);beltM=madeAt(cur);
  if(selected!=null&&!R.batches[selected])selected=null;
  $('nightInfo').textContent=`夜の番号 ${cfg.seed}（同じ番号なら同じ注文。条件だけ変えて比べられます）`;
  $('result').hidden=true;$('resultWait').hidden=false;
  save();drawAll(true);
}

/* ---------------- 再生 ---------------- */
function buildPlay(){
  $('speeds').innerHTML=SPEEDS.map(([v,l])=>`<button data-v="${v}">${l}</button>`).join('');
  for(const b of $('speeds').children)b.onclick=()=>{speed=+b.dataset.v;markSpeed();};
  markSpeed();
  $('playBtn').onclick=()=>{playing=!playing;if(playing&&cur>=R.N-1)cur=0;markPlay();lastFrame=performance.now();};
  $('scrub').oninput=e=>{cur=+e.target.value;beltM=madeAt(cur);drawAll(true);};
  $('peek').onclick=()=>showResult();
}
function markSpeed(){for(const b of $('speeds').children){const on=+b.dataset.v===speed;b.classList.toggle('on',on);b.setAttribute('aria-pressed',on);}}
function markPlay(){$('playBtn').textContent=playing?'❚❚ 止める':'▶ 再生';$('playBtn').setAttribute('aria-label',playing?'止める':'再生');}
function tick(now){
  if(playing&&R){const dt=Math.min(0.25,(now-lastFrame)/1000);const m0=madeAt(cur);cur+=dt*speed/60;
    if(cur>=R.N-1){cur=R.N-1;playing=false;markPlay();}
    // ベルトの上のおにぎりは、実際に包んだ数だけ流す。1秒に BELT_MAX 個を超える速さでは目で追えないので、そこで頭打ちにする
    const dm=madeAt(cur)-m0;beltFast=dm>dt*BELT_MAX+1e-9;beltM+=Math.min(dm,dt*BELT_MAX);
    drawAll(false);}
  lastFrame=now;requestAnimationFrame(tick);
}
let lastSide=-1;
const BELT_MAX=12,BELT_N=8;let beltM=0,beltFast=false;
/** 18:00 から cur 分までに包んだ数（分の途中は直線でつなぐ） */
function madeAt(x){const i=Math.floor(x),f=x-i,a=i>0?R.agg.made[i-1]:0,b=R.agg.made[Math.min(i,R.N-1)];return a+(b-a)*f;}
function drawAll(force){
  const i=Math.floor(cur);
  $('scrub').value=i;$('clock').textContent=hm(R.T0+i);
  drawStage();
  if(force||i!==lastSide){lastSide=i;drawClocks(i);drawEvents(i);drawGantt();drawBatch();
    if(i>=R.N-1&&!resultShown)showResult();}
}

/* ---------------- 4つの時計 ---------------- */
function drawClocks(i){const t=R.T0+i,S=R.season;
  const soaking=R.batches.filter(b=>b.hs[i]===ST.SOAK);
  const cooling=R.agg.inCool[i];
  const live=R.batches.filter(b=>b.hg[i]>=0&&b.hs[i]!==ST.DONE&&b.hs[i]!==ST.CANCEL);
  const gTop=live.reduce((m,b)=>b.hg[i]>m.g?{g:b.hg[i],b}:m,{g:0,b:null});
  const fat=F.fatigue(D,t);
  $('clocks').innerHTML=`
   <div class="clk"><b>水の時計（吸水）</b><span class="v">水温 <span class="num">${S.water}℃</span>・目安 <span class="num">${F.soakNeed(D,S.water)}</span>分</span><div class="small muted">浸しているのは ${soaking.length} 釜／タンク ${D.soak.tanks}</div></div>
   <div class="clk"><b>熱の時計（冷え方）</b><span class="v">冷却中 <span class="num">${cooling}</span>／${D.cool.slots} 釜</span><div class="small muted">冷却の空気 ${S.coolAir}℃・部屋 ${S.room}℃</div></div>
   <div class="clk"><b>菌の時計</b><span class="v">${gTop.b?`いちばん多い 釜${gTop.b.no}：<span class="num" style="color:${gTop.g>=D.germ.warn?css('--bad'):'inherit'}">${gTop.g.toFixed(2)}</span>`:'まだ炊いていません'}</span><div class="small muted">注意 ${D.germ.warn}・出荷しない ${D.germ.discard}（仮の目安）</div></div>
   <div class="clk"><b>人の時計（疲れ）</b><span class="v">具入れ <span class="num">${R.agg.rate[i].toFixed(0)}</span>個／分</span><div class="small muted">具入れ ${R.agg.hands[i]}人${R.agg.off[i]?`・休憩 ${R.agg.off[i]}人`:''}${R.agg.away[i]?'・貼り直しに1人':''}${inBreak(t)&&cfg.relief?'・交代の人':''}・${fat<0.95?`疲れで ${Math.round((1-fat)*100)}% 遅い`:'まだ元気'}</div></div>`;
}

/* ---------------- 工程の絵 ---------------- */
function layout(w){
  if(w<640){return {W:400,H:1264,box:{
    wash:[12,30,110,180],soak:[134,30,254,180],cook:[12,250,376,150],cool:[12,440,376,150],hold:[12,620,376,104],form:[12,754,376,326],ship:[12,1110,376,140]},tankCols:4,lineRows:2,
    links:[['wash','soak','h'],['soak','cook','v'],['cook','cool','v'],['cool','hold','v'],['hold','form','v'],['form','ship','v']]};}
  return {W:1040,H:700,box:{
    wash:[16,36,120,190],soak:[156,36,440,190],cook:[616,36,408,190],cool:[16,280,560,180],hold:[596,280,428,180],form:[16,500,866,190],ship:[902,500,122,190]},tankCols:8,lineRows:1,
    links:[['wash','soak','h'],['soak','cook','h'],['cook','cool','u'],['cool','hold','h'],['hold','form','u'],['form','ship','h']]};
}
const TITLES={wash:'洗米',soak:'浸漬（タンク）',cook:'炊飯・蒸らし（釜）',cool:'ほぐし・冷却',hold:'待ち',form:'成形・包装のライン',ship:'出荷'};
function drawStage(){
  const cv=$('stage');const cw=cv.clientWidth||cv.parentNode.clientWidth;const L=layout(cw);
  const dpr=window.devicePixelRatio||1;const scale=cw/L.W;
  const needW=Math.round(cw*dpr),needH=Math.round(L.H*scale*dpr);
  if(cv.width!==needW||cv.height!==needH){cv.width=needW;cv.height=needH;cv.style.height=(L.H*scale)+'px';}
  const c=cv.getContext('2d');c.setTransform(dpr*scale,0,0,dpr*scale,0,0);
  c.clearRect(0,0,L.W,L.H);hits=[];
  const i=Math.floor(cur),t=R.T0+cur,frac=cur-i;
  const ink=css('--ink'),muted=css('--muted'),line=css('--line'),paper=css('--paper');
  c.font='12px '+css('--f-body');
  // 夜空の帯（時刻）
  const night=Math.max(0,Math.min(1,(t-1110)/90))*(1-Math.max(0,Math.min(1,(t-1700)/40)));
  c.fillStyle=css('--night');c.globalAlpha=0.08+0.22*night;c.fillRect(0,0,L.W,22);c.globalAlpha=1;
  c.fillStyle=muted;c.textBaseline='middle';c.fillText(`${hm(t)}　${R.season.label}の夜　${R.summary.planned}釜の予定${t>=D.orderConfirm?`・注文 ${R.summary.order.toLocaleString()}個`:''}`,8,11);
  // つなぎの矢印
  c.strokeStyle=line;c.lineWidth=2;
  for(const [a,b,k] of L.links){const A=L.box[a],B=L.box[b];c.beginPath();
    if(k==='h'){const y=A[1]+A[3]/2;c.moveTo(A[0]+A[2],y);c.lineTo(B[0],y);arrowHead(c,B[0],y,0);}
    else if(k==='v'){const x=(Math.max(A[0],B[0])+Math.min(A[0]+A[2],B[0]+B[2]))/2;c.moveTo(x,A[1]+A[3]);c.lineTo(x,B[1]);arrowHead(c,x,B[1],Math.PI/2);}
    else{const x1=A[0]+A[2]/2,x2=b==='form'?Math.min(x1,B[0]+B[2]-40):B[0]+B[2]/2,ym=(A[1]+A[3]+B[1])/2;c.moveTo(x1,A[1]+A[3]);c.lineTo(x1,ym);c.lineTo(x2,ym);c.lineTo(x2,B[1]);arrowHead(c,x2,B[1],Math.PI/2);}
    c.stroke();}
  for(const k in L.box)boxFrame(c,L.box[k],TITLES[k]);
  drawWash(c,L.box.wash,i,t);drawTanks(c,L.box.soak,i,L.tankCols);drawPots(c,L.box.cook,i,t);
  drawCooler(c,L.box.cool,i);drawHold(c,L.box.hold,i);drawForm(c,L.box.form,i,t,L.lineRows);drawShip(c,L.box.ship,i,t);
}
function arrowHead(c,x,y,a){c.moveTo(x,y);c.lineTo(x-7*Math.cos(a-0.5),y-7*Math.sin(a-0.5));c.moveTo(x,y);c.lineTo(x-7*Math.cos(a+0.5),y-7*Math.sin(a+0.5));}
function boxFrame(c,[x,y,w,h],title){c.fillStyle=css('--paper');c.strokeStyle=css('--line');c.lineWidth=1;rr(c,x,y,w,h,8);c.fill();c.stroke();
  c.fillStyle=css('--ink');c.font='bold 13px '+css('--f-body');c.textBaseline='top';c.fillText(title,x+8,y+6);c.font='12px '+css('--f-body');}
function rr(c,x,y,w,h,r){c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();}
function hit(x,y,w,h,b){hits.push([x,y,w,h,b]);}
function selRing(c,x,y,w,h,b){if(selected===b.id){c.strokeStyle=css('--focus');c.lineWidth=3;rr(c,x-3,y-3,w+6,h+6,6);c.stroke();c.lineWidth=1;}}
function txt(c,s,x,y,o){o=o||{};c.fillStyle=o.color||css('--ink');c.font=(o.bold?'bold ':'')+(o.size||12)+'px '+(o.num?css('--f-num'):css('--f-body'));c.textAlign=o.align||'left';c.textBaseline=o.base||'alphabetic';c.fillText(s,x,y);c.textAlign='left';}
function germDot(c,x,y,b,i){const g=b.hg[i];if(g>=D.germ.warn){c.fillStyle=css('--bad');c.beginPath();c.arc(x,y,g>=D.germ.discard?6:4,0,7);c.fill();}}

function drawWash(c,[x,y,w,h],i,t){
  const now=R.batches.find(b=>b.hs[i]===ST.WASH);const queue=R.batches.filter(b=>b.hs[i]===ST.WAIT).length;
  const cx=x+w/2,cy=y+h/2+4,r=Math.min(w,h)/2-28;
  c.fillStyle=css('--water');c.strokeStyle=css('--steel');c.lineWidth=3;c.beginPath();c.arc(cx,cy,r,0,7);c.fill();c.stroke();c.lineWidth=1;
  if(now){const a=t*1.7;c.strokeStyle=css('--water2');c.lineWidth=2;for(let k=0;k<3;k++){c.beginPath();c.arc(cx,cy,r*0.6,a+k*2.1,a+k*2.1+1.2);c.stroke();}c.lineWidth=1;
    c.fillStyle=css('--rice');c.beginPath();c.arc(cx,cy,r*0.35,0,7);c.fill();
    txt(c,'釜'+now.no,cx,cy+4,{align:'center',bold:true});hit(cx-r,cy-r,2*r,2*r,now);selRing(c,cx-r,cy-r,2*r,2*r,now);}
  else txt(c,t<cfg.start?`${hm(cfg.start)}から`:queue?'待ち':'洗い終わり',cx,cy+4,{align:'center',color:css('--muted'),size:11});
  txt(c,`洗う前 ${queue}釜`,x+8,y+h-10,{color:css('--muted'),size:11});
}
function drawTanks(c,[x,y,w,h],i,cols){
  const inT=R.batches.filter(b=>b.hs[i]===ST.SOAK);const n=D.soak.tanks,rows=Math.ceil(n/cols);
  const gw=(w-16)/cols,gh=(h-30)/rows;const need=F.soakNeed(D,R.season.water);
  for(let k=0;k<n;k++){const tx=x+8+(k%cols)*gw+3,ty=y+26+Math.floor(k/cols)*gh+2,tw=gw-6,th=gh-6;
    c.strokeStyle=css('--steel');c.fillStyle=css('--sheet');c.lineWidth=1.5;rr(c,tx,ty,tw,th,4);c.fill();c.stroke();c.lineWidth=1;
    const b=inT[k];if(!b)continue;const f=b.hf[i];const soakMin=i-(b.tSoak-R.T0);
    c.fillStyle=css('--water');c.fillRect(tx+2,ty+th*0.25,tw-4,th*0.75-2);
    const rh=(th*0.45)*(0.55+0.45*f);c.fillStyle=css('--rice');c.fillRect(tx+2,ty+th-2-rh,tw-4,rh);
    // 吸水の帯
    const bw=tw-8;c.fillStyle=css('--line');c.fillRect(tx+4,ty+4,bw,5);
    const ok=f>=D.soak.good,over=soakMin>D.soak.crackAfter;
    c.fillStyle=over?css('--warn'):ok?css('--ok'):css('--water2');c.fillRect(tx+4,ty+4,bw*f,5);
    c.fillStyle=css('--ink');c.fillRect(tx+4+bw*D.soak.good-1,ty+2,2,9);
    txt(c,'釜'+b.no,tx+tw/2,ty+th*0.5,{align:'center',bold:true,size:11});
    txt(c,`${soakMin}分`,tx+tw/2,ty+th*0.5+13,{align:'center',num:true,size:10,color:soakMin>=cfg.soak&&!ok?css('--bad'):css('--muted')});
    hit(tx,ty,tw,th,b);selRing(c,tx,ty,tw,th,b);}
  txt(c,`帯＝吸水（線が${Math.round(D.soak.good*100)}%）・目安${need}分`,x+w-8,y+16,{align:'right',size:10,color:css('--muted')});
}
function drawPots(c,[x,y,w,h],i,t){
  const n=D.cook.pots;const gw=(w-16)/n;
  const inP=[];for(const b of R.batches)if([ST.COOK,ST.STEAM,ST.POT].includes(b.hs[i]))inP[b.pot]=b;
  for(let k=0;k<n;k++){const px=x+8+k*gw+6,pw=gw-12,py=y+50,ph=h-80;
    c.fillStyle=css('--steel');rr(c,px,py,pw,ph,10);c.fill();
    c.fillStyle=css('--sheet');rr(c,px+5,py+5,pw-10,ph-24,8);c.fill();
    const b=inP[k];
    if(!b){txt(c,'空き',px+pw/2,py+ph/2,{align:'center',color:css('--muted'),size:11});continue;}
    const s=b.hs[i],T=b.hT[i];
    c.fillStyle=tempColor(T);c.globalAlpha=0.35;rr(c,px+5,py+5,pw-10,ph-24,8);c.fill();c.globalAlpha=1;
    if(s===ST.COOK){for(let q=0;q<4;q++){const fx=px+pw*(0.2+q*0.2),fl=6+4*Math.sin(t*3+q);c.fillStyle='#e0782b';c.beginPath();c.moveTo(fx-5,py+ph+2);c.lineTo(fx,py+ph+2-fl-6);c.lineTo(fx+5,py+ph+2);c.fill();}
      const p=Math.min(1,(R.T0+i-b.tCook)/D.cook.min);c.fillStyle=css('--warn');c.fillRect(px+5,py+ph-14,(pw-10)*p,5);}
    if(s===ST.STEAM||s===ST.POT){c.strokeStyle=css('--muted');c.globalAlpha=0.6;for(let q=0;q<3;q++){const sx=px+pw*(0.3+q*0.2),ph2=((t*0.9+q*0.37)%1);c.beginPath();c.arc(sx+4*Math.sin(t+q),py-4-ph2*26,4+ph2*4,0,7);c.stroke();}c.globalAlpha=1;}
    if(s===ST.POT){c.strokeStyle=css('--bad');c.lineWidth=3;rr(c,px,py,pw,ph,10);c.stroke();c.lineWidth=1;
      txt(c,`冷却待ち ${R.T0+i-b.tPotWait}分`,px+pw/2,py+ph+16,{align:'center',color:css('--bad'),size:11,bold:true});}
    txt(c,'釜'+b.no,px+pw/2,py+ph/2-6,{align:'center',bold:true});
    txt(c,{3:'炊飯',4:'蒸らし',5:'待ち'}[s]+` ${T.toFixed(0)}℃`,px+pw/2,py+ph/2+10,{align:'center',size:11,num:false});
    hit(px,py,pw,ph,b);selRing(c,px,py,pw,ph,b);}
  const kt=`釜番1人・炊飯${D.cook.min}分＋蒸らし${D.cook.steam}分`;txt(c,kt,x+w-8,y+16,{align:'right',size:10,color:css('--muted')});
  c.font='10px '+css('--f-body');person(c,x+w-8-c.measureText(kt).width-10,y+6,'post');
}
function drawCooler(c,[x,y,w,h],i){
  const bx=x+12,bw=w-24,by=y+h/2+10;
  c.fillStyle=css('--steel');c.fillRect(bx,by,bw,8);for(let k=0;k<=12;k++){c.beginPath();c.arc(bx+k*bw/12,by+12,3,0,7);c.fill();}
  // 冷たい風
  c.strokeStyle=css('--water2');c.globalAlpha=0.5;for(let k=0;k<6;k++){const wx=bx+((k/6+cur*0.05*({weak:1,mid:1.6,strong:2.4}[cfg.fan]))%1)*bw;c.beginPath();c.moveTo(wx,y+34);c.lineTo(wx-8,y+50);c.stroke();}c.globalAlpha=1;
  const inC=R.batches.filter(b=>b.hs[i]===ST.COOL);
  for(const b of inC){const T=b.hT[i];const p=Math.max(0,Math.min(1,(D.cook.temp-T)/(D.cook.temp-D.cool.target)));
    const tw=58,th=34,tx=bx+p*(bw-tw),ty=by-th-2;
    c.fillStyle=tempColor(T);rr(c,tx,ty,tw,th,4);c.fill();c.fillStyle='rgba(255,255,255,.55)';c.fillRect(tx+4,ty+4,tw-8,th-8);
    txt(c,'釜'+b.no,tx+tw/2,ty+15,{align:'center',bold:true,size:11,color:'#18263a'});
    txt(c,T.toFixed(0)+'℃',tx+tw/2,ty+28,{align:'center',num:true,size:10,color:'#18263a'});
    germDot(c,tx+tw-4,ty+4,b,i);hit(tx,ty,tw,th,b);selRing(c,tx,ty,tw,th,b);}
  txt(c,`95℃ →`,bx,y+h-14,{size:10,color:css('--muted')});txt(c,`→ ${D.cool.target}℃で次へ`,bx+bw,y+h-14,{size:10,color:css('--muted'),align:'right'});
  txt(c,`同時に${D.cool.slots}釜まで・風「${{weak:'弱',mid:'中',strong:'強'}[cfg.fan]}」`,x+w-8,y+16,{align:'right',size:10,color:css('--muted')});
  const qv=visitsAt(R.T0+cur).find(v=>v.who==='qc'&&v.where==='cool');if(qv){person(c,x+112,y+11,'qc');bubble(c,x+186,y+28,qv.text,[x,y,w,h],ROLE_COLOR.qc);}
}
function drawHold(c,[x,y,w,h],i){
  const inH=R.batches.filter(b=>b.hs[i]===ST.HOLD).sort((a,b)=>a.tHold-b.tHold);
  const tw=48,th=26,cols=Math.max(1,Math.floor((w-16)/(tw+6))),rows=Math.max(1,Math.floor((h-50)/(th+6)));
  inH.slice(0,cols*rows).forEach((b,k)=>{const tx=x+8+(k%cols)*(tw+6),ty=y+30+Math.floor(k/cols)*(th+6);const T=b.hT[i];
    c.fillStyle=tempColor(T);rr(c,tx,ty,tw,th,4);c.fill();c.fillStyle='rgba(255,255,255,.55)';c.fillRect(tx+3,ty+3,tw-6,th-6);
    txt(c,'釜'+b.no,tx+tw/2,ty+12,{align:'center',bold:true,size:10,color:'#18263a'});
    txt(c,`${R.T0+i-b.tHold}分`,tx+tw/2,ty+23,{align:'center',num:true,size:9,color:'#18263a'});
    if(b.kind==='n')nittaTag(c,tx-4,ty-4);
    germDot(c,tx+tw-3,ty+3,b,i);hit(tx,ty,tw,th,b);selRing(c,tx,ty,tw,th,b);});
  if(inH.length>cols*rows)txt(c,`ほか${inH.length-cols*rows}釜`,x+w-8,y+h-10,{size:11,color:css('--muted'),align:'right'});
  txt(c,inH.length?`${inH.length}釜が待っている（部屋${R.season.room}℃）`:'待っている米はない',x+8,y+h-10,{size:11,color:inH.length>2?css('--warn'):css('--muted')});
}
/* 成形・包装のライン：7つの持ち場を1本のベルトでつなぐ（スマホは2段で折り返す） */
const FILL_COLOR={shio:'#d9d3c1',konbu:'#3f4b2c',ume:'#c2445e',sake:'#e8835a',tuna:'#d4b26f',mentai:'#cf4a3f',hesiko:'#7c6a4e'};
const STATIONS=['成形機','具入れ','包装機','ラベル','検品','急冷','番重'];
function nittaTag(c,x,y){c.fillStyle=(D.packLine&&'#0F6E56');c.fillRect(x,y,11,11);txt(c,'雫',x+5.5,y+9.5,{align:'center',size:8.5,bold:true,color:'#fff'});}
/* 人：具入れ（青）・機械の番（橙）・品質管理（青緑、記録板つき）・決まった持ち場（灰）・交代の人（緑） */
const ROLE_COLOR={crew:'#5d7896',tech:'#d9822b',qc:'#2f7f8a',post:'#7d8792',relief:'#4f9a62'};
function person(c,x,y,role,dim){c.globalAlpha=dim?0.4:1;c.fillStyle=ROLE_COLOR[role]||'#888';c.beginPath();c.arc(x,y,4.5,0,7);c.fill();rr(c,x-5,y+6,10,10,3);c.fill();
  if(role==='qc'){c.fillStyle='#fff';c.fillRect(x+2,y+8,5,7);c.fillStyle=ROLE_COLOR.qc;c.fillRect(x+3,y+10,3,1);c.fillRect(x+3,y+12,3,1);}
  if(role==='tech'){c.fillStyle='#fff';c.fillRect(x-4.5,y-3.5,9,2.2);}
  c.globalAlpha=1;}
function bubble(c,x,y,text,[bx0,by0,bw0],color){c.font='10.5px '+css('--f-body');const w=c.measureText(text).width+12,h=17;
  const bx=Math.max(bx0+4,Math.min(x-w/2,bx0+bw0-w-4));c.fillStyle=css('--sheet');c.strokeStyle=color||css('--line');c.lineWidth=1.2;rr(c,bx,y,w,h,8);c.fill();c.stroke();c.lineWidth=1;
  txt(c,text,bx+6,y+12.5,{size:10.5,color:css('--ink')});}
function inBreak(t){return R&&R.brk&&R.brk.some(([a,b])=>t>=a&&t<b);}
function visitsAt(t){return R.visits.filter(v=>v.t0<=t&&t<v.t1);}
function expiryText(e){return (e<2880?'翌日':'翌々日')+hm(e);}
function drawForm(c,[x,y,w,h],i,t,rows){
  const PL=D.packLine,LN=F.LN,code=R.agg.line[i],fi=R.agg.fill[i],fill=fi>=0?PL.fillings[fi]:null;
  const b=R.batches.find(q=>q.hs[i]===ST.FORM);const fname=id=>PL.fillings.find(f=>f.id===id).name;
  const stopNow=R.stops.find(z=>z.t0<=t&&t<z.until);const leftMin=stopNow?Math.ceil(stopNow.until-t):0;
  // いまのラインの様子（右上）
  let state,sc=css('--ink');
  if(code===LN.CHANGE&&stopNow){state=`具の切り替え ${fname(stopNow.from)}→${fname(stopNow.to)}・あと${leftMin}分`;sc=css('--warn');}
  else if(code===LN.JAM){state=`包装機の詰まり・あと${leftMin}分`;sc=css('--bad');}
  else if(code===LN.METAL){state=`異物の確認中・あと${leftMin}分`;sc=css('--bad');}
  else if(code===LN.RUN&&fill)state=`${fill.name}　${Math.floor(R.agg.got[i]).toLocaleString()}／${Math.round(R.agg.tgt[i]).toLocaleString()}個${t<D.orderConfirm?'（見込み）':''}`;
  else if(R.summary.planDone!=null&&t>=R.summary.planDone){state='注文の分は全部そろった';sc=css('--ok');}
  else state=fill?`${fill.name}の米を待っている`:'米を待っている';
  txt(c,state,x+w-10,y+17,{align:'right',size:rows>1?11:12,bold:true,color:sc});
  // ベルトの道すじと、持ち場の位置
  let path,pos;const x0=x+14,x1=x+w-14;
  if(rows>1){const y1=y+122,y2=y+262;path=[[x0,y1],[x1,y1],[x1,y2],[x0,y2]];
    pos=STATIONS.map((_,k)=>k<4?[x0+(k+0.5)*(x1-x0)/4,y1]:[x1-(k-4+0.5)*(x1-x0)/3,y2]);}
  else{const yb=y+122;path=[[x0,yb],[x1,yb]];pos=STATIONS.map((_,k)=>[x0+(k+0.5)*(x1-x0)/7,yb]);}
  const segs=[];let total=0;for(let k=1;k<path.length;k++){const L=Math.hypot(path[k][0]-path[k-1][0],path[k][1]-path[k-1][1]);segs.push([total,L,path[k-1],path[k]]);total+=L;}
  const at=d=>{for(const [s0,L,a,b2] of segs){if(d<=s0+L){const u=(d-s0)/L;return [a[0]+(b2[0]-a[0])*u,a[1]+(b2[1]-a[1])*u];}}return path[path.length-1];};
  const dist=([px,py])=>{let best=0,bd=1e9;for(const [s0,L,a,b2] of segs){const u=Math.max(0,Math.min(1,((px-a[0])*(b2[0]-a[0])+(py-a[1])*(b2[1]-a[1]))/(L*L)));const qx=a[0]+(b2[0]-a[0])*u,qy=a[1]+(b2[1]-a[1])*u;const dd=Math.hypot(px-qx,py-qy);if(dd<bd){bd=dd;best=s0+u*L;}}return best;};
  const dS=pos.map(dist);
  c.strokeStyle=css('--steel');c.lineWidth=6;c.lineJoin='round';c.beginPath();path.forEach(([px,py],k)=>k?c.lineTo(px,py):c.moveTo(px,py));c.stroke();c.lineWidth=1;
  // 持ち場の札
  const sw=Math.min(104,(rows>1?(x1-x0)/4:(x1-x0)/7)-8);
  const tunnelW=sw*0.9;
  pos.forEach(([px,py],k)=>{const bx=px-sw/2,by=py-72;const busy=code===LN.RUN||(k===5||k===6);
    let hot=false;if(k===2&&code===LN.JAM)hot=true;if(k===4&&code===LN.METAL)hot=true;if(k===1&&code===LN.CHANGE)hot=true;
    c.fillStyle=css('--sheet');c.strokeStyle=hot?(code===LN.CHANGE?css('--warn'):css('--bad')):css('--line');c.lineWidth=hot?2.5:1;rr(c,bx,by,sw,24,6);c.fill();c.stroke();c.lineWidth=1;
    txt(c,STATIONS[k],px,by+16.5,{align:'center',size:11.5,bold:true,color:busy||k>4?css('--ink'):css('--muted')});});
  // 急冷のトンネル（下に）
  {const [tx,ty]=pos[5];c.fillStyle=css('--water');c.globalAlpha=0.5;rr(c,tx-tunnelW/2,ty-26,tunnelW,32,6);c.fill();c.globalAlpha=1;}
  // ベルトの上のおにぎり（検品を通った数だけ流れる）
  const NB=Math.max(8,Math.round(total/30));const top=Math.floor(beltM);const fc=fill?FILL_COLOR[fill.id]||'#888':'#888';
  for(let k=top;k>top-NB;k--){const u=(beltM-k)/NB;if(u<0||u>=1)continue;const d=u*total;if(d>dS[6]-8)continue;
    const [ox,oy0]=at(d);const oy=oy0-3;
    c.fillStyle=css('--rice');c.strokeStyle=css('--ink');c.lineWidth=0.8;c.beginPath();c.moveTo(ox,oy-12);c.lineTo(ox-8,oy);c.lineTo(ox+8,oy);c.closePath();c.fill();c.stroke();
    if(d>=dS[1]){c.fillStyle=fc;c.beginPath();c.arc(ox,oy-4.5,2.6,0,7);c.fill();}
    if(d>=dS[2]){c.fillStyle='#24323e';c.fillRect(ox-5,oy-5,10,5);c.strokeStyle=css('--water2');c.globalAlpha=0.8;c.beginPath();c.moveTo(ox,oy-14);c.lineTo(ox-10,oy+1);c.lineTo(ox+10,oy+1);c.closePath();c.stroke();c.globalAlpha=1;}
    if(d>=dS[3]){c.fillStyle='#fff';c.fillRect(ox-3,oy-9,6,3);}}
  c.lineWidth=1;
  {const [tx,ty]=pos[5];c.strokeStyle=css('--water2');c.globalAlpha=0.9;rr(c,tx-tunnelW/2,ty-26,tunnelW,32,6);c.stroke();c.globalAlpha=0.25;c.fillStyle=css('--water2');c.fill();c.globalAlpha=1;}
  // 番重（箱）
  const iC=Math.max(0,i-PL.chill.min);const passed=iC>0?R.agg.made[iC-1]:0;const crates=Math.floor(passed/PL.crate);
  {const [cx0,cy]=pos[6];const cx=cx0+(rows>1?-22:24);const n=Math.min(4,crates);for(let k=0;k<n;k++){c.fillStyle=k%2?'#4f86b8':'#3f74a6';c.fillRect(cx-12,cy-8-k*7,24,6);}
    if(crates>0){c.strokeStyle=css('--sheet');for(let k=0;k<n;k++){c.beginPath();c.moveTo(cx-12,cy-8-k*7+3);c.lineTo(cx+12,cy-8-k*7+3);c.stroke();}}}
  // 持ち場ごとの数
  const madeNow=madeAt(cur),inTunnel=Math.max(0,Math.round(madeNow-passed));const rej=Math.round(R.agg.rej[i]);
  const fat=F.fatigue(D,t);const run=code===LN.RUN;
  const lines=[
    b?[`釜${b.no}${b.kind==='n'?'〔雫〕':''}`,run?`${R.agg.rate[i].toFixed(0)}個／分`:'止まっている']:['米を待つ',''],
    [fill?fill.name:'—',`${R.agg.hands[i]}人${fat<0.95?'・☾疲れ':''}`],
    code===LN.JAM?['詰まり！',`あと${leftMin}分`]:[run?'動いている':'止まっている',`上限${PL.wrapMachine}／分`],
    ['消費期限',run||code!==LN.IDLE?expiryText(t+PL.labelHours*60):'—'],
    code===LN.METAL?['金属の反応',`あと${leftMin}分`]:['はじいた',`${rej.toLocaleString()}個`],
    [`中に${inTunnel.toLocaleString()}個`,`${PL.chill.min}分で${PL.chill.to}℃`],
    [`${crates.toLocaleString()}箱`,`${PL.crate}個入り`]];
  pos.forEach(([px,py],k)=>{const [a,b2]=lines[k];const bad=(k===2&&code===LN.JAM)||(k===4&&code===LN.METAL);
    txt(c,a,px,py+21,{align:'center',size:11,bold:true,color:bad?css('--bad'):css('--ink')});
    if(b2)txt(c,b2,px,py+35,{align:'center',size:10,color:bad?css('--bad'):css('--muted')});});
  drawLinePeople(c,[x,y,w,h],i,t,pos,sw,code);
  if(b){if(rows>1){hit(x0,path[0][1]-30,x1-x0,40,b);hit(x0,path[2][1]-30,x1-x0,40,b);}else hit(x0,path[0][1]-30,x1-x0,40,b);
    if(selected===b.id){c.strokeStyle=css('--focus');c.lineWidth=2;c.strokeRect(pos[0][0]-sw/2-2,pos[0][1]-74,sw+4,28);c.lineWidth=1;}}
  if(beltFast)txt(c,'速すぎるので、ベルトの流れは間引いて表示',x+10,y+h-8,{size:10,color:css('--muted')});
}
/* ラインのまわりの人と、ときどき出る吹き出し */
function drawLinePeople(c,box,i,t,pos,sw,code){const [x,y,w,h]=box;const LN=F.LN;
  const vs=visitsAt(t);const at={};const say={};const put=(k,role,dim)=>{(at[k]=at[k]||[]).push([role,dim]);};const tell=(k,text,col)=>{(say[k]=say[k]||[]).push([text,col]);};
  const ST_OF={form:0,fill:1,wrap:2,label:3,relabel:3,insp:4,chill:5,crate:6};
  // 具入れ（休憩中の人はいない。交代の人は緑）
  let crew=R.agg.hands[i];const reliefIn=cfg.relief&&inBreak(t);
  const crewAway=vs.filter(v=>v.who==='crew'&&v.where!=='fill');
  for(const v of crewAway)if(ST_OF[v.where]!=null){put(ST_OF[v.where],'crew');crew--;tell(ST_OF[v.where],v.text,css('--warn'));}
  if(R.agg.away[i]){put(3,'crew');}
  for(let k=0;k<crew;k++)put(1,reliefIn&&k===crew-1?'relief':'crew',code!==LN.RUN&&code!==LN.CHANGE);
  for(const v of vs.filter(v=>v.who==='crew'&&v.where==='fill'))tell(1,v.text,css('--warn'));
  // 決まった持ち場
  put(4,'post');put(6,'post');
  // 機械の番
  if(cfg.tech){const tv=vs.find(v=>v.who==='tech');const k=tv&&ST_OF[tv.where]!=null?ST_OF[tv.where]:2;put(k,'tech');if(tv)tell(k,tv.text,ROLE_COLOR.tech);}
  // 品質管理
  for(const v of vs.filter(v=>v.who==='qc'&&ST_OF[v.where]!=null)){put(ST_OF[v.where],'qc');tell(ST_OF[v.where],v.text,ROLE_COLOR.qc);}
  for(const k in at){const [px,py]=pos[k];const L=at[k],gap=Math.min(13,(sw-6)/Math.max(1,L.length));
    L.forEach(([role,dim],j)=>person(c,px+(j-(L.length-1)/2)*gap,py-40,role,dim));}
  for(const k in say){const [px,py]=pos[k];const tx=say[k].map(z=>z[0]).join('・');bubble(c,px,py-94,tx,box,say[k][0][1]);}
  const off=R.agg.off[i];
  const note=reliefIn?`休憩中1人・交代の人が入っている`:off?`休憩中 ${off}人（具入れが少ない）`:'';
  if(note)txt(c,'☕ '+note,x+w-10,y+h-8,{align:'right',size:10.5,color:reliefIn?ROLE_COLOR.relief:css('--warn')});
}
function drawShip(c,[x,y,w,h],i,t){
  const made=Math.floor(R.agg.made[Math.min(i,R.N-1)]);
  const order=t>=D.orderConfirm?R.summary.order:D.forecast;const dl=D.deadline;
  const madeBy=Math.floor(R.agg.made[Math.min(dl-R.T0,R.N-1)]);
  const showMade=t<dl?made:madeBy;
  const p=Math.min(1,showMade/order);
  const bx=x+12,bw=w-24,bh=h-90,by=y+34;
  c.strokeStyle=css('--line');c.strokeRect(bx,by,bw,bh);
  c.fillStyle=css('--ok');c.globalAlpha=0.75;c.fillRect(bx,by+bh*(1-p),bw,bh*p);c.globalAlpha=1;
  // 箱の目盛り
  c.strokeStyle=css('--sheet');for(let k=1;k<6;k++){c.beginPath();c.moveTo(bx,by+bh*k/6);c.lineTo(bx+bw,by+bh*k/6);c.stroke();}
  txt(c,`${showMade.toLocaleString()}`,x+w/2,by+bh+16,{align:'center',num:true,bold:true});
  txt(c,`／${order.toLocaleString()}個${t<D.orderConfirm?'（見込み）':''}`,x+w/2,by+bh+30,{align:'center',size:10,color:css('--muted')});
  const left=dl-t,S2=D.ship;let msg;
  if(left>0)msg=`${hm(dl)}締め切りまで ${Math.floor(left/60)}:${String(Math.floor(left%60)).padStart(2,'0')}`;
  else{const st=(S2.steps||[]).filter(x=>x[0]<=t).pop();msg=st?(st[0]>=S2.store?st[1]:`${st[1]}・${hm(S2.store)} 並ぶ`):'出荷';}
  txt(c,msg,x+w/2,y+h-10,{align:'center',size:10.5,bold:true,color:left>0&&left<60?css('--warn'):css('--ink')});
}

/* ---------------- 釜ごとの帯 ---------------- */
function drawGantt(){
  const cv=$('gantt');const cw=cv.clientWidth||1000;const bs=R.batches;const rowH=cw<640?7:8,top=18,left=cw<640?34:44,H=top+bs.length*rowH+8;
  const dpr=window.devicePixelRatio||1;if(cv.width!==Math.round(cw*dpr)||cv.height!==Math.round(H*dpr)){cv.width=Math.round(cw*dpr);cv.height=Math.round(H*dpr);cv.style.height=H+'px';}
  const c=cv.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,cw,H);
  const X=k=>left+(cw-left-6)*k/(R.N-1);
  c.font='10px '+css('--f-num');c.fillStyle=css('--muted');c.textBaseline='top';
  for(let t=R.T0;t<=R.T1;t+=60){const x=X(t-R.T0);if(cw>=640||(t/60)%2===0)c.fillText(hm(t),x-12,2);c.fillStyle=css('--line2');c.fillRect(x,top-2,1,H-top);c.fillStyle=css('--muted');}
  // 締め切り
  c.fillStyle=css('--bad');c.fillRect(X(D.deadline-R.T0),top-4,2,H-top);c.fillRect(X(D.orderConfirm-R.T0),top-4,1,H-top);
  bs.forEach((b,r)=>{const y=top+r*rowH;
    if(selected===b.id){c.fillStyle=css('--line');c.fillRect(0,y-1,cw,rowH);}
    c.fillStyle=css('--muted');c.font='9px '+css('--f-num');c.textBaseline='middle';c.fillText((b.late?'+':'')+b.no,4,y+rowH/2);
    if(b.kind==='n'){c.fillStyle='#0F6E56';c.fillRect(left-9,y+1,5,rowH-3);}
    let s0=null,k0=0;for(let k=0;k<=R.N;k++){const s=k<R.N?b.hs[k]:null;if(s!==s0){if(s0!=null&&s0>0){
        c.fillStyle=s0===ST.DONE&&b.rank==='×'?css('--bad'):ST_COLOR[s0];
        c.globalAlpha=0.22;c.fillRect(X(k0),y,Math.max(1,X(k)-X(k0)),rowH-2);
        if(cur>k0){c.globalAlpha=1;c.fillRect(X(k0),y,Math.max(1,X(Math.min(k,cur))-X(k0)),rowH-2);}
        c.globalAlpha=1;}s0=s;k0=k;}}
    if(b.tCancel!=null){c.fillStyle=css('--muted');c.fillText(b.tWash!=null?'余り（飼料）':'取りやめ',X(b.tCancel-R.T0)+4+(r%2)*44,y+rowH/2);}
  });
  c.fillStyle=css('--focus');c.fillRect(X(cur)-1,top-4,2,H-top);
  cv.onclick=e=>{const r=cv.getBoundingClientRect();const row=Math.floor((e.clientY-r.top-top)/rowH);if(row>=0&&row<bs.length){selected=bs[row].id;drawAll(true);}};
}

/* ---------------- 釜を一つ追いかける ---------------- */
function drawBatch(){
  const box=$('batchBody');if(selected==null||!R.batches[selected]){box.className='muted small';box.innerHTML='絵の中の釜・タンク・トレイ、または下の表の行を押すと、その釜の一晩が出ます。';return;}
  const b=R.batches[selected],i=Math.floor(cur),t=R.T0+i;box.className='';
  const seen=x=>x!=null&&x<=t;
  const rowsSt=[];
  const PL=D.packLine,fname=id=>PL.fillings.find(f=>f.id===id).name;
  if(b.tCancel!=null&&b.tWash==null)rowsSt.push([hm(b.tCancel),'注文が少なく、洗う前に取りやめ']);
  if(seen(b.tWash))rowsSt.push([hm(b.tWash),'洗米']);
  if(seen(b.tSoak)){const end=b.tCook!=null&&b.tCook<=t?b.tCook:t;const m=end-b.tSoak;const f=1-Math.exp(-m/R.tauW);rowsSt.push([hm(b.tSoak),`浸漬 ${m}分・吸水 ${Math.round(f*100)}%${b.tCook!=null&&b.tCook<=t?'':'（浸している）'}`]);}
  if(seen(b.tCook))rowsSt.push([hm(b.tCook),`炊飯（${D.cook.min}分）`]);
  if(seen(b.tSteam))rowsSt.push([hm(b.tSteam),'蒸らし']);
  if(seen(b.tPotWait)){const end=b.tCool!=null&&b.tCool<=t?b.tCool:t;rowsSt.push([hm(b.tPotWait),`冷却がいっぱいで釜で待つ ${end-b.tPotWait}分`]);}
  if(seen(b.tCool)){const end=b.tHold!=null&&b.tHold<=t?b.tHold:t;rowsSt.push([hm(b.tCool),`冷却 ${end-b.tCool}分`]);}
  if(seen(b.tHold)){const end=b.tForm!=null&&b.tForm<=t?b.tForm:t;rowsSt.push([hm(b.tHold),`成形・包装を待つ ${end-b.tHold}分`]);}
  const endSeen=seen(b.tDone)||seen(b.tCancel);
  if(seen(b.tForm))rowsSt.push([hm(b.tForm),`成形・包装${endSeen&&Object.keys(b.parts).length?`：${Object.entries(b.parts).map(([id,v])=>`${fname(id)} ${Math.round(v)}個`).join('・')}`:''}`]);
  if(endSeen&&b.formed>0){const r=b.rej;const all=Math.round(r.weight+r.wrap+r.metal);
    rowsSt.push(['',`検品ではじいた ${all}個（重さ${Math.round(r.weight)}・包み${Math.round(r.wrap)}${r.metal>0?`・金属${Math.round(r.metal)}`:''}）`]);}
  if(seen(b.tDone))rowsSt.push([hm(b.tDone),`検品：<b>${b.rank}</b>（${b.score}点）・消費期限 ${expiryText(b.tExpire)}${b.tDone>=D.deadline?`・${hm(D.deadline)}の締め切りに間に合わない`:''}`]);
  if(endSeen&&b.leftover>0)rowsSt.push([hm(b.tDone!=null?b.tDone:b.tCancel),`注文の分がそろい、残ったご飯 ${Math.round(b.leftover)}個分は飼料へ`]);
  const why=seen(b.tDone)?(b.why.length?`<div class="small" style="margin-top:6px">${b.why.map(w=>`・${w[0]}${w[1]?`（${w[1]}）`:''}`).join('<br>')}</div>`:'<div class="small muted" style="margin-top:6px">減点なし</div>'):'';
  const g=b.hg[i];
  box.innerHTML=`<div class="row" style="justify-content:space-between"><b class="big">釜${b.no}${b.kind==='n'?' <span class="tag nitta">雫の米</span>':''}${b.late?' <span class="tag">20:00の追加</span>':''}</b>
    <span class="small">いま：<b>${F.ST_LABEL[b.hs[i]]}</b>${b.hs[i]>0?` ・<span class="num">${b.hT[i].toFixed(1)}℃</span>`:''}${g>=0?` ・菌 <span class="num" style="color:${g>=D.germ.warn?css('--bad'):'inherit'}">${g.toFixed(2)}</span>`:''}</span></div>
    <div class="steps" style="margin-top:6px">${rowsSt.map(r=>`<span class="num">${r[0]}</span><span>${r[1]}</span>`).join('')}</div>${why}
    <canvas id="bchart" width="500" height="150" aria-label="この釜の温度と菌の目安の移り変わり"></canvas>
    <div class="legend"><span><i style="background:${css('--warn')}"></i>温度（℃）</span><span><i style="background:${css('--bad')}"></i>菌の目安（右の目盛り）</span><span><i style="background:${css('--ok')}"></i>吸水</span></div>`;
  const cv=$('bchart');const cw=cv.clientWidth||460,H=150,dpr=window.devicePixelRatio||1;cv.width=cw*dpr;cv.height=H*dpr;cv.style.height=H+'px';
  const c=cv.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);
  const a=b.tWash!=null?b.tWash-R.T0:0;const z=Math.max(a+30,Math.min(R.N-1,(b.tDone!=null?b.tDone-R.T0+60:R.N-1)));
  const X=k=>30+(cw-60)*(k-a)/(z-a),Y=T=>H-18-(H-30)*T/100,G=v=>H-18-(H-30)*v/4;
  c.strokeStyle=css('--line2');c.fillStyle=css('--muted');c.font='9px '+css('--f-num');
  for(const T of [0,30,60,90]){c.beginPath();c.moveTo(30,Y(T));c.lineTo(cw-30,Y(T));c.stroke();c.fillText(T+'℃',2,Y(T)+3);}
  for(const v of [D.germ.warn,D.germ.discard]){c.fillStyle=css('--bad');c.fillText(v.toFixed(1),cw-26,G(v)+3);c.setLineDash([3,3]);c.strokeStyle=css('--bad');c.globalAlpha=0.5;c.beginPath();c.moveTo(30,G(v));c.lineTo(cw-30,G(v));c.stroke();c.setLineDash([]);c.globalAlpha=1;}
  c.fillStyle=css('--muted');for(let tt=Math.ceil((R.T0+a)/60)*60;tt<=R.T0+z;tt+=60)c.fillText(hm(tt),X(tt-R.T0)-12,H-4);
  const upto=Math.min(z,i);
  const path=(fn,col,w)=>{c.strokeStyle=col;c.lineWidth=w;c.beginPath();let st=false;for(let k=a;k<=upto;k++){const v=fn(k);if(v==null){st=false;continue;}if(!st){c.moveTo(X(k),v);st=true;}else c.lineTo(X(k),v);}c.stroke();c.lineWidth=1;};
  path(k=>b.hs[k]>0&&b.hs[k]!==ST.WASH?Y(b.hT[k]):null,css('--warn'),2);
  path(k=>b.hg[k]>=0?G(b.hg[k]):null,css('--bad'),2);
  path(k=>b.hs[k]===ST.SOAK?Y(b.hf[k]*100):null,css('--ok'),1.5);
  // 危ない帯（10〜52℃）
  c.fillStyle=css('--bad');c.globalAlpha=0.06;c.fillRect(30,Y(D.germ.tmax),cw-60,Y(D.germ.tmin)-Y(D.germ.tmax));c.globalAlpha=1;
  if(i>=a&&i<=z){c.fillStyle=css('--focus');c.fillRect(X(i)-1,10,2,H-28);}
}

/* ---------------- 工場の記録 ---------------- */
let evCount=-1;
function drawEvents(i){const t=R.T0+i;const list=R.ev.filter(e=>e.t<=t);if(list.length===evCount)return;evCount=list.length;
  $('events').innerHTML=list.slice().reverse().map(e=>`<li class="${e.k}"${e.b!=null?` data-b="${e.b}" tabindex="0"`:''}><span class="num">${hm(e.t)}</span><span>${e.msg}</span></li>`).join('')||'<li class="muted">まだ何も起きていません。</li>';
  for(const li of $('events').querySelectorAll('li[data-b]')){const go=()=>{selected=+li.dataset.b;drawAll(true);};li.onclick=go;li.onkeydown=e=>{if(e.key==='Enter')go();};}
}

/* ---------------- 朝の答え合わせ ---------------- */
function showResult(){resultShown=true;const s=R.summary;$('resultWait').hidden=true;const el=$('result');el.hidden=false;
  const p=prev&&prev.summary;const pc=prev&&prev.cfg;
  const diff=(a,b,good)=>{if(b==null)return '';const d=a-b;if(!d)return '<span class="muted">±0</span>';const better=good==='up'?d>0:d<0;return `<span class="${better?'up':'down'}">${d>0?'+':''}${d.toLocaleString()}</span>`;};
  const row=(label,a,b,good,fmt)=>`<tr><th>${label}</th><td class="r num">${fmt?fmt(a):a.toLocaleString()}</td>${p?`<td class="r num muted">${b==null?'—':(fmt?fmt(b):b.toLocaleString())}</td><td class="r num">${good?diff(a,b,good):''}</td>`:''}</tr>`;
  const sameNight=p&&pc&&pc.seed===R.cfg.seed&&pc.season===R.cfg.season;
  const cfgDiff=p?changes(pc,R.cfg):[];
  el.innerHTML=`
   <p class="big">注文 <b class="num">${s.order.toLocaleString()}</b>個のうち、<b class="num">${s.shipped.toLocaleString()}</b>個を番重 ${s.crates}箱で${D.ship.via}へ送れました（${hm(D.ship.depart)} 工場を出発・${hm(D.ship.store)} ${D.ship.to}の売店に並ぶ）。${s.short?`<span class="down">${s.short.toLocaleString()}個足りません。</span>`:'<span class="up">全部そろいました。</span>'}</p>
   <div class="tw"><table class="fills"><thead><tr><th>具</th><th class="r">注文</th><th class="r">送れた</th><th class="r">足りない</th></tr></thead><tbody>
   ${s.fills.map(f=>`<tr><th>${f.brand?`<b class="nm">${f.brand}</b>`:''}${f.name}</th><td class="r num">${f.order.toLocaleString()}</td><td class="r num">${f.shipped.toLocaleString()}</td><td class="r num">${f.short?`<span class="down">${f.short.toLocaleString()}</span>`:'<span class="muted">0</span>'}</td></tr>`).join('')}
   </tbody></table></div>
   <p class="small">ラインが止まったのは、具の切り替え ${s.lineStops[F.LN.CHANGE].n}回・${s.lineStops[F.LN.CHANGE].min}分、包装機の詰まり ${s.lineStops[F.LN.JAM].n}回・${s.lineStops[F.LN.JAM].min}分${s.lineStops[F.LN.METAL].n?`、異物の確認 ${s.lineStops[F.LN.METAL].n}回・${s.lineStops[F.LN.METAL].min}分`:''}。検品ではじいたのは ${s.rej.all.toLocaleString()}個（重さ${s.rej.weight}・包みの崩れ${s.rej.wrap}${s.rej.metal?`・金属${s.rej.metal}`:''}${s.rej.label?`・表示の間違いで捨てた${s.rej.label}`:''}）。</p>
   ${(()=>{const q=s.people;if(!q)return '';const parts=[];
     parts.push(`具入れ ${q.crew}人${q.tech?'・機械の番 1人':''}・決まった持ち場 ${q.fixed}人（釜番・目で見る検品・番重詰め・品質管理）${R.cfg.relief?'・休憩の交代の人':''}`);
     const rec=[`温度の記録 ${q.temps}回`,`抜き取り ${q.samples}回`];if(q.checks)rec.push(`表示の確認 ${q.checks}回`);
     const ev=[];if(q.drift.n)ev.push(`成形機の重さのずれ ${q.drift.n}回（重さではじく分が${q.drift.extra}個ふえた）`);
     if(q.relabel.n)ev.push(`ラベルの間違い ${q.relabel.n}回${q.relabel.units?`（${q.relabel.units}個を${q.relabel.min}分かけて貼り直し）`:''}${q.relabel.discard?`（卵が表示になく${q.relabel.discard}個を捨てた）`:''}`);
     return `<p class="small">人：${parts.join('')}。品質管理の仕事：${rec.join('・')}。${ev.length?'<span class="down">'+ev.join('、')+'。</span>':'人が手を入れて止めた大きな出来事はなし。'}</p>`;})()}
   <p class="small muted">店ごとの番重（${D.packLine.crate}個入り）：${s.stores.map(x=>`${x.name} ${x.crates}`).join('・')}</p>
   <p class="small">いちばん詰まったところ：<b>${s.neck[1]?s.neck[0]:'特になし'}</b>（釜ごとの待ちの合計 ${s.neck[1].toLocaleString()}分）。品質 ◎${s.ranks['◎']}・○${s.ranks['○']}・△${s.ranks['△']}・×${s.ranks['×']}釜。菌の目安はいちばん多い釜で ${s.gMax.toFixed(2)}。</p>
   ${p?`<p class="small muted">右は前の夜（${sameNight?'同じ夜・同じ注文':'<b>別の夜か季節なので注文が違います</b>'}）。${cfgDiff.length?'変えた条件：'+cfgDiff.join('、'):'条件は同じ'}</p>`:''}
   <table><thead><tr><th></th><th class="r">この夜</th>${p?'<th class="r">前の夜</th><th class="r">差</th>':''}</tr></thead><tbody>
   ${row('注文',s.order,p&&p.order)}
   ${row('積めた',s.shipped,p&&p.shipped,'up')}
   ${row('足りない',s.short,p&&p.short,'down')}
   ${row('検品ではじいた（1個ずつ）',s.rej.all,p&&p.rej&&p.rej.all,'down')}
   ${row('検品で不合格（釜ごと）',s.bad,p&&p.bad,'down')}
   ${row(`${hm(D.deadline)}に間に合わなかった`,s.late+s.unfinished,p&&(p.late+p.unfinished),'down')}
   ${row('余り（残ったご飯など。飼料へ）',s.surplus,p&&p.surplus,'down')}
   ${row('最後の成形',s.lastDone||0,p&&p.lastDone,null,v=>v?hm(v):'—')}
   ${row('人件費',s.yen.labor,p&&p.yen.labor,'down',yen)}
   ${row('米',s.yen.rice,p&&p.yen.rice,'down',yen)}
   ${row('具・のり・包装',s.yen.other,p&&p.yen.other,'down',yen)}
   ${row('冷却の電気',s.yen.cool,p&&p.yen.cool,'down',yen)}
   ${row('積めた1個あたり',s.yen.perUnit||0,p&&p.yen.perUnit,'down',v=>v?v+'円':'—')}
   </tbody></table>
   <p class="note">待ちの内訳：${s.waits.map(w=>`${w[0]} ${w[1].toLocaleString()}分`).join('・')}。費用は仮の目安です。条件を1つだけ変えて「この条件で夜を回す」を押すと、同じ夜（同じ注文）で比べられます。</p>`;
  save();
}
function changes(a,b){const out=[];const L={season:'季節',batches:'釜の数',start:'洗米の開始',soak:'浸す時間',fan:'冷却',crew:'具入れの人数',order:'具の順番',tech:'機械の番',breakAt:'休憩',relief:'交代の人',labelCheck:'表示の確認'};
  const fmt=(k,v)=>k==='season'?D.seasons[v].label:k==='start'?hm(v):k==='fan'?{weak:'弱',mid:'中',strong:'強'}[v]:k==='order'?({light:'薄い味から',big:'注文の多い順',nitta:'雫を先に'}[v]||'薄い味から'):k==='tech'||k==='relief'?(v?'あり':'なし'):k==='labelCheck'?(v?'確かめる':'省く'):k==='breakAt'?hm(D.staff.break.at[v]||0)+'から':v;
  for(const k in L)if(a[k]!==b[k])out.push(`${L[k]} ${fmt(k,a[k])}→${fmt(k,b[k])}`);return out;}

/* ---------------- クリック ---------------- */
function onStageClick(e){const cv=$('stage');const r=cv.getBoundingClientRect();const L=layout(cv.clientWidth);const s=L.W/r.width;
  const x=(e.clientX-r.left)*s,y=(e.clientY-r.top)*s;
  for(let k=hits.length-1;k>=0;k--){const [hx,hy,hw,hh,b]=hits[k];if(x>=hx&&x<=hx+hw&&y>=hy&&y<=hy+hh){selected=b.id;drawAll(true);
    if(window.innerWidth<760)$('batchCard').scrollIntoView({behavior:'smooth',block:'start'});return;}}}

function legends(){
  $('tempLegend').innerHTML=[[10,'10℃'],[25,'25℃'],[32,'32℃'],[50,'50℃'],[70,'70℃'],[95,'95℃']].map(([T,l])=>`<span><i style="background:${tempColor(T)}"></i>${l}</span>`).join('')+`<span><i style="background:${css('--bad')};border-radius:50%"></i>菌が注意の線をこえた</span>`;
  $('stLegend').innerHTML=[1,2,3,4,5,6,7,8,9].map(s=>`<span><i style="background:${ST_COLOR[s]}"></i>${F.ST_LABEL[s]}</span>`).join('')+`<span><i style="background:#0F6E56"></i>左の緑：雫の米の釜</span><span><i style="background:${css('--bad')}"></i>赤い縦線：20:00 注文確定・${hm(D.deadline)} 包装の締め切り（${D.ship.via}経由で${D.ship.to}へ）</span>`;
}

async function init(){
  try{const r=await fetch('data/factory.json',{cache:'no-cache'});D=await r.json();}
  catch(e){document.querySelector('.wrap').insertAdjacentHTML('beforeend','<p class="card">設定（data/factory.json）を読めませんでした。GitHub Pages か、ローカルのサーバー（python3 -m http.server）で開いてください。</p>');return;}
  $('factoryName').textContent=D.name+'（架空）';$('lineName').textContent=D.line;$('place').textContent=(D.location||'')+'。';
  const st=load();cfg=Object.assign({},D.defaults,st.cfg||{});prev=st.prev||null;
  buildPlan();buildPlay();legends();
  $('run').onclick=()=>{run(false);playing=true;markPlay();};
  $('newNight').onclick=()=>{cfg.seed=(cfg.seed%9999)+1;run(false);};
  $('stage').addEventListener('click',onStageClick);
  window.addEventListener('resize',()=>drawAll(true));
  const mq=window.matchMedia('(prefers-color-scheme: dark)');if(mq.addEventListener)mq.addEventListener('change',()=>{legends();drawAll(true);});
  R=F.simulate(D,cfg);$('scrub').max=R.N-1;$('nightInfo').textContent=`夜の番号 ${cfg.seed}（同じ番号なら同じ注文。条件だけ変えて比べられます）`;
  drawAll(true);requestAnimationFrame(t=>{lastFrame=t;tick(t);});
}
init();
})();
