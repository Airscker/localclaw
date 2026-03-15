export type LlamaModelConfig = {
  id?: string;
  url?: string;
  path?: string;
  mmprojUrl?: string;
  mmprojPath?: string;
};

export type LlamaBuildConfig = {
  autoBuild?: boolean;
  sourceDir?: string;
  buildDir?: string;
  generator?: string;
  cmakeArgs?: string[];
  buildArgs?: string[];
};

export type LlamaDownloadConfig = {
  autoDownload?: boolean;
  modelsDir?: string;
};

export type LlamaServerConfig = {
  host?: string;
  port?: number;
  binaryPath?: string;
  alias?: string;
  ctxSize?: number;
  threads?: number;
  parallel?: number;
  gpuLayers?: number;
  timeoutMs?: number;
  extraArgs?: string[];
};

export type LlamaRuntimeConfig = {
  enabled?: boolean;
  autoStart?: boolean;
  providerId?: string;
  model?: LlamaModelConfig;
  build?: LlamaBuildConfig;
  download?: LlamaDownloadConfig;
  server?: LlamaServerConfig;
};
