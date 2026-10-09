import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const baseUrl = process.env.HAVA81_AUDIT_BASE_URL || 'https://hava81.zekiakgul.dev';
const label = process.env.HAVA81_AUDIT_LABEL || 'before';
const root = process.env.HAVA81_AUDIT_DIR || 'test-results/visual-overhaul';
const dest = path.join(root, label);
await fs.mkdir(dest, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.HAVA81_CHROMIUM_EXECUTABLE_PATH || undefined, headless:true, args:['--no-sandbox','--disable-dev-shm-usage'] });
const variants = [
 {name:'desktop-light', width:1440, height:900, theme:'light'},
 {name:'tablet-light', width:768, height:1024, theme:'light'},
 {name:'mobile-light', width:390, height:844, theme:'light'},
 {name:'mobile-dark', width:390, height:844, theme:'dark'},
 {name:'small-mobile', width:320, height:720, theme:'light'},
];
let reports = [];
const apiCache = new Map();
try{
 for(const v of variants){
  const page=await browser.newPage({viewport:{width:v.width,height:v.height},deviceScaleFactor:1});
  const errors=[];
  if (baseUrl.includes('127.0.0.1')) {
    await page.route('**/api/v1/**', async route => {
      const target = new URL(route.request().url());
      const key = target.pathname + target.search;
      try {
        let result = apiCache.get(key);
        if (!result) {
          const response = await route.fetch({
            url: 'https://api.hava81.zekiakgul.dev' + key,
            timeout: 20000,
          });
          result = {
            status: response.status(),
            contentType: response.headers()['content-type'] || 'application/json',
            body: await response.body(),
          };
          if (response.ok()) apiCache.set(key, result);
        }
        await route.fulfill(result);
      } catch (error) {
        errors.push('API mirror: ' + error.message);
        await route.abort();
      }
    });
  }
  page.on('pageerror', e=>errors.push(e.message));
  await page.addInitScript(({theme})=>localStorage.setItem('user-settings', JSON.stringify({temperatureUnit:'metric',windSpeedUnit:'ms',language:'tr',themeMode:theme})),{theme:v.theme});
  try{
   const response=await page.goto(baseUrl+'/izmir/',{waitUntil:'domcontentloaded',timeout:25000});
   await page.locator('.hava81-decision-field__city').waitFor({timeout:20000}).catch(()=>{});
   await page.locator('.hava81-forecast-atlas, .atlas-forecast-error-card').first().waitFor({timeout:16000}).catch(()=>{});
   await page.waitForTimeout(650);
   // Render offscreen panels for complete full-page visual evidence only.
   await page.addStyleTag({content: '.atlas-dashboard > .activity-planner, .atlas-dashboard > .context-signals, .atlas-dashboard > .decision-alerts, .atlas-dashboard > .commute-plan, .atlas-dashboard > .route-weather { content-visibility: visible !important; }'});
   const snapshot=await page.evaluate(()=>{
      const b=(sel)=>{const e=document.querySelector(sel);if(!e)return null;const r=e.getBoundingClientRect();return {x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)}};
      return {title:document.title, bodyWidth:document.documentElement.scrollWidth, viewportWidth:innerWidth, scrollHeight:document.documentElement.scrollHeight, city:b('.hava81-decision-field__city'), hero:b('.hava81-decision-field'), forecast:b('.hava81-forecast-atlas'), appMode:document.querySelector('.app')?.getAttribute('data-color-mode'), mainHeadings:[...document.querySelectorAll('h1,h2')].slice(0,16).map(n=>n.textContent.trim().slice(0,95))};
   });
   const file=path.join(dest,v.name+'.png');
   await page.screenshot({path:file,fullPage:true,animations:'disabled',timeout:25000});
   reports.push({variant:v.name,url:page.url(),httpStatus:response?.status(),...snapshot,errors,filename:file});
   console.log('CAPTURED',v.name,JSON.stringify({httpStatus:response?.status(),...snapshot,errors}));
  }catch(e){reports.push({variant:v.name,error:e.message});console.log('FAILED',v.name,e.message)}
  finally{await page.close();}
 }
}finally{await browser.close();}
await fs.writeFile(path.join(dest,'report.json'),JSON.stringify(reports,null,2));

const failures = reports.filter(item =>
  item.error || item.errors?.length || item.httpStatus !== 200 ||
  !item.city || !item.forecast || item.bodyWidth > item.viewportWidth + 1
);
console.log(`Visual audit: ${reports.length - failures.length}/${reports.length} viewport states passed`);
if (failures.length) process.exitCode = 1;
