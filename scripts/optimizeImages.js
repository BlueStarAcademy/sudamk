import imagemin from 'imagemin';
import imageminPngquant from 'imagemin-pngquant';
import imageminMozjpeg from 'imagemin-mozjpeg';
import { fileURLToPath } from 'url';
import { dirname, extname, join } from 'path';
import { readdir, stat } from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');
const imagesDir = join(projectRoot, 'public', 'images');

async function getFileSize(filePath) {
    const stats = await stat(filePath);
    return stats.size;
}

/** PWA/앱 아이콘 — pngquant로 과압축하면 아이콘이 흐릿해질 수 있어 제외 */
async function collectPngPathsExcludingAppIcon(dir) {
    const out = [];
    const entries = await readdir(dir, { withFileTypes: true });
    for (const e of entries) {
        const full = join(dir, e.name);
        if (e.isDirectory()) {
            out.push(...(await collectPngPathsExcludingAppIcon(full)));
        } else if (e.isFile() && extname(e.name).toLowerCase() === '.png') {
            const lower = e.name.toLowerCase();
            if (lower === 'icon.png' || lower === 'favicon.png') continue;
            out.push(full);
        }
    }
    return out;
}

async function optimizeImages() {
    console.log('🖼️  이미지 최적화 시작...');
    
    try {
        // PNG 파일 최적화 (앱 마스터 아이콘 PNG는 제외)
        const pngInputPaths = await collectPngPathsExcludingAppIcon(imagesDir);
        const pngPlugins = [
            imageminPngquant({
                quality: [0.6, 0.8], // 품질 60-80% (시각적 차이 거의 없음)
                speed: 4, // 속도 우선
            }),
        ];
        // imagemin v9는 destination에 basename만 쓰므로, 하위 폴더 PNG는 각 디렉터리에 다시 써야 함
        const pngFiles = [];
        for (const p of pngInputPaths) {
            const out = await imagemin([p], {
                glob: false,
                destination: dirname(p),
                plugins: pngPlugins,
            });
            pngFiles.push(...out);
        }

        // JPEG 파일 최적화 (있는 경우)
        const jpegFiles = await imagemin([`${imagesDir}/**/*.{jpg,jpeg}`], {
            destination: imagesDir,
            plugins: [
                imageminMozjpeg({
                    quality: 80, // JPEG 품질 80%
                }),
            ],
        });

        let totalOriginalSize = 0;
        let totalOptimizedSize = 0;
        const allFiles = [...pngFiles, ...jpegFiles];

        // 최적화된 파일 크기 비교
        for (const file of allFiles) {
            const originalPath = file.sourcePath;
            const optimizedPath = file.destinationPath;
            
            try {
                const originalSize = await getFileSize(originalPath);
                const optimizedSize = await getFileSize(optimizedPath);
                
                totalOriginalSize += originalSize;
                totalOptimizedSize += optimizedSize;
                
                const saved = originalSize - optimizedSize;
                const savedPercent = ((saved / originalSize) * 100).toFixed(1);
                
                if (saved > 0) {
                    console.log(`✅ ${file.sourcePath.replace(projectRoot, '')}: ${(originalSize / 1024).toFixed(2)}KB → ${(optimizedSize / 1024).toFixed(2)}KB (${savedPercent}% 감소)`);
                }
            } catch (err) {
                // 파일이 이미 최적화되어 있거나 오류 발생 시 무시
            }
        }

        const totalSaved = totalOriginalSize - totalOptimizedSize;
        const totalSavedPercent = totalOriginalSize > 0 ? ((totalSaved / totalOriginalSize) * 100).toFixed(1) : 0;

        console.log(`\n📊 최적화 완료!`);
        console.log(`   처리된 파일: ${allFiles.length}개`);
        console.log(`   원본 크기: ${(totalOriginalSize / 1024 / 1024).toFixed(2)}MB`);
        console.log(`   최적화 후: ${(totalOptimizedSize / 1024 / 1024).toFixed(2)}MB`);
        console.log(`   절약: ${(totalSaved / 1024 / 1024).toFixed(2)}MB (${totalSavedPercent}% 감소)`);
        console.log(`\n💡 팁: 이미지가 크게 줄어들었습니다. 원본 파일은 백업해두세요.`);
        
    } catch (error) {
        console.error('❌ 이미지 최적화 중 오류 발생:', error);
        process.exit(1);
    }
}

optimizeImages();

