/** Refuse to score an app-shell loading/error screen as if it were the weather UI. */
const CURRENT_WEATHER_PATH = '/api/v1/weather/current';

function currentWeatherRequests(report) {
  const requests = report?.audits?.['network-requests']?.details?.items;
  if (!Array.isArray(requests)) return [];

  return requests.filter(request => {
    if (typeof request?.url !== 'string') return false;
    try {
      return new URL(request.url).pathname === CURRENT_WEATHER_PATH;
    } catch {
      return false;
    }
  });
}

function describeRequest(request) {
  const status = Number.isFinite(Number(request?.statusCode))
    ? `statusCode=${Number(request.statusCode)}`
    : 'statusCode=unknown';
  const startedAt = Number(request?.rendererStartTime);
  const endedAt = Number(request?.networkEndTime);
  const elapsedMs = endedAt - startedAt;
  const duration = Number.isFinite(elapsedMs) && elapsedMs > 0
    ? ` after ${Math.round(elapsedMs)}ms`
    : '';
  return `${status}${duration}`;
}

export function assertLighthouseWeatherReady(report) {
  const requests = currentWeatherRequests(report);
  const hasSuccessfulCurrentWeather = requests.some(request => {
    const statusCode = Number(request.statusCode);
    return Number.isInteger(statusCode) && statusCode >= 200 && statusCode < 300;
  });

  if (!hasSuccessfulCurrentWeather) {
    const observed = requests.length
      ? ` Observed ${requests.map(describeRequest).join(', ')}.`
      : ' No current-weather request was recorded.';
    throw new Error(
      `Lighthouse did not receive a successful ${CURRENT_WEATHER_PATH} response; refusing to score the loading/error shell.${observed}`
    );
  }
  return true;
}

/**
 * Retry one complete measurement when real current weather was not observed.
 * A report is usable only when it contains a successful current-weather response;
 * two failed reports remain a hard failure and preserve both diagnostics.
 */
export async function withLighthouseWeatherReadinessConfirmation(report, confirmMeasurement) {
  try {
    assertLighthouseWeatherReady(report);
    return report;
  } catch (firstError) {
    let confirmationReport;
    try {
      confirmationReport = await confirmMeasurement();
      assertLighthouseWeatherReady(confirmationReport);
      return confirmationReport;
    } catch (confirmationError) {
      const firstMessage = firstError instanceof Error ? firstError.message : String(firstError);
      const confirmationMessage = confirmationError instanceof Error
        ? confirmationError.message
        : String(confirmationError);
      throw new Error(
        `${confirmationMessage} (first measurement also failed readiness: ${firstMessage})`,
        { cause: confirmationError }
      );
    }
  }
}
