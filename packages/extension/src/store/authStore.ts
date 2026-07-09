import { create } from 'zustand';
import type { AuthState } from '@fanout/shared';
import { sendToWorker, onBroadcast } from '../messaging/channel';

interface AuthStore extends AuthState {
  hydrate: () => Promise<void>;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set) => ({
  status: 'disconnected',
  identity: null,
  error: null,

  hydrate: async () => {
    try {
      const state = await sendToWorker({ type: 'AUTH_GET_STATE' });
      set(state);
    } catch (e) {
      set({ status: 'error', identity: null, error: e instanceof Error ? e.message : 'error' });
    }
  },

  connect: async () => {
    set({ status: 'connecting', error: null });
    try {
      const { identity } = await sendToWorker({ type: 'AUTH_CONNECT' });
      set({ status: 'connected', identity, error: null });
    } catch (e) {
      set({ status: 'error', identity: null, error: e instanceof Error ? e.message : 'Sign-in failed' });
    }
  },

  disconnect: async () => {
    await sendToWorker({ type: 'AUTH_DISCONNECT' });
    set({ status: 'disconnected', identity: null, error: null });
  },
}));

// Keep the store in sync with worker-side auth changes.
onBroadcast((e) => {
  if (e.type === 'AUTH_CHANGED') useAuthStore.setState(e.state);
});
