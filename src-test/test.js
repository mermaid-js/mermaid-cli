import fs from 'fs/promises'
// Can't use async to load workflow entries, see https://github.com/facebook/jest/issues/2235
import { readdirSync, createReadStream } from 'fs'
import { exec, execFile } from 'child_process'

// Joins together directory/file names in a OS independent way
import { join, relative } from 'path'
import { promisify } from 'util'

// optional (automatically added by jest), but useful to have for your code editor/autocomplete
import { expect, beforeAll, afterAll, describe, test } from '@jest/globals'

import { run, renderMermaid } from '../src/index.js'
import puppeteer from 'puppeteer'
import { pipeline } from 'stream'

const workflows = ['test-positive', 'test-negative']
const out = 'test-output'

/**
 * Process workflow from stdin into specified format file
 *
 * @param {string} workflow - Workflow folder.
 * @param {string} file - Name of mermaid input file relative to workflow folder.
 * @param {"svg" | "pdf" | "png" | "md"} format - Format of output file.
 * @throws {Error} if mmdc fails to launch, or if it has exitCode != 0
 */
async function compileDiagramFromStdin (workflow, file, format) {
  const result = file.replace(/\.(?:mmd|md|markdown)$/, '-stdin.' + format)
  // exec will throw with stderr if there is a non-zero exit code
  return await promisify(exec)(`cat ${workflow}/${file} | \
    node src/cli.js -o ${out}/${result} -c ${workflow}/config.json`
  )
}

/**
 * Process workflow into specified format file
 *
 * @param {string} workflow - Workflow folder.
 * @param {string} file - Name of mermaid input file relative to workflow folder.
 * @param {"svg" | "pdf" | "png" | "md"} format - Format of output file.
 * @param {Object} [options] - Optional options.
 * @param {string} [options.puppeteerConfigFile] - If set, puppeteerConfigFile.
 * Must be relative to workflow folder.
 * @throws {Error} if mmdc fails to launch, or if it has exitCode != 0
 */
async function compileDiagram (workflow, file, format, { puppeteerConfigFile } = {}) {
  const result = file.replace(/\.(?:mmd|md|markdown)$/, '.' + format)

  const args = [
    'src/cli.js',
    '-i',
    join(workflow, file),
    '-o',
    out + '/' + result,
    '-c',
    join(workflow, 'config.json'),
    '-b',
    'lightgray'
  ]

  if (puppeteerConfigFile) {
    args.push('--puppeteerConfigFile', join(workflow, puppeteerConfigFile))
  }

  // execFile will throw with stderr if there is a non-zero exit code
  const output = await promisify(execFile)('node', args)

  if (output.stderr) { // should never happen, so log it if it does happen
    // eslint-disable-next-line no-console
    console.warn(`Running ${args} succeeded but output the following to stderr: ${output.stderr}`)
  }
  return output
}

/**
 * Confirms the filetype of the given bytes
 *
 * @param {Uint8Array} bytes - The bytes of the file to check
 * @param {"png"|"pdf"|"svg"} fileType - The filetype to check for
 */
function expectBytesAreFormat (bytes, fileType) {
  switch (fileType) {
    // see https://en.wikipedia.org/wiki/List_of_file_signatures
    case 'png':
      return expect(new Uint8Array(bytes).subarray(0, 8)).toEqual(Uint8Array.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))
    case 'pdf':
      return expect(new Uint8Array(bytes).subarray(0, 5)).toEqual(Uint8Array.from(Buffer.from('%PDF-', 'utf8')))
    case 'svg':
      return expect(new Uint8Array(bytes).subarray(0, 4)).toEqual(Uint8Array.from(Buffer.from('<svg', 'utf8')))
    default:
      throw new Error('Unsupported filetype')
  }
}

let browser
beforeAll(async () => {
  browser = await puppeteer.launch({ headless: 'shell' })
})
afterAll(async () => {
  if (browser) {
    await browser.close()
  }
})

// 60 second timeout, this needs to be set higher than normal since CI is slow
const timeout = 60000

