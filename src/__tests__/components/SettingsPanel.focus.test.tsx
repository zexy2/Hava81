import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsPanel } from '../../components/SettingsPanel';
import { SettingsProvider } from '../../context';
import i18n from '../../i18n';

describe('SettingsPanel focus containment', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('tr');
  });

  it('returns forward Tab to the first control if focus is moved outside the open modal', async () => {
    render(
      <SettingsProvider>
        <div className="app">
          <button type="button">Outside control</button>
          <SettingsPanel isOpen onClose={vi.fn()} />
        </div>
      </SettingsProvider>
    );

    const closeButton = screen.getByRole('button', { name: /kapat/i });
    await waitFor(() => expect(closeButton).toHaveFocus());

    const outsideButton = screen.getByRole('button', { name: 'Outside control' });
    outsideButton.focus();
    expect(outsideButton).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Tab' });

    expect(closeButton).toHaveFocus();
  });
});
