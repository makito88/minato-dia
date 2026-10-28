/* =====================================================================
   保存と引き継ぎ
   ・ゲームが保存しているもの（ブラウザの dia- で始まる項目：運転パターン・この日の条件・沿線暦・リサーチ・売店など）を
     まとめて扱う。ゲーム本体の保存のしかたは変えない。
   ・一時保存：このブラウザの中に3つまで（いまの状態を取っておいて、あとで戻せる）。
   ・引き継ぎ：まとめた内容を縮めて「引き継ぎコード」にし、コピー・ファイル・リンクで別の端末（スマホなど）へ持っていく。
     読み込むと、その端末の保存を置きかえてページを読み直す。サーバーには何も送らない。
   ===================================================================== */
(function(){
'use strict';
const SLOTS='dia-saves',SLOTN=3,SKIP=new Set([SLOTS,'dia-ride-dbg']);
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);
const g=(f,d)=>{try{return f();}catch(e){return d;}};

/* いまの保存をまとめる・戻す */
function collect(){const keys={};try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.startsWith('dia-')&&!SKIP.has(k))keys[k]=localStorage.getItem(k);}}catch(e){}return keys;}
function restore(keys){try{const old=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.startsWith('dia-')&&!SKIP.has(k))old.push(k);}
    for(const k of old)localStorage.removeItem(k);for(const k in keys)if(k.startsWith('dia-')&&!SKIP.has(k))localStorage.setItem(k,keys[k]);return true;}catch(e){return false;}}
function summary(keys){const J=k=>{try{return JSON.parse(keys[k]||'null');}catch(e){return null;}};const out=[];
  const en=J('dia-ensen');if(en&&en.day)out.push('運行日'+en.day);
  const ks=J('dia-kiosk');if(ks){out.push(`売店：${g(()=>ST[ks.st].name,ks.st)}駅（${(ks.hist||[]).length}日営業・積み立て${Math.round((ks.cash||0)/1e4)}万円）`);}
  const rs=J('dia-research');if(rs&&rs.studies&&rs.studies.length)out.push(`調査${rs.studies.length}件`);
  return out.join('・')||'ゲームの設定だけ';}

/* 引き継ぎコード：JSON を gzip で縮め、URL に入れられる文字（base64url）にする */
const b64u=bytes=>{let s='';for(let i=0;i<bytes.length;i+=0x8000)s+=String.fromCharCode.apply(null,bytes.subarray(i,i+0x8000));return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');};
const unb64u=str=>{const s=str.replace(/-/g,'+').replace(/_/g,'/');const bin=atob(s+'==='.slice((s.length+3)%4));const u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return u;};
async function encode(obj){const txt=JSON.stringify(obj);
  if(typeof CompressionStream!=='undefined'){const cs=new Blob([txt]).stream().pipeThrough(new CompressionStream('gzip'));const buf=new Uint8Array(await new Response(cs).arrayBuffer());return 'MD1.'+b64u(buf);}
  return 'MD0.'+b64u(new TextEncoder().encode(txt));}
async function decode(code){code=String(code||'').trim().replace(/\s+/g,'');const m=code.match(/MD([01])\.([A-Za-z0-9_-]+)/);if(!m)throw new Error('引き継ぎコードの形ではありません');
  const bytes=unb64u(m[2]);let txt;
  if(m[1]==='1'){if(typeof DecompressionStream==='undefined')throw new Error('このブラウザは縮めたコードを読めません');const ds=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));txt=await new Response(ds).text();}
  else txt=new TextDecoder().decode(bytes);
  const o=JSON.parse(txt);if(!o||o.v!==1||!o.keys)throw new Error('中身が読めませんでした');return o;}

/* 一時保存（このブラウザの中） */
const slots=()=>{try{const a=JSON.parse(localStorage.getItem(SLOTS)||'[]');return Array.isArray(a)?a:[];}catch(e){return [];}};
const putSlots=a=>{try{localStorage.setItem(SLOTS,JSON.stringify(a));return true;}catch(e){return false;}};
const when=t=>new Date(t).toLocaleString('ja-JP',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});

