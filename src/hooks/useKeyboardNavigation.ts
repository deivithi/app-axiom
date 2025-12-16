import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  action: () => void;
  description: string;
}

export function useKeyboardNavigation() {
  const navigate = useNavigate();

  const shortcuts: KeyboardShortcut[] = [
    { key: 'k', ctrl: true, action: () => navigate('/'), description: 'Ir para Chat' },
    { key: '1', alt: true, action: () => navigate('/intelligence'), description: 'Motor de Inteligência' },
    { key: '2', alt: true, action: () => navigate('/execution'), description: 'Sistema de Execução' },
    { key: '3', alt: true, action: () => navigate('/habits'), description: 'Hábitos' },
    { key: '4', alt: true, action: () => navigate('/finances'), description: 'Finanças' },
    { key: '5', alt: true, action: () => navigate('/memory'), description: 'Segunda Memória' },
    { key: 's', alt: true, action: () => navigate('/settings'), description: 'Configurações' },
  ];

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Ignorar se estiver digitando em input/textarea
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      // Mas permitir Ctrl+K mesmo em inputs
      if (!(event.ctrlKey && event.key === 'k')) {
        return;
      }
    }

    for (const shortcut of shortcuts) {
      const ctrlMatch = shortcut.ctrl ? (event.ctrlKey || event.metaKey) : !event.ctrlKey && !event.metaKey;
      const altMatch = shortcut.alt ? event.altKey : !event.altKey;
      const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
      
      if (
        event.key.toLowerCase() === shortcut.key.toLowerCase() &&
        ctrlMatch &&
        altMatch &&
        shiftMatch
      ) {
        event.preventDefault();
        shortcut.action();
        return;
      }
    }
  }, [navigate]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return { shortcuts };
}

// Hook para mostrar indicador de shortcuts
export function useShortcutIndicator() {
  const { shortcuts } = useKeyboardNavigation();
  
  return shortcuts.map(s => ({
    keys: [
      s.ctrl ? '⌘' : '',
      s.alt ? '⌥' : '',
      s.shift ? '⇧' : '',
      s.key.toUpperCase()
    ].filter(Boolean).join('+'),
    description: s.description
  }));
}
