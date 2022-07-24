#!/usr/bin/env node
process.title = "mmdc"
import { Command } from 'commander'
import chalk from 'chalk'
import fs from 'fs'
import path from 'path'
import puppeteer from 'puppeteer'
import url from "url"

// importing JSON is still experimental in Node.JS https://nodejs.org/docs/latest-v16.x/api/esm.html#json-modules
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const pkg = require("../package.json")
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
    var chunk = this.read()

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

const commander = new Command()
commander
  .version(pkg.version)
  .option('-t, --theme [theme]', 'Theme of the chart, could be default, forest, dark or neutral. Optional. Default: default', /^default|forest|dark|neutral$/, 'default')
  .option('-w, --width [width]', 'Width of the page. Optional. Default: 800', /^\d+$/, '800')
  .option('-H, --height [height]', 'Height of the page. Optional. Default: 600', /^\d+$/, '600')
  .option('-i, --input <input>', 'Input mermaid file. Files ending in .md will be treated as Markdown and all charts (e.g. ```mermaid (...)```) will be extracted and generated. Required.')
  .option('-o, --output [output]', 'Output file. It should be either md, svg, png or pdf. Optional. Default: input + ".svg"')
  .option('-b, --backgroundColor [backgroundColor]', 'Background color. Example: transparent, red, \'#F0F0F0\'. Optional. Default: white')
  .option('-c, --configFile [configFile]', 'JSON configuration file for mermaid. Optional')
  .option('-C, --cssFile [cssFile]', 'CSS file for the page. Optional')
  .option('-s, --scale [scale]', 'Puppeteer scale factor, default 1. Optional')
  .option('-f, --pdfFit [pdfFit]', 'Scale PDF to fit chart')
  .option('-q, --quiet', 'Suppress log output')
  .option('-p --puppeteerConfigFile [puppeteerConfigFile]', 'JSON configuration file for puppeteer. Optional')
  .parse(process.argv)

const options = commander.opts();

let { theme, width, height, input, output, backgroundColor, configFile, cssFile, puppeteerConfigFile, scale, pdfFit, quiet } = options

// check input file
if (!(input || inputPipedFromStdin())) {
  console.error(chalk.red(`\nPlease specify input file: -i <input>\n`))
  // Log to stderr, and return with error exitCode
  commander.help({error: true})
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
  error(`Output file must end with ".md", ".svg", ".png" or ".pdf"`)
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

const info = message => {
  if (!quiet) {
    console.info(message)
  }
}

// normalize args
width = parseInt(width)
height = parseInt(height)
backgroundColor = backgroundColor || 'white';
const deviceScaleFactor = parseInt(scale || 1, 10);

const parseMMD = async (browser, definition, output) => {
  const page = await browser.newPage()
  page.setViewport({ width, height, deviceScaleFactor })
  const mermaidHTMLPath = path.join(__dirname, "..", "index.html")
  await page.goto(url.pathToFileURL(mermaidHTMLPath))
  await page.evaluate(`document.body.style.background = '${backgroundColor}'`)
  const result = await page.$eval('#container', (container, definition, mermaidConfig, myCSS) => {
    container.textContent = definition
    window.mermaid.initialize(mermaidConfig)
    if (myCSS) {
      const head = window.document.head || window.document.getElementsByTagName('head')[0]
      const style = document.createElement('style')
      style.type = 'text/css'
      if (style.styleSheet) {
        style.styleSheet.cssText = myCSS
      } else {
        style.appendChild(document.createTextNode(myCSS))
      }
      head.appendChild(style)
    }

    try {
      window.mermaid.initThrowsErrors(undefined, container)
      return { status: 'success' };
    } catch (error) {
      return { status: 'error', error, message: error.message };
    }
  }, definition, mermaidConfig, myCSS)
  if (result.status === 'error') {
    error(result.message);
  }

  if (output.endsWith('svg')) {
    const svg = await page.$eval('#container', (container, backgroundColor) => {
      const svg = container.getElementsByTagName?.('svg')?.[0]
      if (svg.style) {
        svg.style.backgroundColor = backgroundColor
      } else {
        warn("svg not found. Not applying background color.")
      }
      return container.innerHTML
    }, backgroundColor)
    const svgXML = convertToValidXML(svg)
    fs.writeFileSync(output, svgXML)
  } else if (output.endsWith('png')) {
    const clip = await page.$eval('svg', svg => {
      const react = svg.getBoundingClientRect()
      return { x: Math.floor(react.left), y: Math.floor(react.top), width: Math.ceil(react.width), height: Math.ceil(react.height) }
    })
    await page.setViewport({ width: clip.x + clip.width, height: clip.y + clip.height, deviceScaleFactor })
    await page.screenshot({ path: output, clip, omitBackground: backgroundColor === 'transparent' })
  } else { // pdf
    if (pdfFit) {
      const clip = await page.$eval('svg', svg => {
        const react = svg.getBoundingClientRect()
        return { x: react.left, y: react.top, width: react.width, height: react.height }
      })
      await page.pdf({
        path: output,
        omitBackground: backgroundColor === 'transparent',
        width: (Math.ceil(clip.width) + clip.x*2) + 'px',
        height: (Math.ceil(clip.height) + clip.y*2) + 'px',
        pageRanges: '1-1',
      })
    } else {
      await page.pdf({
        path: output,
        omitBackground: backgroundColor === 'transparent'
      })
    }
  }
}

(async () => {
  const mermaidChartsInMarkdown = '^```(?:mermaid)(\r?\n([\\s\\S]*?))```$';
  const mermaidChartsInMarkdownRegexGlobal = new RegExp(mermaidChartsInMarkdown, 'gm')
  const mermaidChartsInMarkdownRegex = new RegExp(mermaidChartsInMarkdown)
  const browser = await puppeteer.launch(puppeteerConfig)
  const definition = await getInputData(input)
  if (/\.md$/.test(input)) {

    const diagrams = [];
    const outDefinition = definition.replace(mermaidChartsInMarkdownRegexGlobal, (mermaidMd) => {
      const md = mermaidChartsInMarkdownRegex.exec(mermaidMd)[1];

      // Output can be either a template image file, or a `.md` output file.
      //   If it is a template image file, use that to created numbered diagrams
      //     I.e. if "out.png", use "out-1.png", "out-2.png", etc
      //   If it is an output `.md` file, use that to base .svg numbered diagrams on
      //     I.e. if "out.md". use "out-1.svg", "out-2.svg", etc
      const outputFile = output.replace(/(\.(md|png))$/,`-${diagrams.length + 1}$1`).replace(/(\.md)$/, '.svg');
      const outputFileRelative = `./${path.relative(path.dirname(path.resolve(output)), path.resolve(outputFile))}`;
      diagrams.push([outputFile, md]);
      return `![diagram](${outputFileRelative})`;
    });

    if (diagrams.length) {
      info(`Found ${diagrams.length} mermaid charts in Markdown input`);
      await Promise.all(diagrams.map(async ([imgFile, md]) => {
          await parseMMD(browser, md, imgFile);
          info(` ✅ ${imgFile}`);
        })
      );
    } else {
      info(`No mermaid charts found in Markdown input`);
    }

    if(/\.md$/.test(output)) {
      await fs.promises.writeFile(output, outDefinition, 'utf-8');
      info(` ✅ ${output}`);
    }
  } else {
    info(`Generating single mermaid chart`);
    await parseMMD(browser, definition, output);
  }
  await browser.close()
})().catch((exception) => error(exception instanceof Error ? exception.stack: exception))
