---
title: 'Global Playwright expects a missing Chromium revision'
severity: 'minor'
---

## Expected Behavior
A fresh Playwright browser launch should use an installed Chromium revision.

## Current Behavior
The globally installed Playwright CLI (1.63.0) looks for `chromium_headless_shell-1243`, but this machine only has revisions 1234/1244, so a plain `chromium.launch()` fails.

## Possible Solution
Install the matching browser with `playwright install chromium`, or allow the verification script to pass the system Chromium `executablePath` (for example `/usr/bin/chromium`).

## Minimal Reproducible Example
`node -e "import('playwright').then(({chromium}) => chromium.launch())"` fails with `Executable doesn't exist ... chromium_headless_shell-1243`.

## Context
Encountered while running real-browser verification for the image optimizer; this is environment/tooling friction, not an application failure.
