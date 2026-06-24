/**
 * E2E 실행 전 테스트 계정·DB 연결을 보장합니다.
 */
import { execSync } from 'node:child_process';

export default async function globalSetup(): Promise<void> {
    execSync('npm run script:ensure-e2e-test-account', {
        stdio: 'inherit',
        cwd: process.cwd(),
    });
}
