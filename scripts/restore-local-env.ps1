# Railway 환경변수 → 로컬 .env 일괄 복구
# .env는 git에 포함되지 않으므로 clone 후 이 스크립트로 복구합니다.
#
# 사용법:
#   1) npx @railway/cli login
#   2) npx @railway/cli link          # sudamk 프로젝트 선택
#   3) .\scripts\restore-local-env.ps1
#      또는 서비스 지정:
#   3) .\scripts\restore-local-env.ps1 -Service backend

param(
    [string]$Service = "",
    [string]$Environment = "",
    [string]$OutputFile = ".env.railway",
    [switch]$MergeIntoEnv
)

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$outPath = Join-Path $root $OutputFile
$envPath = Join-Path $root ".env"

function Invoke-Railway {
    param([string[]]$Args)
    $cmd = "npx --yes @railway/cli @Args"
    Write-Host "> $cmd" -ForegroundColor DarkGray
    $result = & npx --yes @railway/cli @Args 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw ($result | Out-String)
    }
    return $result
}

Write-Host "Railway CLI 확인 중..." -ForegroundColor Cyan
try {
    $null = Invoke-Railway @("whoami")
} catch {
    Write-Host ""
    Write-Host "Railway에 로그인되어 있지 않습니다." -ForegroundColor Yellow
    Write-Host "  npx @railway/cli login" -ForegroundColor White
    Write-Host "  npx @railway/cli link" -ForegroundColor White
    Write-Host "위 두 명령을 실행한 뒤 다시 시도하세요." -ForegroundColor Yellow
    exit 1
}

$listArgs = @("variable", "list", "--kv")
if ($Service) { $listArgs += @("-s", $Service) }
if ($Environment) { $listArgs += @("-e", $Environment) }

Write-Host ""
Write-Host "환경변수 다운로드 중..." -ForegroundColor Cyan
$kv = Invoke-Railway $listArgs
if (-not $kv -or ($kv | Measure-Object).Count -eq 0) {
    throw "가져온 환경변수가 없습니다. 서비스/환경 이름을 확인하세요."
}

$header = @(
    "# Railway에서 자동 복구 ($(Get-Date -Format 'yyyy-MM-dd HH:mm'))",
    "# 서비스: $(if ($Service) { $Service } else { '(link된 기본 서비스)' })",
    ""
)
($header + $kv) | Set-Content -Path $outPath -Encoding UTF8
Write-Host "저장 완료: $outPath ($((($kv | Measure-Object).Count))개)" -ForegroundColor Green

if ($MergeIntoEnv) {
    Write-Host ""
    Write-Host ".env에 병합합니다 (기존 .env는 .env.bak 으로 백업)..." -ForegroundColor Cyan
    if (Test-Path $envPath) {
        Copy-Item $envPath (Join-Path $root ".env.bak") -Force
    }

    $localOverrides = @(
        "NODE_ENV=development",
        "PORT=4000",
        "FRONTEND_URL=http://localhost:5173",
        "GOOGLE_REDIRECT_URI=http://localhost:5173/auth/google/callback",
        "KAKAO_REDIRECT_URI=http://localhost:5173/auth/kakao/callback"
    )

    $merged = @()
    $merged += $header
    $merged += "# --- Railway 원본 ---"
    $merged += $kv
    $merged += ""
    $merged += "# --- 로컬 개발 오버라이드 (Railway 값보다 우선 적용) ---"
    $merged += $localOverrides

    $merged | Set-Content -Path $envPath -Encoding UTF8
    Write-Host "병합 완료: $envPath" -ForegroundColor Green
    Write-Host "로컬 redirect URI 등이 Railway 프로덕션 URL과 다르면 위 오버라이드 섹션을 확인하세요." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "다음 단계:" -ForegroundColor Cyan
Write-Host "  1) $outPath 내용 확인"
if (-not $MergeIntoEnv) {
    Write-Host "  2) 필요한 값만 .env에 복사하거나, -MergeIntoEnv 옵션으로 자동 병합"
}
Write-Host "  3) npm start"
