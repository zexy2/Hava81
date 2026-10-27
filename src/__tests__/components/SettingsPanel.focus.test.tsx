import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsPanel } from '../../components/SettingsPanel';
import { SettingsProvider } from '../../context';
import i18n from '../../i18n';

describe('SettingsPanel focus containment', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('tr');
  });

  it('wraps Tab and Shift+Tab at both ends of the dialog', async () => {
    render(
      <SettingsProvider>
        <div className="app">
          <button type="button">Outside control</button>
          <SettingsPanel isOpen onClose={vi.fn()} />
        </div>
      </SettingsProvider>
    );

    const dialog = screen.getByRole('dialog', { name: /ayarlar/i });
    const closeButton = screen.getByRole('button', { name: /kapat/i });
    const lastOption = screen.getByRole('button', { name: /koyu/i });
    await waitFor(() => expect(closeButton).toHaveFocus());

    lastOption.focus();
    fireEvent.keyDown(lastOption, { key: 'Tab' });
    expect(closeButton).toHaveFocus();

    closeButton.focus();
    fireEvent.keyDown(closeButton, { key: 'Tab', shiftKey: true });
    expect(lastOption).toHaveFocus();
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('closes on Escape, restores opener focus, and releases the background inert state', async () => {
    const user = userEvent.setup();
    const Harness = () => {
      const [isOpen, setIsOpen] = useState(false);
      return (
        <div className="app">
          <button type="button" onClick={() => setIsOpen(true)}>
            Open settings
          </button>
          <SettingsPanel isOpen={isOpen} onClose={() => setIsOpen(false)} />
        </div>
      );
    };

    render(
      <SettingsProvider>
        <Harness />
      </SettingsProvider>
    );

    const opener = screen.getByRole('button', { name: 'Open settings' });
    await user.click(opener);
    const dialog = await screen.findByRole('dialog', { name: /ayarlar/i });
    const closeButton = screen.getByRole('button', { name: /kapat/i });

    await waitFor(() => expect(closeButton).toHaveFocus());
    expect(opener).toHaveAttribute('inert');

    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(opener).toHaveFocus();
    expect(opener).not.toHaveAttribute('inert');
    expect(dialog).not.toBeInTheDocument();
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

    const dialog = screen.getByRole('dialog', { name: /ayarlar/i });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument();

    const closeButton = screen.getByRole('button', { name: /kapat/i });
    await waitFor(() => expect(closeButton).toHaveFocus());

    const outsideButton = screen.getByRole('button', { name: 'Outside control' });
    outsideButton.focus();
    expect(outsideButton).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Tab' });

    expect(closeButton).toHaveFocus();
  });
});
