---
title: 'drizzle-kit generate prompts interactively and fails without a TTY'
severity: 'minor'
---

## Expected Behavior

`pnpm run db:generate` generates a migration from the current `src/db/schema.ts` non-interactively.

## Current Behavior

Meta snapshots in `drizzle/meta/` stop at 0020 while `_journal.json` is at 0026 (migrations 0021-0026 were hand-written without snapshots). `db:generate` diffs the schema against the stale 0020 snapshot, sees unrelated drift from 0021-0026, hits `promptNamedWithSchemasConflict`, and dies in non-interactive shells (no TTY).

## Possible Solution

Either regenerate/refresh snapshots for 0021-0026, or accept hand-written migrations and document the flow (hand-written SQL + manual `_journal.json` entry — precedent: `0027_character_revisions.sql`; the test migrator and `db:migrate` only read the journal, so no snapshot is needed).

## Minimal Reproducible Example

Add any table to `src/db/schema.ts` and run `pnpm run db:generate` in a non-TTY shell.

## Context

Hit while adding the character revisions table on `feat/character-revisions`.
