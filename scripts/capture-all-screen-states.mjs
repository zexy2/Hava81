import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const base = process.env.HAVA81_AUDIT_BASE_URL || 'https://hava81.zekiakgul.dev';
const label = process.env.HAVA81_AUDIT_LABEL || 'before';
const root = process.env.HAVA81_AUDIT_OUTPUT || 'test-results/all-screens';
const folder = path.join(root, label);
await mkdir(folder, {recursive:true});
const browser = await chromium.launch({headless:true, executablePath: process.env.HAVA81_CHROMIUM_EXECUTABLE_PATH || undefined, args:['--no-sandbox','--disable-dev-shm-usage']});
const output=[];
const checks = [{name:'desktop',width:1440,height:900,theme:'light'}, {name:'mobile',width:390,height:844,theme:'light'},{name:'mobile-dark',width:390,height:844,theme:'dark'}, {name:'small-mobile',width:320,height:720,theme:'light'}].filter(v => !process.env.HAVA81_AUDIT_VARIANT || v.name === process.env.HAVA81_AUDIT_VARIANT);
for (const v of checks) {
 const page=await browser.newPage({viewport:{width:v.width,height:v.height}, deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 // The isolated Vite preview does not run the production API.
 // Reuse read-only live weather responses in the browser without changing servers.
 if (base.startsWith('http://127.0.0.1:')) {
   await page.route('**/api/v1/**', async route => {
     const original = new URL(route.request().url());
     const target = new URL(original.pathname + original.search, 'https://api.hava81.zekiakgul.dev');
     try {
       const response = await route.fetch({ url: target.toString(), timeout: 20000 });
       await route.fulfill({ response });
     } catch (error) {
       console.error('API PROXY FAILED', target.pathname, error.message);
       await route.abort();
     }
   });
 }

 await page.addInitScript(theme=>localStorage.setItem('user-settings',JSON.stringify({temperatureUnit:'metric',windSpeedUnit:'ms',language:'tr',themeMode:theme})),v.theme);
 const save=async (state,fullPage=false)=>{
   await page.waitForTimeout(350);
   const file=path.join(folder,`${v.name}-${state}.png`);
   await page.screenshot({path:file,fullPage,animations:'disabled',timeout:22000});
   const metric=await page.evaluate(()=>({viewport:innerWidth,scroll:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,headings:[...document.querySelectorAll('h1,h2')].filter(n=>n.getBoundingClientRect().height>0).slice(0,12).map(n=>n.textContent.trim())}));
   output.push({variant:v.name,state,file,metrics:metric,errors:[...errors]});
   console.log('CAPTURE',v.name,state,JSON.stringify(metric));
 };
 try {
   await page.goto(base+'/izmir/',{waitUntil:'domcontentloaded',timeout:26000});
   await page.locator('.hava81-decision-field__city').waitFor({timeout:22000});
   await page.locator('.hava81-forecast-atlas, .atlas-forecast-error-card').first().waitFor({timeout:16000}).catch(()=>{});
   await save('dashboard');
   await page.locator('.atlas-bottom-nav__button').last().evaluate(el=>el.click());
   await page.locator('.hava81-compare__empty,.hava81-compare__table').first().waitFor({timeout:15000});
   await save('compare',true);
   await page.locator('.atlas-bottom-nav__button').first().evaluate(el=>el.click());
   await page.locator('.atlas-settings-button').click();
   await page.waitForTimeout(250);
   await save('settings');
   await page.keyboard.press('Escape');
   if(v.width < 600){
     await page.locator('.atlas-icon-button--search').click();
     await save('search');
     await page.locator('.atlas-icon-button--search').click().catch(()=>{});
   }
   await page.locator('.atlas-bottom-nav__button').nth(1).evaluate(el=>el.click());
   await page.locator('#weather-map-region').waitFor({timeout:14000});
   await page.waitForTimeout(1100);
   await save('map');
   // Exercise the populated comparison without modifying a real visitor's data.
   for (const city of ['izmir', 'ankara']) {
     await page.goto(base + '/' + city + '/', {waitUntil:'domcontentloaded',timeout:22000});
     await page.locator('.hava81-decision-field__city').waitFor({timeout:18000});
     const favorite = page.locator('.atlas-header__actions button[aria-pressed]').first();
     if (await favorite.getAttribute('aria-pressed') !== 'true') await favorite.click();
   }
   await page.locator('.atlas-bottom-nav__button').last().evaluate(el => el.click());
   await page.locator('.hava81-compare__city').first().waitFor({timeout:20000});
   await save('compare-filled', true);
 } catch(e) {
   output.push({variant:v.name,error:e.message,errors});
   console.error('CAPTURE_ERROR',v.name,e.message);
 }
 await page.close();
}
await browser.close();
await writeFile(path.join(folder,'report.json'), JSON.stringify({base,label,output},null,2));
if(output.some(x=>x.error))process.exitCode=1;
