import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  BUILT_IN_MODELS,
  BUILT_IN_TEXT_MODELS,
  BUILT_IN_UPSCALERS,
  isBuiltInModel,
  mergeWithBuiltInModels,
  mergeWithBuiltInTextModels,
  mergeWithBuiltInUpscalers,
} from "~/lib/builtInModels";
import { hasProviderAccess } from "~/lib/providers";
import type {
  ApiKeyProvider,
  ApiKeys,
  ModelCapabilities,
  SchemaMapping,
  StoredModel,
  StoredTextModel,
  StoredUpscaler,
} from "~/types";

interface SettingsState {
  apiKeys: ApiKeys;
  models: StoredModel[];
  textModels: StoredTextModel[];
  upscalers: StoredUpscaler[];
  desktopNotificationsEnabled: boolean;
  notificationPromptDismissed: boolean;
  requestedOutputCount: number;
  editorContextInjectionEnabled: boolean;
  alwaysImprovePromptEnabled: boolean;

  // API key actions
  setApiKey: (provider: ApiKeyProvider, key: string | null) => void;
  clearApiKey: (provider: ApiKeyProvider) => void;

  // Model actions
  setModelEnabled: (id: string, enabled: boolean) => void;
  addCustomModel: (
    provider: ApiKeyProvider,
    id: string,
    name: string,
    capabilities: ModelCapabilities,
    schemaMapping?: SchemaMapping,
    icon?: string
  ) => void;
  removeCustomModel: (id: string) => void;
  reorderModels: (activeId: string, overId: string) => void;
  updateModelCapabilities: (
    id: string,
    capabilities: ModelCapabilities,
    schemaFetched?: boolean
  ) => void;
  updateModelSchemaMapping: (id: string, schemaMapping: SchemaMapping) => void;

  // Upscaler actions
  setUpscalerEnabled: (id: string, enabled: boolean) => void;
  addCustomUpscaler: (replicateId: string, name: string, icon?: string) => void;
  removeCustomUpscaler: (id: string) => void;
  reorderUpscalers: (activeId: string, overId: string) => void;

  // Text model actions
  selectTextModel: (id: string) => void;
  addCustomTextModel: (
    provider: ApiKeyProvider,
    modelId: string,
    name: string,
    icon?: string
  ) => void;
  removeCustomTextModel: (id: string) => void;

  // Notification actions
  setDesktopNotificationsEnabled: (enabled: boolean) => void;
  dismissNotificationPrompt: () => void;
  incrementRequestedOutputCount: (count?: number) => void;

  // Editor context injection
  setEditorContextInjectionEnabled: (enabled: boolean) => void;

