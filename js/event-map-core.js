/* =====================================================================
   地図の吹き出し：計算だけ（第8回・2026-11-14。DOM は使わない。node でも動く）
   ・お絵かき帖の「イベント」の層で置いた行事（保存 dia-routes の evs）の形をそろえる・その日に出るかを決める。
   ・吹き出しの状態（始まる前・開いている・終わった）、近くの駅、近いものをまとめる、の計算。
   ・設定は data/event-map.json。効き目（乗客・売店の品）は、いまは表示だけ（計算にはつないでいない。つなぐ場所は HANDOFF の第8回）。
   ===================================================================== */
(function(root){
'use strict';
const DAY=86400000,S0=270*60000;
// 運行日の番号 → 'YYYY-MM-DD'（js/season-core.js と同じ数え方。日本時間の朝4:30で区切る）
function ymdOf(i){const d=new Date(i*DAY+S0+12*3600000);return d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0')+'-'+String(d.getUTCDate()).padStart(2,'0');}
function indexOf(ymd){const [y,m,d]=ymd.split('-').map(Number);return Math.floor((Date.UTC(y,m-1,d,12)-S0)/DAY);}
const dowOf=ymd=>{const [y,m,d]=ymd.split('-').map(Number);return new Date(Date.UTC(y,m-1,d)).getUTCDay();};
// いまの運行日の日付（端末の時計から。朝4:30で区切る）
const todayYmd=ms=>ymdOf(Math.floor((ms+9*3600000-S0)/DAY));
const isYmd=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s);
// 'HH:MM' ⇔ 分（0:00〜2:00 は 24:00〜26:00 として扱う。地図の1日は 4:30〜26:00）
function toMin(s){if(typeof s==='number')return s;const m=/^(\d{1,2}):(\d{2})$/.exec(s||'');if(!m)return null;let v=+m[1]*60+ +m[2];if(v<270)v+=1440;return v;}
const hm=v=>{v=Math.round(v)%1440;return Math.floor(v/60)+':'+String(v%60).padStart(2,'0');};

/* 置いたイベント1件の形（保存 dia-routes の evs.items[id]）
   {name, kind, icon:{e:'🎆'}|{t:'市'}, rim(ふちの色。なければ種類の色), x, y, st(近くの駅・自動), date:'YYYY-MM-DD', rep:'once'|'year'|'week',
    start:'HH:MM', end:'HH:MM', big(大きめ), img(小さな画像の dataURL), memo, fx:{ride:''|'s'|'m'|'l', goods:[売店のジャンル]}} */
function normItem(o){if(!o||typeof o!=='object')return null;const x=+o.x,y=+o.y;if(!isFinite(x)||!isFinite(y))return null;
  const icon=o.icon&&o.icon.e?{e:String(o.icon.e)}:o.icon&&o.icon.t?{t:String(o.icon.t).slice(0,2)}:{e:'🎉'};
  const fx=o.fx&&typeof o.fx==='object'?{ride:['s','m','l'].includes(o.fx.ride)?o.fx.ride:'',goods:Array.isArray(o.fx.goods)?o.fx.goods.filter(g=>typeof g==='string').slice(0,6):[]}:{ride:'',goods:[]};
  return {name:String(o.name||'イベント').slice(0,40),kind:String(o.kind||'other'),icon,rim:/^#[0-9a-f]{6}$/i.test(o.rim||'')?o.rim:'',x:+x.toFixed(1),y:+y.toFixed(1),st:typeof o.st==='string'?o.st:'',
    date:isYmd(o.date)?o.date:'',rep:['once','year','week'].includes(o.rep)?o.rep:'once',start:/^\d{1,2}:\d{2}$/.test(o.start||'')?o.start:'10:00',end:/^\d{1,2}:\d{2}$/.test(o.end||'')?o.end:'16:00',
    big:!!o.big,img:typeof o.img==='string'&&o.img.startsWith('data:image/')?o.img:'',memo:String(o.memo||'').slice(0,400),fx};}
// 保存の evs をそろえる：{v:1, items:{id:…}, recent:[絵文字…]}
function normalize(evs){const out={v:1,items:{},recent:[]};if(!evs||typeof evs!=='object')return out;
  for(const [id,o] of Object.entries(evs.items||{})){const n=normItem(o);if(n)out.items[id]=n;}
  if(Array.isArray(evs.recent))out.recent=evs.recent.filter(e=>typeof e==='string').slice(0,16);
  return out;}
// その日（'YYYY-MM-DD'）に出るか。日付がなければ「毎日」ではなく出さない（暦の帯で日を選んで置くので、ふつうは日付がある）
function occurs(it,ymd){if(!it||!it.date)return false;if(it.rep==='once')return it.date===ymd;if(ymd<it.date)return false;
  if(it.rep==='year')return it.date.slice(5)===ymd.slice(5);if(it.rep==='week')return dowOf(it.date)===dowOf(ymd);return false;}
function forDay(evs,ymd){const out=[];for(const [id,it] of Object.entries((evs&&evs.items)||{}))if(occurs(it,ymd))out.push(Object.assign({id},it));
  return out.sort((a,b)=>toMin(a.start)-toMin(b.start));}
// 暦の帯：center を中心に前後 n 日の [{ymd,i,dow,m,d,n(その日の数)}]
function strip(evs,centerYmd,before,after){const c=indexOf(centerYmd),out=[];for(let i=c-before;i<=c+after;i++){const y=ymdOf(i);out.push({ymd:y,i,dow:dowOf(y),m:+y.slice(5,7),d:+y.slice(8),n:forDay(evs,y).length});}return out;}
// 状態：始まる前・開いている・終わった
function state(a,b,T){return T<a?'before':T<=b?'during':'after';}
// 近くの駅（stations：{記号:{x,y}}）
function nearest(stations,x,y){let best='',bd=1e9;for(const [k,s] of Object.entries(stations||{})){const d=Math.hypot(s.x-x,s.y-y);if(d<bd){bd=d;best=k;}}return best;}
/* 近いものをまとめる：items=[{x,y,…}] → [{x,y,items:[…]}]。先に来たもの（大きい・開いているもの）が代表。r は地図の単位 */
function cluster(items,r){const out=[];for(const it of items){let g=null;for(const c of out){if(Math.hypot(c.x-it.x,c.y-it.y)<r){g=c;break;}}if(g)g.items.push(it);else out.push({x:it.x,y:it.y,items:[it]});}return out;}
// 並べる順：開いている → 始まる前 → 終わった、大きいものが先
const RANK={during:0,before:1,after:2};
function order(items){return items.slice().sort((a,b)=>(RANK[a.state]-RANK[b.state])||((b.big?1:0)-(a.big?1:0))||(a.a-b.a));}
// 絵文字 → Twemoji のファイル名（tools/emoji-pick.py と同じ決まり）
function fileOf(e){const cps=Array.from(e).map(ch=>ch.codePointAt(0).toString(16));const zwj=cps.includes('200d');return (zwj?cps:cps.filter(c=>c!=='fe0f')).join('-')+'.svg';}
// 効き目の文（表示だけ）。genres：data/kiosk.json の genres
function fxText(fx,genres,rideNames){const out={ride:'',goods:''};if(!fx)return out;
  if(fx.ride){const r=(rideNames||[]).find(x=>x[0]===fx.ride);out.ride=r?r[1]:'';}
  if(fx.goods&&fx.goods.length){const G={};(genres||[]).forEach(g=>G[g.id]=g.name);out.goods=fx.goods.map(g=>G[g]||g).join('・');}
  return out;}
// 絵文字を言葉で探す（catalog の items の [絵文字, 言葉]）
function search(catalog,q){q=String(q||'').trim();if(!q)return [];const out=[];for(const c of catalog||[])for(const [e,w] of c.items)if(w.includes(q)||e===q)out.push({e,w,cat:c.id,kind:c.kind});return out;}
// 絵文字の種類（選んだ絵文字から、ふちの色の種類を決める）
function kindOfEmoji(catalog,e){for(const c of catalog||[])for(const [x] of c.items)if(x===e)return c.kind;return 'other';}
// 最近使ったもの：先頭に入れて、同じものを消し、12個まで
function pushRecent(list,e){return [e].concat((list||[]).filter(x=>x!==e)).slice(0,12);}
function uid(items){let i=Object.keys(items||{}).length+1,id;do{id='e'+(i++).toString(36);}while(items&&items[id]);return id;}

const api={todayYmd,ymdOf,indexOf,dowOf,toMin,hm,normItem,normalize,occurs,forDay,strip,state,nearest,cluster,order,fileOf,fxText,search,kindOfEmoji,pushRecent,uid};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
root.EventMapCore=api;
})(typeof globalThis!=='undefined'?globalThis:this);
