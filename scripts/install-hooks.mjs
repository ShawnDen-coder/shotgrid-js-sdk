import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'

// Published packages and CI don't install repository hooks.
if (!process.env.CI && existsSync('.git')) {
  const require = createRequire(import.meta.url)
  let entry
  try {
    entry = require.resolve('lefthook')
  } catch {
    // Production-only installs don't have development tooling.
  }
  if (entry) {
    const result = spawnSync(process.execPath, [entry, 'install'], { stdio: 'inherit' })
    if (result.error) throw result.error
    process.exitCode = result.status ?? 1
  }
}
