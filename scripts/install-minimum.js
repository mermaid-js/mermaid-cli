#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "child_process";
import semver from "semver";

/**
 * Installs the minimum dependencies of this package for testing.
 *
 * @TODO We might be able to switch to using PNPM's `resolutionMode=lowest-direct`
 *       for this later.
 */
async function main() {
  const packageJson = JSON.parse(await readFile("package.json", "utf8"));

  for (const dependencyType of ["dependencies", "peerDependencies"]) {
    for (const [packageName, versionRange] of Object.entries(
      packageJson[dependencyType] || {},
    )) {
      const minimumVersion = semver.minVersion(versionRange);
      if (!minimumVersion) {
        throw new Error(
          `Could not determine minimum version for ${packageName} with version range ${versionRange}`,
        );
      }
      packageJson[dependencyType][packageName] = minimumVersion.version;
    }
  }

  // Remove all optional dependencies, since they're supposed to be optional
  packageJson.optionalDependencies = {};

  await writeFile(
    "package.json",
    JSON.stringify(packageJson, null, 2) + "\n",
    "utf8",
  );

  const command = /** @type {const} */ (["npm", "install"]);

  console.log(`Running command: ${command.join(" ")}`);

  await execFileSync(command[0], command.slice(1), {
    stdio: "inherit",
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
