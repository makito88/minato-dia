const assert=require('node:assert/strict'),fs=require('node:fs'),cp=require('node:child_process'),os=require('node:os'),path=require('node:path');
require('../js/kiosk-scene-record.js');
const KR=globalThis.KioskSceneRecord,cfg=require('../data/kiosk-scene.json');
const e={k:'buy',ps:'salM',lane:'f',em:true,t:600,end:600.5,wait:2,stay:3,items:[['cf_black',1]],yen:160};
const before={...e,ps:'sen',t:599,end:600,wait:2,stay:8,items:[['other',3]]};
const result={day:3,ev:[before,e,{...e,t:610,end:611}]};
const original=JSON.stringify(result),packet=KR.build(result,601);
assert.equal(packet.event.t,600,'future transaction excluded');assert.ok(KR.valid(packet));
assert.equal(packet.queue.length,1,'different appearance and items still precede this customer');
assert.equal(KR.ahead(packet,598),1);assert.equal(KR.ahead(packet,599.02).toFixed(2),'0.50');assert.equal(KR.ahead(packet,599.05),0);
const s=new KR.Replay(cfg,packet);
assert.equal(s.ta,595);assert.equal(s.tq,598);assert.equal(s.ts,600);assert.equal(s.te,600.5);
s.seek(s.pickAt-.001);assert.equal(s.held,null);s.seek(s.pickAt);assert.equal(s.held,0);assert.deepEqual(s.unpaid,[1,0]);
s.seek(s.tq);const tail=s.y;s.seek(599.02);assert.ok(s.y<tail);assert.equal(s.phase,'walk','feet move while closing the gap');s.seek(599.1);assert.equal(s.phase,'queue');
s.seek(s.ts);assert.equal(s.phase,'pay');assert.deepEqual([s.x,s.y],cfg.register.approach.at(-1));
s.seek(s.te-.00001);assert.deepEqual(s.unpaid,[1,0]);assert.equal(s.paymentCount,0);
s.seek(s.te);assert.deepEqual(s.purchased,[1,0]);assert.deepEqual(s.unpaid,[0,0]);assert.equal(s.paymentCount,1);
for(let i=0;i<30;i++){s.seek(s.te-1);s.seek(s.end);assert.equal(s.paymentCount,1);assert.deepEqual(s.purchased,[1,0]);}
assert.deepEqual(s.stock,[null,null],'no invented shelf count or repeated subtraction');
assert.equal(s.setStock(0,50),false);assert.equal(s.setRegisterBusy(true),false);
assert.equal(s.phase,'done');s.reset();assert.equal(s.paymentCount,0);assert.equal(s.held,null);
for(const fps of [15,30,60]){s.reset();for(let i=0;i<fps*(Math.ceil((s.end-s.ta)*60)+1);i++)s.step(1/fps);assert.equal(s.phase,'done');assert.equal(s.paymentCount,1);}
packet.event.items[0][1]=9;assert.equal(s.record.event.items[0][1],1,'input detached');assert.equal(JSON.stringify(result),original,'simulation never mutated');
for(const patch of [{lane:'s'},{em:false},{ps:'sen'},{items:[['cf_black',2]]},{items:[['cf_black',1],['dr_sports',1]]},{carry:['umb']},{trash:true},{guide:'x'},{end:NaN}]){
  const p=KR.build({day:3,ev:[{...e,...patch}]},601);assert.equal(p.event,null,'unsupported purchase not replaced '+JSON.stringify(patch));
}
assert.equal(KR.build({day:3,ev:[e,{k:'eatin',ps:'salM',from:600.5,t:601}]},602).event,null,'do not make a seated customer leave');
assert.equal(KR.build({day:3,ev:[e]},600.49).event,null,'not completed yet');
assert.equal(KR.valid({...KR.build(result,601),t:599}),false);
assert.equal(KR.valid({...KR.build(result,601),queue:[{arrive:602,start:599,end:600}]}),false);
const noWait=KR.build({day:3,ev:[{...e,wait:0,items:[['dr_sports',1]]}]},601),blue=new KR.Replay(cfg,noWait);
blue.seek(blue.ts);assert.equal(blue.phase,'pay');assert.equal(blue.held,1);assert.equal(blue.direction,0);
blue.seek(blue.ts-1e-7);assert.ok(Math.hypot(blue.x-985,blue.y-653)<.001,'no teleport when there is no wait');
// Regenerate the bundled recording through the existing business simulation.
const tmp=path.join(os.tmpdir(),'kiosk-scene-record-'+process.pid+'.json');
try{cp.execFileSync(process.execPath,[path.join(__dirname,'../tools/kiosk-scene-example.cjs'),tmp]);assert.deepEqual(JSON.parse(fs.readFileSync(tmp)),require('../data/kiosk-scene-recording.json'));}finally{fs.rmSync(tmp,{force:true});}
console.log('kiosk-scene-record ok: actual event times, FIFO, gaps, source unchanged, seeks/FPS, unsupported/future records, generated fixture');
// Actual main-view entry point sends the adapter output, retaining the legacy snapshot fallback.
const vm=require('node:vm');
const view=fs.readFileSync(path.join(__dirname,'../js/minato-store-view.js'),'utf8');
const opener=view.slice(view.indexOf('function openPaintedScene(){'),view.indexOf('function render(o){'));
let opened;
const context={ensureRes:()=>result,gT:()=>601,gDay:()=>3,KC:{stockAt:()=>({cf_black:4,dr_sports:8})},KioskSceneRecord:KR,window:{KioskSceneRecord:KR,open:(...args)=>{opened=args;}}};
vm.runInNewContext(opener+'\nopenPaintedScene();',context);
assert.deepEqual(JSON.parse(decodeURIComponent(opened[0].split('#')[1])),KR.build(result,601));assert.deepEqual(opened.slice(1),['_blank','noopener']);
context.window.KioskSceneRecord=null;vm.runInNewContext('openPaintedScene();',context);
assert.deepEqual(JSON.parse(decodeURIComponent(opened[0].split('#')[1])),{v:1,day:3,t:601,stock:{cf_black:4,dr_sports:8}});
console.log('  main-view entry: recorded transaction and legacy stock handoff passed');
