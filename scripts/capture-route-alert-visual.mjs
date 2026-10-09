import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const out = process.env.HAVA81_VISUAL_DIR || 'test-results/route-alert/screens';
const before = process.env.HAVA81_BEFORE_URL || 'https://hava81.zekiakgul.dev';
const after = process.env.HAVA81_AFTER_URL || 'http://127.0.0.1:4199';
const cases = [
  {name:'desktop-light',w:1440,h:900,theme:'light'},
  {name:'tablet-light',w:768,h:1024,theme:'light'},
  {name:'mobile-light',w:390,h:844,theme:'light'},
  {name:'mobile-dark',w:390,h:844,theme:'dark'},
  {name:'compact-light',w:320,h:720,theme:'light'},
];
const browser = await chromium.launch({headless:true,executablePath:
 '/home/ubuntu/Hava81-visual-overhaul-20261009/.pw-browsers/chromium_headless_shell-1234/chrome-linux/headless_shell',
 args:['--no-sandbox','--disable-dev-shm-usage']});
await fs.mkdir(out,{recursive:true});
const cache=new Map(),results=[];
for(const [phase,url] of [['before',before],['after',after]])for(const v of cases){
 const page=await browser.newPage({viewport:{width:v.w,height:v.h},deviceScaleFactor:1,serviceWorkers:'block'});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(({theme})=>localStorage.setItem('user-settings',JSON.stringify({
  temperatureUnit:'metric',windSpeedUnit:'ms',language:'tr',themeMode:theme,notificationsEnabled:false
 })),{theme:v.theme});
 if(phase==='after')await page.route('**/api/v1/**',async route=>{
   const url=new URL(route.request().url()),key=url.pathname+url.search;
   try{
    let value=cache.get(key);
    if(!value){
      const res=await route.fetch({url:'https://api.hava81.zekiakgul.dev'+key,timeout:18000});
      value={status:res.status(),body:await res.body(),contentType:res.headers()['content-type']||'application/json'};
      if(res.ok())cache.set(key,value);
    }
    await route.fulfill(value);
   }catch(e){errors.push('API proxy '+e.message);await route.abort()}
 });
 try{
  const res=await page.goto(url+'/istanbul/',{waitUntil:'domcontentloaded',timeout:30000});
  const route=page.locator('.route-weather').first();
  const alert=page.locator('.decision-alerts').first();
  await route.waitFor({state:'attached',timeout:25000});
  await alert.waitFor({state:'attached',timeout:25000});
  await page.addStyleTag({content:'.atlas-header,.atlas-bottom-nav,.skip-link{visibility:hidden!important}'});
  await alert.scrollIntoViewIfNeeded();
  await alert.screenshot({path:path.join(out,phase+'-'+v.name+'-alerts.png'),animations:'disabled',timeout:25000});
  await route.locator('summary').click({timeout:10000});
  await route.locator('.route-weather__form').waitFor({state:'visible',timeout:12000});
  await route.screenshot({path:path.join(out,phase+'-'+v.name+'-route.png'),animations:'disabled',timeout:25000});
  // When upstream route data is available, also document the score and
  // five corridor segments. Never fabricate a weather response.
  let routeResultCaptured=false;
  try {
    const submit=route.getByRole('button',{name:/koridoru kontrol et/i});
    if((v.name==='desktop-light'||v.name==='mobile-light') && await submit.isEnabled()){
      await submit.click({timeout:7000});
      await route.locator('.route-weather__result').waitFor({state:'visible',timeout:13000});
      await route.screenshot({path:path.join(out,phase+'-'+v.name+'-result.png'),animations:'disabled',timeout:25000});
      routeResultCaptured=true;
    }
  }catch(e){console.log('ROUTE_RESULT_NOT_AVAILABLE',phase,v.name,e.message.slice(0,100))}
  const m=await route.evaluate(el=>{
    const rect=x=>{const r=x.getBoundingClientRect();return{w:Math.round(r.width),h:Math.round(r.height)}};
    const style=getComputedStyle(el), form=el.querySelector('.route-weather__form');
    return {radius:style.borderRadius,background:style.backgroundColor,frame:rect(el),form:rect(form)};
  });
  results.push({phase,name:v.name,status:res?.status(),routeResultCaptured,...m,viewport:v.w,pageWidth:await page.evaluate(()=>document.documentElement.scrollWidth),errors});
  console.log('CAPTURED',phase,v.name,'status='+res?.status(),'errors='+errors.length);
 }catch(e){results.push({phase,name:v.name,error:e.message,errors});console.log('FAILED',phase,v.name,e.message)}
 finally{await page.close()}
}
await browser.close();
await fs.writeFile(path.join(out,'report.json'),JSON.stringify(results,null,2));
const fail=results.filter(x=>x.error||x.errors?.length||x.status!==200||x.pageWidth>x.viewport);
console.log('CAPTURED',results.length-fail.length,'/',results.length);
if(fail.length)process.exitCode=1;
