/**
 * Offline Sync Layer for Prescripto
 * Provides local caching of patient visits and drafts during network outages,
 * and automatically attempts synchronization when internet connection is restored.
 */

import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface OfflineVisitAction {
  id: string;
  type: 'save_prescription' | 'create_visit' | 'update_vitals';
  payload: any;
  timestamp: number;
  clinicId: string;
}

const STORAGE_KEY = 'prescripto_offline_queue_v1';

export const OfflineSync = {
  getQueue(): OfflineVisitAction[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  enqueue(action: Omit<OfflineVisitAction, 'id' | 'timestamp'>) {
    const queue = this.getQueue();
    const newAction: OfflineVisitAction = {
      ...action,
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now()
    };
    queue.push(newAction);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    } catch (e) {
      console.warn('[OfflineSync] Failed to save offline action to localStorage:', e);
    }
    return newAction;
  },

  remove(actionId: string) {
    const queue = this.getQueue().filter(item => item.id !== actionId);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    } catch (e) {
      console.warn('[OfflineSync] Failed to update offline queue in localStorage:', e);
    }
  },

  clear() {
    localStorage.removeItem(STORAGE_KEY);
  },

  async syncAllPending(): Promise<{ synced: number; failed: number }> {
    const queue = this.getQueue();
    if (queue.length === 0) return { synced: 0, failed: 0 };

    let synced = 0;
    let failed = 0;

    for (const item of queue) {
      try {
        if (item.type === 'update_vitals') {
          const { error } = await supabase
            .from('visits')
            .update(item.payload.updates)
            .eq('id', item.payload.visitId);

          if (error) throw error;
          this.remove(item.id);
          synced++;
        } else if (item.type === 'save_prescription') {
          const { error: visitErr } = await supabase
            .from('visits')
            .update(item.payload.visitUpdates)
            .eq('id', item.payload.visitId);

          if (visitErr) throw visitErr;

          if (item.payload.prescriptionData) {
            const { error: rxErr } = await supabase
              .from('prescriptions')
              .upsert(item.payload.prescriptionData);

            if (rxErr) throw rxErr;
          }

          this.remove(item.id);
          synced++;
        }
      } catch (err) {
        console.warn(`[OfflineSync] Sync failed for action ${item.id}:`, err);
        failed++;
      }
    }

    if (synced > 0) {
      toast.success(`Synced ${synced} offline update(s) to cloud!`);
    }

    return { synced, failed };
  }
};

// Global network online listener
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[OfflineSync] Network reconnected. Flusing offline queue...');
    OfflineSync.syncAllPending();
  });
}
