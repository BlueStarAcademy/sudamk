# syntax=docker/dockerfile:1.6
# Next.js 풀스택 앱 Dockerfile
# Railway 배포용

FROM node:20-alpine AS base
WORKDIR /app
ENV NODE_ENV=production

# Install build dependencies
RUN apk add --no-cache python3 make g++

FROM base AS deps
# Install dependencies
RUN npm config set update-notifier false
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY app/package.json ./app/
COPY packages/database/package.json ./packages/database/
COPY packages/game-logic/package.json ./packages/game-logic/
COPY packages/shared/package.json ./packages/shared/

# Install pnpm
RUN npm install -g pnpm@8.10.0

# Install dependencies including devDependencies (TypeScript 등 빌드에 필요)
ENV NODE_ENV=development
RUN pnpm install --no-frozen-lockfile
ENV NODE_ENV=production

FROM base AS build
WORKDIR /app

# Install pnpm (needed for build commands)
RUN npm install -g pnpm@8.10.0

# Install Prisma CLI globally (needed for Prisma Client generation)
RUN npm install -g prisma@^6.19.0

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/app/node_modules ./app/node_modules
COPY --from=deps /app/packages ./packages

# Copy source code
COPY . .

# Ensure public directory exists for standalone copy step
RUN mkdir -p /app/app/public

# Generate Prisma Client
RUN pnpm --filter @sudam/database prisma:generate

# Build packages
RUN pnpm --filter @sudam/database build
RUN pnpm --filter @sudam/game-logic build
RUN pnpm --filter @sudam/shared build

# Build Next.js app
RUN pnpm --filter @sudam/app build

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=build /app/app/.next/standalone ./
COPY --from=build /app/app/.next/static ./app/.next/static
COPY --from=build /app/app/public ./app/public

# Copy packages
COPY --from=build /app/packages ./packages

# Set correct permissions
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "app/server.js"]

