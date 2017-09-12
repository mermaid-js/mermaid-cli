const puppeteer = require('puppeteer')
const fs = require('fs')
const path = require('path');

(async () => {
  const browser = await puppeteer.launch()
  const page = await browser.newPage()
  await page.goto(`file://${path.join(__dirname, 'index.html')}`)
  const svg = await page.$eval('svg', svg => svg.outerHTML)
  fs.writeFileSync('flowchart.svg', svg)
  browser.close()
})()
