import type {
  DecisionReasonCode,
  Hava81ScoreBand,
  Hava81ScoreFactor,
  ScoreFactorImpact,
  ScoredWeatherWindow,
} from './types';

export interface ScoreWeatherWindowInput {
  time: Date;
  temperature: number;
  apparentTemperature?: number;
  humidity?: number;
  precipitationProbability?: number;
  precipitationMm?: number;
  windSpeed?: number;
  windGust?: number;
  airQualityIndex?: number;
  uvIndex?: number;
  visibility?: number;
  weatherCode?: number;
}

export const getScoreBand = (score: number): Hava81ScoreBand => {
  // Reserve the top label for genuinely near-ideal windows; 90–96 is still good weather,
  // but calling the whole range “excellent” makes normal hourly variation disappear.
  if (score >= 97) return 'excellent';
  if (score >= 75) return 'good';
  if (score >= 55) return 'caution';
  return 'difficult';
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const clampScore = (value: number) => clamp(Math.round(value), 0, 100);

const smoothstep = (value: number, start: number, end: number) => {
  if (end <= start) return value >= end ? 1 : 0;
  const t = clamp((value - start) / (end - start), 0, 1);
  return t * t * (3 - 2 * t);
};

const heatIndexC = (temperatureC: number, humidity: number): number => {
  const t = (temperatureC * 9) / 5 + 32;
  const rh = clamp(humidity, 0, 100);
  const simple = 0.5 * (t + 61 + (t - 68) * 1.2 + rh * 0.094);
  const averaged = (simple + t) / 2;
  if (averaged < 80) return temperatureC;

  let hi =
    -42.379 +
    2.04901523 * t +
    10.14333127 * rh -
    0.22475541 * t * rh -
    0.00683783 * t * t -
    0.05481717 * rh * rh +
    0.00122874 * t * t * rh +
    0.00085282 * t * rh * rh -
    0.00000199 * t * t * rh * rh;

  if (rh < 13 && t >= 80 && t <= 112) {
    hi -= ((13 - rh) / 4) * Math.sqrt((17 - Math.abs(t - 95)) / 17);
  } else if (rh > 85 && t >= 80 && t <= 87) {
    hi += ((rh - 85) / 10) * ((87 - t) / 5);
  }
  return ((hi - 32) * 5) / 9;
};

const windChillC = (temperatureC: number, windSpeedMs: number): number => {
  const windKmh = Math.max(0, windSpeedMs) * 3.6;
  if (temperatureC > 10 || windKmh <= 4.8) return temperatureC;
  const velocity = Math.pow(windKmh, 0.16);
  return 13.12 + 0.6215 * temperatureC - 11.37 * velocity + 0.3965 * temperatureC * velocity;
};

export const resolveApparentTemperature = ({
  temperature,
  apparentTemperature,
  humidity,
  windSpeed = 0,
}: Pick<
  ScoreWeatherWindowInput,
  'temperature' | 'apparentTemperature' | 'humidity' | 'windSpeed'
>) => {
  if (Number.isFinite(apparentTemperature)) return apparentTemperature as number;
  if (temperature >= 26.7 && Number.isFinite(humidity))
    return heatIndexC(temperature, humidity as number);
  if (temperature <= 10) return windChillC(temperature, windSpeed);
  return temperature;
};

const addImpact = (impacts: ScoreFactorImpact[], factor: Hava81ScoreFactor, penalty: number) => {
  if (penalty >= 0.5) impacts.push({ factor, penalty: Math.round(penalty * 10) / 10 });
};

const thermalPenalty = (apparent: number) => {
  // Keep 100 for genuinely near-ideal comfort instead of treating the broad 18–25°C
  // range as equally perfect. The gentle centre-distance penalty creates useful
  // hour-to-hour separation while preserving the previous extreme-heat/cold ceiling.
  const comfort = 4 * smoothstep(Math.abs(apparent - 22), 0, 4);
  if (apparent > 25) return comfort + 54 * smoothstep(apparent, 25, 43);
  if (apparent < 18) return comfort + 51 * smoothstep(18 - apparent, 0, 28);
  return comfort;
};

const precipitationPenalty = (probability?: number, amount?: number) => {
  const hasProbability = Number.isFinite(probability);
  const hasAmount = Number.isFinite(amount);
  if (!hasProbability && !hasAmount) return 0;
  const pop = hasProbability ? clamp(probability as number, 0, 1) : 0;
  if (!hasAmount) return 28 * smoothstep(pop, 0.12, 0.9);
  const mm = Math.max(0, amount as number);
  // A zero measured amount does not mean a moderate forecast probability is irrelevant.
  // Give probability enough weight to distinguish a dry-looking 15% hour from a 35–50%
  // “may rain” hour, while measured accumulation still carries the larger penalty.
  const chancePart = 20 * smoothstep(pop, 0.12, 0.75);
  const amountPart = 30 * smoothstep(mm, 0.2, 6) * (0.55 + 0.45 * pop);
  return Math.min(38, chancePart + amountPart);
};

const windPenalty = (speed: number, gust?: number) => {
  const sustained = 32 * smoothstep(speed, 4, 18);
  const gustPenalty = Number.isFinite(gust) ? 28 * smoothstep(gust as number, 8, 24) : 0;
  return Math.min(38, Math.max(sustained, gustPenalty) + Math.min(sustained, gustPenalty) * 0.2);
};

const airQualityPenalty = (aqi?: number) => {
  if (!Number.isFinite(aqi)) return 0;
  const value = clamp(aqi as number, 1, 5);
  if (value <= 1) return 0;
  if (value <= 2) return 2 * (value - 1);
  if (value <= 3) return 2 + 8 * (value - 2);
  if (value <= 4) return 10 + 12 * (value - 3);
  return 22 + 16 * (value - 4);
};

const uvPenalty = (uv?: number) => {
  if (!Number.isFinite(uv) || (uv as number) < 3) return 0;
  return 20 * smoothstep(uv as number, 3, 11);
};

const visibilityPenalty = (visibility?: number) => {
  if (!Number.isFinite(visibility) || (visibility as number) >= 5000) return 0;
  const meters = Math.max(0, visibility as number);
  return 24 * smoothstep(5000 - meters, 0, 4800);
};

const severeWeatherPenalty = (weatherCode?: number) => {
  if (!Number.isFinite(weatherCode)) return 0;
  const code = weatherCode as number;
  if ([96, 99, 66, 67].includes(code)) return 28;
  if ([95, 75, 82, 86].includes(code)) return 20;
  if ([71, 73, 77, 85].includes(code)) return 10;
  if ([45, 48].includes(code)) return 6;
  return 0;
};

export const scoreWeatherWindow = ({
  time,
  temperature,
  apparentTemperature,
  humidity,
  precipitationProbability,
  precipitationMm,
  windSpeed = 0,
  windGust,
  airQualityIndex,
  uvIndex,
  visibility,
  weatherCode,
}: ScoreWeatherWindowInput): ScoredWeatherWindow => {
  const apparent = resolveApparentTemperature({
    temperature,
    apparentTemperature,
    humidity,
    windSpeed,
  });
  const impacts: ScoreFactorImpact[] = [];
  const reasons: DecisionReasonCode[] = [];

  const thermal = thermalPenalty(apparent);
  const rain = precipitationPenalty(precipitationProbability, precipitationMm);
  const wind = windPenalty(windSpeed, windGust);
  const air = airQualityPenalty(airQualityIndex);
  const uv = uvPenalty(uvIndex);
  const visibilityRisk = visibilityPenalty(visibility);
  const severe = severeWeatherPenalty(weatherCode);

  addImpact(impacts, 'thermal', thermal);
  addImpact(impacts, 'precipitation', rain);
  addImpact(impacts, 'wind', wind);
  addImpact(impacts, 'air-quality', air);
  addImpact(impacts, 'uv', uv);
  addImpact(impacts, 'visibility', visibilityRisk);
  addImpact(impacts, 'severe-weather', severe);

  if (apparent >= 36) reasons.push('extreme-heat');
  else if (apparent >= 29) reasons.push('heat');
  else if (apparent <= 0) reasons.push('freezing');
  else if (apparent <= 8) reasons.push('cold');

  const hasPrecipitationProbability = Number.isFinite(precipitationProbability);
  const hasPrecipitationAmount = Number.isFinite(precipitationMm);
  if (
    (hasPrecipitationAmount && (precipitationMm as number) >= 2.5) ||
    (hasPrecipitationProbability && (precipitationProbability as number) >= 0.6)
  )
    reasons.push('heavy-rain');
  else if (
    (hasPrecipitationAmount && (precipitationMm as number) >= 0.2) ||
    (hasPrecipitationProbability && (precipitationProbability as number) >= 0.25)
  )
    reasons.push('rain-risk');

  if (windSpeed >= 13 || (windGust ?? 0) >= 20) reasons.push('strong-wind');
  else if ((windGust ?? 0) >= 13) reasons.push('gusty-wind');
  else if (windSpeed >= 8) reasons.push('windy');

  if ((airQualityIndex ?? 0) >= 4) reasons.push('poor-air-quality');
  else if ((airQualityIndex ?? 0) >= 3) reasons.push('sensitive-air-quality');
  if ((uvIndex ?? 0) >= 6) reasons.push('high-uv');
  if ((visibility ?? Number.POSITIVE_INFINITY) < 2000) reasons.push('low-visibility');
  if (severe >= 20) reasons.push('severe-weather');

  const materialRisks = [thermal, rain, wind, air, uv, visibilityRisk, severe].filter(
    value => value >= 8
  ).length;
  const compound = materialRisks >= 2 ? Math.min(12, (materialRisks - 1) * 4) : 0;
  addImpact(impacts, 'compound', compound);

  let score = clampScore(
    100 - (thermal + rain + wind + air + uv + visibilityRisk + severe + compound)
  );

  if (apparent >= 43) score = Math.min(score, 30);
  else if (apparent >= 40) score = Math.min(score, 45);
  if (apparent <= -20) score = Math.min(score, 20);
  else if (apparent <= -10) score = Math.min(score, 35);
  if ((precipitationMm ?? 0) >= 7.5) score = Math.min(score, 35);
  if (windSpeed >= 20 || (windGust ?? 0) >= 25) score = Math.min(score, 30);
  if ((airQualityIndex ?? 0) >= 5) score = Math.min(score, 45);
  if (severe >= 28) score = Math.min(score, 25);

  // A named material risk and the “very suitable” label should never coexist. The score
  // remains continuous, but the top band is reserved for windows with no surfaced warning.
  if (reasons.length > 0) score = Math.min(score, 96);

  return {
    time,
    score,
    band: getScoreBand(score),
    temperature,
    apparentTemperature: Math.round(apparent * 10) / 10,
    precipitationProbability: Number.isFinite(precipitationProbability)
      ? clamp(precipitationProbability as number, 0, 1)
      : undefined,
    precipitationMm,
    windSpeed,
    windGust,
    humidity,
    uvIndex,
    visibility,
    weatherCode,
    reasons: [...new Set(reasons)],
    impacts: impacts.sort((a, b) => b.penalty - a.penalty),
  };
};
