# Deployment: Docker image serving

## Uploaded images (avatars, backgrounds, personas)

Uploaded images are stored at `data/uploads/{avatars,backgrounds,personas}/` on disk (workspace-relative in dev, `/app/data/uploads/.../` in Docker). They are served through authenticated entity routes such as `/api/characters/<id>/avatar`, `/api/backgrounds/<id>/image`, and `/api/personas/<id>/icon`.

This replaces the old `public/data/` static-serving approach, which failed in Docker because Nitro's static asset manifest is baked at **build time** — runtime writes to `public/` were invisible to the static handler (which reads from `.output/public/`).

The Vite dev server denies direct requests to `data/`, `public/data/`,
`public/uploads/`, and their `/@fs/` equivalents. Private images are therefore
only reachable through the authenticated entity routes, in both development and
production.

### Docker persistence

The `charon-data:/app/data` volume in `docker-compose.yml` covers `/app/data/`, which includes the SQLite DB (`/app/data/local.db`) and all uploaded images (`/app/data/uploads/`). No additional volume is needed.

### Migration

New imports read from `data/import/` and write uploaded images directly to
`data/uploads/`. Both directories are private: they are excluded from the
Docker build context and denied by the Vite dev server.

For installations that still have data under the old `public/data/` path, run
this from the host checkout (the migration tooling is not included in the
runtime container):

```
pnpm run prepare:migration
pnpm run migrate:image-paths
```

`prepare:migration` atomically moves `public/data/` to `data/import/` when the
target does not exist. If both directories exist, it stops and asks for a manual
merge rather than overwriting anything.

`migrate:image-paths` verifies and copies files to `data/uploads/`, updates DB
paths, and then removes legacy files that are no longer referenced. It is
idempotent (safe to re-run).

## Historical (deprecated) approaches

These were documented as options before moving to the API-route approach:

- **Option A (symlink):** Create a symlink `public/data` → `.output/public/data` in the Dockerfile. Worked but relied on a persistent volume at the symlink target.
- **Option B (write to `.output/public/data/`):** Changed server write paths to `.output/public/data/...`. Uploads survived rebuilds if a volume was mounted at `.output/public/data/`, otherwise they were wiped.
- **Option D (volume):** Paired a Docker volume with Option A or B.

None of these were chosen. The current API-route approach is simpler: write to the already-persisted `data/` volume and serve through authenticated entity routes that read from disk directly.

## Quick diagnostics

On the server:

```bash
# Check uploaded files on disk
docker exec <container> ls -la /app/data/uploads/avatars/
docker exec <container> ls -la /app/data/uploads/backgrounds/

# Unauthenticated API requests must be rejected (401)
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/characters/<character-id>/avatar

# With an authenticated browser session, the same route should return 200
# (use the browser's authenticated request or a session cookie).
```
