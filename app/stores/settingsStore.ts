import { create } from "zustand";
import { persist } from "zustand/middleware";
import { BUILT_IN_MODELS, isBuiltInModel, mergeWithBuiltInModels } from "~/lib/builtInModels";
import type {
  ApiKeys,
  ModelCapabilities,
  Provider,
  SchemaMapping,
  StoredModel,
  TextModelConfig,
} from "~/types";

interface SettingsState {
  apiKeys: ApiKeys;
  models: StoredModel[];
  textModel: TextModelConfig;
  desktopNotificationsEnabled: boolean;
  notificationPromptDismissed: boolean;
  requestedOutputCount: number;

  // API key actions
  setApiKey: (provider: Provider, key: string | null) => void;
  clearApiKey: (provider: Provider) => void;

  // Model actions
  setModelEnabled: (id: string, enabled: boolean) => void;
  addCustomModel: (
    id: string,
    name: string,
    capabilities: ModelCapabilities,
    schemaMapping?: SchemaMapping,
    icon?: string
  ) => void;
  removeCustomModel: (id: string) => void;
  updateModelCapabilities: (
    id: string,
    capabilities: ModelCapabilities,
    schemaFetched?: boolean
  ) => void;

  // Text model actions
  setTextModel: (config: TextModelConfig) => void;

  // Notification actions
  setDesktopNotificationsEnabled: (enabled: boolean) => void;
  dismissNotificationPrompt: () => void;
  incrementRequestedOutputCount: (count?: number) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      apiKeys: {
        google: null,
        replicate: null,
      },
      models: BUILT_IN_MODELS,
      textModel: { provider: "google", modelId: "gemini-3-flash-preview" },
      desktopNotificationsEnabled: false,
      notificationPromptDismissed: false,
      requestedOutputCount: 0,

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
          models: state.models.map((m) => (m.id === id ? { ...m, enabled } : m)),
        })),

      addCustomModel: (id, name, capabilities, schemaMapping, icon) =>
        set((state) => ({
          models: [
            ...state.models,
            {
              id: `replicate/${id}`,
              name,
              provider: "replicate" as const,
              enabled: true,
              isCustom: true,
              schemaFetched: true,
              capabilities,
              ...(schemaMapping && { schemaMapping }),
              ...(icon && { icon }),
            },
          ],
        })),

      removeCustomModel: (id) =>
        set((state) => ({
          models: state.models.some((m) => m.id === id && m.isCustom)
            ? state.models.filter((m) => m.id !== id)
            : state.models,
        })),

      updateModelCapabilities: (id, capabilities, schemaFetched) =>
        set((state) => ({
          models: state.models.map((m) =>
            m.id === id
              ? { ...m, capabilities, ...(schemaFetched !== undefined && { schemaFetched }) }
              : m
          ),
        })),

      setTextModel: (config) => set({ textModel: config }),

      setDesktopNotificationsEnabled: (enabled) => set({ desktopNotificationsEnabled: enabled }),

      dismissNotificationPrompt: () => set({ notificationPromptDismissed: true }),

      incrementRequestedOutputCount: (count = 1) =>
        set((state) => ({
          requestedOutputCount: state.requestedOutputCount + Math.max(0, count),
        })),
    }),
    {
      name: "studio-settings",
      version: 6,
      partialize: (state) => ({
        apiKeys: state.apiKeys,
        models: state.models,
        textModel: state.textModel,
        desktopNotificationsEnabled: state.desktopNotificationsEnabled,
        notificationPromptDismissed: state.notificationPromptDismissed,
        requestedOutputCount: state.requestedOutputCount,
      }),
      migrate: (persisted, version) => {
        let state = persisted as {
          apiKeys?: ApiKeys;
          models?: StoredModel[];
          textModel?: TextModelConfig;
          desktopNotificationsEnabled?: boolean;
          notificationPromptDismissed?: boolean;
          requestedOutputCount?: number;
        };

        if (version < 2) {
          // Migration from v1: add models array
          state = {
            apiKeys: {
              google: state.apiKeys?.google ?? null,
              replicate: state.apiKeys?.replicate ?? null,
            },
            models: BUILT_IN_MODELS,
          };
        }

        if (version < 3) {
          // Migration from v2: add icons to built-in models
          const iconMap: Record<string, string> = {
            "gemini-2.5-flash-image": "/icons/google.svg",
            "gemini-3-pro-image-preview": "/icons/google.svg",
            "gemini-3.1-flash-image-preview": "/icons/google.svg",
            "replicate/google/nano-banana": "/icons/google.svg",
            "replicate/google/nano-banana-pro": "/icons/google.svg",
            "replicate/openai/gpt-image-1.5": "/icons/openai.svg",
            "replicate/black-forest-labs/flux-2-flex": "/icons/bfl.svg",
            "replicate/bytedance/seedream-4.5": "/icons/bytedance.svg",
          };

          state = {
            ...state,
            models: state.models?.map((m) => ({
              ...m,
              icon: m.icon ?? iconMap[m.id],
            })),
          };
        }

        if (version < 4) {
          state = {
            ...state,
            models: mergeWithBuiltInModels(state.models),
          };
        }

        if (version >= 4) {
          state = {
            ...state,
            models: mergeWithBuiltInModels(state.models),
          };
        }

        if (version < 5) {
          state = {
            ...state,
            desktopNotificationsEnabled: false,
            notificationPromptDismissed: false,
            requestedOutputCount: 0,
          };
        }

        if (version < 6) {
          state = {
            ...state,
            textModel: { provider: "google", modelId: "gemini-3-flash-preview" },
          };
        }

        state = {
          ...state,
          models: state.models?.map((model) =>
            isBuiltInModel(model.id) ? { ...model, isCustom: undefined } : model
          ),
          desktopNotificationsEnabled: state.desktopNotificationsEnabled ?? false,
          notificationPromptDismissed: state.notificationPromptDismissed ?? false,
          requestedOutputCount: state.requestedOutputCount ?? 0,
        };

        return state;
      },
    }
  )
);

// Helper to get enabled models that have API keys
export function getEnabledModels(state: SettingsState): StoredModel[] {
  return state.models.filter((m) => m.enabled && state.apiKeys[m.provider]);
}
