/* =====================================================================
   おにぎり工場（試作）の画面
   ・夕方の条件 → FactoryCore.simulate で一晩を先に計算し、その結果を時刻に合わせて再生して描く。
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
  <div><label for="crew">成形の人数</label><input type="number" id="crew" min="${g.crew[0]}" max="${g.crew[1]}" step="1" style="width:70px"> <span class="hint" id="crewHint"></span></div>`;
  const sync=()=>{
    $('season').value=cfg.season;$('batches').value=cfg.batches;$('start').value=cfg.start;$('soak').value=cfg.soak;$('crew').value=cfg.crew;
    $('batchesUnits').textContent=`＝${(cfg.batches*D.batchUnits).toLocaleString()}個`;
    const S=D.seasons[cfg.season];const need=F.soakNeed(D,S.water);
    $('seasonHint').textContent=`水${S.water}℃・部屋${S.room}℃・冷却の空気${S.coolAir}℃。${S.note}`;
    $('soakVal').textContent=cfg.soak;
    $('soakHint').textContent=cfg.soak<need?`この水温では吸水${Math.round((1-Math.exp(-cfg.soak/F.tau(D,S.water)))*100)}%（芯が残る。目安${need}分）`:cfg.soak>D.soak.crackAfter?`浸しすぎ（${D.soak.crackAfter}分をこえると割れる）`:`吸水${Math.round((1-Math.exp(-cfg.soak/F.tau(D,S.water)))*100)}%（目安${need}分）`;
    for(const b of $('fan').children)b.classList.toggle('on',b.dataset.v===cfg.fan),b.setAttribute('aria-pressed',b.dataset.v===cfg.fan);
    $('fanHint').textContent=`電気代 ${D.cool.yenPerMin[cfg.fan]}円／分（冷やしているあいだ）`;
    $('crewHint').textContent=`最大${Math.min(D.form.maxRate,D.form.perPerson*cfg.crew)}個／分`;
  };
  $('season').onchange=e=>{cfg.season=e.target.value;sync();};
  $('batches').onchange=e=>{cfg.batches=clampInt(e.target.value,g.batches);sync();};
  $('start').onchange=e=>{cfg.start=+e.target.value;sync();};
  $('soak').oninput=e=>{cfg.soak=+e.target.value;sync();};
  $('crew').onchange=e=>{cfg.crew=clampInt(e.target.value,g.crew);sync();};
  for(const b of $('fan').children)b.onclick=()=>{cfg.fan=b.dataset.v;sync();};
  sync();
}
function clampInt(v,[a,b]){v=Math.round(+v);if(!isFinite(v))v=a;return Math.max(a,Math.min(b,v));}

/* ---------------- 回す ---------------- */
function run(keepTime){
  if(R){prev={cfg:R.cfg,summary:R.summary};}
  R=F.simulate(D,cfg);resultShown=false;
  $('scrub').max=R.N-1;if(!keepTime)cur=0;cur=Math.min(cur,R.N-1);
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
  $('scrub').oninput=e=>{cur=+e.target.value;drawAll(true);};
  $('peek').onclick=()=>showResult();
}
function markSpeed(){for(const b of $('speeds').children){const on=+b.dataset.v===speed;b.classList.toggle('on',on);b.setAttribute('aria-pressed',on);}}
function markPlay(){$('playBtn').textContent=playing?'❚❚ 止める':'▶ 再生';$('playBtn').setAttribute('aria-label',playing?'止める':'再生');}
function tick(now){
  if(playing&&R){const dt=Math.min(0.25,(now-lastFrame)/1000);cur+=dt*speed/60;
    if(cur>=R.N-1){cur=R.N-1;playing=false;markPlay();}
    drawAll(false);}
  lastFrame=now;requestAnimationFrame(tick);
}
let lastSide=-1;
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
   <div class="clk"><b>人の時計（疲れ）</b><span class="v">成形 <span class="num">${R.agg.rate[i].toFixed(0)}</span>個／分</span><div class="small muted">${fat<0.95?`疲れで ${Math.round((1-fat)*100)}% 遅い`:'まだ元気'}・${cfg.crew}人</div></div>`;
}

/* ---------------- 工程の絵 ---------------- */
function layout(w){
  if(w<640){return {W:400,H:1000,box:{
    wash:[12,30,110,180],soak:[134,30,254,180],cook:[12,250,376,150],cool:[12,440,376,150],hold:[12,630,180,170],form:[208,630,180,170],ship:[12,840,376,140]},tankCols:4,
    links:[['wash','soak','h'],['soak','cook','v'],['cook','cool','v'],['cool','hold','v'],['hold','form','h'],['form','ship','v']]};}
  return {W:1040,H:480,box:{
    wash:[16,36,120,190],soak:[156,36,440,190],cook:[616,36,408,190],cool:[16,280,400,180],hold:[436,280,180,180],form:[636,280,230,180],ship:[886,280,138,180]},tankCols:8,
    links:[['wash','soak','h'],['soak','cook','h'],['cook','cool','u'],['cool','hold','h'],['hold','form','h'],['form','ship','h']]};
}
const TITLES={wash:'洗米',soak:'浸漬（タンク）',cook:'炊飯・蒸らし（釜）',cool:'ほぐし・冷却',hold:'待ち',form:'成形・包装',ship:'出荷'};
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
    else{const x1=A[0]+A[2]/2,x2=B[0]+B[2]/2,ym=(A[1]+A[3]+B[1])/2;c.moveTo(x1,A[1]+A[3]);c.lineTo(x1,ym);c.lineTo(x2,ym);c.lineTo(x2,B[1]);arrowHead(c,x2,B[1],Math.PI/2);}
    c.stroke();}
  for(const k in L.box)boxFrame(c,L.box[k],TITLES[k]);
  drawWash(c,L.box.wash,i,t);drawTanks(c,L.box.soak,i,L.tankCols);drawPots(c,L.box.cook,i,t);
  drawCooler(c,L.box.cool,i);drawHold(c,L.box.hold,i);drawForm(c,L.box.form,i,t);drawShip(c,L.box.ship,i,t);
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
  txt(c,`炊飯${D.cook.min}分＋蒸らし${D.cook.steam}分`,x+w-8,y+16,{align:'right',size:10,color:css('--muted')});
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
}
function drawHold(c,[x,y,w,h],i){
  const inH=R.batches.filter(b=>b.hs[i]===ST.HOLD).sort((a,b)=>a.tHold-b.tHold);
  const tw=48,th=26,cols=Math.max(1,Math.floor((w-16)/(tw+6)));
  inH.slice(0,cols*4).forEach((b,k)=>{const tx=x+8+(k%cols)*(tw+6),ty=y+30+Math.floor(k/cols)*(th+6);const T=b.hT[i];
    c.fillStyle=tempColor(T);rr(c,tx,ty,tw,th,4);c.fill();c.fillStyle='rgba(255,255,255,.55)';c.fillRect(tx+3,ty+3,tw-6,th-6);
    txt(c,'釜'+b.no,tx+tw/2,ty+12,{align:'center',bold:true,size:10,color:'#18263a'});
    txt(c,`${R.T0+i-b.tHold}分`,tx+tw/2,ty+23,{align:'center',num:true,size:9,color:'#18263a'});
    germDot(c,tx+tw-3,ty+3,b,i);hit(tx,ty,tw,th,b);selRing(c,tx,ty,tw,th,b);});
  if(inH.length>cols*4)txt(c,`ほか${inH.length-cols*4}釜`,x+8,y+h-26,{size:11,color:css('--muted')});
  txt(c,inH.length?`${inH.length}釜が待っている（部屋${R.season.room}℃）`:'待っている米はない',x+8,y+h-10,{size:11,color:inH.length>2?css('--warn'):css('--muted')});
}
function drawForm(c,[x,y,w,h],i,t){
  const b=R.batches.find(q=>q.hs[i]===ST.FORM);const rate=R.agg.rate[i];
  const by=y+h/2+6,bx=x+10,bw=w-20;
  c.fillStyle=css('--steel');c.fillRect(bx,by,bw,6);
  // 人
  const crew=cfg.crew,fat=F.fatigue(D,t);
  for(let k=0;k<crew;k++){const px=bx+12+k*((bw-24)/Math.max(1,crew-1||1)),py=by-46;c.fillStyle=css('--muted');c.globalAlpha=fat<0.95?0.55:0.9;
    c.beginPath();c.arc(px,py,6,0,7);c.fill();c.fillRect(px-6,py+7,12,12);c.globalAlpha=1;}
  if(fat<0.95)txt(c,'☾ 疲れ',x+w-8,y+30,{align:'right',size:11,color:css('--warn')});
  if(b){const per=8;const sp=rate/40;for(let k=0;k<per;k++){const u=((k/per)+cur*0.6*sp)%1;const ox=bx+u*bw,oy=by-3;
      c.fillStyle=css('--rice');c.strokeStyle=css('--ink');c.lineWidth=0.8;c.beginPath();c.moveTo(ox,oy-12);c.lineTo(ox-8,oy);c.lineTo(ox+8,oy);c.closePath();c.fill();c.stroke();
      c.fillStyle='#24323e';c.fillRect(ox-5,oy-5,10,5);}
    c.lineWidth=1;
    txt(c,`釜${b.no}　${rate.toFixed(0)}個／分`,x+8,y+h-26,{size:12,bold:true});
    const done=Math.round(D.batchUnits*Math.min(1,(R.T0+i-b.tForm)*rate/D.batchUnits));
    txt(c,`この釜 ${Math.min(D.batchUnits,done)}／${D.batchUnits}個`,x+8,y+h-10,{size:11,color:css('--muted')});
    hit(bx,by-20,bw,30,b);if(selected===b.id){c.strokeStyle=css('--focus');c.lineWidth=2;c.strokeRect(bx-2,by-22,bw+4,34);c.lineWidth=1;}}
  else txt(c,'米を待っている',x+8,y+h-10,{size:11,color:css('--muted')});
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
    let s0=null,k0=0;for(let k=0;k<=R.N;k++){const s=k<R.N?b.hs[k]:null;if(s!==s0){if(s0!=null&&s0>0){
        c.fillStyle=s0===ST.DONE&&b.rank==='×'?css('--bad'):ST_COLOR[s0];
        c.globalAlpha=0.22;c.fillRect(X(k0),y,Math.max(1,X(k)-X(k0)),rowH-2);
        if(cur>k0){c.globalAlpha=1;c.fillRect(X(k0),y,Math.max(1,X(Math.min(k,cur))-X(k0)),rowH-2);}
        c.globalAlpha=1;}s0=s;k0=k;}}
    if(b.tCancel!=null){c.fillStyle=css('--muted');c.fillText('取りやめ',X(b.tCancel-R.T0)+4+(r%2)*44,y+rowH/2);}
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
  if(b.tCancel!=null)rowsSt.push([hm(b.tCancel),'注文が少なく、洗う前に取りやめ']);
  if(seen(b.tWash))rowsSt.push([hm(b.tWash),'洗米']);
  if(seen(b.tSoak)){const end=b.tCook!=null&&b.tCook<=t?b.tCook:t;const m=end-b.tSoak;const f=1-Math.exp(-m/R.tauW);rowsSt.push([hm(b.tSoak),`浸漬 ${m}分・吸水 ${Math.round(f*100)}%${b.tCook!=null&&b.tCook<=t?'':'（浸している）'}`]);}
  if(seen(b.tCook))rowsSt.push([hm(b.tCook),`炊飯（${D.cook.min}分）`]);
  if(seen(b.tSteam))rowsSt.push([hm(b.tSteam),'蒸らし']);
  if(seen(b.tPotWait)){const end=b.tCool!=null&&b.tCool<=t?b.tCool:t;rowsSt.push([hm(b.tPotWait),`冷却がいっぱいで釜で待つ ${end-b.tPotWait}分`]);}
  if(seen(b.tCool)){const end=b.tHold!=null&&b.tHold<=t?b.tHold:t;rowsSt.push([hm(b.tCool),`冷却 ${end-b.tCool}分`]);}
  if(seen(b.tHold)){const end=b.tForm!=null&&b.tForm<=t?b.tForm:t;rowsSt.push([hm(b.tHold),`成形を待つ ${end-b.tHold}分`]);}
  if(seen(b.tForm))rowsSt.push([hm(b.tForm),'成形・包装']);
  if(seen(b.tDone))rowsSt.push([hm(b.tDone),`検品：<b>${b.rank}</b>（${b.score}点）${b.tDone>=D.deadline?`・${hm(D.deadline)}の締め切りに間に合わない`:''}`]);
  const why=seen(b.tDone)?(b.why.length?`<div class="small" style="margin-top:6px">${b.why.map(w=>`・${w[0]}${w[1]?`（${w[1]}）`:''}`).join('<br>')}</div>`:'<div class="small muted" style="margin-top:6px">減点なし</div>'):'';
  const g=b.hg[i];
  box.innerHTML=`<div class="row" style="justify-content:space-between"><b class="big">釜${b.no}${b.late?' <span class="tag">20:00の追加</span>':''}</b>
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
   <p class="big">注文 <b class="num">${s.order.toLocaleString()}</b>個のうち、<b class="num">${s.shipped.toLocaleString()}</b>個を${D.ship.via}経由で${D.ship.to}の売店へ送れました（${hm(D.ship.depart)} 工場を出発・${hm(D.ship.store)} 売店に並ぶ）。${s.short?`<span class="down">${s.short.toLocaleString()}個足りません。</span>`:'<span class="up">全部そろいました。</span>'}</p>
   <p class="small">いちばん詰まったところ：<b>${s.neck[1]?s.neck[0]:'特になし'}</b>（釜ごとの待ちの合計 ${s.neck[1].toLocaleString()}分）。品質 ◎${s.ranks['◎']}・○${s.ranks['○']}・△${s.ranks['△']}・×${s.ranks['×']}釜。菌の目安はいちばん多い釜で ${s.gMax.toFixed(2)}。</p>
   ${p?`<p class="small muted">右は前の夜（${sameNight?'同じ夜・同じ注文':'<b>別の夜か季節なので注文が違います</b>'}）。${cfgDiff.length?'変えた条件：'+cfgDiff.join('、'):'条件は同じ'}</p>`:''}
   <table><thead><tr><th></th><th class="r">この夜</th>${p?'<th class="r">前の夜</th><th class="r">差</th>':''}</tr></thead><tbody>
   ${row('注文',s.order,p&&p.order)}
   ${row('積めた',s.shipped,p&&p.shipped,'up')}
   ${row('足りない',s.short,p&&p.short,'down')}
   ${row('検品で不合格',s.bad,p&&p.bad,'down')}
   ${row(`${hm(D.deadline)}に間に合わなかった`,s.late+s.unfinished,p&&(p.late+p.unfinished),'down')}
   ${row('作りすぎ（飼料へ）',s.surplus,p&&p.surplus,'down')}
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
function changes(a,b){const out=[];const L={season:'季節',batches:'釜の数',start:'洗米の開始',soak:'浸す時間',fan:'冷却',crew:'成形の人数'};
  const fmt=(k,v)=>k==='season'?D.seasons[v].label:k==='start'?hm(v):k==='fan'?{weak:'弱',mid:'中',strong:'強'}[v]:v;
  for(const k in L)if(a[k]!==b[k])out.push(`${L[k]} ${fmt(k,a[k])}→${fmt(k,b[k])}`);return out;}

