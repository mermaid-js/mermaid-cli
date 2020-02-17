"use strict";

const fs = require("fs");
const { spawn } = require("child_process");
const workflows = "test";
const out = "test";

/**
 * Process workflow into specified format file
 */
async function compileDiagram(file, format) {
  return new Promise(async function (resolve, reject) {
    const result = file.replace(".mmd", "." + format);
    // eslint-disable-next-line no-console
    console.warn(`Compiling ${file} into ${result}`);
    const child = spawn("node", [
      "index.bundle.js",
      "-i",
      workflows + "/" + file,
      "-o",
      out + "/" + result
    ]);
    child.stderr.on("data", data => {
      // eslint-disable-next-line no-console
      console.warn(`${file}: ${data}`);
    });

    child.on("close", code => {
      if (code !== 0) {
        // eslint-disable-next-line no-console
        console.warn(`${file}: child process exited with code ${code}`);
        reject(code)
      } else {
        resolve(code)
      }
    });
  })
}

/**
 * Process all workflows into files
 */
async function compileAll() {
  if (!fs.existsSync(out)) {
    fs.mkdirSync(out, { recursive: true });
  }
  fs.readdir(workflows, (err, files) => {
    files.forEach(async file => {
      if (file.endsWith(".mmd")) {
        await compileDiagram(file, "svg")
        await compileDiagram(file, "png")
      }
    });
  });
}

module.exports = {
  compileAll
};

if (require.main === module) {
  compileAll();
}
