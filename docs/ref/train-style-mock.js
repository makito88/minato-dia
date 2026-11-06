// 2026-11-06 列車の見た目の試し描き（docs/ref/train-style-mock.png を描いたコード）。第7回で列車を描くときの手本。
// car(x,y,ang,L,W,st,head,tail)：1両を、位置・向き・長さ・幅・色・先頭か・最後尾か で描く。canvas の 2D コンテキスト c を使う。
 // 1両を描く（お手本：真上に近い見下ろし・丸い屋根・冷房の箱が2つ・濃い縁取り・手前に細い帯）
 function car(x,y,ang,L,W,st,head,tail){
  c.save();c.translate(x,y);c.rotate(ang);
  const side=W*0.36;const r=W*0.32;
  const shape=(w,h,dy)=>{c.beginPath();const x0=-L/2,x1=L/2,y0=-h/2+dy,y1=h/2+dy,hr=head?h*0.55:r,tr=tail?h*0.55:r;
   c.moveTo(x0+tr,y0);c.lineTo(x1-hr,y0);c.quadraticCurveTo(x1,y0,x1,y0+hr*0.9);c.lineTo(x1,y1-hr*0.9);c.quadraticCurveTo(x1,y1,x1-hr,y1);
   c.lineTo(x0+tr,y1);c.quadraticCurveTo(x0,y1,x0,y1-tr*0.9);c.lineTo(x0,y0+tr*0.9);c.quadraticCurveTo(x0,y0,x0+tr,y0);c.closePath();};
  // 影
  c.fillStyle='rgba(0,0,0,.28)';shape(L,W+side,W*0.35);c.fill();
  // 車体（手前の側面）：色と帯
  shape(L,W+side,side/2);c.fillStyle=st.body;c.fill();c.lineWidth=1.6;c.strokeStyle=st.edge;c.stroke();
  c.save();shape(L,W+side,side/2);c.clip();
  c.fillStyle=st.stripe;c.fillRect(-L/2,W/2+side*0.35,L,side*0.45);
  c.fillStyle='rgba(30,45,60,.85)';const n=st.win;for(let i=0;i<n;i++){const wx=-L/2+L*0.12+i*(L*0.76)/n;c.fillRect(wx,W/2-1,(L*0.76)/n-2.5,side*0.32);}
  c.restore();
  // 屋根（明るい色・ふち）
  shape(L-5,W*0.74,-0.5);const rg=c.createLinearGradient(0,-W/2,0,W/2);rg.addColorStop(0,st.roofHi);rg.addColorStop(1,st.roof);c.fillStyle=rg;c.fill();
  c.lineWidth=1.2;c.strokeStyle=st.edge;c.stroke();
  // 冷房の箱 2つ
  for(const fx of [-0.18,0.14]){const bx=L*fx-W*0.3,by=-W*0.32,bw=W*0.6,bh=W*0.62;c.fillStyle='#f3f4f2';c.fillRect(bx,by,bw,bh);c.strokeStyle='#9aa1a8';c.lineWidth=0.8;c.strokeRect(bx,by,bw,bh);
   c.strokeStyle='#b9bfc4';c.beginPath();for(let k=1;k<4;k++){c.moveTo(bx+1,by+bh*k/4);c.lineTo(bx+bw-1,by+bh*k/4);}c.moveTo(bx+bw/2,by+1);c.lineTo(bx+bw/2,by+bh-1);c.stroke();}
  // 先頭の窓
  if(head){c.fillStyle='#18242f';c.beginPath();c.moveTo(L/2-W*0.62,-W*0.42);c.quadraticCurveTo(L/2-1,-W*0.42,L/2-1,0);c.quadraticCurveTo(L/2-1,W*0.42+side*0.5,L/2-W*0.62,W*0.42+side*0.5);c.closePath();c.fill();
   c.fillStyle='rgba(255,255,255,.35)';c.fillRect(L/2-W*0.5,-W*0.3,1.6,W*0.25);}
  if(tail){c.fillStyle='#d23a2e';c.fillRect(-L/2+1,W/2+side*0.2,2.2,2.2);}
  c.restore();}
 function train(s,head,n,L,W,st,dy){const gap=2.2;for(let k=0;k<n;k++){const d=head-k*(L+gap);const a=at(s,d+L/2-0.5),b=at(s,d-L/2+0.5);const x=(a.x+b.x)/2,y=(a.y+b.y)/2+dy,ang=Math.atan2(a.y-b.y,a.x-b.x);
   // 連結部の幌
   if(k>0){c.fillStyle='#333';c.save();c.translate(b.x,b.y+dy);c.rotate(ang);c.fillRect(-2,-W*0.35,3,W*0.7);c.restore();}
   car(x,y,ang,L,W,st,k===0,k===n-1);}}
 const LOCAL={body:'#ece6d6',stripe:'#e8792b',roof:'#cfd2d4',roofHi:'#eef0f1',edge:'#2e3b4a',win:5};const CREAM={body:'#efe7cf',stripe:'#d8cdae',roof:'#e2dccb',roofHi:'#f6f1e2',edge:'#2e3b4a',win:5};
 const EXP={body:'#8e1f2e',stripe:'#e1c46a',roof:'#d3d6d8',roofHi:'#f1f2f3',edge:'#2a1d24',win:6};
