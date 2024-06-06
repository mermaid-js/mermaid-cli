import { defineConfig } from "vite"

export default defineConfig({
  base: './',
  plugins: [
    {
      name: 'IIFE-converter',
      config(currentConfig, _unused) {
        return {
          ...currentConfig,
          build: {
            ...currentConfig.build,
            rollupOptions: {
              ...currentConfig.build?.rollupOptions,
              output: {
                ...currentConfig.build?.rollupOptions?.output,
                format: 'iife',
              }
            }
          }
        };
      },
      transformIndexHtml(html) {
        return html.replace('<script type="module" crossorigin', '<script charset="utf-8"')
      }
    }
  ]
});
