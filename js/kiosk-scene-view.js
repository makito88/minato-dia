(function(){
'use strict';
const $ = id => document.getElementById(id);
const canvas = $('scene'), ctx = canvas.getContext('2d');
let scene, config, frames, background, walk, reach, carry, payment, basket, basketTake, bagPack, bagWalk, source, currentRecord;
let companions = [], appearances = {};
let paused = false, close = true, slow = false, previous = 0, accumulator = 0;
let camera = {x: 210, y: 700, width: 620};
const imageCache = new Map();
const image = url => {
  if(imageCache.has(url))return imageCache.get(url);
  const promise = new Promise((resolve, reject) => {
  const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error('画像を読み込めませんでした。')); img.src = url;
  });
  imageCache.set(url,promise);
  return promise;
};
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
function sprite(actor, sheet, frame, height, alpha = 1) {
  const scale = height / (frame.bodyH||frame.h);
  // Contact shadow follows the lowest shoe, not the gap between two stepping feet.
  if(alpha===1){
    const footX=actor.x+((frame.groundAnchor??frame.anchor)-frame.anchor)*scale;
    ctx.fillStyle='#3d34252a';ctx.beginPath();ctx.ellipse(footX,actor.y+1,frame.groundAnchor===undefined?16:11,4,0,0,Math.PI*2);ctx.fill();
  }
  ctx.globalAlpha = alpha;
  ctx.drawImage(sheet, frame.x, frame.y, frame.w, frame.h,
    actor.x - frame.anchor * scale, actor.y - frame.h*scale, frame.w * scale, frame.h*scale);
  ctx.globalAlpha = 1;
}
function bottle(x, y, color, size = 1) {
  ctx.fillStyle = '#e5ebea'; ctx.fillRect(x - 3*size, y - 7*size, 6*size, 3*size);
  ctx.fillStyle = color; ctx.fillRect(x - 4*size, y - 4*size, 8*size, 13*size);
  ctx.fillStyle = '#f9faf2'; ctx.fillRect(x - 4*size, y, 8*size, 4*size);
}
function drawBasket(actor,height){
  const progress=actor.phaseTime/(actor.paySeconds||config.register.paySeconds);
  const pose=progress<.18?0:progress<.4?1:progress<.72?2:3;
  const index=actor.phase==='pay'?16+pose:actor.direction*4+(actor.phase==='walk'?Math.floor(actor.distance/17)%4:0);
  const taking=actor.phase==='basketTake'&&actor.transfer;
  const takePose=taking?actor.transfer.pose:0;
  const sheet=taking?basketTake:basket;
  const f=taking?frames.basketTake[actor.transfer.id][takePose]:frames.basket[index],b=f.basket,k=height/f.h,x=actor.x-f.anchor*k,y=actor.y-height;
  sprite(actor,sheet,f,height);
  // Each basket uses its painted hand/handle. Only contents are variable, anchored in atlas space.
  ctx.save();ctx.translate(x,y);ctx.scale(k,k);
  ctx.beginPath();ctx.rect(b.cx-b.w*.36,b.rim-15,b.w*.72,b.depth+15);ctx.clip();
  actor.loadout.contents.filter(item=>item.location!=='hand').forEach((item,i)=>{
    const p=config.products.find(p=>p.id===item.id),xx=b.cx+(i%2?1:-1)*b.w*.16,yy=b.rim-b.w*.068+Math.floor(i/2)*b.w*.09;
    bottle(xx,yy,p.color,b.w/55);
  });
  // Restore the basket front, keeping the product bases behind the rim.
  ctx.drawImage(sheet,f.x+b.cx-b.w/2,f.y+b.rim+2,b.w,b.depth,b.cx-b.w/2,b.rim+2,b.w,b.depth);
  ctx.restore();
}
// A fixed packing/return station. It never changes the business inventory.
function packingStation(front=false){
  if(!scene.basket)return;
  const [x,y]=config.register.pack.at(-1),h=130+(y-251)*.13,k=h/430;
  ctx.save();ctx.translate(x,y);ctx.scale(k,k);
  const ready=scene.clock>=scene.packAt,bagHere=ready&&!scene.basketReturned;
  if(!front){
    ctx.fillStyle='#ad8b65';ctx.strokeStyle='#766953';ctx.lineWidth=2;
    ctx.fillRect(-35,-114,225,12);ctx.strokeRect(-35,-114,225,12);
    ctx.fillStyle='#957857';ctx.fillRect(-25,-102,10,100);ctx.fillRect(169,-102,10,100);
    ctx.fillStyle='#dec8a5';ctx.beginPath();ctx.moveTo(-35,-114);ctx.lineTo(-10,-138);ctx.lineTo(210,-138);ctx.lineTo(190,-114);ctx.closePath();ctx.fill();ctx.stroke();
    if(ready){
      ctx.fillStyle='#536858';ctx.fillRect(65,-157,70,43);
      ctx.fillStyle='#34483c';ctx.fillRect(68,-157,64,9);
      scene.loadout.contents.filter(i=>i.location==='basket').forEach((item,i)=>bottle(79+(i%2)*22,-154+Math.floor(i/2)*5,config.products.find(p=>p.id===item.id).color,1.6));
      ctx.fillStyle='#7e9279';ctx.fillRect(65,-147,70,33);ctx.strokeStyle='#4e6655';ctx.strokeRect(65,-157,70,43);
      for(let i=0;i<6;i++){ctx.beginPath();ctx.moveTo(71+i*11,-143);ctx.lineTo(71+i*11,-118);ctx.stroke();}
    }
    if(bagHere){ctx.fillStyle='#91724f';ctx.fillRect(-4,-174,57,8);}
  }else if(bagHere){
    // Bag front hides the bottom of the lowered drink; the fingers remain above its rim.
    ctx.fillStyle='#c7a174';ctx.strokeStyle='#8c704e';ctx.lineWidth=1.5;
    ctx.beginPath();ctx.moveTo(-4,-166);ctx.lineTo(53,-166);ctx.lineTo(50,-114);ctx.lineTo(-1,-114);ctx.closePath();ctx.fill();ctx.stroke();
    ctx.strokeStyle='#ab875d';ctx.beginPath();ctx.moveTo(7,-164);ctx.lineTo(10,-116);ctx.moveTo(43,-163);ctx.lineTo(39,-116);ctx.stroke();
  }
  ctx.restore();
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
  packingStation();
  // Merge people and foreground shelves by floor depth; avoid repainting over nearer people.
  const actors=KioskSceneRecord.actorsAt(scene,companions);
  const layers=[...actors.map(actor=>({depth:actor.y,actor})),...config.occluders.map(shelf=>({depth:shelf.front,shelf}))];
  layers.sort((a,b)=>a.depth-b.depth||(a.shelf?-1:b.shelf?1:0));
  for(const layer of layers){
    if(layer.actor){drawActor(layer.actor);if(layer.actor===scene)packingStation(true);}
    else{
      const shelf=layer.shelf,sx=background.width/config.width,sy=background.height/config.height;
      ctx.drawImage(background,shelf.x*sx,shelf.y*sy,shelf.w*sx,shelf.h*sy,shelf.x,shelf.y,shelf.w,shelf.h);
    }
  }
  ctx.setTransform(1,0,0,1,0,0);
}
function drawActor(actor){
  // Appearance owns atlas/anchors; the event clock, quantities and payment stay shared.
  const look=appearances[actor.record&&actor.record.event.ps];
  const actorFrames=look?look.frames:frames;
  const actorWalk=look?look.walk:walk,actorReach=look?look.reach:reach,actorPayment=look?look.payment:payment;
  const height=(130+Math.max(0,actor.y-251)*.13)*(look?look.heightScale:1);
  // Ground contact and the same down-right light direction as the painted room.
  ctx.fillStyle='#3c32222b';ctx.beginPath();ctx.ellipse(actor.x+height*.23,actor.y+height*.16,height*.36,9, .56,0,Math.PI*2);ctx.fill();
  if(actor.loadout&&actor.loadout.mode==='bag'){
    const f=actor.direction*4+(actor.phase==='walk'?Math.floor(actor.distance/17)%4:0);
    sprite(actor,bagWalk,frames.bagWalk[f],height);
  }else if(actor.phase==='bagPack'){
    const p=actor.packing||{id:actor.units[0],pose:0};
    sprite(actor,bagPack,frames.bagPack[p.id][p.pose],height);
  }else if(actor.loadout&&actor.loadout.mode==='basket'){
    drawBasket(actor,height);
  }else if(look&&look.mounted&&actor.held!==null){
    const product=config.products[actor.held].id;
    const paying=actor.phase==='pay',backStill=actor.phase!=='walk'&&actor.direction===0;
    const progress=actor.phaseTime/(actor.paySeconds||config.register.paySeconds);
    const index=paying?(progress<.18?0:progress<.4?1:progress<.72?2:3):backStill?0:actor.direction*4+(actor.phase==='walk'?Math.floor(actor.distance/17)%4:0);
    const pose=look.mounted[product][paying||backStill?'payment':'walk'][index];
    sprite(actor,pose.sheet,pose.frame,height);
  }else if(actor.phase==='pay' && actor.held !== null){
    const progress=actor.phaseTime/(actor.paySeconds||config.register.paySeconds);
    const pose=progress<.18?0:progress<.4?1:progress<.72?2:3;
    sprite(actor,actorPayment,actorFrames.payment[config.products[actor.held].id][pose],height);
  }else if(actor.held !== null){
    // The carrying arm and the drink are painted together, so they cannot drift apart.
    const product=config.products[actor.held];
    const frame=actor.phase==='walk' ? Math.floor(actor.distance/17)%4 : 0;
    if(actor.phase!=='walk' && actor.direction===0) sprite(actor,actorPayment,actorFrames.payment[product.id][0],height);
    else sprite(actor,look?look.carry[product.id]:carry[actor.held],actorFrames.carry[product.id][actor.direction*4+frame],height);
  }else if(['reach','retract','take','browse'].includes(actor.phase)){
    const position = actor.phase === 'take' ? 2+Math.min(1,actor.phaseTime/1.2) : actor.reach*2;
    const a=Math.floor(position), b=Math.min(3,a+1), fraction=position-a;
    // The new atlas has distinct arm silhouettes; overlap would paint two hands.
    if(look)sprite(actor,actorReach,actorFrames.reach[Math.round(position)],height);
    else {
      sprite(actor,actorReach,actorFrames.reach[a],height);
      if(fraction>0)sprite(actor,actorReach,actorFrames.reach[b],height,fraction);
    }
  }else{
    const frame=actor.phase==='walk' ? Math.floor(actor.distance/17)%4 : 1;
    sprite(actor,actorWalk,actorFrames.walk[actor.direction*4+frame],height);
  }
}
function panel(){
  if($('status').textContent!==scene.reason)$('status').textContent=scene.reason;
  config.products.forEach((product,index)=>{
    const count=scene.stock[index];
    const label=scene.mode==='record'?'棚在庫の同期は準備中':'この試作の棚に '+count+' 本';
    if($('count'+index).textContent!==label)$('count'+index).textContent=label;
    const where=scene.loadout&&scene.loadout.mode==='basket'?'かごに':'手元に';
    const parts=scene.loadout&&scene.basket?['hand','basket','bag'].map(loc=>{const n=scene.loadout.contents.filter(x=>x.id===product.id&&x.location===loc).length;return n?(loc==='hand'?(scene.phase==='bagPack'?'手に':'左手に'):loc==='bag'?'袋に':'かごに')+n+'本':'';}).filter(Boolean).join('・'):'';
    const held=scene.unpaid[index]?(parts||where+scene.unpaid[index]+'本')+'・未会計':scene.purchased[index]?(parts||where+scene.purchased[index]+'本')+'・会計済み':'手元になし';
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
    $('status').textContent=scene.reason+(scene.clock>=scene.tq&&scene.clock<scene.ts?' 前で順番を待つ人：'+n+'人。描ける先行客は、待機 '+companions.filter(a=>a.tq<=scene.clock&&a.ts>scene.clock).length+'人・会計 '+companions.filter(a=>a.ts<=scene.clock&&a.te>scene.clock).length+'人。':'');
    $('skip').disabled=scene.clock>=scene.tq;
    $('pickup').hidden=!scene.basket;
    $('bag-start').hidden=!scene.basket;
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
  companions=record&&!empty?(record.companions||[]).map(p=>new KioskSceneRecord.Replay(config,p)):[];
  paused=false;previous=0;accumulator=0;$('play').textContent='一時停止';
  $('sample').setAttribute('aria-pressed',String(!record));$('example').setAttribute('aria-pressed',String(!!(record&&record.example)));
  $('record-source').setAttribute('aria-pressed',String(!!record&&!record.example));
  $('basket-example').setAttribute('aria-pressed',String(!!(record&&record.basketExample)));
  $('sports-example').setAttribute('aria-pressed',String(!!(record&&record.sportsExample)));
  $('female-example').setAttribute('aria-pressed',String(!!(record&&record.femaleExample)));
  $('queue-example').setAttribute('aria-pressed',String(!!(record&&record.queueExample)));
  if(record&&(record.basketExample||record.queueExample||record.femaleExample||record.sportsExample))$('example').setAttribute('aria-pressed','false');
  document.querySelector('.stage').hidden=empty;$('products').hidden=empty;
  $('record-empty').hidden=!empty;$('record-controls').hidden=!record||empty;
  document.querySelector('.register-control').hidden=!!record;
  for(const id of ['play','zoom','slow','skip','reset'])$(id).disabled=empty;
  $('status').hidden=empty;
  if(empty){$('record-empty').textContent='この時刻までに終わった買い物の中に、今の絵で再生できる記録はありません。男性会社員の飲料1〜4本／女性会社員の飲料1本、有人レジ・キャッシュレス決済から順に対応しています。「計算した買い物を見る」で例を確認できます。';$('source').textContent='運行日'+record.day+'・'+clock(record.t)+'までの結果。別の品やレジに置き換えてはいません。';return;}
  if(record){
    const e=record.event;
    $('source').textContent=(record.example?record.note:'この店の運行日'+record.day+'・'+clock(record.t)+'までに終わった買い物を再生しています。')+' 元の在庫・売上・保存には書き戻しません。';
    $('record-info').textContent='内：有人レジ ／ '+e.items.map(([id,n])=>config.products.find(p=>p.id===id).name+' '+n+'本').join('・')+' ／ 列に到着 '+clock(scene.tq)+' → 会計 '+clock(scene.ts)+'〜'+clock(scene.te)+'（待ち '+Math.round(e.wait*60)+'秒）。仮：歩く道・取る瞬間・持ち方・カードの姿勢・会計後の動き。';
    $('record-info').textContent+=' 同じ時刻で先行客'+companions.length+'人も再生。';
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
    basket=await image(config.sprites+config.basket);
    basketTake=await image(config.sprites+config.basketTake);
    [bagPack,bagWalk]=await Promise.all([image(config.sprites+config.bagPack),image(config.sprites+config.bagWalk)]);
    await Promise.all(Object.entries(config.appearances||{}).map(async([id,profile])=>{
      const [f,w,r,p]=await Promise.all([json(config.sprites+profile.frames),image(config.sprites+profile.walk),image(config.sprites+profile.reach),image(config.sprites+profile.payment)]);
      const items=await Promise.all(Object.entries(profile.carry).map(async([id,file])=>[id,await image(config.sprites+file)]));
      appearances[id]={frames:f,walk:w,reach:r,payment:p,carry:Object.fromEntries(items),heightScale:profile.heightScale};
      if(profile.mountProducts){
        const mounted={};
        for(const [pid,sheet] of items)mounted[pid]={walk:KioskSceneProps.bake(sheet,f.holding.walk,pid,()=>document.createElement('canvas')),payment:KioskSceneProps.bake(sheet,f.holding.payment,pid,()=>document.createElement('canvas'))};
        appearances[id].mounted=mounted;
      }
    }));
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
    $('basket-example').onclick=async()=>{try{useMode(await json('data/kiosk-scene-basket-recording.json'));}catch(error){$('source').textContent='かごの記録を読み込めませんでした。';console.error(error);}};
    $('queue-example').onclick=async()=>{try{useMode(await json('data/kiosk-scene-queue-recording.json'));scene.seek(scene.tq);panel();draw();}catch(error){$('source').textContent='列の記録を読み込めませんでした。';console.error(error);}};
    $('female-example').onclick=async()=>{try{useMode(await json('data/kiosk-scene-female-recording.json'));}catch(error){$('source').textContent='女性客の記録を読み込めませんでした。';console.error(error);}};
    $('sports-example').onclick=async()=>{try{useMode(await json('data/kiosk-scene-sports-recording.json'));}catch(error){$('source').textContent='飲料の記録を読み込めませんでした。';console.error(error);}};
    $('record-source').hidden=!(source&&source.v===2);
    $('record-source').onclick=()=>useMode(source);
    $('timeline').oninput=()=>{scene.seek(scene.ta+Number($('timeline').value)/1000*(scene.end-scene.ta));panel();draw();};
    $('pickup').onclick=()=>{scene.seek(scene.pickups[0].arrive);panel();draw();};
    $('bag-start').onclick=()=>{scene.seek(scene.bagStart);panel();draw();};
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
