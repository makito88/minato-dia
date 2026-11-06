import json,sys
exec(open('cal2.py').read().split('with sync_playwright')[0])
HOOK="""(()=>{window.__c={raf:0};const r=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=f=>r(t=>{__c.raf++;f(t);});})();"""
WRAP="""(()=>{for(const [n,k] of [['drawMap','map'],['drawDia','dia']]){const o=eval(n);__c[k]=0;const w=function(){__c[k]++;return o.apply(this,arguments)};eval(n+'=w');}
 const t=ENSEN_UI.tick;__c.ens=0;ENSEN_UI.tick=function(){__c.ens++;return t.apply(this,arguments)};})()"""
def M(cdp):return {x['name']:x['value'] for x in cdp.send('Performance.getMetrics')['metrics']}
out={}
def run(pg,cdp,sec,key):
  pg.evaluate("()=>{for(const k in __c)__c[k]=0}");s=pg.evaluate("[T,performance.now()]")
  a=M(cdp);pg.wait_for_timeout(sec*1000);b=M(cdp);c=pg.evaluate("__c");e=pg.evaluate("[T,performance.now(),speed,playing]")
  rate=(e[0]-s[0])/((e[1]-s[1])/1000)/e[2] if e[3] else 0
  r=dict(task=(b['TaskDuration']-a['TaskDuration'])/sec*100,js=(b['ScriptDuration']-a['ScriptDuration'])/sec*100,layout=(b['LayoutCount']-a['LayoutCount'])/sec,raf=c['raf']/sec,map=c['map']/sec,dia=c['dia']/sec,ens=c['ens']/sec,time_ok=round(rate,3))
  out[key]=r;print(f"{key:22s} 仕事{r['task']:5.1f}% JS{r['js']:4.1f}% 配置計算{r['layout']:5.1f}/秒 rAF{r['raf']:6.1f}/秒 地図{r['map']:4.1f}/秒 ダイヤ図{r['dia']:4.1f}/秒 沿線暦tick{r['ens']:5.1f}/秒 時間の進み(速さ比){r['time_ok']}",flush=True)
with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
  ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=3,is_mobile=True,has_touch=True);ctx.add_init_script(SEED);ctx.add_init_script(HOOK)
  pg=ctx.new_page();errs=[];pg.on('pageerror',lambda e:errs.append(str(e)));cdp=ctx.new_cdp_session(pg);cdp.send('Performance.enable')
  pg.goto('http://localhost:8765/index.html');pg.wait_for_timeout(8000)
  if pg.locator('#awayOk').count():pg.locator('#awayOk').click()
  pg.add_script_tag(content=WRAP);pg.wait_for_timeout(300)
  run(pg,cdp,6,'A トップ（再生中・×1）')
  pg.evaluate("()=>{document.getElementById('topv').hidden=true;speed=1/60}");run(pg,cdp,6,'B 地図・再生中×1')
  pg.evaluate("()=>{speed=0.5}");run(pg,cdp,6,'B2 地図・再生中×30')
  pg.evaluate("()=>{speed=3}");run(pg,cdp,6,'C 地図・再生中×180');pg.evaluate("()=>{speed=1/60}")
  pg.evaluate("()=>setPlay(false)");run(pg,cdp,6,'D 地図・一時停止')
  pg.evaluate("()=>setPlay(true)");pg.evaluate("minatoKiosk.open()");pg.wait_for_timeout(500);run(pg,cdp,6,'E 売店を開く(再生中)')
  ks=pg.evaluate("()=>{const r=minatoKiosk.today;return r&&[r.day,r.pl.sales,Math.round(r.pl.profit),r.ev.length]}")
  pg.evaluate("()=>document.getElementById('ksClose').click()");pg.wait_for_timeout(300)
  print('売店のきょうの結果',ks,'運行日',pg.evaluate('ENS.day'),'エラー',errs)
  out['kiosk']=ks;json.dump(out,open(sys.argv[1],'w'),ensure_ascii=False)
  b.close()
