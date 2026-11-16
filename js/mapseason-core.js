/* =====================================================================
   地図の季節の見た目：計算の部分（第10回・2026-11-16。DOM を使わない・node で読める）。
   ・本当の暦の日付から「いまの季節の強さ」（梅・桜・散りぎわ・新緑・枯れ草・田んぼ・紅葉の前線・山の上の雪）を出す（weights）。
   ・雪は雪の日だけ積もり、晴れが続くと少しずつ解ける（snowCover。前の日から順に天気を読む）。
   ・地図の絵の1点ずつを「木・針葉樹・草・水」の割合に分け（attrs。1回だけ）、
     場所ごとの「山の高さ・田んぼ・桜・梅」（cells。塗りが先、なければ data/map-season.json の auto）と合わせて、
     その日の色に塗りかえる（recolor）。花の点（stamps）も、決まった乱数で毎回同じ場所に。
   ・やり方B（季節の絵）があれば、その季節の分は絵を混ぜ、計算の色は弱める（artMix）。
   設定は data/map-season.json。描くのは js/mapseason-render.js。見た目だけで、乗客・売店・お金の計算には何も渡さない。
   ===================================================================== */
(function(root){
'use strict';
const W=1000,H=420;
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const sm=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};

/* ---------- 暦：MM-DD → 年の何日目（うるう年でも同じ目盛り） ---------- */
const CUM=[0,31,59,90,120,151,181,212,243,273,304,334];
function md(s){const [m,d]=String(s).split('-').map(Number);return CUM[(m-1)|0]+d;}
function doy(ymd){const p=String(ymd).split('-').map(Number);return p.length>=3?CUM[(p[1]-1)|0]+p[2]:md(ymd);}
// 年をまたぐ幅にも使える「いまの日を幅の始まり以降に」
function rel(d,a){return d<a-60?d+365:d;}
function ramp(d,a,b){const A=md(a),B=md(b);let x=d;if(B<A&&x<A)x+=365;const bb=B<A?B+365:B;return sm(A,bb,x);}
// [始まり, 満開, 満開の終わり, 終わり] → 0〜1
function bump(d,q){if(!q)return 0;const a=md(q[0]);let b=md(q[1]),c=md(q[2]),e=md(q[3]);if(b<a)b+=365;if(c<a)c+=365;if(e<a)e+=365;
  let x=d;if(x<a&&x+365<=e+30)x+=365;if(x<a||x>e)return 0;return sm(a,b,x)*(1-sm(c,e,x));}

/* その日の季節の強さ（場所によらないもの） */
function weights(cfg,ymd){const D=cfg.dates,d=doy(ymd),o={d};
  for(const k of ['ume','sakura','petal','shinryoku','straw','renge','flood','young'])o[k]=bump(d,D[k]);
  o.golden=ramp(d,D.golden[0],D.golden[1])*(d<md('12-31')&&d>md('07-01')?1:0);
  // 稲刈り：田んぼごとに harvest の幅のどこかの日（場所の乱数で）。ここでは幅だけ渡す
  o.hv=[md(D.harvest[0]),md(D.harvest[1])];o.flooded=o.flood;
  // 山の上の雪のしきい
  o.cap=capLine(D.cap&&D.cap.line,d);
  // 全体の色味
  o.gWinter=bump(d,['12-01','12-28','02-20','03-20']);o.gAutumn=bump(d,['10-12','11-01','11-28','12-12']);o.gSpring=Math.max(o.sakura,o.ume*0.5);
  // やり方Bの絵の混ぜぐあい（絵があるときだけ使う）
  const P=(cfg.art&&cfg.art.peak)||{};o.art={spring:bump(d,P.spring),autumn:bump(d,P.autumn),winter:bump(d,P.winter)};
  return o;}
function capLine(line,d){if(!line||!line.length)return 9;const pts=line.map(([s,a])=>[md(s),a]);const a0=pts[0][0];let x=d;if(x<a0)x+=365;
  for(let i=0;i<pts.length;i++){if(pts[i][0]<a0)pts[i][0]+=365;}
  for(let i=0;i<pts.length-1;i++){const [x0,v0]=pts[i],[x1,v1]=pts[i+1];if(x>=x0&&x<=x1)return v0+(v1-v0)*sm(x0,x1,x);}return 9;}

/* 紅葉と落葉（場所の高さ a・場所の乱数 j＝-1〜1）→ {c: 色づき, b: 葉が落ちた} */
function leafAt(cfg,d,a,j){const M=cfg.dates.momiji,L=cfg.dates.leafout;
  if(d<md('07-01')){const s0=md(L[0])+a*16+j*4,s1=md(L[1])+a*16+j*4;return {c:0,b:1-sm(s0,s1,d)};}
  const s=md(M.start)+(1-a)*M.slope+j*(M.jitter||0),t=d-s;if(t<=0)return {c:0,b:0};
  const c=sm(0,M.turn,t),b=sm(M.turn+M.hold,M.turn+M.hold+M.fall,t);return {c:c*(1-b),b};}

/* ---------- 雪：前の日から順に天気を読む。wxOf(ymd) → {wx:'sun'|'cld'|'rain'|'snow', hi} ---------- */
function addDays(ymd,n){const [y,m,d]=ymd.split('-').map(Number);const t=new Date(Date.UTC(y,m-1,d+n));return t.getUTCFullYear()+'-'+String(t.getUTCMonth()+1).padStart(2,'0')+'-'+String(t.getUTCDate()).padStart(2,'0');}
function snowCover(cfg,ymd,wxOf,today){const S=cfg.snow||{},back=S.back||21;let lo=0,hi=0;
  for(let i=back;i>=0;i--){const y=addDays(ymd,-i);let w=null;try{w=i===0&&today?today:wxOf(y);}catch(e){}const wx=w&&w.wx||'sun';
    if(wx==='snow'){lo=Math.min(1,lo+(S.add||0.85));hi=Math.min(1,hi+(S.add||0.85));continue;}
    const warm=w&&w.hi!=null?Math.max(0,w.hi-5)*(S.warm||0):0,m=((S.melt&&S.melt[wx])!=null?S.melt[wx]:0.2)+warm;
    lo=Math.max(0,lo-m);hi=Math.max(0,hi-m*(S.mountain||0.5));}
  return {lo,hi};}

/* ---------- 決まった乱数・なめらかな乱数 ---------- */
function hash(a,b,c){let h=(Math.imul(a|0,0x9E3779B1)^Math.imul((b|0)+0x7F4A7C15,0x85EBCA77)^Math.imul((c|0)+0x165667B1,0xC2B2AE3D))>>>0;h^=h>>>15;h=Math.imul(h,0x2C1B3C6D)>>>0;h^=h>>>12;h=Math.imul(h,0x297A2D39)>>>0;h^=h>>>15;return (h>>>0)/4294967296;}
function vnoise(x,y,s){const xi=Math.floor(x),yi=Math.floor(y),fx=x-xi,fy=y-yi,u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy);
  const a=hash(xi,yi,s),b=hash(xi+1,yi,s),c=hash(xi,yi+1,s),d=hash(xi+1,yi+1,s);return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v;}
