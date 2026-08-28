import { buildDailyPlan } from '../src/domain/decision/buildDailyPlan';
import { buildActivityPlan } from '../src/domain/activity/buildActivityPlan';
import type { ActivityKind } from '../src/domain/activity/types';
import type { AirQuality, HourlyForecast, NormalizedWeatherData } from '../src/types';

const baseUrl = (process.env.BASE_URL || 'http://127.0.0.1:4001/api/v1').replace(/\/$/, '');
const delayMs = Number(process.env.DELAY_MS || 1100);
const cities = [
  'Adana',
  'Adıyaman',
  'Afyonkarahisar',
  'Ağrı',
  'Amasya',
  'Ankara',
  'Antalya',
  'Artvin',
  'Aydın',
  'Balıkesir',
  'Bilecik',
  'Bingöl',
  'Bitlis',
  'Bolu',
  'Burdur',
  'Bursa',
  'Çanakkale',
  'Çankırı',
  'Çorum',
  'Denizli',
  'Diyarbakır',
  'Edirne',
  'Elazığ',
  'Erzincan',
  'Erzurum',
  'Eskişehir',
  'Gaziantep',
  'Giresun',
  'Gümüşhane',
  'Hakkari',
  'Hatay',
  'Isparta',
  'Mersin',
  'İstanbul',
  'İzmir',
  'Kars',
  'Kastamonu',
  'Kayseri',
  'Kırklareli',
  'Kırşehir',
  'Kocaeli',
  'Konya',
  'Kütahya',
  'Malatya',
  'Manisa',
  'Kahramanmaraş',
  'Mardin',
  'Muğla',
  'Muş',
  'Nevşehir',
  'Niğde',
  'Ordu',
  'Rize',
  'Sakarya',
  'Samsun',
  'Siirt',
  'Sinop',
  'Sivas',
  'Tekirdağ',
  'Tokat',
  'Trabzon',
  'Tunceli',
  'Şanlıurfa',
  'Uşak',
  'Van',
  'Yozgat',
  'Zonguldak',
  'Aksaray',
  'Bayburt',
  'Karaman',
  'Kırıkkale',
  'Batman',
  'Şırnak',
  'Bartın',
  'Ardahan',
  'Iğdır',
  'Yalova',
  'Karabük',
  'Kilis',
  'Osmaniye',
  'Düzce',
];
const activities: ActivityKind[] = ['walk', 'run', 'picnic', 'children', 'motorcycle', 'laundry'];
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const json = async (url: string) => {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(url, { headers: { accept: 'application/json' } });
    const body = await response.json();
    if (response.ok) return body;
    if (response.status === 429 && attempt < 3) {
      const retryAfterSeconds = Number(response.headers.get('retry-after') || 15);
      const backoffMs = Math.max(5_000, Math.min(65_000, retryAfterSeconds * 1_000 + 500));
      console.log(`RATE_LIMIT backoff=${Math.round(backoffMs / 1000)}s`);
      await sleep(backoffMs);
      continue;
    }
    throw new Error(`HTTP ${response.status}: ${body?.error?.code ?? ''}`);
  }
  throw new Error('request retries exhausted');
};
const scoreOk = (value: number) => Number.isFinite(value) && value >= 0 && value <= 100;
const bandCounts = new Map<string, number>();
const activityTotals = new Map<ActivityKind, { sum: number; count: number }>();
const cityScores: Array<{ city: string; score: number }> = [];
const failures: Array<{ city: string; message: string }> = [];

for (const [index, city] of cities.entries()) {
  process.stdout.write(`[${String(index + 1).padStart(2, '0')}/81] ${city} ... `);
  try {
    const currentRaw = await json(
      `${baseUrl}/weather/current?city=${encodeURIComponent(city)}&lang=tr`
    );
    await sleep(delayMs);
    const { lat, lon } = currentRaw.coordinates;
    const forecastRaw = await json(`${baseUrl}/weather/forecast?lat=${lat}&lon=${lon}&lang=tr`);
    await sleep(delayMs);
    let airRaw: any = null;
    try {
      airRaw = await json(`${baseUrl}/weather/air-quality?lat=${lat}&lon=${lon}&lang=tr`);
    } catch {
      airRaw = null;
    }
    await sleep(delayMs);
    const weather: NormalizedWeatherData = {
      ...currentRaw,
      sunrise: new Date(currentRaw.sunrise),
      sunset: new Date(currentRaw.sunset),
      timestamp: new Date(currentRaw.timestamp),
      meta: { ...currentRaw.meta, fetchedAt: new Date(currentRaw.meta.fetchedAt) },
    };
    const hourly: HourlyForecast[] = forecastRaw.hourly.map((point: any) => ({
      ...point,
      time: new Date(point.time),
      pop: point.pop > 1 ? point.pop / 100 : point.pop,
    }));
    const air: AirQuality | undefined = airRaw
      ? {
          ...airRaw,
          meta: airRaw.meta
            ? { ...airRaw.meta, fetchedAt: new Date(airRaw.meta.fetchedAt) }
            : undefined,
        }
      : undefined;
    const plan = buildDailyPlan({ weather, hourly, airQuality: air });
    if (!scoreOk(plan.score) || plan.slots.length === 0)
      throw new Error(`invalid plan score=${plan.score}`);
    if (
      plan.nowOrLater.kind === 'later' &&
      plan.nowOrLater.targetScore - plan.nowOrLater.currentScore < 15
    )
      throw new Error('later recommendation without material improvement');
    bandCounts.set(plan.band, (bandCounts.get(plan.band) ?? 0) + 1);
    cityScores.push({ city, score: plan.score });
    for (const activity of activities) {
      const activityPlan = buildActivityPlan({ activity, weather, hourly, airQuality: air });
      if (!scoreOk(activityPlan.score) || !activityPlan.bestWindow)
        throw new Error(`invalid ${activity} plan`);
      const bucket = activityTotals.get(activity) ?? { sum: 0, count: 0 };
      bucket.sum += activityPlan.score;
      bucket.count += 1;
      activityTotals.set(activity, bucket);
    }
    console.log(`OK score=${plan.score} ${plan.band}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    failures.push({ city, message });
    console.log(`FAIL ${message}`);
  }
}

cityScores.sort((a, b) => a.score - b.score);
const average = cityScores.length
  ? Math.round(cityScores.reduce((s, x) => s + x.score, 0) / cityScores.length)
  : 0;
console.log('\n=== Hava81 decision calibration gate ===');
console.log(`Base URL: ${baseUrl}`);
console.log(`Plans: ${cityScores.length}/81`);
console.log(`Average score: ${average}`);
console.log(`Bands: ${JSON.stringify(Object.fromEntries(bandCounts))}`);
console.log(
  `Lowest: ${cityScores
    .slice(0, 5)
    .map(x => `${x.city}:${x.score}`)
    .join(', ')}`
);
console.log(
  `Highest: ${cityScores
    .slice(-5)
    .reverse()
    .map(x => `${x.city}:${x.score}`)
    .join(', ')}`
);
console.log(
  `Activity averages: ${activities.map(a => `${a}:${Math.round((activityTotals.get(a)?.sum ?? 0) / (activityTotals.get(a)?.count || 1))}`).join(', ')}`
);
if (failures.length) {
  console.log(`Failures: ${failures.length}`);
  failures.forEach(f => console.log(`- ${f.city}: ${f.message}`));
  process.exit(1);
}
console.log('RESULT: PASS 81/81 decision plans + 486 activity plans');
