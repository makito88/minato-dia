const assert=require('node:assert/strict');
require('../js/kiosk-scene-props.js');
const P=globalThis.KioskSceneProps,F=require('../assets/images/kiosk-scene/female-frames.json').holding;
const frames=[...F.walk,...F.payment],raw=JSON.stringify(frames);
assert.equal(frames.length,20);
let hidden=0,visible=0;
for(const f of frames){
 assert.ok(f.x>=0&&f.y>=0&&f.x+f.w<=1122&&f.y+f.h<=1402);
 assert.ok(f.anchor>=0&&f.anchor<f.w&&f.groundAnchor>=0&&f.groundAnchor<f.w);
 const can=P.placement(f,'cf_black'),bottle=P.placement(f,'dr_sports');
 if(!f.grip){hidden++;assert.equal(can,null);assert.equal(bottle,null);continue;}
 visible++;
 assert.deepEqual([can.x,can.y,can.angle],[bottle.x,bottle.y,bottle.angle],'different products keep the same grasp');
 assert.ok(bottle.height>can.height,'bottle silhouette differs from the can');
 for(const m of [can,bottle]){
  assert.ok(m.x-m.width/2>=0&&m.x+m.width/2<f.w,'no product clipped at side of pose');
  assert.ok(m.y-m.height*.68>=0&&m.y+m.height*.35<f.h);
 }
 for(const [x,y] of f.grip.fingers)assert.ok(f.grip.x+x>=0&&f.grip.x+x<f.w&&f.grip.y+y>=0&&f.grip.y+y<f.h);
 assert.equal(P.placement(f,'unsupported'),null);
}
assert.equal(hidden,8);assert.equal(visible,12);
const source={};const reused=P.bake(source,F.payment,'dr_sports',()=>{throw Error('hidden product must not allocate a canvas');});
assert.ok(reused.every(p=>p.sheet===source),'back views share the original atlas');
assert.equal(JSON.stringify(frames),raw,'composition cannot alter pose/foot anchors');
assert.throws(()=>P.bake(source,frames,'unsupported',()=>{}));
console.log('kiosk-scene-props ok: shared grip, product shape, finger bounds, unclipped poses, hidden views reuse source');