function fbm(x,y,s){return vnoise(x,y,s)*0.6+vnoise(x*2.3,y*2.3,s+7)*0.3+vnoise(x*5.1,y*5.1,s+13)*0.1;}

/* ---------- 形 ---------- */
function inPoly(p,x,y){let c=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const [xi,yi]=p[i],[xj,yj]=p[j];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)c=!c;}return c;}
function segDist(x,y,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],L=dx*dx+dy*dy;let t=L?((x-a[0])*dx+(y-a[1])*dy)/L:0;t=clamp(t,0,1);return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy);}
function altAt(cfg,x,y){let a=0;for(const [cx,cy,h,r] of (cfg.auto&&cfg.auto.alt)||[]){const q=((x-cx)**2+(y-cy)**2)/(r*r);if(q<1){const v=h*(1-q)*(1-q)*(1.6-0.6*(1-q));if(v>a)a=v;}}return clamp(a,0,1);}

/* ---------- 塗り（お絵かき帖の「季節」。保存 dia-routes の season：{v:1, paint:"…"}） ---------- */
function dims(cfg){const c=(cfg&&cfg.cell)||4;return {c,gw:Math.ceil(W/c),gh:Math.ceil(H/c)};}
function rleEnc(a){const out=[];let i=0;while(i<a.length){const v=a[i];let n=1;while(i+n<a.length&&a[i+n]===v)n++;out.push(v.toString(36)+(n>1?'.'+n.toString(36):''));i+=n;}return out.join(',');}
function rleDec(s,len){const a=new Uint8Array(len);if(typeof s!=='string'||!s)return a;let i=0;
  for(const part of s.split(',')){const [v,n]=part.split('.');const vv=parseInt(v,36),nn=n?parseInt(n,36):1;if(!(vv>=0&&vv<16)||!(nn>0))continue;for(let k=0;k<nn&&i<len;k++)a[i++]=vv;if(i>=len)break;}return a;}
