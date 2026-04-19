/**
 * 이미지 압축 스크립트
 *
 * PWA·파비콘·앱 스토어용 아이콘(`public/images/Icon.png` 등)은 WebP 변환 대상에서 제외합니다.
 * (WebP는 홈 화면/독에서 가장자리가 지저분해 보이는 경우가 많아 PNG를 유지합니다.)
 *
 * 사용법:
 *   npx tsx scripts/compress-images.ts
 * 
 * 옵션:
 *   --quality=80        JPEG 품질 (기본값: 80)
 *   --max-width=1920    최대 너비 (기본값: 1920)
 *   --backup            원본 파일 백업
 *   --dry-run           실제 압축 없이 시뮬레이션만
 */

import sharp from 'sharp';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// 명령줄 인수 파싱
const args = process.argv.slice(2);
const quality = parseInt(args.find(arg => arg.startsWith('--quality='))?.split('=')[1] || '80');
const maxWidth = parseInt(args.find(arg => arg.startsWith('--max-width='))?.split('=')[1] || '1920');
const backup = args.includes('--backup');
const dryRun = args.includes('--dry-run');

interface ImageStats {
  originalSize: number;
  compressedSize: number;
  path: string;
  saved: number;
  savedPercent: number;
}

const stats: ImageStats[] = [];
let totalOriginal = 0;
let totalCompressed = 0;

/** 홈 화면·브라우저 탭·설치 배너 등에 쓰이는 마스터 아이콘 — PNG 유지(이 스크립트가 WebP로 바꾸지 않음) */
function isAppMasterIconAsset(filePath: string): boolean {
  const base = path.basename(filePath).toLowerCase();
  return base === 'icon.png' || base === 'favicon.png';
}

/** 모험 몬스터 스프라이트 — 손실 WebP 시 윤곽/알파 가장자리가 깨지기 쉬워 near-lossless 사용 */
function isAdventureMonsterPng(filePath: string): boolean {
  const norm = filePath.split(path.sep).join('/').toLowerCase();
  return norm.includes('/public/images/monster/') && norm.endsWith('.png');
}

async function compressImage(filePath: string): Promise<void> {
  try {
    if (isAppMasterIconAsset(filePath)) {
      console.log(`⊘ Skip (app icon, keep PNG): ${path.relative(projectRoot, filePath)}`);
      return;
    }

    const fileStat = await fs.stat(filePath);
    const originalSize = fileStat.size;
    
    if (dryRun) {
      console.log(`[DRY RUN] Would compress: ${filePath} (${(originalSize / 1024 / 1024).toFixed(2)}MB)`);
      return;
    }

    // 백업 생성
    if (backup) {
      const backupPath = filePath + '.backup';
      await fs.copyFile(filePath, backupPath);
    }

    // 이미지 메타데이터 확인
    const metadata = await sharp(filePath).metadata();
    const width = metadata.width || 0;
    const height = metadata.height || 0;
    
    // 리사이즈 필요 여부 확인
    const needsResize = width > maxWidth;
    const targetWidth = needsResize ? maxWidth : width;
    const targetHeight = needsResize ? Math.round((height * maxWidth) / width) : height;

    // PNG는 WebP로 변환, JPEG는 품질 압축
    const isPng = filePath.toLowerCase().endsWith('.png');
    const isJpeg = filePath.toLowerCase().match(/\.(jpg|jpeg)$/);
    
    let compressedBuffer: Buffer;
    
    if (isPng) {
      // PNG를 WebP로 변환 (더 나은 압축률)
      const webpOpts: sharp.WebpOptions = isAdventureMonsterPng(filePath)
        ? {
            nearLossless: true,
            quality: Math.max(quality, 90),
            alphaQuality: 100,
            effort: 6,
            smartSubsample: false,
          }
        : { quality };
      compressedBuffer = await sharp(filePath)
        .resize(targetWidth, targetHeight, { 
          fit: 'inside',
          withoutEnlargement: true 
        })
        .webp(webpOpts)
        .toBuffer();
      
      // 원본보다 작으면 WebP로 교체
      if (compressedBuffer.length < originalSize) {
        const webpPath = filePath.replace(/\.png$/i, '.webp');
        await fs.writeFile(webpPath, compressedBuffer);
        console.log(`✓ Converted PNG to WebP: ${path.relative(projectRoot, filePath)} → ${path.relative(projectRoot, webpPath)}`);
        console.log(`  ${(originalSize / 1024 / 1024).toFixed(2)}MB → ${(compressedBuffer.length / 1024 / 1024).toFixed(2)}MB (${((1 - compressedBuffer.length / originalSize) * 100).toFixed(1)}% saved)`);
        
        stats.push({
          originalSize,
          compressedSize: compressedBuffer.length,
          path: filePath,
          saved: originalSize - compressedBuffer.length,
          savedPercent: (1 - compressedBuffer.length / originalSize) * 100
        });
        totalOriginal += originalSize;
        totalCompressed += compressedBuffer.length;
      } else {
        // WebP가 더 크면 PNG 압축만 시도
        compressedBuffer = await sharp(filePath)
          .resize(targetWidth, targetHeight, { 
            fit: 'inside',
            withoutEnlargement: true 
          })
          .png({ compressionLevel: 9, quality: 90 })
          .toBuffer();
        
        if (compressedBuffer.length < originalSize) {
          await fs.writeFile(filePath, compressedBuffer);
          console.log(`✓ Compressed PNG: ${path.relative(projectRoot, filePath)}`);
          console.log(`  ${(originalSize / 1024 / 1024).toFixed(2)}MB → ${(compressedBuffer.length / 1024 / 1024).toFixed(2)}MB (${((1 - compressedBuffer.length / originalSize) * 100).toFixed(1)}% saved)`);
          
          stats.push({
            originalSize,
            compressedSize: compressedBuffer.length,
            path: filePath,
            saved: originalSize - compressedBuffer.length,
            savedPercent: (1 - compressedBuffer.length / originalSize) * 100
          });
          totalOriginal += originalSize;
          totalCompressed += compressedBuffer.length;
        } else {
          console.log(`⊘ No improvement: ${path.relative(projectRoot, filePath)}`);
        }
      }
    } else if (isJpeg) {
      // JPEG 품질 압축
      compressedBuffer = await sharp(filePath)
        .resize(targetWidth, targetHeight, { 
          fit: 'inside',
          withoutEnlargement: true 
        })
        .jpeg({ quality, mozjpeg: true })
        .toBuffer();
      
      if (compressedBuffer.length < originalSize) {
        await fs.writeFile(filePath, compressedBuffer);
        console.log(`✓ Compressed JPEG: ${path.relative(projectRoot, filePath)}`);
        console.log(`  ${(originalSize / 1024 / 1024).toFixed(2)}MB → ${(compressedBuffer.length / 1024 / 1024).toFixed(2)}MB (${((1 - compressedBuffer.length / originalSize) * 100).toFixed(1)}% saved)`);
        
        stats.push({
          originalSize,
          compressedSize: compressedBuffer.length,
          path: filePath,
          saved: originalSize - compressedBuffer.length,
          savedPercent: (1 - compressedBuffer.length / originalSize) * 100
        });
        totalOriginal += originalSize;
        totalCompressed += compressedBuffer.length;
      } else {
        console.log(`⊘ No improvement: ${path.relative(projectRoot, filePath)}`);
      }
    }
  } catch (error: any) {
    console.error(`✗ Error processing ${filePath}:`, error.message);
  }
}

