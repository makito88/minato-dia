/* =====================================================================
   おにぎり工場（試作）のサンドイッチのラインの画面
   ・上の切り替えで「🥪 サンドイッチのライン」を選ぶと出る（factory-tab の知らせを聞く）。
   ・夕方の条件 → SandCore.simulate で一晩を先に計算し、時刻に合わせて再生して描く。
   ・商品規格の表（品ごとの切れ・原材料・アレルゲン。原材料から集める）。
   ・絵：たまご・レタス・カツ・フルーツとツナの仕込み → 冷蔵庫の在庫 → 組み立てのベルト（トレーの温度）→ 締め → カット・パック詰め。
     自社で食パンを焼くときは、下に角型の食パン（仕込み → ホイロ → オーブン → 冷ます → スライス）と「使えるパンの枚数」の目盛り。
   ・保存はブラウザの dia-factory-sand（条件と、前の夜の要約だけ）。
   ===================================================================== */
(function(){
'use strict';
const SC=window.SandCore,LC=SC.LC,hm=SC.hm,SL=window.SandLoaf;
const $=id=>document.getElementById(id);
const KEY='dia-factory-sand';
let D=null,A=null,cfg=null,R=null,prev=null,cur=0,playing=false,speed=300,lastFrame=0,resultShown=false,active=false,lastSide=-1,evCount=-1;
const SPEEDS=[[1,'×1'],[60,'×60'],[300,'×300'],[900,'×900']];
function load(){try{return JSON.parse(localStorage.getItem(KEY)||'null')||{};}catch(e){return {};}}
function save(){try{localStorage.setItem(KEY,JSON.stringify({cfg,prev}));}catch(e){}}
function css(v){return getComputedStyle(document.documentElement).getPropertyValue(v).trim()||'#888';}
const yen=n=>n==null?'—':n.toLocaleString()+'円';
const P=id=>A.products.find(p=>p.id===id);
const short=id=>P(id).name.replace('サンド','');
const Kd=id=>A.kinds.find(k=>k.id===id);
function tempColor(T){const stops=[[-5,[60,100,200]],[4,[80,150,210]],[10,[110,190,150]],[15,[230,190,70]],[25,[235,140,60]],[95,[205,60,50]]];
  if(T<=stops[0][0])return rgb(stops[0][1]);for(let i=1;i<stops.length;i++){if(T<=stops[i][0]){const a=stops[i-1],b=stops[i],u=(T-a[0])/(b[0]-a[0]);return rgb(a[1].map((x,j)=>x+(b[1][j]-x)*u));}}return rgb(stops[stops.length-1][1]);}
function rgb(c){return `rgb(${c.map(x=>Math.round(x)).join(',')})`;}

/* ---------------- 夕方に決める ---------------- */
function buildPlan(){const g=A.ranges;
  const seasonOpts=Object.entries(D.seasons).map(([k,s])=>`<option value="${k}">${s.label}</option>`).join('');
  const tOpts=([a,b])=>{const o=[];for(let t=a;t<=b;t+=15)o.push(`<option value="${t}">${hm(t)}</option>`);return o.join('');};
  const seg=(id,arr)=>`<div class="seg" id="${id}" role="group">${arr.map(([v,l])=>`<button data-v="${v}">${l}</button>`).join('')}</div>`;
  const LF=A.loaf;
  $('splan').innerHTML=`
  ${LF?`<div class="loafplan"><label>食パン</label>${seg('sbread',[['buy','仕入れ（切ってある）'],['own','自社で焼く（角型）']])}<div class="hint" id="sbreadHint"></div>
    <div id="sloafOpts" class="plan" style="margin-top:8px">
     <div><label for="sbstart">食パンの仕込みを始める時刻</label><select id="sbstart">${tOpts(g.bstart)}</select><div class="hint" id="sbstartHint"></div></div>
     <div><label>こねる間隔</label>${seg('sbint',LF.intervals.map(v=>[v,v+'分']))}<div class="hint" id="sbintHint"></div></div>
     <div><label>角型のオーブン</label>${seg('sbovens',LF.ovens.map(v=>[v,v+'台']))}<div class="hint" id="sbovensHint"></div></div>
     <div><label>パンの厚み</label>${seg('sbthick',LF.thicks.map(v=>[v,v+'mm']))}<div class="hint" id="sbthickHint"></div></div>
     <div><label>冷まし方</label>${seg('sbcool',['rack','room'].map(k=>[k,LF.cool[k].label]))}<div class="hint" id="sbcoolHint"></div></div>
     <div><label>見込みに上乗せして焼く</label>${seg('sbspare',LF.spares.map(v=>[v,v+'%']))}<div class="hint" id="sbspareHint"></div></div>
    </div></div>`:''}
  <div><label for="sseason">季節</label><select id="sseason">${seasonOpts}</select><div class="hint" id="sseasonHint"></div></div>
  <div><label for="sprep">具材の仕込みを始める時刻</label><select id="sprep">${tOpts(g.prepStart)}</select><div class="hint" id="sprepHint"></div></div>
  <div><label for="sstart">組み立てを始める時刻</label><select id="sstart">${tOpts(g.start)}</select><div class="hint">早いほど締め切りに余裕があるが、レタスの水がパンにしみる時間が長くなる（朝8:00に売れるとして数える）</div></div>
  <div><label>作業室の温度</label>${seg('sroom',A.room.opts.map(T=>[T,T+'℃']))}<div class="hint" id="sroomHint"></div></div>
  <div><label>具材のトレーの大きさ（1回に冷蔵庫から出す量）</label>${seg('stray',A.trays.map(n=>[n,n+'組分']))}<div class="hint" id="strayHint"></div></div>
  <div><label>ベルトの速さ（1分に何組）</label>${seg('sspeed',A.belt.speeds.map(v=>[v,v+'組']))}<div class="hint" id="sspeedHint"></div></div>
  <div><label>ベルトで具をのせる人数</label>${seg('sstaff',[2,3,4,5,6,7,8].map(n=>[n,n+'人']))}<div class="hint" id="sstaffHint"></div></div>
  <div><label>三角パックに詰める人数</label>${seg('spackers',[1,2,3,4].map(n=>[n,n+'人']))}<div class="hint" id="spackHint"></div></div>
  <div><label>レタスを選ぶ人数</label>${seg('ssorters',[1,2,3].map(n=>[n,n+'人']))}<div class="hint" id="ssortHint"></div></div>
  <div><label for="sspin">レタスの水切り（脱水機）</label><input type="range" id="sspin" min="${g.spin[0]}" max="${g.spin[1]}" step="1" style="width:100%"><div class="val"><span class="num" id="sspinVal"></span>分 <span class="hint" id="sspinHint"></span></div></div>
  <div><label for="sshime">締め（冷蔵庫で冷やしてから切る）</label><input type="range" id="sshime" min="${g.shime[0]}" max="${g.shime[1]}" step="5" style="width:100%"><div class="val"><span class="num" id="sshimeVal"></span>分 <span class="hint" id="sshimeHint"></span></div></div>
  <div><label>組み立ての順番</label>${seg('sorder',Object.entries(A.orders).filter(([k])=>k[0]!=='_').map(([k,o])=>[k,o.label]))}<div class="hint" id="sorderHint"></div></div>`;
  const mark=(id,v)=>{for(const b of $(id).children){const on=b.dataset.v===String(v);b.classList.toggle('on',on);b.setAttribute('aria-pressed',on);}};
  const sync=()=>{
    $('sseason').value=cfg.season;$('sprep').value=cfg.prepStart;$('sstart').value=cfg.start;$('sspin').value=cfg.spin;$('sshime').value=cfg.shime;
    $('sseasonHint').textContent=`チルドの部屋は冷房で温度を決めているので、季節の差は小さい。冷やす電気代は冬×0.7・夏×1.5`;
    $('sprepHint').textContent=`たまごサラダは1回${A.prep.egg.lot}組分を、スチーマー${A.prep.egg.steam}分→冷水で10℃まで→殻むき機${A.prep.egg.peel}分→人が確かめる${A.prep.egg.check}分→和える。合格の確認がすむと在庫になる。フルーツはできてから${A.prep.fruit.freshFree}分をこえると水が出る`;
    mark('sroom',cfg.room);const sm=SC.safeMin(A,cfg.room);
    $('sroomHint').textContent=`手の速さ ×${A.room.hand[String(cfg.room)]}。トレーは${isFinite(sm)?`${Math.round(sm)}分ほどで${A.cold.safe}℃をこえる`:`${A.cold.safe}℃をこえない`}。電気代 ${A.room.yen[String(cfg.room)]}円／分`;
    mark('stray',cfg.tray);$('strayHint').textContent=`大きいほど冷蔵庫へ取りに行く回数（1回${A.trip}分止まる）が減るが、台の上に長くいる。${A.cold.safe}℃をこえて${A.cold.free}分から減点、${A.cold.limit}分をこえた分は保留（品質確認の人が評価。${A.hold.release}分までなら減点つきで出す）`;
    mark('sspeed',cfg.speed);$('sspeedHint').textContent=`食パンの供給機が1枚ずつ並べて塗る。たまごサラダとクリームは盛り付け機。速いほど早く終わるが、のせる人が追いつかないとベルトはそこまで遅くなる`;
    {const hand=A.room.hand[String(cfg.room)]||1;mark('sstaff',cfg.staff);
      $('sstaffHint').textContent=`1人1分${A.belt.handRate}個（作業室${cfg.room}℃で×${hand}）。この人数だと ${A.kinds.map(k=>`${k.name}${Math.round(SC.beltRate(A,k,cfg.speed,cfg.staff,hand))}`).join('・')}組／分`;}
    mark('spackers',cfg.packers);$('spackHint').textContent=`カットは機械で1分${A.pack.cut}組（1組を2切れ）。詰めるのは1人1分 同じ具2切れ${A.pack.two}パック・ミックス3切れ${A.pack.mix}パック`;
    mark('ssorters',cfg.sorters);$('ssortHint').textContent=`1回${A.prep.lettuce.lot}組分を、1人1分${A.prep.lettuce.sortRate}組分ずつ葉を選ぶ → ${Math.ceil(A.prep.lettuce.lot/(cfg.sorters*A.prep.lettuce.sortRate))}分。そのあと洗い槽・殺菌${A.prep.lettuce.wash}分`;
    $('sspinVal').textContent=cfg.spin;const w=SC.waterLeft(A,cfg.spin);
    $('sspinHint').textContent=`水が${Math.round(w*100)}%残る${cfg.spin>A.water.bruise?`。${A.water.bruise}分をこえると葉が傷む`:w>0.3?'。パンにしみやすい':''}`;
    $('sshimeVal').textContent=cfg.shime;$('sshimeHint').textContent=cfg.shime<A.shime.good?`${A.shime.good}分より短いと、切るときに断面が崩れてはじく（いまは${Math.round((A.cut.reject+A.shime.maxReject*(1-cfg.shime/A.shime.good))*100)}%）`:'断面がきれいに切れる。長いほど包むのが遅くなる';
    if(LF){mark('sbread',cfg.bread);const own=cfg.bread==='own';$('sloafOpts').hidden=!own;
      $('sbreadHint').textContent=own?`作業の流れとしては、このサンドイッチのラインの一部。午後から角型（${LF.loafLabel}）を焼いて冷まし、組み立ての少し前から切って食パンの供給機へ送る。切れた枚数より速くは組み立てられない`:`切ってある食パンが届く（1枚${LF.cost.buySlice}円・具材の代金に入っている）。パンを待つことはない`;
      if(own){const S=D.seasons[cfg.season]||D.seasons.mid;const per=SL.slicesPer(LF,cfg.bthick);
        const kumi=Math.ceil(A.products.reduce((a,p)=>a+Math.ceil(A.forecast*p.share*(1+(A.spare||0)))*Object.values(p.pieces).reduce((x,y)=>x+y,0),0)/2);
        const sl=kumi*2,lv=SL.loavesFor(LF,sl,cfg.bthick,cfg.bspare),n=Math.ceil(lv/LF.batch);
        $('sbstart').value=cfg.bstart;
        $('sbstartHint').textContent=`見込み${A.forecast.toLocaleString()}パック → サンド約${kumi.toLocaleString()}組 → ${sl.toLocaleString()}枚。${cfg.bspare}%上乗せで${lv}本（1回${LF.batch}本×${n}回）。こねて一次発酵${LF.ferm1}分・型詰め・ホイロ（型の8分目まで）・焼成${LF.oven.bake}分のあと、冷ますのに約${Math.round(SL.coolMin(LF,cfg.bcool,S.room))}分`;
        mark('sbint',cfg.binterval);const f=SL.flow(LF,cfg);$('sbintHint').textContent=`1時間に${f.mixPerHour.toFixed(1)}回こねる。オーブン${cfg.bovens}台は1時間に${f.ovenPerHour.toFixed(1)}回焼ける${f.mixPerHour>f.ovenPerHour*1.05?'。こねるほうが速いので、ホイロに型がたまって膨らみすぎる':''}`;
        mark('sbovens',cfg.bovens);$('sbovensHint').textContent=`1台に1回＝型${LF.batch}本、${LF.oven.bake}分＋入れ出し${LF.oven.load}分。ホイロは${LF.proof.racks}回分まで。焼く番を待つあいだも膨らみ続ける`;
        mark('sbthick',cfg.bthick);$('sbthickHint').textContent=`1本（${LF.lenMm}mm、耳${LF.heelMm}mmずつ落とす）から${per}枚。薄いほど本数は少なくてすむが、供給機でパンが重なって詰まりやすい（×${LF.feederJam[String(cfg.bthick)]}）`;
        mark('sbcool',cfg.bcool);const c=SL.coolOf(LF,cfg.bcool,S.room);$('sbcoolHint').textContent=`芯が${LF.cool.slice}℃まで下がらないと切れない（${S.label}の部屋は${S.room}℃）。${c.label}で約${Math.round(SL.coolMin(LF,cfg.bcool,S.room))}分${c.yen?`・電気代${c.yen}円／分`:''}。冷ます棚は${LF.cool.racks}本まで`;
        mark('sbspare',cfg.bspare);$('sbspareHint').textContent=`パンは午後、注文（20:00）より前に焼く。足りないと20:00に追加でこねるが、冷めて切れるのは遅くなる。多いと余る`;}
      buildSpec();}
    mark('sorder',cfg.order);const sq=A.orders[cfg.order].seq;const lg=[];for(let k=1;k<sq.length;k++){const l=SC.washLeft(A,sq[k-1],sq[k]);if(l.length)lg.push(`${Kd(sq[k-1]).name}→${Kd(sq[k]).name}（${l.join('・')}）`);}
    $('sorderHint').textContent=`${sq.map(id=>Kd(id).name).join('→')}。全部洗う長い洗浄 ${lg.length}回${lg.length?'：'+lg.join('、'):''}。切り替えのたびに下げる${A.change.clear}分と初品確認${A.qc.first+A.qc.label}分`;
  };
  $('sseason').onchange=e=>{cfg.season=e.target.value;sync();};
  $('sprep').onchange=e=>{cfg.prepStart=+e.target.value;sync();};$('sstart').onchange=e=>{cfg.start=+e.target.value;sync();};
  $('sspin').oninput=e=>{cfg.spin=+e.target.value;sync();};$('sshime').oninput=e=>{cfg.shime=+e.target.value;sync();};
  for(const b of $('sroom').children)b.onclick=()=>{cfg.room=+b.dataset.v;sync();};
  for(const b of $('stray').children)b.onclick=()=>{cfg.tray=+b.dataset.v;sync();};
  for(const b of $('sstaff').children)b.onclick=()=>{cfg.staff=+b.dataset.v;sync();};
  for(const b of $('sspeed').children)b.onclick=()=>{cfg.speed=+b.dataset.v;sync();};
  for(const b of $('spackers').children)b.onclick=()=>{cfg.packers=+b.dataset.v;sync();};
  for(const b of $('ssorters').children)b.onclick=()=>{cfg.sorters=+b.dataset.v;sync();};
  for(const b of $('sorder').children)b.onclick=()=>{cfg.order=b.dataset.v;sync();};
  if(LF){for(const b of $('sbread').children)b.onclick=()=>{cfg.bread=b.dataset.v;sync();};$('sbstart').onchange=e=>{cfg.bstart=+e.target.value;sync();};
    for(const [id,k,num] of [['sbint','binterval',1],['sbovens','bovens',1],['sbthick','bthick',1],['sbcool','bcool',0],['sbspare','bspare',1]])for(const b of $(id).children)b.onclick=()=>{cfg[k]=num?+b.dataset.v:b.dataset.v;sync();};}
  sync();}

/* ---------------- 回す・再生 ---------------- */
function run(keepTime){if(R)prev={cfg:R.cfg,summary:R.summary};R=SC.simulate(D,cfg);resultShown=false;evCount=-1;
  $('sscrub').max=R.N-1;if(!keepTime)cur=0;cur=Math.min(cur,R.N-1);
  $('snightInfo').textContent=`夜の番号 ${cfg.seed}（同じ番号なら同じ注文。条件だけ変えて比べられます）`;
  $('sresult').hidden=true;$('sresultWait').hidden=false;save();drawAll(true);}
function buildPlay(){$('sspeeds').innerHTML=SPEEDS.map(([v,l])=>`<button data-v="${v}">${l}</button>`).join('');
  for(const b of $('sspeeds').children)b.onclick=()=>{speed=+b.dataset.v;markSpeed();};markSpeed();
  $('splayBtn').onclick=()=>{playing=!playing;if(playing&&cur>=R.N-1)cur=0;markPlay();lastFrame=performance.now();};
  $('sscrub').oninput=e=>{cur=+e.target.value;drawAll(true);};$('speek').onclick=()=>showResult();}
function markSpeed(){for(const b of $('sspeeds').children){const on=+b.dataset.v===speed;b.classList.toggle('on',on);b.setAttribute('aria-pressed',on);}}
function markPlay(){$('splayBtn').textContent=playing?'❚❚ 止める':'▶ 再生';$('splayBtn').setAttribute('aria-label',playing?'止める':'再生');}
function tick(now){if(active&&playing&&R){const dt=Math.min(0.25,(now-lastFrame)/1000);cur+=dt*speed/60;if(cur>=R.N-1){cur=R.N-1;playing=false;markPlay();}drawAll(false);}
  lastFrame=now;requestAnimationFrame(tick);}
function drawAll(force){if(!R||!active)return;const i=Math.floor(cur);
  if(force){const ln=$('lineName');if(ln&&ln.textContent!==A.line)ln.textContent=A.line;}
  $('sscrub').value=i;$('sclock').textContent=hm(R.T0+i);drawStage();
  if(force||i!==lastSide){lastSide=i;drawClocks(i);drawEvents(i);drawTray();drawGantt();if(i>=R.N-1&&!resultShown)showResult();}}

/* ---------------- 4つの時計 ---------------- */
const QC_TEXT={0:'手が空いている',1:'初品確認・表示の照合',2:'冷却・洗浄・配合の確認',3:'保留の評価'};
const JAM_TEXT={1:'食パンの供給機が詰まった',2:'盛り付け機が詰まった',3:'殻のかけら・ホッパーを洗う'};
function codeText(c,i){if(c===LC.JAM&&i!=null&&R.agg.jam[i])return 'ベルトが止まっている：'+JAM_TEXT[R.agg.jam[i]];
  return codeText0(c);}
function codeText0(c){return c>=0&&c<5?`${A.kinds[c].name}を組み立て中`:c===LC.CLEAR?'切り替え：具材・ラベル・包材を下げる':c===LC.CHANGE?'切り替え：洗浄':c===LC.QC?'初品確認を待っている':c===LC.CLEAN?'終業の分解洗浄':c===LC.TRIP?'冷蔵庫へトレーを取りに行く':c===LC.WAIT?'具材を待っている':c===LC.BREAD?'食パンが切れるのを待っている':c===LC.JAM?'ベルトが止まっている':c===LC.DONE?'組み立ては終わり':'まだ始まっていない';}
function drawClocks(i){const a=R.agg,T=a.trayT[i];const st=a.st;
  const bt=a.bathT[i],ct=a.chillT[i];
  $('sclocks').innerHTML=`
   <div class="clk"><b>冷たさの時計（トレー）</b><span class="v">${isNaN(T)?'台にトレーはない':`<span class="num" style="color:${T>A.cold.safe?css('--bad'):'inherit'}">${T.toFixed(1)}℃</span>・${A.cold.safe}℃こえ <span class="num">${a.trayExp[i]}</span>分`}</span><div class="small muted">作業室 ${R.cfg.room}℃・冷蔵庫 ${A.cold.fridge}℃</div></div>
   <div class="clk"><b>熱の時計（冷ます）</b><span class="v">氷水 ${bt.length?bt.map(x=>x.toFixed(0)+'℃').join('・'):'空き'}</span><div class="small muted">急速冷却 ${ct.length?ct.map(x=>x.toFixed(0)+'℃').join('・'):'空き'}・${A.cold.safe}℃で次へ</div></div>
   <div class="clk"><b>水の時計（レタス）</b><span class="v">水切り${R.cfg.spin}分・残る水 <span class="num">${Math.round(R.summary.water*100)}%</span></span><div class="small muted">${st.wash[i]?'いま洗って水切りしている':'レタスの在庫 '+Math.floor(a.stock.lettuce[i])+'組分'}</div></div>
   <div class="clk"><b>品質確認の人</b><span class="v">${QC_TEXT[a.qc[i]]}</span><div class="small muted">確認を待つ仕事 <span class="num" style="color:${a.qcq[i]?css('--warn'):'inherit'}">${a.qcq[i]}</span>件・保留 <span class="num">${Math.round(a.hold[i])}</span>組</div></div>
   ${R.summary.own?loafClock(i):''}
   <div class="clk"><b>ベルトの時計</b><span class="v">${a.line[i]>=0&&a.line[i]<5?`1分 <span class="num">${a.rate[i].toFixed(0)}</span>組（${R.cfg.speed}組に設定）`:codeText(a.line[i],i)}</span><div class="small muted">組み立てた <span class="num">${Math.floor(a.made[i]).toLocaleString()}</span>組・締め中 <span class="num">${Math.floor(a.shime[i])}</span>組</div></div>`;}

function loafClock(i){const z=R.agg.loaf[i],L=A.loaf;if(!z)return '';const on=z.oven.filter(f=>f>=0).length;
  const now=z.cool+z.cooled?`棚 <span class="num">${z.cool+z.cooled}</span>本（芯 ${isNaN(z.hot)?'—':Math.round(z.hot)}${z.cool&&z.hot!==z.cold?'〜'+Math.round(z.cold):''}℃）`:on?`焼成 ${on}台`:z.proof+z.oq?`ホイロ 進み${z.p2.toFixed(2)}`:z.ferm+z.shape+z.mix?'こねて発酵中':'—';
  return `<div class="clk"><b>パンの時計（角型）</b><span class="v">${now}</span><div class="small muted">切ってある <span class="num" style="color:${z.slices<2&&R.agg.line[i]===LC.BREAD?css('--bad'):'inherit'}">${Math.floor(z.slices)}</span>枚・使った <span class="num">${Math.floor(z.used).toLocaleString()}</span>枚・${L.cool.slice}℃で切れる</div></div>`;}

/* ---------------- 工程の絵 ---------------- */
const TITLES={loaf:'サンドイッチ用食パン（角型）：こねる → ホイロ → オーブン → 冷ます → スライス → 供給機へ',egg:'たまごサラダ（スチーマー・殻むき機）',lettuce:'レタス（選ぶ・洗う・水切り）',katsu:'カツ（揚げる・急速冷却）',fruit:'フルーツ・ツナサラダ',fridge:'冷蔵庫（具材の在庫）',line:'組み立てのベルト',shime:'締め（冷蔵）',pack:'カット・パック詰め'};
function layout(w,own){if(w<640){const ks=(own?['loaf']:[]).concat(['egg','lettuce','katsu','fruit','fridge','line','shime','pack']);const hs={loaf:380,egg:190,lettuce:190,katsu:200,fruit:175,fridge:220,line:250,shime:150,pack:150};const box={};let y=30;
    for(const k of ks){box[k]=[12,y,376,hs[k]];y+=hs[k]+20;}return {W:400,H:y,box};}
  const L={W:1040,H:530,box:{egg:[16,34,300,210],lettuce:[332,34,220,210],katsu:[568,34,240,210],fruit:[824,34,200,210],fridge:[16,272,220,244],line:[252,272,440,244],shime:[708,272,170,244],pack:[894,272,130,244]}};
  if(own){L.box.loaf=[16,532,1008,190];L.H=736;}return L;}
function rr(c,x,y,w,h,r){c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();}
function txt(c,s,x,y,o){o=o||{};c.fillStyle=o.color||css('--ink');c.font=(o.bold?'bold ':'')+(o.size||12)+'px '+(o.num?css('--f-num'):css('--f-body'));c.textAlign=o.align||'left';c.textBaseline='alphabetic';c.fillText(s,x,y);c.textAlign='left';}
function frame(c,[x,y,w,h],title){c.fillStyle=css('--paper');c.strokeStyle=css('--line');c.lineWidth=1;rr(c,x,y,w,h,8);c.fill();c.stroke();txt(c,title,x+8,y+19,{bold:true,size:12.5});}
function person(c,x,y,col){c.fillStyle=col;c.beginPath();c.arc(x,y,4.5,0,7);c.fill();rr(c,x-5,y+6,10,10,3);c.fill();}
function bar(c,x,y,w,h,f,col){c.fillStyle=css('--line');c.fillRect(x,y,w,h);c.fillStyle=col;c.fillRect(x,y,w*Math.max(0,Math.min(1,f)),h);}
const lotAt=(ing,t,fn)=>R.lots.find(l=>l.ing===ing&&fn(l,t));
function drawStage(){const cv=$('sstage');const cw=cv.clientWidth||cv.parentNode.clientWidth;if(!cw)return;const L=layout(cw,R.summary.own);
  const dpr=window.devicePixelRatio||1,scale=cw/L.W;const nW=Math.round(cw*dpr),nH=Math.round(L.H*scale*dpr);
  if(cv.width!==nW||cv.height!==nH){cv.width=nW;cv.height=nH;cv.style.height=(L.H*scale)+'px';}
  const c=cv.getContext('2d');c.setTransform(dpr*scale,0,0,dpr*scale,0,0);c.clearRect(0,0,L.W,L.H);
  const i=Math.floor(cur),t=R.T0+cur;
  txt(c,`${hm(t)}　${R.season.label}の夜・作業室${R.cfg.room}℃${t>=D.orderConfirm?`・注文 ${R.summary.order.toLocaleString()}パック`:`・見込み ${A.forecast.toLocaleString()}パック`}`,8,18,{size:12,color:css('--muted')});
  for(const k in L.box)frame(c,L.box[k],k==='loaf'&&cw<640?'サンドイッチ用食パン（角型）':TITLES[k]);
  drawEgg(c,L.box.egg,i,t);drawLettuce(c,L.box.lettuce,i,t);drawKatsu(c,L.box.katsu,i,t);drawFruit(c,L.box.fruit,i,t);
  drawFridge(c,L.box.fridge,i);drawLine(c,L.box.line,i,t);drawShime(c,L.box.shime,i);drawPack(c,L.box.pack,i,t);if(L.box.loaf)drawLoaf(c,L.box.loaf,i,t,cw<640);}
/* 角型の食パン：工程と「使えるパンの枚数」の目盛り */
function loafPan(c,x,y,w,h,rise,col){c.strokeStyle='#5b6670';c.lineWidth=1.5;c.strokeRect(x,y,w,h);c.lineWidth=1;const f=Math.max(0,Math.min(1.15,rise));c.fillStyle=col;c.fillRect(x+1.5,y+h-h*f*0.85+ (f>1?0:0),w-3,Math.min(h-1.5,h*f*0.85));}
function drawLoaf(c,[x,y,w,h],i,t,narrow){const z=R.agg.loaf[i],L=A.loaf;if(!z)return;const per=R.summary.loaf.per;
  const cols=narrow?[[x+8,y+30,(w-24)/2,100],[x+16+(w-24)/2,y+30,(w-24)/2,100],[x+8,y+140,(w-24)/2,100],[x+16+(w-24)/2,y+140,(w-24)/2,100]]:[[x+8,y+30,150,150],[x+166,y+30,190,150],[x+364,y+30,170,150],[x+542,y+30,170,150]];
  const head=([bx,by,bw],s)=>txt(c,s,bx+bw/2,by+12,{align:'center',size:10.5,bold:true});
  // こねる・発酵・型詰め
  {const [bx,by,bw,bh]=cols[0];head(cols[0],'こねる・発酵・型詰め');c.fillStyle=css('--steel');rr(c,bx+bw/2-22,by+20,44,32,6);c.fill();
    if(z.mix){c.fillStyle='#efe2c4';c.beginPath();c.arc(bx+bw/2,by+36,10+Math.sin(t*3)*2,0,7);c.fill();}
    txt(c,`発酵 ${z.ferm}本分・型詰め ${z.shape}本分`,bx+bw/2,by+70,{align:'center',size:9.5,color:css('--muted')});}
  // ホイロ
  {const [bx,by,bw,bh]=cols[1];head(cols[1],`ホイロ（${L.proof.T}℃・${L.proof.racks}回分）`);const n=Math.ceil((z.proof+z.oq)/L.batch);
    for(let k=0;k<L.proof.racks;k++){const px=bx+8+k*((bw-16)/L.proof.racks),pw=(bw-16)/L.proof.racks-6;const has=k<n;
      if(has)loafPan(c,px,by+28,pw,36,k===0?z.p2:z.p2*0.85,z.p2>L.quality.p2High?'#e0a34a':'#efe2c4');else{c.strokeStyle=css('--line');c.strokeRect(px,by+28,pw,36);}}
    txt(c,z.proof+z.oq?`いちばん進んだ型 ${z.p2.toFixed(2)}（1で焼ける）`:'空き',bx+bw/2,by+82,{align:'center',size:9.5,color:z.p2>L.quality.p2High?css('--warn'):css('--muted')});
    if(z.oq)txt(c,`焼く番を待つ ${z.oq}本`,bx+bw/2,by+bh-8,{align:'center',size:9.5,color:css('--warn')});}
  // オーブン
  {const [bx,by,bw,bh]=cols[2];head(cols[2],`オーブン（${z.oven.length}台・ふたをして${L.oven.bake}分）`);const ow=(bw-16)/z.oven.length-6;
    z.oven.forEach((f,k)=>{const ox=bx+8+k*(ow+6);c.fillStyle='#4a3a2e';rr(c,ox,by+24,ow,48,5);c.fill();c.fillStyle=f>=0?'#e08a3a':'#6d5d50';c.globalAlpha=f>=0?0.85:0.5;rr(c,ox+4,by+28,ow-8,30,3);c.fill();c.globalAlpha=1;
      txt(c,f<0?'空き':f>=1?'出せない':`あと${Math.ceil((1-f)*(L.oven.bake+L.oven.load))}分`,ox+ow/2,by+86,{align:'center',size:9.5,color:f>=1?css('--bad'):css('--muted')});});}
  // 冷ます棚
  {const [bx,by,bw,bh]=cols[3];head(cols[3],`冷ます（${R.summary.loaf.coolLabel}）`);const n=z.cool+z.cooled,cap=L.cool.racks;
    const cell=(bw-16)/24;for(let k=0;k<cap;k++){const cx=bx+8+(k%24)*cell,cy=by+24+Math.floor(k/24)*14;
      c.fillStyle=k<z.cooled?'#d9b98a':k<n?tempColor(isNaN(z.hot)?30:z.hot):css('--line');c.fillRect(cx,cy,cell-1.5,11);}
    txt(c,`${n}／${cap}本${n?`・芯 ${Math.round(z.hot)}${z.cool&&z.cold<z.hot?'〜'+Math.round(z.cold):''}℃`:''}`,bx+bw/2,by+92,{align:'center',size:10,bold:true});
    txt(c,`${L.cool.slice}℃まで下がった ${z.cooled}本（切れる）`,bx+bw/2,by+106,{align:'center',size:9.5,color:css('--muted')});}
  // 使えるパンの枚数（目盛り）
  {const gx=narrow?x+8:x+722,gy=narrow?y+250:y+30,gw=narrow?w-16:w-730,gh=narrow?100:150;txt(c,'使えるパンの枚数',gx+gw/2,gy+12,{align:'center',size:11,bold:true});
    const need=Math.max(0,2*(R.summary.kinds.reduce((a,k)=>a+k.target,0)-R.agg.made[i]));
    const seg=[['切ってある',z.slices,'#2e7d4f'],['冷めて切れる',z.cooled*per,'#8fb87a'],['冷ましている',z.cool*per,'#e0a34a'],['焼いている・ホイロ',(z.proof+z.oq)*per+z.oven.filter(f=>f>=0).length*L.batch*per,'#c7b9a6']];
    const mx=Math.max(need,seg.reduce((a,s)=>a+s[1],0),1);const bx=gx+8,bw=gw-16,by=gy+24,bh=18;let xx=bx;
    c.fillStyle=css('--line');c.fillRect(bx,by,bw,bh);for(const [,v,col] of seg){const ww=bw*v/mx;c.fillStyle=col;c.fillRect(xx,by,ww,bh);xx+=ww;}
    // 目盛り（100枚ごと・これから要る枚数）
    c.fillStyle=css('--ink');const step=mx>2000?500:mx>800?200:100;for(let v=0;v<=mx;v+=step){const tx=bx+bw*v/mx;c.fillRect(tx,by+bh,1,v%(step*2)?3:6);if(v%(step*2)===0)txt(c,String(v),tx,by+bh+16,{align:'center',size:8.5,num:true,color:css('--muted')});}
    if(need){const nx=bx+bw*need/mx;c.fillStyle=css('--bad');c.fillRect(nx-1,by-5,2,bh+10);}
    txt(c,`切ってある ${Math.floor(z.slices)}枚＝${Math.floor(z.slices/2)}組分`,gx+8,by+bh+34,{size:10.5,bold:true,color:R.agg.line[i]===LC.BREAD?css('--bad'):css('--ink')});
    txt(c,`赤い線：これから要る ${Math.round(need).toLocaleString()}枚（1組に2枚）`,gx+8,by+bh+50,{size:9.5,color:css('--muted')});
    if(!narrow){let ly=by+bh+68;for(const [lab,v,col] of seg){c.fillStyle=col;c.fillRect(gx+8,ly-8,10,8);txt(c,`${lab} ${Math.round(v).toLocaleString()}枚`,gx+22,ly,{size:9.5,color:css('--muted')});ly+=14;}}}
  txt(c,`1本${per}枚（${R.cfg.bthick}mm）・この夜に焼く${R.summary.loaf.loaves}本・使った ${Math.floor(z.used).toLocaleString()}枚`,x+8,y+h-9,{size:10,color:css('--muted')});}
function slot(c,x,y,w,h,T,label){if(T==null){c.strokeStyle=css('--line');rr(c,x,y,w,h,5);c.stroke();txt(c,'空き',x+w/2,y+h/2+4,{align:'center',size:10,color:css('--muted')});return;}
  c.fillStyle=tempColor(T);rr(c,x,y,w,h,5);c.fill();c.fillStyle='rgba(255,255,255,.6)';c.fillRect(x+3,y+3,w-6,h-6);
  txt(c,label,x+w/2,y+h/2-2,{align:'center',size:10,bold:true,color:'#18263a'});txt(c,T.toFixed(0)+'℃',x+w/2,y+h/2+11,{align:'center',size:10,num:true,color:'#18263a'});}
function drawEgg(c,[x,y,w,h],i,t){const PE=A.prep.egg;const gw=(w-28)/4;
  const steam=lotAt('egg',t,(l,t)=>l.tBoil<=t&&(l.tBath==null||t<l.tBath));
  const col=(k,title)=>{const bx=x+8+k*(gw+4);txt(c,title,bx+gw/2,y+56,{align:'center',size:10.5,bold:true});return bx;};
  // スチーマー
  {const bx=col(0,'スチーマー'),by=y+66;c.fillStyle=css('--steel');rr(c,bx,by,gw,70,6);c.fill();c.fillStyle='#d7dde2';rr(c,bx+4,by+4,gw-8,46,4);c.fill();
    if(steam){for(let k=0;k<6;k++){c.fillStyle='#fbf6ea';c.beginPath();c.ellipse(bx+10+(k%3)*(gw-20)/2,by+16+Math.floor(k/3)*20,5,7,0,0,7);c.fill();}
            const el=t-steam.tBoil;txt(c,el<PE.steam?`あと${Math.ceil(PE.steam-el)}分`:'冷水の空き待ち',bx+gw/2,by+92,{align:'center',size:9.5,color:el<PE.steam?css('--muted'):css('--bad')});}}
  // 冷水のシャワー
  {const bx=col(1,'冷水'),by=y+66;const ts=R.agg.bathT[i];for(let k=0;k<PE.bath;k++)slot(c,bx,by+k*40,gw,34,ts[k]!=null?ts[k]:null,'卵');}
  // 殻むき機
  {const bx=col(2,'殻むき機'),by=y+66;c.fillStyle=css('--steel');rr(c,bx,by,gw,50,6);c.fill();const pl=lotAt('egg',t,(l,t)=>l.tPeel!=null&&l.tPeel<=t&&(l.tCheck==null||t<l.tCheck));
    for(let k=0;k<4;k++){c.fillStyle=pl?'#2e7d4f':'#7d8792';c.fillRect(bx+6,by+8+k*10,gw-12,4);}
    if(pl){for(let k=0;k<3;k++){const u=((t*0.8+k/3)%1);c.fillStyle='#fbf6ea';c.beginPath();c.ellipse(bx+6+u*(gw-12),by+24,5,6,0,0,7);c.fill();}txt(c,`あと${Math.max(0,Math.ceil(PE.peel-(t-pl.tPeel)))}分`,bx+gw/2,by+66,{align:'center',size:9.5,color:css('--muted')});}}
  // 人が確かめる → 和える
  {const bx=col(3,'確かめる'),by=y+66;person(c,bx+gw/2,by+6,'#5d7896');const ck=lotAt('egg',t,(l,t)=>l.tCheck!=null&&l.tCheck<=t&&(l.tReady==null||t<l.tReady));
    if(ck){const f=(t-ck.tCheck)/(PE.check+PE.mixMin);bar(c,bx,by+34,gw,7,f,'#f4dc86');txt(c,f*(PE.check+PE.mixMin)<PE.check?'殻・割れを手で':'マヨネーズと混ぜる',bx+gw/2,by+56,{align:'center',size:9.5});}}
  const done=R.lots.filter(l=>l.ing==='egg'&&l.tReady!=null&&l.tReady<=t).length,all=R.lots.filter(l=>l.ing==='egg'&&l.t0<=t).length;
  txt(c,`合格 ${done}／${all}回（1回${PE.lot}組分）`,x+8,y+h-9,{size:10.5,color:css('--muted')});}
function drawLettuce(c,[x,y,w,h],i,t){const PLt=A.prep.lettuce;const l=lotAt('lettuce',t,(l,t)=>l.tWash<=t&&(l.tReady==null||t<l.tReady));
  const sortMin=Math.ceil(PLt.lot/(R.cfg.sorters*PLt.sortRate));const el=l?t-l.tWash:0;const ph=!l?-1:el<sortMin?0:el<sortMin+PLt.wash?1:2;
  for(let k=0;k<R.cfg.sorters;k++)person(c,x+w/2-(R.cfg.sorters-1)*9+k*18,y+38,'#5d7896');
  const cx=x+w/2,cy=y+112,r=40;c.fillStyle=css('--steel');c.beginPath();c.arc(cx,cy,r,0,7);c.fill();c.fillStyle=css('--sheet');c.beginPath();c.arc(cx,cy,r-6,0,7);c.fill();
  if(l){c.fillStyle='#9cc56a';for(let k=0;k<7;k++){const a=(ph===2?t*6:0)+k*0.9;c.beginPath();c.ellipse(cx+Math.cos(a)*18,cy+Math.sin(a)*18,9,6,a,0,7);c.fill();}
    if(ph===1){c.fillStyle=css('--water');c.globalAlpha=0.5;c.beginPath();c.arc(cx,cy,r-8,0,7);c.fill();c.globalAlpha=1;}
    txt(c,ph===0?`葉を選ぶ あと${Math.ceil(sortMin-el)}分`:ph===1?`洗い槽・殺菌 あと${Math.ceil(sortMin+PLt.wash-el)}分`:`脱水機 あと${Math.max(0,Math.ceil(sortMin+PLt.wash+R.cfg.spin-el))}分`,cx,y+172,{align:'center',size:10.5});}
  else txt(c,'—',cx,cy+4,{align:'center',size:11,color:css('--muted')});
  txt(c,`残る水 ${Math.round(R.summary.water*100)}%`,x+8,y+h-9,{size:10.5,color:R.summary.water>0.3?css('--warn'):css('--muted')});}
function drawKatsu(c,[x,y,w,h],i,t){const PK=A.prep.katsu;const gw=(w-24)/2;
  const f=lotAt('katsu',t,(l,t)=>l.tFry<=t&&(l.tChill==null||t<l.tChill));
  {const bx=x+8,by=y+36;txt(c,'フライヤー',bx+gw/2,by+22,{align:'center',size:11,bold:true});c.fillStyle='#6b5a3a';rr(c,bx,by+30,gw,70,6);c.fill();c.fillStyle='#d9a441';c.globalAlpha=f?0.8:0.3;rr(c,bx+6,by+36,gw-12,50,4);c.fill();c.globalAlpha=1;
    if(f){for(let k=0;k<3;k++){c.fillStyle='#b37a3a';rr(c,bx+12+k*(gw-24)/3,by+50,(gw-24)/3-6,20,4);c.fill();}const el=t-f.tFry;
      txt(c,el<PK.fry?`揚げる あと${Math.ceil(PK.fry-el)}分`:'冷却機の空き待ち',bx+gw/2,by+118,{align:'center',size:10,color:el<PK.fry?css('--muted'):css('--bad')});}}
  {const bx=x+16+gw,by=y+36;txt(c,'急速冷却機',bx+gw/2,by+22,{align:'center',size:11,bold:true});const ts=R.agg.chillT[i];
    for(let k=0;k<PK.chill;k++)slot(c,bx,by+30+k*44,gw,38,ts[k]!=null?ts[k]:null,'カツ');}
  txt(c,`${PK.air}℃の風で${A.cold.safe}℃まで`,x+8,y+h-9,{size:10.5,color:css('--muted')});}
function drawFruit(c,[x,y,w,h],i,t){const PF=A.prep.fruit;const l=R.lots.find(z=>(z.ing==='fruit'||z.ing==='tuna')&&z.tF<=t&&(z.tQC==null||t<z.tQC));
  person(c,x+w/2,y+48,'#5d7896');c.fillStyle=css('--sheet');c.strokeStyle=css('--line');rr(c,x+16,y+70,w-32,44,6);c.fill();c.stroke();
  if(l&&l.ing==='fruit'){const cols=['#e0475b','#8cbf3f','#f2a33a','#fbf6ea'];for(let k=0;k<8;k++){c.fillStyle=cols[k%4];c.beginPath();c.arc(x+30+k*((w-60)/7),y+92,6,0,7);c.fill();}
    bar(c,x+16,y+124,w-32,7,(t-l.tF)/PF.min,'#f5c9d0');txt(c,'クリームを泡立て、果物を切る',x+w/2,y+148,{align:'center',size:10});}
  else if(l){for(let k=0;k<5;k++){c.fillStyle='#b9c2ca';rr(c,x+26+k*((w-62)/4),y+80,18,24,3);c.fill();c.fillStyle='#d9c7a0';c.fillRect(x+28+k*((w-62)/4),y+86,14,10);}
    bar(c,x+16,y+124,w-32,7,(t-l.tF)/A.prep.tuna.min,'#d9c7a0');txt(c,'ツナの油を切って、マヨネーズと混ぜる',x+w/2,y+148,{align:'center',size:10});}
  else txt(c,'—',x+w/2,y+96,{align:'center',size:11,color:css('--muted')});
  const old=R.agg.stock.fruit[i]>0&&R.lots.some(z=>z.ing==='fruit'&&z.tReady!=null&&z.tReady<=t-PF.freshFree);
  txt(c,old?`フルーツに、できてから${PF.freshFree}分をこえた山がある`:'同じ係がフルーツとツナを受け持つ',x+8,y+h-9,{size:10,color:old?css('--warn'):css('--muted')});}
function drawFridge(c,[x,y,w,h],i){const a=R.agg.stock;const names={egg:'たまご',tuna:'ツナ',lettuce:'レタス',katsu:'カツ',fruit:'フルーツ'};
  const mx=Math.max(1,...SC.ING.map(g=>A.prep[g].lot*2));
  SC.ING.forEach((g,k)=>{const by=y+34+k*36,v=a[g][i];txt(c,names[g],x+10,by+12,{size:11,bold:true});bar(c,x+76,by+3,w-90,12,v/mx,css('--water2'));
    txt(c,`${Math.floor(v)}組分`,x+76,by+28,{size:10,color:css('--muted')});});
  txt(c,`${A.cold.fridge}℃・合格したものだけ・ハムは切って届く`,x+10,y+h-9,{size:10.5,color:css('--muted')});}
function lastProd(i){for(let k=i;k>=0;k--){const c=R.agg.line[k];if(c>=0&&c<5)return c;}return null;}
function drawLine(c,box,i,t){const [x,y,w,h]=box;const code=R.agg.line[i];const T=R.agg.trayT[i];
  const by=y+118;c.fillStyle=css('--steel');c.fillRect(x+12,by,w-24,8);
  // 食パンの供給機（1枚ずつ並べてマーガリンを塗る）
  c.fillStyle=css('--steel');rr(c,x+12,by-56,44,48,5);c.fill();for(let k=0;k<5;k++){c.fillStyle='#f3e8cf';c.fillRect(x+16,by-51+k*8,36,6);}
  txt(c,'食パン',x+34,by-62,{align:'center',size:10,bold:true});const own=R.summary.own&&R.agg.loaf[i];txt(c,own?`供給機 ${Math.floor(R.agg.loaf[i].slices)}枚`:'供給機',x+(own?10:34),by+22,{align:own?'left':'center',size:9.5,bold:!!own,color:R.agg.jam[i]===1||(own&&code===LC.BREAD)?css('--bad'):css('--muted')});
  const pk=code>=0&&code<5?code:lastProd(i);const p=pk!=null?A.kinds[pk]:null;
  if(p){const st=p.stations,x0=x+70,x1=x+w-14,gw=(x1-x0)/st.length;const n=R.cfg.staff,hn=p.hands;const per=[];for(let k=0;k<hn;k++)per.push(Math.floor(n/hn)+(k<n%hn?1:0));let hk=0;
    st.forEach((name,k)=>{const sx=x0+gw*(k+0.5);const mach=!/（人）/.test(name);
      if(mach){c.fillStyle=css('--steel');rr(c,sx-17,by-52,34,42,5);c.fill();c.fillStyle=p.color;c.fillRect(sx-4,by-14,8,10);if(R.agg.jam[i]===2&&/盛り付け機/.test(name)){c.strokeStyle=css('--bad');c.lineWidth=2.5;rr(c,sx-19,by-54,38,46,6);c.stroke();c.lineWidth=1;}}
      else{const m=per[hk++]||0;for(let q=0;q<Math.min(4,m);q++)person(c,sx-(Math.min(4,m)-1)*6+q*12,by-34,'#5d7896');if(m>4)txt(c,`×${m}`,sx+22,by-24,{size:9.5,color:css('--muted')});}
      txt(c,name.replace(/（.*?）/g,'').replace('・ソース',''),sx,by-62,{align:'center',size:10,bold:true});txt(c,mach?'機械':'人',sx,by+22,{align:'center',size:9.5,color:css('--muted')});});}
  if(code>=0&&code<5){const sp=0.12+0.3*R.agg.rate[i]/30;for(let k=0;k<9;k++){const u=((t*sp+k/9)%1);const sx=x+16+u*(w-48);c.fillStyle='#f3e8cf';c.fillRect(sx,by-6,20,6);c.fillStyle=p.color;c.fillRect(sx+3,by-9,14,3);}}
  txt(c,codeText(code,i)+(code>=0&&code<5?`・1分${R.agg.rate[i].toFixed(0)}組`:''),x+w-10,y+19,{align:'right',size:11,bold:true,color:code===LC.WAIT||code===LC.BREAD||code===LC.JAM?css('--bad'):code===LC.CHANGE||code===LC.CLEAR||code===LC.QC?css('--warn'):css('--ink')});
  // トレー（温度の色と温度計）
  const tx=x+14,ty=y+152,tw=150,th=54;
  if(!isNaN(T)){c.fillStyle=tempColor(T);rr(c,tx,ty,tw,th,6);c.fill();c.fillStyle='rgba(255,255,255,.55)';c.fillRect(tx+4,ty+4,tw-8,th-8);
    txt(c,`具材のトレー ${T.toFixed(1)}℃`,tx+tw/2,ty+22,{align:'center',size:11,bold:true,color:'#18263a'});
    const e=R.agg.trayExp[i];txt(c,`${A.cold.safe}℃こえ ${e}分`,tx+tw/2,ty+40,{align:'center',size:10.5,color:e>A.cold.limit?'#a0201a':e>A.cold.free?'#8a5a00':'#18263a',bold:e>A.cold.free});}
  else{c.strokeStyle=css('--line');rr(c,tx,ty,tw,th,6);c.stroke();txt(c,'台にトレーはない',tx+tw/2,ty+32,{align:'center',size:10.5,color:css('--muted')});}
  // 温度計
  {const gx=tx+tw+24,gy=ty-4,gh=th+8,lo=0,hi=20;c.strokeStyle=css('--line');c.strokeRect(gx,gy,12,gh);
    const yv=v=>gy+gh-(gh*(Math.min(hi,Math.max(lo,v))-lo)/(hi-lo));c.fillStyle=css('--bad');c.fillRect(gx-4,yv(A.cold.safe),20,1.5);txt(c,`${A.cold.safe}℃`,gx+20,yv(A.cold.safe)+4,{size:9.5,color:css('--bad')});
    if(!isNaN(T)){c.fillStyle=tempColor(T);c.fillRect(gx+2,yv(T),8,gy+gh-yv(T));}
    txt(c,`部屋${R.cfg.room}℃`,gx+20,yv(R.cfg.room)+4,{size:9.5,color:css('--muted')});}
  txt(c,`のせる${R.cfg.staff}人・トレー${R.cfg.tray}組分・取りに行く ${R.summary.trips}回`,x+12,y+h-9,{size:10.5,color:css('--muted')});}
function drawShime(c,[x,y,w,h],i){const n=R.agg.shime[i];c.fillStyle=css('--water');c.globalAlpha=0.5;rr(c,x+12,y+34,w-24,h-80,6);c.fill();c.globalAlpha=1;
  const rows=Math.min(3*Math.floor((h-84)/24),Math.ceil(n/25));for(let k=0;k<rows;k++){c.fillStyle='#f3e8cf';c.fillRect(x+20+(k%3)*((w-40)/3),y+44+Math.floor(k/3)*24,(w-40)/3-6,16);}
  const hd=R.agg.hold[i];txt(c,`${Math.floor(n).toLocaleString()}組${hd?`・保留${Math.round(hd)}`:''}`,x+w/2,y+h-28,{align:'center',size:12,bold:true,num:true,color:hd?css('--bad'):css('--ink')});txt(c,`${R.cfg.shime}分冷やしてから切る`,x+w/2,y+h-9,{align:'center',size:10,color:css('--muted')});}
function drawPack(c,[x,y,w,h],i,t){const dl=D.deadline,ord=t>=D.orderConfirm?R.summary.order:A.forecast;const idx=Math.min(R.N-1,i),dI=Math.min(R.N-1,dl-R.T0);
  const made=Math.floor(t<dl?R.agg.packed[idx]:R.agg.packed[dI]);const p=Math.min(1,made/ord);
  // 切った切れの山（具ごと）
  const mx=Math.max(1,...A.kinds.map(k=>R.agg.pool[k.id][idx]));A.kinds.forEach((k,j)=>{const v=R.agg.pool[k.id][idx];const by=y+30+j*13;c.fillStyle=k.color;c.fillRect(x+10,by,Math.max(1,(w-50)*Math.min(1,v/Math.max(40,mx))),9);txt(c,`${Math.round(v)}`,x+w-8,by+8.5,{align:'right',size:9,num:true,color:css('--muted')});});
  const bx=x+12,bw=w-24,by=y+100,bh=h-150;
  c.strokeStyle=css('--line');c.strokeRect(bx,by,bw,bh);c.fillStyle=css('--ok');c.globalAlpha=0.75;c.fillRect(bx,by+bh*(1-p),bw,bh*p);c.globalAlpha=1;
  txt(c,made.toLocaleString(),x+w/2,by+bh+15,{align:'center',num:true,bold:true});txt(c,`／${ord.toLocaleString()}パック`,x+w/2,by+bh+28,{align:'center',size:9.5,color:css('--muted')});
  const left=dl-t;txt(c,left>0?`${hm(dl)}まで ${Math.floor(left/60)}:${String(Math.floor(left%60)).padStart(2,'0')}`:'締め切り後',x+w/2,y+h-9,{align:'center',size:10.5,bold:true,color:left>0&&left<60?css('--warn'):css('--ink')});}

/* ---------------- トレーの温度のグラフ ---------------- */
function drawTray(){const cv=$('strayChart');const cw=cv.clientWidth||460;if(!cw)return;const H=170,dpr=window.devicePixelRatio||1;
  if(cv.width!==Math.round(cw*dpr)){cv.width=Math.round(cw*dpr);cv.height=H*dpr;cv.style.height=H+'px';}
  const c=cv.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,cw,H);
  const a=Math.max(0,(R.summary.firstAsm||R.cfg.start)-R.T0-10),z=Math.min(R.N-1,Math.max(a+60,(R.summary.planDone||R.T1)-R.T0+10));
  const X=k=>34+(cw-44)*(k-a)/(z-a),Y=T=>H-20-(H-34)*(T-0)/22;
  c.font='9px '+css('--f-num');for(const T of [0,5,10,15,20]){c.strokeStyle=css('--line2');c.beginPath();c.moveTo(34,Y(T));c.lineTo(cw-10,Y(T));c.stroke();c.fillStyle=css('--muted');c.fillText(T+'℃',2,Y(T)+3);}
  c.fillStyle=css('--bad');c.fillRect(34,Y(A.cold.safe)-0.5,cw-44,1.5);
  c.setLineDash([4,3]);c.strokeStyle=css('--muted');c.beginPath();c.moveTo(34,Y(R.cfg.room));c.lineTo(cw-10,Y(R.cfg.room));c.stroke();c.setLineDash([]);
  for(let k=a;k<=z;k++){const cd=R.agg.line[k];if(cd>=0&&cd<5){c.fillStyle=A.kinds[cd].color;c.globalAlpha=0.55;c.fillRect(X(k),H-18,Math.max(1,X(k+1)-X(k)),6);c.globalAlpha=1;}
    else if(cd===LC.CHANGE||cd===LC.CLEAR||cd===LC.QC||cd===LC.WAIT||cd===LC.BREAD){c.fillStyle=cd===LC.WAIT||cd===LC.BREAD?css('--bad'):css('--warn');c.globalAlpha=0.5;c.fillRect(X(k),H-18,Math.max(1,X(k+1)-X(k)),6);c.globalAlpha=1;}}
  c.fillStyle=css('--muted');for(let tt=Math.ceil((R.T0+a)/30)*30;tt<=R.T0+z;tt+=30)if(tt%60===0)c.fillText(hm(tt),X(tt-R.T0)-12,H-2);
  const upto=Math.min(z,Math.floor(cur));c.strokeStyle=css('--focus');c.lineWidth=2;c.beginPath();let on=false;
  for(let k=a;k<=upto;k++){const T=R.agg.trayT[k];if(isNaN(T)){on=false;continue;}if(!on){c.moveTo(X(k),Y(T));on=true;}else c.lineTo(X(k),Y(T));}c.stroke();c.lineWidth=1;
  const i=Math.floor(cur);if(i>=a&&i<=z){c.fillStyle=css('--ink');c.fillRect(X(i)-0.5,8,1,H-26);}
  $('sTrayLegend').innerHTML=`<span><i style="background:${css('--focus')}"></i>台に出したトレーの温度（取りに行くたびに${A.cold.fridge}℃に戻る）</span><span><i style="background:${css('--bad')}"></i>${A.cold.safe}℃の線</span><span><i style="background:${css('--muted')}"></i>点線：作業室</span><span>下の帯：具の色＝組み立て・黄＝切り替えと初品確認・赤＝具材・食パン待ち</span>`;}

/* ---------------- 持ち場ごとの帯 ---------------- */
function drawGantt(){const cv=$('sgantt');const cw=cv.clientWidth||1000;if(!cw)return;const st=R.agg.st;
  const LZ=R.agg.loaf,lz=k=>LZ[k]||{};
  const loafRows=R.summary.own?[['パン こねる・発酵',k=>lz(k).mix?'#b08a5a':lz(k).ferm?'#e0cf9f':lz(k).shape?'#cdb68a':null],['パン ホイロ',k=>lz(k).oq?'#e0a34a':lz(k).proof?'#efe2c4':null],
    ['パン オーブン',k=>lz(k).oven&&lz(k).oven.some(f=>f>=1)?'#c23b3b':lz(k).oven&&lz(k).oven.some(f=>f>=0)?'#a0522d':null],['パン 冷ます',k=>lz(k).cool?'#e08a3a':lz(k).cooled?'#d9b98a':null],['パン スライス',k=>lz(k).slicing?'#2e7d4f':null]]:[];
  const rows=[...loafRows,['スチーマー',k=>st.boil[k]?'#e0a84a':null],['冷水',k=>st.bath[k]?'#7fb0de':null],['殻むき機',k=>st.peel[k]?'#9aa6b1':null],['確かめる',k=>st.check[k]?'#f4dc86':null],['レタス',k=>st.wash[k]?'#9cc56a':null],
    ['揚げる',k=>st.fry[k]?'#c98b3a':null],['急速冷却',k=>st.chill[k]?'#5aa0a8':null],['フルーツ・ツナ',k=>st.ft[k]===1?'#f5c9d0':st.ft[k]===2?'#d9c7a0':null],
    ['品質確認',k=>({1:'#2f7f8a',2:'#7fb0a8',3:'#c23b3b'})[R.agg.qc[k]]||null],
    ['組み立て',k=>{const c=R.agg.line[k];return c>=0&&c<5?A.kinds[c].color:c===LC.CHANGE||c===LC.CLEAR?css('--warn'):c===LC.QC?'#2f7f8a':c===LC.TRIP?css('--muted'):c===LC.WAIT||c===LC.BREAD?css('--bad'):c===LC.JAM?'#7a1f1f':c===LC.CLEAN?'#6d5b8a':null;}],
    ['締め',k=>R.agg.shime[k]>0?'#8db8d8':null],['カット',k=>R.agg.cut[k]>0?'#5d7896':null],['パック詰め',k=>R.agg.pack[k]>0?'#2e7d4f':null]];
  const rowH=cw<640?12:14,top=18,left=cw<640?80:96,H=top+rows.length*rowH+6;const dpr=window.devicePixelRatio||1;
  if(cv.width!==Math.round(cw*dpr)||cv.height!==Math.round(H*dpr)){cv.width=Math.round(cw*dpr);cv.height=Math.round(H*dpr);cv.style.height=H+'px';}
  const c=cv.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,cw,H);const X=k=>left+(cw-left-6)*k/(R.N-1);
  c.font='10px '+css('--f-num');c.textBaseline='top';for(let t=R.T0;t<=R.T1;t+=60){const x=X(t-R.T0);c.fillStyle=css('--muted');if(cw>=640||(t/60)%2===0)c.fillText(hm(t),x-12,2);c.fillStyle=css('--line2');c.fillRect(x,top-2,1,H-top);}
  c.fillStyle=css('--bad');c.fillRect(X(D.deadline-R.T0),top-4,2,H-top);c.fillRect(X(D.orderConfirm-R.T0),top-4,1,H-top);
  rows.forEach(([lab,fn],r)=>{const y=top+r*rowH;c.fillStyle=css('--muted');c.font=(cw<640?'9.5px ':'10.5px ')+css('--f-body');c.textBaseline='middle';c.fillText(lab,4,y+rowH/2);
    for(let k=0;k<R.N;k++){const col=fn(k);if(!col)continue;c.fillStyle=col;c.globalAlpha=k<=cur?1:0.22;c.fillRect(X(k),y+1,Math.max(1,X(k+1)-X(k)+0.3),rowH-3);}c.globalAlpha=1;});
  c.fillStyle=css('--focus');c.fillRect(X(cur)-1,top-4,2,H-top);
  $('sstLegend').innerHTML=A.kinds.map(k=>`<span><i style="background:${k.color}"></i>${k.name}</span>`).join('')+`<span><i style="background:${css('--warn')}"></i>切り替え（下げる・洗浄）</span><span><i style="background:#2f7f8a"></i>初品確認（品質確認の人）</span><span><i style="background:#7fb0a8"></i>冷却・洗浄・配合の確認</span><span><i style="background:#6d5b8a"></i>終業の分解洗浄</span><span><i style="background:${css('--muted')}"></i>トレーを取りに行く</span><span><i style="background:#7a1f1f"></i>ベルトが止まった（詰まり・殻）</span>${R.summary.own?`<span><i style="background:#e0a34a"></i>パン：焼く番を待つ・冷ましている</span><span><i style="background:#d9b98a"></i>パン：冷めて切るのを待つ</span><span><i style="background:#c23b3b"></i>パン：棚がいっぱいで出せない</span>`:''}<span><i style="background:${css('--bad')}"></i>具材・食パン待ち／赤い縦線：20:00 注文確定・${hm(D.deadline)} 締め切り</span>`;}