function normalize(s,cfg){const o={v:1,paint:''};if(s&&typeof s==='object'){if(typeof s.paint==='string'&&/^[0-9a-z.,]*$/.test(s.paint))o.paint=s.paint;if(s.off)o.off=true;}return o;}
function paintAt(cfg,a,x,y,r,v){const {c,gw,gh}=dims(cfg);let n=0;const i0=Math.max(0,Math.floor((x-r)/c)),i1=Math.min(gw-1,Math.floor((x+r)/c)),j0=Math.max(0,Math.floor((y-r)/c)),j1=Math.min(gh-1,Math.floor((y+r)/c));
  for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){if(Math.hypot((i+0.5)*c-x,(j+0.5)*c-y)>r+c*0.5)continue;const k=j*gw+i;if(a[k]!==v){a[k]=v;n++;}}return n;}
const codeOf=(cfg,id)=>((cfg.paint||[]).find(p=>p.id===id)||{}).code||0;

/* ---------- 絵の1点ずつ：木・針葉樹・草・水・明るさ・場所の乱数（1回だけ） ----------
   px：RGBA（Uint8ClampedArray）、w×h。返すのは Uint8Array（0〜255）の組 */
function attrs(px,w,h){const n=w*h,T=new Uint8Array(n),C=new Uint8Array(n),G=new Uint8Array(n),Wt=new Uint8Array(n),L=new Uint8Array(n),N1=new Uint8Array(n),N2=new Uint8Array(n);
  const sx=W/w,sy=H/h;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x,p=i*4,r=px[p],g=px[p+1],b=px[p+2],mx=Math.max(r,g,b),mn=Math.min(r,g,b),v=mx/255,s=mx?(mx-mn)/mx:0;
    let hh=0;if(mx!==mn){const d=mx-mn;hh=mx===r?((g-b)/d)%6:mx===g?(b-r)/d+2:(r-g)/d+4;hh*=60;if(hh<0)hh+=360;}
    const veg=sm(40,52,hh)*(1-sm(168,182,hh))*sm(0.12,0.22,s);
    const tr=Math.max(sm(88,110,hh),1-sm(0.58,0.74,v));
    T[i]=Math.round(255*veg*tr);G[i]=Math.round(255*veg*(1-tr));C[i]=Math.round(255*veg*tr*(1-sm(0.44,0.57,v)));
    Wt[i]=Math.round(255*sm(180,192,hh)*(1-sm(226,240,hh))*sm(0.26,0.38,s));
    L[i]=Math.round(0.3*r+0.59*g+0.11*b);
    const X=x*sx,Y=y*sy;N1[i]=Math.round(255*fbm(X/9,Y/9,3));N2[i]=Math.round(255*fbm(X/14,Y/14,11));}
  return {w,h,T,C,G,W:Wt,L,N1,N2};}

/* ---------- 場所ごと（2×2 の地図の単位のマス）：山の高さ・田んぼ・桜・梅・塗った紅葉 ----------
   A：attrs（水の場所を川の岸に使う）、paint：塗りのマス目（Uint8Array。dims の大きさ）、rail：線路の折れ線（なければ設定の）*/