/* ---------- 画面 ---------- */
const CSS=`
.svp{position:fixed;inset:0;z-index:80;background:rgb(0 0 0 / .45);display:flex;align-items:flex-end;justify-content:center}
.svp[hidden]{display:none!important}
.svp-in{background:var(--paper);color:var(--ink);width:min(720px,100%);max-height:92vh;overflow:auto;border-radius:14px 14px 0 0;padding:14px max(16px,env(safe-area-inset-right,0px)) calc(env(safe-area-inset-bottom,0px) + 18px) max(16px,env(safe-area-inset-left,0px));display:grid;gap:12px}
@media (min-width:760px){.svp{align-items:center}.svp-in{border-radius:14px}}
.svp-hd{display:flex;align-items:center;gap:8px}.svp-hd h2{margin:0;font-size:18px;flex:1}
.svp-card{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:12px 14px}
.svp-card h3{margin:0 0 6px;font-size:14px}.svp-note{font-size:12px;color:var(--muted);margin:4px 0 8px;line-height:1.65}
.svp-btn{font:inherit;font-size:14px;border:1px solid var(--line);background:var(--paper);color:var(--ink);border-radius:8px;padding:9px 12px;cursor:pointer;min-height:40px}
.svp-btn.pri{background:var(--accent);color:var(--accent-ink);border-color:var(--accent);font-weight:700}
.svp-btn:disabled{opacity:.45;cursor:default}.svp-btn:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.svp-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.svp-slot{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px 10px;align-items:center;border-top:1px solid var(--line);padding:9px 0}
.svp-slot:first-of-type{border-top:none}.svp-slot b{font-size:13.5px}.svp-slot span{display:block;font-size:12px;color:var(--muted)}
.svp-code{width:100%;min-height:84px;font:12px/1.4 var(--f-mono);border:1px solid var(--line);border-radius:8px;background:var(--paper);color:var(--ink);padding:8px;word-break:break-all;box-sizing:border-box}
.svp-msg{font-size:13px;min-height:1.4em}.svp-msg.ok{color:#2f8a4a}.svp-msg.ng{color:#c9573f}
`;
function mount(){const s=document.createElement('style');s.textContent=CSS;document.head.appendChild(s);
  const after=$('ksBtn')||$('rsBtn')||$('tayoriBtn')||document.querySelector('.clockbox');
  if(after){const b=document.createElement('button');b.id='svBtn';b.type='button';b.className='tayoribtn';b.textContent='保存・引き継ぎ';after.after(b);b.onclick=()=>open(true);}
  const mb=document.querySelector('.minibar-in');if(mb){const b=document.createElement('button');b.id='msv';b.type='button';b.className='mspeed tayorimini';b.textContent='保存';mb.appendChild(b);b.onclick=()=>open(true);}
  const p=document.createElement('div');p.id='svp';p.className='svp';p.hidden=true;p.setAttribute('role','dialog');p.setAttribute('aria-modal','true');p.setAttribute('aria-label','保存と引き継ぎ');
  p.innerHTML=`<div class="svp-in"><div class="svp-hd"><h2>保存と引き継ぎ</h2><button type="button" class="svp-btn" id="svClose">閉じる</button></div>
    <p class="svp-note" style="margin:0">ゲームはこの端末のブラウザに自動で保存されています（運転パターン・この日の条件・沿線暦・リサーチ・売店）。ここでは、その状態を取っておいたり、別の端末へ持っていったりできます。</p>
    <div class="svp-card"><h3>一時保存（この端末の中）</h3><p class="svp-note">いまの状態を3つまで取っておけます。「戻す」と、その時点の状態に置きかえてページを読み直します。</p><div id="svSlots"></div></div>
    <div class="svp-card"><h3>別の端末へ引き継ぐ</h3><p class="svp-note">いまの状態を「引き継ぎコード」にします。パソコンでコードを作り、スマホへ送って（自分あてのメッセージ・メール・ファイル共有など）、スマホのこの画面の「読み込む」に貼りつけるか、ファイルを選んでください。リンクを送った場合は、スマホでそのリンクを開くだけで読み込みの確認が出ます。サーバーには何も送りません。</p>
      <div class="svp-row"><button type="button" class="svp-btn pri" id="svMake">引き継ぎコードを作る</button><span id="svSize" class="svp-note" style="margin:0"></span></div>
      <div id="svOut" hidden style="margin-top:8px"><textarea class="svp-code" id="svCode" readonly aria-label="引き継ぎコード"></textarea>
        <div class="svp-row" style="margin-top:6px"><button type="button" class="svp-btn" id="svCopy">コードをコピー</button><button type="button" class="svp-btn" id="svLink">リンクをコピー</button><button type="button" class="svp-btn" id="svFile">ファイルに保存</button><button type="button" class="svp-btn" id="svShare" hidden>共有…</button></div></div>
      <div class="svp-msg" id="svMsg1" aria-live="polite"></div></div>
    <div class="svp-card"><h3>引き継ぎを読み込む</h3><p class="svp-note">別の端末で作ったコードを貼りつけるか、保存したファイルを選びます。この端末のいまの状態は置きかわります（心配なら先に「一時保存」へ）。</p>
      <textarea class="svp-code" id="svIn" placeholder="ここに引き継ぎコード（MD1. で始まる文字）を貼りつけ" aria-label="読み込む引き継ぎコード"></textarea>
      <div class="svp-row" style="margin-top:6px"><button type="button" class="svp-btn" id="svCheck">中身を確かめる</button><label class="svp-btn" style="display:inline-flex;align-items:center">ファイルを選ぶ<input type="file" id="svPick" accept=".txt,.json,text/plain" hidden></label></div>
      <div id="svConfirm" hidden style="margin-top:8px"><p class="svp-note" id="svWhat" style="color:var(--ink)"></p><div class="svp-row"><button type="button" class="svp-btn pri" id="svApply">この内容で置きかえる</button><button type="button" class="svp-btn" id="svCancel">やめる</button></div></div>
      <div class="svp-msg" id="svMsg2" aria-live="polite"></div></div></div>`;
  document.body.appendChild(p);
  $('svClose').onclick=()=>open(false);p.addEventListener('click',e=>{if(e.target===p)open(false);});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!p.hidden)open(false);});
  $('svMake').onclick=make;$('svCopy').onclick=()=>copy($('svCode').value,'コードをコピーしました');$('svLink').onclick=()=>copy(linkOf($('svCode').value),'リンクをコピーしました');
  $('svFile').onclick=()=>{const blob=new Blob([$('svCode').value],{type:'text/plain'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='minato-dia-save-'+new Date().toISOString().slice(0,16).replace(/[:T]/g,'')+'.txt';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),2000);msg(1,'ファイルに保存しました','ok');};
  if(navigator.share){$('svShare').hidden=false;$('svShare').onclick=()=>navigator.share({title:'みなと川電鉄 ダイヤ工房の引き継ぎ',text:'このリンクを開くと続きから遊べます',url:linkOf($('svCode').value)}).catch(()=>{});}
  $('svCheck').onclick=()=>check($('svIn').value);$('svPick').onchange=e=>{const f=e.target.files&&e.target.files[0];if(!f)return;f.text().then(t=>{$('svIn').value=t.trim();check(t);});};
  $('svCancel').onclick=()=>{V.pending=null;$('svConfirm').hidden=true;msg(2,'');};$('svApply').onclick=apply;}
