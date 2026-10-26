import type { HourlyForecast, AirQuality } from '../../types';
import { getOptionalEvidenceFreshness } from '../../utils/optionalEvidenceFreshness';
import { isDaylightPoint, isWithinActiveHours } from '../decision/eligibility';
import {
  applySafetyCaps,
  getScoreBand,
  HAVA81_ABSOLUTE_SAFETY_LIMITS,
  scoreWeatherWindow,
  SEVERE_WEATHER_PENALTY,
  wmoSeverityPenalty,
} from '../decision/scoreWeatherWindow';
import { getPlanConfidence } from './confidence';
import { getPlanProfile } from './profiles';
import type {
  PersonalTolerance,
  PlanHourScore,
  PlanIntent,
  PlanPenalties,
  PlanTemperatureSensitivity,
  WeatherTolerance,
} from './types';

const HOUR_MS = 60 * 60 * 1000;

const LOW_VISIBILITY_METERS = 1_000;
// Snow showers are below the named severe-weather level but still block outdoor plans: sudden
// snow and slippery ground make the hour unsuitable as a recommendation.
const GATED_SNOW_SHOWER_CODES: ReadonlySet<number> = new Set([85]);
/** Intent penalties of this size count as a material risk family for the compound penalty. */
const MATERIAL_RISK_PENALTY = 8;

const roundPenalty = (value: number): number =>
  Math.round(Math.max(0, Number.isFinite(value) ? value : 0) * 10) / 10;

const smoothstep = (value: number, start: number, end: number) => {
  const t = Math.max(0, Math.min(1, (value - start) / (end - start)));
  return t * t * (3 - 2 * t);
};

/** Saturation vapour pressure in kPa (Tetens). */
const saturationKpa = (celsius: number) => 0.6108 * Math.exp((17.27 * celsius) / (celsius + 237.3));

/**
 * Laundry drying penalty: low vapour-pressure deficit (damp air) and missing sun slow drying.
 * Dew point is preferred; relative humidity is the fallback; without either, no claim is made.
 */
const dryingPenaltyFor = (point: HourlyForecast): number => {
  if (!Number.isFinite(point.temp)) return 0;
  const saturation = saturationKpa(point.temp);
  const actual = Number.isFinite(point.dewPoint)
    ? saturationKpa(Math.min(point.dewPoint as number, point.temp))
    : Number.isFinite(point.humidity)
      ? (saturation * Math.max(0, Math.min(100, point.humidity as number))) / 100
      : undefined;
  const damp = actual === undefined ? 0 : 22 * (1 - smoothstep(saturation - actual, 0.4, 1.6));
  const shade = Number.isFinite(point.sunshineDuration)
    ? 8 * (1 - Math.max(0, Math.min(1, (point.sunshineDuration as number) / 3600)))
    : 0;
  return damp + shade;
};

/** Pollen (grains/m³) from which an allergic person starts to notice it, and the named level. */
const POLLEN_NOTICEABLE = 20;
export const POLLEN_HIGH = 50;
const TOLERANCE_WEIGHT: Readonly<Record<WeatherTolerance, number>> = {
  low: 1.3,
  normal: 1,
  high: 0.7,
};

/** Dew point at which running starts to feel muggy, and where it is oppressive. */
export const MUGGY_DEW_POINT_C = 20;
const OPPRESSIVE_DEW_POINT_C = 24;
/** WHO 24-h PM10 guideline (µg/m³): dust below it is not a plan factor. */
const DUST_GUIDELINE_UGM3 = 45;
/** Daily dust peak named as a Saharan-dust day. */
export const DUST_EVENT_UGM3 = 100;

const comfortPenaltyFor = (
  apparentTemperature: number,
  range: readonly [number, number]
): number => {
  const distance =
    apparentTemperature < range[0]
      ? range[0] - apparentTemperature
      : apparentTemperature > range[1]
        ? apparentTemperature - range[1]
        : 0;
  return Math.min(18, distance * 1.6);
};

/** Personal sensitivity moves the comfort range: heat-sensitive users feel hot sooner. */
const shiftedComfortRange = (
  range: readonly [number, number],
  sensitivity: PlanTemperatureSensitivity
): readonly [number, number] => {
  if (sensitivity === 'heat') return [range[0] - 2, range[1] - 3];
  if (sensitivity === 'cold') return [range[0] + 3, range[1] + 2];
  return range;
};

const emptyPenalties = (total: number): PlanPenalties => ({
  thermal: total,
  precipitation: 0,
  wind: 0,
  airQuality: 0,
  uv: 0,
  visibility: 0,
  severeWeather: 0,
  drying: 0,
  muggy: 0,
  dust: 0,
  pollen: 0,
  compound: 0,
  comfort: 0,
  total,
});

