#!/usr/bin/env node

const baseUrl = (process.env.BASE_URL || 'http://127.0.0.1:4001/api/v1').replace(/\/$/, '');
const delayMs = Number(process.env.DELAY_MS || 1100);

const cities = [
  'Adana','Adıyaman','Afyonkarahisar','Ağrı','Amasya','Ankara','Antalya','Artvin','Aydın','Balıkesir',
  'Bilecik','Bingöl','Bitlis','Bolu','Burdur','Bursa','Çanakkale','Çankırı','Çorum','Denizli','Diyarbakır',
  'Edirne','Elazığ','Erzincan','Erzurum','Eskişehir','Gaziantep','Giresun','Gümüşhane','Hakkari','Hatay',
  'Isparta','Mersin','İstanbul','İzmir','Kars','Kastamonu','Kayseri','Kırklareli','Kırşehir','Kocaeli',
  'Konya','Kütahya','Malatya','Manisa','Kahramanmaraş','Mardin','Muğla','Muş','Nevşehir','Niğde','Ordu',
  'Rize','Sakarya','Samsun','Siirt','Sinop','Sivas','Tekirdağ','Tokat','Trabzon','Tunceli','Şanlıurfa',
  'Uşak','Van','Yozgat','Zonguldak','Aksaray','Bayburt','Karaman','Kırıkkale','Batman','Şırnak','Bartın',
  'Ardahan','Iğdır','Yalova','Karabük','Kilis','Osmaniye','Düzce'
];

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const finite = value => typeof value === 'number' && Number.isFinite(value);
const validDate = value => typeof value === 'string' && !Number.isNaN(Date.parse(value));

async function getJson(url) {
  const response = await fetch(url, { headers: { accept: 'application/json' } });
  let body;
  try { body = await response.json(); } catch { body = null; }
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return body;
}

const failures = [];
let currentOk = 0;
let forecastOk = 0;
const startedAt = Date.now();

for (const [index, city] of cities.entries()) {
  process.stdout.write(`[${String(index + 1).padStart(2, '0')}/81] ${city} ... `);
  try {
    const current = await getJson(`${baseUrl}/weather/current?city=${encodeURIComponent(city)}&lang=tr`);
    if (!current || typeof current.cityName !== 'string') throw new Error('current.cityName missing');
    if (!finite(current.temperature)) throw new Error('current.temperature invalid');
    if (!validDate(current.timestamp)) throw new Error('current.timestamp invalid');
    if (!finite(current.coordinates?.lat) || !finite(current.coordinates?.lon)) throw new Error('coordinates invalid');
    currentOk += 1;

    await sleep(delayMs);

    const { lat, lon } = current.coordinates;
    const forecast = await getJson(`${baseUrl}/weather/forecast?lat=${lat}&lon=${lon}&lang=tr`);
    if (!Array.isArray(forecast?.hourly) || forecast.hourly.length === 0) throw new Error('forecast.hourly empty');
    if (!Array.isArray(forecast?.daily) || forecast.daily.length === 0) throw new Error('forecast.daily empty');
    if (forecast.meta?.intervalHours !== 3) throw new Error(`intervalHours=${forecast.meta?.intervalHours ?? 'missing'}`);
    if (!finite(forecast.meta?.timezoneOffsetSeconds)) throw new Error('timezoneOffsetSeconds missing');
    if (typeof forecast.meta?.provider !== 'string' || !forecast.meta.provider) throw new Error('provider metadata missing');
    if (!validDate(forecast.meta?.fetchedAt)) throw new Error('fetchedAt invalid');
    forecastOk += 1;

    console.log('OK');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    failures.push({ city, message });
    console.log(`FAIL (${message})`);
  }
  await sleep(delayMs);
}

const elapsedSeconds = Math.round((Date.now() - startedAt) / 1000);
console.log('\n=== Hava81 81-il release gate ===');
console.log(`Base URL: ${baseUrl}`);
console.log(`Current: ${currentOk}/81`);
console.log(`Forecast: ${forecastOk}/81`);
console.log(`Elapsed: ${elapsedSeconds}s`);

if (failures.length) {
  console.log(`Failures: ${failures.length}`);
  for (const item of failures) console.log(`- ${item.city}: ${item.message}`);
  process.exit(1);
}

console.log('RESULT: PASS 81/81');