describe('mermaid-cli', () => {
  beforeAll(async () => {
    await fs.mkdir(out, { recursive: true })
  })

  describe.each(workflows)('testing workflow %s', (workflow) => {
    // Can't use async to load workflow entries, see https://github.com/facebook/jest/issues/2235
    for (const file of readdirSync(workflow)) {
      // only test .md/.markdown and .mmd files in workflow
      if (!(file.endsWith('.mmd') | /\.(md|markdown)$/.test(file))) {
        continue
      }
      const formats = ['png', 'svg', 'pdf']
      if (/\.md$/.test(file)) {
        formats.push('md')
      } else if (file.endsWith('.markdown')) {
        formats.push('markdown')
      }
      const shouldError = /expect-error/.test(file)
      test.concurrent.each(formats)(`${shouldError ? 'should fail' : 'should compile'} ${file} to format %s`, async (format) => {
        const promise = compileDiagram(workflow, file, format)
        if (shouldError) {
          await expect(promise).rejects.toThrow()
        } else {
          await promise
        }
      }, timeout)
      if (!/\.(md|markdown)$/.test(file)) {
        // currently, piping markdown through stdin is not supported
        // as mermaid-cli has no idea it's markdown, not mermaid code
        test.concurrent.each(formats)(`${shouldError ? 'should fail' : 'should compile'} ${file} from stdin to format %s`,
          async (format) => {
            const promise = compileDiagramFromStdin(workflow, file, format)
            if (shouldError) {
              await expect(promise).rejects.toThrow()
            } else {
              await promise
            }
          }, timeout)
      }
    }
  })

  test('should error on mmdc failure', async () => {
    // should work with default puppeteerConfigFile
    await compileDiagram('test-positive', 'sequence.mmd', 'svg')
    await expect(
      compileDiagram('test-positive', 'sequence.mmd', 'svg', { puppeteerConfigFile: '../test-negative/puppeteerTimeoutConfig.json' })
    ).rejects.toThrow('TimeoutError: Timed out after 1 ms')
  }, timeout)

  test('should warn when reading from stdin with missing --input', async () => {
    const execFilePromise = promisify(execFile)('node', ['src/cli.js'])
    await promisify(pipeline)(
      createReadStream('test-positive/flowchart1.mmd'),
      execFilePromise.child.stdin
    )
    const { stderr } = await execFilePromise
    expect(stderr).toContain('No input file specified, reading from stdin.')
  }, timeout)

  test('should not warn when reading from stdin with `--input -`', async () => {
    const execFilePromise = promisify(execFile)('node', ['src/cli.js', '--input', '-'])
    await promisify(pipeline)(
      createReadStream('test-positive/flowchart1.mmd'),
      execFilePromise.child.stdin
    )
    const { stderr } = await execFilePromise
    expect(stderr).not.toContain('No input file specified, reading from stdin.')
  }, timeout)

  test('should warn when outputing to stdout with missing --outputFormat', async () => {
    const execFilePromise = promisify(execFile)('node', ['src/cli.js', '--output', '-'])
    await promisify(pipeline)(
      createReadStream('test-positive/flowchart1.mmd'),
      execFilePromise.child.stdin
    )
    const { stderr } = await execFilePromise
    expect(stderr).toContain('No output format specified, using svg.')
  }, timeout)

  test('should not warn when outputing to stdout with --outputFormat', async () => {
    const execFilePromise = promisify(execFile)('node', ['src/cli.js', '--output', '-', '--outputFormat', 'svg'])
    await promisify(pipeline)(
      createReadStream('test-positive/flowchart1.mmd'),
      execFilePromise.child.stdin
    )
    const { stderr } = await execFilePromise
    expect(stderr).not.toContain('No output format specified, using svg.')
  }, timeout)

  test('should error on mermaid syntax error', async () => {
    await expect(
      compileDiagram('test-negative', 'invalid.expect-error.mmd', 'svg')
    ).rejects.toThrow('Error: Parse error on line 2:')
  }, timeout)

  test('should have 3 trailing spaces after ``` in test-positive/mermaid.md for case 9.', async () => {
    // test if test case 9. for the next test is in required state
    const data = await fs.readFile('test-positive/mermaid.md', { encoding: 'utf8' })
    const regex = /9\.\s+Should still find mermaid code even with trailing spaces after the(.+)do not delete the trailing spaces after the/sg
    const matches = data.match(regex)
    await expect(matches.length).toBeGreaterThan(0)
    await expect(matches[0].includes('```   ')).toBeTruthy()
  }, timeout)

  test('should have 5 trailing spaces after ```mermaid in test-positive/mermaid.md for case 9.', async () => {
    // make sure that we don't accidentally delete the trailing spaces in test 9
    const data = await fs.readFile('test-positive/mermaid.md', { encoding: 'utf8' })
    const regex = /9\.\s+Should still find mermaid code even with trailing spaces after the(.+)do not delete the trailing spaces after the/sg
    const matches = data.match(regex)
    await expect(matches.length).toBeGreaterThan(0)
    await expect(matches[0].includes('```mermaid     ')).toBeTruthy()
  }, timeout)

  test('should write multiple SVGs for default .md input by default', async () => {
    const expectedOutputFiles = [1, 2, 3, 8, 9].map((i) => join('test-positive', `mermaid.md-${i}.svg`))
    // delete any files from previous test (fs.rm added in Node v14.14.0)
    await Promise.all(expectedOutputFiles.map((file) => fs.rm(file, { force: true })))

    await promisify(execFile)('node', ['src/cli.js', '-i', 'test-positive/mermaid.md'])

    // files should exist, and they should be SVGs
    await Promise.all(expectedOutputFiles.map(async (file) => {
      expectBytesAreFormat(await fs.readFile(file), 'svg')
    }))
  }, timeout)

  test('the .png extension should be added to .md files', async () => {
    const expectedOutputFiles = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => join('test-positive', `mermaid.md-${i}.png`))
    await Promise.all(expectedOutputFiles.map((file) => fs.rm(file, { force: true })))
    await promisify(execFile)('node', ['src/cli.js', '-e', 'png', '-i', 'test-positive/mermaid.md'])

    await Promise.all(expectedOutputFiles.map(async (file) => {
      expectBytesAreFormat(await fs.readFile(file), 'png')
    }))
  }, timeout)

  test('the .svg extension should be added to .md files', async () => {
    const expectedOutputFiles = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => join('test-positive', `mermaid.md-${i}.svg`))
    await Promise.all(expectedOutputFiles.map((file) => fs.rm(file, { force: true })))
    await promisify(execFile)('node', ['src/cli.js', '-e', 'svg', '-i', 'test-positive/mermaid.md'])

    await Promise.all(expectedOutputFiles.map(async (file) => {
      expectBytesAreFormat(await fs.readFile(file), 'svg')
    }))
  }, timeout)

  test('the .pdf extension should be added to .md files', async () => {
    const expectedOutputFiles = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => join('test-positive', `mermaid.md-${i}.pdf`))
    await Promise.all(expectedOutputFiles.map((file) => fs.rm(file, { force: true })))
    await promisify(execFile)('node', ['src/cli.js', '-e', 'pdf', '-i', 'test-positive/mermaid.md'])

    await Promise.all(expectedOutputFiles.map(async (file) => {
      expectBytesAreFormat(await fs.readFile(file), 'pdf')
    }))
  }, timeout)

  test('the extension .pdf should be added for .mmd file', async () => {
    const expectedOutputFile = 'test-positive/flowchart1.mmd.pdf'
    await fs.rm(expectedOutputFile, { force: true })
    await promisify(execFile)('node', ['src/cli.js', '-e', 'pdf', '-i', 'test-positive/flowchart1.mmd'])

    expectBytesAreFormat(await fs.readFile(expectedOutputFile), 'pdf')
  }, timeout)

  test('the extension .svg should be added for .mmd file', async () => {
    const expectedOutputFile = 'test-positive/flowchart1.mmd.svg'
    await fs.rm(expectedOutputFile, { force: true })
    await promisify(execFile)('node', ['src/cli.js', '-e', 'svg', '-i', 'test-positive/flowchart1.mmd'])

    expectBytesAreFormat(await fs.readFile(expectedOutputFile), 'svg')
  }, timeout)

  test('the extension .png should be added for .mmd file', async () => {
    const expectedOutputFile = 'test-positive/flowchart1.mmd.png'
    await fs.rm(expectedOutputFile, { force: true })
    await promisify(execFile)('node', ['src/cli.js', '-e', 'png', '-i', 'test-positive/flowchart1.mmd'])

    expectBytesAreFormat(await fs.readFile(expectedOutputFile), 'png')
  }, timeout)

  test('the id of <svg> can be set', async () => {
    const outputFile = 'test-positive/flowchart1.mmd.svg'
    await fs.rm(outputFile, { force: true })
    await promisify(execFile)('node', ['src/cli.js', '-i', 'test-positive/flowchart1.mmd', '-o', outputFile, '-I', 'custom-id'])

    expect((await fs.readFile(outputFile)).toString()).toMatch(/^<svg[^>]+id="custom-id"/)
  }, timeout)

  test.concurrent.each(['svg', 'png', 'pdf'])('should set red background to %s', async (format) => {
    await promisify(execFile)('node', [
      'src/cli.js', '-i', 'test-positive/flowchart1.mmd', '-o', `test-output/flowchart1-red-background.${format}`,
      '--backgroundColor', 'red'
    ])
  }, timeout)

  test.concurrent.each(['svg', 'png', 'pdf'])('should add css to %s', async (format) => {
    await promisify(execFile)('node', [
      'src/cli.js', '-i', 'test-positive/flowchart1.mmd', '-o', `test-output/flowchart1-with-css.${format}`,
      // we want to add an SVG file to git, so make sure it's always the same
      '--configFile', 'test-positive/config-deterministic.json',
      '--cssFile', 'test-positive/flowchart1.css'
    ])

    if (format === 'svg') {
      // this file is used in the README.md, so we want to keep it updated if possible
      await fs.copyFile(`test-output/flowchart1-with-css.${format}`, 'docs/animated-flowchart.svg')
    }
  }, timeout)
})

