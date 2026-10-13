import {
  afterAll,
  beforeAll,
  describe,
  expect,
  jest,
  test,
} from "@jest/globals";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Interceptor } from "./puppeteerIntercept.js";

const INTERCEPT_ORIGIN = "https://mermaid-cli-intercept.invalid";

/**
 * Fake version of {@link Interceptor#fileUrlToInterceptUrl} to simulate
 * attackers/relative URLs.
 *
 * @param {URL | `file://${string}`} fileUrl - File URL
 */
function fakeFileUrlToInterceptUrl(fileUrl) {
  fileUrl = new URL(fileUrl);
  if (fileUrl.protocol !== "file:") {
    throw new Error(`Invalid file URL: ${fileUrl}`);
  }
  return `${INTERCEPT_ORIGIN}${fileUrl.pathname}`;
}

/**
 * @typedef {Object} TestSetup
 * @property {URL} tempDir - Temporary directory for the test files.
 * @property {URL} allowedFile - A file inside the allowed directory.
 * @property {URL} siblingFile - A sibling directory to the allowed directory. Should only be allowed if `allowParentDirectoryLevel` is `1` or higher.
 * @property {URL} wrongFileType - A file with the wrong file type inside the allowed directory.
 * @property {URL} nonExistentFile - A file that does not exist in the allowed directory.
 * @property {URL} symlinkToAllowed - A symlink inside the allowed directory that points to `allowedFile`.
 * @property {URL} symlinkDirToAllowed - A symlink inside a symlink directory that points to the allowed directory.
 * @property {URL} symlinkToSibling - A symlink inside the allowed directory that points to `siblingFile`.
 * @property {Interceptor} interceptor - An interceptor that has allowed the `allowedFile` directory.
 */

describe("Interceptor allowed directory checks", () => {
  /** @type {TestSetup} */
  let testSetup;

  beforeAll(async () => {
    const tempDir = await mkdtemp(
      path.join(os.tmpdir(), "mermaid-cli-intercept-"),
    );
    const allowedDir = path.join(tempDir, "allowed");
    const siblingDir = path.join(tempDir, "sibling");
    const symlinkDir = path.join(tempDir, "symlink");
    testSetup = {
      tempDir: pathToFileURL(tempDir),
      allowedFile: pathToFileURL(path.join(allowedDir, "entry.js")),
      wrongFileType: pathToFileURL(path.join(allowedDir, "wrong.txt")),
      nonExistentFile: pathToFileURL(path.join(tempDir, "non-existent.js")),
      siblingFile: pathToFileURL(path.join(siblingDir, "entry.js")),
      symlinkToAllowed: pathToFileURL(path.join(allowedDir, "linked.js")),
      symlinkDirToAllowed: pathToFileURL(path.join(symlinkDir, "entry.js")),
      symlinkToSibling: pathToFileURL(
        path.join(allowedDir, "linked-sibling.js"),
      ),
      interceptor: new Interceptor(),
    };

    await Promise.all([mkdir(allowedDir), mkdir(siblingDir)]);
    await Promise.all([
      writeFile(testSetup.allowedFile, "console.log('Hello World');"),
      writeFile(testSetup.siblingFile, "console.log('Hello World');"),
      writeFile(testSetup.wrongFileType, "Hello World"),
      symlink(testSetup.allowedFile, testSetup.symlinkToAllowed),
      symlink(testSetup.siblingFile, testSetup.symlinkToSibling),
      symlink(allowedDir, symlinkDir, "junction"),
    ]);
    await testSetup.interceptor.fileUrlToInterceptUrl(testSetup.allowedFile);
  });

  afterAll(async () => {
    await rm(testSetup?.tempDir, { recursive: true });
  });

  test("should match fakeFileUrlToInterceptUrl", async () => {
    // check that our fakeFileUrlToInterceptUrl function produces the same
    // result as the real Interceptor#fileUrlToInterceptUrl method.
    await expect(
      testSetup.interceptor.fileUrlToInterceptUrl(testSetup.allowedFile),
    ).resolves.toEqual(fakeFileUrlToInterceptUrl(testSetup.allowedFile));
  });

  test("should allow access to the allowed file or symlinks to the allowed file", async () => {
    for (const allowedFile of [
      testSetup.allowedFile,
      testSetup.symlinkToAllowed,
    ]) {
      await expect(
        testSetup.interceptor.interceptUrlToFileUrl(
          fakeFileUrlToInterceptUrl(allowedFile),
        ),
      ).resolves.toBeInstanceOf(URL);
    }
  });

  test("should allow access to files whose given path differs from their realpath", async () => {
    const freshInterceptor = new Interceptor();
    const interceptUrl = await freshInterceptor.fileUrlToInterceptUrl(
      testSetup.symlinkDirToAllowed,
    );
    await expect(
      freshInterceptor.interceptUrlToFileUrl(interceptUrl),
    ).resolves.toBeInstanceOf(URL);
  });

  test("should reject access to outside the allowed directory", async () => {
    for (const testFile of [
      testSetup.siblingFile,
      testSetup.symlinkToSibling,
    ]) {
      await expect(
        testSetup.interceptor.interceptUrlToFileUrl(
          fakeFileUrlToInterceptUrl(testFile),
        ),
      ).rejects.toThrow("Intercept URL is not in an allowed directory");
    }

    // this should allow the sibling files to be accessed
    await testSetup.interceptor.fileUrlToInterceptUrl(testSetup.allowedFile, {
      allowParentDirectoryLevel: 1,
    });

    for (const testFile of [
      testSetup.siblingFile,
      testSetup.symlinkToSibling,
    ]) {
      await expect(
        testSetup.interceptor.interceptUrlToFileUrl(
          fakeFileUrlToInterceptUrl(testFile),
        ),
      ).resolves.toBeInstanceOf(URL);
    }
  });

  describe("interceptRequestHandler", () => {
    /**
     * Makes a mocked {@link HTTPRequest} object.
     *
     * @param {string} requestUrl
     * @returns {import('puppeteer').HTTPRequest}
     */
    const createRequest = (requestUrl) => ({
      url: () => requestUrl,
      // @ts-expect-error -- mocking HTTPRequest methods for testing purposes
      respond: jest.fn(),
      // @ts-expect-error -- mocking HTTPRequest methods for testing purposes
      abort: jest.fn(),
      // @ts-expect-error -- mocking HTTPRequest methods for testing purposes
      continue: jest.fn(),
    });

    test("should respond with 404 for files that don't exist", async () => {
      const requestHandler = testSetup.interceptor.interceptRequestHandler;
      for (const testFile of [testSetup.nonExistentFile]) {
        const request = createRequest(fakeFileUrlToInterceptUrl(testFile));
        await requestHandler(request);
        expect(request.respond).toHaveBeenCalledWith(
          expect.objectContaining({
            status: 404,
            body: expect.stringContaining("File not found"),
          }),
          expect.anything(),
        );
      }
    });
  });
});
