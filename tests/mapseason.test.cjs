// 第10回（2026-11-16）地図の季節の見た目：暦の強さ・紅葉の前線・雪の積もり方と解け方・塗りの保存・色の塗りかえ・花の点・季節のできごととの時期合わせ
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const M=require('../js/mapseason-core.js'),cfg=require('../data/map-season.json'),SA=require('../data/seasonal.json'),SB=require('../data/seasonal-extra.json');
const root=path.join(__dirname,'..');
const W=(md)=>M.weights(cfg,'2026-'+md);
// 夏（7月20日）は何も効かない＝今の絵のまま
{const w=W('07-20');for(const k of ['ume','sakura','petal','shinryoku','straw','renge','flood','golden','gWinter','gAutumn','gSpring'])assert.ok(w[k]<0.01,k+' は夏に0');assert.ok(w.cap>2,'夏は山の上も白くない');}
// 梅・桜・新緑・稲穂・冬の山の上
assert.ok(W('02-22').ume>0.9&&W('02-22').sakura<0.01,'2月下旬は梅');
assert.ok(W('04-01').sakura>0.9&&W('04-01').ume<0.01,'4月1日は桜');
assert.ok(W('04-07').petal>0.9,'4月はじめの散りぎわ');
assert.ok(W('04-28').shinryoku>0.9,'4月末は新緑');
assert.ok(W('09-14').golden>0.9,'9月なかばは黄金色');
assert.ok(W('01-15').cap<0.8&&W('12-20').cap<1&&W('03-10').cap<1,'12〜3月は山の上が白い');
// 紅葉の前線：山の上（a=1）から色づき、ふもと（a=0）は遅い。11月末にはふもとが見ごろ
const d=s=>M.doy('2026-'+s);
assert.ok(M.leafAt(cfg,d('10-28'),1,0).c>0.9&&M.leafAt(cfg,d('10-28'),0,0).c<0.01,'10月下旬は山の上だけ');
assert.ok(M.leafAt(cfg,d('11-26'),0,0).c>0.9&&M.leafAt(cfg,d('11-26'),1,0).b>0.9,'11月末はふもとが見ごろ・山の上は葉が落ちた');
assert.ok(M.leafAt(cfg,d('01-15'),0,0).b>0.99&&M.leafAt(cfg,d('05-10'),0.5,0).b<0.01,'冬は落葉・5月は葉がある');
for(let a=0;a<1;a+=0.25)assert.ok(M.leafAt(cfg,d('11-01'),a+0.25,0).c+M.leafAt(cfg,d('11-01'),a+0.25,0).b>=M.leafAt(cfg,d('11-01'),a,0).c+M.leafAt(cfg,d('11-01'),a,0).b-1e-9,'高いほど早い');
// 季節のできごと（沿線だより・吹き出し）と時期をそろえる
const ev=id=>[...SA.list,...SB.list].find(e=>e.id===id);
const overlap=(q,w)=>{let n=0;for(let x=M.md(w[0]);x<=M.md(w[1]);x++)if(M.bump(x,q)>0.6)n++;return n;};
assert.ok(overlap(cfg.dates.ume,ev('s_ume').when)>=15,'梅のまつりの間に梅が見ごろ');
assert.ok(overlap(cfg.dates.sakura,ev('s_hanami').when)>=8,'花見の間に桜が見ごろ');
{let n=0;for(let x=M.md(ev('s_momiji').when[0]);x<=M.md(ev('s_momiji').when[1]);x++)if(M.leafAt(cfg,x,0.5,0).c>0.6||M.leafAt(cfg,x,0.9,0).c>0.6)n++;assert.ok(n>=20,'紅葉のころに山が色づいている');}
{const y=ev('s_yukiakari');assert.ok(y,'雪あかりの夜がある');for(let x=M.md(y.when[0]);x<=M.md(y.when[1]);x++)assert.ok(M.capLine(cfg.dates.cap.line,x)<0.8,'雪あかりの夜は山の上が白い時期');}
// 雪：雪の日だけ積もり、晴れが続くと解ける。山の上は解けにくい
{const log={'2027-01-10':{wx:'snow',hi:1}};const f=y=>log[y]||{wx:'sun',hi:7};
  const s0=M.snowCover(cfg,'2027-01-10',f),s1=M.snowCover(cfg,'2027-01-11',f),s3=M.snowCover(cfg,'2027-01-13',f),s9=M.snowCover(cfg,'2027-01-19',f);
  assert.ok(s0.lo>0.8,'雪の日は積もる');assert.ok(s1.lo<s0.lo&&s1.lo>0,'次の日は少し解ける');assert.ok(s3.lo<0.05,'晴れが続くと解ける');assert.ok(s3.hi>s3.lo,'山の上は残る');assert.ok(s9.hi<0.05);
  assert.equal(M.snowCover(cfg,'2027-01-09',f).lo,0,'雪の前は積もっていない');
  assert.ok(M.snowCover(cfg,'2027-01-15',f,{wx:'snow'}).lo>0.8,'きょうが雪（大雪の朝のボタン）なら積もる');}
