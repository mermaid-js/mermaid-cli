"use strict";

const fs = require("fs/promises");
// Can't use async to load workflow entries, see https://github.com/facebook/jest/issues/2235
const {readdirSync} = require("fs");
const { exec, execFile } = require("child_process");

// Joins together directory/file names in a OS independent way
const {join} = require("path");
const {promisify} = require("util");

// optional (automatically added by jest), but useful to have for your code editor/autocomplete
const { expect, beforeAll, describe, test } = require("@jest/globals");

const workflows = ["test-positive", "test-negative"];
const out = "test-output";

/**
 * Process workflow from stdin into specified format file
 *
 * @param {string} workflow - Workflow folder.
 * @param {string} file - Name of mermaid input file relative to workflow folder.
 * @param {"svg" | "pdf" | "png" | "md"} format - Format of output file.
 * @throws {Error} if mmdc fails to launch, or if it has exitCode != 0
 */
async function compileDiagramFromStdin(workflow, file, format) {
  const result = file.replace(/\.(?:mmd|md)$/, "-stdin." + format);
  // exec will throw with stderr if there is a non-zero exit code
  return await promisify(exec)(`cat ${workflow}/${file} | \
    node src/cli.js -o ${out}/${result} -c ${workflow}/config.json`
  );
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
async function compileDiagram(workflow, file, format, {puppeteerConfigFile} = {}) {
    const result = file.replace(/\.(?:mmd|md)$/, "." + format);

    const args = [
      "src/cli.js",
      "-i",
      join(workflow, file),
      "-o",
      out + "/" + result,
      "-c",
      join(workflow, "config.json"),
      "-b",
      "lightgray"
    ];

    if (puppeteerConfigFile) {
      args.push("--puppeteerConfigFile", join(workflow, puppeteerConfigFile));
    }

    // execFile will throw with stderr if there is a non-zero exit code
    const output = await promisify(execFile)("node", args);

    if (output.stderr) { // should never happen, so log it if it does happen
      // eslint-disable-next-line no-console
      console.warn(`Running ${args} succeeded but output the following to stderr: ${output.stderr}`);
    }
    return output;
}

describe("mermaid-cli", () => {
  beforeAll(async() => {
    await fs.mkdir(out, { recursive: true });
  });

  // 20 second timeout, this needs to be set higher than normal since CI is slow
  const timeout = 20000;

  describe.each(workflows)("testing workflow %s", (workflow) => {
    // Can't use async to load workflow entries, see https://github.com/facebook/jest/issues/2235
    for (const file of readdirSync(workflow)) {
      // only test .md and .mmd files in workflow
      if (!(file.endsWith(".mmd") | /\.md$/.test(file))) {
        continue;
      }
      const formats = ["png", "svg", "pdf"];
      if (/\.md$/.test(file)) {
        formats.push("md");
      }
      const shouldError = /expect-error/.test(file);
      test.concurrent.each(formats)(`${shouldError ? "should fail": "should compile"} ${file} to format %s`, async(format) => {
        const promise = compileDiagram(workflow, file, format);
        if (shouldError) {
          await expect(promise).rejects.toThrow();
        } else {
          await promise;
        }
      }, timeout);
      if (!/\.md$/.test(file)) {
        // currently, piping markdown through stdin is not supported
        // as mermaid-cli has no idea it's markdown, not mermaid code
        test.concurrent.each(formats)(`${shouldError ? "should fail": "should compile"} ${file} from stdin to format %s`,
          async(format) => {
          const promise = compileDiagramFromStdin(workflow, file, format);
          if (shouldError) {
            await expect(promise).rejects.toThrow();
          } else {
            await promise;
          }
        }, timeout);
      }
    }
  });

  test("should error on mmdc failure", async() => {
    // should work with default puppeteerConfigFile
    await compileDiagram("test-positive", "sequence.mmd", "svg");
    await expect(
      compileDiagram("test-positive", "sequence.mmd", "svg", {puppeteerConfigFile: "../test-negative/puppeteerTimeoutConfig.json"})
    ).rejects.toThrow("TimeoutError: Timed out after 1 ms");
  });

  test("should error on missing input", async() => {
    await expect(promisify(execFile)('node', ['src/cli.js'])).rejects.toThrow();
  });

  test("should error on mermaid syntax error", async() => {
    await expect(
      compileDiagram("test-negative", "invalid.expect-error.mmd", "svg")
    ).rejects.toThrow("Parse error on line 2");
  });

  test('should write multiple SVGs for default .md input by default', async () => {
    const expectedOutputFiles = [1, 2, 3].map((i) => join('test-positive', `mermaid.md-${i}.svg`))
    // delete any files from previous test (fs.rm added in Node v14.14.0)
    await Promise.all(expectedOutputFiles.map((file) => fs.rm(file, { force: true })))

    await promisify(execFile)('node', ['src/cli.js', '-i', 'test-positive/mermaid.md'])

    // files should exist, and they should be SVGs
    await Promise.all(expectedOutputFiles.map(async (file) => {
      const svgFile = await fs.readFile(file, { encoding: 'utf8' })
      expect(svgFile).toMatch(/^<svg/)
    }))
  })
});
