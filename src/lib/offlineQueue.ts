/**
 * Offline Queue System using IndexedDB
 * Stores mutations when offline and syncs when back online
 */

import { supabase } from "@/integrations/supabase/client";

export interface PendingMutation {
  id: string;
  table: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  data: Record<string, unknown>;
  timestamp: number;
  userId: string;
}

const DB_NAME = 'axiom-offline';
const DB_VERSION = 1;
const STORE_NAME = 'pending-mutations';

class OfflineQueue {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    if (this.db) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('table', 'table', { unique: false });
        }
      };
    });
  }

  async addToQueue(mutation: Omit<PendingMutation, 'id' | 'timestamp'>): Promise<string> {
    await this.init();
    
    const id = crypto.randomUUID();
    const fullMutation: PendingMutation = {
      ...mutation,
      id,
      timestamp: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.add(fullMutation);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        console.log('[OfflineQueue] Added mutation:', fullMutation);
        resolve(id);
      };
    });
  }

  async getPendingMutations(): Promise<PendingMutation[]> {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('timestamp');
      const request = index.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || []);
    });
  }

  async removeMutation(id: string): Promise<void> {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        console.log('[OfflineQueue] Removed mutation:', id);
        resolve();
      };
    });
  }

  async clearQueue(): Promise<void> {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async syncPendingMutations(): Promise<{ synced: number; failed: number }> {
    const mutations = await this.getPendingMutations();
    let synced = 0;
    let failed = 0;

    console.log(`[OfflineQueue] Syncing ${mutations.length} pending mutations...`);

    for (const mutation of mutations) {
      try {
        const { table, operation, data } = mutation;

        switch (operation) {
          case 'INSERT': {
            const { error } = await supabase.from(table as any).insert(data);
            if (error) throw error;
            break;
          }
          case 'UPDATE': {
            const { id, ...updateData } = data;
            const { error } = await supabase.from(table as any).update(updateData).eq('id', id);
            if (error) throw error;
            break;
          }
          case 'DELETE': {
            const { error } = await supabase.from(table as any).delete().eq('id', data.id);
            if (error) throw error;
            break;
          }
        }

        await this.removeMutation(mutation.id);
        synced++;
      } catch (error) {
        console.error('[OfflineQueue] Failed to sync mutation:', mutation, error);
        failed++;
      }
    }

    console.log(`[OfflineQueue] Sync complete: ${synced} synced, ${failed} failed`);
    return { synced, failed };
  }

  async getQueueSize(): Promise<number> {
    const mutations = await this.getPendingMutations();
    return mutations.length;
  }
}

export const offlineQueue = new OfflineQueue();

/**
 * Helper function to perform a mutation with offline support
 */
export async function mutateWithOfflineSupport<T extends Record<string, unknown>>(
  table: string,
  operation: 'INSERT' | 'UPDATE' | 'DELETE',
  data: T,
  userId: string,
  isOnline: boolean
): Promise<{ success: boolean; offline: boolean; error?: Error }> {
  if (isOnline) {
    try {
      switch (operation) {
        case 'INSERT': {
          const { error } = await supabase.from(table as any).insert(data);
          if (error) throw error;
          break;
        }
        case 'UPDATE': {
          const { id, ...updateData } = data;
          const { error } = await supabase.from(table as any).update(updateData).eq('id', id);
          if (error) throw error;
          break;
        }
        case 'DELETE': {
          const { error } = await supabase.from(table as any).delete().eq('id', data.id);
          if (error) throw error;
          break;
        }
      }
      return { success: true, offline: false };
    } catch (error) {
      return { success: false, offline: false, error: error as Error };
    }
  } else {
    // Offline: add to queue
    try {
      await offlineQueue.addToQueue({ table, operation, data, userId });
      return { success: true, offline: true };
    } catch (error) {
      return { success: false, offline: true, error: error as Error };
    }
  }
}
