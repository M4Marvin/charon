FROM node:22-slim AS build
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build

FROM node:22-slim
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
RUN cp -r dist/client public
ENV DATABASE_URL=/app/data/local.db
ENV PORT=3000
EXPOSE 3000
CMD ["./node_modules/.bin/srvx", "--prod", "dist/server/server.js"]
