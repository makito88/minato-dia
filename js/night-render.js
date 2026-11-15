/* =====================================================================
   夜の光：絵の部分（第9回・2026-11-15）。ゲームの地図（js/night-view.js）とお絵かき帖（js/night-edit.js）で同じ絵。
   ・build：数分ごとに1枚ずつ作る「夜の幕」（veil）と「光」（glow）のオフスクリーンの canvas。
       幕：上が少し濃い紺のグラデーション。明かりのまわりは幕を薄くして、下の水彩の絵の色が見えるように。
       光：まちの明かり（窓・格子の窓・看板）、道の帯（芯は細く、にじみで太さ）と街灯、駅のホームの屋根、港の灯り、星、
           明かりの多さを小さな絵にして3段階にぼかした「にじみ」。白く飛ばないように、色は少しずつ重ねる。
   ・dyn：毎コマ描く小さな光（航空障害灯・煙突とクレーンの赤い点滅・下から照らされる湯気・回る灯台の光・水面の揺れ・
          大通りを流れる車のライト・イベントの光・列車の窓の明かりの帯）。数は data/night-light.json の budget.dyn まで。
   計算（どこに・いつ）は js/night-core.js。ここは描くだけ。
   ===================================================================== */
(function(){
'use strict';
const N=window.NightCore;if(!N)return;
const SPR=new Map();
function hexRgb(h){const v=parseInt(String(h).slice(1),16);return [(v>>16)&255,(v>>8)&255,v&255];}
// 光の粒の絵（色ごとに1回だけ作る）
function sprite(col){let s=SPR.get(col);if(s)return s;const R=32,cv=mk(R*2,R*2),g=cv.getContext('2d'),[r,gg,b]=hexRgb(col);
  const gr=g.createRadialGradient(R,R,0,R,R,R);gr.addColorStop(0,`rgba(${r},${gg},${b},1)`);gr.addColorStop(0.18,`rgba(${r},${gg},${b},.55)`);gr.addColorStop(0.45,`rgba(${r},${gg},${b},.16)`);gr.addColorStop(1,`rgba(${r},${gg},${b},0)`);
  g.fillStyle=gr;g.fillRect(0,0,R*2,R*2);SPR.set(col,cv);return cv;}
function mk(w,h){if(typeof OffscreenCanvas!=='undefined'&&!mk.dom)try{return new OffscreenCanvas(w,h);}catch(e){mk.dom=true;}const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
function canvasOf(o,w,h){if(!o||o.width!==w||o.height!==h){o=mk(w,h);}return o;}
const glowAt=(g,col,x,y,r,a,sy)=>{if(a<=0.003)return;g.globalAlpha=Math.min(1,a);g.drawImage(sprite(col),x-r,y-r*(sy||1),r*2,r*2*(sy||1));};

/* ---------- 1枚の光の絵を作る ----------
   S：{cfg, G(マス目), L(明かり), stars, roads:{runs,lamps}, stations:[{x,y,ang}], minute, wx, scale, W, H, pal}
   out：前の {veil,glow}（同じ大きさなら使い回す） */
function build(S,out){out=out||{};const {cfg,G,minute,scale}=S,W=Math.max(1,S.W|0),H=Math.max(1,S.H|0),V=cfg.veil||{},rain=S.wx==='rain',snow=S.wx==='snow';
  const Z={};(cfg.zones||[]).forEach(z=>Z[z.code]=z);const fr={};for(const z of cfg.zones||[])fr[z.code]=z.sched?N.frac(z.sched,minute):0;
  // 明かりの多さ（マスごと・色つき）：にじみと幕の穴に使う
  const {gw,gh,c}=G,acc=new Float32Array(gw*gh*3);
  const add=(x,y,col,w)=>{const i=Math.max(0,Math.min(gw-1,(x/c)|0)),j=Math.max(0,Math.min(gh-1,(y/c)|0)),k=(j*gw+i)*3,[r,g,b]=hexRgb(col);acc[k]+=r*w;acc[k+1]+=g*w;acc[k+2]+=b*w;};
  /* --- 光 --- */
  const glow=out.glow=canvasOf(out.glow,W,H),g=glow.getContext('2d');g.setTransform(1,0,0,1,0,0);g.globalCompositeOperation='source-over';g.globalAlpha=1;g.clearRect(0,0,W,H);
  g.setTransform(scale,0,0,scale,0,0);g.globalCompositeOperation='lighter';g.lineCap='round';g.lineJoin='round';
  // 道の帯：にじみ（広くうすく）→ 中 → 芯（細く）。雨の日は路面がぬれて、広い照り返し
  const R=cfg.roads||{};
  for(const run of S.roads.runs){const st=R[run.st];if(!st)continue;const lv=N.frac(st.sched,minute);if(lv<=0.01)continue;
    g.strokeStyle=st.color;g.beginPath();run.pts.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]));
    if(rain){g.globalAlpha=st.a*0.22*lv;g.lineWidth=st.w*1.7;g.stroke();}
    g.globalAlpha=st.a*0.28*lv;g.lineWidth=st.w;g.stroke();
    g.globalAlpha=st.a*0.5*lv;g.lineWidth=st.w*0.38;g.stroke();
    g.strokeStyle=st.lampColor||st.color;g.globalAlpha=Math.min(0.75,st.a*1.25)*lv;g.lineWidth=st.core;g.stroke();
    const wgt=st.a*lv*0.9;for(let i=0;i<run.pts.length;i+=2)add(run.pts[i][0],run.pts[i][1],st.color,wgt);}
  // 街灯（深夜は消えるものもある）
  for(const lp of S.roads.lamps){const st=R[lp.st];if(!st)continue;const lv=N.frac(st.sched,minute);if(lp.th>lv*1.05)continue;
    glowAt(g,st.lampColor||st.color,lp.x,lp.y,rain?3.4:2.4,0.55*Math.min(1,lv+0.2));if(rain)glowAt(g,st.lampColor||st.color,lp.x,lp.y+3.5,2.2,0.28,2.6);
    if(G.water[(Math.min(gh-1,((lp.y+3)/c)|0))*gw+Math.min(gw-1,(lp.x/c)|0)])glowAt(g,st.lampColor||st.color,lp.x,lp.y+6,2,0.3,3.2);}
  // まちの明かり：色ごとにまとめて描く（小さな四角）。看板は粒の光も
  const groups=S.groups;for(const [col,arr] of groups){g.fillStyle=col;g.globalAlpha=0.92;g.beginPath();let any=false;
    for(const l of arr){const f=fr[l.z];if(!(f>l.th))continue;any=true;const s=l.s;g.rect(l.x-s/2,l.y-s/2,s,s);add(l.x,l.y,col,l.g);}
    if(any)g.fill();}
  for(const l of S.L){if(l.kind!=='s')continue;const f=fr[l.z];if(!(f>l.th))continue;glowAt(g,l.col,l.x,l.y,2.6*l.s,0.35);if(rain)glowAt(g,l.col,l.x,l.y+3,2.2*l.s,0.18,2.4);}
  // 窓の明かりの小さな光の粒（多すぎないように、3つに1つ）
  for(let i=0;i<S.L.length;i+=3){const l=S.L[i];if(l.kind!=='w')continue;const f=fr[l.z];if(!(f>l.th))continue;glowAt(g,l.col,l.x,l.y,rain?2.4:1.7,0.22*l.g);}
  // 駅のホームの屋根
  const SC=cfg.stations||{};for(const s of S.stations||[]){const len=(SC.len||30)*(s.big?1.25:1);g.save();g.translate(s.x,s.y);g.rotate(s.ang||0);g.globalAlpha=SC.a||0.5;g.drawImage(sprite(SC.color||'#f4f7ff'),-len*0.62,-5,len*1.24,10);
    g.globalAlpha=0.8;g.fillStyle=SC.color||'#f4f7ff';g.fillRect(-len/2,-2.6,len,0.5);g.fillRect(-len/2,2.1,len,0.5);g.restore();add(s.x,s.y,SC.color||'#f4f7ff',3);add(s.x-8,s.y,SC.color||'#f4f7ff',2);add(s.x+8,s.y,SC.color||'#f4f7ff',2);}
  // 港：岸壁の灯り・タンクの輪郭・クレーンの足もと
  const P=cfg.port||{};
  for(const [a,b] of P.piers||[]){const L=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.max(2,Math.round(L/7));for(let i=0;i<=n;i++){const x=a[0]+(b[0]-a[0])*i/n,y=a[1]+(b[1]-a[1])*i/n,col=i%3?'#d8ecff':'#ffb057';
    glowAt(g,col,x,y,2.4,0.4);glowAt(g,col,x,y+7,2,0.16,3.4);add(x,y,col,0.6);}}
  for(const [x,y,r] of P.tanks||[]){for(let i=0;i<10;i++){const a=i/10*6.283;glowAt(g,'#ffcf8a',x+Math.cos(a)*r,y+Math.sin(a)*r*0.6,0.9,0.7);}add(x,y,'#ff9b3e',2);}
  for(const [x,y] of P.cranes||[]){glowAt(g,'#eef7ff',x,y+4,6,0.4);add(x,y,'#d8ecff',2.5);}
  // 星（暗いところ）。雪の夜は見えない
  if(!snow&&!rain){g.fillStyle='#fffbe8';for(const s of S.stars){g.globalAlpha=s.b*(S.wx==='cloudy'?0.25:0.7);g.fillRect(s.x-0.3,s.y-0.3,0.6,0.6);}}
  // にじみ：明かりの多さの小さな絵を、3段階にぼかして重ねる
  const small=out.small=canvasOf(out.small,gw,gh),sg=small.getContext('2d'),img=sg.createImageData(gw,gh),d=img.data;
  for(let k=0;k<gw*gh;k++){const r=acc[k*3],gg=acc[k*3+1],b=acc[k*3+2],sum=r+gg+b;if(sum<=0)continue;const lum=sum/765,a=Math.min(0.62,1-Math.exp(-lum*0.32)),m=225/Math.max(r,gg,b);
    d[k*4]=r*m;d[k*4+1]=gg*m;d[k*4+2]=b*m;d[k*4+3]=a*255;}
  sg.putImageData(img,0,0);
  const mid=out.mid=canvasOf(out.mid,Math.ceil(gw/3),Math.ceil(gh/3)),mg=mid.getContext('2d');mg.clearRect(0,0,mid.width,mid.height);mg.imageSmoothingEnabled=true;mg.drawImage(small,0,0,mid.width,mid.height);
  const big=out.big=canvasOf(out.big,Math.ceil(gw/9),Math.ceil(gh/9)),bg=big.getContext('2d');bg.clearRect(0,0,big.width,big.height);bg.imageSmoothingEnabled=true;bg.drawImage(mid,0,0,big.width,big.height);
  g.setTransform(1,0,0,1,0,0);g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';const k1=(rain?1.3:1);
  g.globalAlpha=0.16*k1;g.drawImage(small,0,0,gw*c*scale,gh*c*scale);
  g.globalAlpha=0.34*k1;g.drawImage(mid,0,0,mid.width*3*c*scale,mid.height*3*c*scale);
  g.globalAlpha=0.34*k1;g.drawImage(big,0,0,big.width*9*c*scale,big.height*9*c*scale);
  g.globalAlpha=1;g.globalCompositeOperation='source-over';
  /* --- 幕 --- */
  const veil=out.veil=canvasOf(out.veil,W,H),v=veil.getContext('2d');v.setTransform(1,0,0,1,0,0);v.globalCompositeOperation='source-over';v.globalAlpha=1;v.clearRect(0,0,W,H);
  const gr=v.createLinearGradient(0,0,0,H);gr.addColorStop(0,V.top||'#0a1430');gr.addColorStop(1,V.bottom||'#14193a');v.fillStyle=gr;
  v.globalAlpha=Math.min(0.95,(V.alpha||0.6)*(snow?(V.snow||0.72):rain?(V.rain||1.05):1));v.fillRect(0,0,W,H);
  if(snow){v.globalAlpha=0.1;v.fillStyle='#dfe8ff';v.fillRect(0,0,W,H);}
  v.globalCompositeOperation='destination-out';v.imageSmoothingEnabled=true;v.imageSmoothingQuality='high';
  v.globalAlpha=V.hole||0.55;v.drawImage(mid,0,0,mid.width*3*c*scale,mid.height*3*c*scale);v.globalAlpha=(V.hole||0.55)*0.6;v.drawImage(small,0,0,gw*c*scale,gh*c*scale);
  v.globalCompositeOperation='source-over';v.globalAlpha=1;
  return out;}
