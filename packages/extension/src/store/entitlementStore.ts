import { create } from 'zustand';
import type { Entitlement } from '@fanout/shared';
import { sendToWorker } from '../messaging/channel';

/**
 * UI-side cache of the current plan entitlement (TICKET-035). The worker owns the
 * source of truth; surfaces load it once and read capabilities to gate features.
 * While unloaded, callers default to "allow" so a slow worker never blocks the UI.
 */
interface EntitlementStore {
  entitlement: Entitlement | null;
  load: () => Promise<void>;
}

export const useEntitlementStore = create<EntitlementStore>((set) => ({
  entitlement: null,
  load: async () => {
    try {
      set({ entitlement: await sendToWorker({ type: 'DATA_GET_ENTITLEMENT' }) });
    } catch {
      /* worker unreachable — leave null; gates default to allow */
    }
  },
}));
