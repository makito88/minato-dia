// 第9回（2026-11-15）夜の光の層：日の入り・暗さ・時刻ごとの割合・塗りの保存・明かり・道の光・イベントの光
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const N=require('../js/night-core.js'),cfg=require('../data/night-light.json'),RC=require('../js/route-core.js'),routes=require('../data/routes.json');
const root=path.join(__dirname,'..');
// 日の入り・日の出（立川のあたり。誤差は数分）：冬至は早く、夏至は遅く
const hm=m=>Math.floor(m/60)*100+Math.round(m%60);
const w=N.sunTimes('2026-12-21',cfg.sun),s=N.sunTimes('2026-06-21',cfg.sun);
assert.ok(Math.abs(w.set-(16*60+32))<8&&Math.abs(w.rise-(6*60+47))<8,'冬至 '+hm(w.rise)+' '+hm(w.set));
assert.ok(Math.abs(s.set-(19*60+0))<8&&Math.abs(s.rise-(4*60+26))<8,'夏至 '+hm(s.rise)+' '+hm(s.set));
// 暗さ：冬の17:30は夜・夏の17:30は昼、深夜（26:00 まで）も夜
assert.equal(N.darkness(17*60+30,'2026-12-21',cfg.sun),1);assert.equal(N.darkness(17*60+30,'2026-06-21',cfg.sun),0);
assert.equal(N.darkness(1500,'2026-11-15',cfg.sun),1);assert.equal(N.darkness(12*60,'2026-11-15',cfg.sun),0);
for(let t=900;t<1200;t+=5){const a=N.darkness(t,'2026-11-15',cfg.sun),b=N.darkness(t+5,'2026-11-15',cfg.sun);assert.ok(b>=a-1e-9,'夕方は少しずつ暗くなる');}
// 時刻ごとの割合：住宅は深夜に消え、朝5時ごろからまた点く。ビル街は深夜に減る。工場は暗くならない。大通りだけ深夜も明るい
const Z=id=>cfg.zones.find(z=>z.id===id);
assert.ok(N.frac(Z('home').sched,19*60)>0.8&&N.frac(Z('home').sched,90)<0.1&&N.frac(Z('home').sched,6*60)>0.25);
assert.ok(N.frac(Z('biz').sched,19*60)>N.frac(Z('biz').sched,23*60)&&N.frac(Z('biz').sched,23*60)>N.frac(Z('biz').sched,120));
assert.equal(N.frac(Z('factory').sched,180),N.frac(Z('factory').sched,1200));
assert.ok(N.frac(cfg.roads.avenue.sched,120)>0.7&&N.frac(cfg.roads.street.sched,120)<0.3,'深夜は大通りだけ');
// 塗りの保存（同じ値が続くところを縮めた文字）
const {gw,gh}=N.dims(cfg),n=gw*gh,a=new Uint8Array(n);N.paintAt(cfg,a,100,100,12,4);N.paintAt(cfg,a,800,300,6,2);
const enc=N.rleEnc(a);assert.deepEqual(Array.from(N.rleDec(enc,n)),Array.from(a));assert.ok(enc.length<200,'小さい');
assert.deepEqual(Array.from(N.rleDec('zz,!!,',10)).length,10,'こわれた文字でも落ちない');
assert.equal(N.paintAt(cfg,a,100,100,12,4),0,'同じところを同じ値で塗っても変わらない');
// 形をそろえる：知らない色は捨てる・base は初め true
const nn=N.normalize({zone:5,pal:{biz:['#fff','#112233'],home:['#ffaa00']}},cfg);assert.equal(nn.zone,'');assert.deepEqual(Object.keys(nn.pal),['home']);assert.equal(nn.base,true);
// 塗ったところの性格が自動より先。塗った明かり「置かない」なら明かりは出ない
const doc={night:{v:1,zone:N.rleEnc(a)}};const m0=N.model(cfg,null,null),m1=N.model(cfg,doc,null);
const k=Math.floor(100/4)*gw+Math.floor(100/4);assert.equal(m1.G.z[k],4);assert.notEqual(m0.G.z[k],4);
const none=new Uint8Array(n).fill(2);const m2=N.model(cfg,{night:{zone:'',lamp:N.rleEnc(none)}},null);assert.equal(m2.L.length,0);
// 決まった乱数：同じ保存なら同じ明かり（毎回同じ）
assert.deepEqual(N.model(cfg,doc,null).L.slice(0,50),m1.L.slice(0,50));
// 道の光：工場を通るところは港の道、山は山道。描いた道（大通り）も光る。絵の道は消せる
const rs=new Set(m0.roads.runs.map(r=>r.st));assert.ok(rs.has('avenue')&&rs.has('port')&&rs.has('mountain'));
const d2=RC.normalize({nodes:{a:{x:300,y:380},b:{x:500,y:380}},edges:{e:{a:'a',b:'b',type:'avenue',pts:[]}},stops:{},lines:{},order:[],night:{base:false}},routes);
const m3=N.model(cfg,d2,null,(dd,e)=>RC.edgeFlat(dd,e).map(p=>[p.x,p.y]));assert.equal(m3.roads.runs.length,1);assert.equal(m3.roads.runs[0].st,'avenue');assert.ok(m3.roads.lamps.length>10);
assert.equal(N.roadTypeOf({id:'x',mode:'sea'}),'');assert.equal(N.roadTypeOf({id:'y',mode:'road',style:{width:4}}),'avenue');
// お絵かき帖の保存に入れても、路線の形をそろえるときに消えない
assert.deepEqual(RC.normalize({nodes:{},edges:{},stops:{},lines:{},order:[],night:doc.night},routes).night,doc.night);
// 絵から拾う：灰色の屋根は建物、緑と水は拾わない
const px=(r,g,b)=>{const d=new Uint8ClampedArray(gw*2*gh*2*4);for(let i=0;i<d.length;i+=4){d[i]=r;d[i+1]=g;d[i+2]=b;d[i+3]=255;}return d;};
assert.ok(N.pickScore(px(170,172,178),gw*2,gh*2,cfg).score[0]>0.9);assert.equal(N.pickScore(px(90,160,70),gw*2,gh*2,cfg).score[0],0);
assert.equal(N.pickScore(px(40,140,210),gw*2,gh*2,cfg).water[0],1);
// イベントの光：絵文字から、なければ種類から
assert.equal(N.eventFx({icon:{e:'🎆'},kind:'fes'},cfg),'hanabi');assert.equal(N.eventFx({icon:{e:'🏮'}},cfg),'lantern');assert.equal(N.eventFx({icon:{t:'祭'},kind:'sport'},cfg),'stage');assert.equal(N.eventFx({icon:{e:'📚'},kind:'learn'},cfg),'');
// 計算の部分は DOM を使わない
const src=fs.readFileSync(path.join(root,'js/night-core.js'),'utf8');assert.ok(!/document\.|window\.(?!NightCore)/.test(src.replace(/typeof window[^:]*:/,'')));
console.log('night ok（明かり '+m0.L.length+'・道の帯 '+m0.roads.runs.length+'・街灯 '+m0.roads.lamps.length+'）');