// 塗りの保存（同じ値が続くところを縮めた文字）
{const {gw,gh}=M.dims(cfg),n=gw*gh,a=new Uint8Array(n);M.paintAt(cfg,a,200,200,10,M.codeOf(cfg,'sakura'));M.paintAt(cfg,a,700,100,8,M.codeOf(cfg,'momiji'));
  const e=M.rleEnc(a);assert.deepEqual(Array.from(M.rleDec(e,n)),Array.from(a));assert.ok(e.length<300);assert.equal(M.rleDec('zz,!!',5).length,5);
  assert.deepEqual(M.normalize({paint:5},cfg),{v:1,paint:''});assert.equal(M.normalize({paint:'1.3,0'},cfg).paint,'1.3,0');
  // 塗ったところが自動より先
  const Cc=M.cells(cfg,null,a,null),k=Math.floor(200/M.CS)*Cc.cw+Math.floor(200/M.CS);assert.ok(Cc.sak[k]>200,'塗った桜並木');
  const C0=M.cells(cfg,null,null,null);assert.ok(C0.sak[k]<Cc.sak[k]);
  const k2=Math.floor(100/M.CS)*Cc.cw+Math.floor(700/M.CS);assert.ok(Cc.mom[k2]>200&&Cc.alt[k2]>=Math.round(0.5*255)-20,'塗った紅葉の山');}
// 色の塗りかえ：小さな絵（木の緑・草・水・灰色の屋根）
const pix=[[70,120,60],[150,200,90],[60,150,215],[150,150,150]];
function img(w,h){const px=new Uint8ClampedArray(w*h*4);for(let i=0;i<w*h;i++){const c=pix[(i%w)*pix.length/w|0];px[i*4]=c[0];px[i*4+1]=c[1];px[i*4+2]=c[2];px[i*4+3]=255;}return px;}
{const w=40,h=17,px=img(w,h),A=M.attrs(px,w,h);
  assert.ok(A.T[0]>150&&A.G[w/4+1]>150&&A.W[w/2+1]>150&&A.T[w-1]<20&&A.G[w-1]<20&&A.W[w-1]<20,'木・草・水・屋根を見分ける');
  const Cc=M.cells(cfg,A,null,null),out=new Uint8ClampedArray(px.length);
  M.recolor(cfg,px,out,A,Cc,W('07-20'),{lo:0,hi:0});let diff=0;for(let i=0;i<px.length;i++)diff=Math.max(diff,Math.abs(out[i]-px[i]));assert.ok(diff<=1,'夏は元の絵のまま '+diff);
  M.recolor(cfg,px,out,A,Cc,W('01-15'),{lo:1,hi:1});const g=i=>[out[i*4],out[i*4+1],out[i*4+2]];
  assert.ok(g(w/4+1).every(v=>v>200),'雪の日は草が白い');assert.ok(g(w/2+1)[2]>180&&g(w/2+1)[0]<120,'水は白くならない');
  M.recolor(cfg,px,out,A,Cc,W('09-14'),{lo:0,hi:0});const roof=g(w-1);assert.ok(Math.abs(roof[0]-150)<=1&&Math.abs(roof[2]-150)<=1,'屋根（灰色）は秋でも色が変わらない');}
// 花の点：決まった場所（2回作っても同じ）・夏は出ない
{const w=200,h=84,px=img(w,h),A=M.attrs(px,w,h),Cc=M.cells(cfg,A,null,null);
  const a=M.stamps(cfg,A,Cc,W('04-01')),b=M.stamps(cfg,A,Cc,W('04-01'));assert.deepEqual(a,b);assert.equal(M.stamps(cfg,A,Cc,W('07-20')).length,0);}
// 計算に DOM を使わない。本体は絵だけを入れかえ、駅名の札などは上に描く
{const src=fs.readFileSync(path.join(root,'js/mapseason-core.js'),'utf8');assert.ok(!/document\.|window\.|localStorage/.test(src.replace(/typeof window/g,'')),'core に DOM なし');
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');assert.ok(/MapSeasonView\.image\(\)\)\|\|MAPBG/.test(html),'drawTerrain は季節の絵（なければ夏の絵）');
  const i=html.indexOf('function drawMap(){'),j=html.indexOf('MapSeasonView.drawOver',i),k=html.indexOf('// station names',i);assert.ok(i>0&&j>i&&k>j,'駅名の札は季節の層より上');}
console.log('mapseason ok');
