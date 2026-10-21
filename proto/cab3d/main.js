/* みなと川電鉄 3D運転席 試作（第1段階：静止画）
   単位はメートル。y が上。線路の中心線は s（キロ程のようなもの、m）で表し、
   P(s,d,h) で「s の地点から右へ d m、高さ h m」の点、FM(s,d,h) でその点の向き付きの座標系を得る。 */
import * as THREE from './lib/three.module.min.js';

const Q = new URLSearchParams(location.search);
const ROUTE = Q.get('route')==='cs';   // ?route=cs：中央→桜町の約3.2kmを、駅・踏切・信号つきで走らせる版
const CFG = {
  // ---- 仮設定（本体のデータに無いもの）----
  from: '中央', to: '桜町',        // 本体 index.html の STATIONS（中央 0km・桜町 3.2km）を参照。区間内の位置は仮
  gauge: 1.067,                    // 狭軌（仮）
  gap: 3.8,                        // 複線の線路中心の間隔
  own: -1.9,                       // 自列車は左側の線路（左側通行）
  sleeperTop: 0.58, railH: 0.153,  // 地面からまくらぎ上面、レールの高さ
  eyeH: 2.45, eyeOff: -0.45,       // レール面から運転士の目の高さ、線路中心から左へのずれ
  fov: 44,
  pathFrom: -150, pathTo: ROUTE?3750:2100, build: ROUTE?3420:1550, sec: ROUTE?3200:500,
  camS: Number(Q.get('s') ?? (ROUTE?15:40)),
  seed: Number(Q.get('seed') ?? 7),
};
CFG.railTop = CFG.sleeperTop + CFG.railH;
/* 区間モードの駅・踏切（s は中央駅の停止位置付近を 0 とした距離 m。仮設定） */
const STA = ROUTE ? [{key:'C',s0:-125,s1:25,stop:15},{key:'S',s0:3085,s1:3235,stop:3220}] : [];
const XS = ROUTE ? 1720 : null;                       // 踏切の位置
const RSIG = ROUTE ? [880,2300,2930] : [];            // 電車の信号機の位置
const inZone=(a,b,pad=0)=>STA.some(z=>b>z.s0-pad&&a<z.s1+pad);
const nearX=(a,b,pad=0)=>XS!=null&&b>XS-3.5-pad&&a<XS+3.5+pad;
const skipSide=s=>ROUTE&&(inZone(s,s,2)||nearX(s,s));   // 線路わきのさく・ケーブルトラフ・草むらを置かない所

/* 見た目の設定。?look=v1 で変更前（最初の試作）の見た目に戻せる */
const LOOK_ID = ({v1:'v1',v3:'v3',v4:'v4',v5:'v5',v6:'v6'})[new URLSearchParams(location.search).get('look')] || 'v2';
const LOOKS = {
  v1:{ lambert:false, exposure:1.0, shadow:'PCFSoftShadowMap', shRadius:1, shInt:1.0,
       hemi:['#c3d7ee','#a99f82',1.0], sun:['#fff0d8',2.9], hor:'#dde8ee', fog:0.00042, sky:['#3f83d0','#8fc0ea'], grade:false },
  // v2：影の輪郭をやわらげる（影の解像度を下げる）、青みのある天空光で日陰を明るく、露出を下げて白飛びを防ぐ、
  //     8段のなめらかな陰影、霞を少し濃く、最後に色調補正
  v2:{ lambert:false, smooth:true, exposure:0.95, shadow:'PCFSoftShadowMap', shRadius:1, shInt:1.0, shMap:2048,
       hemi:['#a8c4ea','#c4b38e',1.2], sun:['#ffe7c6',2.75], hor:'#d2e2ee', fog:0.00046, sky:['#3f86d6','#98c6ee'], grade:true },
};
LOOKS.v3 = {...LOOKS.v2, assets:true};   // v3：v2 の光と色に、描いた美術素材（外壁・屋根・樹木・草むら・遠景）を加える
LOOKS.v4 = {...LOOKS.v3, assets4:true};  // v4：v3 に、道床・道路・ブロック塀・窓の描いた素材を加える
LOOKS.v5 = {...LOOKS.v4, assets5:true};
LOOKS.v6 = {...LOOKS.v5, assets6:true};  // v6：マンションを住戸区画の絵で組み、戸建ての横の壁・汚れと軒の影を加える  // v5：v4 に、木の種類・外壁の種類・畑の種類・枕木・架線柱・レールの描いた素材を加える
const LOOK = LOOKS[LOOK_ID];

/* ---------- 美術素材（v3 のみ。assets/images/cab3d/ にある、生成AIで描いた画像） ---------- */
const ART = LOOK.assets ? await (async()=>{const L=new THREE.TextureLoader(),dir='../../assets/images/cab3d/',o={};
  const names={wall:'wall_siding',roof:'roof_slate',tree1:'tree1',tree2:'tree2',tree3:'tree3',grass:'grass_strip',pano:'far_panorama'};
  if(LOOK.assets4)Object.assign(names,{ballast:'ballast',road:'road',blockwall:'blockwall',window:'window'});
  const POOL5=['tree_round_a_1','tree_round_a_2','tree_round_a_3','tree_cherry_1','tree_cherry_2','tree_cherry_3','tree_conifer_1','tree_conifer_2','tree_conifer_3'];
  const WALL5=['wall_mortar','wall_tile','wall_dark_siding'],FIELD5=['field_veg','field_cabbage','field_paddy','field_fallow'];
  if(LOOK.assets6){for(const n of['apt_bal_a','apt_bal_b','apt_cor','apt_ground','apt_end','apt_roof','house_side','facade_grime'])names[n]='lib/'+n;}
  if(LOOK.assets5){for(const n of[...POOL5,...WALL5,...FIELD5,'sleeper_concrete','pole_steel','rail_detail_gray'])names[n]='lib/'+n;}
  await Promise.all(Object.entries(names).map(async([k,n])=>{const t=await L.loadAsync(dir+n+'.webp');t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;o[k]=t;}));
  for(const k of['wall','roof','grass','ballast','road','blockwall','apt_ground','apt_end','house_side','facade_grime'])if(o[k])o[k].wrapS=o[k].wrapT=THREE.RepeatWrapping;
  if(LOOK.assets5){   // v5：木は 3種＋9種、外壁は 板張り＋3種、畑は 4種から選ぶ
    o.treePool=[o.tree1,o.tree2,o.tree3,...POOL5.map(n=>o[n])];
    o.walls={wall:o.wall};for(const n of WALL5){o[n].wrapS=o[n].wrapT=THREE.RepeatWrapping;o.walls[n]=o[n];}
    o.fields={};for(const n of FIELD5){o[n].wrapS=o[n].wrapT=THREE.RepeatWrapping;o.fields[n]=o[n];}
    o.pole_steel.wrapS=o.pole_steel.wrapT=THREE.RepeatWrapping;o.pole_steel.repeat.set(1,3);
    const rd=o.rail_detail_gray;rd.wrapS=rd.wrapT=THREE.RepeatWrapping;rd.center.set(0.5,0.5);rd.rotation=Math.PI/2;}
  if(o.ballast)o.ballast.repeat.set(1.8,1.8);   // 道床の絵は1枚で約1.2m四方（線路の貼り方は2.2mごとなので縮める）
  if(o.road)o.road.repeat.set(1,1.5);            // 道路の絵は正方形＝道幅4mで4m分（貼り方は6mごと）
  o.pano.wrapS=THREE.MirroredRepeatWrapping;return o;})() : null;

