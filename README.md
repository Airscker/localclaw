# LocalClaw

LocalClaw is a local-first personal AI assistant stack built to run `llama.cpp` by default on your own machine. It downloads a local model, starts a local gateway, and keeps the default path focused on self-hosted inference instead of paid cloud usage.

Repo: `https://github.com/Airscker/localclaw.git`

Important compatibility note: the CLI and state paths still use the existing `openclaw` command and `~/.openclaw` directory. This README uses the LocalClaw name for the product, but the actual commands you run are the current repo commands.

## Purpose

LocalClaw is aimed at people who want:

- a personal assistant stack that runs locally
- a default local LLM runtime instead of external API dependence
- a practical self-hosted workflow with one main startup command
- lower ongoing cost for day-to-day use

## Benefits

Compared with the upstream cloud-first usage path, LocalClaw currently emphasizes:

- `0` model token fee for the default local workflow
- no required cloud LLM API key for the main setup path
- local control over model files, startup flow, and runtime tuning
- a bundled `llama.cpp` path instead of requiring a separate provider setup first

## What LocalClaw does

- Builds `llama.cpp` from the vendored `llama.cpp/` directory.
- Uses a local OpenAI-compatible `llama-server` as the default model provider.
- Defaults to `Qwen3.5-35B-A3B-Q4_K_S.gguf` with `mmproj-BF16.gguf`.
- Starts the local gateway with `pnpm openclaw:local`.
- Works without a cloud LLM API key for the default local path.

## Quick start

Runtime baseline: Node `22+`

```bash
git clone https://github.com/Airscker/localclaw.git
cd localclaw

pnpm install
pnpm build
pnpm openclaw:local
```

Then open:

```text
http://127.0.0.1:18789/
```

If the dashboard asks for a gateway token, run:

```bash
pnpm openclaw dashboard
```

If you want the token directly:

```bash
pnpm openclaw config get gateway.auth.token
```

## Installation requirements

- `Node.js 22+`
- `pnpm`
- `cmake`
- a working C/C++ toolchain
- enough free disk space for the default GGUF artifacts and build output

Linux GPU hosts typically also need:

- recent NVIDIA drivers
- CUDA-capable GPU support if you want GPU offload in `llama.cpp`

## Recommended device configs

These are practical recommendations for the default LocalClaw model profile in this repo.

| Profile              | Recommendation                                            | Notes                                                                 |
| -------------------- | --------------------------------------------------------- | --------------------------------------------------------------------- |
| macOS, best overall  | Apple Silicon with `24 GB+` unified memory              | Best fit for the default local-first workflow.                        |
| Linux, GPU-backed    | NVIDIA GPU with `12 GB+` VRAM and `64 GB+` system RAM | Best choice for faster cold starts and response times on Linux.       |
| Linux, mixed CPU/GPU | NVIDIA GPU with `12 GB+` VRAM and reduced `ctxSize`   | Usable, but you will likely want to tune `llama.server.ctxSize`.    |
| CPU-only             | `32 GB+` RAM strongly recommended                       | Supported for experimentation, but startup and inference can be slow. |

If your machine is below those profiles, LocalClaw can still build, but the default model may start slowly or need a smaller context window.

## Installation and local deployment

### Unified startup

This is the default path:

```bash
pnpm openclaw:local
```

That starts the gateway and uses the managed local `llama.cpp` runtime path already configured in this fork.

### Staged startup for slow hosts

If your machine takes a long time to load the model, start the model first and then start the gateway:

```bash
pnpm llama:start
pnpm llama:status
OPENCLAW_SKIP_MANAGED_LLAMA=1 pnpm openclaw:local
```

Use this flow when you want to avoid the gateway waiting on model warm-up.

### Prefetch model artifacts

If you want to download the model before the first full startup:

```bash
pnpm llama:download
```

## Dashboard usage

After `pnpm openclaw:local`, open:

```text
http://127.0.0.1:18789/
```

If the dashboard shows `unauthorized: gateway token missing`:

```bash
pnpm openclaw dashboard
```

Or fetch the token directly:

```bash
pnpm openclaw config get gateway.auth.token
```

Paste the token into the `Gateway Token` field and connect.

## CLI usage

Direct local turn on this machine:

```bash
pnpm openclaw agent --local --agent main --message "Reply with exactly LOCALCLAW-OK"
```

Agent turn through the running gateway:

```bash
pnpm openclaw agent --agent main --message "Summarize the last message"
```

Inspect local model visibility:

```bash
pnpm openclaw models list --local
```

## Local runtime defaults

This fork currently defaults to:

- provider id: `llama-cpp`
- model id: `Qwen3.5-35B-A3B`
- model URL: `Qwen3.5-35B-A3B-Q4_K_S.gguf`
- multimodal projector: `mmproj-BF16.gguf`
- llama base URL: `http://127.0.0.1:32145/v1`
- gateway URL: `http://127.0.0.1:18789/`

## Configuration

By default, the active state directory is:

```text
~/.openclaw
```

The default config file path is:

```text
~/.openclaw/openclaw.json
```

Minimal example for tuning the local runtime:

```json
{
  "llama": {
    "server": {
      "ctxSize": 32768,
      "threads": 8,
      "gpuLayers": -1,
      "timeoutMs": 1800000
    }
  }
}
```

Useful tuning fields:

- `llama.server.ctxSize`
- `llama.server.threads`
- `llama.server.gpuLayers`
- `llama.server.timeoutMs`
- `llama.build.cmakeArgs`
- `llama.build.buildArgs`

## Troubleshooting

### Dashboard cannot connect

Check that the gateway is listening:

```bash
curl -I http://127.0.0.1:18789/
```

If auth is the issue, refresh the token flow:

```bash
pnpm openclaw dashboard
```

### `llama:start` times out even though logs say the server is listening

The common failure mode is that the readiness check cannot reach `http://127.0.0.1:32145/v1/models`, even though `llama-server` has already started.

Check the endpoint directly:

```bash
curl http://127.0.0.1:32145/v1/models
```

On some Linux hosts, proxy environment variables interfere with the local readiness check. Inspect them:

```bash
env | rg '^(HTTP|HTTPS|NO)_PROXY='
```

If needed, bypass the proxy for loopback:

```bash
NO_PROXY=127.0.0.1,localhost pnpm llama:start
```

Or:

```bash
unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy
export NO_PROXY=127.0.0.1,localhost
pnpm llama:start
```

### First startup is slow

That is expected on slower machines or large Linux deployments with the default model. Use staged startup:

```bash
pnpm llama:start
pnpm llama:status
OPENCLAW_SKIP_MANAGED_LLAMA=1 pnpm openclaw:local
```

### Stop the local services

Stop the foreground gateway with `Ctrl-C` in the terminal running `pnpm openclaw:local`.

Stop only the managed model runtime:

```bash
pnpm llama:stop
```

## Useful commands

```bash
pnpm build
pnpm openclaw:local
pnpm llama:download
pnpm llama:start
pnpm llama:status
pnpm llama:stop
pnpm openclaw dashboard
pnpm openclaw agent --local --agent main --message "Hello"
pnpm openclaw config get gateway.auth.token
```

## Development notes

- `pnpm build` builds the TypeScript project and the LocalClaw runtime path.
- `pnpm openclaw ...` runs the repo CLI entrypoints directly from this tree.
- `pnpm openclaw:local` is the preferred developer startup command for this fork.
- The default local-first path is designed around the vendored `llama.cpp` runtime instead of a cloud model provider.
