# State machines, invariants, and transitions

This document maps the state machines that can affect persisted chat data or a
user-visible generation, lists the invariants the code depends on, and records
the reachable invalid states found while auditing them. It is the working record
for the fixes in the same change set: findings are grouped as `ISSUE-n`, and the
last section tracks what is fixed, verified, or knowingly left open.

Scope: the chat/generation path, the message tree, proposals, SSE delivery,
chat/first-run lifecycle, and the client run state. Derived caches (image
variants) and purely cosmetic UI state are listed in the inventory but not
audited in depth.

Evidence is from the working tree at commit `586454b` plus the changes described
below. Line references are to the final formatted files.

## Inventory

| Machine | Kind | Backing store | Definition |
|---|---|---|---|
| Generation job | explicit | `generation_jobs.status` | `src/db/schema.ts`, `src/db/repositories/generation.ts` |
| SSE delivery log | explicit, in-memory | `memoryStream` map | `@tanstack/ai` `stream-durability.ts`, used in `src/routes/api/generation/chat.ts` |
| Client generation run | explicit | React + Zustand | `src/features/chat/ui/hooks/use-generation-chat.ts`, `src/features/chat/ui/chat-store.ts` |
| Message tree / active path | implicit | `chat_messages` rows | `src/features/chat/tree/service.ts`, `src/lib/st-core/chat-tree/` |
| Proposal | explicit | `generation_proposals.status` | `src/features/generation/proposals.ts` |
| Chat lifecycle | implicit | `chats` + FK cascade | `src/server/fns/chats.ts`, `src/features/chat/tree/service.ts` |
| First-run / onboarding | explicit | `user` row, `user_settings.onboarding_completed_at` | `src/server/fns/setup.ts`, `src/db/repositories/onboarding.ts`, `src/features/onboarding/` |
| Character import | implicit | `characters`, `lorebooks`, disk | `src/server/services/character/importer.ts`, `src/routes/characters/new.tsx` |
| Settings save status | explicit UI | React context | `src/features/chat/ui/settings/save-status.tsx` |
| Rewrite dialog | explicit UI | React state | `src/features/chat/ui/components/message-rewrite-button.tsx` |
| Image cache | derived | disk + in-process maps | `src/server/image-optimizer.ts` (not audited in depth) |

## 1. Generation job (explicit)

### States

| Status | Meaning | Terminal |
|---|---|---|
| `queued` | Job row and placeholder committed; the browser has not connected yet. | no |
| `running` | A request holds the lease and is streaming from the provider. | no |
| `finalizing` | Declared in the schema/repository, **never written by any code path**. | (declared) |
| `succeeded` | Assistant text and job committed together. | yes |
| `failed` | A setup, provider, stream, or finalize error was recorded. | yes |
| `cancelled` | The user/client stopped the run before it completed. | yes |
| `expired` | A `queued` job exceeded its TTL or a `running` lease expired and a later prepare reclaimed the chat. | yes |

### Invariants

- **J1. One active job per chat.** `ACTIVE_STATUSES = queued, running,
  finalizing`; enforced by a partial unique index
  (`generation_jobs_active_chat_uq`) and by `createJobInTransaction`.
- **J2. The chat turn and its job commit together.** `prepareGeneration` opens
  one transaction that creates the job, appends the user/assistant rows, and
  records `placeholderLocalId`.
- **J3. A running job has a lease owner, an expiry, and an epoch.** `beginJob`
  sets all three; `finalizeJob` requires owner + epoch + `running|finalizing`.
- **J4. `succeeded` means the reply is in `chat_messages`.** `finalizeChat`
  updates the placeholder and finalizes the job in one transaction. It must not
  report success if the placeholder no longer exists or no longer belongs to the
  job.
- **J5. Failed/cancelled/expired cannot own a live placeholder.** The assistant
  row is an empty, non-final message; leaving it behind creates a permanent
  "Empty message" in the transcript.
- **J6. A terminal job is immutable.** No transition leaves
  `succeeded/failed/cancelled/expired`; `cancelJob` and `finalizeJob` both guard
  on active statuses.
- **J7. A stale `placeholderLocalId` is a historical pointer, not identity.**
  `localId` is allocated as `max(localId) + 1`, so deleting the current maximum
  reuses that number. Any consumer must also check
  `extra.generationJobId === job.id` before reading or writing that row.
