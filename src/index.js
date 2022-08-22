import { Command } from 'commander'
import chalk from 'chalk'
import fs from 'fs'
import path from 'path'
import puppeteer from 'puppeteer'
import url from 'url'

// importing JSON is still experimental in Node.JS https://nodejs.org/docs/latest-v16.x/api/esm.html#json-modules
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const pkg = require('../package.json')
// __dirname is not available in ESM modules by default
const __dirname = url.fileURLToPath(new URL('.', import.meta.url))

const error = message => {
  console.error(chalk.red(`\n${message}\n`))
  process.exit(1)
}

const warn = message => {
  console.log(chalk.yellow(`\n${message}\n`))
}

const checkConfigFile = file => {
  if (!fs.existsSync(file)) {
    error(`Configuration file "${file}" doesn't exist`)
  }
}

const inputPipedFromStdin = () => fs.fstatSync(0).isFIFO()

const getInputData = async inputFile => new Promise((resolve, reject) => {
  // if an input file has been specified using '-i', it takes precedence over
  // piping from stdin
  if (typeof inputFile !== 'undefined') {
    return fs.readFile(inputFile, 'utf-8', (err, data) => {
      if (err) {
        return reject(err)
      }

      return resolve(data)
    })
  }

  let data = ''
  process.stdin.on('readable', function () {
    const chunk = this.read()

    if (chunk !== null) {
      data += chunk
    }
  })

  process.stdin.on('error', function (err) {
    reject(err)
  })

  process.stdin.on('end', function () {
    resolve(data)
  })
})

const convertToValidXML = html => {
  // <br> tags in valid HTML (from innerHTML) look like <br>, but they must look like <br/> to be valid XML (such as SVG)
  return html.replace(/<br>/gi, '<br/>')
}

async function cli () {
// TODO: This is currently unindented to make `git diff` easier for PR reviewers.
  const commander = new Command()
  commander
    .version(pkg.version)
    .option('-t, --theme [theme]', 'Theme of the chart, could be default, forest, dark or neutral. Optional. Default: default', /^default|forest|dark|neutral$/, 'default')
    .option('-w, --width [width]', 'Width of the page. Optional. Default: 800', /^\d+$/, '800')
    .option('-H, --height [height]', 'Height of the page. Optional. Default: 600', /^\d+$/, '600')
    .option('-i, --input <input>', 'Input mermaid file. Files ending in .md will be treated as Markdown and all charts (e.g. ```mermaid (...)```) will be extracted and generated. Required.')
    .option('-o, --output [output]', 'Output file. It should be either md, svg, png or pdf. Optional. Default: input + ".svg"')
    .option('-b, --backgroundColor [backgroundColor]', 'Background color for pngs/svgs (not pdfs). Example: transparent, red, \'#F0F0F0\'. Optional. Default: white')
    .option('-c, --configFile [configFile]', 'JSON configuration file for mermaid. Optional')
    .option('-C, --cssFile [cssFile]', 'CSS file for the page. Optional')
    .option('-s, --scale [scale]', 'Puppeteer scale factor, default 1. Optional')
    .option('-f, --pdfFit [pdfFit]', 'Scale PDF to fit chart')
    .option('-q, --quiet', 'Suppress log output')
    .option('-p --puppeteerConfigFile [puppeteerConfigFile]', 'JSON configuration file for puppeteer. Optional')
    .parse(process.argv)

  const options = commander.opts()

  let { theme, width, height, input, output, backgroundColor, configFile, cssFile, puppeteerConfigFile, scale, pdfFit, quiet } = options

  // check input file
  if (!(input || inputPipedFromStdin())) {
    console.error(chalk.red('\nPlease specify input file: -i <input>\n'))
    // Log to stderr, and return with error exitCode
    commander.help({ error: true })
  }
  if (input && !fs.existsSync(input)) {
    error(`Input file "${input}" doesn't exist`)
  }

  // check output file
  if (!output) {
  // if an input file is defined, it should take precedence, otherwise, input is
  // coming from stdin and just name the file out.svg, if it hasn't been
  // specified with the '-o' option
    output = input ? (input + '.svg') : 'out.svg'
  }
  if (!/\.(?:svg|png|pdf|md)$/.test(output)) {
    error('Output file must end with ".md", ".svg", ".png" or ".pdf"')
  }
  const outputDir = path.dirname(output)
  if (!fs.existsSync(outputDir)) {
    error(`Output directory "${outputDir}/" doesn't exist`)
  }

  // check config files
  let mermaidConfig = { theme }
  if (configFile) {
    checkConfigFile(configFile)
    mermaidConfig = Object.assign(mermaidConfig, JSON.parse(fs.readFileSync(configFile, 'utf-8')))
  }
  let puppeteerConfig = {}
  if (puppeteerConfigFile) {
    checkConfigFile(puppeteerConfigFile)
    puppeteerConfig = JSON.parse(fs.readFileSync(puppeteerConfigFile, 'utf-8'))
  }

  // check cssFile
  let myCSS
  if (cssFile) {
    if (!fs.existsSync(cssFile)) {
      error(`CSS file "${cssFile}" doesn't exist`)
    }
    myCSS = fs.readFileSync(cssFile, 'utf-8')
  }

  // normalize args
  width = parseInt(width)
  height = parseInt(height)
  backgroundColor = backgroundColor || 'white'
  const deviceScaleFactor = parseInt(scale || 1, 10)

  await run(
    input, output, {
      puppeteerConfig,
      quiet,
      parseMMDOptions: {
        mermaidConfig, backgroundColor, myCSS, pdfFit, viewport: { width, height, deviceScaleFactor }
      }
    }
  )
}

