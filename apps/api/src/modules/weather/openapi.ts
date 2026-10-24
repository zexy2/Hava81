import { turkeyLatJsonSchema, turkeyLonJsonSchema } from '../../core/geo';
const coordinatesSchema = {
  type: 'object',
  required: ['lat', 'lon'],
  properties: {
    lat: { type: 'number' },
    lon: { type: 'number' },
  },
} as const;

const metaSchema = {
  type: 'object',
  required: ['provider', 'fetchedAt'],
  properties: {
    provider: { type: 'string' },
    fetchedAt: { type: 'string', format: 'date-time' },
    observedAt: { type: 'string', format: 'date-time' },
    timezoneOffsetSeconds: { type: 'number' },
    intervalHours: { type: 'number' },
    attribution: { type: 'string' },
    sourceUrl: { type: 'string', format: 'uri' },
    cacheStatus: { type: 'string', enum: ['HIT', 'MISS', 'COALESCED'] },
    freshForSeconds: { type: 'number' },
  },
} as const;

export const currentQueryJsonSchema = {
  type: 'object',
  properties: {
    city: { type: 'string', minLength: 1, maxLength: 80 },
    lat: turkeyLatJsonSchema,
    lon: turkeyLonJsonSchema,
    units: { type: 'string', enum: ['metric', 'imperial', 'standard'], default: 'metric' },
    lang: { type: 'string', enum: ['tr', 'en'], default: 'tr' },
  },
} as const;

export const forecastQueryJsonSchema = {
  type: 'object',
  required: ['lat', 'lon'],
  properties: {
    lat: turkeyLatJsonSchema,
    lon: turkeyLonJsonSchema,
    units: { type: 'string', enum: ['metric', 'imperial', 'standard'], default: 'metric' },
    lang: { type: 'string', enum: ['tr', 'en'], default: 'tr' },
  },
} as const;

export const hourlyForecastQueryJsonSchema = {
  type: 'object',
  required: ['lat', 'lon'],
  properties: {
    lat: turkeyLatJsonSchema,
    lon: turkeyLonJsonSchema,
    lang: { type: 'string', enum: ['tr', 'en'], default: 'tr' },
  },
} as const;

export const airQualityQueryJsonSchema = {
  type: 'object',
  required: ['lat', 'lon'],
  properties: {
    lat: turkeyLatJsonSchema,
    lon: turkeyLonJsonSchema,
    lang: { type: 'string', enum: ['tr', 'en'], default: 'tr' },
  },
} as const;

export const currentResponseJsonSchema = {
  type: 'object',
  required: ['cityName','country','temperature','feelsLike','tempMin','tempMax','humidity','pressure','windSpeed','windDirection','description','icon','sunrise','sunset','timestamp','coordinates','clouds','meta'],
  properties: {
    cityName: { type: 'string' }, country: { type: 'string' }, temperature: { type: 'number' }, feelsLike: { type: 'number' },
    tempMin: { type: 'number' }, tempMax: { type: 'number' }, humidity: { type: 'number' }, pressure: { type: 'number' },
    visibility: { type: 'number' }, windSpeed: { type: 'number' }, windDirection: { type: 'number' }, description: { type: 'string' },
    icon: { type: 'string' }, sunrise: { type: 'string', format: 'date-time' }, sunset: { type: 'string', format: 'date-time' },
    timestamp: { type: 'string', format: 'date-time' }, coordinates: coordinatesSchema, clouds: { type: 'number' }, meta: metaSchema,
  },
} as const;

export const forecastResponseJsonSchema = {
  type: 'object',
  required: ['daily', 'hourly', 'meta'],
  properties: {
    daily: {
      type: 'array',
      items: {
        type: 'object',
        required: ['date', 'tempMin', 'tempMax', 'icon', 'description', 'pop'],
        properties: {
          date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' }, tempMin: { type: 'number' }, tempMax: { type: 'number' },
          icon: { type: 'string' }, description: { type: 'string' }, pop: { type: 'number' },
        },
      },
    },
    hourly: {
      type: 'array',
      items: {
        type: 'object',
        required: ['time', 'temp', 'icon', 'description', 'pop', 'windSpeed'],
        properties: {
          time: { type: 'string', format: 'date-time' }, temp: { type: 'number' }, icon: { type: 'string' },
          description: { type: 'string' }, pop: { type: 'number' }, windSpeed: { type: 'number' },
        },
      },
    },
    meta: metaSchema,
  },
} as const;

