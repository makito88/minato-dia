/* 橋：工場 → 売店（当日の出荷と到着・できたての便）（data/links.json の id "factory-to-kiosk-sameday"・港駅の売店をつくる回の7回目・2026-11-10）
   柱1の8「工場の昼の便」（8:00 出荷 → 10:00 到着 → お昼に売る）を、港駅の店から始める。運ぶのはみなと川運輸。
   {day, t, value} の t に「確定した時刻」を入れる最初の橋（出荷の数は出荷の時刻に、着いた時刻は着いた時刻に確定する）。
   ・読むのは、それより前に確定した数字だけ：港駅の店の前の夜の発注（state.order・19:30 に確定）と、運行日の始めの天気（cond.wx）と保存の種。
     売店の結果は工場にも運送会社にも戻さない（一方向）。
   ・島の設定：工場の朝の組（data/factory.json の sameday）・みなと川運輸の昼の便（data/haiso.json の sameday）・店の側（港駅の店の設定の sameday）。すべて仮。
   ・結果は保存しない（決まり3）。strength 0・未接続・廃止・設定がないときは null（売店は前と同じ：昼前の便で届く）。
   返り値 plan()：{v:1, id, day, strength, ship, arrive, late, delay, trouble, items:{品:数}, want:{品:数}, replace, fee, carrier,
                  tag:{pids:{品:1}, from, to, k, label}, values:[{name,unit,src,value,day,t}]}
     売店の計算が受け取る入口は ctx.sameday（この返り値をそのまま渡す）。 */
(function(root){
'use strict';
const ID='factory-to-kiosk-sameday';
function hash(){let h=2166136261>>>0;for(const a of arguments){const s=String(a);for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}h^=0x9e;h=Math.imul(h,16777619)>>>0;}return h>>>0;}
const u01=(...a)=>hash(...a)/4294967296;
function linkOf(L){return L&&(L.links||[]).find(x=>x.id===ID)||null;}
/* L=links.json、C={F:工場の設定 factory.json, H:配送会社の設定 haiso.json, M:港駅の店の設定}、state=港駅の店の状態（前の夜の締めのあと）、opts：{day, cond} */
function plan(L,C,state,opts){const lk=linkOf(L);if(!lk||lk.state==='none'||lk.state==='retired')return null;
  const s=Number(lk.strength)||0;if(!s||!C||!state||!state.order)return null;
  const F=C.F&&C.F.sameday,H=C.H&&C.H.sameday,MS=C.M&&C.M.sameday;if(!F||!H||!MS)return null;
  const day=opts.day,wx=(opts.cond&&opts.cond.wx)||'sun',seed=state.seed||1;
  // 工場の朝の組：作る数＝前の夜の発注×share（昼前の便の分）を、品ごとに cap まで。釜の遅れの日は少なく・遅く
  const T=F.trouble||{},trouble=u01(seed,day,'sameday','pot')<(T.p||0),mul=trouble?(T.mul??1):1;
  const want={},items={};let n=0;
  for(const pid of MS.items||[]){const o=state.order[pid];if(o==null)continue;const w=Math.round(o*(MS.share??0.25)*Math.min(1,s));if(w<=0)continue;want[pid]=w;
    const q=Math.min(w,Math.floor(((F.cap||{})[pid]||0)*mul));if(q>0){items[pid]=q;n+=q;}}
  if(!n)return null;
  const ship=F.ship+(trouble?(T.late||0):0);
  // みなと川運輸の昼の便：出荷の時刻に工場を出て、min 分＋遅れで店に着く（遅れは小さいことが多い）
  const D=H.delay||{},delay=Math.round(Math.pow(u01(seed,day,'sameday','truck'),2)*(D.max||0))+((D.wx||{})[wx]||0);
  const arrive=ship+(H.min||0)+delay,tg=MS.tag||{};
  const tag={pids:Object.fromEntries(Object.keys(items).map(k=>[k,1])),from:arrive,to:arrive+(tg.hours||0)*60,k:1+((tg.k??1)-1)*Math.min(1,s),label:tg.label||'できたて'};
  const vu=nm=>(lk.values||[]).find(x=>x.name===nm)||{};
  const values=[{name:'shipped',unit:vu('shipped').unit||'',src:vu('shipped').src||'game',value:items,day,t:ship},
    {name:'arrive',unit:vu('arrive').unit||'',src:vu('arrive').src||'assume',value:arrive,day,t:arrive}];
  return {v:1,id:ID,day,strength:s,ship,arrive,late:trouble?(T.late||0):0,delay,trouble,items,want,replace:MS.replace,fee:H.fee||0,carrier:H.carrier,truck:H.truck,tag,values};}
const api={ID,plan};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
root.FactoryToKioskSameday=api;
})(typeof globalThis!=='undefined'?globalThis:this);
