The text below is taken from Issue #331.

If you run mermaid-cli with the `--help` flag, there's an option for `--puppeteerConfigFile`, which is a JSON configuration file for puppeteer.

These are options passed to [`puppeteer.launch`](https://pptr.dev/api/puppeteer.puppeteernode.launch/).

The useful options for you are:
  - [`executablePath`](https://pptr.dev/api/puppeteer.launchoptions.executablepath) Path to a browser executable to use instead of the bundled Chromium. Note that Puppeteer is only guaranteed to work with the bundled Chromium, so use this setting at your own risk. You may find https://github.com/puppeteer/puppeteer/blob/main/versions.js useful to see **which versions of Chrome are compatible with versions of puppeteer**.
  - [`product`](https://pptr.dev/api/puppeteer.product) (in case you want to use firefox instead of chrome)
  - [`timeout`](https://pptr.dev/api/puppeteer.launchoptions.timeout) can be used to increase/decrease timeout before puppeteer throws an error

You'll probably want a file called `puppeteerConfigFile.json` with contents:

```json
{
  "executablePath": "C:\\path\\to\\your\\chrome.exe"
}
```

Then run mermaid-cli with option `mmdc --puppeteerConfigFile puppeteerConfigFile.json`.

You might also be able to do the same thing with environment variables by following: https://pptr.dev/#environment-variables.

Btw, if you set `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=1` as an env variable when running `yarn install` or `npm install`, it should skip downloading CHROMIUM too.