/* ---------------- 記録 ---------------- */
function drawEvents(i){const t=R.T0+i;const list=R.ev.filter(e=>e.t<=t);if(list.length===evCount)return;evCount=list.length;
  $('sevents').innerHTML=list.slice().reverse().map(e=>`<li class="${e.k}"><span class="num">${hm(e.t)}</span><span>${e.msg}</span></li>`).join('')||'<li class="muted">まだ何も起きていません。</li>';}

/* ---------------- 朝の答え合わせ ---------------- */
function showResult(){resultShown=true;const s=R.summary;$('sresultWait').hidden=true;const el=$('sresult');el.hidden=false;
  const p=prev&&prev.summary&&prev.summary.kinds?prev.summary:null,pc=p?prev.cfg:null;
  const diff=(a,b,good)=>{if(b==null)return '';const d=a-b;if(!d)return '<span class="muted">±0</span>';const better=good==='up'?d>0:d<0;return `<span class="${better?'up':'down'}">${d>0?'+':''}${d.toLocaleString()}</span>`;};
  const row=(label,a,b,good,fmt)=>`<tr><th>${label}</th><td class="r num">${fmt?fmt(a):a.toLocaleString()}</td>${p?`<td class="r num muted">${b==null?'—':(fmt?fmt(b):b.toLocaleString())}</td><td class="r num">${good?diff(a,b,good):''}</td>`:''}</tr>`;
  const same=p&&pc&&pc.seed===R.cfg.seed&&pc.season===R.cfg.season;const ch=p?changes(pc,R.cfg):[];
  const main=f=>{const w=f.why;const xs=[['冷たさ',w.cold],['水がしみた',w.water],['葉が傷んだ',w.bruise],['果物の水',w.fresh],['保留から出した',w.hold],['パンの乾き・型',w.bread||0]].filter(x=>x[1]>=0.5).sort((a,b)=>b[1]-a[1]);return xs.length?xs.map(x=>`${x[0]} −${Math.round(x[1])}`).join('・'):'減点なし';};
  const q=s.qc;const cleanOk=s.cleanEnd!=null&&s.cleanEnd<=s.cleanBy;
  el.innerHTML=`
   <p class="big">注文 <b class="num">${s.order.toLocaleString()}</b>パックのうち、<b class="num">${s.shipped.toLocaleString()}</b>パックを${hm(D.deadline)}までに包んでチルドで${D.ship.via}へ送れました。${s.short?`<span class="down">${s.short.toLocaleString()}パック足りません。</span>`:'<span class="up">全部そろいました。</span>'}</p>
   <div class="tw"><table class="fills"><thead><tr><th>品（パック）</th><th class="r">注文</th><th class="r">送れた</th><th class="r">足りない</th><th class="r">品質</th><th>減点の中身（平均）</th></tr></thead><tbody>
   ${s.prods.map(f=>`<tr><th>${f.name}</th><td class="r num">${f.order}</td><td class="r num">${f.shipped}</td><td class="r num">${f.short?`<span class="down">${f.short}</span>`:'<span class="muted">0</span>'}</td><td class="r">${f.rank} <span class="num muted">${f.score==null?'':f.score}</span></td><td class="small">${main(f)}</td></tr>`).join('')}
   </tbody></table></div>
   <div class="tw"><table class="fills"><thead><tr><th>作ったサンド（組）</th><th class="r">目標</th><th class="r">作った</th><th class="r">切るときにはじいた</th><th class="r">保留</th><th class="r">保留から捨てた</th><th class="r">残った切れ</th></tr></thead><tbody>
   ${s.kinds.map(k=>`<tr><th>${k.name}</th><td class="r num">${k.target}</td><td class="r num">${k.made}</td><td class="r num">${k.cutRej}</td><td class="r num">${k.holdN||'<span class="muted">0</span>'}</td><td class="r num">${k.holdBad?`<span class="down">${k.holdBad}</span>`:'<span class="muted">0</span>'}</td><td class="r num muted">${k.leftPieces}</td></tr>`).join('')}
   </tbody></table></div>
   ${s.loaf?loafResult(s):`<p class="small muted">食パンは仕入れ（切ってあるものが届く）。</p>`}
   <p class="small">品質確認の人：初品確認 ${q.first}回・冷却の合格 ${q.cool}回・洗浄と水切りの確認 ${q.wash}回・配合の確認 ${q.mix}回・保留の評価 ${q.hold}回（合わせて${q.busy}分）。確認を待ったのは、ライン ${q.waitLine}分・仕込み ${q.waitPrep}分。</p>
   <p class="small">ベルトが止まったのは、食パンの供給機の詰まり ${s.jams.feed}回・盛り付け機の詰まり ${s.jams.dep}回${s.jams.shell?`・<span class="down">たまごサラダに殻のかけら ${s.jams.shell}回（${s.shellLost}組分を捨てて作り直し）</span>`:''}、合わせて ${s.jams.min}分。品の切り替え ${s.changes}回（下げる・洗浄・初品確認）。</p>
   <p class="small">組み立て ${s.firstAsm?hm(s.firstAsm):'—'}〜${s.planDone?hm(s.planDone):'終わらず'}・最後のパック詰め ${s.lastPack?hm(s.lastPack):'—'}・終業の分解洗浄 ${s.cleanEnd?`${hm(s.cleanStart)}〜${hm(s.cleanEnd)}`:'—'}（目安 ${hm(s.cleanBy)}${s.cleanEnd?cleanOk?'・<span class="up">間に合った</span>':'・<span class="down">こえた</span>':''}）。いちばん待ったのは <b>${s.neck[1]?s.neck[0]:'特になし'}</b>（${s.neck[1]}分）。</p>
   <p class="small muted">消費期限：${s.expiry.label}。その夜の製造に決まった期限で、包装が遅れても延びません（期限を決めたときに確かめた範囲は包装から${s.expiry.maxH}時間まで${s.early?`。<span class="down">${hm(s.expiry.basisFrom)}より前に包んだ${s.early}パックは範囲の外なので出荷しない</span>`:''}）。作業室${R.cfg.room}℃（手の速さ ×${s.hand}）・レタスの水 ${Math.round(s.water*100)}%。</p>
   ${p?`<p class="small muted">右は前の夜（${same?'同じ夜・同じ注文':'<b>別の夜か季節なので注文が違います</b>'}）。${ch.length?'変えた条件：'+ch.join('、'):'条件は同じ'}</p>`:''}
   <table><thead><tr><th></th><th class="r">この夜</th>${p?'<th class="r">前の夜</th><th class="r">差</th>':''}</tr></thead><tbody>
   ${row('注文（パック）',s.order,p&&p.order)}${row('送れた',s.shipped,p&&p.shipped,'up')}${row('足りない',s.short,p&&p.short,'down')}${row('保留から捨てた（組）',s.bad,p&&p.bad,'down')}
   ${row('切るときにはじいた（組）',s.cutRej,p&&p.cutRej,'down')}${row(`${hm(D.deadline)}に間に合わなかった`,s.late,p&&p.late,'down')}${row('分解洗浄が終わった',s.cleanEnd||0,p&&p.cleanEnd,'down',v=>v?hm(v):'—')}
   ${row('人件費',s.yen.labor,p&&p.yen.labor,'down',yen)}${row('作業室を冷やす電気',s.yen.cold,p&&p.yen.cold,'down',yen)}${row('急速冷却機',s.yen.chill,p&&p.yen.chill,'down',yen)}${row('具材・パン・パック',s.yen.food,p&&p.yen.food,'down',yen)}${row('機械（仮）',s.yen.machine||0,p&&p.yen.machine,'down',yen)}${row('食パンを焼く（人・材料・オーブン・冷却）',s.yen.loaf||0,p&&p.yen.loaf,'down',yen)}${row('食パンを待った（分）',s.loaf?s.loaf.waitMin:0,p&&(p.loaf?p.loaf.waitMin:0),'down')}
   ${row('送れた1パックあたり',s.yen.perUnit||0,p&&p.yen.perUnit,'down',v=>v?v+'円':'—')}</tbody></table>
   <p class="note">待ちの内訳：${s.waits.map(w=>`${w[0]} ${w[1]}分`).join('・')}。費用は仮の目安です。条件を1つだけ変えて「この条件で夜を回す」を押すと、同じ夜（同じ注文）で比べられます。</p>`;
  save();}
