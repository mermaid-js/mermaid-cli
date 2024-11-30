import { Command, Option, InvalidArgumentError } from 'commander'
import chalk from 'chalk'
import fs from 'fs'
import { resolve } from 'import-meta-resolve'
import path from 'path'
import puppeteer from 'puppeteer'
import url from 'url'
import { version } from './version.js'

// __dirname is not available in ESM modules by default
const __dirname = url.fileURLToPath(new url.URL('.', import.meta.url))

/**
 * Mermaid.js IFFE path.
 *
 * Importing this in a browser adds a global `mermaid` object.
 */
const mermaidIIFEPath = path.resolve(path.dirname(url.fileURLToPath(resolve('mermaid', import.meta.url))), 'mermaid.js')
const zenumlIIFEPath = path.resolve(path.dirname(url.fileURLToPath(resolve('@mermaid-js/mermaid-zenuml', import.meta.url))), 'mermaid-zenuml.js')

/**
 * Prints an error to stderr, then closes with exit code 1
 *
 * @param {string} message - The message to print to `stderr`.
 * @returns {never} Quits Node.JS, so never returns.
 */
const error = message => {
  console.error(chalk.red(`\n${message}\n`))
  process.exit(1)
}

/**
 * Prints a warning to stderr.
 *
 * @param {string} message - The message to print to `stderr`.
 */
const warn = message => {
  console.warn(chalk.yellow(`\n${message}\n`))
}

/**
 * Checks if the given file exists.
 *
 * @param {string} file - The file to check.
 * @returns {never | void} If the file doesn't exist, closes Node.JS with
 * exit code 1.
 */
const checkConfigFile = file => {
  if (!fs.existsSync(file)) {
    error(`Configuration file "${file}" doesn't exist`)
  }
}

/**
 * Gets the data in the given file.
 *
 * @param {string | undefined} inputFile - The file to read.
 * If `undefined`, reads from `stdin` instead.
 * @returns {Promise<string>} The contents of `inputFile` parsed as `utf8`.
 */