async function findImages(dir: string): Promise<string[]> {
  const images: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    // node_modules, dist, katago, generated, .git 제외
    if (entry.name === 'node_modules' || 
        entry.name === 'dist' || 
        entry.name === 'katago' || 
        entry.name === 'generated' || 
        entry.name === '.git' ||
        entry.name === '.vite') {
      continue;
    }
    
    if (entry.isDirectory()) {
      const subImages = await findImages(fullPath);
      images.push(...subImages);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (['.png', '.jpg', '.jpeg'].includes(ext)) {
        images.push(fullPath);
      }
    }
  }
  
  return images;
}

async function main() {
  console.log('🖼️  이미지 압축 시작...\n');
  console.log(`설정:`);
  console.log(`  - 품질: ${quality}`);
  console.log(`  - 최대 너비: ${maxWidth}px`);
  console.log(`  - 백업: ${backup ? '예' : '아니오'}`);
  console.log(`  - 모드: ${dryRun ? '시뮬레이션' : '실제 압축'}\n`);
  
  const imagesDir = path.join(projectRoot, 'public', 'images');
  const images = await findImages(imagesDir);
  
  console.log(`발견된 이미지: ${images.length}개\n`);
  
  for (let i = 0; i < images.length; i++) {
    const image = images[i];
    process.stdout.write(`[${i + 1}/${images.length}] `);
    await compressImage(image);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 압축 결과 요약:');
  console.log(`  처리된 파일: ${stats.length}개`);
  console.log(`  원본 크기: ${(totalOriginal / 1024 / 1024).toFixed(2)}MB`);
  console.log(`  압축 크기: ${(totalCompressed / 1024 / 1024).toFixed(2)}MB`);
  console.log(`  절약: ${((totalOriginal - totalCompressed) / 1024 / 1024).toFixed(2)}MB (${(((totalOriginal - totalCompressed) / totalOriginal) * 100).toFixed(1)}%)`);
  console.log('='.repeat(60));
  
  if (stats.length > 0) {
    console.log('\n💾 가장 많이 절약된 파일 Top 10:');
    stats
      .sort((a, b) => b.saved - a.saved)
      .slice(0, 10)
      .forEach((stat, i) => {
        console.log(`  ${i + 1}. ${path.relative(projectRoot, stat.path)}`);
        console.log(`     ${(stat.originalSize / 1024 / 1024).toFixed(2)}MB → ${(stat.compressedSize / 1024 / 1024).toFixed(2)}MB (${stat.savedPercent.toFixed(1)}% saved)`);
      });
  }
}

main().catch(console.error);

