#!/usr/bin/env node

/**
 * This script reads the version from package.json and writes it to src/version.js.
 * It also stages the changes to src/version.js in git.
 *
 * Should be used as an [`npm version` script](https://docs.npmjs.com/cli/v8/using-npm/scripts#npm-version)!
 */
import { execFile } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import { promisify } from 'node:util'

async function main () {
  const packageJson = JSON.parse(await readFile('package.json', 'utf8'))
  const version = packageJson.version

  await writeFile('src/version.js', `export const version = '${version}'\n`)
  await promisify(execFile)('git', ['add', 'src/version.js'])
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
