---
title: 'vite.config silently ignores VITE_ALLOWED_HOSTS from .env.local'
severity: 'minor'
---

## Expected Behavior

`VITE_ALLOWED_HOSTS` placed in `.env.local` is read by `vite.config.ts`, so `pnpm dev:lan` populates `server.allowedHosts` and serves the listed hosts (e.g. `beast`).

## Current Behavior

`server.allowedHosts` stays empty. Requests with `Host: beast` return `403 Blocked request. This host is not allowed.` Only direct IP access works.

## Possible Solution

Read the file env explicitly in `vite.config.ts` with `loadEnv(mode, process.cwd(), "VITE_")` instead of `process.env`, because Vite evaluates an object config before loading `.env*` into `process.env`. Keep the object form since `vitest.config.ts` spreads the exported config.

## Minimal Reproducible Example

1. `printf "VITE_ALLOWED_HOSTS=beast\n" > .env.local`
2. `pnpm dev:lan`
3. `curl -H "Host: beast" http://127.0.0.1:3000/` returns `403` (expected `200`)

## Context

Both the comment in `vite.config.ts` and `.env.example` document `.env.local` as the supported way to set `VITE_ALLOWED_HOSTS`. Runtime server code does see `.env.local` (e.g. `TRUSTED_ORIGINS` works), so the gap is config-only and silent — no warning is emitted.
