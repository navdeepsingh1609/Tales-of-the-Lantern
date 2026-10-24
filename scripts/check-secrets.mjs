import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const files = execFileSync(
  'git',
  ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
  {
    cwd: root,
    encoding: 'utf8',
  },
)
  .split('\0')
  .filter(Boolean);

// Report paths only, never matching text. This catches common formats, not every secret.
const patterns = [
  /bai-[A-Za-z0-9_-]{20,}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /gh[pousr]_[A-Za-z0-9]{30,}/,
  /sk-(?:proj-)?[A-Za-z0-9_-]{24,}/,
  /gsk_[A-Za-z0-9_-]{32,}/,
  /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/,
  /AIza[0-9A-Za-z_-]{35}/,
  /xox[baprs]-[A-Za-z0-9-]{24,}/,
];
const failures = new Set();
for (const file of files) {
  const basename = file.split('/').at(-1);
  if (basename?.startsWith('.env') || /(?:^|\.)env(?:\.|$)/.test(basename ?? ''))
    failures.add(file);
  if (/\.(?:pem|key|p12|pfx|keystore|jks)$/i.test(basename ?? '')) failures.add(file);
  const path = resolve(root, file);
  if (existsSync(path) && statSync(path).isFile()) {
    const content = readFileSync(path, 'utf8');
    if (patterns.some((pattern) => pattern.test(content))) failures.add(file);
    if (basename?.includes('.env') && basename.endsWith('.example')) {
      for (const assignment of content.matchAll(
        /^[ \t]*([A-Z_][A-Z0-9_]*)[ \t]*=[ \t]*(.*?)[ \t]*$/gm,
      )) {
        const [, name, raw] = assignment;
        const value = raw?.trim().replace(/^(['"])(.*)\1$/, '$2');
        if (/(?:KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)/.test(name ?? '') && value)
          failures.add(file);
      }
    }
  }
}

// Also inspect the generated browser bundle, even though build outputs are ignored.
function scanBundle(directory) {
  if (!existsSync(directory)) return;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) scanBundle(path);
    else if (patterns.some((pattern) => pattern.test(readFileSync(path, 'utf8')))) {
      failures.add(path.slice(root.length));
    }
  }
}
scanBundle(resolve(root, 'apps/web/dist'));

if (failures.size) {
  console.error('FAIL: Possible secret or trackable environment file (paths only):');
  for (const file of failures) console.error(file);
  process.exitCode = 1;
} else {
  console.log(
    `PASS: Scanned ${files.length} Git-eligible files and any browser build. No common secret patterns found.`,
  );
}
