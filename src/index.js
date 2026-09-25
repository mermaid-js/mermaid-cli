import { Command, Option, InvalidArgumentError } from "commander";
import chalk from "chalk";
import fs from "fs";
import { resolve } from "import-meta-resolve";
import os from "node:os";
import path from "path";
import pLimit from "p-limit";
import puppeteer from "puppeteer";
import url from "url";
import { promisify } from "node:util";
import { version } from "./version.js";
import { Interceptor } from "./puppeteerIntercept.js";

// __dirname is not available in ESM modules by default
const __dirname = url.fileURLToPath(new url.URL(".", import.meta.url));

/**
 * ESM bundles. Our interceptor doesn't support loading ESM modules that load
 * other modules using relative paths, so these have to no `dependencies`.
 */
const mermaidESMPath = path.resolve(
  path.dirname(url.fileURLToPath(resolve("mermaid", import.meta.url))),
  "mermaid.esm.mjs",
);
const zenumlESMPath = path.resolve(
  path.dirname(
    url.fileURLToPath(resolve("@mermaid-js/mermaid-zenuml", import.meta.url)),
  ),
  "mermaid-zenuml.esm.mjs",
);
const browserUtilsPath = url.fileURLToPath(
  resolve("./browser/fontEmbedder.js", import.meta.url),
);

/** @type {string | undefined} Path to `@mermaid-js/layout-tidy-tree`, if it is installed */
let tidyTreeESMPath;
try {
  tidyTreeESMPath = path.resolve(
    path.dirname(
      url.fileURLToPath(
        resolve("@mermaid-js/layout-tidy-tree", import.meta.url),
      ),
    ),
    "mermaid-layout-tidy-tree.esm.mjs",
  );
} catch (error) {
  if (
    error instanceof Error &&
    "code" in error &&
    error.code === "ERR_MODULE_NOT_FOUND"
  ) {
    // optional dependency, this is normal
  } else {
    throw error;
  }
}

/**
 * Prints an error to stderr, then closes with exit code 1
 *
 * @param {string} message - The message to print to `stderr`.
 * @returns {never} Quits Node.JS, so never returns.
 */
const error = (message) => {
  console.error(chalk.red(`\n${message}\n`));
  process.exit(1);
};

/**
 * Prints a warning to stderr.
 *
 * @param {string} message - The message to print to `stderr`.
 */
const warn = (message) => {
  console.warn(chalk.yellow(`\n${message}\n`));
};

/**
 * Checks if the given file exists.
 *
 * @param {string} file - The file to check.
 * @returns {never | void} If the file doesn't exist, closes Node.JS with
 * exit code 1.
 */
const checkConfigFile = (file) => {
  if (!fs.existsSync(file)) {
    error(`Configuration file "${file}" doesn't exist`);
  }
};

/**
 * Gets the data in the given file.
 *
 * @param {string | undefined} inputFile - The file to read.
 * If `undefined`, reads from `stdin` instead.
 * @returns {Promise<string>} The contents of `inputFile` parsed as `utf8`.
 */