- **J8. Without a lease, a failure may only fail a job that never started.**
  Otherwise a duplicate setup request can kill a run owned by another request.

### Transition table

| From | Event | Guard | To | Side effects |
|---|---|---|---|---|
| — | `prepareGeneration` | no active/stale job, or stale active expired first | `queued` | job row + user/assistant rows (or placeholder `0` for side paths) |
| `queued` | `beginJob` | status `queued` | `running` | `leaseOwner`, `leaseExpiresAt`, `leaseEpoch + 1`, `startedAt` |
| `running` | `beginJob` (takeover) | `leaseExpiresAt <= now` | `running` | new owner, `leaseEpoch + 1`; old stream loses on its next check/finalize |
| `queued` | stale check in `createJobInTransaction` | `createdAt + 2 min <= now` | `expired` | error `job_expired`, owner/expiry cleared, placeholder discarded |
| `running` | stale check in `createJobInTransaction` | `leaseExpiresAt ?? createdAt + 2 min <= now` | `expired` | same as above |
| `queued` | `cancelJob` | status `queued` | `cancelled` | terminal, placeholder discarded by `cancelGeneration` |
| `running` | `cancelJob` | status `running` | `cancelled` | same; finalize then fails its lease check |
| `running` | `finalizeJob` | owner + epoch match, status `running` | `succeeded` | usage/finish reason, terminal timestamps |
| `running` | `failJob` with owner | owner matches, active status | `failed` | error/usage, owner/expiry cleared, placeholder discarded |
| `queued` | `failJob` without owner | status `queued` only | `failed` | same |
| `queued|running|finalizing` | `failJob` without owner (old behaviour) | any active status | `failed` | **removed**; could fail another request's run |
| `finalizing` | any | — | — | unreachable today |

### Reachable invalid transitions

- **ISSUE-1 (fixed): failure paths leaked an empty assistant placeholder.**
  `prepareGeneration` writes `isStreaming: true` into the assistant row. A
  pre-stream error in `POST /api/generation/chat` (for example
  `ContextOverflowError` from `compilePrompt`, a provider URL error from
  `makeAdapter`, or a config row deleted between prepare and connect) called
  `failJob`, which only touched `generation_jobs`. The client then called
  `cancelGenerationFn`; `cancelJob` returned `false` for a `failed` job, so the
  old code deleted nothing. The result: every context-overflow/config failure
  left a blank assistant turn, and a later send appended after it. The same
  leak occurred for `RUN_ERROR`, incomplete streams, and jobs reclaimed as
  `expired`.
- **ISSUE-3 (fixed): finalize could succeed without its message, or write into
  a reused `localId`.** `updateMessage` never checked that a row changed. If a
  second tab deleted the streaming placeholder (the UI only blocks the tab that
  owns the run), `finalizeChat` updated zero rows and still marked the job
  `succeeded`, losing the reply. Because `localId` is reused, a later message
  could occupy the same id and be overwritten. `finalizeChat` now verifies the
  row exists, is an assistant row, and carries this job's
  `generationJobId`; cleanup does the same before deleting.
- **ISSUE-4 (fixed, race): an ownerless `failJob` could kill a running job.**
  The route catch called `failJob({ jobId })` without a lease owner. A duplicate
  setup POST (or a setup error in a second request for the same job) could reach
  that catch while another request owned the job, and the old no-owner `WHERE`
  accepted `running`, so the duplicate failed the live run. The no-owner form is
  now restricted to `queued`, and the route passes the owner once it has one.
- **`finalizing` is unreachable.** No setter writes it. It remains in the DB
  enum and in two `WHERE` clauses; it is documented here rather than removed to
  avoid a schema migration for a dead value.
- **`running` with an expired lease is a valid transient state.** The lease
  protocol allows it; a later `beginJob` takeover or `createJobInTransaction`
  expiry resolves it. Callers must not assume a `running` row is live.

### Retry and concurrency notes

- The provider adapter retries internally (`maxRetries: 2`); those retries stay
  inside one `generation_jobs` row and one lease. They cannot create a second
  job.
- A duplicate stream POST cannot start a second provider call: the second
  `beginJob` fails its status/lease guard. The fix in ISSUE-4 ensures that
  failure cannot mark the first run `failed`.
