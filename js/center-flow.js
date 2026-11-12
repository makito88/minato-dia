/* =====================================================================
   川辺の配送センター｜きょうの流れ（2026-11-12・ユーザーの頼み）
   「工場の完成 → センターへの到着・仕分け → 緑ヶ丘店・港駅店への配送」を、同じ時間軸のグラフで見渡す。
   ・センターは計算し直さない。工場・配送会社・店がそれぞれ出した数を、minatoKiosk.flowInfo() から受け取って、時刻の順に並べるだけ。
     工場＝納品書（その夜の結果：ラインごとの完成時刻・出荷・不足）／センター＝data/center.json の時刻表（予定）／
     配送会社＝HaisoCore.dayPlan（便ごとの出発・店ごとの到着・運転手の勤務）／店＝その日の計算の「届いた」出来事。
   ・見分け：点線＝時刻表・設定（予定）／うすい色＝計算で決まった見込み（ゲームの時刻がまだ来ていない）／こい色＝済んだ（時刻が過ぎた）。
     まだ計算されていない工程は「まだ」と書き、線を引かない。
   ・くわしい工程・勤務・お金は、それぞれの画面（工場・配送会社・売店）を開いて見る。DOM だけ。保存も計算もしない。
   ===================================================================== */
(function(){
'use strict';
const g=(f,d)=>{try{return f();}catch(e){return d;}};
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const N=n=>Math.round(n||0).toLocaleString();
const LN={rice:'おにぎり',bread:'パン',sand:'サンドイッチ',donut:'ドーナツ',bento:'お弁当'};
// 時刻：運行日の分（0＝運行日の0:00）。工場・センターの時刻表は「前の夜の時計」（1440＝0:00）なので、18:00 より後の値は 1440 を引く
const op=v=>v==null?null:(v>=1080?v-1440:v);
const hm=t=>{if(t==null)return '—';let m=Math.round(t);const day=m<0?'前夜 ':'';m=((m%1440)+1440)%1440;return day+Math.floor(m/60)+':'+String(m%60).padStart(2,'0');};
const CSS=`.cfl{display:grid;gap:10px}
.cfl .cf-lg{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:11.5px;color:var(--muted)}.cfl .cf-lg i{display:inline-block;width:18px;height:9px;border-radius:3px;margin-right:4px;vertical-align:middle}
.cfl .cf-chart{--lo:148px;--lw:156px;position:relative;overflow:hidden;border:1px solid var(--line);border-radius:10px;background:var(--paper);padding:6px 8px 8px}
.cfl .cf-grp{font-size:11.5px;font-weight:700;letter-spacing:.08em;color:var(--muted);margin:8px 0 2px}
.cfl .cf-row{display:grid;grid-template-columns:132px 1fr;gap:8px;align-items:center;min-height:24px}
.cfl .cf-row .cf-lb{font-size:12px;line-height:1.25;min-width:0;overflow-wrap:anywhere}.cfl .cf-row .cf-lb small{display:block;color:var(--muted);font-size:10.5px}
.cfl .cf-tr{position:relative;height:20px;border-radius:4px;background:color-mix(in srgb,var(--line) 35%,transparent)}
.cfl .cf-bar{position:absolute;top:3px;height:14px;border-radius:4px;min-width:3px;box-sizing:border-box}
.cfl .cf-bar.plan{border:1.5px dashed #7b8794;background:transparent}
.cfl .cf-bar.calc{background:color-mix(in srgb,var(--c,#2b6c9c) 32%,transparent);border:1px solid var(--c,#2b6c9c)}
.cfl .cf-bar.done{background:var(--c,#2b6c9c);border:1px solid var(--c,#2b6c9c)}
.cfl .cf-pin{position:absolute;top:1px;width:0;height:18px;border-left:3px solid var(--c,#2b6c9c)}
.cfl .cf-pin.calc{border-left-style:dotted;background:none;border-top:0;border-right:0;border-bottom:0}
.cfl .cf-pin.sd b{top:13px}.cfl .cf-pin.r b{left:auto;right:3px}.cfl .cf-vl.r span{left:auto;right:3px}.cfl .cf-pin b{position:absolute;left:3px;top:-1px;font-size:9.5px;font-weight:700;white-space:nowrap;color:var(--ink);background:color-mix(in srgb,var(--paper) 80%,transparent);padding:0 2px;border-radius:3px}
.cfl .cf-vl{position:absolute;top:0;bottom:0;width:0;border-left:1.5px dashed var(--c);pointer-events:none;z-index:1}
.cfl .cf-vl span{position:absolute;top:0;left:3px;font-size:9.5px;color:var(--c);white-space:nowrap;background:var(--paper);padding:0 2px}
.cfl .cf-now{--c:#c0392b;border-left-style:solid}
.cfl .cf-ax{position:relative;height:16px;margin-left:140px;font-size:10px;color:var(--muted)}.cfl .cf-ax span{position:absolute;transform:translateX(-50%);white-space:nowrap}
.cfl .cf-chip{display:inline-block;font-size:10.5px;border-radius:999px;padding:0 7px;margin-left:4px;border:1px solid var(--line)}.cfl .cf-chip.ok{color:#2f7d4f;border-color:#2f7d4f66}.cfl .cf-chip.ng{color:#c0392b;border-color:#c0392b88}.cfl .cf-chip.wt{color:#b7791f;border-color:#b7791f88}
.cfl .cf-na{font-size:12px;color:var(--muted);padding:2px 0}
.cfl details{border:1px solid var(--line);border-radius:10px;padding:6px 10px;background:var(--paper)}.cfl summary{cursor:pointer;font-size:13px;font-weight:700}
.cfl table{width:100%;border-collapse:collapse;font-size:12px;margin-top:6px}.cfl th,.cfl td{padding:4px 6px;border-bottom:1px solid var(--line);text-align:right;white-space:nowrap}.cfl th:first-child,.cfl td:first-child{text-align:left}
.cfl .cf-tw{overflow-x:auto}.cfl .cf-go{font:inherit;font-size:12px;border:1px solid var(--line);background:var(--panel);color:var(--ink);border-radius:999px;padding:4px 12px;cursor:pointer;margin:6px 6px 0 0}
.cfl .cf-src{font-size:11px;color:var(--muted);line-height:1.6}
@media (max-width:620px){.cfl .cf-chart{--lo:8px;--lw:16px}.cfl .cf-row{grid-template-columns:1fr;gap:1px;margin-bottom:4px}.cfl .cf-ax{margin-left:0}}`;
const COL={line:'#8a5a2b',fc:'#2b6c9c',other:'#7d5ba6',center:'#3f8f6b',m:'#2b6c9c',p:'#1f7a8c',sd:'#d69e2e',drv:'#5b6b7a'};

function html(){const I=g(()=>minatoKiosk.flowInfo(),{err:'売店の画面を読み込み中です'});
  if(I.err)return `<section class="card"><h3>きょうの流れ</h3><div class="cf-na">${esc(I.err)}</div></section>`;
  const now=I.now,S=I.slip,HZ=I.haiso,starts=Object.values(I.start||{}).map(op);
  const A0=Math.floor(Math.min(-300,...starts.filter(x=>x!=null))/60)*60,A1=16*60,X=t=>Math.max(0,Math.min(100,(t-A0)/(A1-A0)*100));
  const st=(a,b)=>now>=b?'done':'calc';          // ゲームの時刻が過ぎた＝済んだ／まだ＝計算で決まった見込み
  const bar=(a,b,cls,c,tip)=>a==null||b==null?'':`<span class="cf-bar ${cls}" style="left:${X(a).toFixed(2)}%;width:${Math.max(0.4,X(b)-X(a)).toFixed(2)}%;--c:${c}" title="${esc(tip||'')}"></span>`;
  const pin=(t,cls,c,lab,tip)=>t==null?'':`<span class="cf-pin ${cls}${X(t)>78?' r':''}" style="left:${X(t).toFixed(2)}%;--c:${c}" title="${esc(tip||'')}">${lab?`<b>${esc(lab)}</b>`:''}</span>`;
  const row=(lb,sub,inner)=>`<div class="cf-row"><div class="cf-lb">${lb}${sub?`<small>${sub}</small>`:''}</div><div class="cf-tr">${inner}</div></div>`;
  const dl=op(I.deadline),sh=op(I.ship),vls=[[dl,'包装の締め切り','#b7791f'],[sh,'工場を出る','#2b6c9c'],[now,'いま','#c0392b']].filter(v=>v[0]!=null&&v[0]>=A0&&v[0]<=A1);
  const ax=[];for(let t=Math.ceil(A0/120)*120;t<=A1;t+=120)ax.push(`<span style="left:${X(t)}%">${hm(t)}</span>`);
  // 1) 工場：ラインごとに、開始（設定・予定）→ 完成（その夜の計算）。自社2店の分と、ほかの店・取引先を含むライン全体
  const own={};if(S)for(const k in S.stores||{})for(const pid in S.stores[k].items){const ln=I.lineOf[pid];if(!ln)continue;const a=S.stores[k].items[pid],o=own[ln]||(own[ln]={ord:0,ship:0});o.ord+=a[0];o.ship+=a[1]+(a[2]||0);}
  const lines=S?Object.keys(S.lines||{}):[];
  const fRows=S?lines.map(id=>{const L=S.lines[id],s0=op(I.start[id]),done=op(L.lastDone),late=done!=null&&dl!=null&&done>dl,wait=done!=null&&sh!=null?Math.round(sh-done):null,o=own[id]||{ord:0,ship:0};
      const chip=late?`<span class="cf-chip ng">締め切りに ${Math.round(done-dl)}分遅れ</span>`:wait!=null?`<span class="cf-chip ${wait>=60?'wt':'ok'}">間に合った・トラックまで ${wait}分待つ</span>`:'';
      return row(`${esc(LN[id]||id)}${chip}`,`自社2店 ${N(o.ord)}${o.ship<o.ord?`→${N(o.ship)}`:''}・ライン全体 ${N(L.order)}${L.short?`（不足 ${N(L.short)}）`:''}`,
        (s0!=null&&done!=null?bar(s0,done,st(s0,done),COL.line,`開始 ${hm(s0)}（設定）〜 最後の品ができた ${hm(done)}（その夜の計算）`):'')+pin(done,st(done,done),COL.line,'',`完成 ${hm(done)}`));}).join('')
    :`<div class="cf-na">この運行日の工場の結果（納品書）がまだありません。工場は前の運行日の ${hm(op(I.fix))} に注文が決まり、運行日の始めに夜の結果が出ます。</div>`;
  // 2) 工場 → センター（定温トラック・追いかけ便）とセンター（到着・仕分け：時刻表）
  const runs=HZ?HZ.runs:[];const co=k=>g(()=>minatoHaiso.coName(k),k)||k;const F=I.flow||{},C=F.center||{};
  const fcRows=runs.filter(r=>r.leg==='fc'||r.leg==='chase').map(r=>row(esc(r.label),`${esc(co(r.company))}${r.late?`・工場を ${r.late}分待った`:''}`,bar(r.depart,r.arrive,st(r.depart,r.arrive),r.leg==='fc'?COL.fc:COL.other,`${hm(r.depart)} 出発 → ${hm(r.arrive)} センター`))).join('');
  const cRow=C.arrive?row('センターで仕分け','時刻表（予定）',bar(op(C.arrive),op(C.sortEnd),'plan',COL.center,`${hm(op(C.arrive))}〜${hm(op(C.sortEnd))}：${C.sort||''}`)):'';
  // 3) センター → 店（2トントラック・応援便）
  const keyName=Object.fromEntries(I.stores.map(s=>[s.key,s.name]));const short=k=>(keyName[k]||k).replace(/^みなとスタンド\s*/,'').slice(0,6);
  const csRows=runs.filter(r=>r.leg==='cs'||r.leg==='cs-extra').map(r=>row(esc(r.label),`${esc(co(r.company))}・${r.carts!=null?`かご車 ${r.carts}台`:''}${r.late?`・道の遅れ ${r.late}分`:''}`,
      bar(r.depart,r.arrive,r.leg==='cs'?st(r.depart,r.arrive):st(r.depart,r.arrive),r.leg==='cs'?COL.fc:COL.other,`${hm(r.depart)} センターを出る → ${hm(r.arrive)}`)+(r.stops||[]).map(x=>pin(x.arrive,st(x.arrive,x.arrive),'#1d2430',short(x.key),`${keyName[x.key]||x.key} ${hm(x.arrive)} 着${x.late?`（遅れ ${x.late}分）`:''}`)).join(''))).join('');
  // 4) 店：時刻表の便（点線）と、その日の計算で棚に並んだ時刻（できたての便は色を分ける）
  const sRows=I.stores.map((s,i)=>{const c=i===0?COL.m:COL.p;
    return row(esc(s.name),'時刻表＝点線・棚に並んだ（見込み）',s.bins.map(b=>pin(b.t,'calc','#7b8794','',`時刻表 ${b.name} ${hm(b.t)}`)).join('')+s.dl.map(e=>pin(e.t,st(e.t,e.t)+(e.sameday?' sd':''),e.sameday?COL.sd:c,e.sameday?'できたて':e.name.replace('の便',''),`${e.name} ${hm(e.t)} ${now>=e.t?'届いた':'届く見込み'}・${N(e.n)}個${e.late?`・遅れ ${e.late}分`:''}`)).join(''));}).join('');
  // 5) 運転手の勤務（配送会社の計算）
  const dRows=HZ&&HZ.shifts?HZ.shifts.map(x=>row(esc(x.label),`${hm(x.from)}〜${hm(x.to)}${x.share<1?`（グループの荷物の割合 ${Math.round(x.share*100)}%）`:''}`,bar(x.from,x.to,st(x.from,x.to),COL.drv,`点呼・点検を含む勤務 ${Math.round(x.min/60*10)/10}時間`))).join(''):'';
  // くわしく（ラインごと・便ごと・店ごと）
  const fTab=S?`<div class="cf-tw"><table><thead><tr><th>ライン</th><th>開始（設定）</th><th>完成（計算）</th><th>締め切りまで</th><th>トラックまで待つ</th><th>自社2店 注文→出荷</th><th>ライン全体</th></tr></thead><tbody>${lines.map(id=>{const L=S.lines[id],d0=op(L.lastDone),o=own[id]||{ord:0,ship:0};
      return `<tr><td>${esc(LN[id]||id)}</td><td>${hm(op(I.start[id]))}</td><td>${hm(d0)}</td><td>${d0==null||dl==null?'—':d0<=dl?`${Math.round(dl-d0)}分 前`:`<b style="color:#c0392b">${Math.round(d0-dl)}分 遅れ</b>`}</td><td>${d0==null||sh==null?'—':Math.round(sh-d0)+'分'}</td><td>${N(o.ord)} → ${N(o.ship)}</td><td>${N(L.order)}${L.short?`（不足 ${N(L.short)}）`:''}</td></tr>`;}).join('')}</tbody></table></div>
    <p class="cf-src">完成は、ほかの店・取引先の分を含むライン全体で最後の品ができた時刻（納品書 ${esc(S.no)}）。開始は工場の画面の設定。工程ごとの時刻は工場の画面で。</p>
    <div>${lines.map(id=>`<button type="button" class="cf-go" data-fac="${esc(id)}">${esc(LN[id]||id)}の工程を見る</button>`).join('')}</div>`:'<div class="cf-na">まだ結果がありません。</div>';
  const rTab=runs.length?`<div class="cf-tw"><table><thead><tr><th>便</th><th>会社</th><th>出発</th><th>着（店ごと）</th><th>道の遅れ</th><th>かご車</th></tr></thead><tbody>${runs.map(r=>`<tr><td>${esc(r.label)}</td><td>${esc(co(r.company))}</td><td>${hm(r.depart)}</td><td>${(r.stops||[]).map(x=>`${esc(x.name||short(x.key))} ${hm(x.arrive)}`).join('・')}</td><td>${r.late?r.late+'分':'—'}</td><td>${r.carts!=null?r.carts:'—'}</td></tr>`).join('')}</tbody></table></div>
    <p class="cf-src">配送会社（みなと川運輸・他社の応援）の計算。運転手の勤務とお金は配送会社の画面で。</p><button type="button" class="cf-go" data-go="haiso">配送会社の画面を開く</button>`:'<div class="cf-na">この運行日の便は、まだありません。</div>';
  const sTab=I.stores.map(s=>`<h4 style="margin:8px 0 0;font-size:12.5px">${esc(s.name)}</h4><div class="cf-tw"><table><thead><tr><th>便</th><th>時刻表</th><th>棚に並んだ</th><th>時刻表より遅れ</th><th>個数</th><th></th></tr></thead><tbody>${s.dl.map(e=>{const b=s.bins.find(x=>x.name===e.name);
      return `<tr><td>${esc(e.name)}${e.sameday?' <span class="cf-chip wt">できたての便</span>':''}</td><td>${b?hm(b.t):'—'}</td><td>${hm(e.t)}</td><td>${e.late?e.late+'分':'—'}</td><td>${N(e.n)}</td><td>${now>=e.t?'届いた':'見込み'}</td></tr>`;}).join('')}</tbody></table></div>`).join('')
    +(I.sd?`<p class="cf-src">できたての便（港駅店）：工場の朝の組が作り ${hm(I.sd.ship)} に出荷 → ${esc(I.sd.carrier||'')}で ${hm(I.sd.arrive)} ごろ着く${I.sd.trouble?'・釜の遅れの日（作れた数が少ない）':''}。いつもの便とは別に数え、夜の工場には頼まない分。</p>`:'')
    +`<button type="button" class="cf-go" data-go="kiosk">売店の画面を開く</button>`;
  return `<section class="card cfl"><h3>きょうの流れ<small>第${I.day}運行日・工場の完成 → センターで仕分け → 2店へ配送。数は工場・配送会社・店が出したものを並べただけ</small></h3>
    <div class="cf-lg"><span><i style="border:1.5px dashed #7b8794"></i>時刻表・設定（予定）</span><span><i style="background:#2b6c9c55;border:1px solid #2b6c9c"></i>計算で決まった見込み（まだ来ていない）</span><span><i style="background:#2b6c9c"></i>済んだ</span><span><i style="background:${COL.sd}"></i>できたての便</span><span><i style="background:${COL.other}"></i>他社の便</span></div>
    <div class="cf-chart">${vls.map(([t,l,c])=>`<span class="cf-vl${l==='いま'?' cf-now':''}${X(t)>78?' r':''}" style="left:calc(var(--lo) + (100% - var(--lw)) * ${(X(t)/100).toFixed(4)});--c:${c}"><span>${esc(l)} ${hm(t)}</span></span>`).join('')}
      <div class="cf-grp">工場（ラインごと）</div>${fRows}
      <div class="cf-grp">工場 → センター</div>${fcRows||'<div class="cf-na">便はまだありません</div>'}${cRow}
      <div class="cf-grp">センター → 店（便ごと）</div>${csRows||'<div class="cf-na">便はまだありません</div>'}
      <div class="cf-grp">店に届く</div>${sRows}
      ${dRows?`<div class="cf-grp">運転手の勤務</div>${dRows}`:''}
      <div class="cf-ax">${ax.join('')}</div></div>
    <details><summary>工場のラインをくわしく</summary>${fTab}</details>
    <details><summary>便と車をくわしく</summary>${rTab}</details>
    <details><summary>店に届いた時刻をくわしく</summary>${sTab}</details>
    <p class="cf-src">出どころ：工場の完成・出荷＝工場の夜の計算（内）／センターの到着・仕分け＝時刻表（仮）／便の出発・到着・遅れ＝配送会社の計算（遅れの幅は仮）／棚に並んだ時刻＝店の計算（内）。</p></section>`;}
/* グループの収支（第3段・2026-11-12）：minatoKiosk.groupMoney() の数を並べるだけ（計算は MoneyCore.groupLedger）。
   会社の間のお金（店→センター・センター→工場・→配送会社）は、払った会社と受け取った会社で打ち消し合うので、グループのもうけには入れない */
const MV={tab:'today'};
function moneyHtml(){const G=g(()=>minatoKiosk.groupMoney(),null);if(!G)return '';
  const past=G.days||[],yd=past.find(x=>x.day===G.day-1)||null,wk=past.filter(x=>x.day>=G.day-7&&x.day<G.day);
  const sum=list=>{if(!list.length)return null;const co={},ext={in:0,out:0,net:0};let grp=0;const names={};
    for(const L of list){Object.assign(names,L.names||{});grp+=L.grp||0;for(const k of ['in','out','net'])ext[k]+=L.ext[k]||0;for(const k in L.co){const c=co[k]||(co[k]={in:0,out:0,net:0,inExt:0,inGrp:0,outExt:0,outGrp:0});for(const f in c)c[f]+=L.co[k][f]||0;}}
    return {co,ext,grp,names,n:list.length,portOut:list.some(x=>x.portOut)};};
  const T={today:G.today,yday:yd,week:sum(wk)}[MV.tab];
  const tabs=[['today','きょう（見込み）'],['yday','きのう'],['week',`この7日（${wk.length}日）`]].map(([k,l])=>`<button type="button" class="cf-go" data-mt="${k}" aria-pressed="${MV.tab===k}" style="${MV.tab===k?'background:var(--ink);color:var(--paper)':''}">${l}</button>`).join('');
  if(!T)return `<section class="card cfl"><h3>グループの収支<small>2店とセンター・工場・配送会社</small></h3><div>${tabs}</div><div class="cf-na">${MV.tab==='today'?'きょうの計算がまだありません。':'まだ記録がありません（運行日の始めに、前の日の分を1回だけ残します）。'}</div></section>`;
  const NM={center:'配送センター',factory:'工場',haiso:'配送会社'},nm=k=>(T.names&&T.names[k])||NM[k]||k,y=v=>`${v<0?'−':''}${N(Math.abs(v))}円`;
  const keys=Object.keys(T.co).sort((a,b)=>(a.startsWith('store:')?0:1)-(b.startsWith('store:')?0:1));
  const rows=keys.map(k=>{const c=T.co[k];return `<tr><td>${esc(nm(k))}</td><td>${y(c.inExt)}</td><td>${y(c.inGrp)}</td><td>${y(c.outExt)}</td><td>${y(c.outGrp)}</td><td><b style="color:${c.net<0?'#c0392b':'inherit'}">${y(c.net)}</b></td></tr>`;}).join('');
  const inv=MV.tab==='today'&&G.today?G.today.inv:null;
  const invT=inv?`<details><summary>きょうの請求書（見込み）</summary><div class="cf-tw"><table><thead><tr><th>払う</th><th>受け取る</th><th>なに</th><th>金額</th></tr></thead><tbody>${inv.map(x=>`<tr><td>${x.from==='ext'?'グループの外':esc(nm(x.from))}</td><td>${x.to==='ext'?'グループの外':esc(nm(x.to))}</td><td>${esc(x.what)}</td><td>${y(x.yen)}</td></tr>`).join('')}</tbody></table></div></details>`:'';
  return `<section class="card cfl"><h3>グループの収支<small>2店とセンター・工場・配送会社。数は仮の値段（data/money.json）とその日の計算から</small></h3><div>${tabs}</div>
    <div class="sum" style="grid-template-columns:repeat(4,minmax(0,1fr))"><div><b>${y(T.ext.in)}</b><span>グループの外から入った</span></div><div><b>${y(T.ext.out)}</b><span>グループの外へ出た</span></div><div><b style="color:${T.ext.net<0?'#c0392b':'inherit'}">${y(T.ext.net)}</b><span>グループのもうけ</span></div><div><b>${y(T.grp)}</b><span>会社の間で動いた（もうけに入れない）</span></div></div>
    <div class="cf-tw"><table><thead><tr><th>会社・店</th><th>外から入った</th><th>グループ内から</th><th>外へ払った</th><th>グループ内へ</th><th>もうけ</th></tr></thead><tbody>${rows}</tbody></table></div>
    ${invT}
    <p class="cf-src">グループのもうけ＝外から入ったお金−外へ出たお金（会社ごとのもうけの合計と同じ）。会社の間のお金は、払った会社と受け取った会社で同じ額なので、二重に数えない。センターの決まった費用と配送会社の便は1回だけ数える。<b>入れていないもの</b>：工場のほかの店・取引先の売上と費用（未接続）・できたての便を走らせる配送会社の費用（未計算）・工場の朝の組の人件費（未計算）。${T.portOut?'港駅店が流れにのっていない日は、港駅店を入れていません。':''}</p>
    <button type="button" class="cf-go" data-go="money">緑ヶ丘店の請求書の流れ（お金の流れの画面）を開く</button></section>`;}
function bind(box){box.querySelectorAll('.cfl [data-fac]').forEach(b=>b.onclick=()=>window.open('factory.html#'+b.dataset.fac,'_blank','noopener'));
  box.querySelectorAll('.cfl [data-go]').forEach(b=>b.onclick=()=>{const k=b.dataset.go;g(()=>minatoCenter.close());if(k==='haiso')g(()=>minatoHaiso.open());else if(k==='money')g(()=>minatoMoney.open());else g(()=>minatoKiosk.open());});
  box.querySelectorAll('.cfl [data-mt]').forEach(b=>b.onclick=()=>{MV.tab=b.dataset.mt;g(()=>minatoCenter.refresh&&minatoCenter.refresh());});
  // 開いた「くわしく」を、5秒ごとの描き直しのあとも開いたままにする
  box.querySelectorAll('.cfl details').forEach((d,i)=>{if(OPEN[i])d.open=true;d.ontoggle=()=>{OPEN[i]=d.open;};});}
const OPEN={};
{const s=document.createElement('style');s.textContent=CSS;document.head.appendChild(s);}
window.CenterFlow={html,moneyHtml,bind};
})();
