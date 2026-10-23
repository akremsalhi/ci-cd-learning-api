# syntax=docker/dockerfile:1

# 1. Install every dependency (including dev tools) from the lockfile.
FROM docker.io/library/node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# 2. Compile TypeScript to JavaScript.
FROM deps AS build
COPY nest-cli.json tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

# 3. Keep only the runtime: production dependencies and compiled code.
FROM docker.io/library/node:22-bookworm-slim AS production
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist

# The official Node image already contains an unprivileged "node" user.
USER node

EXPOSE 3000
CMD ["node", "dist/main.js"]
