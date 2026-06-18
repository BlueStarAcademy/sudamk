import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const files = process.argv.slice(2);
const re = /[\uAC00-\uD7A3]/g;

function isCommentLine(line) {
  const t = line.trim();
  return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*') || t.startsWith('*/');
}

let totalNonComment = 0;
for (const rel of files) {
  const lines = fs.readFileSync(path.join(root, rel), 'utf8').split('\n');
  let nonComment = 0;
  for (const line of lines) {
    if (!re.test(line)) continue;
    if (isCommentLine(line)) continue;
    nonComment += (line.match(re) || []).length;
  }
  totalNonComment += nonComment;
  console.log(`${rel}: ${nonComment} (non-comment Korean chars)`);
}
console.log(`TOTAL non-comment: ${totalNonComment}`);
