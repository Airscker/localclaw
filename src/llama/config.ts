import path from "node:path";
import { fileURLToPath } from "node:url";
import type { OpenClawConfig } from "../config/config.js";
import type {
  LlamaBuildConfig,
  LlamaDownloadConfig,
  LlamaModelConfig,
  LlamaServerConfig,
  ModelProviderConfig,
} from "../config/types.js";
import { resolveStateDir } from "../config/paths.js";
import { findNormalizedProviderKey, normalizeProviderId } from "../agents/model-selection.js";

export const DEFAULT_LLAMA_PROVIDER = "llama-cpp";
export const DEFAULT_LLAMA_MODEL_ID = "Qwen3.5-35B-A3B";
export const DEFAULT_LLAMA_MODEL_URL =
  "https://huggingface.co/unsloth/Qwen3.5-35B-A3B-GGUF/resolve/main/Qwen3.5-35B-A3B-Q4_K_S.gguf";
export const DEFAULT_LLAMA_MMPROJ_URL =
  "https://huggingface.co/unsloth/Qwen3.5-35B-A3B-GGUF/resolve/main/mmproj-BF16.gguf";
export const DEFAULT_LLAMA_HOST = "127.0.0.1";
export const DEFAULT_LLAMA_PORT = 32145;
export const DEFAULT_LLAMA_CTX_SIZE = 128_000;
export const DEFAULT_LLAMA_MAX_TOKENS = 8_192;
// Large GGUF cold starts on CPU-only or lower-VRAM hosts can take well over 10 minutes.
export const DEFAULT_LLAMA_START_TIMEOUT_MS = 30 * 60 * 1000;

export type ResolvedLlamaRuntimeConfig = {
  enabled: boolean;
  autoStart: boolean;
  providerId: string;
  model: Required<LlamaModelConfig>;
  build: Required<LlamaBuildConfig>;
  download: Required<LlamaDownloadConfig>;
  server: Required<LlamaServerConfig>;
};

function resolveDefaultModelsDir(env: NodeJS.ProcessEnv = process.env): string {
  return path.join(resolveStateDir(env), "llama", "models");
}

function resolveRepoRoot(): string {
  return fileURLToPath(new URL("../../", import.meta.url));
}

function buildDefaultModelPath(env: NodeJS.ProcessEnv = process.env): string {
  return path.join(resolveDefaultModelsDir(env), path.basename(DEFAULT_LLAMA_MODEL_URL));
}

function buildDefaultMmprojPath(env: NodeJS.ProcessEnv = process.env): string {
  return path.join(resolveDefaultModelsDir(env), path.basename(DEFAULT_LLAMA_MMPROJ_URL));
}

export function buildLlamaBaseUrl(config: ResolvedLlamaRuntimeConfig): string {
  return `http://${config.server.host}:${config.server.port}/v1`;
}

export function resolveLlamaRuntimeConfig(
  cfg: OpenClawConfig,
  env: NodeJS.ProcessEnv = process.env,
): ResolvedLlamaRuntimeConfig {
  const raw = cfg.llama ?? {};
  const modelPath = raw.model?.path?.trim() || buildDefaultModelPath(env);
  const mmprojPath = raw.model?.mmprojPath?.trim() || buildDefaultMmprojPath(env);
  const modelsDir = raw.download?.modelsDir?.trim() || path.dirname(modelPath);
  const sourceDir = raw.build?.sourceDir?.trim() || path.join(resolveRepoRoot(), "llama.cpp");
  const buildDir = raw.build?.buildDir?.trim() || path.join(sourceDir, "build-openclaw");

  return {
    enabled: raw.enabled ?? true,
    autoStart: raw.autoStart ?? true,
    providerId: normalizeProviderId(raw.providerId?.trim() || DEFAULT_LLAMA_PROVIDER),
    model: {
      id: raw.model?.id?.trim() || DEFAULT_LLAMA_MODEL_ID,
      url: raw.model?.url?.trim() || DEFAULT_LLAMA_MODEL_URL,
      path: modelPath,
      mmprojUrl: raw.model?.mmprojUrl?.trim() || DEFAULT_LLAMA_MMPROJ_URL,
      mmprojPath,
    },
    build: {
      autoBuild: raw.build?.autoBuild ?? true,
      sourceDir,
      buildDir,
      generator: raw.build?.generator?.trim() || "",
      cmakeArgs: raw.build?.cmakeArgs ?? [],
      buildArgs: raw.build?.buildArgs ?? [],
    },
    download: {
      autoDownload: raw.download?.autoDownload ?? true,
      modelsDir,
    },
    server: {
      host: raw.server?.host?.trim() || DEFAULT_LLAMA_HOST,
      port: raw.server?.port ?? DEFAULT_LLAMA_PORT,
      binaryPath: raw.server?.binaryPath?.trim() || "",
      alias: raw.server?.alias?.trim() || raw.model?.id?.trim() || DEFAULT_LLAMA_MODEL_ID,
      ctxSize: raw.server?.ctxSize ?? DEFAULT_LLAMA_CTX_SIZE,
      threads: raw.server?.threads ?? 0,
      parallel: raw.server?.parallel ?? 1,
      gpuLayers: raw.server?.gpuLayers ?? -1,
      timeoutMs: raw.server?.timeoutMs ?? DEFAULT_LLAMA_START_TIMEOUT_MS,
      extraArgs: raw.server?.extraArgs ?? [],
    },
  };
}