const CS=2,CW=W/CS,CH=H/CS;
function cells(cfg,A,paint,rail){const n=CW*CH,alt=new Uint8Array(n),farm=new Uint8Array(n),sak=new Uint8Array(n),ume=new Uint8Array(n),mom=new Uint8Array(n),pc=new Uint8Array(n),water=new Uint8Array(n),lm=new Uint8Array(n),vg=new Uint8Array(n);
  const au=cfg.auto||{},{c:pcs,gw}=dims(cfg);
  // 水の割合（川の岸のため）
  if(A){for(let j=0;j<CH;j++)for(let i=0;i<CW;i++){const x0=Math.floor(i*CS*A.w/W),x1=Math.max(x0+1,Math.floor((i+1)*CS*A.w/W)),y0=Math.floor(j*CS*A.h/H),y1=Math.max(y0+1,Math.floor((j+1)*CS*A.h/H));let s=0,m=0;
    let l=0,t=0;for(let y=y0;y<y1;y+=2)for(let x=x0;x<x1;x+=2){const q=y*A.w+x;s+=A.W[q];l+=A.L[q];t+=A.T[q]+A.G[q]*0.4;m++;}water[j*CW+i]=m?Math.round(s/m):0;lm[j*CW+i]=m?Math.round(l/m):0;vg[j*CW+i]=m?Math.min(255,Math.round(t/m)):0;}}
  // 川の岸：川の箱の中で、水のマスから near 以内（水そのものは除く）
  const RV=au.river,dist=new Float32Array(n).fill(1e9);
  if(RV){const [bx0,by0,bx1,by1]=RV.box;const q=[];for(let j=0;j<CH;j++)for(let i=0;i<CW;i++){const x=(i+0.5)*CS,y=(j+0.5)*CS;if(x<bx0||x>bx1||y<by0||y>by1)continue;if(water[j*CW+i]>150){dist[j*CW+i]=0;q.push(j*CW+i);}}
    const R=Math.ceil((RV.near||9)/CS);for(let pass=0;pass<R;pass++){const nq=[];for(const k of q){const i=k%CW,j=(k/CW)|0;for(const [di,dj] of [[1,0],[-1,0],[0,1],[0,-1]]){const ii=i+di,jj=j+dj;if(ii<0||jj<0||ii>=CW||jj>=CH)continue;const kk=jj*CW+ii;if(dist[kk]>dist[k]+1){dist[kk]=dist[k]+1;nq.push(kk);}}}q.length=0;q.push(...nq);}}
  const lines=(rail&&rail.length?rail:(au.rail&&au.rail.pts)||[]),rw=(au.rail&&au.rail.w)||9;
  // 線路沿い・田んぼの形は、その形の四角の中のマスだけ調べる（軽く）
  const rs=new Float32Array(n),fm=new Uint8Array(n),box=(x0,y0,x1,y1,fn)=>{const i0=Math.max(0,Math.floor(x0/CS)),i1=Math.min(CW-1,Math.ceil(x1/CS)),j0=Math.max(0,Math.floor(y0/CS)),j1=Math.min(CH-1,Math.ceil(y1/CS));for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++)fn(j*CW+i,(i+0.5)*CS,(j+0.5)*CS);};
  for(const pl of lines)for(let t=0;t<pl.length-1;t++){const A0=pl[t],B0=pl[t+1];box(Math.min(A0[0],B0[0])-rw,Math.min(A0[1],B0[1])-rw,Math.max(A0[0],B0[0])+rw,Math.max(A0[1],B0[1])+rw,(k,x,y)=>{const dd=segDist(x,y,A0,B0);if(dd<rw){const v=(1-sm(rw*0.5,rw,dd))*0.9;if(v>rs[k])rs[k]=v;}});}
  for(const p of au.farm||[]){let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;for(const [x,y] of p){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}box(x0,y0,x1,y1,(k,x,y)=>{if(!fm[k]&&inPoly(p,x,y))fm[k]=1;});}
  for(let j=0;j<CH;j++)for(let i=0;i<CW;i++){const k=j*CW+i,x=(i+0.5)*CS,y=(j+0.5)*CS;
    let a=altAt(cfg,x,y);
    let f=fm[k];
    let s=rs[k];if(RV&&dist[k]>0&&dist[k]<1e8){const dd=dist[k]*CS;s=Math.max(s,1-sm((RV.near||9)*0.55,RV.near||9,dd));}
    for(const [cx,cy,r,v] of au.sakura||[]){const dd=Math.hypot(x-cx,y-cy);if(dd<r)s=Math.max(s,v*(1-sm(r*0.6,r,dd)));}
    let u=0;for(const [cx,cy,r,v] of au.ume||[]){const dd=Math.hypot(x-cx,y-cy);if(dd<r)u=Math.max(u,v*(1-sm(r*0.55,r,dd)));}
    let m=0,code=0;
    if(paint){const pi=Math.min(gw-1,Math.floor(x/pcs)),pj=Math.floor(y/pcs);code=paint[pj*gw+pi]||0;}
    if(code===1){s=1;u=0;}else if(code===2){u=1;s=0;}else if(code===3){m=1;a=Math.max(a,0.55);}else if(code===4){f=1;s=0;u=0;}
    alt[k]=Math.round(a*255);farm[k]=f*255;sak[k]=Math.round(s*255);ume[k]=Math.round(u*255);mom[k]=m*255;pc[k]=code;}
  // 境目をなめらかに（マスの角が見えないように）
  blur(alt,CW,CH,3);blur(farm,CW,CH,2);blur(sak,CW,CH,1);blur(ume,CW,CH,1);blur(mom,CW,CH,2);blur(lm,CW,CH,4);
  return {cw:CW,ch:CH,cs:CS,alt,farm,sak,ume,mom,paint:pc,water,lm,vg};}
