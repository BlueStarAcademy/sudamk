# Git 백업 및 푸시 스크립트
Write-Host "=== Git 상태 확인 ===" -ForegroundColor Cyan
git status

Write-Host "`n=== 변경된 파일 확인 ===" -ForegroundColor Cyan
git diff --name-only

Write-Host "`n=== 모든 변경사항 추가 ===" -ForegroundColor Yellow
git add -A

Write-Host "`n=== 커밋 ===" -ForegroundColor Yellow
$commitMessage = "길드 시스템 개선: 모바일 레이아웃, 채팅 기능, 보스전/전쟁 패널 UI 개선 및 버그 수정"
git commit -m $commitMessage

Write-Host "`n=== 원격 저장소 확인 ===" -ForegroundColor Cyan
git remote -v

Write-Host "`n=== 푸시 ===" -ForegroundColor Yellow
git push origin main

Write-Host "`n=== 최종 상태 확인 ===" -ForegroundColor Cyan
git status
git log --oneline -3

Write-Host "`n=== 완료! ===" -ForegroundColor Green
