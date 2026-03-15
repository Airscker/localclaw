// Defaults for agent metadata when upstream does not supply them.
// The local llama.cpp runtime is injected into runtime config defaults.
export const DEFAULT_PROVIDER = "llama-cpp";
export const DEFAULT_MODEL = "Qwen3.5-35B-A3B";
// Conservative fallback used when model metadata is unavailable.
export const DEFAULT_CONTEXT_TOKENS = 200_000;