- Cancelling while finalize commits is serialized by SQLite: if finalize wins,
  `cancelJob` returns `false` and cleanup leaves the reply; if cancel wins,
  finalize's lease check fails and the transaction rolls back.
- A detached producer continues to run after the browser disconnects (see §2).
  When the user presses Stop, the cancel RPC and the producer race; whichever
  reaches the job first wins. No path can both persist a reply and delete it.

## 2. SSE delivery log (explicit, in-memory)

`memoryStream(request)` is a process-global append-only log keyed by a delivery
run id. The route returns a replay response whenever `Last-Event-ID`/`?offset`
is present; the input `stream` is never iterated on a resume.

### States

| State | Meaning | Terminal |
|---|---|---|
| absent | No log exists for this delivery run id. | — |
| open | Producer appends chunks; readers may attach. | no |
| completed | A terminal `RUN_FINISHED`/`RUN_ERROR` or an explicit close was appended. | yes |
| evicted | Completed log older than 5 minutes, or dropped by the 1024-run cap. | yes |

### Provider stream

The iterable feeding the log is `AI.chat` from `@tanstack/ai-effect`, built in
`src/features/generation/chat-stream.ts`. Two consequences for this machine:

- A provider/stream failure is `AIError`; the finalizer records it as
  `provider_error` and closes the log with a terminal event. A tool failure is
  a tool result for the model, not a stream failure.
- `AI.chat` aborts the provider when its Effect stream is finalized. The route's
  encoder deliberately detaches on browser disconnect and keeps consuming, so
  the run continues until the job lease/finalize machine ends it. The Stop RPC
  remains the explicit interrupt path.

### Invariants

- **D1. Append before forward.** A reconnecting client can always replay what
  it already saw.
- **D2. Offsets are unique and monotonic per run.** The adapter validates this.
- **D3. Resume never re-invokes the provider.** `durableStreamSource` replays
  from the log only.
- **D4. Active logs are never evicted.** Only completed logs are swept.
- **D5. A fresh response starts with a synthetic `run.accepted` chunk**, so a
  join has data before the provider produces its first token.

### Reachable invalid states

- **ISSUE-6 (open, known limitation): a page reload loses the run.** The client
  has no active-job lookup; `useGenerationChat` only knows the job id in memory.
  Reloading after `prepare` leaves `activePlaceholderId` null, so the persisted
  empty placeholder renders as "Empty message" even though the server-side run
  continues and finalizes. The reply appears only after the next message query
  refetch. Data is correct; the live/UI state is stale. Fixing this needs an
  active-job endpoint and reattach flow, not a state-machine patch.
- **ISSUE-7 (accepted): a detached producer can keep calling the provider for up
  to one heartbeat interval (30 s) after a cancel.** `finalizeOnTerminal` checks
  `leaseLost` on each chunk; the heartbeat only flips it every 30 s. The writes
  are guarded, so this wastes tokens, not data.
- The log is process-local and has a five-minute completed-log grace. A server
  restart or a multi-process deployment makes resume fail loudly; the client
  then shows an error and cancels/refetches. This is documented single-process
  behaviour, not a correctness bug.
- A resume replayed after the job was cancelled can still deliver pre-cancel
  chunks. The job is already terminal; no new reply is written.

## 3. Client generation run (explicit + implicit)

### States

`StreamStatus = "idle" | "streaming" | "finalizing"`.

| State setter | When |
|---|---|
| `idle` | Initial, finish, error, stop, unmount, chat change |
| `streaming` | `start()` before prepare |
| `finalizing` | **never set**; the composer prop exists but is dead |

Companion state: `activePlaceholderId` (global Zustand), `pendingSend`
(`{chatId, content}`), `ownerChatId`, `streamTextRef`, `runTokenRef`, and now
`runActiveRef`.

### Invariants

- **C1. Only the owning chat may render a live run.** `activePlaceholderId` is
  scoped through `ownerChatId === chatId`.
- **C2. A terminal callback tears down only its own run.** The overlay clears
  only when the stored placeholder id matches.
- **C3. A prepared job is never orphaned by a stale prepare.** `runTokenRef` is
  bumped by stop/unmount/chat change; a prepare that resolves later cancels its
  job instead of starting it.