/* ---------- 乱数・色 ---------- */
function rngF(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const R = rngF(CFG.seed);
const R5 = rngF(CFG.seed*7+3);
const R6 = rngF(CFG.seed*11+5);   // v6 の住戸区画の選び分け用（v5 の選び分けを変えない）   // v5 の素材の選び分け用（街並みの配置に使う乱数 R とは別にして、配置を変えない）
const rr=(a,b)=>a+(b-a)*R(), pick=a=>a[Math.floor(R()*a.length)], chance=p=>R()<p;
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const col=h=>new THREE.Color(h);
const _hsl={};
function jit(h,a=0.035){const c=new THREE.Color(h);c.getHSL(_hsl);c.setHSL(_hsl.h,_hsl.s,Math.min(1,Math.max(0,_hsl.l+(R()-0.5)*2*a)));return c;}

// アニメ背景の配色（落ち着いた壁・屋根・緑）
const PAL = {
  walls:['#efe7d6','#e9dcc3','#dfddd6','#e6d6bd','#f4f1e8','#d9c8ae','#d2d5d0','#e4d0b8','#c9b49a'],
  roofs:['#4b5662','#5a4a42','#3e4248','#6e4f3f','#55625c','#666c76','#7b5b48','#45505c'],
  glass:['#6a87a0','#7a98b0','#5d7a94','#94afc4','#86a2b8'],
  greens:['#4c7a3c','#5b8a44','#3d6834','#6f9c4c','#567f3e','#7ea85a','#466f3a'],
  apart:['#f1eee6','#e8e0cf','#ddd6c8','#cfc9bd','#b98d6e','#e9e4da'],
  cars:['#f2f2f0','#c9ccd0','#2e3a4e','#8a1f22','#3d3f43','#e8e3d6','#5b6b7c'],
  frame:'#cfd2d2', base:'#aaa69c', block:'#c4beb1', soffit:'#ece8de', curtain:'#e6dccb',
};

/* ---------- 線路の中心線（緩和曲線つきの曲線） ---------- */
// 曲率 κ（1/半径）を s の折れ線で決める：直線 → 緩和曲線 → 右R700 → 緩和 → 直線 → 左R900 → …
const KN=[[-1e9,0],[180,0],[260,1/700],[420,1/700],[500,0],[900,0],[980,-1/900],[1150,-1/900],[1230,0],...(ROUTE?[[1980,0],[2060,1/1200],[2380,1/1200],[2460,0]]:[]),[1e9,0]];
function kap(s){for(let i=1;i<KN.length;i++)if(s<=KN[i][0]){const[s0,k0]=KN[i-1],[s1,k1]=KN[i];return k0+(k1-k0)*(s-s0)/(s1-s0);}return 0;}
const DS=0.5, PN=Math.ceil((CFG.pathTo-CFG.pathFrom)/DS)+1;
const PX=new Float64Array(PN), PZ=new Float64Array(PN), PT=new Float64Array(PN);
{let x=0,z=-CFG.pathFrom,t=0;for(let i=0;i<PN;i++){PX[i]=x;PZ[i]=z;PT[i]=t;const s=CFG.pathFrom+i*DS,k=kap(s+DS/2),tm=t+k*DS/2;x+=Math.sin(tm)*DS;z-=Math.cos(tm)*DS;t+=k*DS;}}
function at(s){let f=(s-CFG.pathFrom)/DS;f=Math.max(0,Math.min(PN-1.0001,f));const i=Math.floor(f),u=f-i;return[PX[i]+(PX[i+1]-PX[i])*u,PZ[i]+(PZ[i+1]-PZ[i])*u,PT[i]+(PT[i+1]-PT[i])*u];}
function P(s,d=0,h=0){const[x,z,t]=at(s);return V(x+Math.cos(t)*d,h,z+Math.sin(t)*d);}
// 向き付きの座標系：x＝線路の右、y＝上、z＝進行方向の逆（-z が前）
function FM(s,d=0,h=0,yaw=0){const[x,z,t]=at(s);const c=Math.cos(t),n=Math.sin(t);
  const m=new THREE.Matrix4().set(c,0,-n,x+c*d, 0,1,0,h, n,0,c,z+n*d, 0,0,0,1);
  if(yaw)m.multiply(new THREE.Matrix4().makeRotationY(yaw));return m;}

/* ---------- まとめ描き（同じ材質の部品を1つのメッシュにまとめて描画回数を減らす） ---------- */
const CHUNKS=[];   // 区画に分けたメッシュ（区間モードでは遠い区画を描かない）
class Batch{
  constructor(){this.p=[];this.n=[];this.c=[];this.u=[];}
  v(p,n,c,u){this.p.push(p.x,p.y,p.z);this.n.push(n.x,n.y,n.z);this.c.push(c.r,c.g,c.b);this.u.push(u?u[0]:0,u?u[1]:0);}
  tri(a,b,c,k,ua,ub,uc,hint){const n=V().subVectors(b,a).cross(V().subVectors(c,a));
    if(hint&&n.dot(hint)<0){[b,c]=[c,b];[ub,uc]=[uc,ub];n.negate();}n.normalize();this.v(a,n,k,ua);this.v(b,n,k,ub);this.v(c,n,k,uc);}
  quad(a,b,c,d,k,uv,hint){this.tri(a,b,c,k,uv&&uv[0],uv&&uv[1],uv&&uv[2],hint);this.tri(a,c,d,k,uv&&uv[0],uv&&uv[2],uv&&uv[3],hint);}
  add(g,m,k,uvf){const Pa=g.attributes.position,Na=g.attributes.normal,Ua=g.attributes.uv,nm=new THREE.Matrix3().getNormalMatrix(m),p=V(),n=V();
    for(let i=0;i<Pa.count;i++){p.fromBufferAttribute(Pa,i).applyMatrix4(m);n.fromBufferAttribute(Na,i).applyMatrix3(nm).normalize();
      this.p.push(p.x,p.y,p.z);this.n.push(n.x,n.y,n.z);this.c.push(k.r,k.g,k.b);if(uvf){const q=uvf(i,Ua.getX(i),Ua.getY(i));this.u.push(q[0],q[1]);}else this.u.push(Ua?Ua.getX(i):0,Ua?Ua.getY(i):0);}}
  // 三角形を、重心のある区画（chunk m 四方）ごとの別メッシュに分ける。画面に入らない区画は描かれない
  chunks(mat,size,opt){const cells=new Map(),P=this.p;
    for(let t=0;t<P.length;t+=9){const k=Math.floor((P[t]+P[t+3]+P[t+6])/3/size)+','+Math.floor((P[t+2]+P[t+5]+P[t+8])/3/size);let c=cells.get(k);if(!c){c=new Batch();cells.set(k,c);}
      c.p.push(...P.slice(t,t+9));c.n.push(...this.n.slice(t,t+9));c.c.push(...this.c.slice(t,t+9));c.u.push(...this.u.slice(t/3*2,t/3*2+6));}
    const G=new THREE.Group();cells.forEach(c=>G.add(c.mesh(mat,opt)));G.children.forEach(m=>CHUNKS.push(m));return G;}
  mesh(mat,{cast=true,recv=true,ao=false,upN=false}={}){const g=new THREE.BufferGeometry();
    if(upN)for(let i=0;i<this.n.length;i+=3){this.n[i]=0;this.n[i+1]=1;this.n[i+2]=0;}   // 草むらの板は地面と同じ向きの光を受ける
    if(ao)for(let i=0;i<this.c.length;i+=3){const y=this.p[i+1],f=0.74+0.26*Math.min(1,Math.max(0,y/2.4));this.c[i]*=f;this.c[i+1]*=f;this.c[i+2]*=f;}   // 地面に近いほど少し暗く（簡易の接地陰影）
    g.setAttribute('position',new THREE.Float32BufferAttribute(this.p,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(this.n,3));
    g.setAttribute('color',new THREE.Float32BufferAttribute(this.c,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(this.u,2));
    g.computeBoundingSphere();const m=new THREE.Mesh(g,mat);m.castShadow=cast;m.receiveShadow=recv;return m;}
}
const GB=new THREE.BoxGeometry(1,1,1).toNonIndexed();
const GCYL=new THREE.CylinderGeometry(1,1,1,10).toNonIndexed();
const GPOLE=new THREE.CylinderGeometry(0.13,0.18,1,10).toNonIndexed();
const GICO=new THREE.IcosahedronGeometry(1,1);
// 植え込み・雑草用の軽い粒（面数 1/4）。法線を球の向きにして、角ばらずに丸く見せる
const GICO_LO=new THREE.IcosahedronGeometry(1,0);{const P=GICO_LO.attributes.position,N=GICO_LO.attributes.normal,v=V();for(let i=0;i<P.count;i++){v.fromBufferAttribute(P,i).normalize();N.setXYZ(i,v.x,v.y,v.z);}}
const _m=new THREE.Matrix4(),_q=new THREE.Quaternion(),_e=new THREE.Euler();
function put(B,g,M,x,y,z,sx,sy,sz,k,ry=0,rx=0,rz=0){_q.setFromEuler(_e.set(rx,ry,rz));B.add(g,M.clone().multiply(_m.compose(V(x,y,z),_q,V(sx,sy,sz))),k);}
// 下端の高さ y0 を指定して箱を置く
const box=(B,M,x,y0,z,sx,sy,sz,k,ry=0)=>put(B,GB,M,x,y0+sy/2,z,sx,sy,sz,k,ry);
// 面の大きさに合わせてテクスチャを繰り返す箱（per m ごとに1回）。BoxGeometry の面の順：+x,-x,+y,-y,+z,-z
function texBox(B,M,x,y0,z,sx,sy,sz,k,per){const S=[[sz,sy],[sz,sy],[sx,sz],[sx,sz],[sx,sy],[sx,sy]];
  B.add(GB,M.clone().multiply(_m.compose(V(x,y0+sy/2,z),_q.identity(),V(sx,sy,sz))),k,(i,u,v)=>{const f=S[Math.floor(i/6)];return[u*f[0]/per,v*f[1]/per];});}
// 2点を結ぶ細い角棒（電線・支柱など）
function seg(B,a,b,r,k){const d=V().subVectors(b,a),L=d.length();if(L<1e-4)return;_q.setFromUnitVectors(V(0,1,0),d.multiplyScalar(1/L));
  B.add(GB,new THREE.Matrix4().compose(V().addVectors(a,b).multiplyScalar(0.5),_q,V(r*2,L,r*2)),k);}
// たるんだ電線（a→b、中央で sag m 下がる）
function wire(B,a,b,sag,r,k,n=6){let p=a;for(let i=1;i<=n;i++){const t=i/n,q=V().lerpVectors(a,b,t);q.y-=sag*4*t*(1-t);seg(B,p,q,r,k);p=q;}}
// 断面 prof を線路に沿って引きのばす（断面は左→上→右の順。外向きの面を表にする）
function sweep(B,s0,s1,step,d0,h0,prof,cols,uvs){
  for(let s=s0;s<s1-1e-6;s+=step){const sa=s,sb=Math.min(s1,s+step),[xa,za,ta]=at(sa),[xb,zb,tb]=at(sb);
    const ca=Math.cos(ta),na=Math.sin(ta),cb=Math.cos(tb),nb=Math.sin(tb);
    for(let j=0;j<prof.length-1;j++){const[d1,h1]=prof[j],[d2,h2]=prof[j+1];
      const A=V(xa+ca*(d0+d1),h0+h1,za+na*(d0+d1)),Bq=V(xa+ca*(d0+d2),h0+h2,za+na*(d0+d2)),Cq=V(xb+cb*(d0+d2),h0+h2,zb+nb*(d0+d2)),Dq=V(xb+cb*(d0+d1),h0+h1,zb+nb*(d0+d1));
      const nd=-(h2-h1),nh=(d2-d1),hint=V(ca*nd,nh,na*nd);
      const uv=uvs?[[(d0+d1)/uvs[0],sa/uvs[1]],[(d0+d2)/uvs[0],sa/uvs[1]],[(d0+d2)/uvs[0],sb/uvs[1]],[(d0+d1)/uvs[0],sb/uvs[1]]]:null;
      B.quad(A,Bq,Cq,Dq,Array.isArray(cols)?cols[j]:cols,uv,hint);}}}

/* ---------- 手描き風のテクスチャ（その場で描く。外部素材なし） ---------- */
function canvasTex(w,h,draw,{repeat=true}={}){const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');draw(g,w,h,rngF(w*31+h));
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;if(repeat){t.wrapS=t.wrapT=THREE.RepeatWrapping;}t.anisotropy=8;return t;}
function speckle(g,w,h,r,n,cols,sz){for(let i=0;i<n;i++){g.fillStyle=cols[Math.floor(r()*cols.length)];const s=sz[0]+r()*(sz[1]-sz[0]);g.globalAlpha=0.35+r()*0.5;g.fillRect(r()*w,r()*h,s,s*(0.5+r()));}g.globalAlpha=1;}
const TEX={
  grass:LOOK_ID==='v2'?canvasTex(256,256,(g,w,h,r)=>{g.fillStyle='#9aad7c';g.fillRect(0,0,w,h);speckle(g,w,h,r,1800,['#8ea472','#a8b886','#93a978','#b4bd93'],[2,5]);
      g.strokeStyle='rgba(95,125,70,.22)';for(let i=0;i<260;i++){const x=r()*w,y=r()*h;g.beginPath();g.moveTo(x,y);g.lineTo(x+r()*2-1,y-2-r()*4);g.stroke();}})
   :canvasTex(256,256,(g,w,h,r)=>{g.fillStyle='#93a56f';g.fillRect(0,0,w,h);speckle(g,w,h,r,2600,['#7f9660','#a5b47c','#879e63','#b3b98a','#6f8a55'],[1,3]);
    g.strokeStyle='rgba(70,100,50,.35)';for(let i=0;i<300;i++){const x=r()*w,y=r()*h;g.beginPath();g.moveTo(x,y);g.lineTo(x+r()*2-1,y-2-r()*4);g.stroke();}}),
  ballast:LOOK_ID==='v2'?canvasTex(512,512,(g,w,h,r)=>{   // v2：角の丸い砕石を1つずつ描く。上が明るく下が影。色は灰色に少し茶色をまぜる
      g.fillStyle='#8e857a';g.fillRect(0,0,w,h);const cs=['#a59c90','#978d81','#ada497','#8c8277','#a29380','#b3ab9d','#877c70'];
      for(let i=0;i<5200;i++){const x=r()*w,y=r()*h,a=3+r()*4.5,b=a*(0.6+r()*0.35),t=r()*3.14,c=cs[Math.floor(r()*cs.length)];
        g.fillStyle='rgba(60,54,48,.35)';g.beginPath();g.ellipse(x+1,y+1.4,a,b,t,0,7);g.fill();
        g.fillStyle=c;g.beginPath();g.ellipse(x,y,a,b,t,0,7);g.fill();
        g.fillStyle='rgba(255,250,240,.22)';g.beginPath();g.ellipse(x-a*.25,y-b*.3,a*.55,b*.45,t,0,7);g.fill();}})
   :canvasTex(256,256,(g,w,h,r)=>{g.fillStyle='#8f8a82';g.fillRect(0,0,w,h);speckle(g,w,h,r,5200,['#a8a39a','#77726b','#b5afa4','#6a655f','#9b9286','#857a6e'],[2,5]);}),
  asphalt:canvasTex(256,256,(g,w,h,r)=>{g.fillStyle='#7c7f80';g.fillRect(0,0,w,h);speckle(g,w,h,r,3500,['#6e7173','#8a8d8e','#73767a','#959897'],[1,2]);
    g.fillStyle='#e9e8e0';g.fillRect(w*0.05,0,w*0.035,h);g.fillRect(w*0.915,0,w*0.035,h);}),
  fence:canvasTex(64,64,(g,w,h)=>{g.clearRect(0,0,w,h);g.strokeStyle='rgba(120,135,120,1)';g.lineWidth=2.2;
    for(let k=-1;k<=1;k++){g.beginPath();g.moveTo(k*w,0);g.lineTo(k*w+w,h);g.stroke();g.beginPath();g.moveTo(k*w+w,0);g.lineTo(k*w,h);g.stroke();}}),
  field:canvasTex(256,256,(g,w,h,r)=>{g.fillStyle='#a38d72';g.fillRect(0,0,w,h);speckle(g,w,h,r,1500,['#937c62','#b09a7e'],[1,3]);
    for(let i=0;i<8;i++){g.fillStyle='#86a660';for(let y=0;y<h;y+=6){g.beginPath();g.ellipse(i*32+16,y+3,6+r()*3,3.5,0,0,7);g.fill();}}}),
};

/* ---------- 3D の基本 ---------- */
// 対数深度は使わない（使うと奥の物を先に省けず重くなる）。重なる面は polygonOffset でずらしてある
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(1.5,window.devicePixelRatio||1));renderer.setSize(innerWidth,innerHeight);   // 高精細画面でも 1.5 倍まで（描く点の数を抑える）
renderer.toneMapping=THREE.NeutralToneMapping;renderer.toneMappingExposure=LOOK.exposure;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE[LOOK.shadow];
document.body.appendChild(renderer.domElement);
const scene=new THREE.Scene();
const HORIZON=col(LOOK.hor);
scene.fog=new THREE.FogExp2(HORIZON,LOOK.fog);   // 遠景の霞
const camera=new THREE.PerspectiveCamera(CFG.fov,innerWidth/innerHeight,0.5,14000);scene.add(camera);

// セル調の陰影（4段）
// v1：4段のくっきりしたセル陰影。v2：8段をなめらかにつないだ陰影（明るい面は明るいまま、日陰へは柔らかく移る）
const grad=LOOK.smooth?new THREE.DataTexture(new Uint8Array([82,118,160,198,224,240,250,255]),8,1,THREE.RedFormat):new THREE.DataTexture(new Uint8Array([92,155,212,255]),4,1,THREE.RedFormat);
grad.minFilter=grad.magFilter=LOOK.smooth?THREE.LinearFilter:THREE.NearestFilter;grad.needsUpdate=true;
const toon=(o={})=>LOOK.lambert?new THREE.MeshLambertMaterial(o):new THREE.MeshToonMaterial({gradientMap:grad,...o});   // v2 は段のない、なめらかな陰影
const MAT={
  vc:toon({vertexColors:true}),
  ground:toon({map:TEX.grass,polygonOffset:true,polygonOffsetFactor:4,polygonOffsetUnits:4}),
  ballast:toon({map:ART&&ART.ballast||TEX.ballast,vertexColors:true}),
  road:toon({map:ART&&ART.road||TEX.asphalt,vertexColors:true,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}),
  field:toon({map:TEX.field,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}),
  fence:toon({map:TEX.fence,transparent:true,alphaTest:0.04,side:THREE.DoubleSide,depthWrite:false}),
  far:new THREE.MeshLambertMaterial({vertexColors:true}),
};
// 光：やわらかい天空光＋暖かい日差し（左後ろ上から）
scene.add(new THREE.HemisphereLight(col(LOOK.hemi[0]),col(LOOK.hemi[1]),LOOK.hemi[2]));
const sun=new THREE.DirectionalLight(col(LOOK.sun[0]),LOOK.sun[1]);scene.add(sun,sun.target);
const SUN_DIR=V(-0.55,0.78,0.42).normalize();
sun.castShadow=true;renderer.shadowMap.autoUpdate=false;   // 影は視点が変わったときだけ描き直す（毎フレーム描くと建物を2回描くことになり重い）
sun.shadow.mapSize.set(LOOK.shMap||4096,LOOK.shMap||4096);   // v2 は解像度を半分にして影の輪郭をやわらげる（描画も軽くなる）
Object.assign(sun.shadow.camera,{left:-120,right:120,top:120,bottom:-120,near:1,far:900});sun.shadow.bias=-0.0004;sun.shadow.normalBias=0.03;sun.shadow.radius=LOOK.shRadius;sun.shadow.intensity=LOOK.shInt;

/* ---------- 空・雲・山 ---------- */
const sky=new THREE.Mesh(new THREE.SphereGeometry(12000,32,16),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,
  uniforms:{top:{value:col(LOOK.sky[0])},mid:{value:col(LOOK.sky[1])},hor:{value:HORIZON}},
  vertexShader:'varying vec3 vD;void main(){vD=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:`uniform vec3 top,mid,hor;varying vec3 vD;void main(){float h=max(vD.y,0.);vec3 c=mix(hor,mid,smoothstep(0.,.16,h));c=mix(c,top,smoothstep(.12,.7,h));
    gl_FragColor=vec4(c,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`}));
sky.renderOrder=-10;scene.add(sky);

function cloudTex(seed){return canvasTex(512,256,(g,w,h)=>{const r=rngF(seed),base=206;
  for(let i=0;i<30;i++){const x=70+r()*372,e=1-Math.abs(x-256)/230,rad=22+r()*50*Math.max(.25,e),y=base-rad*.55-r()*rad*1.25*Math.max(.2,e);
    const gr=g.createRadialGradient(x-rad*.3,y-rad*.35,rad*.1,x,y,rad);gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(.72,'rgba(250,252,255,.96)');gr.addColorStop(1,'rgba(240,246,252,0)');
    g.fillStyle=gr;g.beginPath();g.arc(x,y,rad,0,7);g.fill();}
  g.globalCompositeOperation='destination-out';const cut=g.createLinearGradient(0,base-8,0,base+12);cut.addColorStop(0,'rgba(0,0,0,0)');cut.addColorStop(1,'rgba(0,0,0,1)');g.fillStyle=cut;g.fillRect(0,base-8,w,h);
  g.globalCompositeOperation='source-atop';const sh=g.createLinearGradient(0,70,0,base);sh.addColorStop(0,'rgba(150,172,205,0)');sh.addColorStop(1,'rgba(140,160,198,.6)');g.fillStyle=sh;g.fillRect(0,0,w,h);},{repeat:false});}
{const tex=[11,23,37,51].map(cloudTex),o=P(600);
  for(let i=0;i<16;i++){const a=rr(-1.5,1.3),dist=rr(3200,7600),W=rr(900,2400);
    const s=new THREE.Sprite(new THREE.SpriteMaterial({map:pick(tex),fog:false,depthWrite:false,transparent:true}));
    s.position.set(o.x+Math.sin(a)*dist,dist*rr(0.04,0.13)+W*0.25+180,o.z-Math.cos(a)*dist);s.scale.set(W,W/2,1);scene.add(s);}}

// 遠くの山なみ（2列。霞で青く溶ける）
{const B=new Batch(),o=P(ROUTE?1700:700),MR=ROUTE?1700:0;const ph=[...Array(6)].map(()=>rr(0,7));
  [[3600+MR,110,260,'#5d7c6c','#7c9a88'],[5600+MR,220,520,'#6f8d8f','#93abb0']].forEach(([R0,h0,h1,cb,ct],li)=>{
    let prev=null;for(let a=0;a<=Math.PI*2+0.001;a+=0.012){const n=Math.sin(a*3+ph[0]+li)*.5+Math.sin(a*7.3+ph[1])*.3+Math.sin(a*17+ph[2])*.15+Math.sin(a*31+ph[3])*.06;
      const h=h0+(h1-h0)*Math.max(0,n*.5+.5)**1.6,r=R0+Math.sin(a*5+ph[4])*400;
      const b=V(o.x+Math.sin(a)*r,-10,o.z-Math.cos(a)*r),t=V(o.x+Math.sin(a)*(r+h*2.2),h,o.z-Math.cos(a)*(r+h*2.2));
      if(prev){const hint=V(o.x-b.x,0,o.z-b.z).normalize().add(V(0,1,0));
        const cB=col(cb),cT=col(ct);B.tri(prev[0],b,t,cB,null,null,null,hint);B.tri(prev[0],t,prev[1],cT,null,null,null,hint);}
      prev=[b,t];}});
  const mtn=B.mesh(MAT.far,{cast:false,recv:false});mtn.visible=!ART;scene.add(mtn);}   // v3 では描いた遠景に置きかえる

// 地面
{const GS=ROUTE?14000:9000;const g=new THREE.PlaneGeometry(GS,GS);g.rotateX(-Math.PI/2);const uv=g.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*GS/10,uv.getY(i)*GS/10);
  const m=new THREE.Mesh(g,MAT.ground);const o=P(ROUTE?1700:600);m.position.set(o.x,0,o.z);m.receiveShadow=true;scene.add(m);}

/* ---------- 線路・架線 ---------- */
const BRAIL=new Batch(),BPOLE=new Batch();   // v5：レール・架線柱（絵のテクスチャ付き）
const BV=new Batch(), BW=new Batch(), BBal=new Batch(), BRoad=new Batch(), BField=new Batch(), BFence=new Batch();
const TR=[CFG.own,CFG.own+CFG.gap];  // 2本の線路の中心
const S_END=CFG.pathTo-50;
// 道床（砂利）：2線ぶん1枚。肩はなだらかに
sweep(BBal,CFG.pathFrom,S_END,2,0,0,[[-5.1,0.02],[-4.0,0.5],[4.0,0.5],[5.1,0.02]],col('#ffffff'),[2.2,2.2]);
sweep(BBal,CFG.pathFrom,S_END,4,0,0.02,[[-5.8,0],[-5.1,0]],col('#b9b3a6'),[2.2,2.2]);
sweep(BBal,CFG.pathFrom,S_END,4,0,0.02,[[5.1,0],[5.8,0]],col('#b9b3a6'),[2.2,2.2]);
// レール（50kgN を簡略化した断面。頭頂は磨かれて明るく、側面は錆色）
{const pr=[[-0.065,0],[-0.065,0.012],[-0.008,0.03],[-0.008,0.11],[-0.033,0.115],[-0.033,0.153],[0.033,0.153],[0.033,0.115],[0.008,0.11],[0.008,0.03],[0.065,0.012],[0.065,0]];
  const rust=col('#6b5241'),side=col('#7f7770'),top=col('#d4d7d9');const cs=[rust,rust,rust,rust,side,top,side,rust,rust,rust,rust];
  for(const d0 of TR)for(const sg of[-1,1])sweep(ART&&ART.rail_detail_gray?BRAIL:BV,CFG.pathFrom,S_END,1.5,d0+sg*(CFG.gauge/2+0.033),CFG.sleeperTop,pr,cs,ART&&ART.rail_detail_gray?[0.3,2.5]:undefined);}   // v5：錆のむらを重ねる
// まくらぎ（PCまくらぎ）：数が多いので InstancedMesh
{const pitch=0.62,n=Math.floor((S_END-CFG.pathFrom)/pitch),im=new THREE.InstancedMesh(new THREE.BoxGeometry(2.0,0.16,0.22),ART&&ART.sleeper_concrete?toon({map:ART.sleeper_concrete}):toon({color:col('#bdb9b0')}),n*2);   // v5：描いた枕木
  let i=0;for(const d0 of TR)for(let k=0;k<n;k++){im.setMatrixAt(i++,FM(CFG.pathFrom+k*pitch,d0,CFG.sleeperTop-0.08));}
  im.receiveShadow=true;scene.add(im);}
// ケーブルトラフ・線路わきのさく
// 区間モードでは、駅と踏切の所を除いた区間ごとに置く
function sideSegs(a,b){if(!ROUTE)return[[a,b]];const ex=[...STA.map(z=>[z.s0-2,z.s1+2]),...(XS!=null?[[XS-3.5,XS+3.5]]:[])].sort((p,q)=>p[0]-q[0]);
  const out=[];let c=a;for(const[e0,e1]of ex){if(e1<=c||e0>=b)continue;if(e0>c)out.push([c,e0]);c=Math.max(c,e1);}if(c<b)out.push([c,b]);return out;}
for(const[a,b]of sideSegs(CFG.pathFrom,S_END))sweep(BV,a,b,3,-5.35,0,[[-0.22,0],[-0.22,0.22],[0.22,0.22],[0.22,0]],col('#b7b3aa'));
for(const fd of[-5.95,5.95]){for(const[a,b]of sideSegs(CFG.pathFrom,S_END))sweep(BFence,a,b,3,fd,0,[[0,0.05],[0,1.75]],col('#ffffff'),[1.0,1.0]);
  for(let s=CFG.pathFrom;s<CFG.build;s+=2.5){if(skipSide(s))continue;const M=FM(s,fd,0);put(BV,GCYL,M,0,0.9,0,0.03,1.8,0.03,col('#7b877a'));}
  for(const[a,b]of sideSegs(CFG.pathFrom,CFG.build))sweep(BV,a,b,3,fd,1.78,[[-0.025,0],[-0.025,0.05],[0.025,0.05],[0.025,0]],col('#7b877a'));}
// 架線柱（門形：柱2本＋トラス状のはり）、ちょう架線・トロリ線・ハンガー・き電線
{const SP=50,cMetal=col('#8e9598'),cDark=col('#5b6164'),cIns=col('#c9b9a0');
  const HC=CFG.railTop+5.0, HM=CFG.railTop+6.1, HB=CFG.railTop+7.4, HF=CFG.railTop+8.3, PD=4.75;
  const sup=[];   // 各支持点の [ちょう架線, トロリ線] × 線路
  for(let k=Math.ceil(CFG.pathFrom/SP);k*SP<S_END;k++){const s=k*SP,M=FM(s);
    for(const sg of[-1,1]){put(ART&&ART.pole_steel?BPOLE:BV,GPOLE,M,sg*PD,HF/2+0.2,0,1.2,HF+0.4,1.2,ART&&ART.pole_steel?col('#ffffff'):cMetal);box(BV,M,sg*PD,0,0,0.6,0.25,0.6,col('#a5a196'));}
    box(BV,M,0,HB,0,PD*2+0.5,0.16,0.16,cMetal);box(BV,M,0,HB-0.55,0,PD*2+0.5,0.13,0.13,cMetal);   // はり（上弦・下弦）
    for(let x=-PD;x<=PD+0.01;x+=PD/5)box(BV,M,x,HB-0.55,0,0.06,0.6,0.06,cMetal);
    for(let x=-PD;x<PD-0.01;x+=PD/5)put(BV,GB,M,x+PD/10,HB-0.25,0,0.05,0.78,0.05,cMetal,0,0,(x/PD*5)%2?0.7:-0.7);
    const row=[];
    TR.forEach((d0,ti)=>{const stag=(k%2?1:-1)*0.2,hx=d0-0.55*Math.sign(d0||1);
      box(BV,M,hx,HC-0.25,0,0.07,HB-0.55-(HC-0.25),0.07,cMetal);      // 下げ管
      box(BV,M,hx+(d0>hx?0.3:-0.3),HM-0.05,0,0.7,0.06,0.06,cMetal);  // ちょう架線の支え
      put(BV,GCYL,M,hx,HM+0.25,0,0.06,0.35,0.06,cIns);                // がいし
      seg(BV,P(s,hx,HC+0.15),P(s,d0+stag,HC+0.02),0.025,cMetal);      // 振止め金具
      row[ti]=[P(s,d0,HM),P(s,d0+stag,HC)];});
    for(const sg of[-1,1])box(BV,M,sg*PD+sg*0.25,HF-0.3,0,0.5,0.08,0.08,cMetal);
    sup.push({s,row,feed:[P(s,-PD-0.25,HF-0.25),P(s,PD+0.25,HF-0.25)]});}
  for(let i=0;i+1<sup.length;i++){const a=sup[i],b=sup[i+1];
    for(let ti=0;ti<2;ti++){const[ma,ca]=a.row[ti],[mb,cb]=b.row[ti];wire(BW,ma,mb,0.32,0.011,col('#4d5355'),8);seg(BW,ca,cb,0.009,col('#5e5146'));
      for(let j=1;j<8;j++){const t=j/8,m=V().lerpVectors(ma,mb,t);m.y-=0.32*4*t*(1-t);seg(BW,m,V().lerpVectors(ca,cb,t),0.004,cDark);}}
    for(let f=0;f<2;f++)wire(BW,a.feed[f],b.feed[f],0.55,0.016,col('#3f4446'),8);}}

/* ---------- 道路 ---------- */
function roadAlong(d0,d1,s0=CFG.pathFrom,s1=CFG.build+300){sweep(BRoad,s0,s1,3,0,0.025,[[d0,0],[d1,0]],col('#ffffff'),[d1-d0,6]);}
function crossRoad(s,d0,d1,w=4.6){const M=FM(s),L=(x,z)=>V(x,0.03,z).applyMatrix4(M),len=Math.abs(d1-d0);
  BRoad.quad(L(d0,w/2),L(d1,w/2),L(d1,-w/2),L(d0,-w/2),col('#ffffff'),[[0,0],[0,len/6],[1,len/6],[1,0]],V(0,1,0));}
roadAlong(6.35,10.35);roadAlong(36.9,40.9);roadAlong(-23.4,-19.4);roadAlong(-53.4,-49.4);

/* ---------- 建物の部品 ---------- */
function faceM(M,w,d,f){const t={F:[0,d/2,0],B:[0,-d/2,Math.PI],R:[w/2,0,Math.PI/2],L:[-w/2,0,-Math.PI/2]}[f];
  const m=new THREE.Matrix4().makeRotationY(t[2]);m.setPosition(f==='R'||f==='L'?t[0]:0,0,f==='F'||f==='B'?t[1]:0);return M.clone().multiply(m);}
function windowAt(B,Fm,u,y,ww,wh,wallC){const gl=chance(0.28)?col(PAL.curtain):jit(pick(PAL.glass),0.04),fr=col(PAL.frame);
  box(B,Fm,u,y-wh/2-0.07,0.03,ww+0.14,wh+0.14,0.06,fr);
  if(ART&&ART.window){box(B===DUMMY?DUMMY:BWIN,Fm,u,y-wh/2,0.05,ww,wh,0.05,gl.clone().lerp(col('#ffffff'),0.8));}   // v4：窓は描いた窓の絵（ガラス色はわずかに残す）
  else{box(B,Fm,u,y-wh/2,0.05,ww,wh,0.05,gl);
  if(ww>1.0)box(B,Fm,u,y-wh/2,0.08,0.045,wh,0.03,fr);                              // 引き違いの召し合わせ
  }
  if(wh<1.6)box(B,Fm,u,y-wh/2-0.12,0.06,ww+0.25,0.06,0.12,col('#bfc2c2'));          // 水切り
  if(chance(0.3))box(B,Fm,u+ww/2+0.42,y-wh/2-0.05,0.07,0.6,wh+0.1,0.14,wallC.clone().offsetHSL(0,0,-0.12));}  // 戸袋
function roof(B,M,w,d,y0,pitch,over,type,rc,wc,RB=null){
  const W=w/2+over,D=d/2+over,L=(x,y,z)=>V(x,y,z).applyMatrix4(M),up=V(0,1,0);
  const T=RB||B,sf=Math.sqrt(1+pitch*pitch),per=2.2,rcT=RB?rc.clone().multiplyScalar(1.3):rc;   // 屋根材の絵：軒から棟へ per m ごとに1回
  const uvF=(x,z)=>[x/per,(D-Math.abs(z))*sf/per],uvE=(x,z)=>[z/per,(W-Math.abs(x))*sf/per];
  const Q=(a,b,c,d2,f)=>T.quad(L(...a),L(...b),L(...c),L(...d2),rcT,RB?[a,b,c,d2].map(p=>f(p[0],p[2])):null,up);
  const Tr=(a,b,c,f)=>T.tri(L(...a),L(...b),L(...c),rcT,RB?f(a[0],a[2]):null,RB?f(b[0],b[2]):null,RB?f(c[0],c[2]):null,up);
  box(B,M,0,y0-0.14,0,2*W,0.16,2*D,col(PAL.soffit));   // 軒天・鼻隠し
  if(type==='flat'){box(B,M,0,y0,0,w+0.3,0.5,d+0.3,wc);return;}
  const rise=D*pitch,top=y0+rise;
  if(type==='gable'){Q([-W,y0,D],[W,y0,D],[W,top,0],[-W,top,0],uvF);Q([-W,y0,-D],[W,y0,-D],[W,top,0],[-W,top,0],uvF);
    for(const sg of[-1,1]){const x=sg*w/2,hint=V(sg,0,0).transformDirection(M),ye=y0+rise*over/D;
      B.tri(L(x,y0,-d/2),L(x,y0,d/2),L(x,top,0),wc,null,null,null,hint);B.tri(L(x,y0,d/2),L(x,ye,d/2),L(x,top,0),wc,null,null,null,hint);B.tri(L(x,y0,-d/2),L(x,top,0),L(x,ye,-d/2),wc,null,null,null,hint);
      seg(B,L(sg*W,y0-0.05,D),L(sg*W,top+0.03,0),0.06,col(PAL.soffit));seg(B,L(sg*W,y0-0.05,-D),L(sg*W,top+0.03,0),0.06,col(PAL.soffit));}   // 破風
    seg(B,L(-W,top+0.04,0),L(W,top+0.04,0),0.09,rc.clone().offsetHSL(0,0,-0.06));return;}
  // 寄棟
  const rl=Math.max(0,W-D);Q([-W,y0,D],[W,y0,D],[rl,top,0],[-rl,top,0],uvF);Q([-W,y0,-D],[W,y0,-D],[rl,top,0],[-rl,top,0],uvF);
  Tr([-W,y0,-D],[-W,y0,D],[-rl,top,0],uvE);Tr([W,y0,-D],[W,y0,D],[rl,top,0],uvE);
  const rk=rc.clone().offsetHSL(0,0,-0.06);if(rl>0)seg(B,L(-rl,top+0.04,0),L(rl,top+0.04,0),0.08,rk);
  for(const[sx,sz]of[[-1,-1],[-1,1],[1,-1],[1,1]])seg(B,L(sx*W,y0+0.03,sz*D),L(sx*rl,top+0.04,0),0.06,rk);}
const TREES=[],DUMMY={add(){},quad(){},tri(){}};   // v3：樹木は描いた絵の板として、あとでまとめて置く
function tree(B,M,x,z,h,{blobs=[4,7]}={}){const T=M.clone().multiply(new THREE.Matrix4().makeTranslation(x,0,z));
  if(ART){const np=ART.treePool?ART.treePool.length:3;TREES.push({p:V().setFromMatrixPosition(T),h:h*1.15,v:ART.treePool?Math.floor(R5()*np):TREES.length%3});B=DUMMY;}   // 乱数の引き方を v2 と揃えるため、立体の木も計算だけして捨てる
  put(B,GCYL,T,0,h*0.25,0,h*0.022,h*0.5,h*0.022,jit('#6b5442',0.05));const n=Math.floor(rr(blobs[0],blobs[1]+1)),base=jit(pick(PAL.greens),0.03);
  for(let i=0;i<n;i++){const a=R()*7,rad=h*rr(0.16,0.27),rr2=h*rr(0,0.17);const c=base.clone().offsetHSL(rr(-0.015,0.015),0,rr(-0.06,0.07));
    put(B,GICO,T,Math.cos(a)*rr2,h*rr(0.55,0.9),Math.sin(a)*rr2,rad*rr(1,1.25),rad*rr(0.8,1),rad*rr(1,1.25),c,R()*7);}}
function shrubRow(B,M,x0,x1,z,h=0.8){for(let x=x0;x<x1;x+=rr(0.7,1.1))put(B,GICO_LO,M,x,h*0.5,z,rr(0.45,0.7),h*rr(0.55,0.75),rr(0.45,0.6),jit(pick(PAL.greens),0.05),R()*7);}
function car(B,M,x,z,ry){const c=jit(pick(PAL.cars),0.02),T=M.clone().multiply(new THREE.Matrix4().makeRotationY(ry).setPosition(x,0,z));
  box(B,T,0,0.32,0,1.72,0.62,4.3,c);box(B,T,0,0.92,-0.25,1.56,0.58,2.3,c);box(B,T,0,0.98,-0.25,1.6,0.42,2.1,col('#3d4752'));
  for(const[a,b]of[[-0.8,1.35],[0.8,1.35],[-0.8,-1.35],[0.8,-1.35]])put(B,GCYL,T,a,0.33,b,0.33,0.22,0.33,col('#2a2b2d'),0,0,Math.PI/2);}
function blockWall(B,M,x0,x1,z,h=1.15){if(x1-x0<0.2)return;const k=jit(PAL.block,0.02);
  if(ART&&ART.blockwall)texBox(BBW,M,(x0+x1)/2,0,z,x1-x0,h,0.15,col('#f2f0ea'),1.8);else box(B,M,(x0+x1)/2,0,z,x1-x0,h,0.15,k);   // v4：描いたブロック塀（絵1枚で約1.8m四方）
  box(B,M,(x0+x1)/2,h,z,x1-x0+0.04,0.06,0.2,col('#d3cec4'));}

/* ---------- 戸建て住宅（2階建て）。ローカル座標：幅 x、奥行 z、正面 +z ---------- */
function house(B,M,lotW,lotD){
  const w=Math.min(lotW-1.8,rr(7.2,9.6)),d=rr(6.6,Math.min(8.6,w)),fh=rr(2.75,2.95),base=0.45,yard=rr(2.6,3.8);
  const zc=lotD/2-yard-d/2,xo=rr(-0.4,0.4)*Math.max(0,lotW-w-1.8),H=M.clone().multiply(new THREE.Matrix4().makeTranslation(xo,0,zc));
  const wc=jit(pick(PAL.walls)),rc=jit(pick(PAL.roofs),0.03);
  box(B,H,0,0,0,w+0.1,base,d+0.1,jit(PAL.base,0.02));if(ART){const wt=ART.walls?pick5(Object.keys(ART.walls)):'wall',wcol=wt==='wall_dark_siding'?col(pick5(['#6d6660','#5e6468','#7a6a5c'])):wc.clone().multiplyScalar(1.12);texBox(BWTS(wt),H,0,base,0,w,2*fh,d,wcol,wt==='wall_tile'?1.6:2.6);}else box(B,H,0,base,0,w,2*fh,d,wc);
  box(B,H,0,base+fh-0.06,0,w+0.06,0.12,d+0.06,wc.clone().offsetHSL(0,0,-0.08));   // 胴差しの帯
  const balF=chance(0.6)?'F':'B',balW=Math.min(w-0.8,rr(2.8,4.6)),balU=rr(-1,1)*(w-balW)/2*0.8;
  for(const f of['F','B','L','R']){const fw=f==='F'||f==='B'?w:d,Fm=faceM(H,w,d,f),n=Math.max(1,Math.floor(fw/2.4));
    const BF=ART&&ART.house_side&&(f==='L'||f==='R')?DUMMY:B;   // v6：横の壁は描いた壁の絵にするので、立体の窓は計算だけして捨てる
    for(let fl=0;fl<2;fl++)for(let i=0;i<n;i++){const u=-fw/2+(i+0.5)*fw/n;
      if(f==='F'&&fl===0&&i===0){box(B,Fm,u,base,0.04,0.95,2.05,0.08,jit('#6a5141',0.04));box(B,Fm,u,base+2.25,0.45,1.5,0.08,0.9,col('#9a9a96'));continue;}  // 玄関とひさし
      if(!chance(f==='L'||f==='R'?0.55:0.8))continue;
      const sweepWin=fl===0&&f!=='L'&&f!=='R'&&chance(0.45),onBal=f===balF&&fl===1&&Math.abs(u-balU)<balW/2;
      const ww=sweepWin||onBal?rr(1.5,1.75):pick([0.75,1.15,1.6]),wh=sweepWin||onBal?1.85:rr(0.9,1.15),y=base+fl*fh+(wh>1.6?0.1+wh:1.95);
      windowAt(BF,Fm,u,y,Math.min(ww,fw/n-0.4),wh,wc);}
    if(f===balF){const y=base+fh;box(B,Fm,balU,y-0.08,0.55,balW,0.16,1.1,col('#d9d6cf'));
      const rcol=pick([wc.clone().offsetHSL(0,0,-0.05),col('#eceae4'),col('#8f969c')]);box(B,Fm,balU,y+0.08,1.08,balW,1.0,0.06,rcol);
      for(const sg of[-1,1])box(B,Fm,balU+sg*(balW/2-0.03),y+0.08,0.55,0.06,1.0,1.1,rcol);
      if(chance(0.35))box(B,Fm,balU+rr(-0.6,0.6),y+0.65,1.12,rr(1,1.6),0.55,0.08,col(pick(['#f4f1ea','#e9c9c4','#cfdbe8','#efe2b8'])));}}  // 干した布団
  if(chance(0.7)){const Fm=faceM(H,w,d,pick(['L','R']));box(ART&&ART.house_side?DUMMY:B,Fm,rr(-1,1),0,0.25,0.8,0.6,0.32,col('#eeeeea'));}   // 室外機
  roof(B,H,w,d,base+2*fh,rr(0.42,0.56),rr(0.45,0.65),chance(0.55)?'hip':'gable',rc,wc,ART?BRT:null);
  if(ART&&ART.house_side){const hh=2*fh;   // v6：横の壁（小窓・雨どい・室外機の絵）と、4面の汚れ・軒の影
    for(const f of['L','R'])faceQuad(BT('house_side'),faceM(H,w,d,f),-d/2,d/2,base,base+hh,0.03,wc.clone().lerp(col('#ffffff'),0.55),[0,d/6.2,0,hh/4.1]);
    for(const f of['F','B','L','R']){const fw=f==='F'||f==='B'?w:d;faceQuad(BGRIME,faceM(H,w,d,f),-fw/2,fw/2,base,base+hh,0.06,col('#ffffff'),[0,1,0,1]);}}
  return{w,d,xo,zc};}

/* ---------- 低層マンション（3〜4階） ---------- */
// 面（faceM の座標：x＝面の左右、y＝高さ、z＝外向き）に、uv 範囲 [u0,u1,v0,v1] の絵を貼った四角形を置く
function faceQuad(B,Fm,x0,x1,y0,y1,z,c,uv){const L=(x,y)=>V(x,y,z).applyMatrix4(Fm),n=V(0,0,1).transformDirection(Fm);
  B.quad(L(x0,y0),L(x1,y0),L(x1,y1),L(x0,y1),c,[[uv[0],uv[2]],[uv[1],uv[2]],[uv[1],uv[3]],[uv[0],uv[3]]],n);}
// v6：マンションの面を住戸区画の絵で組む（区画1つ＝1住戸×1階。ベランダ側は2種類を混ぜる）
function aptFacades(H,w,d,fl,fh,base,n,uw,balF,corF){const Fb=faceM(H,w,d,balF),Fc=faceM(H,w,d,corF),W=col('#ffffff'),hh=fl*fh+0.3;
  for(let i=0;i<fl;i++)for(let u=0;u<n;u++){const x=-w/2+u*uw,y=base+i*fh;
    faceQuad(BT(R6()<0.45?'apt_bal_b':'apt_bal_a'),Fb,x,x+uw,y,y+fh,0.03,W,[0,1,0,1]);
    if(i>0)faceQuad(BT('apt_cor'),Fc,x,x+uw,y,y+fh,0.03,W,[0,1,0,1]);}
  faceQuad(BT('apt_ground'),Fc,-w/2,w/2,base,base+fh,0.03,W,[0,Math.max(1,Math.round(w/(fh*3))),0,1]);   // 廊下側の1階：エントランスと駐輪場
  for(const f of['L','R'])faceQuad(BT('apt_end'),faceM(H,w,d,f),-d/2,d/2,base,base+hh,0.03,W,[0,d/6,0,hh/6]);   // 妻側
  for(const f of[balF,corF])faceQuad(BGRIME,faceM(H,w,d,f),-w/2,w/2,base,base+hh,0.07,W,[0,Math.max(1,Math.round(w/12)),0,1]);
  for(const f of['L','R'])faceQuad(BGRIME,faceM(H,w,d,f),-d/2,d/2,base,base+hh,0.07,W,[0,1,0,1]);
  const top=base+hh,rw=w*0.92,rh=rw*ART.apt_roof.image.height/ART.apt_roof.image.width;   // 屋上：パラペットと設備の絵を、建物の中ほどに立てる
  faceQuad(BROOF,faceM(H,w,0,'F'),-rw/2,rw/2,top-0.35,top-0.35+rh,0,W,[0,1,0,1]);}
function apart(B,M,lotW,lotD){const B0=B;
  const fl=pick([3,3,4]),fh=2.9,w=Math.min(lotW-2.2,rr(16,26)),d=Math.min(lotD-5.2,rr(7.4,8.6)),base=0.4;rr(0,1);   // 乱数を引く回数を最初の版と揃える（街並みの配置を変えないため）
  const zc=((lotD/2-0.8-d/2-1.35)+(-lotD/2+0.5+d/2+1.45))/2,   // 前のバルコニーと後ろの廊下まで区画に収める
       H=M.clone().multiply(new THREE.Matrix4().makeTranslation(0,0,zc));
  const wc=jit(pick(PAL.apart),0.02),dark=wc.clone().offsetHSL(0,0,-0.1),n=Math.max(3,Math.round(w/4.2)),uw=w/n;
  box(B,H,0,0,0,w+0.1,base,d+0.1,col(PAL.base));box(B,H,0,base,0,w,fl*fh+0.3,d,wc);
  const balF=chance(0.6)?'F':'B',corF=balF==='F'?'B':'F',railC=pick([col('#f2f0ea'),col('#c9ced2'),col('#8fa3b2'),dark]);
  const Fb=faceM(H,w,d,balF),Fc=faceM(H,w,d,corF);
  if(ART&&ART.apt_bal_a)B=DUMMY;   // v6：ベランダ・廊下の立体は計算だけして捨て、住戸区画の絵で組み直す（乱数の引き方は同じ）
  for(let i=0;i<fl;i++){const y=base+i*fh;
    for(let u=0;u<n;u++){const x=-w/2+(u+0.5)*uw;
      box(B,Fb,x,y+0.2,0.04,uw*0.72,2.0,0.06,jit(pick(PAL.glass),0.03));box(B,Fb,x,y+0.2,0.07,0.05,2.0,0.03,col(PAL.frame));
      box(B,Fc,x-uw*0.22,y+0.15,1.36,0.88,2.0,0.06,col('#8d9296'));   // 玄関ドア（廊下側）
      windowAt(B,Fc,x+uw*0.2,y+1.95,0.9,0.75,wc);}
    if(i>0){box(B,Fb,0,y-0.1,0.65,w,0.18,1.3,col('#dad7d0'));box(B,Fc,0,y-0.1,0.7,w,0.18,1.4,col('#dad7d0'));}
    const yr=i>0?y+0.08:y;box(B,Fb,0,yr,1.27,w,1.05,0.1,railC);box(B,Fc,0,yr,1.38,w,1.1,0.16,wc);
    for(let u=0;u<=n;u++)box(B,Fb,-w/2+u*uw,yr,0.65,0.07,i>0?2.6:1.05,1.3,dark);   // 隔て板
    for(let u=0;u<n;u++)if(chance(0.22))box(B,Fb,-w/2+(u+0.5)*uw+rr(-0.5,0.5),yr+0.55,1.33,rr(1,1.5),0.55,0.07,col(pick(['#f4f1ea','#e9c9c4','#cfdbe8','#efe2b8'])));}
  B=B0;
  if(ART&&ART.apt_bal_a)aptFacades(H,w,d,fl,fh,base,n,uw,balF,corF);
  box(B,H,w/2+1.6,0,0,3.2,fl*fh+1.4,3.6,wc);box(B,H,w/2+1.6,fl*fh+1.4,0,3.4,0.15,3.8,dark);   // 階段室
  const top=base+fl*fh+0.3;for(const[x,z,sx,sz]of[[0,d/2,w,0.2],[0,-d/2,w,0.2],[w/2,0,0.2,d],[-w/2,0,0.2,d]])box(B,H,x,top,z,sx,0.55,sz,dark);   // パラペット
  box(B,H,-w/4,top,0,2.8,2.4,2.6,wc);put(B,GCYL,H,w/5,top+0.9,-1,0.9,1.8,0.9,col('#cfd3d4'));   // 塔屋・受水槽
  shrubRow(B,H,-w/2,w/2,balF==='F'?d/2+1.7:d/2+0.6,0.9);}

/* ---------- 区画（宅地）を並べる ---------- */
const BH=new Batch();   // 建物・樹木など（影あり）
const BWT=new Batch(), BRT=new Batch();   // v3：外壁・屋根（絵のテクスチャ付き）
const BBW=new Batch(), BWIN=new Batch();
const BTD={},BT=k=>BTD[k]||(BTD[k]=new Batch()),BGRIME=new Batch(),BROOF=new Batch();   // v6：絵ごとのまとめ描き、汚れ・軒の影、屋上設備  // v4：ブロック塀・窓（絵のテクスチャ付き）
// v5：外壁・畑は種類ごとに、レール・架線柱はそれぞれ別のまとめ描き
const pick5=a=>a[Math.floor(R5()*a.length)],BWTD={},BFD={},BWTS=k=>k==='wall'?BWT:(BWTD[k]||(BWTD[k]=new Batch())),BFS=k=>BFD[k]||(BFD[k]=new Batch());
function lotM(s,dc,faceTrack){return FM(s,dc,0,dc>0?(faceTrack?-Math.PI/2:Math.PI/2):(faceTrack?Math.PI/2:-Math.PI/2));}
function fillRow(d0,d1,faceTrack,crosses,opts={}){
  const depth=Math.abs(d1-d0),dc=(d0+d1)/2;let s=CFG.pathFrom+20;
  while(s<CFG.build){const cx=crosses.find(c=>c>=s&&c<s+40);if(cx!=null&&cx-s<12){s=cx+3.2;continue;}
    let kind=R(),W;
    if(kind<0.12)W=rr(20,28);else if(kind<0.16)W=rr(24,34);else if(kind<0.22)W=rr(14,20);else if(kind<0.26&&opts.field)W=rr(30,48);else W=rr(9.5,12.5);
    if(cx!=null&&s+W>cx-2.3){W=cx-2.3-s;kind=0.9;if(W<8){s=cx+3.2;continue;}}
    if(ROUTE&&Math.min(Math.abs(d0),Math.abs(d1))<26&&inZone(s,s+W,6)){s+=W;continue;}   // 駅の前は空ける
    const sc=s+W/2,M=lotM(sc,dc,faceTrack);
    if(kind<0.12&&W>=18)apart(BH,M,W,depth);
    else if(kind<0.16){for(let i=0;i<Math.floor(W/4);i++)tree(BH,M,rr(-W/2+2,W/2-2),rr(-depth/2+2,depth/2-2),rr(5,9));   // 公園・空き地の木立
      blockWall(BH,M,-W/2,W/2,-depth/2+0.1,0.6);}
    else if(kind<0.22){const MP=M;BRoad.quad(...[[-W/2,depth/2],[W/2,depth/2],[W/2,-depth/2],[-W/2,-depth/2]].map(([x,z])=>V(x,0.03,z).applyMatrix4(MP)),col('#d8d8d4'),[[0,0],[1,0],[1,1],[0,1]].map(([a,b])=>[0.5,b*3]),V(0,1,0));   // 月極駐車場
      for(let x=-W/2+1.4;x<W/2-1.2;x+=2.6)if(chance(0.6))car(BH,M,x,rr(-1,1),Math.PI/2*0+(chance(.5)?0:Math.PI));blockWall(BH,M,-W/2,W/2,-depth/2+0.1,0.5);}
    else if(kind<0.26&&opts.field){const L=(x,z)=>V(x,0.03,z).applyMatrix4(M);(ART&&ART.fields?BFS(pick5(Object.keys(ART.fields))):BField).quad(L(-W/2,depth/2),L(W/2,depth/2),L(W/2,-depth/2),L(-W/2,-depth/2),col('#ffffff'),[[0,0],[W/8,0],[W/8,depth/8],[0,depth/8]],V(0,1,0));
      box(BH,M,W/2-3,0,-depth/2+3,3,2.3,2.2,col('#9aa3a8'));box(BH,M,W/2-3,2.3,-depth/2+3,3.3,0.12,2.6,col('#6c7a82'));}   // 畑と物置
    else{const h=house(BH,M,W,depth);
      const gate=h.xo>0?-W/2+1.6:W/2-1.6;   // 門（車庫）の位置
      blockWall(BH,M,-W/2+0.1,gate-1.4,depth/2-0.1);blockWall(BH,M,gate+1.4,W/2-0.1,depth/2-0.1);
      if(chance(0.6))blockWall(BH,M,-W/2+0.1,W/2-0.1,-depth/2+0.1,rr(1.0,1.6));else shrubRow(BH,M,-W/2+0.4,W/2-0.4,-depth/2+0.5,rr(1.0,1.6));
      if(chance(0.5))car(BH,M,gate,depth/2-2.6,0);
      if(chance(0.55))tree(BH,M,-gate*0.6,rr(-depth/2+1.2,-depth/2+2),rr(3.5,6.5));
      if(chance(0.4))shrubRow(BH,M,-W/2+0.4,Math.min(W/2-0.4,gate-1.6),depth/2-0.6,0.7);}
    s+=W;}}
const crossR=[], crossL=[];
for(let s=60;s<CFG.build;s+=rr(85,140))crossR.push(s);
for(let s=110;s<CFG.build;s+=rr(120,190))crossL.push(s);
crossR.forEach(s=>crossRoad(s,10.35,67));crossL.forEach(s=>crossRoad(s,-67,-19.4));
if(XS!=null){crossR.push(XS);crossL.push(XS);crossRoad(XS,-19.4,-7.2);crossRoad(XS,7.2,10.35);}   // 踏切の道
fillRow(10.85,23.9,true,crossR);fillRow(23.9,36.9,false,crossR);fillRow(40.9,53.9,true,crossR);fillRow(53.9,67,false,crossR);
fillRow(-19.4,-6.6,false,XS!=null?[XS]:[],{field:true});fillRow(-36.4,-23.4,true,crossL,{field:true});fillRow(-49.4,-36.4,false,crossL);fillRow(-66.4,-53.4,true,crossL);
// 線路わきの雑草・低木
for(let s=CFG.pathFrom+5;s<CFG.build;s+=rr(6,22)){const d=chance(.5)?rr(-6.4,-6.1):rr(5.0,5.5);put(skipSide(s)?DUMMY:BH,GICO_LO,FM(s,d,0),0,0.25,0,rr(0.4,0.9),rr(0.3,0.5),rr(0.5,1.2),jit(pick(PAL.greens),0.05),R()*7);}

/* ---------- 電柱と電線（線路わきの道路沿い・裏の道路沿い） ---------- */
function poleLine(d,s0,s1){const pts=[];
  for(let s=s0;s<s1;s+=rr(28,36)){const M=FM(s,d,0),pc=col('#b4b0a7');put(BH,GPOLE,M,0,6,0,1,12,1,pc);
    box(BH,M,0,10.6,0,1.7,0.1,0.1,col('#8a8a86'));box(BH,M,0,9.7,0,1.2,0.09,0.09,col('#8a8a86'));
    if(chance(0.3))put(BH,GCYL,M,0.38,8.4,0,0.3,0.95,0.3,col('#9ea3a6'));   // 変圧器
    box(BH,M,0,0,0,0.42,1.8,0.42,col('#e2d14a'));   // 足元の黄色いカバー
    pts.push(M);}
  const L=(M,x,y)=>V(x,y,0).applyMatrix4(M);
  for(let i=0;i+1<pts.length;i++){const a=pts[i],b=pts[i+1];
    for(const x of[-0.75,0,0.75])wire(BW,L(a,x,10.72),L(b,x,10.72),0.35,0.012,col('#3f4446'),6);
    for(const x of[-0.5,0.5])wire(BW,L(a,x,9.8),L(b,x,9.8),0.4,0.012,col('#3f4446'),6);
    wire(BW,L(a,0.2,6.2),L(b,0.2,6.2),0.55,0.03,col('#2e3133'),6);}}
poleLine(10.6,CFG.pathFrom+10,CFG.build);poleLine(-23.65,CFG.pathFrom+20,CFG.build);poleLine(41.15,CFG.pathFrom+15,CFG.build);

/* ---------- 遠景の街（霞の中の建物） ---------- */
{const B=new Batch();
  for(let i=0;i<(ROUTE?2600:1400);i++){const s=rr(-100,CFG.pathTo+200),sg=chance(.5)?1:-1,d=sg*(70+Math.pow(R(),1.4)*560);
    if(s>CFG.build+40&&Math.abs(d)<75)continue;
    const tall=chance(0.1),h=tall?rr(16,34):rr(5,11),w=rr(7,tall?24:13),dd=rr(7,tall?16:11),M=FM(s,d,0,rr(-0.15,0.15));
    const c=jit(pick(tall?['#e6e3dc','#d4d6d6','#ece6d8','#c7cbcf']:PAL.walls),0.03);box(B,M,0,0,0,w,h,dd,c);
    if(tall){for(let y=2.6;y<h-1;y+=3)box(B,M,0,y,0,w+0.05,0.5,dd+0.05,c.clone().offsetHSL(0,0,-0.09));}
    else{const rc=jit(pick(PAL.roofs),0.03),L=(x,y,z)=>V(x,y,z).applyMatrix4(M);B.quad(L(-w/2-.3,h,dd/2+.3),L(w/2+.3,h,dd/2+.3),L(w/2,h+dd*.25,0),L(-w/2,h+dd*.25,0),rc,null,V(0,1,0));B.quad(L(-w/2-.3,h,-dd/2-.3),L(w/2+.3,h,-dd/2-.3),L(w/2,h+dd*.25,0),L(-w/2,h+dd*.25,0),rc,null,V(0,1,0));}
    if(chance(0.25))tree(B,M,w/2+rr(1,3),rr(-3,3),rr(6,11),{blobs:[3,4]});}
  scene.add(B.mesh(MAT.far,{cast:false,recv:false}));}

/* ---------- 区間モード：駅（ホーム・屋根・ベンチ・駅舎）と踏切の道 ---------- */
const PLT=CFG.railTop+1.0;   // ホームの高さ（レール面から約1m）
if(ROUTE){const cTop=col('#bdb6aa'),cSide=col('#9d968b'),cRoof=col('#6f7f86'),cPil=col('#8b9296');
  for(const z of STA){
    for(const[a,b,sg]of[[-7.6,-3.55,-1],[3.55,6.3,1]]){   // 左＝自列車側、右＝反対側のホーム
      const pr=sg<0?[[a,0],[a,PLT],[b,PLT],[b,0]]:[[a,0],[a,PLT],[b,PLT],[b,0]];
      sweep(BV,z.s0,z.s1,5,0,0,pr,[cSide,cTop,cSide]);
      const e=sg<0?b:a,inn=sg<0?-1:1;   // e＝線路側の縁、inn＝ホームの内側へ向かう向き
      sweep(BV,z.s0,z.s1,5,0,PLT+0.008,sg<0?[[e+inn*0.95,0],[e+inn*0.65,0]].reverse():[[e+inn*0.65,0],[e+inn*0.95,0]],col('#d9b23a'));   // 点字ブロック
      sweep(BV,z.s0,z.s1,5,0,PLT+0.008,sg<0?[[e+inn*0.12,0],[e+inn*0.02,0]].reverse():[[e+inn*0.02,0],[e+inn*0.12,0]],col('#efefe8'));   // 縁の白線
      const r0=z.s0+(z.s1-z.s0)*0.25,r1=z.s0+(z.s1-z.s0)*0.75,pd=sg<0?-6.6:5.5;   // 屋根は中ほどに
      for(let t=r0;t<=r1+0.1;t+=9){const M=FM(t,pd,0);box(BV,M,0,PLT,0,0.28,3.25,0.28,cPil);box(BV,M,0,PLT,0,0.45,0.35,0.45,cSide);}
      const ra=sg<0?a-0.3:a+0.35,rb=sg<0?b-0.35:b+0.3;
      sweep(BV,r0-3,r1+3,4,0,PLT+3.2,[[ra,0],[ra,0.22],[rb,0.4],[rb,0.18],[ra,0]],cRoof);
      for(let t=r0+4;t<r1;t+=12){const M=FM(t,sg<0?-7.0:5.85,0);box(BV,M,0,PLT+0.42,0,0.45,0.06,1.8,col('#7a5c43'));box(BV,M,0,PLT,0,0.4,0.42,0.12,col('#55585c'));box(BV,M,-sg*0.2,PLT+0.48,0,0.06,0.45,1.8,col('#7a5c43'));}}   // ベンチ
    const big=z.key==='C',M=FM((z.s0+z.s1)/2+(big?-10:0),big?-17:-12,0),bw=big?13:8,bl=big?70:22,bh=big?8.5:4.2;   // 駅舎（左側の奥）
    box(BH,M,0,0,0,bw,bh,bl,col(big?'#e2ddd2':'#e6dccb'));box(BH,M,0,bh,0,bw+0.6,0.35,bl+0.6,col('#6b6f73'));
    for(let i=0;i<Math.floor(bl/4);i++)box(BH,M,bw/2+0.02,big?4.6:1.0,-bl/2+2+i*4,0.04,big?2.2:1.8,2.6,jit(pick(PAL.glass),0.03));
    box(BH,M,bw/2+0.4,bh-0.8,0,0.5,0.6,bl*0.6,col('#2f5d8a'));}   // 駅名の帯
  // 踏切：線路の上の路面（レール面の高さ）と、両側の坂
  {const M=FM(XS),L=(x,y,z)=>V(x,y,z).applyMatrix4(M),W2=2.3,up=V(0,1,0),y1=CFG.railTop-0.006,c=col('#ffffff');
    BRoad.quad(L(-5.4,y1,W2),L(5.4,y1,W2),L(5.4,y1,-W2),L(-5.4,y1,-W2),c,[[0,0],[1,0],[1,0.8],[0,0.8]],up);
    for(const sg of[-1,1]){const x0=sg*5.4,x1=sg*7.2;BRoad.quad(L(x0,y1,W2),L(x1,0.03,W2),L(x1,0.03,-W2),L(x0,y1,-W2),c,[[0,0],[0.3,0],[0.3,0.8],[0,0.8]],up);}}}

/* ---------- まとめたメッシュをシーンへ ---------- */
if(ART){
  // 外壁・屋根：絵の明暗に家ごとの色をかける
  if(ART.blockwall)scene.add(BBW.chunks(toon({map:ART.blockwall,vertexColors:true}),120,{ao:true}),BWIN.chunks(toon({map:ART.window,vertexColors:true}),120,{cast:false}));
  if(ART.apt_bal_a){for(const[k,b]of Object.entries(BTD))scene.add(b.chunks(toon({map:ART[k],vertexColors:true}),120,{ao:k==='house_side'}));
    scene.add(BROOF.mesh(toon({map:ART.apt_roof,alphaTest:0.4,side:THREE.DoubleSide}),{cast:true}));
    scene.add(BGRIME.chunks(new THREE.MeshBasicMaterial({map:ART.facade_grime,transparent:true,depthWrite:false,fog:false,blending:THREE.CustomBlending,blendSrc:THREE.DstColorFactor,blendDst:THREE.ZeroFactor,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}),120,{cast:false,recv:false}));}   // 汚れ・軒の影は掛け合わせで重ねる
  if(ART.walls){for(const[k,b]of Object.entries(BWTD))scene.add(b.chunks(toon({map:ART.walls[k],vertexColors:true}),120,{ao:true}));
    for(const[k,b]of Object.entries(BFD))scene.add(b.mesh(toon({map:ART.fields[k],polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}),{cast:false}));
    scene.add(BRAIL.chunks(toon({map:ART.rail_detail_gray,vertexColors:true}),160,{cast:false}),BPOLE.chunks(toon({map:ART.pole_steel,vertexColors:true}),160));}
  scene.add(BWT.chunks(toon({map:ART.wall,vertexColors:true}),120,{ao:true}),BRT.chunks(toon({map:ART.roof,vertexColors:true}),120));
  // 樹木：絵の板をカメラの方へ向けて立てる（3種類の絵ごとに1回の描画）
  const camP=P(CFG.camS,CFG.own+CFG.eyeOff,0),pg=new THREE.PlaneGeometry(1,1).translate(0,0.5,0);
  (ART.treePool||[ART.tree1,ART.tree2,ART.tree3]).forEach((tx,vi)=>{const L=TREES.filter(t=>t.v===vi);if(!L.length)return;const asp=tx.image.width/tx.image.height;
    const mat=new THREE.MeshBasicMaterial({map:tx,alphaTest:0.45,side:THREE.DoubleSide,color:col('#eeeeee')});
    const K=ROUTE?2:1,im=new THREE.InstancedMesh(pg,mat,L.length*K);   // 区間モード：走ると向きが変わるので、2枚を十字に組む
    L.forEach((t,i)=>{const yaw=Math.atan2(camP.x-t.p.x,camP.z-t.p.z);for(let k=0;k<K;k++)im.setMatrixAt(i*K+k,new THREE.Matrix4().compose(t.p,new THREE.Quaternion().setFromAxisAngle(V(0,1,0),yaw+k*Math.PI/2+(ROUTE?Math.PI/4:0)),V(t.h*asp,t.h,1)));});
    im.castShadow=true;im.customDepthMaterial=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,map:tx,alphaTest:0.45});scene.add(im);});
  // 草むら：さくの両側に、線路に沿った帯として
  {const G=new Batch(),asp=ART.grass.image.width/ART.grass.image.height;
    for(const[d,H]of[[-5.78,0.8],[5.78,0.8],[-6.12,1.0],[6.12,0.95]]){const per=H*asp,off=Math.abs(d)*7.3;
      for(let s=CFG.pathFrom;s<CFG.build;s+=2){if(skipSide(s)||skipSide(s+2))continue;const a=P(s,d,0),b=P(s+2,d,0),c=P(s+2,d,H),e=P(s,d,H),u0=(s+off)/per,u1=(s+2+off)/per;
        G.quad(a,b,c,e,col('#ffffff'),[[u0,0],[u1,0],[u1,1],[u0,1]],null);}}
    scene.add(G.mesh(toon({map:ART.grass,vertexColors:true,alphaTest:0.4,side:THREE.DoubleSide}),{cast:false,upN:true}));}
  // 遠景：カメラを中心にした大きな円筒の内側に、絵を左右反転しながら3回並べる（空はプログラムの空のまま）
  {const R0=3000,span=THREE.MathUtils.degToRad(190),tiles=3,asp=ART.pano.image.width/ART.pano.image.height,ang=span/tiles/asp,lo=THREE.MathUtils.degToRad(-1.1),hi=lo+ang;
    ART.pano.repeat.set(tiles,1);const H=R0*(Math.tan(hi)-Math.tan(lo));
    const g=new THREE.CylinderGeometry(R0,R0,H,96,1,true,Math.PI-span/2,span);
    const pano=new THREE.Mesh(g,new THREE.MeshBasicMaterial({map:ART.pano,transparent:true,fog:false,depthWrite:false,side:THREE.BackSide}));
    pano.renderOrder=-5;pano.userData.y=R0*(Math.tan(hi)+Math.tan(lo))/2;pano.rotation.y=-at(CFG.camS+300)[2];scene.add(pano);window.__pano=pano;}}
scene.add(BV.chunks(MAT.vc,160),BH.chunks(MAT.vc,120,{ao:true}),BW.mesh(MAT.vc,{cast:false}),BBal.mesh(MAT.ballast,{cast:false}),BRoad.mesh(MAT.road,{cast:false}),BField.mesh(MAT.field,{cast:false}),BFence.mesh(MAT.fence,{cast:false}));


/* ---------- 区間モード：踏切・信号の絵、駅名標、走行 ---------- */
if(ROUTE){
  const TL=new THREE.TextureLoader(),ld=n=>TL.loadAsync('../../assets/images/cab3d/lib/'+n+'.webp').then(t=>{t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t;});
  const [txSig,txGate,txRS]=await Promise.all([ld('crossing_signal'),ld('crossing_gate'),ld('rail_signal')]);
  const spriteMat=t=>new THREE.MeshLambertMaterial({map:t,alphaTest:0.45,side:THREE.DoubleSide});
  // 絵の板を置く。yaw は FM の座標での向き（0＝列車の方を向く）
  function board(t,s,d,y,h,yaw,w){const asp=t.image.width/t.image.height,W=w||h*asp,g=new THREE.PlaneGeometry(W,h).translate(0,h/2,0),m=new THREE.Mesh(g,spriteMat(t));
    m.matrixAutoUpdate=false;m.matrix.copy(FM(s,d,y,yaw));m.castShadow=true;m.customDepthMaterial=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,map:t,alphaTest:0.45});scene.add(m);return {m,W,h};}
  // 踏切：警報機（十字に2枚）、遮断かん（線路に沿う向き）、点滅する赤い灯
  const LAMPS=[];
  for(const[sx,sd]of[[XS+3.1,-7.7],[XS-3.1,7.7]]){const h=3.6;board(txSig,sx,sd,0,h,Math.PI/2);const b=board(txSig,sx,sd,0,h,0);
    for(const k of[-1,1]){const sp=new THREE.Sprite(new THREE.SpriteMaterial({color:0xff3020,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,fog:false}));
      sp.position.copy(P(sx,sd+k*b.W*0.26,h*0.7));sp.scale.set(0.55,0.55,1);sp.visible=false;scene.add(sp);LAMPS.push({sp,k});}}
  board(txGate,XS,-8.0,0.15,0.95,Math.PI/2,5.4);board(txGate,XS,8.0,0.15,0.95,-Math.PI/2,5.4);
  // 電車の信号機（列車の方を向く）
  for(const rs of RSIG)board(txRS,rs,CFG.own-2.7,0,6.2,0);
  // 駅名標・停止位置目標（文字は絵ではなく、その場で描く）
  let ST={};try{ST=(await (await fetch('../../data/ride.json')).json()).stations||{};}catch(e){}
  const KJ={C:'中央',S:'桜町',U:'大学前'},ORD=['C','S','U'];
  function signTex(k){const c=document.createElement('canvas');c.width=1024;c.height=384;const g=c.getContext('2d');
    g.fillStyle='#fbfaf6';g.fillRect(0,0,1024,384);g.fillStyle='#2f5d8a';g.fillRect(0,268,1024,116);g.fillStyle='#3d7f63';g.fillRect(0,252,1024,16);
    g.fillStyle='#1d2329';g.textAlign='center';g.font='700 150px "Hiragino Sans","Noto Sans JP",sans-serif';g.fillText(KJ[k],512,170);
    g.font='500 46px "Hiragino Sans","Noto Sans JP",sans-serif';g.fillText((ST[k]&&ST[k].kana)||'',512,232);
    const i=ORD.indexOf(k);g.fillStyle='#fff';g.font='500 44px "Hiragino Sans","Noto Sans JP",sans-serif';
    if(ORD[i-1]){g.textAlign='left';g.fillText('← '+KJ[ORD[i-1]],34,342);}if(ORD[i+1]){g.textAlign='right';g.fillText(KJ[ORD[i+1]]+' →',990,342);}
    g.textAlign='center';g.font='400 36px sans-serif';g.fillText((ST[k]&&ST[k].roma)||'',512,342);
    const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t;}
  for(const z of STA){const t=signTex(z.key),mat=new THREE.MeshLambertMaterial({map:t});
    for(const f of[0.18,0.5,0.82,0.96]){const sp=z.s0+(z.s1-z.s0)*f;
      for(const[d,yaw]of[[-7.25,Math.PI/2],[5.95,-Math.PI/2]]){const m=new THREE.Mesh(new THREE.PlaneGeometry(2.6,0.98),mat);m.matrixAutoUpdate=false;m.matrix.copy(FM(sp,d,PLT+1.75,yaw));scene.add(m);
        for(const o of[-1.1,1.1]){const pm=new THREE.Mesh(new THREE.BoxGeometry(0.07,1.3,0.07),MAT.vc);const q=FM(sp,d,0,yaw).multiply(new THREE.Matrix4().makeTranslation(o,PLT+0.65,-0.04));pm.matrixAutoUpdate=false;pm.matrix.copy(q);scene.add(pm);}}}}
  {const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');g.fillStyle='#f2c230';g.fillRect(0,0,256,256);g.strokeStyle='#222';g.lineWidth=14;g.strokeRect(7,7,242,242);
    g.fillStyle='#111';g.font='700 190px sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText('6',128,140);
    const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;const z=STA[1],m=new THREE.Mesh(new THREE.PlaneGeometry(0.55,0.55),new THREE.MeshLambertMaterial({map:t}));
    m.matrixAutoUpdate=false;m.matrix.copy(FM(z.stop+5,-3.95,PLT+1.45));scene.add(m);const pm=new THREE.Mesh(new THREE.BoxGeometry(0.05,1.2,0.05),MAT.vc);pm.matrixAutoUpdate=false;pm.matrix.copy(FM(z.stop+5,-3.95,PLT+0.6).multiply(new THREE.Matrix4().makeTranslation(0,0,0.03)));scene.add(pm);}

  // 走行：中央を発車 → 加速 → 惰行 → 桜町の停止位置に止まる（時間の進みは実時間×倍速。フレームの速さに左右されない）
  const RUN={s:STA[0].stop,v:0,play:false,mult:1,vmax:70/3.6,acc:0.75,dec:0.72,shake:true,state:'中央 停車中',wait:0,arrived:false};
  window.__RUN=RUN;
  const hud=document.getElementById('hud');document.getElementById('views').style.display='none';
  hud.querySelector('b').textContent='3D運転席 試作｜中央 → 桜町（走行）';document.getElementById('sec').textContent='約3.2km・駅・踏切・信号つき（線形・街並みは仮設定）';
  const box2=document.createElement('div');box2.innerHTML=`<div id="rv" style="font-size:22px;font-weight:700;margin:4px 0">0 km/h</div><small id="rd"></small><br><small id="rst"></small>
    <div class="rrow"><button id="rp">▶ 出発</button><button id="rr">最初から</button><button data-m="1" aria-pressed="true">×1</button><button data-m="2">×2</button><button data-m="4">×4</button></div>
    <div class="rrow"><label>最高速度 <input id="rmax" type="range" min="0" max="80" step="5" value="70"> <span id="rmaxv">70</span> km/h</label></div>
    <div class="rrow"><label><input id="rsh" type="checkbox" checked> 揺れ</label></div>`;hud.appendChild(box2);
  const st=document.createElement('style');st.textContent='#hud .rrow{margin-top:6px;display:flex;gap:6px;align-items:center;flex-wrap:wrap}#hud .rrow button{font:inherit;font-size:12px;background:#3b4652;color:#f3f1ea;border:1px solid #56626e;border-radius:5px;padding:2px 8px;cursor:pointer}#hud .rrow button[aria-pressed=true]{background:#c9a35c;color:#1d1a14;border-color:#c9a35c}#hud input[type=range]{width:120px;accent-color:#c9a35c;vertical-align:middle}';document.head.appendChild(st);
  const $=id=>document.getElementById(id);
  $('rp').onclick=()=>{if(RUN.arrived)return;RUN.play=!RUN.play;if(RUN.play&&RUN.v===0&&RUN.s<STA[0].stop+1)RUN.wait=2;$('rp').textContent=RUN.play?'⏸ 一時停止':'▶ 再開';};
  $('rr').onclick=()=>{Object.assign(RUN,{s:STA[0].stop,v:0,play:false,arrived:false,wait:0});$('rp').textContent='▶ 出発';placeCamera(RUN.s,true);};
  box2.querySelectorAll('button[data-m]').forEach(b=>b.onclick=()=>{RUN.mult=Number(b.dataset.m);box2.querySelectorAll('button[data-m]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));});
  $('rmax').oninput=e=>{RUN.vmax=Number(e.target.value)/3.6;$('rmaxv').textContent=e.target.value;};
  $('rsh').onchange=e=>{RUN.shake=e.target.checked;};
  let lastCull=-1e9;
  function cull(force){if(!force&&Math.abs(RUN.s-lastCull)<10)return;lastCull=RUN.s;const c=camera.position;for(const m of CHUNKS){const b=m.geometry.boundingSphere;m.visible=b.center.distanceTo(c)-b.radius<1300;}}
  window.__step=function(dt){const tgt=STA[1].stop;let t=dt*RUN.mult;const moving=RUN.play||RUN.wait>0;if(!moving&&!(RUN.s>XS-450&&RUN.s<XS+15))return false;   // 止まっている間は描き直さない
    while(t>0){const h=Math.min(t,0.05);t-=h;
      if(!RUN.play||RUN.arrived)break;
      if(RUN.wait>0){RUN.wait-=h;RUN.state='発車します';continue;}
      const rem=tgt-RUN.s,brk=RUN.v*RUN.v/(2*RUN.dec);
      if(rem<=0.02){RUN.v=0;RUN.s=tgt;RUN.arrived=true;RUN.play=false;RUN.state='桜町 到着';$('rp').textContent='到着';break;}
      if(rem<=brk+0.3){RUN.v=Math.max(0,Math.min(RUN.v,Math.sqrt(2*RUN.dec*Math.max(0,rem-0.05))));RUN.state='ブレーキ';}
      else if(RUN.v<RUN.vmax-0.05){RUN.v=Math.min(RUN.vmax,RUN.v+RUN.acc*h);RUN.state='加速';}
      else{RUN.v=Math.max(RUN.vmax,RUN.v-0.05*h);RUN.state='惰行';}
      if(RUN.vmax<0.1&&RUN.v<0.01){RUN.state='停止（最高速度0）';}
      RUN.s+=RUN.v*h;if(rem>0&&RUN.v<0.2&&rem<0.6){RUN.s=tgt;}}
    const now=performance.now()/1000,sh=RUN.shake&&RUN.v>0.3?RUN.v/20:0,joint=((RUN.s%25)+25)%25<0.6?0.004*sh:0;
    placeCamera(RUN.s,false,sh?{y:Math.sin(now*9.1)*0.004*sh+Math.sin(now*13.7)*0.002*sh-joint,r:Math.sin(now*3.3)*0.0012*sh}:null);cull(false);
    const near=RUN.s>XS-450&&RUN.s<XS+15,on=Math.floor(now*1.6)%2;LAMPS.forEach(L=>L.sp.visible=near&&((L.k>0)===(on===1)));
    $('rv').textContent=(RUN.v*3.6).toFixed(0)+' km/h';$('rd').textContent=`走行 ${Math.max(0,RUN.s-STA[0].stop).toFixed(0)} m ／ 桜町まで ${Math.max(0,tgt-RUN.s).toFixed(0)} m`;
    $('rst').textContent=RUN.play||RUN.arrived||RUN.wait>0?RUN.state:(RUN.s<STA[0].stop+1?'中央 停車中':'一時停止');return true;};
  window.__setS=v=>{RUN.s=v;placeCamera(v,true);cull(true);dirty=true;};
  cull(true);}
/* ---------- 運転台（簡素） ---------- */
{const g=new THREE.Group(),m=c=>toon({color:col(c)});
  const dash=new THREE.Mesh(new THREE.BoxGeometry(2.4,0.5,0.7),m('#353b42'));dash.position.set(0.2,-0.74,-0.95);dash.rotation.x=0.08;g.add(dash);
  const lip=new THREE.Mesh(new THREE.BoxGeometry(2.4,0.04,0.06),m('#1f2327'));lip.position.set(0.2,-0.48,-0.62);g.add(lip);
  for(const x of[-0.42,-0.3]){const ga=new THREE.Mesh(new THREE.CylinderGeometry(0.035,0.035,0.02,24),m('#ebe7dc'));ga.rotation.x=0.35;ga.position.set(x,-0.465,-0.8);g.add(ga);}
  const pil=new THREE.Mesh(new THREE.BoxGeometry(0.1,1.6,0.12),m('#2b3036'));pil.position.set(-0.8,0.05,-1.0);pil.rotation.z=-0.05;g.add(pil);
  const hd=new THREE.Mesh(new THREE.BoxGeometry(2.6,0.16,0.14),m('#2b3036'));hd.position.set(0.2,0.47,-1.0);g.add(hd);
  camera.add(g);}

/* ---------- 視点 ---------- */
let lastShadowS=-1e9;
function placeCamera(s,force,shk){const d=CFG.own+CFG.eyeOff,h=CFG.railTop+CFG.eyeH+(shk?shk.y:0),M=FM(s,d,h);
  camera.matrix.copy(M).multiply(new THREE.Matrix4().makeRotationX(-0.025)).multiply(new THREE.Matrix4().makeRotationZ(shk?shk.r:0));camera.matrix.decompose(camera.position,camera.quaternion,camera.scale);
  sky.position.copy(camera.position);if(window.__pano){window.__pano.position.set(camera.position.x,camera.position.y+window.__pano.userData.y,camera.position.z);if(ROUTE)window.__pano.rotation.y=-at(s+300)[2];}
  const tg=P(s+80,0,0);sun.target.position.copy(tg);sun.position.copy(tg).addScaledVector(SUN_DIR,400);sun.target.updateMatrixWorld();if(force!==false||Math.abs(s-lastShadowS)>6){renderer.shadowMap.needsUpdate=true;lastShadowS=s;}
  document.getElementById('pos').textContent=s.toFixed(0);}
const VIEWS=[['出発直後',40],['曲線の手前',150],['曲線の中',300],['区間の終わり',480]];
const vb=document.getElementById('views');let curS=CFG.camS;
VIEWS.forEach(([n,s])=>{const b=document.createElement('button');b.textContent=n;b.onclick=()=>{curS=s;placeCamera(s);mark();};b.dataset.s=s;vb.appendChild(b);});
function mark(){vb.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.s)===curS)));}
if(!ROUTE){const a=document.createElement('button');a.textContent='▶ 中央→桜町を走る';a.style.cssText='background:#c9a35c;color:#1d1a14;border-color:#c9a35c;font-weight:700';a.onclick=()=>{location.href='?route=cs&look=v6';};vb.appendChild(a);}   // 静止画版から走る版へ
placeCamera(curS);mark();
if(!ROUTE)document.getElementById('sec').textContent=`${CFG.from} → ${CFG.to}（仮想${CFG.sec}m区間・仮設定）`;
document.getElementById('look').textContent={v1:'変更前（look=v1）',v2:'プログラムのみ（v2）',v3:'美術素材版（look=v3）',v4:'美術素材版＋道床・道路・塀・窓（look=v4）',v5:'＋木・外壁・畑の種類、枕木・架線柱・レール（look=v5）',v6:'＋マンションの住戸区画・戸建ての横の壁・汚れ（look=v6）'}[LOOK_ID];

// 第1段階は静止画なので、視点や画面の大きさが変わったときだけ描く。?bench=1 のときは毎フレーム描いて fps を測る
const BENCH=Q.get('bench')==='1';let dirty=true;
// v2：いったん画面外に描き、最後に色調補正（彩度を少し抑え、暗部を青みのある色に持ち上げる）してから画面へ
let RT=null,postScene=null,postCam=null;
if(LOOK.grade){RT=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,samples:4});
  const q=new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.ShaderMaterial({uniforms:{tex:{value:RT.texture}},depthTest:false,depthWrite:false,
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader:`uniform sampler2D tex;varying vec2 vUv;
      void main(){vec3 c=texture2D(tex,vUv).rgb;float l=dot(c,vec3(.2126,.7152,.0722));
        c=mix(vec3(l),c,.96);                      // 彩度をわずかに抑える
        c=c*.97+vec3(.006,.011,.024);               // 暗い所を青みのある色へ持ち上げる（黒つぶれ防止）
        c+=vec3(.035,.022,0.)*smoothstep(.35,1.,l); // 日の当たる所をほんのり暖色に
        vec2 d=vUv-.5;c*=1.-dot(d,d)*.2;            // ごく弱い周辺減光
        gl_FragColor=vec4(c,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`}));
  q.frustumCulled=false;postScene=new THREE.Scene();postScene.add(q);postCam=new THREE.Camera();}
function sizeRT(){if(RT){const pr=renderer.getPixelRatio();RT.setSize(Math.round(innerWidth*pr),Math.round(innerHeight*pr));}}
sizeRT();
function draw(){if(RT){renderer.setRenderTarget(RT);renderer.render(scene,camera);renderer.setRenderTarget(null);renderer.render(postScene,postCam);}else renderer.render(scene,camera);}
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);sizeRT();dirty=true;});
vb.addEventListener('click',()=>{dirty=true;});
let fN=0,fT=performance.now();
let lastT=performance.now();
renderer.setAnimationLoop(()=>{const tn=performance.now(),dt=Math.min(0.1,(tn-lastT)/1000);lastT=tn;if(ROUTE&&window.__step&&window.__step(dt))dirty=true;
  if(!dirty&&!BENCH)return;dirty=false;draw();window.__ready=true;
  if(ROUTE){fN++;if(tn-fT>1000){document.getElementById('fps').textContent=(fN*1000/(tn-fT)).toFixed(0)+' fps';window.__fps=fN*1000/(tn-fT);fN=0;fT=tn;}return;}
  if(!BENCH){document.getElementById('fps').textContent='（静止画）';return;}
  fN++;const t=performance.now();if(t-fT>1000){document.getElementById('fps').textContent=(fN*1000/(t-fT)).toFixed(0);window.__fps=fN*1000/(t-fT);fN=0;fT=t;}});
window.__info=()=>({calls:renderer.info.render.calls,tris:renderer.info.render.triangles});
window.__scene=scene;window.__T=THREE;