async function getInputData (inputFile) {
  // if an input file has been specified using '-i', it takes precedence over
  // piping from stdin
  if (typeof inputFile !== 'undefined') {
    return await fs.promises.readFile(inputFile, 'utf-8')
  }

  return await new Promise((resolve, reject) => {
    let data = ''
    process.stdin.on('readable', function () {
      const chunk = process.stdin.read()

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
}

/**
 * Commander parser that converts a string to an integer.
 *
 * @param {string} value - The value from commander.
 * @param {*} _unused - Unused.
 * @returns {number} The value parsed as a number.
 * @throws {InvalidArgumentError} If the arg is not valid.
 * @see https://github.com/tj/commander.js/wiki/Class:-Option#argparserfn
 */
function parseCommanderInt (value, _unused) {
  const parsedValue = parseInt(value, 10)
  if (isNaN(parsedValue) || parsedValue < 1) {
    throw new InvalidArgumentError('Not an positive integer.')
  }
  return parsedValue
}

async function cli () {
  const commander = new Command()
  commander
    .version(version)
    .addOption(new Option('-t, --theme [theme]', 'Theme of the chart').choices(['default', 'forest', 'dark', 'neutral']).default('default'))
    .addOption(new Option('-w, --width [width]', 'Width of the page').argParser(parseCommanderInt).default(800))
    .addOption(new Option('-H, --height [height]', 'Height of the page').argParser(parseCommanderInt).default(600))
    .option('-i, --input <input>', 'Input mermaid file. Files ending in .md will be treated as Markdown and all charts (e.g. ```mermaid (...)``` or :::mermaid (...):::) will be extracted and generated. Use `-` to read from stdin.')
    .option('-o, --output [output]', 'Output file. It should be either md, svg, png, pdf or use `-` to output to stdout. Optional. Default: input + ".svg"')
    .addOption(new Option('-e, --outputFormat [format]', 'Output format for the generated image.').choices(['svg', 'png', 'pdf']).default(null, 'Loaded from the output file extension'))
    .addOption(new Option('-b, --backgroundColor [backgroundColor]', 'Background color for pngs/svgs (not pdfs). Example: transparent, red, \'#F0F0F0\'.').default('white'))
    .option('-c, --configFile [configFile]', 'JSON configuration file for mermaid.')
    .option('-C, --cssFile [cssFile]', 'CSS file for the page.')
    .option('-I, --svgId [svgId]', 'The id attribute for the SVG element to be rendered.')
    .addOption(new Option('-s, --scale [scale]', 'Puppeteer scale factor').argParser(parseCommanderInt).default(1))
    .option('-f, --pdfFit', 'Scale PDF to fit chart')
    .option('-q, --quiet', 'Suppress log output')
    .option('-p --puppeteerConfigFile [puppeteerConfigFile]', 'JSON configuration file for puppeteer.')
    .parse(process.argv)

  const options = commander.opts()

  let { theme, width, height, input, output, outputFormat, backgroundColor, configFile, cssFile, svgId, puppeteerConfigFile, scale, pdfFit, quiet } = options

  // check input file
  if (!input) {
    warn('No input file specified, reading from stdin. ' +
      'If you want to specify an input file, please use `-i <input>.` ' +
      'You can use `-i -` to read from stdin and to suppress this warning.'
    )
  } else if (input === '-') {
    // `--input -` means read from stdin, but suppress the above warning
    input = undefined
  } else if (!fs.existsSync(input)) {
    error(`Input file "${input}" doesn't exist`)
  }

  // check output file
  if (!output) {
  // if an input file is defined, it should take precedence, otherwise, input is
  // coming from stdin and just name the file out.svg, if it hasn't been
  // specified with the '-o' option
    if (outputFormat) {
      output = input ? (`${input}.${outputFormat}`) : `out.${outputFormat}`
    } else {
      output = input ? (`${input}.svg`) : 'out.svg'
    }
  } else if (output === '-') {
    // `--output -` means write to stdout.
    output = '/dev/stdout'
    quiet = true

    if (!outputFormat) {
      outputFormat = 'svg'
      warn('No output format specified, using svg. ' +
        'If you want to specify an output format and supress this warning, ' +
        'please use `-e <format>.` '
      )
    }
  } else if (!/\.(?:svg|png|pdf|md|markdown)$/.test(output)) {
    error('Output file must end with ".md"/".markdown", ".svg", ".png" or ".pdf"')
  }

  const outputDir = path.dirname(output)
  if (output !== '/dev/stdout' && !fs.existsSync(outputDir)) {
    error(`Output directory "${outputDir}/" doesn't exist`)
  }

  // check config files
  let mermaidConfig = { theme }
  if (configFile) {
    checkConfigFile(configFile)
    mermaidConfig = Object.assign(mermaidConfig, JSON.parse(fs.readFileSync(configFile, 'utf-8')))
  }

  let puppeteerConfig = /** @type {import('puppeteer').PuppeteerLaunchOptions} */ ({
    /*
     * `headless: 'shell'` is not officially supported in Puppeteer v19, v20, v21,
     * but still works. In Puppeteer v22, it uses the `chrome-headless-shell` package,
     * which is much faster than the regular headless mode.
     */
    headless: 'shell'
  })
  if (puppeteerConfigFile) {
    checkConfigFile(puppeteerConfigFile)
    puppeteerConfig = Object.assign(puppeteerConfig, JSON.parse(fs.readFileSync(puppeteerConfigFile, 'utf-8')))
  }

  // check cssFile
  let myCSS
  if (cssFile) {
    if (!fs.existsSync(cssFile)) {
      error(`CSS file "${cssFile}" doesn't exist`)
    }
    myCSS = fs.readFileSync(cssFile, 'utf-8')
  }

  await run(
    input, output, {
      puppeteerConfig,
      quiet,
      outputFormat,
      parseMMDOptions: {
        mermaidConfig, backgroundColor, myCSS, pdfFit, viewport: { width, height, deviceScaleFactor: scale }, svgId
      }
    }
  )
}

/**
 * @typedef {Object} ParseMDDOptions Options to pass to {@link parseMMD}
 * @property {import("puppeteer").Viewport} [viewport] - Puppeteer viewport (e.g. `width`, `height`, `deviceScaleFactor`)
 * @property {string | "transparent"} [backgroundColor] - Background color.
 * @property {Parameters<import("mermaid")["default"]["initialize"]>[0]} [mermaidConfig] - Mermaid config.
 * @property {CSSStyleDeclaration["cssText"]} [myCSS] - Optional CSS text.
 * @property {boolean} [pdfFit] - If set, scale PDF to fit chart.
 * @property {string} [svgId] - The id attribute for the SVG element to be rendered.
 */

/**
 * Render a mermaid diagram.
 *
 * @param {import("puppeteer").Browser | import("puppeteer").BrowserContext} browser - Puppeteer Browser
 * @param {string} definition - Mermaid diagram definition
 * @param {"svg" | "png" | "pdf"} outputFormat - Mermaid output format.
 * @param {ParseMDDOptions} [opt] - Options, see {@link ParseMDDOptions} for details.
 * @returns {Promise<{title: string | null, desc: string | null, data: Uint8Array}>} The output file in bytes,
 * with optional metadata.
 */
async function renderMermaid (browser, definition, outputFormat, { viewport, backgroundColor = 'white', mermaidConfig = {}, myCSS, pdfFit, svgId } = {}) {
  const page = await browser.newPage()
  page.on('console', (msg) => {
    console.warn(msg.text())
  })
  try {
    if (viewport) {
      await page.setViewport(viewport)
    }
    const mermaidHTMLPath = path.join(__dirname, '..', 'dist', 'index.html')
    await page.goto(url.pathToFileURL(mermaidHTMLPath).href)
    await page.$eval('body', (body, backgroundColor) => {
      body.style.background = backgroundColor
    }, backgroundColor)
    await Promise.all([
      page.addScriptTag({ path: mermaidIIFEPath }),
      page.addScriptTag({ path: zenumlIIFEPath })
    ])
    const metadata = await page.$eval('#container', async (container, definition, mermaidConfig, myCSS, backgroundColor, svgId) => {
      await Promise.all(Array.from(document.fonts, (font) => font.load()))

      /**
       * @typedef {Object} GlobalThisWithMermaid
       * We've already imported these modules in our `index.html` file (or by running `page.addScriptTag`),
       * so that they get correctly bundled.
       * @property {import("mermaid")["default"]} mermaid Already imported mermaid instance
       * @property {import("@mermaid-js/mermaid-zenuml")["default"]} mermaid-zenuml Already imported mermaid-zenuml instance
       * @property {import("@mermaid-js/layout-elk")["default"]} elkLayouts Already imported mermaid-elkLayouts instance
       */
      const { mermaid, 'mermaid-zenuml': zenuml, elkLayouts } = /** @type {GlobalThisWithMermaid & typeof globalThis} */ (globalThis)

      await mermaid.registerExternalDiagrams([zenuml])
      mermaid.registerLayoutLoaders(elkLayouts)
      mermaid.initialize({ startOnLoad: false, ...mermaidConfig })
      // should throw an error if mmd diagram is invalid
      const { svg: svgText } = await mermaid.render(svgId || 'my-svg', definition, container)
      container.innerHTML = svgText

      const svg = container.getElementsByTagName?.('svg')?.[0]
      if (svg?.style) {
        svg.style.backgroundColor = backgroundColor
      } else {
        warn('svg not found. Not applying background color.')
      }
      if (myCSS) {
        // add CSS as a <svg>...<style>... element
        // see https://developer.mozilla.org/en-US/docs/Web/API/SVGStyleElement
        const style = document.createElementNS('http://www.w3.org/2000/svg', 'style')
        style.appendChild(document.createTextNode(myCSS))
        svg.appendChild(style)
      }

      // Finds SVG metadata for accessibility purposes
      /** SVG title */
      let title = null
      // If <title> exists, it must be the first child Node,
      // see https://www.w3.org/TR/SVG11/struct.html#DescriptionAndTitleElements
      /* global SVGTitleElement, SVGDescElement */ // These exist in browser-based code
      if (svg.firstChild instanceof SVGTitleElement) {
        title = svg.firstChild.textContent
      }
      /** SVG description. According to SVG spec, we should use the first one we find */
      let desc = null
      for (const svgNode of svg.children) {
        if (svgNode instanceof SVGDescElement) {
          desc = svgNode.textContent
        }
      }
      return {
        title, desc
      }
    }, definition, mermaidConfig, myCSS, backgroundColor, svgId)

    if (outputFormat === 'svg') {
      const svgXML = await page.$eval('svg', (svg) => {
        // SVG might have HTML <foreignObject> that are not valid XML
        // E.g. <br> must be replaced with <br/>
        // Luckily the DOM Web API has the XMLSerializer for this
        // eslint-disable-next-line no-undef
        const xmlSerializer = new XMLSerializer()
        return xmlSerializer.serializeToString(svg)
      })
      return {
        ...metadata,
        data: new TextEncoder().encode(svgXML)
      }
    } else if (outputFormat === 'png') {
      const clip = await page.$eval('svg', svg => {
        const react = svg.getBoundingClientRect()
        return { x: Math.floor(react.left), y: Math.floor(react.top), width: Math.ceil(react.width), height: Math.ceil(react.height) }
      })
      await page.setViewport({ ...viewport, width: clip.x + clip.width, height: clip.y + clip.height })
      return {
        ...metadata,
        data: await page.screenshot({ clip, omitBackground: backgroundColor === 'transparent' })
      }
    } else { // pdf
      if (pdfFit) {
        const clip = await page.$eval('svg', svg => {
          const react = svg.getBoundingClientRect()
          return { x: react.left, y: react.top, width: react.width, height: react.height }
        })
        return {
          ...metadata,
          data: await page.pdf({
            omitBackground: backgroundColor === 'transparent',
            width: (Math.ceil(clip.width) + clip.x * 2) + 'px',
            height: (Math.ceil(clip.height) + clip.y * 2) + 'px',
            pageRanges: '1-1'
          })
        }
      } else {
        return {
          ...metadata,
          data: await page.pdf({
            omitBackground: backgroundColor === 'transparent'
          })
        }
      }
    }
  } finally {
    await page.close()
  }
}

/**
 * @typedef {object} MarkdownImageProps Markdown image properties
 * Used to create an markdown image that looks like `![alt](url "title")`
 * @property {string} url - Path to image.
 * @property {string} alt - Image alt text, required.
 * @property {string | null} [title] - Optional image title text.
 */

/**
 * Creates a markdown image syntax.
 *
 * @param {MarkdownImageProps} params - Parameters.
 * @returns {`![${string}](${string})`} The markdown image text.
 */
function markdownImage ({ url, title, alt }) {
  // we can't use String.prototype.replaceAll since it's not supported in Node v14
  const altEscaped = alt.replace(/[[\]\\]/g, '\\$&')
  if (title) {
    const titleEscaped = title.replace(/["\\]/g, '\\$&')
    return `![${altEscaped}](${url} "${titleEscaped}")`
  } else {
    return `![${altEscaped}](${url})`
  }
}

/**
 * Renders a mermaid diagram or mermaid markdown file.
 *
 * @param {`${string}.${"md" | "markdown"}` | string | undefined} input - If this ends with `.md`/`.markdown`,
 * path to a markdown file containing mermaid.
 * If this is a string, loads the mermaid definition from the given file.
 * If this is `undefined`, loads the mermaid definition from stdin.
 * @param {`${string}.${"md" | "markdown" | "svg" | "png" | "pdf"}` | "/dev/stdout"} output - Path to the output file.
 * @param {Object} [opts] - Options
 * @param {import("puppeteer").LaunchOptions} [opts.puppeteerConfig] - Puppeteer launch options.
 * @param {boolean} [opts.quiet] - If set, suppress log output.
 * @param {"svg" | "png" | "pdf"} [opts.outputFormat] - Mermaid output format.
 * Defaults to `output` extension. Overrides `output` extension if set.
 * @param {ParseMDDOptions} [opts.parseMMDOptions] - Options to pass to {@link parseMMDOptions}.
 */
async function run (input, output, { puppeteerConfig = {}, quiet = false, outputFormat, parseMMDOptions } = {}) {
  /**
   * Logs the given message to stdout, unless `quiet` is set to `true`.
   *
   * @param {string} message - The message to maybe log.
   */
  const info = message => {
    if (!quiet) {
      console.info(message)
    }
  }

  // TODO: should we use a Markdown parser like remark instead of rolling our own parser?
  const mermaidChartsInMarkdown = /^[^\S\n]*[`:]{3}(?:mermaid)([^\S\n]*\r?\n([\s\S]*?))[`:]{3}[^\S\n]*$/
  const mermaidChartsInMarkdownRegexGlobal = new RegExp(mermaidChartsInMarkdown, 'gm')
  /**
   * @type {puppeteer.Browser | undefined}
   * Lazy-loaded browser instance, only created when needed.
   */
  let browser
  try {
    if (!outputFormat) {
      const outputFormatFromFilename =
        /**
         * @type {"md" | "markdown" | "svg" | "png" | "pdf"}
         */ (path.extname(output).replace('.', ''))
      if (outputFormatFromFilename === 'md' || outputFormatFromFilename === 'markdown') {
        // fallback to svg in case no outputFormat is given and output file is MD
        outputFormat = 'svg'
      } else {
        outputFormat = outputFormatFromFilename
      }
    }
    if (!/(?:svg|png|pdf)$/.test(outputFormat)) {
      throw new Error('Output format must be one of "svg", "png" or "pdf"')
    }

    const definition = await getInputData(input)
    if (input && /\.(md|markdown)$/.test(input)) {
      if (output === '/dev/stdout') {
        throw new Error('Cannot use `stdout` with markdown input')
      }

      const imagePromises = []
      for (const mermaidCodeblockMatch of definition.matchAll(mermaidChartsInMarkdownRegexGlobal)) {
        if (browser === undefined) {
          browser = await puppeteer.launch(puppeteerConfig)
        }
        const mermaidDefinition = mermaidCodeblockMatch[2]

        /** Output can be either a template image file, or a `.md` output file.
         *   If it is a template image file, use that to created numbered diagrams
         *     I.e. if "out.png", use "out-1.png", "out-2.png", etc
         *   If it is an output `.md` file, use that to base .svg numbered diagrams on
         *     I.e. if "out.md". use "out-1.svg", "out-2.svg", etc
         * @type {string}
         */
        const outputFile = output.replace(
          /(\.(md|markdown|png|svg|pdf))$/,
          `-${imagePromises.length + 1}$1`
        ).replace(/\.(md|markdown)$/, `.${outputFormat}`)
        const outputFileRelative = `./${path.relative(path.dirname(path.resolve(output)), path.resolve(outputFile))}`

        const imagePromise = (async () => {
          const { title, desc, data } = await renderMermaid(browser, mermaidDefinition, outputFormat, parseMMDOptions)
          await fs.promises.writeFile(outputFile, data)
          info(` ✅ ${outputFileRelative}`)

          return {
            url: outputFileRelative,
            title,
            alt: desc
          }
        })()
        imagePromises.push(imagePromise)
      }

      if (imagePromises.length) {
        info(`Found ${imagePromises.length} mermaid charts in Markdown input`)
      } else {
        info('No mermaid charts found in Markdown input')
      }

      const images = await Promise.all(imagePromises)

      if (/\.(md|markdown)$/.test(output)) {
        const outDefinition = definition.replace(mermaidChartsInMarkdownRegexGlobal, (_mermaidMd) => {
          // pop first image from front of array
          const { url, title, alt } =
            /**
             * @type {MarkdownImageProps} We use the same regex,
             * so we will never try to get too many objects from the array.
             * (aka `images.shift()` will never return `undefined`)
             */ (images.shift())
          return markdownImage({ url, title, alt: alt || 'diagram' })
        })
        await fs.promises.writeFile(output, outDefinition, 'utf-8')
        info(` ✅ ${output}`)
      }
    } else {
      info('Generating single mermaid chart')
      browser = await puppeteer.launch(puppeteerConfig)
      const { data } = await renderMermaid(browser, definition, outputFormat, parseMMDOptions)
      await output !== '/dev/stdout'
        ? fs.promises.writeFile(output, data)
        : process.stdout.write(data)
    }
  } finally {
    await browser?.close?.()
  }
}

export { run, renderMermaid, cli, error }
