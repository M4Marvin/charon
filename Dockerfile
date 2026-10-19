# syntax=docker/dockerfile:1.9
# Build stage: compile the app once, with native build tools available.
FROM node:22-slim AS build
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches ./patches
RUN pnpm install --frozen-lockfile
COPY tsconfig.json tsr.config.json vite.config.ts ./
COPY scripts/vite-dev-policy.ts ./scripts/vite-dev-policy.ts
COPY src ./src
COPY static ./static
COPY drizzle ./drizzle
RUN pnpm run build

# Runtime stage: no compilers, no dev dependencies, non-root.
FROM node:22-slim AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    CHARON_HOST=0.0.0.0 \
    CHARON_DATA_DIR=/app/data
WORKDIR /app
COPY --chown=node:node --from=build /app/.output ./.output
COPY --chown=node:node --from=build /app/drizzle ./drizzle
COPY --chown=node:node bin ./bin
COPY --chown=node:node LICENSE NOTICE README.md ./
RUN mkdir -p /app/data && chown node:node /app/data
USER node
VOLUME ["/app/data"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/up').then(async r=>process.exit(r.ok&&(await r.json()).status==='ok'?0:1)).catch(()=>process.exit(1))"
CMD ["node", "bin/charon.mjs", "serve"]
