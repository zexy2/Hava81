/**
 * Faz 3.2: çağıranın iptal ettiği istekler için ortak hata. Zaman aşımından
 * (ApiError NETWORK_ERROR) ayrıdır ve kullanıcıya hata olarak gösterilmez.
 */
export const createAbortError = (): Error => {
  const error = new Error('İstek iptal edildi');
  error.name = 'AbortError';
  return error;
};

export const isAbortError = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  (error as { name?: unknown }).name === 'AbortError';