- **C4. One `start()` at a time per hook.** State updates are asynchronous, so
  the guard is the synchronous `runActiveRef`, not `status`.
- **C5. Cancellation is best-effort.** A failed cancel RPC must not leave the
  local UI stuck; `teardown` resets state immediately and refreshes the query.

### Reachable invalid transitions

- **ISSUE-5 (fixed): a same-tick second `start()` cancelled the first run.**
  `start()` only bumped the token; the second call's `prepareGeneration` hit the
  one-active-job gate and its catch called `teardown({cancel:true})` with the
  first job in `jobIdRef`, cancelling the run the user just started. The UI
  normally blocks this through `isStreaming`, but a programmatic/double event
  could reach it. `runActiveRef` now makes the second call a no-op.
- **Dead `finalizing` state.** It is never entered; the composer's "Finishing
  generation…" branch cannot render. Documented, not removed.
- Late chunks from an aborted run can still append to `streamTextRef` until the
  transport stops. The final server snapshot wins on `onFinish`/refetch, so this
  is display-only. No fix yet.

## 4. Message tree and active path (implicit)

### States

Each row is `{chatId, localId, parentLocalId, children[], selectedChildLocalId,
role, content, extra}`.

| Node state | Meaning |
|---|---|
| root | `localId = 0`, `parentLocalId = null`, role `system`, hidden |
| child | parent exists; listed in the parent's `children` |
| selected child | the one entry in `children` named by `selectedChildLocalId` |
| leaf | `selectedChildLocalId = null` or no `children` |
| deleted | row removed; ancestors' `children`/selection updated |

`extra.rev` and `extra.contentHash` implement compare-and-set for edit/rewrite;
`extra.isStreaming` and `extra.generationJobId` identify a live placeholder.

### Invariants

- **T1. Exactly one root per chat**, and it is never edited or deleted.
- **T2. Every non-root `parentLocalId` resolves** to a message in the same chat.
- **T3. Every id in `children` resolves, with no duplicates.**
- **T4. `selectedChildLocalId` is null or present in `children`.**
- **T5. The selected-child chain is acyclic**; the active path is the chain from
  root to the deepest selected leaf, with the system root filtered from the UI.
- **T6. `localId` is unique per chat** (primary key `(chat_id, local_id)`);
  allocation is `max + 1`.
- **T7. A multi-row mutation is atomic.** Parent selection and child insertion
  or subtree deletion must commit or roll back together. A crash between the
  writes must not leave a dangling child id.
- **T8. Chat creation writes chat + root + every greeting atomically.**
- **T9. A live job's placeholder belongs to that job** and must be checked by
  `extra.generationJobId`, because T6 allows id reuse after deletion.

### Transition table

| Operation | Reads | Writes | Guard | Result |
|---|---|---|---|---|
| create chat | character | `chats`, root, greetings | at least one greeting | root selects greeting 1 |
| send | tree | user + assistant placeholder + job | one active job | placeholder selected |
| regenerate | target node | sibling assistant placeholder + job | target is assistant, not root | sibling selected |
| continue (assistant leaf) | active leaf | sibling assistant placeholder + job | leaf ≠ root | sibling selected |
| continue (user leaf) | active leaf | child assistant placeholder + job | leaf ≠ root | child selected |
| swipe | tree | parent selection | target/sibling exist | selected sibling; optionally creates one |
| edit | target | `content`, `extra.rev + 1`, `contentHash` | target ≠ root | content changed |
| delete | tree | parent selection + subtree rows | target ≠ root | branch removed, parent reselects |
| rewrite accept | target + proposal | `content`, `extra.rev + 1`, `extra.contentHash` | pending, base rev/hash match | proposal accepted |
| finalize | job + placeholder | placeholder content/extra + job | owner/epoch + placeholder identity | job succeeded |
| cancel/expire/fail cleanup | job + placeholder | placeholder branch + job | job terminal and row is unused + owned by job | placeholder removed |

### Reachable invalid states

