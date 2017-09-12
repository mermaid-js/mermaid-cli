const puppeteer = require('puppeteer')
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch()
  const page = await browser.newPage()
  await page.goto('https://mermaidjs.github.io/mermaid-live-editor')
  await page.click('button')
  const clip = await page.$eval('svg', svg => {
    const react = svg.getBoundingClientRect()
    return { x: react.left, y: react.top, width: react.width, height: react.height }
  })
  const svg = await page.$eval('svg', svg => svg.outerHTML)
  fs.writeFileSync('flowchart.svg', svg)
  await page.screenshot({ path: 'flowchart.png', clip, omitBackground: true })
  browser.close()
})()
