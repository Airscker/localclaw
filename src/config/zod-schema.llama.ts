import { z } from "zod";

const StringListSchema = z.array(z.string()).optional();

export const LlamaModelConfigSchema = z
  .object({
    id: z.string().min(1).optional(),
    url: z.string().url().optional(),
    path: z.string().min(1).optional(),
    mmprojUrl: z.string().url().optional(),
    mmprojPath: z.string().min(1).optional(),
  })
  .strict()
  .optional();

export const LlamaBuildConfigSchema = z
  .object({
    autoBuild: z.boolean().optional(),
    sourceDir: z.string().min(1).optional(),
    buildDir: z.string().min(1).optional(),
    generator: z.string().min(1).optional(),
    cmakeArgs: StringListSchema,
    buildArgs: StringListSchema,
  })
  .strict()
  .optional();

export const LlamaDownloadConfigSchema = z
  .object({
    autoDownload: z.boolean().optional(),
    modelsDir: z.string().min(1).optional(),
  })
  .strict()
  .optional();

export const LlamaServerConfigSchema = z
  .object({
    host: z.string().min(1).optional(),
    port: z.number().int().min(1).max(65535).optional(),
    binaryPath: z.string().min(1).optional(),
    alias: z.string().min(1).optional(),
    ctxSize: z.number().int().positive().optional(),
    threads: z.number().int().positive().optional(),
    parallel: z.number().int().positive().optional(),
    gpuLayers: z.number().int().optional(),
    timeoutMs: z.number().int().positive().optional(),
    extraArgs: StringListSchema,
  })
  .strict()
  .optional();

export const LlamaRuntimeConfigSchema = z
  .object({
    enabled: z.boolean().optional(),
    autoStart: z.boolean().optional(),
    providerId: z.string().min(1).optional(),
    model: LlamaModelConfigSchema,
    build: LlamaBuildConfigSchema,
    download: LlamaDownloadConfigSchema,
    server: LlamaServerConfigSchema,
  })
  .strict()
  .optional();