export interface ScoreHourInput {
  intent: PlanIntent;
  point: HourlyForecast;
  timezoneOffsetSeconds: number;
  now?: Date;
  airQuality?: AirQuality;
  /** Fresh, exact-hour AQI already normalized to OpenWeather's 1–5 scale. */
  airQualityIndexOverride?: number;
  sensitivity?: PlanTemperatureSensitivity;
  /** Fresh daily dust peak (µg/m³) for this slot's local day; absent when unknown. */
  dustUgM3?: number;
  /** Fresh 24-hour pollen peak (grains/m³); only used with a declared allergy. */
  pollenGrainsM3?: number;
  tolerance?: PersonalTolerance;
}

/**
 * Score one forecast slot for an intent. The shared model supplies unrounded weather penalties;
 * the intent re-weights them and replaces the general 22 °C comfort centre with its own comfort
 * range, so no weather factor is counted twice. Absolute safety caps and gates never move.
 */
export const scoreHour = ({
  intent,
  point,
  timezoneOffsetSeconds,
  now = new Date(),
  airQuality,
  airQualityIndexOverride,
  sensitivity = 'balanced',
  dustUgM3,
  pollenGrainsM3,
  tolerance = {},
}: ScoreHourInput): PlanHourScore => {
  const profile = getPlanProfile(intent);
  const timeIsValid = point.time instanceof Date && Number.isFinite(point.time.getTime());
  const requiredWeatherIsValid =
    timeIsValid &&
    Number.isFinite(point.temp) &&
    Number.isFinite(point.windSpeed) &&
    point.windSpeed >= 0;
  if (!requiredWeatherIsValid) {
    return {
      intent,
      time: point.time,
      score: 0,
      baseScore: 0,
      band: 'difficult',
      temperature: point.temp,
      apparentTemperature: Number.isFinite(point.apparentTemperature)
        ? (point.apparentTemperature as number)
        : point.temp,
      windSpeed: point.windSpeed,
      reasons: [],
      baseReasons: [],
      penalties: emptyPenalties(100),
      eligible: false,
      gateReasons: ['invalid-weather-data'],
      confidence: 'low',
      forecastHoursAhead: Number.POSITIVE_INFINITY,
      dataCoverage: 0,
    };
  }

  const freshAirQuality =
    airQuality && getOptionalEvidenceFreshness(airQuality.meta, now.getTime()).fresh
      ? airQuality
      : undefined;
  const rawAqi = airQualityIndexOverride ?? freshAirQuality?.aqi;
  const airQualityIndex =
    Number.isInteger(rawAqi) && (rawAqi as number) >= 1 && (rawAqi as number) <= 5
      ? rawAqi
      : undefined;
  const base = scoreWeatherWindow({
    time: point.time,
    temperature: point.temp,
    apparentTemperature: point.apparentTemperature,
    humidity: point.humidity,
    precipitationProbability: point.pop,
    precipitationMm: point.precipitationMm,
    windSpeed: point.windSpeed,
    windGust: point.windGust,
    airQualityIndex,
    uvIndex: point.uvIndex,
    visibility: point.visibility,
    weatherCode: point.weatherCode,
  });
  const raw = base.penalties;
  const w = profile.weights;
  const apparent = base.apparentTemperature;
  const comfortRange = shiftedComfortRange(profile.comfortRangeC, sensitivity);
  const comfort = comfortPenaltyFor(apparent, comfortRange);
  const heatStress = apparent > 25 ? (raw?.thermalStress ?? 0) : 0;
  const stress = profile.heatIsBeneficial
    ? (raw?.thermalStress ?? 0) - heatStress
    : (raw?.thermalStress ?? 0);
  const dryingPenalty = profile.dryingModel ? dryingPenaltyFor(point) : 0;
  const muggyPenalty =
    profile.mugginessWeight && Number.isFinite(point.dewPoint)
      ? 12 *
        smoothstep(point.dewPoint as number, MUGGY_DEW_POINT_C - 2, OPPRESSIVE_DEW_POINT_C) *
        profile.mugginessWeight
      : 0;
  const pollenPenalty =
    tolerance.pollenAllergy && profile.pollenWeight && Number.isFinite(pollenGrainsM3)
      ? 18 * smoothstep(pollenGrainsM3 as number, POLLEN_NOTICEABLE, 150) * profile.pollenWeight
      : 0;
  const windTolerance = TOLERANCE_WEIGHT[tolerance.wind ?? 'normal'];
  const rainTolerance = TOLERANCE_WEIGHT[tolerance.rain ?? 'normal'];
  const dustPenalty =
    profile.dustWeight && Number.isFinite(dustUgM3)
      ? 18 * smoothstep(dustUgM3 as number, DUST_GUIDELINE_UGM3, 200) * profile.dustWeight
      : 0;

  const weighted: PlanPenalties = {
    thermal: (stress + comfort) * w.thermal,
    precipitation: (raw?.precipitation ?? 0) * w.precipitation * rainTolerance,
    wind: (raw?.wind ?? 0) * w.wind * windTolerance,
    airQuality: (raw?.airQuality ?? 0) * w['air-quality'],
    uv: (raw?.uv ?? 0) * w.uv,
    visibility: (raw?.visibility ?? 0) * w.visibility,
    severeWeather: (raw?.severeWeather ?? 0) * w['severe-weather'],
    drying: dryingPenalty,
    muggy: muggyPenalty,
    dust: dustPenalty,
    pollen: pollenPenalty,
    compound: 0,
    comfort: roundPenalty(comfort),
    total: 0,
  };
  // Compound risk counts the families that matter for this intent, after weighting: AQI does
  // not make laundry a "multi-risk" hour.
  const materialRisks = [
    weighted.thermal,
    weighted.precipitation,
    weighted.wind,
    weighted.airQuality,
    weighted.uv,
    weighted.visibility,
    weighted.severeWeather,
    weighted.drying,
    weighted.muggy,
    weighted.dust,
    weighted.pollen,
  ].filter(value => value >= MATERIAL_RISK_PENALTY).length;
  weighted.compound = (materialRisks >= 2 ? Math.min(12, (materialRisks - 1) * 4) : 0) * w.compound;

  for (const key of [
    'thermal',
    'precipitation',
    'wind',
    'airQuality',
    'uv',
    'visibility',
    'severeWeather',
    'drying',
    'muggy',
    'dust',
    'pollen',
    'compound',
  ] as const) {
    weighted[key] = roundPenalty(weighted[key]);
  }
  weighted.total = roundPenalty(
    weighted.thermal +
      weighted.precipitation +
      weighted.wind +
      weighted.airQuality +
      weighted.uv +
      weighted.visibility +
      weighted.severeWeather +
      weighted.drying +
      weighted.muggy +
      weighted.dust +
      weighted.pollen +
      weighted.compound
  );

  let score = Math.max(0, Math.min(100, Math.round(100 - weighted.total)));
  const hasRainEvidence =
    base.precipitationProbability !== undefined || base.precipitationMm !== undefined;
  const limits = HAVA81_ABSOLUTE_SAFETY_LIMITS;
  const gateReasons: PlanHourScore['gateReasons'] = [];
  if (profile.requiresDaylight && !isDaylightPoint(point)) gateReasons.push('daylight-required');
  if (profile.activeHoursOnly && !isWithinActiveHours(point.time, timezoneOffsetSeconds)) {
    gateReasons.push('outside-active-hours');
  }
  if (
    (base.precipitationProbability ?? 0) > profile.maxPrecipitationProbability ||
    (base.precipitationMm ?? 0) > profile.maxPrecipitationMm
  ) {
    gateReasons.push('precipitation-limit');
  }
  if (profile.requiresRainEvidence && !hasRainEvidence) gateReasons.push('precipitation-unknown');
  if (base.windSpeed > profile.maxWindSpeedMs || (base.windGust ?? 0) > profile.maxWindGustMs) {
    gateReasons.push('wind-limit');
  }
  // Absolute hazard ceilings must block recommendation eligibility as well as cap the visible
  // score. Otherwise an intent with a low score threshold or softened factor weights could still
  // surface an extreme hour as a valid plan window.
  if (apparent >= limits.extremeHeatApparentC || apparent <= limits.extremeColdApparentC) {
    gateReasons.push('extreme-temperature');
  }
  if ((base.precipitationMm ?? 0) >= limits.heavyPrecipitationMm) {
    gateReasons.push('heavy-precipitation');
  }
  if (
    base.windSpeed >= limits.extremeWindSpeedMs ||
    (base.windGust ?? 0) >= limits.extremeWindGustMs
  ) {
    gateReasons.push('extreme-wind');
  }
  if ((airQualityIndex ?? 0) >= limits.veryPoorAqiIndex) {
    gateReasons.push('very-poor-air-quality');
  }
  if (Number.isFinite(point.visibility) && (point.visibility as number) < LOW_VISIBILITY_METERS) {
    gateReasons.push('low-visibility');
  }
  if (
    wmoSeverityPenalty(point.weatherCode) >= SEVERE_WEATHER_PENALTY ||
    (Number.isFinite(point.weatherCode) && GATED_SNOW_SHOWER_CODES.has(point.weatherCode as number))
  ) {
    gateReasons.push('severe-weather');
  }

  const forecastHoursAhead = Math.max(0, (point.time.getTime() - now.getTime()) / HOUR_MS);
  // Coverage is evidence completeness, not the presence of a derived value. Apparent temperature
  // is useful for comfort scoring but may be derived from other weather fields, so it is excluded
  // from both the independent-signal numerator and denominator.
  const signals = [
    point.temp,
    point.humidity,
    base.precipitationProbability,
    base.precipitationMm,
    point.windSpeed,
    point.windGust,
    airQualityIndex,
    point.uvIndex,
    point.visibility,
    point.weatherCode,
  ];
  const knownSignals = signals.filter(Number.isFinite).length;
  const dataCoverage = knownSignals / signals.length;
  // Base reasons describe the weather; an intent drops the ones it does not care about.
  // A reason that triggers a safety cap always stays visible, whatever the weight.
  const reasons = base.reasons.filter(reason => {
    if (reason === 'high-uv') return w.uv > 0;
    if (reason === 'sensitive-air-quality') return w['air-quality'] > 0;
    if (reason === 'poor-air-quality') {
      return w['air-quality'] > 0 || (airQualityIndex ?? 0) >= limits.veryPoorAqiIndex;
    }
    if (reason === 'heat' || reason === 'extreme-heat')
      return !profile.heatIsBeneficial || apparent >= 40;
    return true;
  });
  if (muggyPenalty >= 6) reasons.push('muggy');
  if (dustPenalty > 0 && (dustUgM3 as number) >= DUST_EVENT_UGM3) reasons.push('dust');
  if (pollenPenalty > 0 && (pollenGrainsM3 as number) >= POLLEN_HIGH) reasons.push('pollen');
  if (
    comfort >= 8 &&
    apparent > comfortRange[1] &&
    !reasons.includes('heat') &&
    !reasons.includes('extreme-heat')
  ) {
    reasons.push('heat');
  } else if (
    comfort >= 8 &&
    apparent < comfortRange[0] &&
    !reasons.includes('cold') &&
    !reasons.includes('freezing')
  ) {
    reasons.push('cold');
  }

  // Intent weights tune comfort/preferences, not hard safety ceilings. Preserve the absolute
  // caps from the shared score model so a zero-weight factor cannot make a dangerous hour look
  // excellent (e.g. AQI 5 for laundry, or severe thunderstorm weather codes).
  // Heat-beneficial plans (laundry) keep every cap except the human heat-exposure one; the
  // extreme-heat reason stays visible and 43 °C+ still blocks the hour.
  score = applySafetyCaps(
    score,
    {
      apparentTemperature: apparent,
      precipitationMm: base.precipitationMm,
      windSpeed: base.windSpeed,
      windGust: base.windGust,
      airQualityIndex,
      weatherCode: point.weatherCode,
    },
    { heatExposure: !profile.heatIsBeneficial }
  );
  // Intent weighting must not erase the shared model's evidence-completeness cap. A finite but
  // invalid ratio/amount is unknown, just like a missing field, and cannot support an excellent
  // hour. For a rain-only plan (laundry, picnic) unknown rain cannot even look good.
  if (!hasRainEvidence) score = Math.min(score, profile.requiresRainEvidence ? 74 : 89);
  // Match the shared model's label invariant even when intent weighting softens a surfaced risk.
  if (reasons.length > 0) score = Math.min(score, 96);

  return {
    intent,
    time: point.time,
    score,
    baseScore: base.score,
    band: getScoreBand(score),
    temperature: point.temp,
    apparentTemperature: apparent,
    humidity: point.humidity,
    precipitationProbability: base.precipitationProbability,
    precipitationMm: base.precipitationMm,
    windSpeed: base.windSpeed,
    windGust: base.windGust,
    airQualityIndex,
    uvIndex: point.uvIndex,
    visibility: point.visibility,
    weatherCode: point.weatherCode,
    reasons: [...new Set(reasons)],
    baseReasons: base.reasons,
    penalties: weighted,
    eligible: gateReasons.length === 0,
    gateReasons,
    confidence: getPlanConfidence(forecastHoursAhead, dataCoverage),
    forecastHoursAhead,
    dataCoverage,
  };
};
