/* =====================================================================
   お金の流れ（2026-11-09）：むずかしい表は出さない
   ・いちばん上に1行（グループのもうけ）、会社ごとのカード（入った・出た・もうけ）、お金の流れの図。
   ・請求書の一覧は、折りたたみの中だけ。
   ・数は minatoKiosk.moneyDay()／moneyDays() から読むだけ（計算は js/money-core.js）。
   ===================================================================== */
(function(){
'use strict';
const $=id=>document.getElementById(id),g=(f,d)=>{try{return f();}catch(e){return d;}};
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const yen=n=>(n<0?'−':'')+'¥'+Math.abs(Math.round(n)).toLocaleString();
const sy=n=>(n>0?'+':'')+yen(n);
const V={open:false,mode:'y',timer:0};
const CO=['kiosk','center','factory','haiso'],KIND={kiosk:'売店',center:'センター',factory:'工場',haiso:'配送会社'};
const coName=k=>g(()=>minatoHaiso.coName(k),'')||KIND[k];

const CSS=`.mfv{position:fixed;inset:0;z-index:85;background:var(--paper);color:var(--ink);overflow:auto;padding:calc(env(safe-area-inset-top,0px) + 14px) max(14px,env(safe-area-inset-right,0px)) calc(env(safe-area-inset-bottom,0px) + 24px) max(14px,env(safe-area-inset-left,0px))}
.mfv .in{max-width:980px;margin:0 auto;display:grid;gap:12px}
.mfv .hd{display:flex;flex-wrap:wrap;gap:6px 14px;align-items:flex-end;justify-content:space-between}
.mfv h2{margin:0;font-size:clamp(19px,3.4vw,24px);letter-spacing:.06em}.mfv .sub{margin:3px 0 0;font-size:12.5px;color:var(--muted);line-height:1.6}
.mfv .x{font:inherit;font-size:14px;border:1px solid var(--line);background:var(--panel);color:var(--ink);border-radius:999px;padding:8px 16px;min-height:40px;cursor:pointer}
.mfv .seg{display:inline-flex;border:1px solid var(--line);border-radius:8px;overflow:hidden}.mfv .seg button{font:inherit;font-size:13px;border:0;background:var(--panel);color:var(--ink);padding:7px 14px;min-height:36px;cursor:pointer}.mfv .seg button[aria-pressed="true"]{background:var(--accent);color:var(--accent-ink,#fff)}
.mfv .big{border:1px solid var(--line);border-radius:14px;background:var(--panel);padding:14px 16px;display:flex;flex-wrap:wrap;gap:6px 18px;align-items:baseline}
.mfv .big b{font-size:clamp(24px,5vw,32px);font-variant-numeric:tabular-nums}.mfv .big span{font-size:13px;color:var(--muted)}
.mfv .pos{color:#2f7a4a}.mfv .neg{color:#c0392b}
.mfv .cos{display:grid;gap:10px}
.mfv .co{border:1px solid var(--line);border-radius:12px;background:var(--panel);padding:11px 12px;display:grid;gap:4px;min-width:0}
.mfv .co h3{margin:0;font-size:14px}.mfv .co h3 small{display:block;font-weight:400;font-size:11.5px;color:var(--muted)}
.mfv .co .net{font-size:20px;font-weight:700;font-variant-numeric:tabular-nums}
.mfv .co .io{font-size:12px;color:var(--muted);font-variant-numeric:tabular-nums}
.mfv .co .why{font-size:11.5px;color:var(--muted);line-height:1.5;border-top:1px dashed var(--line);padding-top:4px}
.mfv .card{border:1px solid var(--line);border-radius:12px;background:var(--panel);padding:12px 14px}
.mfv .card h3{margin:0 0 6px;font-size:14px}.mfv svg{width:100%;height:auto;display:block}.mfv .svgw{overflow-x:auto}@media (max-width:560px){.mfv .svgw svg{min-width:640px}}
.mfv details summary{cursor:pointer;font-size:13px;font-weight:700;min-height:32px;display:flex;align-items:center}
.mfv table{width:100%;border-collapse:collapse;font-size:12.5px;font-variant-numeric:tabular-nums}.mfv td{padding:4px 6px;border-bottom:1px solid var(--line)}.mfv td:last-child{text-align:right}
.mfv .pj td{text-align:right;white-space:nowrap}.mfv .pj td:first-child{text-align:left}.mfv .pj thead td{color:var(--muted);font-size:11.5px}.mfv .pj small{color:var(--muted);font-size:10.5px;margin-left:3px}.mfv td.neg{color:#c0392b}.mfv td.pos{color:#2f7a4a}
.mfv .note{font-size:11.5px;color:var(--muted);line-height:1.65;margin:0}
.mfv .empty{padding:30px 10px;text-align:center;color:var(--muted)}
@media (max-width:760px){.mfv .cos{grid-template-columns:repeat(2,minmax(0,1fr)) !important}}`;

/* お金の流れの図（2026-11-12 から2店）：お客さん → 店（1つか2つ）→ センター → 工場、配送会社。外へ出るお金は各社の上に。
   pair＝{'from>to':円}（会社の間と外とのお金をまとめたもの）・keys＝会社の並び（store:… が先） */
function flowSvg(pair,keys,label){const st=keys.filter(k=>k.startsWith('store:')||k==='kiosk'),W=760,Hh=st.length>1?370:310,mid=st.length>1?170:140;
  const pos={ext:[70,mid],center:[470,mid],factory:[670,mid],haiso:[570,Hh-50]};st.forEach((k,i)=>{pos[k]=[270,st.length>1?(i?mid+70:mid-70):mid];});
  let mx=1,sales={},out={};const tot={};for(const k in pair){const [f,t]=k.split('>'),v=pair[k];if(f==='ext')sales[t]=(sales[t]||0)+v;else if(t==='ext')out[f]=(out[f]||0)+v;else tot[k]=v;mx=Math.max(mx,v);}
  const w=v=>(2+9*Math.sqrt(v/mx)).toFixed(1),BW=56,BH=24;
  const edge=(x,y,ux,uy)=>{const tx=ux?BW/Math.abs(ux):1e9,ty=uy?BH/Math.abs(uy):1e9,t=Math.min(tx,ty)+6;return [x+ux*t,y+uy*t];};
  const arrow=(a,b,v,lab,f)=>{if(!pos[a]||!pos[b])return '';f=f||0.5;const [x1,y1]=pos[a],[x2,y2]=pos[b],L=Math.hypot(x2-x1,y2-y1),ux=(x2-x1)/L,uy=(y2-y1)/L,[sx,sy]=edge(x1,y1,ux,uy),[ex,ey]=edge(x2,y2,-ux,-uy),mxp=sx+(ex-sx)*f,myp=sy+(ey-sy)*f,diag=Math.abs(uy)>0.2;
    return `<line x1="${sx.toFixed(1)}" y1="${sy.toFixed(1)}" x2="${ex.toFixed(1)}" y2="${ey.toFixed(1)}" stroke="#2f7a4a" stroke-opacity=".5" stroke-width="${w(v)}" marker-end="url(#mfa)"/>`+
      `<text x="${diag?mxp+10:mxp}" y="${diag?myp-4:myp-12}" text-anchor="${diag?'start':'middle'}" font-size="12" font-weight="700" fill="currentColor">${yen(v)}</text><text x="${diag?mxp+10:mxp}" y="${diag?myp+11:myp+21}" text-anchor="${diag?'start':'middle'}" font-size="10" fill="currentColor" opacity=".65">${esc(lab)}</text>`;};
  const box=(k,t,sub)=>{const [x,y]=pos[k];return `<rect x="${x-BW}" y="${y-BH}" width="${BW*2}" height="${BH*2}" rx="10" fill="var(--panel)" stroke="currentColor" stroke-opacity=".35"/><text x="${x}" y="${y-2}" text-anchor="middle" font-size="13" font-weight="700" fill="currentColor">${esc(t)}</text><text x="${x}" y="${y+14}" text-anchor="middle" font-size="9.5" fill="currentColor" opacity=".65">${esc(sub)}</text>`;};
  const away=k=>{const v=out[k]||0;if(!v||!pos[k])return '';const [x,y]=pos[k];if(k==='haiso'||(k.startsWith('store:')&&st.length>1&&y>mid))return `<line x1="${x+(k==='haiso'?BW+6:0)}" y1="${k==='haiso'?y:y+BH+6}" x2="${x+(k==='haiso'?BW+40:0)}" y2="${k==='haiso'?y:y+BH+36}" stroke="#c0392b" stroke-opacity=".45" stroke-width="${w(v)}" marker-end="url(#mfb)"/><text x="${k==='haiso'?x+BW+48:x}" y="${k==='haiso'?y+4:y+BH+50}" ${k==='haiso'?'':'text-anchor="middle"'} font-size="11" font-weight="700" fill="currentColor">外へ ${yen(v)}</text>`;
    return `<line x1="${x}" y1="${y-BH-6}" x2="${x}" y2="${y-BH-40}" stroke="#c0392b" stroke-opacity=".45" stroke-width="${w(v)}" marker-end="url(#mfb)"/><text x="${x}" y="${y-BH-52}" text-anchor="middle" font-size="11" font-weight="700" fill="currentColor">外へ ${yen(v)}</text>`;};
  let s=`<svg viewBox="0 0 ${W} ${Hh}" role="img" aria-label="お金の流れの図"><defs><marker id="mfa" viewBox="0 0 10 10" refX="8" refY="5" markerUnits="userSpaceOnUse" markerWidth="12" markerHeight="12" orient="auto"><path d="M0 0L10 5L0 10z" fill="#2f7a4a" fill-opacity=".8"/></marker><marker id="mfb" viewBox="0 0 10 10" refX="8" refY="5" markerUnits="userSpaceOnUse" markerWidth="12" markerHeight="12" orient="auto"><path d="M0 0L10 5L0 10z" fill="#c0392b" fill-opacity=".7"/></marker></defs>`;
  for(const k in sales)s+=arrow('ext',k,sales[k],'買い物');
  const lab=(a,b)=>a.startsWith('store:')&&b==='center'?'仕入れ・センターフィー':a.startsWith('store:')&&b==='factory'?'できたての品':a.startsWith('store:')&&b==='haiso'?'できたての運賃':b==='factory'?'工場の品の代金':b==='haiso'?'運賃':'';
  for(const k in tot){const [a,b]=k.split('>');s+=arrow(a,b,tot[k],lab(a,b),a.startsWith('store:')&&b!=='center'?0.72:a.startsWith('store:')?0.35:0.5);}
  for(const k of keys)s+=away(k);s+=box('ext','お客さん','駅で買う人');for(const k of keys)s+=box(k,label(k),k.startsWith('store:')?'売店':coName(k));
  return s+'</svg>';}
/* 店を増やしたら（試算）：この日の店の荷物と収支が、同じ形の店にそのまま増えたとしたら。店はこの店のトラックの道から順に並べる */
function projHtml(L){if(!L||L.n||!window.MoneyCore||!window.HaisoCore)return '';const inp=g(()=>minatoKiosk.haisoInput(L.day),null),C=g(()=>minatoKiosk.ccfg,null),H=g(()=>minatoHaiso.cfg,null),M=g(()=>minatoKiosk.mcfg,null);if(!inp||!C||!H||!M)return '';
  const me=inp.stores[0],T=(C.slip&&C.slip.trucks)||[],mine=T.find(t=>(t.st||[]).includes(me.key.split('-')[0])),order=[mine,...T.filter(t=>t!==mine)].filter(Boolean),keys=[];
  for(const t of order)for(const st of t.st)for(const pl of ['home','gate','naka','soto']){const k=st+'-'+pl;if(k!==me.key)keys.push(k);}
  const E=M.ext||{},sts=[...new Set(T.flatMap(t=>t.st))],m=V.ext||0;
  const extStops=k=>Array.from({length:k},(_,i)=>({key:sts[i%sts.length]+'-x'+i,ext:true,runs:[{bin:E.bin||'昼前の便',f:0,c:(E.carts||0.6)*(H.perCart.center||150)}]}));
  const hzFor=(n,mm)=>HaisoCore.dayPlan(H,C,CenterCore,{day:inp.day,cond:inp.cond,slip:null,stores:[me,...keys.slice(0,n-1).map(key=>({key,runs:me.runs})),...extStops(mm||0)]});
  const P=g(()=>MoneyCore.project(M,L,hzFor,[1,2,4,6,8,10,12,16],m),null);if(!P)return '';const f=H.fare;
  const extBtns=`<div class="seg" style="margin:4px 0 8px">${[0,10,20,40].map(k=>`<button type="button" data-ext="${k}" aria-pressed="${m===k}">外の配達先 ${k}</button>`).join('')}</div>`;
  const be=fn=>{const x=P.find(r=>fn(r)>=0);return x?`${x.n}店から`:'16店でもまだ赤字'};
  return `<section class="card"><h3>店を増やしたら（試算・緑ヶ丘店の1日をもとに）</h3><p class="note" style="margin-bottom:6px">この日の店と同じ荷物・同じ収支の店が、このトラックの道から順にふえたら。人件費も入れた計算：配送会社の運転手はトラックごとのシフト（深夜の割増・社会保険）、センターは運営の人（センター長・事務・検品）と建物（決まった費用）＋仕分けの人（扱う個数で時間が決まる）。配送会社の収入＝店に寄った回数×${yen(f.perStop)}＋かご車×${yen(f.perCart)}＋工場→センターのかご車×${yen(f.fcPerCart)}。</p>
    <p class="note">「外の配達先」は、ほかの会社のコンビニ・自販機・カフェ・スーパー・会社・病院・学校など。1つあたり1日1便・かご車${E.carts}台、センターに配達の料金（1便${yen(E.fee.perRun)}＋かご車${yen(E.fee.perCart)}）を払う（品物の代金は入れない・仮）。</p>${extBtns}
    <div style="overflow-x:auto"><table class="pj"><thead><tr><td>店の数</td><td>運ぶ量（かご車/日）</td><td>配送会社の収入</td><td>配送会社</td><td>センター</td><td>売店（1店）</td><td>グループ</td></tr></thead><tbody>${P.map(r=>`<tr><td>${r.n}店${m?`＋外${m}`:''}</td><td>${r.carts}台</td><td>${yen(r.haiso.fare)}</td><td class="${r.haiso.profit<0?'neg':'pos'}">${sy(r.haiso.profit)}<small>運転手${r.haiso.drivers}シフト${r.haiso.other?`・他社${r.haiso.other}便`:''}</small></td><td class="${r.center<0?'neg':'pos'}">${sy(r.center)}<small>仕分け${r.centerCost.sortH}時間</small></td><td class="${r.kiosk1<0?'neg':'pos'}">${sy(r.kiosk1)}</td><td class="${r.group<0?'neg':'pos'}">${sy(r.group)}</td></tr>`).join('')}</tbody></table></div>
    <p class="note" style="margin-top:6px">黒字になるのは：配送会社 ${be(r=>r.haiso.profit)}・センター ${be(r=>r.center)}・グループ ${be(r=>r.group)}・売店 ${P[0].kiosk1>=0?'この店は黒字':'この店は赤字（店ごとの売れ方しだい）'}（この日の数で計算した目安。駅や場所で売れ方はちがう）。</p></section>`;}
/* 2店のグループの収支（minatoKiosk.groupMoney：きょう＝見込み・締めた日＝dia-group）。なければ前の形（緑ヶ丘店だけの dia-money） */
function pairOf(inv){const p={};for(const x of inv||[]){const k=x.from+'>'+x.to;p[k]=(p[k]||0)+x.yen;}return p;}
function groupView(mode){const G=g(()=>minatoKiosk.groupMoney(),null);if(!G)return null;const days=G.days||[];
  if(mode==='t')return G.today?{...G.today,pair:pairOf(G.today.inv),label:'きょう（いまの時点の見込み・1日分）'}:null;
  if(mode==='y'){const d=days.find(x=>x.day===G.day-1)||days[days.length-1];return d&&d.pair?{...d,label:`第${d.day}運行日（締めた日）`}:null;}
  const last=days.filter(x=>x.pair&&x.day>=G.day-7&&x.day<G.day);if(!last.length)return null;const co={},pair={},names={},ext={in:0,out:0,net:0};let grp=0;
  for(const L of last){Object.assign(names,L.names||{});grp+=L.grp||0;for(const k of ['in','out','net'])ext[k]+=L.ext[k]||0;for(const k in L.pair)pair[k]=(pair[k]||0)+L.pair[k];
    for(const k in L.co){const c=co[k]||(co[k]={in:0,out:0,net:0,inExt:0,inGrp:0,outExt:0,outGrp:0});for(const f in c)c[f]+=L.co[k][f]||0;}}
  return {co,pair,names,ext,grp,n:last.length,label:`最近${last.length}日の合計`};}
function render(){const box=$('mfv');if(!box||!V.open)return;try{render0(box);}catch(e){console.warn('お金の流れを描けませんでした',e);box.innerHTML=`<div class="in"><div class="hd"><div><h2>お金の流れ</h2></div><button class="x" id="mfClose">閉じる</button></div><div class="card empty">表示できませんでした（${esc(e&&e.message||e)}）。</div></div>`;bind(box);}}
function render0(box){
  const today=g(()=>minatoKiosk.day,null),days=g(()=>minatoKiosk.moneyDays(),[])||[];
  // 前の形（緑ヶ丘店だけ）：店を増やしたらの試算と、グループの記録がまだない日に使う
  let O=null;if(V.mode==='t')O=g(()=>minatoKiosk.moneyDay(today),null);else if(V.mode==='y')O=days.find(x=>x.day===today-1)||days[days.length-1]||null;
  else{const S=window.MoneyCore?MoneyCore.sumDays(days.slice(-7)):null;if(S&&S.n)O={co:S.co,inv:S.inv,n:S.n};}
  let L=groupView(V.mode),old=false;
  if(!L&&O){old=true;L={co:O.co,pair:pairOf(O.inv),inv:O.inv,names:{},label:V.mode==='t'?'きょう（見込み）・緑ヶ丘店だけ':V.mode==='y'?`第${O.day}運行日・緑ヶ丘店だけ（前の数え方）`:`最近${O.n}日・緑ヶ丘店だけ（前の数え方）`};}
  const segs=`<div class="seg">${[['t','きょう'],['y','きのう'],['w','7日の合計']].map(([k,t])=>`<button type="button" data-m="${k}" aria-pressed="${V.mode===k}">${t}</button>`).join('')}</div>`;
  const head=`<div class="hd"><div><h2>お金の流れ</h2><p class="sub">品物が動くと、お金は逆向きに流れます。2つの店とセンター・工場・配送会社が、それぞれいくら入って、いくら出て、いくら残ったか。会社の間のお金は、グループのもうけには入れません（払った会社と受け取った会社で打ち消し合う）。値段の決まりは仮（data/money.json）。</p></div><button class="x" id="mfClose">閉じる</button></div>`;
  if(!L){box.innerHTML=`<div class="in">${head}<div>${segs}</div><div class="card empty">${today==null?'まだ売店がありません。':V.mode==='t'?'きょうの計算を準備しています。':'まだ締めた日の記録がありません（両方の店が1日を締めて、次の運行日が始まると、ここに出ます）。'}</div></div>`;bind(box);return;}
  const keys=Object.keys(L.co).sort((a,b)=>(a.startsWith('store:')?0:a==='kiosk'?0:1)-(b.startsWith('store:')?0:b==='kiosk'?0:1));
  const label=k=>k.startsWith('store:')?String((L.names&&L.names[k])||k).replace(/^みなとスタンド\s*/,'').replace(/（.*?）/,'').slice(0,9):KIND[k]||k;
  const sales=Object.keys(L.pair).filter(k=>k.startsWith('ext>')).reduce((t,k)=>t+L.pair[k],0),outE=Object.keys(L.pair).filter(k=>k.endsWith('>ext')).reduce((t,k)=>t+L.pair[k],0),net=sales-outE;
  const grp=L.grp!=null?L.grp:Object.keys(L.pair).filter(k=>!k.startsWith('ext>')&&!k.endsWith('>ext')).reduce((t,k)=>t+L.pair[k],0);
  const cards=keys.map(k=>{const c=L.co[k]||{in:0,out:0,net:0},full=k.startsWith('store:')?((L.names&&L.names[k])||k):coName(k);
    const io=c.inExt!=null?`外から ${yen(c.inExt)}・グループ内から ${yen(c.inGrp)}<br>外へ ${yen(c.outExt)}・グループ内へ ${yen(c.outGrp)}`:`入った ${yen(c.in)}・出た ${yen(c.out)}`;
    return `<div class="co"><h3>${esc(k.startsWith('store:')||k==='kiosk'?'売店':KIND[k]||k)}<small>${esc(full)}</small></h3><div class="net ${c.net<0?'neg':'pos'}">${sy(c.net)}</div><div class="io">${io}</div></div>`;}).join('');
  const nm=k=>k==='ext'?'グループの外':k.startsWith('store:')?label(k):KIND[k]||k;
  const rows=L.inv?L.inv.slice().sort((a,b)=>b.yen-a.yen).map(x=>`<tr><td>${x.from==='ext'?'お客さん':esc(nm(x.from))} → ${esc(nm(x.to))}</td><td>${esc(x.what)}</td><td>${yen(x.yen)}</td></tr>`).join(''):'';
  box.innerHTML=`<div class="in">${head}
    <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between">${segs}<span class="note">${esc(L.label)}</span></div>
    ${old?`<div class="card" style="border-color:#b7791f;background:color-mix(in srgb,#b7791f 10%,var(--panel))"><b>この日は緑ヶ丘店だけの前の数え方です。</b> 2店（緑ヶ丘店・港駅店）とセンター・工場・配送会社の記録は、2026-11-12 の変更のあと、次の運行日が始まったとき（朝4:30すぎ）から残ります。いまの2店の数は「きょう」で見られます。</div>`:''}
    <div class="big"><span>グループのもうけ</span><b class="${net<0?'neg':'pos'}">${sy(net)}</b><span>＝ お客さんから ${yen(sales)} − 外へ ${yen(outE)}</span><span>（会社の間で動いたお金 ${yen(grp)} は入れない）</span></div>
    <div class="cos" style="grid-template-columns:repeat(${Math.min(5,keys.length)},minmax(0,1fr))">${cards}</div>
    <section class="card"><h3>お金の流れの図</h3><div class="svgw">${flowSvg(L.pair,keys,label)}</div><p class="note">緑の矢印は会社どうしの支払い（太いほど大きい）、赤い矢印はグループの外へ出るお金（問屋・店員や運転手の給料・燃料・家賃など）。</p></section>
    ${projHtml(O)}
    ${rows?`<section class="card"><details><summary>請求書の一覧（${L.inv.length}枚）</summary><table>${rows}</table></details></section>`:`<p class="note">請求書の一覧は「きょう」だけ（締めた日は、会社ごとの合計と会社の間の合計だけを残しています）。</p>`}
    <p class="note">${old?'この日はまだグループの記録がないので、前の数え方（緑ヶ丘店だけ・センターと配送会社の費用を店の数で分けた分）で出しています。':'センターの決まった費用と配送会社の便は、店がいくつあっても1回だけ数える。工場は、自社の店の分だけ（ほかの店・取引先の分は入れていない）。できたての便を走らせる配送会社の費用と、工場の朝の組の人件費はまだ入れていない。'}売店の「収支」タブは売れた品の原価で数えるので、ここ（その日に届いた品の代金）とは少しちがう。</p></div>`;
  bind(box);}
function bind(box){$('mfClose').onclick=close;box.querySelectorAll('[data-ext]').forEach(b=>b.onclick=()=>{V.ext=Number(b.dataset.ext);render();});box.querySelectorAll('[data-m]').forEach(b=>b.onclick=()=>{V.mode=b.dataset.m;V.touched=true;render();});}
function open(){const b=$('mfv');b.hidden=false;V.open=true;if(!V.touched)V.mode=groupView('y')?'y':'t';   // 2店の記録（締めた日）がまだなければ、2店のきょうの見込みから見せる
  b.scrollTop=0;render();clearInterval(V.timer);V.timer=setInterval(()=>{if(V.mode==='t')render();},10000);}
function close(){const b=$('mfv');if(b)b.hidden=true;V.open=false;clearInterval(V.timer);}
/* トップの1行用 */
function yesterday(){const Gv=groupView('y');if(Gv&&Gv.day!=null){const co={kiosk:{net:0}};for(const k in Gv.co){if(k.startsWith('store:'))co.kiosk.net+=Gv.co[k].net;else co[k]=Gv.co[k];}for(const k of ['center','factory','haiso'])co[k]=co[k]||{net:0};return {day:Gv.day,net:Gv.ext.net,co};}
  const today=g(()=>minatoKiosk.day,null),days=g(()=>minatoKiosk.moneyDays(),[])||[];const L=days.find(x=>x.day===today-1)||days[days.length-1];if(!L)return null;return {day:L.day,net:CO.reduce((t,k)=>t+((L.co[k]||{}).net||0),0),co:L.co};}
{const s=document.createElement('style');s.textContent=CSS;document.head.appendChild(s);
 const v=document.createElement('div');v.id='mfv';v.className='mfv';v.hidden=true;v.setAttribute('role','dialog');v.setAttribute('aria-label','お金の流れ');document.body.appendChild(v);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&V.open)close();});}
window.minatoMoney={open,close,yesterday};
})();