const bl=(Q,a00,a10,a01,a11,u,v)=>((Q[a00]*(1-u)+Q[a10]*u)*(1-v)+(Q[a01]*(1-u)+Q[a11]*u)*v)/255;
// 箱ぼかし（横と縦に1回ずつ・半径 r マス）
function blur(a,w,h,r){const t=new Float32Array(a.length);
  for(let y=0;y<h;y++){let s=0;for(let x=-r;x<=r;x++)s+=a[y*w+Math.min(w-1,Math.max(0,x))];for(let x=0;x<w;x++){t[y*w+x]=s/(2*r+1);s+=a[y*w+Math.min(w-1,x+r+1)]-a[y*w+Math.max(0,x-r)];}}
  for(let x=0;x<w;x++){let s=0;for(let y=-r;y<=r;y++)s+=t[Math.min(h-1,Math.max(0,y))*w+x];for(let y=0;y<h;y++){a[y*w+x]=Math.round(s/(2*r+1));s+=t[Math.min(h-1,y+r+1)*w+x]-t[Math.max(0,y-r)*w+x];}}
  return a;}

/* ---------- その日の色に塗りかえる ----------
   src：元の絵の RGBA、dst：書き出す RGBA（同じ大きさ）、A：attrs、Cc：cells、Wt：weights、snow：{lo,hi}、
   artOn：{spring,autumn,winter}（その季節の絵があるとき 1。計算の色をその分弱める） */
