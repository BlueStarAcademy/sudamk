/**
 * PNG 파일 정리 스크립트
 * 
 * WebP로 변환된 PNG 파일과 백업 파일을 삭제하여 용량을 절약합니다.
 * 
 * 사용법:
 *   node scripts/cleanup-png-files.js
 * 
 * 옵션:
 *   --dry-run           실제 삭제 없이 시뮬레이션만
 *   --keep-backup       백업 파일은 유지하고 PNG만 삭제
 */

const fs = require('fs').promises;
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');

// 명령줄 인수 파싱
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const keepBackup = args.includes('--keep-backup');

const stats = {
  deletedPng: 0,
  deletedBackup: 0,
  skippedPng: 0,
  totalSizeSaved: 0
};

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function getFileSize(filePath) {
  try {
    const stat = await fs.stat(filePath);
    return stat.size;
  } catch {
    return 0;
  }
}

async function deleteFile(filePath, type) {
  try {
    const size = await getFileSize(filePath);
    const relativePath = path.relative(projectRoot, filePath);
    
    if (dryRun) {
      console.log(`[DRY RUN] Would delete ${type}: ${relativePath} (${(size / 1024).toFixed(2)}KB)`);
      stats.totalSizeSaved += size;
      if (type === 'PNG') {
        stats.deletedPng++;
      } else {
        stats.deletedBackup++;
      }
      return;
    }
    
    await fs.unlink(filePath);
    console.log(`✓ Deleted ${type}: ${relativePath} (${(size / 1024).toFixed(2)}KB)`);
    stats.totalSizeSaved += size;
    if (type === 'PNG') {
      stats.deletedPng++;
    } else {
      stats.deletedBackup++;
    }
  } catch (error) {
    console.error(`✗ Error deleting ${filePath}:`, error.message);
  }
}

async function findPngFiles(dir) {
  const pngFiles = [];
  
  try {
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
      
      try {
        if (entry.isDirectory()) {
          const subPngFiles = await findPngFiles(fullPath);
          pngFiles.push(...subPngFiles);
        } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.png')) {
          pngFiles.push(fullPath);
        }
      } catch (error) {
        // 개별 파일/디렉토리 접근 오류는 무시하고 계속 진행
        console.warn(`Warning: Could not process ${fullPath}:`, error.message);
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error.message);
  }
  
  return pngFiles;
}

async function findBackupFiles(dir) {
  const backupFiles = [];
  
  try {
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
      
      try {
        if (entry.isDirectory()) {
          const subBackupFiles = await findBackupFiles(fullPath);
          backupFiles.push(...subBackupFiles);
        } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.backup')) {
          backupFiles.push(fullPath);
        }
      } catch (error) {
        // 개별 파일/디렉토리 접근 오류는 무시하고 계속 진행
        console.warn(`Warning: Could not process ${fullPath}:`, error.message);
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error.message);
  }
  
  return backupFiles;
}

async function main() {
  console.log('🧹 PNG 파일 정리 시작...\n');
  console.log(`설정:`);
  console.log(`  - 모드: ${dryRun ? '시뮬레이션' : '실제 삭제'}`);
  console.log(`  - 백업 파일: ${keepBackup ? '유지' : '삭제'}\n`);
  
  const imagesDir = path.join(projectRoot, 'public', 'images');
  
  // 디렉토리 존재 확인
  try {
    await fs.access(imagesDir);
  } catch (error) {
    console.error(`Error: Images directory not found: ${imagesDir}`);
    process.exit(1);
  }
  
  // PNG 파일 찾기
  console.log('📁 PNG 파일 검색 중...');
  const pngFiles = await findPngFiles(imagesDir);
  console.log(`발견된 PNG 파일: ${pngFiles.length}개\n`);
  
  // PNG 파일 처리
  for (let i = 0; i < pngFiles.length; i++) {
    const pngPath = pngFiles[i];
    const webpPath = pngPath.replace(/\.png$/i, '.webp');
    
    // WebP 파일이 존재하는지 확인
    if (await fileExists(webpPath)) {
      // WebP가 있으면 PNG 삭제
      process.stdout.write(`[${i + 1}/${pngFiles.length}] `);
      await deleteFile(pngPath, 'PNG');
    } else {
      // WebP가 없으면 PNG 유지
      const relativePath = path.relative(projectRoot, pngPath);
      if (i < 10 || i % 100 === 0) { // 처음 10개와 100개마다만 출력
        console.log(`⊘ Skipped (no WebP): ${relativePath}`);
      }
      stats.skippedPng++;
    }
  }
  
  // 백업 파일 처리
  if (!keepBackup) {
    console.log('\n📁 백업 파일 검색 중...');
    const backupFiles = await findBackupFiles(imagesDir);
    console.log(`발견된 백업 파일: ${backupFiles.length}개\n`);
    
    for (let i = 0; i < backupFiles.length; i++) {
      process.stdout.write(`[${i + 1}/${backupFiles.length}] `);
      await deleteFile(backupFiles[i], 'BACKUP');
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 정리 결과 요약:');
  console.log(`  삭제된 PNG 파일: ${stats.deletedPng}개`);
  if (!keepBackup) {
    console.log(`  삭제된 백업 파일: ${stats.deletedBackup}개`);
  }
  console.log(`  유지된 PNG 파일: ${stats.skippedPng}개`);
  console.log(`  절약된 용량: ${(stats.totalSizeSaved / 1024 / 1024).toFixed(2)}MB`);
  console.log('='.repeat(60));
  
  if (dryRun) {
    console.log('\n⚠️  DRY RUN 모드입니다. 실제로 삭제하려면 --dry-run 옵션을 제거하세요.');
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

