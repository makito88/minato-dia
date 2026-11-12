/* Read-only projection of completed KioskCore events. No RNG, sales or save writes. */
(function(root){
'use strict';
const IDS=['cf_black','dr_sports'];
const finite=x=>Number.isFinite(x);
function supported(e){
  return !!e && e.k==='buy' && e.ps==='salM' && e.lane==='f' && e.em===true &&
    Array.isArray(e.items) && e.items.length>0 && e.items.length<=4 &&
    e.items.every(x=>Array.isArray(x)&&IDS.includes(x[0])&&Number.isInteger(x[1])&&x[1]>0) &&
    e.items.reduce((n,x)=>n+x[1],0)<=4 &&
    finite(e.t) && finite(e.end) && e.end>e.t && finite(e.wait) && e.wait>=0 &&
    finite(e.stay) && e.stay>0 && e.t-e.wait-e.stay>=0 &&
    !e.trash && !e.guide && !(e.carry&&e.carry.length);
}
// A reusable holding model: contents and payment state are independent of pose/body.
function loadout(items,picked,paid){
  const units=items.flatMap(([id,n])=>Array(n).fill(id));
  const contents=units.slice(0,Math.max(0,Math.floor(picked))).map((id,slot)=>({id,slot,location:units.length>1?'basket':'hand',state:paid?'paid':'unpaid'}));
  return {mode:units.length>1?'basket':'hand',capacity:units.length,contents};
}
function build(res,cutoff){
  if(!res||!Array.isArray(res.ev)||!finite(cutoff)||!finite(res.day))return null;
  // Only already completed purchases. Do not expose future events made by simulate.
  let selected=null,index=-1;
  const after=new Set(res.ev.filter(e=>['eatin','range','eatfull'].includes(e.k)).map(e=>e.ps+'|'+Number(e.from).toFixed(2)));
  res.ev.forEach((e,i)=>{
    if(supported(e)&&e.end<=cutoff&&!after.has(e.ps+'|'+e.end.toFixed(2))&&(!selected||e.end>selected.end)) {selected=e;index=i;}
  });
  const packet={v:2,mode:'record',day:res.day,t:cutoff,event:null,queue:[]};
  if(!selected)return packet;
  const e=selected,ta=e.t-e.wait-e.stay,tq=e.t-e.wait;
  packet.event={id:index,k:e.k,ps:e.ps,lane:e.lane,em:e.em,t:e.t,end:e.end,wait:e.wait,stay:e.stay,items:e.items.map(x=>x.slice()),yen:e.yen};
  // Same predecessor condition as MinatoAnim.qSlot; unsupported appearances still count.
  packet.queue=res.ev.filter(b=>b.k==='buy'&&b.lane===e.lane&&finite(b.wait)&&finite(b.end)&&b.end<=cutoff&&b.t-b.wait<tq&&b.end>ta)
    .map(b=>({arrive:b.t-b.wait,start:b.t,end:b.end}));
  return packet;
}
function valid(p){
  return !!p&&p.v===2&&p.mode==='record'&&finite(p.day)&&finite(p.t)&&p.t>=0&&p.t<=3000&&
    Array.isArray(p.queue)&&p.queue.length<=256&&p.queue.every(q=>finite(q.arrive)&&finite(q.start)&&finite(q.end)&&q.arrive>=0&&q.arrive<=q.start&&q.start<q.end&&q.end<=p.t)&&
    (p.event===null||(supported(p.event)&&p.event.end<=p.t&&p.queue.every(q=>q.arrive<p.event.t-p.event.wait)));
}
function ahead(record,t){
  const smooth=.04;
  return record.queue.reduce((n,q)=>q.arrive>t?n:n+(q.start>t?1:q.start>t-smooth?1-(t-q.start)/smooth:0),0);
}
function route(points){
  let length=0;const segments=[];
  for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],d=Math.hypot(b[0]-a[0],b[1]-a[1]);if(d){segments.push({a,b,d,from:length});length+=d;}}
  return {length,at(u){const distance=Math.max(0,Math.min(1,u))*length,s=segments.find(s=>s.from+s.d>=distance)||segments.at(-1);
    if(!s)return {x:points[0][0],y:points[0][1],direction:0,distance:0};
    const v=(distance-s.from)/s.d,dx=s.b[0]-s.a[0],dy=s.b[1]-s.a[1];
    return {x:s.a[0]+dx*v,y:s.a[1]+dy*v,direction:Math.abs(dx)>Math.abs(dy)?(dx>0?2:3):(dy>0?1:0),distance};}};
}
class Replay {
  constructor(config,record){
    if(!valid(record)||!record.event)throw new Error('再生できる買い物の記録がありません。');
    this.config=config;this.record=JSON.parse(JSON.stringify(record));this.mode='record';
    const e=this.record.event;this.target=config.products.findIndex(p=>p.id===e.items[0][0]);
    if(this.target<0)throw new Error('この品の絵は準備中です。');
    this.ta=e.t-e.wait-e.stay;this.tq=e.t-e.wait;this.ts=e.t;this.te=e.end;
    const p=config.products[this.target],shelf=[p.x,p.y],R=config.record;
    this.arriveShelf=this.ta+e.stay*.36;this.reachAt=this.ta+e.stay*.42;this.pickAt=this.ta+e.stay*.46;this.leaveShelf=this.ta+e.stay*.48;
    this.units=e.items.flatMap(([id,n])=>Array(n).fill(id));
    this.basket=this.units.length>1;
    this.pickups=[];
    if(this.basket){
      this.arriveShelf=this.ta+e.stay*.30;this.leaveShelf=this.ta+e.stay*.62;
      this.pickups=this.units.map((id,i)=>{
        const item=config.products.find(p=>p.id===id),prev=config.products.find(p=>p.id===(this.units[i-1]||id));
        const from=this.arriveShelf+e.stay*.32*i/this.units.length,to=this.arriveShelf+e.stay*.32*(i+1)/this.units.length;
        return {id,from,to,arrive:from+(to-from)*.5,pick:from+(to-from)*.62,deposit:from+(to-from)*.88,point:[item.x,item.y],path:route([[prev.x,prev.y],[item.x,item.y]])};
      });
      this.pickAt=this.pickups[0].pick;
    }
    this.approachAt=this.ts-Math.min(e.wait*.3,R.approachMinutes);
    this.inRoute=route([...config.entry,shelf]);
    const dest=e.wait?this.queuePoint(this.tq):config.register.approach.at(-1);
    this.shopRoute=route([this.basket?this.pickups.at(-1).point:shelf,...config.checkout.slice(0,-1),dest]);
    this.approachRoute=route([this.queuePoint(this.approachAt),...config.register.approach]);
    this.packRoute=route([config.register.approach.at(-1),...config.register.pack]);
    this.packAt=this.te+this.packRoute.length/R.walkPixelsPerMinute;
    this.exitAt=this.packAt+config.register.packSeconds/60;
    this.outRoute=route([config.register.pack.at(-1),...config.exit]);
    this.end=this.basket?this.packAt:this.exitAt+this.outRoute.length/R.walkPixelsPerMinute;
    this.paySeconds=(this.te-this.ts)*60;
    this.reset();
  }
  queuePoint(t){const p=this.config.checkout.at(-1);return [p[0],p[1]+ahead(this.record,t)*this.config.record.queueGap];}
  reset(){this.seek(this.ta);}
  setStock(){return false;}
  setRegisterBusy(){return false;}
  step(seconds){if(finite(seconds)&&seconds>0)this.seek(this.clock+seconds/60);}
  seek(t){
    if(!finite(t))return;
    this.clock=Math.max(this.ta,Math.min(this.end,t));t=this.clock;this.time=(t-this.ta)*60;
    const picked=this.basket?this.pickups.filter(p=>t>=p.pick).length:(t>=this.pickAt?1:0);
    this.loadout=loadout(this.record.event.items,picked,t>=this.te);
    this.transfer=null;
    if(this.basket){
      const stop=this.pickups.find(p=>t>=p.arrive&&t<p.to);
      if(stop){
        this.transfer={id:stop.id,progress:(t-stop.arrive)/(stop.to-stop.arrive),pose:t<stop.pick?0:t<stop.arrive+(stop.to-stop.arrive)*.52?1:t<stop.deposit?2:3};
        if(t>=stop.pick&&t<stop.deposit)this.loadout.contents.at(-1).location='hand';
      }
    }
    this.held=picked?this.target:null;
    this.stock=this.config.products.map(()=>null); // Snapshot cadence cannot establish shelf pickup counts.
    this.unpaid=this.config.products.map(p=>this.loadout.contents.filter(x=>x.id===p.id&&x.state==='unpaid').length);
    this.purchased=this.config.products.map(p=>this.loadout.contents.filter(x=>x.id===p.id&&x.state==='paid').length);
    this.paymentCount=t>=this.te?1:0;this.registerBusy=false;this.reach=0;this.phaseTime=0;this.direction=0;this.distance=0;
    const at=(r,a,b)=>Object.assign(this,r.at((t-a)/(b-a)));
    const stand=p=>{this.x=p[0];this.y=p[1];};
    const p=this.config.products[this.target],shelf=[p.x,p.y];
    if(t<this.arriveShelf){this.phase='walk';at(this.inRoute,this.ta,this.arriveShelf);this.reason='記録にある飲み物の棚へ向かいます。';}
    else if(this.basket&&t<this.leaveShelf){
      const stop=this.pickups.find(p=>t<p.to)||this.pickups.at(-1);
      if(t<stop.arrive&&stop.path.length){this.phase='walk';at(stop.path,stop.from,stop.arrive);}
      else {this.phase='basketTake';stand(stop.point);}
      this.reason=configName(this.config,stop.id)+(t<stop.pick?'へ左手を伸ばします。':t<stop.deposit?'を左手でつかみ、かごへ移します。':'をかごに入れ、手を戻します。');
    }
    else if(t<this.leaveShelf){stand(shelf);this.phase=t<this.reachAt?'browse':t<this.pickAt?'reach':'take';this.reach=Math.max(0,Math.min(1,(t-this.reachAt)/(this.pickAt-this.reachAt)));this.reason=p.name+'を選んで手に取ります。';}
    else if(t<this.tq){this.phase='walk';at(this.shopRoute,this.leaveShelf,this.tq);this.reason='記録どおり、有人レジへ向かいます。';}
    else if(t<this.approachAt){this.phase='queue';stand(this.queuePoint(t));this.reason='記録の会計開始時刻まで、飲み物を持って待ちます。';
      const before=ahead(this.record,t-.001),now=ahead(this.record,t);
      if(before>now){this.phase='walk';this.distance=(ahead(this.record,this.tq)-now)*this.config.record.queueGap;}}
    else if(t<this.ts){this.phase='walk';at(this.approachRoute,this.approachAt,this.ts);this.reason='会計の開始時刻に合わせ、レジへ進みます。';}
    else if(t<this.te){this.phase='pay';stand(this.config.register.approach.at(-1));this.phaseTime=(t-this.ts)*60;this.reason=this.basket?'記録の会計時間です。かごを持ったまま、左手のカードで支払います。':'記録の会計時間です。飲み物を持ったまま、カードで支払います。';}
    else if(t<this.packAt){this.phase='walk';at(this.packRoute,this.te,this.packAt);this.reason='記録の会計が終了しました。レジの横へよけます。';}
    else if(this.basket){this.phase='done';stand(this.config.register.pack.at(-1));this.direction=1;this.reason='かごの全品が会計済みになりました。袋へ移す動きは準備中のため、ここまでの再生です。';}
    else if(t<this.exitAt){this.phase='pack';stand(this.config.register.pack.at(-1));this.direction=1;this.reason='会計済みの飲み物を持ち直します。';}
    else {this.phase=t>=this.end?'done':'walk';at(this.outRoute,this.exitAt,this.end);this.reason=t>=this.end?'買い物の記録の再生が終わりました。':'飲み物を持って店を出ます。';}
  }
}
function configName(config,id){return config.products.find(p=>p.id===id).name;}
root.KioskSceneRecord={build,valid,supported,ahead,loadout,Replay};
})(typeof window==='undefined'?globalThis:window);