export const hourlyForecastResponseJsonSchema = {
  type: 'object',
  required: ['hourly', 'meta'],
  properties: {
    daily: {
      type: 'array',
      items: {
        type: 'object',
        required: ['date', 'tempMin', 'tempMax', 'icon', 'description', 'pop'],
        properties: {
          date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
          tempMin: { type: 'number' },
          tempMax: { type: 'number' },
          icon: { type: 'string' },
          description: { type: 'string' },
          pop: { type: 'number', minimum: 0, maximum: 100 },
          precipitationMm: { type: 'number', minimum: 0, maximum: 2000 },
          sunrise: { type: 'string', format: 'date-time' },
          sunset: { type: 'string', format: 'date-time' },
        },
      },
    },
    hourly: {
      type: 'array',
      items: {
        type: 'object',
        required: ['time', 'temp', 'icon', 'description', 'pop', 'windSpeed'],
        properties: {
          time: { type: 'string', format: 'date-time' },
          temp: { type: 'number' },
          icon: { type: 'string' },
          description: { type: 'string' },
          pop: { type: 'number', minimum: 0, maximum: 100 },
          windSpeed: { type: 'number', minimum: 0, maximum: 150 },
          apparentTemperature: { type: 'number' },
          humidity: { type: 'number', minimum: 0, maximum: 100 },
          precipitationMm: { type: 'number', minimum: 0, maximum: 500 },
          windGust: { type: 'number', minimum: 0, maximum: 150 },
          uvIndex: { type: 'number', minimum: 0, maximum: 50 },
          visibility: { type: 'number', minimum: 0, maximum: 100000 },
          weatherCode: { type: 'number' },
          isDay: { type: 'boolean' },
          dewPoint: { type: 'number' },
          sunshineDuration: { type: 'number', minimum: 0, maximum: 3600 },
        },
      },
    },
    meta: metaSchema,
  },
} as const;

export const airQualityResponseJsonSchema = {
  type: 'object',
  required: ['aqi', 'aqiLabel', 'pm25', 'pm10', 'o3', 'meta'],
  properties: {
    aqi: { type: 'number' }, aqiLabel: { type: 'string' }, pm25: { type: 'number' }, pm10: { type: 'number' }, o3: { type: 'number' }, meta: metaSchema,
  },
} as const;

export const airQualityHourlyResponseJsonSchema = {
  type: 'object',
  required: ['hourly', 'meta'],
  properties: {
    hourly: {
      type: 'array',
      items: {
        type: 'object',
        required: ['time', 'europeanAqi'],
        properties: {
          time: { type: 'string', format: 'date-time' },
          europeanAqi: { type: 'number', minimum: 0 },
          pm25: { type: 'number', minimum: 0 },
        },
      },
    },
    meta: metaSchema,
  },
} as const;

export const bundleQueryJsonSchema = {
  type: 'object',
  required: ['lat', 'lon'],
  additionalProperties: false,
  properties: {
    lat: turkeyLatJsonSchema,
    lon: turkeyLonJsonSchema,
    units: { type: 'string', enum: ['metric', 'imperial', 'standard'], default: 'metric' },
    lang: { type: 'string', enum: ['tr', 'en'], default: 'tr' },
    marine: {
      type: 'string',
      enum: ['true', 'false'],
      description: 'Bağlama deniz verisini (dalga, su sıcaklığı) ekler.',
    },
    include: {
      type: 'string',
      maxLength: 80,
      description:
        'Virgülle ayrılmış parça listesi: current, forecast, hourly, airQuality, context, airQualityHourly. Boşsa airQualityHourly dışındaki parçalar döner.',
    },
  },
} as const;

const contextBundleJsonSchema = {
  type: 'object',
  nullable: true,
  additionalProperties: true,
  required: ['provider', 'fetchedAt'],
  properties: {
    provider: { type: 'string' },
    fetchedAt: { type: 'string', format: 'date-time' },
  },
} as const;

const bundlePartErrorJsonSchema = {
  type: 'object',
  required: ['code', 'message', 'statusCode'],
  properties: {
    code: { type: 'string' },
    message: { type: 'string' },
    statusCode: { type: 'integer' },
  },
} as const;

export const bundleResponseJsonSchema = {
  type: 'object',
  required: ['errors', 'meta'],
  description:
    'İstenen her parça ya dolu ya da null döner; null ise nedeni `errors` içindedir. İstenmeyen parça hiç yer almaz. Tüm parçalar başarısız olursa ilk hata HTTP durum koduyla döner.',
  properties: {
    current: { ...currentResponseJsonSchema, nullable: true },
    forecast: { ...forecastResponseJsonSchema, nullable: true },
    hourly: { ...hourlyForecastResponseJsonSchema, nullable: true },
    airQuality: { ...airQualityResponseJsonSchema, nullable: true },
    context: contextBundleJsonSchema,
    airQualityHourly: { ...airQualityHourlyResponseJsonSchema, nullable: true },
    errors: {
      type: 'object',
      properties: {
        current: bundlePartErrorJsonSchema,
        forecast: bundlePartErrorJsonSchema,
        hourly: bundlePartErrorJsonSchema,
        airQuality: bundlePartErrorJsonSchema,
        context: bundlePartErrorJsonSchema,
        airQualityHourly: bundlePartErrorJsonSchema,
      },
    },
    meta: {
      type: 'object',
      required: ['fetchedAt', 'parts'],
      properties: {
        fetchedAt: { type: 'string', format: 'date-time' },
        parts: { type: 'array', items: { type: 'string' } },
      },
    },
  },
} as const;
