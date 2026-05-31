import type { Resolution, StoredModel } from "~/types";
import { getProvider } from "~/lib/providers";
import type { CostEstimate, CostEstimateArgs } from "~/lib/providers/types";

/** Resolves a per-image price from the user-configurable `pricePerImageUsd` map
 *  on a stored model, falling back to `default` if the requested resolution is unset. */
export function resolveStoredPrice(
  model: StoredModel,
  resolution: Resolution | null
): number | null {
  const prices = model.pricePerImageUsd;
  if (!prices) return null;
  const candidate = (resolution && prices[resolution]) ?? prices.default;
  if (typeof candidate !== "number" || !Number.isFinite(candidate) || candidate < 0) return null;
  return candidate;
}

export function formatCostUsd(usd: number): string {
  if (!Number.isFinite(usd) || usd < 0) return "—";
  if (usd === 0) return "$0";
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  if (usd < 1) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(2)}`;
}

export function estimateCostForModel(
  model: StoredModel,
  args: Omit<CostEstimateArgs, "model">
): CostEstimate | null {
  const provider = getProvider(model.provider);
  if (!provider.estimateCost) return null;
  return provider.estimateCost({ ...args, model });
}