/**
 * @typedef {Object} ParseMDDOptions Options to pass to {@link parseMMD}
 * @property {puppeteer.Viewport} [viewport] - Puppeteer viewport (e.g. `width`, `height`, `deviceScaleFactor`)
 * @property {string | "transparent"} [backgroundColor] - Background color.
 * @property {Parameters<import("mermaid").Mermaid["initialize"]>[0]} [mermaidConfig] - Mermaid config.
 * @property {CSSStyleDeclaration["cssText"]} [myCSS] - Optional CSS text.
 * @property {boolean} pdfFit - If set, scale PDF to fit chart.
 */

/**
 * Parse and render a mermaid diagram.
 *
 * @param {puppeteer.Browser} browser - Puppeteer Browser
 * @param {string} definition - Mermaid diagram definition
 * @param {"svg" | "png" | "pdf"} outputFormat - Mermaid output format.
 * @param {ParseMDDOptions} [opt] - Options, see {@link ParseMDDOptions} for details.
 * @returns {Promise<Buffer>} The output file in bytes.
 */
async function parseMMD (browser, definition, outputFormat, { viewport, backgroundColor = 'white', mermaidConfig = {}, myCSS, pdfFit } = {}) {
  const page = await browser.newPage()
  if (viewport) {
    await page.setViewport(viewport)
  }
  const mermaidHTMLPath = path.join(__dirname, '..', 'index.html')
  await page.goto(url.pathToFileURL(mermaidHTMLPath))
  await page.$eval('body', (body, backgroundColor) => {
    body.style.background = backgroundColor
  }, backgroundColor)
  await page.$eval('#container', (container, definition, mermaidConfig, myCSS, backgroundColor) => {
    container.textContent = definition
    window.mermaid.initialize(mermaidConfig)
    // should throw an error if mmd diagram is invalid
    try {
      window.mermaid.initThrowsErrors(undefined, container)
    } catch (error) {
      if (error instanceof Error) {
        // mermaid-js doesn't currently throws JS Errors, but let's leave this
        // here in case it does in the future
        throw error
      } else {
        throw new Error(error?.message ?? 'Unknown mermaid render error')
      }
    }

    const svg = container.getElementsByTagName?.('svg')?.[0]
    if (svg?.style) {
      svg.style.backgroundColor = backgroundColor
    } else {
      warn('svg not found. Not applying background color.')
      return
    }
    if (myCSS) {
      // add CSS as a <svg>...<style>... element
      // see https://developer.mozilla.org/en-US/docs/Web/API/SVGStyleElement
      const style = document.createElementNS('http://www.w3.org/2000/svg', 'style')
      style.appendChild(document.createTextNode(myCSS))
      svg.appendChild(style)
    }
  }, definition, mermaidConfig, myCSS, backgroundColor)

  if (outputFormat === 'svg') {
    const svg = await page.$eval('#container', (container) => {
      return container.innerHTML
    })
    const svgXML = convertToValidXML(svg)
    return Buffer.from(svgXML, 'utf8')
  } else if (outputFormat === 'png') {
    const clip = await page.$eval('svg', svg => {
      const react = svg.getBoundingClientRect()
      return { x: Math.floor(react.left), y: Math.floor(react.top), width: Math.ceil(react.width), height: Math.ceil(react.height) }
    })
    await page.setViewport({ ...viewport, width: clip.x + clip.width, height: clip.y + clip.height })
    return await page.screenshot({ clip, omitBackground: backgroundColor === 'transparent' })
  } else { // pdf
    if (pdfFit) {
      const clip = await page.$eval('svg', svg => {
        const react = svg.getBoundingClientRect()
        return { x: react.left, y: react.top, width: react.width, height: react.height }
      })
      return await page.pdf({
        omitBackground: backgroundColor === 'transparent',
        width: (Math.ceil(clip.width) + clip.x * 2) + 'px',
        height: (Math.ceil(clip.height) + clip.y * 2) + 'px',
        pageRanges: '1-1'
      })
    } else {
      return await page.pdf({
        omitBackground: backgroundColor === 'transparent'
      })
    }
  }
}

