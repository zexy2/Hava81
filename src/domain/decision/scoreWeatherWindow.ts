import type { DecisionReasonCode, Hava81ScoreBand, ScoredWeatherWindow } from './types';

export interface ScoreWeatherWindowInput {
  time: Date;
  temperature: number;
  precipitationProbability: number;
  windSpeed?: number;
  airQualityIndex?: number;
}

export const getScoreBand = (score: number): Hava81ScoreBand => {
  if (score >= 85) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 50) return 'caution';
  return 'difficult';
};

const clampScore = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

export const scoreWeatherWindow = ({
  time,
  temperature,
  precipitationProbability,
  windSpeed = 0,
  airQualityIndex,
}: ScoreWeatherWindowInput): ScoredWeatherWindow => {
  let score = 100;
  const reasons: DecisionReasonCode[] = [];

  if (temperature >= 40) {
    score -= 55;
    reasons.push('extreme-heat');
  } else if (temperature >= 36) {
    score -= 40;
    reasons.push('extreme-heat');
  } else if (temperature >= 32) {
    score -= 22;
    reasons.push('heat');
  } else if (temperature <= -5) {
    score -= 55;
    reasons.push('freezing');
  } else if (temperature <= 0) {
    score -= 40;
    reasons.push('freezing');
  } else if (temperature <= 5) {
    score -= 22;
    reasons.push('cold');
  }

  if (precipitationProbability >= 0.8) {
    score -= 45;
    reasons.push('heavy-rain');
  } else if (precipitationProbability >= 0.5) {
    score -= 30;
    reasons.push('heavy-rain');
  } else if (precipitationProbability >= 0.25) {
    score -= 12;
    reasons.push('rain-risk');
  }

  if (windSpeed >= 17.2) {
    score -= 35;
    reasons.push('strong-wind');
  } else if (windSpeed >= 10.8) {
    score -= 20;
    reasons.push('strong-wind');
  } else if (windSpeed >= 8) {
    score -= 8;
    reasons.push('windy');
  }

  if (airQualityIndex !== undefined) {
    if (airQualityIndex >= 5) {
      score -= 40;
      reasons.push('poor-air-quality');
    } else if (airQualityIndex >= 4) {
      score -= 28;
      reasons.push('poor-air-quality');
    } else if (airQualityIndex >= 3) {
      score -= 12;
      reasons.push('sensitive-air-quality');
    }
  }

  const normalizedScore = clampScore(score);

  return {
    time,
    score: normalizedScore,
    band: getScoreBand(normalizedScore),
    temperature,
    precipitationProbability,
    windSpeed,
    reasons,
  };
};
