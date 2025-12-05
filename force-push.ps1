# 강제 푸시 스크립트
Write-Host "=== 현재 상태 ===" -ForegroundColor Cyan
git status

Write-Host "`n=== 모든 변경사항 추가 ===" -ForegroundColor Yellow
git add -A
git status --short

Write-Host "`n=== 커밋 ===" -ForegroundColor Yellow
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$commitMsg = "길드 시스템 개선 - $timestamp"
git commit -m $commitMsg

Write-Host "`n=== 푸시 시도 ===" -ForegroundColor Yellow
$pushResult = git push origin main 2>&1
Write-Host $pushResult

if ($LASTEXITCODE -ne 0) {
    Write-Host "`n=== 푸시 실패, 대안 시도 ===" -ForegroundColor Red
    Write-Host "직접 GitHub에서 확인하거나 수동으로 푸시가 필요할 수 있습니다." -ForegroundColor Yellow
    Write-Host "원격 저장소: https://github.com/BlueStarAcademy/SUDAM.git" -ForegroundColor Cyan
}

Write-Host "`n=== 최종 상태 ===" -ForegroundColor Cyan
git status
git log --oneline -3
