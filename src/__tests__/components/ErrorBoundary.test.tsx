import { render, screen } from '@testing-library/react';
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
