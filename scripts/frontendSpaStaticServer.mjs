/**
 * Railway/GCP용 정적 프론트 서버.
 * `serve -s`는 없는 /assets/*.js 요청까지 index.html(text/html)로 돌려 MIME 오류·청크 불일치를 유발하므로,
 * /assets/* 는 파일이 없으면 404만 반환하고, index.html은 캐시 비활성화로 배포 직후 세 셸 불일치를 줄인다.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_ROOT = path.resolve(__dirname, '..', 'dist');

/** @param {string} filePath */
function contentTypeFor(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const map = {
        '.html': 'text/html; charset=utf-8',
        '.js': 'application/javascript; charset=utf-8',
        '.mjs': 'application/javascript; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.json': 'application/json; charset=utf-8',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon',
        '.woff': 'font/woff',
        '.woff2': 'font/woff2',
        '.ttf': 'font/ttf',
        '.map': 'application/json; charset=utf-8',
        '.webmanifest': 'application/manifest+json',
        '.wasm': 'application/wasm',
    };
    return map[ext] || 'application/octet-stream';
}

/**
 * @param {string} root
 * @param {string} urlPath pathname only (e.g. /assets/x.js)
 */
function safeResolveUnderRoot(root, urlPath) {
    const pathnameOnly = (urlPath.split('?')[0] || '/').replace(/\\/g, '/');
    const rel = pathnameOnly.replace(/^\/+/, '') || 'index.html';
    const resolved = path.resolve(root, rel);
    const rootNorm = path.resolve(root);
    const rootPrefix = rootNorm.endsWith(path.sep) ? rootNorm : rootNorm + path.sep;
    if (resolved !== rootNorm && !resolved.startsWith(rootPrefix)) {
        return null;
    }
    return resolved;
}

/**
 * @param {string} fileAbs
 * @param {string} pathname
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 */
function sendFile(fileAbs, pathname, req, res) {
    let st;
    try {
        st = fs.statSync(fileAbs);
    } catch {
        return false;
    }
    if (!st.isFile()) return false;

    /** @type {http.OutgoingHttpHeaders} */
    const headers = { 'Content-Type': contentTypeFor(fileAbs) };
    if (path.basename(fileAbs) === 'index.html') {
        headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
    } else if (pathname.startsWith('/assets/')) {
        headers['Cache-Control'] = 'public, max-age=31536000, immutable';
    }

    res.writeHead(200, headers);
    if (req.method === 'HEAD') {
        res.end();
        return true;
    }
    fs.createReadStream(fileAbs)
        .on('error', () => {
            if (!res.headersSent) {
                res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
            }
            res.end('Error reading file');
        })
        .pipe(res);
    return true;
}

const server = http.createServer((req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Method Not Allowed');
        return;
    }

    let u;
    try {
        u = new URL(req.url || '/', 'http://127.0.0.1');
    } catch {
        res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Bad URL');
        return;
    }
    const pathname = u.pathname || '/';

    const abs = safeResolveUnderRoot(DIST_ROOT, pathname);
    if (abs === null) {
        res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Bad path');
        return;
    }

    if (pathname.startsWith('/assets/')) {
        if (sendFile(abs, pathname, req, res)) return;
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end('Not found');
        return;
    }

    if (sendFile(abs, pathname, req, res)) return;

    const indexAbs = path.join(DIST_ROOT, 'index.html');
    if (!sendFile(indexAbs, '/index.html', req, res)) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('index.html missing — run vite build');
    }
});

const port = Number(process.env.PORT || 3000);
server.listen(port, '0.0.0.0', () => {
    console.log(`[frontendSpaStaticServer] listening on ${port}, root=${DIST_ROOT}`);
});