  // Always improve prompt
  setAlwaysImprovePromptEnabled: (enabled: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      apiKeys: {
        google: null,
        replicate: null,
      },
      models: BUILT_IN_MODELS,
      textModels: BUILT_IN_TEXT_MODELS,
      upscalers: BUILT_IN_UPSCALERS,
      desktopNotificationsEnabled: false,
      notificationPromptDismissed: false,
      requestedOutputCount: 0,
      editorContextInjectionEnabled: true,
      alwaysImprovePromptEnabled: false,

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

      addCustomModel: (provider, id, name, capabilities, schemaMapping, icon) =>
        set((state) => ({
          models: [
            ...state.models,
            {
              id: `${provider}/${id}`,
              name,
              provider,
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

      reorderModels: (activeId, overId) =>
        set((state) => {
          const oldIndex = state.models.findIndex((m) => m.id === activeId);
          const newIndex = state.models.findIndex((m) => m.id === overId);
          if (oldIndex === -1 || newIndex === -1) return state;
          const newModels = [...state.models];
          const [moved] = newModels.splice(oldIndex, 1);
          newModels.splice(newIndex, 0, moved);
          return { models: newModels };
        }),

      updateModelCapabilities: (id, capabilities, schemaFetched) =>
        set((state) => ({
          models: state.models.map((m) =>
            m.id === id
              ? { ...m, capabilities, ...(schemaFetched !== undefined && { schemaFetched }) }
              : m
          ),
        })),

      updateModelSchemaMapping: (id, schemaMapping) =>
        set((state) => ({
          models: state.models.map((m) => (m.id === id ? { ...m, schemaMapping } : m)),
        })),

      selectTextModel: (id) =>
        set((state) => {
          if (!state.textModels.some((m) => m.id === id)) return state;
          return {
            textModels: state.textModels.map((m) => ({ ...m, enabled: m.id === id })),
          };
        }),

      addCustomTextModel: (provider, modelId, name, icon) =>
        set((state) => {
          const id = `${provider}:${modelId}`;
          if (state.textModels.some((m) => m.id === id)) return state;
          const newModel: StoredTextModel = {
            id,
            name,
            provider,
            modelId,
            enabled: true,
            isCustom: true,
            ...(icon && { icon }),
          };
          return {
            textModels: [...state.textModels.map((m) => ({ ...m, enabled: false })), newModel],
          };
        }),

      removeCustomTextModel: (id) =>
        set((state) => {
          const target = state.textModels.find((m) => m.id === id);
          if (!target || !target.isCustom) return state;
          const remaining = state.textModels.filter((m) => m.id !== id);
          if (target.enabled && remaining.length > 0) {
            remaining[0] = { ...remaining[0], enabled: true };
          }
          return { textModels: remaining };
        }),

      setUpscalerEnabled: (id, enabled) =>
        set((state) => ({
          upscalers: state.upscalers.map((u) => (u.id === id ? { ...u, enabled } : u)),
        })),

      addCustomUpscaler: (replicateId, name, icon) =>
        set((state) => {
          const id = `replicate/${replicateId}`;
          if (state.upscalers.some((u) => u.id === id)) return state;
          return {
            upscalers: [
              ...state.upscalers,
              {
                id,
                name,
                replicateId,
                scale: null,
                scaleParam: null,
                enabled: true,
                isCustom: true,
                ...(icon && { icon }),
              },
            ],
          };
        }),

      removeCustomUpscaler: (id) =>
        set((state) => ({
          upscalers: state.upscalers.some((u) => u.id === id && u.isCustom)
            ? state.upscalers.filter((u) => u.id !== id)
            : state.upscalers,
        })),

      reorderUpscalers: (activeId, overId) =>
        set((state) => {
          const oldIndex = state.upscalers.findIndex((u) => u.id === activeId);
          const newIndex = state.upscalers.findIndex((u) => u.id === overId);
          if (oldIndex === -1 || newIndex === -1) return state;
          const newUpscalers = [...state.upscalers];
          const [moved] = newUpscalers.splice(oldIndex, 1);
          newUpscalers.splice(newIndex, 0, moved);
          return { upscalers: newUpscalers };
        }),

      setDesktopNotificationsEnabled: (enabled) => set({ desktopNotificationsEnabled: enabled }),

      dismissNotificationPrompt: () => set({ notificationPromptDismissed: true }),

      setEditorContextInjectionEnabled: (enabled) =>
        set({ editorContextInjectionEnabled: enabled }),

      setAlwaysImprovePromptEnabled: (enabled) => set({ alwaysImprovePromptEnabled: enabled }),

      incrementRequestedOutputCount: (count = 1) =>
        set((state) => ({
          requestedOutputCount: state.requestedOutputCount + Math.max(0, count),
        })),
    }),
    {
      name: "studio-settings",
      version: 12,
      partialize: (state) => ({
        apiKeys: state.apiKeys,
        models: state.models,
        textModels: state.textModels,
        upscalers: state.upscalers,
        desktopNotificationsEnabled: state.desktopNotificationsEnabled,
        notificationPromptDismissed: state.notificationPromptDismissed,
        requestedOutputCount: state.requestedOutputCount,
        editorContextInjectionEnabled: state.editorContextInjectionEnabled,
        alwaysImprovePromptEnabled: state.alwaysImprovePromptEnabled,
      }),
      migrate: (persisted, version) => {
        let state = persisted as {
          apiKeys?: ApiKeys;
          models?: StoredModel[];
          textModel?: { provider: ApiKeyProvider; modelId: string };
          textModels?: StoredTextModel[];
          upscalers?: StoredUpscaler[];
          desktopNotificationsEnabled?: boolean;
          notificationPromptDismissed?: boolean;
          requestedOutputCount?: number;
          editorContextInjectionEnabled?: boolean;
          alwaysImprovePromptEnabled?: boolean;
        };

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

        if (version < 6) {
          state = {
            ...state,
            textModel: { provider: "google", modelId: "gemini-3-flash-preview" },
            models: state.models?.map((model) =>
              isBuiltInModel(model.id) ? { ...model, isCustom: undefined } : model
            ),
            desktopNotificationsEnabled: state.desktopNotificationsEnabled ?? false,
            notificationPromptDismissed: state.notificationPromptDismissed ?? false,
            requestedOutputCount: state.requestedOutputCount ?? 0,
          };
        }

        if (version < 8) {
          state = {
            ...state,
            models: state.models?.map((model) =>
              model.provider === "replicate" && model.isCustom
                ? { ...model, schemaFetched: false }
                : model
            ),
          };
        }

        if (version < 11) {
          // Convert scalar textModel into textModels list.
          const prev = state.textModel;
          const seed = BUILT_IN_TEXT_MODELS.map((m) => ({ ...m, enabled: false }));
          if (prev) {
            const prevId = `${prev.provider}:${prev.modelId}`;
            const existing = seed.find((m) => m.id === prevId);
            if (existing) {
              existing.enabled = true;
            } else {
              seed.push({
                id: prevId,
                name: prev.modelId,
                provider: prev.provider,
                modelId: prev.modelId,
                enabled: true,
                isCustom: true,
                ...(prev.provider === "google" ? { icon: "/icons/google.svg" } : {}),
              });
            }
          } else {
            seed[0] = { ...seed[0], enabled: true };
          }
          state = { ...state, textModels: seed, textModel: undefined };
        }

        // kinda duplicating our default state here but ensures all fields are populated correctly after migration
        return {
          apiKeys: {
            google: state.apiKeys?.google ?? null,
            replicate: state.apiKeys?.replicate ?? null,
          },
          // always merge with built-in
          models: mergeWithBuiltInModels(state.models) ?? BUILT_IN_MODELS,
          textModels: mergeWithBuiltInTextModels(state.textModels) ?? BUILT_IN_TEXT_MODELS,
          upscalers: mergeWithBuiltInUpscalers(state.upscalers) ?? BUILT_IN_UPSCALERS,
          desktopNotificationsEnabled: state.desktopNotificationsEnabled ?? false,
          notificationPromptDismissed: state.notificationPromptDismissed ?? false,
          requestedOutputCount: state.requestedOutputCount ?? 0,
          editorContextInjectionEnabled: state.editorContextInjectionEnabled ?? true,
          alwaysImprovePromptEnabled: state.alwaysImprovePromptEnabled ?? false,
        };
      },
    }
  )
);

// Helper to get enabled models that have API keys
export function getEnabledModels(state: SettingsState): StoredModel[] {
  return state.models.filter((m) => m.enabled && hasProviderAccess(state.apiKeys, m.provider));
}

// Helper to get enabled upscalers (requires Replicate key)
export function getEnabledUpscalers(state: SettingsState): StoredUpscaler[] {
  return state.upscalers.filter((u) => u.enabled && hasProviderAccess(state.apiKeys, "replicate"));
}
