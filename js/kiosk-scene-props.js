/* Drawing only: a grip belongs to a pose; a product belongs to the event. */
(function(root){
'use strict';
const PRODUCTS={cf_black:{width:1,height:2.05,color:'#654133',bottle:false},dr_sports:{width:1,height:2.65,color:'#3982b8',bottle:true}};
function placement(frame,id){
  const grip=frame.grip,p=PRODUCTS[id];
  if(!grip||!p)return null; // Back-facing torsos hide the hand and product together.
  return {x:grip.x,y:grip.y,width:grip.width*p.width,height:grip.width*p.height,angle:grip.angle||0,product:p};
}
function paint(ctx,sheet,frame,id){
  const m=placement(frame,id);if(!m)return;
  const g=frame.grip,w=m.width,h=m.height;
  ctx.save();ctx.translate(m.x,m.y);ctx.rotate(m.angle);
  const body=ctx.createLinearGradient(-w/2,0,w/2,0);
  body.addColorStop(0,'#aac7ce');body.addColorStop(.35,'#f2eee2');body.addColorStop(1,'#719298');
  ctx.fillStyle=body;ctx.strokeStyle='#4e5959';ctx.lineWidth=.7;
  ctx.beginPath();ctx.moveTo(-w/2,h*.35);ctx.lineTo(-w/2,-h*.35);
  if(m.product.bottle){ctx.lineTo(-w*.27,-h*.58);ctx.lineTo(w*.27,-h*.58);}
  else{ctx.lineTo(-w/2,-h*.65);ctx.lineTo(w/2,-h*.65);}
  ctx.lineTo(w/2,-h*.35);ctx.lineTo(w/2,h*.35);ctx.closePath();ctx.fill();ctx.stroke();
  ctx.fillStyle=m.product.color;ctx.fillRect(-w*.44,-h*(m.product.bottle?.37:.57),w*.88,h*(m.product.bottle?.59:.85));
  ctx.fillStyle='#e8f2e9';ctx.fillRect(-w*.4,-h*.23,w*.8,h*.075);
  ctx.fillStyle='#f3f3e6';ctx.fillRect(-w*(m.product.bottle?.29:.42),-h*.68,w*(m.product.bottle?.58:.84),h*.1);
  ctx.restore();
  // Repaint only the fingers in front of the object, keeping the same grasp.
  ctx.save();ctx.beginPath();g.fingers.forEach(([x,y],i)=>i?ctx.lineTo(g.x+x,g.y+y):ctx.moveTo(g.x+x,g.y+y));ctx.closePath();ctx.clip();
  ctx.drawImage(sheet,frame.x,frame.y,frame.w,frame.h,0,0,frame.w,frame.h);ctx.restore();
  if(g.occludeRight!==undefined){
    const x=g.x+g.occludeRight;
    ctx.drawImage(sheet,frame.x+x,frame.y,frame.w-x,frame.h,x,0,frame.w-x,frame.h);
  }
}
function bake(sheet,frames,id,makeCanvas){
  if(!PRODUCTS[id])throw new Error('未対応の保持品です。');
  return frames.map(frame=>{
    if(!frame.grip)return {sheet,frame}; // Share hidden-hand views across products.
    const canvas=makeCanvas();canvas.width=frame.w;canvas.height=frame.h;
    const ctx=canvas.getContext('2d');ctx.drawImage(sheet,frame.x,frame.y,frame.w,frame.h,0,0,frame.w,frame.h);
    paint(ctx,sheet,frame,id);
    return {sheet:canvas,frame:{...frame,x:0,y:0}};
  });
}
root.KioskSceneProps={placement,paint,bake};
})(typeof globalThis!=='undefined'?globalThis:this);
