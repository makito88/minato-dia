// Reproducible example: ordinary KioskCore output, not a scripted purchase.
// node tools/kiosk-scene-example.cjs [output.json]
const fs=require('node:fs'),path=require('node:path');
for(const f of ['research-core','kiosk-staff','kiosk-walk','kiosk-core','minato-store-core','kiosk-scene-record'])require('../js/'+f+'.js');
const K=require('../data/kiosk.json'),M=require('../data/minato-store.json'),R=require('../data/research.json');
const {KioskCore:KC,MinatoStore:MS,KioskSceneRecord:KR}=globalThis;
const basket=process.argv.includes('--basket'),queue=process.argv.includes('--queue');
const cfg=MS.cfg(K,M),state=MS.create(K,M,KC,{seed:queue?36:basket?2:11,day:1});
const a=Array.from({length:KC.H},(_,h)=>h>=5&&h<24?(queue?3000:400):0),fl=[a,a.map(x=>x*.3),a.map(x=>x*.2),a.map(x=>x*.3)];
const res=KC.simulate(cfg,state,{day:3,dow:3,cond:{day:'wd',wx:'sun',season:'aut'},flows:{hb:fl,ha:fl},stops:Array(KC.H).fill(4),plats:2,rcfg:R,order:state.order,express:[],addOn:[],edits:[],startT:0});
const record=KR.build(res,queue?958:basket?592:1044);
if(!record.event)throw new Error('例の条件の購入結果が変わりました。対応範囲を確認してください。');
record.example=true;
record.note='例の営業条件から計算した運行日3・平日・晴れの買い物。ユーザーの保存データではありません。'+(queue?'種36、人流3000、15:58までの結果。':basket?'種2、9:52までの結果。':'種11、17:24までの結果。');
if(basket)record.basketExample=true;
if(queue){record.queueExample=true;if(!record.companions.length)throw new Error('先行客の記録が変わりました。');}
const output=process.argv[2]||path.join(__dirname,'../data/kiosk-scene-recording.json');
fs.writeFileSync(output,JSON.stringify(record,null,2)+'\n');console.log(output);