- **ISSUE-2 (fixed, high): multi-write tree mutations were not atomic.**
  `createChat`, `swipe` (when it creates a sibling), and `deleteBranch` read the
  tree, updated a parent, then inserted/deleted rows in separate statements.
  A failure between the writes—or two concurrent requests on different
  branches—could persist `selectedChildLocalId`/`children` entries that do not
  exist. `getActiveLeafId` returns the missing id and `getActivePath` returns
  `[]`, so the chat appears empty. The live chat-creation path in
  `src/server/fns/chats.ts` duplicated the tree logic and was also
  non-transactional. All public multi-write tree operations now run in
  `db.transaction`; the live create path calls the tested tree service instead
  of reimplementing it.
- **ISSUE-3 (fixed): a deleted placeholder could be reused.** See §1. The
  `localId` reuse rule makes a stale `placeholderLocalId` dangerous; cleanup and
  finalize now check job identity before touching the row.
- A terminal job row still stores its historical `placeholderLocalId`.
  Cleanup and finalize check `extra.generationJobId` before touching the row;
  no other code may treat the column as message identity. It is retained for
  diagnostics.
- Deleting the only greeting leaves the root with no children. This is valid:
  `getActiveLeafId` returns the root (0), and `send` appends a user turn under
  it. Verified by the tree tests.
- Network-level concurrent writes across processes still rely on SQLite's write
  lock; a losing request surfaces an error and the UI refetches. No partial tree
  is committed after the transaction fix.

## 5. Proposals (explicit)

### States

`pending → accepted` or `pending → rejected`; `accepted`/`rejected` are
terminal. `resolvedAt` is set with the status.

### Invariants

- **P1. Resolution is compare-and-set.** `resolveProposal` only updates a
  `pending` row; a second accept/deny cannot overwrite the first.
- **P2. Rewrite acceptance is compare-and-set on the target.**
  `baseRev` and/or `baseHash` must match the current message; `editMessage` and
  accepted rewrites bump `rev` and `contentHash`.
- **P3. A proposal never mutates a message before acceptance.** Impersonate,
  image, and transform results are composer drafts; they are recorded as
  accepted by the runner and never written to the tree.
- **P4. Cascade cleanup.** Deleting a chat or job removes its proposals.

### Reachable invalid states

- **ISSUE-8 (open, low): abandoned pending rewrites accumulate.** Closing the
  rewrite dialog after generating, without accepting or denying, leaves a
  `pending` row forever. It is invisible and harmless, but there is no TTL or
  sweep.
- **ISSUE-9 (open, low): `acceptProposal` does not require the job to be
  `succeeded`.** The runner creates the proposal before finalizing the job; if
  finalize fails after proposal creation, a pending row remains. The UI never
  receives that proposal id (the RPC throws), so this is only reachable by a
  direct API call. The invariant is documented; no fix applied because every
  normal path finalizes first.
- Two concurrent accepts: one wins; the loser gets "Proposal changed" or
  "no longer pending". Safe.
- Deny after accept returns `{ok: true}` without changing the accepted status.
  Idempotent, not a state corruption.

## 6. Chat lifecycle and deletion (implicit)

- **Created → active → deleted.** There is no soft-delete or restore state.
- **L1. Delete cascades.** `chat_messages`, `generation_jobs`,
  `generation_proposals` have `ON DELETE cascade`.
- **L2. A producer on a deleted chat cannot resurrect rows.** `finalizeChat`
  requires the job; the job is gone, so the transaction throws. Heartbeats
  return `false`, and the next stream check raises `LeaseLostError`.
- **L3. The chat list delete is not blocked by a run in another tab.** This is
  allowed; L2 makes it safe.
- A character delete cascades its chats via the same FK chain.

## 7. First-run and onboarding (explicit conditions)

### States

| State | Condition |
|---|---|
| setup required | no `user` row |
| signed in, onboarding incomplete | `user_settings.onboarding_completed_at IS NULL` |
| onboarding complete | timestamp set; provider and character existed at completion time |
| finished/degraded | completed, but provider/character may later be deleted or misconfigured |

### Invariants

- **O1. At most one account.** `single_account_admission` is a SQLite
  `BEFORE INSERT` trigger that aborts when a user already exists. This is the
  real guard; the better-auth hook is a friendlier duplicate.
- **O2. Setup is closed once an account exists.** The `/setup` loader redirects
  to `/signin`.
