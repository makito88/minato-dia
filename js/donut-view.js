/* =====================================================================
   ケーキドーナツのラインの画面（2026-11-11 に置きかえ）。計算は js/donut-core.js（DonutCore）、条件だけをブラウザに保存する。
   ・図の11コマ（＋チョコの任意工程）を、夜の計算の時刻に合わせて動かす。①計量から順に始まり、④からはドーナツが1個ずつ流れ、
     ⑩の箱に1個ずつ並ぶ。どのコマの数も、同じ計算の1個ずつの時刻から数えるので、合計がいつも合う。
   ・タイムライン（赤い線がいま）。押すと、その時刻へ飛ぶ。
   ===================================================================== */
(function(){
'use strict';
const C=window.DonutCore,$=id=>document.getElementById(id),KEY='dia-factory-donut';
let D,R,cfg,cur,playing=true,active=false,last=0,minute=-1,speed='live',lastDraw=0;
const FL=window.FactoryLive;   // 速さ：いま（本当の時刻・×1）・×60・×300・×900
const yen=n=>Math.round(n).toLocaleString()+'円';
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const getItem=k=>{try{return localStorage.getItem(k);}catch(e){return null;}};
function liveNote(){const e=$('dliveNote');if(e&&R)e.textContent=FL.note(R.T0,R.T1,speed==='live',playing);}
function save(){try{localStorage.setItem(KEY,JSON.stringify({cfg}));}catch(e){}}
function run(){R=C.simulate(D,(window.FactoryNight?FactoryNight.withCenter(cfg,FactoryNight.readLog(getItem)):cfg));cfg=Object.assign({},R.cfg);delete cfg.center;delete cfg.centerNo;
  {const e=$('dnightInfo');if(e)e.textContent=`夜の番号 ${cfg.seed}`+(window.FactoryNight?' '+FactoryNight.centerNote(D,FactoryNight.readLog(getItem),'donut','個'):'');}
  cur=speed==='live'?FL.liveAt(R.T0,R.T1):R.T0;minute=-1;playing=speed==='live';save();$('dresult').hidden=true;$('dresultWait').hidden=false;$('dscrub').min=R.T0;$('dscrub').max=R.T1;
  recipes();stations();buildGantt();draw(true);}
function plan(){const B=D.donut;
  const select=(id,label,opts,hint)=>`<div><label for="dc${id}">${label}</label><select id="dc${id}">${opts.map(([v,t])=>`<option value="${v}" ${String(cfg[id])===String(v)?'selected':''}>${t}</option>`).join('')}</select>${hint?`<div class="hint">${hint}</div>`:''}</div>`;
  const times=[];for(let t=B.ranges.start[0];t<=B.ranges.start[1];t+=15)times.push([t,C.hm(t)]);
  const sp=[];for(let v=B.ranges.speed[0];v<=B.ranges.speed[1];v+=2)sp.push([v,`1分に${v}個`]);
  const oil=[];for(let v=B.ranges.oilT[0];v<=B.ranges.oilT[1];v+=4)oil.push([v,v+'℃']);
  $('dplan').innerHTML=select('season','季節',Object.entries(D.seasons).map(([k,s])=>[k,s.label]),'夏は冷却（スパイラルクーラー）に長くかかる')+select('start','計量を始める時刻',times,`注文は${C.hm(D.orderConfirm)}に届く。それまでは見込みで仕込む`)
    +select('speed','押し出しの速さ',sp,'速いと早く終わるが、ミキサーとホッパーが追いつかないと止まる')+select('oilT','油の温度',oil,'3品とも180℃が向いている。ずれると検査ではじく')+select('boxers','箱詰めの人数',[1,2,3].map(n=>[n,n+'人']),'少ないと、包んだ品が箱詰めの前で待つ');
  for(const k of ['season','start','speed','oilT','boxers'])$('dc'+k).onchange=e=>{cfg[k]=k==='season'?e.target.value:+e.target.value;recipes();};
  $('dproducts').innerHTML=B.products.map(p=>`<span class="tag"><span class="ddot" style="background:${p.color}"></span>${esc(p.name)}</span>`).join(' ');}
function recipes(){const B=D.donut,O=C.offsets(B,cfg.season),n=B.batch,o=k=>{const x=O.find(y=>y[0]===k);return x[2]-x[1];};
  const rows=[['① 計量',B.weigh,'配合どおり'],['② ミキサー',B.mix,'ケーキ生地'],['③ 生地投入',B.pour,`ホッパーは${B.hopper}個ぶんまで`],['④ 押し出し',+(n/cfg.speed).toFixed(1),`1分に${cfg.speed}個・${n}個`],
    ['④〜⑤ 揚げる・油切り',o('oil')+o('fry'),`油に落ちて${o('oil')}分で裏返す`],['⑥ 蜜かけ',o('glaze'),'シュガーグレーズの品だけ蜜'],['⑦ 冷却',o('cool'),`${(D.seasons[cfg.season]||{}).label||''}・スパイラルクーラー`],['＋ チョコ',o('choco'),'チョコの品だけ'],['⑧ 検査',o('insp'),'金属検出機'],['⑨ 包装',o('pack'),'横ピロー'],['⑩ 箱詰め',+(B.box*B.place/cfg.boxers+B.close).toFixed(1),`1箱${B.box}個・${cfg.boxers}人`]];
  const r0=B.products[0].recipe||{};
  $('drecipes').innerHTML=`<div class="dgrid"><div class="drec"><h3>ケーキ生地（3品とも同じ）</h3><p class="small"><b>生地：</b>${esc(r0.dough||'')}</p><p class="small"><b>配合</b>（粉＝100）：${(r0.ratio||[]).map(([k,v])=>`${k} ${v}`).join('・')}</p>
    <p class="small"><b>成形：</b>${esc(r0.shape||'')}</p><ul class="small">${B.products.map(p=>`<li><span class="ddot" style="background:${p.color}"></span>${esc(p.name)}：${esc(p.finish)}。${esc((p.recipe.points||[]).join(' '))}</li>`).join('')}</ul></div>
    <div class="drec"><h3>${n}個のひと組が、各工程にかかる時間</h3><table class="small"><tbody>${rows.map(([k,v,x])=>`<tr><th>${k}</th><td class="num r">${v}分</td><td class="muted">${x}</td></tr>`).join('')}</tbody></table>
    <p class="small muted">⑤〜⑨はコンベアなので、1個が通る時間です（押し出した順に、1個ずつ追い越さずに進みます）。</p></div></div><p class="small muted">${esc(B.recipeNote||'')}</p>`;}
const crewOf=(st,c)=>st.crew==='boxers'?c.boxers:st.crew;
function stations(){const B=D.donut,c=R.cfg,O=R.O,bs=R.batches,fd=bs.length?bs[0].d0:0,ld=bs.length?bs.at(-1).d1:0,off=k=>O.find(x=>x[0]===k);
  const span=[[bs[0]&&bs[0].w0,bs.at(-1)&&bs.at(-1).w1],[bs[0]&&bs[0].m0,bs.at(-1)&&bs.at(-1).m1],[bs[0]&&bs[0].p0,bs.at(-1)&&bs.at(-1).p1],[fd,ld+off('oil')[2]],[fd+off('fry')[1],ld+off('fry')[2]],[fd+off('glaze')[1],ld+off('glaze')[2]],[fd+off('cool')[1],ld+off('cool')[2]],[fd+off('choco')[1],ld+off('choco')[2]],[fd+off('insp')[1],ld+off('insp')[2]],[fd+off('pack')[1],ld+off('pack')[2]],[R.boxes[0]&&R.boxes[0].b0,R.boxes.at(-1)&&R.boxes.at(-1).c1],[R.loads[0]&&R.loads[0].l0,R.go]];
  const known=(B.stations||[]).reduce((a,st)=>a+(Number.isFinite(crewOf(st,c))?crewOf(st,c):0),0);
  $('dstations').innerHTML=`<div class="tw"><table style="min-width:620px"><thead><tr><th>工程</th><th>機械</th><th>人</th><th>すること</th><th>今夜</th></tr></thead><tbody>${(B.stations||[]).map((st,i)=>{const u=span[i]||[],n=crewOf(st,c);
    return `<tr><th>${esc(st.n)} ${esc(st.name)}</th><td>${esc(st.machine||'—')}</td><td>${n?n+'人<br><span class="small muted">'+esc(st.role)+'</span>':'なし'}</td><td class="small">${esc(st.task)}</td><td class="num small">${u[0]!=null&&u[1]!=null?C.hm(u[0])+'〜'+C.hm(u[1]):'—'}</td></tr>`;}).join('')}</tbody></table></div>
  <p class="small muted">人は今夜 ${known}人（計量とミキサー・フライヤー・検査・包装機に各1人と、箱詰め${c.boxers}人）。人件費は、${known}人が計量の始めからトラックが出るまで（または2:30まで）いる、という大まかな計算です。</p>`;}
function result(){const s=R.summary;$('dresultWait').hidden=true;$('dresult').hidden=false;
  $('dresult').innerHTML=`<p class="big">注文 <b>${s.order.toLocaleString()}</b>個 → ${C.hm(D.deadline)}までに <b>${s.shipped.toLocaleString()}</b>個を包んで出荷。<span class="${s.short?'down':'up'}">${s.short?s.short+'個足りません':'全部そろいました'}</span></p>
  <div class="tw"><table><thead><tr><th>商品</th><th>注文</th><th>作った</th><th>出荷</th><th>不足</th><th>はじいた</th><th>締め切り後</th><th>余り</th></tr></thead><tbody>${s.prods.map(p=>`<tr><th>${esc(p.name)}</th>${['order','made','shipped','short','bad','late','surplus'].map(k=>`<td class="num r">${p[k]}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
  <p>いちばん待ったところ：<b>${s.neck[1]?s.neck[0]:'特になし'}</b>（待ちの合計${s.neck[1]}分）。最後の1個を包んだのは ${C.hm(s.lastDone)}、${s.boxes}箱を積んでトラックが出たのは ${C.hm(s.go)}。</p>
  <p>人件費 ${yen(s.yen.labor)} ／ 材料・袋 ${yen(s.yen.material)} ／ 油 ${yen(s.yen.oil)} ／ 機械 ${yen(s.yen.machine)}<br>合計 <b>${yen(s.yen.total)}</b>・出荷1個あたり ${s.yen.perUnit?yen(s.yen.perUnit):'—'}</p>
  <p class="small muted">消費期限は出荷日の22:00（その夜の製造で固定）。余りとはじいた品も費用に含む。</p>`;}

/* ---------------- 11コマ ---------------- */
const PANELS=[['1','計量','原料準備'],['2','ミキサー','生地づくり'],['3','生地投入','ホッパーへ'],['4','成形・フライ','投入'],['5','フライ・油切り',''],['6','蜜かけ','シュガーグレーズ'],['7','冷却','スパイラルクーラー'],['＋','チョココーティング','任意工程'],['8','検査','外観・金属検出'],['9','包装','横ピロー・個包装'],['10','箱詰め',''],['11','出荷','']];
const PW=320,PH=190;let CV=[];
const dark=()=>matchMedia('(prefers-color-scheme:dark)').matches&&document.documentElement.dataset.theme!=='light';
let K={};function colors(){const d=dark();K={ink:d?'#d9dee4':'#38414c',muted:d?'#9aa8b5':'#6b7480',steel:d?'#55606c':'#c9ced4',steel2:d?'#3d4650':'#9aa3ad',oil:'#d9a441',oil2:'#b8812a',dough:'#f2dc9b',fried:'#d99a4e',fried2:'#c27a33',glaze:'#fff6e6',choco:'#5a3420',film:'#dfe8ef',box:'#d8b582',paper:d?'#182029':'#fbfcfc',bad:'#c23b3b',ok:'#2e7d4f',pink:'#f0a9bd'};}
function buildPanels(){const g=$('dpanels');g.innerHTML=PANELS.map(([n,t,s])=>`<section class="dp${n==='＋'?' opt':''}"><h3><i>${n}</i>${t}${s?` <small>（${s}）</small>`:''}</h3><canvas width="${PW*2}" height="${PH*2}" aria-label="${t}"></canvas><div class="st"></div></section>`).join('');
  CV=[...g.querySelectorAll('.dp')].map(el=>({x:el.querySelector('canvas').getContext('2d'),st:el.querySelector('.st'),last:''}));}
const Rr=(x,a,b,w,h,fill,r=4)=>{x.beginPath();x.roundRect(a,b,w,h,r);if(fill){x.fillStyle=fill;x.fill();}x.stroke();};
const T=(x,s,a,b,sz=11,c=K.ink,al='center')=>{x.fillStyle=c;x.font=`${sz}px "Zen Kaku Gothic New","Hiragino Sans","Noto Sans JP",sans-serif`;x.textAlign=al;x.fillText(s,a,b);};
function ring(x,a,b,r,body,top,sq=1){x.save();x.translate(a,b);x.scale(1,0.45*sq);x.beginPath();x.arc(0,0,r,0,7);x.fillStyle=body;x.fill();x.stroke();
  if(top){x.beginPath();x.arc(0,-2,r*0.92,0,7);x.fillStyle=top;x.fill();}x.beginPath();x.arc(0,top?-2:0,r*0.38,0,7);x.fillStyle=K.paper;x.fill();x.stroke();x.restore();}
function belt(x,a,b,w,ph){Rr(x,a,b,w,8,K.steel,3);x.save();x.beginPath();x.rect(a,b,w,8);x.clip();x.strokeStyle=K.steel2;for(let i=-20;i<w+20;i+=10){const u=a+i+((ph*30)%10);x.beginPath();x.moveTo(u,b);x.lineTo(u-4,b+8);x.stroke();}x.restore();
  for(let i=a+10;i<a+w;i+=40){x.beginPath();x.moveTo(i,b+8);x.lineTo(i,b+26);x.stroke();}}
function steam(x,a,b,ph){x.strokeStyle=K.steel2;for(let k=0;k<3;k++){x.beginPath();for(let j=0;j<14;j++){const y=b-j,xx=a+k*8+Math.sin(j/3+ph*4+k)*2;j?x.lineTo(xx,y):x.moveTo(xx,y);}x.stroke();}x.strokeStyle=K.ink;}
function person(x,a,b,arm){x.fillStyle='#fff';x.beginPath();x.arc(a,b,9,Math.PI,0);x.fill();x.stroke();x.fillStyle='#f3d6bd';x.beginPath();x.arc(a,b+4,7,0,7);x.fill();x.stroke();
  x.fillStyle='#e9eef2';x.fillRect(a-5,b+4,10,4);Rr(x,a-12,b+12,24,26,'#fff',6);x.beginPath();x.moveTo(a+10,b+18);x.lineTo(a+22,b+24+arm*6);x.stroke();x.fillStyle='#7fb3e0';x.beginPath();x.arc(a+23,b+25+arm*6,3,0,7);x.fill();}
const pk=(x,a,b,c)=>{Rr(x,a,b,26,13,'rgba(220,232,240,.95)',4);x.fillStyle=c;x.beginPath();x.ellipse(a+13,b+6.5,6,3,0,0,7);x.fill();};
/* その区間にいるドーナツ（多いときは間引いて描く。数は全部） */
function inSeg(k,t,maxDraw){const o=R.O.find(x=>x[0]===k),lo=C.upTo(R.dep,t-o[2]),hi=C.upTo(R.dep,t-o[1]),n=hi-lo,step=Math.max(1,Math.ceil(n/(maxDraw||40))),out=[];
  for(let i=lo;i<hi;i+=step){if(R.bad[i]&&k==='pack')continue;out.push({i,f:(t-R.dep[i]-o[1])/(o[2]-o[1]),p:R.products[R.pi[i]]});}
  let cnt=0;for(let i=lo;i<hi;i++)if(!(R.bad[i]&&k==='pack'))cnt++;return {list:out,n:cnt};}
const topOf=(p,stage)=>{const g=p.glaze&&stage>=6,c=p.choco&&stage>=8;return c?K.choco:g?K.glaze:null;};
function batchState(t){const bs=R.batches;let weigh=null,ready=null,mixer=null,poured=0;
  for(const b of bs){if(b.w0<=t&&t<b.w1)weigh=b;else if(b.w1<=t&&t<b.m0)ready=b;if(b.m0<=t&&t<b.p1)mixer=b;if(b.p1<=t)poured+=b.n;else if(b.p0<=t)poured+=b.n*(t-b.p0)/(b.p1-b.p0);}
  return {weigh,ready,mixer,hopper:Math.max(0,poured-C.upTo(R.dep,t))};}
const pname=id=>{const p=R.products.find(x=>x.id===id);return p?p.name:id;};
const DRAW=[
 (x,t,ph,S)=>{const bag=(a,b,w,h,s,c)=>{Rr(x,a,b,w,h,c,6);T(x,s,a+w/2,b+h/2+4,12,'#38414c');};bag(16,40,62,70,'小麦粉','#ead7b5');bag(84,52,56,58,'砂糖','#ead7b5');bag(14,104,52,44,'BP','#f3ead9');bag(70,112,40,38,'油脂','#f6f0de');
   for(let i=0;i<6;i++){x.fillStyle='#f7efe0';x.beginPath();x.ellipse(118+i*11,156,5,6.5,0,0,7);x.fill();x.stroke();}T(x,'卵',148,178,10,K.muted);
   const W0=S.weigh,kg=b=>b.n*D.donut.mat.doughG/1000,g=W0?kg(W0)*(t-W0.w0)/(W0.w1-W0.w0):S.ready?kg(S.ready):0;
   Rr(x,200,128,90,24,K.steel,4);Rr(x,214,134,40,12,'#cfe8d4',2);T(x,g.toFixed(1)+'kg',234,144,9,'#38414c');
   x.fillStyle='#fff';x.beginPath();x.ellipse(245,118,38,12,0,0,Math.PI);x.fill();x.stroke();if(g>0){x.fillStyle='#f4ecd8';x.beginPath();x.ellipse(245,118,38*Math.min(1,0.4+g/8),5,0,0,7);x.fill();x.stroke();}
   if(W0){x.fillStyle='#f4ecd8';for(let i=0;i<6;i++){x.beginPath();x.arc(245+Math.sin(i+ph*8)*4,60+((ph*90+i*9)%55),1.6,0,7);x.fill();}Rr(x,228,44,34,16,'#ead7b5',4);}
   return W0?`<b>${pname(W0.prod)} 第${W0.id+1}回（${W0.n}個ぶん）を計量中</b>：${g.toFixed(1)}kg`:S.ready?`第${S.ready.id+1}回を量り終えた：ミキサーが空くのを待つ`:t<R.T0+0.01?`${C.hm(R.cfg.start)} に始まります`:R.batches.length&&t>=R.batches.at(-1).w1?`${R.batches.length}回ぶん量り終えた`:'—';},
 (x,t,ph,S)=>{const M=S.mixer,st=!M?'':t<M.m1?'mix':t<M.p0?'wait':'pour';Rr(x,90,20,140,28,K.steel,6);T(x,'ミキサー',160,39,12);Rr(x,40,60,34,60,K.steel,4);['#e66','#fc6','#6c8'].forEach((c,i)=>{x.fillStyle=st==='mix'||(st&&i===1)?c:K.steel2;x.beginPath();x.arc(57,74+i*14,4,0,7);x.fill();x.stroke();});
   x.beginPath();x.moveTo(110,48);x.lineTo(110,160);x.moveTo(210,48);x.lineTo(210,160);x.stroke();x.fillStyle=K.steel;x.beginPath();x.moveTo(110,100);x.quadraticCurveTo(160,170,210,100);x.closePath();x.fill();x.stroke();
   if(st==='mix'||st==='wait'){x.fillStyle=K.dough;x.beginPath();x.ellipse(160,104,46,10,0,0,7);x.fill();x.stroke();}
   const a=st==='mix'?ph*5:0;x.beginPath();x.moveTo(160,48);x.lineTo(160,100);x.stroke();for(let i=0;i<3;i++){const ang=a+i*2.09;x.beginPath();x.moveTo(160,70);x.quadraticCurveTo(160+Math.cos(ang)*30,90,160+Math.cos(ang)*18,108);x.stroke();}Rr(x,120,160,80,10,K.steel2,2);
   return !M?'空いている':st==='mix'?`<b>第${M.id+1}回を混ぜている</b>：あと ${Math.ceil(M.m1-t)}分`:st==='wait'?`第${M.id+1}回：混ぜ終わり。ホッパーが空くのを待つ（いま ${Math.floor(S.hopper)}個ぶん）`:`第${M.id+1}回をホッパーへ`;},
 (x,t,ph,S)=>{const M=S.mixer,pour=M&&t>=M.p0,pp=pour?(t-M.p0)/(M.p1-M.p0):0,tilt=pour?Math.min(1,pp*4,(1-pp)*4):0,cap=D.donut.hopper;
   x.beginPath();x.moveTo(40,170);x.lineTo(40,40);x.lineTo(70,40);x.stroke();Rr(x,32,160,60,12,K.steel2,2);T(x,'ボウルリフト',62,186,10,K.muted);
   x.save();x.translate(110,60);x.rotate(tilt*2);x.fillStyle=K.steel;x.beginPath();x.moveTo(-34,-18);x.lineTo(34,-18);x.lineTo(24,22);x.lineTo(-24,22);x.closePath();x.fill();x.stroke();if(pour&&pp<0.9){x.fillStyle=K.dough;x.beginPath();x.ellipse(0,-16,32*(1-pp),6,0,0,7);x.fill();}x.restore();
   Rr(x,200,110,90,40,K.steel,4);x.beginPath();x.moveTo(200,110);x.lineTo(225,160);x.lineTo(265,160);x.lineTo(290,110);x.stroke();T(x,'ホッパー',245,104,12);
   if(tilt>0.9){x.fillStyle=K.dough;x.beginPath();x.moveTo(150,74);x.quadraticCurveTo(220,70,238,112);x.lineTo(252,112);x.quadraticCurveTo(230,64,150,64);x.fill();}
   const lv=Math.min(1,S.hopper/cap);x.fillStyle=K.dough;x.fillRect(206,148-lv*36,78,lv*36);
   return pour?`<b>第${M.id+1}回をホッパーへ</b>（ホッパー ${Math.floor(S.hopper)}／${cap}個ぶん）`:`ホッパー ${Math.floor(S.hopper)}／${cap}個ぶん`;},
 (x,t,ph,S,k)=>{const L=inSeg('oil',t,24);Rr(x,10,120,300,40,K.oil,4);x.fillStyle=K.oil2;x.fillRect(12,122,296,6);T(x,'連続フライヤー（'+R.cfg.oilT+'℃）',160,178,10,K.muted);
   x.fillStyle=K.steel;x.beginPath();x.moveTo(140,10);x.lineTo(240,10);x.lineTo(205,50);x.lineTo(175,50);x.closePath();x.fill();x.stroke();x.fillStyle=K.dough;x.fillRect(150,14,80*Math.min(1,S.hopper/D.donut.hopper),10);Rr(x,176,50,28,26,K.steel2,3);T(x,'成形（押し出し）',100,48,10,K.muted);
   const nd=k.dep,since=nd?t-R.dep[nd-1]:9,gap=1/R.cfg.speed;if(nd&&since<gap*0.9&&nd<R.dep.length+1)ring(x,190,80+since/(gap*0.9)*44,12,K.dough,null);
   for(const o of L.list)if(o.f>0.05)ring(x,190+o.f*110,128+(o.i%2)*6-3,12,K.dough,null);if(L.n)steam(x,40,110,ph);
   return `押し出した <b>${nd}</b>／${R.dep.length}個（1分に${R.cfg.speed}個）・油の中 ${L.n}個`;},
 (x,t,ph)=>{const L=inSeg('fry',t,30);Rr(x,10,110,190,40,K.oil,4);Rr(x,200,104,110,8,K.steel,2);const fo=R.O.find(o=>o[0]==='fry'),sub=0.6;
   for(const o of L.list){if(o.f<sub){const u=10+o.f/sub*185,flip=u>80&&u<110?Math.max(0.15,Math.abs(Math.cos((u-95)/14))):1;ring(x,u,122+(o.i%2)*6-3,13,u<95?K.dough:K.fried,null,flip);}else ring(x,200+(o.f-sub)/(1-sub)*105,98,13,K.fried,K.fried2);}
   x.beginPath();x.arc(95,96,14,Math.PI*1.1,Math.PI*1.9);x.stroke();T(x,'自動で返す',95,80,10,K.muted);T(x,'油切り（メッシュ）',255,140,10,K.muted);if(L.n)steam(x,30,100,ph);
   return `揚げている・油切り <b>${L.n}</b>個`;},
 (x,t,ph)=>{const L=inSeg('glaze',t,20),on=L.list.some(o=>o.p.glaze);belt(x,6,128,308,L.n?ph:0);Rr(x,110,20,100,30,K.steel,4);T(x,'グレーズカーテン',160,40,11);
   if(on){x.strokeStyle=K.pink;for(let i=0;i<18;i++){x.beginPath();x.moveTo(116+i*5,50);for(let j=0;j<12;j++)x.lineTo(116+i*5+Math.sin(j+ph*6+i)*1,50+j*6);x.stroke();}x.strokeStyle=K.ink;}
   for(const o of L.list){const u=o.f*320;ring(x,u,124,14,K.fried,o.p.glaze&&u>160?K.glaze:null);}
   const g=L.list.filter(o=>o.p.glaze).length;return L.n?(on?`蜜をかけている（${L.list.find(o=>o.p.glaze).p.name}）<b>${L.n}</b>個`:`蜜のない品が通る（カーテンを止めている）<b>${L.n}</b>個`):'いまは何も通っていない';},
 (x,t,ph)=>{const L=inSeg('cool',t,48);Rr(x,90,14,140,22,K.steel,4);T(x,'スパイラルクーラー',160,30,11);x.beginPath();x.moveTo(90,36);x.lineTo(90,172);x.moveTo(230,36);x.lineTo(230,172);x.stroke();
   for(let lv=0;lv<5;lv++){const y=160-lv*26;x.strokeStyle=K.steel2;x.beginPath();x.ellipse(160,y,62,10,0,0,7);x.stroke();}x.strokeStyle=K.ink;
   const P=L.list.map(o=>{const ang=o.f*5*6.283;return {a:160+Math.sin(ang)*62,y:160-o.f*104+Math.cos(ang)*10,front:Math.cos(ang)>0,top:topOf(o.p,7)};});
   P.sort((a,b)=>a.front-b.front).forEach(o=>{x.globalAlpha=o.front?1:0.45;ring(x,o.a,o.y,9,K.fried,o.top);});x.globalAlpha=1;
   return `らせんで上りながら冷ます：中に <b>${L.n}</b>個（${R.O.find(o=>o[0]==='cool').slice(1).reduce((a,b)=>b-a)}分）`;},
 (x,t,ph)=>{const L=inSeg('choco',t,20),on=L.list.some(o=>o.p.choco);belt(x,6,128,308,L.n?ph:0);Rr(x,110,20,100,30,K.steel,4);T(x,'チョコカーテン',160,40,11);
   if(on){x.fillStyle=K.choco;for(let i=0;i<14;i++){const w=4+Math.sin(ph*5+i)*1.2;x.fillRect(116+i*6.4,50,w,70);}}
   for(const o of L.list){const u=o.f*320;ring(x,u,124,14,K.fried,o.p.choco&&u>160?K.choco:topOf(o.p,7));}
   return L.n?(on?`チョコをかけている <b>${L.n}</b>個`:`チョコのない品が通る（カーテンを止めている）<b>${L.n}</b>個`):'いまは何も通っていない';},
 (x,t,ph,S,k)=>{const L=inSeg('insp',t,20);belt(x,6,130,308,L.n?ph:0);person(x,40,72,L.n?Math.sin(ph*3)*0.5:0);Rr(x,150,70,80,60,K.steel,4);T(x,'金属検出機',190,96,11);
   const hit=L.list.some(o=>R.bad[o.i]&&o.f>0.4&&o.f<0.7);x.fillStyle=hit?K.bad:K.ok;x.beginPath();x.arc(262,52,6,0,7);x.fill();x.stroke();x.beginPath();x.moveTo(262,58);x.lineTo(262,128);x.stroke();
   for(const o of L.list){const u=o.f*320;if(u>150&&u<230)continue;if(R.bad[o.i]&&u>=230){ring(x,u,152,13,K.fried,topOf(o.p,8));continue;}ring(x,u,126,13,K.fried,topOf(o.p,8));}
   return hit?`<b>はじく：この1個を外す</b>（これまでに ${k.rej}個）`:`見ている <b>${L.n}</b>個・はじいた ${k.rej}個`;},
 (x,t,ph,S,k)=>{const L=inSeg('pack',t,20);belt(x,6,134,308,L.n?ph:0);x.save();x.translate(60,60);x.rotate(L.n?ph*2:0);x.fillStyle=K.film;x.beginPath();x.arc(0,0,26,0,7);x.fill();x.stroke();x.beginPath();x.arc(0,0,8,0,7);x.stroke();x.beginPath();x.moveTo(0,-26);x.lineTo(0,26);x.stroke();x.restore();
   x.strokeStyle=K.steel2;x.beginPath();x.moveTo(84,60);x.lineTo(150,96);x.stroke();x.strokeStyle=K.ink;Rr(x,120,90,90,44,K.steel,4);T(x,'横ピロー包装機',165,118,11);Rr(x,180,64,26,18,'#9ec4e4',3);
   for(const o of L.list){const u=o.f*320;if(u>120&&u<210)continue;if(u<120)ring(x,u,130,12,K.fried,topOf(o.p,9));else{Rr(x,u-18,118,36,16,'rgba(220,232,240,.85)',6);ring(x,u,126,9,K.fried,topOf(o.p,9));}}
   return `包んでいる ${L.n}個・包み終わった <b>${k.pack}</b>個`;},
 (x,t,ph,S,k)=>{const B=D.donut,box=R.boxes.find(b=>b.b0<=t&&t<b.c1),bi=box?R.boxes.indexOf(box):-1;let inBox=0,mv=null;
   if(box){for(let i=0;i<R.dep.length;i++){if(R.bx[i]!==bi)continue;if(R.pl[i]<=t)inBox++;else if(R.pl[i]-R.per<t)mv={i,e:(t-R.pl[i]+R.per)/R.per,j:inBox};}}
   const wait=Math.max(0,k.pack-k.placed-(mv?1:0));Rr(x,4,84,70,8,K.steel,3);for(let i=0;i<Math.min(wait,4);i++)Rr(x,8+i*16,72,15,11,'rgba(220,232,240,.95)',4);if(wait>4)T(x,`+${wait-4}`,70,70,9,K.muted);T(x,`待ち ${wait}個`,38,104,9,K.muted);
   person(x,96,40,mv?Math.sin(mv.e*3.1):0);const cl=box&&t>=box.c0?(t-box.c0)/(box.c1-box.c0):0,bx=120+(cl>0.6?(cl-0.6)/0.4*140:0);Rr(x,bx,110,130,60,K.box,3);
   const slot=j=>({a:bx+8+(j%4)*30,b:116+Math.floor(j/4)*16}),col=box?R.products[box.prod].color:K.fried;for(let j=0;j<inBox;j++){const q=slot(j);pk(x,q.a,q.b,col);}
   if(cl>0){const lid=Math.min(1,cl/0.6);x.fillStyle=K.box;for(const s of [1,-1]){const e0=s>0?bx:bx+130;x.beginPath();x.moveTo(e0,110);x.lineTo(e0+s*65*lid,110-20*(1-lid));x.lineTo(e0+s*65*lid,110);x.fill();x.stroke();}}
   else{x.beginPath();x.moveTo(bx,110);x.lineTo(bx-18,94);x.moveTo(bx+130,110);x.lineTo(bx+148,94);x.stroke();}T(x,box?R.products[box.prod].name:'ケーキドーナツ',bx+65,164,10,'#38414c');
   if(mv){const q=slot(mv.j),e=mv.e,a0=60,b0=72;pk(x,a0+(q.a-a0)*e,b0+(q.b-b0)*e-Math.sin(e*3.14)*30,R.products[R.pi[mv.i]].color);}
   const ready=k.closed-k.loaded;for(let i=0;i<Math.min(4,ready);i++)Rr(x,272,148-i*20,44,20,K.box,2);
   return box&&cl>0?`<b>${box.n}個${box.n<B.box?'（端数）':''}そろった：箱を閉じる（${bi+1}箱目）</b>`:box?`この箱 <b>${inBox}</b>／${B.box}個・閉じた箱 ${k.closed}（包み終わった ${k.pack} ＝ 箱の中 ${k.placed} ＋ 待ち ${k.pack-k.placed}）`:`閉じた箱 ${k.closed}（包み終わった ${k.pack} ＝ 箱の中 ${k.placed} ＋ 待ち ${k.pack-k.placed}）`;},
 (x,t,ph,S,k)=>{const go=t>=R.go?Math.min(1,(t-R.go)/3):0,ld=R.loads.find(l=>l.l0<=t&&t<l.l1),n=k.loaded;x.save();x.translate(go*260,0);Rr(x,110,40,170,110,'#f4f4f4',4);x.fillStyle=K.pink;x.fillRect(110,140,170,6);Rr(x,280,80,34,70,'#eef',6);x.fillStyle='#333';[150,250,300].forEach(a=>{x.beginPath();x.arc(a,158,12,0,7);x.fill();});
   const vis=Math.min(n,16);for(let i=0;i<vis;i++){const c=i%4,r=Math.floor(i/4);Rr(x,120+c*36,120-r*24,32,22,K.box,2);}T(x,'コンビニ向け',195,64,11,'#38414c');x.restore();
   x.beginPath();x.moveTo(30,160);x.lineTo(110,146);x.stroke();const ready=k.closed-k.loaded-(ld?1:0);for(let i=0;i<Math.min(3,ready);i++)Rr(x,4,138-i*22,32,22,K.box,2);
   if(ld){const e=(t-ld.l0)/(ld.l1-ld.l0),c=vis%4,r=Math.min(3,Math.floor(vis/4));Rr(x,20+(120+c*36-20)*e,138+(120-r*24-138)*e-Math.sin(e*3.14)*14,32,22,K.box,2);}
   return t>=R.go?`<b>${C.hm(R.go)} に出発</b>：${R.boxes.length}箱・${R.summary.made-R.summary.bad}個`:`トラックに積んだ <b>${n}</b>／${R.boxes.length}箱`;}];
function drawPanels(t){if(!CV.length)return;const ph=playing?FL.sec():0,S=batchState(t),k=C.countsAt(R,t);
  CV.forEach((c,i)=>{const x=c.x;x.setTransform(2,0,0,2,0,0);x.clearRect(0,0,PW,PH);x.lineWidth=1.4;x.strokeStyle=K.ink;x.lineJoin='round';x.lineCap='round';const s=DRAW[i](x,t,ph,S,k);if(s!==c.last){c.st.innerHTML=s;c.last=s;}});
  $('dkpi').innerHTML=`押し出した <b>${k.dep}</b> ＝ ライン上 <b>${k.line}</b> ＋ はじいた <b>${k.rej}</b> ＋ 包み終わった <b>${k.pack}</b>（箱の中 ${k.placed}・閉じた箱 ${k.closed}・積んだ ${k.loaded}）`;}

/* ---------------- タイムライン ---------------- */
const GW=1200,GL=128,GR=GW-14,GTOP=30;let GROWS=[];
function buildGantt(){const r=R,O=r.O,off=k=>O.find(x=>x[0]===k),bs=r.batches,col=b=>r.products.find(p=>p.id===b.prod).color;
  const band=(k,only)=>bs.map(b=>{const p=r.products.find(x=>x.id===b.prod);return {s:b.d0+off(k)[1],e:b.d1+off(k)[2],c:col(b),pass:only&&!p[only],b};});
  GROWS=[['① 計量',bs.map(b=>({s:b.w0,e:b.w1,c:col(b),lb:`${b.id+1}`}))],['② ミキサー',bs.flatMap(b=>[{s:b.m0,e:b.m1,c:col(b),lb:`${b.id+1}`},...(b.wait>0.2?[{s:b.m1,e:b.p0,wait:1}]:[])])],['③ 生地投入',bs.map(b=>({s:b.p0,e:b.p1,c:col(b)}))],
    ['④ 押し出し',bs.map(b=>({s:b.d0,e:b.d1,c:col(b),lb:`${b.n}個`}))],['⑤ フライ・油切り',band('fry')],['⑥ 蜜かけ',band('glaze','glaze')],['⑦ 冷却',band('cool')],['＋ チョコ',band('choco','choco')],['⑧ 検査',band('insp')],['⑨ 包装',band('pack')],
    ['⑩ 箱詰め',r.boxes.map(b=>({s:b.b0,e:b.c1,c:K.box,box:1}))],['⑪ 出荷',r.loads.map(l=>({s:l.l0,e:l.l1,c:K.box,box:1}))]];
  const cv=$('dgantt');cv.height=(GTOP+GROWS.length*24+14)*2;cv.width=GW*2;
  $('dglegend').innerHTML=r.products.map(p=>`<span><i style="background:${p.color}"></i>${esc(p.name)}</span>`).join('')+`<span><i style="background:rgba(150,150,150,.35)"></i>ホッパーの空きを待つ・カーテンを止めて通る</span><span><i style="background:${K.box}"></i>箱</span><span><i style="background:${K.bad};border-radius:50%"></i>検査ではじいた</span>`;}
// タイムラインの右端：トラックが出てから少しあと（夜の終わりまで描くと、空いたところが広くなるため）
const gEnd=()=>Math.min(R.T1,Math.ceil((R.go+20)/30)*30);
const gx=t=>GL+(t-R.T0)/(gEnd()-R.T0)*(GR-GL);
function drawGantt(t){const cv=$('dgantt');if(!cv||!R)return;const x=cv.getContext('2d'),H=cv.height/2,rh=24;x.setTransform(2,0,0,2,0,0);x.clearRect(0,0,GW,H);x.lineWidth=1;x.font='12px "Zen Kaku Gothic New","Hiragino Sans",sans-serif';
  for(let m=Math.ceil(R.T0/15)*15;m<=gEnd();m+=15){const xx=gx(m);x.strokeStyle=K.steel2;x.globalAlpha=m%60===0?0.8:0.35;x.beginPath();x.moveTo(xx,GTOP-4);x.lineTo(xx,H-10);x.stroke();x.globalAlpha=1;if(m%30===0){x.fillStyle=K.ink;x.textAlign='center';x.fillText(C.hm(m),xx,18);}}
  {const xx=gx(D.deadline);if(xx<GR){x.strokeStyle=K.bad;x.setLineDash([4,3]);x.beginPath();x.moveTo(xx,GTOP-4);x.lineTo(xx,H-10);x.stroke();x.setLineDash([]);x.fillStyle=K.bad;x.textAlign='left';x.fillText('締め切り',xx+3,GTOP-6);}}
  GROWS.forEach(([name,bars],i)=>{const y=GTOP+i*rh;if(i%2){x.fillStyle='rgba(127,127,127,.06)';x.fillRect(GL,y,GR-GL,rh);}x.fillStyle=K.ink;x.textAlign='left';x.fillText(name,6,y+rh/2+4);
    for(const b of bars){if(b.s==null||b.e==null)continue;const a=gx(b.s),w=Math.max(1.5,gx(b.e)-a);x.fillStyle=b.wait||b.pass?'rgba(150,150,150,.35)':b.c;x.globalAlpha=b.box?0.95:0.85;x.beginPath();x.roundRect(a,y+4,w,rh-8,2);x.fill();x.globalAlpha=1;
      if(!b.box){x.strokeStyle=K.ink;x.lineWidth=0.5;x.stroke();x.lineWidth=1;}if(b.lb&&w>22){x.fillStyle='#222';x.textAlign='center';x.font='10px sans-serif';x.fillText(b.lb,a+w/2,y+rh/2+4);x.font='12px "Zen Kaku Gothic New","Hiragino Sans",sans-serif';}}});
  const yi=GTOP+8*rh,ins=R.O.find(o=>o[0]==='insp');let nb=0;for(let i=0;i<R.dep.length&&nb<200;i++)if(R.bad[i]){nb++;x.fillStyle=K.bad;x.beginPath();x.arc(gx(R.dep[i]+(ins[1]+ins[2])/2),yi+rh/2,3.5,0,7);x.fill();}
  {const xx=gx(R.go);x.fillStyle=K.ink;x.textAlign='left';x.fillText('出発 '+C.hm(R.go),Math.min(GR-70,xx+4),GTOP+11*rh+rh/2+4);}
  const nx=gx(Math.min(gEnd(),Math.max(R.T0,t)));x.strokeStyle='#d33';x.lineWidth=2;x.beginPath();x.moveTo(nx,GTOP-6);x.lineTo(nx,H-8);x.stroke();{const lx=Math.min(GR-22,Math.max(GL+22,nx)),lb=C.hm(t);x.fillStyle='#d33';x.beginPath();x.roundRect(lx-21,4,42,17,4);x.fill();x.fillStyle='#fff';x.textAlign='center';x.fillText(lb,lx,17);}x.lineWidth=1;}

/* ---------------- 描く ---------------- */
function draw(force){if(!R)return;const t=Math.floor(cur);$('dclock').textContent=C.hm(cur);$('dscrub').value=t;$('dplay').textContent=playing?'❚❚ 止める':'▶ 再生';
  drawPanels(cur);drawGantt(cur);if(minute===t&&!force)return;minute=t;liveNote();
  $('devents').innerHTML=R.ev.filter(e=>e.t<=t).slice(-16).reverse().map(e=>`<li><span class="num">${C.hm(e.t)}</span><span>${esc(e.msg)}</span></li>`).join('')||'<li>これから仕込みます。</li>';
  const opened=[...$('dbatches').querySelectorAll('details')].map(e=>e.open);
  $('dbatches').innerHTML=R.batches.map((b,i)=>{const p=R.products.find(p=>p.id===b.prod),st=t<b.w0?'まだ':t<b.w1?'計量':t<b.m0?'ミキサー待ち':t<b.m1?'ミキサー':t<b.p0?'ホッパー待ち':t<b.p1?'投入':t<b.d1?'押し出し中':t<b.d1+R.O.at(-1)[2]?'ラインを流れている':'包み終わり';
    return `<details ${opened[i]?'open':''}><summary><span class="ddot" style="background:${p.color}"></span>第${i+1}回 ${esc(p.name)} ${b.n}個 — ${st}</summary><p class="small">計量 ${C.hm(b.w0)}〜${C.hm(b.w1)}<br>ミキサー ${C.hm(b.m0)}〜${C.hm(b.m1)}${b.wait>0.2?`<br>ホッパー待ち ${Math.round(b.wait)}分`:''}<br>投入 ${C.hm(b.p0)}〜${C.hm(b.p1)}<br>押し出し ${C.hm(b.d0)}〜${C.hm(b.d1)}<br>包み終わり ${C.hm(b.d1+R.O.at(-1)[2])}</p></details>`;}).join('');
  if(t>=R.T1)result();}
async function init(){if(!$('donutView'))return;colors();
  try{D=await fetch('data/factory.json',{cache:'no-cache'}).then(r=>r.json());let st={};try{st=JSON.parse(getItem(KEY)||'{}')||{};}catch(e){}cfg=C.normalize(D,st.cfg);delete cfg.center;plan();buildPanels();run();}
  catch(e){$('dplan').textContent='ドーナッツの設定を読み込めませんでした。ページを再読み込みしてください。';console.error(e);return;}
  $('drun').onclick=()=>{run();playing=true;draw(true);};$('dnewNight').onclick=()=>{cfg.seed=cfg.seed%9999+1;run();};
  $('dplay').onclick=()=>{if(cur>=R.T1&&speed!=='live')cur=R.T0;playing=!playing;minute=-1;draw(true);};
  $('dscrub').oninput=e=>{cur=+e.target.value;if(speed==='live'&&playing)playing=false;minute=-1;draw(true);};
  $('dspeed').onchange=e=>{const v=e.target.value;speed=v==='live'?'live':+v;playing=true;if(cur>=R.T1&&speed!=='live')cur=R.T0;minute=-1;draw(true);};$('dpeek').onclick=result;
  $('dgantt').addEventListener('click',e=>{const r=e.currentTarget.getBoundingClientRect(),xx=(e.clientX-r.left)/r.width*GW;if(xx<GL)return;cur=Math.max(R.T0,Math.min(R.T1,R.T0+(xx-GL)/(GR-GL)*(gEnd()-R.T0)));if(speed==='live')playing=false;minute=-1;draw(true);});
  const set=v=>{active=v==='donut';if(active){$('lineName').textContent=D.donut.line;minute=-1;draw(true);}};window.addEventListener('factory-tab',e=>set(e.detail));set(!$('donutView').hidden?'donut':'');
  matchMedia('(prefers-color-scheme:dark)').addEventListener('change',()=>{colors();if(R){buildGantt();draw(true);}});
  function tick(now){if(active&&!document.hidden){if(playing){if(speed==='live')cur=FL.liveAt(R.T0,R.T1);else{cur=Math.min(R.T1,cur+Math.min(0.25,(now-last)/1000)*speed/60);if(cur>=R.T1)playing=false;}}
      if(playing&&now-lastDraw>=33){lastDraw=now;draw();}}last=now;requestAnimationFrame(tick);}requestAnimationFrame(tick);}
window.minatoDonut={seek:t=>{cur=t;playing=false;minute=-1;draw(true);},get R(){return R;}};
init();
})();
