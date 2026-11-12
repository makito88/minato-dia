// 店内画の試作を、通信なしで開ける1ファイルにする。
// node tools/kiosk-scene-export.cjs /path/to/kiosk-scene-demo.html
const fs = require('node:fs'), path = require('node:path');
const root = path.join(__dirname,'..'), output = process.argv[2];
if(!output)throw new Error('出力先のHTMLファイルを指定してください。');
const read = name => fs.readFileSync(path.join(root,name),'utf8');
const config = JSON.parse(read('data/kiosk-scene.json'));
const jsons = {'data/kiosk-scene.json':config};
jsons['data/kiosk-scene-recording.json']=JSON.parse(read('data/kiosk-scene-recording.json'));
jsons['data/kiosk-scene-basket-recording.json']=JSON.parse(read('data/kiosk-scene-basket-recording.json'));
jsons[config.sprites+'frames.json']=JSON.parse(read(config.sprites+'frames.json'));
const images={};
for(const file of [config.sprites+config.basket,config.background,config.sprites+'walk.webp',config.sprites+'reach.webp',config.sprites+config.register.payment,...config.products.map(product=>config.sprites+product.carry)]){
  images[file]='data:image/webp;base64,'+fs.readFileSync(path.join(root,file)).toString('base64');
}
let view=read('js/kiosk-scene-view.js');
const from=view.indexOf('async function json(url) {'), to=view.indexOf('function snapshot() {');
if(from<0||to<0)throw new Error('viewの構造が変わったので、書き出し方法を確認してください。');
view=view.slice(0,from)+'async function json(url){return ASSET_JSON[url];}\n'+view.slice(to);
view=view.replace('img.src = url;','img.src = ASSET_IMAGES[url] || url;');
const js='const ASSET_JSON='+JSON.stringify(jsons)+';\nconst ASSET_IMAGES='+JSON.stringify(images)+';\n'+read('js/kiosk-scene-record.js')+'\n'+read('js/kiosk-scene-core.js')+'\n'+view;
let html=read('kiosk-scene.html')
  .replace('<link rel="stylesheet" href="css/kiosk-scene.css">','<style>'+read('css/kiosk-scene.css')+'</style>')
  .replace('<script src="js/kiosk-scene-record.js"></script><script src="js/kiosk-scene-core.js"></script><script src="js/kiosk-scene-view.js"></script>',()=>'<script>'+js.replaceAll('</script','<\\/script')+'</script>')
  .replace('href="index.html"','href="https://makito88.github.io/minato-dia/"');
fs.mkdirSync(path.dirname(path.resolve(output)),{recursive:true});
fs.writeFileSync(output,html);
console.log(path.resolve(output)+' ('+Buffer.byteLength(html)+' bytes)');