function recolor(cfg,src,dst,A,Cc,Wt,snow,artOn){const {w,h}=A,K=cfg.colors,d=Wt.d,n=w*h,cw=Cc.cw,fx=cw/w,fy=Cc.ch/h;
  artOn=artOn||{};const aSp=1-(artOn.spring?Wt.art.spring:0),aAu=1-(artOn.autumn?Wt.art.autumn:0),aWi=1-(artOn.winter?Wt.art.winter:0);
  const S=cfg.snow||{},SC=S.color||[246,249,253],SS=S.shade||[214,226,244],LF=K.leaf,BR=K.bare,SK=K.sakura,G=cfg.grade||{};
  const shin=Wt.shinryoku*aSp,straw=Wt.straw*aWi,gold=Wt.golden,renge=Wt.renge,flood=Wt.flood,young=Wt.young,sakB=Wt.sakura,petal=Wt.petal,umeB=Wt.ume;
  const hv0=Wt.hv[0],hv1=Wt.hv[1],cap=Wt.cap,inHarvest=d>=hv0-5&&d<md('12-31'),earlyYear=d<md('04-25');
  const gw=G.winter||{},ga=G.autumn||{},gs=G.spring||{},gW=Wt.gWinter*aWi,gA=Wt.gAutumn*aAu,gS=Wt.gSpring;
  const sat=1+((gw.sat||1)-1)*gW+((ga.sat||1)-1)*gA+((gs.sat||1)-1)*gS;
  const tint=[0,0,0,0];for(const [g,k] of [[gw,gW],[ga,gA],[gs,gS]])if(g.tint&&k>0){const a=g.tint[3]*k;tint[0]+=g.tint[0]*a;tint[1]+=g.tint[1]*a;tint[2]+=g.tint[2]*a;tint[3]+=a;}
  const TA=Math.min(0.3,tint[3]),TR=tint[3]?tint[0]/tint[3]:0,TG=tint[3]?tint[1]/tint[3]:0,TB=tint[3]?tint[2]/tint[3]:0;
  const ch=Cc.ch,AL=Cc.alt,FA=Cc.farm,SA=Cc.sak,UM=Cc.ume,LM=Cc.lm;
  for(let y=0;y<h;y++){const yf=Math.max(0,Math.min(ch-1.001,y*fy-0.5)),j0=yf|0,v=yf-j0,r0=j0*cw,r1=Math.min(ch-1,j0+1)*cw,cy=Math.min(ch-1,(y*fy)|0)*cw;
   for(let x=0;x<w;x++){const i=y*w+x,p=i*4;let r=src[p],g=src[p+1],b=src[p+2];
    const xf=Math.max(0,Math.min(cw-1.001,x*fx-0.5)),i0=xf|0,u=xf-i0,i1=Math.min(cw-1,i0+1),a00=r0+i0,a10=r0+i1,a01=r1+i0,a11=r1+i1;
    const ck=cy+Math.min(cw-1,(x*fx)|0),code=Cc.paint[ck],L=A.L[i]/255,n1=A.N1[i]/255,n2=A.N2[i]/255,wa=A.W[i]/255;
    let tr=A.T[i]/255,co=A.C[i]/255,gr=A.G[i]/255;const veg=tr+gr;
    const alt=bl(AL,a00,a10,a01,a11,u,v),sk=bl(SA,a00,a10,a01,a11,u,v),um=bl(UM,a00,a10,a01,a11,u,v),lmL=bl(LM,a00,a10,a01,a11,u,v);
    let fa=bl(FA,a00,a10,a01,a11,u,v);
    if(code===1||code===3){tr=Math.max(tr,veg*0.95);gr=veg-tr;}
    if(code===4){fa=1;}
    const pd=code===4?veg:fa*gr*sm(0.6,0.76,L),grass=Math.max(0,gr-pd);
    const de=Math.max(0,tr-co*(code===3?0.4:1));   // 落葉樹（塗った紅葉の山は針葉樹も少し色づく）
    const st=clamp(L/0.58,0.5,1.35),sg=clamp(L/0.8,0.62,1.2);
    // 落葉樹：新緑・紅葉・落葉
    if(de>0.02){let w2;
      if(shin>0){w2=shin*0.72*de;r+=(K.shinryoku[0]*st-r)*w2;g+=(K.shinryoku[1]*st-g)*w2;b+=(K.shinryoku[2]*st-b)*w2;}
      const lf=leafAt(cfg,d,alt,n2*2-1);
      if(lf.c>0){const nn=Math.min(0.999,n1*(0.55+0.45*alt)+(1-alt)*0.42*n2),ix=code===3?Math.min(2,(n1*3.2)|0):Math.min(LF.length-1,(nn*LF.length)|0),c=LF[ix];w2=lf.c*(code===3?0.95:0.6+0.3*alt)*de*aAu;r+=(c[0]*st-r)*w2;g+=(c[1]*st-g)*w2;b+=(c[2]*st-b)*w2;}
      if(lf.b>0){const c=BR[Math.min(BR.length-1,(n2*BR.length)|0)];w2=lf.b*0.8*de*(earlyYear?aWi:aWi*aAu);const s2=clamp(L/0.6,0.6,1.3);r+=(c[0]*s2-r)*w2;g+=(c[1]*s2-g)*w2;b+=(c[2]*s2-b)*w2;}}
    // 針葉樹：冬は少し沈む
    if(co>0.02&&gW>0){const w2=0.3*gW*co,c=K.conWinter;r+=(c[0]*st-r)*w2;g+=(c[1]*st-g)*w2;b+=(c[2]*st-b)*w2;}
    // 草：枯れ草・新緑
    if(grass>0.02){let w2;
      if(straw>0){w2=straw*0.82*grass;const c=K.straw;r+=(c[0]*sg-r)*w2;g+=(c[1]*sg-g)*w2;b+=(c[2]*sg-b)*w2;}
      if(gA>0){w2=gA*0.18*grass;const c=K.straw;r+=(c[0]*sg-r)*w2;g+=(c[1]*sg-g)*w2;b+=(c[2]*sg-b)*w2;}
      if(shin>0){w2=shin*0.45*grass;const c=K.shinGrass;r+=(c[0]*sg-r)*w2;g+=(c[1]*sg-g)*w2;b+=(c[2]*sg-b)*w2;}}
    // 田んぼ：土 → れんげ → 水 → 若い苗 → 夏（元の絵）→ 黄金 → 稲刈りのあと
    if(pd>0.02){let c=null,w2=0;const hd=hv0+(hv1-hv0)*n2;
      if(inHarvest&&d>=hd){const t=sm(hd,hd+4,d);c=n1>0.5?K.stubble:K.soil;w2=t;if(gold>0&&t<1){const c2=K.golden;const ww=gold*(1-t)*0.85*pd;r+=(c2[0]*sg-r)*ww;g+=(c2[1]*sg-g)*ww;b+=(c2[2]*sg-b)*ww;}}
      else if(gold>0){c=K.golden;w2=gold*(0.55+0.25*n1);}
      else if(d<md('07-20')){const winter=earlyYear?1-Math.max(flood,young,renge):0;
        if(winter>0){c=n1>0.55?K.stubble:K.soil;w2=winter*0.62;}
        if(renge>0&&n2>0.5){const c2=K.renge,ww=renge*0.55*pd*sm(0.5,0.62,n2);r+=(c2[0]*sg-r)*ww;g+=(c2[1]*sg-g)*ww;b+=(c2[2]*sg-b)*ww;}
        if(flood>0){const c2=K.flood,ww=flood*0.8*pd,s3=clamp(L/0.82,0.8,1.2);r+=(c2[0]*s3-r)*ww;g+=(c2[1]*s3-g)*ww;b+=(c2[2]*s3-b)*ww;}
        if(young>0){const c2=K.young,ww=young*0.6*pd*(1-flood*0.6);r+=(c2[0]*sg-r)*ww;g+=(c2[1]*sg-g)*ww;b+=(c2[2]*sg-b)*ww;}}
      else if(d>=md('12-01')){c=n1>0.55?K.stubble:K.soil;w2=0.66;}
      if(c&&w2>0){w2*=pd*(d>=hv0-5||!earlyYear?aAu*aWi:aWi);r+=(c[0]*sg-r)*w2;g+=(c[1]*sg-g)*w2;b+=(c[2]*sg-b)*w2;}}
    // 桜：花の色（花びらは絵の上に点で重ねる）・川面の花いかだ
    if(sk>0&&sakB>0){const w2=sakB*sk*Math.min(1,(tr+(code===1?veg:0))*1.25)*0.62;if(w2>0){const c=SK[(n1*SK.length)|0]||SK[0],s2=clamp(L/0.62,0.86,1.12);r+=(c[0]*s2-r)*w2;g+=(c[1]*s2-g)*w2;b+=(c[2]*s2-b)*w2;}}
    if(sk>0&&petal>0&&wa>0.3){const w2=petal*sk*wa*0.32*(n1>0.45?1:0.4);r+=(248-r)*w2;g+=(196-g)*w2;b+=(212-b)*w2;}
    // 梅：まわりの木に少しだけ紅
    if(um>0&&umeB>0&&tr>0.1){const w2=umeB*um*tr*0.22,c=K.ume[0];r+=(c[0]-r)*w2;g+=(c[1]-g)*w2;b+=(c[2]-b)*w2;}
    // 全体の色味（彩度と色）
    if(sat!==1||TA>0){const m=(r+g+b)/3;r=m+(r-m)*sat;g=m+(g-m)*sat;b=m+(b-m)*sat;if(TA>0){r+=(TR-r)*TA;g+=(TG-g)*TA;b+=(TB-b)*TA;}}
    // 雪：天気で積もった雪（山の上は解けにくい）＋12〜3月の山の上
    const sn=snow?snow.lo+(snow.hi-snow.lo)*alt:0;let pc=sn>0?clamp((sn-0.55*n2)*2.6,0,1):0;
    if(cap<2&&alt>cap-0.3){const ridge=sm(-0.03,0.07,L-lmL+(n1-0.5)*0.06),cw2=sm(cap-0.26,cap+0.06,alt)*(0.25+0.75*ridge)*(0.9-0.25*co);if(cw2>pc)pc=cw2;}   // 山の上：尾根（まわりより明るい所）から白く
    if(pc>0){const mxp=co*0.42+Math.max(0,tr-co)*0.66+gr*0.9+Math.max(0,1-veg)*0.8;pc*=(1-wa)*Math.min(0.92,mxp);const t=clamp((L-lmL)*2.4+0.7,0,1),sr=SS[0]+(SC[0]-SS[0])*t,sgc=SS[1]+(SC[1]-SS[1])*t,sb=SS[2]+(SC[2]-SS[2])*t;r+=(sr-r)*pc;g+=(sgc-g)*pc;b+=(sb-b)*pc;}
    dst[p]=r<0?0:r>255?255:r;dst[p+1]=g<0?0:g>255?255:g;dst[p+2]=b<0?0:b>255?255:b;dst[p+3]=255;}}
  return dst;}

