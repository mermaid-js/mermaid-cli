import { defineConfig } from "vite"
import { viteSingleFile } from "vite-plugin-singlefile"
import svgLoader from 'vite-svg-loader'

export default defineConfig({
  plugins: [
    // bundle everything into a single `index.html`
    viteSingleFile(),
    // unsure if this is working properly for fontawesome fonts
    svgLoader(),
  ],
})
