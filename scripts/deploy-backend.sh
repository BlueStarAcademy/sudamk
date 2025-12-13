#!/bin/bash
# Backend 배포 스크립트
# Backend Deployment Script

set -e

echo "🚀 Starting backend deployment..."

# Prisma 클라이언트 생성
echo "📦 Generating Prisma client..."
pnpm --filter @sudam/database exec prisma generate

# 데이터베이스 마이그레이션
echo "🗄️  Running database migrations..."
pnpm --filter @sudam/database exec prisma migrate deploy

# 빌드
echo "🔨 Building backend..."
pnpm --filter @sudam/api build

# 시작
echo "✅ Starting backend server..."
cd apps/api && node dist/index.js

