/* =====================================================================
   沿線のバス網と施設を、お絵かき帖の保存（dia-routes）に描き込む（計算だけ。DOM なし・node でも動く）。2026-11-25
   ・もとは data/busnet.json（停留所・26系統・本数。座標は地図の絵 2000×840）と data/facilities.json（施設82か所。地図の座標 1000×420）。
   ・描き込んだもの（停留所・道・路線・施設のピン）には std:'busnet' の印。消すときは印のあるものだけ消す（自分で描いたものは残る）。
   ・doc.std.busnet：1＝描き込んだ、0＝消した（自動ではもう描き込まない）。
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
/* 描き込む。C＝RouteCore、bn＝data/busnet.json、fac＝data/facilities.json、defs＝data/routes.json。描き込んだ路線の数を返す */
function draw(C,doc,bn,fac,defs){if(!bn||!bn.routes||has(doc))return 0;ensureTypes(doc,defs||{});
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
  doc.std=Object.assign({},doc.std,{[TAG]:0});return n;}
const api={TAG,draw,erase,has,ensureTypes};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
root.BusnetDoc=api;
})(typeof globalThis!=='undefined'?globalThis:this);
