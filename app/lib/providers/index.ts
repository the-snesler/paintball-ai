import type { ApiKeyProvider, ApiKeys, Provider as ProviderId } from "~/types";
import { debugProvider } from "./debug";
import { googleProvider } from "./google";
import { replicateProvider } from "./replicate";
import type { Provider, ProviderCapabilities, TextCapableProvider } from "./types";

export type {
  Provider,
  ProviderCapabilities,
  SearchResult,
  ResolvedImageModel,
  TextGenerationArgs,
} from "./types";

export const PROVIDERS: Record<ProviderId, Provider> = {
  google: googleProvider,
  replicate: replicateProvider,
  debug: debugProvider,
};

export function getProvider(id: ProviderId): Provider {
  const provider = PROVIDERS[id];
  if (!provider) throw new Error(`Unknown provider: ${id}`);
  return provider;
}

export function listProviders(): Provider[] {
  return Object.values(PROVIDERS);
}

export function providersWith<K extends keyof ProviderCapabilities>(cap: K): Provider[] {
  return listProviders().filter((p) => p.capabilities[cap]);
}

export function providerRequiresApiKey(provider: ProviderId): provider is ApiKeyProvider {
  return PROVIDERS[provider]?.requiresApiKey ?? false;
}

export function hasProviderAccess(apiKeys: ApiKeys, provider: ProviderId): boolean {
  if (!providerRequiresApiKey(provider)) return true;
  return !!apiKeys[provider];
}

export function isTextCapable(provider: Provider): provider is TextCapableProvider {
  return (
    provider.capabilities.text &&
    !!provider.generateText &&
    !!provider.testTextModel &&
    (provider.id === "google" || provider.id === "replicate")
  );
}
