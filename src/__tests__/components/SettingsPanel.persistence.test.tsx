import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import packageMeta from '../../../package.json';
import { SettingsPanel } from '../../components/SettingsPanel';
import { SettingsProvider } from '../../context';
import i18n from '../../i18n';

describe('SettingsPanel persistence and release metadata', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('tr');
  });

  it('renders the package version instead of a duplicated release literal', () => {
    render(
      <SettingsProvider>
        <SettingsPanel isOpen onClose={() => undefined} />
      </SettingsProvider>
    );

    expect(screen.getByText(`v${packageMeta.version}`)).toBeInTheDocument();
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
