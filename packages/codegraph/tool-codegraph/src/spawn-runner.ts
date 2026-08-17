/**
 * Spawn the vendored CodeGraph CLI with the same Node that runs the harness.
 * @module @deepseek-ai/dsh-tool-codegraph/spawn-runner
 */

import { spawn as nodeSpawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import type { CodegraphProcessRunner } from './types.ts'

/** `child_process.spawn` face used by the runner (real spawn or a test double). */
export type SpawnFn = typeof nodeSpawn

/**
 * Absolute path of the bundled `codegraph` CLI script.
 * @param requireImpl - Node `require`; tests pass a fake.
 * @returns `dist/bin/codegraph.js` inside `@colbymchenry/codegraph`.
 */
export function resolveCodegraphCli(requireImpl: NodeJS.Require = createRequire(import.meta.url)): string {
  return join(dirname(requireImpl.resolve('@colbymchenry/codegraph/package.json')), 'npm-shim.js')
}

/**
 * Process runner that execs `process.execPath` against the bundled CLI.
 * @param cliPath - absolute CLI script; defaults to the pinned package bin.
 * @param spawnFn - `child_process.spawn`; tests pass a fake.
 * @returns a process runner that execs `process.execPath` against the CLI.
 */
export function createSpawnRunner(
  cliPath: string = resolveCodegraphCli(),
  spawnFn: SpawnFn = nodeSpawn,
): CodegraphProcessRunner {
  return {
    run(argv, options) {
      return new Promise((resolve, reject) => {
        const child = spawnFn(process.execPath, [cliPath, ...argv], {
          signal: options.signal,
          windowsHide: true,
        })
        const stdout: Buffer[] = []
        const stderr: Buffer[] = []
        child.stdout?.on('data', (chunk: Buffer) => {
          stdout.push(chunk)
        })
        child.stderr?.on('data', (chunk: Buffer) => {
          stderr.push(chunk)
        })
        child.on('error', reject)
        child.on('close', (code) => {
          resolve({
            stdout: Buffer.concat(stdout).toString('utf8'),
            stderr: Buffer.concat(stderr).toString('utf8'),
            code: code ?? 1,
          })
        })
      })
    },
  }
}
