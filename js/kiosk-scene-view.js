(function(){
'use strict';
const $ = id => document.getElementById(id);
const canvas = $('scene'), ctx = canvas.getContext('2d');
let scene, config, frames, background, walk, reach, carry;
let paused = false, close = true, slow = false, previous = 0, accumulator = 0;
let camera = {x: 210, y: 700, width: 620};
const image = url => new Promise((resolve, reject) => {
  const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error('画像を読み込めませんでした。')); img.src = url;
});
async function json(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error('設定を読み込めませんでした。');
  return response.json();
}
function snapshot() {
  try {
    const raw = location.hash.slice(1);
    if (raw.length > 4000) return null;
    const value = JSON.parse(decodeURIComponent(raw));
    if (value.v !== 1 || !Number.isFinite(value.day) || !Number.isFinite(value.t) || !value.stock) return null;
    return value;
  } catch (_) { return null; }
}
function sprite(sheet, frame, height, alpha = 1) {
  const scale = height / frame.h;
  ctx.globalAlpha = alpha;
  ctx.drawImage(sheet, frame.x, frame.y, frame.w, frame.h,
    scene.x - frame.anchor * scale, scene.y - height, frame.w * scale, height);
  ctx.globalAlpha = 1;
}
function bottle(x, y, color, size = 1) {
  ctx.fillStyle = '#e5ebea'; ctx.fillRect(x - 3*size, y - 7*size, 6*size, 3*size);
  ctx.fillStyle = color; ctx.fillRect(x - 4*size, y - 4*size, 8*size, 13*size);
  ctx.fillStyle = '#f9faf2'; ctx.fillRect(x - 4*size, y, 8*size, 4*size);
}
function draw(dt = 0) {
  const height = 130 + Math.max(0, scene.y - 251) * .13;
  const ratio = canvas.width / canvas.height;
  const targetWidth = close ? (ratio < 1.3 ? 420 : 620) : config.width;
  const viewHeight = targetWidth / ratio;
  const targetX = close ? Math.max(targetWidth/2, Math.min(config.width-targetWidth/2, scene.x+65)) : config.width/2;
  const targetY = close ? Math.max(viewHeight/2, Math.min(config.height-viewHeight/2, scene.y-height*.5)) : config.height/2;
  const blend = dt ? 1-Math.exp(-5*dt) : 1;
  camera.x += (targetX-camera.x)*blend;
  camera.y += (targetY-camera.y)*blend;
  camera.width += (targetWidth-camera.width)*blend;
  const scale = close ? canvas.width / camera.width : Math.min(canvas.width/config.width,canvas.height/config.height);
  ctx.setTransform(1,0,0,1,0,0);
  ctx.fillStyle='#e5d6bd';ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.translate(canvas.width/2,canvas.height/2);ctx.scale(scale,scale);ctx.translate(-camera.x,-camera.y);
  ctx.drawImage(background,0,0,config.width,config.height);
  config.products.forEach((product,index) => {
    const count = Math.min(3,scene.stock[index]);
    ctx.fillStyle='#273738';ctx.fillRect(product.x+19,product.y-101,35,28);
    for(let k=0;k<count;k++)bottle(product.x+25+k*10,product.y-91,product.color,.8);
    if(!count){ctx.fillStyle='#f9eee0';ctx.font='bold 10px sans-serif';ctx.fillText('品切れ',product.x+20,product.y-84);}
  });
  // Ground contact and the same down-right light direction as the painted room.
  ctx.fillStyle='#3c32222b';ctx.beginPath();ctx.ellipse(scene.x+height*.23,scene.y+height*.16,height*.36,9, .56,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#3d34252a';ctx.beginPath();ctx.ellipse(scene.x,scene.y+1,16,5,0,0,Math.PI*2);ctx.fill();
  if(scene.held !== null){
    // The carrying arm and the drink are painted together, so they cannot drift apart.
    const product=config.products[scene.held];
    const frame=scene.phase==='walk' ? Math.floor(scene.distance/17)%4 : 1;
    sprite(carry[scene.held],frames.carry[product.id][scene.direction*4+frame],height);
  }else if(['reach','retract','take','browse'].includes(scene.phase)){
    const position = scene.phase === 'take' ? 2+Math.min(1,scene.phaseTime/1.2) : scene.reach*2;
    const a=Math.floor(position), b=Math.min(3,a+1), fraction=position-a;
    sprite(reach,frames.reach[a],height);
    if(fraction>0)sprite(reach,frames.reach[b],height,fraction);
  }else{
    const frame=scene.phase==='walk' ? Math.floor(scene.distance/17)%4 : 1;
    sprite(walk,frames.walk[scene.direction*4+frame],height);
  }
  // Foreground parts of the existing painting hide a customer passing behind them.
  for(const shelf of config.occluders){
    if(scene.y < shelf.front && scene.x+height*.5>shelf.x && scene.x-height*.5<shelf.x+shelf.w){
      const sx=background.width/config.width, sy=background.height/config.height;
      ctx.drawImage(background,shelf.x*sx,shelf.y*sy,shelf.w*sx,shelf.h*sy,shelf.x,shelf.y,shelf.w,shelf.h);
    }
  }
  ctx.setTransform(1,0,0,1,0,0);
}
function panel(){
  if($('status').textContent!==scene.reason)$('status').textContent=scene.reason;
  config.products.forEach((product,index)=>{
    const count=scene.stock[index];
    const label='この試作の棚に '+count+' 本';
    if($('count'+index).textContent!==label)$('count'+index).textContent=label;
    const button=$('stock'+index);
    const action=count?'品切れにする':'3本補充する';
    if(button.textContent!==action){button.textContent=action;button.setAttribute('aria-pressed',String(count===0));}
  });
}
function resize(){
  const ratio=canvas.clientWidth/canvas.clientHeight;
  canvas.width=1100;canvas.height=Math.round(1100/ratio);
  if(scene)draw();
}
function frame(now){
  const elapsed = previous ? Math.min(.1,(now-previous)/1000) : 0;
  previous=now;
  if(!document.hidden && !paused && scene.phase!=='done'){
    accumulator+=elapsed;
    if(accumulator>=1/30){
      scene.step(accumulator*(slow?.35:1));draw(accumulator);panel();accumulator=0;
    }
  }
  requestAnimationFrame(frame);
}
async function init(){
  try{
    config=await json('data/kiosk-scene.json');
    [frames,background,walk,reach]=await Promise.all([json(config.sprites+'frames.json'),image(config.background),image(config.sprites+'walk.webp'),image(config.sprites+'reach.webp')]);
    carry=await Promise.all(config.products.map(product=>image(config.sprites+product.carry)));
    const source=snapshot();
    scene=new KioskScene(config,source);
    config.products.forEach((product,index)=>{
      const card=document.createElement('section');card.className='product';
      const name=document.createElement('strong');name.textContent=product.name;
      const count=document.createElement('span');count.id='count'+index;
      const button=document.createElement('button');button.id='stock'+index;
      button.onclick=()=>{scene.setStock(index,scene.stock[index]?0:3);panel();draw();};
      card.append(name,count,button);$('products').append(card);
    });
    $('source').textContent=source ? '運行日'+source.day+'・'+Math.floor(source.t/60)+':'+String(Math.floor(source.t%60)).padStart(2,'0')+'時点の港駅の棚在庫を写した試作です。操作はこの画面内だけに反映します。' : '例の在庫を使っています。港駅の売店の「店内画で買い物を試す」から開くと、その時点の棚在庫を使えます。';
    $('play').onclick=()=>{paused=!paused;$('play').textContent=paused?'再生':'一時停止';};
    $('zoom').onclick=()=>{close=!close;$('zoom').textContent=close?'店ぜんぶを見る':'客を大きく見る';$('zoom').setAttribute('aria-pressed',String(close));draw();};
    $('slow').onclick=()=>{slow=!slow;$('slow').textContent=slow?'通常の速さ':'ゆっくり見る';$('slow').setAttribute('aria-pressed',String(slow));};
    $('reset').onclick=()=>{scene.reset();panel();draw();};
    for(const button of document.querySelectorAll('.toolbar button'))button.disabled=false;
    $('loading').hidden=true;document.querySelector('.stage').setAttribute('aria-busy','false');
    resize();panel();requestAnimationFrame(frame);
    document.addEventListener('visibilitychange',()=>{previous=0;accumulator=0;});
    window.addEventListener('resize',resize);
  }catch(error){$('loading').textContent='読み込みに失敗しました。ページを再読み込みしてください。';console.error(error);}
}
init();
})();
