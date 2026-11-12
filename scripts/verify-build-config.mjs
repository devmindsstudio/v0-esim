/**
 * Refuses to let the app start or build if a build-config file looks tampered
 * with.
 *
 * WHY THIS EXISTS
 * ---------------
 * Three times (2026-08-07, 08-10, 08-19) somebody with push access force-pushed
 * a rewritten history to origin/main that hid a remote-code-execution loader in
 * postcss.config.mjs, on the "export default config;" line behind ~1000 spaces.
 * PostCSS config is loaded by `next dev` and `next build`, so merely pulling and
 * running the app executed it.
 *
 * This runs as `predev` / `prebuild`, i.e. BEFORE next ever reads the config, so
 * a poisoned file aborts the command instead of running.
 *
 * Detection is STRUCTURAL, not signature-based: the campaign id changed every
 * time (A9-1322-2 -> A9-1822-1 -> A9-2515-2) and the blob hash changed with it,
 * so matching known strings would already have failed. What does not change is
 * the shape: a build config that is large, has an enormous line, hides strings
 * in \uXXXX escapes, or reaches for code execution.
 *
 * Run manually any time:  node scripts/verify-build-config.mjs
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()

// Build configs execute during dev/build, so they get the strict treatment.
// Hand-written and tiny in every healthy project, which is what makes these
// limits safe.
const MAX_BYTES = 4096
const MAX_LINE = 500

function configFiles() {
  const named = [
    'postcss.config.mjs', 'postcss.config.js', 'postcss.config.cjs', 'postcss.config.ts',
    'next.config.mjs', 'next.config.js', 'next.config.ts',
    'tailwind.config.js', 'tailwind.config.mjs', 'tailwind.config.ts',
    'eslint.config.mjs', 'eslint.config.js',
  ]
  // Plus anything else matching *.config.* at the repo root.
  const discovered = readdirSync(ROOT, { withFileTypes: true })
    .filter((e) => e.isFile() && /\.config\.(js|mjs|cjs|ts|mts|cts)$/.test(e.name))
    .map((e) => e.name)
  return [...new Set([...named, ...discovered])].filter((f) => existsSync(join(ROOT, f)))
}

const BACKSLASH = String.fromCharCode(92)
const ESCAPE_RUN = new RegExp(`(${BACKSLASH}${BACKSLASH}u[0-9a-fA-F]{4}){8,}`)
// The actual hiding trick: lots of padding, then code far off the right edge.
const PADDED_CODE = /[ \t]{200,}\S/

const EXEC_TOKENS = [
  'child_process', 'createRequire', 'eval(', 'new Function', 'Function(',
  '.spawn', 'spawnSync', 'execSync', 'require("http', "require('http",
]

const findings = []

for (const file of configFiles()) {
  const text = readFileSync(join(ROOT, file), 'utf8')
  const bytes = Buffer.byteLength(text, 'utf8')
  const lines = text.split(/\r?\n/)
  const longest = lines.reduce((n, l) => Math.max(n, l.length), 0)

  const add = (why) => findings.push({ file, why })

  if (bytes > MAX_BYTES) add(`${bytes} bytes (limit ${MAX_BYTES}) — build configs should be tiny`)
  if (longest > MAX_LINE) add(`a ${longest}-char line (limit ${MAX_LINE}) — payloads hide past the right edge`)
  if (PADDED_CODE.test(text)) add('200+ spaces followed by code — content hidden off-screen')
  if (ESCAPE_RUN.test(text)) add(`8+ chained ${BACKSLASH}uXXXX escapes — obfuscated strings`)
  if (/global\s*[.[]\s*['"]?i['"]?\s*\]?\s*=/.test(text)) add('assigns a global marker variable')

  for (const tok of EXEC_TOKENS) {
    if (text.includes(tok)) add(`contains '${tok}' — a build config has no business executing code`)
  }
}

if (findings.length === 0) {
  console.log(`✓ build config check passed (${configFiles().length} file(s))`)
  process.exit(0)
}

console.error('\n\x1b[31m╔══════════════════════════════════════════════════════════════╗')
console.error('║  BUILD BLOCKED — a build config looks tampered with          ║')
console.error('╚══════════════════════════════════════════════════════════════╝\x1b[0m\n')
for (const f of findings) console.error(`  \x1b[31m✗\x1b[0m ${f.file}: ${f.why}`)

console.error(`
Nothing has been executed — this ran before next loaded the config.

Inspect the file, looking PAST the right edge of your editor:

    awk '{ printf "%4d  len=%6d\\n", NR, length($0) }' postcss.config.mjs | sort -k2 -t= -rn | head

If it arrived from a pull, the remote is compromised again. Restore the good
version and do NOT run the app until this check passes:

    git fetch origin && git diff origin/main -- postcss.config.mjs
    git checkout <known-good-commit> -- postcss.config.mjs

If this is a false positive, adjust scripts/verify-build-config.mjs so the next
person is not blocked too.
`)
process.exit(1)
