(function(){
'use strict';
const $ = id => document.getElementById(id);
const canvas = $('scene'), ctx = canvas.getContext('2d');
let scene, config, frames, background, walk, reach, carry, payment, source, currentRecord;
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
    if (!raw) return null;
    if (raw.length > 64000) return {invalid:true};
    const value = JSON.parse(decodeURIComponent(raw));
    if (KioskSceneRecord.valid(value)) return value;
    if (value.v !== 1 || !Number.isFinite(value.day) || !Number.isFinite(value.t) || !value.stock) return {invalid:true};
    return value;
  } catch (_) { return {invalid:true}; }
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
  const [tx,ty]=config.register.terminal;
  ctx.fillStyle='#353b3b';ctx.strokeStyle='#929891';ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(tx-11,ty-5);ctx.lineTo(tx+10,ty-5);ctx.lineTo(tx+14,ty+6);ctx.lineTo(tx-10,ty+6);ctx.closePath();ctx.fill();ctx.stroke();
  ctx.fillStyle=scene.paymentCount?'#85bba1':'#748e85';ctx.fillRect(tx-7,ty-3,13,4);
  config.products.forEach((product,index) => {
    if(scene.mode==='record')return;
    const count = Math.min(3,scene.stock[index]);
    ctx.fillStyle='#273738';ctx.fillRect(product.x+19,product.y-101,35,28);
    for(let k=0;k<count;k++)bottle(product.x+25+k*10,product.y-91,product.color,.8);
    if(!count){ctx.fillStyle='#f9eee0';ctx.font='bold 10px sans-serif';ctx.fillText('品切れ',product.x+20,product.y-84);}
  });
  // The mark is on the floor; it does not pretend a painted customer is moving.
  const waitAt=config.checkout.at(-1);
  ctx.strokeStyle='#c1c7af';ctx.lineWidth=3;ctx.setLineDash([5,5]);
  ctx.beginPath();ctx.moveTo(waitAt[0]-16,waitAt[1]+3);ctx.lineTo(waitAt[0]+16,waitAt[1]+3);ctx.stroke();ctx.setLineDash([]);
  // Ground contact and the same down-right light direction as the painted room.
  ctx.fillStyle='#3c32222b';ctx.beginPath();ctx.ellipse(scene.x+height*.23,scene.y+height*.16,height*.36,9, .56,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#3d34252a';ctx.beginPath();ctx.ellipse(scene.x,scene.y+1,16,5,0,0,Math.PI*2);ctx.fill();
  if(scene.phase==='pay' && scene.held !== null){
    const progress=scene.phaseTime/(scene.paySeconds||config.register.paySeconds);
    const pose=progress<.18?0:progress<.4?1:progress<.72?2:3;
    sprite(payment,frames.payment[config.products[scene.held].id][pose],height);
  }else if(scene.held !== null){
    // The carrying arm and the drink are painted together, so they cannot drift apart.
    const product=config.products[scene.held];
    const frame=scene.phase==='walk' ? Math.floor(scene.distance/17)%4 : 0;
    if(scene.phase!=='walk' && scene.direction===0) sprite(payment,frames.payment[product.id][0],height);
    else sprite(carry[scene.held],frames.carry[product.id][scene.direction*4+frame],height);
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
    const label=scene.mode==='record'?'棚在庫の同期は準備中':'この試作の棚に '+count+' 本';
    if($('count'+index).textContent!==label)$('count'+index).textContent=label;
    const held=scene.unpaid[index]?'手元に1本・未会計':scene.purchased[index]?'手元に1本・会計済み':'手元になし';
    if($('held'+index).textContent!==held)$('held'+index).textContent=held;
    const button=$('stock'+index);
    button.hidden=scene.mode==='record';
    const action=count?'品切れにする':'3本補充する';
    if(button.textContent!==action){button.textContent=action;button.setAttribute('aria-pressed',String(count===0));}
  });
  const busy=$('register');
  busy.disabled=!!scene.paymentCount||['pay','pack','done'].includes(scene.phase)||scene.next==='pay';
  busy.textContent=scene.registerBusy?'店員の対応を終える':'店員をほかの対応中にする';
  busy.setAttribute('aria-pressed',String(scene.registerBusy));
  if(scene.mode==='record'){
    $('record-clock').textContent=clock(scene.clock)+' ／ '+(slow?'約1倍速':'3倍速');
    $('timeline').value=String(Math.round((scene.clock-scene.ta)/(scene.end-scene.ta)*1000));
    const n=Math.ceil(KioskSceneRecord.ahead(currentRecord,scene.clock));
    $('status').textContent=scene.reason+(scene.clock>=scene.tq&&scene.clock<scene.ts?' 前で順番を待つ人：'+n+'人（姿は準備中）。':'');
    $('skip').disabled=scene.clock>=scene.tq;
    return;
  }
  $('skip').disabled=scene.paymentCount>0||['queue','pay','pack','done'].includes(scene.phase)||scene.next==='pay';
}
function clock(t){
  const sec=Math.floor(t*60+1e-7);return Math.floor(sec/3600)+':'+String(Math.floor(sec/60)%60).padStart(2,'0')+':'+String(sec%60).padStart(2,'0');
}
function useMode(record){
  currentRecord=record;const empty=!!record&&!record.event;
  scene=empty?null:record?new KioskSceneRecord.Replay(config,record):new KioskScene(config,source&&source.v===1?source:null);
  paused=false;previous=0;accumulator=0;$('play').textContent='一時停止';
  $('sample').setAttribute('aria-pressed',String(!record));$('example').setAttribute('aria-pressed',String(!!(record&&record.example)));
  $('record-source').setAttribute('aria-pressed',String(!!record&&!record.example));
  document.querySelector('.stage').hidden=empty;$('products').hidden=empty;
  $('record-empty').hidden=!empty;$('record-controls').hidden=!record||empty;
  document.querySelector('.register-control').hidden=!!record;
  for(const id of ['play','zoom','slow','skip','reset'])$(id).disabled=empty;
  $('status').hidden=empty;
  if(empty){$('record-empty').textContent='この時刻までに終わった買い物の中に、今の絵で再生できる記録はありません。飲料1本・男性会社員・有人レジ・キャッシュレス決済から順に対応しています。「計算した買い物を見る」で例を確認できます。';$('source').textContent='運行日'+record.day+'・'+clock(record.t)+'までの結果。別の品やレジに置き換えてはいません。';return;}
  if(record){
    const e=record.event;
    $('source').textContent=(record.example?record.note:'この店の運行日'+record.day+'・'+clock(record.t)+'までに終わった買い物を再生しています。')+' 元の在庫・売上・保存には書き戻しません。';
    $('record-info').textContent='内：有人レジ ／ '+config.products[scene.target].name+' 1本 ／ 列に到着 '+clock(scene.tq)+' → 会計 '+clock(scene.ts)+'〜'+clock(scene.te)+'（待ち '+Math.round(e.wait*60)+'秒）。仮：歩く道・手に取る瞬間・カードの姿勢・退出の動き。';
  }else $('source').textContent=source&&source.v===1?'運行日'+source.day+'・'+clock(source.t)+'時点の棚在庫を写した試作です。操作はこの画面内だけに反映します。':'例の在庫と待ち時間を使っています。「計算した買い物を見る」では売店の計算結果を再生します。';
  panel();resize();
}
function resize(){
  if(!canvas.clientWidth||!canvas.clientHeight)return;
  const ratio=canvas.clientWidth/canvas.clientHeight;
  canvas.width=1100;canvas.height=Math.round(1100/ratio);
  if(scene)draw();
}
function frame(now){
  const elapsed = previous ? Math.min(.1,(now-previous)/1000) : 0;
  previous=now;
  if(!document.hidden && !paused && scene && scene.phase!=='done'){
    accumulator+=elapsed;
    if(accumulator>=1/30){
      scene.step(accumulator*(slow?.35:1)*(scene.mode==='record'?config.record.rate:1));draw(accumulator);panel();accumulator=0;
    }
  }
  requestAnimationFrame(frame);
}
async function init(){
  try{
    config=await json('data/kiosk-scene.json');
    [frames,background,walk,reach]=await Promise.all([json(config.sprites+'frames.json'),image(config.background),image(config.sprites+'walk.webp'),image(config.sprites+'reach.webp')]);
    carry=await Promise.all(config.products.map(product=>image(config.sprites+product.carry)));
    payment=await image(config.sprites+config.register.payment);
    source=snapshot();
    config.products.forEach((product,index)=>{
      const card=document.createElement('section');card.className='product';
      const name=document.createElement('strong');name.textContent=product.name;
      const count=document.createElement('span');count.id='count'+index;
      const held=document.createElement('span');held.id='held'+index;
      const button=document.createElement('button');button.id='stock'+index;
      button.onclick=()=>{scene.setStock(index,scene.stock[index]?0:3);panel();draw();};
      card.append(name,count,held,button);$('products').append(card);
    });
    $('play').onclick=()=>{paused=!paused;$('play').textContent=paused?'再生':'一時停止';};
    $('zoom').onclick=()=>{close=!close;$('zoom').textContent=close?'店ぜんぶを見る':'客を大きく見る';$('zoom').setAttribute('aria-pressed',String(close));draw();};
    $('slow').onclick=()=>{slow=!slow;$('slow').textContent=slow?'通常の速さ':'ゆっくり見る';$('slow').setAttribute('aria-pressed',String(slow));};
    $('reset').onclick=()=>{scene.reset();panel();draw();};
    $('register').onclick=()=>{scene.setRegisterBusy(!scene.registerBusy);panel();};
    $('skip').onclick=()=>{
      if(scene.mode==='record'){scene.seek(scene.tq);panel();draw();return;}
      for(let i=0;i<180*30 && !['queue','pay','pack','done'].includes(scene.phase);i++)scene.step(1/30);
      panel();draw();
    };
    for(const button of document.querySelectorAll('.toolbar button'))button.disabled=false;
    $('loading').hidden=true;document.querySelector('.stage').setAttribute('aria-busy','false');
    $('sample').onclick=()=>useMode(null);
    $('example').onclick=async()=>{try{useMode(await json('data/kiosk-scene-recording.json'));}catch(error){$('source').textContent='例の記録を読み込めませんでした。';console.error(error);}};
    $('record-source').hidden=!(source&&source.v===2);
    $('record-source').onclick=()=>useMode(source);
    $('timeline').oninput=()=>{scene.seek(scene.ta+Number($('timeline').value)/1000*(scene.end-scene.ta));panel();draw();};
    $('pay-start').onclick=()=>{scene.seek(scene.ts);panel();draw();};
    $('pay-end').onclick=()=>{scene.seek(scene.te);panel();draw();};
    useMode(source&&source.v===2?source:null);
    if(source&&source.invalid)$('source').textContent='受け取った記録を読み込めなかったため、反応を試す例を表示しています。';
    resize();requestAnimationFrame(frame);
    document.addEventListener('visibilitychange',()=>{previous=0;accumulator=0;});
    window.addEventListener('resize',resize);
  }catch(error){$('loading').textContent='読み込みに失敗しました。ページを再読み込みしてください。';console.error(error);}
}
init();
})();