async function getInputData(inputFile) {
  // if an input file has been specified using '-i', it takes precedence over
  // piping from stdin
  if (typeof inputFile !== "undefined") {
    return await fs.promises.readFile(inputFile, "utf-8");
  }

  return await new Promise((resolve, reject) => {
    let data = "";
    process.stdin.on("readable", function () {
      const chunk = process.stdin.read();

      if (chunk !== null) {
        data += chunk;
      }
    });

    process.stdin.on("error", function (err) {
      reject(err);
    });

    process.stdin.on("end", function () {
      resolve(data);
    });
  });
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
function parseCommanderInt(value, _unused) {
  const parsedValue = parseInt(value, 10);
  if (isNaN(parsedValue) || parsedValue < 1) {
    throw new InvalidArgumentError("Not a positive integer.");
  }
  return parsedValue;
}

/**
 * Commander parser that converts a string to a float.
 *
 * @param {string} value - The value from commander.
 * @param {*} _unused - Unused.
 * @returns {number} The value parsed as a number.
 * @see https://github.com/tj/commander.js/wiki/Class:-Option#argparserfn
 */
function parseCommanderFloat(value, _unused) {
  const parsedValue = parseFloat(value);
  if (isNaN(parsedValue) || parsedValue <= 0) {
    throw new InvalidArgumentError("Not a positive number.");
  }
  return parsedValue;
}

/**
 * List of themes.
 *
 * @see https://mermaid.js.org/config/schema-docs/config.html#theme
 * @satisfies{Array<import('mermaid').MermaidConfig['theme']>}
 */
const themes = [
  "base",
  "dark",
  "default",
  "forest",
  "neutral",
  "neo",
  "neo-dark",
  "redux",
  "redux-dark",
  "redux-color",
  "redux-dark-color",
  "null",
];

async function cli() {
  const commander = new Command()
    .version(version)
    .description("Render a mermaid diagram definition into various formats")
    .addOption(
      new Option("-t, --theme <theme>", "Theme of the chart")
        .choices(themes)
        .default(undefined, "Mermaid default (depends on diagram type)"),
    )
    .addOption(
      new Option(
        "--size <size>",
        [
          "Size of the diagram.",
          "This will attempt to create a PNG with a maximum height or width equal to the given size.",
          "For `.svg`s, this will set the `max-width` attribute.",
          "For `.pdf`s, this is in CSS px, which is 1/96 of an inch.",
        ].join("\n"),
      ).argParser(parseCommanderInt),
    )
    .option(
      "-i, --input <input>",
      "Input mermaid file. Files ending in .md will be treated as Markdown and all charts (e.g. ```mermaid (...)``` or :::mermaid (...):::) will be extracted and generated. Use `-` to read from stdin.",
    )
    .addOption(
      new Option(
        "-o, --output <output>",
        'Output file. It should be either md, svg, png, pdf or use `-` to output to stdout. Optional. Default: input + ".svg"',
      ).argParser((value) => {
        if (value === "-") {
          return /** @type {const} */ ("/dev/stdout");
        }
        if (/\.(?:svg|png|pdf|md|markdown)$/.test(value)) {
          return /** @type {`${string}.${"svg" | "png" | "pdf" | "md" | "markdown"}`} */ (
            value
          );
        }
        throw new InvalidArgumentError(
          "Output file must be either md, svg, png, or pdf.",
        );
      }),
    )
    .option(
      "-a, --artefacts <artefacts>",
      "Output artefacts path. Only used with Markdown input file. Optional. Default: output directory",
    )
    .addOption(
      new Option(
        "-j, --jobs <jobs>",
        "Number of parallel jobs to run when rendering multiple diagrams. Defaults to half the available CPUs.",
      )
        .argParser(parseCommanderInt)
        .default(Math.floor(os.availableParallelism() / 2) || 1),
    )
    .addOption(
      new Option(
        "-e, --outputFormat <format>",
        "Output format for the generated image.",
      )
        .choices(["svg", "png", "pdf"])
        .default(undefined, "Loaded from the output file extension"),
    )
    .addOption(
      new Option(
        "-b, --backgroundColor <backgroundColor>",
        "Background color for pngs/svgs (not pdfs). Example: transparent, red, '#F0F0F0'.",
      ).default("white"),
    )
    .option(
      "-c, --configFile <configFile>",
      "JSON configuration file for mermaid.",
    )
    .option(
      "-C, --cssFile <cssFile>",
      "CSS file for the page, used as Mermaid's `themeCSS`",
    )
    .option(
      "-I, --svgId <svgId>",
      "The id attribute for the SVG element to be rendered.",
    )
    .addOption(
      new Option("-s, --scale <scale>", "Puppeteer scale factor")
        .argParser(parseCommanderFloat)
        .default(1),
    )
    .option(
      "--no-font-embed",
      "Disable embedding fonts into the SVG. This cuts down on SVG size, but would result in missing fonts if they are not available on the system.",
    )
    .addOption(
      new Option(
        "--pdf-paper-format <format>",
        "If set, output a PDF with the given paper size, instead of fitting the diagram.",
      ).choices([
        "Letter",
        "Legal",
        "Tabloid",
        "Ledger",
        "A0",
        "A1",
        "A2",
        "A3",
        "A4",
        "A5",
        "A6",
      ]),
    )
    .option("-q, --quiet", "Suppress log output")
    .option(
      "-p --puppeteerConfigFile <puppeteerConfigFile>",
      "JSON configuration file for puppeteer.",
    )
    .addOption(
      new Option(
        "--iconPacks <icon-packages...>",
        [
          "Installed icon packs to use, e.g. @iconify-json/logos.",
          "These should be Iconify NPM packages that expose a icons.json file, see https://iconify.design/docs/icons/json.html.",
          "They can be installed via `npm install <icon-package-name>`.",
        ].join("\n"),
      ).argParser(
        /**
         * @param {string} val - The value passed to the argument parser.
         * @param {Record<string, URL>} previous - The previous parsed value.
         */
        (val, previous = {}) => {
          const iconPackModuleSpecifier = `${val}/icons.json`;
          let iconPackUrl;
          try {
            iconPackUrl = new URL(import.meta.resolve(iconPackModuleSpecifier));
          } catch {
            throw new InvalidArgumentError(
              `Could not find icon pack ${JSON.stringify(iconPackModuleSpecifier)}. Have you installed them with 'npm install ${val}'?`,
            );
          }
          let iconPackContents;
          try {
            iconPackContents = fs.readFileSync(iconPackUrl, "utf-8");
          } catch {
            throw new InvalidArgumentError(
              `Failed to read icon pack JSON from ${JSON.stringify(iconPackUrl)}.`,
            );
          }
          /** @type {unknown} */
          let iconPackJSON;
          try {
            iconPackJSON = JSON.parse(iconPackContents);
          } catch {
            throw new InvalidArgumentError(
              `Failed to parse icon pack JSON from ${JSON.stringify(iconPackModuleSpecifier)}.`,
            );
          }
          if (
            !iconPackJSON ||
            typeof iconPackJSON !== "object" ||
            !("prefix" in iconPackJSON) ||
            typeof iconPackJSON.prefix !== "string"
          ) {
            throw new InvalidArgumentError(
              `Invalid icon pack JSON from ${JSON.stringify(iconPackUrl)}. Missing or invalid "prefix" property.`,
            );
          }
          // Don't use the previous object directly to avoid prototype pollution
          return { ...previous, [iconPackJSON.prefix]: iconPackUrl };
        },
      ),
    )
    .addOption(
      new Option(
        "--iconPacksNamesAndUrls <prefix#iconsurl...>",
        [
          'Icon packs to use, e.g. azure#file:///tmp/icons.json where the name (prefix) of the icon pack is defined before the "#" and the url of the json definition after the "#".',
          "These should be Iconify json file formatted as IconifyJson, see https://iconify.design/docs/icons/json.html.",
          "These will be downloaded when needed.",
          "Use `file://` URIs to reference local files.",
        ].join("\n"),
      ).argParser(
        /**
         * @param {string} val - The value passed to the argument parser, in the format "prefix#iconsurl".
         * @param {Record<string, URL>} previous - The previous parsed value.
         */
        (val, previous = {}) => {
          const [iconName, ...iconPackHrefParts] = val.split("#");
          let iconPackUrl;
          try {
            iconPackUrl = new URL(iconPackHrefParts.join("#"));
          } catch {
            throw new InvalidArgumentError(
              "Failed to parse a valid URL. The format should be iconPackName#https://my-example-url.example",
            );
          }
          // Don't use the previous object directly to avoid prototype pollution
          return { ...previous, [iconName]: iconPackUrl };
        },
      ),
    )
    .parse(process.argv);

  const options = commander.opts();

  let {
    theme,
    size,
    input,
    output,
    outputFormat,
    backgroundColor,
    configFile,
    cssFile,
    svgId,
    puppeteerConfigFile,
    scale,
    fontEmbed,
    pdfPaperFormat,
    quiet,
    iconPacks,
    iconPacksNamesAndUrls,
    artefacts,
    jobs,
  } = options;

  // check input file
  if (!input) {
    warn(
      "No input file specified, reading from stdin. " +
        "If you want to specify an input file, please use `-i <input>.` " +
        "You can use `-i -` to read from stdin and to suppress this warning.",
    );
  } else if (input === "-") {
    // `--input -` means read from stdin, but suppress the above warning
    input = undefined;
  } else if (!fs.existsSync(input)) {
    error(`Input file "${input}" doesn't exist`);
  }

  // check output file
  if (!output) {
    // if an input file is defined, it should take precedence, otherwise, input is
    // coming from stdin and just name the file out.svg, if it hasn't been
    // specified with the '-o' option
    if (outputFormat) {
      output = input ? `${input}.${outputFormat}` : `out.${outputFormat}`;
    } else {
      output = input ? `${input}.svg` : "out.svg";
    }
  } else if (output === "/dev/stdout") {
    quiet = true;

    if (!outputFormat) {
      outputFormat = "svg";
      warn(
        "No output format specified, using svg. " +
          "If you want to specify an output format and suppress this warning, " +
          "please use `-e <format>.` ",
      );
    }
  }

  if (artefacts) {
    if (!input || !/\.(?:md|markdown)$/.test(input)) {
      error(
        "Artefacts [-a|--artefacts] path can only be used with Markdown input file",
      );
    }
    if (!fs.existsSync(artefacts)) {
      fs.mkdirSync(artefacts, { recursive: true });
    }
  }

  const outputDir = path.dirname(output);
  if (output !== "/dev/stdout" && !fs.existsSync(outputDir)) {
    error(`Output directory "${outputDir}/" doesn't exist`);
  }

  // check config files
  let mermaidConfig = { theme };
  if (configFile) {
    checkConfigFile(configFile);
    mermaidConfig = Object.assign(
      mermaidConfig,
      JSON.parse(fs.readFileSync(configFile, "utf-8")),
    );
  }

  let puppeteerConfig = /** @type {import('puppeteer').LaunchOptions} */ ({
    /*
     * `headless: 'shell'` is not officially supported in Puppeteer v19, v20, v21,
     * but still works. In Puppeteer v22, it uses the `chrome-headless-shell` package,
     * which is much faster than the regular headless mode.
     */
    headless: "shell",
  });
  if (puppeteerConfigFile) {
    checkConfigFile(puppeteerConfigFile);
    puppeteerConfig = Object.assign(
      puppeteerConfig,
      JSON.parse(fs.readFileSync(puppeteerConfigFile, "utf-8")),
    );
  }

  // check cssFile
  if (cssFile) {
    if (!fs.existsSync(cssFile)) {
      error(`CSS file "${cssFile}" doesn't exist`);
    }
    if (Object.hasOwn(mermaidConfig, "themeCSS")) {
      warn(
        `Overriding existing themeCSS in mermaidConfig with CSS from "${cssFile}"`,
      );
    }
    mermaidConfig = Object.assign(mermaidConfig, {
      themeCSS: fs.readFileSync(cssFile, "utf-8"),
    });
  }

  await run(input, output, {
    puppeteerConfig,
    quiet,
    outputFormat,
    limiter: pLimit(jobs),
    parseMMDOptions: {
      mermaidConfig,
      backgroundColor,
      fontEmbed,
      pdfPaperFormat,
      size,
      viewport: {
        // Puppeteer has an 8px margin, so need to add those to get the correct size.
        width: size ? size + 16 : 0,
        height: size ? size + 16 : 0,
        deviceScaleFactor: scale,
      },
      svgId,
      iconPacks: {
        ...iconPacks,
        ...iconPacksNamesAndUrls,
      },
    },
    artefacts,
  });
}

/**
 * @typedef {Object} CustomFontCSS Config for adding custom font CSS.
 *
 * If used, these will be embedded into the `.svg` if `fontEmbed` is enabled.
 *
 * If using a `.css` file `npm`, use {@link import.meta.resolve} to find the
 * `file://` URI, then set `allowParentDirectoryLevel` to module root directory.
 *
 * @property {URL} cssUrl - URL to the custom font CSS file.
 * @property {number} [allowParentDirectoryLevel=0] - For `file://` URIs, the number of `../` relative imports to allow.
 */

/**
 * @typedef {Object} ParseMDDOptions Options to pass to {@link parseMMD}
 * @property {number} [size] - The desired size (max width or height, depending on aspect ratio) of the created PNG.
 * @property {import("puppeteer").Viewport} [viewport] - Puppeteer viewport (e.g. `width`, `height`, `deviceScaleFactor`)
 * @property {string | "transparent"} [backgroundColor] - Background color.
 * @property {Parameters<import("mermaid")["default"]["initialize"]>[0]} [mermaidConfig] - Mermaid config.
 * @property {CustomFontCSS[]} [customFontCSS] - Custom CSS for embedding fonts. See {@link CustomFontCSS} for details.
 * @property {boolean} [fontEmbed] - Whether to embed used fonts into the SVG.
 * @property {"Letter" | "Legal" | "Tabloid" | "Ledger" | "A0" | "A1" | "A2" | "A3" | "A4" | "A5" | "A6"} [pdfPaperFormat] - If set, make a PDF of the given size, instead of scaling it to the diagram.
 * @property {string} [svgId] - The id attribute for the SVG element to be rendered.
 * @property {Record<string, URL>} [iconPacks] - Icon packages to use.
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
async function renderMermaid(
  browser,
  definition,
  outputFormat,
  {
    size,
    viewport,
    backgroundColor = "white",
    mermaidConfig = {},
    customFontCSS = [],
    fontEmbed = true,
    pdfPaperFormat,
    svgId,
    iconPacks = {},
  } = {},
) {
  const page = await browser.newPage();
  page.on("console", (msg) => {
    if (msg.location().url?.includes("LICENSE")) {
      // These are normal HTTP 404 errors when we are searching for licenses
      // for fonts/CSS embedding
      return;
    }
    console.warn(msg.text());
  });
  try {
    if (viewport) {
      await page.setViewport(viewport);
    }
    const mermaidHTMLPath = path.join(__dirname, "..", "dist", "index.html");
    await page.goto(url.pathToFileURL(mermaidHTMLPath).href);
    await page.$eval(
      "body",
      (body, backgroundColor) => {
        body.style.background = backgroundColor;
      },
      backgroundColor,
    );

    const interceptor = new Interceptor();
    const mermaidUrl = await interceptor.fileUrlToInterceptUrl(
      url.pathToFileURL(mermaidESMPath),
    );
    const zenumlUrl = await interceptor.fileUrlToInterceptUrl(
      url.pathToFileURL(zenumlESMPath),
    );
    const tidyTreeESMUrl = tidyTreeESMPath
      ? await interceptor.fileUrlToInterceptUrl(
          url.pathToFileURL(tidyTreeESMPath),
        )
      : undefined;
    const browserUtilsUrl = await interceptor.fileUrlToInterceptUrl(
      url.pathToFileURL(browserUtilsPath),
    );

    page.on("request", interceptor.interceptRequestHandler);
    await page.setRequestInterception(true);

    const cssImports = [
      ...Object.entries({
        "@fortawesome/fontawesome-free/css/brands.css": {
          allowParentDirectoryLevel: 1,
        },
        "@fortawesome/fontawesome-free/css/regular.css": {
          allowParentDirectoryLevel: 1,
        },
        "@fortawesome/fontawesome-free/css/solid.css": {
          allowParentDirectoryLevel: 1,
        },
        "@fortawesome/fontawesome-free/css/fontawesome.css": {
          allowParentDirectoryLevel: 1,
        },
        "@fontsource-variable/recursive/index.css": {
          allowParentDirectoryLevel: 0,
        },
        "@fontsource/open-sans/400.css": {
          allowParentDirectoryLevel: 0,
        },
        "@fontsource/open-sans/400-italic.css": {
          allowParentDirectoryLevel: 0,
        },
        "katex/dist/katex.css": { allowParentDirectoryLevel: 1 },
      }).map(([cssImport, { allowParentDirectoryLevel }]) => ({
        cssUrl: new URL(resolve(cssImport, import.meta.url)),
        allowParentDirectoryLevel,
      })),
      ...customFontCSS,
    ];

    await Promise.all(
      cssImports.map(async ({ cssUrl, allowParentDirectoryLevel }) => {
        let href = cssUrl.href;
        if (cssUrl.protocol === "file:") {
          href = await interceptor.fileUrlToInterceptUrl(cssUrl, {
            allowParentDirectoryLevel,
          });
        }
        await page.evaluate(
          ({ href }) => {
            const link = document.createElement("link");
            link.setAttribute("crossorigin", "anonymous");
            link.setAttribute("rel", "stylesheet");
            link.setAttribute("href", href);
            link.setAttribute("class", "mermaid-cli-css");
            const loaded = /** @type {Promise<void>} */ (
              new Promise((resolve, reject) => {
                link.onload = () => resolve();
                link.onerror = () =>
                  reject(new Error(`Failed to load stylesheet: ${href}`));
              })
            );
            document.head.appendChild(link);
            return loaded;
          },
          { href },
        );
      }),
    );

    const resolvedIconPacks = Object.fromEntries(
      await Promise.all(
        Object.entries(iconPacks).map(async ([name, url]) => {
          if (url.protocol === "file:") {
            url = new URL(
              await interceptor.fileUrlToInterceptUrl(url, {
                allowParentDirectoryLevel: 0,
              }),
            );
          }
          return /** @type {const} */ ([name, url.href]);
        }),
      ),
    );

    const metadata = await page.$eval(
      "#container",
      async (
        container,
        {
          definition,
          mermaidConfig,
          size,
          backgroundColor,
          svgId,
          resolvedIconPacks,
          mermaidUrl,
          zenumlUrl,
          tidyTreeESMUrl,
        },
      ) => {
        /** @type {typeof import('mermaid')} */
        const { default: mermaid } = await import(mermaidUrl);
        /** @type {typeof import('@mermaid-js/mermaid-zenuml')} */
        const { default: zenuml } = await import(zenumlUrl);
        // @ts-ignore -- @mermaid-js/layout-tidy-tree is an optionalDependency and might not be installed
        /** @type {typeof import('@mermaid-js/layout-tidy-tree') | {default: undefined}} */
        const { default: tidyTree } = tidyTreeESMUrl
          ? await import(tidyTreeESMUrl)
          : { default: undefined };
        await Promise.all(Array.from(document.fonts, (font) => font.load()));

        await mermaid.registerExternalDiagrams([zenuml]);
        mermaid.registerLayoutLoaders(tidyTree ?? []);
        // lazy load icon packs
        mermaid.registerIconPacks(
          Object.entries(resolvedIconPacks).map(([packName, packUrl]) => {
            return {
              name: packName,
              loader: () =>
                fetch(packUrl)
                  .then((res) => res.json())
                  .catch(() => {
                    error(`Failed to fetch icon: ${packName}`);
                  }),
            };
          }),
        );
        mermaid.initialize({ startOnLoad: false, ...mermaidConfig });
        // should throw an error if mmd diagram is invalid
        const { svg: svgText } = await mermaid.render(
          svgId || "my-svg",
          definition,
          container,
        );
        container.innerHTML = svgText;

        const svg = container.getElementsByTagName?.("svg")?.[0];
        if (svg?.style) {
          svg.style.backgroundColor = backgroundColor;
        } else {
          warn("svg not found. Not applying background color.");
        }
        if (size) {
          // If the SVG has a maxWidth, set it to 4K resolution
          svg.style.maxWidth = `${size}px`;
          svg.style.maxHeight = `${size}px`;
          // in Mermaid v10.9.1, user journey diagrams have a fixed height (BUG??)
          // see https://github.com/mermaid-js/mermaid/commit/f86bdd648a354062656bc0c6610424ea20dcd052
          svg.removeAttribute("height");
        }

        // Finds SVG metadata for accessibility purposes
        /** SVG title */
        let title = null;
        // If <title> exists, it must be the first child Node,
        // see https://www.w3.org/TR/SVG11/struct.html#DescriptionAndTitleElements
        if (svg.firstChild instanceof SVGTitleElement) {
          title = svg.firstChild.textContent;
        }
        /** SVG description. According to SVG spec, we should use the first one we find */
        let desc = null;
        for (const svgNode of svg.children) {
          if (svgNode instanceof SVGDescElement) {
            desc = svgNode.textContent;
          }
        }
        return {
          title,
          desc,
        };
      },
      {
        definition,
        mermaidConfig,
        size,
        backgroundColor,
        svgId,
        resolvedIconPacks,
        mermaidUrl,
        zenumlUrl,
        tidyTreeESMUrl,
      },
    );

    if (outputFormat === "svg") {
      const evalParams = {
        browserUtilsUrl,
        fontEmbed,
      };
      const svgXML = await page.$eval(
        "svg",
        async (svg, { browserUtilsUrl, fontEmbed }) => {
          if (fontEmbed) {
            // For SVGs, we need embed external fonts into the SVG.
            /** @type {typeof import('./browser/fontEmbedder.js')} */
            const { fontEmbedder } = await import(browserUtilsUrl);
            try {
              await fontEmbedder({
                document,
                svg,
              });
            } catch (error) {
              throw new Error(
                "Failed to embed fonts into SVG. Please report this error to https://github.com/mermaid-js/mermaid-cli/issues, and/or run using `--no-font-embed` if you don't need font embedding.",
                { cause: error },
              );
            }
          }

          // SVG might have HTML <foreignObject> that are not valid XML
          // E.g. <br> must be replaced with <br/>
          // Luckily the DOM Web API has the XMLSerializer for this
          const xmlSerializer = new XMLSerializer();
          return xmlSerializer.serializeToString(svg);
        },
        evalParams,
      );
      return {
        ...metadata,
        data: new TextEncoder().encode(svgXML),
      };
    } else if (outputFormat === "png") {
      const clip = await page.$eval(
        "svg",
        (svg, { size }) => {
          const aspectRatio =
            svg.viewBox.baseVal.width / svg.viewBox.baseVal.height;
          // Browsers always use 100% width by default, so we need to decrease
          // the width if the height would be 100%.
          if (size && aspectRatio < 1) {
            svg.style.maxWidth = `${Math.round(size * aspectRatio)}px`;
          }

          const react = svg.getBoundingClientRect();
          return {
            x: Math.floor(react.left),
            y: Math.floor(react.top),
            width: Math.ceil(react.width),
            height: Math.ceil(react.height),
          };
        },
        { size },
      );
      await page.setViewport({
        ...viewport,
        width: clip.x + clip.width,
        height: clip.y + clip.height,
      });
      return {
        ...metadata,
        data: await page.screenshot({
          clip,
          omitBackground: backgroundColor === "transparent",
        }),
      };
    } else {
      // pdf
      if (!pdfPaperFormat) {
        const clip = await page.$eval("svg", (svg) => {
          const react = svg.getBoundingClientRect();
          return {
            x: react.left,
            y: react.top,
            width: react.width,
            height: react.height,
          };
        });
        return {
          ...metadata,
          data: await page.pdf({
            omitBackground: backgroundColor === "transparent",
            printBackground: true,
            width: Math.ceil(clip.width) + clip.x * 2 + "px",
            height: Math.ceil(clip.height) + clip.y * 2 + "px",
            pageRanges: "1-1",
          }),
        };
      } else {
        return {
          ...metadata,
          data: await page.pdf({
            omitBackground: backgroundColor === "transparent",
            printBackground: true,
            format: pdfPaperFormat,
          }),
        };
      }
    }
  } finally {
    await page.close();
  }
}