function loafResult(s){const z=s.loaf,L=A.loaf;
  return `<p class="small"><b>食パン（角型）</b>：${z.mixed}回・${z.loaves}本をこねました（はじめの予定は${z.planned}本${z.late?`。<span class="down">20:00の注文で${z.late}回を追加</span>`:''}）。1本${z.per}枚（${z.thick}mm）で${z.sliced.toLocaleString()}枚を切り、${z.used.toLocaleString()}枚を使いました。余りは 切った${z.leftSlices}枚${z.leftLoaves?`・切らずに残った${z.leftLoaves}本`:''}${z.unbaked?`・<span class="down">焼けなかった${z.unbaked}本</span>`:''}${z.collapsed?`・<span class="down">腰折れで使えなかった${z.collapsed}本</span>`:''}。
   最初に焼いたのは${z.firstBake?hm(z.firstBake):'—'}、最初に切ったのは${z.firstSlice?hm(z.firstSlice):'—'}、最後に切ったのは${z.lastSlice?hm(z.lastSlice):'—'}。冷まし方は${z.coolLabel}（芯が${L.cool.slice}℃まで約${Math.round(z.coolMin)}分）。
   ${z.waitMin?`<span class="down">ベルトが食パンを待ったのは${z.waitMin}分</span>`:'<span class="up">ベルトが食パンを待つことはありませんでした</span>'}${z.rackFull?`・<span class="down">冷ます棚がいっぱいでオーブンから出せなかったのは${z.rackFull}分</span>`:''}${z.ovenWait?`・焼く番を待った型はのべ${z.ovenWait}分`:''}。型の点 ${z.score==null?'—':z.score}。費用 ${yen(z.yen.total)}（人 ${yen(z.yen.labor)}・材料 ${yen(z.yen.ing)}・オーブン ${yen(z.yen.oven)}${z.yen.cool?`・冷却室 ${yen(z.yen.cool)}`:''}）。仕入れの食パンの代金（1枚${L.cost.buySlice}円）は、使った枚数ぶん具材の代金から引いています。</p>`;}
