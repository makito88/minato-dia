/* =====================================================================
   沿線のバス網と施設を、お絵かき帖の保存（dia-routes）に描き込む（計算だけ。DOM なし・node でも動く）。2026-11-25
   ・もとは data/busnet.json（停留所・26系統・本数。座標は地図の絵 2000×840）と data/facilities.json（施設82か所。地図の座標 1000×420）。
   ・描き込んだもの（停留所・道・路線・施設のピン）には std:'busnet' の印。消すときは印のあるものだけ消す（自分で描いたものは残る）。
   ・doc.std.busnet：1＝描き込んだ、0＝消した（自動ではもう描き込まない）。行事（イベントの層 doc.evs）は doc.std.busnetEv で同じように。
   ・行事：data/busnet.json の calendar（行事マップと同じ84件。決まった日のないものは入れない）を、お絵かき帖の「イベント」の層に「毎年」で置く。
     日付は今日からかぞえた次の開催日（第何土曜などの決まりは、その年の日付で置く。決まりはメモに書く）。ゲームの地図には出さない（std の印。
     地図には同じ行事が、季節のできごと・ゲームのイベントとして会場の場所に出る）。
   ・道は停留所と停留所の間に1本ずつ（同じ2つの停留所の間は1本だけ）。ほかの道と交わっても切らない。
   ・使うのは js/route-run.js（ゲームの地図：まだ描き込んでいなければ1回だけ自動で）と js/route-editor.js（メニュー「沿線のバス網を描く／消す」）。
   ===================================================================== */
