import {
  airLevel,
  COLD_APPARENT_C,
  EXTREME_HEAT_APPARENT_C,
  FREEZING_APPARENT_C,
  HEAT_APPARENT_C,
  rainLevel,
  WIND_CAUTION_GUST,
  windLevel,
} from './thresholds';
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
  windSpeed: number;
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

const isValidPrecipitationProbability = (value?: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;

const isValidPrecipitationAmount = (value?: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

/** Shared absolute ceilings for both visible score caps and plan-window eligibility gates. */
export const HAVA81_ABSOLUTE_SAFETY_LIMITS = {
  extremeHeatApparentC: 43,
  extremeColdApparentC: -20,
  heavyPrecipitationMm: 7.5,
  extremeWindSpeedMs: 20,
  extremeWindGustMs: 25,
  veryPoorAqiIndex: 5,
} as const;

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
  // NWS: below 80 °F the simple Steadman formula is the heat index, not the raw temperature.
  if (averaged < 80) return ((simple - 32) * 5) / 9;

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
  windSpeed,
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

/**
 * Thermal penalty in two parts so intent profiles can replace the general comfort centre with
 * their own comfort range without counting comfort twice: `centre` is the gentle distance from
 * 22 °C, `stress` is the heat/cold stress curve that every intent shares.
 */
export const thermalComponents = (apparent: number) => {
  // Keep 100 for genuinely near-ideal comfort instead of treating the broad 18–25°C
  // range as equally perfect. The gentle centre-distance penalty creates useful
  // hour-to-hour separation while preserving the previous extreme-heat/cold ceiling.
  const centre = 4 * smoothstep(Math.abs(apparent - 22), 0, 4);
  if (apparent > 25)
    return { centre, stress: 54 * smoothstep(apparent, 25, 43), side: 'heat' as const };
  if (apparent < 18)
    return { centre, stress: 51 * smoothstep(18 - apparent, 0, 28), side: 'cold' as const };
  return { centre, stress: 0, side: 'none' as const };
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
  // An unknown probability is not a 0% chance: a forecast amount alone is full rain evidence.
  const amountConfidence = hasProbability ? 0.55 + 0.45 * pop : 1;
  const amountPart = 30 * smoothstep(mm, 0.2, 6) * amountConfidence;
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

/**
 * One WMO code table for the score, the reason codes and the plan-engine gates.
 * `covers` names the measured signal that already describes the same phenomenon: the code only
 * adds pressure when that signal is missing, so fog or a downpour is not counted twice.
 */
const WMO_SEVERITY: Readonly<
  Record<number, { penalty: number; covers?: 'visibility' | 'precipitation' }>
> = {
  // Hail thunderstorms, freezing rain and dense freezing drizzle: ice/hail hazard.
  96: { penalty: 28 },
  99: { penalty: 28 },
  66: { penalty: 28 },
  67: { penalty: 28 },
  57: { penalty: 28 },
  // Lightning, light freezing drizzle and heavy snow are hazards beyond the rain amount.
  95: { penalty: 20 },
  56: { penalty: 20 },
  75: { penalty: 20 },
  86: { penalty: 20 },
  // Heavy rain / violent showers: the measured amount already carries this risk.
  65: { penalty: 20, covers: 'precipitation' },
  82: { penalty: 20, covers: 'precipitation' },
  73: { penalty: 14 },
  85: { penalty: 12 },
  71: { penalty: 8 },
  77: { penalty: 8 },
  // Fog: measured visibility already carries this risk.
  45: { penalty: 6, covers: 'visibility' },
  48: { penalty: 8, covers: 'visibility' },
};

/** Codes at or above this penalty are named `severe-weather` and block plan recommendations. */
export const SEVERE_WEATHER_PENALTY = 20;

export const wmoSeverityPenalty = (weatherCode?: number): number => {
  if (!Number.isFinite(weatherCode)) return 0;
  return WMO_SEVERITY[weatherCode as number]?.penalty ?? 0;
};

const severeWeatherPenalty = (
  weatherCode: number | undefined,
  evidence: { visibility: boolean; precipitationMm: boolean }
) => {
  if (!Number.isFinite(weatherCode)) return 0;
  const entry = WMO_SEVERITY[weatherCode as number];
  if (!entry) return 0;
  if (entry.covers && evidence[entry.covers === 'visibility' ? 'visibility' : 'precipitationMm']) {
    return 0;
  }
  return entry.penalty;
};

export interface SafetyCapInput {
  apparentTemperature: number;
  precipitationMm?: number;
  windSpeed: number;
  windGust?: number;
  airQualityIndex?: number;
  weatherCode?: number;
}

/**
 * Absolute ceilings shared by the general score and every intent score. Intent weights tune
 * comfort, never these limits, so a softened factor cannot make a dangerous hour look fine.
 */
export const applySafetyCaps = (
  score: number,
  input: SafetyCapInput,
  /** The plan does not keep a person outside in the heat (hanging laundry); other caps stay. */
  options: { heatExposure?: boolean } = {}
): number => {
  const limits = HAVA81_ABSOLUTE_SAFETY_LIMITS;
  const { apparentTemperature: apparent } = input;
  const heatExposure = options.heatExposure ?? true;
  let capped = score;
  if (heatExposure && apparent >= limits.extremeHeatApparentC) capped = Math.min(capped, 30);
  else if (heatExposure && apparent >= 40) capped = Math.min(capped, 45);
  if (apparent <= limits.extremeColdApparentC) capped = Math.min(capped, 20);
  else if (apparent <= -10) capped = Math.min(capped, 35);
  if ((input.precipitationMm ?? 0) >= limits.heavyPrecipitationMm) capped = Math.min(capped, 35);
  if (
    input.windSpeed >= limits.extremeWindSpeedMs ||
    (input.windGust ?? 0) >= limits.extremeWindGustMs
  ) {
    capped = Math.min(capped, 30);
  }
  if ((input.airQualityIndex ?? 0) >= limits.veryPoorAqiIndex) capped = Math.min(capped, 45);
  if (wmoSeverityPenalty(input.weatherCode) >= 28) capped = Math.min(capped, 25);
  return capped;
};

export const scoreWeatherWindow = ({
  time,
  temperature,
  apparentTemperature,
  humidity,
  precipitationProbability,
  precipitationMm,
  windSpeed,
  windGust,
  airQualityIndex,
  uvIndex,
  visibility,
  weatherCode,
}: ScoreWeatherWindowInput): ScoredWeatherWindow => {
  // Forecast probability is a domain ratio (0–1), and amount is mm. Finite but out-of-range
  // values are invalid evidence, not values to clamp into a believable dry/wet observation.
  const validPrecipitationProbability = isValidPrecipitationProbability(precipitationProbability)
    ? precipitationProbability
    : undefined;
  const validPrecipitationMm = isValidPrecipitationAmount(precipitationMm)
    ? precipitationMm
    : undefined;
  // Required fields can still arrive broken from a provider; never let NaN reach the score.
  const temperatureKnown = Number.isFinite(temperature);
  const wind = Number.isFinite(windSpeed) && windSpeed >= 0 ? windSpeed : 0;
  const gust = Number.isFinite(windGust) && (windGust as number) >= 0 ? windGust : undefined;
  const resolved = resolveApparentTemperature({
    temperature,
    apparentTemperature,
    humidity,
    windSpeed: wind,
  });
  const apparent = Number.isFinite(resolved) ? resolved : 22;
  const impacts: ScoreFactorImpact[] = [];
  const reasons: DecisionReasonCode[] = [];

  const thermalParts = thermalComponents(apparent);
  const thermal = Number.isFinite(resolved) ? thermalParts.centre + thermalParts.stress : 0;
  const rain = precipitationPenalty(validPrecipitationProbability, validPrecipitationMm);
  const windRiskPenalty = windPenalty(wind, gust);
  const air = airQualityPenalty(airQualityIndex);
  const uv = uvPenalty(uvIndex);
  const visibilityRisk = visibilityPenalty(visibility);
  const severe = severeWeatherPenalty(weatherCode, {
    visibility: Number.isFinite(visibility),
    precipitationMm: validPrecipitationMm !== undefined,
  });

  addImpact(impacts, 'thermal', thermal);
  addImpact(impacts, 'precipitation', rain);
  addImpact(impacts, 'wind', windRiskPenalty);
  addImpact(impacts, 'air-quality', air);
  addImpact(impacts, 'uv', uv);
  addImpact(impacts, 'visibility', visibilityRisk);
  addImpact(impacts, 'severe-weather', severe);

  if (apparent >= EXTREME_HEAT_APPARENT_C) reasons.push('extreme-heat');
  else if (apparent >= HEAT_APPARENT_C) reasons.push('heat');
  else if (apparent <= FREEZING_APPARENT_C) reasons.push('freezing');
  else if (apparent <= COLD_APPARENT_C) reasons.push('cold');

  const rainRisk = rainLevel(validPrecipitationProbability, validPrecipitationMm);
  if (rainRisk === 'likely') reasons.push('heavy-rain');
  else if (rainRisk === 'possible') reasons.push('rain-risk');

  const windRisk = windLevel(wind, gust);
  if (windRisk === 'strong') reasons.push('strong-wind');
  else if ((gust ?? 0) >= WIND_CAUTION_GUST) reasons.push('gusty-wind');
  else if (windRisk === 'caution') reasons.push('windy');

  const airRisk = airLevel(airQualityIndex);
  if (airRisk === 'poor' || airRisk === 'very-poor') reasons.push('poor-air-quality');
  else if (airRisk === 'sensitive') reasons.push('sensitive-air-quality');
  if ((uvIndex ?? 0) >= 6) reasons.push('high-uv');
  if ((visibility ?? Number.POSITIVE_INFINITY) < 2000) reasons.push('low-visibility');
  if (wmoSeverityPenalty(weatherCode) >= SEVERE_WEATHER_PENALTY) reasons.push('severe-weather');

  const materialRisks = [thermal, rain, windRiskPenalty, air, uv, visibilityRisk, severe].filter(
    value => value >= 8
  ).length;
  const compound = materialRisks >= 2 ? Math.min(12, (materialRisks - 1) * 4) : 0;
  addImpact(impacts, 'compound', compound);

  let score = clampScore(
    100 - (thermal + rain + windRiskPenalty + air + uv + visibilityRisk + severe + compound)
  );
  score = applySafetyCaps(score, {
    apparentTemperature: apparent,
    precipitationMm: validPrecipitationMm,
    windSpeed: wind,
    windGust: gust,
    airQualityIndex,
    weatherCode,
  });
  // An hour without a temperature is incomplete evidence, never an ideal hour.
  if (!temperatureKnown || !Number.isFinite(resolved)) score = Math.min(score, 89);

  // Missing rain evidence is not evidence of dry weather. Keep an otherwise ideal-looking
  // hour out of the excellent band until at least probability or measured amount is known.
  const hasPrecipitationEvidence =
    validPrecipitationProbability !== undefined || validPrecipitationMm !== undefined;
  if (!hasPrecipitationEvidence) score = Math.min(score, 89);

  // A named material risk and the “very suitable” label should never coexist. The score
  // remains continuous, but the top band is reserved for windows with no surfaced warning.
  if (reasons.length > 0) score = Math.min(score, 96);

  return {
    time,
    score,
    band: getScoreBand(score),
    temperature,
    apparentTemperature: Math.round(apparent * 10) / 10,
    penalties: {
      thermal,
      thermalCentre: Number.isFinite(resolved) ? thermalParts.centre : 0,
      thermalStress: Number.isFinite(resolved) ? thermalParts.stress : 0,
      precipitation: rain,
      wind: windRiskPenalty,
      airQuality: air,
      uv,
      visibility: visibilityRisk,
      severeWeather: severe,
      compound,
    },
    precipitationProbability: validPrecipitationProbability,
    precipitationMm: validPrecipitationMm,
    windSpeed: wind,
    windGust: gust,
    humidity,
    uvIndex,
    visibility,
    weatherCode,
    reasons: [...new Set(reasons)],
    impacts: impacts.sort((a, b) => b.penalty - a.penalty),
  };
};
