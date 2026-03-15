import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createWriteStream, mkdirSync, openSync } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { OpenClawConfig } from "../config/config.js";
import { createSubsystemLogger } from "../logging/subsystem.js";
import { attachChildProcessBridge } from "../process/child-process-bridge.js";
import {
  buildLlamaBaseUrl,
  resolveLlamaRuntimeConfig,
  shouldManageLlamaProvider,
  type ResolvedLlamaRuntimeConfig,
} from "./config.js";

const log = createSubsystemLogger("llama/runtime");
const READY_POLL_INTERVAL_MS = 1000;
const READY_REQUEST_TIMEOUT_MS = 5000;

function shouldSkipManagedRuntimeStartup(): boolean {
  return (
    process.env.OPENCLAW_SKIP_MANAGED_LLAMA === "1" ||
    process.env.VITEST === "1" ||
    process.env.NODE_ENV === "test"
  );
}

type ManagedRuntimeState = {
  child: ChildProcess | null;
  startedByThisProcess: boolean;
  startup: Promise<{ baseUrl: string; binaryPath?: string }> | null;
  detachBridge: (() => void) | null;
  logPath: string | null;
};

const state: ManagedRuntimeState = {
  child: null,
  startedByThisProcess: false,
  startup: null,
  detachBridge: null,
  logPath: null,
};

function resolveRepoRoot(): string {
  return fileURLToPath(new URL("../../", import.meta.url));
}

function resolveLlamaBinaryCandidates(config: ResolvedLlamaRuntimeConfig): string[] {
  const fromConfig = config.server.binaryPath ? [config.server.binaryPath] : [];
  const exe = process.platform === "win32" ? "llama-server.exe" : "llama-server";
  const buildDir = config.build.buildDir;
  return [
    ...fromConfig,
    path.join(buildDir, "bin", exe),
    path.join(buildDir, "bin", "Release", exe),
    path.join(buildDir, "Release", exe),
    path.join(buildDir, exe),
  ];
}

async function findExistingBinary(config: ResolvedLlamaRuntimeConfig): Promise<string | null> {
  for (const candidate of resolveLlamaBinaryCandidates(config)) {
    if (!candidate) {
      continue;
    }
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Try the next candidate.
    }
  }
  return null;
}

async function runCommand(params: {
  command: string;
  args: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(params.command, params.args, {
      cwd: params.cwd,
      env: params.env,
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${params.command} exited with code ${code ?? "unknown"}`));
    });
  });
}

async function ensureParentDir(filePath: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function downloadFile(url: string, destination: string): Promise<void> {
  await ensureParentDir(destination);
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`Download failed for ${url}: ${response.status} ${response.statusText}`);
  }
  const tempPath = `${destination}.partial-${process.pid}`;
  const output = createWriteStream(tempPath);
  try {
    const body = response.body as Parameters<typeof Readable.fromWeb>[0];
    await pipeline(Readable.fromWeb(body), output);
    await fs.rename(tempPath, destination);
  } catch (error) {
    await fs.rm(tempPath, { force: true }).catch(() => {});
    throw error;
  }
}

export async function downloadManagedLlamaArtifacts(cfg: OpenClawConfig): Promise<void> {
  const config = resolveLlamaRuntimeConfig(cfg);
  if (!config.enabled || !config.download.autoDownload) {
    return;
  }

  await fs.mkdir(config.download.modelsDir, { recursive: true });
  try {
    await fs.access(config.model.path);
  } catch {
    log.info(`Downloading default llama model to ${config.model.path}`);
    await downloadFile(config.model.url, config.model.path);
  }

  if (!config.model.mmprojUrl) {
    return;
  }
  try {
    await fs.access(config.model.mmprojPath);
  } catch {
    log.info(`Downloading default llama multimodal projector to ${config.model.mmprojPath}`);
    await downloadFile(config.model.mmprojUrl, config.model.mmprojPath);
  }
}

export async function buildManagedLlamaRuntime(
  cfg: OpenClawConfig,
  opts: { force?: boolean } = {},
): Promise<string> {
  const config = resolveLlamaRuntimeConfig(cfg);
  const existing = await findExistingBinary(config);
  if (existing && !opts.force) {
    return existing;
  }
  if (!config.build.autoBuild) {
    throw new Error("llama runtime build is disabled by config (llama.build.autoBuild=false)");
  }

  await fs.mkdir(config.build.buildDir, { recursive: true });
  const configureArgs = [
    "-S",
    config.build.sourceDir,
    "-B",
    config.build.buildDir,
    "-DLLAMA_BUILD_SERVER=ON",
    "-DCMAKE_BUILD_TYPE=Release",
    ...config.build.cmakeArgs,
  ];
  if (config.build.generator) {
    configureArgs.splice(0, 0, "-G", config.build.generator);
  }
  await runCommand({ command: "cmake", args: configureArgs, cwd: resolveRepoRoot() });
  await runCommand({
    command: "cmake",
    args: [
      "--build",
      config.build.buildDir,
      "--config",
      "Release",
      "--target",
      "llama-server",
      ...config.build.buildArgs,
    ],
    cwd: resolveRepoRoot(),
  });

  const binaryPath = await findExistingBinary(config);
  if (!binaryPath) {
    throw new Error("llama-server build completed but no binary was found in the build output");
  }
  return binaryPath;
}

async function isServerReady(baseUrl: string): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), READY_REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${baseUrl}/models`, { signal: controller.signal });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function waitForServerReady(baseUrl: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isServerReady(baseUrl)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, READY_POLL_INTERVAL_MS));
  }
  throw new Error(`Timed out waiting for llama-server at ${baseUrl}`);
}

