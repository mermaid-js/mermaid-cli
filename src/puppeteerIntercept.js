/**
 * @import puppeteer from 'puppeteer';
 */

import { readFile, realpath } from 'node:fs/promises'
import path from 'node:path'
import url from 'node:url'

/**
 * Guesses the MIME-type of a file based on its extension.
 *
 * I've hardcoded the bare minimum number of MIME-types to support for security reasons.
 *
 * @param {string} filePath - The file path to guess the MIME-type for.
 */
function getContentTypeFromFileExtension (filePath) {
  const ext = path.extname(filePath).toLowerCase()
  switch (ext) {
    case '.css':
      // Make sure to set UTF-8, since sometimes Puppeteer can parse it as Latin-1.
      return 'text/css;charset=UTF-8'
    case '.js':
    case '.mjs':
      return 'application/javascript'
    case '.woff2':
      return 'font/woff2'
    default:
      throw new Error(`Unsupported file extension for intercept: ${ext}`)
  }
}

/**
 * Puppeteer doesn't allow importing ESM modules from `file://` URLs.
 * We don't want to create a dummy http server to serve ESM modules
 * (since that would cause issues with ports/firewalls), so this module
 * instead intercepts dummy `https://mermaid-cli-intercept.invalid` requests.
 */
export class Interceptor {
  #INTERCEPT_ORIGIN = 'https://mermaid-cli-intercept.invalid'

  /**
     * Set of allowed file directories that can be intercepted.
     *
     * This is used to prevent arbitrary file access through the intercept mechanism.
     *
     * Make sure to use `realpath` to resolve any symlinks.
     *
     * @type {Set<string>}
     */
  #allowedDirs = new Set()

  /**
   * @param {URL | `file://${string}`} fileUrl - File URL
   * @param {Object} [options] - Optional options.
   * @param {number} [options.allowParentDirectoryLevel] - Number of parent directory levels to allow access to.
   */
  async fileUrlToInterceptUrl (fileUrl, {
    allowParentDirectoryLevel = 1
  } = {}) {
    fileUrl = new URL(fileUrl)
    if (fileUrl.protocol !== 'file:') {
      throw new Error(`Invalid file URL: ${fileUrl}`)
    }
    let parentDirectory = await realpath(url.fileURLToPath(fileUrl))
    while (allowParentDirectoryLevel-- >= 0) {
      parentDirectory = path.dirname(parentDirectory)
    }
    this.#allowedDirs.add(parentDirectory)
    return `${this.#INTERCEPT_ORIGIN}${fileUrl.pathname}`
  }

  /**
     *
     * @param {URL | string} interceptUrl
     * @throws {Error} If the URL is not a valid intercept URL
     */
  async interceptUrlToFileUrl (interceptUrl) {
    interceptUrl = new URL(interceptUrl)
    if (interceptUrl.origin !== this.#INTERCEPT_ORIGIN) {
      throw new Error(`Invalid intercept URL: ${interceptUrl}`)
    }
    const fileUrl = new URL(interceptUrl.href.slice(this.#INTERCEPT_ORIGIN.length), 'file://')
    const filePath = await realpath(url.fileURLToPath(fileUrl))
    if (![...this.#allowedDirs].some(dir => path.relative(filePath, dir).startsWith('..'))) {
      throw new Error(`Intercept URL is not in an allowed directory: ${interceptUrl}`)
    }
    return fileUrl
  }

  /**
     * @param {puppeteer.HTTPRequest} request - The intercepted request
     */
  async #interceptRequestHandler (request) {
    try {
      if (request.url().startsWith(this.#INTERCEPT_ORIGIN)) {
        const fileUrl = await this.interceptUrlToFileUrl(request.url())
        return request.respond({
          status: 200,
          headers: {
            'Access-Control-Allow-Origin': '*'
          },
          contentType: getContentTypeFromFileExtension(url.fileURLToPath(fileUrl)),
          body: await readFile(fileUrl)
        })
      }
    } catch (error) {
      console.error(`Error handling intercept request for ${request.url()}:`, error)
      request.abort()
    }
    request.continue()
  }

  /**
     * Intercepts requests to `https://mermaid-cli-intercept.invalid`
     * and serves the corresponding file content.
     *
     * @return {puppeteer.Handler<puppeteer.HTTPRequest>}
     */
  get interceptRequestHandler () {
    return this.#interceptRequestHandler.bind(this)
  }
}
