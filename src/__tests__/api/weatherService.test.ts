/**
 * Weather Service Tests
 */

import { ApiError } from '../../api/errors/ApiError';

// Set environment variable for tests
process.env.REACT_APP_OPENWEATHER_KEY = 'test-api-key';

describe('weatherService - ApiError', () => {
  describe('ApiError class', () => {
    it('should create error with message and code', () => {
      const error = new ApiError('Test error', undefined, { retryable: false });
      
      expect(error.message).toBe('Test error');
      expect(error.retryable).toBe(false);
    });

    it('should create city not found error', () => {
      const error = ApiError.cityNotFound('TestCity');
      
      expect(error.message).toContain('TestCity');
      expect(error.retryable).toBe(false);
    });

    it('should create network error', () => {
      const error = ApiError.networkError();
      
      expect(error.message).toContain('bağlantı');
      expect(error.retryable).toBe(true);
    });

    it('should create error from HTTP status 404', () => {
      const error = ApiError.fromHttpStatus(404);
      
      expect(error.statusCode).toBe(404);
    });

    it('should create error from HTTP status 500', () => {
      const error = ApiError.fromHttpStatus(500);
      
      expect(error.statusCode).toBe(500);
      expect(error.retryable).toBe(true);
    });

    it('should convert to JSON', () => {
      const error = new ApiError('Test', undefined, { retryable: true });
      const json = error.toJSON();
      
      expect(json.message).toBe('Test');
      expect(json.retryable).toBe(true);
      expect(json.timestamp).toBeDefined();
    });
  });
});
