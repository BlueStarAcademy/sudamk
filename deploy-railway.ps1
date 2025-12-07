# Railway 배포 스크립트 (PowerShell)
# 3개의 서비스를 순차적으로 배포합니다

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Railway 배포 시작" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Railway 로그인 확인
Write-Host "[1/5] Railway 로그인 확인 중..." -ForegroundColor Yellow
$loginCheck = railway whoami 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Railway에 로그인되어 있지 않습니다. 로그인을 진행합니다..." -ForegroundColor Yellow
    railway login
    if ($LASTEXITCODE -ne 0) {
        Write-Host "로그인 실패. Railway CLI를 확인해주세요." -ForegroundColor Red
        exit 1
    }
}
Write-Host "로그인 확인 완료" -ForegroundColor Green
Write-Host ""

# 프로젝트 연결 확인
Write-Host "[2/5] Railway 프로젝트 연결 확인 중..." -ForegroundColor Yellow
$projectCheck = railway status 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Railway 프로젝트가 연결되어 있지 않습니다." -ForegroundColor Yellow
    Write-Host "Railway 웹 대시보드에서 프로젝트를 생성하고, 다음 명령어로 연결하세요:" -ForegroundColor Yellow
    Write-Host "  railway link" -ForegroundColor Cyan
    exit 1
}
Write-Host "프로젝트 연결 확인 완료" -ForegroundColor Green
Write-Host ""

# 배포 순서 안내
Write-Host "[3/5] 배포 순서 안내" -ForegroundColor Yellow
Write-Host "권장 배포 순서:" -ForegroundColor Cyan
Write-Host "  1. KataGo 서비스 (가장 독립적)" -ForegroundColor White
Write-Host "  2. Backend 서비스 (KataGo URL 필요)" -ForegroundColor White
Write-Host "  3. Frontend 서비스 (Backend URL 필요)" -ForegroundColor White
Write-Host ""

# 사용자 확인
$continue = Read-Host "배포를 시작하시겠습니까? (y/n)"
if ($continue -ne "y" -and $continue -ne "Y") {
    Write-Host "배포가 취소되었습니다." -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "배포 방법 선택" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "1. Railway 웹 대시보드 사용 (권장)" -ForegroundColor White
Write-Host "2. Railway CLI 사용" -ForegroundColor White
Write-Host ""

$method = Read-Host "방법을 선택하세요 (1 또는 2)"

if ($method -eq "1") {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Railway 웹 대시보드 배포 가이드" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "1. Railway 대시보드 열기: https://railway.app" -ForegroundColor Yellow
    Write-Host "2. 프로젝트 내에서 3개의 서비스를 생성하세요:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "   [KataGo 서비스]" -ForegroundColor Cyan
    Write-Host "   - 서비스 이름: katago" -ForegroundColor White
    Write-Host "   - Dockerfile: Dockerfile.katago" -ForegroundColor White
    Write-Host "   - Start Command: npm run start-katago" -ForegroundColor White
    Write-Host ""
    Write-Host "   [Backend 서비스]" -ForegroundColor Cyan
    Write-Host "   - 서비스 이름: backend" -ForegroundColor White
    Write-Host "   - Dockerfile: Dockerfile.backend" -ForegroundColor White
    Write-Host "   - Start Command: npm run start-server" -ForegroundColor White
    Write-Host "   - 환경 변수: KATAGO_API_URL (KataGo 서비스 URL)" -ForegroundColor White
    Write-Host ""
    Write-Host "   [Frontend 서비스]" -ForegroundColor Cyan
    Write-Host "   - 서비스 이름: frontend" -ForegroundColor White
    Write-Host "   - Dockerfile: Dockerfile.frontend" -ForegroundColor White
    Write-Host "   - Start Command: npm run start-frontend" -ForegroundColor White
    Write-Host "   - 환경 변수: VITE_API_URL, VITE_WS_URL (Backend 서비스 URL)" -ForegroundColor White
    Write-Host ""
    Write-Host "자세한 내용은 DEPLOYMENT_GUIDE.md 파일을 참고하세요." -ForegroundColor Yellow
    Write-Host ""
    
    # DEPLOYMENT_GUIDE.md 열기
    $openGuide = Read-Host "DEPLOYMENT_GUIDE.md를 열까요? (y/n)"
    if ($openGuide -eq "y" -or $openGuide -eq "Y") {
        Start-Process "DEPLOYMENT_GUIDE.md"
    }
} elseif ($method -eq "2") {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Railway CLI 배포 시작" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "주의: Railway CLI는 각 서비스를 별도로 배포해야 합니다." -ForegroundColor Yellow
    Write-Host "웹 대시보드 사용을 권장합니다." -ForegroundColor Yellow
    Write-Host ""
    
    # KataGo 서비스 배포
    Write-Host "[1/3] KataGo 서비스 배포 중..." -ForegroundColor Yellow
    Write-Host "서비스 이름을 입력하세요 (기본값: katago): " -ForegroundColor Cyan
    $katagoServiceName = Read-Host
    if ([string]::IsNullOrWhiteSpace($katagoServiceName)) {
        $katagoServiceName = "katago"
    }
    
    Write-Host "KataGo 서비스 배포를 시작합니다..." -ForegroundColor Yellow
    railway up --service $katagoServiceName --dockerfile Dockerfile.katago
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "KataGo 서비스 배포 완료!" -ForegroundColor Green
        Write-Host "KataGo 서비스의 공개 URL을 확인하고 Backend의 KATAGO_API_URL에 설정하세요." -ForegroundColor Yellow
    } else {
        Write-Host "KataGo 서비스 배포 실패. 로그를 확인하세요." -ForegroundColor Red
    }
    
    Write-Host ""
    Write-Host "다음 단계:" -ForegroundColor Cyan
    Write-Host "1. KataGo 서비스의 공개 URL 확인" -ForegroundColor White
    Write-Host "2. Backend 서비스 배포 (KATAGO_API_URL 설정 필요)" -ForegroundColor White
    Write-Host "3. Frontend 서비스 배포 (VITE_API_URL, VITE_WS_URL 설정 필요)" -ForegroundColor White
} else {
    Write-Host "잘못된 선택입니다." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "배포 스크립트 완료" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

