# Git 자동 푸시 스크립트
# 사용법: .\git-push.ps1 [커밋 메시지]

param(
    [string]$CommitMessage = ""
)

Write-Host "=== Git 자동 푸시 스크립트 ===" -ForegroundColor Cyan
Write-Host ""

# 원격 저장소 확인
Write-Host "[1/5] 원격 저장소 확인..." -ForegroundColor Yellow
$remoteUrl = git remote get-url origin
Write-Host "원격 저장소: $remoteUrl" -ForegroundColor Green

# 현재 상태 확인
Write-Host "`n[2/5] 현재 상태 확인..." -ForegroundColor Yellow
git status --short

# 변경사항이 있는지 확인
$status = git status --porcelain
if ([string]::IsNullOrWhiteSpace($status)) {
    Write-Host "커밋할 변경사항이 없습니다." -ForegroundColor Yellow
    
    # 원격과 동기화 확인
    $ahead = git rev-list --count origin/main..HEAD 2>$null
    if ($ahead -gt 0) {
        Write-Host "로컬에 푸시되지 않은 커밋이 $ahead 개 있습니다." -ForegroundColor Cyan
        Write-Host "[5/5] 푸시 중..." -ForegroundColor Yellow
        git push origin main
        if ($LASTEXITCODE -eq 0) {
            Write-Host "푸시 성공!" -ForegroundColor Green
        } else {
            Write-Host "푸시 실패. 에러를 확인하세요." -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "모든 변경사항이 이미 푸시되었습니다." -ForegroundColor Green
    }
    exit 0
}

# 모든 변경사항 추가
Write-Host "`n[3/5] 모든 변경사항 추가..." -ForegroundColor Yellow
git add -A
$addedFiles = git status --short | Measure-Object -Line
Write-Host "$($addedFiles.Lines) 개 파일이 스테이징되었습니다." -ForegroundColor Green

# 커밋 메시지 생성
if ([string]::IsNullOrWhiteSpace($CommitMessage)) {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $CommitMessage = "작업 저장 - $timestamp"
}

# 커밋
Write-Host "`n[4/5] 커밋 중..." -ForegroundColor Yellow
Write-Host "커밋 메시지: $CommitMessage" -ForegroundColor Cyan
git commit -m $CommitMessage

if ($LASTEXITCODE -ne 0) {
    Write-Host "커밋 실패. 이미 커밋된 상태일 수 있습니다." -ForegroundColor Yellow
}

# 푸시
Write-Host "`n[5/5] 푸시 중..." -ForegroundColor Yellow
$pushResult = git push origin main 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n=== 푸시 성공! ===" -ForegroundColor Green
    Write-Host "원격 저장소: $remoteUrl" -ForegroundColor Cyan
    Write-Host "브랜치: main" -ForegroundColor Cyan
} else {
    Write-Host "`n=== 푸시 실패 ===" -ForegroundColor Red
    Write-Host $pushResult -ForegroundColor Red
    Write-Host "`n해결 방법:" -ForegroundColor Yellow
    Write-Host "1. SSH 키가 GitHub에 등록되어 있는지 확인" -ForegroundColor Cyan
    Write-Host "2. 네트워크 연결 확인" -ForegroundColor Cyan
    Write-Host "3. 수동으로 시도: git push origin main" -ForegroundColor Cyan
    exit 1
}

# 최종 상태
Write-Host "`n=== 최종 상태 ===" -ForegroundColor Cyan
git status --short
Write-Host "`n최근 커밋:" -ForegroundColor Cyan
git log --oneline -3

Write-Host "`n=== 완료! ===" -ForegroundColor Green
