#!/usr/bin/env node

/**
 * Wrapper around Jest that (a) applies our graceful-fs patches so bulk FS
 * usage does not trip EMFILE in CI, and (b) enforces a sensible default for
 * maxWorkers so the GitHub UI shard workflow does not try to spawn more
 * processes than the host permits.
 */

require('../config/node/setup-graceful-fs.cjs')

const {spawn} = require('node:child_process')
const path = require('node:path')

const jestPackageDir = path.dirname(require.resolve('jest/package.json'))
const jestBin = path.join(jestPackageDir, 'bin/jest.js')
const userArgs = process.argv.slice(2)

const hasWorkerOverride = userArgs.some(
  arg => arg === '--runInBand' || arg.startsWith('--runInBand=') || arg.startsWith('--maxWorkers'),
)

const args = [...userArgs]

if (!hasWorkerOverride) {
  const maxWorkers =
    process.env.JEST_MAX_WORKERS && process.env.JEST_MAX_WORKERS.toString().trim() !== ''
      ? process.env.JEST_MAX_WORKERS.trim()
      : '50%'
  args.unshift(`--maxWorkers=${maxWorkers}`)
}

const child = spawn(process.execPath, [jestBin, ...args], {
  stdio: 'inherit',
  env: process.env,
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }
  process.exit(code ?? 0)
})

child.on('error', error => {
  console.error('[canvas][jest] failed to spawn:', error)
  process.exit(1)
})