describe("NodeJS API (import ... from '@mermaid-js/mermaid-cli')", () => {
  describe('run()', () => {
    test('should write markdown output with svg images', async () => {
      const expectedOutputMd = 'test-output/mermaid-run-output-test-svg.md'
      const expectedOutputSvgs = [1, 2, 3].map((i) => `test-output/mermaid-run-output-test-svg-${i}.svg`)
      // delete any files from previous test (fs.rm added in Node v14.14.0)
      await Promise.all(
        [
          expectedOutputMd,
          ...expectedOutputSvgs
        ].map((file) => fs.rm(file, { force: true }))
      )

      await run(
        'test-positive/mermaid.md', expectedOutputMd, { quiet: true, outputFormat: 'svg' }
      )

      const markdownFile = await fs.readFile(expectedOutputMd, { encoding: 'utf8' })

      // files should exist, and they should be SVGs
      await Promise.all(expectedOutputSvgs.map(async (expectedOutputSvg) => {
        // markdown file should point to png relative to md file
        expect(markdownFile).toContain(relative('test-output', expectedOutputSvg))

        const svgFile = await fs.readFile(expectedOutputSvg, { encoding: 'utf8' })
        expect(svgFile).toMatch(/^<svg/)
      }))
    }, timeout)

    test('should write markdown output with png images', async () => {
      const expectedOutputMd = 'test-output/mermaid-run-output-test-png.md'
      const expectedOutputPngs = [1, 2, 3].map((i) => `test-output/mermaid-run-output-test-png-${i}.png`)
      // delete any files from previous test (fs.rm added in Node v14.14.0)
      await Promise.all(
        [
          expectedOutputMd,
          ...expectedOutputPngs
        ].map((file) => fs.rm(file, { force: true }))
      )

      await run(
        'test-positive/mermaid.md', expectedOutputMd, { quiet: true, outputFormat: 'png' }
      )

      const markdownFile = await fs.readFile(expectedOutputMd, { encoding: 'utf8' })

      // check whether mermaid-cli loads the accTitle/accDescr title/description to the markdown file
      const markdownImageWithCustomTitle = (
        // should escape `[]` in alt text
        '![State diagram describing movement states and containing \\[\\] square brackets and \\\\\\[\\]]' +
        // should escape `"` in image title text
        '(./mermaid-run-output-test-png-8.png "State diagram example with \\\\\\"double-quotes\\"")')
      expect(markdownFile).toContain(markdownImageWithCustomTitle)

      // check whether newlines before/after mermaid diagram are kept
      expect(markdownFile).toContain('There should be an empty newline after this line, but before the Mermaid diagram:\n\n')

      // files should exist, and they should be PNGs
      await Promise.all(expectedOutputPngs.map(async (expectedOutputPng) => {
        // markdown file should point to png relative to md file
        expect(markdownFile).toContain(relative('test-output', expectedOutputPng))

        const pngFile = await fs.readFile(expectedOutputPng)
        expectBytesAreFormat(pngFile, 'png')
      }))
    }, timeout)

    test.each(['svg', 'png', 'pdf'])('should write %s from .mmd input', async (format) => {
      const expectedOutput = `test-output/flowchart1-run-output-test.${format}`
      await fs.rm(expectedOutput, { force: true })
      await run(
        'test-positive/flowchart1.mmd',
        expectedOutput,
        { quiet: true, outputFormat: format }
      )
      expectBytesAreFormat(await fs.readFile(expectedOutput), format)
    }, timeout)

    describe.each(workflows)('testing workflow %s', (workflow) => {
      // Can't use async to load workflow entries, see https://github.com/facebook/jest/issues/2235
      for (const file of readdirSync(workflow)) {
        // only test .md/.markdown and .mmd files in workflow
        if (!(file.endsWith('.mmd') | /\.(md|markdown)$/.test(file))) {
          continue
        }
        const formats = ['png', 'svg', 'pdf']
        if (/\.md$/.test(file)) {
          formats.push('md')
        } else if (file.endsWith('.markdown')) {
          formats.push('markdown')
        }
        const shouldError = /expect-error/.test(file)
        test.concurrent.each(formats)(`${shouldError ? 'should fail' : 'should compile'} ${file} to format %s`, async (format) => {
          const result = file.replace(/\.(?:mmd|md|markdown)$/, `-run.${format}`)
          const promise = run(join(workflow, file), join(out, result), { quiet: true })
          if (shouldError) {
            await expect(promise).rejects.toThrow()
          } else {
            await promise
          }
        }, timeout)
      }
    })
  })

  describe('renderMermaid()', () => {
    test('should return bytes from mmd', async () => {
      const mmdInput = 'graph TD;\n    nA-->B;\n'
      const { data: bytes } = await renderMermaid(browser, mmdInput, 'svg')
      expect(bytes).toBeInstanceOf(Uint8Array)
      expectBytesAreFormat(bytes, 'svg')
    })

    test('should throw exception for invalid mmd', async () => {
      const invalidMMDInput = 'this is not a valid mermaid file'
      expect(
        renderMermaid(browser, invalidMMDInput, 'svg')
      ).rejects.toThrow('No diagram type detected matching given configuration for text: this is not a valid mermaid file')
    })

    describe.each(workflows)('testing workflow %s', (workflow) => {
      // Can't use async to load workflow entries, see https://github.com/facebook/jest/issues/2235
      for (const file of readdirSync(workflow)) {
        // only test .mmd files are supported by parseMMD
        if (!(file.endsWith('.mmd'))) {
          continue
        }
        const formats = ['png', 'svg', 'pdf']
        const shouldError = /expect-error/.test(file)
        test.concurrent.each(formats)(`${shouldError ? 'should fail' : 'should compile'} ${file} to format %s`, async (format) => {
          const mmd = await fs.readFile(join(workflow, file), { encoding: 'utf8' })
          const promise = renderMermaid(browser, mmd, format)
          if (shouldError) {
            await expect(promise).rejects.toThrow()
          } else {
            const { data: outputFileBytes } = await promise
            expectBytesAreFormat(outputFileBytes, format)
          }
        }, timeout)
      }
    })

    test('should return title/desc from mmd', async () => {
      const mmdInput = 'graph TD;\n    accTitle: Hi\n    accDescr: World\n    nA-->B;\n'
      const result = await renderMermaid(browser, mmdInput, 'svg')
      expect(result).toMatchObject({ title: 'Hi', desc: 'World' })
      expectBytesAreFormat(result.data, 'svg')
    })

    test('should show Iconify icon packs', async () => {
      const mmdInput = 'architecture-beta\n    group aws(logos:aws)[AWS]'
      const result = await renderMermaid(browser, mmdInput, 'svg', { iconPacks: ['@iconify-json/logos'] })
      expectBytesAreFormat(result.data, 'svg')
      const decoder = new TextDecoder()
      expect(decoder.decode(result.data)).toContain('<path')
    })
  })
})
