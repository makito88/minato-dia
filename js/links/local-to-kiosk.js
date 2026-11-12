/* 橋：地元のお店 → 売店（data/links.json の id "local-to-kiosk"・港駅の売店をつくる回の4回目・2026-11-10）
   赤レンガ倉庫のハーフェン堂（ワッフル）と魚市場の汐見屋（へしこ）が、センターを通らず、港駅の店に自分で届ける（新聞のように）。
   ・読むのは、前の夜までに確定した数字だけ：店の発注の数（state.order）と、前の夜の締めのあとに残った数（state.lots）。売店の結果はお店に戻さない（一方向）。
   ・お店の事情（届く時刻・作れる数の上限・休みの日・少なめの日・日持ち・ひとこと）は 港駅の店の設定ファイル（MinatoStore.URL）の localShops[].supply（島の設定・すべて仮）。
   ・少なめの日は、保存の種と運行日だけで決まる（いつ・どの端末でも同じ）。結果は保存しない（決まり3）。
   ・strength 0・未接続・廃止のときは null（売店は前と同じ：センターの朝の便で届く）。
   返り値 plan()：{v:1, id, day, strength, pids:{品:お店}, life:{品:日持ちの日数}, runs:[{shop,name,t,items:{品:数},cost}],
                  closed:[お店], say:[{shop,name,person,text}], values:[{name,unit,src,value,day,t}]}
     売店の計算が受け取る入口は ctx.local（この返り値をそのまま渡す）。 */
(function(root){
'use strict';
const ID='local-to-kiosk';
function hash(){let h=2166136261>>>0;for(const a of arguments){const s=String(a);for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}h^=0x9e;h=Math.imul(h,16777619)>>>0;}return h>>>0;}
const u01=(...a)=>hash(...a)/4294967296;
function linkOf(L){return L&&(L.links||[]).find(x=>x.id===ID)||null;}
/* お店がその運行日に休みか（dow＝運行日を7で割った余り。売店の ctx.dow と同じ） */
function closedOn(S,day){const dow=((day%7)+7)%7;return (S.closedDow||[]).includes(dow);}
/* L=links.json、M=港駅の店の設定（MinatoStore.URL）、state=港駅の店の状態（前の夜の締めのあと）、opts：{day} */
function plan(L,M,state,opts){const lk=linkOf(L);if(!lk||lk.state==='none'||lk.state==='retired')return null;
  const s=Number(lk.strength)||0;if(!s||!M||!state)return null;
  const day=opts.day,P={};for(const p of M.products||[])P[p.id]=p;
  const out={v:1,id:ID,day,strength:s,pids:{},life:{},runs:[],closed:[],say:[],values:[]};
  const have=pid=>(state.lots[pid]||[]).reduce((t,x)=>t+(x.q||0),0);
  const opened=state.openedDay!=null?state.openedDay:null;
  for(const shop of M.localShops||[]){const S=shop.supply;if(!S)continue;const sy=S.say||{};
    for(const pid of shop.items)if(state.order&&state.order[pid]!=null){out.pids[pid]=shop.id;if(P[pid]&&P[pid].life!=null)out.life[pid]=P[pid].life;}
    const sayIt=(k,text)=>out.say.push({shop:shop.id,name:shop.name,person:shop.person,kind:k,text:text||sy[k]||shop.say});
    if(closedOn(S,day)){out.closed.push(shop.id);sayIt('closed');continue;}
    const short=u01(state.seed,day,'local',shop.id)<(S.shortP||0),k=short?(S.shortMul??0.5):1;
    const items={};let cost=0,n=0;
    for(const pid of shop.items){if(!out.pids[pid])continue;const cap=Math.floor(((S.cap||{})[pid]||0)*k);
      const q=Math.max(0,Math.min(cap,Math.round((state.order[pid]||0)*Math.min(1,s))-have(pid)));
      if(q>0){items[pid]=q;n+=q;cost+=q*((P[pid]&&P[pid].cost)||0);}}
    const t=S.arrive;
    if(n)out.runs.push({shop:shop.id,name:shop.name,t,items,cost});
    if(short)sayIt('short');else if(opened!=null&&day===opened)sayIt('first');
    else if(closedOn(S,day+1))sayIt('beforeClosed');
    else if(n)sayIt('normal');}
  const deliver={};for(const r of out.runs)for(const pid in r.items)deliver[pid]=r.items[pid];
  const vu=n=>(lk.values||[]).find(x=>x.name===n)||{};
  out.values=[{name:'deliver',unit:vu('deliver').unit||'',src:vu('deliver').src||'game',value:deliver,day,t:null},
    {name:'arrive',unit:vu('arrive').unit||'',src:vu('arrive').src||'assume',value:Object.fromEntries(out.runs.map(r=>[r.shop,r.t])),day,t:null},
    {name:'cost',unit:vu('cost').unit||'',src:vu('cost').src||'assume',value:Object.fromEntries(out.runs.map(r=>[r.shop,r.cost])),day,t:null}];
  return out;}
const api={ID,plan,closedOn};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
root.LocalToKiosk=api;
})(typeof globalThis!=='undefined'?globalThis:this);
