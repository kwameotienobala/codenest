'use client';

import { useEffect, useCallback } from 'react';

interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  callback: () => void;
}

export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    for (const shortcut of shortcuts) {
      const ctrlMatch = shortcut.ctrl ? event.ctrlKey : !event.ctrlKey;
      const metaMatch = shortcut.meta ? event.metaKey : !event.metaKey;
      const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
      const altMatch = shortcut.alt ? event.altKey : !event.altKey;
      
      // Handle Cmd on Mac and Ctrl on Windows/Linux
      const cmdCtrlMatch = shortcut.ctrl || shortcut.meta 
        ? (event.ctrlKey || event.metaKey) 
        : !(event.ctrlKey || event.metaKey);

      if (
        event.key.toLowerCase() === shortcut.key.toLowerCase() &&
        cmdCtrlMatch &&
        shiftMatch &&
        altMatch &&
        !event.repeat
      ) {
        event.preventDefault();
        event.stopPropagation();
        shortcut.callback();
        break;
      }
    }
  }, [shortcuts]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);
}