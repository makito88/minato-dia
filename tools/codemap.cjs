// コードの目次を作る：node tools/codemap.cjs → docs/CODEMAP.md
// ファイルごとに「区切りのコメント」と「関数・大事な定数」の名前と行番号を並べる。Claude は本体を全部読まずに、ここを grep して必要な行だけ開く。
const fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..');
const files=['index.html','factory.html','survey.html','route-editor.html',...fs.readdirSync(path.join(root,'js')).filter(f=>f.endsWith('.js')).sort().map(f=>'js/'+f),...(fs.existsSync(path.join(root,'js','links'))?fs.readdirSync(path.join(root,'js','links')).filter(f=>f.endsWith('.js')).sort().map(f=>'js/links/'+f):[])];
const out=['# コードの目次（自動で作る：`node tools/codemap.cjs`）','','ファイルごとに、区切りのコメント（■）と、関数・大事な定数の名前と行番号。本体を読む前にここを grep して、必要な行だけ開く。',''];
for(const f of files){const p=path.join(root,f);if(!fs.existsSync(p))continue;const L=fs.readFileSync(p,'utf8').split('\n');const items=[];
  L.forEach((s,i)=>{const n=i+1;let m;
    if((m=/^\s*\/\*\s*-{3,}\s*(.+?)\s*-{3,}/.exec(s))||(m=/^\s*\/\/\s*-{3,}\s*(.+?)\s*-{3,}/.exec(s)))items.push(`■ ${m[1]} …${n}`);
    else if((m=/^\s{0,2}(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/.exec(s)))items.push(`${m[1]}() …${n}`);
    else if((m=/^(?:const|let)\s+([A-Z][A-Z0-9_]{2,}|[A-Za-z_$][\w$]*_UI|[A-Za-z_$][\w$]*Core)\s*=/.exec(s)))items.push(`${m[1]} …${n}`);
    else if((m=/^\s*(?:window|root)\.([A-Za-z_$][\w$]*)\s*=/.exec(s)))items.push(`公開 ${m[1]} …${n}`);});
  if(!items.length)continue;out.push(`## ${f}（${L.length}行）`,'',items.join('・'),'');}
fs.writeFileSync(path.join(root,'docs/CODEMAP.md'),out.join('\n'));
console.log('docs/CODEMAP.md',out.join('\n').length,'字');