/* ---------------- 商品規格（原材料・アレルゲン） ---------------- */
function buildSpec(){const el=$('sspec');if(!el)return;const sp=SC.spec(SC.sandFor(D,cfg));const L=A.allergenList;
  el.innerHTML=`<div class="tw"><table><thead><tr><th>品（1パック）</th><th>中身</th><th>原材料（この工場の設定）</th><th>アレルゲン</th></tr></thead><tbody>
   ${sp.map(x=>`<tr><th>${x.name}</th><td class="small">${x.pieces}切れ${x.kinds.length>1?`（${x.kinds.join('・')}を1切れずつ）`:''}${x.spec&&x.kinds.length<2?`・${x.spec}`:''}${x.kinds.length>1?`<br>チーズ：${x.cheese?'あり':'<b>なし</b>'}`:''}</td><td class="small">${x.parts.join('、')}</td>
     <td class="small"><b>${x.allergen.required.join('・')||'—'}</b>${x.allergen.recommended.length?`<br><span class="muted">${x.allergen.recommended.join('・')}</span>`:''}</td></tr>`).join('')}
   </tbody></table></div>
   <p class="note">太字は表示が義務の特定原材料（${L.required.length}品目）、細字は表示をすすめられている準ずるもの（${L.recommended.length}品目）。アレルゲンは原材料から集めていて、品を替えるときの洗浄の長さもここから決まります（前のサンドにあって次のサンドにないものがあれば全部洗う）。原材料とその表示はこの工場の架空の設定で、実在の製品の表示ではありません。実際の工場では、使う製品の表示で決めます。消費期限：${A.expiry.label}（その夜の製造に決まった期限）。</p>`;}

