import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from '../../components/ErrorBoundary';

const ThrowingChild = () => {
  throw new Error('secret implementation detail');
};

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps raw error details out of the default user-visible fallback', () => {
    render(
      <ErrorBoundary>
        <ThrowingChild />
      </ErrorBoundary>
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Bir şeyler yanlış gitti');
    expect(screen.queryByText('secret implementation detail')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tekrar Dene' })).toHaveAttribute('type', 'button');
  });
});
