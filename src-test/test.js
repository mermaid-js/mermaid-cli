"use strict";

const fs = require("fs/promises");
const { exec, execFile } = require("child_process");

// Joins together directory/file names in a OS independent way
const {join} = require("path");
const {promisify} = require("util");

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
  // eslint-disable-next-line no-console
  console.warn(`Compiling ${file} into ${result}`);
  // exec will throw with stderr if there is a non-zero exit code
  return await promisify(exec)(`cat ${workflow}/${file} | \
    node index.bundle.js -o ${out}/${result} -c ${workflow}/config.json`
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
    // eslint-disable-next-line no-console
    console.warn(`Compiling ${file} into ${result}`);

    const args = [
      "index.bundle.js",
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
    const output = await promisify(execFile)("node", args, { timeout: 5000 });

    if (output.stdout) {
      console.info(output.stdout);
    }
    if (output.stderr) {
      console.warn(output.stderr);
    }
    return output;
}

/**
 * Process all workflows into files
 */
async function compileAll() {
  await fs.mkdir(out, { recursive: true });

  await Promise.all(workflows.map(async(workflow) => {
    const files = await fs.readdir(workflow);
    await Promise.all(
        files.map(async file => {
          if (!(file.endsWith(".mmd") | /\.md$/.test(file)) && file !== 'markdown-output.out.md') {
            return Promise.resolve();
          }
          let resultP;
          if (file === 'markdown-output.md') {
            resultP = compileDiagram(workflow, file, "out.md");
          } else {
            resultP = compileDiagram(workflow, file, "svg")
              .then(() => compileDiagram(workflow, file, "png"));
          }
          const expectError = /expect-error/.test(file);
          if (!expectError) return resultP;
          try {
            await resultP;
          } catch (err) {
            console.log(`✅ compiling ${file} produced an error, which is well`);
            return;
          }
          throw new Error(`Expected ${file} to fail, but it succeeded`);
        })
    )
  }))
}

/**
 * Process all workflows for stdin into files
 */
async function compileAllStdin() {
  await fs.mkdir(out, { recursive: true });

  await Promise.all(workflows.map(async(workflow) => {
    const files = await fs.readdir(workflow);
    await Promise.all(
        files.map(async file => {
          // currently, piping markdown through stdin is not supported
          // as mermaid-cli has no idea it's markdown, not mermaid code
          if (!(file.endsWith(".mmd"))) {
            return `Skipping ${file}, as it does not end with .mmd`;
          }
          const expectError = /expect-error/.test(file);
          const resultP = compileDiagramFromStdin(workflow, file, "svg")
            .then(() => compileDiagramFromStdin(workflow, file, "png"));
          if (!expectError) return resultP;
          try {
            await resultP;
          } catch (err) {
            console.log(`✅ compiling ${file} from stdin produced an error, which is well`);
            return;
          }
          throw new Error(`Expected ${file} from stdin to fail, but it succeeded`);
        })
    )
  }))
}

async function shouldErrorOnFailure() {
  await fs.mkdir(out, { recursive: true });
  await compileDiagram("test-positive", "sequence.mmd", "svg"); // should work with default puppeteerConfigFile
  try {
    await compileDiagram("test-positive", "sequence.mmd", "svg", {puppeteerConfigFile: "../test-negative/puppeteerTimeoutConfig.json"});
  } catch (error) {
    console.log(`compiling with invalid puppeteerConfigFile file produced an error, which is well`);
    return;
  }
  throw new Error(`Expected compling invalid puppeteerConfigFile file to fail, but it succeeded`);
}

async function shouldErrorOnEmptyInput() {
  try {
    await promisify(execFile)('node', ['index.bundle.js'])
  } catch (error) {
    console.log(`✅compiling with no input produced an error, which is well`)
    return
  }
  throw new Error('Expected compiling with no input to fail, but it succeeded')
}

module.exports = {
  shouldErrorOnFailure,
  shouldErrorOnEmptyInput,
  compileAll,
  compileAllStdin
};

if (require.main === module) {
  shouldErrorOnEmptyInput().catch(err => {
    console.warn("Compilation failed", err)
    process.exit(1);
  });

  shouldErrorOnFailure().catch(err => {
    console.warn("Compilation failed", err)
    process.exit(1);
  });

  compileAll().catch(err => {
    console.warn("Compilation failed", err)
    process.exit(1);
  });

  compileAllStdin().catch(err => {
    console.warn("Compilation failed", err)
    process.exit(1);
  });
}
