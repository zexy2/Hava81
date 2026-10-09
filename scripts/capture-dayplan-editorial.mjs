import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
const output = process.env.HAVA81_DAYPLAN_OUTPUT || '.visual-dayplan/captures';
const live = process.env.HAVA81_DAYPLAN_BEFORE_URL || 'https://hava81.zekiakgul.dev';
const preview = process.env.HAVA81_DAYPLAN_AFTER_URL || 'http://127.0.0.1:45987';
const variants = [
  ['desktop-light',1440,900,'light',false], ['tablet-light',768,1024,'light',false],
  ['mobile-light',390,844,'light',false], ['mobile-dark',390,844,'dark',false],
  ['compact-light',320,700,'light',false], ['desktop-text-200',1280,900,'light',true],
  ['mobile-text-200',390,844,'light',true],
];
const responseCache = new Map();
const records = [];
await fs.mkdir(output,{recursive:true});
const browser = await chromium.launch({headless:true});
for(const [phase,base] of [['before',live],['after',preview]]){
 if(process.env.HAVA81_DAYPLAN_PHASE && phase!==process.env.HAVA81_DAYPLAN_PHASE)continue;
 for(const [name,width,height,theme,zoom] of variants){
  if(process.env.HAVA81_DAYPLAN_VARIANT && name!==process.env.HAVA81_DAYPLAN_VARIANT)continue;
  const page = await browser.newPage({viewport:{width,height},deviceScaleFactor:1,locale:'tr-TR',reducedMotion:'reduce',serviceWorkers:'block'});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(color=>localStorage.setItem('user-settings',JSON.stringify({temperatureUnit:'metric',windSpeedUnit:'ms',language:'tr',themeMode:color})),theme);
  if(phase==='after') await page.route('**/api/v1/weather/**',async route=>{
   const u=new URL(route.request().url());const k=u.pathname+u.search;
   try{
    let v=responseCache.get(k);
    if(!v){
      const response=await route.fetch({url:'https://api.hava81.zekiakgul.dev'+k,timeout:16000});
      v={status:response.status(),body:await response.body(),headers:{'content-type':'application/json','access-control-allow-origin':'*'}};
      if(response.ok())responseCache.set(k,v);
    }
    await route.fulfill(v);
   }catch(err){errors.push('API '+String(err));await route.abort();}
  });
  try{
   const response=await page.goto(base+'/izmir/',{waitUntil:'domcontentloaded',timeout:28000});
   const section=page.locator('section.daily-plan');
   await section.locator('.daily-plan__slot').first().waitFor({state:'visible',timeout:18000});
   if(zoom)await page.locator('html').evaluate(el=>el.style.fontSize='200%');
   await section.scrollIntoViewIfNeeded();
   await page.addStyleTag({content:'.atlas-header,.atlas-bottom-nav,.skip-link,.skip-to-content{visibility:hidden!important}'});
   await page.waitForTimeout(270);
   const filename=path.join(output,phase+'-'+name+'.png');
   await section.screenshot({path:filename,animations:'disabled',timeout:27000});
   const m=await page.evaluate(()=>{
    const cs=[...document.querySelectorAll('.daily-plan__slot')];
    return {viewportWidth:document.documentElement.clientWidth,documentWidth:document.documentElement.scrollWidth,
     theme:document.querySelector('.app')?.getAttribute('data-color-mode'),cards:cs.length,
     scores:cs.map(c=>Number(c.querySelector('strong')?.textContent)),best:cs.filter(c=>c.classList.contains('is-best-window')).length,
     meters:cs.filter(c=>c.getAttribute('style')?.includes('--hour-score:')).length};
   });
   const record={phase,variant:name,http:response.status(),filename,errors,...m};
   records.push(record);console.log('CAPTURE',JSON.stringify(record));
  }catch(err){const record={phase,variant:name,error:String(err).slice(0,300),errors};records.push(record);console.log('FAILED',JSON.stringify(record));}
  await page.close();
 }
}
await browser.close();
await fs.writeFile(path.join(output,'audit.json'),JSON.stringify(records,null,2));
const fail=records.filter(r=>r.error||r.errors.length||r.http!==200||r.documentWidth>r.viewportWidth+1||r.cards!==12||r.theme!==(r.variant.includes('dark')?'dark':'light')||(r.phase==='after'&&(r.best<1||r.meters!==12)));
console.log('AUDIT',records.length-fail.length,'/',records.length);
if(fail.length)process.exitCode=1;
