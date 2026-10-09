import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
const output=process.env.HAVA81_VISUAL_DIR||'test-results/planning-visual/screens';
const variants=[
 {name:'desktop-light',width:1440,height:900,theme:'light'},
 {name:'tablet-light',width:768,height:1024,theme:'light'},
 {name:'mobile-light',width:390,height:844,theme:'light'},
 {name:'mobile-dark',width:390,height:844,theme:'dark'},
 {name:'compact-light',width:320,height:720,theme:'light'}
];
const source='https://hava81.zekiakgul.dev';
const preview=process.env.HAVA81_PREVIEW_URL||'http://127.0.0.1:4198';
const sections=['daily-plan','commute-plan','activity-planner'];
const cache=new Map(),results=[];
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'/home/ubuntu/Hava81-visual-overhaul-20261009/.pw-browsers/chromium_headless_shell-1234/chrome-linux/headless_shell',args:['--no-sandbox','--disable-dev-shm-usage']});
for(const [stage,baseUrl] of [['before',source],['after',preview]])for(const v of variants){
const page=await browser.newPage({viewport:{width:v.width,height:v.height},deviceScaleFactor:1,serviceWorkers:'block'});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(({theme})=>localStorage.setItem('user-settings',JSON.stringify({temperatureUnit:'metric',windSpeedUnit:'ms',language:'tr',themeMode:theme})),{theme:v.theme});
if(stage==='after')await page.route('**/api/v1/**',async route=>{
 const url=new URL(route.request().url()), key=url.pathname+url.search;
 try{
  let data=cache.get(key);
  if(!data){
   const response=await route.fetch({url:'https://api.hava81.zekiakgul.dev'+key,timeout:20000});
   data={status:response.status(),contentType:response.headers()['content-type']||'application/json',body:await response.body()};
   if(response.ok())cache.set(key,data);
  }
  await route.fulfill(data);
 } catch(e){errors.push('API mirror '+e.message);await route.abort();}
});
try{
 const response=await page.goto(baseUrl+'/izmir/',{waitUntil:'domcontentloaded',timeout:30000});
 await page.locator('.daily-plan').waitFor({state:'attached',timeout:25000});
 // Screenshot documentation only: sticky navigation can otherwise overlay
 // offscreen element captures despite correct on-page positioning.
 await page.addStyleTag({content: '.atlas-header, .atlas-bottom-nav, .skip-link, .skip-to-content {visibility:hidden !important} '});
 for(const section of sections){
  const element=page.locator('.'+section).first();
  await element.scrollIntoViewIfNeeded({timeout:12000});
  await element.waitFor({state:'visible',timeout:12000});
  await page.waitForTimeout(210);
  await element.screenshot({path:path.join(output,stage+'-'+v.name+'-'+section+'.png'),timeout:25000,animations:'disabled'});
 }
 const metrics=await page.evaluate(()=>{
  const names=['daily-plan','commute-plan','activity-planner'];
  const data=Object.fromEntries(names.map(name=>{
   const el=document.querySelector('.'+name),s=getComputedStyle(el);
   return [name,{background:s.backgroundColor,border:s.borderWidth,radius:s.borderRadius,shadow:s.boxShadow,width:Math.round(el.getBoundingClientRect().width),children:el.children.length}];
  }));
  return {pageWidth:document.documentElement.scrollWidth,viewportWidth:innerWidth,sections:data};
 });
 results.push({stage,variant:v.name,status:response?.status(),errors,...metrics});
 console.log('CAPTURE',stage,v.name,JSON.stringify({status:response?.status(),overflow:metrics.pageWidth-metrics.viewportWidth,errors}));
}catch(e){results.push({stage,variant:v.name,error:e.message,errors});console.log('FAILED',stage,v.name,e.message)}
finally{await page.close()}
}
await browser.close();
await fs.writeFile(path.join(output,'audit.json'),JSON.stringify(results,null,2));
const bad=results.filter(x=>x.error||x.errors?.length||x.status!==200||x.pageWidth>x.viewportWidth);
console.log('RESULT',results.length-bad.length,'/',results.length);
if(bad.length)process.exitCode=1;
