/** Refuse to score an app-shell loading/error screen as if it were the weather UI. */
export function assertLighthouseWeatherReady(report) {
  const requests = report?.audits?.['network-requests']?.details?.items;
  const hasSuccessfulCurrentWeather =
    Array.isArray(requests) &&
    requests.some(request => {
      if (typeof request?.url !== 'string') return false;
      let pathname;
      try {
        pathname = new URL(request.url).pathname;
      } catch {
        return false;
      }
      const statusCode = Number(request.statusCode);
      return (
        pathname === '/api/v1/weather/current' &&
        Number.isInteger(statusCode) &&
        statusCode >= 200 &&
        statusCode < 300
      );
    });

  if (!hasSuccessfulCurrentWeather) {
    throw new Error(
      'Lighthouse did not receive a successful /api/v1/weather/current response; refusing to score the loading/error shell.'
    );
  }
  return true;
}