/* ---------- 花の点（桜・梅・散った花びら）：決まった乱数で、毎回同じ場所 ----------
   返すのは [{x,y,r,c:[r,g,b],a}]（地図の単位）。強さが0のものは出さない */
function stamps(cfg,A,Cc,Wt){const out=[],ST=cfg.stamp||{},K=cfg.colors,w=A.w,h=A.h;
  const put=(kind,str,zone,test,cols)=>{if(str<=0.01)return;const S=ST[kind]||{},step=S.step||1.5,[r0,r1]=S.r||[0.6,1.2],p=S.p||0.5;
    for(let y=step/2;y<H;y+=step)for(let x=step/2;x<W;x+=step){const u=hash(Math.round(x*10),Math.round(y*10),kind.length*31);if(u>p)continue;
      const jx=x+(hash(x*7,y*3,5)-0.5)*step,jy=y+(hash(x*3,y*7,9)-0.5)*step,ck=Math.min(Cc.ch-1,(jy/Cc.cs)|0)*Cc.cw+Math.min(Cc.cw-1,(jx/Cc.cs)|0),z=zone[ck]/255;if(z<0.05)continue;
      const pi=Math.min(h-1,(jy*h/H)|0)*w+Math.min(w-1,(jx*w/W)|0);const t=test(pi,Cc.paint[ck]);if(t<=0.05)continue;
      const v=hash(Math.round(jx*13),Math.round(jy*13),77),a=str*z*t;if(v>a*1.15+0.05)continue;
      out.push({k:kind,x:jx,y:jy,r:r0+(r1-r0)*hash(jx*5,jy*5,3),c:cols[(hash(jx,jy,41)*cols.length)|0],a:clamp(0.35+a*0.75,0,1)});}};
  const veg=i=>(A.T[i]+A.G[i]*0.5)/255;
  put('sakura',Wt.sakura,Cc.sak,(i,code)=>code===1?(1-A.W[i]/255):veg(i)*1.4,K.sakura);
  put('ume',Wt.ume,Cc.ume,(i,code)=>code===2?(1-A.W[i]/255):(A.T[i]/255)*1.3,K.ume);
  put('petal',Wt.petal,Cc.sak,i=>1-(A.T[i]/255)*0.7,[[255,214,226],[250,196,212],[255,240,244]]);
  return out;}

/* ---------- 夜：雪明かりと桜のライトアップの強さ ---------- */
function lightupK(cfg,minute){const L=(cfg.night&&cfg.night.light)||{},hh=(((minute%1440)+1440)%1440)/60,[a,b]=L.hours||[17.5,22];return sm(a-0.3,a+0.4,hh)*(1-sm(b-0.2,b+0.5,hh));}

const api={W,H,md,doy,bump,ramp,weights,capLine,leafAt,addDays,snowCover,hash,vnoise,fbm,inPoly,segDist,altAt,dims,rleEnc,rleDec,normalize,paintAt,codeOf,attrs,cells,recolor,stamps,lightupK,CS};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MapSeasonCore=api;
})(typeof window!=='undefined'?window:globalThis);
