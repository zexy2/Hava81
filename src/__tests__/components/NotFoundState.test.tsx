import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../i18n';
import { NotFoundState } from '../../components/app/NotFoundState';

describe('NotFoundState (Faz 4 404)', () => {
  afterEach(async () => {
    document.querySelector('meta[name="robots"]')?.remove();
    await i18n.changeLanguage('tr');
  });

  it('explains that no province lives at the address and links the closest provinces', async () => {
    await i18n.changeLanguage('tr');
    const onSearch = vi.fn();
    render(<NotFoundState pathname="/istanbl/" language="tr" onSearch={onSearch} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Bu adreste bir il yok' })).toBeVisible();
    expect(screen.getByText(/“\/istanbl\/” adresi/)).toBeVisible();
    const suggestions = screen.getByRole('navigation', { name: 'Şunu mu arıyordun?' });
    const first = within(suggestions).getAllByRole('link')[0];
    expect(first).toHaveTextContent('İstanbul');
    expect(first).toHaveAttribute('href', '/istanbul/');
    expect(screen.getByRole('link', { name: 'Ana sayfaya dön' })).toHaveAttribute('href', '/');

    fireEvent.click(screen.getByRole('button', { name: 'İl ara' }));
    expect(onSearch).toHaveBeenCalled();
    expect(document.title).toBe('Sayfa bulunamadı — Hava81');
    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
  });

  it('keeps English visitors in the English edition', async () => {
    await i18n.changeLanguage('en');
    render(<NotFoundState pathname="/en/ankra/" language="en" onSearch={() => {}} />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'There is no province at this address' })
    ).toBeVisible();
    expect(screen.getByRole('link', { name: 'Ankara' })).toHaveAttribute('href', '/en/ankara/');
    expect(screen.getByRole('link', { name: 'Go to the home page' })).toHaveAttribute(
      'href',
      '/en/'
    );
  });
});