export function buildManagedLlamaProviderConfig(
  cfg: OpenClawConfig,
  env: NodeJS.ProcessEnv = process.env,
): ModelProviderConfig {
  const resolved = resolveLlamaRuntimeConfig(cfg, env);
  return {
    baseUrl: buildLlamaBaseUrl(resolved),
    api: "openai-completions",
    models: [
      {
        id: resolved.model.id,
        name: resolved.server.alias,
        reasoning: false,
        input: ["text", "image"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: resolved.server.ctxSize,
        maxTokens: DEFAULT_LLAMA_MAX_TOKENS,
      },
    ],
  };
}

function withDefaultLlamaConfig(
  cfg: OpenClawConfig,
  env: NodeJS.ProcessEnv,
): OpenClawConfig {
  const resolved = resolveLlamaRuntimeConfig(cfg, env);
  return {
    ...cfg,
    llama: {
      ...cfg.llama,
      enabled: resolved.enabled,
      autoStart: resolved.autoStart,
      providerId: resolved.providerId,
      model: {
        ...cfg.llama?.model,
        id: resolved.model.id,
        url: resolved.model.url,
        path: resolved.model.path,
        mmprojUrl: resolved.model.mmprojUrl,
        mmprojPath: resolved.model.mmprojPath,
      },
      build: {
        ...cfg.llama?.build,
        autoBuild: resolved.build.autoBuild,
        sourceDir: resolved.build.sourceDir,
        buildDir: resolved.build.buildDir,
        ...(resolved.build.generator ? { generator: resolved.build.generator } : {}),
        cmakeArgs: resolved.build.cmakeArgs,
        buildArgs: resolved.build.buildArgs,
      },
      download: {
        ...cfg.llama?.download,
        autoDownload: resolved.download.autoDownload,
        modelsDir: resolved.download.modelsDir,
      },
      server: {
        ...cfg.llama?.server,
        host: resolved.server.host,
        port: resolved.server.port,
        ...(resolved.server.binaryPath ? { binaryPath: resolved.server.binaryPath } : {}),
        alias: resolved.server.alias,
        ctxSize: resolved.server.ctxSize,
        ...(resolved.server.threads > 0 ? { threads: resolved.server.threads } : {}),
        parallel: resolved.server.parallel,
        gpuLayers: resolved.server.gpuLayers,
        timeoutMs: resolved.server.timeoutMs,
        extraArgs: resolved.server.extraArgs,
      },
    },
  };
}

export function applyManagedLlamaDefaults(
  cfg: OpenClawConfig,
  env: NodeJS.ProcessEnv = process.env,
): OpenClawConfig {
  const withDefaults = withDefaultLlamaConfig(cfg, env);
  const resolved = resolveLlamaRuntimeConfig(withDefaults, env);
  if (!resolved.enabled) {
    return withDefaults;
  }

  const providers = { ...(withDefaults.models?.providers ?? {}) };
  const providerKey = findNormalizedProviderKey(providers, resolved.providerId) ?? resolved.providerId;
  const defaultProvider = buildManagedLlamaProviderConfig(withDefaults, env);
  const existingProvider = providers[providerKey];
  providers[providerKey] = existingProvider
    ? {
        ...defaultProvider,
        ...existingProvider,
        models:
          Array.isArray(existingProvider.models) && existingProvider.models.length > 0
            ? existingProvider.models
            : defaultProvider.models,
      }
    : defaultProvider;

  const existingModel = withDefaults.agents?.defaults?.model;
  const hasPrimaryModel =
    typeof existingModel === "string"
      ? existingModel.trim().length > 0
      : typeof existingModel === "object" && existingModel !== null && "primary" in existingModel
        ? typeof existingModel.primary === "string" && existingModel.primary.trim().length > 0
        : false;
  const modelRef = `${providerKey}/${resolved.model.id}`;

  return {
    ...withDefaults,
    models: {
      ...withDefaults.models,
      mode: withDefaults.models?.mode ?? "merge",
      providers,
    },
    agents: {
      ...withDefaults.agents,
      defaults: {
        ...withDefaults.agents?.defaults,
        model: hasPrimaryModel
          ? existingModel
          : {
              primary: modelRef,
            },
      },
    },
  };
}

export function shouldManageLlamaProvider(cfg: OpenClawConfig, provider: string): boolean {
  const resolved = resolveLlamaRuntimeConfig(cfg);
  return resolved.enabled && normalizeProviderId(provider) === resolved.providerId;
}
