const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch()
  const page = await browser.newPage()
  await page.goto('https://mermaidjs.github.io/mermaid-live-editor')
  await page.click('button')
  const clip = await page.$eval('svg', svg => {
    const react = svg.getBoundingClientRect()
    return { x: react.left, y: react.top, width: react.width, height: react.height }
  })
  await page.screenshot({ path: 'flowchart.png', clip, omitBackground: true })
  browser.close()
})()