// 明かりを色ごとに分ける（作り直しのたびにしなくてよいもの）
function groups(L){const m=new Map();for(const l of L){if(l.kind==='s')continue;let a=m.get(l.col);if(!a)m.set(l.col,a=[]);a.push(l);}return m;}

/* ---------- 毎コマの小さな光（地図の座標の変換がかかった c に描く） ----------
   D：{cfg, minute, dk, t(本当の秒), wx, avi, runs(道の帯), events:[{fx,x,y,rim}], trains:[{x,y}]} */
function dyn(c,D){const cfg=D.cfg,a0=Math.min(1,D.dk*1.3),t=D.t,P=cfg.port||{};if(a0<=0.02)return 0;let n=0;const lim=(cfg.budget&&cfg.budget.dyn)||160;
  c.save();c.globalCompositeOperation='lighter';
  // イベントの光（いちばん先に。数の上限は車のライトで調整する）
  for(const e of D.events||[])n+=evFx(c,e,t,a0);
  // 列車の窓の明かりの帯
  const TR=cfg.trains||{};for(const p of D.trains||[]){if(n>lim)break;glowAt(c,TR.color||'#ffe7b0',p.x,p.y,5.5,(TR.a||0.3)*a0);n++;}
  // 航空障害灯（ゆっくり点滅）
  const AV=cfg.aviation||{},per=AV.period||2.6;
  for(const p of D.avi||[]){const u=((t/per+p.ph/6.283)%1),b=u<0.18?Math.sin(u/0.18*Math.PI):0;if(b<=0.02)continue;glowAt(c,AV.color||'#ff3b30',p.x,p.y,3.2,0.85*b*a0);c.globalAlpha=b*a0;c.fillStyle='#ffb3ad';c.fillRect(p.x-0.3,p.y-0.3,0.6,0.6);n++;}
  // 煙突・塔の先（赤い点滅）と、下から照らされる湯気
  (P.stacks||[]).forEach(([x,y],i)=>{const b=((t*0.8+i*0.37)%1)<0.5?1:0.15;glowAt(c,'#ff3b30',x,y-3,2.4,0.8*b*a0);
    for(let q=0;q<3;q++){const u=((t/7+q/3+i*0.21)%1),px=x+Math.sin(u*3+i)*3+u*10,py=y-4-u*16,r=3+u*8;glowAt(c,'#ff9b4a',px,py,r,0.16*(1-u)*a0);glowAt(c,'#c9c2d8',px,py,r*0.8,0.07*(1-u)*a0);}n+=4;});
  (P.cranes||[]).forEach(([x,y],i)=>{const b=((t*0.5+i*0.29)%1)<0.3?1:0;if(b)glowAt(c,'#ff3b30',x,y-5,2.2,0.7*a0);
    for(let q=0;q<3;q++){const w=Math.sin(t*1.7+q*1.9+i)*0.9;glowAt(c,'#ffd9a0',x+w,y+9+q*3.2,1.6,0.22*a0,2.2);}n+=3;});
  // 岸壁の灯りの水面の揺れ
  (P.piers||[]).forEach(([a,b],i)=>{for(let q=0;q<4;q++){const u=(q+0.5)/4,x=a[0]+(b[0]-a[0])*u,y=a[1]+(b[1]-a[1])*u,w=Math.sin(t*2.1+q*1.7+i)*1.2;glowAt(c,q%2?'#d8ecff':'#ffb057',x+w,y+9+Math.sin(t*1.3+q)*1.2,1.8,0.2*a0,2.8);n++;}});
  // 回る灯台の光
  if(P.lighthouse){const [lx,ly]=P.lighthouse,ang=t*(2*Math.PI/7);c.save();c.translate(lx,ly);c.rotate(ang);const L=95;const gr=c.createLinearGradient(0,0,L,0);gr.addColorStop(0,`rgba(255,246,214,${0.42*a0})`);gr.addColorStop(1,'rgba(255,246,214,0)');
    c.globalAlpha=1;c.fillStyle=gr;c.beginPath();c.moveTo(0,0);c.lineTo(L,-9);c.lineTo(L,9);c.closePath();c.fill();c.restore();glowAt(c,'#fff6d6',lx,ly,4,0.9*a0);n+=2;}
  // 大通りを流れる車のライト（行きは白っぽい前照灯、帰りは赤い尾灯）
  const CR=cfg.cars||{},R=cfg.roads||{};
  for(const run of D.runs||[]){const st=R[run.st];if(!st||!st.cars||!run.len)continue;const lv=N.frac(st.sched,D.minute);const k=Math.round(run.len/100*(CR.per||3)*st.cars*lv);
    for(let q=0;q<k&&n<lim;q++){const dir=q%2?1:-1,h=N.hash(q,run.pts.length+run.len|0),s=(((h*run.len+dir*t*(CR.speed||9)*(0.8+h*0.4))%run.len)+run.len)%run.len;
      const p=along(run,s);if(!p)continue;const ox=-Math.sin(p.a)*1.1*dir,oy=Math.cos(p.a)*1.1*dir;
      if(dir>0){glowAt(c,CR.head||'#fff3d6',p.x+ox,p.y+oy,1.7,0.75*a0);}else{glowAt(c,CR.tail||'#ff4a3a',p.x+ox,p.y+oy,1.3,0.7*a0);}n++;}}
  c.restore();return n;}
