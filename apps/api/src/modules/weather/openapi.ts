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
    lat: { type: 'number', minimum: -90, maximum: 90 },
    lon: { type: 'number', minimum: -180, maximum: 180 },
    units: { type: 'string', enum: ['metric', 'imperial', 'standard'], default: 'metric' },
    lang: { type: 'string', enum: ['tr', 'en'], default: 'tr' },
  },
} as const;

export const forecastQueryJsonSchema = {
  type: 'object',
  required: ['lat', 'lon'],
  properties: {
    lat: { type: 'number', minimum: -90, maximum: 90 },
    lon: { type: 'number', minimum: -180, maximum: 180 },
    units: { type: 'string', enum: ['metric', 'imperial', 'standard'], default: 'metric' },
    lang: { type: 'string', enum: ['tr', 'en'], default: 'tr' },
  },
} as const;

export const hourlyForecastQueryJsonSchema = {
  type: 'object',
  required: ['lat', 'lon'],
  properties: {
    lat: { type: 'number', minimum: -90, maximum: 90 },
    lon: { type: 'number', minimum: -180, maximum: 180 },
    lang: { type: 'string', enum: ['tr', 'en'], default: 'tr' },
  },
} as const;

export const airQualityQueryJsonSchema = {
  type: 'object',
  required: ['lat', 'lon'],
  properties: {
    lat: { type: 'number', minimum: -90, maximum: 90 },
    lon: { type: 'number', minimum: -180, maximum: 180 },
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
          windSpeed: { type: 'number' },
          apparentTemperature: { type: 'number' },
          humidity: { type: 'number', minimum: 0, maximum: 100 },
          precipitationMm: { type: 'number', minimum: 0 },
          windGust: { type: 'number', minimum: 0 },
          uvIndex: { type: 'number', minimum: 0 },
          visibility: { type: 'number', minimum: 0 },
          weatherCode: { type: 'number' },
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
