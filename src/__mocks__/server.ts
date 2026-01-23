/**
 * MSW Server Setup for Testing
 */

import { setupServer } from 'msw/node';
import { handlers } from './handlers';

// Setup mock server with default handlers
export const server = setupServer(...handlers);

// Start server before all tests
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

// Reset handlers after each test
afterEach(() => server.resetHandlers());

// Clean up after all tests
afterAll(() => server.close());

export { handlers };
