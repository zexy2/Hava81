import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const outputDir = process.env.HAVA81_ENV_AUDIT_DIR ?? 'test-results/environment-metrics/screens';
const phases = [
  ['before', process.env.HAVA81_ENV_BEFORE_URL ?? 'https://hava81.zekiakgul.dev'],
  ['after', process.env.HAVA81_ENV_AFTER_URL ?? 'http://127.0.0.1:4204']
];
const states = [
  {name:'desktop-light',width:1440,height:900,theme:'light'},
  {name:'tablet-light',width:768,height:1024,theme:'light'},
  {name:'mobile-light',width:390,height:844,theme:'light'},
  {name:'mobile-dark',width:390,height:844,theme:'dark'},
  {name:'compact-light',width:320,height:720,theme:'light'}
];
const browser=await chromium.launch({headless:true,
 executablePath:process.env.HAVA81_CHROMIUM_EXECUTABLE_PATH || undefined,
 args:['--no-sandbox','--disable-dev-shm-usage']});
const cache=new Map(),reports=[];
await fs.mkdir(outputDir,{recursive:true});
for(const [phase,baseUrl] of phases) for(const v of states) {
 const page=await browser.newPage({viewport:{width:v.width,height:v.height},deviceScaleFactor:1,serviceWorkers:'block'});
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(({theme})=>{
   localStorage.setItem('user-settings', JSON.stringify({
     temperatureUnit:'metric',windSpeedUnit:'ms',language:'tr',themeMode:theme,
   }));
 },{theme:v.theme});
 if(phase==='after') await page.route('**/api/v1/**', async route=>{
   const request=new URL(route.request().url());
   const key=request.pathname+request.search;
   try{
     let entry=cache.get(key);
     if(!entry){
       const response=await route.fetch({url:'https://api.hava81.zekiakgul.dev'+key,timeout:20000});
       entry={status:response.status(),contentType:response.headers()['content-type']||'application/json',body:await response.body()};
       if(response.ok())cache.set(key,entry);
     }
     await route.fulfill(entry);
   }catch(err){errors.push('API mirror '+err.message);await route.abort();}
 });
 try{
   const response=await page.goto(baseUrl+'/izmir/',{waitUntil:'domcontentloaded',timeout:30000});
   const rail=page.locator('.environment-rail');
   await rail.waitFor({state:'visible',timeout:20000});
   const key=phase+'-'+v.name;
   // Freeze below-the-fold intrinsic layout for screenshot evidence. Without
   // this, content-visibility:auto can change preceding card positions
   // while Playwright calculates the rail's screenshot clip.
   await page.addStyleTag({content:'.atlas-dashboard > .activity-planner,.atlas-dashboard > .context-signals,.atlas-dashboard > .decision-alerts,.atlas-dashboard > .commute-plan,.atlas-dashboard > .route-weather {content-visibility:visible!important}'});
   // Layout may rerender while weather freshness data settles. Reacquire
   // the rail if that happens; only capture stable element geometry.
   for(let attempt=0;attempt<4;attempt++){
     try{await rail.scrollIntoViewIfNeeded({timeout:4500});break}
     catch(err){if(attempt===3)throw err;await page.waitForTimeout(300)}
   }
   await page.waitForTimeout(350);
   await rail.screenshot({path:path.join(outputDir,key+'-rail.png'),animations:'disabled',timeout:22000});
   await page.screenshot({path:path.join(outputDir,key+'-fold.png'),animations:'disabled',timeout:22000});
   const m=await rail.evaluate(el=>{
     const measures=node=>{const r=node.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}};
     const modules=[...el.querySelectorAll('.environment-rail__module')];
     return {
       frame:measures(el),
       firstCardBackground:getComputedStyle(modules[0]).backgroundImage,
       count:modules.length,
       cards:modules.map(m=>({size:measures(m),background:getComputedStyle(m).backgroundImage,
         corners:getComputedStyle(m).borderRadius,heading:m.querySelector('.environment-rail__label')?.textContent})),
       overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
     };
   });
   reports.push({name:key,phase,variant:v.name,httpStatus:response?.status(),errors,...m});
   console.log('CAPTURE',key,JSON.stringify({status:response?.status(),overflow:m.overflow,cards:m.count,errors}));
 }catch(error){reports.push({name:phase+'-'+v.name,error:error.message,errors});console.error('ERROR',phase,v.name,error.message)}
 finally{await page.close()}
}
await browser.close();
await fs.writeFile(path.join(outputDir,'report.json'),JSON.stringify(reports,null,2));
const failures=reports.filter(x=>x.error||x.errors?.length||x.httpStatus!==200||x.overflow>1||x.count!==4||(x.phase==='after'&&!x.firstCardBackground.includes('radial-gradient')));
console.log('AUDIT',reports.length-failures.length,'/',reports.length);
if(failures.length)process.exitCode=1;
