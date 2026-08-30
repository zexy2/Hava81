import { fireEvent, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';

describe('useKeyboardShortcuts', () => {
  it('does not steal matching shortcuts from a focused select control', () => {
    const action = vi.fn();
    renderHook(() =>
      useKeyboardShortcuts([
        { key: 'ArrowRight', action, description: 'Next' },
      ])
    );

    const select = document.createElement('select');
    select.innerHTML = '<option>One</option><option>Two</option>';
    document.body.append(select);
    select.focus();

    fireEvent.keyDown(select, { key: 'ArrowRight' });

    expect(action).not.toHaveBeenCalled();
    select.remove();
  });

  it('still allows Escape shortcuts from a focused select control', () => {
    const action = vi.fn();
    renderHook(() =>
      useKeyboardShortcuts([{ key: 'Escape', action, description: 'Close' }])
    );

    const select = document.createElement('select');
    document.body.append(select);
    select.focus();

    fireEvent.keyDown(select, { key: 'Escape' });

    expect(action).toHaveBeenCalledTimes(1);
    select.remove();
  });
});
