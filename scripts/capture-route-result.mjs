import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
const output = process.env.HAVA81_ROUTE_OUTPUT || 'test-results/route-alert/screens';
const phases = [['before','https://hava81.zekiakgul.dev'],['after',process.env.HAVA81_AFTER_URL||'http://127.0.0.1:4200']];
const devices = [{name:'desktop-light',w:1440,h:900},{name:'mobile-light',w:390,h:844}];
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'/home/ubuntu/Hava81-visual-overhaul-20261009/.pw-browsers/chromium_headless_shell-1234/chrome-linux/headless_shell',args:['--no-sandbox']});
const reports=[],cache=new Map();
for(const [phase,base] of phases)for(const d of devices){
 const page=await browser.newPage({viewport:{width:d.w,height:d.h},serviceWorkers:'block'});
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>localStorage.setItem('user-settings',JSON.stringify({temperatureUnit:'metric',windSpeedUnit:'ms',language:'tr',themeMode:'light',notificationsEnabled:false})));
 if(phase==='after')await page.route('**/api/v1/**',async route=>{
  try {
   const url=new URL(route.request().url()),key=url.pathname+url.search;
   let data=cache.get(key);
   if(!data){const response=await route.fetch({url:'https://api.hava81.zekiakgul.dev'+key,timeout:18000});data={status:response.status(),contentType:response.headers()['content-type']||'application/json',body:await response.body()};if(response.ok())cache.set(key,data)}
   await route.fulfill(data);
  }catch(e){errors.push('mirror '+e.message);await route.abort()}
 });
 try{
  await page.goto(base+'/istanbul/',{waitUntil:'domcontentloaded',timeout:30000});
  const route=page.locator('.route-weather');
  await route.locator('summary').click();
  await route.getByRole('button',{name:/koridoru kontrol et/i}).click();
  await route.locator('.route-weather__segments').waitFor({state:'visible',timeout:22000});
  await page.addStyleTag({content:'.atlas-header,.atlas-bottom-nav,.skip-link{visibility:hidden!important}'});
  const filename=path.join(output,phase+'-'+d.name+'-result.png');
  await route.screenshot({path:filename,animations:'disabled',timeout:22000});
  reports.push({phase,device:d.name,ok:!errors.length,errors,filename});
  console.log('RESULT_CAPTURED',phase,d.name);
 }catch(e){reports.push({phase,device:d.name,ok:false,error:e.message,errors});console.log('RESULT_FAILED',phase,d.name,e.message)}
 finally{await page.close()}
}
await browser.close();
await fs.writeFile(path.join(output,'route-result-report.json'),JSON.stringify(reports,null,2));
if(reports.some(r=>!r.ok))process.exitCode=1;
