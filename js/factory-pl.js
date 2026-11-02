/* =====================================================================
   おにぎり工場（試作）の収支：4つのライン（米・パン・サンド・ドーナッツ）をまとめた1晩と1か月の見積もり
   ・それぞれのラインの計算（FactoryCore・BreadCore・SandCore）を、いま保存してある夕方の条件で
     何夜か回して平均し、売上（売店の仕入れ値 ×（1 − センターの取り分））と費用を並べる。
   ・おにぎりの新しい取引先と、増やすための設備をここで選ぶ。選ぶと、米のラインの見込み・番重の行き先・設備も変わる
     （FactoryPL.apply を米のラインの画面が使う）。
   ・設定は data/factory.json の pl。選んだものはブラウザの dia-factory-pl。数字はすべてゲームの仮の目安。
   ===================================================================== */
(function(root){
'use strict';
const KEY='dia-factory-pl';
function load(){try{return JSON.parse(localStorage.getItem(KEY)||'null')||{};}catch(e){return {};}}
function save(s){try{localStorage.setItem(KEY,JSON.stringify(s));}catch(e){}}
function defaults(D){const P=D.pl;return {take:P.take.default,building:P.building.default,customers:[],equip:false};}
function settings(D){return Object.assign(defaults(D),load());}
function extraUnits(D,s){return D.pl.customers.filter(c=>s.customers.includes(c.id)).reduce((a,c)=>a+c.units,0);}
/* 米のラインの設定に、取引先と設備を反映する（D は書きかえてよい写し） */
function apply(D,s){if(!D.pl)return D;s=s||settings(D);const add=extraUnits(D,s);
  if(add>0){const base=D.forecast,tot=base+add;D.forecast=tot;
    D.packLine.stores=D.packLine.stores.map(([n,sh])=>[n,sh*base/tot]).concat(D.pl.customers.filter(c=>s.customers.includes(c.id)).map(c=>[c.name,c.units/tot]));}
  if(s.equip){const E=D.pl.equip;D.wash.lines=(D.wash.lines||1)+E.wash;D.cook.pots+=E.pots;D.cool.slots+=E.cool;D.soak.tanks+=E.tanks;}
  const need=suggestBatches(D);if(D.ranges.batches[1]<need+4)D.ranges.batches[1]=need+4;
  return D;}
function suggestBatches(D){return Math.ceil(D.forecast*(1+D.packLine.spare)/D.batchUnits)+1;}
const cfgOf=k=>{try{return (JSON.parse(localStorage.getItem(k)||'null')||{}).cfg||{};}catch(e){return {};}};

/* 見積もり：保存してある条件で nights 夜回して平均（夜の番号は1から） */
function compute(D0,K,s){const P=D0.pl;s=s||settings(D0);const cost=id=>{const p=K.products.find(x=>x.id===id);return p?p.cost:0;};
  const D=apply(JSON.parse(JSON.stringify(D0)),s),n=P.nights,keep=1-s.take;
  const rcfg=Object.assign({},cfgOf('dia-factory'));rcfg.batches=Math.max(rcfg.batches||0,suggestBatches(D));
  const bcfg=cfgOf('dia-factory-bread'),scfg=cfgOf('dia-factory-sand'),dcfg=cfgOf('dia-factory-donut');
  const L={rice:{n:0,order:0,short:0,rev:0,labor:0,mat:0,mach:0,cost:0},bread:{n:0,order:0,short:0,rev:0,labor:0,mat:0,mach:0,cost:0},sand:{n:0,order:0,short:0,rev:0,labor:0,mat:0,mach:0,cost:0}};
  L.donut={n:0,order:0,short:0,rev:0,labor:0,mat:0,mach:0,cost:0};
  const add=(x,o)=>{for(const k in o)x[k]+=o[k]/n;};
  for(let seed=1;seed<=n;seed++){
    {const S=root.FactoryCore.simulate(D,Object.assign({},rcfg,{seed})).summary,y=S.yen;let rev=0;
      for(const f of S.fills){const fl=D.packLine.fillings.find(x=>x.id===f.id);rev+=f.shipped*cost(fl&&fl.kiosk)*keep;}
      add(L.rice,{n:S.shipped,order:S.order,short:S.short,rev,labor:y.labor,mat:y.rice+y.other,mach:y.cool+(y.machine||0),cost:y.total});}
    {const S=root.BreadCore.simulate(D,Object.assign({},bcfg,{seed})).summary,y=S.yen;let rev=0;
      for(const p of S.prods){const bp=D.bread.products.find(x=>x.id===p.id);rev+=p.shipped*cost(bp&&bp.kiosk)*keep;}
      add(L.bread,{n:S.shipped,order:S.order,short:S.short,rev,labor:y.labor,mat:y.yeast+y.other,mach:y.oven+y.fry,cost:y.total});}
    {const S=root.SandCore.simulate(D,Object.assign({},scfg,{seed})).summary,y=S.yen;let rev=0;
      for(const p of S.prods){const sp=D.sand.products.find(x=>x.id===p.id);rev+=p.shipped*cost(sp&&sp.kiosk)*keep;}
      const lf=S.loaf&&S.loaf.yen||{};   // 自社で焼く食パン（材料・オーブン・冷ます・人）
      const lab=y.labor+(lf.labor||0),mat=(y.food||0)+(lf.ing||0);
      add(L.sand,{n:S.shipped,order:S.order,short:S.short,rev,labor:lab,mat,mach:y.total-lab-mat,cost:y.total});}
    {const S=root.DonutCore.simulate(D,Object.assign({},dcfg,{seed})).summary,y=S.yen;
      const rev=S.prods.reduce((n,p)=>n+p.shipped*cost(p.kiosk)*keep,0);
      add(L.donut,{n:S.shipped,order:S.order,short:S.short,rev,labor:y.labor,mat:y.material+y.oil,mach:y.machine,cost:y.total});}}

  const F=P.fixed,labor=L.rice.labor+L.bread.labor+L.sand.labor+L.donut.labor;
  const over=[['社会保険など（人件費の'+Math.round(F.socialRate*1000)/10+'%）',labor*F.socialRate],['工場長・事務・検査の人',F.admin],[`建物と設備（月${(s.building/10000).toLocaleString()}万円）`,s.building/P.days],
    ['水道・電気・ガスの基本分',F.utility],['工場→センターのトラック',F.truck],['洗浄・衛生用品・ごみ',F.clean]];
  if(s.equip)over.push([`足した設備（${P.equip.name}）`,P.equip.yen]);
  const rev=L.rice.rev+L.bread.rev+L.sand.rev+L.donut.rev,lineCost=L.rice.cost+L.bread.cost+L.sand.cost+L.donut.cost,overSum=over.reduce((a,x)=>a+x[1],0);
  return {L,over,rev,lineCost,overSum,profit:rev-lineCost-overSum,days:P.days,s,extra:extraUnits(D,s),forecast:D.forecast,batches:rcfg.batches,fan:rcfg.fan||D.defaults.fan,ownBread:(Object.assign({},D.sand.defaults,scfg).bread)==='own'};}

/* ---------------- 画面 ---------------- */
const $=id=>document.getElementById(id);
const yen=v=>(v<0?'−':'')+Math.abs(Math.round(v)).toLocaleString()+'円';
const man=v=>(v<0?'−':'')+(Math.abs(v)/10000).toFixed(Math.abs(v)<1e6?1:0)+'万円';
let D=null,K=null;
function build(){const box=$('plBox');if(!box||!D.pl)return;const P=D.pl,s=settings(D);
  const seg=(id,arr,v)=>`<div class="seg" id="${id}" role="group">${arr.map(([k,l])=>`<button data-v="${k}" class="${String(k)===String(v)?'on':''}" aria-pressed="${String(k)===String(v)}">${l}</button>`).join('')}</div>`;
  box.innerHTML=`<div class="plan">
    <div><label>配送センターの取り分</label>${seg('plTake',P.take.opts.map(x=>[x,Math.round(x*100)+'%']),s.take)}<div class="hint">工場の手取りは、売店の仕入れ値×（1−取り分）</div></div>
    <div><label>建物と設備（1か月）</label>${seg('plBld',P.building.opts.map(x=>[x,(x/10000)+'万円']),s.building)}<div class="hint">家賃・償却。1晩あたりは÷${P.days}</div></div>
    <div><label>おにぎりの新しい取引先</label><div class="plcust">${P.customers.map(c=>`<label class="plck"><input type="checkbox" data-c="${c.id}" ${s.customers.includes(c.id)?'checked':''}> ${c.name}（${c.station}）${c.units.toLocaleString()}個</label>`).join('')}</div><div class="hint">選ぶと米のラインの見込みが増え、番重の行き先にも出る</div></div>
    <div><label>おにぎりを増やす設備</label>${seg('plEq',[[0,'足さない'],[1,'足す']],s.equip?1:0)}<div class="hint">${P.equip.name}・1晩${yen(P.equip.yen)}。3,000個増やすなら、設備を足して冷却を「強」にすると間に合う</div></div>
  </div>
  <div class="row" style="margin-top:10px"><button class="primary" id="plRun">見積もる（${P.nights}夜の平均）</button><span class="small muted" id="plInfo"></span></div>
  <div id="plOut" class="small muted" style="margin-top:8px">「見積もる」を押すと、4つのラインをいま保存してある夕方の条件で${P.nights}夜回して、平均の収支を出します。</div>`;
  const set=(k,v)=>{const x=settings(D);x[k]=v;save(x);build();changed(k);};
  for(const b of $('plTake').children)b.onclick=()=>set('take',+b.dataset.v);
  for(const b of $('plBld').children)b.onclick=()=>set('building',+b.dataset.v);
  for(const b of $('plEq').children)b.onclick=()=>set('equip',b.dataset.v==='1');
  for(const c of box.querySelectorAll('[data-c]'))c.onchange=()=>{const x=settings(D);x.customers=[...box.querySelectorAll('[data-c]')].filter(e=>e.checked).map(e=>e.dataset.c);save(x);build();changed('customers');};
  $('plRun').onclick=()=>{$('plOut').textContent='計算しています…';setTimeout(()=>show(compute(D,K)),30);};}
/* 取引先と設備が変わったら、米のラインの画面も作り直す */
function changed(k){if((k==='customers'||k==='equip')&&root.FactoryRice&&root.FactoryRice.reapply)root.FactoryRice.reapply(k==='customers');}
function show(r){const L=r.L,P=D.pl,dd=r.days;
  const line=(nm,x,u)=>`<tr><th>${nm}</th><td class="r num">${Math.round(x.n).toLocaleString()}${u}${x.short>=1?`<br><span class="down small">足りない ${Math.round(x.short).toLocaleString()}</span>`:''}</td><td class="r num">${yen(x.rev)}</td><td class="r num">${yen(x.labor)}</td><td class="r num">${yen(x.mat)}</td><td class="r num">${yen(x.mach)}</td><td class="r num">${yen(x.cost)}</td><td class="r num ${x.rev-x.cost>=0?'up':'down'}">${yen(x.rev-x.cost)}</td><td class="r num">${x.n?Math.round(x.cost/x.n)+'円':'—'}</td></tr>`;
  $('plOut').className='';
  $('plOut').innerHTML=`
   <p class="big">1晩のもうけ <b class="num ${r.profit>=0?'up':'down'}">${yen(r.profit)}</b>　1か月（${dd}晩）<b class="num ${r.profit>=0?'up':'down'}">${man(r.profit*dd)}</b></p>
   <div class="tw"><table><thead><tr><th>ライン</th><th class="r">出荷</th><th class="r">売上（手取り）</th><th class="r">人件費</th><th class="r">材料・包材</th><th class="r">機械・電気・ガス</th><th class="r">ラインの費用</th><th class="r">ラインのもうけ</th><th class="r">1個の費用</th></tr></thead><tbody>
    ${line('おにぎり',L.rice,'個')}${line('パン',L.bread,'個')}${line('サンド',L.sand,'パック')}${line('ドーナッツ',L.donut,'個')}
    <tr><th>合計</th><td></td><td class="r num"><b>${yen(r.rev)}</b></td><td class="r num">${yen(L.rice.labor+L.bread.labor+L.sand.labor+L.donut.labor)}</td><td class="r num">${yen(L.rice.mat+L.bread.mat+L.sand.mat+L.donut.mat)}</td><td class="r num">${yen(L.rice.mach+L.bread.mach+L.sand.mach+L.donut.mach)}</td><td class="r num"><b>${yen(r.lineCost)}</b></td><td class="r num ${r.rev-r.lineCost>=0?'up':'down'}"><b>${yen(r.rev-r.lineCost)}</b></td><td></td></tr>
   </tbody></table></div>
   <div class="tw"><table class="fills"><thead><tr><th>ラインの外の費用（1晩・仮）</th><th class="r"></th></tr></thead><tbody>
    ${r.over.map(([k,v])=>`<tr><th>${k}</th><td class="r num">${yen(v)}</td></tr>`).join('')}<tr><th>合計</th><td class="r num"><b>${yen(r.overSum)}</b></td></tr></tbody></table></div>
   <p class="small muted">センターの取り分 ${Math.round(r.s.take*100)}%。サンドの食パンは「${r.ownBread?'自社で焼く（人件費・材料・機械に含む）':'仕入れ（材料に含む）'}」。おにぎりは見込み ${r.forecast.toLocaleString()}個${r.extra?`（新しい取引先 ${r.extra.toLocaleString()}個を含む）`:''}・${r.batches}釜・冷却「${{weak:'弱',mid:'中',strong:'強'}[r.fan]||r.fan}」${r.s.equip?'・設備を足した':''}。パン・サンド・ドーナッツは、それぞれのタブに保存してある条件。${P.nights}夜（夜の番号1〜${P.nights}）の平均です。売上は売店の仕入れ値（data/kiosk.json の原価）から取り分を引いた額で、取引先にも同じ値段で売るとしています。数字はすべてゲームの仮の目安で、実在の工場の数字ではありません。</p>`;}
async function init(){if(!$('plBox'))return;
  try{const [a,b]=await Promise.all([fetch('data/factory.json',{cache:'no-cache'}).then(r=>r.json()),fetch('data/kiosk.json',{cache:'no-cache'}).then(r=>r.json())]);D=a;K=b;}catch(e){return;}
  if(!D.pl)return;build();}
root.FactoryPL={apply,settings,load,save,compute,suggestBatches,extraUnits};
if(typeof document!=='undefined')init();
})(typeof window!=='undefined'?window:globalThis);
