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
.mfv .cos{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
.mfv .co{border:1px solid var(--line);border-radius:12px;background:var(--panel);padding:11px 12px;display:grid;gap:4px;min-width:0}
.mfv .co h3{margin:0;font-size:14px}.mfv .co h3 small{display:block;font-weight:400;font-size:11.5px;color:var(--muted)}
.mfv .co .net{font-size:20px;font-weight:700;font-variant-numeric:tabular-nums}
.mfv .co .io{font-size:12px;color:var(--muted);font-variant-numeric:tabular-nums}
.mfv .co .why{font-size:11.5px;color:var(--muted);line-height:1.5;border-top:1px dashed var(--line);padding-top:4px}
.mfv .card{border:1px solid var(--line);border-radius:12px;background:var(--panel);padding:12px 14px}
.mfv .card h3{margin:0 0 6px;font-size:14px}.mfv svg{width:100%;height:auto;display:block}.mfv .svgw{overflow-x:auto}@media (max-width:560px){.mfv .svgw svg{min-width:640px}}
.mfv details summary{cursor:pointer;font-size:13px;font-weight:700;min-height:32px;display:flex;align-items:center}
.mfv table{width:100%;border-collapse:collapse;font-size:12.5px;font-variant-numeric:tabular-nums}.mfv td{padding:4px 6px;border-bottom:1px solid var(--line)}.mfv td:last-child{text-align:right}
.mfv .note{font-size:11.5px;color:var(--muted);line-height:1.65;margin:0}
.mfv .empty{padding:30px 10px;text-align:center;color:var(--muted)}
@media (max-width:760px){.mfv .cos{grid-template-columns:repeat(2,minmax(0,1fr))}}`;

/* お金の流れの図：お客さん → 売店 → センター → 工場、配送会社。外へ出るお金は各社の下に */
function flowSvg(inv){const pos={ext:[70,120],kiosk:[265,120],center:[460,120],factory:[655,120],haiso:[560,250]},W=740,Hh=310;
  const tot={};let mx=1;for(const x of inv){if(x.from==='ext'||x.to==='ext')continue;const k=x.from+'>'+x.to;tot[k]=(tot[k]||0)+x.yen;mx=Math.max(mx,tot[k]);}
  let sales=0;const out={};for(const x of inv){if(x.from==='ext')sales+=x.yen;else if(x.to==='ext')out[x.from]=(out[x.from]||0)+x.yen;}for(const k in out)mx=Math.max(mx,out[k]);mx=Math.max(mx,sales);
  const w=v=>(2+9*Math.sqrt(v/mx)).toFixed(1),BW=52,BH=24;
  // 箱のふちで止まる線（矢印の先は箱の手前）
  const edge=(x,y,ux,uy)=>{const tx=ux?BW/Math.abs(ux):1e9,ty=uy?BH/Math.abs(uy):1e9,t=Math.min(tx,ty)+6;return [x+ux*t,y+uy*t];};
  const arrow=(a,b,v,lab)=>{const [x1,y1]=pos[a],[x2,y2]=pos[b],L=Math.hypot(x2-x1,y2-y1),ux=(x2-x1)/L,uy=(y2-y1)/L,[sx,sy]=edge(x1,y1,ux,uy),[ex,ey]=edge(x2,y2,-ux,-uy),mxp=(sx+ex)/2,myp=(sy+ey)/2,diag=Math.abs(uy)>0.2;
    return `<line x1="${sx.toFixed(1)}" y1="${sy.toFixed(1)}" x2="${ex.toFixed(1)}" y2="${ey.toFixed(1)}" stroke="#2f7a4a" stroke-opacity=".5" stroke-width="${w(v)}" marker-end="url(#mfa)"/>`+
      `<text x="${diag?mxp+12:mxp}" y="${diag?myp-4:myp-12}" text-anchor="${diag?'start':'middle'}" font-size="12.5" font-weight="700" fill="currentColor">${yen(v)}</text><text x="${diag?mxp+12:mxp}" y="${diag?myp+12:myp+22}" text-anchor="${diag?'start':'middle'}" font-size="10.5" fill="currentColor" opacity=".65">${esc(lab)}</text>`;};
  const box=(k,t,sub)=>{const [x,y]=pos[k];return `<rect x="${x-BW}" y="${y-BH}" width="${BW*2}" height="${BH*2}" rx="10" fill="var(--panel)" stroke="currentColor" stroke-opacity=".35"/><text x="${x}" y="${y-2}" text-anchor="middle" font-size="13.5" font-weight="700" fill="currentColor">${esc(t)}</text><text x="${x}" y="${y+14}" text-anchor="middle" font-size="10" fill="currentColor" opacity=".65">${esc(sub)}</text>`;};
  // 外へ出るお金：売店・センター・工場は上へ、配送会社は右へ
  const away=k=>{const v=out[k]||0;if(!v)return '';const [x,y]=pos[k];if(k==='haiso')return `<line x1="${x+BW+6}" y1="${y}" x2="${x+BW+44}" y2="${y}" stroke="#c0392b" stroke-opacity=".45" stroke-width="${w(v)}" marker-end="url(#mfb)"/><text x="${x+BW+52}" y="${y+4}" font-size="11.5" font-weight="700" fill="currentColor">外へ ${yen(v)}</text>`;
    return `<line x1="${x}" y1="${y-BH-6}" x2="${x}" y2="${y-BH-48}" stroke="#c0392b" stroke-opacity=".45" stroke-width="${w(v)}" marker-end="url(#mfb)"/><text x="${x}" y="${y-BH-62}" text-anchor="middle" font-size="11.5" font-weight="700" fill="currentColor">外へ ${yen(v)}</text>`;};
  let s=`<svg viewBox="0 0 ${W} ${Hh}" role="img" aria-label="お金の流れの図"><defs><marker id="mfa" viewBox="0 0 10 10" refX="8" refY="5" markerUnits="userSpaceOnUse" markerWidth="12" markerHeight="12" orient="auto"><path d="M0 0L10 5L0 10z" fill="#2f7a4a" fill-opacity=".8"/></marker><marker id="mfb" viewBox="0 0 10 10" refX="8" refY="5" markerUnits="userSpaceOnUse" markerWidth="12" markerHeight="12" orient="auto"><path d="M0 0L10 5L0 10z" fill="#c0392b" fill-opacity=".7"/></marker></defs>`;
  if(sales)s+=arrow('ext','kiosk',sales,'買い物');
  const lab={'kiosk>center':'仕入れの代金','center>factory':'工場の品の代金','center>haiso':'運賃','factory>haiso':'運賃'};
  for(const k in tot){const [a,b]=k.split('>');s+=arrow(a,b,tot[k],lab[k]||'');}
  for(const k of CO)s+=away(k);s+=box('ext','お客さん','駅で買う人');for(const k of CO)s+=box(k,KIND[k],coName(k));
  return s+'</svg>';}
function render(){const box=$('mfv');if(!box||!V.open)return;
  const today=g(()=>minatoKiosk.day,null),days=g(()=>minatoKiosk.moneyDays(),[])||[];
  let L=null,label='';if(V.mode==='t'){L=g(()=>minatoKiosk.moneyDay(today),null);label='きょう（いまの時点の見込み・1日分）';}
  else if(V.mode==='y'){L=days.find(x=>x.day===today-1)||days[days.length-1]||null;label=L?`第${L.day}運行日（締めた日）`:'';}
  else{const last=days.slice(-7);const S=window.MoneyCore?MoneyCore.sumDays(last):null;if(S&&S.n)L={co:S.co,inv:S.inv,n:S.n};label=S&&S.n?`最近${S.n}日の合計`:'';}
  const segs=`<div class="seg">${[['t','きょう'],['y','きのう'],['w','7日の合計']].map(([k,t])=>`<button type="button" data-m="${k}" aria-pressed="${V.mode===k}">${t}</button>`).join('')}</div>`;
  const head=`<div class="hd"><div><h2>お金の流れ</h2><p class="sub">品物が動くと、お金は逆向きに流れます。4つの会社がそれぞれ、いくら入って、いくら出て、いくら残ったか。値段の決まりは仮（data/money.json）。</p></div><button class="x" id="mfClose">閉じる</button></div>`;
  if(!L){box.innerHTML=`<div class="in">${head}<div>${segs}</div><div class="card empty">${today==null?'まだ売店がありません。':V.mode==='t'?'きょうの計算を準備しています。':'まだ締めた日の記録がありません（売店が1日を締めると、ここに出ます）。'}</div></div>`;bind(box);return;}
  const net=CO.reduce((t,k)=>t+((L.co[k]||{}).net||0),0),sales=L.inv.filter(x=>x.from==='ext').reduce((t,x)=>t+x.yen,0),outE=L.inv.filter(x=>x.to==='ext').reduce((t,x)=>t+x.yen,0);
  const cards=CO.map(k=>{const c=L.co[k]||{in:0,out:0,net:0},ins=L.inv.filter(x=>x.to===k).sort((a,b)=>b.yen-a.yen)[0],outs=L.inv.filter(x=>x.from===k).sort((a,b)=>b.yen-a.yen).slice(0,2);
    return `<div class="co"><h3>${KIND[k]}<small>${esc(coName(k))}</small></h3><div class="net ${c.net<0?'neg':'pos'}">${sy(c.net)}</div><div class="io">入った ${yen(c.in)}・出た ${yen(c.out)}</div><div class="why">${ins?`いちばん大きい入り：${esc(ins.what)}`:'入りなし'}${outs.length?`<br>おもな出：${outs.map(x=>esc(x.what)).join('・')}`:''}</div></div>`;}).join('');
  const rows=L.inv.slice().sort((a,b)=>b.yen-a.yen).map(x=>`<tr><td>${x.from==='ext'?'お客さん':KIND[x.from]} → ${x.to==='ext'?'グループの外':KIND[x.to]}</td><td>${esc(x.what)}</td><td>${yen(x.yen)}</td></tr>`).join('');
  box.innerHTML=`<div class="in">${head}
    <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between">${segs}<span class="note">${esc(label)}</span></div>
    <div class="big"><span>グループのもうけ</span><b class="${net<0?'neg':'pos'}">${sy(net)}</b><span>＝ お客さんから ${yen(sales)} − 外へ ${yen(outE)}</span></div>
    <div class="cos">${cards}</div>
    <section class="card"><h3>お金の流れの図</h3><div class="svgw">${flowSvg(L.inv)}</div><p class="note">緑の矢印は会社どうしの支払い（太いほど大きい）、赤い矢印はグループの外へ出るお金（問屋・店員や運転手の給料・燃料・家賃など）。</p></section>
    <section class="card"><details><summary>請求書の一覧（${L.inv.length}枚）</summary><table>${rows}</table></details>
      <p class="note" style="margin-top:6px">店が1つなので、センター・配送会社の決まった費用に対して運ぶ量が少なく、赤字になりやすい（店が増えると変わる）。工場は、この店の分だけ（ほかの取引先の分は入れていない）。売店の「収支」タブは売れた品の原価で数えるので、ここ（その日に届いた品の代金）とは少しちがう。</p></section></div>`;
  bind(box);}
function bind(box){$('mfClose').onclick=close;box.querySelectorAll('[data-m]').forEach(b=>b.onclick=()=>{V.mode=b.dataset.m;render();});}
function open(){const b=$('mfv');b.hidden=false;V.open=true;b.scrollTop=0;render();clearInterval(V.timer);V.timer=setInterval(()=>{if(V.mode==='t')render();},10000);}
function close(){const b=$('mfv');if(b)b.hidden=true;V.open=false;clearInterval(V.timer);}
/* トップの1行用 */
function yesterday(){const today=g(()=>minatoKiosk.day,null),days=g(()=>minatoKiosk.moneyDays(),[])||[];const L=days.find(x=>x.day===today-1)||days[days.length-1];if(!L)return null;return {day:L.day,net:CO.reduce((t,k)=>t+((L.co[k]||{}).net||0),0),co:L.co};}
{const s=document.createElement('style');s.textContent=CSS;document.head.appendChild(s);
 const v=document.createElement('div');v.id='mfv';v.className='mfv';v.hidden=true;v.setAttribute('role','dialog');v.setAttribute('aria-label','お金の流れ');document.body.appendChild(v);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&V.open)close();});}
window.minatoMoney={open,close,yesterday};
})();
