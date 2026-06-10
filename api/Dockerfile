# ---------- Build stage ----------
FROM node:22-alpine AS builder
WORKDIR /app

# OpenSSL must be present so Prisma generates the correct musl/openssl-3 engine.
RUN apk add --no-cache openssl

# Install dependencies (cached unless package files change).
COPY package*.json ./
RUN npm ci

# Generate the Prisma client, then compile TypeScript.
COPY prisma ./prisma
RUN npx prisma generate
COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npm run build

# Compile the seed script to plain JS so the runtime needs no ts-node.
RUN npx tsc -p prisma/tsconfig.seed.json

# Drop dev dependencies for a lean runtime image (prisma CLI is a prod dep).
RUN npm prune --omit=dev

# ---------- Runtime stage ----------
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# OpenSSL is required by the Prisma query engine on Alpine.
RUN apk add --no-cache openssl

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY package*.json ./
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