/* ---------------- クリック ---------------- */
function onStageClick(e){const cv=$('stage');const r=cv.getBoundingClientRect();const L=layout(cv.clientWidth);const s=L.W/r.width;
  const x=(e.clientX-r.left)*s,y=(e.clientY-r.top)*s;
  for(let k=hits.length-1;k>=0;k--){const [hx,hy,hw,hh,b]=hits[k];if(x>=hx&&x<=hx+hw&&y>=hy&&y<=hy+hh){selected=b.id;drawAll(true);
    if(window.innerWidth<760)$('batchCard').scrollIntoView({behavior:'smooth',block:'start'});return;}}}

function legends(){
  $('tempLegend').innerHTML=[[10,'10℃'],[25,'25℃'],[32,'32℃'],[50,'50℃'],[70,'70℃'],[95,'95℃']].map(([T,l])=>`<span><i style="background:${tempColor(T)}"></i>${l}</span>`).join('')+`<span><i style="background:${css('--bad')};border-radius:50%"></i>菌が注意の線をこえた</span>`;
  $('stLegend').innerHTML=[1,2,3,4,5,6,7,8,9].map(s=>`<span><i style="background:${ST_COLOR[s]}"></i>${F.ST_LABEL[s]}</span>`).join('')+`<span><i style="background:${css('--bad')}"></i>赤い縦線：20:00 注文確定・${hm(D.deadline)} 包装の締め切り（${D.ship.via}経由で${D.ship.to}へ）</span>`;
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