const V={pending:null};
function msg(n,t,c){const e=$('svMsg'+n);e.textContent=t||'';e.className='svp-msg'+(c?' '+c:'');}
function copy(t,ok){(navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(()=>msg(1,ok,'ok')).catch(()=>{const ta=$('svCode');ta.focus();ta.select();msg(1,'コピーできなかったので、コードを選んだ状態にしました。長押しまたは Ctrl+C でコピーしてください。','ng');});}
const linkOf=code=>location.origin+location.pathname+'#load='+code;
function open(o){$('svp').hidden=!o;if(o){renderSlots();msg(1,'');msg(2,'');$('svOut').hidden=true;$('svSize').textContent='';$('svConfirm').hidden=true;}}
function renderSlots(){const a=slots();$('svSlots').innerHTML=Array.from({length:SLOTN},(_,i)=>{const s=a[i];return `<div class="svp-slot"><div><b>${s?esc(s.name):'（空き）'}</b><span>${s?when(s.at)+'・'+esc(s.sum):'まだ保存していません'}</span></div>
    <div class="svp-row"><button type="button" class="svp-btn" data-save="${i}">${s?'上書き':'ここに保存'}</button>${s?`<button type="button" class="svp-btn" data-load="${i}">戻す</button><button type="button" class="svp-btn" data-del="${i}" aria-label="消す">消す</button>`:''}</div></div>`;}).join('');
  $('svSlots').querySelectorAll('[data-save]').forEach(b=>b.onclick=()=>{const i=Number(b.dataset.save),a2=slots(),keys=collect();a2[i]={name:'保存'+(i+1),at:Date.now(),sum:summary(keys),keys};if(!putSlots(a2)){alertIn('保存できませんでした（ブラウザの保存領域がいっぱいかもしれません）');return;}renderSlots();});
  $('svSlots').querySelectorAll('[data-load]').forEach(b=>b.onclick=()=>{const s=slots()[Number(b.dataset.load)];if(!s)return;V.pending={keys:s.keys,at:s.at,from:'一時保存'};showConfirm();$('svConfirm').scrollIntoView({block:'nearest'});});
  $('svSlots').querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{const a2=slots();a2[Number(b.dataset.del)]=null;putSlots(a2);renderSlots();});}
