import { useEffect, useCallback, useRef } from 'react';

interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  action: () => void;
  description: string;
}

interface UseKeyboardShortcutsOptions {
  enabled?: boolean;
}

/**
 * Hook for managing keyboard shortcuts
 * Supports Cmd/Ctrl modifiers for cross-platform compatibility
 */
export function useKeyboardShortcuts(
  shortcuts: KeyboardShortcut[],
  options: UseKeyboardShortcutsOptions = {}
) {
  const { enabled = true } = options;
  const shortcutsRef = useRef(shortcuts);

  // Keep shortcuts ref updated
  useEffect(() => {
    shortcutsRef.current = shortcuts;
  }, [shortcuts]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Don't steal keystrokes from editable form controls. Selects are included because
      // arrow/modifier keys belong to the native picker while it has focus.
      const target = event.target as HTMLElement;
      const isEditableTarget =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable;
      if (isEditableTarget) {
        // Escape remains a global close affordance even from editable controls.
        if (event.key !== 'Escape') {
          return;
        }
      }

      for (const shortcut of shortcutsRef.current) {
        const ctrlOrMeta = shortcut.ctrlKey || shortcut.metaKey;
        const eventCtrlOrMeta = event.ctrlKey || event.metaKey;

        const keyMatches = event.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatches = ctrlOrMeta ? eventCtrlOrMeta : !eventCtrlOrMeta;
        const shiftMatches = shortcut.shiftKey ? event.shiftKey : !event.shiftKey;
        const altMatches = shortcut.altKey ? event.altKey : !event.altKey;

        if (keyMatches && ctrlMatches && shiftMatches && altMatches) {
          event.preventDefault();
          shortcut.action();
          return;
        }
      }
    },
    [enabled]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Return formatted shortcut strings for display
  const getShortcutDisplay = useCallback((shortcut: KeyboardShortcut): string => {
    const parts: string[] = [];
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

    if (shortcut.ctrlKey || shortcut.metaKey) {
      parts.push(isMac ? '⌘' : 'Ctrl');
    }
    if (shortcut.shiftKey) {
      parts.push(isMac ? '⇧' : 'Shift');
    }
    if (shortcut.altKey) {
      parts.push(isMac ? '⌥' : 'Alt');
    }

    const specialKeys: Record<string, string> = {
      escape: 'Esc',
      arrowup: '↑',
      arrowdown: '↓',
      arrowleft: '←',
      arrowright: '→',
      enter: '↵',
    };
    const keyDisplay = specialKeys[shortcut.key.toLowerCase()] ?? shortcut.key.toUpperCase();

    parts.push(keyDisplay);
    return parts.join(isMac ? '' : '+');
  }, []);

  return {
    shortcuts,
    getShortcutDisplay,
  };
}

// Pre-defined common shortcuts
export const createAppShortcuts = (actions: {
  openSearch?: () => void;
  openSettings?: () => void;
  closeModal?: () => void;
  refreshData?: () => void;
  toggleFavorite?: () => void;
  navigateNext?: () => void;
  navigatePrev?: () => void;
}): KeyboardShortcut[] => {
  const shortcuts: KeyboardShortcut[] = [];

  if (actions.openSearch) {
    shortcuts.push({
      key: 'k',
      ctrlKey: true,
      action: actions.openSearch,
      description: 'Arama aç',
    });
  }

  if (actions.openSettings) {
    shortcuts.push({
      key: ',',
      ctrlKey: true,
      action: actions.openSettings,
      description: 'Ayarları aç',
    });
  }

  if (actions.closeModal) {
    shortcuts.push({
      key: 'Escape',
      action: actions.closeModal,
      description: 'Kapat',
    });
  }

  if (actions.refreshData) {
    shortcuts.push({
      key: 'r',
      ctrlKey: true,
      shiftKey: true,
      action: actions.refreshData,
      description: 'Verileri yenile',
    });
  }

  if (actions.toggleFavorite) {
    shortcuts.push({
      key: 'd',
      ctrlKey: true,
      action: actions.toggleFavorite,
      description: 'Favorilere ekle/çıkar',
    });
  }

  if (actions.navigateNext) {
    shortcuts.push({
      key: 'ArrowRight',
      action: actions.navigateNext,
      description: 'Sonraki',
    });
  }

  if (actions.navigatePrev) {
    shortcuts.push({
      key: 'ArrowLeft',
      action: actions.navigatePrev,
      description: 'Önceki',
    });
  }

  return shortcuts;
};

export default useKeyboardShortcuts;
