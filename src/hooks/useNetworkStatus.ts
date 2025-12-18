import { useState, useEffect, useCallback } from 'react';
import { offlineQueue } from '@/lib/offlineQueue';
import { toast } from 'sonner';

interface NetworkStatus {
  isOnline: boolean;
  wasOffline: boolean;
  pendingMutations: number;
  isSyncing: boolean;
}

export function useNetworkStatus() {
  const [status, setStatus] = useState<NetworkStatus>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    wasOffline: false,
    pendingMutations: 0,
    isSyncing: false,
  });

  const updatePendingCount = useCallback(async () => {
    try {
      const count = await offlineQueue.getQueueSize();
      setStatus(prev => ({ ...prev, pendingMutations: count }));
    } catch (error) {
      console.error('[NetworkStatus] Failed to get queue size:', error);
    }
  }, []);

  const syncPendingMutations = useCallback(async () => {
    if (status.isSyncing || !status.isOnline) return;

    const count = await offlineQueue.getQueueSize();
    if (count === 0) return;

    setStatus(prev => ({ ...prev, isSyncing: true }));
    
    try {
      const result = await offlineQueue.syncPendingMutations();
      
      if (result.synced > 0) {
        toast.success(`${result.synced} alterações sincronizadas! ✅`);
      }
      if (result.failed > 0) {
        toast.error(`${result.failed} alterações falharam ao sincronizar`);
      }

      await updatePendingCount();
    } catch (error) {
      console.error('[NetworkStatus] Sync failed:', error);
      toast.error('Erro ao sincronizar alterações offline');
    } finally {
      setStatus(prev => ({ ...prev, isSyncing: false }));
    }
  }, [status.isSyncing, status.isOnline, updatePendingCount]);

  useEffect(() => {
    const handleOnline = () => {
      console.log('[NetworkStatus] Back online');
      setStatus(prev => ({ ...prev, isOnline: true }));
      toast.success('Conexão restaurada! 🌐');
      
      // Auto-sync when back online
      setTimeout(() => {
        syncPendingMutations();
      }, 1000);
    };

    const handleOffline = () => {
      console.log('[NetworkStatus] Went offline');
      setStatus(prev => ({ ...prev, isOnline: false, wasOffline: true }));
      toast.warning('Você está offline. Alterações serão salvas localmente.', {
        duration: 5000,
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial pending count
    updatePendingCount();

    // Check pending mutations periodically
    const interval = setInterval(updatePendingCount, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [syncPendingMutations, updatePendingCount]);

  return {
    ...status,
    syncPendingMutations,
    updatePendingCount,
  };
}