- **O3. Completion requires a provider row and a character row.**
- **O4. Completion is monotonic.** No code clears `onboarding_completed_at`.
- **O5. The gate only checks the timestamp.** Deleting the provider or all
  characters later leaves onboarding "complete"; this is deliberate
  (settings can be repaired without re-running onboarding), but chat then fails
  with `ConfigError` instead of a setup prompt. This is the known onboarding
  gap in `CONTRIBUTING.md` ("test the provider connection before saving it").

### Reachable invalid states

- Completing while another request deletes the last provider/character cannot
  interleave on the single Node thread: the check and write are synchronous. A
  multi-process deployment would still serialize on SQLite's write lock.
- A provider row can exist without a resolvable model, so onboarding can
  complete into a chat that immediately returns `ConfigError`. This is a product
  gap, not a state-machine violation; listed as open in `CONTRIBUTING.md`.

## 8. Secondary UI machines (brief)

- **Settings save status**: `idle → saving → saved|error`, with `saved` decaying
  after 2.4 s and stale successes cleared after 5 s. Reports are scoped by the
  active section, so a previous section cannot leak a status into the next.
  Error → Retry reports the same mutation. No persisted state.
- **Rewrite dialog**: `idle → running → idle` (with proposal) → `accepting` or
  `denying` → closed. Closing is blocked while busy. The proposal row is the
  source of truth; abandoning the dialog is ISSUE-8.
- **Character import**: `pick → preview → imported|error`, with a
  `processingRef` synchronous re-entry guard. Card write + DB row are
  compensated on failure; the embedded lorebook is best-effort and may be
  partial if its own writes fail (reported through `entriesSkipped`). No
  user-visible stuck state found.
- **Image cache**: source → cached variants → invalidated; in-flight transforms
  are deduplicated. Derived data only; a cache miss is always safe. Not audited
  further.

## Findings and fix groups

Priority is by user-visible impact and reachability. "Fixed" means the change is
in this working tree with a regression test.

| Issue | Severity | Status | Summary |
|---|---|---|---|
| ISSUE-1 | High | Fixed | Failed/cancelled/expired jobs leaked an empty assistant placeholder; context-overflow and config failures were the common trigger. |
| ISSUE-2 | High | Fixed | Multi-write tree operations and live chat creation were not atomic; a partial write or race could empty the active path. |
| ISSUE-3 | Medium | Fixed | Finalize could mark a job `succeeded` with no message, or overwrite an unrelated row that reused the placeholder's `localId`. |
| ISSUE-4 | Medium | Fixed | Ownerless `failJob` could fail another request's running job on a duplicate setup POST. |
| ISSUE-5 | Low | Fixed | A same-tick second client `start()` cancelled the first run. |
| ISSUE-6 | Medium | Open | Reloading during a run does not reattach; the server finishes correctly but the UI shows an empty placeholder until the next refetch. |
| ISSUE-7 | Low | Accepted | A cancelled run's detached producer can call the provider for up to 30 s after cancel. |
| ISSUE-8 | Low | Open | Pending rewrite proposals accumulate when the dialog is closed without resolving. |
| ISSUE-9 | Low | Open | A pending proposal can be accepted directly even if its job never succeeded. |
| — | Low | Accepted | `finalizing` is a dead state in the DB enum and client union. |

### ISSUE-1 — placeholder cleanup

- Evidence: `prepareGeneration` writes the empty assistant row
  (`src/features/generation/prepare.ts:151`); `failJob` only
  updated `generation_jobs`; `cancelGenerationFn` deleted the branch only when
  `cancelJob` returned true, which is false for a failed job. `compilePrompt`
  throws `ContextOverflowError` after prepare, so this was reachable on ordinary
  too-long chats.
- Fix: `discardUnfinishedPlaceholder`, `failJobAndDiscardPlaceholder`, and
  `cancelGeneration` in `src/features/generation/cleanup.ts`; all route failure
  paths, the stream finalizer, cancel RPC, and stale expiry use them. Cleanup
  verifies job id, assistant role, empty content, no children, and that the
  job status is `cancelled`, `failed`, or `expired` before deleting.
- Tests: `src/features/generation/cleanup.test.ts`,
  `src/features/generation/prepare.test.ts` (expired queued job removes the old
  placeholder; deleted placeholder cannot finalize).

### ISSUE-2 — atomic tree writes