function changes(a,b){const out=[];const L={season:'季節',bread:'食パン',bstart:'食パンの仕込み',binterval:'こねる間隔',bovens:'角型のオーブン',bthick:'パンの厚み',bcool:'冷まし方',bspare:'パンの上乗せ',prepStart:'仕込みの開始',start:'組み立ての開始',room:'作業室',tray:'トレー',speed:'ベルト',staff:'のせる人',packers:'詰める人',sorters:'レタスを選ぶ人',spin:'水切り',shime:'締め',order:'順番'};
  const f=(k,v)=>v==null?'—':k==='bread'?(v==='own'?'自社で焼く':'仕入れ'):k==='bcool'?(A.loaf?A.loaf.cool[v].label:v):k==='bovens'?v+'台':k==='bthick'?v+'mm':k==='bspare'?v+'%':k==='binterval'?v+'分':k==='season'?D.seasons[v].label:k==='prepStart'||k==='start'||k==='bstart'?hm(v):k==='room'?v+'℃':k==='tray'?v+'組分':k==='speed'?v+'組':k==='staff'||k==='packers'||k==='sorters'?v+'人':k==='order'?(A.orders[v]?A.orders[v].label:v):v+'分';
  for(const k in L)if(a[k]!==b[k])out.push(`${L[k]} ${f(k,a[k])}→${f(k,b[k])}`);return out;}

