"use strict";

const fs = require("fs");
const { spawnSync } = require("child_process");
const workflows = "test";
const out = "test";

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
          if (file.endsWith(".mmd")) {
            return compileDiagram(file, "svg").then(code => compileDiagram(file, "png"))
          } else {
            return Promise.resolve();
          }
        })
      ));
    });
  })
}

module.exports = {
  compileAll
};

if (require.main === module) {
  compileAll().catch(err => {
    console.warn("Compilation failed", err)
    process.exit(1);
  });
}