/**
 * @typedef {object} MarkdownImageProps Markdown image properties
 * Used to create a markdown image that looks like `![alt](url "title")`
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
function markdownImage({ url, title, alt }) {
  // we can't use String.prototype.replaceAll since it's not supported in Node v14
  const altEscaped = alt.replace(/[[\]\\]/g, "\\$&");
  if (title) {
    const titleEscaped = title.replace(/["\\]/g, "\\$&");
    return `![${altEscaped}](${url} "${titleEscaped}")`;
  } else {
    return `![${altEscaped}](${url})`;
  }
}

/**
 * @typedef {<Arguments extends unknown[], ReturnType>(
 *  function_: (...arguments_: Arguments) => Promise<ReturnType>,
 *    ...arguments_: Arguments
 * ) => Promise<ReturnType>} Limiter - Adapted from `p-limit` package.
 */

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
 * @param {string} [opts.artefacts] - Path to the artefacts directory.
 * Defaults to `output` extension. Overrides `output` extension if set.
 * @param {import("puppeteer").Browser} [opts.browser] - If set, reuses the given puppeteer browser instance instead of creating a new one.
 * This may leak cookies/cache between runs.
 * @param {Limiter} [opts.limiter] - If set, limiter function to avoid rendering too many diagrams in parallel.
 * @param {ParseMDDOptions} [opts.parseMMDOptions] - Options to pass to {@link parseMMDOptions}.
 */
