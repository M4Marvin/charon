import catalogJson from "./models-dev.json";

export type CatalogModel = {
  id: string;
  name: string;
  context?: number;
  output?: number;
  cost?: { input: number | null; output: number | null } | null;
  reasoning?: boolean;
  toolCall?: boolean;
  released?: string;
};

export type CatalogProvider = {
  id: string;
  name: string;
  baseUrl: string;
  apiKeyRequired: boolean;
  local?: boolean;
  hint: string;
  models: CatalogModel[];
};

export type Catalog = {
  generatedAt: string;
  source: string;
  attribution: string;
  providers: CatalogProvider[];
};

export const CATALOG = catalogJson as Catalog;
export const CATALOG_PROVIDERS = CATALOG.providers;

export function findCatalogProvider(id: string): CatalogProvider {
  return CATALOG_PROVIDERS.find((provider) => provider.id === id) ?? CATALOG_PROVIDERS[0];
}

/** "1M", "128k", "8k" — used in the model picker. */
export function formatContext(tokens: number | undefined): string | null {
  if (!tokens || tokens <= 0) return null;
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (tokens >= 1_000) return `${Math.round(tokens / 1_000)}k`;
  return String(tokens);
}

/** "$2 / $8 per 1M tokens", or null when the catalog has no pricing. */
export function formatCost(model: CatalogModel): string | null {
  if (!model.cost || model.cost.input == null || model.cost.output == null) return null;
  return `$${model.cost.input} / $${model.cost.output} per 1M`;
}
