import { create } from 'zustand';
import type { ProgressSnapshot } from '../messaging/channel';
import { sendToWorker, onBroadcast } from '../messaging/channel';

interface SendStatusStore {
  progress: ProgressSnapshot | null;
  campaignId: string | null;
  attach: (campaignId: string) => Promise<void>;
  detach: () => void;
  refresh: () => Promise<void>;
  start: () => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  cancel: () => Promise<void>;
  retryFailed: () => Promise<number>;
}

let unsubscribe: (() => void) | null = null;
let poll: ReturnType<typeof setInterval> | null = null;

export const useSendStatusStore = create<SendStatusStore>((set, get) => ({
  progress: null,
  campaignId: null,

  attach: async (campaignId) => {
    get().detach();
    set({ campaignId });
    unsubscribe = onBroadcast((e) => {
      if (e.type === 'PROGRESS' && e.snapshot.campaignId === campaignId) {
        set({ progress: e.snapshot });
      }
    });
    // Poll as a fallback in case a broadcast is missed while the panel is open.
    poll = setInterval(() => void get().refresh(), 1500);
    await get().refresh();
  },

  detach: () => {
    unsubscribe?.();
    unsubscribe = null;
    if (poll) clearInterval(poll);
    poll = null;
  },

  refresh: async () => {
    const { campaignId } = get();
    if (!campaignId) return;
    const snapshot = await sendToWorker({ type: 'SEND_GET_PROGRESS', campaignId });
    if (snapshot) set({ progress: snapshot });
  },

  start: async () => {
    const { campaignId } = get();
    if (!campaignId) return;
    await sendToWorker({ type: 'SEND_START', campaignId });
    await get().refresh();
  },

  pause: async () => {
    const { campaignId } = get();
    if (!campaignId) return;
    await sendToWorker({ type: 'SEND_PAUSE', campaignId });
    await get().refresh();
  },

  resume: async () => {
    const { campaignId } = get();
    if (!campaignId) return;
    await sendToWorker({ type: 'SEND_RESUME', campaignId });
    await get().refresh();
  },

  cancel: async () => {
    const { campaignId } = get();
    if (!campaignId) return;
    await sendToWorker({ type: 'SEND_CANCEL', campaignId });
    await get().refresh();
  },

  retryFailed: async () => {
    const { campaignId } = get();
    if (!campaignId) return 0;
    const { requeued } = await sendToWorker({ type: 'SEND_RETRY_FAILED', campaignId });
    await get().refresh();
    return requeued;
  },
}));
