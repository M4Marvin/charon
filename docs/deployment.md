# Deployment: Docker image serving

## Uploaded images (avatars, backgrounds, personas)

Uploaded images are stored at `data/uploads/{avatars,backgrounds,personas}/` on disk (workspace-relative in dev, `/app/data/uploads/.../` in Docker). They are served via a Nitro API route at `/uploads/<type>/<uuid>.png` (see `src/routes/uploads/$type/$id.ts`).

This replaces the old `public/data/` static-serving approach, which failed in Docker because Nitro's static asset manifest is baked at **build time** — runtime writes to `public/` were invisible to the static handler (which reads from `.output/public/`).

### Docker persistence

The `v2app-data:/app/data` volume in `docker-compose.yml` covers `/app/data/`, which includes the SQLite DB (`/app/data/local.db`) and all uploaded images (`/app/data/uploads/`). No additional volume is needed.

### Migration

Existing images in `public/data/` are moved to `data/uploads/` and DB paths are updated by:

```
pnpm migrate:image-paths
```

The script is idempotent (safe to re-run). Run it once after deploying the new code.

## Historical (deprecated) approaches

These were documented as options before moving to the Nitro-route approach:

- **Option A (symlink):** Create a symlink `public/data` → `.output/public/data` in the Dockerfile. Worked but relied on a persistent volume at the symlink target.
- **Option B (write to `.output/public/data/`):** Changed server write paths to `.output/public/data/...`. Uploads survived rebuilds if a volume was mounted at `.output/public/data/`, otherwise they were wiped.
- **Option D (volume):** Paired a Docker volume with Option A or B.

None of these were chosen. The current Nitro-route approach is simpler: write to the already-persisted `data/` volume, serve via an API route that reads from disk directly.

## Quick diagnostics

On the server:

```bash
# Check uploaded files on disk
docker exec <container> ls -la /app/data/uploads/avatars/
docker exec <container> ls -la /app/data/uploads/backgrounds/

# Verify HTTP response (should be 200)
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/uploads/avatars/<uuid>.png
```