/**
 * Renders a mermaid diagram or mermaid markdown file.
 *
 * @param {`${string}.md` | string} [input] - If this ends with `.md`, path to a markdown file containing mermaid.
 * If this is a string, loads the mermaid definition from the given file.
 * If this is `undefined`, loads the mermaid definition from stdin.
 * @param {`${string}.${"md" | "svg" | "png" | "pdf"}`} output - Path to the output file.
 * @param {Object} [opts] - Options
 * @param {puppeteer.LaunchOptions} [opts.puppeteerConfig] - Puppeteer launch options.
 * @param {boolean} [opts.quiet] - If set, suppress log output.
 * @param {ParseMDDOptions} [opts.parseMMDOptions] - Options to pass to {@link parseMMDOptions}.
 */
async function run (input, output, { puppeteerConfig = {}, quiet = false, parseMMDOptions } = {}) {
  const info = message => {
    if (!quiet) {
      console.info(message)
    }
  }

  const mermaidChartsInMarkdown = /^```(?:mermaid)(\r?\n([\s\S]*?))```$/
  const mermaidChartsInMarkdownRegexGlobal = new RegExp(mermaidChartsInMarkdown, 'gm')
  const mermaidChartsInMarkdownRegex = new RegExp(mermaidChartsInMarkdown)
  const browser = await puppeteer.launch(puppeteerConfig)
  try {
  // TODO: indent this (currently unindented to make `git diff` smaller)
    const definition = await getInputData(input)
    if (/\.md$/.test(input)) {
      const diagrams = []
      const outDefinition = definition.replace(mermaidChartsInMarkdownRegexGlobal, (mermaidMd) => {
        const md = mermaidChartsInMarkdownRegex.exec(mermaidMd)[1]

        // Output can be either a template image file, or a `.md` output file.
        //   If it is a template image file, use that to created numbered diagrams
        //     I.e. if "out.png", use "out-1.png", "out-2.png", etc
        //   If it is an output `.md` file, use that to base .svg numbered diagrams on
        //     I.e. if "out.md". use "out-1.svg", "out-2.svg", etc
        const outputFile = output.replace(/(\.(md|png|svg|pdf))$/, `-${diagrams.length + 1}$1`).replace(/(\.md)$/, '.svg')
        const outputFileRelative = `./${path.relative(path.dirname(path.resolve(output)), path.resolve(outputFile))}`
        diagrams.push([outputFile, md])
        return `![diagram](${outputFileRelative})`
      })

      if (diagrams.length) {
        info(`Found ${diagrams.length} mermaid charts in Markdown input`)
        await Promise.all(diagrams.map(async ([imgFile, md]) => {
          const data = await parseMMD(browser, md, path.extname(imgFile).replace('.', ''), parseMMDOptions)
          await fs.promises.writeFile(imgFile, data)
          info(` ✅ ${imgFile}`)
        })
        )
      } else {
        info('No mermaid charts found in Markdown input')
      }

      if (/\.md$/.test(output)) {
        await fs.promises.writeFile(output, outDefinition, 'utf-8')
        info(` ✅ ${output}`)
      }
    } else {
      info('Generating single mermaid chart')
      const data = await parseMMD(browser, definition, path.extname(output).replace('.', ''), parseMMDOptions)
      await fs.promises.writeFile(output, data)
    }
  } finally {
    await browser.close()
  }
}

export { run, parseMMD, cli, error }
