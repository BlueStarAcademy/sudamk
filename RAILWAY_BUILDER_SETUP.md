# Railway 빌더 설정 가이드

## ⚠️ Dockerfile이 필요하지 않습니다!

이 프로젝트는 **Nixpacks** 빌더를 사용합니다. Dockerfile이 필요하지 않습니다.

## 🔧 Railway 빌더 설정 변경 방법

### 현재 문제
Railway 대시보드에서 "Dockerfile" 빌더가 선택되어 있으면 Dockerfile이 필요합니다. 하지만 우리 프로젝트는 Dockerfile이 없습니다.

### 해결 방법

#### 방법 1: Nixpacks 빌더로 변경 (권장)

1. **Railway 대시보드**에서 서비스 선택 (SUDAM Frontend)
2. **Settings** → **Build** 탭
3. **Builder** 드롭다운에서 **"Nixpacks"** 선택
4. 저장

이제 `railway.json` 파일이 자동으로 인식됩니다!

#### 방법 2: railway.json 파일 확인

`apps/web/railway.json` 파일이 있으면 Railway가 자동으로 인식합니다:
- Builder: NIXPACKS
- Build Command: 자동으로 사용
- Start Command: 자동으로 사용

## 📋 각 서비스별 설정

### Frontend (SUDAM Frontend)

**Builder**: Nixpacks  
**Build Command**: (railway.json에서 자동 사용)
```
pnpm install && pnpm --filter @sudam/database exec prisma generate && pnpm --filter @sudam/web build
```

**Start Command**: (railway.json에서 자동 사용)
```
cd apps/web && pnpm start
```

### Backend (SUDAM Backend)

**Builder**: Nixpacks  
**Build Command**: (railway.json에서 자동 사용)
```
pnpm install && pnpm --filter @sudam/database exec prisma generate && pnpm --filter @sudam/api build
```

**Start Command**: (railway.json에서 자동 사용)
```
cd apps/api && node dist/index.js
```

## ✅ 확인 방법

1. Railway 대시보드 → 서비스 → Settings → Build
2. Builder가 **"Nixpacks"**로 설정되어 있는지 확인
3. Build Command와 Start Command가 자동으로 채워져 있는지 확인

## 🚨 주의사항

- **Dockerfile Path는 비워두거나 무시하세요**
- Dockerfile 빌더를 사용하면 Dockerfile이 필요하지만, 우리는 사용하지 않습니다
- Nixpacks 빌더를 사용하면 `railway.json` 또는 `.nixpacks.toml`이 자동으로 인식됩니다

## 📝 railway.json 파일 위치

- Frontend: `apps/web/railway.json`
- Backend: `apps/api/railway.json`

이 파일들이 있으면 Railway가 자동으로 설정을 읽어옵니다!

---

**요약**: Builder를 "Dockerfile"에서 **"Nixpacks"**로 변경하세요! 🚀

