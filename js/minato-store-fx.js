/* =====================================================================
   港駅の売店の絵の第2段（港駅の売店をつくる回の9回目・2026-11-10）
   ・js/minato-store-view.js の draw から呼ばれ、店の中の絵に重ねるだけ。計算の結果（res.ev）とその日の条件（天気・季節・
     客船の日・できたての便）を時刻の順に描く。描くために出来事を足さない。ゲームの時刻 Tn だけで形が決まる。
   ・under(c,F)：床と棚の上・人の下（濡れた床・足あと・荷物の台車・できたての札・客船の日の旗）
     over(c,F)：人の上（カップ麺の3分・湯気・見える範囲の扇形・汽笛・雨と雪）
     closed(c,F)：閉店のあと（1日の足あと）。足あとは結果ごとに1回だけ作って使い回す。
   ・F：{res, Tn, cfg, st, cond, port（橋 port-to-all の結果）, sd（橋 factory-to-kiosk-sameday の結果）, acts, fan}
   ・軽さ：毎コマの計算は、いまの時刻のまわりの出来事だけ（二分探索）。雨・雪の粒は24個まで。
   ===================================================================== */
(function(){
'use strict';
if(typeof MinatoAnim==='undefined')return;
const A=MinatoAnim,MAP=A.MAP,WY=MAP.wallY;
const C={foot:null,footRes:null,eat:null,eatRes:null,deli:null,deliRes:null};
const lerp=(a,b,f)=>[a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f];
function pill(c,x,y,t,bg,fg,size){c.font=`700 ${size||10}px "Zen Kaku Gothic New",sans-serif`;const w=c.measureText(t).width+10;c.fillStyle=bg;c.beginPath();c.roundRect(x-w/2,y-8,w,15,6);c.fill();c.fillStyle=fg||'#fff';c.textAlign='center';c.fillText(t,x,y+3);}
const genreOf=(F,pid)=>{const I=F._I||(F._I={});if(!I[pid]){const p=F.cfg.products.find(x=>x.id===pid);I[pid]=p?p.genre:'';}return I[pid];};

/* ---------- 荷物が届く：台車（センターの便）・できたての便（札つき）・地元のお店の人（手で） ---------- */
function deliveries(F){if(C.deliRes===F.res)return C.deli;C.deliRes=F.res;C.deli=F.res.ev.filter(e=>e.k==='delivery'&&e.n>0);return C.deli;}
const DUR=12,MOVE=7;   // 店に入ってから DUR 分いる（MOVE 分で棚まで運ぶ）。絵だけの数字
function cart(c,x,y,col,n,tag){c.fillStyle='rgba(0,0,0,.15)';c.fillRect(x-14,y+3,30,4);c.fillStyle='#6a6f74';c.fillRect(x-14,y-2,28,4);
  const k=Math.min(3,1+Math.floor(n/40));for(let i=0;i<k;i++){c.fillStyle=col;c.fillRect(x-12,y-9-i*8,24,8);c.strokeStyle='rgba(0,0,0,.25)';c.strokeRect(x-12+.5,y-9-i*8+.5,23,7);}
  c.fillStyle='#333';c.beginPath();c.arc(x-10,y+3,2.5,0,7);c.arc(x+10,y+3,2.5,0,7);c.fill();c.strokeStyle='#555';c.lineWidth=1.5;c.beginPath();c.moveTo(x+14,y-2);c.lineTo(x+18,y-22);c.stroke();
  if(tag)pill(c,x,y-12-k*8,tag,'#d8582e');}
function drawDeli(c,F){const T=F.Tn;let k=0;for(const e of deliveries(F)){if(T<e.t||T>=e.t+DUR)continue;const f=Math.min(1,(T-e.t)/MOVE),dx=(k++)*34;   // 同じ時刻に届いたもの（店を開いた時刻にまとめて届いた日など）は、少しずつずらす
    const to=e.local?[470,150]:e.sameday?[235,190]:[e.name==='朝の便'?215:235,e.name==='朝の便'?140:190];
    const p0=f<0.4?lerp([150,445],[110,300],f/0.4):lerp([110,300],to,(f-0.4)/0.6),p=[p0[0]+dx,p0[1]];
    if(e.local){// 地元のお店の人が、手さげのかごで届ける
      c.fillStyle='#c4302b';c.beginPath();c.roundRect(p[0]-5,p[1]-26,10,18,3);c.fill();c.fillStyle='#f0c9a0';c.beginPath();c.arc(p[0],p[1]-31,5,0,7);c.fill();
      c.fillStyle='#b08a50';c.fillRect(p[0]+5,p[1]-18,10,8);c.fillStyle='#333';c.fillRect(p[0]-4,p[1]-8,3,8);c.fillRect(p[0]+1,p[1]-8,3,8);
      pill(c,p[0],p[1]-44-((k-1)%2)*17,e.name,'#7a4a2a');}
    else cart(c,p[0],p[1],e.sameday?'#e9b44c':'#5b8fb0',e.n,e.sameday?'できたて':null);}}
/* できたての札：着いてから決まった時間、その品の棚に「できたて」の札 */
function slotRect(F,zk,i){const Fx=MAP.fx[zk],z=F.cfg.zones[zk];if(!Fx||!z)return null;const [x,y,w,d,h]=Fx,rw=w-4,rh=d-4,R=z.rows,Cc=z.cols;
  const r=Math.floor(i/z.cols),cc=i%z.cols;return [x+2+cc*rw/Cc,y-h+2+r*rh/R,rw/Cc-1,rh/R-1];}
function drawTag(c,F){const sd=F.sd;if(!sd||F.Tn<sd.tag.from||F.Tn>=sd.tag.to)return;const L=F.st.layout;
  for(const zk in L)(L[zk]||[]).forEach((pid,i)=>{if(!pid||!sd.tag.pids[pid])return;const s=slotRect(F,zk,i);if(!s)return;
    c.fillStyle='#d8582e';c.beginPath();c.moveTo(s[0]+s[2]/2-6,s[1]-1);c.lineTo(s[0]+s[2]/2+6,s[1]-1);c.lineTo(s[0]+s[2]/2,s[1]+5);c.closePath();c.fill();
    c.fillStyle='#fff7e0';c.fillRect(s[0]+s[2]/2-1,s[1]-4,2,3);});
  const s=MAP.fx.shelf;pill(c,s[0]+s[2]/2,s[1]+s[3]+9,'できたて（'+fm(sd.tag.to)+'まで）','#d8582e');}
const fm=t=>Math.floor(t/60)%24+':'+String(Math.floor(t%60)).padStart(2,'0');

/* ---------- 天気：濡れた床・雪の入口・海風 ---------- */
function drawFloor(c,F){const wx=F.cond&&F.cond.wx;if(wx==='rain'||wx==='snow'){const g=c.createRadialGradient(150,440,6,150,430,110);
    g.addColorStop(0,wx==='snow'?'rgba(255,255,255,.55)':'rgba(120,160,190,.35)');g.addColorStop(1,'rgba(120,160,190,0)');c.fillStyle=g;c.fillRect(40,330,230,126);
    c.strokeStyle=wx==='snow'?'rgba(255,255,255,.7)':'rgba(90,130,160,.35)';c.lineWidth=2;for(let i=0;i<5;i++){const x=128+i*14,y=420-i*22;c.beginPath();c.ellipse(x,y,4,2,0,0,7);c.stroke();}
    // 黄色い立て札と、傘立ての傘
    c.fillStyle='#e8c22c';c.beginPath();c.moveTo(214,418);c.lineTo(226,446);c.lineTo(202,446);c.closePath();c.fill();c.fillStyle='#333';c.font='700 9px sans-serif';c.textAlign='center';c.fillText('!',214,442);
    pill(c,214,408,'足もとに注意','#8a6a10');
    const u=MAP.fx.umbrella;for(let i=0;i<4;i++){c.strokeStyle=['#3a6ab0','#c4302b','#2f8a6e','#555'][i];c.lineWidth=2;c.beginPath();c.moveTo(u[0]+5+i*5,u[1]-u[4]);c.lineTo(u[0]+3+i*6,u[1]-u[4]-14);c.stroke();}}}
function drawWeather(c,F,vw){const wx=F.cond&&F.cond.wx,T=F.Tn,win=F.cond&&F.cond.season==='win';
  if(wx==='rain'||wx==='snow'){// 改札口の向こう（外）から入ってくる雨・雪：コンコースの下の帯に粒
    for(let i=0;i<24;i++){const ph=((T*(wx==='snow'?0.7:3)+i*0.137)%1),x=(i*97)%1000,y=WY+30+ph*110;
      if(wx==='snow'){c.fillStyle='rgba(255,255,255,.85)';c.beginPath();c.arc(x+Math.sin(T*2+i)*6,y,2.2,0,7);c.fill();}
      else{c.strokeStyle='rgba(110,150,190,.55)';c.lineWidth=1.2;c.beginPath();c.moveTo(x,y);c.lineTo(x-3,y+9);c.stroke();}}}
  if(win){// 冬の海風：改札口から吹きこむ風の筋
    c.strokeStyle='rgba(160,190,210,.45)';c.lineWidth=1.5;for(let i=0;i<5;i++){const ph=((T*1.4+i*0.21)%1),x=40+ph*900,y=WY+40+i*18;c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x+30,y-6,x+60,y);c.stroke();}
    pill(c,60,WY+24,'海風','#5a7a8a');}}

/* ---------- イートイン：カップ麺の3分・湯気 ---------- */
function eats(F){if(C.eatRes===F.res)return C.eat;C.eatRes=F.res;C.eat=F.res.ev.filter(e=>e.k==='eatin');return C.eat;}
function drawEat(c,F){const T=F.Tn,E=(F.cfg.walk&&F.cfg.walk.eatIn)||{},wait=(E.water&&E.water.wait)||3;
  for(const e of eats(F)){if(T<e.t||T>=e.to)continue;const g=genreOf(F,e.pid);for(const si of e.seats||[e.seat]){const [x,y]=MAP.seat(si);
    if(g==='cupmen'&&T<e.t+wait){const f=(T-e.t)/wait;c.fillStyle='#fff';c.beginPath();c.arc(x+16,y-30,8,0,7);c.fill();c.strokeStyle='#c4302b';c.lineWidth=2.5;c.beginPath();c.arc(x+16,y-30,6,-Math.PI/2,-Math.PI/2+f*Math.PI*2);c.stroke();
      c.fillStyle='#333';c.font='700 8px sans-serif';c.textAlign='center';c.fillText(Math.ceil(wait-(T-e.t))+'分',x+16,y-17);}
    else if(g==='cupmen'||g==='bento'||g==='hot'){c.strokeStyle='rgba(255,255,255,.8)';c.lineWidth=1.5;for(let k=0;k<2;k++){const o=Math.sin(T*40+k*2+si)*2;c.beginPath();c.moveTo(x+12+k*5,y-14);c.quadraticCurveTo(x+14+k*5+o,y-20,x+12+k*5,y-26);c.stroke();}}}}}

/* ---------- 防犯：見える範囲（扇形）。ミラー2つ・カメラ2台・レジの店員 ---------- */
function fan(c,x,y,a0,a1,r,col){c.fillStyle=col;c.beginPath();c.moveTo(x,y);c.arc(x,y,r,a0,a1);c.closePath();c.fill();}
function drawFan(c,F){const D=Math.PI/180;c.save();c.globalCompositeOperation='multiply';c.fillStyle='rgba(40,40,60,.18)';c.fillRect(30,70,940,WY-70);c.restore();
  const col='rgba(255,236,150,.32)';
  fan(c,950,80,110*D,175*D,520,col);fan(c,42,WY-10,-80*D,-5*D,430,col);   // カメラ（右上・左下）
  fan(c,44,82,10*D,80*D,260,col);fan(c,410,82,30*D,150*D,230,col);          // ミラー（左上・おみやげの上）
  const K=A.clerks(F.res,F.Tn).list;for(const k of K)fan(c,k.x,k.y-10,-160*D,-20*D,240,'rgba(150,230,200,.28)');   // レジの店員から見える範囲
  pill(c,500,86,'見える範囲（黄：カメラ・ミラー／緑：店員）。暗いところが死角','#3a3f44',null,10);}

/* ---------- 客船の日：旗と汽笛 ---------- */
function drawFlags(c,F){const P=F.port;if(!P)return;for(let x=10;x<990;x+=26){const k=(x/26)|0;c.fillStyle=['#d33a3a','#f2c14e','#3a6ab0','#2f8a6e','#fff'][k%5];c.beginPath();c.moveTo(x,WY+8);c.lineTo(x+20,WY+8);c.lineTo(x+10,WY+22);c.closePath();c.fill();}
  c.strokeStyle='#555';c.lineWidth=1;c.beginPath();c.moveTo(0,WY+8);c.lineTo(1000,WY+8);c.stroke();
  pill(c,860,WY+36,'客船 '+P.call.ship.name+'（港浜ふ頭）','#22313a',null,11);}
function drawHorn(c,F){const P=F.port;if(!P)return;const T=F.Tn;for(const [t,txt] of [[P.call.arr,'ボォーッ（入港の汽笛）'],[P.call.dep,'ボォーッ（出港の汽笛）']]){if(T<t-1||T>=t+4)continue;
  const a=Math.min(1,(t+4-T)/2);c.globalAlpha=a;c.fillStyle='#fffbe6';c.beginPath();c.roundRect(700,WY+48,260,30,12);c.fill();c.fillStyle='#22313a';c.font='700 14px "Zen Kaku Gothic New",sans-serif';c.textAlign='center';c.fillText(txt,830,WY+68);
  c.strokeStyle='#22313a';c.lineWidth=2;for(let k=1;k<=3;k++){c.beginPath();c.arc(972,WY+63,6+k*6,-0.6,0.6);c.stroke();}c.globalAlpha=1;}}

/* ---------- 1日の足あと（閉店のあと） ---------- */
function footprints(F){if(C.footRes===F.res&&C.foot)return C.foot;C.footRes=F.res;const O0=F.cfg.open[0]*60,O1=F.cfg.open[1]*60;
  const cv=C.foot||(C.foot=document.createElement('canvas'));cv.width=1000;cv.height=600;const c=cv.getContext('2d');c.clearRect(0,0,1000,600);
  c.fillStyle='rgba(216,88,46,.035)';for(let t=O0;t<O1;t+=1){for(const o of A.at(F.acts,t,9999)){if(o.ph==='gone'||o.y>WY+4)continue;c.beginPath();c.arc(o.x,o.y,8,0,7);c.fill();}}
  return cv;}
function closed(c,F){c.fillStyle='rgba(20,24,28,.35)';c.fillRect(0,40,1000,560);if(F.acts&&F.res){c.drawImage(footprints(F),0,0);}
  c.fillStyle='rgba(15,20,24,.8)';c.beginPath();c.roundRect(300,250,400,74,10);c.fill();c.fillStyle='#fff';c.font='700 20px sans-serif';c.textAlign='center';c.fillText('本日の営業は終わりました',500,280);
  c.font='13px "Zen Kaku Gothic New",sans-serif';c.fillStyle='#ffcfa8';c.fillText('オレンジの濃いところ＝きょう、人がよく歩いた・立ち止まった所',500,306);}

window.MinatoFx={
  under(c,F){if(!F.res)return;drawFloor(c,F);drawFlags(c,F);drawTag(c,F);drawDeli(c,F);},
  over(c,F){if(!F.res)return;drawEat(c,F);if(F.fan)drawFan(c,F);drawHorn(c,F);drawWeather(c,F);},
  closed};
})();
