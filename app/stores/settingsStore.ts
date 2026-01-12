import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ApiKeys, ModelCapabilities, Provider, StoredModel } from '~/types';

// Default models that come pre-populated
const DEFAULT_MODELS: StoredModel[] = [
  // Google models (hardcoded capabilities)
  {
    id: 'gemini-2.5-flash-image',
    name: 'Gemini 2.5 Flash',
    provider: 'google',
    enabled: true,
    capabilities: {
      supportsAspectRatios: true,
      supportsResolution: false,
      supportsReferenceImages: true,
      maxReferenceImages: 10,
    },
  },
  {
    id: 'gemini-3-pro-image-preview',
    name: 'Gemini 3.0 Pro',
    provider: 'google',
    enabled: true,
    capabilities: {
      supportsAspectRatios: true,
      supportsResolution: true,
      supportsReferenceImages: true,
      maxReferenceImages: 10,
    },
  },
  // Replicate models (removable like custom models)
  {
    id: 'replicate/google/nano-banana',
    name: 'Nano Banana',
    provider: 'replicate',
    enabled: true,
    isCustom: true,
    capabilities: {
      supportsAspectRatios: true,
      supportsResolution: false,
      supportsReferenceImages: true,
      maxReferenceImages: 10,
    },
  },
  {
    id: 'replicate/google/nano-banana-pro',
    name: 'Nano Banana Pro',
    provider: 'replicate',
    enabled: true,
    isCustom: true,
    capabilities: {
      supportsAspectRatios: true,
      supportsResolution: true,
      supportsReferenceImages: true,
      maxReferenceImages: 14,
    },
  },
  {
    id: 'replicate/openai/gpt-image-1.5',
    name: 'GPT Image 1.5',
    provider: 'replicate',
    enabled: true,
    isCustom: true,
    capabilities: {
      supportsAspectRatios: true,
      supportsResolution: false,
      supportsReferenceImages: true,
      maxReferenceImages: 1,
    },
  },
  {
    id: 'replicate/black-forest-labs/flux-2-flex',
    name: 'Flux 2 Flex',
    provider: 'replicate',
    enabled: true,
    isCustom: true,
    capabilities: {
      supportsAspectRatios: true,
      supportsResolution: false,
      supportsReferenceImages: true,
      maxReferenceImages: 1,
    },
  },
  {
    id: 'replicate/bytedance/seedream-4.5',
    name: 'SeeDream 4.5',
    provider: 'replicate',
    enabled: true,
    isCustom: true,
    capabilities: {
      supportsAspectRatios: true,
      supportsResolution: false,
      supportsReferenceImages: false,
      maxReferenceImages: 0,
    },
  },
];

interface SettingsState {
  apiKeys: ApiKeys;
  models: StoredModel[];
  settingsModalOpen: boolean;

  // API key actions
  setApiKey: (provider: Provider, key: string | null) => void;
  clearApiKey: (provider: Provider) => void;

  // Model actions
  setModelEnabled: (id: string, enabled: boolean) => void;
  addCustomModel: (id: string, name: string, capabilities: ModelCapabilities) => void;
  removeCustomModel: (id: string) => void;
  updateModelCapabilities: (id: string, capabilities: ModelCapabilities, schemaFetched?: boolean) => void;

  // Modal actions
  openSettingsModal: () => void;
  closeSettingsModal: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      apiKeys: {
        google: null,
        replicate: null,
      },
      models: DEFAULT_MODELS,
      settingsModalOpen: false,

      setApiKey: (provider, key) =>
        set((state) => ({
          apiKeys: { ...state.apiKeys, [provider]: key },
        })),

      clearApiKey: (provider) =>
        set((state) => ({
          apiKeys: { ...state.apiKeys, [provider]: null },
        })),

      setModelEnabled: (id, enabled) =>
        set((state) => ({
          models: state.models.map((m) =>
            m.id === id ? { ...m, enabled } : m
          ),
        })),

      addCustomModel: (id, name, capabilities) =>
        set((state) => ({
          models: [
            ...state.models,
            {
              id: `replicate/${id}`,
              name,
              provider: 'replicate' as const,
              enabled: true,
              isCustom: true,
              schemaFetched: true,
              capabilities,
            },
          ],
        })),

      removeCustomModel: (id) =>
        set((state) => ({
          models: state.models.filter((m) => m.id !== id),
        })),

      updateModelCapabilities: (id, capabilities, schemaFetched) =>
        set((state) => ({
          models: state.models.map((m) =>
            m.id === id ? { ...m, capabilities, ...(schemaFetched !== undefined && { schemaFetched }) } : m
          ),
        })),

      openSettingsModal: () => set({ settingsModalOpen: true }),
      closeSettingsModal: () => set({ settingsModalOpen: false }),
    }),
    {
      name: 'studio-settings',
      version: 2, // Bump version for migration
      partialize: (state) => ({
        apiKeys: state.apiKeys,
        models: state.models,
      }),
      migrate: (persisted, version) => {
        if (version < 2) {
          // Migration from v1: add models array
          const state = persisted as { apiKeys?: ApiKeys };
          return {
            apiKeys: {
              google: state.apiKeys?.google ?? null,
              replicate: state.apiKeys?.replicate ?? null,
            },
            models: DEFAULT_MODELS,
          };
        }
        return persisted;
      },
    }
  )
);

// Helper to get enabled models that have API keys
export function getEnabledModels(state: SettingsState): StoredModel[] {
  return state.models.filter(
    (m) => m.enabled && state.apiKeys[m.provider]
  );
}
