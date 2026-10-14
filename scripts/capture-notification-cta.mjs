import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const folder = 'test-results/notification-cta-20261009';
await fs.mkdir(folder, {recursive: true});
const output = [];
const proxyCache = new Map();
const variants = [
  { name: 'desktop-light', width: 1440, height: 900, mode: 'light' },
  { name: 'desktop-dark', width: 1440, height: 900, mode: 'dark' },
  { name: 'mobile-light', width: 390, height: 844, mode: 'light' },
  { name: 'mobile-dark', width: 390, height: 844, mode: 'dark' },
  { name: 'compact-light', width: 320, height: 720, mode: 'light' },
];
const browser = await chromium.launch({
  headless: true,
  executablePath: '/home/ubuntu/Hava81-visual-overhaul-20261009/.pw-browsers/chromium_headless_shell-1234/chrome-linux/headless_shell',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const phases = [['before','https://hava81.zekiakgul.dev'],['after',process.env.HAVA81_AFTER_URL || 'http://127.0.0.1:4206']].filter(([phase]) => !process.env.HAVA81_CAPTURE_PHASE || process.env.HAVA81_CAPTURE_PHASE === phase);
for(const [phase,host] of phases) {
  for(const variant of variants) {
    const page = await browser.newPage({viewport:{width:variant.width,height:variant.height},deviceScaleFactor:1,serviceWorkers:'block'});
    const errors=[];
    page.on('pageerror', err=>errors.push(err.message));
    await page.addInitScript(({mode}) => {
      Object.defineProperty(window, 'Notification', {
        configurable:true, value:{permission:'denied', requestPermission:async()=> 'denied'}
      });
      localStorage.setItem('user-settings',JSON.stringify({
        temperatureUnit:'metric', windSpeedUnit:'ms',language:'tr',themeMode:mode
      }));
    },{mode:variant.mode});
    if (phase === 'after') {
      await page.route('**/api/v1/**', async route => {
        const url = new URL(route.request().url());
        const key = url.pathname + url.search;
        try {
          let response = proxyCache.get(key);
          if (!response) {
            const mirror = await route.fetch({url: 'https://api.hava81.zekiakgul.dev' + key, timeout: 20000});
            response = { status: mirror.status(), contentType: mirror.headers()['content-type'] || 'application/json', body: await mirror.body() };
            if (mirror.ok()) proxyCache.set(key, response);
          }
          await route.fulfill(response);
        } catch (error) {
          errors.push('API mirror: ' + error.message);
          await route.abort();
        }
      });
    }
    try{
      const response=await page.goto(host+'/izmir/',{waitUntil:'domcontentloaded',timeout:30000});
      const panel=page.locator('.decision-alerts').first();
      await panel.waitFor({state:'visible',timeout:25000});
      await page.locator('.app').evaluate((el,mode)=>el.setAttribute('data-color-mode',mode),variant.mode);
      await panel.scrollIntoViewIfNeeded();
      await panel.screenshot({path:path.join(folder,phase+'-'+variant.name+'.png'),animations:'disabled'});
      const metrics=await panel.evaluate(el=>{
        const btn=el.querySelector('button');
        const style=getComputedStyle(btn);
        return {text:btn.textContent?.trim(),disabled:btn.disabled,color:style.color,background:style.backgroundColor,
          buttonWidth:btn.clientWidth,buttonScroll:btn.scrollWidth,panelWidth:el.clientWidth,panelScroll:el.scrollWidth,
          pageWidth:document.documentElement.scrollWidth,viewportWidth:innerWidth};
      });
      output.push({phase,variant:variant.name,httpStatus:response?.status(),errors,...metrics});
      console.log('CAPTURED',phase,variant.name,JSON.stringify(metrics));
    }catch(e){
      output.push({phase,variant:variant.name,error:e.message,errors});
      console.error('ERROR',phase,variant.name,e.message);
    }
    await page.close();
  }
}
await browser.close();
await fs.writeFile(path.join(folder,'audit.json'),JSON.stringify(output,null,2));
const fail=output.filter(r=>r.error||r.errors?.length||r.httpStatus!==200||r.pageWidth>r.viewportWidth||r.panelScroll>r.panelWidth+1||r.buttonScroll>r.buttonWidth+1);
console.log('AUDIT',output.length-fail.length,'/',output.length);
if(fail.length)process.exitCode=1;
