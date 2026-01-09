import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ApiKeys, Provider } from '~/types';

interface SettingsState {
  apiKeys: ApiKeys;
  settingsModalOpen: boolean;
  setApiKey: (provider: Provider, key: string | null) => void;
  clearApiKey: (provider: Provider) => void;
  openSettingsModal: () => void;
  closeSettingsModal: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      apiKeys: {
        google: null,
        openai: null,
        replicate: null,
      },
      settingsModalOpen: false,

      setApiKey: (provider, key) =>
        set((state) => ({
          apiKeys: { ...state.apiKeys, [provider]: key },
        })),

      clearApiKey: (provider) =>
        set((state) => ({
          apiKeys: { ...state.apiKeys, [provider]: null },
        })),

      openSettingsModal: () => set({ settingsModalOpen: true }),
      closeSettingsModal: () => set({ settingsModalOpen: false }),
    }),
    {
      name: 'studio-settings',
      partialize: (state) => ({ apiKeys: state.apiKeys }),
    }
  )
);
