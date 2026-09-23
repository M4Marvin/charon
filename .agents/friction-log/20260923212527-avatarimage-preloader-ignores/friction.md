---
title: 'AvatarImage preloader ignores srcset and fetches the default src'
severity: 'minor'
target: 'radix-ui/primitives'
---

## Expected Behavior

`AvatarImage` should use responsive image candidates (`srcSet`, `sizes`, and DPR) when preloading, so it does not fetch the default `src` before rendering the candidate selected by the browser.

## Current Behavior

`AvatarImage` creates `new Image()` and assigns only `image.src = src`. It ignores `srcSet` and `sizes` for its loading probe, then renders the actual `<img>` with those responsive attributes. On a high-DPR viewport this can fetch the default candidate and then a different responsive candidate.

## Possible Solution

Use the same candidate-selection mechanism for the loading probe and rendered image, or avoid a separate probe when a responsive image can report load/error directly to `Avatar.Root`.

## Minimal Reproducible Example

Render an `AvatarImage` with `src` set to a 48px WebP, `srcSet` containing 48/96/192px candidates, `sizes="48px"`, and a device pixel ratio of 2. Network tools show the 48px URL loads during the probe and the 192px URL loads afterward.

## Context

Charon uses responsive server-generated avatar variants. The extra request is small because the default candidate is 48px, but it is avoidable and makes responsive avatar behavior surprising.
