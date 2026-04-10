import type { ApiKeyProvider, ApiKeys, Provider } from "~/types";

export function providerRequiresApiKey(provider: Provider): provider is ApiKeyProvider {
  return provider === "google" || provider === "replicate";
}

export function hasProviderAccess(apiKeys: ApiKeys, provider: Provider): boolean {
  return !providerRequiresApiKey(provider) || !!apiKeys[provider];
}
