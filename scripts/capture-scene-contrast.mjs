import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const out=process.env.HAVA81_SCENE_AUDIT_DIR || 'test-results/scene-contrast/screens';
const beforeUrl='https://hava81.zekiakgul.dev';
const afterUrl=process.env.HAVA81_AFTER_URL || 'http://127.0.0.1:4335';
const variants=[
  {label:'desktop-light',width:1440,height:900,theme:'light'},
  {label:'tablet-light',width:768,height:1024,theme:'light'},
  {label:'mobile-light',width:390,height:844,theme:'light'},
  {label:'mobile-dark',width:390,height:844,theme:'dark'},
  {label:'small-mobile-light',width:320,height:720,theme:'light'},
];
const browser=await chromium.launch({
  headless:true,
  executablePath:'/home/ubuntu/Hava81-visual-overhaul-20261009/.pw-browsers/chromium_headless_shell-1234/chrome-linux/headless_shell',
  args:['--no-sandbox','--disable-dev-shm-usage'],
});
await fs.mkdir(out,{recursive:true});
const cache=new Map();
const records=[];
for(const [phase,base] of [['before',beforeUrl],['after',afterUrl]]) {
  for(const variant of variants){
    const page=await browser.newPage({viewport:{width:variant.width,height:variant.height},deviceScaleFactor:1,serviceWorkers:'block'});
    const pageErrors=[];
    page.on('pageerror',error=>pageErrors.push(error.message));
    await page.addInitScript(({theme})=>{
      localStorage.setItem('user-settings',JSON.stringify({temperatureUnit:'metric',windSpeedUnit:'ms',language:'tr',themeMode:theme}));
    },{theme:variant.theme});
    if(phase==='after') await page.route('**/api/v1/**',async route=>{
      const url=new URL(route.request().url());
      const key=url.pathname+url.search;
      try {
        let data=cache.get(key);
        if(!data){
          const response=await route.fetch({url:'https://api.hava81.zekiakgul.dev'+key,timeout:18000});
          data={status:response.status(),body:await response.body(),contentType:response.headers()['content-type']||'application/json'};
          if(response.ok())cache.set(key,data);
        }
        await route.fulfill(data);
      } catch(error){pageErrors.push('API mirror '+error.message);await route.abort();}
    });
    try {
      const response=await page.goto(base+'/izmir/',{waitUntil:'domcontentloaded',timeout:28000});
      const hero=page.locator('.decision-glance').first();
      await hero.waitFor({state:'visible',timeout:24000});
      // Wait for actual decision score: a loading card is not meaningful
      // before/after evidence of the finished weather experience.
      await hero.locator('.decision-glance__score').waitFor({state:'visible',timeout:25000});
      await page.waitForTimeout(150);
      const status=await hero.evaluate(element=>{
        const css=getComputedStyle(element);
        return {
          night:element.getAttribute('data-night'),
          scene:element.getAttribute('data-weather-scene'),
          gradient:css.backgroundImage,
          headlineColor:getComputedStyle(element.querySelector('.decision-glance__message')).color,
          overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,
          renderedWidth:Math.round(element.getBoundingClientRect().width),
          mode:document.querySelector('.app')?.getAttribute('data-color-mode'),
        };
      });
      const dest=path.join(out,phase+'-'+variant.label+'.png');
      await hero.screenshot({path:dest,animations:'disabled',timeout:24000});
      records.push({phase,variant:variant.label,status:response?.status(),...status,errors:pageErrors,file:dest});
      console.log('CAPTURE',phase,variant.label,status.night,status.scene,status.mode,'overflow?',status.overflow);
    }catch(error){records.push({phase,variant:variant.label,error:error.message,errors:pageErrors});console.log('ERROR',phase,variant.label,error.message);}
    finally{await page.close();}
  }
}
await browser.close();
await fs.writeFile(path.join(out,'report.json'),JSON.stringify(records,null,2));
const failures=records.filter(item=>item.error||item.errors?.length||item.status!==200||item.overflow);
console.log('SCENE_AUDIT',records.length-failures.length,'/',records.length);
if(failures.length)process.exitCode=1;
