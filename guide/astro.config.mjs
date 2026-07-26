import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

/**
 * 수담바둑 가이드 — 게임 앱(SPA)과 분리된 정적 콘텐츠 사이트.
 * - 빌드 출력: ../dist/guide (게임 앱 vite build 이후 실행해야 함 — vite가 dist를 비우기 때문)
 * - 서빙: server.ts 의 `/guide` 전용 express.static 마운트
 * - AdSense 코드는 이 사이트 레이아웃에만 존재한다 (게임 앱은 광고 코드 0)
 */
export default defineConfig({
  site: 'https://sudambaduk.com',
  base: '/guide',
  outDir: '../dist/guide',
  integrations: [sitemap()],
  build: {
    format: 'directory',
  },
});
