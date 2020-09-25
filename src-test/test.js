"use strict";

const fs = require("fs");
const { execSync, spawnSync } = require("child_process");
const workflows = "test-positive";
const out = "test-positive";

/**
 * Process workflow from stdin into specified format file
 */
async function compileDiagramFromStdin(file, format) {
  return new Promise(function (resolve, reject) {
    try {
      const result = file.replace(".mmd", "-stdin." + format);
      // eslint-disable-next-line no-console
      console.warn(`Compiling ${file} into ${result}`);
      execSync(`cat ${workflows}/${file} | \
        node index.js -o ${out}/${result} -c ${workflows}/config.json`);

      resolve();
    } catch (err) {
      console.warn(`${file}: child process failed with error: ${err.message}`);

      reject(err);
    }
  });
}

/**
 * Process workflow into specified format file
 */
async function compileDiagram(file, format) {
  return new Promise(async function(resolve, reject) {
    const result = file.replace(".mmd", "." + format);
    // eslint-disable-next-line no-console
    console.warn(`Compiling ${file} into ${result}`);
    const child = spawnSync("node", [
      "index.js",
      "-i",
      workflows + "/" + file,
      "-o",
      out + "/" + result,
      "-c",
      workflows + "/config.json"
    ], { timeout: 5000 });

    const stdout = child.stdout.toString('utf8').trim()
    if (stdout !== "") {
      console.info(stdout)
    }
    const stderr = child.stderr.toString('utf8').trim()
    if (stderr !== "") {
      console.warn(stderr)
    }

    if (child.status !== 0 || child.error) {
      // eslint-disable-next-line no-console
      console.warn(`${file}: child process exited with code ${child.status}, error ${child.error}`);
      reject(child.status);
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
          if (!file.endsWith(".mmd")) {
            return Promise.resolve();
          }
          const expectError = /expect-error/.test(file);
          const resultP = compileDiagram(file, "svg")
            .then(() => compileDiagram(file, "png"));
          if (!expectError) return resultP;
          try {
            await resultP;
          } catch (err) {
            return `compling ${file} produced an error, which is well`;
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
          if (!file.endsWith(".mmd")) {
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
