# LocalClaw

LocalClaw is a local-first personal AI assistant stack built to run on your own machine. It starts a local gateway and keeps the default path focused on self-hosted inference instead of paid cloud usage.

Repo: `https://github.com/Airscker/localclaw.git`

Important compatibility note: the CLI and state paths still use the existing `openclaw` command and `~/.openclaw` directory. This README uses the LocalClaw name for the product, but the actual commands you run are the current repo commands.

## Purpose

LocalClaw is aimed at people who want:

- a personal assistant stack that runs locally
- a default local AI runtime instead of external API dependence
- a practical self-hosted workflow with one main startup command
- lower ongoing cost for day-to-day use

## Benefits

Compared with the upstream cloud-first usage path, LocalClaw currently emphasizes:

- `0` model token fee for the default local workflow
- no required cloud LLM API key for the main setup path
- local control over your deployment and startup flow
- a simple self-hosted path instead of requiring provider setup first

## What LocalClaw does

- Starts the local gateway with `pnpm openclaw:local`.
- Works without a cloud LLM API key for the default local path.
- Provides a local dashboard and CLI workflow for daily use.

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
- enough free disk space for the local runtime files and build output

## Recommended device configs

These are practical recommendations for the default LocalClaw model profile in this repo.

| Profile              | Recommendation                                            | Notes                                                                 |
| -------------------- | --------------------------------------------------------- | --------------------------------------------------------------------- |
| macOS, best overall  | Apple Silicon with `24 GB+` unified memory              | Best fit for the default local-first workflow.                        |
| Linux, GPU-backed    | NVIDIA GPU with `12 GB+` VRAM and `64 GB+` system RAM | Best choice for faster cold starts and response times on Linux.       |
| Linux, mixed CPU/GPU | NVIDIA GPU with `12 GB+` VRAM and `32 GB+` system RAM | Usable, though startup and reply speed can vary.                      |
| CPU-only             | `32 GB+` RAM strongly recommended                       | Supported for experimentation, but startup and inference can be slow. |

If your machine is below those profiles, LocalClaw can still build, but startup and response speed may be slower.

## Installation and local deployment

### Unified startup

This is the default path:

```bash
pnpm openclaw:local
```

That starts the standard LocalClaw service stack.

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

## Configuration

By default, the active state directory is:

```text
~/.openclaw
```

The default config file path is:

```text
~/.openclaw/openclaw.json
```

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

### First startup is slow

That is expected on slower machines or large Linux deployments. Let the first startup finish and then retry if needed.

### Stop the local services

Stop the foreground gateway with `Ctrl-C` in the terminal running `pnpm openclaw:local`.

## Useful commands

```bash
pnpm build
pnpm openclaw:local
pnpm openclaw dashboard
pnpm openclaw agent --local --agent main --message "Hello"
pnpm openclaw config get gateway.auth.token
```

## Development notes

- `pnpm build` builds the TypeScript project for local use.
- `pnpm openclaw ...` runs the repo CLI entrypoints directly from this tree.
- `pnpm openclaw:local` is the preferred developer startup command for this project.