export function buildLlamaServerArgs(config: ResolvedLlamaRuntimeConfig): string[] {
  return [
    "--host",
    config.server.host,
    "--port",
    String(config.server.port),
    "--model",
    config.model.path,
    "--alias",
    config.server.alias,
    "--ctx-size",
    String(config.server.ctxSize),
    "--parallel",
    String(config.server.parallel),
    ...(config.server.threads > 0 ? ["--threads", String(config.server.threads)] : []),
    ...(config.server.gpuLayers >= 0
      ? ["--n-gpu-layers", String(config.server.gpuLayers)]
      : []),
    ...(config.model.mmprojPath ? ["--mmproj", config.model.mmprojPath] : []),
    ...config.server.extraArgs,
  ];
}

function spawnManagedServer(binaryPath: string, config: ResolvedLlamaRuntimeConfig): ChildProcess {
  const logPath = path.join(
    config.download.modelsDir,
    "..",
    "logs",
    `llama-server-${process.pid}.log`,
  );
  state.logPath = path.resolve(logPath);
  mkdirSync(path.dirname(logPath), { recursive: true });
  const logFd = openSync(logPath, "a");

  const child = spawn(binaryPath, buildLlamaServerArgs(config), {
    cwd: resolveRepoRoot(),
    env: process.env,
    detached: true,
    stdio: ["ignore", logFd, logFd],
  });
  child.unref();

  state.detachBridge = attachChildProcessBridge(child).detach;
  child.once("exit", () => {
    state.child = null;
    state.startedByThisProcess = false;
    state.startup = null;
    state.detachBridge?.();
    state.detachBridge = null;
  });
  return child;
}

export async function ensureManagedLlamaRuntime(
  cfg: OpenClawConfig,
): Promise<{ baseUrl: string; binaryPath?: string } | null> {
  const config = resolveLlamaRuntimeConfig(cfg);
  if (!config.enabled || !config.autoStart || shouldSkipManagedRuntimeStartup()) {
    return null;
  }

  const baseUrl = buildLlamaBaseUrl(config);
  if (await isServerReady(baseUrl)) {
    return { baseUrl };
  }
  if (state.startup) {
    return await state.startup;
  }

  state.startup = (async () => {
    await downloadManagedLlamaArtifacts(cfg);
    const binaryPath = await buildManagedLlamaRuntime(cfg);
    if (await isServerReady(baseUrl)) {
      return { baseUrl, binaryPath };
    }

    state.child = spawnManagedServer(binaryPath, config);
    state.startedByThisProcess = true;
    await waitForServerReady(baseUrl, config.server.timeoutMs);
    log.info(`Managed llama-server is ready at ${baseUrl}`);
    return { baseUrl, binaryPath };
  })();

  try {
    return await state.startup;
  } finally {
    state.startup = null;
  }
}

export async function ensureManagedLlamaRuntimeForProvider(
  cfg: OpenClawConfig,
  provider: string,
): Promise<void> {
  if (!shouldManageLlamaProvider(cfg, provider)) {
    return;
  }
  await ensureManagedLlamaRuntime(cfg);
}

export async function stopManagedLlamaRuntime(): Promise<void> {
  if (!state.startedByThisProcess || !state.child) {
    return;
  }
  const child = state.child;
  state.startedByThisProcess = false;
  state.child = null;
  state.detachBridge?.();
  state.detachBridge = null;

  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {
        // ignore
      }
    }, 5000);
    child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
    try {
      child.kill("SIGTERM");
    } catch {
      clearTimeout(timer);
      resolve();
    }
  });
}

export async function getManagedLlamaStatus(cfg: OpenClawConfig): Promise<{
  enabled: boolean;
  ready: boolean;
  baseUrl: string;
  binaryPath: string | null;
  modelPath: string;
  mmprojPath: string;
  logPath: string | null;
}> {
  const config = resolveLlamaRuntimeConfig(cfg);
  const baseUrl = buildLlamaBaseUrl(config);
  return {
    enabled: config.enabled,
    ready: config.enabled ? await isServerReady(baseUrl) : false,
    baseUrl,
    binaryPath: await findExistingBinary(config),
    modelPath: config.model.path,
    mmprojPath: config.model.mmprojPath,
    logPath: state.logPath,
  };
}

export function buildDefaultLlamaConfig(): OpenClawConfig {
  return {
    llama: {
      enabled: true,
      autoStart: true,
    },
  };
}

export function formatManagedLlamaStatus(status: Awaited<ReturnType<typeof getManagedLlamaStatus>>): string {
  return [
    `enabled=${status.enabled}`,
    `ready=${status.ready}`,
    `baseUrl=${status.baseUrl}`,
    `binary=${status.binaryPath ?? "missing"}`,
    `model=${status.modelPath}`,
    `mmproj=${status.mmprojPath}`,
    `log=${status.logPath ?? "n/a"}`,
  ].join(os.EOL);
}
