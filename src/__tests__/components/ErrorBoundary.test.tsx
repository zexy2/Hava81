import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../i18n';
import { ErrorBoundary } from '../../components/ErrorBoundary';

const ThrowingChild = () => {
  throw new Error('secret implementation detail');
};

describe('ErrorBoundary', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('tr');
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

    expect(screen.getByRole('alert')).toHaveTextContent('Bir şeyler ters gitti');
    expect(screen.getByRole('alert')).toHaveTextContent('Uygulama beklenmeyen bir hatayla karşılaştı.');
    expect(screen.queryByText('secret implementation detail')).not.toBeInTheDocument();
    const retryButton = screen.getByRole('button', { name: 'Tekrar Dene' });
    expect(retryButton).toHaveAttribute('type', 'button');
    expect(retryButton).toHaveFocus();
  });

  it('focuses the recovery action supplied by a custom fallback and retries after recovery', () => {
    const RecoverableChild = ({ shouldThrow }: { shouldThrow: boolean }) => {
      if (shouldThrow) throw new Error('transient render failure');
      return <p>Recovered child</p>;
    };

    const Harness = () => {
      const [shouldThrow, setShouldThrow] = useState(true);
      return (
        <>
          <button type="button" onClick={() => setShouldThrow(false)}>
            Resolve error
          </button>
          <ErrorBoundary
            fallback={(_error, reset, focusRef) => (
              <div role="alert">
                <p>Custom recovery</p>
                <button ref={focusRef} type="button" onClick={reset}>
                  Retry custom
                </button>
              </div>
            )}
          >
            <RecoverableChild shouldThrow={shouldThrow} />
          </ErrorBoundary>
        </>
      );
    };

    render(<Harness />);

    const retryButton = screen.getByRole('button', { name: 'Retry custom' });
    expect(retryButton).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Resolve error' }));
    fireEvent.click(retryButton);
    expect(screen.getByText('Recovered child')).toBeInTheDocument();
  });

  it('uses the active English language for the default recovery screen', async () => {
    await i18n.changeLanguage('en');

    render(
      <ErrorBoundary>
        <ThrowingChild />
      </ErrorBoundary>
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong');
    expect(screen.getByRole('alert')).toHaveTextContent('The app encountered an unexpected error.');
    expect(screen.getByRole('button', { name: 'Try Again' })).toHaveAttribute('type', 'button');
  });
});