- Evidence: `createChat`, `swipe` with `createIfMissing`, and `deleteBranch`
  performed parent update and row insert/delete as separate statements. The live
  UI create path in `src/server/fns/chats.ts` duplicated the tree writes. A
  failure between statements left `selectedChildLocalId` pointing at a missing
  row; `getActiveLeafId` returns it and `getActivePath` returns `[]`.
- Fix: public multi-write tree operations run in `db.transaction`
  (`src/features/chat/tree/service.ts`); the live create path calls the service
  instead of duplicating it (`src/server/fns/chats.ts`). Nested calls become
  SQLite savepoints.
- Tests: trigger-backed rollback tests in `src/features/chat/tree/service.test.ts`
  for partial chat creation, sibling creation, and branch deletion.

### ISSUE-3 — finalize identity

- Evidence: `updateMessage` returned `void`; `finalizeChat` then called
  `finalizeJob` unconditionally. Deleting the placeholder from another tab made
  the update a no-op and still produced `succeeded`.
- Fix: `finalizeChat` checks row existence, role, and `extra.generationJobId`
  before updating; mismatch throws and rolls the transaction back.
- Test: "refuses to finalize into a placeholder that was deleted" in
  `src/features/generation/prepare.test.ts`.

### ISSUE-4 — ownerless failure

- Evidence: the route's catch called `failJob({jobId})`; the old no-owner
  `WHERE` included `running`. A second setup request that lost `beginJob`'s
  lease race would then fail the first request's run.
- Fix: no-owner `failJob` only matches `queued`; the route records the owner
  after `beginJob` and passes it on later setup errors.
- Test: "does not let an ownerless failure kill another request's running job"
  in `src/features/generation/cleanup.test.ts`.

### ISSUE-5 — client start guard

- Evidence: `start()` bumped the token but did not guard re-entry. A second
  call's busy error ran `teardown({cancel:true})` while `jobIdRef` held the
  first job.
- Fix: synchronous `runActiveRef` cleared by `resetRunState`.
- Test: "ignores a second start while the first prepare is in flight" in
  `src/features/chat/ui/hooks/use-generation-chat.test.tsx`.

## Residual risks

- `src/lib/st-core/` was not modified (project rule: do not edit without
  permission). The app now prevents dangling writes, but existing databases are
  not repaired automatically. A chat with an already-dangling selection will
  still render an empty active path; deleting the bad branch is the manual
  recovery.
- SQLite is the serialization point. Multi-process deployments still work for
  writes (file lock), but the SSE delivery log is process-local, so resume can
  fail after restart or on another process. This is by design for the
  single-process install.
- The job table retains historical `placeholderLocalId` values in terminal
  rows. Do not treat them as live references; check `generation_job_id` in the
  message `extra`.
- `failJob` with an owner checks the owner but not the lease epoch. Owner values
  are fresh UUIDs per stream, so no current caller can collide; adding the epoch
  would be defense in depth.
- Job cancellation and proposal resolution are authenticated but not
  user-scoped because the database is single-user (upstream enforcement is the
  single-account trigger).

## Verification

Commands run after the fixes (all locally; no GitHub automation):

```bash
pnpm exec tsc --noEmit
pnpm run lint
pnpm run test
pnpm run build
```

Result: typecheck clean; `oxlint src` 0 warnings / 0 errors; the full Vitest
suite passes (87 files, 853 tests) including the new tests listed above; the
client, SSR and Nitro production build succeeds.

## Change log

- Added `src/features/generation/cleanup.ts` + tests: placeholder discard/fail/
  cancel, identity checks, ownerless-failure guard.
- Job repo: stale expiry returns the expired job; no-owner `failJob` restricted
  to `queued`.
- Prepare: discards an expired job's placeholder before appending the new turn.
- Finalize: refuses to write without the original placeholder row.
- Route: uses cleanup helper on every failure; tracks and passes the lease
  owner on setup errors.
- Tree service: all multi-write operations transactional; live chat creation
  unified on the service; rollback tests.
- Client hook: synchronous re-entry guard + test.
- Provider stream/tools: TanStack AI 1.2 + `@tanstack/ai-effect` (`AI.chat`,
  `AI.serverTool`, `AI.toolSchema`, `ReadToolRuntime` Layer); strict tool
  schemas and a tool-call integration test.
- This document.
