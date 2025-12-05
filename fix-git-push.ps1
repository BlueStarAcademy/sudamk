# Git 푸시 문제 해결 스크립트
Write-Host "=== Git 원격 저장소 설정 확인 ===" -ForegroundColor Cyan
git remote -v

Write-Host "`n=== 원격 URL 수정 ===" -ForegroundColor Yellow
git remote set-url origin https://github.com/BlueStarAcademy/SUDAM.git
Write-Host "원격 URL이 수정되었습니다." -ForegroundColor Green

Write-Host "`n=== Credential Helper 설정 ===" -ForegroundColor Yellow
git config --global credential.helper manager-core
Write-Host "Credential helper가 설정되었습니다." -ForegroundColor Green

Write-Host "`n=== 현재 상태 확인 ===" -ForegroundColor Cyan
git status

Write-Host "`n=== 모든 변경사항 커밋 ===" -ForegroundColor Yellow
git add -A
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
git commit -m "길드 시스템 개선 - $timestamp" --allow-empty

Write-Host "`n=== 푸시 시도 ===" -ForegroundColor Yellow
Write-Host "인증이 필요할 수 있습니다. GitHub 자격 증명을 입력하세요." -ForegroundColor Cyan
$pushResult = git push origin main 2>&1
Write-Host $pushResult

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n=== 푸시 성공! ===" -ForegroundColor Green
} else {
    Write-Host "`n=== 푸시 실패 ===" -ForegroundColor Red
    Write-Host "에러 메시지:" -ForegroundColor Yellow
    Write-Host $pushResult -ForegroundColor Red
    Write-Host "`n해결 방법:" -ForegroundColor Yellow
    Write-Host "1. GitHub Personal Access Token 생성 필요" -ForegroundColor Cyan
    Write-Host "2. 또는 SSH 키 설정 후: git remote set-url origin git@github.com:BlueStarAcademy/SUDAM.git" -ForegroundColor Cyan
}

Write-Host "`n=== 최종 상태 ===" -ForegroundColor Cyan
git status
git log --oneline -3
