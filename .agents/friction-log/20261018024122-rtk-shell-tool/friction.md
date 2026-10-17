---
title: 'rtk shell-tool filter falsely fails pnpm run lint by parsing oxlint output as ESLint JSON'
severity: 'minor'
---

### Expected Behavior

`pnpm run lint` (the documented lint gate in this repo) reports oxlint's real result: exit 0 with no findings.

### Current Behavior

Through the shell tool, the rtk filter intercepts `pnpm run lint`, tries to parse oxlint's output as ESLint JSON, prints `ESLint output (JSON parse failed: EOF while parsing a value at line 1 column 0)` and reports exit code 1, even though the underlying command exits 0.

### Possible Solution

Skip the ESLint output filter for oxlint-based lint scripts, or pass the real exit code through untouched when no JSON output is found.

### Minimal Reproducible Example

From the repo root: `pnpm run lint` (through the shell tool) → filter reports a JSON parse failure and exit 1. `rtk run pnpm run lint` → exit 0, no findings.

### Context

Running the required lint gate in charon turned a passing command into an apparent failure; the raw passthrough confirmed it passes. Related to 20260807010035-rtk-lint-alias (the `rtk lint` alias), but this is the unaliased `pnpm run lint` gate.
