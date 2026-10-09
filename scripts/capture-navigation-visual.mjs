import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const out=process.env.HAVA81_VISUAL_DIR || 'test-results/navigation-visual/screens';
const previous=process.env.HAVA81_BEFORE_URL || 'https://hava81.zekiakgul.dev';
const preview=process.env.HAVA81_AFTER_URL || 'http://127.0.0.1:4203';
const variants=[
 {name:'desktop-light',width:1440,height:900,theme:'light'},
 {name:'tablet-light',width:768,height:1024,theme:'light'},
 {name:'mobile-light',width:390,height:844,theme:'light'},
 {name:'mobile-dark',width:390,height:844,theme:'dark'},
 {name:'compact-light',width:320,height:720,theme:'light'}
];
const browser=await chromium.launch({headless:true,
 executablePath:'/home/ubuntu/Hava81-visual-overhaul-20261009/.pw-browsers/chromium_headless_shell-1234/chrome-linux/headless_shell',
 args:['--no-sandbox','--disable-dev-shm-usage']});
const cache=new Map(),results=[];
await fs.mkdir(out,{recursive:true});
for(const [phase,base] of [['before',previous],['after',preview]])for(const v of variants){
 const page=await browser.newPage({viewport:{width:v.width,height:v.height},deviceScaleFactor:1,serviceWorkers:'block'});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(({theme})=>localStorage.setItem('user-settings',
  JSON.stringify({temperatureUnit:'metric',windSpeedUnit:'ms',language:'tr',themeMode:theme,notificationsEnabled:false})),{theme:v.theme});
 if(phase==='after')await page.route('**/api/v1/**',async route=>{
  const url=new URL(route.request().url()),key=url.pathname+url.search;
  try{
   let value=cache.get(key);
   if(!value){
    const response=await route.fetch({url:'https://api.hava81.zekiakgul.dev'+key,timeout:20000});
    value={status:response.status(),body:await response.body(),contentType:response.headers()['content-type']||'application/json'};
    if(response.ok())cache.set(key,value);
   }
   await route.fulfill(value);
  }catch(e){errors.push(e.message);await route.abort()}
 });
 try {
  const response=await page.goto(base+'/izmir/',{waitUntil:'domcontentloaded',timeout:30000});
  const header=page.locator('.atlas-header');
  await header.waitFor({state:'visible',timeout:20000});
  const label=phase+'-'+v.name;
  await header.screenshot({path:path.join(out,label+'-header.png'),animations:'disabled'});
  await page.screenshot({path:path.join(out,label+'-fold.png'),animations:'disabled'});
  const isMobile=v.width<768;
  if(isMobile)await page.locator('.atlas-icon-button--search').click();
  await page.locator('.search-bar__input:visible').waitFor({state:'visible'});
  await page.locator('.search-bar__input:visible').fill('Ank');
  await page.locator('.search-bar__suggestions:visible').first().waitFor({state:'visible',timeout:12000});
  await page.waitForTimeout(180);
  await page.screenshot({path:path.join(out,label+'-search.png'),animations:'disabled'});
  const report=await page.evaluate(()=>{
   const rect=s=>{const e=document.querySelector(s);if(!e)return null;const x=e.getBoundingClientRect();return{x:Math.round(x.x),y:Math.round(x.y),w:Math.round(x.width),h:Math.round(x.height)}};
   const header=document.querySelector('.atlas-header');
   const actions=document.querySelector('.atlas-header__actions');
   const brands=document.querySelector('.atlas-brand');
   const active=document.querySelector('.search-bar__suggestions');
   return {header:rect('.atlas-header'),brand:rect('.atlas-brand'),actions:rect('.atlas-header__actions'),
    search:rect('.atlas-header__search'),suggestionCount:active?.children.length??0,
    pageWidth:document.documentElement.scrollWidth,viewport:innerWidth,
    css:{header:getComputedStyle(header).backgroundImage,actionColor:getComputedStyle(actions).color,brandColor:getComputedStyle(brands).color}};
  });
  results.push({label,phase,device:v.name,status:response?.status(),errors,...report});
  console.log('CAPTURE',label,'SUGGESTIONS',report.suggestionCount,'OVERFLOW',report.pageWidth-report.viewport);
 }catch(e){results.push({label:phase+'-'+v.name,phase,device:v.name,error:e.message,errors});console.log('ERROR',phase,v.name,e.message)}
 finally{await page.close()}
}
await browser.close();
await fs.writeFile(path.join(out,'report.json'),JSON.stringify(results,null,2));
const bad=results.filter(x=>x.error||x.errors?.length||x.status!==200||x.pageWidth>x.viewport||x.suggestionCount<1);
console.log('CAPTURE_RESULT',results.length-bad.length,'/',results.length);
if(bad.length)process.exitCode=1;
