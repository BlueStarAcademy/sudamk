#!/bin/bash
# Frontend 배포 스크립트
# Frontend Deployment Script

set -e

echo "🚀 Starting frontend deployment..."

# Prisma 클라이언트 생성 (타입 참조용)
echo "📦 Generating Prisma client..."
pnpm --filter @sudam/database exec prisma generate

# 빌드
echo "🔨 Building frontend..."
pnpm --filter @sudam/web build

# 시작
echo "✅ Starting frontend server..."
cd apps/web && pnpm start