async function run(
  input,
  output,
  {
    browser: userPassedBrowser,
    puppeteerConfig = {},
    quiet = false,
    outputFormat,
    parseMMDOptions,
    limiter = (x, ...args) => x(...args),
    artefacts,
  } = {},
) {
  /**
   * Logs the given message to stdout, unless `quiet` is set to `true`.
   *
   * @param {string} message - The message to maybe log.
   */
  const info = (message) => {
    if (!quiet) {
      console.info(message);
    }
  };

  // TODO: should we use a Markdown parser like remark instead of rolling our own parser?
  const mermaidChartsInMarkdown =
    /^[^\S\n]*[`:]{3}(?:mermaid)([^\S\n]*\r?\n([\s\S]*?))[`:]{3}[^\S\n]*$/;
  const mermaidChartsInMarkdownRegexGlobal = new RegExp(
    mermaidChartsInMarkdown,
    "gm",
  );
  /**
   * @type {import('puppeteer').Browser | undefined}
   * Lazy-loaded browser instance, only created when needed.
   */
  let browser = userPassedBrowser;
  try {
    if (!outputFormat) {
      const outputFormatFromFilename =
        /**
         * @type {"md" | "markdown" | "svg" | "png" | "pdf"}
         */ (path.extname(output).replace(".", ""));
      if (
        outputFormatFromFilename === "md" ||
        outputFormatFromFilename === "markdown"
      ) {
        // fallback to svg in case no outputFormat is given and output file is MD
        outputFormat = "svg";
      } else {
        outputFormat = outputFormatFromFilename;
      }
    }
    if (!/(?:svg|png|pdf)$/.test(outputFormat)) {
      throw new Error('Output format must be one of "svg", "png" or "pdf"');
    }

    const definition = await getInputData(input);
    if (input && /\.(md|markdown)$/.test(input)) {
      if (output === "/dev/stdout") {
        throw new Error("Cannot use `stdout` with markdown input");
      }

      const imagePromises = [];
      for (const mermaidCodeblockMatch of definition.matchAll(
        mermaidChartsInMarkdownRegexGlobal,
      )) {
        if (browser === undefined) {
          browser = await puppeteer.launch(puppeteerConfig);
        }
        const mermaidDefinition = mermaidCodeblockMatch[2];

        /** Output can be either a template image file, or a `.md` output file.
         *   If it is a template image file, use that to created numbered diagrams
         *     I.e. if "out.png", use "out-1.png", "out-2.png", etc
         *   If it is an output `.md` file, use that to base .svg numbered diagrams on
         *     I.e. if "out.md". use "out-1.svg", "out-2.svg", etc
         * @type {string}
         */
        let outputFile = output
          .replace(
            /(\.(md|markdown|png|svg|pdf))$/,
            `-${imagePromises.length + 1}$1`,
          )
          .replace(/\.(md|markdown)$/, `.${outputFormat}`);

        if (artefacts) {
          outputFile = path.resolve(artefacts, path.basename(outputFile));
        }

        const outputFileRelative = `./${path.relative(path.dirname(path.resolve(output)), path.resolve(outputFile))}`;

        const imagePromise = limiter(
          async (browser, outputFormat) => {
            const { title, desc, data } = await renderMermaid(
              browser,
              mermaidDefinition,
              outputFormat,
              parseMMDOptions,
            );
            await fs.promises.writeFile(outputFile, data);
            info(` ✅ ${outputFileRelative}`);

            return {
              url: outputFileRelative,
              title,
              alt: desc,
            };
          },
          browser,
          outputFormat,
        );
        imagePromises.push(imagePromise);
      }

      if (imagePromises.length) {
        info(`Found ${imagePromises.length} mermaid charts in Markdown input`);
      } else {
        info("No mermaid charts found in Markdown input");
      }

      const images = await Promise.all(imagePromises);

      if (/\.(md|markdown)$/.test(output)) {
        const outDefinition = definition.replace(
          mermaidChartsInMarkdownRegexGlobal,
          (_mermaidMd) => {
            // pop first image from front of array
            const { url, title, alt } =
              /**
               * @type {MarkdownImageProps} We use the same regex,
               * so we will never try to get too many objects from the array.
               * (aka `images.shift()` will never return `undefined`)
               */ (images.shift());
            return markdownImage({ url, title, alt: alt || "diagram" });
          },
        );
        await fs.promises.writeFile(output, outDefinition, "utf-8");
        info(` ✅ ${output}`);
      }
    } else {
      info("Generating single mermaid chart");
      browser ??= await puppeteer.launch(puppeteerConfig);
      const { data } = await renderMermaid(
        browser,
        definition,
        outputFormat,
        parseMMDOptions,
      );
      if (output === "/dev/stdout") {
        await promisify(process.stdout.write).call(process.stdout, data);
      } else {
        await fs.promises.writeFile(output, data);
      }
    }
  } finally {
    // Don't close the browser if it was passed in by the user
    if (browser !== userPassedBrowser) {
      await browser?.close?.();
    }
  }
}

export { run, renderMermaid, cli, error };
