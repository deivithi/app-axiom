import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

export interface UIAction {
  id: string;
  type: string;
  module: string;
  message: string;
  timestamp: Date;
}

interface AxiomSyncContextType {
  // Notify chat about UI action
  notifyAction: (type: string, module: string, message: string) => void;
  // Get latest actions for chat display
  latestActions: UIAction[];
  // Subscribe to new actions
  subscribeToActions: (callback: (action: UIAction) => void) => () => void;
  // Clear actions after displaying
  clearActions: () => void;
  // Last action source tracking
  lastActionSource: 'chat' | 'ui' | null;
  setLastActionSource: (source: 'chat' | 'ui' | null) => void;
}

const AxiomSyncContext = createContext<AxiomSyncContextType | undefined>(undefined);

export function AxiomSyncProvider({ children }: { children: React.ReactNode }) {
  const [latestActions, setLatestActions] = useState<UIAction[]>([]);
  const [lastActionSource, setLastActionSource] = useState<'chat' | 'ui' | null>(null);
  const subscribersRef = useRef<Set<(action: UIAction) => void>>(new Set());

  const notifyAction = useCallback((type: string, module: string, message: string) => {
    const action: UIAction = {
      id: crypto.randomUUID(),
      type,
      module,
      message,
      timestamp: new Date(),
    };

    setLatestActions(prev => [...prev.slice(-9), action]); // Keep last 10 actions
    setLastActionSource('ui');

    // Notify all subscribers
    subscribersRef.current.forEach(callback => callback(action));
  }, []);

  const subscribeToActions = useCallback((callback: (action: UIAction) => void) => {
    subscribersRef.current.add(callback);
    return () => {
      subscribersRef.current.delete(callback);
    };
  }, []);

  const clearActions = useCallback(() => {
    setLatestActions([]);
  }, []);

  return (
    <AxiomSyncContext.Provider
      value={{
        notifyAction,
        latestActions,
        subscribeToActions,
        clearActions,
        lastActionSource,
        setLastActionSource,
      }}
    >
      {children}
    </AxiomSyncContext.Provider>
  );
}

export function useAxiomSync() {
  const context = useContext(AxiomSyncContext);
  if (!context) {
    throw new Error('useAxiomSync must be used within AxiomSyncProvider');
  }
  return context;
}