function alertIn(t){msg(2,t,'ng');}
async function make(){try{const keys=collect(),code=await encode({v:1,at:Date.now(),keys});$('svCode').value=code;$('svOut').hidden=false;
    $('svSize').textContent=`${summary(keys)}（${Math.ceil(code.length/1000)}千文字）`;msg(1,code.length>12000?'コードが長めです。リンクは端末によって開けないことがあるので、そのときは「ファイルに保存」して送ってください。':'','');}
  catch(e){msg(1,'作れませんでした：'+e.message,'ng');}}
async function check(code){try{const o=await decode(code);V.pending={keys:o.keys,at:o.at,from:'引き継ぎコード'};showConfirm();}catch(e){$('svConfirm').hidden=true;msg(2,'読めませんでした：'+e.message,'ng');}}
function showConfirm(){const p=V.pending;$('svWhat').textContent=`${p.from}（${when(p.at)}に作成）：${summary(p.keys)}。この端末のいまの状態は置きかわります。`;$('svConfirm').hidden=false;msg(2,'');}
function apply(){const p=V.pending;if(!p)return;if(!restore(p.keys)){msg(2,'書きこめませんでした（ブラウザの保存領域がいっぱいかもしれません）','ng');return;}
  // 書きこんだらすぐ読み直す（ゲームが古い状態で上書きする隙を作らない）
  history.replaceState(null,'',location.pathname+location.search);location.reload();}

/* リンク（#load=…）で開いたとき：確認を出す */
function fromHash(){const m=location.hash.match(/(?:^#|&)load=([^&]+)/);if(!m)return;open(true);$('svIn').value=decodeURIComponent(m[1]);check($('svIn').value).then(()=>{$('svConfirm').scrollIntoView({block:'center'});});}

mount();fromHash();
window.minatoSave={collect,summary,encode,decode,open:()=>open(true)};
})();
