#!/usr/bin/env node
/**
 * Build the bundled model catalog from models.dev.
 *
 * models.dev is an open catalog of providers and models. Charon only speaks
 * the OpenAI chat-completions protocol, so this script keeps providers that
 * expose an OpenAI-compatible endpoint and records the base URL explicitly.
 * The output is served from /models-dev.json, so onboarding never needs a
 * network request to a third party.
 *
 *   node scripts/sync-models-dev.mjs
 */
import { writeFileSync } from "node:fs";

const SOURCE = "https://models.dev/api.json";
const OUTPUT = "src/lib/models-dev.json";
const MAX_MODELS = 150;

/** Providers Charon can actually call through the OpenAI-compatible adapter. */
const PROVIDERS = [
  {
    id: "openai",
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    apiKeyRequired: true,
    hint: "GPT and reasoning models",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    apiKeyRequired: true,
    hint: "One key, many providers",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.com",
    apiKeyRequired: true,
    hint: "Low-cost reasoning models",
  },
  {
    id: "groq",
    name: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    apiKeyRequired: true,
    hint: "Very fast inference",
  },
  {
    id: "mistral",
    name: "Mistral",
    baseUrl: "https://api.mistral.ai/v1",
    apiKeyRequired: true,
    hint: "European models",
  },
  {
    id: "xai",
    name: "xAI",
    baseUrl: "https://api.x.ai/v1",
    apiKeyRequired: true,
    hint: "Grok models",
  },
  {
    id: "togetherai",
    name: "Together AI",
    baseUrl: "https://api.together.xyz/v1",
    apiKeyRequired: true,
    hint: "Open models, hosted",
  },
  {
    id: "cerebras",
    name: "Cerebras",
    baseUrl: "https://api.cerebras.ai/v1",
    apiKeyRequired: true,
    hint: "Fast open models",
  },
  {
    id: "google",
    name: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/",
    apiKeyRequired: true,
    hint: "OpenAI-compatible endpoint",
  },
  {
    id: "lmstudio",
    name: "LM Studio",
    baseUrl: "http://127.0.0.1:1234/v1",
    apiKeyRequired: false,
    local: true,
    hint: "A model running on this computer",
  },
  {
    id: "ollama",
    name: "Ollama",
    baseUrl: "http://127.0.0.1:11434/v1",
    apiKeyRequired: false,
    local: true,
    hint: "A model running on this computer",
  },
  {
    id: "custom",
    name: "Custom endpoint",
    baseUrl: "",
    apiKeyRequired: false,
    hint: "Any OpenAI-compatible server",
  },
];

function normalizeModel(model) {
  const context = model.limit?.context;
  const output = model.limit?.output;
  const cost = model.cost
    ? { input: model.cost.input ?? null, output: model.cost.output ?? null }
    : null;
  return {
    id: model.id,
    name: model.name ?? model.id,
    ...(context ? { context } : {}),
    ...(output ? { output } : {}),
    ...(cost ? { cost } : {}),
    ...(model.reasoning ? { reasoning: true } : {}),
    ...(model.tool_call ? { toolCall: true } : {}),
    ...(model.release_date ? { released: model.release_date } : {}),
  };
}

const NON_CHAT = /(image|audio|tts|whisper|transcrib|embed|moderat|realtime|dall-e|sora|video|computer-use)/i;

function textModels(provider) {
  return Object.values(provider?.models ?? {})
    .filter((model) => model?.modalities?.output?.includes("text"))
    .filter((model) => !NON_CHAT.test(model.id))
    .map(normalizeModel)
    .sort((a, b) => String(b.released ?? "").localeCompare(String(a.released ?? "")) || a.name.localeCompare(b.name))
    .slice(0, MAX_MODELS);
}

const response = await fetch(SOURCE, { headers: { accept: "application/json" } });
if (!response.ok) {
  throw new Error(`models.dev returned ${response.status} ${response.statusText}`);
}
const catalog = await response.json();

const providers = PROVIDERS.map((provider) => ({
  ...provider,
  baseUrl: provider.baseUrl || catalog[provider.id]?.api || "",
  models: textModels(catalog[provider.id]),
}));

const payload = {
  generatedAt: new Date().toISOString(),
  source: SOURCE,
  attribution: "Provider and model metadata from models.dev (MIT).",
  providers,
};

writeFileSync(OUTPUT, JSON.stringify(payload) + "\n");
console.log(
  `Wrote ${OUTPUT}: ${providers.length} providers, ${providers.reduce((n, p) => n + p.models.length, 0)} models`,
);
