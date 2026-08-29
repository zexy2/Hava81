import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { SettingsPanel } from '../../components/SettingsPanel';
import { SettingsProvider } from '../../context';
import i18n from '../../i18n';

describe('SettingsPanel language persistence', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('tr');
  });

  it('persists language in user settings without rewriting the legacy language key', async () => {
    const user = userEvent.setup();
    render(
      <SettingsProvider>
        <SettingsPanel isOpen onClose={() => undefined} />
      </SettingsProvider>
    );

    await user.click(screen.getByRole('button', { name: /english/i }));

    await waitFor(() => expect(i18n.language).toBe('en'));
    expect(JSON.parse(localStorage.getItem('user-settings') ?? '{}')).toMatchObject({ language: 'en' });
    expect(localStorage.getItem('app-language')).toBeNull();
  });
});