function setActive(v){active=v==='sand';if(active){if(!R)run(false);else drawAll(true);}}
async function init(){if(!$('sandView'))return;
  try{const r=await fetch('data/factory.json',{cache:'no-cache'});D=await r.json();}catch(e){return;}
  A=D.sand;if(!A)return;
  const st=load();let base={};try{base=(JSON.parse(localStorage.getItem('dia-factory')||'null')||{}).cfg||{};}catch(e){}
  cfg=Object.assign({},A.defaults,st.cfg||{season:base.season||A.defaults.season,seed:base.seed||A.defaults.seed});prev=st.prev||null;
  if(!A.orders[cfg.order])cfg.order=A.defaults.order;
  if(!cfg.bread)cfg.bread=A.defaults.bread||'buy';
  buildPlan();buildSpec();buildPlay();
  $('srun').onclick=()=>{run(false);playing=true;markPlay();};
  $('snewNight').onclick=()=>{cfg.seed=(cfg.seed%9999)+1;run(false);};
  window.addEventListener('factory-tab',e=>setActive(e.detail));
  window.addEventListener('resize',()=>drawAll(true));
  const mq=window.matchMedia('(prefers-color-scheme: dark)');if(mq.addEventListener)mq.addEventListener('change',()=>drawAll(true));
  if(!$('sandView').hidden)setActive('sand');
  requestAnimationFrame(t=>{lastFrame=t;tick(t);});}
init();
})();