function along(run,s){if(!run.cum){run.cum=[0];for(let i=1;i<run.pts.length;i++)run.cum.push(run.cum[i-1]+Math.hypot(run.pts[i][0]-run.pts[i-1][0],run.pts[i][1]-run.pts[i-1][1]));}
  const C=run.cum;let lo=0,hi=C.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(C[m]<=s)lo=m;else hi=m;}const a=run.pts[lo],b=run.pts[hi],L=(C[hi]-C[lo])||1e-6,u=(s-C[lo])/L;
  return {x:a[0]+(b[0]-a[0])*u,y:a[1]+(b[1]-a[1])*u,a:Math.atan2(b[1]-a[1],b[0]-a[0])};}
function evFx(c,e,t,a0){const x=e.x,y=e.y+24;
  if(e.fx==='lantern'){glowAt(c,'#ff9a4a',x,y,16,0.22*a0);for(let i=0;i<11;i++){const u=i/10,px=x-22+u*44,py=y+Math.sin(u*Math.PI)*5-2,f=0.7+0.3*Math.sin(t*6+i*1.7)*Math.sin(t*2.3+i);glowAt(c,i%2?'#ff6a3a':'#ffb35c',px,py,2.6,0.8*f*a0);}return 12;}
  if(e.fx==='hanabi'){let n=0;for(let b=0;b<3;b++){const per=3.1,u=((t+b*1.03)%per)/per;if(u>0.55)continue;const k=Math.floor((t+b*1.03)/per),h=N.hash(k,b),cx=x-24+h*48,cy=e.y-30-N.hash(k,b+9)*22,r=4+u/0.55*18,f=1-u/0.55;
      const cols=['#ff5a7a','#ffd36b','#7fd3ff','#b98bff','#7dffb0'],col=cols[Math.floor(h*cols.length)];glowAt(c,col,cx,cy,r*1.4,0.18*f*a0);
      for(let i=0;i<16;i++){const an=i/16*6.283+h;glowAt(c,col,cx+Math.cos(an)*r,cy+Math.sin(an)*r+u*6,1.5,0.85*f*a0);}n+=17;}return n;}
  if(e.fx==='stage'){glowAt(c,'#f2f6ff',x,y,20,0.4*a0);for(let i=0;i<3;i++){const an=-Math.PI/2+Math.sin(t*0.5+i*2.1)*0.9;c.save();c.translate(x+(i-1)*8,y);c.rotate(an);const L=70,gr=c.createLinearGradient(0,0,L,0);
      gr.addColorStop(0,`rgba(235,242,255,${0.32*a0})`);gr.addColorStop(1,'rgba(235,242,255,0)');c.globalAlpha=1;c.fillStyle=gr;c.beginPath();c.moveTo(0,-0.8);c.lineTo(L,-6);c.lineTo(L,6);c.lineTo(0,0.8);c.closePath();c.fill();c.restore();}return 5;}
  if(e.fx==='fes'){const hue=(t*45)%360,col=hsl(hue);glowAt(c,col,x,y,18,0.32*a0);for(let i=0;i<8;i++){const an=i/8*6.283+t*0.6;glowAt(c,hsl((hue+i*45)%360),x+Math.cos(an)*12,y+Math.sin(an)*6,2.2,0.7*a0);}return 9;}
  if(e.fx==='illum'){for(let i=0;i<34;i++){const h=N.hash(i,7),r=4+h*16,an=N.hash(i,8)*6.283,f=0.5+0.5*Math.sin(t*3.2+i*2.3);glowAt(c,i%3?'#fff2c4':'#bfe3ff',x+Math.cos(an)*r,y+Math.sin(an)*r*0.6,1.2,0.85*f*a0);}glowAt(c,'#fff2c4',x,y,14,0.14*a0);return 35;}
  return 0;}
const HSL=new Map();function hsl(h){h=Math.round(h/15)*15%360;let s=HSL.get(h);if(s)return s;const f=n=>{const k=(n+h/30)%12,a=0.9*Math.min(0.6,1-0.6);const v=0.6-a*Math.max(-1,Math.min(k-3,9-k,1));return Math.round(v*255).toString(16).padStart(2,'0');};s='#'+f(0)+f(8)+f(4);HSL.set(h,s);return s;}

window.NightRender={build,groups,dyn,sprite};
})();
