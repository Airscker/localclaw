import { loadConfig } from "../src/config/config.js";
import {
  buildManagedLlamaRuntime,
  downloadManagedLlamaArtifacts,
  ensureManagedLlamaRuntime,
  formatManagedLlamaStatus,
  getManagedLlamaStatus,
  stopManagedLlamaRuntime,
} from "../src/llama/runtime.js";

async function main() {
  const command = process.argv[2]?.trim() || "status";
  const cfg = loadConfig();

  switch (command) {
    case "build": {
      const binary = await buildManagedLlamaRuntime(cfg, { force: process.argv.includes("--force") });
      process.stdout.write(`${binary}\n`);
      return;
    }
    case "download": {
      await downloadManagedLlamaArtifacts(cfg);
      return;
    }
    case "start": {
      const result = await ensureManagedLlamaRuntime(cfg);
      process.stdout.write(`${result?.baseUrl ?? "disabled"}\n`);
      return;
    }
    case "stop": {
      await stopManagedLlamaRuntime();
      return;
    }
    case "status": {
      const status = await getManagedLlamaStatus(cfg);
      process.stdout.write(`${formatManagedLlamaStatus(status)}\n`);
      return;
    }
    default:
      throw new Error(`Unknown llama-runtime command: ${command}`);
  }
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
