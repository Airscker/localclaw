#!/usr/bin/env bash
set -euo pipefail

args=("$@")
if (( ${#args[@]} > 0 )) && [[ ${args[0]} == "--" ]]; then
  args=("${args[@]:1}")
fi

has_allow_unconfigured=0
if (( ${#args[@]} > 0 )); then
  for arg in "${args[@]}"; do
    if [[ $arg == "--allow-unconfigured" ]]; then
      has_allow_unconfigured=1
      break
    fi
  done
fi

launch_args=(gateway run)
if (( has_allow_unconfigured == 0 )); then
  launch_args+=(--allow-unconfigured)
fi
if (( ${#args[@]} > 0 )); then
  launch_args+=("${args[@]}")
fi

exec node scripts/run-node.mjs "${launch_args[@]}"