(function(root){
'use strict';
const TAG='busnet';
const COL={C:'#1f7a8c',S:'#c2416a',U:'#7a4fb0',M:'#3f8a3a',K:'#d0742a',N:'#a08a1e',P:'#2f5fb8',F:'#6b5a3a',O:'#b5452f'};
const STATION_STOP=/駅前|駅北口|駅南口|駅南口・/;
const hmOk=s=>{const m=/^(\d{1,2}):(\d{2})$/.exec(s||'');return m?String(m[1]).padStart(2,'0')+':'+m[2]:'06:00';};
// 種類が保存の中になければ、決まり（data/routes.json）から足す
function ensureTypes(doc,defs){const add=(k,id)=>{if(doc.types[k].some(t=>t.id===id))return;const t=(defs[k+'Types']||[]).find(t=>t.id===id);if(t)doc.types[k].push(JSON.parse(JSON.stringify(t)));};
  add('line','dentetsu');add('line','city');add('stop','spot');add('stop','plaza');add('stop','bus');add('stop','airport');add('road','street');}
function has(doc){return !!(doc.std&&doc.std[TAG]===1);}
function hasEv(doc){return !!(doc.std&&doc.std[TAG+'Ev']===1);}
/* 行事の決まり → 次の開催日 'YYYY-MM-DD' と、決まりの言葉。決まった日のないもの（free）は null */
const WD='日月火水木金土',pad=n=>String(n).padStart(2,'0'),ymd=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
function nthDay(y,m,n,dow){if(n>0){const d=new Date(y,m-1,1);return new Date(y,m-1,1+(dow-d.getDay()+7)%7+7*(n-1));}const d=new Date(y,m,0);return new Date(y,m-1,d.getDate()-(d.getDay()-dow+7)%7);}
function nextOf(w,now){const t=new Date(now);t.setHours(0,0,0,0);const ys=[t.getFullYear(),t.getFullYear()+1];const pick=f=>{for(const y of ys){const d=f(y);if(d>=t)return d;}return f(ys[1]);};
  if(w[0]==='nth'){const [,m,n,dow,l]=w;return {date:ymd(pick(y=>nthDay(y,m,n,dow))),rule:`毎年${m}月の${n===-1?'最終':'第'+n}${WD[dow]}曜${l>1?'から'+l+'日間':''}`};}
  if(w[0]==='md'){const [,m,d,l]=w;return {date:ymd(pick(y=>new Date(y,m-1,d))),rule:`毎年${m}月${d}日${l>1?'から'+l+'日間':''}`};}
  if(w[0]==='range'){const a=w[1].split('-').map(Number),b=w[2].split('-').map(Number);return {date:ymd(pick(y=>new Date(y,a[0]-1,a[1]))),rule:`毎年${a[0]}月${a[1]}日〜${b[0]}月${b[1]}日`};}
  if(w[0]==='once'){return {date:w[1],rule:'一度だけ',once:true};}
  return null;}
/* 行事を doc.evs に置く。置いた数を返す */
function drawEvents(doc,bn,now){if(!bn||!bn.calendar||hasEv(doc))return 0;const evs=doc.evs&&doc.evs.items?doc.evs:(doc.evs={v:1,items:{},recent:[]});let n=0;
  for(const c of bn.calendar){const w=nextOf(c.when,now==null?Date.now():now);if(!w)continue;
    evs.items['bn_'+c.id]={name:c.name.slice(0,40),kind:c.kind||'other',icon:{e:c.e||'🎉'},rim:'',x:c.x,y:c.y,st:'',date:w.date,rep:w.once?'once':'year',start:c.start,end:c.end,big:/花火|まつり|マラソン/.test(c.name),img:'',
      memo:`${w.rule}。${c.place}。${c.note}${c.src==='game'?'（ゲームの「この日の条件」で選ぶと起きる）':c.src==='season'?'（季節のできごと：その日に起きるかは沿線暦が決める）':'（季節のできごと・新しい行事）'}`.slice(0,400),fx:{ride:'',goods:[]},std:TAG};n++;}
  doc.std=Object.assign({},doc.std,{[TAG+'Ev']:1});return n;}
/* 描き込む。C＝RouteCore、bn＝data/busnet.json、fac＝data/facilities.json、defs＝data/routes.json。描き込んだ路線の数を返す */
function draw(C,doc,bn,fac,defs){if(!bn||!bn.routes||has(doc))return 0;ensureTypes(doc,defs||{});   // 路線と施設（行事は drawEvents）
  const P=p=>[p[0]/2,p[1]/2],xy=id=>P([bn.stops[id][1],bn.stops[id][2]]);
  const stopId={},legs={};let n=0;
  const stopOf=id=>{if(stopId[id])return stopId[id];const p=xy(id),nd=C.anchor(doc,p,1.2),sid=C.uid(doc,'s'),name=bn.stops[id][0];
    const type=id==='AIR'?'airport':STATION_STOP.test(name)?'plaza':'bus';doc.stops[sid]={name,type,node:nd,lp:'auto',std:TAG};return stopId[id]=sid;};
  for(const r of bn.routes){const path=(bn.routePath||{})[r.no];if(!path)continue;
    const seq=[];let mid=[],last=null;
    for(const it of path){if(typeof it!=='string'){mid.push(P(it));continue;}
      const s=stopOf(it);
      if(last){const k=last+'>'+it,kr=it+'>'+last;if(!legs[k]&&!legs[kr]){const a=doc.stops[stopOf(last)].node,b=doc.stops[s].node;
          if(a!==b){const eid=C.addEdge(doc,a,b,mid,'street',mid.length>0);doc.edges[eid].std=TAG;}legs[k]=1;}}
      seq.push({s});last=it;mid=[];}
    if(seq.length<2)continue;
    const loop=path[0]===path[path.length-1],op=(r.op||'')==='市営';
    const id=C.uid(doc,'l');
    doc.lines[id]={name:`${r.no} ${r.name}`,type:op?'city':'dentetsu',style:{color:COL[r.from]||'#1f7a8c'},seq,freq:{unit:'d',n:Math.max(1,r.wd|0)},
      first:hmOk(r.first),last:hmOk(r.last),round:!loop,show:true,std:TAG,no:r.no};
    doc.order.push(id);n++;}
  // 施設のピン（路線は通らない。地図で場所が分かるように）
  for(const f of (fac&&fac.list)||[]){const nd=C.addNode(doc,f.x,f.y),sid=C.uid(doc,'s');doc.stops[sid]={name:f.name,type:'spot',node:nd,lp:'auto',std:TAG,group:f.group,kind:f.kind};}
  doc.std=Object.assign({},doc.std,{[TAG]:1});return n;}
/* 消す（印のあるものだけ）。消した路線の数を返す */
function erase(C,doc){let n=0;
  for(const id of Object.keys(doc.lines))if(doc.lines[id].std===TAG){delete doc.lines[id];n++;}
  doc.order=doc.order.filter(id=>doc.lines[id]);
  const nodes=new Set();
  for(const id of Object.keys(doc.stops))if(doc.stops[id].std===TAG){nodes.add(doc.stops[id].node);delete doc.stops[id];}
  for(const id of Object.keys(doc.edges))if(doc.edges[id].std===TAG){nodes.add(doc.edges[id].a);nodes.add(doc.edges[id].b);delete doc.edges[id];}
  nodes.forEach(nd=>C.dropOrphan(doc,nd));
  if(doc.evs&&doc.evs.items)for(const id of Object.keys(doc.evs.items))if(doc.evs.items[id].std===TAG)delete doc.evs.items[id];
  doc.std=Object.assign({},doc.std,{[TAG]:0,[TAG+'Ev']:0});return n;}
const api={TAG,draw,drawEvents,erase,has,hasEv,nextOf,ensureTypes};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
root.BusnetDoc=api;
})(typeof globalThis!=='undefined'?globalThis:this);
