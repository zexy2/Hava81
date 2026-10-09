import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const output=process.env.HAVA81_VISUAL_DIR||'test-results/mobile-dock/screens';
const before=process.env.HAVA81_BEFORE_URL||'https://hava81.zekiakgul.dev';
const after=process.env.HAVA81_AFTER_URL||'http://127.0.0.1:4205';
const variants=[
 {id:'phone390-light',width:390,height:844,theme:'light',zoom:100},
 {id:'phone390-dark',width:390,height:844,theme:'dark',zoom:100},
 {id:'phone320-light',width:320,height:720,theme:'light',zoom:100},
 {id:'phone320-dark',width:320,height:720,theme:'dark',zoom:100},
 {id:'phone390-zoom200',width:390,height:844,theme:'light',zoom:200},
 {id:'phone320-zoom200',width:320,height:844,theme:'light',zoom:200}
];
const browser=await chromium.launch({headless:true,executablePath:'/home/ubuntu/Hava81-visual-overhaul-20261009/.pw-browsers/chromium_headless_shell-1234/chrome-linux/headless_shell',args:['--no-sandbox','--disable-dev-shm-usage']});
const results=[],cache=new Map();
await fs.mkdir(output,{recursive:true});
for(const [phase,url] of [['before',before],['after',after]])for(const v of variants){
 const page=await browser.newPage({viewport:{width:v.width,height:v.height},deviceScaleFactor:1,serviceWorkers:'block'});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(({theme})=>localStorage.setItem('user-settings',JSON.stringify({temperatureUnit:'metric',windSpeedUnit:'ms',language:'tr',themeMode:theme,notificationsEnabled:false})),{theme:v.theme});
 if(phase==='after')await page.route('**/api/v1/**',async route=>{
  const u=new URL(route.request().url()),key=u.pathname+u.search;
  try {
    let value=cache.get(key);
    if(!value) {const res=await route.fetch({url:'https://api.hava81.zekiakgul.dev'+key,timeout:18000});value={status:res.status(),body:await res.body(),contentType:res.headers()['content-type']||'application/json'};if(res.ok())cache.set(key,value);}
    await route.fulfill(value);
  }catch(e){errors.push('API mirror '+e.message);await route.abort();}
 });
 try{
  const response=await page.goto(url+'/izmir/',{waitUntil:'domcontentloaded',timeout:30000});
  const nav=page.locator('.atlas-bottom-nav');
  await nav.waitFor({state:'visible',timeout:25000});
  if(v.zoom!==100)await page.evaluate(size=>document.documentElement.style.fontSize=size+'%',v.zoom);
  await page.waitForTimeout(200);
  const name=phase+'-'+v.id;
  await page.screenshot({path:path.join(output,name+'-fold.png'),animations:'disabled',timeout:25000});
  await nav.screenshot({path:path.join(output,name+'-nav.png'),animations:'disabled',timeout:25000});
  const metrics=await nav.evaluate(el=>{
   const nr=el.getBoundingClientRect();
   const buttons=[...el.querySelectorAll('button')];
   const rects=buttons.map(e=>{const r=e.getBoundingClientRect(),label=e.querySelector('.atlas-bottom-nav__label').getBoundingClientRect();return {x:r.x,right:r.right,width:r.width,height:r.height,outerBottom:r.bottom,label:{left:label.left,right:label.right,top:label.top,bottom:label.bottom}}});
   return {nav:{x:nr.x,right:nr.right,y:nr.y,bottom:nr.bottom,height:nr.height},pageWidth:document.documentElement.scrollWidth,viewport:innerWidth,buttons:rects,activeCount:el.querySelectorAll('[aria-current="page"]').length,background:getComputedStyle(el).backgroundImage};
  });
  const fits=metrics.buttons.every(b=>b.width>=44&&b.height>=44&&b.label.left>=b.x-1&&b.label.right<=b.right+1&&b.label.bottom<=b.outerBottom+1);
  const separated=metrics.buttons.every((b,i)=>i===0||b.label.left>=metrics.buttons[i-1].label.right-1);
  const entry={name,status:response?.status(),errors,fit:fits,separated,...metrics};
  results.push(entry);
  console.log('CAPTURE',name,JSON.stringify({status:entry.status,errors:errors.length,overflow:metrics.pageWidth-metrics.viewport,fit:fits,separated,dockHeight:metrics.nav.height}));
 }catch(e){results.push({name:phase+'-'+v.id,error:e.message,errors});console.log('FAILED',phase,v.id,e.message)}
 finally{await page.close()}
}
await browser.close();
await fs.writeFile(path.join(output,'report.json'),JSON.stringify(results,null,2));
const failed=results.filter(x=>x.error||x.errors?.length||x.status!==200||!x.fit||!x.separated||x.pageWidth>x.viewport||x.activeCount!==1);
console.log('VISUAL_AUDIT',results.length-failed.length,'/',results.length);
if(failed.length)process.exitCode=1;
