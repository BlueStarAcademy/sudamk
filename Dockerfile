# syntax=docker/dockerfile:1.6
# Next.js 풀스택 앱 Dockerfile
# Railway 배포용 - 프로젝트 루트용

FROM node:20-alpine AS base
WORKDIR /app
ENV NODE_ENV=production

# Install build dependencies and pnpm globally
RUN apk add --no-cache python3 make g++ && \
    npm install -g pnpm@8.10.0

FROM base AS deps
WORKDIR /app

# Copy workspace configuration files
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./

# Copy package.json files for all workspaces
COPY app/package.json ./app/
COPY packages/database/package.json ./packages/database/
COPY packages/game-logic/package.json ./packages/game-logic/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies including devDependencies (TypeScript 등 빌드에 필요)
# NODE_ENV를 unset하여 devDependencies도 설치되도록 함
ENV NODE_ENV=
RUN pnpm install --no-frozen-lockfile
ENV NODE_ENV=production

FROM base AS build
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/app/node_modules ./app/node_modules
COPY --from=deps /app/packages ./packages

# Copy all source code
COPY . .

# Install Prisma CLI globally for Prisma Client generation
RUN npm install -g prisma@^6.19.0

# Generate Prisma Client (packages/database 디렉토리에서 실행)
WORKDIR /app/packages/database
RUN prisma generate --schema ./schema.prisma

# Return to app root
WORKDIR /app

# Build packages in correct order
# @sudam/shared는 build 스크립트가 없으므로 건너뜀
# Note: Next.js는 webpack alias를 통해 소스 파일을 직접 사용하므로
# 패키지를 빌드할 필요는 없지만, 타입 체크를 위해 빌드함
RUN pnpm --filter @sudam/database build
RUN pnpm --filter @sudam/game-logic build

# Build Next.js app
# Next.js는 webpack alias를 통해 packages/*/src를 직접 참조함
RUN pnpm --filter @sudam/app build

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy built application from build stage
COPY --from=build /app/app/.next/standalone ./
COPY --from=build /app/app/.next/static ./app/.next/static
COPY --from=build /app/app/public ./app/public

# Copy built packages
COPY --from=build /app/packages ./packages

# Copy node_modules (Prisma Client 포함)
COPY --from=build /app/node_modules ./node_modules

# Set correct permissions
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "app/server.js"]
