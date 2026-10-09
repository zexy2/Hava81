import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const outputDir = process.env.HAVA81_VISUAL_DIR || 'test-results/secondary-visual/screens';
const browserPath = process.env.HAVA81_CHROMIUM_EXECUTABLE_PATH ||
  '/home/ubuntu/Hava81-visual-overhaul-20261009/.pw-browsers/chromium_headless_shell-1234/chrome-linux/headless_shell';
const beforeUrl = process.env.HAVA81_BEFORE_URL || 'https://hava81.zekiakgul.dev';
const afterUrl = process.env.HAVA81_AFTER_URL || 'http://127.0.0.1:4197';
const targets = [{name:'desktop',width:1440,height:900},{name:'mobile',width:390,height:844},{name:'compact',width:320,height:720}];
const variants = [{name:'light',theme:'light'},{name:'dark',theme:'dark'}];
const browser = await chromium.launch({headless:true,executablePath:browserPath,args:['--no-sandbox','--disable-dev-shm-usage']});
const measurements = [];
const mirrorCache = new Map();

const phases = [['before',beforeUrl],['after',afterUrl]].filter(([phase]) => !process.env.HAVA81_VISUAL_PHASE || process.env.HAVA81_VISUAL_PHASE===phase);
for (const [phase,baseUrl] of phases) {
  for (const device of targets) {
    for (const theme of variants) {
      if(device.name==='compact' && theme.name==='dark') continue;
      const name = [phase,device.name,theme.name].join('-');
      const page = await browser.newPage({viewport:{width:device.width,height:device.height},deviceScaleFactor:1,serviceWorkers:'block'});
      const errors = [];
      page.on('pageerror',e=>errors.push(e.message));
      await page.addInitScript(({theme}) => {
        localStorage.setItem('user-settings',JSON.stringify({temperatureUnit:'metric',windSpeedUnit:'ms',language:'tr',themeMode:theme}));
      },{theme:theme.theme});
      if(phase==='after') {
        await page.route('**/api/v1/**',async route=>{
          const u = new URL(route.request().url());
          const key=u.pathname+u.search;
          try {
            let entry = mirrorCache.get(key);
            if(!entry){
              const resp=await route.fetch({url:'https://api.hava81.zekiakgul.dev'+key,timeout:20000});
              entry={status:resp.status(),contentType:resp.headers()['content-type']||'application/json',body:await resp.body()};
              if(resp.ok())mirrorCache.set(key,entry);
            }
            await route.fulfill(entry);
          } catch(e){errors.push('API:'+e.message); await route.abort();}
        });
      }
      try {
        const response=await page.goto(baseUrl+'/izmir/',{waitUntil:'domcontentloaded',timeout:30000});
        await page.locator('.atlas-settings-button').waitFor({state:'visible',timeout:20000});
        await page.locator('.atlas-settings-button').click();
        const panel=page.locator('#settings-panel-dialog');
        await panel.waitFor({state:'visible'});
        await page.waitForTimeout(250);
        await fs.mkdir(outputDir,{recursive:true});
        const settingsShot=path.join(outputDir,name+'-settings.png');
        await page.screenshot({path:settingsShot,animations:'disabled',timeout:25000});
        const settingData=await panel.evaluate(el=>{
          const rect=e=>{const r=e.getBoundingClientRect();return{x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)}};
          const first=el.querySelector('.settings-section'), selected=el.querySelector('.settings-option[aria-pressed="true"]');
          return {panel:rect(el),sections:el.querySelectorAll('.settings-section').length,background:getComputedStyle(el).backgroundColor,
            firstSectionRadius:getComputedStyle(first).borderRadius,selectedBorder:getComputedStyle(selected).borderWidth,selectedRadius:getComputedStyle(selected).borderRadius};
        });
        await page.locator('.settings-panel__close').click();
        const mapBtn=page.locator(device.width<=768?'.atlas-bottom-nav__button:nth-child(2)':'.atlas-icon-button--map').first();
        await mapBtn.click({timeout:12000});
        const map=page.locator('.atlas-map-panel');
        await map.waitFor({state:'visible',timeout:18000});
        await map.locator('.weather-map__container').waitFor({state:'visible',timeout:15000});
        // Wait for settled map tiles; a loading overlay is intentionally
        // documented only when external providers fail.
        await map.locator('.leaflet-tile-loaded').first().waitFor({state:'visible',timeout:9000}).catch(()=>{});
        await map.locator('.weather-map__tile-status').waitFor({state:'hidden',timeout:6000}).catch(()=>{});
        await page.waitForTimeout(350);
        const mapShot=path.join(outputDir,name+'-map.png');
        await page.screenshot({path:mapShot,animations:'disabled',timeout:25000});
        const mapData=await map.evaluate(el=>{
          const rect=e=>{const r=e.getBoundingClientRect();return{x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)}};
          const header=el.querySelector('.atlas-map-panel__header'), legend=el.querySelector('.weather-map__legend');
          return {panel:rect(el),headerRadius:getComputedStyle(header).borderRadius,legendRadius:getComputedStyle(legend).borderRadius,legendItems:legend.querySelectorAll('.weather-map__legend-item').length};
        });
        const sample={name,phase,device:device.name,theme:theme.name,status:response?.status(),url:page.url(),settings:settingData,map:mapData,
         bodyWidth:await page.evaluate(()=>document.documentElement.scrollWidth),viewportWidth:device.width,errors,
         settingsShot,mapShot};
        measurements.push(sample);
        console.log('CAPTURED',name,JSON.stringify({status:sample.status,overflow:sample.bodyWidth-sample.viewportWidth,settings:settingData,map:mapData,errors}));
      } catch(e){
        measurements.push({name,phase,device:device.name,theme:theme.name,error:e.message,errors});
        console.log('CAPTURE_ERROR',name,e.message);
      } finally { await page.close(); }
    }
  }
}
await browser.close();
await fs.mkdir(outputDir,{recursive:true});
await fs.writeFile(path.join(outputDir,'audit.json'),JSON.stringify(measurements,null,2));
const failures=measurements.filter(x=>x.error||x.errors?.length||x.status!==200||x.bodyWidth>x.viewportWidth||x.settings?.sections!==4||x.map?.legendItems!==5);
console.log('SECONDARY_VISUAL_AUDIT',measurements.length-failures.length,'/',measurements.length);
if(failures.length) process.exitCode=1;
