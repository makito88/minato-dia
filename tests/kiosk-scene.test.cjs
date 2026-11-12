// 店内画の試作：状況が変わった途中で手を止める。在庫を二重に取らず、元データを書き換えない。
const assert = require('node:assert/strict');
require('../js/kiosk-scene-core.js');
const config = require('../data/kiosk-scene.json');
const Scene = globalThis.KioskScene;
function until(scene, predicate, limit = 120) {
  for (let i = 0; i < limit * 60; i++) {
    if (predicate(scene)) return;
    scene.step(1/60);
  }
  assert.fail('到達しなかった状態: '+scene.phase+' / '+scene.reason);
}
const snapshot = {v:1,day:4,t:450,stock:{cf_black:2,dr_sports:1}};
const before = JSON.stringify({config,snapshot});
const scene = new Scene(config,snapshot);
until(scene,s=>s.phase==='reach'&&s.reach>.5);
scene.setStock(0,0);
scene.step(1/60);
assert.equal(scene.phase,'retract','手を伸ばす途中の品切れで中断');
assert.equal(scene.held,null,'品切れの商品を持たない');
const extended = scene.reach;
scene.step(.2);
assert.ok(scene.reach < extended,'腕を戻す');
until(scene,s=>s.held!==null);
assert.equal(scene.held,1,'代わりのスポーツドリンクを取る');
assert.deepEqual(scene.stock,[0,0],'代わりを1本だけ減らす');
until(scene,s=>s.phase==='done');
assert.deepEqual([scene.x,scene.y],config.checkout.at(-1),'レジ前で待つ');
scene.step(1);
assert.deepEqual(scene.stock,[0,0],'取り終えた品を再び引かない');
assert.equal(JSON.stringify({config,snapshot}),before,'設定と元の棚在庫を変更しない');
scene.reset();
assert.deepEqual(scene.stock,[2,1],'初めの在庫に戻る');
assert.equal(scene.held,null);
until(scene,s=>s.held===0);
scene.setStock(0,0);
scene.step(.2);
assert.equal(scene.held,0,'取り終えた飲み物は後の品切れで消えない');
const empty = new Scene(config,{stock:{cf_black:0,dr_sports:0}});
until(empty,s=>s.phase==='done');
assert.equal(empty.held,null);
assert.deepEqual(empty.stock,[0,0]);
assert.deepEqual([empty.x,empty.y],config.exit.at(-1),'両方品切れなら入口へ逆走せず出口へ');
for(const fps of [15,30,60]){
  const run = new Scene(config,snapshot);
  for(let i=0;i<90*fps;i++)run.step(1/fps);
  assert.equal(run.phase,'done');
  assert.equal(run.held,0);
  assert.deepEqual(run.stock,[1,1],'FPSが違っても同じ結果');
}
const invalid = new Scene(config,{stock:{cf_black:-2,dr_sports:NaN}});
assert.deepEqual(invalid.stock,[3,3]);
invalid.setStock(0,Infinity);invalid.setStock(-1,3);
assert.deepEqual(invalid.stock,[3,3]);
console.log('kiosk-scene ok: 途中の品切れ・選び直し・在庫の保存・両方欠品・FPS');
