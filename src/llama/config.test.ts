import { describe, expect, it } from "vitest";
import {
  applyManagedLlamaDefaults,
  DEFAULT_LLAMA_MODEL_ID,
  DEFAULT_LLAMA_PROVIDER,
  DEFAULT_LLAMA_START_TIMEOUT_MS,
  resolveLlamaRuntimeConfig,
} from "./config.js";

describe("applyManagedLlamaDefaults", () => {
  it("injects the managed llama provider and default model when config is empty", () => {
    const cfg = applyManagedLlamaDefaults({}, { OPENCLAW_STATE_DIR: "/tmp/openclaw-llama-test" });

    expect(cfg.llama?.enabled).toBe(true);
    expect(cfg.models?.providers?.[DEFAULT_LLAMA_PROVIDER]?.api).toBe("openai-completions");
    expect(cfg.models?.providers?.[DEFAULT_LLAMA_PROVIDER]?.baseUrl).toBe(
      "http://127.0.0.1:32145/v1",
    );
    expect(cfg.agents?.defaults?.model).toEqual({
      primary: `${DEFAULT_LLAMA_PROVIDER}/${DEFAULT_LLAMA_MODEL_ID}`,
    });
  });

  it("preserves an explicit primary model", () => {
    const cfg = applyManagedLlamaDefaults(
      {
        agents: {
          defaults: {
            model: { primary: "openai/gpt-5.4" },
          },
        },
      },
      { OPENCLAW_STATE_DIR: "/tmp/openclaw-llama-test" },
    );

    expect(cfg.agents?.defaults?.model).toEqual({ primary: "openai/gpt-5.4" });
  });

  it("uses the extended startup timeout by default and preserves explicit overrides", () => {
    const defaults = resolveLlamaRuntimeConfig({}, { OPENCLAW_STATE_DIR: "/tmp/openclaw-llama-test" });
    expect(defaults.server.timeoutMs).toBe(DEFAULT_LLAMA_START_TIMEOUT_MS);

    const overridden = resolveLlamaRuntimeConfig(
      {
        llama: {
          server: {
            timeoutMs: 45_000,
          },
        },
      },
      { OPENCLAW_STATE_DIR: "/tmp/openclaw-llama-test" },
    );

    expect(overridden.server.timeoutMs).toBe(45_000);
  });
});
