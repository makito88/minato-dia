// 小さな検査（2026-11-09）：node tools/lint.cjs
//  1) js/ と HTML の中のスクリプトが、文法として読めるか（node --check と同じ）
//  2) 行の途中の // コメントのうしろに、処理（○○(…); や ;x=…）が続いていないか
//     （11/6〜11/9 に、新しい店を出す処理の一部がコメントのうしろに入って動いていなかった）
//     わざとそう書くときは、その行に lint-ok と書く
//  3) HTML が読み込むローカルのファイルがあるか
// 問題があれば、場所を出して 1 で終わる（GitHub Actions でも使う）
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),bad=[];
const rel=f=>path.relative(root,f);
function walk(d,out){for(const n of fs.readdirSync(d)){const p=path.join(d,n);if(n==='proto'||n==='node_modules'||n.startsWith('.'))continue;const s=fs.statSync(p);if(s.isDirectory())walk(p,out);else out.push(p);}return out;}
const files=walk(root,[]);
// 1) 文法
function compile(src,name){try{new vm.Script(src,{filename:name});}catch(e){bad.push(`${name}: 文法のまちがい ${e.message}`);}}
const jsFiles=files.filter(f=>/\.(c?js)$/.test(f)&&(rel(f).startsWith('js'+path.sep)||rel(f).startsWith('tools'+path.sep)||rel(f).startsWith('tests'+path.sep)));
for(const f of jsFiles)compile(fs.readFileSync(f,'utf8').replace(/^#!.*/,''),rel(f));
const htmls=files.filter(f=>f.endsWith('.html'));
for(const f of htmls){const t=fs.readFileSync(f,'utf8');let m,re=/<script(?![^>]*\bsrc=)(?![^>]*type="(?:application\/json|text\/plain|module)")[^>]*>([\s\S]*?)<\/script>/g,i=0;
  while((m=re.exec(t))){i++;const before=t.slice(0,m.index).split('\n').length;compile('\n'.repeat(before-1)+m[1],`${rel(f)}（${i}番目のscript）`);}
  // 3) 読み込むファイル
  let s,rs=/<script[^>]*\bsrc="([^"?#]+)[^"]*"/g;while((s=rs.exec(t))){if(/^https?:/.test(s[1]))continue;if(!fs.existsSync(path.join(path.dirname(f),s[1])))bad.push(`${rel(f)}: ${s[1]} がない`);}}
// 2) コメントのうしろの処理
const codeAfter=/(?:[A-Za-z_$][\w$.]*\([^()]{0,80}\)\s*;\s*[A-Za-z_$])|(?:;\s*[A-Za-z_$][\w$]*(?:\.[\w$]+)+\s*=[^=])/;
function commentStart(line){let q=null;for(let i=0;i<line.length-1;i++){const c=line[i];if(q){if(c==='\\'){i++;continue;}if(c===q)q=null;continue;}
    if(c==='"'||c==="'"||c==='`'){q=c;continue;}if(c==='/'&&line[i+1]==='/'&&line[i-1]!==':'&&line[i-1]!=='\\')return i;}return -1;}
for(const f of jsFiles.filter(f=>rel(f).startsWith('js'+path.sep)).concat(htmls)){const L=fs.readFileSync(f,'utf8').split('\n');
  L.forEach((line,k)=>{if(line.includes('lint-ok'))return;const i=commentStart(line);if(i<0)return;const before=line.slice(0,i);if(!/\S/.test(before))return;   // 行の先頭からのコメントは見ない
    const after=line.slice(i+2);if(codeAfter.test(after))bad.push(`${rel(f)}:${k+1}: コメントのうしろに処理があるように見えます → ${after.trim().slice(0,90)}`);});}
if(bad.length){console.log('lint: 問題 '+bad.length+'件');for(const b of bad)console.log('  '+b);process.exit(1);}
console.log(`lint ok（スクリプト ${jsFiles.length}・HTML ${htmls.length}）`);
