"use strict";

const fs = require("fs");
const { execSync, spawnSync } = require("child_process");

// Joins together directory/file names in a OS independent way
const {join} = require("path");

const workflows = "test-positive";
const out = "test-positive";

/**
 * Process workflow from stdin into specified format file
 */
async function compileDiagramFromStdin(file, format) {
  return new Promise(function (resolve, reject) {
    try {
      const result = file.replace(/\.(?:mmd|md)$/, "-stdin." + format);
      // eslint-disable-next-line no-console
      console.warn(`Compiling ${file} into ${result}`);
      execSync(`cat ${workflows}/${file} | \
        node index.bundle.js -o ${out}/${result} -c ${workflows}/config.json`);

      resolve();
    } catch (err) {
      console.warn(`${file}: child process failed with error: ${err.message}`);

      reject(err);
    }
  });
}

/**
 * Process workflow into specified format file
 * 
 * @param {string} file - Name of mermaid input file relative to workflow folder.
 * @param {"svg" | "pdf" | "png"} format - Format of output file.
 * @param {Object} [options] - Optional options.
 * @param {string} [options.puppeteerConfigFile] - If set, puppeteerConfigFile.
 * Must be relative to workflow folder.
 * @throws {Error} if mmdc fails to launch, or if it has exitCode != 0
 */
async function compileDiagram(file, format, {puppeteerConfigFile} = {}) {
  return new Promise(async function(resolve, reject) {
    const result = file.replace(/\.(?:mmd|md)$/, "." + format);
    // eslint-disable-next-line no-console
    console.warn(`Compiling ${file} into ${result}`);

    const args = [
      "index.bundle.js",
      "-i",
      workflows + "/" + file,
      "-o",
      out + "/" + result,
      "-c",
      workflows + "/config.json",
      "-b",
      "lightgray"
    ];

    if (puppeteerConfigFile) {
      args.push("--puppeteerConfigFile", join(workflows, puppeteerConfigFile));
    }

    const child = spawnSync("node", args, { timeout: 5000 });

    const stdout = child.stdout.toString('utf8').trim()
    if (stdout !== "") {
      console.info(stdout)
    }
    const stderr = child.stderr.toString('utf8').trim()
    if (stderr !== "") {
      console.warn(stderr)
    }

    if (child.status !== 0 || child.error) {
      reject(new Error(`${file}: child process exited with code ${child.status}, error ${child.error}`));
    } else {
      resolve(child.status);
    }
  });
}

/**
 * Process all workflows into files
 */
async function compileAll() {
  if (!fs.existsSync(out)) {
    fs.mkdirSync(out, { recursive: true });
  }

  return new Promise(async function (resolve, reject) {
    fs.readdir(workflows, async (err, files) => {
      resolve(Promise.all(
        files.map(async file => {
          if (!(file.endsWith(".mmd") | /\.md$/.test(file)) && file !== 'markdown-output.out.md') {
            return Promise.resolve();
          }
          let resultP;
          if (file === 'markdown-output.md') {
            resultP = compileDiagram(file, "out.md");
          } else {
            resultP = compileDiagram(file, "svg")
              .then(() => compileDiagram(file, "png"));
          }
          const expectError = /expect-error/.test(file);
          if (!expectError) return resultP;
          try {
            await resultP;
          } catch (err) {
            return `compiling ${file} produced an error, which is well`;
          }
          throw new Error(`Expected ${file} to fail, but it succeeded`);
        })
      ));
    });
  })
}

/**
 * Process all workflows for stdin into files
 */
async function compileAllStdin() {
  if (!fs.existsSync(out)) {
    fs.mkdirSync(out, { recursive: true });
  }

  return new Promise(async function (resolve, reject) {
    fs.readdir(workflows, async (err, files) => {
      resolve(Promise.all(
        files.map(async file => {
          if (!(file.endsWith(".mmd") | /\.md$/.test(file))) {
            return Promise.resolve();
          }
          const expectError = /expect-error/.test(file);
          const resultP = compileDiagramFromStdin(file, "svg")
            .then(() => compileDiagramFromStdin(file, "png"));
          if (!expectError) return resultP;
          try {
            await resultP;
          } catch (err) {
            return `compling ${file} from stdin produced an error, which is well`;
          }
          throw new Error(`Expected ${file} from stdin to fail, but it succeeded`);
        })
      ));
    });
  })
}

module.exports = {
  compileAll,
  compileAllStdin
};

if (require.main === module) {
  compileAll().catch(err => {
    console.warn("Compilation failed", err)
    process.exit(1);
  });

  compileAllStdin().catch(err => {
    console.warn("Compilation failed", err)
    process.exit(1);
  });
}
