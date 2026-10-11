import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const now = Date.now();
const iso = (h = 0) => new Date(now + h * 3600000).toISOString();
const day = new Date(now + 10800000).toISOString().slice(0, 10);
const meta = {provider:'Open-Meteo', attribution:'Open-Meteo · CC BY 4.0',sourceUrl:'https://open-meteo.com/',fetchedAt:iso(),timezoneOffsetSeconds:10800,intervalHours:1,cacheStatus:'MISS',freshForSeconds:300};
const current = {cityName:'İstanbul',country:'TR',temperature:23,feelsLike:24,tempMin:19,tempMax:27,humidity:62,pressure:1012,visibility:10000,windSpeed:3.1,windDirection:160,description:'parçalı bulutlu',icon:'02d',sunrise:iso(-6),sunset:iso(6),timestamp:iso(),coordinates:{lat:41.01,lon:28.97},clouds:35,meta:{...meta,provider:'OpenWeather'}};
const hours = Array.from({length:24}, (_,i)=>({time:iso(i+1),temp:19+Math.round(5*Math.sin(i/6)),icon:i>4&&i<9?'10d':'02d',description:i>4&&i<9?'yağmurlu':'parçalı bulutlu',pop:i===6?72:i>4&&i<9?44:8,precipitationMm:i===6?2.4:i>4&&i<9?0.7:0,windSpeed:3.1,apparentTemperature:20,humidity:62,uvIndex:1,visibility:10000,weatherCode:61}));
const forecast = {daily:[{date:day,tempMin:19,tempMax:27,icon:'02d',description:'parçalı bulutlu',pop:72}],hourly:hours.filter((_,i)=>i%3===0),meta:{...meta,provider:'OpenWeather',intervalHours:3}};

test('rain peak time remains readable on loaded hourly card', async ({page}, testInfo)=>{
  test.skip(testInfo.project.name==='tablet-768');
  await page.route('**/api/v1/weather/current**',r=>r.fulfill({json:current}));
  await page.route('**/api/v1/weather/forecast**',r=>r.fulfill({json:forecast}));
  await page.route('**/api/v1/weather/hourly**',r=>r.fulfill({json:{hourly:hours,meta}}));
  await page.route('**/api/v1/weather/air-quality**',r=>r.fulfill({status:503,json:{}}));
  await page.route('**/api/v1/weather/context**',r=>r.fulfill({status:503,json:{}}));
  await page.goto('/istanbul');
  await expect(page.locator('.hava81-forecast-atlas')).toBeVisible();
  await expect(page.locator('.atlas-forecast-loading--card')).toHaveCount(0);
  const rain=page.locator('.hava81-forecast-atlas__summary-item.is-precipitation');
  await expect(rain).toHaveClass(/has-signal/);
  await rain.scrollIntoViewIfNeeded();
  const state=process.env.HAVA81_VISUAL_CAPTURE_STATE==='before'?'before':'after';
  if(state==='after'){
    await expect(rain.locator('.hava81-forecast-atlas__summary-note')).toBeVisible();
    await expect(rain.locator('.hava81-forecast-atlas__summary-note')).toContainText(/\d/);
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(testInfo.project.use.viewport!.width+1);
  const dir=join(process.cwd(),'docs/visual-reviews/hourly-rain-peak-20261011');
  mkdirSync(dir,{recursive:true});
  await page.screenshot({path:join(dir,`${state}-${testInfo.project.name}.png`),animations:'disabled',fullPage:false});
});
