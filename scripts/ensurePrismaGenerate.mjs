import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const schemaPath = path.join(root, 'prisma', 'schema.prisma');
const clientPath = path.join(root, 'generated', 'prisma', 'client.ts');
const enginePath = path.join(root, 'generated', 'prisma', 'query_engine-windows.dll.node');

function newestMtimeMs(filePath) {
  try {
    return fs.statSync(filePath).mtimeMs;
  } catch {
    return 0;
  }
}

function cleanupStaleEngineTmpFiles() {
  const dir = path.join(root, 'generated', 'prisma');
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    if (name.startsWith('query_engine-windows.dll.node.tmp')) {
      try {
        fs.unlinkSync(path.join(dir, name));
      } catch {
        // ignore locked tmp files
      }
    }
  }
}

const schemaMtime = newestMtimeMs(schemaPath);
const clientMtime = newestMtimeMs(clientPath);
const engineExists = fs.existsSync(enginePath);

if (engineExists && clientMtime >= schemaMtime) {
  cleanupStaleEngineTmpFiles();
  process.exit(0);
}

cleanupStaleEngineTmpFiles();

const result = spawnSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['prisma', 'generate', '--schema', 'prisma/schema.prisma'],
  { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' },
);

if (result.status === 0) {
  process.exit(0);
}

if (engineExists && clientMtime > 0) {
  console.warn(
    '[ensurePrismaGenerate] prisma generate failed, but an existing Prisma client/engine was found. Continuing startup.',
  );
  console.warn(
    '[ensurePrismaGenerate] If the server misbehaves, stop all node processes for this project and run: npm run prisma:generate',
  );
  process.exit(0);
}

process.exit(result.status ?? 1);
